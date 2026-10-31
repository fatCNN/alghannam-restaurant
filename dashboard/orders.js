import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (selector) => document.querySelector(selector);

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
  delivered: 'تم التوصيل',
  cancelled: 'ملغي'
};

let currentUser = null;
let currentProfile = null;
let allOrders = [];
let isOwner = false;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function showMessage(message, type = 'success') {
  elements.message.textContent = message;
  elements.message.className = `message ${type}`;
  elements.message.hidden = false;
}

function hideMessage() {
  elements.message.hidden = true;
}

function formatDate(value) {
  if (!value) return 'غير محدد';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'غير محدد';

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

function getItemsHTML(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p class="empty-items">لا توجد تفاصيل للمنتجات.</p>';
  }

  return `
    <div class="order-items">
      ${items.map((item) => {
        const name = item.name || item.title || item.product_name || 'منتج';
        const quantity = item.quantity ?? item.qty ?? 1;
        const price = item.price ?? item.unit_price ?? 0;

        return `
          <div class="order-item">
            <span>${escapeHTML(name)} × ${escapeHTML(quantity)}</span>
            <strong>${formatPrice(Number(price) * Number(quantity))}</strong>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function getStatusOptions(selectedStatus) {
  return Object.entries(STATUS_LABELS).map(([value, label]) => `
    <option value="${value}" ${value === selectedStatus ? 'selected' : ''}>
      ${label}
    </option>
  `).join('');
}

function updateStatistics(orders) {
  elements.totalCount.textContent = orders.length;
  elements.newCount.textContent = orders.filter(order => order.status === 'new').length;
  elements.preparingCount.textContent = orders.filter(order => order.status === 'preparing').length;
  elements.readyCount.textContent = orders.filter(order => order.status === 'ready').length;
}

function fillBranchFilter(orders) {
  if (!isOwner) {
    elements.branchFilter.innerHTML = '<option value="">فرعي</option>';
    elements.branchFilter.disabled = true;
    return;
  }

  const selectedValue = elements.branchFilter.value;
  const branches = [...new Set(
    orders.map(order => order.branch_id).filter(Boolean)
  )];

  elements.branchFilter.innerHTML = `
    <option value="">كل الفروع</option>
    ${branches.map(branch => `
      <option value="${escapeHTML(branch)}">${escapeHTML(branch)}</option>
    `).join('')}
  `;

  if (branches.includes(selectedValue)) {
    elements.branchFilter.value = selectedValue;
  }
}

function renderOrders() {
  const status = elements.statusFilter.value;
  const branch = elements.branchFilter.value;
  const search = elements.searchInput.value.trim().toLowerCase();

  const filteredOrders = allOrders.filter(order => {
    const matchesStatus = !status || order.status === status;
    const matchesBranch = !branch || String(order.branch_id) === branch;

    const searchableText = [
      order.order_number,
      order.customer_name,
      order.customer_phone,
      order.customer_address
    ].join(' ').toLowerCase();

    const matchesSearch = !search || searchableText.includes(search);

    return matchesStatus && matchesBranch && matchesSearch;
  });

  if (filteredOrders.length === 0) {
    elements.ordersList.innerHTML = `
      <div class="loading">لا توجد طلبات مطابقة.</div>
    `;
    return;
  }

  elements.ordersList.innerHTML = filteredOrders.map(order => {
    const orderNumber = order.order_number ?? order.id;
    const statusLabel = STATUS_LABELS[order.status] || order.status || 'غير محدد';

    return `
      <article class="order-card" data-order-id="${escapeHTML(order.id)}">
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
          <p><strong>الزبون:</strong> ${escapeHTML(order.customer_name)}</p>
          <p><strong>الهاتف:</strong> ${escapeHTML(order.customer_phone)}</p>
          <p><strong>العنوان:</strong> ${escapeHTML(order.customer_address)}</p>
          ${order.customer_notes ? `
            <p><strong>ملاحظات:</strong> ${escapeHTML(order.customer_notes)}</p>
          ` : ''}
          <p><strong>الفرع:</strong> ${escapeHTML(order.branch_id)}</p>
        </div>

        ${getItemsHTML(order.items)}

        <div class="order-total">
          <span>المجموع قبل الخصم: ${formatPrice(order.subtotal)}</span>
          ${Number(order.discount_amount) > 0 ? `
            <span>الخصم: ${formatPrice(order.discount_amount)}</span>
          ` : ''}
          <strong>الإجمالي: ${formatPrice(order.total)}</strong>
        </div>

        <div class="order-actions">
          <label>
            تحديث حالة الطلب
            <select class="status-select">
              ${getStatusOptions(order.status)}
            </select>
          </label>

          <button class="button save-status-button" type="button">
            حفظ الحالة
          </button>
        </div>
      </article>
    `;
  }).join('');
}

async function authorizeUser() {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  currentUser = sessionData.session?.user;

  if (!currentUser) {
    window.location.href = './login.html';
    return false;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,branch_id')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) throw error;

  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    showMessage('ليس لديك صلاحية الدخول إلى إدارة الطلبات.', 'error');
    elements.ordersList.innerHTML = '';
    return false;
  }

  currentProfile = profile;
  isOwner = profile.role === 'owner';

  elements.userRole.textContent =
    isOwner ? 'المالك' : 'مدير الفرع';

  if (!isOwner && !profile.branch_id) {
    showMessage('حسابك غير مرتبط بفرع. راجع إعدادات الحساب.', 'error');
    return false;
  }

  return true;
}

async function loadOrders() {
  hideMessage();
  elements.ordersList.innerHTML =
    '<div class="loading">جارٍ تحميل الطلبات...</div>';

  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  // المالك يشاهد جميع الفروع، والمدير يشاهد فرعه فقط.
  if (!isOwner) {
    query = query.eq('branch_id', String(currentProfile.branch_id));
  }

  const { data, error } = await query;

  if (error) {
    console.error('Load orders error:', error);
    elements.ordersList.innerHTML = '';
    showMessage('تعذر تحميل الطلبات. تحقق من صلاحيات قاعدة البيانات.', 'error');
    return;
  }

  allOrders = data || [];

  fillBranchFilter(allOrders);
  updateStatistics(allOrders);
  renderOrders();
}

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

    // حماية إضافية للمدير: لا يحدّث إلا طلبات فرعه.
    if (!isOwner) {
      query = query.eq('branch_id', String(currentProfile.branch_id));
    }

    const { data, error } = await query.select('id');

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error('لم يتم تحديث الطلب. تحقق من صلاحيات التعديل.');
    }

    showMessage('تم تحديث حالة الطلب بنجاح.');
    await loadOrders();

  } catch (error) {
    console.error('Update status error:', error);
    showMessage(error.message || 'حدث خطأ أثناء تحديث الطلب.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'حفظ الحالة';
  }
}

elements.refreshButton.addEventListener('click', loadOrders);

elements.statusFilter.addEventListener('change', renderOrders);
elements.branchFilter.addEventListener('change', renderOrders);
elements.searchInput.addEventListener('input', renderOrders);

elements.ordersList.addEventListener('click', async (event) => {
  const button = event.target.closest('.save-status-button');
  if (!button) return;

  const card = button.closest('.order-card');
  const orderId = card?.dataset.orderId;
  const newStatus = card?.querySelector('.status-select')?.value;

  if (!orderId || !newStatus) return;

  await updateOrderStatus(orderId, newStatus, button);
});

async function startOrdersPage() {
  try {
    const allowed = await authorizeUser();

    if (allowed) {
      await loadOrders();
    }
  } catch (error) {
    console.error('Orders page error:', error);
    showMessage('حدث خطأ أثناء التحقق من الحساب أو تحميل الصفحة.', 'error');
  }
}

startOrdersPage();