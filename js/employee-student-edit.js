// این فایل حاوی تابع ویرایش پروفایل دانشجو است که باید به employee.js اضافه شود

// جایگزین کردن تابع editStudentProfile در employeeModule
EmployeeModule.editStudentProfile = function(studentId) {
    const students = this.getAllStudents();
    const student = students.find(s => s.id === studentId);
    
    if (!student) {
        UTILS.showNotification('دانشجو یافت نشد', 'error');
        return;
    }
    
    // Initialize steps if not exist
    if (!student.educationalSteps) {
        student.educationalSteps = this.getDefaultEducationalSteps();
    }
    if (!student.defenseSteps) {
        student.defenseSteps = this.getDefaultDefenseSteps2();
    }
    
    const modalHTML = `
        <div id="edit-student-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg max-w-6xl w-full max-h-[95vh] overflow-y-auto">
                <div class="p-6 border-b border-blue-200 sticky top-0 bg-gradient-to-r from-blue-100 to-indigo-100 z-10">
                    <h3 class="text-xl font-bold text-blue-900">
                        <i class="fas fa-user-edit text-indigo-600 ml-2"></i>
                        ویرایش پروفایل دانشجو - ${student.name}
                    </h3>
                </div>
                
                <div class="p-6 space-y-6">
                    <!-- کارت مسیر تحصیلی -->
                    <div class="bg-white rounded-lg p-6 shadow-sm border border-blue-200">
                        <div class="flex items-center justify-between mb-4">
                            <h4 class="text-xl font-bold text-gray-800">
                                <i class="fas fa-route text-indigo-600 ml-2"></i>
                                مسیر تحصیلی
                            </h4>
                            <button onclick="employeeModule.finishStudentWork('${studentId}')" 
                                    class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-all">
                                <i class="fas fa-flag-checkered ml-2"></i>
                                اتمام کار
                            </button>
                        </div>
                        
                        <!-- Tabs Navigation -->
                        <div class="flex space-x-2 space-x-reverse mb-6 border-b border-gray-300">
                            <button onclick="employeeModule.switchPathTab('educational', '${studentId}')" 
                                    id="path-tab-educational"
                                    class="px-6 py-3 font-medium border-b-2 border-indigo-500 text-indigo-600 transition-all">
                                <i class="fas fa-graduation-cap ml-1"></i>
                                مراحل تحصیلی
                            </button>
                            <button onclick="employeeModule.switchPathTab('defense', '${studentId}')" 
                                    id="path-tab-defense"
                                    class="px-6 py-3 font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-800 transition-all">
                                <i class="fas fa-shield-alt ml-1"></i>
                                گردش دفاع
                            </button>
                            <button onclick="employeeModule.switchPathTab('requirements', '${studentId}')" 
                                    id="path-tab-requirements"
                                    class="px-6 py-3 font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-800 transition-all">
                                <i class="fas fa-tasks ml-1"></i>
                                ملزومات
                            </button>
                        </div>
                        
                        <!-- Tab Content: مراحل تحصیلی -->
                        <div id="path-content-educational">
                            ${this.getEducationalStepsTimeline(student)}
                        </div>
                        
                        <!-- Tab Content: گردش دفاع -->
                        <div id="path-content-defense" style="display: none;">
                            ${this.getDefenseStepsTimeline(student)}
                        </div>
                        
                        <!-- Tab Content: ملزومات -->
                        <div id="path-content-requirements" style="display: none;">
                            ${this.getRequirementsStepsTimeline(student)}
                        </div>
                    </div>
                    
                    <!-- اطلاعات شخصی -->
                    <div class="bg-white rounded-lg p-5 shadow-sm border border-blue-200">
                        <h4 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                            <i class="fas fa-user text-indigo-600 ml-2"></i>
                            اطلاعات شخصی
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">نام کامل</label>
                                <input type="text" id="edit-student-name" value="${student.name || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">شماره پاسپورت</label>
                                <input type="text" id="edit-passport" value="${student.passportNumber || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">تاریخ تولد</label>
                                <input type="date" id="edit-birthdate" value="${student.birthDate || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">جنسیت</label>
                                <select id="edit-gender" class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                                    <option value="مرد" ${student.gender === 'مرد' ? 'selected' : ''}>مرد</option>
                                    <option value="زن" ${student.gender === 'زن' ? 'selected' : ''}>زن</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">شماره تماس</label>
                                <input type="tel" id="edit-phone" value="${student.phone || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">ایمیل</label>
                                <input type="email" id="edit-email" value="${student.email || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                            </div>
                        </div>
                    </div>
                    
                    <!-- اطلاعات تحصیلی -->
                    <div class="bg-white rounded-lg p-5 shadow-sm border border-blue-200">
                        <h4 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                            <i class="fas fa-graduation-cap text-indigo-600 ml-2"></i>
                            اطلاعات تحصیلی
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">دانشگاه</label>
                                <select id="edit-university" class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                                    <option value="دانشگاه قم" ${student.university === 'دانشگاه قم' ? 'selected' : ''}>دانشگاه قم</option>
                                    <option value="جامعه المصطفی" ${student.university === 'جامعه المصطفی' ? 'selected' : ''}>جامعه المصطفی</option>
                                    <option value="سایر">سایر</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">شماره دانشجویی</label>
                                <input type="text" id="edit-student-id" value="${student.studentId || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">رمز سامانه</label>
                                <input type="text" id="edit-system-password" value="${student.systemPassword || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="رمز دسترسی به سامانه">
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">رشته تحصیلی</label>
                                <select id="edit-field" class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                                    <option value="حقوق محض" ${student.field === 'حقوق محض' ? 'selected' : ''}>حقوق محض</option>
                                    <option value="حقوق عمومی" ${student.field === 'حقوق عمومی' ? 'selected' : ''}>حقوق عمومی</option>
                                    <option value="حقوق خصوصی" ${student.field === 'حقوق خصوصی' ? 'selected' : ''}>حقوق خصوصی</option>
                                    <option value="حقوق بین‌الملل" ${student.field === 'حقوق بین‌الملل' ? 'selected' : ''}>حقوق بین‌الملل</option>
                                    <option value="سایر">سایر</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">مقطع</label>
                                <select id="edit-degree" class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                                    <option value="کارشناسی" ${student.degree === 'کارشناسی' ? 'selected' : ''}>کارشناسی</option>
                                    <option value="کارشناسی ارشد" ${student.degree === 'کارشناسی ارشد' ? 'selected' : ''}>کارشناسی ارشد</option>
                                    <option value="عاملا" ${student.degree === 'عاملا' ? 'selected' : ''}>عاملا</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">علاقه‌مندی تحقیقاتی</label>
                                <input type="text" id="edit-research-interest" value="${student.researchInterest || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="موضوع علاقه‌مندی">
                            </div>
                        </div>
                    </div>
                    
                    <!-- اطلاعات تخصصی -->
                    <div class="bg-white rounded-lg p-5 shadow-sm border border-blue-200">
                        <h4 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                            <i class="fas fa-briefcase text-indigo-600 ml-2"></i>
                            اطلاعات تخصصی
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">استاد راهنما</label>
                                <input type="text" id="edit-supervisor" value="${student.supervisor || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="نام استاد راهنما">
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">نویسنده (عامل مسئول)</label>
                                <input type="text" id="edit-writer" value="${student.writer || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="نام نویسنده">
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">تاریخ تحویل</label>
                                <input type="date" id="edit-delivery-date" value="${student.deliveryDate || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg">
                            </div>
                        </div>
                    </div>
                    
                    <!-- مدارک و تصاویر -->
                    <div class="bg-white rounded-lg p-5 shadow-sm border border-blue-200">
                        <h4 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                            <i class="fas fa-file-image text-indigo-600 ml-2"></i>
                            مدارک و تصاویر
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- تصویر امر اداری -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">تصویر امر اداری</label>
                                    <button type="button" onclick="employeeModule.uploadImage('admin-order-image', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-admin-order-image" value="${student.adminOrderImage || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="لینک یا توضیحات" readonly>
                                <div id="preview-admin-order-image" class="mt-2"></div>
                            </div>
                            
                            <!-- کد رهگیری سائورگ -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">کد رهگیری سائورگ</label>
                                    <button type="button" onclick="employeeModule.uploadImage('savorg-code', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-savorg-code" value="${student.savorgCode || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="کد رهگیری">
                                <div id="preview-savorg-code" class="mt-2"></div>
                            </div>
                            
                            <!-- نتیجه سامانه سجاد -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">نتیجه سامانه سجاد</label>
                                    <button type="button" onclick="employeeModule.uploadImage('sajad-result', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-sajad-result" value="${student.sajadResult || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="نتیجه" readonly>
                                <div id="preview-sajad-result" class="mt-2"></div>
                            </div>
                            
                            <!-- گواهی همانند جویی -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">گواهی همانند جویی</label>
                                    <button type="button" onclick="employeeModule.uploadImage('similarity-cert', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-similarity-cert" value="${student.similarityCert || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="توضیحات" readonly>
                                <div id="preview-similarity-cert" class="mt-2"></div>
                            </div>
                            
                            <!-- تصویر پاسپورت -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">تصویر پاسپورت</label>
                                    <button type="button" onclick="employeeModule.uploadImage('passport-image', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-passport-image" value="${student.passportImage || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="تصویر پاسپورت" readonly>
                                <div id="preview-passport-image" class="mt-2"></div>
                            </div>
                            
                            <!-- تنضید -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">تنضید</label>
                                    <button type="button" onclick="employeeModule.uploadImage('typesetting-doc', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-typesetting-doc" value="${student.typesettingDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="فایل تنضید" readonly>
                                <div id="preview-typesetting-doc" class="mt-2"></div>
                            </div>
                            
                            <!-- تجلید -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">تجلید</label>
                                    <button type="button" onclick="employeeModule.uploadImage('binding-doc', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-binding-doc" value="${student.bindingDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="تصویر تجلید" readonly>
                                <div id="preview-binding-doc" class="mt-2"></div>
                            </div>
                            
                            <!-- استلال -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">استلال</label>
                                    <button type="button" onclick="employeeModule.uploadImage('estelal-doc', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-estelal-doc" value="${student.estelalDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="مدرک استلال" readonly>
                                <div id="preview-estelal-doc" class="mt-2"></div>
                            </div>
                            
                            <!-- مدرک لغت -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">مدرک لغت</label>
                                    <button type="button" onclick="employeeModule.uploadImage('language-cert', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-language-cert" value="${student.languageCert || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="مدرک لغت" readonly>
                                <div id="preview-language-cert" class="mt-2"></div>
                            </div>
                            
                            <!-- بارگزاری لغت -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">بارگزاری لغت</label>
                                    <button type="button" onclick="employeeModule.uploadImage('language-upload', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-language-upload" value="${student.languageUpload || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="فایل لغت" readonly>
                                <div id="preview-language-upload" class="mt-2"></div>
                            </div>
                            
                            <!-- آزفا -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">آزفا</label>
                                    <button type="button" onclick="employeeModule.uploadImage('azfa-doc', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-azfa-doc" value="${student.azfaDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="مدرک آزفا" readonly>
                                <div id="preview-azfa-doc" class="mt-2"></div>
                            </div>
                            
                            <!-- تصدیق -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">تصدیق</label>
                                    <button type="button" onclick="employeeModule.uploadImage('tasdiq-doc', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-tasdiq-doc" value="${student.tasdiqDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="مدرک تصدیق" readonly>
                                <div id="preview-tasdiq-doc" class="mt-2"></div>
                            </div>
                            
                            <!-- وثیقه -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">وثیقه</label>
                                    <button type="button" onclick="employeeModule.uploadImage('vasiqe-doc', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-vasiqe-doc" value="${student.vasiqeDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="مدرک وثیقه" readonly>
                                <div id="preview-vasiqe-doc" class="mt-2"></div>
                            </div>
                            
                            <!-- ایران داک خطه -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">ایران داک خطه</label>
                                    <button type="button" onclick="employeeModule.uploadImage('irandoc-khate', '${studentId}')"
                                            class="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-irandoc-khate" value="${student.irandocKhate || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="ایران داک خطه" readonly>
                                <div id="preview-irandoc-khate" class="mt-2"></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- وضعیت -->
                    <div class="bg-white rounded-lg p-5 shadow-sm border border-blue-200">
                        <h4 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                            <i class="fas fa-toggle-on text-indigo-600 ml-2"></i>
                            وضعیت حساب
                        </h4>
                        <label class="flex items-center cursor-pointer">
                            <input type="checkbox" id="edit-active" ${student.active ? 'checked' : ''}
                                   class="w-6 h-6 text-indigo-600 bg-white border-gray-300 rounded">
                            <span class="mr-3 text-lg text-gray-800 font-medium">دانشجو فعال است</span>
                        </label>
                    </div>
                </div>
                
                <div class="p-6 border-t border-blue-200 bg-gray-50 flex justify-end space-x-3 space-x-reverse sticky bottom-0">
                    <button onclick="employeeModule.closeModal('edit-student-modal')" 
                            class="px-6 py-3 text-lg text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">
                        انصراف
                    </button>
                    <button onclick="employeeModule.saveStudentProfile('${studentId}')" 
                            class="px-6 py-3 text-lg bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">
                        <i class="fas fa-save ml-2"></i>
                        ذخیره تغییرات
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// جایگزین کردن تابع saveStudentProfile
EmployeeModule.saveStudentProfile = function(studentId) {
    // Get current student data to preserve educationalSteps and defenseSteps
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const currentStudent = studentsData[studentId] || {};
    
    const updatedData = {
        name: document.getElementById('edit-student-name').value,
        studentId: document.getElementById('edit-student-id').value,
        passportNumber: document.getElementById('edit-passport').value,
        birthDate: document.getElementById('edit-birthdate').value,
        gender: document.getElementById('edit-gender').value,
        phone: document.getElementById('edit-phone').value,
        email: document.getElementById('edit-email').value,
        university: document.getElementById('edit-university').value,
        systemPassword: document.getElementById('edit-system-password').value,
        field: document.getElementById('edit-field').value,
        degree: document.getElementById('edit-degree').value,
        researchInterest: document.getElementById('edit-research-interest').value,
        supervisor: document.getElementById('edit-supervisor').value,
        writer: document.getElementById('edit-writer').value,
        deliveryDate: document.getElementById('edit-delivery-date').value,
        orderType: document.getElementById('edit-order-type').value,
        committeeStatus: document.getElementById('edit-committee-status').value,
        irandocStatus: document.getElementById('edit-irandoc-status').value,
        secretariatStatus: document.getElementById('edit-secretariat-status').value,
        typesettingStatus: document.getElementById('edit-typesetting-status').value,
        summaryStatus: document.getElementById('edit-summary-status').value,
        similarityStatus: document.getElementById('edit-similarity-status').value,
        article1Status: document.getElementById('edit-article1-status').value,
        article2Status: document.getElementById('edit-article2-status').value,
        // مدارک و تصاویر
        adminOrderImage: document.getElementById('edit-admin-order-image').value,
        savorgCode: document.getElementById('edit-savorg-code').value,
        sajadResult: document.getElementById('edit-sajad-result').value,
        similarityCert: document.getElementById('edit-similarity-cert').value,
        passportImage: document.getElementById('edit-passport-image').value,
        typesettingDoc: document.getElementById('edit-typesetting-doc').value,
        bindingDoc: document.getElementById('edit-binding-doc').value,
        estelalDoc: document.getElementById('edit-estelal-doc').value,
        languageCert: document.getElementById('edit-language-cert').value,
        languageUpload: document.getElementById('edit-language-upload').value,
        azfaDoc: document.getElementById('edit-azfa-doc').value,
        tasdiqDoc: document.getElementById('edit-tasdiq-doc').value,
        vasiqeDoc: document.getElementById('edit-vasiqe-doc').value,
        irandocKhate: document.getElementById('edit-irandoc-khate').value,
        active: document.getElementById('edit-active').checked,
        // Preserve educational steps, defense steps, and requirements steps
        educationalSteps: currentStudent.educationalSteps || this.getDefaultEducationalSteps(),
        defenseSteps: currentStudent.defenseSteps || this.getDefaultDefenseSteps2(),
        requirementsSteps: currentStudent.requirementsSteps || this.getDefaultRequirementsSteps()
    };
    
    // Validation
    if (!updatedData.name || !updatedData.studentId) {
        UTILS.showNotification('لطفاً نام و شماره دانشجویی را وارد کنید', 'error');
        return;
    }
    
    // Update in DataModule if available
    if (typeof DataModule !== 'undefined' && DataModule.updateUser) {
        DataModule.updateUser(studentId, updatedData);
    }
    
    // Save to localStorage as backup
    studentsData[studentId] = { ...studentsData[studentId], ...updatedData, updatedAt: new Date().toISOString() };
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    this.closeModal('edit-student-modal');
    this.refreshStudents();
    UTILS.showNotification('پروفایل دانشجو با موفقیت به‌روزرسانی شد', 'success');
};


// تابع آپلود تصویر
EmployeeModule.uploadImage = function(fieldId, studentId) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    fileInput.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            
            // نمایش پیش‌نمایش
            const previewDiv = document.getElementById(`preview-${fieldId}`);
            if (previewDiv) {
                previewDiv.innerHTML = `
                    <div class="relative inline-block">
                        <img src="${imageData}" class="h-20 w-20 object-cover rounded-lg border-2 border-indigo-300">
                        <button type="button" onclick="employeeModule.removeImage('${fieldId}')"
                                class="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                `;
            }
            
            // ذخیره در input
            const input = document.getElementById(`edit-${fieldId}`);
            if (input) {
                input.value = imageData;
            }
            
            UTILS.showNotification('تصویر آپلود شد', 'success');
        };
        reader.readAsDataURL(file);
    };
    
    fileInput.click();
};

// تابع حذف تصویر
EmployeeModule.removeImage = function(fieldId) {
    const previewDiv = document.getElementById(`preview-${fieldId}`);
    if (previewDiv) {
        previewDiv.innerHTML = '';
    }
    
    const input = document.getElementById(`edit-${fieldId}`);
    if (input) {
        input.value = '';
    }
    
    UTILS.showNotification('تصویر حذف شد', 'success');
};
