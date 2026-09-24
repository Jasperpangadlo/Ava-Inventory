/* ══════════════════════════════════════════════════════════════════════════
   SUPABASE CLIENT — replaces the old Apps Script apiRequest()
   Include this AFTER the Supabase CDN script tag, and BEFORE script.js.
   Then DELETE the old apiRequest() function (and WEB_APP_URL) in script.js.
   ══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://aiczonqwwfxvikowmzcr.supabase.co"; // your project URL
const SUPABASE_ANON_KEY = "sb_publishable_Z-sNfyMvnXcaLunFpfV4aQ_oHZipoj-"; // Project Settings > API

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let _retryingAfterRefresh = false;

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

// Sorts rows by product name, then color, then logical size order (XS→XL)
const SIZE_ORDER = { xs: 0, s: 1, m: 2, l: 3, xl: 4, xxl: 5 };
function sortBySize(rows) {
  return [...rows].sort((a, b) => {
    const p = String(a.product || "").localeCompare(String(b.product || ""));
    if (p !== 0) return p;
    const c = String(a.color || "").localeCompare(String(b.color || ""));
    if (c !== 0) return c;
    const ra = SIZE_ORDER[String(a.size || "").toLowerCase()] ?? 99;
    const rb = SIZE_ORDER[String(b.size || "").toLowerCase()] ?? 99;
    return ra - rb;
  });
}

// Exposed globally so the "Refresh Data" button can force a clean re-fetch
// for everyone, in case another user/device changed something.
window.clearApiCache = () => cacheInvalidate();

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
        const result = { products: sortBySize(data) };
        cacheSet("getProducts", result);
        return result;
      }

      case "saveProduct": {
        const { error } = await sb.from("inventory").upsert(payload, { onConflict: "barcode" });
        if (error) return { message: "Error saving: " + error.message };
        cacheInvalidate("getProducts");
        return { message: "Saved!" };
      }

      case "saveStockCart": {
        const items = payload.items || [];
        for (const item of items) {
          const barcode = String(item.barcode).trim();
          if (!barcode) continue;

          // Get current stock for this barcode, kung meron na
          const { data: existing, error: fetchErr } = await sb
            .from("inventory")
            .select("stock")
            .eq("barcode", barcode)
            .maybeSingle();
          if (fetchErr) return { success: false, message: "Error reading " + barcode + ": " + fetchErr.message };

          const addQty = Number(item.stock) || 0;
          const currentStock = existing ? Number(existing.stock) || 0 : 0;
          const newStock = currentStock + addQty; // ⚡ additive, hindi overwrite

          const upsertPayload = {
            barcode,
            product: item.product,
            category: item.category,
            color: item.color,
            size: item.size,
            price: item.price,
            stock: newStock
          };

          const { error } = await sb.from("inventory").upsert(upsertPayload, { onConflict: "barcode" });
          if (error) return { success: false, message: "Error saving " + barcode + ": " + error.message };

          // 📦 Log this addition so it can show up in the History tab as "Stock In"
          const { error: logErr } = await sb.from("stock_in_history").insert({
            datetime: new Date().toISOString(),
            barcode,
            product: item.product,
            color: item.color,
            size: item.size,
            quantity_in: addQty,
            price: item.price,
            remark: "Add Stock"
          });
          if (logErr) console.error("stock_in_history insert error:", logErr);
        }
        cacheInvalidate("getProducts", "getStockInHistory");
        return { success: true, message: "All stock saved!" };
      }

      case "getStockInHistory": {
        const cached = cacheGet("getStockInHistory");
        if (cached) return cached;
        const data = await fetchAllRows("stock_in_history", "datetime", false);
        const records = data.map(r => ({
          ...r,
          qty: r.quantity_in,
          remarks: r.remark,
          datetime: formatDatetime(r.datetime)
        }));
        const result = { records };
        cacheSet("getStockInHistory", result);
        return result;
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
        const products = sortBySize(data).map(p => ({ ...p, location: p.store }));
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
        const products = sortBySize(data).map(p => ({ ...p, storeQty: p.stock }));
        const result = { products };
        cacheSet(cacheKey, result);
        return result;
      }

      case "getSalesStats": {
        // Counts today's genuine sales for this store (remark format "<Store> - Walk-in/Online").
        // Note: Warehouse-sourced walk-in sales ("Warehouse - Walk-in") have no store
        // identifier in their remark, so they can't be safely attributed to a specific
        // store here — counting them for every store would double/triple-count them.
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { data, error } = await sb
          .from("deduct_history")
          .select("*")
          .gte("datetime", startOfDay.toISOString())
          .ilike("remark", `${payload.store} - %`);
        if (error) throw error;

        // ⚡ Defensive filter — the prefix match above should already exclude these,
        // but this guards against future remark-format changes.
        const salesOnly = data.filter(r => {
          const remark = String(r.remark || "").toLowerCase();
          return !remark.includes("transfer:") && !remark.includes("return:");
        });

        const salesToday = salesOnly.reduce((sum, r) => sum + Number(r.total || 0), 0);
        const itemsSold = salesOnly.reduce((sum, r) => sum + Number(r.quantity_out || 0), 0);
        return { salesToday, transToday: salesOnly.length, itemsSold };
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

      case "sendToStore": {
        const barcode = String(payload.barcode).trim();
        const store   = payload.store;
        const qty     = Number(payload.qty) || 0;

        // 1) Confirm the warehouse actually has enough stock
        const { data: whItem, error: whErr } = await sb
          .from("inventory")
          .select("*")
          .eq("barcode", barcode)
          .maybeSingle();
        if (whErr) return { success: false, message: "Error: " + whErr.message };
        if (!whItem) return { success: false, message: "Product not found: " + barcode };

        const whStock = Number(whItem.stock) || 0;
        if (whStock < qty) {
          return { success: false, message: `Not enough stock in warehouse (only ${whStock} available).` };
        }

        // 2) Deduct from warehouse
        const { error: deductErr } = await sb
          .from("inventory")
          .update({ stock: whStock - qty })
          .eq("barcode", barcode);
        if (deductErr) return { success: false, message: "Error updating warehouse stock: " + deductErr.message };

        // 3) Add to the destination store (additive if it already carries this barcode)
        const { data: storeItem, error: storeFetchErr } = await sb
          .from("store_inventory")
          .select("*")
          .eq("barcode", barcode)
          .eq("store", store)
          .maybeSingle();
        if (storeFetchErr) return { success: false, message: "Error reading store stock: " + storeFetchErr.message };

        const newStoreStock = (storeItem ? Number(storeItem.stock) || 0 : 0) + qty;

        let storeUpsertErr;
        if (storeItem) {
          const { error } = await sb
            .from("store_inventory")
            .update({ stock: newStoreStock })
            .eq("barcode", barcode)
            .eq("store", store);
          storeUpsertErr = error;
        } else {
          const { error } = await sb
            .from("store_inventory")
            .insert({
              barcode,
              store,
              product: whItem.product,
              category: whItem.category,
              color: whItem.color,
              size: whItem.size,
              price: whItem.price,
              stock: newStoreStock,
              date_sent: new Date().toISOString()
            });
          storeUpsertErr = error;
        }
        if (storeUpsertErr) return { success: false, message: "Error updating store stock: " + storeUpsertErr.message };

        // 4) Log it so it shows up in History
        await sb.from("deduct_history").insert({
          datetime: new Date().toISOString(),
          barcode,
          product: whItem.product,
          color: whItem.color,
          size: whItem.size,
          quantity_out: qty,
          price: whItem.price,
          total: Number(whItem.price || 0) * qty,
          remark: `Transfer: Warehouse → ${store}`
        });

        cacheInvalidate("getProducts", "getHistory", "getStoreInventory", "getStoreProducts:" + store);
        return { success: true, message: `Sent ${qty} unit(s) of ${whItem.product} to ${store}!` };
      }

      case "returnToWarehouse": {
        const barcode = String(payload.barcode).trim();
        const store   = payload.store;
        const qty     = Number(payload.qty) || 0;

        // 1) Confirm the store actually has enough stock to return
        const { data: storeItem, error: storeErr } = await sb
          .from("store_inventory")
          .select("*")
          .eq("barcode", barcode)
          .eq("store", store)
          .maybeSingle();
        if (storeErr) return { success: false, message: "Error: " + storeErr.message };
        if (!storeItem) return { success: false, message: `${barcode} is not currently stocked at ${store}.` };

        const storeStock = Number(storeItem.stock) || 0;
        if (storeStock < qty) {
          return { success: false, message: `Not enough stock at ${store} (only ${storeStock} available).` };
        }

        // 2) Deduct from the store
        const { error: deductErr } = await sb
          .from("store_inventory")
          .update({ stock: storeStock - qty })
          .eq("barcode", barcode)
          .eq("store", store);
        if (deductErr) return { success: false, message: "Error updating store stock: " + deductErr.message };

        // 3) Add back to the warehouse
        const { data: whItem, error: whFetchErr } = await sb
          .from("inventory")
          .select("*")
          .eq("barcode", barcode)
          .maybeSingle();
        if (whFetchErr) return { success: false, message: "Error reading warehouse stock: " + whFetchErr.message };

        const newWhStock = (whItem ? Number(whItem.stock) || 0 : 0) + qty;

        const { error: whUpsertErr } = await sb
          .from("inventory")
          .upsert({
            barcode,
            product: storeItem.product,
            category: storeItem.category,
            color: storeItem.color,
            size: storeItem.size,
            price: storeItem.price,
            stock: newWhStock
          }, { onConflict: "barcode" });
        if (whUpsertErr) return { success: false, message: "Error updating warehouse stock: " + whUpsertErr.message };

        // 4) Log it so it shows up in History
        await sb.from("deduct_history").insert({
          datetime: new Date().toISOString(),
          barcode,
          product: storeItem.product,
          color: storeItem.color,
          size: storeItem.size,
          quantity_out: qty,
          price: storeItem.price,
          total: Number(storeItem.price || 0) * qty,
          remark: `Return: ${store} → Warehouse`
        });

        cacheInvalidate("getProducts", "getHistory", "getStoreInventory", "getStoreProducts:" + store);
        return { success: true, message: `Returned ${qty} unit(s) of ${storeItem.product} to Warehouse!` };
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
    const status = err?.status || err?.code;
    const msg = String(err?.message || "").toLowerCase();
    const looksLikeExpiredSession =
      status === 401 || msg.includes("jwt") || msg.includes("expired") || msg.includes("invalid_token");

    if (looksLikeExpiredSession && action !== "login" && !_retryingAfterRefresh) {
      _retryingAfterRefresh = true;
      try {
        const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession();
        _retryingAfterRefresh = false;
        if (!refreshErr && refreshed?.session) {
          // Got a fresh token — retry the original request once
          return await apiRequest(action, payload);
        }
      } catch (e) {
        _retryingAfterRefresh = false;
      }

      // Refresh failed too — the session is genuinely gone (e.g. left open all day).
      // Clear local state and send the user back to the login screen with a clear reason.
      console.error("Session expired and could not be refreshed:", err);
      showConnectionBanner("Your session has expired. Please log in again.", "error");
      localStorage.removeItem("avaLoggedIn");
      localStorage.removeItem("avaUser");
      localStorage.removeItem("avaRole");
      localStorage.removeItem("avaStore");
      setTimeout(() => window.location.reload(), 1800);
      throw err;
    }

    console.error("apiRequest error:", action, err);
    showConnectionBanner("Server error. Please refresh.", "error");
    throw err;
  }
}
