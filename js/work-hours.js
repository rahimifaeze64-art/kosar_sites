/**
 * سیستم ساعات کاری
 * مدیریت ثبت و نمایش ساعات کاری کارمندان
 * ذخیره‌سازی: Supabase (اصلی) + localStorage (کش/آفلاین)
 */

const WorkHoursModule = (function() {
    'use strict';

    // کلید ذخیره‌سازی محلی
    const STORAGE_KEY = 'work_hours_data';

    // ── آیا Supabase در دسترس و آنلاین است؟ ─────────────────
    function _sb() {
        return typeof SupabaseDataModule !== 'undefined' &&
               typeof SupabaseConnection !== 'undefined' &&
               SupabaseConnection.isOnline === true
               ? SupabaseDataModule : null;
    }

    /**
     * دریافت لیست ساعات کاری
     * اگر Supabase آنلاین است → از ابر می‌خواند و localStorage را به‌روز می‌کند
     * در غیر این صورت → از localStorage می‌خواند
     */
    function getWorkHours() {
        const sb = _sb();
        if (sb) {
            // خواندن async از Supabase در پس‌زمینه و به‌روزرسانی cache
            sb.getWorkHours().then(entries => {
                if (entries && entries.length > 0) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
                }
            }).catch(e => console.warn('⚠️ WorkHoursModule.getWorkHours sync:', e.message));
        }
        // بازگشت فوری از localStorage (sync)
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('خطا در دریافت ساعات کاری:', error);
            return [];
        }
    }

    /**
     * دریافت async کامل از Supabase (برای مواردی که باید منتظر ماند)
     */
    async function getWorkHoursAsync() {
        const sb = _sb();
        if (sb) {
            try {
                const entries = await sb.getWorkHours();
                if (entries && entries.length >= 0) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
                    return entries;
                }
            } catch (e) {
                console.warn('⚠️ getWorkHoursAsync خطا:', e.message);
            }
        }
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    }
    
    /**
     * ذخیره کل لیست ساعات کاری (localStorage + Supabase در پس‌زمینه)
     */
    function saveWorkHours(hours) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(hours));
            return true;
        } catch (error) {
            console.error('خطا در ذخیره ساعات کاری:', error);
            return false;
        }
    }
    
    /**
     * افزودن ساعت کاری جدید — localStorage + Supabase
     */
    function addWorkHour(entry) {
        const newEntry = {
            id: Date.now().toString(),
            type: 'work',
            employeeId: entry.employeeId,
            employeeName: entry.employeeName,
            date: entry.date,
            startTime: entry.startTime,
            endTime: entry.endTime,
            description: entry.description,
            totalHours: calculateTotalHours(entry.startTime, entry.endTime),
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // ۱. ذخیره فوری در localStorage
        const hours = getWorkHours();
        hours.push(newEntry);
        saveWorkHours(hours);

        // ۲. ذخیره در Supabase در پس‌زمینه
        const sb = _sb();
        if (sb) {
            sb.saveWorkHour(newEntry)
              .then(ok => { if (ok) console.log('✅ ساعت کاری در Supabase ذخیره شد:', newEntry.id); })
              .catch(e => console.warn('⚠️ addWorkHour Supabase خطا:', e.message));
        } else {
            console.warn('📴 Supabase آفلاین — ساعت کاری فقط در localStorage ذخیره شد');
        }
        
        return newEntry;
    }
    
    /**
     * افزودن هزینه — localStorage + Supabase
     */
    function addExpense(entry) {
        const newEntry = {
            id: Date.now().toString(),
            type: 'expense',
            employeeId: entry.employeeId,
            employeeName: entry.employeeName,
            date: entry.date,
            amount: entry.amount,
            description: entry.description,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // ۱. ذخیره فوری در localStorage
        const hours = getWorkHours();
        hours.push(newEntry);
        saveWorkHours(hours);

        // ۲. ذخیره در Supabase در پس‌زمینه
        const sb = _sb();
        if (sb) {
            sb.saveWorkHour(newEntry)
              .then(ok => { if (ok) console.log('✅ هزینه در Supabase ذخیره شد:', newEntry.id); })
              .catch(e => console.warn('⚠️ addExpense Supabase خطا:', e.message));
        } else {
            console.warn('📴 Supabase آفلاین — هزینه فقط در localStorage ذخیره شد');
        }
        
        return newEntry;
    }
    
    /**
     * دریافت لیست هزینه‌ها
     */
    function getExpenses() {
        const allEntries = getWorkHours();
        return allEntries.filter(e => e.type === 'expense');
    }
    
    /**
     * ذخیره هزینه‌ها - دیگر نیازی نیست
     */
    function saveExpenses(expenses) {
        // این تابع دیگر استفاده نمی‌شود، همه در یک لیست هستند
        return true;
    }
    
    /**
     * ویرایش هزینه
     */
    function updateExpense(id, updates) {
        return updateWorkHour(id, updates); // استفاده از همان تابع ویرایش
    }
    
    /**
     * حذف هزینه
     */
    function deleteExpense(id) {
        return deleteWorkHour(id); // استفاده از همان تابع حذف
    }
    
    /**
     * دریافت هزینه‌های یک کارمند
     */
    function getExpensesByEmployee(employeeId) {
        const expenses = getExpenses();
        return expenses.filter(e => e.employeeId === employeeId);
    }
    
    /**
     * دریافت هزینه‌های در انتظار
     */
    function getPendingExpenses() {
        const expenses = getExpenses();
        return expenses.filter(e => e.status === 'pending');
    }
    
    /**
     * تأیید هزینه
     */
    function approveExpense(id) {
        return updateWorkHour(id, { status: 'approved' });
    }
    
    /**
     * رد هزینه
     */
    function rejectExpense(id, reason = '') {
        return updateWorkHour(id, { status: 'rejected', rejectReason: reason });
    }
    
    /**
     * ویرایش ساعت کاری — localStorage + Supabase
     */
    function updateWorkHour(id, updates) {
        const hours = getWorkHours();
        const index = hours.findIndex(h => h.id === id);
        
        if (index !== -1) {
            hours[index] = {
                ...hours[index],
                ...updates,
                totalHours: updates.startTime && updates.endTime 
                    ? calculateTotalHours(updates.startTime, updates.endTime)
                    : hours[index].totalHours,
                updatedAt: new Date().toISOString()
            };
            
            saveWorkHours(hours);

            // sync به Supabase در پس‌زمینه
            const sb = _sb();
            if (sb) {
                sb.saveWorkHour(hours[index])
                  .catch(e => console.warn('⚠️ updateWorkHour Supabase خطا:', e.message));
            }

            return hours[index];
        }
        
        return null;
    }
    
    /**
     * حذف ساعت کاری — localStorage + Supabase
     */
    function deleteWorkHour(id) {
        const hours = getWorkHours();
        const filtered = hours.filter(h => h.id !== id);
        saveWorkHours(filtered);

        // حذف از Supabase در پس‌زمینه
        const sb = _sb();
        if (sb && typeof sb.deleteWorkHour === 'function') {
            sb.deleteWorkHour(id)
              .catch(e => console.warn('⚠️ deleteWorkHour Supabase خطا:', e.message));
        }

        return true;
    }
    
    /**
     * محاسبه مجموع ساعات
     * خروجی: عدد اعشاری بر مبنای 60 (مثلاً ۱:۳۰ = 1.50 نه 1.30)
     * این فرمت برای ضرب در نرخ ساعتی صحیح است
     */
    function calculateTotalHours(startTime, endTime) {
        if (!startTime || !endTime) return 0;
        
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        
        const startMinutes = startH * 60 + startM;
        const endMinutes   = endH   * 60 + endM;
        
        const diffMinutes = endMinutes - startMinutes;
        
        if (diffMinutes <= 0) return 0;
        
        // بر مبنای 60 — 1.5 = یک ساعت و نیم
        return parseFloat((diffMinutes / 60).toFixed(4));
    }

    /**
     * تبدیل ساعت اعشاری به نمایش ساعت:دقیقه
     * مثال: 1.75 → "۱:۴۵"  |  2.5 → "۲:۳۰"
     */
    function formatHoursDisplay(decimalHours) {
        const h = parseFloat(decimalHours) || 0;
        const totalMin = Math.round(h * 60);
        const hours   = Math.floor(totalMin / 60);
        const minutes = totalMin % 60;
        const toFa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
        if (minutes === 0) return toFa(hours) + ' ساعت';
        return toFa(hours) + ':' + String(minutes).padStart(2,'0').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]) + ' ساعت';
    }
    
    /**
     * دریافت ساعات کاری بر اساس کارمند
     */
    function getWorkHoursByEmployee(employeeId) {
        const hours = getWorkHours();
        return hours.filter(h => h.employeeId === employeeId);
    }
    
    /**
     * دریافت ساعات کاری بر اساس تاریخ
     */
    function getWorkHoursByDate(date) {
        const hours = getWorkHours();
        return hours.filter(h => h.date === date);
    }
    
    /**
     * دریافت ساعات کاری در انتظار تأیید
     */
    function getPendingWorkHours() {
        const hours = getWorkHours();
        return hours.filter(h => h.status === 'pending' && h.type !== 'expense');
    }
    
    /**
     * دریافت تمام رکوردها (ساعات و هزینه‌ها) یک کارمند
     */
    function getAllEntriesByEmployee(employeeId) {
        const allEntries = getWorkHours();
        return allEntries.filter(e => e.employeeId === employeeId)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    
    /**
     * تأیید ساعت کاری
     */
    function approveWorkHour(id) {
        return updateWorkHour(id, { status: 'approved' });
    }
    
    /**
     * رد ساعت کاری
     */
    function rejectWorkHour(id, reason = '') {
        return updateWorkHour(id, { status: 'rejected', rejectReason: reason });
    }
    
    /**
     * محاسبه مجموع ساعات کاری یک کارمند
     */
    function getTotalHoursByEmployee(employeeId, startDate = null, endDate = null) {
        const hours = getWorkHoursByEmployee(employeeId);
        
        let filtered = hours.filter(h => h.status === 'approved');
        
        if (startDate) {
            filtered = filtered.filter(h => h.date >= startDate);
        }
        
        if (endDate) {
            filtered = filtered.filter(h => h.date <= endDate);
        }
        
        return filtered.reduce((sum, h) => sum + parseFloat(h.totalHours || 0), 0).toFixed(2);
    }
    
    /**
     * محاسبه مجموع ساعات کاری همه کارمندان
     */
    function getEmployeeHoursSummary() {
        const hours = getWorkHours();
        const summary = {};
        
        hours.forEach(h => {
            if (!summary[h.employeeId]) {
                summary[h.employeeId] = {
                    employeeId: h.employeeId,
                    employeeName: h.employeeName,
                    totalHours: 0,
                    entries: 0,
                    pending: 0,
                    approved: 0,
                    rejected: 0
                };
            }
            
            summary[h.employeeId].entries++;
            
            if (h.status === 'approved') {
                summary[h.employeeId].approved++;
                summary[h.employeeId].totalHours += parseFloat(h.totalHours || 0);
            } else if (h.status === 'pending') {
                summary[h.employeeId].pending++;
            } else if (h.status === 'rejected') {
                summary[h.employeeId].rejected++;
            }
        });
        
        return Object.values(summary);
    }
    
    /**
     * دریافت تاریخ شمسی
     */
    function getPersianDate(date = new Date()) {
        return (typeof Jalali !== 'undefined')
            ? Jalali.toJalaliDisplay(date, 'long')
            : date.toLocaleDateString('fa-IR', { year:'numeric', month:'long', day:'numeric' });
    }
    
    /**
     * دریافت تاریخ میلادی به فرمت YYYY-MM-DD
     */
    function formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // عمومی‌سازی توابع
    return {
        getWorkHours,
        getWorkHoursAsync,
        addWorkHour,
        updateWorkHour,
        deleteWorkHour,
        getWorkHoursByEmployee,
        getWorkHoursByDate,
        getPendingWorkHours,
        approveWorkHour,
        rejectWorkHour,
        getTotalHoursByEmployee,
        getEmployeeHoursSummary,
        calculateTotalHours,
        formatHoursDisplay,
        getPersianDate,
        formatDate,
        getAllEntriesByEmployee,
        // توابع هزینه‌ها
        getExpenses,
        addExpense,
        updateExpense,
        deleteExpense,
        getExpensesByEmployee,
        getPendingExpenses,
        approveExpense,
        rejectExpense
    };
})();

/**
 * رابط کاربری ساعات کاری
 */
const WorkHoursUI = (function() {
    'use strict';
    
    let currentUser = null;
    
    /**
     * راه‌اندازی اولیه
     */
    function init() {
        // دریافت کاربر فعلی از currentUser ذخیره شده توسط app.js
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
            } catch (e) {
                console.error('Error parsing currentUser:', e);
            }
        }
        
        console.log('WorkHoursUI initialized', currentUser);

        // re-init jalalidatepicker برای input‌های صفحه
        setTimeout(_reInitDatepicker, 0);
    }

    /**
     * آپدیت نمایش تاریخ‌ها — jalalidatepicker خودش مدیریت می‌کند
     * این تابع برای سازگاری با کدهای قدیمی نگه داشته شده
     */
    function _syncDateDisplayTexts() {
        _reInitDatepicker();
    }
    
    /**
     * محتوای صفحه کارمند
     */
    function getEmployeeContent() {
        if (!currentUser) {
            return '<p class="text-red-400">لطفاً وارد شوید</p>';
        }
        
        const allEntries = WorkHoursModule.getAllEntriesByEmployee(currentUser.id);
        const workHours = allEntries.filter(e => e.type === 'work' || !e.type);
        const totalHours = WorkHoursModule.getTotalHoursByEmployee(currentUser.id);
        const today = WorkHoursModule.formatDate(new Date());
        
        return `
            <div class="space-y-6">
                <!-- کارت‌های آمار -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-clock text-2xl text-black-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">کل ساعات تأیید شده شده</p>
                                <p class="text-3xl font-bold text-white">${WorkHoursModule.formatHoursDisplay(parseFloat(totalHours)||0)}</p>
                                <p class="text-black-300 text-xs">ساعت</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-lime-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-hourglass-half text-2xl text-lime-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">در انتظار تأیید</p>
                                <p class="text-3xl font-bold text-white">${workHours.filter(h => h.status === 'pending').length}</p>
                                <p class="text-black-300 text-xs">ثبت</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-check-circle text-2xl text-green-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">تأیید شده</p>
                                <p class="text-3xl font-bold text-white">${workHours.filter(h => h.status === 'approved').length}</p>
                                <p class="text-black-300 text-xs">ثبت</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- فرم ثبت ساعت کاری -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="fas fa-plus-circle text-emerald-400"></i>
                        ثبت ساعت کاری جدید
                    </h3>
                    
                    <form id="workHoursForm" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label class="block text-black-600 text-sm mb-2">تاریخ</label>
                            <input type="hidden" id="workDate">
                            <div class="flex gap-2">
                                <button type="button"
                                        id="workDate-disp-btn"
                                        onclick="WorkHoursUI.setQuickDate('workDate','workDate-disp-btn',-1)"
                                        class="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-3 text-white text-sm font-medium transition-all flex flex-col items-center gap-1">
                                    <i class="fas fa-calendar-minus text-yellow-400"></i>
                                    <span>پریروز</span>
                                    <span id="workDate-disp-text" class="text-xs text-gray-300 font-normal"></span>
                                </button>
                                <button type="button"
                                        onclick="WorkHoursUI.setQuickDate('workDate','workDate-disp-btn',-2)"
                                        class="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-3 text-white text-sm font-medium transition-all flex flex-col items-center gap-1">
                                    <i class="fas fa-calendar-times text-orange-400"></i>
                                    <span>دیروز</span>
                                    <span id="workDate-pdisp-text" class="text-xs text-gray-300 font-normal"></span>
                                </button>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-black-400 text-sm mb-2">ساعت شروع</label>
                            <input type="text" id="startTime"
                                   placeholder="مثال: 08:30"
                                   pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                                   maxlength="5"
                                   dir="ltr"
                                   oninput="this.value=this.value.replace(/[^0-9:]/g,''); if(this.value.length===2&&!this.value.includes(':'))this.value+=':';"
                                   onchange="WorkHoursUI.updateTotalHours()"
                                   class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 text-left font-mono"
                                   style="color-scheme:dark">
                        </div>
                        
                        <div>
                            <label class="block text-black-400 text-sm mb-2">ساعت پایان</label>
                            <input type="text" id="endTime"
                                   placeholder="مثال: 17:00"
                                   pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                                   maxlength="5"
                                   dir="ltr"
                                   oninput="this.value=this.value.replace(/[^0-9:]/g,''); if(this.value.length===2&&!this.value.includes(':'))this.value+=':';"
                                   onchange="WorkHoursUI.updateTotalHours()"
                                   class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 text-left font-mono"
                                   style="color-scheme:dark">
                        </div>
                        
                        <div class="md:col-span-2 lg:col-span-1">
                            <label class="block text-black-400 text-sm mb-2">ساعت کل</label>
                            <div id="totalHoursDisplay" class="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-2xl font-bold text-emerald-400 text-center">
                                0 ساعت
                            </div>
                        </div>
                        
                        <div class="md:col-span-2 lg:col-span-4">
                            <label class="block text-black-400 text-sm mb-2">شرح کار</label>
                            <textarea id="workDescription" rows="2" placeholder="توضیحاتی درباره کار انجام‌شده بنویسید..."
                                   class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400 resize-none"></textarea>
                        </div>
                        
                        <div class="md:col-span-2 lg:col-span-4 flex justify-end gap-3">
                            <button type="button" onclick="WorkHoursUI.resetForm()"
                                    class="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                                <i class="fas fa-redo ml-2"></i>پاک کردن
                            </button>
                            <button type="submit"
                                    class="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl transition-all font-medium">
                                <i class="fas fa-save ml-2"></i>ثبت ساعت کاری
                            </button>
                        </div>
                    </form>
                </div>

                <!-- ── بخش کسورات ── -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="fas fa-minus-circle text-red-400"></i>
                        کسورات
                    </h3>
                    <form id="deductionForm" onsubmit="WorkHoursUI.submitDeductionForm(event)">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label class="block text-black-400 text-sm mb-2">تاریخ کسر <span class="text-red-400">*</span></label>
                                <input type="hidden" id="deductionDate">
                                <div class="flex gap-2">
                                    <button type="button"
                                            id="deductionDate-disp-btn"
                                            onclick="WorkHoursUI.setQuickDate('deductionDate','deductionDate-disp-btn',-1)"
                                            class="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-3 text-white text-sm font-medium transition-all flex flex-col items-center gap-1">
                                        <i class="fas fa-calendar-minus text-yellow-400"></i>
                                        <span>پریروز</span>
                                        <span id="deductionDate-disp-text" class="text-xs text-gray-300 font-normal"></span>
                                    </button>
                                    <button type="button"
                                            onclick="WorkHoursUI.setQuickDate('deductionDate','deductionDate-disp-btn',-2)"
                                            class="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-3 text-white text-sm font-medium transition-all flex flex-col items-center gap-1">
                                        <i class="fas fa-calendar-times text-orange-400"></i>
                                        <span>دیروز</span>
                                        <span id="deductionDate-pdisp-text" class="text-xs text-gray-300 font-normal"></span>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label class="block text-black-400 text-sm mb-2">مبلغ کسر (تومان) <span class="text-red-400">*</span></label>
                                <input type="number" id="deductionAmount" required min="0" step="1000"
                                    placeholder="مثال: 500000"
                                    class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:border-red-400">
                            </div>
                            <div>
                                <label class="block text-black-400 text-sm mb-2">علت کسر <span class="text-red-400">*</span></label>
                                <input type="text" id="deductionReason" required
                                    placeholder="مثال: غیبت، تأخیر، جریمه..."
                                    class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:border-red-400">
                            </div>
                        </div>
                        <div class="flex justify-end">
                            <button type="submit"
                                class="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-xl transition-all font-medium">
                                <i class="fas fa-save ml-2"></i>ثبت کسر
                            </button>
                        </div>
                    </form>

                    <!-- لیست کسورات ثبت‌شده -->
                    <div class="mt-6" id="deductions-list">
                        ${typeof _renderDeductions === 'function' ? _renderDeductions() : ''}
                    </div>
                </div>

                <!-- فرم ثبت هزینه مستقل -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="fas fa-money-bill-wave text-orange-400"></i>
                        ثبت هزینه\u200cهای شرکت
                    </h3>
                    
                    <form id="expenseForm" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-black-400 text-sm mb-2">تاریخ</label>
                            <input type="hidden" id="expenseDate">
                            <div class="flex gap-2">
                                <button type="button"
                                        id="expenseDate-disp-btn"
                                        onclick="WorkHoursUI.setQuickDate('expenseDate','expenseDate-disp-btn',-1)"
                                        class="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-3 text-white text-sm font-medium transition-all flex flex-col items-center gap-1">
                                    <i class="fas fa-calendar-minus text-yellow-400"></i>
                                    <span>پریروز</span>
                                    <span id="expenseDate-disp-text" class="text-xs text-gray-300 font-normal"></span>
                                </button>
                                <button type="button"
                                        onclick="WorkHoursUI.setQuickDate('expenseDate','expenseDate-disp-btn',-2)"
                                        class="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-3 text-white text-sm font-medium transition-all flex flex-col items-center gap-1">
                                    <i class="fas fa-calendar-times text-orange-400"></i>
                                    <span>دیروز</span>
                                    <span id="expenseDate-pdisp-text" class="text-xs text-gray-300 font-normal"></span>
                                </button>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-black-400 text-sm mb-2">
                                <i class="fas fa-dollar-sign ml-1"></i>
                                مبلغ (تومان)
                            </label>
                            <input type="number" id="expenseAmount" min="0" step="1000" placeholder="مبلغ را وارد کنید"
                                   class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400">
                        </div>
                        
                        <div>
                            <label class="block text-black-400 text-sm mb-2">شرح هزینه</label>
                            <input type="text" id="expenseDescription" placeholder="مثال: بنزین، پارکینگ، غذا..."
                                   class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400">
                        </div>
                        
                        <div class="md:col-span-3 flex justify-end gap-3">
                            <button type="button" onclick="WorkHoursUI.resetExpenseForm()"
                                    class="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                                <i class="fas fa-redo ml-2"></i>پاک کردن
                            </button>
                            <button type="submit"
                                    class="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl transition-all font-medium">
                                <i class="fas fa-save ml-2"></i>ثبت هزینه
                            </button>
                        </div>
                    </form>
                </div>
                
                <!-- لیست ساعات کاری -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-bold text-white flex items-center gap-2">
                            <i class="fas fa-list text-black-400"></i>
                            سوابق کاری
                        </h3>
                        
                        <div class="flex gap-2">
                            <select id="filterType" onchange="WorkHoursUI.filterEntries()"
                                    class="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                                <option value="all">همه</option>
                                <option value="hours">ساعات کاری</option>
                                <option value="expenses">هزینه‌ها</option>
                            </select>
                            <select id="filterStatus" onchange="WorkHoursUI.filterEntries()"
                                    class="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                                <option value="all">همه وضعیت‌ها</option>
                                <option value="pending">در انتظار</option>
                                <option value="approved">تأیید شده</option>
                                <option value="rejected">رد شده</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/10">
                                    <th class="text-right text-black-400 font-medium py-3 px-4">نوع</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">تاریخ</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">ساعت شروع</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">ساعت پایان</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">ساعت کل</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">مبلغ</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">شرح</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">وضعیت</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">عملیات</th>
                                </tr>
                            </thead>
                            <tbody id="workHoursList">
                                ${renderAllEntriesList(allEntries)}
                            </tbody>
                        </table>
                    </div>
                    
                    ${allEntries.length === 0 ? `
                        <div class="text-center py-12">
                            <i class="fas fa-clock text-5xl text-black-400/30 mb-4"></i>
                            <p class="text-black-400">هنوز رکوردی ثبت نشده است</p>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- پیام‌های رد از مدیر -->
            ${_renderRejectMessagesForEmployee(currentUser.id)}
        `;
    }
    /**
     * رندر پیام‌های رد برای کارمند
     */
    function _renderRejectMessagesForEmployee(employeeId) {
        const msgs = (() => {
            try { return JSON.parse(localStorage.getItem('work_reject_messages')||'[]'); } catch { return []; }
        })().filter(m => m.employeeId === employeeId && m.canResubmit && !m.resubmitted);

        if (!msgs.length) return '';

        const rows = msgs.map(m => `
            <div class="bg-red-500/10 border border-red-400/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded-full font-bold">رد شده</span>
                        <span class="text-white text-sm font-medium">
                            ${m.entryType==='expense'?'هزینه':'ساعت کاری'} — تاریخ ${m.entryDate||''}
                        </span>
                    </div>
                    <p class="text-red-200 text-sm"><i class="fas fa-comment-alt ml-1"></i>${m.reason||'—'}</p>
                    <p class="text-gray-400 text-xs mt-1">لطفاً با توجه به توضیحات مدیر، ثبت مجدد کنید</p>
                </div>
                <button onclick="WorkHoursUI.resubmitEntry('${m.id}', '${m.entryType}', '${m.entryDate}')"
                    class="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 border border-blue-400/30 rounded-xl text-sm transition-all flex-shrink-0">
                    <i class="fas fa-redo ml-1"></i>ارسال مجدد
                </button>
            </div>`).join('');

        return `
        <div class="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-red-400/20">
            <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <i class="fas fa-exclamation-circle text-red-400"></i>
                پیام‌های مدیر — نیاز به اصلاح
                <span class="bg-red-500/20 text-red-300 text-sm px-2 py-0.5 rounded-full">${msgs.length}</span>
            </h3>
            <div class="space-y-3">${rows}</div>
        </div>`;
    }

    /**
     * ارسال مجدد ورودی رد شده
     */
    function resubmitEntry(msgId, entryType, entryDate) {
        // علامت‌گذاری پیام به عنوان resubmitted
        const msgs = (() => {
            try { return JSON.parse(localStorage.getItem('work_reject_messages')||'[]'); } catch { return []; }
        })();
        const msg = msgs.find(m => m.id === msgId);
        if (msg) {
            msg.resubmitted = true;
            localStorage.setItem('work_reject_messages', JSON.stringify(msgs));
        }

        // پر کردن فرم با تاریخ مورد نظر و اسکرول
        if (entryType === 'expense') {
            const expDateEl = document.getElementById('expenseDate');
            const expJdpEl  = document.getElementById('expenseDate-jdp');
            if (expDateEl) expDateEl.value = entryDate || '';
            if (expJdpEl && entryDate) expJdpEl.value = _wh_jalaliDisplay(entryDate) || entryDate;
            // اسکرول به فرم هزینه
            document.getElementById('expenseForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showNotification('تاریخ فرم هزینه تنظیم شد — اطلاعات را ویرایش و ارسال کنید', 'info');
        } else {
            const workDateEl = document.getElementById('workDate');
            const workJdpEl  = document.getElementById('workDate-jdp');
            if (workDateEl) workDateEl.value = entryDate || '';
            if (workJdpEl && entryDate) workJdpEl.value = _wh_jalaliDisplay(entryDate) || entryDate;
            document.getElementById('workHoursForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showNotification('تاریخ فرم ساعت کاری تنظیم شد — اطلاعات را ویرایش و ارسال کنید', 'info');
        }

        refreshContent();
    }

    /**
     * محتوای صفحه مدیر
     */
    function getManagerContent() {
        const summary = WorkHoursModule.getEmployeeHoursSummary();
        const pendingHours = WorkHoursModule.getPendingWorkHours();
        const pendingExpenses = WorkHoursModule.getPendingExpenses();
        
        return `
            <div class="space-y-6">
                <!-- کارت‌های آمار -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-lime-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-users text-2xl text-lime-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">تعداد کارمندان</p>
                                <p class="text-3xl font-bold text-white">${summary.length}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-lime-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-hourglass-half text-2xl text-lime-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">در انتظار تأیید</p>
                                <p class="text-3xl font-bold text-white">${pendingHours.length + pendingExpenses.length}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-check-circle text-2xl text-green-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">تأیید شده</p>
                                <p class="text-3xl font-bold text-white">${summary.reduce((sum, s) => sum + s.approved, 0)}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-clock text-2xl text-black-400"></i>
                            </div>
                            <div>
                                <p class="text-black-400 text-sm">کل ساعات</p>
                                <p class="text-3xl font-bold text-white">${WorkHoursModule.formatHoursDisplay(summary.reduce((sum, s) => sum + s.totalHours, 0))}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- درخواست‌های ساعات کاری در انتظار -->
                ${pendingHours.length > 0 ? `
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <i class="fas fa-clock text-lime-400"></i>
                            ساعات کاری در انتظار تأیید
                        </h3>
                        
                        <div class="space-y-4">
                            ${pendingHours.map(entry => `
                                <div class="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between">
                                    <div class="flex items-center gap-4">
                                        <div class="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                                            <i class="fas fa-user text-black-400"></i>
                                        </div>
                                        <div>
                                            <p class="text-white font-medium">${entry.employeeName}</p>
                                            <p class="text-black-400 text-sm">${typeof Jalali!=='undefined' ? Jalali.displayDate(entry.date) : entry.date} | ${entry.startTime || '-'} - ${entry.endTime || '-'}</p>
                                            <p class="text-black-300 text-xs">${WorkHoursModule.formatHoursDisplay(parseFloat(entry.totalHours||0))} ساعت</p>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-center gap-3">
                                        <div class="text-left max-w-xs">
                                            <p class="text-black-400 text-sm truncate">${entry.description || '-'}</p>
                                        </div>
                                        
                                        <button onclick="WorkHoursUI.approveEntry('${entry.id}')"
                                                class="w-10 h-10 bg-green-500/20 hover:bg-green-500/40 rounded-lg flex items-center justify-center text-green-400 transition-all"
                                                title="تأیید">
                                            <i class="fas fa-check"></i>
                                        </button>
                                        
                                        <button onclick="WorkHoursUI.rejectEntry('${entry.id}')"
                                                class="w-10 h-10 bg-red-500/20 hover:bg-red-500/40 rounded-lg flex items-center justify-center text-red-400 transition-all"
                                                title="رد">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- درخواست‌های هزینه در انتظار -->
                ${pendingExpenses.length > 0 ? `
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <i class="fas fa-dollar-sign text-orange-400"></i>
                            هزینه‌های در انتظار تأیید
                        </h3>
                        
                        <div class="space-y-4">
                            ${pendingExpenses.map(entry => `
                                <div class="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between">
                                    <div class="flex items-center gap-4">
                                        <div class="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                                            <i class="fas fa-money-bill-wave text-orange-400"></i>
                                        </div>
                                        <div>
                                            <p class="text-white font-medium">${entry.employeeName}</p>
                                            <p class="text-black-400 text-sm">${typeof Jalali!=='undefined' ? Jalali.displayDate(entry.date) : entry.date}</p>
                                            <p class="text-orange-400 text-lg font-bold">${entry.amount ? entry.amount.toLocaleString('fa-IR') : 0} تومان</p>
                                            ${entry.description ? `<p class="text-black-300 text-xs mt-1">${entry.description}</p>` : ''}
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-center gap-3">
                                        <button onclick="WorkHoursUI.approveEntry('${entry.id}')"
                                                class="w-10 h-10 bg-green-500/20 hover:bg-green-500/40 rounded-lg flex items-center justify-center text-green-400 transition-all"
                                                title="تأیید">
                                            <i class="fas fa-check"></i>
                                        </button>
                                        
                                        <button onclick="WorkHoursUI.rejectEntry('${entry.id}')"
                                                class="w-10 h-10 bg-red-500/20 hover:bg-red-500/40 rounded-lg flex items-center justify-center text-red-400 transition-all"
                                                title="رد">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- جدول ساعات کارمندان -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="fas fa-table text-black-400"></i>
                        خلاصه ساعات کارمندان
                    </h3>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/10">
                                    <th class="text-right text-black-400 font-medium py-3 px-4">نام کارمند</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">کل ساعات</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">تعداد ثبت</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">تأیید شده</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">در انتظار</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">رد شده</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${summary.length > 0 ? summary.map(emp => `
                                    <tr class="border-b border-white/5 hover:bg-white/5">
                                        <td class="py-4 px-4">
                                            <div class="flex items-center gap-3">
                                                <div class="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                                    <i class="fas fa-user text-black-400"></i>
                                                </div>
                                                <span class="text-white font-medium">${emp.employeeName}</span>
                                            </div>
                                        </td>
                                        <td class="text-center py-4 px-4">
                                            <span class="text-2xl font-bold text-emerald-400">${WorkHoursModule.formatHoursDisplay(emp.totalHours)}</span>
                                            <span class="text-black-300 text-sm"> ساعت</span>
                                        </td>
                                        <td class="text-center py-4 px-4 text-white">${emp.entries}</td>
                                        <td class="text-center py-4 px-4">
                                            <span class="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">${emp.approved}</span>
                                        </td>
                                        <td class="text-center py-4 px-4">
                                            <span class="bg-lime-500/20 text-lime-400 px-3 py-1 rounded-full text-sm">${emp.pending}</span>
                                        </td>
                                        <td class="text-center py-4 px-4">
                                            <span class="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">${emp.rejected}</span>
                                        </td>
                                        <td class="text-center py-4 px-4">
                                            <button onclick="WorkHoursUI.viewEmployeeDetails('${emp.employeeId}')"
                                                    class="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 text-black-400 rounded-lg text-sm transition-all">
                                                <i class="fas fa-eye ml-1"></i>مشاهده
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="7" class="text-center py-12">
                                            <i class="fas fa-users text-5xl text-black-400/30 mb-4"></i>
                                            <p class="text-black-400">هنوز ساعتی ثبت نشده است</p>
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- جدول هزینه‌های کارمندان -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="fas fa-money-bill-wave text-orange-400"></i>
                        هزینه‌های کارمندان
                    </h3>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/10">
                                    <th class="text-right text-black-400 font-medium py-3 px-4">نام کارمند</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">تاریخ</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">مبلغ</th>
                                    <th class="text-right text-black-400 font-medium py-3 px-4">شرح</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">وضعیت</th>
                                    <th class="text-center text-black-400 font-medium py-3 px-4">عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderExpensesList()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ── جدول کسورات کارمندان ── -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <h3 class="text-xl font-bold text-white flex items-center gap-2">
                            <i class="fas fa-minus-circle text-red-400"></i>
                            کسورات کارمندان
                        </h3>
                        <button onclick="WorkHoursUI.showAddDeductionForEmployeeModal()"
                            class="bg-red-600 hover:bg-red-500 text-white text-sm px-4 py-2 rounded-xl transition-all flex items-center gap-2">
                            <i class="fas fa-plus"></i> ثبت کسر جدید
                        </button>
                    </div>
                    ${_renderManagerDeductions()}
                </div>

            </div>
        `;
    }
    
    /**
     * رندر لیست هزینه‌ها برای مدیر
     */
    function renderExpensesList() {
        const allExpenses = WorkHoursModule.getExpenses();
        
        if (allExpenses.length === 0) {
            return `
                <tr>
                    <td colspan="6" class="text-center py-12">
                        <i class="fas fa-money-bill-wave text-5xl text-orange-400/30 mb-4"></i>
                        <p class="text-black-400">هنوز هزینه‌ای ثبت نشده است</p>
                    </td>
                </tr>
            `;
        }
        
        const statusColors = {
            pending: 'bg-lime-500/20 text-lime-400',
            approved: 'bg-green-500/20 text-green-400',
            rejected: 'bg-red-500/20 text-red-400'
        };
        
        const statusTexts = {
            pending: 'در انتظار',
            approved: 'تأیید شده',
            rejected: 'رد شده'
        };
        
        return allExpenses.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(expense => `
            <tr class="border-b border-white/5 hover:bg-white/5">
                <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                            <i class="fas fa-user text-orange-400"></i>
                        </div>
                        <span class="text-white font-medium">${expense.employeeName}</span>
                    </div>
                </td>
                <td class="py-4 px-4 text-white">${typeof Jalali!=='undefined' ? Jalali.displayDate(expense.date) : expense.date}</td>
                <td class="py-4 px-4">
                    <span class="text-xl font-bold text-orange-400">${expense.amount ? expense.amount.toLocaleString('fa-IR') : 0}</span>
                    <span class="text-black-300 text-sm"> تومان</span>
                </td>
                <td class="py-4 px-4 text-black-400 max-w-xs" title="${expense.description || '-'}">
                    ${expense.description || '-'}
                </td>
                <td class="text-center py-4 px-4">
                    <span class="${statusColors[expense.status]} px-3 py-1 rounded-full text-sm">
                        ${statusTexts[expense.status]}
                    </span>
                </td>
                <td class="text-center py-4 px-4">
                    ${expense.status === 'pending' ? `
                        <div class="flex items-center justify-center gap-2">
                            <button onclick="WorkHoursUI.approveEntry('${expense.id}')"
                                    class="px-3 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg text-sm transition-all"
                                    title="تأیید">
                                <i class="fas fa-check ml-1"></i>تأیید
                            </button>
                            <button onclick="WorkHoursUI.rejectEntry('${expense.id}')"
                                    class="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-sm transition-all"
                                    title="رد">
                                <i class="fas fa-times ml-1"></i>رد
                            </button>
                        </div>
                    ` : `
                        <span class="text-gray-400">-</span>
                    `}
                </td>
            </tr>
        `).join('');
    }
    
    /**
     * رندر لیست تمام ورودی‌ها (ساعات و هزینه‌ها)
     */
    function renderAllEntriesList(entries) {
        return entries.map(entry => {
            const statusColors = {
                pending: 'bg-lime-500/20 text-lime-400',
                approved: 'bg-green-500/20 text-green-400',
                rejected: 'bg-red-500/20 text-red-400'
            };
            
            const statusTexts = {
                pending: 'در انتظار',
                approved: 'تأیید شده',
                rejected: 'رد شده'
            };
            
            const isExpense = entry.type === 'expense';
            
            return `
                <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="py-3 px-4">
                        ${isExpense ? 
                            '<span class="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs"><i class="fas fa-dollar-sign ml-1"></i>هزینه</span>' : 
                            '<span class="bg-blue-500/20 text-black-400 px-2 py-1 rounded text-xs"><i class="fas fa-clock ml-1"></i>ساعت کاری</span>'
                        }
                    </td>
                    <td class="py-3 px-4 text-white">${typeof Jalali!=='undefined' ? Jalali.displayDate(entry.date) : entry.date}</td>
                    <td class="py-3 px-4 text-white">${isExpense ? '-' : (entry.startTime || '-')}</td>
                    <td class="py-3 px-4 text-white">${isExpense ? '-' : (entry.endTime || '-')}</td>
                    <td class="py-3 px-4 text-emerald-400 font-bold">${isExpense ? '-' : (entry.totalHours || '-')}</td>
                    <td class="py-3 px-4">
                        ${isExpense ? `
                            <div class="text-orange-400 font-medium">
                                ${entry.amount ? entry.amount.toLocaleString('fa-IR') : '0'} تومان
                            </div>
                        ` : '<span class="text-gray-500">-</span>'}
                    </td>
                    <td class="py-3 px-4 text-black-400 max-w-xs truncate" title="${entry.description || '-'}">${entry.description || '-'}</td>
                    <td class="py-3 px-4">
                        <span class="${statusColors[entry.status]} px-3 py-1 rounded-full text-sm">
                            ${statusTexts[entry.status]}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        ${entry.status === 'pending' ? `
                            <button onclick="WorkHoursUI.deleteEntry('${entry.id}')"
                                    class="text-red-400 hover:text-red-300 transition-all" title="حذف">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    /**
     * رندر لیست ساعات کاری (برای مدیر)
     */
    function renderWorkHoursList(hours) {
        return hours.map(entry => {
            const statusColors = {
                pending: 'bg-lime-500/20 text-lime-400',
                approved: 'bg-green-500/20 text-green-400',
                rejected: 'bg-red-500/20 text-red-400'
            };
            
            const statusTexts = {
                pending: 'در انتظار',
                approved: 'تأیید شده',
                rejected: 'رد شده'
            };
            
            return `
                <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="py-3 px-4 text-white">${typeof Jalali!=='undefined' ? Jalali.displayDate(entry.date) : entry.date}</td>
                    <td class="py-3 px-4 text-white">${entry.startTime || '-'}</td>
                    <td class="py-3 px-4 text-white">${entry.endTime || '-'}</td>
                    <td class="py-3 px-4 text-emerald-400 font-bold">${entry.totalHours || '-'}</td>
                    <td class="py-3 px-4">
                        <span class="${statusColors[entry.status]} px-3 py-1 rounded-full text-sm">
                            ${statusTexts[entry.status]}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-black-400 max-w-xs truncate">${entry.description || '-'}</td>
                </tr>
            `;
        }).join('');
    }
    
    /**
     * ثبت فرم
     */
    /**
     * ثبت فرم ساعات کاری
     */
    function submitForm() {
        // hidden: مقدار میلادی از jalalidatepicker (فرمت YYYY-MM-DD)
        // jdp input: مقدار شمسی نمایشی
        const hiddenInput = document.getElementById('workDate');
        const jdpInput    = document.getElementById('workDate-jdp');

        let rawDate = hiddenInput ? hiddenInput.value : '';
        // اگه hidden خالیه، از jdp input بخوان (شمسی)
        if (!rawDate && jdpInput && jdpInput.value) {
            rawDate = jdpInput.value; // شمسی — _toJalaliISOSafe خودش normalize می‌کنه
        }

        // تبدیل به تاریخ شمسی YYYY-MM-DD برای ذخیره‌سازی
        let date = _toJalaliISOSafe(rawDate);

        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const description = (document.getElementById('workDescription')?.value || '').trim();

        console.log('[WorkHours] submit → rawDate:', rawDate, '→ jalali:', date, '| startTime:', startTime, '| endTime:', endTime);

        if (!date || !startTime || !endTime) {
            showNotification('لطفاً تمام فیلدها را پر کنید', 'error');
            return;
        }

        if (startTime >= endTime) {
            showNotification('ساعت پایان باید بزرگتر از ساعت شروع باشد', 'error');
            return;
        }

        // بررسی یک‌بار ارسال در روز برای ساعت کاری
        const existing = WorkHoursModule.getAllEntriesByEmployee(currentUser.id)
            .filter(e => (e.type === 'work' || !e.type) && e.date === date && e.status !== 'rejected');
        if (existing.length > 0) {
            showNotification('برای این تاریخ قبلاً ساعت کاری ارسال شده است. فقط یک ارسال در هر روز مجاز است.', 'error');
            return;
        }

        const entry = {
            employeeId:   currentUser.id,
            employeeName: currentUser.name || currentUser.username || 'کارمند',
            date, startTime, endTime, description
        };

        const result = WorkHoursModule.addWorkHour(entry);
        if (result) {
            showNotification('ساعت کاری با موفقیت ثبت شد', 'success');
            resetForm();
            refreshContent();
        } else {
            showNotification('خطا در ثبت ساعت کاری', 'error');
        }
    }

    /**
     * ثبت فرم هزینه‌ها
     */
    function submitExpenseForm() {
        const hiddenInput = document.getElementById('expenseDate');
        const jdpInput    = document.getElementById('expenseDate-jdp');

        let rawDate = hiddenInput ? hiddenInput.value : '';
        if (!rawDate && jdpInput && jdpInput.value) {
            rawDate = jdpInput.value;
        }

        // تبدیل به شمسی برای ذخیره
        let date = _toJalaliISOSafe(rawDate);

        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const description = document.getElementById('expenseDescription').value;

        if (!date || !amount || amount <= 0) {
            showNotification('لطفاً تمام فیلدها را به درستی پر کنید', 'error');
            return;
        }

        // بررسی یک‌بار ارسال در روز برای هزینه
        const existingExp = WorkHoursModule.getAllEntriesByEmployee(currentUser.id)
            .filter(e => e.type === 'expense' && e.date === date && e.status !== 'rejected');
        if (existingExp.length > 0) {
            showNotification('برای این تاریخ قبلاً هزینه ارسال شده است. فقط یک ارسال در هر روز مجاز است.', 'error');
            return;
        }

        const entry = {
            employeeId:   currentUser.id,
            employeeName: currentUser.name || currentUser.username || 'کارمند',
            date, amount, description
        };

        const result = WorkHoursModule.addExpense(entry);
        if (result) {
            showNotification('هزینه با موفقیت ثبت شد', 'success');
            resetExpenseForm();
            refreshContent();
        } else {
            showNotification('خطا در ثبت هزینه', 'error');
        }
    }
    
    /**
     * بازنشانی فرم ساعات کاری
     */
    function resetForm() {
        document.getElementById('workHoursForm')?.reset();
        document.getElementById('totalHoursDisplay').textContent = '0 ساعت';
        // clear hidden date و reset دکمه‌ها
        var wdHidden = document.getElementById('workDate');
        if (wdHidden) wdHidden.value = '';
        var dt = document.getElementById('workDate-disp-text');
        var pt = document.getElementById('workDate-pdisp-text');
        if (dt) dt.textContent = '';
        if (pt) pt.textContent = '';
        // reset هایلایت دکمه‌ها
        var container = wdHidden ? wdHidden.parentElement : null;
        if (container) container.querySelectorAll('button[type="button"]').forEach(function(b){
            b.classList.remove('ring-2','ring-lime-400','ring-orange-400','bg-white/30');
            b.classList.add('bg-white/10');
        });
    }
    
    /**
     * بازنشانی فرم هزینه‌ها
     */
    function resetExpenseForm() {
        document.getElementById('expenseForm')?.reset();
        var edHidden = document.getElementById('expenseDate');
        if (edHidden) edHidden.value = '';
        var dt = document.getElementById('expenseDate-disp-text');
        var pt = document.getElementById('expenseDate-pdisp-text');
        if (dt) dt.textContent = '';
        if (pt) pt.textContent = '';
        // reset هایلایت دکمه‌ها
        var container = edHidden ? edHidden.parentElement : null;
        if (container) container.querySelectorAll('button[type="button"]').forEach(function(b){
            b.classList.remove('ring-2','ring-lime-400','ring-orange-400','bg-white/30');
            b.classList.add('bg-white/10');
        });
    }
    
    /**
     * محاسبه و نمایش ساعت کل
     */
    function updateTotalHours() {
        const startTime = document.getElementById('startTime')?.value;
        const endTime = document.getElementById('endTime')?.value;
        
        if (startTime && endTime) {
            const total = WorkHoursModule.calculateTotalHours(startTime, endTime);
            const display = WorkHoursModule.formatHoursDisplay(total);
            document.getElementById('totalHoursDisplay').textContent = display;
        } else {
            document.getElementById('totalHoursDisplay').textContent = '0 ساعت';
        }
    }
    
    /**
     * فیلتر ورودی‌ها
     */
    function filterEntries() {
        const typeFilter = document.getElementById('filterType').value;
        const statusFilter = document.getElementById('filterStatus').value;
        
        let entries = WorkHoursModule.getAllEntriesByEmployee(currentUser.id);
        
        // فیلتر بر اساس نوع
        if (typeFilter === 'hours') {
            entries = entries.filter(e => e.type === 'work' || !e.type);
        } else if (typeFilter === 'expenses') {
            entries = entries.filter(e => e.type === 'expense');
        }
        
        // فیلتر بر اساس وضعیت
        if (statusFilter !== 'all') {
            entries = entries.filter(e => e.status === statusFilter);
        }
        
        document.getElementById('workHoursList').innerHTML = renderAllEntriesList(entries);
    }
    
    /**
     * حذف ورودی
     */
    function deleteEntry(id) {
        if (confirm('آیا از حذف این ساعت کاری مطمئن هستید؟')) {
            WorkHoursModule.deleteWorkHour(id);
            showNotification('ساعت کاری حذف شد', 'success');
            refreshContent();
        }
    }
    
    /**
     * تأیید ورودی (مدیر)
     */
    function approveEntry(id) {
        WorkHoursModule.approveWorkHour(id);
        showNotification('ساعت کاری تأیید شد', 'success');
        refreshContent();
    }
    
    /**
     * رد ورودی (مدیر) — با دریافت دلیل و ارسال پیام به کارمند
     */
    function rejectEntry(id) {
        // مودال دریافت دلیل رد
        const existing = document.getElementById('__reject-modal');
        if (existing) existing.remove();

        const entry = WorkHoursModule.getWorkHours().find(e => e.id === id);
        if (!entry) { showNotification('ورودی یافت نشد', 'error'); return; }

        const isExpense = entry.type === 'expense';
        const entryDesc = isExpense
            ? `هزینه: ${Number(entry.amount||0).toLocaleString('fa-IR')} تومان`
            : `ساعت کاری: ${entry.totalHours||0} ساعت — ${entry.date||''}`;

        const modal = document.createElement('div');
        modal.id = '__reject-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-red-500/30 shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-white font-bold flex items-center gap-2">
                        <i class="fas fa-times-circle text-red-400"></i>رد ورودی
                    </h3>
                    <button onclick="document.getElementById('__reject-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <div class="bg-white/5 rounded-xl p-3 mb-4 text-sm text-blue-300">
                    <p class="font-semibold text-white mb-1">${entry.employeeName||'کارمند'}</p>
                    <p>${entryDesc}</p>
                    ${entry.description ? `<p class="text-gray-400 text-xs mt-1">${entry.description}</p>` : ''}
                </div>
                <div class="mb-4">
                    <label class="text-gray-400 text-sm mb-2 block">دلیل رد (برای کارمند ارسال می‌شود) <span class="text-red-400">*</span></label>
                    <textarea id="__reject-reason" rows="3" placeholder="مثال: ساعت‌ها اشتباه است، لطفاً اصلاح و مجدداً ارسال کنید..."
                        class="w-full bg-slate-700 text-white border border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"></textarea>
                </div>
                <div class="flex gap-3">
                    <button onclick="WorkHoursUI._confirmReject('${id}')"
                        class="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-times ml-1"></i>رد و ارسال پیام
                    </button>
                    <button onclick="document.getElementById('__reject-modal').remove()"
                        class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl">انصراف</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target===modal) modal.remove(); });
        document.getElementById('__reject-reason')?.focus();
    }

    function _confirmReject(id) {
        const reason = document.getElementById('__reject-reason')?.value.trim();
        if (!reason) { alert('لطفاً دلیل رد را وارد کنید'); return; }

        // ذخیره رد با دلیل
        WorkHoursModule.rejectWorkHour(id, reason);

        // ذخیره پیام رد در لیست پیام‌های کارمند
        const entry = WorkHoursModule.getWorkHours().find(e => e.id === id);
        if (entry) {
            const msgs = (() => { try { return JSON.parse(localStorage.getItem('work_reject_messages')||'[]'); } catch { return []; } })();
            msgs.push({
                id:           'rej_' + Date.now(),
                entryId:      id,
                employeeId:   entry.employeeId,
                employeeName: entry.employeeName,
                entryType:    entry.type || 'work',
                entryDate:    entry.date || '',
                reason,
                canResubmit:  true,
                resubmitted:  false,
                createdAt:    new Date().toISOString()
            });
            localStorage.setItem('work_reject_messages', JSON.stringify(msgs));
        }

        document.getElementById('__reject-modal')?.remove();
        showNotification('ورودی رد شد و پیام برای کارمند ثبت شد', 'warning');
        refreshContent();
    }
    
    /**
     * مشاهده جزئیات کارمند
     */
    function viewEmployeeDetails(employeeId) {
        const hours = WorkHoursModule.getWorkHoursByEmployee(employeeId);
        const totalHours = WorkHoursModule.getTotalHoursByEmployee(employeeId);
        const employee = hours[0]?.employeeName || 'کارمند';
        
        const modal = `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick="this.remove()">
                <div class="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-bold text-white">
                            <i class="fas fa-user text-black-400 ml-2"></i>
                            ساعات کاری ${employee}
                        </h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-white hover:text-red-400">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="bg-white/10 rounded-xl p-4 mb-6">
                        <p class="text-black-400">کل ساعات تأیید شده شده: <span class="text-2xl font-bold text-emerald-400">${totalHours}</span> ساعت</p>
                    </div>
                    
                    <table class="w-full">
                        <thead>
                            <tr class="border-b border-white/10">
                                <th class="text-right text-black-400 py-2">تاریخ</th>
                                <th class="text-right text-black-400 py-2">از</th>
                                <th class="text-right text-black-400 py-2">تا</th>
                                <th class="text-right text-black-400 py-2">ساعت</th>
                                <th class="text-right text-black-400 py-2">وضعیت</th>
                                <th class="text-right text-black-400 py-2">شرح</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderWorkHoursList(hours)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modal);
    }
    
    /**
     * بازخوانی محتوا
     */
    function refreshContent() {
        init();

        // re-render بخش workHours در Alpine بدون reload کامل
        try {
            // روش ۱: پیدا کردن container و re-render مستقیم
            const container = document.querySelector('[x-show*="workHours"]');
            if (container) {
                const app = UIRefresh ? UIRefresh._getApp() : null;
                const role = app ? app.currentUser.role : (JSON.parse(localStorage.getItem('currentUser') || '{}').role);
                if (role === 'manager') {
                    container.innerHTML = getManagerContent();
                } else {
                    container.innerHTML = getEmployeeContent();
                }
                // re-attach event listeners
                setupEventListeners();
                // re-init jalalidatepicker برای input‌های جدید
                _reInitDatepicker();
                return;
            }
        } catch (e) {
            console.warn('refreshContent خطا:', e.message);
        }

        // روش ۲: از UIRefresh استفاده کن
        if (typeof UIRefresh !== 'undefined') {
            const app = UIRefresh._getApp();
            if (app && app.currentPage === 'workHours') {
                app.currentPage = '__temp__';
                setTimeout(() => {
                    app.currentPage = 'workHours';
                    // re-init jalalidatepicker بعد از render
                    setTimeout(_reInitDatepicker, 100);
                }, 50);
            }
        }
    }
    
    /**
     * نمایش اعلان
     */
    function showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-lime-500',
            info: 'bg-blue-500'
        };
        
        const notification = document.createElement('div');
        notification.className = `fixed top-4 left-4 ${colors[type]} text-gray-900 px-6 py-3 rounded-xl shadow-lg z-50 fade-in`;
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    /**
     * راه‌اندازی رویدادها
     */
    function setupEventListeners() {
        // رویداد ثبت فرم ساعات کاری
        document.addEventListener('submit', function(e) {
            if (e.target.id === 'workHoursForm') {
                e.preventDefault();
                submitForm();
            }
            // رویداد ثبت فرم هزینه‌ها
            if (e.target.id === 'expenseForm') {
                e.preventDefault();
                submitExpenseForm();
            }
        });
        
        // رویداد تغییر ساعت‌ها
        document.addEventListener('change', function(e) {
            if (e.target.id === 'startTime' || e.target.id === 'endTime') {
                updateTotalHours();
            }
        });
    }
    
    // راه‌اندازی خودکار
    document.addEventListener('DOMContentLoaded', function() {
        setupEventListeners();
    });
    
    // ── کسورات کارمندان — رندر برای مدیر ────────────────────
    function _renderManagerDeductions() {
        try {
            const list = JSON.parse(localStorage.getItem('work_deductions') || '[]');
            if (!list.length) return '<p class="text-black-300 text-sm text-center py-6">هیچ کسوراتی ثبت نشده</p>';

            // گروه‌بندی بر اساس کارمند
            const grouped = {};
            list.forEach(function(d) {
                var n = d.employeeName || d.employeeId || '—';
                if (!grouped[n]) grouped[n] = { items: [], total: 0 };
                grouped[n].items.push(d);
                grouped[n].total += Number(d.amount || 0);
            });

            return Object.entries(grouped).map(function(entry) {
                var empName = entry[0], info = entry[1];
                var rows = info.items.map(function(d) {
                    return `<tr class="border-b border-white/5 hover:bg-white/5">
                        <td class="py-2 px-3 text-black-400 text-sm">${typeof Jalali !== 'undefined' ? Jalali.displayDate(d.date) : d.date}</td>
                        <td class="py-2 px-3 text-red-300 font-bold text-sm">${Number(d.amount||0).toLocaleString('fa-IR')} ت</td>
                        <td class="py-2 px-3 text-black-400 text-sm">${d.reason || '—'}</td>
                        <td class="py-2 px-3">
                            <button onclick="WorkHoursUI._deleteManagerDeduction('${d.id}')"
                                class="text-red-400 hover:text-red-300 text-xs"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
                }).join('');

                return `<div class="mb-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-white font-semibold flex items-center gap-2">
                            <i class="fas fa-user text-lime-400 text-xs"></i>${empName}
                        </span>
                        <span class="bg-red-500/20 text-red-300 text-xs px-3 py-1 rounded-full font-bold">
                            جمع: ${info.total.toLocaleString('fa-IR')} ت
                        </span>
                    </div>
                    <table class="w-full text-sm">
                        <thead><tr class="text-black-300 text-xs border-b border-white/10">
                            <th class="text-right py-1 px-3">تاریخ</th>
                            <th class="text-right py-1 px-3">مبلغ</th>
                            <th class="text-right py-1 px-3">علت</th>
                            <th class="py-1 px-3"></th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            }).join('<hr class="border-white/10 my-3">');
        } catch(e) { return '<p class="text-red-400 text-sm">خطا در بارگذاری کسورات</p>'; }
    }

    function _deleteManagerDeduction(id) {
        if (!confirm('این کسر حذف شود؟')) return;
        var list = JSON.parse(localStorage.getItem('work_deductions') || '[]').filter(function(d) { return d.id !== id; });
        localStorage.setItem('work_deductions', JSON.stringify(list));
        refreshContent();
    }

    function showAddDeductionForEmployeeModal() {
        var users = [];
        try {
            users = JSON.parse(localStorage.getItem('edu_system_users') || '[]').filter(function(u) { return u.role === 'employee'; });
        } catch(e) {}

        var opts = users.map(function(u) { return '<option value="' + u.id + '" data-name="' + (u.name||'') + '">' + (u.name||u.id) + '</option>'; }).join('');

        var existing = document.getElementById('add-deduction-mgr-modal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = 'add-deduction-mgr-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-blue-900 rounded-2xl p-6 max-w-sm w-full mx-4 border border-red-500/30 shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-white text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-minus-circle text-red-400"></i>ثبت کسر کارمند
                    </h3>
                    <button onclick="document.getElementById('add-deduction-mgr-modal').remove()" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                </div>
                <div class="space-y-3">
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">کارمند <span class="text-red-400">*</span></label>
                        <select id="mgr-ded-emp" class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none">
                            <option value="">انتخاب کارمند...</option>${opts}
                        </select>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">تاریخ <span class="text-red-400">*</span></label>
                        <!-- مقدار میلادی -->
                        <input type="hidden" id="mgr-ded-date">
                        <!-- فیلد شمسی — کتابخانه jalalidatepicker آن را کنترل می‌کند -->
                        <input type="text"
                               id="mgr-ded-date-jdp"
                               data-jdp
                               data-jdp-target-value-input="#mgr-ded-date"
                               data-jdp-target-value-type="gregorian"
                               placeholder="انتخاب تاریخ شمسی"
                               autocomplete="off"
                               readonly
                               onclick="if(typeof jalaliDatepicker!=='undefined')jalaliDatepicker.show(this)"
                               class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none cursor-pointer text-sm">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">مبلغ (تومان) <span class="text-red-400">*</span></label>
                        <input type="number" id="mgr-ded-amount" min="0" step="1000" placeholder="مثال: 500000" class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none">
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">علت <span class="text-red-400">*</span></label>
                        <input type="text" id="mgr-ded-reason" placeholder="مثال: غیبت، تأخیر..." class="w-full bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-2 focus:outline-none">
                    </div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="WorkHoursUI.saveMgrDeduction()" class="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl transition-all">
                        <i class="fas fa-save ml-1"></i>ثبت کسر
                    </button>
                    <button onclick="document.getElementById('add-deduction-mgr-modal').remove()" class="px-5 bg-gray-600 hover:bg-gray-500 text-white py-2.5 rounded-xl">انصراف</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        // re-init jalalidatepicker برای input جدید در modal
        if (typeof jalaliDatepicker !== 'undefined' && typeof jalaliDatepicker.startWatch === 'function') {
            setTimeout(function() { jalaliDatepicker.startWatch(); }, 50);
        }
    }

    function saveMgrDeduction() {
        var empSel = document.getElementById('mgr-ded-emp');
        var hiddenInput = document.getElementById('mgr-ded-date');
        var jdpInput    = document.getElementById('mgr-ded-date-jdp');

        var rawDate = hiddenInput ? hiddenInput.value : '';
        if (!rawDate && jdpInput && jdpInput.value) {
            rawDate = jdpInput.value;
        }

        // تبدیل به شمسی برای ذخیره
        var date = _toJalaliISOSafe(rawDate);

        var amount = parseFloat(document.getElementById('mgr-ded-amount')?.value) || 0;
        var reason = document.getElementById('mgr-ded-reason')?.value?.trim();
        if (!empSel?.value || !date || !amount || !reason) { showNotification('همه فیلدها را پر کنید', 'error'); return; }

        var empName = empSel.options[empSel.selectedIndex]?.dataset?.name || empSel.value;
        var record = { id: 'ded_' + Date.now(), employeeId: empSel.value, employeeName: empName, date, amount, reason, createdAt: new Date().toISOString() };
        var list = JSON.parse(localStorage.getItem('work_deductions') || '[]');
        list.push(record);
        localStorage.setItem('work_deductions', JSON.stringify(list));
        document.getElementById('add-deduction-mgr-modal')?.remove();
        showNotification('کسر با موفقیت ثبت شد', 'success');
        refreshContent();
    }

    // ── کسورات ───────────────────────────────────────────────
    const DEDUCTION_KEY = 'work_deductions';

    function _getDeductions() {
        try { return JSON.parse(localStorage.getItem(DEDUCTION_KEY) || '[]'); } catch { return []; }
    }

    function submitDeductionForm(e) {
        e.preventDefault();
        const hiddenInput = document.getElementById('deductionDate');
        const jdpInput    = document.getElementById('deductionDate-jdp');

        let rawDate = hiddenInput ? hiddenInput.value : '';
        if (!rawDate && jdpInput && jdpInput.value) {
            rawDate = jdpInput.value;
        }

        // تبدیل به شمسی برای ذخیره
        let date = _toJalaliISOSafe(rawDate);

        const amount = parseFloat(document.getElementById('deductionAmount').value) || 0;
        const reason = document.getElementById('deductionReason').value.trim();
        if (!date || !amount || !reason) {
            showNotification('همه فیلدهای کسر را پر کنید', 'error'); return;
        }
        const u = (() => { try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch { return {}; } })();
        const record = {
            id:           'ded_' + Date.now(),
            employeeId:   u.id   || '',
            employeeName: u.name || '',
            date, amount, reason,
            createdAt: new Date().toISOString()
        };
        const list = _getDeductions();
        list.push(record);
        localStorage.setItem(DEDUCTION_KEY, JSON.stringify(list));
        document.getElementById('deductionForm').reset();
        // clear hidden date و reset span‌های نمایش
        var ddHidden = document.getElementById('deductionDate');
        if (ddHidden) ddHidden.value = '';
        var ddt = document.getElementById('deductionDate-disp-text');
        var ddp = document.getElementById('deductionDate-pdisp-text');
        if (ddt) ddt.textContent = '';
        if (ddp) ddp.textContent = '';
        // reset هایلایت دکمه‌ها
        var ddContainer = ddHidden ? ddHidden.parentElement : null;
        if (ddContainer) ddContainer.querySelectorAll('button[type="button"]').forEach(function(b){
            b.classList.remove('ring-2','ring-lime-400','ring-orange-400','bg-white/30');
            b.classList.add('bg-white/10');
        });
        const listEl = document.getElementById('deductions-list');
        if (listEl) listEl.innerHTML = _renderDeductions();
        showNotification('کسر با موفقیت ثبت شد', 'success');
    }

    function _renderDeductions() {
        const u    = (() => { try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch { return {}; } })();
        const role = u.role || '';
        const list = _getDeductions().filter(d => role === 'manager' || d.employeeId === u.id);
        if (!list.length) return '<p class="text-black-300 text-sm text-center py-4">کسوراتی ثبت نشده</p>';
        const rows = list.slice().reverse().map(d => `
            <tr class="border-b border-white/5 hover:bg-white/5">
                <td class="py-2 px-3 text-white text-sm">${d.employeeName || '—'}</td>
                <td class="py-2 px-3 text-gray-300 text-sm">${typeof Jalali!=='undefined' ? Jalali.displayDate(d.date) : d.date}</td>
                <td class="py-2 px-3 text-red-300 font-bold text-sm">${Number(d.amount).toLocaleString('fa-IR')} تومان</td>
                <td class="py-2 px-3 text-gray-300 text-sm">${d.reason}</td>
                ${role === 'manager' ? `<td class="py-2 px-3">
                    <button onclick="WorkHoursUI._deleteDeduction('${d.id}')"
                        class="text-red-400 hover:text-red-300 text-xs"><i class="fas fa-trash"></i></button>
                </td>` : '<td></td>'}
            </tr>`).join('');
        return `
            <table class="w-full text-sm mt-2">
                <thead><tr class="text-black-300 text-xs border-b border-white/10">
                    <th class="text-right py-2 px-3">کارمند</th>
                    <th class="text-right py-2 px-3">تاریخ</th>
                    <th class="text-right py-2 px-3">مبلغ</th>
                    <th class="text-right py-2 px-3">علت</th>
                    <th class="py-2 px-3"></th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    function _deleteDeduction(id) {
        const list = _getDeductions().filter(d => d.id !== id);
        localStorage.setItem(DEDUCTION_KEY, JSON.stringify(list));
        const listEl = document.getElementById('deductions-list');
        if (listEl) listEl.innerHTML = _renderDeductions();
    }

    // ── re-init jalalidatepicker بعد از render ────────────────
    function _reInitDatepicker() {
        if (typeof jalaliDatepicker !== 'undefined' && typeof jalaliDatepicker.startWatch === 'function') {
            setTimeout(function() {
                jalaliDatepicker.startWatch({
                    showTodayBtn: true,
                    showEmptyBtn: true,
                    showCloseBtn: true,
                });
            }, 30);
        }
    }

    /**
     * تبدیل هر تاریخ (میلادی یا شمسی) به شمسی YYYY-MM-DD برای ذخیره‌سازی
     * چون Jalali.displayDate انتظار فرمت شمسی دارد
     *
     * ورودی میلادی: "2025-08-17"  →  خروجی شمسی: "1404-05-26"
     * ورودی شمسی:  "1404-05-26"  →  خروجی شمسی: "1404-05-26"  (بدون تغییر)
     */
    function _toJalaliISOSafe(dateStr) {
        if (!dateStr) return '';
        var str = String(dateStr).trim();

        // normalize: اعداد فارسی/عربی → لاتین
        str = str.replace(/[۰-۹]/g, function(d) { return String.fromCharCode(d.charCodeAt(0) - 1728); })
                 .replace(/[٠-٩]/g, function(d) { return String.fromCharCode(d.charCodeAt(0) - 1584); });

        // normalize: / و . → -
        str = str.replace(/[\/\.]/g, '-');

        var parts = str.split('-');
        if (parts.length !== 3) return dateStr;

        var y  = parseInt(parts[0], 10);
        var m  = parseInt(parts[1], 10);
        var d  = parseInt(parts[2], 10);
        if (!y || !m || !d) return dateStr;

        var pad = function(n) { return n < 10 ? '0' + n : String(n); };

        // شمسی (1300-1500) — بدون تغییر، فقط normalize
        if (y >= 1300 && y <= 1500) {
            return y + '-' + pad(m) + '-' + pad(d);
        }

        // میلادی (1900-2100) → تبدیل به شمسی
        if (y >= 1900 && y <= 2100) {
            if (typeof Jalali !== 'undefined' && typeof Jalali.toJalaali === 'function') {
                try {
                    var j = Jalali.toJalaali(y, m, d);
                    return j.jy + '-' + pad(j.jm) + '-' + pad(j.jd);
                } catch(e) {
                    console.warn('[WorkHours] _toJalaliISOSafe Jalali.toJalaali خطا:', e);
                }
            }
        }

        return dateStr;
    }

    /**
     * تبدیل مقدار شمسی نمایشی به میلادی YYYY-MM-DD
     * ورودی: رشته‌ای مثل "1404/05/24" یا "۱۴۰۴/۰۵/۲۴"
     * خروجی: "2025-08-15" یا '' در صورت خطا
     */
    function _convertJalaliInputToGregorian(jStr) {
        if (!jStr) return '';
        // تبدیل اعداد فارسی به لاتین
        var normalized = jStr.replace(/[۰-۹]/g, function(d) {
            return String.fromCharCode(d.charCodeAt(0) - 1728);
        }).replace(/[٠-٩]/g, function(d) {
            return String.fromCharCode(d.charCodeAt(0) - 1584);
        });
        // جدا کردن سال/ماه/روز
        var parts = normalized.split(/[\/\-\.]/);
        if (parts.length !== 3) return '';
        var jy = parseInt(parts[0], 10);
        var jm = parseInt(parts[1], 10);
        var jd = parseInt(parts[2], 10);
        if (!jy || !jm || !jd) return '';
        // استفاده از Jalali اگر موجود باشد
        if (typeof Jalali !== 'undefined' && typeof Jalali.toGregorian === 'function') {
            try {
                var g = Jalali.toGregorian(jy, jm, jd);
                var pad = function(n) { return n < 10 ? '0' + n : String(n); };
                return g.gy + '-' + pad(g.gm) + '-' + pad(g.gd);
            } catch(e) {}
        }
        // fallback: الگوریتم ساده تبدیل جلالی به میلادی
        return _jalaliToGregorianFallback(jy, jm, jd);
    }

    function _jalaliToGregorianFallback(jy, jm, jd) {
        var jy2 = jy <= 979 ? 979 : jy - 979;
        var jm2 = jm - 1;
        var days = (365 * jy2) + (Math.floor(jy2 / 33) * 8) + Math.floor(((jy2 % 33) + 3) / 4) + 78 + jd +
                   (jm2 < 6 ? jm2 * 31 : (jm2 * 30) + 6);
        var gy = 1600 + (400 * Math.floor(days / 146097));
        days %= 146097;
        if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
        gy += 4 * Math.floor(days / 1461);
        days %= 1461;
        if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
        var gd = days + 1;
        var months = [0,31,(gy%4===0&&gy%100!==0||gy%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
        var gm = 0;
        for (var i = 1; i <= 12; i++) { if (gd <= months[i]) { gm = i; break; } gd -= months[i]; }
        var pad = function(n) { return n < 10 ? '0' + n : String(n); };
        return gy + '-' + pad(gm) + '-' + pad(gd);
    }

    /**
     * باز کردن تقویم شمسی با dark theme
     * از onclick مستقیم روی input‌ها صدا زده می‌شود
     */
    function openDarkPicker(inputEl) {
        if (typeof jalaliDatepicker === 'undefined') {
            console.error('jalaliDatepicker not loaded');
            return;
        }
        // اطمینان از init بودن کتابخانه
        if (typeof jalaliDatepicker.startWatch === 'function') {
            jalaliDatepicker.startWatch({
                showTodayBtn: true,
                showEmptyBtn: true,
                showCloseBtn: true,
            });
        }
        // dark mode class روی body
        document.body.classList.add('jdp-dark-mode');
        // برداشتن class بعد از بسته شدن تقویم
        var removeClassHandler = function(e) {
            // اگه کلیک خارج از تقویم بود class رو بردار
            var container = document.querySelector('jdp-container');
            if (!container || !container.contains(e.target)) {
                document.body.classList.remove('jdp-dark-mode');
                document.removeEventListener('click', removeClassHandler);
            }
        };
        setTimeout(function() {
            document.addEventListener('click', removeClassHandler);
        }, 300);
        jalaliDatepicker.show(inputEl);
    }

    // ── تاریخ شمسی سریع (برای فیلدهای ساعات کاری) ────────────
    function _wh_iranToday() {
        var now = new Date();
        var utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
        return new Date(utcMs + 3.5 * 3600000);
    }

    // تبدیل رشته YYYY-MM-DD به نمایش شمسی
    function _wh_jalaliDisplay(dateStr) {
        if (!dateStr) return '';
        if (typeof Jalali !== 'undefined' && typeof Jalali.displayDate === 'function') {
            return Jalali.displayDate(dateStr);
        }
        // fallback: نمایش ساده
        var p = dateStr.split('-');
        if (p.length === 3) {
            var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
            var m = parseInt(p[1]) - 1;
            return parseInt(p[2]) + ' ' + (MONTHS[m] || '') + ' ' + p[0];
        }
        return dateStr;
    }

    function setQuickDate(hiddenId, dispBtnId, offset) {
        // محاسبه تاریخ صحیح
        // offset=-1 → دیروز ، offset=-2 → پریروز
        var d = _wh_iranToday();
        d.setDate(d.getDate() + offset);

        // تبدیل به شمسی ISO (YYYY-MM-DD)
        var jStr;
        if (typeof Jalali !== 'undefined' && typeof Jalali.toJalaliISO === 'function') {
            jStr = Jalali.toJalaliISO(d);
        } else if (typeof Jalali !== 'undefined' && typeof Jalali.toJalaali === 'function') {
            var j = Jalali.toJalaali(d.getFullYear(), d.getMonth()+1, d.getDate());
            jStr = j.jy + '-' + String(j.jm).padStart(2,'0') + '-' + String(j.jd).padStart(2,'0');
        } else {
            // fallback: تقریبی شمسی
            jStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        }

        // ذخیره در hidden input
        var hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = jStr;

        // نمایش شمسی خوانا
        var display;
        if (typeof Jalali !== 'undefined' && typeof Jalali.toJalaliDisplay === 'function') {
            display = Jalali.toJalaliDisplay(d);
        } else {
            display = jStr;
        }

        // offset=-1 → دیروز → span: hiddenId-disp-text  (دکمه اول)
        // offset=-2 → پریروز → span: hiddenId-pdisp-text (دکمه دوم)
        var isYesterday = (offset === -1);
        var activeSpanId = isYesterday ? (hiddenId + '-disp-text')  : (hiddenId + '-pdisp-text');
        var clearSpanId  = isYesterday ? (hiddenId + '-pdisp-text') : (hiddenId + '-disp-text');

        var activeSpan = document.getElementById(activeSpanId);
        var clearSpan  = document.getElementById(clearSpanId);
        if (activeSpan) activeSpan.textContent = display;
        if (clearSpan)  clearSpan.textContent  = '';

        // هایلایت: reset همه دکمه‌ها سپس فعال‌سازی دکمه انتخاب‌شده
        var container = hidden ? hidden.parentElement : null;
        if (container) {
            var btns = container.querySelectorAll('button[type="button"]');
            btns.forEach(function(btn) {
                btn.classList.remove('ring-2','ring-lime-400','ring-orange-400','bg-white/30');
                btn.classList.add('bg-white/10');
            });
            // دیروز = دکمه اول (btns[0]) ، پریروز = دکمه دوم (btns[1])
            var targetBtn = isYesterday ? btns[0] : btns[1];
            var ringColor = isYesterday ? 'ring-lime-400' : 'ring-orange-400';
            if (targetBtn) {
                targetBtn.classList.remove('bg-white/10');
                targetBtn.classList.add('bg-white/30', 'ring-2', ringColor);
            }
        }
    }

    // عمومی‌سازی توابع
    return {
        init,
        getEmployeeContent,
        getManagerContent,
        submitForm,
        submitExpenseForm,
        resetForm,
        resetExpenseForm,
        updateTotalHours,
        filterEntries,
        deleteEntry,
        approveEntry,
        rejectEntry,
        _confirmReject,
        resubmitEntry,
        viewEmployeeDetails,
        refreshContent,
        showNotification,
        renderExpensesList,
        submitDeductionForm,
        _renderDeductions,
        _deleteDeduction,
        _renderManagerDeductions,
        _deleteManagerDeduction,
        showAddDeductionForEmployeeModal,
        saveMgrDeduction,
        setQuickDate,
        _wh_jalaliDisplay,
        _syncDateDisplayTexts,
        _reInitDatepicker,
        openDarkPicker,
        _convertJalaliInputToGregorian,
        _toJalaliISOSafe,
    };
})();
