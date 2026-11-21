import {
  supabaseClient as supabase,
  isSupabaseConfigured as configured
} from './supabase-client.js';

// إشعارات الطلبات الجديدة — مطعم الغنّام
const STORAGE_KEY = 'ghannam_seen_order_notifications_v1';
const CHANNEL_NAME = 'ghannam-orders-notifications';

let audioContext = null;
let audioUnlocked = false;
let realtimeChannel = null;

function getSeenOrders() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function rememberOrder(id) {
  const seen = getSeenOrders();
  if (seen.has(String(id))) return false;
  seen.add(String(id));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen].slice(-300)));
  } catch {}
  return true;
}

function ensureAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return false;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === 'suspended') audioContext.resume();
  audioUnlocked = audioContext.state === 'running';
  return audioUnlocked;
}

function playBell() {
  if (!ensureAudio()) return;
  const now = audioContext.currentTime;
  // نغمتان قصيرتان بصوت جرس هادئ
  [880, 1175].forEach((frequency, index) => {
    const start = now + index * 0.18;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.48);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });
}

function addStyles() {
  if (document.getElementById('ghannam-notification-style')) return;
  const style = document.createElement('style');
  style.id = 'ghannam-notification-style';
  style.textContent = `
    #ghannamNotifyEnable {
      position: fixed; z-index: 1000001; left: 18px; bottom: 18px;
      border: 0; border-radius: 999px; padding: 11px 16px;
      background: #741f1f; color: #fff; font: inherit; font-size: 13px;
      font-weight: 700; box-shadow: 0 5px 22px #0002; cursor: pointer;
    }
    #ghannamNotifyEnable:hover { background: #982929; }
    #ghannamOrderToast {
      position: fixed; z-index: 1000002; top: 18px; left: 18px;
      width: min(360px, calc(100vw - 36px)); box-sizing: border-box;
      background: #fffaf5; color: #351313; border: 1px solid #e8cfc2;
      border-right: 5px solid #b52c20; border-radius: 14px;
      padding: 15px 16px; box-shadow: 0 12px 40px #0003;
      direction: rtl; font-family: inherit; animation: ghannamToastIn .25s ease-out;
    }
    #ghannamOrderToast[hidden] { display: none; }
    #ghannamOrderToast strong { display:block; margin-bottom:5px; color:#741f1f; }
    #ghannamOrderToast span { display:block; font-size:13px; line-height:1.7; }
    #ghannamOrderToast button { margin-top:10px; border:0; background:#741f1f; color:#fff; border-radius:8px; padding:6px 12px; cursor:pointer; font:inherit; }
    @keyframes ghannamToastIn { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
    @media(max-width:480px) {
      #ghannamNotifyEnable { left:12px; bottom:12px; }
      #ghannamOrderToast { top:10px; left:10px; width:calc(100vw - 20px); }
    }
  `;
  document.head.appendChild(style);
}

function ensureUI() {
  addStyles();
  let button = document.getElementById('ghannamNotifyEnable');
  if (!button) {
    button = document.createElement('button');
    button.id = 'ghannamNotifyEnable';
    button.type = 'button';
    document.body.appendChild(button);
  }
  button.textContent = '🔔 تفعيل صوت وتنبيهات الطلبات';
  button.title = 'تفعيل صوت الجرس وإشعارات الطلبات الجديدة';

  let toast = document.getElementById('ghannamOrderToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ghannamOrderToast';
    toast.hidden = true;
    document.body.appendChild(toast);
  }

  button.addEventListener('click', async () => {
    if (audioContext && audioContext.state === 'suspended') {
      try { await audioContext.resume(); } catch {}
    }
    ensureAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    const soundText = audioUnlocked ? 'صوت الجرس مفعّل' : 'قد لا يدعم هذا المتصفح تشغيل الصوت';
    const pushText = !('Notification' in window)
      ? 'إشعارات المتصفح غير مدعومة'
      : Notification.permission === 'granted'
        ? 'إشعارات المتصفح مفعّلة'
        : Notification.permission === 'denied'
          ? 'إشعارات المتصفح محظورة من إعدادات المتصفح'
          : 'لم يتم السماح بإشعارات المتصفح';
    button.textContent = '✓ ' + soundText;
    showToast('تم إعداد التنبيهات', `${soundText}. ${pushText}.`);
    playBell();
  }, { once: true });
}

let toastTimer;
function showToast(title, details) {
  const toast = document.getElementById('ghannamOrderToast');
  if (!toast) return;
  toast.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(details)}</span><button type="button">إغلاق</button>`;
  toast.hidden = false;
  toast.querySelector('button').addEventListener('click', () => { toast.hidden = true; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 9000);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

function notifyNewOrder(order) {
  const id = String(order?.id || '');
  if (!id || !rememberOrder(id)) return;

  const number = order.order_number ?? id.slice(0, 8);
  const customer = order.customer_name || 'زبون جديد';
  const branchNames = {
    grill: 'المشاوي',
    fastfood: 'الوجبات السريعة',
    falafel: 'الفلافل',
    fish: 'أسماك النهرين',
    river_fish: 'أسماك النهرين'
  };
  const branch = branchNames[order.branch_id] || order.branch_id || 'غير محدد';
  const title = `طلب جديد #${number}`;
  const details = `${customer} · الفرع: ${branch}`;

  showToast('🔔 وصل طلب جديد', `${title} — ${details}`);
  playBell();

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body: details,
        icon: '../image/logo.webp',
        badge: '../image/logo.webp',
        tag: `ghannam-order-${id}`,
        renotify: false
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.warn('Browser notification failed:', error);
    }
  }

  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: 'new-order', id, title, details });
    channel.close();
  } catch {}
}

let currentUserId = null;

async function startRealtimeForUser(user) {
  if (!user || currentUserId === user.id || !configured || !supabase) return;

  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  currentUserId = user.id;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,role,branch_id')
    .eq('id', user.id)
    .maybeSingle();

  const serverOwners = [
    '489c60eb-5ae5-4611-96d6-b1d911e2686c',
    '1488410c-39a5-417b-92f6-c68ee55c886d'
  ];

  if (profileError || (!profile && !serverOwners.includes(user.id))) return;
  if (!serverOwners.includes(user.id) &&
      !['owner', 'manager', 'staff'].includes(profile?.role)) return;

  realtimeChannel = supabase
    .channel('ghannam-new-order-alerts')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'orders'
    }, payload => {
      const order = payload.new;
      if (!order) return;
      if (profile?.role === 'staff' && profile.branch_id &&
          String(order.branch_id) !== String(profile.branch_id)) return;
      notifyNewOrder(order);
    })
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('إشعارات الطلبات: تعذر الاتصال بـ Supabase Realtime.');
      }
    });
}

async function start() {
  ensureUI();

  if (!configured || !supabase) {
    console.warn('إشعارات الغنّام: إعداد Supabase غير متاح.');
    return;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (!sessionError && sessionData.session?.user) {
    await startRealtimeForUser(sessionData.session.user);
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      // تأخير بسيط لتجنب تنفيذ استعلامات Supabase داخل auth callback مباشرة.
      setTimeout(() => startRealtimeForUser(session.user), 0);
    } else {
      currentUserId = null;
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    }
  });

  window.addEventListener('beforeunload', () => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  }, { once: true });
}

start().catch(error => console.error('Ghannam notifications:', error));
