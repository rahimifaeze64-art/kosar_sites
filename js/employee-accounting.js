/**
 * سیستم حسابداری کارمندان
 * محاسبه حقوق و دستمزد بر اساس ساعات کاری و هزینه‌ها (localStorage)
 */

const EmployeeAccountingModule = (function() {
    'use strict';

    const STORAGE_KEY = 'employee_accounting_settings';
    const HOURLY_RATES_KEY = 'employee_hourly_rates';

    function getSettings() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : { defaultHourlyRate: 0, currency: 'تومان' };
        } catch (error) {
            console.error('خطا در دریافت تنظیمات:', error);
            return { defaultHourlyRate: 0, currency: 'تومان' };
        }
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('خطا در ذخیره تنظیمات:', error);
            return false;
        }
    }

    function getHourlyRates() {
        try {
            const data = localStorage.getItem(HOURLY_RATES_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('خطا در دریافت نرخ‌های ساعتی:', error);
            return {};
        }
    }

    function setHourlyRate(employeeId, rate) {
        try {
            const rates = getHourlyRates();
            rates[employeeId] = parseFloat(rate) || 0;
            localStorage.setItem(HOURLY_RATES_KEY, JSON.stringify(rates));
            return true;
        } catch (error) {
            console.error('خطا در ذخیره نرخ ساعتی:', error);
            return false;
        }
    }

    function getEmployeeHourlyRate(employeeId) {
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
            pending: 'bg-yellow-500/20 text-yellow-400',
            approved: 'bg-green-500/20 text-green-400',
            rejected: 'bg-red-500/20 text-red-400'
        };
        const statusTexts = { pending: 'در انتظار', approved: 'تأیید شده', rejected: 'رد شده' };

        if (!entries || entries.length === 0) {
            return '<tr><td colspan="5" class="text-center py-8 text-blue-200">رکوردی یافت نشد</td></tr>';
        }

        return entries.map(entry => {
            const isExpense = entry.type === 'expense';
            const valueCell = isExpense
                ? `<span class="text-orange-400 font-bold">${EmployeeAccountingModule.formatCurrency(entry.amount || 0)}</span>`
                : `<span class="text-blue-400 font-bold">${entry.totalHours || 0} ساعت</span>`;
            const typeCell = isExpense
                ? '<span class="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs"><i class="fas fa-receipt ml-1"></i>هزینه</span>'
                : '<span class="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs"><i class="fas fa-clock ml-1"></i>ساعت کاری</span>';

            return `
                <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="py-3 px-4">${typeCell}</td>
                    <td class="py-3 px-4 text-white">${entry.date}</td>
                    <td class="py-3 px-4">${valueCell}</td>
                    <td class="py-3 px-4 text-blue-200 max-w-xs truncate" title="${entry.description || '-'}">${entry.description || '-'}</td>
                    <td class="text-center py-3 px-4">
                        <span class="${statusColors[entry.status] || statusColors.pending} px-3 py-1 rounded-full text-sm">
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

        const employeeRows = employeesSummary.length > 0
            ? employeesSummary.map(emp => {
                const statusBadge = (emp.pendingHours > 0 || emp.pendingExpenses > 0)
                    ? `<span class="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm">${emp.pendingHours + emp.pendingExpenses} در انتظار</span>`
                    : '<span class="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm"><i class="fas fa-check ml-1"></i>تأیید شده</span>';

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
                            <span class="text-2xl font-bold text-emerald-400">${EmployeeAccountingModule.formatCurrency(emp.grandTotal)}</span>
                        </td>
                        <td class="text-center py-4 px-4">${statusBadge}</td>
                        <td class="text-center py-4 px-4">
                            <button onclick="EmployeeAccountingUI.showEmployeeDetails('${emp.employeeId}')"
                                    class="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 rounded-lg text-sm transition-all">
                                <i class="fas fa-eye ml-1"></i>جزئیات
                            </button>
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
                            <p class="text-yellow-200 mt-2">تنظیم نرخ ساعتی و مشاهده خلاصه مالی هر کارمند</p>
                        </div>
                        <button onclick="EmployeeAccountingUI.showSettingsModal()"
                                class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                            <i class="fas fa-cog ml-2"></i>تنظیمات
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-users text-2xl text-yellow-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">تعداد کارمندان</p>
                                <p class="text-3xl font-bold text-white">${employeesSummary.length}</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-clock text-2xl text-blue-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">کل ساعات تأیید شده</p>
                                <p class="text-3xl font-bold text-white">${totalHours.toFixed(1)}</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-orange-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-money-bill-wave text-2xl text-orange-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">کل هزینه‌های تأیید</p>
                                <p class="text-xl font-bold text-white">${EmployeeAccountingModule.formatCurrency(totalExpenses)}</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-wallet text-2xl text-emerald-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">جمع کل پرداختی</p>
                                <p class="text-xl font-bold text-emerald-400">${EmployeeAccountingModule.formatCurrency(totalAmount)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="fas fa-table text-blue-400"></i>
                        خلاصه مالی کارمندان
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
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">جمع کل</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">وضعیت</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">عملیات</th>
                                </tr>
                            </thead>
                            <tbody>${employeeRows}</tbody>
                        </table>
                    </div>
                </div>

                <div class="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                    <h4 class="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <i class="fas fa-info-circle text-blue-400"></i>
                        راهنما
                    </h4>
                    <ul class="text-blue-200 text-sm space-y-2">
                        <li><i class="fas fa-check text-green-400 ml-2"></i>برای هر کارمند نرخ ساعتی را با کلیک روی دکمه نرخ تنظیم کنید</li>
                        <li><i class="fas fa-check text-green-400 ml-2"></i>مبلغ ساعات = ساعات تأیید شده × نرخ ساعتی</li>
                        <li><i class="fas fa-check text-green-400 ml-2"></i>جمع کل = مبلغ ساعات + هزینه‌های تأیید شده</li>
                        <li><i class="fas fa-check text-green-400 ml-2"></i>تأیید/رد گزارش‌ها از بخش «ساعات کاری» انجام می‌شود</li>
                    </ul>
                </div>
            </div>`;
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

        document.getElementById('employee-details-modal')?.remove();

        const modal = `
            <div id="employee-details-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick="if(event.target === this) this.remove()">
                <div class="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto mx-4" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-bold text-white">
                            <i class="fas fa-user text-yellow-400 ml-2"></i>
                            جزئیات مالی: ${summary.employeeName}
                        </h3>
                        <button onclick="document.getElementById('employee-details-modal').remove()" class="text-gray-400 hover:text-white">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-blue-200 text-sm mb-1">ساعات تأیید شده</p>
                            <p class="text-2xl font-bold text-blue-400">${summary.totalHoursApproved}</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-blue-200 text-sm mb-1">هزینه‌های تأیید</p>
                            <p class="text-xl font-bold text-orange-400">${EmployeeAccountingModule.formatCurrency(summary.totalExpensesApproved)}</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-blue-200 text-sm mb-1">نرخ ساعتی</p>
                            <p class="text-xl font-bold text-white">${EmployeeAccountingModule.formatCurrency(summary.hourlyRate)}</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-blue-200 text-sm mb-1">جمع کل</p>
                            <p class="text-2xl font-bold text-emerald-400">${EmployeeAccountingModule.formatCurrency(summary.grandTotal)}</p>
                        </div>
                    </div>
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
                            <tbody>${renderEntriesList(entries)}</tbody>
                        </table>
                    </div>
                    <div class="flex justify-end mt-6">
                        <button onclick="document.getElementById('employee-details-modal').remove()"
                                class="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                            بستن
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modal);
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
        renderEntriesList
    };
})();
