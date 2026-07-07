// Main Workflow Management Module
const WorkflowModule = {
    // Initialize workflow
    init() {
        this.bindEvents();
        debugLogger('WorkflowModule initialized', 'success');
    },
    
    // Bind global events
    bindEvents() {
        // Assignment functions
        window.showAssignmentModal = (orderId) => AssignmentModule.showModal(orderId);
        window.submitAssignment = (doctorId, notes) => AssignmentModule.submit(doctorId, notes);
        
        // Order detail functions
        window.viewOrderDetails = (orderId) => OrderPagesModule.showOrderPage(orderId);
        
        // Chat functions
        window.sendMessage = (orderId) => ChatModule.sendMessage(orderId);
        window.answerMessage = (orderId, messageId, answerText) => ChatModule.answerMessage(orderId, messageId, answerText);
        
        // File functions
        window.uploadFile = (orderId) => FileManagerModule.uploadFile(orderId);
        window.downloadFile = (fileId) => FileManagerModule.downloadFile(fileId);
        window.deleteFile = (fileId, orderId) => FileManagerModule.deleteFile(fileId, orderId);
        
        // Progress functions
        window.updateProgress = (orderId, progress) => ProgressModule.updateProgress(orderId, progress);
        window.setMilestone = (orderId, milestone, isCompleted) => ProgressModule.setMilestone(orderId, milestone, isCompleted);
        window.generateCompletionReport = (orderId) => ProgressModule.generateCompletionReport(orderId);
        
        // Financial functions
        window.recordPayment = (orderId) => this.recordPayment(orderId);
        window.generateInvoice = (orderId) => this.generateInvoice(orderId);
        
        // Helper functions
        window.getCurrentUserId = () => {
            const currentUser = ModalsModule.getCurrentUser();
            return currentUser ? currentUser.id : 'mgr001';
        };
        
        window.getCurrentUser = () => {
            return ModalsModule.getCurrentUser();
        };
        
        // Edit work list
        window.editWorkList = (orderId) => this.editWorkList(orderId);
        
        // Reassign order
        window.reassignOrder = (orderId) => this.reassignOrder(orderId);
        
        // Rollback progress
        window.rollbackProgress = (orderId) => this.rollbackProgress(orderId);
        
        debugLogger('Workflow global functions bound', 'success');
    },
    
    // Record payment
    async recordPayment(orderId) {
        try {
            const amount = prompt('مبلغ پرداخت شده را وارد کنید (تومان):');
            if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                UTILS.showNotification('مبلغ وارد شده معتبر نیست', 'error');
                return;
            }
            
            const orders = DataModule.getOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            
            if (orderIndex === -1) {
                UTILS.showNotification('سفارش یافت نشد', 'error');
                return;
            }
            
            const paidAmount = parseFloat(amount);
            orders[orderIndex].paidAmount = (orders[orderIndex].paidAmount || 0) + paidAmount;
            
            // Add to work log
            if (!orders[orderIndex].workLog) orders[orderIndex].workLog = [];
            orders[orderIndex].workLog.push({
                id: UTILS.generateId(),
                type: 'payment',
                message: `پرداخت ثبت شد: ${paidAmount} تومان`,
                notes: `مجموع پرداخت شده: ${orders[orderIndex].paidAmount} تومان`,
                timestamp: new Date().toISOString(),
                userId: getCurrentUserId()
            });
            
            DataModule.saveOrders(orders);
            UTILS.showNotification('پرداخت با موفقیت ثبت شد', 'success');
            
        } catch (error) {
            debugLogger('Error recording payment', 'error', error);
            UTILS.showNotification('خطا در ثبت پرداخت', 'error');
        }
    },
    
    // Generate invoice
    async generateInvoice(orderId) {
        try {
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) {
                UTILS.showNotification('سفارش یافت نشد', 'error');
                return;
            }
            
            const invoice = {
                invoiceNumber: `INV-${order.id}-${Date.now()}`,
                date: new Date().toLocaleDateString('fa-IR'),
                studentName: order.studentName,
                university: order.university,
                type: order.type,
                totalAmount: order.totalAmount,
                paidAmount: order.paidAmount || 0,
                remainingAmount: (order.totalAmount || 0) - (order.paidAmount || 0),
                items: [
                    {
                        description: `${order.type} - ${order.field}`,
                        quantity: 1,
                        unitPrice: order.totalAmount,
                        totalPrice: order.totalAmount
                    }
                ]
            };
            
            // Download as JSON (in real app, this would generate PDF)
            const dataStr = JSON.stringify(invoice, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice-${order.id}-${new Date().toISOString().slice(0,10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
            
            UTILS.showNotification('فاکتور تولید شد', 'success');
            
        } catch (error) {
            debugLogger('Error generating invoice', 'error', error);
            UTILS.showNotification('خطا در تولید فاکتور', 'error');
        }
    },
    
    // Edit work list
    async editWorkList(orderId) {
        try {
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) {
                UTILS.showNotification('سفارش یافت نشد', 'error');
                return;
            }
            
            // Create modal for editing work list
            const modalHTML = `
                <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" id="edit-worklist-modal">
                    <div class="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div class="p-6 border-b">
                            <h3 class="text-lg font-bold text-gray-800">
                                <i class="fas fa-edit text-blue-600 ml-2"></i>
                                ویرایش لیست کارها
                            </h3>
                        </div>
                        <div class="p-6" x-data="{
                            workList: ${JSON.stringify(order.workList || [])},
                            workDetails: ${JSON.stringify(order.workDetails || {})},
                            workPrices: ${JSON.stringify(order.workPrices || {})},
                            selectedWork: '',
                            customWorkName: '',
                            
                            addWork() {
                                let workName = this.selectedWork;
                                if (workName === 'سایر' && this.customWorkName) {
                                    workName = this.customWorkName;
                                    this.customWorkName = '';
                                }
                                if (workName && !this.workList.includes(workName)) {
                                    this.workList.push(workName);
                                    this.workDetails[workName] = { deadline: '', price: 0 };
                                    this.workPrices[workName] = 0;
                                    this.selectedWork = '';
                                }
                            },
                            
                            removeWork(index) {
                                const workName = this.workList[index];
                                this.workList.splice(index, 1);
                                delete this.workDetails[workName];
                                delete this.workPrices[workName];
                            },
                            
                            saveChanges() {
                                saveWorkListChanges('${orderId}', this.workList, this.workDetails, this.workPrices);
                            }
                        }">
                            <div class="space-y-4">
                                <!-- Add Work -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">افزودن کار جدید</label>
                                    <div class="flex space-x-2 space-x-reverse">
                                        <select x-model="selectedWork" class="form-control flex-1">
                                            <option value="">انتخاب کنید...</option>
                                            ${OrderWizardModule.workTypes.map(w => `<option value="${w}">${w}</option>`).join('')}
                                        </select>
                                        <button type="button" @click="addWork()" 
                                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                            <i class="fas fa-plus ml-1"></i>
                                            افزودن
                                        </button>
                                    </div>
                                    <div x-show="selectedWork === 'سایر'" class="mt-2">
                                        <input type="text" x-model="customWorkName" 
                                               class="form-control" placeholder="نام کار جدید">
                                    </div>
                                </div>
                                
                                <!-- Work List -->
                                <div class="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                                    <h5 class="font-semibold text-gray-700 mb-3">لیست کارها</h5>
                                    <div class="space-y-3">
                                        <template x-for="(work, index) in workList" :key="index">
                                            <div class="bg-white rounded-lg p-3 border">
                                                <div class="flex items-start justify-between mb-2">
                                                    <span class="font-medium text-gray-800" x-text="(index + 1) + '. ' + work"></span>
                                                    <button type="button" @click="removeWork(index)" 
                                                            class="text-red-600 hover:text-red-800">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                                <div class="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label class="block text-xs text-gray-600 mb-1">زمان تحویل</label>
                                                        <input type="date" x-model="workDetails[work].deadline" 
                                                               class="form-control text-sm">
                                                    </div>
                                                    <div>
                                                        <label class="block text-xs text-gray-600 mb-1">قیمت</label>
                                                        <input type="number" x-model="workPrices[work]" 
                                                               class="form-control text-sm">
                                                    </div>
                                                </div>
                                            </div>
                                        </template>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex justify-end space-x-3 space-x-reverse mt-6 pt-4 border-t">
                                <button onclick="document.getElementById('edit-worklist-modal').remove()" 
                                        class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                                    انصراف
                                </button>
                                <button @click="saveChanges()" 
                                        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                    <i class="fas fa-save ml-2"></i>
                                    ذخیره تغییرات
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
        } catch (error) {
            debugLogger('Error editing work list', 'error', error);
            UTILS.showNotification('خطا در ویرایش لیست کارها', 'error');
        }
    },
    
    // Reassign order
    async reassignOrder(orderId) {
        try {
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) {
                UTILS.showNotification('سفارش یافت نشد', 'error');
                return;
            }
            
            // Show assignment modal
            if (typeof AssignmentModule !== 'undefined' && AssignmentModule.showModal) {
                AssignmentModule.showModal(orderId);
            } else {
                UTILS.showNotification('ماژول تخصیص یافت نشد', 'error');
            }
            
        } catch (error) {
            debugLogger('Error reassigning order', 'error', error);
            UTILS.showNotification('خطا در تخصیص مجدد', 'error');
        }
    },
    
    // Rollback progress
    async rollbackProgress(orderId) {
        try {
            const orders = DataModule.getOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            
            if (orderIndex === -1) {
                UTILS.showNotification('سفارش یافت نشد', 'error');
                return;
            }
            
            const currentProgress = orders[orderIndex].progress || 0;
            const newProgress = Math.max(0, currentProgress - 25);
            
            if (confirm(`آیا مطمئن هستید که می‌خواهید پیشرفت را از ${currentProgress}% به ${newProgress}% برگردانید؟`)) {
                orders[orderIndex].progress = newProgress;
                
                // Add to work log
                if (!orders[orderIndex].workLog) orders[orderIndex].workLog = [];
                orders[orderIndex].workLog.push({
                    id: UTILS.generateId(),
                    type: 'rollback',
                    message: `پیشرفت برگردانده شد: ${currentProgress}% → ${newProgress}%`,
                    notes: 'توسط مدیر',
                    timestamp: new Date().toISOString(),
                    userId: getCurrentUserId()
                });
                
                DataModule.saveOrders(orders);
                UTILS.showNotification('پیشرفت با موفقیت برگردانده شد', 'success');
                
                // Refresh page
                setTimeout(() => {
                    if (typeof OrderPagesModule !== 'undefined') {
                        OrderPagesModule.showOrderPage(orderId);
                    }
                }, 500);
            }
            
        } catch (error) {
            debugLogger('Error rolling back progress', 'error', error);
            UTILS.showNotification('خطا در برگرداندن پیشرفت', 'error');
        }
    },
};

// Save work list changes
window.saveWorkListChanges = function(orderId, workList, workDetails, workPrices) {
    try {
        const orders = DataModule.getOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        
        if (orderIndex === -1) {
            UTILS.showNotification('سفارش یافت نشد', 'error');
            return;
        }
        
        orders[orderIndex].workList = workList;
        orders[orderIndex].workDetails = workDetails;
        orders[orderIndex].workPrices = workPrices;
        
        // Recalculate total amount
        let totalAmount = 0;
        for (const workName in workPrices) {
            totalAmount += parseFloat(workPrices[workName] || 0);
        }
        orders[orderIndex].totalAmount = totalAmount;
        
        // Add to work log
        if (!orders[orderIndex].workLog) orders[orderIndex].workLog = [];
        orders[orderIndex].workLog.push({
            id: UTILS.generateId(),
            type: 'edit',
            message: 'لیست کارها ویرایش شد',
            notes: `تعداد کارها: ${workList.length}`,
            timestamp: new Date().toISOString(),
            userId: getCurrentUserId()
        });
        
        DataModule.saveOrders(orders);
        UTILS.showNotification('تغییرات با موفقیت ذخیره شد', 'success');
        
        // Close modal and refresh
        document.getElementById('edit-worklist-modal').remove();
        setTimeout(() => {
            if (typeof OrderPagesModule !== 'undefined') {
                OrderPagesModule.showOrderPage(orderId);
            }
        }, 500);
        
    } catch (error) {
        debugLogger('Error saving work list changes', 'error', error);
        UTILS.showNotification('خطا در ذخیره تغییرات', 'error');
    }
};

// Initialize workflow when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    try {
        debugLogger('Initializing WorkflowModule...', 'info');
        WorkflowModule.init();
        debugLogger('WorkflowModule initialized successfully', 'success');
    } catch (error) {
        debugLogger('Error initializing WorkflowModule', 'error', error);
    }
});