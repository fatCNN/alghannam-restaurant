// واجهة قراءة المنيو العام — Supabase
// تدعم العربية والإنجليزية، مع الاحتفاظ بالنصوص الأصلية للغتين.

import {
  supabaseClient as publicClient,
  isSupabaseConfigured
} from "./dashboard/supabase-client.js";

if (!isSupabaseConfigured || !publicClient) {
  throw new Error("إعدادات Supabase غير مكتملة في dashboard/supabase-config.js");
}

function localizedText(english, arabic, language = "ar") {
  if (language === "en" && typeof english === "string" && english.trim()) {
    return english.trim();
  }
  return typeof arabic === "string" ? arabic : "";
}

/**
 * قراءة أقسام ومنتجات الفرع.
 * @param {string} branchId معرف الفرع
 * @param {"ar"|"en"} language اللغة المطلوبة
 */
export async function loadBranchMenu(branchId, language = "ar") {
  const currentLanguage = language === "en" ? "en" : "ar";

  const [categoryResult, productResult] = await Promise.all([
    publicClient
      .from("categories")
      .select("id,branch_id,name,name_en,slug,is_active,sort_order")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    publicClient
      .from("products")
      .select("id,branch_id,category_id,name,name_en,description,description_en,price,image_url,image_path,is_available,sort_order,extra")
      .eq("branch_id", branchId)
      .eq("is_available", true)
      .order("sort_order", { ascending: true })
  ]);

  if (categoryResult.error) {
    throw new Error(`قراءة التصنيفات: ${categoryResult.error.message}`);
  }
  if (productResult.error) {
    throw new Error(`قراءة المنتجات: ${productResult.error.message}`);
  }

  const categories = (categoryResult.data || []).map(category => ({
    ...category,
    name_ar: category.name || "",
    name_en: category.name_en || "",
    name: localizedText(category.name_en, category.name, currentLanguage)
  }));

  const categoryById = new Map(categories.map(category => [String(category.id), category]));

  const products = (productResult.data || [])
    .filter(product => categoryById.has(String(product.category_id)))
    .map(product => {
      const category = categoryById.get(String(product.category_id));
      return {
        ...product,
        name_ar: product.name || "",
        name_en: product.name_en || "",
        description_ar: product.description || "",
        description_en: product.description_en || "",
        name: localizedText(product.name_en, product.name, currentLanguage),
        description: localizedText(product.description_en, product.description, currentLanguage),
        category_name: localizedText(category.name_en, category.name, currentLanguage),
        category_name_ar: category.name_ar,
        category_name_en: category.name_en,
        category_slug: category.slug
      };
    });

  return { categories, products, language: currentLanguage };
}

export function ensureMenuDescriptionStyle() {
  if (document.getElementById("ghannamDatabaseDescriptionStyle")) return;

  const style = document.createElement("style");
  style.id = "ghannamDatabaseDescriptionStyle";
  style.textContent = `
    .ghannam-db-description {
      margin: 6px 0 0;
      font-size: .9rem;
      line-height: 1.6;
      color: var(--text-muted, #6b625b);
    }
  `;
  document.head.appendChild(style);
}

/**
 * استخراج اسم الصورة المحلية من بيانات المنتج.
 * إذا كانت الصورة URL كاملة، يرجع اسم الملف فقط للاستخدام الاحتياطي.
 */
export function getStoredImageName(product) {
  const candidate =
    product?.extra?.local_image_path ||
    product?.image_path ||
    product?.image_url ||
    "";

  if (!candidate) return "";

  try {
    const clean = String(candidate).split("?")[0].replace(/\\/g, "/");
    return clean.split("/").pop() || "";
  } catch {
    return "";
  }
}
