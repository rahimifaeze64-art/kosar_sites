// Agent Module - ماژول عامل
const AgentModule = {
    timers: {}, // Store timer intervals
    
    // Get tasks synchronously from localStorage
    getTasksSync(userId) {
        try {
            const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
            const result = tasksData[userId];
            return Array.isArray(result) ? result : [];
        } catch (e) {
            return [];
        }
    },
    
    // Get my tasks content for agent
    getMyTasksContent(userId) {
        const tasks = this.getTasksSync(userId);
        
        return `
            <div class="space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-white">
                        <i class="fas fa-clipboard-check text-blue-400 ml-2"></i>
                        وظایف من
                    </h2>
                </div>
                
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">کل وظایف</p>
                                <p class="text-2xl font-bold text-white">${tasks.length}</p>
                            </div>
                            <i class="fas fa-tasks text-3xl text-blue-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">در انتظار</p>
                                <p class="text-2xl font-bold text-yellow-400">${tasks.filter(t => t.status === 'pending').length}</p>
                            </div>
                            <i class="fas fa-clock text-3xl text-yellow-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">در حال انجام</p>
                                <p class="text-2xl font-bold text-blue-400">${tasks.filter(t => t.status === 'in_progress').length}</p>
                            </div>
                            <i class="fas fa-spinner text-3xl text-blue-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">تکمیل شده</p>
                                <p class="text-2xl font-bold text-green-400">${tasks.filter(t => t.status === 'completed').length}</p>
                            </div>
                            <i class="fas fa-check-circle text-3xl text-green-400"></i>
                        </div>
                    </div>
                </div>
                
                <!-- Tasks Grid -->
                <div class="bg-slate-800 rounded-lg shadow-md p-4">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-list text-blue-400 ml-2"></i>
                        لیست وظایف تخصیص داده شده
                    </h3>
                    
                    ${tasks.length === 0 ? `
                        <div class="text-center py-8">
                            <i class="fas fa-clipboard-check text-4xl text-gray-500 mb-4"></i>
                            <p class="text-gray-400">هنوز وظیفه‌ای برای شما تعریف نشده است</p>
                        </div>
                    ` : `
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${tasks.map((task, index) => this.getTaskCard(task, userId, index + 1)).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    },
    
    // Get my tasks
    async getMyTasks(agentId) {
        // Try to fetch from backend first
        if (window.APIOrdersModule) {
            try {
                const backendTasks = await APIOrdersModule.getTasks();
                if (backendTasks && Array.isArray(backendTasks)) {
                    // Convert backend format to frontend format
                    const tasks = backendTasks.map(task => this.convertBackendTask(task));
                    // Save to localStorage as cache
                    const agentTasksKey = 'agent_tasks';
                    localStorage.setItem(agentTasksKey, JSON.stringify(tasks));
                    console.log('Agent tasks loaded from backend:', tasks.length, 'tasks');
                    return tasks.filter(t => t.agentId === agentId);
                }
            } catch (error) {
                console.warn('Backend not available, using localStorage:', error);
            }
        }
        
        // Fallback to localStorage - استفاده از employee_tasks
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        const myTasks = tasksData[agentId] || [];
        
        console.log('Agent tasks loaded from localStorage:', myTasks.length, 'tasks for agent:', agentId);
        return myTasks;
    },
    
    // Convert backend task format to frontend format
    convertBackendTask(backendTask) {
        return {
            id: backendTask.id,
            orderId: backendTask.order,
            agentId: backendTask.assigned_user,
            title: backendTask.title,
            description: backendTask.description || '',
            status: backendTask.status,
            assignedTo: backendTask.assigned_to,
            deadline: backendTask.due_date,
            priority: backendTask.priority || 'normal',
            studentName: backendTask.student_name || 'نامشخص',
            attachedFile: backendTask.attached_file || null,
            createdAt: backendTask.created_at,
            updatedAt: backendTask.updated_at,
            completedAt: backendTask.completed_at,
        };
    },
    
    // Get task card
    getTaskCard(task, userId, taskNumber) {
        const statusColors = {
            'pending': 'bg-yellow-500',
            'in_progress': 'bg-blue-500',
            'completed': 'bg-green-500'
        };
        const statusTexts = {
            'pending': 'در انتظار',
            'in_progress': 'در حال انجام',
            'completed': 'تکمیل شده'
        };
        
        const priorityBadge = task.priority === 'high' ? 
            '<span class="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full font-bold">فوری</span>' : '';
        
        const attachedFileHTML = task.attachedFile ? `
            <div class="mt-3 bg-slate-600 rounded-lg p-2">
                <div class="flex items-center space-x-2 space-x-reverse">
                    <i class="fas fa-paperclip text-blue-400"></i>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs text-white truncate">${task.attachedFile.name}</p>
                    </div>
                    <button onclick="AgentModule.downloadTaskFile('${task.id}')" 
                            class="text-indigo-400 hover:text-indigo-300 p-1" title="دانلود">
                        <i class="fas fa-download text-sm"></i>
                    </button>
                </div>
            </div>
        ` : '';
        
        // Calculate time remaining
        const timeRemaining = this.calculateTimeRemaining(task.deadline);
        
        return `
            <div class="bg-slate-700 rounded-lg p-4 hover:shadow-xl transition-all relative">
                ${priorityBadge}
                
                <!-- Task Header -->
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center">
                        <span class="bg-blue-600 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center ml-2">${taskNumber}</span>
                        <span class="w-3 h-3 rounded-full ${statusColors[task.status] || 'bg-gray-500'}"></span>
                    </div>
                    <span class="text-xs px-2 py-1 rounded ${statusColors[task.status]} text-white">
                        ${statusTexts[task.status] || task.status}
                    </span>
                </div>
                
                <!-- Task Title -->
                <h5 class="font-bold text-white mb-2 text-lg">${task.title}</h5>
                
                <!-- Task Description -->
                <p class="text-sm text-gray-400 mb-3 line-clamp-2">${task.description || ''}</p>
                
                <!-- Student Info -->
                <div class="flex items-center text-xs text-gray-400 mb-3 pb-3 border-b border-slate-600">
                    <i class="fas fa-user-graduate text-indigo-400 ml-1"></i>
                    <span>${task.studentName}</span>
                </div>
                
                <!-- Countdown Timer -->
                <div class="mb-3">
                    <p class="text-xs text-gray-400 mb-2">
                        <i class="fas fa-hourglass-half ml-1"></i>
                        زمان باقی‌مانده:
                    </p>
                    <div class="grid grid-cols-2 gap-2" id="timer-${task.id}">
                        <div class="bg-slate-600 rounded-lg p-2 text-center">
                            <div class="text-2xl font-bold text-white" data-days>${timeRemaining.days}</div>
                            <div class="text-xs text-gray-400">روز</div>
                        </div>
                        <div class="bg-slate-600 rounded-lg p-2 text-center">
                            <div class="text-2xl font-bold text-white" data-hours>${timeRemaining.hours}</div>
                            <div class="text-xs text-gray-400">ساعت</div>
                        </div>
                    </div>
                    ${timeRemaining.isOverdue ? `
                        <div class="mt-2 text-xs text-red-400 text-center">
                            <i class="fas fa-exclamation-triangle ml-1"></i>
                            مهلت گذشته است!
                        </div>
                    ` : ''}
                </div>
                
                <!-- Deadline -->
                <div class="text-xs text-gray-500 mb-3">
                    <i class="fas fa-calendar-alt ml-1"></i>
                    مهلت: ${task.deadline || 'نامشخص'}
                </div>
                
                ${attachedFileHTML}
                
                <!-- Actions -->
                <div class="mt-4 flex space-x-2 space-x-reverse">
                    ${task.status === 'pending' ? `
                        <button onclick="AgentModule.updateTaskStatus('${task.id}', '${userId}', event)" 
                                class="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all">
                            <i class="fas fa-play ml-1"></i>
                            شروع کار
                        </button>
                    ` : task.status === 'in_progress' ? `
                        <button onclick="AgentModule.updateTaskStatus('${task.id}', '${userId}', event)" 
                                class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all">
                            <i class="fas fa-check ml-1"></i>
                            تکمیل
                        </button>
                    ` : `
                        <div class="flex-1 bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium text-center cursor-not-allowed opacity-75">
                            <i class="fas fa-check-double ml-1"></i>
                            تکمیل شده
                        </div>
                    `}
                </div>
            </div>
        `;
    },
    
    // Calculate time remaining
    calculateTimeRemaining(deadline) {
        if (!deadline) {
            return { days: 0, hours: 0, isOverdue: false };
        }
        
        // Parse deadline (format: "YYYY-MM-DD HH:mm")
        const deadlineDate = new Date(deadline.replace(' ', 'T'));
        const now = new Date();
        const diff = deadlineDate - now;
        
        if (diff < 0) {
            return { days: 0, hours: 0, isOverdue: true };
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        return { days, hours, isOverdue: false };
    },
    
    // Start countdown timers
    startTimers() {
        // Clear existing timers
        Object.values(this.timers).forEach(timer => clearInterval(timer));
        this.timers = {};
        
        // وظایف از employee_tasks (storage اصلی)
        let allTasks = [];
        try {
            const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
            if (typeof tasksData === 'object' && !Array.isArray(tasksData)) {
                // همه وظایف همه عامل‌ها را جمع کن
                Object.values(tasksData).forEach(arr => {
                    if (Array.isArray(arr)) allTasks = allTasks.concat(arr);
                });
            }
        } catch(e) {
            allTasks = [];
        }
        
        allTasks.forEach(task => {
            const timerElement = document.getElementById(`timer-${task.id}`);
            if (!timerElement) return;
            
            this.timers[task.id] = setInterval(() => {
                const timeRemaining = this.calculateTimeRemaining(task.deadline);
                
                const daysElement = timerElement.querySelector('[data-days]');
                const hoursElement = timerElement.querySelector('[data-hours]');
                
                if (daysElement) daysElement.textContent = timeRemaining.days;
                if (hoursElement) hoursElement.textContent = timeRemaining.hours;
                
                // Add warning color if less than 1 day remaining
                if (timeRemaining.days === 0 && !timeRemaining.isOverdue) {
                    timerElement.classList.add('animate-pulse');
                    daysElement?.parentElement.classList.add('bg-red-600');
                    hoursElement?.parentElement.classList.add('bg-red-600');
                }
                
                // Stop timer if overdue
                if (timeRemaining.isOverdue) {
                    clearInterval(this.timers[task.id]);
                }
            }, 60000); // Update every minute
        });
    },
    
    // Update task status
    async updateTaskStatus(taskId, userId, event) {
        // خواندن از employee_tasks
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        const userTasks = Array.isArray(tasksData[userId]) ? tasksData[userId] : [];
        const taskIndex = userTasks.findIndex(t => t.id === taskId);
        
        if (taskIndex === -1) {
            UTILS.showNotification('وظیفه یافت نشد', 'error');
            return;
        }
        
        const task = userTasks[taskIndex];
        const buttonElement = event ? event.target.closest('button') : null;
        
        // Determine new status
        let newStatus = task.status;
        if (task.status === 'pending') {
            newStatus = 'in_progress';
        } else if (task.status === 'in_progress') {
            newStatus = 'completed';
        }
        
        if (task.status === 'pending') {
            userTasks[taskIndex].status = 'in_progress';
            userTasks[taskIndex].statusChangedAt = new Date().toISOString();
            if (buttonElement) {
                buttonElement.classList.remove('bg-green-600', 'hover:bg-green-700');
                buttonElement.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
                buttonElement.innerHTML = '<i class="fas fa-check ml-1"></i>تکمیل';
            }
            UTILS.showNotification('وظیفه شروع شد', 'success');
        } else if (task.status === 'in_progress') {
            userTasks[taskIndex].status = 'completed';
            userTasks[taskIndex].completedAt = new Date().toISOString();
            userTasks[taskIndex].statusChangedAt = new Date().toISOString();
            if (buttonElement) {
                buttonElement.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
                buttonElement.classList.add('bg-green-600', 'hover:bg-green-700');
                buttonElement.innerHTML = '<i class="fas fa-check-double ml-1"></i>تکمیل شده';
                buttonElement.disabled = true;
                buttonElement.classList.add('cursor-not-allowed', 'opacity-75');
            }
            UTILS.showNotification('وظیفه تکمیل شد', 'success');
        }
        
        tasksData[userId] = userTasks;
        localStorage.setItem('employee_tasks', JSON.stringify(tasksData));
        
        setTimeout(() => {
            this.refreshMyTasks(userId);
        }, 500);
    },
    
    // Update task button appearance
    updateTaskButton(buttonElement, status) {
        if (!buttonElement) return;
        
        if (status === 'in_progress') {
            buttonElement.classList.remove('bg-green-600', 'hover:bg-green-700');
            buttonElement.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
            buttonElement.innerHTML = '<i class="fas fa-check ml-1"></i>تکمیل';
        } else if (status === 'completed') {
            buttonElement.classList.remove('bg-yellow-600', 'hover:bg-yellow-700', 'bg-green-600', 'hover:bg-green-700');
            buttonElement.classList.add('bg-green-500', 'cursor-not-allowed', 'opacity-75');
            buttonElement.innerHTML = '<i class="fas fa-check-double ml-1"></i>تکمیل شده';
            buttonElement.disabled = true;
        }
    },
    
    // Download task file
    downloadTaskFile(taskId) {
        // جستجو در employee_tasks
        let task = null;
        try {
            const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
            for (const arr of Object.values(tasksData)) {
                if (Array.isArray(arr)) {
                    const found = arr.find(t => t.id === taskId);
                    if (found) { task = found; break; }
                }
            }
        } catch(e) {}
        
        if (!task || !task.attachedFile) {
            UTILS.showNotification('فایل یافت نشد', 'error');
            return;
        }
        
        const link = document.createElement('a');
        link.href = task.attachedFile.data;
        link.download = task.attachedFile.name;
        link.click();
        UTILS.showNotification('دانلود فایل آغاز شد', 'success');
    },
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    // Refresh my tasks
    refreshMyTasks(userId) {
        const content = document.querySelector('[x-show="currentPage === \'agentTasks\'"]');
        if (content) {
            content.innerHTML = this.getMyTasksContent(userId);
            // Restart timers after refresh
            setTimeout(() => this.startTimers(), 100);
        }
    }
};

// Global function for app.js
window.getAgentTasksContent = function() {
    try {
        let currentUserId = 'agent001';
        
        // روش‌های مختلف برای گرفتن کاربر جاری
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const u = JSON.parse(savedUser);
                if (u && u.id) currentUserId = u.id;
            }
        } catch(e) {}
        
        if (typeof ModalsModule !== 'undefined' && ModalsModule.getCurrentUser) {
            const user = ModalsModule.getCurrentUser();
            if (user && user.id) currentUserId = user.id;
        } else if (typeof getCurrentUser === 'function') {
            const user = getCurrentUser();
            if (user && user.id) currentUserId = user.id;
        }
        
        const content = AgentModule.getMyTasksContent(currentUserId);
        
        // Start timers after content is rendered
        setTimeout(() => {
            AgentModule.startTimers();
        }, 100);
        
        return content;
    } catch (error) {
        console.error('Error in getAgentTasksContent:', error);
        return `
            <div class="flex items-center justify-center h-64">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <p class="text-white text-lg mb-2">خطا در بارگذاری وظایف</p>
                    <p class="text-gray-400 text-sm">${error.message}</p>
                    <button onclick="location.reload()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-redo ml-2"></i>
                        تلاش مجدد
                    </button>
                </div>
            </div>
        `;
    }
};
