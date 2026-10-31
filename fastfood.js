import {
  loadBranchMenu,
  ensureMenuDescriptionStyle,
  getStoredImageName
} from "./menu-db.js";

/* =====================================================
   مطعم الغنّام — فرع الوجبات السريعة
   القائمة المحلية احتياطية، وSupabase هو مصدر الترجمات.
===================================================== */
(() => {
  "use strict";

  const STORAGE_KEY = "alghannam_fastfood_cart_v1";
  const COUPON_KEY = "alghannam_fastfood_coupon_v1";
  const PRODUCT_VIEW_KEY = "alghannam_fastfood_product_view";
  const LANGUAGE_KEY = "alghannam_fastfood_language";

  const WHATSAPP_NUMBERS = ["07760000552", "07860000556"];
  const COUPON_CODE = "GHANNAM15";
  const COUPON_RATE = 0.15;
  const IMAGE_FOLDER = "imagefastfood/";
  const MEAL_UPGRADE_PRICE = 1500;

  const products = [
    { id:"shawarma-beef-kilo", name:"كيلو شاورما لحم", price:30000, category:"الشاورما", image:"shawarma-beef-kilo.png", emoji:"🥙", mealUpgrade:false },
    { id:"shawarma-beef-half-kilo", name:"نصف كيلو شاورما لحم", price:15000, category:"الشاورما", image:"shawarma-beef-half-kilo.png", emoji:"🥙", mealUpgrade:false },
    { id:"shawarma-beef-quarter-kilo", name:"ربع كيلو شاورما لحم", price:7500, category:"الشاورما", image:"shawarma-beef-quarter-kilo.png", emoji:"🥙", mealUpgrade:false },
    { id:"shawarma-chicken-kilo", name:"كيلو شاورما دجاج", price:20000, category:"الشاورما", image:"shawarma-chicken-kilo.png", emoji:"🥙", mealUpgrade:false },
    { id:"shawarma-chicken-half-kilo", name:"نصف كيلو شاورما دجاج", price:10000, category:"الشاورما", image:"shawarma-chicken-half-kilo.png", emoji:"🥙", mealUpgrade:false },
    { id:"shawarma-chicken-quarter-kilo", name:"ربع كيلو شاورما دجاج", price:6000, category:"الشاورما", image:"shawarma-chicken-quarter-kilo.png", emoji:"🥙", mealUpgrade:false },
    { id:"shawarma-chicken-plate", name:"نفر شاورما دجاج", price:12000, category:"الشاورما", image:"shawarma-chicken-plate.png", emoji:"🥙", mealUpgrade:false },
    { id:"shawarma-beef-plate", name:"نفر شاورما لحم", price:16000, category:"الشاورما", image:"shawarma-beef-plate.png", emoji:"🥙", mealUpgrade:false },
    { id:"shawarma-beef-half-plate", name:"نصف نفر شاورما لحم", price:7000, category:"الشاورما", image:"shawarma-beef-half-plate.png", emoji:"🥙", mealUpgrade:false },
    { id:"shawarma-chicken-half-plate", name:"نصف نفر شاورما دجاج", price:8000, category:"الشاورما", image:"shawarma-chicken-half-plate.png", emoji:"🥙", mealUpgrade:false },
    { id:"kas-beef-wrap", name:"لفة كص لحم", price:3000, category:"الشاورما", image:"kas-beef-wrap.png", emoji:"🥙", mealUpgrade:false },
    { id:"kas-chicken-wrap", name:"لفة كص دجاج", price:2500, category:"الشاورما", image:"kas-chicken-wrap.png", emoji:"🥙", mealUpgrade:false },

    { id:"kentucky-3-pieces", name:"وجبة كنتاكي 3 قطع", price:6000, category:"الكنتاكي والستربس", image:"kentucky-3-pieces.png", emoji:"🍗", mealUpgrade:false },
    { id:"kentucky-7-pieces", name:"وجبة كنتاكي 7 قطع", price:12000, category:"الكنتاكي والستربس", image:"kentucky-7-pieces.png", emoji:"🍗", mealUpgrade:false },
    { id:"kentucky-14-pieces", name:"وجبة كنتاكي 14 قطعة", price:24000, category:"الكنتاكي والستربس", image:"kentucky-14-pieces.png", emoji:"🍗", mealUpgrade:false },
    { id:"strips-4-pieces", name:"وجبة ستربس 4 قطع", price:6000, category:"الكنتاكي والستربس", image:"strips-4-pieces.png", emoji:"🍗", mealUpgrade:false },
    { id:"strips-8-pieces", name:"وجبة ستربس 8 قطع", price:12000, category:"الكنتاكي والستربس", image:"strips-8-pieces.png", emoji:"🍗", mealUpgrade:false },

    { id:"zinger", name:"زنكر", price:3500, category:"السندويشات", image:"zinger.png", emoji:"🥪", mealUpgrade:true },
    { id:"scallop", name:"سكالوب", price:3500, category:"السندويشات", image:"scallop.png", emoji:"🥪", mealUpgrade:true },
    { id:"fajita-beef", name:"فاهيتا لحم", price:3500, category:"السندويشات", image:"fajita-beef.png", emoji:"🥪", mealUpgrade:true },
    { id:"fajita-chicken", name:"فاهيتا دجاج", price:5000, category:"السندويشات", image:"fajita-chicken.png", emoji:"🥪", mealUpgrade:true },
    { id:"double-super-ghannam-burger", name:"بركر دبل سوبر الغنام", price:4000, category:"السندويشات", image:"double-super-ghannam-burger.png", emoji:"🥪", mealUpgrade:true },
    { id:"twister", name:"تويستر", price:5000, category:"السندويشات", image:"twister.png", emoji:"🥪", mealUpgrade:true },

    { id:"rizo-kentucky", name:"ريزو كنتاكي", price:5000, category:"الريزو", image:"rizo-kentucky.png", emoji:"🍚", mealUpgrade:false },
    { id:"rizo-beef-shawarma", name:"ريزو شاورما لحم", price:5000, category:"الريزو", image:"rizo-beef-shawarma.png", emoji:"🍚", mealUpgrade:false },
    { id:"rizo-chicken-shawarma", name:"ريزو شاورما دجاج", price:5000, category:"الريزو", image:"rizo-chicken-shawarma.png", emoji:"🍚", mealUpgrade:false },

    { id:"fries-plate", name:"طبق فنكر", price:2000, category:"الفنكر", image:"fries-plate.png", emoji:"🍟", mealUpgrade:false },
    { id:"cheese-fries", name:"فنكر بالجبن", price:2500, category:"الفنكر", image:"cheese-fries.png", emoji:"🍟", mealUpgrade:false },
    { id:"mexican-fries", name:"فنكر مكسيك", price:3000, category:"الفنكر", image:"mexican-fries.png", emoji:"🍟", mealUpgrade:false },
    { id:"fries-cup", name:"قدح فنكر", price:1000, category:"الفنكر", image:"fries-cup.png", emoji:"🍟", mealUpgrade:false },

    { id:"pizza-beef", name:"بيتزا لحم", price:7000, category:"البيتزا", image:"pizza-beef.png", emoji:"🍕", mealUpgrade:false },
    { id:"pizza-chicken", name:"بيتزا دجاج", price:7000, category:"البيتزا", image:"pizza-chicken.png", emoji:"🍕", mealUpgrade:false },
    { id:"pizza-vegetable", name:"بيتزا خضار", price:7000, category:"البيتزا", image:"pizza-vegetable.png", emoji:"🍕", mealUpgrade:false },
    { id:"pizza-mixed", name:"بيتزا مشكل", price:7000, category:"البيتزا", image:"pizza-mixed.png", emoji:"🍕", mealUpgrade:false },
    { id:"pizza-pepperoni", name:"بيتزا ببروني", price:7000, category:"البيتزا", image:"pizza-pepperoni.png", emoji:"🍕", mealUpgrade:false },
    { id:"pizza-zaatar", name:"بيتزا زعتر", price:7000, category:"البيتزا", image:"pizza-zaatar.png", emoji:"🍕", mealUpgrade:false },

    { id:"burger-classic", name:"بركر كلاسيك", price:3500, category:"البركر", image:"burger-classic.png", emoji:"🍔", mealUpgrade:true },
    { id:"burger-cheese", name:"تشيز بركر", price:3500, category:"البركر", image:"burger-cheese.png", emoji:"🍔", mealUpgrade:true },
    { id:"burger-mexican", name:"مكسيك بركر", price:3500, category:"البركر", image:"burger-mexican.png", emoji:"🍔", mealUpgrade:true },
    { id:"burger-bbq", name:"باربكيو بركر", price:3500, category:"البركر", image:"burger-bbq.png", emoji:"🍔", mealUpgrade:true },
    { id:"burger-chicken", name:"بركر دجاج", price:3000, category:"البركر", image:"burger-chicken.png", emoji:"🍔", mealUpgrade:true },

    { id:"saj-beef-arabic", name:"صاج لحم عربي", price:4000, category:"الصاج", image:"saj-beef-arabic.png", emoji:"🫓", mealUpgrade:false },
    { id:"saj-chicken-arabic", name:"صاج دجاج عربي", price:4000, category:"الصاج", image:"saj-chicken-arabic.png", emoji:"🫓", mealUpgrade:false },
    { id:"saj-beef-italian", name:"صاج إيطالي لحم", price:6000, category:"الصاج", image:"saj-beef-italian.png", emoji:"🫓", mealUpgrade:false },
    { id:"saj-chicken-italian", name:"صاج إيطالي دجاج", price:6000, category:"الصاج", image:"saj-chicken-italian.png", emoji:"🫓", mealUpgrade:false },
    { id:"saj-family-arabic", name:"صاج عائلي عربي", price:10000, category:"الصاج", image:"saj-family-arabic.png", emoji:"🫓", mealUpgrade:false },

    { id:"falafel-wrap", name:"لفة فلافل", price:1000, category:"الفلافل", image:"falafel-wrap.png", emoji:"🥙", mealUpgrade:false },
    { id:"falafel-saj", name:"صاج فلافل", price:1500, category:"الفلافل", image:"falafel-saj.png", emoji:"🥙", mealUpgrade:false },
    { id:"falafel-meal", name:"وجبة فلافل", price:3000, category:"الفلافل", image:"falafel-meal.png", emoji:"🥙", mealUpgrade:false },
    { id:"falafel-10", name:"فلافل 10 حبات", price:1000, category:"الفلافل", image:"falafel-10.png", emoji:"🥙", mealUpgrade:false },

    { id:"appetizers-small", name:"صحن مقبلات صغير", price:2000, category:"المقبلات", image:"appetizers-small.png", emoji:"🥗", mealUpgrade:false },
    { id:"appetizers-medium", name:"صحن مقبلات وسط", price:3000, category:"المقبلات", image:"appetizers-medium.png", emoji:"🥗", mealUpgrade:false },
    { id:"appetizers-plate", name:"طبق مقبلات", price:1000, category:"المقبلات", image:"appetizers-plate.png", emoji:"🥗", mealUpgrade:false },
    { id:"appetizers-family", name:"صحن مقبلات عائلي", price:null, category:"المقبلات", image:"appetizers-family.png", emoji:"🥗", mealUpgrade:false },

    { id:"cheese-addon", name:"جبن", price:500, category:"الإضافات", image:"cheese-addon.png", emoji:"🧀", mealUpgrade:false },
    { id:"shawarma-fat", name:"صحن لية شاورما", price:500, category:"الإضافات", image:"shawarma-fat.png", emoji:"🧀", mealUpgrade:false },
    { id:"rice-plate", name:"طبق رز", price:500, category:"الإضافات", image:"rice-plate.png", emoji:"🧀", mealUpgrade:false },
    { id:"salad-plate", name:"صحن زلاطة", price:1000, category:"الإضافات", image:"salad-plate.png", emoji:"🧀", mealUpgrade:false },

    { id:"garlic-sauce", name:"ثومية", price:null, category:"الصوص", image:"garlic-sauce.png", emoji:"🥣", mealUpgrade:false },
    { id:"spicy-sauce", name:"سبايسي", price:null, category:"الصوص", image:"spicy-sauce.png", emoji:"🥣", mealUpgrade:false },
    { id:"burger-sauce", name:"صوص بركر", price:null, category:"الصوص", image:"burger-sauce.png", emoji:"🥣", mealUpgrade:false },
    { id:"cheese-sauce", name:"صوص جبن", price:null, category:"الصوص", image:"cheese-sauce.png", emoji:"🥣", mealUpgrade:false },

    { id:"pepsi", name:"بيبسي", price:500, category:"المشروبات", image:"pepsi.png", emoji:"🥤", mealUpgrade:false },
    { id:"seven-up", name:"سفن أب", price:null, category:"المشروبات", image:"seven-up.png", emoji:"🥤", mealUpgrade:false },
    { id:"machine-pepsi", name:"بيبسي مكينة", price:1000, category:"المشروبات", image:"machine-pepsi.png", emoji:"🥤", mealUpgrade:false },
    { id:"machine-laban", name:"لبن مكينة", price:1000, category:"المشروبات", image:"machine-laban.png", emoji:"🥤", mealUpgrade:false },
    { id:"water", name:"ماء", price:250, category:"المشروبات", image:"water.png", emoji:"🥤", mealUpgrade:false }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);

  function safeStorageGet(key, fallback = "") {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }
  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (error) { console.warn("تعذر حفظ البيانات:", error); }
  }
  function safeStorageRemove(key) {
    try { localStorage.removeItem(key); } catch (error) { console.warn("تعذر حذف البيانات:", error); }
  }

  let currentLanguage = safeStorageGet(LANGUAGE_KEY, "ar") === "en" ? "en" : "ar";
  let currentSearch = "";
  let activeCategory = "";
  let cart = [];
  let activeCoupon = safeStorageGet(COUPON_KEY, "").toUpperCase() === COUPON_CODE;
  let lastCartFocus = null;
  let audioContext = null;
  let categoryEnglish = new Map();

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

  const ui = {
    ar: {
      pageTitle:"مطعم الغنّام | فرع الوجبات السريعة",
      pageDescription:"منيو مطعم الغنّام - فرع الوجبات السريعة، شاورما وبركر وبيتزا وطلبات عبر واتساب",
      brandName:"مطعم الغنّام", branchName:"فرع الوجبات السريعة", branchFullName:"مطعم الغنّام — فرع الوجبات السريعة",
      logoAlt:"شعار مطعم الغنّام", brandAria:"العودة إلى مطعم الغنّام",
      mainNavAria:"التنقل الرئيسي", headerActionsAria:"إعدادات الموقع", languageToggleAria:"تغيير اللغة",
      openMenuAria:"فتح القائمة", backHome:"العودة إلى الرئيسية", menu:"المنيو",
      heroEyebrow:"مطعم الغنّام • طعم شعبي أصيل", heroTitle:"الوجبات السريعة",
      heroDescription:"شاورما • كنتاكي • سندويشات • بركر • بيتزا", browseMenu:"تصفح المنيو الآن",
      searchSectionAria:"البحث في المنيو", searchPagePlaceholder:"ابحث عن شاورما أو بركر أو بيتزا...",
      searchInputAria:"ابحث عن منتجات الوجبات السريعة", categoriesAria:"أقسام المنيو",
      viewSettingsAria:"إعدادات عرض المنيو", productsAria:"المنتجات", loadingMenu:"جارٍ تحميل قائمة الوجبات السريعة...",
      openCartAria:"فتح سلة المشتريات", viewCart:"عرض السلة", cartTitle:"سلة مشترياتك 🛒",
      closeCartAria:"إغلاق السلة", currentOrder:"طلبك الحالي", addToOrder:"أضف إلى طلبك",
      menuAddons:"إضافات من المنيو", swipeBrowse:"اسحب للتصفح ←", loadingAddons:"جارٍ تحميل الإضافات...",
      couponCode:"🎟️ كود الخصم", enterCouponPlaceholder:"أدخل كود الخصم", applyCoupon:"تطبيق",
      summaryAria:"ملخص الحساب", subtotalLabel:"المجموع الفرعي", discountLabel:"الخصم",
      finalTotalLabel:"الإجمالي النهائي", customerInfo:"معلومات الزبون", nameLabel:"الاسم",
      namePlaceholder:"الاسم الكامل", phoneLabel:"رقم الهاتف", phonePlaceholder:"رقم الهاتف",
      addressLabel:"العنوان", addressPlaceholder:"منطقة السكن وأقرب نقطة دالة",
      notesLabel:"ملاحظات إضافية", notesPlaceholder:"أي ملاحظات على الطلب",
      sendWhatsApp:"إرسال الطلب عبر واتساب", continueShopping:"مواصلة التسوق", totalLabel:"الإجمالي",
      closeMenuAria:"إغلاق القائمة", sideMenuTitle:"القائمة", navigationTitle:"التنقل",
      homePage:"الصفحة الرئيسية", returnBranches:"العودة إلى صفحة الفروع", foodMenu:"قائمة الطعام",
      goToMenu:"الانتقال إلى المنيو", shoppingCart:"سلة المشتريات", viewItemsTotal:"عرض المنتجات والإجمالي",
      restaurantInfo:"معلومات المطعم", currency:"العملة", currencyName:"الدينار العراقي (د.ع)",
      helpComplaints:"المساعدة والشكاوى", helpDescription:"للاستفسارات وتقديم الشكاوى",
      branchPhones:"أرقام الفرع", branchLocation:"موقع الفرع", openMap:"افتح الخريطة لمعرفة موقع الفرع",
      closeMenu:"إغلاق القائمة", allPricesIQD:"جميع الأسعار بالدينار العراقي", backHomePage:"العودة إلى الصفحة الرئيسية",
      search:"ابحث عن وجبتك...", add:"أضف إلى السلة", pending:"بانتظار تحديد السعر",
      unconfirmed:"السعر غير مؤكد", meal:"تحويلها إلى وجبة", mealOnly:"الصنف فقط",
      mealIncludes:"الوجبة تشمل الفنكر والمشروب", empty:"السلة فارغة، اختَر الأصناف التي تريدها.",
      noResults:"ما لقينا منتجات تطابق بحثك.", item:"صنف", items:"أصناف", inCart:"في السلة",
      subtotal:"المجموع الفرعي", discount:"الخصم", total:"الإجمالي", notes:"ملاحظات",
      mealText:"وجبة (فنكر ومشروب)", mealLabel:"وجبة", addAddon:"أضف للسلة", noAddons:"لا توجد إضافات أخرى متاحة حالياً.",
      decrease:"تقليل الكمية", increase:"زيادة الكمية", remove:"حذف الصنف",
      enterCoupon:"أدخل كود الخصم أولاً.", invalidCoupon:"الكود غير صحيح.",
      applied:"تم تطبيق خصم 15% بنجاح.", addFirst:"أضف أصنافاً إلى السلة أولاً.",
      addBeforeOrder:"أضف صنفاً واحداً على الأقل قبل إرسال الطلب.",
      opening:"سيتم فتح واتساب لإكمال إرسال الطلب.",
      whatsappError:"تعذر فتح واتساب. اسمح بفتح النوافذ المنبثقة ثم حاول مجدداً.",
      noCoupon:"لا يوجد", noNotes:"لا توجد", orderTitle:"طلب جديد — مطعم الغنّام / فرع الوجبات السريعة",
      customer:"الاسم", phone:"الهاتف", address:"العنوان", details:"تفاصيل الطلب",
      contact:"أرقام التواصل", savedCoupon:"كود GHANNAM15 محفوظ: خصم 15%.",
      switchGrid:"التبديل إلى عرض البطاقات", switchList:"التبديل إلى العرض الأفقي",
      grid:"عرض البطاقات", list:"العرض الأفقي"
    },
    en: {
      pageTitle:"Al Ghannam Restaurant | Fast Food Branch",
      pageDescription:"Al Ghannam fast food menu: shawarma, burgers, pizza, and WhatsApp ordering.",
      brandName:"Al Ghannam Restaurant", branchName:"Fast Food Branch", branchFullName:"Al Ghannam Restaurant — Fast Food Branch",
      logoAlt:"Al Ghannam Restaurant logo", brandAria:"Back to Al Ghannam Restaurant",
      mainNavAria:"Main navigation", headerActionsAria:"Website settings", languageToggleAria:"Change language",
      openMenuAria:"Open menu", backHome:"Back to Home", menu:"Menu",
      heroEyebrow:"Al Ghannam Restaurant • Authentic Local Flavor", heroTitle:"Fast Food",
      heroDescription:"Shawarma • Kentucky • Sandwiches • Burgers • Pizza", browseMenu:"Browse the Menu",
      searchSectionAria:"Search the menu", searchPagePlaceholder:"Search for shawarma, burgers, or pizza...",
      searchInputAria:"Search fast food products", categoriesAria:"Menu categories",
      viewSettingsAria:"Menu display settings", productsAria:"Products", loadingMenu:"Loading the fast food menu...",
      openCartAria:"Open shopping cart", viewCart:"View Cart", cartTitle:"Your Shopping Cart 🛒",
      closeCartAria:"Close cart", currentOrder:"Your Current Order", addToOrder:"Add to Your Order",
      menuAddons:"Menu Add-ons", swipeBrowse:"Swipe to browse →", loadingAddons:"Loading add-ons...",
      couponCode:"🎟️ Discount Code", enterCouponPlaceholder:"Enter discount code", applyCoupon:"Apply",
      summaryAria:"Order summary", subtotalLabel:"Subtotal", discountLabel:"Discount",
      finalTotalLabel:"Grand Total", customerInfo:"Customer Information", nameLabel:"Name",
      namePlaceholder:"Full name", phoneLabel:"Phone Number", phonePlaceholder:"Phone number",
      addressLabel:"Address", addressPlaceholder:"Your area and nearest landmark",
      notesLabel:"Additional Notes", notesPlaceholder:"Any notes about your order",
      sendWhatsApp:"Send Order via WhatsApp", continueShopping:"Continue Shopping", totalLabel:"Total",
      closeMenuAria:"Close menu", sideMenuTitle:"Menu", navigationTitle:"Navigation",
      homePage:"Home Page", returnBranches:"Return to branches page", foodMenu:"Food Menu",
      goToMenu:"Go to menu", shoppingCart:"Shopping Cart", viewItemsTotal:"View items and total",
      restaurantInfo:"Restaurant Information", currency:"Currency", currencyName:"Iraqi Dinar (IQD)",
      helpComplaints:"Help & Complaints", helpDescription:"For inquiries and complaints",
      branchPhones:"Branch Phone Numbers", branchLocation:"Branch Location", openMap:"Open the map to find the branch",
      closeMenu:"Close Menu", allPricesIQD:"All prices are in Iraqi Dinars", backHomePage:"Return to Home Page",
      search:"Search for your meal...", add:"Add to cart", pending:"Price pending",
      unconfirmed:"Price not confirmed", meal:"Upgrade to a meal", mealOnly:"Item only",
      mealIncludes:"Meal includes fries and a drink", empty:"Your cart is empty. Choose the items you want.",
      noResults:"No products match your search.", item:"item", items:"items", inCart:"in cart",
      subtotal:"Subtotal", discount:"Discount", total:"Grand total", notes:"Notes",
      mealText:"Meal (fries and a drink)", mealLabel:"Meal", addAddon:"Add to cart", noAddons:"No other add-ons are currently available.",
      decrease:"Decrease quantity", increase:"Increase quantity", remove:"Remove item",
      enterCoupon:"Enter the discount code first.", invalidCoupon:"Invalid discount code.",
      applied:"15% discount applied successfully.", addFirst:"Add items to your cart first.",
      addBeforeOrder:"Add at least one item before submitting your order.",
      opening:"Opening WhatsApp to complete your order.",
      whatsappError:"Could not open WhatsApp. Allow pop-ups and try again.",
      noCoupon:"None", noNotes:"None", orderTitle:"New Order — Al Ghannam Restaurant / Fast Food Branch",
      customer:"Name", phone:"Phone", address:"Address", details:"Order details",
      contact:"Contact numbers", savedCoupon:"GHANNAM15 saved: 15% discount.",
      switchGrid:"Switch to grid view", switchList:"Switch to horizontal view",
      grid:"Grid view", list:"Horizontal view"
    }
  };

  const t = key => ui[currentLanguage][key] ?? ui.ar[key] ?? key;
  const money = value => {
    const amount = Math.max(0, Math.round(Number(value) || 0));
    return currentLanguage === "en"
      ? `${amount.toLocaleString("en-US")} IQD`
      : `${amount.toLocaleString("en-US")} د.ع`;
  };
  const productName = product => currentLanguage === "en"
    ? (product.name_en || product.name_ar || product.name || "")
    : (product.name_ar || product.name || "");
  const productDescription = product => currentLanguage === "en"
    ? (product.description_en || product.description_ar || product.description || "")
    : (product.description_ar || product.description || "");
  const categoryName = category => currentLanguage === "en"
    ? (categoryEnglish.get(category) || category)
    : category;
  const getProduct = id => products.find(product => String(product.id) === String(id));
  const effectivePrice = (product, meal = false) => {
    if (!product || product.price == null || !Number.isFinite(Number(product.price))) return null;
    return Number(product.price) + (meal && product.mealUpgrade ? MEAL_UPGRADE_PRICE : 0);
  };
  const productEmoji = product => product?.emoji || "🍽️";

  function applyStaticTranslations() {
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === "en" ? "ltr" : "rtl";

    const languageButton = $("#languageToggle");
    if (languageButton) {
      languageButton.textContent = currentLanguage === "en" ? "AR" : "EN";
      languageButton.setAttribute("aria-label", currentLanguage === "en" ? "Switch to Arabic" : "Switch to English");
    }
    if (searchInput) searchInput.placeholder = t("search");

    $$("[data-i18n]").forEach(element => {
      const key = element.dataset.i18n;
      if (ui[currentLanguage][key] || ui.ar[key]) element.textContent = t(key);
    });
    $$("[data-i18n-placeholder]").forEach(element => {
      const key = element.dataset.i18nPlaceholder;
      if (ui[currentLanguage][key] || ui.ar[key]) element.placeholder = t(key);
    });
    $$("[data-i18n-title]").forEach(element => {
      const key = element.dataset.i18nTitle;
      if (ui[currentLanguage][key] || ui.ar[key]) element.title = t(key);
    });
    $$("[data-i18n-aria]").forEach(element => {
      const key = element.dataset.i18nAria;
      if (ui[currentLanguage][key] || ui.ar[key]) element.setAttribute("aria-label", t(key));
    });
    $$("[data-i18n-alt]").forEach(element => {
      const key = element.dataset.i18nAlt;
      if (ui[currentLanguage][key] || ui.ar[key]) element.alt = t(key);
    });
    $$("[data-i18n-meta]").forEach(element => {
      const key = element.dataset.i18nMeta;
      if (ui[currentLanguage][key] || ui.ar[key]) element.setAttribute("content", t(key));
    });
    const pageTitle = $("title[data-i18n-title]");
    if (pageTitle) pageTitle.textContent = t(pageTitle.dataset.i18nTitle);
  }

  function getSavedProductView() {
    return safeStorageGet(PRODUCT_VIEW_KEY, "grid") === "list" ? "list" : "grid";
  }
  function updateProductView(view) {
    const selected = view === "list" ? "list" : "grid";
    menuElement?.classList.toggle("list-view", selected === "list");
    menuElement?.classList.toggle("grid-view", selected === "grid");
    if (viewToggleButton) {
      viewToggleButton.setAttribute("aria-pressed", String(selected === "list"));
      viewToggleButton.title = selected === "list" ? t("switchGrid") : t("switchList");
      viewToggleButton.setAttribute("aria-label", viewToggleButton.title);
    }
    if (viewToggleIcon && viewToggleIcon.tagName.toLowerCase() !== "svg") {
      viewToggleIcon.textContent = selected === "list" ? "▦" : "☰";
    }
    safeStorageSet(PRODUCT_VIEW_KEY, selected);
  }

  function loadCart() {
    try {
      const saved = JSON.parse(safeStorageGet(STORAGE_KEY, "[]"));
      if (!Array.isArray(saved)) return [];
      return saved.map(row => {
        const product = getProduct(row?.id);
        const qty = Math.floor(Number(row?.qty));
        if (!product || product.price == null || !Number.isFinite(qty)) return null;
        return {
          id: product.id,
          qty: Math.max(1, Math.min(99, qty)),
          meal: Boolean(row.meal && product.mealUpgrade)
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }
  function saveCart() { safeStorageSet(STORAGE_KEY, JSON.stringify(cart)); }
  function qtyOf(id, meal = false) {
    return cart.find(row => String(row.id) === String(id) && Boolean(row.meal) === Boolean(meal))?.qty || 0;
  }
  function rowPrice(row) { return effectivePrice(getProduct(row.id), row.meal) || 0; }
  function subtotal() { return cart.reduce((sum, row) => sum + rowPrice(row) * row.qty, 0); }
  function totalQty() { return cart.reduce((sum, row) => sum + row.qty, 0); }
  function discountAmount() { return activeCoupon ? Math.round(subtotal() * COUPON_RATE) : 0; }
  function grandTotal() { return Math.max(0, subtotal() - discountAmount()); }
  function itemKey(row) { return `${row.id}|${row.meal ? "1" : "0"}`; }
  function parseItemKey(key) {
    const [id, flag] = String(key || "").split("|");
    return { id, meal: flag === "1" };
  }
  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function playBellSound() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContext || audioContext.state === "closed") audioContext = new AudioContextClass();
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
      if (audioContext.state === "suspended") audioContext.resume().then(play).catch(() => {});
      else play();
    } catch (error) {
      console.warn("تعذر تشغيل صوت التنبيه:", error);
    }
  }

  function getCategories() {
    return [...new Set(products.map(product => product.category).filter(Boolean))];
  }

  function imageSource(product) {
    const candidate = product.image_url || product.image || "";
    if (!candidate) return "";
    if (/^https?:\/\//i.test(candidate) || candidate.startsWith("/")) return candidate;
    if (candidate.includes("/")) return candidate;
    return IMAGE_FOLDER + candidate;
  }

  function productCardHTML(product) {
    const price = effectivePrice(product, false);
    const canOrder = price !== null && product.is_available !== false;
    const image = imageSource(product);
    const name = productName(product);
    const description = productDescription(product);
    const selectedQty = qtyOf(product.id, false) + qtyOf(product.id, true);
    const mealOptions = product.mealUpgrade ? `
      <label class="product-option-label" for="meal-option-${escapeHTML(product.id)}">${escapeHTML(t("mealOnly"))}</label>
      <select id="meal-option-${escapeHTML(product.id)}" data-meal-select="${escapeHTML(product.id)}" aria-label="${escapeHTML(name)}">
        <option value="single">${escapeHTML(t("mealOnly"))}</option>
        <option value="meal">${escapeHTML(t("meal"))} (+${money(MEAL_UPGRADE_PRICE)})</option>
      </select>
      <small class="meal-upgrade-note">${escapeHTML(t("mealIncludes"))}</small>
    ` : "";

    return `
      <article class="product-card" data-product-id="${escapeHTML(product.id)}">
        <div class="product-image-box">
          ${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ""}
          <div class="product-placeholder" ${image ? 'style="display:none"' : ""}>${escapeHTML(productEmoji(product))}</div>
        </div>
        <div class="product-details">
          <h3 class="product-name">${escapeHTML(name)}</h3>
          ${description ? `<p class="ghannam-db-description">${escapeHTML(description)}</p>` : ""}
          <div class="product-price">
            ${canOrder ? money(price) : `<span class="price-unconfirmed">${escapeHTML(t("unconfirmed"))}</span>`}
          </div>
          ${mealOptions}
          <div class="product-actions">
            <button type="button" class="add-to-cart-button" data-add="${escapeHTML(product.id)}" ${canOrder ? "" : `disabled title="${escapeHTML(t("pending"))}"`}>
              ${canOrder ? escapeHTML(t("add")) : escapeHTML(t("pending"))}
            </button>
            ${selectedQty ? `<span class="product-quantity">${selectedQty} ${escapeHTML(t("inCart"))}</span>` : ""}
          </div>
        </div>
      </article>
    `;
  }

  function renderCategories(visibleCategories = getCategories()) {
    if (!categoryNav) return;
    categoryNav.innerHTML = visibleCategories.map(category => `
      <button type="button"
        class="category-pill ${activeCategory === category ? "active" : ""}"
        data-category="${escapeHTML(category)}">
        ${escapeHTML(categoryName(category))}
      </button>
    `).join("");
  }

  function renderMenu() {
    if (!menuElement) return;
    const query = currentSearch.trim().toLocaleLowerCase();
    const filtered = products.filter(product => {
      const searchable = [
        product.name, product.name_ar, product.name_en,
        product.description, product.description_ar, product.description_en,
        product.category, product.category_en
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      const categoryMatch = !activeCategory || product.category === activeCategory;
      return categoryMatch && (!query || searchable.includes(query));
    });

    if (!filtered.length) {
      menuElement.innerHTML = `<p class="empty-message">${escapeHTML(t("noResults"))}</p>`;
      renderCategories(activeCategory ? [activeCategory] : []);
      return;
    }

    const categories = getCategories().filter(category =>
      filtered.some(product => product.category === category)
    );

    menuElement.innerHTML = categories.map(category => {
      const rows = filtered.filter(product => product.category === category);
      return `
        <section class="menu-section" id="fastfood-category-${escapeHTML(category.replace(/\s+/g, "-"))}">
          <h2 class="section-title">${escapeHTML(categoryName(category))}</h2>
          <div class="product-grid">${rows.map(productCardHTML).join("")}</div>
        </section>
      `;
    }).join("");

    renderCategories(categories);
    updateProductView(getSavedProductView());
  }

  function renderAddons() {
    if (!addonsList) return;
    const addonCategories = ["الإضافات", "الصوص", "المشروبات", "الفنكر", "المقبلات"];
    const suggestions = products.filter(product =>
      addonCategories.includes(product.category) &&
      product.price != null &&
      product.is_available !== false &&
      !cart.some(row => String(row.id) === String(product.id))
    );

    addonsList.innerHTML = suggestions.length ? `
      <div class="addons-grid">
        ${suggestions.map(product => `
          <div class="addon-card">
            <strong>${escapeHTML(productName(product))}</strong>
            <span>${money(product.price)}</span>
            <button type="button" data-addon="${escapeHTML(product.id)}">${escapeHTML(t("addAddon"))}</button>
          </div>
        `).join("")}
      </div>
    ` : `<p class="addons-empty">${escapeHTML(t("noAddons"))}</p>`;
  }

  function renderCart() {
    const count = totalQty();
    const sub = subtotal();
    const discount = discountAmount();
    const total = grandTotal();
    const countText = `${count} ${count === 1 ? t("item") : t("items")}`;

    setText("#cartCount", countText);
    setText("#fastfoodTotal", money(total));
    setText("#fixedCartCount", count);
    setText("#fixedCartSubtitle", count ? `${countText} ${t("inCart")}` : t("empty"));
    setText("#fixedCartTotal", money(total));
    setText("#popupSubtotal", money(sub));
    setText("#popupDiscount", money(discount));
    setText("#popupGrandTotal", money(total));
    setText("#popupFooterTotal", money(total));

    fixedCartBar?.classList.toggle("has-items", count > 0);

    if (popupItems) {
      popupItems.innerHTML = cart.length ? cart.map(row => {
        const product = getProduct(row.id);
        if (!product) return "";
        const key = escapeHTML(itemKey(row));
        const name = productName(product) + (row.meal ? ` — ${t("mealText")}` : "");
        return `
          <div class="cart-item" data-cart-key="${key}">
            <div class="cart-item-info">
              <div class="cart-item-name">${escapeHTML(name)}</div>
              <div class="cart-item-price">${money(rowPrice(row))} × ${row.qty}</div>
              <div class="cart-item-subtotal">${escapeHTML(t("total"))}: ${money(rowPrice(row) * row.qty)}</div>
            </div>
            <div class="quantity-controls">
              <button type="button" data-qty="${key}" data-delta="-1" aria-label="${escapeHTML(t("decrease"))}">−</button>
              <strong>${row.qty}</strong>
              <button type="button" data-qty="${key}" data-delta="1" aria-label="${escapeHTML(t("increase"))}">+</button>
              <button type="button" data-remove="${key}" aria-label="${escapeHTML(t("remove"))}">×</button>
            </div>
          </div>
        `;
      }).join("") : `<p class="empty-message">${escapeHTML(t("empty"))}</p>`;
    }

    const legacyItems = $("#fastfoodCartItems");
    if (legacyItems) {
      legacyItems.innerHTML = cart.map(row => {
        const product = getProduct(row.id);
        return product ? `<p>${escapeHTML(productName(product))}${row.meal ? ` — ${escapeHTML(t("mealLabel"))}` : ""} × ${row.qty}</p>` : "";
      }).join("");
    }

    renderAddons();
  }

  function addToCart(id, meal = false) {
    const product = getProduct(id);
    if (!product || product.price == null || product.is_available === false) return;
    const selectedMeal = Boolean(meal && product.mealUpgrade);
    const row = cart.find(item => String(item.id) === String(id) && Boolean(item.meal) === selectedMeal);
    if (row) row.qty = Math.min(99, row.qty + 1);
    else cart.push({ id: product.id, qty: 1, meal: selectedMeal });
    saveCart();
    renderMenu();
    renderCart();
    playBellSound();
  }

  function changeQty(key, amount) {
    const parsed = parseItemKey(key);
    const row = cart.find(item => String(item.id) === parsed.id && Boolean(item.meal) === parsed.meal);
    if (!row) return;
    row.qty += Number(amount) || 0;
    if (row.qty <= 0) cart = cart.filter(item => item !== row);
    else row.qty = Math.min(99, row.qty);
    saveCart();
    renderMenu();
    renderCart();
  }

  function removeFromCart(key) {
    const parsed = parseItemKey(key);
    cart = cart.filter(item => !(String(item.id) === parsed.id && Boolean(item.meal) === parsed.meal));
    saveCart();
    renderMenu();
    renderCart();
  }

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
    if (lastCartFocus?.isConnected) lastCartFocus.focus();
    else fixedCartBar?.focus();
  }

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
      const title = productName(product) + (row.meal ? ` (${t("mealText")})` : "");
      return `• ${title} × ${row.qty} = ${money(rowPrice(row) * row.qty)}`;
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
    const waNumber = WHATSAPP_NUMBERS[0].replace(/\D/g, "").replace(/^0/, "");
    const url = `https://wa.me/964${waNumber}?text=${encodeURIComponent(message)}`;
    const opened = window.open(url, "_blank");
    if (!opened) setText("#popupOrderStatus", t("whatsappError"));
  }

  async function refreshMenuFromDatabase() {
    try {
      const result = await loadBranchMenu("fastfood", currentLanguage);
      const dbCategories = result?.categories || [];
      const dbProducts = result?.products || [];
      if (!dbProducts.length) {
        console.warn("Supabase لم يرجع منتجات؛ ستبقى القائمة المحلية ظاهرة.");
        return;
      }

      categoryEnglish = new Map();
      dbCategories.forEach(category => {
        const ar = category.name_ar || category.name || "";
        const en = category.name_en || "";
        if (ar && en) categoryEnglish.set(ar, en);
      });

      const mapped = dbProducts.map(row => {
        const sourceId = row.extra?.source_product_id ?? row.id;
        const local = products.find(item => String(item.id) === String(sourceId));
        const price = row.extra?.requires_price_confirmation
          ? null
          : (row.price === null || row.price === "" ? null : Number(row.price));

        return {
          ...(local || {}),
          id: sourceId,
          dbId: row.id,
          name: row.name_ar || row.name || local?.name || "",
          name_ar: row.name_ar || row.name || local?.name || "",
          name_en: row.name_en || "",
          description: row.description_ar || row.description || "",
          description_ar: row.description_ar || row.description || "",
          description_en: row.description_en || "",
          price: Number.isFinite(price) ? price : null,
          category: row.category_name_ar || row.category_name || local?.category || "",
          category_en: row.category_name_en || "",
          image: getStoredImageName(row) || local?.image || "",
          image_url: row.image_url || "",
          emoji: row.extra?.emoji || local?.emoji || "🍽️",
          mealUpgrade: typeof row.extra?.mealUpgrade === "boolean"
            ? row.extra.mealUpgrade
            : Boolean(local?.mealUpgrade),
          is_available: row.is_available !== false
        };
      });

      products.splice(0, products.length, ...mapped);
      cart = loadCart();
      saveCart();
      if (activeCategory && !products.some(product => product.category === activeCategory)) {
        activeCategory = "";
      }
      renderMenu();
      renderCart();
      console.info(`تم تحميل ${mapped.length} منتجاً من Supabase باللغة ${currentLanguage}.`);
    } catch (error) {
      console.error("تعذر تحميل قائمة Supabase؛ ستبقى القائمة المحلية:", error);
    }
  }

  async function setLanguage(language) {
    currentLanguage = language === "en" ? "en" : "ar";
    safeStorageSet(LANGUAGE_KEY, currentLanguage);
    applyStaticTranslations();
    await refreshMenuFromDatabase();
    renderMenu();
    renderCart();
  }

  $("#languageToggle")?.addEventListener("click", () => {
    void setLanguage(currentLanguage === "ar" ? "en" : "ar");
  });

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const add = target.closest("[data-add]");
    if (add) {
      const id = add.dataset.add;
      const selector = add.closest(".product-card")?.querySelector("[data-meal-select]");
      addToCart(id, selector?.value === "meal");
      return;
    }

    const addon = target.closest("[data-addon]");
    if (addon) {
      addToCart(addon.dataset.addon, false);
      return;
    }

    const qty = target.closest("[data-qty]");
    if (qty) {
      changeQty(qty.dataset.qty, Number(qty.dataset.delta ?? qty.dataset.change));
      return;
    }

    const remove = target.closest("[data-remove]");
    if (remove) {
      removeFromCart(remove.dataset.remove);
      return;
    }

    const category = target.closest("[data-category]");
    if (category) {
      activeCategory = category.dataset.category === activeCategory ? "" : category.dataset.category;
      renderMenu();
    }
  });

  searchInput?.addEventListener("input", () => {
    currentSearch = searchInput.value || "";
    renderMenu();
  });

  viewToggleButton?.addEventListener("click", () => {
    updateProductView(getSavedProductView() === "grid" ? "list" : "grid");
  });

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
  $("#fastfoodOrderForm")?.addEventListener("submit", event => event.preventDefault());

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && cartOverlay && !cartOverlay.hidden) closeCart();
  });

  async function initialize() {
    cart = loadCart();
    applyStaticTranslations();
    updateProductView(getSavedProductView());
    ensureMenuDescriptionStyle();
    renderCategories();
    renderMenu();
    renderCart();

    if (activeCoupon && couponInput) {
      couponInput.value = COUPON_CODE;
      if (couponStatus) {
        couponStatus.textContent = t("savedCoupon");
        couponStatus.className = "coupon-success";
      }
    }

    await refreshMenuFromDatabase();
    renderCategories();
    renderMenu();
    renderCart();
  }

  void initialize();
})();
