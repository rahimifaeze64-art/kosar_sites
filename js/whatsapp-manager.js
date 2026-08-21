// ============================================================
// js/whatsapp-manager.js
// مدیریت پیام‌های واتساپ — دسته‌بندی، یادآوری، برنامه‌ریزی پاسخ
// فقط برای مدیر — Manager Only
// ============================================================

const WhatsAppManager = {

    // ── وضعیت اتصال ──────────────────────────────────────────
    _connected: false,
    _qrVisible: false,
    _messages: [],
    _reminders: [],
    _currentFilter: 'all',   // all | question | order | missed_call | other
    _currentSort: 'newest',  // newest | oldest | priority
    _searchQuery: '',
    _selectedMsg: null,

    // ── دسته‌بندی‌ها ──────────────────────────────────────────
    CATEGORIES: {
        question:    { label: 'سوال',            icon: 'fa-question-circle', color: 'text-lime-400',   bg: 'bg-lime-500/20',   badge: 'bg-lime-500/30 text-lime-300' },
        order:       { label: 'سفارش جدید',      icon: 'fa-shopping-cart',   color: 'text-blue-400',   bg: 'bg-blue-500/20',   badge: 'bg-blue-500/30 text-blue-300' },
        missed_call: { label: 'تماس از دست رفته', icon: 'fa-phone-slash',    color: 'text-red-400',    bg: 'bg-red-500/20',    badge: 'bg-red-500/30 text-red-300' },
        other:       { label: 'سایر',             icon: 'fa-ellipsis-h',     color: 'text-gray-400',   bg: 'bg-gray-500/20',   badge: 'bg-gray-500/30 text-gray-300' },
    },

    PRIORITIES: {
        high:   { label: 'فوری',    color: 'text-red-400',  dot: 'bg-red-400' },
        medium: { label: 'متوسط',   color: 'text-lime-400', dot: 'bg-lime-400' },
        low:    { label: 'عادی',    color: 'text-gray-400', dot: 'bg-gray-400' },
    },

    // ── بارگذاری داده‌ها از localStorage / Supabase ─────────
    _storageKey: 'wa_messages',
    _remindersKey: 'wa_reminders',

    loadMessages() {
        try {
            const raw = localStorage.getItem(this._storageKey);
            this._messages = raw ? JSON.parse(raw) : this._getDemoMessages();
        } catch(e) {
            this._messages = this._getDemoMessages();
        }
        return this._messages;
    },

    saveMessages() {
        localStorage.setItem(this._storageKey, JSON.stringify(this._messages));
    },

    loadReminders() {
        try {
            const raw = localStorage.getItem(this._remindersKey);
            this._reminders = raw ? JSON.parse(raw) : [];
        } catch(e) {
            this._reminders = [];
        }
        return this._reminders;
    },

    saveReminders() {
        localStorage.setItem(this._remindersKey, JSON.stringify(this._reminders));
    },

    // ── داده‌های نمایشی پیش‌فرض ──────────────────────────────
    _getDemoMessages() {
        return [
            {
                id: 'wa_001',
                sender: 'سجاد الخفاجی ',
                phone: '+964 770 123 4567',
                text: 'سلام، می‌خواستم بپرسم مدرک دکتری من کی آماده میشه؟',
                category: 'question',
                priority: 'medium',
                status: 'pending',   // pending | scheduled | replied | done
                time: new Date(Date.now() - 1800000).toISOString(),
                replyAt: null,
                replyNote: '',
                replied: false,
                avatar: 'ا',
            },
            {
                id: 'wa_002',
                sender: 'اسرا البدیری ',
                phone: '+964 750 987 6543',
                text: ' سلام دکتر مدراک  من به دستم رسید ',
                category: 'order',
                priority: 'high',
                status: 'pending',
                time: new Date(Date.now() - 3600000).toISOString(),
                replyAt: null,
                replyNote: '',
                replied: false,
                avatar: 'ف',
            },
            {
                id: 'wa_003',
                sender: '+964 780 111 2222',
                phone: '+964 780 111 2222',
                text: '📞 تماس از دست رفته',
                category: 'missed_call',
                priority: 'high',
                status: 'pending',
                time: new Date(Date.now() - 7200000).toISOString(),
                replyAt: null,
                replyNote: '',
                replied: false,
                avatar: '📞',
            },
            {
                id: 'wa_004',
                sender: 'علی حسین',
                phone: '+964 790 444 5555',
                text: 'سلام، قیمت ترجمه پایان‌نامه چقدره؟',
                category: 'question',
                priority: 'low',
                status: 'scheduled',
                time: new Date(Date.now() - 10800000).toISOString(),
                replyAt: new Date(Date.now() + 3600000).toISOString(),
                replyNote: 'ارسال لیست قیمت',
                replied: false,
                avatar: 'ع',
            },
            {
                id: 'wa_005',
                sender: 'هشام لعبدالله',
                phone: '+964 771 333 4444',
                text: 'سلام دکتر کی برای تسویه بیام',
                category: 'order',
                priority: 'high',
                status: 'done',
                time: new Date(Date.now() - 86400000).toISOString(),
                replyAt: null,
                replyNote: 'ثبت سفارش انجام شد',
                replied: true,
                avatar: 'ز',
            },
        ];
    },

    // ── فیلتر و جستجو ────────────────────────────────────────
    getFilteredMessages() {
        let msgs = [...this._messages];

        // فیلتر دسته‌بندی
        if (this._currentFilter !== 'all') {
            msgs = msgs.filter(m => m.category === this._currentFilter);
        }

        // جستجو
        if (this._searchQuery.trim()) {
            const q = this._searchQuery.trim().toLowerCase();
            msgs = msgs.filter(m =>
                m.sender.toLowerCase().includes(q) ||
                m.text.toLowerCase().includes(q) ||
                m.phone.includes(q)
            );
        }

        // مرتب‌سازی
        if (this._currentSort === 'newest') {
            msgs.sort((a, b) => new Date(b.time) - new Date(a.time));
        } else if (this._currentSort === 'oldest') {
            msgs.sort((a, b) => new Date(a.time) - new Date(b.time));
        } else if (this._currentSort === 'priority') {
            const order = { high: 0, medium: 1, low: 2 };
            msgs.sort((a, b) => (order[a.priority] || 2) - (order[b.priority] || 2));
        }

        return msgs;
    },

    // ── آمار ─────────────────────────────────────────────────
    getStats() {
        const msgs = this._messages;
        return {
            total:       msgs.length,
            pending:     msgs.filter(m => m.status === 'pending').length,
            scheduled:   msgs.filter(m => m.status === 'scheduled').length,
            done:        msgs.filter(m => m.status === 'done').length,
            missed_call: msgs.filter(m => m.category === 'missed_call').length,
            question:    msgs.filter(m => m.category === 'question').length,
            order:       msgs.filter(m => m.category === 'order').length,
            high:        msgs.filter(m => m.priority === 'high' && m.status === 'pending').length,
        };
    },

    // ── تبدیل زمان ───────────────────────────────────────────
    _timeAgo(isoStr) {
        if (!isoStr) return '';
        const diff = Date.now() - new Date(isoStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)  return 'همین الان';
        if (mins < 60) return `${mins} دقیقه پیش`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)  return `${hrs} ساعت پیش`;
        const days = Math.floor(hrs / 24);
        return `${days} روز پیش`;
    },

    _formatDateTime(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    },

    // ── رندر badge دسته‌بندی ──────────────────────────────────
    _renderCategoryBadge(cat) {
        const c = this.CATEGORIES[cat] || this.CATEGORIES.other;
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.badge}">
                    <i class="fas ${c.icon} text-xs"></i> ${c.label}
                </span>`;
    },

    _renderPriorityDot(priority) {
        const p = this.PRIORITIES[priority] || this.PRIORITIES.low;
        return `<span class="inline-block w-2 h-2 rounded-full ${p.dot}" title="${p.label}"></span>`;
    },

    _renderStatusBadge(status) {
        const map = {
            pending:   'bg-yellow-500/20 text-yellow-300',
            scheduled: 'bg-blue-500/20 text-blue-300',
            replied:   'bg-lime-500/20 text-lime-300',
            done:      'bg-gray-500/20 text-gray-400',
        };
        const labels = { pending: 'در انتظار', scheduled: 'زمان‌بندی شده', replied: 'پاسخ داده شده', done: 'انجام شد' };
        const cls = map[status] || map.pending;
        return `<span class="px-2 py-0.5 rounded-full text-xs ${cls}">${labels[status] || status}</span>`;
    },

    // ── عملیات روی پیام ──────────────────────────────────────
    updateMessageStatus(id, status) {
        const msg = this._messages.find(m => m.id === id);
        if (msg) { msg.status = status; this.saveMessages(); }
    },

    scheduleReply(id, replyAt, replyNote) {
        const msg = this._messages.find(m => m.id === id);
        if (msg) {
            msg.status = 'scheduled';
            msg.replyAt = replyAt;
            msg.replyNote = replyNote;
            this.saveMessages();
        }
    },

    markDone(id) {
        const msg = this._messages.find(m => m.id === id);
        if (msg) { msg.status = 'done'; msg.replied = true; this.saveMessages(); }
    },

    deleteMessage(id) {
        this._messages = this._messages.filter(m => m.id !== id);
        this.saveMessages();
    },

    addManualMessage(sender, phone, text, category, priority) {
        const msg = {
            id: 'wa_' + Date.now(),
            sender: sender || 'ناشناس',
            phone: phone || '',
            text: text || '',
            category: category || 'other',
            priority: priority || 'medium',
            status: 'pending',
            time: new Date().toISOString(),
            replyAt: null,
            replyNote: '',
            replied: false,
            avatar: (sender || 'ن').charAt(0),
        };
        this._messages.unshift(msg);
        this.saveMessages();
        return msg;
    },

    // ── یادآوری‌های سررسید ───────────────────────────────────
    getDueReminders() {
        const now = Date.now();
        return this._messages.filter(m =>
            m.status === 'scheduled' &&
            m.replyAt &&
            new Date(m.replyAt).getTime() <= now + 900000  // 15 دقیقه جلوتر
        );
    },

    // ═══════════════════════════════════════════════════════════
    // رندر HTML اصلی صفحه
    // ═══════════════════════════════════════════════════════════
    getContent() {
        this.loadMessages();
        this.loadReminders();
        const stats = this.getStats();

        return `
<div class="space-y-6" id="wa-root" dir="rtl">

    <!-- ── هدر ────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-lime-500/20 rounded-2xl flex items-center justify-center">
                <i class="fab fa-whatsapp text-2xl text-lime-400"></i>
            </div>
            <div>
                <h2 class="text-2xl font-bold text-white">مدیریت واتساپ</h2>
                <p class="text-gray-400 text-sm">دسته‌بندی و برنامه‌ریزی پاسخ به پیام‌ها</p>
            </div>
        </div>
        <div class="flex items-center gap-3">
            <!-- وضعیت اتصال -->
            <div id="wa-connection-badge" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <span class="w-2 h-2 rounded-full bg-gray-400 animate-pulse" id="wa-status-dot"></span>
                <span class="text-sm text-gray-300" id="wa-status-text">قطع است</span>
            </div>
            <button onclick="WhatsAppManager.openConnectModal()"
                    class="flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-bold px-4 py-2 rounded-xl transition-all text-sm shadow-lg">
                <i class="fab fa-whatsapp"></i>
                اتصال واتساپ
            </button>
            <button onclick="WhatsAppManager.openAddModal()"
                    class="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 rounded-xl transition-all text-sm border border-white/10">
                <i class="fas fa-plus"></i>
                افزودن دستی
            </button>
        </div>
    </div>

    <!-- ── کارت‌های آماری ─────────────────────────────────── -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${this._renderStatCard('در انتظار پاسخ', stats.pending, 'fa-clock', 'lime')}
        ${this._renderStatCard('تماس از دست رفته', stats.missed_call, 'fa-phone-slash', 'red')}
        ${this._renderStatCard('سفارش جدید', stats.order, 'fa-shopping-cart', 'blue')}
        ${this._renderStatCard('زمان‌بندی شده', stats.scheduled, 'fa-calendar-check', 'purple')}
    </div>

    <!-- ── هشدار سررسید ───────────────────────────────────── -->
    ${this._renderDueAlerts()}

    <!-- ── فیلتر + جستجو + مرتب‌سازی ─────────────────────── -->
    <div class="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-4">
        <div class="flex flex-wrap items-center gap-3">

            <!-- جستجو -->
            <div class="flex-1 min-w-48 relative">
                <i class="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input type="text" id="wa-search"
                       placeholder="جستجو در پیام‌ها..."
                       oninput="WhatsAppManager._onSearch(this.value)"
                       class="w-full bg-white/10 border border-white/10 text-white placeholder-gray-500 rounded-xl pr-9 pl-4 py-2 text-sm focus:outline-none focus:border-lime-500/50">
            </div>

            <!-- فیلتر دسته‌بندی -->
            <div class="flex flex-wrap gap-2">
                ${this._renderFilterBtn('all', 'همه', 'fa-list')}
                ${this._renderFilterBtn('question', 'سوال', 'fa-question-circle')}
                ${this._renderFilterBtn('order', 'سفارش', 'fa-shopping-cart')}
                ${this._renderFilterBtn('missed_call', 'تماس از دست رفته', 'fa-phone-slash')}
                ${this._renderFilterBtn('other', 'سایر', 'fa-ellipsis-h')}
            </div>

            <!-- مرتب‌سازی -->
            <select onchange="WhatsAppManager._onSort(this.value)"
                    class="bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lime-500/50">
                <option value="newest" class="bg-gray-800">جدیدترین</option>
                <option value="oldest" class="bg-gray-800">قدیمی‌ترین</option>
                <option value="priority" class="bg-gray-800">اولویت</option>
            </select>
        </div>
    </div>

    <!-- ── لیست پیام‌ها ───────────────────────────────────── -->
    <div id="wa-messages-list" class="space-y-3">
        ${this._renderMessagesList()}
    </div>

</div>

<!-- ── مودال اتصال واتساپ ──────────────────────────────── -->
<div id="wa-connect-modal" style="display:none"
     class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-gradient-to-b from-blue-900 to-blue-950 rounded-2xl shadow-2xl w-full max-w-md border border-lime-500/20 p-6" dir="rtl">
        <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <i class="fab fa-whatsapp text-lime-400"></i>
                اتصال به واتساپ
            </h3>
            <button onclick="WhatsAppManager.closeConnectModal()" class="text-gray-400 hover:text-white text-xl">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <!-- مراحل اتصال -->
        <div class="space-y-4">
            <div class="bg-lime-500/10 border border-lime-500/20 rounded-xl p-4">
                <p class="text-lime-300 text-sm font-medium mb-2 flex items-center gap-2">
                    <i class="fas fa-info-circle"></i> نحوه اتصال
                </p>
                <ol class="text-gray-300 text-sm space-y-2 list-decimal list-inside">
                    <li>سرور Node.js را اجرا کنید</li>
                    <li>QR Code نمایش داده می‌شود</li>
                    <li>در واتساپ → دستگاه‌های مرتبط → QR اسکن کنید</li>
                    <li>پیام‌ها به‌صورت خودکار دریافت می‌شوند</li>
                </ol>
            </div>

            <!-- QR Placeholder -->
            <div class="flex flex-col items-center bg-white/5 rounded-xl p-6 border border-white/10">
                <div class="w-48 h-48 bg-white rounded-xl flex items-center justify-center mb-3" id="wa-qr-container">
                    <div class="text-center text-gray-400">
                        <i class="fas fa-qrcode text-5xl mb-2 text-gray-300"></i>
                        <p class="text-xs">QR Code بعد از راه‌اندازی سرور نمایش داده می‌شود</p>
                    </div>
                </div>
                <p class="text-gray-400 text-xs text-center">برای استفاده باید سرور Node.js روی سیستم یا هاست شما اجرا باشد</p>
            </div>

            <!-- لینک راه‌اندازی -->
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                <p class="text-gray-300 text-sm mb-2 font-medium">آدرس سرور واتساپ:</p>
                <div class="flex gap-2">
                    <input type="text" id="wa-server-url" value="http://localhost:3001"
                           class="flex-1 bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lime-500/50">
                    <button onclick="WhatsAppManager.testConnection()"
                            class="bg-lime-500 hover:bg-lime-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
                        تست
                    </button>
                </div>
            </div>

            <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                <p class="text-blue-300 text-xs flex items-start gap-2">
                    <i class="fas fa-lightbulb mt-0.5 flex-shrink-0"></i>
                    در حال حاضر می‌توانید پیام‌ها را <strong class="text-white">دستی</strong> اضافه کنید. اتصال خودکار نیاز به سرور Node.js دارد.
                </p>
            </div>
        </div>

        <button onclick="WhatsAppManager.closeConnectModal()"
                class="w-full mt-4 bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 rounded-xl transition-all">
            بستن
        </button>
    </div>
</div>

<!-- ── مودال زمان‌بندی پاسخ ─────────────────────────────── -->
<div id="wa-schedule-modal" style="display:none"
     class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-gradient-to-b from-blue-900 to-blue-950 rounded-2xl shadow-2xl w-full max-w-md border border-white/10 p-6" dir="rtl">
        <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <i class="fas fa-calendar-clock text-lime-400"></i>
                زمان‌بندی پاسخ
            </h3>
            <button onclick="WhatsAppManager.closeScheduleModal()" class="text-gray-400 hover:text-white text-xl">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <input type="hidden" id="wa-schedule-id">

        <!-- پیام انتخاب‌شده -->
        <div class="bg-white/5 rounded-xl p-3 border border-white/10 mb-4" id="wa-schedule-preview"></div>

        <!-- زمان پاسخ -->
        <div class="mb-4">
            <label class="block text-gray-300 text-sm mb-2 font-medium">زمان پاسخ‌دهی</label>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <button onclick="WhatsAppManager._setQuickTime(30)"
                        class="bg-white/10 hover:bg-lime-500/20 hover:border-lime-500/40 text-white text-sm py-2 rounded-xl border border-white/10 transition-all">
                    <i class="fas fa-clock ml-1 text-lime-400"></i> ۳۰ دقیقه دیگر
                </button>
                <button onclick="WhatsAppManager._setQuickTime(60)"
                        class="bg-white/10 hover:bg-lime-500/20 hover:border-lime-500/40 text-white text-sm py-2 rounded-xl border border-white/10 transition-all">
                    <i class="fas fa-clock ml-1 text-lime-400"></i> ۱ ساعت دیگر
                </button>
                <button onclick="WhatsAppManager._setQuickTime(180)"
                        class="bg-white/10 hover:bg-lime-500/20 hover:border-lime-500/40 text-white text-sm py-2 rounded-xl border border-white/10 transition-all">
                    <i class="fas fa-clock ml-1 text-lime-400"></i> ۳ ساعت دیگر
                </button>
                <button onclick="WhatsAppManager._setQuickTime(1440)"
                        class="bg-white/10 hover:bg-lime-500/20 hover:border-lime-500/40 text-white text-sm py-2 rounded-xl border border-white/10 transition-all">
                    <i class="fas fa-calendar ml-1 text-lime-400"></i> فردا
                </button>
            </div>
            <input type="datetime-local" id="wa-reply-time"
                   class="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lime-500/50">
        </div>

        <!-- یادداشت -->
        <div class="mb-5">
            <label class="block text-gray-300 text-sm mb-2 font-medium">یادداشت (موضوع پاسخ)</label>
            <textarea id="wa-reply-note" rows="3" placeholder="مثال: ارسال قیمت‌نامه، هماهنگی جلسه..."
                      class="w-full bg-white/10 border border-white/10 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lime-500/50 resize-none"></textarea>
        </div>

        <div class="flex gap-3">
            <button onclick="WhatsAppManager.confirmSchedule()"
                    class="flex-1 bg-lime-500 hover:bg-lime-400 text-black font-bold py-2.5 rounded-xl transition-all">
                <i class="fas fa-check ml-1"></i> تنظیم یادآوری
            </button>
            <button onclick="WhatsAppManager.closeScheduleModal()"
                    class="px-6 bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 rounded-xl transition-all">
                انصراف
            </button>
        </div>
    </div>
</div>

<!-- ── مودال افزودن دستی ────────────────────────────────── -->
<div id="wa-add-modal" style="display:none"
     class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-gradient-to-b from-blue-900 to-blue-950 rounded-2xl shadow-2xl w-full max-w-md border border-white/10 p-6" dir="rtl">
        <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <i class="fas fa-plus text-lime-400"></i>
                افزودن پیام دستی
            </h3>
            <button onclick="WhatsAppManager.closeAddModal()" class="text-gray-400 hover:text-white text-xl">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <div class="space-y-4">
            <div>
                <label class="block text-gray-300 text-sm mb-1.5 font-medium">نام فرستنده</label>
                <input type="text" id="wa-add-sender" placeholder="نام کامل"
                       class="w-full bg-white/10 border border-white/10 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lime-500/50">
            </div>
            <div>
                <label class="block text-gray-300 text-sm mb-1.5 font-medium">شماره تلفن</label>
                <input type="text" id="wa-add-phone" placeholder="+964 ..."
                       class="w-full bg-white/10 border border-white/10 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lime-500/50" dir="ltr">
            </div>
            <div>
                <label class="block text-gray-300 text-sm mb-1.5 font-medium">متن پیام</label>
                <textarea id="wa-add-text" rows="3" placeholder="متن پیام..."
                          class="w-full bg-white/10 border border-white/10 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lime-500/50 resize-none"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-gray-300 text-sm mb-1.5 font-medium">دسته‌بندی</label>
                    <select id="wa-add-category"
                            class="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lime-500/50">
                        <option value="question" class="bg-gray-800">سوال</option>
                        <option value="order" class="bg-gray-800">سفارش جدید</option>
                        <option value="missed_call" class="bg-gray-800">تماس از دست رفته</option>
                        <option value="other" class="bg-gray-800">سایر</option>
                    </select>
                </div>
                <div>
                    <label class="block text-gray-300 text-sm mb-1.5 font-medium">اولویت</label>
                    <select id="wa-add-priority"
                            class="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lime-500/50">
                        <option value="high" class="bg-gray-800">فوری</option>
                        <option value="medium" class="bg-gray-800">متوسط</option>
                        <option value="low" class="bg-gray-800">عادی</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="flex gap-3 mt-5">
            <button onclick="WhatsAppManager.confirmAdd()"
                    class="flex-1 bg-lime-500 hover:bg-lime-400 text-black font-bold py-2.5 rounded-xl transition-all">
                <i class="fas fa-plus ml-1"></i> افزودن
            </button>
            <button onclick="WhatsAppManager.closeAddModal()"
                    class="px-6 bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 rounded-xl transition-all">
                انصراف
            </button>
        </div>
    </div>
</div>
`;
    },

    // ── رندر کارت آماری ──────────────────────────────────────
    _renderStatCard(label, value, icon, color) {
        const colorMap = {
            lime:   'text-lime-400 bg-lime-500/20',
            red:    'text-red-400 bg-red-500/20',
            blue:   'text-blue-400 bg-blue-500/20',
            purple: 'text-purple-400 bg-purple-500/20',
        };
        const cls = colorMap[color] || colorMap.lime;
        const [textCls, bgCls] = cls.split(' ');
        return `
        <div class="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-4 flex items-center gap-4">
            <div class="w-12 h-12 ${bgCls} rounded-xl flex items-center justify-center flex-shrink-0">
                <i class="fas ${icon} text-xl ${textCls}"></i>
            </div>
            <div>
                <p class="text-2xl font-bold text-white">${value}</p>
                <p class="text-gray-400 text-xs mt-0.5">${label}</p>
            </div>
        </div>`;
    },

    // ── هشدار سررسید ─────────────────────────────────────────
    _renderDueAlerts() {
        const due = this.getDueReminders();
        if (due.length === 0) return '';
        const items = due.map(m => `
            <div class="flex items-center gap-3">
                <i class="fas fa-bell text-lime-400 animate-bounce"></i>
                <span class="text-white text-sm font-medium">${m.sender}</span>
                <span class="text-gray-300 text-xs">${m.replyNote || 'پاسخ برنامه‌ریزی شده'}</span>
                <span class="text-lime-400 text-xs mr-auto">${this._formatDateTime(m.replyAt)}</span>
                <button onclick="WhatsAppManager.markDone('${m.id}'); WhatsAppManager._refresh()"
                        class="text-xs bg-lime-500/20 hover:bg-lime-500/40 text-lime-300 px-2 py-1 rounded-lg transition-all">انجام شد</button>
            </div>`).join('<hr class="border-white/5">');
        return `
        <div class="bg-lime-500/10 border border-lime-500/30 rounded-2xl p-4">
            <p class="text-lime-400 font-bold text-sm mb-3 flex items-center gap-2">
                <i class="fas fa-bell animate-bounce"></i> یادآوری — پاسخ‌های سررسید شده
            </p>
            <div class="space-y-3">${items}</div>
        </div>`;
    },

    // ── دکمه فیلتر ───────────────────────────────────────────
    _renderFilterBtn(val, label, icon) {
        const active = this._currentFilter === val;
        const cls = active
            ? 'bg-lime-500 text-black font-bold shadow-lg shadow-lime-500/20'
            : 'bg-white/10 text-gray-300 hover:bg-white/20';
        return `<button onclick="WhatsAppManager._onFilter('${val}')"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all ${cls}">
                    <i class="fas ${icon} text-xs"></i> ${label}
                </button>`;
    },

    // ── لیست پیام‌ها ─────────────────────────────────────────
    _renderMessagesList() {
        const msgs = this.getFilteredMessages();
        if (msgs.length === 0) {
            return `<div class="text-center py-16 text-gray-400">
                        <i class="fab fa-whatsapp text-5xl mb-3 opacity-30"></i>
                        <p class="text-lg">پیامی یافت نشد</p>
                        <p class="text-sm mt-1">فیلتر را تغییر دهید یا پیام دستی اضافه کنید</p>
                    </div>`;
        }
        return msgs.map(m => this._renderMessageCard(m)).join('');
    },

    // ── کارت پیام ────────────────────────────────────────────
    _renderMessageCard(m) {
        const cat   = this.CATEGORIES[m.category] || this.CATEGORIES.other;
        const isDone = m.status === 'done';
        const borderCls = m.priority === 'high' && !isDone
            ? 'border-red-500/30'
            : m.status === 'scheduled'
                ? 'border-blue-500/30'
                : 'border-white/10';
        const opacityCls = isDone ? 'opacity-60' : '';

        return `
        <div class="bg-white/5 backdrop-blur-lg rounded-2xl border ${borderCls} p-4 transition-all hover:bg-white/8 ${opacityCls}" id="wa-card-${m.id}">
            <div class="flex items-start gap-4">

                <!-- آواتار -->
                <div class="w-11 h-11 ${cat.bg} rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold ${cat.color}">
                    ${m.avatar || m.sender.charAt(0)}
                </div>

                <!-- محتوا -->
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                        <span class="text-white font-semibold text-sm">${m.sender}</span>
                        ${this._renderCategoryBadge(m.category)}
                        ${this._renderStatusBadge(m.status)}
                        ${this._renderPriorityDot(m.priority)}
                    </div>
                    <p class="text-gray-300 text-sm leading-relaxed truncate mb-2">${m.text}</p>
                    <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span class="flex items-center gap-1"><i class="fas fa-clock"></i> ${this._timeAgo(m.time)}</span>
                        <span class="flex items-center gap-1" dir="ltr"><i class="fas fa-phone"></i> ${m.phone}</span>
                        ${m.replyAt ? `<span class="flex items-center gap-1 text-blue-400"><i class="fas fa-calendar-check"></i> پاسخ: ${this._formatDateTime(m.replyAt)}</span>` : ''}
                        ${m.replyNote ? `<span class="text-blue-300 truncate max-w-48">${m.replyNote}</span>` : ''}
                    </div>
                </div>

                <!-- دکمه‌های عمل -->
                <div class="flex flex-col gap-2 flex-shrink-0">
                    ${!isDone ? `
                    <button onclick="WhatsAppManager.openScheduleModal('${m.id}')"
                            title="زمان‌بندی پاسخ"
                            class="w-9 h-9 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-xl flex items-center justify-center transition-all text-sm">
                        <i class="fas fa-calendar-plus"></i>
                    </button>
                    <button onclick="WhatsAppManager.markDone('${m.id}'); WhatsAppManager._refresh()"
                            title="انجام شد"
                            class="w-9 h-9 bg-lime-500/20 hover:bg-lime-500/40 text-lime-400 rounded-xl flex items-center justify-center transition-all text-sm">
                        <i class="fas fa-check"></i>
                    </button>
                    ` : ''}
                    <button onclick="WhatsAppManager._openWhatsApp('${m.phone}')"
                            title="باز کردن در واتساپ"
                            class="w-9 h-9 bg-lime-500/20 hover:bg-lime-500/40 text-lime-400 rounded-xl flex items-center justify-center transition-all text-sm">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="WhatsAppManager.deleteMessage('${m.id}'); WhatsAppManager._refresh()"
                            title="حذف"
                            class="w-9 h-9 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-xl flex items-center justify-center transition-all text-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>`;
    },

    // ── کمکی‌ها ───────────────────────────────────────────────
    _onFilter(val) {
        this._currentFilter = val;
        this._refresh();
    },

    _onSort(val) {
        this._currentSort = val;
        this._refresh();
    },

    _onSearch(val) {
        this._searchQuery = val;
        this._refresh();
    },

    _refresh() {
        const root = document.getElementById('wa-messages-list');
        if (root) root.innerHTML = this._renderMessagesList();
        // آپدیت فیلترها
        const filterBtns = document.querySelectorAll('[onclick*="_onFilter"]');
        filterBtns.forEach(btn => {
            const val = btn.getAttribute('onclick').match(/'([^']+)'/)?.[1];
            if (val === this._currentFilter) {
                btn.className = btn.className.replace('bg-white/10 text-gray-300 hover:bg-white/20', 'bg-lime-500 text-black font-bold shadow-lg shadow-lime-500/20');
            } else {
                btn.className = btn.className.replace('bg-lime-500 text-black font-bold shadow-lg shadow-lime-500/20', 'bg-white/10 text-gray-300 hover:bg-white/20');
            }
        });
        // آپدیت هشدارهای سررسید
        const alertArea = document.querySelector('#wa-root > div:nth-child(3)');
        // re-render due alerts در صورت نیاز
    },

    _setQuickTime(minutes) {
        const d = new Date(Date.now() + minutes * 60000);
        const input = document.getElementById('wa-reply-time');
        if (input) {
            // فرمت datetime-local
            const pad = n => String(n).padStart(2, '0');
            input.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
    },

    _openWhatsApp(phone) {
        const cleaned = phone.replace(/[\s+\-]/g, '');
        window.open(`https://wa.me/${cleaned}`, '_blank');
    },

    // ── مودال زمان‌بندی ───────────────────────────────────────
    openScheduleModal(id) {
        const msg = this._messages.find(m => m.id === id);
        if (!msg) return;
        document.getElementById('wa-schedule-id').value = id;
        const preview = document.getElementById('wa-schedule-preview');
        if (preview) {
            preview.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 ${this.CATEGORIES[msg.category]?.bg || 'bg-gray-500/20'} rounded-full flex items-center justify-center text-sm font-bold ${this.CATEGORIES[msg.category]?.color || 'text-gray-400'}">
                        ${msg.avatar || msg.sender.charAt(0)}
                    </div>
                    <div>
                        <p class="text-white text-sm font-medium">${msg.sender}</p>
                        <p class="text-gray-400 text-xs truncate max-w-72">${msg.text}</p>
                    </div>
                </div>`;
        }
        const noteInput = document.getElementById('wa-reply-note');
        if (noteInput) noteInput.value = msg.replyNote || '';
        if (msg.replyAt) {
            const d = new Date(msg.replyAt);
            const pad = n => String(n).padStart(2, '0');
            const input = document.getElementById('wa-reply-time');
            if (input) input.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
        document.getElementById('wa-schedule-modal').style.display = 'flex';
    },

    closeScheduleModal() {
        document.getElementById('wa-schedule-modal').style.display = 'none';
    },

    confirmSchedule() {
        const id = document.getElementById('wa-schedule-id').value;
        const replyAt = document.getElementById('wa-reply-time').value;
        const replyNote = document.getElementById('wa-reply-note').value;
        if (!replyAt) { alert('لطفاً زمان پاسخ را انتخاب کنید'); return; }
        this.scheduleReply(id, new Date(replyAt).toISOString(), replyNote);
        this.closeScheduleModal();
        this._refresh();
        // آپدیت stats
        this._updateStats();
    },

    // ── مودال اتصال ──────────────────────────────────────────
    openConnectModal() {
        document.getElementById('wa-connect-modal').style.display = 'flex';
    },

    closeConnectModal() {
        document.getElementById('wa-connect-modal').style.display = 'none';
    },

    testConnection() {
        const url = document.getElementById('wa-server-url').value;
        const dot  = document.getElementById('wa-status-dot');
        const text = document.getElementById('wa-status-text');
        fetch(url + '/status', { signal: AbortSignal.timeout(3000) })
            .then(r => r.json())
            .then(data => {
                if (dot) { dot.className = 'w-2 h-2 rounded-full bg-lime-400'; }
                if (text) { text.textContent = 'متصل است'; }
                this._connected = true;
                alert('✅ اتصال به سرور برقرار است');
            })
            .catch(() => {
                if (dot) { dot.className = 'w-2 h-2 rounded-full bg-red-400'; }
                if (text) { text.textContent = 'سرور در دسترس نیست'; }
                alert('❌ سرور در دسترس نیست. ابتدا سرور Node.js را اجرا کنید.');
            });
    },

    // ── مودال افزودن دستی ────────────────────────────────────
    openAddModal() {
        document.getElementById('wa-add-modal').style.display = 'flex';
    },

    closeAddModal() {
        document.getElementById('wa-add-modal').style.display = 'none';
        ['wa-add-sender','wa-add-phone','wa-add-text'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    },

    confirmAdd() {
        const sender   = document.getElementById('wa-add-sender').value.trim();
        const phone    = document.getElementById('wa-add-phone').value.trim();
        const text     = document.getElementById('wa-add-text').value.trim();
        const category = document.getElementById('wa-add-category').value;
        const priority = document.getElementById('wa-add-priority').value;
        if (!text) { alert('متن پیام را وارد کنید'); return; }
        this.addManualMessage(sender || 'ناشناس', phone, text, category, priority);
        this.closeAddModal();
        this._refresh();
        this._updateStats();
    },

    // ── آپدیت badge در sidebar ────────────────────────────────
    _badgeTimer: null,

    _startBadgeUpdater() {
        // فوری اجرا
        this._updateSidebarBadge();
        // هر 30 ثانیه
        if (this._badgeTimer) clearInterval(this._badgeTimer);
        this._badgeTimer = setInterval(() => this._updateSidebarBadge(), 30000);
    },

    _updateSidebarBadge() {
        const badge = document.getElementById('wa-sidebar-badge');
        if (!badge) return;
        this.loadMessages();
        const pending = this._messages.filter(m => m.status === 'pending').length;
        if (pending > 0) {
            badge.textContent = pending > 99 ? '99+' : pending;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    },

    // ── آپدیت آمار بدون re-render کامل ──────────────────────
    _updateStats() {
        // ساده‌ترین روش: re-render کامل صفحه
        const root = document.getElementById('wa-page-root');
        if (root && typeof WhatsAppManager !== 'undefined') {
            root.innerHTML = WhatsAppManager.getContent();
            this._updateSidebarBadge();
        }
    },
};

console.log('📱 whatsapp-manager.js بارگذاری شد');
