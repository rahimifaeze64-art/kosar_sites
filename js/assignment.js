// Assignment Module - مدیریت تخصیص سفارشات به عاملها
const AssignmentModule = {
    // Show assignment modal
    showModal(orderId) {
        try {
            debugLogger(`Opening assignment modal for order: ${orderId}`, 'info');
            
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) {
                UTILS.showNotification('سفارش یافت نشد', 'error');
                return;
            }
            
            // Store current order ID globally
            window.currentAssignmentOrderId = orderId;
            
            // Create and show modal
            this.createAssignmentModal();
            this.populateOrderInfo(order);
            this.showModalDialog();
            
        } catch (error) {
            debugLogger('Error opening assignment modal', 'error', error);
            UTILS.showNotification('خطا در باز کردن modal تخصیص', 'error');
        }
    },
    
    // Create assignment modal
    createAssignmentModal() {
        const container = document.getElementById('modals-container');
        if (!container) {
            debugLogger('Modals container not found', 'error');
            return;
        }
        
        // Check if modal already exists
        const existingModal = container.querySelector('#assignment-modal');
        if (existingModal) {
            return;
        }
        
        const doctors = DataModule.getUsers().filter(u => u.role === CONFIG.ROLES.DOCTOR);
        
        const modalHTML = `
            <div id="assignment-modal" x-show="showModal === 'assignmentModal'" 
                 class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" 
                 @click.self="showModal = null" style="display: none;">
                <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6 border-b">
                        <h3 class="text-lg font-bold text-gray-800">
                            <i class="fas fa-user-plus text-purple-600 ml-2"></i>
                            تخصیص سفارش به عامل
                        </h3>
                    </div>
                    <div class="p-6 space-y-6" x-data="{ selectedDoctor: '', assignmentNotes: '' }">
                        <!-- Order Info -->
                        <div id="assignment-order-info" class="bg-gray-50 p-4 rounded-lg">
                            <p class="text-sm text-gray-600">در حال بارگذاری اطلاعات سفارش...</p>
                        </div>
                        
                        <!-- Doctor Selection -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-3">انتخاب عامل:</label>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${doctors.map(doctor => `
                                    <div class="doctor-card border-2 rounded-lg p-4 cursor-pointer transition-all hover:border-purple-400 hover:bg-purple-50"
                                         :class="selectedDoctor === '${doctor.id}' ? 'border-purple-600 bg-purple-50' : 'border-gray-200'"
                                         @click="selectedDoctor = '${doctor.id}'"
                                         onclick="selectDoctor('${doctor.id}')">
                                        <div class="flex items-center">
                                            <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center ml-3">
                                                <i class="fas fa-user-md text-purple-600 text-xl"></i>
                                            </div>
                                            <div class="flex-1">
                                                <p class="font-semibold text-gray-800">${doctor.name}</p>
                                                <p class="text-sm text-gray-500">${doctor.specialization || 'متخصص عمومی'}</p>
                                                <div class="flex items-center mt-1">
                                                    <span class="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                                                        ${doctor.active ? 'فعال' : 'غیرفعال'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div x-show="selectedDoctor === '${doctor.id}'" class="text-purple-600 doctor-check" style="display: none;">
                                                <i class="fas fa-check-circle text-2xl"></i>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Assignment Notes -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">توضیحات تخصیص:</label>
                            <textarea id="assignment-notes" rows="4" 
                                      class="w-full border border-gray-300 rounded-lg px-3 py-2"
                                      placeholder="توضیحات و راهنمایی‌های لازم برای عامل را در اینجا بنویسید..."></textarea>
                        </div>
                        
                        <div class="flex justify-end space-x-3 space-x-reverse pt-4 border-t">
                            <button onclick="closeAssignmentModal()" 
                                    class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                                انصراف
                            </button>
                            <button onclick="submitAssignmentFromModal()" 
                                    id="submit-assignment-btn"
                                    class="px-6 py-2 bg-gray-300 text-white rounded-lg cursor-not-allowed"
                                    disabled>
                                <i class="fas fa-check ml-2"></i>
                                تخصیص سفارش
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML += modalHTML;
        debugLogger('Assignment modal created', 'success');
        
        // Add fallback JavaScript functions for modal interaction
        window.selectDoctor = (doctorId) => {
            try {
                // Remove selection from all cards
                document.querySelectorAll('.doctor-card').forEach(card => {
                    card.classList.remove('border-purple-600', 'bg-purple-50');
                    card.classList.add('border-gray-200');
                    const checkElement = card.querySelector('.doctor-check');
                    if (checkElement) {
                        checkElement.style.display = 'none';
                    }
                });
                
                // Add selection to clicked card
                const selectedCard = document.querySelector(`[onclick="selectDoctor('${doctorId}')"]`);
                if (selectedCard) {
                    selectedCard.classList.remove('border-gray-200');
                    selectedCard.classList.add('border-purple-600', 'bg-purple-50');
                    const checkElement = selectedCard.querySelector('.doctor-check');
                    if (checkElement) {
                        checkElement.style.display = 'block';
                    }
                }
                
                // Enable submit button
                const submitBtn = document.getElementById('submit-assignment-btn');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
                    submitBtn.classList.add('bg-purple-600', 'hover:bg-purple-700');
                }
                
                // Store selected doctor
                window.selectedDoctorId = doctorId;
                
                debugLogger(`Doctor selected: ${doctorId}`, 'success');
                
            } catch (error) {
                debugLogger('Error in selectDoctor function', 'error', error);
            }
        };
        
        window.closeAssignmentModal = () => {
            const modal = document.getElementById('assignment-modal');
            if (modal) {
                modal.style.display = 'none';
            }
            ModalsModule.closeModal();
        };
        
        window.submitAssignmentFromModal = () => {
            try {
                const doctorId = window.selectedDoctorId;
                const notes = document.getElementById('assignment-notes').value || '';
                
                if (!doctorId) {
                    UTILS.showNotification('لطفاً یک عامل انتخاب کنید', 'error');
                    return;
                }
                
                debugLogger('Submitting assignment from modal', 'info', { doctorId, notes });
                AssignmentModule.submit(doctorId, notes);
                
            } catch (error) {
                debugLogger('Error in submitAssignmentFromModal', 'error', error);
                UTILS.showNotification('خطا در ارسال تخصیص', 'error');
            }
        };
    },
    
    // Populate order info in modal
    populateOrderInfo(order) {
        setTimeout(() => {
            const infoDiv = document.getElementById('assignment-order-info');
            if (infoDiv) {
                infoDiv.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="font-semibold text-gray-800">${order.studentName}</h4>
                            <p class="text-sm text-gray-600">${order.type} - ${order.university}</p>
                            <p class="text-sm text-gray-500">${order.field} - ${order.degree}</p>
                        </div>
                        <div class="text-left">
                            <p class="text-lg font-bold text-green-600">${order.totalAmount} تومان</p>
                            <p class="text-sm text-gray-500">مهلت: ${order.deadline}</p>
                        </div>
                    </div>
                `;
            }
        }, 100);
    },
    
    // Show modal dialog
    showModalDialog() {
        try {
            // Primary method: Direct DOM manipulation (most reliable)
            const modal = document.getElementById('assignment-modal');
            if (modal) {
                modal.style.display = 'flex';
                debugLogger('Assignment modal shown via DOM manipulation', 'success');
                return;
            }
            
            // Fallback 1: Try Alpine.js data access
            let alpineData = ModalsModule.getAlpineData();
            if (alpineData) {
                alpineData.showModal = 'assignmentModal';
                debugLogger('Assignment modal shown via Alpine data', 'success');
                return;
            }
            
            // Fallback 2: Try direct Alpine access
            const appElement = document.querySelector('[x-data="appController()"]');
            if (appElement && appElement._x_dataStack && appElement._x_dataStack[0]) {
                appElement._x_dataStack[0].showModal = 'assignmentModal';
                debugLogger('Assignment modal shown via direct Alpine access', 'success');
                return;
            }
            
            // If all else fails, log error
            debugLogger('Could not show assignment modal - all methods failed', 'error');
            UTILS.showNotification('خطا در نمایش modal تخصیص', 'error');
            
        } catch (error) {
            debugLogger('Error in showModalDialog', 'error', error);
            UTILS.showNotification('خطا در نمایش modal تخصیص', 'error');
        }
    },
    
    // Submit assignment
    async submit(doctorId, notes) {
        try {
            if (!doctorId) {
                UTILS.showNotification('لطفاً یک عامل انتخاب کنید', 'error');
                return;
            }
            
            const orderId = window.currentAssignmentOrderId;
            if (!orderId) {
                UTILS.showNotification('شناسه سفارش یافت نشد', 'error');
                return;
            }
            
            debugLogger('Submitting assignment...', 'info', { orderId, doctorId, notes });
            
            // Try API first
            let useAPI = false;
            try {
                if (typeof APIDataModule !== 'undefined') {
                    await APIDataModule.assignOrder(orderId, doctorId);
                    useAPI = true;
                    debugLogger('Assignment completed via API', 'success');
                }
            } catch (apiError) {
                debugLogger('API assignment failed, using localStorage fallback', 'warning', apiError);
                useAPI = false;
            }
            
            // Fallback to localStorage via OrdersModule
            if (!useAPI) {
                if (typeof OrdersModule !== 'undefined' && OrdersModule.assignOrder) {
                    await OrdersModule.assignOrder(orderId, doctorId, notes);
                } else {
                    UTILS.showNotification('ماژول سفارشات در دسترس نیست', 'error');
                    return;
                }
            } else if (typeof OrdersModule !== 'undefined' && OrdersModule.refreshOrders) {
                await OrdersModule.refreshOrders();
            }
            
            UTILS.showNotification('سفارش با موفقیت تخصیص یافت', 'success');
            
            const modal = document.getElementById('assignment-modal');
            if (modal) modal.style.display = 'none';
            if (typeof ModalsModule !== 'undefined') ModalsModule.closeModal();
            
        } catch (error) {
            debugLogger('Error submitting assignment', 'error', error);
            UTILS.showNotification('خطا در تخصیص سفارش', 'error');
        }
    }
};