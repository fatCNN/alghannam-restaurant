// =====================================================
// مطعم الغنّام — محرك الخصومات التلقائية المشترك
// =====================================================
import {
  supabaseClient,
  isSupabaseConfigured
} from "./dashboard/supabase-client.js";

let cachedDiscounts = [];
let lastLoadedAt = 0;

export async function loadBranchDiscounts(branchId, force = false) {
  if (!isSupabaseConfigured || !supabaseClient) return cachedDiscounts;
  const now = Date.now();
  if (!force && now - lastLoadedAt < 30000) return cachedDiscounts;

  const { data, error } = await supabaseClient
    .from("discounts")
    .select("id,name,discount_percent,scope_type,branch_ids,category_ids,product_ids,starts_at,ends_at,is_active")
    .eq("is_active", true);

  if (error) {
    console.error("تعذر تحميل الخصومات التلقائية:", error);
    // لا نمسح آخر نسخة سليمة بسبب انقطاع مؤقت.
    return cachedDiscounts;
  }

  cachedDiscounts = Array.isArray(data) ? data : [];
  lastLoadedAt = now;
  return cachedDiscounts;
}

export function getBestAutomaticDiscount(product, branchId, categoryId, discounts = cachedDiscounts, now = Date.now()) {
  if (!product) return null;
  const productId = String(product.id ?? product.product_id ?? "");
  const category = String(categoryId ?? product.category_id ?? "");
  const branch = String(branchId ?? "");
  let best = null;

  for (const rule of Array.isArray(discounts) ? discounts : []) {
    if (!rule || rule.is_active !== true) continue;
    const starts = Date.parse(rule.starts_at);
    const ends = Date.parse(rule.ends_at);
    if (!Number.isFinite(starts) || !Number.isFinite(ends) || now < starts || now >= ends) continue;

    const branches = Array.isArray(rule.branch_ids) ? rule.branch_ids.map(String) : [];
    const categories = Array.isArray(rule.category_ids) ? rule.category_ids.map(String) : [];
    const products = Array.isArray(rule.product_ids) ? rule.product_ids.map(String) : [];

    let matches = false;
    switch (rule.scope_type) {
      case "all_branches":
        matches = true;
        break;
      case "branch":
        matches = branches.includes(branch);
        break;
      case "category":
        matches = categories.includes(category);
        break;
      case "product":
        matches = products.includes(productId);
        break;
    }

    const percent = Math.max(0, Math.min(100, Number(rule.discount_percent) || 0));
    if (matches && percent > 0 && (!best || percent > best.percent)) {
      best = { id: rule.id, name: rule.name || "", percent };
    }
  }
  return best;
}

export function priceAfterAutomaticDiscount(price, discount) {
  const original = Math.max(0, Number(price) || 0);
  if (!discount) return original;
  return Math.max(0, Math.round(original * (1 - discount.percent / 100)));
}

export function automaticDiscountValue(price, discount) {
  const original = Math.max(0, Number(price) || 0);
  return Math.max(0, original - priceAfterAutomaticDiscount(original, discount));
}
