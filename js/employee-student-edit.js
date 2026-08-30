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
            <div class="bg-gradient-to-br from-blue-50 to-lime-100 rounded-lg max-w-6xl w-full max-h-[95vh] overflow-y-auto">
                <div class="p-6 border-b border-blue-200 sticky top-0 bg-gradient-to-r from-blue-100 to-lime-100 z-10">
                    <div class="flex items-center justify-between flex-wrap gap-3">
                        <h3 class="text-xl font-bold text-black-900">
                            <i class="fas fa-user-edit text-lime-600 ml-2"></i>
                            ویرایش پروفایل دانشجو - ${student.name}
                        </h3>
                        <div class="flex items-center gap-2 flex-wrap">
                            <button onclick="employeeModule.completeStudentPath('${studentId}','defense')"
                                    title="تمام مراحل دفاع را تکمیل کن"
                                    class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-all text-xs flex items-center gap-1">
                                <i class="fas fa-shield-alt"></i>
                                <span>اتمام دفاع</span>
                            </button>
                            <button onclick="employeeModule.completeStudentPath('${studentId}','requirements')"
                                    title="تمام مراحل ملزومات را تکمیل کن"
                                    class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium transition-all text-xs flex items-center gap-1">
                                <i class="fas fa-clipboard-check"></i>
                                <span>اتمام ملزومات</span>
                            </button>
                            <button onclick="employeeModule.completeStudentPath('${studentId}','educational')"
                                    title="تمام مراحل فارغ‌التحصیلی را تکمیل کن"
                                    class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg font-medium transition-all text-xs flex items-center gap-1">
                                <i class="fas fa-graduation-cap"></i>
                                <span>اتمام فارغ‌التحصیلی</span>
                            </button>
                            <button onclick="employeeModule.finishStudentWork('${studentId}')" 
                                    class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-medium transition-all text-xs flex items-center gap-1">
                                <i class="fas fa-flag-checkered"></i>
                                <span>اتمام کار</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="p-6 space-y-6">
                    
                    <!-- اطلاعات شخصی -->
                    <div class="bg-white rounded-lg p-5 shadow-sm border border-blue-200">
                        <h4 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                            <i class="fas fa-user text-lime-600 ml-2"></i>
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
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">نام کامل (انگلیسی)</label>
                                <input type="text" id="edit-name-en" value="${student.nameEn || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" dir="ltr" placeholder="Full Name in English">
                            </div>
                            <div>
                                <label class="block text-base font-bold text-gray-800 mb-2">پسورد</label>
                                <input type="text" id="edit-password" value="${student.password || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="رمز عبور دانشجو">
                            </div>
                        </div>
                    </div>
                    
                    <!-- اطلاعات تحصیلی -->
                    <div class="bg-white rounded-lg p-5 shadow-sm border border-blue-200">
                        <h4 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                            <i class="fas fa-graduation-cap text-lime-600 ml-2"></i>
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
                                    <option value="حقوق جزا" ${student.field === 'حقوق محض' ? 'selected' : ''}>حقوق محض</option>
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
                                    <option value="دکتری" ${student.degree === 'دکتری' ? 'selected' : ''}>دکتری</option>
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
                            <i class="fas fa-briefcase text-lime-600 ml-2"></i>
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
                            <i class="fas fa-file-image text-lime-600 ml-2"></i>
                            مدارک و تصاویر
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- تصویر امر اداری -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">تصویر امر اداری</label>
                                    <button type="button" onclick="employeeModule.uploadImage('admin-order-image', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
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
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-irandoc-khate" value="${student.irandocKhate || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="ایران داک خطه" readonly>
                                <div id="preview-irandoc-khate" class="mt-2"></div>
                            </div>

                            <!-- ایران داک رساله -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">ایران داک رساله</label>
                                    <button type="button" onclick="employeeModule.uploadImage('irandoc-resale', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-irandoc-resale" value="${student.irandocResale || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="ایران داک رساله">
                                <div id="preview-irandoc-resale" class="mt-2"></div>
                            </div>

                            <!-- عنوان -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">عنوان</label>
                                    <button type="button" onclick="employeeModule.uploadImage('onvan-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-onvan-doc" value="${student.onvanDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="عنوان پایان‌نامه / متن">
                                <div id="preview-onvan-doc" class="mt-2"></div>
                            </div>

                            <!-- نتیجه عنوان -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">نتیجه عنوان</label>
                                    <button type="button" onclick="employeeModule.uploadImage('onvan-result', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-onvan-result" value="${student.onvanResult || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="نتیجه تایید عنوان">
                                <div id="preview-onvan-result" class="mt-2"></div>
                            </div>

                            <!-- برگه ثبت‌نام سائورگ -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">برگه ثبت‌نام سائورگ</label>
                                    <button type="button" onclick="employeeModule.uploadImage('savorg-form', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-savorg-form" value="${student.savorgForm || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="برگه ثبت‌نام سائورگ">
                                <div id="preview-savorg-form" class="mt-2"></div>
                            </div>

                            <!-- محضر -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">محضر</label>
                                    <button type="button" onclick="employeeModule.uploadImage('mahzar-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-mahzar-doc" value="${student.mahzarDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند محضر">
                                <div id="preview-mahzar-doc" class="mt-2"></div>
                            </div>

                            <!-- اصالت -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">اصالت</label>
                                    <button type="button" onclick="employeeModule.uploadImage('asalat-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-asalat-doc" value="${student.asalatDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند اصالت">
                                <div id="preview-asalat-doc" class="mt-2"></div>
                            </div>

                            <!-- تعدیل -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">تعدیل</label>
                                    <button type="button" onclick="employeeModule.uploadImage('tadil-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-tadil-doc" value="${student.tadilDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند تعدیل">
                                <div id="preview-tadil-doc" class="mt-2"></div>
                            </div>

                            <!-- تنزیل نمره گردش -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">تنزیل نمره گردش</label>
                                    <button type="button" onclick="employeeModule.uploadImage('tanzil-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-tanzil-doc" value="${student.tanzilDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند تنزیل نمره گردش">
                                <div id="preview-tanzil-doc" class="mt-2"></div>
                            </div>

                            <!-- حاتمی -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">حاتمی</label>
                                    <button type="button" onclick="employeeModule.uploadImage('hatami-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-hatami-doc" value="${student.hatamiDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند حاتمی">
                                <div id="preview-hatami-doc" class="mt-2"></div>
                            </div>

                            <!-- ختم تجلید -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">ختم تجلید</label>
                                    <button type="button" onclick="employeeModule.uploadImage('khatm-tajlid', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-khatm-tajlid" value="${student.khatmTajlid || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="ختم تجلید">
                                <div id="preview-khatm-tajlid" class="mt-2"></div>
                            </div>

                            <!-- ترجمه به اسماعیلی -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">ترجمه به اسماعیلی</label>
                                    <button type="button" onclick="employeeModule.uploadImage('tarjome-ismaili', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-tarjome-ismaili" value="${student.tarjomeIsmaili || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="ترجمه اسماعیلی">
                                <div id="preview-tarjome-ismaili" class="mt-2"></div>
                            </div>

                            <!-- ارسال -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">ارسال</label>
                                    <button type="button" onclick="employeeModule.uploadImage('ersal-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-ersal-doc" value="${student.ersalDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند ارسال">
                                <div id="preview-ersal-doc" class="mt-2"></div>
                            </div>

                            <!-- گردش -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">گردش</label>
                                    <button type="button" onclick="employeeModule.uploadImage('gardesh-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-gardesh-doc" value="${student.gardeshDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند گردش">
                                <div id="preview-gardesh-doc" class="mt-2"></div>
                            </div>

                            <!-- دادگر -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">دادگر</label>
                                    <button type="button" onclick="employeeModule.uploadImage('dadgar-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-dadgar-doc" value="${student.dadgarDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند دادگر">
                                <div id="preview-dadgar-doc" class="mt-2"></div>
                            </div>

                            <!-- سفارش تجلید -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">سفارش تجلید</label>
                                    <button type="button" onclick="employeeModule.uploadImage('sefaresh-tajlid', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-sefaresh-tajlid" value="${student.sefareshTajlid || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سفارش تجلید">
                                <div id="preview-sefaresh-tajlid" class="mt-2"></div>
                            </div>

                            <!-- مهر دانشگاه -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">مهر دانشگاه</label>
                                    <button type="button" onclick="employeeModule.uploadImage('mohr-daneshgah', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-mohr-daneshgah" value="${student.mohrDaneshgah || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="مهر دانشگاه">
                                <div id="preview-mohr-daneshgah" class="mt-2"></div>
                            </div>

                            <!-- مهر سفارت -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">مهر سفارت</label>
                                    <button type="button" onclick="employeeModule.uploadImage('mohr-sefarat', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-mohr-sefarat" value="${student.mohrSefarat || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="مهر سفارت">
                                <div id="preview-mohr-sefarat" class="mt-2"></div>
                            </div>

                            <!-- قطعی -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">قطعی</label>
                                    <button type="button" onclick="employeeModule.uploadImage('qatei-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-qatei-doc" value="${student.qateiDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند قطعی">
                                <div id="preview-qatei-doc" class="mt-2"></div>
                            </div>

                            <!-- امر اداری -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">امر اداری</label>
                                    <button type="button" onclick="employeeModule.uploadImage('amr-edari', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-amr-edari" value="${student.amrEdari || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="امر اداری">
                                <div id="preview-amr-edari" class="mt-2"></div>
                            </div>

                            <!-- ملخص -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">ملخص</label>
                                    <button type="button" onclick="employeeModule.uploadImage('molakhas-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-molakhas-doc" value="${student.molakhasDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="ملخص پایان‌نامه">
                                <div id="preview-molakhas-doc" class="mt-2"></div>
                            </div>

                            <!-- علاقه -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">علاقه (لجنه)</label>
                                    <button type="button" onclick="employeeModule.uploadImage('alaqe-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-alaqe-doc" value="${student.alaqeDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند علاقه / لجنه">
                                <div id="preview-alaqe-doc" class="mt-2"></div>
                            </div>

                            <!-- لجنه -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">لجنه</label>
                                    <button type="button" onclick="employeeModule.uploadImage('lajna-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-lajna-doc" value="${student.lajnaDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند لجنه">
                                <div id="preview-lajna-doc" class="mt-2"></div>
                            </div>

                            <!-- استاد (لجنه) -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">استاد (لجنه)</label>
                                    <button type="button" onclick="employeeModule.uploadImage('ostad-lajna', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-ostad-lajna" value="${student.ostadLajna || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="نام استاد لجنه">
                                <div id="preview-ostad-lajna" class="mt-2"></div>
                            </div>

                            <!-- تعدیلات -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">تعدیلات</label>
                                    <button type="button" onclick="employeeModule.uploadImage('tadilat-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-tadilat-doc" value="${student.tadilatDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند تعدیلات">
                                <div id="preview-tadilat-doc" class="mt-2"></div>
                            </div>

                            <!-- تحویل -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-base font-bold text-gray-800">تحویل</label>
                                    <button type="button" onclick="employeeModule.uploadImage('tahvil-doc', '${studentId}')"
                                            class="w-10 h-10 bg-lime-100 hover:bg-lime-200 rounded-lg flex items-center justify-center text-lime-600">
                                        <i class="fas fa-camera text-lg"></i>
                                    </button>
                                </div>
                                <input type="text" id="edit-tahvil-doc" value="${student.tahvilDoc || ''}"
                                       class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-lg" placeholder="سند تحویل">
                                <div id="preview-tahvil-doc" class="mt-2"></div>
                            </div>

                        </div>
                    </div>
                    
                    <!-- وضعیت -->
                    <div class="bg-white rounded-lg p-5 shadow-sm border border-blue-200">
                        <h4 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                            <i class="fas fa-toggle-on text-lime-600 ml-2"></i>
                            وضعیت حساب
                        </h4>
                        <label class="flex items-center cursor-pointer">
                            <input type="checkbox" id="edit-active" ${student.active ? 'checked' : ''}
                                   class="w-6 h-6 text-lime-600 bg-white border-gray-300 rounded">
                            <span class="mr-3 text-lg text-gray-800 font-medium">دانشجو فعال است</span>
                        </label>
                    </div>
                </div>
                
                <div class="p-6 border-t border-blue-200 bg-gray-50 flex justify-end space-x-3 space-x-reverse sticky bottom-0" style="z-index:10;">
                    <button type="button" onclick="employeeModule.closeModal('edit-student-modal')" 
                            class="px-6 py-3 text-lg text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">
                        انصراف
                    </button>
                    <button type="button" id="save-student-btn-${studentId}"
                            onclick="employeeModule.saveStudentProfile('${studentId}')" 
                            class="px-6 py-3 text-lg bg-lime-600 hover:bg-lime-700 text-white rounded-lg font-medium flex items-center gap-2">
                        <i class="fas fa-save"></i>
                        ذخیره تغییرات
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // لود مدارک از Supabase و نمایش preview
    EmployeeModule._loadStudentDocumentPreviews(studentId);
};

// جایگزین کردن تابع saveStudentProfile
EmployeeModule.saveStudentProfile = async function(studentId) {
    // disable دکمه ذخیره
    const saveBtn = document.getElementById(`save-student-btn-${studentId}`) ||
                    document.querySelector(`button[onclick*="saveStudentProfile('${studentId}')"]`);
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...'; }

    // Get current student data to preserve steps
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const currentStudent = studentsData[studentId] || {};

    const updatedData = {
        name:               document.getElementById('edit-student-name')?.value      || '',
        studentId:          document.getElementById('edit-student-id')?.value        || '',
        passportNumber:     document.getElementById('edit-passport')?.value          || '',
        birthDate:          document.getElementById('edit-birthdate')?.value         || '',
        gender:             document.getElementById('edit-gender')?.value            || '',
        phone:              document.getElementById('edit-phone')?.value             || '',
        email:              document.getElementById('edit-email')?.value             || '',
        nameEn:             document.getElementById('edit-name-en')?.value           || '',
        password:           document.getElementById('edit-password')?.value          || '',
        university:         document.getElementById('edit-university')?.value        || '',
        systemPassword:     document.getElementById('edit-system-password')?.value  || '',
        field:              document.getElementById('edit-field')?.value             || '',
        degree:             document.getElementById('edit-degree')?.value            || '',
        researchInterest:   document.getElementById('edit-research-interest')?.value|| '',
        supervisor:         document.getElementById('edit-supervisor')?.value        || '',
        writer:             document.getElementById('edit-writer')?.value            || '',
        deliveryDate:       document.getElementById('edit-delivery-date')?.value     || '',
        orderType:          document.getElementById('edit-order-type')?.value        || '',
        committeeStatus:    document.getElementById('edit-committee-status')?.value  || '',
        irandocStatus:      document.getElementById('edit-irandoc-status')?.value    || '',
        secretariatStatus:  document.getElementById('edit-secretariat-status')?.value|| '',
        typesettingStatus:  document.getElementById('edit-typesetting-status')?.value|| '',
        summaryStatus:      document.getElementById('edit-summary-status')?.value    || '',
        similarityStatus:   document.getElementById('edit-similarity-status')?.value || '',
        article1Status:     document.getElementById('edit-article1-status')?.value   || '',
        article2Status:     document.getElementById('edit-article2-status')?.value   || '',
        active:             document.getElementById('edit-active')?.checked          ?? true,
        educationalSteps:   currentStudent.educationalSteps  || this.getDefaultEducationalSteps?.() || [],
        defenseSteps:       currentStudent.defenseSteps      || this.getDefaultDefenseSteps2?.()    || [],
        requirementsSteps:  currentStudent.requirementsSteps || this.getDefaultRequirementsSteps?.()|| [],
    };

    // مدارک — path های ذخیره‌شده در inputs
    const documents = {
        admin_order_image:  document.getElementById('edit-admin-order-image')?.value  || null,
        savorg_code:        document.getElementById('edit-savorg-code')?.value         || null,
        sajad_result:       document.getElementById('edit-sajad-result')?.value        || null,
        similarity_cert:    document.getElementById('edit-similarity-cert')?.value     || null,
        passport_image:     document.getElementById('edit-passport-image')?.value      || null,
        typesetting_doc:    document.getElementById('edit-typesetting-doc')?.value     || null,
        binding_doc:        document.getElementById('edit-binding-doc')?.value         || null,
        estelal_doc:        document.getElementById('edit-estelal-doc')?.value         || null,
        language_cert:      document.getElementById('edit-language-cert')?.value       || null,
        language_upload:    document.getElementById('edit-language-upload')?.value     || null,
        azfa_doc:           document.getElementById('edit-azfa-doc')?.value            || null,
        tasdiq_doc:         document.getElementById('edit-tasdiq-doc')?.value          || null,
        vasiqe_doc:         document.getElementById('edit-vasiqe-doc')?.value          || null,
        irandoc_khate:      document.getElementById('edit-irandoc-khate')?.value       || null,
        // فیلدهای جدید
        irandoc_resale:     document.getElementById('edit-irandoc-resale')?.value      || null,
        onvan_doc:          document.getElementById('edit-onvan-doc')?.value           || null,
        onvan_result:       document.getElementById('edit-onvan-result')?.value        || null,
        savorg_form:        document.getElementById('edit-savorg-form')?.value         || null,
        mahzar_doc:         document.getElementById('edit-mahzar-doc')?.value          || null,
        asalat_doc:         document.getElementById('edit-asalat-doc')?.value          || null,
        tadil_doc:          document.getElementById('edit-tadil-doc')?.value           || null,
        tanzil_doc:         document.getElementById('edit-tanzil-doc')?.value          || null,
        hatami_doc:         document.getElementById('edit-hatami-doc')?.value          || null,
        khatm_tajlid:       document.getElementById('edit-khatm-tajlid')?.value        || null,
        tarjome_ismaili:    document.getElementById('edit-tarjome-ismaili')?.value     || null,
        ersal_doc:          document.getElementById('edit-ersal-doc')?.value           || null,
        gardesh_doc:        document.getElementById('edit-gardesh-doc')?.value         || null,
        dadgar_doc:         document.getElementById('edit-dadgar-doc')?.value          || null,
        sefaresh_tajlid:    document.getElementById('edit-sefaresh-tajlid')?.value     || null,
        mohr_daneshgah:     document.getElementById('edit-mohr-daneshgah')?.value      || null,
        mohr_sefarat:       document.getElementById('edit-mohr-sefarat')?.value        || null,
        qatei_doc:          document.getElementById('edit-qatei-doc')?.value           || null,
        amr_edari:          document.getElementById('edit-amr-edari')?.value           || null,
        molakhas_doc:       document.getElementById('edit-molakhas-doc')?.value        || null,
        alaqe_doc:          document.getElementById('edit-alaqe-doc')?.value           || null,
        lajna_doc:          document.getElementById('edit-lajna-doc')?.value           || null,
        ostad_lajna:        document.getElementById('edit-ostad-lajna')?.value         || null,
        tadilat_doc:        document.getElementById('edit-tadilat-doc')?.value         || null,
        tahvil_doc:         document.getElementById('edit-tahvil-doc')?.value          || null,
    };
    // همگام‌سازی با updatedData برای localStorage
    Object.assign(updatedData, {
        adminOrderImage:  documents.admin_order_image,
        savorgCode:       documents.savorg_code,
        sajadResult:      documents.sajad_result,
        similarityCert:   documents.similarity_cert,
        passportImage:    documents.passport_image,
        typesettingDoc:   documents.typesetting_doc,
        bindingDoc:       documents.binding_doc,
        estelalDoc:       documents.estelal_doc,
        languageCert:     documents.language_cert,
        languageUpload:   documents.language_upload,
        azfaDoc:          documents.azfa_doc,
        tasdiqDoc:        documents.tasdiq_doc,
        vasiqeDoc:        documents.vasiqe_doc,
        irandocKhate:     documents.irandoc_khate,
        // فیلدهای جدید
        irandocResale:    documents.irandoc_resale,
        onvanDoc:         documents.onvan_doc,
        onvanResult:      documents.onvan_result,
        savorgForm:       documents.savorg_form,
        mahzarDoc:        documents.mahzar_doc,
        asalatDoc:        documents.asalat_doc,
        tadilDoc:         documents.tadil_doc,
        tanzilDoc:        documents.tanzil_doc,
        hatamiDoc:        documents.hatami_doc,
        khatmTajlid:      documents.khatm_tajlid,
        tarjomeIsmaili:   documents.tarjome_ismaili,
        ersalDoc:         documents.ersal_doc,
        gardeshDoc:       documents.gardesh_doc,
        dadgarDoc:        documents.dadgar_doc,
        sefareshTajlid:   documents.sefaresh_tajlid,
        mohrDaneshgah:    documents.mohr_daneshgah,
        mohrSefarat:      documents.mohr_sefarat,
        qateiDoc:         documents.qatei_doc,
        amrEdari:         documents.amr_edari,
        molakhasDoc:      documents.molakhas_doc,
        alaqeDoc:         documents.alaqe_doc,
        lajnaDoc:         documents.lajna_doc,
        ostadLajna:       documents.ostad_lajna,
        tadilatDoc:       documents.tadilat_doc,
        tahvilDoc:        documents.tahvil_doc,
    });

    // Validation
    if (!updatedData.name || !updatedData.studentId) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save ml-2"></i>ذخیره تغییرات'; }
        UTILS.showNotification('لطفاً نام و شماره دانشجویی را وارد کنید', 'error');
        return;
    }

    // ── ۱. ذخیره اطلاعات پایه در profiles (Supabase) ──────────
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
        if (client) {
            const profilePayload = {
                name:            updatedData.name,
                phone:           updatedData.phone       || null,
                email:           updatedData.email       || null,
                university:      updatedData.university  || null,
                student_id:      updatedData.studentId   || null,
                field:           updatedData.field       || null,
                degree:          updatedData.degree      || null,
                passport_number: updatedData.passportNumber || null,
                active:          updatedData.active,
            };
            const { error: profileErr } = await client
                .from('profiles')
                .update(profilePayload)
                .eq('id', studentId);
            if (profileErr) console.warn('profiles update:', profileErr.message);
        }
    } catch(e) { console.warn('profiles update error:', e); }

    // ── ۲. ذخیره مدارک در student_documents (Supabase) ────────
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
        if (client) {
            const cu = (() => { try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch { return {}; } })();
            const docPayload = {
                student_id:     studentId,
                updated_by:     cu.id   || null,
                updated_by_name:cu.name || null,
                ...documents
            };
            // null ها رو حذف کن تا مقادیر قبلی رو overwrite نکنه
            Object.keys(docPayload).forEach(k => {
                if (docPayload[k] === null || docPayload[k] === '') delete docPayload[k];
            });
            docPayload.student_id = studentId; // همیشه باید باشه

            const { error: docErr } = await client
                .from('student_documents')
                .upsert(docPayload, { onConflict: 'student_id' });
            if (docErr) console.warn('student_documents upsert:', docErr.message);
        }
    } catch(e) { console.warn('student_documents error:', e); }

    // ── ۳. ذخیره در localStorage ──────────────────────────────
    if (typeof DataModule !== 'undefined' && DataModule.updateUser) {
        DataModule.updateUser(studentId, updatedData);
    }
    studentsData[studentId] = { ...studentsData[studentId], ...updatedData, updatedAt: new Date().toISOString() };
    localStorage.setItem('students_data', JSON.stringify(studentsData));

    this.closeModal('edit-student-modal');
    this.refreshStudents?.();
    UTILS.showNotification('پروفایل دانشجو با موفقیت ذخیره شد ✓', 'success');
};


// ── helper: آپلود به Supabase Storage ─────────────────────────
EmployeeModule._uploadToStorage = async function(file, studentId, fieldId) {
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
        if (!client) return null;
        const ext  = file.name.split('.').pop();
        const path = `${studentId}/${fieldId}_${Date.now()}.${ext}`;
        const { data, error } = await client.storage
            .from('student-documents')
            .upload(path, file, { cacheControl: '3600', upsert: true });
        if (error) { console.error('uploadToStorage:', error.message); return null; }
        return data.path;
    } catch(e) {
        console.error('uploadToStorage exception:', e);
        return null;
    }
};

// ── helper: signed URL برای نمایش ──────────────────────────────
EmployeeModule._getStorageUrl = async function(path) {
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
        if (!client || !path) return null;
        const { data } = await client.storage
            .from('student-documents')
            .createSignedUrl(path, 3600);
        return data?.signedUrl || null;
    } catch { return null; }
};

// تابع آپلود تصویر — با Supabase Storage
EmployeeModule.uploadImage = function(fieldId, studentId) {
    const fileInput = document.createElement('input');
    fileInput.type   = 'file';
    fileInput.accept = 'image/*,.pdf';

    fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // نمایش loading
        const previewDiv = document.getElementById(`preview-${fieldId}`);
        if (previewDiv) {
            previewDiv.innerHTML = `<div class="flex items-center gap-2 text-gray-500 text-sm">
                <i class="fas fa-spinner fa-spin text-lime-500"></i> در حال آپلود...</div>`;
        }

        // ۱. آپلود به Supabase Storage
        const storagePath = await EmployeeModule._uploadToStorage(file, studentId, fieldId);

        // ۲. گرفتن signed URL برای نمایش
        let displayUrl = null;
        if (storagePath) {
            displayUrl = await EmployeeModule._getStorageUrl(storagePath);
        }

        // ۳. fallback: اگر Storage نبود، base64 بساز
        if (!storagePath) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const b64 = e.target.result;
                _applyImageResult(fieldId, b64, b64, file.name);
                // برگرداندن focus به modal
                document.getElementById(`save-student-btn-${studentId}`)?.focus();
            };
            reader.readAsDataURL(file);
            return;
        }

        _applyImageResult(fieldId, storagePath, displayUrl || storagePath, file.name);
        // برگرداندن focus به modal تا دکمه ذخیره کلیک‌پذیر باشه
        document.getElementById(`save-student-btn-${studentId}`)?.focus();
        UTILS.showNotification('تصویر آپلود شد ✓', 'success');
    };

    fileInput.click();
};

// اعمال نتیجه آپلود به فرم
function _applyImageResult(fieldId, storageValue, displayUrl, fileName) {
    // ذخیره path در hidden input
    const input = document.getElementById(`edit-${fieldId}`);
    if (input) input.value = storageValue;

    // نمایش preview
    const previewDiv = document.getElementById(`preview-${fieldId}`);
    if (!previewDiv) return;
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName) || displayUrl?.startsWith('data:image');
    if (isImage) {
        previewDiv.innerHTML = `
            <div class="relative inline-block">
                <img src="${displayUrl}" alt="${fileName}"
                     class="h-20 w-20 object-cover rounded-lg border-2 border-lime-300 cursor-pointer"
                     onclick="window.open('${displayUrl}','_blank')"
                     onerror="this.src='';this.alt='خطا در نمایش'">
                <button type="button" onclick="employeeModule.removeImage('${fieldId}')"
                        class="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </div>`;
    } else {
        previewDiv.innerHTML = `
            <div class="relative inline-flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg text-sm text-gray-700">
                <i class="fas fa-file text-lime-500"></i>
                <span class="max-w-32 truncate">${fileName}</span>
                <button type="button" onclick="employeeModule.removeImage('${fieldId}')"
                        class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-xs">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;
    }
}

// تابع حذف تصویر
EmployeeModule.removeImage = function(fieldId) {
    const previewDiv = document.getElementById(`preview-${fieldId}`);
    if (previewDiv) previewDiv.innerHTML = '';
    const input = document.getElementById(`edit-${fieldId}`);
    if (input) input.value = '';
    UTILS.showNotification('تصویر حذف شد', 'info');
};

// ── لود مدارک از Supabase و نمایش preview ──────────────────────
EmployeeModule._loadStudentDocumentPreviews = async function(studentId) {
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
        if (!client) return;

        const { data, error } = await client
            .from('student_documents')
            .select('*')
            .eq('student_id', studentId)
            .single();

        if (error || !data) return;

        // نقشه fieldId → مقدار ذخیره‌شده
        const fieldMap = {
            'admin-order-image': data.admin_order_image,
            'savorg-code':       data.savorg_code,
            'sajad-result':      data.sajad_result,
            'similarity-cert':   data.similarity_cert,
            'passport-image':    data.passport_image,
            'typesetting-doc':   data.typesetting_doc,
            'binding-doc':       data.binding_doc,
            'estelal-doc':       data.estelal_doc,
            'language-cert':     data.language_cert,
            'language-upload':   data.language_upload,
            'azfa-doc':          data.azfa_doc,
            'tasdiq-doc':        data.tasdiq_doc,
            'vasiqe-doc':        data.vasiqe_doc,
            'irandoc-khate':     data.irandoc_khate,
            // فیلدهای جدید
            'irandoc-resale':    data.irandoc_resale,
            'onvan-doc':         data.onvan_doc,
            'onvan-result':      data.onvan_result,
            'savorg-form':       data.savorg_form,
            'mahzar-doc':        data.mahzar_doc,
            'asalat-doc':        data.asalat_doc,
            'tadil-doc':         data.tadil_doc,
            'tanzil-doc':        data.tanzil_doc,
            'hatami-doc':        data.hatami_doc,
            'khatm-tajlid':      data.khatm_tajlid,
            'tarjome-ismaili':   data.tarjome_ismaili,
            'ersal-doc':         data.ersal_doc,
            'gardesh-doc':       data.gardesh_doc,
            'dadgar-doc':        data.dadgar_doc,
            'sefaresh-tajlid':   data.sefaresh_tajlid,
            'mohr-daneshgah':    data.mohr_daneshgah,
            'mohr-sefarat':      data.mohr_sefarat,
            'qatei-doc':         data.qatei_doc,
            'amr-edari':         data.amr_edari,
            'molakhas-doc':      data.molakhas_doc,
            'alaqe-doc':         data.alaqe_doc,
            'lajna-doc':         data.lajna_doc,
            'ostad-lajna':       data.ostad_lajna,
            'tadilat-doc':       data.tadilat_doc,
            'tahvil-doc':        data.tahvil_doc,
        };

        for (const [fieldId, storagePath] of Object.entries(fieldMap)) {
            if (!storagePath) continue;

            // مقدار رو در input بذار
            const input = document.getElementById(`edit-${fieldId}`);
            if (input) input.value = storagePath;

            // signed URL بگیر و preview نشون بده
            const url = await EmployeeModule._getStorageUrl(storagePath);
            if (!url) continue;

            const fileName = storagePath.split('/').pop() || fieldId;
            _applyImageResult(fieldId, storagePath, url, fileName);
        }
    } catch(e) {
        console.warn('_loadStudentDocumentPreviews:', e.message);
    }
};
