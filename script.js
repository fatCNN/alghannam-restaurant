
const products = [
    {
        id: 1,
        name: "برغر لحم",
        description: "برغر لحم شهي مع الخضروات والصوص",
        price: 8000,
        discount: 15,
        available: true,
        category: "البرغر",
        emoji: "🍔"
    },
    {
        id: 2,
        name: "شاورما دجاج",
        description: "شاورما دجاج طازجة مع الصوص",
        price: 5000,
        discount: 0,
        available: true,
        category: "الشاورما",
        emoji: "🌯"
    },
    {
        id: 3,
        name: "بيتزا",
        description: "بيتزا بالجبن والخضروات",
        price: 10000,
        discount: 0,
        available: false,
        category: "البيتزا",
        emoji: "🍕"
    },
    {
        id: 4,
        name: "وجبة دجاج",
        description: "وجبة دجاج مع البطاطا",
        price: 7500,
        discount: 0,
        available: true,
        category: "الوجبات",
        emoji: "🍗"
    },
    {
        id: 5,
        name: "بطاطا مقلية",
        description: "بطاطا مقرمشة ولذيذة",
        price: 2500,
        discount: 0,
        available: true,
        category: "المقبلات",
        emoji: "🍟"
    },
    {
        id: 6,
        name: "مشروب بارد",
        description: "مشروب منعش",
        price: 1500,
        discount: 0,
        available: true,
        category: "المشروبات",
        emoji: "🥤"
    }
];

// أضيفي رقم واتساب المطعم لاحقًا بصيغة دولية دون علامة +
const WHATSAPP_NUMBER = "";

const cart = new Map();

const menuElement = document.getElementById("menu");
const cartCountElement = document.getElementById("cartCount");
const cartItemsElement = document.getElementById("cartItems");
const cartTotalElement = document.getElementById("cartTotal");
const cartButton = document.getElementById("cartButton");
const cartSection = document.getElementById("cartSection");
const orderForm = document.getElementById("orderForm");
const loader = document.getElementById("loader");

// تنسيق الأسعار بالدينار العراقي
function formatPrice(price) {
    return new Intl.NumberFormat("en-US").format(price);
}

// حساب السعر بعد الخصم
function getFinalPrice(product) {
    const validDiscount = Math.min(
        100,
        Math.max(0, Number(product.discount) || 0)
    );

    return Math.round(
        product.price * (100 - validDiscount) / 100
    );
}

// عرض جميع المنتجات
function renderMenu() {
    menuElement.innerHTML = "";

    products.forEach(product => {
        const card = document.createElement("article");
        card.className = "product-card";

        if (!product.available) {
            card.classList.add("unavailable");
        }

        const finalPrice = getFinalPrice(product);
        const hasDiscount =
            product.discount > 0 && product.available;

        let priceHTML = "";

        if (hasDiscount) {
            const savedAmount = product.price - finalPrice;

            priceHTML = `
                <span class="current-price">
                    ${formatPrice(finalPrice)} د.ع
                </span>

                <span class="old-price">
                    ${formatPrice(product.price)} د.ع
                </span>

                <span class="discount-badge">
                    خصم ${product.discount}%
                </span>

                <div class="saved-amount">
                    وفّرت ${formatPrice(savedAmount)} د.ع
                </div>
            `;
        } else {
            priceHTML = `
                <span class="current-price">
                    ${formatPrice(product.price)} د.ع
                </span>
            `;
        }

        card.innerHTML = `
            <div class="product-image" aria-hidden="true">
                ${product.emoji}
            </div>

            <div class="product-info">
                <h3></h3>

                <p class="product-description"></p>

                <div class="product-price">
                    ${priceHTML}
                </div>

                <button
                    class="add-button"
                    type="button"
                    ${!product.available ? "disabled" : ""}
                >
                    ${
                        product.available
                            ? "أضف إلى السلة +"
                            : "نفد المنتج"
                    }
                </button>
            </div>
        `;

        card.querySelector("h3").textContent = product.name;
        card.querySelector(".product-description").textContent =
            product.description;

        card.querySelector(".add-button").addEventListener(
            "click",
            () => addToCart(product.id)
        );

        menuElement.appendChild(card);
    });
}

// إضافة منتج إلى السلة
function addToCart(productId) {
    const product = products.find(
        item => item.id === productId
    );

    if (!product || !product.available) {
        alert("عذرًا، هذا المنتج غير متوفر حاليًا.");
        return;
    }

    const currentQuantity = cart.get(productId) || 0;

    cart.set(productId, currentQuantity + 1);

    renderCart();
}

// زيادة أو تقليل كمية المنتج
function changeQuantity(productId, amount) {
    const product = products.find(
        item => item.id === productId
    );

    if (!product || !product.available) {
        return;
    }

    const currentQuantity = cart.get(productId) || 0;
    const newQuantity = currentQuantity + amount;

    if (newQuantity <= 0) {
        cart.delete(productId);
    } else {
        cart.set(productId, newQuantity);
    }

    renderCart();
}

// حذف المنتج من السلة
function removeFromCart(productId) {
    cart.delete(productId);
    renderCart();
}

// عرض محتويات السلة وحساب المجموع
function renderCart() {
    cartItemsElement.innerHTML = "";

    let totalQuantity = 0;
    let totalPrice = 0;

    cart.forEach((quantity, productId) => {
        const product = products.find(
            item => item.id === productId
        );

        if (!product || !product.available) {
            cart.delete(productId);
            return;
        }

        const finalPrice = getFinalPrice(product);

        totalQuantity += quantity;
        totalPrice += finalPrice * quantity;

        const item = document.createElement("div");
        item.className = "cart-item";

        item.innerHTML = `
            <div>
                <strong></strong>

                <div>
                    ${formatPrice(finalPrice)} د.ع للواحد
                </div>
            </div>

            <div class="quantity-controls">
                <button
                    type="button"
                    class="decrease"
                    aria-label="تقليل الكمية"
                >−</button>

                <span>${quantity}</span>

                <button
                    type="button"
                    class="increase"
                    aria-label="زيادة الكمية"
                >+</button>

                <button
                    type="button"
                    class="remove-button"
                >حذف</button>
            </div>
        `;

        item.querySelector("strong").textContent =
            product.name;

        item.querySelector(".decrease").addEventListener(
            "click",
            () => changeQuantity(productId, -1)
        );

        item.querySelector(".increase").addEventListener(
            "click",
            () => changeQuantity(productId, 1)
        );

        item.querySelector(".remove-button").addEventListener(
            "click",
            () => removeFromCart(productId)
        );

        cartItemsElement.appendChild(item);
    });

    cartCountElement.textContent = totalQuantity;
    cartTotalElement.textContent = formatPrice(totalPrice);

    if (totalQuantity === 0) {
        cartItemsElement.textContent =
            "السلة فارغة، أضيفي وجبتك المفضلة.";
    }
}

// الانتقال إلى السلة
cartButton.addEventListener("click", () => {
    cartSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

// تجهيز الطلب وإرساله إلى واتساب
orderForm.addEventListener("submit", event => {
    event.preventDefault();

    if (cart.size === 0) {
        alert("أضيفي منتجًا إلى السلة أولًا.");
        return;
    }

    if (!WHATSAPP_NUMBER) {
        alert(
            "الموقع قيد التجهيز. سنضيف رقم واتساب المطعم لاحقًا."
        );
        return;
    }

    const customerName =
        document.getElementById("customerName").value.trim();

    const customerPhone =
        document.getElementById("customerPhone").value.trim();

    const customerAddress =
        document.getElementById("customerAddress").value.trim();

    const branch =
        document.getElementById("branch").value;

    const lines = [
        "طلب جديد من منيو المطعم",
        `الفرع: ${branch}`,
        `الاسم: ${customerName}`,
        `رقم الهاتف: ${customerPhone}`,
        `العنوان: ${customerAddress}`,
        "",
        "الطلبات:"
    ];

    let total = 0;

    cart.forEach((quantity, productId) => {
        const product = products.find(
            item => item.id === productId
        );

        if (!product || !product.available) {
            return;
        }

        const finalPrice = getFinalPrice(product);
        const lineTotal = finalPrice * quantity;

        total += lineTotal;

        lines.push(
            `${product.name} × ${quantity} = ` +
            `${formatPrice(lineTotal)} د.ع`
        );
    });

    lines.push("");
    lines.push(`المجموع: ${formatPrice(total)} د.ع`);

    const url =
        `https://wa.me/${WHATSAPP_NUMBER}` +
        `?text=${encodeURIComponent(lines.join("\n"))}`;

    window.open(url, "_blank", "noopener,noreferrer");
});

// تشغيل الموقع
renderMenu();
renderCart();

// إخفاء شاشة التحميل بعد اكتمال تحميل الصفحة
window.addEventListener("load", () => {
    if (loader) {
        loader.classList.add("hidden");
    }
});

// إخفاء احتياطي لشاشة التحميل
setTimeout(() => {
    if (loader) {
        loader.classList.add("hidden");
    }
}, 3000);
