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

        // helper: نمایش ساعت به فرمت ساعت:دقیقه
        function _fmtH(decHours) {
            if (typeof WorkHoursModule !== 'undefined' && WorkHoursModule.formatHoursDisplay) {
                return WorkHoursModule.formatHoursDisplay(decHours);
            }
            // fallback
            const totalMin = Math.round(parseFloat(decHours) * 60);
            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            return m === 0 ? h + ' ساعت' : h + ':' + String(m).padStart(2,'0') + ' ساعت';
        }

        return {
            employeeId,
            employeeName,
            totalHours: _fmtH(totalHoursSubmitted),
            totalHoursApproved: _fmtH(totalHoursApproved),
            totalHoursApprovedRaw: totalHoursApproved,   // برای محاسبات ریاضی
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

    // نمایش ساعت به فرمت ساعت:دقیقه (مثلاً 1.75 → "۱:۴۵")
    function _fmtHours(decHours) {
        const h = parseFloat(decHours) || 0;
        if (typeof WorkHoursModule !== 'undefined' && WorkHoursModule.formatHoursDisplay) {
            return WorkHoursModule.formatHoursDisplay(h);
        }
        const totalMin = Math.round(h * 60);
        const hrs = Math.floor(totalMin / 60);
        const min = totalMin % 60;
        const toFa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
        return min === 0 ? toFa(hrs) + ' ساعت' : toFa(hrs) + ':' + String(min).padStart(2,'0').replace(/\d/g, d=>'۰۱۲۳۴۵۶۷۸۹'[d]) + ' ساعت';
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
        formatHoursDisplay: _fmtHours,
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

        const headers = [
            'نام کارمند','نرخ ساعتی (تومان)',
            'جمع ساعات ارسالی (عدد)','ساعات تأیید شده (عدد)','ساعات در انتظار (عدد)','ساعات رد شده (عدد)',
            'جمع هزینه ارسالی (تومان)','هزینه تأیید شده (تومان)','هزینه در انتظار (تومان)','هزینه رد شده (تومان)',
            'مبلغ ساعات تأیید (تومان)','جمع کل قابل پرداخت (تومان)',
            'جمع هدایا (تومان)','جمع کسورات (تومان)','تسویه شده (تومان)','مانده طلب (تومان)'
        ];

        const rows = summary.map(emp => {
            const paid = settlements.filter(s=>s.employeeId===emp.employeeId).reduce((s,r)=>s+Number(r.amount||0),0);
            const ded  = deductions.filter(d=>d.employeeId===emp.employeeId).reduce((s,d)=>s+Number(d.amount||0),0);
            const gift = gifts.filter(g=>g.employeeId===emp.employeeId).reduce((s,g)=>s+Number(g.amount||0),0);

            // محاسبه جزئیات کامل از entries مستقیم
            const allEnts    = WorkHoursModule.getAllEntriesByEmployee(emp.employeeId);
            const hoursAll   = allEnts.filter(e=>e.type!=='expense');
            const expsAll    = allEnts.filter(e=>e.type==='expense');
            const hApproved  = hoursAll.filter(e=>e.status==='approved').reduce((s,e)=>s+parseFloat(e.totalHours||0),0);
            const hPending   = hoursAll.filter(e=>e.status==='pending').reduce((s,e)=>s+parseFloat(e.totalHours||0),0);
            const hRejected  = hoursAll.filter(e=>e.status==='rejected').reduce((s,e)=>s+parseFloat(e.totalHours||0),0);
            const hTotal     = hApproved + hPending + hRejected;
            const eApproved  = expsAll.filter(e=>e.status==='approved').reduce((s,e)=>s+Number(e.amount||0),0);
            const ePending   = expsAll.filter(e=>e.status==='pending').reduce((s,e)=>s+Number(e.amount||0),0);
            const eRejected  = expsAll.filter(e=>e.status==='rejected').reduce((s,e)=>s+Number(e.amount||0),0);
            const eTotal     = eApproved + ePending + eRejected;
            const hoursAmt   = hApproved * (emp.hourlyRate || 0);
            const grandTotal = hoursAmt + eApproved;
            const remaining  = grandTotal + gift - ded - paid;

            return [
                emp.employeeName, emp.hourlyRate,
                +hTotal.toFixed(2), +hApproved.toFixed(2), +hPending.toFixed(2), +hRejected.toFixed(2),
                Math.round(eTotal), Math.round(eApproved), Math.round(ePending), Math.round(eRejected),
                Math.round(hoursAmt), Math.round(grandTotal),
                Math.round(gift), Math.round(ded), Math.round(paid), Math.round(remaining)
            ];
        });

        _downloadRtlExcel(headers, rows, 'employee-summary.xls');
    }

    function exportEmployeeEntriesCSV(employeeId, employeeName) {
        // دریافت مستقیم از storage بدون فیلتر
        let entries = [];
        try { entries = (WorkHoursModule.getWorkHours ? WorkHoursModule.getWorkHours() : []).filter(e => e.employeeId === employeeId); } catch(_) {}
        if (!entries.length) entries = WorkHoursModule.getAllEntriesByEmployee(employeeId);

        // مرتب‌سازی: تاریخ صعودی
        entries.sort((a,b) => {
            const da = String(a.date||'').replace(/\//g,'-');
            const db = String(b.date||'').replace(/\//g,'-');
            if (da !== db) return da < db ? -1 : 1;
            if (a.type !== b.type) return a.type === 'expense' ? 1 : -1;
            return 0;
        });

        const statusMap = { pending: 'در انتظار', approved: 'تأیید شده', rejected: 'رد شده' };
        const headers   = ['نوع','تاریخ','ساعت شروع','ساعت پایان','مدت (ساعت)','مبلغ هزینه (تومان)','شرح','وضعیت'];
        const rows = entries.map(e => [
            e.type === 'expense' ? 'هزینه' : 'ساعت کاری',
            e.date || '',
            e.type !== 'expense' ? (e.startTime || '') : '',
            e.type !== 'expense' ? (e.endTime   || '') : '',
            e.type !== 'expense' ? +parseFloat(e.totalHours||0).toFixed(2) : '',
            e.type === 'expense' ? Math.round(e.amount || 0) : '',
            e.description || '',
            statusMap[e.status] || e.status || ''
        ]);
        const safeName = (employeeName || employeeId || 'employee').replace(/[^\w\u0600-\u06FF]/g, '_');
        _downloadRtlExcel(headers, rows, `entries-${safeName}.xls`);
    }

    return { exportEmployeesSummaryCSV, exportEmployeeEntriesCSV };
})();

const EmployeeAccountingUI = (function() {
    'use strict';

    let currentUser = null;

    // ── mini jalali date picker (از JalaliUtils global استفاده می‌کنه) ──
    // ساخت یک inline popup شمسی روی یک container
    // hiddenId = id فیلد hidden (میلادی)  |  displayId = id فیلد نمایشی
    function _buildJalaliInput(hiddenId, displayId, initGreg) {
        const ju = window.JalaliUtils;
        const todayGreg = new Date().toISOString().split('T')[0];
        const initVal   = initGreg || todayGreg;
        const initDisp  = ju ? ju.toDisplay(initVal) : initVal;
        return `
            <div class="relative">
                <input type="text" id="${displayId}" readonly value="${initDisp}"
                    placeholder="انتخاب تاریخ..."
                    onclick="EAccJalali.open('${hiddenId}','${displayId}', event)"
                    class="w-full bg-slate-700 text-white border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:border-lime-400 cursor-pointer text-right">
                <input type="hidden" id="${hiddenId}" value="${initVal}">
            </div>`;
    }

    // ── مدیریت popup تقویم شمسی ─────────────────────────────
    window.EAccJalali = (function() {
        let _hid = '', _dis = '', _cy = 0, _cm = 0;

        function open(hiddenId, displayId, evt) {
            if (evt) { evt.stopPropagation(); evt.preventDefault(); }
            _hid = hiddenId; _dis = displayId;
            const ju = window.JalaliUtils;
            if (!ju) { console.warn('JalaliUtils not loaded'); return; }

            const val = document.getElementById(hiddenId)?.value;
            if (val) {
                try {
                    const [y,m,d] = val.split('-').map(Number);
                    const jd = ju.gregToJD(y,m,d);
                    const [jy,jm] = ju.jdToJalali(jd);
                    _cy = jy; _cm = jm;
                } catch(e) { const n=ju.currentJalali(); _cy=n[0]; _cm=n[1]; }
            } else { const n=ju.currentJalali(); _cy=n[0]; _cm=n[1]; }

            close(); // بستن هر popup باز قبلی
            // requestAnimationFrame تضمین می‌کند که DOM آماده است
            requestAnimationFrame(_render);
        }

        function close() {
            document.getElementById('_eacc_jalali_popup')?.remove();
            document.getElementById('_eacc_jalali_overlay')?.remove();
        }

        function _render() {
            const ju = window.JalaliUtils;
            const trigger = document.getElementById(_dis);
            if (!trigger) return;

            // overlay شفاف روی کل صفحه
            const ov = document.createElement('div');
            ov.id = '_eacc_jalali_overlay';
            ov.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
            ov.onclick = close;
            document.body.appendChild(ov);

            // popup با z-index بالاتر از مودال
            const popup = document.createElement('div');
            popup.id = '_eacc_jalali_popup';
            popup.style.cssText = 'position:fixed;z-index:9999;background:#1e293b;border:1px solid rgba(163,230,53,0.3);border-radius:16px;padding:16px;width:272px;box-shadow:0 24px 64px rgba(0,0,0,.8);direction:rtl;';
            popup.onclick = e => e.stopPropagation();

            // موقعیت نسبت به viewport
            const rect = trigger.getBoundingClientRect();
            let top  = rect.bottom + 6;
            let left = rect.left;
            // جلوگیری از خروج از صفحه
            if (left + 272 > window.innerWidth - 8)  left = window.innerWidth - 280;
            if (left < 8) left = 8;
            if (top + 300 > window.innerHeight) top = rect.top - 310;
            popup.style.top  = top  + 'px';
            popup.style.left = left + 'px';

            popup.innerHTML = _calHtml(_cy, _cm);
            document.body.appendChild(popup);
        }

        function _calHtml(cy, cm) {
            const ju = window.JalaliUtils;
            const totalDays = ju.monthDays(cy, cm);
            const firstDay  = ju.firstWeekday(cy, cm);
            const [nowJY,nowJM,nowJD] = ju.currentJalali();
            const selGreg = document.getElementById(_hid)?.value;
            let selJY=0,selJM=0,selJD=0;
            if (selGreg) {
                try {
                    const [y,m,d]=selGreg.split('-').map(Number);
                    [selJY,selJM,selJD]=ju.jdToJalali(ju.gregToJD(y,m,d));
                } catch(e){}
            }

            let html = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <button type="button" onclick="EAccJalali._nav(${cy},${cm},-1)"
                    style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:14px;">›</button>
                <span style="color:#fff;font-weight:700;font-size:14px;">${ju.MONTHS[cm-1]} ${cy}</span>
                <button type="button" onclick="EAccJalali._nav(${cy},${cm},+1)"
                    style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:14px;">‹</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;">`;

            ju.DAYS.forEach(d => {
                html += `<div style="color:#64748b;font-size:11px;padding:4px 0;">${d}</div>`;
            });
            for (let i=0; i<firstDay; i++) html += '<div></div>';
            for (let d=1; d<=totalDays; d++) {
                const isT = d===nowJD && cm===nowJM && cy===nowJY;
                const isS = d===selJD && cm===selJM && cy===selJY;
                const bg = isS ? '#65a30d' : isT ? 'rgba(101,163,13,0.2)' : 'transparent';
                const clr = isS ? '#fff' : isT ? '#000000ff' : '#e2e8f0';
                const bord = isT && !isS ? '1px solid #84cc16' : 'none';
                html += `<button type="button" onclick="EAccJalali.pick(${cy},${cm},${d})"
                    style="background:${bg};color:${clr};border:${bord};border-radius:8px;padding:5px 2px;cursor:pointer;font-size:12px;transition:background .15s;"
                    onmouseover="if(!${isS})this.style.background='rgba(255,255,255,0.1)'"
                    onmouseout="this.style.background='${bg}'">${d}</button>`;
            }
            html += '</div>';
            return html;
        }

        function _nav(cy, cm, dir) {
            cm += dir;
            if (cm < 1) { cm = 12; cy--; }
            if (cm > 12) { cm = 1;  cy++; }
            _cy = cy; _cm = cm;
            const popup = document.getElementById('_eacc_jalali_popup');
            if (popup) popup.innerHTML = _calHtml(cy, cm);
        }

        function pick(jy, jm, jd) {
            const ju = window.JalaliUtils;
            const greg = ju.toGreg(jy, jm, jd);
            const disp = `${jd} ${ju.MONTHS[jm-1]} ${jy}`;
            const hidEl = document.getElementById(_hid);
            const disEl = document.getElementById(_dis);
            if (hidEl) hidEl.value = greg;
            if (disEl) disEl.value = disp;
            close();
        }

        return { open, close, pick, _nav };
    })();

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

    // ── accordion ماهانه — هر ماه شمسی یک باکس کشویی ──────
    function renderMonthlyAccordion(entries, employeeId) {
        var MONTHS_FA = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

        // helper: نمایش ساعت به فرمت ساعت:دقیقه
        function _fmtH(decHours) {
            if (typeof WorkHoursModule !== 'undefined' && WorkHoursModule.formatHoursDisplay) {
                return WorkHoursModule.formatHoursDisplay(decHours);
            }
            var totalMin = Math.round(parseFloat(decHours) * 60);
            var h = Math.floor(totalMin / 60);
            var m = totalMin % 60;
            return m === 0 ? h + ' ساعت' : h + ':' + String(m).padStart(2,'0') + ' ساعت';
        }

        function toJalaliKey(dateStr) {
            if (!dateStr) return '0000-00';
            var s = String(dateStr).trim().replace(/\./g,'-').replace(/\//g,'-');
            // اعداد فارسی → لاتین
            s = s.replace(/[۰-۹]/g,function(d){return String.fromCharCode(d.charCodeAt(0)-1728);})
                 .replace(/[٠-٩]/g,function(d){return String.fromCharCode(d.charCodeAt(0)-1584);});
            var parts = s.split('-');
            if (parts.length < 3) return '0000-00';
            var y = parseInt(parts[0],10), m = parseInt(parts[1],10), d = parseInt(parts[2],10);
            if (!y || !m) return '0000-00';
            if (y >= 1300 && y <= 1500) return y+'-'+String(m).padStart(2,'0');
            if (y >= 1900 && y <= 2100) {
                if (typeof Jalali!=='undefined' && Jalali.toJalaali) {
                    try { var j=Jalali.toJalaali(y,m,d); return j.jy+'-'+String(j.jm).padStart(2,'0'); } catch(e){}
                }
                return (y-621)+'-'+String(m).padStart(2,'0');
            }
            return '0000-00';
        }

        if (!entries || entries.length === 0) {
            return '<div style="text-align:center;padding:40px 0;color:#000000ff;"><i class="fas fa-inbox" style="font-size:2rem;opacity:.3;display:block;margin-bottom:8px;"></i><p>هیچ سابقه‌ای ثبت نشده</p></div>';
        }

        var monthGroups = {};
        entries.forEach(function(e) {
            var key = toJalaliKey(e.date || '');
            if (!monthGroups[key]) monthGroups[key] = [];
            monthGroups[key].push(e);
        });

        var sortedKeys = Object.keys(monthGroups).sort(function(a,b){ return b.localeCompare(a); });

        return sortedKeys.map(function(key, idx) {
            var ents = monthGroups[key];
            var isOpen = idx === 0;

            var monthTitle = 'تاریخ نامشخص';
            if (key !== '0000-00') {
                var kp = key.split('-');
                var moNum = parseInt(kp[1],10);
                monthTitle = (MONTHS_FA[moNum-1] || kp[1]) + '  ' + kp[0];
            }

            var hoursE  = ents.filter(function(e){ return e.type !== 'expense'; });
            var expE    = ents.filter(function(e){ return e.type === 'expense'; });
            var totH    = hoursE.reduce(function(s,e){ return s+parseFloat(e.totalHours||0); }, 0);
            var totExp  = expE.reduce(function(s,e){ return s+Number(e.amount||0); }, 0);
            var appCnt  = ents.filter(function(e){ return e.status==='approved'; }).length;
            var penCnt  = ents.filter(function(e){ return e.status==='pending';  }).length;
            var rejCnt  = ents.filter(function(e){ return e.status==='rejected'; }).length;

            function mkBadge(clr, label) {
                return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:'+clr+'22;color:'+clr+';border:1px solid '+clr+'44;">'
                     + '<span style="width:6px;height:6px;border-radius:50%;background:'+clr+';display:inline-block;flex-shrink:0;"></span>'+label+'</span>';
            }

            var badges = [
                penCnt > 0 ? mkBadge('#60a5fa', penCnt+' در انتظار') : '',
                appCnt > 0 ? mkBadge('#4ade80', appCnt+' تأیید') : '',
                rejCnt > 0 ? mkBadge('#f87171', rejCnt+' رد') : '',
            ].filter(Boolean).join('');

            var summaryParts = [
                hoursE.length > 0 ? '<span style="color:#a3e635;font-size:12px;"><i class="fas fa-clock" style="margin-left:3px;font-size:11px;"></i>'+_fmtH(totH)+' ساعت</span>' : '',
                expE.length   > 0 ? '<span style="color:#fb923c;font-size:12px;"><i class="fas fa-receipt" style="margin-left:3px;font-size:11px;"></i>'+Number(totExp).toLocaleString('fa-IR')+' ت</span>' : '',
            ].filter(Boolean).join('<span style="color:#4b5563;margin:0 6px;">|</span>');

            var accId = 'acc-month-' + key.replace('-','_');
            var bdrClr = penCnt > 0 ? '#60a5fa' : appCnt===ents.length ? '#4ade80' : rejCnt > 0 ? '#f87171' : '#ffffff22';

            var rows = ents.map(function(e) {
                var stCfg = {
                    approved: { bg:'rgba(34,197,94,0.12)',  txt:'#86efac', bdr:'rgba(74,222,128,0.3)',  dot:'#4ade80', lbl:'تأیید شده' },
                    pending:  { bg:'rgba(59,130,246,0.12)', txt:'#93c5fd', bdr:'rgba(96,165,250,0.3)',  dot:'#60a5fa', lbl:'در انتظار' },
                    rejected: { bg:'rgba(239,68,68,0.12)',  txt:'#fca5a5', bdr:'rgba(248,113,113,0.3)', dot:'#f87171', lbl:'رد شده'    },
                };
                var sc = stCfg[e.status] || stCfg.pending;
                var isExp = e.type === 'expense';

                var typeBadge = isExp
                    ? '<span style="background:rgba(249,115,22,.2);color:#fdba74;padding:2px 7px;border-radius:6px;font-size:11px;white-space:nowrap;"><i class="fas fa-receipt" style="font-size:10px;margin-left:3px;"></i>هزینه</span>'
                    : '<span style="background:rgba(59,130,246,.2);color:#93c5fd;padding:2px 7px;border-radius:6px;font-size:11px;white-space:nowrap;"><i class="fas fa-clock" style="font-size:10px;margin-left:3px;"></i>ساعت کاری</span>';

                var valPart = isExp
                    ? '<span style="color:#fb923c;font-weight:700;">'+Number(e.amount||0).toLocaleString('fa-IR')+' ت</span>'
                    : '<span style="color:#a3e635;font-weight:700;">'+_fmtH(parseFloat(e.totalHours||0))+'</span><span style="color:#000000ff;font-size:11px;margin-right:2px;"> ساعت</span>'
                      + (e.startTime && e.endTime ? '<br><span style="color:#000000ff;font-size:11px;">'+e.startTime+'—'+e.endTime+'</span>' : '');

                var stBadge = '<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;background:'+sc.bg+';color:'+sc.txt+';border:1px solid '+sc.bdr+';white-space:nowrap;">'
                            + '<span style="width:6px;height:6px;border-radius:50%;background:'+sc.dot+';display:inline-block;flex-shrink:0;"></span>'+sc.lbl+'</span>';

                return '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'transparent\'">'
                    + '<td style="padding:8px 12px;white-space:nowrap;">'+typeBadge+'</td>'
                    + '<td style="padding:8px 12px;color:#000000ff;font-size:13px;white-space:nowrap;">'+(e.date||'—')+'</td>'
                    + '<td style="padding:8px 12px;white-space:nowrap;">'+valPart+'</td>'
                    + '<td style="padding:8px 12px;color:#000000ff;font-size:13px;word-break:break-word;white-space:normal;line-height:1.5;min-width:120px;">'+(e.description||'—')+'</td>'
                    + '<td style="padding:8px 12px;text-align:center;white-space:nowrap;">'+stBadge+'</td>'
                    + '</tr>';
            }).join('');

            var thead = '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);">'
                + '<th style="text-align:right;color:#000000ff;font-weight:600;padding:7px 12px;font-size:11px;white-space:nowrap;">نوع</th>'
                + '<th style="text-align:right;color:#000000ff;font-weight:600;padding:7px 12px;font-size:11px;white-space:nowrap;">تاریخ</th>'
                + '<th style="text-align:right;color:#000000ff;font-weight:600;padding:7px 12px;font-size:11px;white-space:nowrap;">مقدار</th>'
                + '<th style="text-align:right;color:#000000ff;font-weight:600;padding:7px 12px;font-size:11px;">شرح</th>'
                + '<th style="text-align:center;color:#000000ff;font-weight:600;padding:7px 12px;font-size:11px;white-space:nowrap;">وضعیت</th>'
                + '</tr></thead>';

            return '<div style="border:1px solid rgba(255,255,255,0.1);border-right:3px solid '+bdrClr+';border-radius:12px;overflow:hidden;margin-bottom:10px;">'
                + '<button type="button"'
                + ' onclick="(function(btn){var b=document.getElementById(\''+accId+'\');var ic=btn.querySelector(\'.acc-icon\');var op=b.style.display!==\'none\';b.style.display=op?\'none\':\'block\';ic.style.transform=op?\'rotate(0deg)\':\'rotate(180deg)\';})(this)"'
                + ' style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(255,255,255,0.05);border:none;cursor:pointer;text-align:right;gap:8px;"'
                + ' onmouseover="this.style.background=\'rgba(255,255,255,0.09)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'">'
                + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
                + '<i class="fas fa-calendar-alt" style="color:#a3e635;font-size:13px;"></i>'
                + '<span style="color:#000000ff;font-weight:700;font-size:14px;">'+monthTitle+'</span>'
                + '<div style="display:flex;gap:5px;flex-wrap:wrap;">'+badges+'</div>'
                + '</div>'
                + '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">'
                + '<div style="display:flex;align-items:center;gap:8px;">'+summaryParts+'</div>'
                + '<i class="fas fa-chevron-down acc-icon" style="color:#000000ff;font-size:11px;transition:transform .2s;transform:rotate('+(isOpen?'180deg':'0deg')+');"></i>'
                + '</div>'
                + '</button>'
                + '<div id="'+accId+'" style="display:'+(isOpen?'block':'none')+';"><div style="overflow-x:auto;">'
                + '<table style="width:100%;border-collapse:collapse;table-layout:auto;">'+thead+'<tbody>'+rows+'</tbody></table>'
                + '</div></div>'
                + '</div>';
        }).join('');
    }

    function renderEntriesList(entries, isManagerView = false) {
        // رنگ‌های inline style — برای اطمینان از اعمال صحیح
        const statusStyle = {
            pending:  'background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(96,165,250,0.3);',
            approved: 'background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(74,222,128,0.3);',
            rejected: 'background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(248,113,113,0.3);',
        };
        const statusTexts = { pending: 'در انتظار', approved: 'تأیید شده', rejected: 'رد شده' };
        const statusDotColor = { pending: '#60a5fa', approved: '#4ade80', rejected: '#ed7474ff' };

        if (!entries || entries.length === 0) {
            return '<tr><td colspan="6" class="text-center py-8 text-gray-400">رکوردی یافت نشد</td></tr>';
        }

        return entries.map(entry => {
            const isExpense = entry.type === 'expense';
            const valueCell = isExpense
                ? `<span style="color:#ee2d2dff;font-weight:700;">${EmployeeAccountingModule.formatCurrency(entry.amount || 0)}</span>`
                : `<span style="color:#1e8601ff;font-weight:700;">${(typeof WorkHoursModule!=='undefined'&&WorkHoursModule.formatHoursDisplay) ? WorkHoursModule.formatHoursDisplay(parseFloat(entry.totalHours||0)) : (entry.totalHours||0)} ساعت</span>`;

            const stStyle = statusStyle[entry.status] || statusStyle.pending;
            const stText  = statusTexts[entry.status] || entry.status;
            const dotClr  = statusDotColor[entry.status] || statusDotColor.pending;

            const typeBadge = isExpense
                ? `<span style="background:rgba(221, 214, 18, 0.2);color:#fdba74;padding:2px 8px;border-radius:6px;font-size:11px;display:inline-flex;align-items:center;gap:4px;"><i class="fas fa-receipt" style="font-size:10px;"></i>هزینه</span>`
                : `<span style="background:rgba(59,130,246,0.2);color:#93c5fd;padding:2px 8px;border-radius:6px;font-size:11px;display:inline-flex;align-items:center;gap:4px;"><i class="fas fa-clock" style="font-size:10px;"></i>ساعت کاری</span>`;

            const typeCell = `<div style="display:flex;flex-direction:column;gap:4px;">
                ${typeBadge}
                <span style="${stStyle}padding:2px 8px;border-radius:6px;font-size:11px;display:inline-flex;align-items:center;gap:4px;">
                    <span style="width:6px;height:6px;border-radius:50%;background:${dotClr};display:inline-block;flex-shrink:0;"></span>${stText}
                </span>
              </div>`;

            const timeRange = !isExpense && entry.startTime && entry.endTime
                ? `<span style="color:#6b7280;font-size:11px;display:block;">${entry.startTime} — ${entry.endTime}</span>` : '';

            // ستون عملیات — مدیر: pending → دو دکمه | بقیه → badge ثابت
            const actionCell = isManagerView
                ? `<td class="text-center py-3 px-3">
                    ${entry.status === 'approved'
                        ? `<span style="${statusStyle.approved}padding:4px 10px;border-radius:20px;font-size:11px;display:inline-flex;align-items:center;gap:5px;"><i class="fas fa-check-circle" style="color:#4ade80;"></i> تأیید شده</span>`
                        : entry.status === 'rejected'
                            ? `<span style="${statusStyle.rejected}padding:4px 10px;border-radius:20px;font-size:11px;display:inline-flex;align-items:center;gap:5px;"><i class="fas fa-times-circle" style="color:#f87171;"></i> رد شده</span>`
                            : `<div style="display:flex;gap:4px;justify-content:center;">
                                <button onclick="WorkHoursUI.approveEntry('${entry.id}'); EmployeeAccountingUI.refreshContent()"
                                    title="تأیید"
                                    style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(34,197,94,0.2);color:#4ade80;border:none;cursor:pointer;transition:background .2s;"
                                    onmouseover="this.style.background='rgba(34,197,94,0.4)'"
                                    onmouseout="this.style.background='rgba(34,197,94,0.2)'">
                                    <i class="fas fa-check" style="font-size:11px;"></i>
                                </button>
                                <button onclick="WorkHoursUI.rejectEntry('${entry.id}'); EmployeeAccountingUI.refreshContent()"
                                    title="رد"
                                    style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(239,68,68,0.2);color:#f87171;border:none;cursor:pointer;transition:background .2s;"
                                    onmouseover="this.style.background='rgba(255, 0, 0, 0.83)'"
                                    onmouseout="this.style.background='rgba(239,68,68,0.2)'">
                                    <i class="fas fa-times" style="font-size:11px;"></i>
                                </button>
                              </div>`
                    }
                  </td>`
                : `<td class="text-center py-3 px-3">
                    <span style="${stStyle}padding:4px 12px;border-radius:20px;font-size:11px;display:inline-flex;align-items:center;gap:5px;">
                        <span style="width:6px;height:6px;border-radius:50%;background:${dotClr};display:inline-block;"></span>${stText}
                    </span>
                  </td>`;

            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                    <td class="py-3 px-3">${typeCell}</td>
                    <td class="py-3 px-4" style="color:##000000ff;font-size:14px;">${entry.date || '—'}${timeRange}</td>
                    <td class="py-3 px-4">${valueCell}</td>
                    <td class="py-3 px-4" style="color:#000000ff;font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${entry.description || '—'}</td>
                    ${actionCell}
                </tr>`;
        }).join('');
    }

    function getEmployeeContent() {
        if (!currentUser) {
            init();
        }
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

        const hoursPayment = parseFloat(monthlySummary.totalHoursApprovedRaw || monthlySummary.totalHoursApproved) * monthlySummary.hourlyRate;

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
                                <p class="text-3xl font-bold text-white">${EmployeeAccountingModule.formatHoursDisplay(summary.totalHoursApprovedRaw ?? summary.totalHours)}</p>
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
                        <p class="text-2xl font-bold text-white">${EmployeeAccountingModule.formatHoursDisplay(monthlySummary.totalHoursApprovedRaw ?? monthlySummary.totalHours)}</p>
                            <p class="text-lime-300 text-xs mt-1">${monthlySummary.hoursCount} گزارش روزانه</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-lime-200 text-sm mb-1">هزینه‌های این ماه</p>
                            <p class="text-2xl font-bold text-white">${EmployeeAccountingModule.formatCurrency(monthlySummary.totalExpenses)}</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-lime-200 text-sm mb-1">حقوق ساعات (تأیید × نرخ)</p>
                            <p class="text-2xl font-bold text-black-400">${EmployeeAccountingModule.formatCurrency(hoursPayment)}</p>
                            <p class="text-lime-300 text-xs mt-1">${EmployeeAccountingModule.formatHoursDisplay(monthlySummary.totalHoursApprovedRaw ?? monthlySummary.totalHoursApproved)} تأیید × ${EmployeeAccountingModule.formatCurrency(monthlySummary.hourlyRate)}</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-4">
                            <p class="text-lime-200 text-sm mb-1">جمع کل این ماه</p>
                            <p class="text-2xl font-bold text-emerald-400">${EmployeeAccountingModule.formatCurrency(monthlySummary.grandTotal)}</p>
                            <p class="text-lime-300 text-xs mt-1">حقوق ساعات + هزینه‌های تأیید شده</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-5 flex items-center gap-2">
                        <i class="fas fa-calendar-alt text-lime-400"></i>
                        سوابق ماهانه
                        <span class="text-gray-400 text-sm font-normal mr-2">(${allEntries.length} رکورد)</span>
                    </h3>
                    ${renderMonthlyAccordion(allEntries, currentUser.id)}
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

            </div>`;
    }

    function getManagerEmployeesContent() {
        const employeesSummary = EmployeeAccountingModule.getAllEmployeesSummary();

        const totalAmount = employeesSummary.reduce((sum, emp) => sum + emp.grandTotal, 0);
        const totalHours  = employeesSummary.reduce((sum, emp) => sum + (emp.totalHoursApprovedRaw || parseFloat(emp.totalHoursApproved) || 0), 0);
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
                            <span class="text-xl font-bold text-black-400">${EmployeeAccountingModule.formatHoursDisplay(emp.totalHoursApprovedRaw ?? emp.totalHoursApproved)}</span>
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
                        <p class="text-lg font-bold text-black-400">${EmployeeAccountingModule.formatHoursDisplay(employeesSummary.reduce((s,e)=>s+(e.totalHoursApprovedRaw||parseFloat(e.totalHours)||0),0))}</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-emerald-400/20">
                        <i class="fas fa-check-circle text-emerald-400 mb-2 block"></i>
                        <p class="text-black-400 text-xs mb-1">ساعات تأیید شده</p>
                        <p class="text-lg font-bold text-emerald-400">${EmployeeAccountingModule.formatHoursDisplay(totalHours)}</p>
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
                        <p class="text-black-400 text-xs mb-1">هزینه‌های تأیید شده</p>
                        <p class="text-sm font-bold text-cyan-400">${EmployeeAccountingModule.formatCurrency(totalExpenses)}</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-red-400/20">
                        <i class="fas fa-minus-circle text-red-400 mb-2 block"></i>
                        <p class="text-black-400 text-xs mb-1">جمع کسورات</p>
                        <p class="text-sm font-bold text-red-400">${EmployeeAccountingModule.formatCurrency(
                            (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]').reduce((s,d)=>s+Number(d.amount||0),0); } catch { return 0; } })()
                        )}</p>
                    </div>

                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-green-400/20">
                        <i class="fas fa-gift text-green-400 mb-2 block"></i>
                        <p class="text-black-400 text-xs mb-1">جمع هدایا</p>
                        <p class="text-sm font-bold text-green-400">${EmployeeAccountingModule.formatCurrency(
                            (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]').reduce((s,g)=>s+Number(g.amount||0),0); } catch { return 0; } })()
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

                <!-- ── پایان جدول کارمندان ── -->
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

    // ── accordion ماهانه با دکمه تأیید/رد — برای مودال جزئیات مالی مدیر ──
    function renderMonthlyAccordionManager(entries, employeeId) {
        var MONTHS_FA = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

        // helper: نمایش ساعت به فرمت ساعت:دقیقه
        function _fmtH(decHours) {
            if (typeof WorkHoursModule !== 'undefined' && WorkHoursModule.formatHoursDisplay) {
                return WorkHoursModule.formatHoursDisplay(decHours);
            }
            var totalMin = Math.round(parseFloat(decHours) * 60);
            var h = Math.floor(totalMin / 60);
            var m = totalMin % 60;
            return m === 0 ? h + ' ساعت' : h + ':' + String(m).padStart(2,'0') + ' ساعت';
        }

        function toJalaliKey(dateStr) {
            if (!dateStr) return '0000-00';
            var s = String(dateStr).trim().replace(/\./g,'-').replace(/\//g,'-');
            s = s.replace(/[۰-۹]/g,function(d){return String.fromCharCode(d.charCodeAt(0)-1728);})
                 .replace(/[٠-٩]/g,function(d){return String.fromCharCode(d.charCodeAt(0)-1584);});
            var parts = s.split('-');
            if (parts.length < 3) return '0000-00';
            var y=parseInt(parts[0],10), m=parseInt(parts[1],10), d=parseInt(parts[2],10);
            if (!y||!m) return '0000-00';
            if (y>=1300&&y<=1500) return y+'-'+String(m).padStart(2,'0');
            if (y>=1900&&y<=2100) {
                if (typeof Jalali!=='undefined'&&Jalali.toJalaali) {
                    try { var j=Jalali.toJalaali(y,m,d); return j.jy+'-'+String(j.jm).padStart(2,'0'); } catch(e){}
                }
                return (y-621)+'-'+String(m).padStart(2,'0');
            }
            return '0000-00';
        }

        if (!entries||entries.length===0) {
            return '<div style="text-align:center;padding:32px;color:#000000ff;"><i class="fas fa-inbox" style="font-size:2rem;opacity:.3;display:block;margin-bottom:8px;"></i><p>سابقه‌ای ثبت نشده</p></div>';
        }

        var monthGroups = {};
        entries.forEach(function(e) {
            var k = toJalaliKey(e.date||'');
            if (!monthGroups[k]) monthGroups[k]=[];
            monthGroups[k].push(e);
        });

        var sortedKeys = Object.keys(monthGroups).sort(function(a,b){return b.localeCompare(a);});

        return sortedKeys.map(function(key, idx) {
            var ents   = monthGroups[key];
            var isOpen = idx===0;

            var monthTitle = 'تاریخ نامشخص';
            if (key!=='0000-00') {
                var kp=key.split('-'), moNum=parseInt(kp[1],10);
                monthTitle=(MONTHS_FA[moNum-1]||kp[1])+'  '+kp[0];
            }

            var hoursE = ents.filter(function(e){return e.type!=='expense';});
            var expE   = ents.filter(function(e){return e.type==='expense';});
            var totH   = hoursE.reduce(function(s,e){return s+parseFloat(e.totalHours||0);},0);
            var totExp = expE.reduce(function(s,e){return s+Number(e.amount||0);},0);
            var appCnt = ents.filter(function(e){return e.status==='approved';}).length;
            var penCnt = ents.filter(function(e){return e.status==='pending';}).length;
            var rejCnt = ents.filter(function(e){return e.status==='rejected';}).length;

            function mkBadge(clr,label){
                return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:'+clr+'22;color:'+clr+';border:1px solid '+clr+'44;"><span style="width:6px;height:6px;border-radius:50%;background:'+clr+';display:inline-block;flex-shrink:0;"></span>'+label+'</span>';
            }

            var badges=[
                penCnt>0?mkBadge('#60a5fa',penCnt+' در انتظار'):'',
                appCnt>0?mkBadge('#4ade80',appCnt+' تأیید'):'',
                rejCnt>0?mkBadge('#f87171',rejCnt+' رد'):'',
            ].filter(Boolean).join('');

            var sumParts=[
                hoursE.length>0?'<span style="color:#a3e635;font-size:12px;"><i class="fas fa-clock" style="margin-left:3px;font-size:10px;"></i>'+_fmtH(totH)+' ساعت</span>':'',
                expE.length>0?'<span style="color:#fb923c;font-size:12px;"><i class="fas fa-receipt" style="margin-left:3px;font-size:10px;"></i>'+Number(totExp).toLocaleString('fa-IR')+' ت</span>':'',
            ].filter(Boolean).join('<span style="color:#374151;margin:0 5px;">|</span>');

            var accId='acc-mgr-'+key.replace('-','_');
            var bdrClr=penCnt>0?'#60a5fa':appCnt===ents.length?'#4ade80':rejCnt>0?'#f87171':'#ffffff22';

            var rows = ents.map(function(e) {
                var stCfg={
                    approved:{bg:'rgba(34,197,94,0.12)',txt:'#86efac',bdr:'rgba(74,222,128,0.3)',dot:'#4ade80',lbl:'تأیید شده'},
                    pending: {bg:'rgba(59,130,246,0.12)',txt:'#93c5fd',bdr:'rgba(96,165,250,0.3)',dot:'#60a5fa',lbl:'در انتظار'},
                    rejected:{bg:'rgba(239,68,68,0.12)',txt:'#fca5a5',bdr:'rgba(248,113,113,0.3)',dot:'#f87171',lbl:'رد شده'},
                };
                var sc=stCfg[e.status]||stCfg.pending;
                var isExp=e.type==='expense';

                var typeBadge=isExp
                    ?'<span style="background:rgba(249,115,22,.2);color:#fdba74;padding:2px 7px;border-radius:6px;font-size:11px;white-space:nowrap;"><i class="fas fa-receipt" style="font-size:10px;margin-left:3px;"></i>هزینه</span>'
                    :'<span style="background:rgba(59,130,246,.2);color:#93c5fd;padding:2px 7px;border-radius:6px;font-size:11px;white-space:nowrap;"><i class="fas fa-clock" style="font-size:10px;margin-left:3px;"></i>ساعت کاری</span>';

                var valPart=isExp
                    ?'<span style="color:#fb923c;font-weight:700;">'+Number(e.amount||0).toLocaleString('fa-IR')+' ت</span>'
                    :'<span style="color:#a3e635;font-weight:700;">'+_fmtH(parseFloat(e.totalHours||0))+'</span><span style="color:#000000ff;font-size:11px;margin-right:2px;"> ساعت</span>'
                      +(e.startTime&&e.endTime?'<br><span style="color:#000000ff;font-size:11px;">'+e.startTime+'—'+e.endTime+'</span>':'');

                // دکمه عملیات: pending → تأیید/رد | approved/rejected → badge
                var actionCell;
                if (e.status==='approved') {
                    actionCell='<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;background:rgba(34,197,94,0.12);color:#86efac;border:1px solid rgba(74,222,128,0.3);white-space:nowrap;"><span style="width:6px;height:6px;border-radius:50%;background:#4ade80;display:inline-block;"></span>تأیید شده</span>';
                } else if (e.status==='rejected') {
                    actionCell='<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(248,113,113,0.3);white-space:nowrap;"><span style="width:6px;height:6px;border-radius:50%;background:#f87171;display:inline-block;"></span>رد شده</span>';
                } else {
                    actionCell='<div style="display:flex;gap:4px;justify-content:center;">'
                        +'<button onclick="WorkHoursUI.approveEntry(\''+e.id+'\'); EmployeeAccountingUI.refreshDetailModal(\''+employeeId+'\')" title="تأیید"'
                        +' style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(34,197,94,0.2);color:#4ade80;border:none;cursor:pointer;"'
                        +' onmouseover="this.style.background=\'rgba(34,197,94,0.4)\'" onmouseout="this.style.background=\'rgba(34,197,94,0.2)\'">'
                        +'<i class="fas fa-check" style="font-size:11px;"></i></button>'
                        +'<button onclick="WorkHoursUI.rejectEntry(\''+e.id+'\'); EmployeeAccountingUI.refreshDetailModal(\''+employeeId+'\')" title="رد"'
                        +' style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(239,68,68,0.2);color:#f87171;border:none;cursor:pointer;"'
                        +' onmouseover="this.style.background=\'rgba(239,68,68,0.4)\'" onmouseout="this.style.background=\'rgba(239,68,68,0.2)\'">'
                        +'<i class="fas fa-times" style="font-size:11px;"></i></button>'
                        +'</div>';
                }

                return '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'transparent\'">'
                    +'<td style="padding:8px 12px;white-space:nowrap;">'+typeBadge+'</td>'
                    +'<td style="padding:8px 12px;color:#000000ff;font-size:13px;white-space:nowrap;">'+(e.date||'—')+'</td>'
                    +'<td style="padding:8px 12px;white-space:nowrap;">'+valPart+'</td>'
                    +'<td style="padding:8px 12px;color:#000000ff;font-size:13px;word-break:break-word;white-space:normal;line-height:1.5;min-width:120px;">'+(e.description||'—')+'</td>'
                    +'<td style="padding:8px 12px;text-align:center;white-space:nowrap;">'+actionCell+'</td>'
                    +'</tr>';
            }).join('');

            var thead='<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);">'
                +'<th style="text-align:right;color:#000000ff;font-weight:600;padding:7px 12px;font-size:11px;white-space:nowrap;">نوع</th>'
                +'<th style="text-align:right;color:#000000ff;font-weight:600;padding:7px 12px;font-size:11px;white-space:nowrap;">تاریخ</th>'
                +'<th style="text-align:right;color:#000000ff;font-weight:600;padding:7px 12px;font-size:11px;white-space:nowrap;">مقدار</th>'
                +'<th style="text-align:right;color:#000000ff;font-weight:600;padding:7px 12px;font-size:11px;">شرح</th>'
                +'<th style="text-align:center;color:#000000ff;font-weight:600;padding:7px 12px;font-size:11px;white-space:nowrap;">عملیات</th>'
                +'</tr></thead>';

            return '<div style="border:1px solid rgba(255,255,255,0.1);border-right:3px solid '+bdrClr+';border-radius:12px;overflow:hidden;margin-bottom:10px;">'
                +'<button type="button"'
                +' onclick="(function(btn){var b=document.getElementById(\''+accId+'\');var ic=btn.querySelector(\'.acc-icon\');var op=b.style.display!==\'none\';b.style.display=op?\'none\':\'block\';ic.style.transform=op?\'rotate(0deg)\':\'rotate(180deg)\';})(this)"'
                +' style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(255,255,255,0.05);border:none;cursor:pointer;text-align:right;gap:8px;"'
                +' onmouseover="this.style.background=\'rgba(255,255,255,0.09)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'">'
                +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
                +'<i class="fas fa-calendar-alt" style="color:#a3e635;font-size:13px;"></i>'
                +'<span style="color:#000000ff;font-weight:700;font-size:14px;">'+monthTitle+'</span>'
                +'<div style="display:flex;gap:5px;flex-wrap:wrap;">'+badges+'</div>'
                +'</div>'
                +'<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">'
                +'<div style="display:flex;align-items:center;gap:8px;">'+sumParts+'</div>'
                +'<i class="fas fa-chevron-down acc-icon" style="color:#000000ff;font-size:11px;transition:transform .2s;transform:rotate('+(isOpen?'180deg':'0deg')+');"></i>'
                +'</div></button>'
                +'<div id="'+accId+'" style="display:'+(isOpen?'block':'none')+';"><div style="overflow-x:auto;">'
                +'<table style="width:100%;border-collapse:collapse;table-layout:auto;">'+thead+'<tbody>'+rows+'</tbody></table>'
                +'</div></div></div>';
        }).join('');
    }

    function showEmployeeDetails(employeeId) {
        const summary    = EmployeeAccountingModule.getEmployeeFinancialSummary(employeeId);
        const entries    = WorkHoursModule.getAllEntriesByEmployee(employeeId);
        const deductions = (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]').filter(d=>d.employeeId===employeeId); } catch { return []; } })();
        const gifts      = (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]').filter(g=>g.employeeId===employeeId); } catch { return []; } })();
        const settlements= (() => { try { return JSON.parse(localStorage.getItem('work_settlements')||'[]').filter(s=>s.employeeId===employeeId); } catch { return []; } })();
        const totalDed   = deductions.reduce((s,d) => s + Number(d.amount||0), 0);
        const totalGift  = gifts.reduce((s,g) => s + Number(g.amount||0), 0);
        const totalPaid  = settlements.reduce((s,r) => s + Number(r.amount||0), 0);
        const remaining  = Math.max(0, summary.grandTotal + totalGift - totalDed - totalPaid);
        const safeName   = (summary.employeeName||'').replace(/'/g,"\\'");

        document.getElementById('employee-details-modal')?.remove();

        const dedBlock = deductions.length ? deductions.map(d=>`
        <tr class="border-b border-white/5">
            <td class="py-2 px-3 text-white text-xs">${d.date||'—'}</td>
            <td class="py-2 px-3 text-red-300 font-bold text-xs">${Number(d.amount||0).toLocaleString('fa-IR')} ت</td>
            <td class="py-2 px-3 text-white text-xs">${d.reason||'—'}</td>
            <td class="py-2 px-3 text-center">
                <button onclick="EmployeeAccountingUI.deleteDeduction('${d.id}')" class="text-red-400 hover:text-red-300 text-xs"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('') : `<tr><td colspan="4" class="text-center py-3 text-white text-xs">کسوراتی ثبت نشده</td></tr>`;

        const giftBlock = gifts.length ? gifts.map(g=>`
        <tr class="border-b border-white/5">
            <td class="py-2 px-3 text-white text-xs">${g.date||'—'}</td>
            <td class="py-2 px-3 text-green-300 font-bold text-xs">${Number(g.amount||0).toLocaleString('fa-IR')} ت</td>
            <td class="py-2 px-3 text-white text-xs">${g.reason||'—'}</td>
        </tr>`).join('') : `<tr><td colspan="3" class="text-center py-3 text-white text-xs">هدیه‌ای ثبت نشده</td></tr>`;

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

                <!-- ═══ باکس‌های هدر کامل (همان باکس‌های صفحه اصلی) ═══ -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div class="bg-blue-500/10 border border-blue-400/20 rounded-xl p-3 text-center">
                        <i class="fas fa-paper-plane text-blue-400 mb-1 block text-sm"></i>
                        <p class="text-gray-400 text-xs mb-0.5">ساعات ارسال‌شده</p>
                        <p class="text-xl font-bold text-blue-400">${EmployeeAccountingModule.formatHoursDisplay(summary.totalHoursApprovedRaw ?? summary.totalHours)}</p>
                        <p class="text-gray-500 text-xs">${summary.hoursCount} گزارش · ${summary.workDays} روز</p>
                    </div>
                    <div class="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-3 text-center">
                        <i class="fas fa-check-circle text-emerald-400 mb-1 block text-sm"></i>
                        <p class="text-gray-400 text-xs mb-0.5">ساعات تأیید شده</p>
                        <p class="text-xl font-bold text-emerald-400">${EmployeeAccountingModule.formatHoursDisplay(summary.totalHoursApprovedRaw ?? summary.totalHoursApproved)}</p>
                        <p class="text-gray-500 text-xs">× ${EmployeeAccountingModule.formatCurrency(summary.hourlyRate)}/ساعت</p>
                    </div>
                    <div class="bg-orange-500/10 border border-orange-400/20 rounded-xl p-3 text-center">
                        <i class="fas fa-receipt text-orange-400 mb-1 block text-sm"></i>
                        <p class="text-gray-400 text-xs mb-0.5">هزینه‌های تأیید شده</p>
                        <p class="text-sm font-bold text-orange-400">${EmployeeAccountingModule.formatCurrency(summary.totalExpensesApproved)}</p>
                        <p class="text-gray-500 text-xs">${summary.expensesCount} مورد</p>
                    </div>
                    <div class="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <i class="fas fa-hand-holding-usd text-lime-400 mb-1 block text-sm"></i>
                        <p class="text-gray-400 text-xs mb-0.5">نرخ ساعتی</p>
                        <p class="text-sm font-bold text-white">${EmployeeAccountingModule.formatCurrency(summary.hourlyRate)}</p>
                        <p class="text-gray-500 text-xs">هر ساعت</p>
                    </div>
                    <div class="bg-red-500/10 border border-red-400/20 rounded-xl p-3 text-center">
                        <i class="fas fa-minus-circle text-red-400 mb-1 block text-sm"></i>
                        <p class="text-red-200 text-xs mb-0.5">جمع کسورات</p>
                        <p class="text-sm font-bold text-red-400">${EmployeeAccountingModule.formatCurrency(totalDed)}</p>
                    </div>
                    <div class="bg-green-500/10 border border-green-400/20 rounded-xl p-3 text-center">
                        <i class="fas fa-gift text-green-400 mb-1 block text-sm"></i>
                        <p class="text-green-200 text-xs mb-0.5">جمع هدایا</p>
                        <p class="text-sm font-bold text-green-400">${EmployeeAccountingModule.formatCurrency(totalGift)}</p>
                    </div>
                    <div class="bg-purple-500/10 border border-purple-400/20 rounded-xl p-3 text-center">
                        <i class="fas fa-wallet text-purple-400 mb-1 block text-sm"></i>
                        <p class="text-purple-200 text-xs mb-0.5">تسویه شده</p>
                        <p class="text-sm font-bold text-purple-400">${EmployeeAccountingModule.formatCurrency(totalPaid)}</p>
                    </div>
                    <div class="bg-lime-500/10 border border-lime-400/30 rounded-xl p-3 text-center">
                        <i class="fas fa-coins text-lime-400 mb-1 block text-sm"></i>
                        <p class="text-lime-200 text-xs mb-0.5">مانده پرداختنی</p>
                        <p class="text-lg font-bold text-lime-400">${EmployeeAccountingModule.formatCurrency(remaining)}</p>
                    </div>
                </div>

                <!-- سوابق کاری — ماه‌بندی شده با accordion -->
                <h4 style="color:#000000ff;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:14px;">
                    <i class="fas fa-calendar-alt" style="color:#a3e635;"></i>سوابق کاری
                    <span style="color:#000000ff;font-size:11px;font-weight:400;">(${entries.length} رکورد)</span>
                </h4>
                <div class="mb-5">
                    ${renderMonthlyAccordionManager(entries, employeeId)}
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
                <div class="overflow-x-auto mb-5">
                    <table class="w-full text-sm">
                        <thead><tr class="border-b border-white/10 text-xs">
                            <th class="text-right text-black-400 py-1 px-3">تاریخ</th>
                            <th class="text-right text-black-400 py-1 px-3">مبلغ</th>
                            <th class="text-right text-black-400 py-1 px-3">توضیحات</th>
                        </tr></thead>
                        <tbody>${giftBlock}</tbody>
                    </table>
                </div>

                <!-- درخواست‌های مهلت مجدد این کارمند -->
                ${(() => {
                    const empReqs = (() => { try { return JSON.parse(localStorage.getItem('work_late_requests')||'[]').filter(r=>r.employeeId===employeeId); } catch { return []; } })();
                    const pending = empReqs.filter(r=>r.status==='pending');
                    const others  = empReqs.filter(r=>r.status!=='pending');
                    const allReqs = [...pending, ...others];
                    const statusCls = { pending:'bg-lime-500/20 text-lime-400', approved:'bg-green-500/20 text-green-400', rejected:'bg-red-500/20 text-red-400' };
                    const statusTxt = { pending:'در انتظار', approved:'تأیید شد', rejected:'رد شد' };

                    const rows = allReqs.map(r=>`
                        <tr class="border-b border-white/5 hover:bg-white/5">
                            <td class="py-2 px-3 text-gray-600 text-xs">${r.requestedDate||'—'}</td>
                            <td class="py-2 px-3">
                                ${r.entryType==='expense'
                                    ? '<span class="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-xs">هزینه</span>'
                                    : '<span class="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">ساعت کاری</span>'}
                            </td>
                            <td class="py-2 px-3 text-white text-xs font-medium">
                                ${r.entryType==='expense'
                                    ? `${Number(r.amount||0).toLocaleString('fa-IR')} ت`
                                    : `${r.startTime||'?'} — ${r.endTime||'?'}`}
                            </td>
                            <td class="py-2 px-3 text-gray-400 text-xs max-w-xs">${r.reason||'—'}</td>
                            <td class="py-2 px-3 text-center">
                                <span class="${statusCls[r.status]||statusCls.pending} px-2 py-0.5 rounded-full text-xs">${statusTxt[r.status]||r.status}</span>
                            </td>
                            <td class="py-2 px-3 text-center">
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
                        </tr>`).join('');

                    return `
                    <h4 class="text-white font-semibold mb-2 flex items-center gap-2 text-sm">
                        <i class="fas fa-clock text-lime-400"></i>درخواست‌های مهلت مجدد
                        ${pending.length ? `<span class="bg-lime-500/30 text-lime-300 text-xs px-2 py-0.5 rounded-full">${pending.length} در انتظار</span>` : ''}
                    </h4>
                    <div class="overflow-x-auto">
                        ${allReqs.length ? `
                        <table class="w-full text-sm">
                            <thead><tr class="border-b border-white/10 text-xs">
                                <th class="text-right text-gray-400 py-1 px-3">تاریخ</th>
                                <th class="text-right text-gray-400 py-1 px-3">نوع</th>
                                <th class="text-right text-gray-400 py-1 px-3">مقدار</th>
                                <th class="text-right text-gray-400 py-1 px-3">دلیل</th>
                                <th class="text-center text-gray-400 py-1 px-3">وضعیت</th>
                                <th class="text-center text-gray-400 py-1 px-3">عملیات</th>
                            </tr></thead>
                            <tbody>${rows}</tbody>
                        </table>` : `<p class="text-center py-4 text-gray-500 text-xs">درخواستی ثبت نشده</p>`}
                    </div>`;
                })()}
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

        // تاریخ امروز و اول ماه به شمسی
        let d = new Date();
        try { d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' })); } catch(e) {}
        const todayJ = _toJalaliISO(d);
        const firstD = new Date(d.getFullYear(), d.getMonth(), 1);
        const firstJ  = _toJalaliISO(firstD);

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
                            <input type="hidden" id="emp-exp-from" value="${firstJ}">
                            <input type="text"
                                   id="emp-exp-from-jdp"
                                   data-jdp
                                   data-jdp-target-value-input="#emp-exp-from"
                                   data-jdp-target-value-type="jalali"
                                   value="${_fmtJalali(firstJ)}"
                                   placeholder="انتخاب تاریخ"
                                   autocomplete="off"
                                   readonly
                                   onclick="if(typeof jalaliDatepicker!=='undefined')jalaliDatepicker.show(this)"
                                   class="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none hover:border-green-400 cursor-pointer transition-colors">
                        </div>
                        <div>
                            <label class="text-gray-400 text-xs mb-1 block">تا تاریخ</label>
                            <input type="hidden" id="emp-exp-to" value="${todayJ}">
                            <input type="text"
                                   id="emp-exp-to-jdp"
                                   data-jdp
                                   data-jdp-target-value-input="#emp-exp-to"
                                   data-jdp-target-value-type="jalali"
                                   value="${_fmtJalali(todayJ)}"
                                   placeholder="انتخاب تاریخ"
                                   autocomplete="off"
                                   readonly
                                   onclick="if(typeof jalaliDatepicker!=='undefined')jalaliDatepicker.show(this)"
                                   class="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none hover:border-green-400 cursor-pointer transition-colors">
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
                    <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <p class="text-blue-300 text-xs flex items-center gap-2">
                            <i class="fas fa-info-circle"></i>
                            خروجی شامل <strong class="text-white">سه بخش</strong> است: خلاصه کارمندان، جزئیات کامل سوابق، و کسورات/هدایا
                        </p>
                    </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="EmployeeAccountingUI.doExportEmployeesCSV()"
                        class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-download ml-1"></i>دانلود Excel کامل
                    </button>
                    <button onclick="document.getElementById('emp-export-modal').remove()"
                        class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl">انصراف</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        // راه‌اندازی jalalidatepicker برای input های تاریخ
        setTimeout(function() {
            if (typeof jalaliDatepicker !== 'undefined' && typeof jalaliDatepicker.startWatch === 'function') {
                jalaliDatepicker.startWatch({ showTodayBtn: true, showEmptyBtn: true, showCloseBtn: true });
            }
        }, 50);
    }

    function doExportEmployeesCSV() {
        const from      = document.getElementById('emp-exp-from')?.value   || '';
        const to        = document.getElementById('emp-exp-to')?.value     || '';
        const statusFlt = document.getElementById('emp-exp-status')?.value || '';
        const selIds    = Array.from(document.getElementById('emp-exp-names')?.selectedOptions || []).map(o=>o.value);

        const settlements = (() => { try { return JSON.parse(localStorage.getItem('work_settlements')||'[]'); } catch { return []; } })();
        const deductions  = (() => { try { return JSON.parse(localStorage.getItem('work_deductions')||'[]'); } catch { return []; } })();
        const gifts       = (() => { try { return JSON.parse(localStorage.getItem('work_gifts')||'[]'); } catch { return []; } })();

        let summary = EmployeeAccountingModule.getAllEmployeesSummary(from||null, to||null);
        if (selIds.length) summary = summary.filter(e=>selIds.includes(e.employeeId));
        if (statusFlt==='has_pending') summary = summary.filter(e=>(e.pendingHours+e.pendingExpenses)>0);
        if (statusFlt==='no_pending')  summary = summary.filter(e=>(e.pendingHours+e.pendingExpenses)===0);

        const statusMap = { pending:'در انتظار', approved:'تأیید شده', rejected:'رد شده' };
        const escCell   = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        // ══════════════════════════════════════════════════
        // بخش ۱ — جدول خلاصه کارمندان
        // ══════════════════════════════════════════════════
        const summaryHeaders = [
            'نام کارمند','نرخ ساعتی (تومان)',
            'جمع ساعات ارسالی','ساعات تأیید شده','ساعات در انتظار','ساعات رد شده',
            'جمع هزینه ارسالی (تومان)','هزینه تأیید شده (تومان)','هزینه در انتظار (تومان)','هزینه رد شده (تومان)',
            'مبلغ ساعات تأیید (تومان)','جمع کل قابل پرداخت (تومان)',
            'جمع هدایا (تومان)','جمع کسورات (تومان)','تسویه شده (تومان)','مانده طلب (تومان)'
        ];

        const summaryRows = summary.map(emp => {
            const paid     = settlements.filter(s=>s.employeeId===emp.employeeId).reduce((s,r)=>s+Number(r.amount||0),0);
            const ded      = deductions.filter(d=>d.employeeId===emp.employeeId).reduce((s,d)=>s+Number(d.amount||0),0);
            const gift     = gifts.filter(g=>g.employeeId===emp.employeeId).reduce((s,g)=>s+Number(g.amount||0),0);

            // محاسبه دقیق ساعات/هزینه‌های هر وضعیت
            const allEnts  = WorkHoursModule.getAllEntriesByEmployee(emp.employeeId);
            const hoursAll = allEnts.filter(e=>e.type!=='expense');
            const expsAll  = allEnts.filter(e=>e.type==='expense');

            const hoursApproved = hoursAll.filter(e=>e.status==='approved').reduce((s,e)=>s+parseFloat(e.totalHours||0),0);
            const hoursPending  = hoursAll.filter(e=>e.status==='pending').reduce((s,e)=>s+parseFloat(e.totalHours||0),0);
            const hoursRejected = hoursAll.filter(e=>e.status==='rejected').reduce((s,e)=>s+parseFloat(e.totalHours||0),0);
            const hoursTotal    = hoursApproved + hoursPending + hoursRejected;

            const expsApproved  = expsAll.filter(e=>e.status==='approved').reduce((s,e)=>s+Number(e.amount||0),0);
            const expsPending   = expsAll.filter(e=>e.status==='pending').reduce((s,e)=>s+Number(e.amount||0),0);
            const expsRejected  = expsAll.filter(e=>e.status==='rejected').reduce((s,e)=>s+Number(e.amount||0),0);
            const expsTotal     = expsApproved + expsPending + expsRejected;

            const hoursAmount   = hoursApproved * (emp.hourlyRate || 0);
            const grandTotal    = hoursAmount + expsApproved;
            const remaining     = grandTotal + gift - ded - paid;

            return [
                emp.employeeName,
                emp.hourlyRate,
                +hoursTotal.toFixed(2), +hoursApproved.toFixed(2), +hoursPending.toFixed(2), +hoursRejected.toFixed(2),
                Math.round(expsTotal), Math.round(expsApproved), Math.round(expsPending), Math.round(expsRejected),
                Math.round(hoursAmount), Math.round(grandTotal),
                Math.round(gift), Math.round(ded), Math.round(paid), Math.round(remaining)
            ];
        });

        // ══════════════════════════════════════════════════
        // بخش ۲ — جدول جزئیات سوابق (همه ردیف‌ها)
        // ══════════════════════════════════════════════════
        const detailHeaders = [
            'نام کارمند','نوع سابقه','تاریخ',
            'ساعت شروع','ساعت پایان','مدت (ساعت)',
            'مبلغ هزینه (تومان)','شرح / توضیح','وضعیت'
        ];

        const detailRows = [];

        // ── نگاشت employeeId → نام کامل از لیست کارمندان ──
        const empNameMap = {};
        summary.forEach(emp => { empNameMap[emp.employeeId] = emp.employeeName; });
        // fallback از HARDCODED_USERS
        if (typeof HARDCODED_USERS !== 'undefined') {
            HARDCODED_USERS.forEach(u => { if (!empNameMap[u.id]) empNameMap[u.id] = u.name || u.username || u.id; });
        }
        try {
            JSON.parse(localStorage.getItem('edu_system_users') || '[]')
                .forEach(u => { if (!empNameMap[u.id]) empNameMap[u.id] = u.name || u.username || u.id; });
        } catch (_) {}

        // ── دریافت همه entries از localStorage/Supabase بدون فیلتر ──
        let allEntriesGlobal = [];
        try { allEntriesGlobal = WorkHoursModule.getWorkHours ? WorkHoursModule.getWorkHours() : []; } catch(_) {}

        // فیلتر بر اساس کارمندان انتخاب‌شده (selIds)
        if (selIds.length) {
            allEntriesGlobal = allEntriesGlobal.filter(e => selIds.includes(e.employeeId));
        }

        // فیلتر بازه تاریخ — مقایسه رشته‌ای با پشتیبانی از فرمت‌های مختلف
        function _normDate(d) { return String(d||'').trim().replace(/\//g,'-').replace(/[۰-۹]/g,c=>String.fromCharCode(c.charCodeAt(0)-1728)); }
        if (from) allEntriesGlobal = allEntriesGlobal.filter(e => _normDate(e.date) >= _normDate(from));
        if (to)   allEntriesGlobal = allEntriesGlobal.filter(e => _normDate(e.date) <= _normDate(to));

        // فیلتر وضعیت اگر لازم باشد (اختیاری — فقط روی summary اعمال می‌شد)
        // در بخش detail همه وضعیت‌ها را نشان می‌دهیم

        // مرتب‌سازی: نام کارمند → تاریخ → نوع
        allEntriesGlobal.sort((a,b) => {
            const na = empNameMap[a.employeeId] || a.employeeId || '';
            const nb = empNameMap[b.employeeId] || b.employeeId || '';
            if (na !== nb) return na.localeCompare(nb, 'fa');
            const da = _normDate(a.date), db = _normDate(b.date);
            if (da !== db) return da < db ? -1 : 1;
            if (a.type !== b.type) return a.type === 'expense' ? 1 : -1;
            return 0;
        });

        allEntriesGlobal.forEach(e => {
            const empName = empNameMap[e.employeeId] || e.employeeName || e.employeeId || 'نامشخص';
            detailRows.push([
                empName,
                e.type === 'expense' ? 'هزینه' : 'ساعت کاری',
                e.date || '—',
                e.type !== 'expense' ? (e.startTime || '—') : '',
                e.type !== 'expense' ? (e.endTime   || '—') : '',
                e.type !== 'expense' ? (parseFloat(e.totalHours||0).toFixed(2)) : '',
                e.type === 'expense' ? Math.round(e.amount||0) : '',
                e.description || '',
                statusMap[e.status] || e.status || ''
            ]);
        });

        // ══════════════════════════════════════════════════
        // بخش ۳ — جدول کسورات و هدایا
        // ══════════════════════════════════════════════════
        const adjHeaders = ['نام کارمند','نوع','تاریخ','مبلغ (تومان)','توضیح / علت'];
        const adjRows    = [];
        // استفاده از همه کارمندان (نه فقط فیلتر شده) برای کسورات/هدایا/تسویه
        const adjEmpIds = selIds.length ? selIds : Object.keys(empNameMap);
        adjEmpIds.forEach(empId => {
            const empName = empNameMap[empId] || empId;
            deductions.filter(d=>d.employeeId===empId).forEach(d =>
                adjRows.push([empName, 'کسورات', d.date||'—', Math.round(d.amount||0), d.reason||'']));
            gifts.filter(g=>g.employeeId===empId).forEach(g =>
                adjRows.push([empName, 'هدیه / پاداش', g.date||'—', Math.round(g.amount||0), g.reason||'']));
            settlements.filter(s=>s.employeeId===empId).forEach(s =>
                adjRows.push([empName, 'تسویه حساب', s.date||'—', Math.round(s.amount||0), s.note||'']));
        });

        // ══════════════════════════════════════════════════
        // ساخت فایل Excel با سه جدول در یک شیت
        // ══════════════════════════════════════════════════
        const dateRange = (from||'…') + ' تا ' + (to||'…');
        const thStyle   = 'background:#1a56db;color:#fff;padding:6px 10px;border:1px solid #ccc;white-space:nowrap;text-align:right;';
        const tdStyle   = 'padding:5px 10px;border:1px solid #ddd;white-space:nowrap;text-align:right;';
        const secStyle  = 'background:#0f2d6b;color:#a3e635;padding:8px 12px;font-size:13px;font-weight:bold;border:2px solid #1e8601ff;';

        function buildTable(headers, rows, emptyMsg) {
            const hRow = headers.map(h=>`<th style="${thStyle}">${escCell(h)}</th>`).join('');
            if (!rows.length) {
                return `<table style="border-collapse:collapse;width:100%;direction:rtl;margin-bottom:30px;">
                    <thead><tr>${hRow}</tr></thead>
                    <tbody><tr><td colspan="${headers.length}" style="${tdStyle}text-align:center;color:#999;">${emptyMsg}</td></tr></tbody>
                </table>`;
            }
            const dRows = rows.map(r =>
                '<tr>' + r.map((c,i) => {
                    // رنگ‌بندی ستون وضعیت
                    let extra = '';
                    if (headers[i] === 'وضعیت') {
                        if (c === 'تأیید شده') extra = 'color:#16a34a;font-weight:bold;';
                        else if (c === 'رد شده') extra = 'color:#dc2626;font-weight:bold;';
                        else if (c === 'در انتظار') extra = 'color:#2563eb;font-weight:bold;';
                    }
                    if (headers[i] === 'نوع سابقه' && c === 'هزینه') extra = 'color:#d97706;';
                    return `<td style="${tdStyle}${extra}">${escCell(c)}</td>`;
                }).join('') + '</tr>'
            ).join('\n');
            return `<table style="border-collapse:collapse;width:100%;direction:rtl;margin-bottom:30px;">
                <thead><tr>${hRow}</tr></thead>
                <tbody>${dRows}</tbody>
            </table>`;
        }

        const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Tahoma, Arial, sans-serif; direction: rtl; background:#fff; padding:20px; }
  h2   { color:#1a56db; margin:20px 0 6px; font-size:14px; }
  p.sub{ color:#666; font-size:11px; margin:0 0 8px; }
</style>
</head>
<body>

<h1 style="color:#0f2d6b;font-size:16px;margin-bottom:4px;">گزارش حسابداری کارمندان</h1>
<p style="color:#555;font-size:11px;margin:0 0 24px;">بازه: ${escCell(dateRange)} &nbsp;|&nbsp; تاریخ تهیه: ${new Date().toLocaleDateString('fa-IR')}</p>

<h2>▌ بخش اول — خلاصه مالی کارمندان</h2>
<p class="sub">یک ردیف به ازای هر کارمند — شامل جمع ساعات، هزینه‌ها و مانده</p>
${buildTable(summaryHeaders, summaryRows, 'هیچ کارمندی یافت نشد')}

<h2>▌ بخش دوم — جزئیات کامل سوابق (تمام ردیف‌های ارسالی)</h2>
<p class="sub">همه ساعات و هزینه‌های ارسال‌شده توسط کارمندان — تأیید شده، در انتظار، رد شده</p>
${buildTable(detailHeaders, detailRows, 'هیچ سابقه‌ای در این بازه یافت نشد')}

<h2>▌ بخش سوم — کسورات، هدایا و تسویه‌حساب</h2>
<p class="sub">تمام تعدیلات مالی ثبت‌شده برای کارمندان</p>
${buildTable(adjHeaders, adjRows, 'هیچ رکوردی ثبت نشده')}

</body>
</html>`;

        const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const a    = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = `حسابداری-کارمندان-${new Date().toISOString().substring(0,10)}.xls`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);

        document.getElementById('emp-export-modal')?.remove();
        showNotification(`فایل Excel دانلود شد — ${detailRows.length} ردیف جزئیات ✓`, 'success');
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
            <div class="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full border border-lime-500/30 shadow-2xl overflow-visible" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                        <i class="fas fa-calendar-alt text-lime-400"></i>تقویم کاری
                    </h3>
                    <button onclick="document.getElementById('work-calendar-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <p class="text-gray-600 text-sm mb-4">بازه تاریخ را انتخاب کنید تا سوابق کاری، هزینه‌ها و کسورات نمایش داده شوند.</p>
                <div class="grid grid-cols-2 gap-4 mb-5">
                    <div>
                        <label class="text-gray-400 text-sm mb-1 block">از تاریخ</label>
                        ${_buildJalaliInput('cal-from','cal-from-display', firstOfMonth)}
                    </div>
                    <div>
                        <label class="text-gray-400 text-sm mb-1 block">تا تاریخ</label>
                        ${_buildJalaliInput('cal-to','cal-to-display', today)}
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
        modal.addEventListener('click', e => { if (e.target === modal) { EAccJalali.close(); modal.remove(); } });
    }

    function applyCalendarFilter() {
        const from = document.getElementById('cal-from')?.value;
        const to   = document.getElementById('cal-to')?.value;
        if (!from || !to) { alert('لطفاً هر دو تاریخ را انتخاب کنید'); return; }

        const ju = window.JalaliUtils;
        const fromDisp = ju ? ju.toDisplay(from) : from;
        const toDisp   = ju ? ju.toDisplay(to)   : to;

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
                        <span class="text-gray-400"><i class="fas fa-clock ml-1"></i>${EmployeeAccountingModule.formatHoursDisplay(emp.totalHoursApprovedRaw ?? emp.totalHours)} ارسالی</span>
                        <span class="text-emerald-400"><i class="fas fa-check ml-1"></i>${EmployeeAccountingModule.formatHoursDisplay(emp.totalHoursApprovedRaw ?? emp.totalHoursApproved)} تأیید</span>
                        <span class="text-orange-400"><i class="fas fa-receipt ml-1"></i>${EmployeeAccountingModule.formatCurrency(emp.totalExpenses)} هزینه</span>
                        <span class="text-lime-400 font-bold"><i class="fas fa-wallet ml-1"></i>${EmployeeAccountingModule.formatCurrency(emp.grandTotal)} جمع کل</span>
                    </div>
                </div>
            </div>`).join('');

        const dedRows = deductions.length ? deductions.map(d=>`
            <div class="flex items-center justify-between bg-white/5 rounded-lg p-3 text-sm gap-2 flex-wrap">
                <span class="text-white">${d.employeeName||'—'}</span>
                <span class="text-gray-400 text-xs">${ju ? ju.toDisplay(d.date) : d.date}</span>
                <span class="text-red-400 font-bold">${Number(d.amount||0).toLocaleString('fa-IR')} ت</span>
                <span class="text-gray-400 text-xs">${d.reason||'—'}</span>
            </div>`).join('') : '<p class="text-gray-400 text-xs text-center py-2">کسوراتی در این بازه ثبت نشده</p>';

        const resultEl = document.getElementById('cal-result');
        if (resultEl) {
            resultEl.innerHTML = `
                <div class="border-t border-white/10 pt-4">
                    <h4 class="text-white font-semibold mb-3 text-sm flex items-center gap-2">
                        <i class="fas fa-chart-bar text-lime-400"></i>
                        گزارش بازه <span class="text-lime-300">${fromDisp}</span> تا <span class="text-lime-300">${toDisp}</span>
                    </h4>
                    ${rows || '<p class="text-gray-400 text-sm text-center py-4">رکوردی در این بازه یافت نشد</p>'}
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

        const modal = document.createElement('div');
        modal.id = 'late-request-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-blue-900 rounded-2xl p-6 max-w-lg w-full border border-lime-500/30 shadow-2xl overflow-visible" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-white text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-clock text-lime-400"></i>درخواست مهلت مجدد
                    </h3>
                    <button onclick="document.getElementById('late-request-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <p class="text-gray-400 text-sm mb-4">اگر ثبت ساعت کاری یا هزینه‌ای را فراموش کرده‌اید، اینجا درخواست دهید.</p>
                <div class="space-y-3">
                    <div>
                        <label class="text-gray-400 text-sm mb-1 block">تاریخ فراموش‌شده <span class="text-red-400">*</span></label>
                        <!-- hidden: مقدار میلادی که jalalidatepicker پر می‌کند -->
                        <input type="hidden" id="lr-date">
                        <!-- فیلد نمایشی شمسی — jalalidatepicker آن را مدیریت می‌کند -->
                        <input type="text"
                               id="lr-date-jdp"
                               data-jdp
                               data-jdp-target-value-input="#lr-date"
                               data-jdp-target-value-type="gregorian"
                               placeholder="انتخاب تاریخ شمسی"
                               autocomplete="off"
                               readonly
                               onclick="if(typeof jalaliDatepicker!=='undefined')jalaliDatepicker.show(this)"
                               class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400 cursor-pointer text-sm text-right">
                    </div>
                    <div>
                        <label class="text-gray-400 text-sm mb-1 block">نوع ثبت <span class="text-red-400">*</span></label>
                        <select id="lr-type" onchange="EmployeeAccountingUI._toggleLateRequestFields()"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                            <option value="work">ساعت کاری</option>
                            <option value="expense">هزینه</option>
                        </select>
                    </div>
                    <div id="lr-work-fields" class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-gray-400 text-sm mb-1 block">ساعت شروع</label>
                            <input type="text" id="lr-start" placeholder="08:00" maxlength="5"
                                oninput="this.value=this.value.replace(/[^0-9:]/g,''); if(this.value.length===2&&!this.value.includes(':'))this.value+=':';"
                                class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400 font-mono" dir="ltr">
                        </div>
                        <div>
                            <label class="text-gray-400 text-sm mb-1 block">ساعت پایان</label>
                            <input type="text" id="lr-end" placeholder="17:00" maxlength="5"
                                oninput="this.value=this.value.replace(/[^0-9:]/g,''); if(this.value.length===2&&!this.value.includes(':'))this.value+=':';"
                                class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400 font-mono" dir="ltr">
                        </div>
                    </div>
                    <div id="lr-expense-fields" class="hidden">
                        <label class="text-gray-400 text-sm mb-1 block">مبلغ هزینه (تومان)</label>
                        <input type="number" id="lr-amount" min="0" step="1000" placeholder="مثال: 200000"
                            class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none focus:border-lime-400">
                    </div>
                    <div>
                        <label class="text-gray-400 text-sm mb-1 block">دلیل فراموشی <span class="text-red-400">*</span></label>
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

        // راه‌اندازی jalalidatepicker برای input تاریخ modal
        if (typeof jalaliDatepicker !== 'undefined' && typeof jalaliDatepicker.startWatch === 'function') {
            setTimeout(function() {
                jalaliDatepicker.startWatch({ showTodayBtn: true, showEmptyBtn: true, showCloseBtn: true });
            }, 50);
        }
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
        const dateGreg = document.getElementById('lr-date')?.value;        // میلادی از jalalidatepicker
        const dateJdp  = document.getElementById('lr-date-jdp')?.value;    // شمسی نمایشی
        const type   = document.getElementById('lr-type')?.value;
        const reason = document.getElementById('lr-reason')?.value?.trim();

        if (!dateGreg || !reason) { alert('تاریخ و دلیل فراموشی الزامی است'); return; }

        // تبدیل میلادی به شمسی برای ذخیره‌سازی سازگار با بقیه سیستم
        let requestedDate = dateGreg;
        try {
            const ju = window.JalaliUtils;
            if (ju && ju.gregToJD && ju.jdToJalali) {
                const [y,m,d] = dateGreg.split('-').map(Number);
                const jd = ju.gregToJD(y, m, d);
                const [jy, jm, jday] = ju.jdToJalali(jd);
                const pad = n => n < 10 ? '0'+n : String(n);
                requestedDate = jy + '-' + pad(jm) + '-' + pad(jday);
            }
        } catch(e) { requestedDate = dateGreg; }

        const record = {
            id:            'lr_' + Date.now(),
            employeeId:    u.id   || '',
            employeeName:  u.name || '',
            requestedDate,
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

    // ══════════════════════════════════════════════════════════
    // ── دسترسی sidebar کارمند به حسابداری کارمندان ────────────
    // ══════════════════════════════════════════════════════════

    function _getAllowedIds() {
        try { return JSON.parse(localStorage.getItem('empAccAllowedIds') || '[]'); }
        catch { return []; }
    }

    function _saveAllowedIds(ids) {
        // از تابع مرکزی استفاده می‌کنیم که Alpine state رو از طریق CustomEvent آپدیت می‌کنه
        if (typeof window.setEmpAccAllowedIds === 'function') {
            window.setEmpAccAllowedIds(ids);
        } else {
            // fallback اگه تابع مرکزی هنوز لود نشده
            localStorage.setItem('empAccAllowedIds', JSON.stringify(ids));
            window.dispatchEvent(new CustomEvent('emp-acc-updated', { detail: { ids: ids } }));
        }
    }

    function hasSidebarAccess(employeeId) {
        return _getAllowedIds().includes(employeeId);
    }

    function toggleSidebarAccess(employeeId, employeeName, btn) {
        const ids = _getAllowedIds();
        const idx = ids.indexOf(employeeId);
        let granted = false;
        if (idx === -1) {
            ids.push(employeeId);
            granted = true;
        } else {
            ids.splice(idx, 1);
            granted = false;
        }
        _saveAllowedIds(ids);

        // sync به Supabase
        if (typeof SupabaseDataModule !== 'undefined' &&
            typeof SupabaseDataModule.setEmpAccAccess === 'function') {
            SupabaseDataModule.setEmpAccAccess(employeeId, granted)
                .then(ok => {
                    if (!ok) console.warn('⚠️ setEmpAccAccess ناموفق — migration را اجرا کنید');
                })
                .catch(e => console.warn('⚠️ setEmpAccAccess خطا:', e.message));
        }

        // آپدیت ظاهر دکمه بدون refresh کامل
        if (btn) {
            if (granted) {
                btn.className = 'px-2 py-1 rounded-lg text-xs transition-all bg-purple-500/40 text-purple-300 border border-purple-400/40';
                btn.innerHTML = '<i class="fas fa-toggle-on ml-1"></i>sidebar فعال';
            } else {
                btn.className = 'px-2 py-1 rounded-lg text-xs transition-all bg-white/5 text-gray-400 hover:bg-purple-500/20 hover:text-purple-300 border border-white/10';
                btn.innerHTML = '<i class="fas fa-toggle-off ml-1"></i>sidebar';
            }
        }

        const msg = granted
            ? `✅ دسترسی "${employeeName}" به صفحه حسابداری کارمندان فعال شد`
            : `❌ دسترسی "${employeeName}" حذف شد`;
        showNotification(msg, granted ? 'success' : 'info');
    }

    // ══════════════════════════════════════════════════════════
    // ── تقویم شمسی برای فیلتر Export ─────────────────────────
    // ══════════════════════════════════════════════════════════

    // تبدیل میلادی به شمسی ISO
    function _toJalaliISO(d) {
        if (typeof Jalali !== 'undefined' && Jalali.toJalaliISO) return Jalali.toJalaliISO(d);
        if (typeof Jalali !== 'undefined' && Jalali.toJalaali) {
            const j = Jalali.toJalaali(d.getFullYear(), d.getMonth()+1, d.getDate());
            return j.jy + '-' + String(j.jm).padStart(2,'0') + '-' + String(j.jd).padStart(2,'0');
        }
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }

    // تبدیل شمسی ISO به نمایش فارسی
    function _fmtJalali(str) {
        if (!str) return '—';
        const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
        const toFa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
        const p = str.split('-');
        if (p.length === 3) return `${toFa(+p[2])} ${MONTHS[+p[1]-1]||''} ${toFa(+p[0])}`;
        return str;
    }

    // باز کردن تقویم شمسی برای input مخفی Export
    function _openEmpExpPicker(hiddenId, dispBtnId) {
        const old = document.getElementById('__emp-exp-cal');
        if (old) { old.remove(); if (old.dataset.for === hiddenId) return; }

        const hidden = document.getElementById(hiddenId);
        const dispBtn = document.getElementById(dispBtnId);
        if (!hidden || !dispBtn) return;

        // تاریخ امروز شمسی
        let d = new Date();
        try { d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' })); } catch(e) {}
        const jTodayFull = (typeof Jalali !== 'undefined' && Jalali.toJalaali)
            ? Jalali.toJalaali(d.getFullYear(), d.getMonth()+1, d.getDate())
            : { jy: 1404, jm: 1, jd: 1 };

        let initY = jTodayFull.jy, initM = jTodayFull.jm;
        if (hidden.value) {
            const p = hidden.value.split('-');
            if (p.length === 3) { initY = +p[0]; initM = +p[1]; }
        }

        const popup = document.createElement('div');
        popup.id = '__emp-exp-cal';
        popup.dataset.for = hiddenId;
        popup.style.cssText = 'position:fixed;z-index:99999;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,.5);min-width:260px;direction:rtl;font-family:Vazirmatn,sans-serif;';
        document.body.appendChild(popup);

        const rect = dispBtn.getBoundingClientRect();
        popup.style.top = (rect.bottom + window.scrollY + 4) + 'px';
        let left = rect.left + window.scrollX;
        if (left + 270 > window.innerWidth) left = window.innerWidth - 275;
        popup.style.left = left + 'px';

        _renderEmpExpCal(hiddenId, dispBtnId, initY, initM, jTodayFull);

        setTimeout(() => {
            document.addEventListener('click', function closeOut(e) {
                const p2 = document.getElementById('__emp-exp-cal');
                if (p2 && !p2.contains(e.target) && e.target !== dispBtn) {
                    p2.remove();
                    document.removeEventListener('click', closeOut);
                }
            });
        }, 50);
    }

    function _renderEmpExpCal(hiddenId, dispBtnId, year, month, jToday) {
        const popup = document.getElementById('__emp-exp-cal');
        if (!popup) return;
        const MNAMES = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
        const days = month <= 6 ? 31 : month <= 11 ? 30 : 29;
        let firstDow = 0;
        if (typeof Jalali !== 'undefined' && Jalali.toGregorian) {
            const g = Jalali.toGregorian(year, month, 1);
            firstDow = (new Date(g.gy, g.gm-1, g.gd).getDay() + 1) % 7;
        }
        const prevM = month === 1 ? 12 : month-1, prevY = month === 1 ? year-1 : year;
        const nextM = month === 12 ? 1 : month+1, nextY = month === 12 ? year+1 : year;
        const toFa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
        const hidden = document.getElementById(hiddenId);
        let cells = '';
        for (let i = 0; i < firstDow; i++) cells += '<div></div>';
        for (let day = 1; day <= days; day++) {
            const jStr = year + '-' + String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0');
            const todayStr = jToday.jy + '-' + String(jToday.jm).padStart(2,'0') + '-' + String(jToday.jd).padStart(2,'0');
            const isSel = hidden && hidden.value === jStr;
            const isToday = jStr === todayStr;
            let cls = 'text-center py-1 rounded-lg text-xs cursor-pointer transition-all ';
            if (isSel) cls += 'bg-green-500 text-white font-bold';
            else if (isToday) cls += 'bg-blue-600 text-white font-bold';
            else cls += 'text-white hover:bg-slate-600';
            cells += `<div class="${cls}" onclick="EmployeeAccountingUI._pickEmpExpDate('${hiddenId}','${dispBtnId}','${jStr}')">${toFa(day)}</div>`;
        }
        popup.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <button onclick="EmployeeAccountingUI._renderEmpExpCal('${hiddenId}','${dispBtnId}',${prevY},${prevM},{jy:${jToday.jy},jm:${jToday.jm},jd:${jToday.jd}})"
                        style="background:#334155;border:none;color:#94a3b8;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:14px;">›</button>
                <span style="color:#e2e8f0;font-size:13px;font-weight:700;">${MNAMES[month-1]} ${toFa(year)}</span>
                <button onclick="EmployeeAccountingUI._renderEmpExpCal('${hiddenId}','${dispBtnId}',${nextY},${nextM},{jy:${jToday.jy},jm:${jToday.jm},jd:${jToday.jd}})"
                        style="background:#334155;border:none;color:#94a3b8;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:14px;">‹</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;">
                ${['ش','ی','د','س','چ','پ','ج'].map(d=>`<div style="text-align:center;font-size:10px;color:#64748b;">${d}</div>`).join('')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">${cells}</div>`;
    }

    function _pickEmpExpDate(hiddenId, dispBtnId, jStr) {
        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = jStr;
        const dispBtn = document.getElementById(dispBtnId);
        if (dispBtn) {
            const span = dispBtn.querySelector('span') || dispBtn;
            (span.tagName === 'SPAN' ? span : dispBtn).textContent = _fmtJalali(jStr);
            dispBtn.classList.add('border-green-400');
        }
        document.getElementById('__emp-exp-cal')?.remove();
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
        // refresh modal after approve/reject
        refreshDetailModal: function(employeeId) {
            document.getElementById('employee-details-modal')?.remove();
            setTimeout(function(){ showEmployeeDetails(employeeId); }, 80);
        },
        // sidebar access
        hasSidebarAccess,
        toggleSidebarAccess,
    };
})();

