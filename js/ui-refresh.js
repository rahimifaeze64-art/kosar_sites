// ============================================================
// js/ui-refresh.js
// مرکز به‌روزرسانی بلادرنگ UI — جایگزین location.reload()
// ============================================================

const UIRefresh = {

    // ── به‌روزرسانی صفحه سفارشات ─────────────────────────────
    async orders() {
        try {
            const app = UIRefresh._getApp();
            if (!app) return UIRefresh._fallback();

            if (app.currentPage === 'orders') {
                await app.loadOrdersPageWithRetry();
            }
            // داشبورد را هم update کن (آمارها تغییر کرده)
            if (app.currentPage === 'dashboard') {
                await app.loadDashboardContent();
            }
            // emit برای بقیه listeners
            if (typeof RealtimeEvents !== 'undefined') {
                RealtimeEvents.emit(RealtimeEvents.EVENTS.ORDERS_CHANGED, {});
            }
        } catch (e) {
            console.warn('UIRefresh.orders خطا:', e.message);
        }
    },

    // ── به‌روزرسانی داشبورد ───────────────────────────────────
    async dashboard() {
        try {
            const app = UIRefresh._getApp();
            if (!app) return;
            await app.loadDashboardContent();
        } catch (e) {
            console.warn('UIRefresh.dashboard خطا:', e.message);
        }
    },

    // ── به‌روزرسانی صفحه کاربران ─────────────────────────────
    async users() {
        try {
            const app = UIRefresh._getApp();
            if (!app) return UIRefresh._fallback();

            if (app.currentPage === 'users') {
                // Alpine re-render — فقط محتوای بخش users
                const el = document.querySelector('[x-show*="currentPage === \'users\'"]');
                if (el && typeof UsersModule !== 'undefined') {
                    el.innerHTML = UsersModule.getUsersContent();
                }
            }
            if (typeof RealtimeEvents !== 'undefined') {
                RealtimeEvents.emit(RealtimeEvents.EVENTS.USERS_CHANGED, {});
            }
        } catch (e) {
            console.warn('UIRefresh.users خطا:', e.message);
        }
    },

    // ── به‌روزرسانی کامل: دریافت آخرین تغییرات از Supabase و رندر مجدد ───
    // دکمهٔ داشبورد (مدیر/کارمند) — بدون رفرش کامل صفحه، آخرین وضعیت مراحل
    // دانشجویان، تخصیص‌ها، کاربران و سفارشات را از دیتابیس می‌کشد.
    async full() {
        const btn  = document.getElementById('global-refresh-btn');
        const icon = btn ? btn.querySelector('i') : null;
        if (btn) btn.disabled = true;
        if (icon) icon.classList.add('fa-spin');

        try {
            const sb = (typeof SupabaseDataModule !== 'undefined') ? SupabaseDataModule : null;
            let paths = 0;

            if (sb) {
                // ۱) پیشرفت مراحل (student_progress) → کلیدهای prog_ + merge روی students_data
                try {
                    if (typeof sb.getAllStudentProgress === 'function') {
                        const map = await sb.getAllStudentProgress();
                        if (map) paths = Object.keys(map).length;
                    }
                } catch (e) { console.warn('UIRefresh.full progress خطا:', e.message); }

                // ۲) تخصیص مراحل به کارمندان (مدیریت مراحل)
                try {
                    if (typeof StepAssignmentModule !== 'undefined' &&
                        typeof StepAssignmentModule.syncAssignmentsFromSupabase === 'function') {
                        await StepAssignmentModule.syncAssignmentsFromSupabase();
                    }
                } catch (e) { console.warn('UIRefresh.full step_assignments خطا:', e.message); }

                // ۳) کاربران و سفارشات — با force تا کش نادیده گرفته شود
                try { if (sb.getUsers)  await sb.getUsers({ force: true }); }  catch (e) {}
                try { if (sb.getOrders) await sb.getOrders({ force: true }); } catch (e) {}
            }

            // ۴) رندر مجدد صفحهٔ جاری
            const app = UIRefresh._getApp();
            if (app) {
                if (app.currentPage === 'dashboard' && typeof app.loadDashboardContent === 'function') {
                    await app.loadDashboardContent();
                } else if (app.currentPage === 'students' && typeof EmployeeModule !== 'undefined' &&
                           typeof EmployeeModule.getStudentsContent === 'function') {
                    const el = document.querySelector('[x-show*="currentPage === \'students\'"]');
                    if (el) el.innerHTML = EmployeeModule.getStudentsContent(app.currentUser && app.currentUser.id);
                }
            }

            // ۵) اطلاع به بقیهٔ بخش‌ها (نمای شیت، لیست دانشجویان، ...)
            if (typeof RealtimeEvents !== 'undefined') {
                RealtimeEvents.emit(RealtimeEvents.EVENTS.STUDENTS_CHANGED, { refresh: true });
            }

            if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
                UTILS.showNotification(
                    `✅ آخرین تغییرات دریافت شد${paths ? ` (${paths} دانشجو/مسیر)` : ''}`,
                    'success', 2500
                );
            }
            return true;
        } catch (e) {
            console.warn('UIRefresh.full خطا:', e.message);
            if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
                UTILS.showNotification('⚠️ به‌روزرسانی ناموفق — اتصال اینترنت را بررسی کنید', 'error', 3000);
            }
            return false;
        } finally {
            if (btn) btn.disabled = false;
            if (icon) icon.classList.remove('fa-spin');
        }
    },

    // ── بستن modal و refresh صفحه جاری ──────────────────────
    async afterSave(pageType = 'orders') {
        // بستن modal
        UIRefresh._closeModal();

        // refresh بر اساس نوع
        await UIRefresh[pageType]?.();
        await UIRefresh.dashboard();
    },

    // ── بستن modal ────────────────────────────────────────────
    _closeModal() {
        try {
            // Alpine modal
            const app = UIRefresh._getApp();
            if (app) app.showModal = null;

            // DOM modal
            const modal = document.getElementById('order-page-modal');
            if (modal) modal.style.display = 'none';

            // ModalsModule
            if (typeof ModalsModule !== 'undefined' && ModalsModule.closeModal) {
                ModalsModule.closeModal();
            }
        } catch (e) { /* ignore */ }
    },

    // ── دریافت Alpine app instance ───────────────────────────
    _getApp() {
        try {
            const el = document.querySelector('[x-data]');
            if (!el) return null;
            // Alpine 3
            if (window.Alpine && Alpine.$data) return Alpine.$data(el);
            // Alpine 2
            if (el.__x) return el.__x.$data;
            return null;
        } catch (e) { return null; }
    },

    // ── fallback اگر app پیدا نشد ────────────────────────────
    _fallback() {
        console.warn('UIRefresh: Alpine app not found, falling back to page refresh');
        setTimeout(() => location.reload(), 500);
    }
};

window.UIRefresh = UIRefresh;
console.log('✅ ui-refresh.js بارگذاری شد');
