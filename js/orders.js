// Orders Management Module
console.log('🔵 orders.js loaded successfully');

const OrdersModule = {
    // Get orders content based on user role
    async getOrdersContent(userRole, userId) {
        console.log('🔵 getOrdersContent called with:', { userRole, userId });
        console.log('🔵 CONFIG exists:', typeof CONFIG !== 'undefined');
        console.log('🔵 DataModule exists:', typeof DataModule !== 'undefined');
        
        if (typeof debugLogger !== 'undefined') {
            debugLogger('OrdersModule.getOrdersContent called', 'info', { userRole, userId });
        }
        
        try {
            const orders = await this.getFilteredOrders(userRole, userId);
            console.log('🔵 getFilteredOrders returned:', orders?.length, 'orders');
            
            if (typeof debugLogger !== 'undefined') {
                debugLogger('Orders loaded successfully', 'success', { count: orders?.length });
            }
            
            return `
            <div class="space-y-6">
                <!-- Orders Header -->
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-gray-800">مدیریت سفارشات</h2>
                    <div class="flex space-x-3 space-x-reverse">
                        ${userRole === CONFIG.ROLES.MANAGER ? 
                            `<button onclick="window.showModal = 'quickOrder'" 
                                    class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium btn">
                                <i class="fas fa-bolt ml-2"></i>
                                سفارش سریع
                            </button>
                            <button onclick="window.showModal = 'createProject'" 
                                    class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium btn">
                                <i class="fas fa-plus-circle ml-2"></i>
                                ایجاد سفارش جدید
                            </button>` : 
                            ''
                        }
                        ${userRole === CONFIG.ROLES.STUDENT ? 
                            `<button onclick="window.showModal = 'quickOrder'" 
                                    class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium btn">
                                <i class="fas fa-bolt ml-2"></i>
                                سفارش سریع
                            </button>
                            <button onclick="window.showModal = 'createProject'" 
                                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium btn">
                                <i class="fas fa-plus ml-2"></i>
                                ایجاد سفارش جدید
                            </button>` : 
                            ''
                        }
                    </div>
                </div>
                
                <!-- Filters -->
                <div class="bg-white rounded-lg shadow-md p-4">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <select class="form-control" id="status-filter" onchange="OrdersModule.filterOrders().catch(console.error)">
                            <option value="">همه وضعیت‌ها</option>
                            <option value="pending">در انتظار</option>
                            <option value="in_progress">در حال انجام</option>
                            <option value="completed">تکمیل شده</option>
                        </select>
                        <select class="form-control" id="type-filter" onchange="OrdersModule.filterOrders().catch(console.error)">
                            <option value="">همه انواع کارها</option>
                            <option value="عناوین رساله ارشد">عناوین رساله ارشد</option>
                            <option value="عناوین رساله عاملی">عناوین رساله عاملی</option>
                            <option value="عناوین مقاله">عناوین مقاله</option>
                            <option value="پروپوزال رساله ارشد">پروپوزال رساله ارشد</option>
                            <option value="پروپوزال رساله عاملی">پروپوزال رساله عاملی</option>
                            <option value="پروپوزال مقاله">پروپوزال مقاله</option>
                            <option value="رساله ارشد">رساله ارشد</option>
                            <option value="رساله عاملی">رساله عاملی</option>
                            <option value="تعدیل">تعدیل</option>
                            <option value="تنضید">تنضید</option>
                            <option value="ترجمه">ترجمه</option>
                            <option value="استلال عراقی">استلال عراقی</option>
                            <option value="استلال ایرانی">استلال ایرانی</option>
                            <option value="علاج استلال ایرانی">علاج استلال ایرانی</option>
                            <option value="علاج استلال عراقی">علاج استلال عراقی</option>
                            <option value="ترجمه و تصدیق مباشره">ترجمه و تصدیق مباشره</option>
                            <option value="ترجمه و تصدیق قبول نهایی">ترجمه و تصدیق قبول نهایی</option>
                            <option value="ترجمه و تصدیق دانشنامه">ترجمه و تصدیق دانشنامه</option>
                            <option value="ترجمه مدرک">ترجمه مدرک</option>
                            <option value="تجلید">تجلید</option>
                            <option value="همانند جویی">همانند جویی</option>
                            <option value="ایران داک عنوان">ایران داک عنوان</option>
                            <option value="ایران داک پروپوزال">ایران داک پروپوزال</option>
                            <option value="ایران داک پایان نامه">ایران داک پایان نامه</option>
                            <option value="سائورگ">سائورگ</option>
                            <option value="تلخیص متن">تلخیص متن</option>
                            <option value="ساخت پاور پوینت">ساخت پاور پوینت</option>
                            <option value="تعقیب اجراعات قبل مباشره">تعقیب اجراعات قبل مباشره</option>
                            <option value="تعقیب اجراعات بعد مباشره">تعقیب اجراعات بعد مباشره</option>
                            <option value="تصدیق مجلدات">تصدیق مجلدات</option>
                            <option value="تعقیب استماره 1">تعقیب استماره 1</option>
                            <option value="تعقیب پروپوزال">تعقیب پروپوزال</option>
                            <option value="گرفتن امر اداری">گرفتن امر اداری</option>
                            <option value="تعقیب رساله">تعقیب رساله</option>
                            <option value="تعقیب اجراعات روز مناقشه">تعقیب اجراعات روز مناقشه</option>
                            <option value="سایر">سایر</option>
                        </select>
                        <input type="text" class="form-control" id="student-filter" placeholder="جستجو در نام دانشجو..." 
                               onkeyup="OrdersModule.filterOrders().catch(console.error)">
                        <button class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium btn"
                                onclick="OrdersModule.clearFilters().catch(console.error)">>
                            <i class="fas fa-times ml-2"></i>پاک کردن فیلتر
                        </button>
                    </div>
                </div>
                
                <!-- Orders Table -->
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شماره</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">دانشجو</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">نوع سفارش</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">وضعیت</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">پیشرفت</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">مبلغ</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">عملیات</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200" id="orders-table-body">
                                ${this.getOrdersTableRows(orders, userRole)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        } catch (error) {
            console.error('❌ Error in getOrdersContent:', error);
            if (typeof debugLogger !== 'undefined') {
                debugLogger('Error in getOrdersContent', 'error', { message: error.message });
            }
            return `<div class="text-center text-red-500 py-8">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p class="mb-4">خطا در بارگذاری سفارشات: ${error.message}</p>
                <button onclick="location.reload()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                    تلاش مجدد
                </button>
            </div>`;
        }
    },
    
    // Get filtered orders based on user role
    async getFilteredOrders(userRole, userId) {
        console.log('🔵 getFilteredOrders called:', { userRole, userId });
        
        // Try to fetch from backend first
        if (window.APIOrdersModule) {
            console.log('🔵 Trying APIOrdersModule...');
            try {
                const backendOrders = await APIOrdersModule.getOrders();
                if (backendOrders && Array.isArray(backendOrders)) {
                    console.log('🔵 Got backend orders:', backendOrders.length);
                    // Convert backend format to frontend format
                    const orders = backendOrders.map(order => this.convertBackendOrder(order));
                    // Save to localStorage as cache
                    DataModule.saveOrders(orders);
                    return orders.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
                }
            } catch (error) {
                console.warn('Backend not available, using localStorage:', error);
                if (typeof debugLogger !== 'undefined') {
                    debugLogger('Backend not available, using localStorage', 'warning', error);
                }
            }
        }
        
        // Fallback to localStorage
        console.log('🔵 Using localStorage fallback...');
        console.log('🔵 DataModule exists:', typeof DataModule !== 'undefined');
        
        if (typeof DataModule === 'undefined') {
            console.error('❌ DataModule is undefined!');
            return [];
        }
        
        let orders = DataModule.getOrders();
        console.log('🔵 DataModule.getOrders() returned:', orders?.length, 'orders');
        
        if (!Array.isArray(orders)) {
            console.error('❌ Orders is not an array:', typeof orders);
            orders = [];
        }
        
        // Sort by created_at descending (newest first)
        orders = orders.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
        
        console.log('🔵 Filtering for role:', userRole);
        console.log('🔵 CONFIG.ROLES:', CONFIG?.ROLES);
        
        let filteredOrders;
        switch(userRole) {
            case CONFIG.ROLES.MANAGER:
                // مدیر همه سفارشات را می‌بیند
                console.log('🔵 Manager - showing all orders');
                filteredOrders = orders;
                break;
            case CONFIG.ROLES.STUDENT:
                filteredOrders = orders.filter(o => o.studentId === userId);
                break;
            case CONFIG.ROLES.DOCTOR:
            case CONFIG.ROLES.AGENT:
                filteredOrders = orders.filter(o => o.assignedDoctorId === userId);
                break;
            case CONFIG.ROLES.employee:
                filteredOrders = orders.filter(o => [CONFIG.ORDER_STATUS.PENDING, CONFIG.ORDER_STATUS.IN_PROGRESS].includes(o.status));
                break;
            case CONFIG.ROLES.TRANSLATOR:
                filteredOrders = orders.filter(o => o.type === CONFIG.ORDER_TYPES.TRANSLATION && o.assignedDoctorId === userId);
                break;
            default:
                // برای نقش‌های نامشخص هم همه سفارشات را نشان بده
                console.log('🔵 Unknown role, showing all orders');
                filteredOrders = orders;
        }
        
        console.log('🔵 Filtered orders:', filteredOrders?.length);
        if (typeof debugLogger !== 'undefined') {
            debugLogger('Orders filtered', 'info', { role: userRole, count: filteredOrders?.length });
        }
        
        return filteredOrders;
    },
    
    // Convert backend order format to frontend format
    convertBackendOrder(backendOrder) {
        return {
            id: backendOrder.id,
            studentId: backendOrder.student,
            studentName: backendOrder.student_name || 'نامشخص',
            university: backendOrder.university,
            field: backendOrder.field,
            degree: backendOrder.degree,
            type: backendOrder.type,
            status: backendOrder.status,
            stage: backendOrder.stage || '',
            progress: backendOrder.progress || 0,
            assignedDoctorId: backendOrder.assigned_doctor,
            assignedDoctorName: backendOrder.assigned_doctor_name,
            deadline: backendOrder.deadline,
            estimatedDays: backendOrder.estimated_days || 0,
            totalAmount: backendOrder.total_amount || 0,
            doctorShare: backendOrder.doctor_share || 0,
            managerShare: backendOrder.manager_share || 0,
            paymentStatus: backendOrder.payment_status || 'pending',
            paidAmount: backendOrder.paid_amount || 0,
            description: backendOrder.description || '',
            passportNumber: backendOrder.passport_number || '',
            createdAt: backendOrder.created_at,
            updatedAt: backendOrder.updated_at,
            approvedAt: backendOrder.approved_at,
            assignedAt: backendOrder.assigned_at,
            completedAt: backendOrder.completed_at,
            tasks: backendOrder.tasks || [],
            isOverdue: backendOrder.is_overdue || false,
            daysRemaining: backendOrder.days_remaining || 0,
        };
    },
    
    // Filter orders based on current filter values - حل مشکل دوم
    async filterOrders() {
        try {
            const statusFilter = document.getElementById('status-filter')?.value || '';
            const typeFilter = document.getElementById('type-filter')?.value || '';
            const studentFilter = document.getElementById('student-filter')?.value || '';
            
            debugLogger('Filtering orders', 'info', { statusFilter, typeFilter, studentFilter });
            
            // Get current user info
            const currentUser = getCurrentUser();
            let orders = await this.getFilteredOrders(currentUser.role, currentUser.id);
            
            // Apply filters
            if (statusFilter) {
                orders = orders.filter(order => order.status === statusFilter);
            }
            
            if (typeFilter) {
                orders = orders.filter(order => order.type === typeFilter);
            }
            
            if (studentFilter) {
                orders = orders.filter(order => 
                    order.studentName.toLowerCase().includes(studentFilter.toLowerCase()) ||
                    order.university.toLowerCase().includes(studentFilter.toLowerCase())
                );
            }
            
            // Update table body
            const tableBody = document.getElementById('orders-table-body');
            if (tableBody) {
                tableBody.innerHTML = this.getOrdersTableRows(orders, currentUser.role);
                debugLogger('Orders table updated', 'success', { filteredCount: orders.length });
            }
            
        } catch (error) {
            debugLogger('Error filtering orders', 'error', error);
            UTILS.showNotification('خطا در فیلتر کردن سفارشات', 'error');
        }
    },
    
    // Clear all filters
    async clearFilters() {
        try {
            document.getElementById('status-filter').value = '';
            document.getElementById('type-filter').value = '';
            document.getElementById('student-filter').value = '';
            await this.filterOrders();
            UTILS.showNotification('فیلترها پاک شدند', 'success');
        } catch (error) {
            debugLogger('Error clearing filters', 'error', error);
        }
    },
    
    // Generate table rows for orders
    getOrdersTableRows(orders, userRole) {
        if (orders.length === 0) {
            return `
                <tr>
                    <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-2"></i>
                        <p>سفارشی موجود نیست</p>
                    </td>
                </tr>
            `;
        }
        
        return orders.map(order => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${order.id.slice(-6)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${order.studentName}</div>
                    <div class="text-sm text-gray-500">${order.university}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${order.type}</div>
                    <div class="text-sm text-gray-500">${order.degree}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${this.getStatusClass(order.status)}">
                        ${this.getStatusText(order.status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-1 bg-gray-200 rounded-full h-2 ml-2">
                            <div class="bg-blue-600 h-2 rounded-full progress-bar" style="width: ${order.progress}%"></div>
                        </div>
                        <span class="text-sm text-gray-900">${order.progress}%</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${UTILS.formatCurrency(order.totalAmount)}</div>
                    <div class="text-sm text-gray-500">پرداخت: ${UTILS.formatCurrency(order.paidAmount || 0)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2 space-x-reverse">
                        <button onclick="viewOrderDetails('${order.id}')" 
                                class="text-blue-600 hover:text-blue-900" title="مشاهده جزئیات">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${this.getActionButtons(order, userRole)}
                    </div>
                </td>
            </tr>
        `).join('');
    },
    
    // Get action buttons based on user role and order status
    getActionButtons(order, userRole) {
        let buttons = '';
        
        // Manager actions
        if (userRole === CONFIG.ROLES.MANAGER) {
            buttons += `
                <button onclick="window.editOrder('${order.id}')" 
                        class="text-green-600 hover:text-green-900" title="ویرایش">
                    <i class="fas fa-edit"></i>
                </button>
            `;
            
            // Approve/Reject for pending orders
            if (order.status === CONFIG.ORDER_STATUS.PENDING) {
                buttons += `
                    <button onclick="window.approveOrder('${order.id}')" 
                            class="text-green-600 hover:text-green-900" title="تایید">
                        <i class="fas fa-check"></i>
                    </button>
                    <button onclick="window.rejectOrder('${order.id}')" 
                            class="text-red-600 hover:text-red-900" title="رد">
                        <i class="fas fa-times"></i>
                    </button>
                `;
            }
            
            // Assign for approved orders
            if (order.status === CONFIG.ORDER_STATUS.APPROVED && !order.assignedDoctorId) {
                buttons += `
                    <button onclick="showAssignmentModal('${order.id}')" 
                            class="text-purple-600 hover:text-purple-900" title="تخصیص">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                `;
            }
        }
        
        // employee actions
        if (userRole === CONFIG.ROLES.employee) {
            // Approve/Reject for pending orders
            if (order.status === CONFIG.ORDER_STATUS.PENDING) {
                buttons += `
                    <button onclick="window.approveOrder('${order.id}')" 
                            class="text-green-600 hover:text-green-900" title="تایید">
                        <i class="fas fa-check"></i>
                    </button>
                    <button onclick="window.rejectOrder('${order.id}')" 
                            class="text-red-600 hover:text-red-900" title="رد">
                        <i class="fas fa-times"></i>
                    </button>
                `;
            }
            
            // Assign for approved orders
            if (order.status === CONFIG.ORDER_STATUS.APPROVED && !order.assignedDoctorId) {
                buttons += `
                    <button onclick="showAssignmentModal('${order.id}')" 
                            class="text-purple-600 hover:text-purple-900" title="تخصیص به عامل">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                `;
            }
            
            // Review in-progress orders
            if (order.status === CONFIG.ORDER_STATUS.IN_PROGRESS) {
                buttons += `
                    <button onclick="window.approveOrder('${order.id}')" 
                            class="text-green-600 hover:text-green-900" title="تایید کار">
                        <i class="fas fa-check-double"></i>
                    </button>
                    <button onclick="window.rejectOrder('${order.id}')" 
                            class="text-red-600 hover:text-red-900" title="رد و بازگشت">
                        <i class="fas fa-undo"></i>
                    </button>
                `;
            }
        }
        
        return buttons;
    },
    
    // Helper methods
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

    // ==================== ORDER MANAGEMENT FUNCTIONS ====================
    
    // Create new order
    async createOrder(orderData) {
        try {
            // Try backend first
            if (window.APIOrdersModule) {
                try {
                    const backendOrder = await APIOrdersModule.createOrder(orderData);
                    if (backendOrder) {
                        UTILS.showNotification('سفارش با موفقیت در سیستم ثبت شد', 'success');
                        // Refresh orders list
                        this.refreshOrders();
                        return backendOrder;
                    }
                } catch (error) {
                    console.warn('Backend create failed, using localStorage:', error);
                }
            }
            
            // Fallback to localStorage
            const orders = DataModule.getOrders();
            const newOrder = {
                id: 'ord_' + Date.now(),
                ...orderData,
                status: 'pending',
                progress: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            
            orders.push(newOrder);
            DataModule.saveOrders(orders);
            UTILS.showNotification('سفارش در حافظه محلی ذخیره شد', 'success');
            this.refreshOrders();
            return newOrder;
            
        } catch (error) {
            console.error('Failed to create order:', error);
            UTILS.showNotification('خطا در ایجاد سفارش', 'error');
            throw error;
        }
    },
    
    // Approve order
    async approveOrder(orderId) {
        try {
            // Try backend first
            if (window.APIOrdersModule) {
                try {
                    const result = await APIOrdersModule.approveOrder(orderId);
                    if (result) {
                        UTILS.showNotification('سفارش تایید شد', 'success');
                        this.refreshOrders();
                        return result;
                    }
                } catch (error) {
                    console.warn('Backend approve failed, using localStorage:', error);
                }
            }
            
            // Fallback to localStorage
            const orders = DataModule.getOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            
            if (orderIndex === -1) {
                throw new Error('سفارش یافت نشد');
            }
            
            orders[orderIndex].status = 'in_progress';
            orders[orderIndex].approvedAt = new Date().toISOString();
            orders[orderIndex].updatedAt = new Date().toISOString();
            
            DataModule.saveOrders(orders);
            UTILS.showNotification('سفارش تایید شد', 'success');
            this.refreshOrders();
            
        } catch (error) {
            console.error('Failed to approve order:', error);
            UTILS.showNotification('خطا در تایید سفارش', 'error');
        }
    },
    
    // Reject order
    async rejectOrder(orderId, reason = '') {
        try {
            // Try backend first
            if (window.APIOrdersModule) {
                try {
                    const result = await APIOrdersModule.rejectOrder(orderId, reason);
                    if (result) {
                        UTILS.showNotification('سفارش رد شد', 'success');
                        this.refreshOrders();
                        return result;
                    }
                } catch (error) {
                    console.warn('Backend reject failed, using localStorage:', error);
                }
            }
            
            // Fallback to localStorage
            const orders = DataModule.getOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            
            if (orderIndex === -1) {
                throw new Error('سفارش یافت نشد');
            }
            
            orders[orderIndex].status = 'rejected';
            orders[orderIndex].rejectionReason = reason;
            orders[orderIndex].updatedAt = new Date().toISOString();
            
            DataModule.saveOrders(orders);
            UTILS.showNotification('سفارش رد شد', 'success');
            this.refreshOrders();
            
        } catch (error) {
            console.error('Failed to reject order:', error);
            UTILS.showNotification('خطا در رد سفارش', 'error');
        }
    },
    
    // Assign order to agent
    async assignOrder(orderId, agentId) {
        try {
            // Try backend first
            if (window.APIOrdersModule) {
                try {
                    const result = await APIOrdersModule.assignOrder(orderId, agentId);
                    if (result) {
                        UTILS.showNotification('سفارش به عامل تخصیص داده شد', 'success');
                        // Create task for agent
                        this.createTaskForAgent(orderId, agentId);
                        this.refreshOrders();
                        return result;
                    }
                } catch (error) {
                    console.warn('Backend assign failed, using localStorage:', error);
                }
            }
            
            // Fallback to localStorage
            const orders = DataModule.getOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            
            if (orderIndex === -1) {
                throw new Error('سفارش یافت نشد');
            }
            
            orders[orderIndex].assignedDoctorId = agentId;
            orders[orderIndex].assignedAt = new Date().toISOString();
            orders[orderIndex].updatedAt = new Date().toISOString();
            
            DataModule.saveOrders(orders);
            UTILS.showNotification('سفارش به عامل تخصیص داده شد', 'success');
            
            // Create task for agent
            this.createTaskForAgent(orderId, agentId);
            this.refreshOrders();
            
        } catch (error) {
            console.error('Failed to assign order:', error);
            UTILS.showNotification('خطا در تخصیص سفارش', 'error');
        }
    },
    
    // Create task for agent when order is assigned
    createTaskForAgent(orderId, agentId) {
        try {
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) {
                console.error('Order not found for task creation');
                return;
            }
            
            // Get agent info
            const users = DataModule.getUsers();
            const agent = users.find(u => u.id === agentId);
            
            if (!agent) {
                console.error('Agent not found');
                return;
            }
            
            // Create task in TasksModule
            if (window.TasksModule && typeof TasksModule.createTaskFromOrder === 'function') {
                TasksModule.createTaskFromOrder(order, agent);
                debugLogger(`Task created for agent ${agent.name} from order ${orderId}`, 'success');
            } else {
                console.warn('TasksModule not available');
            }
            
        } catch (error) {
            console.error('Error creating task for agent:', error);
        }
    },
    
    // Refresh orders list
    async refreshOrders() {
        const currentUser = getCurrentUser();
        if (currentUser) {
            const content = await this.getOrdersContent(currentUser.role, currentUser.id);
            const ordersContainer = document.querySelector('[x-show="currentPage === \'orders\'"]');
            if (ordersContainer) {
                ordersContainer.innerHTML = content;
            }
        }
    }
};

// Global functions for window scope
window.OrdersModule = OrdersModule;
window.OrdersModuleReady = true;
console.log('✅ OrdersModule is ready');

window.approveOrder = async function(orderId) {
    if (confirm('آیا از تایید این سفارش اطمینان دارید؟')) {
        await OrdersModule.approveOrder(orderId);
    }
};

window.rejectOrder = async function(orderId) {
    const reason = prompt('لطفاً دلیل رد سفارش را وارد کنید:');
    if (reason) {
        await OrdersModule.rejectOrder(orderId, reason);
    }
};

window.editOrder = function(orderId) {
    // TODO: Implement edit order modal
    UTILS.showNotification('ویرایش سفارش در حال توسعه است', 'info');
};

window.viewOrderDetails = function(orderId) {
    // TODO: Implement order details modal
    UTILS.showNotification('جزئیات سفارش در حال توسعه است', 'info');
};

window.showAssignmentModal = function(orderId) {
    // TODO: Implement assignment modal
    UTILS.showNotification('تخصیص سفارش در حال توسعه است', 'info');
};
