/**
 * RegistrationsModule — مدیریت ثبت‌نام‌های دریافت‌شده از فرم registration.html
 * داده‌ها از Supabase (student_registrations) + localStorage['registrations_data'] خوانده می‌شوند
 */
const RegistrationsModule = {

    STORAGE_KEY: 'registrations_data',

    STATUS_LIST: [
        { key: 'new',        label: 'سفارش ثبت‌نام',   color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
        { key: 'result',     label: 'اعلام نتیجه',      color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
        { key: 'registered', label: 'ثبت‌نام دانشگاه', color: 'bg-green-500/20 text-green-300 border-green-500/40' },
        { key: 'cancelled',  label: 'انصراف',            color: 'bg-red-500/20 text-red-300 border-red-500/40' },
    ],

    STEPS: [
        { key: 'step1',  label: 'ثبت‌نام اولیه' },
        { key: 'step2',  label: 'قبول اولی' },
        { key: 'step3',  label: 'کد ادب + لینک سایت کد ادب' },
        { key: 'step4',  label: 'مصاحبه' },
        { key: 'step5',  label: 'پرداخت قسط اول' },
        { key: 'step6',  label: 'هزینه کورس لغت' },
        { key: 'step7',  label: 'ثبت‌نام کورس لغت' },
        { key: 'step8',  label: 'شماره دانشجویی' },
        { key: 'step9',  label: 'کارت دانشجویی' },
        { key: 'step10', label: 'مباشره' },
        { key: 'step11', label: 'قبول نهایی' },
        { key: 'step12', label: 'تحویل مدارک سابقه به دانشگاه' },
    ],

    /* ─────────────────── Data helpers ─────────────────── */
    getAll() {
        this._syncFromSupabase();
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        } catch { return []; }
    },

    _syncFromSupabase() {
        if (this._syncing) return;
        const sb = typeof SupabaseDataModule !== 'undefined' ? SupabaseDataModule : null;
        if (!sb || typeof sb.getRegistrations !== 'function') return;
        const now = Date.now();
        if (this._lastSync && now - this._lastSync < 30000) return;
        this._lastSync = now;
        this._syncing  = true;

        sb.getRegistrations().then(rows => {
            this._syncing = false;
            if (!rows || rows.length === 0) return;

            const local = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');

            rows.forEach(r => {
                const mapped = this._mapSupabaseRow(r);
                const idx = local.findIndex(l => l.id === mapped.id);
                if (idx === -1) {
                    local.push(mapped);
                } else {
                    // فیلدهای Supabase که در local کامل نیستند رو merge کن
                    // ولی status و steps محلی را حفظ کن
                    const preserved = {
                        status:              local[idx].status,
                        updatedAt:           local[idx].updatedAt,
                        referrer:            local[idx].referrer,
                        agent:               local[idx].agent,
                        agent_share:         local[idx].agent_share,
                        agent_share_confirmed: local[idx].agent_share_confirmed,
                        final_price:         local[idx].final_price,
                        paid:                local[idx].paid,
                        notes:               local[idx].notes,
                    };
                    // step keys
                    this.STEPS.forEach(s => {
                        if (local[idx][s.key] !== undefined) preserved[s.key] = local[idx][s.key];
                    });
                    local[idx] = Object.assign({}, mapped, preserved);
                }
            });

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(local));
            const el = document.getElementById('registrations-list');
            if (el) this.renderList();
        }).catch(e => { this._syncing = false; console.warn('registrations sync:', e.message); });
    },

    /** تبدیل رکورد Supabase به فرمت محلی — همه فیلدها */
    _mapSupabaseRow(r) {
        return {
            id:                     r.registration_id || String(r.id),
            db_id:                  r.id,
            registration_id:        r.registration_id,
            // شخصی
            middle_name:            r.middle_name        || '',
            last_name:              r.last_name          || '',
            religion:               r.religion           || '',
            phone:                  r.phone              || '',
            email:                  r.email              || '',
            address_iraq:           r.address_iraq       || '',
            job:                    r.job                || '',
            marital_status:         r.marital_status     || '',
            children_count:         r.children_count     ?? null,
            // دانشگاهی
            university_type:        r.university_type    || '',
            degree:                 r.degree             || '',
            major:                  r.major              || '',
            previous_university:    r.previous_university || '',
            master_university:      r.master_university  || '',
            bachelor_gpa:           r.bachelor_gpa       || '',
            master_gpa:             r.master_gpa         || '',
            // فایل‌ها
            passport_url:           r.passport_url           || '',
            personal_photo_url:     r.personal_photo_url     || '',
            transcript_url:         r.transcript_url         || '',
            master_transcript_url:  r.master_transcript_url  || '',
            master_certificate_url: r.master_certificate_url || '',
            // وضعیت
            status:    r.status || 'new',
            createdAt: r.created_at || r.createdAt || '',
        };
    },

    save(list) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    },

    getById(id) {
        return this.getAll().find(r => r.id === id);
    },

    updateField(id, field, value) {
        const all = this.getAll();
        const idx = all.findIndex(r => r.id === id);
        if (idx === -1) return;
        all[idx][field]    = value;
        all[idx].updatedAt = new Date().toISOString();
        this.save(all);
    },

    getStatusInfo(key) {
        return this.STATUS_LIST.find(s => s.key === key) || this.STATUS_LIST[0];
    },

    /* ─────────────────── Main page content ─────────────────── */
    getContent() {
        const all = this.getAll();

        const counts = {};
        this.STATUS_LIST.forEach(s => counts[s.key] = 0);
        all.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

        return `
        <div class="space-y-6" id="registrations-root">
            <!-- Header -->
            <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                    <i class="fas fa-user-plus text-lime-400"></i>
                    ثبت‌نام‌ها
                </h2>
                <div class="flex gap-2 flex-wrap">
                    <input type="text" id="reg-search" placeholder="جستجو نام، شماره یا ایمیل..."
                           oninput="RegistrationsModule.renderList()"
                           class="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm w-52 focus:outline-none focus:border-lime-500 placeholder-gray-500">
                    <button onclick="RegistrationsModule.forceSync()"
                            class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs flex items-center gap-1">
                        <i class="fas fa-sync-alt"></i> بروزرسانی
                    </button>
                    <button onclick="RegistrationsModule.addSampleData()"
                            class="bg-slate-600 hover:bg-slate-500 text-gray-300 px-3 py-2 rounded-lg text-xs">
                        <i class="fas fa-database ml-1"></i>داده نمونه
                    </button>
                </div>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                ${this.STATUS_LIST.map(s => `
                <div class="rounded-xl p-3 text-center border ${s.color} cursor-pointer hover:opacity-80 transition-opacity"
                     onclick="RegistrationsModule.filterByStatus('${s.key}')">
                    <p class="text-2xl font-bold">${counts[s.key]}</p>
                    <p class="text-xs mt-0.5">${s.label}</p>
                </div>`).join('')}
            </div>

            <!-- Filter tabs -->
            <div class="flex gap-2 flex-wrap">
                <button id="reg-filter-all"
                        onclick="RegistrationsModule.filterByStatus('all')"
                        class="px-4 py-1.5 rounded-lg text-sm font-medium bg-lime-600 text-gray-900">
                    همه (${all.length})
                </button>
                ${this.STATUS_LIST.map(s => `
                <button id="reg-filter-${s.key}"
                        onclick="RegistrationsModule.filterByStatus('${s.key}')"
                        class="px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-700 text-gray-300 hover:bg-slate-600">
                    ${s.label}
                </button>`).join('')}
            </div>

            <!-- List -->
            <div id="registrations-list" class="space-y-3">
                ${this._renderRows(all)}
            </div>
        </div>

        <!-- Detail Modal -->
        <div id="reg-detail-modal" class="hidden fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
             onclick="if(event.target===this) RegistrationsModule.closeDetail()">
            <div class="bg-slate-800 rounded-2xl w-full max-w-3xl border border-slate-600 shadow-2xl max-h-[92vh] overflow-y-auto"
                 id="reg-detail-inner"></div>
        </div>`;
    },

    /* ─────────── بروزرسانی دستی از Supabase ─────────── */
    forceSync() {
        this._lastSync = null;
        this._syncing  = false;
        this._syncFromSupabase();
        if (typeof UTILS !== 'undefined') UTILS.showNotification('در حال دریافت اطلاعات از سرور...', 'info');
    },

    /* ─────────── Filter ─────────── */
    _currentFilter: 'all',

    filterByStatus(status) {
        this._currentFilter = status;
        ['all', ...this.STATUS_LIST.map(s => s.key)].forEach(k => {
            const btn = document.getElementById('reg-filter-' + k);
            if (!btn) return;
            btn.className = k === status
                ? 'px-4 py-1.5 rounded-lg text-sm font-medium bg-lime-600 text-gray-900'
                : 'px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-700 text-gray-300 hover:bg-slate-600';
        });
        this.renderList();
    },

    renderList() {
        const search = (document.getElementById('reg-search')?.value || '').trim().toLowerCase();
        let list = this.getAll();
        if (this._currentFilter !== 'all') list = list.filter(r => r.status === this._currentFilter);
        if (search) list = list.filter(r =>
            (r.middle_name || '').toLowerCase().includes(search) ||
            (r.last_name   || '').toLowerCase().includes(search) ||
            (r.phone       || '').includes(search) ||
            (r.email       || '').toLowerCase().includes(search) ||
            (r.major       || '').toLowerCase().includes(search)
        );
        const el = document.getElementById('registrations-list');
        if (el) el.innerHTML = this._renderRows(list);
    },

    /* ─────────── Row cards ─────────── */
    _renderRows(list) {
        if (list.length === 0) return `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-inbox text-4xl mb-3 block"></i>
                <p>هیچ ثبت‌نامی یافت نشد</p>
            </div>`;

        return list.map(r => {
            const st = this.getStatusInfo(r.status || 'new');
            const completedSteps = this.STEPS.filter(s => r[s.key]).length;
            const progress = Math.round((completedSteps / this.STEPS.length) * 100);
            const isPhD = r.degree === 'phd';

            // نشانگر فایل‌ها
            const fileCount = [
                r.passport_url, r.personal_photo_url, r.transcript_url,
                r.master_transcript_url, r.master_certificate_url
            ].filter(Boolean).length;

            return `
            <div class="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-500 transition-all cursor-pointer"
                 onclick="RegistrationsModule.openDetail('${r.id}')">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap mb-1">
                            <span class="font-semibold text-white">${r.middle_name || ''} ${r.last_name || ''}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full border ${st.color}">${st.label}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full border ${isPhD ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40'}">
                                ${isPhD ? 'دکتری' : 'ارشد'}
                            </span>
                            ${r.university_type ? `<span class="text-xs px-2 py-0.5 rounded-full bg-slate-600/60 text-gray-300">${r.university_type}</span>` : ''}
                        </div>
                        <div class="flex items-center gap-4 text-xs text-gray-400 flex-wrap mb-1">
                            <span><i class="fas fa-phone ml-1 text-lime-400"></i>${r.phone || '—'}</span>
                            <span><i class="fas fa-envelope ml-1 text-blue-400"></i>${r.email || '—'}</span>
                            <span><i class="fas fa-graduation-cap ml-1 text-yellow-400"></i>${r.major || '—'}</span>
                        </div>
                        <div class="flex items-center gap-4 text-xs text-gray-500 flex-wrap mb-2">
                            <span><i class="fas fa-map-marker-alt ml-1"></i>${r.address_iraq || '—'}</span>
                            <span><i class="fas fa-briefcase ml-1"></i>${r.job || '—'}</span>
                            ${r.religion ? `<span><i class="fas fa-star-and-crescent ml-1"></i>${r.religion}</span>` : ''}
                            ${fileCount > 0 ? `<span class="text-lime-500"><i class="fas fa-paperclip ml-1"></i>${fileCount} فایل</span>` : ''}
                        </div>
                        <!-- Progress bar -->
                        <div class="flex items-center gap-2">
                            <div class="flex-1 bg-slate-600 rounded-full h-1.5">
                                <div class="bg-lime-500 h-1.5 rounded-full transition-all" style="width:${progress}%"></div>
                            </div>
                            <span class="text-xs text-gray-400 whitespace-nowrap">${completedSteps}/${this.STEPS.length} مرحله</span>
                        </div>
                    </div>
                    <div class="flex-shrink-0 text-xs text-gray-500 text-left">
                        ${r.createdAt ? new Date(r.createdAt).toLocaleDateString('fa-IR') : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    /* ─────────── Detail Modal ─────────── */
    closeDetail() {
        document.getElementById('reg-detail-modal')?.classList.add('hidden');
    },

    openDetail(id) {
        const r = this.getById(id);
        if (!r) return;

        const st    = this.getStatusInfo(r.status || 'new');
        const isPhD = r.degree === 'phd';

        const stepsHTML = this.STEPS.map(s => `
            <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 cursor-pointer">
                <input type="checkbox" ${r[s.key] ? 'checked' : ''}
                       onchange="RegistrationsModule.toggleStep('${id}','${s.key}',this.checked)"
                       class="w-4 h-4 accent-lime-500">
                <span class="text-sm ${r[s.key] ? 'line-through text-gray-500' : 'text-gray-200'}">${s.label}</span>
            </label>`).join('');

        const statusOptionsHTML = this.STATUS_LIST.map(s =>
            `<option value="${s.key}" ${(r.status || 'new') === s.key ? 'selected' : ''}>${s.label}</option>`
        ).join('');

        // ─── فیلدهای اطلاعات کامل ───
        const infoFields = [
            { label: 'تلفن',              val: r.phone,               icon: 'fa-phone',          color: 'text-lime-400' },
            { label: 'ایمیل',             val: r.email,               icon: 'fa-envelope',       color: 'text-blue-400' },
            { label: 'دین',               val: r.religion,            icon: 'fa-star-and-crescent', color: 'text-yellow-400' },
            { label: 'تخصص',              val: r.major,               icon: 'fa-graduation-cap', color: 'text-yellow-400' },
            { label: 'مقطع',              val: isPhD ? 'دکتری' : 'ارشد', icon: 'fa-user-graduate', color: 'text-purple-400' },
            { label: 'نوع دانشگاه',       val: r.university_type,     icon: 'fa-university',     color: 'text-cyan-400' },
            { label: 'آدرس عراق',         val: r.address_iraq,        icon: 'fa-map-marker-alt', color: 'text-red-400' },
            { label: 'شغل',               val: r.job,                 icon: 'fa-briefcase',      color: 'text-orange-400' },
            { label: 'وضعیت تأهل',        val: r.marital_status,      icon: 'fa-heart',          color: 'text-pink-400' },
            { label: 'تعداد فرزند',       val: r.children_count != null ? String(r.children_count) : '', icon: 'fa-baby', color: 'text-pink-300' },
            { label: 'دانشگاه بکالوریوس', val: r.previous_university, icon: 'fa-school',         color: 'text-green-400' },
            { label: 'معدل بکالوریوس',    val: r.bachelor_gpa,        icon: 'fa-chart-bar',      color: 'text-green-400' },
            ...(isPhD ? [
                { label: 'دانشگاه ارشد',  val: r.master_university,   icon: 'fa-school',         color: 'text-indigo-400' },
                { label: 'معدل ارشد',     val: r.master_gpa,          icon: 'fa-chart-bar',      color: 'text-indigo-400' },
            ] : []),
        ];

        const infoHTML = infoFields
            .filter(f => f.val)
            .map(f => `
                <div class="bg-slate-600/40 rounded-lg p-3">
                    <p class="text-xs text-gray-400 mb-1"><i class="fas ${f.icon} ml-1 ${f.color}"></i>${f.label}</p>
                    <p class="text-white font-medium text-sm break-all">${f.val}</p>
                </div>`).join('');

        // ─── فایل‌ها ───
        const fileFields = [
            { label: 'جواز السفر',          url: r.passport_url,           icon: 'fa-passport' },
            { label: 'صورة الشخصية',        url: r.personal_photo_url,     icon: 'fa-user-circle' },
            { label: 'كشف البكالوريوس',     url: r.transcript_url,         icon: 'fa-file-alt' },
            { label: 'كشف الماجستير',       url: r.master_transcript_url,  icon: 'fa-file-alt' },
            { label: 'وثيقة الماجستير',     url: r.master_certificate_url, icon: 'fa-certificate' },
        ].filter(f => f.url);

        const filesHTML = fileFields.length > 0 ? `
            <div class="bg-slate-700 rounded-xl p-4">
                <h4 class="text-white font-semibold mb-3 flex items-center gap-2">
                    <i class="fas fa-paperclip text-lime-400"></i>
                    مستندات آپلود شده
                </h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${fileFields.map(f => `
                    <button type="button"
                            onclick="RegistrationsModule.openFile('${f.url}')"
                            class="flex items-center gap-3 bg-slate-600 hover:bg-slate-500 rounded-lg px-3 py-2.5 text-sm text-white transition-colors text-right">
                        <i class="fas ${f.icon} text-lime-400 text-base flex-shrink-0"></i>
                        <span class="flex-1 truncate">${f.label}</span>
                        <i class="fas fa-external-link-alt text-xs text-gray-400"></i>
                    </button>`).join('')}
                </div>
            </div>` : `
            <div class="bg-slate-700/50 rounded-xl p-4 text-center text-gray-500 text-sm">
                <i class="fas fa-folder-open text-2xl mb-2 block"></i>
                فایلی آپلود نشده
            </div>`;

        document.getElementById('reg-detail-inner').innerHTML = `
            <div class="p-6 space-y-5" dir="rtl">
                <!-- Header -->
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h3 class="text-xl font-bold text-white">${r.middle_name || ''} ${r.last_name || ''}</h3>
                        <div class="flex gap-2 mt-1 flex-wrap">
                            <span class="text-xs px-2 py-0.5 rounded-full border ${st.color}">${st.label}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full border ${isPhD ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40'}">
                                ${isPhD ? 'دکتری' : 'ارشد'}
                            </span>
                            ${r.registration_id ? `<span class="text-xs text-gray-500 font-mono">${r.registration_id}</span>` : ''}
                        </div>
                    </div>
                    <button onclick="RegistrationsModule.closeDetail()"
                            class="text-gray-400 hover:text-white text-xl flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- وضعیت -->
                <div class="bg-slate-700 rounded-xl p-4">
                    <label class="block text-sm text-gray-400 mb-2">وضعیت دانشجو</label>
                    <select onchange="RegistrationsModule.changeStatus('${id}',this.value)"
                            class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-lime-500">
                        ${statusOptionsHTML}
                    </select>
                </div>

                <!-- اطلاعات کامل -->
                <div class="bg-slate-700 rounded-xl p-4">
                    <h4 class="text-white font-semibold mb-3 flex items-center gap-2">
                        <i class="fas fa-id-card text-blue-400"></i>
                        اطلاعات ثبت‌نام
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${infoHTML || '<p class="text-gray-500 text-sm col-span-2">اطلاعاتی موجود نیست</p>'}
                    </div>
                </div>

                <!-- مستندات -->
                ${filesHTML}

                <!-- مراحل پیگیری -->
                <div class="bg-slate-700 rounded-xl p-4">
                    <h4 class="text-white font-semibold mb-3 flex items-center gap-2">
                        <i class="fas fa-list-check text-lime-400"></i>
                        مراحل پیگیری
                    </h4>
                    <div class="space-y-1">${stepsHTML}</div>
                </div>

                <!-- فیلدهای اضافی -->
                <div class="bg-slate-700 rounded-xl p-4 space-y-3">
                    <h4 class="text-white font-semibold mb-2 flex items-center gap-2">
                        <i class="fas fa-info-circle text-blue-400"></i>
                        اطلاعات مکمل
                    </h4>
                    ${[
                        { key: 'referrer',    label: 'معرف',       icon: 'fa-user-tag',   color: 'text-yellow-400' },
                        { key: 'agent',       label: 'عامل',       icon: 'fa-user-tie',   color: 'text-blue-400'   },
                        { key: 'agent_share', label: 'سهم عامل',   icon: 'fa-percent',    color: 'text-orange-400' },
                        { key: 'final_price', label: 'مبلغ نهایی', icon: 'fa-money-bill', color: 'text-green-400'  },
                        { key: 'paid',        label: 'پرداختی',    icon: 'fa-wallet',     color: 'text-emerald-400'},
                    ].map(f => `
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">
                            <i class="fas ${f.icon} ml-1 ${f.color}"></i>${f.label}
                        </label>
                        <input type="text" value="${r[f.key] || ''}"
                               onblur="RegistrationsModule.updateField('${id}','${f.key}',this.value)"
                               class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-lime-500">
                    </div>`).join('')}

                    <label class="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" ${r.agent_share_confirmed ? 'checked' : ''}
                               onchange="RegistrationsModule.updateField('${id}','agent_share_confirmed',this.checked)"
                               class="w-4 h-4 accent-lime-500">
                        <span class="text-sm text-gray-300">سهم عامل تأیید شده</span>
                    </label>

                    <div>
                        <label class="block text-xs text-gray-400 mb-1">
                            <i class="fas fa-comment-dots ml-1 text-gray-400"></i>توضیحات
                        </label>
                        <textarea rows="3"
                                  onblur="RegistrationsModule.updateField('${id}','notes',this.value)"
                                  class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-lime-500 resize-none">${r.notes || ''}</textarea>
                    </div>
                </div>

                <div class="text-xs text-gray-600 text-left">
                    ثبت: ${r.createdAt ? new Date(r.createdAt).toLocaleString('fa-IR') : '—'}
                </div>
            </div>`;

        document.getElementById('reg-detail-modal').classList.remove('hidden');
    },

    /* ─── باز کردن فایل از Supabase Storage ─── */
    openFile(url) {
        if (!url) return;
        // public URL یا هر URL کامل را مستقیم باز کن
        if (url.startsWith('http')) {
            window.open(url, '_blank');
            return;
        }
        // اگر فقط path باشد، public URL بساز (پروژه اصلی)
        const SUPABASE_URL = 'https://xqcsmtqcaqucszapimmr.supabase.co';
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/student-documents/${url}`;
        window.open(publicUrl, '_blank');
    },

    toggleStep(id, stepKey, checked) {
        this.updateField(id, stepKey, checked);
        // refresh style چک‌باکس‌ها بدون بستن modal
        document.querySelectorAll('#reg-detail-inner label input[type=checkbox]').forEach(inp => {
            const span = inp.nextElementSibling;
            if (!span) return;
            if (inp.checked) {
                span.classList.add('line-through', 'text-gray-500');
                span.classList.remove('text-gray-200');
            } else {
                span.classList.remove('line-through', 'text-gray-500');
                span.classList.add('text-gray-200');
            }
        });
        this.renderList();
    },

    changeStatus(id, status) {
        this.updateField(id, 'status', status);
        const r  = this.getById(id);
        const st = this.getStatusInfo(status);
        // آپدیت badge در modal
        const badge = document.querySelector('#reg-detail-inner .rounded-full.border');
        if (badge && badge.textContent.trim() !== (r?.registration_id || '')) {
            badge.className  = `text-xs px-2 py-0.5 rounded-full border ${st.color}`;
            badge.textContent = st.label;
        }
        // sync به Supabase
        const sb = typeof SupabaseDataModule !== 'undefined' ? SupabaseDataModule : null;
        if (sb && typeof sb.updateRegistrationStatus === 'function') {
            sb.updateRegistrationStatus(id, status).catch(e => console.warn('status sync:', e));
        }
        this.renderList();
    },

    /* ─── نمونه داده برای تست ─── */
    addSampleData() {
        const list = this.getAll();
        const sample = {
            id:                  'reg_sample_' + Date.now(),
            registration_id:     'REG-SAMPLE-' + Date.now(),
            middle_name:         'علی محمد حسین',
            last_name:           'الزیدی',
            religion:            'شيعي',
            phone:               '+9647812345678',
            email:               'ali@example.com',
            address_iraq:        'بغداد - الکرخ',
            job:                 'معلم',
            marital_status:      'متزوج',
            children_count:      2,
            university_type:     'نفقة خاصة',
            degree:              'master',
            major:               'مدیریت کسب‌وکار',
            previous_university: 'جامعة بغداد',
            bachelor_gpa:        '3.5',
            master_university:   '',
            master_gpa:          '',
            passport_url:        '',
            personal_photo_url:  '',
            transcript_url:      '',
            status:              'new',
            createdAt:           new Date().toISOString(),
        };
        list.unshift(sample);
        this.save(list);
        this.renderList();
        if (typeof UTILS !== 'undefined') UTILS.showNotification('داده نمونه اضافه شد', 'success');
    },
};

window.RegistrationsModule = RegistrationsModule;
