/**
 * مدیریت سفارشات — localStorage
 */
const OrdersModule = (function () {
    'use strict';

    const ORDER_STATUS = {
        PENDING: 'pending',
        APPROVED: 'approved',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        REJECTED: 'rejected'
    };

    const STATUS_LABELS = {
        pending: 'در انتظار',
        approved: 'تایید شده',
        in_progress: 'در حال انجام',
        completed: 'تکمیل شده',
        rejected: 'رد شده'
    };

    const STATUS_CLASSES = {
        pending: 'bg-yellow-100 text-yellow-800',
        approved: 'bg-indigo-100 text-indigo-800',
        in_progress: 'bg-blue-100 text-blue-800',
        completed: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800'
    };

    const WORK_TYPES = [
        'عناوین رساله ارشد', 'عناوین رساله عاملی', 'عناوین مقاله',
        'پروپوزال رساله ارشد', 'پروپوزال رساله عاملی', 'پروپوزال مقاله',
        'رساله ارشد', 'رساله عاملی', 'تعدیل', 'تنضید', 'ترجمه',
        'استلال عراقی', 'استلال ایرانی', 'علاج استلال ایرانی', 'علاج استلال عراقی',
        'ترجمه و تصدیق مباشره', 'ترجمه و تصدیق قبول نهایی', 'ترجمه و تصدیق دانشنامه',
        'ترجمه مدرک', 'تجلید', 'همانند جویی',
        'ایران داک عنوان', 'ایران داک پروپوزال', 'ایران داک پایان نامه',
        'سائورگ', 'تلخیص متن', 'ساخت پاور پوینت',
        'تعقیب اجراعات قبل مباشره', 'تعقیب اجراعات بعد مباشره', 'تصدیق مجلدات',
        'تعقیب استماره 1', 'تعقیب پروپوزال', 'گرفتن امر اداری', 'تعقیب رساله',
        'تعقیب اجراعات روز مناقشه', 'سفارش سفارشی', 'سایر',
        'نوشتن رساله', 'نوشتن مقاله', 'ترجمه رساله', 'تلخیص', 'آماده‌سازی ارائه', 'تحقیق و بررسی'
    ];

    function log(msg, type, extra) {
        if (typeof debugLogger === 'function') debugLogger(msg, type, extra);
    }

    function notify(msg, type) {
        if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
            UTILS.showNotification(msg, type);
        } else {
            alert(msg);
        }
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getCurrentUserSafe() {
        if (typeof getCurrentUser === 'function') return getCurrentUser();
        if (typeof ModalsModule !== 'undefined' && ModalsModule.getCurrentUser) {
            return ModalsModule.getCurrentUser();
        }
        return null;
    }

    function loadOrders() {
        if (typeof DataModule === 'undefined') return [];
        const orders = DataModule.getOrders();
        return Array.isArray(orders) ? orders : [];
    }

    function saveOrders(orders) {
        if (typeof DataModule === 'undefined') return false;
        return DataModule.saveOrders(orders);
    }

    function normalizeOrder(raw) {
        if (!raw || typeof raw !== 'object') return null;
        return {
            id: raw.id || ('ord_' + Date.now()),
            studentId: raw.studentId || null,
            studentName: raw.studentName || 'نامشخص',
            university: raw.university || 'نامشخص',
            field: raw.field || '',
            degree: raw.degree || '',
            type: raw.type || 'سایر',
            status: raw.status || ORDER_STATUS.PENDING,
            stage: raw.stage || '',
            progress: parseInt(raw.progress, 10) || 0,
            assignedDoctorId: raw.assignedDoctorId || null,
            assignedDoctor: raw.assignedDoctor || null,
            deadline: raw.deadline || '',
            deadlineTime: raw.deadlineTime || '',
            deadlineDateTime: raw.deadlineDateTime || null,
            totalAmount: parseFloat(raw.totalAmount) || 0,
            paidAmount: parseFloat(raw.paidAmount) || 0,
            doctorShare: parseFloat(raw.doctorShare) || 0,
            managerShare: parseFloat(raw.managerShare) || 0,
            paymentStatus: raw.paymentStatus || 'pending',
            description: raw.description || '',
            title: raw.title || '',
            isCustomOrder: !!raw.isCustomOrder,
            createdAt: raw.createdAt || new Date().toISOString(),
            updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
            approvedAt: raw.approvedAt || null,
            assignedAt: raw.assignedAt || null,
            completedAt: raw.completedAt || null,
            rejectionReason: raw.rejectionReason || '',
            rejectionHistory: Array.isArray(raw.rejectionHistory) ? raw.rejectionHistory : [],
            tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
            workList: Array.isArray(raw.workList) ? raw.workList : [],
            workLog: Array.isArray(raw.workLog) ? raw.workLog : [],
            files: Array.isArray(raw.files) ? raw.files : [],
            passportNumber: raw.passportNumber || '',
            phone: raw.phone || ''
        };
    }

    function sortOrders(orders) {
        return [...orders].sort(
            (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
    }

    async function fetchOrdersFromStorage() {
        // Always use localStorage - API disabled for offline mode
        log('Using localStorage for orders (offline mode)', 'info');
        return sortOrders(loadOrders().map(normalizeOrder).filter(Boolean));
    }

    function convertBackendOrder(backendOrder) {
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
            assignedDoctor: backendOrder.assigned_doctor_name,
            deadline: backendOrder.deadline,
            totalAmount: backendOrder.total_amount || 0,
            doctorShare: backendOrder.doctor_share || 0,
            managerShare: backendOrder.manager_share || 0,
            paymentStatus: backendOrder.payment_status || 'pending',
            paidAmount: backendOrder.paid_amount || 0,
            description: backendOrder.description || '',
            createdAt: backendOrder.created_at,
            updatedAt: backendOrder.updated_at,
            tasks: backendOrder.tasks || []
        };
    }

    function filterByRole(orders, userRole, userId) {
        const R = CONFIG?.ROLES || {};
        switch (userRole) {
            case R.MANAGER:
                return orders;
            case R.STUDENT:
                return orders.filter(o => o.studentId === userId);
            case R.DOCTOR:
            case R.AGENT:
                return orders.filter(o => o.assignedDoctorId === userId);
            case R.employee:
                return orders.filter(o =>
                    [ORDER_STATUS.PENDING, ORDER_STATUS.APPROVED, ORDER_STATUS.IN_PROGRESS].includes(o.status)
                );
            case R.TRANSLATOR:
                return orders.filter(o =>
                    o.type === (CONFIG?.ORDER_TYPES?.TRANSLATION || 'ترجمه رساله') &&
                    o.assignedDoctorId === userId
                );
            default:
                return orders;
        }
    }

    async function getFilteredOrders(userRole, userId) {
        const orders = await fetchOrdersFromStorage();
        return filterByRole(orders, userRole, userId);
    }

    function getOrderById(orderId) {
        return loadOrders().find(o => o.id === orderId) || null;
    }

    function updateOrder(orderId, updates) {
        const orders = loadOrders();
        const index = orders.findIndex(o => o.id === orderId);
        if (index === -1) return null;

        orders[index] = {
            ...orders[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        saveOrders(orders);
        return orders[index];
    }

    function formatAmount(amount) {
        if (typeof UTILS !== 'undefined' && UTILS.formatCurrency) {
            return UTILS.formatCurrency(amount || 0);
        }
        return (amount || 0).toLocaleString('fa-IR') + ' تومان';
    }

    function getStatusText(status) {
        return STATUS_LABELS[status] || status || 'نامشخص';
    }

    function getStatusClass(status) {
        return STATUS_CLASSES[status] || 'bg-gray-100 text-gray-800';
    }

    function canManageOrders(role) {
        const R = CONFIG?.ROLES || {};
        return role === R.MANAGER || role === R.employee;
    }

    function renderFilterOptions() {
        const statusOptions = Object.entries(STATUS_LABELS)
            .map(([val, label]) => `<option value="${val}">${label}</option>`)
            .join('');
        const typeOptions = WORK_TYPES
            .map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
            .join('');
        return { statusOptions, typeOptions };
    }

    function openModal(name) {
        if (typeof ModalsModule !== 'undefined' && ModalsModule.getAlpineData) {
            const app = ModalsModule.getAlpineData();
            if (app) {
                app.showModal = name;
                return;
            }
        }
        const appEl = document.querySelector('[x-data]');
        if (appEl && typeof Alpine !== 'undefined' && Alpine.$data) {
            Alpine.$data(appEl).showModal = name;
        }
    }

    function renderCreateButtons(userRole) {
        const R = CONFIG?.ROLES || {};
        if (userRole === R.MANAGER) {
            return `
                <button type="button" onclick="OrdersModule.openModal('quickOrder')"
                        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium btn">
                    <i class="fas fa-bolt ml-2"></i> سفارش سریع
                </button>
                <button type="button" onclick="OrdersModule.openModal('createProject')"
                        class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium btn">
                    <i class="fas fa-plus-circle ml-2"></i> ایجاد سفارش جدید
                </button>`;
        }
        if (userRole === R.STUDENT) {
            return `
                <button type="button" onclick="OrdersModule.openModal('quickOrder')"
                        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium btn">
                    <i class="fas fa-bolt ml-2"></i> سفارش سریع
                </button>
                <button type="button" onclick="OrdersModule.openModal('createProject')"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium btn">
                    <i class="fas fa-plus ml-2"></i> ایجاد سفارش جدید
                </button>`;
        }
        return '';
    }

    function renderActionButtons(order, userRole) {
        const safeId = escapeHtml(order.id);
        let html = `
            <button type="button" onclick="OrdersModule.viewDetails('${safeId}')"
                    class="text-blue-600 hover:text-blue-900" title="مشاهده جزئیات">
                <i class="fas fa-eye"></i>
            </button>`;

        if (!canManageOrders(userRole)) return html;

        html += `
            <button type="button" onclick="OrdersModule.editOrder('${safeId}')"
                    class="text-green-600 hover:text-green-900" title="ویرایش">
                <i class="fas fa-edit"></i>
            </button>`;

        if (order.status === ORDER_STATUS.PENDING) {
            html += `
                <button type="button" onclick="OrdersModule.approveOrder('${safeId}')"
                        class="text-green-600 hover:text-green-900" title="تایید">
                    <i class="fas fa-check"></i>
                </button>
                <button type="button" onclick="OrdersModule.openRejectModal('${safeId}')"
                        class="text-red-600 hover:text-red-900" title="رد">
                    <i class="fas fa-times"></i>
                </button>`;
        }

        if (order.status === ORDER_STATUS.APPROVED && !order.assignedDoctorId) {
            html += `
                <button type="button" onclick="OrdersModule.openAssignment('${safeId}')"
                        class="text-purple-600 hover:text-purple-900" title="تخصیص">
                    <i class="fas fa-user-plus"></i>
                </button>`;
        }

        if (order.status === ORDER_STATUS.IN_PROGRESS) {
            html += `
                <button type="button" onclick="OrdersModule.completeOrder('${safeId}')"
                        class="text-green-600 hover:text-green-900" title="تکمیل">
                    <i class="fas fa-check-double"></i>
                </button>`;
        }

        return html;
    }

    function getOrdersTableRows(orders, userRole) {
        if (!orders.length) {
            return `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-2 block opacity-40"></i>
                        <p>سفارشی موجود نیست</p>
                    </td>
                </tr>`;
        }

        return orders.map(order => {
            const displayType = order.isCustomOrder ? (order.title || order.type) : order.type;
            const safeId = escapeHtml(order.id);
            return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${safeId.slice(-8)}
                    ${order.isCustomOrder ? '<span class="mr-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">سفارشی</span>' : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${escapeHtml(order.studentName)}</div>
                    <div class="text-sm text-gray-500">${escapeHtml(order.university)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${escapeHtml(displayType)}</div>
                    <div class="text-sm text-gray-500">${escapeHtml(order.degree || '')}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(order.status)}">
                        ${getStatusText(order.status)}
                    </span>
                    ${order.assignedDoctor ? `<div class="text-xs text-gray-500 mt-1">${escapeHtml(order.assignedDoctor)}</div>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-1 bg-gray-200 rounded-full h-2 ml-2 min-w-[60px]">
                            <div class="bg-blue-600 h-2 rounded-full" style="width:${Math.min(100, order.progress)}%"></div>
                        </div>
                        <span class="text-sm text-gray-900">${order.progress}%</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${formatAmount(order.totalAmount)}</div>
                    <div class="text-sm text-gray-500">پرداخت: ${formatAmount(order.paidAmount)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2 space-x-reverse">
                        ${renderActionButtons(order, userRole)}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    function renderStatsBar(orders) {
        const counts = { pending: 0, approved: 0, in_progress: 0, completed: 0, rejected: 0 };
        orders.forEach(o => {
            if (counts[o.status] !== undefined) counts[o.status]++;
        });
        const items = [
            { key: 'pending', label: 'در انتظار', cls: 'border-yellow-400' },
            { key: 'approved', label: 'تایید شده', cls: 'border-indigo-400' },
            { key: 'in_progress', label: 'در حال انجام', cls: 'border-blue-400' },
            { key: 'completed', label: 'تکمیل', cls: 'border-green-400' },
            { key: 'rejected', label: 'رد شده', cls: 'border-red-400' }
        ];
        return `
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                ${items.map(({ key, label, cls }) => `
                    <div class="bg-white rounded-lg shadow p-3 text-center border-r-4 ${cls}">
                        <div class="text-2xl font-bold text-gray-800">${counts[key]}</div>
                        <div class="text-xs text-gray-500">${label}</div>
                    </div>`).join('')}
            </div>`;
    }

    async function getOrdersContent(userRole, userId) {
        try {
            const orders = await getFilteredOrders(userRole, userId);
            const { statusOptions, typeOptions } = renderFilterOptions();

            return `
            <div class="space-y-6">
                <div class="flex justify-between items-center flex-wrap gap-3">
                    <h2 class="text-2xl font-bold text-gray-800">مدیریت سفارشات</h2>
                    <div class="flex space-x-3 space-x-reverse flex-wrap">
                        ${renderCreateButtons(userRole)}
                    </div>
                </div>

                ${renderStatsBar(orders)}

                <div class="bg-white rounded-lg shadow-md p-4">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <select class="form-control" id="status-filter"
                                onchange="OrdersModule.filterOrders()">
                            <option value="">همه وضعیت‌ها</option>
                            ${statusOptions}
                        </select>
                        <select class="form-control" id="type-filter"
                                onchange="OrdersModule.filterOrders()">
                            <option value="">همه انواع کارها</option>
                            ${typeOptions}
                        </select>
                        <input type="text" class="form-control" id="student-filter"
                               placeholder="جستجو در نام دانشجو..."
                               onkeyup="OrdersModule.filterOrders()">
                        <button type="button"
                                class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium btn"
                                onclick="OrdersModule.clearFilters()">
                            <i class="fas fa-times ml-2"></i> پاک کردن فیلتر
                        </button>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">شماره</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">دانشجو</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نوع سفارش</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">وضعیت</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">پیشرفت</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">مبلغ</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عملیات</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200" id="orders-table-body">
                                ${getOrdersTableRows(orders, userRole)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        } catch (error) {
            log('Error in getOrdersContent', 'error', error);
            return `
                <div class="text-center text-red-500 py-8">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p class="mb-4">خطا در بارگذاری سفارشات: ${escapeHtml(error.message)}</p>
                    <button type="button" onclick="OrdersModule.refreshOrders()"
                            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                        تلاش مجدد
                    </button>
                </div>`;
        }
    }

    async function filterOrders() {
        try {
            const statusFilter = document.getElementById('status-filter')?.value || '';
            const typeFilter = document.getElementById('type-filter')?.value || '';
            const studentFilter = (document.getElementById('student-filter')?.value || '').trim().toLowerCase();

            const currentUser = getCurrentUserSafe();
            if (!currentUser) return;

            let orders = await getFilteredOrders(currentUser.role, currentUser.id);

            if (statusFilter) orders = orders.filter(o => o.status === statusFilter);
            if (typeFilter) {
                orders = orders.filter(o =>
                    o.type === typeFilter ||
                    (o.isCustomOrder && (o.title === typeFilter || o.type === typeFilter))
                );
            }
            if (studentFilter) {
                orders = orders.filter(o =>
                    (o.studentName || '').toLowerCase().includes(studentFilter) ||
                    (o.university || '').toLowerCase().includes(studentFilter) ||
                    (o.title || '').toLowerCase().includes(studentFilter)
                );
            }

            const tableBody = document.getElementById('orders-table-body');
            if (tableBody) {
                tableBody.innerHTML = getOrdersTableRows(orders, currentUser.role);
            }
        } catch (error) {
            log('Error filtering orders', 'error', error);
            notify('خطا در فیلتر کردن سفارشات', 'error');
        }
    }

    async function clearFilters() {
        const statusEl = document.getElementById('status-filter');
        const typeEl = document.getElementById('type-filter');
        const studentEl = document.getElementById('student-filter');
        if (statusEl) statusEl.value = '';
        if (typeEl) typeEl.value = '';
        if (studentEl) studentEl.value = '';
        await filterOrders();
        notify('فیلترها پاک شدند', 'success');
    }

    async function refreshOrders() {
        const currentUser = getCurrentUserSafe();
        if (!currentUser) return;

        const content = await getOrdersContent(currentUser.role, currentUser.id);

        const appEl = document.querySelector('[x-data]');
        if (appEl && typeof Alpine !== 'undefined' && Alpine.$data) {
            const app = Alpine.$data(appEl);
            if (app) {
                app.ordersContent = content;
                return;
            }
        }

        const container = document.querySelector('[x-show="currentPage === \'orders\'"]');
        if (container) container.innerHTML = content;
    }

    function viewDetails(orderId) {
        if (typeof OrderPagesModule !== 'undefined') {
            OrderPagesModule.showOrderPage(orderId);
            return;
        }
        if (typeof window.viewOrderDetails === 'function') {
            window.viewOrderDetails(orderId);
            return;
        }
        notify('ماژول جزئیات سفارش در دسترس نیست', 'error');
    }

    function openAssignment(orderId) {
        if (typeof AssignmentModule !== 'undefined') {
            AssignmentModule.showModal(orderId);
            return;
        }
        if (typeof window.showAssignmentModal === 'function') {
            window.showAssignmentModal(orderId);
            return;
        }
        notify('ماژول تخصیص در دسترس نیست', 'error');
    }

    async function createOrder(orderData) {
        const order = normalizeOrder({
            id: 'ord_' + Date.now(),
            ...orderData,
            status: ORDER_STATUS.PENDING,
            progress: 0,
            createdAt: new Date().toISOString()
        });

        const orders = loadOrders();
        orders.push(order);
        saveOrders(orders);
        notify('سفارش ثبت شد', 'success');
        await refreshOrders();
        return order;
    }

    async function approveOrder(orderId) {
        if (!confirm('آیا از تایید این سفارش اطمینان دارید؟')) return;

        const updated = updateOrder(orderId, {
            status: ORDER_STATUS.APPROVED,
            stage: 'تایید شده — آماده تخصیص',
            approvedAt: new Date().toISOString(),
            progress: Math.max(5, getOrderById(orderId)?.progress || 0)
        });

        if (!updated) {
            notify('سفارش یافت نشد', 'error');
            return;
        }

        notify('سفارش تایید شد', 'success');
        await refreshOrders();
    }

    async function rejectOrder(orderId) {
        const reason = prompt('دلیل رد سفارش را وارد کنید:');
        if (reason === null) return;
        if (!reason.trim()) {
            notify('دلیل رد الزامی است', 'error');
            return;
        }

        const order = getOrderById(orderId);
        const currentUser = getCurrentUserSafe() || { id: 'unknown', name: 'کاربر', role: 'manager' };
        const history = [...(order?.rejectionHistory || []), {
            date: new Date().toISOString(),
            reason: reason.trim(),
            rejectedBy: currentUser.role,
            rejectedById: currentUser.id,
            rejectedByName: currentUser.name
        }];

        const updated = updateOrder(orderId, {
            status: ORDER_STATUS.REJECTED,
            stage: 'رد شده',
            rejectionReason: reason.trim(),
            rejectionHistory: history
        });

        if (!updated) {
            notify('سفارش یافت نشد', 'error');
            return;
        }

        notify('سفارش رد شد', 'warning');
        await refreshOrders();
    }

    async function completeOrder(orderId) {
        if (!confirm('آیا این سفارش تکمیل شده است؟')) return;

        const updated = updateOrder(orderId, {
            status: ORDER_STATUS.COMPLETED,
            stage: 'تکمیل شده',
            progress: 100,
            completedAt: new Date().toISOString()
        });

        if (!updated) {
            notify('سفارش یافت نشد', 'error');
            return;
        }

        notify('سفارش تکمیل شد', 'success');
        await refreshOrders();
    }

    async function assignOrder(orderId, agentId, notes) {
        const users = typeof DataModule !== 'undefined' ? DataModule.getUsers() : [];
        const agent = users.find(u => u.id === agentId);
        if (!agent) {
            notify('عامل یافت نشد', 'error');
            return null;
        }

        const order = getOrderById(orderId);
        if (!order) {
            notify('سفارش یافت نشد', 'error');
            return null;
        }

        const workLog = [...(order.workLog || []), {
            id: (typeof UTILS !== 'undefined' && UTILS.generateId) ? UTILS.generateId() : Date.now().toString(),
            type: 'assignment',
            message: `سفارش به ${agent.name} تخصیص یافت`,
            notes: notes || '',
            timestamp: new Date().toISOString()
        }];

        const updated = updateOrder(orderId, {
            assignedDoctorId: agentId,
            assignedDoctor: agent.name,
            status: ORDER_STATUS.IN_PROGRESS,
            stage: 'تخصیص یافته — در حال انجام',
            assignedAt: new Date().toISOString(),
            assignmentNotes: notes || '',
            progress: Math.max(order.progress || 0, 5),
            workLog,
            files: order.files || [],
            questions: order.questions || []
        });

        if (window.TasksModule && typeof TasksModule.createTaskFromOrder === 'function') {
            TasksModule.createTaskFromOrder(updated, agent);
        }

        notify(`سفارش به ${agent.name} تخصیص یافت`, 'success');
        await refreshOrders();
        return updated;
    }

    function closeEditModal() {
        document.getElementById('order-edit-modal')?.remove();
    }

    function editOrder(orderId) {
        const order = getOrderById(orderId);
        if (!order) {
            notify('سفارش یافت نشد', 'error');
            return;
        }

        closeEditModal();

        const modal = document.createElement('div');
        modal.id = 'order-edit-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-lg max-w-lg w-full p-6" onclick="event.stopPropagation()">
                <h3 class="text-lg font-bold mb-4">ویرایش سفارش</h3>
                <input type="hidden" id="edit-order-id" value="${escapeHtml(order.id)}">
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium mb-1">نام دانشجو</label>
                        <input id="edit-student-name" class="form-control w-full" value="${escapeHtml(order.studentName)}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">نوع سفارش</label>
                        <input id="edit-order-type" class="form-control w-full" value="${escapeHtml(order.type)}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">دانشگاه</label>
                        <input id="edit-university" class="form-control w-full" value="${escapeHtml(order.university)}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">مهلت</label>
                        <input id="edit-deadline" class="form-control w-full" value="${escapeHtml(order.deadline || '')}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">مبلغ (تومان)</label>
                        <input id="edit-amount" type="number" min="0" class="form-control w-full" value="${order.totalAmount || 0}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">توضیحات</label>
                        <textarea id="edit-description" class="form-control w-full" rows="3">${escapeHtml(order.description || '')}</textarea>
                    </div>
                </div>
                <div class="flex gap-2 mt-6">
                    <button type="button" onclick="OrdersModule.saveEditOrder()"
                            class="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                        ذخیره
                    </button>
                    <button type="button" onclick="OrdersModule.closeEditModal()"
                            class="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
                        انصراف
                    </button>
                </div>
            </div>`;
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeEditModal();
        });
        document.body.appendChild(modal);
    }

    function openRejectModal(orderId) {
        window.currentOrderId = orderId;
        const order = getOrderById(orderId);
        if (order) {
            setTimeout(function () {
                const infoDiv = document.getElementById('reject-order-info');
                if (infoDiv) {
                    infoDiv.innerHTML = `
                        <p class="font-medium text-red-800">${escapeHtml(order.studentName)}</p>
                        <p class="text-sm text-red-600">${escapeHtml(order.type)} - ${escapeHtml(order.university)}</p>`;
                }
            }, 100);
        }
        const alpineData = typeof ModalsModule !== 'undefined' && ModalsModule.getAlpineData
            ? ModalsModule.getAlpineData() : null;
        if (alpineData) {
            alpineData.showModal = 'rejectOrder';
        }
    }

    async function submitRejectOrder(orderId, reason) {
        if (!reason || !reason.trim()) {
            notify('لطفاً دلیل رد را وارد کنید', 'error');
            return;
        }
        const order = getOrderById(orderId);
        const currentUser = getCurrentUserSafe() || { id: 'unknown', name: 'کاربر', role: 'manager' };
        const history = [...(order?.rejectionHistory || []), {
            date: new Date().toISOString(),
            reason: reason.trim(),
            rejectedBy: currentUser.role,
            rejectedById: currentUser.id,
            rejectedByName: currentUser.name
        }];
        const updated = updateOrder(orderId, {
            status: ORDER_STATUS.REJECTED,
            stage: 'رد شده — نیاز به اصلاح',
            rejectionReason: reason.trim(),
            rejectionHistory: history
        });
        if (!updated) {
            notify('سفارش یافت نشد', 'error');
            return;
        }
        notify('سفارش رد شد', 'warning');
        if (typeof ModalsModule !== 'undefined' && ModalsModule.closeModal) {
            ModalsModule.closeModal();
        }
        await refreshOrders();
    }

    async function saveEditOrder() {
        const orderId = document.getElementById('edit-order-id')?.value;
        if (!orderId) return;

        const updated = updateOrder(orderId, {
            studentName: document.getElementById('edit-student-name')?.value.trim(),
            type: document.getElementById('edit-order-type')?.value.trim(),
            university: document.getElementById('edit-university')?.value.trim(),
            deadline: document.getElementById('edit-deadline')?.value.trim(),
            totalAmount: parseFloat(document.getElementById('edit-amount')?.value) || 0,
            description: document.getElementById('edit-description')?.value.trim()
        });

        if (!updated) {
            notify('خطا در ذخیره', 'error');
            return;
        }

        closeEditModal();
        notify('سفارش ویرایش شد', 'success');
        await refreshOrders();
    }

    function bindGlobals() {
        window.approveOrder = function (orderId) {
            OrdersModule.approveOrder(orderId);
        };
        window.rejectOrder = function (orderId) {
            OrdersModule.openRejectModal(orderId);
        };
        window.submitRejectOrder = function (reason) {
            const orderId = window.currentOrderId;
            if (!orderId) {
                notify('سفارش انتخاب نشده', 'error');
                return;
            }
            OrdersModule.submitRejectOrder(orderId, reason);
        };
        window.viewOrderDetails = function (orderId) {
            OrdersModule.viewDetails(orderId);
        };
        window.showAssignmentModal = function (orderId) {
            OrdersModule.openAssignment(orderId);
        };
        window.editOrder = function (orderId) {
            OrdersModule.editOrder(orderId);
        };
    }

    return {
        ORDER_STATUS,
        getOrdersContent,
        getFilteredOrders,
        getOrderById,
        getOrdersTableRows,
        filterOrders,
        clearFilters,
        refreshOrders,
        createOrder,
        approveOrder,
        rejectOrder,
        submitRejectOrder,
        openRejectModal,
        completeOrder,
        assignOrder,
        updateOrder,
        viewDetails,
        openAssignment,
        openModal,
        editOrder,
        saveEditOrder,
        closeEditModal,
        getStatusText,
        getStatusClass,
        bindGlobals
    };
})();

window.OrdersModule = OrdersModule;
window.OrdersModuleReady = true;
OrdersModule.bindGlobals();

document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () { OrdersModule.bindGlobals(); }, 800);
});

window.addEventListener('load', function () {
    OrdersModule.bindGlobals();
});
