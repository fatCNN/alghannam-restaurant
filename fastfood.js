
import {
  loadBranchMenu,
  loadBranchOffers,
  ensureMenuDescriptionStyle
} from "./menu-db.js";

/* =====================================================
   مطعم الغنّام — فرع الوجبات السريعة
   مصدر المنيو والصور والأسعار والعروض: Supabase فقط
===================================================== */

(() => {
  "use strict";

  const BRANCH_ID = "fastfood";

  const STORAGE_KEY = "alghannam_fastfood_cart_v1";
  const COUPON_KEY = "alghannam_fastfood_coupon_v1";
  const PRODUCT_VIEW_KEY = "alghannam_fastfood_product_view";
  const LANGUAGE_KEY = "alghannam_fastfood_language";

  const WHATSAPP_NUMBERS = ["07760000552", "07860000556"];
  const COUPON_CODE = "GHANNAM15";
  const COUPON_RATE = 0.15;

  const $ = (selector, root = document) => root.querySelector(selector);
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

  let currentLanguage =
    safeStorageGet(LANGUAGE_KEY, "ar") === "en" ? "en" : "ar";

  let currentSearch = "";
  let activeCategory = "";

  let products = [];
  let categories = [];
  let cart = [];
  let offers = [];

  let activeCoupon =
    safeStorageGet(COUPON_KEY, "").toUpperCase() === COUPON_CODE;

  let lastCartFocus = null;
  let audioContext = null;
  let categoryEnglish = new Map();

  let menuLoading = true;
  let menuError = "";
  let categoryObserver = null;

  const menuElement = $("#fastfoodMenu");
  const categoryNav = $("#categoryNav");
  const searchInput = $("#fastfoodSearch");
  const cartOverlay = $("#cartModalOverlay");
  const fixedCartBar = $("#fixedCartBar");
  const popupItems = $("#popupCartItems");
  const addonsList = $("#cartAddonsList");
  const couponInput = $("#couponCode");
  const couponStatus = $("#couponStatus");
  const viewToggleButton = $("#toggleProductView");
  const viewToggleIcon = $("#viewToggleIcon");

  // عناصر العروض المضافة إلى fastfood.html
  const offersSection = $("#fastfoodOffersSection");
  const offersContainer = $("#fastfoodOffers");
  const offersTitle = $("#fastfoodOffersTitle");
  const offersSubtitle = $("#fastfoodOffersSubtitle");

  const ui = {
    ar: {
      pageTitle: "مطعم الغنّام | فرع الوجبات السريعة",
      pageDescription: "منيو مطعم الغنّام - فرع الوجبات السريعة",
      brandName: "مطعم الغنّام",
      branchName: "فرع الوجبات السريعة",
      branchFullName: "مطعم الغنّام — فرع الوجبات السريعة",
      logoAlt: "شعار مطعم الغنّام",
      brandAria: "العودة إلى مطعم الغنّام",
      mainNavAria: "التنقل الرئيسي",
      headerActionsAria: "إعدادات الموقع",
      languageToggleAria: "تغيير اللغة",
      openMenuAria: "فتح القائمة",
      backHome: "العودة إلى الرئيسية",
      menu: "المنيو",
      heroEyebrow: "مطعم الغنّام • طعم شعبي أصيل",
      heroTitle: "الوجبات السريعة",
      heroDescription: "شاورما • كنتاكي • سندويشات • بركر • بيتزا",
      browseMenu: "تصفح المنيو الآن",
      searchSectionAria: "البحث في المنيو",
      searchPagePlaceholder: "ابحث عن شاورما أو بركر أو بيتزا...",
      searchInputAria: "ابحث عن منتجات الوجبات السريعة",
      categoriesAria: "أقسام المنيو",
      viewSettingsAria: "إعدادات عرض المنيو",
      productsAria: "المنتجات",
      loadingMenu: "جارٍ تحميل قائمة الوجبات السريعة...",
      openCartAria: "فتح سلة المشتريات",
      viewCart: "عرض السلة",
      cartTitle: "سلة مشترياتك 🛒",
      closeCartAria: "إغلاق السلة",
      currentOrder: "طلبك الحالي",
      addToOrder: "أضف إلى طلبك",
      menuAddons: "إضافات من المنيو",
      swipeBrowse: "اسحب للتصفح ←",
      loadingAddons: "جارٍ تحميل الإضافات...",
      couponCode: "🎟️ كود الخصم",
      enterCouponPlaceholder: "أدخل كود الخصم",
      applyCoupon: "تطبيق",
      summaryAria: "ملخص الحساب",
      subtotalLabel: "المجموع الفرعي",
      discountLabel: "الخصم",
      finalTotalLabel: "الإجمالي النهائي",
      customerInfo: "معلومات الزبون",
      nameLabel: "الاسم",
      namePlaceholder: "الاسم الكامل",
      phoneLabel: "رقم الهاتف",
      phonePlaceholder: "رقم الهاتف",
      addressLabel: "العنوان",
      addressPlaceholder: "منطقة السكن وأقرب نقطة دالة",
      notesLabel: "ملاحظات إضافية",
      notesPlaceholder: "أي ملاحظات على الطلب",
      sendWhatsApp: "إرسال الطلب عبر واتساب",
      continueShopping: "مواصلة التسوق",
      totalLabel: "الإجمالي",
      closeMenuAria: "إغلاق القائمة",
      sideMenuTitle: "القائمة",
      navigationTitle: "التنقل",
      homePage: "الصفحة الرئيسية",
      returnBranches: "العودة إلى صفحة الفروع",
      foodMenu: "قائمة الطعام",
      goToMenu: "الانتقال إلى المنيو",
      shoppingCart: "سلة المشتريات",
      viewItemsTotal: "عرض المنتجات والإجمالي",
      restaurantInfo: "معلومات المطعم",
      currency: "العملة",
      currencyName: "الدينار العراقي (د.ع)",
      helpComplaints: "المساعدة والشكاوى",
      helpDescription: "للاستفسارات وتقديم الشكاوى",
      branchPhones: "أرقام الفرع",
      branchLocation: "موقع الفرع",
      openMap: "افتح الخريطة لمعرفة موقع الفرع",
      closeMenu: "إغلاق القائمة",
      allPricesIQD: "جميع الأسعار بالدينار العراقي",
      backHomePage: "العودة إلى الصفحة الرئيسية",
      search: "ابحث عن وجبتك...",
      add: "أضف إلى السلة",
      pending: "بانتظار تحديد السعر",
      unconfirmed: "السعر غير مؤكد",
      meal: "تحويلها إلى وجبة",
      mealOnly: "الصنف فقط",
      mealIncludes: "الوجبة تشمل الفنكر والمشروب",
      empty: "السلة فارغة، اختَر الأصناف التي تريدها.",
      noResults: "ما لقينا منتجات تطابق بحثك.",
      item: "صنف",
      items: "أصناف",
      inCart: "في السلة",
      subtotal: "المجموع الفرعي",
      discount: "الخصم",
      total: "الإجمالي",
      notes: "ملاحظات",
      mealText: "وجبة (فنكر ومشروب)",
      mealLabel: "وجبة",
      addAddon: "أضف للسلة",
      noAddons: "لا توجد إضافات أخرى متاحة حالياً.",
      decrease: "تقليل الكمية",
      increase: "زيادة الكمية",
      remove: "حذف الصنف",
      enterCoupon: "أدخل كود الخصم أولاً.",
      invalidCoupon: "الكود غير صحيح.",
      applied: "تم تطبيق خصم 15% بنجاح.",
      addFirst: "أضف أصنافاً إلى السلة أولاً.",
      addBeforeOrder: "أضف صنفاً واحداً على الأقل قبل إرسال الطلب.",
      opening: "سيتم فتح واتساب لإكمال إرسال الطلب.",
      whatsappError: "تعذر فتح واتساب. اسمح بفتح النوافذ المنبثقة ثم حاول مجدداً.",
      noCoupon: "لا يوجد",
      noNotes: "لا توجد",
      orderTitle: "طلب جديد — مطعم الغنّام / فرع الوجبات السريعة",
      customer: "الاسم",
      phone: "الهاتف",
      address: "العنوان",
      details: "تفاصيل الطلب",
      contact: "أرقام التواصل",
      savedCoupon: "كود GHANNAM15 محفوظ: خصم 15%.",
      switchGrid: "التبديل إلى عرض البطاقات",
      switchList: "التبديل إلى العرض الأفقي",
      grid: "عرض البطاقات",
      list: "العرض الأفقي",
      selectOption: "اختر الخيار",
      chooseOption: "يرجى اختيار أحد الخيارات",
      loadingError: "تعذر تحميل المنيو من قاعدة البيانات.",
      noProducts: "لا توجد منتجات متاحة حالياً.",
      unavailable: "هذا المنتج غير متاح حالياً.",
      offersTitle: " عروضنا المميزة",
      offersSubtitle: "استمتع بأفضل عروض مطعم الغنّام",
      offerPlaceholder: "",
      offerPrice: "سعر العرض",
      originalPrice: "السعر السابق"
    },

    en: {
      pageTitle: "Al Ghannam Restaurant | Fast Food Branch",
      pageDescription: "Al Ghannam fast food menu",
      brandName: "Al Ghannam Restaurant",
      branchName: "Fast Food Branch",
      branchFullName: "Al Ghannam Restaurant — Fast Food Branch",
      logoAlt: "Al Ghannam Restaurant logo",
      brandAria: "Back to Al Ghannam Restaurant",
      mainNavAria: "Main navigation",
      headerActionsAria: "Website settings",
      languageToggleAria: "Change language",
      openMenuAria: "Open menu",
      backHome: "Back to Home",
      menu: "Menu",
      heroEyebrow: "Al Ghannam Restaurant • Authentic Local Flavor",
      heroTitle: "Fast Food",
      heroDescription: "Shawarma • Kentucky • Sandwiches • Burgers • Pizza",
      browseMenu: "Browse the Menu",
      searchSectionAria: "Search the menu",
      searchPagePlaceholder: "Search for shawarma, burgers, or pizza...",
      searchInputAria: "Search fast food products",
      categoriesAria: "Menu categories",
      viewSettingsAria: "Menu display settings",
      productsAria: "Products",
      loadingMenu: "Loading the fast food menu...",
      openCartAria: "Open shopping cart",
      viewCart: "View Cart",
      cartTitle: "Your Shopping Cart 🛒",
      closeCartAria: "Close cart",
      currentOrder: "Your Current Order",
      addToOrder: "Add to Your Order",
      menuAddons: "Menu Add-ons",
      swipeBrowse: "Swipe to browse →",
      loadingAddons: "Loading add-ons...",
      couponCode: "🎟️ Discount Code",
      enterCouponPlaceholder: "Enter discount code",
      applyCoupon: "Apply",
      summaryAria: "Order summary",
      subtotalLabel: "Subtotal",
      discountLabel: "Discount",
      finalTotalLabel: "Grand Total",
      customerInfo: "Customer Information",
      nameLabel: "Name",
      namePlaceholder: "Full name",
      phoneLabel: "Phone Number",
      phonePlaceholder: "Phone number",
      addressLabel: "Address",
      addressPlaceholder: "Your area and nearest landmark",
      notesLabel: "Additional Notes",
      notesPlaceholder: "Any notes about your order",
      sendWhatsApp: "Send Order via WhatsApp",
      continueShopping: "Continue Shopping",
      totalLabel: "Total",
      closeMenuAria: "Close menu",
      sideMenuTitle: "Menu",
      navigationTitle: "Navigation",
      homePage: "Home Page",
      returnBranches: "Return to branches page",
      foodMenu: "Food Menu",
      goToMenu: "Go to menu",
      shoppingCart: "Shopping Cart",
      viewItemsTotal: "View items and total",
      restaurantInfo: "Restaurant Information",
      currency: "Currency",
      currencyName: "Iraqi Dinar (IQD)",
      helpComplaints: "Help & Complaints",
      helpDescription: "For inquiries and complaints",
      branchPhones: "Branch Phone Numbers",
      branchLocation: "Branch Location",
      openMap: "Open the map to find the branch",
      closeMenu: "Close Menu",
      allPricesIQD: "All prices are in Iraqi Dinars",
      backHomePage: "Return to the home page",
      search: "Search for your meal...",
      add: "Add to cart",
      pending: "Price pending",
      unconfirmed: "Price not confirmed",
      meal: "Upgrade to a meal",
      mealOnly: "Item only",
      mealIncludes: "Meal includes fries and a drink",
      empty: "Your cart is empty. Choose the items you want.",
      noResults: "No products match your search.",
      item: "item",
      items: "items",
      inCart: "in cart",
      subtotal: "Subtotal",
      discount: "Discount",
      total: "Grand total",
      notes: "Notes",
      mealText: "Meal (fries and a drink)",
      mealLabel: "Meal",
      addAddon: "Add to cart",
      noAddons: "No other add-ons are currently available.",
      decrease: "Decrease quantity",
      increase: "Increase quantity",
      remove: "Remove item",
      enterCoupon: "Enter the discount code first.",
      invalidCoupon: "Invalid discount code.",
      applied: "15% discount applied successfully.",
      addFirst: "Add items to your cart first.",
      addBeforeOrder: "Add at least one item before submitting your order.",
      opening: "Opening WhatsApp to complete your order.",
      whatsappError: "Could not open WhatsApp. Allow pop-ups and try again.",
      noCoupon: "None",
      noNotes: "None",
      orderTitle: "New Order — Al Ghannam Restaurant / Fast Food Branch",
      customer: "Name",
      phone: "Phone",
      address: "Address",
      details: "Order details",
      contact: "Contact numbers",
      savedCoupon: "GHANNAM15 saved: 15% discount.",
      switchGrid: "Switch to grid view",
      switchList: "Switch to horizontal view",
      grid: "Grid view",
      list: "Horizontal view",
      selectOption: "Choose an option",
      chooseOption: "Please choose an option",
      loadingError: "Could not load the menu from the database.",
      noProducts: "No products are currently available.",
      unavailable: "This product is currently unavailable.",
      offersTitle: " Featured Offers",
      offersSubtitle: "Enjoy the best offers from Al Ghannam",
      offerPlaceholder: "",
      offerPrice: "Offer price",
      originalPrice: "Original price"
    }
  };

  const t = key => ui[currentLanguage][key] ?? ui.ar[key] ?? key;

  const money = value => {
    const amount = Math.max(0, Math.round(Number(value) || 0));

    return currentLanguage === "en"
      ? `${amount.toLocaleString("en-US")} IQD`
      : `${amount.toLocaleString("en-US")} د.ع`;
  };

  const productName = product =>
    currentLanguage === "en"
      ? (product.name_en || product.name_ar || product.name || "")
      : (product.name_ar || product.name || "");

  const productDescription = product =>
    currentLanguage === "en"
      ? (product.description_en || product.description_ar || product.description || "")
      : (product.description_ar || product.description || "");

  const categoryName = category =>
    currentLanguage === "en"
      ? (categoryEnglish.get(category) || category)
      : category;

  const getProduct = id =>
    products.find(product => String(product.id) === String(id));

  const productEmoji = product => product?.emoji || "🍽️";

  /* =====================================================
     العروض — من جدول offers في Supabase
  ===================================================== */

  function updateOffersHeading() {
    if (offersTitle) {
      offersTitle.textContent = t("offersTitle");
    }

    if (offersSubtitle) {
      offersSubtitle.textContent = t("offersSubtitle");
    }
  }

  function offerImageSource(offer) {
    const candidate = String(offer?.image_url || "").trim();

    if (!candidate || !/^https?:\/\//i.test(candidate)) {
      return "";
    }

    return candidate;
  }

  function offerCardHTML(offer) {
    const name = String(offer.name || "").trim();
    const description = String(offer.description || "").trim();
    const image = offerImageSource(offer);

    const offerPrice = Number(offer.offer_price);
    const originalPrice = Number(offer.original_price);

    const hasOfferPrice =
      offer.offer_price !== null &&
      offer.offer_price !== undefined &&
      offer.offer_price !== "" &&
      Number.isFinite(offerPrice);

    const hasOriginalPrice =
      offer.original_price !== null &&
      offer.original_price !== undefined &&
      offer.original_price !== "" &&
      Number.isFinite(originalPrice);

    const imageHTML = image
      ? `
        <img
          class="fastfood-offer-image"
          src="${escapeHTML(image)}"
          alt="${escapeHTML(name || t("offerPlaceholder"))}"
          loading="lazy"
          onerror="
            this.style.display='none';
            const fallback=this.nextElementSibling;
            if(fallback) fallback.style.display='flex';
          ">

        <div class="fastfood-offer-placeholder" style="display:none">
          ${escapeHTML(t("offerPlaceholder"))}
        </div>
      `
      : `
        <div class="fastfood-offer-placeholder">
          ${escapeHTML(t("offerPlaceholder"))}
        </div>
      `;

    return `
      <article class="fastfood-offer-card">

        <div class="fastfood-offer-image-box">
          ${imageHTML}
        </div>

        <div class="fastfood-offer-info">

          ${name ? `
            <h3 class="fastfood-offer-name">
              ${escapeHTML(name)}
            </h3>
          ` : ""}

          ${description ? `
            <p class="fastfood-offer-description">
              ${escapeHTML(description)}
            </p>
          ` : ""}

          ${(hasOfferPrice || hasOriginalPrice) ? `
            <div class="fastfood-offer-prices">

              ${hasOfferPrice ? `
                <span class="fastfood-offer-current-price">
                  ${escapeHTML(money(offerPrice))}
                </span>
              ` : ""}

              ${hasOriginalPrice ? `
                <span class="fastfood-offer-original-price">
                  ${escapeHTML(money(originalPrice))}
                </span>
              ` : ""}

            </div>
          ` : ""}

        </div>
      </article>
    `;
  }

  function renderOffers(rows = []) {
    if (!offersSection || !offersContainer) return;

    offers = Array.isArray(rows) ? rows : [];

    updateOffersHeading();

    if (!offers.length) {
      offersContainer.innerHTML = "";
      offersSection.hidden = true;
      return;
    }

    offersContainer.innerHTML = offers
      .map(offerCardHTML)
      .join("");

    offersSection.hidden = false;
  }

  async function refreshOffersFromDatabase() {
    if (!offersSection || !offersContainer) {
      console.warn(
        "قسم العروض غير موجود في fastfood.html. تحقق من إضافة fastfoodOffersSection وfastfoodOffers."
      );
      return false;
    }

    try {
      const result = await loadBranchOffers(BRANCH_ID);

      renderOffers(Array.isArray(result) ? result : []);

      console.info(
        `تم تحميل ${offers.length} عرضاً لفرع الوجبات السريعة.`
      );

      return true;

    } catch (error) {
      // فشل العروض لا يؤثر على المنيو أو السلة.
      console.error("تعذر تحميل عروض الفرع:", error);

      offers = [];
      renderOffers([]);

      return false;
    }
  }

  function getCategoryKey(category) {
    return String(category.id || category.name);
  }

  function getCategorySectionId(category) {
    const key = getCategoryKey(category);

    return `fastfood-category-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }

  function getProductOptions(product) {
    const options = product?.options;

    if (!options || typeof options !== "object" || Array.isArray(options)) {
      return [];
    }

    return Object.entries(options).map(([key, value]) => {
      const isObject = value && typeof value === "object";

      const price = isObject
        ? Number(value.price)
        : Number(value);

      const labelAr = isObject
        ? (value.label_ar || value.label || key)
        : key;

      const labelEn = isObject
        ? (value.label_en || value.label || key)
        : key;

      return {
        key,
        label: currentLanguage === "en" ? labelEn : labelAr,
        price: Number.isFinite(price) && price >= 0 ? price : null
      };
    });
  }

  function getSelectedOption(product, optionKey) {
    return getProductOptions(product).find(
      option => String(option.key) === String(optionKey)
    ) || null;
  }

  function getBasePrice(product, optionKey = "") {
    if (!product || product.requires_price_confirmation) return null;

    const options = getProductOptions(product);

    if (options.length) {
      if (!optionKey) return null;
      return getSelectedOption(product, optionKey)?.price ?? null;
    }

    if (
      product.price === null ||
      product.price === undefined ||
      product.price === ""
    ) {
      return null;
    }

    const price = Number(product.price);

    return Number.isFinite(price) && price >= 0 ? price : null;
  }

  function effectivePrice(product, meal = false, optionKey = "") {
    const basePrice = getBasePrice(product, optionKey);

    if (basePrice === null) return null;

    const upgradePrice = Number(product.meal_upgrade_price || 0);

    return basePrice + (
      meal && product.mealUpgrade
        ? Math.max(0, upgradePrice)
        : 0
    );
  }

  function applyStaticTranslations() {
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir =
      currentLanguage === "en" ? "ltr" : "rtl";

    const languageButton = $("#languageToggle");

    if (languageButton) {
      languageButton.textContent =
        currentLanguage === "en" ? "AR" : "EN";

      languageButton.setAttribute(
        "aria-label",
        currentLanguage === "en" ? "Switch to Arabic" : "Switch to English"
      );
    }

    if (searchInput) searchInput.placeholder = t("search");

    $$("[data-i18n]").forEach(element => {
      const key = element.dataset.i18n;

      if (ui[currentLanguage][key] || ui.ar[key]) {
        element.textContent = t(key);
      }
    });

    $$("[data-i18n-placeholder]").forEach(element => {
      const key = element.dataset.i18nPlaceholder;

      if (ui[currentLanguage][key] || ui.ar[key]) {
        element.placeholder = t(key);
      }
    });

    $$("[data-i18n-title]").forEach(element => {
      const key = element.dataset.i18nTitle;

      if (ui[currentLanguage][key] || ui.ar[key]) {
        element.title = t(key);
      }
    });

    $$("[data-i18n-aria]").forEach(element => {
      const key = element.dataset.i18nAria;

      if (ui[currentLanguage][key] || ui.ar[key]) {
        element.setAttribute("aria-label", t(key));
      }
    });

    $$("[data-i18n-alt]").forEach(element => {
      const key = element.dataset.i18nAlt;

      if (ui[currentLanguage][key] || ui.ar[key]) {
        element.alt = t(key);
      }
    });

    $$("[data-i18n-meta]").forEach(element => {
      const key = element.dataset.i18nMeta;

      if (ui[currentLanguage][key] || ui.ar[key]) {
        element.setAttribute("content", t(key));
      }
    });

    const pageTitle = $("title[data-i18n-title]");

    if (pageTitle) {
      pageTitle.textContent = t(pageTitle.dataset.i18nTitle);
    }

    updateOffersHeading();
  }

  function getSavedProductView() {
    return safeStorageGet(PRODUCT_VIEW_KEY, "grid") === "list"
      ? "list"
      : "grid";
  }

  function updateProductView(view) {
    const selected = view === "list" ? "list" : "grid";

    menuElement?.classList.toggle("list-view", selected === "list");
    menuElement?.classList.toggle("grid-view", selected === "grid");

    if (viewToggleButton) {
      viewToggleButton.setAttribute(
        "aria-pressed",
        String(selected === "list")
      );

      viewToggleButton.title =
        selected === "list" ? t("switchGrid") : t("switchList");

      viewToggleButton.setAttribute(
        "aria-label",
        viewToggleButton.title
      );
    }

    if (
      viewToggleIcon &&
      viewToggleIcon.tagName.toLowerCase() !== "svg"
    ) {
      viewToggleIcon.textContent = selected === "list" ? "▦" : "☰";
    }

    safeStorageSet(PRODUCT_VIEW_KEY, selected);
  }

  function itemKey(row) {
    return [
      row.id,
      row.meal ? "1" : "0",
      encodeURIComponent(row.optionKey || "")
    ].join("|");
  }

  function parseItemKey(key) {
    const parts = String(key || "").split("|");

    let optionKey = "";

    try {
      optionKey = decodeURIComponent(parts[2] || "");
    } catch {
      optionKey = parts[2] || "";
    }

    return {
      id: parts[0] || "",
      meal: parts[1] === "1",
      optionKey
    };
  }

  function loadCart() {
    try {
      const saved = JSON.parse(safeStorageGet(STORAGE_KEY, "[]"));

      if (!Array.isArray(saved)) return [];

      return saved.map(row => {
        const product = getProduct(row?.id);
        const qty = Math.floor(Number(row?.qty));

        if (!product || !Number.isFinite(qty) || qty < 1) {
          return null;
        }

        const optionKey = String(row.optionKey || "");
        const options = getProductOptions(product);

        if (
          options.length &&
          !getSelectedOption(product, optionKey)
        ) {
          return null;
        }

        if (
          !options.length &&
          getBasePrice(product) === null
        ) {
          return null;
        }

        return {
          id: product.id,
          qty: Math.min(99, qty),
          meal: Boolean(row.meal && product.mealUpgrade),
          optionKey
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  function saveCart() {
    safeStorageSet(STORAGE_KEY, JSON.stringify(cart));
  }

  function qtyOf(id, meal = false, optionKey = "") {
    return cart.find(row =>
      String(row.id) === String(id) &&
      Boolean(row.meal) === Boolean(meal) &&
      String(row.optionKey || "") === String(optionKey || "")
    )?.qty || 0;
  }

  function rowPrice(row) {
    return effectivePrice(
      getProduct(row.id),
      row.meal,
      row.optionKey
    ) || 0;
  }

  function subtotal() {
    return cart.reduce(
      (sum, row) => sum + rowPrice(row) * row.qty,
      0
    );
  }

  function totalQty() {
    return cart.reduce((sum, row) => sum + row.qty, 0);
  }

  function discountAmount() {
    return activeCoupon ? Math.round(subtotal() * COUPON_RATE) : 0;
  }

  function grandTotal() {
    return Math.max(0, subtotal() - discountAmount());
  }

  function setText(selector, value) {
    const element = $(selector);

    if (element) element.textContent = value;
  }

  function playBellSound() {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      if (!audioContext || audioContext.state === "closed") {
        audioContext = new AudioContextClass();
      }

      const play = () => {
        const now = audioContext.currentTime;

        [880, 1320].forEach((frequency, index) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const start = now + index * 0.1;

          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, start);

          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);

          oscillator.connect(gain);
          gain.connect(audioContext.destination);

          oscillator.start(start);
          oscillator.stop(start + 0.34);
        });
      };

      if (audioContext.state === "suspended") {
        audioContext.resume().then(play).catch(() => {});
      } else {
        play();
      }
    } catch (error) {
      console.warn("تعذر تشغيل صوت التنبيه:", error);
    }
  }

  function getCategories() {
    return categories.filter(category => category && category.name);
  }

  function getCategoryForProduct(product) {
    if (product.category_id) {
      return categories.find(
        category => String(category.id) === String(product.category_id)
      ) || null;
    }

    return categories.find(
      category => category.name === product.category
    ) || null;
  }

  function imageSource(product) {
    const candidate = String(product?.image_url || "").trim();

    if (!candidate || !/^https?:\/\//i.test(candidate)) {
      return "";
    }

    return candidate;
  }

  function imageHTML(product, className = "", alt = "") {
    const image = imageSource(product);
    const imageClass = className ? `class="${escapeHTML(className)}"` : "";

    if (!image) {
      return `
        <div class="${escapeHTML(className || "product-placeholder")} image-placeholder">
          ${escapeHTML(productEmoji(product))}
        </div>
      `;
    }

    return `
      <img
        ${imageClass}
        src="${escapeHTML(image)}"
        alt="${escapeHTML(alt || productName(product))}"
        loading="lazy"
        onerror="
          this.style.display='none';
          const fallback=this.nextElementSibling;
          if(fallback) fallback.style.display='flex';
        ">

      <div class="image-placeholder"
        style="display:none">
        ${escapeHTML(productEmoji(product))}
      </div>
    `;
  }

  function renderOptionSelector(product) {
    const options = getProductOptions(product);

    if (!options.length) return "";

    return `
      <label class="product-option-label"
        for="product-option-${escapeHTML(product.id)}">
        ${escapeHTML(t("selectOption"))}
      </label>

      <select
        id="product-option-${escapeHTML(product.id)}"
        data-product-option="${escapeHTML(product.id)}"
        aria-label="${escapeHTML(productName(product))}">

        <option value="">${escapeHTML(t("selectOption"))}</option>

        ${options.map(option => `
          <option
            value="${escapeHTML(option.key)}"
            ${option.price === null ? "disabled" : ""}>
            ${escapeHTML(option.label)}
            ${option.price !== null
              ? ` — ${escapeHTML(money(option.price))}`
              : ""}
          </option>
        `).join("")}
      </select>
    `;
  }

  function renderMealSelector(product) {
    if (!product.mealUpgrade) return "";

    const upgradePrice = Number(product.meal_upgrade_price || 0);

    return `
      <label class="product-option-label"
        for="meal-option-${escapeHTML(product.id)}">
        ${escapeHTML(t("mealOnly"))}
      </label>

      <select
        id="meal-option-${escapeHTML(product.id)}"
        data-meal-select="${escapeHTML(product.id)}"
        aria-label="${escapeHTML(productName(product))}">

        <option value="single">
          ${escapeHTML(t("mealOnly"))}
        </option>

        <option value="meal">
          ${escapeHTML(t("meal"))}
          (+${escapeHTML(money(upgradePrice))})
        </option>
      </select>

      <small class="meal-upgrade-note">
        ${escapeHTML(t("mealIncludes"))}
      </small>
    `;
  }

  function productCardHTML(product) {
    const options = getProductOptions(product);

    const basePrice = getBasePrice(
      product,
      options.length ? options[0]?.key : ""
    );

    const canOrder =
      product.is_available !== false &&
      (
        options.length
          ? options.some(option => option.price !== null)
          : basePrice !== null
      );

    const name = productName(product);
    const description = productDescription(product);

    const selectedQty = cart
      .filter(row => String(row.id) === String(product.id))
      .reduce((sum, row) => sum + row.qty, 0);

    const displayedPrice = options.length
      ? t("selectOption")
      : basePrice !== null
        ? money(basePrice)
        : t("unconfirmed");

    return `
      <article class="product-card"
        data-product-id="${escapeHTML(product.id)}">

        <div class="product-image-box">
          ${imageHTML(product, "product-image", name)}
        </div>

        <div class="product-details">
          <h3 class="product-name">${escapeHTML(name)}</h3>

          ${description ? `
            <p class="ghannam-db-description">
              ${escapeHTML(description)}
            </p>
          ` : ""}

          <div class="product-price">
            ${canOrder
              ? escapeHTML(displayedPrice)
              : `<span class="price-unconfirmed">${escapeHTML(t("unconfirmed"))}</span>`
            }
          </div>

          ${renderOptionSelector(product)}
          ${renderMealSelector(product)}

          <div class="product-actions">
            <button
              type="button"
              class="add-to-cart-button"
              data-add="${escapeHTML(product.id)}"
              ${canOrder ? "" : `disabled title="${escapeHTML(t("pending"))}"`}>
              ${canOrder ? escapeHTML(t("add")) : escapeHTML(t("pending"))}
            </button>

            ${selectedQty ? `
              <span class="product-quantity">
                ${selectedQty} ${escapeHTML(t("inCart"))}
              </span>
            ` : ""}
          </div>
        </div>
      </article>
    `;
  }

  /* =====================================================
     الأقسام والتنقل بينها
  ===================================================== */

  function renderCategories(visibleCategories = categories) {
    if (!categoryNav) return;

    categoryNav.innerHTML = visibleCategories.map(category => {
      const key = getCategoryKey(category);

      return `
        <button
          type="button"
          class="category-pill ${activeCategory === key ? "active" : ""}"
          data-category="${escapeHTML(key)}"
          aria-current="${activeCategory === key ? "true" : "false"}">

          ${escapeHTML(categoryName(category.name))}
        </button>
      `;
    }).join("");
  }

  function observeMenuSections() {
    if (categoryObserver) {
      categoryObserver.disconnect();
      categoryObserver = null;
    }

    if (!("IntersectionObserver" in window) || !menuElement) return;

    const sections = $$(".menu-section", menuElement);

    if (!sections.length) return;

    categoryObserver = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) =>
          a.boundingClientRect.top - b.boundingClientRect.top
        );

      if (!visible.length) return;

      const key = visible[0].target.dataset.categorySection;

      if (key && activeCategory !== key) {
        activeCategory = key;
        renderCategories();
      }
    }, {
      root: null,
      rootMargin: "-140px 0px -60% 0px",
      threshold: 0
    });

    sections.forEach(section => {
      categoryObserver.observe(section);
    });
  }

  function scrollToCategory(category) {
    if (!category) return;

    const section = document.getElementById(
      getCategorySectionId(category)
    );

    if (!section) return;

    activeCategory = getCategoryKey(category);
    renderCategories();

    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /* =====================================================
     عرض المنيو
  ===================================================== */

  function renderMenu() {
    if (!menuElement) return;

    if (menuLoading) {
      menuElement.innerHTML = `
        <p class="empty-message">${escapeHTML(t("loadingMenu"))}</p>
      `;
      renderCategories([]);
      return;
    }

    if (menuError) {
      menuElement.innerHTML = `
        <p class="empty-message">${escapeHTML(t("loadingError"))}</p>
      `;
      renderCategories([]);
      return;
    }

    if (!products.length) {
      menuElement.innerHTML = `
        <p class="empty-message">${escapeHTML(t("noProducts"))}</p>
      `;
      renderCategories([]);
      return;
    }

    const query = currentSearch.trim().toLocaleLowerCase();

    // البحث فقط هو الذي يفلتر المنتجات.
    // اختيار القسم لا يخفي بقية الأقسام.
    const filteredProducts = products.filter(product => {
      const searchable = [
        product.name,
        product.name_ar,
        product.name_en,
        product.description,
        product.description_ar,
        product.description_en,
        product.category,
        product.category_en
      ].filter(Boolean).join(" ").toLocaleLowerCase();

      return !query || searchable.includes(query);
    });

    if (!filteredProducts.length) {
      menuElement.innerHTML = `
        <p class="empty-message">${escapeHTML(t("noResults"))}</p>
      `;

      renderCategories();
      return;
    }

    const visibleCategories = categories.filter(category => {
      return filteredProducts.some(product => {
        if (product.category_id) {
          return String(product.category_id) === String(category.id);
        }

        return product.category === category.name;
      });
    });

    menuElement.innerHTML = visibleCategories.map(category => {
      const rows = filteredProducts.filter(product => {
        if (product.category_id) {
          return String(product.category_id) === String(category.id);
        }

        return product.category === category.name;
      });

      return `
        <section
          class="menu-section"
          id="${escapeHTML(getCategorySectionId(category))}"
          data-category-section="${escapeHTML(getCategoryKey(category))}">

          <h2 class="section-title">
            ${escapeHTML(categoryName(category.name))}
          </h2>

          <div class="product-grid">
            ${rows.map(productCardHTML).join("")}
          </div>
        </section>
      `;
    }).join("");

    // نبقي شريط الأقسام كاملاً ظاهراً.
    renderCategories();

    updateProductView(getSavedProductView());
    observeMenuSections();
  }

  /* =====================================================
     إضافات السلة — الصور من image_url في Supabase
  ===================================================== */

  function renderAddons() {
    if (!addonsList) return;

    const addonCategories = [
      "الإضافات",
      "الصوص",
      "المشروبات",
      "الفنكر",
      "المقبلات"
    ];

    const suggestions = products.filter(product => {
      const categoryMatches = addonCategories.includes(product.category);

      return (
        categoryMatches &&
        getBasePrice(product) !== null &&
        product.is_available !== false &&
        !cart.some(row => String(row.id) === String(product.id))
      );
    });

    addonsList.innerHTML = suggestions.length ? `
      <div class="addons-grid">
        ${suggestions.map(product => `
          <div class="addon-card">

            <div class="addon-image-box">
              ${imageHTML(
                product,
                "addon-image",
                productName(product)
              )}
            </div>

            <div class="addon-card-info">
              <strong>${escapeHTML(productName(product))}</strong>

              <span>
                ${escapeHTML(money(getBasePrice(product)))}
              </span>

              <button
                type="button"
                data-addon="${escapeHTML(product.id)}">
                ${escapeHTML(t("addAddon"))}
              </button>
            </div>

          </div>
        `).join("")}
      </div>
    ` : `
      <p class="addons-empty">${escapeHTML(t("noAddons"))}</p>
    `;
  }

  /* =====================================================
     السلة — عرض صورة كل منتج من قاعدة البيانات
  ===================================================== */

  function renderCart() {
    const count = totalQty();
    const sub = subtotal();
    const discount = discountAmount();
    const total = grandTotal();

    const countText =
      `${count} ${count === 1 ? t("item") : t("items")}`;

    setText("#cartCount", countText);
    setText("#fastfoodTotal", money(total));
    setText("#fixedCartCount", count);

    setText(
      "#fixedCartSubtitle",
      count ? `${countText} ${t("inCart")}` : t("empty")
    );

    setText("#fixedCartTotal", money(total));
    setText("#popupSubtotal", money(sub));
    setText("#popupDiscount", money(discount));
    setText("#popupGrandTotal", money(total));
    setText("#popupFooterTotal", money(total));

    fixedCartBar?.classList.toggle("has-items", count > 0);

    if (popupItems) {
      popupItems.innerHTML = cart.length
        ? cart.map(row => {
            const product = getProduct(row.id);

            if (!product) return "";

            const option = getSelectedOption(product, row.optionKey);

            const nameParts = [
              productName(product),
              option ? option.label : "",
              row.meal ? t("mealText") : ""
            ].filter(Boolean);

            const name = nameParts.join(" — ");
            const key = escapeHTML(itemKey(row));

            return `
              <div class="cart-item" data-cart-key="${key}">

                <div class="cart-item-image-box">
                  ${imageHTML(
                    product,
                    "cart-item-image",
                    productName(product)
                  )}
                </div>

                <div class="cart-item-info">
                  <div class="cart-item-name">
                    ${escapeHTML(name)}
                  </div>

                  <div class="cart-item-price">
                    ${escapeHTML(money(rowPrice(row)))} × ${row.qty}
                  </div>

                  <div class="cart-item-subtotal">
                    ${escapeHTML(t("total"))}:
                    ${escapeHTML(money(rowPrice(row) * row.qty))}
                  </div>
                </div>

                <div class="quantity-controls">
                  <button
                    type="button"
                    data-qty="${key}"
                    data-delta="-1"
                    aria-label="${escapeHTML(t("decrease"))}">−</button>

                  <strong>${row.qty}</strong>

                  <button
                    type="button"
                    data-qty="${key}"
                    data-delta="1"
                    aria-label="${escapeHTML(t("increase"))}">+</button>

                  <button
                    type="button"
                    data-remove="${key}"
                    aria-label="${escapeHTML(t("remove"))}">×</button>
                </div>

              </div>
            `;
          }).join("")
        : `<p class="empty-message">${escapeHTML(t("empty"))}</p>`;
    }

    const legacyItems = $("#fastfoodCartItems");

    if (legacyItems) {
      legacyItems.innerHTML = cart.map(row => {
        const product = getProduct(row.id);

        if (!product) return "";

        const option = getSelectedOption(product, row.optionKey);

        return `
          <p>
            ${escapeHTML(productName(product))}
            ${option ? ` — ${escapeHTML(option.label)}` : ""}
            ${row.meal ? ` — ${escapeHTML(t("mealLabel"))}` : ""}
            × ${row.qty}
          </p>
        `;
      }).join("");
    }

    // تحديث صور واقتراحات الإضافات عند كل تغيير في السلة.
    renderAddons();
  }

  /* =====================================================
     إدارة عناصر السلة
  ===================================================== */

  function addToCart(id, meal = false, optionKey = "") {
    const product = getProduct(id);

    if (!product || product.is_available === false) {
      alert(t("unavailable"));
      return;
    }

    const options = getProductOptions(product);

    if (options.length && !optionKey) {
      alert(t("chooseOption"));
      return;
    }

    const selectedPrice = effectivePrice(
      product,
      meal,
      optionKey
    );

    if (selectedPrice === null) {
      alert(t("unconfirmed"));
      return;
    }

    const selectedMeal = Boolean(meal && product.mealUpgrade);

    const row = cart.find(item =>
      String(item.id) === String(id) &&
      Boolean(item.meal) === selectedMeal &&
      String(item.optionKey || "") === String(optionKey || "")
    );

    if (row) {
      row.qty = Math.min(99, row.qty + 1);
    } else {
      cart.push({
        id: product.id,
        qty: 1,
        meal: selectedMeal,
        optionKey: String(optionKey || "")
      });
    }

    saveCart();
    renderMenu();
    renderCart();
    playBellSound();
  }

  function changeQty(key, amount) {
    const parsed = parseItemKey(key);

    const row = cart.find(item =>
      String(item.id) === parsed.id &&
      Boolean(item.meal) === parsed.meal &&
      String(item.optionKey || "") === parsed.optionKey
    );

    if (!row) return;

    row.qty += Number(amount) || 0;

    if (row.qty <= 0) {
      cart = cart.filter(item => item !== row);
    } else {
      row.qty = Math.min(99, row.qty);
    }

    saveCart();
    renderMenu();
    renderCart();
  }

  function removeFromCart(key) {
    const parsed = parseItemKey(key);

    cart = cart.filter(item => !(
      String(item.id) === parsed.id &&
      Boolean(item.meal) === parsed.meal &&
      String(item.optionKey || "") === parsed.optionKey
    ));

    saveCart();
    renderMenu();
    renderCart();
  }

  /* =====================================================
     فتح وإغلاق السلة
  ===================================================== */

  function openCart() {
    if (!cartOverlay) return;

    lastCartFocus = document.activeElement;

    cartOverlay.hidden = false;
    cartOverlay.setAttribute("aria-hidden", "false");

    document.body.classList.add("cart-modal-open");

    renderCart();

    $("#closeCartModal")?.focus();
  }

  function closeCart() {
    if (!cartOverlay || cartOverlay.hidden) return;

    cartOverlay.hidden = true;
    cartOverlay.setAttribute("aria-hidden", "true");

    document.body.classList.remove("cart-modal-open");

    if (lastCartFocus?.isConnected) {
      lastCartFocus.focus();
    } else {
      fixedCartBar?.focus();
    }
  }

  /* =====================================================
     الكوبون
  ===================================================== */

  function applyCoupon() {
    const code = (couponInput?.value || "").trim().toUpperCase();

    if (!code) {
      activeCoupon = false;
      safeStorageRemove(COUPON_KEY);

      if (couponStatus) {
        couponStatus.textContent = t("enterCoupon");
        couponStatus.className = "coupon-error";
      }

      renderCart();
      return;
    }

    if (code !== COUPON_CODE) {
      activeCoupon = false;
      safeStorageRemove(COUPON_KEY);

      if (couponStatus) {
        couponStatus.textContent = t("invalidCoupon");
        couponStatus.className = "coupon-error";
      }

      renderCart();
      return;
    }

    if (!cart.length) {
      if (couponStatus) {
        couponStatus.textContent = t("addFirst");
        couponStatus.className = "coupon-error";
      }

      return;
    }

    activeCoupon = true;
    safeStorageSet(COUPON_KEY, COUPON_CODE);

    if (couponStatus) {
      couponStatus.textContent = t("applied");
      couponStatus.className = "coupon-success";
    }

    renderCart();
  }

  /* =====================================================
     إرسال الطلب إلى واتساب
  ===================================================== */

  function submitOrder(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!cart.length) {
      setText("#popupOrderStatus", t("addBeforeOrder"));
      return;
    }

    if (form && !form.reportValidity()) return;

    const name = $("#popupCustomerName")?.value.trim() || "";
    const phone = $("#popupCustomerPhone")?.value.trim() || "";
    const address = $("#popupCustomerAddress")?.value.trim() || "";
    const notes = $("#popupCustomerNotes")?.value.trim() || "";

    if (!name || !phone || !address) return;

    const lines = cart.map(row => {
      const product = getProduct(row.id);

      if (!product) return "";

      const option = getSelectedOption(product, row.optionKey);

      const title = [
        productName(product),
        option ? option.label : "",
        row.meal ? t("mealText") : ""
      ].filter(Boolean).join(" — ");

      return `• ${title} × ${row.qty} = ${money(rowPrice(row))} × ${row.qty}`;
    }).filter(Boolean);

    const message = [
      t("orderTitle"),
      `${t("customer")}: ${name}`,
      `${t("phone")}: ${phone}`,
      `${t("address")}: ${address}`,
      "",
      `${t("details")}:`,
      ...lines,
      "",
      `${t("subtotal")}: ${money(subtotal())}`,
      `${t("discount")}: ${money(discountAmount())}`,
      `${t("total")}: ${money(grandTotal())}`,
      `${currentLanguage === "en" ? "Discount code" : "كود الخصم"}: ${activeCoupon ? COUPON_CODE : t("noCoupon")}`,
      `${t("notes")}: ${notes || t("noNotes")}`,
      "",
      `${t("contact")}: ${WHATSAPP_NUMBERS.join(" — ")}`
    ].join("\n");

    setText("#popupOrderStatus", t("opening"));

    const waNumber = WHATSAPP_NUMBERS[0]
      .replace(/\D/g, "")
      .replace(/^0/, "");

    const url =
      `https://wa.me/964${waNumber}?text=${encodeURIComponent(message)}`;

    const opened = window.open(url, "_blank");

    if (!opened) {
      setText("#popupOrderStatus", t("whatsappError"));
    }
  }

  /* =====================================================
     تحميل المنيو من Supabase فقط
  ===================================================== */

  async function refreshMenuFromDatabase() {
    menuLoading = true;
    menuError = "";

    renderMenu();

    try {
      const result = await loadBranchMenu(
        BRANCH_ID,
        currentLanguage
      );

      const dbCategories = Array.isArray(result?.categories)
        ? result.categories
        : [];

      const dbProducts = Array.isArray(result?.products)
        ? result.products
        : [];

      categoryEnglish = new Map();

      categories = dbCategories
        .filter(category => category.is_active !== false)
        .map(category => {
          const name = category.name_ar || category.name || "";
          const nameEn = category.name_en || "";

          if (name && nameEn) {
            categoryEnglish.set(name, nameEn);
          }

          return {
            id: category.id,
            name,
            name_en: nameEn,
            slug: category.slug || "",
            sort_order: Number(category.sort_order || 0)
          };
        })
        .filter(category => category.name)
        .sort((a, b) => a.sort_order - b.sort_order);

      const mappedProducts = dbProducts
        .filter(row => row.is_available !== false)
        .map(row => {
          const extra =
            row.extra &&
            typeof row.extra === "object" &&
            !Array.isArray(row.extra)
              ? row.extra
              : {};

          const rawPrice =
            row.price === null ||
            row.price === undefined ||
            row.price === ""
              ? null
              : Number(row.price);

          const requiresConfirmation =
            extra.requires_price_confirmation === true;

          const validPrice =
            !requiresConfirmation &&
            rawPrice !== null &&
            Number.isFinite(rawPrice) &&
            rawPrice >= 0
              ? rawPrice
              : null;

          const categoryAr =
            row.category_name_ar ||
            row.category_name ||
            "";

          const categoryEn =
            row.category_name_en ||
            "";

          if (categoryAr && categoryEn) {
            categoryEnglish.set(categoryAr, categoryEn);
          }

          const options =
            extra.options &&
            typeof extra.options === "object" &&
            !Array.isArray(extra.options)
              ? extra.options
              : null;

          const mealUpgrade = extra.mealUpgrade === true;

          const mealUpgradePrice =
            Number(extra.meal_upgrade_price);

          return {
            id: row.id,
            dbId: row.id,

            name: row.name_ar || row.name || "",
            name_ar: row.name_ar || row.name || "",
            name_en: row.name_en || "",

            description:
              row.description_ar || row.description || "",

            description_ar:
              row.description_ar || row.description || "",

            description_en:
              row.description_en || "",

            price: validPrice,

            requires_price_confirmation: requiresConfirmation,

            category: categoryAr,
            category_en: categoryEn,
            category_id: row.category_id || "",

            // الصور من رابط Supabase فقط.
            image_url: row.image_url || "",

            emoji: extra.emoji || "🍽️",

            options,
            mealUpgrade,

            meal_upgrade_price:
              Number.isFinite(mealUpgradePrice) &&
              mealUpgradePrice >= 0
                ? mealUpgradePrice
                : 0,

            is_available: row.is_available !== false,
            sort_order: Number(row.sort_order || 0),

            extra
          };
        })
        .sort((a, b) => a.sort_order - b.sort_order);

      products = mappedProducts;

      // إعادة بناء السلة بالأسعار الحالية القادمة من قاعدة البيانات.
      cart = loadCart();
      saveCart();

      if (
        activeCategory &&
        !categories.some(category =>
          getCategoryKey(category) === activeCategory
        )
      ) {
        activeCategory = "";
      }

      menuLoading = false;
      menuError = "";

      renderMenu();
      renderCart();

      console.info(
        `تم تحميل ${products.length} منتجاً و${categories.length} تصنيفاً من Supabase.`
      );

      if (!products.length) {
        console.warn("لا توجد منتجات متاحة لهذا الفرع في Supabase.");
      }

      return true;

    } catch (error) {
      products = [];
      categories = [];
      categoryEnglish.clear();

      // لا نستخدم قائمة محلية احتياطية عند تعذر قاعدة البيانات.
      cart = [];

      menuLoading = false;
      menuError = "database";

      renderCategories([]);
      renderMenu();
      renderCart();

      console.error("فشل تحميل منيو Supabase:", error);

      return false;
    }
  }

  async function setLanguage(language) {
    currentLanguage = language === "en" ? "en" : "ar";

    safeStorageSet(LANGUAGE_KEY, currentLanguage);

    applyStaticTranslations();

    // تغيير اللغة يعيد تحميل المنيو فقط.
    // العروض تبقى محملة، ويتغير عنوان القسم.
    await refreshMenuFromDatabase();

    updateOffersHeading();
  }

  /* =====================================================
     الأحداث
  ===================================================== */

  $("#languageToggle")?.addEventListener("click", () => {
    void setLanguage(currentLanguage === "ar" ? "en" : "ar");
  });

  document.addEventListener("click", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const add = target.closest("[data-add]");

    if (add) {
      const id = add.dataset.add;
      const card = add.closest(".product-card");

      const mealSelector =
        card?.querySelector("[data-meal-select]");

      const optionSelector =
        card?.querySelector("[data-product-option]");

      addToCart(
        id,
        mealSelector?.value === "meal",
        optionSelector?.value || ""
      );

      return;
    }

    const addon = target.closest("[data-addon]");

    if (addon) {
      addToCart(addon.dataset.addon, false, "");
      return;
    }

    const qty = target.closest("[data-qty]");

    if (qty) {
      changeQty(
        qty.dataset.qty,
        Number(qty.dataset.delta ?? qty.dataset.change)
      );

      return;
    }

    const remove = target.closest("[data-remove]");

    if (remove) {
      removeFromCart(remove.dataset.remove);
      return;
    }

    // الضغط على القسم ينقل إلى مكانه دون إخفاء بقية المنيو.
    const categoryButton = target.closest("[data-category]");

    if (categoryButton) {
      const categoryKey = categoryButton.dataset.category;

      const selectedCategory = categories.find(category =>
        getCategoryKey(category) === categoryKey
      );

      if (!selectedCategory) return;

      // إذا كان البحث فعالاً، نلغيه حتى يظهر القسم المطلوب.
      if (currentSearch) {
        currentSearch = "";

        if (searchInput) {
          searchInput.value = "";
        }

        renderMenu();
      }

      scrollToCategory(selectedCategory);
      return;
    }
  });

  searchInput?.addEventListener("input", () => {
    currentSearch = searchInput.value || "";
    renderMenu();
  });

  viewToggleButton?.addEventListener("click", () => {
    updateProductView(
      getSavedProductView() === "grid" ? "list" : "grid"
    );
  });

  fixedCartBar?.addEventListener("click", openCart);

  $("#closeCartModal")?.addEventListener("click", closeCart);

  $("#continueShoppingButton")?.addEventListener("click", closeCart);

  cartOverlay?.addEventListener("click", event => {
    if (event.target === cartOverlay) {
      closeCart();
    }
  });

  $("#applyCouponButton")?.addEventListener("click", applyCoupon);

  couponInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyCoupon();
    }
  });

  $("#popupOrderForm")?.addEventListener("submit", submitOrder);

  $("#fastfoodOrderForm")?.addEventListener("submit", event => {
    event.preventDefault();
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
     بدء الصفحة
  ===================================================== */

  async function initialize() {
    cart = [];

    applyStaticTranslations();

    updateProductView(getSavedProductView());

    ensureMenuDescriptionStyle();

    menuLoading = true;

    renderCategories([]);
    renderMenu();
    renderCart();

    // إخفاء قسم العروض إلى أن تصل البيانات.
    if (offersSection) {
      offersSection.hidden = true;
    }

    if (activeCoupon && couponInput) {
      couponInput.value = COUPON_CODE;

      if (couponStatus) {
        couponStatus.textContent = t("savedCoupon");
        couponStatus.className = "coupon-success";
      }
    }

    // تحميل المنيو والعروض بشكل مستقل.
    // فشل أحدهما لا يمنع الآخر من العمل.
    await Promise.allSettled([
      refreshMenuFromDatabase(),
      refreshOffersFromDatabase()
    ]);
  }

  void initialize();

})();
