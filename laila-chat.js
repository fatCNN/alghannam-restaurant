
// =====================================================
// مطعم الغنّام — المساعد الذكي ليلى
// Supabase + بحث المنتجات والأسعار بالعربي والإنجليزي
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

const BRANCH_KEYWORDS = {
    grill: [
        'مشاوي', 'مشويات', 'كباب', 'كص', 'دجاج مشوي',
        'لحم مشوي', 'تكة', 'غنم'
    ],

    fastfood: [
        'وجبات سريعة', 'سريع', 'بركر', 'برغر',
        'بيتزا', 'شاورما', 'ريزو', 'كنتاكي',
        'ستربس', 'صاج', 'فنكر', 'بطاطا'
    ],

    falafel: [
        'فلافل', 'لفة فلافل', 'صاج فلافل'
    ]
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
        'تگدر تسأل عن الفروع والدوام والمنيو والأسعار والعروض، ' +
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
// أدوات معالجة النص العربي والإنجليزي
// =====================================================

function normalizeText(value = '') {
    return String(value)
        .toLowerCase()
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[ًٌٍَُِّْـ]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}


const STOP_WORDS = new Set([
    'كم', 'سعر', 'اسعار', 'السعر', 'بكم', 'شكد',
    'شنو', 'شنوهو', 'شنوهي', 'عندكم', 'عندك',
    'موجود', 'متوفر', 'متوفره', 'المنيو', 'منيو',
    'قائمه', 'الاكل', 'اكل', 'الوجبه', 'وجبه',
    'ممكن', 'اريد', 'اعرف', 'معرفه', 'هو', 'هي',
    'هل', 'لو', 'سمحت', 'رجاء', 'فضلا', 'من',
    'في', 'ب', 'ال', 'يا', 'علي', 'عن',
    'the', 'a', 'an', 'is', 'what', 'how',
    'price', 'prices', 'of', 'for', 'please',
    'do', 'you', 'have', 'available'
]);


function extractSearchTerms(message) {
    const normalized = normalizeText(message);

    return normalized
        .split(' ')
        .filter(word =>
            word.length >= 2 &&
            !STOP_WORDS.has(word)
        )
        .slice(0, 6);
}


function detectBranchId(message) {
    const text = normalizeText(message);

    for (const [branchId, keywords] of Object.entries(BRANCH_KEYWORDS)) {
        if (keywords.some(keyword =>
            text.includes(normalizeText(keyword))
        )) {
            return branchId;
        }
    }

    if (
        text.includes('فرع المشاوي') ||
        text.includes('فرع الكباب') ||
        text.includes('المشويات')
    ) {
        return 'grill';
    }

    if (text.includes('فرع الفلافل')) {
        return 'falafel';
    }

    if (
        text.includes('فرع الوجبات') ||
        text.includes('الوجبات السريعه')
    ) {
        return 'fastfood';
    }

    return null;
}


// =====================================================
// ترجمة خيارات المنتجات
// =====================================================

function translateOptionLabel(label) {
    const translations = {
        '1 Kg': 'كيلو واحد',
        'Half Kg': 'نصف كيلو',
        'Quarter Kg': 'ربع كيلو',
        'Dine-In': 'داخل المطعم',
        'Takeaway': 'سفري',
        'Meal': 'وجبة',
        'Small': 'صغير',
        'Medium': 'وسط',
        'Large': 'كبير',
        'Single': 'مفرد',
        'Double': 'دبل'
    };

    return translations[label] || label;
}


// =====================================================
// تنسيق السعر
// =====================================================

function formatPrice(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return null;
    }

    return number.toLocaleString('en-US') + ' د.ع';
}


// =====================================================
// تحديد اسم الفرع
// =====================================================

function getBranchName(product) {
    if (product.branches?.name) {
        return product.branches.name;
    }

    const names = {
        grill: 'المشويات والكباب',
        fastfood: 'الوجبات السريعة',
        falafel: 'الفلافل'
    };

    return names[product.branch_id] || product.branch_id || 'غير محدد';
}


// =====================================================
// تقييم مدى تطابق المنتج مع السؤال
// =====================================================

function scoreProduct(product, terms) {
    const name = normalizeText(product.name || '');
    const nameEn = normalizeText(product.name_en || '');
    const description = normalizeText(product.description || '');
    const descriptionEn = normalizeText(product.description_en || '');

    let score = 0;

    for (const term of terms) {
        if (name === term || nameEn === term) {
            score += 15;
        } else if (name.includes(term)) {
            score += 10;
        } else if (nameEn.includes(term)) {
            score += 9;
        } else if (description.includes(term)) {
            score += 3;
        } else if (descriptionEn.includes(term)) {
            score += 3;
        }
    }

    if (
        terms.length > 1 &&
        terms.every(term =>
            name.includes(term) || nameEn.includes(term)
        )
    ) {
        score += 8;
    }

    return score;
}


// =====================================================
// البحث في منتجات Supabase
// =====================================================

async function fetchProductsForTerm(term) {
    const { data, error } = await supabase
        .from('products')
        .select(`
            id,
            name,
            name_en,
            description,
            description_en,
            price,
            branch_id,
            category_id,
            is_available,
            sort_order,
            extra,
            categories(name,name_en),
            branches(name)
        `)
        .eq('is_available', true)
        .or(
            `name.ilike.%${term}%,name_en.ilike.%${term}%,description.ilike.%${term}%,description_en.ilike.%${term}%`
        )
        .order('sort_order')
        .limit(30);

    if (error) {
        throw error;
    }

    return data || [];
}


async function searchProducts(message) {
    if (!supabase) {
        return [];
    }

    const terms = extractSearchTerms(message);

    if (!terms.length) {
        return [];
    }

    const results = new Map();

    // البحث بالعبارة كاملة أولاً
    const normalizedPhrase = normalizeText(message);

    const phraseTerms = normalizedPhrase
        .split(' ')
        .filter(word =>
            word.length >= 2 &&
            !STOP_WORDS.has(word)
        );

    const searches = [];

    if (phraseTerms.length > 1) {
        searches.push(phraseTerms.join(' '));
    }

    // ثم البحث بكل كلمة مهمة
    searches.push(...terms);

    for (const term of [...new Set(searches)].slice(0, 5)) {
        try {
            const products = await fetchProductsForTerm(term);

            for (const product of products) {
                if (product.id) {
                    results.set(product.id, product);
                }
            }

        } catch (error) {
            console.warn(
                'تعذر البحث باستخدام الكلمة:',
                term,
                error.message || error
            );
        }
    }

    const requestedBranch = detectBranchId(message);

    let products = [...results.values()];

    if (requestedBranch) {
        products = products.filter(
            product => product.branch_id === requestedBranch
        );
    }

    return products
        .map(product => ({
            product,
            score: scoreProduct(product, terms)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) =>
            b.score - a.score ||
            (a.product.sort_order || 0) - (b.product.sort_order || 0)
        )
        .slice(0, 8)
        .map(item => item.product);
}


// =====================================================
// بناء تفاصيل سعر المنتج
// =====================================================

function buildProductPriceText(product) {
    const extra = product.extra && typeof product.extra === 'object'
        ? product.extra
        : {};

    const lines = [];

    lines.push(`🍽️ ${product.name}`);

    if (product.name_en) {
        lines.push(`الاسم بالإنجليزية: ${product.name_en}`);
    }

    if (product.description) {
        lines.push(`التفاصيل: ${product.description}`);
    }

    if (product.description_en) {
        lines.push(`Description: ${product.description_en}`);
    }

    // السعر يحتاج تأكيداً
    if (extra.requires_price_confirmation === true) {
        lines.push(
            'السعر: يحتاج تأكيد من الفرع قبل الطلب.'
        );

    } else {
        const options =
            extra.options &&
            typeof extra.options === 'object' &&
            !Array.isArray(extra.options)
                ? extra.options
                : null;

        // المنتجات ذات الخيارات المتعددة
        if (options && Object.keys(options).length) {
            lines.push('الخيارات والأسعار:');

            for (const [label, value] of Object.entries(options)) {
                const price = formatPrice(value);

                lines.push(
                    `• ${translateOptionLabel(label)}: ${price || 'يرجى التأكد من السعر'}`
                );
            }

        } else {
            const price = formatPrice(product.price);

            if (price) {
                lines.push(`السعر: ${price}`);
            } else {
                lines.push('السعر: غير مسجل حاليًا، يرجى التأكد من الفرع.');
            }
        }
    }

    // ترقية الوجبة
    if (
        extra.mealUpgrade === true &&
        Number(extra.meal_upgrade_price) > 0
    ) {
        lines.push(
            `ترقية إلى وجبة: إضافة ${formatPrice(extra.meal_upgrade_price)} على السعر الأساسي.`
        );
    }

    // الفرع
    lines.push(`الفرع: ${getBranchName(product)}`);

    // القسم
    if (product.categories?.name) {
        lines.push(`القسم: ${product.categories.name}`);
    }

    if (product.categories?.name_en) {
        lines.push(`Category: ${product.categories.name_en}`);
    }

    return lines.join('\n');
}


// =====================================================
// البحث عن أسعار المنتجات والرد على الزبون
// =====================================================

async function searchProductPrice(message) {
    if (!supabase) {
        return false;
    }

    const terms = extractSearchTerms(message);

    if (!terms.length) {
        return false;
    }

    try {
        const products = await searchProducts(message);

        if (!products.length) {
            return false;
        }

        const requestedBranch = detectBranchId(message);

        const heading = requestedBranch
            ? 'لكيت هذي الأصناف بفرعك المطلوب: 🍽️'
            : 'لكيت هذي الأصناف القريبة من سؤالك بالمنيو الحالي: 🍽️';

        addMessage(
            heading + '\n\n' +
            products
                .map((product, index) =>
                    `${index + 1}. ${buildProductPriceText(product)}`
                )
                .join('\n\n━━━━━━━━━━━━━━\n\n') +
            '\n\nالأسعار والمعلومات حسب البيانات المسجلة بالمنيو.'
        );

        return true;

    } catch (error) {
        console.error(
            'حدث خطأ أثناء البحث عن المنتجات:',
            error.message || error
        );

        return false;
    }
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
// تحديد رد ليلى
// =====================================================

async function getBotReply(message) {
    const text = normalizeText(message);

    if (
        text === '#' ||
        text.includes('اريد موظف') ||
        text.includes('موظف حقيقي')
    ) {
        startStaffContact();
        return;
    }

    if (
        text.includes('شكوي') ||
        text.includes('شكوه') ||
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
        text.includes('اوردر')
    ) {
        addMessage(
            'حتى تطلب، ارجع للصفحة الرئيسية واختار الفرع والمنيو المناسب. 🍽️\n\n' +
            'إذا واجهتك مشكلة بالطلب، اضغط «تقديم شكوى» واكتب تفاصيلها.'
        );

        return;
    }

    if (
        text.includes('مرحبا') ||
        text.includes('هلا') ||
        text.includes('السلام') ||
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

    // البحث عن المنتجات حتى لو لم يذكر الزبون كلمة سعر أو منيو
    const found = await searchProductPrice(message);

    if (found) {
        return;
    }

    if (
        text.includes('منيو') ||
        text.includes('قائمه') ||
        text.includes('اكل') ||
        text.includes('سعر') ||
        text.includes('بكم') ||
        text.includes('شكد')
    ) {
        addMessage(
            'ما لكيت الصنف بهذا الاسم بالمنيو المسجل. 🌷\n\n' +
            'جرب تكتب اسم الوجبة بشكل أوضح، أو حدد الفرع اللي تقصده.'
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
