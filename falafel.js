/* =====================================================
   مطعم الغنّام — فرع الفلافل
   الملف الرئيسي: falafel.js

   الوظائف:
   1. عرض المنتجات والتصنيفات والبحث
   2. توحيد التصنيفات ومنع تكرار الأقسام
   3. تبديل عرض المنتجات بين البطاقات والأفقي
   4. حفظ طريقة العرض المختارة
   5. إدارة السلة والكميات
   6. اقتراح الإضافات والمشروبات
   7. كود الخصم GHANNAM15
   8. إرسال الطلب عبر واتساب
   9. تشغيل صوت عند إضافة منتج
===================================================== */

(() => {
  "use strict";

  /* 1. الإعدادات العامة */
  const STORAGE_KEY = "alghannam_falafel_cart_v1";
  const COUPON_KEY = "alghannam_falafel_coupon_v1";
  const PRODUCT_VIEW_KEY = "alghannam_falafel_product_view";
  const LANGUAGE_KEY = "alghannam_fastfood_language";

  const WHATSAPP_NUMBERS = ["07760000552", "07860000556"];
  const COUPON_CODE = "GHANNAM15";
  const COUPON_RATE = 0.15;
  const IMAGE_FOLDER = "imagefalafel/";

  const CATEGORY = Object.freeze({
    FALAFEL: "الفلافل",
    BURGER: "البركر",
    EXTRAS: "الإضافات",
    DRINKS: "المشروبات"
  });

  /* 2. المنتجات */
  const products = [
    { id: "falafel-wrap", name: "لفة فلافل", price: 1000, category: CATEGORY.FALAFEL, image: "falafel1.png" },
    { id: "falafel-saj", name: "صاج فلافل", price: 1500, category: CATEGORY.FALAFEL, image: "falafel2.png" },
    { id: "falafel-12", name: "حب فلافل 12", price: 1000, category: CATEGORY.FALAFEL, image: "falafel3.png" },
    { id: "falafel-meal-medium", name: "وجبة فلافل وسط", price: 3000, category: CATEGORY.FALAFEL, image: "falafel4.png" },
    { id: "falafel-meal-double", name: "وجبة فلافل دبل", price: 5000, category: CATEGORY.FALAFEL, image: "falafel5.png" },
    { id: "falafel-dough", name: "عجين فلافل", price: 1500, category: CATEGORY.FALAFEL, image: "falafel6.png" },

    { id: "burger-beef", name: "بركر لحم", price: 2500, category: CATEGORY.BURGER, image: "berger1.png" },
    { id: "burger-chicken", name: "بركر دجاج", price: 2500, category: CATEGORY.BURGER, image: "pro1.png" },
    { id: "burger-super-beef", name: "بركر سوبر لحم", price: 3500, category: CATEGORY.BURGER, image: "pro2.png" },
    { id: "burger-super-chicken", name: "بركر سوبر دجاج", price: 3500, category: CATEGORY.BURGER, image: "pro3.png" },
    { id: "burger-meal-beef", name: "وجبة بركر لحم", price: 4000, category: CATEGORY.BURGER, image: "pro4.png" },
    { id: "burger-meal-chicken", name: "وجبة بركر دجاج", price: 4000, category: CATEGORY.BURGER, image: "pro5.png" },

    { id: "fries-cup", name: "قدح بطاطا", price: 1000, category: CATEGORY.EXTRAS, image: "pro6.png" },
    { id: "fries-box", name: "معون بطاطا", price: 2500, category: CATEGORY.EXTRAS, image: "pro7.png" },
    { id: "salad-box", name: "معون زلاطة", price: 1000, category: CATEGORY.EXTRAS, image: "pro8.png" },
    { id: "eggplant-box", name: "معون بيتتجان", price: 1500, category: CATEGORY.EXTRAS, image: "pro9.png" },
    { id: "stone-bread-8", name: "صمون حجري 8", price: 1000, category: CATEGORY.EXTRAS, image: "pro10.png" },
    { id: "stone-bread-4", name: "صمون حجري 4", price: 500, category: CATEGORY.EXTRAS, image: "pro11.png" },
    { id: "stone-bread-2", name: "صمون حجري 2", price: 250, category: CATEGORY.EXTRAS, image: "pro12.png" },

    { id: "pepsi", name: "بيسي", price: 500, category: CATEGORY.DRINKS, image: "pro13.png" },
    { id: "seven", name: "سفن", price: 500, category: CATEGORY.DRINKS, image: "pro14.png" },
    { id: "lemon", name: "لين", price: 500, category: CATEGORY.DRINKS, image: "pro15.png" },
    { id: "water", name: "ماء", price: 250, category: CATEGORY.DRINKS, image: "pro16.png" }
  ];

  /* 3. الأدوات العامة */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const money = value => {
    const amount = Math.max(0, Math.round(Number(value) || 0));
    return currentLanguage === "en"
      ? `${amount.toLocaleString("en-US")} IQD`
      : `${amount.toLocaleString("en-US")} د.ع`;
  };

  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  // تحديد اللغة قبل بناء قاموس النصوص حتى لا يتوقف الملف عند بدء التشغيل.
  let currentLanguage = safeStorageGet(LANGUAGE_KEY, "ar") === "en" ? "en" : "ar";

  const ui = {
    ar: {
      pageTitle: "مطعم الغنّام | فرع الفلافل",
      pageDescription: "منيو مطعم الغنّام - فرع الفلافل، وجبات طازجة وطلبات عبر واتساب",
      search: "ابحث عن وجبتك المفضلة...", searchAria: "ابحث عن وجبتك المفضلة",
      backHome: "العودة إلى الرئيسية", menu: "المنيو", mainNav: "التنقل الرئيسي",
      headerActions: "إعدادات الموقع", changeLanguage: "تغيير اللغة", openMenu: "فتح القائمة",
      menuSearch: "البحث في المنيو", categories: "أقسام المنيو", viewSettings: "إعدادات عرض المنيو",
      switchList: "التبديل إلى العرض الأفقي", switchGrid: "التبديل إلى عرض البطاقات",
      list: "العرض الأفقي", grid: "عرض البطاقات", products: "المنتجات", loadingMenu: "جارٍ تحميل المنيو...",
      add: "أضف إلى السلة", addAgain: "إضافة أخرى", emptySearch: "ما لقينا منتجات تطابق بحثك.",
      item: "صنف", items: "أصناف", inCart: "في السلة", emptyCart: "لا توجد منتجات في السلة",
      cartButton: "عرض السلة", cartTitle: "سلة مشترياتك 🛒", currentOrder: "طلبك الحالي",
      addToOrder: "أضف إلى طلبك", menuExtras: "إضافات من المنيو", swipe: "اسحب للتصفح ←",
      addAddon: "أضف للسلة", noAddons: "أضفتِ كل الإضافات والمشروبات المتاحة.",
      empty: "السلة فارغة، اختاري المنتجات اللي تحبينها.", decrease: "تقليل الكمية",
      increase: "زيادة الكمية", remove: "حذف المنتج", coupon: "كود الخصم", couponPlaceholder: "أدخل كود الخصم",
      apply: "تطبيق", enterCoupon: "أدخلي كود الخصم أولاً.", invalidCoupon: "الكود غير صحيح.",
      applied: "تم تطبيق خصم 15% بنجاح.", addFirst: "أضيفي منتجات إلى السلة أولاً.",
      subtotal: "المجموع الفرعي", discount: "الخصم", grandTotal: "الإجمالي النهائي", total: "الإجمالي",
      customerInfo: "معلومات الزبون", name: "الاسم", fullName: "الاسم الكامل", phone: "رقم الهاتف",
      address: "العنوان", addressPlaceholder: "منطقة السكن وأقرب نقطة دالة", extraNotes: "ملاحظات إضافية",
      notesPlaceholder: "أي ملاحظات على الطلب", sendWhatsApp: "إرسال الطلب عبر واتساب",
      continueShopping: "مواصلة التسوق", closeCart: "إغلاق السلة",
      cartEmptyOrder: "أضيفي منتجاً واحداً على الأقل قبل إرسال الطلب.",
      openingWhatsApp: "سيتم فتح واتساب لإكمال إرسال الطلب.",
      whatsappError: "تعذر فتح واتساب. اسمحي بفتح النوافذ المنبثقة ثم حاولي مجدداً.",
      savedCoupon: "كود GHANNAM15 محفوظ: خصم 15%.", couponNeedItems: "أضيفي منتجات إلى السلة أولاً.",
      orderTitle: "طلب جديد — مطعم الغنّام / فرع الفلافل", details: "تفاصيل الطلب", noCoupon: "لا يوجد",
      noNotes: "لا توجد", branchNumbers: "أرقام الفرع", menuPanel: "القائمة", navigation: "التنقل",
      homePage: "الصفحة الرئيسية", backBranches: "العودة إلى صفحة الفروع", foodMenu: "قائمة الطعام",
      goMenu: "الانتقال إلى المنيو", shoppingCart: "سلة المشتريات", showItemsTotal: "عرض المنتجات والإجمالي",
      restaurantInfo: "معلومات المطعم", restaurant: "مطعم الغنّام", branch: "فرع الفلافل",
      currency: "العملة", currencyName: "الدينار العراقي (د.ع)", help: "المساعدة والشكاوى",
      helpDesc: "للاستفسارات وتقديم الشكاوى", branchPhones: "أرقام الفرع", location: "موقع الفرع",
      locationAddress: "الإعلام، سوق أميمة، مقابل جامع المصطفى", closeMenu: "إغلاق القائمة",
      allPrices: "جميع الأسعار بالدينار العراقي", contactUs: "تواصل معنا",
      orderName: "الاسم", orderPhone: "الهاتف", orderAddress: "العنوان", discountCode: "كود الخصم",
      notes: "ملاحظات", noItems: "لا توجد", noCouponText: "لا يوجد",
      logoAlt: "شعار مطعم الغنّام", closeSideMenu: "إغلاق القائمة",
      locationPrefix: "الإعلام، سوق أميمة، مقابل جامع المصطفى",
      footerHome: "العودة إلى الصفحة الرئيسية", couponApplied: "تم تطبيق الخصم",
      loadingAddons: "جارٍ تحميل الإضافات...", searchProducts: "ابحث عن وجبتك المفضلة..."
    },
    en: {
      pageTitle: "Al Ghannam Restaurant | Falafel Branch",
      pageDescription: "Al Ghannam Restaurant menu – Falafel Branch. Fresh meals and WhatsApp orders.",
      search: "Search for your favorite meal...", searchAria: "Search for your favorite meal",
      backHome: "Back to Home", menu: "Menu", mainNav: "Main navigation",
      headerActions: "Site settings", changeLanguage: "Change language", openMenu: "Open menu",
      menuSearch: "Search the menu", categories: "Menu categories", viewSettings: "Menu display settings",
      switchList: "Switch to horizontal view", switchGrid: "Switch to grid view",
      list: "Horizontal view", grid: "Grid view", products: "Products", loadingMenu: "Loading menu...",
      add: "Add to Cart", addAgain: "Add another", emptySearch: "No products match your search.",
      item: "item", items: "items", inCart: "in cart", emptyCart: "Your cart is empty",
      cartButton: "View Cart", cartTitle: "Your Shopping Cart 🛒", currentOrder: "Your Order",
      addToOrder: "Add to Your Order", menuExtras: "Menu add-ons", swipe: "Swipe to browse →",
      addAddon: "Add to Cart", noAddons: "You have added all available extras and drinks.",
      empty: "Your cart is empty. Choose the items you like.", decrease: "Decrease quantity",
      increase: "Increase quantity", remove: "Remove item", coupon: "Discount Code", couponPlaceholder: "Enter discount code",
      apply: "Apply", enterCoupon: "Please enter the discount code first.", invalidCoupon: "Invalid discount code.",
      applied: "15% discount applied successfully.", addFirst: "Add products to your cart first.",
      subtotal: "Subtotal", discount: "Discount", grandTotal: "Grand Total", total: "Total",
      customerInfo: "Customer Information", name: "Name", fullName: "Full name", phone: "Phone Number",
      address: "Address", addressPlaceholder: "Your area and nearest landmark", extraNotes: "Additional Notes",
      notesPlaceholder: "Any notes about your order", sendWhatsApp: "Send Order via WhatsApp",
      continueShopping: "Continue Shopping", closeCart: "Close cart", cartEmptyOrder: "Add at least one item before submitting your order.",
      openingWhatsApp: "Opening WhatsApp to complete your order.",
      whatsappError: "Could not open WhatsApp. Allow pop-ups and try again.",
      savedCoupon: "GHANNAM15 saved: 15% discount.", couponNeedItems: "Add products to your cart first.",
      orderTitle: "New Order — Al Ghannam Restaurant / Falafel Branch", details: "Order Details", noCoupon: "None",
      noNotes: "None", branchNumbers: "Branch Numbers", menuPanel: "Menu", navigation: "Navigation",
      homePage: "Home Page", backBranches: "Back to branches", foodMenu: "Food Menu",
      goMenu: "Go to Menu", shoppingCart: "Shopping Cart", showItemsTotal: "View items and total",
      restaurantInfo: "Restaurant Information", restaurant: "Al Ghannam Restaurant", branch: "Falafel Branch",
      currency: "Currency", currencyName: "Iraqi Dinar (IQD)", help: "Help & Complaints",
      helpDesc: "For inquiries and complaints", branchPhones: "Branch Phone Numbers", location: "Branch Location",
      locationAddress: "Al-I'lam, Umayma Market, opposite Al-Mustafa Mosque", closeMenu: "Close Menu",
      allPrices: "All prices are in Iraqi dinars", contactUs: "Contact Us",
      orderName: "Name", orderPhone: "Phone", orderAddress: "Address", discountCode: "Discount Code",
      notes: "Notes", noItems: "None", noCouponText: "None",
      logoAlt: "Al Ghannam Restaurant logo", closeSideMenu: "Close menu",
      locationPrefix: "Al-I'lam, Umayma Market, opposite Al-Mustafa Mosque",
      footerHome: "Back to the Home Page", couponApplied: "Discount applied",
      loadingAddons: "Loading add-ons...", searchProducts: "Search for your favorite meal..."
    }
  };
  const t = key => ui[currentLanguage][key] ?? ui.ar[key] ?? key;
  const localEnglishProducts = {
    "falafel-wrap": ["Falafel Wrap", "Fresh falafel wrapped with vegetables and sauce"],
    "falafel-saj": ["Falafel Saj", "Fresh falafel saj sandwich"],
    "falafel-12": ["12 Falafel Pieces", "Twelve pieces of falafel"],
    "falafel-meal-medium": ["Medium Falafel Meal", "Medium falafel meal"],
    "falafel-meal-double": ["Double Falafel Meal", "Double falafel meal"],
    "falafel-dough": ["Falafel Dough", "Fresh falafel mixture"],
    "burger-beef": ["Beef Burger", "Beef burger with vegetables and sauce"],
    "burger-chicken": ["Chicken Burger", "Chicken burger with vegetables and sauce"],
    "burger-super-beef": ["Super Beef Burger", "Large beef burger with extra toppings"],
    "burger-super-chicken": ["Super Chicken Burger", "Large chicken burger with extra toppings"],
    "burger-meal-beef": ["Beef Burger Meal", "Beef burger meal"],
    "burger-meal-chicken": ["Chicken Burger Meal", "Chicken burger meal"],
    "fries-cup": ["Cup of Fries", "Fresh potato fries"],
    "fries-box": ["Box of Fries", "A large box of potato fries"],
    "salad-box": ["Salad Box", "Fresh salad"],
    "eggplant-box": ["Eggplant Side", "Eggplant side dish"],
    "stone-bread-8": ["Stone Bread (8 pieces)", "Eight pieces of stone bread"],
    "stone-bread-4": ["Stone Bread (4 pieces)", "Four pieces of stone bread"],
    "stone-bread-2": ["Stone Bread (2 pieces)", "Two pieces of stone bread"],
    "pepsi": ["Pepsi", "Pepsi soft drink"],
    "seven": ["7UP", "7UP soft drink"],
    "lemon": ["Lemon Drink", "Lemon-flavoured soft drink"],
    "water": ["Water", "Bottled water"]
  };
  const localEnglishCategories = {
    [CATEGORY.FALAFEL]: "Falafel",
    [CATEGORY.BURGER]: "Burgers",
    [CATEGORY.EXTRAS]: "Sides & Extras",
    [CATEGORY.DRINKS]: "Drinks"
  };
  const productName = product => currentLanguage === "en"
    ? (product.name_en || localEnglishProducts[product.id]?.[0] || product.name_ar || product.name || "")
    : (product.name_ar || product.name || "");
  const productDescription = product => currentLanguage === "en"
    ? (product.description_en || localEnglishProducts[product.id]?.[1] || product.description_ar || product.description || "")
    : (product.description_ar || product.description || "");
  const categoryName = category => currentLanguage === "en"
    ? (categoryEnglish.get(category) || localEnglishCategories[category] || category)
    : category;

  function applyStaticTranslations() {
    const isEnglish = currentLanguage === "en";
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = isEnglish ? "ltr" : "rtl";
    document.body.classList.toggle("language-en", isEnglish);

    // اتجاهات ومحاذاة العناصر الرئيسية تتبدل مع اللغة أيضاً.
    let directionStyle = document.getElementById("falafelLanguageDirectionStyle");
    if (!directionStyle) {
      directionStyle = document.createElement("style");
      directionStyle.id = "falafelLanguageDirectionStyle";
      document.head.appendChild(directionStyle);
    }
    directionStyle.textContent = isEnglish ? `
      html[dir="ltr"] body.language-en { direction: ltr; }
      html[dir="ltr"] .site-header,
      html[dir="ltr"] .main-nav,
      html[dir="ltr"] .header-actions,
      html[dir="ltr"] .settings-panel,
      html[dir="ltr"] .settings-panel-content,
      html[dir="ltr"] .cart-modal,
      html[dir="ltr"] .site-footer { direction: ltr; }
      html[dir="ltr"] .site-footer,
      html[dir="ltr"] .settings-panel-content { text-align: left; }
      html[dir="ltr"] .settings-menu-item,
      html[dir="ltr"] .settings-info-card,
      html[dir="ltr"] .settings-compact-card { direction: ltr; }
    ` : "";

    document.title = t("pageTitle");

    const description = $('meta[name="description"]');
    if (description) description.content = t("pageDescription");

    const set = (selector, key) => {
      const el = $(selector);
      if (el) el.textContent = t(key);
    };
    const attr = (selector, name, key) => {
      const el = $(selector);
      if (el) el.setAttribute(name, t(key));
    };

    // Header and page loader
    const langButton = $("#languageToggle");
    if (langButton) {
      langButton.textContent = isEnglish ? "AR" : "EN";
      langButton.setAttribute("aria-label", isEnglish ? "Switch to Arabic" : "تغيير اللغة");
      langButton.title = isEnglish ? "Switch to Arabic" : "تغيير اللغة";
    }
    set(".brand-copy strong", "restaurant");
    set(".brand-copy small", "branch");
    attr(".brand", "aria-label", "backHome");
    const logo = $(".brand img");
    if (logo) logo.alt = t("logoAlt");
    attr(".main-nav", "aria-label", "mainNav");
    attr(".header-actions", "aria-label", "headerActions");
    attr("#openSettingsPanel", "aria-label", "openMenu");
    attr("#closeSettingsPanel", "aria-label", "closeSideMenu");
    set("#pageLoader .loader-content p", "restaurant");
    const loaderHint = $("#pageLoader .loader-content span");
    if (loaderHint) loaderHint.textContent = isEnglish ? "Please wait..." : "يرجى الانتظار...";

    const navLinks = $$(".main-nav-link");
    if (navLinks[0]) navLinks[0].textContent = t("backHome");
    if (navLinks[1]) navLinks[1].textContent = t("menu");

    // Search, categories and product view controls
    attr(".menu-tools", "aria-label", "menuSearch");
    attr("#falafelSearch", "aria-label", "searchAria");
    if (searchInput) searchInput.placeholder = t("search");
    attr("#categoryNav", "aria-label", "categories");
    attr(".menu-heading-row", "aria-label", "viewSettings");
    attr("#menu", "aria-label", "products");
    if (viewToggleButton) updateProductView(getSavedProductView());

    // Cart bar and cart dialog
    attr("#fixedCartBar", "aria-label", "cartButton");
    attr("#closeCartModal", "aria-label", "closeCart");
    set(".fixed-cart-label strong", "cartButton");
    set("#cartModalTitle", "cartTitle");
    set(".cart-modal-header p", "branch");
    set(".popup-section-title", "currentOrder");
    set("#cartAddonsTitle", "addToOrder");
    set(".cart-addons-heading p", "menuExtras");
    set(".cart-addons-hint", "swipe");
    set(".coupon-box label", "coupon");
    if (couponInput) couponInput.placeholder = t("couponPlaceholder");
    set("#applyCouponButton", "apply");
    attr(".coupon-summary", "aria-label", "coupon");
    const summary = $$(".coupon-summary > div > span");
    ["subtotal", "discount", "grandTotal"].forEach((key, i) => {
      if (summary[i]) summary[i].textContent = t(key);
    });
    set(".popup-order-form h3", "customerInfo");
    const labels = $$(".popup-order-form label");
    ["name", "phone", "address", "extraNotes"].forEach((key, i) => {
      if (labels[i]) labels[i].textContent = t(key);
    });
    const fields = [
      ["#popupCustomerName", "fullName"],
      ["#popupCustomerPhone", "phone"],
      ["#popupCustomerAddress", "addressPlaceholder"],
      ["#popupCustomerNotes", "notesPlaceholder"]
    ];
    fields.forEach(([selector, key]) => {
      const el = $(selector);
      if (el) el.placeholder = t(key);
    });
    set(".popup-submit-button", "sendWhatsApp");
    set("#continueShoppingButton", "continueShopping");
    set(".popup-footer-total span", "total");

    // Side menu: every visible heading, link, information card and footer button
    set("#settingsPanelTitle", "menuPanel");
    set(".settings-panel-header p", "branch");
    const headings = $$(".settings-section-title");
    if (headings[0]) headings[0].textContent = t("navigation");
    if (headings[1]) headings[1].textContent = t("restaurantInfo");
    const menuStrong = $$(".settings-menu-item strong");
    const menuSmall = $$(".settings-menu-item small");
    [["homePage", "backBranches"], ["foodMenu", "goMenu"], ["shoppingCart", "showItemsTotal"], ["help", "helpDesc"]]
      .forEach(([titleKey, descKey], i) => {
        if (menuStrong[i]) menuStrong[i].textContent = t(titleKey);
        if (menuSmall[i]) menuSmall[i].textContent = t(descKey);
      });
    const infoStrong = $$(".settings-info-card strong");
    const infoP = $$(".settings-info-card p");
    if (infoStrong[0]) infoStrong[0].textContent = t("restaurant");
    if (infoP[0]) infoP[0].textContent = t("branch");
    if (infoStrong[1]) infoStrong[1].textContent = t("currency");
    if (infoP[1]) infoP[1].textContent = t("currencyName");
    const compactStrong = $$(".settings-compact-content > strong");
    if (compactStrong[0]) compactStrong[0].textContent = t("branchPhones");
    if (compactStrong[1]) compactStrong[1].textContent = t("location");
    set(".settings-location-link small", "locationAddress");
    set("#settingsDoneButton", "closeMenu");

    // Main site footer
    const footer = $(".site-footer");
    if (footer) {
      const footerPs = $$(".site-footer p");
      if (footerPs[0]) footerPs[0].textContent = `${t("restaurant")} — ${t("branch")}`;
      if (footerPs[1]) footerPs[1].textContent = t("locationAddress");
      if (footerPs[2]) {
        footerPs[2].innerHTML = `${escapeHTML(t("branchPhones"))}: <a href="tel:07760000552">07760000552</a> — <a href="tel:07860000556">07860000556</a>`;
      }
      if (footerPs[3]) footerPs[3].textContent = t("allPrices");
      const footerLink = $(".site-footer > a");
      if (footerLink) footerLink.textContent = t("footerHome");
    }

    if (couponStatus && activeCoupon) couponStatus.textContent = t("savedCoupon");
  }

  function setLanguage(language) {
    currentLanguage = language === "en" ? "en" : "ar";
    safeStorageSet(LANGUAGE_KEY, currentLanguage);
    applyStaticTranslations();
    renderMenu();
    renderCart();
  }

  $("#languageToggle")?.addEventListener("click", () => {
    setLanguage(currentLanguage === "ar" ? "en" : "ar");
  });

  const getProduct = id => products.find(product => product.id === id);

  // تبقى أيقونات عناوين أقسام المنيو والمنتج الاحتياطي، ولا تظهر في شريط التنقل.
  function getCategoryIcon(category) {
    switch (category) {
      case CATEGORY.FALAFEL: return "";
      case CATEGORY.BURGER: return "";
      case CATEGORY.EXTRAS: return "";
      case CATEGORY.DRINKS: return "";
      default: return "";
    }
  }

  function safeStorageGet(key, fallback = "") {
    try { return localStorage.getItem(key) ?? fallback; }
    catch { return fallback; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); }
    catch (error) { console.warn("تعذر حفظ البيانات:", error); }
  }

  function safeStorageRemove(key) {
    try { localStorage.removeItem(key); }
    catch (error) { console.warn("تعذر حذف البيانات المحفوظة:", error); }
  }

  /* 4. عناصر الصفحة والحالة */
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

  let currentSearch = "";
  let categoryEnglish = new Map();
  let cart = loadCart();
  let activeCoupon = loadCoupon();
  let lastCartFocus = null;
  let audioContext = null;

  /* 5. إدارة السلة المحفوظة */
  function loadCart() {
    try {
      const saved = JSON.parse(safeStorageGet(STORAGE_KEY, "[]"));
      if (!Array.isArray(saved)) return [];
      return saved.map(row => {
        const product = getProduct(row?.id);
        const qty = Number(row?.qty);
        if (!product || !Number.isFinite(qty)) return null;
        return { id: product.id, qty: Math.max(1, Math.min(99, Math.floor(qty))) };
      }).filter(Boolean);
    } catch { return []; }
  }

  function saveCart() { safeStorageSet(STORAGE_KEY, JSON.stringify(cart)); }

  function loadCoupon() {
    const code = safeStorageGet(COUPON_KEY, "").trim().toUpperCase();
    return code === COUPON_CODE ? code : "";
  }

  function qtyOf(id) { return cart.find(row => row.id === id)?.qty || 0; }
  function subtotal() {
    return cart.reduce((sum, row) => {
      const product = getProduct(row.id);
      return sum + (product ? product.price * row.qty : 0);
    }, 0);
  }
  function totalQty() { return cart.reduce((sum, row) => sum + row.qty, 0); }
  function discountAmount() { return activeCoupon ? Math.round(subtotal() * COUPON_RATE) : 0; }
  function grandTotal() { return Math.max(0, subtotal() - discountAmount()); }

  /* 6. صوت الجرس عند إضافة منتج */
  function playBellSound() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContext || audioContext.state === "closed") audioContext = new AudioContextClass();

      const play = () => {
        const now = audioContext.currentTime;
        [1046.5, 1318.5].forEach((frequency, index) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const start = now + index * 0.09;
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start(start);
          oscillator.stop(start + 0.6);
        });
      };

      if (audioContext.state === "suspended") audioContext.resume().then(play).catch(() => {});
      else play();
    } catch (error) { console.warn("تعذر تشغيل صوت الجرس:", error); }
  }

  /* 7. تبديل عرض المنتجات: grid = بطاقات، list = أفقي */
  function getSavedProductView() {
    return safeStorageGet(PRODUCT_VIEW_KEY, "grid") === "list" ? "list" : "grid";
  }

  function updateProductView(view) {
    if (!menu) return;
    const isListView = view === "list";
    menu.classList.toggle("list-view", isListView);

    if (viewToggleButton) {
      viewToggleButton.setAttribute("aria-pressed", String(isListView));
      viewToggleButton.setAttribute("aria-label", isListView ? t("switchGrid") : t("switchList"));
      viewToggleButton.title = isListView ? t("grid") : t("list");
    }

    if (viewToggleIcon) {
      viewToggleIcon.innerHTML = isListView
        ? `<rect x="3" y="3" width="7" height="7" rx="1"></rect>
           <rect x="14" y="3" width="7" height="7" rx="1"></rect>
           <rect x="3" y="14" width="7" height="7" rx="1"></rect>
           <rect x="14" y="14" width="7" height="7" rx="1"></rect>`
        : `<path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path>`;
    }

    safeStorageSet(PRODUCT_VIEW_KEY, isListView ? "list" : "grid");
  }

  function initializeProductView() {
    updateProductView(getSavedProductView());
    viewToggleButton?.addEventListener("click", () => {
      const isCurrentlyList = menu?.classList.contains("list-view");
      updateProductView(isCurrentlyList ? "grid" : "list");
    });
  }

  /* 8. الصور: رابط قاعدة البيانات أولاً، ثم الصورة المحلية كاحتياط */
  function localProductImage(product) {
    return IMAGE_FOLDER + (product.image || "");
  }

  function productImageSource(product) {
    return product.databaseImageUrl || localProductImage(product);
  }

  function imageFallbackHandler() {
    return `if (this.dataset.fallback && !this.dataset.fallbackUsed) { this.dataset.fallbackUsed = "1"; this.src = this.dataset.fallback; } else { this.style.display = "none"; const placeholder = this.nextElementSibling; if (placeholder) placeholder.style.display = "flex"; }`;
  }

  /* 8. إنشاء بطاقة المنتج */
  function productCardHTML(product) {
    const quantity = qtyOf(product.id);
    const imagePath = productImageSource(product);
    const fallbackPath = localProductImage(product);
    const name = productName(product);
    const description = productDescription(product);
    return `
      <article class="product-card" data-product-id="${escapeHTML(product.id)}">
        <div class="product-image-box">
          <img src="${escapeHTML(imagePath)}" data-fallback="${escapeHTML(fallbackPath)}" alt="${escapeHTML(name)}" loading="lazy"
            onerror='${imageFallbackHandler()}'>
          <div class="product-placeholder" style="display:none">${getCategoryIcon(product.category)}</div>
        </div>
        <div class="product-details">
          <h3 class="product-name">${escapeHTML(name)}</h3>
          ${description ? `<p class="ghannam-db-description">${escapeHTML(description)}</p>` : ""}
          <div class="product-price">${money(product.price)}</div>
          <button type="button" class="add-to-cart-button" data-add="${escapeHTML(product.id)}">
            ${quantity ? `${t("addAgain")} (${quantity})` : t("add")}
          </button>
        </div>
      </article>`;
  }

  /* 9. التصنيفات — أسماء فقط من دون أيقونات في شريط التنقل */
  function getCategories() {
    return [CATEGORY.FALAFEL, CATEGORY.BURGER, CATEGORY.EXTRAS, CATEGORY.DRINKS]
      .filter(category => products.some(product => product.category === category));
  }

  function renderCategories(visibleCategories = getCategories()) {
    if (!categoryNav) return;
    categoryNav.innerHTML = visibleCategories.map((category, index) => `
      <a href="#falafel-category-${index}"
         data-category-index="${index}"
         class="${index === 0 ? "active" : ""}">
        ${escapeHTML(categoryName(category))}
      </a>`).join("");
  }

  /* 10. عرض المنيو والبحث */
  function renderMenu() {
    if (!menu) return;
    const query = currentSearch.trim().toLocaleLowerCase();
    const filtered = products.filter(product => {
      const searchable = [product.name, product.name_ar, product.name_en, product.description_ar, product.description_en, product.category, categoryName(product.category)]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      return !query || searchable.includes(query);
    });

    if (!filtered.length) {
      menu.innerHTML = `<p class="empty-message">${escapeHTML(t("emptySearch"))}</p>`;
      renderCategories([]);
      updateProductView(getSavedProductView());
      return;
    }

    const visibleCategories = getCategories().filter(category =>
      filtered.some(product => product.category === category)
    );

    menu.innerHTML = visibleCategories.map((category, index) => {
      const rows = filtered.filter(product => product.category === category);
      return `
        <section class="menu-section" id="falafel-category-${index}">
          <h2 class="section-title">${getCategoryIcon(category)} ${escapeHTML(categoryName(category))}</h2>
          <div class="product-grid">${rows.map(productCardHTML).join("")}</div>
        </section>`;
    }).join("");

    updateProductView(getSavedProductView());
    renderCategories(visibleCategories);
  }

  /* 11. إضافة المنتجات وتعديل الكميات */
  function addToCart(id, amount = 1) {
    const product = getProduct(id);
    if (!product) return;
    const row = cart.find(item => item.id === id);
    const increment = Math.max(1, Math.floor(Number(amount) || 1));
    if (row) row.qty = Math.min(99, row.qty + increment);
    else cart.push({ id, qty: Math.min(99, increment) });
    saveCart();
    renderMenu();
    renderCart();
    playBellSound();
  }

  function changeQty(id, amount) {
    const row = cart.find(item => item.id === id);
    if (!row) return;
    row.qty += Number(amount) || 0;
    if (row.qty <= 0) cart = cart.filter(item => item.id !== id);
    else row.qty = Math.min(99, row.qty);
    saveCart();
    renderMenu();
    renderCart();
  }

  function removeFromCart(id) {
    cart = cart.filter(row => row.id !== id);
    saveCart();
    renderMenu();
    renderCart();
  }

  /* 12. تحديث نصوص السلة */
  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function renderCart() {
    const count = totalQty();
    const sub = subtotal();
    const discount = discountAmount();
    const total = grandTotal();
    const countText = `${count} ${count === 1 ? t("item") : t("items")}`;

    setText("#cartCount", countText);
    setText("#falafelTotal", money(total));
    setText("#fixedCartCount", count);
    setText("#fixedCartSubtitle", count ? `${countText} ${t("inCart")}` : t("emptyCart"));
    setText("#fixedCartTotal", money(total));
    setText("#popupSubtotal", money(sub));
    setText("#popupDiscount", money(discount));
    setText("#popupGrandTotal", money(total));
    setText("#popupFooterTotal", money(total));

    if (popupItems) {
      popupItems.innerHTML = cart.length ? cart.map(row => {
        const product = getProduct(row.id);
        if (!product) return "";
        return `
          <div class="cart-item">
            <div class="cart-item-info">
              <div class="cart-item-name">${escapeHTML(productName(product))}</div>
              <div class="cart-item-price">${money(product.price * row.qty)}</div>
            </div>
            <div class="quantity-controls">
              <button type="button" data-qty="${escapeHTML(row.id)}" data-delta="-1" aria-label="${escapeHTML(t("decrease"))}">−</button>
              <strong>${row.qty}</strong>
              <button type="button" data-qty="${escapeHTML(row.id)}" data-delta="1" aria-label="${escapeHTML(t("increase"))}">+</button>
              <button type="button" data-remove="${escapeHTML(row.id)}" aria-label="${escapeHTML(t("remove"))}">×</button>
            </div>
          </div>`;
      }).join("") : `<p class="empty-message">${escapeHTML(t("empty"))}</p>`;
    }

    const legacyItems = $("#falafelCartItems");
    if (legacyItems) {
      legacyItems.innerHTML = cart.map(row => {
        const product = getProduct(row.id);
        return product ? `<p>${escapeHTML(productName(product))} × ${row.qty}</p>` : "";
      }).join("");
    }
    renderAddons();
  }

  /* 13. اقتراح الإضافات والمشروبات داخل السلة */
  function renderAddons() {
    if (!addonsList) return;
    const suggestions = products.filter(product =>
      (product.category === CATEGORY.EXTRAS || product.category === CATEGORY.DRINKS) &&
      !cart.some(row => row.id === product.id)
    );

    addonsList.innerHTML = suggestions.length ? `
      <div class="addons-grid">
        ${suggestions.map(product => `
          <div class="addon-card">
            <img
              class="addon-image"
              src="${escapeHTML(productImageSource(product))}"
              data-fallback="${escapeHTML(localProductImage(product))}"
              alt="${escapeHTML(productName(product))}"
              loading="lazy"
              onerror='${imageFallbackHandler()}'
            >
            <strong>${escapeHTML(productName(product))}</strong>
            <span>${money(product.price)}</span>
            <button type="button" data-addon="${escapeHTML(product.id)}">${escapeHTML(t("addAddon"))}</button>
          </div>`).join("")}
      </div>` : `<p class="addons-loading">${escapeHTML(t("noAddons"))}</p>`;
  }

  /* 14. فتح وإغلاق نافذة السلة */
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
    if (lastCartFocus && lastCartFocus.isConnected) lastCartFocus.focus();
    else fixedCartBar?.focus();
  }

  /* 15. كود الخصم GHANNAM15 */
  function applyCoupon() {
    const code = (couponInput?.value || "").trim().toUpperCase();
    if (code === COUPON_CODE) {
      if (subtotal() <= 0) {
        if (couponStatus) {
          couponStatus.textContent = t("couponNeedItems");
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

  /* 16. إرسال الطلب عبر واتساب */
  function submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!cart.length) {
      setText("#popupOrderStatus", t("cartEmptyOrder"));
      return;
    }
    if (!form.reportValidity()) return;

    const name = $("#popupCustomerName")?.value.trim() || "";
    const phone = $("#popupCustomerPhone")?.value.trim() || "";
    const address = $("#popupCustomerAddress")?.value.trim() || "";
    const notes = $("#popupCustomerNotes")?.value.trim() || "";
    if (!name || !phone || !address) return;

    const lines = cart.map(row => {
      const product = getProduct(row.id);
      return product ? `• ${productName(product)} × ${row.qty} = ${money(product.price * row.qty)}` : "";
    }).filter(Boolean);

    const message = [
      t("orderTitle"),
      `${t("orderName")}: ${name}`,
      `${t("orderPhone")}: ${phone}`,
      `${t("orderAddress")}: ${address}`,
      "",
      `${t("details")}:`,
      ...lines,
      "",
      `${t("subtotal")}: ${money(subtotal())}`,
      `${t("discount")}: ${money(discountAmount())}`,
      `${t("grandTotal")}: ${money(grandTotal())}`,
      `${t("discountCode")}: ${activeCoupon || t("noCouponText")}`,
      `${t("notes")}: ${notes || t("noItems")}`,
      "",
      `${t("branchNumbers")}: ${WHATSAPP_NUMBERS.join(" — ")}`
    ].join("\n");

    setText("#popupOrderStatus", t("openingWhatsApp"));
    const waNumber = WHATSAPP_NUMBERS[0].replace(/\D/g, "").replace(/^0/, "");
    const url = `https://wa.me/964${waNumber}?text=${encodeURIComponent(message)}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) setText("#popupOrderStatus", t("whatsappError"));
  }

  /* 17. أحداث المنتجات والسلة */
  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const addButton = target.closest("[data-add]");
    if (addButton) { addToCart(addButton.dataset.add); return; }

    const quantityButton = target.closest("[data-qty]");
    if (quantityButton) {
      changeQty(quantityButton.dataset.qty, Number(quantityButton.dataset.delta));
      return;
    }

    const removeButton = target.closest("[data-remove]");
    if (removeButton) { removeFromCart(removeButton.dataset.remove); return; }

    const addonButton = target.closest("[data-addon]");
    if (addonButton) addToCart(addonButton.dataset.addon);
  });

  /* 18. البحث */
  searchInput?.addEventListener("input", () => {
    currentSearch = searchInput.value.trim();
    renderMenu();
  });

  /* 19. التنقل بين التصنيفات */
  categoryNav?.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a[data-category-index]");
    if (!link) return;
    $$(".category-nav a").forEach(item => item.classList.toggle("active", item === link));
  });

  /* 20. أحداث نافذة السلة والخصم والطلب */
  fixedCartBar?.addEventListener("click", openCart);
  $("#closeCartModal")?.addEventListener("click", closeCart);
  $("#continueShoppingButton")?.addEventListener("click", closeCart);
  cartOverlay?.addEventListener("click", event => {
    if (event.target === cartOverlay) closeCart();
  });
  $("#applyCouponButton")?.addEventListener("click", applyCoupon);
  couponInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyCoupon();
    }
  });
  $("#popupOrderForm")?.addEventListener("submit", submitOrder);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && cartOverlay && !cartOverlay.hidden) closeCart();
  });

  /* 21. توافق نموذج الطلب القديم */
  $("#falafelOrderForm")?.addEventListener("submit", event => event.preventDefault());

  /* 22. استعادة كود الخصم المحفوظ */
  if (activeCoupon && couponInput) {
    couponInput.value = activeCoupon;
    if (couponStatus) {
      couponStatus.textContent = t("savedCoupon");
      couponStatus.style.color = "#18864b";
    }
  }

  /* 23. تحميل روابط صور المنتجات من Supabase فقط.
     لا نستبدل أسماء المنتجات أو أسعارها أو تصنيفاتها أو بيانات السلة. */
  function normalizeDatabaseImage(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    const raw = value.trim();

    // روابط عامة كاملة من Supabase Storage أو أي مصدر صور آخر.
    if (/^https?:\/\//i.test(raw)) return raw;

    // مسار محلي واضح يبدأ من جذر الموقع.
    if (raw.startsWith("/")) return raw;

    const clean = raw.split("?")[0].replace(/\\/g, "/");
    if (clean.startsWith("imagefalafel/")) return clean;

    // إذا خزّنت قاعدة البيانات اسم الملف فقط، نبحث عنه داخل مجلد صور الفلافل.
    if (!clean.includes("/")) return IMAGE_FOLDER + clean;

    // مسار نسبي آخر غير معروف (مثل مسار Bucket خاص) لا نخمن رابطه.
    return "";
  }

  async function loadDatabaseProductImages() {
    try {
      // استيراد ديناميكي حتى لا تتعطل الصفحة إذا كانت إعدادات Supabase غير جاهزة.
      const menuDatabase = await import("./menu-db.js");
      const result = await menuDatabase.loadBranchMenu("falafel", currentLanguage);
      const databaseProducts = Array.isArray(result?.products) ? result.products : [];
      let updatedCount = 0;

      databaseProducts.forEach(databaseProduct => {
        const sourceId = String(
          databaseProduct?.extra?.source_product_id ||
          databaseProduct?.source_product_id ||
          databaseProduct?.id ||
          ""
        );
        const localProduct = products.find(product => product.id === sourceId);
        if (!localProduct) return;

        // image_url هو المصدر الأساسي. نقبل image_path إذا كان رابطاً عاماً
        // أو مساراً محلياً واضحاً، ثم extra.local_image_path كخيار أخير.
        const imageCandidates = [
          databaseProduct.image_url,
          databaseProduct.image_path,
          databaseProduct.extra?.local_image_path
        ];
        const databaseImage = imageCandidates.map(normalizeDatabaseImage).find(Boolean);

        if (databaseImage) {
          localProduct.databaseImageUrl = databaseImage;
          updatedCount++;
        }
      });

      if (updatedCount) {
        console.info(`تم تحميل ${updatedCount} رابط صورة من قاعدة البيانات.`);
        renderMenu();
        renderAddons();
      } else {
        console.info("لم يتم العثور على روابط صور صالحة لمنتجات فرع الفلافل؛ سيتم استخدام الصور المحلية.");
      }
    } catch (error) {
      // استمرار عرض الموقع بالصور المحلية إذا تعذر الاتصال بقاعدة البيانات.
      console.warn("تعذر تحميل صور المنتجات من قاعدة البيانات، سيتم استخدام الصور المحلية:", error);
    }
  }

  /* 24. تشغيل الصفحة واللغة وقاعدة البيانات */
  applyStaticTranslations();
  initializeProductView();
  renderMenu();
  renderCart();
  loadDatabaseProductImages();
})();
