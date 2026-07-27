/**
 * سیستم حسابداری کارمندان
 * محاسبه حقوق و دستمزد بر اساس ساعات کاری و هزینه‌ها
 * ذخیره‌سازی: localStorage + Supabase employee_hourly_rates
 */

const EmployeeAccountingModule = (function() {
    'use strict';

    const STORAGE_KEY      = 'employee_accounting_settings';
    const HOURLY_RATES_KEY = 'employee_hourly_rates';

    // ── Helper ───────────────────────────────────────────────
    function _sb() {
        return typeof SupabaseDataModule !== 'undefined' &&
               typeof SupabaseConnection  !== 'undefined' &&
               SupabaseConnection.isOnline === true
               ? SupabaseDataModule : null;
    }

    function getSettings() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : { defaultHourlyRate: 0, currency: 'تومان' };
        } catch (error) {
            return { defaultHourlyRate: 0, currency: 'تومان' };
        }
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            return true;
        } catch (error) { return false; }
    }

    function getHourlyRates() {
        try {
            const data = localStorage.getItem(HOURLY_RATES_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) { return {}; }
    }

    function setHourlyRate(employeeId, rate) {
        try {
            const rates = getHourlyRates();
            rates[employeeId] = parseFloat(rate) || 0;
            localStorage.setItem(HOURLY_RATES_KEY, JSON.stringify(rates));

            // sync به Supabase — جدول employee_hourly_rates
            const sb = _sb();
            if (sb && typeof sb._db === 'function') {
                const client = sb._db();
                if (client) {
                    client.from('employee_hourly_rates')
                        .upsert({
                            employee_id: employeeId,
                            hourly_rate: parseFloat(rate) || 0,
                            currency:    'تومان',
                            updated_at:  new Date().toISOString()
                        }, { onConflict: 'employee_id' })
                        .then(({ error }) => {
                            if (error) console.warn('⚠️ setHourlyRate Supabase خطا:', error.message);
                            else       console.log('✅ نرخ ساعتی در Supabase ذخیره شد:', employeeId);
                        });
                }
            }
            return true;
        } catch (error) { return false; }
    }

    function getEmployeeHourlyRate(employeeId) {
        // sync از Supabase در پس‌زمینه
        const sb = _sb();
        if (sb && typeof sb._db === 'function') {
            const client = sb._db();
            if (client) {
                client.from('employee_hourly_rates')
                    .select('hourly_rate')
                    .eq('employee_id', employeeId)
                    .maybeSingle()
                    .then(({ data, error }) => {
                        if (!error && data) {
                            const rates = getHourlyRates();
                            rates[employeeId] = parseFloat(data.hourly_rate) || 0;
                            localStorage.setItem(HOURLY_RATES_KEY, JSON.stringify(rates));
                        }
                    }).catch(() => {});
            }
        }
        const rates = getHourlyRates();
        const settings = getSettings();
        return rates[employeeId] ?? settings.defaultHourlyRate ?? 0;
    }

    function resolveEmployeeName(employeeId, entries) {
        if (entries.length > 0 && entries[0].employeeName) {
            return entries[0].employeeName;
        }
        const known = WorkHoursModule.getEmployeeHoursSummary().find(e => e.employeeId === employeeId);
        return known ? known.employeeName : 'نامشخص';
    }

    function getEmployeeFinancialSummary(employeeId, startDate = null, endDate = null) {
        const allEntries = WorkHoursModule.getAllEntriesByEmployee(employeeId);

        let filteredEntries = allEntries;
        if (startDate) filteredEntries = filteredEntries.filter(e => e.date >= startDate);
        if (endDate) filteredEntries = filteredEntries.filter(e => e.date <= endDate);

        const workHours = filteredEntries.filter(e => e.type === 'work' || !e.type);
        const expenses = filteredEntries.filter(e => e.type === 'expense');

        const submittedHours = workHours.filter(h => h.status !== 'rejected');
        const totalHoursSubmitted = submittedHours.reduce((sum, h) => sum + parseFloat(h.totalHours || 0), 0);

        const submittedExpenses = expenses.filter(e => e.status !== 'rejected');
        const totalExpensesSubmitted = submittedExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        const approvedHours = workHours.filter(h => h.status === 'approved');
        const totalHoursApproved = approvedHours.reduce((sum, h) => sum + parseFloat(h.totalHours || 0), 0);

        const approvedExpenses = expenses.filter(e => e.status === 'approved');
        const totalExpensesApproved = approvedExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        const hourlyRate = getEmployeeHourlyRate(employeeId);
        const totalAmount = totalHoursApproved * hourlyRate;
        const grandTotal = totalAmount + totalExpensesApproved;

        const workDays = new Set(submittedHours.map(h => h.date)).size;

        return {
            employeeId,
            employeeName: resolveEmployeeName(employeeId, allEntries),
            totalHours: totalHoursSubmitted.toFixed(2),
            totalHoursApproved: totalHoursApproved.toFixed(2),
            totalExpenses: totalExpensesSubmitted,
            totalExpensesApproved,
            hourlyRate,
            totalAmount,
            grandTotal,
            workDays,
            hoursCount: submittedHours.length,
            expensesCount: submittedExpenses.length,
            pendingHours: workHours.filter(h => h.status === 'pending').length,
            pendingExpenses: expenses.filter(e => e.status === 'pending').length,
            rejectedHours: workHours.filter(h => h.status === 'rejected').length,
            rejectedExpenses: expenses.filter(e => e.status === 'rejected').length
        };
    }

    function getAllEmployeesSummary(startDate = null, endDate = null) {
        const summary = WorkHoursModule.getEmployeeHoursSummary();
        return summary.map(emp => getEmployeeFinancialSummary(emp.employeeId, startDate, endDate));
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('fa-IR').format(Math.round(amount || 0)) + ' تومان';
    }

    function formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return {
        getSettings,
        saveSettings,
        getHourlyRates,
        setHourlyRate,
        getEmployeeHourlyRate,
        getEmployeeFinancialSummary,
        getAllEmployeesSummary,
        formatCurrency,
        formatDate
    };
})();


/**
 * رابط کاربری حسابداری کارمندان
 */
const EmployeeAccountingUI = (function() {
    'use strict';

    let currentUser = null;

    function init() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
            } catch (e) {
                console.error('Error parsing currentUser:', e);
            }
        }
    }

    function refreshContent() {
        init();
        const appEl = document.querySelector('[x-data]');
        if (appEl && typeof Alpine !== 'undefined' && Alpine.$data) {
            const app = Alpine.$data(appEl);
            if (app && app.currentPage) {
                const page = app.currentPage;
                app.currentPage = '';
                setTimeout(() => { app.currentPage = page; }, 10);
            }
        }
    }

    function showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        const icons = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };

        const notification = document.createElement('div');
        notification.className = `fixed top-4 left-4 ${colors[type] || colors.info} text-gray-900 px-6 py-3 rounded-xl shadow-lg z-50`;
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fas fa-${icons[type] || icons.info}"></i>
                <span>${message}</span>
            </div>`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    function renderEntriesList(entries) {
        const statusColors = {
            pending:  'bg-blue-500/20 text-blue-300 border border-blue-400/30',
            approved: 'bg-green-500/20 text-green-300 border border-green-400/30',
            rejected: 'bg-red-500/20 text-red-300 border border-red-400/30'
        };
        const statusTexts = { pending: 'در انتظار', approved: 'تأیید شده', rejected: 'رد شده' };

        if (!entries || entries.length === 0) {
            return '<tr><td colspan="6" class="text-center py-8 text-blue-200">رکوردی یافت نشد</td></tr>';
        }

        return entries.map(entry => {
            const isExpense = entry.type === 'expense';
            const valueCell = isExpense
                ? `<span class="text-orange-400 font-bold">${EmployeeAccountingModule.formatCurrency(entry.amount || 0)}</span>`
                : `<span class="text-blue-400 font-bold">${entry.totalHours || 0} ساعت</span>`;
            const typeCell = isExpense
                ? '<span class="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs"><i class="fas fa-receipt ml-1"></i>هزینه</span>'
                : '<span class="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs"><i class="fas fa-clock ml-1"></i>ساعت کاری</span>';
            // زمان کاری برای ساعت
            const timeRange = !isExpense && entry.startTime && entry.endTime
                ? `<span class="text-blue-300/60 text-xs block">${entry.startTime} — ${entry.endTime}</span>` : '';

            return `
                <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="py-3 px-4">${typeCell}</td>
                    <td class="py-3 px-4 text-white text-sm">${entry.date}${timeRange}</td>
                    <td class="py-3 px-4">${valueCell}</td>
                    <td class="py-3 px-4 text-blue-200 text-sm whitespace-pre-wrap break-words max-w-xs">${entry.description || '—'}</td>
                    <td class="text-center py-3 px-4">
                        <span class="${statusColors[entry.status] || statusColors.pending} px-3 py-1 rounded-full text-xs">
                            ${statusTexts[entry.status] || entry.status}
                        </span>
                    </td>
                </tr>`;
        }).join('');
    }

    function getEmployeeContent() {
        if (!currentUser) {
            return '<p class="text-red-400">لطفاً وارد شوید</p>';
        }

        const summary = EmployeeAccountingModule.getEmployeeFinancialSummary(currentUser.id);
        const allEntries = WorkHoursModule.getAllEntriesByEmployee(currentUser.id);

        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlySummary = EmployeeAccountingModule.getEmployeeFinancialSummary(
            currentUser.id,
            EmployeeAccountingModule.formatDate(firstDay),
            EmployeeAccountingModule.formatDate(now)
        );

        const hoursPayment = parseFloat(monthlySummary.totalHoursApproved) * monthlySummary.hourlyRate;

        return `
            <div class="space-y-6">
                <div class="bg-gradient-to-r from-emerald-500/20 to-green-500/20 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                        <i class="fas fa-calculator text-emerald-400"></i>
                        حسابداری شخصی
                    </h2>
                    <p class="text-emerald-200 mt-2">جمع ساعات و هزینه‌های ارسالی شما</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-clock text-2xl text-blue-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">جمع ساعات ارسالی</p>
                                <p class="text-3xl font-bold text-white">${summary.totalHours}</p>
                                <p class="text-blue-300 text-xs">${summary.hoursCount} گزارش · ${summary.workDays} روز</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-orange-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-money-bill-wave text-2xl text-orange-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">جمع هزینه‌های ارسالی</p>
                                <p class="text-xl font-bold text-white">${EmployeeAccountingModule.formatCurrency(summary.totalExpenses)}</p>
                                <p class="text-blue-300 text-xs">${summary.expensesCount} مورد</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-hand-holding-usd text-2xl text-yellow-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">نرخ ساعتی (مدیر)</p>
                                <p class="text-xl font-bold text-white">${EmployeeAccountingModule.formatCurrency(summary.hourlyRate)}</p>
                                <p class="text-blue-300 text-xs">هر ساعت کار</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-wallet text-2xl text-emerald-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">مبلغ کل (تأیید شده)</p>
                                <p class="text-xl font-bold text-emerald-400">${EmployeeAccountingModule.formatCurrency(summary.grandTotal)}</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-red-400/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-red-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-minus-circle text-2xl text-red-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">جمع کسورات</p>
                                <p class="text-xl font-bold text-red-400">${EmployeeAccountingModule.formatCurrency(
                                    (() => { try {
                                        const u = JSON.parse(localStorage.getItem('currentUser')||'{}');
                                        return JSON.parse(localStorage.getItem('work_deductions')||'[]')
                                            .filter(d => d.employeeId === u.id)
                                            .reduce((s,d) => s + Number(d.amount||0), 0);
                                    } catch { return 0; } })()
                                )}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-gradient-to-r from-yellow-500/20 to-yellow-500/20 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i class="fas fa-calendar-alt text-yellow-400"></i>
                        خلاصه ماه جاری
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-yellow-200 text-sm mb-1">ساعات این ماه</p>
                            <p class="text-2xl font-bold text-white">${monthlySummary.totalHours} ساعت</p>
                            <p class="text-yellow-300 text-xs mt-1">${monthlySummary.hoursCount} گزارش روزانه</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-yellow-200 text-sm mb-1">هزینه‌های این ماه</p>
                            <p class="text-2xl font-bold text-white">${EmployeeAccountingModule.formatCurrency(monthlySummary.totalExpenses)}</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-yellow-200 text-sm mb-1">حقوق ساعات (تأیید × نرخ)</p>
                            <p class="text-2xl font-bold text-blue-400">${EmployeeAccountingModule.formatCurrency(hoursPayment)}</p>
                            <p class="text-yellow-300 text-xs mt-1">${monthlySummary.totalHoursApproved} ساعت تأیید × ${EmployeeAccountingModule.formatCurrency(monthlySummary.hourlyRate)}</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-yellow-200 text-sm mb-1">جمع کل این ماه</p>
                            <p class="text-2xl font-bold text-emerald-400">${EmployeeAccountingModule.formatCurrency(monthlySummary.grandTotal)}</p>
                            <p class="text-yellow-300 text-xs mt-1">حقوق ساعات + هزینه‌های تأیید</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="fas fa-list text-blue-400"></i>
                        جزئیات سوابق
                    </h3>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/10">
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">نوع</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">تاریخ</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">ساعت/مبلغ</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">شرح</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">وضعیت</th>
                                </tr>
                            </thead>
                            <tbody>${renderEntriesList(allEntries)}</tbody>
                        </table>
                    </div>
                </div>

                <div class="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                    <h4 class="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <i class="fas fa-info-circle text-blue-400"></i>
                        راهنما
                    </h4>
                    <ul class="text-blue-200 text-sm space-y-2">
                        <li><i class="fas fa-check text-green-400 ml-2"></i>گزارش‌های روزانه ساعات کاری و هزینه‌ها در این صفحه جمع می‌شوند</li>
                        <li><i class="fas fa-check text-green-400 ml-2"></i>مبلغ حقوق = (ساعات تأیید شده × نرخ ساعتی) + هزینه‌های تأیید شده</li>
                        <li><i class="fas fa-check text-green-400 ml-2"></i>نرخ ساعتی توسط مدیر در بخش «حسابداری کارمندان» تعیین می‌شود</li>
                    </ul>
                </div>
            </div>`;
    }

    function getManagerEmployeesContent() {
        const employeesSummary = EmployeeAccountingModule.getAllEmployeesSummary();

        const totalAmount = employeesSummary.reduce((sum, emp) => sum + emp.grandTotal, 0);
        const totalHours = employeesSummary.reduce((sum, emp) => sum + parseFloat(emp.totalHoursApproved || emp.totalHours), 0);
        const totalExpenses = employeesSummary.reduce((sum, emp) => sum + emp.totalExpensesApproved, 0);

        // ── ساعات و هزینه‌های در انتظار تأیید ──
        const pendingHours    = (typeof WorkHoursModule !== 'undefined') ? WorkHoursModule.getPendingWorkHours()  : [];
        const pendingExpenses = (typeof WorkHoursModule !== 'undefined') ? WorkHoursModule.getPendingExpenses()   : [];

        const pendingSection = (pendingHours.length > 0 || pendingExpenses.length > 0) ? `
        <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-yellow-400/30">
            <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <i class="fas fa-hourglass-half text-yellow-400"></i>
                در انتظار تأیید
                <span class="bg-yellow-500/30 text-yellow-300 text-sm px-3 py-0.5 rounded-full">${pendingHours.length + pendingExpenses.length}</span>
            </h3>
            <div class="space-y-3">
                ${[...pendingHours.map(e=>({...e,_kind:'hour'})), ...pendingExpenses.map(e=>({...e,_kind:'expense'}))].map(entry => `
                <div class="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 ${entry._kind==='hour'?'bg-blue-500/20':'bg-orange-500/20'} rounded-full flex items-center justify-center">
                            <i class="fas ${entry._kind==='hour'?'fa-clock text-blue-400':'fa-money-bill-wave text-orange-400'}"></i>
                        </div>
                        <div>
                            <p class="text-white font-medium">${entry.employeeName}</p>
                            <p class="text-blue-200 text-sm">${typeof Jalali!=='undefined'?Jalali.displayDate(entry.date):entry.date}
                                ${entry._kind==='hour' ? ` | ${entry.startTime||'-'} - ${entry.endTime||'-'} | <span class="text-emerald-400 font-bold">${entry.totalHours||0} ساعت</span>` : ` | <span class="text-orange-400 font-bold">${entry.amount?entry.amount.toLocaleString('fa-IR'):0} تومان</span>`}
                            </p>
                            ${entry.description ? `<p class="text-blue-300 text-xs mt-1">${entry.description}</p>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button onclick="WorkHoursUI.approveEntry('${entry.id}')"
                            class="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg text-sm transition-all">
                            <i class="fas fa-check ml-1"></i>تأیید
                        </button>
                        <button onclick="WorkHoursUI.rejectEntry('${entry.id}')"
                            class="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-sm transition-all">
                            <i class="fas fa-times ml-1"></i>رد
                        </button>
                    </div>
                </div>`).join('')}
            </div>
        </div>` : '';

        // ── خلاصه روزانه (امروز) ──
        const todayStr = EmployeeAccountingModule.formatDate(new Date());
        const todayEntries = (typeof WorkHoursModule !== 'undefined') ? WorkHoursModule.getWorkHours().filter(e => e.date === todayStr) : [];
        const dailyRows = todayEntries.length ? todayEntries.map(e => {
            const isExp = e.type === 'expense';
            const statusMap = {approved:'تأیید',rejected:'رد',pending:'در انتظار'};
            const statusCls = e.status==='approved'?'bg-green-500/20 text-green-400':e.status==='rejected'?'bg-red-500/20 text-red-400':'bg-blue-500/20 text-blue-400';
            return `<tr class="border-b border-white/5 hover:bg-white/5">
                <td class="py-2 px-4 text-white text-sm">${e.employeeName||'—'}</td>
                <td class="py-2 px-4">${isExp?'<span class="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-xs">هزینه</span>':'<span class="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">ساعت کاری</span>'}</td>
                <td class="py-2 px-4 text-center">${isExp?`<span class="text-orange-400 font-bold">${(e.amount||0).toLocaleString('fa-IR')} ت</span>`:`<span class="text-emerald-400 font-bold">${e.totalHours||0} ساعت</span>`}</td>
                <td class="py-2 px-4 text-blue-200 text-xs max-w-xs truncate">${e.description||'—'}</td>
                <td class="py-2 px-4 text-center"><span class="${statusCls} px-2 py-0.5 rounded-full text-xs">${statusMap[e.status]||e.status}</span></td>
            </tr>`;
        }).join('') : `<tr><td colspan="5" class="text-center py-6 text-blue-300 text-sm">امروز هیچ ثبتی وجود ندارد</td></tr>`;

        const employeeRows = employeesSummary.length > 0
            ? employeesSummary.map(emp => {
                const hasPending = emp.pendingHours > 0 || emp.pendingExpenses > 0;
                const statusBadge = hasPending
                    ? `<span class="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs">${emp.pendingHours + emp.pendingExpenses} در انتظار</span>`
                    : '<span class="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs"><i class="fas fa-check ml-1"></i>تأیید</span>';

                const safeName = (emp.employeeName || '').replace(/'/g, "\\'");

                return `
                    <tr class="border-b border-white/5 hover:bg-white/5">
                        <td class="py-4 px-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                                    <i class="fas fa-user text-yellow-400"></i>
                                </div>
                                <span class="text-white font-medium">${emp.employeeName}</span>
                            </div>
                        </td>
                        <td class="text-center py-4 px-4">
                            <button onclick="EmployeeAccountingUI.showEditRateModal('${emp.employeeId}', '${safeName}', ${emp.hourlyRate})"
                                    class="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-lg text-sm transition-all">
                                ${EmployeeAccountingModule.formatCurrency(emp.hourlyRate)}/ساعت
                                <i class="fas fa-edit mr-1"></i>
                            </button>
                        </td>
                        <td class="text-center py-4 px-4">
                            <span class="text-2xl font-bold text-blue-400">${emp.totalHoursApproved}</span>
                            <span class="text-blue-300 text-sm"> ساعت</span>
                            <p class="text-blue-400/60 text-xs">${emp.hoursCount} گزارش</p>
                        </td>
                        <td class="text-center py-4 px-4">
                            <span class="text-orange-400 font-bold">${EmployeeAccountingModule.formatCurrency(emp.totalExpensesApproved)}</span>
                        </td>
                        <td class="text-center py-4 px-4">
                            <span class="text-white font-bold">${EmployeeAccountingModule.formatCurrency(emp.totalAmount)}</span>
                        </td>
                    <td class="text-center py-4 px-4">
                        ${(() => {
                            const paid = (() => { try { return JSON.parse(localStorage.getItem('work_settlements')||'[]').filter(s=>s.employeeId===emp.employeeId).reduce((s,r)=>s+Number(r.amount||0),0); } catch { return 0; } })();
                            const ded  = (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]').filter(d=>d.employeeId===emp.employeeId).reduce((s,d)=>s+Number(d.amount||0),0); } catch { return 0; } })();
                            const gift = (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]').filter(g=>g.employeeId===emp.employeeId).reduce((s,g)=>s+Number(g.amount||0),0); } catch { return 0; } })();
                            const remaining = emp.grandTotal + gift - ded - paid;
                            const color = remaining > 0 ? 'text-emerald-400' : remaining < 0 ? 'text-red-400' : 'text-gray-400';
                            return `<div><span class="text-lg font-bold ${color}">${EmployeeAccountingModule.formatCurrency(remaining)}</span>${paid > 0 ? `<p class="text-purple-400 text-xs mt-0.5">تسویه: ${EmployeeAccountingModule.formatCurrency(paid)}</p>` : ''}</div>`;
                        })()}
                    </td>
                    <td class="text-center py-4 px-4">${statusBadge}</td>
                    <td class="text-center py-4 px-4">
                        <div class="flex gap-1 justify-center flex-wrap">
                            <button onclick="EmployeeAccountingUI.showEmployeeDetails('${emp.employeeId}')"
                                    class="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 rounded-lg text-xs transition-all">
                                <i class="fas fa-eye ml-1"></i>جزئیات
                            </button>
                            <button onclick="EmployeeAccountingUI.showGiftModal('${emp.employeeId}', '${safeName}')"
                                    class="px-2 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg text-xs transition-all">
                                <i class="fas fa-gift ml-1"></i>هدیه
                            </button>
                            <button onclick="EmployeeAccountingUI.showDeductionModal('${emp.employeeId}', '${safeName}')"
                                    class="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-xs transition-all">
                                <i class="fas fa-minus ml-1"></i>کسر
                            </button>
                            <button onclick="EmployeeAccountingUI.showSettlementModal('${emp.employeeId}', '${safeName}', ${emp.grandTotal})"
                                    class="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded-lg text-xs transition-all">
                                <i class="fas fa-hand-holding-usd ml-1"></i>تسویه
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('')
            : `<tr>
                <td colspan="8" class="text-center py-12">
                    <i class="fas fa-users text-5xl text-yellow-400/30 mb-4 block"></i>
                    <p class="text-blue-200">هنوز کارمندی گزارش ارسال نکرده است</p>
                    <p class="text-blue-300/60 text-sm mt-2">پس از ثبت ساعات کاری توسط کارمندان، اینجا نمایش داده می‌شود</p>
                </td>
            </tr>`;

        return `
            <div class="space-y-6">
                <div class="bg-gradient-to-r from-yellow-500/20 to-yellow-500/20 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                                <i class="fas fa-users-cog text-yellow-400"></i>
                                حسابداری کارمندان
                            </h2>
                            <p class="text-yellow-200 mt-2">تأیید ساعات، مدیریت هزینه‌ها و تسویه حساب کارمندان</p>
                        </div>
                    </div>
                </div>

                <!-- ۷ کارت متریک -->
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-blue-400/20">
                        <i class="fas fa-paper-plane text-blue-400 mb-2 block"></i>
                        <p class="text-blue-200 text-xs mb-1">ساعات ارسال‌شده</p>
                        <p class="text-lg font-bold text-blue-400">${employeesSummary.reduce((s,e)=>s+parseFloat(e.totalHours||0),0).toFixed(1)}</p>
                        <p class="text-blue-300/60 text-xs">ساعت</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-emerald-400/20">
                        <i class="fas fa-check-circle text-emerald-400 mb-2 block"></i>
                        <p class="text-blue-200 text-xs mb-1">ساعات تأییدشده</p>
                        <p class="text-lg font-bold text-emerald-400">${totalHours.toFixed(1)}</p>
                        <p class="text-blue-300/60 text-xs">ساعت</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-orange-400/20">
                        <i class="fas fa-receipt text-orange-400 mb-2 block"></i>
                        <p class="text-blue-200 text-xs mb-1">هزینه‌های ارسال‌شده</p>
                        <p class="text-sm font-bold text-orange-400">${EmployeeAccountingModule.formatCurrency(
                            employeesSummary.reduce((s,e)=>s+(e.totalExpenses||e.totalExpensesApproved||0),0)
                        )}</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-cyan-400/20">
                        <i class="fas fa-check-double text-cyan-400 mb-2 block"></i>
                        <p class="text-blue-200 text-xs mb-1">هزینه‌های تأییدشده</p>
                        <p class="text-sm font-bold text-cyan-400">${EmployeeAccountingModule.formatCurrency(totalExpenses)}</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-red-400/20">
                        <i class="fas fa-minus-circle text-red-400 mb-2 block"></i>
                        <p class="text-blue-200 text-xs mb-1">جمع کسورات</p>
                        <p class="text-sm font-bold text-red-400">${EmployeeAccountingModule.formatCurrency(
                            (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]').reduce((s,d)=>s+Number(d.amount||0),0); } catch { return 0; } })()
                        )}</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-yellow-400/20">
                        <i class="fas fa-wallet text-yellow-400 mb-2 block"></i>
                        <p class="text-blue-200 text-xs mb-1">مبالغ تسویه‌نشده</p>
                        <p class="text-sm font-bold text-yellow-400">${EmployeeAccountingModule.formatCurrency(
                            (() => {
                                const settlements = (() => { try { return JSON.parse(localStorage.getItem('work_settlements')||'[]'); } catch { return []; } })();
                                const deductions  = (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]'); } catch { return []; } })();
                                const gifts       = (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]'); } catch { return []; } })();
                                return employeesSummary.reduce((total, emp) => {
                                    const paid = settlements.filter(s=>s.employeeId===emp.employeeId).reduce((s,r)=>s+Number(r.amount||0),0);
                                    const ded  = deductions.filter(d=>d.employeeId===emp.employeeId).reduce((s,d)=>s+Number(d.amount||0),0);
                                    const gift = gifts.filter(g=>g.employeeId===emp.employeeId).reduce((s,g)=>s+Number(g.amount||0),0);
                                    const rem  = emp.grandTotal + gift - ded - paid;
                                    return total + Math.max(0, rem);
                                }, 0);
                            })()
                        )}</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-green-400/20">
                        <i class="fas fa-gift text-green-400 mb-2 block"></i>
                        <p class="text-blue-200 text-xs mb-1">جمع هدایا</p>
                        <p class="text-sm font-bold text-green-400">${EmployeeAccountingModule.formatCurrency(
                            (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]').reduce((s,g)=>s+Number(g.amount||0),0); } catch { return 0; } })()
                        )}</p>
                    </div>
                </div>

                ${/* pendingSection فقط در جزئیات نمایش داده می‌شه */ ''}

                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-5 flex items-center gap-2">
                        <i class="fas fa-table text-blue-400"></i>
                        خلاصه کاری کارمندان
                    </h3>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/10">
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">نام کارمند</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">نرخ ساعتی</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">ساعات تأیید</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">هزینه‌ها</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">مبلغ ساعات</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">مانده طلب</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">وضعیت</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">عملیات</th>
                                </tr>
                            </thead>
                            <tbody>${employeeRows}</tbody>
                        </table>
                    </div>
                </div>

                <!-- خلاصه روزانه کارمندان -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i class="fas fa-calendar-day text-cyan-400"></i>
                        خلاصه روزانه کارمندان
                        <span class="bg-cyan-500/20 text-cyan-300 text-sm px-3 py-0.5 rounded-full">
                            ${typeof Jalali !== 'undefined' ? Jalali.displayDate(todayStr) : todayStr}
                        </span>
                    </h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="border-b border-white/10 text-xs">
                                    <th class="text-right text-blue-200 font-medium py-2 px-4">نام کارمند</th>
                                    <th class="text-right text-blue-200 font-medium py-2 px-4">نوع</th>
                                    <th class="text-center text-blue-200 font-medium py-2 px-4">مقدار</th>
                                    <th class="text-right text-blue-200 font-medium py-2 px-4">توضیحات</th>
                                    <th class="text-center text-blue-200 font-medium py-2 px-4">وضعیت</th>
                                </tr>
                            </thead>
                            <tbody>${dailyRows}</tbody>
                        </table>
                    </div>
                </div>

                <!-- ── آرشیو حساب‌ها ── -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-purple-400/20">
                    <h3 class="text-xl font-bold text-white mb-5 flex items-center gap-2">
                        <i class="fas fa-archive text-purple-400"></i>
                        آرشیو حساب‌ها
                        <span class="text-blue-200 text-sm font-normal mr-2">— تسویه‌های انجام‌شده</span>
                    </h3>
                    ${(() => {
                        const settlements = (() => { try { return JSON.parse(localStorage.getItem('work_settlements')||'[]'); } catch { return []; } })();
                        if (!settlements.length) return `
                            <div class="text-center py-8 text-blue-300">
                                <i class="fas fa-inbox text-3xl mb-3 block opacity-40"></i>
                                <p class="text-sm">هنوز هیچ تسویه‌ای ثبت نشده</p>
                            </div>`;

                        // گروه‌بندی بر اساس کارمند
                        const byEmployee = {};
                        settlements.forEach(s => {
                            if (!byEmployee[s.employeeId]) byEmployee[s.employeeId] = { name: s.employeeName || s.employeeId, items: [] };
                            byEmployee[s.employeeId].items.push(s);
                        });

                        return Object.entries(byEmployee).map(([empId, data]) => {
                            const total = data.items.reduce((sum, s) => sum + Number(s.amount||0), 0);
                            const rows = data.items.map(s => `
                                <tr class="border-b border-white/5 hover:bg-white/5 text-sm">
                                    <td class="py-2 px-4 text-white">${s.date||'—'}</td>
                                    <td class="py-2 px-4 text-purple-300 font-bold">${Number(s.amount||0).toLocaleString('fa-IR')} ت</td>
                                    <td class="py-2 px-4 text-blue-200">${s.note||'—'}</td>
                                    <td class="py-2 px-4 text-center">
                                        <span class="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">تسویه شده</span>
                                    </td>
                                </tr>`).join('');

                            return `
                            <div class="mb-4 bg-white/5 rounded-xl overflow-hidden border border-white/10">
                                <div class="flex items-center justify-between px-4 py-3 bg-purple-500/10 border-b border-purple-400/20">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                                            <i class="fas fa-user text-yellow-400 text-xs"></i>
                                        </div>
                                        <span class="text-white font-semibold">${data.name}</span>
                                        <span class="text-blue-300 text-xs">${data.items.length} تسویه</span>
                                    </div>
                                    <span class="text-purple-300 font-bold text-sm">${total.toLocaleString('fa-IR')} ت</span>
                                </div>
                                <table class="w-full">
                                    <thead><tr class="border-b border-white/10 text-xs">
                                        <th class="text-right text-blue-200 py-2 px-4 font-medium">تاریخ</th>
                                        <th class="text-right text-blue-200 py-2 px-4 font-medium">مبلغ</th>
                                        <th class="text-right text-blue-200 py-2 px-4 font-medium">توضیح</th>
                                        <th class="text-center text-blue-200 py-2 px-4 font-medium">وضعیت</th>
                                    </tr></thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </div>`;
                        }).join('');
                    })()}
                </div>
            </div>`;
    }

    // ── مودال تسویه ──────────────────────────────────────────
    function showSettlementModal(employeeId, employeeName, grandTotal) {
        document.getElementById('settlement-modal')?.remove();

        // محاسبه مانده واقعی
        const paid = (() => { try { return JSON.parse(localStorage.getItem('work_settlements')||'[]').filter(s=>s.employeeId===employeeId).reduce((s,r)=>s+Number(r.amount||0),0); } catch { return 0; } })();
        const ded  = (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]').filter(d=>d.employeeId===employeeId).reduce((s,d)=>s+Number(d.amount||0),0); } catch { return 0; } })();
        const gift = (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]').filter(g=>g.employeeId===employeeId).reduce((s,g)=>s+Number(g.amount||0),0); } catch { return 0; } })();
        const remaining = grandTotal + gift - ded - paid;

        // تاریخچه تسویه‌ها
        const history = (() => { try { return JSON.parse(localStorage.getItem('work_settlements')||'[]').filter(s=>s.employeeId===employeeId); } catch { return []; } })();
        const historyRows = history.length ? history.map(s=>`
            <tr class="border-b border-white/5 text-xs">
                <td class="py-1.5 px-3 text-white">${s.date||'—'}</td>
                <td class="py-1.5 px-3 text-purple-300 font-bold">${Number(s.amount||0).toLocaleString('fa-IR')} ت</td>
                <td class="py-1.5 px-3 text-blue-200">${s.note||'—'}</td>
            </tr>`).join('') : `<tr><td colspan="3" class="text-center py-3 text-blue-300 text-xs">تسویه‌ای ثبت نشده</td></tr>`;

        const modal = document.createElement('div');
        modal.id = 'settlement-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-blue-900 rounded-2xl p-6 max-w-md w-full border border-purple-500/30 shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-white text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-hand-holding-usd text-purple-400"></i>تسویه حساب
                    </h3>
                    <button onclick="document.getElementById('settlement-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <p class="text-yellow-300 font-semibold mb-4">${employeeName}</p>

                <!-- مانده -->
                <div class="bg-purple-500/10 border border-purple-400/20 rounded-xl p-4 mb-5">
                    <div class="flex justify-between items-center">
                        <span class="text-blue-200 text-sm">جمع طلب کارمند</span>
                        <span class="text-emerald-400 font-bold">${EmployeeAccountingModule.formatCurrency(grandTotal + gift)}</span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-blue-200 text-sm">کسر کسورات</span>
                        <span class="text-red-400 font-bold">- ${EmployeeAccountingModule.formatCurrency(ded)}</span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-blue-200 text-sm">تسویه‌های قبلی</span>
                        <span class="text-purple-400 font-bold">- ${EmployeeAccountingModule.formatCurrency(paid)}</span>
                    </div>
                    <hr class="border-white/10 my-2">
                    <div class="flex justify-between items-center">
                        <span class="text-white font-semibold">مانده طلب</span>
                        <span class="text-xl font-bold ${remaining > 0 ? 'text-emerald-400' : remaining < 0 ? 'text-red-400' : 'text-gray-400'}">${EmployeeAccountingModule.formatCurrency(remaining)}</span>
                    </div>
                </div>

                <!-- فرم تسویه جدید -->
                <div class="space-y-3 mb-5">
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">تاریخ <span class="text-red-400">*</span></label>
                        <input type="date" id="settle-date" class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400">
                    </div>
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">مبلغ تسویه (تومان) <span class="text-red-400">*</span></label>
                        <div class="relative">
                            <input type="number" id="settle-amount" min="0" step="1000"
                                placeholder="${remaining > 0 ? 'مانده: ' + remaining.toLocaleString('fa-IR') : '0'}"
                                class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400">
                            ${remaining > 0 ? `<button type="button" onclick="document.getElementById('settle-amount').value='${remaining}'"
                                class="absolute left-2 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300 text-xs px-2 py-0.5 bg-purple-500/20 rounded">
                                تسویه کامل
                            </button>` : ''}
                        </div>
                    </div>
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">یادداشت</label>
                        <input type="text" id="settle-note" placeholder="مثال: پرداخت نقدی، کارت..."
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400">
                    </div>
                </div>
                <div class="flex gap-3 mb-5">
                    <button onclick="EmployeeAccountingUI.saveSettlement('${employeeId}', '${employeeName}')"
                        class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-save ml-1"></i>ثبت تسویه
                    </button>
                    <button onclick="document.getElementById('settlement-modal').remove()"
                        class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl transition-all">انصراف</button>
                </div>

                <!-- تاریخچه -->
                ${history.length > 0 ? `
                <div>
                    <h4 class="text-white text-sm font-semibold mb-2 flex items-center gap-1">
                        <i class="fas fa-history text-purple-400 text-xs"></i>تاریخچه تسویه‌ها
                    </h4>
                    <div class="overflow-auto max-h-40">
                        <table class="w-full">
                            <thead><tr class="text-blue-300 text-xs border-b border-white/10">
                                <th class="text-right py-1 px-3">تاریخ</th>
                                <th class="text-right py-1 px-3">مبلغ</th>
                                <th class="text-right py-1 px-3">یادداشت</th>
                            </tr></thead>
                            <tbody>${historyRows}</tbody>
                        </table>
                    </div>
                </div>` : ''}
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.getElementById('settle-date').value = new Date().toISOString().split('T')[0];
    }

    function saveSettlement(employeeId, employeeName) {
        const date   = document.getElementById('settle-date')?.value;
        const amount = parseFloat(document.getElementById('settle-amount')?.value) || 0;
        const note   = document.getElementById('settle-note')?.value?.trim() || '';
        if (!date || !amount) { alert('تاریخ و مبلغ الزامی است'); return; }

        const list = (() => { try { return JSON.parse(localStorage.getItem('work_settlements') || '[]'); } catch { return []; } })();
        list.push({ id: 'settle_' + Date.now(), employeeId, employeeName, date, amount, note, createdAt: new Date().toISOString() });
        localStorage.setItem('work_settlements', JSON.stringify(list));

        document.getElementById('settlement-modal')?.remove();
        showNotification(`تسویه ${Number(amount).toLocaleString('fa-IR')} تومان برای ${employeeName} ثبت شد ✓`, 'success');
        refreshContent();
    }

    // ── مودال ثبت هدیه ────────────────────────────────────────
    function showGiftModal(employeeId, employeeName) {
        document.getElementById('gift-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'gift-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-blue-900 rounded-2xl p-6 max-w-sm w-full mx-4 border border-green-500/30 shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-white text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-gift text-green-400"></i>ثبت هدیه
                    </h3>
                    <button onclick="document.getElementById('gift-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <p class="text-yellow-300 text-sm mb-4 font-semibold">${employeeName}</p>
                <div class="space-y-3">
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">تاریخ <span class="text-red-400">*</span></label>
                        <input type="date" id="gift-date" class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-green-400">
                    </div>
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">مبلغ هدیه (تومان) <span class="text-red-400">*</span></label>
                        <input type="number" id="gift-amount" min="0" step="1000" placeholder="مثال: 500000"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-green-400">
                    </div>
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">توضیحات</label>
                        <input type="text" id="gift-reason" placeholder="مثال: پاداش عملکرد..."
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-green-400">
                    </div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="EmployeeAccountingUI.saveGift('${employeeId}', '${employeeName}')"
                        class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-save ml-1"></i>ثبت هدیه
                    </button>
                    <button onclick="document.getElementById('gift-modal').remove()"
                        class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl transition-all">انصراف</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('gift-date').value = today;
    }

    function saveGift(employeeId, employeeName) {
        const date   = document.getElementById('gift-date')?.value;
        const amount = parseFloat(document.getElementById('gift-amount')?.value) || 0;
        const reason = document.getElementById('gift-reason')?.value?.trim() || 'هدیه';
        if (!date || !amount) { alert('تاریخ و مبلغ الزامی است'); return; }
        const gifts = (() => { try { return JSON.parse(localStorage.getItem('work_gifts') || '[]'); } catch { return []; } })();
        gifts.push({ id: 'gift_' + Date.now(), employeeId, employeeName, date, amount, reason, createdAt: new Date().toISOString() });
        localStorage.setItem('work_gifts', JSON.stringify(gifts));
        document.getElementById('gift-modal')?.remove();
        showNotification('هدیه با موفقیت ثبت شد ✓', 'success');
        refreshContent();
    }

    // ── مودال ثبت کسر (inline برای یک کارمند) ───────────────
    function showDeductionModal(employeeId, employeeName) {
        document.getElementById('deduction-inline-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'deduction-inline-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-blue-900 rounded-2xl p-6 max-w-sm w-full mx-4 border border-red-500/30 shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-white text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-minus-circle text-red-400"></i>ثبت کسر
                    </h3>
                    <button onclick="document.getElementById('deduction-inline-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <p class="text-yellow-300 text-sm mb-4 font-semibold">${employeeName}</p>
                <div class="space-y-3">
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">تاریخ <span class="text-red-400">*</span></label>
                        <input type="date" id="ded2-date" class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400">
                    </div>
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">مبلغ کسر (تومان) <span class="text-red-400">*</span></label>
                        <input type="number" id="ded2-amount" min="0" step="1000" placeholder="مثال: 200000"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400">
                    </div>
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">علت <span class="text-red-400">*</span></label>
                        <input type="text" id="ded2-reason" placeholder="مثال: غیبت، تأخیر..."
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400">
                    </div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="EmployeeAccountingUI.saveDeductionInline('${employeeId}', '${employeeName}')"
                        class="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-save ml-1"></i>ثبت کسر
                    </button>
                    <button onclick="document.getElementById('deduction-inline-modal').remove()"
                        class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl transition-all">انصراف</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('ded2-date').value = today;
    }

    function saveDeductionInline(employeeId, employeeName) {
        const date   = document.getElementById('ded2-date')?.value;
        const amount = parseFloat(document.getElementById('ded2-amount')?.value) || 0;
        const reason = document.getElementById('ded2-reason')?.value?.trim();
        if (!date || !amount || !reason) { alert('همه فیلدها الزامی است'); return; }
        const list = (() => { try { return JSON.parse(localStorage.getItem('work_deductions') || '[]'); } catch { return []; } })();
        list.push({ id: 'ded_' + Date.now(), employeeId, employeeName, date, amount, reason, createdAt: new Date().toISOString() });
        localStorage.setItem('work_deductions', JSON.stringify(list));
        document.getElementById('deduction-inline-modal')?.remove();
        showNotification('کسر با موفقیت ثبت شد', 'success');
        refreshContent();
    }

    // ── مودال ثبت کسر جدید (برای مدیر) ──────────────────────
    function showAddDeductionModal() {
        document.getElementById('add-deduction-modal')?.remove();

        const users = (() => {
            try { return JSON.parse(localStorage.getItem('edu_system_users') || '[]').filter(u => u.role === 'employee'); }
            catch { return []; }
        })();

        const userOptions = users.map(u =>
            `<option value="${u.id}" data-name="${u.name}">${u.name}</option>`
        ).join('');

        const modal = document.createElement('div');
        modal.id = 'add-deduction-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-blue-900 rounded-2xl p-6 max-w-sm w-full mx-4 border border-red-500/30 shadow-2xl"
                 onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-white text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-minus-circle text-red-400"></i>ثبت کسر جدید
                    </h3>
                    <button onclick="document.getElementById('add-deduction-modal').remove()"
                        class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <div class="space-y-3">
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">کارمند <span class="text-red-400">*</span></label>
                        <select id="ded-emp" class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400">
                            <option value="">انتخاب کارمند...</option>
                            ${userOptions}
                        </select>
                    </div>
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">تاریخ <span class="text-red-400">*</span></label>
                        <input type="date" id="ded-date"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400">
                    </div>
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">مبلغ (تومان) <span class="text-red-400">*</span></label>
                        <input type="number" id="ded-amount" min="0" step="1000" placeholder="مثال: 500000"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400">
                    </div>
                    <div>
                        <label class="text-blue-200 text-sm mb-1 block">علت <span class="text-red-400">*</span></label>
                        <input type="text" id="ded-reason" placeholder="مثال: غیبت، تأخیر..."
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400">
                    </div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="EmployeeAccountingUI.saveDeduction()"
                        class="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-save ml-1"></i>ثبت کسر
                    </button>
                    <button onclick="document.getElementById('add-deduction-modal').remove()"
                        class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl transition-all">
                        انصراف
                    </button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    function saveDeduction() {
        const empSel = document.getElementById('ded-emp');
        const date   = document.getElementById('ded-date')?.value;
        const amount = parseFloat(document.getElementById('ded-amount')?.value) || 0;
        const reason = document.getElementById('ded-reason')?.value?.trim();

        if (!empSel?.value || !date || !amount || !reason) {
            alert('همه فیلدها را پر کنید'); return;
        }

        const empName = empSel.options[empSel.selectedIndex]?.dataset?.name || empSel.value;
        const record = {
            id: 'ded_' + Date.now(),
            employeeId:   empSel.value,
            employeeName: empName,
            date, amount, reason,
            createdAt: new Date().toISOString()
        };

        const list = (() => { try { return JSON.parse(localStorage.getItem('work_deductions') || '[]'); } catch { return []; } })();
        list.push(record);
        localStorage.setItem('work_deductions', JSON.stringify(list));

        document.getElementById('add-deduction-modal')?.remove();

        // رفرش صفحه
        const container = document.querySelector('[x-show*="employeeAccounting"]');
        if (container && typeof EmployeeAccountingUI?.getManagerEmployeesContent === 'function') {
            container.innerHTML = EmployeeAccountingUI.getManagerEmployeesContent();
        } else {
            // fallback: reload محتوا از app
            if (window.Alpine) {
                const appEl = document.querySelector('[x-data="appController()"]');
                if (appEl && appEl._x_dataStack) {
                    appEl._x_dataStack[0].currentPage = 'dashboard';
                    setTimeout(() => { appEl._x_dataStack[0].currentPage = 'employeeAccounting'; }, 50);
                }
            }
        }
    }

    function deleteDeduction(id) {
        if (!confirm('این کسر حذف شود؟')) return;
        const list = (() => { try { return JSON.parse(localStorage.getItem('work_deductions') || '[]'); } catch { return []; } })();
        localStorage.setItem('work_deductions', JSON.stringify(list.filter(d => d.id !== id)));
        // رفرش
        saveDeduction._refresh && saveDeduction._refresh();
        window.location.reload();
    }

    function showSettingsModal() {
        const settings = EmployeeAccountingModule.getSettings();

        document.getElementById('settings-modal')?.remove();

        const modal = `
            <div id="settings-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick="if(event.target === this) this.remove()">
                <div class="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-bold text-white">
                            <i class="fas fa-cog text-blue-400 ml-2"></i>
                            تنظیمات حسابداری
                        </h3>
                        <button onclick="document.getElementById('settings-modal').remove()" class="text-gray-400 hover:text-white">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div>
                        <label class="block text-blue-200 text-sm mb-2">نرخ ساعتی پیش‌فرض (تومان)</label>
                        <input type="number" id="default-hourly-rate" value="${settings.defaultHourlyRate}"
                               class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400"
                               placeholder="مثال: 100000">
                        <p class="text-blue-300/60 text-xs mt-2">برای کارمندانی که نرخ اختصاصی ندارند</p>
                    </div>
                    <div class="flex justify-end gap-3 mt-6">
                        <button onclick="document.getElementById('settings-modal').remove()" class="px-4 py-2 text-gray-400 hover:text-white">انصراف</button>
                        <button onclick="EmployeeAccountingUI.saveSettings()" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all">
                            <i class="fas fa-save ml-2"></i>ذخیره
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modal);
    }

    function saveSettings() {
        const defaultRate = parseFloat(document.getElementById('default-hourly-rate').value) || 0;
        EmployeeAccountingModule.saveSettings({ defaultHourlyRate: defaultRate, currency: 'تومان' });
        document.getElementById('settings-modal')?.remove();
        showNotification('تنظیمات با موفقیت ذخیره شد', 'success');
        refreshContent();
    }

    function showEditRateModal(employeeId, employeeName, currentRate) {
        document.getElementById('edit-rate-modal')?.remove();

        const modal = `
            <div id="edit-rate-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick="if(event.target === this) this.remove()">
                <div class="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-bold text-white">
                            <i class="fas fa-edit text-blue-400 ml-2"></i>
                            تنظیم نرخ ساعتی
                        </h3>
                        <button onclick="document.getElementById('edit-rate-modal').remove()" class="text-gray-400 hover:text-white">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="mb-4">
                        <p class="text-blue-200 text-sm mb-1">کارمند:</p>
                        <p class="text-white font-bold text-lg">${employeeName}</p>
                    </div>
                    <div>
                        <label class="block text-blue-200 text-sm mb-2">نرخ ساعتی (تومان)</label>
                        <input type="number" id="employee-hourly-rate" value="${currentRate}"
                               class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400"
                               placeholder="مثال: 100000">
                    </div>
                    <div class="flex justify-end gap-3 mt-6">
                        <button onclick="document.getElementById('edit-rate-modal').remove()" class="px-4 py-2 text-gray-400 hover:text-white">انصراف</button>
                        <button onclick="EmployeeAccountingUI.saveEmployeeRate('${employeeId}')"
                                class="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all">
                            <i class="fas fa-save ml-2"></i>ذخیره
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modal);
    }

    function saveEmployeeRate(employeeId) {
        const rate = parseFloat(document.getElementById('employee-hourly-rate').value) || 0;
        EmployeeAccountingModule.setHourlyRate(employeeId, rate);
        document.getElementById('edit-rate-modal')?.remove();
        showNotification('نرخ ساعتی با موفقیت ذخیره شد', 'success');
        refreshContent();
    }

    function showEmployeeDetails(employeeId) {
        const summary = EmployeeAccountingModule.getEmployeeFinancialSummary(employeeId);
        const entries = WorkHoursModule.getAllEntriesByEmployee(employeeId);
        const deductions = (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]').filter(d=>d.employeeId===employeeId); } catch { return []; } })();
        const gifts      = (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]').filter(g=>g.employeeId===employeeId); } catch { return []; } })();
        const totalDed   = deductions.reduce((s,d) => s + Number(d.amount||0), 0);
        const totalGift  = gifts.reduce((s,g) => s + Number(g.amount||0), 0);
        const safeName   = (summary.employeeName||'').replace(/'/g,"\\'");

        document.getElementById('employee-details-modal')?.remove();

        // pending برای این کارمند
        const pendingH = (typeof WorkHoursModule !== 'undefined') ? WorkHoursModule.getPendingWorkHours().filter(e=>e.employeeId===employeeId) : [];
        const pendingE = (typeof WorkHoursModule !== 'undefined') ? WorkHoursModule.getPendingExpenses().filter(e=>e.employeeId===employeeId) : [];
        const pendingItems = [...pendingH.map(e=>({...e,_k:'hour'})), ...pendingE.map(e=>({...e,_k:'expense'}))];

        const pendingBlock = pendingItems.length ? `
        <div class="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-4 mb-4">
            <h4 class="text-yellow-300 font-semibold mb-3 flex items-center gap-2 text-sm">
                <i class="fas fa-hourglass-half"></i>در انتظار تأیید (${pendingItems.length})
            </h4>
            <div class="space-y-2">
                ${pendingItems.map(e=>`
                <div class="flex items-center justify-between bg-white/5 rounded-lg p-3 text-sm">
                    <div>
                        <span class="${e._k==='hour'?'text-blue-400':'text-orange-400'}">${e._k==='hour'?`${e.totalHours||0} ساعت`:`${(e.amount||0).toLocaleString('fa-IR')} ت`}</span>
                        <span class="text-blue-200 mr-2 text-xs">${typeof Jalali!=='undefined'?Jalali.displayDate(e.date):e.date}</span>
                        ${e.description ? `<span class="text-blue-300 text-xs"> — ${e.description}</span>` : ''}
                    </div>
                    <div class="flex gap-1">
                        <button onclick="WorkHoursUI.approveEntry('${e.id}'); document.getElementById('employee-details-modal').remove()"
                            class="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/40">✓</button>
                        <button onclick="WorkHoursUI.rejectEntry('${e.id}'); document.getElementById('employee-details-modal').remove()"
                            class="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/40">✗</button>
                    </div>
                </div>`).join('')}
            </div>
        </div>` : '';

        const dedBlock = deductions.length ? deductions.map(d=>`
        <tr class="border-b border-white/5">
            <td class="py-2 px-3 text-white text-xs">${d.date||'—'}</td>
            <td class="py-2 px-3 text-red-300 font-bold text-xs">${Number(d.amount||0).toLocaleString('fa-IR')} ت</td>
            <td class="py-2 px-3 text-blue-200 text-xs">${d.reason||'—'}</td>
            <td class="py-2 px-3 text-center">
                <button onclick="EmployeeAccountingUI.deleteDeduction('${d.id}')" class="text-red-400 hover:text-red-300 text-xs"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('') : `<tr><td colspan="4" class="text-center py-3 text-blue-300 text-xs">کسوراتی ثبت نشده</td></tr>`;

        const giftBlock = gifts.length ? gifts.map(g=>`
        <tr class="border-b border-white/5">
            <td class="py-2 px-3 text-white text-xs">${g.date||'—'}</td>
            <td class="py-2 px-3 text-green-300 font-bold text-xs">${Number(g.amount||0).toLocaleString('fa-IR')} ت</td>
            <td class="py-2 px-3 text-blue-200 text-xs">${g.reason||'—'}</td>
        </tr>`).join('') : `<tr><td colspan="3" class="text-center py-3 text-blue-300 text-xs">هدیه‌ای ثبت نشده</td></tr>`;

        const modal = document.createElement('div');
        modal.id = 'employee-details-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                        <i class="fas fa-user text-yellow-400"></i>جزئیات مالی: ${summary.employeeName}
                    </h3>
                    <div class="flex gap-2">
                        <button onclick="EmployeeAccountingUI.showGiftModal('${employeeId}','${safeName}'); document.getElementById('employee-details-modal').remove()"
                            class="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/40">
                            <i class="fas fa-gift ml-1"></i>هدیه
                        </button>
                        <button onclick="EmployeeAccountingUI.showDeductionModal('${employeeId}','${safeName}'); document.getElementById('employee-details-modal').remove()"
                            class="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/40">
                            <i class="fas fa-minus ml-1"></i>کسر
                        </button>
                        <button onclick="document.getElementById('employee-details-modal').remove()" class="text-gray-400 hover:text-white text-xl ml-2"><i class="fas fa-times"></i></button>
                    </div>
                </div>

                <!-- کارت‌های خلاصه -->
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                    <div class="bg-white/10 rounded-xl p-3 text-center">
                        <p class="text-blue-200 text-xs mb-1">ساعات تأیید</p>
                        <p class="text-xl font-bold text-blue-400">${summary.totalHoursApproved}</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-3 text-center">
                        <p class="text-blue-200 text-xs mb-1">هزینه‌های تأیید</p>
                        <p class="text-sm font-bold text-orange-400">${EmployeeAccountingModule.formatCurrency(summary.totalExpensesApproved)}</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-3 text-center">
                        <p class="text-blue-200 text-xs mb-1">نرخ ساعتی</p>
                        <p class="text-sm font-bold text-white">${EmployeeAccountingModule.formatCurrency(summary.hourlyRate)}</p>
                    </div>
                    <div class="bg-red-500/10 border border-red-400/20 rounded-xl p-3 text-center">
                        <p class="text-red-200 text-xs mb-1">جمع کسورات</p>
                        <p class="text-sm font-bold text-red-400">${EmployeeAccountingModule.formatCurrency(totalDed)}</p>
                    </div>
                    <div class="bg-green-500/10 border border-green-400/20 rounded-xl p-3 text-center">
                        <p class="text-green-200 text-xs mb-1">جمع هدایا</p>
                        <p class="text-sm font-bold text-green-400">${EmployeeAccountingModule.formatCurrency(totalGift)}</p>
                    </div>
                </div>

                ${pendingBlock}

                <!-- ساعات و هزینه‌ها -->
                <h4 class="text-white font-semibold mb-3 flex items-center gap-2 text-sm"><i class="fas fa-list text-blue-400"></i>سوابق کاری</h4>
                <div class="overflow-x-auto mb-5">
                    <table class="w-full text-sm">
                        <thead><tr class="border-b border-white/10 text-xs">
                            <th class="text-right text-blue-200 py-2 px-3">نوع</th>
                            <th class="text-right text-blue-200 py-2 px-3">تاریخ</th>
                            <th class="text-right text-blue-200 py-2 px-3">مقدار</th>
                            <th class="text-right text-blue-200 py-2 px-3">شرح</th>
                            <th class="text-center text-blue-200 py-2 px-3">وضعیت</th>
                        </tr></thead>
                        <tbody>${renderEntriesList(entries)}</tbody>
                    </table>
                </div>

                <!-- کسورات -->
                <h4 class="text-white font-semibold mb-2 flex items-center gap-2 text-sm"><i class="fas fa-minus-circle text-red-400"></i>کسورات</h4>
                <div class="overflow-x-auto mb-5">
                    <table class="w-full text-sm">
                        <thead><tr class="border-b border-white/10 text-xs">
                            <th class="text-right text-blue-200 py-1 px-3">تاریخ</th>
                            <th class="text-right text-blue-200 py-1 px-3">مبلغ</th>
                            <th class="text-right text-blue-200 py-1 px-3">علت</th>
                            <th class="py-1 px-3"></th>
                        </tr></thead>
                        <tbody>${dedBlock}</tbody>
                    </table>
                </div>

                <!-- هدایا -->
                <h4 class="text-white font-semibold mb-2 flex items-center gap-2 text-sm"><i class="fas fa-gift text-green-400"></i>هدایا</h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead><tr class="border-b border-white/10 text-xs">
                            <th class="text-right text-blue-200 py-1 px-3">تاریخ</th>
                            <th class="text-right text-blue-200 py-1 px-3">مبلغ</th>
                            <th class="text-right text-blue-200 py-1 px-3">توضیحات</th>
                        </tr></thead>
                        <tbody>${giftBlock}</tbody>
                    </table>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    return {
        init,
        getEmployeeContent,
        getManagerEmployeesContent,
        showSettingsModal,
        saveSettings,
        showEditRateModal,
        saveEmployeeRate,
        showEmployeeDetails,
        showNotification,
        refreshContent,
        renderEntriesList,
        showAddDeductionModal,
        saveDeduction,
        deleteDeduction,
        showGiftModal,
        saveGift,
        showDeductionModal,
        saveDeductionInline,
        showSettlementModal,
        saveSettlement,
    };
})();
