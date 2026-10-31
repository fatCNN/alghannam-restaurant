
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const $ = (selector) => document.querySelector(selector);

const configured =
  /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 25 &&
  !SUPABASE_ANON_KEY.includes('YOUR_');

const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const loginPanel = $('#loginPanel');
const accessPanel = $('#accessPanel');
const workspace = $('#workspace');

let staffUser = null;
let staffProfile = null;
let conversations = [];
let latestByConversation = new Map();

let staffDirectory = [];
let branches = [];
let activeConversationId = null;
let activeMessages = [];

let pollHandle = null;
let loadingList = false;
let loadingThread = false;
let toastHandle = null;
let hasLoadedList = false;

const statusLabels = {
  open: 'جديدة',
  waiting_staff: 'بانتظار موظف',
  in_progress: 'قيد المتابعة',
  closed: 'مكتملة'
};

// الأدوار الإدارية
const ADMIN_ROLES = ['server_owner', 'owner', 'manager'];

function isAdmin() {
  return ADMIN_ROLES.includes(staffProfile?.role);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function showToast(text, type = 'success') {
  const t = $('#toast');
  t.textContent = text;
  t.className = `toast ${type}`;
  t.hidden = false;

  clearTimeout(toastHandle);

  toastHandle = setTimeout(() => {
    t.hidden = true;
  }, 4500);
}

function setFormMessage(el, text, type = '') {
  el.textContent = text || '';
  el.className = `status-message ${type}`.trim();
}

function setBusy(button, busy, busyText = 'جارٍ الحفظ...') {
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }

  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.originalText;
}

function formatDate(value) {
  if (!value) return '—';

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('ar-IQ', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
}

function shortConversationId(id) {
  return `محادثة #${String(id).slice(0, 8)}`;
}

function roleLabel(role) {
  return role === 'server_owner'
    ? 'مالك السيرفر'
    : role === 'owner'
      ? 'صاحب المطعم'
      : role === 'manager'
        ? 'قائد الفريق'
        : 'موظف';
}

function showLogin() {
  loginPanel.hidden = false;
  accessPanel.hidden = true;
  workspace.hidden = true;

  $('#staffEmail').textContent = '';
  $('#logoutButton').hidden = true;
}

function showWorkspace() {
  loginPanel.hidden = true;
  accessPanel.hidden = true;
  workspace.hidden = false;

  $('#staffEmail').textContent = staffUser?.email || '';
  $('#staffRoleLabel').textContent = roleLabel(staffProfile?.role);
  $('#logoutButton').hidden = false;
}

// التحقق من صلاحية المستخدم
async function verifyStaff() {
  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    staffUser = null;
    showLogin();
    return false;
  }

  staffUser = userData.user;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id,email,role')
    .eq('id', staffUser.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    !['server_owner', 'owner', 'manager', 'staff'].includes(profile.role)
  ) {
    showLogin();
    accessPanel.hidden = false;
    return false;
  }

  staffProfile = profile;

  showWorkspace();

  return true;
}

async function signIn(event) {
  event.preventDefault();

  if (!supabase) {
    setFormMessage(
      $('#loginMessage'),
      'إعدادات Supabase غير مكتملة في supabase-config.js.',
      'error'
    );
    return;
  }

  const button = $('#loginForm button[type="submit"]');

  setBusy(button, true, 'جارٍ التحقق...');
  setFormMessage($('#loginMessage'), '');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: $('#loginEmail').value.trim(),
    password: $('#loginPassword').value
  });

  setBusy(button, false);

  if (error) {
    setFormMessage(
      $('#loginMessage'),
      `تعذر تسجيل الدخول: ${error.message}`,
      'error'
    );
    return;
  }

  staffUser = data.user;

  if (await verifyStaff()) {
    await startWorkspace();
  }
}

// تحميل الفروع والموظفين
async function loadReferenceData() {
  const [
    { data: branchRows, error: branchError },
    { data: staffRows, error: staffError }
  ] = await Promise.all([
    supabase
      .from('branches')
      .select('id,name')
      .eq('is_active', true)
      .order('sort_order'),

    supabase.rpc('laila_list_staff')
  ]);

  if (branchError) throw branchError;
  if (staffError) throw staffError;

  branches = branchRows || [];
  staffDirectory = staffRows || [];

  $('#branchFilter').innerHTML =
    '<option value="all">كل الفروع</option>' +
    branches.map(b =>
      `<option value="${escapeHTML(b.id)}">${escapeHTML(b.name)}</option>`
    ).join('');

  renderAssigneeControls();
}

// إعداد صلاحيات إسناد المحادثات
function renderAssigneeControls() {
  const current = $('#assigneeSelect').value;
  const canAssign = isAdmin();

  const rows = staffDirectory.map(s =>
    `<option value="${escapeHTML(s.id)}">${
      canAssign
        ? escapeHTML(s.email || s.id)
        : 'استلام المحادثة لنفسي'
    } — ${roleLabel(s.role)}</option>`
  ).join('');

  $('#assigneeSelect').innerHTML =
    `<option value="">${canAssign ? 'غير مسندة' : 'تحرير إسنادي (عند الحاجة)'}</option>${rows}`;

  $('#assigneeSelect').disabled = false;

  if (current) {
    $('#assigneeSelect').value = current;
  }

  const filter = $('#assigneeFilter').value;

  $('#assigneeFilter').innerHTML =
    `<option value="all">كل الموظفين</option>
     <option value="unassigned">غير مسندة</option>
     <option value="mine">المسندة إليّ</option>${rows}`;

  if (filter) {
    $('#assigneeFilter').value = filter;
  }
}

function notifyIncoming(item, message) {
  const visitorName =
    item.visitor_name || shortConversationId(item.id);

  showToast(
    `رسالة جديدة من ${visitorName}: ${String(message.content || '').slice(0, 90)}`,
    'success'
  );

  if (
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification('رسالة جديدة — ليلى', {
        body: `${visitorName}: ${String(message.content || '').slice(0, 110)}`,
        tag: `laila-${item.id}`,
        renotify: false
      });
    } catch {}
  }
}

// تحميل قائمة المحادثات
async function loadConversationList({ notify = false } = {}) {
  if (!supabase || loadingList) return;

  loadingList = true;

  try {
    const { data, error } = await supabase
      .from('laila_conversations')
      .select(
        'id,visitor_name,visitor_phone,branch_id,status,needs_staff,assigned_to,last_message_at,created_at,branches(name)'
      )
      .order('last_message_at', { ascending: false })
      .limit(300);

    if (error) throw error;

    const previous = latestByConversation;
    const nextConversations = data || [];
    const ids = nextConversations.map(x => x.id);
    const nextLatest = new Map();

    if (ids.length) {
      const {
        data: msgs,
        error: msgError
      } = await supabase
        .from('laila_messages')
        .select('id,conversation_id,content,sender_role,created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(Math.min(1500, ids.length * 8));

      if (msgError) throw msgError;

      for (const msg of msgs || []) {
        if (!nextLatest.has(msg.conversation_id)) {
          nextLatest.set(msg.conversation_id, msg);
        }
      }
    }

    if (notify && hasLoadedList) {
      for (const item of nextConversations) {
        const latest = nextLatest.get(item.id);
        const old = previous.get(item.id);

        if (
          latest?.sender_role === 'visitor' &&
          latest.id !== old?.id
        ) {
          notifyIncoming(item, latest);
        }
      }
    }

    conversations = nextConversations;
    latestByConversation = nextLatest;

    renderConversationList();
    updateCounts();

    hasLoadedList = true;

    if (activeConversationId) {
      const active = conversations.find(
        x => x.id === activeConversationId
      );

      if (active) {
        syncThreadHeader(active);
      }
    }
  } catch (error) {
    showToast(
      `تعذر تحميل المحادثات: ${error.message}`,
      'error'
    );

    $('#conversationList').innerHTML =
      '<div class="empty-state">تعذر تحميل المحادثات. تأكد من تشغيل ترقية SQL والصلاحيات.</div>';
  } finally {
    loadingList = false;
  }
}

function renderConversationList() {
  const query = $('#conversationSearch').value
    .trim()
    .toLocaleLowerCase('ar');

  const status = $('#statusFilter').value;
  const branch = $('#branchFilter').value;
  const assignee = $('#assigneeFilter').value;

  const shown = conversations.filter(item => {
    if (status !== 'all' && item.status !== status) return false;

    if (branch !== 'all' && item.branch_id !== branch) return false;

    if (assignee === 'unassigned' && item.assigned_to) return false;

    if (assignee === 'mine' && item.assigned_to !== staffUser?.id) {
      return false;
    }

    if (
      assignee !== 'all' &&
      assignee !== 'unassigned' &&
      assignee !== 'mine' &&
      item.assigned_to !== assignee
    ) {
      return false;
    }

    const last = latestByConversation.get(item.id);
    const assigned = staffDirectory.find(
      s => s.id === item.assigned_to
    );

    const searchable = [
      item.visitor_name,
      item.visitor_phone,
      item.id,
      last?.content,
      item.branches?.name,
      assigned?.email
    ].join(' ').toLocaleLowerCase('ar');

    return !query || searchable.includes(query);
  });

  if (!shown.length) {
    $('#conversationList').innerHTML =
      '<div class="empty-state">ماكو محادثات مطابقة حاليًا.</div>';
    return;
  }

  $('#conversationList').innerHTML = shown.map(item => {
    const last = latestByConversation.get(item.id);

    const name =
      item.visitor_name || shortConversationId(item.id);

    const preview = last?.content || 'بدأت المحادثة';

    const assigned = staffDirectory.find(
      s => s.id === item.assigned_to
    );

    const unassignedLabel = item.assigned_to
      ? assigned?.email || 'موظف مسند'
      : 'غير مسندة';

    return `
      <button
        type="button"
        class="conversation-item ${activeConversationId === item.id ? 'active' : ''}"
        data-open-conversation="${escapeHTML(item.id)}"
      >
        <span class="conversation-item-top">
          <strong>${escapeHTML(name)}</strong>
          <span class="status-pill status-${escapeHTML(item.status)}">
            ${escapeHTML(statusLabels[item.status] || item.status)}
          </span>
        </span>

        <span class="conversation-preview">
          ${escapeHTML(preview)}
        </span>

        <span class="conversation-item-meta">
          <span>
            ${escapeHTML(item.branches?.name || 'لم يحدد الفرع')}
            · ${escapeHTML(unassignedLabel)}
          </span>

          <span>
            ${escapeHTML(formatDate(last?.created_at || item.created_at))}
          </span>
        </span>
      </button>
    `;
  }).join('');
}

function updateCounts() {
  $('#totalCount').textContent = conversations.length;

  $('#waitingCount').textContent =
    conversations.filter(x => x.status === 'waiting_staff').length;

  $('#activeCount').textContent =
    conversations.filter(x => x.status === 'in_progress').length;

  $('#unassignedCount').textContent =
    conversations.filter(x => !x.assigned_to && x.status !== 'closed').length;
}

function syncThreadHeader(item) {
  $('#threadTitle').textContent =
    item.visitor_name || shortConversationId(item.id);

  $('#threadMeta').textContent = [
    item.visitor_phone,
    item.branches?.name || item.branch_id || 'لم يحدد الفرع',
    `بدأت: ${formatDate(item.created_at)}`
  ].filter(Boolean).join(' • ');

  $('#threadStatus').value = item.status;
  $('#assigneeSelect').value = item.assigned_to || '';
}

async function openConversation(id) {
  activeConversationId = id;

  const item = conversations.find(x => x.id === id);

  if (!item) return;

  $('#threadEmpty').hidden = true;
  $('#threadArea').hidden = false;

  syncThreadHeader(item);
  renderConversationList();

  await loadThreadMessages();
}

// تحميل رسائل المحادثة
async function loadThreadMessages() {
  if (!activeConversationId || loadingThread) return;

  loadingThread = true;

  try {
    const { data, error } = await supabase
      .from('laila_messages')
      .select('*')
      .eq('conversation_id', activeConversationId)
      .order('created_at', { ascending: true })
      .limit(1500);

    if (error) throw error;

    activeMessages = data || [];

    const box = $('#threadMessages');

    const nearBottom =
      box.scrollHeight - box.scrollTop - box.clientHeight < 70;

    box.innerHTML = activeMessages.map(msg => {
      const cls =
        msg.sender_role === 'visitor'
          ? 'visitor'
          : msg.sender_role === 'staff'
            ? 'staff'
            : 'assistant';

      const label =
        msg.sender_role === 'visitor'
          ? 'الزبون'
          : msg.sender_role === 'staff'
            ? msg.sender_name || 'الموظف'
            : 'ليلى';

      return `
        <div class="thread-message ${cls}">
          <strong>${escapeHTML(label)}</strong>
          <div>${escapeHTML(msg.content)}</div>
          <small>${escapeHTML(formatDate(msg.created_at))}</small>
        </div>
      `;
    }).join('') ||
      '<div class="empty-state">لا توجد رسائل في هذه المحادثة.</div>';

    if (nearBottom || activeMessages.length <= 1) {
      box.scrollTop = box.scrollHeight;
    }
  } catch (error) {
    setFormMessage(
      $('#threadMessage'),
      `تعذر تحميل الرسائل: ${error.message}`,
      'error'
    );
  } finally {
    loadingThread = false;
  }
}

async function sendStaffReply(event) {
  event.preventDefault();

  const content = $('#replyText').value.trim();

  if (!activeConversationId || !content) return;

  const button = $('#replyForm button[type="submit"]');

  setBusy(button, true, 'جارٍ إرسال الرد...');
  setFormMessage($('#threadMessage'), '');

  try {
    const { error: insertError } = await supabase
      .from('laila_messages')
      .insert({
        conversation_id: activeConversationId,
        sender_role: 'staff',
        sender_name: staffUser?.email || 'موظف مطعم الغنّام',
        content
      });

    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from('laila_conversations')
      .update({
        status: 'in_progress',
        needs_staff: false,
        assigned_to: staffUser.id,
        last_message_at: new Date().toISOString()
      })
      .eq('id', activeConversationId);

    if (updateError) throw updateError;

    $('#replyText').value = '';

    setFormMessage(
      $('#threadMessage'),
      'تم إرسال الرد وحفظه في سجل المحادثة.',
      'success'
    );

    await loadThreadMessages();
    await loadConversationList();
  } catch (error) {
    setFormMessage(
      $('#threadMessage'),
      `تعذر إرسال الرد: ${error.message}`,
      'error'
    );
  } finally {
    setBusy(button, false);
  }
}

// إسناد المحادثات
async function assignConversation() {
  if (!activeConversationId) return;

  const target = $('#assigneeSelect').value || null;
  const button = $('#assigneeSelect');

  button.disabled = true;

  try {
    const { error } = await supabase.rpc(
      'laila_assign_conversation',
      {
        p_conversation_id: activeConversationId,
        p_assigned_to: target
      }
    );

    if (error) throw error;

    await loadConversationList();

    showToast(
      target
        ? 'تم إسناد المحادثة إلى الموظف.'
        : 'تم إلغاء إسناد المحادثة.'
    );
  } catch (error) {
    showToast(
      `تعذر إسناد المحادثة: ${error.message}`,
      'error'
    );

    const item = conversations.find(
      x => x.id === activeConversationId
    );

    if (item) {
      $('#assigneeSelect').value = item.assigned_to || '';
    }
  } finally {
    button.disabled = staffProfile?.role === 'staff';
  }
}

async function updateConversationStatus() {
  if (!activeConversationId) return;

  const status = $('#threadStatus').value;

  const activeItem = conversations.find(
    x => x.id === activeConversationId
  );

  if (
    staffProfile?.role === 'staff' &&
    activeItem?.assigned_to &&
    activeItem.assigned_to !== staffUser.id
  ) {
    showToast('هذه المحادثة مسندة إلى موظف آخر.', 'error');

    $('#threadStatus').value = activeItem.status;
    return;
  }

  const { error } = await supabase
    .from('laila_conversations')
    .update({
      status,
      needs_staff: status === 'waiting_staff',
      ...(status === 'in_progress'
        ? { assigned_to: staffUser.id }
        : {})
    })
    .eq('id', activeConversationId);

  if (error) {
    showToast(`تعذر تغيير الحالة: ${error.message}`, 'error');
    return;
  }

  await loadConversationList();

  showToast('تم تحديث حالة المحادثة.');
}

// إحصائيات الفريق
async function loadTeamStats() {
  if (!isAdmin()) {
    setFormMessage(
      $('#teamStatsMessage'),
      'متابعة أداء الفريق متاحة للإدارة فقط.',
      'error'
    );
    return;
  }

  setFormMessage(
    $('#teamStatsMessage'),
    'جارٍ تحميل الإحصائيات...'
  );

  try {
    const { data, error } = await supabase.rpc(
      'laila_get_team_stats',
      { p_days: 30 }
    );

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];

    $('#teamStatsBody').innerHTML = rows.length
      ? rows.map(row => `
          <tr>
            <td>${escapeHTML(row.email || 'موظف')}</td>
            <td>${Number(row.assigned_count || 0)}</td>
            <td>${Number(row.reply_count || 0)}</td>
            <td>${Number(row.closed_count || 0)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" class="empty-state">لا توجد بيانات للفريق خلال آخر 30 يومًا.</td></tr>';

    setFormMessage(
      $('#teamStatsMessage'),
      'الإحصائيات لآخر 30 يومًا.',
      'success'
    );
  } catch (error) {
    setFormMessage(
      $('#teamStatsMessage'),
      `تعذر تحميل إحصائيات الفريق: ${error.message}`,
      'error'
    );
  }
}

// إعدادات ليلى
async function loadSettings() {
  const { data, error } = await supabase
    .from('laila_settings')
    .select('*')
    .eq('id', true)
    .single();

  if (error) throw error;

  $('#assistantName').value = data.assistant_name || 'ليلى';
  $('#welcomeMessage').value = data.welcome_message || '';
  $('#workingHours').value = data.working_hours_text || '';
  $('#fallbackMessage').value = data.fallback_message || '';
  $('#assistantEnabled').checked = Boolean(data.assistant_enabled);
}

async function saveSettings(event) {
  event.preventDefault();

  const button = $('#saveSettingsButton');

  setBusy(button, true);
  setFormMessage($('#settingsMessage'), '');

  try {
    const payload = {
      assistant_name: $('#assistantName').value.trim(),
      welcome_message: $('#welcomeMessage').value.trim(),
      working_hours_text: $('#workingHours').value.trim(),
      fallback_message: $('#fallbackMessage').value.trim(),
      assistant_enabled: $('#assistantEnabled').checked
    };

    if (
      !payload.assistant_name ||
      !payload.welcome_message ||
      !payload.working_hours_text ||
      !payload.fallback_message
    ) {
      throw new Error('املأ جميع الحقول المطلوبة.');
    }

    const { error } = await supabase
      .from('laila_settings')
      .update(payload)
      .eq('id', true);

    if (error) throw error;

    setFormMessage(
      $('#settingsMessage'),
      'تم حفظ إعدادات ليلى بنجاح.',
      'success'
    );

    showToast('تم تحديث إعدادات ليلى.');
  } catch (error) {
    setFormMessage(
      $('#settingsMessage'),
      `تعذر حفظ الإعدادات: ${error.message}`,
      'error'
    );
  } finally {
    setBusy(button, false);
  }
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    showToast(
      'هذا المتصفح لا يدعم إشعارات سطح المكتب.',
      'error'
    );
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      showToast('تم تفعيل إشعارات الرسائل الجديدة.');
      $('#notificationButton').textContent = 'التنبيهات مفعّلة';
    } else {
      showToast(
        'لم يتم السماح بالإشعارات. ستبقى التنبيهات داخل اللوحة.',
        'error'
      );
    }
  } catch (error) {
    showToast(
      `تعذر تفعيل الإشعارات: ${error.message}`,
      'error'
    );
  }
}

// التنقل بين تبويبات لوحة التحكم
function wireTabs() {
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(tab => {
        tab.classList.toggle('active', tab === button);
      });

      const selected = button.dataset.tab;

      $('#inboxTab').hidden = selected !== 'inbox';
      $('#teamTab').hidden = selected !== 'team';
      $('#settingsTab').hidden = selected !== 'settings';

      if (selected === 'team') {
        void loadTeamStats();
      }

      if (selected === 'settings') {
        loadSettings().catch(error =>
          setFormMessage(
            $('#settingsMessage'),
            `تعذر تحميل إعدادات ليلى: ${error.message}`,
            'error'
          )
        );
      }
    });
  });
}

// تشغيل مساحة العمل
async function startWorkspace() {
  if (!supabase || !await verifyStaff()) return;

  try {
    await loadReferenceData();
  } catch (error) {
    showToast(
      `تعذر تحميل بيانات الموظفين والفروع: ${error.message}`,
      'error'
    );
  }

  // إخفاء تبويب الفريق عن الموظف العادي فقط
  $('#teamTabButton').hidden = staffProfile?.role === 'staff';

  await Promise.all([
    loadConversationList(),
    loadSettings().catch(error =>
      setFormMessage(
        $('#settingsMessage'),
        `تعذر تحميل إعدادات ليلى: ${error.message}`,
        'error'
      )
    )
  ]);

  if (pollHandle) {
    clearInterval(pollHandle);
  }

  pollHandle = setInterval(async () => {
    await loadConversationList({ notify: true });

    if (activeConversationId) {
      await loadThreadMessages();
    }
  }, 15000);

  if (
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    $('#notificationButton').textContent = 'التنبيهات مفعّلة';
  }
}

function wireEvents() {
  $('#loginForm').addEventListener('submit', signIn);

  $('#conversationList').addEventListener('click', event => {
    const button = event.target.closest('[data-open-conversation]');

    if (button) {
      void openConversation(button.dataset.openConversation);
    }
  });

  [
    'conversationSearch',
    'statusFilter',
    'branchFilter',
    'assigneeFilter'
  ].forEach(id => {
    $('#' + id).addEventListener(
      id === 'conversationSearch' ? 'input' : 'change',
      renderConversationList
    );
  });

  $('#refreshButton').addEventListener('click', async () => {
    await loadConversationList();

    if (activeConversationId) {
      await loadThreadMessages();
    }

    showToast('تم تحديث المحادثات.');
  });

  $('#refreshTeamButton').addEventListener(
    'click',
    loadTeamStats
  );

  $('#replyForm').addEventListener('submit', sendStaffReply);

  $('#threadStatus').addEventListener(
    'change',
    updateConversationStatus
  );

  $('#assigneeSelect').addEventListener(
    'change',
    assignConversation
  );

  $('#settingsForm').addEventListener(
    'submit',
    saveSettings
  );

  $('#notificationButton').addEventListener(
    'click',
    enableNotifications
  );

  $('#logoutButton').addEventListener('click', async () => {
    await supabase?.auth.signOut();

    if (pollHandle) {
      clearInterval(pollHandle);
    }

    staffUser = null;
    staffProfile = null;

    showLogin();
  });

  wireTabs();
}

async function boot() {
  wireEvents();

  if (!configured) {
    showLogin();

    setFormMessage(
      $('#loginMessage'),
      'إعدادات Supabase غير مكتملة في dashboard/supabase-config.js.',
      'error'
    );

    return;
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    await startWorkspace();
  } else {
    showLogin();
  }

  supabase.auth.onAuthStateChange((_event, sessionNow) => {
    if (!sessionNow) {
      if (pollHandle) {
        clearInterval(pollHandle);
      }

      staffUser = null;
      staffProfile = null;

      showLogin();
    }
  });
}

boot().catch(error => {
  console.error(error);

  showToast(
    `حدث خطأ أثناء تشغيل صندوق ليلى: ${error.message}`,
    'error'
  );
});
