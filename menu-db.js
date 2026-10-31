
// ================================================
// مطعم الغنّام — قراءة المنيو من Supabase
// دعم العربية والإنجليزية مع الاحتفاظ بالنصوص الأصلية
// ================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY
} from "./dashboard/supabase-config.js";

/* التحقق من إعدادات الاتصال */

const validUrl = /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/.test(
    SUPABASE_URL || ""
);

const validKey =
    typeof SUPABASE_ANON_KEY === "string" &&
    SUPABASE_ANON_KEY.length > 25 &&
    !/YOUR_|ضع_المفتاح/i.test(SUPABASE_ANON_KEY);

if (!validUrl || !validKey) {
    throw new Error(
        "إعدادات Supabase غير مكتملة في dashboard/supabase-config.js"
    );
}

/* إنشاء الاتصال */

const publicClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

/* اختيار النص حسب اللغة */

function localizedText(arabic, english, language = "ar") {
    if (
        language === "en" &&
        typeof english === "string" &&
        english.trim()
    ) {
        return english.trim();
    }

    return typeof arabic === "string" ? arabic : "";
}

/* تحميل منيو الفرع */

export async function loadBranchMenu(branchId = "grill", language = "ar") {

    const currentLanguage = language === "en" ? "en" : "ar";

    const [categoryResult, productResult] = await Promise.all([

        // التصنيفات
        publicClient
            .from("categories")
            .select(`
                id,
                branch_id,
                name,
                name_en,
                slug,
                is_active,
                sort_order
            `)
            .eq("branch_id", branchId)
            .eq("is_active", true)
            .order("sort_order", {
                ascending: true
            }),

        // المنتجات
        publicClient
            .from("products")
            .select(`
                id,
                branch_id,
                name,
                name_en,
                description,
                description_en,
                price,
                image_url,
                image_path,
                is_available,
                sort_order,
                extra,
                category_id
            `)
            .eq("branch_id", branchId)
            .eq("is_available", true)
            .order("sort_order", {
                ascending: true
            })

    ]);

    /* معالجة أخطاء التصنيفات */

    if (categoryResult.error) {
        throw new Error(
            `خطأ قراءة التصنيفات: ${categoryResult.error.message}`
        );
    }

    /* معالجة أخطاء المنتجات */

    if (productResult.error) {
        throw new Error(
            `خطأ قراءة المنتجات: ${productResult.error.message}`
        );
    }

    /* تجهيز التصنيفات */

    const categories = (categoryResult.data || []).map(category => {

        const nameArabic = category.name || "";
        const nameEnglish = category.name_en || "";

        return {
            ...category,

            name_ar: nameArabic,
            name_en: nameEnglish,

            name: localizedText(
                nameArabic,
                nameEnglish,
                currentLanguage
            )
        };

    });

    /* ربط المنتجات بالتصنيفات */

    const categoryById = new Map(
        categories.map(category => [
            String(category.id),
            category
        ])
    );

    /* تجهيز المنتجات */

    const products = (productResult.data || [])

        .filter(product =>
            categoryById.has(String(product.category_id))
        )

        .map(product => {

            const category = categoryById.get(
                String(product.category_id)
            );

            const nameArabic = product.name || "";
            const nameEnglish = product.name_en || "";

            const descriptionArabic = product.description || "";
            const descriptionEnglish = product.description_en || "";

            return {

                ...product,

                // اسم المنتج باللغتين
                name_ar: nameArabic,
                name_en: nameEnglish,

                // الوصف باللغتين
                description_ar: descriptionArabic,
                description_en: descriptionEnglish,

                // الاسم حسب اللغة المطلوبة
                name: localizedText(
                    nameArabic,
                    nameEnglish,
                    currentLanguage
                ),

                // الوصف حسب اللغة المطلوبة
                description: localizedText(
                    descriptionArabic,
                    descriptionEnglish,
                    currentLanguage
                ),

                // معلومات التصنيف
                category_name: localizedText(
                    category.name_ar,
                    category.name_en,
                    currentLanguage
                ),

                category_name_ar: category.name_ar,
                category_name_en: category.name_en,

                category_slug: category.slug

            };

        });

    return {
        categories,
        products,
        language: currentLanguage
    };

}

/* تنسيق وصف المنتجات */

export function ensureMenuDescriptionStyle() {

    if (
        document.getElementById(
            "ghannamDatabaseDescriptionStyle"
        )
    ) {
        return;
    }

    const style = document.createElement("style");

    style.id = "ghannamDatabaseDescriptionStyle";

    style.textContent = `
        .ghannam-db-description {
            margin: 6px 0 0;
            font-size: .9rem;
            line-height: 1.6;
            color: var(--grill-muted, #866b5c);
        }
    `;

    document.head.appendChild(style);

}

/* استخراج اسم ملف الصورة */

export function getStoredImageName(product) {

    const candidate =
        product?.extra?.local_image_path ||
        product?.image_path ||
        product?.image_url ||
        "";

    if (!candidate) {
        return "";
    }

    try {

        const clean = String(candidate)
            .split("?")[0]
            .replace(/\\/g, "/");

        return clean.split("/").pop() || "";

    } catch {

        return "";

    }

}
