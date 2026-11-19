import {
  supabaseClient as supabase,
  isSupabaseConfigured as configured
} from './supabase-client.js';

// =====================================================
// مطعم الغنّام — إدارة الطلبات وتعديلها وربط المندوبين
// =====================================================

const $ = selector => document.querySelector(selector);

if (!configured || !supabase) {
  throw new Error('إعدادات Supabase غير مكتملة.');
}

const SERVER_OWNER_IDS = [
  '489c60eb-5ae5-4611-96d6-b1d911e2686c',
  '1488410c-39a5-417b-92f6-c68ee55c886d'
];

const elements = {
  userRole: $('#userRole'),
  message: $('#message'),
  refreshButton: $('#refreshButton'),
  totalCount: $('#totalCount'),
  newCount: $('#newCount'),
  preparingCount: $('#preparingCount'),
  readyCount: $('#readyCount'),
  branchFilter: $('#branchFilter'),
  statusFilter: $('#statusFilter'),
  searchInput: $('#searchInput'),
  ordersList: $('#ordersList')
};

const STATUS_LABELS = {
  new: 'جديد',
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  out_for_delivery: 'خرج للتوصيل',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي'
};

let currentUser = null;
let currentProfile = null;
let allOrders = [];
let allDrivers = [];

let isOwner = false;
let isServerOwner = false;
let driversLoadError = null;

function canViewAllBranches() {
  return isOwner || isServerOwner;
}

// =====================================================
// حماية النصوص
// =====================================================

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

// =====================================================
// الرسائل
// =====================================================

function showMessage(message, type = 'success') {
  if (!elements.message) return;

  elements.message.textContent = message;
  elements.message.className = `message ${type}`;
  elements.message.hidden = false;

  elements.message.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest'
  });
}

function hideMessage() {
  if (elements.message) {
    elements.message.hidden = true;
  }
}

// =====================================================
// تنسيق التاريخ والأسعار
// =====================================================

function formatDate(value) {
  if (!value) return 'غير محدد';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'غير محدد';
  }

  return date.toLocaleString('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('en-US')} د.ع`;
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// =====================================================
// عرض المنتجات
// =====================================================

function getItemsHTML(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p class="empty-items">لا توجد تفاصيل للمنتجات.</p>';
  }

  return `
    <div class="order-items">
      <h3>تفاصيل المنتجات</h3>

      ${items.map(item => {
        const name =
          item.name ||
          item.title ||
          item.product_name ||
          'منتج';

        const quantity = item.quantity ?? item.qty ?? 1;
        const price = item.price ?? item.unit_price ?? 0;

        return `
          <div class="order-item">
            <span>
              ${escapeHTML(name)} × ${escapeHTML(quantity)}
            </span>

            <strong>
              ${formatPrice(numberValue(price) * numberValue(quantity))}
            </strong>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// =====================================================
// خيارات حالة الطلب
// =====================================================

function getStatusOptions(selectedStatus) {
  return Object.entries(STATUS_LABELS).map(([value, label]) => `
    <option value="${value}" ${value === selectedStatus ? 'selected' : ''}>
      ${label}
    </option>
  `).join('');
}

// =====================================================
// الإحصائيات
// =====================================================

function updateStatistics(orders) {
  elements.totalCount.textContent = orders.length;

  elements.newCount.textContent =
    orders.filter(order => order.status === 'new').length;

  elements.preparingCount.textContent =
    orders.filter(order => order.status === 'preparing').length;

  elements.readyCount.textContent =
    orders.filter(order => order.status === 'ready').length;
}

// =====================================================
// فلتر الفروع
// =====================================================

function fillBranchFilter(orders) {
  if (!canViewAllBranches()) {
    elements.branchFilter.innerHTML = `
      <option value="">فرعي</option>
    `;

    elements.branchFilter.disabled = true;
    return;
  }

  elements.branchFilter.disabled = false;

  const selectedValue = elements.branchFilter.value;

  const branches = [
    ...new Set(
      orders.map(order => order.branch_id).filter(Boolean)
    )
  ];

  elements.branchFilter.innerHTML = `
    <option value="">كل الفروع</option>

    ${branches.map(branch => `
      <option value="${escapeHTML(branch)}">
        ${escapeHTML(branch)}
      </option>
    `).join('')}
  `;

  if (branches.includes(selectedValue)) {
    elements.branchFilter.value = selectedValue;
  }
}

// =====================================================
// جلب المندوبين
// =====================================================

async function fetchDrivers() {
  let query = supabase
    .from('delivery_drivers')
    .select('id,branch_id,full_name,phone,is_active')
    .order('full_name', { ascending: true });

  if (!canViewAllBranches()) {
    query = query.eq(
      'branch_id',
      String(currentProfile.branch_id)
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  allDrivers = data || [];
}

function getDriversForOrder(order) {
  return allDrivers.filter(driver =>
    String(driver.branch_id) === String(order.branch_id)
  );
}

function getDriverOptions(order) {
  const assignedId = order.delivery_driver_id || '';
  const drivers = getDriversForOrder(order);

  const availableDrivers = drivers.filter(driver =>
    driver.is_active ||
    String(driver.id) === String(assignedId)
  );

  let options = '<option value="">بدون مندوب</option>';

  options += availableDrivers.map(driver => `
    <option
      value="${escapeHTML(driver.id)}"
      ${String(driver.id) === String(assignedId) ? 'selected' : ''}
    >
      ${escapeHTML(driver.full_name)}${driver.is_active ? '' : ' (غير نشط)'}
    </option>
  `).join('');

  if (
    assignedId &&
    !availableDrivers.some(driver =>
      String(driver.id) === String(assignedId)
    )
  ) {
    options += `
      <option value="${escapeHTML(assignedId)}" selected>
        المندوب المسند حالياً
      </option>
    `;
  }

  return options;
}

// =====================================================
// رابط موقع الزبون
// =====================================================

function getCustomerLocationHTML(order) {
  const url = String(order.customer_location_url || '').trim();

  if (!url) {
    return `
      <p class="customer-location-missing">
        <strong>موقع الزبون:</strong>
        لم تتم إضافة الموقع بعد.
      </p>
    `;
  }

  return `
    <p class="customer-location-link">
      <strong>موقع الزبون:</strong>
      <a
        href="${escapeHTML(url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        فتح موقع الزبون على الخريطة ↗
      </a>
    </p>
  `;
}

// =====================================================
// عرض الطلبات
// =====================================================

function renderOrders() {
  const status = elements.statusFilter.value;
  const branch = elements.branchFilter.value;

  const search = elements.searchInput.value
    .trim()
    .toLowerCase();

  const filteredOrders = allOrders.filter(order => {
    const matchesStatus =
      !status || order.status === status;

    const matchesBranch =
      !branch || String(order.branch_id) === branch;

    const searchableText = [
      order.order_number,
      order.customer_name,
      order.customer_phone,
      order.customer_address,
      order.customer_location_url
    ].join(' ').toLowerCase();

    return matchesStatus &&
      matchesBranch &&
      (!search || searchableText.includes(search));
  });

  if (filteredOrders.length === 0) {
    elements.ordersList.innerHTML = `
      <div class="loading">لا توجد طلبات مطابقة.</div>
    `;
    return;
  }

  elements.ordersList.innerHTML = filteredOrders.map(order => {
    const orderNumber = order.order_number ?? order.id;

    const statusLabel =
      STATUS_LABELS[order.status] ||
      order.status ||
      'غير محدد';

    const assignedDriver = allDrivers.find(driver =>
      String(driver.id) === String(order.delivery_driver_id)
    );

    const driverName = assignedDriver
      ? assignedDriver.full_name
      : order.delivery_driver_id
        ? 'مندوب مسند سابقاً'
        : 'لم يتم تعيين مندوب';

    return `
      <article
        class="order-card"
        data-order-id="${escapeHTML(order.id)}"
      >

        <div class="order-card-header">
          <div>
            <h3>طلب رقم: ${escapeHTML(orderNumber)}</h3>
            <span>${escapeHTML(formatDate(order.created_at))}</span>
          </div>

          <span class="order-status status-${escapeHTML(order.status)}">
            ${escapeHTML(statusLabel)}
          </span>
        </div>

        <div class="order-customer">
          <p>
            <strong>الزبون:</strong>
            ${escapeHTML(order.customer_name)}
          </p>

          <p>
            <strong>الهاتف:</strong>
            ${escapeHTML(order.customer_phone)}
          </p>

          <p>
            <strong>العنوان:</strong>
            ${escapeHTML(order.customer_address)}
          </p>

          ${order.customer_notes ? `
            <p>
              <strong>ملاحظات:</strong>
              ${escapeHTML(order.customer_notes)}
            </p>
          ` : ''}

          <p>
            <strong>الفرع:</strong>
            ${escapeHTML(order.branch_id)}
          </p>

          ${getCustomerLocationHTML(order)}
        </div>

        ${getItemsHTML(order.items)}

        <div class="order-total">
          <span>
            المجموع قبل الخصم:
            ${formatPrice(order.subtotal)}
          </span>

          ${Number(order.discount_amount) > 0 ? `
            <span>
              الخصم:
              ${formatPrice(order.discount_amount)}
            </span>
          ` : ''}

          <strong>
            الإجمالي:
            ${formatPrice(order.total)}
          </strong>
        </div>

        <div class="order-edit-actions">
          <button
            class="button edit-order-button"
            type="button"
          >
            ✏️ تعديل بيانات الطلب
          </button>
        </div>

        <div class="order-actions">
          <label>
            تحديث حالة الطلب

            <select class="status-select">
              ${getStatusOptions(order.status)}
            </select>
          </label>

          <button
            class="button save-status-button"
            type="button"
          >
            حفظ الحالة
          </button>
        </div>

        <div class="order-actions driver-assignment">
          <label>
            مندوب التوصيل

            <select
              class="driver-select"
              ${driversLoadError ? 'disabled' : ''}
            >
              ${getDriverOptions(order)}
            </select>
          </label>

          <button
            class="button save-driver-button"
            type="button"
            ${driversLoadError ? 'disabled' : ''}
          >
            حفظ المندوب
          </button>
        </div>

        <p class="assigned-driver-info">
          <strong>المندوب الحالي:</strong>
          ${escapeHTML(driverName)}
        </p>

      </article>
    `;
  }).join('');
}

// =====================================================
// نافذة تعديل الطلب
// =====================================================

function createEditModal() {
  if ($('#orderEditModal')) return;

  const modal = document.createElement('div');

  modal.id = 'orderEditModal';
  modal.className = 'order-edit-modal';
  modal.hidden = true;

  modal.innerHTML = `
    <div class="order-edit-backdrop" data-close-edit></div>

    <section
      class="order-edit-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editOrderTitle"
    >
      <div class="order-edit-header">
        <div>
          <h2 id="editOrderTitle">تعديل الطلب</h2>
          <p id="editOrderNumber"></p>
        </div>

        <button
          type="button"
          class="edit-modal-close"
          data-close-edit
          aria-label="إغلاق"
        >×</button>
      </div>

      <form id="orderEditForm">

        <input type="hidden" id="editOrderId">

        <div class="edit-section">
          <h3>معلومات الزبون</h3>

          <div class="edit-grid">
            <label>
              اسم الزبون
              <input id="editCustomerName" type="text" required>
            </label>

            <label>
              رقم الهاتف
              <input id="editCustomerPhone" type="tel" required>
            </label>
          </div>

          <label>
            عنوان التوصيل
            <textarea id="editCustomerAddress" rows="2"></textarea>
          </label>

          <label>
            ملاحظات الطلب
            <textarea id="editCustomerNotes" rows="2"></textarea>
          </label>

          <label>
            رابط موقع الزبون على Google Maps
            <input
              id="editCustomerLocation"
              type="url"
              inputmode="url"
              placeholder="https://maps.google.com/..."
              dir="ltr"
            >
          </label>

          <p class="edit-help">
            يمكنك إضافة الرابط بعد استلامه من الزبون عبر واتساب.
          </p>
        </div>

        <div class="edit-section">
          <div class="edit-items-heading">
            <h3>منتجات الطلب</h3>

            <button
              type="button"
              id="addOrderItemButton"
              class="add-item-button"
            >
              + إضافة منتج
            </button>
          </div>

          <div id="editOrderItems" class="edit-order-items"></div>
        </div>

        <div class="edit-totals">
          <div>
            <span>المجموع قبل الخصم</span>
            <strong id="editSubtotal">0 د.ع</strong>
          </div>

          <div>
            <span>الخصم الحالي</span>
            <strong id="editDiscount">0 د.ع</strong>
          </div>

          <div>
            <span>الإجمالي الجديد</span>
            <strong id="editTotal">0 د.ع</strong>
          </div>
        </div>

        <div class="edit-modal-actions">
          <button
            type="button"
            class="edit-cancel-button"
            data-close-edit
          >
            إلغاء
          </button>

          <button
            type="submit"
            id="saveEditedOrderButton"
            class="button"
          >
            حفظ التعديلات
          </button>
        </div>

        <p id="editOrderMessage" class="edit-order-message" hidden></p>

      </form>
    </section>
  `;

  document.body.appendChild(modal);
}

// =====================================================
// إدارة منتجات نافذة التعديل
// =====================================================

let editingOriginalOrder = null;
let editingItems = [];

function normalizeItem(item) {
  return {
    ...item,
    _editName: String(
      item.name || item.title || item.product_name || ''
    ),
    _editQuantity: numberValue(item.quantity ?? item.qty, 1),
    _editPrice: numberValue(item.price ?? item.unit_price, 0)
  };
}

function renderEditItems() {
  const container = $('#editOrderItems');

  if (!container) return;

  if (editingItems.length === 0) {
    container.innerHTML = `
      <p class="edit-no-items">
        لا توجد منتجات. يمكنك إضافة منتج جديد.
      </p>
    `;
  } else {
    container.innerHTML = editingItems.map((item, index) => `
      <div class="edit-item-row" data-item-index="${index}">

        <label>
          اسم المنتج
          <input
            type="text"
            class="edit-item-name"
            value="${escapeHTML(item._editName)}"
            required
          >
        </label>

        <div class="edit-item-fields">
          <label>
            الكمية
            <input
              type="number"
              class="edit-item-quantity"
              min="1"
              step="1"
              value="${escapeHTML(item._editQuantity)}"
              required
            >
          </label>

          <label>
            سعر الوحدة
            <input
              type="number"
              class="edit-item-price"
              min="0"
              step="1"
              value="${escapeHTML(item._editPrice)}"
              required
            >
          </label>
        </div>

        <div class="edit-item-footer">
          <strong>
            المجموع:
            ${formatPrice(item._editQuantity * item._editPrice)}
          </strong>

          <button
            type="button"
            class="remove-edit-item-button"
            data-remove-item="${index}"
          >
            حذف المنتج
          </button>
        </div>

      </div>
    `).join('');
  }

  updateEditTotals();
}

function collectEditItemsFromInputs() {
  const rows = [...$('#editOrderItems').querySelectorAll('.edit-item-row')];

  rows.forEach(row => {
    const index = Number(row.dataset.itemIndex);
    const item = editingItems[index];

    if (!item) return;

    item._editName =
      row.querySelector('.edit-item-name').value.trim();

    item._editQuantity =
      numberValue(row.querySelector('.edit-item-quantity').value, 1);

    item._editPrice =
      numberValue(row.querySelector('.edit-item-price').value, 0);
  });
}

function updateEditTotals() {
  const subtotal = editingItems.reduce((sum, item) => {
    return sum +
      numberValue(item._editQuantity) *
      numberValue(item._editPrice);
  }, 0);

  const discount = numberValue(
    editingOriginalOrder?.discount_amount,
    0
  );

  // نحافظ على الفرق بين الإجمالي والمجموع السابق،
  // مثل أجور التوصيل أو أي مبالغ أخرى موجودة بالطلب.
  const oldSubtotal = numberValue(
    editingOriginalOrder?.subtotal,
    0
  );

  const oldTotal = numberValue(
    editingOriginalOrder?.total,
    oldSubtotal - discount
  );

  const otherAmounts = oldTotal - oldSubtotal;
  const total = Math.max(0, subtotal + otherAmounts);

  $('#editSubtotal').textContent = formatPrice(subtotal);
  $('#editDiscount').textContent = formatPrice(discount);
  $('#editTotal').textContent = formatPrice(total);
}

function addNewEditItem() {
  collectEditItemsFromInputs();

  editingItems.push({
    name: '',
    quantity: 1,
    price: 0,
    _editName: '',
    _editQuantity: 1,
    _editPrice: 0
  });

  renderEditItems();
}

// =====================================================
// فتح نافذة تعديل الطلب
// =====================================================

function openEditOrder(orderId) {
  const order = allOrders.find(item =>
    String(item.id) === String(orderId)
  );

  if (!order) {
    showMessage('لم يتم العثور على الطلب.', 'error');
    return;
  }

  editingOriginalOrder = order;

  $('#editOrderId').value = order.id;
  $('#editOrderNumber').textContent =
    `رقم الطلب: ${order.order_number ?? order.id}`;

  $('#editCustomerName').value = order.customer_name || '';
  $('#editCustomerPhone').value = order.customer_phone || '';
  $('#editCustomerAddress').value = order.customer_address || '';
  $('#editCustomerNotes').value = order.customer_notes || '';
  $('#editCustomerLocation').value =
    order.customer_location_url || '';

  editingItems = Array.isArray(order.items)
    ? order.items.map(normalizeItem)
    : [];

  renderEditItems();

  $('#editOrderMessage').hidden = true;
  $('#orderEditModal').hidden = false;
  document.body.classList.add('edit-modal-open');

  setTimeout(() => {
    $('#editCustomerName')?.focus();
  }, 50);
}

function closeEditOrder() {
  const modal = $('#orderEditModal');

  if (modal) modal.hidden = true;

  document.body.classList.remove('edit-modal-open');

  editingOriginalOrder = null;
  editingItems = [];
}

// =====================================================
// التحقق من رابط الموقع
// =====================================================

function validateLocationUrl(value) {
  const url = String(value || '').trim();

  if (!url) return null;

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error('رابط موقع الزبون غير صحيح. تأكد من نسخ الرابط كاملاً.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('رابط الموقع يجب أن يبدأ بـ https:// أو http://');
  }

  return url;
}

// =====================================================
// حفظ التعديلات
// =====================================================

async function saveEditedOrder(event) {
  event.preventDefault();

  const button = $('#saveEditedOrderButton');
  const message = $('#editOrderMessage');

  const orderId = $('#editOrderId').value;

  const order = allOrders.find(item =>
    String(item.id) === String(orderId)
  );

  if (!order) {
    showMessage('الطلب غير موجود.', 'error');
    return;
  }

  try {
    collectEditItemsFromInputs();

    const customerName = $('#editCustomerName').value.trim();
    const customerPhone = $('#editCustomerPhone').value.trim();
    const customerAddress = $('#editCustomerAddress').value.trim();
    const customerNotes = $('#editCustomerNotes').value.trim();
    const customerLocation = validateLocationUrl(
      $('#editCustomerLocation').value
    );

    if (!customerName) {
      throw new Error('يرجى إدخال اسم الزبون.');
    }

    if (!customerPhone) {
      throw new Error('يرجى إدخال رقم هاتف الزبون.');
    }

    for (const item of editingItems) {
      if (!item._editName) {
        throw new Error('يرجى إدخال اسم كل المنتجات.');
      }

      if (
        !Number.isInteger(Number(item._editQuantity)) ||
        Number(item._editQuantity) < 1
      ) {
        throw new Error('كمية المنتج يجب أن تكون واحداً أو أكثر.');
      }

      if (
        !Number.isFinite(Number(item._editPrice)) ||
        Number(item._editPrice) < 0
      ) {
        throw new Error('سعر المنتج غير صحيح.');
      }
    }

    const newItems = editingItems.map(item => {
      const updated = { ...item };

      delete updated._editName;
      delete updated._editQuantity;
      delete updated._editPrice;

      // المحافظة على أسماء المفاتيح الأصلية إن وجدت.
      if ('qty' in updated && !('quantity' in updated)) {
        updated.qty = Number(item._editQuantity);
      } else {
        updated.quantity = Number(item._editQuantity);
      }

      if ('unit_price' in updated && !('price' in updated)) {
        updated.unit_price = Number(item._editPrice);
      } else {
        updated.price = Number(item._editPrice);
      }

      if ('title' in updated && !('name' in updated)) {
        updated.title = item._editName;
      } else {
        updated.name = item._editName;
      }

      return updated;
    });

    const subtotal = newItems.reduce((sum, item) => {
      return sum +
        numberValue(item.quantity ?? item.qty) *
        numberValue(item.price ?? item.unit_price);
    }, 0);

    const oldSubtotal = numberValue(order.subtotal, 0);
    const oldTotal = numberValue(order.total, oldSubtotal);

    const otherAmounts = oldTotal - oldSubtotal;
    const newTotal = Math.max(0, subtotal + otherAmounts);

    const payload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      customer_notes: customerNotes,
      customer_location_url: customerLocation,
      items: newItems,
      subtotal,
      total: newTotal
    };

    button.disabled = true;
    button.textContent = 'جارٍ حفظ التعديلات...';
    message.hidden = true;

    let query = supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId);

    if (!canViewAllBranches()) {
      query = query.eq(
        'branch_id',
        String(currentProfile.branch_id)
      );
    }

    const { data, error } = await query.select('id');

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error(
        'لم يتم حفظ التعديلات. قد لا تملك صلاحية تعديل هذا الطلب.'
      );
    }

    closeEditOrder();

    showMessage(
      'تم حفظ تعديلات الطلب وموقع الزبون بنجاح.'
    );

    await loadOrders();

  } catch (error) {
    console.error('Save edited order error:', error);

    message.textContent =
      error.message || 'حدث خطأ أثناء حفظ التعديلات.';

    message.className = 'edit-order-message error';
    message.hidden = false;

  } finally {
    button.disabled = false;
    button.textContent = 'حفظ التعديلات';
  }
}

// =====================================================
// التحقق من الحساب والصلاحيات
// =====================================================

async function authorizeUser() {
  const {
    data: sessionData,
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  currentUser = sessionData.session?.user;

  if (!currentUser) {
    window.location.href = './login.html';
    return false;
  }

  isServerOwner = SERVER_OWNER_IDS.includes(currentUser.id);

  const {
    data: profile,
    error
  } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,branch_id')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) throw error;

  if (!profile && !isServerOwner) {
    showMessage('لم يتم العثور على بيانات الحساب.', 'error');
    elements.ordersList.innerHTML = '';
    return false;
  }

  const allowedRoles = ['owner', 'manager', 'staff'];

  if (
    !isServerOwner &&
    !allowedRoles.includes(profile?.role)
  ) {
    showMessage(
      'ليس لديك صلاحية الدخول إلى إدارة الطلبات.',
      'error'
    );

    elements.ordersList.innerHTML = '';
    return false;
  }

  currentProfile = profile;

  isOwner = profile?.role === 'owner' && !isServerOwner;

  elements.userRole.textContent =
    isServerOwner ? 'مالك السيرفر' :
    isOwner ? 'صاحب المطعم' :
    profile.role === 'manager' ? 'مدير الفرع' :
    'موظف الفرع';

  if (!canViewAllBranches() && !profile.branch_id) {
    showMessage(
      'حسابك غير مرتبط بفرع. راجع إعدادات الحساب.',
      'error'
    );

    elements.ordersList.innerHTML = '';
    return false;
  }

  return true;
}

// =====================================================
// جلب الطلبات
// =====================================================

async function fetchAllOrders() {
  const pageSize = 1000;

  let from = 0;
  let results = [];

  while (true) {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (!canViewAllBranches()) {
      query = query.eq(
        'branch_id',
        String(currentProfile.branch_id)
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    const page = data || [];

    results = results.concat(page);

    if (page.length < pageSize) break;

    from += pageSize;
  }

  return results;
}

// =====================================================
// تحميل الطلبات والمندوبين
// =====================================================

async function loadOrders() {
  hideMessage();

  elements.refreshButton.disabled = true;

  elements.ordersList.innerHTML = `
    <div class="loading">جارٍ تحميل الطلبات...</div>
  `;

  try {
    allOrders = await fetchAllOrders();

    driversLoadError = null;

    try {
      await fetchDrivers();
    } catch (driverError) {
      console.error('Load drivers error:', driverError);
      driversLoadError = driverError;
      allDrivers = [];
    }

    fillBranchFilter(allOrders);
    updateStatistics(allOrders);
    renderOrders();

    if (driversLoadError) {
      showMessage(
        'تم تحميل الطلبات، لكن تعذر تحميل المندوبين. تحقق من صلاحيات جدول delivery_drivers.',
        'error'
      );
    }

  } catch (error) {
    console.error('Load orders error:', error);

    elements.ordersList.innerHTML = '';

    showMessage(
      error.message ||
      'تعذر تحميل الطلبات. تحقق من صلاحيات قاعدة البيانات والاتصال.',
      'error'
    );

  } finally {
    elements.refreshButton.disabled = false;
  }
}

// =====================================================
// تحديث حالة الطلب
// =====================================================

async function updateOrderStatus(orderId, newStatus, button) {
  if (!Object.hasOwn(STATUS_LABELS, newStatus)) {
    showMessage('حالة الطلب غير صحيحة.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'جارٍ الحفظ...';

  try {
    let query = supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (!canViewAllBranches()) {
      query = query.eq(
        'branch_id',
        String(currentProfile.branch_id)
      );
    }

    const { data, error } = await query.select('id');

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error(
        'لم يتم تحديث الطلب. تحقق من صلاحيات التعديل.'
      );
    }

    showMessage('تم تحديث حالة الطلب بنجاح.');
    await loadOrders();

  } catch (error) {
    console.error('Update status error:', error);

    showMessage(
      error.message || 'حدث خطأ أثناء تحديث الطلب.',
      'error'
    );

  } finally {
    button.disabled = false;
    button.textContent = 'حفظ الحالة';
  }
}

// =====================================================
// إسناد الطلب إلى مندوب
// =====================================================

async function assignOrderDriver(orderId, driverId, button) {
  button.disabled = true;
  button.textContent = 'جارٍ الحفظ...';

  try {
    const order = allOrders.find(item =>
      String(item.id) === String(orderId)
    );

    if (!order) {
      throw new Error('لم يتم العثور على الطلب.');
    }

    if (driverId) {
      const driver = allDrivers.find(item =>
        String(item.id) === String(driverId)
      );

      if (!driver) {
        throw new Error('المندوب المحدد غير موجود.');
      }

      if (!driver.is_active) {
        throw new Error('لا يمكن إسناد الطلب إلى مندوب غير نشط.');
      }

      if (
        String(driver.branch_id) !== String(order.branch_id)
      ) {
        throw new Error('هذا المندوب غير تابع لفرع الطلب.');
      }
    }

    let query = supabase
      .from('orders')
      .update({
        delivery_driver_id: driverId || null
      })
      .eq('id', orderId);

    if (!canViewAllBranches()) {
      query = query.eq(
        'branch_id',
        String(currentProfile.branch_id)
      );
    }

    const { data, error } = await query.select('id,delivery_driver_id');

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error(
        'لم يتم إسناد المندوب. تحقق من صلاحيات تعديل الطلب.'
      );
    }

    showMessage(
      driverId
        ? 'تم إسناد الطلب إلى المندوب بنجاح.'
        : 'تم إلغاء إسناد المندوب من الطلب.'
    );

    await loadOrders();

  } catch (error) {
    console.error('Assign driver error:', error);

    showMessage(
      error.message || 'تعذر إسناد المندوب.',
      'error'
    );

  } finally {
    button.disabled = false;
    button.textContent = 'حفظ المندوب';
  }
}

// =====================================================
// أحداث الصفحة
// =====================================================

function wireEvents() {
  elements.refreshButton.addEventListener('click', loadOrders);

  elements.statusFilter.addEventListener('change', renderOrders);
  elements.branchFilter.addEventListener('change', renderOrders);
  elements.searchInput.addEventListener('input', renderOrders);

  elements.ordersList.addEventListener('click', async event => {
    const card = event.target.closest('.order-card');
    if (!card) return;

    const orderId = card.dataset.orderId;

    const editButton = event.target.closest('.edit-order-button');
    const statusButton = event.target.closest('.save-status-button');
    const driverButton = event.target.closest('.save-driver-button');

    if (editButton) {
      openEditOrder(orderId);
      return;
    }

    if (statusButton) {
      const newStatus =
        card.querySelector('.status-select')?.value;

      if (!newStatus) return;

      await updateOrderStatus(
        orderId,
        newStatus,
        statusButton
      );

      return;
    }

    if (driverButton) {
      const driverId =
        card.querySelector('.driver-select')?.value || '';

      await assignOrderDriver(
        orderId,
        driverId,
        driverButton
      );
    }
  });

  $('#orderEditForm').addEventListener(
    'submit',
    saveEditedOrder
  );

  $('#addOrderItemButton').addEventListener(
    'click',
    addNewEditItem
  );

  $('#editOrderItems').addEventListener('click', event => {
    const removeButton = event.target.closest('[data-remove-item]');
    if (!removeButton) return;

    collectEditItemsFromInputs();

    const index = Number(removeButton.dataset.removeItem);

    if (!Number.isInteger(index)) return;

    editingItems.splice(index, 1);
    renderEditItems();
  });

  $('#editOrderItems').addEventListener('input', event => {
    if (
      event.target.matches(
        '.edit-item-name, .edit-item-quantity, .edit-item-price'
      )
    ) {
      collectEditItemsFromInputs();
      updateEditTotals();
    }
  });

  $('#orderEditModal').addEventListener('click', event => {
    if (event.target.closest('[data-close-edit]')) {
      closeEditOrder();
    }
  });

  document.addEventListener('keydown', event => {
    if (
      event.key === 'Escape' &&
      !$('#orderEditModal').hidden
    ) {
      closeEditOrder();
    }
  });
}

// =====================================================
// تشغيل الصفحة
// =====================================================

async function startOrdersPage() {
  try {
    createEditModal();
    wireEvents();

    const allowed = await authorizeUser();

    if (allowed) {
      await loadOrders();
    }

  } catch (error) {
    console.error('Orders page error:', error);

    showMessage(
      error.message ||
      'حدث خطأ أثناء التحقق من الحساب أو تحميل الصفحة.',
      'error'
    );
  }
}

startOrdersPage();