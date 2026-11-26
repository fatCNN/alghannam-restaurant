import {
  supabaseClient as supabase,
  isSupabaseConfigured as configured
} from './supabase-client.js';

// مطعم الغنّام — تتبع التوصيل باستخدام Leaflet + OpenStreetMap
// لا يحتاج Google Maps API key أو Google Cloud Billing.

const $ = selector => document.querySelector(selector);
const els = {
  role: $('#userRole'), message: $('#message'), refresh: $('#refreshButton'),
  branch: $('#branchFilter'), order: $('#orderFilter'), driver: $('#driverFilter'),
  driversCount: $('#driversCount'), onlineCount: $('#onlineCount'),
  activeCount: $('#activeOrdersCount'), driversLabel: $('#driversLabel'),
  ordersLabel: $('#ordersLabel'), driversList: $('#driversList'),
  ordersList: $('#ordersList'), details: $('#selectedDetails'),
  routeLink: $('#openRouteLink'), mapHint: $('#mapHint'), mapLabel: $('.map-label')
};

const SERVER_OWNER_IDS = [
  '489c60eb-5ae5-4611-96d6-b1d911e2686c',
  '1488410c-39a5-417b-92f6-c68ee55c886d'
];
const STALE_AFTER_MS = 120_000;
const REFRESH_INTERVAL_MS = 15_000;
const DEFAULT_BRANCHES = {
  grill: { id: 'grill', name: 'فرع المشاوي', latitude: 33.2541313, longitude: 44.3858693 },
  fastfood: { id: 'fastfood', name: 'فرع الوجبات السريعة', latitude: 33.2543165, longitude: 44.3851212 },
  falafel: { id: 'falafel', name: 'فرع الفلافل', latitude: 33.2336959, longitude: 44.3306199 }
};

let user = null, profile = null, isOwner = false, isServerOwner = false;
let branches = [], drivers = [], orders = [], trackingRows = [];
let map = null, routeLayer = null, customerMarker = null;
const branchMarkers = new Map(), driverMarkers = new Map();
let selectedOrderId = '', selectedDriverId = '', realtimeChannel = null;
let routeRequestId = 0, lastRouteKey = '', lastRouteAt = 0, lastRouteOrderId = '', lastRouteHtml = '', refreshTimer = null;
let customerDestinationCache = new Map();

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[c]));
const valid = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const coords = (lat, lng) => valid(lat) && valid(lng) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180
  ? [Number(lat), Number(lng)] : null;
const canViewAll = () => isOwner || isServerOwner;
const fresh = row => !!row?.last_seen_at && Date.now() - new Date(row.last_seen_at).getTime() <= STALE_AFTER_MS;
const branchName = id => branches.find(b => String(b.id) === String(id))?.name || DEFAULT_BRANCHES[id]?.name || id || 'غير محدد';
const activeTrackingForDriver = id => trackingRows.filter(t => String(t.driver_id) === String(id) && t.status === 'active')
  .sort((a,b) => new Date(b.last_seen_at || 0) - new Date(a.last_seen_at || 0))[0];
const orderForTracking = row => orders.find(o => String(o.id) === String(row?.order_id));
const selectedOrder = () => orders.find(o => String(o.id) === String(selectedOrderId));
const selectedTracking = () => {
  const order = selectedOrder();
  if (!order || order.status === 'delivered') return null;
  return trackingRows.find(t => String(t.order_id) === String(selectedOrderId) && t.status === 'active');
};
const driverForOrder = order => drivers.find(d => String(d.id) === String(order?.delivery_driver_id));
const formatDate = value => value ? new Date(value).toLocaleString('ar-IQ') : 'لم يصل موقع بعد';

function showMessage(message, error = false) {
  els.message.textContent = message;
  els.message.className = `message${error ? ' error' : ''}`;
  els.message.hidden = false;
}
function hideMessage() { els.message.hidden = true; }
function googleMapsUrl(origin, destination) {
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
function googleMapsPlaceUrl(destination) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

async function authorize() {
  if (!configured || !supabase) throw new Error('إعدادات Supabase غير مكتملة.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  user = sessionData.session?.user;
  if (!user) { location.href = './login.html'; return false; }
  isServerOwner = SERVER_OWNER_IDS.includes(user.id);
  const { data, error } = await supabase.from('profiles')
    .select('id,role,branch_id,full_name').eq('id', user.id).maybeSingle();
  if (error) throw error;
  profile = data;
  if (!isServerOwner && !['owner','manager','staff'].includes(profile?.role)) {
    throw new Error('ليس لديك صلاحية الدخول إلى تتبع الطلبات.');
  }
  isOwner = profile?.role === 'owner' && !isServerOwner;
  if (!canViewAll() && !profile?.branch_id) throw new Error('حسابك غير مرتبط بفرع.');
  els.role.textContent = isServerOwner ? 'مالك السيرفر' : isOwner ? 'صاحب المطعم' : profile.role === 'manager' ? 'مدير الفرع' : 'موظف الفرع';
  return true;
}

function initMap() {
  if (!window.L) throw new Error('تعذر تحميل مكتبة Leaflet. تحققي من اتصال الإنترنت.');
  map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([33.2541313, 44.3858693], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(map);
  routeLayer = L.geoJSON(null, { style: { color: '#8b1e16', weight: 6, opacity: .88 } }).addTo(map);
  if (els.mapLabel) els.mapLabel.textContent = 'OpenStreetMap';
  setTimeout(() => map.invalidateSize(), 100);
}

async function loadData() {
  const branchQuery = supabase.from('branches').select('id,name,latitude,longitude,is_active,sort_order').eq('is_active', true).order('sort_order');
  const driverQuery = supabase.from('delivery_drivers').select('id,branch_id,full_name,phone,is_active').order('full_name');
  let orderQuery = supabase.from('orders')
    .select('id,order_number,branch_id,customer_name,customer_phone,customer_address,customer_location_url,status,delivery_driver_id,created_at')
    .in('status', ['out_for_delivery', 'delivered']).order('created_at', { ascending: false });
  if (!canViewAll()) orderQuery = orderQuery.eq('branch_id', String(profile.branch_id));
  const [b,d,o,t] = await Promise.all([
    branchQuery, driverQuery, orderQuery,
    supabase.from('delivery_tracking').select('id,order_id,driver_id,branch_id,latitude,longitude,accuracy,heading,speed,last_seen_at,status,started_at,ended_at').eq('status','active')
  ]);
  for (const result of [b,d,o,t]) if (result.error) throw result.error;
  const dbBranches = (b.data || []).map(row => {
    const fallback = DEFAULT_BRANCHES[row.id] || {};
    return { ...fallback, ...row,
      latitude: valid(row.latitude) ? Number(row.latitude) : fallback.latitude,
      longitude: valid(row.longitude) ? Number(row.longitude) : fallback.longitude };
  });
  for (const fallback of Object.values(DEFAULT_BRANCHES)) {
    if (!dbBranches.some(row => row.id === fallback.id)) dbBranches.push({ ...fallback, is_active: true });
  }
  branches = dbBranches.filter(x => canViewAll() || String(x.id) === String(profile.branch_id));
  drivers = (d.data || []).filter(x => canViewAll() || String(x.branch_id) === String(profile.branch_id));
  orders = o.data || [];
  trackingRows = (t.data || []).filter(x => canViewAll() || String(x.branch_id) === String(profile.branch_id));
  if (selectedOrderId && !orders.some(o => String(o.id) === selectedOrderId)) selectedOrderId = '';
  if (selectedDriverId && !drivers.some(d => String(d.id) === selectedDriverId)) selectedDriverId = '';
  renderFilters(); renderLists(); updateStats(); renderMarkers();
  if (!selectedOrderId && orders.length) selectedOrderId = String(orders[0].id);
  syncSelections();
}

function renderFilters() {
  const branchValue = els.branch.value;
  els.branch.innerHTML = '<option value="">كل الفروع</option>' + branches.map(b => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
  if (branches.some(b => String(b.id) === branchValue)) els.branch.value = branchValue;
  const visibleOrders = getVisibleOrders();
  els.order.innerHTML = '<option value="">اختر طلباً لعرض مساره</option>' + visibleOrders.map(o => `<option value="${esc(o.id)}">طلب ${esc(o.order_number ?? o.id)} — ${esc(o.customer_name)}</option>`).join('');
  if (visibleOrders.some(o => String(o.id) === selectedOrderId)) els.order.value = selectedOrderId;
  const visibleDrivers = getVisibleDrivers();
  els.driver.innerHTML = '<option value="">كل المندوبين</option>' + visibleDrivers.map(d => `<option value="${esc(d.id)}">${esc(d.full_name)} — ${esc(branchName(d.branch_id))}</option>`).join('');
  if (visibleDrivers.some(d => String(d.id) === selectedDriverId)) els.driver.value = selectedDriverId;
}
function getVisibleOrders() { return orders.filter(o => !els.branch.value || String(o.branch_id) === els.branch.value); }
function getVisibleDrivers() { return drivers.filter(d => !els.branch.value || String(d.branch_id) === els.branch.value); }
function updateStats() {
  const active = drivers.filter(d => d.is_active);
  els.driversCount.textContent = active.length;
  els.onlineCount.textContent = active.filter(d => fresh(activeTrackingForDriver(d.id))).length;
  els.activeCount.textContent = orders.filter(o => o.status === 'out_for_delivery').length;
  els.driversLabel.textContent = drivers.length;
  els.ordersLabel.textContent = orders.filter(o => !o.delivery_driver_id).length;
}
function renderLists() {
  const shownDrivers = getVisibleDrivers();
  const shownOrders = getVisibleOrders();

  els.driversList.innerHTML = shownDrivers.length ? shownDrivers.map(d => {
    const tr = activeTrackingForDriver(d.id);
    const online = fresh(tr);
    const assigned = shownOrders.filter(o =>
      String(o.delivery_driver_id) === String(d.id)
    );

    return `
      <article class="driver-card">
        <button type="button"
          class="driver-card-head ${String(selectedDriverId) === String(d.id) ? 'active' : ''}"
          data-driver="${esc(d.id)}">
          <span class="row-main">
            <strong>${esc(d.full_name)}</strong>
            <small>${esc(branchName(d.branch_id))} · ${assigned.length} طلب</small>
          </span>
          <span class="status-chip ${online ? 'online' : 'offline'}">
            ${online ? 'متصل' : 'لا يوجد تحديث GPS حديث'}
          </span>
        </button>
        <div class="driver-orders">
          ${assigned.length ? assigned.map(o => `
            <button type="button"
              class="driver-order ${String(selectedOrderId) === String(o.id) ? 'active' : ''}"
              data-order="${esc(o.id)}">
              <span class="driver-order-main">
                <strong>طلب ${esc(o.order_number ?? o.id)}</strong>
                <small>${esc(o.customer_name || 'زبون غير محدد')}</small>
              </span>
              <span class="status-chip ${o.status === 'delivered' ? 'delivered' : 'in-delivery'}">
                ${o.status === 'delivered' ? 'تم التوصيل' : 'قيد التوصيل'}
              </span>
            </button>
          `).join('') : '<div class="driver-empty">لا توجد طلبات مسندة لهذا المندوب حالياً.</div>'}
        </div>
      </article>
    `;
  }).join('') : '<p class="empty">لا يوجد مندوبون في هذا الفرع.</p>';

  const unassignedOrders = shownOrders.filter(o => !o.delivery_driver_id);
  els.ordersLabel.textContent = unassignedOrders.length;

  els.ordersList.innerHTML = unassignedOrders.length ? unassignedOrders.map(o => `
    <button type="button"
      class="order-row ${String(selectedOrderId) === String(o.id) ? 'active' : ''}"
      data-order="${esc(o.id)}">
      <span class="row-main">
        <strong>طلب ${esc(o.order_number ?? o.id)} · ${esc(o.customer_name)}</strong>
        <small>${esc(branchName(o.branch_id))}</small>
      </span>
      <span class="status-chip ${o.status === 'delivered' ? 'delivered' : 'in-delivery'}">
        ${o.status === 'delivered' ? 'تم التوصيل' : 'قيد التوصيل'}
      </span>
    </button>
  `).join('') : '<p class="empty">لا توجد طلبات غير مسندة حالياً.</p>';
}

function iconMarker(kind, color) {
  return L.divIcon({ className: `leaflet-${kind}-marker`, html: `<span style="background:${color}">${kind === 'branch' ? 'ف' : kind === 'driver' ? 'م' : 'ز'}</span>`, iconSize: [34,34], iconAnchor: [17,17] });
}
function renderMarkers() {
  if (!map) return;
  const shownBranches = branches.filter(b => !els.branch.value || String(b.id) === els.branch.value);
  const visibleBranchIds = new Set(shownBranches.map(b => String(b.id)));
  for (const [id, marker] of branchMarkers) if (!visibleBranchIds.has(id)) { map.removeLayer(marker); branchMarkers.delete(id); }
  shownBranches.forEach(b => {
    const p = coords(b.latitude,b.longitude); if (!p) return;
    let marker = branchMarkers.get(String(b.id));
    if (!marker) { marker = L.marker(p,{icon:iconMarker('branch','#8b1e16')}).addTo(map).bindPopup(`<b>${esc(b.name)}</b><br>نقطة انطلاق التوصيل`); branchMarkers.set(String(b.id),marker); }
    else marker.setLatLng(p);
  });
  const shownDrivers = getVisibleDrivers(), visibleDriverIds = new Set(shownDrivers.map(d => String(d.id)));
  for (const [id, marker] of driverMarkers) if (!visibleDriverIds.has(id)) { map.removeLayer(marker); driverMarkers.delete(id); }
  shownDrivers.forEach(d => {
    const tr = activeTrackingForDriver(d.id), p = tr && coords(tr.latitude,tr.longitude);
    if (!p) { const old = driverMarkers.get(String(d.id)); if (old) { map.removeLayer(old); driverMarkers.delete(String(d.id)); } return; }
    const color = fresh(tr) ? '#1677b8' : '#858585';
    const popup = `<b>${esc(d.full_name)}</b><br>${esc(branchName(d.branch_id))}<br>${fresh(tr)?'متصل':'آخر موقع معروف'}<br>آخر تحديث: ${esc(formatDate(tr.last_seen_at))}`;
    let marker = driverMarkers.get(String(d.id));
    if (!marker) { marker = L.marker(p,{icon:iconMarker('driver',color)}).addTo(map).bindPopup(popup); marker.on('click', () => selectDriver(d.id)); driverMarkers.set(String(d.id),marker); }
    else { marker.setLatLng(p); marker.setIcon(iconMarker('driver',color)); marker.setPopupContent(popup); }
  });
  if (selectedOrder()) focusSelectedBranch();
  else if (els.branch.value) focusBranch(els.branch.value);
  else if (shownBranches.length === 1) focusBranch(shownBranches[0].id);
  updateStats();
}
function focusBranch(id) {
  const b = branches.find(x => String(x.id) === String(id)); const p = b && coords(b.latitude,b.longitude);
  if (p) map.setView(p,15);
}
function focusSelectedBranch() { const o = selectedOrder(); if (o) focusBranch(o.branch_id); }
function clearRoute() {
  routeRequestId++; lastRouteKey = ''; lastRouteAt = 0; lastRouteOrderId = ''; lastRouteHtml = '';
  if (routeLayer) routeLayer.clearLayers();
  if (customerMarker) { map.removeLayer(customerMarker); customerMarker = null; }
  els.routeLink.hidden = true;
}

function parseCoordinatesFromMapsUrl(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    let match = url.href.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (match) return coords(match[1],match[2]);
    match = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (match) return coords(match[1],match[2]);
    for (const key of ['q','query','destination','ll']) {
      const value = url.searchParams.get(key); if (!value) continue;
      match = value.match(/(-?\d+(?:\.\d+)?)[, ]+(-?\d+(?:\.\d+)?)/);
      if (match) return coords(match[1],match[2]);
    }
  } catch (_) {
    const match = String(raw).match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (match) return coords(match[1],match[2]);
  }
  return null;
}
async function resolveCustomerDestination(order) {
  const cacheKey = String(order.id);
  if (customerDestinationCache.has(cacheKey)) return customerDestinationCache.get(cacheKey);
  const linkCoords = parseCoordinatesFromMapsUrl(order.customer_location_url);
  if (linkCoords) { customerDestinationCache.set(cacheKey,linkCoords); return linkCoords; }
  const address = String(order.customer_address || '').trim();
  if (!address && order.customer_location_url) return null;
  if (!address) throw new Error('عنوان الزبون أو رابط موقعه غير متوفر.');
  const query = encodeURIComponent(`${address}, Baghdad, Iraq`);
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`, { headers: { 'Accept-Language':'ar' } });
  if (!response.ok) throw new Error('تعذر البحث عن عنوان الزبون حالياً. يمكنك فتح الرابط في Google Maps.');
  const results = await response.json();
  if (!results.length) throw new Error('لم نعثر على إحداثيات العنوان. استخدمي رابط موقع الزبون من خرائط Google.');
  const point = coords(results[0].lat,results[0].lon);
  customerDestinationCache.set(cacheKey,point);
  return point;
}
async function fetchRoute(origin, destination) {
  const path = `${origin[1]},${origin[0]};${destination[1]},${destination[0]}`;
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`);
  if (!response.ok) throw new Error('خدمة حساب المسار غير متاحة حالياً.');
  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('لم يتوفر مسار قيادة بين الموقعين.');
  return data.routes[0];
}

const fmtDuration = seconds => {
  const mins = Math.max(1,Math.round(seconds/60));
  if (mins < 60) return `${mins} دقيقة`;
  const hours = Math.floor(mins/60), rest = mins%60;
  return rest ? `${hours} ساعة و${rest} دقيقة` : `${hours} ساعة`;
};
const fmtDistance = meters => meters >= 1000 ? `${(meters/1000).toFixed(1)} كم` : `${Math.round(meters)} م`;
function etaCard(state, duration, distance, source, errorText = '') {
  if (state === 'loading') return `<div class="eta-card"><strong>⏳ جارٍ حساب وقت الوصول...</strong><small>يتم حساب الطريق من موقع المندوب إن كان GPS حديثاً</small></div>`;
  if (state === 'error') return `<div class="eta-card eta-error"><strong>تعذر حساب وقت الوصول</strong><small>${esc(errorText)}</small></div>`;
  const arrival = new Date(Date.now() + duration * 1000).toLocaleTimeString('ar-IQ',{hour:'2-digit',minute:'2-digit'});
  return `<div class="eta-card"><strong>⏱ الوصول المتوقع: ${esc(fmtDuration(duration))}</strong><span>وقت الوصول التقريبي: ${esc(arrival)}</span><small>المسافة: ${esc(fmtDistance(distance))} · ${esc(source)}</small></div>`;
}
async function drawSelectedRoute(force = false) {
  const order = selectedOrder();
  if (!order || !map) return;
  if (order.status === 'delivered') {
    clearRoute();
    const holder = $('#etaHolder');
    if (holder) holder.innerHTML = '<div class="eta-card"><strong>تم التوصيل</strong><small>تم إغلاق التوصيل لهذا الطلب.</small></div>';
    return;
  }
  const requestKey = `${order.id}:${selectedTracking()?.last_seen_at || 'nogps'}:${order.customer_location_url || order.customer_address || ''}`;
  const etaHolder = $('#etaHolder');
  if (!force && lastRouteOrderId === String(order.id) && Date.now()-lastRouteAt < 30_000) {
    if (etaHolder) etaHolder.innerHTML = lastRouteHtml || etaCard('loading');
    return;
  }
  const requestId = ++routeRequestId; lastRouteKey = requestKey; lastRouteOrderId = String(order.id); lastRouteAt = Date.now();
  if (etaHolder) etaHolder.innerHTML = etaCard('loading');
  try {
    const branch = branches.find(b => String(b.id) === String(order.branch_id));
    const branchPoint = branch && coords(branch.latitude,branch.longitude);
    if (!branchPoint) throw new Error('إحداثيات فرع الطلب غير متوفرة.');
    const destination = await resolveCustomerDestination(order);
    if (!destination) throw new Error('رابط موقع الزبون لا يحتوي إحداثيات قابلة للقراءة. افتحي الرابط في Google Maps.');
    if (requestId !== routeRequestId) return;

    const tracking = selectedTracking();
    const driverPoint = tracking && fresh(tracking) ? coords(tracking.latitude,tracking.longitude) : null;
    let routeToShow, etaSource;
    if (driverPoint) {
      try {
        routeToShow = await fetchRoute(driverPoint,destination);
        etaSource = 'من موقع المندوب الحالي';
      } catch (err) {
        routeToShow = await fetchRoute(branchPoint,destination);
        etaSource = 'من موقع الفرع (تعذر حساب مسار المندوب)';
      }
    } else {
      routeToShow = await fetchRoute(branchPoint,destination);
      etaSource = 'من موقع الفرع (بانتظار GPS حديث للمندوب)';
    }
    if (requestId !== routeRequestId) return;

    routeLayer.clearLayers();
    routeLayer.addData(routeToShow.geometry);
    if (customerMarker) map.removeLayer(customerMarker);
    customerMarker = L.marker(destination,{icon:iconMarker('customer','#23945c')}).addTo(map)
      .bindPopup(`<b>عنوان الزبون</b><br>${esc(order.customer_address || order.customer_name || '')}`);
    const boundsPoints = [branchPoint,destination];
    if (driverPoint) boundsPoints.push(driverPoint);
    map.fitBounds(L.latLngBounds(boundsPoints).pad(.18));
    const holder = $('#etaHolder');
    lastRouteHtml = etaCard('ok',routeToShow.duration,routeToShow.distance,etaSource);
    if (holder) holder.innerHTML = lastRouteHtml;
    const originForGoogle = driverPoint && etaSource.startsWith('من موقع المندوب') ? `${driverPoint[0]},${driverPoint[1]}` : `${branchPoint[0]},${branchPoint[1]}`;
    els.routeLink.href = googleMapsUrl(originForGoogle,`${destination[0]},${destination[1]}`);
    els.routeLink.hidden = false;
    els.mapHint.textContent = `المسار الظاهر: ${branch.name} إلى الزبون. تقدير الوصول: ${etaSource}.`;
  } catch (error) {
    if (requestId !== routeRequestId) return;
    lastRouteHtml = etaCard('error',0,0,'',error.message);
    const holder = $('#etaHolder'); if (holder) holder.innerHTML = lastRouteHtml;
    els.mapHint.textContent = error.message;
    const rawLink = order.customer_location_url || order.customer_address;
    if (rawLink) {
      els.routeLink.href = /^https?:\/\//i.test(rawLink) ? rawLink : googleMapsPlaceUrl(`${rawLink}, Baghdad, Iraq`);
      els.routeLink.textContent = 'فتح موقع الزبون في Google Maps';
      els.routeLink.hidden = false;
    }
  }
}
function showSelectedDetails() {
  const order = selectedOrder();
  if (order) {
    const driver = driverForOrder(order), tr = selectedTracking();
    const googlePlace = order.customer_location_url || order.customer_address;
    els.details.innerHTML = `
      <div class="detail-line"><strong>رقم الطلب:</strong> ${esc(order.order_number ?? order.id)}</div>
      <div class="detail-line"><strong>الزبون:</strong> ${esc(order.customer_name)}</div>
      <div class="detail-line"><strong>الهاتف:</strong> ${esc(order.customer_phone)}</div>
      <div class="detail-line"><strong>الفرع:</strong> ${esc(branchName(order.branch_id))}</div>
      <div class="detail-line"><strong>الحالة:</strong> ${order.status === 'delivered' ? 'تم التوصيل' : 'قيد التوصيل'}</div>
      <div class="detail-line"><strong>المندوب:</strong> ${esc(driver?.full_name || 'غير معيّن')}</div>
      <div class="detail-line"><strong>العنوان:</strong> ${esc(order.customer_address || 'غير متوفر')}</div>
      <div class="detail-line"><strong>آخر تحديث GPS:</strong> ${order.status === 'delivered' ? 'تم التوصيل' : esc(formatDate(tr?.last_seen_at))}</div>
      <div id="etaHolder">${order.status === 'delivered' ? '<div class="eta-card"><strong>تم التوصيل</strong><small>تم إغلاق التوصيل لهذا الطلب.</small></div>' : etaCard('loading')}</div>`;
    if (order.status === 'delivered') {
      clearRoute();
      const rawLink = order.customer_location_url || order.customer_address;
      if (rawLink) {
        els.routeLink.href = order.customer_location_url && /^https?:\/\//i.test(order.customer_location_url)
          ? order.customer_location_url
          : googleMapsPlaceUrl(`${rawLink}, Baghdad, Iraq`);
        els.routeLink.textContent = 'فتح موقع الزبون في Google Maps';
        els.routeLink.hidden = false;
      } else {
        els.routeLink.hidden = true;
      }
      return;
    }
    els.routeLink.textContent = 'فتح الاتجاهات في Google Maps';
    if (googlePlace && !order.customer_location_url) {
      els.routeLink.href = googleMapsPlaceUrl(`${googlePlace}, Baghdad, Iraq`);
      els.routeLink.hidden = false;
    } else els.routeLink.hidden = true;
    drawSelectedRoute(); return;
  }
  if (selectedDriverId) {
    const d = drivers.find(x => String(x.id) === String(selectedDriverId));
    const tr = activeTrackingForDriver(selectedDriverId), p = tr && coords(tr.latitude,tr.longitude);
    els.details.innerHTML = d ? `
      <div class="detail-line"><strong>المندوب:</strong> ${esc(d.full_name)}</div>
      <div class="detail-line"><strong>الفرع:</strong> ${esc(branchName(d.branch_id))}</div>
      <div class="detail-line"><strong>الهاتف:</strong> ${esc(d.phone || 'غير متوفر')}</div>
      <div class="detail-line"><strong>الحالة:</strong> ${fresh(tr) ? 'متصل ويرسل الموقع' : 'لا يوجد تحديث GPS حديث'}</div>
      <div class="detail-line"><strong>آخر تحديث:</strong> ${esc(formatDate(tr?.last_seen_at))}</div>` : 'اختاري طلباً أو مندوباً.';
    clearRoute();
    if (p) {
      els.routeLink.href = `https://www.google.com/maps/search/?api=1&query=${p[0]},${p[1]}`;
      els.routeLink.textContent = 'فتح موقع المندوب في Google Maps';
      els.routeLink.hidden = false;
    }
    return;
  }
  clearRoute(); els.details.textContent = 'اختاري طلباً أو مندوباً لعرض التفاصيل.'; els.routeLink.hidden = true;
}
function syncSelections() {
  renderFilters(); renderLists(); renderMarkers(); showSelectedDetails();
  if (selectedOrderId) els.order.value = selectedOrderId;
  if (selectedDriverId) els.driver.value = selectedDriverId;
}
function selectDriver(id) {
  selectedDriverId = String(id);
  const assigned = orders
    .filter(o => String(o.delivery_driver_id) === selectedDriverId)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'out_for_delivery' ? -1 : 1;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  selectedOrderId = assigned.length ? String(assigned[0].id) : '';
  syncSelections();
}
function selectOrder(id) { selectedOrderId = String(id); selectedDriverId = ''; syncSelections(); }

function subscribeRealtime() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel('tracking-live-admin-leaflet')
    .on('postgres_changes',{event:'*',schema:'public',table:'delivery_tracking'},async payload => {
      const row = payload.new || payload.old;
      if (!row) return;
      const idx = trackingRows.findIndex(x => String(x.id) === String(row.id));
      if (payload.eventType === 'DELETE') {
        if (idx >= 0) trackingRows.splice(idx,1);
      } else if (idx >= 0) {
        trackingRows[idx] = { ...trackingRows[idx], ...row };
      } else if (row.status === 'active') {
        trackingRows.push(row);
      }
      renderLists(); renderMarkers();
      if (selectedOrderId && String(row.order_id) === selectedOrderId) {
        showSelectedDetails();
      }
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'orders'},() => refresh(false))
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR') showMessage('تعذر الاتصال بالتحديث المباشر. استخدمي زر تحديث.',true);
    });
}
async function refresh(showNotice = true) {
  els.refresh.disabled = true;
  try {
    await loadData();
    if (showNotice) showMessage('تم تحديث مواقع الفروع والمندوبين والطلبات.');
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'تعذر تحميل بيانات التتبع.',true);
  } finally {
    els.refresh.disabled = false;
  }
}
function wireEvents() {
  els.refresh.addEventListener('click',() => refresh(true));
  els.branch.addEventListener('change',() => {
    clearRoute(); selectedOrderId=''; selectedDriverId=''; syncSelections();
  });
  els.order.addEventListener('change',() => {
    clearRoute(); selectedOrderId=els.order.value; selectedDriverId=''; syncSelections();
  });
  els.driver.addEventListener('change',() => {
    clearRoute(); selectedDriverId=els.driver.value;
    const assigned=orders.find(o=>String(o.delivery_driver_id)===selectedDriverId);
    selectedOrderId=assigned?String(assigned.id):'';
    syncSelections();
  });
  els.driversList.addEventListener('click', event => {
    const orderButton = event.target.closest('[data-order]');
    if (orderButton) {
      clearRoute();
      selectOrder(orderButton.dataset.order);
      return;
    }
    const driverButton = event.target.closest('[data-driver]');
    if (driverButton) {
      clearRoute();
      selectDriver(driverButton.dataset.driver);
    }
  });
  els.ordersList.addEventListener('click',event => {
    const button=event.target.closest('[data-order]');
    if(button) { clearRoute(); selectOrder(button.dataset.order); }
  });
}
async function start() {
  try {
    wireEvents();
    if (!await authorize()) return;
    await loadData();
    initMap(); renderMarkers(); showSelectedDetails();
    // Automatic refresh disabled to reduce Supabase usage.
  } catch (error) {
    console.error('Tracking page error:',error);
    showMessage(error.message || 'حدث خطأ أثناء تشغيل صفحة التتبع.',true);
    const placeholder = $('#mapPlaceholder');
    if (placeholder) placeholder.innerHTML = `<strong>تعذر تشغيل الخريطة</strong><span>${esc(error.message)}</span>`;
  }
}
window.addEventListener('beforeunload',() => {
  if (refreshTimer) clearInterval(refreshTimer);
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
});
start();
