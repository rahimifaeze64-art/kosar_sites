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
