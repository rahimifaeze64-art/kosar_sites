// Chat Module - سیستم پیام‌رسانی بین عاملها و مدیران
const ChatModule = {
    // Send message
    async sendMessage(orderId) {
        try {
            const messageInput = document.getElementById(`new-message-${orderId}`);
            if (!messageInput) {
                UTILS.showNotification('فیلد پیام یافت نشد', 'error');
                return;
            }
            
            const messageText = messageInput.value.trim();
            if (!messageText) {
                UTILS.showNotification('لطفاً پیام خود را وارد کنید', 'error');
                return;
            }
            
            const currentUser = getCurrentUser();
            if (!currentUser) {
                UTILS.showNotification('کاربر فعلی یافت نشد', 'error');
                return;
            }
            
            debugLogger(`Sending message for order: ${orderId}`, 'info', { messageText, userId: currentUser.id });
            
            // Try API first
            if (window.APIOrdersModule) {
                try {
                    // Get order to find recipient
                    const orders = DataModule.getOrders();
                    const order = orders.find(o => o.id === orderId);
                    
                    if (order) {
                        const messageData = {
                            content: messageText,
                            message_type: 'direct',
                            order: orderId,
                            recipient: order.assignedDoctorId || order.studentId
                        };
                        
                        const result = await APIOrdersModule.sendMessage(messageData);
                        if (result) {
                            UTILS.showNotification('پیام با موفقیت در سیستم ثبت شد', 'success');
                            messageInput.value = '';
                            setTimeout(() => this.refreshChatContent(orderId), 500);
                            debugLogger('Message sent via API', 'success');
                            return;
                        }
                    }
                } catch (apiError) {
                    debugLogger('API message send failed, using localStorage fallback', 'warning', apiError);
                }
            }
            
            // Fallback to localStorage
            const orders = DataModule.getOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            
            if (orderIndex === -1) {
                UTILS.showNotification('سفارش یافت نشد', 'error');
                return;
            }
            
            // Initialize questions array if not exists
            if (!orders[orderIndex].questions) {
                orders[orderIndex].questions = [];
            }
            
            // Create new message
            const newMessage = {
                id: UTILS.generateId(),
                question: messageText,
                askedBy: currentUser.id,
                askedByName: currentUser.name,
                askedAt: new Date().toLocaleString('fa-IR'),
                answer: null,
                answeredBy: null,
                answeredByName: null,
                answeredAt: null
            };
            
            orders[orderIndex].questions.push(newMessage);
            
            // Add to work log
            if (!orders[orderIndex].workLog) orders[orderIndex].workLog = [];
            orders[orderIndex].workLog.push({
                id: UTILS.generateId(),
                type: 'question',
                message: `پیام جدید از ${currentUser.name}`,
                notes: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
                timestamp: new Date().toISOString(),
                userId: currentUser.id
            });
            
            DataModule.saveOrders(orders);
            debugLogger('Message sent via localStorage', 'success');
            
            UTILS.showNotification('پیام در حافظه محلی ذخیره شد', 'success');
            
            // Clear input
            messageInput.value = '';
            
            // Refresh the chat tab content
            setTimeout(() => {
                this.refreshChatContent(orderId);
            }, 500);
            
        } catch (error) {
            debugLogger('Error sending message', 'error', error);
            UTILS.showNotification('خطا در ارسال پیام', 'error');
        }
    },
    
    // Answer message (for managers/employees)
    async answerMessage(orderId, messageId, answerText) {
        try {
            if (!answerText.trim()) {
                UTILS.showNotification('لطفاً پاسخ خود را وارد کنید', 'error');
                return;
            }
            
            const currentUser = getCurrentUser();
            if (!currentUser) {
                UTILS.showNotification('کاربر فعلی یافت نشد', 'error');
                return;
            }
            
            debugLogger(`Answering message: ${messageId} for order: ${orderId}`, 'info');
            
            // Try API first
            let useAPI = false;
            try {
                if (typeof APIDataModule !== 'undefined') {
                    await APIDataModule.answerMessage(messageId, answerText);
                    useAPI = true;
                    debugLogger('Answer sent via API', 'success');
                }
            } catch (apiError) {
                debugLogger('API answer send failed, using localStorage fallback', 'warning', apiError);
                useAPI = false;
            }
            
            // Fallback to localStorage
            if (!useAPI) {
                const orders = DataModule.getOrders();
                const order = orders.find(o => o.id === orderId);
                
                if (!order) {
                    UTILS.showNotification('سفارش یافت نشد', 'error');
                    return;
                }
                
                const message = order.questions?.find(q => q.id === messageId);
                if (!message) {
                    UTILS.showNotification('پیام یافت نشد', 'error');
                    return;
                }
                
                // Update message with answer
                message.answer = answerText;
                message.answeredBy = currentUser.id;
                message.answeredByName = currentUser.name;
                message.answeredAt = new Date().toLocaleString('fa-IR');
                
                // Add to work log
                if (!order.workLog) order.workLog = [];
                order.workLog.push({
                    id: UTILS.generateId(),
                    type: 'answer',
                    message: `پاسخ از ${currentUser.name}`,
                    notes: answerText.substring(0, 100) + (answerText.length > 100 ? '...' : ''),
                    timestamp: new Date().toISOString(),
                    userId: currentUser.id
                });
                
                DataModule.saveOrders(orders);
                debugLogger('Answer sent via localStorage', 'success');
            }
            
            UTILS.showNotification('پاسخ با موفقیت ارسال شد', 'success');
            
            // Refresh the chat content
            setTimeout(() => {
                this.refreshChatContent(orderId);
            }, 500);
            
        } catch (error) {
            debugLogger('Error answering message', 'error', error);
            UTILS.showNotification('خطا در ارسال پاسخ', 'error');
        }
    },
    
    // Refresh chat content
    refreshChatContent(orderId) {
        try {
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) return;
            
            const currentUser = getCurrentUser();
            const messagesContainer = document.getElementById('messages-container');
            
            if (messagesContainer && order.questions) {
                messagesContainer.innerHTML = order.questions.map(msg => 
                    OrderTabsModule.getChatMessage(msg, currentUser)
                ).join('');
                
                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            
        } catch (error) {
            debugLogger('Error refreshing chat content', 'error', error);
        }
    },
    
    // Get unread messages count for a user
    getUnreadMessagesCount(userId) {
        try {
            const orders = DataModule.getOrders();
            let unreadCount = 0;
            
            orders.forEach(order => {
                if (order.questions) {
                    order.questions.forEach(message => {
                        // Count unanswered questions from doctors (for managers)
                        if (message.askedBy !== userId && !message.answer) {
                            unreadCount++;
                        }
                    });
                }
            });
            
            return unreadCount;
        } catch (error) {
            debugLogger('Error getting unread messages count', 'error', error);
            return 0;
        }
    },
    
    // Mark messages as read
    markMessagesAsRead(orderId, userId) {
        try {
            // This would be implemented if we had a read status system
            debugLogger(`Marking messages as read for order: ${orderId}, user: ${userId}`, 'info');
        } catch (error) {
            debugLogger('Error marking messages as read', 'error', error);
        }
    }
};