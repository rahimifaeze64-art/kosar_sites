// Order Wizard Module - ماژول فرم سفارش ساده شده
const OrderWizardModule = {
    // لیست انواع کارها
    workTypes: [
        'عناوین رساله ارشد', 'عناوین رساله دکتری', 'عناوین مقاله',
        'پروپوزال رساله ارشد', 'پروپوزال رساله دکتری', 'پروپوزال مقاله',
        'رساله ارشد', 'رساله دکتری', 'مقاله', 'تعدیل', 'تنضید', 'ترجمه',
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
        'دانشگاه قم', 'جامعه المصطفی', 'دانشگاه تهران', 'سایر'
    ],
    
    // لیست رشته‌ها
    fields: [
        'حقوق جزا و جرم شناسی', 'حقوق عمومی', 'حقوق خصوصی', 'حقوق بین‌الملل',
        'علوم سیاسی', 'فلسفه', 'اقتصاد', 'مدیریت', 'سایر'
    ],
    
    // Get the wizard modal
    getWizardModal() {
        return `
            <div x-data="orderWizardData()" x-init="init()">
                <div class="p-6 border-b border-gray-200 bg-gradient-to-r from-lime-600 to-lime-600 relative">
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
                        
                        <!-- 1. نام دانشجو - با dropdown سرچ + امکان ورود دستی -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-user text-lime-500 ml-2"></i>
                                نام دانشجو <span class="text-red-500">*</span>
                            </label>
                            <!-- جستجو و انتخاب از دانشجویان موجود -->
                            <div class="relative mb-2">
                                <input type="text" id="wiz-student-search"
                                       x-model="studentSearch"
                                       @input="filterStudents()"
                                       @focus="showStudentDropdown = true"
                                       @keydown.escape="showStudentDropdown = false"
                                       placeholder="جستجو در بین دانشجویان موجود..."
                                       autocomplete="off"
                                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-base pr-10">
                                <i class="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                                <!-- لیست کشویی دانشجویان -->
                                <div x-show="showStudentDropdown && filteredStudents.length > 0"
                                     @click.outside="showStudentDropdown = false"
                                     class="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                    <template x-for="st in filteredStudents" :key="st.id">
                                        <div @click="selectStudent(st)"
                                             class="px-4 py-2.5 hover:bg-lime-50 cursor-pointer flex items-center gap-2 border-b border-gray-100 last:border-0">
                                            <div class="w-7 h-7 rounded-full bg-lime-100 text-lime-700 flex items-center justify-center text-xs font-bold flex-shrink-0"
                                                 x-text="(st.name||'?').charAt(0)"></div>
                                            <div>
                                                <p class="text-sm font-medium text-gray-800" x-text="st.name"></p>
                                                <p class="text-xs text-gray-400" x-text="st.university || st.field || ''"></p>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            </div>
                            <!-- ورود دستی نام دانشجو -->
                            <div class="mt-1">
                                <label class="block text-sm text-gray-500 mb-1">
                                    <i class="fas fa-keyboard ml-1 text-gray-400"></i>
                                    یا نام دانشجو را وارد کنید (اگر در لیست نیست):
                                </label>
                                <input type="text" x-model="newOrder.studentName"
                                       class="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-base bg-white"
                                       placeholder="نام و نام خانوادگی دانشجو"
                                       required>
                            </div>
                        </div>
                        
                        <!-- 2. نوع کار - با قابلیت سرچ -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-tasks text-lime-500 ml-2"></i>
                                نوع کار <span class="text-red-500">*</span>
                            </label>
                            <div class="relative">
                                <input type="text" id="wiz-worktype-search"
                                       x-model="workTypeSearch"
                                       @input="filterWorkTypes()"
                                       @focus="showWorkTypeDropdown = true"
                                       @keydown.escape="showWorkTypeDropdown = false"
                                       placeholder="جستجو در نوع کار..."
                                       autocomplete="off"
                                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-lg pr-10">
                                <i class="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                                <div x-show="showWorkTypeDropdown && filteredWorkTypes.length > 0"
                                     @click.outside="showWorkTypeDropdown = false"
                                     class="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                                    <template x-for="wt in filteredWorkTypes" :key="wt">
                                        <div @click="selectWorkType(wt)"
                                             class="px-4 py-2.5 hover:bg-lime-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                                             :class="newOrder.workType === wt ? 'bg-lime-50 font-semibold text-lime-700' : 'text-gray-700'"
                                             x-text="wt"></div>
                                    </template>
                                </div>
                            </div>
                            <!-- نمایش مقدار انتخاب‌شده -->
                            <div x-show="newOrder.workType" class="mt-1.5 flex items-center gap-2">
                                <span class="text-xs text-gray-500">انتخاب‌شده:</span>
                                <span class="text-sm font-semibold text-lime-700 bg-lime-50 px-2 py-0.5 rounded" x-text="newOrder.workType"></span>
                                <button type="button" @click="newOrder.workType=''; workTypeSearch=''; filterWorkTypes()"
                                        class="text-gray-400 hover:text-red-500 text-xs"><i class="fas fa-times"></i></button>
                            </div>
                            <input type="hidden" x-model="newOrder.workType" required>
                        </div>
                        
                        <!-- 3. دانشگاه -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-university text-lime-500 ml-2"></i>
                                دانشگاه <span class="text-red-500">*</span>
                            </label>
                            <div class="flex space-x-2 space-x-reverse">
                                <select x-model="newOrder.universitySelect" 
                                        class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-lg"
                                        required
                                        @change="showCustomUniversity = (newOrder.universitySelect === 'سایر'); 
                                                 if(!showCustomUniversity) newOrder.university = newOrder.universitySelect;">
                                    <option value="">انتخاب دانشگاه...</option>
                                    ${this.universities.map(u => `<option value="${u}">${u}</option>`).join('')}
                                </select>
                            </div>
                            <input x-show="showCustomUniversity" type="text" x-model="newOrder.university" 
                                   class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-lg"
                                   placeholder="نام دانشگاه را وارد کنید">
                        </div>
                        
                        <!-- 4. رشته -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-graduation-cap text-lime-500 ml-2"></i>
                                رشته تحصیلی <span class="text-red-500">*</span>
                            </label>
                            <div class="flex space-x-2 space-x-reverse">
                                <select x-model="newOrder.fieldSelect" 
                                        class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-lg"
                                        required
                                        @change="showCustomField = (newOrder.fieldSelect === 'سایر'); 
                                                 if(!showCustomField) newOrder.field = newOrder.fieldSelect;">
                                    <option value="">انتخاب رشته...</option>
                                    ${this.fields.map(f => `<option value="${f}">${f}</option>`).join('')}
                                </select>
                            </div>
                            <input x-show="showCustomField" type="text" x-model="newOrder.field" 
                                   class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-lg"
                                   placeholder="نام رشته را وارد کنید">
                        </div>
                        
                        <!-- 5. مهلت تحویل - روز و ساعت -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-calendar-alt text-lime-500 ml-2"></i>
                                مهلت تحویل <span class="text-red-500">*</span>
                            </label>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm text-gray-600 mb-1">تاریخ (شمسی)</label>
                                    <!-- hidden input نگهدارنده مقدار میلادی — بدون x-model چون datepicker مستقیم value را ست می‌کند -->
                                    <input type="hidden" id="wiz-deadline-date">
                                    <!-- input شمسی — کتابخانه jalalidatepicker آن را کنترل می‌کند -->
                                    <input type="text"
                                           id="wiz-deadline-date-jdp"
                                           data-jdp
                                           data-jdp-target-value-input="#wiz-deadline-date"
                                           data-jdp-target-value-type="gregorian"
                                           placeholder="انتخاب تاریخ شمسی"
                                           autocomplete="off"
                                           readonly
                                           class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-base cursor-pointer bg-white">
                                </div>
                                <div>
                                    <label class="block text-sm text-gray-600 mb-1">ساعت (مثال: 14:30)</label>
                                    <input type="text"
                                           x-model="newOrder.deadlineTime"
                                           placeholder="مثال: 14:30"
                                           pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                                           maxlength="5"
                                           dir="ltr"
                                           oninput="this.value=this.value.replace(/[^0-9:]/g,''); if(this.value.length===2 && !this.value.includes(':')) this.value+=':';"
                                           class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 font-mono text-left"
                                           required>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 6. فایل پیوست -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-paperclip text-lime-500 ml-2"></i>
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
                                            class="px-4 py-2 bg-lime-600 text-gray-900 rounded-lg hover:bg-lime-700">
                                        <i class="fas fa-upload ml-2"></i>
                                        انتخاب فایل
                                    </button>
                                </div>
                                <div id="order-file-selected" style="display:none;" class="flex items-center justify-between bg-white rounded-lg p-3 border">
                                    <div class="flex items-center">
                                        <i class="fas fa-file text-2xl text-lime-500 ml-3"></i>
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
                                <i class="fas fa-comment text-lime-500 ml-2"></i>
                                توضیحات
                            </label>
                            <textarea x-model="newOrder.description" rows="3"
                                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                                      placeholder="توضیحات و جزئیات کار..."></textarea>
                        </div>
                        
                        <!-- 8. تخصیص به عامل -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-user-tie text-lime-500 ml-2"></i>
                                تخصیص به عامل
                            </label>
                            <select x-model="newOrder.assignedAgent" 
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-lg">
                                <option value="">بدون تخصیص</option>
                                <option value="doc001">دکتر معصومی</option>
                                <option value="doc002">دکتر ذوقی</option>
                                <option value="agent001">دکتر فتحی</option>
                                <option value="agent002">دکتر حمیدی</option>
                            </select>
                        </div>
                        
                        <!-- 9. هزینه کار -->
                        <div>
                            <label class="block text-lg font-bold text-gray-800 mb-2">
                                <i class="fas fa-money-bill-wave text-lime-500 ml-2"></i>
                                هزینه کار <span class="text-red-500">*</span>
                            </label>
                            <div class="flex space-x-2 space-x-reverse">
                                <input type="number" x-model="newOrder.cost" 
                                       class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-lg"
                                       required placeholder="مبلغ" min="0">
                                <select x-model="newOrder.currency"
                                        class="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-lg bg-white">
                                    <option value="تومان">تومان</option>
                                    <option value="دلار">دلار</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- Submit Button -->
                        <div class="pt-4 border-t">
                            <button type="submit" 
                                    class="w-full py-4 bg-gradient-to-r from-lime-600 to-lime-600 text-gray-900 rounded-lg font-bold text-lg hover:from-lime-700 hover:to-lime-700 transition-all shadow-lg">
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

    // ── بارگذاری لیست دانشجویان از DataModule / localStorage ──
    function _loadStudents() {
        try {
            if (typeof DataModule !== 'undefined' && DataModule.getUsers) {
                const all = DataModule.getUsers();
                if (Array.isArray(all) && all.length) {
                    return all.filter(u => u.role === 'student');
                }
            }
        } catch(e) {}
        try {
            const raw = localStorage.getItem('edu_system_users');
            if (raw) {
                const all = JSON.parse(raw);
                return Array.isArray(all) ? all.filter(u => u.role === 'student') : [];
            }
        } catch(e) {}
        // fallback: students_data
        try {
            const raw = localStorage.getItem('students_data');
            if (raw) {
                const obj = JSON.parse(raw);
                return Object.values(obj).map(s => ({
                    id: s.id || s.studentId || String(Math.random()),
                    name: s.name || s.studentName || '',
                    university: s.university || '',
                    field: s.field || '',
                    role: 'student'
                })).filter(s => s.name);
            }
        } catch(e) {}
        return [];
    }

    const ALL_WORK_TYPES = (typeof OrderWizardModule !== 'undefined')
        ? OrderWizardModule.workTypes
        : ['عناوین رساله ارشد','عناوین رساله دکتری','عناوین مقاله','پروپوزال رساله ارشد',
           'پروپوزال رساله دکتری','پروپوزال مقاله','رساله ارشد','رساله دکتری','مقاله',
           'تعدیل','تنضید','ترجمه','سایر'];

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

        // ── student search ──
        studentSearch: '',
        showStudentDropdown: false,
        allStudents: [],
        filteredStudents: [],

        // ── work-type search ──
        workTypeSearch: '',
        showWorkTypeDropdown: false,
        allWorkTypes: ALL_WORK_TYPES,
        filteredWorkTypes: ALL_WORK_TYPES,

        init() {
            this.allStudents = _loadStudents();
            this.filteredStudents = [];
            this.filteredWorkTypes = [...this.allWorkTypes];
            setTimeout(function() {
                if (typeof jalaliDatepicker !== 'undefined') {
                    jalaliDatepicker.startWatch({ selector: '#wiz-deadline-date-jdp' });
                } else if (typeof JalaliPicker !== 'undefined') {
                    JalaliPicker.attachById('wiz-deadline-date');
                }
            }, 50);
        },

        // خواندن تاریخ مستقیم از DOM و تبدیل به میلادی YYYY-MM-DD
        _getDeadlineDate() {
            var hAll = document.querySelectorAll('#wiz-deadline-date');
            var jAll = document.querySelectorAll('#wiz-deadline-date-jdp');
            var h = hAll.length ? hAll[hAll.length - 1] : null;
            var j = jAll.length  ? jAll[jAll.length  - 1] : null;

            // اول hidden input را بررسی کن (باید gregorian باشد)
            var val = (h && h.value) ? h.value : (j && j.value) ? j.value : '';
            if (!val) return '';

            // اگر مقدار میلادی معتبر بود (YYYY-MM-DD) همان را برگردان
            if (/^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(new Date(val).getTime())) {
                return val;
            }

            // اگر شمسی بود (1403/05/24 یا 1403-05-24) آن را تبدیل کن
            var jalaliMatch = val.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
            if (jalaliMatch) {
                var jy = parseInt(jalaliMatch[1]);
                var jm = parseInt(jalaliMatch[2]);
                var jd = parseInt(jalaliMatch[3]);
                // فقط اعداد شمسی (سال بین 1300 تا 1500) را تبدیل کن
                if (jy >= 1300 && jy <= 1500) {
                    try {
                        var g;
                        if (typeof Jalali !== 'undefined' && Jalali.toGregorian) {
                            g = Jalali.toGregorian(jy, jm, jd);
                        } else {
                            g = this._jalaliToGregorian(jy, jm, jd);
                        }
                        if (g && g.gy) {
                            var gy = String(g.gy);
                            var gm = String(g.gm).padStart(2, '0');
                            var gd = String(g.gd).padStart(2, '0');
                            return gy + '-' + gm + '-' + gd;
                        }
                    } catch(e) {}
                }
            }

            // اگر هیچ‌کدام نبود، همان مقدار خام را برگردان
            return val;
        },

        // تبدیل شمسی به میلادی (fallback اگر Jalali موجود نباشد)
        _jalaliToGregorian(jy, jm, jd) {
            var i = 621 + (jy <= 979 ? 0 : 979);
            jy -= (jy <= 979 ? 0 : 979);
            var days = 365 * jy + Math.floor((jy + 3) / 4) * 8 + Math.floor((jy % 33 + 3) / 4) + 78
                + jd + (jm <= 6 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
            i += 400 * Math.floor(days / 146097);
            days %= 146097;
            if (days > 36524) { i += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
            i += 4 * Math.floor(days / 1461);
            days %= 1461;
            if (days > 365) { i += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
            var gd = days + 1;
            var months = [0,31,(i%4===0&&i%100!==0||i%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
            var gm;
            for (gm = 0; gm < 13; gm++) { if (gd <= months[gm]) break; gd -= months[gm]; }
            return { gy: i, gm: gm, gd: gd };
        },

        filterStudents() {
            const q = (this.studentSearch || '').trim().toLowerCase();
            if (!q) { this.filteredStudents = []; this.showStudentDropdown = false; return; }
            this.filteredStudents = this.allStudents.filter(s =>
                (s.name || '').toLowerCase().includes(q) ||
                (s.university || '').toLowerCase().includes(q)
            ).slice(0, 10);
            this.showStudentDropdown = this.filteredStudents.length > 0;
        },

        selectStudent(st) {
            this.newOrder.studentName = st.name || '';
            this.studentSearch = '';
            this.filteredStudents = [];
            this.showStudentDropdown = false;
            // پر کردن خودکار دانشگاه اگر خالی باشد
            if (!this.newOrder.universitySelect && st.university) {
                const unis = (typeof OrderWizardModule !== 'undefined') ? OrderWizardModule.universities : [];
                if (unis.includes(st.university)) {
                    this.newOrder.universitySelect = st.university;
                    this.newOrder.university = st.university;
                } else {
                    this.newOrder.universitySelect = 'سایر';
                    this.newOrder.university = st.university;
                    this.showCustomUniversity = true;
                }
            }
        },

        filterWorkTypes() {
            const q = (this.workTypeSearch || '').trim().toLowerCase();
            if (!q) { this.filteredWorkTypes = [...this.allWorkTypes]; return; }
            this.filteredWorkTypes = this.allWorkTypes.filter(w => w.toLowerCase().includes(q));
            this.showWorkTypeDropdown = true;
        },

        selectWorkType(wt) {
            this.newOrder.workType = wt;
            this.workTypeSearch = wt;
            this.showWorkTypeDropdown = false;
        },

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
            // تاریخ را همیشه مستقیم از DOM بخوان
            var _deadlineDate = this._getDeadlineDate();
            if (!_deadlineDate) {
                alert('لطفاً تاریخ تحویل را انتخاب کنید');
                return;
            }
            if (!this.newOrder.deadlineTime) {
                alert('لطفاً ساعت تحویل را مشخص کنید');
                return;
            }
            // اعتبارسنجی فرمت ساعت
            const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timePattern.test(this.newOrder.deadlineTime)) {
                alert('لطفاً ساعت را به فرمت صحیح وارد کنید (مثال: 14:30)');
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
            
            // مقدار تاریخ را از DOM بخوان (Gregorian YYYY-MM-DD)
            const deadlineDate = _deadlineDate;
            
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
            const deadlineTime = this.newOrder.deadlineTime || '00:00';
            const order = {
                id: orderId,
                studentName: this.newOrder.studentName,
                type: this.newOrder.workType,
                university: university,
                field: field,
                deadline: `${deadlineDate}T${deadlineTime}`,
                deadlineDateTime: `${deadlineDate}T${deadlineTime}`,
                attachmentName: attachmentName || null,
                hasAttachment: !!attachmentData,
                description: this.newOrder.description,
                assignedDoctorId: this.newOrder.assignedAgent || null,
                assignedAgentId:  this.newOrder.assignedAgent || null,
                totalAmount: parseFloat(this.newOrder.cost) || 0,
                cost: parseFloat(this.newOrder.cost) || 0,
                currency: this.newOrder.currency || 'تومان',
                paidAmount: 0,
                paymentStatus: 'unpaid',
                revenueAgentPercent: 60,
                revenueManagerPercent: 40,
                status: 'pending',
                progress: 0,
                tasks: [],
                workLog: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: currentUser.id || '',
                studentId: currentUser.role === 'student' ? currentUser.id : null
            };
            
            // ذخیره سفارش از طریق DataModule (تا Supabase هم sync شود)
            try {
                if (typeof DataModule !== 'undefined') {
                    const existing = DataModule.getOrders();
                    existing.unshift(order);
                    DataModule.saveOrders(existing);
                } else {
                    // fallback مستقیم
                    const storageKey = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.ORDERS)
                        ? CONFIG.STORAGE_KEYS.ORDERS
                        : 'edu_system_orders';
                    const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
                    existing.unshift(order);
                    localStorage.setItem(storageKey, JSON.stringify(existing));
                }
                
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
                    this._cleanupOldFiles();
                    try {
                        if (typeof DataModule !== 'undefined') {
                            const existing = DataModule.getOrders();
                            existing.unshift(order);
                            DataModule.saveOrders(existing);
                        }
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









