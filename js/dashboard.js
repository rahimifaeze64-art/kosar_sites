// Dashboard Module
const DashboardModule = {
    // Helper function for currency formatting
    formatCurrency(amount) {
        try {
            if (typeof UTILS !== 'undefined' && UTILS.formatCurrency) {
                return UTILS.formatCurrency(amount);
            } else {
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }).format(amount || 0);
            }
        } catch (error) {
            return `$${(amount || 0).toFixed(2)}`;
        }
    },

    // Get dashboard content based on user role
    getDashboardContent(userRole) {
        try {
            debugLogger(`Loading dashboard for role: ${userRole}`, 'info');
            
            switch(userRole) {
                case CONFIG.ROLES.MANAGER:
                    return this.getManagerDashboard();
                case CONFIG.ROLES.employee:
                    return this.getemployeeDashboard();
                case CONFIG.ROLES.DOCTOR:
                    return this.getDoctorDashboard();
                case CONFIG.ROLES.STUDENT:
                    return this.getStudentDashboard();
                case CONFIG.ROLES.TRANSLATOR:
                    return this.getTranslatorDashboard();
                case CONFIG.ROLES.AGENT:
                    return this.getAgentDashboard();
                default:
                    debugLogger(`Unknown role: ${userRole}`, 'warning');
                    return '<div class="text-center text-gray-500">داشبورد در دسترس نیست</div>';
            }
        } catch (error) {
            debugLogger('Error in getDashboardContent', 'error', error);
            return '<div class="text-center text-red-500">خطا در بارگذاری داشبورد</div>';
        }
    },
    
    // Manager Dashboard
    getManagerDashboard() {
        try {
            debugLogger('Loading manager dashboard...', 'info');
            const orders = DataModule.getOrders();
            const users = DataModule.getUsers();
            
            if (!orders || !users) {
                debugLogger('Orders or users data missing', 'error', { orders: !!orders, users: !!users });
                return '<div class="text-red-500">خطا: داده‌ها یافت نشد</div>';
            }
            
            const stats = {
                totalOrders: orders.length,
                pendingOrders: orders.filter(o => o.status === CONFIG.ORDER_STATUS.PENDING).length,
                completedOrders: orders.filter(o => o.status === CONFIG.ORDER_STATUS.COMPLETED).length,
                totalRevenue: orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0),
                totalUsers: users.length,
                activeStudents: users.filter(u => u.role === CONFIG.ROLES.STUDENT && u.active).length
            };
            
            debugLogger('Manager dashboard stats calculated', 'success', stats);
        
        return `
            <div class="space-y-6">
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="dashboard-card blue">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700">کل سفارشات</h3>
                                <p class="text-3xl font-bold text-blue-600">${stats.totalOrders}</p>
                            </div>
                            <i class="fas fa-clipboard-list text-blue-500 text-3xl"></i>
                        </div>
                    </div>
                    
                    <div class="dashboard-card yellow">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700">در انتظار</h3>
                                <p class="text-3xl font-bold text-yellow-600">${stats.pendingOrders}</p>
                            </div>
                            <i class="fas fa-clock text-yellow-500 text-3xl"></i>
                        </div>
                    </div>
                    
                    <div class="dashboard-card green">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700">تکمیل شده</h3>
                                <p class="text-3xl font-bold text-green-600">${stats.completedOrders}</p>
                            </div>
                            <i class="fas fa-check-circle text-green-500 text-3xl"></i>
                        </div>
                    </div>
                    
                    <div class="dashboard-card purple">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700">درآمد کل</h3>
                                <p class="text-2xl font-bold text-purple-600">${UTILS.formatCurrency(stats.totalRevenue)}</p>
                            </div>
                            <i class="fas fa-dollar-sign text-purple-500 text-3xl"></i>
                        </div>
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-bold mb-4 text-gray-800">عملیات سریع</h2>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <button @click="showModal = 'quickOrder'" 
                                class="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium btn">
                            <i class="fas fa-bolt ml-2"></i>
                            سفارش سریع
                        </button>
                        <button @click="showModal = 'createProject'" 
                                class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-medium btn">
                            <i class="fas fa-plus-circle ml-2"></i>
                            سفارش جدید
                        </button>
                        <button @click="currentPage = 'orders'" 
                                class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg font-medium btn">
                            <i class="fas fa-list ml-2"></i>
                            مشاهده سفارشات
                        </button>
                        <button onclick="openAddUserModal()" 
                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium btn">
                            <i class="fas fa-user-plus ml-2"></i>
                            کاربر جدید
                        </button>
                    </div>
                </div>
                
                <!-- Recent Orders -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-bold mb-4 text-gray-800">سفارشات اخیر</h2>
                    <div class="space-y-3">
                        ${this.getRecentOrdersHtml(orders.slice(-5))}
                    </div>
                </div>
            </div>
        `;
        } catch (error) {
            debugLogger('Error in getManagerDashboard', 'error', error);
            return '<div class="text-red-500">خطا در بارگذاری داشبورد مدیر</div>';
        }
    },
    
    // Student Dashboard
    getStudentDashboard() {
        try {
            debugLogger('Loading student dashboard...', 'info');
            
            // Get current user from Alpine.js or use default
            let currentUser;
            try {
                if (window.Alpine && document.querySelector('[x-data]')) {
                    currentUser = document.querySelector('[x-data]').__x.$data.currentUser;
                }
            } catch (e) {
                // Fallback if Alpine.js is not available
            }
            
            if (!currentUser || currentUser.role !== 'student') {
                // Use a default student for demo
                currentUser = { 
                    id: 'std001', 
                    name: 'عامل معصومی', 
                    university: 'جامعة قم', 
                    field: 'عاملی حقوق عمومی' 
                };
            }
            
            const orders = DataModule.getOrders().filter(o => o.studentId === currentUser.id);
        
        const stats = {
            totalOrders: orders.length,
            inProgress: orders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS).length,
            completed: orders.filter(o => o.status === CONFIG.ORDER_STATUS.COMPLETED).length,
            totalSpent: orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0)
        };
        
        return `
            <div class="space-y-6">
                <!-- Welcome Message -->
                <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6">
                    <h2 class="text-2xl font-bold mb-2">خوش آمدید ${currentUser.name}</h2>
                    <p class="text-blue-100">دانشگاه: ${currentUser.university}</p>
                    <p class="text-blue-100">رشته: ${currentUser.field}</p>
                </div>
                
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="dashboard-card blue">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700">کل سفارشات</h3>
                                <p class="text-3xl font-bold text-blue-600">${stats.totalOrders}</p>
                            </div>
                            <i class="fas fa-clipboard-list text-blue-500 text-3xl"></i>
                        </div>
                    </div>
                    
                    <div class="dashboard-card yellow">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700">در حال انجام</h3>
                                <p class="text-3xl font-bold text-yellow-600">${stats.inProgress}</p>
                            </div>
                            <i class="fas fa-spinner text-yellow-500 text-3xl"></i>
                        </div>
                    </div>
                    
                    <div class="dashboard-card green">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700">تکمیل شده</h3>
                                <p class="text-3xl font-bold text-green-600">${stats.completed}</p>
                            </div>
                            <i class="fas fa-check-circle text-green-500 text-3xl"></i>
                        </div>
                    </div>
                    
                    <div class="dashboard-card purple">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700">هزینه پرداختی</h3>
                                <p class="text-2xl font-bold text-purple-600">${this.formatCurrency(stats.totalSpent)}</p>
                            </div>
                            <i class="fas fa-dollar-sign text-purple-500 text-3xl"></i>
                        </div>
                    </div>
                </div>
                
                <!-- My Orders -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-bold text-gray-800">سفارشات من</h2>
                        <button onclick="window.showModal = 'newStudentOrder'" 
                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium btn">
                            <i class="fas fa-plus ml-2"></i>
                            سفارش جدید
                        </button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${this.getStudentOrdersHtml(orders)}
                    </div>
                </div>
            </div>
        `;
        } catch (error) {
            debugLogger('Error in getStudentDashboard', 'error', error);
            return '<div class="text-red-500">خطا در بارگذاری داشبورد دانشجو</div>';
        }
    },
    
    // Helper methods
    getRecentOrdersHtml(orders) {
        if (orders.length === 0) {
            return '<p class="text-gray-500 text-center">سفارشی موجود نیست</p>';
        }
        
        return orders.map(order => `
            <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div class="flex-1">
                    <h4 class="font-medium">${order.studentName}</h4>
                    <p class="text-sm text-gray-600">${order.type} - ${order.university}</p>
                </div>
                <div class="text-left">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${this.getStatusClass(order.status)}">
                        ${this.getStatusText(order.status)}
                    </span>
                    <p class="text-sm text-gray-500 mt-1">${UTILS.formatDate(order.createdAt)}</p>
                </div>
            </div>
        `).join('');
    },
    
    getStudentOrdersHtml(orders) {
        if (orders.length === 0) {
            return `
                <div class="col-span-2 text-center py-8">
                    <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">هنوز سفارشی ثبت نکرده‌اید</p>
                    <button onclick="window.showModal = 'newOrder'" 
                            class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium btn">
                        اولین سفارش خود را ثبت کنید
                    </button>
                </div>
            `;
        }
        
        return orders.map(order => {
            // Calculate estimated days
            const deadline = new Date(order.deadline);
            const today = new Date();
            const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
            
            // Status message based on order status
            let statusMessage = '';
            let statusIcon = '';
            let statusColor = '';
            
            switch(order.status) {
                case CONFIG.ORDER_STATUS.PENDING:
                    statusMessage = 'در انتظار تایید مدیر';
                    statusIcon = 'fa-clock';
                    statusColor = 'text-yellow-600';
                    break;
                case CONFIG.ORDER_STATUS.APPROVED:
                    statusMessage = 'مدیر پروژه را تایید کرد - هماهنگی در حال انجام است';
                    statusIcon = 'fa-check';
                    statusColor = 'text-green-600';
                    break;
                case CONFIG.ORDER_STATUS.IN_PROGRESS:
                    statusMessage = `عامل در حال نوشتن ${order.type === 'نوشتن رساله' ? 'رساله' : order.type === 'نوشتن مقاله' ? 'مقاله' : 'سفارش'} شما است`;
                    statusIcon = 'fa-pen';
                    statusColor = 'text-blue-600';
                    break;
                case CONFIG.ORDER_STATUS.REJECTED:
                    statusMessage = 'سفارش نیاز به اصلاح دارد';
                    statusIcon = 'fa-exclamation-triangle';
                    statusColor = 'text-red-600';
                    break;
                case CONFIG.ORDER_STATUS.COMPLETED:
                    statusMessage = 'سفارش تکمیل شده است';
                    statusIcon = 'fa-check-circle';
                    statusColor = 'text-purple-600';
                    break;
                default:
                    statusMessage = order.stage || 'در حال بررسی';
                    statusIcon = 'fa-info-circle';
                    statusColor = 'text-gray-600';
            }
            
            return `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow card">
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-semibold text-lg">${order.type}</h4>
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${this.getStatusClass(order.status)}">
                        ${this.getStatusText(order.status)}
                    </span>
                </div>
                
                <!-- Status Message -->
                <div class="bg-gray-50 rounded-lg p-3 mb-3">
                    <p class="text-sm ${statusColor}">
                        <i class="fas ${statusIcon} ml-1"></i>
                        ${statusMessage}
                    </p>
                    ${daysLeft > 0 ? `
                        <p class="text-xs text-gray-500 mt-1">
                            <i class="fas fa-calendar ml-1"></i>
                            زمان تقریبی اتمام پروژه: ${daysLeft} روز
                        </p>
                    ` : ''}
                </div>
                
                <div class="mb-3">
                    <div class="flex justify-between text-sm mb-1">
                        <span>پیشرفت</span>
                        <span>${order.progress}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full progress-bar" style="width: ${order.progress}%"></div>
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <p class="text-sm text-gray-600">مهلت: ${UTILS.formatDate(order.deadline)}</p>
                    <button onclick="window.viewOrder('${order.id}')" 
                            class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        مشاهده جزئیات
                    </button>
                </div>
            </div>
        `}).join('');
    },
    
    getStatusClass(status) {
        const classes = {
            [CONFIG.ORDER_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800',
            [CONFIG.ORDER_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
            [CONFIG.ORDER_STATUS.COMPLETED]: 'bg-green-100 text-green-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    },
    
    getStatusText(status) {
        const texts = {
            [CONFIG.ORDER_STATUS.PENDING]: 'در انتظار',
            [CONFIG.ORDER_STATUS.IN_PROGRESS]: 'در حال انجام',
            [CONFIG.ORDER_STATUS.COMPLETED]: 'تکمیل شده'
        };
        return texts[status] || status;
    },

    // employee Dashboard
    getemployeeDashboard() {
        try {
            debugLogger('Loading employee dashboard...', 'info');
            const orders = DataModule.getOrders();
            const pendingOrders = orders.filter(o => o.status === CONFIG.ORDER_STATUS.PENDING);
            const inProgressOrders = orders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS);
            
            return `
                <div class="space-y-6">
                    <div class="bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg p-6">
                        <h2 class="text-2xl font-bold mb-2">پنل کارمند</h2>
                        <p class="text-purple-100">مدیریت و هماهنگی سفارشات</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="dashboard-card yellow">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">در انتظار تخصیص</h3>
                                <p class="text-3xl font-bold text-yellow-600">${pendingOrders.length}</p>
                            </div>
                        </div>
                        <div class="dashboard-card blue">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">در حال انجام</h3>
                                <p class="text-3xl font-bold text-blue-600">${inProgressOrders.length}</p>
                            </div>
                        </div>
                        <div class="dashboard-card green">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">کل سفارشات</h3>
                                <p class="text-3xl font-bold text-green-600">${orders.length}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-bold mb-4 text-gray-800">سفارشات نیازمند توجه</h2>
                        <div class="space-y-3">
                            ${pendingOrders.slice(0, 5).map(order => `
                                <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                    <div>
                                        <h4 class="font-medium">${order.studentName}</h4>
                                        <p class="text-sm text-gray-600">${order.type}</p>
                                    </div>
                                    <button onclick="window.assignOrder('${order.id}')" 
                                            class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm">
                                        تخصیص
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            debugLogger('Error in getemployeeDashboard', 'error', error);
            return '<div class="text-red-500">خطا در بارگذاری داشبورد کارمند</div>';
        }
    },

    // Doctor Dashboard
    getDoctorDashboard() {
        try {
            debugLogger('Loading doctor dashboard...', 'info');
            const orders = DataModule.getOrders();
            
            // Get current user
            let currentUser = { id: 'doc001' };
            try {
                if (window.Alpine && document.querySelector('[x-data]')) {
                    currentUser = document.querySelector('[x-data]').__x.$data.currentUser;
                }
            } catch (e) {}
            
            const myOrders = orders.filter(o => o.assignedDoctorId === currentUser.id);
            const rejectedOrders = myOrders.filter(o => o.status === CONFIG.ORDER_STATUS.REJECTED);
            
            return `
                <div class="space-y-6">
                    <div class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg p-6">
                        <h2 class="text-2xl font-bold mb-2">پنل عامل</h2>
                        <p class="text-indigo-100">وظایف محول شده</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div class="dashboard-card blue">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">وظایف من</h3>
                                <p class="text-3xl font-bold text-blue-600">${myOrders.length}</p>
                            </div>
                        </div>
                        <div class="dashboard-card yellow">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">در حال انجام</h3>
                                <p class="text-3xl font-bold text-yellow-600">${myOrders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS).length}</p>
                            </div>
                        </div>
                        <div class="dashboard-card red">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">رد شده</h3>
                                <p class="text-3xl font-bold text-red-600">${rejectedOrders.length}</p>
                            </div>
                        </div>
                        <div class="dashboard-card purple">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">درآمد</h3>
                                <p class="text-2xl font-bold text-purple-600">${this.formatCurrency(myOrders.reduce((sum, o) => sum + (o.doctorShare || 0), 0))}</p>
                            </div>
                        </div>
                    </div>
                    
                    ${rejectedOrders.length > 0 ? `
                    <!-- Rejected Orders - Need Attention -->
                    <div class="bg-red-50 border border-red-200 rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-bold mb-4 text-red-800">
                            <i class="fas fa-exclamation-triangle ml-2"></i>
                            سفارشات رد شده - نیاز به اصلاح
                        </h2>
                        <div class="space-y-4">
                            ${rejectedOrders.map(order => `
                                <div class="bg-white border border-red-300 rounded-lg p-4">
                                    <div class="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 class="font-medium text-lg">${order.studentName}</h4>
                                            <p class="text-sm text-gray-600">${order.type} - ${order.university}</p>
                                        </div>
                                        <span class="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                            رد شده
                                        </span>
                                    </div>
                                    ${order.rejectionHistory && order.rejectionHistory.length > 0 ? `
                                        <div class="bg-red-50 border-r-4 border-red-500 p-3 rounded">
                                            <p class="text-sm font-medium text-red-800 mb-1">
                                                <i class="fas fa-comment-alt ml-1"></i>
                                                دلیل رد:
                                            </p>
                                            <p class="text-sm text-red-700">${order.rejectionHistory[order.rejectionHistory.length - 1].reason}</p>
                                            <p class="text-xs text-red-500 mt-2">
                                                توسط: ${order.rejectionHistory[order.rejectionHistory.length - 1].rejectedByName || 'کارمند'} - 
                                                ${UTILS.formatDate(order.rejectionHistory[order.rejectionHistory.length - 1].date)}
                                            </p>
                                        </div>
                                    ` : ''}
                                    <div class="mt-3 flex justify-end">
                                        <button onclick="window.viewOrder('${order.id}')" 
                                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                                            <i class="fas fa-edit ml-1"></i>
                                            اصلاح و ارسال مجدد
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-bold mb-4 text-gray-800">وظایف فعلی</h2>
                        <div class="space-y-3">
                            ${myOrders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS).length > 0 ? 
                                myOrders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS).map(order => `
                                <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                    <div>
                                        <h4 class="font-medium">${order.studentName}</h4>
                                        <p class="text-sm text-gray-600">${order.type} - ${order.stage}</p>
                                    </div>
                                    <div class="text-left">
                                        <div class="text-sm text-gray-500">پیشرفت: ${order.progress}%</div>
                                        <div class="w-20 bg-gray-200 rounded-full h-2 mt-1">
                                            <div class="bg-blue-600 h-2 rounded-full" style="width: ${order.progress}%"></div>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-gray-500 text-center">وظیفه فعالی ندارید</p>'}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            debugLogger('Error in getDoctorDashboard', 'error', error);
            return '<div class="text-red-500">خطا در بارگذاری داشبورد عامل</div>';
        }
    },

    // Agent Dashboard
    getAgentDashboard() {
        try {
            debugLogger('Loading agent dashboard...', 'info');
            const orders = DataModule.getOrders();
            
            // Get current user
            let currentUser = { id: 'doc001' };
            try {
                if (window.Alpine && document.querySelector('[x-data]')) {
                    currentUser = document.querySelector('[x-data]').__x.$data.currentUser;
                }
            } catch (e) {}
            
            // Filter orders assigned to this agent
            const myOrders = orders.filter(o => {
                // Check multiple possible field names for assigned doctor
                const isAssigned = 
                    o.assignedDoctorId === currentUser.id || 
                    o.assigned_doctor === currentUser.id ||
                    o.assignedDoctor === currentUser.id ||
                    o.doctorId === currentUser.id ||
                    o.doctor_id === currentUser.id;
                return isAssigned;
            });
            
            const rejectedOrders = myOrders.filter(o => o.status === CONFIG.ORDER_STATUS.REJECTED);
            
            return `
                <div class="space-y-6">
                    <div class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg p-6">
                        <h2 class="text-2xl font-bold mb-2">پنل عامل</h2>
                        <p class="text-indigo-100">وظایف محول شده</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div class="dashboard-card blue">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">وظایف من</h3>
                                <p class="text-3xl font-bold text-blue-600">${myOrders.length}</p>
                            </div>
                        </div>
                        <div class="dashboard-card yellow">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">در حال انجام</h3>
                                <p class="text-3xl font-bold text-yellow-600">${myOrders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS).length}</p>
                            </div>
                        </div>
                        <div class="dashboard-card red">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">رد شده</h3>
                                <p class="text-3xl font-bold text-red-600">${rejectedOrders.length}</p>
                            </div>
                        </div>
                        <div class="dashboard-card purple">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">درآمد</h3>
                                <p class="text-2xl font-bold text-purple-600">${this.formatCurrency(myOrders.reduce((sum, o) => sum + (o.doctorShare || 0), 0))}</p>
                            </div>
                        </div>
                    </div>
                    
                    ${rejectedOrders.length > 0 ? `
                    <!-- Rejected Orders - Need Attention -->
                    <div class="bg-red-50 border border-red-200 rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-bold mb-4 text-red-800">
                            <i class="fas fa-exclamation-triangle ml-2"></i>
                            سفارشات رد شده - نیاز به اصلاح
                        </h2>
                        <div class="space-y-4">
                            ${rejectedOrders.map(order => `
                                <div class="bg-white border border-red-300 rounded-lg p-4">
                                    <div class="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 class="font-medium text-lg">${order.studentName}</h4>
                                            <p class="text-sm text-gray-600">${order.type} - ${order.university}</p>
                                        </div>
                                        <span class="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                            رد شده
                                        </span>
                                    </div>
                                    ${order.rejectionHistory && order.rejectionHistory.length > 0 ? `
                                        <div class="bg-red-50 border-r-4 border-red-500 p-3 rounded">
                                            <p class="text-sm font-medium text-red-800 mb-1">
                                                <i class="fas fa-comment-alt ml-1"></i>
                                                دلیل رد:
                                            </p>
                                            <p class="text-sm text-red-700">${order.rejectionHistory[order.rejectionHistory.length - 1].reason}</p>
                                            <p class="text-xs text-red-500 mt-2">
                                                توسط: ${order.rejectionHistory[order.rejectionHistory.length - 1].rejectedByName || 'کارمند'} - 
                                                ${UTILS.formatDate(order.rejectionHistory[order.rejectionHistory.length - 1].date)}
                                            </p>
                                        </div>
                                    ` : ''}
                                    <div class="mt-3 flex justify-end">
                                        <button onclick="window.viewOrder('${order.id}')" 
                                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                                            <i class="fas fa-edit ml-1"></i>
                                            اصلاح و ارسال مجدد
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-bold mb-4 text-gray-800">وظایف فعلی</h2>
                        <div class="space-y-3">
                            ${myOrders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS).length > 0 ? 
                                myOrders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS).map(order => `
                                <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                    <div>
                                        <h4 class="font-medium">${order.studentName}</h4>
                                        <p class="text-sm text-gray-600">${order.type} - ${order.stage}</p>
                                    </div>
                                    <div class="text-left">
                                        <span class="px-2 py-1 rounded-full text-xs font-medium ${this.getStatusClass(order.status)}">
                                            ${this.getStatusText(order.status)}
                                        </span>
                                        <div class="text-sm text-gray-500 mt-1">مهلت: ${UTILS.formatDate(order.deadlineDateTime || order.deadline)}</div>
                                        <div class="text-sm text-gray-500">پیشرفت: ${order.progress}%</div>
                                        <div class="w-20 bg-gray-200 rounded-full h-2 mt-1">
                                            <div class="bg-blue-600 h-2 rounded-full" style="width: ${order.progress}%"></div>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-gray-500 text-center">وظیفه فعالی ندارید</p>'}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            debugLogger('Error in getAgentDashboard', 'error', error);
            return '<div class="text-red-500">خطا در بارگذاری داشبورد عامل</div>';
        }
    },

    // Translator Dashboard
    getTranslatorDashboard() {
        try {
            debugLogger('Loading translator dashboard...', 'info');
            const orders = DataModule.getOrders();
            const translationOrders = orders.filter(o => o.type === CONFIG.ORDER_TYPES.TRANSLATION);
            
            return `
                <div class="space-y-6">
                    <div class="bg-gradient-to-r from-pink-500 to-red-600 text-white rounded-lg p-6">
                        <h2 class="text-2xl font-bold mb-2">پنل مترجم</h2>
                        <p class="text-pink-100">وظایف ترجمه</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="dashboard-card pink">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">پروژه‌های ترجمه</h3>
                                <p class="text-3xl font-bold text-pink-600">${translationOrders.length}</p>
                            </div>
                        </div>
                        <div class="dashboard-card green">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">تکمیل شده</h3>
                                <p class="text-3xl font-bold text-green-600">${translationOrders.filter(o => o.status === CONFIG.ORDER_STATUS.COMPLETED).length}</p>
                            </div>
                        </div>
                        <div class="dashboard-card blue">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">درآمد</h3>
                                <p class="text-2xl font-bold text-blue-600">${this.formatCurrency(translationOrders.reduce((sum, o) => sum + (o.doctorShare || 0), 0))}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-bold mb-4 text-gray-800">پروژه‌های فعال</h2>
                        <div class="space-y-3">
                            ${translationOrders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS).map(order => `
                                <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                    <div>
                                        <h4 class="font-medium">${order.studentName}</h4>
                                        <p class="text-sm text-gray-600">${order.type} - ${order.field}</p>
                                    </div>
                                    <div class="text-left">
                                        <span class="text-sm text-gray-500">مهلت: ${order.deadline}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            debugLogger('Error in getTranslatorDashboard', 'error', error);
            return '<div class="text-red-500">خطا در بارگذاری داشبورد مترجم</div>';
        }
    }
};