// ============================================================
// js/supabase-config.js
// تنظیمات مرکزی اتصال به Supabase
// ⚠️  مقادیر YOUR_SUPABASE_URL و YOUR_SUPABASE_ANON_KEY را
//     با مقادیر واقعی پروژه‌ات جایگزین کن.
// ============================================================

// ════════════════════════════════════════════════════════════════════
// 🔐 Session Version Guard — خروج اجباری همهٔ کاربران
// این فایل با «?v=timestamp» بارگذاری می‌شود، پس حتی اگر
// index.html توسط مرورگر کش شده باشد، این گارد همیشه تازه اجرا می‌شود.
// برای بیرون کردن اجباری همه در هر دپلوی: فقط SESSION_VERSION را عوض کن
// (همین مقدار باید در index.html و login.html هم یکسان باشد).
// ════════════════════════════════════════════════════════════════════
window.SESSION_VERSION = '2026-10-31-supabase-selfhosted';
(function() {
    try {
        var p = (window.location.pathname || '').toLowerCase();
        var isAppPage = (p === '/' || p === '' ||
                         p.slice(-11) === '/index.html' ||
                         p.slice(-10) === 'index.html');
        if (!isAppPage) return;          // فقط صفحهٔ اصلی اپ
        if (window.top !== window) return; // داخل iframe اجرا نشود

        function clearSupabaseSession() {
            try {
                var toRemove = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (!k) continue;
                    if (k.indexOf('sb-') === 0 && k.indexOf('-auth-token') !== -1) toRemove.push(k);
                    if (k === 'supabase.auth.token') toRemove.push(k);
                }
                for (var j = 0; j < toRemove.length; j++) localStorage.removeItem(toRemove[j]);
            } catch(e) {}
        }
        function forceLogout() {
            try {
                localStorage.removeItem('currentUser');
                localStorage.removeItem('edu_system_current_user');
                localStorage.removeItem('sessionVersion');
            } catch(e) {}
            try { if (window.StorageHealth) StorageHealth.clearSessionVersion(); } catch(e) {}
            clearSupabaseSession();
        }

        var ver = window.StorageHealth && window.StorageHealth.getSessionVersion
            ? window.StorageHealth.getSessionVersion()
            : localStorage.getItem('sessionVersion');
        if (ver !== window.SESSION_VERSION) {
            forceLogout();
            window.location.replace('landing.html');
        }
    } catch(e) {}
})();

// ════════════════════════════════════════════════════════════════════
// ⚙️  تنظیمات اتصال — از js/supabase-env.js (منبع واحد) خوانده می‌شود
//    اگر supabase-env.js بارگذاری نشده باشد، مقادیر پیش‌فرض زیر استفاده
//    می‌شوند (هر دو باید یکسان بمانند).
// ════════════════════════════════════════════════════════════════════
// Supabase self-hosted (Kong gateway) — HTTPS.
// Realtime به‌صورت خودکار از همین دامنه wss:// می‌سازد.
const SUPABASE_URL             = (window.SB_ENV && window.SB_ENV.url)            || 'https://supa.alkawthar.info';
const SUPABASE_PUBLISHABLE_KEY = (window.SB_ENV && window.SB_ENV.publishableKey) || 'sb_publishable_tnnaReMVB5S47UOmxy3_Cp_AuJ9aanV';
const SUPABASE_ANON_KEY        = (window.SB_ENV && window.SB_ENV.anonKey)        || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzMzg0NzY1LCJleHAiOjE5NTEwNjQ3NjV9.L9pywhM220qbWzAWN8lNEdqCXc_4InN_lWeW19Zly5w';

// ── توکن دسترسی کاربر (کش‌شده) ───────────────────────────────
// برای درخواست‌های REST دستی: به‌جای فرستادن کلید عمومی در هدر Bearer،
// از access token واقعی نشست استفاده می‌کنیم. اگر کاربر لاگین نباشد،
// به anon JWT برمی‌گردیم (همان رفتار قبلی).
let __supabaseAccessToken = null;

function getSupabaseAccessToken() {
    return __supabaseAccessToken || null;
}

// هدرهای استاندارد Supabase برای fetch دستی
function getSupabaseRestHeaders(extra) {
    const token = getSupabaseAccessToken() || SUPABASE_ANON_KEY;
    const headers = {
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': 'Bearer ' + token
    };
    if (extra) {
        Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
    }
    return headers;
}

// ── singleton client ─────────────────────────────────────────
let supabaseClient = null;

function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;

    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
        console.error('❌ Supabase SDK بارگذاری نشده است. SDK را در HTML بارگذاری کن.');
        return null;
    }

    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.error('❌ مقادیر SUPABASE_URL و SUPABASE_ANON_KEY را تنظیم کن!');
        return null;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            persistSession: true,           // نشست را در localStorage نگه می‌دارد
            autoRefreshToken: true,         // توکن را به‌صورت خودکار تجدید می‌کند
            detectSessionInUrl: true
        }
    });

    // کش access token برای درخواست‌های REST دستی (بدون ساخت client دوم)
    try {
        supabaseClient.auth.onAuthStateChange(function (_event, session) {
            __supabaseAccessToken = (session && session.access_token) ? session.access_token : null;
        });
        supabaseClient.auth.getSession().then(function (res) {
            __supabaseAccessToken = (res && res.data && res.data.session && res.data.session.access_token) || null;
        }).catch(function () { /* نشستی وجود ندارد */ });
    } catch (e) {
        console.warn('⚠️ ثبت listener توکن Supabase ناموفق:', e.message);
    }

    console.log('✅ Supabase client ساخته شد →', SUPABASE_URL);
    return supabaseClient;
}

// ── وضعیت اتصال ─────────────────────────────────────────────
const SupabaseConnection = {
    isOnline: false,        // آیا اتصال به Supabase فعال است
    isConfigured: false,    // آیا URL و Key تنظیم شده‌اند

    async check() {
        if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
            this.isConfigured = false;
            this.isOnline = false;
            return false;
        }
        this.isConfigured = true;

        try {
            const client = getSupabaseClient();
            if (!client) { this.isOnline = false; return false; }

            // یک query ساده برای تست اتصال
            const { error } = await client.from('profiles').select('id').limit(1);
            if (error && error.code !== 'PGRST116') {
                // PGRST116 = جدول خالی است، ولی اتصال برقرار است
                console.warn('⚠️ Supabase اتصال با خطا:', error.message);
                this.isOnline = false;
                return false;
            }
            this.isOnline = true;
            return true;
        } catch (e) {
            console.warn('⚠️ Supabase در دسترس نیست:', e.message);
            this.isOnline = false;
            return false;
        }
    }
};

// ── ترجمه خطاهای Supabase به فارسی ─────────────────────────
function translateSupabaseError(error) {
    if (!error) return 'خطای حکیم';
    const msg = error.message || error.toString();

    const map = {
        'Invalid login credentials':           'نام کاربری یا رمز عبور اشتباه است',
        'Email not confirmed':                 'ایمیل تأیید نشده است',
        'User already registered':             'این کاربر قبلاً ثبت شده است',
        'Password should be at least 6':       'رمز عبور باید حداقل ۶ کاراکتر باشد',
        'JWT expired':                         'نشست منقضی شده، لطفاً دوباره وارد شوید',
        'not authenticated':                   'احراز هویت نشده‌اید',
        'duplicate key value':                 'این مقدار قبلاً ثبت شده است',
        'violates foreign key constraint':     'داده مرتبط وجود ندارد',
        'violates not-null constraint':        'فیلد الزامی خالی است',
        'permission denied':                   'دسترسی مجاز نیست',
        'Failed to fetch':                     'اتصال به اینترنت قطع است',
        'NetworkError':                        'خطای شبکه — اتصال اینترنت را بررسی کن',
        'timeout':                             'زمان اتصال به پایان رخانم',
    };

    for (const [key, fa] of Object.entries(map)) {
        if (msg.includes(key)) return fa;
    }
    return msg;
}

console.log('📦 supabase-config.js بارگذاری شد');
