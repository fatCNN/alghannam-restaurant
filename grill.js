import { loadBranchMenu, ensureMenuDescriptionStyle } from "./menu-db.js";

"use strict";

/* =========================================
   نظام اللغتين العربية والإنجليزية
========================================= */
const GRILL_LANGUAGE_KEY = "ghannamGrillLanguage";
let currentLanguage = (() => {
    try { return localStorage.getItem(GRILL_LANGUAGE_KEY) === "en" ? "en" : "ar"; }
    catch (_) { return "ar"; }
})();
const isEnglish = () => currentLanguage === "en";
const EN_TEXT = {
    "مطعم الغنام": "Al Ghannam Restaurant", "مطعم الغنّام": "Al Ghannam Restaurant",
    "العودة للرئيسية": "Back to Home", "خصومات توصل 50%": "Up to 50% Off",
    "- عروض على منتجات مختارة": "- Offers on selected items", "التوصيل": "Delivery",
    "عبر الموقع": "Through the website", "ابحث عن وجبتك المفضلة...": "Search for your favorite meal...",
    "ابحث عن وجبتك المفضلة": "Search for your favorite meal", "أقسام المنيو": "Menu Categories",
    "جارٍ تحميل المنيو...": "Loading menu...", "عرض السلة": "View Cart",
    "لا توجد منتجات في السلة": "Your cart is empty", "قطعة في السلة": "items in cart",
    "سلة مشترياتك 🛒": "Your Shopping Cart 🛒", "مطعم الغنام — فرع المشاوي": "Al Ghannam Restaurant — Grill Branch", "مطعم الغنّام — فرع المشاوي": "Al Ghannam Restaurant — Grill Branch",
    "أضف إلى طلبك": "Add to Your Order", "إضافات من المنيو": "Menu Extras",
    "اسحب للتصفح ←": "Swipe to browse →", "جارٍ تحميل الإضافات...": "Loading extras...",
    "لا توجد إضافات متاحة حاليًا.": "No extras are currently available.",
    "أضفت جميع أصناف الإضافات إلى سلتك.": "You have added all available extras to your cart.",
    "🎟️ كود الخصم": "🎟️ Discount Code", "أدخل كود الخصم": "Enter discount code",
    "تطبيق": "Apply", "المجموع الفرعي": "Subtotal", "الخصم": "Discount",
    "الإجمالي النهائي": "Grand Total", "معلومات الزبون": "Customer Information",
    "الاسم": "Name", "الاسم الكامل": "Full name", "رقم الهاتف": "Phone Number",
    "العنوان": "Address", "منطقة السكن وأقرب نقطة دالة": "Area and nearest landmark",
    "ملاحظات إضافية": "Additional Notes", "أي ملاحظات على الطلب": "Any notes about your order",
    "إرسال الطلب عبر واتساب": "Send Order via WhatsApp", "مواصلة التسوق": "Continue Shopping",
    "الإجمالي": "Total", "القائمة": "Menu", "التنقل": "Navigation",
    "الصفحة الرئيسية": "Home Page", "العودة إلى صفحة الفروع": "Back to branches",
    "قائمة الطعام": "Food Menu", "الانتقال إلى المنيو": "Go to menu",
    "سلة المشتريات": "Shopping Cart", "عرض المنتجات والإجمالي": "View items and total",
    "معلومات المطعم": "Restaurant Information", "فرع المشاوي": "Grill Branch",
    "العملة": "Currency", "الدينار العراقي (د.ع)": "Iraqi Dinar (IQD)",
    "المساعدة والشكاوى": "Help & Complaints", "للاستفسارات وتقديم الشكاوى": "Questions and complaints",
    "أرقام الفرع": "Branch Phone Numbers", "موقع الفرع": "Branch Location",
    "عرض الموقع على خرائط Google": "View location on Google Maps", "إغلاق القائمة": "Close Menu",
    "جميع الأسعار بالدينار العراقي": "All prices are in Iraqi Dinars",
    "العودة إلى الصفحة الرئيسية": "Back to Home Page", "اختر الحجم أو الخيار": "Choose size or option",
    "إضافة إلى السلة": "Add to Cart", "لم نجد صنفًا بهذا الاسم.": "No items found with this name.",
    "لم نجد صنف بهذا الاسم.": "No items found with this name.", "حذف": "Remove",
    "لا توجد منتجات في السلة.": "Your cart is empty.", "السلة فارغة. أضيفي وجبات من المنيو.": "Your cart is empty. Add items from the menu.",
    "السلة فارغة. أضيفي منتجًا واحدًا على الأقل.": "Your cart is empty. Add at least one item.",
    "اختر خيارات": "Choose options", "تغيير اللغة": "Change language"
};
const EN_PRODUCTS = {
    "المشويات بالكيلو":"Grills by Weight", "المقبلات":"Appetizers", "المشوي نفرات":"Grilled Skewers",
    "اللفات":"Wraps", "اللحوم النيّة واللحوم":"Raw Meat & Meat", "الدجاج — صالة":"Chicken — Dine In",
    "الدجاج — سفري":"Chicken — Takeaway", "القوزي":"Quzi", "الشاورما":"Shawarma",
    "الفطور الصباحي":"Breakfast", "الإضافات":"Extras", "المشروبات":"Drinks",
    "كباب لحم":"Beef Kebab", "كباب دجاج":"Chicken Kebab", "تكة دجاج":"Chicken Tikka",
    "تكة لحم":"Beef Tikka", "معلاق":"Grilled Liver", "قلب":"Grilled Heart", "بيض غنم":"Lamb Testicles",
    "جلاوي":"Grilled Lamb Tail Fat", "مقبلات صغير جداً":"Very Small Appetizers", "مقبلات صغير":"Small Appetizers",
    "مقبلات وسط":"Medium Appetizers", "مقبلات كبير":"Large Appetizers", "كص لحم":"Beef Kebab Wrap",
    "كص دجاج":"Chicken Kebab Wrap", "لفة كص لحم":"Beef Kebab Wrap", "لفة كص دجاج":"Chicken Kebab Wrap",
    "لفة كباب لحم":"Beef Kebab Wrap", "لفة كباب دجاج":"Chicken Kebab Wrap", "لفة تكة لحم":"Beef Tikka Wrap",
    "لفة تكة دجاج":"Chicken Tikka Wrap", "لفة معلاق":"Grilled Liver Wrap", "لفة بيض غنم":"Lamb Testicles Wrap",
    "لفة قلب":"Grilled Heart Wrap", "لفة جلاوي":"Grilled Tail Fat Wrap", "لحم طبخ":"Cooking Meat",
    "لحم مثروم":"Minced Meat", "تكة لحم ني":"Raw Beef Tikka", "ريش غنم ني":"Raw Lamb Chops",
    "أجنحة ني":"Raw Chicken Wings", "تكة دجاج ني":"Raw Chicken Tikka", "فشة ني":"Raw Lung",
    "ليه":"Lamb Tail Fat", "عصاعيص ني":"Raw Lamb Sausages", "كباب دجاج ني":"Raw Chicken Kebab",
    "كبدة عجل":"Veal Liver", "دجاج مفروم":"Minced Chicken", "أفخاذ دجاج طبخ":"Chicken Thighs",
    "دجاجة ناشفة":"Roasted Chicken", "صينية دجاج":"Chicken Tray", "نصف دجاجة ناشفة":"Half Roasted Chicken",
    "صينية نصف دجاجة":"Half Chicken Tray", "نفر تمن ومرق":"Rice & Stew Serving", "نصف دجاجة على تمن ومرق":"Half Chicken with Rice & Stew",
    "دجاجة بدون":"Chicken (Plain)", "دجاجة عادية":"Regular Chicken", "نصف دجاجة":"Half Chicken",
    "نفر قوزي":"Quzi Serving", "تشريب لحم":"Meat Tashreeb", "قطعة لحم بدون":"Meat Piece (Plain)",
    "صينية قطعة قوزي":"Quzi Piece Tray", "شاورما لحم":"Beef Shawarma", "شاورما دجاج":"Chicken Shawarma",
    "مخلمة بل كباب":"Makhlema with Kebab", "كبة":"Kibbeh", "مخلمة":"Makhlema", "مخلمة دبل":"Double Makhlema",
    "مخلمة بيض ولحم":"Egg & Meat Makhlema", "مخلمة بل كص":"Makhlema with Kebab Meat", "مخلمة بيض وطماطة":"Egg & Tomato Makhlema",
    "نفر باقلة":"Broad Bean Serving", "باقلاء دبل بيض":"Double Broad Beans with Egg", "صينية باقلة":"Broad Bean Tray",
    "نفر بيض خبط":"Scrambled Eggs", "نفر بيض عيون":"Fried Eggs", "نفر شوربة":"Soup Serving", "كاسة شوربة":"Cup of Soup",
    "كبة سراي":"Kibbeh Saray", "بيضة واحدة عين":"One Fried Egg", "خبز 5 كراص":"5 Pieces of Bread", "شيش ليه":"Lamb Fat Skewer",
    "صحن بصل بالسماق":"Sumac Onion Plate", "صحن تمن":"Rice Plate", "صحن خضروات":"Vegetable Plate", "صحن ليمون":"Lemon Plate",
    "صحن ليه شورما":"Shawarma Fat Plate", "صحن مخلل":"Pickles Plate", "كاسة مرق":"Cup of Stew", "شيش كباب":"Kebab Skewer",
    "شيش تكة":"Tikka Skewer", "شيش قلب":"Heart Skewer", "صينية تمن":"Rice Tray", "تشريب بدون":"Tashreeb (Plain)",
    "سوب أحمر":"Red Soup", "صمون واحد":"One Samoon Bread", "كيس صمون":"Bag of Samoon Bread", "بيبسي":"Pepsi", "سفن":"7Up", "لبن":"Yogurt Drink", "شاي":"Tea"
};
const EN_OPTIONS = {"ربع كيلو":"Quarter Kg", "نصف كيلو":"Half Kg", "كيلو":"1 Kg", "شيش":"Skewer", "نص نفر":"Half Serving", "نفر":"Serving", "سفري":"Takeaway", "صالة":"Dine In", "الوجبة":"Meal", "الكمية":"Quantity", "الحبة":"Piece", "الكاسة":"Cup", "صغير جداً":"Very Small", "صغير":"Small", "وسط":"Medium", "كبير":"Large"};
function tr(value) { if (!isEnglish() || !value) return value; return EN_TEXT[value] || EN_PRODUCTS[value] || EN_OPTIONS[value] || value; }
function productEnglishName(item) { return item?.[4] || EN_PRODUCTS[item?.[0]] || item?.[0] || ""; }
function productEnglishDescription(item) { return item?.[5] || item?.[3] || ""; }
function displayProductName(arName, sectionId) {
    if (!isEnglish()) return arName;
    const section = grillSections.find(s => s.id === sectionId);
    const item = section?.items.find(p => p[0] === arName);
    return item ? productEnglishName(item) : (EN_PRODUCTS[arName] || arName);
}
function displayOption(value) { return tr(value); }
function applyStaticLanguage() {
    document.documentElement.lang = isEnglish() ? "en" : "ar";
    document.title = isEnglish() ? "Al Ghannam Restaurant | Grill Branch" : "مطعم الغنام | فرع المشاوي";
    document.documentElement.dir = isEnglish() ? "ltr" : "rtl";
    document.body.classList.toggle("language-en", isEnglish());
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
        const original = node.__ghannamOriginalText ?? node.nodeValue;
        if (node.__ghannamOriginalText === undefined) node.__ghannamOriginalText = original;
        const clean = original.trim();
        if (!clean) return;
        const translated = isEnglish() ? (EN_TEXT[clean] || EN_PRODUCTS[clean] || clean) : original;
        if (translated !== clean || !isEnglish()) node.nodeValue = original.replace(clean, translated);
    });
    const attrs = ["placeholder", "title", "aria-label"];
    document.querySelectorAll("input,textarea,button,a,[aria-label]").forEach(el => attrs.forEach(attr => {
        if (!el.hasAttribute(attr)) return;
        const key = "__ghannam_" + attr;
        if (el[key] === undefined) el[key] = el.getAttribute(attr);
        const original = el[key];
        el.setAttribute(attr, isEnglish() ? (EN_TEXT[original] || original) : original);
    }));
    if (languageToggle) {
        languageToggle.textContent = isEnglish() ? "عربي" : "EN";
        languageToggle.setAttribute("aria-label", isEnglish() ? "Switch language to Arabic" : "Switch language to English");
        languageToggle.title = isEnglish() ? "Switch to Arabic" : "Switch to English";
    }
}
function setGrillLanguage(language) {
    currentLanguage = language === "en" ? "en" : "ar";
    try { localStorage.setItem(GRILL_LANGUAGE_KEY, currentLanguage); } catch (_) {}
    applyStaticLanguage();
    renderCategories();
    renderMenu(searchInput?.value || "");
    renderCart();
}


/* =========================================
   إعدادات فرع المشاوي
========================================= */

const WHATSAPP_NUMBER = "9647740000062";
const CART_STORAGE_KEY = "ghannamGrillCart";
const COUPON_STORAGE_KEY = "ghannamGrillCoupon";

/* =========================================
   جرس إضافة المنتجات للسلة
========================================= */

let orderBellAudioContext = null;

function playAddToCartSound() {
    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (
            !orderBellAudioContext ||
            orderBellAudioContext.state === "closed"
        ) {
            orderBellAudioContext = new AudioContextClass();
        }

        const ctx = orderBellAudioContext;

        function playBellTone(frequency, start, duration, volume) {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();

            oscillator.type = "sine";

            oscillator.frequency.setValueAtTime(
                frequency,
                ctx.currentTime + start
            );

            gain.gain.setValueAtTime(
                0.0001,
                ctx.currentTime + start
            );

            gain.gain.exponentialRampToValueAtTime(
                volume,
                ctx.currentTime + start + 0.012
            );

            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                ctx.currentTime + start + duration
            );

            oscillator.connect(gain);
            gain.connect(ctx.destination);

            oscillator.start(ctx.currentTime + start);
            oscillator.stop(ctx.currentTime + start + duration);
        }

        const play = () => {
            playBellTone(1046.5, 0, 0.55, 0.18);
            playBellTone(1318.5, 0.13, 0.65, 0.14);
            playBellTone(1568.0, 0.24, 0.45, 0.08);
        };

        if (ctx.state === "suspended") {
            ctx.resume().then(play).catch(error => {
                console.warn("تعذر تشغيل جرس السلة:", error);
            });
        } else {
            play();
        }
    } catch (error) {
        console.warn("تعذر تشغيل جرس السلة:", error);
    }
}

/* =========================================
   أكواد الخصم
========================================= */

const COUPONS = {
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

/* =========================================
   حفظ واسترجاع السلة
========================================= */

function loadSavedCart() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(CART_STORAGE_KEY) || "[]"
        );

        if (!Array.isArray(saved)) return [];

        return saved
            .filter(item =>
                item &&
                typeof item.name === "string" &&
                typeof item.option === "string" &&
                Number.isFinite(Number(item.price)) &&
                Number(item.price) >= 0 &&
                Number.isFinite(Number(item.quantity)) &&
                Number(item.quantity) > 0
            )
            .map(item => ({
                name: item.name,
                option: item.option,
                price: Number(item.price),
                quantity: Math.floor(Number(item.quantity)),
                sectionId: item.sectionId || ""
            }));
    } catch (error) {
        console.error("تعذر قراءة السلة المحفوظة:", error);
        return [];
    }
}

const cart = loadSavedCart();

/* =========================================
   تنسيق الأسعار
========================================= */

function formatPrice(value) {
    return Math.round(Number(value) || 0).toLocaleString("en-US");
}

function money(value) {
    return formatPrice(value) + (isEnglish() ? " IQD" : " د.ع");
}

function getCartTotal() {
    return cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
}

function getCartQuantity() {
    return cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );
}

/* =========================================
   تحديث شريط السلة الثابت
========================================= */

function updateFixedCart() {
    const countElement = document.getElementById("fixedCartCount");
    const subtitleElement = document.getElementById("fixedCartSubtitle");
    const totalElement = document.getElementById("fixedCartTotal");

    const count = getCartQuantity();
    const total = getCartTotal();

    if (countElement) {
        countElement.textContent = count;
    }

    if (subtitleElement) {
        subtitleElement.textContent = count === 0
            ? (isEnglish() ? "Your cart is empty" : "لا توجد منتجات في السلة")
            : count + (isEnglish() ? " items in cart" : " قطعة في السلة");
    }

    if (totalElement) {
        totalElement.textContent = money(total);
    }
}

function saveCart() {
    try {
        localStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify(cart)
        );
    } catch (error) {
        console.error("تعذر حفظ السلة:", error);
    }

    updateFixedCart();
}

window.updateFixedCart = updateFixedCart;

/* =========================================
   بيانات المنيو والأسعار
========================================= */

const grillSections = [
    {
        id: "grilled",
        title: "المشويات بالكيلو",
        items: [
            ["كباب لحم", {"ربع كيلو": 7000, "نصف كيلو": 13000, "كيلو": 26000}, ""],
            ["كباب دجاج", {"ربع كيلو": 6000, "نصف كيلو": 12000, "كيلو": 24000}, ""],
            ["تكة دجاج", {"ربع كيلو": 6000, "نصف كيلو": 12000, "كيلو": 24000}, ""],
            ["تكة لحم", {"ربع كيلو": 8000, "نصف كيلو": 15000, "كيلو": 30000}, ""],
            ["معلاق", {"ربع كيلو": 8000, "نصف كيلو": 15000, "كيلو": 30000}, ""],
            ["قلب", {"ربع كيلو": 8000, "نصف كيلو": 15000, "كيلو": 30000}, ""],
            ["بيض غنم", {"ربع كيلو": 8000, "نصف كيلو": 15000, "كيلو": 30000}, ""],
            ["جلاوي", {"ربع كيلو": 8000, "نصف كيلو": 15000, "كيلو": 30000}, ""]
        ]
    },
    {
        id: "appetizers",
        title: "المقبلات",
        items: [
            ["مقبلات صغير جداً", {"صغير جداً": 1000}, ""],
            ["مقبلات صغير", {"صغير": 2000}, ""],
            ["مقبلات وسط", {"وسط": 3000}, ""],
            ["مقبلات كبير", {"كبير": 6000}, ""]
        ]
    },
    {
        id: "skewers",
        title: "المشوي نفرات",
        items: [
            ["كباب لحم", {"شيش": 5000, "نص نفر": 8000, "نفر": 16000}, ""],
            ["كباب دجاج", {"شيش": 5000, "نص نفر": 7000, "نفر": 14000}, ""],
            ["تكة دجاج", {"شيش": 5000, "نص نفر": 7000, "نفر": 14000}, ""],
            ["تكة لحم", {"شيش": 5000, "نص نفر": 8000, "نفر": 16000}, ""],
            ["معلاق", {"شيش": 4000, "نص نفر": 8000, "نفر": 16000}, ""],
            ["جلاوي", {"شيش": 4000, "نص نفر": 8000, "نفر": 16000}, ""],
            ["قلب", {"شيش": 4000, "نص نفر": 8000, "نفر": 16000}, ""],
            ["بيض غنم", {"شيش": 3000, "نص نفر": 8000, "نفر": 16000}, ""],
            ["كص لحم", {"نص نفر": 8000, "نفر": 16000}, ""],
            ["كص دجاج", {"نص نفر": 8000, "نفر": 16000}, ""]
        ]
    },
    {
        id: "wraps",
        title: "اللفات",
        items: [
            ["لفة كص لحم", {"سفري": 4000, "صالة": 5000}, ""],
            ["لفة كص دجاج", {"سفري": 3000, "صالة": 4000}, ""],
            ["لفة كباب لحم", {"سفري": 3500, "صالة": 5000}, ""],
            ["لفة كباب دجاج", {"سفري": 3500, "صالة": 5000}, ""],
            ["لفة تكة لحم", {"سفري": 3500, "صالة": 5000}, ""],
            ["لفة تكة دجاج", {"سفري": 3500, "صالة": 4000}, ""],
            ["لفة معلاق", {"سفري": 3500, "صالة": 5000}, ""],
            ["لفة بيض غنم", {"سفري": 3500, "صالة": 5000}, ""],
            ["لفة قلب", {"سفري": 3500, "صالة": 5000}, ""],
            ["لفة جلاوي", {"سفري": 3500, "صالة": 5000}, ""]
        ]
    },
    {
        id: "raw-meat",
        title: "اللحوم النيّة واللحوم",
        items: [
            ["لحم طبخ", {"كيلو": 22000, "نصف كيلو": 11000, "ربع كيلو": 6000}, ""],
            ["لحم مثروم", {"كيلو": 22000, "نصف كيلو": 11000, "ربع كيلو": 6000}, ""],
            ["تكة لحم ني", {"كيلو": 25000, "نصف كيلو": 13000}, ""],
            ["ريش غنم ني", {"الكمية": 25000}, ""],
            ["أجنحة ني", {"الكمية": 3000}, ""],
            ["تكة دجاج ني", {"كيلو": 16000, "نصف كيلو": 8000}, ""],
            ["فشة ني", {"الكمية": 1000}, ""],
            ["ليه", {"كيلو": 15000}, ""],
            ["عصاعيص ني", {"كيلو": 12000}, ""],
            ["كباب دجاج ني", {"كيلو": 16000, "نصف كيلو": 8000}, ""],
            ["كبدة عجل", {"الكمية": 15000}, ""],
            ["دجاج مفروم", {"الكمية": 8000}, ""]
        ]
    },
    {
        id: "chicken-hall",
        title: "الدجاج — صالة",
        items: [
            ["أفخاذ دجاج طبخ", {"الوجبة": 9000}, ""],
            ["دجاجة ناشفة", {"الوجبة": 16000}, ""],
            ["صينية دجاج", {"الوجبة": 25000}, ""],
            ["نصف دجاجة ناشفة", {"الوجبة": 8000}, ""],
            ["صينية نصف دجاجة", {"الوجبة": 17000}, ""],
            ["نفر تمن ومرق", {"الوجبة": 6000}, ""],
            ["نصف دجاجة على تمن ومرق", {"الوجبة": 10000}, ""]
        ]
    },
    {
        id: "chicken-takeaway",
        title: "الدجاج — سفري",
        items: [
            ["دجاجة بدون", {"الوجبة": 10000}, ""],
            ["دجاجة عادية", {"الوجبة": 12000}, ""],
            ["نصف دجاجة", {"الوجبة": 7000}, ""],
            ["صينية دجاج", {"الوجبة": 17000}, ""],
            ["صينية نصف دجاجة", {"الوجبة": 11000}, ""]
        ]
    },
    {
        id: "quzi",
        title: "القوزي",
        items: [
            ["نفر قوزي", {"الوجبة": 18000}, ""],
            ["تشريب لحم", {"الوجبة": 16000}, ""],
            ["قطعة لحم بدون", {"الوجبة": 13000}, ""],
            ["صينية قطعة قوزي", {"الوجبة": 23000}, ""],
            ["قطعتين قوزي صينية", {"الوجبة": 37000}, ""],
            ["3 قطع قوزي صينية", {"الوجبة": 55000}, ""],
            ["4 قطع قوزي صينية", {"الوجبة": 72000}, ""],
            ["6 قطع قوزي صينية", {"الوجبة": 108000}, ""],
            ["6 قطع قوزي مع دجاجة", {"الوجبة": 118000}, ""],
            ["قطعة قوزي مع نصف دجاجة", {"الوجبة": 30000}, ""],
            ["قطعتين قوزي مع نصف دجاجة", {"الوجبة": 43000}, ""],
            ["قطعتين قوزي مع دجاجة", {"الوجبة": 48000}, ""],
            ["3 قطع قوزي مع نصف دجاجة", {"الوجبة": 60000}, ""],
            ["3 قطع قوزي مع دجاجة", {"الوجبة": 65000}, ""]
        ]
    },
    {
        id: "shawarma",
        title: "الشاورما",
        items: [
            ["شاورما لحم", {"ربع كيلو": 9000, "نصف كيلو": 18000, "كيلو": 35000}, ""],
            ["شاورما دجاج", {"ربع كيلو": 6000, "نصف كيلو": 12000, "كيلو": 24000}, ""]
        ]
    },
    {
        id: "breakfast",
        title: "الفطور الصباحي",
        items: [
            ["مخلمة بل كباب", {"الوجبة": 6000}, ""],
            ["كبة", {"الوجبة": 3000}, ""],
            ["مخلمة", {"الوجبة": 4000}, ""],
            ["مخلمة دبل", {"الوجبة": 5000}, ""],
            ["مخلمة بيض ولحم", {"الوجبة": 6000}, ""],
            ["مخلمة بل كص", {"الوجبة": 6000}, ""],
            ["مخلمة بيض وطماطة", {"الوجبة": 4000}, ""],
            ["نفر باقلة", {"الوجبة": 3500}, ""],
            ["باقلاء دبل بيض", {"الوجبة": 4000}, ""],
            ["صينية باقلة", {"الوجبة": 10000}, ""],
            ["نفر بيض خبط", {"الوجبة": 3000}, ""],
            ["نفر بيض عيون", {"الوجبة": 3000}, ""],
            ["نفر شوربة", {"الوجبة": 2500}, ""],
            ["كاسة شوربة", {"الوجبة": 1000}, ""],
            ["كبة سراي", {"الوجبة": 3000}, ""],
            ["بيضة واحدة عين", {"الوجبة": 2000}, ""]
        ]
    },
    {
        id: "extras",
        title: "الإضافات",
        items: [
            ["خبز 5 كراص", {"الكمية": 1000}, ""],
            ["شيش ليه", {"الكمية": 2000}, ""],
            ["صحن بصل بالسماق", {"الكمية": 1000}, ""],
            ["صحن تمن", {"الكمية": 2000}, ""],
            ["صحن خضروات", {"الكمية": 1000}, ""],
            ["صحن ليمون", {"الكمية": 1000}, ""],
            ["صحن ليه شورما", {"الكمية": 2500}, ""],
            ["صحن مخلل", {"الكمية": 2000}, ""],
            ["كاسة مرق", {"الكمية": 2000}, ""],
            ["شيش كباب", {"الكمية": 4000}, ""],
            ["شيش تكة", {"الكمية": 4000}, ""],
            ["شيش قلب", {"الكمية": 4000}, ""],
            ["صينية تمن", {"الكمية": 6000}, ""],
            ["تشريب بدون", {"الكمية": 3000}, ""],
            ["سوب أحمر", {"الكمية": 1000}, ""],
            ["صمون واحد", {"الكمية": 500}, ""],
            ["كيس صمون", {"الكمية": 2500}, ""]
        ]
    },
    {
        id: "drinks",
        title: "المشروبات",
        items: [
            ["بيبسي", {"الحبة": 500}, ""],
            ["سفن", {"الحبة": 500}, ""],
            ["لبن", {"الحبة": 500}, ""],
            ["شاي", {"الكاسة": 250}, ""]
        ]
    }
];

/* =========================================
   ربط صور المنتجات تلقائيًا
   ترتيب الصور يتبع ترتيب المنتجات في البيانات.
   الصور: image/pro1.png إلى image/pro109.png
========================================= */

let productImageNumber = 0;

grillSections.forEach(section => {
    section.items.forEach(item => {
        productImageNumber++;
        item[2] = `image/pro${productImageNumber}.png`;
    });
});

console.info("عدد المنتجات المرتبطة بالصور:", productImageNumber);

/* =========================================
   عناصر الصفحة
========================================= */

const menuElement = document.getElementById("grillMenu");
const categoryNav = document.getElementById("categoryNav");
const searchInput = document.getElementById("grillSearch");
const gridViewButton = document.getElementById("grillGridView");
const listViewButton = document.getElementById("grillListView");
const PRODUCT_VIEW_STORAGE_KEY = "ghannamGrillProductView";

function getSavedProductView() {
    try {
        return localStorage.getItem(PRODUCT_VIEW_STORAGE_KEY) === "list"
            ? "list"
            : "grid";
    } catch (error) {
        return "grid";
    }
}

function updateProductView(view) {
    const selectedView = view === "list" ? "list" : "grid";

    if (menuElement) {
        menuElement.classList.toggle("list-view", selectedView === "list");
    }

    if (gridViewButton) {
        gridViewButton.setAttribute("aria-pressed", String(selectedView === "grid"));
    }

    if (listViewButton) {
        listViewButton.setAttribute("aria-pressed", String(selectedView === "list"));
    }

    try {
        localStorage.setItem(PRODUCT_VIEW_STORAGE_KEY, selectedView);
    } catch (error) {
        console.warn("تعذر حفظ طريقة عرض المنتجات:", error);
    }
}

if (gridViewButton) {
    gridViewButton.addEventListener("click", () => updateProductView("grid"));
}

if (listViewButton) {
    listViewButton.addEventListener("click", () => updateProductView("list"));
}

/* =========================================
   عرض التصنيفات
========================================= */

function renderCategories() {
    if (!categoryNav) return;

    categoryNav.replaceChildren();

    grillSections.forEach(section => {
        const link = document.createElement("a");

        link.className = "category-link";
        link.href = "#" + section.id;
        link.textContent = isEnglish() ? (section.title_en || EN_PRODUCTS[section.title] || section.title) : section.title;

        categoryNav.appendChild(link);
    });
}

/* =========================================
   إضافة منتج إلى السلة
========================================= */

function addItemToCart({ name, option, price, sectionId }) {
    const numericPrice = Number(price);

    if (
        typeof name !== "string" ||
        typeof option !== "string" ||
        !Number.isFinite(numericPrice) ||
        numericPrice < 0
    ) {
        console.error("بيانات المنتج غير صحيحة.");
        return;
    }

    const normalizedSectionId = sectionId || "";

    const existing = cart.find(item =>
        item.name === name &&
        item.option === option &&
        item.sectionId === normalizedSectionId &&
        item.price === numericPrice
    );

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            name,
            option,
            price: numericPrice,
            quantity: 1,
            sectionId: normalizedSectionId
        });
    }

    playAddToCartSound();
    renderCart();
}

window.addItemToGrillCart = addItemToCart;

/* =========================================
   عرض المنتجات والبحث
========================================= */

function renderMenu(searchTerm = "") {
    if (!menuElement) return;

    menuElement.replaceChildren();

    const term = searchTerm.trim().toLocaleLowerCase("ar");
    let found = 0;

    grillSections.forEach(section => {
        const matchingItems = section.items
            .map((item, originalIndex) => ({
                name: item[0],
                options: item[1],
                image: item[2] || "",
                description: item[3] || "",
                nameEn: item[4] || EN_PRODUCTS[item[0]] || item[0],
                descriptionEn: item[5] || "",
                originalIndex
            }))
            .filter(item =>
                (item.name.toLocaleLowerCase().includes(term) || item.nameEn.toLocaleLowerCase().includes(term))
            );

        if (matchingItems.length === 0) return;

        found += matchingItems.length;

        const sectionElement = document.createElement("section");
        sectionElement.className = "menu-section";
        sectionElement.id = section.id;

        const heading = document.createElement("h2");
        heading.className = "section-title";
        heading.textContent = isEnglish() ? (section.title_en || EN_PRODUCTS[section.title] || section.title) : section.title;

        const grid = document.createElement("div");
        grid.className = "product-grid";

        matchingItems.forEach(({ name, nameEn, options, image, description, descriptionEn, originalIndex }) => {
            const shownName = isEnglish() ? nameEn : name;
            const shownDescription = isEnglish() ? (descriptionEn || description) : description;
            const card = document.createElement("article");
            card.className = "product-card";

            const imageBox = document.createElement("div");
            imageBox.className = "product-image-box";

            function showPlaceholder() {
                imageBox.replaceChildren();
                imageBox.classList.add("image-placeholder");
                imageBox.setAttribute("aria-label", (isEnglish() ? "Image placeholder for " : "مكان صورة ") + shownName);
            }

            if (image.trim()) {
                const img = document.createElement("img");

                img.className = "product-image";
                img.src = image;
                img.alt = shownName;
                img.loading = "lazy";

                img.addEventListener("error", showPlaceholder);
                imageBox.appendChild(img);
            } else {
                showPlaceholder();
            }

            const details = document.createElement("div");
            details.className = "product-details";

            const title = document.createElement("h3");
            title.textContent = shownName;
            details.appendChild(title);

            if (shownDescription) {
                const descriptionElement = document.createElement("p");
                descriptionElement.className = "ghannam-db-description";
                descriptionElement.textContent = shownDescription;
                details.appendChild(descriptionElement);
            }

            const select = document.createElement("select");
            select.id = "option-" + section.id + "-" + originalIndex;
            select.setAttribute("aria-label", "خيارات " + name);

            Object.entries(options).forEach(([optionName]) => {
                const option = document.createElement("option");

                option.value = optionName;
                option.textContent = displayOption(optionName);

                select.appendChild(option);
            });

            const optionLabel = document.createElement("label");
            optionLabel.className = "product-option-label";
            optionLabel.htmlFor = select.id;
            optionLabel.textContent = isEnglish() ? "Choose size or option" : "اختر الحجم أو الخيار";

            const priceElement = document.createElement("div");
            priceElement.className = "product-price";

            function updatePrice() {
                priceElement.textContent = money(options[select.value]);
            }

            select.addEventListener("change", updatePrice);
            updatePrice();

            const addButton = document.createElement("button");

            addButton.type = "button";
            addButton.className = "add-to-cart-button";
            addButton.textContent = "+";
            addButton.title = isEnglish() ? "Add to Cart" : "إضافة إلى السلة";
            addButton.setAttribute(
                "aria-label",
                (isEnglish() ? "Add " + shownName + " to cart" : "إضافة " + name + " إلى السلة")
            );

            addButton.addEventListener("click", () => {
                addItemToCart({
                    name,
                    option: select.value,
                    price: options[select.value],
                    sectionId: section.id
                });

                addButton.textContent = "✓";

                window.setTimeout(() => {
                    addButton.textContent = "+";
                }, 500);
            });

            details.append(optionLabel, select, priceElement);
            card.append(imageBox, details, addButton);
            grid.appendChild(card);
        });

        sectionElement.append(heading, grid);
        menuElement.appendChild(sectionElement);
    });

    if (found === 0) {
        const message = document.createElement("p");

        message.className = "empty-message";
        message.textContent = isEnglish() ? "No items found with this name." : "لم نجد صنفًا بهذا الاسم.";

        menuElement.appendChild(message);
    }

    updateProductView(getSavedProductView());
}

if (searchInput) {
    searchInput.addEventListener("input", event => {
        renderMenu(event.target.value);
    });
}

/* =========================================
   عناصر نافذة السلة
========================================= */

const overlay = document.getElementById("cartModalOverlay");
const openButton = document.getElementById("fixedCartBar");
const closeButton = document.getElementById("closeCartModal");
const continueButton = document.getElementById("continueShoppingButton");

const popupItems = document.getElementById("popupCartItems");
const addonsList = document.getElementById("cartAddonsList");

const couponInput = document.getElementById("couponCode");
const applyCouponButton = document.getElementById("applyCouponButton");
const couponStatus = document.getElementById("couponStatus");

const popupSubtotal = document.getElementById("popupSubtotal");
const popupDiscount = document.getElementById("popupDiscount");
const popupGrandTotal = document.getElementById("popupGrandTotal");
const popupFooterTotal = document.getElementById("popupFooterTotal");

const popupOrderForm = document.getElementById("popupOrderForm");
const popupOrderStatus = document.getElementById("popupOrderStatus");

/* =========================================
   استرجاع كود الخصم
========================================= */

let appliedCoupon = "";

try {
    const savedCoupon = localStorage.getItem(COUPON_STORAGE_KEY) || "";

    if (COUPONS[savedCoupon]) {
        appliedCoupon = savedCoupon;
    }
} catch (error) {
    console.warn("تعذر استرجاع كود الخصم:", error);
}

/* =========================================
   حساب الخصومات
========================================= */

function getDiscountAmount() {
    const subtotal = getCartTotal();
    const coupon = COUPONS[appliedCoupon];

    if (!coupon || subtotal <= 0) return 0;

    if (coupon.type === "percent") {
        return Math.min(
            subtotal,
            Math.round(subtotal * coupon.value / 100)
        );
    }

    return Math.min(subtotal, coupon.value);
}

function getFinalTotal() {
    return Math.max(0, getCartTotal() - getDiscountAmount());
}

function saveCoupon() {
    try {
        if (appliedCoupon) {
            localStorage.setItem(COUPON_STORAGE_KEY, appliedCoupon);
        } else {
            localStorage.removeItem(COUPON_STORAGE_KEY);
        }
    } catch (error) {
        console.warn("تعذر حفظ كود الخصم:", error);
    }
}

function showCouponMessage(message, success) {
    if (!couponStatus) return;

    couponStatus.textContent = message;
    couponStatus.classList.toggle("coupon-success", Boolean(success));
    couponStatus.classList.toggle("coupon-error", !success);
}

function applyCoupon() {
    if (!couponInput) return;

    const code = couponInput.value.trim().toUpperCase();

    if (!code) {
        appliedCoupon = "";
        saveCoupon();
        renderPopupCart();
        showCouponMessage("أدخلي كود الخصم أولاً.", false);
        return;
    }

    if (!COUPONS[code]) {
        appliedCoupon = "";
        saveCoupon();
        renderPopupCart();
        showCouponMessage("كود الخصم غير صحيح.", false);
        return;
    }

    if (getCartTotal() <= 0) {
        showCouponMessage("أضيفي منتجات إلى السلة أولاً.", false);
        return;
    }

    appliedCoupon = code;
    saveCoupon();
    renderPopupCart();

    const coupon = COUPONS[code];

    const description = coupon.type === "percent"
        ? "خصم " + coupon.value + "%"
        : "خصم " + money(coupon.value);

    showCouponMessage(
        "تم تطبيق " + description + " بنجاح.",
        true
    );
}

if (applyCouponButton) {
    applyCouponButton.addEventListener("click", applyCoupon);
}

if (couponInput) {
    couponInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            applyCoupon();
        }
    });
}

/* =========================================
   اقتراحات الإضافات
========================================= */

function getExtrasSection() {
    return grillSections.find(section => section.id === "extras");
}

function isExtraAlreadyInCart(extraName) {
    return cart.some(item =>
        item.sectionId === "extras" &&
        item.name === extraName
    );
}

function renderCartAddons() {
    if (!addonsList) return;

    addonsList.replaceChildren();

    const extrasSection = getExtrasSection();

    if (!extrasSection || extrasSection.items.length === 0) {
        const empty = document.createElement("p");

        empty.className = "addons-empty";
        empty.textContent = isEnglish() ? "No extras are currently available." : "لا توجد إضافات متاحة حاليًا.";

        addonsList.appendChild(empty);
        return;
    }

    const availableExtras = extrasSection.items.filter(item =>
        !isExtraAlreadyInCart(item[0])
    );

    if (availableExtras.length === 0) {
        const empty = document.createElement("p");

        empty.className = "addons-empty";
        empty.textContent = isEnglish() ? "You have added all available extras to your cart." : "أضفت جميع أصناف الإضافات إلى سلتك.";

        addonsList.appendChild(empty);
        return;
    }

    availableExtras.forEach(item => {
        const name = item[0];
        const shownName = isEnglish() ? (item[4] || EN_PRODUCTS[name] || name) : name;
        const options = item[1];
        const image = item[2] || "";

        Object.entries(options).forEach(([optionName, price]) => {
            const card = document.createElement("article");
            card.className = "cart-addon-card";

            const imageBox = document.createElement("div");
            imageBox.className = "cart-addon-image-box";

            function showAddonPlaceholder() {
                imageBox.replaceChildren();

                const placeholder = document.createElement("span");

                placeholder.className = "cart-addon-image-placeholder";
                placeholder.textContent = "🍽️";
                placeholder.setAttribute("aria-hidden", "true");

                imageBox.appendChild(placeholder);
            }

            if (image.trim()) {
                const img = document.createElement("img");

                img.className = "cart-addon-image";
                img.src = image;
                img.alt = shownName;
                img.loading = "lazy";

                img.addEventListener("error", showAddonPlaceholder);
                imageBox.appendChild(img);
            } else {
                showAddonPlaceholder();
            }

            const info = document.createElement("div");
            info.className = "cart-addon-info";

            const title = document.createElement("h4");
            title.className = "cart-addon-name";
            title.textContent = shownName;

            const priceElement = document.createElement("span");
            priceElement.className = "cart-addon-price";
            priceElement.textContent = money(price);

            info.append(title, priceElement);

            const addButton = document.createElement("button");

            addButton.type = "button";
            addButton.className = "cart-addon-add-button";
            addButton.textContent = "+";
            addButton.title = isEnglish() ? "Add " + shownName : "إضافة " + name;
            addButton.setAttribute(
                "aria-label",
                isEnglish() ? "Add " + shownName + " for " + money(price) : "إضافة " + name + " بسعر " + money(price)
            );

            addButton.addEventListener("click", () => {
                addItemToCart({
                    name,
                    option: optionName,
                    price,
                    sectionId: extrasSection.id
                });
            });

            card.append(imageBox, info, addButton);
            addonsList.appendChild(card);
        });
    });
}

/* =========================================
   عرض السلة داخل النافذة
========================================= */

function renderPopupCart() {
    if (popupItems) {
        popupItems.replaceChildren();

        if (cart.length === 0) {
            const empty = document.createElement("p");

            empty.className = "empty-message";
            empty.textContent = (isEnglish() ? "Your cart is empty. Add items from the menu." : "السلة فارغة. أضيفي وجبات من المنيو.");

            popupItems.appendChild(empty);
        }

        cart.forEach((item, index) => {
            const row = document.createElement("div");
            row.className = "cart-item";

            const info = document.createElement("div");
            info.className = "cart-item-info";

            const name = document.createElement("strong");
            name.className = "cart-item-name";
            name.textContent = displayProductName(item.name, item.sectionId);

            const option = document.createElement("div");
            option.className = "cart-item-option";
            option.textContent = displayOption(item.option);

            const subtotal = document.createElement("div");
            subtotal.className = "cart-item-subtotal";
            subtotal.textContent = money(item.price * item.quantity);

            info.append(name, option, subtotal);

            const controls = document.createElement("div");
            controls.className = "cart-controls";

            const decrease = document.createElement("button");

            decrease.type = "button";
            decrease.className = "quantity-button";
            decrease.textContent = "−";
            decrease.setAttribute(
                "aria-label",
                (isEnglish() ? "Decrease quantity of " : "تقليل كمية ") + displayProductName(item.name, item.sectionId)
            );

            decrease.addEventListener("click", () => {
                item.quantity -= 1;

                if (item.quantity <= 0) {
                    cart.splice(index, 1);
                }

                renderCart();
            });

            const quantity = document.createElement("span");
            quantity.className = "quantity-value";
            quantity.textContent = item.quantity;

            const increase = document.createElement("button");

            increase.type = "button";
            increase.className = "quantity-button";
            increase.textContent = "+";
            increase.setAttribute(
                "aria-label",
                (isEnglish() ? "Increase quantity of " : "زيادة كمية ") + displayProductName(item.name, item.sectionId)
            );

            increase.addEventListener("click", () => {
                item.quantity += 1;
                renderCart();
            });

            const remove = document.createElement("button");

            remove.type = "button";
            remove.className = "remove-button";
            remove.textContent = isEnglish() ? "Remove" : "حذف";
            remove.setAttribute(
                "aria-label",
                (isEnglish() ? "Remove " : "حذف ") + displayProductName(item.name, item.sectionId)
            );

            remove.addEventListener("click", () => {
                cart.splice(index, 1);
                renderCart();
            });

            controls.append(decrease, quantity, increase, remove);
            row.append(info, controls);
            popupItems.appendChild(row);
        });
    }

    if (popupSubtotal) {
        popupSubtotal.textContent = money(getCartTotal());
    }

    if (popupDiscount) {
        popupDiscount.textContent = money(getDiscountAmount());
    }

    if (popupGrandTotal) {
        popupGrandTotal.textContent = money(getFinalTotal());
    }

    if (popupFooterTotal) {
        popupFooterTotal.textContent = money(getFinalTotal());
    }

    renderCartAddons();
    updateFixedCart();
}

/* =========================================
   فتح وإغلاق نافذة السلة
========================================= */

function openCartModal(event) {
    if (event) event.preventDefault();
    if (!overlay) {
        console.error("لم يتم العثور على نافذة السلة: #cartModalOverlay");
        return;
    }

    // أظهر النافذة أولاً حتى لا يمنع خطأ في تحديث محتواها من فتحها.
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("cart-modal-open");

    try {
        renderPopupCart();
    } catch (error) {
        console.error("حدث خطأ أثناء تحديث محتويات السلة:", error);
        if (popupOrderStatus) {
            popupOrderStatus.textContent = (isEnglish() ? "The cart opened, but some details could not be updated. Refresh and try again." : "ظهرت السلة، لكن تعذر تحديث بعض تفاصيلها. حدّث الصفحة وحاول مجدداً.");
        }
    }

    if (closeButton) {
        closeButton.focus();
    }
}

function closeCartModal() {
    if (!overlay) return;

    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cart-modal-open");

    if (openButton) {
        openButton.focus();
    }
}

if (openButton) {
    openButton.addEventListener("click", openCartModal);
}

if (closeButton) {
    closeButton.addEventListener("click", closeCartModal);
}

if (continueButton) {
    continueButton.addEventListener("click", closeCartModal);
}

if (overlay) {
    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            closeCartModal();
        }
    });
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && overlay && !overlay.hidden) {
        closeCartModal();
    }
});

/* =========================================
   تحديث السلة وحفظها
========================================= */

function renderCart() {
    saveCart();
    updateFixedCart();

    // لا نسمح لخطأ في الإضافات أو تفاصيل النافذة بتعطيل تحديث السلة الأساسية.
    try {
        renderPopupCart();
    } catch (error) {
        console.error("تعذر تحديث تفاصيل نافذة السلة:", error);
    }
}

/* =========================================
   إرسال الطلب عبر واتساب
========================================= */

if (popupOrderForm) {
    popupOrderForm.addEventListener("submit", event => {
        event.preventDefault();

        if (cart.length === 0) {
            if (popupOrderStatus) {
                popupOrderStatus.textContent =
                    (isEnglish() ? "Your cart is empty. Add at least one item." : "السلة فارغة. أضيفي منتجًا واحدًا على الأقل.");
            }

            return;
        }

        if (!popupOrderForm.reportValidity()) return;

        const customerName =
            document.getElementById("popupCustomerName")?.value.trim() || "";

        const customerPhone =
            document.getElementById("popupCustomerPhone")?.value.trim() || "";

        const customerAddress =
            document.getElementById("popupCustomerAddress")?.value.trim() || "";

        const customerNotes =
            document.getElementById("popupCustomerNotes")?.value.trim() || "";

        let message = isEnglish()
            ? "🍖 New Order — Al Ghannam Restaurant, Grill Branch\n\n"
            : "🍖 طلب جديد من مطعم الغنام - فرع المشاوي\n\n";

        message += (isEnglish() ? "Name: " : "الاسم: ") + customerName + "\n";
        message += (isEnglish() ? "Phone: " : "رقم الهاتف: ") + customerPhone + "\n";
        message += (isEnglish() ? "Address: " : "العنوان: ") + customerAddress + "\n\n";
        message += (isEnglish() ? "Order Details:\n" : "تفاصيل الطلب:\n");

        cart.forEach((item, index) => {
            message +=
                (index + 1) + "- " +
                displayProductName(item.name, item.sectionId) + " (" + displayOption(item.option) + ")" +
                " × " + item.quantity +
                " = " + money(item.price * item.quantity) + "\n";
        });

        message += "\n" + (isEnglish() ? "Subtotal: " : "المجموع الفرعي: ") + money(getCartTotal());
        message += "\n" + (isEnglish() ? "Discount Code: " : "كود الخصم: ") + (appliedCoupon || (isEnglish() ? "None" : "لا يوجد"));
        message += "\n" + (isEnglish() ? "Discount: " : "قيمة الخصم: ") + money(getDiscountAmount());
        message += "\n" + (isEnglish() ? "Grand Total: " : "الإجمالي النهائي: ") + money(getFinalTotal());

        if (customerNotes) {
            message += "\n" + (isEnglish() ? "Notes: " : "ملاحظات: ") + customerNotes;
        }

        const whatsappURL =
            "https://wa.me/" + WHATSAPP_NUMBER +
            "?text=" + encodeURIComponent(message);

        const whatsappWindow = window.open(whatsappURL, "_blank");

        if (!whatsappWindow) {
            window.location.href = whatsappURL;
        }
    });
}

/* =========================================
   زر تبديل اللغة
========================================= */
const languageToggle = document.getElementById("languageToggle");
if (languageToggle) languageToggle.addEventListener("click", () => setGrillLanguage(isEnglish() ? "ar" : "en"));

/* =========================================
   مزامنة السلة عند الرجوع للصفحة
========================================= */

window.addEventListener("pageshow", () => {
    updateFixedCart();
    renderPopupCart();
});

window.addEventListener("storage", event => {
    if (event.key !== CART_STORAGE_KEY && event.key !== null) {
        return;
    }

    const savedCart = loadSavedCart();

    cart.splice(0, cart.length, ...savedCart);

    renderCart();
});

/* =========================================
   مزامنة منيو المشاوي من Supabase
   يقرأ الصورة والوصف والأسعار من قاعدة البيانات.
========================================= */

const GRILL_DB_SLUG_BY_SECTION = {
    "grilled": "grilled-by-weight",
    "appetizers": "appetizers",
    "skewers": "skewers",
    "wraps": "wraps",
    "raw-meat": "raw-meat",
    "chicken-hall": "chicken",
    "chicken-takeaway": "chicken-takeaway",
    "quzi": "quzi",
    "shawarma": "shawarma",
    "breakfast": "breakfast",
    "extras": "extras",
    "drinks": "drinks"
};

async function syncGrillMenuFromDatabase() {
    try {
        const { categories: dbCategories, products: dbProducts } =
            await loadBranchMenu("grill");

        if (!dbProducts.length) {
            console.warn("Supabase: لا توجد منتجات متاحة لفرع المشاوي؛ ستبقى القائمة المحلية ظاهرة.");
            return;
        }

        const categoryBySlug = new Map(
            dbCategories.map(category => [category.slug, category])
        );

        grillSections.forEach(section => {
            const slug = GRILL_DB_SLUG_BY_SECTION[section.id];
            const category = categoryBySlug.get(slug);

            if (!category) {
                section.items = [];
                return;
            }

            section.title = category.name;
            section.title_en = category.name_en || EN_PRODUCTS[category.name] || category.name;
            section.items = dbProducts
                .filter(product => product.category_id === category.id)
                .map(product => {
                    const storedOptions = product.extra?.options;
                    const options = storedOptions &&
                        typeof storedOptions === "object" &&
                        !Array.isArray(storedOptions) &&
                        Object.keys(storedOptions).length
                        ? storedOptions
                        : { "الوجبة": Number(product.price) || 0 };

                    // image_url يتغير إلى رابط Storage عند رفع صورة جديدة من الداش بورد.
                    // وإذا لم توجد صورة مرفوعة، نستخدم المسار المحلي القديم.

                    let image = product.image_url ||
                        product.extra?.local_image_path || "";

                    image = String(image).trim();

                    // تصحيح مسارات الصور المحلية على GitHub Pages
                    if (/^\/image\//i.test(image)) {
                        image = image.replace(/^\/+/, "");
                    }
                    return [
                        product.name,
                        options,
                        String(image),
                        product.description || "",
                        product.name_en || EN_PRODUCTS[product.name] || product.name,
                        product.description_en || product.description || ""
                    ];
                });
        });

        ensureMenuDescriptionStyle();
        renderCategories();
        renderMenu();
        renderCart();
        updateFixedCart();

        console.info(`Supabase: تم تحميل ${dbProducts.length} منتجًا لفرع المشاوي.`);
    } catch (error) {
        console.error(
            "تعذر تحميل منيو المشاوي من Supabase؛ ستبقى القائمة المحلية ظاهرة:",
            error
        );
    }
}

/* =========================================
   تشغيل الصفحة
========================================= */

applyStaticLanguage();
renderCategories();
renderMenu();
renderCart();
updateFixedCart();
void syncGrillMenuFromDatabase();


