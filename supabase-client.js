/* ══════════════════════════════════════════════════════════════════════════
   SUPABASE CLIENT — replaces the old Apps Script apiRequest()
   Include this AFTER the Supabase CDN script tag, and BEFORE script.js.
   Then DELETE the old apiRequest() function (and WEB_APP_URL) in script.js.
   ══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://aiczonqwwfxvikowmzcr.supabase.co"; // your project URL
const SUPABASE_ANON_KEY = "sb_publishable_Z-sNfyMvnXcaLunFpfV4aQ_oHZipoj-"; // Project Settings > API

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Simple in-memory cache ──────────────────────────────────────────────
// Avoids re-fetching from Supabase every time a tab is reopened.
// Cleared automatically after CACHE_TTL_MS, or manually after any write.
const CACHE_TTL_MS = 30000; // 30 seconds
const _cache = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  _cache.set(key, { value, time: Date.now() });
}

// Call after any write (saveProduct, stockOut, etc.) so stale reads aren't served.
function cacheInvalidate(...keys) {
  if (keys.length === 0) { _cache.clear(); return; }
  keys.forEach(k => _cache.delete(k));
}

// Fetches ALL rows from a table, working around Supabase's default 1000-row
// per-request limit by paging through with .range() until exhausted.
async function fetchAllRows(table, orderCol = null, ascending = false) {
  const pageSize = 1000;
  let allRows = [];
  let from = 0;

  while (true) {
    let query = sb.from(table).select("*").range(from, from + pageSize - 1);
    if (orderCol) query = query.order(orderCol, { ascending });
    const { data, error } = await query;
    if (error) throw error;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

// Converts a Postgres ISO timestamp (2026-09-18T10:16:32+00:00) into the
// "M/D/YYYY HH:mm:ss" style the rest of the app expects/displays.
function formatDatetime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const pad = n => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function apiRequest(action, payload = {}) {
  try {
    switch (action) {

      case "login": {
        const email = `${payload.username.toLowerCase()}@ava.local`;
        const { data, error } = await sb.auth.signInWithPassword({
          email,
          password: payload.password
        });
        if (error) return { success: false };

        const { data: profile } = await sb
          .from("profiles")
          .select("username, role, store")
          .eq("id", data.user.id)
          .single();

        return {
          success: true,
          username: profile?.username || payload.username,
          role: profile?.role || "user",
          store: profile?.store || ""
        };
      }

      case "getProducts": {
        const cached = cacheGet("getProducts");
        if (cached) return cached;
        const data = await fetchAllRows("inventory");
        const result = { products: data };
        cacheSet("getProducts", result);
        return result;
      }

      case "saveProduct": {
        const { error } = await sb.from("inventory").upsert(payload, { onConflict: "barcode" });
        if (error) return { message: "Error saving: " + error.message };
        cacheInvalidate("getProducts");
        return { message: "Saved!" };
      }

      case "getHistory": {
        const cached = cacheGet("getHistory");
        if (cached) return cached;
        const data = await fetchAllRows("deduct_history", "datetime", false);
        const records = data.map(r => ({
          ...r,
          qty: r.quantity_out,
          remarks: r.remark,
          datetime: formatDatetime(r.datetime)
        }));
        const result = { records };
        cacheSet("getHistory", result);
        return result;
      }

      case "getStoreInventory": {
        const cached = cacheGet("getStoreInventory");
        if (cached) return cached;
        const data = await fetchAllRows("store_inventory");
        const products = data.map(p => ({ ...p, location: p.store }));
        const result = { products };
        cacheSet("getStoreInventory", result);
        return result;
      }

      case "getStoreProducts": {
        const cacheKey = "getStoreProducts:" + payload.store;
        const cached = cacheGet(cacheKey);
        if (cached) return cached;
        const { data, error } = await sb
          .from("store_inventory")
          .select("*")
          .eq("store", payload.store);
        if (error) throw error;
        const products = data.map(p => ({ ...p, storeQty: p.stock }));
        const result = { products };
        cacheSet(cacheKey, result);
        return result;
      }

      case "getSalesStats": {
        // Sums today's deduct_history rows whose remark mentions this store
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { data, error } = await sb
          .from("deduct_history")
          .select("*")
          .gte("datetime", startOfDay.toISOString())
          .ilike("remark", `%${payload.store}%`);
        if (error) throw error;

        const salesToday = data.reduce((sum, r) => sum + Number(r.total || 0), 0);
        const itemsSold = data.reduce((sum, r) => sum + Number(r.quantity_out || 0), 0);
        return { salesToday, transToday: data.length, itemsSold };
      }

      case "stockOut": {
        const { data, error } = await sb.rpc("stock_out", {
          p_barcode: payload.barcode,
          p_qty: payload.qty,
          p_remarks: payload.remarks,
          p_deduct_from: payload.deductFrom
        });
        if (error) return { message: "Error: " + error.message };
        cacheInvalidate("getProducts", "getHistory", "getStoreInventory", "getStoreProducts:" + payload.deductFrom);
        return data;
      }

      case "batchStockOut": {
        const { data, error } = await sb.rpc("batch_stock_out", {
          p_items: payload.items.map(i => ({
            barcode: i.barcode,
            qty: i.qty,
            remarks: i.remarks,
            deductFrom: i.deductFrom
          }))
        });
        if (error) return { errors: [error.message] };
        cacheInvalidate("getProducts", "getHistory", "getStoreInventory");
        payload.items.forEach(i => cacheInvalidate("getStoreProducts:" + i.deductFrom));
        return data;
      }

      case "logActivity": {
        const { error } = await sb.from("activity_log").insert({
          datetime: new Date().toISOString(),
          user_name: payload.user,
          type: payload.type,
          action: payload.action,
          details: payload.details
        });
        if (error) console.warn("logActivity error:", error);
        cacheInvalidate("getActivityLog");
        return { success: true };
      }

      case "getActivityLog": {
        const cached = cacheGet("getActivityLog");
        if (cached) return cached;
        const data = await fetchAllRows("activity_log", "datetime", false);
        const mapped = data.map(r => ({
          ...r,
          user: r.user_name,
          datetime: formatDatetime(r.datetime)
        }));
        const result = { data: mapped };
        cacheSet("getActivityLog", result);
        return result;
      }

      case "getCatalog": {
        const cached = cacheGet("getCatalog");
        if (cached) return cached;
        const data = await fetchAllRows("catalog");

        // Group flat rows (style + body_color + sizes) into { style, collection, price, colors:[...] }
        const grouped = {};
        data.forEach(row => {
          if (!grouped[row.style]) {
            grouped[row.style] = {
              style: row.style,
              collection: row.collection,
              price: row.price,
              colors: []
            };
          }
          grouped[row.style].colors.push({
            color: row.body_color,
            xs: row.xs, s: row.s, m: row.m, l: row.l, xl: row.xl
          });
        });
        const result = { catalog: Object.values(grouped) };
        cacheSet("getCatalog", result);
        return result;
      }

      case "getFabrics": {
        const cached = cacheGet("getFabrics");
        if (cached) return cached;
        const data = await fetchAllRows("fabrics");

        // Group flat rows (item_code + color + balance) into { itemNo, description, colors:[...] }
        const grouped = {};
        data.forEach(row => {
          if (!grouped[row.item_code]) {
            grouped[row.item_code] = {
              itemNo: row.item_code,
              description: row.description,
              colors: []
            };
          }
          grouped[row.item_code].colors.push({
            color: row.color,
            balance: row.balance,
            swatchUrl: row.swatch_url
          });
        });
        const result = { fabrics: Object.values(grouped) };
        cacheSet("getFabrics", result);
        return result;
      }

      default:
        console.warn("Unknown action:", action);
        return {};
    }
  } catch (err) {
    console.error("apiRequest error:", action, err);
    showConnectionBanner("Server error. Please refresh.", "error");
    throw err;
  }
}
