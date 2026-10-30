// ============================================================
// js/supabase-env.js
// ⚠️ تنها منبع حقیقت (Single Source of Truth) برای تنظیمات Supabase
// این فایل باید در <head> همهٔ صفحات — قبل از هر اسکریپت دیگر —
// بارگذاری شود؛ در غیر این صورت inline scriptها مقدار ندارند.
// ============================================================
window.SB_ENV = {
    // آدرس self-hosted سوپابیس (Kong gateway) — HTTPS (Realtime خودکار WSS می‌شود)
    url: 'https://supa.alkawthar.info',

    // publishable key — کلید عمومی؛ فقط در هدر `apikey` استفاده می‌شود
    publishableKey: 'sb_publishable_tnnaReMVB5S47UOmxy3_Cp_AuJ9aanV',

    // legacy anon JWT — فقط به‌عنوان fallback برای هدر Authorization وقتی
    // هنوز نشست کاربر (access token) در دسترس نیست. (توکن anon است، نه service_role)
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzMzg0NzY1LCJleHAiOjE5NTEwNjQ3NjV9.L9pywhM220qbWzAWN8lNEdqCXc_4InN_lWeW19Zly5w',

    // دامنهٔ فرانت (برای CORS سمت سرور)
    appOrigin: 'https://alkawthar.info'
};

// اعتبارسنجی سریع در کنسول
(function () {
    try {
        if (!/^https:\/\//.test(window.SB_ENV.url)) {
            console.error('❌ SB_ENV.url باید با https:// شروع شود (وگرنه Mixed Content می‌گیری):', window.SB_ENV.url);
        }
    } catch (e) {}
})();
