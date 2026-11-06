
/* =========================================================
   مطعم الغنّام — فرع الفلافل
   FALAFEL BRANCH — DATABASE DRIVEN

   FEATURES:
   - Supabase categories / products / offers
   - Full Arabic / English interface
   - RTL / LTR automatic direction
   - Static page translation
   - Settings panel translation
   - Search and category navigation
   - Grid / horizontal product view
   - Cart and quantity management
   - Suggested add-ons
   - Coupon GHANNAM15
   - WhatsApp ordering
   - Add-to-cart bell sound
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

    const COUPON_CODE = "GHANNAM15";
    const COUPON_RATE = 0.15;

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
            extras: "إضافات من المنيو",
            addToOrder: "أضف إلى طلبك",
            addAddon: "أضف للسلة",
            noAddons: "لا توجد إضافات أخرى متاحة.",
            scrollBrowse: "اسحب للتصفح ←",
            coupon: "🎟️ كود الخصم",
            couponPlaceholder: "أدخل كود الخصم",
            apply: "تطبيق",
            invalidCoupon: "الكود غير صحيح.",
            enterCoupon: "أدخل كود الخصم أولاً.",
            applied: "تم تطبيق خصم 15% بنجاح.",
            couponNeedItems: "أضف منتجات إلى السلة أولاً.",
            subtotal: "المجموع الفرعي",
            discount: "الخصم",
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
            closeMenu: "إغلاق القائمة",
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
            listView: "التبديل إلى عرض البطاقات"
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
            extras: "Menu Add-ons",
            addToOrder: "Add to Your Order",
            addAddon: "Add to Cart",
            noAddons: "No additional items available.",
            scrollBrowse: "Scroll to browse →",
            coupon: "🎟️ Discount Code",
            couponPlaceholder: "Enter discount code",
            apply: "Apply",
            invalidCoupon: "Invalid discount code.",
            enterCoupon: "Please enter the discount code.",
            applied: "15% discount applied successfully.",
            couponNeedItems: "Add products to your cart first.",
            subtotal: "Subtotal",
            discount: "Discount",
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
            closeMenu: "Close Menu",
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
            listView: "Switch to Grid View"
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
    let databaseCategories = [];
    let databaseOffers = [];

    let currentSearch = "";
    let cart = [];
    let activeCoupon = "";

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
            return product.name_en ||
                product.name_ar ||
                product.name ||
                "";
        }

        return product.name_ar ||
            product.name ||
            "";
    }

    function productDescription(product) {
        if (currentLanguage === "en") {
            return product.description_en ||
                product.description_ar ||
                product.description ||
                "";
        }

        return product.description_ar ||
            product.description ||
            "";
    }

    function categoryDisplayName(category) {
        if (currentLanguage === "en") {
            return category.name_en ||
                category.name_ar ||
                category.name ||
                "";
        }

        return category.name_ar ||
            category.name ||
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
            product.image_url,
            product.image_path,
            product.extra?.local_image_path
        ]
            .map(normalizeDatabaseImage)
            .find(Boolean) || "";
    }

    function getOfferImage(offer) {
        return [
            offer.image_url,
            offer.image_path
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
       Header / Cart / Settings / Footer / Page labels
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

        /* Settings panel header */
        setText("#settingsPanelTitle", t("sideMenuTitle"));
        setText(".settings-heading p", t("cartBranch"));
        setAttribute("#closeSettingsPanel", "aria-label", t("close"));

        /* Settings section headings */
        const settingsHeadings =
            $$(".settings-panel .settings-section-title");

        if (settingsHeadings[0]) {
            settingsHeadings[0].textContent = t("navigationTitle");
        }

        if (settingsHeadings[1]) {
            settingsHeadings[1].textContent = t("restaurantInfo");
        }

        /* Settings menu items */
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

        /* Restaurant info cards */
        const infoCards = $$(".settings-info-card");

        if (infoCards[0]) {
            setText("strong", t("restaurant"), infoCards[0]);
            setText("p", t("branch"), infoCards[0]);
        }

        if (infoCards[1]) {
            setText("strong", t("currency"), infoCards[1]);
            setText("p", t("iraqiCurrency"), infoCards[1]);
        }

        /* Help link */
        const helpLink = $('a[href="support/support.html"]');

        if (helpLink) {
            setText("strong", t("helpComplaints"), helpLink);
            setText("small", t("helpDescription"), helpLink);
        }

        /* Branch phone card */
        const phoneCard =
            $(".settings-compact-card:not(.settings-location-link)");

        if (phoneCard) {
            setText("strong", t("branchNumbers"), phoneCard);
        }

        /* Branch location */
        const locationCard = $(".settings-location-link");

        if (locationCard) {
            setText("strong", t("branchLocation"), locationCard);
            setText("small", t("locationDescription"), locationCard);

            locationCard.setAttribute(
                "aria-label",
                t("openMap")
            );
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

        /* Offers heading */
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

        /* Product view accessibility */
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

        // Reload products and categories using the selected language.
        await loadDatabaseMenu();

        // Refresh cart labels and product names.
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

            // Ignore old requests when the user changes language quickly.
            if (sequence !== menuLoadSequence) return;

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
                        product.description_en || "",

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
                    language: currentLanguage
                }
            );

        } catch (error) {
            if (sequence !== menuLoadSequence) return;

            console.error("خطأ تحميل المنيو:", error);

            products = [];
            databaseCategories = [];
            databaseOffers = [];

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
       15 — PRODUCT CARDS
    ===================================================== */

    function productCardHTML(product) {
        const quantity = qtyOf(product.id);
        const image = getProductImage(product);
        const name = productName(product);
        const description = productDescription(product);

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
                        ${money(product.price)}
                    </div>

                    <button
                        type="button"
                        class="add-to-cart-button"
                        data-add="${escapeHTML(product.id)}"
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
       16 — MENU RENDERING AND SEARCH
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
       17 — DATABASE OFFERS
       Position: below menu heading and above products.
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
                menuHeading.insertAdjacentElement(
                    "afterend",
                    section
                );
            }
        } else if (menuTools) {
            if (section.previousElementSibling !== menuTools) {
                menuTools.insertAdjacentElement(
                    "afterend",
                    section
                );
            }
        } else if (menu) {
            if (section.nextElementSibling !== menu) {
                menu.insertAdjacentElement(
                    "beforebegin",
                    section
                );
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

            // The current offers query supplies name and description.
            // English offer fields are not assumed to exist.
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
       18 — CART CALCULATIONS
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

    function subtotal() {
        return cart.reduce((sum, row) => {
            const product = getProduct(row.id);

            return sum + (
                product
                    ? safeNumber(product.price) * row.qty
                    : 0
            );
        }, 0);
    }

    function discountAmount() {
        return activeCoupon
            ? Math.round(subtotal() * COUPON_RATE)
            : 0;
    }

    function grandTotal() {
        return Math.max(
            0,
            subtotal() - discountAmount()
        );
    }

    /* =====================================================
       19 — ADD AND CHANGE PRODUCTS
    ===================================================== */

    function addToCart(id, amount = 1) {
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
            row.qty = Math.min(
                99,
                row.qty + increment
            );
        } else {
            cart.push({
                id: String(product.id),
                qty: Math.min(99, increment)
            });
        }

        saveCart();
        renderMenu();
        renderCart();
        playBellSound();
    }

    function changeQty(id, amount) {
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
        renderMenu();
        renderCart();
    }

    function removeFromCart(id) {
        cart = cart.filter(row =>
            String(row.id) !== String(id)
        );

        saveCart();
        renderMenu();
        renderCart();
    }

    /* =====================================================
       20 — ADD TO CART BELL SOUND
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

                    gain.gain.setValueAtTime(
                        0.0001,
                        start
                    );

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
            console.warn(
                "تعذر تشغيل صوت الجرس:",
                error
            );
        }
    }

    /* =====================================================
       21 — CART RENDERING
    ===================================================== */

    function renderCart() {
        const count = totalQty();

        const sub = subtotal();
        const discount = discountAmount();
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
        setText("#popupDiscount", money(discount));
        setText("#popupGrandTotal", money(total));
        setText("#popupFooterTotal", money(total));

        if (popupItems) {
            popupItems.innerHTML = cart.length
                ? cart.map(row => {
                    const product = getProduct(row.id);

                    if (!product) return "";

                    return `
                        <div class="cart-item">

                            <div class="cart-item-info">

                                <div class="cart-item-name">
                                    ${escapeHTML(productName(product))}
                                </div>

                                <div class="cart-item-price">
                                    ${money(product.price * row.qty)}
                                </div>

                            </div>

                            <div class="quantity-controls">

                                <button
                                    type="button"
                                    data-qty="${escapeHTML(row.id)}"
                                    data-delta="-1"
                                    aria-label="${escapeHTML(t("decrease"))}"
                                >−</button>

                                <strong>${row.qty}</strong>

                                <button
                                    type="button"
                                    data-qty="${escapeHTML(row.id)}"
                                    data-delta="1"
                                    aria-label="${escapeHTML(t("increase"))}"
                                >+</button>

                                <button
                                    type="button"
                                    data-remove="${escapeHTML(row.id)}"
                                    aria-label="${escapeHTML(t("remove"))}"
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
       22 — SUGGESTED ADD-ONS
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

                            <span>${money(product.price)}</span>

                            <button
                                type="button"
                                data-addon="${escapeHTML(product.id)}"
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
       23 — CART MODAL
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

    $("#closeCartModal")?.addEventListener(
        "click",
        closeCart
    );

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
       24 — COUPON
    ===================================================== */

    function loadCoupon() {
        const code = safeStorageGet(COUPON_KEY, "")
            .trim()
            .toUpperCase();

        return code === COUPON_CODE ? code : "";
    }

    function applyCoupon() {
        const code = (couponInput?.value || "")
            .trim()
            .toUpperCase();

        if (code === COUPON_CODE) {
            if (subtotal() <= 0) {
                if (couponStatus) {
                    couponStatus.textContent =
                        t("couponNeedItems");

                    couponStatus.style.color = "#a33";
                }

                return;
            }

            activeCoupon = COUPON_CODE;

            safeStorageSet(COUPON_KEY, activeCoupon);

            if (couponStatus) {
                couponStatus.textContent = t("applied");
                couponStatus.style.color = "#18864b";
            }

        } else if (!code) {
            activeCoupon = "";

            safeStorageRemove(COUPON_KEY);

            if (couponStatus) {
                couponStatus.textContent = t("enterCoupon");
                couponStatus.style.color = "#a33";
            }

        } else {
            activeCoupon = "";

            safeStorageRemove(COUPON_KEY);

            if (couponStatus) {
                couponStatus.textContent = t("invalidCoupon");
                couponStatus.style.color = "#a33";
            }
        }

        renderCart();
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

    /* =====================================================
       25 — WHATSAPP ORDER
    ===================================================== */

    function submitOrder(event) {
        event.preventDefault();

        const form = event.currentTarget;

        if (!cart.length) {
            setText(
                "#popupOrderStatus",
                t("cartEmptyOrder")
            );

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

        const lines = cart.map(row => {
            const product = getProduct(row.id);

            return product
                ? `• ${productName(product)} × ${row.qty} = ${money(product.price * row.qty)}`
                : "";
        }).filter(Boolean);

        const message = [
            t("orderTitle"),
            `${t("name")}: ${name}`,
            `${t("phone")}: ${phone}`,
            `${t("address")}: ${address}`,
            "",
            `${t("details")}:`,
            ...lines,
            "",
            `${t("subtotal")}: ${money(subtotal())}`,
            `${t("discount")}: ${money(discountAmount())}`,
            `${t("total")}: ${money(grandTotal())}`,
            `${t("coupon")}: ${activeCoupon || t("noCoupon")}`,
            `${t("notes")}: ${notes || t("noNotes")}`,
            "",
            `${t("branchNumbers")}: ${WHATSAPP_NUMBERS.join(" — ")}`
        ].join("\n");

        setText(
            "#popupOrderStatus",
            t("openingWhatsApp")
        );

        const waNumber = WHATSAPP_NUMBERS[0]
            .replace(/\D/g, "")
            .replace(/^0/, "");

        const url =
            `https://wa.me/964${waNumber}?text=${encodeURIComponent(message)}`;

        const opened = window.open(
            url,
            "_blank",
            "noopener,noreferrer"
        );

        if (!opened) {
            setText(
                "#popupOrderStatus",
                t("whatsappError")
            );
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
       26 — GLOBAL PRODUCT AND CART EVENTS
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
       27 — INITIALIZE PAGE
    ===================================================== */

    async function initializeFalafelPage() {
        applyStaticTranslations();

        initializeProductView();

        activeCoupon = loadCoupon();

        if (activeCoupon && couponInput) {
            couponInput.value = activeCoupon;

            if (couponStatus) {
                couponStatus.textContent =
                    currentLanguage === "en"
                        ? "GHANNAM15 saved: 15% discount."
                        : "كود GHANNAM15 محفوظ: خصم 15%.";

                couponStatus.style.color = "#18864b";
            }
        }

        ensureOffersContainer();

        await loadDatabaseMenu();
    }

    initializeFalafelPage();

})();
