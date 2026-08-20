/**
 * حسابداری شخصی — بازطراحی کامل
 * تمام داده‌ها روی Supabase (company_accounting + accounting_persons)
 * بدون localStorage — real-time با Supabase Realtime
 */
const AccountingUI = (function () {
    'use strict';

    const TBL   = 'company_accounting';
    const PTBL  = 'accounting_persons';
    const BUCKET = 'accounting-receipts';

    let _txns    = [];   // همه تراکنش‌ها
    let _persons = [];   // همه اشخاص
    let _sub     = null; // realtime subscription

    // ── فیلترهای فعال ───────────────────────────────────────
    let _fType   = '';
    let _fSearch = '';
    let _fPerson = '';
    let _fFrom   = '';
    let _fTo     = '';
    let _fSettled = '';   // '' = همه | 'yes' = تسویه‌شده | 'no' = تسویه‌نشده
    let _accSortDir = 'desc'; // 'desc' = جدیدترین اول | 'asc' = قدیمی‌ترین اول

    // ── Supabase client ──────────────────────────────────────
    function sb() {
        return (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
    }

    function esc(s) {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── فرمت عدد ────────────────────────────────────────────
    function fmtNum(n, cur) {
        const v = Math.abs(parseFloat(n) || 0);
        const formatted = v.toLocaleString('en-US');
        if (cur === 'دلار')  return '$' + formatted;
        if (cur === 'دینار') return formatted + ' د';
        return formatted + ' ت';
    }

    // ── جمع مبالغ از آرایه amounts ─────────────────────────
    function parseAmounts(tx) {
        // amounts جدید = [{amount, currency}]
        if (tx.amounts && Array.isArray(tx.amounts) && tx.amounts.length) {
            return tx.amounts.map(a => ({ amount: parseFloat(a.amount||0), currency: a.currency||'تومان' }))
                             .filter(a => a.amount > 0);
        }
        // fallback به فیلد قدیمی
        const a = parseFloat(tx.amount || 0);
        if (a > 0) return [{ amount: a, currency: tx.currency || 'تومان' }];
        return [];
    }

    function totalByCur(txns, types) {
        const m = { تومان:0, دلار:0, دینار:0 };
        txns.filter(t => !types || types.includes(t.type)).forEach(t => {
            parseAmounts(t).forEach(a => { m[a.currency] = (m[a.currency]||0) + a.amount; });
        });
        return m;
    }

    function fmtMulti(byCur, cls='') {
        return ['تومان','دلار','دینار'].filter(c=>(byCur[c]||0)>0)
            .map(c => `<span class="${cls}">${fmtNum(byCur[c],c)}</span>`)
            .join('<br>') || '—';
    }

    // ── بارگذاری داده ───────────────────────────────────────
    async function loadAll() {
        const client = sb();
        if (!client) { _txns = []; _persons = []; render(); return; }

        const [txRes, pRes] = await Promise.all([
            client.from(TBL).select('*').order('tx_date', { ascending: false }),
            client.from(PTBL).select('*').order('name')
        ]);

        _txns    = txRes.data  || [];
        _persons = pRes.data   || [];
        render();
    }

    // ── realtime ─────────────────────────────────────────────
    function subscribeRealtime() {
        const client = sb();
        if (!client || _sub) return;
        try {
            _sub = client.channel('acc_rt')
                .on('postgres_changes', { event: '*', schema: 'public', table: TBL  }, () => loadAll())
                .on('postgres_changes', { event: '*', schema: 'public', table: PTBL }, () => loadAll())
                .subscribe();
        } catch(e) { console.warn('accounting realtime:', e.message); }
    }

    // ── کارت‌های داشبورد ─────────────────────────────────────
    function renderDashboard(filtered) {
        const credit  = totalByCur(filtered, ['credit']);
        const debt    = totalByCur(filtered, ['debt']);

        // درآمد = تراکنش‌های نوع income + بستانکاری‌های تسویه‌شده
        const incomeBase    = totalByCur(filtered, ['income']);
        const settledCredit = totalByCur(filtered.filter(t => t.type==='credit' && t.is_settled), null);
        const incomeByCur   = {};
        ['تومان','دلار','دینار'].forEach(c => {
            const v = (incomeBase[c]||0) + (settledCredit[c]||0);
            if (v > 0) incomeByCur[c] = v;
        });

        // هزینه = تراکنش‌های نوع expense + بدهی‌های تسویه‌شده
        const expenseBase  = totalByCur(filtered, ['expense']);
        const settledDebt  = totalByCur(filtered.filter(t => t.type==='debt' && t.is_settled), null);
        const expenseByCur = {};
        ['تومان','دلار','دینار'].forEach(c => {
            const v = (expenseBase[c]||0) + (settledDebt[c]||0);
            if (v > 0) expenseByCur[c] = v;
        });

        // بستانکاری و بدهی فقط تسویه‌نشده‌ها
        const creditPending = totalByCur(filtered.filter(t => t.type==='credit' && !t.is_settled), null);
        const debtPending   = totalByCur(filtered.filter(t => t.type==='debt'   && !t.is_settled), null);

        // خالص دارایی = درآمد - هزینه
        const netByCur = {};
        ['تومان','دلار','دینار'].forEach(c => {
            const v = (incomeByCur[c]||0) - (expenseByCur[c]||0);
            if (v !== 0) netByCur[c] = v;
        });

        // حساب کارمندان
        const empUnsettled = (() => {
            try {
                if (typeof EmployeeAccountingModule === 'undefined') return null;
                const summary = EmployeeAccountingModule.getAllEmployeesSummary();
                const settlements = JSON.parse(localStorage.getItem('work_settlements')||'[]');
                const deductions  = JSON.parse(localStorage.getItem('work_deductions')||'[]');
                const gifts       = JSON.parse(localStorage.getItem('work_gifts')||'[]');
                const total = summary.reduce((t, emp) => {
                    const paid = settlements.filter(s=>s.employeeId===emp.employeeId).reduce((s,r)=>s+Number(r.amount||0),0);
                    const ded  = deductions.filter(d=>d.employeeId===emp.employeeId).reduce((s,d)=>s+Number(d.amount||0),0);
                    const gift = gifts.filter(g=>g.employeeId===emp.employeeId).reduce((s,g)=>s+Number(g.amount||0),0);
                    return t + Math.max(0, emp.grandTotal + gift - ded - paid);
                }, 0);
                return total;
            } catch { return null; }
        })();

        // حساب سفارت
        const embUnsettled = (() => {
            try {
                if (typeof EmbassyAccountingModule === 'undefined') return null;
                const all = EmbassyAccountingModule.getFilteredRecords
                    ? EmbassyAccountingModule.getFilteredRecords()
                    : (EmbassyAccountingModule._filtered || []);
                if (!all || all.length === 0) return null;
                const totals = {};
                all.forEach(r => {
                    const finalList = r.settlement_final_list && Array.isArray(r.settlement_final_list)
                        ? r.settlement_final_list
                        : (parseFloat(r.settlement_final) > 0
                            ? [{ amount: parseFloat(r.settlement_final), currency: r.settlement || 'تومان' }]
                            : []);
                    finalList.forEach(p => {
                        const cur = p.currency || 'تومان';
                        totals[cur] = (totals[cur] || 0) + parseFloat(p.amount || 0);
                    });
                });
                return totals;
            } catch { return null; }
        })();

        function card(title, content, bg, border, icon, iconColor, subtitle='') {
            return `
            <div class="${bg} rounded-2xl p-4 border ${border} shadow-sm">
                <div class="flex items-center gap-2 mb-2">
                    <i class="fas ${icon} ${iconColor} text-sm"></i>
                    <p class="text-gray-500 text-xs font-medium">${title}</p>
                </div>
                <div class="space-y-0.5">${content}</div>
                ${subtitle ? `<p class="text-gray-400 text-xs mt-1">${subtitle}</p>` : ''}
            </div>`;
        }

        // کمکی برای نمایش مقدار یا —
        function fmtOrDash(byCur, cls) {
            return Object.keys(byCur).length ? fmtMulti(byCur, cls) : '<span class="text-gray-400 text-sm">—</span>';
        }

        return `
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-4">
            ${card('درآمد',
                fmtOrDash(incomeByCur, 'text-emerald-700 font-bold text-sm'),
                'bg-emerald-50','border-emerald-200','fa-arrow-trend-up','text-emerald-500',
                'شامل بستانکاری تسویه‌شده')}
            ${card('هزینه',
                fmtOrDash(expenseByCur, 'text-red-600 font-bold text-sm'),
                'bg-red-50','border-red-200','fa-arrow-trend-down','text-red-400',
                'شامل بدهی تسویه‌شده')}
            ${card('خالص',
                Object.keys(netByCur).length
                    ? Object.entries(netByCur).map(([c,v])=>`<span class="${v>=0?'text-emerald-700':'text-red-600'} font-bold text-sm">${fmtNum(v,c)}</span>`).join('<br>')
                    : '<span class="text-gray-400 text-sm">—</span>',
                'bg-blue-50','border-blue-200','fa-chart-line','text-blue-500')}
            ${card('بستانکاری',
                fmtOrDash(creditPending, 'text-indigo-700 font-bold text-sm'),
                'bg-indigo-50','border-indigo-200','fa-coins','text-indigo-500',
                'در انتظار تسویه')}
            ${card('بدهکاری',
                fmtOrDash(debtPending, 'text-orange-700 font-bold text-sm'),
                'bg-orange-50','border-orange-200','fa-hand-holding-usd','text-orange-400',
                'در انتظار تسویه')}
            ${card('کارمندان', empUnsettled !== null
                ? `<span class="text-orange-700 font-bold text-sm">${empUnsettled.toLocaleString('en-US')} ت</span><p class="text-gray-400 text-xs">تسویه‌نشده</p>`
                : '<span class="text-gray-400 text-xs">در دسترس نیست</span>',
                'bg-orange-50','border-orange-200','fa-users','text-orange-500')}
            ${card('سفارت', embUnsettled && Object.keys(embUnsettled).length
                ? Object.entries(embUnsettled)
                    .filter(([,v]) => v > 0)
                    .map(([c, v]) => c === 'دلار'
                        ? `<span class="font-bold text-sm text-lime-700">$${Number(v).toLocaleString('en-US')}</span>`
                        : `<span class="font-bold text-sm text-lime-700">${Number(v).toLocaleString('en-US')} ${c==='دینار'?'د':'ت'}</span>`
                    ).join('<br>') + '<p class="text-gray-400 text-xs mt-0.5">جمع دریافتی‌ها</p>'
                : '<span class="text-lime-700 text-xs">→ حسابداری سفارت</span>',
                'bg-lime-50','border-lime-200','fa-landmark','text-lime-500')}
        </div>`;
    }

    // ── رندر جدول تراکنش‌ها ──────────────────────────────────
    function applyFilters() {
        let f = [..._txns];
        if (_fType)   f = f.filter(t => t.type === _fType);
        if (_fSearch) f = f.filter(t =>
            (t.description||'').includes(_fSearch) ||
            (t.category||'').includes(_fSearch) ||
            (t.person_name||'').includes(_fSearch) ||
            (t.person_free_text||'').includes(_fSearch));
        if (_fPerson) f = f.filter(t => t.person_acc_id === _fPerson || t.person_name === _fPerson || t.person_free_text === _fPerson);
        if (_fFrom)   f = f.filter(t => (t.tx_date||t.created_at||'') >= _fFrom);
        if (_fTo)     f = f.filter(t => (t.tx_date||t.created_at||'') <= _fTo + 'T23:59:59');
        if (_fSettled === 'yes') f = f.filter(t => t.is_settled);
        if (_fSettled === 'no')  f = f.filter(t => !t.is_settled);
        // مرتب‌سازی
        f = f.slice().sort((a, b) => {
            const da = new Date(a.tx_date || a.created_at || 0).getTime();
            const db = new Date(b.tx_date || b.created_at || 0).getTime();
            return _accSortDir === 'desc' ? db - da : da - db;
        });
        return f;
    }

    function toggleAccSort() {
        _accSortDir = _accSortDir === 'desc' ? 'asc' : 'desc';
        const icon  = document.getElementById('acc-sort-icon');
        const label = document.getElementById('acc-sort-label');
        if (icon)  icon.className  = _accSortDir === 'desc' ? 'fas fa-sort-amount-down text-xs' : 'fas fa-sort-amount-up text-xs';
        if (label) label.textContent = _accSortDir === 'desc' ? 'جدیدترین' : 'قدیمی‌ترین';
        _renderTable();
    }

    const TYPE_LABELS = { income:'درآمد', expense:'هزینه', debt:'بدهی', credit:'بستانکاری' };
    const TYPE_COLORS = {
        income:  'bg-emerald-100 text-emerald-800',
        expense: 'bg-red-100 text-red-700',
        debt:    'bg-orange-100 text-orange-700',
        credit:  'bg-indigo-100 text-indigo-800'
    };

    function renderTable(filtered) {
        if (!filtered.length) return `
            <div class="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <i class="fas fa-inbox text-4xl text-gray-300 mb-3 block"></i>
                <p class="text-gray-400">هیچ تراکنشی یافت نشد</p>
                <button onclick="AccountingUI.showAddModal()"
                    class="mt-3 text-sm text-blue-600 hover:underline">+ افزودن اولین تراکنش</button>
            </div>`;

        const rows = filtered.map((t,i) => {
            const amts = parseAmounts(t);
            const amtHtml = amts.map(a =>
                `<span class="font-bold text-sm ${t.type==='income'||t.type==='credit'?'text-emerald-700':'text-red-600'}">${fmtNum(a.amount, a.currency)}</span>`
            ).join('<br>') || '—';

            const personName = (() => {
                if (t.person_acc_id) {
                    const p = _persons.find(p=>p.id===t.person_acc_id);
                    return p ? p.name : (t.person_name||'');
                }
                return t.person_free_text || t.person_name || '';
            })();

            // ستون تسویه — فقط برای بدهکاری و بستانکاری
            const isDebtCredit = t.type === 'debt' || t.type === 'credit';
            const settledCell = isDebtCredit
                ? `<td class="px-3 py-3 text-center">
                    <button onclick="AccountingUI.toggleSettled('${t.id}', ${!t.is_settled})"
                        title="${t.is_settled ? 'تسویه شده — کلیک برای لغو' : 'تسویه نشده — کلیک برای تسویه'}"
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all
                            ${t.is_settled
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300'
                                : 'bg-gray-100 text-gray-400 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 border border-gray-200'}">
                        <i class="fas ${t.is_settled ? 'fa-check-circle' : 'fa-clock'} text-xs"></i>
                        ${t.is_settled ? 'تسویه شده' : 'در انتظار'}
                    </button>
                    ${t.is_settled && t.settled_at
                        ? `<p class="text-gray-300 text-xs mt-0.5">${(t.settled_at||'').substring(0,10)}</p>`
                        : ''}
                   </td>`
                : `<td class="px-3 py-3 text-center text-gray-200">—</td>`;

            // ردیف‌های تسویه‌شده کمی محو می‌شوند
            const rowClass = t.is_settled
                ? 'border-b border-gray-100 bg-emerald-50/40 hover:bg-emerald-50 transition-colors opacity-75'
                : 'border-b border-gray-100 hover:bg-gray-50 transition-colors';

            return `
            <tr class="${rowClass}">
                <td class="px-3 py-3 text-gray-400 text-xs text-center">${i+1}</td>
                <td class="px-3 py-3">
                    <span class="text-xs px-2 py-1 rounded-full font-medium ${TYPE_COLORS[t.type]||'bg-gray-100 text-gray-600'}">
                        ${TYPE_LABELS[t.type]||t.type}
                    </span>
                </td>
                <td class="px-3 py-3 text-gray-700 text-sm">${esc(t.category||'—')}</td>
                <td class="px-3 py-3">${amtHtml}</td>
                <td class="px-3 py-3 text-gray-500 text-sm max-w-xs truncate" title="${esc(t.description||'')}">
                    ${esc((t.description||t.note||'').substring(0,50))}</td>
                <td class="px-3 py-3 text-gray-500 text-sm">${personName ? `<span class="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">${esc(personName)}</span>` : '—'}</td>
                <td class="px-3 py-3 text-gray-400 text-xs">${_accJalaliDisplay((t.tx_date||t.created_at||'').substring(0,10))}</td>
                <td class="px-3 py-3 text-gray-300 text-xs" title="آخرین آپدیت">
                    ${t.updated_at && t.updated_at !== t.created_at
                        ? `<span class="flex items-center gap-1 whitespace-nowrap"><i class="fas fa-clock text-blue-300 text-xs"></i>${_accJalaliDisplay(t.updated_at.substring(0,10))}</span>`
                        : '—'}
                </td>
                <td class="px-3 py-3 text-center">
                    ${t.receipt_url
                        ? `<a href="${esc(t.receipt_url)}" target="_blank" class="text-blue-500 hover:text-blue-700 text-xs"><i class="fas fa-paperclip"></i></a>`
                        : ''}
                </td>
                ${settledCell}
                <td class="px-3 py-3 text-center">
                    <div class="flex gap-1 justify-center">
                        <button onclick="AccountingUI.showEditModal('${t.id}')"
                            class="w-7 h-7 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-all" title="ویرایش">
                            <i class="fas fa-edit text-xs"></i>
                        </button>
                        <button onclick="AccountingUI.deleteTransaction('${t.id}')"
                            class="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-all" title="حذف">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        // شمارش تسویه‌شده / نشده در بدهکاری و بستانکاری
        const debtCreditRows = filtered.filter(t => t.type==='debt'||t.type==='credit');
        const settledCount   = debtCreditRows.filter(t => t.is_settled).length;
        const pendingCount   = debtCreditRows.length - settledCount;

        return `
        <div class="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
            <table class="w-full text-sm" style="min-width:920px">
                <thead>
                    <tr class="bg-gray-50 text-gray-500 text-xs border-b border-gray-200">
                        <th class="px-3 py-3 text-center w-8">#</th>
                        <th class="px-3 py-3 text-right">نوع</th>
                        <th class="px-3 py-3 text-right">دسته‌بندی</th>
                        <th class="px-3 py-3 text-right">مبلغ</th>
                        <th class="px-3 py-3 text-right">توضیحات</th>
                        <th class="px-3 py-3 text-right">شخص</th>
                        <th class="px-3 py-3 text-right">تاریخ</th>
                        <th class="px-3 py-3 text-right">آخرین آپدیت</th>
                        <th class="px-3 py-3 text-center">رسید</th>
                        <th class="px-3 py-3 text-center">
                            تسویه شده
                            <span class="block text-gray-300 font-normal mt-0.5">
                                <span class="text-emerald-500">${settledCount} تسویه</span> /
                                <span class="text-orange-400">${pendingCount} در انتظار</span>
                            </span>
                        </th>
                        <th class="px-3 py-3 text-center">عملیات</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <p class="text-gray-400 text-xs mt-2 text-left">${filtered.length} تراکنش</p>`;
    }

    // ── رندر اصلی ────────────────────────────────────────────
    function render() {
        const container = document.getElementById('accounting-app');
        if (!container) return;

        const filtered = applyFilters();

        const personsOpts = _persons.map(p =>
            `<option value="${p.id}" ${_fPerson===p.id?'selected':''}>${esc(p.name)}</option>`
        ).join('');

        // ── برآیند کل بستانکار/بدهکار از همه تراکنش‌ها ──
        const allCredit = totalByCur(_txns, ['credit']);
        const allDebt   = totalByCur(_txns, ['debt']);
        const netBalance = {};
        ['تومان','دلار','دینار'].forEach(c => {
            const v = (allCredit[c]||0) - (allDebt[c]||0);
            if (v !== 0) netBalance[c] = v;
        });
        const netBalanceHtml = Object.keys(netBalance).length
            ? Object.entries(netBalance).map(([c,v]) =>
                `<span class="font-bold ${v>=0?'text-emerald-600':'text-red-500'}">${v>0?'+':''}${fmtNum(v,c)}</span>`
              ).join(' | ')
            : '<span class="text-gray-400 text-sm">—</span>';

        container.innerHTML = `
        <div class="space-y-4" dir="rtl">

            <!-- داشبورد -->
            ${renderDashboard(filtered)}

            <!-- برآیند کل تراکنش‌ها -->
            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex items-center gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                    <i class="fas fa-scale-balanced text-blue-500"></i>
                    <span class="text-gray-500 text-sm font-medium">برآیند کل (بستانکار − بدهکار):</span>
                </div>
                <div class="flex gap-3 flex-wrap">${netBalanceHtml}</div>
                <div class="mr-auto flex items-center gap-2 text-xs text-gray-400">
                    <span>${_txns.length} تراکنش کل</span>
                    <span>·</span>
                    <span class="text-indigo-500">${_txns.filter(t=>t.type==='credit').length} بستانکار</span>
                    <span>·</span>
                    <span class="text-orange-500">${_txns.filter(t=>t.type==='debt').length} بدهکار</span>
                </div>
            </div>

            <!-- نوار ابزار -->
            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
                <!-- ردیف اول: دکمه‌های عملیات -->
                <div class="flex flex-wrap gap-2 items-center mb-3">
                    <button onclick="AccountingUI.showAddModal()"
                        class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all">
                        <i class="fas fa-plus"></i>افزودن تراکنش
                    </button>
                    <button onclick="AccountingUI.showAddPersonModal()"
                        class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all">
                        <i class="fas fa-user-plus text-blue-500"></i>افزودن شخص
                    </button>
                    <button onclick="AccountingUI.showPersonsList()"
                        class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all">
                        <i class="fas fa-users text-lime-500"></i>اشخاص
                    </button>
                    <button onclick="AccountingUI.showExportModal()"
                        class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all">
                        <i class="fas fa-file-excel text-green-600"></i>خروجی Excel
                    </button>
                    <button onclick="AccountingUI.toggleAccSort()"
                        class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all" title="مرتب‌سازی">
                        <i class="fas fa-sort-amount-down text-xs" id="acc-sort-icon"></i>
                        <span id="acc-sort-label">جدیدترین</span>
                    </button>
                    <!-- جستجو -->
                    <div class="flex-1 min-w-40">
                        <input type="text" id="acc-search" value="${esc(_fSearch)}"
                            oninput="AccountingUI.onSearchInput(this.value)"
                            placeholder="🔍 جستجو در توضیحات، دسته و شخص..."
                            class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                    </div>
                </div>

                <!-- ردیف دوم: فیلترهای کشویی -->
                <details id="acc-filter-panel" class="group">
                    <summary class="flex items-center gap-2 cursor-pointer text-sm text-gray-500 hover:text-gray-700 select-none">
                        <i class="fas fa-filter text-xs"></i>
                        <span>فیلترها</span>
                        ${(_fType||_fPerson||_fFrom||_fTo||_fSettled) ? `<span class="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">فعال</span>` : ''}
                        <i class="fas fa-chevron-down text-xs group-open:rotate-180 transition-transform mr-auto"></i>
                    </summary>
                    <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-3 bg-gray-50 rounded-xl">

                        <!-- نوع تراکنش -->
                        <div>
                            <label class="text-gray-500 text-xs mb-1 block">نوع تراکنش</label>
                            <select id="acc-ftype" onchange="AccountingUI.onFilterType(this.value)"
                                class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                                <option value="" ${!_fType?'selected':''}>همه نوع‌ها</option>
                                <option value="income"  ${_fType==='income' ?'selected':''}>💰 درآمد</option>
                                <option value="expense" ${_fType==='expense'?'selected':''}>💸 هزینه</option>
                                <option value="debt"    ${_fType==='debt'   ?'selected':''}>📤 بدهکاری</option>
                                <option value="credit"  ${_fType==='credit' ?'selected':''}>📥 بستانکاری</option>
                            </select>
                        </div>

                        <!-- شخص -->
                        <div>
                            <label class="text-gray-500 text-xs mb-1 block">شخص</label>
                            <select id="acc-fperson" onchange="AccountingUI.onFilterPerson(this.value)"
                                class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                                <option value="">همه اشخاص</option>
                                ${personsOpts}
                            </select>
                        </div>

                        <!-- وضعیت تسویه -->
                        <div>
                            <label class="text-gray-500 text-xs mb-1 block">وضعیت تسویه</label>
                            <select id="acc-fsettled" onchange="AccountingUI.onFilterSettled(this.value)"
                                class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                                <option value="" ${!_fSettled?'selected':''}>همه</option>
                                <option value="yes" ${_fSettled==='yes'?'selected':''}>✅ تسویه شده</option>
                                <option value="no"  ${_fSettled==='no' ?'selected':''}>⏳ در انتظار</option>
                            </select>
                        </div>

                        <!-- از تاریخ — jalali -->
                        <div>
                            <label class="text-gray-500 text-xs mb-1 block">از تاریخ</label>
                            <div class="relative">
                                <input type="text" id="acc-ffrom-display" readonly
                                    value="${_accJalaliDisplay(_fFrom)}"
                                    placeholder="انتخاب تاریخ..."
                                    onclick="AccountingUI._openJalaliPicker('from')"
                                    class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 cursor-pointer text-right">
                                <input type="hidden" id="acc-ffrom" value="${_fFrom}">
                                ${_fFrom ? `<button type="button" onclick="AccountingUI._clearDateFilter('from')"
                                    class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs">×</button>` : ''}
                            </div>
                        </div>

                        <!-- تا تاریخ — jalali -->
                        <div>
                            <label class="text-gray-500 text-xs mb-1 block">تا تاریخ</label>
                            <div class="relative">
                                <input type="text" id="acc-ffto-display" readonly
                                    value="${_accJalaliDisplay(_fTo)}"
                                    placeholder="انتخاب تاریخ..."
                                    onclick="AccountingUI._openJalaliPicker('to')"
                                    class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 cursor-pointer text-right">
                                <input type="hidden" id="acc-ffto" value="${_fTo}">
                                ${_fTo ? `<button type="button" onclick="AccountingUI._clearDateFilter('to')"
                                    class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs">×</button>` : ''}
                            </div>
                        </div>

                        <!-- دکمه پاک کردن -->
                        ${(_fType||_fPerson||_fFrom||_fTo||_fSettled) ? `
                        <div class="flex items-end col-span-full sm:col-span-1">
                            <button onclick="AccountingUI.clearFilters()"
                                class="w-full bg-red-50 hover:bg-red-100 text-red-500 px-3 py-2 rounded-xl text-sm flex items-center justify-center gap-1 transition-all">
                                <i class="fas fa-times text-xs"></i>پاک کردن فیلترها
                            </button>
                        </div>` : ''}
                    </div>
                </details>
            </div>

            <!-- جدول تراکنش‌ها -->
            <div id="acc-table-container">
                ${renderTable(filtered)}
            </div>
        </div>

        <!-- jalali picker overlay -->
        <div id="acc-jalali-overlay" style="display:none"
             class="fixed inset-0 z-40 bg-transparent" onclick="AccountingUI._closeJalaliPicker()"></div>
        <div id="acc-jalali-popup" style="display:none; position:fixed; z-index:50;"
             class="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-72" dir="rtl">
            <div class="flex items-center justify-between mb-3">
                <button onclick="AccountingUI._jalaliPrevMonth()" class="text-gray-400 hover:text-gray-700 px-2">◄</button>
                <span id="acc-jalali-header" class="text-gray-700 font-bold text-sm"></span>
                <button onclick="AccountingUI._jalaliNextMonth()" class="text-gray-400 hover:text-gray-700 px-2">◄◄</button>
            </div>
            <div id="acc-jalali-grid" class="grid grid-cols-7 gap-0.5 text-xs"></div>
            <button onclick="AccountingUI._clearDateFilter(AccountingUI._jalaliTarget)"
                class="mt-3 w-full text-gray-400 hover:text-red-500 text-xs text-center">پاک کردن</button>
        </div>`;

        // باز کردن panel اگه فیلتر فعال بود
        if (_fType||_fPerson||_fFrom||_fTo||_fSettled) {
            setTimeout(() => {
                document.getElementById('acc-filter-panel')?.setAttribute('open','');
            }, 50);
        }
    }

    // ── event handlers فیلتر ────────────────────────────────
    function onSearchInput(v) { _fSearch = v.trim(); _renderTable(); }
    function onFilterType(v)    { _fType    = v; _renderTable(); _renderDash(); }
    function onFilterPerson(v)  { _fPerson  = v; _renderTable(); _renderDash(); }
    function onFilterFrom(v)    { _fFrom    = v; _renderTable(); _renderDash(); }
    function onFilterTo(v)      { _fTo      = v; _renderTable(); _renderDash(); }
    function onFilterSettled(v) { _fSettled = v; _renderTable(); _renderDash(); }
    function clearFilters() { _fType=_fSearch=_fPerson=_fFrom=_fTo=_fSettled=''; render(); }

    function _renderTable() {
        const el = document.getElementById('acc-table-container');
        if (el) el.innerHTML = renderTable(applyFilters());
    }
    function _renderDash() {
        const el = document.getElementById('accounting-app');
        if (!el) return;
        const dash = el.querySelector('.grid');
        if (dash) dash.outerHTML = renderDashboard(applyFilters());
    }

    // ── jalali datepicker داخلی (بدون وابستگی به lib) ───────
    // تبدیل میلادی (YYYY-MM-DD) به شمسی برای نمایش
    function _accJalaliDisplay(greg) {
        if (!greg) return '';
        try {
            const [y, m, d] = greg.split('-').map(Number);
            // الگوریتم تبدیل میلادی به شمسی
            const jd = _gregToJD(y, m, d);
            const [jy, jm, jday] = _jdToJalali(jd);
            const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
                            'مهر','آبان','آذر','دی','بهمن','اسفند'];
            return `${jday} ${months[jm-1]} ${jy}`;
        } catch(e) { return greg; }
    }

    // تبدیل شمسی به میلادی (YYYY-MM-DD)
    function _jalaliToGreg(jy, jm, jd) {
        const jdn = _jalaliToJD(jy, jm, jd);
        return _jdToGreg(jdn);
    }

    function _gregToJD(y, m, d) {
        return 367*y - Math.floor(7*(y+Math.floor((m+9)/12))/4)
               - Math.floor(3*(Math.floor((y+(m-9)/7)/100)+1)/4)
               + Math.floor(275*m/9) + d + 1721028.5;
    }
    function _jalaliToJD(jy, jm, jd) {
        const epbase = jy >= 0 ? jy - 474 : jy - 473;
        const epyear = 474 + epbase % 2820;
        return jd + Math.ceil(jm * 30.5 - 0.5) + (epyear*682 - 110) / 2816 * Math.floor(epyear/1 )
               + Math.floor(epyear/1) - 1 + Math.floor(epbase/2820) * 1029983
               + 1948319.5 - 1;
    }
    function _jdToJalali(jd) {
        jd = Math.floor(jd) + 0.5;
        const delta = jd - _jalaliToJD(475, 1, 1);
        const cycle = Math.floor(delta / 1029983);
        let rem = delta % 1029983;
        let ycycle;
        if (rem === 1029982) { ycycle = 2820; }
        else {
            const aux1 = Math.floor(rem / 366);
            const aux2 = rem % 366;
            ycycle = Math.floor((2134 * aux1 + 2816 * aux2 + 2815) / 1028522) + aux1 + 1;
        }
        let jy = ycycle + 2820 * cycle + 474;
        if (jy <= 0) jy--;
        const yday = jd - _jalaliToJD(jy, 1, 1) + 1;
        const jm = yday <= 186 ? Math.ceil(yday / 31) : Math.ceil((yday - 6) / 30);
        const jday = jd - _jalaliToJD(jy, jm, 1) + 1;
        return [jy, jm, jday];
    }
    function _jdToGreg(jd) {
        jd = Math.floor(jd) + 0.5;
        let z = Math.floor(jd + 0.5), a;
        const aa = Math.floor((z - 1867216.25) / 36524.25);
        a = z + 1 + aa - Math.floor(aa / 4);
        const b = a + 1524;
        const c = Math.floor((b - 122.1) / 365.25);
        const dd = Math.floor(365.25 * c);
        const e = Math.floor((b - dd) / 30.6001);
        const day = b - dd - Math.floor(30.6001 * e);
        const month = e < 14 ? e - 1 : e - 13;
        const year = month > 2 ? c - 4716 : c - 4715;
        return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }

    // ── mini jalali calendar popup ───────────────────────────
    let _jalaliTarget   = '';   // 'from' | 'to'
    let _jalaliCurYear  = 0;
    let _jalaliCurMonth = 0;

    function _openJalaliPicker(target) {
        _jalaliTarget = target;
        const existingVal = target === 'from'
            ? document.getElementById('acc-ffrom')?.value
            : document.getElementById('acc-ffto')?.value;

        // تنظیم ماه/سال اولیه
        let jy, jm;
        if (existingVal) {
            try {
                const [y, m, d] = existingVal.split('-').map(Number);
                const jd = _gregToJD(y, m, d);
                [jy, jm] = _jdToJalali(jd);
            } catch(e) { const now = _currentJalali(); jy = now[0]; jm = now[1]; }
        } else {
            const now = _currentJalali(); jy = now[0]; jm = now[1];
        }
        _jalaliCurYear  = jy;
        _jalaliCurMonth = jm;

        // موقعیت popup
        const trigger = document.getElementById(target === 'from' ? 'acc-ffrom-display' : 'acc-ffto-display');
        const popup   = document.getElementById('acc-jalali-popup');
        if (!popup || !trigger) return;

        const rect = trigger.getBoundingClientRect();
        popup.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
        popup.style.left = Math.max(8, rect.left + window.scrollX) + 'px';

        document.getElementById('acc-jalali-overlay').style.display = 'block';
        popup.style.display = 'block';
        _renderJalaliCalendar();
    }

    function _closeJalaliPicker() {
        document.getElementById('acc-jalali-overlay').style.display = 'none';
        document.getElementById('acc-jalali-popup').style.display   = 'none';
    }

    function _currentJalali() {
        const now = new Date();
        const jd  = _gregToJD(now.getFullYear(), now.getMonth()+1, now.getDate());
        return _jdToJalali(jd);
    }

    function _jalaliMonthDays(y, m) {
        if (m <= 6) return 31;
        if (m <= 11) return 30;
        // اسفند: ۲۹ یا ۳۰ بسته به کبیسه
        return ((((y - (y > 0 ? 474 : 473)) % 2820) + 474 + 38) * 682) % 2816 < 682 ? 30 : 29;
    }

    function _jalaliFirstWeekday(y, m) {
        const greg = _jalaliToGreg(y, m, 1);
        const [gy, gm, gd] = greg.split('-').map(Number);
        const dow = new Date(gy, gm-1, gd).getDay(); // 0=Sun
        // تبدیل به شنبه=0 (ایرانی)
        return (dow + 1) % 7;
    }

    function _renderJalaliCalendar() {
        const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
                        'مهر','آبان','آذر','دی','بهمن','اسفند'];
        const days   = ['ش','ی','د','س','چ','پ','ج'];
        document.getElementById('acc-jalali-header').textContent =
            `${months[_jalaliCurMonth-1]} ${_jalaliCurYear}`;

        // تعیین روز انتخاب‌شده فعلی برای هایلایت
        let selJY = 0, selJM = 0, selJD = 0;
        const selGreg = _jalaliTarget === 'from'
            ? document.getElementById('acc-ffrom')?.value
            : document.getElementById('acc-ffto')?.value;
        if (selGreg) {
            try {
                const [y,m,d] = selGreg.split('-').map(Number);
                const jd = _gregToJD(y,m,d);
                [selJY, selJM, selJD] = _jdToJalali(jd);
            } catch(e) {}
        }

        const totalDays = _jalaliMonthDays(_jalaliCurYear, _jalaliCurMonth);
        const firstDay  = _jalaliFirstWeekday(_jalaliCurYear, _jalaliCurMonth);
        const [nowJY, nowJM, nowJD] = _currentJalali();

        let html = days.map(d => `<div class="text-center text-gray-400 font-medium py-1">${d}</div>`).join('');
        for (let i = 0; i < firstDay; i++) html += `<div></div>`;
        for (let d = 1; d <= totalDays; d++) {
            const isToday = (d===nowJD && _jalaliCurMonth===nowJM && _jalaliCurYear===nowJY);
            const isSel   = (d===selJD && _jalaliCurMonth===selJM && _jalaliCurYear===selJY);
            html += `<button type="button"
                onclick="AccountingUI._pickJalaliDay(${d})"
                class="text-center py-1.5 rounded-lg text-xs transition-all
                ${isSel  ? 'bg-blue-600 text-white font-bold'
                : isToday ? 'bg-blue-50 text-blue-600 font-bold border border-blue-300'
                : 'hover:bg-gray-100 text-gray-700'}">${d}</button>`;
        }
        document.getElementById('acc-jalali-grid').innerHTML = html;
    }

    function _jalaliPrevMonth() {
        _jalaliCurMonth--;
        if (_jalaliCurMonth < 1) { _jalaliCurMonth = 12; _jalaliCurYear--; }
        _renderJalaliCalendar();
    }
    function _jalaliNextMonth() {
        _jalaliCurMonth++;
        if (_jalaliCurMonth > 12) { _jalaliCurMonth = 1; _jalaliCurYear++; }
        _renderJalaliCalendar();
    }

    function _pickJalaliDay(day) {
        const greg = _jalaliToGreg(_jalaliCurYear, _jalaliCurMonth, day);
        const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
                        'مهر','آبان','آذر','دی','بهمن','اسفند'];
        const displayVal = `${day} ${months[_jalaliCurMonth-1]} ${_jalaliCurYear}`;

        if (_jalaliTarget === 'from') {
            document.getElementById('acc-ffrom').value = greg;
            document.getElementById('acc-ffrom-display').value = displayVal;
            _fFrom = greg;
        } else {
            document.getElementById('acc-ffto').value = greg;
            document.getElementById('acc-ffto-display').value = displayVal;
            _fTo = greg;
        }
        _closeJalaliPicker();
        _renderTable();
        _renderDash();
        // هایلایت دکمه فیلتر
        const panel = document.getElementById('acc-filter-panel');
        if (panel && !panel.hasAttribute('open')) panel.setAttribute('open','');
    }

    function _clearDateFilter(target) {
        if (target === 'from') {
            _fFrom = '';
            const el = document.getElementById('acc-ffrom'); if (el) el.value = '';
            const disp = document.getElementById('acc-ffrom-display'); if (disp) disp.value = '';
        } else {
            _fTo = '';
            const el = document.getElementById('acc-ffto'); if (el) el.value = '';
            const disp = document.getElementById('acc-ffto-display'); if (disp) disp.value = '';
        }
        _renderTable();
        _renderDash();
    }

    // ── jalali picker برای فرم تراکنش (tx-date) ─────────────
    function _openTxDatePicker() {
        const existingVal = document.getElementById('tx-date')?.value;
        let jy, jm;
        if (existingVal) {
            try {
                const [y, m, d] = existingVal.split('-').map(Number);
                const jd = _gregToJD(y, m, d);
                [jy, jm] = _jdToJalali(jd);
            } catch(e) { const now = _currentJalali(); jy = now[0]; jm = now[1]; }
        } else {
            const now = _currentJalali(); jy = now[0]; jm = now[1];
        }

        // ساخت popup داخل مودال
        const existing = document.getElementById('tx-date-popup');
        if (existing) { existing.remove(); return; }

        const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
                        'مهر','آبان','آذر','دی','بهمن','اسفند'];
        const days   = ['ش','ی','د','س','چ','پ','ج'];

        const popup = document.createElement('div');
        popup.id = 'tx-date-popup';
        popup.className = 'bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-72 z-[100]';
        popup.style.cssText = 'position:absolute; margin-top:4px; direction:rtl;';
        popup.onclick = e => e.stopPropagation();

        function renderCal(cy, cm) {
            const totalDays = _jalaliMonthDays(cy, cm);
            const firstDay  = _jalaliFirstWeekday(cy, cm);
            const [nowJY, nowJM, nowJD] = _currentJalali();
            const selGreg = document.getElementById('tx-date')?.value;
            let selJY=0, selJM=0, selJD=0;
            if (selGreg) {
                try { const [y,m,d]=selGreg.split('-').map(Number); [selJY,selJM,selJD]=_jdToJalali(_gregToJD(y,m,d)); } catch(e){}
            }
            let html = `
                <div class="flex items-center justify-between mb-3">
                    <button type="button" class="text-gray-400 hover:text-gray-700 px-2" onclick="(function(){
                        let m=${cm}-1,y=${cy}; if(m<1){m=12;y--;} document.getElementById('tx-date-popup').innerHTML=''; document.getElementById('tx-date-popup')._render(y,m);
                    })()">◄</button>
                    <span class="text-gray-700 font-bold text-sm">${months[cm-1]} ${cy}</span>
                    <button type="button" class="text-gray-400 hover:text-gray-700 px-2" onclick="(function(){
                        let m=${cm}+1,y=${cy}; if(m>12){m=1;y++;} document.getElementById('tx-date-popup').innerHTML=''; document.getElementById('tx-date-popup')._render(y,m);
                    })()">◄◄</button>
                </div>
                <div class="grid grid-cols-7 gap-0.5 text-xs">`;
            html += days.map(d=>`<div class="text-center text-gray-400 font-medium py-1">${d}</div>`).join('');
            for (let i=0; i<firstDay; i++) html += '<div></div>';
            for (let d=1; d<=totalDays; d++) {
                const isT = d===nowJD && cm===nowJM && cy===nowJY;
                const isS = d===selJD && cm===selJM && cy===selJY;
                html += `<button type="button" onclick="AccountingUI._pickTxDate(${cy},${cm},${d})"
                    class="text-center py-1.5 rounded-lg text-xs transition-all
                    ${isS?'bg-blue-600 text-white font-bold':isT?'bg-blue-50 text-blue-600 font-bold border border-blue-300':'hover:bg-gray-100 text-gray-700'}">${d}</button>`;
            }
            html += '</div>';
            popup.innerHTML = html;
            popup._render = renderCal;
        }

        renderCal(jy, jm);
        popup._render = renderCal;

        const trigger = document.getElementById('tx-date-display');
        if (trigger) {
            trigger.parentElement.style.position = 'relative';
            trigger.parentElement.appendChild(popup);
        }

        // بستن با کلیک بیرون
        setTimeout(() => {
            document.addEventListener('click', function closeTxPicker(e) {
                if (!popup.contains(e.target) && e.target !== trigger) {
                    popup.remove();
                    document.removeEventListener('click', closeTxPicker);
                }
            });
        }, 10);
    }

    function _pickTxDate(jy, jm, jd) {
        const greg = _jalaliToGreg(jy, jm, jd);
        const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
                        'مهر','آبان','آذر','دی','بهمن','اسفند'];
        document.getElementById('tx-date').value = greg;
        document.getElementById('tx-date-display').value = `${jd} ${months[jm-1]} ${jy}`;
        document.getElementById('tx-date-popup')?.remove();
    }

    // ── مودال افزودن/ویرایش تراکنش ──────────────────────────
    function showAddModal()      { _showTxModal(null); }
    function showEditModal(id)   { _showTxModal(_txns.find(t=>t.id===id)||null); }

    function _buildPersonOptions(selId) {
        return `<option value="">بدون شخص</option>` +
            _persons.map(p=>`<option value="${p.id}" ${selId===p.id?'selected':''}>${esc(p.name)}</option>`).join('');
    }

    function _showTxModal(tx) {
        document.getElementById('acc-modal')?.remove();
        const isEdit = !!tx;
        const today = new Date().toISOString().split('T')[0];
        const amts  = tx ? parseAmounts(tx) : [{ amount:'', currency:'تومان' }];

        const amtRows = amts.map((a,i) => `
            <div class="flex gap-2 items-center amt-row" data-idx="${i}">
                <input type="number" min="0" step="1" placeholder="مبلغ" value="${a.amount||''}"
                    class="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 amt-input">
                <select class="bg-gray-50 border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none cur-select" style="min-width:60px">
                    <option value="تومان" ${(a.currency||'تومان')==='تومان'?'selected':''}>تومان</option>
                    <option value="دلار"  ${a.currency==='دلار' ?'selected':''}>$ دلار</option>
                    <option value="دینار" ${a.currency==='دینار'?'selected':''}>دینار</option>
                </select>
                <button type="button" onclick="this.closest('.amt-row').remove()"
                    class="text-red-400 hover:text-red-600 text-lg px-1">×</button>
            </div>`).join('');

        const modal = document.createElement('div');
        modal.id = 'acc-modal';
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-auto" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between mb-5">
                <h3 class="text-gray-800 text-lg font-bold">${isEdit?'ویرایش تراکنش':'تراکنش جدید'}</h3>
                <button onclick="document.getElementById('acc-modal').remove()" class="text-gray-400 hover:text-gray-700 text-xl"><i class="fas fa-times"></i></button>
            </div>
            <div class="space-y-3 text-sm">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-gray-600 text-xs mb-1 block">نوع تراکنش *</label>
                        <select id="tx-type" onchange="AccountingUI._onTypeChange(this.value)"
                            class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
                            <option value="debt"    ${(!tx || tx?.type==='debt'   )?'selected':''}>بدهکاری</option>
                            <option value="credit"  ${tx?.type==='credit' ?'selected':''}>بستانکاری</option>
                            <option value="income"  ${tx?.type==='income' ?'selected':''}>درآمد</option>
                            <option value="expense" ${tx?.type==='expense'?'selected':''}>هزینه</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-gray-600 text-xs mb-1 block">تاریخ</label>
                        <div class="relative">
                            <input type="text" id="tx-date-display" readonly
                                value="${_accJalaliDisplay(tx?.tx_date||today)}"
                                onclick="AccountingUI._openTxDatePicker()"
                                placeholder="انتخاب تاریخ..."
                                class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none cursor-pointer text-right">
                            <input type="hidden" id="tx-date" value="${tx?.tx_date||today}">
                        </div>
                    </div>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">دسته‌بندی</label>
                    <input type="text" id="tx-category" value="${esc(tx?.category||'')}" placeholder="مثال: اجاره، حقوق، فروش..."
                        class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">مبلغ(ها) *</label>
                    <div id="tx-amounts" class="space-y-2">${amtRows}</div>
                    <button type="button" onclick="AccountingUI._addAmountRow()"
                        class="mt-2 text-blue-600 hover:text-blue-500 text-xs flex items-center gap-1">
                        <i class="fas fa-plus"></i>افزودن مبلغ با ارز دیگر
                    </button>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">شخص (اختیاری)</label>
                    <div class="flex gap-2">
                        <select id="tx-person-sel" class="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">
                            ${_buildPersonOptions(tx?.person_acc_id||'')}
                        </select>
                    </div>
                    <input type="text" id="tx-person-text" value="${esc(tx?.person_free_text||tx?.person_name||'')}"
                        placeholder="یا نام شخص را بنویسید (به لیست اضافه می‌شود)"
                        class="w-full mt-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">
                    <p class="text-gray-400 text-xs mt-0.5">اگر نام بنویسید به لیست اشخاص اضافه می‌شود</p>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">توضیحات</label>
                    <textarea id="tx-desc" rows="2" placeholder="توضیحات تراکنش..."
                        class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none resize-none">${esc(tx?.description||tx?.note||'')}</textarea>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">رسید / پیوست</label>
                    ${tx?.receipt_url ? `<a href="${esc(tx.receipt_url)}" target="_blank" class="text-blue-500 text-xs mb-1 block"><i class="fas fa-paperclip ml-1"></i>رسید موجود</a>` : ''}
                    <input type="file" id="tx-receipt" accept="image/*,application/pdf"
                        class="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                </div>
                <!-- چک‌باکس تسویه — فقط برای بدهکاری و بستانکاری -->
                <label id="tx-settled-row" onclick="_txSettledToggle()"
                    style="${(tx?.type==='income'||tx?.type==='expense') ? 'display:none' : ''}"
                    class="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border-2 transition-all
                    ${tx?.is_settled ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-emerald-300'}">
                    <input type="checkbox" id="tx-settled" ${tx?.is_settled ? 'checked' : ''} class="hidden">
                    <div id="tx-settled-box"
                        class="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                        ${tx?.is_settled ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 bg-white'}">
                        <i class="fas fa-check text-white text-xs ${tx?.is_settled ? '' : 'hidden'}" id="tx-settled-check"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-gray-700 text-sm font-medium">تسویه شده</p>
                        <p class="text-gray-400 text-xs">این بدهکاری/بستانکاری کاملاً تسویه شده است</p>
                    </div>
                    <i id="tx-settled-icon-big" class="fas fa-check-circle text-xl ${tx?.is_settled ? 'text-emerald-500' : 'text-gray-200'}"></i>
                </label>
            </div>
            <div class="flex gap-3 mt-5">
                <button onclick="AccountingUI._submitTx('${tx?.id||''}')"
                    class="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl transition-all">
                    <i class="fas fa-save ml-1"></i>${isEdit?'ذخیره تغییرات':'ثبت تراکنش'}
                </button>
                <button onclick="document.getElementById('acc-modal').remove()"
                    class="px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl">انصراف</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target===modal) modal.remove(); });
    }

    function _addAmountRow() {
        const c = document.getElementById('tx-amounts');
        if (!c) return;
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-center amt-row';
        div.innerHTML = `
            <input type="number" min="0" step="1" placeholder="مبلغ"
                class="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 amt-input">
            <select class="bg-gray-50 border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none cur-select" style="min-width:60px">
                <option value="تومان">تومان</option>
                <option value="دلار">$ دلار</option>
                <option value="دینار">دینار</option>
            </select>
            <button type="button" onclick="this.closest('.amt-row').remove()" class="text-red-400 hover:text-red-600 text-lg px-1">×</button>`;
        c.appendChild(div);
    }

    // نمایش/پنهان کردن چک‌باکس تسویه بر اساس نوع تراکنش
    function _onTypeChange(type) {
        const row = document.getElementById('tx-settled-row');
        if (!row) return;
        if (type === 'income' || type === 'expense') {
            row.style.display = 'none';
            const cb = document.getElementById('tx-settled');
            if (cb) cb.checked = false;
        } else {
            row.style.display = 'flex';
        }
    }

    // تابع global برای toggle چک‌باکس تسویه در مودال
    window._txSettledToggle = function() {        const cb      = document.getElementById('tx-settled');
        const box     = document.getElementById('tx-settled-box');
        const check   = document.getElementById('tx-settled-check');
        const iconBig = document.getElementById('tx-settled-icon-big');
        const row     = document.getElementById('tx-settled-row');
        if (!cb) return;
        cb.checked = !cb.checked;
        if (cb.checked) {
            box.className     = box.className.replace('border-gray-300 bg-white', 'border-emerald-500 bg-emerald-500');
            check.classList.remove('hidden');
            iconBig.className = iconBig.className.replace('text-gray-200', 'text-emerald-500');
            row.style.borderColor     = '#34d399';
            row.style.backgroundColor = '#f0fdf4';
        } else {
            box.className     = box.className.replace('border-emerald-500 bg-emerald-500', 'border-gray-300 bg-white');
            check.classList.add('hidden');
            iconBig.className = iconBig.className.replace('text-emerald-500', 'text-gray-200');
            row.style.borderColor     = '#e5e7eb';
            row.style.backgroundColor = '#f9fafb';
        }
    };

    function _onPersonSelChange(sel) {
        if (sel.value === '__new__') {
            sel.value = '';
            showAddPersonModal();
        }
    }

    // ── submit تراکنش ────────────────────────────────────────
    async function _submitTx(editId) {
        const client = sb();
        if (!client) { alert('اتصال به Supabase برقرار نیست'); return; }

        const type     = document.getElementById('tx-type')?.value;
        const txDate   = document.getElementById('tx-date')?.value;
        const category = document.getElementById('tx-category')?.value.trim() || '';
        const desc     = document.getElementById('tx-desc')?.value.trim() || '';
        const personSel = document.getElementById('tx-person-sel')?.value || '';
        const personTxt = document.getElementById('tx-person-text')?.value.trim() || '';

        // جمع‌آوری مبالغ
        const amounts = [];
        document.querySelectorAll('#tx-amounts .amt-row').forEach(row => {
            const amt = parseFloat(row.querySelector('.amt-input')?.value || 0);
            const cur = row.querySelector('.cur-select')?.value || 'تومان';
            if (amt > 0) amounts.push({ amount: amt, currency: cur });
        });
        if (!amounts.length) { alert('حداقل یک مبلغ وارد کنید'); return; }

        // مدیریت شخص
        let personAccId   = personSel || null;
        let personName    = '';
        let personFreeText = '';

        if (personTxt && !personSel) {
            // شخص جدید — اضافه به accounting_persons
            const { data: np } = await client.from(PTBL)
                .insert({ name: personTxt, type: 'other' }).select().single();
            if (np) {
                personAccId = np.id;
                personName  = np.name;
                _persons.push(np);
            } else {
                personFreeText = personTxt;
            }
        } else if (personSel) {
            const p = _persons.find(p=>p.id===personSel);
            personName = p?.name || '';
        }
        
        // آپلود رسید
        let receiptUrl = editId ? (_txns.find(t=>t.id===editId)?.receipt_url || null) : null;
        const fileInput = document.getElementById('tx-receipt');
        if (fileInput?.files?.length) {
            const file = fileInput.files[0];
            const path = `receipts/${Date.now()}_${file.name.replace(/\s/g,'_')}`;
            const { error: upErr } = await client.storage.from(BUCKET).upload(path, file, { upsert: true });
            if (!upErr) {
                const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(path);
                receiptUrl = urlData?.publicUrl || null;
            }
        }

        // مبلغ اول برای فیلد scalar (backward compat)
        const firstAmt = amounts[0];

        const isSettled   = document.getElementById('tx-settled')?.checked ?? false;

        const payload = {
            type,
            tx_date:         txDate || new Date().toISOString().split('T')[0],
            category,
            description:     desc,
            amounts:         amounts,
            amount:          firstAmt.amount,
            currency:        firstAmt.currency,
            person_acc_id:   personAccId,
            person_name:     personName,
            person_free_text: personFreeText,
            receipt_url:     receiptUrl,
            is_settled:      isSettled,
            settled_at:      isSettled ? (editId && _txns.find(t=>t.id===editId)?.settled_at) || new Date().toISOString() : null,
        };

        let err;
        if (editId) {
            ({ error: err } = await client.from(TBL).update(payload).eq('id', editId));
        } else {
            ({ error: err } = await client.from(TBL).insert([payload]));
        }

        if (err) { alert('خطا: ' + err.message); return; }

        document.getElementById('acc-modal')?.remove();
        // realtime خودکار reload می‌کند — اگر نه، دستی:
        await loadAll();
    }

    // ── حذف تراکنش ──────────────────────────────────────────
    async function deleteTransaction(id) {
        if (!confirm('این تراکنش حذف شود؟')) return;
        const client = sb();
        if (!client) return;
        await client.from(TBL).delete().eq('id', id);
        await loadAll();
    }

    // ── تغییر وضعیت تسویه از جدول ───────────────────────────
    async function toggleSettled(id, newVal) {
        const client = sb();
        if (!client) return;
        const payload = {
            is_settled: newVal,
            settled_at: newVal ? new Date().toISOString() : null,
        };
        await client.from(TBL).update(payload).eq('id', id);
        // بروزرسانی آرایه داخلی بدون reload کامل
        const tx = _txns.find(t => t.id === id);
        if (tx) {
            tx.is_settled = newVal;
            tx.settled_at = payload.settled_at;
        }
        _renderTable();
    }

    // ── افزودن شخص ──────────────────────────────────────────
    function showAddPersonModal() {
        document.getElementById('acc-person-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'acc-person-modal';
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4';
        modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-gray-800 font-bold">شخص جدید</h3>
                <button onclick="document.getElementById('acc-person-modal').remove()" class="text-gray-400 hover:text-gray-700 text-xl"><i class="fas fa-times"></i></button>
            </div>
            <div class="space-y-3 text-sm">
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">نام *</label>
                    <input type="text" id="np-name" placeholder="نام کامل"
                        class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">نوع</label>
                    <select id="np-type" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
                        <option value="other">سایر</option>
                        <option value="student">دانشجو</option>
                        <option value="supplier">بازار</option>
                        <option value="partner">همکار</option>
                    </select>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">شماره تماس</label>
                    <input type="text" id="np-phone" placeholder="شماره تماس"
                        class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">توضیحات</label>
                    <textarea id="np-notes" rows="2"
                        class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none resize-none"></textarea>
                </div>
            </div>
            <div class="flex gap-3 mt-5">
                <button onclick="AccountingUI._submitPerson()"
                    class="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl">ثبت شخص</button>
                <button onclick="document.getElementById('acc-person-modal').remove()"
                    class="px-5 bg-gray-100 text-gray-700 py-2.5 rounded-xl">انصراف</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target===modal) modal.remove(); });
    }

    async function _submitPerson() {
        const client = sb();
        if (!client) { alert('اتصال برقرار نیست'); return; }
        const name = document.getElementById('np-name')?.value.trim();
        if (!name) { alert('نام الزامی است'); return; }

        // بررسی تکراری بودن نام — مقایسه case-insensitive و بدون فاصله اضافه
        const duplicate = _persons.find(p =>
            p.name.trim().replace(/\s+/g, ' ').toLowerCase() ===
            name.replace(/\s+/g, ' ').toLowerCase()
        );
        if (duplicate) {
            alert(`این شخص قبلاً ایجاد شده است:\n«${duplicate.name}»`);
            return;
        }

        const { data, error } = await client.from(PTBL).insert([{
            name,
            type:  document.getElementById('np-type')?.value || 'other',
            phone: document.getElementById('np-phone')?.value.trim() || '',
            notes: document.getElementById('np-notes')?.value.trim() || ''
        }]).select().single();
        if (error) { alert('خطا: ' + error.message); return; }
        _persons.push(data);
        document.getElementById('acc-person-modal')?.remove();
        render();
    }

    // ── لیست اشخاص ──────────────────────────────────────────
    function showPersonsList() {
        document.getElementById('acc-plist-modal')?.remove();

        const rows = _persons.length
            ? _persons.map(p => {
                const pTxns   = _txns.filter(t => t.person_acc_id === p.id);
                const txCount = pTxns.length;

                // برآیند چندارزی: بستانکار − بدهکار به تفکیک ارز
                const netByCur = { تومان:0, دلار:0, دینار:0 };
                pTxns.forEach(t => {
                    const sign = (t.type==='credit'||t.type==='income') ? 1 : -1;
                    parseAmounts(t).forEach(a => { netByCur[a.currency] = (netByCur[a.currency]||0) + sign*a.amount; });
                });
                const netEntries = Object.entries(netByCur).filter(([,v]) => v !== 0);

                const badge = txCount
                    ? `<span class="bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">${txCount} تراکنش</span>`
                    : '';

                // برآیند inline — چند ارز
                const netBadge = txCount
                    ? netEntries.length
                        ? netEntries.map(([c,v]) => {
                            const cls = v > 0 ? 'text-emerald-600' : 'text-red-500';
                            const sign = v > 0 ? '+' : '';
                            return `<span class="text-xs ${cls} font-medium">${sign}${fmtNum(v,c)}</span>`;
                          }).join(' <span class="text-gray-300">|</span> ')
                        : '<span class="text-xs text-gray-400">تسویه</span>'
                    : '<span class="text-xs text-gray-300">بدون تراکنش</span>';

                // رنگ‌بندی کلی ردیف بر اساس اولین ارز
                const firstNet = netEntries[0]?.[1] ?? 0;
                const rowAccent = firstNet > 0 ? 'border-r-2 border-emerald-300'
                                : firstNet < 0 ? 'border-r-2 border-red-300'
                                : '';

                return `
                <div class="flex items-center justify-between py-3 px-2 border-b border-gray-100 last:border-0
                            hover:bg-gray-50 rounded-xl cursor-pointer transition-all group ${rowAccent}"
                     onclick="AccountingUI.showPersonDetail('${p.id}')">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-user text-blue-400 text-xs"></i>
                        </div>
                        <div>
                            <p class="font-medium text-gray-800 text-sm flex items-center gap-1.5 flex-wrap">
                                ${esc(p.name)} ${badge}
                            </p>
                            <p class="text-gray-400 text-xs mt-0.5 flex items-center gap-1 flex-wrap">
                                ${p.phone ? `<span>${p.phone}</span><span class="text-gray-200">·</span>` : ''}
                                برآیند: ${netBadge}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onclick="event.stopPropagation(); AccountingUI._deletePerson('${p.id}')"
                            class="text-red-400 hover:text-white hover:bg-red-500 text-xs px-2 py-1 rounded-lg transition-all" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                        <i class="fas fa-chevron-left text-gray-300 text-xs ml-1"></i>
                    </div>
                </div>`;
            }).join('')
            : '<p class="text-gray-400 text-center py-8 text-sm">هیچ شخصی ثبت نشده</p>';

        const modal = document.createElement('div');
        modal.id = 'acc-plist-modal';
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-gray-800 font-bold flex items-center gap-2">
                    <i class="fas fa-users text-blue-500"></i>اشخاص
                    <span class="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">${_persons.length}</span>
                </h3>
                <div class="flex gap-2">
                    <button onclick="AccountingUI.showAddPersonModal()"
                        class="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-xl hover:bg-blue-500 flex items-center gap-1">
                        <i class="fas fa-plus text-xs"></i>جدید
                    </button>
                    <button onclick="document.getElementById('acc-plist-modal').remove()"
                        class="text-gray-400 hover:text-gray-700 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <p class="text-gray-400 text-xs mb-3">روی هر شخص کلیک کنید تا برآیند تراکنش‌هایش را ببینید</p>
            <div class="overflow-auto flex-1">${rows}</div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target===modal) modal.remove(); });
    }

    function showPersonDetail(personId) {
        const p     = _persons.find(x => x.id === personId);
        if (!p) return;
        const pTxns = _txns.filter(t => t.person_acc_id === personId);

        // ── محاسبه برآیند به تفکیک ارز ──
        const summary = {};
        const TYPES   = { debt:'بدهکاری', credit:'بستانکاری', income:'درآمد', expense:'هزینه' };

        pTxns.forEach(t => {
            parseAmounts(t).forEach(a => {
                const cur = a.currency || 'تومان';
                if (!summary[cur]) summary[cur] = { debt:0, credit:0, income:0, expense:0 };
                summary[cur][t.type] = (summary[cur][t.type]||0) + a.amount;
            });
        });

        // ── کارت‌های برآیند ──
        const summaryCards = Object.keys(summary).length
            ? Object.entries(summary).map(([cur, s]) => {
                const net = (s.credit||0) + (s.income||0) - (s.debt||0) - (s.expense||0);
                const netColor   = net > 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                                 : net < 0 ? 'text-red-500 bg-red-50 border-red-200'
                                 :           'text-gray-500 bg-gray-50 border-gray-200';
                const netLabel   = net > 0 ? 'طلبکار' : net < 0 ? 'بدهکار' : 'تسویه';
                const netSign    = net > 0 ? '+' : '';
                return `
                <div class="rounded-xl border ${netColor} p-3 mb-2">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-bold">${cur}</span>
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full border ${netColor}">
                            ${netLabel}: ${netSign}${Math.abs(net).toLocaleString('en-US')}
                        </span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        ${(s.credit||0)>0  ? `<div class="flex justify-between"><span class="text-gray-500">بستانکاری</span><span class="text-emerald-600 font-medium">+${s.credit.toLocaleString('en-US')}</span></div>` : ''}
                        ${(s.income||0)>0  ? `<div class="flex justify-between"><span class="text-gray-500">درآمد</span><span class="text-emerald-600 font-medium">+${s.income.toLocaleString('en-US')}</span></div>` : ''}
                        ${(s.debt||0)>0    ? `<div class="flex justify-between"><span class="text-gray-500">بدهکاری</span><span class="text-red-500 font-medium">-${s.debt.toLocaleString('en-US')}</span></div>` : ''}
                        ${(s.expense||0)>0 ? `<div class="flex justify-between"><span class="text-gray-500">هزینه</span><span class="text-red-500 font-medium">-${s.expense.toLocaleString('en-US')}</span></div>` : ''}
                    </div>
                </div>`;
            }).join('')
            : `<p class="text-gray-400 text-sm text-center py-4">تراکنشی برای این شخص ثبت نشده</p>`;

        // ── ریز تراکنش‌ها ──
        const txRows = pTxns.length
            ? pTxns.slice().sort((a,b)=>new Date(b.tx_date||b.created_at||0)-new Date(a.tx_date||a.created_at||0))
                .map(t => {
                    const amts    = parseAmounts(t);
                    const amtHtml = amts.map(a =>
                        `<span class="font-medium ${t.type==='credit'||t.type==='income'?'text-emerald-600':'text-red-500'}">${fmtNum(a.amount,a.currency)}</span>`
                    ).join(' · ');
                    const settledBadge = (t.type==='debt'||t.type==='credit') && t.is_settled
                        ? `<span class="text-emerald-500 text-xs ml-1" title="تسویه شده"><i class="fas fa-check-circle"></i></span>`
                        : '';
                    return `
                    <div class="flex items-start justify-between py-2.5 border-b border-gray-100 last:border-0 gap-2">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[t.type]||'bg-gray-100 text-gray-600'}">
                                    ${TYPE_LABELS[t.type]||t.type}
                                </span>
                                ${settledBadge}
                                ${t.category ? `<span class="text-gray-400 text-xs">${esc(t.category)}</span>` : ''}
                            </div>
                            ${t.description ? `<p class="text-gray-500 text-xs mt-0.5 truncate">${esc(t.description.substring(0,60))}</p>` : ''}
                        </div>
                        <div class="text-right flex-shrink-0">
                            <div class="text-sm">${amtHtml}</div>
                            <div class="text-gray-300 text-xs">${_accJalaliDisplay((t.tx_date||t.created_at||'').substring(0,10))}</div>
                        </div>
                    </div>`;
                }).join('')
            : '<p class="text-gray-400 text-xs text-center py-4">بدون تراکنش</p>';

        document.getElementById('acc-person-detail-modal')?.remove();
        const modal = document.createElement('div');
        modal.id    = 'acc-person-detail-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4';
        modal.innerHTML = `
        <div class="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[88vh] flex flex-col" onclick="event.stopPropagation()">
            <!-- هدر -->
            <div class="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                <div class="flex items-center gap-3">
                    <button onclick="document.getElementById('acc-person-detail-modal').remove()"
                        class="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
                        <i class="fas fa-arrow-right text-sm"></i>
                    </button>
                    <div class="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                        <i class="fas fa-user text-blue-500 text-sm"></i>
                    </div>
                    <div>
                        <h3 class="text-gray-800 font-bold text-base">${esc(p.name)}</h3>
                        ${p.phone ? `<p class="text-gray-400 text-xs">${esc(p.phone)}</p>` : ''}
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="AccountingUI.onFilterPerson('${p.id}'); document.getElementById('acc-person-detail-modal').remove(); document.getElementById('acc-plist-modal')?.remove(); AccountingUI.render();"
                        class="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all">
                        <i class="fas fa-filter text-xs"></i>فیلتر
                    </button>
                    <button onclick="document.getElementById('acc-person-detail-modal').remove()"
                        class="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div class="overflow-auto flex-1 px-5 py-4 space-y-4">
                <!-- برآیند -->
                <div>
                    <h4 class="text-gray-600 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <i class="fas fa-chart-pie text-blue-400"></i>برآیند مالی
                    </h4>
                    ${summaryCards}
                </div>

                <!-- آمار سریع -->
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-gray-50 rounded-xl py-2 px-3">
                        <p class="text-lg font-bold text-gray-800">${pTxns.length}</p>
                        <p class="text-gray-400 text-xs">تراکنش</p>
                    </div>
                    <div class="bg-emerald-50 rounded-xl py-2 px-3">
                        <p class="text-lg font-bold text-emerald-600">${pTxns.filter(t=>t.is_settled).length}</p>
                        <p class="text-gray-400 text-xs">تسویه شده</p>
                    </div>
                    <div class="bg-orange-50 rounded-xl py-2 px-3">
                        <p class="text-lg font-bold text-orange-500">${pTxns.filter(t=>(t.type==='debt'||t.type==='credit')&&!t.is_settled).length}</p>
                        <p class="text-gray-400 text-xs">در انتظار</p>
                    </div>
                </div>

                <!-- ریز تراکنش‌ها -->
                <div>
                    <h4 class="text-gray-600 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <i class="fas fa-list text-gray-400"></i>ریز تراکنش‌ها
                    </h4>
                    <div class="bg-gray-50 rounded-xl px-3">${txRows}</div>
                </div>
            </div>

            <!-- فوتر -->
            <div class="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
                <button onclick="AccountingUI._deletePerson('${p.id}')"
                    class="text-red-400 hover:text-red-600 text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all">
                    <i class="fas fa-trash text-xs"></i>حذف شخص
                </button>
                <button onclick="document.getElementById('acc-person-detail-modal').remove()"
                    class="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-xl transition-all">
                    بستن
                </button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    async function _deletePerson(id) {
        if (!confirm('این شخص حذف شود؟')) return;
        const client = sb();
        if (!client) return;
        await client.from(PTBL).delete().eq('id', id);
        _persons = _persons.filter(p=>p.id!==id);
        document.getElementById('acc-plist-modal')?.remove();
        render();
    }

    // ── مودال خروجی Excel ────────────────────────────────────
    function showExportModal() {
        document.getElementById('acc-export-modal')?.remove();
        const today = new Date().toISOString().split('T')[0];
        const pOpts = _persons.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');

        const modal = document.createElement('div');
        modal.id = 'acc-export-modal';
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between mb-5">
                <h3 class="text-gray-800 font-bold flex items-center gap-2">
                    <i class="fas fa-file-excel text-green-600"></i>خروجی Excel
                </h3>
                <button onclick="document.getElementById('acc-export-modal').remove()" class="text-gray-400 hover:text-gray-700 text-xl"><i class="fas fa-times"></i></button>
            </div>
            <div class="space-y-3 text-sm">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-gray-600 text-xs mb-1 block">از تاریخ</label>
                        <input type="date" id="exp-from" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
                    </div>
                    <div>
                        <label class="text-gray-600 text-xs mb-1 block">تا تاریخ</label>
                        <input type="date" id="exp-to" value="${today}" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
                    </div>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">نوع تراکنش</label>
                    <select id="exp-type" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
                        <option value="">همه</option>
                        <option value="income">درآمد</option>
                        <option value="expense">هزینه</option>
                        <option value="debt">بدهی</option>
                        <option value="credit">بستانکاری</option>
                    </select>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">اشخاص (چند انتخابی)</label>
                    <select id="exp-persons" multiple size="4"
                        class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">
                        ${pOpts}
                    </select>
                    <p class="text-gray-400 text-xs mt-0.5">Ctrl+کلیک — خالی = همه</p>
                </div>
                <div>
                    <label class="text-gray-600 text-xs mb-1 block">ارز</label>
                    <select id="exp-cur" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
                        <option value="">همه</option>
                        <option value="تومان">تومان</option>
                        <option value="دلار">دلار</option>
                        <option value="دینار">دینار</option>
                    </select>
                </div>
            </div>
            <div class="flex gap-3 mt-5">
                <button onclick="AccountingUI._doExport()"
                    class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl">
                    <i class="fas fa-download ml-1"></i>دانلود CSV
                </button>
                <button onclick="document.getElementById('acc-export-modal').remove()"
                    class="px-5 bg-gray-100 text-gray-700 py-2.5 rounded-xl">انصراف</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target===modal) modal.remove(); });
    }

    function _doExport() {
        const from    = document.getElementById('exp-from')?.value || '';
        const to      = document.getElementById('exp-to')?.value   || '';
        const type    = document.getElementById('exp-type')?.value  || '';
        const curFlt  = document.getElementById('exp-cur')?.value   || '';
        const selP    = Array.from(document.getElementById('exp-persons')?.selectedOptions||[]).map(o=>o.value);

        let data = [..._txns];
        if (from)    data = data.filter(t=>(t.tx_date||t.created_at||'')>=from);
        if (to)      data = data.filter(t=>(t.tx_date||t.created_at||'')<=to);
        if (type)    data = data.filter(t=>t.type===type);
        if (selP.length) data = data.filter(t=>selP.includes(t.person_acc_id||''));
        if (curFlt)  data = data.filter(t=>parseAmounts(t).some(a=>a.currency===curFlt));

        const BOM = '\uFEFF';
        const headers = ['نوع','دسته‌بندی','مبلغ تومان','مبلغ دلار','مبلغ دینار','شخص','توضیحات','تاریخ میلادی','تاریخ شمسی'];
        const rows = data.map(t => {
            const amts = parseAmounts(t);
            const byC  = { تومان:0, دلار:0, دینار:0 };
            amts.forEach(a => { byC[a.currency] = (byC[a.currency]||0)+a.amount; });
            const p = t.person_acc_id ? (_persons.find(p=>p.id===t.person_acc_id)?.name||'') : (t.person_free_text||t.person_name||'');
            return [
                TYPE_LABELS[t.type]||t.type,
                t.category||'',
                byC.تومان||0, byC.دلار||0, byC.دینار||0,
                p, t.description||t.note||'',
                (t.tx_date||t.created_at||'').substring(0,10),
                _accJalaliDisplay((t.tx_date||t.created_at||'').substring(0,10))
            ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
        });

        const csv = BOM + [headers.join(','), ...rows].join('\n');
        const a   = document.createElement('a');
        a.href    = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
        a.download = `accounting_${new Date().toISOString().substring(0,10)}.csv`;
        a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href),500);
        document.getElementById('acc-export-modal')?.remove();
    }

    // ── init ─────────────────────────────────────────────────
    function init() {
        const container = document.getElementById('accounting-app');
        if (!container) return;
        container.innerHTML = `
        <div class="flex items-center justify-center py-16">
            <i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
        </div>`;
        loadAll().then(() => subscribeRealtime());
    }
    return {
        init, render, loadAll,
        onSearchInput, onFilterType, onFilterPerson, onFilterFrom, onFilterTo, onFilterSettled, clearFilters,
        toggleAccSort,
        showAddModal, showEditModal, deleteTransaction, toggleSettled,
        showAddPersonModal, _submitPerson, showPersonsList, showPersonDetail, _deletePerson,
        showExportModal, _doExport,
        _addAmountRow, _onPersonSelChange, _submitTx, _onTypeChange,
        // jalali helpers
        _openJalaliPicker, _closeJalaliPicker, _jalaliPrevMonth, _jalaliNextMonth,
        _pickJalaliDay, _clearDateFilter, _jalaliTarget,
        _openTxDatePicker, _pickTxDate,
        _accJalaliDisplay,
    };

})();

// ── تابع global برای index.html ──────────────────────────────
function getAccountingContent() {
    // Alpine x-html این را یک‌بار رندر می‌کند؛ init پس از رندر اجرا می‌شود
    setTimeout(() => {
        if (document.getElementById('accounting-app')) {
            AccountingUI.init();
        }
    }, 80);
    // اسکلت اولیه با loading indicator — بعد از init پر می‌شود
    return `<div id="accounting-app" dir="rtl" class="p-4 md:p-6">
        <div class="flex items-center justify-center py-20">
            <div class="text-center">
                <i class="fas fa-spinner fa-spin text-3xl text-blue-500 mb-3 block"></i>
                <p class="text-gray-400 text-sm">در حال بارگذاری حسابداری...</p>
            </div>
        </div>
    </div>`;
}
