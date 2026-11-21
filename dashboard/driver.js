"use strict";

import {
    supabaseClient as supabase,
    isSupabaseConfigured as configured
} from "./supabase-client.js";

// =====================================================
// مطعم الغنّام — صفحة المندوب والخريطة
// =====================================================

const ACTIVE_ORDER_STATUSES = ["ready", "out_for_delivery"];

const BRANCH_FALLBACKS = {
    grill: {
        name: "فرع المشاوي",
        lat: 33.2541313,
        lng: 44.3858693
    },
    fastfood: {
        name: "فرع الوجبات السريعة",
        lat: 33.2543165,
        lng: 44.3851212
    },
    falafel: {
        name: "فرع الفلافل",
        lat: 33.2336959,
        lng: 44.3306199
    }
};

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;

let gpsWatchId = null;
let lastGpsSentAt = 0;
let lastGpsPosition = null;
let gpsSharing = false;

let assignedOrders = [];
let selectedOrder = null;

let map = null;
let branchMarker = null;
let driverMarker = null;
let customerMarker = null;
let routeLine = null;
let branchLocation = null;
let customerLocation = null;

let routeRequestId = 0;
let lastRouteUpdateAt = 0;

const geocodeCache = new Map();

// =====================================================
// إشعارات المندوب: إسناد الطلب، استلامه، وتسليمه
// =====================================================

const DRIVER_NOTIFY_STORAGE = "ghannam_driver_seen_events_v1";
const DRIVER_CHANNEL = "ghannam-driver-events";
let driverAudioContext = null;
let driverAudioReady = false;
let driverRealtimeChannel = null;
const knownOrderStatuses = new Map();

function getDriverSeenEvents() {
    try {
        const value = JSON.parse(localStorage.getItem(DRIVER_NOTIFY_STORAGE) || "[]");
        return new Set(Array.isArray(value) ? value : []);
    } catch {
        return new Set();
    }
}

function rememberDriverEvent(key) {
    const seen = getDriverSeenEvents();
    if (seen.has(key)) return false;
    seen.add(key);
    try {
        localStorage.setItem(
            DRIVER_NOTIFY_STORAGE,
            JSON.stringify([...seen].slice(-400))
        );
    } catch {}
    return true;
}

function unlockDriverAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    try {
        if (!driverAudioContext) driverAudioContext = new AudioContextClass();
        if (driverAudioContext.state === "suspended") {
            driverAudioContext.resume().catch(() => {});
        }
        driverAudioReady = driverAudioContext.state === "running";
    } catch (error) {
        console.warn("Driver audio unavailable:", error);
    }
    return driverAudioReady;
}

function playDriverBell() {
    if (!unlockDriverAudio()) return;

    const now = driverAudioContext.currentTime;
    [784, 988, 1175].forEach((frequency, index) => {
        const start = now + index * 0.16;
        const oscillator = driverAudioContext.createOscillator();
        const gain = driverAudioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

        oscillator.connect(gain);
        gain.connect(driverAudioContext.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.45);
    });
}

function showDriverNotificationToast(title, message) {
    let toast = document.getElementById("ghannamDriverNotifyToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "ghannamDriverNotifyToast";
        toast.setAttribute("dir", "rtl");
        toast.style.cssText = [
            "position:fixed", "z-index:1000005", "top:16px", "left:16px",
            "width:min(350px,calc(100vw - 32px))", "box-sizing:border-box",
            "padding:15px 16px", "border-radius:14px",
            "background:#fffaf5", "color:#351313",
            "border:1px solid #e8cfc2", "border-right:5px solid #b52c20",
            "box-shadow:0 12px 36px #0003", "font-family:inherit"
        ].join(";");
        document.body.appendChild(toast);
    }

    toast.replaceChildren();

    const heading = document.createElement("strong");
    heading.textContent = title;
    heading.style.cssText = "display:block;margin-bottom:5px;color:#741f1f";

    const body = document.createElement("span");
    body.textContent = message;
    body.style.cssText = "display:block;font-size:13px;line-height:1.7";

    toast.append(heading, body);
    clearTimeout(showDriverNotificationToast.timer);
    showDriverNotificationToast.timer = setTimeout(() => toast.remove(), 8500);
}

function enableDriverNotificationsButton() {
    if (document.getElementById("ghannamDriverNotifyEnable")) return;

    const button = document.createElement("button");
    button.id = "ghannamDriverNotifyEnable";
    button.type = "button";
    button.textContent = "🔔 تفعيل صوت وإشعارات الطلبات";
    button.style.cssText = [
        "position:fixed", "z-index:1000004", "left:14px", "bottom:14px",
        "border:0", "border-radius:999px", "padding:11px 15px",
        "background:#741f1f", "color:white", "font:inherit",
        "font-size:13px", "font-weight:700", "cursor:pointer",
        "box-shadow:0 5px 22px #0003"
    ].join(";");

    button.addEventListener("click", async () => {
        unlockDriverAudio();

        if ("Notification" in window && Notification.permission === "default") {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.warn("Notification permission request failed:", error);
            }
        }

        const soundEnabled = unlockDriverAudio();
        const notificationState = !("Notification" in window)
            ? "إشعارات المتصفح غير مدعومة"
            : Notification.permission === "granted"
                ? "إشعارات المتصفح مفعّلة"
                : Notification.permission === "denied"
                    ? "إشعارات المتصفح محظورة من إعدادات المتصفح"
                    : "لم يتم السماح بإشعارات المتصفح";

        button.textContent = soundEnabled
            ? "✓ تم تفعيل صوت الجرس"
            : "جرّب تفعيل الصوت مرة أخرى";

        showDriverNotificationToast(
            "تم إعداد التنبيهات",
            `${soundEnabled ? "صوت الجرس مفعّل" : "تعذر تفعيل الصوت حالياً"} — ${notificationState}`
        );
        playDriverBell();
    });

    document.body.appendChild(button);
}

function sendDriverOrderAlert(order, eventType) {
    if (!order?.id || !currentUser) return;

    const eventKey = `${order.id}:${eventType}`;
    if (!rememberDriverEvent(eventKey)) return;

    const orderNumber = order.order_number || String(order.id).slice(0, 8);
    const messages = {
        assigned: {
            title: "📦 تم إسناد طلب إليك",
            body: `الطلب #${orderNumber} أصبح ضمن طلباتك. افتح التطبيق لمشاهدة التفاصيل.`
        },
        accepted: {
            title: "🛵 تم استلام الطلب",
            body: `تم تسجيل استلامك للطلب #${orderNumber}. بالتوفيق!`
        },
        delivered: {
            title: "✅ تم توصيل الطلب",
            body: `تم تحديث الطلب #${orderNumber} إلى تم التوصيل.`
        }
    };

    const alert = messages[eventType];
    if (!alert) return;

    showDriverNotificationToast(alert.title, alert.body);
    playDriverBell();

    if ("Notification" in window && Notification.permission === "granted") {
        try {
            const notification = new Notification(alert.title, {
                body: alert.body,
                icon: "../image/logo.webp",
                badge: "../image/logo.webp",
                tag: `ghannam-driver-${eventKey}`,
                renotify: false
            });
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (error) {
            console.warn("Driver browser notification failed:", error);
        }
    }

    try {
        const channel = new BroadcastChannel(DRIVER_CHANNEL);
        channel.postMessage({ type: eventType, orderId: order.id });
        channel.close();
    } catch {}
}

function startDriverOrderRealtime() {
    if (!supabase || !currentUser || driverRealtimeChannel) return;

    driverRealtimeChannel = supabase
        .channel(`ghannam-driver-orders-${currentUser.id}`)
        .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "orders"
        }, (payload) => {
            const order = payload.new;
            if (!order || String(order.delivery_driver_id) !== String(currentUser.id)) return;

            knownOrderStatuses.set(String(order.id), order.status);
            sendDriverOrderAlert(order, "assigned");
        })
        .on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "orders"
        }, (payload) => {
            const order = payload.new;
            if (!order?.id) return;

            const previous = payload.old || {};
            const id = String(order.id);
            const hasPreviousDriver =
                Object.prototype.hasOwnProperty.call(previous, "delivery_driver_id");
            const wasAssignedToMe =
                String(previous.delivery_driver_id || "") === String(currentUser.id);
            const assignedToMe =
                String(order.delivery_driver_id || "") === String(currentUser.id);

            // لا نفترض أن الطلب أُسند للتو إذا لم يرسل Realtime قيمة الصف القديم.
            if (assignedToMe && hasPreviousDriver && !wasAssignedToMe) {
                sendDriverOrderAlert(order, "assigned");
            }

            if (assignedToMe) {
                const oldStatus = knownOrderStatuses.has(id)
                    ? knownOrderStatuses.get(id)
                    : previous.status;

                if (order.status === "out_for_delivery" &&
                    oldStatus !== "out_for_delivery") {
                    sendDriverOrderAlert(order, "accepted");
                }

                if (["delivered", "completed"].includes(order.status) &&
                    !["delivered", "completed"].includes(oldStatus)) {
                    sendDriverOrderAlert(order, "delivered");
                }
            }

            knownOrderStatuses.set(id, order.status);
        })
        .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                console.warn("تعذر الاتصال بإشعارات طلبات المندوب عبر Realtime.");
            }
        });
}

function stopDriverOrderRealtime() {
    if (driverRealtimeChannel && supabase) {
        supabase.removeChannel(driverRealtimeChannel);
        driverRealtimeChannel = null;
    }
    knownOrderStatuses.clear();
}


const loginView = $("loginView");
const driverApp = $("driverApp");
const loginForm = $("driverLoginForm");
const loginBtn = $("loginBtn");
const loginMessage = $("loginMessage");
const pageMessage = $("pageMessage");

// =====================================================
// رسائل وواجهات
// =====================================================

function showLoginMessage(message, type = "error") {
    if (!loginMessage) return;

    loginMessage.textContent = message || "";
    loginMessage.className = `message ${type}`;
}

function showPageMessage(message, type = "info") {
    if (!pageMessage) return;

    pageMessage.textContent = message || "";
    pageMessage.className = `page-message ${type}`;
}

function showMapMessage(message, type = "info") {
    const element = $("mapActionMessage");
    if (!element) return;

    element.textContent = message || "";
    element.className = `message ${type}`;
}

function clearPageMessage() {
    showPageMessage("");
}

function setLoginLoading(loading) {
    if (!loginBtn) return;

    loginBtn.disabled = loading;
    loginBtn.textContent = loading
        ? "جارٍ تسجيل الدخول..."
        : "تسجيل الدخول";
}

function showLogin() {
    if (loginView) loginView.hidden = false;
    if (driverApp) driverApp.hidden = true;
}

function showDriverApp() {
    if (loginView) loginView.hidden = true;
    if (driverApp) driverApp.hidden = false;

    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 250);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// =====================================================
// فحص Supabase والجلسة
// =====================================================

function checkSupabase() {
    if (!configured || !supabase) {
        showLoginMessage(
            "إعدادات الاتصال بقاعدة البيانات غير مكتملة. راجع ملف supabase-client.js."
        );
        return false;
    }

    return true;
}

async function verifyDriverSession() {
    if (!checkSupabase()) return;

    try {
        const {
            data: { session },
            error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
            showLogin();
            return;
        }

        currentUser = session.user;

        const { data: profile, error } = await supabase
            .from("profiles")
            .select("id,email,full_name,role,branch_id")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) throw error;

        if (!profile || profile.role !== "delivery_driver") {
            await supabase.auth.signOut();
            currentUser = null;
            currentProfile = null;
            showLogin();
            showLoginMessage("هذا الحساب غير مسجل كحساب مندوب توصيل.");
            return;
        }

        currentProfile = profile;

        enableDriverNotificationsButton();
        startDriverOrderRealtime();

        $("driverName").textContent =
            profile.full_name || profile.email || "المندوب";

        await loadBranchLocation(profile.branch_id);

        $("driverBranch").textContent =
            branchLocation?.name || "فرع المطعم";

        showDriverApp();
        initializeMap();
        await loadAssignedOrders();

    } catch (error) {
        console.error("Driver session error:", error);
        showLogin();
        showLoginMessage(error.message || "تعذر التحقق من حساب المندوب.");
    }
}

// =====================================================
// تسجيل الدخول والخروج
// =====================================================

async function handleLogin(event) {
    event.preventDefault();

    if (!checkSupabase()) return;

    const email = $("driverEmail").value.trim();
    const password = $("driverPassword").value;

    if (!email || !password) {
        showLoginMessage("أدخل البريد الإلكتروني وكلمة المرور.");
        return;
    }

    setLoginLoading(true);
    showLoginMessage("");

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        currentUser = data.user;
        await verifyDriverSession();

    } catch (error) {
        console.error("Login error:", error);
        showLoginMessage(error.message || "فشل تسجيل الدخول.");
    } finally {
        setLoginLoading(false);
    }
}

async function handleLogout() {
    stopGpsSharing();
    stopDriverOrderRealtime();

    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        console.error("Logout error:", error);
    }

    currentUser = null;
    currentProfile = null;
    assignedOrders = [];
    selectedOrder = null;
    customerLocation = null;

    showLogin();
}

// =====================================================
// موقع الفرع
// =====================================================

async function loadBranchLocation(branchId) {
    const fallback = BRANCH_FALLBACKS[branchId] || null;

    branchLocation = fallback
        ? { ...fallback }
        : null;

    if (!branchId) return;

    try {
        const { data, error } = await supabase
            .from("branches")
            .select("id,name,description,latitude,longitude")
            .eq("id", branchId)
            .maybeSingle();

        if (error) throw error;

        if (
            data &&
            Number.isFinite(Number(data.latitude)) &&
            Number.isFinite(Number(data.longitude))
        ) {
            branchLocation = {
                name: data.name || fallback?.name || "فرع المطعم",
                lat: Number(data.latitude),
                lng: Number(data.longitude)
            };
        } else if (data?.name && branchLocation) {
            branchLocation.name = data.name;
        }
    } catch (error) {
        console.warn("Could not load branch coordinates:", error);
    }
}

// =====================================================
// تحميل الطلبات
// =====================================================

async function loadAssignedOrders() {
    if (!currentUser) return;

    const ordersList = $("ordersList");

    if (ordersList) {
        ordersList.innerHTML =
            '<div class="loading-state">جارٍ تحميل الطلبات...</div>';
    }

    try {
        const { data, error } = await supabase
            .from("orders")
            .select(`
                id,
                order_number,
                branch_id,
                customer_name,
                customer_phone,
                customer_address,
                customer_notes,
                customer_location_url,
                items,
                total,
                status,
                created_at
            `)
            .eq("delivery_driver_id", currentUser.id)
            .in("status", ACTIVE_ORDER_STATUSES)
            .order("created_at", { ascending: false });

        if (error) throw error;

        assignedOrders = data || [];
        assignedOrders.forEach((order) => {
            knownOrderStatuses.set(String(order.id), order.status);
        });

        $("ordersCount").textContent = String(assignedOrders.length);

        $("activeCount").textContent = String(
            assignedOrders.filter(
                (order) => order.status === "out_for_delivery"
            ).length
        );

        renderOrders();

        if (selectedOrder) {
            const refreshed = assignedOrders.find(
                (order) => order.id === selectedOrder.id
            );

            if (refreshed) {
                selectOrder(refreshed.id);
            } else {
                selectedOrder = null;
                clearCustomerFromMap();
            }
        } else if (assignedOrders.length) {
            selectOrder(assignedOrders[0].id);
        }

        if (!assignedOrders.length) {
            showPageMessage("لا توجد طلبات مسندة إليك حالياً.");
        } else {
            clearPageMessage();
        }

    } catch (error) {
        console.error("Load orders error:", error);

        if (ordersList) {
            ordersList.innerHTML =
                '<div class="empty-state">تعذر تحميل الطلبات. حاول التحديث.</div>';
        }

        showPageMessage(
            error.message || "حدث خطأ أثناء تحميل الطلبات.",
            "error"
        );
    }
}

// =====================================================
// عرض الطلبات
// =====================================================

function formatOrderItems(items) {
    if (!items) return "تفاصيل الأصناف غير متوفرة";

    let list = [];

    if (Array.isArray(items)) {
        list = items;
    } else if (typeof items === "string") {
        try {
            const parsed = JSON.parse(items);
            list = Array.isArray(parsed) ? parsed : [];
        } catch {
            return escapeHtml(items);
        }
    } else if (typeof items === "object") {
        list = Array.isArray(items.items) ? items.items : [];
    }

    if (!list.length) return "لا توجد تفاصيل أصناف";

    return list.map((item) => {
        const name = item.name || item.product_name || "صنف";
        const quantity = item.quantity || item.qty || 1;

        return `
            <div class="order-item-line">
                <span>${escapeHtml(name)}</span>
                <strong>× ${escapeHtml(quantity)}</strong>
            </div>
        `;
    }).join("");
}

function formatMoney(value) {
    const number = Number(value || 0);

    return `${number.toLocaleString("en-US")} د.ع`;
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("ar-IQ", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function renderOrders() {
    const container = $("ordersList");
    if (!container) return;

    if (!assignedOrders.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <strong>لا توجد طلبات حالياً</strong>
                <p>ستظهر هنا الطلبات التي يتم إسنادها إليك.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = assignedOrders.map((order) => {
        const isSelected = selectedOrder?.id === order.id;
        const statusText = order.status === "out_for_delivery"
            ? "قيد التوصيل"
            : "جاهز للاستلام";

        return `
            <article
                class="order-card ${isSelected ? "selected" : ""}"
                data-order-id="${escapeHtml(order.id)}"
            >
                <div class="order-card-header">
                    <div>
                        <span class="order-number">
                            طلب #${escapeHtml(order.order_number || order.id)}
                        </span>
                        <span class="order-status">
                            ${statusText}
                        </span>
                    </div>
                    <strong class="order-total">
                        ${formatMoney(order.total)}
                    </strong>
                </div>

                <div class="order-customer">
                    <strong>${escapeHtml(order.customer_name || "زبون")}</strong>
                    <a href="tel:${escapeHtml(order.customer_phone || "")}">
                        ${escapeHtml(order.customer_phone || "لا يوجد رقم هاتف")}
                    </a>
                </div>

                <p class="order-address">
                    📍 ${escapeHtml(order.customer_address || "العنوان غير متوفر")}
                </p>

                ${
                    order.customer_notes
                        ? `<p class="order-notes">ملاحظات: ${escapeHtml(order.customer_notes)}</p>`
                        : ""
                }

                <div class="order-items">
                    ${formatOrderItems(order.items)}
                </div>

                <div class="order-card-footer">
                    <span>${formatDate(order.created_at)}</span>
                    <button
                        type="button"
                        class="select-order-btn"
                        data-select-order="${escapeHtml(order.id)}"
                    >
                        ${isSelected ? "الطلب المحدد" : "عرض على الخريطة"}
                    </button>
                </div>
            </article>
        `;
    }).join("");

    container.querySelectorAll("[data-select-order]").forEach((button) => {
        button.addEventListener("click", () => {
            selectOrder(button.dataset.selectOrder);
        });
    });

    container.querySelectorAll(".order-card").forEach((card) => {
        card.addEventListener("click", (event) => {
            if (event.target.closest("a,button")) return;
            selectOrder(card.dataset.orderId);
        });
    });
}

// =====================================================
// اختيار الطلب وموقع الزبون
// =====================================================

function selectOrder(orderId) {
    const order = assignedOrders.find(
        (item) => String(item.id) === String(orderId)
    );

    if (!order) return;

    selectedOrder = order;

    renderOrders();
    updateCustomerLocationForOrder(order);
}

async function updateCustomerLocationForOrder(order) {
    customerLocation = null;
    clearCustomerFromMap();

    if (order.branch_id && order.branch_id !== currentProfile?.branch_id) {
        await loadBranchLocation(order.branch_id);
        $("driverBranch").textContent =
            branchLocation?.name || "فرع المطعم";
        updateBranchOnMap();
    }

    const fromUrl = parseCoordinatesFromUrl(
        order.customer_location_url
    );

    if (fromUrl) {
        customerLocation = {
            ...fromUrl,
            source: "link"
        };
    } else if (order.customer_address) {
        const geocoded = await geocodeAddress(order.customer_address);

        if (geocoded) {
            customerLocation = {
                ...geocoded,
                source: "address"
            };
        }
    }

    if (customerLocation) {
        showCustomerOnMap(customerLocation);
        updateRoute();
        showMapMessage("تم تحديد موقع الزبون على الخريطة.", "success");
    } else {
        updateRouteInfo(
            "لم نتمكن من تحديد إحداثيات الزبون. يمكنك فتح العنوان من Google Maps."
        );
        showMapMessage(
            "لا توجد إحداثيات مؤكدة للزبون. استخدم رابط الموقع أو العنوان.",
            "warning"
        );
    }
}

// =====================================================
// استخراج الإحداثيات من روابط الخرائط
// =====================================================

function validCoordinates(lat, lng) {
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    return { lat: latitude, lng: longitude };
}

function parseCoordinatesFromUrl(rawUrl) {
    if (!rawUrl) return null;

    const value = String(rawUrl).trim();

    const patterns = [
        /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
        /[?&](?:q|query|destination|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i
    ];

    for (const pattern of patterns) {
        const match = value.match(pattern);

        if (match) {
            const coords = validCoordinates(match[1], match[2]);
            if (coords) return coords;
        }
    }

    try {
        const url = new URL(value);

        for (const key of ["q", "query", "destination", "ll", "center"]) {
            const parameter = url.searchParams.get(key);

            if (!parameter) continue;

            const match = parameter.match(
                /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/
            );

            if (match) {
                const coords = validCoordinates(match[1], match[2]);
                if (coords) return coords;
            }
        }
    } catch {
        // قد يكون الرابط نصاً غير مكتمل؛ نكتفي بالأنماط السابقة.
    }

    return null;
}

// =====================================================
// تحديد موقع العنوان عند عدم وجود إحداثيات
// =====================================================

async function geocodeAddress(address) {
    const normalized = String(address || "").trim();

    if (!normalized) return null;

    if (geocodeCache.has(normalized)) {
        return geocodeCache.get(normalized);
    }

    try {
        const query = encodeURIComponent(`${normalized}, Baghdad, Iraq`);

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`,
            {
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        if (!response.ok) throw new Error("Geocoding failed");

        const results = await response.json();

        if (!results.length) {
            geocodeCache.set(normalized, null);
            return null;
        }

        const coords = validCoordinates(
            results[0].lat,
            results[0].lon
        );

        geocodeCache.set(normalized, coords);
        return coords;

    } catch (error) {
        console.warn("Address lookup failed:", error);
        return null;
    }
}

// =====================================================
// إعداد الخريطة
// =====================================================

function initializeMap() {
    if (map || !window.L || !$("deliveryMap")) return;

    map = L.map("deliveryMap", {
        zoomControl: true
    }).setView(
        branchLocation
            ? [branchLocation.lat, branchLocation.lng]
            : [33.3152, 44.3661],
        13
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    updateBranchOnMap();

    if (lastGpsPosition) {
        updateDriverOnMap(lastGpsPosition);
    }
}

function updateBranchOnMap() {
    if (!map || !branchLocation) return;

    const position = [
        branchLocation.lat,
        branchLocation.lng
    ];

    if (!branchMarker) {
        branchMarker = L.marker(position)
            .addTo(map)
            .bindPopup(
                `<strong>${escapeHtml(branchLocation.name)}</strong><br>موقع الفرع`
            );
    } else {
        branchMarker.setLatLng(position);
        branchMarker.setPopupContent(
            `<strong>${escapeHtml(branchLocation.name)}</strong><br>موقع الفرع`
        );
    }
}

function updateDriverOnMap(position) {
    if (!map || !position) return;

    const coordinates = [position.lat, position.lng];

    if (!driverMarker) {
        driverMarker = L.marker(coordinates)
            .addTo(map)
            .bindPopup("<strong>موقع المندوب</strong>");
    } else {
        driverMarker.setLatLng(coordinates);
    }

    updateRoute();
}

function showCustomerOnMap(position) {
    if (!map || !position) return;

    const coordinates = [position.lat, position.lng];

    if (!customerMarker) {
        customerMarker = L.marker(coordinates)
            .addTo(map)
            .bindPopup("<strong>موقع الزبون</strong>");
    } else {
        customerMarker.setLatLng(coordinates);
    }

    map.setView(coordinates, 15);
}

function clearCustomerFromMap() {
    if (customerMarker && map) {
        map.removeLayer(customerMarker);
    }

    customerMarker = null;

    if (routeLine && map) {
        map.removeLayer(routeLine);
    }

    routeLine = null;

    updateRouteInfo("اختر طلباً لعرض مساره");
}

// =====================================================
// المسار والمسافة ووقت الوصول التقديري
// =====================================================

function updateRouteInfo(message) {
    const element = $("routeInfo");
    if (element) element.textContent = message;
}

function distanceBetween(a, b) {
    const earthRadius = 6371;
    const toRadians = (value) => value * Math.PI / 180;

    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);

    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);

    const value =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLng / 2) ** 2;

    return earthRadius * 2 * Math.atan2(
        Math.sqrt(value),
        Math.sqrt(1 - value)
    );
}

function formatDuration(minutes) {
    const rounded = Math.max(1, Math.round(minutes));

    if (rounded < 60) {
        return `${rounded} دقيقة تقريباً`;
    }

    const hours = Math.floor(rounded / 60);
    const remaining = rounded % 60;

    return remaining
        ? `${hours} ساعة و${remaining} دقيقة تقريباً`
        : `${hours} ساعة تقريباً`;
}

async function updateRoute() {
    if (!map || !customerLocation) return;

    const origin = lastGpsPosition || branchLocation;

    if (!origin) {
        updateRouteInfo("بانتظار موقع المندوب أو موقع الفرع.");
        return;
    }

    const now = Date.now();

    if (
        lastGpsPosition &&
        now - lastRouteUpdateAt < 10000
    ) {
        return;
    }

    lastRouteUpdateAt = now;

    const requestId = ++routeRequestId;

    const straightDistance = distanceBetween(
        origin,
        customerLocation
    );

    updateRouteInfo(
        `المسافة التقريبية المباشرة: ${straightDistance.toFixed(1)} كم`
    );

    try {
        const coordinates =
            `${origin.lng},${origin.lat};${customerLocation.lng},${customerLocation.lat}`;

        const url =
            `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;

        const response = await fetch(url);

        if (!response.ok) throw new Error("Route service unavailable");

        const data = await response.json();

        if (requestId !== routeRequestId) return;

        if (!data.routes?.length) {
            throw new Error("No route found");
        }

        const route = data.routes[0];

        const routeCoordinates = route.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng]
        );

        if (routeLine) {
            map.removeLayer(routeLine);
        }

        routeLine = L.polyline(routeCoordinates, {
            color: "#8b241b",
            weight: 6,
            opacity: 0.85
        }).addTo(map);

        const distanceKm = route.distance / 1000;
        const durationMinutes = route.duration / 60;

        updateRouteInfo(
            `المسافة: ${distanceKm.toFixed(1)} كم · وقت الوصول التقديري: ${formatDuration(durationMinutes)}`
        );

    } catch (error) {
        console.warn("Route calculation failed:", error);

        updateRouteInfo(
            `المسافة المباشرة: ${straightDistance.toFixed(1)} كم · تعذر حساب مسار الطرق حالياً`
        );
    }
}

// =====================================================
// روابط Google Maps والتطبيقات الخارجية
// =====================================================

function googleMapsSearchUrl(location, fallbackText = "") {
    if (location) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${location.lat},${location.lng}`
        )}`;
    }

    if (fallbackText) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            fallbackText
        )}`;
    }

    return null;
}

function googleMapsDirectionsUrl(origin, destination, fallbackDestination = "") {
    if (!destination && !fallbackDestination) return null;

    const destinationValue = destination
        ? `${destination.lat},${destination.lng}`
        : fallbackDestination;

    const params = new URLSearchParams({
        api: "1",
        destination: destinationValue,
        travelmode: "driving"
    });

    if (origin) {
        params.set("origin", `${origin.lat},${origin.lng}`);
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function openExternalMap(url) {
    if (!url) {
        showMapMessage("معلومات الموقع غير متوفرة لهذا الخيار.", "warning");
        return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
}

function getCustomerMapUrl() {
    if (!selectedOrder) return null;

    if (selectedOrder.customer_location_url) {
        return selectedOrder.customer_location_url;
    }

    return googleMapsSearchUrl(
        customerLocation,
        selectedOrder.customer_address
    );
}

function openBranchMap() {
    openExternalMap(
        googleMapsSearchUrl(
            branchLocation,
            branchLocation?.name || "مطعم الغنّام بغداد"
        )
    );
}

function openCustomerMap() {
    openExternalMap(getCustomerMapUrl());
}

function openBranchRoute() {
    if (!selectedOrder) {
        showMapMessage("اختر طلباً أولاً.", "warning");
        return;
    }

    const destinationText =
        selectedOrder.customer_address || "";

    openExternalMap(
        googleMapsDirectionsUrl(
            branchLocation,
            customerLocation,
            destinationText
        )
    );
}

function navigateToCustomer() {
    if (!selectedOrder) {
        showMapMessage("اختر طلباً أولاً.", "warning");
        return;
    }

    const origin = lastGpsPosition || null;
    const destinationText =
        selectedOrder.customer_address || "";

    openExternalMap(
        googleMapsDirectionsUrl(
            origin,
            customerLocation,
            destinationText
        )
    );
}

async function copyText(value, successMessage) {
    if (!value) {
        showMapMessage("معلومات الموقع غير متوفرة للنسخ.", "warning");
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        showMapMessage(successMessage, "success");
    } catch {
        showMapMessage(
            "تعذر النسخ تلقائياً. افتح الموقع من Google Maps.",
            "error"
        );
    }
}

function copyCustomerLocation() {
    copyText(
        getCustomerMapUrl(),
        "تم نسخ رابط موقع الزبون."
    );
}

function copyCustomerCoordinates() {
    if (!customerLocation) {
        showMapMessage(
            "لم يتم تحديد إحداثيات دقيقة للزبون.",
            "warning"
        );
        return;
    }

    copyText(
        `${customerLocation.lat}, ${customerLocation.lng}`,
        "تم نسخ إحداثيات الزبون."
    );
}

// =====================================================
// مشاركة GPS مع Supabase
// =====================================================

function updateGpsUI(active, message = "") {
    gpsSharing = active;

    const status = $("gpsStatus");
    const gpsMessage = $("gpsMessage");

    if (status) {
        status.textContent = active ? "يعمل" : "متوقف";
        status.className = `status-pill ${active ? "online" : "offline"}`;
    }

    if (gpsMessage) {
        gpsMessage.textContent = message || (
            active
                ? "مشاركة الموقع مفعّلة."
                : "مشاركة الموقع غير مفعّلة."
        );
    }

    $("startGpsBtn").disabled = active;
    $("stopGpsBtn").disabled = !active;
}

async function sendGpsPosition(position) {
    if (!currentUser) return;

    const now = Date.now();

    if (now - lastGpsSentAt < 8000) return;

    lastGpsSentAt = now;

    const coords = position.coords;

    const location = {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        heading: coords.heading,
        speed: coords.speed
    };

    lastGpsPosition = location;

    updateDriverOnMap(location);

    $("lastLocation").textContent =
        `آخر تحديث: ${new Date().toLocaleTimeString("ar-IQ")}`;

    try {
        const { error } = await supabase.rpc(
            "update_delivery_location",
            {
                p_latitude: coords.latitude,
                p_longitude: coords.longitude,
                p_accuracy: coords.accuracy,
                p_heading: coords.heading,
                p_speed: coords.speed
            }
        );

        if (error) throw error;

        $("gpsMessage").textContent =
            "يتم إرسال موقعك إلى نظام المطعم بنجاح.";

    } catch (error) {
        console.error("GPS update error:", error);

        $("gpsMessage").textContent =
            "تم تحديد موقعك، لكن تعذر إرساله إلى النظام.";
    }
}

function handleGpsError(error) {
    console.error("GPS error:", error);

    let message = "تعذر تحديد موقعك.";

    if (error.code === 1) {
        message = "يرجى السماح للمتصفح بالوصول إلى الموقع.";
    } else if (error.code === 2) {
        message = "موقع الجهاز غير متاح حالياً.";
    } else if (error.code === 3) {
        message = "انتهت مهلة تحديد الموقع. حاول مرة أخرى.";
    }

    $("gpsMessage").textContent = message;
    showPageMessage(message, "error");
}

function startGpsSharing() {
    if (!currentUser) return;

    if (!navigator.geolocation) {
        $("gpsMessage").textContent =
            "هذا المتصفح لا يدعم تحديد الموقع.";
        return;
    }

    if (gpsWatchId !== null) return;

    updateGpsUI(true, "جارٍ تحديد موقعك...");

    gpsWatchId = navigator.geolocation.watchPosition(
        sendGpsPosition,
        handleGpsError,
        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 20000
        }
    );
}

function stopGpsSharing() {
    if (gpsWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchId);
    }

    gpsWatchId = null;
    lastGpsSentAt = 0;

    updateGpsUI(false, "تم إيقاف مشاركة الموقع.");
}

// =====================================================
// ربط الأزرار والأحداث
// =====================================================

function bindEvents() {
    loginForm?.addEventListener("submit", handleLogin);

    $("logoutBtn")?.addEventListener("click", handleLogout);

    $("refreshBtn")?.addEventListener("click", loadAssignedOrders);

    $("startGpsBtn")?.addEventListener("click", startGpsSharing);

    $("stopGpsBtn")?.addEventListener("click", stopGpsSharing);

    $("openBranchMapBtn")?.addEventListener("click", openBranchMap);

    $("openCustomerMapBtn")?.addEventListener("click", openCustomerMap);

    $("openBranchRouteBtn")?.addEventListener("click", openBranchRoute);

    $("navigateCustomerBtn")?.addEventListener("click", navigateToCustomer);

    $("copyCustomerLocationBtn")?.addEventListener(
        "click",
        copyCustomerLocation
    );

    $("copyCustomerCoordinatesBtn")?.addEventListener(
        "click",
        copyCustomerCoordinates
    );
}

// =====================================================
// تشغيل الصفحة
// =====================================================

async function initDriverPage() {
    bindEvents();

    updateGpsUI(false);

    if (!checkSupabase()) {
        showLogin();
        return;
    }

    await verifyDriverSession();

    supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
            stopGpsSharing();
            stopDriverOrderRealtime();
            currentUser = null;
            currentProfile = null;
            showLogin();
        }
    });
}

initDriverPage();
