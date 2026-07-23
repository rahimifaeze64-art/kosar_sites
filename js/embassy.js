// ============================================================
// embassy.js  —  ماژول سفارت
// ذخیره‌سازی در Supabase (جدول: embassy_records)
// ============================================================

const EmbassyModule = (function () {
    'use strict';

    const TABLE = 'embassy_records';

    // ── helper: Supabase client ──────────────────────────────
    function sb() {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
        if (!client) console.warn('⚠️ Embassy: Supabase client در دسترس نیست');
        return client;
    }

    // ── کاربر جاری ──────────────────────────────────────────
    function currentUser() {
        try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); }
        catch { return {}; }
    }

    // ── CRUD ─────────────────────────────────────────────────
    async function getAll() {
        const client = sb(); if (!client) return [];
        const { data, error } = await client
            .from(TABLE)
            .select('*')
            .order('created_at', { ascending: false });
        if (error) { console.error('Embassy getAll:', error.message); return []; }
        return data || [];
    }

    async function insert(payload) {
        const client = sb(); if (!client) return null;
        const u = currentUser();
        const row = { ...payload, created_by: u.id || null, created_by_name: u.name || null };
        const { data, error } = await client.from(TABLE).insert([row]).select().single();
        if (error) { console.error('Embassy insert:', error.message); return null; }
        return data;
    }

    async function update(id, payload) {
        const client = sb(); if (!client) return false;
        const { error } = await client.from(TABLE).update(payload).eq('id', id);
        if (error) { console.error('Embassy update:', error.message); return false; }
        return true;
    }

    async function remove(id) {
        const client = sb(); if (!client) return false;
        const { error } = await client.from(TABLE).delete().eq('id', id);
        if (error) { console.error('Embassy delete:', error.message); return false; }
        return true;
    }

    // ── آپلود فایل به Storage ────────────────────────────────
    async function uploadFile(file, recordId) {
        const client = sb(); if (!client) return null;
        const ext  = file.name.split('.').pop();
        const path = `${recordId}/${Date.now()}_${file.name}`;
        const { data, error } = await client.storage
            .from('embassy-files')
            .upload(path, file, { cacheControl: '3600', upsert: false });
        if (error) { console.error('Embassy upload:', error.message); return null; }
        return data.path;
    }

    // ── دریافت لینک دانلود فایل از Storage ─────────────────
    async function getDownloadUrl(path) {
        const client = sb(); if (!client) return null;
        const { data } = await client.storage
            .from('embassy-files')
            .createSignedUrl(path, 3600); // لینک ۱ ساعته
        return data?.signedUrl || null;
    }
    function getContent() {
        return `
        <div id="embassy-app" class="space-y-6">

            <!-- هدر -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                        <span class="bg-yellow-500 bg-opacity-20 p-2 rounded-xl">
                            <i class="fas fa-landmark text-yellow-400"></i>
                        </span>
                        سفارت
                    </h2>
                    <p class="text-blue-200 text-sm mt-1">مدیریت مدارک سفارتخانه‌ای دانشجویان</p>
                </div>
                <button onclick="EmbassyModule.openAddModal()"
                    class="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg">
                    <i class="fas fa-plus"></i> ثبت مدرک جدید
                </button>
            </div>

            <!-- جستجو و فیلتر -->
            <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm space-y-3">
                <div class="flex gap-3 flex-wrap">
                    <input type="text" id="embassy-search" placeholder="🔍 جستجو بر اساس نام دانشجو..."
                        oninput="EmbassyModule.applyFilter()"
                        class="flex-1 min-w-48 bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200">
                    <select id="embassy-filter-type" onchange="EmbassyModule.applyFilter()"
                        class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500">
                        <option value="">همه نوع‌های کار</option>
                        <option value="ترجمه">ترجمه</option>
                        <option value="تصدیق">تصدیق</option>
                        <option value="وکالتنامه">وکالتنامه</option>
                        <option value="مدارک تحصیلی">مدارک تحصیلی</option>
                        <option value="سایر">سایر</option>
                    </select>
                </div>
                <!-- فیلترهای فیلد خالی -->
                <div class="flex flex-wrap gap-2">
                    <span class="text-gray-500 text-xs self-center font-medium">فیلتر موارد ناقص:</span>
                    <button onclick="EmbassyModule.applyQuickFilter('no_sajad')" id="qf-no_sajad"
                        class="quick-filter-btn text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all">
                        <i class="fas fa-id-card ml-1"></i>بدون سجاد
                    </button>
                    <button onclick="EmbassyModule.applyQuickFilter('no_docs')" id="qf-no_docs"
                        class="quick-filter-btn text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all">
                        <i class="fas fa-file-alt ml-1"></i>مدارک آپلود نشده
                    </button>
                    <button onclick="EmbassyModule.applyQuickFilter('not_received')" id="qf-not_received"
                        class="quick-filter-btn text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all">
                        <i class="fas fa-inbox ml-1"></i>دریافت نشده
                    </button>
                    <button onclick="EmbassyModule.applyQuickFilter('not_settled')" id="qf-not_settled"
                        class="quick-filter-btn text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all">
                        <i class="fas fa-money-bill ml-1"></i>تسویه نشده
                    </button>
                    <button onclick="EmbassyModule.applyQuickFilter('no_vekalat')" id="qf-no_vekalat"
                        class="quick-filter-btn text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all">
                        <i class="fas fa-scale-balanced ml-1"></i>وکالت ندارند
                    </button>
                    <button onclick="EmbassyModule.applyQuickFilter('')" id="qf-all"
                        class="quick-filter-btn text-xs px-3 py-1.5 rounded-full border border-blue-400 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all">
                        <i class="fas fa-list ml-1"></i>همه
                    </button>
                </div>
            </div>

            <!-- لودینگ -->
            <div id="embassy-loading" class="text-center py-12">
                <i class="fas fa-spinner fa-spin text-3xl text-yellow-400"></i>
                <p class="text-blue-200 mt-3">در حال بارگذاری...</p>
            </div>

            <!-- جدول -->
            <div id="embassy-table-container" class="hidden"></div>

            <!-- مودال افزودن/ویرایش -->
            <div id="embassy-modal" class="hidden fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
                <div class="bg-gradient-to-b from-blue-800 to-blue-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-y-auto border border-blue-600">
                    <div class="flex items-center justify-between p-6 border-b border-blue-600 border-opacity-40">
                        <h3 id="embassy-modal-title" class="text-xl font-bold text-white">ثبت مدرک جدید</h3>
                        <button onclick="EmbassyModule.closeModal()" class="text-gray-400 hover:text-white text-2xl">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <form id="embassy-form" onsubmit="EmbassyModule.submitForm(event)" class="p-6 space-y-4">
                        <input type="hidden" id="embassy-edit-id">

                        <!-- ردیف اول -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-blue-200 text-sm font-semibold block mb-1">
                                    نام دانشجو <span class="text-red-400">*</span>
                                </label>
                                <input type="text" id="f-studentName" required
                                    class="w-full bg-blue-700 bg-opacity-50 text-white border border-blue-500 rounded-lg px-4 py-2.5 focus:outline-none focus:border-yellow-400"
                                    placeholder="نام کامل دانشجو">
                            </div>
                            <div>
                                <label class="text-blue-200 text-sm font-semibold block mb-2">
                                    نوع کار <span class="text-red-400">*</span>
                                </label>
                                <p class="text-blue-400 text-xs mb-3 flex items-center gap-1">
                                    <i class="fas fa-info-circle"></i>
                                    روی کارت کلیک کنید تا انتخاب شود، سپس وضعیت را مشخص کنید
                                </p>
                                <style>
                                    .doc-card { transition: all .2s; }
                                    .doc-card[data-checked="true"] { ring: 2px; }
                                    .status-btn.active-status { font-weight:700; box-shadow:0 0 0 2px currentColor; }
                                </style>
                                <div class="grid grid-cols-2 gap-2">
                                    ${[
                                        ['مباشره',       'mabashare',  'fa-file-signature', '#a78bfa'],
                                        ['قبول نهایی',   'qabool',     'fa-check-double',   '#34d399'],
                                        ['کارشناسی',     'karshenasi', 'fa-graduation-cap', '#60a5fa'],
                                        ['ارشد',         'arshad',     'fa-user-graduate',  '#22d3ee'],
                                        ['دکتری',        'doktori',    'fa-award',          '#fbbf24'],
                                        ['مجلد',         'mojallad',   'fa-book',           '#fb923c'],
                                        ['وکالت‌نامه',   'vekalat',    'fa-scale-balanced', '#f87171'],
                                        ['سایر',         'sayer',      'fa-ellipsis',       '#9ca3af'],
                                    ].map(([label, key, icon, color]) => `
                                    <div class="doc-card rounded-xl border-2 border-transparent bg-white/5 p-3 cursor-pointer select-none"
                                         style="transition:all .2s"
                                         data-key="${key}" data-label="${label}" data-checked="false"
                                         onclick="EmbassyModule._toggleDocCard(this,'${key}','${label}')">
                                        <div class="flex items-center gap-2 mb-0">
                                            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                 style="background:${color}22">
                                                <i class="fas ${icon} text-sm" style="color:${color}"></i>
                                            </div>
                                            <span class="text-white text-sm font-medium flex-1">${label}</span>
                                            <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                                                 style="border-color:${color}" id="chk-${key}">
                                            </div>
                                        </div>
                                        <div id="status-${key}" class="hidden mt-2 pt-2 border-t border-white/10" onclick="event.stopPropagation()">
                                            <div class="flex gap-1">
                                                <button type="button" data-status="ترجمه"
                                                    onclick="EmbassyModule._setStatus(this,'${key}','ترجمه')"
                                                    class="status-btn flex-1 text-xs py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30 hover:bg-blue-500/40 transition-all">
                                                    ترجمه
                                                </button>
                                                <button type="button" data-status="تصدیق"
                                                    onclick="EmbassyModule._setStatus(this,'${key}','تصدیق')"
                                                    class="status-btn flex-1 text-xs py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-500/40 transition-all">
                                                    تصدیق
                                                </button>
                                                <button type="button" data-status="هردو"
                                                    onclick="EmbassyModule._setStatus(this,'${key}','هردو')"
                                                    class="status-btn flex-1 text-xs py-1.5 rounded-lg bg-green-500/30 text-green-300 border-2 border-green-400/60 font-bold transition-all active-status">
                                                    هردو
                                                </button>
                                            </div>
                                            <input type="hidden" id="hid-status-${key}" value="هردو">
                                            <input type="checkbox" class="doc-type-check hidden" data-key="${key}" data-label="${label}" checked>
                                            ${key === 'sayer' ? `<input type="text" id="sayer-custom-text" placeholder="نوع سند را بنویسید..." onclick="event.stopPropagation()" class="mt-2 w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-yellow-400">` : ''}
                                        </div>
                                    </div>`).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- ردیف دوم -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-gray-800 text-sm font-semibold block mb-1">تاریخ دریافت مدارک</label>
                                <div class="relative">
                                    <input type="text" id="f-receiveDate-display" readonly
                                        placeholder="انتخاب تاریخ شمسی"
                                        class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                                        onclick="EmbassyModule._openDatePicker('f-receiveDate','f-receiveDate-display',this)">
                                    <input type="hidden" id="f-receiveDate">
                                    <i class="fas fa-calendar-alt absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                                </div>
                            </div>
                            <div>
                                <label class="text-gray-800 text-sm font-semibold block mb-1">نحوه ارسال</label>
                                <input type="text" id="f-sendMethod"
                                    class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
                                    placeholder="مثال: سخایی، پست، اسم معقب">
                            </div>
                        </div>

                        <!-- ردیف سوم -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-gray-800 text-sm font-semibold block mb-1">تاریخ ارسال</label>
                                <div class="relative">
                                    <input type="text" id="f-sendDate-display" readonly
                                        placeholder="انتخاب تاریخ شمسی"
                                        class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 cursor-pointer focus:outline-none focus:border-blue-500"
                                        onclick="EmbassyModule._openDatePicker('f-sendDate','f-sendDate-display',this)">
                                    <input type="hidden" id="f-sendDate">
                                    <i class="fas fa-calendar-alt absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                                </div>
                            </div>
                            <!-- اعلام وصول + آپلود عکس -->
                            <div>
                                <label class="text-gray-800 text-sm font-semibold block mb-1">اعلام وصول</label>
                                <input type="text" id="f-acknowledgment"
                                    class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 mb-2"
                                    placeholder="تاریخ یا توضیح اعلام وصول">
                                <div class="flex items-center gap-2">
                                    <label class="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all">
                                        <i class="fas fa-camera"></i> تصویر وصول
                                        <input type="file" id="f-acknowledgment-img" accept="image/*" class="hidden"
                                            onchange="EmbassyModule.previewSingleImg(this,'ack-preview')">
                                    </label>
                                    <div id="ack-preview" class="flex gap-1 flex-wrap"></div>
                                </div>
                            </div>
                        </div>

                        <!-- ردیف چهارم — تسویه (۳ فیلد عددی + واحد پولی) -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-gray-800 text-sm font-semibold block mb-2">تسویه</label>
                                <!-- انتخاب واحد پولی -->
                                <div class="flex gap-2 mb-3">
                                    <button type="button" data-currency="تومان" onclick="EmbassyModule._setCurrency(this)"
                                        class="currency-btn flex-1 text-xs py-1.5 rounded-lg border-2 border-blue-500 text-blue-700 bg-blue-50 font-bold transition-all active-currency">
                                        تومان
                                    </button>
                                    <button type="button" data-currency="دلار" onclick="EmbassyModule._setCurrency(this)"
                                        class="currency-btn flex-1 text-xs py-1.5 rounded-lg border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-all">
                                        دلار $
                                    </button>
                                </div>
                                <input type="hidden" id="f-currency" value="تومان">
                                <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                                    <div>
                                        <label class="text-orange-600 text-xs mb-1 block font-semibold">
                                            <i class="fas fa-handshake ml-1"></i>۱. عدد مورد اتفاق
                                        </label>
                                        <div class="flex gap-1">
                                            <input type="number" id="f-settlement-agreed" min="0" step="1"
                                                placeholder="مبلغ"
                                                class="flex-1 bg-white text-gray-900 border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                                            <span class="currency-label text-xs text-gray-500 self-center">تومان</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="text-yellow-600 text-xs mb-1 block font-semibold">
                                            <i class="fas fa-money-bill ml-1"></i>۲. بیعانه
                                        </label>
                                        <div class="flex gap-1">
                                            <input type="number" id="f-settlement-deposit" min="0" step="1"
                                                placeholder="مبلغ"
                                                class="flex-1 bg-white text-gray-900 border border-yellow-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500">
                                            <span class="currency-label text-xs text-gray-500 self-center">تومان</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="text-green-700 text-xs mb-1 block font-semibold">
                                            <i class="fas fa-check-circle ml-1"></i>۳. تسویه نهایی
                                        </label>
                                        <div class="flex gap-1">
                                            <input type="number" id="f-settlement-final" min="0" step="1"
                                                placeholder="مبلغ"
                                                class="flex-1 bg-white text-gray-900 border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                                            <span class="currency-label text-xs text-gray-500 self-center">تومان</span>
                                        </div>
                                    </div>
                                </div>
                                <input type="hidden" id="f-settlement" value="">
                            </div>
                            <div>
                                <label class="text-gray-800 text-sm font-semibold block mb-1">کد سجاد</label>
                                <input type="text" id="f-sajadCode"
                                    class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
                                    placeholder="کد سجاد دانشجو">
                            </div>
                        </div>

                        <!-- دریافت از دار الترجمه — ۳ فیلد -->
                        <div class="bg-blue-800/30 border border-blue-600/30 rounded-xl p-4 space-y-3">
                            <h4 class="text-blue-200 text-sm font-bold flex items-center gap-2">
                                <i class="fas fa-language text-yellow-400"></i>
                                دریافت از دار الترجمه
                            </h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label class="text-blue-300 text-xs mb-1 block">تاریخ دریافت</label>
                                    <input type="date" id="f-translation-date" data-jalali
                                        class="w-full bg-blue-700 bg-opacity-50 text-white border border-blue-500 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm">
                                </div>
                                <div>
                                    <label class="text-blue-300 text-xs mb-1 block">توضیحات دریافت</label>
                                    <input type="text" id="f-translationOffice"
                                        class="w-full bg-blue-700 bg-opacity-50 text-white border border-blue-500 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm"
                                        placeholder="توضیحات...">
                                </div>
                            </div>
                            <div>
                                <label class="text-blue-300 text-xs mb-1 block">تصویر مدارک دریافت‌شده</label>
                                <label class="cursor-pointer inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-all">
                                    <i class="fas fa-camera"></i> آپلود تصویر
                                    <input type="file" id="f-translation-img" accept="image/*" class="hidden" multiple
                                        onchange="EmbassyModule.previewSingleImg(this,'trans-preview')">
                                </label>
                                <div id="trans-preview" class="mt-2 flex gap-2 flex-wrap"></div>
                            </div>
                        </div>

                        <!-- آپلود مدارک — ۳ شخص جداگانه -->
                        <div class="bg-blue-800/30 border border-blue-600/30 rounded-xl p-4 space-y-3">
                            <h4 class="text-blue-200 text-sm font-bold flex items-center gap-2">
                                <i class="fas fa-paperclip text-yellow-400"></i>
                                پیوست مدارک
                            </h4>
                            <!-- کارمند ۱ -->
                            <div class="bg-blue-700/20 rounded-lg p-3">
                                <label class="text-blue-300 text-xs font-semibold mb-2 block">
                                    <i class="fas fa-user text-blue-400 ml-1"></i>کارمند ۱ — مدارک
                                </label>
                                <label class="cursor-pointer inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-all">
                                    <i class="fas fa-upload"></i> انتخاب فایل
                                    <input type="file" id="f-emp1-files" accept=".pdf,.jpg,.jpeg,.png" class="hidden" multiple
                                        onchange="EmbassyModule.previewSingleImg(this,'emp1-preview')">
                                </label>
                                <div id="emp1-preview" class="mt-2 flex gap-2 flex-wrap"></div>
                            </div>
                            <!-- کارمند ۲ -->
                            <div class="bg-blue-700/20 rounded-lg p-3">
                                <label class="text-blue-300 text-xs font-semibold mb-2 block">
                                    <i class="fas fa-user text-cyan-400 ml-1"></i>کارمند ۲ — مدارک
                                </label>
                                <label class="cursor-pointer inline-flex items-center gap-2 bg-cyan-700 hover:bg-cyan-600 text-white text-xs px-3 py-1.5 rounded-lg transition-all">
                                    <i class="fas fa-upload"></i> انتخاب فایل
                                    <input type="file" id="f-emp2-files" accept=".pdf,.jpg,.jpeg,.png" class="hidden" multiple
                                        onchange="EmbassyModule.previewSingleImg(this,'emp2-preview')">
                                </label>
                                <div id="emp2-preview" class="mt-2 flex gap-2 flex-wrap"></div>
                            </div>
                            <!-- عکس سجادها -->
                            <div class="bg-yellow-700/10 rounded-lg p-3">
                                <label class="text-yellow-200 text-xs font-semibold mb-2 block">
                                    <i class="fas fa-id-card text-yellow-400 ml-1"></i>عکس سجادها
                                </label>
                                <label class="cursor-pointer inline-flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white text-xs px-3 py-1.5 rounded-lg transition-all">
                                    <i class="fas fa-camera"></i> آپلود عکس سجاد
                                    <input type="file" id="f-sajad-imgs" accept="image/*" class="hidden" multiple
                                        onchange="EmbassyModule.previewSingleImg(this,'sajad-preview')">
                                </label>
                                <div id="sajad-preview" class="mt-2 flex gap-2 flex-wrap"></div>
                            </div>
                        </div>

                        <!-- دکمه‌ها -->
                        <div class="flex gap-3 pt-2">
                            <button type="submit" id="embassy-submit-btn"
                                class="flex-1 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                                <i class="fas fa-save"></i>
                                <span id="embassy-submit-text">ذخیره</span>
                            </button>
                            <button type="button" onclick="EmbassyModule.closeModal()"
                                class="px-6 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl transition-all">
                                انصراف
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- مودال تأیید حذف -->
            <div id="embassy-confirm-modal" class="hidden fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
                <div class="bg-blue-900 rounded-2xl p-6 max-w-sm w-full border border-red-700 shadow-2xl text-center">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                    <h3 class="text-white text-xl font-bold mb-2">تأیید حذف</h3>
                    <p class="text-blue-200 mb-6" id="embassy-confirm-text">آیا مطمئن هستید؟</p>
                    <div class="flex gap-3">
                        <button id="embassy-confirm-yes"
                            class="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl transition-all">
                            بله، حذف شود
                        </button>
                        <button onclick="document.getElementById('embassy-confirm-modal').classList.add('hidden')"
                            class="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2.5 rounded-xl transition-all">
                            انصراف
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ── رندر جدول ────────────────────────────────────────────
    function renderTable(records) {
        const container = document.getElementById('embassy-table-container');
        if (!container) return;
        container.classList.remove('hidden');

        if (!records.length) {
            container.innerHTML = `
                <div class="text-center py-16 bg-blue-900 bg-opacity-20 rounded-2xl border border-blue-700 border-opacity-30">
                    <i class="fas fa-folder-open text-5xl text-blue-400 mb-4 opacity-40"></i>
                    <p class="text-blue-200 text-lg">هیچ رکوردی ثبت نشده</p>
                    <p class="text-gray-400 text-sm mt-1">روی «ثبت مدرک جدید» کلیک کنید</p>
                </div>`;
            return;
        }

        const rows = records.map(r => `
            <tr class="border-b border-gray-200 hover:bg-yellow-50 transition-colors bg-white">
                <td class="px-3 py-3 font-semibold text-gray-900">${r.student_name}</td>
                <td class="px-3 py-3">
                    <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-lg font-medium">${r.work_type}</span>
                </td>
                <td class="px-3 py-3 text-gray-700 text-sm">${r.receive_date ? (typeof Jalali !== 'undefined' ? Jalali.displayDate(r.receive_date) : r.receive_date) : '—'}</td>
                <td class="px-3 py-3 text-gray-700 text-sm">${r.send_method || '—'}</td>
                <td class="px-3 py-3 text-gray-700 text-sm">${r.send_date ? (typeof Jalali !== 'undefined' ? Jalali.displayDate(r.send_date) : r.send_date) : '—'}</td>
                <td class="px-3 py-3">
                    ${r.acknowledgment
                        ? `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-lg font-medium">✓ ${r.acknowledgment}</span>`
                        : `<span class="text-red-500 text-xs font-medium">در انتظار</span>`}
                </td>
                <td class="px-3 py-3">
                    ${(r.settlement_agreed || r.settlement_deposit || r.settlement_final)
                        ? `<div class="space-y-0.5 text-xs">
                            ${r.settlement_agreed  ? `<div class="text-orange-700 font-medium">توافق: ${Number(r.settlement_agreed).toLocaleString('fa-IR')} ت</div>` : ''}
                            ${r.settlement_deposit ? `<div class="text-yellow-700 font-medium">بیعانه: ${Number(r.settlement_deposit).toLocaleString('fa-IR')} ت</div>` : ''}
                            ${r.settlement_final   ? `<span class="bg-green-100 text-green-800 px-2 py-0.5 rounded-lg font-bold">تسویه: ${Number(r.settlement_final).toLocaleString('fa-IR')} ت</span>` : ''}
                           </div>`
                        : `<span class="text-red-500 text-xs font-medium">تسویه نشده</span>`}
                </td>
                <td class="px-3 py-3 text-gray-900 text-sm font-mono font-semibold">${r.sajad_code || '<span class="text-red-500 text-xs">ندارد</span>'}</td>
                <td class="px-3 py-3 text-gray-700 text-sm">${r.translation_office || '—'}</td>
                <td class="px-3 py-3">
                    ${r.file_paths && r.file_paths.length
                        ? r.file_paths.map(p => `<button onclick="EmbassyModule.downloadFile('${p}')" class="block text-blue-600 hover:text-blue-800 text-xs underline truncate max-w-24 font-medium"><i class="fas fa-download ml-1"></i>${p.split('/').pop()}</button>`).join('')
                        : `<span class="text-red-500 text-xs font-medium">آپلود نشده</span>`}
                </td>
                <td class="px-3 py-3 text-gray-500 text-xs">${r.updated_at ? (typeof Jalali!=='undefined' ? Jalali.toJalaliDateTime(r.updated_at) : new Date(r.updated_at).toLocaleDateString('fa-IR')) : '—'}</td>
                <td class="px-3 py-3 text-xs text-gray-600 font-medium">${r.created_by_name || '—'}</td>
                <td class="px-3 py-3">
                    <div class="flex gap-2">
                        <button onclick="EmbassyModule.openEditModal('${r.id}')"
                            class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="EmbassyModule.confirmDelete('${r.id}','${(r.student_name||'').replace(/'/g,"\\'")}')"
                            class="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`).join('');

        container.innerHTML = `
            <div class="overflow-x-auto rounded-xl border border-gray-300 shadow-sm">
                <table class="w-full text-sm bg-white" style="min-width:1200px">
                    <thead>
                        <tr class="bg-gray-100 text-gray-700 text-xs border-b border-gray-300">
                            <th class="px-3 py-3 text-right font-bold">نام دانشجو</th>
                            <th class="px-3 py-3 text-right font-bold">نوع کار</th>
                            <th class="px-3 py-3 text-right font-bold">تاریخ دریافت</th>
                            <th class="px-3 py-3 text-right font-bold">نحوه ارسال</th>
                            <th class="px-3 py-3 text-right font-bold">تاریخ ارسال</th>
                            <th class="px-3 py-3 text-right font-bold">اعلام وصول</th>
                            <th class="px-3 py-3 text-right font-bold">تسویه</th>
                            <th class="px-3 py-3 text-right font-bold">کد سجاد</th>
                            <th class="px-3 py-3 text-right font-bold">دار الترجمه</th>
                            <th class="px-3 py-3 text-right font-bold">فایل‌ها</th>
                            <th class="px-3 py-3 text-right font-bold">آخرین آپدیت</th>
                            <th class="px-3 py-3 text-right font-bold">ثبت‌کننده</th>
                            <th class="px-3 py-3 text-right font-bold">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <p class="text-gray-500 text-xs mt-2">${records.length} رکورد</p>`;
    }

    // ── toggle کارت سند ─────────────────────────────────────
    function _toggleDocCard(card, key, label) {
        var isChecked = card.dataset.checked === 'true';
        var statusDiv = document.getElementById('status-' + key);
        var chkCircle = document.getElementById('chk-' + key);

        if (isChecked) {
            // deselect
            card.dataset.checked = 'false';
            card.style.borderColor = 'transparent';
            card.style.background = 'rgba(255,255,255,0.05)';
            if (statusDiv) statusDiv.classList.add('hidden');
            if (chkCircle) chkCircle.innerHTML = '';
            var cb = card.querySelector('.doc-type-check');
            if (cb) cb.checked = false;
        } else {
            // select
            card.dataset.checked = 'true';
            card.style.borderColor = '#3b82f6';
            card.style.background = 'rgba(59,130,246,0.15)';
            if (statusDiv) {
                statusDiv.classList.remove('hidden');
                // پیش‌فرض: هردو
                var hidInp = document.getElementById('hid-status-' + key);
                if (hidInp && !hidInp.value) hidInp.value = 'هردو';
                var btns = statusDiv.querySelectorAll('.status-btn');
                btns.forEach(function(b) { b.classList.remove('active-status', 'border-2'); });
                var defaultBtn = statusDiv.querySelector('[data-status="هردو"]');
                if (defaultBtn) defaultBtn.classList.add('active-status', 'border-2');
            }
            if (chkCircle) chkCircle.innerHTML = '<i class="fas fa-check text-xs text-blue-400"></i>';
            var cb2 = card.querySelector('.doc-type-check');
            if (cb2) cb2.checked = true;
        }
    }

    // ── تغییر وضعیت سند ─────────────────────────────────────
    function _setStatus(btn, key, status) {
        var statusDiv = document.getElementById('status-' + key);
        if (!statusDiv) return;
        statusDiv.querySelectorAll('.status-btn').forEach(function(b) {
            b.classList.remove('active-status', 'border-2', 'font-bold');
        });
        btn.classList.add('active-status', 'border-2', 'font-bold');
        var hidInp = document.getElementById('hid-status-' + key);
        if (hidInp) hidInp.value = status;
    }

    // ── toggle قدیمی (نگه داشته برای سازگاری) ───────────────
    function _toggleDocType(cb) {
        var card = cb.closest ? cb.closest('.doc-card') : null;
        if (card) _toggleDocCard(card, cb.dataset.key, cb.dataset.label);
    }

    // ── date picker manual trigger ──────────────────────────
    function _openDatePicker(hiddenId, displayId, displayInput) {
        if (typeof JalaliPicker === 'undefined') return;
        var hidden = document.getElementById(hiddenId);
        if (!hidden) return;
        // موقتاً display:block کن و attach کن
        hidden.style.display = '';
        if (!hidden.dataset.pickerReady) {
            JalaliPicker._attach(hidden);
            hidden.dataset.pickerReady = '1';
            // override display input با display ما
        }
        // simulate click روی display input که picker ساخته
        var pickerDisplay = hidden.nextElementSibling;
        if (pickerDisplay && pickerDisplay.readOnly) {
            pickerDisplay.click();
        } else {
            displayInput.click();
        }
    }

    // ── تغییر واحد پولی ──────────────────────────────────────
    function _setCurrency(btn) {
        document.querySelectorAll('.currency-btn').forEach(b => {
            b.classList.remove('active-currency','border-2','border-blue-500','text-blue-700','bg-blue-50','font-bold');
            b.classList.add('border','border-gray-300','text-gray-600','bg-white');
        });
        btn.classList.add('active-currency','border-2','border-blue-500','text-blue-700','bg-blue-50','font-bold');
        btn.classList.remove('border','border-gray-300','text-gray-600','bg-white');
        const currency = btn.dataset.currency;
        document.getElementById('f-currency').value = currency;
        document.querySelectorAll('.currency-label').forEach(el => { el.textContent = currency; });
    }
        document.querySelectorAll('.settle-btn').forEach(b => {
            b.style.fontWeight = '';
            b.style.boxShadow = '';
        });
        btn.style.fontWeight = '700';
        btn.style.boxShadow = '0 0 0 2px currentColor';
        document.getElementById('f-settlement').value = btn.dataset.settle;
    }

    // ── پیش‌نمایش تصویر کوچک ─────────────────────────────
    function previewSingleImg(input, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        Array.from(input.files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = e => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #3b82f6;cursor:pointer;';
                    img.title = file.name;
                    img.onclick = () => window.open(e.target.result, '_blank');
                    container.appendChild(img);
                };
                reader.readAsDataURL(file);
            } else {
                const p = document.createElement('div');
                p.className = 'text-xs text-blue-300 flex items-center gap-1';
                p.innerHTML = `<i class="fas fa-file"></i>${file.name}`;
                container.appendChild(p);
            }
        });
    }

    // ── فیلتر سریع ───────────────────────────────────────
    let _activeQuickFilter = '';
    function applyQuickFilter(filterKey) {
        _activeQuickFilter = filterKey;
        // هایلایت دکمه
        document.querySelectorAll('.quick-filter-btn').forEach(b => {
            b.classList.remove('bg-red-100','border-red-400','text-red-700','bg-blue-50','border-blue-400','text-blue-600');
            b.classList.add('border-gray-300','text-gray-600');
        });
        const activeBtn = document.getElementById('qf-' + (filterKey || 'all'));
        if (activeBtn) {
            activeBtn.classList.remove('border-gray-300','text-gray-600');
            if (filterKey) activeBtn.classList.add('bg-red-100','border-red-400','text-red-700');
            else activeBtn.classList.add('bg-blue-50','border-blue-400','text-blue-600');
        }
        applyFilter();
    }

    // ── state داده‌های کش‌شده برای فیلتر ────────────────────
    let _allRecords = [];

    // ── بارگذاری و رندر ──────────────────────────────────────
    async function load() {
        const loading = document.getElementById('embassy-loading');
        const container = document.getElementById('embassy-table-container');
        if (loading) loading.classList.remove('hidden');
        if (container) container.classList.add('hidden');

        _allRecords = await getAll();

        if (loading) loading.classList.add('hidden');
        renderTable(_allRecords);
    }

    function applyFilter() {
        const search = (document.getElementById('embassy-search')?.value || '').toLowerCase();
        const type   = (document.getElementById('embassy-filter-type')?.value || '');

        let filtered = _allRecords.filter(r => {
            const matchName = !search || (r.student_name || '').toLowerCase().includes(search);
            const matchType = !type  || (r.work_type || '').includes(type);
            return matchName && matchType;
        });

        // فیلتر سریع
        if (_activeQuickFilter === 'no_sajad') {
            filtered = filtered.filter(r => !r.sajad_code);
        } else if (_activeQuickFilter === 'no_docs') {
            filtered = filtered.filter(r => !r.file_paths || !r.file_paths.length);
        } else if (_activeQuickFilter === 'not_received') {
            filtered = filtered.filter(r => !r.acknowledgment);
        } else if (_activeQuickFilter === 'not_settled') {
            filtered = filtered.filter(r => !r.settlement);
        } else if (_activeQuickFilter === 'no_vekalat') {
            filtered = filtered.filter(r => !(r.work_type || '').includes('وکالت'));
        }

        renderTable(filtered);
    }

    // ── مودال افزودن ─────────────────────────────────────────
    function openAddModal() {
        document.getElementById('embassy-edit-id').value = '';
        document.getElementById('embassy-modal-title').textContent = 'ثبت مدرک جدید';
        document.getElementById('embassy-submit-text').textContent = 'ذخیره';
        document.getElementById('embassy-form').reset();
        document.querySelectorAll('.doc-card').forEach(function(card) {
            card.dataset.checked = 'false';
            card.style.borderColor = 'transparent';
            card.style.background = 'rgba(255,255,255,0.05)';
            var key = card.dataset.key;
            var sd = document.getElementById('status-' + key);
            if (sd) sd.classList.add('hidden');
            var chk = document.getElementById('chk-' + key);
            if (chk) chk.innerHTML = '';
        });
        document.querySelectorAll('.doc-type-check').forEach(function(cb) { cb.checked = false; });
        // پاک کردن preview های آپلود
        ['f-files-preview','ack-preview','trans-preview','emp1-preview','emp2-preview','sajad-preview'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        // ریست settlement buttons
        document.querySelectorAll('.settle-btn').forEach(b => { b.style.fontWeight=''; b.style.boxShadow=''; });
        var fs = document.getElementById('f-settlement');
        if (fs) fs.value = '';
        // پاک کردن picker state تا دوباره attach بشه
        ['f-receiveDate','f-sendDate','f-translation-date'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) delete el.dataset.pickerAttached;
        });
        document.getElementById('embassy-modal').classList.remove('hidden');
        // فعال‌سازی تقویم شمسی روی فیلدهای تاریخ
        setTimeout(function() {
            if (typeof JalaliPicker !== 'undefined') {
                ['f-receiveDate','f-sendDate','f-translation-date'].forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el && !el.dataset.pickerAttached) {
                        JalaliPicker._attach(el);
                        el.dataset.pickerAttached = '1';
                    }
                });
            }
        }, 80);
    }

    // ── مودال ویرایش ─────────────────────────────────────────
    function openEditModal(id) {
        const r = _allRecords.find(x => x.id === id);
        if (!r) return;

        document.getElementById('embassy-edit-id').value = id;
        document.getElementById('embassy-modal-title').textContent = 'ویرایش رکورد';
        document.getElementById('embassy-submit-text').textContent = 'ذخیره تغییرات';

        document.getElementById('f-studentName').value = r.student_name || '';

        // پر کردن چک‌باکس‌های نوع سند + وضعیت
        document.querySelectorAll('.doc-type-check').forEach(function(cb) {
            cb.checked = false;
            var sd = document.getElementById('status-' + cb.dataset.key);
            if (sd) { sd.classList.add('opacity-40','pointer-events-none'); sd.querySelectorAll('input[type="radio"]').forEach(function(r){r.checked=false;}); }
        });
        if (r.work_type) {
            r.work_type.split('، ').forEach(function(part) {
                var match = part.match(/^(.+?)\s*\((.+?)\)$/);
                var label = match ? match[1].trim() : part.trim();
                var status = match ? match[2].trim() : '';
                document.querySelectorAll('.doc-type-check').forEach(function(cb) {
                    if (cb.dataset.label === label || (cb.dataset.key === 'sayer' && !['مباشره','قبول نهایی','مدرک کارشناسی','مدرک ارشد','مدرک دکتری','مجلد','وکالت‌نامه'].includes(label))) {
                        cb.checked = true;
                        _toggleDocType(cb);
                        if (status) {
                            var r2 = document.querySelector('input[name="status-' + cb.dataset.key + '"][value="' + status + '"]');
                            if (r2) r2.checked = true;
                        }
                        if (cb.dataset.key === 'sayer') {
                            var ct2 = document.getElementById('sayer-custom-text');
                            if (ct2) ct2.value = label;
                        }
                    }
                });
            });
        }
        document.getElementById('f-receiveDate').value      = r.receive_date       || '';
        document.getElementById('f-sendMethod').value       = r.send_method        || '';
        document.getElementById('f-sendDate').value         = r.send_date          || '';
        document.getElementById('f-acknowledgment').value   = r.acknowledgment     || '';
        const fa = document.getElementById('f-settlement-agreed');   if(fa) fa.value = r.settlement_agreed  || '';
        const fd = document.getElementById('f-settlement-deposit');  if(fd) fd.value = r.settlement_deposit || '';
        const ff = document.getElementById('f-settlement-final');    if(ff) ff.value = r.settlement_final   || '';
        document.getElementById('f-sajadCode').value        = r.sajad_code         || '';
        document.getElementById('f-translationOffice').value= r.translation_office || '';
        const ftd = document.getElementById('f-translation-date'); if(ftd) ftd.value = r.translation_date || '';

        const preview = document.getElementById('f-files-preview');
        if (preview) preview.innerHTML = r.file_paths && r.file_paths.length
            ? r.file_paths.map(p => `<p class="text-xs text-blue-300"><i class="fas fa-file ml-1"></i>${p}</p>`).join('')
            : '';

        document.getElementById('embassy-modal').classList.remove('hidden');
        // فعال‌سازی تقویم شمسی
        setTimeout(function() {
            if (typeof JalaliPicker !== 'undefined') {
                ['f-receiveDate','f-sendDate','f-translation-date'].forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el && !el.dataset.pickerAttached) {
                        JalaliPicker._attach(el);
                        el.dataset.pickerAttached = '1';
                    }
                });
            }
        }, 80);
    }

    function closeModal() {
        document.getElementById('embassy-modal').classList.add('hidden');
    }

    // ── پیش‌نمایش فایل‌ها ────────────────────────────────────
    function previewFiles(input) {
        const preview = document.getElementById('f-files-preview');
        preview.innerHTML = '';
        Array.from(input.files).forEach(f => {
            const p = document.createElement('p');
            p.className = 'text-xs text-blue-300';
            p.innerHTML = `<i class="fas fa-file ml-1"></i>${f.name} (${(f.size/1024).toFixed(0)} KB)`;
            preview.appendChild(p);
        });
    }

    // ── ارسال فرم ────────────────────────────────────────────
    async function submitForm(e) {
        e.preventDefault();

        const btn  = document.getElementById('embassy-submit-btn');
        const text = document.getElementById('embassy-submit-text');
        btn.disabled = true;
        text.textContent = 'در حال ذخیره...';

        const editId = document.getElementById('embassy-edit-id').value;

        // جمع‌آوری نوع کار از چک‌باکس‌ها + وضعیت
        const checkedDocs = Array.from(document.querySelectorAll('.doc-type-check:checked'));
        if (!checkedDocs.length) {
            btn.disabled = false;
            text.textContent = editId ? 'ذخیره تغییرات' : 'ذخیره';
            _toast('لطفاً حداقل یک نوع سند انتخاب کنید', 'error');
            return;
        }
        const workTypeParts = checkedDocs.map(cb => {
            const key   = cb.dataset.key;
            const label = key === 'sayer'
                ? (document.getElementById('sayer-custom-text')?.value.trim() || 'سایر')
                : cb.dataset.label;
            const hidInp = document.getElementById('hid-status-' + key);
            const status = hidInp ? hidInp.value : '';
            return status ? `${label} (${status})` : label;
        });
        const workTypeValue = workTypeParts.join('، ');

        // آپلود فایل‌ها
        const fileInput  = document.getElementById('f-files');
        const filePaths  = [];
        const recordId   = editId || ('emb_' + Date.now());

        for (const file of Array.from(fileInput.files)) {
            const path = await uploadFile(file, recordId);
            if (path) filePaths.push(path);
        }

        const payload = {
            student_name:        document.getElementById('f-studentName').value.trim(),
            work_type:           workTypeValue,
            receive_date:        document.getElementById('f-receiveDate').value || null,
            send_method:         document.getElementById('f-sendMethod').value  || null,
            send_date:           document.getElementById('f-sendDate').value    || null,
            acknowledgment:      document.getElementById('f-acknowledgment').value.trim() || null,
            settlement_agreed:   parseFloat(document.getElementById('f-settlement-agreed')?.value)  || 0,
            settlement_deposit:  parseFloat(document.getElementById('f-settlement-deposit')?.value) || 0,
            settlement_final:    parseFloat(document.getElementById('f-settlement-final')?.value)   || 0,
            settlement:          document.getElementById('f-currency')?.value || 'تومان',
            sajad_code:          document.getElementById('f-sajadCode').value.trim()      || null,
            translation_office:  document.getElementById('f-translationOffice').value.trim() || null,
            translation_date:    document.getElementById('f-translation-date')?.value || null,
        };

        if (filePaths.length) payload.file_paths = filePaths;

        let ok = false;
        if (editId) {
            ok = await update(editId, payload);
        } else {
            const result = await insert(payload);
            ok = !!result;
        }

        btn.disabled = false;
        text.textContent = editId ? 'ذخیره تغییرات' : 'ذخیره';

        if (ok) {
            closeModal();
            await load();
            _toast(editId ? 'رکورد بروزرسانی شد ✓' : 'رکورد جدید ثبت شد ✓', 'success');
        } else {
            _toast('خطا در ذخیره‌سازی — اتصال Supabase را بررسی کنید', 'error');
        }
    }

    // ── تأیید حذف ────────────────────────────────────────────
    function confirmDelete(id, name) {
        document.getElementById('embassy-confirm-text').textContent =
            `رکورد دانشجو "${name}" حذف شود؟`;
        const modal = document.getElementById('embassy-confirm-modal');
        modal.classList.remove('hidden');

        const btn = document.getElementById('embassy-confirm-yes');
        btn.onclick = async () => {
            modal.classList.add('hidden');
            const ok = await remove(id);
            if (ok) {
                await load();
                _toast('رکورد حذف شد', 'info');
            } else {
                _toast('خطا در حذف', 'error');
            }
        };
    }

    // ── toast ─────────────────────────────────────────────────
    function _toast(msg, type = 'info') {
        const colors = { success: '#16a34a', error: '#dc2626', info: '#2563eb' };
        const t = document.createElement('div');
        t.style.cssText = `
            position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
            background:${colors[type]||colors.info}; color:#fff;
            padding:12px 24px; border-radius:12px; font-family:Vazirmatn,sans-serif;
            font-size:14px; z-index:9999; direction:rtl; box-shadow:0 4px 20px rgba(0,0,0,0.3);
            animation: fadeIn .3s ease;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }

    // ── دانلود فایل ──────────────────────────────────────────
    async function downloadFile(path) {
        const url = await getDownloadUrl(path);
        if (!url) { _toast('خطا در دریافت لینک دانلود', 'error'); return; }
        const a = document.createElement('a');
        a.href = url;
        a.download = path.split('/').pop();
        a.target = '_blank';
        a.click();
    }

    // ── init (هنگام ورود به صفحه) ────────────────────────────
    function init() {
        // دادن زمان کوتاه تا DOM رندر شود
        setTimeout(() => load(), 100);
    }

    // ── Public API ───────────────────────────────────────────
    return {
        getContent,
        init,
        load,
        applyFilter,
        applyQuickFilter,
        openAddModal,
        openEditModal,
        closeModal,
        previewFiles,
        previewSingleImg,
        submitForm,
        confirmDelete,
        downloadFile,
        _toggleDocCard,
        _toggleDocType,
        _setStatus,
        _setSettlement,
        _openDatePicker,
        _setCurrency,
    };

})(); // end EmbassyModule
