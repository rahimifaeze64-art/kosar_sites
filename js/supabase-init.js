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

    // ── ۶. بارگذاری اولیه داده‌ها از Supabase به localStorage ──
    // این مرحله حیاتی است: وقتی مرورگر جدید باز می‌شود،
    // localStorage خالی است. باید داده‌ها از Supabase کشیده شوند
    // تا app بتواند به درستی کار کند.
    console.log('📥 شروع بارگذاری اولیه داده‌ها از Supabase...');
    await _pullDataFromSupabase();

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

    // اطلاع‌رسانی به app که داده‌ها آماده‌اند — Alpine می‌تواند refresh کند
    window.dispatchEvent(new CustomEvent('supabase:dataready'));
    console.log('📣 رویداد supabase:dataready ارسال شد');
})();


// ── بارگذاری اولیه داده‌ها از Supabase ──────────────────────
// این تابع هنگام startup اجرا می‌شود تا localStorage را با
// داده‌های ابر همگام‌سازی کند — ضروری برای مرورگرهای جدید
async function _pullDataFromSupabase() {
    if (typeof SupabaseDataModule === 'undefined') return;

    try {
        // ── سفارشات ─────────────────────────────────────────
        const orders = await SupabaseDataModule.getOrders();
        if (orders && orders.length > 0) {
            localStorage.setItem('edu_system_orders', JSON.stringify(orders));
            console.log(`✅ ${orders.length} سفارش از Supabase بارگذاری شد`);
        }
    } catch (e) {
        console.warn('⚠️ pull orders خطا:', e.message);
    }

    try {
        // ── کاربران/پروفایل‌ها ──────────────────────────────
        const users = await SupabaseDataModule.getUsers();
        if (users && users.length > 0) {
            localStorage.setItem('edu_system_users', JSON.stringify(users));
            console.log(`✅ ${users.length} کاربر از Supabase بارگذاری شد`);
        }
    } catch (e) {
        console.warn('⚠️ pull users خطا:', e.message);
    }

    try {
        // ── ساعات کاری ──────────────────────────────────────
        const workHours = await SupabaseDataModule.getWorkHours();
        if (workHours && workHours.length > 0) {
            localStorage.setItem('work_hours_data', JSON.stringify(workHours));
            console.log(`✅ ${workHours.length} ساعت کاری از Supabase بارگذاری شد`);
        }
    } catch (e) {
        console.warn('⚠️ pull work_hours خطا:', e.message);
    }

    try {
        // ── تسک‌های کارمندان ────────────────────────────────
        const currentUser = (() => {
            try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch { return null; }
        })();
        if (currentUser && currentUser.id) {
            // تبدیل ID به UUID قبل از query
            const userUUID = SupabaseDataModule._toUUID(currentUser.id);
            const tasks = await SupabaseDataModule.getEmployeeTasks(userUUID);
            if (tasks && tasks.length > 0) {
                const all = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
                all[currentUser.id] = tasks;
                localStorage.setItem('employee_tasks', JSON.stringify(all));
                console.log(`✅ ${tasks.length} تسک از Supabase بارگذاری شد`);
            }
        }
    } catch (e) {
        console.warn('⚠️ pull employee_tasks خطا:', e.message);
    }

    try {
        // ── پیام‌ها ──────────────────────────────────────────
        const currentUser = (() => {
            try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch { return null; }
        })();
        if (currentUser && currentUser.id) {
            const userUUID = SupabaseDataModule._toUUID(currentUser.id);
            const messages = await SupabaseDataModule.getMessages(userUUID);
            if (messages && messages.length > 0) {
                const existing = JSON.parse(localStorage.getItem('messages') || '[]');
                const merged = [...existing];
                messages.forEach(m => {
                    if (!merged.find(e => e.id === m.id)) merged.push(m);
                });
                localStorage.setItem('messages', JSON.stringify(merged));
                console.log(`✅ ${messages.length} پیام از Supabase بارگذاری شد`);
            }
        }
    } catch (e) {
        console.warn('⚠️ pull messages خطا:', e.message);
    }

    try {
        // ── آرشیو فایل‌ها ────────────────────────────────────
        const archiveFiles = await SupabaseDataModule.getArchiveFiles();
        if (archiveFiles && archiveFiles.length > 0) {
            localStorage.setItem('archiveFiles', JSON.stringify(archiveFiles));
            console.log(`✅ ${archiveFiles.length} فایل آرشیو از Supabase بارگذاری شد`);
        }
    } catch (e) {
        console.warn('⚠️ pull archiveFiles خطا:', e.message);
    }

    try {
        // ── نرخ‌های ساعتی کارمندان ───────────────────────────
        const client = getSupabaseClient();
        if (client) {
            const { data: rateRows } = await client
                .from('employee_hourly_rates')
                .select('employee_id, hourly_rate');
            if (rateRows && rateRows.length > 0) {
                const ratesMap = {};
                rateRows.forEach(r => { ratesMap[r.employee_id] = parseFloat(r.hourly_rate) || 0; });
                localStorage.setItem('employee_hourly_rates', JSON.stringify(ratesMap));
                console.log(`✅ ${rateRows.length} نرخ ساعتی از Supabase بارگذاری شد`);
            }
        }
    } catch (e) {
        console.warn('⚠️ pull employee_hourly_rates خطا:', e.message);
    }

    console.log('✅ بارگذاری اولیه از Supabase کامل شد');
}

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
    banner.innerHTML = 'داده‌ها ذخیره می‌شوند';
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
