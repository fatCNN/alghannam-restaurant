// =====================================================
// مطعم الغنّام — محرك الخصومات التلقائية المشترك
// تحميل مرة واحدة طوال جلسة الصفحة
// =====================================================

import {
    supabaseClient,
    isSupabaseConfigured
} from "./dashboard/supabase-client.js";

// =====================================================
// التخزين المؤقت للخصومات
// =====================================================

let cachedDiscounts = [];
let discountsLoaded = false;
let discountsLoadPromise = null;


// =====================================================
// تحميل الخصومات من Supabase
// =====================================================

const DISCOUNTS_CACHE_DB = "alghannam_timed_cache";
const DISCOUNTS_CACHE_STORE = "entries";
const DISCOUNTS_CACHE_KEY = "discounts:global";
const DISCOUNTS_CACHE_TTL = 60 * 1000;

let discountsLoadedAt = 0;

function openDiscountsCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DISCOUNTS_CACHE_DB, 1);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DISCOUNTS_CACHE_STORE)) {
                db.createObjectStore(DISCOUNTS_CACHE_STORE, { keyPath: "key" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function readDiscountsCache() {
    try {
        const db = await openDiscountsCacheDB();

        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(DISCOUNTS_CACHE_STORE, "readonly");
            const request = transaction.objectStore(DISCOUNTS_CACHE_STORE)
                .get(DISCOUNTS_CACHE_KEY);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
            transaction.oncomplete = () => db.close();
            transaction.onerror = () => db.close();
        });
    } catch (error) {
        console.warn("???? ????? ??? ????????:", error);
        return null;
    }
}

async function writeDiscountsCache(payload) {
    try {
        const db = await openDiscountsCacheDB();

        await new Promise((resolve, reject) => {
            const transaction = db.transaction(DISCOUNTS_CACHE_STORE, "readwrite");

            transaction.objectStore(DISCOUNTS_CACHE_STORE).put({
                key: DISCOUNTS_CACHE_KEY,
                savedAt: Date.now(),
                payload
            });

            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });

        db.close();
    } catch (error) {
        console.warn("???? ??? ??? ????????:", error);
    }
}

export async function loadBranchDiscounts(branchId, force = false) {
    if (discountsLoadPromise) {
        return discountsLoadPromise;
    }

    if (
        !force &&
        discountsLoadedAt &&
        Date.now() - discountsLoadedAt < DISCOUNTS_CACHE_TTL
    ) {
        return cachedDiscounts;
    }

    discountsLoadPromise = (async () => {
        const cachedRecord = await readDiscountsCache();

        if (
            cachedRecord &&
            Array.isArray(cachedRecord.payload)
        ) {
            cachedDiscounts = cachedRecord.payload;

            if (
                !force &&
                Date.now() - cachedRecord.savedAt < DISCOUNTS_CACHE_TTL
            ) {
                discountsLoadedAt = cachedRecord.savedAt;
                return cachedDiscounts;
            }
        }

        if (!isSupabaseConfigured || !supabaseClient) {
            discountsLoadedAt = 0;
            return cachedDiscounts;
        }

        try {
            const { data, error } = await supabaseClient
                .from("discounts")
                .select("id, name, discount_percent, scope_type, branch_ids, category_ids, product_ids, starts_at, ends_at, is_active")
                .eq("is_active", true);

            if (error) {
                console.error("???? ????? ???????? ?????????:", error);
                discountsLoadedAt = 0;
                return cachedDiscounts;
            }

            cachedDiscounts = Array.isArray(data) ? data : [];
            discountsLoadedAt = Date.now();

            await writeDiscountsCache(cachedDiscounts);

            return cachedDiscounts;

        } catch (error) {
            console.error("??? ??? ????? ????? ????????:", error);
            discountsLoadedAt = 0;
            return cachedDiscounts;
        }
    })();

    try {
        return await discountsLoadPromise;
    } finally {
        discountsLoadPromise = null;
    }
}

export function getBestAutomaticDiscount(
    product,
    branchId,
    categoryId,
    discounts = cachedDiscounts,
    now = Date.now()
) {

    if (!product) return null;

    const productId = String(
        product.id ?? product.product_id ?? ""
    );

    const category = String(
        categoryId ?? product.category_id ?? ""
    );

    const branch = String(branchId ?? "");

    let best = null;

    for (const rule of Array.isArray(discounts) ? discounts : []) {

        if (!rule || rule.is_active !== true) continue;

        const starts = Date.parse(rule.starts_at);
        const ends = Date.parse(rule.ends_at);

        // التحقق من فترة صلاحية الخصم
        if (
            !Number.isFinite(starts) ||
            !Number.isFinite(ends) ||
            now < starts ||
            now >= ends
        ) {
            continue;
        }

        const branches = Array.isArray(rule.branch_ids)
            ? rule.branch_ids.map(String)
            : [];

        const categories = Array.isArray(rule.category_ids)
            ? rule.category_ids.map(String)
            : [];

        const products = Array.isArray(rule.product_ids)
            ? rule.product_ids.map(String)
            : [];

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

        const percent = Math.max(
            0,
            Math.min(100, Number(rule.discount_percent) || 0)
        );

        // اختيار أعلى نسبة خصم منطبقة
        if (
            matches &&
            percent > 0 &&
            (!best || percent > best.percent)
        ) {

            best = {
                id: rule.id,
                name: rule.name || "",
                percent
            };
        }
    }

    return best;
}


// =====================================================
// حساب السعر بعد الخصم
// =====================================================

export function priceAfterAutomaticDiscount(price, discount) {

    const original = Math.max(
        0,
        Number(price) || 0
    );

    if (!discount) return original;

    return Math.max(
        0,
        Math.round(
            original * (1 - discount.percent / 100)
        )
    );
}


// =====================================================
// حساب قيمة الخصم
// =====================================================

export function automaticDiscountValue(price, discount) {

    const original = Math.max(
        0,
        Number(price) || 0
    );

    return Math.max(
        0,
        original - priceAfterAutomaticDiscount(original, discount)
    );
}
