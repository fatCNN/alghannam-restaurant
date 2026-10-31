function hidePageLoader() {
  const loader = document.getElementById('pageLoader');

  if (!loader) return;

  loader.classList.add('hidden');

  setTimeout(() => {
    loader.remove();
  }, 450);
}

// إتاحة دالة إخفاء الشعار لملفات الصفحات
window.hidePageLoader = hidePageLoader;

// الصفحات العادية تخفي الشعار بعد التحميل
// أما صفحة الإدارة فتتحكم بالتوقيت من admin.js
const loader = document.getElementById('pageLoader');

if (loader && loader.dataset.manual !== 'true') {
  window.addEventListener('load', hidePageLoader, {
    once: true
  });
}