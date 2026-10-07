// ============================================================
// js/tadilat.js — صفحهٔ «تعدیلات» (جدولی، مثل صفحهٔ سفارت)
//
// نقش‌ها:
//   • agent (نویسنده/دکتر) → فقط کارهای خودش
//   • employee / manager   → همه، با تب «استخر عمومی» برای تخصیص به نویسنده
//
// قابلیت‌ها:
//   • جدول ستونی: ردیف، کد ۵ رقمی، نام، شمارهٔ دانشجویی، نویسنده، فایل‌ها،
//     🎤 پخش ویس نام، وضعیت، منبع، تاریخ، زمان تحویل، عملیات
//   • فیلتر: جستجو، وضعیت، نویسنده، منبع، بازهٔ تاریخ، فیلترهای سریع
//   • «تعدیل جدید» → ثبت دستی توسط کارمند/مدیر
// ============================================================

const TadilatModule = {
    BUCKET: 'student-documents',
    supabase: null,
    currentUser: null,
    role: 'agent',

    _loadedOnce: false,
    _loading: false,
    _bound: false,
    _requests: [],
    _filesByRequest: {},
    _students: null,
    _agents: null,
    _orders: null,
    _mine: [],
    _pool: [],
    _assigned: [],
    _signedCache: {},
    _expanded: {},
    _playing: null,
    _channel: null,
    _error: null,

    // ── فیلترها ─────────────────────────────────────────────
    _f: { q: '', status: '', agent: '', source: '', from: '', to: '', quick: '' },
    _scope: 'all',        // pool | assigned | all  (کارمند و مدیر)
    _sortDesc: true,

    STATUSES: [
        ['', 'همه وضعیت‌ها'],
        ['draft', 'ناتمام'],
        ['new', 'دریافت شد'],
        ['started', 'شروع شد'],
        ['in_progress', 'در حال انجام'],
        ['ready', 'آماده تحویل'],
        ['completed', 'تحویل شد'],
        ['rejected', 'رد شد'],
    ],

    QUICK: [
        ['pool', 'بدون نویسنده', 'fa-hand', 'manager'],
        ['has_voice', 'ویس نام دارد', 'fa-microphone'],
        ['no_voice', 'بدون ویس نام', 'fa-microphone-slash'],
        ['waiting', 'در انتظار اقدام', 'fa-hourglass-half'],
        ['due_soon', 'تحویل نزدیک', 'fa-clock'],
        ['overdue', 'تحویل گذشته', 'fa-triangle-exclamation'],
    ],

    // ── ابزارها ──────────────────────────────────────────────
    _sb() {
        if (this.supabase) return this.supabase;
        try {
            if (typeof getSupabaseClient === 'function') this.supabase = getSupabaseClient();
            else if (window.supabaseClient) this.supabase = window.supabaseClient;
        } catch (e) { /* آفلاین */ }
        return this.supabase;
    },

    _root() { return document.getElementById('tadilat-root'); },

    _me() {
        if (this.currentUser && this.currentUser.id) return this.currentUser;
        try {
            const raw = localStorage.getItem('currentUser') ||
                        localStorage.getItem('edu_system_current_user');
            if (raw) this.currentUser = JSON.parse(raw);
        } catch (e) { /* نادیده */ }
        return this.currentUser || {};
    },

    _isManager() { return this.role === 'manager' || this.role === 'employee'; },

    _esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    _fa(v) {
        return String(v == null ? '' : v).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
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

    _dateOnly(iso) {
        if (!iso) return '—';
        try {
            if (typeof Jalali !== 'undefined' && Jalali.toJalaliDisplay) {
                return Jalali.toJalaliDisplay(iso);
            }
            return new Date(iso).toLocaleDateString('fa-IR');
        } catch (e) { return String(iso); }
    },

    _statusMeta(status) {
        const map = {
            draft:       { label: 'ناتمام',       bg: '#eceaf3', fg: '#5b5680' },
            new:         { label: 'دریافت شد',    bg: '#fff4e2', fg: '#8a5600' },
            started:     { label: 'شروع شد',      bg: '#efe8ff', fg: '#5b3fd1' },
            in_progress: { label: 'در حال انجام', bg: '#e3edff', fg: '#2450c8' },
            ready:       { label: 'آماده تحویل',  bg: '#ddf8ec', fg: '#13774f' },
            completed:   { label: 'تحویل شد',     bg: '#ddf8ec', fg: '#13774f' },
            rejected:    { label: 'رد شد',        bg: '#ffe6ea', fg: '#a01235' },
        };
        return map[status] || { label: status || '—', bg: '#eceaf3', fg: '#5b5680' };
    },

    _badge(status) {
        const m = this._statusMeta(status);
        return `<span style="background:${m.bg};color:${m.fg};font-size:11px;padding:3px 9px;border-radius:999px;font-weight:700;white-space:nowrap">${this._esc(m.label)}</span>`;
    },

    _sourceLabel(src) {
        if (src === 'telegram_bot') return 'ربات (فوروارد)';
        if (src === 'manual') return 'ثبت دستی';
        return 'مینی‌اپ';
    },

    _bytes(n) {
        n = Number(n) || 0;
        if (n < 1024) return this._fa(n) + ' بایت';
        if (n < 1048576) return this._fa((n / 1024).toFixed(1)) + ' کیلوبایت';
        return this._fa((n / 1048576).toFixed(1)) + ' مگابایت';
    },

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

    _voiceFiles(r) {
        return (this._filesByRequest[r.id] || [])
            .filter(f => f.kind === 'voice' || f.kind === 'audio');
    },

    // ── ورود به صفحه ─────────────────────────────────────────
    init(user) {
        if (user && user.id) this.currentUser = user;
        const me = this._me();
        this.role = me.role || 'agent';
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
            if (this._channel && this._sb()) this._sb().removeChannel(this._channel);
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
        } catch (e) { /* اختیاری */ }
    },

    // ── داده ─────────────────────────────────────────────────
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
                .limit(500);
            if (!this._isManager()) query = query.neq('status', 'draft');
            const { data, error } = await query;
            if (error) throw error;
            this._requests = Array.isArray(data) ? data : [];

            const me = this._me();
            this._mine = this._requests.filter(r => me && r.assigned_agent_id === me.id);
            this._pool = this._requests.filter(r => !r.assigned_agent_id && r.status !== 'draft');
            this._assigned = this._requests.filter(r => !!r.assigned_agent_id);

            if (this._requests.length) {
                const ids = this._requests.map(r => r.id);
                const { data: files, error: fErr } = await sb
                    .from('tadilat_files').select('*').in('request_id', ids)
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

            await this._loadOrders();
            await this._loadAgents();
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
                .select('id,name,student_id').eq('role', 'student')
                .order('name').limit(3000);
            this._students = Array.isArray(data) ? data : [];
        } catch (e) { this._students = []; }
        return this._students;
    },

    async _loadAgents() {
        if (this._agents) return this._agents;
        const sb = this._sb();
        if (!sb) return [];
        try {
            const { data } = await sb.from('profiles')
                .select('id,name').eq('role', 'agent').order('name');
            this._agents = Array.isArray(data) ? data : [];
        } catch (e) { this._agents = []; }
        return this._agents;
    },

    async _loadOrders() {
        if (this._orders) return this._orders;
        const sb = this._sb();
        if (!sb) return [];
        try {
            const { data } = await sb.from('orders')
                .select('id,student_id,student_name,assigned_agent_id,created_at')
                .order('created_at', { ascending: false }).limit(1000);
            this._orders = (data || []).filter(o => o.assigned_agent_id).map(o => ({
                id: o.id, student_id: o.student_id || null,
                key: this._normKey(o.student_name),
                agent_id: o.assigned_agent_id, created_at: o.created_at || '',
            }));
        } catch (e) { this._orders = []; }
        return this._orders;
    },

    /** نویسندهٔ پیشنهادی برای درخواست بدون نویسنده */
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
        return { agent_id: top.agent_id, agent_name: agent ? agent.name : top.agent_id,
                 order_id: top.id };
    },

    // ── فایل‌ها ──────────────────────────────────────────────
    async _signedUrl(path) {
        if (!path) return null;
        const hit = this._signedCache[path];
        if (hit && hit.exp > Date.now() + 60000) return hit.url;
        const sb = this._sb();
        if (!sb) return null;
        try {
            const { data, error } = await sb.storage.from(this.BUCKET)
                .createSignedUrl(path, 3600 * 6);
            if (error || !data || !data.signedUrl) return null;
            this._signedCache[path] = { url: data.signedUrl, exp: Date.now() + 6 * 3600 * 1000 };
            return data.signedUrl;
        } catch (e) { return null; }
    },

    // ── فیلترکردن ────────────────────────────────────────────
    _counts() {
        const c = { total: 0, pool: 0, new: 0, in_progress: 0, ready: 0, completed: 0 };
        (this._base() || []).forEach(r => {
            c.total++;
            if (!r.assigned_agent_id) c.pool++;
            if (r.status === 'new') c.new++;
            if (r.status === 'in_progress' || r.status === 'started') c.in_progress++;
            if (r.status === 'ready') c.ready++;
            if (r.status === 'completed') c.completed++;
        });
        return c;
    },

    _base() {
        if (this.role === 'agent') return this._mine || [];
        if (this._scope === 'pool') return this._pool || [];
        if (this._scope === 'assigned') return this._assigned || [];
        return this._requests;
    },

    _visible() {
        const f = this._f;
        const q = (f.q || '').trim().toLowerCase();
        const now = Date.now();
        let rows = (this._base() || []).filter(r => {
            if (f.status && r.status !== f.status) return false;
            if (f.agent && (r.assigned_agent_id || '') !== f.agent) return false;
            if (f.source && (r.source || '') !== f.source) return false;
            if (f.quick === 'pool' && r.assigned_agent_id) return false;
            if (f.quick === 'has_voice' && !r.name_audio_path) return false;
            if (f.quick === 'no_voice' && r.name_audio_path) return false;
            if (f.quick === 'waiting' && ['completed', 'rejected'].indexOf(r.status) !== -1) return false;
            if (f.quick === 'due_soon' || f.quick === 'overdue') {
                if (!r.due_at) return false;
                const d = new Date(r.due_at).getTime();
                if (f.quick === 'due_soon' && !(d >= now && d - now <= 48 * 3600 * 1000)) return false;
                if (f.quick === 'overdue' && !(d < now)) return false;
            }
            if (f.from || f.to) {
                const t = new Date(r.created_at || 0).getTime();
                if (f.from && t < new Date(f.from + 'T00:00:00').getTime()) return false;
                if (f.to && t > new Date(f.to + 'T23:59:59').getTime()) return false;
            }
            if (!q) return true;
            const hay = [
                r.student_name, r.student_no, r.code, r.telegram_username,
                r.telegram_name, r.assigned_agent_name, r.note, r.id,
            ].join(' ').toLowerCase();
            return hay.indexOf(q) !== -1;
        });
        return rows.slice().sort((a, b) => {
            const x = String(a.created_at || ''), y = String(b.created_at || '');
            return this._sortDesc ? y.localeCompare(x) : x.localeCompare(y);
        });
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
                <button data-td-action="reload" class="mt-4 bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-xl">
                    <i class="fas fa-rotate ml-2"></i> تلاش دوباره
                </button>
            </div>`;
    },

    _opt(value, label, selected) {
        return `<option value="${this._esc(value)}" ${selected ? 'selected' : ''}>${this._esc(label)}</option>`;
    },

    render() {
        const root = this._root();
        if (!root) return;
        if (this._error && !this._requests.length) return this._renderError();

        const rows = this._visible();
        const c = this._counts();
        const agents = this._agents || [];
        const f = this._f;

        const scopeBar = this._isManager() ? `
            <div class="flex flex-wrap items-center gap-2">
                <button data-td-action="scope" data-td-value="pool"
                        class="text-xs px-3 py-1.5 rounded-full border transition-all ${this._scope === 'pool'
                            ? 'bg-sky-500/25 text-sky-200 border-sky-400/60'
                            : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10'}">
                    <i class="fas fa-inbox ml-1"></i>استخر عمومی <span class="opacity-70">${this._fa(c.pool)}</span>
                </button>
                <button data-td-action="scope" data-td-value="assigned"
                        class="text-xs px-3 py-1.5 rounded-full border transition-all ${this._scope === 'assigned'
                            ? 'bg-sky-500/25 text-sky-200 border-sky-400/60'
                            : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10'}">
                    <i class="fas fa-user-pen ml-1"></i>ارجاع‌شده <span class="opacity-70">${this._fa((this._assigned || []).length)}</span>
                </button>
                <button data-td-action="scope" data-td-value="all"
                        class="text-xs px-3 py-1.5 rounded-full border transition-all ${this._scope === 'all'
                            ? 'bg-sky-500/25 text-sky-200 border-sky-400/60'
                            : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10'}">
                    <i class="fas fa-layer-group ml-1"></i>همه <span class="opacity-70">${this._fa(this._requests.length)}</span>
                </button>
                <span class="text-xs text-gray-400 mr-auto">
                    <i class="fas fa-circle-info ml-1"></i>
                    تعدیلات بدون نویسنده در «استخر عمومی» است — بازش کن و به نویسنده بسپار
                </span>
            </div>` : '';

        root.innerHTML = `
        <div class="space-y-5" id="td-wrapper">

            <!-- سرصفحه -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                        <span class="bg-lime-500 bg-opacity-20 p-2 rounded-xl">
                            <i class="fas fa-file-pen text-lime-400"></i>
                        </span>
                        تعدیلات
                    </h2>
                    <p class="text-gray-400 text-sm mt-1">
                        ${this.role === 'agent' ? 'تعدیلات تخصیص‌یافته به شما' : 'مدیریت و تخصیص تعدیلات دانشجویان'}
                    </p>
                </div>
                <div class="flex gap-2">
                    ${this._isManager() ? `
                    <button data-td-action="openAdd"
                            class="bg-lime-500 hover:bg-lime-400 text-gray-900 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg">
                        <i class="fas fa-plus"></i> تعدیل جدید
                    </button>` : ''}
                    <button data-td-action="reload"
                            class="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all">
                        <i class="fas fa-rotate"></i> به‌روزرسانی
                    </button>
                </div>
            </div>

            ${scopeBar}

            <!-- آمار کوتاه -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${this._stat('دریافت‌شده', c.new, 'fa-inbox', 'text-amber-300')}
                ${this._stat('در حال انجام', c.in_progress, 'fa-spinner', 'text-sky-300')}
                ${this._stat('آماده تحویل', c.ready, 'fa-gift', 'text-emerald-300')}
                ${this._stat('تحویل‌شده', c.completed, 'fa-circle-check', 'text-lime-300')}
            </div>

            <!-- فیلترها -->
            <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm space-y-3">
                <div class="flex gap-3 flex-wrap">
                    <input type="text" id="td-q" data-td-input="q" value="${this._esc(f.q)}"
                        placeholder="🔍 جستجو: نام، شمارهٔ دانشجویی، کد ۵ رقمی…"
                        class="flex-1 min-w-48 bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <select id="td-status" data-td-input="status" class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm">
                        ${this.STATUSES.map(s => this._opt(s[0], s[1], f.status === s[0])).join('')}
                    </select>
                    <select id="td-agent" data-td-input="agent" class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm">
                        ${this._opt('', 'همه نویسنده‌ها', f.agent === '')}
                        ${agents.map(a => this._opt(a.id, a.name, f.agent === a.id)).join('')}
                    </select>
                    <select id="td-source" data-td-input="source" class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm">
                        ${this._opt('', 'همه منابع', f.source === '')}
                        ${this._opt('mini_app', 'مینی‌اپ', f.source === 'mini_app')}
                        ${this._opt('telegram_bot', 'ربات (فوروارد)', f.source === 'telegram_bot')}
                        ${this._opt('manual', 'ثبت دستی', f.source === 'manual')}
                    </select>
                    <input type="date" id="td-from" data-td-input="from" value="${this._esc(f.from)}"
                        class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-3 py-2 text-sm" title="از تاریخ">
                    <input type="date" id="td-to" data-td-input="to" value="${this._esc(f.to)}"
                        class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-3 py-2 text-sm" title="تا تاریخ">
                    <button data-td-action="sort" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm flex items-center gap-1.5">
                        <i class="fas fa-sort-amount-${this._sortDesc ? 'down' : 'up'} text-xs"></i>
                        <span>${this._sortDesc ? 'جدیدترین' : 'قدیمی‌ترین'}</span>
                    </button>
                    <button data-td-action="clearFilters" class="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-eraser ml-1"></i>پاک‌کردن
                    </button>
                </div>
                <div class="flex flex-wrap gap-2">
                    <span class="text-gray-500 text-xs self-center font-medium">فیلتر سریع:</span>
                    ${this.QUICK.filter(q => !q[3] || (q[3] === 'manager' && this._isManager())).map(q => `
                        <button data-td-action="quick" data-td-value="${q[0]}"
                            class="text-xs px-3 py-1.5 rounded-full border transition-all ${f.quick === q[0]
                                ? 'bg-blue-100 border-blue-400 text-blue-700'
                                : 'border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-400'}">
                            <i class="fas ${q[2]} ml-1"></i>${q[1]}
                        </button>`).join('')}
                    <button data-td-action="quick" data-td-value=""
                        class="text-xs px-3 py-1.5 rounded-full border transition-all ${!f.quick
                            ? 'bg-blue-100 border-blue-400 text-blue-700'
                            : 'border-gray-300 text-gray-600 hover:bg-blue-50'}">
                        <i class="fas fa-list ml-1"></i>همه
                    </button>
                </div>
            </div>

            ${this._loading ? '<div class="text-center py-3 text-gray-400 text-sm"><i class="fas fa-spinner fa-spin ml-2"></i> در حال به‌روزرسانی…</div>' : ''}

            ${this._table(rows)}

            <datalist id="td-students-list">
                ${(this._students || []).map(s =>
                    `<option value="${this._esc(s.name)}${s.student_id ? ' — ' + this._esc(s.student_id) : ''}"></option>`
                ).join('')}
            </datalist>
        </div>`;

        this._afterRender();
    },

    _stat(label, value, icon, color) {
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

    _table(rows) {
        if (!rows.length) {
            return `
            <div class="bg-white rounded-xl border border-gray-200 py-14 text-center shadow-sm">
                <i class="fas fa-inbox text-4xl text-gray-300"></i>
                <p class="mt-4 text-gray-600 font-medium">تعدیلاتی با این فیلترها پیدا نشد</p>
            </div>`;
        }
        const body = rows.map((r, i) =>
            this._row(r, i) + (this._expanded[r.id] ? this._detailRow(r) : '')).join('');
        return `
        <div class="overflow-x-auto rounded-xl border border-gray-300 shadow-sm">
            <table class="w-full text-sm bg-white" style="min-width:1400px">
                <thead>
                    <tr class="bg-gray-100 text-gray-700 text-xs border-b border-gray-300">
                        <th class="px-3 py-3 text-center font-bold">ردیف</th>
                        <th class="px-3 py-3 text-center font-bold">کد</th>
                        <th class="px-3 py-3 text-right font-bold">نام دانشجو</th>
                        <th class="px-3 py-3 text-right font-bold">شمارهٔ دانشجویی</th>
                        <th class="px-3 py-3 text-right font-bold">نویسنده</th>
                        <th class="px-3 py-3 text-center font-bold">فایل‌ها</th>
                        <th class="px-3 py-3 text-center font-bold">🎤 ویس نام</th>
                        <th class="px-3 py-3 text-center font-bold">وضعیت</th>
                        <th class="px-3 py-3 text-right font-bold">منبع</th>
                        <th class="px-3 py-3 text-right font-bold">تاریخ ثبت</th>
                        <th class="px-3 py-3 text-right font-bold">زمان تحویل</th>
                        <th class="px-3 py-3 text-center font-bold">عملیات</th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        </div>
        <p class="text-gray-500 text-xs mt-2">${this._fa(rows.length)} رکورد</p>`;
    },

    _row(r, index) {
        const files = this._filesByRequest[r.id] || [];
        const voice = this._voiceFiles(r);
        const expanded = !!this._expanded[r.id];
        const me = this._me();
        const isMine = r.assigned_agent_id && me && r.assigned_agent_id === me.id;
        const canComplete = this.role === 'agent' && isMine && r.status === 'in_progress';

        const agentCell = r.assigned_agent_name
            ? `<div style="font-weight:700;color:#1f2937">${this._esc(r.assigned_agent_name)}</div>
               <div style="font-size:11px;color:#6b7280">${r.routed_by === 'auto' ? 'مسیریابی خودکار' : 'تخصیص دستی'}</div>`
            : `<span style="background:#ffe6ea;color:#a01235;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700">بدون نویسنده</span>`;

        const voiceCell = r.name_audio_path
            ? `<button data-td-action="playNameVoice" data-td-path="${this._esc(r.name_audio_path)}"
                       style="background:#efe8ff;color:#5b3fd1;border:none;font-size:11px;padding:4px 10px;border-radius:999px;font-weight:700;cursor:pointer">
                   <i class="fas fa-play ml-1"></i>پخش
               </button>`
            : '<span style="color:#9ca3af;font-size:11px">—</span>';

        const dueCell = r.due_at
            ? `<div style="font-size:12px;color:${new Date(r.due_at).getTime() < Date.now() ? '#b91c1c' : '#374151'};font-weight:600">${this._esc(this._when(r.due_at))}</div>`
            : '<span style="color:#9ca3af;font-size:11px">تعیین نشده</span>';

        return `
        <tr class="border-b border-gray-200 hover:bg-gray-50" style="${expanded ? 'background:#f9fafb' : ''}">
            <td class="px-3 py-3 text-center text-gray-500 text-xs">${this._fa(index + 1)}</td>
            <td class="px-3 py-3 text-center">
                <span style="font-family:ui-monospace,monospace;font-weight:800;font-size:13px;color:#2450c8;background:#e3edff;padding:3px 9px;border-radius:8px">
                    ${r.code ? this._fa(r.code) : '—'}
                </span>
            </td>
            <td class="px-3 py-3">
                <div style="font-weight:700;color:#1f2937">${this._esc(r.student_name || '—')}</div>
                ${r.telegram_username ? `<div style="font-size:11px;color:#6b7280">@${this._esc(r.telegram_username)}</div>` : ''}
            </td>
            <td class="px-3 py-3 text-gray-700 text-xs">${this._esc(r.student_no || '—')}</td>
            <td class="px-3 py-3">${agentCell}</td>
            <td class="px-3 py-3 text-center">
                <button data-td-action="toggle" data-td-id="${this._esc(r.id)}"
                        style="background:#f3f4f6;border:1px solid #d1d5db;font-size:11px;padding:4px 10px;border-radius:999px;font-weight:700;cursor:pointer;color:#374151">
                    <i class="fas fa-paperclip ml-1"></i>${this._fa(files.length)}
                    ${voice.length ? '<i class="fas fa-microphone" style="color:#7c3aed;margin-right:4px"></i>' : ''}
                </button>
            </td>
            <td class="px-3 py-3 text-center">${voiceCell}</td>
            <td class="px-3 py-3 text-center">${this._badge(r.status)}</td>
            <td class="px-3 py-3 text-xs text-gray-600">${this._esc(this._sourceLabel(r.source))}</td>
            <td class="px-3 py-3 text-xs text-gray-600">${this._esc(this._dateOnly(r.created_at))}</td>
            <td class="px-3 py-3">${dueCell}</td>
            <td class="px-3 py-3">
                <div class="flex gap-2 justify-center">
                    <button data-td-action="toggle" data-td-id="${this._esc(r.id)}"
                            class="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg">
                        <i class="fas ${expanded ? 'fa-chevron-up' : (this._isManager() && !r.assigned_agent_id ? 'fa-user-plus' : 'fa-eye')}"></i>
                    </button>
                    ${canComplete ? `
                    <button data-td-action="complete" data-td-id="${this._esc(r.id)}"
                            class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg">
                        <i class="fas fa-check"></i>
                    </button>` : ''}
                    ${this._isManager() ? `
                    <button data-td-action="delete" data-td-id="${this._esc(r.id)}"
                            class="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </div>
            </td>
        </tr>`;
    },

    _detailRow(r) {
        const files = this._filesByRequest[r.id] || [];
        const suggest = (!r.assigned_agent_id && this._isManager()) ? this._suggestWriter(r) : null;
        const agents = this._agents || [];

        const fileRows = files.length
            ? files.map(f => `
                <div style="display:flex;align-items:center;gap:8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:8px 12px;margin-bottom:6px">
                    <i class="fas ${f.kind === 'deliverable' ? 'fa-gift' : f.kind === 'photo' ? 'fa-image'
                        : (f.kind === 'voice' || f.kind === 'audio') ? 'fa-microphone' : 'fa-file-pdf'}"
                       style="color:${f.kind === 'deliverable' ? '#059669' : '#2450c8'}"></i>
                    <span style="flex:1;font-size:12px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                        ${this._esc(f.file_name || 'فایل')}
                        <span style="color:#9ca3af;font-size:11px"> · ${this._bytes(f.file_size)}</span>
                    </span>
                    ${(f.kind === 'voice' || f.kind === 'audio')
                        ? `<button data-td-action="playVoice" data-td-path="${this._esc(f.storage_path)}"
                                   class="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full border-0"><i class="fas fa-play ml-1"></i>پخش</button>`
                        : `<button data-td-action="openFile" data-td-path="${this._esc(f.storage_path)}" data-td-kind="${this._esc(f.kind)}"
                                   class="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full border-0"><i class="fas fa-up-right-from-square ml-1"></i>نمایش</button>`}
                </div>`).join('')
            : '<p style="font-size:12px;color:#9ca3af;margin:0">هنوز فایلی ثبت نشده است.</p>';

        const stageBtns = [
            ['started', 'شروع شد'],
            ['in_progress', 'در حال انجام'],
            ['ready', 'آماده تحویل'],
            ['completed', 'تحویل شد'],
        ].map(s => `
            <button data-td-action="stage" data-td-id="${this._esc(r.id)}" data-td-stage="${s[0]}"
                    class="bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs px-3 py-1.5 rounded-lg"
                    ${r.status === s[0] ? 'style="background:#e3edff;border-color:#93c5fd;color:#2450c8;font-weight:700"' : ''}>
                ${s[1]}
            </button>`).join('');

        return `
        <tr style="background:#f9fafb">
            <td colspan="12" class="px-4 py-4">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    <div>
                        <p style="font-size:13px;font-weight:800;color:#374151;margin:0 0 8px">
                            <i class="fas fa-paperclip ml-1"></i>فایل‌های ارسالی
                        </p>
                        ${fileRows}
                        ${r.note ? `<p style="font-size:12px;color:#4b5563;background:#fff8e8;border-radius:10px;padding:8px 12px;margin-top:8px">
                            <b>توضیح دانشجو:</b> ${this._esc(r.note)}</p>` : ''}
                    </div>

                    <div class="space-y-3">
                        ${suggest ? `
                        <div style="background:#ddf8ec;border:1px solid #6ee7b7;border-radius:12px;padding:10px 12px">
                            <p style="font-size:12.5px;color:#065f46;margin:0 0 8px;font-weight:700">
                                <i class="fas fa-lightbulb ml-1"></i>
                                نویسندهٔ همین دانشجو: <b>${this._esc(suggest.agent_name)}</b>
                                <span style="font-size:11px;opacity:.75">(از سفارش ${this._esc(String(suggest.order_id))})</span>
                            </p>
                            <button data-td-action="assignSuggested" data-td-id="${this._esc(r.id)}"
                                    data-td-agent="${this._esc(suggest.agent_id)}" data-td-name="${this._esc(suggest.agent_name)}"
                                    class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-bold">
                                <i class="fas fa-share ml-1"></i> ارجاع به همین نویسنده
                            </button>
                        </div>` : ''}

                        ${this._isManager() ? `
                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px">
                            <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:700">ارجاع به نویسنده</label>
                            <div class="flex gap-2">
                                <select id="td-agent-${this._esc(r.id)}"
                                        class="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                    <option value="">— انتخاب نویسنده —</option>
                                    ${agents.map(a => `<option value="${this._esc(a.id)}" ${r.assigned_agent_id === a.id ? 'selected' : ''}>${this._esc(a.name)}</option>`).join('')}
                                </select>
                                <button data-td-action="assignAgent" data-td-id="${this._esc(r.id)}"
                                        class="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg">ارجاع</button>
                            </div>
                        </div>

                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px">
                            <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:700">اتصال به پروفایل دانشجو</label>
                            <div class="flex gap-2">
                                <input list="td-students-list" id="td-student-${this._esc(r.id)}"
                                       placeholder="نام دانشجو را بنویسید…"
                                       class="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                <button data-td-action="linkStudent" data-td-id="${this._esc(r.id)}"
                                        class="bg-lime-600 hover:bg-lime-500 text-white text-xs px-4 py-2 rounded-lg">اتصال</button>
                            </div>
                        </div>` : ''}

                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px">
                            <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:700">مرحله را جلو ببر</label>
                            <div class="flex flex-wrap gap-2">${stageBtns}</div>
                        </div>

                        ${this._isManager() ? `
                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px">
                            <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:700">زمان تحویل (اعلام به دانشجو)</label>
                            <div class="flex gap-2">
                                <input type="datetime-local" id="td-due-${this._esc(r.id)}"
                                       value="${r.due_at ? new Date(r.due_at).toISOString().slice(0, 16) : ''}"
                                       class="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                <button data-td-action="setDue" data-td-id="${this._esc(r.id)}"
                                        class="bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs px-4 py-2 rounded-lg font-bold">ثبت</button>
                            </div>
                        </div>` : ''}

                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px">
                            <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:700">یادداشت نویسنده</label>
                            <div class="flex gap-2">
                                <input id="td-note-${this._esc(r.id)}" value="${this._esc(r.agent_note || '')}"
                                       placeholder="توضیح دربارهٔ انجام این تعدیلات…"
                                       class="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                <button data-td-action="saveNote" data-td-id="${this._esc(r.id)}"
                                        class="bg-gray-700 hover:bg-gray-600 text-white text-xs px-4 py-2 rounded-lg">ذخیره</button>
                            </div>
                        </div>

                        ${this.role === 'agent' && r.assigned_agent_id ? `
                        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px">
                            <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:700">آپلود فایل آمادهٔ تحویل</label>
                            <input type="file" id="td-deliv-${this._esc(r.id)}" multiple class="text-xs">
                            <button data-td-action="uploadDeliverable" data-td-id="${this._esc(r.id)}"
                                    class="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg">
                                <i class="fas fa-upload ml-1"></i>بارگذاری
                            </button>
                        </div>` : ''}

                        <p style="font-size:11px;color:#9ca3af;margin:0">
                            کد پیگیری داخلی: <span style="font-family:monospace">${this._esc(r.id)}</span>
                        </p>
                    </div>
                </div>
            </td>
        </tr>`;
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
                               btn.getAttribute('data-td-id'), btn, ev);
            });
            root.addEventListener('input', (ev) => {
                const el = ev.target.closest('[data-td-input]');
                if (!el) return;
                if (el.getAttribute('data-td-input') !== 'q') return;
                this._f.q = el.value;
                clearTimeout(this._searchTimer);
                this._searchTimer = setTimeout(() => {
                    const pos = el.selectionStart;
                    this.render();
                    const again = document.getElementById('td-q');
                    if (again) { again.focus(); if (pos != null) again.setSelectionRange(pos, pos); }
                }, 320);
            });
            root.addEventListener('change', (ev) => {
                const el = ev.target.closest('[data-td-input]');
                if (!el) return;
                const key = el.getAttribute('data-td-input');
                if (key === 'q') return;
                this._f[key] = el.value;
                this.render();
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
        if (action === 'sort') { this._sortDesc = !this._sortDesc; return this.render(); }
        if (action === 'clearFilters') {
            this._f = { q: '', status: '', agent: '', source: '', from: '', to: '', quick: '' };
            return this.render();
        }
        if (action === 'quick') {
            const v = btn.getAttribute('data-td-value') || '';
            this._f.quick = (this._f.quick === v) ? '' : v;
            return this.render();
        }
        if (action === 'scope') {
            this._scope = btn.getAttribute('data-td-value') || 'all';
            return this.render();
        }
        if (action === 'toggle') {
            this._expanded[id] = !this._expanded[id];
            return this.render();
        }
        if (action === 'openAdd') return this.openAddModal();
        if (action === 'openFile') return this._preview(btn.getAttribute('data-td-path'));
        if (action === 'playNameVoice' || action === 'playVoice') {
            return this._play(btn.getAttribute('data-td-path'));
        }
        if (action === 'complete') {
            const ok = await this._update(id, {
                status: 'completed', completed_at: new Date().toISOString(),
            }, 'تحویل ثبت شد');
            return ok && this.load(true);
        }
        if (action === 'stage') {
            const stage = btn.getAttribute('data-td-stage');
            const patch = { status: stage };
            const now = new Date().toISOString();
            if (stage === 'started') patch.started_at = now;
            if (stage === 'ready') patch.ready_at = now;
            if (stage === 'completed') patch.completed_at = now;
            const ok = await this._update(id, patch, 'وضعیت به‌روز شد');
            return ok && this.load(true);
        }
        if (action === 'setDue') {
            const el = document.getElementById('td-due-' + id);
            const v = el ? el.value : '';
            if (!v) { UTILS.showNotification('زمان تحویل را انتخاب کنید', 'warning'); return; }
            const ok = await this._update(id, { due_at: new Date(v).toISOString() },
                                          'زمان تحویل ثبت شد');
            return ok && this.load(true);
        }
        if (action === 'saveNote') {
            const el = document.getElementById('td-note-' + id);
            const ok = await this._update(id, { agent_note: el ? el.value.trim() : '' },
                                          'یادداشت ذخیره شد');
            return ok && this.load(true);
        }
        if (action === 'assignSuggested') {
            const agentId = btn.getAttribute('data-td-agent');
            const agentName = btn.getAttribute('data-td-name') || '';
            const ok = await this._update(id, {
                assigned_agent_id: agentId, assigned_agent_name: agentName,
                status: 'in_progress', routed_at: new Date().toISOString(),
                routed_by: 'manual', routed_note: 'تخصیص توسط کارمند (پیشنهاد مسیریاب)',
            }, 'به نویسنده «' + agentName + '» سپرده شد');
            return ok && this.load(true);
        }
        if (action === 'assignAgent') {
            const sel = document.getElementById('td-agent-' + id);
            const agentId = sel ? sel.value : '';
            if (!agentId) { UTILS.showNotification('ابتدا یک نویسنده انتخاب کنید', 'warning'); return; }
            const agent = (this._agents || []).find(a => a.id === agentId);
            const ok = await this._update(id, {
                assigned_agent_id: agentId, assigned_agent_name: agent ? agent.name : '',
                status: 'in_progress', routed_at: new Date().toISOString(),
                routed_by: 'manual', routed_note: 'تخصیص دستی توسط کارمند',
            }, 'به نویسنده ارجاع شد');
            return ok && this.load(true);
        }
        if (action === 'linkStudent') return this._linkStudent(id);
        if (action === 'uploadDeliverable') return this._uploadDeliverable(id);
        if (action === 'delete') return this._delete(id);
    },

    _play(path) {
        if (!path) return;
        this._signedUrl(path).then(url => {
            if (!url) { UTILS.showNotification('پخش ممکن نشد', 'error'); return; }
            try {
                if (this._playing) { this._playing.pause(); this._playing = null; }
                const a = new Audio(url);
                this._playing = a;
                a.play().catch(() => window.open(url, '_blank'));
            } catch (e) { window.open(url, '_blank'); }
        });
    },

    _preview(path) {
        this._signedUrl(path).then(url => {
            if (!url) { UTILS.showNotification('نمایش فایل ممکن نشد', 'error'); return; }
            window.open(url, '_blank');
        });
    },

    async _uploadDeliverable(id) {
        const el = document.getElementById('td-deliv-' + id);
        if (!el || !el.files || !el.files.length) {
            UTILS.showNotification('اول فایل را انتخاب کنید', 'warning'); return;
        }
        const sb = this._sb();
        const me = this._me();
        try {
            for (const f of Array.from(el.files)) {
                const safe = (typeof UTILS !== 'undefined' && UTILS.safeStorageKey)
                    ? UTILS.safeStorageKey(f.name) : f.name.replace(/[^\w.\-]/g, '_');
                const path = `tadilat/${me.id || 'staff'}/${id}/${Date.now()}_${safe}`;
                const up = await sb.storage.from(this.BUCKET).upload(path, f, { upsert: true });
                if (up.error) throw up.error;
                await sb.from('tadilat_files').insert([{
                    request_id: id, kind: 'deliverable', file_name: f.name,
                    storage_path: path, mime_type: f.type || null, file_size: f.size,
                }]);
            }
            UTILS.showNotification('فایل آمادهٔ تحویل بارگذاری شد ✓', 'success');
            this.load(true);
        } catch (e) {
            UTILS.showNotification('بارگذاری ناموفق: ' + (e.message || e), 'error');
        }
    },

    async _linkStudent(requestId) {
        const input = document.getElementById('td-student-' + requestId);
        const raw = input ? input.value.trim() : '';
        if (!raw) { UTILS.showNotification('نام دانشجو را وارد کنید', 'warning'); return; }
        const students = await this._loadStudents();
        const [namePart, noPart] = raw.split('—').map(s => s.trim());
        let match = students.find(s => s.student_id && noPart && s.student_id === noPart);
        if (!match) {
            match = students.find(s => this._normKey(s.name) === this._normKey(namePart));
            if (!match) {
                const key = this._normKey(namePart);
                const cands = students.filter(s => this._normKey(s.name).indexOf(key) !== -1);
                if (cands.length === 1) match = cands[0];
                else if (cands.length > 1) {
                    UTILS.showNotification('چند دانشجو با این نام پیدا شد — دقیق‌تر بنویسید', 'warning');
                    return;
                }
            }
        }
        if (!match) { UTILS.showNotification('دانشجویی با این مشخصات پیدا نشد', 'warning'); return; }
        const ok = await this._update(requestId, {
            student_id: match.id, student_no: match.student_id || null,
        }, 'به پروفایل «' + match.name + '» متصل شد');
        return ok && this.load(true);
    },

    async _delete(id) {
        if (!window.confirm('این رکورد تعدیلات حذف شود؟ فایل‌ها هم حذف می‌شوند.')) return;
        const sb = this._sb();
        try {
            const files = this._filesByRequest[id] || [];
            for (const f of files) {
                if (f.storage_path) {
                    try { await sb.storage.from(this.BUCKET).remove([f.storage_path]); } catch (e) {}
                }
            }
            const { error } = await sb.from('tadilat_requests').delete().eq('id', id);
            if (error) throw error;
            UTILS.showNotification('رکورد حذف شد', 'success');
            this.load(true);
        } catch (e) {
            UTILS.showNotification('حذف ناموفق: ' + (e.message || e), 'error');
        }
    },

    async _update(id, patch, okMessage) {
        const sb = this._sb();
        if (!sb) { UTILS.showNotification('اتصال برقرار نیست', 'error'); return false; }
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

    // ══════════════════════════════════════════════════════════
    // «تعدیل جدید» — ثبت دستی
    // ══════════════════════════════════════════════════════════
    async openAddModal() {
        const agents = await this._loadAgents();
        await this._loadStudents();
        const me = this._me();
        const old = document.getElementById('td-add-modal');
        if (old) old.remove();

        const wrap = document.createElement('div');
        wrap.id = 'td-add-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,.75);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl';
        wrap.innerHTML = `
            <div style="background:#fff;border-radius:18px;max-width:640px;width:100%;max-height:90vh;overflow-y:auto;padding:22px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                    <h3 style="margin:0;font-size:18px;font-weight:800;color:#111827">
                        <i class="fas fa-plus-circle" style="color:#65a30d;margin-left:6px"></i>تعدیل جدید
                    </h3>
                    <button id="td-add-close" style="background:#f3f4f6;border:none;width:34px;height:34px;border-radius:10px;font-size:16px;cursor:pointer">✕</button>
                </div>

                <label style="display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:6px">نام دانشجو *</label>
                <input id="td-add-student" list="td-students-list" placeholder="نام و نام خانوادگی دانشجو…"
                       style="width:100%;padding:11px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:14px;margin-bottom:12px">
                <datalist id="td-students-list">
                    ${(this._students || []).map(s =>
                        `<option value="${this._esc(s.name)}${s.student_id ? ' — ' + this._esc(s.student_id) : ''}"></option>`
                    ).join('')}
                </datalist>

                <label style="display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:6px">نویسنده (اختیاری)</label>
                <select id="td-add-agent" style="width:100%;padding:11px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:14px;margin-bottom:12px">
                    <option value="">— بدون نویسنده (استخر عمومی) —</option>
                    ${agents.map(a => `<option value="${this._esc(a.id)}">${this._esc(a.name)}</option>`).join('')}
                </select>

                <label style="display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:6px">توضیحات</label>
                <textarea id="td-add-note" rows="3" placeholder="توضیح تعدیلات…"
                          style="width:100%;padding:11px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:14px;margin-bottom:12px"></textarea>

                <label style="display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:6px">فایل‌ها (اختیاری)</label>
                <input id="td-add-files" type="file" multiple style="font-size:13px;margin-bottom:16px">

                <div id="td-add-msg" style="font-size:13px;margin-bottom:12px"></div>

                <div style="display:flex;gap:10px;justify-content:flex-end">
                    <button id="td-add-cancel" style="background:#f3f4f6;border:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">انصراف</button>
                    <button id="td-add-save" style="background:#65a30d;border:none;color:#fff;padding:11px 24px;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer">
                        <i class="fas fa-save" style="margin-left:6px"></i>ثبت تعدیل
                    </button>
                </div>
                <p style="font-size:11px;color:#9ca3af;margin:12px 0 0">
                    ثبت‌کننده: ${this._esc(me.name || me.username || '—')}
                </p>
            </div>`;
        document.body.appendChild(wrap);

        const close = () => wrap.remove();
        wrap.querySelector('#td-add-close').onclick = close;
        wrap.querySelector('#td-add-cancel').onclick = close;
        wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
        wrap.querySelector('#td-add-save').onclick = () => this._submitAdd(wrap, close);
    },

    async _submitAdd(wrap, close) {
        const sb = this._sb();
        const me = this._me();
        const msg = wrap.querySelector('#td-add-msg');
        const saveBtn = wrap.querySelector('#td-add-save');
        const rawName = wrap.querySelector('#td-add-student').value.trim();
        const agentId = wrap.querySelector('#td-add-agent').value;
        const note = wrap.querySelector('#td-add-note').value.trim();
        const fileInput = wrap.querySelector('#td-add-files');

        if (!rawName) {
            msg.innerHTML = '<span style="color:#b91c1c">نام دانشجو الزامی است.</span>';
            return;
        }
        saveBtn.disabled = true;
        msg.innerHTML = '<span style="color:#6b7280">در حال ثبت…</span>';

        try {
            const students = await this._loadStudents();
            const [namePart, noPart] = rawName.split('—').map(s => s.trim());
            let hit = students.find(s => s.student_id && noPart && s.student_id === noPart);
            if (!hit) hit = students.find(s => this._normKey(s.name) === this._normKey(namePart));
            if (!hit) {
                const key = this._normKey(namePart);
                const cands = students.filter(s => this._normKey(s.name).indexOf(key) !== -1);
                if (cands.length === 1) hit = cands[0];
            }
            const studentName = hit ? hit.name : namePart;
            let agent = null;
            if (agentId) agent = (this._agents || []).find(a => a.id === agentId);
            if (!agent && hit) {
                const sug = this._suggestWriter({ student_name: studentName, student_id: hit.id });
                if (sug) agent = { id: sug.agent_id, name: sug.agent_name };
            }

            const { data, error } = await sb.from('tadilat_requests').insert([{
                source: 'manual',
                student_id: hit ? hit.id : null,
                student_name: studentName,
                student_no: hit ? (hit.student_id || null) : (noPart || null),
                name_source: 'text',
                note: note || null,
                status: agent ? 'in_progress' : 'new',
                assigned_agent_id: agent ? agent.id : null,
                assigned_agent_name: agent ? agent.name : null,
                routed_at: agent ? new Date().toISOString() : null,
                routed_by: agent ? 'manual' : null,
                routed_note: agent ? 'ثبت دستی توسط کارمند' : null,
                created_by: me.id || null,
                created_by_name: me.name || me.username || null,
            }]).select();

            if (error) throw error;
            const req = data && data[0];
            if (!req) throw new Error('رکورد ساخته نشد');

            const files = fileInput.files ? Array.from(fileInput.files) : [];
            let count = 0;
            let firstPath = null, firstFile = null;
            for (const f of files) {
                const safe = (typeof UTILS !== 'undefined' && UTILS.safeStorageKey)
                    ? UTILS.safeStorageKey(f.name) : f.name.replace(/[^\w.\-]/g, '_');
                const path = `tadilat/${me.id || 'staff'}/${req.id}/${Date.now()}_${safe}`;
                const up = await sb.storage.from(this.BUCKET).upload(path, f, { upsert: true });
                if (up.error) throw up.error;
                const kind = (f.type || '').indexOf('image/') === 0 ? 'photo'
                    : (f.type || '').indexOf('audio/') === 0 ? 'audio' : 'document';
                await sb.from('tadilat_files').insert([{
                    request_id: req.id, kind, file_name: f.name, storage_path: path,
                    mime_type: f.type || null, file_size: f.size,
                }]);
                if (!firstPath) { firstPath = path; firstFile = f; }
                count++;
            }
            if (count) {
                await sb.from('tadilat_requests').update({ files_count: count }).eq('id', req.id);
            }

            // فایل اول در پروفایل دانشجو (بخش «فایل ها» → «تعدیل شده»)
            if (hit && firstPath) {
                try {
                    await sb.from('student_files').upsert([{
                        student_id: hit.id, category: 'تعدیل شده',
                        file_name: firstFile.name, file_path: firstPath,
                        file_type: (firstFile.name.split('.').pop() || '').toLowerCase(),
                        uploaded_by: me.id || 'staff',
                        uploaded_by_name: me.name || me.username || null,
                    }], { onConflict: 'student_id,category' });
                } catch (e) { console.warn('student_files (manual):', e); }
            }

            UTILS.showNotification(
                'تعدیل جدید ثبت شد ✓' + (req.code ? ' — کد ' + req.code : ''), 'success');
            close();
            this.load(true);
        } catch (e) {
            console.error('_submitAdd:', e);
            msg.innerHTML = '<span style="color:#b91c1c">ثبت ناموفق: ' + this._esc(e.message || String(e)) + '</span>';
            saveBtn.disabled = false;
        }
    },
};

window.TadilatModule = TadilatModule;
console.log('📦 tadilat.js بارگذاری شد');
