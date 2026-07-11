// ============================================================
// js/supabase-init.js
// راه‌اندازی Supabase — این فایل باید آخر از همه بارگذاری شود
// (بعد از supabase-config.js، supabase-auth.js، supabase-data.js)
// ============================================================

(async function initSupabase() {
    'use strict';

    console.log('🔌 شروع راه‌اندازی Supabase...');

    // ── ۱. بررسی SDK ─────────────────────────────────────────
    if (typeof window.supabase === 'undefined') {
        console.warn('⚠️ Supabase SDK بارگذاری نشده — حالت آفلاین فعال است');
        _setOfflineMode('SDK بارگذاری نشده');
        return;
    }

    // ── ۲. بررسی پیکربندی ────────────────────────────────────
    if (typeof SUPABASE_URL === 'undefined' ||
        SUPABASE_URL === 'YOUR_SUPABASE_URL') {
        console.warn('⚠️ SUPABASE_URL تنظیم نشده — حالت آفلاین');
        _setOfflineMode('URL تنظیم نشده');
        return;
    }

    // ── ۳. ساخت client ────────────────────────────────────────
    const client = getSupabaseClient();
    if (!client) {
        _setOfflineMode('ساخت client ناموفق');
        return;
    }

    // ── ۴. تست اتصال ─────────────────────────────────────────
    const isOnline = await SupabaseConnection.check();
    if (!isOnline) {
        console.warn('⚠️ Supabase در دسترس نیست — حالت آفلاین');
        _setOfflineMode('اتصال برقرار نشد');
        _showOfflineBanner();
        return;
    }

    console.log('✅ Supabase آنلاین است');

    // ── ۵. بررسی/بازیابی نشست کاربر ─────────────────────────
    try {
        const user = await SupabaseAuth.getSession();
        if (user) {
            // به‌روزرسانی localStorage با داده‌های تازه از Supabase
            localStorage.setItem('currentUser', JSON.stringify(user));
            localStorage.setItem('edu_system_current_user', JSON.stringify(user));
            console.log('✅ نشست کاربر بازیابی شد:', user.username);

            // تنظیم Realtime subscriptions
            _setupRealtime(client, user);
        } else {
            console.log('ℹ️ کاربری لاگین نیست');
        }
    } catch (e) {
        console.warn('⚠️ بررسی نشست خطا:', e.message);
    }

    // ── ۶. migration حذف شد — پروژه از ابتدا با Supabase کار می‌کند ──

    // ── ۷. برچسب آنلاین در UI ────────────────────────────────
    _showOnlineBanner();

    // ── ۸. مانیتور قطعی اتصال ────────────────────────────────
    client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('edu_system_current_user');
            if (window.location.pathname.includes('index.html') ||
                window.location.pathname === '/') {
                window.location.href = 'login.html';
            }
        }
        if (event === 'TOKEN_REFRESHED') {
            console.log('🔄 توکن تجدید شد');
        }
    });

    console.log('✅ Supabase کاملاً راه‌اندازی شد');
})();


// ── helpers ───────────────────────────────────────────────────

function _setOfflineMode(reason) {
    if (typeof SupabaseConnection !== 'undefined') {
        SupabaseConnection.isOnline = false;
    }
    // offline-mode.js را بارگذاری می‌کنیم
    if (typeof CONFIG !== 'undefined') {
        CONFIG.API_ENABLED = false;
    }
    console.log(`📴 حالت آفلاین فعال — دلیل: ${reason}`);
}

function _showOfflineBanner() {
    // قبل از نمایش بررسی کن که قبلاً نمایش داده نشده باشد
    if (document.getElementById('supabase-offline-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'supabase-offline-banner';
    banner.style.cssText = `
        position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
        background: #1e293b; color: #f59e0b; padding: 10px 20px;
        border-radius: 8px; font-family: Vazirmatn,sans-serif; font-size: 13px;
        z-index: 9999; border: 1px solid #f59e0b; direction: rtl; text-align: right;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;
    banner.innerHTML = '📴 حالت آفلاین — داده‌ها به صورت محلی ذخیره می‌شوند';
    document.body.appendChild(banner);
    // بعد از ۵ ثانیه محو شود
    setTimeout(() => { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 5000);
}

function _showOnlineBanner() {
    if (document.getElementById('supabase-online-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'supabase-online-banner';
    banner.style.cssText = `
        position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
        background: #064e3b; color: #34d399; padding: 10px 20px;
        border-radius: 8px; font-family: Vazirmatn,sans-serif; font-size: 13px;
        z-index: 9999; border: 1px solid #34d399; direction: rtl; text-align: right;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;
    banner.innerHTML = '☁️ متصل به Supabase — داده‌ها در ابر ذخیره می‌شوند';
    document.body.appendChild(banner);
    setTimeout(() => { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 4000);
}

function _setupRealtime(client, user) {
    try {
        if (typeof SupabaseDataModule === 'undefined') return;

        // ── اتصال realtime برای orders ─────────────────────────
        SupabaseDataModule.subscribeToOrders((payload) => {
            console.log('🔄 Realtime: orders تغییر کرد', payload.eventType);
            // کش را پاک کن تا دفعه بعد داده تازه بارگذاری شود
            SupabaseDataModule._cacheInvalidate('orders');
            if (typeof RealtimeEvents !== 'undefined') {
                RealtimeEvents.emit(RealtimeEvents.EVENTS.ORDERS_CHANGED, payload);
            }
        });

        // ── اتصال realtime برای پیام‌ها ────────────────────────
        SupabaseDataModule.subscribeToMessages(user.id, (payload) => {
            console.log('💬 Realtime: پیام جدید', payload);
            if (typeof RealtimeEvents !== 'undefined') {
                RealtimeEvents.emit(RealtimeEvents.EVENTS.CHAT_MESSAGE_SENT, payload.new);
            }
            if (typeof UTILS !== 'undefined' && payload.new) {
                UTILS.showNotification('💬 پیام جدید دریافت شد', 'info', 3000);
            }
        });

        // ── اتصال realtime برای student_progress ───────────────
        const progressChannel = client
            .channel('progress-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'student_progress' },
                (payload) => {
                    console.log('📊 Realtime: student_progress تغییر کرد', payload.eventType);
                    if (typeof RealtimeEvents !== 'undefined') {
                        RealtimeEvents.emit(RealtimeEvents.EVENTS.STUDENTS_CHANGED, payload);
                    }
                })
            .subscribe();
        SupabaseDataModule._channels['student_progress'] = progressChannel;

    } catch (e) {
        console.warn('⚠️ Realtime setup خطا:', e.message);
    }
}
