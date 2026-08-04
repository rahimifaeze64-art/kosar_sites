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

    // ── ثبت لاگ فعالیت ──────────────────────────────────────
    async function _logActivity(recordId, action, actionLabel, changedFields) {
        try {
            const client = sb(); if (!client) return;
            const u = currentUser();

            // بروزرسانی ستون‌های خلاصه در رکورد اصلی
            const { error: updateErr } = await client.from(TABLE).update({
                updated_by:      u.id   || null,
                updated_by_name: u.name || null,
                last_action:     actionLabel,
            }).eq('id', recordId);
            if (updateErr) {
                // اگر ستون‌ها هنوز نیستن (migration اجرا نشده) skip کن
                console.warn('Embassy: updated_by columns missing — run embassy_v4_migration.sql');
            }

            // ثبت در جدول لاگ (اگر جدول وجود داشت)
            const { error: logErr } = await client.from('embassy_activity_log').insert([{
                record_id:      recordId,
                user_id:        u.id   || null,
                user_name:      u.name || null,
                action,
                action_label:   actionLabel,
                changed_fields: Array.isArray(changedFields) ? changedFields : [],
            }]);
            if (logErr && logErr.code !== '42P01') { // 42P01 = table not found
                console.warn('Embassy logActivity:', logErr.message);
            }
        } catch (e) {
            console.warn('Embassy logActivity error:', e);
        }
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
                        <span class="bg-lime-500 bg-opacity-20 p-2 rounded-xl">
                            <i class="fas fa-landmark text-lime-400"></i>
                        </span>
                        سفارت - مدیریت مدارک دانشجویان
                    </h2>
                    <p class="text-black-400 text-sm mt-1">مدیریت مدارک سفارتخانه‌ای دانشجویان</p>
                </div>
                <div class="flex gap-3 items-center">
                <button onclick="EmbassyModule.openAddModal()"
                    class="bg-lime-500 hover:bg-lime-400 text-gray-900 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg">
                    <i class="fas fa-plus"></i> ثبت مدرک جدید
                </button>
                <button onclick="EmbassyModule.goToTranslationOffice()"
                    class="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg">
                    <i class="fas fa-language"></i> دارالترجمه
                </button>
                </div>
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
                        class="quick-filter-btn text-xs px-3 py-1.5 rounded-full border border-blue-400 text-black-600 bg-blue-50 hover:bg-blue-100 transition-all">
                        <i class="fas fa-list ml-1"></i>همه
                    </button>
                </div>
            </div>

            <!-- لودینگ -->
            <div id="embassy-loading" class="text-center py-12">
                <i class="fas fa-spinner fa-spin text-3xl text-lime-400"></i>
                <p class="text-black-400 mt-3">در حال بارگذاری...</p>
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
                                                    class="status-btn flex-1 text-xs py-1.5 rounded-lg bg-blue-100 text-black-700 border border-blue-300 hover:bg-blue-200 transition-all">
                                                    ترجمه
                                                </button>
                                                <button type="button" data-status="تصدیق"
                                                    onclick="EmbassyModule._setStatus(this,'${key}','تصدیق')"
                                                    class="status-btn flex-1 text-xs py-1.5 rounded-lg bg-lime-100 text-lime-700 border border-lime-300 hover:bg-lime-200 transition-all">
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
                                <div class="space-y-2">
                                    <!-- دکمه‌های سریع -->
                                    <div class="flex gap-1">
                                        <button type="button" onclick="EmbassyModule._setQuickDate('f-receiveDate','f-receiveDate-disp',-1)"
                                            class="flex-1 text-xs py-1.5 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-black-700 border border-gray-200 transition-all">دیروز</button>
                                        <button type="button" onclick="EmbassyModule._setQuickDate('f-receiveDate','f-receiveDate-disp',0)"
                                            class="flex-1 text-xs py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white border border-blue-500 transition-all font-bold">امروز</button>
                                        <button type="button" onclick="EmbassyModule._setQuickDate('f-receiveDate','f-receiveDate-disp',1)"
                                            class="flex-1 text-xs py-1.5 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-black-700 border border-gray-200 transition-all">فردا</button>
                                    </div>
                                    <!-- نمایش تاریخ انتخاب‌شده + باز کردن تقویم -->
                                    <div class="relative">
                                        <input type="hidden" id="f-receiveDate">
                                        <button type="button" id="f-receiveDate-disp"
                                            onclick="EmbassyModule._openJalaliPicker('f-receiveDate','f-receiveDate-disp')"
                                            class="w-full text-right bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none focus:border-green-500 flex items-center justify-between">
                                            <span>انتخاب از تقویم</span>
                                            <i class="fas fa-calendar-alt text-gray-400"></i>
                                        </button>
                                    </div>
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
                                <div class="space-y-2">
                                    <div class="flex gap-1">
                                        <button type="button" onclick="EmbassyModule._setQuickDate('f-sendDate','f-sendDate-disp',-1)"
                                            class="flex-1 text-xs py-1.5 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-black-700 border border-gray-200 transition-all">دیروز</button>
                                        <button type="button" onclick="EmbassyModule._setQuickDate('f-sendDate','f-sendDate-disp',0)"
                                            class="flex-1 text-xs py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white border border-blue-500 transition-all font-bold">امروز</button>
                                        <button type="button" onclick="EmbassyModule._setQuickDate('f-sendDate','f-sendDate-disp',1)"
                                            class="flex-1 text-xs py-1.5 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-black-700 border border-gray-200 transition-all">فردا</button>
                                    </div>
                                    <div class="relative">
                                        <input type="hidden" id="f-sendDate">
                                        <button type="button" id="f-sendDate-disp"
                                            onclick="EmbassyModule._openJalaliPicker('f-sendDate','f-sendDate-disp')"
                                            class="w-full text-right bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none focus:border-green-500 flex items-center justify-between">
                                            <span>انتخاب از تقویم</span>
                                            <i class="fas fa-calendar-alt text-gray-400"></i>
                                        </button>
                                    </div>
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

                        <!-- ردیف چهارم — تسویه چندمرحله‌ای -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-2">تسویه</label>
                                <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-4" id="settlement-container">

                                    <!-- ۱. مبلغ مورد اتفاق -->
                                    <div>
                                        <div class="flex items-center justify-between mb-1">
                                            <label class="text-orange-600 text-xs font-semibold">
                                                <i class="fas fa-handshake ml-1"></i>۱. مبلغ مورد اتفاق
                                            </label>
                                            <button type="button" onclick="EmbassyModule._addPaymentRow('agreed-list','agreed')"
                                                class="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1">
                                                <i class="fas fa-plus-circle"></i>افزودن مرحله
                                            </button>
                                        </div>
                                        <div id="agreed-list" class="space-y-1.5"></div>
                                    </div>

                                    <!-- ۲. بیعانه -->
                                    <div>
                                        <div class="flex items-center justify-between mb-1">
                                            <label class="text-lime-600 text-xs font-semibold">
                                                <i class="fas fa-money-bill ml-1"></i>۲. بیعانه
                                            </label>
                                            <button type="button" onclick="EmbassyModule._addPaymentRow('deposit-list','deposit')"
                                                class="text-xs text-lime-600 hover:text-lime-800 flex items-center gap-1">
                                                <i class="fas fa-plus-circle"></i>افزودن مرحله
                                            </button>
                                        </div>
                                        <div id="deposit-list" class="space-y-1.5"></div>
                                    </div>

                                    <!-- ۳. تسویه نهایی -->
                                    <div>
                                        <div class="flex items-center justify-between mb-1">
                                            <label class="text-green-700 text-xs font-semibold">
                                                <i class="fas fa-check-circle ml-1"></i>۳. تسویه نهایی
                                            </label>
                                            <button type="button" onclick="EmbassyModule._addPaymentRow('final-list','final')"
                                                class="text-xs text-green-700 hover:text-green-900 flex items-center gap-1">
                                                <i class="fas fa-plus-circle"></i>افزودن مرحله
                                            </button>
                                        </div>
                                        <div id="final-list" class="space-y-1.5"></div>
                                    </div>
                                </div>
                                <!-- hidden inputs برای سازگاری با payload قبلی -->
                                <input type="hidden" id="f-settlement-agreed">
                                <input type="hidden" id="f-settlement-deposit">
                                <input type="hidden" id="f-settlement-final">
                                <input type="hidden" id="f-currency" value="تومان">
                                <input type="hidden" id="f-settlement" value="">
                            </div>
                            <div>
                                <label class="text-gray-700 text-sm font-semibold block mb-1">کد سجاد</label>
                                <input type="text" id="f-sajadCode"
                                    class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500 mb-2"
                                    placeholder="کد سجاد دانشجو">
                                <div class="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                        <label class="text-gray-600 text-xs font-medium block mb-1">
                                            <i class="fas fa-envelope ml-1 text-black-500"></i>ایمیل سجاد
                                        </label>
                                        <input type="email" id="f-sajadEmail"
                                            class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                            placeholder="email@example.com" dir="ltr">
                                    </div>
                                    <div>
                                        <label class="text-gray-600 text-xs font-medium block mb-1">
                                            <i class="fas fa-lock ml-1 text-orange-500"></i>رمز عبور سجاد
                                        </label>
                                        <input type="text" id="f-sajadPassword"
                                            class="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                                            placeholder="رمز عبور" dir="ltr">
                                    </div>
                                </div>
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

                        <!-- آپلود پاسپورت (توسط کارمند) -->
                        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                            <h4 class="text-gray-700 text-sm font-bold flex items-center gap-2">
                                <i class="fas fa-passport text-blue-600"></i>
                                پاسپورت دانشجو
                                <span class="text-xs text-blue-500 font-normal">(توسط کارمند بارگذاری می‌شود)</span>
                            </h4>
                            <div id="f-passport-existing" class="flex gap-2 flex-wrap min-h-[4px]"></div>
                            <label class="cursor-pointer inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg transition-all">
                                <i class="fas fa-upload"></i> بارگذاری پاسپورت
                                <input type="file" id="f-passport" accept=".pdf,.jpg,.jpeg,.png" class="hidden" multiple
                                    onchange="EmbassyModule.previewPassport(this)">
                            </label>
                            <div id="f-passport-preview" class="flex gap-2 flex-wrap"></div>
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
                    <p class="text-black-400 mb-6" id="embassy-confirm-text">آیا مطمئن هستید؟</p>
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
                    <i class="fas fa-folder-open text-5xl text-black-400 mb-4 opacity-40"></i>
                    <p class="text-black-400 text-lg">هیچ رکوردی ثبت نشده</p>
                    <p class="text-gray-400 text-sm mt-1">روی «ثبت مدرک جدید» کلیک کنید</p>
                </div>`;
            return;
        }

        const rows = records.map((r, i) => `
            <tr class="border-b border-gray-200 hover:bg-lime-50 transition-colors bg-white">
                <td class="px-3 py-3 text-gray-500 text-xs text-center font-medium">${i + 1}</td>
                <td class="px-3 py-3 font-semibold text-gray-900">${r.student_name}</td>
                <td class="px-3 py-3">
                    <span class="bg-blue-100 text-black-800 text-xs px-2 py-1 rounded-lg font-medium">${r.work_type}</span>
                </td>
                <td class="px-3 py-3 text-gray-700 text-sm">${r.receive_date ? (typeof Jalali !== 'undefined' ? Jalali.displayDate(r.receive_date) : r.receive_date) : '—'}</td>
                <td class="px-3 py-3 text-gray-700 text-sm">${r.send_method || '—'}</td>
                <td class="px-3 py-3 text-gray-700 text-sm">${r.send_date ? (typeof Jalali !== 'undefined' ? Jalali.displayDate(r.send_date) : r.send_date) : '—'}</td>

                <!-- اعلام وصول: سبز=دارد | آبی=در انتظار -->
                <td class="px-3 py-3">
                    ${r.acknowledgment
                        ? `<span style="background:#dcfce7;color:#15803d;font-size:11px;padding:2px 8px;border-radius:8px;font-weight:700;">✓ ${r.acknowledgment}</span>`
                        : `<span style="background:#dbeafe;color:#1d4ed8;font-size:11px;padding:2px 8px;border-radius:8px;font-weight:500;">در انتظار</span>`}
                </td>

                <!-- تسویه: سبز=تسویه شده | قرمز=نشده -->
                <td class="px-3 py-3">
                    ${(() => {
                        const agreed  = r.settlement_agreed_list  && r.settlement_agreed_list.length  ? r.settlement_agreed_list  : (r.settlement_agreed  > 0 ? [{amount: r.settlement_agreed,  currency: r.settlement||'تومان'}] : []);
                        const deposit = r.settlement_deposit_list && r.settlement_deposit_list.length ? r.settlement_deposit_list : (r.settlement_deposit > 0 ? [{amount: r.settlement_deposit, currency: r.settlement||'تومان'}] : []);
                        const final_  = r.settlement_final_list   && r.settlement_final_list.length   ? r.settlement_final_list   : (r.settlement_final   > 0 ? [{amount: r.settlement_final,   currency: r.settlement||'تومان'}] : []);

                        if (!agreed.length && !deposit.length && !final_.length) {
                            return '<span style="background:#fee2e2;color:#b91c1c;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">✗ تسویه نشده</span>';
                        }
                        const fmt = (p) => {
                            const amt = Number(p.amount).toLocaleString(p.currency === 'تومان' ? 'fa-IR' : 'en');
                            if (p.currency === 'دلار')  return `$${amt}`;
                            if (p.currency === 'دینار') return `${amt} دینار`;
                            return `${Number(p.amount).toLocaleString('fa-IR')} ت`;
                        };
                        const rows = [];
                        if (agreed.length)  rows.push(`<div style="color:#c2410c;font-size:11px;">توافق: ${agreed.map(fmt).join(' + ')}</div>`);
                        if (deposit.length) rows.push(`<div style="color:#92400e;font-size:11px;">بیعانه: ${deposit.map(fmt).join(' + ')}</div>`);
                        if (final_.length)  rows.push(`<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">✓ تسویه: ${final_.map(fmt).join(' + ')}</span>`);
                        else                rows.push(`<span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:999px;font-size:11px;">در انتظار تسویه</span>`);
                        return `<div style="display:flex;flex-direction:column;gap:2px;">${rows.join('')}</div>`;
                    })()}
                </td>

                <!-- کد سجاد -->
                <td class="px-3 py-3 text-gray-900 text-sm font-mono font-semibold">
                    ${r.sajad_code
                        ? r.sajad_code
                        : `<span style="background:#fee2e2;color:#b91c1c;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">✗ ندارد</span>`}
                </td>

                <!-- وکالت: سبز=دارد | قرمز=ندارد -->
                <td class="px-3 py-3">
                    ${r.vekalat === 'دارد'
                        ? `<span style="background:#dcfce7;color:#15803d;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">✓ دارد</span>`
                        : `<span style="background:#fee2e2;color:#b91c1c;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">✗ ندارد</span>`}
                </td>

                <!-- ارسال: سبز=شده | آبی=در انتظار | قرمز=نشده -->
                <td class="px-3 py-3">
                    ${r.send_status === 'ارسال شده'
                        ? `<span style="background:#dcfce7;color:#15803d;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">✓ ارسال شده</span>`
                        : r.send_status === 'در انتظار'
                        ? `<span style="background:#dbeafe;color:#1d4ed8;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:500;">در انتظار</span>`
                        : `<span style="background:#fee2e2;color:#b91c1c;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">✗ ارسال نشده</span>`}
                </td>

                <!-- دریافت: سبز=شده | آبی=در انتظار | قرمز=نشده -->
                <td class="px-3 py-3">
                    ${r.receive_status === 'شده'
                        ? `<span style="background:#dcfce7;color:#15803d;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">✓ شده</span>`
                        : r.receive_status === 'در انتظار'
                        ? `<span style="background:#dbeafe;color:#1d4ed8;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:500;">در انتظار</span>`
                        : `<span style="background:#fee2e2;color:#b91c1c;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">✗ نشده</span>`}
                </td>

                <!-- فایل‌ها: لینک دانلود | قرمز=آپلود نشده -->
                <td class="px-3 py-3">
                    ${r.file_paths && r.file_paths.length
                        ? r.file_paths.map(p => `<button onclick="EmbassyModule.downloadFile('${p}')" style="display:block;color:#2563eb;font-size:11px;text-decoration:underline;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;background:none;border:none;cursor:pointer;"><i class="fas fa-download" style="margin-left:4px;"></i>${p.split('/').pop()}</button>`).join('')
                        : `<span style="background:#fee2e2;color:#b91c1c;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">✗ آپلود نشده</span>`}
                </td>

                <td class="px-3 py-3 text-gray-500 text-xs">
                    <div>${r.updated_at ? (typeof Jalali!=='undefined' ? Jalali.toJalaliDateTime(r.updated_at) : new Date(r.updated_at).toLocaleDateString('fa-IR')) : '—'}</div>
                    ${r.updated_by_name ? `<div class="text-black-600 text-xs mt-0.5">توسط: ${r.updated_by_name}</div>` : ''}
                    ${r.last_action ? `<div class="text-gray-400 text-xs">${r.last_action}</div>` : ''}
                    <button onclick="EmbassyModule.showActivityLog('${r.id}')"
                        class="mt-1 text-xs bg-blue-50 hover:bg-blue-100 text-black-600 px-2 py-0.5 rounded-full border border-blue-200 transition-all">
                        <i class="fas fa-history ml-1"></i>جزئیات
                    </button>
                </td>
                <td class="px-3 py-3 text-xs text-gray-600 font-medium">${r.created_by_name || '—'}</td>
                <td class="px-3 py-3">
                    <div class="flex gap-2">
                        <button onclick="EmbassyModule.openEditModal('${r.id}')"
                            class="bg-lime-500 hover:bg-lime-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
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
            if (chkCircle) chkCircle.innerHTML = '<i class="fas fa-check text-xs text-black-400"></i>';
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

    // ── تنظیم تاریخ سریع (دیروز/امروز/فردا) ─────────────────
    // helper: تاریخ امروز با timezone ایران — کم کردن ۳ روز برای تصحیح
    function _iranToday() {
        try {
            var formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Tehran',
                year:  'numeric', month: '2-digit', day: '2-digit',
                hour:  '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            });
            var parts = formatter.formatToParts(new Date());
            var p = {};
            parts.forEach(function(pt) { p[pt.type] = pt.value; });
            var d = new Date(p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + ':' + p.second);
            // تصحیح ۳ روز
            d.setDate(d.getDate() - 3);
            return d;
        } catch(e) {
            var d2 = new Date();
            d2.setDate(d2.getDate() - 3);
            return d2;
        }
    }

    function _setQuickDate(hiddenId, dispBtnId, offset) {
        var d = _iranToday();
        d.setDate(d.getDate() + offset);
        var jStr = (typeof Jalali !== 'undefined') ? Jalali.toJalaliISO(d) : _gToJISO(d);
        var hidden = document.getElementById(hiddenId);
        var dispBtn = document.getElementById(dispBtnId);
        if (hidden) hidden.value = jStr;
        if (dispBtn) {
            var labels = {'-1':'دیروز', '0':'امروز', '1':'فردا'};
            var display = (typeof Jalali !== 'undefined') ? Jalali.toJalaliDisplay(d) : jStr;
            dispBtn.querySelector('span').textContent = display + ' (' + (labels[String(offset)] || '') + ')';
            dispBtn.classList.add('border-green-500');
            dispBtn.classList.remove('text-gray-500');
            dispBtn.querySelector('span').classList.add('text-green-700');
            dispBtn.querySelector('span').classList.remove('text-gray-500');
        }
        // هایلایت دکمه انتخاب‌شده — حذف active از بقیه
        var container = document.getElementById(dispBtnId)?.closest('.space-y-2');
        if (container) {
            container.querySelectorAll('button[onclick*="_setQuickDate"]').forEach(function(btn) {
                btn.classList.remove('bg-green-500','text-white','border-green-500','font-bold');
                btn.classList.add('bg-gray-100','text-gray-600','border-gray-200');
            });
            // پیدا کردن دکمه‌ای که همین offset رو داره
            container.querySelectorAll('button[onclick*="_setQuickDate"]').forEach(function(btn) {
                if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(',' + offset + ')')) {
                    btn.classList.add('bg-green-500','text-white','border-green-500','font-bold');
                    btn.classList.remove('bg-gray-100','text-gray-600','border-gray-200');
                }
            });
        }
    }

    // ── تقویم شمسی ساده (grid انتخاب روز از ماه) ─────────────
    function _openJalaliPicker(hiddenId, dispBtnId) {
        // حذف picker قبلی اگر باز باشه
        var old = document.getElementById('__emb-cal-popup');
        if (old) { old.remove(); if (old.dataset.for === hiddenId) return; }

        var hidden = document.getElementById(hiddenId);
        var dispBtn = document.getElementById(dispBtnId);
        if (!hidden || !dispBtn) return;

        // تاریخ امروز با timezone ایران
        var today = _iranToday();
        var jToday = (typeof Jalali !== 'undefined') ? Jalali.toJalaali(today.getFullYear(), today.getMonth()+1, today.getDate()) : {jy:1405,jm:1,jd:1};

        // اگر مقدار قبلی داره، از آن شروع کن
        var initY = jToday.jy, initM = jToday.jm;
        if (hidden.value) {
            var p = hidden.value.split('-');
            if (p.length === 3) { initY = parseInt(p[0]); initM = parseInt(p[1]); }
        }

        var popup = document.createElement('div');
        popup.id = '__emb-cal-popup';
        popup.dataset.for = hiddenId;
        popup.style.cssText = 'position:fixed;z-index:99999;background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,0.18);min-width:260px;direction:rtl;font-family:Vazirmatn,sans-serif;';
        document.body.appendChild(popup);

        // position زیر دکمه
        var rect = dispBtn.getBoundingClientRect();
        popup.style.top = (rect.bottom + window.scrollY + 4) + 'px';
        var left = rect.left + window.scrollX;
        if (left + 270 > window.innerWidth) left = window.innerWidth - 275;
        popup.style.left = left + 'px';

        _renderCalPopup(hiddenId, dispBtnId, initY, initM, jToday);

        // بستن با کلیک خارج
        setTimeout(function() {
            document.addEventListener('click', function closeOnOut(e) {
                var p2 = document.getElementById('__emb-cal-popup');
                if (p2 && !p2.contains(e.target) && e.target !== dispBtn) {
                    p2.remove();
                    document.removeEventListener('click', closeOnOut);
                }
            });
        }, 10);
    }

    function _renderCalPopup(hiddenId, dispBtnId, jy, jm, jToday) {
        var popup = document.getElementById('__emb-cal-popup');
        if (!popup) return;
        var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
        var daysInMonth = (jm <= 6) ? 31 : (jm <= 11) ? 30 : 29;
        var prevM = jm === 1 ? 12 : jm - 1, prevY = jm === 1 ? jy - 1 : jy;
        var nextM = jm === 12 ? 1 : jm + 1, nextY = jm === 12 ? jy + 1 : jy;

        // روز اول هفته
        var g1 = (typeof Jalali !== 'undefined') ? Jalali.toGregorian(jy, jm, 1) : {gy:2024,gm:1,gd:1};
        var d1 = new Date(g1.gy, g1.gm - 1, g1.gd).getDay();
        var startOffset = (d1 + 1) % 7;

        var selectedVal = (document.getElementById(hiddenId)||{}).value || '';
        var selParts = selectedVal.split('-');
        var selD = (selParts.length===3 && parseInt(selParts[0])===jy && parseInt(selParts[1])===jm) ? parseInt(selParts[2]) : 0;

        var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
        html += '<button onclick="EmbassyModule._renderCalPopup(\''+hiddenId+'\',\''+dispBtnId+'\','+prevY+','+prevM+',{jy:'+jToday.jy+',jm:'+jToday.jm+',jd:'+jToday.jd+'})" style="background:none;border:none;cursor:pointer;font-size:18px;color:#6b7280;padding:2px 6px;">›</button>';
        html += '<div style="font-size:13px;font-weight:700;color:#111;">' + MONTHS[jm-1] + ' ' + jy + '</div>';
        html += '<button onclick="EmbassyModule._renderCalPopup(\''+hiddenId+'\',\''+dispBtnId+'\','+nextY+','+nextM+',{jy:'+jToday.jy+',jm:'+jToday.jm+',jd:'+jToday.jd+'})" style="background:none;border:none;cursor:pointer;font-size:18px;color:#6b7280;padding:2px 6px;">‹</button>';
        html += '</div>';

        // سرستون روزهای هفته
        html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;">';
        ['ش','ی','د','س','چ','پ','ج'].forEach(function(n) {
            html += '<div style="text-align:center;font-size:10px;color:#9ca3af;padding:2px 0;">' + n + '</div>';
        });
        html += '</div>';

        html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">';
        for (var e2 = 0; e2 < startOffset; e2++) html += '<div></div>';
        for (var day = 1; day <= daysInMonth; day++) {
            var isToday = (jToday.jy===jy && jToday.jm===jm && jToday.jd===day);
            var isSel = selD === day;
            var isFri = ((startOffset + day - 1) % 7) === 6;
            var bg = isSel ? '#3b82f6' : isToday ? '#dbeafe' : 'transparent';
            var col = isSel ? '#fff' : isFri ? '#ef4444' : '#111';
            var brd = isToday && !isSel ? '1px solid #3b82f6' : '1px solid transparent';
            html += '<button type="button" onclick="EmbassyModule._pickCalDate(\''+hiddenId+'\',\''+dispBtnId+'\','+jy+','+jm+','+day+')"'
                  + ' style="background:'+bg+';color:'+col+';border:'+brd+';border-radius:6px;padding:5px 0;font-size:12px;cursor:pointer;text-align:center;">'
                  + day + '</button>';
        }
        html += '</div>';
        html += '<div style="display:flex;gap:4px;margin-top:8px;">';
        html += '<button type="button" onclick="EmbassyModule._setQuickDate(\''+hiddenId+'\',\''+dispBtnId+'\',0);document.getElementById(\'__emb-cal-popup\').remove();" style="flex:1;background:#3b82f6;color:#fff;border:none;border-radius:8px;padding:5px;font-size:11px;cursor:pointer;">امروز</button>';
        html += '<button type="button" onclick="document.getElementById(\'__emb-cal-popup\').remove();" style="flex:1;background:#f3f4f6;color:#374151;border:none;border-radius:8px;padding:5px;font-size:11px;cursor:pointer;">بستن</button>';
        html += '</div>';

        popup.innerHTML = html;
    }

    function _pickCalDate(hiddenId, dispBtnId, jy, jm, jd) {
        var hidden = document.getElementById(hiddenId);
        var dispBtn = document.getElementById(dispBtnId);
        var pad = function(n) { return n < 10 ? '0'+n : String(n); };
        var jStr = jy + '-' + pad(jm) + '-' + pad(jd);
        if (hidden) hidden.value = jStr;
        if (dispBtn) {
            var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
            var txt = jd + ' ' + MONTHS[jm-1] + ' ' + jy;
            dispBtn.querySelector('span').textContent = txt;
            dispBtn.querySelector('span').classList.add('text-green-700');
            dispBtn.querySelector('span').classList.remove('text-gray-500');
            dispBtn.classList.add('border-green-500');
        }
        var p = document.getElementById('__emb-cal-popup');
        if (p) p.remove();
    }

    // helper fallback اگر Jalali.js لود نشده
    function _gToJISO(date) {
        // تقریب ساده — در پروژه همیشه Jalali موجوده
        return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
    }

    // تاریخ امروز با timezone ایران — روش دقیق با Intl
    function _iranNow() {
        return _iranToday(); // از همان تابع استفاده کن
    }

    // ── توابع تسویه چندمرحله‌ای ──────────────────────────────

    // اضافه کردن یه ردیف پرداخت جدید
    function _addPaymentRow(listId, type, amount, currency) {
        var list = document.getElementById(listId);
        if (!list) return;
        var row = document.createElement('div');
        row.className = 'flex gap-1 items-center payment-row';
        row.innerHTML = `
            <input type="number" min="0" step="1" placeholder="مبلغ"
                   value="${amount || ''}"
                   class="flex-1 bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400">
            <select class="bg-white text-gray-700 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none" style="min-width:56px">
                <option value="تومان" ${(!currency || currency==='تومان')?'selected':''}>تومان</option>
                <option value="دلار"  ${currency==='دلار'?'selected':''}>دلار</option>
                <option value="دینار" ${currency==='دینار'?'selected':''}>دینار</option>
            </select>
            <button type="button" onclick="this.closest('.payment-row').remove()"
                    class="text-red-400 hover:text-red-600 text-lg leading-none px-1">×</button>`;
        list.appendChild(row);
    }

    // جمع مبالغ یه نوع (برای backward-compat با فیلد عددی قدیمی)
    function _sumPayments(listId, currency) {
        var list = document.getElementById(listId);
        if (!list) return 0;
        var total = 0;
        list.querySelectorAll('.payment-row').forEach(function(row) {
            var cur = row.querySelector('select')?.value || 'تومان';
            if (!currency || cur === currency) {
                total += parseFloat(row.querySelector('input')?.value || 0);
            }
        });
        return total;
    }

    // خواندن همه پرداخت‌های یه نوع به صورت آرایه {amount, currency}
    function _getPayments(listId) {
        var list = document.getElementById(listId);
        if (!list) return [];
        var result = [];
        list.querySelectorAll('.payment-row').forEach(function(row) {
            var amt = parseFloat(row.querySelector('input')?.value || 0);
            var cur = row.querySelector('select')?.value || 'تومان';
            if (amt > 0) result.push({amount: amt, currency: cur});
        });
        return result;
    }

    // پر کردن لیست پرداخت‌ها هنگام ویرایش
    function _loadPayments(listId, payments, fallbackAmount, fallbackCurrency) {
        var list = document.getElementById(listId);
        if (!list) return;
        list.innerHTML = '';
        if (payments && payments.length) {
            payments.forEach(function(p) {
                _addPaymentRow(listId, '', p.amount, p.currency);
            });
        } else if (fallbackAmount && parseFloat(fallbackAmount) > 0) {
            _addPaymentRow(listId, '', fallbackAmount, fallbackCurrency || 'تومان');
        } else {
            _addPaymentRow(listId, '');
        }
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
            b.classList.remove('active-currency','border-2','border-blue-500','text-black-700','bg-blue-50','font-bold');
            b.classList.add('border','border-gray-300','text-gray-600','bg-white');
        });
        btn.classList.add('active-currency','border-2','border-blue-500','text-black-700','bg-blue-50','font-bold');
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

    // ── پیش‌نمایش تصویر کوچک (با قابلیت حذف) ────────────────
    function previewSingleImg(input, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        Array.from(input.files).forEach(file => {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative inline-block';

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = e => {
                    wrapper.innerHTML = `
                        <img src="${e.target.result}"
                             style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid #3b82f6;cursor:pointer;display:block;"
                             title="${file.name}"
                             onclick="window.open('${e.target.result}','_blank')">
                        <button type="button"
                                onclick="this.closest('.relative').remove()"
                                style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;background:#dc2626;color:#fff;border:none;border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;font-weight:bold;"
                                title="حذف">×</button>`;
                };
                reader.readAsDataURL(file);
            } else {
                wrapper.innerHTML = `
                    <div style="position:relative;display:inline-flex;align-items:center;gap:4px;background:#f3f4f6;border-radius:8px;padding:4px 8px;font-size:12px;color:#374151;">
                        <i class="fas fa-file" style="color:#3b82f6;"></i>
                        <span style="max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</span>
                        <button type="button"
                                onclick="this.closest('.relative').remove()"
                                style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;background:#dc2626;color:#fff;border:none;border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:bold;"
                                title="حذف">×</button>
                    </div>`;
            }
            container.appendChild(wrapper);
        });
        // reset input تا بشه دوباره همون فایل رو انتخاب کرد
        input.value = '';
    }

    // ── فیلتر سریع ───────────────────────────────────────
    let _activeQuickFilter = '';
    function applyQuickFilter(filterKey) {
        _activeQuickFilter = filterKey;
        // هایلایت دکمه
        document.querySelectorAll('.quick-filter-btn').forEach(b => {
            b.classList.remove('bg-red-100','border-red-400','text-red-700','bg-blue-50','border-blue-400','text-black-600');
            b.classList.add('border-gray-300','text-gray-600');
        });
        const activeBtn = document.getElementById('qf-' + (filterKey || 'all'));
        if (activeBtn) {
            activeBtn.classList.remove('border-gray-300','text-gray-600');
            if (filterKey) activeBtn.classList.add('bg-red-100','border-red-400','text-red-700');
            else activeBtn.classList.add('bg-blue-50','border-blue-400','text-black-600');
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
        // ریست تسویه
        ['agreed-list','deposit-list','final-list'].forEach(function(id) {
            _addPaymentRow(id, '');
        });
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
        // اول همه رو reset کن
        document.querySelectorAll('.doc-card').forEach(function(card) {
            card.dataset.checked = 'false';
            card.style.borderColor = 'transparent';
            card.style.background = 'rgba(255,255,255,0.05)';
            var key = card.dataset.key;
            var sd = document.getElementById('status-' + key);
            if (sd) sd.classList.add('hidden');
            var chk = document.getElementById('chk-' + key);
            if (chk) chk.innerHTML = '';
            var cb = card.querySelector('.doc-type-check');
            if (cb) cb.checked = false;
        });
        if (r.work_type) {
            r.work_type.split('، ').forEach(function(part) {
                var match = part.match(/^(.+?)\s*\((.+?)\)$/);
                var label = match ? match[1].trim() : part.trim();
                var status = match ? match[2].trim() : '';
                document.querySelectorAll('.doc-card').forEach(function(card) {
                    var cardLabel = card.dataset.label;
                    var cardKey   = card.dataset.key;
                    var isMatch   = cardLabel === label ||
                                    (cardKey === 'sayer' && !['مباشره','قبول نهایی','مدرک کارشناسی','مدرک ارشد','مدرک دکتری','مجلد','وکالت‌نامه','کارشناسی','ارشد','دکتری'].includes(label));
                    if (!isMatch) return;

                    // فعال کردن card
                    card.dataset.checked = 'true';
                    card.style.borderColor = '#3b82f6';
                    card.style.background = 'rgba(59,130,246,0.15)';
                    var chk = document.getElementById('chk-' + cardKey);
                    if (chk) chk.innerHTML = '<i class="fas fa-check text-xs text-black-400"></i>';
                    var cb = card.querySelector('.doc-type-check');
                    if (cb) cb.checked = true;

                    // نمایش status panel
                    var sd = document.getElementById('status-' + cardKey);
                    if (sd) {
                        sd.classList.remove('hidden');
                        // ست کردن وضعیت
                        var targetStatus = status || 'هردو';
                        var hidInp = document.getElementById('hid-status-' + cardKey);
                        if (hidInp) hidInp.value = targetStatus;
                        sd.querySelectorAll('.status-btn').forEach(function(b) {
                            b.classList.remove('active-status','border-2','font-bold');
                            if (b.dataset.status === targetStatus) {
                                b.classList.add('active-status','border-2','font-bold');
                            }
                        });
                    }
                    if (cardKey === 'sayer') {
                        var ct2 = document.getElementById('sayer-custom-text');
                        if (ct2) ct2.value = label;
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
        // بارگذاری تسویه چندمرحله‌ای
        const cur = r.settlement || 'تومان';
        _loadPayments('agreed-list',  r.settlement_agreed_list,  r.settlement_agreed,  cur);
        _loadPayments('deposit-list', r.settlement_deposit_list, r.settlement_deposit, cur);
        _loadPayments('final-list',   r.settlement_final_list,   r.settlement_final,   cur);
        document.getElementById('f-sajadCode').value        = r.sajad_code         || '';
        const sajadEmailEl = document.getElementById('f-sajadEmail');
        const sajadPassEl  = document.getElementById('f-sajadPassword');
        if (sajadEmailEl) sajadEmailEl.value    = r.sajad_email    || '';
        if (sajadPassEl)  sajadPassEl.value     = r.sajad_password || '';
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
                <div class="flex items-center gap-1 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg text-xs text-black-700 relative">
                    <i class="fas ${isImg ? 'fa-image' : 'fa-file'} text-black-500"></i>
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
            settlement_agreed:   parseFloat(document.getElementById('f-settlement-agreed')?.value)  || _sumPayments('agreed-list',  'تومان'),
            settlement_deposit:  parseFloat(document.getElementById('f-settlement-deposit')?.value) || _sumPayments('deposit-list', 'تومان'),
            settlement_final:    parseFloat(document.getElementById('f-settlement-final')?.value)   || _sumPayments('final-list',   'تومان'),
            settlement:          'تومان',
            // لیست‌های چندمرحله‌ای
            settlement_agreed_list:  _getPayments('agreed-list'),
            settlement_deposit_list: _getPayments('deposit-list'),
            settlement_final_list:   _getPayments('final-list'),
            sajad_code:          document.getElementById('f-sajadCode').value.trim() || null,
            sajad_email:         document.getElementById('f-sajadEmail')?.value.trim() || null,
            sajad_password:      document.getElementById('f-sajadPassword')?.value.trim() || null,
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
        let savedId = editId || recordId;

        // ── نقشه ترجمه فیلدها به فارسی ──────────────────────
        const FIELD_FA = {
            student_name:       'نام دانشجو',
            work_type:          'نوع کار',
            phone:              'شماره تماس',
            receive_date:       'تاریخ دریافت',
            send_method:        'نحوه ارسال',
            send_date:          'تاریخ ارسال',
            acknowledgment:     'اعلام وصول',
            settlement_agreed:  'مبلغ توافق',
            settlement_deposit: 'بیعانه',
            settlement_final:   'تسویه نهایی',
            settlement:         'واحد ارز',
            sajad_code:         'کد سجاد',
            sajad_email:        'ایمیل سجاد',
            sajad_password:     'رمز عبور سجاد',
            vekalat:            'وکالت‌نامه',
            send_status:        'وضعیت ارسال',
            receive_status:     'وضعیت دریافت',
            file_paths:         'فایل‌های پیوست',
        };

        if (editId) {
            // پیدا کردن فیلدهایی که واقعاً تغییر کردن
            const oldRec = _allRecords.find(r => r.id === editId) || {};
            const changedFa = [];
            Object.keys(payload).forEach(key => {
                const oldVal = String(oldRec[key] ?? '');
                const newVal = String(payload[key] ?? '');
                if (oldVal !== newVal) {
                    changedFa.push(FIELD_FA[key] || key);
                }
            });

            ok = await update(editId, payload);
            if (ok) {
                const label = changedFa.length
                    ? 'ویرایش: ' + changedFa.join('، ')
                    : 'ویرایش رکورد (بدون تغییر)';
                await _logActivity(editId, 'update', label, changedFa);
            }
        } else {
            const result = await insert(payload);
            ok = !!result;
            if (ok && result) await _logActivity(result.id, 'create', 'ثبت رکورد جدید', []);
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

    // ── مودال لاگ فعالیت ─────────────────────────────────────
    async function showActivityLog(recordId) {
        const client = sb();
        let logs = [];
        if (client) {
            const { data } = await client
                .from('embassy_activity_log')
                .select('*')
                .eq('record_id', recordId)
                .order('created_at', { ascending: false })
                .limit(50);
            logs = data || [];
        }

        // اطلاعات رکورد
        const rec = _allRecords.find(r => r.id === recordId);
        const name = rec ? rec.student_name : '';

        const rows = logs.length ? logs.map(log => {
            const dt = log.created_at
                ? (typeof Jalali !== 'undefined' ? Jalali.toJalaliDisplay(log.created_at) : new Date(log.created_at).toLocaleDateString('fa-IR'))
                : '—';
            const time = log.created_at ? new Date(log.created_at).toLocaleTimeString('fa-IR') : '';
            const actionIcon = {
                'create':      'fa-plus-circle text-green-500',
                'update':      'fa-edit text-black-500',
                'file_upload': 'fa-upload text-lime-500',
                'file_delete': 'fa-trash text-red-500',
            }[log.action] || 'fa-circle text-gray-400';

            const fields = log.changed_fields && log.changed_fields.length
                ? `<div class="text-gray-400 text-xs mt-1">${log.changed_fields.join('، ')}</div>` : '';

            return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-3 px-4">
                    <i class="fas ${actionIcon} ml-2"></i>
                    <span class="text-gray-800 font-medium text-sm">${log.action_label || log.action}</span>
                    ${fields}
                </td>
                <td class="py-3 px-4 text-gray-700 font-medium text-sm">${log.user_name || '—'}</td>
                <td class="py-3 px-4 text-gray-500 text-xs">${dt}<br>${time}</td>
            </tr>`;
        }).join('') : `<tr><td colspan="3" class="text-center py-8 text-gray-400 text-sm">هنوز فعالیتی ثبت نشده</td></tr>`;

        const modal = document.createElement('div');
        modal.id = '__embassy-activity-modal';
        modal.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 class="font-bold text-gray-800 flex items-center gap-2">
                        <i class="fas fa-history text-black-500"></i>
                        تاریخچه فعالیت‌ها
                        ${name ? `<span class="text-black-600 font-semibold">— ${name}</span>` : ''}
                    </h3>
                    <button onclick="document.getElementById('__embassy-activity-modal').remove()"
                        class="text-gray-400 hover:text-gray-700 text-xl"><i class="fas fa-times"></i></button>
                </div>
                <div class="overflow-y-auto flex-1">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50 sticky top-0">
                            <tr class="border-b border-gray-200">
                                <th class="text-right text-gray-600 font-semibold py-3 px-4">اکشن</th>
                                <th class="text-right text-gray-600 font-semibold py-3 px-4">کاربر</th>
                                <th class="text-right text-gray-600 font-semibold py-3 px-4">زمان</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    // ── init (هنگام ورود به صفحه) ────────────────────────────
    function init() {
        // دادن زمان کوتاه تا DOM رندر شود
        setTimeout(() => load(), 100);
    }

    // ── رفتن مستقیم به صفحه دارالترجمه ─────────────────────
    function goToTranslationOffice() {
        const baseUrl = location.origin + location.pathname.replace(/\/[^/]*$/, '/') + 'daroltarjome.html';
        window.open(baseUrl, '_blank');
    }

    // ── باز کردن صفحه دارالترجمه ────────────────────────────
    function openTranslationOffice(recordId) {
        EmbassyModule._openTranslationOfficeAsync(recordId);
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
        _setQuickDate,
        _openJalaliPicker,
        _renderCalPopup,
        _pickCalDate,
        showActivityLog,
        _addPaymentRow,
        _loadPayments,
        openTranslationOffice,
        goToTranslationOffice,
    };

})(); // end EmbassyModule

// ── تابع باز کردن صفحه دارالترجمه ──────────────────────────
// مدیر/کارمند: مستقیم با record_id وارد میشن
// بقیه: از طریق share_token (لینک)
EmbassyModule._openTranslationOfficeAsync = async function(recordId) {
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
    if (!client) { alert('اتصال به سرور برقرار نیست'); return; }

    const user = (() => { try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch { return {}; } })();
    const isStaff = user.role === 'manager' || user.role === 'employee';
    const baseUrl = location.origin + location.pathname.replace(/\/[^/]*$/, '/') + 'daroltarjome.html';

    // ── مدیر / کارمند: مستقیم با record_id ──────────────────
    if (isStaff) {
        window.open(baseUrl + '?record_id=' + recordId, '_blank');
        return;
    }

    // ── سایر کاربران: از طریق share_token ───────────────────
    const { data: rec } = await client
        .from('embassy_records')
        .select('share_token, student_name')
        .eq('id', recordId).single();

    let token = rec?.share_token;
    if (!token) {
        token = 'dt_' + recordId + '_' + Math.random().toString(36).substr(2, 12);
        await client.from('embassy_records').update({ share_token: token }).eq('id', recordId);
    }

    const url = baseUrl + '?token=' + token;
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4';
    modal.id = 'dt-link-modal';
    modal.innerHTML = `
        <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-600 shadow-2xl space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-white font-bold text-lg flex items-center gap-2">
                    <i class="fas fa-language text-blue-400"></i> دارالترجمه
                </h3>
                <button onclick="document.getElementById('dt-link-modal').remove()"
                        class="text-gray-400 hover:text-white"><i class="fas fa-times text-xl"></i></button>
            </div>
            <p class="text-gray-300 text-sm">
                <span class="font-medium text-white">${rec?.student_name || ''}</span> —
                لینک زیر را برای دارالترجمه ارسال کنید:
            </p>
            <div class="bg-slate-700/50 rounded-xl p-3 flex items-center gap-2">
                <input type="text" value="${url}" readonly id="dt-link-input"
                       class="flex-1 bg-transparent text-blue-300 text-xs outline-none font-mono truncate">
                <button onclick="navigator.clipboard.writeText(document.getElementById('dt-link-input').value);this.textContent='✅ کپی شد'"
                        class="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-all flex-shrink-0">
                    کپی لینک
                </button>
            </div>
            <a href="${url}" target="_blank"
               class="w-full bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all">
                <i class="fas fa-external-link-alt"></i> باز کردن صفحه دارالترجمه
            </a>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};
