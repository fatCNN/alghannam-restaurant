import {
    supabaseClient as supabase,
    isSupabaseConfigured as configured
} from "./dashboard/supabase-client.js";

import {
    loadBranchDiscounts,
    getBestAutomaticDiscount,
    priceAfterAutomaticDiscount,
    automaticDiscountValue
} from "./discounts.js";

/* =========================================================
   مطعم الغنّام — فرع الفلافل
   FALAFEL BRANCH — DATABASE DRIVEN

   - Supabase categories / products / offers
   - Arabic / English interface
   - RTL / LTR
   - Search and category navigation
   - Grid / list product view
   - Cart and quantity management
   - Automatic discounts
   - Server-validated coupons
   - Secure order creation through create_order_secure
   - WhatsApp ordering after successful database save

   IMPORTANT:
   Prices, automatic discounts, coupon discounts and totals
   are recalculated and validated by Supabase.
========================================================= */

(() => {
    "use strict";

    /* =====================================================
       01 — SETTINGS
    ===================================================== */

    const BRANCH_ID = "falafel";

    const STORAGE_KEY = "alghannam_falafel_cart_v2";
    const COUPON_KEY = "alghannam_falafel_coupon_v1";
    const PRODUCT_VIEW_KEY = "alghannam_falafel_product_view";
    const LANGUAGE_KEY = "alghannam_fastfood_language";

    const WHATSAPP_NUMBERS = [
        "07760000552",
        "07860000556"
    ];

    const IMAGE_FOLDER = "falafel/imagefalafel/";

    /* =====================================================
       02 — GENERAL HELPERS
    ===================================================== */

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    const escapeHTML = value =>
        String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);

    function safeStorageGet(key, fallback = "") {
        try {
            return localStorage.getItem(key) ?? fallback;
        } catch {
            return fallback;
        }
    }

    function safeStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn("تعذر حفظ البيانات:", error);
        }
    }

    function safeStorageRemove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn("تعذر حذف البيانات:", error);
        }
    }

    function safeNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function clampQuantity(value) {
        return Math.max(
            1,
            Math.min(99, Math.floor(safeNumber(value)))
        );
    }

    function normalizeCouponCode(value) {
        return String(value ?? "")
            .trim()
            .toUpperCase();
    }

    function getErrorMessage(error) {
        return error?.message ||
            error?.details ||
            error?.hint ||
            String(error || "حدث خطأ غير معروف");
    }

    let currentLanguage =
        safeStorageGet(LANGUAGE_KEY, "ar") === "en"
            ? "en"
            : "ar";

    /* =====================================================
       03 — UI TRANSLATIONS
    ===================================================== */

    const ui = {
        ar: {
            restaurant: "مطعم الغنّام",
            branch: "فرع الفلافل",
            home: "الرئيسية",
            menu: "قائمة الطعام",
            search: "ابحث عن وجبتك المفضلة...",
            searchLabel: "ابحث عن وجبتك المفضلة",
            loading: "جارٍ تحميل المنيو...",
            loadingPage: "يرجى الانتظار...",
            loadingError: "تعذر تحميل المنيو من قاعدة البيانات.",
            retry: "إعادة المحاولة",
            empty: "لا توجد منتجات حالياً.",
            emptySearch: "ما لقينا منتجات تطابق بحثك.",
            add: "أضف إلى السلة",
            addAgain: "إضافة أخرى",
            cart: "عرض السلة",
            cartTitle: "سلة مشترياتك 🛒",
            emptyCart: "لا توجد منتجات في السلة",
            item: "صنف",
            items: "أصناف",
            inCart: "في السلة",
            decrease: "تقليل الكمية",
            increase: "زيادة الكمية",
            remove: "حذف المنتج",
            addToOrder: "أضف إلى طلبك",
            addAddon: "أضف للسلة",
            noAddons: "لا توجد إضافات أخرى متاحة.",
            scrollBrowse: "اسحب للتصفح ←",
            coupon: "🎟️ كود الخصم",
            couponPlaceholder: "أدخل كود الخصم",
            apply: "تطبيق",
            invalidCoupon: "الكوبون غير صالح أو غير متاح لهذا الطلب.",
            enterCoupon: "أدخل كود الخصم أولاً.",
            applied: "تم التحقق من الكوبون بنجاح.",
            validatingCoupon: "جارٍ التحقق من الكوبون...",
            couponNeedItems: "أضف منتجات إلى السلة أولاً.",
            subtotal: "المجموع بعد الخصم التلقائي",
            discount: "خصم الكوبون",
            automaticDiscount: "التوفير من العروض التلقائية",
            total: "الإجمالي النهائي",
            customerInfo: "معلومات الزبون",
            name: "الاسم",
            fullName: "الاسم الكامل",
            phone: "رقم الهاتف",
            address: "العنوان",
            addressPlaceholder: "منطقة السكن وأقرب نقطة دالة",
            notes: "ملاحظات إضافية",
            notesPlaceholder: "أي ملاحظات على الطلب",
            send: "إرسال الطلب عبر واتساب",
            continue: "مواصلة التسوق",
            close: "إغلاق",
            cartEmptyOrder: "أضف منتجاً واحداً على الأقل قبل إرسال الطلب.",
            openingWhatsApp: "سيتم فتح واتساب لإكمال إرسال الطلب.",
            whatsappError: "تعذر فتح واتساب. اسمح بالنوافذ المنبثقة.",
            orderTitle: "طلب جديد — مطعم الغنّام / فرع الفلافل",
            details: "تفاصيل الطلب",
            noCoupon: "لا يوجد",
            noNotes: "لا توجد",
            branchNumbers: "أرقام الفرع",
            offers: "عروضنا",
            originalPrice: "السعر قبل العرض",
            offerPrice: "سعر العرض",
            noOffers: "لا توجد عروض حالياً",
            allPrices: "جميع الأسعار بالدينار العراقي",

            mainNavigation: "التنقل الرئيسي",
            siteSettings: "إعدادات الموقع",
            changeLanguage: "تغيير اللغة",
            openMenu: "فتح القائمة",
            backToRestaurant: "العودة إلى مطعم الغنّام",

            sideMenuTitle: "القائمة",
            navigationTitle: "التنقل",
            homePage: "الرئيسية",
            foodMenu: "قائمة الطعام",
            goToMenu: "الانتقال إلى المنيو",
            shoppingCart: "سلة المشتريات",
            viewItemsTotal: "عرض المنتجات والإجمالي",
            restaurantInfo: "معلومات المطعم",
            currency: "العملة",
            iraqiCurrency: "الدينار العراقي (د.ع)",
            helpComplaints: "المساعدة والشكاوى",
            helpDescription: "للاستفسارات وتقديم الشكاوى",
            branchLocation: "موقع الفرع",
            locationDescription: "الإعلام، سوق أميمة، مقابل جامع المصطفى",
            openMap: "فتح الموقع على الخريطة",
            closeSideMenu: "إغلاق القائمة",

            footerAddress: "الإعلام، سوق أميمة، مقابل جامع المصطفى",
            footerBranchNumbers: "أرقام الفرع:",
            footerPrices: "جميع الأسعار بالدينار العراقي",
            backHomePage: "العودة إلى الصفحة الرئيسية",

            currentOrder: "طلبك الحالي",
            addonsDescription: "إضافات من المنيو",
            cartSummary: "ملخص الحساب",
            cartBranch: "مطعم الغنّام — فرع الفلافل",

            gridView: "التبديل إلى العرض الأفقي",
            listView: "التبديل إلى عرض البطاقات",

            savingOrder: "جارٍ حفظ الطلب...",
            orderSaved: "تم حفظ الطلب بنجاح.",
            orderSaveFailed: "تعذر حفظ الطلب. السلة لم تتغير.",
            whatsappSaved: "تم حفظ الطلب. أكمل إرساله عبر واتساب.",
            whatsappBlocked: "تم حفظ الطلب، لكن تعذر فتح واتساب."
        },

        en: {
            restaurant: "Al Ghannam Restaurant",
            branch: "Falafel Branch",
            home: "Home",
            menu: "Menu",
            search: "Search for your favorite meal...",
            searchLabel: "Search for your favorite meal",
            loading: "Loading menu...",
            loadingPage: "Please wait...",
            loadingError: "Unable to load the menu from the database.",
            retry: "Try again",
            empty: "No products available.",
            emptySearch: "No products match your search.",
            add: "Add to Cart",
            addAgain: "Add another",
            cart: "View Cart",
            cartTitle: "Your Shopping Cart 🛒",
            emptyCart: "Your cart is empty",
            item: "item",
            items: "items",
            inCart: "in cart",
            decrease: "Decrease quantity",
            increase: "Increase quantity",
            remove: "Remove item",
            addToOrder: "Add to Your Order",
            addAddon: "Add to Cart",
            noAddons: "No additional items available.",
            scrollBrowse: "Scroll to browse →",
            coupon: "🎟️ Discount Code",
            couponPlaceholder: "Enter discount code",
            apply: "Apply",
            invalidCoupon: "The coupon is invalid or unavailable for this order.",
            enterCoupon: "Please enter the discount code.",
            applied: "Coupon validated successfully.",
            validatingCoupon: "Validating coupon...",
            couponNeedItems: "Add products to your cart first.",
            subtotal: "Subtotal after automatic discounts",
            discount: "Coupon discount",
            automaticDiscount: "Automatic savings",
            total: "Grand Total",
            customerInfo: "Customer Information",
            name: "Name",
            fullName: "Full Name",
            phone: "Phone Number",
            address: "Address",
            addressPlaceholder: "Your area and nearest landmark",
            notes: "Additional Notes",
            notesPlaceholder: "Any notes about your order",
            send: "Send Order via WhatsApp",
            continue: "Continue Shopping",
            close: "Close",
            cartEmptyOrder: "Add at least one item before submitting.",
            openingWhatsApp: "Opening WhatsApp...",
            whatsappError: "Could not open WhatsApp. Allow pop-ups.",
            orderTitle: "New Order — Al Ghannam / Falafel Branch",
            details: "Order Details",
            noCoupon: "None",
            noNotes: "None",
            branchNumbers: "Branch Numbers",
            offers: "Our Offers",
            originalPrice: "Original Price",
            offerPrice: "Offer Price",
            noOffers: "No offers available",
            allPrices: "All prices are in Iraqi dinars",

            mainNavigation: "Main Navigation",
            siteSettings: "Website Settings",
            changeLanguage: "Change Language",
            openMenu: "Open Menu",
            backToRestaurant: "Back to Al Ghannam Restaurant",

            sideMenuTitle: "Menu",
            navigationTitle: "Navigation",
            homePage: "Home",
            foodMenu: "Food Menu",
            goToMenu: "Go to Menu",
            shoppingCart: "Shopping Cart",
            viewItemsTotal: "View items and total",
            restaurantInfo: "Restaurant Information",
            currency: "Currency",
            iraqiCurrency: "Iraqi Dinar (IQD)",
            helpComplaints: "Help & Complaints",
            helpDescription: "For inquiries and complaints",
            branchLocation: "Branch Location",
            locationDescription: "Al I'lam, Umayma Market, opposite Al-Mustafa Mosque",
            openMap: "Open Location on Map",
            closeSideMenu: "Close Menu",

            footerAddress: "Al I'lam, Umayma Market, opposite Al-Mustafa Mosque",
            footerBranchNumbers: "Branch Numbers:",
            footerPrices: "All prices are in Iraqi dinars",
            backHomePage: "Back to Home Page",

            currentOrder: "Your Current Order",
            addonsDescription: "Menu Add-ons",
            cartSummary: "Order Summary",
            cartBranch: "Al Ghannam Restaurant — Falafel Branch",

            gridView: "Switch to List View",
            listView: "Switch to Grid View",

            savingOrder: "Saving your order...",
            orderSaved: "Your order was saved successfully.",
            orderSaveFailed: "Could not save your order. Your cart is unchanged.",
            whatsappSaved: "Your order was saved. Continue sending it through WhatsApp.",
            whatsappBlocked: "Your order was saved, but WhatsApp could not open."
        }
    };

    const t = key =>
        ui[currentLanguage][key] ?? ui.ar[key] ?? key;

    function money(value) {
        const amount = Math.max(0, Math.round(safeNumber(value)));

        return currentLanguage === "en"
            ? `${amount.toLocaleString("en-US")} IQD`
            : `${amount.toLocaleString("en-US")} د.ع`;
    }

    /* =====================================================
       04 — PAGE STATE
    ===================================================== */

    let products = [];
    let automaticDiscounts = [];
    let databaseCategories = [];
    let databaseOffers = [];

    let currentSearch = "";
    let cart = [];

    let activeCoupon = "";
    let couponPreviewAmount = 0;
    let couponValidationSequence = 0;

    let orderSubmitting = false;
    let lastCartFocus = null;
    let audioContext = null;

    let menuDatabase = null;
    let menuLoadSequence = 0;

    /* =====================================================
       05 — PAGE ELEMENTS
    ===================================================== */

    const menu = $("#falafelMenu");
    const categoryNav = $("#categoryNav");
    const searchInput = $("#falafelSearch");

    const cartOverlay = $("#cartModalOverlay");
    const fixedCartBar = $("#fixedCartBar");
    const popupItems = $("#popupCartItems");
    const addonsList = $("#cartAddonsList");

    const couponInput = $("#couponCode");
    const couponStatus = $("#couponStatus");

    const viewToggleButton = $("#toggleProductView");
    const viewToggleIcon = $("#viewToggleIcon");

    /* =====================================================
       06 — PRODUCT AND CATEGORY DATA
    ===================================================== */

    function productName(product) {
        if (currentLanguage === "en") {
            return product?.name_en ||
                product?.name_ar ||
                product?.name ||
                "";
        }

        return product?.name_ar ||
            product?.name ||
            "";
    }

    function productDescription(product) {
        if (currentLanguage === "en") {
            return product?.description_en ||
                product?.description_ar ||
                product?.description ||
                "";
        }

        return product?.description_ar ||
            product?.description ||
            "";
    }

    function categoryDisplayName(category) {
        if (currentLanguage === "en") {
            return category?.name_en ||
                category?.name_ar ||
                category?.name ||
                "";
        }

        return category?.name_ar ||
            category?.name ||
            "";
    }

    function getProduct(id) {
        return products.find(product =>
            String(product.id) === String(id)
        );
    }

    function getCategory(id) {
        return databaseCategories.find(category =>
            String(category.id) === String(id)
        );
    }

    /* =====================================================
       07 — DATABASE IMAGES
    ===================================================== */

    function normalizeDatabaseImage(value) {
        if (typeof value !== "string" || !value.trim()) {
            return "";
        }

        const raw = value.trim();

        if (/^https?:\/\//i.test(raw)) {
            return raw;
        }

        const clean = raw
            .split("?")[0]
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");

        if (!clean) return "";

        if (
            clean.startsWith("falafel/imagefalafel/") ||
            clean.startsWith("./falafel/imagefalafel/")
        ) {
            return clean.replace(/^\.\//, "");
        }

        if (clean.startsWith("imagefalafel/")) {
            return `falafel/${clean}`;
        }

        if (!clean.includes("/")) {
            return IMAGE_FOLDER + clean;
        }

        return "";
    }

    function getProductImage(product) {
        return [
            product?.image_url,
            product?.image_path,
            product?.extra?.local_image_path
        ]
            .map(normalizeDatabaseImage)
            .find(Boolean) || "";
    }

    function getOfferImage(offer) {
        return [
            offer?.image_url,
            offer?.image_path
        ]
            .map(normalizeDatabaseImage)
            .find(Boolean) || "";
    }

    function imageFallbackHandler() {
        return `
            if (this.dataset.fallback && !this.dataset.fallbackUsed) {
                this.dataset.fallbackUsed = "1";
                this.src = this.dataset.fallback;
            } else {
                this.style.display = "none";
                const placeholder = this.nextElementSibling;
                if (placeholder) placeholder.style.display = "flex";
            }
        `;
    }

    /* =====================================================
       08 — STATIC PAGE TRANSLATIONS
    ===================================================== */

    function setText(selector, value, root = document) {
        const element = $(selector, root);
        if (element) element.textContent = value;
    }

    function setAttribute(selector, attribute, value) {
        const element = $(selector);
        if (element) element.setAttribute(attribute, value);
    }

    function applyStaticTranslations() {
        const isEnglish = currentLanguage === "en";

        document.documentElement.lang = currentLanguage;
        document.documentElement.dir = isEnglish ? "ltr" : "rtl";

        document.body.classList.toggle("language-en", isEnglish);

        document.title = isEnglish
            ? "Al Ghannam Restaurant | Falafel Branch"
            : "مطعم الغنّام | فرع الفلافل";

        const description = $('meta[name="description"]');

        if (description) {
            description.content = isEnglish
                ? "Al Ghannam Restaurant - Falafel Branch, fresh meals and WhatsApp orders"
                : "منيو مطعم الغنّام - فرع الفلافل، وجبات طازجة وطلبات عبر واتساب";
        }

        /* Header */
        setText(".main-nav-link", t("home"));

        setAttribute(".main-nav", "aria-label", t("mainNavigation"));
        setAttribute(".header-actions", "aria-label", t("siteSettings"));
        setAttribute(".brand", "aria-label", t("backToRestaurant"));

        setAttribute("#languageToggle", "aria-label", t("changeLanguage"));
        setAttribute("#openSettingsPanel", "aria-label", t("openMenu"));

        const languageButton = $("#languageToggle");

        if (languageButton) {
            languageButton.textContent = isEnglish ? "AR" : "EN";
        }

        /* Loader */
        setText(".loader-content p", t("restaurant"));
        setText(".loader-content span", t("loadingPage"));

        /* Search */
        if (searchInput) {
            searchInput.placeholder = t("search");
            searchInput.setAttribute("aria-label", t("searchLabel"));
        }

        setAttribute(".menu-tools", "aria-label", t("searchLabel"));
        setAttribute("#categoryNav", "aria-label", t("menu"));
        setAttribute(".menu-heading-row", "aria-label", t("menu"));
        setAttribute("#menu", "aria-label", t("menu"));

        /* Fixed cart */
        setText(".fixed-cart-label strong", t("cart"));
        setAttribute("#fixedCartBar", "aria-label", t("cart"));

        /* Cart modal */
        setText("#cartModalTitle", t("cartTitle"));
        setText(".cart-modal-header > div p", t("cartBranch"));
        setAttribute("#closeCartModal", "aria-label", t("close"));

        setText(
            ".popup-cart-products .popup-section-title",
            t("currentOrder")
        );

        setText("#cartAddonsTitle", t("addToOrder"));
        setText(".cart-addons-heading p", t("addonsDescription"));
        setText(".cart-addons-hint", t("scrollBrowse"));

        /* Coupon */
        setText(".coupon-box label", t("coupon"));

        if (couponInput) {
            couponInput.placeholder = t("couponPlaceholder");
        }

        setText("#applyCouponButton", t("apply"));

        /* Cart summary */
        const summary = $(".coupon-summary");

        if (summary) {
            const rows = $$(":scope > div", summary);

            if (rows[0]) setText("span", t("subtotal"), rows[0]);
            if (rows[1]) setText("span", t("discount"), rows[1]);
            if (rows[2]) setText("span", t("total"), rows[2]);
        }

        setAttribute(".coupon-summary", "aria-label", t("cartSummary"));

        /* Customer form */
        setText(".popup-order-form h3", t("customerInfo"));

        const labels = $$(".popup-order-form label");

        const labelTexts = [
            t("name"),
            t("phone"),
            t("address"),
            t("notes")
        ];

        labels.forEach((label, index) => {
            if (labelTexts[index]) {
                label.textContent = labelTexts[index];
            }
        });

        const placeholders = [
            ["#popupCustomerName", t("fullName")],
            ["#popupCustomerPhone", t("phone")],
            ["#popupCustomerAddress", t("addressPlaceholder")],
            ["#popupCustomerNotes", t("notesPlaceholder")]
        ];

        placeholders.forEach(([selector, value]) => {
            const element = $(selector);
            if (element) element.placeholder = value;
        });

        setText(".popup-submit-button", t("send"));
        setText("#continueShoppingButton", t("continue"));

        /* Settings panel */
        setText("#settingsPanelTitle", t("sideMenuTitle"));
        setText(".settings-heading p", t("cartBranch"));
        setAttribute("#closeSettingsPanel", "aria-label", t("close"));

        const settingsHeadings =
            $$(".settings-panel .settings-section-title");

        if (settingsHeadings[0]) {
            settingsHeadings[0].textContent = t("navigationTitle");
        }

        if (settingsHeadings[1]) {
            settingsHeadings[1].textContent = t("restaurantInfo");
        }

        const settingsItems =
            $$(".settings-panel .settings-menu-item");

        if (settingsItems[0]) {
            setText("strong", t("homePage"), settingsItems[0]);
        }

        if (settingsItems[1]) {
            setText("strong", t("foodMenu"), settingsItems[1]);
            setText("small", t("goToMenu"), settingsItems[1]);
        }

        if (settingsItems[2]) {
            setText("strong", t("shoppingCart"), settingsItems[2]);
            setText("small", t("viewItemsTotal"), settingsItems[2]);
        }

        const infoCards = $$(".settings-info-card");

        if (infoCards[0]) {
            setText("strong", t("restaurant"), infoCards[0]);
            setText("p", t("branch"), infoCards[0]);
        }

        if (infoCards[1]) {
            setText("strong", t("currency"), infoCards[1]);
            setText("p", t("iraqiCurrency"), infoCards[1]);
        }

        const helpLink = $('a[href="support/support.html"]');

        if (helpLink) {
            setText("strong", t("helpComplaints"), helpLink);
            setText("small", t("helpDescription"), helpLink);
        }

        const phoneCard =
            $(".settings-compact-card:not(.settings-location-link)");

        if (phoneCard) {
            setText("strong", t("branchNumbers"), phoneCard);
        }

        const locationCard = $(".settings-location-link");

        if (locationCard) {
            setText("strong", t("branchLocation"), locationCard);
            setText("small", t("locationDescription"), locationCard);
            locationCard.setAttribute("aria-label", t("openMap"));
        }

        setText("#settingsDoneButton", t("closeSideMenu"));

        /* Footer */
        const footer = $(".site-footer");

        if (footer) {
            const paragraphs = $$("p", footer);

            if (paragraphs[0]) {
                paragraphs[0].textContent =
                    `${t("restaurant")} — ${t("branch")}`;
            }

            if (paragraphs[1]) {
                paragraphs[1].textContent = t("footerAddress");
            }

            if (paragraphs[2]) {
                const phoneLinks = $$("a", paragraphs[2]);

                paragraphs[2].textContent =
                    `${t("footerBranchNumbers")} `;

                phoneLinks.forEach((link, index) => {
                    if (index > 0) {
                        paragraphs[2].append(" — ");
                    }

                    paragraphs[2].appendChild(link);
                });
            }

            if (paragraphs[3]) {
                paragraphs[3].textContent = t("footerPrices");
            }

            const homeLink = $('a[href="index.html"]', footer);

            if (homeLink) {
                homeLink.textContent = t("backHomePage");
            }
        }

        /* Offers */
        const offersSection = $("#falafelOffersSection");

        if (offersSection) {
            setText(
                ".falafel-offers-heading h2",
                t("offers"),
                offersSection
            );

            setText(
                ".falafel-offers-heading p",
                t("allPrices"),
                offersSection
            );
        }

        updateProductView(getSavedProductView());
    }

    /* =====================================================
       09 — LANGUAGE SWITCHING
    ===================================================== */

    async function setLanguage(language) {
        const nextLanguage = language === "en" ? "en" : "ar";

        if (nextLanguage === currentLanguage) return;

        currentLanguage = nextLanguage;

        safeStorageSet(LANGUAGE_KEY, currentLanguage);

        applyStaticTranslations();

        await loadDatabaseMenu();

        renderCart();
    }

    $("#languageToggle")?.addEventListener("click", () => {
        setLanguage(currentLanguage === "ar" ? "en" : "ar");
    });

    /* =====================================================
       10 — DATABASE MODULE
    ===================================================== */

    async function initializeDatabaseModule() {
        if (!menuDatabase) {
            menuDatabase = await import("./menu-db.js");
        }

        return menuDatabase;
    }

    /* =====================================================
       11 — CART STORAGE
    ===================================================== */

    function loadStoredCart() {
        try {
            const saved = JSON.parse(
                safeStorageGet(STORAGE_KEY, "[]")
            );

            if (!Array.isArray(saved)) return [];

            return saved
                .map(row => {
                    if (!row || row.id == null) return null;

                    return {
                        id: String(row.id),
                        qty: clampQuantity(row.qty)
                    };
                })
                .filter(Boolean);

        } catch {
            return [];
        }
    }

    function saveCart() {
        safeStorageSet(STORAGE_KEY, JSON.stringify(cart));
    }

    function reconcileCartWithDatabase() {
        const validIds = new Set(
            products.map(product => String(product.id))
        );

        cart = cart.filter(row =>
            validIds.has(String(row.id))
        );

        saveCart();
    }

    /* =====================================================
       12 — LOAD DATABASE MENU
    ===================================================== */

    async function loadDatabaseMenu() {
        const sequence = ++menuLoadSequence;

        if (menu) {
            menu.innerHTML = `
                <p class="empty-message">
                    ${escapeHTML(t("loading"))}
                </p>
            `;
        }

        try {
            const database = await initializeDatabaseModule();

            const [menuResult, offersResult] = await Promise.all([
                database.loadBranchMenu(BRANCH_ID, currentLanguage),
                database.loadBranchOffers(BRANCH_ID)
            ]);


const discountsResult =
    await loadBranchDiscounts(BRANCH_ID, false);

if (sequence !== menuLoadSequence) return;

automaticDiscounts = Array.isArray(discountsResult)
    ? discountsResult
    : [];

if (!menuResult) {
    throw new Error(
        "لم تصل بيانات المنيو من قاعدة البيانات"
    );
}

databaseCategories =
    Array.isArray(menuResult.categories)
        ? menuResult.categories
        : [];

const rawProducts =
    Array.isArray(menuResult.products)
        ? menuResult.products
        : [];

databaseOffers =
    Array.isArray(offersResult)
        ? offersResult
        : [];

const categoryIds = new Set(
    databaseCategories.map(category =>
        String(category.id)
    )
);

products = rawProducts
    .filter(product =>
        categoryIds.has(String(product.category_id))
    )
    .filter(product =>
        product.is_available !== false
    )
    .map(product => ({
        ...product,

        id: String(product.id),

        name_ar:
            product.name_ar ||
            product.name ||
            "",

        name_en:
            product.name_en || "",

        description_ar:
            product.description_ar ||
            product.description ||
            "",

        description_en:
            product.description_en ||
            product.description ||
            "",

        price: safeNumber(product.price),

        image: getProductImage(product)
    }));

if (!window.__falafelCartRestored) {
    cart = loadStoredCart();
    window.__falafelCartRestored = true;
}

reconcileCartWithDatabase();

renderMenu();
renderOffers();
renderCart();

console.info(
    "تم تحميل منيو الفلافل من Supabase",
    {
        categories: databaseCategories.length,
        products: products.length,
        offers: databaseOffers.length,
        discounts: automaticDiscounts.length,
        language: currentLanguage
    }
);

} catch (error) {
    if (sequence !== menuLoadSequence) return;

    console.error("خطأ تحميل المنيو:", error);

    products = [];
    databaseCategories = [];
    databaseOffers = [];
    automaticDiscounts = [];

    if (menu) {
        menu.innerHTML = `
            <div class="empty-message">
                <p>${escapeHTML(t("loadingError"))}</p>

                <button type="button" id="retryMenuLoading">
                    ${escapeHTML(t("retry"))}
                </button>
            </div>
        `;
    }

    if (categoryNav) {
        categoryNav.innerHTML = "";
    }

    renderOffers();
    renderCart();
}

}

document.addEventListener("click", event => {
    if (event.target.closest("#retryMenuLoading")) {
        loadDatabaseMenu();
    }
});

    /* =====================================================
       13 — DATABASE CATEGORIES
    ===================================================== */

    function getCategories() {
        return databaseCategories.filter(category =>
            products.some(product =>
                String(product.category_id) === String(category.id)
            )
        );
    }

    function renderCategories(visibleCategories = getCategories()) {
        if (!categoryNav) return;

        categoryNav.innerHTML = visibleCategories
            .map((category, index) => `
                <a
                    href="#falafel-category-${escapeHTML(category.id)}"
                    data-category-id="${escapeHTML(category.id)}"
                    class="${index === 0 ? "active" : ""}"
                >
                    ${escapeHTML(categoryDisplayName(category))}
                </a>
            `)
            .join("");
    }

    /* =====================================================
       14 — PRODUCT VIEW
    ===================================================== */

    function getSavedProductView() {
        return safeStorageGet(PRODUCT_VIEW_KEY, "grid") === "list"
            ? "list"
            : "grid";
    }

    function updateProductView(view) {
        if (!menu) return;

        const isList = view === "list";

        menu.classList.toggle("list-view", isList);

        if (viewToggleButton) {
            viewToggleButton.setAttribute(
                "aria-pressed",
                String(isList)
            );

            viewToggleButton.setAttribute(
                "aria-label",
                isList ? t("listView") : t("gridView")
            );

            viewToggleButton.setAttribute(
                "title",
                isList ? t("listView") : t("gridView")
            );
        }

        if (viewToggleIcon) {
            viewToggleIcon.innerHTML = isList
                ? `
                    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                `
                : `
                    <path d="M4 5h16"></path>
                    <path d="M4 12h16"></path>
                    <path d="M4 19h16"></path>
                `;
        }

        safeStorageSet(
            PRODUCT_VIEW_KEY,
            isList ? "list" : "grid"
        );
    }

    function initializeProductView() {
        updateProductView(getSavedProductView());

        viewToggleButton?.addEventListener("click", () => {
            const isCurrentlyList =
                menu?.classList.contains("list-view");

            updateProductView(
                isCurrentlyList ? "grid" : "list"
            );
        });
    }

    /* =====================================================
       15 — AUTOMATIC DISCOUNT HELPERS
    ===================================================== */

    function automaticRuleForProduct(product) {
        if (!product) return null;

        return getBestAutomaticDiscount(
            product,
            BRANCH_ID,
            product.category_id,
            automaticDiscounts
        );
    }

    function productFinalUnitPrice(product) {
        if (!product) return 0;

        return Math.max(
            0,
            safeNumber(
                priceAfterAutomaticDiscount(
                    safeNumber(product.price),
                    automaticRuleForProduct(product)
                )
            )
        );
    }

    function productAutomaticSaving(product) {
        if (!product) return 0;

        return Math.max(
            0,
            safeNumber(
                automaticDiscountValue(
                    safeNumber(product.price),
                    automaticRuleForProduct(product)
                )
            )
        );
    }

    /* =====================================================
       16 — PRODUCT CARDS
    ===================================================== */

    function productCardHTML(product) {
        const quantity = qtyOf(product.id);
        const image = getProductImage(product);
        const name = productName(product);
        const description = productDescription(product);

        const originalPrice = safeNumber(product.price);
        const finalPrice = productFinalUnitPrice(product);
        const hasDiscount = finalPrice < originalPrice;

        return `
            <article
                class="product-card"
                data-product-id="${escapeHTML(product.id)}"
            >
                <div class="product-image-box">

                    ${
                        image
                            ? `
                                <img
                                    src="${escapeHTML(image)}"
                                    alt="${escapeHTML(name)}"
                                    loading="lazy"
                                    onerror='${imageFallbackHandler()}'
                                >
                            `
                            : ""
                    }

                    <div
                        class="product-placeholder"
                        style="${image ? "display:none" : "display:flex"}"
                    ></div>

                </div>

                <div class="product-details">

                    <h3 class="product-name">
                        ${escapeHTML(name)}
                    </h3>

                    ${
                        description
                            ? `
                                <p class="ghannam-db-description">
                                    ${escapeHTML(description)}
                                </p>
                            `
                            : ""
                    }

                    <div class="product-price">
                        ${
                            hasDiscount
                                ? `
                                    <del>${money(originalPrice)}</del>
                                    <strong>${money(finalPrice)}</strong>
                                `
                                : money(originalPrice)
                        }
                    </div>

                    <button
                        type="button"
                        class="add-to-cart-button"
                        data-add="${escapeHTML(product.id)}"
                        ${orderSubmitting ? "disabled" : ""}
                    >
                        ${
                            quantity
                                ? `${t("addAgain")} (${quantity})`
                                : t("add")
                        }
                    </button>

                </div>
            </article>
        `;
    }

    /* =====================================================
       17 — MENU RENDERING AND SEARCH
    ===================================================== */

    function renderMenu() {
        if (!menu) return;

        const query = currentSearch
            .trim()
            .toLocaleLowerCase();

        const filtered = products.filter(product => {
            const category = getCategory(product.category_id);

            const searchable = [
                product.name,
                product.name_ar,
                product.name_en,
                product.description,
                product.description_ar,
                product.description_en,
                category?.name,
                category?.name_ar,
                category?.name_en,
                category?.slug
            ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase();

            return !query || searchable.includes(query);
        });

        if (!filtered.length) {
            menu.innerHTML = `
                <p class="empty-message">
                    ${escapeHTML(
                        query ? t("emptySearch") : t("empty")
                    )}
                </p>
            `;

            renderCategories([]);
            updateProductView(getSavedProductView());

            return;
        }

        const visibleCategories = getCategories().filter(category =>
            filtered.some(product =>
                String(product.category_id) === String(category.id)
            )
        );

        menu.innerHTML = visibleCategories.map(category => {
            const categoryProducts = filtered.filter(product =>
                String(product.category_id) === String(category.id)
            );

            return `
                <section
                    class="menu-section"
                    id="falafel-category-${escapeHTML(category.id)}"
                >
                    <h2 class="section-title">
                        ${escapeHTML(categoryDisplayName(category))}
                    </h2>

                    <div class="product-grid">
                        ${categoryProducts.map(productCardHTML).join("")}
                    </div>
                </section>
            `;
        }).join("");

        renderCategories(visibleCategories);
        updateProductView(getSavedProductView());
    }

    searchInput?.addEventListener("input", () => {
        currentSearch = searchInput.value || "";
        renderMenu();
    });

    categoryNav?.addEventListener("click", event => {
        const link = event.target.closest("a[data-category-id]");

        if (!link) return;

        $$(".category-nav a").forEach(item => {
            item.classList.toggle("active", item === link);
        });
    });

    /* =====================================================
       18 — DATABASE OFFERS
    ===================================================== */

    function ensureOffersContainer() {
        let section = $("#falafelOffersSection");

        if (!section) {
            section = document.createElement("section");

            section.id = "falafelOffersSection";
            section.className = "falafel-offers-section";
            section.hidden = true;

            section.innerHTML = `
                <div class="falafel-offers-container">

                    <div class="falafel-offers-heading">
                        <div>
                            <h2>${escapeHTML(t("offers"))}</h2>
                            <p>${escapeHTML(t("allPrices"))}</p>
                        </div>
                    </div>

                    <div
                        id="falafelOffersGrid"
                        class="falafel-offers-grid"
                    ></div>

                </div>
            `;
        }

        const menuHeading = $(".menu-heading-row");
        const menuTools = $(".menu-tools");

        if (menuHeading) {
            if (section.previousElementSibling !== menuHeading) {
                menuHeading.insertAdjacentElement("afterend", section);
            }
        } else if (menuTools) {
            if (section.previousElementSibling !== menuTools) {
                menuTools.insertAdjacentElement("afterend", section);
            }
        } else if (menu) {
            if (section.nextElementSibling !== menu) {
                menu.insertAdjacentElement("beforebegin", section);
            }
        } else if (!section.isConnected) {
            document.body.appendChild(section);
        }

        return section;
    }

    function renderOffers() {
        const section = ensureOffersContainer();
        const grid = $("#falafelOffersGrid", section);

        if (!grid) return;

        setText(
            ".falafel-offers-heading h2",
            t("offers"),
            section
        );

        setText(
            ".falafel-offers-heading p",
            t("allPrices"),
            section
        );

        if (!databaseOffers.length) {
            section.hidden = true;
            grid.innerHTML = "";
            return;
        }

        grid.innerHTML = databaseOffers.map(offer => {
            const image = getOfferImage(offer);

            const name = offer.name || "";
            const description = offer.description || "";

            const originalPrice =
                safeNumber(offer.original_price);

            const offerPrice =
                safeNumber(offer.offer_price);

            return `
                <article class="falafel-offer-card">

                    <div class="falafel-offer-image-box">

                        ${
                            image
                                ? `
                                    <img
                                        class="falafel-offer-image"
                                        src="${escapeHTML(image)}"
                                        alt="${escapeHTML(name)}"
                                        loading="lazy"
                                        onerror='${imageFallbackHandler()}'
                                    >
                                `
                                : ""
                        }

                        <div
                            class="falafel-offer-placeholder"
                            style="${image ? "display:none" : "display:flex"}"
                        >
                            🍔
                        </div>

                    </div>

                    <div class="falafel-offer-info">

                        <h3 class="falafel-offer-name">
                            ${escapeHTML(name)}
                        </h3>

                        ${
                            description
                                ? `
                                    <p class="falafel-offer-description">
                                        ${escapeHTML(description)}
                                    </p>
                                `
                                : ""
                        }

                        <div class="falafel-offer-prices">

                            <span class="falafel-offer-current-price">
                                ${money(offerPrice)}
                            </span>

                            ${
                                originalPrice > 0
                                    ? `
                                        <span class="falafel-offer-original-price">
                                            ${money(originalPrice)}
                                        </span>
                                    `
                                    : ""
                            }

                        </div>

                    </div>

                </article>
            `;
        }).join("");

        section.hidden = false;
    }

    /* =====================================================
       19 — CART CALCULATIONS

       Contract:
       - originalSubtotal: before automatic discounts
       - automaticDiscountAmount: automatic savings
       - subtotal: after automatic discounts
       - couponDiscountAmount: coupon only
       - grandTotal: subtotal - coupon discount

       The database remains the final authority.
    ===================================================== */

    function qtyOf(id) {
        return cart.find(row =>
            String(row.id) === String(id)
        )?.qty || 0;
    }

    function totalQty() {
        return cart.reduce(
            (sum, row) => sum + row.qty,
            0
        );
    }

    function originalSubtotal() {
        return cart.reduce((sum, row) => {
            const product = getProduct(row.id);

            return sum + (
                product
                    ? safeNumber(product.price) * row.qty
                    : 0
            );
        }, 0);
    }

    function automaticDiscountAmount() {
        return cart.reduce((sum, row) => {
            const product = getProduct(row.id);

            return sum + (
                product
                    ? productAutomaticSaving(product) * row.qty
                    : 0
            );
        }, 0);
    }

    function subtotal() {
        return Math.max(
            0,
            originalSubtotal() - automaticDiscountAmount()
        );
    }

    function couponDiscountAmount() {
        if (!activeCoupon) return 0;

        return Math.min(
            subtotal(),
            Math.max(0, safeNumber(couponPreviewAmount))
        );
    }

    function discountAmount() {
        return couponDiscountAmount();
    }

    function grandTotal() {
        return Math.max(
            0,
            subtotal() - couponDiscountAmount()
        );
    }

    /* =====================================================
       20 — ADD AND CHANGE PRODUCTS
    ===================================================== */

    function addToCart(id, amount = 1) {
        if (orderSubmitting) return;

        const product = getProduct(id);

        if (!product || product.is_available === false) {
            return;
        }

        const row = cart.find(item =>
            String(item.id) === String(id)
        );

        const increment = Math.max(
            1,
            Math.floor(safeNumber(amount))
        );

        if (row) {
            row.qty = Math.min(99, row.qty + increment);
        } else {
            cart.push({
                id: String(product.id),
                qty: Math.min(99, increment)
            });
        }

        saveCart();

        // A previously validated coupon must be revalidated
        // whenever the cart amount changes.
        if (activeCoupon) {
            validateActiveCoupon();
        }

        renderMenu();
        renderCart();
        playBellSound();
    }

    function changeQty(id, amount) {
        if (orderSubmitting) return;

        const row = cart.find(item =>
            String(item.id) === String(id)
        );

        if (!row) return;

        row.qty += safeNumber(amount);

        if (row.qty <= 0) {
            cart = cart.filter(item =>
                String(item.id) !== String(id)
            );
        } else {
            row.qty = Math.min(99, row.qty);
        }

        saveCart();

        if (!cart.length) {
            activeCoupon = "";
            couponPreviewAmount = 0;
            safeStorageRemove(COUPON_KEY);
        } else if (activeCoupon) {
            validateActiveCoupon();
        }

        renderMenu();
        renderCart();
    }

    function removeFromCart(id) {
        if (orderSubmitting) return;

        cart = cart.filter(row =>
            String(row.id) !== String(id)
        );

        saveCart();

        if (!cart.length) {
            activeCoupon = "";
            couponPreviewAmount = 0;
            safeStorageRemove(COUPON_KEY);
        } else if (activeCoupon) {
            validateActiveCoupon();
        }

        renderMenu();
        renderCart();
    }

    /* =====================================================
       21 — ADD TO CART BELL SOUND
    ===================================================== */

    function playBellSound() {
        try {
            const AudioContextClass =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContextClass) return;

            if (
                !audioContext ||
                audioContext.state === "closed"
            ) {
                audioContext = new AudioContextClass();
            }

            const play = () => {
                const now = audioContext.currentTime;

                [1046.5, 1318.5].forEach((frequency, index) => {
                    const oscillator =
                        audioContext.createOscillator();

                    const gain =
                        audioContext.createGain();

                    const start = now + index * 0.09;

                    oscillator.type = "sine";

                    oscillator.frequency.setValueAtTime(
                        frequency,
                        start
                    );

                    gain.gain.setValueAtTime(0.0001, start);

                    gain.gain.exponentialRampToValueAtTime(
                        0.25,
                        start + 0.02
                    );

                    gain.gain.exponentialRampToValueAtTime(
                        0.0001,
                        start + 0.55
                    );

                    oscillator.connect(gain);
                    gain.connect(audioContext.destination);

                    oscillator.start(start);
                    oscillator.stop(start + 0.6);
                });
            };

            if (audioContext.state === "suspended") {
                audioContext.resume()
                    .then(play)
                    .catch(() => {});
            } else {
                play();
            }

        } catch (error) {
            console.warn("تعذر تشغيل صوت الجرس:", error);
        }
    }

    /* =====================================================
       22 — CART RENDERING
    ===================================================== */

    function renderCart() {
        const count = totalQty();

        const original = originalSubtotal();
        const automaticDiscount = automaticDiscountAmount();
        const sub = subtotal();
        const couponDiscount = couponDiscountAmount();
        const total = grandTotal();

        const countText =
            `${count} ${count === 1 ? t("item") : t("items")}`;

        setText("#cartCount", countText);
        setText("#falafelTotal", money(total));
        setText("#fixedCartCount", count);

        setText(
            "#fixedCartSubtitle",
            count
                ? `${countText} ${t("inCart")}`
                : t("emptyCart")
        );

        setText("#fixedCartTotal", money(total));
        setText("#popupSubtotal", money(sub));
        setText("#popupDiscount", `-${money(couponDiscount)}`);
        setText("#popupGrandTotal", money(total));
        setText("#popupFooterTotal", money(total));

        const automaticSavingElement = $("#popupAutomaticDiscount");

        if (automaticSavingElement) {
            automaticSavingElement.textContent =
                `-${money(automaticDiscount)}`;
        }

        const originalElement = $("#popupOriginalSubtotal");

        if (originalElement) {
            originalElement.textContent = money(original);
        }

        if (popupItems) {
            popupItems.innerHTML = cart.length
                ? cart.map(row => {
                    const product = getProduct(row.id);

                    if (!product) return "";

                    const originalPrice = safeNumber(product.price);
                    const finalPrice = productFinalUnitPrice(product);
                    const hasDiscount = finalPrice < originalPrice;

                    return `
                        <div class="cart-item">

                            <div class="cart-item-info">

                                <div class="cart-item-name">
                                    ${escapeHTML(productName(product))}
                                </div>

                                <div class="cart-item-price">
                                    ${
                                        hasDiscount
                                            ? `
                                                <del>${money(originalPrice)}</del>
                                                <strong>${money(finalPrice)}</strong>
                                            `
                                            : money(originalPrice)
                                    }
                                    × ${row.qty}
                                </div>

                            </div>

                            <div class="quantity-controls">

                                <button
                                    type="button"
                                    data-qty="${escapeHTML(row.id)}"
                                    data-delta="-1"
                                    aria-label="${escapeHTML(t("decrease"))}"
                                    ${orderSubmitting ? "disabled" : ""}
                                >−</button>

                                <strong>${row.qty}</strong>

                                <button
                                    type="button"
                                    data-qty="${escapeHTML(row.id)}"
                                    data-delta="1"
                                    aria-label="${escapeHTML(t("increase"))}"
                                    ${orderSubmitting ? "disabled" : ""}
                                >+</button>

                                <button
                                    type="button"
                                    data-remove="${escapeHTML(row.id)}"
                                    aria-label="${escapeHTML(t("remove"))}"
                                    ${orderSubmitting ? "disabled" : ""}
                                >×</button>

                            </div>

                        </div>
                    `;
                }).join("")
                : `
                    <p class="empty-message">
                        ${escapeHTML(t("emptyCart"))}
                    </p>
                `;
        }

        const legacyItems = $("#falafelCartItems");

        if (legacyItems) {
            legacyItems.innerHTML = cart.map(row => {
                const product = getProduct(row.id);

                return product
                    ? `
                        <p>
                            ${escapeHTML(productName(product))}
                            × ${row.qty}
                        </p>
                    `
                    : "";
            }).join("");
        }

        renderAddons();
    }

    /* =====================================================
       23 — SUGGESTED ADD-ONS
    ===================================================== */

    function renderAddons() {
        if (!addonsList) return;

        const suggestions = products.filter(product => {
            const category = getCategory(product.category_id);

            const categoryText = [
                category?.name,
                category?.name_ar,
                category?.name_en,
                category?.slug
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const isExtra =
                categoryText.includes("إضاف") ||
                categoryText.includes("اضاف") ||
                categoryText.includes("extra") ||
                categoryText.includes("side") ||
                categoryText.includes("مشروب") ||
                categoryText.includes("drink");

            return isExtra && !cart.some(row =>
                String(row.id) === String(product.id)
            );
        });

        if (!suggestions.length) {
            addonsList.innerHTML = `
                <p class="addons-loading">
                    ${escapeHTML(t("noAddons"))}
                </p>
            `;

            return;
        }

        addonsList.innerHTML = `
            <div class="addons-grid">

                ${suggestions.map(product => {
                    const image = getProductImage(product);

                    return `
                        <div class="addon-card">

                            ${
                                image
                                    ? `
                                        <img
                                            class="addon-image"
                                            src="${escapeHTML(image)}"
                                            alt="${escapeHTML(productName(product))}"
                                            loading="lazy"
                                        >
                                    `
                                    : ""
                            }

                            <strong>
                                ${escapeHTML(productName(product))}
                            </strong>

                            <span>${money(productFinalUnitPrice(product))}</span>

                            <button
                                type="button"
                                data-addon="${escapeHTML(product.id)}"
                                ${orderSubmitting ? "disabled" : ""}
                            >
                                ${escapeHTML(t("addAddon"))}
                            </button>

                        </div>
                    `;
                }).join("")}

            </div>
        `;
    }

    /* =====================================================
       24 — CART MODAL
    ===================================================== */

    function openCart() {
        if (!cartOverlay) return;

        lastCartFocus = document.activeElement;

        cartOverlay.hidden = false;

        document.body.classList.add("cart-modal-open");

        $("#closeCartModal")?.focus();
    }

    function closeCart() {
        if (!cartOverlay || cartOverlay.hidden) return;

        cartOverlay.hidden = true;

        document.body.classList.remove("cart-modal-open");

        if (lastCartFocus?.isConnected) {
            lastCartFocus.focus();
        } else {
            fixedCartBar?.focus();
        }
    }

    fixedCartBar?.addEventListener("click", openCart);

    $("#closeCartModal")?.addEventListener("click", closeCart);

    $("#continueShoppingButton")?.addEventListener(
        "click",
        closeCart
    );

    cartOverlay?.addEventListener("click", event => {
        if (event.target === cartOverlay) {
            closeCart();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            cartOverlay &&
            !cartOverlay.hidden
        ) {
            closeCart();
        }
    });

    /* =====================================================
       25 — SERVER-SIDE COUPON VALIDATION

       The browser does not decide whether a coupon is valid.
       validate_customer_coupon is used for preview only.
       create_order_secure validates it again when saving.
    ===================================================== */

    function readCouponValidationResult(data) {
        let result = data;

        if (Array.isArray(result)) {
            result = result[0] ?? null;
        }

        if (result && typeof result === "object" && result.data) {
            result = result.data;
        }

        if (typeof result === "string") {
            try {
                result = JSON.parse(result);
            } catch {
                return null;
            }
        }

        return result && typeof result === "object"
            ? result
            : null;
    }

    function couponResultIsValid(result) {
        if (!result) return false;

        if (result.success === false) return false;
        if (result.valid === false) return false;
        if (result.is_valid === false) return false;

        if (
            result.success === true ||
            result.valid === true ||
            result.is_valid === true
        ) {
            return true;
        }

        // Some versions of the validation RPC return a
        // discount amount without a separate valid flag.
        return (
            result.discount_amount != null ||
            result.discount_value != null
        );
    }

    async function requestCouponValidation(code) {
        if (!configured || !supabase) {
            throw new Error("الاتصال بقاعدة البيانات غير متاح");
        }

        const { data, error } = await supabase.rpc(
            "validate_customer_coupon",
            {
                p_code: code,
                p_branch_id: BRANCH_ID,
                p_subtotal: subtotal()
            }
        );

        if (error) throw error;

        return readCouponValidationResult(data);
    }

    async function validateActiveCoupon() {
        const code = normalizeCouponCode(activeCoupon);
        const sequence = ++couponValidationSequence;

        if (!code || !cart.length || subtotal() <= 0) {
            couponPreviewAmount = 0;
            renderCart();
            return false;
        }

        try {
            const result = await requestCouponValidation(code);

            if (sequence !== couponValidationSequence) {
                return false;
            }

            if (!couponResultIsValid(result)) {
                activeCoupon = "";
                couponPreviewAmount = 0;

                safeStorageRemove(COUPON_KEY);

                if (couponStatus) {
                    couponStatus.textContent =
                        result?.message ||
                        result?.error ||
                        t("invalidCoupon");

                    couponStatus.style.color = "#a33";
                }

                renderCart();
                return false;
            }

            couponPreviewAmount = Math.max(
                0,
                safeNumber(
                    result.discount_amount ??
                    result.discount_value ??
                    result.calculated_discount ??
                    0
                )
            );

            if (couponStatus) {
                couponStatus.textContent =
                    result.message || t("applied");

                couponStatus.style.color = "#18864b";
            }

            renderCart();
            return true;

        } catch (error) {
            if (sequence !== couponValidationSequence) {
                return false;
            }

            console.error("فشل التحقق من الكوبون:", error);

            activeCoupon = "";
            couponPreviewAmount = 0;

            safeStorageRemove(COUPON_KEY);

            if (couponStatus) {
                couponStatus.textContent =
                    currentLanguage === "en"
                        ? `Could not validate coupon: ${getErrorMessage(error)}`
                        : `تعذر التحقق من الكوبون: ${getErrorMessage(error)}`;

                couponStatus.style.color = "#a33";
            }

            renderCart();
            return false;
        }
    }

    async function applyCoupon() {
        const code = normalizeCouponCode(couponInput?.value);

        if (!code) {
            activeCoupon = "";
            couponPreviewAmount = 0;

            safeStorageRemove(COUPON_KEY);

            if (couponStatus) {
                couponStatus.textContent = t("enterCoupon");
                couponStatus.style.color = "#a33";
            }

            renderCart();
            return;
        }

        if (!cart.length || subtotal() <= 0) {
            if (couponStatus) {
                couponStatus.textContent = t("couponNeedItems");
                couponStatus.style.color = "#a33";
            }

            return;
        }

        if (!configured || !supabase) {
            if (couponStatus) {
                couponStatus.textContent =
                    currentLanguage === "en"
                        ? "Database connection unavailable."
                        : "الاتصال بقاعدة البيانات غير متاح.";

                couponStatus.style.color = "#a33";
            }

            return;
        }

        const sequence = ++couponValidationSequence;

        if (couponStatus) {
            couponStatus.textContent = t("validatingCoupon");
            couponStatus.style.color = "";
        }

        try {
            const result = await requestCouponValidation(code);

            if (sequence !== couponValidationSequence) return;

            if (!couponResultIsValid(result)) {
                activeCoupon = "";
                couponPreviewAmount = 0;

                safeStorageRemove(COUPON_KEY);

                if (couponStatus) {
                    couponStatus.textContent =
                        result?.message ||
                        result?.error ||
                        t("invalidCoupon");

                    couponStatus.style.color = "#a33";
                }

                renderCart();
                return;
            }

            activeCoupon = code;

            couponPreviewAmount = Math.max(
                0,
                safeNumber(
                    result.discount_amount ??
                    result.discount_value ??
                    result.calculated_discount ??
                    0
                )
            );

            safeStorageSet(COUPON_KEY, activeCoupon);

            if (couponStatus) {
                couponStatus.textContent =
                    result.message || t("applied");

                couponStatus.style.color = "#18864b";
            }

            renderCart();

        } catch (error) {
            if (sequence !== couponValidationSequence) return;

            console.error("خطأ تطبيق الكوبون:", error);

            activeCoupon = "";
            couponPreviewAmount = 0;

            safeStorageRemove(COUPON_KEY);

            if (couponStatus) {
                couponStatus.textContent =
                    currentLanguage === "en"
                        ? `Coupon validation failed: ${getErrorMessage(error)}`
                        : `فشل التحقق من الكوبون: ${getErrorMessage(error)}`;

                couponStatus.style.color = "#a33";
            }

            renderCart();
        }
    }

    $("#applyCouponButton")?.addEventListener(
        "click",
        applyCoupon
    );

    couponInput?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            applyCoupon();
        }
    });

    function loadCoupon() {
        return normalizeCouponCode(
            safeStorageGet(COUPON_KEY, "")
        );
    }

    /* =====================================================
       26 — SECURE ORDER CREATION

       IMPORTANT:
       We send only:
       - product_id
       - quantity

       The database determines:
       - product availability
       - branch ownership
       - official prices
       - product options
       - automatic discounts
       - coupon eligibility
       - coupon usage limits
       - subtotal
       - discount_amount
       - total

       No direct INSERT into orders is used here.
    ===================================================== */

    function getRpcOrderResult(data) {
        let result = data;

        if (Array.isArray(result)) {
            result = result[0] ?? null;
        }

        if (typeof result === "string") {
            try {
                result = JSON.parse(result);
            } catch {
                return null;
            }
        }

        return result && typeof result === "object"
            ? result
            : null;
    }

    function buildWhatsAppMessage(order, customer) {
        const savedItems = Array.isArray(order.items)
            ? order.items
            : [];

        const lines = savedItems.map(item => {
            const itemName = currentLanguage === "en"
                ? (item.name_en || item.name || "")
                : (item.name || item.name_en || "");

            const quantity = safeNumber(item.quantity);
            const itemTotal = safeNumber(item.total);

            return `• ${itemName} × ${quantity} = ${money(itemTotal)}`;
        });

        const subtotalAfterAutomatic =
            safeNumber(order.subtotal);

        const couponDiscount =
            safeNumber(order.discount_amount);

        const finalTotal =
            safeNumber(order.total);

        const automaticSaving = savedItems.reduce(
            (sum, item) =>
                sum + (
                    safeNumber(item.automatic_discount_amount) *
                    safeNumber(item.quantity)
                ),
            0
        );

        return [
            t("orderTitle"),
            `رقم الطلب: #${order.order_number}`,
            `${t("name")}: ${customer.name}`,
            `${t("phone")}: ${customer.phone}`,
            `${t("address")}: ${customer.address}`,
            "",
            `${t("details")}:`,
            ...lines,
            "",
            `${t("subtotal")}: ${money(subtotalAfterAutomatic)}`,
            `${t("automaticDiscount")}: ${money(automaticSaving)}`,
            `${t("discount")}: ${money(couponDiscount)}`,
            `${t("total")}: ${money(finalTotal)}`,
            `${t("coupon")}: ${order.coupon_code || t("noCoupon")}`,
            `${t("notes")}: ${customer.notes || t("noNotes")}`,
            "",
            `${t("branchNumbers")}: ${WHATSAPP_NUMBERS.join(" — ")}`
        ].join("\n");
    }

    async function createSecureOrder(customer, orderCart, orderCoupon) {
        const rpcItems = orderCart.map(row => ({
            product_id: String(row.id),
            quantity: clampQuantity(row.qty)
        }));

        const { data, error } = await supabase.rpc(
            "create_order_secure",
            {
                p_branch_id: BRANCH_ID,
                p_customer_name: customer.name,
                p_customer_phone: customer.phone,
                p_items: rpcItems,
                p_customer_address: customer.address || null,
                p_customer_notes: customer.notes || null,
                p_coupon_code: orderCoupon || null,
                p_customer_location_url: null
            }
        );

        if (error) throw error;

        const result = getRpcOrderResult(data);

        if (!result) {
            throw new Error(
                "لم تُرجع قاعدة البيانات بيانات الطلب."
            );
        }

        if (result.success !== true) {
            throw new Error(
                result.message ||
                result.error ||
                "لم تتم الموافقة على إنشاء الطلب."
            );
        }

        if (!result.order_id || !result.order_number) {
            throw new Error(
                "تم استدعاء الدالة، لكن بيانات الطلب المرجعة غير مكتملة."
            );
        }

        if (!Array.isArray(result.items)) {
            throw new Error(
                "لم تُرجع قاعدة البيانات تفاصيل المنتجات المحفوظة."
            );
        }

        return result;
    }

    /* =====================================================
       27 — SUBMIT ORDER
    ===================================================== */

    async function submitOrder(event) {
        event.preventDefault();

        if (orderSubmitting) return;

        const form = event.currentTarget;

        if (!cart.length) {
            setText("#popupOrderStatus", t("cartEmptyOrder"));
            return;
        }

        if (!form.reportValidity()) return;

        const name =
            $("#popupCustomerName")?.value.trim() || "";

        const phone =
            $("#popupCustomerPhone")?.value.trim() || "";

        const address =
            $("#popupCustomerAddress")?.value.trim() || "";

        const notes =
            $("#popupCustomerNotes")?.value.trim() || "";

        if (!name || !phone || !address) return;

        if (!configured || !supabase) {
            setText(
                "#popupOrderStatus",
                currentLanguage === "en"
                    ? "The database connection is unavailable. Your order was not saved."
                    : "الاتصال بقاعدة البيانات غير متاح. لم يتم حفظ طلبك."
            );

            return;
        }

        // Fixed snapshot: cart changes cannot affect this order.
        const orderCart = cart.map(row => ({
            id: String(row.id),
            qty: clampQuantity(row.qty)
        }));

        const orderCoupon = activeCoupon;

        const customer = {
            name,
            phone,
            address,
            notes
        };

        let whatsappWindow = null;
        let submitButton = form.querySelector(
            'button[type="submit"], input[type="submit"]'
        );

        const originalButtonText =
            submitButton?.textContent || "";

        let savedOrder = null;

        orderSubmitting = true;

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.setAttribute("aria-busy", "true");
            submitButton.textContent = t("savingOrder");
        }

        renderMenu();
        renderCart();

        setText(
            "#popupOrderStatus",
            t("savingOrder")
        );

        // Open a blank tab during the user gesture.
        // It receives the WhatsApp URL only after the RPC succeeds.
        try {
            whatsappWindow = window.open("about:blank", "_blank");
        } catch (popupError) {
            console.warn(
                "تعذر فتح نافذة واتساب مسبقاً:",
                popupError
            );
        }

        try {
            savedOrder = await createSecureOrder(
                customer,
                orderCart,
                orderCoupon
            );

            // Clear cart only after Supabase confirms success.
            cart = [];
            saveCart();

            activeCoupon = "";
            couponPreviewAmount = 0;

            safeStorageRemove(COUPON_KEY);

            if (couponInput) {
                couponInput.value = "";
            }

            if (couponStatus) {
                couponStatus.textContent = "";
                couponStatus.style.color = "";
            }

            renderMenu();
            renderCart();

            const message = buildWhatsAppMessage(
                savedOrder,
                customer
            );

            const waNumber = WHATSAPP_NUMBERS[0]
                .replace(/\D/g, "")
                .replace(/^0/, "");

            const whatsappUrl =
                `https://wa.me/964${waNumber}?text=${encodeURIComponent(message)}`;

            if (whatsappWindow && !whatsappWindow.closed) {
                whatsappWindow.location.href = whatsappUrl;

                setText(
                    "#popupOrderStatus",
                    `${t("orderSaved")} #${savedOrder.order_number}. ${t("whatsappSaved")}`
                );
            } else {
                setText(
                    "#popupOrderStatus",
                    `${t("orderSaved")} #${savedOrder.order_number}. ${t("whatsappBlocked")}`
                );

                // The order is already saved. Do not report failure.
                const fallbackLink = document.createElement("a");

                fallbackLink.href = whatsappUrl;
                fallbackLink.target = "_blank";
                fallbackLink.rel = "noopener noreferrer";
                fallbackLink.textContent =
                    currentLanguage === "en"
                        ? "Open WhatsApp"
                        : "فتح واتساب";

                fallbackLink.className = "whatsapp-fallback-link";

                const statusElement = $("#popupOrderStatus");

                if (statusElement) {
                    statusElement.append(" ");
                    statusElement.appendChild(fallbackLink);
                }
            }

            console.info(
                "تم إنشاء الطلب الآمن بنجاح",
                {
                    order_id: savedOrder.order_id,
                    order_number: savedOrder.order_number,
                    subtotal: savedOrder.subtotal,
                    discount_amount: savedOrder.discount_amount,
                    total: savedOrder.total
                }
            );

        } catch (error) {
            console.error(
                "فشل إنشاء طلب فرع الفلافل:",
                error
            );

            if (whatsappWindow && !whatsappWindow.closed) {
                try {
                    whatsappWindow.close();
                } catch (closeError) {
                    console.warn(
                        "تعذر إغلاق نافذة واتساب:",
                        closeError
                    );
                }
            }

            const detail = getErrorMessage(error);

            setText(
                "#popupOrderStatus",
                currentLanguage === "en"
                    ? `${t("orderSaveFailed")} (${detail})`
                    : `${t("orderSaveFailed")} (${detail})`
            );

            // Keep the cart and coupon unchanged on failure.

        } finally {
            orderSubmitting = false;

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.removeAttribute("aria-busy");
                submitButton.textContent =
                    originalButtonText || t("send");
            }

            renderMenu();
            renderCart();
        }
    }

    $("#popupOrderForm")?.addEventListener(
        "submit",
        submitOrder
    );

    $("#falafelOrderForm")?.addEventListener(
        "submit",
        event => event.preventDefault()
    );

    /* =====================================================
       28 — GLOBAL PRODUCT AND CART EVENTS
    ===================================================== */

    document.addEventListener("click", event => {
        const target = event.target;

        if (!(target instanceof Element)) return;

        const addButton = target.closest("[data-add]");

        if (addButton) {
            addToCart(addButton.dataset.add);
            return;
        }

        const quantityButton = target.closest("[data-qty]");

        if (quantityButton) {
            changeQty(
                quantityButton.dataset.qty,
                Number(quantityButton.dataset.delta)
            );

            return;
        }

        const removeButton = target.closest("[data-remove]");

        if (removeButton) {
            removeFromCart(removeButton.dataset.remove);
            return;
        }

        const addonButton = target.closest("[data-addon]");

        if (addonButton) {
            addToCart(addonButton.dataset.addon);
        }
    });


/* =====================================================
   29 — INITIALIZE PAGE
===================================================== */

async function initializeFalafelPage() {
    applyStaticTranslations();

    initializeProductView();

    activeCoupon = loadCoupon();

    if (activeCoupon && couponInput) {
        couponInput.value = activeCoupon;

        if (couponStatus) {
            couponStatus.textContent = t("validatingCoupon");
            couponStatus.style.color = "";
        }
    }

    ensureOffersContainer();

    await loadDatabaseMenu();

    // Revalidate any saved coupon against the current cart
    // and current customer session.
    if (activeCoupon && cart.length) {
        await validateActiveCoupon();
    }

    // Refresh automatic discounts periodically.
    // Use cached data instead of forcing a Supabase request.
    // Prevent creating duplicate intervals.
    if (!window.__falafelDiscountRefreshTimer) {
        window.__falafelDiscountRefreshTimer = window.setInterval(async () => {
            try {
                const discounts = await loadBranchDiscounts(
                    BRANCH_ID,
                    false
                );

                automaticDiscounts = Array.isArray(discounts)
                    ? discounts
                    : [];

                renderMenu();

                if (activeCoupon) {
                    await validateActiveCoupon();
                }

                renderCart();

            } catch (error) {
                console.warn(
                    "تعذر تحديث الخصومات التلقائية:",
                    error
                );
            }
        }, 5 * 60 * 1000);
    }
}

initializeFalafelPage();

})();
