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

    function getEmployeeFinancialSummary(employeeId, startDate = null, endDate = null, overrideName = null) {
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

        // نام: overrideName > اولین entry > WorkHoursModule summary
        const employeeName = overrideName
            || (allEntries.length > 0 && allEntries[0].employeeName
                ? allEntries[0].employeeName
                : null)
            || (() => {
                const known = WorkHoursModule.getEmployeeHoursSummary().find(e => e.employeeId === employeeId);
                return known ? known.employeeName : null;
            })()
            || 'نامشخص';

        return {
            employeeId,
            employeeName,
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
        // ── ۱. لیست همه کارمندان (HARDCODED + edu_system_users) ──
        const allUsers = (() => {
            const map = {};

            // کارمندان ثابت
            if (typeof HARDCODED_USERS !== 'undefined') {
                HARDCODED_USERS.filter(u => u.role === 'employee' && u.active !== false)
                    .forEach(u => { map[u.id] = u.name || u.username || u.id; });
            }

            // کارمندان اضافه‌شده از localStorage
            try {
                JSON.parse(localStorage.getItem('edu_system_users') || '[]')
                    .filter(u => u.role === 'employee' && u.active !== false)
                    .forEach(u => { map[u.id] = u.name || u.username || u.id; });
            } catch (_) {}

            return map; // { id → fullName }
        })();

        // ── ۲. دریافت summary از ساعات ارسال‌شده ──
        const submittedSummary = WorkHoursModule.getEmployeeHoursSummary();
        const submittedMap = {};
        submittedSummary.forEach(e => { submittedMap[e.employeeId] = e; });

        // ── ۳. merge: همه کارمندان حتی اگر چیزی ارسال نکرده باشند ──
        const allIds = new Set([
            ...Object.keys(allUsers),
            ...submittedSummary.map(e => e.employeeId)
        ]);

        return Array.from(allIds).map(empId => {
            // نام کامل: اول از allUsers، بعد از summary
            const fullName = allUsers[empId]
                || submittedMap[empId]?.employeeName
                || 'نامشخص';

            return getEmployeeFinancialSummary(empId, startDate, endDate, fullName);
        });
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
 * خروجی Excel/CSV با پشتیبانی RTL
 * استفاده: EmployeeAccountingExport.exportCSV() یا exportXLSX()
 */

// ── تابع کمکی عمومی برای خروجی RTL Excel (HTML format) ──────
function _downloadRtlExcel(headers, rows, filename) {
    // Excel وقتی فایل HTML با extension .xls باز می‌کند، direction را می‌خواند
    const escCell = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const headerRow = headers.map(h => `<th style="background:#1a56db;color:#fff;padding:6px 10px;border:1px solid #ddd;white-space:nowrap;">${escCell(h)}</th>`).join('');
    const dataRows  = rows.map(r =>
        '<tr>' + r.map(c => `<td style="padding:5px 10px;border:1px solid #ddd;white-space:nowrap;">${escCell(c)}</td>`).join('') + '</tr>'
    ).join('\n');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Tahoma, Arial, sans-serif; direction: rtl; }
  table { border-collapse: collapse; width: 100%; direction: rtl; }
  th { text-align: right; }
  td { text-align: right; }
</style>
</head>
<body>
<table>
  <thead><tr>${headerRow}</tr></thead>
  <tbody>${dataRows}</tbody>
</table>
</body>
</html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.replace(/\.csv$/i, '.xls');
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

const EmployeeAccountingExport = (function() {
    'use strict';

    function exportEmployeesSummaryCSV(startDate, endDate) {
        const summary     = EmployeeAccountingModule.getAllEmployeesSummary(startDate || null, endDate || null);
        const settlements = (() => { try { return JSON.parse(localStorage.getItem('work_settlements')||'[]'); } catch { return []; } })();
        const deductions  = (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]'); } catch { return []; } })();
        const gifts       = (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]'); } catch { return []; } })();

        const headers = ['نام کارمند','نرخ ساعتی (تومان)','جمع ساعات ارسالی','ساعات تأیید شده',
            'هزینه‌های تأیید (تومان)','مبلغ ساعات (تومان)','جمع مبلغ کل (تومان)',
            'جمع هدایا (تومان)','جمع کسورات (تومان)','تسویه شده (تومان)','مانده طلب (تومان)'];

        const rows = summary.map(emp => {
            const paid = settlements.filter(s=>s.employeeId===emp.employeeId).reduce((s,r)=>s+Number(r.amount||0),0);
            const ded  = deductions.filter(d=>d.employeeId===emp.employeeId).reduce((s,d)=>s+Number(d.amount||0),0);
            const gift = gifts.filter(g=>g.employeeId===emp.employeeId).reduce((s,g)=>s+Number(g.amount||0),0);
            return [emp.employeeName, emp.hourlyRate, emp.totalHours, emp.totalHoursApproved,
                Math.round(emp.totalExpensesApproved), Math.round(emp.totalAmount),
                Math.round(emp.grandTotal), Math.round(gift), Math.round(ded),
                Math.round(paid), Math.round(emp.grandTotal + gift - ded - paid)];
        });

        _downloadRtlExcel(headers, rows, 'employee-summary.xls');
    }

    function exportEmployeeEntriesCSV(employeeId, employeeName) {
        const entries   = WorkHoursModule.getAllEntriesByEmployee(employeeId);
        const statusMap = { pending: 'در انتظار', approved: 'تأیید شده', rejected: 'رد شده' };
        const headers   = ['نوع','تاریخ','ساعت شروع','ساعت پایان','ساعت کل','مبلغ (تومان)','شرح','وضعیت'];
        const rows = entries.map(e => [
            e.type === 'expense' ? 'هزینه' : 'ساعت کاری',
            e.date || '', e.startTime || '', e.endTime || '', e.totalHours || '',
            e.type === 'expense' ? Math.round(e.amount || 0) : '',
            e.description || '', statusMap[e.status] || e.status
        ]);
        const safeName = (employeeName || employeeId || 'employee').replace(/[^\w\u0600-\u06FF]/g, '_');
        _downloadRtlExcel(headers, rows, `entries-${safeName}.xls`);
    }

    return { exportEmployeesSummaryCSV, exportEmployeeEntriesCSV };
})();

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
            warning: 'bg-lime-500',
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

    function renderEntriesList(entries, isManagerView = false) {
        const statusColors = {
            pending:  'bg-blue-500/20 text-black-300 border border-blue-400/30',
            approved: 'bg-green-500/20 text-green-300 border border-green-400/30',
            rejected: 'bg-red-500/20 text-red-300 border border-red-400/30'
        };
        const statusTexts = { pending: 'در انتظار', approved: 'تأیید شده', rejected: 'رد شده' };

        if (!entries || entries.length === 0) {
            return '<tr><td colspan="6" class="text-center py-8 text-black-400">رکوردی یافت نشد</td></tr>';
        }

        return entries.map(entry => {
            const isExpense = entry.type === 'expense';
            const valueCell = isExpense
                ? `<span class="text-orange-400 font-bold">${EmployeeAccountingModule.formatCurrency(entry.amount || 0)}</span>`
                : `<span class="text-black-400 font-bold">${entry.totalHours || 0} ساعت</span>`;

            // ستون نوع + badge وضعیت رنگی
            const statusDot = entry.status === 'approved'
                ? '<span class="inline-block w-2 h-2 rounded-full bg-green-400 ml-1"></span>'
                : entry.status === 'rejected'
                    ? '<span class="inline-block w-2 h-2 rounded-full bg-red-400 ml-1"></span>'
                    : '<span class="inline-block w-2 h-2 rounded-full bg-blue-400 ml-1"></span>';

            const typeCell = isExpense
                ? `<div class="flex flex-col gap-1">
                    <span class="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs inline-flex items-center"><i class="fas fa-receipt ml-1"></i>هزینه</span>
                    <span class="${statusColors[entry.status]||statusColors.pending} px-2 py-0.5 rounded text-xs inline-flex items-center">${statusDot}${statusTexts[entry.status]||entry.status}</span>
                  </div>`
                : `<div class="flex flex-col gap-1">
                    <span class="bg-blue-500/20 text-black-400 px-2 py-1 rounded text-xs inline-flex items-center"><i class="fas fa-clock ml-1"></i>ساعت کاری</span>
                    <span class="${statusColors[entry.status]||statusColors.pending} px-2 py-0.5 rounded text-xs inline-flex items-center">${statusDot}${statusTexts[entry.status]||entry.status}</span>
                  </div>`;

            const timeRange = !isExpense && entry.startTime && entry.endTime
                ? `<span class="text-black-300/60 text-xs block">${entry.startTime} — ${entry.endTime}</span>` : '';

            // ستون وضعیت: مدیر → دو دکمه تیک/ضربدر | کارمند → فقط نمایش
            const actionCell = isManagerView
                ? `<td class="text-center py-3 px-3">
                    <div class="flex gap-1 justify-center">
                        <button onclick="WorkHoursUI.approveEntry('${entry.id}'); EmployeeAccountingUI.refreshContent()"
                            title="تأیید"
                            class="w-7 h-7 flex items-center justify-center rounded-lg ${entry.status==='approved' ? 'bg-green-500/40 text-green-300 cursor-default' : 'bg-green-500/20 hover:bg-green-500/50 text-green-400 cursor-pointer'} transition-all">
                            <i class="fas fa-check text-xs"></i>
                        </button>
                        <button onclick="WorkHoursUI.rejectEntry('${entry.id}'); EmployeeAccountingUI.refreshContent()"
                            title="رد"
                            class="w-7 h-7 flex items-center justify-center rounded-lg ${entry.status==='rejected' ? 'bg-red-500/40 text-red-300 cursor-default' : 'bg-red-500/20 hover:bg-red-500/50 text-red-400 cursor-pointer'} transition-all">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                  </td>`
                : `<td class="text-center py-3 px-3">
                    <span class="${statusColors[entry.status]||statusColors.pending} px-3 py-1 rounded-full text-xs">
                        ${statusTexts[entry.status]||entry.status}
                    </span>
                  </td>`;

            return `
                <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="py-3 px-3">${typeCell}</td>
                    <td class="py-3 px-4 text-white text-sm">${entry.date}${timeRange}</td>
                    <td class="py-3 px-4">${valueCell}</td>
                    <td class="py-3 px-4 text-black-400 text-sm whitespace-pre-wrap break-words max-w-xs">${entry.description || '—'}</td>
                    ${actionCell}
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
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                                <i class="fas fa-calculator text-emerald-400"></i>
                                حسابداری شخصی
                            </h2>
                            <p class="text-emerald-200 mt-2">جمع ساعات و هزینه‌های ارسالی شما</p>
                        </div>
                        <button onclick="EmployeeAccountingUI.showLateRequestModal()"
                            class="px-4 py-2 bg-lime-500/20 hover:bg-lime-500/40 text-lime-300 border border-lime-400/30 rounded-xl text-sm transition-all flex items-center gap-2">
                            <i class="fas fa-clock"></i>درخواست مهلت مجدد
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-clock text-2xl text-black-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">جمع ساعات ارسالی</p>
                                <p class="text-3xl font-bold text-white">${summary.totalHours}</p>
                                <p class="text-black-300 text-xs">${summary.hoursCount} گزارش · ${summary.workDays} روز</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-orange-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-money-bill-wave text-2xl text-orange-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">جمع هزینه‌های ارسالی</p>
                                <p class="text-xl font-bold text-white">${EmployeeAccountingModule.formatCurrency(summary.totalExpenses)}</p>
                                <p class="text-black-300 text-xs">${summary.expensesCount} مورد</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-lime-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-hand-holding-usd text-2xl text-lime-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">نرخ ساعتی (مدیر)</p>
                                <p class="text-xl font-bold text-white">${EmployeeAccountingModule.formatCurrency(summary.hourlyRate)}</p>
                                <p class="text-black-300 text-xs">هر ساعت کار</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-wallet text-2xl text-emerald-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">مبلغ کل (تأیید شده)</p>
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
                                <p class="text-black-400 text-sm">جمع کسورات</p>
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

                <div class="bg-gradient-to-r from-green-500/20 to-green-500/20 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i class="fas fa-calendar-alt text-green-400"></i>
                        خلاصه ماه جاری
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-lime-200 text-sm mb-1">ساعات این ماه</p>
                            <p class="text-2xl font-bold text-white">${monthlySummary.totalHours} ساعت</p>
                            <p class="text-lime-300 text-xs mt-1">${monthlySummary.hoursCount} گزارش روزانه</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-lime-200 text-sm mb-1">هزینه‌های این ماه</p>
                            <p class="text-2xl font-bold text-white">${EmployeeAccountingModule.formatCurrency(monthlySummary.totalExpenses)}</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-lime-200 text-sm mb-1">حقوق ساعات (تأیید × نرخ)</p>
                            <p class="text-2xl font-bold text-black-400">${EmployeeAccountingModule.formatCurrency(hoursPayment)}</p>
                            <p class="text-lime-300 text-xs mt-1">${monthlySummary.totalHoursApproved} ساعت تأیید × ${EmployeeAccountingModule.formatCurrency(monthlySummary.hourlyRate)}</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-lime-200 text-sm mb-1">جمع کل این ماه</p>
                            <p class="text-2xl font-bold text-emerald-400">${EmployeeAccountingModule.formatCurrency(monthlySummary.grandTotal)}</p>
                            <p class="text-lime-300 text-xs mt-1">حقوق ساعات + هزینه‌های تأیید شده</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="fas fa-list text-black-400"></i>
                        جزئیات سوابق
                    </h3>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/10">
                                    <th class="text-right text-black-400 font-medium py-3 px-4">نوع</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">تاریخ</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">ساعت/مبلغ</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">شرح</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">وضعیت</th>
                                </tr>
                            </thead>
                            <tbody>${renderEntriesList(allEntries)}</tbody>
                        </table>
                    </div>
                </div>

                <div class="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                    <h4 class="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <i class="fas fa-info-circle text-black-400"></i>
                        راهنما
                    </h4>
                    <ul class="text-black-400 text-sm space-y-2">
                        <li><i class="fas fa-check text-green-400 ml-2"></i>گزارش‌های روزانه ساعات کاری و هزینه‌ها در این صفحه جمع می‌شوند</li>
                        <li><i class="fas fa-check text-green-400 ml-2"></i>مبلغ حقوق = (ساعات تأیید شده شده × نرخ ساعتی) + هزینه‌های تأیید شده شده</li>
                        <li><i class="fas fa-check text-green-400 ml-2"></i>نرخ ساعتی توسط مدیر در بخش «حسابداری کارمندان» تعیین می‌شود</li>
                        <li><i class="fas fa-clock text-lime-400 ml-2"></i>در صورت فراموشی ثبت، از دکمه «درخواست مهلت مجدد» استفاده کنید</li>
                    </ul>
                </div>

                <!-- درخواست‌های مهلت مجدد کارمند -->
                ${(() => {
                    const myReqs = (() => { try {
                        const u = JSON.parse(localStorage.getItem('currentUser')||'{}');
                        return JSON.parse(localStorage.getItem('work_late_requests')||'[]').filter(r=>r.employeeId===u.id);
                    } catch { return []; } })();
                    if (!myReqs.length) return '';
                    const statusMap = { pending:'در انتظار', approved:'تأیید شد', rejected:'رد شد' };
                    const statusCls = { pending:'bg-lime-500/20 text-lime-300', approved:'bg-green-500/20 text-green-300', rejected:'bg-red-500/20 text-red-300' };
                    const rows = myReqs.slice().reverse().map(r=>`
                        <tr class="border-b border-white/5 hover:bg-white/5 text-sm">
                            <td class="py-2 px-3 text-black-300">${r.requestedDate||'—'}</td>
                            <td class="py-2 px-3">
                                ${r.entryType==='expense'
                                    ? '<span class="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-xs">هزینه</span>'
                                    : '<span class="bg-blue-500/20 text-black-400 px-2 py-0.5 rounded text-xs">ساعت کاری</span>'}
                            </td>
                            <td class="py-2 px-3 text-white">
                                ${r.entryType==='expense'
                                    ? `${Number(r.amount||0).toLocaleString('fa-IR')} ت`
                                    : `${r.startTime||'?'} — ${r.endTime||'?'}`}
                            </td>
                            <td class="py-2 px-3 text-black-400 text-xs max-w-xs">${r.reason||'—'}</td>
                            <td class="py-2 px-3 text-center">
                                <span class="${statusCls[r.status]||statusCls.pending} px-2 py-0.5 rounded-full text-xs">${statusMap[r.status]||r.status}</span>
                            </td>
                        </tr>`).join('');
                    return `
                    <div class="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-lime-400/20">
                        <h4 class="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <i class="fas fa-clock text-lime-400"></i>درخواست‌های مهلت مجدد من
                        </h4>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead><tr class="border-b border-white/10 text-xs">
                                    <th class="text-right text-black-400 py-2 px-3">تاریخ</th>
                                    <th class="text-right text-black-400 py-2 px-3">نوع</th>
                                    <th class="text-right text-black-400 py-2 px-3">مقدار</th>
                                    <th class="text-right text-black-400 py-2 px-3">دلیل</th>
                                    <th class="text-center text-black-400 py-2 px-3">وضعیت</th>
                                </tr></thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>`;
                })()}
            </div>`;
    }

    function getManagerEmployeesContent() {
        const employeesSummary = EmployeeAccountingModule.getAllEmployeesSummary();

        const totalAmount = employeesSummary.reduce((sum, emp) => sum + emp.grandTotal, 0);
        const totalHours = employeesSummary.reduce((sum, emp) => sum + parseFloat(emp.totalHoursApproved || emp.totalHours), 0);
        const totalExpenses = employeesSummary.reduce((sum, emp) => sum + emp.totalExpensesApproved, 0);

        const employeeRows = employeesSummary.length > 0
            ? employeesSummary.map(emp => {
                const hasPending = emp.pendingHours > 0 || emp.pendingExpenses > 0;
                const statusBadge = hasPending
                    ? `<span class="bg-blue-500/20 text-black-400 px-2 py-1 rounded-full text-xs">${emp.pendingHours + emp.pendingExpenses} در انتظار</span>`
                    : '<span class="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs"><i class="fas fa-check ml-1"></i>تأیید</span>';

                const safeName = (emp.employeeName || '').replace(/'/g, "\\'");

                return `
                    <tr class="border-b border-white/5 hover:bg-white/5">
                        <td class="py-4 px-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-lime-500/20 rounded-full flex items-center justify-center">
                                    <i class="fas fa-user text-lime-400"></i>
                                </div>
                                <span class="text-white font-medium">${emp.employeeName}</span>
                            </div>
                        </td>
                        <td class="text-center py-4 px-4">
                            <button onclick="EmployeeAccountingUI.showEditRateModal('${emp.employeeId}', '${safeName}', ${emp.hourlyRate})"
                                    class="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/40 text-black-400 rounded-lg text-sm transition-all">
                                ${EmployeeAccountingModule.formatCurrency(emp.hourlyRate)}/ساعت
                                <i class="fas fa-edit mr-1"></i>
                            </button>
                        </td>
                        <td class="text-center py-4 px-4">
                            <span class="text-xl font-bold text-black-400">${emp.totalHoursApproved}</span>
                            <span class="text-black-300 text-sm"> ساعت</span>
                            <p class="text-black-400/60 text-xs">${emp.hoursCount} گزارش</p>
                        </td>
                        <td class="text-center py-4 px-4">
                            <span class="text-orange-400 font-bold">${EmployeeAccountingModule.formatCurrency(emp.totalExpensesApproved)}</span>
                        </td>
                        <td class="text-center py-4 px-4">
                            <span class="text-emerald-400 font-bold text-lg">${EmployeeAccountingModule.formatCurrency(emp.grandTotal)}</span>
                            <p class="text-black-300/60 text-xs mt-0.5">(ساعات × نرخ) + هزینه‌ها</p>
                        </td>
                    <td class="text-center py-4 px-4">${statusBadge}</td>
                    <td class="text-center py-4 px-4">
                        <div class="flex gap-1 justify-center flex-wrap">
                            <button onclick="EmployeeAccountingUI.showEmployeeDetails('${emp.employeeId}')"
                                    class="px-2 py-1 bg-lime-500/20 hover:bg-lime-500/40 text-lime-400 rounded-lg text-xs transition-all">
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
                                    class="px-2 py-1 bg-lime-500/20 hover:bg-lime-500/40 text-lime-400 rounded-lg text-xs transition-all">
                                <i class="fas fa-hand-holding-usd ml-1"></i>تسویه
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('')
            : `<tr>
                <td colspan="7" class="text-center py-12">
                    <i class="fas fa-users text-5xl text-lime-400/30 mb-4 block"></i>
                    <p class="text-black-400">هیچ کارمندی در سیستم ثبت نشده است</p>
                    <p class="text-black-300/60 text-sm mt-2">کارمندان را از بخش «کاربران» اضافه کنید</p>
                </td>
            </tr>`;

        return `
            <div class="space-y-6">
                <div class="bg-gradient-to-r from-green-500/20 to-green-500/20 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                                <i class="fas fa-users-cog text-green-400"></i>
                                حسابداری کارمندان
                            </h2>
                            <p class="text-green-200 mt-2">تأیید ساعات، مدیریت هزینه‌ها و تسویه حساب کارمندان</p>
                        </div>
                    </div>
                </div>

                <!-- ۷ کارت متریک -->
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-blue-400/20">
                        <i class="fas fa-paper-plane text-black-400 mb-2 block"></i>
                        <p class="text-black-400 text-xs mb-1">ساعات ارسال‌شده</p>
                        <p class="text-lg font-bold text-black-400">${employeesSummary.reduce((s,e)=>s+parseFloat(e.totalHours||0),0).toFixed(1)}</p>
                        <p class="text-black-300/60 text-xs">ساعت</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-emerald-400/20">
                        <i class="fas fa-check-circle text-emerald-400 mb-2 block"></i>
                        <p class="text-black-400 text-xs mb-1">ساعات تأیید شدهشده</p>
                        <p class="text-lg font-bold text-emerald-400">${totalHours.toFixed(1)}</p>
                        <p class="text-black-300/60 text-xs">ساعت</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-orange-400/20">
                        <i class="fas fa-receipt text-orange-400 mb-2 block"></i>
                        <p class="text-black-400 text-xs mb-1">هزینه‌های ارسال‌شده</p>
                        <p class="text-sm font-bold text-orange-400">${EmployeeAccountingModule.formatCurrency(
                            employeesSummary.reduce((s,e)=>s+(e.totalExpenses||e.totalExpensesApproved||0),0)
                        )}</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-cyan-400/20">
                        <i class="fas fa-check-double text-cyan-400 mb-2 block"></i>
                        <p class="text-black-400 text-xs mb-1">هزینه‌های تأیید شدهشده</p>
                        <p class="text-sm font-bold text-cyan-400">${EmployeeAccountingModule.formatCurrency(totalExpenses)}</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-red-400/20">
                        <i class="fas fa-minus-circle text-red-400 mb-2 block"></i>
                        <p class="text-black-400 text-xs mb-1">جمع کسورات</p>
                        <p class="text-sm font-bold text-red-400">${EmployeeAccountingModule.formatCurrency(
                            (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]').reduce((s,d)=>s+Number(d.amount||0),0); } catch { return 0; } })()
                        )}</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-lime-400/20">
                        <i class="fas fa-wallet text-lime-400 mb-2 block"></i>
                        <p class="text-black-400 text-xs mb-1">مبالغ تسویه‌نشده</p>
                        <p class="text-sm font-bold text-lime-400">${EmployeeAccountingModule.formatCurrency(
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
                        <p class="text-black-400 text-xs mb-1">جمع هدایا</p>
                        <p class="text-sm font-bold text-green-400">${EmployeeAccountingModule.formatCurrency(
                            (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]').reduce((s,g)=>s+Number(g.amount||0),0); } catch { return 0; } })()
                        )}</p>
                    </div>
                </div>

                ${/* بخش pending در جزئیات هر کارمند نمایش داده می‌شه */ ''}

                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
                        <h3 class="text-xl font-bold text-white flex items-center gap-2">
                            <i class="fas fa-table text-black-400"></i>
                            خلاصه کاری کارمندان
                        </h3>
                        <div class="flex gap-2 flex-wrap">
                            <button onclick="EmployeeAccountingUI.showWorkCalendarModal()"
                                class="px-4 py-2 bg-lime-500/20 hover:bg-lime-500/40 text-lime-300 border border-lime-400/30 rounded-xl text-sm transition-all flex items-center gap-2">
                                <i class="fas fa-calendar-alt"></i>تقویم کاری
                            </button>
                            <button onclick="EmployeeAccountingUI.showExportEmployeesModal()"
                                class="px-4 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-300 border border-green-400/30 rounded-xl text-sm transition-all flex items-center gap-2">
                                <i class="fas fa-file-excel"></i>خروجی Excel
                            </button>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/10">
                                    <th class="text-right text-black-400 font-medium py-3 px-4">نام کارمند</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">نرخ ساعتی</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">جمع ساعات</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">هزینه‌ها</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">جمع مبلغ کل</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">وضعیت</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">عملیات</th>
                                </tr>
                            </thead>
                            <tbody>${employeeRows}</tbody>
                        </table>
                    </div>
                </div>

                <!-- ── درخواست‌های مهلت مجدد ── -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-lime-400/20">
                    <h3 class="text-xl font-bold text-white mb-5 flex items-center gap-2">
                        <i class="fas fa-clock text-lime-400"></i>
                        درخواست‌های مهلت مجدد
                        <span class="text-black-400 text-sm font-normal mr-2">— درخواست ثبت سوابق فراموش‌شده</span>
                    </h3>
                    ${(() => {
                        const reqs = (() => { try { return JSON.parse(localStorage.getItem('work_late_requests')||'[]'); } catch { return []; } })();
                        const pending = reqs.filter(r => r.status === 'pending');
                        const others  = reqs.filter(r => r.status !== 'pending');
                        if (!reqs.length) return `
                            <div class="text-center py-8 text-black-300">
                                <i class="fas fa-inbox text-3xl mb-3 block opacity-40"></i>
                                <p class="text-sm">هیچ درخواستی وجود ندارد</p>
                            </div>`;

                        const renderRow = (r) => {
                            const statusCls = r.status==='approved' ? 'bg-green-500/20 text-green-400' : r.status==='rejected' ? 'bg-red-500/20 text-red-400' : 'bg-lime-500/20 text-lime-400';
                            const statusTxt = r.status==='approved' ? 'تأیید شد' : r.status==='rejected' ? 'رد شد' : 'در انتظار';
                            return `<tr class="border-b border-white/5 hover:bg-white/5">
                                <td class="py-3 px-3 text-white text-sm font-medium">${r.employeeName||'—'}</td>
                                <td class="py-3 px-3 text-black-300 text-sm">${r.requestedDate||'—'}</td>
                                <td class="py-3 px-3">
                                    ${r.entryType==='expense'
                                        ? `<span class="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-xs">هزینه</span>`
                                        : `<span class="bg-blue-500/20 text-black-400 px-2 py-0.5 rounded text-xs">ساعت کاری</span>`}
                                </td>
                                <td class="py-3 px-3">
                                    ${r.entryType==='expense'
                                        ? `<span class="text-orange-400 font-bold text-sm">${Number(r.amount||0).toLocaleString('fa-IR')} ت</span>`
                                        : `<span class="text-black-400 font-bold text-sm">${r.startTime||'?'} — ${r.endTime||'?'}</span>`}
                                </td>
                                <td class="py-3 px-3 text-black-400 text-xs max-w-xs">${r.reason||'—'}</td>
                                <td class="py-3 px-3 text-center">
                                    <span class="${statusCls} px-2 py-0.5 rounded-full text-xs">${statusTxt}</span>
                                </td>
                                <td class="py-3 px-3 text-center">
                                    ${r.status==='pending' ? `
                                    <div class="flex gap-1 justify-center">
                                        <button onclick="EmployeeAccountingUI.approveLateRequest('${r.id}')"
                                            class="px-2 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded text-xs transition-all">
                                            <i class="fas fa-check ml-1"></i>تأیید
                                        </button>
                                        <button onclick="EmployeeAccountingUI.rejectLateRequest('${r.id}')"
                                            class="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded text-xs transition-all">
                                            <i class="fas fa-times ml-1"></i>رد
                                        </button>
                                    </div>` : '—'}
                                </td>
                            </tr>`;
                        };

                        return `<div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead><tr class="border-b border-white/10 text-xs">
                                    <th class="text-right text-black-400 py-2 px-3 font-medium">کارمند</th>
                                    <th class="text-right text-black-400 py-2 px-3 font-medium">تاریخ درخواست‌شده</th>
                                    <th class="text-right text-black-400 py-2 px-3 font-medium">نوع</th>
                                    <th class="text-right text-black-400 py-2 px-3 font-medium">مقدار</th>
                                    <th class="text-right text-black-400 py-2 px-3 font-medium">دلیل فراموشی</th>
                                    <th class="text-center text-black-400 py-2 px-3 font-medium">وضعیت</th>
                                    <th class="text-center text-black-400 py-2 px-3 font-medium">عملیات</th>
                                </tr></thead>
                                <tbody>${[...pending, ...others].map(renderRow).join('')}</tbody>
                            </table>
                        </div>`;
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
                <td class="py-1.5 px-3 text-lime-300 font-bold">${Number(s.amount||0).toLocaleString('fa-IR')} ت</td>
                <td class="py-1.5 px-3 text-black-400">${s.note||'—'}</td>
            </tr>`).join('') : `<tr><td colspan="3" class="text-center py-3 text-black-300 text-xs">تسویه‌ای ثبت نشده</td></tr>`;

        const modal = document.createElement('div');
        modal.id = 'settlement-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-blue-900 rounded-2xl p-6 max-w-md w-full border border-lime-500/30 shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-white text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-hand-holding-usd text-lime-400"></i>تسویه حساب
                    </h3>
                    <button onclick="document.getElementById('settlement-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <p class="text-lime-300 font-semibold mb-4">${employeeName}</p>

                <!-- مانده -->
                <div class="bg-lime-500/10 border border-lime-400/20 rounded-xl p-4 mb-5">
                    <div class="flex justify-between items-center">
                        <span class="text-black-400 text-sm">جمع طلب کارمند</span>
                        <span class="text-emerald-400 font-bold">${EmployeeAccountingModule.formatCurrency(grandTotal + gift)}</span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-black-400 text-sm">کسر کسورات</span>
                        <span class="text-red-400 font-bold">- ${EmployeeAccountingModule.formatCurrency(ded)}</span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-black-400 text-sm">تسویه‌های قبلی</span>
                        <span class="text-lime-400 font-bold">- ${EmployeeAccountingModule.formatCurrency(paid)}</span>
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
                        <label class="text-black-400 text-sm mb-1 block">تاریخ <span class="text-red-400">*</span></label>
                        <input type="date" id="settle-date" class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">مبلغ تسویه (تومان) <span class="text-red-400">*</span></label>
                        <div class="relative">
                            <input type="number" id="settle-amount" min="0" step="1000"
                                placeholder="${remaining > 0 ? 'مانده: ' + remaining.toLocaleString('fa-IR') : '0'}"
                                class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                            ${remaining > 0 ? `<button type="button" onclick="document.getElementById('settle-amount').value='${remaining}'"
                                class="absolute left-2 top-1/2 -translate-y-1/2 text-lime-400 hover:text-lime-300 text-xs px-2 py-0.5 bg-lime-500/20 rounded">
                                تسویه کامل
                            </button>` : ''}
                        </div>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">یادداشت</label>
                        <input type="text" id="settle-note" placeholder="مثال: پرداخت نقدی، کارت..."
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                    </div>
                </div>
                <div class="flex gap-3 mb-5">
                    <button onclick="EmployeeAccountingUI.saveSettlement('${employeeId}', '${employeeName}')"
                        class="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-save ml-1"></i>ثبت تسویه
                    </button>
                    <button onclick="document.getElementById('settlement-modal').remove()"
                        class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl transition-all">انصراف</button>
                </div>

                <!-- تاریخچه -->
                ${history.length > 0 ? `
                <div>
                    <h4 class="text-white text-sm font-semibold mb-2 flex items-center gap-1">
                        <i class="fas fa-history text-lime-400 text-xs"></i>تاریخچه تسویه‌ها
                    </h4>
                    <div class="overflow-auto max-h-40">
                        <table class="w-full">
                            <thead><tr class="text-black-300 text-xs border-b border-white/10">
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
                <p class="text-lime-300 text-sm mb-4 font-semibold">${employeeName}</p>
                <div class="space-y-3">
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">تاریخ <span class="text-red-400">*</span></label>
                        <input type="date" id="gift-date" class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-green-400">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">مبلغ هدیه (تومان) <span class="text-red-400">*</span></label>
                        <input type="number" id="gift-amount" min="0" step="1000" placeholder="مثال: 500000"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-green-400">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">توضیحات</label>
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
                <p class="text-lime-300 text-sm mb-4 font-semibold">${employeeName}</p>
                <div class="space-y-3">
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">تاریخ <span class="text-red-400">*</span></label>
                        <input type="date" id="ded2-date" class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">مبلغ کسر (تومان) <span class="text-red-400">*</span></label>
                        <input type="number" id="ded2-amount" min="0" step="1000" placeholder="مثال: 200000"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">علت <span class="text-red-400">*</span></label>
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
                        <label class="text-black-400 text-sm mb-1 block">کارمند <span class="text-red-400">*</span></label>
                        <select id="ded-emp" class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                            <option value="">انتخاب کارمند...</option>
                            ${userOptions}
                        </select>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">تاریخ <span class="text-red-400">*</span></label>
                        <input type="date" id="ded-date"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">مبلغ (تومان) <span class="text-red-400">*</span></label>
                        <input type="number" id="ded-amount" min="0" step="1000" placeholder="مثال: 500000"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">علت <span class="text-red-400">*</span></label>
                        <input type="text" id="ded-reason" placeholder="مثال: غیبت، تأخیر..."
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
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
                            <i class="fas fa-cog text-black-400 ml-2"></i>
                            تنظیمات حسابداری
                        </h3>
                        <button onclick="document.getElementById('settings-modal').remove()" class="text-gray-400 hover:text-white">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div>
                        <label class="block text-black-400 text-sm mb-2">نرخ ساعتی پیش‌فرض (تومان)</label>
                        <input type="number" id="default-hourly-rate" value="${settings.defaultHourlyRate}"
                               class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400"
                               placeholder="مثال: 100000">
                        <p class="text-black-300/60 text-xs mt-2">برای کارمندانی که نرخ اختصاصی ندارند</p>
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
                            <i class="fas fa-edit text-black-400 ml-2"></i>
                            تنظیم نرخ ساعتی
                        </h3>
                        <button onclick="document.getElementById('edit-rate-modal').remove()" class="text-gray-400 hover:text-white">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="mb-4">
                        <p class="text-black-400 text-sm mb-1">کارمند:</p>
                        <p class="text-white font-bold text-lg">${employeeName}</p>
                    </div>
                    <div>
                        <label class="block text-black-400 text-sm mb-2">نرخ ساعتی (تومان)</label>
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
        const summary    = EmployeeAccountingModule.getEmployeeFinancialSummary(employeeId);
        const entries    = WorkHoursModule.getAllEntriesByEmployee(employeeId);
        const deductions = (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]').filter(d=>d.employeeId===employeeId); } catch { return []; } })();
        const gifts      = (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]').filter(g=>g.employeeId===employeeId); } catch { return []; } })();
        const totalDed   = deductions.reduce((s,d) => s + Number(d.amount||0), 0);
        const totalGift  = gifts.reduce((s,g) => s + Number(g.amount||0), 0);
        const safeName   = (summary.employeeName||'').replace(/'/g,"\\'");

        document.getElementById('employee-details-modal')?.remove();

        const dedBlock = deductions.length ? deductions.map(d=>`
        <tr class="border-b border-white/5">
            <td class="py-2 px-3 text-white text-xs">${d.date||'—'}</td>
            <td class="py-2 px-3 text-red-300 font-bold text-xs">${Number(d.amount||0).toLocaleString('fa-IR')} ت</td>
            <td class="py-2 px-3 text-black-400 text-xs">${d.reason||'—'}</td>
            <td class="py-2 px-3 text-center">
                <button onclick="EmployeeAccountingUI.deleteDeduction('${d.id}')" class="text-red-400 hover:text-red-300 text-xs"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('') : `<tr><td colspan="4" class="text-center py-3 text-black-300 text-xs">کسوراتی ثبت نشده</td></tr>`;

        const giftBlock = gifts.length ? gifts.map(g=>`
        <tr class="border-b border-white/5">
            <td class="py-2 px-3 text-white text-xs">${g.date||'—'}</td>
            <td class="py-2 px-3 text-green-300 font-bold text-xs">${Number(g.amount||0).toLocaleString('fa-IR')} ت</td>
            <td class="py-2 px-3 text-black-400 text-xs">${g.reason||'—'}</td>
        </tr>`).join('') : `<tr><td colspan="3" class="text-center py-3 text-black-300 text-xs">هدیه‌ای ثبت نشده</td></tr>`;

        const modal = document.createElement('div');
        modal.id = 'employee-details-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                        <i class="fas fa-user text-lime-400"></i>جزئیات مالی: ${summary.employeeName}
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
                        <p class="text-black-400 text-xs mb-1">ساعات تأیید شده</p>
                        <p class="text-xl font-bold text-black-400">${summary.totalHoursApproved}</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-3 text-center">
                        <p class="text-black-400 text-xs mb-1">هزینه‌های تأیید شده</p>
                        <p class="text-sm font-bold text-orange-400">${EmployeeAccountingModule.formatCurrency(summary.totalExpensesApproved)}</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-3 text-center">
                        <p class="text-black-400 text-xs mb-1">نرخ ساعتی</p>
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

                <!-- سوابق کاری — با دکمه‌های تأیید/رد inline -->
                <h4 class="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
                    <i class="fas fa-list text-black-400"></i>سوابق کاری
                    <span class="text-black-400 text-xs font-normal">(تیک = تأیید | ضربدر = رد)</span>
                </h4>
                <div class="overflow-x-auto mb-5">
                    <table class="w-full text-sm">
                        <thead><tr class="border-b border-white/10 text-xs">
                            <th class="text-right text-black-400 py-2 px-3">نوع / وضعیت</th>
                            <th class="text-right text-black-400 py-2 px-3">تاریخ</th>
                            <th class="text-right text-black-400 py-2 px-3">مقدار</th>
                            <th class="text-right text-black-400 py-2 px-3">شرح</th>
                            <th class="text-center text-black-400 py-2 px-3">عملیات</th>
                        </tr></thead>
                        <tbody>${renderEntriesList(entries, true)}</tbody>
                    </table>
                </div>

                <!-- کسورات -->
                <h4 class="text-white font-semibold mb-2 flex items-center gap-2 text-sm"><i class="fas fa-minus-circle text-red-400"></i>کسورات</h4>
                <div class="overflow-x-auto mb-5">
                    <table class="w-full text-sm">
                        <thead><tr class="border-b border-white/10 text-xs">
                            <th class="text-right text-black-400 py-1 px-3">تاریخ</th>
                            <th class="text-right text-black-400 py-1 px-3">مبلغ</th>
                            <th class="text-right text-black-400 py-1 px-3">علت</th>
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
                            <th class="text-right text-black-400 py-1 px-3">تاریخ</th>
                            <th class="text-right text-black-400 py-1 px-3">مبلغ</th>
                            <th class="text-right text-black-400 py-1 px-3">توضیحات</th>
                        </tr></thead>
                        <tbody>${giftBlock}</tbody>
                    </table>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    // ── modal خروجی Excel کارمندان ──────────────────────────
    function showExportEmployeesModal() {
        document.getElementById('emp-export-modal')?.remove();

        const allSummary = EmployeeAccountingModule.getAllEmployeesSummary();
        const empOpts = allSummary
            .map(e => `<option value="${e.employeeId}">${e.employeeName}</option>`)
            .join('');

        const today = new Date().toISOString().split('T')[0];
        const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString().split('T')[0];

        const modal = document.createElement('div');
        modal.id = 'emp-export-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-green-500/30 shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-white text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-file-excel text-green-400"></i>خروجی Excel کارمندان
                    </h3>
                    <button onclick="document.getElementById('emp-export-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <div class="space-y-3 text-sm">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-gray-400 text-xs mb-1 block">از تاریخ</label>
                            <input type="date" id="emp-exp-from" value="${firstOfMonth}"
                                class="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400">
                        </div>
                        <div>
                            <label class="text-gray-400 text-xs mb-1 block">تا تاریخ</label>
                            <input type="date" id="emp-exp-to" value="${today}"
                                class="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400">
                        </div>
                    </div>
                    <div>
                        <label class="text-gray-400 text-xs mb-1 block">کارمندان (چند انتخابی)</label>
                        <select id="emp-exp-names" multiple size="6"
                            class="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none">
                            ${empOpts}
                        </select>
                        <p class="text-gray-500 text-xs mt-1">Ctrl+کلیک برای چند انتخاب — خالی = همه</p>
                    </div>
                    <div>
                        <label class="text-gray-400 text-xs mb-1 block">وضعیت</label>
                        <select id="emp-exp-status"
                            class="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none">
                            <option value="">همه</option>
                            <option value="has_pending">دارای موارد در انتظار</option>
                            <option value="no_pending">بدون موارد در انتظار</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-gray-400 text-xs mb-1 block">شامل جزئیات سوابق</label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="emp-exp-details" class="accent-green-500 w-4 h-4">
                            <span class="text-gray-300 text-sm">اضافه کردن ردیف جزئیات هر سابقه</span>
                        </label>
                    </div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="EmployeeAccountingUI.doExportEmployeesCSV()"
                        class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-download ml-1"></i>دانلود CSV
                    </button>
                    <button onclick="document.getElementById('emp-export-modal').remove()"
                        class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl">انصراف</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    function doExportEmployeesCSV() {
        const from      = document.getElementById('emp-exp-from')?.value   || '';
        const to        = document.getElementById('emp-exp-to')?.value     || '';
        const statusFlt = document.getElementById('emp-exp-status')?.value || '';
        const inclDet   = document.getElementById('emp-exp-details')?.checked || false;
        const selIds    = Array.from(document.getElementById('emp-exp-names')?.selectedOptions || []).map(o=>o.value);

        const settlements = (() => { try { return JSON.parse(localStorage.getItem('work_settlements')||'[]'); } catch { return []; } })();
        const deductions  = (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]'); } catch { return []; } })();
        const gifts       = (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]'); } catch { return []; } })();

        let summary = EmployeeAccountingModule.getAllEmployeesSummary(from||null, to||null);
        if (selIds.length) summary = summary.filter(e=>selIds.includes(e.employeeId));
        if (statusFlt==='has_pending') summary = summary.filter(e=>(e.pendingHours+e.pendingExpenses)>0);
        if (statusFlt==='no_pending')  summary = summary.filter(e=>(e.pendingHours+e.pendingExpenses)===0);

        const summaryHeaders = ['نام کارمند','نرخ ساعتی','جمع ساعات ارسالی','ساعات تأیید شده',
            'هزینه‌های تأیید (تومان)','مبلغ ساعات (تومان)','جمع مبلغ کل (تومان)',
            'جمع هدایا (تومان)','جمع کسورات (تومان)','تسویه شده (تومان)','مانده طلب (تومان)',
            'در انتظار (ساعت)','در انتظار (هزینه)'];

        const allRows = [summaryHeaders];

        summary.forEach(emp => {
            const paid = settlements.filter(s=>s.employeeId===emp.employeeId).reduce((s,r)=>s+Number(r.amount||0),0);
            const ded  = deductions.filter(d=>d.employeeId===emp.employeeId).reduce((s,d)=>s+Number(d.amount||0),0);
            const gift = gifts.filter(g=>g.employeeId===emp.employeeId).reduce((s,g)=>s+Number(g.amount||0),0);

            allRows.push([emp.employeeName, emp.hourlyRate, emp.totalHours, emp.totalHoursApproved,
                Math.round(emp.totalExpensesApproved), Math.round(emp.totalAmount), Math.round(emp.grandTotal),
                Math.round(gift), Math.round(ded), Math.round(paid),
                Math.round(emp.grandTotal + gift - ded - paid), emp.pendingHours, emp.pendingExpenses]);

            if (inclDet) {
                const statusMap = { pending:'در انتظار', approved:'تأیید شده', rejected:'رد شده' };
                let ents = WorkHoursModule.getAllEntriesByEmployee(emp.employeeId);
                if (from) ents = ents.filter(e=>e.date>=from);
                if (to)   ents = ents.filter(e=>e.date<=to);
                if (ents.length) {
                    allRows.push(['--- جزئیات سوابق ---','نوع','تاریخ','ساعت شروع','ساعت پایان','ساعت کل','مبلغ (تومان)','شرح','وضعیت']);
                    ents.forEach(e => allRows.push([emp.employeeName, e.type==='expense'?'هزینه':'ساعت کاری',
                        e.date||'', e.startTime||'', e.endTime||'', e.totalHours||'',
                        e.type==='expense'?Math.round(e.amount||0):'', e.description||'', statusMap[e.status]||e.status||'']));
                }
                const empDeds = deductions.filter(d=>d.employeeId===emp.employeeId);
                if (empDeds.length) {
                    allRows.push(['--- کسورات ---','تاریخ','مبلغ (تومان)','علت']);
                    empDeds.forEach(d => allRows.push([emp.employeeName, d.date||'', Math.round(d.amount||0), d.reason||'']));
                }
                const empGifts = gifts.filter(g=>g.employeeId===emp.employeeId);
                if (empGifts.length) {
                    allRows.push(['--- هدایا ---','تاریخ','مبلغ (تومان)','توضیح']);
                    empGifts.forEach(g => allRows.push([emp.employeeName, g.date||'', Math.round(g.amount||0), g.reason||'']));
                }
            }
        });

        _downloadRtlExcel(allRows[0], allRows.slice(1), `employees_${new Date().toISOString().substring(0,10)}.xls`);
        document.getElementById('emp-export-modal')?.remove();
        showNotification('فایل Excel دانلود شد ✓', 'success');
    }

    // ── تقویم کاری (فیلتر بازه تاریخ) ──────────────────────
    function showWorkCalendarModal() {
        document.getElementById('work-calendar-modal')?.remove();
        const today = new Date().toISOString().split('T')[0];
        const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        const modal = document.createElement('div');
        modal.id = 'work-calendar-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full border border-lime-500/30 shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                        <i class="fas fa-calendar-alt text-lime-400"></i>تقویم کاری
                    </h3>
                    <button onclick="document.getElementById('work-calendar-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <p class="text-black-300 text-sm mb-4">بازه تاریخ را انتخاب کنید تا سوابق کاری، هزینه‌ها و کسورات نمایش داده شوند.</p>
                <div class="grid grid-cols-2 gap-4 mb-5">
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">از تاریخ</label>
                        <input type="date" id="cal-from" value="${firstOfMonth}"
                            class="w-full bg-slate-700 text-white border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:border-lime-400">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">تا تاریخ</label>
                        <input type="date" id="cal-to" value="${today}"
                            class="w-full bg-slate-700 text-white border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:border-lime-400">
                    </div>
                </div>
                <div class="flex gap-3 mb-5">
                    <button onclick="EmployeeAccountingUI.applyCalendarFilter()"
                        class="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-search ml-1"></i>نمایش گزارش
                    </button>
                    <button onclick="document.getElementById('work-calendar-modal').remove()"
                        class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl">انصراف</button>
                </div>
                <div id="cal-result" class="space-y-3"></div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    function applyCalendarFilter() {
        const from = document.getElementById('cal-from')?.value;
        const to   = document.getElementById('cal-to')?.value;
        if (!from || !to) { alert('لطفاً هر دو تاریخ را انتخاب کنید'); return; }

        const employeesSummary = EmployeeAccountingModule.getAllEmployeesSummary(from, to);
        const deductions = (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]').filter(d=>d.date>=from&&d.date<=to); } catch { return []; } })();
        const totalDed = deductions.reduce((s,d)=>s+Number(d.amount||0),0);

        const rows = employeesSummary.filter(e => parseFloat(e.totalHours)>0 || e.totalExpenses>0).map(emp => `
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                <div class="flex items-center justify-between flex-wrap gap-2">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 bg-lime-500/20 rounded-full flex items-center justify-center">
                            <i class="fas fa-user text-lime-400 text-xs"></i>
                        </div>
                        <span class="text-white font-semibold">${emp.employeeName}</span>
                    </div>
                    <div class="flex gap-4 flex-wrap text-sm">
                        <span class="text-black-400"><i class="fas fa-clock ml-1"></i>${emp.totalHours} ساعت ارسالی</span>
                        <span class="text-emerald-400"><i class="fas fa-check ml-1"></i>${emp.totalHoursApproved} ساعت تأیید</span>
                        <span class="text-orange-400"><i class="fas fa-receipt ml-1"></i>${EmployeeAccountingModule.formatCurrency(emp.totalExpenses)} هزینه</span>
                        <span class="text-lime-400 font-bold"><i class="fas fa-wallet ml-1"></i>${EmployeeAccountingModule.formatCurrency(emp.grandTotal)} جمع کل</span>
                    </div>
                </div>
            </div>`).join('');

        const dedRows = deductions.length ? deductions.map(d=>`
            <div class="flex items-center justify-between bg-white/5 rounded-lg p-3 text-sm">
                <span class="text-white">${d.employeeName||'—'}</span>
                <span class="text-black-400 text-xs">${d.date}</span>
                <span class="text-red-400 font-bold">${Number(d.amount||0).toLocaleString('fa-IR')} ت</span>
                <span class="text-black-400 text-xs">${d.reason||'—'}</span>
            </div>`).join('') : '<p class="text-black-300 text-xs text-center py-2">کسوراتی در این بازه ثبت نشده</p>';

        const resultEl = document.getElementById('cal-result');
        if (resultEl) {
            resultEl.innerHTML = `
                <div class="border-t border-white/10 pt-4">
                    <h4 class="text-white font-semibold mb-3 text-sm flex items-center gap-2">
                        <i class="fas fa-chart-bar text-lime-400"></i>
                        گزارش بازه ${from} تا ${to}
                    </h4>
                    ${rows || '<p class="text-black-300 text-sm text-center py-4">رکوردی در این بازه یافت نشد</p>'}
                    <div class="mt-4 bg-red-500/10 border border-red-400/20 rounded-xl p-3">
                        <h5 class="text-red-300 text-sm font-semibold mb-2 flex items-center gap-1">
                            <i class="fas fa-minus-circle text-xs"></i>کسورات این بازه
                            <span class="text-red-400 font-bold mr-2">${EmployeeAccountingModule.formatCurrency(totalDed)}</span>
                        </h5>
                        ${dedRows}
                    </div>
                </div>`;
        }
    }

    // ── درخواست مهلت مجدد (برای کارمند) ─────────────────────
    function showLateRequestModal() {
        document.getElementById('late-request-modal')?.remove();
        const today = new Date().toISOString().split('T')[0];

        const modal = document.createElement('div');
        modal.id = 'late-request-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-blue-900 rounded-2xl p-6 max-w-lg w-full border border-lime-500/30 shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-white text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-clock text-lime-400"></i>درخواست مهلت مجدد
                    </h3>
                    <button onclick="document.getElementById('late-request-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <p class="text-black-300 text-sm mb-4">اگر ثبت ساعت کاری یا هزینه‌ای را فراموش کرده‌اید، اینجا درخواست دهید.</p>
                <div class="space-y-3">
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">تاریخ فراموش‌شده <span class="text-red-400">*</span></label>
                        <input type="date" id="lr-date" value="${today}"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">نوع ثبت <span class="text-red-400">*</span></label>
                        <select id="lr-type" onchange="EmployeeAccountingUI._toggleLateRequestFields()"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                            <option value="work">ساعت کاری</option>
                            <option value="expense">هزینه</option>
                        </select>
                    </div>
                    <div id="lr-work-fields" class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-black-400 text-sm mb-1 block">ساعت شروع</label>
                            <input type="text" id="lr-start" placeholder="08:00" maxlength="5"
                                oninput="this.value=this.value.replace(/[^0-9:]/g,''); if(this.value.length===2&&!this.value.includes(':'))this.value+=':';"
                                class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400 font-mono" dir="ltr">
                        </div>
                        <div>
                            <label class="text-black-400 text-sm mb-1 block">ساعت پایان</label>
                            <input type="text" id="lr-end" placeholder="17:00" maxlength="5"
                                oninput="this.value=this.value.replace(/[^0-9:]/g,''); if(this.value.length===2&&!this.value.includes(':'))this.value+=':';"
                                class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400 font-mono" dir="ltr">
                        </div>
                    </div>
                    <div id="lr-expense-fields" class="hidden">
                        <label class="text-black-400 text-sm mb-1 block">مبلغ هزینه (تومان)</label>
                        <input type="number" id="lr-amount" min="0" step="1000" placeholder="مثال: 200000"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">دلیل فراموشی <span class="text-red-400">*</span></label>
                        <textarea id="lr-reason" rows="2" placeholder="مثال: مشغله کاری زیاد بود، اینترنت قطع بود..."
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400 resize-none"></textarea>
                    </div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="EmployeeAccountingUI.saveLateRequest()"
                        class="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-paper-plane ml-1"></i>ارسال درخواست
                    </button>
                    <button onclick="document.getElementById('late-request-modal').remove()"
                        class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl">انصراف</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    function _toggleLateRequestFields() {
        const type = document.getElementById('lr-type')?.value;
        const workF = document.getElementById('lr-work-fields');
        const expF  = document.getElementById('lr-expense-fields');
        if (type === 'expense') {
            workF?.classList.add('hidden');
            expF?.classList.remove('hidden');
        } else {
            workF?.classList.remove('hidden');
            expF?.classList.add('hidden');
        }
    }

    function saveLateRequest() {
        const u      = (() => { try { return JSON.parse(localStorage.getItem('currentUser')||'{}'); } catch { return {}; } })();
        const date   = document.getElementById('lr-date')?.value;
        const type   = document.getElementById('lr-type')?.value;
        const reason = document.getElementById('lr-reason')?.value?.trim();
        if (!date || !reason) { alert('تاریخ و دلیل فراموشی الزامی است'); return; }

        const record = {
            id:            'lr_' + Date.now(),
            employeeId:    u.id   || '',
            employeeName:  u.name || '',
            requestedDate: date,
            entryType:     type,
            startTime:     type==='work'    ? (document.getElementById('lr-start')?.value||'') : '',
            endTime:       type==='work'    ? (document.getElementById('lr-end')?.value||'')   : '',
            amount:        type==='expense' ? (parseFloat(document.getElementById('lr-amount')?.value)||0) : 0,
            reason,
            status:    'pending',
            createdAt: new Date().toISOString()
        };

        if (type==='work' && (!record.startTime || !record.endTime)) { alert('ساعت شروع و پایان الزامی است'); return; }
        if (type==='expense' && !record.amount) { alert('مبلغ هزینه الزامی است'); return; }

        const list = (() => { try { return JSON.parse(localStorage.getItem('work_late_requests')||'[]'); } catch { return []; } })();
        list.push(record);
        localStorage.setItem('work_late_requests', JSON.stringify(list));
        document.getElementById('late-request-modal')?.remove();
        showNotification('درخواست مهلت مجدد با موفقیت ارسال شد ✓', 'success');
    }

    function approveLateRequest(id) {
        const list = (() => { try { return JSON.parse(localStorage.getItem('work_late_requests')||'[]'); } catch { return []; } })();
        const req  = list.find(r => r.id === id);
        if (!req) return;
        req.status = 'approved';
        localStorage.setItem('work_late_requests', JSON.stringify(list));

        // ثبت خودکار بر اساس نوع درخواست
        if (req.entryType === 'work' && req.startTime && req.endTime) {
            const newEntry = WorkHoursModule.addWorkHour({
                employeeId:   req.employeeId,
                employeeName: req.employeeName,
                date:         req.requestedDate,
                startTime:    req.startTime,
                endTime:      req.endTime,
                description:  'ثبت از درخواست مهلت مجدد'
            });
            if (newEntry) WorkHoursModule.approveWorkHour(newEntry.id);
        } else if (req.entryType === 'expense' && req.amount) {
            const newEntry = WorkHoursModule.addExpense({
                employeeId:   req.employeeId,
                employeeName: req.employeeName,
                date:         req.requestedDate,
                amount:       req.amount,
                description:  'ثبت از درخواست مهلت مجدد'
            });
            if (newEntry) WorkHoursModule.approveExpense(newEntry.id);
        }

        showNotification('درخواست تأیید شد و سابقه ثبت گردید ✓', 'success');
        refreshContent();
    }

    function rejectLateRequest(id) {
        const list = (() => { try { return JSON.parse(localStorage.getItem('work_late_requests')||'[]'); } catch { return []; } })();
        const req  = list.find(r => r.id === id);
        if (!req) return;
        req.status = 'rejected';
        localStorage.setItem('work_late_requests', JSON.stringify(list));
        showNotification('درخواست رد شد', 'warning');
        refreshContent();
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
        showWorkCalendarModal,
        applyCalendarFilter,
        showLateRequestModal,
        _toggleLateRequestFields,
        saveLateRequest,
        approveLateRequest,
        rejectLateRequest,
        showExportEmployeesModal,
        doExportEmployeesCSV,
    };
})();
