/**
 * سیستم ساعات کاری
 * مدیریت ثبت و نمایش ساعات کاری کارمندان
 */

const WorkHoursModule = (function() {
    'use strict';

    // کلید ذخیره‌سازی
    const STORAGE_KEY = 'work_hours_data';
    
    /**
     * دریافت لیست ساعات کاری
     */
    function getWorkHours() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('خطا در دریافت ساعات کاری:', error);
            return [];
        }
    }
    
    /**
     * ذخیره ساعات کاری
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
     * افزودن ساعت کاری جدید
     */
    function addWorkHour(entry) {
        const hours = getWorkHours();
        
        const newEntry = {
            id: Date.now().toString(),
            type: 'work', // نوع: ساعت کاری
            employeeId: entry.employeeId,
            employeeName: entry.employeeName,
            date: entry.date,
            startTime: entry.startTime,
            endTime: entry.endTime,
            description: entry.description,
            totalHours: calculateTotalHours(entry.startTime, entry.endTime),
            status: 'pending', // pending, approved, rejected
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        hours.push(newEntry);
        saveWorkHours(hours);
        
        return newEntry;
    }
    
    /**
     * افزودن هزینه
     */
    function addExpense(entry) {
        const hours = getWorkHours(); // استفاده از همان لیست
        
        const newEntry = {
            id: Date.now().toString(),
            type: 'expense', // نوع: هزینه
            employeeId: entry.employeeId,
            employeeName: entry.employeeName,
            date: entry.date,
            amount: entry.amount,
            description: entry.description,
            status: 'pending', // pending, approved, rejected
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        hours.push(newEntry); // اضافه به همان لیست
        saveWorkHours(hours);
        
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
     * ویرایش ساعت کاری
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
            return hours[index];
        }
        
        return null;
    }
    
    /**
     * حذف ساعت کاری
     */
    function deleteWorkHour(id) {
        const hours = getWorkHours();
        const filtered = hours.filter(h => h.id !== id);
        saveWorkHours(filtered);
        return true;
    }
    
    /**
     * محاسبه مجموع ساعات
     */
    function calculateTotalHours(startTime, endTime) {
        if (!startTime || !endTime) return 0;
        
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        const diffMinutes = endMinutes - startMinutes;
        
        if (diffMinutes < 0) return 0;
        
        return (diffMinutes / 60).toFixed(2);
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
            .sort((a, b) => new Date(b.date) - new Date(a.date));
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
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('fa-IR', options);
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
                                <i class="fas fa-clock text-2xl text-blue-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">کل ساعات تأیید شده</p>
                                <p class="text-3xl font-bold text-white">${totalHours}</p>
                                <p class="text-blue-300 text-xs">ساعت</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-hourglass-half text-2xl text-yellow-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">در انتظار تأیید</p>
                                <p class="text-3xl font-bold text-white">${workHours.filter(h => h.status === 'pending').length}</p>
                                <p class="text-blue-300 text-xs">ثبت</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-check-circle text-2xl text-green-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">تأیید شده</p>
                                <p class="text-3xl font-bold text-white">${workHours.filter(h => h.status === 'approved').length}</p>
                                <p class="text-blue-300 text-xs">ثبت</p>
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
                            <label class="block text-blue-200 text-sm mb-2">تاریخ</label>
                            <input type="date" id="workDate" value="${today}"
                                   class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400">
                        </div>
                        
                        <div>
                            <label class="block text-blue-200 text-sm mb-2">ساعت شروع</label>
                            <input type="time" id="startTime"
                                   class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400">
                        </div>
                        
                        <div>
                            <label class="block text-blue-200 text-sm mb-2">ساعت پایان</label>
                            <input type="time" id="endTime"
                                   class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400">
                        </div>
                        
                        <div class="md:col-span-2 lg:col-span-1">
                            <label class="block text-blue-200 text-sm mb-2">ساعت کل</label>
                            <div id="totalHoursDisplay" class="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-2xl font-bold text-emerald-400 text-center">
                                0 ساعت
                            </div>
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
                
                <!-- فرم ثبت هزینه مستقل -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="fas fa-money-bill-wave text-orange-400"></i>
                        ثبت هزینه\u200cهای شرکت
                    </h3>
                    
                    <form id="expenseForm" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-blue-200 text-sm mb-2">تاریخ</label>
                            <input type="date" id="expenseDate" value="${today}"
                                   class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400">
                        </div>
                        
                        <div>
                            <label class="block text-blue-200 text-sm mb-2">
                                <i class="fas fa-dollar-sign ml-1"></i>
                                مبلغ (تومان)
                            </label>
                            <input type="number" id="expenseAmount" min="0" step="1000" placeholder="مبلغ را وارد کنید"
                                   class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400">
                        </div>
                        
                        <div>
                            <label class="block text-blue-200 text-sm mb-2">شرح هزینه</label>
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
                            <i class="fas fa-list text-blue-400"></i>
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
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">نوع</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">تاریخ</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">ساعت شروع</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">ساعت پایان</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">ساعت کل</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">مبلغ</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">شرح</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">وضعیت</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">عملیات</th>
                                </tr>
                            </thead>
                            <tbody id="workHoursList">
                                ${renderAllEntriesList(allEntries)}
                            </tbody>
                        </table>
                    </div>
                    
                    ${allEntries.length === 0 ? `
                        <div class="text-center py-12">
                            <i class="fas fa-clock text-5xl text-blue-400/30 mb-4"></i>
                            <p class="text-blue-200">هنوز رکوردی ثبت نشده است</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
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
                            <div class="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-users text-2xl text-purple-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">تعداد کارمندان</p>
                                <p class="text-3xl font-bold text-white">${summary.length}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-hourglass-half text-2xl text-yellow-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">در انتظار تأیید</p>
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
                                <p class="text-blue-200 text-sm">تأیید شده</p>
                                <p class="text-3xl font-bold text-white">${summary.reduce((sum, s) => sum + s.approved, 0)}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-clock text-2xl text-blue-400"></i>
                            </div>
                            <div>
                                <p class="text-blue-200 text-sm">کل ساعات</p>
                                <p class="text-3xl font-bold text-white">${summary.reduce((sum, s) => sum + s.totalHours, 0).toFixed(1)}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- درخواست‌های ساعات کاری در انتظار -->
                ${pendingHours.length > 0 ? `
                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <i class="fas fa-clock text-yellow-400"></i>
                            ساعات کاری در انتظار تأیید
                        </h3>
                        
                        <div class="space-y-4">
                            ${pendingHours.map(entry => `
                                <div class="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between">
                                    <div class="flex items-center gap-4">
                                        <div class="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                                            <i class="fas fa-user text-blue-400"></i>
                                        </div>
                                        <div>
                                            <p class="text-white font-medium">${entry.employeeName}</p>
                                            <p class="text-blue-200 text-sm">${entry.date} | ${entry.startTime || '-'} - ${entry.endTime || '-'}</p>
                                            <p class="text-blue-300 text-xs">${entry.totalHours || 0} ساعت</p>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-center gap-3">
                                        <div class="text-left max-w-xs">
                                            <p class="text-blue-200 text-sm truncate">${entry.description || '-'}</p>
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
                                            <p class="text-blue-200 text-sm">${entry.date}</p>
                                            <p class="text-orange-400 text-lg font-bold">${entry.amount ? entry.amount.toLocaleString('fa-IR') : 0} تومان</p>
                                            ${entry.description ? `<p class="text-blue-300 text-xs mt-1">${entry.description}</p>` : ''}
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
                        <i class="fas fa-table text-blue-400"></i>
                        خلاصه ساعات کارمندان
                    </h3>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/10">
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">نام کارمند</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">کل ساعات</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">تعداد ثبت</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">تأیید شده</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">در انتظار</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">رد شده</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${summary.length > 0 ? summary.map(emp => `
                                    <tr class="border-b border-white/5 hover:bg-white/5">
                                        <td class="py-4 px-4">
                                            <div class="flex items-center gap-3">
                                                <div class="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                                    <i class="fas fa-user text-blue-400"></i>
                                                </div>
                                                <span class="text-white font-medium">${emp.employeeName}</span>
                                            </div>
                                        </td>
                                        <td class="text-center py-4 px-4">
                                            <span class="text-2xl font-bold text-emerald-400">${emp.totalHours.toFixed(1)}</span>
                                            <span class="text-blue-300 text-sm"> ساعت</span>
                                        </td>
                                        <td class="text-center py-4 px-4 text-white">${emp.entries}</td>
                                        <td class="text-center py-4 px-4">
                                            <span class="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">${emp.approved}</span>
                                        </td>
                                        <td class="text-center py-4 px-4">
                                            <span class="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm">${emp.pending}</span>
                                        </td>
                                        <td class="text-center py-4 px-4">
                                            <span class="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">${emp.rejected}</span>
                                        </td>
                                        <td class="text-center py-4 px-4">
                                            <button onclick="WorkHoursUI.viewEmployeeDetails('${emp.employeeId}')"
                                                    class="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-lg text-sm transition-all">
                                                <i class="fas fa-eye ml-1"></i>مشاهده
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="7" class="text-center py-12">
                                            <i class="fas fa-users text-5xl text-blue-400/30 mb-4"></i>
                                            <p class="text-blue-200">هنوز ساعتی ثبت نشده است</p>
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
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">نام کارمند</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">تاریخ</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">مبلغ</th>
                                    <th class="text-right text-blue-200 font-medium py-3 px-4">شرح</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">وضعیت</th>
                                    <th class="text-center text-blue-200 font-medium py-3 px-4">عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderExpensesList()}
                            </tbody>
                        </table>
                    </div>
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
                        <p class="text-blue-200">هنوز هزینه‌ای ثبت نشده است</p>
                    </td>
                </tr>
            `;
        }
        
        const statusColors = {
            pending: 'bg-yellow-500/20 text-yellow-400',
            approved: 'bg-green-500/20 text-green-400',
            rejected: 'bg-red-500/20 text-red-400'
        };
        
        const statusTexts = {
            pending: 'در انتظار',
            approved: 'تأیید شده',
            rejected: 'رد شده'
        };
        
        return allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(expense => `
            <tr class="border-b border-white/5 hover:bg-white/5">
                <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                            <i class="fas fa-user text-orange-400"></i>
                        </div>
                        <span class="text-white font-medium">${expense.employeeName}</span>
                    </div>
                </td>
                <td class="py-4 px-4 text-white">${expense.date}</td>
                <td class="py-4 px-4">
                    <span class="text-xl font-bold text-orange-400">${expense.amount ? expense.amount.toLocaleString('fa-IR') : 0}</span>
                    <span class="text-blue-300 text-sm"> تومان</span>
                </td>
                <td class="py-4 px-4 text-blue-200 max-w-xs" title="${expense.description || '-'}">
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
                pending: 'bg-yellow-500/20 text-yellow-400',
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
                            '<span class="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs"><i class="fas fa-clock ml-1"></i>ساعت کاری</span>'
                        }
                    </td>
                    <td class="py-3 px-4 text-white">${entry.date}</td>
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
                    <td class="py-3 px-4 text-blue-200 max-w-xs truncate" title="${entry.description || '-'}">${entry.description || '-'}</td>
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
                pending: 'bg-yellow-500/20 text-yellow-400',
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
                    <td class="py-3 px-4 text-white">${entry.date}</td>
                    <td class="py-3 px-4 text-white">${entry.startTime || '-'}</td>
                    <td class="py-3 px-4 text-white">${entry.endTime || '-'}</td>
                    <td class="py-3 px-4 text-emerald-400 font-bold">${entry.totalHours || '-'}</td>
                    <td class="py-3 px-4">
                        <span class="${statusColors[entry.status]} px-3 py-1 rounded-full text-sm">
                            ${statusTexts[entry.status]}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-blue-200 max-w-xs truncate">${entry.description || '-'}</td>
                </tr>
            `;
        }).join('');
    }
    
    /**
     * ثبت فرم
     */
    function submitForm() {
        const date = document.getElementById('workDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const description = document.getElementById('workDescription').value;
        const expenses = parseFloat(document.getElementById('workExpenses').value) || 0;
        const expensesDescription = document.getElementById('expensesDescription').value;
        
        if (!date || !startTime || !endTime) {
            showNotification('لطفاً تمام فیلدهای ضروری را پر کنید', 'error');
            return;
        }
        
        if (startTime >= endTime) {
            showNotification('ساعت پایان باید بزرگتر از ساعت شروع باشد', 'error');
            return;
        }
        
        const entry = {
            employeeId: currentUser.id,
            employeeName: currentUser.name || currentUser.username || 'کارمند',
            date,
            startTime,
            endTime,
            description,
            expenses,
            expensesDescription
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
     * ثبت فرم ساعات کاری
     */
    function submitForm() {
        const date = document.getElementById('workDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        
        if (!date || !startTime || !endTime) {
            showNotification('لطفاً تمام فیلدها را پر کنید', 'error');
            return;
        }
        
        if (startTime >= endTime) {
            showNotification('ساعت پایان باید بزرگتر از ساعت شروع باشد', 'error');
            return;
        }
        
        const entry = {
            employeeId: currentUser.id,
            employeeName: currentUser.name || currentUser.username || 'کارمند',
            date,
            startTime,
            endTime,
            description: ''
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
        const date = document.getElementById('expenseDate').value;
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const description = document.getElementById('expenseDescription').value;
        
        if (!date || !amount || amount <= 0) {
            showNotification('لطفاً تمام فیلدها را به درستی پر کنید', 'error');
            return;
        }
        
        const entry = {
            employeeId: currentUser.id,
            employeeName: currentUser.name || currentUser.username || 'کارمند',
            date,
            amount,
            description
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
        const today = WorkHoursModule.formatDate(new Date());
        document.getElementById('workDate').value = today;
    }
    
    /**
     * بازنشانی فرم هزینه‌ها
     */
    function resetExpenseForm() {
        document.getElementById('expenseForm')?.reset();
        const today = WorkHoursModule.formatDate(new Date());
        document.getElementById('expenseDate').value = today;
    }
    
    /**
     * محاسبه و نمایش ساعت کل
     */
    function updateTotalHours() {
        const startTime = document.getElementById('startTime')?.value;
        const endTime = document.getElementById('endTime')?.value;
        
        if (startTime && endTime) {
            const total = WorkHoursModule.calculateTotalHours(startTime, endTime);
            document.getElementById('totalHoursDisplay').textContent = `${total} ساعت`;
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
     * رد ورودی (مدیر)
     */
    function rejectEntry(id) {
        const reason = prompt('دلیل رد را وارد کنید:');
        if (reason !== null) {
            WorkHoursModule.rejectWorkHour(id, reason);
            showNotification('ساعت کاری رد شد', 'warning');
            refreshContent();
        }
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
                            <i class="fas fa-user text-blue-400 ml-2"></i>
                            ساعات کاری ${employee}
                        </h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-white hover:text-red-400">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="bg-white/10 rounded-xl p-4 mb-6">
                        <p class="text-blue-200">کل ساعات تأیید شده: <span class="text-2xl font-bold text-emerald-400">${totalHours}</span> ساعت</p>
                    </div>
                    
                    <table class="w-full">
                        <thead>
                            <tr class="border-b border-white/10">
                                <th class="text-right text-blue-200 py-2">تاریخ</th>
                                <th class="text-right text-blue-200 py-2">از</th>
                                <th class="text-right text-blue-200 py-2">تا</th>
                                <th class="text-right text-blue-200 py-2">ساعت</th>
                                <th class="text-right text-blue-200 py-2">وضعیت</th>
                                <th class="text-right text-blue-200 py-2">شرح</th>
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
        
        // اگر تابع appController وجود دارد، صفحه را بازخوانی کن
        if (typeof window.appController === 'function') {
            const app = document.querySelector('[x-data]');
            if (app && app.__x) {
                app.__x.$data.currentPage = app.__x.$data.currentPage; // Force refresh
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
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        const notification = document.createElement('div');
        notification.className = `fixed top-4 left-4 ${colors[type]} text-white px-6 py-3 rounded-xl shadow-lg z-50 fade-in`;
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
        viewEmployeeDetails,
        refreshContent,
        showNotification,
        renderExpensesList
    };
})();
