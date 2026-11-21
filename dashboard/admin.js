import {
  supabaseClient as client,
  isSupabaseConfigured as readyConfig
} from './supabase-client.js';

const $ = selector => document.querySelector(selector);

// Cloudflare R2 image service. Replace after deploying the Worker.
const R2_IMAGE_WORKER_URL = 'https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev';
const IMAGE_BUCKET = 'menu-images'; // Legacy bucket name; retained only for old records.

const SERVER_OWNER_IDS = new Set([
  '489c60eb-5ae5-4611-96d6-b1d911e2686c',
  '1488410c-39a5-417b-92f6-c68ee55c886d'
]);

const PERMISSION_LABELS = {
  can_manage_menu: 'إدارة التصنيفات',
  can_manage_prices: 'إدارة الأسعار',
  can_manage_products: 'إدارة المنتجات',
  can_manage_orders: 'إدارة الطلبات',
  can_manage_conversations: 'إدارة المحادثات',
  can_manage_offers: 'إدارة العروض',
  can_manage_branch_staff: 'مشاهدة موظفي جميع الفروع',
  can_delete_staff: 'حذف موظفي الفرع'
};

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS);

const CATEGORY_SCHEDULE_DAYS = [
  { value: 1, label: 'الأحد' },
  { value: 2, label: 'الاثنين' },
  { value: 3, label: 'الثلاثاء' },
  { value: 4, label: 'الأربعاء' },
  { value: 5, label: 'الخميس' },
  { value: 6, label: 'الجمعة' },
  { value: 7, label: 'السبت' }
];

let branches = [];
let categories = [];
let products = [];
let offers = [];
let coupons = [];
let discounts = [];
let discountBranches = [];
let discountCategories = [];
let discountProducts = [];
let editingDiscountId = null;
let users = [];

let activeBranch = 'fastfood';
let sessionUser = null;
let currentProfile = null;
let ownPermissions = {};
let permissionsByUser = {};

let isServerOwner = false;
let isOwner = false;
let canDeleteStaff = false;

let currentImageUrl = '';
let currentImagePath = '';
let currentOfferImageUrl = '';
let currentOfferImagePath = '';

let toastTimer = null;

/* =====================================================
   عناصر الواجهة
===================================================== */

const loginPanel = $('#loginPanel');
const dashboard = $('#dashboard');
const setupWarning = $('#setupWarning');

/* =====================================================
   أدوات عامة
===================================================== */

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function message(element, text, type = '') {
  if (!element) return;

  element.textContent = text || '';
  element.className = `form-message ${type}`.trim();
}

function toast(text, type = 'success') {
  const el = $('#toast');
  if (!el) return;

  el.textContent = text;
  el.className = `toast ${type}`;
  el.hidden = false;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 4000);
}

function money(value) {
  return `${Number(value || 0).toLocaleString('en-US')} د.ع`;
}

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || `category-${Date.now()}`;
}

function setLoggedIn(isLoggedIn) {
  if (loginPanel) loginPanel.hidden = isLoggedIn;
  if (dashboard) dashboard.hidden = !isLoggedIn;

  const logoutButton = $('#logoutButton');
  const userEmail = $('#userEmail');

  if (logoutButton) logoutButton.hidden = !isLoggedIn;

  if (userEmail) {
    userEmail.textContent = isLoggedIn
      ? sessionUser?.email || ''
      : '';
  }
}

function setBusy(button, busy, label = 'جارٍ الحفظ...') {
  if (!button) return;

  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }

  button.disabled = busy;

  button.textContent = busy
    ? label
    : button.dataset.originalText;
}

function resetAuthorizationState() {
  sessionUser = null;
  currentProfile = null;
  ownPermissions = {};
  permissionsByUser = {};

  isServerOwner = false;
  isOwner = false;
  canDeleteStaff = false;

  users = [];
}

function isManager() {
  return currentProfile?.role === 'manager';
}

function hasPermission(permission) {
  return (
    isServerOwner ||
    isOwner ||
    ownPermissions?.[permission] === true
  );
}

function branchName(branchId) {
  return branches.find(branch =>
    String(branch.id) === String(branchId)
  )?.name || '—';
}

function canManageProducts() {
  return hasPermission('can_manage_products');
}

function canManagePrices() {
  return hasPermission('can_manage_prices') || canManageProducts();
}

function canEditAnyProduct() {
  return canManageProducts() || canManagePrices();
}

function canManageCategories() {
  return (
    isServerOwner ||
    isOwner ||
    ownPermissions?.can_manage_menu === true
  );
}

function canManageOffers() {
  return hasPermission('can_manage_offers');
}

// الخصومات التلقائية تستخدم صلاحية إدارة العروض الحالية لتجنب كسر تكامل manage-users.
function canManageDiscounts() {
  // نعيد استخدام صلاحية إدارة العروض الحالية حتى لا نحتاج إلى تغيير Edge Function الحالية.
  return canManageOffers();
}

function canManageUsers() {
  return isServerOwner || isOwner || (
    isManager() &&
    hasPermission('can_manage_branch_staff')
  );
}

/*
  نحدد فرع المشاوي من معرف الفرع أو اسمه.
  هذا يمنع الاعتماد على معرف ثابت إذا كان معرف الفرع
  في قاعدة البيانات مختلفاً.
*/
function isGrillBranch(branchId = activeBranch) {
  const branch = branches.find(item =>
    String(item.id) === String(branchId)
  );

  const identity = `${branchId || ''} ${branch?.name || ''}`
    .toLowerCase();

  return (
    identity.includes('grill') ||
    identity.includes('mashawi') ||
    identity.includes('مشاوي') ||
    identity.includes('المشاوي')
  );
}

// الأحجام متاحة للمشاوي والوجبات السريعة.
function canUseProductSizes(branchId = activeBranch) {
  const branch = branches.find(item =>
    String(item.id) === String(branchId)
  );

  const identity = `${branchId || ''} ${branch?.name || ''}`.toLowerCase();

  return isGrillBranch(branchId) ||
    identity.includes('fastfood') ||
    identity.includes('fast food') ||
    identity.includes('وجبات') ||
    identity.includes('الوجبات السريعة');
}

/* =====================================================
   الأحجام — products.extra.size_options
===================================================== */

function normalizeSizeOptions(extra) {
  if (!extra || typeof extra !== 'object') return [];

  const options = extra.size_options;

  if (!Array.isArray(options)) return [];

  return options.map((item, index) => ({
    value: String(item?.value || `size_${index + 1}`),
    label: String(item?.label || ''),
    label_en: String(item?.label_en || ''),
    price: Number(item?.price || 0)
  }));
}

function renderProductSizes(sizeOptions = []) {
  const panel = $('#productSizesPanel');
  const list = $('#productSizesList');

  if (!panel || !list) return;

  panel.hidden = !canUseProductSizes();

  if (!canUseProductSizes()) {
    list.innerHTML = '';
    return;
  }

  if (!sizeOptions.length) {
    list.innerHTML = `
      <p class="muted" data-empty-sizes>
        لا توجد أحجام مضافة لهذا المنتج.
      </p>
    `;
    return;
  }

  list.innerHTML = sizeOptions.map((size, index) => `
    <div class="product-size-row" data-size-row>
      <div class="user-form-grid">

        <label>
          اسم الحجم بالعربية
          <input
            type="text"
            data-size-label
            maxlength="100"
            value="${escapeHTML(size.label)}"
            placeholder="مثلاً: نصف كيلو">
        </label>

        <label>
          اسم الحجم بالإنجليزية
          <input
            type="text"
            data-size-label-en
            maxlength="100"
            dir="ltr"
            value="${escapeHTML(size.label_en)}"
            placeholder="Example: Half Kilo">
        </label>

        <label>
          السعر بالدينار العراقي
          <input
            type="number"
            data-size-price
            min="0"
            step="250"
            value="${Number(size.price) || 0}">
        </label>

        <input
          type="hidden"
          data-size-value
          value="${escapeHTML(size.value || `size_${index + 1}`)}">

        <div class="user-form-actions">
          <button
            type="button"
            class="button button-danger"
            data-remove-size>
            حذف الحجم
          </button>
        </div>

      </div>
    </div>
  `).join('');
}

function addProductSize() {
  if (!canManageProducts()) {
    toast('إضافة الأحجام متاحة لمن لديه صلاحية إدارة المنتجات.', 'error');
    return;
  }

  if (!canUseProductSizes($('#productBranch').value || activeBranch)) {
    toast('إضافة الأحجام متاحة لفرعي المشاوي والوجبات السريعة.', 'error');
    return;
  }

  const list = $('#productSizesList');

  if (!list) return;

  const empty = list.querySelector('[data-empty-sizes]');
  if (empty) empty.remove();

  const row = document.createElement('div');

  row.className = 'product-size-row';
  row.dataset.sizeRow = '';

  row.innerHTML = `
    <div class="user-form-grid">

      <label>
        اسم الحجم بالعربية
        <input
          type="text"
          data-size-label
          maxlength="100"
          placeholder="مثلاً: كيلو">
      </label>

      <label>
        اسم الحجم بالإنجليزية
        <input
          type="text"
          data-size-label-en
          maxlength="100"
          dir="ltr"
          placeholder="Example: Kilo">
      </label>

      <label>
        السعر بالدينار العراقي
        <input
          type="number"
          data-size-price
          min="0"
          step="250"
          value="0">
      </label>

      <input
        type="hidden"
        data-size-value
        value="size_${crypto.randomUUID()}">

      <div class="user-form-actions">
        <button
          type="button"
          class="button button-danger"
          data-remove-size>
          حذف الحجم
        </button>
      </div>

    </div>
  `;

  list.appendChild(row);
}

function collectProductSizes() {
  if (!canUseProductSizes($('#productBranch').value || activeBranch)) {
    return null;
  }

  const rows = [
    ...document.querySelectorAll('#productSizesList [data-size-row]')
  ];

  const result = [];

  rows.forEach((row, index) => {
    const label = row.querySelector('[data-size-label]')?.value.trim() || '';
    const labelEn = row.querySelector('[data-size-label-en]')?.value.trim() || '';
    const priceRaw = row.querySelector('[data-size-price]')?.value;
    const value = row.querySelector('[data-size-value]')?.value ||
      `size_${index + 1}`;

    const price = Number(priceRaw);

    if (!label && !labelEn && !priceRaw) return;

    if (!label) {
      throw new Error(`اكتب الاسم العربي للحجم رقم ${index + 1}.`);
    }

    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`تحقق من سعر الحجم: ${label}.`);
    }

    result.push({
      value,
      label,
      label_en: labelEn,
      price
    });
  });

  return result;
}

/* =====================================================
   تغيير كلمة مرور حساب مستخدم
===================================================== */

function canResetUserPassword(user) {
  if (!user || !currentProfile) return false;

  if (String(user.id) === String(currentProfile.id)) return false;
  if (SERVER_OWNER_IDS.has(user.id)) return false;

  if (isServerOwner) return true;

  return (
    isOwner &&
    ['manager', 'staff', 'customer'].includes(user.role)
  );
}

async function resetUserPassword(userId) {
  const user = users.find(item =>
    String(item.id) === String(userId)
  );

  if (!user || !canResetUserPassword(user)) {
    toast('ليس لديك صلاحية تغيير رمز هذا الحساب.', 'error');
    return;
  }

  const newPassword = prompt(
    `إعادة تعيين كلمة المرور\n\nالحساب: ${user.full_name || user.email}\n\nاكتب كلمة المرور الجديدة (8 أحرف على الأقل):`
  );

  if (newPassword === null) return;

  if (newPassword.length < 8) {
    toast('كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'error');
    return;
  }

  const confirmation = prompt('أعد كتابة كلمة المرور الجديدة للتأكيد:');

  if (confirmation === null) return;

  if (newPassword !== confirmation) {
    toast('كلمتا المرور غير متطابقتين.', 'error');
    return;
  }

  try {
    await manageUsers({
      action: 'change_password',
      userId: user.id,
      password: newPassword
    });

    toast('تم تغيير كلمة مرور الحساب بنجاح.');

  } catch (error) {
    toast(`تعذر تغيير كلمة المرور: ${error.message}`, 'error');
  }
}

/* =====================================================
   صلاحيات إنشاء الحسابات
===================================================== */

function configureCreateRoleOptions() {
  const select = $('#newUserRole');
  if (!select) return;

  const existingValue = select.value;

  const definitions = [
    { value: 'staff', text: 'موظف' },
    { value: 'manager', text: 'مدير فرع' },
    { value: 'owner', text: 'صاحب المطعم' }
  ];

  definitions.forEach(item => {
    const exists = [...select.options].some(
      option => option.value === item.value
    );

    const allowed =
      item.value === 'staff' ||
      (item.value === 'manager' && isServerOwner) ||
      (item.value === 'owner' && isServerOwner);

    if (allowed && !exists) {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.text;
      select.appendChild(option);
    }
  });

  [...select.options].forEach(option => {
    if (
      !isServerOwner &&
      ['manager', 'owner'].includes(option.value)
    ) {
      option.remove();
    }
  });

  select.value = [...select.options].some(
    option => option.value === existingValue
  ) ? existingValue : 'staff';
}

/* =====================================================
   إظهار الأقسام حسب الصلاحيات
===================================================== */

function applyDashboardPermissions() {
  const productsAllowed = canEditAnyProduct();
  const productCreationAllowed = canManageProducts();
  const categoriesAllowed = canManageCategories();
  const offersAllowed = canManageOffers();

  $('#usersPanel').hidden = !canManageUsers();

  $('#createUserPanel').hidden = !isOwner;
  $('#permissionsEditor').hidden = true;

  $('#newProductButton').hidden = !productCreationAllowed;
  $('#productEditorPanel').hidden = !productsAllowed;

  // حاوية زر التصنيفات؛ مع دعم البنية القديمة إذا لم يُحدّث HTML بعد.
  const categoriesPanel = $('#categoriesPanel') ||
    $('#categoriesList')?.closest('.categories-panel');

  if (categoriesPanel) {
    categoriesPanel.hidden = !categoriesAllowed;
  }

  const openCategoriesButton = $('#openCategoriesModal');
  if (openCategoriesButton) {
    openCategoriesButton.hidden = !categoriesAllowed;
  }

  $('#categoryForm').hidden = !categoriesAllowed;
  $('#offersPanel').hidden = !offersAllowed;

  const couponsPanel = $('#couponsPanel');

  if (couponsPanel) {
    couponsPanel.hidden = !(isOwner || isServerOwner);
  }

  const discountsPanel = $('#discountsPanel');
  if (discountsPanel) discountsPanel.hidden = !canManageDiscounts();

  const ordersLink = document.querySelector('a[href="orders.html"]');
  const conversationsLink = document.querySelector('a[href="conversations.html"]');

  if (ordersLink) {
    ordersLink.hidden = !hasPermission('can_manage_orders');
  }

  if (conversationsLink) {
    conversationsLink.hidden = !hasPermission('can_manage_conversations');
  }

  $('#branchSelect').disabled = isManager();
  $('#productBranch').disabled = isManager();
  $('#offerBranch').disabled = isManager();

  if (isManager() && currentProfile?.branch_id) {
    activeBranch = String(currentProfile.branch_id);
  }

  configureCreateRoleOptions();
  setProductFormPermissions();
}

function setProductFormPermissions() {
  const id = $('#productId')?.value;
  const editing = Boolean(id);
  const fullAccess = canManageProducts();
  const priceAccess = canManagePrices();

  const controls = [
    '#productBranch',
    '#productCategory',
    '#productName',
    '#productNameEn',
    '#productDescription',
    '#productDescriptionEn',
    '#productOrder',
    '#productImage',
    '#productAvailable'
  ];

  controls.forEach(selector => {
    const element = $(selector);
    if (element) element.disabled = !fullAccess;
  });

  const priceInput = $('#productPrice');
  if (priceInput) priceInput.disabled = !priceAccess;

  const sizesPanel = $('#productSizesPanel');

  if (sizesPanel) {
    sizesPanel.hidden = !canUseProductSizes(
      $('#productBranch')?.value || activeBranch
    );

    sizesPanel.querySelectorAll('input, button').forEach(element => {
      element.disabled = !fullAccess;
    });
  }

  const addSizeButton = $('#addProductSizeButton');

  if (addSizeButton) {
    addSizeButton.disabled = !fullAccess;
  }

  const saveButton = $('#saveProductButton');

  if (saveButton) {
    saveButton.disabled = !editing
      ? !fullAccess
      : !(fullAccess || priceAccess);

    saveButton.textContent =
      !fullAccess && priceAccess && editing
        ? 'حفظ السعر'
        : editing
          ? 'حفظ التعديلات'
          : 'حفظ المنتج';
  }
}

/* =====================================================
   تسجيل الدخول والتحقق من الحساب
===================================================== */

async function signIn(event) {
  event.preventDefault();

  const status = $('#loginMessage');

  if (!client) {
    message(status, 'أكمل بيانات Supabase داخل supabase-config.js أولاً.', 'error');
    return;
  }

  const button = $('#loginForm button[type="submit"]');

  setBusy(button, true, 'جارٍ التحقق...');
  message(status, '');

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: $('#loginEmail').value.trim(),
      password: $('#loginPassword').value
    });

    if (error) throw error;

    sessionUser = data.user;

    await authorizeAndLoad();

  } catch (error) {
    message(status, `تعذر تسجيل الدخول: ${error.message}`, 'error');
  } finally {
    setBusy(button, false);
  }
}

async function authorizeAndLoad() {
  if (!client) return;

  const { data: authData, error: authError } =
    await client.auth.getUser();

  if (authError) throw authError;

  sessionUser = authData.user;

  if (!sessionUser) {
    resetAuthorizationState();
    setLoggedIn(false);
    return;
  }

  const { data: profile, error } = await client
    .from('profiles')
    .select('id,email,full_name,role,branch_id')
    .eq('id', sessionUser.id)
    .maybeSingle();

  const trustedServerOwner = SERVER_OWNER_IDS.has(sessionUser.id);

  if (
    error ||
    !profile ||
    (
      !trustedServerOwner &&
      !['owner', 'manager'].includes(profile.role)
    )
  ) {
    await client.auth.signOut();

    resetAuthorizationState();
    setLoggedIn(false);

    message(
      $('#loginMessage'),
      'هذا الحساب غير مخوّل لإدارة اللوحة.',
      'error'
    );

    return;
  }

  currentProfile = profile;
  isServerOwner = SERVER_OWNER_IDS.has(sessionUser.id);
  isOwner = isServerOwner || profile.role === 'owner';

  ownPermissions = {};
  canDeleteStaff = false;

  setLoggedIn(true);

  await loadBranches();
  await loadUsers();

  applyDashboardPermissions();
  if (isOwner || isServerOwner) await loadCoupons();
  await loadDiscounts();
}

/* =====================================================
   الاتصال بدالة إدارة المستخدمين
===================================================== */

async function manageUsers(payload) {
  const { data, error } = await client.functions.invoke(
    'manage-users',
    { body: payload }
  );

  if (error) {
    let details = error.message || 'حدث خطأ غير معروف';

    try {
      if (error.context?.json) {
        const body = await error.context.json();
        details = body.error || body.message || details;
      }
    } catch (_) {}

    throw new Error(details);
  }

  if (data?.error) throw new Error(data.error);

  return data || {};
}

/* =====================================================
   إدارة المستخدمين
===================================================== */

function normalizePermissions(response) {
  const result = {};
  const source = response?.permissions;

  if (Array.isArray(source)) {
    source.forEach(row => {
      if (!row?.user_id) return;

      result[row.user_id] = {};

      PERMISSION_KEYS.forEach(key => {
        result[row.user_id][key] = row[key] === true;
      });
    });

  } else if (source && typeof source === 'object') {
    Object.entries(source).forEach(([userId, values]) => {
      result[userId] = {};

      PERMISSION_KEYS.forEach(key => {
        result[userId][key] = values?.[key] === true;
      });
    });
  }

  return result;
}

async function loadUsers() {
  if (!canManageUsers() && !isOwner) {
    $('#usersPanel').hidden = true;
    return;
  }

  const body = $('#usersTable');

  body.innerHTML = `
    <tr><td colspan="5" class="empty-cell">جارٍ تحميل المستخدمين...</td></tr>
  `;

  message($('#usersMessage'), '');

  try {
    const response = await manageUsers({ action: 'list' });

    users = Array.isArray(response.users) ? response.users : [];
    permissionsByUser = normalizePermissions(response);

    ownPermissions = {};

    if (response.ownPermissions) {
      PERMISSION_KEYS.forEach(key => {
        ownPermissions[key] = response.ownPermissions[key] === true;
      });
    }

    canDeleteStaff =
      response.canDeleteStaff === true ||
      ownPermissions.can_delete_staff === true;

    if (response.isOwner === true) isOwner = true;

    $('#usersCount').textContent = users.length;

    renderUsers();
    applyDashboardPermissions();

    if (response.warning) {
      message($('#usersMessage'), response.warning, 'error');
    }

  } catch (error) {
    body.innerHTML = `
      <tr><td colspan="5" class="empty-cell">تعذر تحميل المستخدمين.</td></tr>
    `;

    message(
      $('#usersMessage'),
      `تعذر تحميل المستخدمين: ${error.message}`,
      'error'
    );
  }
}

function roleLabel(role) {
  const labels = {
    server_owner: 'مالك السيرفر',
    owner: 'صاحب المطعم',
    manager: 'مدير فرع',
    staff: 'موظف',
    customer: 'زبون'
  };

  return labels[role] || role || '—';
}

function canDeleteUser(user) {
  if (!user) return false;
  if (SERVER_OWNER_IDS.has(user.id)) return false;
  if (user.id === currentProfile?.id) return false;

  if (isServerOwner) return true;

  if (isOwner) {
    return ['manager', 'staff', 'customer'].includes(user.role);
  }

  return (
    isManager() &&
    user.role === 'staff' &&
    canDeleteStaff &&
    String(user.branch_id) === String(currentProfile?.branch_id)
  );
}

function renderUsers() {
  const body = $('#usersTable');

  if (!users.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">
          لا توجد حسابات يمكن عرضها حسب صلاحياتك.
        </td>
      </tr>
    `;

    $('#usersCount').textContent = '0';
    return;
  }

  body.innerHTML = users.map(user => {
    const deleteAllowed = canDeleteUser(user);
    const protectedAccount = SERVER_OWNER_IDS.has(user.id);

    const canChangeRole =
      !protectedAccount &&
      (
        isServerOwner ||
        (
          isOwner &&
          !['owner', 'server_owner'].includes(user.role)
        )
      );

    const roleActions = canChangeRole
      ? `<button type="button" class="button button-quiet" data-change-role="${escapeHTML(user.id)}">تغيير الرتبة</button>`
      : '';

    const permissionAction =
      isOwner && user.role === 'manager'
        ? `<button type="button" class="button button-quiet" data-edit-permissions="${escapeHTML(user.id)}">الصلاحيات</button>`
        : '';

    const passwordAction = canResetUserPassword(user)
      ? `<button type="button" class="button button-quiet" data-reset-password="${escapeHTML(user.id)}">تغيير رمز السر</button>`
      : '';

    const deleteAction = deleteAllowed
      ? `<button type="button" class="button button-danger" data-delete-user="${escapeHTML(user.id)}">حذف</button>`
      : '';

    return `
      <tr>
        <td>${escapeHTML(user.full_name || 'بدون اسم')}</td>
        <td>${escapeHTML(user.email || '—')}</td>
        <td>${escapeHTML(branchName(user.branch_id))}</td>
        <td><span class="user-role">${escapeHTML(roleLabel(user.role))}</span></td>
        <td>
          <div class="user-actions">
            ${permissionAction}
            ${roleActions}
            ${passwordAction}
            ${deleteAction}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  $('#usersCount').textContent = users.length;
}

/* =====================================================
   إنشاء حساب جديد
===================================================== */

async function createUser(event) {
  event.preventDefault();

  if (!isOwner) {
    toast('إنشاء الحسابات متاح للمالك فقط.', 'error');
    return;
  }

  const button = $('#createUserButton');

  const name = $('#newUserName').value.trim();
  const email = $('#newUserEmail').value.trim();
  const password = $('#newUserPassword').value;
  const branchId = $('#newUserBranch').value;
  const role = $('#newUserRole').value;

  if (!name || !email || !password) {
    message($('#createUserMessage'), 'أكمل الاسم والبريد الإلكتروني وكلمة المرور.', 'error');
    return;
  }

  if (password.length < 8) {
    message($('#createUserMessage'), 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'error');
    return;
  }

  if (['staff', 'manager'].includes(role) && !branchId) {
    message($('#createUserMessage'), 'اختر الفرع لهذا الحساب.', 'error');
    return;
  }

  const allowedRoles = isServerOwner
    ? ['staff', 'manager', 'owner']
    : ['staff'];

  if (!allowedRoles.includes(role)) {
    message($('#createUserMessage'), 'نوع الحساب غير مسموح لك بإنشائه.', 'error');
    return;
  }

  setBusy(button, true, 'جارٍ إنشاء الحساب...');
  message($('#createUserMessage'), '');

  try {
    await manageUsers({
      action: 'create',
      name,
      email,
      password,
      branchId: branchId || null,
      role
    });

    $('#createUserForm').reset();
    configureCreateRoleOptions();

    message($('#createUserMessage'), 'تم إنشاء الحساب بنجاح.', 'success');
    toast('تم إنشاء الحساب بنجاح.');

    await loadUsers();

  } catch (error) {
    message($('#createUserMessage'), `تعذر إنشاء الحساب: ${error.message}`, 'error');
  } finally {
    setBusy(button, false);
  }
}

/* =====================================================
   تغيير رتبة المستخدم
===================================================== */

async function changeUserRole(userId) {
  if (!isOwner) {
    toast('تغيير الرتب متاح للمالك فقط.', 'error');
    return;
  }

  const user = users.find(item => String(item.id) === String(userId));
  if (!user) return;

  if (SERVER_OWNER_IDS.has(user.id)) {
    toast('لا يمكن تغيير رتبة مالكي السيرفر الثابتين.', 'error');
    return;
  }

  if (!isServerOwner && ['owner', 'server_owner'].includes(user.role)) {
    toast('ليس لديك صلاحية تغيير رتبة هذا الحساب.', 'error');
    return;
  }

  const allowedRoles = isServerOwner
    ? ['owner', 'manager', 'staff', 'customer']
    : ['staff', 'customer'];

  const answer = prompt(
    `تغيير رتبة ${user.full_name || user.email}\n\nالرتب المتاحة:\n${allowedRoles.join(' / ')}`,
    user.role
  );

  if (answer === null) return;

  const role = answer.trim().toLowerCase();

  if (!allowedRoles.includes(role)) {
    toast('الرتبة المختارة غير مسموحة.', 'error');
    return;
  }

  if (role === user.role) return;

  try {
    await manageUsers({ action: 'set_role', userId, role });

    toast('تم تغيير رتبة المستخدم.');
    await loadUsers();

  } catch (error) {
    toast(`تعذر تغيير الرتبة: ${error.message}`, 'error');
  }
}

/* =====================================================
   إدارة صلاحيات المديرين
===================================================== */

function openPermissionsEditor(userId) {
  if (!isOwner) {
    toast('إدارة الصلاحيات متاحة للمالك فقط.', 'error');
    return;
  }

  const user = users.find(item => String(item.id) === String(userId));

  if (!user || user.role !== 'manager') return;

  const permissions = permissionsByUser[userId] || {};

  $('#permissionsUserId').value = userId;

  $('#permissionsUserName').textContent =
    `${user.full_name || 'مدير الفرع'} — ${user.email || ''}`;

  document.querySelectorAll('[data-permission]').forEach(input => {
    input.checked = permissions[input.dataset.permission] === true;
  });

  message($('#permissionsMessage'), '');

  $('#permissionsEditor').hidden = false;

  $('#permissionsEditor').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

async function saveUserPermissions() {
  if (!isOwner) {
    toast('تعديل الصلاحيات متاح للمالك فقط.', 'error');
    return;
  }

  const userId = $('#permissionsUserId').value;
  if (!userId) return;

  const user = users.find(item => String(item.id) === String(userId));

  if (!user || user.role !== 'manager') {
    toast('يمكن تعديل صلاحيات المديرين فقط.', 'error');
    return;
  }

  const permissions = {};

  document.querySelectorAll('[data-permission]').forEach(input => {
    permissions[input.dataset.permission] = input.checked;
  });

  const button = $('#savePermissionsButton');

  setBusy(button, true, 'جارٍ حفظ الصلاحيات...');
  message($('#permissionsMessage'), '');

  try {
    await manageUsers({
      action: 'save_permissions',
      userId,
      permissions
    });

    permissionsByUser[userId] = permissions;

    message($('#permissionsMessage'), 'تم حفظ الصلاحيات بنجاح.', 'success');
    toast('تم تحديث صلاحيات المدير.');

    await loadUsers();

  } catch (error) {
    message($('#permissionsMessage'), `تعذر حفظ الصلاحيات: ${error.message}`, 'error');
  } finally {
    setBusy(button, false);
  }
}

/* =====================================================
   حذف المستخدم
===================================================== */

async function deleteUser(userId) {
  const user = users.find(item => String(item.id) === String(userId));

  if (!user || !canDeleteUser(user)) {
    toast('ليس لديك صلاحية حذف هذا المستخدم.', 'error');
    return;
  }

  if (!confirm(`هل أنت متأكد من حذف حساب ${user.full_name || user.email}؟`)) {
    return;
  }

  try {
    await manageUsers({ action: 'delete', userId });

    toast('تم حذف الحساب بنجاح.');

    $('#permissionsEditor').hidden = true;

    await loadUsers();

  } catch (error) {
    toast(`تعذر حذف الحساب: ${error.message}`, 'error');
  }
}

/* =====================================================
   الفروع
===================================================== */

async function loadBranches() {
  const { data, error } = await client
    .from('branches')
    .select('*')
    .order('sort_order');

  if (error) {
    toast(`تعذر تحميل الفروع: ${error.message}`, 'error');
    return;
  }

  branches = data || [];

  const availableBranches = isManager() && currentProfile?.branch_id
    ? branches.filter(branch =>
        String(branch.id) === String(currentProfile.branch_id)
      )
    : branches;

  if (isManager() && currentProfile?.branch_id) {
    activeBranch = String(currentProfile.branch_id);
  } else if (!branches.some(branch =>
    String(branch.id) === String(activeBranch)
  )) {
    activeBranch = branches[0]?.id || '';
  }

  const branchOptions = availableBranches.map(branch => `
    <option value="${escapeHTML(branch.id)}">
      ${escapeHTML(branch.name)}
    </option>
  `).join('');

  $('#branchSelect').innerHTML = branchOptions;
  $('#productBranch').innerHTML = branchOptions;

  $('#offerBranch').innerHTML =
    `<option value="">كل الفروع</option>${branchOptions}`;

  $('#branchSelect').value = activeBranch;
  $('#productBranch').value = activeBranch;

  if (isManager()) {
    $('#offerBranch').value = activeBranch;
  }

  await loadCategories();
  await loadProducts();
  await loadOffers();
  await loadDiscounts();

  if (isOwner) {
    $('#newUserBranch').innerHTML =
      `<option value="">اختر الفرع</option>` +
      branches.map(branch => `
        <option value="${escapeHTML(branch.id)}">
          ${escapeHTML(branch.name)}
        </option>
      `).join('');
  }
}

/* =====================================================
   التصنيفات — عربي وإنجليزي
===================================================== */

function getNextCategoryOrder() {
  return categories.reduce(
    (max, item) => Math.max(max, Number(item.sort_order) || 0),
    0
  ) + 1;
}

async function loadCategories() {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('branch_id', activeBranch)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    toast(`تعذر تحميل التصنيفات: ${error.message}`, 'error');
    return;
  }

  categories = data || [];

  const orderInput = $('#newCategoryOrder');

  if (orderInput) {
    orderInput.value = String(getNextCategoryOrder());
  }

  renderCategorySelect();
  renderCategoriesList();
}

function renderCategorySelect(selectedId = '') {
  const select = $('#productCategory');
  if (!select) return;

  select.innerHTML = categories.map(category => `
    <option value="${escapeHTML(category.id)}">
      ${escapeHTML(category.name)}
      ${category.name_en ? ` — ${escapeHTML(category.name_en)}` : ''}
    </option>
  `).join('');

  if (selectedId && categories.some(category =>
    String(category.id) === String(selectedId)
  )) {
    select.value = selectedId;
  }
}

function ensureCategoryScheduleStyles() {
  if ($('#categoryScheduleStyles')) return;

  const style = document.createElement('style');
  style.id = 'categoryScheduleStyles';
  style.textContent = `
    .category-schedule {
      flex-basis: 100%; width: 100%; margin-top: 12px; padding: 12px;
      border: 1px solid #e5d9cf; border-radius: 10px; background: #fffaf6;
    }
    .category-schedule summary { cursor: pointer; font-weight: 700; padding: 5px; }
    .category-schedule-content { display: grid; gap: 14px; padding-top: 15px; }
    .category-schedule-content label { display: flex; align-items: center; gap: 8px; }
    .category-schedule-content input[type="time"] { width: 100%; min-height: 42px; padding: 8px; }
    .category-schedule-days { display: grid; grid-template-columns: repeat(auto-fit,minmax(90px,1fr)); gap: 10px; }
    .category-schedule-days label { padding: 8px; background: #fff; border: 1px solid #e5d9cf; border-radius: 8px; }
    .category-schedule-save { justify-self: start; }
    .category-schedule-hint { color: #76665c; font-size: .88em; }
  `;
  document.head.appendChild(style);
}

function renderCategoriesList() {
  const list = $('#categoriesList');
  if (!list) return;

  ensureCategoryScheduleStyles();

  list.innerHTML = categories.length
    ? categories.map(category => {
        const selectedDays = Array.isArray(category.visible_days) && category.visible_days.length
          ? category.visible_days.map(Number)
          : [1, 2, 3, 4, 5, 6, 7];

        return `
          <div class="category-chip" data-category-id="${escapeHTML(category.id)}">
            <span>
              <strong>${escapeHTML(category.name)}</strong>
              <small dir="ltr">${escapeHTML(category.name_en || 'No English name')}</small>
              <small>ترتيب العرض: ${Number(category.sort_order) || 0}</small>
            </span>

            <button type="button" data-order-category="${escapeHTML(category.id)}">ترتيب العرض</button>
            <button type="button" data-rename-category="${escapeHTML(category.id)}">تعديل الاسمين</button>
            <button type="button" data-delete-category="${escapeHTML(category.id)}">حذف</button>

            <details class="category-schedule">
              <summary>⏰ جدولة ظهور القسم</summary>
              <div class="category-schedule-content">
                <label>
                  <input type="checkbox" data-schedule-enabled ${category.schedule_enabled ? 'checked' : ''}>
                  تفعيل الجدولة لهذا القسم
                </label>
                <p class="category-schedule-hint">عند التفعيل، يظهر القسم ومنتجاته فقط في الأيام والأوقات المحددة حسب توقيت بغداد.</p>
                <div class="user-form-grid">
                  <label>
                    وقت بداية الظهور
                    <input type="time" data-visible-from value="${escapeHTML(category.visible_from || '')}">
                  </label>
                  <label>
                    وقت نهاية الظهور
                    <input type="time" data-visible-until value="${escapeHTML(category.visible_until || '')}">
                  </label>
                </div>
                <div>
                  <strong>أيام ظهور القسم</strong>
                  <div class="category-schedule-days">
                    ${CATEGORY_SCHEDULE_DAYS.map(day => `
                      <label>
                        <input type="checkbox" data-visible-day="${day.value}" ${selectedDays.includes(day.value) ? 'checked' : ''}>
                        ${day.label}
                      </label>
                    `).join('')}
                  </div>
                </div>
                <button type="button" class="button button-primary category-schedule-save" data-save-category-schedule="${escapeHTML(category.id)}">
                  💾 حفظ الجدولة
                </button>
              </div>
            </details>
          </div>
        `;
      }).join('')
    : '<p class="muted">ماكو تصنيفات بهذا الفرع.</p>';

  $('#statCategories').textContent = categories.length;
}

async function saveCategorySchedule(id, button) {
  if (!canManageCategories()) {
    toast('ليس لديك صلاحية تعديل جدولة التصنيفات.', 'error');
    return;
  }

  const category = categories.find(item => String(item.id) === String(id));
  const card = button?.closest('[data-category-id]');
  if (!category || !card) return;

  const enabled = Boolean(card.querySelector('[data-schedule-enabled]')?.checked);
  const visibleFrom = card.querySelector('[data-visible-from]')?.value || '';
  const visibleUntil = card.querySelector('[data-visible-until]')?.value || '';
  const visibleDays = [...card.querySelectorAll('[data-visible-day]:checked')]
    .map(input => Number(input.dataset.visibleDay))
    .filter(day => day >= 1 && day <= 7)
    .sort((a, b) => a - b);

  if (enabled) {
    if (!visibleFrom || !visibleUntil) {
      toast('حدد وقت بداية ونهاية ظهور القسم.', 'error');
      return;
    }

    if (!visibleDays.length) {
      toast('حدد يوماً واحداً على الأقل لظهور القسم.', 'error');
      return;
    }
  }

  setBusy(button, true, 'جارٍ حفظ الجدولة...');

  try {
    const { data, error } = await client
      .from('categories')
      .update({
        schedule_enabled: enabled,
        visible_from: visibleFrom || null,
        visible_until: visibleUntil || null,
        visible_days: visibleDays.length ? visibleDays : [1, 2, 3, 4, 5, 6, 7]
      })
      .eq('id', id)
      .eq('branch_id', activeBranch)
      .select('id')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error('لم يتم تحديث أي صف. تحقق من صلاحيات RLS لهذا الحساب.');
    }

    await loadCategories();
    toast(enabled ? 'تم حفظ جدولة القسم بنجاح.' : 'تم إيقاف الجدولة، والقسم سيظهر دائماً.');
  } catch (error) {
    toast(`تعذر حفظ الجدولة: ${error.message}`, 'error');
  } finally {
    setBusy(button, false);
  }
}

async function addCategory(event) {
  event.preventDefault();

  if (!canManageCategories()) {
    toast('ليس لديك صلاحية إدارة التصنيفات.', 'error');
    return;
  }

  const name = $('#newCategoryName').value.trim();
  const nameEn = $('#newCategoryNameEn').value.trim();

  if (!name) {
    toast('اكتب اسم القسم بالعربية.', 'error');
    return;
  }

  const requestedOrder = Number.parseInt(
    $('#newCategoryOrder').value || '0',
    10
  );

  const sortOrder = Number.isInteger(requestedOrder) && requestedOrder > 0
    ? requestedOrder
    : getNextCategoryOrder();

  const { error } = await client
    .from('categories')
    .insert({
      branch_id: activeBranch,
      name,
      name_en: nameEn || null,
      slug: slugify(name),
      sort_order: sortOrder
    });

  if (error) {
    message($('#categoryMessage'), `تعذرت الإضافة: ${error.message}`, 'error');
    return;
  }

  $('#categoryForm').reset();

  await loadCategories();

  toast('تمت إضافة التصنيف باللغتين.');
}

async function changeCategoryOrder(id) {
  if (!canManageCategories()) {
    toast('ليس لديك صلاحية تعديل ترتيب التصنيفات.', 'error');
    return;
  }

  const category = categories.find(item => String(item.id) === String(id));
  if (!category) return;

  const sortedCategories = [...categories].sort((a, b) => {
    const orderA = Number(a.sort_order) || 0;
    const orderB = Number(b.sort_order) || 0;

    return orderA - orderB ||
      String(a.name).localeCompare(String(b.name));
  });

  const currentIndex = sortedCategories.findIndex(item =>
    String(item.id) === String(id)
  );

  const answer = prompt(
    `تغيير ترتيب عرض القسم: ${category.name}\n\nالترتيب الحالي: ${currentIndex + 1}\n\nأدخل الترتيب الجديد من 1 إلى ${sortedCategories.length}:`,
    String(currentIndex + 1)
  );

  if (answer === null) return;

  const cleanValue = answer.trim();
  const newOrder = Number(cleanValue);

  if (
    cleanValue === '' ||
    !Number.isInteger(newOrder) ||
    newOrder < 1 ||
    newOrder > sortedCategories.length
  ) {
    toast(`أدخل رقماً من 1 إلى ${sortedCategories.length}.`, 'error');
    return;
  }

  if (newOrder === currentIndex + 1) return;

  const [movedCategory] = sortedCategories.splice(currentIndex, 1);
  sortedCategories.splice(newOrder - 1, 0, movedCategory);

  const buttons = document.querySelectorAll(
    '[data-order-category], [data-rename-category], [data-delete-category]'
  );

  buttons.forEach(button => button.disabled = true);

  try {
    const { error } = await client.rpc('reorder_categories', {
      p_branch_id: activeBranch,
      p_category_ids: sortedCategories.map(item => item.id)
    });

    if (error) throw error;

    await loadCategories();

    toast('تم تغيير ترتيب القسم وتحديث بقية الأقسام.');

  } catch (error) {
    console.error('Category reorder error:', error);

    await loadCategories();

    toast(`تعذر تحديث ترتيب الأقسام: ${error.message}`, 'error');

  } finally {
    buttons.forEach(button => button.disabled = false);
  }
}

async function renameCategory(id) {
  if (!canManageCategories()) {
    toast('ليس لديك صلاحية تعديل التصنيفات.', 'error');
    return;
  }

  const category = categories.find(item => String(item.id) === String(id));
  if (!category) return;

  const name = prompt('الاسم العربي الجديد:', category.name);
  if (name === null) return;

  const cleanName = name.trim();

  if (!cleanName) {
    toast('اسم التصنيف العربي لا يمكن أن يكون فارغاً.', 'error');
    return;
  }

  const nameEn = prompt(
    'الاسم الإنجليزي الجديد (يمكن تركه فارغاً):',
    category.name_en || ''
  );

  if (nameEn === null) return;

  const { error } = await client
    .from('categories')
    .update({
      name: cleanName,
      name_en: nameEn.trim() || null,
      slug: slugify(cleanName)
    })
    .eq('id', id)
    .eq('branch_id', activeBranch);

  if (error) {
    toast(`تعذر تعديل التصنيف: ${error.message}`, 'error');
    return;
  }

  await loadCategories();
  await loadProducts();

  toast('تم تعديل اسمي التصنيف.');
}

async function deleteCategory(id) {
  if (!canManageCategories()) {
    toast('ليس لديك صلاحية حذف التصنيفات.', 'error');
    return;
  }

  const category = categories.find(item => String(item.id) === String(id));

  if (
    !category ||
    !confirm(`حذف تصنيف «${category.name}»؟ لا يمكن حذفه إذا كان يحتوي منتجات.`)
  ) {
    return;
  }

  const { error } = await client
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('branch_id', activeBranch);

  if (error) {
    toast(`تعذر حذف التصنيف. تأكد أنه فارغ. ${error.message}`, 'error');
    return;
  }

  await loadCategories();

  toast('تم حذف التصنيف.');
}

/* =====================================================
   المنتجات
===================================================== */

async function loadProducts() {
  $('#productsTable').innerHTML = `
    <tr><td colspan="6" class="empty-cell">جارٍ تحميل المنتجات...</td></tr>
  `;

  const { data, error } = await client
    .from('products')
    .select('*, categories(name,name_en), branches(name)')
    .eq('branch_id', activeBranch)
    .order('sort_order')
    .order('name');

  if (error) {
    $('#productsTable').innerHTML = `
      <tr><td colspan="6" class="empty-cell">تعذر تحميل المنتجات.</td></tr>
    `;

    toast(`تعذر تحميل المنتجات: ${error.message}`, 'error');
    return;
  }

  products = data || [];

  renderProducts();

  const { count: allCount } = await client
    .from('products')
    .select('id', { count: 'exact', head: true });

  const { count: availableCount } = await client
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_available', true);

  $('#statProducts').textContent = allCount ?? products.length;

  $('#statAvailable').textContent =
    availableCount ?? products.filter(product => product.is_available).length;
}

function renderProducts() {
  const query = $('#productSearch').value.trim().toLocaleLowerCase();

  const shown = products.filter(product => {
    const searchable = [
      product.name,
      product.name_en,
      product.description,
      product.description_en,
      product.categories?.name,
      product.categories?.name_en
    ].join(' ').toLocaleLowerCase();

    return searchable.includes(query);
  });

  $('#productCount').textContent = shown.length;

  $('#productsTable').innerHTML = shown.length
    ? shown.map(product => {
        const editButton = canEditAnyProduct()
          ? `<button type="button" class="button button-quiet" data-edit-product="${escapeHTML(product.id)}">تعديل</button>`
          : '';

        const deleteButton = canManageProducts()
          ? `<button type="button" class="button button-danger" data-delete-product="${escapeHTML(product.id)}">حذف</button>`
          : '';

        const availabilityButton = canManageProducts()
          ? `
            <button
              type="button"
              class="availability ${product.is_available ? 'yes' : 'no'}"
              data-toggle-product="${escapeHTML(product.id)}">
              ${product.is_available ? 'متاح' : 'مخفي'}
            </button>
          `
          : `
            <span class="availability ${product.is_available ? 'yes' : 'no'}">
              ${product.is_available ? 'متاح' : 'مخفي'}
            </span>
          `;

        const sizes = normalizeSizeOptions(product.extra);

        return `
          <tr>
            <td>
              ${
                product.image_url
                  ? `<img class="product-thumb" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy">`
                  : '<div class="product-thumb" aria-label="بدون صورة"></div>'
              }
            </td>

            <td class="product-cell">
              <strong>${escapeHTML(product.name)}</strong>
              ${product.name_en ? `<small dir="ltr">${escapeHTML(product.name_en)}</small>` : ''}
              ${product.description ? `<small>${escapeHTML(product.description)}</small>` : ''}
              ${sizes.length ? `<small>عدد الأحجام: ${sizes.length}</small>` : ''}
            </td>

            <td>
              ${escapeHTML(product.categories?.name || '—')}
              ${product.categories?.name_en ? `<small dir="ltr">${escapeHTML(product.categories.name_en)}</small>` : ''}
            </td>

            <td class="price-cell">${money(product.price)}</td>

            <td>${availabilityButton}</td>

            <td>
              <div class="table-actions">
                ${editButton}
                ${deleteButton}
              </div>
            </td>
          </tr>
        `;
      }).join('')
    : `
      <tr><td colspan="6" class="empty-cell">لا توجد منتجات مطابقة.</td></tr>
    `;
}

function resetProductForm() {
  $('#productForm').reset();

  $('#productId').value = '';
  $('#productBranch').value = activeBranch;

  currentImageUrl = '';
  currentImagePath = '';

  $('#productAvailable').checked = true;
  $('#productOrder').value = '0';
  $('#productPrice').value = '0';

  $('#productNameEn').value = '';
  $('#productDescriptionEn').value = '';

  $('#editorTitle').textContent = 'إضافة منتج';
  $('#saveProductButton').textContent = 'حفظ المنتج';

  $('#productImage').value = '';

  $('#imagePreviewWrap').hidden = true;
  $('#imagePreview').removeAttribute('src');
  $('#imageFileLabel').textContent = '';

  renderProductSizes([]);

  message($('#editorMessage'), '');

  renderCategorySelect(categories[0]?.id || '');

  setProductFormPermissions();
}

function fillProductForm(product) {
  if (!canEditAnyProduct()) {
    toast('ليس لديك صلاحية تعديل المنتجات أو الأسعار.', 'error');
    return;
  }

  $('#productId').value = product.id;
  $('#productBranch').value = product.branch_id;

  renderCategorySelect(product.category_id);

  $('#productCategory').value = product.category_id || '';

  $('#productName').value = product.name || '';
  $('#productNameEn').value = product.name_en || '';

  $('#productDescription').value = product.description || '';
  $('#productDescriptionEn').value = product.description_en || '';

  $('#productPrice').value = product.price ?? 0;
  $('#productOrder').value = product.sort_order || 0;
  $('#productAvailable').checked = product.is_available !== false;

  currentImageUrl = product.image_url || '';
  currentImagePath = product.image_path || '';

  $('#productImage').value = '';

  $('#editorTitle').textContent = 'تعديل المنتج';

  renderProductSizes(normalizeSizeOptions(product.extra));

  if (currentImageUrl) {
    $('#imagePreview').src = currentImageUrl;
    $('#imageFileLabel').textContent = 'الصورة الحالية (يمكن اختيار صورة جديدة)';
    $('#imagePreviewWrap').hidden = false;
  } else {
    $('#imagePreviewWrap').hidden = true;
  }

  message($('#editorMessage'), '');

  setProductFormPermissions();

  $('#productEditorPanel').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}


/* =========================================================
   ضغط الصور قبل رفعها إلى Supabase
   يحافظ على الأبعاد والنسبة والشفافية، ويحوّل إلى WebP
========================================================= */
async function prepareImageForUpload(file, {
  maxWidth = 1400,
  maxHeight = 1400,
  quality = 0.84
} = {}) {
  if (!file || !file.type.startsWith('image/')) {
    return file;
  }

  if (typeof createImageBitmap !== 'function') {
    return file;
  }

  let bitmap;

  try {
    bitmap = await createImageBitmap(file);

    const scale = Math.min(
      1,
      maxWidth / bitmap.width,
      maxHeight / bitmap.height
    );

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);

    const webpBlob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/webp', quality);
    });

    if (!webpBlob || webpBlob.type !== 'image/webp') {
      return file;
    }

    // لا نستبدل الملف إذا كانت نسخة WebP أكبر من الأصل.
    if (webpBlob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';

    return new File(
      [webpBlob],
      `${baseName}.webp`,
      {
        type: 'image/webp',
        lastModified: Date.now()
      }
    );
  } catch (error) {
    console.warn('تعذّر ضغط الصورة؛ سيتم رفع الأصل:', error);
    return file;
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
}

async function getR2WorkerToken() {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجدداً.');
  return token;
}

async function uploadImageToR2(file, folder) {
  if (!R2_IMAGE_WORKER_URL || R2_IMAGE_WORKER_URL.includes('YOUR-WORKER-NAME')) {
    throw new Error('يجب إعداد رابط Cloudflare Worker أولاً.');
  }

  const token = await getR2WorkerToken();
  const form = new FormData();
  form.append('file', file, file.name || 'image');
  form.append('branch', folder);

  const response = await fetch(`${R2_IMAGE_WORKER_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'فشل رفع الصورة إلى Cloudflare R2.');
  if (!result.image_url || !result.image_path) throw new Error('استجابة رفع الصورة غير مكتملة.');
  return result;
}

async function deleteR2Image(key) {
  if (!key || /^https?:\/\//i.test(key)) return;
  if (!R2_IMAGE_WORKER_URL || R2_IMAGE_WORKER_URL.includes('YOUR-WORKER-NAME')) return;

  const token = await getR2WorkerToken();
  const response = await fetch(`${R2_IMAGE_WORKER_URL}/delete`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ key })
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'تعذر حذف الصورة من Cloudflare R2.');
  }
}

async function uploadProductImage(file, branchId) {
  if (!file) {
    return {
      image_url: currentImageUrl,
      image_path: currentImagePath
    };
  }

  const allowed = ['image/png', 'image/jpeg', 'image/webp'];

  if (!allowed.includes(file.type)) {
    throw new Error('اختر PNG أو JPG أو WebP.');
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error('حجم الصورة الأصلية يجب أن يكون أقل من 8 ميغابايت.');
  }

  const optimizedFile = await prepareImageForUpload(file, {
    maxWidth: 1400,
    maxHeight: 1400,
    quality: 0.84
  });

  const extension = optimizedFile.type === 'image/webp'
    ? 'webp'
    : (optimizedFile.name.split('.').pop().toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'png');

  const path = `${branchId}/${crypto.randomUUID()}.${extension}`;

  const uploaded = await uploadImageToR2(optimizedFile, branchId);
  return uploaded;
}

async function saveProduct(event) {
  event.preventDefault();

  const id = $('#productId').value.trim();
  const fullAccess = canManageProducts();
  const priceAccess = canManagePrices();

  if (!fullAccess && !(id && priceAccess)) {
    message($('#editorMessage'), 'ليس لديك صلاحية تعديل المنتج أو سعره.', 'error');
    return;
  }

  const existingProduct = id
    ? products.find(item => String(item.id) === String(id))
    : null;

  if (id && !existingProduct) {
    message(
      $('#editorMessage'),
      'لم يتم العثور على المنتج في القائمة. حدّث القائمة وحاول مجدداً.',
      'error'
    );
    return;
  }

  if (fullAccess && !categories.length) {
    message($('#editorMessage'), 'أضف تصنيفاً لهذا الفرع أولاً.', 'error');
    return;
  }

  const button = $('#saveProductButton');

  setBusy(button, true);
  message($('#editorMessage'), '');

  try {
    const price = Number($('#productPrice').value);

    if (!Number.isFinite(price) || price < 0) {
      throw new Error('تحقق من السعر المدخل.');
    }

    /*
      ننسخ extra القديم كاملاً حتى لا نفقد أي بيانات
      أخرى مثل options أو mealUpgrade أو source_price.
    */
    const extra = {
      ...(existingProduct?.extra &&
      typeof existingProduct.extra === 'object'
        ? existingProduct.extra
        : {})
    };

    if (fullAccess) {
      extra.requires_price_confirmation = price <= 0;

      if (Object.prototype.hasOwnProperty.call(extra, 'source_price')) {
        extra.source_price = price > 0 ? price : null;
      }
    }

    let payload;

    /*
      مدير الأسعار فقط:
      يحدّث السعر الأساسي فقط.
      لا يرسل extra ولا الأسماء ولا الأحجام.
    */
    if (!fullAccess && id && priceAccess) {
      payload = { price };

    } else {
      const branchId = $('#productBranch').value;
      const categoryId = $('#productCategory').value;

      const name = $('#productName').value.trim();
      const nameEn = $('#productNameEn').value.trim();

      const description = $('#productDescription').value.trim();
      const descriptionEn = $('#productDescriptionEn').value.trim();

      if (!branchId) throw new Error('اختر الفرع.');
      if (!categoryId) throw new Error('اختر التصنيف.');
      if (!name) throw new Error('اكتب اسم المنتج بالعربية.');

      // حفظ أحجام المنتج للمشاوي والوجبات السريعة مع الحفاظ على بقية extra.
      if (canUseProductSizes(branchId)) {
        extra.size_options = collectProductSizes();
      }

      const image = await uploadProductImage(
        $('#productImage').files[0],
        branchId
      );

      payload = {
        branch_id: branchId,
        category_id: categoryId,

        name,
        name_en: nameEn || null,

        description,
        description_en: descriptionEn || null,

        price,
        extra,

        sort_order:
          Number.parseInt($('#productOrder').value || '0', 10) || 0,

        is_available: $('#productAvailable').checked,

        image_url: image.image_url,
        image_path: image.image_path
      };
    }

    let result;

    if (id) {
      let query = client
        .from('products')
        .update(payload)
        .eq('id', id);

      const branchId = fullAccess
        ? $('#productBranch').value
        : existingProduct.branch_id;

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      result = await query.select('id').maybeSingle();

    } else {
      result = await client
        .from('products')
        .insert(payload)
        .select('id')
        .single();
    }

    if (result.error) throw result.error;

    if (!result.data?.id) {
      throw new Error(
        'لم يتم تحديث أي منتج. تحقق من صلاحيات UPDATE وسياسات RLS في جدول products.'
      );
    }

    resetProductForm();

    await loadCategories();
    await loadProducts();

    toast(
      id
        ? 'تم تحديث المنتج بنجاح.'
        : 'تمت إضافة المنتج بنجاح.'
    );

  } catch (error) {
    console.error('Save product error:', error);

    message(
      $('#editorMessage'),
      `تعذر حفظ المنتج: ${error.message}`,
      'error'
    );

  } finally {
    setBusy(button, false);
    setProductFormPermissions();
  }
}

async function toggleAvailability(id) {
  if (!canManageProducts()) {
    toast('ليس لديك صلاحية تغيير توفر المنتجات.', 'error');
    return;
  }

  const product = products.find(item => String(item.id) === String(id));
  if (!product) return;

  const { error } = await client
    .from('products')
    .update({ is_available: !product.is_available })
    .eq('id', id)
    .eq('branch_id', activeBranch);

  if (error) {
    toast(`تعذر تحديث الحالة: ${error.message}`, 'error');
    return;
  }

  await loadProducts();

  toast(
    product.is_available
      ? 'تم إخفاء المنتج من المنيو.'
      : 'أصبح المنتج متاحاً للطلب.'
  );
}

async function deleteProduct(id) {
  if (!canManageProducts()) {
    toast('ليس لديك صلاحية حذف المنتجات.', 'error');
    return;
  }

  const product = products.find(item => String(item.id) === String(id));

  if (!product || !confirm(`متأكد تريد حذف «${product.name}» نهائياً؟`)) {
    return;
  }

  const { error } = await client
    .from('products')
    .delete()
    .eq('id', id)
    .eq('branch_id', activeBranch);

  if (error) {
    toast(`تعذر حذف المنتج: ${error.message}`, 'error');
    return;
  }

  if (product.image_path) {
    if (String(product.image_url || '').includes('.r2.dev/')) {
      await deleteR2Image(product.image_path).catch(error => console.warn('R2 delete failed:', error));
    } else {
      await client.storage.from(IMAGE_BUCKET).remove([product.image_path]).catch(() => {});
    }
  }

  await loadProducts();

  toast('تم حذف المنتج.');
}

/* =====================================================
   العروض
===================================================== */

function localDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function dateTimeInputValue(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
}

function offerStatus(offer) {
  const now = Date.now();

  if (!offer.is_active) {
    return { label: 'متوقف', className: 'no' };
  }

  if (offer.starts_at && new Date(offer.starts_at).getTime() > now) {
    return { label: 'مجدول', className: 'scheduled' };
  }

  if (offer.ends_at && new Date(offer.ends_at).getTime() < now) {
    return { label: 'منتهي', className: 'no' };
  }

  return { label: 'فعّال', className: 'yes' };
}

async function loadOffers() {
  $('#offersTable').innerHTML = `
    <tr><td colspan="8" class="empty-cell">جارٍ تحميل العروض...</td></tr>
  `;

  const { data, error } = await client
    .from('offers')
    .select('*, branches(name)')
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (error) {
    $('#offersTable').innerHTML = `
      <tr><td colspan="8" class="empty-cell">تعذر تحميل العروض.</td></tr>
    `;

    toast(`تعذر تحميل العروض: ${error.message}`, 'error');
    return;
  }

  offers = data || [];

  if (isManager() && currentProfile?.branch_id) {
    offers = offers.filter(offer =>
      !offer.branch_id ||
      String(offer.branch_id) === String(currentProfile.branch_id)
    );
  }

  $('#statOffers').textContent = offers.length;

  renderOffers();
}

function renderOffers() {
  const body = $('#offersTable');

  body.innerHTML = offers.length
    ? offers.map(offer => {
        const status = offerStatus(offer);

        return `
          <tr>
            <td>
              ${
                offer.image_url
                  ? `<img class="product-thumb" src="${escapeHTML(offer.image_url)}" alt="${escapeHTML(offer.name)}" loading="lazy">`
                  : '<div class="product-thumb" aria-label="بدون صورة"></div>'
              }
            </td>

            <td class="product-cell">
              ${escapeHTML(offer.name)}
              <small>${escapeHTML(offer.description || '')}</small>
            </td>

            <td>${escapeHTML(offer.branches?.name || 'كل الفروع')}</td>

            <td class="price-cell original-price">${money(offer.original_price)}</td>
            <td class="price-cell">${money(offer.offer_price)}</td>

            <td class="offer-dates">
              من: ${escapeHTML(localDateTime(offer.starts_at))}
              <br>
              إلى: ${escapeHTML(localDateTime(offer.ends_at))}
            </td>

            <td>
              <button
                type="button"
                class="availability ${status.className}"
                data-toggle-offer="${escapeHTML(offer.id)}">
                ${status.label}
              </button>
            </td>

            <td>
              <div class="table-actions">
                <button type="button" class="button button-quiet" data-edit-offer="${escapeHTML(offer.id)}">تعديل</button>
                <button type="button" class="button button-danger" data-delete-offer="${escapeHTML(offer.id)}">حذف</button>
              </div>
            </td>
          </tr>
        `;
      }).join('')
    : `
      <tr><td colspan="8" class="empty-cell">لا توجد عروض بعد.</td></tr>
    `;
}

function resetOfferForm() {
  $('#offerForm').reset();

  $('#offerId').value = '';
  $('#offerBranch').value = isManager() ? activeBranch : '';
  $('#offerOrder').value = '0';
  $('#offerActive').checked = true;

  currentOfferImageUrl = '';
  currentOfferImagePath = '';

  $('#offerEditorTitle').textContent = 'إضافة عرض جديد';
  $('#saveOfferButton').textContent = 'حفظ العرض';

  $('#offerImage').value = '';
  $('#offerImagePreviewWrap').hidden = true;
  $('#offerImagePreview').removeAttribute('src');
  $('#offerImageFileLabel').textContent = '';

  message($('#offerEditorMessage'), '');
}

function fillOfferForm(offer) {
  if (!canManageOffers()) {
    toast('ليس لديك صلاحية إدارة العروض.', 'error');
    return;
  }

  $('#offerId').value = offer.id;
  $('#offerName').value = offer.name || '';
  $('#offerBranch').value = offer.branch_id || '';
  $('#offerOriginalPrice').value = offer.original_price;
  $('#offerPrice').value = offer.offer_price;
  $('#offerStartsAt').value = dateTimeInputValue(offer.starts_at);
  $('#offerEndsAt').value = dateTimeInputValue(offer.ends_at);
  $('#offerDescription').value = offer.description || '';
  $('#offerOrder').value = offer.sort_order || 0;
  $('#offerActive').checked = Boolean(offer.is_active);

  currentOfferImageUrl = offer.image_url || '';
  currentOfferImagePath = offer.image_path || '';

  $('#offerEditorTitle').textContent = 'تعديل العرض';
  $('#saveOfferButton').textContent = 'حفظ التعديلات';

  $('#offerImage').value = '';

  if (currentOfferImageUrl) {
    $('#offerImagePreview').src = currentOfferImageUrl;
    $('#offerImageFileLabel').textContent = 'الصورة الحالية (يمكن اختيار صورة جديدة)';
    $('#offerImagePreviewWrap').hidden = false;
  } else {
    $('#offerImagePreviewWrap').hidden = true;
  }

  message($('#offerEditorMessage'), '');

  $('#offerEditorPanel').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

async function uploadOfferImage(file) {
  if (!file) {
    return {
      image_url: currentOfferImageUrl,
      image_path: currentOfferImagePath
    };
  }

  const allowed = ['image/png', 'image/jpeg', 'image/webp'];

  if (!allowed.includes(file.type)) {
    throw new Error('اختر PNG أو JPG أو WebP.');
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error('حجم الصورة الأصلية يجب أن يكون أقل من 8 ميغابايت.');
  }

  const optimizedFile = await prepareImageForUpload(file, {
    maxWidth: 1800,
    maxHeight: 1400,
    quality: 0.84
  });

  const extension = optimizedFile.type === 'image/webp'
    ? 'webp'
    : (optimizedFile.name.split('.').pop().toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'png');

  const path = `offers/${crypto.randomUUID()}.${extension}`;

  const uploaded = await uploadImageToR2(optimizedFile, 'offers');
  return uploaded;
}

async function saveOffer(event) {
  event.preventDefault();

  if (!canManageOffers()) {
    toast('ليس لديك صلاحية حفظ العروض.', 'error');
    return;
  }

  const button = $('#saveOfferButton');

  setBusy(button, true);
  message($('#offerEditorMessage'), '');

  try {
    const name = $('#offerName').value.trim();

    const originalPrice = Number($('#offerOriginalPrice').value);
    const offerPrice = Number($('#offerPrice').value);

    const startsRaw = $('#offerStartsAt').value;
    const endsRaw = $('#offerEndsAt').value;

    if (
      !name ||
      !Number.isFinite(originalPrice) ||
      originalPrice < 0 ||
      !Number.isFinite(offerPrice) ||
      offerPrice < 0
    ) {
      throw new Error('تحقق من اسم العرض والأسعار.');
    }

    if (offerPrice > originalPrice) {
      throw new Error('سعر العرض يجب أن يكون أقل من أو يساوي السعر الأصلي.');
    }

    const startsAt = startsRaw ? new Date(startsRaw) : null;
    const endsAt = endsRaw ? new Date(endsRaw) : null;

    if (startsAt && Number.isNaN(startsAt.getTime())) {
      throw new Error('تاريخ بداية العرض غير صحيح.');
    }

    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw new Error('تاريخ نهاية العرض غير صحيح.');
    }

    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new Error('تاريخ نهاية العرض يجب أن يكون بعد تاريخ البداية.');
    }

    const image = await uploadOfferImage($('#offerImage').files[0]);
    const selectedBranch = $('#offerBranch').value || null;

    const payload = {
      branch_id: isManager()
        ? currentProfile.branch_id
        : selectedBranch,

      name,
      description: $('#offerDescription').value.trim(),

      original_price: originalPrice,
      offer_price: offerPrice,

      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,

      is_active: $('#offerActive').checked,

      sort_order:
        Number.parseInt($('#offerOrder').value || '0', 10) || 0,

      image_url: image.image_url,
      image_path: image.image_path
    };

    const id = $('#offerId').value;

    const query = id
      ? client.from('offers').update(payload).eq('id', id)
      : client.from('offers').insert(payload);

    const { error } = await query;

    if (error) throw error;

    resetOfferForm();

    await loadOffers();

    toast(id ? 'تم تحديث العرض.' : 'تمت إضافة العرض.');

  } catch (error) {
    message($('#offerEditorMessage'), `تعذر حفظ العرض: ${error.message}`, 'error');
  } finally {
    setBusy(button, false);
  }
}

async function toggleOffer(id) {
  if (!canManageOffers()) {
    toast('ليس لديك صلاحية تغيير حالة العروض.', 'error');
    return;
  }

  const offer = offers.find(item => String(item.id) === String(id));
  if (!offer) return;

  const { error } = await client
    .from('offers')
    .update({ is_active: !offer.is_active })
    .eq('id', id);

  if (error) {
    toast(`تعذر تحديث حالة العرض: ${error.message}`, 'error');
    return;
  }

  await loadOffers();

  toast(offer.is_active ? 'تم إيقاف العرض.' : 'تم تفعيل العرض.');
}

async function deleteOffer(id) {
  if (!canManageOffers()) {
    toast('ليس لديك صلاحية حذف العروض.', 'error');
    return;
  }

  const offer = offers.find(item => String(item.id) === String(id));

  if (!offer || !confirm(`متأكد تريد حذف العرض «${offer.name}» نهائياً؟`)) {
    return;
  }

  const { error } = await client
    .from('offers')
    .delete()
    .eq('id', id);

  if (error) {
    toast(`تعذر حذف العرض: ${error.message}`, 'error');
    return;
  }

  if (offer.image_path) {
    if (String(offer.image_url || '').includes('.r2.dev/')) {
      await deleteR2Image(offer.image_path).catch(error => console.warn('R2 delete failed:', error));
    } else {
      await client.storage.from(IMAGE_BUCKET).remove([offer.image_path]).catch(() => {});
    }
  }

  await loadOffers();

  toast('تم حذف العرض.');
}

/* =====================================================
   الخصومات التلقائية — مستقلة عن الكوبونات والعروض
===================================================== */

function ensureDiscountUI() {
  if ($('#discountsPanel')) return;

  const panel = document.createElement('section');
  panel.id = 'discountsPanel';
  panel.className = 'panel discounts-panel';
  panel.innerHTML = `
    <div class="section-heading">
      <div><h2>الخصومات التلقائية</h2><p class="muted">خصومات حسب المنتج أو التصنيف أو الفرع أو جميع الفروع، مع تحديد مدة الصلاحية.</p></div>
      <button type="button" class="button button-primary" id="newDiscountButton">＋ إضافة خصم</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>اسم الخصم</th><th>النسبة</th><th>النطاق</th><th>المدة</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody id="discountsTable"><tr><td colspan="6" class="empty-cell">جارٍ تحميل الخصومات...</td></tr></tbody>
      </table>
    </div>
    <p id="discountsMessage" class="form-message" role="status"></p>
  `;

  const modal = document.createElement('div');
  modal.id = 'discountModal';
  modal.className = 'discount-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="discount-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="discountModalTitle">
      <div class="discount-modal-head"><h2 id="discountModalTitle">إضافة خصم تلقائي</h2><button type="button" class="button button-quiet" id="closeDiscountModal" aria-label="إغلاق">✕</button></div>
      <form id="discountForm" class="form-stack">
        <label>اسم الخصم *<input id="discountName" maxlength="120" required placeholder="مثلاً: خصم نهاية الأسبوع"></label>
        <label>نسبة الخصم (%) *<input id="discountPercent" type="number" min="0" max="100" step="0.01" required placeholder="20"></label>
        <label>تطبيق الخصم على *<select id="discountScope" required>
          <option value="all_branches">جميع الفروع</option>
          <option value="branch">فرع أو عدة فروع</option>
          <option value="category">تصنيف أو عدة تصنيفات</option>
          <option value="product">منتج أو عدة منتجات</option>
        </select></label>
        <label id="discountTargetsWrap" hidden>حدد العناصر المستهدفة *<select id="discountTargets" multiple size="6"></select><small>يمكن اختيار أكثر من عنصر باستخدام Ctrl أو Cmd.</small></label>
        <div class="discount-dates-grid">
          <label>يبدأ الخصم *<input id="discountStartsAt" type="datetime-local" required></label>
          <label>ينتهي الخصم *<input id="discountEndsAt" type="datetime-local" required></label>
        </div>
        <label class="switch-row"><input id="discountActive" type="checkbox" checked><span><strong>تفعيل الخصم</strong><small>يمكن إيقافه أو تشغيله لاحقاً دون حذفه.</small></span></label>
        <div class="discount-modal-actions"><button type="button" class="button button-quiet" id="cancelDiscountButton">إلغاء</button><button type="submit" class="button button-primary" id="saveDiscountButton">حفظ الخصم</button></div>
        <p id="discountFormMessage" class="form-message" role="status"></p>
      </form>
    </div>
  `;

  const style = document.createElement('style');
  style.id = 'discountUIStyles';
  style.textContent = `
    .discounts-panel{margin-top:22px}.discounts-panel .section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .discount-modal[hidden]{display:none!important}.discount-modal{position:fixed;inset:0;z-index:10000;background:rgba(25,12,10,.62);display:grid;place-items:center;padding:16px;overflow:auto}
    .discount-modal-dialog{width:min(680px,100%);max-height:min(90vh,900px);overflow:auto;background:#fffaf5;border:1px solid #ead9c7;border-radius:18px;padding:20px;box-shadow:0 20px 70px rgba(0,0,0,.24)}
    .discount-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.discount-modal-head h2{margin:0;color:#4b1111;font-size:1.2rem}
    .discount-dates-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.discount-modal input,.discount-modal select{width:100%;box-sizing:border-box}
    #discountTargets{min-height:150px}.discount-modal-actions{display:flex;justify-content:flex-start;gap:10px;flex-wrap:wrap}
    .discount-status{display:inline-flex;padding:5px 9px;border-radius:20px;background:#eee;color:#51433b;font-size:.82rem}.discount-status.is-active{background:#e4f3e7;color:#17642b}.discount-status.is-off{background:#f6e7e4;color:#8a3026}
    .discount-actions{display:flex;gap:6px;flex-wrap:wrap}.discount-actions .button{padding:6px 9px;font-size:.84rem}
    @media(max-width:600px){.discount-modal-dialog{padding:14px}.discount-dates-grid{grid-template-columns:1fr}.discounts-panel .table-wrap{overflow-x:auto}}
  `;

  document.head.appendChild(style);
  dashboard.appendChild(panel);
  document.body.appendChild(modal);
}

function toLocalDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function discountScopeLabel(discount) {
  if (discount.scope_type === 'all_branches') return 'جميع الفروع';
  if (discount.scope_type === 'branch') {
    const names = (discount.branch_ids || []).map(id =>
      discountBranches.find(item => String(item.id) === String(id))?.name || id
    );
    return `الفروع: ${names.join('، ') || '—'}`;
  }
  if (discount.scope_type === 'category') {
    const names = (discount.category_ids || []).map(id =>
      discountCategories.find(item => String(item.id) === String(id))?.name || id
    );
    return `التصنيفات: ${names.join('، ') || '—'}`;
  }
  const names = (discount.product_ids || []).map(id =>
    discountProducts.find(item => String(item.id) === String(id))?.name || id
  );
  return `المنتجات: ${names.join('، ') || '—'}`;
}

function discountIsCurrentlyValid(discount) {
  const now = Date.now();
  return discount.is_active === true &&
    new Date(discount.starts_at).getTime() <= now &&
    new Date(discount.ends_at).getTime() > now;
}

async function loadDiscountReferenceData() {
  const [branchResult, categoryResult, productResult] = await Promise.all([
    client.from('branches').select('id,name').order('sort_order'),
    client.from('categories').select('id,name,branch_id').order('name'),
    client.from('products').select('id,name,branch_id,category_id').order('name')
  ]);

  if (branchResult.error) throw branchResult.error;
  if (categoryResult.error) throw categoryResult.error;
  if (productResult.error) throw productResult.error;

  discountBranches = branchResult.data || [];
  discountCategories = categoryResult.data || [];
  discountProducts = productResult.data || [];
}

async function loadDiscounts() {
  ensureDiscountUI();
  const body = $('#discountsTable');
  if (!body) return;

  if (!canManageDiscounts()) {
    $('#discountsPanel').hidden = true;
    return;
  }

  $('#discountsPanel').hidden = false;
  body.innerHTML = '<tr><td colspan="6" class="empty-cell">جارٍ تحميل الخصومات...</td></tr>';

  try {
    await loadDiscountReferenceData();
    const { data, error } = await client.from('discounts')
      .select('*').order('created_at', { ascending: false });
    if (error) throw error;
    discounts = data || [];
    renderDiscounts();
  } catch (error) {
    body.innerHTML = '<tr><td colspan="6" class="empty-cell">تعذر تحميل الخصومات.</td></tr>';
    message($('#discountsMessage'), `تعذر تحميل الخصومات: ${error.message}`, 'error');
  }
}

function renderDiscounts() {
  const body = $('#discountsTable');
  if (!body) return;

  if (!discounts.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-cell">لا توجد خصومات تلقائية مضافة حالياً.</td></tr>';
    return;
  }

  body.innerHTML = discounts.map(item => {
    const status = discountIsCurrentlyValid(item)
      ? '<span class="discount-status is-active">فعال الآن</span>'
      : item.is_active
        ? '<span class="discount-status">مجدول / منتهي</span>'
        : '<span class="discount-status is-off">متوقف</span>';
    const start = new Date(item.starts_at).toLocaleString('ar-IQ');
    const end = new Date(item.ends_at).toLocaleString('ar-IQ');
    return `<tr>
      <td>${escapeHTML(item.name)}</td>
      <td><strong>${Number(item.discount_percent)}%</strong></td>
      <td>${escapeHTML(discountScopeLabel(item))}</td>
      <td><small>من ${escapeHTML(start)}<br>إلى ${escapeHTML(end)}</small></td>
      <td>${status}</td>
      <td><div class="discount-actions">
        <button type="button" class="button button-quiet" data-edit-discount="${escapeHTML(item.id)}">تعديل</button>
        <button type="button" class="button button-quiet" data-toggle-discount="${escapeHTML(item.id)}">${item.is_active ? 'إيقاف' : 'تفعيل'}</button>
        <button type="button" class="button button-danger" data-delete-discount="${escapeHTML(item.id)}">حذف</button>
      </div></td>
    </tr>`;
  }).join('');
}

function updateDiscountTargetOptions(selected = []) {
  const scope = $('#discountScope').value;
  const wrap = $('#discountTargetsWrap');
  const select = $('#discountTargets');
  if (!wrap || !select) return;

  const managerBranch = isManager() ? String(currentProfile?.branch_id || '') : '';
  let rows = [];
  if (scope === 'branch') {
    rows = discountBranches.filter(item => !managerBranch || String(item.id) === managerBranch)
      .map(item => ({ id: item.id, name: item.name }));
  } else if (scope === 'category') {
    rows = discountCategories.filter(item => !managerBranch || String(item.branch_id) === managerBranch)
      .map(item => ({ id: item.id, name: `${item.name} — ${branchName(item.branch_id)}` }));
  } else if (scope === 'product') {
    rows = discountProducts.filter(item => !managerBranch || String(item.branch_id) === managerBranch)
      .map(item => ({ id: item.id, name: `${item.name} — ${branchName(item.branch_id)}` }));
  }

  wrap.hidden = scope === 'all_branches';
  select.innerHTML = rows.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`).join('');
  [...select.options].forEach(option => { option.selected = selected.map(String).includes(String(option.value)); });
}

function openDiscountModal(discount = null) {
  if (!canManageDiscounts()) return;
  editingDiscountId = discount?.id || null;
  $('#discountModalTitle').textContent = discount ? 'تعديل الخصم التلقائي' : 'إضافة خصم تلقائي';
  $('#discountName').value = discount?.name || '';
  $('#discountPercent').value = discount?.discount_percent ?? '';
  $('#discountScope').value = discount?.scope_type || 'all_branches';
  $('#discountStartsAt').value = discount ? toLocalDateTimeValue(discount.starts_at) : '';
  $('#discountEndsAt').value = discount ? toLocalDateTimeValue(discount.ends_at) : '';
  $('#discountActive').checked = discount ? discount.is_active === true : true;
  const selected = discount?.scope_type === 'branch' ? discount.branch_ids || []
    : discount?.scope_type === 'category' ? discount.category_ids || []
    : discount?.scope_type === 'product' ? discount.product_ids || [] : [];
  updateDiscountTargetOptions(selected);
  message($('#discountFormMessage'), '');
  $('#discountModal').hidden = false;
  document.body.classList.add('discount-modal-open');
  $('#discountName').focus();
}

function closeDiscountModal() {
  $('#discountModal').hidden = true;
  document.body.classList.remove('discount-modal-open');
  editingDiscountId = null;
}

async function saveDiscount(event) {
  event.preventDefault();
  if (!canManageDiscounts()) return;

  const button = $('#saveDiscountButton');
  const scope = $('#discountScope').value;
  const percent = Number($('#discountPercent').value);
  const startsAt = new Date($('#discountStartsAt').value);
  const endsAt = new Date($('#discountEndsAt').value);
  const targets = [...$('#discountTargets').selectedOptions].map(option => option.value);

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    message($('#discountFormMessage'), 'نسبة الخصم يجب أن تكون بين 0 و100%.', 'error');
    return;
  }
  if (!$('#discountStartsAt').value || !$('#discountEndsAt').value ||
      Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    message($('#discountFormMessage'), 'تأكد من تاريخ ووقت البداية والنهاية؛ يجب أن تكون النهاية بعد البداية.', 'error');
    return;
  }
  if (scope !== 'all_branches' && !targets.length) {
    message($('#discountFormMessage'), 'حدد عنصراً واحداً على الأقل لتطبيق الخصم عليه.', 'error');
    return;
  }

  const payload = {
    name: $('#discountName').value.trim(),
    discount_percent: percent,
    scope_type: scope,
    branch_ids: scope === 'branch' ? targets : [],
    category_ids: scope === 'category' ? targets : [],
    product_ids: scope === 'product' ? targets : [],
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    is_active: $('#discountActive').checked
  };

  if (!payload.name) {
    message($('#discountFormMessage'), 'اكتب اسم الخصم.', 'error');
    return;
  }

  const wasEditing = Boolean(editingDiscountId);
  setBusy(button, true);
  try {
    const query = editingDiscountId
      ? client.from('discounts').update(payload).eq('id', editingDiscountId)
      : client.from('discounts').insert(payload);
    const { error } = await query;
    if (error) throw error;
    closeDiscountModal();
    await loadDiscounts();
    toast(wasEditing ? 'تم تحديث الخصم.' : 'تمت إضافة الخصم.');
  } catch (error) {
    message($('#discountFormMessage'), `تعذر حفظ الخصم: ${error.message}`, 'error');
  } finally {
    setBusy(button, false);
  }
}

async function toggleDiscount(id) {
  if (!canManageDiscounts()) return;
  const item = discounts.find(row => String(row.id) === String(id));
  if (!item) return;
  const { error } = await client.from('discounts').update({ is_active: !item.is_active }).eq('id', id);
  if (error) { toast(`تعذر تغيير حالة الخصم: ${error.message}`, 'error'); return; }
  await loadDiscounts();
  toast(item.is_active ? 'تم إيقاف الخصم.' : 'تم تفعيل الخصم.');
}

async function deleteDiscount(id) {
  if (!canManageDiscounts()) return;
  const item = discounts.find(row => String(row.id) === String(id));
  if (!item || !confirm(`متأكد تريد حذف الخصم «${item.name}» نهائياً؟`)) return;
  const { error } = await client.from('discounts').delete().eq('id', id);
  if (error) { toast(`تعذر حذف الخصم: ${error.message}`, 'error'); return; }
  await loadDiscounts();
  toast('تم حذف الخصم.');
}

function wireDiscountEvents() {
  ensureDiscountUI();
  $('#newDiscountButton')?.addEventListener('click', () => openDiscountModal());
  $('#closeDiscountModal')?.addEventListener('click', closeDiscountModal);
  $('#cancelDiscountButton')?.addEventListener('click', closeDiscountModal);
  $('#discountScope')?.addEventListener('change', () => updateDiscountTargetOptions());
  $('#discountForm')?.addEventListener('submit', saveDiscount);
  $('#discountModal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeDiscountModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#discountModal') && !$('#discountModal').hidden) closeDiscountModal();
  });
  $('#discountsTable')?.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.editDiscount) {
      const item = discounts.find(row => String(row.id) === String(button.dataset.editDiscount));
      if (item) openDiscountModal(item);
    }
    if (button.dataset.toggleDiscount) toggleDiscount(button.dataset.toggleDiscount);
    if (button.dataset.deleteDiscount) deleteDiscount(button.dataset.deleteDiscount);
  });
}

/* =====================================================
   نافذة تصنيفات الفرع المنبثقة
===================================================== */

function openCategoriesModal() {
  const modal = $('#categoriesModal');
  if (!modal) return;

  modal.hidden = false;
  document.body.classList.add('categories-modal-open');
  $('#closeCategoriesModal')?.focus();
}

function closeCategoriesModal() {
  const modal = $('#categoriesModal');
  if (!modal) return;

  modal.hidden = true;
  document.body.classList.remove('categories-modal-open');
  $('#openCategoriesModal')?.focus();
}

function wireCategoriesModalEvents() {
  $('#openCategoriesModal')?.addEventListener('click', openCategoriesModal);
  $('#closeCategoriesModal')?.addEventListener('click', closeCategoriesModal);
  $('#closeCategoriesModalFooter')?.addEventListener('click', closeCategoriesModal);

  $('#categoriesModal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) {
      closeCategoriesModal();
    }
  });

  document.addEventListener('keydown', event => {
    const modal = $('#categoriesModal');
    if (event.key === 'Escape' && modal && !modal.hidden) {
      closeCategoriesModal();
    }
  });
}

/* =====================================================
   إدارة القسائم (المالك ومالك السيرفر فقط)
===================================================== */

function canManageCoupons() {
  return Boolean(isOwner || isServerOwner);
}

function couponDateValue(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ar-IQ');
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function renderCouponBranches(selectedIds = []) {
  const list = $('#couponBranchesList');
  if (!list) return;
  list.innerHTML = branches.map(branch => `
    <label class="coupon-branch-option">
      <input type="checkbox" data-coupon-branch="${escapeHTML(branch.id)}" ${selectedIds.map(String).includes(String(branch.id)) ? 'checked' : ''}>
      ${escapeHTML(branch.name)}
    </label>
  `).join('') || '<p class="muted">لا توجد فروع.</p>';
  const allBranches = $('#couponAllBranches')?.checked;
  list.querySelectorAll('[data-coupon-branch]').forEach(input => { input.disabled = Boolean(allBranches); });
}

function renderCoupons() {
  const table = $('#couponsTable');
  if (!table) return;
  if (!coupons.length) {
    table.innerHTML = '<tr><td colspan="7" class="empty-cell">لا توجد قسائم حالياً.</td></tr>';
    return;
  }
  table.innerHTML = coupons.map(coupon => {
    const branchIds = Array.isArray(coupon.branch_ids)
      ? coupon.branch_ids
      : (coupon.coupon_branches || []).map(item => item.branch_id);
    const branchLabel = coupon.applies_to_all_branches
      ? 'جميع الفروع'
      : branchIds.map(branchName).join('، ') || '—';
    const discountLabel = coupon.discount_type === 'percent' ? 'نسبة' : 'مبلغ';
    const valueLabel = coupon.discount_type === 'percent'
      ? `${coupon.discount_value}%`
      : `${Number(coupon.discount_value).toLocaleString('en-US')} د.ع`;
    return `<tr>
      <td><span class="coupon-code">${escapeHTML(coupon.code)}</span></td>
      <td>${discountLabel}</td><td>${valueLabel}</td>
      <td>${escapeHTML(branchLabel)}</td>
      <td>${escapeHTML(couponDateValue(coupon.expires_at))}</td>
      <td><span class="coupon-status ${coupon.is_active ? 'active' : 'inactive'}">${coupon.is_active ? 'مفعّلة' : 'متوقفة'}</span></td>
      <td class="coupon-row-actions">
        <button type="button" class="button button-quiet" data-edit-coupon="${escapeHTML(coupon.id)}">تعديل</button>
        <button type="button" class="button button-danger" data-delete-coupon="${escapeHTML(coupon.id)}">حذف</button>
      </td>
    </tr>`;
  }).join('');
}

async function loadCoupons() {
  if (!canManageCoupons() || !client) return;
  const table = $('#couponsTable');
  if (table) table.innerHTML = '<tr><td colspan="7" class="empty-cell">جارٍ تحميل القسائم...</td></tr>';
  try {
    const { data, error } = await client
      .from('coupons')
      .select('*,coupon_branches(branch_id)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    coupons = data || [];
    renderCoupons();
  } catch (error) {
    if (table) table.innerHTML = `<tr><td colspan="7" class="empty-cell">تعذر تحميل القسائم: ${escapeHTML(error.message)}</td></tr>`;
  }
}

function resetCouponForm() {
  const form = $('#couponForm');
  if (!form) return;
  form.reset();
  $('#couponId').value = '';
  $('#couponEditorTitle').textContent = 'إنشاء قسيمة جديدة';
  $('#couponStartsAt').value = toDateTimeLocal(new Date());
  $('#couponPerCustomerLimit').value = '1';
  $('#couponAllBranches').checked = true;
  $('#couponAudienceType').value = 'all';
  $('#couponCustomerIds').value = '';
  $('#couponCustomerIdsWrap').hidden = true;
  $('#couponEditorPanel').hidden = true;
  message($('#couponEditorMessage'), '');
  renderCouponBranches([]);
}

async function openCouponEditor(coupon = null) {
  if (!canManageCoupons()) {
    toast('إدارة القسائم متاحة لصاحب المطعم ومالك السيرفر فقط.', 'error');
    return;
  }
  resetCouponForm();
  if (coupon) {
    $('#couponId').value = coupon.id;
    $('#couponCode').value = coupon.code || '';
    $('#couponDescription').value = coupon.description || '';
    $('#couponDiscountType').value = coupon.discount_type || 'percent';
    $('#couponDiscountValue').value = coupon.discount_value ?? '';
    $('#couponMaxDiscount').value = coupon.max_discount ?? '';
    $('#couponMinOrder').value = coupon.min_order_amount ?? coupon.min_order ?? 0;
    $('#couponStartsAt').value = toDateTimeLocal(coupon.starts_at);
    $('#couponExpiresAt').value = toDateTimeLocal(coupon.expires_at);
    $('#couponUsageLimit').value = coupon.usage_limit ?? '';
    $('#couponPerCustomerLimit').value = coupon.per_customer_limit ?? 1;
    $('#couponActive').checked = Boolean(coupon.is_active);
    $('#couponAudienceType').value = coupon.audience_type || 'all';
    const branchIds = Array.isArray(coupon.branch_ids)
      ? coupon.branch_ids
      : (coupon.coupon_branches || []).map(item => item.branch_id);
    $('#couponAllBranches').checked = Boolean(coupon.applies_to_all_branches);
    renderCouponBranches(branchIds);
    if (coupon.audience_type === 'selected') {
      const { data, error } = await client.from('customer_coupons').select('customer_id').eq('coupon_id', coupon.id);
      if (error) {
        toast(`تعذر تحميل قائمة الزبائن: ${error.message}`, 'error');
      } else {
        $('#couponCustomerIds').value = (data || []).map(row => row.customer_id).join(', ');
      }
    }
    $('#couponEditorTitle').textContent = 'تعديل القسيمة';
  }
  $('#couponCustomerIdsWrap').hidden = $('#couponAudienceType').value !== 'selected';
  $('#couponEditorPanel').hidden = false;
  $('#couponEditorPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  $('#couponCode').focus();
}

function openCouponsModal() {
  if (!canManageCoupons()) {
    toast('إدارة القسائم متاحة لصاحب المطعم ومالك السيرفر فقط.', 'error');
    return;
  }
  $('#couponsModal').hidden = false;
  document.body.classList.add('coupon-modal-open');
  loadCoupons();
  $('#closeCouponsModal')?.focus();
}

function closeCouponsModal() {
  const modal = $('#couponsModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('coupon-modal-open');
  resetCouponForm();
  $('#openCouponsModal')?.focus();
}

function parseCouponCustomerIds() {
  const raw = $('#couponCustomerIds').value.trim();
  if (!raw) return [];
  const ids = raw.split(/[\s,;]+/).map(value => value.trim()).filter(Boolean);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (ids.some(id => !uuidPattern.test(id))) {
    throw new Error('تأكد من أن جميع معرفات الزبائن UUID صحيحة.');
  }
  return [...new Set(ids)];
}

async function saveCoupon(event) {
  event.preventDefault();
  if (!canManageCoupons()) {
    toast('ليس لديك صلاحية إدارة القسائم.', 'error');
    return;
  }
  const button = $('#saveCouponButton');
  setBusy(button, true, 'جارٍ الحفظ...');
  message($('#couponEditorMessage'), '');
  try {
    const audienceType = $('#couponAudienceType').value;
    const customerIds = audienceType === 'selected' ? parseCouponCustomerIds() : [];
    if (audienceType === 'selected' && !customerIds.length) {
      throw new Error('أدخل معرف زبون واحداً على الأقل للقسيمة المحددة.');
    }
    const allBranches = $('#couponAllBranches').checked;
    const branchIds = allBranches ? [] : [...document.querySelectorAll('[data-coupon-branch]:checked')].map(input => input.dataset.couponBranch);
    if (!allBranches && !branchIds.length) throw new Error('حدد فرعاً واحداً على الأقل أو اختر جميع الفروع.');
    const startsAt = new Date($('#couponStartsAt').value);
    const expiresRaw = $('#couponExpiresAt').value;
    const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
    if (Number.isNaN(startsAt.getTime())) throw new Error('تاريخ بداية القسيمة غير صحيح.');
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= startsAt)) throw new Error('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.');
    const usageRaw = $('#couponUsageLimit').value;
    const maxRaw = $('#couponMaxDiscount').value;
    const { data, error } = await client.rpc('admin_save_coupon_v2', {
      p_id: $('#couponId').value || null,
      p_code: $('#couponCode').value.trim().toUpperCase(),
      p_description: $('#couponDescription').value.trim() || null,
      p_discount_type: $('#couponDiscountType').value,
      p_discount_value: Number($('#couponDiscountValue').value),
      p_max_discount: maxRaw === '' ? null : Number(maxRaw),
      p_min_order_amount: Number($('#couponMinOrder').value || 0),
      p_starts_at: startsAt.toISOString(),
      p_expires_at: expiresAt ? expiresAt.toISOString() : null,
      p_usage_limit: usageRaw === '' ? null : Number(usageRaw),
      p_per_customer_limit: Number($('#couponPerCustomerLimit').value),
      p_applies_to_all_branches: allBranches,
      p_branch_ids: branchIds,
      p_is_active: $('#couponActive').checked,
      p_audience_type: audienceType,
      p_customer_ids: customerIds
    });
    if (error) throw error;
    if (!data) throw new Error('لم تُرجع قاعدة البيانات معرف القسيمة المحفوظة.');
    toast('تم حفظ القسيمة بنجاح.');
    resetCouponForm();
    await loadCoupons();
  } catch (error) {
    message($('#couponEditorMessage'), `تعذر حفظ القسيمة: ${error.message}`, 'error');
  } finally {
    setBusy(button, false);
  }
}

async function deleteCoupon(couponId) {
  if (!canManageCoupons()) {
    toast('ليس لديك صلاحية حذف القسائم.', 'error');
    return;
  }
  const coupon = coupons.find(item => String(item.id) === String(couponId));
  if (!coupon || !confirm(`هل أنت متأكد من حذف القسيمة ${coupon.code}؟`)) return;
  try {
    const { data, error } = await client.rpc('admin_delete_coupon', { p_id: couponId });
    if (error) throw error;
    if (data !== true) throw new Error('لم يتم تأكيد حذف القسيمة من قاعدة البيانات.');
    toast('تم حذف القسيمة.');
    await loadCoupons();
  } catch (error) {
    toast(`تعذر حذف القسيمة: ${error.message}`, 'error');
  }
}

function wireCouponEvents() {
  $('#openCouponsModal')?.addEventListener('click', openCouponsModal);
  $('#closeCouponsModal')?.addEventListener('click', closeCouponsModal);
  $('#newCouponButton')?.addEventListener('click', () => openCouponEditor());
  $('#resetCouponButton')?.addEventListener('click', resetCouponForm);
  $('#cancelCouponButton')?.addEventListener('click', resetCouponForm);
  $('#couponForm')?.addEventListener('submit', saveCoupon);
  $('#couponAudienceType')?.addEventListener('change', event => {
    $('#couponCustomerIdsWrap').hidden = event.target.value !== 'selected';
  });
  $('#couponAllBranches')?.addEventListener('change', event => {
    document.querySelectorAll('[data-coupon-branch]').forEach(input => {
      input.disabled = event.target.checked;
    });
  });
  $('#couponsTable')?.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || !canManageCoupons()) return;
    if (button.dataset.editCoupon) {
      const coupon = coupons.find(item => String(item.id) === String(button.dataset.editCoupon));
      if (coupon) await openCouponEditor(coupon);
    }
    if (button.dataset.deleteCoupon) await deleteCoupon(button.dataset.deleteCoupon);
  });
  $('#couponsModal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeCouponsModal();
  });
  document.addEventListener('keydown', event => {
    const modal = $('#couponsModal');
    if (event.key === 'Escape' && modal && !modal.hidden) closeCouponsModal();
  });
}

/* =====================================================
   أحداث الواجهة
===================================================== */

function wireEvents() {
  wireCategoriesModalEvents();
  wireDiscountEvents();
  wireCouponEvents();
  $('#loginForm').addEventListener('submit', signIn);

  $('#logoutButton').addEventListener('click', async () => {
    await client?.auth.signOut();

    resetAuthorizationState();
    setLoggedIn(false);

    $('#loginPassword').value = '';

    message($('#loginMessage'), 'تم تسجيل الخروج.');
  });

  /* تغيير الفرع */

  $('#branchSelect').addEventListener('change', async event => {
    if (isManager()) return;

    activeBranch = event.target.value;

    $('#productBranch').value = activeBranch;

    await loadCategories();

    resetProductForm();

    await loadProducts();
    await loadDiscounts();
  });

  $('#productBranch').addEventListener('change', async event => {
    if (isManager()) return;

    const branchId = event.target.value;

    if (branchId !== activeBranch) {
      activeBranch = branchId;

      $('#branchSelect').value = activeBranch;

      await loadCategories();

      resetProductForm();

      await loadProducts();
      await loadDiscounts();
    }

    renderProductSizes([]);
    setProductFormPermissions();
  });

  /* المستخدمون */

  $('#createUserForm').addEventListener('submit', createUser);
  $('#refreshUsersButton').addEventListener('click', loadUsers);

  $('#usersTable').addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.editPermissions) {
      openPermissionsEditor(button.dataset.editPermissions);
    }

    if (button.dataset.changeRole) {
      await changeUserRole(button.dataset.changeRole);
    }

    if (button.dataset.resetPassword) {
      await resetUserPassword(button.dataset.resetPassword);
    }

    if (button.dataset.deleteUser) {
      await deleteUser(button.dataset.deleteUser);
    }
  });

  $('#savePermissionsButton').addEventListener('click', saveUserPermissions);

  $('#closePermissionsButton').addEventListener('click', () => {
    $('#permissionsEditor').hidden = true;
    message($('#permissionsMessage'), '');
  });

  /* المنتجات */

  $('#productSearch').addEventListener('input', renderProducts);

  $('#newProductButton').addEventListener('click', () => {
    if (!canManageProducts()) return;

    resetProductForm();

    $('#productEditorPanel').scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    $('#productName').focus();
  });

  $('#resetProductButton').addEventListener('click', resetProductForm);

  $('#productForm').addEventListener('submit', saveProduct);

  $('#productsTable').addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.editProduct) {
      const product = products.find(item =>
        String(item.id) === String(button.dataset.editProduct)
      );

      if (product) fillProductForm(product);
    }

    if (button.dataset.deleteProduct) {
      await deleteProduct(button.dataset.deleteProduct);
    }

    if (button.dataset.toggleProduct) {
      await toggleAvailability(button.dataset.toggleProduct);
    }
  });

  $('#productImage').addEventListener('change', () => {
    if (!canManageProducts()) return;

    const file = $('#productImage').files[0];
    if (!file) return;

    $('#imagePreview').src = URL.createObjectURL(file);
    $('#imageFileLabel').textContent = file.name;
    $('#imagePreviewWrap').hidden = false;
  });

  /* الأحجام */

  $('#addProductSizeButton').addEventListener('click', addProductSize);

  $('#productSizesList').addEventListener('click', event => {
    const button = event.target.closest('[data-remove-size]');
    if (!button) return;

    if (!canManageProducts()) {
      toast('ليس لديك صلاحية تعديل الأحجام.', 'error');
      return;
    }

    button.closest('[data-size-row]')?.remove();

    const list = $('#productSizesList');

    if (!list.querySelector('[data-size-row]')) {
      list.innerHTML = `
        <p class="muted" data-empty-sizes>
          لا توجد أحجام مضافة لهذا المنتج.
        </p>
      `;
    }
  });

  /* العروض */

  $('#newOfferButton').addEventListener('click', () => {
    if (!canManageOffers()) return;

    resetOfferForm();

    $('#offerEditorPanel').scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    $('#offerName').focus();
  });

  $('#resetOfferButton').addEventListener('click', resetOfferForm);

  $('#offerForm').addEventListener('submit', saveOffer);

  $('#offerImage').addEventListener('change', () => {
    if (!canManageOffers()) return;

    const file = $('#offerImage').files[0];
    if (!file) return;

    $('#offerImagePreview').src = URL.createObjectURL(file);
    $('#offerImageFileLabel').textContent = file.name;
    $('#offerImagePreviewWrap').hidden = false;
  });

  $('#offersTable').addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.editOffer) {
      const offer = offers.find(item =>
        String(item.id) === String(button.dataset.editOffer)
      );

      if (offer) fillOfferForm(offer);
    }

    if (button.dataset.deleteOffer) {
      await deleteOffer(button.dataset.deleteOffer);
    }

    if (button.dataset.toggleOffer) {
      await toggleOffer(button.dataset.toggleOffer);
    }
  });

  /* التصنيفات */

  $('#categoryForm').addEventListener('submit', addCategory);

  $('#categoriesList').addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.saveCategorySchedule) {
      await saveCategorySchedule(button.dataset.saveCategorySchedule, button);
      return;
    }

    if (button.dataset.orderCategory) {
      await changeCategoryOrder(button.dataset.orderCategory);
    }

    if (button.dataset.renameCategory) {
      await renameCategory(button.dataset.renameCategory);
    }

    if (button.dataset.deleteCategory) {
      await deleteCategory(button.dataset.deleteCategory);
    }
  });
}

/* =====================================================
   تشغيل اللوحة
===================================================== */

async function boot() {
  try {
    wireEvents();

    if (!readyConfig) {
      setupWarning.hidden = false;

      $('#loginForm button[type="submit"]').disabled = true;

      message($('#loginMessage'), 'أكمل إعداد Supabase أولاً.');

      return;
    }

    const {
      data: { session },
      error
    } = await client.auth.getSession();

    if (error) throw error;

    if (session) {
      await authorizeAndLoad();
    } else {
      setLoggedIn(false);
    }

    client.auth.onAuthStateChange((_event, sessionNow) => {
      if (!sessionNow) {
        resetAuthorizationState();
        setLoggedIn(false);
      }
    });

  } catch (error) {
    console.error('Admin boot error:', error);

    toast(`حدث خطأ أثناء تشغيل اللوحة: ${error.message}`, 'error');

  } finally {
    window.hidePageLoader?.();
  }
}

boot();
