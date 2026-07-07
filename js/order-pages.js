// Order Pages Module - مدیریت صفحات جزئیات سفارش
const OrderPagesModule = {
    // Show order detail page
    showOrderPage(orderId) {
        try {
            debugLogger(`Opening order page for: ${orderId}`, 'info');
            
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) {
                UTILS.showNotification('سفارش یافت نشد', 'error');
                return;
            }
            
            // Store current order ID
            window.currentDetailOrderId = orderId;
            
            // Create and show order page modal
            this.createOrderPageModal();
            this.loadOrderPage(order);
            this.showOrderPageModal();
            
        } catch (error) {
            debugLogger('Error opening order page', 'error', error);
            UTILS.showNotification('خطا در باز کردن صفحه سفارش', 'error');
        }
    },
    
    // Create order page modal
    createOrderPageModal() {
        const container = document.getElementById('modals-container');
        if (!container) {
            debugLogger('Modals container not found', 'error');
            return;
        }
        
        // Check if modal already exists
        const existingModal = container.querySelector('#order-page-modal');
        if (existingModal) {
            return;
        }
        
        const modalHTML = `
            <div id="order-page-modal" x-show="showModal === 'orderDetail'" 
                 class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" 
                 @click.self="showModal = null">
                <div class="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden">
                    <div class="p-6 border-b">
                        <h3 class="text-lg font-bold text-gray-800">
                            <i class="fas fa-clipboard-list text-blue-600 ml-2"></i>
                            جزئیات سفارش
                        </h3>
                    </div>
                    <div class="flex h-[80vh]" x-data="{ activeTab: 'overview', currentUser: getCurrentUser() }">
                        <!-- Sidebar Tabs -->
                        <div class="w-64 bg-gray-50 border-l">
                            <nav class="p-4 space-y-2">
                                <button @click="activeTab = 'overview'; loadTabContent(activeTab)" 
                                        :class="activeTab === 'overview' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'"
                                        class="w-full text-right px-4 py-3 rounded-lg font-medium transition-colors">
                                    <i class="fas fa-info-circle ml-2"></i>
                                    مشخصات کلی
                                </button>
                                <button @click="activeTab = 'worklist'; loadTabContent(activeTab)" 
                                        :class="activeTab === 'worklist' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'"
                                        class="w-full text-right px-4 py-3 rounded-lg font-medium transition-colors">
                                    <i class="fas fa-tasks ml-2"></i>
                                    لیست کارها
                                </button>
                                <!-- مدیریت تخصیص - فقط برای مدیر و کارمند -->
                                <template x-if="currentUser.role === 'manager' || currentUser.role === 'employee'">
                                    <button @click="activeTab = 'assignment'; loadTabContent(activeTab)" 
                                            :class="activeTab === 'assignment' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'"
                                            class="w-full text-right px-4 py-3 rounded-lg font-medium transition-colors">
                                        <i class="fas fa-user-cog ml-2"></i>
                                        مدیریت تخصیص
                                    </button>
                                </template>
                                <button @click="activeTab = 'followup'; loadTabContent(activeTab)" 
                                        :class="activeTab === 'followup' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'"
                                        class="w-full text-right px-4 py-3 rounded-lg font-medium transition-colors">
                                    <i class="fas fa-clipboard-check ml-2"></i>
                                    پیگیری
                                </button>
                                <button @click="activeTab = 'financial'; loadTabContent(activeTab)" 
                                        :class="activeTab === 'financial' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'"
                                        class="w-full text-right px-4 py-3 rounded-lg font-medium transition-colors">
                                    <i class="fas fa-dollar-sign ml-2"></i>
                                    مالی
                                </button>
                                <!-- پیشرفت کار - فقط برای مدیر و کارمند -->
                                <template x-if="currentUser.role === 'manager' || currentUser.role === 'employee'">
                                    <button @click="activeTab = 'progress'; loadTabContent(activeTab)" 
                                            :class="activeTab === 'progress' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'"
                                            class="w-full text-right px-4 py-3 rounded-lg font-medium transition-colors">
                                        <i class="fas fa-chart-line ml-2"></i>
                                        پیشرفت کار
                                    </button>
                                </template>
                                <!-- تاریخچه - فقط برای مدیر و کارمند -->
                                <template x-if="currentUser.role === 'manager' || currentUser.role === 'employee'">
                                    <button @click="activeTab = 'history'; loadTabContent(activeTab)" 
                                            :class="activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'"
                                            class="w-full text-right px-4 py-3 rounded-lg font-medium transition-colors">
                                        <i class="fas fa-history ml-2"></i>
                                        تاریخچه
                                    </button>
                                </template>
                            </nav>
                        </div>
                        
                        <!-- Content Area -->
                        <div class="flex-1 p-6 overflow-y-auto">
                            <div id="order-page-content">
                                <div class="text-center py-8">
                                    <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
                                    <p class="text-gray-500">در حال بارگذاری...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML += modalHTML;
        debugLogger('Order page modal created', 'success');
    },
    
    // Load order page content
    loadOrderPage(order) {
        // Store order data globally for tab switching
        window.currentOrderData = order;
        
        // Set up tab content loader
        window.loadTabContent = (tab) => {
            this.loadTabContent(tab, order);
        };
        
        // Load initial tab (overview)
        setTimeout(() => {
            this.loadTabContent('overview', order);
        }, 100);
    },
    
    // Load specific tab content
    loadTabContent(tab, order) {
        const contentArea = document.getElementById('order-page-content');
        if (!contentArea) return;
        
        const currentUser = getCurrentUser();
        
        switch(tab) {
            case 'overview':
                contentArea.innerHTML = OrderTabsModule.getOverviewTab(order, currentUser);
                break;
            case 'worklist':
                contentArea.innerHTML = OrderTabsModule.getWorkListTab(order, currentUser);
                break;
            case 'assignment':
                contentArea.innerHTML = AssignmentManagerModule.getAssignmentTab(order, currentUser);
                break;
            case 'followup':
                contentArea.innerHTML = OrderTabsModule.getFollowUpTab(order, currentUser);
                break;
            case 'files':
                contentArea.innerHTML = OrderTabsModule.getFilesTab(order, currentUser);
                break;
            case 'chat':
                contentArea.innerHTML = OrderTabsModule.getChatTab(order, currentUser);
                break;
            case 'financial':
                contentArea.innerHTML = OrderTabsModule.getFinancialTab(order, currentUser);
                break;
            case 'progress':
                contentArea.innerHTML = OrderTabsModule.getProgressTab(order, currentUser);
                
                // راه‌اندازی سیستم پیشرفت کار
                setTimeout(() => {
                    if (typeof ThesisWorkflow !== 'undefined') {
                        // پاک کردن نمونه قبلی
                        if (window.currentThesisWorkflow) {
                            window.currentThesisWorkflow = null;
                        }
                        // ایجاد نمونه جدید
                        window.currentThesisWorkflow = new ThesisWorkflow();
                    } else {
                        console.error('ThesisWorkflow class not found');
                    }
                }, 100);
                break;
            case 'history':
                contentArea.innerHTML = OrderTabsModule.getHistoryTab(order, currentUser);
                break;
            default:
                contentArea.innerHTML = '<p class="text-center text-gray-500">تب انتخاب شده یافت نشد</p>';
        }
        
        debugLogger(`Loaded tab: ${tab}`, 'info');
    },
    
    // Show order page modal
    showOrderPageModal() {
        const alpineData = ModalsModule.getAlpineData();
        if (alpineData) {
            alpineData.showModal = 'orderDetail';
            debugLogger('Order page modal shown', 'success');
        } else {
            debugLogger('Could not show order page modal - Alpine data not found', 'error');
            UTILS.showNotification('خطا در نمایش صفحه سفارش', 'error');
        }
    }
};