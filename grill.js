
"use strict";

import {
    loadBranchMenu,
    loadBranchOffers,
    ensureMenuDescriptionStyle
} from "./menu-db.js";

/* =========================================================
   مطعم الغنّام — فرع المشاوي
   GRILL BRANCH
   Supabase Database Only
   Arabic / English
========================================================= */

/* =========================================================
   01 — إعدادات الفرع
========================================================= */

const GRILL_BRANCH_ID = "grill";
const WHATSAPP_NUMBER = "9647740000062";

const STORAGE_KEYS = {
    language: "ghannamGrillLanguage",
    cart: "ghannamGrillCart",
    coupon: "ghannamGrillCoupon",
    view: "ghannamGrillProductView"
};

let currentLanguage =
    localStorage.getItem(STORAGE_KEYS.language) || "ar";

let currentView =
    localStorage.getItem(STORAGE_KEYS.view) || "grid";

let grillSections = [];
let grillMenuLoaded = false;
let grillMenuLoading = false;

let grillOffers = [];
let grillOffersLoading = false;

let cart = loadSavedCart();
let activeCoupon = loadSavedCoupon();

/* =========================================================
   02 — قاموس الخيارات الإنجليزية
========================================================= */

const EN_OPTIONS = {
    "كيلو": "1 Kg",
    "نصف كيلو": "Half Kg",
    "ربع كيلو": "Quarter Kg",
    "نفر": "Full Serving",
    "نفرين": "Two Servings",
    "نصف نفر": "Half Serving",
    "سيخ": "Skewer",
    "وجبة": "Meal",
    "الوجبة": "Meal",
    "قطعة": "Quantity",
    "قنينة": "Bottle",
    "استكان": "Cup",
    "داخل المطعم": "Dine-In",
    "سفري": "Takeaway",
    "صغير جداً": "Very Small",
    "صغير": "Small",
    "وسط": "Medium",
    "كبير": "Large",
    "دبل": "Double",
    "عادي": "Regular",
    "حار": "Spicy",
    "بدون": "Without"
};

/* =========================================================
   03 — قاموس أسماء المنتجات الإنجليزية
========================================================= */

const EN_PRODUCTS = {
    "المشاوي": "Grills",
    "مشاوي مشكلة": "Mixed Grill",
    "كباب": "Kebab",
    "كباب لحم": "Beef Kebab",
    "كباب دجاج": "Chicken Kebab",
    "تكة لحم": "Beef Tikka",
    "تكة دجاج": "Chicken Tikka",
    "شيش طاووق": "Shish Tawook",
    "ريش": "Lamb Chops",
    "أوصال": "Lamb Skewers",
    "دجاج على الفحم": "Charcoal Chicken",
    "نصف دجاجة": "Half Chicken",
    "دجاجة كاملة": "Whole Chicken",
    "عرايس": "Arayes",
    "حمص": "Hummus",
    "متبل": "Mutabbal",
    "طرشي": "Pickles",
    "خبز": "Bread",
    "صمون": "Bread Roll",
    "بطاطا": "French Fries",
    "مقبلات": "Appetizers",
    "الإضافات": "Add-ons",
    "المشروبات": "Drinks",
    "المشروبات الغازية": "Soft Drinks",
    "ماء": "Water",
    "بيبسي": "Pepsi",
    "سفن أب": "7UP",
    "لبن": "Yogurt Drink",
    "سلطة": "Salad",
    "سلطة عربية": "Arabic Salad",
    "سلطة خضراء": "Green Salad",
    "وجبات": "Meals",
    "وجبة مشاوي": "Grill Meal",
    "وجبة كباب": "Kebab Meal",
    "وجبة تكة": "Tikka Meal",
    "وجبة دجاج": "Chicken Meal"
};

/* =========================================================
   04 — النصوص الإنجليزية
========================================================= */

const EN_TEXT = {
    searchPlaceholder: "Search for a meal or product...",
    loading: "Loading grill menu...",
    loadError: "Unable to load the menu. Please try again later.",
    emptyMenu: "There are currently no available products.",
    emptyCategory: "There are no products in this section.",
    noResults: "No matching products found.",
    addToCart: "Add to cart",
    added: "Added to cart",
    chooseOption: "Choose an option",
    meal: "Meal",
    cart: "Cart",
    emptyCart: "Your cart is empty",
    continueShopping: "Continue shopping",
    delete: "Delete",
    increase: "Increase quantity",
    decrease: "Decrease quantity",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    couponPlaceholder: "Enter discount code",
    applyCoupon: "Apply",
    couponApplied: "Discount code applied successfully",
    couponInvalid: "Invalid or unavailable discount code",
    couponRemoved: "Discount code removed",
    customerName: "Customer name",
    customerPhone: "Phone number",
    customerAddress: "Delivery address",
    customerNotes: "Order notes",
    sendOrder: "Send order via WhatsApp",
    fillRequired: "Please enter your name, phone number and address.",
    orderTitle: "New order — Al Ghannam Restaurant",
    suggestedAddons: "You may also like",
    currency: "IQD",
    free: "Free",
    quantity: "Quantity",
    selectedOption: "Selected option",
    orderItems: "Order details",
    orderCustomer: "Customer details",
    unavailable: "This product is currently unavailable.",
    error: "An error occurred. Please try again.",
    viewGrid: "Grid view",
    viewList: "List view",
    offers: "Special Offers"
};

/* =========================================================
   05 — النصوص العربية
========================================================= */

const AR_TEXT = {
    searchPlaceholder: "ابحث عن وجبة أو منتج...",
    loading: "جاري تحميل منيو المشاوي...",
    loadError: "تعذر تحميل المنيو حالياً، حاول مرة أخرى.",
    emptyMenu: "لا توجد منتجات متاحة حالياً.",
    emptyCategory: "لا توجد منتجات في هذا القسم.",
    noResults: "لا توجد منتجات مطابقة للبحث.",
    addToCart: "أضف إلى السلة",
    added: "تمت الإضافة إلى السلة",
    chooseOption: "اختر الحجم أو الخيار",
    meal: "الوجبة",
    cart: "السلة",
    emptyCart: "السلة فارغة حالياً",
    continueShopping: "متابعة التسوق",
    delete: "حذف",
    increase: "زيادة الكمية",
    decrease: "تقليل الكمية",
    subtotal: "المجموع",
    discount: "الخصم",
    total: "الإجمالي",
    couponPlaceholder: "أدخل رمز الخصم",
    applyCoupon: "تطبيق",
    couponApplied: "تم تطبيق رمز الخصم بنجاح",
    couponInvalid: "رمز الخصم غير صحيح أو غير متاح",
    couponRemoved: "تم إلغاء رمز الخصم",
    customerName: "اسم الزبون",
    customerPhone: "رقم الهاتف",
    customerAddress: "عنوان التوصيل",
    customerNotes: "ملاحظات الطلب",
    sendOrder: "إرسال الطلب عبر واتساب",
    fillRequired: "يرجى إدخال الاسم ورقم الهاتف والعنوان.",
    orderTitle: "طلب جديد — مطعم الغنّام",
    suggestedAddons: "قد يعجبك أيضاً",
    currency: "د.ع",
    free: "مجاناً",
    quantity: "الكمية",
    selectedOption: "الخيار المحدد",
    orderItems: "تفاصيل الطلب",
    orderCustomer: "بيانات الزبون",
    unavailable: "هذا المنتج غير متوفر حالياً.",
    error: "حدث خطأ، حاول مرة أخرى.",
    viewGrid: "عرض شبكي",
    viewList: "عرض قائمة",
    offers: "عروضنا المميزة"
};

/* =========================================================
   06 — قواعد الكوبونات
========================================================= */

const COUPON_RULES = {
    GHANNAM10: { type: "percent", value: 10 },
    WELCOME5: { type: "percent", value: 5 },
    GRILL15: { type: "percent", value: 15 },
    MEAT10: { type: "percent", value: 10 },
    CHICKEN10: { type: "percent", value: 10 },
    SHAWARMA5: { type: "percent", value: 5 },
    BREAKFAST10: { type: "percent", value: 10 },
    FAMILY15: { type: "percent", value: 15 },
    VIP20: { type: "percent", value: 20 },
    SAVE2000: { type: "fixed", value: 2000 }
};

/* =========================================================
   07 — أدوات عامة
========================================================= */

const $ = selector => document.querySelector(selector);

const $$ = selector =>
    Array.from(document.querySelectorAll(selector));

function text(key) {
    const dictionary =
        currentLanguage === "en" ? EN_TEXT : AR_TEXT;

    return dictionary[key] || key;
}

function isEnglish() {
    return currentLanguage === "en";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

/*
   تنسيق الأرقام:
   نستخدم en-US دائماً حتى تظهر الأرقام بهذا الشكل:
   1234567890
   في الواجهة العربية والإنجليزية.
*/

function formatPrice(value) {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0
    }).format(number);
}

function money(value) {
    return `${formatPrice(value)} ${text("currency")}`;
}

function getProductEnglishName(item) {
    if (item?.[4]) return item[4];

    return EN_PRODUCTS[item?.[0]] || item?.[0] || "";
}

function getProductEnglishDescription(item) {
    return item?.[5] || "";
}

function getDisplayName(item) {
    return isEnglish()
        ? getProductEnglishName(item)
        : item?.[0] || "";
}

function getDisplayDescription(item) {
    return isEnglish()
        ? getProductEnglishDescription(item)
        : item?.[3] || "";
}

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي");
}

/* =========================================================
   08 — الصور
========================================================= */

function resolveGrillImageUrl(path) {
    if (!path) return "";

    const value = String(path).trim();

    if (
        value.startsWith("https://") ||
        value.startsWith("http://") ||
        value.startsWith("data:") ||
        value.startsWith("blob:")
    ) {
        return value;
    }

    try {
        return new URL(value, window.location.href).href;
    } catch {
        return "";
    }
}

function getProductImage(product) {
    const extra = product?.extra || {};

    const image =
        product?.image_url ||
        product?.image_path ||
        extra?.local_image_path ||
        "";

    return resolveGrillImageUrl(image);
}

/* =========================================================
   09 — تخزين السلة والخصم
========================================================= */

function loadSavedCart() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.cart) || "[]"
        );

        if (!Array.isArray(saved)) return [];

        return saved.map(item => ({
            ...item,
            image: resolveGrillImageUrl(item?.image || ""),
            quantity: Math.max(1, Number(item?.quantity) || 1),
            price: Number(item?.price) || 0
        }));
    } catch {
        return [];
    }
}

function loadSavedCoupon() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.coupon) || "null"
        );

        return saved && typeof saved === "object"
            ? saved
            : null;
    } catch {
        return null;
    }
}

function saveCart() {
    localStorage.setItem(
        STORAGE_KEYS.cart,
        JSON.stringify(cart)
    );

    updateFixedCart();
}

function saveCoupon() {
    if (activeCoupon) {
        localStorage.setItem(
            STORAGE_KEYS.coupon,
            JSON.stringify(activeCoupon)
        );
    } else {
        localStorage.removeItem(STORAGE_KEYS.coupon);
    }
}

function getCartCount() {
    return cart.reduce(
        (total, item) => total + (Number(item.quantity) || 0),
        0
    );
}

function getCartSubtotal() {
    return cart.reduce((total, item) => {
        return total +
            (Number(item.price) || 0) *
            (Number(item.quantity) || 0);
    }, 0);
}

function getCouponDiscount() {
    if (!activeCoupon) return 0;

    const subtotal = getCartSubtotal();
    const rule = COUPON_RULES[activeCoupon.code];

    if (!rule) return 0;

    if (rule.type === "percent") {
        return Math.min(
            subtotal,
            Math.round(subtotal * rule.value / 100)
        );
    }

    return Math.min(subtotal, rule.value);
}

function getCartTotal() {
    return Math.max(
        0,
        getCartSubtotal() - getCouponDiscount()
    );
}

function updateFixedCart() {
    const count = $("#fixedCartCount");
    const subtitle = $("#fixedCartSubtitle");
    const total = $("#fixedCartTotal");
    const bar = $("#fixedCartBar");

    if (count) {
        count.textContent = formatPrice(getCartCount());
    }

    if (subtitle) {
        subtitle.textContent = isEnglish()
            ? `${formatPrice(getCartCount())} items`
            : `${formatPrice(getCartCount())} منتج`;
    }

    if (total) {
        total.textContent = money(getCartTotal());
    }

    if (bar) {
        bar.classList.toggle("has-items", cart.length > 0);
    }
}

/* =========================================================
   10 — صوت جرس إضافة المنتج إلى السلة
========================================================= */

let grillBellAudioContext = null;

function playAddToCartSound() {
    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (!grillBellAudioContext) {
            grillBellAudioContext = new AudioContextClass();
        }

        const audioContext = grillBellAudioContext;

        const playBell = () => {
            const now = audioContext.currentTime;

            const bellTones = [
                { frequency: 1046.5, volume: 0.16 },
                { frequency: 1568.0, volume: 0.10 },
                { frequency: 2093.0, volume: 0.055 }
            ];

            bellTones.forEach(tone => {
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();

                oscillator.type = "sine";
                oscillator.frequency.setValueAtTime(
                    tone.frequency,
                    now
                );

                gain.gain.setValueAtTime(0.0001, now);

                gain.gain.exponentialRampToValueAtTime(
                    tone.volume,
                    now + 0.012
                );

                gain.gain.exponentialRampToValueAtTime(
                    0.0001,
                    now + 0.85
                );

                oscillator.connect(gain);
                gain.connect(audioContext.destination);

                oscillator.start(now);
                oscillator.stop(now + 0.9);

                oscillator.onended = () => {
                    oscillator.disconnect();
                    gain.disconnect();
                };
            });
        };

        if (audioContext.state === "suspended") {
            audioContext.resume()
                .then(playBell)
                .catch(error => {
                    console.warn("Bell sound unavailable:", error);
                });
        } else {
            playBell();
        }

    } catch (error) {
        console.warn("Bell sound unavailable:", error);
    }
}

/* =========================================================
   11 — خيارات المنتجات من Supabase
========================================================= */

function normalizeGrillProductOptions(product) {
    const extra =
        product?.extra && typeof product.extra === "object"
            ? product.extra
            : {};

    const result = {};
    const englishLabels = {};

    const sizeOptions = Array.isArray(extra.size_options)
        ? extra.size_options
        : [];

    sizeOptions.forEach(size => {
        const label = String(size?.label || "").trim();
        const labelEn = String(size?.label_en || "").trim();
        const price = Number(size?.price);

        if (
            !label ||
            !Number.isFinite(price) ||
            price < 0
        ) {
            return;
        }

        result[label] = price;

        if (labelEn) {
            englishLabels[label] = labelEn;
        }
    });

    if (Object.keys(result).length) {
        Object.defineProperty(result, "__englishLabels", {
            value: englishLabels,
            enumerable: false
        });

        return result;
    }

    const oldOptions = extra.options;

    if (
        oldOptions &&
        typeof oldOptions === "object" &&
        !Array.isArray(oldOptions)
    ) {
        Object.entries(oldOptions).forEach(([label, rawPrice]) => {
            const optionName = String(label || "").trim();
            const price = Number(rawPrice);

            if (
                !optionName ||
                !Number.isFinite(price) ||
                price < 0
            ) {
                return;
            }

            result[optionName] = price;
        });
    }

    if (Object.keys(result).length) {
        Object.defineProperty(result, "__englishLabels", {
            value: englishLabels,
            enumerable: false
        });

        return result;
    }

    const productPrice = Number(product?.price);

    result["الوجبة"] =
        Number.isFinite(productPrice) && productPrice >= 0
            ? productPrice
            : 0;

    Object.defineProperty(result, "__englishLabels", {
        value: {
            "الوجبة": "Meal"
        },
        enumerable: false
    });

    return result;
}

function getOptionEnglishName(optionName, options = {}) {
    const databaseLabel =
        options?.__englishLabels?.[optionName];

    if (databaseLabel) {
        return databaseLabel;
    }

    return EN_OPTIONS[optionName] || optionName;
}

function getOptionDisplayName(optionName, options = {}) {
    return isEnglish()
        ? getOptionEnglishName(optionName, options)
        : optionName;
}

function getCartOptionEnglish(item) {
    const section = grillSections.find(section =>
        String(section.id) === String(item.sectionId)
    );

    const product = section?.items?.find(product => {
        return (
            (
                item.productId &&
                String(product[6]) === String(item.productId)
            ) ||
            product[0] === item.name
        );
    });

    if (product) {
        return getOptionEnglishName(
            item.option,
            product[1]
        );
    }

    return item.option_en ||
        EN_OPTIONS[item.option] ||
        item.option;
}

/* =========================================================
   12 — بناء المنيو من Supabase
========================================================= */

function buildGrillSections(dbCategories, dbProducts) {
    if (!Array.isArray(dbCategories)) return [];
    if (!Array.isArray(dbProducts)) return [];

    return dbCategories.map(category => {
        const categoryArabic =
            category.name_ar ||
            category.name ||
            "";

        const categoryEnglish =
            category.name_en ||
            EN_PRODUCTS[categoryArabic] ||
            categoryArabic;

        const categoryProducts = dbProducts.filter(product => {
            return String(product.category_id) ===
                String(category.id);
        });

        const items = categoryProducts.map(product => {
            const productArabic =
                product.name_ar ||
                product.name ||
                "";

            const productEnglish =
                product.name_en ||
                EN_PRODUCTS[productArabic] ||
                "";

            const descriptionArabic =
                product.description_ar ||
                product.description ||
                "";

            const descriptionEnglish =
                product.description_en ||
                "";

            const options = normalizeGrillProductOptions(product);
            const image = getProductImage(product);

            return [
                productArabic,
                options,
                image,
                descriptionArabic,
                productEnglish,
                descriptionEnglish,
                product.id
            ];
        });

        return {
            id: category.slug || String(category.id),
            categoryId: category.id,
            slug: category.slug || "",
            title: categoryArabic,
            title_en: categoryEnglish,
            items
        };
    }).filter(section => section.items.length > 0);
}

async function syncGrillMenuFromDatabase() {
    if (grillMenuLoading) return;

    grillMenuLoading = true;

    const menuElement = $("#grillMenu");

    if (menuElement) {
        menuElement.innerHTML = `
            <div class="grill-loading">
                <span class="grill-loading-spinner"></span>
                <p>${escapeHTML(text("loading"))}</p>
            </div>
        `;
    }

    try {
        const result = await loadBranchMenu(
            GRILL_BRANCH_ID,
            "ar"
        );

        let dbCategories = [];
        let dbProducts = [];

        if (Array.isArray(result)) {
            dbCategories = result;

            dbProducts = result.flatMap(category =>
                Array.isArray(category.items)
                    ? category.items
                    : []
            );
        } else if (result && typeof result === "object") {
            dbCategories =
                result.categories ||
                result.dbCategories ||
                [];

            dbProducts =
                result.products ||
                result.dbProducts ||
                [];
        }

        if (!Array.isArray(dbCategories)) {
            dbCategories = [];
        }

        if (!Array.isArray(dbProducts)) {
            dbProducts = [];
        }

        grillSections = buildGrillSections(
            dbCategories,
            dbProducts
        );

        grillMenuLoaded = true;

        if (typeof ensureMenuDescriptionStyle === "function") {
            ensureMenuDescriptionStyle();
        }

        renderCategories();
        renderMenu();

        updateCartImagesFromMenu();

        renderCart();
        updateFixedCart();

    } catch (error) {
        console.error(
            "Failed to load grill menu from Supabase:",
            error
        );

        grillSections = [];
        grillMenuLoaded = false;

        if (menuElement) {
            menuElement.innerHTML = `
                <div class="grill-message grill-error">
                    ${escapeHTML(text("loadError"))}
                </div>
            `;
        }

        const categoryNav = $("#categoryNav");

        if (categoryNav) {
            categoryNav.innerHTML = "";
        }

    } finally {
        grillMenuLoading = false;
    }
}

/* =========================================================
   13 — تحديث صور السلة من المنيو
========================================================= */

function findCartProduct(item) {
    for (const section of grillSections) {
        const product = section.items.find(product => {
            if (
                item.productId &&
                product[6] &&
                String(product[6]) === String(item.productId)
            ) {
                return true;
            }

            return (
                product[0] === item.name &&
                String(section.id) === String(item.sectionId)
            );
        });

        if (product) return product;
    }

    return null;
}

function updateCartImagesFromMenu() {
    let changed = false;

    cart.forEach(item => {
        const product = findCartProduct(item);

        if (!product) return;

        if (!item.image && product[2]) {
            item.image = product[2];
            changed = true;
        }

        if (!item.name_en && product[4]) {
            item.name_en = product[4];
            changed = true;
        }
    });

    if (changed) {
        saveCart();
    }
}

/* =========================================================
   14 — عروض فرع المشاوي من Supabase
========================================================= */

async function syncGrillOffersFromDatabase() {
    if (grillOffersLoading) return;

    grillOffersLoading = true;

    const section = $("#grillOffersSection");
    const container = $("#grillOffersList");

    try {
        const result = await loadBranchOffers(GRILL_BRANCH_ID);

        if (Array.isArray(result)) {
            grillOffers = result;
        } else if (result && typeof result === "object") {
            grillOffers =
                result.offers ||
                result.data ||
                [];
        } else {
            grillOffers = [];
        }

        renderGrillOffers();

    } catch (error) {
        console.error(
            "Failed to load grill offers from Supabase:",
            error
        );

        grillOffers = [];

        if (section) {
            section.hidden = true;
        }

        if (container) {
            container.innerHTML = "";
        }

    } finally {
        grillOffersLoading = false;
    }
}

function renderGrillOffers() {
    const section = $("#grillOffersSection");
    const container = $("#grillOffersList");

    if (!section || !container) return;

    if (!grillOffers.length) {
        section.hidden = true;
        container.innerHTML = "";
        return;
    }

    section.hidden = false;

    container.innerHTML = grillOffers.map(offer => {
        const name = isEnglish()
            ? offer.name_en || offer.name || ""
            : offer.name || "";

        const description = isEnglish()
            ? offer.description_en || offer.description || ""
            : offer.description || "";

        const offerPrice = Number(offer.offer_price) || 0;
        const originalPrice = Number(offer.original_price) || 0;

        const image = resolveGrillImageUrl(
            offer.image_url || offer.image_path || ""
        );

        const imageHTML = image
            ? `
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(name)}"
                    loading="lazy"
                    onerror="this.style.display='none';this.parentElement.classList.add('offer-image-unavailable')"
                >
            `
            : `
                <div class="grill-offer-no-image">
                    🍽️
                </div>
            `;

        return `
            <article class="grill-offer-card">
                <div class="grill-offer-image">
                    ${imageHTML}
                </div>

                <div class="grill-offer-info">
                    <h3>${escapeHTML(name)}</h3>

                    ${
                        description
                            ? `<p>${escapeHTML(description)}</p>`
                            : ""
                    }

                    <div class="grill-offer-prices">
                        <strong class="grill-offer-new-price">
                            ${escapeHTML(money(offerPrice))}
                        </strong>

                        ${
                            originalPrice > offerPrice
                                ? `
                                    <del class="grill-offer-old-price">
                                        ${escapeHTML(money(originalPrice))}
                                    </del>
                                `
                                : ""
                        }
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

/* =========================================================
   15 — تحديد قسم الإضافات
========================================================= */

function getExtrasSection() {
    return grillSections.find(section => {
        const slug = normalizeText(section.slug || section.id);
        const nameAr = normalizeText(section.title);
        const nameEn = normalizeText(section.title_en);

        return (
            slug === "extras" ||
            slug === "add-ons" ||
            slug === "additions" ||
            slug.includes("extra") ||
            slug.includes("add-on") ||
            nameAr.includes("اضافات") ||
            nameEn.includes("extra") ||
            nameEn.includes("add-on")
        );
    }) || null;
}

function isExtraAlreadyInCart(productName, sectionId) {
    const extrasSection = getExtrasSection();

    if (!extrasSection) return false;

    return cart.some(item => {
        return (
            item.name === productName &&
            String(item.sectionId) === String(extrasSection.id) &&
            String(item.sectionId) === String(sectionId)
        );
    });
}

/* =========================================================
   16 — عرض الأقسام
========================================================= */

function renderCategories() {
    const nav = $("#categoryNav");

    if (!nav) return;

    if (!grillSections.length) {
        nav.innerHTML = "";
        return;
    }

    nav.innerHTML = grillSections.map((section, index) => {
        const title = isEnglish()
            ? section.title_en || section.title
            : section.title;

        return `
            <button
                type="button"
                class="category-pill category-link ${index === 0 ? "active" : ""}"
                data-category="${escapeHTML(section.id)}"
            >
                ${escapeHTML(title)}
            </button>
        `;
    }).join("");

    $$("#categoryNav [data-category]").forEach(button => {
        button.addEventListener("click", () => {
            const sectionId = button.dataset.category;

            $$("#categoryNav .category-pill").forEach(item => {
                item.classList.toggle(
                    "active",
                    item === button
                );
            });

            const target = document.querySelector(
                `[data-section-id="${CSS.escape(sectionId)}"]`
            );

            if (target) {
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        });
    });
}

/* =========================================================
   17 — ترجمة أسماء المنتجات
========================================================= */

function displayProductName(arName, section) {
    if (!isEnglish()) return arName;

    const product = section?.items?.find(item => {
        return item[0] === arName;
    });

    if (product?.[4]) return product[4];

    return EN_PRODUCTS[arName] || arName;
}

/* =========================================================
   18 — عرض المنتجات
========================================================= */

function renderMenu() {
    const menu = $("#grillMenu");

    if (!menu) return;

    if (!grillMenuLoaded) {
        menu.innerHTML = `
            <div class="grill-message">
                ${escapeHTML(text("loading"))}
            </div>
        `;
        return;
    }

    if (!grillSections.length) {
        menu.innerHTML = `
            <div class="grill-message">
                ${escapeHTML(text("emptyMenu"))}
            </div>
        `;
        return;
    }

    const searchInput = $("#grillSearch");
    const searchTerm = normalizeText(searchInput?.value || "");

    const sectionsHTML = grillSections.map(section => {
        const sectionTitle = isEnglish()
            ? section.title_en || section.title
            : section.title;

        const filteredItems = section.items.filter(item => {
            if (!searchTerm) return true;

            const searchable = [
                item[0],
                item[3],
                item[4],
                item[5],
                section.title,
                section.title_en
            ].map(normalizeText).join(" ");

            return searchable.includes(searchTerm);
        });

        if (!filteredItems.length) return "";

        const productsHTML = filteredItems.map(item => {
            const name = getDisplayName(item);
            const description = getDisplayDescription(item);
            const image = item[2] || "";
            const options = item[1] || {};

            const optionEntries = Object.entries(options);
            const firstOption = optionEntries[0] || ["الوجبة", 0];

            const optionsHTML = optionEntries.map(([label, price], index) => {
                return `
                    <option
                        value="${escapeHTML(label)}"
                        data-price="${Number(price)}"
                        data-option-en="${escapeHTML(getOptionEnglishName(label, options))}"
                        ${index === 0 ? "selected" : ""}
                    >
                        ${escapeHTML(getOptionDisplayName(label, options))}
                        — ${escapeHTML(money(price))}
                    </option>
                `;
            }).join("");

            const imageHTML = image
                ? `
                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(name)}"
                        loading="lazy"
                        onerror="this.style.display='none';this.parentElement.classList.add('image-unavailable')"
                    >
                `
                : `<div class="grill-no-image">🍽️</div>`;

            return `
                <article
                    class="grill-product-card"
                    data-product-id="${escapeHTML(item[6] || "")}"
                >
                    <div class="grill-product-image">
                        ${imageHTML}
                    </div>

                    <div class="grill-product-info">
                        <h3 class="grill-product-name">
                            ${escapeHTML(name)}
                        </h3>

                        ${
                            description
                                ? `<p class="grill-product-description">${escapeHTML(description)}</p>`
                                : ""
                        }

                        <div class="grill-product-controls">
                            <label class="grill-option-label">
                                ${escapeHTML(text("chooseOption"))}
                            </label>

                            <select class="grill-product-option">
                                ${optionsHTML}
                            </select>

                            <div class="grill-product-bottom">
                                <strong class="grill-product-price">
                                    ${escapeHTML(money(firstOption[1]))}
                                </strong>

                                <button
                                    type="button"
                                    class="grill-add-button"
                                    data-product-name="${escapeHTML(item[0])}"
                                    data-section-id="${escapeHTML(section.id)}"
                                >
                                    <span>+</span>
                                    ${escapeHTML(text("addToCart"))}
                                </button>
                            </div>
                        </div>
                    </div>
                </article>
            `;
        }).join("");

        return `
            <section
                class="grill-menu-section"
                data-section-id="${escapeHTML(section.id)}"
            >
                <div class="grill-section-heading">
                    <h2>${escapeHTML(sectionTitle)}</h2>
                </div>

                <div class="grill-products ${currentView === "list" ? "list-view" : "grid-view"}">
                    ${productsHTML}
                </div>
            </section>
        `;
    }).join("");

    if (!sectionsHTML) {
        menu.innerHTML = `
            <div class="grill-message">
                ${escapeHTML(text("noResults"))}
            </div>
        `;
        return;
    }

    menu.innerHTML = sectionsHTML;

    menu.classList.toggle(
        "list-view",
        currentView === "list"
    );

    menu.classList.toggle(
        "grid-view",
        currentView !== "list"
    );

    bindProductControls();
}

/* =========================================================
   19 — أحداث المنتجات
========================================================= */

function bindProductControls() {
    $$("#grillMenu .grill-product-card").forEach(card => {
        const select = card.querySelector(".grill-product-option");
        const priceElement = card.querySelector(".grill-product-price");
        const addButton = card.querySelector(".grill-add-button");

        if (select && priceElement) {
            select.addEventListener("change", () => {
                const selectedOption =
                    select.options[select.selectedIndex];

                const price = Number(
                    selectedOption?.dataset.price
                ) || 0;

                priceElement.textContent = money(price);
            });
        }

        if (addButton) {
            addButton.addEventListener("click", () => {
                const productName = addButton.dataset.productName;
                const sectionId = addButton.dataset.sectionId;

                const section = grillSections.find(item =>
                    String(item.id) === String(sectionId)
                );

                const product = section?.items?.find(item =>
                    item[0] === productName
                );

                if (!product) return;

                const selectedOption =
                    select?.options[select.selectedIndex];

                const optionName =
                    selectedOption?.value || "الوجبة";

                const price =
                    Number(selectedOption?.dataset.price) || 0;

                const optionEnglishName =
                    selectedOption?.dataset.optionEn || "";

                addItemToCart(
                    product,
                    section,
                    optionName,
                    price,
                    optionEnglishName
                );
            });
        }
    });
}

/* =========================================================
   20 — إضافة منتج إلى السلة
========================================================= */

function addItemToCart(
    product,
    section,
    optionName,
    price,
    optionEnglishName = ""
) {
    if (!product || !section) return;

    const name = product[0];
    const productId = product[6] || null;
    const image = product[2] || "";

    const finalOptionEnglish =
        optionEnglishName ||
        getOptionEnglishName(optionName, product[1]);

    const existingItem = cart.find(item => {
        return (
            item.name === name &&
            item.option === optionName &&
            String(item.sectionId) === String(section.id)
        );
    });

    if (existingItem) {
        existingItem.quantity =
            (Number(existingItem.quantity) || 0) + 1;

        existingItem.option_en = finalOptionEnglish;

        if (!existingItem.image && image) {
            existingItem.image = image;
        }

        if (!existingItem.productId && productId) {
            existingItem.productId = productId;
        }
    } else {
        cart.push({
            productId,
            name,
            name_en: product[4] || "",
            image,
            option: optionName,
            option_en: finalOptionEnglish,
            price: Number(price) || 0,
            quantity: 1,
            sectionId: section.id,
            sectionName: section.title,
            sectionName_en: section.title_en || ""
        });
    }

    saveCart();
    playAddToCartSound();
    renderCart();

    const addButton = $(
        `.grill-add-button[data-product-name="${CSS.escape(name)}"][data-section-id="${CSS.escape(String(section.id))}"]`
    );

    if (addButton) {
        const originalHTML = addButton.innerHTML;

        addButton.classList.add("added");
        addButton.textContent = text("added");

        window.setTimeout(() => {
            addButton.classList.remove("added");
            addButton.innerHTML = originalHTML;
        }, 900);
    }
}

/* =========================================================
   21 — تعديل الكميات والحذف
========================================================= */

function changeCartQuantity(index, change) {
    const item = cart[index];

    if (!item) return;

    item.quantity =
        (Number(item.quantity) || 0) + change;

    if (item.quantity <= 0) {
        cart.splice(index, 1);
    }

    if (!cart.length) {
        activeCoupon = null;
        saveCoupon();
    }

    saveCart();
    renderCart();
}

function removeCartItem(index) {
    if (!cart[index]) return;

    cart.splice(index, 1);

    if (!cart.length) {
        activeCoupon = null;
        saveCoupon();
    }

    saveCart();
    renderCart();
}

/* =========================================================
   22 — الإضافات المقترحة
========================================================= */

function getSuggestedAddons() {
    const extrasSection = getExtrasSection();

    if (!extrasSection) return [];

    return extrasSection.items.filter(product => {
        return !cart.some(cartItem => {
            return (
                cartItem.name === product[0] &&
                String(cartItem.sectionId) ===
                    String(extrasSection.id)
            );
        });
    }).slice(0, 8);
}

function getExtrasSectionHTML() {
    const extrasSection = getExtrasSection();

    if (!extrasSection) return "";

    const suggested = getSuggestedAddons();

    if (!suggested.length) return "";

    const cards = suggested.map(product => {
        const options = Object.entries(product[1] || {});
        const firstOption = options[0] || ["الوجبة", 0];

        const name = getDisplayName(product);
        const image = product[2] || "";

        return `
            <div class="cart-addon-card">
                <div class="cart-addon-image-box">
                    ${
                        image
                            ? `
                                <img
                                    class="cart-addon-image"
                                    src="${escapeHTML(image)}"
                                    alt="${escapeHTML(name)}"
                                    loading="lazy"
                                    onerror="this.style.display='none';this.parentElement.classList.add('cart-addon-image-placeholder')"
                                >
                            `
                            : `
                                <div class="cart-addon-no-image">
                                    🍽️
                                </div>
                            `
                    }
                </div>

                <div class="cart-addon-info">
                    <strong>${escapeHTML(name)}</strong>
                    <span>${escapeHTML(money(firstOption[1]))}</span>

                    <button
                        type="button"
                        class="cart-addon-add"
                        data-addon-name="${escapeHTML(product[0])}"
                        data-addon-section="${escapeHTML(extrasSection.id)}"
                    >
                        + ${escapeHTML(text("addToCart"))}
                    </button>
                </div>
            </div>
        `;
    }).join("");

    return `
        <div class="cart-addons-scroll">
            ${cards}
        </div>
    `;
}

function bindAddonButtons() {
    $$("#cartAddonsList .cart-addon-add").forEach(button => {
        button.addEventListener("click", () => {
            const name = button.dataset.addonName;
            const sectionId = button.dataset.addonSection;

            const section = grillSections.find(item =>
                String(item.id) === String(sectionId)
            );

            const product = section?.items?.find(item =>
                item[0] === name
            );

            if (!product || !section) return;

            const firstOption =
                Object.entries(product[1] || {})[0] ||
                ["الوجبة", 0];

            const optionEnglishName =
                getOptionEnglishName(firstOption[0], product[1]);

            addItemToCart(
                product,
                section,
                firstOption[0],
                firstOption[1],
                optionEnglishName
            );

            renderCart();
        });
    });
}

/* =========================================================
   23 — صورة المنتج داخل السلة
========================================================= */

function getCartItemImageHTML(item, displayName) {
    const product = findCartProduct(item);

    const image =
        item.image ||
        product?.[2] ||
        "";

    if (image && !item.image) {
        item.image = image;
    }

    if (image) {
        return `
            <img
                class="popup-cart-item-image"
                src="${escapeHTML(image)}"
                alt="${escapeHTML(displayName)}"
                loading="lazy"
                onerror="this.style.display='none';this.parentElement.classList.add('cart-item-image-unavailable')"
            >
        `;
    }

    return `
        <div class="popup-cart-item-image cart-item-image-placeholder">
            🍽️
        </div>
    `;
}

/* =========================================================
   24 — عرض محتويات السلة
========================================================= */

function renderPopupCart() {
    const itemsContainer = $("#popupCartItems");
    const addonsContainer = $("#cartAddonsList");

    if (!itemsContainer) return;

    if (!cart.length) {
        itemsContainer.innerHTML = `
            <div class="cart-empty-message">
                <div class="cart-empty-icon">🛒</div>
                <p>${escapeHTML(text("emptyCart"))}</p>
            </div>
        `;

        if (addonsContainer) {
            addonsContainer.innerHTML = "";
        }

    } else {
        itemsContainer.innerHTML = cart.map((item, index) => {
            const displayName = isEnglish()
                ? item.name_en || EN_PRODUCTS[item.name] || item.name
                : item.name;

            const displayOption = isEnglish()
                ? getCartOptionEnglish(item)
                : item.option;

            const imageHTML =
                getCartItemImageHTML(item, displayName);

            return `
                <div class="popup-cart-item">
                    ${imageHTML}

                    <div class="popup-cart-item-details">
                        <h4>${escapeHTML(displayName)}</h4>

                        <p class="popup-cart-item-option">
                            ${escapeHTML(displayOption)}
                        </p>

                        <strong>
                            ${escapeHTML(money(item.price * item.quantity))}
                        </strong>
                    </div>

                    <div class="popup-cart-item-actions">
                        <div class="cart-quantity-controls">
                            <button
                                type="button"
                                data-cart-action="increase"
                                data-index="${index}"
                                aria-label="${escapeHTML(text("increase"))}"
                            >+</button>

                            <span>${formatPrice(item.quantity)}</span>

                            <button
                                type="button"
                                data-cart-action="decrease"
                                data-index="${index}"
                                aria-label="${escapeHTML(text("decrease"))}"
                            >−</button>
                        </div>

                        <button
                            type="button"
                            class="cart-remove-button"
                            data-cart-action="remove"
                            data-index="${index}"
                        >
                            ${escapeHTML(text("delete"))}
                        </button>
                    </div>
                </div>
            `;
        }).join("");

        saveCart();

        if (addonsContainer) {
            addonsContainer.innerHTML = getExtrasSectionHTML();
            bindAddonButtons();
        }
    }

    bindCartItemActions();
    updateCartTotals();
}

function bindCartItemActions() {
    $$("[data-cart-action]").forEach(button => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.index);
            const action = button.dataset.cartAction;

            if (action === "increase") {
                changeCartQuantity(index, 1);
            } else if (action === "decrease") {
                changeCartQuantity(index, -1);
            } else if (action === "remove") {
                removeCartItem(index);
            }
        });
    });
}

function updateCartTotals() {
    const subtotal = getCartSubtotal();
    const discount = getCouponDiscount();
    const total = getCartTotal();

    const subtotalElement = $("#popupSubtotal");
    const discountElement = $("#popupDiscount");
    const grandTotalElement = $("#popupGrandTotal");
    const footerTotalElement = $("#popupFooterTotal");

    if (subtotalElement) {
        subtotalElement.textContent = money(subtotal);
    }

    if (discountElement) {
        discountElement.textContent = `-${money(discount)}`;
    }

    if (grandTotalElement) {
        grandTotalElement.textContent = money(total);
    }

    if (footerTotalElement) {
        footerTotalElement.textContent = money(total);
    }

    updateFixedCart();
}

function renderCart() {
    renderPopupCart();
    updateFixedCart();
}

/* =========================================================
   25 — نافذة السلة
========================================================= */

function openCartModal() {
    const overlay = $("#cartModalOverlay");

    if (!overlay) return;

    overlay.hidden = false;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");

    document.body.classList.add("cart-modal-open");

    renderCart();
}

function closeCartModal() {
    const overlay = $("#cartModalOverlay");

    if (!overlay) return;

    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    overlay.hidden = true;

    document.body.classList.remove("cart-modal-open");
}

/* =========================================================
   26 — الخصومات
========================================================= */

function applyCoupon() {
    const input = $("#couponCode");
    const status = $("#couponStatus");

    if (!input || !status) return;

    const code = input.value.trim().toUpperCase();

    if (!code || !COUPON_RULES[code]) {
        activeCoupon = null;
        saveCoupon();

        status.textContent = text("couponInvalid");
        status.className = "coupon-status error";

        renderCart();
        return;
    }

    if (!cart.length) {
        status.textContent = text("emptyCart");
        status.className = "coupon-status error";
        return;
    }

    activeCoupon = { code };

    saveCoupon();

    status.textContent = text("couponApplied");
    status.className = "coupon-status success";

    renderCart();
}

function restoreCouponUI() {
    const input = $("#couponCode");
    const status = $("#couponStatus");

    if (!activeCoupon) return;

    if (input) {
        input.value = activeCoupon.code || "";
    }

    if (status) {
        status.textContent = text("couponApplied");
        status.className = "coupon-status success";
    }
}

/* =========================================================
   27 — إرسال الطلب إلى واتساب
========================================================= */

function buildWhatsAppOrderMessage(customer) {
    const lines = [];

    lines.push(text("orderTitle"));
    lines.push("====================");
    lines.push("");

    lines.push(text("orderItems"));
    lines.push("--------------------");

    cart.forEach((item, index) => {
        const name = isEnglish()
            ? item.name_en || EN_PRODUCTS[item.name] || item.name
            : item.name;

        const option = isEnglish()
            ? getCartOptionEnglish(item)
            : item.option;

        lines.push(
            `${formatPrice(index + 1)}. ${name} (${option})`
        );

        lines.push(
            `${text("quantity")}: ${formatPrice(item.quantity)}`
        );

        lines.push(
            `${money(item.price)} × ${formatPrice(item.quantity)} = ${money(item.price * item.quantity)}`
        );

        lines.push("");
    });

    lines.push("--------------------");
    lines.push(`${text("subtotal")}: ${money(getCartSubtotal())}`);
    lines.push(`${text("discount")}: ${money(getCouponDiscount())}`);
    lines.push(`${text("total")}: ${money(getCartTotal())}`);

    if (activeCoupon?.code) {
        lines.push(`Coupon: ${activeCoupon.code}`);
    }

    lines.push("");
    lines.push(text("orderCustomer"));
    lines.push("--------------------");
    lines.push(`${text("customerName")}: ${customer.name}`);
    lines.push(`${text("customerPhone")}: ${customer.phone}`);
    lines.push(`${text("customerAddress")}: ${customer.address}`);

    if (customer.notes) {
        lines.push(`${text("customerNotes")}: ${customer.notes}`);
    }

    lines.push("");
    lines.push("مطعم الغنّام");

    return lines.join("\n");
}

function sendOrderToWhatsApp(event) {
    event?.preventDefault();

    const name = $("#popupCustomerName")?.value.trim() || "";
    const phone = $("#popupCustomerPhone")?.value.trim() || "";
    const address = $("#popupCustomerAddress")?.value.trim() || "";
    const notes = $("#popupCustomerNotes")?.value.trim() || "";

    const status = $("#popupOrderStatus");

    if (!cart.length) {
        if (status) {
            status.textContent = text("emptyCart");
            status.className = "order-status error";
        }
        return;
    }

    if (!name || !phone || !address) {
        if (status) {
            status.textContent = text("fillRequired");
            status.className = "order-status error";
        }
        return;
    }

    const message = buildWhatsAppOrderMessage({
        name,
        phone,
        address,
        notes
    });

    const whatsappURL =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    window.open(
        whatsappURL,
        "_blank",
        "noopener,noreferrer"
    );

    if (status) {
        status.textContent = isEnglish()
            ? "Your order is ready to send via WhatsApp."
            : "تم تجهيز طلبك للإرسال عبر واتساب.";

        status.className = "order-status success";
    }
}

/* =========================================================
   28 — اللغة العربية والإنجليزية
========================================================= */

function applyStaticLanguage() {
    document.documentElement.lang = currentLanguage;

    document.documentElement.dir =
        currentLanguage === "en" ? "ltr" : "rtl";

    const search = $("#grillSearch");

    if (search) {
        search.placeholder = text("searchPlaceholder");
    }

    const languageToggle = $("#languageToggle");

    if (languageToggle) {
        languageToggle.textContent =
            currentLanguage === "en" ? "العربية" : "English";
    }

    const couponInput = $("#couponCode");

    if (couponInput) {
        couponInput.placeholder = text("couponPlaceholder");
    }

    const applyCouponButton = $("#applyCouponButton");

    if (applyCouponButton) {
        applyCouponButton.textContent = text("applyCoupon");
    }

    const continueButton = $("#continueShoppingButton");

    if (continueButton) {
        continueButton.textContent = text("continueShopping");
    }

    const orderButton = $("#popupOrderForm")?.querySelector(
        'button[type="submit"], button:not([type])'
    );

    if (orderButton) {
        orderButton.textContent = text("sendOrder");
    }

    const nameInput = $("#popupCustomerName");
    const phoneInput = $("#popupCustomerPhone");
    const addressInput = $("#popupCustomerAddress");
    const notesInput = $("#popupCustomerNotes");

    if (nameInput) nameInput.placeholder = text("customerName");
    if (phoneInput) phoneInput.placeholder = text("customerPhone");
    if (addressInput) addressInput.placeholder = text("customerAddress");
    if (notesInput) notesInput.placeholder = text("customerNotes");

    const offersTitle = $("#grillOffersTitle");

    if (offersTitle) {
        offersTitle.textContent = text("offers");
    }

    document.body.classList.toggle(
        "grill-language-en",
        currentLanguage === "en"
    );

    document.body.classList.toggle(
        "grill-language-ar",
        currentLanguage === "ar"
    );
}

function setGrillLanguage(language) {
    if (!["ar", "en"].includes(language)) return;

    currentLanguage = language;

    localStorage.setItem(
        STORAGE_KEYS.language,
        currentLanguage
    );

    applyStaticLanguage();

    if (grillMenuLoaded) {
        renderCategories();
        renderMenu();
    }

    renderGrillOffers();
    renderCart();
    restoreCouponUI();
}

/* =========================================================
   29 — طريقة عرض المنتجات Grid / List
========================================================= */

function setGrillView(view) {
    if (!["grid", "list"].includes(view)) return;

    currentView = view;

    localStorage.setItem(
        STORAGE_KEYS.view,
        currentView
    );

    const gridButton = $("#grillGridView");
    const listButton = $("#grillListView");

    if (gridButton) {
        gridButton.classList.toggle(
            "active",
            currentView === "grid"
        );
    }

    if (listButton) {
        listButton.classList.toggle(
            "active",
            currentView === "list"
        );
    }

    if (grillMenuLoaded) {
        renderMenu();
    }
}

/* =========================================================
   30 — ربط أحداث الصفحة
========================================================= */

function bindPageEvents() {
    const languageToggle = $("#languageToggle");

    languageToggle?.addEventListener("click", () => {
        setGrillLanguage(
            currentLanguage === "ar" ? "en" : "ar"
        );
    });

    $("#grillSearch")?.addEventListener(
        "input",
        renderMenu
    );

    $("#grillGridView")?.addEventListener("click", () => {
        setGrillView("grid");
    });

    $("#grillListView")?.addEventListener("click", () => {
        setGrillView("list");
    });

    $("#fixedCartBar")?.addEventListener(
        "click",
        openCartModal
    );

    $("#closeCartModal")?.addEventListener(
        "click",
        closeCartModal
    );

    $("#continueShoppingButton")?.addEventListener(
        "click",
        closeCartModal
    );

    $("#cartModalOverlay")?.addEventListener("click", event => {
        if (event.target === $("#cartModalOverlay")) {
            closeCartModal();
        }
    });

    $("#applyCouponButton")?.addEventListener(
        "click",
        applyCoupon
    );

    $("#couponCode")?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            applyCoupon();
        }
    });

    $("#popupOrderForm")?.addEventListener(
        "submit",
        sendOrderToWhatsApp
    );

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeCartModal();
        }
    });

    setGrillView(currentView);
}

/* =========================================================
   31 — مزامنة السلة بين الصفحات والتبويبات
========================================================= */

window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEYS.cart) {
        cart = loadSavedCart();

        if (grillMenuLoaded) {
            updateCartImagesFromMenu();
        }

        renderCart();
    }

    if (event.key === STORAGE_KEYS.coupon) {
        activeCoupon = loadSavedCoupon();
        renderCart();
        restoreCouponUI();
    }

    if (event.key === STORAGE_KEYS.language) {
        currentLanguage =
            localStorage.getItem(STORAGE_KEYS.language) || "ar";

        applyStaticLanguage();

        if (grillMenuLoaded) {
            renderCategories();
            renderMenu();
        }

        renderGrillOffers();
        renderCart();
    }
});

window.addEventListener("pageshow", () => {
    cart = loadSavedCart();
    activeCoupon = loadSavedCoupon();

    if (grillMenuLoaded) {
        updateCartImagesFromMenu();
    }

    renderCart();
    restoreCouponUI();
});

/* =========================================================
   32 — تهيئة الصفحة
========================================================= */

function initializeGrillPage() {
    const cartOverlay = $("#cartModalOverlay");

    if (cartOverlay) {
        cartOverlay.hidden = true;
        cartOverlay.classList.remove("active");
        cartOverlay.setAttribute("aria-hidden", "true");
    }

    applyStaticLanguage();
    bindPageEvents();

    void syncGrillMenuFromDatabase();
    void syncGrillOffersFromDatabase();

    restoreCouponUI();
    renderCart();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeGrillPage,
        { once: true }
    );
} else {
    initializeGrillPage();
}
