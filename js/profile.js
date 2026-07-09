// Profile Management Module
const ProfileModule = {
    // Get profile content
    getProfileContent(user) {
        return `
            <div class="space-y-6">
                <!-- Profile Header -->
                <div class="bg-gradient-to-r from-blue-500 to-yellow-600 text-white rounded-lg p-6">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <div class="h-20 w-20 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                            <span class="text-3xl font-bold">${user.name.charAt(0)}</span>
                        </div>
                        <div>
                            <h2 class="text-2xl font-bold">${user.name}</h2>
                            <p class="text-blue-100">${this.getRoleText(user.role)}</p>
                            <p class="text-blue-100 text-sm">عضو از: ${UTILS.formatDate(user.createdAt)}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Profile Information -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Personal Information -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h3 class="text-lg font-bold mb-4 text-gray-800">اطلاعات شخصی</h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">نام کامل</label>
                                <input type="text" value="${user.name}" 
                                       class="form-control" readonly>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">نام کاربری</label>
                                <input type="text" value="${user.username}" 
                                       class="form-control" readonly>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">ایمیل</label>
                                <input type="email" value="${user.email || ''}" 
                                       class="form-control" id="profile-email">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">تلفن</label>
                                <input type="text" value="${user.phone || ''}" 
                                       class="form-control" id="profile-phone">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Role Specific Information -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h3 class="text-lg font-bold mb-4 text-gray-800">اطلاعات تخصصی</h3>
                        <div class="space-y-4">
                            ${this.getRoleSpecificFields(user)}
                        </div>
                    </div>
                </div>
                
                <!-- Statistics -->
                ${this.getProfileStats(user)}
                
                <!-- Actions -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h3 class="text-lg font-bold mb-4 text-gray-800">عملیات</h3>
                    <div class="flex space-x-4 space-x-reverse">
                        <button onclick="window.updateProfile()" 
                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium btn">
                            <i class="fas fa-save ml-2"></i>
                            ذخیره تغییرات
                        </button>
                        <button onclick="window.showModal = 'changePassword'" 
                                class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium btn">
                            <i class="fas fa-key ml-2"></i>
                            تغییر رمز عبور
                        </button>
                        <button onclick="window.downloadProfile()" 
                                class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium btn">
                            <i class="fas fa-download ml-2"></i>
                            دانلود اطلاعات
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get role specific fields
    getRoleSpecificFields(user) {
        switch(user.role) {
            case CONFIG.ROLES.STUDENT:
                return `
                    <!-- Basic Academic Info -->
                    <div class="border-b pb-4 mb-4">
                        <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-graduation-cap ml-1 text-blue-500"></i> اطلاعات تحصیلی</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">دانشگاه</label>
                                <select class="form-control" id="profile-university">
                                    <option value="دانشگاه قم" ${user.university === 'دانشگاه قم' ? 'selected' : ''}>دانشگاه قم</option>
                                    <option value="جامعه المصطفی" ${user.university === 'جامعه المصطفی' ? 'selected' : ''}>جامعه المصطفی</option>
                                    <option value="سایر" ${!['دانشگاه قم', 'جامعه المصطفی'].includes(user.university) ? 'selected' : ''}>سایر</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">شماره دانشجویی</label>
                                <input type="text" value="${user.studentId || ''}" class="form-control" id="profile-studentId">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">رمز سامانه</label>
                                <input type="text" value="${user.systemPassword || ''}" class="form-control" id="profile-systemPassword" placeholder="رمز سامانه دانشگاه">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">رشته تحصیلی</label>
                                <select class="form-control" id="profile-field">
                                    <option value="حقوق محض" ${user.field === 'حقوق محض' ? 'selected' : ''}>حقوق محض</option>
                                    <option value="حقوق عمومی" ${user.field === 'حقوق عمومی' ? 'selected' : ''}>حقوق عمومی</option>
                                    <option value="حقوق خصوصی" ${user.field === 'حقوق خصوصی' ? 'selected' : ''}>حقوق خصوصی</option>
                                    <option value="حقوق بین‌الملل" ${user.field === 'حقوق بین‌الملل' ? 'selected' : ''}>حقوق بین‌الملل</option>
                                    <option value="سایر" ${!['حقوق محض', 'حقوق عمومی', 'حقوق خصوصی', 'حقوق بین‌الملل'].includes(user.field) ? 'selected' : ''}>سایر</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">مقطع</label>
                                <select class="form-control" id="profile-degree">
                                    <option value="ارشد" ${user.degree === 'ارشد' ? 'selected' : ''}>کارشناسی ارشد</option>
                                    <option value="عاملا" ${user.degree === 'عاملا' || user.degree === 'دكتراه' ? 'selected' : ''}>عاملا</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">علاقه‌مندی تحقیقاتی</label>
                                <input type="text" value="${user.interest || ''}" class="form-control" id="profile-interest" placeholder="موضوع علاقه‌مندی">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Order & Progress -->
                    <div class="border-b pb-4 mb-4">
                        <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-tasks ml-1 text-green-500"></i> وضعیت سفارش</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">نوع سفارش</label>
                                <select class="form-control" id="profile-orderType">
                                    <option value="">انتخاب کنید</option>
                                    <option value="نوشتن رساله" ${user.orderType === 'نوشتن رساله' ? 'selected' : ''}>نوشتن رساله</option>
                                    <option value="نوشتن مقاله" ${user.orderType === 'نوشتن مقاله' ? 'selected' : ''}>نوشتن مقاله</option>
                                    <option value="ترجمه رساله" ${user.orderType === 'ترجمه رساله' ? 'selected' : ''}>ترجمه رساله</option>
                                    <option value="تلخیص" ${user.orderType === 'تلخیص' ? 'selected' : ''}>تلخیص</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">وضعیت لجنه</label>
                                <select class="form-control" id="profile-committeeStatus">
                                    <option value="">انتخاب کنید</option>
                                    <option value="در انتظار" ${user.committeeStatus === 'در انتظار' ? 'selected' : ''}>در انتظار</option>
                                    <option value="تایید شده" ${user.committeeStatus === 'تایید شده' ? 'selected' : ''}>تایید شده</option>
                                    <option value="نیاز به اصلاح" ${user.committeeStatus === 'نیاز به اصلاح' ? 'selected' : ''}>نیاز به اصلاح</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">وضعیت ایران‌داک</label>
                                <select class="form-control" id="profile-irandocStatus">
                                    <option value="">انتخاب کنید</option>
                                    <option value="ثبت نشده" ${user.irandocStatus === 'ثبت نشده' ? 'selected' : ''}>ثبت نشده</option>
                                    <option value="در حال بررسی" ${user.irandocStatus === 'در حال بررسی' ? 'selected' : ''}>در حال بررسی</option>
                                    <option value="تایید شده" ${user.irandocStatus === 'تایید شده' ? 'selected' : ''}>تایید شده</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">استاد راهنما</label>
                                <input type="text" value="${user.supervisor || ''}" class="form-control" id="profile-supervisor" placeholder="نام استاد راهنما">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">نویسنده (عامل مسئول)</label>
                                <input type="text" value="${user.assignedWriter || ''}" class="form-control" id="profile-assignedWriter" placeholder="نام نویسنده">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">تاریخ تحویل</label>
                                <input type="date" value="${user.deliveryDate || ''}" class="form-control" id="profile-deliveryDate">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Additional Services -->
                    <div>
                        <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-cogs ml-1 text-yellow-500"></i> خدمات اضافی</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">وضعیت امورداری</label>
                                <select class="form-control" id="profile-adminStatus">
                                    <option value="">انتخاب کنید</option>
                                    <option value="انجام نشده" ${user.adminStatus === 'انجام نشده' ? 'selected' : ''}>انجام نشده</option>
                                    <option value="در حال انجام" ${user.adminStatus === 'در حال انجام' ? 'selected' : ''}>در حال انجام</option>
                                    <option value="تکمیل شده" ${user.adminStatus === 'تکمیل شده' ? 'selected' : ''}>تکمیل شده</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">وضعیت تنضید</label>
                                <select class="form-control" id="profile-typingStatus">
                                    <option value="">انتخاب کنید</option>
                                    <option value="انجام نشده" ${user.typingStatus === 'انجام نشده' ? 'selected' : ''}>انجام نشده</option>
                                    <option value="در حال انجام" ${user.typingStatus === 'در حال انجام' ? 'selected' : ''}>در حال انجام</option>
                                    <option value="تکمیل شده" ${user.typingStatus === 'تکمیل شده' ? 'selected' : ''}>تکمیل شده</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">وضعیت تلخیص</label>
                                <select class="form-control" id="profile-summaryStatus">
                                    <option value="">انتخاب کنید</option>
                                    <option value="انجام نشده" ${user.summaryStatus === 'انجام نشده' ? 'selected' : ''}>انجام نشده</option>
                                    <option value="در حال انجام" ${user.summaryStatus === 'در حال انجام' ? 'selected' : ''}>در حال انجام</option>
                                    <option value="تکمیل شده" ${user.summaryStatus === 'تکمیل شده' ? 'selected' : ''}>تکمیل شده</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">وضعیت همانند </label>
                                <select class="form-control" id="profile-peerReviewStatus">
                                    <option value="">انتخاب کنید</option>
                                    <option value="انجام نشده" ${user.peerReviewStatus === 'انجام نشده' ? 'selected' : ''}>انجام نشده</option>
                                    <option value="در حال انجام" ${user.peerReviewStatus === 'در حال انجام' ? 'selected' : ''}>در حال انجام</option>
                                    <option value="تکمیل شده" ${user.peerReviewStatus === 'تکمیل شده' ? 'selected' : ''}>تکمیل شده</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">وضعیت مقاله ۱</label>
                                <select class="form-control" id="profile-article1Status">
                                    <option value="">انتخاب کنید</option>
                                    <option value="شروع نشده" ${user.article1Status === 'شروع نشده' ? 'selected' : ''}>شروع نشده</option>
                                    <option value="در حال نوشتن" ${user.article1Status === 'در حال نوشتن' ? 'selected' : ''}>در حال نوشتن</option>
                                    <option value="ارسال شده" ${user.article1Status === 'ارسال شده' ? 'selected' : ''}>ارسال شده</option>
                                    <option value="پذیرش شده" ${user.article1Status === 'پذیرش شده' ? 'selected' : ''}>پذیرش شده</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">وضعیت مقاله ۲</label>
                                <select class="form-control" id="profile-article2Status">
                                    <option value="">انتخاب کنید</option>
                                    <option value="شروع نشده" ${user.article2Status === 'شروع نشده' ? 'selected' : ''}>شروع نشده</option>
                                    <option value="در حال نوشتن" ${user.article2Status === 'در حال نوشتن' ? 'selected' : ''}>در حال نوشتن</option>
                                    <option value="ارسال شده" ${user.article2Status === 'ارسال شده' ? 'selected' : ''}>ارسال شده</option>
                                    <option value="پذیرش شده" ${user.article2Status === 'پذیرش شده' ? 'selected' : ''}>پذیرش شده</option>
                                </select>
                            </div>
                        </div>
                    </div>
                `;
            case CONFIG.ROLES.DOCTOR:
                return `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">تخصص</label>
                        <input type="text" value="${user.specialization || ''}" 
                               class="form-control" id="profile-specialization">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">مدرک</label>
                        <input type="text" value="${user.degree || ''}" 
                               class="form-control" id="profile-degree">
                    </div>
                `;
            case CONFIG.ROLES.TRANSLATOR:
                return `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">زبان‌های تسلط</label>
                        <input type="text" value="${user.languages ? user.languages.join(', ') : ''}" 
                               class="form-control" id="profile-languages">
                    </div>
                `;
            case CONFIG.ROLES.employee:
                return `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">بخش</label>
                        <input type="text" value="${user.department || ''}" 
                               class="form-control" id="profile-department">
                    </div>
                `;
            default:
                return '<p class="text-gray-500">اطلاعات تخصصی موجود نیست</p>';
        }
    },
    
    // Get profile statistics
    getProfileStats(user) {
        const orders = DataModule.getOrders();
        let stats = {};
        
        switch(user.role) {
            case CONFIG.ROLES.STUDENT:
                const studentOrders = orders.filter(o => o.studentId === user.id);
                stats = {
                    totalOrders: studentOrders.length,
                    completedOrders: studentOrders.filter(o => o.status === CONFIG.ORDER_STATUS.COMPLETED).length,
                    totalSpent: studentOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0),
                    avgProgress: studentOrders.length > 0 ? 
                        Math.round(studentOrders.reduce((sum, o) => sum + o.progress, 0) / studentOrders.length) : 0
                };
                break;
                
            case CONFIG.ROLES.DOCTOR:
                const doctorOrders = orders.filter(o => o.assignedDoctorId === user.id);
                stats = {
                    totalAssigned: doctorOrders.length,
                    completedOrders: doctorOrders.filter(o => o.status === CONFIG.ORDER_STATUS.COMPLETED).length,
                    totalEarned: doctorOrders.reduce((sum, o) => sum + (o.doctorShare || 0), 0),
                    avgRating: 4.5 // Mock rating
                };
                break;
                
            case CONFIG.ROLES.MANAGER:
                stats = {
                    totalOrders: orders.length,
                    totalRevenue: orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0),
                    totalUsers: DataModule.getUsers().length,
                    completionRate: orders.length > 0 ? 
                        Math.round((orders.filter(o => o.status === CONFIG.ORDER_STATUS.COMPLETED).length / orders.length) * 100) : 0
                };
                break;
                
            default:
                return '';
        }
        
        return `
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-bold mb-4 text-gray-800">آمار عملکرد</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    ${Object.entries(stats).map(([key, value]) => `
                        <div class="text-center">
                            <p class="text-2xl font-bold text-blue-600">${typeof value === 'number' && key.includes('total') ? UTILS.formatCurrency(value) : value}</p>
                            <p class="text-sm text-gray-600">${this.getStatLabel(key)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    
    // Update profile
    updateProfile() {
        // Get current user from global app state
        const currentUser = window.Alpine ? 
            document.querySelector('[x-data]').__x.$data.currentUser : 
            { id: 'mgr001', role: 'manager' };
            
        const users = DataModule.getUsers();
        const userIndex = users.findIndex(u => u.id === currentUser.id);
        
        if (userIndex === -1) {
            UTILS.showNotification('خطا در به‌روزرسانی پروفایل', 'error');
            return;
        }
        
        // Get updated data from form
        const updatedData = {
            email: document.getElementById('profile-email')?.value || '',
            phone: document.getElementById('profile-phone')?.value || ''
        };
        
        // Add role-specific fields
        switch(currentUser.role) {
            case CONFIG.ROLES.STUDENT:
                updatedData.university = document.getElementById('profile-university')?.value || '';
                updatedData.studentId = document.getElementById('profile-studentId')?.value || '';
                updatedData.systemPassword = document.getElementById('profile-systemPassword')?.value || '';
                updatedData.field = document.getElementById('profile-field')?.value || '';
                updatedData.degree = document.getElementById('profile-degree')?.value || '';
                updatedData.interest = document.getElementById('profile-interest')?.value || '';
                updatedData.orderType = document.getElementById('profile-orderType')?.value || '';
                updatedData.committeeStatus = document.getElementById('profile-committeeStatus')?.value || '';
                updatedData.irandocStatus = document.getElementById('profile-irandocStatus')?.value || '';
                updatedData.supervisor = document.getElementById('profile-supervisor')?.value || '';
                updatedData.assignedWriter = document.getElementById('profile-assignedWriter')?.value || '';
                updatedData.deliveryDate = document.getElementById('profile-deliveryDate')?.value || '';
                updatedData.adminStatus = document.getElementById('profile-adminStatus')?.value || '';
                updatedData.typingStatus = document.getElementById('profile-typingStatus')?.value || '';
                updatedData.summaryStatus = document.getElementById('profile-summaryStatus')?.value || '';
                updatedData.peerReviewStatus = document.getElementById('profile-peerReviewStatus')?.value || '';
                updatedData.article1Status = document.getElementById('profile-article1Status')?.value || '';
                updatedData.article2Status = document.getElementById('profile-article2Status')?.value || '';
                break;
            case CONFIG.ROLES.DOCTOR:
                updatedData.specialization = document.getElementById('profile-specialization')?.value || '';
                updatedData.degree = document.getElementById('profile-degree')?.value || '';
                break;
            case CONFIG.ROLES.TRANSLATOR:
                const languages = document.getElementById('profile-languages')?.value || '';
                updatedData.languages = languages.split(',').map(lang => lang.trim()).filter(lang => lang);
                break;
            case CONFIG.ROLES.employee:
                updatedData.department = document.getElementById('profile-department')?.value || '';
                break;
        }
        
        // Update user data
        users[userIndex] = { ...users[userIndex], ...updatedData };
        DataModule.saveUsers(users);
        
        // Update current user in localStorage
        localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(users[userIndex]));
        
        UTILS.showNotification('پروفایل با موفقیت به‌روزرسانی شد', 'success');
    },
    
    // Helper methods
    getThemeOptions() {
        if (typeof ThemeManager === 'undefined') {
            return '<p class="text-gray-500">مدیر تم یافت نشد</p>';
        }
        
        const themes = ThemeManager.getThemesList();
        const currentTheme = ThemeManager.getCurrentTheme();
        
        return themes.map(theme => `
            <button 
                onclick="ThemeManager.applyTheme('${theme.id}')"
                class="flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                    currentTheme === theme.id 
                        ? 'border-blue-600 bg-blue-50 shadow-lg' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }"
            >
                <span class="text-4xl mb-2">${theme.icon}</span>
                <span class="text-sm font-medium text-gray-700">${theme.name}</span>
                ${currentTheme === theme.id ? '<i class="fas fa-check text-blue-600 mt-1"></i>' : ''}
            </button>
        `).join('');
    },
    
    getRoleText(role) {
        const texts = {
            [CONFIG.ROLES.MANAGER]: 'مدیر سیستم',
            [CONFIG.ROLES.employee]: 'کارمند',
            [CONFIG.ROLES.DOCTOR]: 'عامل و نویسنده',
            [CONFIG.ROLES.STUDENT]: 'دانشجو',
            [CONFIG.ROLES.TRANSLATOR]: 'مترجم'
        };
        return texts[role] || role;
    },
    
    getStatLabel(key) {
        const labels = {
            totalOrders: 'کل سفارشات',
            completedOrders: 'تکمیل شده',
            totalSpent: 'کل هزینه',
            avgProgress: 'میانگین پیشرفت',
            totalAssigned: 'تخصیص یافته',
            totalEarned: 'کل درآمد',
            avgRating: 'امتیاز میانگین',
            totalRevenue: 'کل درآمد',
            totalUsers: 'کل کاربران',
            completionRate: 'نرخ تکمیل'
        };
        return labels[key] || key;
    }
};