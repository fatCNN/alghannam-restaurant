
import {
  supabaseClient as client,
  isSupabaseConfigured as readyConfig
} from './supabase-client.js';

const $ = selector => document.querySelector(selector);

const IMAGE_BUCKET = 'menu-images';

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
  can_manage_coupons: 'إدارة القسائم',
  can_manage_branch_staff: 'مشاهدة موظفي جميع الفروع',
  can_delete_staff: 'حذف موظفي الفرع'
};

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS);

let branches = [];
let categories = [];
let products = [];
let offers = [];
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

  panel.hidden = !isGrillBranch();

  if (!isGrillBranch()) {
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

  if (!isGrillBranch($('#productBranch').value || activeBranch)) {
    toast('الأحجام الإضافية مخصصة لفرع المشاوي.', 'error');
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
  if (!isGrillBranch($('#productBranch').value || activeBranch)) {
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

  const categoriesPanel = $('#categoriesList')
    ?.closest('.categories-panel');

  if (categoriesPanel) {
    categoriesPanel.hidden = !categoriesAllowed;
  }

  $('#categoryForm').hidden = !categoriesAllowed;
  $('#offersPanel').hidden = !offersAllowed;

  const couponsPanel = $('#couponsPanel');

  if (couponsPanel) {
    couponsPanel.hidden = !isOwner;
  }

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
    sizesPanel.hidden = !isGrillBranch(
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

function renderCategoriesList() {
  const list = $('#categoriesList');
  if (!list) return;

  list.innerHTML = categories.length
    ? categories.map(category => `
        <div class="category-chip" data-category-id="${escapeHTML(category.id)}">

          <span>
            <strong>${escapeHTML(category.name)}</strong>

            <small dir="ltr">
              ${escapeHTML(category.name_en || 'No English name')}
            </small>

            <small>
              ترتيب العرض: ${Number(category.sort_order) || 0}
            </small>
          </span>

          <button
            type="button"
            data-order-category="${escapeHTML(category.id)}">
            ترتيب العرض
          </button>

          <button
            type="button"
            data-rename-category="${escapeHTML(category.id)}">
            تعديل الاسمين
          </button>

          <button
            type="button"
            data-delete-category="${escapeHTML(category.id)}">
            حذف
          </button>

        </div>
      `).join('')
    : '<p class="muted">ماكو تصنيفات بهذا الفرع.</p>';

  $('#statCategories').textContent = categories.length;
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
    throw new Error('حجم الصورة يجب أن يكون أقل من 8 ميغابايت.');
  }

  const extension = file.name
    .split('.')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'png';

  const path = `${branchId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await client.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  const { data } = client.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(path);

  return {
    image_url: data.publicUrl,
    image_path: path
  };
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

      /*
        تحديث الأحجام لفرع المشاوي فقط.
        في بقية الفروع نترك size_options القديمة كما هي.
      */
      if (isGrillBranch(branchId)) {
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
    await client.storage
      .from(IMAGE_BUCKET)
      .remove([product.image_path])
      .catch(() => {});
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
    throw new Error('حجم الصورة يجب أن يكون أقل من 8 ميغابايت.');
  }

  const extension = file.name
    .split('.')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'png';

  const path = `offers/${crypto.randomUUID()}.${extension}`;

  const { error } = await client.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  const { data } = client.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(path);

  return {
    image_url: data.publicUrl,
    image_path: path
  };
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
    await client.storage
      .from(IMAGE_BUCKET)
      .remove([offer.image_path])
      .catch(() => {});
  }

  await loadOffers();

  toast('تم حذف العرض.');
}

/* =====================================================
   أحداث الواجهة
===================================================== */

function wireEvents() {
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
