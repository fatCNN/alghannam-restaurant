// =====================================================
 // واجهة قراءة المنيو والعروض العامة — مطعم الغنّام
 // Supabase فقط
 // دعم العربية والإنجليزية
 // جدولة ظهور الأقسام حسب توقيت بغداد
 // أيام الأسبوع من 1 إلى 7
 // =====================================================

import {
  supabaseClient as publicClient,
  isSupabaseConfigured
} from "./dashboard/supabase-client.js";

if (!isSupabaseConfigured || !publicClient) {
  throw new Error(
    "إعدادات Supabase غير مكتملة في dashboard/supabase-config.js"
  );
}

// =====================================================
// إعدادات النظام
// =====================================================

const BAGHDAD_TIME_ZONE = "Asia/Baghdad";

// ترقيم الأيام:
// الأحد 1
// الاثنين 2
// الثلاثاء 3
// الأربعاء 4
// الخميس 5
// الجمعة 6
// السبت 7

const WEEKDAYS = {
  Sun: 1,
  Mon: 2,
  Tue: 3,
  Wed: 4,
  Thu: 5,
  Fri: 6,
  Sat: 7
};

// =====================================================
// أدوات مساعدة
// =====================================================

function localizedText(english, arabic, language = "ar") {
  if (
    language === "en" &&
    typeof english === "string" &&
    english.trim()
  ) {
    return english.trim();
  }

  return typeof arabic === "string" ? arabic : "";
}

// =====================================================
// استخراج الوقت الحالي في بغداد
// =====================================================

export function getBaghdadTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BAGHDAD_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = {};

  parts.forEach(part => {
    values[part.type] = part.value;
  });

  const day = WEEKDAYS[values.weekday];

  const hour = Number(values.hour);
  const minute = Number(values.minute);

  return {
    day,
    hour,
    minute,
    totalMinutes: hour * 60 + minute
  };
}

// =====================================================
// تحويل وقت قاعدة البيانات إلى دقائق
// =====================================================

function parseTimeToMinutes(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = value.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

// =====================================================
// الحصول على اليوم السابق
// =====================================================

function getPreviousDay(day) {
  return day === 1 ? 7 : day - 1;
}

// =====================================================
// فحص ظهور القسم حسب الجدولة
// =====================================================

export function isCategoryVisible(
  category,
  date = new Date()
) {
  // الجدولة غير مفعّلة: القسم يظهر بصورة طبيعية
  if (!category?.schedule_enabled) {
    return true;
  }

  const start = parseTimeToMinutes(
    category.visible_from
  );

  const end = parseTimeToMinutes(
    category.visible_until
  );

  // إعدادات غير مكتملة: نخفي القسم
  if (start === null || end === null) {
    return false;
  }

  const days = Array.isArray(category.visible_days)
    ? category.visible_days.map(Number)
    : [];

  const now = getBaghdadTime(date);

  const today = now.day;
  const yesterday = getPreviousDay(today);
  const currentTime = now.totalMinutes;

  const worksToday = days.includes(today);
  const workedYesterday = days.includes(yesterday);

  // بداية ونهاية متساويتان:
  // القسم متاح طوال اليوم المحدد
  if (start === end) {
    return worksToday;
  }

  // ===================================================
  // الفترة لا تتجاوز منتصف الليل
  // مثال: 06:00 إلى 11:00
  // ===================================================

  if (start < end) {
    return (
      worksToday &&
      currentTime >= start &&
      currentTime < end
    );
  }

  // ===================================================
  // الفترة تمتد إلى اليوم التالي
  // مثال: 20:00 إلى 02:00
  // ===================================================

  // من وقت البداية إلى منتصف الليل
  if (currentTime >= start) {
    return worksToday;
  }

  // من منتصف الليل إلى وقت النهاية
  if (currentTime < end) {
    return workedYesterday;
  }

  return false;
}

// =====================================================
// تحميل أقسام ومنتجات الفرع
// =====================================================

export async function loadBranchMenu(branchId, language = "ar") {
  const currentLanguage = language === "en" ? "en" : "ar";

  const [categoryResult, productResult] = await Promise.all([
    publicClient
      .from("categories")
      .select(`
        id,
        branch_id,
        name,
        name_en,
        slug,
        is_active,
        sort_order,
        schedule_enabled,
        visible_from,
        visible_until,
        visible_days
      `)
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    publicClient
      .from("products")
      .select(`
        id,
        branch_id,
        category_id,
        name,
        name_en,
        description,
        description_en,
        price,
        image_url,
        image_path,
        is_available,
        sort_order,
        extra
      `)
      .eq("branch_id", branchId)
      .eq("is_available", true)
      .order("sort_order", { ascending: true })
  ]);

  if (categoryResult.error) {
    throw new Error(
      `قراءة التصنيفات: ${categoryResult.error.message}`
    );
  }

  if (productResult.error) {
    throw new Error(
      `قراءة المنتجات: ${productResult.error.message}`
    );
  }

  // تصفية الأقسام حسب توقيت بغداد
  const visibleCategories = (
    categoryResult.data || []
  ).filter(category =>
    isCategoryVisible(category)
  );

  const categories = visibleCategories.map(category => ({
    ...category,

    name_ar: category.name || "",
    name_en: category.name_en || "",

    name: localizedText(
      category.name_en,
      category.name,
      currentLanguage
    )
  }));

  const categoryById = new Map(
    categories.map(category => [
      String(category.id),
      category
    ])
  );

  // تحميل منتجات الأقسام الظاهرة فقط
  const products = (productResult.data || [])
    .filter(product =>
      categoryById.has(String(product.category_id))
    )
    .map(product => {
      const category = categoryById.get(
        String(product.category_id)
      );

      return {
        ...product,

        name_ar: product.name || "",
        name_en: product.name_en || "",

        description_ar: product.description || "",
        description_en: product.description_en || "",

        name: localizedText(
          product.name_en,
          product.name,
          currentLanguage
        ),

        description: localizedText(
          product.description_en,
          product.description,
          currentLanguage
        ),

        category_name: localizedText(
          category.name_en,
          category.name,
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

// =====================================================
// تحميل عروض الفرع من جدول offers
// لا يؤثر فشل تحميل العروض على المنيو
// =====================================================

export async function loadBranchOffers(branchId) {
  if (!isSupabaseConfigured || !publicClient) {
    console.warn("Supabase غير مهيأ لتحميل العروض");
    return [];
  }

  if (!branchId) {
    console.warn("لم يتم تحديد الفرع لتحميل العروض");
    return [];
  }

  try {
    const { data, error } = await publicClient
      .from("offers")
      .select(`
        id,
        branch_id,
        name,
        description,
        original_price,
        offer_price,
        image_url,
        image_path,
        starts_at,
        ends_at,
        is_active,
        sort_order
      `)
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      throw error;
    }

    const now = Date.now();

    return (data || []).filter(offer => {
      if (!offer.is_active) {
        return false;
      }

      if (offer.starts_at) {
        const startsAt = new Date(
          offer.starts_at
        ).getTime();

        if (!Number.isFinite(startsAt) || startsAt > now) {
          return false;
        }
      }

      if (offer.ends_at) {
        const endsAt = new Date(
          offer.ends_at
        ).getTime();

        if (!Number.isFinite(endsAt) || endsAt < now) {
          return false;
        }
      }

      return true;
    });

  } catch (error) {
    console.error("خطأ تحميل عروض الفرع:", error);
    return [];
  }
}

// =====================================================
// تنسيق وصف المنتجات
// =====================================================

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
      color: var(--text-muted, #6b625b);
    }
  `;

  document.head.appendChild(style);
}

// =====================================================
// استخراج اسم الصورة المحلية من بيانات المنتج
// =====================================================

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
