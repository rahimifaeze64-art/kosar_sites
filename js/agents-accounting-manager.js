// ============================================================
// agents-accounting-manager.js
// ماژول حسابداری عامل‌ها — ویژه مدیر
// نمایش خلاصه مالی همه عامل‌ها + صفحه مخصوص هر عامل
// ============================================================
const AgentsAccountingManager = (function () {
    'use strict';

    // ── helpers ─────────────────────────────────────────────
    function getAgents() {
        try {
            let users = [];
            if (typeof DataModule !== 'undefined') users = DataModule.getUsers() || [];
            if (typeof HARDCODED_USERS !== 'undefined') {
                const ids = new Set(users.map(u => u.id));
                HARDCODED_USERS.forEach(u => { if (!ids.has(u.id)) users.push(u); });
            }
            return users.filter(u => u.role === 'agent' && u.active !== false);
        } catch (e) {
            return typeof HARDCODED_USERS !== 'undefined'
                ? HARDCODED_USERS.filter(u => u.role === 'agent')
                : [];
        }
    }

    function getOrders() {
        try { return DataModule.getOrders() || []; } catch (e) { return []; }
    }

    function fmt(n) {
        return (parseFloat(n) || 0).toLocaleString('en-US');
    }

    function getAgentOrders(agentId) {
        return getOrders().filter(o =>
            o.assignedDoctorId === agentId ||
            o.assignedAgentId  === agentId ||
            o.assignedDoctor   === agentId ||
            o.doctorId         === agentId
        );
    }

    function getPayments(agentId) {
        try {
            return JSON.parse(localStorage.getItem(`agent_payments_${agentId}`) || '[]');
        } catch (e) { return []; }
    }

    function getAgentSummary(agentId) {
        const orders   = getAgentOrders(agentId);
        const payments = getPayments(agentId);

        const byCur = { تومان: 0, دلار: 0, دینار: 0 };
        orders.forEach(o => {
            const cur = o.currency || 'تومان';
            const pct = parseFloat(o.revenueAgentPercent || 60) / 100;
            const amt = parseFloat(o.totalAmount || o.cost || 0);
            byCur[cur] = (byCur[cur] || 0) + amt * pct;
        });

        const paidByCur = { تومان: 0, دلار: 0, دینار: 0 };
        payments.forEach(p => {
            const cur = p.currency || 'تومان';
            paidByCur[cur] = (paidByCur[cur] || 0) + parseFloat(p.amount || 0);
        });

        return {
            totalOrders:     orders.length,
            completed:       orders.filter(o => o.status === 'completed').length,
            inProgress:      orders.filter(o => o.status === 'in_progress').length,
            pending:         orders.filter(o => o.status === 'pending').length,
            shareTooman:     byCur['تومان'],
            shareDollar:     byCur['دلار'],
            shareDinar:      byCur['دینار'],
            paidTooman:      paidByCur['تومان'],
            paidDollar:      paidByCur['دلار'],
            paidDinar:       paidByCur['دینار'],
            remainTooman:    byCur['تومان'] - paidByCur['تومان'],
            remainDollar:    byCur['دلار'] - paidByCur['دلار'],
            remainDinar:     byCur['دینار'] - paidByCur['دینار'],
        };
    }

    // ── رندر کارت عامل در صفحه لیست ───────────────────────
    function renderAgentCard(agent) {
        const s = getAgentSummary(agent.id);
        const remainColor = s.remainTooman > 0 ? 'text-red-400' : 'text-green-400';
        const initials = agent.name.charAt(0);
        return `
        <div class="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-5 hover:bg-white/15
                    transition-all cursor-pointer group"
             onclick="AgentsAccountingManager.openAgent('${agent.id}')">
            <div class="flex items-center gap-4 mb-4">
                <div class="w-12 h-12 rounded-full bg-lime-500/30 text-lime-300 flex items-center
                            justify-center text-xl font-black flex-shrink-0 group-hover:scale-110 transition-transform">
                    ${initials}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white font-bold text-base truncate">${agent.name}</p>
                    <p class="text-gray-400 text-xs truncate">${agent.specialization || agent.department || 'عامل'}</p>
                </div>
                <i class="fas fa-chevron-left text-gray-500 group-hover:text-lime-400 transition-colors"></i>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center mb-4">
                <div class="bg-white/5 rounded-lg py-2">
                    <p class="text-xs text-gray-400">کل</p>
                    <p class="text-white font-bold text-lg">${s.totalOrders}</p>
                </div>
                <div class="bg-white/5 rounded-lg py-2">
                    <p class="text-xs text-gray-400">انجام شده</p>
                    <p class="text-green-400 font-bold text-lg">${s.completed}</p>
                </div>
                <div class="bg-white/5 rounded-lg py-2">
                    <p class="text-xs text-gray-400">در جریان</p>
                    <p class="text-blue-400 font-bold text-lg">${s.inProgress}</p>
                </div>
            </div>
            <div class="space-y-1.5 text-sm border-t border-white/10 pt-3">
                ${s.shareTooman > 0 ? `
                <div class="flex justify-between items-center">
                    <span class="text-gray-400 text-xs">سهم (تومان)</span>
                    <span class="text-lime-300 font-semibold">${fmt(s.shareTooman)} ت</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-400 text-xs">پرداخت شده</span>
                    <span class="text-green-400 font-semibold">${fmt(s.paidTooman)} ت</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-400 text-xs font-medium">مانده</span>
                    <span class="${remainColor} font-bold">${fmt(s.remainTooman)} ت</span>
                </div>` : ''}
                ${s.shareDollar > 0 ? `
                <div class="flex justify-between items-center border-t border-white/10 pt-1.5">
                    <span class="text-gray-400 text-xs">سهم (دلار)</span>
                    <span class="text-lime-300 font-semibold">$${fmt(s.shareDollar)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-400 text-xs">مانده دلار</span>
                    <span class="${s.remainDollar > 0 ? 'text-red-400' : 'text-green-400'} font-bold">$${fmt(s.remainDollar)}</span>
                </div>` : ''}
                ${s.shareTooman === 0 && s.shareDollar === 0 ? `
                <p class="text-gray-500 text-xs text-center py-1">سفارشی تخصیص نیافته</p>` : ''}
            </div>
            <button onclick="event.stopPropagation();AgentsAccountingManager.showPayModal('${agent.id}','${agent.name}')"
                class="mt-4 w-full bg-lime-600/30 hover:bg-lime-600/50 text-lime-300 border border-lime-500/30
                       py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2">
                <i class="fas fa-plus-circle"></i> ثبت پرداخت
            </button>
        </div>`;
    }

    // ── صفحه لیست همه عامل‌ها ───────────────────────────────
    function renderListPage() {
        const agents = getAgents();

        // خلاصه کلی
        let totalRemainTooman = 0, totalRemainDollar = 0, totalOrders = 0;
        agents.forEach(a => {
            const s = getAgentSummary(a.id);
            totalRemainTooman += s.remainTooman;
            totalRemainDollar += s.remainDollar;
            totalOrders       += s.totalOrders;
        });

        return `
        <div class="space-y-6" id="agents-acc-list-page">
            <!-- هدر -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                        <span class="bg-lime-500/20 p-2 rounded-xl">
                            <i class="fas fa-user-tie text-lime-400"></i>
                        </span>
                        حسابداری عامل‌ها
                    </h2>
                    <p class="text-gray-400 text-sm mt-1">${agents.length} عامل فعال</p>
                </div>
            </div>

            <!-- کارت‌های خلاصه کلی -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="bg-white/10 rounded-2xl border border-white/20 p-5 text-center">
                    <i class="fas fa-clipboard-list text-lime-400 text-2xl mb-2"></i>
                    <p class="text-gray-400 text-xs mb-1">کل سفارشات عامل‌ها</p>
                    <p class="text-white font-black text-3xl">${totalOrders}</p>
                </div>
                <div class="bg-white/10 rounded-2xl border border-white/20 p-5 text-center">
                    <i class="fas fa-coins text-amber-400 text-2xl mb-2"></i>
                    <p class="text-gray-400 text-xs mb-1">جمع مانده (تومان)</p>
                    <p class="text-amber-400 font-black text-2xl">${fmt(totalRemainTooman)} ت</p>
                </div>
                <div class="bg-white/10 rounded-2xl border border-white/20 p-5 text-center">
                    <i class="fas fa-dollar-sign text-green-400 text-2xl mb-2"></i>
                    <p class="text-gray-400 text-xs mb-1">جمع مانده (دلار)</p>
                    <p class="text-green-400 font-black text-2xl">$${fmt(totalRemainDollar)}</p>
                </div>
            </div>

            <!-- گرید عامل‌ها -->
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                ${agents.length === 0
                    ? `<div class="col-span-full text-center py-16 text-gray-500">
                           <i class="fas fa-user-slash text-5xl opacity-20 mb-4 block"></i>
                           <p>هیچ عاملی تعریف نشده</p>
                       </div>`
                    : agents.map(a => renderAgentCard(a)).join('')}
            </div>
        </div>`;
    }

    // ── صفحه جزئیات یک عامل ─────────────────────────────────
    function renderAgentPage(agentId) {
        const agents  = getAgents();
        const agent   = agents.find(a => a.id === agentId);
        if (!agent) return `<p class="text-red-400 p-8">عامل یافت نشد</p>`;

        const orders   = getAgentOrders(agentId);
        const payments = getPayments(agentId);
        const s        = getAgentSummary(agentId);

        const statusMap = {
            pending:     { label: 'در انتظار',    cls: 'bg-amber-900/50 text-amber-300' },
            in_progress: { label: 'در حال انجام', cls: 'bg-blue-900/50 text-blue-300' },
            completed:   { label: 'تکمیل شده',   cls: 'bg-green-900/50 text-green-300' },
            cancelled:   { label: 'لغو شده',     cls: 'bg-red-900/50 text-red-300' },
        };

        const orderRows = orders.length === 0
            ? `<tr><td colspan="5" class="py-10 text-center text-gray-500">
                    <i class="fas fa-inbox text-3xl opacity-20 mb-2 block"></i>سفارشی تخصیص نیافته
               </td></tr>`
            : orders.map(o => {
                const st  = statusMap[o.status] || { label: o.status, cls: 'bg-gray-700 text-gray-300' };
                const cur = o.currency || 'تومان';
                const amt = parseFloat(o.totalAmount || o.cost || 0);
                const pct = parseFloat(o.revenueAgentPercent || 60);
                const share = amt * pct / 100;
                const dl  = o.deadline ? new Date(o.deadline).toLocaleDateString('fa-IR') : '—';
                return `
                <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td class="px-4 py-3 text-white text-sm">${o.studentName || '—'}</td>
                    <td class="px-4 py-3 text-gray-300 text-sm">${o.type || '—'}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">${dl}</td>
                    <td class="px-4 py-3">
                        <div class="text-lime-300 font-semibold text-sm">${fmt(share)} ${cur === 'دلار' ? '$' : cur === 'دینار' ? 'د' : 'ت'}</div>
                        <div class="text-gray-500 text-[10px]">از ${fmt(amt)} (${pct}٪)</div>
                    </td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 rounded-full text-xs font-medium ${st.cls}">${st.label}</span>
                    </td>
                </tr>`;
            }).join('');

        const payRows = payments.length === 0
            ? `<div class="text-center py-8 text-gray-500">
                    <i class="fas fa-money-bill-wave text-3xl opacity-20 mb-2 block"></i>
                    پرداختی ثبت نشده
               </div>`
            : `<div class="space-y-2">
                ${payments.map(p => `
                <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-green-700/40 flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-arrow-down text-green-400 text-xs"></i>
                        </div>
                        <div>
                            <p class="text-white text-sm font-medium">${p.description || 'دریافتی'}</p>
                            <p class="text-gray-500 text-xs">${new Date(p.date).toLocaleDateString('fa-IR')}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-green-400 font-bold text-sm">${fmt(p.amount)} ${p.currency || 'تومان'}</span>
                        <button onclick="AgentsAccountingManager.deletePayment('${agentId}','${p.id}')"
                            class="text-red-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-900/30 transition-colors" title="حذف">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>`).join('')}
               </div>`;

        return `
        <div class="space-y-6" id="agent-detail-page-${agentId}">
            <!-- هدر + برگشت -->
            <div class="flex items-center gap-4">
                <button onclick="AgentsAccountingManager.backToList()"
                    class="text-gray-400 hover:text-white flex items-center gap-2 text-sm transition-colors">
                    <i class="fas fa-arrow-right"></i> بازگشت
                </button>
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-lime-500/30 text-lime-300 flex items-center
                                justify-center text-xl font-black">
                        ${agent.name.charAt(0)}
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-white">${agent.name}</h2>
                        <p class="text-gray-400 text-sm">${agent.specialization || agent.department || 'عامل'}</p>
                    </div>
                </div>
                <button onclick="AgentsAccountingManager.showPayModal('${agentId}','${agent.name}')"
                    class="mr-auto bg-lime-600 hover:bg-lime-500 text-white px-4 py-2 rounded-xl text-sm font-medium
                           flex items-center gap-2 transition-colors">
                    <i class="fas fa-plus-circle"></i> ثبت پرداخت
                </button>
            </div>

            <!-- کارت‌های خلاصه مالی -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                ${[
                    ['کل سفارشات',  s.totalOrders,  'text-white',       'fa-clipboard-list', 'bg-white/10'],
                    ['تکمیل‌شده',   s.completed,    'text-green-400',   'fa-check-circle',   'bg-green-900/20'],
                    ['در جریان',    s.inProgress,   'text-blue-400',    'fa-spinner',        'bg-blue-900/20'],
                    ['در انتظار',   s.pending,      'text-amber-400',   'fa-clock',          'bg-amber-900/20'],
                ].map(([lbl, val, tc, ic, bg]) => `
                <div class="${bg} rounded-xl border border-white/10 p-3 text-center">
                    <i class="fas ${ic} ${tc} text-lg mb-1 block"></i>
                    <p class="text-gray-400 text-xs">${lbl}</p>
                    <p class="${tc} font-black text-2xl">${val}</p>
                </div>`).join('')}
                ${s.shareTooman > 0 ? `
                <div class="bg-lime-900/20 rounded-xl border border-lime-500/20 p-3 text-center">
                    <i class="fas fa-coins text-lime-400 text-lg mb-1 block"></i>
                    <p class="text-gray-400 text-xs">سهم (ت)</p>
                    <p class="text-lime-300 font-black text-lg">${fmt(s.shareTooman)}</p>
                    <p class="text-xs ${s.remainTooman > 0 ? 'text-red-400' : 'text-green-400'} mt-0.5">
                        مانده: ${fmt(s.remainTooman)}
                    </p>
                </div>` : ''}
                ${s.shareDollar > 0 ? `
                <div class="bg-green-900/20 rounded-xl border border-green-500/20 p-3 text-center">
                    <i class="fas fa-dollar-sign text-green-400 text-lg mb-1 block"></i>
                    <p class="text-gray-400 text-xs">سهم ($)</p>
                    <p class="text-green-300 font-black text-lg">$${fmt(s.shareDollar)}</p>
                    <p class="text-xs ${s.remainDollar > 0 ? 'text-red-400' : 'text-green-400'} mt-0.5">
                        مانده: $${fmt(s.remainDollar)}
                    </p>
                </div>` : ''}
            </div>

            <!-- جدول سفارشات -->
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div class="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                    <h3 class="text-white font-bold flex items-center gap-2">
                        <i class="fas fa-list text-lime-400"></i>سفارشات
                        <span class="text-xs text-gray-400 font-normal">(${orders.length})</span>
                    </h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-right">
                        <thead>
                            <tr class="bg-white/5 text-gray-400 text-xs">
                                <th class="px-4 py-2.5 font-medium">دانشجو</th>
                                <th class="px-4 py-2.5 font-medium">نوع کار</th>
                                <th class="px-4 py-2.5 font-medium">مهلت</th>
                                <th class="px-4 py-2.5 font-medium">سهم عامل</th>
                                <th class="px-4 py-2.5 font-medium">وضعیت</th>
                            </tr>
                        </thead>
                        <tbody>${orderRows}</tbody>
                    </table>
                </div>
            </div>

            <!-- تاریخچه پرداخت‌ها -->
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div class="px-5 py-3 border-b border-white/10">
                    <h3 class="text-white font-bold flex items-center gap-2">
                        <i class="fas fa-history text-green-400"></i>تاریخچه پرداخت‌ها
                        <span class="text-xs text-gray-400 font-normal">(${payments.length})</span>
                    </h3>
                </div>
                <div class="p-4">${payRows}</div>
            </div>
        </div>`;
    }

    // ── state صفحه جاری ─────────────────────────────────────
    let _currentAgentId = null;

    function _getContainer() {
        return document.getElementById('agents-acc-root');
    }

    function _render(html) {
        const el = _getContainer();
        if (el) el.innerHTML = html;
    }

    // ── Public API ───────────────────────────────────────────

    function getContent() {
        _currentAgentId = null;
        return `<div id="agents-acc-root" class="p-1">${renderListPage()}</div>`;
    }

    function openAgent(agentId) {
        _currentAgentId = agentId;
        _render(renderAgentPage(agentId));
    }

    function backToList() {
        _currentAgentId = null;
        _render(renderListPage());
    }

    function showPayModal(agentId, agentName) {
        const existing = document.getElementById('aam-pay-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'aam-pay-modal';
        modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
        <div class="bg-slate-800 rounded-2xl border border-slate-600 w-full max-w-md shadow-2xl">
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                    <i class="fas fa-plus-circle text-lime-400"></i>
                    ثبت پرداخت — ${agentName}
                </h3>
                <button onclick="document.getElementById('aam-pay-modal').remove()"
                    class="text-gray-400 hover:text-white text-xl transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="p-6 space-y-4">
                <div>
                    <label class="block text-gray-400 text-xs mb-1.5 font-medium">
                        مبلغ <span class="text-red-400">*</span>
                    </label>
                    <div class="flex gap-2">
                        <input type="number" id="aam-pay-amount" min="0" step="0.01"
                            placeholder="مثال: 5000000"
                            class="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5
                                   text-white text-sm focus:ring-2 focus:ring-lime-500 outline-none">
                        <select id="aam-pay-currency"
                            class="bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5
                                   text-white text-sm focus:ring-2 focus:ring-lime-500 outline-none">
                            <option value="تومان">تومان</option>
                            <option value="دلار">$ دلار</option>
                            <option value="دینار">دینار</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-gray-400 text-xs mb-1.5 font-medium">توضیحات</label>
                    <input type="text" id="aam-pay-desc"
                        placeholder="مثال: تسویه ماه آبان، پیش‌پرداخت رساله ..."
                        class="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5
                               text-white text-sm focus:ring-2 focus:ring-lime-500 outline-none">
                </div>
                <div>
                    <label class="block text-gray-400 text-xs mb-1.5 font-medium">تاریخ پرداخت</label>
                    <input type="date" id="aam-pay-date"
                        value="${new Date().toISOString().split('T')[0]}"
                        class="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5
                               text-white text-sm focus:ring-2 focus:ring-lime-500 outline-none">
                </div>
            </div>
            <div class="flex gap-3 px-6 pb-6">
                <button onclick="AgentsAccountingManager.submitPayment('${agentId}')"
                    class="flex-1 bg-lime-600 hover:bg-lime-500 text-white py-2.5 rounded-xl
                           font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                    <i class="fas fa-check"></i> ثبت پرداخت
                </button>
                <button onclick="document.getElementById('aam-pay-modal').remove()"
                    class="px-5 bg-slate-700 hover:bg-slate-600 text-gray-300 py-2.5 rounded-xl
                           text-sm transition-colors">
                    انصراف
                </button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        setTimeout(() => document.getElementById('aam-pay-amount')?.focus(), 100);
    }

    function submitPayment(agentId) {
        const amount   = parseFloat(document.getElementById('aam-pay-amount')?.value);
        const currency = document.getElementById('aam-pay-currency')?.value || 'تومان';
        const desc     = document.getElementById('aam-pay-desc')?.value?.trim() || '';
        const date     = document.getElementById('aam-pay-date')?.value || new Date().toISOString().split('T')[0];

        if (!amount || amount <= 0) {
            if (typeof UTILS !== 'undefined' && UTILS.showNotification)
                UTILS.showNotification('مبلغ را وارد کنید', 'error');
            else alert('مبلغ را وارد کنید');
            return;
        }

        const key = `agent_payments_${agentId}`;
        const payments = JSON.parse(localStorage.getItem(key) || '[]');
        payments.unshift({
            id:          'MGR-PAY-' + Date.now(),
            amount,
            currency,
            description: desc || `پرداخت توسط مدیر`,
            date:        new Date(date).toISOString(),
            paidByManager: true,
        });
        localStorage.setItem(key, JSON.stringify(payments));

        // sync به Supabase
        try {
            if (typeof SupabaseDataModule !== 'undefined') {
                SupabaseDataModule.saveAccountingTransaction({
                    id:          payments[0].id,
                    type:        'agent_payment',
                    amount,
                    currency,
                    description: payments[0].description,
                    agentId,
                    createdBy:   null,
                });
            }
        } catch(e) { console.warn('⚠️ sync agent payment:', e.message); }

        document.getElementById('aam-pay-modal')?.remove();

        if (typeof UTILS !== 'undefined' && UTILS.showNotification)
            UTILS.showNotification('پرداخت ثبت شد ✓', 'success');

        // رفرش صفحه جاری
        if (_currentAgentId === agentId) _render(renderAgentPage(agentId));
        else _render(renderListPage());
    }

    function deletePayment(agentId, paymentId) {
        if (!confirm('این پرداخت حذف شود؟')) return;
        const key = `agent_payments_${agentId}`;
        const payments = JSON.parse(localStorage.getItem(key) || '[]')
            .filter(p => p.id !== paymentId);
        localStorage.setItem(key, JSON.stringify(payments));

        if (typeof UTILS !== 'undefined' && UTILS.showNotification)
            UTILS.showNotification('پرداخت حذف شد', 'warning');

        if (_currentAgentId === agentId) _render(renderAgentPage(agentId));
        else _render(renderListPage());
    }

    function refresh() {
        if (_currentAgentId) _render(renderAgentPage(_currentAgentId));
        else _render(renderListPage());
    }

    // ── export ───────────────────────────────────────────────
    return {
        getContent,
        openAgent,
        backToList,
        showPayModal,
        submitPayment,
        deletePayment,
        refresh,
    };

})();

window.AgentsAccountingManager = AgentsAccountingManager;
console.log('✅ AgentsAccountingManager بارگذاری شد');
