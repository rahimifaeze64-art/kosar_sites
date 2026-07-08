// API Orders Module - اتصال فرانت به بک‌اند برای سفارشات و وظایف عامل‌ها
const APIOrdersModule = {
    baseURL: 'http://127.0.0.1:8000/api',
    
    // Check if API is enabled
    isAPIEnabled() {
        // Always return false - use localStorage only
        return false;
        // return typeof CONFIG !== 'undefined' && CONFIG.API_ENABLED === true;
    },
    
    // Get CSRF token from cookie
    getCSRFToken() {
        const name = 'csrftoken';
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    },
    
    // Make API request with authentication
    async makeRequest(endpoint, options = {}) {
        // If API is disabled, return null immediately
        if (!this.isAPIEnabled()) {
            console.log('🔴 API integration disabled by config');
            return null;
        }
        
        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCSRFToken(),
            },
            credentials: 'include',
        };
        
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        };
        
        try {
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.warn('API request failed, falling back to localStorage:', error.message);
            return null; // Graceful fallback
        }
    },
    
    // ==================== ORDERS API ====================
    
    // Get all orders (filtered by role on backend)
    async getOrders() {
        try {
            return await this.makeRequest('/orders/');
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            return null;
        }
    },
    
    // Get single order by ID
    async getOrder(orderId) {
        try {
            return await this.makeRequest(`/orders/${orderId}/`);
        } catch (error) {
            console.error('Failed to fetch order:', error);
            return null;
        }
    },
    
    // Create new order
    async createOrder(orderData) {
        try {
            return await this.makeRequest('/orders/', {
                method: 'POST',
                body: JSON.stringify(orderData),
            });
        } catch (error) {
            console.error('Failed to create order:', error);
            throw error;
        }
    },
    
    // Update order
    async updateOrder(orderId, orderData) {
        try {
            return await this.makeRequest(`/orders/${orderId}/`, {
                method: 'PATCH',
                body: JSON.stringify(orderData),
            });
        } catch (error) {
            console.error('Failed to update order:', error);
            throw error;
        }
    },
    
    // Approve order
    async approveOrder(orderId) {
        try {
            return await this.makeRequest(`/orders/${orderId}/approve/`, {
                method: 'POST',
            });
        } catch (error) {
            console.error('Failed to approve order:', error);
            throw error;
        }
    },
    
    // Reject order
    async rejectOrder(orderId, reason) {
        try {
            return await this.makeRequest(`/orders/${orderId}/reject/`, {
                method: 'POST',
                body: JSON.stringify({ reason }),
            });
        } catch (error) {
            console.error('Failed to reject order:', error);
            throw error;
        }
    },
    
    // Assign order to agent
    async assignOrder(orderId, agentId) {
        try {
            return await this.makeRequest(`/orders/${orderId}/assign/`, {
                method: 'POST',
                body: JSON.stringify({ agent_id: agentId }),
            });
        } catch (error) {
            console.error('Failed to assign order:', error);
            throw error;
        }
    },
    
    // ==================== ORDER TASKS API ====================
    
    // Get all tasks (filtered by role on backend)
    async getTasks() {
        try {
            return await this.makeRequest('/order-tasks/');
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
            return null;
        }
    },
    
    // Get tasks for specific order
    async getOrderTasks(orderId) {
        try {
            return await this.makeRequest(`/order-tasks/?order=${orderId}`);
        } catch (error) {
            console.error('Failed to fetch order tasks:', error);
            return null;
        }
    },
    
    // Create new task
    async createTask(taskData) {
        try {
            return await this.makeRequest('/order-tasks/', {
                method: 'POST',
                body: JSON.stringify(taskData),
            });
        } catch (error) {
            console.error('Failed to create task:', error);
            throw error;
        }
    },
    
    // Update task
    async updateTask(taskId, taskData) {
        try {
            return await this.makeRequest(`/order-tasks/${taskId}/`, {
                method: 'PATCH',
                body: JSON.stringify(taskData),
            });
        } catch (error) {
            console.error('Failed to update task:', error);
            throw error;
        }
    },
    
    // Update task status
    async updateTaskStatus(taskId, status) {
        try {
            return await this.makeRequest(`/order-tasks/${taskId}/`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            });
        } catch (error) {
            console.error('Failed to update task status:', error);
            throw error;
        }
    },
    
    // ==================== STUDENT PROFILES API ====================
    
    // Get all student profiles
    async getStudentProfiles() {
        try {
            return await this.makeRequest('/student-profiles/');
        } catch (error) {
            console.error('Failed to fetch student profiles:', error);
            return null;
        }
    },
    
    // Create student profile
    async createStudentProfile(profileData) {
        try {
            return await this.makeRequest('/student-profiles/', {
                method: 'POST',
                body: JSON.stringify(profileData),
            });
        } catch (error) {
            console.error('Failed to create student profile:', error);
            throw error;
        }
    },
    
    // ==================== FILES API ====================
    
    // Upload order file
    async uploadOrderFile(orderId, file, fileType, description = '') {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('order', orderId);
            formData.append('file_type', fileType);
            formData.append('description', description);
            
            return await this.makeRequest('/order-files/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCSRFToken(),
                },
                body: formData,
            });
        } catch (error) {
            console.error('Failed to upload file:', error);
            throw error;
        }
    },
    
    // Get order files
    async getOrderFiles(orderId) {
        try {
            return await this.makeRequest(`/order-files/?order=${orderId}`);
        } catch (error) {
            console.error('Failed to fetch order files:', error);
            return null;
        }
    },
    
    // ==================== NOTIFICATIONS API ====================
    
    // Get notifications
    async getNotifications() {
        try {
            return await this.makeRequest('/notifications/');
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            return null;
        }
    },
    
    // Mark notification as read
    async markNotificationRead(notificationId) {
        try {
            return await this.makeRequest(`/notifications/${notificationId}/mark_read/`, {
                method: 'POST',
            });
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
            throw error;
        }
    },
    
    // ==================== MESSAGES/CHAT API ====================
    
    // Get all messages/conversations
    async getMessages(params = {}) {
        try {
            const queryParams = new URLSearchParams(params).toString();
            const endpoint = queryParams ? `/messages/?${queryParams}` : '/messages/';
            return await this.makeRequest(endpoint);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
            return null;
        }
    },
    
    // Get conversation with specific user
    async getConversationWith(userId) {
        try {
            return await this.makeRequest(`/messages/conversation_with/?user_id=${userId}`);
        } catch (error) {
            console.error('Failed to fetch conversation:', error);
            return null;
        }
    },
    
    // Get list of conversations
    async getConversations() {
        try {
            return await this.makeRequest('/messages/conversations/');
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
            return null;
        }
    },
    
    // Send message
    async sendMessage(messageData) {
        try {
            return await this.makeRequest('/messages/', {
                method: 'POST',
                body: JSON.stringify(messageData),
            });
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    },
    
    // Mark message as read
    async markMessageRead(messageId) {
        try {
            return await this.makeRequest(`/messages/${messageId}/mark_read/`, {
                method: 'POST',
            });
        } catch (error) {
            console.error('Failed to mark message as read:', error);
            throw error;
        }
    },
    
    // Mark all messages as read
    async markAllMessagesRead() {
        try {
            return await this.makeRequest('/messages/mark_all_read/', {
                method: 'POST',
            });
        } catch (error) {
            console.error('Failed to mark all messages as read:', error);
            throw error;
        }
    },
    
    // Get unread messages count
    async getUnreadMessagesCount() {
        try {
            const result = await this.makeRequest('/messages/unread_count/');
            return result ? result.unread_count : 0;
        } catch (error) {
            console.error('Failed to get unread messages count:', error);
            return 0;
        }
    },
    
    // Send group message
    async sendGroupMessage(recipientIds, content, groupName = 'گروه') {
        try {
            return await this.makeRequest('/messages/send_group_message/', {
                method: 'POST',
                body: JSON.stringify({
                    recipient_ids: recipientIds,
                    content: content,
                    group_name: groupName
                }),
            });
        } catch (error) {
            console.error('Failed to send group message:', error);
            throw error;
        }
    },
};

// Export for use in other modules
window.APIOrdersModule = APIOrdersModule;
