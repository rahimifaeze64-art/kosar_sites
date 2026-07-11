// Assignment Manager Module - مدیریت تخصیص کارها
const AssignmentManagerModule = {
    // Get assignment management tab
    getAssignmentTab(order, currentUser) {
        const isManager = currentUser.role === CONFIG.ROLES.MANAGER;
        const isemployee = currentUser.role === CONFIG.ROLES.employee;
        const canManage = isManager || isemployee;
        
        if (!canManage) {
            return `
                <div class="text-center py-8">
                    <i class="fas fa-lock text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">شما مجاز به مدیریت تخصیص‌ها نیستید</p>
                </div>
            `;
        }
        
        const workList = order.workList || [];
        const workAssignments = order.workAssignments || {};
        const users = DataModule.getUsers();
        const doctors = users.filter(u => u.role === 'agent' || u.role === CONFIG.ROLES.DOCTOR || u.role === CONFIG.ROLES.AGENT);
        
        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h4 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-user-cog ml-2"></i>
                        مدیریت تخصیص کارها
                    </h4>
                    <button onclick="saveAllAssignments('${order.id}')" 
                            class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                        <i class="fas fa-save ml-2"></i>
                        ذخیره تغییرات
                    </button>
                </div>
                
                <!-- Quick Actions -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 class="font-semibold text-blue-800 mb-3">عملیات سریع</h5>
                    <div class="flex space-x-3 space-x-reverse">
                        <select id="bulk-assign-doctor" class="form-control flex-1">
                            <option value="">انتخاب عامل...</option>
                            ${doctors.map(d => `<option value="${d.id}">${d.name} - ${d.specialization || 'متخصص'}</option>`).join('')}
                        </select>
                        <button onclick="assignAllWorks('${order.id}')" 
                                class="bg-yellow-600 text-gray-900 px-4 py-2 rounded-lg hover:bg-yellow-700 whitespace-nowrap">
                            <i class="fas fa-users ml-2"></i>
                            تخصیص همه به این عامل
                        </button>
                    </div>
                </div>
                
                <!-- Individual Work Assignments -->
                <div class="bg-white border rounded-lg p-4">
                    <h5 class="font-semibold text-gray-800 mb-4">تخصیص جداگانه هر کار</h5>
                    
                    ${workList.length === 0 ? `
                        <div class="text-center py-8">
                            <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">هنوز کاری تعریف نشده است</p>
                        </div>
                    ` : `
                        <div class="space-y-4">
                            ${workList.map((work, index) => {
                                const assignedDoctorId = workAssignments[work];
                                const assignedDoctor = assignedDoctorId ? users.find(u => u.id === assignedDoctorId) : null;
                                
                                return `
                                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <div class="flex items-start justify-between mb-3">
                                            <div class="flex items-center flex-1">
                                                <span class="w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center font-bold text-sm ml-3">
                                                    ${index + 1}
                                                </span>
                                                <div class="flex-1">
                                                    <p class="font-bold text-gray-800 mb-1">${work}</p>
                                                    ${order.workDetails && order.workDetails[work] && order.workDetails[work].deadline ? `
                                                        <p class="text-sm text-gray-600">
                                                            <i class="fas fa-calendar-alt ml-1"></i>
                                                            مهلت: ${PersianDate.formatWithMonthName(order.workDetails[work].deadline)}
                                                        </p>
                                                    ` : ''}
                                                </div>
                                            </div>
                                            ${assignedDoctor ? `
                                                <div class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                                    <i class="fas fa-check-circle ml-1"></i>
                                                    تخصیص داده شده
                                                </div>
                                            ` : `
                                                <div class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                                                    <i class="fas fa-exclamation-circle ml-1"></i>
                                                    تخصیص نیافته
                                                </div>
                                            `}
                                        </div>
                                        
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label class="block text-sm font-medium text-gray-700 mb-2">انتخاب عامل</label>
                                                <select id="work-assign-${index}" 
                                                        class="form-control"
                                                        onchange="updateWorkAssignment('${order.id}', '${work}', this.value)">
                                                    <option value="">بدون تخصیص</option>
                                                    ${doctors.map(d => `
                                                        <option value="${d.id}" ${assignedDoctorId === d.id ? 'selected' : ''}>
                                                            ${d.name} - ${d.specialization || 'متخصص'}
                                                        </option>
                                                    `).join('')}
                                                </select>
                                            </div>
                                            
                                            ${assignedDoctor ? `
                                                <div class="bg-white border rounded-lg p-3">
                                                    <p class="text-sm text-gray-600 mb-1">عامل فعلی:</p>
                                                    <div class="flex items-center">
                                                        <i class="fas fa-user-md text-yellow-600 ml-2"></i>
                                                        <div>
                                                            <p class="font-medium text-gray-800">${assignedDoctor.name}</p>
                                                            <p class="text-xs text-gray-500">${assignedDoctor.specialization || 'متخصص'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ` : `
                                                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center">
                                                    <i class="fas fa-info-circle text-yellow-600 ml-2"></i>
                                                    <p class="text-sm text-yellow-700">این کار هنوز به کسی تخصیص نیافته است</p>
                                                </div>
                                            `}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
                
                <!-- Assignment History -->
                <div class="bg-white border rounded-lg p-4">
                    <h5 class="font-semibold text-gray-800 mb-3">
                        <i class="fas fa-history ml-1"></i>
                        تاریخچه تخصیص‌ها
                    </h5>
                    ${this.getAssignmentHistory(order)}
                </div>
            </div>
        `;
    },
    
    // Get assignment history
    getAssignmentHistory(order) {
        const workLog = order.workLog || [];
        const assignmentLogs = workLog.filter(log => 
            log.type === 'assignment' || 
            log.type === 'reassignment' ||
            log.message.includes('تخصیص')
        );
        
        if (assignmentLogs.length === 0) {
            return '<p class="text-gray-500 text-center py-4">هنوز تاریخچه‌ای ثبت نشده است</p>';
        }
        
        return `
            <div class="space-y-2 max-h-[300px] overflow-y-auto">
                ${assignmentLogs.map(log => `
                    <div class="flex items-start space-x-3 space-x-reverse p-3 bg-gray-50 rounded-lg">
                        <div class="flex-shrink-0">
                            <i class="fas fa-user-plus text-blue-600"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-sm font-medium text-gray-800">${log.message}</p>
                            ${log.notes ? `<p class="text-sm text-gray-600 mt-1">${log.notes}</p>` : ''}
                            <p class="text-xs text-gray-500 mt-1">${PersianDate.formatWithMonthName(log.timestamp)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// Export to window for global access
window.AssignmentManagerModule = AssignmentManagerModule;

// Global functions for assignment management
window.updateWorkAssignment = function(orderId, workName, doctorId) {
    try {
        debugLogger(`Updating assignment for work: ${workName}`, 'info', { orderId, doctorId });
        
        const orders = DataModule.getOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        
        if (orderIndex === -1) {
            UTILS.showNotification('سفارش یافت نشد', 'error');
            return;
        }
        
        // Initialize workAssignments if not exists
        if (!orders[orderIndex].workAssignments) {
            orders[orderIndex].workAssignments = {};
        }
        
        // Update assignment
        if (doctorId) {
            orders[orderIndex].workAssignments[workName] = doctorId;
            
            // Get doctor name
            const users = DataModule.getUsers();
            const doctor = users.find(u => u.id === doctorId);
            const doctorName = doctor ? doctor.name : 'نامشخص';
            
            UTILS.showNotification(`کار "${workName}" به ${doctorName} تخصیص داده شد`, 'success');
        } else {
            delete orders[orderIndex].workAssignments[workName];
            UTILS.showNotification(`تخصیص کار "${workName}" حذف شد`, 'info');
        }
        
        // Save changes
        DataModule.saveOrders(orders);
        
    } catch (error) {
        debugLogger('Error updating work assignment', 'error', error);
        UTILS.showNotification('خطا در به‌روزرسانی تخصیص', 'error');
    }
};

window.assignAllWorks = function(orderId) {
    try {
        const doctorId = document.getElementById('bulk-assign-doctor').value;
        
        if (!doctorId) {
            UTILS.showNotification('لطفاً یک عامل انتخاب کنید', 'warning');
            return;
        }
        
        const orders = DataModule.getOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        
        if (orderIndex === -1) {
            UTILS.showNotification('سفارش یافت نشد', 'error');
            return;
        }
        
        const order = orders[orderIndex];
        const workList = order.workList || [];
        
        if (workList.length === 0) {
            UTILS.showNotification('هیچ کاری برای تخصیص وجود ندارد', 'warning');
            return;
        }
        
        // Initialize workAssignments if not exists
        if (!order.workAssignments) {
            order.workAssignments = {};
        }
        
        // Assign all works to selected doctor
        workList.forEach(work => {
            order.workAssignments[work] = doctorId;
        });
        
        // Get doctor name
        const users = DataModule.getUsers();
        const doctor = users.find(u => u.id === doctorId);
        const doctorName = doctor ? doctor.name : 'نامشخص';
        
        // Add to work log
        if (!order.workLog) order.workLog = [];
        order.workLog.push({
            id: UTILS.generateId(),
            type: 'assignment',
            message: `همه کارها به ${doctorName} تخصیص داده شد`,
            notes: `تعداد کارها: ${workList.length}`,
            timestamp: new Date().toISOString(),
            userId: getCurrentUserId()
        });
        
        // Save changes
        DataModule.saveOrders(orders);
        
        UTILS.showNotification(`همه کارها به ${doctorName} تخصیص داده شد`, 'success');
        
        // Refresh page
        setTimeout(() => {
            if (typeof OrderPagesModule !== 'undefined') {
                OrderPagesModule.showOrderPage(orderId);
            }
        }, 1000);
        
    } catch (error) {
        debugLogger('Error assigning all works', 'error', error);
        UTILS.showNotification('خطا در تخصیص همه کارها', 'error');
    }
};

window.saveAllAssignments = function(orderId) {
    try {
        UTILS.showNotification('تخصیص‌ها ذخیره شد', 'success');
        
        // Refresh page
        setTimeout(() => {
            if (typeof OrderPagesModule !== 'undefined') {
                OrderPagesModule.showOrderPage(orderId);
            }
        }, 500);
        
    } catch (error) {
        debugLogger('Error saving assignments', 'error', error);
        UTILS.showNotification('خطا در ذخیره تخصیص‌ها', 'error');
    }
};
