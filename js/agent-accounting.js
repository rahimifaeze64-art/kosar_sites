// Agent Accounting Module - حسابداری شخصی عامل
// ذخیره‌سازی: localStorage + Supabase accounting_transactions
const AgentAccountingModule = {

    // ── Helper ──────────────────────────────────────────────
    _sb() {
        return typeof SupabaseDataModule !== 'undefined' &&
               typeof SupabaseConnection  !== 'undefined' &&
               SupabaseConnection.isOnline === true
               ? SupabaseDataModule : null;
    },

    // دریافت سفارشات تخصیص‌یافته به عامل
    getMyOrders(agentId) {
        const orders = DataModule.getOrders();
        return orders.filter(o =>
            o.assignedDoctorId === agentId ||
            o.assigned_doctor  === agentId ||
            o.assignedDoctor   === agentId ||
            o.doctorId         === agentId ||
            o.assignedAgentId  === agentId
        );
    },

    // دریافت پرداخت‌های ثبت‌شده — localStorage + sync از Supabase
    getPayments(agentId) {
        const key = `agent_payments_${agentId}`;
        const sb = this._sb();
        if (sb) {
            // sync در پس‌زمینه
            sb.getAccountingTransactions(null).then(rows => {
                if (!rows || rows.length === 0) return;
                // فقط تراکنش‌هایی که created_by این عامل هستند
                const mine = rows
                    .filter(r => r.created_by === agentId)
                    .map(r => ({
                        id:          r.id,
                        amount:      parseFloat(r.amount) || 0,
                        currency:    'تومان',
                        description: r.description || '',
                        date:        r.created_at  || new Date().toISOString()
                    }));
                if (mine.length > 0) {
                    localStorage.setItem(key, JSON.stringify(mine));
                }
            }).catch(() => {});
        }
        return JSON.parse(localStorage.getItem(key) || '[]');
    },

    // ذخیره پرداخت جدید — localStorage + Supabase
    savePayment(agentId, payment) {
        const key = `agent_payments_${agentId}`;
        const payments = JSON.parse(localStorage.getItem(key) || '[]');
        const newEntry = {
            ...payment,
            id:   'PAY-' + Date.now(),
            date: new Date().toISOString()
        };
        payments.unshift(newEntry);
        localStorage.setItem(key, JSON.stringify(payments));

        // sync به Supabase
        const sb = this._sb();
        if (sb) {
            sb.saveAccountingTransaction({
                id:          newEntry.id,
                type:        'income',
                amount:      newEntry.amount,
                description: newEntry.description || 'دریافتی عامل',
                createdBy:   agentId
            })
            .then(ok => { if (ok) console.log('✅ پرداخت عامل در Supabase ذخیره شد'); })
            .catch(e  => console.warn('⚠️ savePayment Supabase خطا:', e.message));
        } else {
            console.warn('📴 Supabase آفلاین — پرداخت فقط در localStorage');
        }
    },

    // حذف پرداخت — localStorage + Supabase
    deletePayment(agentId, paymentId) {
        const key = `agent_payments_${agentId}`;
        const payments = JSON.parse(localStorage.getItem(key) || '[]')
            .filter(p => p.id !== paymentId);
        localStorage.setItem(key, JSON.stringify(payments));

        // حذف از Supabase
        const sb = this._sb();
        if (sb && typeof sb._db === 'function') {
            const client = sb._db();
            if (client) {
                client.from('accounting_transactions')
                    .delete().eq('id', paymentId)
                    .then(({ error }) => {
                        if (error) console.warn('⚠️ deletePayment Supabase خطا:', error.message);
                        else       console.log('✅ پرداخت از Supabase حذف شد:', paymentId);
                    });
            }
        }
    },

    // محاسبه خلاصه مالی
    getSummary(agentId) {
        const orders = this.getMyOrders(agentId);
        const payments = this.getPayments(agentId);

        const totalCostToman = orders.filter(o => o.currency === 'تومان' || !o.currency)
            .reduce((s, o) => s + (parseFloat(o.cost) || parseFloat(o.totalAmount) || 0), 0);

        const totalCostDollar = orders.filter(o => o.currency === 'دلار')
            .reduce((s, o) => s + (parseFloat(o.cost) || 0), 0);

        const paidToman = payments.filter(p => p.currency === 'تومان').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const paidDollar = payments.filter(p => p.currency === 'دلار').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

        return {
            totalOrders: orders.length,
            completedOrders: orders.filter(o => o.status === 'completed').length,
            inProgressOrders: orders.filter(o => o.status === 'in_progress').length,
            pendingOrders: orders.filter(o => o.status === 'pending').length,
            totalCostToman,
            totalCostDollar,
            paidToman,
            paidDollar,
            remainingToman: totalCostToman - paidToman,
            remainingDollar: totalCostDollar - paidDollar,
        };
    },

    // صفحه اصلی حسابداری
    getContent(agentId) {
        const orders = this.getMyOrders(agentId);
        const payments = this.getPayments(agentId);
        const summary = this.getSummary(agentId);

        return `
        <div class="space-y-6" id="agent-accounting-page">

            <!-- Header -->
            <div class="flex items-center justify-between">
                <h2 class="text-2xl font-bold text-white">
                    <i class="fas fa-wallet text-yellow-400 ml-2"></i>
                    حسابداری شخصی من
                </h2>
                <button onclick="AgentAccountingModule.showAddPaymentModal('${agentId}')"
                        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
                    <i class="fas fa-plus ml-2"></i>
                    ثبت دریافتی
                </button>
            </div>

            <!-- خلاصه آماری -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-slate-800 rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-sm mb-1">کل سفارشات</p>
                    <p class="text-3xl font-bold text-white">${summary.totalOrders}</p>
                </div>
                <div class="bg-slate-800 rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-sm mb-1">تکمیل شده</p>
                    <p class="text-3xl font-bold text-green-400">${summary.completedOrders}</p>
                </div>
                <div class="bg-slate-800 rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-sm mb-1">در حال انجام</p>
                    <p class="text-3xl font-bold text-blue-400">${summary.inProgressOrders}</p>
                </div>
                <div class="bg-slate-800 rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-sm mb-1">شروع نشده</p>
                    <p class="text-3xl font-bold text-yellow-400">${summary.pendingOrders}</p>
                </div>
            </div>

            <!-- خلاصه مالی -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- تومان -->
                <div class="bg-gradient-to-br from-amber-50 to-yellow-100 rounded-xl p-5 border border-yellow-200">
                    <h3 class="text-gray-800 font-bold text-lg mb-4 flex items-center">
                        <i class="fas fa-coins text-yellow-500 ml-2"></i>
                        خلاصه مالی (تومان)
                    </h3>
                    <div class="space-y-3">
                        <div class="flex justify-between items-center p-3 bg-white bg-opacity-70 rounded-lg">
                            <span class="text-gray-600 text-sm">جمع هزینه سفارشات</span>
                            <span class="text-gray-800 font-bold">${summary.totalCostToman.toLocaleString()} تومان</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-white bg-opacity-70 rounded-lg">
                            <span class="text-gray-600 text-sm">دریافت شده</span>
                            <span class="text-green-600 font-bold">${summary.paidToman.toLocaleString()} تومان</span>
                        </div>
                        <div class="flex justify-between items-center p-3 ${summary.remainingToman > 0 ? 'bg-red-100 border border-red-300' : 'bg-green-100 border border-green-300'} rounded-lg">
                            <span class="text-gray-700 text-sm font-medium">مانده</span>
                            <span class="${summary.remainingToman > 0 ? 'text-red-600' : 'text-green-600'} font-bold text-lg">${summary.remainingToman.toLocaleString()} تومان</span>
                        </div>
                    </div>
                </div>

                <!-- دلار -->
                <div class="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-5 border border-green-200">
                    <h3 class="text-gray-800 font-bold text-lg mb-4 flex items-center">
                        <i class="fas fa-dollar-sign text-green-500 ml-2"></i>
                        خلاصه مالی (دلار)
                    </h3>
                    <div class="space-y-3">
                        <div class="flex justify-between items-center p-3 bg-white bg-opacity-70 rounded-lg">
                            <span class="text-gray-600 text-sm">جمع هزینه سفارشات</span>
                            <span class="text-gray-800 font-bold">$ ${summary.totalCostDollar.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-white bg-opacity-70 rounded-lg">
                            <span class="text-gray-600 text-sm">دریافت شده</span>
                            <span class="text-green-600 font-bold">$ ${summary.paidDollar.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 ${summary.remainingDollar > 0 ? 'bg-red-100 border border-red-300' : 'bg-green-100 border border-green-300'} rounded-lg">
                            <span class="text-gray-700 text-sm font-medium">مانده</span>
                            <span class="${summary.remainingDollar > 0 ? 'text-red-600' : 'text-green-600'} font-bold text-lg">$ ${summary.remainingDollar.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- لیست سفارشات -->
            <div class="bg-slate-800 rounded-xl p-5">
                <h3 class="text-white font-bold text-lg mb-4 flex items-center">
                    <i class="fas fa-list text-yellow-400 ml-2"></i>
                    سفارشات من
                    <span class="mr-2 text-sm font-normal text-gray-400">(${orders.length} سفارش)</span>
                </h3>

                ${orders.length === 0 ? `
                    <div class="text-center py-10 text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-3"></i>
                        <p>هیچ سفارشی به شما تخصیص داده نشده است</p>
                    </div>
                ` : `
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="border-b border-slate-700">
                                    <th class="text-right py-3 px-3 text-gray-400 font-medium">دانشجو</th>
                                    <th class="text-right py-3 px-3 text-gray-400 font-medium">نوع کار</th>
                                    <th class="text-right py-3 px-3 text-gray-400 font-medium">مهلت</th>
                                    <th class="text-right py-3 px-3 text-gray-400 font-medium">هزینه</th>
                                    <th class="text-right py-3 px-3 text-gray-400 font-medium">وضعیت</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-700">
                                ${orders.map(o => this.getOrderRow(o)).join('')}
                            </tbody>
                            <tfoot>
                                <tr class="border-t-2 border-slate-500">
                                    <td colspan="3" class="py-3 px-3 text-gray-400 font-bold">جمع کل</td>
                                    <td class="py-3 px-3">
                                        ${summary.totalCostToman > 0 ? `<span class="text-yellow-400 font-bold block">${summary.totalCostToman.toLocaleString()} تومان</span>` : ''}
                                        ${summary.totalCostDollar > 0 ? `<span class="text-green-400 font-bold block">$ ${summary.totalCostDollar.toLocaleString()}</span>` : ''}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                `}
            </div>

            <!-- تاریخچه دریافتی‌ها -->
            <div class="bg-slate-800 rounded-xl p-5">
                <h3 class="text-white font-bold text-lg mb-4 flex items-center">
                    <i class="fas fa-history text-green-400 ml-2"></i>
                    تاریخچه دریافتی‌ها
                    <span class="mr-2 text-sm font-normal text-gray-400">(${payments.length} تراکنش)</span>
                </h3>

                ${payments.length === 0 ? `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-money-bill-wave text-4xl mb-3"></i>
                        <p>هیچ دریافتی ثبت نشده است</p>
                    </div>
                ` : `
                    <div class="space-y-3">
                        ${payments.map(p => `
                            <div class="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center">
                                        <i class="fas fa-arrow-down text-green-400"></i>
                                    </div>
                                    <div>
                                        <p class="text-white text-sm font-medium">${p.description || 'دریافتی'}</p>
                                        <p class="text-gray-500 text-xs">${new Date(p.date).toLocaleDateString('fa-IR')}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <span class="text-green-400 font-bold">${parseFloat(p.amount).toLocaleString()} ${p.currency || 'تومان'}</span>
                                    <button onclick="AgentAccountingModule.deletePaymentAndRefresh('${agentId}', '${p.id}')"
                                            class="text-red-500 hover:text-red-400 p-1" title="حذف">
                                        <i class="fas fa-trash text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

        </div>
        `;
    },

    // سطر جدول سفارشات
    getOrderRow(order) {
        const cost = parseFloat(order.cost) || parseFloat(order.totalAmount) || 0;
        const currency = order.currency || 'تومان';
        const statusMap = {
            'pending': { text: 'شروع نشده', cls: 'bg-yellow-900 text-yellow-300' },
            'in_progress': { text: 'در حال انجام', cls: 'bg-blue-900 text-blue-300' },
            'completed': { text: 'تکمیل شده', cls: 'bg-green-900 text-green-300' },
            'approved': { text: 'تایید شده', cls: 'bg-yellow-900 text-yellow-300' },
        };
        const st = statusMap[order.status] || { text: order.status, cls: 'bg-gray-700 text-gray-300' };
        const deadline = order.deadline ? new Date(order.deadline).toLocaleDateString('fa-IR') : '---';

        return `
            <tr class="hover:bg-slate-700 transition-colors">
                <td class="py-3 px-3 text-white">${order.studentName || '---'}</td>
                <td class="py-3 px-3 text-gray-300">${order.type || '---'}</td>
                <td class="py-3 px-3 text-gray-400 text-xs">${deadline}</td>
                <td class="py-3 px-3">
                    ${cost > 0 ? `<span class="font-bold ${currency === 'دلار' ? 'text-green-400' : 'text-yellow-400'}">${cost.toLocaleString()} ${currency}</span>` : '<span class="text-gray-500">---</span>'}
                </td>
                <td class="py-3 px-3">
                    <span class="px-2 py-1 rounded-full text-xs ${st.cls}">${st.text}</span>
                </td>
            </tr>
        `;
    },

    // نمایش modal ثبت دریافتی
    showAddPaymentModal(agentId) {
        const modal = document.createElement('div');
        modal.id = 'add-payment-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 border border-slate-600">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-xl font-bold text-white">
                        <i class="fas fa-plus-circle text-green-400 ml-2"></i>
                        ثبت دریافتی جدید
                    </h3>
                    <button onclick="document.getElementById('add-payment-modal').remove()"
                            class="text-gray-400 hover:text-white text-xl">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">مبلغ <span class="text-red-400">*</span></label>
                        <div class="flex gap-2">
                            <input type="number" id="pay-amount" min="0" placeholder="مبلغ"
                                   class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-green-500">
                            <select id="pay-currency"
                                    class="bg-slate-900 border border-slate-600 rounded-lg px-3 py-3 text-white">
                                <option value="تومان">تومان</option>
                                <option value="دلار">دلار</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">توضیحات</label>
                        <input type="text" id="pay-desc" placeholder="مثال: دریافت از مدیر، حقوق ماه ..."
                               class="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-green-500">
                    </div>
                </div>

                <div class="flex gap-3 mt-6">
                    <button onclick="AgentAccountingModule.addPayment('${agentId}')"
                            class="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium">
                        <i class="fas fa-check ml-2"></i>
                        ثبت دریافتی
                    </button>
                    <button onclick="document.getElementById('add-payment-modal').remove()"
                            class="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium">
                        انصراف
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // ثبت دریافتی
    addPayment(agentId) {
        const amount = parseFloat(document.getElementById('pay-amount').value);
        const currency = document.getElementById('pay-currency').value;
        const description = document.getElementById('pay-desc').value;

        if (!amount || amount <= 0) {
            alert('لطفاً مبلغ را وارد کنید');
            return;
        }

        this.savePayment(agentId, { amount, currency, description });
        document.getElementById('add-payment-modal').remove();
        this.refresh(agentId);
    },

    // حذف دریافتی و refresh
    deletePaymentAndRefresh(agentId, paymentId) {
        if (!confirm('این دریافتی حذف شود؟')) return;
        this.deletePayment(agentId, paymentId);
        this.refresh(agentId);
    },

    // بازسازی محتوا
    refresh(agentId) {
        const page = document.getElementById('agent-accounting-page');
        if (page) {
            page.outerHTML = this.getContent(agentId);
        }
    }
};

window.AgentAccountingModule = AgentAccountingModule;
