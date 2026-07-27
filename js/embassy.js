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
                        سفارت - مدیریت مدارک دانشجویان
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
                        <option value="مباشره">مباشره</option>
                        <option value="قبول نهایی">قبول نهایی</option>
                        <option value="کارشناسی">کارشناسی</option>
                        <option value="ارشد">ارشد</option>
                        <option value="دکتری">دکتری</option>
                        <option value="مجلد">مجلد</option>
                        <option value="وکالت‌نامه">وکالت‌نامه</option>
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
                    <button onclick="EmbassyModule.applyQuickFilter('not_sent')" id="qf-not_sent"
                        class="quick-filter-btn text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all">
                        <i class="fas fa-paper-plane ml-1"></i>مدارک ارسال نشده
                    </button>
                    <button onclick="EmbassyModule.applyQuickFilter('not_acknowledged')" id="qf-not_acknowledged"
                        class="quick-filter-btn text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all">
                        <i class="fas fa-bell ml-1"></i>اعلام وصول نشده
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
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-y-auto border border-gray-200">
                    <div class="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
                        <h3 id="embassy-modal-title" class="text-xl font-bold text-gray-800">ثبت مدرک جدید</h3>
                        <button onclick="EmbassyModule.closeModal()" class="text-gray-400 hover:text-gray-700 text-2xl">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <form id="embassy-form" onsubmit="EmbassyModule.submitForm(event)" class="p-6 space-y-4">
                        <input type="hidden" id="embassy-edit-id">

                        <!-- ردیف اول -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-1">
                                    نام دانشجو <span class="text-red-500">*</span>
                                </label>
                                <input type="text" id="f-studentName" required
                                    class="w-full bg-gray-50 text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
                                    placeholder="نام کامل دانشجو">
                            </div>
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-2">
                                    نوع کار <span class="text-red-500">*</span>
                                </label>
                                <p class="text-gray-500 text-xs mb-3 flex items-center gap-1">
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
                                        ['مباشره',       'mabashare',  'fa-file-signature', '#6d28d9'],
                                        ['قبول نهایی',   'qabool',     'fa-check-double',   '#059669'],
                                        ['کارشناسی',     'karshenasi', 'fa-graduation-cap', '#2563eb'],
                                        ['ارشد',         'arshad',     'fa-user-graduate',  '#0891b2'],
                                        ['دکتری',        'doktori',    'fa-award',          '#d97706'],
                                        ['مجلد',         'mojallad',   'fa-book',           '#ea580c'],
                                        ['وکالت‌نامه',   'vekalat',    'fa-scale-balanced', '#dc2626'],
                                        ['سایر',         'sayer',      'fa-ellipsis',       '#6b7280'],
                                    ].map(([label, key, icon, color]) => `
                                    <div class="doc-card rounded-xl border-2 border-transparent bg-gray-100 p-3 cursor-pointer select-none"
                                         style="transition:all .2s"
                                         data-key="${key}" data-label="${label}" data-checked="false"
                                         onclick="EmbassyModule._toggleDocCard(this,'${key}','${label}')">
                                        <div class="flex items-center gap-2 mb-0">
                                            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                 style="background:${color}22">
                                                <i class="fas ${icon} text-sm" style="color:${color}"></i>
                                            </div>
                                            <span class="text-gray-800 text-sm font-medium flex-1">${label}</span>
                                            <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                                                 style="border-color:${color}" id="chk-${key}">
                                            </div>
                                        </div>
                                        <div id="status-${key}" class="hidden mt-2 pt-2 border-t border-gray-200" onclick="event.stopPropagation()">
                                            <div class="flex gap-1">
                                                <button type="button" data-status="ترجمه"
                                                    onclick="EmbassyModule._setStatus(this,'${key}','ترجمه')"
                                                    class="status-btn flex-1 text-xs py-1.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 transition-all">
                                                    ترجمه
                                                </button>
                                                <button type="button" data-status="تصدیق"
                                                    onclick="EmbassyModule._setStatus(this,'${key}','تصدیق')"
                                                    class="status-btn flex-1 text-xs py-1.5 rounded-lg bg-yellow-100 text-yellow-700 border border-yellow-300 hover:bg-yellow-200 transition-all">
                                                    تصدیق
                                                </button>
                                                <button type="button" data-status="هردو"
                                                    onclick="EmbassyModule._setStatus(this,'${key}','هردو')"
                                                    class="status-btn flex-1 text-xs py-1.5 rounded-lg bg-green-100 text-green-700 border-2 border-green-500 font-bold transition-all active-status">
                                                    هردو
                                                </button>
                                            </div>
                                            <input type="hidden" id="hid-status-${key}" value="هردو">
                                            <input type="checkbox" class="doc-type-check hidden" data-key="${key}" data-label="${label}" checked>
                                            ${key === 'sayer' ? `<input type="text" id="sayer-custom-text" placeholder="نوع سند را بنویسید..." onclick="event.stopPropagation()" class="mt-2 w-full bg-white text-gray-800 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-green-500">` : ''}
                                        </div>
                                    </div>`).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- ردیف دوم -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-1">تاریخ دریافت مدارک</label>
                                <div class="relative">
                                    <input type="date" id="f-receiveDate"
                                        class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200">
                                </div>
                            </div>
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-1">نحوه ارسال</label>
                                <input type="text" id="f-sendMethod"
                                    class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500"
                                    placeholder="مثال: زینب سخایی، پست، اسم معقب">
                            </div>
                        </div>

                        <!-- ردیف سوم -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-1">تاریخ ارسال</label>
                                <div class="relative">
                                    <input type="date" id="f-sendDate"
                                        class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500">
                                </div>
                            </div>
                            <!-- اعلام وصول + آپلود عکس -->
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-1">اعلام وصول</label>
                                <input type="text" id="f-acknowledgment"
                                    class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500 mb-2"
                                    placeholder="تاریخ یا توضیح اعلام وصول">
                                <div class="flex items-center gap-2">
                                    <label class="cursor-pointer bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all">
                                        <i class="fas fa-camera"></i> تصویر وصول
                                        <input type="file" id="f-acknowledgment-img" accept="image/*" class="hidden"
                                            onchange="EmbassyModule.previewSingleImg(this,'ack-preview')">
                                    </label>
                                    <div id="ack-preview" class="flex gap-1 flex-wrap"></div>
                                </div>
                            </div>
                        </div>

                        <!-- شماره تماس -->
                        <div>
                            <label class="text-gray-700 text-sm font-semibold block mb-1">شماره تماس</label>
                            <input type="text" id="f-phone"
                                class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500"
                                placeholder="شماره تماس دانشجو">
                        </div>

                        <!-- ردیف چهارم — تسویه (۳ فیلد عددی + واحد پولی) -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-2">تسویه</label>
                                <!-- انتخاب واحد پولی -->
                                <div class="flex gap-2 mb-3">
                                    <button type="button" data-currency="تومان" onclick="EmbassyModule._setCurrency(this)"
                                        class="currency-btn flex-1 text-xs py-1.5 rounded-lg border-2 border-green-500 text-green-700 bg-green-50 font-bold transition-all active-currency">
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
                                            <i class="fas fa-handshake ml-1"></i>۱. مبلغ مورد اتفاق
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
                                <label class="text-gray-700 text-sm font-semibold block mb-1">کد سجاد</label>
                                <input type="text" id="f-sajadCode"
                                    class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500 mb-2"
                                    placeholder="کد سجاد دانشجو">
                                <div class="flex items-center gap-2 mb-3">
                                    <label class="cursor-pointer bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all">
                                        <i class="fas fa-id-card"></i> تصویر سجاد
                                        <input type="file" id="f-sajad-img" accept="image/*" class="hidden"
                                            onchange="EmbassyModule.previewSingleImg(this,'sajad-code-preview')">
                                    </label>
                                    <div id="sajad-code-preview" class="flex gap-1 flex-wrap"></div>
                                </div>
                                <!-- وکالت‌نامه + آپلود عکس -->
                                <label class="text-gray-700 text-sm font-semibold block mb-1">وکالت‌نامه</label>
                                <div class="flex gap-3 mb-2">
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="f-vekalat" id="f-vekalat-yes" value="دارد"
                                            class="accent-green-500 w-4 h-4">
                                        <span class="text-green-700 text-sm font-semibold">دارد ✓</span>
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="f-vekalat" id="f-vekalat-no" value="ندارد" checked
                                            class="accent-red-500 w-4 h-4">
                                        <span class="text-red-600 text-sm font-semibold">ندارد ✗</span>
                                    </label>
                                </div>
                                <div class="flex items-center gap-2">
                                    <label class="cursor-pointer bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all">
                                        <i class="fas fa-camera"></i> تصویر وکالت‌نامه
                                        <input type="file" id="f-vekalat-img" accept="image/*" class="hidden"
                                            onchange="EmbassyModule.previewSingleImg(this,'vekalat-preview')">
                                    </label>
                                    <div id="vekalat-preview" class="flex gap-1 flex-wrap"></div>
                                </div>
                            </div>
                        </div>

                        <!-- ارسال و دریافت -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-1">ارسال</label>
                                <div class="flex gap-3">
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="f-send-status" id="f-send-yes" value="ارسال شده"
                                            class="accent-green-500 w-4 h-4">
                                        <span class="text-green-700 text-sm font-semibold">ارسال شده ✓</span>
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="f-send-status" id="f-send-no" value="ارسال نشده" checked
                                            class="accent-red-500 w-4 h-4">
                                        <span class="text-red-600 text-sm font-semibold">ارسال نشده ✗</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-1">دریافت</label>
                                <div class="flex gap-3">
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="f-receive-status" id="f-receive-yes" value="شده"
                                            class="accent-green-500 w-4 h-4">
                                        <span class="text-green-700 text-sm font-semibold">شده ✓</span>
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="f-receive-status" id="f-receive-no" value="نشده" checked
                                            class="accent-red-500 w-4 h-4">
                                        <span class="text-red-600 text-sm font-semibold">نشده ✗</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- پیوست مدارک — فایل‌های موجود + آپلود جدید -->
                        <div class="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                            <h4 class="text-gray-700 text-sm font-bold flex items-center gap-2">
                                <i class="fas fa-paperclip text-green-600"></i>
                                پیوست مدارک
                            </h4>
                            <!-- فایل‌های ذخیره‌شده قبلی -->
                            <div id="f-existing-files" class="flex gap-2 flex-wrap min-h-[4px]"></div>
                            <label class="cursor-pointer inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-xs px-4 py-2 rounded-lg transition-all">
                                <i class="fas fa-upload"></i> افزودن فایل
                                <input type="file" id="f-files" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" class="hidden" multiple
                                    onchange="EmbassyModule.previewFiles(this)">
                            </label>
                            <!-- فایل‌های جدید انتخاب‌شده -->
                            <div id="f-files-preview" class="flex gap-2 flex-wrap"></div>
                        </div>

                        <!-- دکمه‌ها -->
                        <div class="flex gap-3 pt-2">
                            <button type="submit" id="embassy-submit-btn"
                                class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                                <i class="fas fa-save"></i>
                                <span id="embassy-submit-text">ذخیره</span>
                            </button>
                            <button type="button" onclick="EmbassyModule.closeModal()"
                                class="px-6 bg-gray-500 hover:bg-gray-400 text-white font-bold py-3 rounded-xl transition-all">
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

        const rows = records.map((r, i) => `
            <tr class="border-b border-gray-200 hover:bg-yellow-50 transition-colors bg-white">
                <td class="px-3 py-3 text-gray-500 text-xs text-center font-medium">${i + 1}</td>
                <td class="px-3 py-3 font-semibold text-gray-900">${r.student_name}</td>
                <td class="px-3 py-3">
                    <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-lg font-medium">${r.work_type}</span>
                </td>
                <td class="px-3 py-3 text-gray-700 text-sm">${r.receive_date ? (typeof Jalali !== 'undefined' ? Jalali.displayDate(r.receive_date) : r.receive_date) : '—'}</td>
                <td class="px-3 py-3 text-gray-700 text-sm">${r.send_method || '—'}</td>
                <td class="px-3 py-3 text-gray-700 text-sm">${r.send_date ? (typeof Jalali !== 'undefined' ? Jalali.displayDate(r.send_date) : r.send_date) : '—'}</td>

                <!-- اعلام وصول: سبز=دارد | آبی=در انتظار -->
                <td class="px-3 py-3">
                    ${r.acknowledgment
                        ? `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">✓ ${r.acknowledgment}</span>`
                        : `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">در انتظار</span>`}
                </td>

                <!-- تسویه: سبز=تسویه شده | قرمز=نشده -->
                <td class="px-3 py-3">
                    ${(r.settlement_agreed || r.settlement_deposit || r.settlement_final)
                        ? `<div class="space-y-0.5 text-xs">
                            ${r.settlement_agreed  ? `<div class="text-orange-700 font-medium">توافق: ${Number(r.settlement_agreed).toLocaleString('fa-IR')} ت</div>` : ''}
                            ${r.settlement_deposit ? `<div class="text-yellow-700 font-medium">بیعانه: ${Number(r.settlement_deposit).toLocaleString('fa-IR')} ت</div>` : ''}
                            ${r.settlement_final   ? `<span class="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">✓ تسویه: ${Number(r.settlement_final).toLocaleString('fa-IR')} ت</span>` : '<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">در انتظار تسویه</span>'}
                           </div>`
                        : `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">✗ تسویه نشده</span>`}
                </td>

                <!-- کد سجاد -->
                <td class="px-3 py-3 text-gray-900 text-sm font-mono font-semibold">
                    ${r.sajad_code
                        ? r.sajad_code
                        : `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">✗ ندارد</span>`}
                </td>

                <!-- وکالت: سبز=دارد | قرمز=ندارد -->
                <td class="px-3 py-3">
                    ${r.vekalat === 'دارد'
                        ? `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">✓ دارد</span>`
                        : `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">✗ ندارد</span>`}
                </td>

                <!-- ارسال: سبز=شده | آبی=در انتظار | قرمز=نشده -->
                <td class="px-3 py-3">
                    ${r.send_status === 'ارسال شده'
                        ? `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">✓ ارسال شده</span>`
                        : r.send_status === 'در انتظار'
                        ? `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">در انتظار</span>`
                        : `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">✗ ارسال نشده</span>`}
                </td>

                <!-- دریافت: سبز=شده | آبی=در انتظار | قرمز=نشده -->
                <td class="px-3 py-3">
                    ${r.receive_status === 'شده'
                        ? `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">✓ شده</span>`
                        : r.receive_status === 'در انتظار'
                        ? `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">در انتظار</span>`
                        : `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">✗ نشده</span>`}
                </td>

                <!-- فایل‌ها: لینک دانلود | قرمز=آپلود نشده -->
                <td class="px-3 py-3">
                    ${r.file_paths && r.file_paths.length
                        ? r.file_paths.map(p => `<button onclick="EmbassyModule.downloadFile('${p}')" class="block text-blue-600 hover:text-blue-800 text-xs underline truncate max-w-24 font-medium"><i class="fas fa-download ml-1"></i>${p.split('/').pop()}</button>`).join('')
                        : `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">✗ آپلود نشده</span>`}
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
                <table class="w-full text-sm bg-white" style="min-width:1250px">
                    <thead>
                        <tr class="bg-gray-100 text-gray-700 text-xs border-b border-gray-300">
                            <th class="px-3 py-3 text-center font-bold">ردیف</th>
                            <th class="px-3 py-3 text-right font-bold">نام دانشجو</th>
                            <th class="px-3 py-3 text-right font-bold">نوع کار</th>
                            <th class="px-3 py-3 text-right font-bold">تاریخ دریافت</th>
                            <th class="px-3 py-3 text-right font-bold">نحوه ارسال</th>
                            <th class="px-3 py-3 text-right font-bold">تاریخ ارسال</th>
                            <th class="px-3 py-3 text-right font-bold">اعلام وصول</th>
                            <th class="px-3 py-3 text-right font-bold">تسویه</th>
                            <th class="px-3 py-3 text-right font-bold">کد سجاد</th>
                            <th class="px-3 py-3 text-right font-bold">وکالت</th>
                            <th class="px-3 py-3 text-right font-bold">ارسال</th>
                            <th class="px-3 py-3 text-right font-bold">دریافت</th>
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
        // مطمئن شو pickerEl ساخته شده (اگر init صدا نخورده)
        if (typeof JalaliPicker._ensureCreated === 'function') {
            JalaliPicker._ensureCreated();
        }
        var hidden = document.getElementById(hiddenId);
        if (!hidden) return;

        // اگر قبلاً attach شده، مستقیم روی display input کلیک کن
        if (hidden.dataset.pickerReady) {
            var existing = hidden.nextElementSibling;
            if (existing && existing.readOnly) {
                existing.click();
                return;
            }
        }

        // اول display رو visible کن تا _attach بتونه parentNode پیدا کنه
        hidden.style.display = '';
        JalaliPicker._attach(hidden);
        hidden.dataset.pickerReady = '1';

        // بعد از attach، display input اضافه شده
        var pickerDisplay = hidden.nextElementSibling;
        if (pickerDisplay && pickerDisplay.readOnly) {
            pickerDisplay.click();
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

    // ── تنظیم تسویه ─────────────────────────────────────────
    function _setSettlement(btn) {
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
        } else if (_activeQuickFilter === 'not_sent') {
            filtered = filtered.filter(r => r.send_status !== 'ارسال شده');
        } else if (_activeQuickFilter === 'not_acknowledged') {
            filtered = filtered.filter(r => !r.acknowledgment);
        } else if (_activeQuickFilter === 'not_received') {
            filtered = filtered.filter(r => r.receive_status !== 'شده');
        } else if (_activeQuickFilter === 'not_settled') {
            filtered = filtered.filter(r => !r.settlement_final || r.settlement_final === 0);
        } else if (_activeQuickFilter === 'no_vekalat') {
            filtered = filtered.filter(r => r.vekalat !== 'دارد');
        }

        renderTable(filtered);
    }

    // ── مودال افزودن ─────────────────────────────────────────
    function openAddModal() {
        document.getElementById('embassy-edit-id').value = '';
        document.getElementById('embassy-modal-title').textContent = 'ثبت مدرک جدید';
        document.getElementById('embassy-submit-text').textContent = 'ذخیره';
        document.getElementById('embassy-form').reset();
        // ریست لیست فایل‌ها
        _selectedFiles = [];
        _existingFilePaths = [];
        const existingEl = document.getElementById('f-existing-files');
        if (existingEl) existingEl.innerHTML = '';
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
        ['f-files-preview','ack-preview','sajad-code-preview','vekalat-preview'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        // ریست settlement buttons
        document.querySelectorAll('.settle-btn').forEach(b => { b.style.fontWeight=''; b.style.boxShadow=''; });
        var fs = document.getElementById('f-settlement');
        if (fs) fs.value = '';
        // پاک کردن picker state تا دوباره attach بشه
        ['f-receiveDate','f-sendDate'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) delete el.dataset.pickerAttached;
        });
        document.getElementById('embassy-modal').classList.remove('hidden');
        // فعال‌سازی تقویم شمسی روی فیلدهای تاریخ
        setTimeout(function() {
            if (typeof JalaliPicker !== 'undefined') {
                ['f-receiveDate','f-sendDate'].forEach(function(id) {
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
        // وکالت
        const vekalatVal = r.vekalat || 'ندارد';
        const vRadio = document.querySelector(`input[name="f-vekalat"][value="${vekalatVal}"]`);
        if (vRadio) vRadio.checked = true;
        // ارسال
        const sendStatusVal = r.send_status || 'ارسال نشده';
        const sRadio = document.querySelector(`input[name="f-send-status"][value="${sendStatusVal}"]`);
        if (sRadio) sRadio.checked = true;
        // دریافت
        const recvStatusVal = r.receive_status || 'نشده';
        const rRadio = document.querySelector(`input[name="f-receive-status"][value="${recvStatusVal}"]`);
        if (rRadio) rRadio.checked = true;
        // شماره تماس
        const phoneEl = document.getElementById('f-phone');
        if (phoneEl) phoneEl.value = r.phone || '';

        // فایل‌های موجود — با قابلیت حذف
        _selectedFiles = [];
        _existingFilePaths = r.file_paths ? [...r.file_paths] : [];
        const preview = document.getElementById('f-files-preview');
        if (preview) _renderExistingFiles(preview);

        document.getElementById('embassy-modal').classList.remove('hidden');
        // فعال‌سازی تقویم شمسی
        setTimeout(function() {
            if (typeof JalaliPicker !== 'undefined') {
                ['f-receiveDate','f-sendDate'].forEach(function(id) {
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
    // نگه‌داری لیست فایل‌های انتخاب‌شده برای امکان حذف
    let _selectedFiles = [];
    let _existingFilePaths = []; // فایل‌های از قبل ذخیره‌شده در Supabase

    // نمایش فایل‌های موجود (ذخیره‌شده) با دکمه حذف
    function _renderExistingFiles(container) {
        const existing = document.getElementById('f-existing-files');
        if (!existing) return;
        existing.innerHTML = '';
        _existingFilePaths.forEach((path, idx) => {
            const name = path.split('/').pop();
            const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
            const div = document.createElement('div');
            div.className = 'relative group';
            div.innerHTML = `
                <div class="flex items-center gap-1 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg text-xs text-blue-700 relative">
                    <i class="fas ${isImg ? 'fa-image' : 'fa-file'} text-blue-500"></i>
                    <span class="max-w-28 truncate" title="${name}">${name}</span>
                    <button type="button"
                            onclick="EmbassyModule._removeExistingFile(${idx})"
                            class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-700 shadow"
                            title="حذف این فایل">×</button>
                </div>`;
            existing.appendChild(div);
        });
    }

    function _removeExistingFile(idx) {
        _existingFilePaths.splice(idx, 1);
        const existing = document.getElementById('f-existing-files');
        if (existing) _renderExistingFiles(existing);
    }

    function previewFiles(input) {
        // فایل‌های جدید رو به لیست اضافه کن
        Array.from(input.files).forEach(f => _selectedFiles.push(f));
        // input رو reset کن تا بتونه دوباره همون فایل رو انتخاب کنه
        input.value = '';
        _renderSelectedFiles();
    }

    function _renderSelectedFiles() {
        const preview = document.getElementById('f-files-preview');
        if (!preview) return;
        preview.innerHTML = '';
        _selectedFiles.forEach((file, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative group';

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = e => {
                    wrapper.innerHTML = `
                        <img src="${e.target.result}"
                             style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid #16a34a;cursor:pointer;display:block;"
                             title="${file.name}"
                             onclick="window.open('${e.target.result}','_blank')">
                        <button type="button"
                                onclick="EmbassyModule._removeSelectedFile(${idx})"
                                class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-700 shadow"
                                title="حذف">×</button>`;
                };
                reader.readAsDataURL(file);
            } else {
                wrapper.innerHTML = `
                    <div class="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg text-xs text-gray-700 pr-6 relative">
                        <i class="fas fa-file text-green-600"></i>
                        <span class="max-w-24 truncate">${file.name}</span>
                        <span class="text-gray-400">(${(file.size/1024).toFixed(0)} KB)</span>
                        <button type="button"
                                onclick="EmbassyModule._removeSelectedFile(${idx})"
                                class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-700 shadow"
                                title="حذف">×</button>
                    </div>`;
            }
            preview.appendChild(wrapper);
        });
    }

    function _removeSelectedFile(idx) {
        _selectedFiles.splice(idx, 1);
        _renderSelectedFiles();
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

        // آپلود فایل‌ها از _selectedFiles
        const filePaths  = [];
        const recordId   = editId || ('emb_' + Date.now());

        for (const file of _selectedFiles) {
            const path = await uploadFile(file, recordId);
            if (path) filePaths.push(path);
        }
        // اضافه کردن فایل‌های قبلی که حذف نشدن
        const existingPaths = _existingFilePaths.filter(p => p); // فیلتر حذف‌شده‌ها

        const payload = {
            student_name:        document.getElementById('f-studentName').value.trim(),
            work_type:           workTypeValue,
            phone:               document.getElementById('f-phone')?.value.trim() || null,
            receive_date:        document.getElementById('f-receiveDate').value || null,
            send_method:         document.getElementById('f-sendMethod').value  || null,
            send_date:           document.getElementById('f-sendDate').value    || null,
            acknowledgment:      document.getElementById('f-acknowledgment').value.trim() || null,
            settlement_agreed:   parseFloat(document.getElementById('f-settlement-agreed')?.value)  || 0,
            settlement_deposit:  parseFloat(document.getElementById('f-settlement-deposit')?.value) || 0,
            settlement_final:    parseFloat(document.getElementById('f-settlement-final')?.value)   || 0,
            settlement:          document.getElementById('f-currency')?.value || 'تومان',
            sajad_code:          document.getElementById('f-sajadCode').value.trim() || null,
            vekalat:             document.querySelector('input[name="f-vekalat"]:checked')?.value || 'ندارد',
            send_status:         document.querySelector('input[name="f-send-status"]:checked')?.value || 'ارسال نشده',
            receive_status:      document.querySelector('input[name="f-receive-status"]:checked')?.value || 'نشده',
        };

        if (filePaths.length || existingPaths.length) {
            payload.file_paths = [...existingPaths, ...filePaths];
        } else if (editId) {
            // اگر ویرایش است و همه فایل‌ها حذف شدن، آرایه خالی بفرست
            payload.file_paths = [];
        }

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
        _removeSelectedFile,
        _removeExistingFile,
    };

})(); // end EmbassyModule
