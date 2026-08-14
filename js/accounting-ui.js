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
        if (_fTo)     f = f.filter(t => (t.tx_date||t.created_at||'') <= _fTo);
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
                <td class="px-3 py-3 text-gray-400 text-xs">${(t.tx_date||t.created_at||'').substring(0,10)}</td>
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

        container.innerHTML = `
        <div class="space-y-4" dir="rtl">

            <!-- داشبورد -->
            ${renderDashboard(filtered)}

            <!-- نوار ابزار -->
            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
                <div class="flex flex-wrap gap-2 items-center">
                    <!-- دکمه‌های عملیات -->
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
                    <!-- دکمه مرتب‌سازی -->
                    <button onclick="AccountingUI.toggleAccSort()"
                        class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all" title="مرتب‌سازی">
                        <i class="fas fa-sort-amount-down text-xs" id="acc-sort-icon"></i>
                        <span id="acc-sort-label">جدیدترین</span>
                    </button>

                    <!-- جستجو -->
                    <div class="flex-1 min-w-40">
                        <input type="text" id="acc-search" value="${esc(_fSearch)}"
                            oninput="AccountingUI.onSearchInput(this.value)"
                            placeholder="🔍 جستجو..."
                            class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                    </div>

                    <!-- فیلترها -->
                    <select id="acc-ftype" onchange="AccountingUI.onFilterType(this.value)"
                        class="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">
                        <option value="" ${!_fType?'selected':''}>همه نوع‌ها</option>
                        <option value="income"  ${_fType==='income' ?'selected':''}>درآمد</option>
                        <option value="expense" ${_fType==='expense'?'selected':''}>هزینه</option>
                        <option value="debt"    ${_fType==='debt'   ?'selected':''}>بدهکاری</option>
                        <option value="credit"  ${_fType==='credit' ?'selected':''}>بستانکاری</option>
                    </select>

                    <select id="acc-fperson" onchange="AccountingUI.onFilterPerson(this.value)"
                        class="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">
                        <option value="">همه اشخاص</option>
                        ${personsOpts}
                    </select>

                    <input type="date" id="acc-ffrom" value="${_fFrom}"
                        onchange="AccountingUI.onFilterFrom(this.value)"
                        class="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">
                    <input type="date" id="acc-fto" value="${_fTo}"
                        onchange="AccountingUI.onFilterTo(this.value)"
                        class="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">

                    ${(_fType||_fSearch||_fPerson||_fFrom||_fTo) ? `
                    <button onclick="AccountingUI.clearFilters()"
                        class="text-gray-400 hover:text-red-500 text-sm px-2 py-2 transition-all" title="پاک کردن فیلترها">
                        <i class="fas fa-times"></i>
                    </button>` : ''}
                </div>
            </div>

            <!-- جدول تراکنش‌ها -->
            <div id="acc-table-container">
                ${renderTable(filtered)}
            </div>
        </div>`;
    }

    // ── event handlers فیلتر ────────────────────────────────
    function onSearchInput(v) { _fSearch = v.trim(); _renderTable(); }
    function onFilterType(v)   { _fType   = v;        _renderTable(); _renderDash(); }
    function onFilterPerson(v) { _fPerson = v;        _renderTable(); _renderDash(); }
    function onFilterFrom(v)   { _fFrom   = v;        _renderTable(); _renderDash(); }
    function onFilterTo(v)     { _fTo     = v;        _renderTable(); _renderDash(); }
    function clearFilters()    { _fType=_fSearch=_fPerson=_fFrom=_fTo=''; render(); }

    function _renderTable() {
        const el = document.getElementById('acc-table-container');
        if (el) el.innerHTML = renderTable(applyFilters());
    }
    function _renderDash() {
        // dashboard در بالای صفحه — re-render کل
        const el = document.getElementById('accounting-app');
        if (el) {
            const dash = el.querySelector('.grid');
            if (dash) dash.outerHTML = renderDashboard(applyFilters());
        }
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
                        <input type="date" id="tx-date" value="${tx?.tx_date||today}"
                            class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
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

                // خلاصه سریع: جمع بدهکاری و بستانکاری به تومان
                const debtTotal   = pTxns.filter(t=>t.type==='debt')  .reduce((s,t)=>s+parseAmounts(t).find(a=>a.currency==='تومان')?.amount||0,0);
                const creditTotal = pTxns.filter(t=>t.type==='credit').reduce((s,t)=>s+parseAmounts(t).find(a=>a.currency==='تومان')?.amount||0,0);
                const net         = creditTotal - debtTotal;
                const netColor    = net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-500' : 'text-gray-400';

                const badge = txCount
                    ? `<span class="bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">${txCount}</span>`
                    : '';
                const netBadge = txCount
                    ? `<span class="text-xs ${netColor} font-medium">${net>0?'+':''}${net.toLocaleString('en-US')} ت</span>`
                    : `<span class="text-xs text-gray-300">بدون تراکنش</span>`;

                return `
                <div class="flex items-center justify-between py-3 px-2 border-b border-gray-100 last:border-0
                            hover:bg-gray-50 rounded-xl cursor-pointer transition-all group"
                     onclick="AccountingUI.showPersonDetail('${p.id}')">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-user text-blue-400 text-xs"></i>
                        </div>
                        <div>
                            <p class="font-medium text-gray-800 text-sm flex items-center gap-1.5">
                                ${esc(p.name)} ${badge}
                            </p>
                            <p class="text-gray-400 text-xs">${p.phone||'—'} · ${netBadge}</p>
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
                            <div class="text-gray-300 text-xs">${(t.tx_date||t.created_at||'').substring(0,10)}</div>
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
        const headers = ['نوع','دسته‌بندی','مبلغ تومان','مبلغ دلار','مبلغ دینار','شخص','توضیحات','تاریخ'];
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
                (t.tx_date||t.created_at||'').substring(0,10)
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
        onSearchInput, onFilterType, onFilterPerson, onFilterFrom, onFilterTo, clearFilters,
        toggleAccSort,
        showAddModal, showEditModal, deleteTransaction, toggleSettled,
        showAddPersonModal, _submitPerson, showPersonsList, showPersonDetail, _deletePerson,
        showExportModal, _doExport,
        _addAmountRow, _onPersonSelChange, _submitTx, _onTypeChange,
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
