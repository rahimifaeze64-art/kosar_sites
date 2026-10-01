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
window.SESSION_VERSION = '2026-10-01-force-relogin-2';
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
            clearSupabaseSession();
        }

        if (localStorage.getItem('sessionVersion') !== window.SESSION_VERSION) {
            forceLogout();
            window.location.replace('landing.html');
        }
    } catch(e) {}
})();

// ════════════════════════════════════════════════════════════════════
// ⚙️  تنظیمات اتصال — این دو مقدار را با مقادیر واقعی پروژه‌ات جایگزین کن
//    Settings > API در داشبورد Supabase:
//      Project URL  → SUPABASE_URL
//      anon/public  → SUPABASE_ANON_KEY
// ════════════════════════════════════════════════════════════════════
const SUPABASE_URL      = 'https://tyzrexkneoexmcegaxlc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5enJleGtuZW9leG1jZWdheGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MTcwMjMsImV4cCI6MjEwNTM5MzAyM30.xw_dY8jT13Kt0G1JCg3HaiL5l_0fgVE-9POkxn8jLOU';

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

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,           // نشست را در localStorage نگه می‌دارد
            autoRefreshToken: true,         // توکن را به‌صورت خودکار تجدید می‌کند
            detectSessionInUrl: true
        }
    });

    console.log('✅ Supabase client ساخته شد');
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
