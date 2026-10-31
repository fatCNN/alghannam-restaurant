
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY
} from "./dashboard/supabase-config.js";

/* =========================================
   إعداد اتصال Supabase
========================================= */

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

/* =========================================
   عناصر واجهة الحساب
========================================= */

const form = $("customerAccountForm");
const status = $("accountStatus");
const submitButton = $("accountSubmitButton");

const nameInput = $("customerName");
const emailInput = $("customerEmail");
const passwordInput = $("customerPassword");
const confirmInput = $("customerConfirmPassword");

const loginTab = $("loginTab");
const registerTab = $("registerTab");
const forgotButton = $("forgotPasswordButton");

/* =========================================
   تحديد وضع الحساب
========================================= */

function isRegisterMode() {
    return registerTab?.classList.contains("active") || false;
}

/* =========================================
   رسائل الحالة
========================================= */

function showStatus(message, type = "") {
    if (!status) return;

    status.textContent = message;
    status.className = `account-status ${type}`.trim();
}

/* =========================================
   بيانات الزبون
========================================= */

function getCustomerName(user) {
    return (
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email ||
        ""
    );
}

/* =========================================
   تحديث زر الحساب
   لا يتم عرض الإيميل أو الاسم في الهيدر
========================================= */

function updateCustomerName(user) {
    const accountButton = $("openAccountModal");

    if (!accountButton) return;

    // عرض أيقونة صغيرة عند تسجيل الدخول
    accountButton.textContent = user ? "👤" : "حسابي";

    accountButton.title = user
        ? "حسابي"
        : "تسجيل الدخول";

    accountButton.setAttribute(
        "aria-label",
        user ? "فتح حسابي" : "تسجيل الدخول"
    );

    accountButton.classList.toggle(
        "customer-logged-in",
        !!user
    );

    // إزالة العنصر القديم الذي كان يعرض الاسم أو الإيميل
    const oldHeaderName = $("customerHeaderName");

    if (oldHeaderName) {
        oldHeaderName.remove();
    }
}

/* =========================================
   حالة زر تسجيل الدخول والتسجيل
========================================= */

function setBusy(busy) {
    if (!submitButton) return;

    submitButton.disabled = busy;

    submitButton.textContent = busy
        ? "يرجى الانتظار..."
        : (isRegisterMode() ? "إنشاء حساب" : "تسجيل الدخول");
}

/* =========================================
   تسجيل الدخول وإنشاء حساب جديد
========================================= */

if (form) {
    form.addEventListener("submit", async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const email = emailInput?.value.trim() || "";
        const password = passwordInput?.value || "";

        const registering = isRegisterMode();

        if (!email || !password) {
            showStatus(
                "يرجى إدخال البريد الإلكتروني وكلمة المرور.",
                "error"
            );
            return;
        }

        let name = "";

        if (registering) {
            name = nameInput?.value.trim() || "";

            const confirm = confirmInput?.value || "";

            if (!name) {
                showStatus("يرجى إدخال الاسم الكامل.", "error");
                nameInput?.focus();
                return;
            }

            if (password !== confirm) {
                showStatus("كلمتا المرور غير متطابقتين.", "error");
                confirmInput?.focus();
                return;
            }

            if (password.length < 6) {
                showStatus(
                    "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
                    "error"
                );
                return;
            }
        }

        setBusy(true);

        try {
            if (registering) {

                /* إنشاء حساب جديد */

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,

                    options: {
                        data: {
                            full_name: name
                        }
                    }
                });

                if (error) throw error;

                if (data.session) {
                    updateCustomerName(data.user);

                    showStatus(
                        "تم إنشاء الحساب بنجاح.",
                        "success"
                    );

                    form.reset();

                } else {
                    showStatus(
                        "تم إنشاء الحساب. يمكنك الآن تجربة تسجيل الدخول إذا كان تأكيد البريد معطلاً.",
                        "success"
                    );
                }

            } else {

                /* تسجيل الدخول */

                const { data, error } =
                    await supabase.auth.signInWithPassword({
                        email,
                        password
                    });

                if (error) throw error;

                updateCustomerName(data.user);

                showStatus(
                    `أهلاً ${getCustomerName(data.user)}، تم تسجيل الدخول.`,
                    "success"
                );

                passwordInput.value = "";
            }

        } catch (error) {
            console.error("Customer authentication:", error);

            showStatus(
                error.message || "حدث خطأ، حاول مرة ثانية.",
                "error"
            );

        } finally {
            setBusy(false);
        }

    }, true);
}

/* =========================================
   نسيت كلمة المرور
   إرسال رابط إلى البريد الإلكتروني
========================================= */

if (forgotButton) {
    forgotButton.addEventListener("click", async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const email = emailInput?.value.trim() || "";

        if (!email) {
            showStatus(
                "اكتب بريدك الإلكتروني أولاً، ثم اضغط نسيت كلمة المرور.",
                "error"
            );

            emailInput?.focus();
            return;
        }

        if (!emailInput.checkValidity()) {
            showStatus(
                "يرجى إدخال بريد إلكتروني صحيح.",
                "error"
            );

            emailInput.focus();
            return;
        }

        forgotButton.disabled = true;

        showStatus("جاري إرسال رابط استعادة كلمة المرور...");

        try {

            /* تحديد صفحة تغيير كلمة المرور */

            const redirectUrl = new URL(
                "reset-password.html",
                window.location.href
            ).href;

            /* إرسال رسالة الاستعادة */

            const { error } =
                await supabase.auth.resetPasswordForEmail(
                    email,
                    {
                        redirectTo: redirectUrl
                    }
                );

            if (error) throw error;

            showStatus(
                "إذا كان البريد مسجلاً، ستصلك رسالة تحتوي رابط تغيير كلمة المرور. تحقق من صندوق الوارد والرسائل غير المرغوب فيها.",
                "success"
            );

        } catch (error) {
            console.error("Password recovery:", error);

            showStatus(
                error.message || "تعذر إرسال رابط الاستعادة.",
                "error"
            );

        } finally {
            forgotButton.disabled = false;
        }

    }, true);
}

/* =========================================
   استعادة جلسة الزبون عند فتح الموقع
========================================= */

async function initializeCustomer() {
    try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        updateCustomerName(
            data.session?.user || null
        );

    } catch (error) {
        console.error("Customer session:", error);
    }
}

/* =========================================
   متابعة تغييرات تسجيل الدخول والخروج
========================================= */

supabase.auth.onAuthStateChange((_event, session) => {
    updateCustomerName(
        session?.user || null
    );
});

/* =========================================
   تشغيل التهيئة
========================================= */

initializeCustomer();
