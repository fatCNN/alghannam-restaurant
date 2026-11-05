
// =====================================================
// مطعم الغنّام — المساعد الذكي ليلى
// استخدام اتصال Supabase المشترك
// =====================================================

import {
    supabaseClient as supabase,
    isSupabaseConfigured as readyConfig
} from './dashboard/supabase-client.js';

const VISITOR_TOKEN_KEY = 'ghannam_laila_visitor_token_v1';

const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const welcomeElement = chatMessages?.querySelector('.bot-message');

const branches = {
    kebab: {
        id: 'grill',
        name: 'المشويات والكباب',
        numbers: [
            { number: '07840000062', url: 'https://wa.me/9647840000062' },
            { number: '07740000062', url: 'https://wa.me/9647740000062' }
        ]
    },

    fast: {
        id: 'fastfood',
        name: 'الوجبات السريعة',
        numbers: [
            { number: '07840000068', url: 'https://wa.me/9647840000068' },
            { number: '07740000068', url: 'https://wa.me/9647740000068' }
        ]
    },

    falafel: {
        id: 'falafel',
        name: 'الفلافل',
        numbers: [
            { number: '07860000556', url: 'https://wa.me/9647860000556' },
            { number: '07760000552', url: 'https://wa.me/9647760000552' }
        ]
    }
};

let complaintText = '';
let complaintMode = false;
let waitingForComplaint = false;
let waitingForBranch = false;

let branchButtonsElement = null;
let whatsappButtonsElement = null;

let visitorToken = null;
let conversationId = null;
let conversationReady = false;

let assistantSettings = {
    assistant_name: 'ليلى',
    welcome_message:
        welcomeElement?.textContent ||
        'هلا والله بيك بمطعم الغنّام! 🌷',

    working_hours_text:
        'يوميًا من 6 صباحًا إلى 12 منتصف الليل',

    fallback_message:
        'عذرًا، ما لكيت جواب واضح لسؤالك. 🌷\n\n' +
        'تگدر تسأل عن الفروع والدوام والمنيو والعروض، ' +
        'أو تضغط «تقديم شكوى» حتى توصل ملاحظتك إلى واتساب الفرع.',

    assistant_enabled: true
};

const renderedMessageIds = new Set();

let pollingHandle = null;
let historyBusy = false;
let lastPersist = Promise.resolve();


// =====================================================
// التحقق من عناصر الصفحة
// =====================================================

if (!chatMessages || !chatForm || !userInput) {
    console.error(
        'ليلى: لم يتم العثور على عناصر المحادثة المطلوبة في HTML.'
    );
}


// =====================================================
// إنشاء رمز الزائر
// =====================================================

function getVisitorToken() {
    try {
        let token = localStorage.getItem(VISITOR_TOKEN_KEY);

        if (!token) {
            token = crypto.randomUUID();
            localStorage.setItem(VISITOR_TOKEN_KEY, token);
        }

        return token;

    } catch (error) {
        console.warn(
            'تعذر حفظ رمز المحادثة محليًا:',
            error
        );

        return crypto.randomUUID();
    }
}


// =====================================================
// إضافة رسالة إلى الصفحة
// =====================================================

function appendMessageToPage(text, sender = 'bot', id = '') {
    const message = document.createElement('div');

    message.className =
        'message ' +
        (
            sender === 'visitor' || sender === 'user'
                ? 'user-message'
                : 'bot-message'
        );

    if (sender === 'staff') {
        message.classList.add('staff-message');
    }

    if (id) {
        message.dataset.messageId = id;
        renderedMessageIds.add(id);
    }

    message.textContent = text;

    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return message;
}


// =====================================================
// حفظ الرسائل في Supabase
// =====================================================

async function persistMessage(text, senderRole) {
    if (!supabase || !visitorToken) {
        return null;
    }

    await ensureConversation();

    const { data, error } = await supabase.rpc(
        'laila_add_public_message',
        {
            p_visitor_token: visitorToken,
            p_sender_role: senderRole,
            p_content: text
        }
    );

    if (error) {
        throw error;
    }

    return data;
}


function queuePersist(text, senderRole, element) {
    if (!supabase) {
        return;
    }

    lastPersist = lastPersist
        .then(async () => {
            const saved = await persistMessage(
                text,
                senderRole
            );

            if (saved?.id) {
                element.dataset.messageId = saved.id;
                renderedMessageIds.add(saved.id);
            }
        })
        .catch(error => {
            console.warn(
                'تعذر حفظ رسالة ليلى في قاعدة البيانات:',
                error.message || error
            );
        });
}


function addMessage(text, sender = 'bot') {
    const role = sender === 'user'
        ? 'visitor'
        : 'laila';

    const element = appendMessageToPage(text, sender);

    queuePersist(text, role, element);

    return element;
}


// =====================================================
// إدارة أزرار الفروع وواتساب
// =====================================================

function removeBranchButtons() {
    if (branchButtonsElement) {
        branchButtonsElement.remove();
        branchButtonsElement = null;
    }
}


function removeWhatsAppButtons() {
    if (whatsappButtonsElement) {
        whatsappButtonsElement.remove();
        whatsappButtonsElement = null;
    }
}


// =====================================================
// فتح محادثة الزائر
// =====================================================

async function ensureConversation() {
    if (conversationReady) {
        return conversationId;
    }

    if (!supabase) {
        throw new Error(
            'اتصال قاعدة بيانات ليلى غير مضبوط.'
        );
    }

    if (!visitorToken) {
        visitorToken = getVisitorToken();
    }

    const { data, error } = await supabase.rpc(
        'laila_open_conversation',
        {
            p_visitor_token: visitorToken
        }
    );

    if (error) {
        throw error;
    }

    conversationId = data?.id || null;

    if (!conversationId) {
        throw new Error(
            'لم يتم فتح سجل المحادثة.'
        );
    }

    conversationReady = true;

    return conversationId;
}


// =====================================================
// تحميل سجل المحادثة
// =====================================================

async function refreshConversationHistory({ replace = false } = {}) {
    if (!supabase || historyBusy) {
        return;
    }

    historyBusy = true;

    try {
        await ensureConversation();

        const { data, error } = await supabase.rpc(
            'laila_get_history',
            {
                p_visitor_token: visitorToken
            }
        );

        if (error) {
            throw error;
        }

        const rows = Array.isArray(data?.messages)
            ? data.messages
            : [];

        if (replace) {
            chatMessages.replaceChildren();
            renderedMessageIds.clear();
        }

        for (const row of rows) {
            if (!row.id || renderedMessageIds.has(row.id)) {
                continue;
            }

            const sender =
                row.sender_role === 'visitor'
                    ? 'visitor'
                    : row.sender_role;

            appendMessageToPage(
                row.content,
                sender,
                row.id
            );
        }

        if (data?.conversation?.status === 'closed') {
            // تبقى واجهة الزبون متاحة لمواصلة المحادثة.
        }

    } catch (error) {
        console.warn(
            'تعذر تحديث سجل محادثة ليلى:',
            error.message || error
        );

    } finally {
        historyBusy = false;
    }
}


// =====================================================
// طلب موظف
// =====================================================

async function requestStaff(branchId = null) {
    if (!supabase) {
        return;
    }

    try {
        await ensureConversation();

        const { error } = await supabase.rpc(
            'laila_request_staff',
            {
                p_visitor_token: visitorToken,
                p_branch_id: branchId
            }
        );

        if (error) {
            throw error;
        }

    } catch (error) {
        console.warn(
            'تعذر تسجيل طلب الموظف:',
            error.message || error
        );
    }
}


async function cancelStaffRequest() {
    if (!supabase || !visitorToken) {
        return;
    }

    try {
        await ensureConversation();

        await supabase.rpc(
            'laila_cancel_staff_request',
            {
                p_visitor_token: visitorToken
            }
        );

    } catch (error) {
        console.warn(
            'تعذر إلغاء طلب الموظف:',
            error.message || error
        );
    }
}


// =====================================================
// إعدادات المساعد
// =====================================================

async function loadAssistantSettings() {
    if (!supabase) {
        return;
    }

    const { data, error } = await supabase.rpc(
        'laila_get_public_settings'
    );

    if (error) {
        throw error;
    }

    if (data) {
        assistantSettings = {
            ...assistantSettings,
            ...data
        };
    }

    document.title =
        `${assistantSettings.assistant_name || 'ليلى'} | مطعم الغنّام`;

    const title = document.querySelector('.header-info h1');

    if (title) {
        title.textContent =
            assistantSettings.assistant_name || 'ليلى';
    }

    if (!assistantSettings.assistant_enabled) {
        userInput.disabled = true;

        chatForm
            .querySelector('button[type="submit"]')
            ?.setAttribute('disabled', '');

        document.querySelectorAll('[data-action]')
            .forEach(button => {
                button.disabled = true;
            });

        userInput.placeholder =
            'المساعد غير متاح حاليًا';
    }

    const note = document.querySelector('.footer-note');

    if (note) {
        note.textContent =
            'قد تُحفظ المحادثة لمتابعة الاستفسارات والشكاوى والرد عليها من موظفي مطعم الغنّام. لا ترسل معلومات بنكية أو كلمات مرور.';
    }
}


// =====================================================
// تشغيل ليلى والاتصال بقاعدة البيانات
// =====================================================

async function initializeLailaChat() {
    if (!readyConfig || !supabase) {
        console.warn(
            'إعداد Supabase غير مكتمل؛ ستعمل ليلى محليًا دون حفظ المحادثات.'
        );

        return;
    }

    visitorToken = getVisitorToken();

    try {
        await loadAssistantSettings();

        await ensureConversation();

        const { data, error } = await supabase.rpc(
            'laila_get_history',
            {
                p_visitor_token: visitorToken
            }
        );

        if (error) {
            throw error;
        }

        const rows = Array.isArray(data?.messages)
            ? data.messages
            : [];

        if (rows.length) {
            await refreshConversationHistory({
                replace: true
            });

        } else if (welcomeElement) {
            welcomeElement.textContent =
                assistantSettings.welcome_message;

            const saved = await persistMessage(
                assistantSettings.welcome_message,
                'laila'
            );

            if (saved?.id) {
                welcomeElement.dataset.messageId = saved.id;
                renderedMessageIds.add(saved.id);
            }
        }

        if (pollingHandle) {
            clearInterval(pollingHandle);
        }

        pollingHandle = setInterval(
            () => refreshConversationHistory(),
            8000
        );

    } catch (error) {
        console.error(
            'لم يتم تفعيل حفظ محادثات ليلى:',
            error.message || error
        );
    }
}


// =====================================================
// اختيار الفرع
// =====================================================

function showBranchChoices() {
    removeBranchButtons();
    removeWhatsAppButtons();

    const wrapper = document.createElement('div');

    wrapper.className = 'branch-options';

    const options = [
        ['🥩 المشويات والكباب', 'kebab'],
        ['🍔 الوجبات السريعة', 'fast'],
        ['🧆 الفلافل', 'falafel']
    ];

    options.forEach(([label, key]) => {
        const button = document.createElement('button');

        button.type = 'button';
        button.textContent = label;

        button.addEventListener('click', () => {
            addMessage(label, 'user');

            removeBranchButtons();

            waitingForBranch = false;

            requestStaff(branches[key].id);

            showWhatsAppNumbers(key);
        });

        wrapper.appendChild(button);
    });

    const cancel = document.createElement('button');

    cancel.type = 'button';
    cancel.className = 'cancel-action';
    cancel.textContent = 'إلغاء';

    cancel.addEventListener('click', () => {
        void cancelStaffRequest();

        removeBranchButtons();
        removeWhatsAppButtons();

        complaintMode = false;
        waitingForComplaint = false;
        waitingForBranch = false;

        complaintText = '';

        userInput.placeholder =
            'اكتب سؤالك أو تفاصيل الشكوى...';

        addMessage(
            'تم إلغاء العملية. إذا احتجت أي مساعدة أني حاضرة.'
        );
    });

    wrapper.appendChild(cancel);

    chatMessages.appendChild(wrapper);

    branchButtonsElement = wrapper;

    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// =====================================================
// أرقام واتساب الفروع
// =====================================================

function showWhatsAppNumbers(branchKey) {
    removeBranchButtons();
    removeWhatsAppButtons();

    const branch = branches[branchKey];

    if (!branch) {
        return;
    }

    addMessage(
        `فرع ${branch.name} عنده رقمين واتساب. اختار الرقم اللي تفضله.`
    );

    const wrapper = document.createElement('div');

    wrapper.className = 'whatsapp-options';

    branch.numbers.forEach(item => {
        const link = document.createElement('a');

        link.className = 'whatsapp-option';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        link.textContent = `واتساب ${item.number}`;

        const messageText = complaintMode
            ? (
                'مرحبًا، أتواصل معكم من موقع مطعم الغنّام لتقديم شكوى.\n' +
                'الفرع: ' + branch.name + '\n' +
                'تفاصيل الشكوى: ' + complaintText + '\n' +
                'أرجو مراجعة الشكوى والتواصل معي.'
            )
            : (
                'مرحبًا، أتواصل معكم من موقع مطعم الغنّام.\n' +
                'أرغب بالتحدث مع موظف فرع ' + branch.name + '.'
            );

        link.href =
            item.url + '?text=' + encodeURIComponent(messageText);

        wrapper.appendChild(link);
    });

    chatMessages.appendChild(wrapper);

    whatsappButtonsElement = wrapper;

    if (complaintMode) {
        addMessage(
            'جهزت رسالة الشكوى مع اسم الفرع والتفاصيل. 🌷\n' +
            'اضغط على رقم واتساب، وراجع الرسالة ثم اضغط «إرسال» داخل واتساب حتى تصل للموظف.'
        );

    } else {
        addMessage(
            'اضغط على رقم واتساب المناسب حتى تفتح المحادثة مع الفرع. تگدر تعدل الرسالة قبل إرسالها.'
        );
    }

    complaintMode = false;
    complaintText = '';
    waitingForBranch = false;

    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// =====================================================
// تقديم شكوى
// =====================================================

function startComplaint(prefilledText = '') {
    removeBranchButtons();
    removeWhatsAppButtons();

    complaintMode = true;
    waitingForComplaint = false;
    waitingForBranch = false;

    complaintText = prefilledText.trim();

    if (complaintText) {
        addMessage(
            'راح نجهز شكواك حتى تراسل الفرع المعني. 🌷\n\nاختار الفرع اللي يخص المشكلة.'
        );

        waitingForBranch = true;

        showBranchChoices();

    } else {
        waitingForComplaint = true;

        addMessage(
            'أكيد، رأيك يهمنا ونريد نساعدك. 🌷\n\n' +
            'اكتب تفاصيل الشكوى برسالة وحدة، مثل تأخر الطلب أو مشكلة بالأكل أو الخدمة.'
        );

        userInput.placeholder =
            'اكتب تفاصيل الشكوى هنا...';

        userInput.focus();
    }
}


// =====================================================
// التواصل مع موظف
// =====================================================

function startStaffContact() {
    removeBranchButtons();
    removeWhatsAppButtons();

    complaintMode = false;
    complaintText = '';

    waitingForComplaint = false;
    waitingForBranch = true;

    requestStaff();

    addMessage(
        'حاضر، راح أساعدك تتواصل ويا موظف حقيقي. 👩‍💼'
    );

    showBranchChoices();
}


// =====================================================
// قراءة أسماء الفروع
// =====================================================

async function loadBranchNames() {
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase
        .from('branches')
        .select('id,name,description')
        .eq('is_active', true)
        .order('sort_order');

    if (error) {
        throw error;
    }

    return data || [];
}


// =====================================================
// الرد بمعلومات الفروع
// =====================================================

async function replyWithBranchInfo() {
    try {
        const rows = await loadBranchNames();

        if (rows?.length) {
            addMessage(
                'عناوين فروع مطعم الغنّام 📍\n\n' +
                rows.map(row =>
                    `${row.name}: ${row.description || 'يرجى التواصل مع الفرع لمعرفة العنوان.'}`
                ).join('\n\n') +
                '\n\nأرقام التواصل والخرائط موجودة أسفل الصفحة.'
            );

            return;
        }

    } catch (error) {
        console.warn(
            'تعذر قراءة بيانات الفروع لليلى:',
            error.message || error
        );
    }

    addMessage(
        'عناوين فروع مطعم الغنّام 📍\n\n' +
        'المشويات والكباب: الدورة، شارع المصافي، مجاور مصرف الرشيد.\n\n' +
        'الوجبات السريعة: الدورة، شارع المصافي.\n\n' +
        'الفلافل: الإعلام، سوق أميمة، مقابل جامع المصطفى.\n\n' +
        'روابط الخرائط ومعلومات التواصل موجودة أسفل الصفحة.'
    );
}


// =====================================================
// قراءة العروض
// =====================================================

async function replyWithOffers() {
    if (!supabase) {
        addMessage(
            'للاطلاع على العروض الحالية، راجع صفحة المطعم أو تواصل مع الفرع.'
        );

        return;
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('offers')
        .select(
            'name,description,original_price,offer_price,branch_id,branches(name)'
        )
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('sort_order')
        .limit(10);

    if (error) {
        console.warn(
            'تعذر قراءة العروض:',
            error.message
        );

        addMessage(
            'ما كدرت أحمّل العروض حاليًا. تواصل مع الفرع للتأكد من العروض المتاحة.'
        );

        return;
    }

    if (!data?.length) {
        addMessage(
            'حاليًا ما عندي عروض فعّالة مسجلة. تابعنا حتى تعرف العروض الجديدة. 🌷'
        );

        return;
    }

    addMessage(
        'هاي العروض الفعّالة حاليًا 🌟\n\n' +
        data.map((offer, index) =>
            `${index + 1}. ${offer.name}\n` +
            `السعر: ${Number(offer.offer_price).toLocaleString('en-US')} د.ع ` +
            `بدل ${Number(offer.original_price).toLocaleString('en-US')} د.ع` +
            (
                offer.branches?.name
                    ? `\nالفرع: ${offer.branches.name}`
                    : '\nالعرض: كل الفروع'
            ) +
            (
                offer.description
                    ? `\n${offer.description}`
                    : ''
            )
        ).join('\n\n')
    );
}


// =====================================================
// البحث عن أسعار المنتجات
// =====================================================

async function searchProductPrice(message) {
    if (!supabase) {
        return false;
    }

    const cleaned = message
        .replace(
            /كم|سعر|أسعار|السعر|بكم|شنو|شكد|عندكم|عندك|موجود|متوفر|المنيو|منيو|قائمة|الأكل|الاكل|وجبة|الوجبة|ممكن|أريد|اريد|اعرف|معرفة|هو|هي|؟|\?/g,
            ' '
        )
        .replace(/\s+/g, ' ')
        .trim();

    const terms = cleaned
        .split(' ')
        .filter(word => word.length >= 2)
        .slice(-4);

    if (!terms.length) {
        return false;
    }

    const search = terms.join(' ');

    let query = supabase
        .from('products')
        .select(
            'name,price,branch_id,categories(name),branches(name)'
        )
        .eq('is_available', true)
        .ilike('name', `%${search}%`)
        .limit(8);

    let { data, error } = await query;

    if (
        !error &&
        (!data || !data.length) &&
        terms.length > 1
    ) {
        ({ data, error } = await supabase
            .from('products')
            .select(
                'name,price,branch_id,categories(name),branches(name)'
            )
            .eq('is_available', true)
            .ilike(
                'name',
                `%${terms[terms.length - 1]}%`
            )
            .limit(8));
    }

    if (error || !data?.length) {
        return false;
    }

    addMessage(
        'لكيت هذي الأصناف القريبة من سؤالك بالمنيو الحالي: 🍽️\n\n' +
        data.map((item, index) =>
            `${index + 1}. ${item.name}\n` +
            `السعر: ${Number(item.price).toLocaleString('en-US')} د.ع\n` +
            `الفرع: ${item.branches?.name || item.branch_id}` +
            (
                item.categories?.name
                    ? `\nالقسم: ${item.categories.name}`
                    : ''
            )
        ).join('\n\n') +
        '\n\nالأسعار حسب المنيو المسجل حاليًا، وتأكد من الفرع قبل الطلب.'
    );

    return true;
}


// =====================================================
// تحديد رد ليلى
// =====================================================

async function getBotReply(message) {
    const text = message.trim().toLowerCase();

    if (
        text === '#' ||
        text.includes('أريد موظف') ||
        text.includes('اريد موظف') ||
        text.includes('موظف حقيقي')
    ) {
        startStaffContact();
        return;
    }

    if (
        text.includes('شكوى') ||
        text.includes('شكوه') ||
        text.includes('أشتكي') ||
        text.includes('اشتكي') ||
        text.includes('اعتراض')
    ) {
        startComplaint();
        return;
    }

    if (
        text.includes('عرض') ||
        text.includes('عروض') ||
        text.includes('خصم')
    ) {
        await replyWithOffers();
        return;
    }

    if (
        text.includes('فرع') ||
        text.includes('عنوان') ||
        text.includes('وين') ||
        text.includes('موقع')
    ) {
        await replyWithBranchInfo();
        return;
    }

    if (
        text.includes('وقت') ||
        text.includes('ساعات') ||
        text.includes('يفتح') ||
        text.includes('يغلق') ||
        text.includes('دوام')
    ) {
        addMessage(
            `حسب المعلومات المتوفرة، فروع مطعم الغنّام تعمل ${assistantSettings.working_hours_text}. 🕒`
        );

        return;
    }

    if (
        text.includes('طلب') ||
        text.includes('توصيل') ||
        text.includes('أوردر') ||
        text.includes('اوردر')
    ) {
        addMessage(
            'حتى تطلب، ارجع للصفحة الرئيسية واختار الفرع والمنيو المناسب. 🍽️\n\n' +
            'إذا واجهتك مشكلة بالطلب، اضغط «تقديم شكوى» واكتب تفاصيلها.'
        );

        return;
    }

    if (
        text.includes('منيو') ||
        text.includes('قائمة') ||
        text.includes('أكل') ||
        text.includes('اكل') ||
        text.includes('سعر') ||
        text.includes('أسعار') ||
        text.includes('بكم') ||
        text.includes('شكد')
    ) {
        const found = await searchProductPrice(message);

        if (found) {
            return;
        }

        addMessage(
            'تگدر تشوف المنيو والأسعار من صفحات الفروع. ' +
            'اكتب اسم الوجبة اللي تريد تعرف سعرها، أو اسألني عن عرض حالي.'
        );

        return;
    }

    if (
        text.includes('مرحبا') ||
        text.includes('هلا') ||
        text.includes('السلام') ||
        text.includes('أهلا') ||
        text.includes('اهلا')
    ) {
        addMessage(
            'هلا بيك ونورت مطعم الغنّام! 🌷\n' +
            'شنو أگدر أساعدك بيه؟ تگدر تسأل عن الفروع أو الدوام أو المنيو أو العروض.'
        );

        return;
    }

    if (
        text.includes('شكرا') ||
        text.includes('شكرًا')
    ) {
        addMessage(
            'العفو، تدلل! 💚 نورت مطعم الغنّام.'
        );

        return;
    }

    addMessage(assistantSettings.fallback_message);
}


// =====================================================
// إرسال رسالة الزبون
// =====================================================

function sendMessage(text) {
    const cleanText = text.trim();

    if (!cleanText) {
        return;
    }

    addMessage(cleanText, 'user');

    userInput.value = '';

    if (waitingForComplaint) {
        complaintText = cleanText;

        waitingForComplaint = false;
        waitingForBranch = true;

        addMessage(
            'وصلتني تفاصيل الشكوى. شكرًا لأن وضحتلنا المشكلة. 🌷\n\n' +
            'هسه اختار الفرع المعني حتى أجهز رسالة واتساب تتضمن شكواك.'
        );

        userInput.placeholder =
            'اكتب سؤالك أو تفاصيل الشكوى...';

        showBranchChoices();

        return;
    }

    if (waitingForBranch) {
        addMessage(
            'بعدنا ننتظر اختيار الفرع من الأزرار الظاهرة بالمحادثة.'
        );

        return;
    }

    void getBotReply(cleanText);
}


// =====================================================
// أحداث نموذج المحادثة
// =====================================================

if (chatForm && userInput) {
    chatForm.addEventListener('submit', event => {
        event.preventDefault();

        sendMessage(userInput.value);
    });
}


// =====================================================
// أزرار المساعدة السريعة
// =====================================================

document.querySelectorAll('[data-action]')
    .forEach(button => {

        button.addEventListener('click', () => {
            const action = button.dataset.action;

            if (action === 'complaint') {
                addMessage('📝 تقديم شكوى', 'user');
                startComplaint();

            } else if (action === 'staff') {
                addMessage('أريد موظف', 'user');
                startStaffContact();

            } else if (action === 'branches') {
                addMessage('عناوين الفروع', 'user');
                void replyWithBranchInfo();

            } else if (action === 'hours') {
                addMessage('أوقات العمل', 'user');

                addMessage(
                    `حسب المعلومات المتوفرة، فروع مطعم الغنّام تعمل ${assistantSettings.working_hours_text}. 🕒`
                );

            } else if (action === 'menu') {
                addMessage('المنيو والأسعار', 'user');

                addMessage(
                    'اكتب اسم الوجبة أو اسألني عن سعرها حتى أبحث لك في المنيو الحالي. وتگدر تسأل أيضًا عن العروض.'
                );
            }
        });
    });


// =====================================================
// تشغيل المساعد
// =====================================================

void initializeLailaChat();
