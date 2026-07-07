// Progress Module - مدیریت پیشرفت و به‌روزرسانی وضعیت پروژه‌ها
const ProgressModule = {
    // Update progress
    async updateProgress(orderId, progressValue) {
        try {
            const progress = parseInt(progressValue);
            if (isNaN(progress) || progress < 0 || progress > 100) {
                UTILS.showNotification('مقدار پیشرفت باید بین 0 تا 100 باشد', 'error');
                return;
            }
            
            const currentUser = getCurrentUser();
            if (!currentUser) {
                UTILS.showNotification('کاربر فعلی یافت نشد', 'error');
                return;
            }
            
            debugLogger(`Updating progress for order: ${orderId} to ${progress}%`, 'info');
            
            // Try API first
            let useAPI = false;
            try {
                if (typeof APIDataModule !== 'undefined') {
                    await APIDataModule.updateOrderProgress(orderId, progress);
                    useAPI = true;
                    debugLogger('Progress updated via API', 'success');
                }
            } catch (apiError) {
                debugLogger('API progress update failed, using localStorage fallback', 'warning', apiError);
                useAPI = false;
            }
            
            // Fallback to localStorage
            if (!useAPI) {
                const orders = DataModule.getOrders();
                const orderIndex = orders.findIndex(o => o.id === orderId);
                
                if (orderIndex === -1) {
                    UTILS.showNotification('سفارش یافت نشد', 'error');
                    return;
                }
                
                const oldProgress = orders[orderIndex].progress || 0;
                orders[orderIndex].progress = progress;
                orders[orderIndex].lastProgressUpdate = new Date().toISOString();
                
                // Update status based on progress
                if (progress === 0) {
                    orders[orderIndex].stage = 'شروع نشده';
                } else if (progress < 25) {
                    orders[orderIndex].stage = 'در حال شروع';
                } else if (progress < 50) {
                    orders[orderIndex].stage = 'در حال انجام';
                } else if (progress < 75) {
                    orders[orderIndex].stage = 'نیمه تکمیل';
                } else if (progress < 100) {
                    orders[orderIndex].stage = 'در حال تکمیل';
                } else {
                    orders[orderIndex].stage = 'تکمیل شده';
                    orders[orderIndex].status = CONFIG.ORDER_STATUS.COMPLETED;
                    orders[orderIndex].completedAt = new Date().toISOString();
                }
                
                // Add to work log
                if (!orders[orderIndex].workLog) orders[orderIndex].workLog = [];
                orders[orderIndex].workLog.push({
                    id: UTILS.generateId(),
                    type: 'progress',
                    message: `پیشرفت به‌روزرسانی شد: ${oldProgress}% → ${progress}%`,
                    notes: `توسط ${currentUser.name}`,
                    timestamp: new Date().toISOString(),
                    userId: currentUser.id
                });
                
                DataModule.saveOrders(orders);
                debugLogger('Progress updated via localStorage', 'success');
            }
            
            UTILS.showNotification(`پیشرفت به ${progress}% به‌روزرسانی شد`, 'success');
            
            // Refresh the progress content
            setTimeout(() => {
                this.refreshProgressContent(orderId);
            }, 500);
            
            // Check for completion
            if (progress === 100) {
                this.handleProjectCompletion(orderId);
            }
            
        } catch (error) {
            debugLogger('Error updating progress', 'error', error);
            UTILS.showNotification('خطا در به‌روزرسانی پیشرفت', 'error');
        }
    },
    
    // Handle project completion
    async handleProjectCompletion(orderId) {
        try {
            debugLogger(`Handling project completion for order: ${orderId}`, 'info');
            
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) return;
            
            // Show completion notification
            UTILS.showNotification('🎉 پروژه با موفقیت تکمیل شد!', 'success', 5000);
            
            // Add completion log
            if (!order.workLog) order.workLog = [];
            order.workLog.push({
                id: UTILS.generateId(),
                type: 'completion',
                message: 'پروژه تکمیل شد',
                notes: 'پروژه با موفقیت به پایان رسید',
                timestamp: new Date().toISOString(),
                userId: getCurrentUserId()
            });
            
            // Update order status
            order.status = CONFIG.ORDER_STATUS.COMPLETED;
            order.completedAt = new Date().toISOString();
            
            DataModule.saveOrders(orders);
            
            // Optionally show completion modal or redirect
            setTimeout(() => {
                this.showCompletionModal(order);
            }, 1000);
            
        } catch (error) {
            debugLogger('Error handling project completion', 'error', error);
        }
    },
    
    // Show completion modal
    showCompletionModal(order) {
        try {
            const modalHTML = `
                <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div class="bg-white rounded-lg max-w-md w-full p-6 text-center">
                        <div class="mb-4">
                            <i class="fas fa-check-circle text-6xl text-green-500"></i>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">پروژه تکمیل شد!</h3>
                        <p class="text-gray-600 mb-4">
                            پروژه ${order.studentName} با موفقیت به پایان رسید.
                        </p>
                        <div class="space-y-2 text-sm text-gray-500 mb-6">
                            <p><strong>نوع پروژه:</strong> ${order.type}</p>
                            <p><strong>مبلغ:</strong> ${order.totalAmount} تومان</p>
                            <p><strong>تاریخ تکمیل:</strong> ${new Date().toLocaleDateString('fa-IR')}</p>
                        </div>
                        <div class="flex space-x-3 space-x-reverse">
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
                                بستن
                            </button>
                            <button onclick="generateCompletionReport('${order.id}')" 
                                    class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                                گزارش تکمیل
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
        } catch (error) {
            debugLogger('Error showing completion modal', 'error', error);
        }
    },
    
    // Generate completion report
    generateCompletionReport(orderId) {
        try {
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) {
                UTILS.showNotification('سفارش یافت نشد', 'error');
                return;
            }
            
            const report = {
                orderId: order.id,
                studentName: order.studentName,
                type: order.type,
                university: order.university,
                field: order.field,
                degree: order.degree,
                assignedDoctor: order.assignedDoctor,
                totalAmount: order.totalAmount,
                startDate: order.createdAt,
                completionDate: order.completedAt,
                filesCount: order.files?.length || 0,
                messagesCount: order.questions?.length || 0,
                workLog: order.workLog || []
            };
            
            // Download as JSON
            const dataStr = JSON.stringify(report, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `completion-report-${order.id}-${new Date().toISOString().slice(0,10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
            
            UTILS.showNotification('گزارش تکمیل دانلود شد', 'success');
            
        } catch (error) {
            debugLogger('Error generating completion report', 'error', error);
            UTILS.showNotification('خطا در تولید گزارش', 'error');
        }
    },
    
    // Refresh progress content
    refreshProgressContent(orderId) {
        try {
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) return;
            
            const currentUser = getCurrentUser();
            const contentArea = document.getElementById('order-page-content');
            
            if (contentArea) {
                // Reload the progress tab
                contentArea.innerHTML = OrderTabsModule.getProgressTab(order, currentUser);
            }
            
            // Also update any progress bars in other parts of the UI
            this.updateProgressBars(orderId, order.progress);
            
        } catch (error) {
            debugLogger('Error refreshing progress content', 'error', error);
        }
    },
    
    // Update progress bars throughout the UI
    updateProgressBars(orderId, progress) {
        try {
            // Update progress bars in order lists
            const progressBars = document.querySelectorAll(`[data-order-id="${orderId}"] .progress-bar`);
            progressBars.forEach(bar => {
                bar.style.width = `${progress}%`;
                const progressText = bar.parentElement.querySelector('.progress-text');
                if (progressText) {
                    progressText.textContent = `${progress}%`;
                }
            });
            
            // Update progress in dashboard if visible
            if (typeof DashboardModule !== 'undefined' && DashboardModule.updateOrderProgress) {
                DashboardModule.updateOrderProgress(orderId, progress);
            }
            
        } catch (error) {
            debugLogger('Error updating progress bars', 'error', error);
        }
    },
    
    // Get progress statistics
    getProgressStatistics() {
        try {
            const orders = DataModule.getOrders();
            const stats = {
                total: orders.length,
                notStarted: 0,
                inProgress: 0,
                completed: 0,
                averageProgress: 0
            };
            
            let totalProgress = 0;
            
            orders.forEach(order => {
                const progress = order.progress || 0;
                totalProgress += progress;
                
                if (progress === 0) {
                    stats.notStarted++;
                } else if (progress === 100) {
                    stats.completed++;
                } else {
                    stats.inProgress++;
                }
            });
            
            stats.averageProgress = orders.length > 0 ? Math.round(totalProgress / orders.length) : 0;
            
            return stats;
            
        } catch (error) {
            debugLogger('Error getting progress statistics', 'error', error);
            return {
                total: 0,
                notStarted: 0,
                inProgress: 0,
                completed: 0,
                averageProgress: 0
            };
        }
    },
    
    // Set milestone
    async setMilestone(orderId, milestone, isCompleted) {
        try {
            debugLogger(`Setting milestone for order: ${orderId}`, 'info', { milestone, isCompleted });
            
            const currentUser = getCurrentUser();
            if (!currentUser) {
                UTILS.showNotification('کاربر فعلی یافت نشد', 'error');
                return;
            }
            
            const orders = DataModule.getOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            
            if (orderIndex === -1) {
                UTILS.showNotification('سفارش یافت نشد', 'error');
                return;
            }
            
            // Initialize milestones if not exists
            if (!orders[orderIndex].milestones) {
                orders[orderIndex].milestones = {};
            }
            
            orders[orderIndex].milestones[milestone] = {
                completed: isCompleted,
                completedAt: isCompleted ? new Date().toISOString() : null,
                completedBy: isCompleted ? currentUser.id : null
            };
            
            // Add to work log
            if (!orders[orderIndex].workLog) orders[orderIndex].workLog = [];
            orders[orderIndex].workLog.push({
                id: UTILS.generateId(),
                type: 'milestone',
                message: `مرحله ${milestone} ${isCompleted ? 'تکمیل شد' : 'لغو شد'}`,
                notes: `توسط ${currentUser.name}`,
                timestamp: new Date().toISOString(),
                userId: currentUser.id
            });
            
            DataModule.saveOrders(orders);
            
            UTILS.showNotification(
                `مرحله ${milestone} ${isCompleted ? 'تکمیل شد' : 'لغو شد'}`, 
                'success'
            );
            
        } catch (error) {
            debugLogger('Error setting milestone', 'error', error);
            UTILS.showNotification('خطا در تنظیم مرحله', 'error');
        }
    }
};