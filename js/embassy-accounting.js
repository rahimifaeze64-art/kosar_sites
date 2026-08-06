// ============================================================
// embassy-accounting.js  v3 — حسابداری سفارت
// ============================================================

// تابع مشترک RTL Excel (اگر از employee-accounting.js لود نشده باشد)
if (typeof _downloadRtlExcel === 'undefined') {
    window._downloadRtlExcel = function(headers, rows, filename) {
        const esc = v => String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const th = headers.map(h=>`<th style="background:#1a56db;color:#fff;padding:6px 10px;border:1px solid #ddd;">${esc(h)}</th>`).join('');
        const td = rows.map(r=>'<tr>'+r.map(c=>`<td style="padding:5px 10px;border:1px solid #ddd;">${esc(c)}</td>`).join('')+'</tr>').join('');
        const html = `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><style>body{font-family:Tahoma,Arial,sans-serif;direction:rtl}table{border-collapse:collapse;width:100%;direction:rtl}th,td{text-align:right}</style></head><body><table><thead><tr>${th}</tr></thead><tbody>${td}</tbody></table></body></html>`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\uFEFF'+html],{type:'application/vnd.ms-excel;charset=utf-8;'}));
        a.download = filename.replace(/\.csv$/i,'.xls');
        document.body.appendChild(a); a.click();
        setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
    };
}

const EmbassyAccountingModule = (function () {
    'use strict';

    const TABLE = 'embassy_records';
    let _all = [];      // همه رکوردها
    let _filtered = []; // رکوردهای بعد از فیلتر
    let _sortDir  = 'desc'; // 'desc' = جدیدترین اول | 'asc' = قدیمی‌ترین اول

    function sb() {
        return (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
    }

    // ── دریافت همه رکوردها (شامل _list columns) ─────────────
    async function getAll() {
        const client = sb();
        if (!client) return [];
        const { data, error } = await client
            .from(TABLE)
            .select([
                'id','student_name','work_type',
                'settlement_agreed','settlement_deposit','settlement_final','settlement',
                'settlement_agreed_list','settlement_deposit_list','settlement_final_list',
                'send_status','receive_status','created_at','created_by_name'
            ].join(','))
            .order('created_at', { ascending: false });
        if (error) { console.error('EmbassyAccounting:', error.message); return []; }
        return data || [];
    }

    // ── خواندن آرایه پرداخت‌ها از یک رکورد ─────────────────
    // برگرداندن [{amount, currency}, ...] — با fallback به فیلد scalar
    function _parseList(listVal, scalarVal, scalarCur) {
        if (listVal && Array.isArray(listVal) && listVal.length > 0) {
            return listVal.map(p => ({ amount: parseFloat(p.amount || 0), currency: p.currency || 'تومان' }))
                          .filter(p => p.amount > 0);
        }
        const s = parseFloat(scalarVal || 0);
        if (s > 0) return [{ amount: s, currency: scalarCur || 'تومان' }];
        return [];
    }

    // ── جمع یک آرایه پرداخت به تفکیک ارز ──────────────────
    function _sumByCurrency(items) {
        const m = { تومان: 0, دلار: 0, دینار: 0 };
        items.forEach(p => { m[p.currency] = (m[p.currency] || 0) + p.amount; });
        return m;
    }

    // ── محاسبه داده‌های مالی یک رکورد ───────────────────────
    function _calcRecord(r) {
        const cur = r.settlement || 'تومان';
        const agreed  = _parseList(r.settlement_agreed_list,  r.settlement_agreed,  cur);
        const deposit = _parseList(r.settlement_deposit_list, r.settlement_deposit, cur);
        const final_  = _parseList(r.settlement_final_list,   r.settlement_final,   cur);

        const agreedByCur  = _sumByCurrency(agreed);
        const depositByCur = _sumByCurrency(deposit);
        const finalByCur   = _sumByCurrency(final_);

        // تعیین وضعیت تسویه: اگر هر نوع پرداخت نهایی ثبت شده باشد
        const totalFinalAll = Object.values(finalByCur).reduce((s,v)=>s+v, 0);
        const isSettled = totalFinalAll > 0;

        // محاسبه مانده به تفکیک ارز
        const remainByCur = {};
        ['تومان','دلار','دینار'].forEach(c => {
            const rem = (agreedByCur[c]||0) - (depositByCur[c]||0) - (finalByCur[c]||0);
            if (rem !== 0) remainByCur[c] = rem;
        });

        return { agreed, deposit, final_, agreedByCur, depositByCur, finalByCur, remainByCur, isSettled, totalFinalAll };
    }

    // ── محاسبه خلاصه کل (به تفکیک ارز) ─────────────────────
    function calcSummary(records) {
        const agreedAll  = { تومان:0, دلار:0, دینار:0 };
        const depositAll = { تومان:0, دلار:0, دینار:0 };
        const finalAll   = { تومان:0, دلار:0, دینار:0 };
        const remainAll  = { تومان:0, دلار:0, دینار:0 };
        let settledCount = 0, pendingCount = 0;

        records.forEach(r => {
            const d = _calcRecord(r);
            ['تومان','دلار','دینار'].forEach(c => {
                agreedAll[c]  += (d.agreedByCur[c]  || 0);
                depositAll[c] += (d.depositByCur[c] || 0);
                finalAll[c]   += (d.finalByCur[c]   || 0);
                remainAll[c]  += (d.remainByCur[c]  || 0);
            });
            d.isSettled ? settledCount++ : pendingCount++;
        });

        return { agreedAll, depositAll, finalAll, remainAll, settledCount, pendingCount, total: records.length };
    }

    // ── فرمت مبلغ با ارز ────────────────────────────────────
    function fmtC(amount, currency) {
        if (!amount || amount === 0) return null;
        if (currency === 'دلار')  return `<span class="text-green-700 font-bold">$${Number(amount).toLocaleString('en')}</span>`;
        if (currency === 'دینار') return `<span class="text-black-700 font-bold">${Number(amount).toLocaleString('fa-IR')} د</span>`;
        return `<span class="text-orange-700 font-bold">${Number(amount).toLocaleString('fa-IR')} ت</span>`;
    }

    function fmtCurGroup(byCur) {
        const parts = ['تومان','دلار','دینار']
            .map(c => fmtC(byCur[c], c))
            .filter(Boolean);
        return parts.length ? parts.join('<br>') : '—';
    }

    // ── رندر کارت‌های خلاصه ─────────────────────────────────
    function renderSummary(s) {
        const el = document.getElementById('eacc-summary');
        if (!el) return;

        function multiCurCard(byCur, label, bg, textColor) {
            const parts = ['تومان','دلار','دینار']
                .filter(c => (byCur[c]||0) !== 0)
                .map(c => {
                    const v = byCur[c];
                    const display = c==='دلار' ? `$${Number(v).toLocaleString('en')}` : `${Number(v).toLocaleString('fa-IR')} ${c==='دینار'?'د':'ت'}`;
                    return `<p class="text-sm font-bold ${textColor}">${display}</p>`;
                }).join('');
            return `
            <div class="${bg} rounded-xl p-4 border shadow-sm text-center">
                <p class="text-xs mb-1 text-gray-500">${label}</p>
                ${parts || '<p class="text-gray-400 text-sm">—</p>'}
            </div>`;
        }

        el.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
            ${multiCurCard(s.agreedAll,  'جمع مبالغ توافق',     'bg-orange-50 border-orange-200', 'text-orange-700')}
            ${multiCurCard(s.depositAll, 'جمع بیعانه‌ها',       'bg-lime-50 border-lime-200', 'text-lime-700')}
            ${multiCurCard(s.finalAll,   'جمع دریافتی‌ها',      'bg-blue-50   border-blue-200',   'text-black-700')}
        </div>
        <!-- تسویه نشده به تفکیک ارز -->
        <div class="mt-3 bg-red-50 border border-red-200 rounded-xl p-4 flex flex-wrap gap-6 items-center">
            <span class="text-red-600 text-sm font-bold flex items-center gap-1"><i class="fas fa-exclamation-circle"></i> مانده تسویه‌نشده:</span>
            ${['تومان','دلار','دینار'].filter(c=>(s.remainAll[c]||0)>0).map(c=>{
                const v = s.remainAll[c];
                const display = c==='دلار' ? `$${Number(v).toLocaleString('en')}` : `${Number(v).toLocaleString('fa-IR')} ${c==='دینار'?'دینار':'تومان'}`;
                return `<span class="text-red-700 font-bold text-sm">${display}</span>`;
            }).join('<span class="text-gray-300">|</span>') || '<span class="text-gray-400 text-sm">تسویه کامل ✓</span>'}
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
            const d = _calcRecord(r);

            // نمایش هر ستون به تفکیک ارز
            function colHtml(byCur) {
                const parts = ['تومان','دلار','دینار']
                    .filter(c => (byCur[c]||0) > 0)
                    .map(c => {
                        const v = byCur[c];
                        if (c === 'دلار')  return `<span class="text-green-700 font-bold text-xs">$${Number(v).toLocaleString('en')}</span>`;
                        if (c === 'دینار') return `<span class="text-black-700 font-bold text-xs">${Number(v).toLocaleString('fa-IR')} د</span>`;
                        return `<span class="text-orange-700 font-bold text-xs">${Number(v).toLocaleString('fa-IR')} ت</span>`;
                    });
                return parts.length ? parts.join('<br>') : '<span class="text-gray-300">—</span>';
            }

            // ستون مانده
            const remainHtml = (() => {
                const parts = ['تومان','دلار','دینار']
                    .filter(c => (d.remainByCur[c]||0) > 0)
                    .map(c => {
                        const v = d.remainByCur[c];
                        if (c === 'دلار')  return `<span class="text-red-600 font-bold text-xs">$${Number(v).toLocaleString('en')}</span>`;
                        if (c === 'دینار') return `<span class="text-red-600 font-bold text-xs">${Number(v).toLocaleString('fa-IR')} د</span>`;
                        return `<span class="text-red-600 font-bold text-xs">${Number(v).toLocaleString('fa-IR')} ت</span>`;
                    });
                return parts.length ? parts.join('<br>') : '<span class="text-green-600 text-xs font-bold">✓ تسویه</span>';
            })();

            // badge ارزها
            const currencies = [...new Set([
                ...d.agreed.map(p=>p.currency),
                ...d.deposit.map(p=>p.currency),
                ...d.final_.map(p=>p.currency)
            ])];
            const curBadges = currencies.map(c => {
                const cls = c==='دلار' ? 'bg-green-100 text-green-700' : c==='دینار' ? 'bg-blue-100 text-black-700' : 'bg-orange-100 text-orange-700';
                const icon = c==='دلار' ? '$' : c==='دینار' ? 'د' : 'ت';
                return `<span class="text-xs px-1.5 py-0.5 rounded font-bold ${cls}">${icon} ${c}</span>`;
            }).join(' ');

            return `
            <tr class="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                <td class="px-3 py-3 text-gray-400 text-xs text-center">${(i+1).toLocaleString('fa-IR')}</td>
                <td class="px-3 py-3 font-semibold text-gray-900 text-sm">${r.student_name || '—'}</td>
                <td class="px-3 py-3">
                    <span class="bg-blue-100 text-black-800 text-xs px-2 py-1 rounded-lg">${r.work_type || '—'}</span>
                </td>
                <td class="px-3 py-3">${colHtml(d.agreedByCur)}</td>
                <td class="px-3 py-3">${colHtml(d.depositByCur)}</td>
                <td class="px-3 py-3">${colHtml(d.finalByCur)}</td>
                <td class="px-3 py-3">${remainHtml}</td>
                <td class="px-3 py-3 text-center">${curBadges || '—'}</td>
                <td class="px-3 py-3 text-center">
                    ${d.isSettled
                        ? '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">✓ تسویه</span>'
                        : '<span class="bg-lime-100 text-lime-700 text-xs px-2 py-1 rounded-full">در انتظار</span>'}
                </td>
                <td class="px-3 py-3 text-gray-500 text-xs">${r.created_by_name || '—'}</td>
            </tr>`;
        }).join('');

        el.innerHTML = `
        <div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table class="w-full text-sm bg-white" style="min-width:900px">
                <thead>
                    <tr class="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
                        <th class="px-3 py-3 text-center">#</th>
                        <th class="px-3 py-3 text-right">نام دانشجو</th>
                        <th class="px-3 py-3 text-right">نوع کار</th>
                        <th class="px-3 py-3 text-right">مبلغ توافق</th>
                        <th class="px-3 py-3 text-right">بیعانه</th>
                        <th class="px-3 py-3 text-right">دریافتی نهایی</th>
                        <th class="px-3 py-3 text-right">مانده</th>
                        <th class="px-3 py-3 text-center">ارز</th>
                        <th class="px-3 py-3 text-center">وضعیت</th>
                        <th class="px-3 py-3 text-right">ثبت‌کننده</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <p class="text-gray-400 text-xs mt-2 text-left">${records.length.toLocaleString('fa-IR')} رکورد نمایش داده می‌شود</p>`;
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
            const d = _calcRecord(r);

            // نمایش ستون مبلغ (همه ارزها)
            function colAmt(byCur) {
                const parts = ['تومان','دلار','دینار']
                    .filter(c => (byCur[c]||0) > 0)
                    .map(c => {
                        const v = byCur[c];
                        if (c === 'دلار')  return `<span class="text-green-700 font-bold text-xs">$${Number(v).toLocaleString('en')}</span>`;
                        if (c === 'دینار') return `<span class="text-black-700 font-bold text-xs">${Number(v).toLocaleString('fa-IR')} د</span>`;
                        return `<span class="text-orange-700 font-bold text-xs">${Number(v).toLocaleString('fa-IR')} ت</span>`;
                    });
                return parts.length ? parts.join('<br>') : '—';
            }

            // مانده (ممکن است منفی = اضافه‌پرداخت باشد)
            const remainParts = ['تومان','دلار','دینار']
                .filter(c => (d.remainByCur[c]||0) !== 0)
                .map(c => {
                    const v = d.remainByCur[c];
                    const cls = v > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold';
                    if (c === 'دلار')  return `<span class="${cls} text-xs">$${Math.abs(v).toLocaleString('en')}${v<0?' (اضافه)':''}</span>`;
                    if (c === 'دینار') return `<span class="${cls} text-xs">${Math.abs(v).toLocaleString('fa-IR')} د${v<0?' (اضافه)':''}</span>`;
                    return `<span class="${cls} text-xs">${Math.abs(v).toLocaleString('fa-IR')} ت${v<0?' (اضافه)':''}</span>`;
                });
            const remainHtml = remainParts.length
                ? remainParts.join('<br>')
                : '<span class="text-green-600 font-bold text-xs">✓ تسویه</span>';

            // badge ارز
            const currencies = [...new Set([
                ...d.agreed.map(p=>p.currency),
                ...d.deposit.map(p=>p.currency),
                ...d.final_.map(p=>p.currency)
            ])];
            const curBadges = currencies.map(c => {
                if (c==='دلار')  return '<span class="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded font-bold">$ دلار</span>';
                if (c==='دینار') return '<span class="bg-blue-100 text-black-700 text-xs px-1.5 py-0.5 rounded font-bold">د دینار</span>';
                return '<span class="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded font-bold">ت تومان</span>';
            }).join(' ');

            return `
            <tr class="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                <td class="px-3 py-3 text-gray-400 text-xs text-center">${(i+1).toLocaleString('fa-IR')}</td>
                <td class="px-3 py-3 font-semibold text-gray-900 text-sm">${r.student_name || '—'}</td>
                <td class="px-3 py-3 text-xs">
                    <span class="bg-blue-100 text-black-800 text-xs px-2 py-1 rounded-lg">${r.work_type || '—'}</span>
                </td>
                <td class="px-3 py-3">${colAmt(d.agreedByCur)}</td>
                <td class="px-3 py-3">${colAmt(d.depositByCur)}</td>
                <td class="px-3 py-3">${colAmt(d.finalByCur)}</td>
                <td class="px-3 py-3">${remainHtml}</td>
                <td class="px-3 py-3">${curBadges || '—'}</td>
                <td class="px-3 py-3">
                    ${d.isSettled
                        ? '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">✓ تسویه</span>'
                        : '<span class="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">در انتظار</span>'}
                </td>
                <td class="px-3 py-3 text-gray-400 text-xs">${r.created_by_name || '—'}</td>
            </tr>`;
        }).join('');

        el.innerHTML = `
        <div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table class="w-full text-sm bg-white" style="min-width:960px">
                <thead>
                    <tr class="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
                        <th class="px-3 py-3 text-center">#</th>
                        <th class="px-3 py-3 text-right">نام دانشجو</th>
                        <th class="px-3 py-3 text-right">نوع کار</th>
                        <th class="px-3 py-3 text-right">مبلغ توافق</th>
                        <th class="px-3 py-3 text-right">بیعانه</th>
                        <th class="px-3 py-3 text-right">دریافتی</th>
                        <th class="px-3 py-3 text-right">مانده</th>
                        <th class="px-3 py-3 text-right">ارز</th>
                        <th class="px-3 py-3 text-right">وضعیت</th>
                        <th class="px-3 py-3 text-right">ثبت‌کننده</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <p class="text-gray-400 text-xs mt-2 text-left">${records.length.toLocaleString('fa-IR')} رکورد نمایش داده شده</p>`;
        el.classList.remove('hidden');
    }

    // ── بارگذاری داده ────────────────────────────────────────
    async function load() {
        const loading = document.getElementById('eacc-loading');
        const summary = document.getElementById('eacc-summary');
        const table   = document.getElementById('eacc-table');
        if (loading) loading.classList.remove('hidden');
        if (summary) summary.classList.add('hidden');
        if (table)   table.classList.add('hidden');

        _all = await getAll();
        _filtered = [..._all];

        if (loading) loading.classList.add('hidden');
        _applySort();
        renderSummary(calcSummary(_filtered));
        renderTable(_filtered);
    }

    // ── فیلتر real-time ──────────────────────────────────────
    function applyFilter() {
        const search  = (document.getElementById('eacc-search')?.value  || '').toLowerCase().trim();
        const settled = document.getElementById('eacc-filter-settled')?.value || '';
        const type    = document.getElementById('eacc-filter-type')?.value    || '';
        const cur     = document.getElementById('eacc-filter-cur')?.value     || '';

        _filtered = _all.filter(r => {
            const matchName    = !search || (r.student_name||'').toLowerCase().includes(search);
            const matchType    = !type   || (r.work_type||'').includes(type);
            const d = _calcRecord(r);
            let matchSettled   = true;
            if (settled === 'settled') matchSettled = d.isSettled;
            if (settled === 'pending') matchSettled = !d.isSettled;
            let matchCur       = true;
            if (cur) {
                matchCur = [...d.agreed, ...d.deposit, ...d.final_].some(p => p.currency === cur);
            }
            return matchName && matchType && matchSettled && matchCur;
        });

        _applySort();
        renderSummary(calcSummary(_filtered));
        renderTable(_filtered);
    }

    // ── مرتب‌سازی جدیدترین/قدیمی‌ترین ───────────────────────
    function toggleSort() {
        _sortDir = _sortDir === 'desc' ? 'asc' : 'desc';
        const icon  = document.getElementById('eacc-sort-icon');
        const label = document.getElementById('eacc-sort-label');
        if (icon)  icon.className  = _sortDir === 'desc'
            ? 'fas fa-sort-amount-down text-xs'
            : 'fas fa-sort-amount-up text-xs';
        if (label) label.textContent = _sortDir === 'desc' ? 'جدیدترین' : 'قدیمی‌ترین';
        _applySort();
        renderTable(_filtered);
    }

    function _applySort() {
        _filtered = _filtered.slice().sort((a, b) => {
            const da = new Date(a.created_at || 0).getTime();
            const db = new Date(b.created_at || 0).getTime();
            return _sortDir === 'desc' ? db - da : da - db;
        });
    }

    // ── خروجی CSV با فیلتر ───────────────────────────────────
    function showExportModal() {
        document.getElementById('eacc-export-modal')?.remove();

        // لیست اسامی برای انتخاب چند‌گانه
        const namesOpts = [...new Set(_all.map(r => r.student_name||'').filter(Boolean))]
            .map(n => `<option value="${n}">${n}</option>`).join('');

        const modal = document.createElement('div');
        modal.id = 'eacc-export-modal';
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between mb-5">
                <h3 class="text-gray-800 text-lg font-bold flex items-center gap-2">
                    <i class="fas fa-file-excel text-green-600"></i>خروجی Excel / CSV
                </h3>
                <button onclick="document.getElementById('eacc-export-modal').remove()" class="text-gray-400 hover:text-gray-700 text-xl"><i class="fas fa-times"></i></button>
            </div>
            <div class="space-y-3 text-sm">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-gray-600 text-xs mb-1 block">از تاریخ</label>
                        <input type="date" id="exp-from" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400">
                    </div>
                    <div>
                        <label class="text-gray-600 text-xs mb-1 block">تا تاریخ</label>
                        <input type="date" id="exp-to" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400">
                    </div>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">نوع کار</label>
                    <select id="exp-type" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
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
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">اسامی (چند انتخابی)</label>
                    <select id="exp-names" multiple size="5"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                        ${namesOpts}
                    </select>
                    <p class="text-gray-400 text-xs mt-1">Ctrl+کلیک برای چند انتخاب</p>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">ارز</label>
                    <select id="exp-cur" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                        <option value="">همه ارزها</option>
                        <option value="تومان">تومان</option>
                        <option value="دلار">دلار</option>
                        <option value="دینار">دینار</option>
                    </select>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">وضعیت تسویه</label>
                    <select id="exp-settled" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                        <option value="">همه</option>
                        <option value="settled">تسویه شده</option>
                        <option value="pending">تسویه نشده</option>
                    </select>
                </div>
            </div>
            <div class="flex gap-3 mt-5">
                <button onclick="EmbassyAccountingModule.doExportCSV()"
                    class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl transition-all">
                    <i class="fas fa-download ml-1"></i>دانلود CSV
                </button>
                <button onclick="document.getElementById('eacc-export-modal').remove()"
                    class="px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl">انصراف</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    function doExportCSV() {
        const from    = document.getElementById('exp-from')?.value || '';
        const to      = document.getElementById('exp-to')?.value   || '';
        const type    = document.getElementById('exp-type')?.value  || '';
        const curFlt  = document.getElementById('exp-cur')?.value   || '';
        const settled = document.getElementById('exp-settled')?.value || '';
        const selNames = Array.from(document.getElementById('exp-names')?.selectedOptions || []).map(o=>o.value);

        let data = [..._all];

        if (from)             data = data.filter(r => (r.created_at||'') >= from);
        if (to)               data = data.filter(r => (r.created_at||'') <= to + 'T23:59:59');
        if (type)             data = data.filter(r => (r.work_type||'').includes(type));
        if (selNames.length)  data = data.filter(r => selNames.includes(r.student_name));
        if (curFlt)           data = data.filter(r => {
            const d = _calcRecord(r);
            return [...d.agreed,...d.deposit,...d.final_].some(p => p.currency === curFlt);
        });
        if (settled === 'settled') data = data.filter(r => _calcRecord(r).isSettled);
        if (settled === 'pending') data = data.filter(r => !_calcRecord(r).isSettled);

        const BOM = '\uFEFF';
        const headers = ['نام دانشجو','نوع کار','توافق تومان','توافق دلار','توافق دینار',
                          'بیعانه تومان','بیعانه دلار','بیعانه دینار',
                          'دریافتی تومان','دریافتی دلار','دریافتی دینار',
                          'مانده تومان','مانده دلار','مانده دینار','وضعیت','ثبت‌کننده','تاریخ ثبت'];

        const rows = data.map(r => {
            const d = _calcRecord(r);
            const rem = d.remainByCur;
            return [
                r.student_name, r.work_type||'',
                d.agreedByCur.تومان||0,  d.agreedByCur.دلار||0,  d.agreedByCur.دینار||0,
                d.depositByCur.تومان||0, d.depositByCur.دلار||0, d.depositByCur.دینار||0,
                d.finalByCur.تومان||0,   d.finalByCur.دلار||0,   d.finalByCur.دینار||0,
                rem.تومان||0, rem.دلار||0, rem.دینار||0,
                d.isSettled ? 'تسویه' : 'در انتظار',
                r.created_by_name||'',
                (r.created_at||'').substring(0,10)
            ];
        });

        _downloadRtlExcel(headers, rows, `embassy_${new Date().toISOString().substring(0,10)}.xls`);
        document.getElementById('eacc-export-modal')?.remove();
    }

    // ── getContent: HTML اسکلت صفحه ─────────────────────────
    function getContent() {
        return `
        <div id="embassy-acc-app" class="space-y-6" dir="rtl">

            <!-- هدر — بدون دکمه برگشت -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                        <span class="bg-orange-500/20 p-2 rounded-xl">
                            <i class="fas fa-landmark text-orange-400"></i>
                        </span>
                        حسابداری سفارت
                    </h2>
                    <p class="text-gray-400 text-sm mt-1">گزارش مالی پرونده‌های سفارتی — به‌روزرسانی آنی</p>
                </div>
                <button onclick="EmbassyAccountingModule.showExportModal()"
                    class="bg-green-600 hover:bg-green-500 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg">
                    <i class="fas fa-file-excel"></i>خروجی Excel
                </button>
            </div>

            <!-- فیلترها -->
            <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div class="flex gap-2 flex-wrap">
                    <input type="text" id="eacc-search"
                        placeholder="🔍 جستجو نام دانشجو..."
                        oninput="EmbassyAccountingModule.applyFilter()"
                        class="flex-1 min-w-40 bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-orange-400">

                    <select id="eacc-filter-type" onchange="EmbassyAccountingModule.applyFilter()"
                        class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
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

                    <select id="eacc-filter-cur" onchange="EmbassyAccountingModule.applyFilter()"
                        class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                        <option value="">همه ارزها</option>
                        <option value="تومان">تومان</option>
                        <option value="دلار">$ دلار</option>
                        <option value="دینار">دینار</option>
                    </select>

                    <select id="eacc-filter-settled" onchange="EmbassyAccountingModule.applyFilter()"
                        class="bg-gray-50 text-gray-800 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                        <option value="">همه وضعیت‌ها</option>
                        <option value="settled">تسویه شده</option>
                        <option value="pending">تسویه نشده</option>
                    </select>

                    <button onclick="EmbassyAccountingModule.resetFilters()"
                        class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-all" title="پاک کردن فیلترها">
                        <i class="fas fa-times"></i>
                    </button>
                    <!-- مرتب‌سازی -->
                    <button onclick="EmbassyAccountingModule.toggleSort()"
                        class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1.5 transition-all" title="مرتب‌سازی">
                        <i class="fas fa-sort-amount-down text-xs" id="eacc-sort-icon"></i>
                        <span id="eacc-sort-label">جدیدترین</span>
                    </button>
                </div>
            </div>

            <!-- لودینگ -->
            <div id="eacc-loading" class="text-center py-12">
                <i class="fas fa-spinner fa-spin text-3xl text-orange-400"></i>
                <p class="text-gray-400 mt-3">در حال بارگذاری...</p>
            </div>

            <!-- خلاصه مالی -->
            <div id="eacc-summary" class="hidden"></div>

            <!-- جدول -->
            <div id="eacc-table" class="hidden"></div>

        </div>`;
    }

    // ── reset فیلترها ────────────────────────────────────────
    function resetFilters() {
        ['eacc-search','eacc-filter-type','eacc-filter-cur','eacc-filter-settled']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        _filtered = [..._all];
        _applySort();
        renderSummary(calcSummary(_filtered));
        renderTable(_filtered);
    }

    // ── Realtime subscription ────────────────────────────────
    let _realtimeSub = null;

    function _subscribeRealtime() {
        const client = sb();
        if (!client || _realtimeSub) return;
        try {
            _realtimeSub = client
                .channel('embassy_records_acc')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'embassy_records' },
                    () => { load(); }          // هر تغییر → reload بی‌صدا
                )
                .subscribe();
        } catch(e) {
            console.warn('EmbassyAccounting realtime:', e.message);
        }
    }

    // ── init ─────────────────────────────────────────────────
    function init() {
        setTimeout(async () => {
            await load();
            _subscribeRealtime();
        }, 100);
    }

    return {
        getContent,
        init,
        load,
        applyFilter,
        resetFilters,
        toggleSort,
        showExportModal,
        doExportCSV,
        getFilteredRecords: () => _filtered,
    };

})();

// ── تابع global که index.html صدا می‌زند ─────────────────────
function getEmbassyAccountingContent() {
    setTimeout(() => EmbassyAccountingModule.init(), 50);
    return EmbassyAccountingModule.getContent();
}
