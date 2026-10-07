// ============================================================
// js/tadilat.js — «تعدیلات» دریافتی از ربات تلگرام
//
// دانشجو در تلگرام نامش را می‌فرستد (متن یا ویس) و بعد فایل‌های
// تعدیلات خود را (ویس / عکس / PDF). آن‌ها در دو جدول
//   tadilat_requests / tadilat_files
// ذخیره می‌شوند و این صفحه آن‌ها را برای نویسنده‌ها (دکترها) نشان می‌دهد.
//
// نقش‌ها:
//   • agent (نویسنده/دکتر) → فقط درخواست‌های ارسال‌شده؛ می‌تواند بردارد و انجام دهد
//   • employee / manager   → همه (حتی ناتمام‌ها) + ارجاع به نویسنده + اتصال به پروفایل دانشجو
// ============================================================

const TadilatModule = {
    // ── وضعیت داخلی ──────────────────────────────────────────
    BUCKET: 'student-documents',
    supabase: null,
    currentUser: null,
    role: 'agent',
    _loadedOnce: false,
    _loading: false,
    _requests: [],
    _filesByRequest: {},       // request_id → آرایه فایل‌ها
    _students: null,           // [{id, name, student_id}]
    _agents: null,             // [{id, name}]
    _signedCache: {},          // path → {url, exp}
    _expanded: {},             // request_id → true
    _filter: 'all',
    _scope: 'all',             // pool | assigned | all   (فقط کارمند و مدیر)
    _query: '',
    _channel: null,
    _error: null,
    _assigned: [],             // درخواست‌های دارای نویسنده

    // ── ابزارها ──────────────────────────────────────────────
    _sb() {
        if (this.supabase) return this.supabase;
        try {
            if (typeof getSupabaseClient === 'function') {
                this.supabase = getSupabaseClient();
            } else if (window.supabaseClient) {
                this.supabase = window.supabaseClient;
            } else if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                this.supabase = supabaseClient;
            }
        } catch (e) { /* آفلاین */ }
        return this.supabase;
    },

    _root() {
        return document.getElementById('tadilat-root');
    },

    _me() {
        if (this.currentUser && this.currentUser.id) return this.currentUser;
        try {
            const raw = localStorage.getItem('currentUser') ||
                        localStorage.getItem('edu_system_current_user');
            if (raw) this.currentUser = JSON.parse(raw);
        } catch (e) { /* نادیده */ }
        return this.currentUser || {};
    },

    _isManager() {
        const r = this.role;
        return r === 'manager' || r === 'employee';
    },

    _esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    _fa(v) {
        return String(v == null ? '' : v)
            .replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    },

    _when(iso) {
        if (!iso) return '—';
        try {
            if (typeof Jalali !== 'undefined' && Jalali.toJalaliDateTime) {
                return Jalali.toJalaliDateTime(iso);
            }
            return new Date(iso).toLocaleString('fa-IR');
        } catch (e) { return String(iso); }
    },

    _statusMeta(status) {
        const map = {
            draft:       { label: 'ناتمام',        cls: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
            new:         { label: 'جدید',          cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
            in_progress: { label: 'در حال انجام',  cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
            completed:   { label: 'انجام شد',      cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
            rejected:    { label: 'رد شد',         cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
        };
        return map[status] || { label: status || '—', cls: 'bg-white/10 text-white border-white/20' };
    },

    _kindMeta(kind) {
        const map = {
            voice:    { icon: 'fa-microphone',       label: 'ویس',      color: 'text-fuchsia-300' },
            audio:    { icon: 'fa-music',            label: 'صوت',      color: 'text-fuchsia-300' },
            photo:    { icon: 'fa-image',            label: 'عکس',      color: 'text-lime-300' },
            document: { icon: 'fa-file-pdf',         label: 'فایل',     color: 'text-orange-300' },
            video:    { icon: 'fa-video',            label: 'ویدیو',    color: 'text-sky-300' },
        };
        return map[kind] || { icon: 'fa-paperclip', label: kind || 'فایل', color: 'text-gray-300' };
    },

    _bytes(n) {
        n = Number(n) || 0;
        if (n < 1024) return this._fa(n) + ' بایت';
        if (n < 1048576) return this._fa((n / 1024).toFixed(1)) + ' کیلوبایت';
        return this._fa((n / 1048576).toFixed(1)) + ' مگابایت';
    },

    // ── ورود به صفحه ─────────────────────────────────────────
    init(user) {
        if (user && user.id) this.currentUser = user;
        const me = this._me();
        this.role = me.role || 'agent';
        // کارمند کارش تخصیص است → اول «استخر عمومی»؛ مدیر همه را می‌بیند
        if (!this._loadedOnce) {
            if (this.role === 'employee') this._scope = 'pool';
            else if (this.role === 'manager') this._scope = 'all';
        }

        if (!this._loadedOnce) {
            this._renderLoading();
            this.load();
            this._loadedOnce = true;
        } else {
            this.load(true);
        }
        this._subscribeRealtime();
    },

    destroy() {
        try {
            if (this._channel && this._sb()) {
                this._sb().removeChannel(this._channel);
            }
        } catch (e) { /* نادیده */ }
        this._channel = null;
    },

    _subscribeRealtime() {
        if (this._channel) return;
        const sb = this._sb();
        if (!sb || typeof sb.channel !== 'function') return;
        try {
            this._channel = sb.channel('tadilat-changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'tadilat_requests' },
                    () => this.load(true))
                .subscribe();
        } catch (e) { /* realtime اختیاری است */ }
    },

    // ── بارگذاری داده ────────────────────────────────────────
    async load(keepView) {
        if (this._loading) return;
        this._loading = true;
        this._error = null;
        const sb = this._sb();
        if (!sb) {
            this._loading = false;
            this._error = 'اتصال به Supabase برقرار نیست.';
            this._renderError();
            return;
        }
        try {
            let query = sb.from('tadilat_requests')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(300);
            // نویسنده‌ها درخواست‌های ناتمام (در حال دریافت) را نمی‌بینند
            if (!this._isManager()) {
                query = query.neq('status', 'draft');
            }
            const { data, error } = await query;
            if (error) throw error;

            this._requests = Array.isArray(data) ? data : [];
            // نویسنده = فقط کارهای خودش | کارمند و مدیر = استخر عمومی برای تخصیص
            const me = this._me();
            this._mine = this._requests.filter(r => me && r.assigned_agent_id === me.id);
            // پیش‌نویس (ارسال نیمه‌کاره) در استخر نمی‌آید؛ تخصیص زودهنگام بی‌معنی است
            this._pool = this._requests.filter(
                r => !r.assigned_agent_id && r.status !== 'draft');
            this._assigned = this._requests.filter(r => !!r.assigned_agent_id);

            // دادهٔ لازم برای «نویسندهٔ پیشنهادی» (سبک: چند ده ردیف)
            await this._loadOrders();
            await this._loadAgents();

            if (this._requests.length) {
                const ids = this._requests.map(r => r.id);
                const { data: files, error: fErr } = await sb
                    .from('tadilat_files')
                    .select('*')
                    .in('request_id', ids)
                    .order('created_at', { ascending: true });
                if (fErr) throw fErr;
                const grouped = {};
                (files || []).forEach(f => {
                    (grouped[f.request_id] = grouped[f.request_id] || []).push(f);
                });
                this._filesByRequest = grouped;
            } else {
                this._filesByRequest = {};
            }
        } catch (e) {
            this._error = (e && (e.message || e.details)) || String(e);
            if (/does not exist|schema cache|PGRST205/i.test(this._error)) {
                this._error = 'جدول‌های تعدیلات ساخته نشده‌اند. فایل '
                    + 'supabase/tadilat_telegram_migration.sql را در Supabase اجرا کنید.';
            }
            console.error('TadilatModule.load:', e);
        } finally {
            this._loading = false;
        }
        this.render();
    },

    async _loadStudents() {
        if (this._students) return this._students;
        const sb = this._sb();
        if (!sb) return [];
        try {
            const { data } = await sb.from('profiles')
                .select('id,name,student_id')
                .eq('role', 'student')
                .order('name')
                .limit(3000);
            this._students = Array.isArray(data) ? data : [];
        } catch (e) {
            this._students = [];
        }
        return this._students;
    },

    async _loadAgents() {
        if (this._agents) return this._agents;
        const sb = this._sb();
        if (!sb) return [];
        try {
            const { data } = await sb.from('profiles')
                .select('id,name')
                .eq('role', 'agent')
                .order('name');
            this._agents = Array.isArray(data) ? data : [];
        } catch (e) {
            this._agents = [];
        }
        return this._agents;
    },

    // ── نویسندهٔ پیشنهادی (همان زنجیرهٔ مسیریاب خودکار) ──────
    _normKey(v) {
        return String(v == null ? '' : v)
            .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
            .replace(/[\u200b-\u200f\u202a-\u202e]/g, ' ')
            .replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک')
            .replace(/[ۀة]/g, 'ه').replace(/[أإآٱ]/g, 'ا')
            .replace(/[ؤ]/g, 'و').replace(/[ئ]/g, 'ی')
            .replace(/\s+/g, '')
            .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    },

    async _loadOrders() {
        if (this._orders) return this._orders;
        const sb = this._sb();
        if (!sb) return [];
        try {
            const { data } = await sb.from('orders')
                .select('id,student_id,student_name,assigned_agent_id,created_at')
                .order('created_at', { ascending: false })
                .limit(1000);
            this._orders = (data || [])
                .filter(o => o.assigned_agent_id)
                .map(o => ({
                    id: o.id,
                    student_id: o.student_id || null,
                    key: this._normKey(o.student_name),
                    agent_id: o.assigned_agent_id,
                    created_at: o.created_at || '',
                }));
        } catch (e) {
            this._orders = [];
        }
        return this._orders;
    },

    /**
     * برای درخواستی که نویسنده ندارد، نویسندهٔ همان دانشجو را پیدا می‌کند.
     * خروجی: {agent_id, agent_name, order_id} یا null
     */
    _suggestWriter(req) {
        if (!req || !this._orders || !this._orders.length) return null;
        const key = this._normKey(req.student_name);
        const hits = this._orders.filter(o => {
            if (req.student_id && o.student_id && o.student_id === req.student_id) return true;
            if (!key || !o.key || key.length < 4 || o.key.length < 4) return false;
            if (o.key === key) return true;
            if (o.key.indexOf(key) !== -1 || key.indexOf(o.key) !== -1) {
                return Math.min(o.key.length, key.length) /
                       Math.max(o.key.length, key.length) >= 0.75;
            }
            return false;
        });
        if (!hits.length) return null;
        hits.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        const top = hits[0];
        const agent = (this._agents || []).find(a => a.id === top.agent_id);
        return {
            agent_id: top.agent_id,
            agent_name: agent ? agent.name : top.agent_id,
            order_id: top.id,
        };
    },

    // ── لینک موقت فایل‌ها ────────────────────────────────────
    async _signedUrl(path) {
        if (!path) return null;
        const hit = this._signedCache[path];
        if (hit && hit.exp > Date.now() + 60000) return hit.url;
        const sb = this._sb();
        if (!sb) return null;
        try {
            const { data, error } = await sb.storage
                .from(this.BUCKET)
                .createSignedUrl(path, 3600 * 6);
            if (error || !data || !data.signedUrl) return null;
            // لینک ۶ ساعته؛ ۱ دقیقه حاشیهٔ امن برای تمدید
            this._signedCache[path] = {
                url: data.signedUrl,
                exp: Date.now() + 6 * 3600 * 1000,
            };
            return data.signedUrl;
        } catch (e) {
            return null;
        }
    },

    async _preview(path, kind) {
        const url = await this._signedUrl(path);
        if (!url) {
            UTILS.showNotification('نمایش فایل ممکن نشد — دوباره تلاش کنید', 'error');
            return;
        }
        window.open(url, '_blank');
    },

    // ── رندر ─────────────────────────────────────────────────
    _renderLoading() {
        const root = this._root();
        if (!root) return;
        root.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20">
                <i class="fas fa-spinner fa-spin text-3xl text-lime-400"></i>
                <p class="mt-4 text-gray-300">در حال بارگذاری تعدیلات…</p>
            </div>`;
    },

    _renderError() {
        const root = this._root();
        if (!root) return;
        root.innerHTML = `
            <div class="bg-rose-500/10 border border-rose-500/40 rounded-2xl p-6 text-center">
                <i class="fas fa-triangle-exclamation text-3xl text-rose-400"></i>
                <p class="mt-3 text-rose-200 font-medium">خطا در بارگذاری تعدیلات</p>
                <p class="mt-2 text-sm text-rose-300/80">${this._esc(this._error)}</p>
                <button data-td-action="reload"
                        class="mt-4 bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-xl">
                    <i class="fas fa-rotate ml-2"></i> تلاش دوباره
                </button>
            </div>`;
    },

    _counts() {
        const c = { all: 0, new: 0, in_progress: 0, completed: 0, draft: 0, rejected: 0 };
        this._requests.forEach(r => {
            c.all++;
            if (Object.prototype.hasOwnProperty.call(c, r.status)) c[r.status]++;
        });
        return c;
    },

    _visibleRequests() {
        const q = (this._query || '').trim().toLowerCase();
        // نویسنده فقط کارهای خودش را می‌بیند؛ تخصیص کارِ کارمند و مدیر است
        let base;
        if (this.role === 'agent') {
            base = this._mine || [];
        } else if (this._scope === 'pool') {
            base = this._pool || [];
        } else if (this._scope === 'assigned') {
            base = this._assigned || [];
        } else {
            base = this._requests;
        }
        return base.filter(r => {
            if (this._filter !== 'all' && r.status !== this._filter) return false;
            if (r.status === 'draft' && !this._isManager() && this._filter !== 'draft') return false;
            if (!q) return true;
            const hay = [r.student_name, r.student_no, r.telegram_username, r.telegram_name,
                         r.assigned_agent_name, r.id].join(' ').toLowerCase();
            return hay.indexOf(q) !== -1;
        });
    },

    _scopeChip(label, value, count, icon) {
        const active = this._scope === value;
        const cls = active
            ? 'bg-sky-500/25 text-sky-200 border-sky-400/60'
            : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10';
        return `<button data-td-action="scope" data-td-value="${this._esc(value)}"
                    class="px-3.5 py-1.5 rounded-full border text-sm transition-all ${cls}">
                    <i class="fas ${icon} ml-1"></i>${this._esc(label)}
                    <span class="opacity-70">${this._fa(count)}</span>
                </button>`;
    },

    _chip(label, value, active) {
        const cls = active
            ? 'bg-lime-500/25 text-lime-200 border-lime-400/60'
            : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10';
        return `<button data-td-action="filter" data-td-value="${this._esc(value)}"
                    class="px-3.5 py-1.5 rounded-full border text-sm transition-all ${cls}">
                    ${this._esc(label)} <span class="opacity-70">${this._fa(this._counts()[value] || 0)}</span>
                </button>`;
    },

    render() {
        const root = this._root();
        if (!root) return;
        if (this._error && !this._requests.length) return this._renderError();

        const counts = this._counts();
        const list = this._visibleRequests();
        const me = this._me();

        root.innerHTML = `
        <div class="space-y-5" id="td-wrapper">

            <!-- سرصفحه -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                    <span class="bg-lime-500/20 p-2 rounded-xl">
                        <i class="fas fa-file-pen text-lime-400"></i>
                    </span>
                    تعدیلات
                    <span class="text-sm font-normal text-gray-400">
                        (دریافتی از مینی‌اپ و ربات تلگرام)
                    </span>
                </h2>
                <button data-td-action="reload"
                        class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 self-start">
                    <i class="fas fa-rotate"></i> به‌روزرسانی
                </button>
            </div>

            <!-- آمار -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${this._statCard('در انتظار', counts.new, 'fa-inbox', 'text-amber-300')}
                ${this._statCard('در حال انجام', counts.in_progress, 'fa-spinner', 'text-sky-300')}
                ${this._statCard('انجام‌شده', counts.completed, 'fa-circle-check', 'text-emerald-300')}
                ${this._statCard('کل', counts.all, 'fa-layer-group', 'text-lime-300')}
            </div>

            <!-- استخر عمومی — فقط کارمند و مدیر، برای تخصیص به نویسنده -->
            ${this._isManager() ? `
            <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                <div class="flex flex-wrap gap-2">
                    ${this._scopeChip('استخر عمومی', 'pool', (this._pool || []).length, 'fa-inbox')}
                    ${this._scopeChip('ارجاع‌شده', 'assigned', (this._assigned || []).length, 'fa-user-pen')}
                    ${this._scopeChip('همه', 'all', this._requests.length, 'fa-layer-group')}
                </div>
                <p class="text-xs text-gray-400 sm:mr-auto">
                    <i class="fas fa-circle-info ml-1"></i>
                    تعدیلات بدون نویسنده اینجاست — بازش کن و به نویسنده بسپار
                </p>
            </div>` : ''}

            <!-- فیلتر و جستجو -->
            <div class="flex flex-col lg:flex-row lg:items-center gap-3">
                <div class="flex flex-wrap gap-2">
                    ${this._chip('همه', 'all', this._filter === 'all')}
                    ${this._chip('جدید', 'new', this._filter === 'new')}
                    ${this._chip('در حال انجام', 'in_progress', this._filter === 'in_progress')}
                    ${this._chip('انجام‌شده', 'completed', this._filter === 'completed')}
                    ${this._isManager() ? this._chip('ناتمام', 'draft', this._filter === 'draft') : ''}
                </div>
                <div class="relative flex-1 lg:max-w-sm">
                    <i class="fas fa-magnifying-glass absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input id="td-search" data-td-input="search" value="${this._esc(this._query)}"
                           placeholder="جستجوی نام دانشجو یا کد پیگیری…"
                           class="w-full bg-white/5 border border-white/15 rounded-xl pr-11 pl-4 py-2.5 text-white placeholder-gray-400 focus:border-lime-400/60 focus:outline-none">
                </div>
            </div>

            ${this._loading ? '<div class="text-center py-4 text-gray-400"><i class="fas fa-spinner fa-spin ml-2"></i> در حال به‌روزرسانی…</div>' : ''}

            <!-- فهرست -->
            ${list.length === 0 ? this._emptyState() : `
            <div class="space-y-3">
                ${list.map(r => this._card(r)).join('')}
            </div>`}

            <datalist id="td-students-list">
                ${(this._students || []).map(s =>
                    `<option value="${this._esc(s.name)}${s.student_id ? ' — ' + this._esc(s.student_id) : ''}"></option>`
                ).join('')}
            </datalist>
        </div>`;

        this._afterRender();
    },

    _statCard(label, value, icon, color) {
        return `
        <div class="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-xs text-gray-400">${this._esc(label)}</p>
                    <p class="text-2xl font-bold text-white mt-1">${this._fa(value)}</p>
                </div>
                <i class="fas ${icon} text-2xl ${color}"></i>
            </div>
        </div>`;
    },

    _emptyState() {
        return `
        <div class="bg-white/5 border border-white/10 rounded-2xl py-16 text-center">
            <i class="fas fa-inbox text-4xl text-gray-500"></i>
            <p class="mt-4 text-gray-300 font-medium">تعدیلاتی یافت نشد</p>
            <p class="mt-2 text-sm text-gray-400">
                ${this._requests.length === 0
                    ? 'هنوز تعدیلاتی از ربات تلگرام دریافت نشده است.'
                    : 'با فیلتر یا عبارت جستجوی دیگری امتحان کنید.'}
            </p>
        </div>`;
    },

    _card(r) {
        const st = this._statusMeta(r.status);
        const files = this._filesByRequest[r.id] || [];
        const expanded = !!this._expanded[r.id];
        const mine = this._me();
        const isMine = r.assigned_agent_id && mine && r.assigned_agent_id === mine.id;
        const canClaim = this.role === 'agent' && !isMine
            && (r.status === 'new' || r.status === 'in_progress' || r.status === 'rejected');
        const canComplete = this.role === 'agent' && isMine && r.status === 'in_progress';
        const linked = !!r.student_id;

        return `
        <div class="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-4 sm:p-5">
                <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">

                    <div class="flex items-start gap-4 flex-1 min-w-0">
                        <div class="w-12 h-12 rounded-xl bg-lime-500/15 flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-user-graduate text-lime-300 text-lg"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <h3 class="text-lg font-bold text-white">${this._esc(r.student_name)}</h3>
                                <span class="text-xs px-2.5 py-1 rounded-full border ${st.cls}">${this._esc(st.label)}</span>
                                ${r.name_source === 'voice' || r.name_source === 'voice_stt'
                                    ? '<span class="text-xs px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30"><i class="fas fa-microphone ml-1"></i>نام با ویس</span>' : ''}
                                ${r.source === 'telegram_bot'
                                    ? '<span class="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30"><i class="fab fa-telegram ml-1"></i>از ربات</span>'
                                    : '<span class="text-xs px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-300 border border-lime-500/30"><i class="fas fa-mobile-screen ml-1"></i>از مینی‌اپ</span>'}
                                ${linked
                                    ? '<span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><i class="fas fa-link ml-1"></i>متصل به پروفایل</span>'
                                    : '<span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">بدون پروفایل</span>'}
                                ${r.assigned_agent_name
                                    ? `<span class="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                         <i class="fas fa-user-pen ml-1"></i>${this._esc(r.assigned_agent_name)}
                                         ${r.routed_by === 'auto' ? '<span class="opacity-70"> · خودکار</span>' : ''}
                                       </span>`
                                    : '<span class="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30"><i class="fas fa-hand ml-1"></i>بدون نویسنده</span>'}
                            </div>
                            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
                                <span><i class="fas fa-clock ml-1"></i>${this._when(r.created_at)}</span>
                                <span><i class="fas fa-paperclip ml-1"></i>${this._fa(files.length)} فایل</span>
                                ${r.student_no ? `<span><i class="fas fa-hashtag ml-1"></i>${this._esc(r.student_no)}</span>` : ''}
                                ${r.telegram_username ? `<span><i class="fab fa-telegram ml-1"></i>@${this._esc(r.telegram_username)}</span>` : ''}
                                ${r.assigned_agent_name ? `<span><i class="fas fa-user-pen ml-1"></i>${this._esc(r.assigned_agent_name)}</span>` : ''}
                            </div>
                            ${r.note ? `<p class="mt-2 text-sm text-gray-300 bg-white/5 rounded-lg px-3 py-2">${this._esc(r.note)}</p>` : ''}
                            ${r.agent_note ? `<p class="mt-2 text-sm text-sky-200 bg-sky-500/10 rounded-lg px-3 py-2"><i class="fas fa-comment ml-1"></i>${this._esc(r.agent_note)}</p>` : ''}
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                        <button data-td-action="toggle" data-td-id="${this._esc(r.id)}"
                                class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm transition-all">
                            <i class="fas ${expanded ? 'fa-chevron-up' : 'fa-paperclip'} ml-1"></i>
                            ${expanded ? 'بستن'
                                : (this._isManager() && !r.assigned_agent_id
                                    ? 'تخصیص نویسنده'
                                    : 'مشاهده فایل‌ها')}
                        </button>
                        ${canClaim ? `
                        <button data-td-action="claim" data-td-id="${this._esc(r.id)}"
                                class="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm transition-all">
                            <i class="fas fa-hand ml-1"></i> برمی‌دارم
                        </button>` : ''}
                        ${canComplete ? `
                        <button data-td-action="complete" data-td-id="${this._esc(r.id)}"
                                class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm transition-all">
                            <i class="fas fa-check ml-1"></i> انجام شد
                        </button>
                        <button data-td-action="reject" data-td-id="${this._esc(r.id)}"
                                class="bg-rose-600/80 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm transition-all">
                            <i class="fas fa-xmark ml-1"></i> رد
                        </button>` : ''}
                    </div>
                </div>

                ${expanded ? this._filesPanel(r, files) : ''}
            </div>
        </div>`;
    },

    _filesPanel(r, files) {
        const mine = this._me();
        const students = this._students || [];
        const agents = this._agents || [];
        // نویسندهٔ پیشنهادی برای درخواست‌های بدون نویسنده (استخر عمومی)
        const suggest = (!r.assigned_agent_id && this._isManager())
            ? this._suggestWriter(r) : null;

        return `
        <div class="mt-4 pt-4 border-t border-white/10">
            ${suggest ? `
            <div class="mb-4 bg-emerald-500/10 border border-emerald-500/35 rounded-xl p-3">
                <p class="text-sm text-emerald-200 font-medium">
                    <i class="fas fa-lightbulb ml-1"></i>
                    نویسندهٔ همین دانشجو: <b>${this._esc(suggest.agent_name)}</b>
                    <span class="text-xs opacity-75">(از سفارش ${this._esc(String(suggest.order_id))})</span>
                </p>
                <button data-td-action="assignSuggested" data-td-id="${this._esc(r.id)}"
                        data-td-agent="${this._esc(suggest.agent_id)}"
                        data-td-name="${this._esc(suggest.agent_name)}"
                        class="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    <i class="fas fa-share ml-1"></i> ارجاع به همین نویسنده
                </button>
            </div>` : ''}

            ${files.length === 0
                ? '<p class="text-sm text-gray-400"><i class="fas fa-circle-info ml-1"></i>هنوز فایلی برای این درخواست ثبت نشده است.</p>'
                : `<div class="space-y-2">${files.map(f => this._fileRow(f)).join('')}</div>`}

            ${this._isManager() ? `
            <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div class="bg-white/5 rounded-xl p-3">
                    <label class="block text-xs text-gray-400 mb-2">اتصال به پروفایل دانشجو</label>
                    <div class="flex gap-2">
                        <input list="td-students-list" data-td-input="student"
                               id="td-student-${this._esc(r.id)}"
                               placeholder="نام دانشجو را بنویسید…"
                               class="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-lime-400/60 focus:outline-none">
                        <button data-td-action="linkStudent" data-td-id="${this._esc(r.id)}"
                                class="bg-lime-600 hover:bg-lime-700 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                            اتصال
                        </button>
                        ${r.student_id ? `
                        <button data-td-action="unlinkStudent" data-td-id="${this._esc(r.id)}"
                                class="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap">
                            حذف اتصال
                        </button>` : ''}
                    </div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <label class="block text-xs text-gray-400 mb-2">ارجاع به نویسنده (دکتر)</label>
                    <div class="flex gap-2">
                        <select id="td-agent-${this._esc(r.id)}"
                                class="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-lime-400/60 focus:outline-none">
                            <option value="">— انتخاب نویسنده —</option>
                            ${agents.map(a => `<option value="${this._esc(a.id)}"
                                ${r.assigned_agent_id === a.id ? 'selected' : ''}>${this._esc(a.name)}</option>`).join('')}
                        </select>
                        <button data-td-action="assignAgent" data-td-id="${this._esc(r.id)}"
                                class="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                            ارجاع
                        </button>
                    </div>
                </div>
            </div>` : `
            <div class="mt-4 bg-white/5 rounded-xl p-3">
                <label class="block text-xs text-gray-400 mb-2">یادداشت نویسنده</label>
                <div class="flex gap-2">
                    <input data-td-input="agentNote" id="td-note-${this._esc(r.id)}"
                           value="${this._esc(r.agent_note || '')}"
                           placeholder="توضیح دربارهٔ انجام این تعدیلات…"
                           class="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-lime-400/60 focus:outline-none">
                    <button data-td-action="saveNote" data-td-id="${this._esc(r.id)}"
                            class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                        ذخیره
                    </button>
                </div>
            </div>`}

            ${r.name_audio_path ? `
            <div class="mt-3">
                <p class="text-xs text-gray-400 mb-1"><i class="fas fa-microphone ml-1"></i>ویس نام دانشجو</p>
                <button data-td-action="playAudio" data-td-path="${this._esc(r.name_audio_path)}"
                        class="bg-fuchsia-600/30 hover:bg-fuchsia-600/50 text-fuchsia-100 px-4 py-2 rounded-lg text-sm">
                    <i class="fas fa-play ml-1"></i> پخش
                </button>
                <div id="td-audio-${this._esc(r.id)}"></div>
            </div>` : ''}

            <p class="mt-3 text-xs text-gray-500">
                <i class="fas fa-fingerprint ml-1"></i>کد پیگیری: <span class="font-mono">${this._esc(r.id)}</span>
            </p>
        </div>`;
    },

    _fileRow(f) {
        const meta = this._kindMeta(f.kind);
        const isAudio = f.kind === 'voice' || f.kind === 'audio';
        return `
        <div class="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
            <div class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <i class="fas ${meta.icon} ${meta.color}"></i>
            </div>
            <div class="min-w-0 flex-1">
                <p class="text-sm text-white truncate">${this._esc(f.file_name || meta.label)}</p>
                <p class="text-xs text-gray-400">
                    ${this._esc(meta.label)}
                    ${f.file_size ? ' • ' + this._bytes(f.file_size) : ''}
                    ${f.duration ? ' • ' + this._fa(f.duration) + ' ثانیه' : ''}
                    ${f.caption ? ' • ' + this._esc(String(f.caption).slice(0, 60)) : ''}
                </p>
            </div>
            ${isAudio ? `
            <button data-td-action="playAudio" data-td-path="${this._esc(f.storage_path)}"
                    class="bg-fuchsia-600/30 hover:bg-fuchsia-600/50 text-fuchsia-100 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">
                <i class="fas fa-play ml-1"></i> پخش
            </button>` : `
            <button data-td-action="openFile" data-td-path="${this._esc(f.storage_path)}"
                    data-td-kind="${this._esc(f.kind)}"
                    class="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">
                <i class="fas fa-up-right-from-square ml-1"></i> نمایش
            </button>`}
        </div>`;
    },

    // ── رویدادها ─────────────────────────────────────────────
    _afterRender() {
        const root = this._root();
        if (!root) return;

        if (!this._bound) {
            root.addEventListener('click', (ev) => {
                const btn = ev.target.closest('[data-td-action]');
                if (!btn) return;
                this._onAction(btn.getAttribute('data-td-action'),
                               btn.getAttribute('data-td-id'),
                               btn, ev);
            });
            root.addEventListener('input', (ev) => {
                const el = ev.target.closest('[data-td-input]');
                if (!el) return;
                if (el.getAttribute('data-td-input') === 'search') {
                    this._query = el.value;
                    // بدون re-render کامل تا فوکوس از دست نرود
                    clearTimeout(this._searchTimer);
                    this._searchTimer = setTimeout(() => {
                        const input = document.getElementById('td-search');
                        const pos = input ? input.selectionStart : null;
                        this.render();
                        const again = document.getElementById('td-search');
                        if (again) { again.focus(); if (pos != null) again.setSelectionRange(pos, pos); }
                    }, 350);
                }
            });
            this._bound = true;
        }
        this._loadStudents().then(() => {
            const dl = document.getElementById('td-students-list');
            if (dl && !dl.children.length && this._students) {
                dl.innerHTML = this._students.map(s =>
                    `<option value="${this._esc(s.name)}${s.student_id ? ' — ' + this._esc(s.student_id) : ''}"></option>`
                ).join('');
            }
        });
        this._loadAgents();
    },

    async _onAction(action, id, btn, ev) {
        if (action === 'reload') return this.load(true);
        if (action === 'filter') {
            this._filter = btn.getAttribute('data-td-value') || 'all';
            return this.render();
        }
        if (action === 'scope') {
            this._scope = btn.getAttribute('data-td-value') || 'mine';
            return this.render();
        }
        if (action === 'toggle') {
            this._expanded[id] = !this._expanded[id];
            return this.render();
        }
        if (action === 'openFile') {
            return this._preview(btn.getAttribute('data-td-path'), btn.getAttribute('data-td-kind'));
        }
        if (action === 'playAudio') {
            return this._playAudio(btn.getAttribute('data-td-path'), id, btn);
        }
        if (action === 'claim') {
            const me = this._me();
            const ok = await this._update(id, {
                status: 'in_progress',
                assigned_agent_id: me.id,
                assigned_agent_name: me.name || me.username || '',
            }, 'درخواست به نام شما ثبت شد');
            return ok && this.load(true);
        }
        if (action === 'complete') {
            const ok = await this._update(id, { status: 'completed' }, 'تعدیلات انجام‌شده ثبت شد');
            return ok && this.load(true);
        }
        if (action === 'reject') {
            const ok = await this._update(id, { status: 'rejected' }, 'درخواست رد شد');
            return ok && this.load(true);
        }
        if (action === 'saveNote') {
            const el = document.getElementById('td-note-' + id);
            const ok = await this._update(id, { agent_note: el ? el.value.trim() : '' }, 'یادداشت ذخیره شد');
            return ok && this.load(true);
        }
        if (action === 'linkStudent') {
            return this._linkStudent(id);
        }
        if (action === 'unlinkStudent') {
            const ok = await this._update(id, { student_id: null }, 'اتصال پروفایل حذف شد');
            return ok && this.load(true);
        }
        if (action === 'assignSuggested') {
            const agentId = btn.getAttribute('data-td-agent');
            const agentName = btn.getAttribute('data-td-name') || '';
            const ok = await this._update(id, {
                assigned_agent_id: agentId,
                assigned_agent_name: agentName,
                status: 'in_progress',
                routed_at: new Date().toISOString(),
                routed_by: 'manual',
                routed_note: 'تخصیص توسط کارمند (پیشنهاد مسیریاب)',
            }, 'به نویسنده «' + agentName + '» سپرده شد');
            return ok && this.load(true);
        }
        if (action === 'assignAgent') {
            const sel = document.getElementById('td-agent-' + id);
            const agentId = sel ? sel.value : '';
            if (!agentId) {
                UTILS.showNotification('ابتدا یک نویسنده انتخاب کنید', 'warning');
                return;
            }
            const agent = (this._agents || []).find(a => a.id === agentId);
            const ok = await this._update(id, {
                assigned_agent_id: agentId,
                assigned_agent_name: agent ? agent.name : '',
                status: 'in_progress',
                routed_at: new Date().toISOString(),
                routed_by: 'manual',
                routed_note: 'تخصیص دستی توسط کارمند',
            }, 'به نویسنده ارجاع شد');
            return ok && this.load(true);
        }
    },

    async _playAudio(path, id, btn) {
        const holder = id ? document.getElementById('td-audio-' + id) : null;
        const url = await this._signedUrl(path);
        if (!url) {
            UTILS.showNotification('پخش ویس ممکن نشد', 'error');
            return;
        }
        if (holder) {
            holder.innerHTML = `<audio controls autoplay class="mt-2 w-full"
                src="${this._esc(url)}"></audio>`;
        } else {
            window.open(url, '_blank');
        }
    },

    async _linkStudent(requestId) {
        const input = document.getElementById('td-student-' + requestId);
        const raw = input ? input.value.trim() : '';
        if (!raw) {
            UTILS.showNotification('نام دانشجو را وارد کنید', 'warning');
            return;
        }
        const students = await this._loadStudents();
        // ورودی می‌تواند «نام» یا «نام — شمارهٔ دانشجویی» باشد
        const [namePart, noPart] = raw.split('—').map(s => s.trim());
        let match = students.find(s => s.student_id && noPart && s.student_id === noPart);
        if (!match) {
            const norm = (s) => String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
                .replace(/\s+/g, ' ').trim();
            match = students.find(s => norm(s.name) === norm(namePart));
            if (!match) {
                const cands = students.filter(s => norm(s.name).indexOf(norm(namePart)) !== -1);
                if (cands.length === 1) match = cands[0];
                else if (cands.length > 1) {
                    UTILS.showNotification('چند دانشجو با این نام پیدا شد — دقیق‌تر بنویسید', 'warning');
                    return;
                }
            }
        }
        if (!match) {
            UTILS.showNotification('دانشجویی با این مشخصات پیدا نشد', 'warning');
            return;
        }
        const ok = await this._update(requestId, {
            student_id: match.id,
            student_no: match.student_id || null,
        }, 'به پروفایل «' + match.name + '» متصل شد');
        return ok && this.load(true);
    },

    async _update(id, patch, okMessage) {
        const sb = this._sb();
        if (!sb) {
            UTILS.showNotification('اتصال برقرار نیست', 'error');
            return false;
        }
        try {
            const { error } = await sb.from('tadilat_requests').update(patch).eq('id', id);
            if (error) throw error;
            if (okMessage) UTILS.showNotification(okMessage, 'success');
            return true;
        } catch (e) {
            console.error('TadilatModule._update:', e);
            UTILS.showNotification('ذخیرهٔ تغییرات ناموفق بود: ' + (e.message || e), 'error');
            return false;
        }
    },
};

window.TadilatModule = TadilatModule;
console.log('📦 tadilat.js بارگذاری شد');
