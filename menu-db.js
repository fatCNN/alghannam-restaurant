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


const MENU_CACHE_DB_NAME = "alghannam_menu_cache";
const MENU_CACHE_STORE = "branch_menus";
const MENU_CACHE_TTL = 24 * 60 * 60 * 1000;

function openMenuCacheDB() {
  return new Promise(resolve => {
    if (!("indexedDB" in globalThis)) {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(MENU_CACHE_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(MENU_CACHE_STORE)) {
          db.createObjectStore(MENU_CACHE_STORE, {
            keyPath: "branchId"
          });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readMenuCache(branchId) {
  const db = await openMenuCacheDB();

  if (!db) return null;

  return new Promise(resolve => {
    let finished = false;

    const finish = value => {
      if (finished) return;
      finished = true;
      db.close();
      resolve(value);
    };

    try {
      const transaction = db.transaction(
        MENU_CACHE_STORE,
        "readonly"
      );

      const request = transaction
        .objectStore(MENU_CACHE_STORE)
        .get(String(branchId));

      request.onsuccess = () => {
        const result = request.result;

        if (
          result &&
          Array.isArray(result.categories) &&
          Array.isArray(result.products)
        ) {
          finish(result);
        } else {
          finish(null);
        }
      };

      request.onerror = () => finish(null);
    } catch {
      finish(null);
    }
  });
}

async function writeMenuCache(branchId, categories, products) {
  const db = await openMenuCacheDB();

  if (!db) return false;

  return new Promise(resolve => {
    let finished = false;

    const finish = value => {
      if (finished) return;
      finished = true;
      db.close();
      resolve(value);
    };

    try {
      const transaction = db.transaction(
        MENU_CACHE_STORE,
        "readwrite"
      );

      transaction.objectStore(MENU_CACHE_STORE).put({
        branchId: String(branchId),
        savedAt: Date.now(),
        categories,
        products
      });

      transaction.oncomplete = () => finish(true);
      transaction.onerror = () => finish(false);
      transaction.onabort = () => finish(false);
    } catch {
      finish(false);
    }
  });
}


export async function loadBranchMenu(branchId, language = "ar") {
  const currentLanguage = language === "en" ? "en" : "ar";

  let cachedMenu = null;
  let menuData = null;

  try {
    cachedMenu = await readMenuCache(branchId);
  } catch {
    cachedMenu = null;
  }

  const cacheIsFresh =
    cachedMenu &&
    Date.now() - cachedMenu.savedAt < MENU_CACHE_TTL;

  if (cacheIsFresh) {
    menuData = cachedMenu;
  } else {
    try {
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
          `????? ?????????: ${categoryResult.error.message}`
        );
      }

      if (productResult.error) {
        throw new Error(
          `????? ????????: ${productResult.error.message}`
        );
      }

      menuData = {
        categories: categoryResult.data || [],
        products: productResult.data || []
      };

      try {
        await writeMenuCache(
          branchId,
          menuData.categories,
          menuData.products
        );
      } catch {
        // ??????? ??? ?????? ??? ?? ???? ???????
      }
    } catch (error) {
      if (cachedMenu) {
        menuData = cachedMenu;
        console.warn(
          "???? ????? ??????? ???? ??????? ?????? ??????? ??????.",
          error
        );
      } else {
        throw error;
      }
    }
  }

  // ????? ??????? ??? ????? ????? ??? ?? ?????
  const visibleCategories = (
    menuData.categories || []
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

  // ????? ?????? ??????? ??????? ???
  const products = (menuData.products || [])
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
// Browser cache for offers ? 1 hour
// =====================================================

const OFFERS_CACHE_DB = "alghannam_timed_cache";
const OFFERS_CACHE_STORE = "entries";
const OFFERS_CACHE_TTL = 60 * 60 * 1000;

function openOffersCacheDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(OFFERS_CACHE_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFERS_CACHE_STORE)) {
        db.createObjectStore(OFFERS_CACHE_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readOffersCache(key) {
  let db;

  try {
    db = await openOffersCacheDB();

    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(OFFERS_CACHE_STORE, "readonly");
      const request = transaction.objectStore(OFFERS_CACHE_STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Could not read offers cache:", error);
    return null;
  } finally {
    if (db) db.close();
  }
}

async function writeOffersCache(key, payload) {
  let db;

  try {
    db = await openOffersCacheDB();

    await new Promise((resolve, reject) => {
      const transaction = db.transaction(OFFERS_CACHE_STORE, "readwrite");

      transaction.objectStore(OFFERS_CACHE_STORE).put({
        key,
        savedAt: Date.now(),
        payload
      });

      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn("Could not save offers cache:", error);
  } finally {
    if (db) db.close();
  }
}

function filterValidBranchOffers(offers) {
  const now = Date.now();

  return (Array.isArray(offers) ? offers : []).filter(offer => {
    if (!offer || offer.is_active !== true) return false;

    if (offer.starts_at) {
      const startsAt = new Date(offer.starts_at).getTime();
      if (!Number.isFinite(startsAt) || startsAt > now) return false;
    }

    if (offer.ends_at) {
      const endsAt = new Date(offer.ends_at).getTime();
      if (!Number.isFinite(endsAt) || endsAt < now) return false;
    }

    return true;
  });
}

export async function loadBranchOffers(branchId) {
  if (!branchId) {
    console.warn("?? ??? ????? ????? ?????? ??????");
    return [];
  }

  const cacheKey = `offers:${branchId}`;
  const cachedRecord = await readOffersCache(cacheKey);
  const cachedOffers = Array.isArray(cachedRecord?.payload)
    ? cachedRecord.payload
    : [];

  if (
    cachedRecord &&
    Date.now() - cachedRecord.savedAt < OFFERS_CACHE_TTL
  ) {
    return filterValidBranchOffers(cachedOffers);
  }

  if (!isSupabaseConfigured || !publicClient) {
    console.warn("Supabase ??? ???? ?????? ??????");
    return filterValidBranchOffers(cachedOffers);
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

    if (error) throw error;

    const offers = Array.isArray(data) ? data : [];
    await writeOffersCache(cacheKey, offers);

    return filterValidBranchOffers(offers);
  } catch (error) {
    console.error("??? ????? ???? ?????:", error);
    return filterValidBranchOffers(cachedOffers);
  }
}

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
