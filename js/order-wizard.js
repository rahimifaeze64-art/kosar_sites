// Order Wizard Module - ماژول فرم سفارش ساده شده
const OrderWizardModule = {
    // لیست انواع کارها
    workTypes: [
        'عناوین رساله ارشد', 'عناوین رساله عاملی', 'عناوین مقاله',
        'پروپوزال رساله ارشد', 'پروپوزال رساله عاملی', 'پروپوزال مقاله',
        'رساله ارشد', 'رساله عاملی', 'تعدیل', 'تنضید', 'ترجمه',
        'استلال عراقی', 'استلال ایرانی', 'علاج استلال ایرانی', 'علاج استلال عراقی',
        'ترجمه و تصدیق مباشره', 'ترجمه و تصدیق قبول نهایی', 'ترجمه و تصدیق دانشنامه',
        'ترجمه مدرک', 'تجلید', 'همانند جویی',
        'ایران داک عنوان', 'ایران داک پروپوزال', 'ایران داک پایان نامه',
        'سائورگ', 'تلخیص متن', 'ساخت پاور پوینت',
        'تعقیب اجراعات قبل مباشره', 'تعقیب اجراعات بعد مباشره',
        'تصدیق مجلدات', 'تعقیب استماره 1', 'تعقیب پروپوزال',
        'گرفتن امر اداری', 'تعقیب رساله', 'تعقیب اجراعات روز مناقشه',
        'سایر'
    ],
    
    // لیست دانشگاه‌ها
    universities: [
        'دانشگاه قم', 'جامعه المصطفی', 'دانشگاه تهران', 'دانشگاه امیرکبیر',
        'دانشگاه sharif', 'دانشگاه تبریز', 'دانشگاه اصفهان', 'سایر'
    ],
    
    // لیست رشته‌ها
    fields: [
        'حقوق محض', 'حقوق عمومی', 'حقوق خصوصی', 'حقوق بین‌الملل',
        'علوم سیاسی', 'فلسفه', 'اقتصاد', 'مدیریت', 'سایر'
    ],
    
    // Get the wizard modal
    getWizardModal() {
        return `
            <div x-data="orderWizardData()">
                <div class="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 relative">
                    <button @click="$dispatch('close-modal')" 
                            class="absolute left-4 top-4 text-white hover:text-gray-200 text-2xl"
                            type="button">
                        <i class="fas fa-times"></i>
                    </button>
                    <h3 class="text-xl font-bold text-white">
                        <i class="fas fa-plus-circle ml-2"></i>
                        سفارش جدید
                    </h3>
                </div>
                
                <div class="p-6 bg-gray-50 max-h-[70vh] overflow-y-auto">
                    <form @submit.prevent="submitOrder()" class="space-y-5">
                        
                        <!-- 1. نام دانشجو -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-user text-indigo-500 ml-2"></i>
                                نام دانشجو <span class="text-red-500">*</span>
                            </label>
                            <input type="text" x-model="newOrder.studentName" 
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                                   required placeholder="نام و نام خانوادگی دانشجو">
                        </div>
                        
                        <!-- 2. نوع کار -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-tasks text-indigo-500 ml-2"></i>
                                نوع کار <span class="text-red-500">*</span>
                            </label>
                            <select x-model="newOrder.workType" 
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                                    required>
                                <option value="">انتخاب نوع کار...</option>
                                ${this.workTypes.map(w => `<option value="${w}">${w}</option>`).join('')}
                            </select>
                        </div>
                        
                        <!-- 3. دانشگاه -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-university text-indigo-500 ml-2"></i>
                                دانشگاه <span class="text-red-500">*</span>
                            </label>
                            <div class="flex space-x-2 space-x-reverse">
                                <select x-model="newOrder.universitySelect" 
                                        class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                                        required
                                        @change="showCustomUniversity = (newOrder.universitySelect === 'سایر'); 
                                                 if(!showCustomUniversity) newOrder.university = newOrder.universitySelect;">
                                    <option value="">انتخاب دانشگاه...</option>
                                    ${this.universities.map(u => `<option value="${u}">${u}</option>`).join('')}
                                </select>
                            </div>
                            <input x-show="showCustomUniversity" type="text" x-model="newOrder.university" 
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                                   placeholder="نام دانشگاه را وارد کنید">
                        </div>
                        
                        <!-- 4. رشته -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-graduation-cap text-indigo-500 ml-2"></i>
                                رشته تحصیلی <span class="text-red-500">*</span>
                            </label>
                            <div class="flex space-x-2 space-x-reverse">
                                <select x-model="newOrder.fieldSelect" 
                                        class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                                        required
                                        @change="showCustomField = (newOrder.fieldSelect === 'سایر'); 
                                                 if(!showCustomField) newOrder.field = newOrder.fieldSelect;">
                                    <option value="">انتخاب رشته...</option>
                                    ${this.fields.map(f => `<option value="${f}">${f}</option>`).join('')}
                                </select>
                            </div>
                            <input x-show="showCustomField" type="text" x-model="newOrder.field" 
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                                   placeholder="نام رشته را وارد کنید">
                        </div>
                        
                        <!-- 5. مهلت تحویل - روز و ساعت -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-calendar-alt text-indigo-500 ml-2"></i>
                                مهلت تحویل <span class="text-red-500">*</span>
                            </label>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm text-gray-600 mb-1">تاریخ</label>
                                    <input type="date" x-model="newOrder.deadlineDate" 
                                           class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                           required>
                                </div>
                                <div>
                                    <label class="block text-sm text-gray-600 mb-1">ساعت</label>
                                    <input type="time" x-model="newOrder.deadlineTime" 
                                           class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                           required>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 6. فایل پیوست -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-paperclip text-indigo-500 ml-2"></i>
                                فایل پیوست
                                <span class="text-sm text-gray-500 font-normal">(اختیاری)</span>
                            </label>
                            <div class="border-2 border-dashed border-gray-300 rounded-lg p-4">
                                <input type="file" id="order-attachment-input" class="hidden"
                                       accept="image/*,.pdf,.doc,.docx"
                                       onchange="window.handleOrderFile(event, this)">
                                <div id="order-file-empty" class="text-center">
                                    <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
                                    <p class="text-gray-500 mb-2">فایل را آپلود کنید</p>
                                    <button type="button" 
                                            onclick="document.getElementById('order-attachment-input').click()"
                                            class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                        <i class="fas fa-upload ml-2"></i>
                                        انتخاب فایل
                                    </button>
                                </div>
                                <div id="order-file-selected" style="display:none;" class="flex items-center justify-between bg-white rounded-lg p-3 border">
                                    <div class="flex items-center">
                                        <i class="fas fa-file text-2xl text-indigo-500 ml-3"></i>
                                        <span id="order-file-name" class="text-gray-700"></span>
                                    </div>
                                    <button type="button" 
                                            onclick="window.clearOrderFile()"
                                            class="text-red-500 hover:text-red-700">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 7. توضیحات -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-comment text-indigo-500 ml-2"></i>
                                توضیحات
                            </label>
                            <textarea x-model="newOrder.description" rows="3"
                                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                      placeholder="توضیحات و جزئیات کار..."></textarea>
                        </div>
                        
                        <!-- 8. تخصیص به عامل -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-user-tie text-indigo-500 ml-2"></i>
                                تخصیص به عامل
                            </label>
                            <select x-model="newOrder.assignedAgent" 
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg">
                                <option value="">بدون تخصیص</option>
                                <option value="doc001">دکتر معصومی</option>
                                <option value="doc002">دکتر ذوقی</option>
                                <option value="agent001">دکتر فتحی</option>
                                <option value="agent002">دکتر سجادی</option>
                            </select>
                        </div>
                        
                        <!-- 9. هزینه کار -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-money-bill-wave text-indigo-500 ml-2"></i>
                                هزینه کار <span class="text-red-500">*</span>
                            </label>
                            <div class="flex space-x-2 space-x-reverse">
                                <input type="number" x-model="newOrder.cost" 
                                       class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                                       required placeholder="مبلغ" min="0">
                                <select x-model="newOrder.currency"
                                        class="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg bg-white">
                                    <option value="تومان">تومان</option>
                                    <option value="دلار">دلار</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- Submit Button -->
                        <div class="pt-4 border-t">
                            <button type="submit" 
                                    class="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg">
                                <i class="fas fa-check-circle ml-2"></i>
                                ثبت سفارش
                            </button>
                        </div>
                        
                    </form>
                </div>
            </div>
        `;
    }
};

// Alpine.js data function
function orderWizardData() {
    const data = {
        newOrder: {
            studentName: '',
            workType: '',
            university: '',
            universitySelect: '',
            field: '',
            fieldSelect: '',
            deadlineDate: '',
            deadlineTime: '',
            attachment: null,
            attachmentName: null,
            description: '',
            assignedAgent: '',
            cost: '',
            currency: 'تومان'
        },
        showCustomUniversity: false,
        showCustomField: false,
        
        submitOrder() {
            // Validation
            if (!this.newOrder.studentName) {
                alert('لطفاً نام دانشجو را وارد کنید');
                return;
            }
            if (!this.newOrder.workType) {
                alert('لطفاً نوع کار را انتخاب کنید');
                return;
            }
            if (!this.newOrder.university && !this.newOrder.universitySelect) {
                alert('لطفاً دانشگاه را انتخاب کنید');
                return;
            }
            if (!this.newOrder.field && !this.newOrder.fieldSelect) {
                alert('لطفاً رشته تحصیلی را انتخاب کنید');
                return;
            }
            if (!this.newOrder.deadlineDate || !this.newOrder.deadlineTime) {
                alert('لطفاً مهلت تحویل را مشخص کنید');
                return;
            }
            if (!this.newOrder.cost) {
                alert('لطفاً هزینه کار را وارد کنید');
                return;
            }
            
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const university = this.newOrder.university || this.newOrder.universitySelect;
            const field = this.newOrder.field || this.newOrder.fieldSelect;
            const orderId = 'ORD-' + Date.now();
            
            // ذخیره فایل جداگانه (برای جلوگیری از پر شدن localStorage)
            const attachmentData = this.newOrder.attachment || window._orderAttachment || null;
            const attachmentName = this.newOrder.attachmentName || window._orderAttachmentName || null;
            
            if (attachmentData && attachmentName) {
                try {
                    localStorage.setItem(`order_file_${orderId}`, attachmentData);
                } catch(e) {
                    console.warn('Could not save attachment, file too large:', e);
                }
            }
            
            // Build order object - بدون base64 فایل
            const order = {
                id: orderId,
                studentName: this.newOrder.studentName,
                type: this.newOrder.workType,
                university: university,
                field: field,
                deadline: `${this.newOrder.deadlineDate}T${this.newOrder.deadlineTime}`,
                attachmentName: attachmentName || null,
                hasAttachment: !!attachmentData,
                description: this.newOrder.description,
                assignedDoctorId: this.newOrder.assignedAgent || null,
                cost: parseFloat(this.newOrder.cost) || 0,
                currency: this.newOrder.currency || 'تومان',
                status: 'pending',
                createdAt: new Date().toISOString(),
                createdBy: currentUser.id || '',
                studentId: currentUser.role === 'student' ? currentUser.id : null
            };
            
            // ذخیره سفارش
            try {
                const storageKey = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.ORDERS) 
                    ? CONFIG.STORAGE_KEYS.ORDERS 
                    : 'edu_system_orders';
                
                const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
                existing.unshift(order);
                localStorage.setItem(storageKey, JSON.stringify(existing));
                
                // پاک کردن global فایل
                window._orderAttachment = null;
                window._orderAttachmentName = null;
                
                alert('✅ سفارش با موفقیت ثبت شد');
                this.$dispatch('close-modal');
                
                // Refresh orders page
                setTimeout(() => {
                    const app = document.querySelector('[x-data]')?.__x?.$data;
                    if (app && app.currentPage === 'orders') {
                        app.loadOrdersPageWithRetry();
                    }
                    window.dispatchEvent(new CustomEvent('orders-refresh'));
                }, 300);
                
            } catch (err) {
                console.error('Error saving order:', err);
                if (err.name === 'QuotaExceededError') {
                    // حذف فایل‌های قدیمی برای آزاد کردن فضا
                    this._cleanupOldFiles();
                    // دوباره امتحان
                    try {
                        const storageKey = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.ORDERS) 
                            ? CONFIG.STORAGE_KEYS.ORDERS 
                            : 'edu_system_orders';
                        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
                        existing.unshift(order);
                        localStorage.setItem(storageKey, JSON.stringify(existing));
                        alert('✅ سفارش ثبت شد (فایل پیوست به دلیل محدودیت حافظه ذخیره نشد)');
                        this.$dispatch('close-modal');
                    } catch(e2) {
                        alert('خطا: حافظه مرورگر پر است. لطفاً از صفحه Debug Panel گزینه Reset Data را بزنید یا داده‌های قدیمی را پاک کنید.');
                    }
                } else {
                    alert('خطا در ثبت سفارش: ' + err.message);
                }
            }
        },
        
        _cleanupOldFiles() {
            // پاک کردن فایل‌های پیوست قدیمی از localStorage
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('order_file_')) {
                    localStorage.removeItem(key);
                }
            });
        }
    };
    
    // ذخیره ref به data برای استفاده از دکمه حذف
    window._wizardData = () => {
        const el = document.querySelector('[x-data="orderWizardData()"]');
        if (el && el._x_dataStack) return el._x_dataStack[0];
        return null;
    };
    
    return data;
}

// توابع مدیریت فایل - خارج از Alpine برای سازگاری بهتر
window.handleOrderFile = function(event, input) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(ev) {
        // ذخیره در global
        window._orderAttachment = ev.target.result;
        window._orderAttachmentName = file.name;
        
        // به‌روزرسانی UI
        const emptyDiv = document.getElementById('order-file-empty');
        const selectedDiv = document.getElementById('order-file-selected');
        const nameSpan = document.getElementById('order-file-name');
        
        if (emptyDiv) emptyDiv.style.display = 'none';
        if (selectedDiv) selectedDiv.style.display = 'flex';
        if (nameSpan) nameSpan.textContent = file.name;
        
        // سعی در به‌روزرسانی Alpine
        try {
            const el = document.querySelector('[x-data="orderWizardData()"]');
            if (el && el._x_dataStack && el._x_dataStack[0]) {
                el._x_dataStack[0].newOrder.attachment = ev.target.result;
                el._x_dataStack[0].newOrder.attachmentName = file.name;
            }
        } catch(e) {}
    };
    reader.readAsDataURL(file);
};

window.clearOrderFile = function() {
    window._orderAttachment = null;
    window._orderAttachmentName = null;
    
    const input = document.getElementById('order-attachment-input');
    if (input) input.value = '';
    
    const emptyDiv = document.getElementById('order-file-empty');
    const selectedDiv = document.getElementById('order-file-selected');
    if (emptyDiv) emptyDiv.style.display = 'block';
    if (selectedDiv) selectedDiv.style.display = 'none';
    
    try {
        const el = document.querySelector('[x-data="orderWizardData()"]');
        if (el && el._x_dataStack && el._x_dataStack[0]) {
            el._x_dataStack[0].newOrder.attachment = null;
            el._x_dataStack[0].newOrder.attachmentName = null;
        }
    } catch(e) {}
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrderWizardModule;
}









