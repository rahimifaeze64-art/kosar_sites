/**
 * سیستم به‌روزرسانی بلادرنگ (Real-time Event System)
 * این ماژول تغییرات داده‌ها را به تمام بخش‌های پروژه اطلاع می‌دهد
 */

const RealtimeEvents = {
    // لیست رویدادهای قابل پایش
    EVENTS: {
        // رویدادهای کاربران
        USER_ADDED: 'user:added',
        USER_UPDATED: 'user:updated',
        USER_DELETED: 'user:deleted',
        USERS_CHANGED: 'users:changed',
        
        // رویدادهای دانشجویان
        STUDENT_ADDED: 'student:added',
        STUDENT_UPDATED: 'student:updated',
        STUDENT_DELETED: 'student:deleted',
        STUDENTS_CHANGED: 'students:changed',
        
        // رویدادهای سفارشات
        ORDER_ADDED: 'order:added',
        ORDER_UPDATED: 'order:updated',
        ORDER_DELETED: 'order:deleted',
        ORDERS_CHANGED: 'orders:changed',
        
        // رویدادهای حسابداری
        ACCOUNTING_TRANSACTION_ADDED: 'accounting:transaction:added',
        ACCOUNTING_TRANSACTION_UPDATED: 'accounting:transaction:updated',
        ACCOUNTING_TRANSACTION_DELETED: 'accounting:transaction:deleted',
        ACCOUNTING_CHANGED: 'accounting:changed',
        
        // رویدادهای وظایف
        TASK_ADDED: 'task:added',
        TASK_UPDATED: 'task:updated',
        TASK_DELETED: 'task:deleted',
        TASKS_CHANGED: 'tasks:changed',
        
        // رویدادهای وظایف عامل‌ها
        AGENT_TASK_ADDED: 'agent_task:added',
        AGENT_TASK_UPDATED: 'agent_task:updated',
        AGENT_TASK_DELETED: 'agent_task:deleted',
        AGENT_TASKS_CHANGED: 'agent_tasks:changed',
        
        // رویدادهای وظایف کارمندان
        EMPLOYEE_TASK_ADDED: 'employee_task:added',
        EMPLOYEE_TASK_UPDATED: 'employee_task:updated',
        EMPLOYEE_TASK_DELETED: 'employee_task:deleted',
        EMPLOYEE_TASKS_CHANGED: 'employee_tasks:changed',
        
        // رویدادهای چت
        CHAT_MESSAGE_SENT: 'chat:message:sent',
        CHAT_MESSAGE_READ: 'chat:message:read',
        CHAT_CHANGED: 'chat:changed',
        
        // رویدادهای ساعات کاری
        WORK_HOURS_CHANGED: 'work_hours:changed',
        
        // رویداد کلی برای به‌روزرسانی کل صفحه
        FULL_REFRESH: 'full:refresh'
    },
    
    // نگهداری لیست شنوندگان (listeners)
    _listeners: {},
    _initialized: false,
    
    // مقداردهی اولیه
    init() {
        if (this._initialized) return;
        
        console.log('✅ Real-time Event System initialized');
        this._initialized = true;
        
        // گوش دادن به تغییرات storage از سایر تب‌ها
        window.addEventListener('storage', (e) => {
            this.handleStorageChange(e);
        });
        
        // گوش دادن به رویدادهای سفارشی
        window.addEventListener('dataChanged', (e) => {
            this.handleDataChange(e);
        });
    },
    
    // ثبت یک شنونده جدید برای یک رویداد
    on(eventName, callback, componentId = 'default') {
        if (!this._listeners[eventName]) {
            this._listeners[eventName] = [];
        }
        
        const listenerId = `${componentId}_${Date.now()}`;
        this._listeners[eventName].push({
            id: listenerId,
            callback,
            componentId
        });
        
        if (typeof debugLogger !== 'undefined') {
            debugLogger(`Listener registered for: ${eventName}`, 'info', { listenerId });
        }
        
        return listenerId;
    },
    
    // حذف یک شنونده
    off(eventName, listenerId) {
        if (this._listeners[eventName]) {
            this._listeners[eventName] = this._listeners[eventName].filter(
                l => l.id !== listenerId
            );
        }
    },
    
    // ارسال رویداد به تمام شنوندگان
    emit(eventName, data = {}) {
        if (typeof debugLogger !== 'undefined') {
            debugLogger(`Event emitted: ${eventName}`, 'info', data);
        }
        
        // ارسال به شنوندگان در این صفحه
        if (this._listeners[eventName]) {
            this._listeners[eventName].forEach(listener => {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error(`Error in listener ${listener.id}:`, error);
                }
            });
        }
        
        // ارسال به سایر تب‌ها از طریق localStorage
        this.broadcastToOtherTabs(eventName, data);
    },
    
    // ارسال به سایر تب‌ها
    broadcastToOtherTabs(eventName, data) {
        const message = {
            event: eventName,
            data: data,
            timestamp: Date.now(),
            source: 'realtime-events'
        };
        
        // استفاده از یک کلید موقت برای ارتباط بین تب‌ها
        const tempKey = `__event_broadcast_${Date.now()}`;
        localStorage.setItem(tempKey, JSON.stringify(message));
        localStorage.removeItem(tempKey);
    },
    
    // پردازش تغییرات storage از سایر تب‌ها
    handleStorageChange(event) {
        if (!event.key || !event.key.startsWith('__event_broadcast_')) return;
        
        try {
            const message = JSON.parse(event.newValue);
            if (message && message.event && message.source === 'realtime-events') {
                this.emitLocal(message.event, message.data);
            }
        } catch (error) {
            console.error('Error handling storage change:', error);
        }
    },
    
    // پردازش رویدادهای سفارشی
    handleDataChange(event) {
        if (event.detail) {
            this.emitLocal(event.detail.eventName, event.detail.data);
        }
    },
    
    // ارسال رویداد فقط به شنوندگان محلی
    emitLocal(eventName, data) {
        if (this._listeners[eventName]) {
            this._listeners[eventName].forEach(listener => {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error(`Error in listener ${listener.id}:`, error);
                }
            });
        }
    },
    
    // راه‌اندازی مجدد تمام شنوندگان یک رویداد
    refresh(eventName) {
        this.emit(eventName, { refresh: true });
    },
    
    // راه‌اندازی مجدد تمام بخش‌ها
    refreshAll() {
        Object.values(this.EVENTS).forEach(event => {
            this.emit(event, { refresh: true });
        });
        this.emit(this.EVENTS.FULL_REFRESH, {});
    }
};

// مقداردهی اولیه
if (typeof window !== 'undefined') {
    window.RealtimeEvents = RealtimeEvents;
    RealtimeEvents.init();
}

/**
 * ماژول مدیریت داده‌ها با پشتیبانی از Real-time
 * این ماژول توابع DataModule را بازنویسی می‌کند تا رویدادها را ارسال کنند
 */
const RealtimeDataManager = {
    // کاربران
    saveUser(user) {
        const users = DataModule.getUsers();
        const existingIndex = users.findIndex(u => u.id === user.id);
        
        if (existingIndex >= 0) {
            users[existingIndex] = { ...users[existingIndex], ...user };
            DataModule.saveUsers(users);
            RealtimeEvents.emit(RealtimeEvents.EVENTS.USER_UPDATED, { userId: user.id, user });
        } else {
            users.push(user);
            DataModule.saveUsers(users);
            RealtimeEvents.emit(RealtimeEvents.EVENTS.USER_ADDED, { userId: user.id, user });
        }
        
        RealtimeEvents.emit(RealtimeEvents.EVENTS.USERS_CHANGED, { users });
        return true;
    },
    
    deleteUser(userId) {
        const users = DataModule.getUsers();
        const filteredUsers = users.filter(u => u.id !== userId);
        DataModule.saveUsers(filteredUsers);
        
        RealtimeEvents.emit(RealtimeEvents.EVENTS.USER_DELETED, { userId });
        RealtimeEvents.emit(RealtimeEvents.EVENTS.USERS_CHANGED, { users: filteredUsers });
        return true;
    },
    
    // دانشجویان
    saveStudent(studentId, studentData) {
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        const isNew = !studentsData[studentId];
        
        studentsData[studentId] = {
            ...studentsData[studentId],
            ...studentData,
            updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        if (isNew) {
            RealtimeEvents.emit(RealtimeEvents.EVENTS.STUDENT_ADDED, { studentId, student: studentsData[studentId] });
        } else {
            RealtimeEvents.emit(RealtimeEvents.EVENTS.STUDENT_UPDATED, { studentId, student: studentsData[studentId] });
        }
        
        RealtimeEvents.emit(RealtimeEvents.EVENTS.STUDENTS_CHANGED, { students: studentsData });
        return true;
    },
    
    deleteStudent(studentId) {
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        delete studentsData[studentId];
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        RealtimeEvents.emit(RealtimeEvents.EVENTS.STUDENT_DELETED, { studentId });
        RealtimeEvents.emit(RealtimeEvents.EVENTS.STUDENTS_CHANGED, { students: studentsData });
        return true;
    },
    
    // سفارشات
    saveOrder(order) {
        const orders = DataModule.getOrders();
        const existingIndex = orders.findIndex(o => o.id === order.id);
        
        if (existingIndex >= 0) {
            orders[existingIndex] = { ...orders[existingIndex], ...order };
            DataModule.saveOrders(orders);
            RealtimeEvents.emit(RealtimeEvents.EVENTS.ORDER_UPDATED, { orderId: order.id, order });
        } else {
            orders.push(order);
            DataModule.saveOrders(orders);
            RealtimeEvents.emit(RealtimeEvents.EVENTS.ORDER_ADDED, { orderId: order.id, order });
        }
        
        RealtimeEvents.emit(RealtimeEvents.EVENTS.ORDERS_CHANGED, { orders });
        return true;
    },
    
    deleteOrder(orderId) {
        const orders = DataModule.getOrders();
        const filteredOrders = orders.filter(o => o.id !== orderId);
        DataModule.saveOrders(filteredOrders);
        
        RealtimeEvents.emit(RealtimeEvents.EVENTS.ORDER_DELETED, { orderId });
        RealtimeEvents.emit(RealtimeEvents.EVENTS.ORDERS_CHANGED, { orders: filteredOrders });
        return true;
    },
    
    // وظایف عامل‌ها
    saveAgentTask(task) {
        const agentTasksKey = 'agent_tasks';
        let allTasks = JSON.parse(localStorage.getItem(agentTasksKey) || '[]');
        const existingIndex = allTasks.findIndex(t => t.id === task.id);
        
        if (existingIndex >= 0) {
            allTasks[existingIndex] = { ...allTasks[existingIndex], ...task };
        } else {
            allTasks.push(task);
        }
        
        localStorage.setItem(agentTasksKey, JSON.stringify(allTasks));
        
        RealtimeEvents.emit(RealtimeEvents.EVENTS.AGENT_TASK_UPDATED, { taskId: task.id, task });
        RealtimeEvents.emit(RealtimeEvents.EVENTS.AGENT_TASKS_CHANGED, { tasks: allTasks });
        return true;
    },
    
    deleteAgentTask(taskId) {
        const agentTasksKey = 'agent_tasks';
        let allTasks = JSON.parse(localStorage.getItem(agentTasksKey) || '[]');
        allTasks = allTasks.filter(t => t.id !== taskId);
        localStorage.setItem(agentTasksKey, JSON.stringify(allTasks));
        
        RealtimeEvents.emit(RealtimeEvents.EVENTS.AGENT_TASK_DELETED, { taskId });
        RealtimeEvents.emit(RealtimeEvents.EVENTS.AGENT_TASKS_CHANGED, { tasks: allTasks });
        return true;
    },
    
    // وظایف کارمندان
    saveEmployeeTask(userId, task) {
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        if (!tasksData[userId]) tasksData[userId] = [];
        
        const existingIndex = tasksData[userId].findIndex(t => t.id === task.id);
        if (existingIndex >= 0) {
            tasksData[userId][existingIndex] = task;
        } else {
            tasksData[userId].push(task);
        }
        
        localStorage.setItem('employee_tasks', JSON.stringify(tasksData));
        
        RealtimeEvents.emit(RealtimeEvents.EVENTS.EMPLOYEE_TASK_UPDATED, { userId, taskId: task.id, task });
        RealtimeEvents.emit(RealtimeEvents.EVENTS.EMPLOYEE_TASKS_CHANGED, { tasks: tasksData });
        return true;
    },
    
    // حسابداری
    saveTransaction(transaction) {
        const transactionsKey = 'accounting_transactions';
        let transactions = JSON.parse(localStorage.getItem(transactionsKey) || '[]');
        const existingIndex = transactions.findIndex(t => t.id === transaction.id);
        
        if (existingIndex >= 0) {
            transactions[existingIndex] = transaction;
        } else {
            transactions.push(transaction);
        }
        
        localStorage.setItem(transactionsKey, JSON.stringify(transactions));
        
        RealtimeEvents.emit(RealtimeEvents.EVENTS.ACCOUNTING_TRANSACTION_ADDED, { transaction });
        RealtimeEvents.emit(RealtimeEvents.EVENTS.ACCOUNTING_CHANGED, { transactions });
        return true;
    }
};

// اضافه کردن به window
if (typeof window !== 'undefined') {
    window.RealtimeDataManager = RealtimeDataManager;
}

console.log('✅ Real-time Event System loaded');
