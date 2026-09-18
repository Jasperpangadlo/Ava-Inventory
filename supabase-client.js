/* ══════════════════════════════════════════════════════════════════════════
   SUPABASE CLIENT — replaces the old Apps Script apiRequest()
   Include this AFTER the Supabase CDN script tag, and BEFORE script.js.
   Then DELETE the old apiRequest() function (and WEB_APP_URL) in script.js.
   ══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://aiczonqwwfxvikowmzcr.supabase.co"; // your project URL
const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_KEY_HERE"; // Project Settings > API

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
        const { data, error } = await sb.from("inventory").select("*");
        if (error) throw error;
        return { products: data };
      }

      case "saveProduct": {
        const { error } = await sb.from("inventory").upsert(payload, { onConflict: "barcode" });
        if (error) return { message: "Error saving: " + error.message };
        return { message: "Saved!" };
      }

      case "getHistory": {
        const { data, error } = await sb
          .from("deduct_history")
          .select("*")
          .order("datetime", { ascending: false });
        if (error) throw error;
        return { records: data };
      }

      case "getStoreInventory": {
        const { data, error } = await sb.from("store_inventory").select("*");
        if (error) throw error;
        return { products: data };
      }

      case "getStoreProducts": {
        const { data, error } = await sb
          .from("store_inventory")
          .select("*")
          .eq("store", payload.store);
        if (error) throw error;
        const products = data.map(p => ({ ...p, storeQty: p.stock }));
        return { products };
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
        return { success: true };
      }

      case "getActivityLog": {
        const { data, error } = await sb
          .from("activity_log")
          .select("*")
          .order("datetime", { ascending: false });
        if (error) throw error;
        return { data };
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
