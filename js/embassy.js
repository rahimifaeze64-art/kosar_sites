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

            <!-- جستجو -->
            <div class="bg-blue-900 bg-opacity-30 rounded-xl p-4 border border-blue-700 border-opacity-30">
                <div class="flex gap-3 flex-wrap">
                    <input type="text" id="embassy-search" placeholder="جستجو بر اساس نام دانشجو..."
                        oninput="EmbassyModule.applyFilter()"
                        class="flex-1 min-w-48 bg-blue-800 bg-opacity-50 text-white border border-blue-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-yellow-400">
                    <select id="embassy-filter-type" onchange="EmbassyModule.applyFilter()"
                        class="bg-blue-800 bg-opacity-50 text-white border border-blue-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-yellow-400">
                        <option value="">همه نوع‌های کار</option>
                        <option value="ترجمه">ترجمه</option>
                        <option value="تصدیق">تصدیق</option>
                        <option value="وکالتنامه">وکالتنامه</option>
                        <option value="مدارک تحصیلی">مدارک تحصیلی</option>
                        <option value="سایر">سایر</option>
                    </select>
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
                                <div class="bg-blue-700 bg-opacity-40 border border-blue-500 rounded-lg p-3 space-y-3">
                                    <!-- هر نوع سند با وضعیت -->
                                    <p class="text-blue-300 text-xs mb-1">برای هر نوع سند، وضعیت مورد نیاز را انتخاب کنید:</p>

                                    ${[
                                        ['مباشره',       'mabashare'],
                                        ['قبول نهایی',   'qabool'],
                                        ['مدرک کارشناسی','karshenasi'],
                                        ['مدرک ارشد',    'arshad'],
                                        ['مدرک دکتری',   'doktori'],
                                        ['مجلد',         'mojallad'],
                                        ['وکالت‌نامه',   'vekalat'],
                                    ].map(([label, key]) => `
                                    <div class="flex items-center justify-between gap-2 py-1 border-b border-blue-600 border-opacity-30 last:border-0">
                                        <label class="text-white text-sm w-28 flex-shrink-0">
                                            <input type="checkbox" class="doc-type-check w-4 h-4 accent-yellow-400 ml-1"
                                                   data-key="${key}" data-label="${label}"
                                                   onchange="EmbassyModule._toggleDocType(this)">
                                            ${label}
                                        </label>
                                        <div id="status-${key}" class="flex gap-2 opacity-40 pointer-events-none">
                                            <label class="flex items-center gap-1 text-xs text-blue-200 cursor-pointer">
                                                <input type="radio" name="status-${key}" value="ترجمه" class="accent-blue-400"> ترجمه
                                            </label>
                                            <label class="flex items-center gap-1 text-xs text-blue-200 cursor-pointer">
                                                <input type="radio" name="status-${key}" value="تصدیق" class="accent-yellow-400"> تصدیق
                                            </label>
                                            <label class="flex items-center gap-1 text-xs text-green-300 cursor-pointer">
                                                <input type="radio" name="status-${key}" value="هردو" class="accent-green-400"> هردو
                                            </label>
                                        </div>
                                    </div>`).join('')}

                                    <!-- سایر -->
                                    <div class="flex items-center justify-between gap-2 py-1">
                                        <label class="text-white text-sm w-28 flex-shrink-0">
                                            <input type="checkbox" class="doc-type-check w-4 h-4 accent-yellow-400 ml-1"
                                                   data-key="sayer" data-label="سایر"
                                                   onchange="EmbassyModule._toggleDocType(this)">
                                            سایر
                                        </label>
                                        <div id="status-sayer" class="flex gap-2 opacity-40 pointer-events-none">
                                            <label class="flex items-center gap-1 text-xs text-blue-200 cursor-pointer">
                                                <input type="radio" name="status-sayer" value="ترجمه" class="accent-blue-400"> ترجمه
                                            </label>
                                            <label class="flex items-center gap-1 text-xs text-blue-200 cursor-pointer">
                                                <input type="radio" name="status-sayer" value="تصدیق" class="accent-yellow-400"> تصدیق
                                            </label>
                                            <label class="flex items-center gap-1 text-xs text-green-300 cursor-pointer">
                                                <input type="radio" name="status-sayer" value="هردو" class="accent-green-400"> هردو
                                            </label>
                                        </div>
                                    </div>
                                    <div id="sayer-text-wrap" class="hidden">
                                        <input type="text" id="sayer-custom-text"
                                            placeholder="نوع سند سایر را بنویسید..."
                                            class="w-full bg-blue-600 bg-opacity-50 text-white border border-blue-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ردیف دوم -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-blue-200 text-sm font-semibold block mb-1">تاریخ دریافت مدارک</label>
                                <input type="date" id="f-receiveDate" data-jalali
                                    class="w-full bg-blue-700 bg-opacity-50 text-white border border-blue-500 rounded-lg px-4 py-2.5 focus:outline-none focus:border-yellow-400">
                            </div>
                            <div>
                                <label class="text-blue-200 text-sm font-semibold block mb-1">نحوه ارسال</label>
                                <input type="text" id="f-sendMethod"
                                    class="w-full bg-blue-700 bg-opacity-50 text-white border border-blue-500 rounded-lg px-4 py-2.5 focus:outline-none focus:border-yellow-400"
                                    placeholder="مثال: سخایی، پست، اسم معقب">
                            </div>
                        </div>

                        <!-- ردیف سوم -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-blue-200 text-sm font-semibold block mb-1">تاریخ ارسال</label>
                                <input type="date" id="f-sendDate" data-jalali
                                    class="w-full bg-blue-700 bg-opacity-50 text-white border border-blue-500 rounded-lg px-4 py-2.5 focus:outline-none focus:border-yellow-400">
                            </div>
                            <div>
                                <label class="text-blue-200 text-sm font-semibold block mb-1">اعلام وصول</label>
                                <input type="text" id="f-acknowledgment"
                                    class="w-full bg-blue-700 bg-opacity-50 text-white border border-blue-500 rounded-lg px-4 py-2.5 focus:outline-none focus:border-yellow-400"
                                    placeholder="تاریخ یا توضیح اعلام وصول">
                            </div>
                        </div>

                        <!-- ردیف چهارم -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="text-blue-200 text-sm font-semibold block mb-1">تسویه</label>
                                <input type="text" id="f-settlement"
                                    class="w-full bg-blue-700 bg-opacity-50 text-white border border-blue-500 rounded-lg px-4 py-2.5 focus:outline-none focus:border-yellow-400"
                                    placeholder="وضعیت تسویه">
                            </div>
                            <div>
                                <label class="text-blue-200 text-sm font-semibold block mb-1">کد سجاد</label>
                                <input type="text" id="f-sajadCode"
                                    class="w-full bg-blue-700 bg-opacity-50 text-white border border-blue-500 rounded-lg px-4 py-2.5 focus:outline-none focus:border-black-400"
                                    placeholder="کد سجاد دانشجو">
                            </div>
                        </div>

                        <!-- دریافت از دار الترجمه -->
                        <div>
                            <label class="text-blue-200 text-sm font-semibold block mb-1">دریافت از دار الترجمه</label>
                            <input type="text" id="f-translationOffice"
                                class="w-full bg-blue-700 bg-opacity-50 text-white border border-blue-500 rounded-lg px-4 py-2.5 focus:outline-none focus:border-yellow-400"
                                placeholder="تاریخ یا توضیح دریافت از دار الترجمه">
                        </div>

                        <!-- آپلود فایل -->
                        <div>
                            <label class="text-blue-200 text-sm font-semibold block mb-1">
                                <i class="fas fa-paperclip ml-1"></i>پیوست مدارک
                            </label>
                            <div class="border-2 border-dashed border-blue-500 rounded-xl p-4 text-center cursor-pointer hover:border-yellow-400 transition-colors"
                                onclick="document.getElementById('f-files').click()">
                                <i class="fas fa-cloud-upload-alt text-2xl text-blue-400 mb-2"></i>
                                <p class="text-blue-200 text-sm">برای آپلود کلیک کنید</p>
                                <p class="text-gray-400 text-xs mt-1">PDF، JPG، PNG (حداکثر 5 مگابایت)</p>
                            </div>
                            <input type="file" id="f-files" multiple accept=".pdf,.jpg,.jpeg,.png" class="hidden"
                                onchange="EmbassyModule.previewFiles(this)">
                            <div id="f-files-preview" class="mt-2 space-y-1"></div>
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
            <tr class="border-b border-blue-700 border-opacity-20 hover:bg-blue-900 hover:bg-opacity-30 transition-colors">
                <td class="px-3 py-3 font-semibold text-white">${r.student_name}</td>
                <td class="px-3 py-3">
                    <span class="bg-blue-600 bg-opacity-40 text-blue-200 text-xs px-2 py-1 rounded-lg">${r.work_type}</span>
                </td>
                <td class="px-3 py-3 text-gray-300 text-sm">${r.receive_date ? (typeof Jalali !== 'undefined' ? Jalali.displayDate(r.receive_date) : r.receive_date) : '—'}</td>
                <td class="px-3 py-3 text-gray-300 text-sm">${r.send_method || '—'}</td>
                <td class="px-3 py-3 text-gray-300 text-sm">${r.send_date ? (typeof Jalali !== 'undefined' ? Jalali.displayDate(r.send_date) : r.send_date) : '—'}</td>
                <td class="px-3 py-3">
                    ${r.acknowledgment
                        ? `<span class="bg-green-600 bg-opacity-40 text-green-300 text-xs px-2 py-1 rounded-lg">✓ ${r.acknowledgment}</span>`
                        : `<span class="text-gray-500 text-xs">در انتظار</span>`}
                </td>
                <td class="px-3 py-3">
                    ${r.settlement
                        ? `<span class="bg-emerald-600 bg-opacity-40 text-emerald-300 text-xs px-2 py-1 rounded-lg">✓ ${r.settlement}</span>`
                        : `<span class="text-gray-500 text-xs">—</span>`}
                </td>
                <td class="px-3 py-3 text-gray-100 text-sm font-mono">${r.sajad_code || '—'}</td>
                <td class="px-3 py-3 text-gray-300 text-sm">${r.translation_office || '—'}</td>
                <td class="px-3 py-3">
                    ${r.file_paths && r.file_paths.length
                        ? r.file_paths.map(p => `<button onclick="EmbassyModule.downloadFile('${p}')" class="block text-blue-300 hover:text-blue-100 text-xs underline truncate max-w-24"><i class="fas fa-download ml-1"></i>${p.split('/').pop()}</button>`).join('')
                        : `<span class="text-gray-500 text-xs">—</span>`}
                </td>
                <td class="px-3 py-3 text-gray-400 text-xs">${r.updated_at ? (typeof Jalali!=='undefined' ? Jalali.toJalaliDateTime(r.updated_at) : new Date(r.updated_at).toLocaleDateString('fa-IR')) : '—'}</td>
                <td class="px-3 py-3 text-xs text-gray-400">${r.created_by_name || '—'}</td>
                <td class="px-3 py-3">
                    <div class="flex gap-2">
                        <button onclick="EmbassyModule.openEditModal('${r.id}')"
                            class="bg-yellow-600 hover:bg-yellow-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="EmbassyModule.confirmDelete('${r.id}','${(r.student_name||'').replace(/'/g,"\\'")}')"
                            class="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`).join('');

        container.innerHTML = `
            <div class="overflow-x-auto rounded-xl border border-blue-700 border-opacity-30">
                <table class="w-full text-sm" style="min-width:1200px">
                    <thead>
                        <tr class="bg-blue-900 bg-opacity-60 text-blue-200 text-xs">
                            <th class="px-3 py-3 text-right font-semibold">نام دانشجو</th>
                            <th class="px-3 py-3 text-right font-semibold">نوع کار</th>
                            <th class="px-3 py-3 text-right font-semibold">تاریخ دریافت</th>
                            <th class="px-3 py-3 text-right font-semibold">نحوه ارسال</th>
                            <th class="px-3 py-3 text-right font-semibold">تاریخ ارسال</th>
                            <th class="px-3 py-3 text-right font-semibold">اعلام وصول</th>
                            <th class="px-3 py-3 text-right font-semibold">تسویه</th>
                            <th class="px-3 py-3 text-right font-semibold">کد سجاد</th>
                            <th class="px-3 py-3 text-right font-semibold">دار الترجمه</th>
                            <th class="px-3 py-3 text-right font-semibold">فایل‌ها</th>
                            <th class="px-3 py-3 text-right font-semibold">آخرین آپدیت</th>
                            <th class="px-3 py-3 text-right font-semibold">ثبت‌کننده</th>
                            <th class="px-3 py-3 text-right font-semibold">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <p class="text-gray-400 text-xs mt-2 text-left">${records.length} رکورد</p>`;
    }

    // ── toggle وضعیت نوع سند ─────────────────────────────────
    function _toggleDocType(cb) {
        var key = cb.dataset.key;
        var statusDiv = document.getElementById('status-' + key);
        if (!statusDiv) return;
        if (cb.checked) {
            statusDiv.classList.remove('opacity-40', 'pointer-events-none');
            // پیش‌فرض: هردو
            var def = statusDiv.querySelector('input[value="هردو"]');
            if (def) def.checked = true;
        } else {
            statusDiv.classList.add('opacity-40', 'pointer-events-none');
            statusDiv.querySelectorAll('input[type="radio"]').forEach(function(r) { r.checked = false; });
        }
        if (key === 'sayer') {
            var wrap = document.getElementById('sayer-text-wrap');
            if (wrap) wrap.classList.toggle('hidden', !cb.checked);
        }
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

        const filtered = _allRecords.filter(r => {
            const matchName = !search || (r.student_name || '').toLowerCase().includes(search);
            const matchType = !type  || (r.work_type || '') === type;
            return matchName && matchType;
        });
        renderTable(filtered);
    }

    // ── مودال افزودن ─────────────────────────────────────────
    function openAddModal() {
        document.getElementById('embassy-edit-id').value = '';
        document.getElementById('embassy-modal-title').textContent = 'ثبت مدرک جدید';
        document.getElementById('embassy-submit-text').textContent = 'ذخیره';
        document.getElementById('embassy-form').reset();
        document.querySelectorAll('.doc-type-check').forEach(function(cb) {
            cb.checked = false;
            var key = cb.dataset.key;
            var sd = document.getElementById('status-' + key);
            if (sd) { sd.classList.add('opacity-40','pointer-events-none'); sd.querySelectorAll('input[type="radio"]').forEach(function(r){r.checked=false;}); }
        });
        var wrap = document.getElementById('sayer-text-wrap');
        if (wrap) wrap.classList.add('hidden');
        var ct = document.getElementById('sayer-custom-text');
        if (ct) ct.value = '';
        document.getElementById('f-files-preview').innerHTML = '';
        document.getElementById('embassy-modal').classList.remove('hidden');
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
        document.getElementById('f-settlement').value       = r.settlement         || '';
        document.getElementById('f-sajadCode').value        = r.sajad_code         || '';
        document.getElementById('f-translationOffice').value= r.translation_office || '';

        const preview = document.getElementById('f-files-preview');
        preview.innerHTML = r.file_paths && r.file_paths.length
            ? r.file_paths.map(p => `<p class="text-xs text-blue-300"><i class="fas fa-file ml-1"></i>${p}</p>`).join('')
            : '';

        document.getElementById('embassy-modal').classList.remove('hidden');
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
            const radio = document.querySelector(`input[name="status-${key}"]:checked`);
            const status = radio ? radio.value : '';
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
            student_name:       document.getElementById('f-studentName').value.trim(),
            work_type:          workTypeValue,
            receive_date:       document.getElementById('f-receiveDate').value || null,
            send_method:        document.getElementById('f-sendMethod').value  || null,
            send_date:          document.getElementById('f-sendDate').value    || null,
            acknowledgment:     document.getElementById('f-acknowledgment').value.trim() || null,
            settlement:         document.getElementById('f-settlement').value.trim()     || null,
            sajad_code:         document.getElementById('f-sajadCode').value.trim()      || null,
            translation_office: document.getElementById('f-translationOffice').value.trim() || null,
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
        openAddModal,
        openEditModal,
        closeModal,
        previewFiles,
        submitForm,
        confirmDelete,
        downloadFile,
        _toggleDocType,
    };

})(); // end EmbassyModule
