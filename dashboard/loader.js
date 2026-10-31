"use strict";

function hidePageLoader() {
    const loader = document.getElementById("pageLoader");

    if (!loader || loader.dataset.hidden === "true") return;

    loader.dataset.hidden = "true";
    loader.classList.add("hidden");

    setTimeout(() => {
        loader.remove();
    }, 450);
}

// إتاحة الدالة لملفات الصفحات
window.hidePageLoader = hidePageLoader;

// الصفحات العادية تخفي شاشة التحميل بعد اكتمال التحميل
const loader = document.getElementById("pageLoader");

if (loader && loader.dataset.manual !== "true") {
    window.addEventListener("load", hidePageLoader, {
        once: true
    });

    // حماية إضافية إذا تأخر تحميل أحد الموارد
    setTimeout(hidePageLoader, 8000);
}