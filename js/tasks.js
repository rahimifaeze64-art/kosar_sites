// Tasks Management Module - مدیریت همکاران و وظایف
const TasksModule = {
    // Current state
    selectedemployee: null,
    activeTab: 'tasks',
    
    // Voice recording state
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    recordingStartTime: null,
    recordingTimer: null,
    
    // Voice task attachment state
    selectedVoiceTaskFile: null,
    
    // محاسبه آمار کلی همه کارمندان
    getAllEmployeesStats() {
        const employees = this.getemployees();
        const counts = { pending: 0, in_progress: 0, completed: 0, rejected: 0, approved: 0, delayed: 0 };
        employees.forEach(emp => {
            const tasks = this.getemployeeTasks(emp.id);
            tasks.forEach(t => {
                if (counts[t.status] !== undefined) counts[t.status]++;
            });
        });
        return counts;
    },

    // Get tasks page content
    getTasksContent() {
        const employees = this.getemployees();
        const stats = this.getAllEmployeesStats();
        
        return `
            <div class="space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-white">
                        <i class="fas fa-users text-lime-400 ml-2"></i>
                        مدیریت همکاران
                    </h2>
                    <div class="flex space-x-3 space-x-reverse">
                        <button onclick="TasksModule.showNewTaskModal()" 
                                class="bg-lime-600 hover:bg-lime-700 text-gray-900 px-4 py-2 rounded-lg font-medium">
                            <i class="fas fa-plus ml-2"></i>
                            وظیفه جدید
                        </button>
                    </div>
                </div>

                <!-- ═══ باکس‌های آمار کلی همه کارمندان ═══ -->
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
                        <p class="text-2xl font-bold text-yellow-400">${stats.pending}</p>
                        <p class="text-xs text-gray-400 mt-0.5">در انتظار</p>
                    </div>
                    <div class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-center">
                        <p class="text-2xl font-bold text-blue-400">${stats.in_progress}</p>
                        <p class="text-xs text-gray-400 mt-0.5">در حال انجام</p>
                    </div>
                    <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
                        <p class="text-2xl font-bold text-emerald-400">${stats.completed}</p>
                        <p class="text-xs text-gray-400 mt-0.5">تکمیل شده</p>
                    </div>
                    <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
                        <p class="text-2xl font-bold text-red-400">${stats.rejected}</p>
                        <p class="text-xs text-gray-400 mt-0.5">رد شده</p>
                    </div>
                    <div class="bg-lime-500/10 border border-lime-500/30 rounded-xl p-3 text-center">
                        <p class="text-2xl font-bold text-lime-400">${stats.approved}</p>
                        <p class="text-xs text-gray-400 mt-0.5">تأیید نهایی</p>
                    </div>
                    <div class="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-center">
                        <p class="text-2xl font-bold text-orange-400">${stats.delayed}</p>
                        <p class="text-xs text-gray-400 mt-0.5">به تأخیر افتاده</p>
                    </div>
                </div>
                
                <!-- Main Layout -->
                <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <!-- employees List -->
                    <div class="lg:col-span-1">
                        <div class="bg-slate-800 rounded-lg shadow-md p-4">
                            <h3 class="text-lg font-bold text-white mb-4">
                                <i class="fas fa-users text-lime-400 ml-2"></i>
                                کارمند‌ها
                            </h3>
                            <div class="space-y-2" id="employees-list">
                                ${employees.map(emp => this.getemployeeCard(emp)).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Main Content Area -->
                    <div class="lg:col-span-3">
                        <div class="bg-slate-800 rounded-lg shadow-md">
                            <!-- Tab Content — فقط لیست وظایف -->
                            <div class="p-4" id="tasks-tab-content">
                                ${this.getTasksTabContent()}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ═══ چک‌لیست کاری مدیر ═══ -->
                <div class="border-t border-slate-700 pt-6">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="bg-lime-500/20 p-2 rounded-xl">
                            <i class="fas fa-check-square text-lime-400 text-xl"></i>
                        </span>
                        <h2 class="text-xl font-bold text-white">چک‌لیست کاری</h2>
                    </div>
                    <div id="work-checklist-root" class="min-h-[60vh]">
                        <div class="flex items-center justify-center py-16">
                            <i class="fas fa-spinner fa-spin text-3xl text-lime-400"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
        // init چک‌لیست بعد از رندر — از Alpine کاربر جاری را می‌گیریم تا مطمئن باشیم صحیح است
        // app.js نیز این کار را در watch می‌کند؛ اگر قبلاً init شده بود دوباره اجرا نمی‌شود
        setTimeout(() => {
            if (typeof WorkChecklistModule !== 'undefined') {
                // اولویت: کاربر Alpine > localStorage
                let user = null;
                try {
                    const alpineEl = document.querySelector('[x-data]');
                    if (alpineEl && alpineEl._x_dataStack) {
                        const alpineData = alpineEl._x_dataStack[0];
                        if (alpineData && alpineData.currentUser) user = alpineData.currentUser;
                    }
                } catch(e) {}
                if (!user) {
                    try {
                        const saved = localStorage.getItem('currentUser');
                        if (saved) user = JSON.parse(saved);
                    } catch(e) {}
                }
                // جلوگیری از double-init: فقط اگر work-checklist-root هنوز رندر نشده اجرا کن
                const root = document.getElementById('work-checklist-root');
                if (user && root && root.querySelector('.fa-spinner')) {
                    WorkChecklistModule.init(user);
                }
            }
        }, 300);
    },
    
    // Get employees list - فقط کارمندها
    getemployees() {
        // ابتدا از HARDCODED_USERS بخوان (منبع اصلی و معتبر)
        const fixedemployees = (typeof HARDCODED_USERS !== 'undefined')
            ? HARDCODED_USERS
                .filter(u => u.role === 'employee' && u.active)
                .map(u => ({
                    id:       u.id,
                    name:     u.name,
                    username: u.username,
                    email:    u.email,
                    role:     u.role
                }))
            : [
                // fallback در صورت نبود HARDCODED_USERS
                { id: 'emp001', name: 'سارا سادات حسینی', username: 'sareh',   email: 'sareh@alkawsar.com',   role: 'employee' },
                { id: 'emp002', name: 'زینب بتول محمدی',  username: 'zainab',  email: 'zainab@alkawsar.com',  role: 'employee' },
                { id: 'emp003', name: 'علیرضا غلامی فرزاد', username: 'farzad', email: 'farzad@alkawsar.com', role: 'employee' },
                { id: 'emp004', name: 'سید محمد فاضلی',       username: 'fazeli', email: 'fazeli@alkawsar.com', role: 'employee' },
                { id: 'emp005', name: 'مهدی خدایاری',     username: 'mahdi',   email: 'mahdi@alkawsar.com',   role: 'employee' }
            ];

        // کارمند‌های اضافه از DataModule (از دیتابیس) — بر اساس id چک می‌شود
        const allemployees = [...fixedemployees];
        try {
            const users = DataModule.getUsers();
            const dbEmployees = users.filter(u => u.role === 'employee' && u.active);
            dbEmployees.forEach(emp => {
                if (!allemployees.find(c => c.id === emp.id)) {
                    allemployees.push(emp);
                }
            });
        } catch (e) {
            console.warn('getemployees: DataModule خطا:', e.message);
        }

        return allemployees;
    },
    
    // Get employee card
    getemployeeCard(employee) {
        const tasks = this.getemployeeTasks(employee.id);
        const pendingTasks = tasks.filter(t => t.status !== 'completed').length;
        const isSelected = this.selectedemployee === employee.id;
        const isAgent = employee.role === 'agent';
        
        return `
            <div onclick="TasksModule.selectemployee('${employee.id}')" 
                 class="p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-lime-600' : 'bg-slate-700 hover:bg-slate-600'}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <div class="w-10 h-10 rounded-full ${isAgent ? 'bg-blue-500' : 'bg-lime-500'} flex items-center justify-center text-gray-900 font-bold ml-3">
                            ${employee.name.charAt(0)}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <p class="font-medium text-white">${employee.name}</p>
                                ${isAgent ? '<span class="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">عامل</span>' : '<span class="text-xs bg-slate-500 text-white px-1.5 py-0.5 rounded">کارمند</span>'}
                            </div>
                            <p class="text-xs text-gray-400">${employee.email || 'بدون ایمیل'}</p>
                        </div>
                    </div>
                    ${pendingTasks > 0 ? `
                        <span class="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                            ${pendingTasks}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    // Select employee
    selectemployee(employeeId) {
        this.selectedemployee = employeeId;
        this.refreshContent();
        debugLogger(`Selected employee: ${employeeId}`, 'info');
    },
    
    // Switch tab
    switchTab(tab) {
        this.activeTab = tab;
        
        // Update tab buttons
        ['tasks', 'files', 'reports'].forEach(t => {
            const btn = document.getElementById(`tab-${t}`);
            if (btn) {
                if (t === tab) {
                    btn.className = 'px-4 py-2 rounded-md font-medium transition-colors bg-lime-600 text-gray-900';
                } else {
                    btn.className = 'px-4 py-2 rounded-md font-medium transition-colors text-gray-300 hover:text-lime-400';
                }
            }
        });
        
        // Update content
        const content = document.getElementById('tasks-tab-content');
        if (content) {
            switch(tab) {
                case 'tasks':
                    content.innerHTML = this.getTasksTabContent();
                    break;
                case 'files':
                    content.innerHTML = this.getFilesTabContent();
                    break;
                case 'reports':
                    content.innerHTML = this.getReportsTabContent();
                    break;
            }
        }
        
        debugLogger(`Switched to tab: ${tab}`, 'info');
    },
    
    // Get tasks tab content
    getTasksTabContent() {
        if (!this.selectedemployee) {
            return `
                <div class="text-center py-12">
                    <i class="fas fa-hand-pointer text-4xl text-gray-500 mb-4"></i>
                    <p class="text-gray-400">یک کارمند را از لیست انتخاب کنید</p>
                </div>
            `;
        }
        
        const tasks = this.getemployeeTasks(this.selectedemployee);
        const employee = this.getemployees().find(c => c.id === this.selectedemployee);

        return `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <h4 class="text-lg font-bold text-white">
                        وظایف ${employee?.name || ''}
                    </h4>
                    <button onclick="TasksModule.showNewTaskModal('${this.selectedemployee}')" 
                            class="bg-lime-600 hover:bg-lime-700 text-gray-900 px-3 py-1 rounded-lg text-sm">
                        <i class="fas fa-plus ml-1"></i>
                        وظیفه جدید
                    </button>
                </div>
                
                ${tasks.length === 0 ? `
                    <div class="text-center py-8">
                        <i class="fas fa-clipboard-check text-4xl text-gray-500 mb-4"></i>
                        <p class="text-gray-400">هنوز وظیفه‌ای تعریف نشده است</p>
                    </div>
                ` : `
                    <div class="space-y-3">
                        ${tasks.map(task => this.getTaskCard(task)).join('')}
                    </div>
                `}
            </div>
        `;
    },
    
    // Get task card
    getTaskCard(task) {
        const statusColors = {
            'pending': 'bg-lime-500',
            'in_progress': 'bg-blue-500',
            'completed': 'bg-green-500'
        };
        const statusTexts = {
            'pending': 'در انتظار',
            'in_progress': 'در حال انجام',
            'completed': 'تکمیل شده'
        };
        
        // Voice message display
        const voiceHTML = task.voiceMessage ? `
            <div class="mt-3 bg-slate-600 rounded-lg p-3">
                <div class="flex items-center space-x-3 space-x-reverse">
                    <button onclick="TasksModule.playVoice('${task.id}')" 
                            class="w-10 h-10 rounded-full bg-lime-500 hover:bg-lime-600 flex items-center justify-center text-gray-900"
                            id="play-btn-${task.id}">
                        <i class="fas fa-play" id="play-icon-${task.id}"></i>
                    </button>
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-xs text-gray-300">
                                <i class="fas fa-microphone ml-1"></i>
                                پیام صوتی مدیر
                            </span>
                            <span class="text-xs text-gray-400">${task.voiceDuration || '0:00'}</span>
                        </div>
                        <div class="w-full bg-slate-500 rounded-full h-1">
                            <div class="bg-lime-400 h-1 rounded-full" style="width: 0%" id="progress-${task.id}"></div>
                        </div>
                    </div>
                    <audio id="audio-${task.id}" src="${task.voiceMessage}" class="hidden"></audio>
                </div>
            </div>
        ` : '';
        
        // Additional text display
        const additionalTextHTML = task.additionalText ? `
            <div class="mt-3 bg-slate-600 rounded-lg p-3">
                <div class="flex items-start space-x-2 space-x-reverse">
                    <i class="fas fa-align-left text-black-400 mt-1"></i>
                    <div class="flex-1">
                        <p class="text-xs text-gray-300 mb-1">متن اضافی:</p>
                        <p class="text-sm text-white">${task.additionalText}</p>
                    </div>
                </div>
            </div>
        ` : '';
        
        // Attached file display
        const attachedFileHTML = task.attachedFile ? `
            <div class="mt-3 bg-slate-600 rounded-lg p-3">
                <div class="flex items-center space-x-3 space-x-reverse">
                    <i class="fas ${this.getFileIcon(task.attachedFile.name)} text-xl"></i>
                    <div class="flex-1">
                        <p class="text-xs text-gray-300 mb-1">فایل ضمیمه:</p>
                        <p class="text-sm text-white">${task.attachedFile.name}</p>
                        <p class="text-xs text-gray-400">${this.formatFileSize(task.attachedFile.size)}</p>
                    </div>
                    <button onclick="TasksModule.downloadTaskFile('${task.id}')" 
                            class="text-lime-400 hover:text-lime-300 p-2" title="دانلود فایل">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        ` : '';
        
        return `
            <div class="bg-slate-700 rounded-lg p-4">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center mb-2">
                            <span class="w-3 h-3 rounded-full ${statusColors[task.status] || 'bg-gray-500'} ml-2"></span>
                            <h5 class="font-medium text-white">${task.title}</h5>
                        </div>
                        <p class="text-sm text-gray-400 mb-2">${task.description || ''}</p>
                        <div class="flex items-center text-xs text-gray-500 space-x-4 space-x-reverse">
                            <span><i class="fas fa-calendar ml-1"></i>${this._formatJalaliDate(task.dueDate)}</span>
                            <span><i class="fas fa-flag ml-1"></i>${task.priority === 'high' ? 'فوری' : task.priority === 'medium' ? 'متوسط' : 'عادی'}</span>
                        </div>
                        ${voiceHTML}
                        ${additionalTextHTML}
                        ${attachedFileHTML}
                    </div>
                    <div class="flex items-center space-x-2 space-x-reverse">
                        <span class="text-xs px-2 py-1 rounded ${statusColors[task.status]} text-white">
                            ${statusTexts[task.status] || task.status}
                        </span>
                        <button onclick="TasksModule.showEditTaskModal('${task.id}')" 
                                class="text-gray-400 hover:text-lime-400 p-1" title="ویرایش وظیفه">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="TasksModule.deleteTask('${task.id}')" 
                                class="text-gray-400 hover:text-red-400 p-1" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get file icon based on extension
    getFileIcon(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': 'fa-file-pdf text-red-400',
            'doc': 'fa-file-word text-black-400',
            'docx': 'fa-file-word text-black-400',
            'xls': 'fa-file-excel text-green-400',
            'xlsx': 'fa-file-excel text-green-400',
            'jpg': 'fa-file-image text-lime-400',
            'png': 'fa-file-image text-lime-400',
            'txt': 'fa-file-alt text-gray-400',
            'zip': 'fa-file-archive text-lime-400',
            'rar': 'fa-file-archive text-lime-400'
        };
        return iconMap[ext] || 'fa-file text-gray-400';
    },
    
    // Download task file
    downloadTaskFile(taskId) {
        if (!this.selectedemployee) return;
        
        const tasks = this.getemployeeTasks(this.selectedemployee);
        const task = tasks.find(t => t.id === taskId);
        
        if (!task || !task.attachedFile) {
            UTILS.showNotification('فایل یافت نشد', 'error');
            return;
        }
        
        if (task.attachedFile.data) {
            const link = document.createElement('a');
            link.href = task.attachedFile.data;
            link.download = task.attachedFile.name;
            link.click();
            UTILS.showNotification('فایل دانلود شد', 'success');
        } else {
            UTILS.showNotification('داده فایل موجود نیست', 'warning');
        }
    },

    // Get chat tab content
    getChatTabContent() {
        if (!this.selectedemployee) {
            return `
                <div class="text-center py-12">
                    <i class="fas fa-hand-pointer text-4xl text-gray-500 mb-4"></i>
                    <p class="text-gray-400">یک کارمند را از لیست انتخاب کنید</p>
                </div>
            `;
        }
        
        const messages = this.getemployeeMessages(this.selectedemployee);
        const employee = this.getemployees().find(c => c.id === this.selectedemployee);
        
        return `
            <div class="space-y-4">
                <h4 class="text-lg font-bold text-white">
                    گفتگو با ${employee?.name || ''}
                </h4>
                
                <!-- Messages Area -->
                <div class="bg-slate-700 rounded-lg p-4 h-80 overflow-y-auto" id="chat-messages">
                    ${messages.length === 0 ? `
                        <div class="text-center py-8">
                            <i class="fas fa-comments text-4xl text-gray-500 mb-4"></i>
                            <p class="text-gray-400">هنوز پیامی ارسال نشده است</p>
                        </div>
                    ` : `
                        <div class="space-y-3">
                            ${messages.map(msg => this.getChatMessage(msg)).join('')}
                        </div>
                    `}
                </div>
                
                <!-- Send Message -->
                <div class="flex space-x-2 space-x-reverse">
                    <input type="text" id="employee-message-input" 
                           class="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                           placeholder="پیام خود را بنویسید..."
                           onkeypress="if(event.key === 'Enter') TasksModule.sendemployeeMessage()">
                    <button onclick="TasksModule.sendemployeeMessage()" 
                            class="bg-lime-600 hover:bg-lime-700 text-gray-900 px-4 py-2 rounded-lg">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
    },
    
    // Get chat message
    getChatMessage(message) {
        const isManager = message.senderId === 'mgr001';
        
        return `
            <div class="flex ${isManager ? 'justify-start' : 'justify-end'}">
                <div class="max-w-xs lg:max-w-md ${isManager ? 'bg-lime-600' : 'bg-slate-600'} rounded-lg p-3">
                    <p class="text-white text-sm">${message.text}</p>
                    <p class="text-xs text-gray-250 mt-1">${message.timestamp}</p>
                </div>
            </div>
        `;
    },
    
    // Get files tab content
    getFilesTabContent() {
        if (!this.selectedemployee) {
            return `
                <div class="text-center py-12">
                    <i class="fas fa-hand-pointer text-4xl text-gray-500 mb-4"></i>
                    <p class="text-gray-400">یک کارمند را از لیست انتخاب کنید</p>
                </div>
            `;
        }
        
        const files = this.getemployeeFiles(this.selectedemployee);
        const employee = this.getemployees().find(c => c.id === this.selectedemployee);
        
        return `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <h4 class="text-lg font-bold text-white">
                        فایل‌های مشترک با ${employee?.name || ''}
                    </h4>
                    <button onclick="TasksModule.uploademployeeFile()" 
                            class="bg-lime-600 hover:bg-lime-700 text-gray-900 px-3 py-1 rounded-lg text-sm">
                        <i class="fas fa-upload ml-1"></i>
                        آپلود فایل
                    </button>
                </div>
                
                ${files.length === 0 ? `
                    <div class="text-center py-8">
                        <i class="fas fa-folder-open text-4xl text-gray-500 mb-4"></i>
                        <p class="text-gray-400">هنوز فایلی آپلود نشده است</p>
                    </div>
                ` : `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        ${files.map(file => this.getFileCard(file)).join('')}
                    </div>
                `}
            </div>
        `;
    },
    
    // Get file card
    getFileCard(file) {
        const iconMap = {
            'pdf': 'fa-file-pdf text-red-400',
            'doc': 'fa-file-word text-black-400',
            'docx': 'fa-file-word text-black-400',
            'xls': 'fa-file-excel text-green-400',
            'xlsx': 'fa-file-excel text-green-400',
            'jpg': 'fa-file-image text-lime-400',
            'png': 'fa-file-image text-lime-400'
        };
        const ext = file.name.split('.').pop().toLowerCase();
        const icon = iconMap[ext] || 'fa-file text-gray-400';
        
        return `
            <div class="bg-slate-700 rounded-lg p-3 flex items-center justify-between">
                <div class="flex items-center">
                    <i class="fas ${icon} text-2xl ml-3"></i>
                    <div>
                        <p class="text-white text-sm font-medium">${file.name}</p>
                        <p class="text-xs text-gray-400">${file.uploadedAt} - ${file.uploadedByName}</p>
                    </div>
                </div>
                <div class="flex space-x-2 space-x-reverse">
                    <button onclick="TasksModule.downloademployeeFile('${file.id}')" 
                            class="text-lime-400 hover:text-lime-300 p-1">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="TasksModule.deleteemployeeFile('${file.id}')" 
                            class="text-red-400 hover:text-red-300 p-1">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },
    
    // Get reports tab content
    getReportsTabContent() {
        if (!this.selectedemployee) {
            return `
                <div class="text-center py-12">
                    <i class="fas fa-hand-pointer text-4xl text-gray-500 mb-4"></i>
                    <p class="text-gray-400">یک کارمند را از لیست انتخاب کنید</p>
                </div>
            `;
        }
        
        const reports = this.getemployeeReports(this.selectedemployee);
        const employee = this.getemployees().find(c => c.id === this.selectedemployee);
        
        return `
            <div class="space-y-4">
                <h4 class="text-lg font-bold text-white">
                    گزارشات روزانه ${employee?.name || ''}
                </h4>
                
                ${reports.length === 0 ? `
                    <div class="text-center py-8">
                        <i class="fas fa-file-alt text-4xl text-gray-500 mb-4"></i>
                        <p class="text-gray-400">هنوز گزارشی ثبت نشده است</p>
                    </div>
                ` : `
                    <div class="space-y-3">
                        ${reports.map(report => this.getReportCard(report)).join('')}
                    </div>
                `}
            </div>
        `;
    },
    
    // Get report card
    getReportCard(report) {
        return `
            <div class="bg-slate-700 rounded-lg p-4">
                <div class="flex justify-between items-start mb-2">
                    <h5 class="font-medium text-white">${report.date}</h5>
                    <span class="text-xs text-gray-400">${report.submittedAt}</span>
                </div>
                <p class="text-sm text-gray-300 mb-3">${report.summary}</p>
                <div class="flex items-center text-xs text-gray-400 space-x-4 space-x-reverse">
                    <span><i class="fas fa-check-circle text-green-400 ml-1"></i>تکمیل شده: ${report.completedTasks}</span>
                    <span><i class="fas fa-clock text-lime-400 ml-1"></i>در حال انجام: ${report.inProgressTasks}</span>
                </div>
            </div>
        `;
    },

    // Get management chat tab content
    getManagementChatTabContent() {
        return `
            <div class="management-chat-wrapper" style="height: calc(100vh - 350px); display: flex; flex-direction: column;">
                <!-- Chat Header -->
                <div class="bg-gradient-to-r from-lime-500 to-lime-600 rounded-t-lg p-4 mb-4">
                    <h4 class="text-lg font-bold text-white mb-2">
                        <i class="fas fa-users-cog ml-2"></i>
                        گفتگو مدیریت
                    </h4>
                    <p class="text-lime-100 text-sm">
                        چت مشترک مدیر و کارمند ها برای هماهنگی وظایف
                    </p>
                </div>
                
                <!-- Search Box -->
                <div class="mb-4">
                    <div class="relative">
                        <input type="text" 
                               id="managementChatSearch"
                               placeholder="جستجو در پیام‌ها..."
                               oninput="if(window.managesChatInstance) window.managesChatInstance.setSearchQuery(this.value)"
                               class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 pr-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-500">
                        <i class="fas fa-search absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    </div>
                </div>

                <!-- Participants Bar -->
                <div class="bg-slate-700 rounded-lg p-3 mb-4">
                    <div class="flex items-center gap-3 overflow-x-auto">
                        <span class="text-gray-400 text-sm whitespace-nowrap">شرکت‌کنندگان:</span>
                        <div class="flex items-center gap-2 bg-lime-600 px-3 py-1 rounded-full text-sm">
                            <i class="fas fa-crown"></i>
                            <span>مدیر</span>
                            <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                        </div>
                        ${this.getemployees().map(emp => `
                            <div class="flex items-center gap-2 bg-slate-600 px-3 py-1 rounded-full text-sm">
                                <i class="fas fa-user"></i>
                                <span>${emp.name}</span>
                                <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Messages Area -->
                <div id="managesChatMessages" class="flex-1 bg-slate-700 rounded-lg p-4 overflow-y-auto mb-4" style="min-height: 400px; direction: rtl;">
                    <!-- Messages will be rendered here by manages-chat.js -->
                </div>

                <!-- Input Area -->
                <div class="bg-slate-700 rounded-lg p-4">
                    <div class="flex gap-3 items-end">
                        <textarea 
                            id="managesChatInput" 
                            class="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white resize-none"
                            placeholder="پیام خود را بنویسید... (از @ برای منشن استفاده کنید)"
                            rows="2"
                            style="min-height: 44px; max-height: 120px; direction: rtl;"></textarea>
                        
                        <div class="flex gap-2">
                            <button id="mentionBtn" 
                                    class="w-11 h-11 bg-lime-500 hover:bg-lime-600 text-slate-900 rounded-lg flex items-center justify-center"
                                    title="منشن کردن">
                                <i class="fas fa-at"></i>
                            </button>
                            <button id="attachFileBtn" 
                                    class="w-11 h-11 bg-lime-600 hover:bg-lime-700 text-gray-900 rounded-lg flex items-center justify-center"
                                    title="پیوست فایل">
                                <i class="fas fa-paperclip"></i>
                            </button>
                            <button id="recordVoiceBtn" 
                                    class="w-11 h-11 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center"
                                    title="ضبط صوت">
                                <i class="fas fa-microphone"></i>
                            </button>
                            <button id="sendManagesChatBtn" 
                                    class="w-11 h-11 bg-lime-600 hover:bg-lime-700 text-gray-900 rounded-lg flex items-center justify-center"
                                    title="ارسال">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .management-chat-wrapper #managesChatMessages::-webkit-scrollbar {
                    width: 8px;
                }
                .management-chat-wrapper #managesChatMessages::-webkit-scrollbar-track {
                    background: #1e293b;
                    border-radius: 4px;
                }
                .management-chat-wrapper #managesChatMessages::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 4px;
                }
                .management-chat-wrapper #managesChatMessages::-webkit-scrollbar-thumb:hover {
                    background: #64748b;
                }
                .management-chat-wrapper textarea {
                    font-family: inherit;
                    direction: rtl;
                }
                .management-chat-wrapper textarea:focus {
                    outline: none;
                    border-color: #6366f1;
                }
            </style>
        `;
    },

    // ── Helper: آیا Supabase آنلاین است؟ ────────────────────
    _sb() {
        return typeof SupabaseDataModule !== 'undefined' &&
               typeof SupabaseConnection !== 'undefined' &&
               SupabaseConnection.isOnline === true
               ? SupabaseDataModule : null;
    },

    // Data methods — localStorage + Supabase
    getemployeeTasks(employeeId) {
        const sb = this._sb();
        if (sb) {
            // sync پس‌زمینه از Supabase
            sb.getEmployeeTasks(employeeId).then(tasks => {
                if (tasks && tasks.length > 0) {
                    const all = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
                    all[employeeId] = tasks;
                    localStorage.setItem('employee_tasks', JSON.stringify(all));
                }
            }).catch(e => console.warn('⚠️ getemployeeTasks sync:', e.message));
        }
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        return tasksData[employeeId] || [];
    },
    
    saveemployeeTasks(employeeId, tasks) {
        // ۱. ذخیره فوری در localStorage
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        tasksData[employeeId] = tasks;
        localStorage.setItem('employee_tasks', JSON.stringify(tasksData));
        // ۲. sync آخرین task به Supabase
        const sb = this._sb();
        if (sb && tasks.length > 0) {
            const latest = tasks[0];
            sb.saveEmployeeTask(employeeId, latest)
              .catch(e => console.warn('⚠️ saveemployeeTasks Supabase خطا:', e.message));
        }
    },
    
    getemployeeMessages(employeeId) {
        const messagesData = JSON.parse(localStorage.getItem('employee_messages') || '{}');
        return messagesData[employeeId] || [];
    },
    
    saveemployeeMessages(employeeId, messages) {
        const messagesData = JSON.parse(localStorage.getItem('employee_messages') || '{}');
        messagesData[employeeId] = messages;
        localStorage.setItem('employee_messages', JSON.stringify(messagesData));
        // پیام‌های تسک‌ها از طریق MessagesModule.saveMessage به Supabase می‌روند
    },
    
    getemployeeFiles(employeeId) {
        const filesData = JSON.parse(localStorage.getItem('employee_files') || '{}');
        return filesData[employeeId] || [];
    },
    
    saveemployeeFiles(employeeId, files) {
        const filesData = JSON.parse(localStorage.getItem('employee_files') || '{}');
        filesData[employeeId] = files;
        localStorage.setItem('employee_files', JSON.stringify(filesData));
    },
    
    getemployeeReports(employeeId) {
        const reportsData = JSON.parse(localStorage.getItem('employee_reports') || '{}');
        return reportsData[employeeId] || [];
    },
    
    saveemployeeReports(employeeId, reports) {
        const reportsData = JSON.parse(localStorage.getItem('employee_reports') || '{}');
        reportsData[employeeId] = reports;
        localStorage.setItem('employee_reports', JSON.stringify(reportsData));
    },
    
    // Action methods - مودال وظیفه جدید (با پیوست فایل و صوت اختیاری)
    showNewTaskModal(employeeId = null) {
        const targetemployee = employeeId || this.selectedemployee;
        if (!targetemployee) {
            UTILS.showNotification('لطفاً ابتدا یک کارمند انتخاب کنید', 'warning');
            return;
        }
        // reset state
        this.selectedVoiceTaskFile = null;
        this.recordedVoiceData = null;
        this.recordedVoiceDuration = null;

        const employees = this.getemployees();
        const modalHTML = `
            <div id="new-task-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                <div class="bg-slate-800 rounded-lg max-w-lg w-full p-6 my-4">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-plus text-lime-400 ml-2"></i>
                        وظیفه جدید
                    </h3>
                    <div class="space-y-4">
                        <!-- کارمند -->
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">کارمند</label>
                            <select id="task-employee" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                                ${employees.map(c => `
                                    <option value="${c.id}" ${c.id === targetemployee ? 'selected' : ''}>${c.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <!-- عنوان -->
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">عنوان وظیفه <span class="text-red-400">*</span></label>
                            <input type="text" id="task-title"
                                   class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                   placeholder="عنوان وظیفه را وارد کنید">
                        </div>
                        <!-- توضیحات -->
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">توضیحات</label>
                            <textarea id="task-description" rows="3"
                                      class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                      placeholder="توضیحات وظیفه..."></textarea>
                        </div>
                        <!-- تاریخ + اولویت -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">مهلت انجام</label>
                                <div class="flex flex-col gap-1">
                                    <div class="flex gap-1 mb-1">
                                        <button type="button" onclick="WorkHoursUI.setQuickDate('task-due-date','task-due-date-disp',-2)"
                                                class="flex-1 text-xs bg-slate-600 hover:bg-slate-500 text-gray-300 px-2 py-1 rounded-lg"> امروز</button>
                                        <button type="button" onclick="WorkHoursUI.setQuickDate('task-due-date','task-due-date-disp',-1)"
                                                class="flex-1 text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded-lg">فردا</button>
                                        <button type="button" onclick="WorkHoursUI.setQuickDate('task-due-date','task-due-date-disp',0)"
                                                class="flex-1 text-xs bg-lime-700 hover:bg-lime-600 text-white px-2 py-1 rounded-lg">پس فردا</button>
                                    </div>
                                    <input type="hidden" id="task-due-date">
                                    <button type="button" id="task-due-date-disp"
                                            onclick="WorkHoursUI.openJalaliPicker('task-due-date','task-due-date-disp')"
                                            class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-right text-white hover:border-lime-500 transition-colors">
                                        <span id="task-due-date-disp-text" class="text-gray-400">انتخاب تاریخ</span>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">اولویت</label>
                                <select id="task-priority" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                                    <option value="low">عادی</option>
                                    <option value="medium">متوسط</option>
                                    <option value="high">فوری</option>
                                </select>
                            </div>
                        </div>
                        <!-- پیوست فایل -->
                        <div class="bg-slate-700 rounded-lg p-3">
                            <label class="block text-sm text-gray-300 mb-2">
                                <i class="fas fa-paperclip text-lime-400 ml-1"></i>
                                پیوست فایل (اختیاری)
                            </label>
                            <div class="flex items-center gap-2">
                                <button type="button" onclick="TasksModule._selectNewTaskFile()"
                                        class="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded-lg text-sm">
                                    <i class="fas fa-folder-open ml-1"></i>انتخاب فایل
                                </button>
                                <span id="new-task-file-name" class="text-gray-400 text-sm">فایلی انتخاب نشده</span>
                            </div>
                            <div id="new-task-file-preview" class="mt-2 hidden">
                                <div class="bg-slate-600 rounded-lg p-2 flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <i id="new-task-file-icon" class="fas fa-file text-gray-400 text-lg"></i>
                                        <div>
                                            <p id="new-task-file-display" class="text-white text-sm"></p>
                                            <p id="new-task-file-size" class="text-gray-400 text-xs"></p>
                                        </div>
                                    </div>
                                    <button type="button" onclick="TasksModule._removeNewTaskFile()"
                                            class="text-red-400 hover:text-red-300 p-1">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
            </div>
                        </div>
                        <!-- ضبط صوت اختیاری -->
                        <div class="bg-slate-700 rounded-lg p-3">
                            <label class="block text-sm text-gray-300 mb-2">
                                <i class="fas fa-microphone text-red-400 ml-1"></i>
                                پیام صوتی (اختیاری)
                            </label>
                            <div id="new-task-voice-container">
                                <!-- حالت اولیه -->
                                <div id="new-task-voice-initial" class="flex items-center gap-3">
                                    <button type="button" onclick="TasksModule._startNewTaskRecording()"
                                            class="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg">
                                        <i class="fas fa-microphone"></i>
                                    </button>
                                    <span class="text-gray-400 text-sm">برای ضبط صوت کلیک کنید</span>
                                </div>
                                <!-- حالت در حال ضبط -->
                                <div id="new-task-voice-recording" class="hidden flex items-center gap-3">
                                    <div class="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                                    <span class="text-white font-mono" id="new-task-recording-time">0:00</span>
                                    <button type="button" onclick="TasksModule._stopNewTaskRecording()"
                                            class="w-12 h-12 rounded-full bg-slate-500 hover:bg-slate-400 flex items-center justify-center text-white">
                                        <i class="fas fa-stop"></i>
                                    </button>
                                    <span class="text-red-400 text-sm">در حال ضبط...</span>
                                </div>
                                <!-- حالت ضبط شده -->
                                <div id="new-task-voice-recorded" class="hidden flex items-center gap-3">
                                    <button type="button" onclick="TasksModule._playNewTaskVoice()"
                                            class="w-10 h-10 rounded-full bg-lime-500 hover:bg-lime-600 flex items-center justify-center text-gray-900"
                                            id="new-task-play-btn">
                                        <i class="fas fa-play text-sm" id="new-task-play-icon"></i>
                                    </button>
                                    <div class="flex-1">
                                        <div class="w-full bg-slate-500 rounded-full h-1.5">
                                            <div class="bg-lime-400 h-1.5 rounded-full" style="width:0%" id="new-task-voice-progress"></div>
                                        </div>
                                        <span class="text-gray-400 text-xs" id="new-task-voice-duration"></span>
                                    </div>
                                    <button type="button" onclick="TasksModule._deleteNewTaskRecording()"
                                            class="text-red-400 hover:text-red-300 p-1">
                                        <i class="fas fa-trash text-sm"></i>
                                    </button>
                                    <audio id="new-task-voice-audio" class="hidden"></audio>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 mt-6">
                        <button onclick="TasksModule.closeModal('new-task-modal')"
                                class="px-4 py-2 text-gray-400 hover:text-white">انصراف</button>
                        <button onclick="TasksModule.createTask()"
                                class="bg-lime-600 hover:bg-lime-700 text-gray-900 px-4 py-2 rounded-lg font-medium">
                            <i class="fas fa-paper-plane ml-2"></i>ایجاد وظیفه
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        if (typeof WorkHoursUI !== 'undefined') {
            WorkHoursUI.setQuickDate('task-due-date', 'task-due-date-disp', 0);
        }
    },

    // ── انتخاب فایل پیوست برای وظیفه جدید ───────────────────────
    _selectNewTaskFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.zip,.rar';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const nameEl   = document.getElementById('new-task-file-name');
            const preview  = document.getElementById('new-task-file-preview');
            const dispName = document.getElementById('new-task-file-display');
            const dispSize = document.getElementById('new-task-file-size');
            const dispIcon = document.getElementById('new-task-file-icon');
            if (nameEl) nameEl.textContent = file.name;
            if (dispName) dispName.textContent = file.name;
            if (dispSize) dispSize.textContent = this.formatFileSize(file.size);
            if (dispIcon) dispIcon.className = 'fas ' + this.getFileIcon(file.name) + ' text-lg';
            if (preview) preview.classList.remove('hidden');
            if (file.size <= 2 * 1024 * 1024) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.selectedVoiceTaskFile = { name: file.name, size: file.size, data: ev.target.result };
                };
                reader.readAsDataURL(file);
            } else {
                this.selectedVoiceTaskFile = { name: file.name, size: file.size, data: null };
                UTILS.showNotification('فایل بزرگتر از ۲MB است — بدون داده ذخیره می‌شود', 'warning');
            }
        };
        input.click();
    },

    _removeNewTaskFile() {
        this.selectedVoiceTaskFile = null;
        const nameEl  = document.getElementById('new-task-file-name');
        const preview = document.getElementById('new-task-file-preview');
        if (nameEl) nameEl.textContent = 'فایلی انتخاب نشده';
        if (preview) preview.classList.add('hidden');
    },

    // ── ضبط صوت برای وظیفه جدید ──────────────────────────────────
    async _startNewTaskRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.recordedVoiceData = ev.target.result;
                    const audio = document.getElementById('new-task-voice-audio');
                    if (audio) audio.src = this.recordedVoiceData;
                };
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(t => t.stop());
                document.getElementById('new-task-voice-recording')?.classList.add('hidden');
                document.getElementById('new-task-voice-recorded')?.classList.remove('hidden');
                const dur = document.getElementById('new-task-voice-duration');
                if (dur) dur.textContent = this.recordedVoiceDuration || '';
            };
            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            document.getElementById('new-task-voice-initial')?.classList.add('hidden');
            document.getElementById('new-task-voice-recording')?.classList.remove('hidden');
            this.recordingTimer = setInterval(() => {
                const sec = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const m = Math.floor(sec / 60), s = sec % 60;
                this.recordedVoiceDuration = m + ':' + String(s).padStart(2, '0');
                const timeEl = document.getElementById('new-task-recording-time');
                if (timeEl) timeEl.textContent = this.recordedVoiceDuration;
            }, 1000);
        } catch (e) {
            UTILS.showNotification('دسترسی به میکروفون ممکن نیست', 'error');
        }
    },

    _stopNewTaskRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            clearInterval(this.recordingTimer);
        }
    },

    _playNewTaskVoice() {
        const audio = document.getElementById('new-task-voice-audio');
        const icon  = document.getElementById('new-task-play-icon');
        const prog  = document.getElementById('new-task-voice-progress');
        if (!audio) return;
        if (audio.paused) {
            audio.play();
            if (icon) icon.className = 'fas fa-pause text-sm';
            audio.ontimeupdate = () => {
                if (prog) prog.style.width = ((audio.currentTime / audio.duration) * 100) + '%';
            };
            audio.onended = () => {
                if (icon) icon.className = 'fas fa-play text-sm';
                if (prog) prog.style.width = '0%';
            };
        } else {
            audio.pause();
            if (icon) icon.className = 'fas fa-play text-sm';
        }
    },

    _deleteNewTaskRecording() {
        this.recordedVoiceData = null;
        this.recordedVoiceDuration = null;
        document.getElementById('new-task-voice-recorded')?.classList.add('hidden');
        document.getElementById('new-task-voice-initial')?.classList.remove('hidden');
    },
    
    // مودال وظیفه صوتی
    showVoiceTaskModal(employeeId = null) {
        const targetemployee = employeeId || this.selectedemployee;
        if (!targetemployee) {
            UTILS.showNotification('لطفاً ابتدا یک کارمند انتخاب کنید', 'warning');
            return;
        }
        
        const employees = this.getemployees();
        const employee = employees.find(c => c.id === targetemployee);
        
        const modalHTML = `
            <div id="voice-task-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg max-w-md w-full p-6">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-microphone text-red-400 ml-2"></i>
                        وظیفه صوتی برای ${employee?.name || ''}
                    </h3>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">کارمند</label>
                            <select id="voice-task-employee" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                                ${employees.map(c => `
                                    <option value="${c.id}" ${c.id === targetemployee ? 'selected' : ''}>${c.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <!-- Additional Text Section -->
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">متن اضافی (اختیاری)</label>
                            <textarea id="voice-task-text" rows="3"
                                      class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                      placeholder="متن توضیحی اضافی برای وظیفه..."></textarea>
                        </div>
                        
                        <!-- File Attachment Section -->
                        <div>
                            <label class="block text-sm text-gray-300 mb-2">فایل ضمیمه (اختیاری)</label>
                            <div class="flex items-center space-x-3 space-x-reverse">
                                <button onclick="TasksModule.selectVoiceTaskFile()" 
                                        class="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm">
                                    <i class="fas fa-paperclip ml-2"></i>
                                    انتخاب فایل
                                </button>
                                <span id="voice-task-file-name" class="text-gray-400 text-sm">فایلی انتخاب نشده</span>
                            </div>
                            <div id="voice-task-file-preview" class="mt-2 hidden">
                                <div class="bg-slate-600 rounded-lg p-3 flex items-center justify-between">
                                    <div class="flex items-center">
                                        <i id="voice-task-file-icon" class="fas fa-file text-gray-400 text-xl ml-3"></i>
                                        <div>
                                            <p id="voice-task-file-display-name" class="text-white text-sm"></p>
                                            <p id="voice-task-file-size" class="text-gray-400 text-xs"></p>
                                        </div>
                                    </div>
                                    <button onclick="TasksModule.removeVoiceTaskFile()" 
                                            class="text-red-400 hover:text-red-300 p-1">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Voice Recording Section -->
                        <div class="bg-slate-700 rounded-lg p-6">
                            <div id="voice-recorder-container">
                                <!-- Initial State -->
                                <div id="voice-initial" class="text-center">
                                    <button onclick="TasksModule.startRecording()" 
                                            class="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white mx-auto mb-3 transition-all shadow-lg">
                                        <i class="fas fa-microphone text-3xl"></i>
                                    </button>
                                    <p class="text-gray-300">برای ضبط ویس کلیک کنید</p>
                                </div>
                                
                                <!-- Recording State -->
                                <div id="voice-recording" class="text-center hidden">
                                    <div class="flex items-center justify-center space-x-4 space-x-reverse mb-4">
                                        <div class="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                                        <span class="text-white font-mono text-2xl" id="recording-time">0:00</span>
                                    </div>
                                    <button onclick="TasksModule.stopRecording()" 
                                            class="w-20 h-20 rounded-full bg-slate-600 hover:bg-slate-500 flex items-center justify-center text-white mx-auto transition-all shadow-lg">
                                        <i class="fas fa-stop text-3xl"></i>
                                    </button>
                                    <p class="text-red-400 mt-3">در حال ضبط...</p>
                                </div>
                                
                                <!-- Recorded State -->
                                <div id="voice-recorded" class="hidden">
                                    <div class="flex items-center space-x-3 space-x-reverse">
                                        <button onclick="TasksModule.playRecordedVoice()" 
                                                class="w-14 h-14 rounded-full bg-lime-500 hover:bg-lime-600 flex items-center justify-center text-gray-900"
                                                id="preview-play-btn">
                                            <i class="fas fa-play text-xl" id="preview-play-icon"></i>
                                        </button>
                                        <div class="flex-1">
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-white">پیام صوتی ضبط شده</span>
                                                <span class="text-gray-400" id="recorded-duration">0:00</span>
                                            </div>
                                            <div class="w-full bg-slate-600 rounded-full h-2">
                                                <div class="bg-lime-400 h-2 rounded-full" style="width: 0%" id="preview-progress"></div>
                                            </div>
                                        </div>
                                        <button onclick="TasksModule.deleteRecording()" 
                                                class="text-red-400 hover:text-red-300 p-2">
                                            <i class="fas fa-trash text-xl"></i>
                                        </button>
                                    </div>
                                    <audio id="preview-audio" class="hidden"></audio>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end space-x-3 space-x-reverse mt-6">
                        <button onclick="TasksModule.closeModal('voice-task-modal')" 
                                class="px-4 py-2 text-gray-400 hover:text-white">
                            انصراف
                        </button>
                        <button onclick="TasksModule.createVoiceTask()" 
                                class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-paper-plane ml-2"></i>
                            ارسال وظیفه صوتی
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Reset voice recording state
        this.recordedVoiceData = null;
        this.recordedVoiceDuration = null;
        this.selectedVoiceTaskFile = null;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // Voice Recording Methods
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    this.recordedVoiceData = reader.result;
                    this.showRecordedState();
                };
                reader.readAsDataURL(audioBlob);
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            this.showRecordingState();
            
            // Start timer
            this.recordingTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                document.getElementById('recording-time').textContent = 
                    `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                // Auto stop after 60 seconds
                if (elapsed >= 60) {
                    this.stopRecording();
                }
            }, 1000);
            
            debugLogger('Voice recording started', 'info');
            
        } catch (error) {
            debugLogger('Error starting recording', 'error', error);
            UTILS.showNotification('خطا در دسترسی به میکروفون. لطفاً دسترسی را فعال کنید.', 'error');
        }
    },
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Calculate duration
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.recordedVoiceDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Clear timer
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }
            
            debugLogger('Voice recording stopped', 'info', { duration: this.recordedVoiceDuration });
        }
    },
    
    showRecordingState() {
        document.getElementById('voice-initial').classList.add('hidden');
        document.getElementById('voice-recording').classList.remove('hidden');
        document.getElementById('voice-recorded').classList.add('hidden');
    },
    
    showRecordedState() {
        document.getElementById('voice-initial').classList.add('hidden');
        document.getElementById('voice-recording').classList.add('hidden');
        document.getElementById('voice-recorded').classList.remove('hidden');
        
        // Set duration
        document.getElementById('recorded-duration').textContent = this.recordedVoiceDuration;
        
        // Set audio source
        const audio = document.getElementById('preview-audio');
        audio.src = this.recordedVoiceData;
    },
    
    deleteRecording() {
        this.recordedVoiceData = null;
        this.recordedVoiceDuration = null;
        
        document.getElementById('voice-initial').classList.remove('hidden');
        document.getElementById('voice-recording').classList.add('hidden');
        document.getElementById('voice-recorded').classList.add('hidden');
        
        UTILS.showNotification('پیام صوتی حذف شد', 'info');
    },
    
    playRecordedVoice() {
        const audio = document.getElementById('preview-audio');
        const playIcon = document.getElementById('preview-play-icon');
        const progress = document.getElementById('preview-progress');
        
        if (audio.paused) {
            audio.play();
            playIcon.className = 'fas fa-pause';
            
            audio.ontimeupdate = () => {
                const percent = (audio.currentTime / audio.duration) * 100;
                progress.style.width = percent + '%';
            };
            
            audio.onended = () => {
                playIcon.className = 'fas fa-play';
                progress.style.width = '0%';
            };
        } else {
            audio.pause();
            playIcon.className = 'fas fa-play';
        }
    },
    
    // انتخاب فایل برای وظیفه صوتی
    selectVoiceTaskFile() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.txt,.zip,.rar';
        
        fileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                UTILS.showNotification('حجم فایل نباید بیشتر از 5 مگابایت باشد', 'error');
                return;
            }
            
            // Read file as base64
            const reader = new FileReader();
            reader.onload = (e) => {
                this.selectedVoiceTaskFile = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: e.target.result
                };
                
                this.updateVoiceTaskFilePreview();
                UTILS.showNotification('فایل انتخاب شد', 'success');
            };
            reader.readAsDataURL(file);
        };
        
        fileInput.click();
    },
    
    // به‌روزرسانی پیش‌نمایش فایل
    updateVoiceTaskFilePreview() {
        if (!this.selectedVoiceTaskFile) return;
        
        const fileName = document.getElementById('voice-task-file-name');
        const preview = document.getElementById('voice-task-file-preview');
        const displayName = document.getElementById('voice-task-file-display-name');
        const fileSize = document.getElementById('voice-task-file-size');
        const fileIcon = document.getElementById('voice-task-file-icon');
        
        // Update file name display
        fileName.textContent = this.selectedVoiceTaskFile.name;
        
        // Show preview
        preview.classList.remove('hidden');
        displayName.textContent = this.selectedVoiceTaskFile.name;
        fileSize.textContent = this.formatFileSize(this.selectedVoiceTaskFile.size);
        
        // Set appropriate icon
        const ext = this.selectedVoiceTaskFile.name.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': 'fa-file-pdf text-red-400',
            'doc': 'fa-file-word text-black-400',
            'docx': 'fa-file-word text-black-400',
            'xls': 'fa-file-excel text-green-400',
            'xlsx': 'fa-file-excel text-green-400',
            'jpg': 'fa-file-image text-lime-400',
            'png': 'fa-file-image text-lime-400',
            'txt': 'fa-file-alt text-gray-400',
            'zip': 'fa-file-archive text-lime-400',
            'rar': 'fa-file-archive text-lime-400'
        };
        
        fileIcon.className = `fas ${iconMap[ext] || 'fa-file text-gray-400'} text-xl ml-3`;
    },
    
    // حذف فایل انتخاب شده
    removeVoiceTaskFile() {
        this.selectedVoiceTaskFile = null;
        
        const fileName = document.getElementById('voice-task-file-name');
        const preview = document.getElementById('voice-task-file-preview');
        
        fileName.textContent = 'فایلی انتخاب نشده';
        preview.classList.add('hidden');
        
        UTILS.showNotification('فایل حذف شد', 'info');
    },
    
    // فرمت کردن حجم فایل
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Play voice in task card
    playVoice(taskId) {
        const audio = document.getElementById(`audio-${taskId}`);
        const playIcon = document.getElementById(`play-icon-${taskId}`);
        const progress = document.getElementById(`progress-${taskId}`);
        
        if (!audio) return;
        
        if (audio.paused) {
            // Stop all other playing audios
            document.querySelectorAll('audio').forEach(a => {
                if (a.id !== `audio-${taskId}`) {
                    a.pause();
                    a.currentTime = 0;
                }
            });
            
            audio.play();
            playIcon.className = 'fas fa-pause';
            
            audio.ontimeupdate = () => {
                const percent = (audio.currentTime / audio.duration) * 100;
                progress.style.width = percent + '%';
            };
            
            audio.onended = () => {
                playIcon.className = 'fas fa-play';
                progress.style.width = '0%';
            };
        } else {
            audio.pause();
            playIcon.className = 'fas fa-play';
        }
    },
    
    async createTask() {
        const employeeId = document.getElementById('task-employee').value;
        const title = document.getElementById('task-title').value;
        const description = document.getElementById('task-description').value;
        const dueDateEl = document.getElementById('task-due-date');
        const dueDate = dueDateEl ? (dueDateEl.value || '') : '';
        const priority = document.getElementById('task-priority').value;

        if (!title.trim()) {
            UTILS.showNotification('لطفاً عنوان وظیفه را وارد کنید', 'error');
            return;
        }

        const localTask = {
            id: UTILS.generateId(),
            title: title.trim(),
            description: description,
            dueDate: dueDate,
            priority: priority,
            status: 'pending',
            createdAt: new Date().toISOString(),
            createdBy: 'mgr001',
            // صوت اختیاری
            voiceMessage: this.recordedVoiceData || null,
            voiceDuration: this.recordedVoiceDuration || null,
            // فایل پیوست اختیاری
            attachedFile: this.selectedVoiceTaskFile || null,
        };

        // ۱. ذخیره فوری در localStorage
        const tasks = this.getemployeeTasks(employeeId);
        tasks.unshift(localTask);
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        tasksData[employeeId] = tasks;
        localStorage.setItem('employee_tasks', JSON.stringify(tasksData));

        // ۲. ذخیره در Supabase در پس‌زمینه (بدون داده‌های بزرگ)
        const sb = this._sb();
        if (sb) {
            const taskForCloud = { ...localTask, voiceMessage: localTask.voiceMessage ? '[voice:local]' : null, attachedFile: null };
            sb.saveEmployeeTask(employeeId, taskForCloud)
              .then(ok => { if (ok) console.log('✅ تسک در Supabase ذخیره شد:', localTask.id); })
              .catch(e => console.warn('⚠️ createTask Supabase خطا:', e.message));
        }

        // reset state
        this.recordedVoiceData = null;
        this.recordedVoiceDuration = null;
        this.selectedVoiceTaskFile = null;

        this.closeModal('new-task-modal');
        this.refreshContent();

        const isOnline = typeof SupabaseConnection !== 'undefined' && SupabaseConnection.isOnline;
        UTILS.showNotification(
            isOnline ? '✅ وظیفه در ابر ذخیره شد' : '📴 وظیفه در حافظه محلی ذخیره شد',
            'success'
        );
        debugLogger('Task created', 'success', localTask);
    },
    
    // ایجاد وظیفه صوتی
    createVoiceTask() {
        const employeeId = document.getElementById('voice-task-employee').value;
        const additionalText = document.getElementById('voice-task-text').value.trim();
        
        if (!this.recordedVoiceData) {
            UTILS.showNotification('لطفاً ابتدا یک پیام صوتی ضبط کنید', 'error');
            return;
        }
        
        const employee = this.getemployees().find(c => c.id === employeeId);
        const tasks = this.getemployeeTasks(employeeId);
        
        let taskTitle = 'پیام صوتی از مدیر';
        if (additionalText) taskTitle += ' + متن';
        if (this.selectedVoiceTaskFile) taskTitle += ' + فایل ضمیمه';
        
        const newTask = {
            id: UTILS.generateId(),
            title: taskTitle,
            description: additionalText || `وظیفه صوتی - ${this.recordedVoiceDuration}`,
            dueDate: '',
            priority: 'high',
            status: 'pending',
            createdAt: new Date().toISOString(),
            createdBy: 'mgr001',
            voiceMessage: this.recordedVoiceData,
            voiceDuration: this.recordedVoiceDuration,
            additionalText: additionalText,
            attachedFile: this.selectedVoiceTaskFile,
            isVoiceTask: true
        };
        
        // ۱. ذخیره فوری در localStorage
        tasks.unshift(newTask);
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        tasksData[employeeId] = tasks;
        localStorage.setItem('employee_tasks', JSON.stringify(tasksData));

        // ۲. ذخیره در Supabase در پس‌زمینه
        const sb = this._sb();
        if (sb) {
            // برای صدا base64 رو کوتاه می‌کنیم — فایل اصلی در localStorage می‌مونه
            const taskForCloud = { ...newTask, voiceMessage: '[voice:local]', attachedFile: null };
            sb.saveEmployeeTask(employeeId, taskForCloud)
              .catch(e => console.warn('⚠️ createVoiceTask Supabase خطا:', e.message));
        }
        
        this.recordedVoiceData = null;
        this.recordedVoiceDuration = null;
        this.selectedVoiceTaskFile = null;
        
        this.closeModal('voice-task-modal');
        this.refreshContent();
        
        let successMessage = `وظیفه صوتی برای ${employee?.name || ''} ارسال شد`;
        if (additionalText && this.selectedVoiceTaskFile) successMessage += ' (شامل متن و فایل ضمیمه)';
        else if (additionalText) successMessage += ' (شامل متن اضافی)';
        else if (this.selectedVoiceTaskFile) successMessage += ' (شامل فایل ضمیمه)';
        
        UTILS.showNotification(successMessage, 'success');
        debugLogger('Voice task created', 'success', newTask);
    },
    
    // ─── مودال ویرایش وظیفه ───────────────────────────────────────
    showEditTaskModal(taskId) {
        if (!this.selectedemployee) return;
        const tasks = this.getemployeeTasks(this.selectedemployee);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const employees = this.getemployees();

        const modalHTML = `
            <div id="edit-task-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg max-w-md w-full p-6">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-edit text-lime-400 ml-2"></i>
                        ویرایش وظیفه
                    </h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">کارمند</label>
                            <select id="edit-task-employee" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                                ${employees.map(c => `
                                    <option value="${c.id}" ${c.id === this.selectedemployee ? 'selected' : ''}>${c.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">عنوان وظیفه</label>
                            <input type="text" id="edit-task-title"
                                   value="${task.title.replace(/"/g, '&quot;')}"
                                   class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                   placeholder="عنوان وظیفه را وارد کنید">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">توضیحات</label>
                            <textarea id="edit-task-description" rows="3"
                                      class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                      placeholder="توضیحات وظیفه...">${task.description || ''}</textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">مهلت انجام</label>
                                <div class="flex flex-col gap-1">
                                    <div class="flex gap-1 mb-1">
                                        <button type="button" onclick="WorkHoursUI.setQuickDate('edit-task-due-date','edit-task-due-date-disp',-2)"
                                                class="flex-1 text-xs bg-slate-600 hover:bg-slate-500 text-gray-300 px-2 py-1 rounded-lg">امروز</button>
                                        <button type="button" onclick="WorkHoursUI.setQuickDate('edit-task-due-date','edit-task-due-date-disp',-1)"
                                                class="flex-1 text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded-lg">فردا</button>
                                        <button type="button" onclick="WorkHoursUI.setQuickDate('edit-task-due-date','edit-task-due-date-disp',0)"
                                                class="flex-1 text-xs bg-lime-700 hover:bg-lime-600 text-white px-2 py-1 rounded-lg">پس فردا</button>
                                    </div>
                                    <input type="hidden" id="edit-task-due-date" value="${task.dueDate || ''}">
                                    <button type="button" id="edit-task-due-date-disp"
                                            onclick="WorkHoursUI.openJalaliPicker('edit-task-due-date','edit-task-due-date-disp')"
                                            class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-right text-white hover:border-lime-500 transition-colors">
                                        <span id="edit-task-due-date-disp-text" class="text-gray-400">${task.dueDate ? this._formatJalaliDate(task.dueDate) : 'انتخاب تاریخ'}</span>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">اولویت</label>
                                <select id="edit-task-priority" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                                    <option value="low"   ${task.priority === 'low'    ? 'selected' : ''}>عادی</option>
                                    <option value="medium"${task.priority === 'medium' ? 'selected' : ''}>متوسط</option>
                                    <option value="high"  ${task.priority === 'high'   ? 'selected' : ''}>فوری</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">وضعیت</label>
                            <select id="edit-task-status" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                                <option value="pending"    ${task.status === 'pending'     ? 'selected' : ''}>در انتظار</option>
                                <option value="in_progress"${task.status === 'in_progress' ? 'selected' : ''}>در حال انجام</option>
                                <option value="completed"  ${task.status === 'completed'   ? 'selected' : ''}>تکمیل شده</option>
                                <option value="approved"   ${task.status === 'approved'    ? 'selected' : ''}>تایید نهایی</option>
                                <option value="rejected"   ${task.status === 'rejected'    ? 'selected' : ''}>رد شده</option>
                                <option value="delayed"    ${task.status === 'delayed'     ? 'selected' : ''}>به تاخیر افتاده</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end space-x-3 space-x-reverse mt-6">
                        <button onclick="TasksModule.closeModal('edit-task-modal')"
                                class="px-4 py-2 text-gray-400 hover:text-white">
                            انصراف
                        </button>
                        <button onclick="TasksModule.saveEditedTask('${taskId}')"
                                class="bg-lime-600 hover:bg-lime-700 text-gray-900 px-4 py-2 rounded-lg font-medium">
                            <i class="fas fa-save ml-2"></i>
                            ذخیره تغییرات
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        // مقداردهی اولیه تاریخ در modal ویرایش
        if (task.dueDate && typeof WorkHoursUI !== 'undefined') {
            // مقدار موجود را در display نشان بده
            const dispText = document.getElementById('edit-task-due-date-disp-text');
            if (dispText) dispText.textContent = this._formatJalaliDate(task.dueDate);
        }
    },

    saveEditedTask(taskId) {
        const newEmployeeId = document.getElementById('edit-task-employee').value;
        const title       = document.getElementById('edit-task-title').value.trim();
        const description = document.getElementById('edit-task-description').value.trim();
        // مقدار شمسی را برای نمایش ذخیره می‌کنیم
        const dueDateEl   = document.getElementById('edit-task-due-date');
        const dueDate     = dueDateEl ? (dueDateEl.value || '') : '';
        const priority    = document.getElementById('edit-task-priority').value;
        const status      = document.getElementById('edit-task-status').value;

        if (!title) {
            UTILS.showNotification('لطفاً عنوان وظیفه را وارد کنید', 'error');
            return;
        }

        const oldEmployeeId = this.selectedemployee;

        // اگر کارمند عوض شده، وظیفه را از کارمند قدیم حذف و به جدید اضافه کن
        if (newEmployeeId !== oldEmployeeId) {
            // حذف از کارمند قدیم
            const oldTasks = this.getemployeeTasks(oldEmployeeId);
            const taskToMove = oldTasks.find(t => t.id === taskId);
            if (!taskToMove) { UTILS.showNotification('وظیفه یافت نشد', 'error'); return; }

            const updatedTask = { ...taskToMove, title, description, dueDate, priority, status, updatedAt: new Date().toISOString() };

            const filteredOld = oldTasks.filter(t => t.id !== taskId);
            const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
            tasksData[oldEmployeeId] = filteredOld;

            // اضافه به کارمند جدید
            const newTasks = this.getemployeeTasks(newEmployeeId);
            newTasks.unshift(updatedTask);
            tasksData[newEmployeeId] = newTasks;
            localStorage.setItem('employee_tasks', JSON.stringify(tasksData));

            this.selectedemployee = newEmployeeId;
        } else {
            // همان کارمند — فقط به‌روزرسانی
            const tasks = this.getemployeeTasks(oldEmployeeId);
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx === -1) { UTILS.showNotification('وظیفه یافت نشد', 'error'); return; }

            tasks[idx] = { ...tasks[idx], title, description, dueDate, priority, status, updatedAt: new Date().toISOString() };

            const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
            tasksData[oldEmployeeId] = tasks;
            localStorage.setItem('employee_tasks', JSON.stringify(tasksData));

            // sync به Supabase
            const sb = this._sb();
            if (sb) {
                sb.saveEmployeeTask(oldEmployeeId, tasks[idx])
                  .catch(e => console.warn('⚠️ saveEditedTask Supabase خطا:', e.message));
            }
        }

        this.closeModal('edit-task-modal');
        this.refreshContent();
        UTILS.showNotification('وظیفه با موفقیت ویرایش شد', 'success');
        debugLogger('Task edited', 'success', { taskId, title, status });
    },

    toggleTaskStatus(taskId) {
        if (!this.selectedemployee) return;
        
        const tasks = this.getemployeeTasks(this.selectedemployee);
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex === -1) return;
        
        const statusOrder = ['pending', 'in_progress', 'completed'];
        const currentIndex = statusOrder.indexOf(tasks[taskIndex].status);
        const newStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
        tasks[taskIndex].status = newStatus;
        
        // ۱. ذخیره در localStorage
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        tasksData[this.selectedemployee] = tasks;
        localStorage.setItem('employee_tasks', JSON.stringify(tasksData));

        // ۲. آپدیت وضعیت در Supabase
        const sb = this._sb();
        if (sb) {
            sb.updateTaskStatus(taskId, this.selectedemployee, newStatus)
              .catch(e => console.warn('⚠️ toggleTaskStatus Supabase خطا:', e.message));
        }

        this.refreshContent();
        UTILS.showNotification('وضعیت وظیفه تغییر کرد', 'success');
    },
    
    deleteTask(taskId) {
        if (!this.selectedemployee) return;
        if (!confirm('آیا از حذف این وظیفه مطمئن هستید؟')) return;
        
        let tasks = this.getemployeeTasks(this.selectedemployee);
        tasks = tasks.filter(t => t.id !== taskId);
        
        // ۱. ذخیره در localStorage
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        tasksData[this.selectedemployee] = tasks;
        localStorage.setItem('employee_tasks', JSON.stringify(tasksData));

        // ۲. حذف از Supabase
        const sb = this._sb();
        if (sb && typeof sb._db === 'function') {
            const client = sb._db();
            if (client) {
                client.from('employee_tasks').delete().eq('id', taskId)
                    .then(({ error }) => {
                        if (error) console.warn('⚠️ deleteTask Supabase خطا:', error.message);
                    });
            }
        }

        this.refreshContent();
        UTILS.showNotification('وظیفه حذف شد', 'success');
    },
    
    sendemployeeMessage() {
        if (!this.selectedemployee) return;
        
        const input = document.getElementById('employee-message-input');
        const text = input.value.trim();
        
        if (!text) return;
        
        const messages = this.getemployeeMessages(this.selectedemployee);
        messages.push({
            id: UTILS.generateId(),
            text: text,
            senderId: 'mgr001',
            senderName: 'مدیر',
            timestamp: new Date().toLocaleString('fa-IR')
        });
        
        this.saveemployeeMessages(this.selectedemployee, messages);
        input.value = '';
        this.switchTab('chat');
        
        // Scroll to bottom
        setTimeout(() => {
            const chatArea = document.getElementById('chat-messages');
            if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
        }, 100);
        
        debugLogger('Message sent', 'success');
    },
    
    uploademployeeFile() {
        if (!this.selectedemployee) return;
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.txt';
        
        fileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const files = this.getemployeeFiles(this.selectedemployee);
            
            // Read file as base64 for small files
            if (file.size < 1024 * 1024) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    files.unshift({
                        id: UTILS.generateId(),
                        name: file.name,
                        size: file.size,
                        data: e.target.result,
                        uploadedAt: new Date().toLocaleString('fa-IR'),
                        uploadedBy: 'mgr001',
                        uploadedByName: 'مدیر'
                    });
                    
                    this.saveemployeeFiles(this.selectedemployee, files);
                    this.switchTab('files');
                    UTILS.showNotification('فایل آپلود شد', 'success');
                };
                reader.readAsDataURL(file);
            } else {
                files.unshift({
                    id: UTILS.generateId(),
                    name: file.name,
                    size: file.size,
                    data: null,
                    uploadedAt: new Date().toLocaleString('fa-IR'),
                    uploadedBy: 'mgr001',
                    uploadedByName: 'مدیر'
                });
                
                this.saveemployeeFiles(this.selectedemployee, files);
                this.switchTab('files');
                UTILS.showNotification('فایل آپلود شد', 'success');
            }
        };
        
        fileInput.click();
    },
    
    downloademployeeFile(fileId) {
        if (!this.selectedemployee) return;
        
        const files = this.getemployeeFiles(this.selectedemployee);
        const file = files.find(f => f.id === fileId);
        
        if (!file) {
            UTILS.showNotification('فایل یافت نشد', 'error');
            return;
        }
        
        if (file.data) {
            const link = document.createElement('a');
            link.href = file.data;
            link.download = file.name;
            link.click();
            UTILS.showNotification('فایل دانلود شد', 'success');
        } else {
            UTILS.showNotification('داده فایل موجود نیست', 'warning');
        }
    },
    
    deleteemployeeFile(fileId) {
        if (!this.selectedemployee) return;
        if (!confirm('آیا از حذف این فایل مطمئن هستید؟')) return;
        
        let files = this.getemployeeFiles(this.selectedemployee);
        files = files.filter(f => f.id !== fileId);
        
        this.saveemployeeFiles(this.selectedemployee, files);
        this.switchTab('files');
        UTILS.showNotification('فایل حذف شد', 'success');
    },
    
    showDailyReportsModal() {
        const employees = this.getemployees();
        let allReports = [];
        
        employees.forEach(emp => {
            const reports = this.getemployeeReports(emp.id);
            reports.forEach(r => {
                allReports.push({ ...r, employeeName: emp.name });
            });
        });
        
        // Sort by date
        allReports.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const modalHTML = `
            <div id="daily-reports-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold text-white">
                            <i class="fas fa-chart-bar text-emerald-400 ml-2"></i>
                            گزارشات روزانه همه کارمند‌ها
                        </h3>
                        <button onclick="TasksModule.closeModal('daily-reports-modal')" class="text-gray-400 hover:text-white">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    ${allReports.length === 0 ? `
                        <div class="text-center py-8">
                            <i class="fas fa-file-alt text-4xl text-gray-500 mb-4"></i>
                            <p class="text-gray-400">هنوز گزارشی ثبت نشده است</p>
                        </div>
                    ` : `
                        <div class="space-y-3">
                            ${allReports.map(report => `
                                <div class="bg-slate-700 rounded-lg p-4">
                                    <div class="flex justify-between items-start mb-2">
                                        <div>
                                            <h5 class="font-medium text-white">${report.employeeName}</h5>
                                            <p class="text-sm text-gray-400">${report.date}</p>
                                        </div>
                                        <span class="text-xs text-gray-400">${report.submittedAt}</span>
                                    </div>
                                    <p class="text-sm text-gray-300">${report.summary}</p>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // مودال اضافه کردن کارمند جدید
    showNewEmployeeModal() {
        const modalHTML = `
            <div id="new-employee-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg max-w-md w-full p-6">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-user-plus text-lime-400 ml-2"></i>
                        اضافه کردن کارمند جدید
                    </h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">نام کامل</label>
                            <input type="text" id="employee-name" 
                                   class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                   placeholder="نام و نام خانوادگی">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">نام کاربری</label>
                            <input type="text" id="employee-username" 
                                   class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                   placeholder="username">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">ایمیل</label>
                            <input type="email" id="employee-email" 
                                   class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                   placeholder="email@example.com">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">نقش</label>
                            <select id="employee-role" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                                <option value="employee">کارمند</option>
                                <option value="doctor">عامل/عامل</option>
                                <option value="translator">مترجم</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">رمز عبور</label>
                            <input type="password" id="employee-password" 
                                   class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                   placeholder="رمز عبور">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">شماره تماس</label>
                            <input type="tel" id="employee-phone" 
                                   class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                   placeholder="09123456789">
                        </div>
                    </div>
                    <div class="flex justify-end space-x-3 space-x-reverse mt-6">
                        <button onclick="TasksModule.closeModal('new-employee-modal')" 
                                class="px-4 py-2 text-gray-400 hover:text-white">
                            انصراف
                        </button>
                        <button onclick="TasksModule.createEmployee()" 
                                class="bg-lime-600 hover:bg-lime-700 text-gray-900 px-4 py-2 rounded-lg">
                            <i class="fas fa-user-plus ml-2"></i>
                            ایجاد کارمند
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // ایجاد کارمند جدید
    createEmployee() {
        const name = document.getElementById('employee-name').value.trim();
        const username = document.getElementById('employee-username').value.trim();
        const email = document.getElementById('employee-email').value.trim();
        const role = document.getElementById('employee-role').value;
        const password = document.getElementById('employee-password').value.trim();
        const phone = document.getElementById('employee-phone').value.trim();
        
        // Validation
        if (!name || !username || !email || !password) {
            UTILS.showNotification('لطفاً تمام فیلدهای ضروری را پر کنید', 'error');
            return;
        }
        
        // Check if username already exists
        const users = DataModule.getUsers();
        if (users.find(u => u.username === username)) {
            UTILS.showNotification('این نام کاربری قبلاً استفاده شده است', 'error');
            return;
        }
        
        // Create new employee
        const newEmployee = {
            id: UTILS.generateId(),
            name: name,
            username: username,
            email: email,
            role: role,
            password: password, // In real app, this should be hashed
            phone: phone,
            active: true,
            createdAt: new Date().toISOString(),
            createdBy: 'mgr001'
        };
        
        // Add to users list
        users.push(newEmployee);
        DataModule.saveUsers(users);
        
        this.closeModal('new-employee-modal');
        
        UTILS.showNotification(`کارمند جدید "${name}" با موفقیت اضافه شد`, 'success');
        debugLogger('New employee created', 'success', newEmployee);
        
        // If it's a employee, refresh the employees list
        if (role === 'employee') {
            this.refreshContent();
        }
    },
    
    // تبدیل تاریخ به نمایش شمسی فارسی
    _formatJalaliDate(dateStr) {
        if (!dateStr) return 'بدون مهلت';
        try {
            const toFa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
            // اگر فرمت شمسی JYYY-MM-DD باشد
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const parts = dateStr.split('-');
                const jY = parseInt(parts[0]);
                // اگر سال شمسی است (۱۴xx)
                if (jY > 1400 && jY < 1500) {
                    const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
                    return `${toFa(parseInt(parts[2]))} ${months[parseInt(parts[1])-1]} ${toFa(jY)}`;
                }
                // اگر میلادی است، تبدیل کن
                if (typeof Jalali !== 'undefined') {
                    const j = Jalali.toJalaali(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
                    const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
                    return `${toFa(j.jd)} ${months[j.jm-1]} ${toFa(j.jy)}`;
                }
            }
            return dateStr;
        } catch(e) {
            return dateStr || 'بدون مهلت';
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.remove();
    },
    
    refreshContent() {
        // Refresh employees list
        const empList = document.getElementById('employees-list');
        if (empList) {
            const employees = this.getemployees();
            empList.innerHTML = employees.map(emp => this.getemployeeCard(emp)).join('');
        }
        
        // Refresh tab content
        const content = document.getElementById('tasks-tab-content');
        if (content) {
            switch(this.activeTab) {
                case 'tasks':
                    content.innerHTML = this.getTasksTabContent();
                    break;
                case 'files':
                    content.innerHTML = this.getFilesTabContent();
                    break;
                case 'reports':
                    content.innerHTML = this.getReportsTabContent();
                    break;
            }
        }
    },
    
    // ایجاد وظیفه از سفارش برای عامل
    createTaskFromOrder(order, agent) {
        try {
            // ایجاد وظیفه جدید از سفارش
            const newTask = {
                id: UTILS.generateId(),
                title: `سفارش: ${order.type || 'نامشخص'}`,
                description: `دانشجو: ${order.studentName || 'نامشخص'}\nدانشگاه: ${order.university || 'نامشخص'}\nمقطع: ${order.degree || 'نامشخص'}\nرشته: ${order.field || 'نامشخص'}\n\nشناسه سفارش: ${order.id}`,
                dueDate: order.deadline || '',
                priority: 'high',
                status: 'pending',
                createdAt: new Date().toISOString(),
                createdBy: 'mgr001',
                orderId: order.id,
                orderType: order.type,
                studentName: order.studentName,
                university: order.university,
                isOrderTask: true,
                voiceMessage: null,
                voiceDuration: null
            };
            
            // ذخیره وظیفه برای عامل
            const tasks = this.getemployeeTasks(agent.id);
            tasks.unshift(newTask);
            this.saveemployeeTasks(agent.id, tasks);
            
            debugLogger(`Task created from order ${order.id} for agent ${agent.name}`, 'success', newTask);
            
            return newTask;
            
        } catch (error) {
            debugLogger('Error creating task from order', 'error', error);
            console.error('Error creating task from order:', error);
            return null;
        }
    }
};

// Add getTasksContent to app controller
window.getTasksContent = function() {
    return TasksModule.getTasksContent();
};

// Export TasksModule to window so other modules can use createTaskFromOrder
window.TasksModule = TasksModule;
