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
        if (cur === 'دلار')  return '$' + v.toLocaleString('en');
        if (cur === 'دینار') return v.toLocaleString('fa-IR') + ' د';
        return v.toLocaleString('fa-IR') + ' ت';
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
        const income  = totalByCur(filtered, ['income']);
        const expense = totalByCur(filtered, ['expense']);

        // خالص دارایی = بستانکاری + درآمد - بدهی - هزینه
        const netByCur = {};
        ['تومان','دلار','دینار'].forEach(c => {
            const v = (credit[c]||0) + (income[c]||0) - (debt[c]||0) - (expense[c]||0);
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
                return null; // از module واقعی می‌خوانیم
            } catch { return null; }
        })();

        function card(title, content, bg, border, icon, iconColor) {
            return `
            <div class="${bg} rounded-2xl p-4 border ${border} shadow-sm">
                <div class="flex items-center gap-2 mb-2">
                    <i class="fas ${icon} ${iconColor} text-sm"></i>
                    <p class="text-gray-500 text-xs font-medium">${title}</p>
                </div>
                <div class="space-y-0.5">${content}</div>
            </div>`;
        }

        const netColor = Object.values(netByCur).some(v=>v<0) ? 'text-red-600' : 'text-emerald-700';

        return `
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            ${card('بستانکاری', fmtMulti(credit,'text-emerald-700 font-bold text-sm'), 'bg-emerald-50','border-emerald-200','fa-coins','text-emerald-500')}
            ${card('بدهی',      fmtMulti(debt,  'text-red-600 font-bold text-sm'),     'bg-red-50',    'border-red-200',   'fa-hand-holding-usd','text-red-400')}
            ${card('خالص دارایی', Object.keys(netByCur).length
                ? Object.entries(netByCur).map(([c,v])=>`<span class="${v>=0?'text-emerald-700':'text-red-600'} font-bold text-sm">${fmtNum(v,c)}</span>`).join('<br>')
                : '<span class="text-gray-400 text-sm">—</span>',
                'bg-blue-50','border-blue-200','fa-chart-line','text-blue-500')}
            ${card('حساب کارمندان', empUnsettled !== null
                ? `<span class="text-orange-700 font-bold text-sm">${empUnsettled.toLocaleString('fa-IR')} ت</span><p class="text-gray-400 text-xs">تسویه‌نشده</p>`
                : '<span class="text-gray-400 text-xs">در دسترس نیست</span>',
                'bg-orange-50','border-orange-200','fa-users','text-orange-500')}
            ${card('حساب سفارت', '<span class="text-purple-700 text-xs">→ حسابداری سفارت</span>',
                'bg-purple-50','border-purple-200','fa-landmark','text-purple-500')}
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
        return f;
    }

    const TYPE_LABELS = { income:'درآمد', expense:'هزینه', debt:'بدهی', credit:'بستانکاری' };
    const TYPE_COLORS = {
        income:  'bg-green-100 text-green-800',
        expense: 'bg-red-100 text-red-700',
        debt:    'bg-orange-100 text-orange-700',
        credit:  'bg-blue-100 text-blue-800'
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

            return `
            <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
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

        return `
        <div class="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
            <table class="w-full text-sm" style="min-width:820px">
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
                        <i class="fas fa-users text-purple-500"></i>اشخاص
                    </button>
                    <button onclick="AccountingUI.showExportModal()"
                        class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all">
                        <i class="fas fa-file-excel text-green-600"></i>خروجی Excel
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
                        <option value="debt"    ${_fType==='debt'   ?'selected':''}>بدهی</option>
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
                        <select id="tx-type" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none">
                            <option value="income"  ${tx?.type==='income' ?'selected':''}>درآمد</option>
                            <option value="expense" ${tx?.type==='expense'?'selected':''}>هزینه</option>
                            <option value="debt"    ${tx?.type==='debt'   ?'selected':''}>بدهی</option>
                            <option value="credit"  ${tx?.type==='credit' ?'selected':''}>بستانکاری</option>
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
                        <select id="tx-person-sel" class="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            onchange="AccountingUI._onPersonSelChange(this)">
                            ${_buildPersonOptions(tx?.person_acc_id||'')}
                            <option value="__new__">+ شخص جدید...</option>
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
                        <option value="supplier">تأمین‌کننده</option>
                        <option value="partner">شریک</option>
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
                const txCount = _txns.filter(t => t.person_acc_id===p.id).length;
                return `
                <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                        <p class="font-medium text-gray-800 text-sm">${esc(p.name)}</p>
                        <p class="text-gray-400 text-xs">${p.phone||''} ${txCount ? `· ${txCount} تراکنش` : ''}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="AccountingUI.onFilterPerson('${p.id}'); document.getElementById('acc-plist-modal').remove(); AccountingUI.render();"
                            class="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 bg-blue-50 rounded-lg">فیلتر</button>
                        <button onclick="AccountingUI._deletePerson('${p.id}')"
                            class="text-red-400 hover:text-red-600 text-xs px-2 py-1 bg-red-50 rounded-lg">حذف</button>
                    </div>
                </div>`;
            }).join('')
            : '<p class="text-gray-400 text-center py-8 text-sm">هیچ شخصی ثبت نشده</p>';

        const modal = document.createElement('div');
        modal.id = 'acc-plist-modal';
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-gray-800 font-bold flex items-center gap-2">
                    <i class="fas fa-users text-blue-500"></i>لیست اشخاص (${_persons.length})
                </h3>
                <div class="flex gap-2">
                    <button onclick="AccountingUI.showAddPersonModal()"
                        class="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-xl hover:bg-blue-500">+ جدید</button>
                    <button onclick="document.getElementById('acc-plist-modal').remove()" class="text-gray-400 hover:text-gray-700 text-xl"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="overflow-auto flex-1">${rows}</div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target===modal) modal.remove(); });
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

    // ── public API ───────────────────────────────────────────
    return {
        init, render, loadAll,
        onSearchInput, onFilterType, onFilterPerson, onFilterFrom, onFilterTo, clearFilters,
        showAddModal, showEditModal, deleteTransaction,
        showAddPersonModal, _submitPerson, showPersonsList, _deletePerson,
        showExportModal, _doExport,
        _addAmountRow, _onPersonSelChange, _submitTx,
    };

})();

// ── تابع global برای index.html ──────────────────────────────
function getAccountingContent() {
    setTimeout(() => AccountingUI.init(), 50);
    return '<div id="accounting-app" dir="rtl" class="p-4 md:p-6"></div>';
}
