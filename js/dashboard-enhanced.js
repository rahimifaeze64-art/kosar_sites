// Enhanced Dashboard Module with API Integration
const EnhancedDashboardModule = {
    // Cache for dashboard data
    cache: {
        stats: null,
        recentOrders: null,
        timestamp: null
    },
    
    // Cache expiry time (2 minutes)
    cacheExpiry: 2 * 60 * 1000,
    
    // Check if cache is valid
    isCacheValid() {
        return this.cache.timestamp && 
               (Date.now() - this.cache.timestamp) < this.cacheExpiry;
    },
    
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
    async getDashboardContent(userRole) {
        try {
            debugLogger(`Loading dashboard for role: ${userRole}`, 'info');
            
            switch(userRole) {
                case CONFIG.ROLES.MANAGER:
                    return await this.getManagerDashboard();
                case CONFIG.ROLES.employee:
                    return await this.getemployeeDashboard();
                case CONFIG.ROLES.DOCTOR:
                    return await this.getDoctorDashboard();
                case CONFIG.ROLES.STUDENT:
                    return await this.getStudentDashboard();
                case CONFIG.ROLES.TRANSLATOR:
                    return await this.getTranslatorDashboard();
                default:
                    debugLogger(`Unknown role: ${userRole}`, 'warning');
                    return '<div class="text-center text-gray-500">داشبورد در دسترس نیست</div>';
            }
        } catch (error) {
            debugLogger('Error in getDashboardContent', 'error', error);
            return '<div class="text-center text-red-500">خطا در بارگذاری داشبورد</div>';
        }
    },
    
    // Get dashboard statistics (API or localStorage)
    async getDashboardStats() {
        try {
            // Try API first (only if available and initialized)
            if (typeof APIDataModule !== 'undefined' && APIDataModule && APIDataModule.isAvailable !== false) {
                try {
                    const stats = await APIDataModule.getDashboardStats();
                    if (stats) {
                        debugLogger('Dashboard stats loaded from API', 'success', stats);
                        return stats;
                    }
                } catch (error) {
                    debugLogger('API stats failed, using localStorage', 'warning', error);
                }
            }
            
            // Fallback to localStorage calculation
            const orders = DataModule.getOrders();
            const users = DataModule.getUsers();
            
            const stats = {
                total_orders: orders.length,
                pending_orders: orders.filter(o => o.status === CONFIG.ORDER_STATUS.PENDING).length,
                in_progress_orders: orders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS).length,
                completed_orders: orders.filter(o => o.status === CONFIG.ORDER_STATUS.COMPLETED).length,
                total_revenue: orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0),
                total_students: users.filter(u => u.role === CONFIG.ROLES.STUDENT).length,
                active_doctors: users.filter(u => u.role === CONFIG.ROLES.DOCTOR && u.active).length
            };
            
            debugLogger('Dashboard stats calculated from localStorage', 'info', stats);
            return stats;
        } catch (error) {
            debugLogger('Error getting dashboard stats', 'error', error);
            return {
                total_orders: 0,
                pending_orders: 0,
                in_progress_orders: 0,
                completed_orders: 0,
                total_revenue: 0,
                total_students: 0,
                active_doctors: 0
            };
        }
    },
    
    // Get recent orders (API or localStorage)
    async getRecentOrders(limit = 5) {
        try {
            // Try API first (only if available and initialized)
            if (typeof APIDataModule !== 'undefined' && APIDataModule && APIDataModule.isAvailable !== false) {
                try {
                    const orders = await APIDataModule.getRecentOrders();
                    if (orders && Array.isArray(orders)) {
                        debugLogger('Recent orders loaded from API', 'success', orders);
                        return orders.slice(0, limit);
                    }
                } catch (error) {
                    debugLogger('API recent orders failed, using localStorage', 'warning', error);
                }
            }
            
            // Fallback to localStorage
            const orders = DataModule.getOrders();
            const recentOrders = orders
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, limit);
            
            debugLogger('Recent orders loaded from localStorage', 'info', recentOrders);
            return recentOrders;
        } catch (error) {
            debugLogger('Error getting recent orders', 'error', error);
            return [];
        }
    },
    
    // Manager Dashboard
    async getManagerDashboard() {
        try {
            debugLogger('Loading manager dashboard...', 'info');
            
            const stats = await this.getDashboardStats();
            const recentOrders = await this.getRecentOrders(5);
            
            return `
                <div class="space-y-6">
                    <!-- Statistics Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-blue-100">کل سفارشات</p>
                                    <p class="text-3xl font-bold">${stats.total_orders}</p>
                                </div>
                                <i class="fas fa-clipboard-list text-4xl text-blue-200"></i>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-6 text-white cursor-pointer hover:from-yellow-600 hover:to-yellow-700 transition-all duration-200" onclick="openWeeklyCalendar()">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-yellow-100">لیست هفته</p>
                                    <p class="text-3xl font-bold">${stats.pending_orders}</p>
                                </div>
                                <i class="fas fa-calendar-week text-4xl text-yellow-200"></i>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-green-100">در حال انجام</p>
                                    <p class="text-3xl font-bold">${stats.in_progress_orders}</p>
                                </div>
                                <i class="fas fa-spinner text-4xl text-green-200"></i>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-purple-100">درآمد کل</p>
                                    <p class="text-2xl font-bold">${this.formatCurrency(stats.total_revenue)}</p>
                                </div>
                                <i class="fas fa-dollar-sign text-4xl text-purple-200"></i>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Quick Actions -->
                    <div class="bg-slate-800 rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-white mb-4">عملیات سریع</h3>
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <button @click="showModal = 'quickOrder'" 
                                    class="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg text-center">
                                <i class="fas fa-bolt text-2xl mb-2"></i>
                                <p class="text-sm">سفارش سریع</p>
                            </button>
                            <button @click="showModal = 'createProject'" 
                                    class="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg text-center">
                                <i class="fas fa-plus-circle text-2xl mb-2"></i>
                                <p class="text-sm">سفارش جدید</p>
                            </button>
                            <button @click="currentPage = 'orders'" 
                                    class="bg-gray-600 hover:bg-gray-700 text-white p-4 rounded-lg text-center">
                                <i class="fas fa-list text-2xl mb-2"></i>
                                <p class="text-sm">مشاهده سفارشات</p>
                            </button>
                            <button onclick="openAddUserModal()" 
                                    class="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg text-center">
                                <i class="fas fa-user-plus text-2xl mb-2"></i>
                                <p class="text-sm">کاربر جدید</p>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Recent Orders -->
                    <div class="bg-slate-800 rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-white mb-4">آخرین سفارشات</h3>
                        <div class="space-y-3">
                            ${recentOrders.length > 0 ? recentOrders.map(order => `
                                <div class="bg-slate-700 rounded-lg p-4 flex justify-between items-center">
                                    <div>
                                        <p class="font-medium text-white">${order.studentName || order.student_name}</p>
                                        <p class="text-sm text-gray-300">${order.type} - ${order.university}</p>
                                        <p class="text-xs text-gray-400">${UTILS.formatDate(order.createdAt || order.created_at)}</p>
                                    </div>
                                    <div class="text-left">
                                        <span class="px-3 py-1 rounded-full text-xs font-medium ${
                                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                        }">
                                            ${order.status === 'pending' ? 'در انتظار' :
                                              order.status === 'in_progress' ? 'در حال انجام' :
                                              order.status === 'completed' ? 'تکمیل شده' : order.status}
                                        </span>
                                        <p class="text-sm text-gray-300 mt-1">${this.formatCurrency(order.totalAmount || order.total_amount)}</p>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-gray-400 text-center py-4">سفارشی موجود نیست</p>'}
                        </div>
                    </div>
                    
                    <!-- Delayed Tasks Section -->
                    <div class="bg-red-900 bg-opacity-30 border border-red-500 rounded-lg p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold text-red-400">
                                <i class="fas fa-exclamation-triangle ml-2"></i>
                                وظایف دیرکرد
                            </h3>
                            <span class="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                                ${this.getDelayedTasksCount()}
                            </span>
                        </div>
                        <div class="space-y-3">
                            ${this.getDelayedTasksHTML()}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            debugLogger('Error in getManagerDashboard', 'error', error);
            return '<div class="text-red-500">خطا در بارگذاری داشبورد مدیر</div>';
        }
    },
    
    // employee Dashboard
    async getemployeeDashboard() {
        try {
            debugLogger('Loading employee dashboard...', 'info');
            
            const stats = await this.getDashboardStats();
            const recentOrders = await this.getRecentOrders(5);
            
            return `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-white">داشبورد هماهنگی</h2>
                        <button onclick="location.reload()" 
                                class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-sync-alt ml-2"></i>
                            به‌روزرسانی
                        </button>
                    </div>
                    
                    <!-- Statistics -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-yellow-100">نیاز به بررسی</p>
                                    <p class="text-3xl font-bold">${stats.pending_orders}</p>
                                </div>
                                <i class="fas fa-exclamation-triangle text-4xl text-yellow-200"></i>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-blue-100">در حال انجام</p>
                                    <p class="text-3xl font-bold">${stats.in_progress_orders}</p>
                                </div>
                                <i class="fas fa-cogs text-4xl text-blue-200"></i>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-green-100">تکمیل شده</p>
                                    <p class="text-3xl font-bold">${stats.completed_orders}</p>
                                </div>
                                <i class="fas fa-check-circle text-4xl text-green-200"></i>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Quick Actions -->
                    <div class="bg-slate-800 rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-white mb-4">عملیات سریع</h3>
                        <div class="grid grid-cols-1 gap-4">
                            <button onclick="openAddUserModal()" 
                                    class="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg text-center">
                                <i class="fas fa-user-graduate text-2xl mb-2"></i>
                                <p class="text-sm">دانشجوی جدید</p>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Recent Orders -->
                    <div class="bg-slate-800 rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-white mb-4">سفارشات اخیر</h3>
                        <div class="space-y-3">
                            ${recentOrders.length > 0 ? recentOrders.map(order => `
                                <div class="bg-slate-700 rounded-lg p-4">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <p class="font-medium text-white">${order.studentName || order.student_name}</p>
                                            <p class="text-sm text-gray-300">${order.type} - ${order.university}</p>
                                        </div>
                                        <div class="flex space-x-2 space-x-reverse">
                                            ${order.status === 'pending' ? `
                                                <button onclick="approveOrder('${order.id}')" 
                                                        class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs">
                                                    تایید
                                                </button>
                                                <button onclick="rejectOrder('${order.id}')" 
                                                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs">
                                                    رد
                                                </button>
                                            ` : order.status === 'approved' ? `
                                                <button onclick="assignOrder('${order.id}')" 
                                                        class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs">
                                                    تخصیص
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-gray-400 text-center py-4">سفارشی موجود نیست</p>'}
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
    async getDoctorDashboard() {
        try {
            debugLogger('Loading doctor dashboard...', 'info');
            
            // Get current user ID
            let currentUserId = 'doc001';
            try {
                if (window.Alpine && document.querySelector('[x-data]')) {
                    currentUserId = document.querySelector('[x-data]').__x.$data.currentUser.id;
                }
            } catch (e) {}
            
            const stats = await this.getDashboardStats();
            const recentOrders = await this.getRecentOrders(5);
            
            // Filter orders for current doctor
            const myOrders = recentOrders.filter(order => 
                order.assignedDoctorId === currentUserId || order.assigned_doctor === currentUserId
            );
            
            return `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-white">داشبورد عامل</h2>
                        <button onclick="location.reload()" 
                                class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-sync-alt ml-2"></i>
                            به‌روزرسانی
                        </button>
                    </div>
                    
                    <!-- Statistics -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-blue-100">سفارشات من</p>
                                    <p class="text-3xl font-bold">${myOrders.length}</p>
                                </div>
                                <i class="fas fa-user-md text-4xl text-blue-200"></i>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-green-100">در حال انجام</p>
                                    <p class="text-3xl font-bold">${myOrders.filter(o => o.status === 'in_progress').length}</p>
                                </div>
                                <i class="fas fa-tasks text-4xl text-green-200"></i>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-purple-100">درآمد تخمینی</p>
                                    <p class="text-2xl font-bold">${this.formatCurrency(
                                        myOrders.reduce((sum, o) => sum + (o.doctorShare || o.doctor_share || 0), 0)
                                    )}</p>
                                </div>
                                <i class="fas fa-dollar-sign text-4xl text-purple-200"></i>
                            </div>
                        </div>
                    </div>
                    
                    <!-- My Orders -->
                    <div class="bg-slate-800 rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-white mb-4">سفارشات تخصیص یافته</h3>
                        <div class="space-y-3">
                            ${myOrders.length > 0 ? myOrders.map(order => `
                                <div class="bg-slate-700 rounded-lg p-4">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <p class="font-medium text-white">${order.studentName || order.student_name}</p>
                                            <p class="text-sm text-gray-300">${order.type} - ${order.university}</p>
                                            <p class="text-xs text-gray-400">مهلت: ${UTILS.formatDate(order.deadline)}</p>
                                        </div>
                                        <div class="text-left">
                                            <div class="flex items-center space-x-2 space-x-reverse mb-2">
                                                <span class="px-2 py-1 rounded-full text-xs font-medium ${
                                                    order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                    order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }">
                                                    ${order.status === 'in_progress' ? 'در حال انجام' :
                                                      order.status === 'completed' ? 'تکمیل شده' : order.status}
                                                </span>
                                            </div>
                                            <p class="text-sm text-green-400">سهم: ${this.formatCurrency(order.doctorShare || order.doctor_share)}</p>
                                            <button onclick="viewOrder('${order.id}')" 
                                                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs mt-2">
                                                جزئیات
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-gray-400 text-center py-4">سفارشی تخصیص نیافته است</p>'}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            debugLogger('Error in getDoctorDashboard', 'error', error);
            return '<div class="text-red-500">خطا در بارگذاری داشبورد عامل</div>';
        }
    },
    
    // Student Dashboard
    async getStudentDashboard() {
        try {
            debugLogger('Loading student dashboard...', 'info');
            
            // Get current user ID
            let currentUserId = 'std001';
            try {
                if (window.Alpine && document.querySelector('[x-data]')) {
                    currentUserId = document.querySelector('[x-data]').__x.$data.currentUser.id;
                }
            } catch (e) {}
            
            const recentOrders = await this.getRecentOrders(10);
            
            // Filter orders for current student
            const myOrders = recentOrders.filter(order => 
                order.studentId === currentUserId || order.student === currentUserId
            );
            
            return `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-white">داشبورد دانشجو</h2>
                        <div class="flex space-x-2 space-x-reverse">
                            <button @click="showModal = 'quickOrder'" 
                                    class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                                <i class="fas fa-bolt ml-2"></i>
                                سفارش سریع
                            </button>
                            <button @click="showModal = 'createProject'" 
                                    class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">
                                <i class="fas fa-plus ml-2"></i>
                                درخواست جدید
                            </button>
                        </div>
                    </div>
                    
                    <!-- My Orders -->
                    <div class="bg-slate-800 rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-white mb-4">سفارشات من</h3>
                        <div class="space-y-4">
                            ${myOrders.length > 0 ? myOrders.map(order => `
                                <div class="bg-slate-700 rounded-lg p-4">
                                    <div class="flex justify-between items-start">
                                        <div class="flex-1">
                                            <h4 class="font-medium text-white">${order.type}</h4>
                                            <p class="text-sm text-gray-300">${order.university} - ${order.field}</p>
                                            <p class="text-xs text-gray-400 mt-1">${order.stage || 'در حال بررسی'}</p>
                                            ${order.assignedDoctor || order.assigned_doctor_name ? 
                                                `<p class="text-xs text-blue-400 mt-1">عامل مسئول: ${order.assignedDoctor || order.assigned_doctor_name}</p>` : ''
                                            }
                                        </div>
                                        <div class="text-left">
                                            <span class="px-3 py-1 rounded-full text-xs font-medium ${
                                                order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                order.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                                order.status === 'in_progress' ? 'bg-green-100 text-green-800' :
                                                order.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                                                'bg-gray-100 text-gray-800'
                                            }">
                                                ${order.status === 'pending' ? 'در انتظار' :
                                                  order.status === 'approved' ? 'تایید شده' :
                                                  order.status === 'in_progress' ? 'در حال انجام' :
                                                  order.status === 'completed' ? 'تکمیل شده' : order.status}
                                            </span>
                                            <p class="text-sm text-gray-300 mt-2">${this.formatCurrency(order.totalAmount || order.total_amount)}</p>
                                            <button onclick="viewOrder('${order.id}')" 
                                                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs mt-2">
                                                جزئیات
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <!-- Progress Bar -->
                                    <div class="mt-4">
                                        <div class="flex justify-between text-xs text-gray-400 mb-1">
                                            <span>پیشرفت</span>
                                            <span>${order.progress || 0}%</span>
                                        </div>
                                        <div class="w-full bg-gray-600 rounded-full h-2">
                                            <div class="bg-indigo-600 h-2 rounded-full" style="width: ${order.progress || 0}%"></div>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : `
                                <div class="text-center py-8">
                                    <i class="fas fa-clipboard-list text-4xl text-gray-400 mb-4"></i>
                                    <p class="text-gray-400 mb-4">هنوز سفارشی ثبت نکرده‌اید</p>
                                    <div class="flex justify-center space-x-3 space-x-reverse">
                                        <button @click="showModal = 'quickOrder'" 
                                                class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg">
                                            <i class="fas fa-bolt ml-2"></i>
                                            سفارش سریع
                                        </button>
                                        <button @click="showModal = 'createProject'" 
                                                class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg">
                                            <i class="fas fa-plus ml-2"></i>
                                            درخواست کامل
                                        </button>
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            debugLogger('Error in getStudentDashboard', 'error', error);
            return '<div class="text-red-500">خطا در بارگذاری داشبورد دانشجو</div>';
        }
    },
    
    // Translator Dashboard
    async getTranslatorDashboard() {
        try {
            debugLogger('Loading translator dashboard...', 'info');
            
            const stats = await this.getDashboardStats();
            const recentOrders = await this.getRecentOrders(5);
            
            // Filter translation orders
            const translationOrders = recentOrders.filter(order => 
                order.type === 'ترجمه رساله' || order.type === 'تلخیص'
            );
            
            return `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-white">داشبورد مترجم</h2>
                        <button onclick="location.reload()" 
                                class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-sync-alt ml-2"></i>
                            به‌روزرسانی
                        </button>
                    </div>
                    
                    <!-- Statistics -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-teal-100">پروژه‌های ترجمه</p>
                                    <p class="text-3xl font-bold">${translationOrders.length}</p>
                                </div>
                                <i class="fas fa-language text-4xl text-teal-200"></i>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-orange-100">در حال انجام</p>
                                    <p class="text-3xl font-bold">${translationOrders.filter(o => o.status === 'in_progress').length}</p>
                                </div>
                                <i class="fas fa-pen text-4xl text-orange-200"></i>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-purple-100">درآمد تخمینی</p>
                                    <p class="text-2xl font-bold">${this.formatCurrency(
                                        translationOrders.reduce((sum, o) => sum + (o.doctorShare || o.doctor_share || 0), 0)
                                    )}</p>
                                </div>
                                <i class="fas fa-dollar-sign text-4xl text-purple-200"></i>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Translation Orders -->
                    <div class="bg-slate-800 rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-white mb-4">پروژه‌های ترجمه</h3>
                        <div class="space-y-3">
                            ${translationOrders.length > 0 ? translationOrders.map(order => `
                                <div class="bg-slate-700 rounded-lg p-4">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <p class="font-medium text-white">${order.studentName || order.student_name}</p>
                                            <p class="text-sm text-gray-300">${order.type} - ${order.university}</p>
                                            <p class="text-xs text-gray-400">مهلت: ${UTILS.formatDate(order.deadline)}</p>
                                        </div>
                                        <div class="text-left">
                                            <span class="px-2 py-1 rounded-full text-xs font-medium ${
                                                order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                'bg-gray-100 text-gray-800'
                                            }">
                                                ${order.status === 'in_progress' ? 'در حال انجام' :
                                                  order.status === 'completed' ? 'تکمیل شده' : order.status}
                                            </span>
                                            <p class="text-sm text-green-400 mt-1">سهم: ${this.formatCurrency(order.doctorShare || order.doctor_share)}</p>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-gray-400 text-center py-4">پروژه ترجمه‌ای موجود نیست</p>'}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            debugLogger('Error in getTranslatorDashboard', 'error', error);
            return '<div class="text-red-500">خطا در بارگذاری داشبورد مترجم</div>';
        }
    },
    
    // Get delayed tasks count
    getDelayedTasksCount() {
        try {
            const orders = DataModule.getOrders();
            const today = new Date();
            let delayedCount = 0;
            
            orders.forEach(order => {
                // Check work list deadlines
                if (order.workList && order.workDetails) {
                    order.workList.forEach(work => {
                        const details = order.workDetails[work];
                        if (details && details.deadline) {
                            const deadline = new Date(details.deadline);
                            if (deadline < today && order.status !== 'completed') {
                                delayedCount++;
                            }
                        }
                    });
                }
                
                // Check overall deadline
                if (order.deadline) {
                    const deadline = new Date(order.deadline);
                    if (deadline < today && order.status !== 'completed') {
                        delayedCount++;
                    }
                }
            });
            
            return delayedCount;
        } catch (error) {
            debugLogger('Error getting delayed tasks count', 'error', error);
            return 0;
        }
    },
    
    // Get delayed tasks HTML
    getDelayedTasksHTML() {
        try {
            const orders = DataModule.getOrders();
            const today = new Date();
            const delayedTasks = [];
            
            orders.forEach(order => {
                // Check work list deadlines
                if (order.workList && order.workDetails) {
                    order.workList.forEach((work, index) => {
                        const details = order.workDetails[work];
                        if (details && details.deadline) {
                            const deadline = new Date(details.deadline);
                            if (deadline < today && order.status !== 'completed') {
                                const daysLate = Math.floor((today - deadline) / (1000 * 60 * 60 * 24));
                                delayedTasks.push({
                                    orderId: order.id,
                                    studentName: order.studentName,
                                    taskName: work,
                                    deadline: details.deadline,
                                    daysLate: daysLate,
                                    assignedTo: order.assignedDoctor || 'تخصیص نیافته',
                                    status: order.status
                                });
                            }
                        }
                    });
                }
            });
            
            // Sort by days late (most delayed first)
            delayedTasks.sort((a, b) => b.daysLate - a.daysLate);
            
            if (delayedTasks.length === 0) {
                return '<p class="text-green-400 text-center py-4"><i class="fas fa-check-circle ml-2"></i>هیچ وظیفه دیرکردی وجود ندارد</p>';
            }
            
            return delayedTasks.slice(0, 10).map(task => `
                <div class="bg-red-800 bg-opacity-40 rounded-lg p-4 border border-red-600">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center mb-2">
                                <span class="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold ml-2">
                                    ${task.daysLate} روز تاخیر
                                </span>
                                <span class="text-red-300 text-sm">${PersianDate.formatWithMonthName(task.deadline)}</span>
                            </div>
                            <p class="font-medium text-white mb-1">${task.studentName}</p>
                            <p class="text-sm text-red-200 mb-1">
                                <i class="fas fa-tasks ml-1"></i>
                                ${task.taskName}
                            </p>
                            <p class="text-xs text-red-300">
                                <i class="fas fa-user ml-1"></i>
                                مسئول: ${task.assignedTo}
                            </p>
                        </div>
                        <button onclick="viewOrderDetails('${task.orderId}')" 
                                class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm">
                            <i class="fas fa-eye ml-1"></i>
                            مشاهده
                        </button>
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            debugLogger('Error getting delayed tasks HTML', 'error', error);
            return '<p class="text-red-400 text-center py-4">خطا در بارگذاری وظایف دیرکرد</p>';
        }
    }
};

// Replace the original DashboardModule with the enhanced version
if (typeof DashboardModule !== 'undefined') {
    // Backup original methods that might be needed
    const originalDashboard = { ...DashboardModule };
    
    // Replace with enhanced version
    Object.assign(DashboardModule, EnhancedDashboardModule);
    
    debugLogger('Dashboard module enhanced with API integration', 'success');
}