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
            const users  = DataModule.getUsers();

            if (!orders || !users) {
                return '<div class="text-red-500">خطا: داده‌ها یافت نشد</div>';
            }

            // ── آمار سفارشات ──────────────────────────────────
            const totalOrders     = orders.length;
            const pendingOrders   = orders.filter(o => o.status === CONFIG.ORDER_STATUS.PENDING).length;
            const inProgress      = orders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS).length;
            const completedOrders = orders.filter(o => o.status === CONFIG.ORDER_STATUS.COMPLETED).length;

            // ── پیام‌های خوانده‌نشده (personal chat) ───────────
            let unreadMessages = 0;
            try {
                const cu = JSON.parse(localStorage.getItem('currentUser') || '{}');
                if (cu.id) {
                    const allUsers2 = DataModule.getUsers() || [];
                    allUsers2.forEach(u => {
                        if (u.id === cu.id) return;
                        const key = `personalChat_${cu.id}_${u.id}`;
                        const msgs = JSON.parse(localStorage.getItem(key) || '[]');
                        unreadMessages += msgs.filter(m => !m.read && m.senderId !== cu.id).length;
                    });
                    // management chat
                    const mChatMsgs = JSON.parse(localStorage.getItem('managesChat_messages') || '[]');
                    unreadMessages += mChatMsgs.filter(m => m.mentions && Array.isArray(m.mentions) && m.mentions.includes(cu.id) && !m.readBy?.includes(cu.id)).length;
                }
            } catch(e) {}

            // ── ساعات کاری (این هفته) ─────────────────────────
            let weeklyHours = 0;
            try {
                const whData = JSON.parse(localStorage.getItem('work_hours_data') || '[]');
                const today = new Date();
                const dayOfWeek = today.getDay();
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - dayOfWeek);
                weekStart.setHours(0,0,0,0);
                whData.filter(e => e.type !== 'expense' && e.status !== 'rejected').forEach(e => {
                    const d = new Date(e.date);
                    if (d >= weekStart) weeklyHours += parseFloat(e.totalHours || 0);
                });
            } catch(e) {}

            // ── تعداد دانشجویان فعال ──────────────────────────
            const activeStudents = users.filter(u => u.role === 'student').length;

            // ── آخرین ورود / فعالیت ───────────────────────────
            const lastLoginStr = (() => {
                try {
                    const cu = JSON.parse(localStorage.getItem('currentUser') || '{}');
                    return cu.lastLogin ? new Date(cu.lastLogin).toLocaleString('fa-IR') : 'همین الان';
                } catch(e) { return '-'; }
            })();

            return `
            <div class="space-y-6">
                <!-- Stats Cards -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

                    <div class="bg-white rounded-xl shadow p-5 border-r-4 border-blue-500 flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-500 mb-1">سفارشات فعال</p>
                            <p class="text-3xl font-bold text-blue-600">${inProgress}</p>
                            <p class="text-xs text-gray-400 mt-1">${pendingOrders} در انتظار</p>
                        </div>
                        <div class="bg-blue-50 rounded-full p-3">
                            <i class="fas fa-tasks text-blue-500 text-2xl"></i>
                        </div>
                    </div>

                    <div class="bg-white rounded-xl shadow p-5 border-r-4 border-green-500 flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-500 mb-1">تکمیل شده</p>
                            <p class="text-3xl font-bold text-green-600">${completedOrders}</p>
                            <p class="text-xs text-gray-400 mt-1">از ${totalOrders} کل سفارش</p>
                        </div>
                        <div class="bg-green-50 rounded-full p-3">
                            <i class="fas fa-check-circle text-green-500 text-2xl"></i>
                        </div>
                    </div>

                    <div class="bg-white rounded-xl shadow p-5 border-r-4 border-red-400 flex items-center justify-between ${unreadMessages > 0 ? 'ring-2 ring-red-300' : ''}">
                        <div>
                            <p class="text-sm text-gray-500 mb-1">پیام‌های خوانده‌نشده</p>
                            <p class="text-3xl font-bold ${unreadMessages > 0 ? 'text-red-500' : 'text-gray-400'}">${unreadMessages}</p>
                            <p class="text-xs text-gray-400 mt-1">${unreadMessages > 0 ? 'نیاز به پاسخ دارد' : 'همه خوانده شده'}</p>
                        </div>
                        <div class="bg-red-50 rounded-full p-3">
                            <i class="fas fa-comments text-red-400 text-2xl"></i>
                        </div>
                    </div>

                    <div class="bg-white rounded-xl shadow p-5 border-r-4 border-yellow-500 flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-500 mb-1">دانشجویان</p>
                            <p class="text-3xl font-bold text-yellow-600">${activeStudents}</p>
                            <p class="text-xs text-gray-400 mt-1">از ${users.length} کاربر کل</p>
                        </div>
                        <div class="bg-yellow-50 rounded-full p-3">
                            <i class="fas fa-user-graduate text-yellow-500 text-2xl"></i>
                        </div>
                    </div>

                </div>

                <!-- Row 2 -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    <div class="bg-white rounded-xl shadow p-5 border-r-4 border-amber-400 flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-500 mb-1">ساعات کاری این هفته</p>
                            <p class="text-3xl font-bold text-amber-500">${weeklyHours.toFixed(1)}</p>
                            <p class="text-xs text-gray-400 mt-1">ساعت ثبت‌شده کارمندان</p>
                        </div>
                        <div class="bg-amber-50 rounded-full p-3">
                            <i class="fas fa-clock text-amber-400 text-2xl"></i>
                        </div>
                    </div>

                    <div class="bg-white rounded-xl shadow p-5 border-r-4 border-yellow-400 flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-500 mb-1">نرخ تکمیل سفارشات</p>
                            <p class="text-3xl font-bold text-yellow-600">${totalOrders > 0 ? Math.round((completedOrders/totalOrders)*100) : 0}%</p>
                            <p class="text-xs text-gray-400 mt-1">${completedOrders} از ${totalOrders} سفارش</p>
                        </div>
                        <div class="bg-yellow-50 rounded-full p-3">
                            <i class="fas fa-chart-pie text-yellow-400 text-2xl"></i>
                        </div>
                    </div>

                    <div class="bg-white rounded-xl shadow p-5 border-r-4 border-teal-400 flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-500 mb-1">آخرین ورود</p>
                            <p class="text-lg font-bold text-teal-600">${lastLoginStr}</p>
                            <p class="text-xs text-gray-400 mt-1">زمان آخرین فعالیت</p>
                        </div>
                        <div class="bg-teal-50 rounded-full p-3">
                            <i class="fas fa-sign-in-alt text-teal-400 text-2xl"></i>
                        </div>
                    </div>

                </div>

                <!-- Quick Actions -->
                <div class="bg-white rounded-xl shadow p-5">
                    <h2 class="text-lg font-bold mb-4 text-gray-800">عملیات سریع</h2>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button @click="showModal = 'quickOrder'"
                                class="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-bolt"></i> سفارش سریع
                        </button>
                        <button @click="showModal = 'createProject'"
                                class="bg-yellow-600 hover:bg-yellow-700 text-gray-900 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-plus-circle"></i> سفارش جدید
                        </button>
                        <button @click="currentPage = 'orders'"
                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-list"></i> مشاهده سفارشات
                        </button>
                        <button onclick="openAddUserModal()"
                                class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-user-plus"></i> کاربر جدید
                        </button>
                    </div>
                </div>

                <!-- Recent Orders -->
                <div class="bg-white rounded-xl shadow p-5">
                    <h2 class="text-lg font-bold mb-4 text-gray-800">سفارشات اخیر</h2>
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
                    field: 'دکتری حقوق عمومی' 
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
                <div class="bg-gradient-to-r from-blue-500 to-yellow-600 text-white rounded-lg p-6">
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
                                <p class="text-2xl font-bold text-yellow-600">${this.formatCurrency(stats.totalSpent)}</p>
                            </div>
                            <i class="fas fa-dollar-sign text-yellow-500 text-3xl"></i>
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
                    statusMessage = 'در انتظار شروع کار';
                    statusIcon = 'fa-clock';
                    statusColor = 'text-yellow-600';
                    break;
                case CONFIG.ORDER_STATUS.IN_PROGRESS:
                    statusMessage = `عامل در حال نوشتن ${order.type === 'نوشتن رساله' ? 'رساله' : order.type === 'نوشتن مقاله' ? 'مقاله' : 'سفارش'} شما است`;
                    statusIcon = 'fa-pen';
                    statusColor = 'text-blue-600';
                    break;
                case CONFIG.ORDER_STATUS.COMPLETED:
                    statusMessage = 'سفارش تکمیل شده است';
                    statusIcon = 'fa-check-circle';
                    statusColor = 'text-green-600';
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
            [CONFIG.ORDER_STATUS.PENDING]:     'bg-yellow-100 text-yellow-800',
            [CONFIG.ORDER_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
            [CONFIG.ORDER_STATUS.COMPLETED]:   'bg-green-100 text-green-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    },
    
    getStatusText(status) {
        const texts = {
            [CONFIG.ORDER_STATUS.PENDING]:     'در انتظار',
            [CONFIG.ORDER_STATUS.IN_PROGRESS]: 'در حال انجام',
            [CONFIG.ORDER_STATUS.COMPLETED]:   'تکمیل شده'
        };
        return texts[status] || status;
    },

    // employee Dashboard
    getemployeeDashboard() {
        try {
            debugLogger('Loading employee dashboard...', 'info');
            const orders = DataModule.getOrders();
            const pendingOrders    = orders.filter(o => o.status === CONFIG.ORDER_STATUS.PENDING);
            const inProgressOrders = orders.filter(o => o.status === CONFIG.ORDER_STATUS.IN_PROGRESS);
            const completedOrders  = orders.filter(o => o.status === CONFIG.ORDER_STATUS.COMPLETED);

            // ── پیام‌های خوانده‌نشده ─────────────────────────
            let unreadMessages = 0;
            try {
                const cu = JSON.parse(localStorage.getItem('currentUser') || '{}');
                if (cu.id) {
                    const allUsers2 = DataModule.getUsers() || [];
                    allUsers2.forEach(u => {
                        if (u.id === cu.id) return;
                        const key = `personalChat_${cu.id}_${u.id}`;
                        const msgs = JSON.parse(localStorage.getItem(key) || '[]');
                        unreadMessages += msgs.filter(m => !m.read && m.senderId !== cu.id).length;
                    });
                    const mChatMsgs = JSON.parse(localStorage.getItem('managesChat_messages') || '[]');
                    unreadMessages += mChatMsgs.filter(m => m.mentions && Array.isArray(m.mentions) && m.mentions.includes(cu.id) && !m.readBy?.includes(cu.id)).length;
                }
            } catch(e) {}

            // ── ساعات کاری امروز ──────────────────────────────
            let todayHours = 0, weeklyHours = 0;
            try {
                const cu = JSON.parse(localStorage.getItem('currentUser') || '{}');
                const whData = JSON.parse(localStorage.getItem('work_hours_data') || '[]');
                const todayStr = new Date().toISOString().split('T')[0];
                const today = new Date(); today.setHours(0,0,0,0);
                const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
                whData.filter(e => e.type !== 'expense' && e.employeeId === cu.id).forEach(e => {
                    const h = parseFloat(e.totalHours || 0);
                    if (e.date === todayStr) todayHours += h;
                    if (new Date(e.date) >= weekStart) weeklyHours += h;
                });
            } catch(e) {}

            // ── تعداد دانشجویان ───────────────────────────────
            const students = (DataModule.getUsers() || []).filter(u => u.role === 'student').length;

            return `
                <div class="space-y-6">
                    <div class="bg-gradient-to-r from-yellow-500 to-blue-600 text-gray-900 rounded-xl p-6">
                        <h2 class="text-2xl font-bold mb-1">پنل کارمند</h2>
                        <p class="text-yellow-100 text-sm">مدیریت و هماهنگی سفارشات</p>
                    </div>

                    <!-- Row 1: سفارشات -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-white rounded-xl shadow p-4 border-r-4 border-yellow-400 flex items-center justify-between">
                            <div>
                                <p class="text-xs text-gray-500">در انتظار</p>
                                <p class="text-3xl font-bold text-yellow-500">${pendingOrders.length}</p>
                                <p class="text-xs text-gray-400 mt-1">سفارش</p>
                            </div>
                            <div class="bg-yellow-50 rounded-full p-2">
                                <i class="fas fa-clock text-yellow-400 text-xl"></i>
                            </div>
                        </div>

                        <div class="bg-white rounded-xl shadow p-4 border-r-4 border-blue-500 flex items-center justify-between">
                            <div>
                                <p class="text-xs text-gray-500">در حال انجام</p>
                                <p class="text-3xl font-bold text-blue-600">${inProgressOrders.length}</p>
                                <p class="text-xs text-gray-400 mt-1">سفارش</p>
                            </div>
                            <div class="bg-blue-50 rounded-full p-2">
                                <i class="fas fa-tasks text-blue-400 text-xl"></i>
                            </div>
                        </div>

                        <div class="bg-white rounded-xl shadow p-4 border-r-4 border-green-500 flex items-center justify-between">
                            <div>
                                <p class="text-xs text-gray-500">تکمیل شده</p>
                                <p class="text-3xl font-bold text-green-600">${completedOrders.length}</p>
                                <p class="text-xs text-gray-400 mt-1">سفارش</p>
                            </div>
                            <div class="bg-green-50 rounded-full p-2">
                                <i class="fas fa-check-circle text-green-400 text-xl"></i>
                            </div>
                        </div>

                        <div class="bg-white rounded-xl shadow p-4 border-r-4 border-red-400 flex items-center justify-between ${unreadMessages > 0 ? 'ring-2 ring-red-300' : ''}">
                            <div>
                                <p class="text-xs text-gray-500">پیام‌های جدید</p>
                                <p class="text-3xl font-bold ${unreadMessages > 0 ? 'text-red-500' : 'text-gray-400'}">${unreadMessages}</p>
                                <p class="text-xs text-gray-400 mt-1">${unreadMessages > 0 ? 'خوانده‌نشده' : 'همه خوانده شده'}</p>
                            </div>
                            <div class="bg-red-50 rounded-full p-2">
                                <i class="fas fa-envelope text-red-400 text-xl"></i>
                            </div>
                        </div>
                    </div>

                    <!-- Row 2: ساعات کاری + دانشجویان -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div class="bg-white rounded-xl shadow p-4 border-r-4 border-amber-400 flex items-center justify-between">
                            <div>
                                <p class="text-xs text-gray-500">ساعات کاری امروز</p>
                                <p class="text-3xl font-bold text-amber-500">${todayHours.toFixed(1)}</p>
                                <p class="text-xs text-gray-400 mt-1">ساعت ثبت‌شده</p>
                            </div>
                            <div class="bg-amber-50 rounded-full p-2">
                                <i class="fas fa-stopwatch text-amber-400 text-xl"></i>
                            </div>
                        </div>

                        <div class="bg-white rounded-xl shadow p-4 border-r-4 border-orange-400 flex items-center justify-between">
                            <div>
                                <p class="text-xs text-gray-500">ساعات این هفته</p>
                                <p class="text-3xl font-bold text-orange-500">${weeklyHours.toFixed(1)}</p>
                                <p class="text-xs text-gray-400 mt-1">ساعت کاری</p>
                            </div>
                            <div class="bg-orange-50 rounded-full p-2">
                                <i class="fas fa-calendar-week text-orange-400 text-xl"></i>
                            </div>
                        </div>

                        <div class="bg-white rounded-xl shadow p-4 border-r-4 border-yellow-500 flex items-center justify-between">
                            <div>
                                <p class="text-xs text-gray-500">دانشجویان</p>
                                <p class="text-3xl font-bold text-yellow-600">${students}</p>
                                <p class="text-xs text-gray-400 mt-1">تعداد کل</p>
                            </div>
                            <div class="bg-yellow-50 rounded-full p-2">
                                <i class="fas fa-user-graduate text-yellow-400 text-xl"></i>
                            </div>
                        </div>
                    </div>

                    <!-- سفارشات در انتظار -->
                    <div class="bg-white rounded-xl shadow p-5">
                        <h2 class="text-lg font-bold mb-4 text-gray-800">سفارشات نیازمند توجه</h2>
                        <div class="space-y-3">
                            ${pendingOrders.length === 0
                                ? '<p class="text-gray-400 text-center py-4">سفارش در انتظاری وجود ندارد</p>'
                                : pendingOrders.slice(0, 5).map(order => `
                                    <div class="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 transition-colors">
                                        <div>
                                            <h4 class="font-medium text-gray-800">${order.studentName}</h4>
                                            <p class="text-sm text-gray-500">${order.type}</p>
                                        </div>
                                        <button onclick="window.assignOrder('${order.id}')"
                                                class="bg-yellow-600 hover:bg-yellow-700 text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
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
            
            return `
                <div class="space-y-6">
                    <div class="bg-gradient-to-r from-yellow-500 to-yellow-600 text-gray-900 rounded-lg p-6">
                        <h2 class="text-2xl font-bold mb-2">پنل عامل</h2>
                        <p class="text-yellow-100">وظایف محول شده</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        <div class="dashboard-card purple">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">درآمد</h3>
                                <p class="text-2xl font-bold text-yellow-600">${this.formatCurrency(myOrders.reduce((sum, o) => sum + (o.doctorShare || 0), 0))}</p>
                            </div>
                        </div>
                    </div>
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
            
            const rejectedOrders_unused = []; // removed – only 3 statuses now
            
            return `
                <div class="space-y-6">
                    <div class="bg-gradient-to-r from-yellow-500 to-yellow-600 text-gray-900 rounded-lg p-6">
                        <h2 class="text-2xl font-bold mb-2">پنل عامل</h2>
                        <p class="text-yellow-100">وظایف محول شده</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        <div class="dashboard-card purple">
                            <div class="text-center">
                                <h3 class="text-lg font-semibold text-gray-700">درآمد</h3>
                                <p class="text-2xl font-bold text-yellow-600">${this.formatCurrency(myOrders.reduce((sum, o) => sum + (o.doctorShare || 0), 0))}</p>
                            </div>
                        </div>
                    </div>
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