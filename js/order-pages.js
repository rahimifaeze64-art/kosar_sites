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
            
            window.currentDetailOrderId = orderId;
            window.currentOrderData = order;
            
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
                 @click.self="showModal = null" style="display:none;"
                 onclick="if(event.target===this){this.style.display='none';if(typeof ModalsModule!=='undefined')ModalsModule.closeModal();}">
                <div class="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden">
                    <div class="p-6 border-b flex justify-between items-center">
                        <h3 class="text-lg font-bold text-gray-800">
                            <i class="fas fa-clipboard-list text-blue-600 ml-2"></i>
                            جزئیات سفارش
                        </h3>
                        <button type="button" onclick="document.getElementById('order-page-modal').style.display='none';if(typeof ModalsModule!=='undefined')ModalsModule.closeModal();"
                                class="text-gray-500 hover:text-gray-700 text-xl leading-none" title="بستن">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="flex h-[80vh]" x-data="{ activeTab: 'overview', currentUser: getCurrentUser() }">
                        <!-- Sidebar Tabs -->
                        <div class="w-64 bg-gray-50 border-l">
                            <nav class="p-4 space-y-2">
                                <button @click="activeTab = 'overview'; window.loadTabContent(activeTab)" 
                                        :class="activeTab === 'overview' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'"
                                        class="w-full text-right px-4 py-3 rounded-lg font-medium transition-colors">
                                    <i class="fas fa-info-circle ml-2"></i>
                                    مشخصات کلی
                                </button>
                                <button @click="activeTab = 'financial'; window.loadTabContent(activeTab)" 
                                        :class="activeTab === 'financial' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'"
                                        class="w-full text-right px-4 py-3 rounded-lg font-medium transition-colors">
                                    <i class="fas fa-dollar-sign ml-2"></i>
                                    مالی
                                </button>
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
        
        // Set up tab content loader - define BEFORE modal shows
        window.loadTabContent = (tab) => {
            this.loadTabContent(tab, window.currentOrderData || order);
        };
        
        // Load initial tab (overview) with retry
        const tryLoad = (attempts) => {
            const contentArea = document.getElementById('order-page-content');
            if (contentArea) {
                this.loadTabContent('overview', order);
            } else if (attempts > 0) {
                setTimeout(() => tryLoad(attempts - 1), 100);
            }
        };
        setTimeout(() => tryLoad(10), 50);
    },
    
    // Load specific tab content
    loadTabContent(tab, order) {
        const contentArea = document.getElementById('order-page-content');
        if (!contentArea) return;

        const fresh = DataModule.getOrders().find(o => o.id === order.id);
        const activeOrder = fresh || order;
        window.currentOrderData = activeOrder;
        
        const currentUser = getCurrentUser();
        
        switch(tab) {
            case 'overview':
                contentArea.innerHTML = OrderTabsModule.getOverviewTab(activeOrder, currentUser);
                break;
            case 'assignment':
                contentArea.innerHTML = AssignmentManagerModule.getAssignmentTab(activeOrder, currentUser);
                break;
            case 'financial':
                contentArea.innerHTML = OrderTabsModule.getFinancialTab(activeOrder, currentUser);
                break;
            default:
                contentArea.innerHTML = '<p class="text-center text-gray-500">تب انتخاب شده یافت نشد</p>';
        }
        
        debugLogger(`Loaded tab: ${tab}`, 'info');
    },
    
    // Show order page modal
    showOrderPageModal() {
        const modal = document.getElementById('order-page-modal');
        if (modal) {
            modal.style.display = 'flex';
            debugLogger('Order page modal shown via DOM', 'success');
            return;
        }

        const alpineData = typeof ModalsModule !== 'undefined' ? ModalsModule.getAlpineData() : null;
        if (alpineData) {
            alpineData.showModal = 'orderDetail';
            debugLogger('Order page modal shown via Alpine', 'success');
            return;
        }

        debugLogger('Could not show order page modal', 'error');
        UTILS.showNotification('خطا در نمایش صفحه سفارش', 'error');
    }
};
