// ============================================================
// embassy-accounting.js  — حسابداری سفارت
// خواندن از جدول embassy_records در Supabase
// ============================================================

const EmbassyAccountingModule = (function () {
    'use strict';

    const TABLE = 'embassy_records';

    function sb() {
        return (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
    }

    // ── دریافت همه رکوردها ──────────────────────────────────
    async function getAll() {
        const client = sb();
        if (!client) return [];
        const { data, error } = await client
            .from(TABLE)
            .select('id,student_name,work_type,settlement_agreed,settlement_deposit,settlement_final,settlement,send_status,receive_status,acknowledgment,created_at,created_by_name')
            .order('created_at', { ascending: false });
        if (error) { console.error('EmbassyAccounting:', error.message); return []; }
        return data || [];
    }

    // ── محاسبه خلاصه مالی ───────────────────────────────────
    function calcSummary(records) {
        let totalAgreed  = 0;
        let totalDeposit = 0;
        let totalFinal   = 0;
        let settledCount = 0;
        let pendingCount = 0;

        records.forEach(r => {
            totalAgreed  += parseFloat(r.settlement_agreed  || 0);
            totalDeposit += parseFloat(r.settlement_deposit || 0);
            totalFinal   += parseFloat(r.settlement_final   || 0);
            if (r.settlement_final && parseFloat(r.settlement_final) > 0) settledCount++;
            else pendingCount++;
        });

        const remaining = totalAgreed - totalDeposit - totalFinal;

        return { totalAgreed, totalDeposit, totalFinal, remaining, settledCount, pendingCount, total: records.length };
    }

    function fmt(n) {
        return Number(n || 0).toLocaleString('fa-IR') + ' تومان';
    }

    // نمایش مبلغ با واحد ارز واقعی (تومان یا دلار)
    function fmtWithCurrency(n, currency) {
        const amount = Number(n || 0);
        if (amount <= 0) return '—';
        if (currency === 'دلار') {
            return '$' + amount.toLocaleString('en');
        }
        return amount.toLocaleString('fa-IR') + ' ت';
    }

    // ── رندر محتوا ──────────────────────────────────────────
    function getContent() {
        return `
        <div id="embassy-acc-app" class="space-y-6">

            <!-- هدر -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                        <span class="bg-orange-500 bg-opacity-20 p-2 rounded-xl">
                            <i class="fas fa-landmark text-orange-400"></i>
                        </span>
                        حسابداری سفارت
                    </h2>
                    <p class="text-blue-200 text-sm mt-1">گزارش مالی پرونده‌های سفارتی</p>
                </div>
                <button onclick="EmbassyAccountingModule.exportCSV()"
                    class="bg-green-600 hover:bg-green-500 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg">
                    <i class="fas fa-file-excel"></i> خروجی Excel
                </button>
            </div>

            <!-- فیلترها -->
            <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div class="flex gap-3 flex-wrap">
                    <input type="text" id="eacc-search" placeholder="🔍 جستجو نام دانشجو..."
                        oninput="EmbassyAccountingModule.applyFilter()"
                        class="flex-1 min-w-48 bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-orange-400">
                    <select id="eacc-filter-settled" onchange="EmbassyAccountingModule.applyFilter()"
                        class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-orange-400">
                        <option value="">همه پرونده‌ها</option>
                        <option value="settled">تسویه شده</option>
                        <option value="pending">تسویه نشده</option>
                    </select>
                    <select id="eacc-filter-type" onchange="EmbassyAccountingModule.applyFilter()"
                        class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-orange-400">
                        <option value="">همه نوع‌ها</option>
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
            </div>

            <!-- لودینگ -->
            <div id="eacc-loading" class="text-center py-12">
                <i class="fas fa-spinner fa-spin text-3xl text-orange-400"></i>
                <p class="text-blue-200 mt-3">در حال بارگذاری...</p>
            </div>

            <!-- خلاصه مالی -->
            <div id="eacc-summary" class="hidden"></div>

            <!-- جدول -->
            <div id="eacc-table" class="hidden"></div>
        </div>`;
    }

    // ── رندر کارت‌های خلاصه ─────────────────────────────────
    function renderSummary(s) {
        const el = document.getElementById('eacc-summary');
        if (!el) return;
        el.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
                <p class="text-gray-500 text-xs mb-1">کل پرونده‌ها</p>
                <p class="text-2xl font-bold text-gray-800">${s.total.toLocaleString('fa-IR')}</p>
            </div>
            <div class="bg-green-50 rounded-xl p-4 border border-green-200 shadow-sm text-center">
                <p class="text-green-600 text-xs mb-1">تسویه شده</p>
                <p class="text-2xl font-bold text-green-700">${s.settledCount.toLocaleString('fa-IR')}</p>
            </div>
            <div class="bg-red-50 rounded-xl p-4 border border-red-200 shadow-sm text-center">
                <p class="text-red-500 text-xs mb-1">تسویه نشده</p>
                <p class="text-2xl font-bold text-red-600">${s.pendingCount.toLocaleString('fa-IR')}</p>
            </div>
            <div class="bg-orange-50 rounded-xl p-4 border border-orange-200 shadow-sm text-center">
                <p class="text-orange-600 text-xs mb-1">جمع توافق</p>
                <p class="text-sm font-bold text-orange-700">${fmt(s.totalAgreed)}</p>
            </div>
            <div class="bg-yellow-50 rounded-xl p-4 border border-yellow-200 shadow-sm text-center">
                <p class="text-yellow-600 text-xs mb-1">جمع بیعانه</p>
                <p class="text-sm font-bold text-yellow-700">${fmt(s.totalDeposit)}</p>
            </div>
            <div class="bg-blue-50 rounded-xl p-4 border border-blue-200 shadow-sm text-center">
                <p class="text-blue-600 text-xs mb-1">جمع تسویه نهایی</p>
                <p class="text-sm font-bold text-blue-700">${fmt(s.totalFinal)}</p>
            </div>
        </div>`;
        el.classList.remove('hidden');
    }

    // ── رندر جدول ────────────────────────────────────────────
    function renderTable(records) {
        const el = document.getElementById('eacc-table');
        if (!el) return;

        if (!records.length) {
            el.innerHTML = `
            <div class="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <i class="fas fa-folder-open text-5xl text-gray-300 mb-4"></i>
                <p class="text-gray-500 text-lg">هیچ رکوردی یافت نشد</p>
            </div>`;
            el.classList.remove('hidden');
            return;
        }

        const rows = records.map((r, i) => {
            const agreed  = parseFloat(r.settlement_agreed  || 0);
            const deposit = parseFloat(r.settlement_deposit || 0);
            const final_  = parseFloat(r.settlement_final   || 0);
            const remaining = agreed - deposit - final_;
            const isSettled = final_ > 0;
            const cur = r.settlement || 'تومان'; // واحد ارز واقعی

            return `
            <tr class="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                <td class="px-3 py-3 text-gray-500 text-xs text-center">${(i+1).toLocaleString('fa-IR')}</td>
                <td class="px-3 py-3 font-semibold text-gray-900">${r.student_name}</td>
                <td class="px-3 py-3">
                    <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-lg">${r.work_type || '—'}</span>
                </td>
                <td class="px-3 py-3 text-orange-700 font-medium text-sm">${agreed > 0 ? fmtWithCurrency(agreed, cur) : '—'}</td>
                <td class="px-3 py-3 text-yellow-700 font-medium text-sm">${deposit > 0 ? fmtWithCurrency(deposit, cur) : '—'}</td>
                <td class="px-3 py-3 text-green-700 font-bold text-sm">${final_ > 0 ? fmtWithCurrency(final_, cur) : '—'}</td>
                <td class="px-3 py-3 text-sm ${remaining > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}">
                    ${remaining > 0 ? fmtWithCurrency(remaining, cur) : '<span class="text-green-600">✓ تسویه</span>'}
                </td>
                <td class="px-3 py-3 text-center">
                    <span class="text-xs px-1.5 py-0.5 rounded font-bold ${cur === 'دلار' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                        ${cur === 'دلار' ? '$ دلار' : 'ت تومان'}
                    </span>
                </td>
                <td class="px-3 py-3">
                    ${isSettled
                        ? '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">✓ تسویه</span>'
                        : '<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">در انتظار</span>'}
                </td>
                <td class="px-3 py-3 text-gray-500 text-xs">${r.created_by_name || '—'}</td>
            </tr>`;
        }).join('');

        el.innerHTML = `
        <div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table class="w-full text-sm bg-white" style="min-width:900px">
                <thead>
                    <tr class="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
                        <th class="px-3 py-3 text-center font-bold">#</th>
                        <th class="px-3 py-3 text-right font-bold">نام دانشجو</th>
                        <th class="px-3 py-3 text-right font-bold">نوع کار</th>
                        <th class="px-3 py-3 text-right font-bold">مبلغ توافق</th>
                        <th class="px-3 py-3 text-right font-bold">بیعانه</th>
                        <th class="px-3 py-3 text-right font-bold">تسویه نهایی</th>
                        <th class="px-3 py-3 text-right font-bold">مانده</th>
                        <th class="px-3 py-3 text-right font-bold">وضعیت</th>
                        <th class="px-3 py-3 text-right font-bold">ثبت‌کننده</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <p class="text-gray-500 text-xs mt-2">${records.length.toLocaleString('fa-IR')} رکورد</p>`;
        el.classList.remove('hidden');
    }

    // ── state کش داده ────────────────────────────────────────
    let _all = [];

    // ── بارگذاری ─────────────────────────────────────────────
    async function load() {
        const loading = document.getElementById('eacc-loading');
        const summary = document.getElementById('eacc-summary');
        const table   = document.getElementById('eacc-table');
        if (loading) loading.classList.remove('hidden');
        if (summary) summary.classList.add('hidden');
        if (table)   table.classList.add('hidden');

        _all = await getAll();

        if (loading) loading.classList.add('hidden');
        renderSummary(calcSummary(_all));
        renderTable(_all);
    }

    // ── فیلتر ────────────────────────────────────────────────
    function applyFilter() {
        const search   = (document.getElementById('eacc-search')?.value || '').toLowerCase();
        const settled  = document.getElementById('eacc-filter-settled')?.value || '';
        const type     = document.getElementById('eacc-filter-type')?.value || '';

        let filtered = _all.filter(r => {
            const matchName = !search || (r.student_name || '').toLowerCase().includes(search);
            const matchType = !type   || (r.work_type || '').includes(type);
            let matchSettled = true;
            if (settled === 'settled') matchSettled = parseFloat(r.settlement_final || 0) > 0;
            if (settled === 'pending') matchSettled = !(parseFloat(r.settlement_final || 0) > 0);
            return matchName && matchType && matchSettled;
        });

        renderSummary(calcSummary(filtered));
        renderTable(filtered);
    }

    // ── خروجی CSV ────────────────────────────────────────────
    function exportCSV() {
        const header = ['نام دانشجو','نوع کار','مبلغ توافق','بیعانه','تسویه نهایی','مانده','وضعیت','ثبت‌کننده'];
        const rows = _all.map(r => {
            const agreed  = parseFloat(r.settlement_agreed  || 0);
            const deposit = parseFloat(r.settlement_deposit || 0);
            const final_  = parseFloat(r.settlement_final   || 0);
            const remaining = agreed - deposit - final_;
            return [
                r.student_name,
                r.work_type || '',
                agreed,
                deposit,
                final_,
                remaining > 0 ? remaining : 0,
                final_ > 0 ? 'تسویه' : 'در انتظار',
                r.created_by_name || ''
            ].map(v => `"${v}"`).join(',');
        });
        const csv = '\uFEFF' + [header.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'embassy_accounting.csv';
        a.click();
    }

    // ── init ─────────────────────────────────────────────────
    function init() {
        setTimeout(() => load(), 100);
    }

    return { getContent, init, load, applyFilter, exportCSV };

})();

// تابع global که index.html صدا می‌زنه
function getEmbassyAccountingContent() {
    setTimeout(() => EmbassyAccountingModule.init(), 50);
    return EmbassyAccountingModule.getContent();
}
