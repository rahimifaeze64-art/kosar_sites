// Employee Module - ماژول کارمند
const EmployeeModule = {
    // Get my tasks content for employee
    getMyTasksContent(userId) {
        const tasks = this.getMyTasks(userId);
        
        return `
            <div class="space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-white">
                        <i class="fas fa-clipboard-check text-indigo-400 ml-2"></i>
                        وظایف من
                    </h2>
                    <div class="flex space-x-3 space-x-reverse">
                        <button onclick="employeeModule.showCreateAgentTaskModal('${userId}')" 
                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
                            <i class="fas fa-plus-circle ml-2"></i>
                            تعریف وظیفه برای عامل
                        </button>
                        <button onclick="employeeModule.showDailyReportModal()" 
                                class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium">
                            <i class="fas fa-file-alt ml-2"></i>
                            ارسال گزارش روزانه
                        </button>
                    </div>
                </div>
                
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">کل وظایف</p>
                                <p class="text-2xl font-bold text-white">${tasks.length}</p>
                            </div>
                            <i class="fas fa-tasks text-3xl text-indigo-400"></i>
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
                
                <!-- Tasks List -->
                <div class="bg-slate-800 rounded-lg shadow-md p-4">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-list text-indigo-400 ml-2"></i>
                        لیست وظایف
                    </h3>
                    
                    ${tasks.length === 0 ? `
                        <div class="text-center py-8">
                            <i class="fas fa-clipboard-check text-4xl text-gray-500 mb-4"></i>
                            <p class="text-gray-400">هنوز وظیفه‌ای برای شما تعریف نشده است</p>
                        </div>
                    ` : `
                        <div class="space-y-0">
                            ${tasks.map((task, index) => `
                                ${this.getTaskCard(task, userId, index + 1)}
                                ${index < tasks.length - 1 ? '<div class="border-b border-gray-600 my-3"></div>' : ''}
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    },
    
    // Get task card for employee
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
        
        // Voice message display
        const voiceHTML = task.voiceMessage ? `
            <div class="mt-3 bg-slate-600 rounded-lg p-3">
                <div class="flex items-center space-x-3 space-x-reverse">
                    <button onclick="employeeModule.playVoice('${task.id}')" 
                            class="w-10 h-10 rounded-full bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-white"
                            id="emp-play-btn-${task.id}">
                        <i class="fas fa-play" id="emp-play-icon-${task.id}"></i>
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
                            <div class="bg-indigo-400 h-1 rounded-full" style="width: 0%" id="emp-progress-${task.id}"></div>
                        </div>
                    </div>
                    <audio id="emp-audio-${task.id}" src="${task.voiceMessage}" class="hidden"></audio>
                </div>
            </div>
        ` : '';
        
        // Additional text display
        const additionalTextHTML = task.additionalText ? `
            <div class="mt-3 bg-slate-600 rounded-lg p-3">
                <div class="flex items-start space-x-2 space-x-reverse">
                    <i class="fas fa-align-left text-blue-400 mt-1"></i>
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
                    <button onclick="employeeModule.downloadTaskFile('${task.id}', '${userId}')" 
                            class="text-indigo-400 hover:text-indigo-300 p-2" title="دانلود فایل">
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
                            <span class="bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ml-2">${taskNumber}</span>
                            <span class="w-3 h-3 rounded-full ${statusColors[task.status] || 'bg-gray-500'} ml-2"></span>
                            <h5 class="font-medium text-white">${task.title}</h5>
                            ${task.priority === 'high' ? '<span class="mr-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded">فوری</span>' : ''}
                        </div>
                        <p class="text-sm text-gray-400 mb-2">${task.description || ''}</p>
                        <div class="flex items-center text-xs text-gray-500 space-x-4 space-x-reverse">
                            <span><i class="fas fa-calendar ml-1"></i>${task.dueDate || 'بدون مهلت'}</span>
                            <span><i class="fas fa-clock ml-1"></i>${new Date(task.createdAt).toLocaleDateString('fa-IR')}</span>
                        </div>
                        ${voiceHTML}
                        ${additionalTextHTML}
                        ${attachedFileHTML}
                    </div>
                    <div class="flex flex-col items-end space-y-2">
                        <span class="text-xs px-2 py-1 rounded ${statusColors[task.status]} text-white">
                            ${statusTexts[task.status] || task.status}
                        </span>
                        <div class="flex space-x-2 space-x-reverse">
                            ${task.status !== 'completed' ? `
                                <button onclick="employeeModule.updateTaskStatus('${task.id}', '${userId}')" 
                                        class="text-green-400 hover:text-green-300 p-1" title="تغییر وضعیت">
                                    <i class="fas fa-check-circle"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Get students list content for employee
    getStudentsContent(userId) {
        const students = this.getAllStudents();
        
        return `
            <div class="space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-white">
                        <i class="fas fa-user-graduate text-indigo-400 ml-2"></i>
                        مدیریت دانشجویان
                    </h2>
                    <div class="flex space-x-3 space-x-reverse">
                        <button onclick="employeeModule.showAddStudentModal();" 
                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                            <i class="fas fa-user-plus ml-2"></i>
                            اضافه کردن دانشجو
                        </button>
                        <a href="flowchart.html" 
                                class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center">
                            <i class="fas fa-project-diagram ml-2"></i>
                            فلوچارت
                        </a>
                        <button onclick="employeeModule.showStepsManagementModal();" 
                                class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                            <i class="fas fa-tasks ml-2"></i>
                            مدیریت مراحل
                        </button>
                        <a href="student-progress-tracking.html" 
                                class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center">
                            <i class="fas fa-th-list ml-2"></i>
                            نمای شیت
                        </a>
                        <a href="student-flowchart.html" 
                                class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center">
                            <i class="fas fa-chart-line ml-2"></i>
                            گرافیک پیشرفته
                        </a>
                    </div>
                </div>
                
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">دانشجویان فعال</p>
                                <p class="text-2xl font-bold text-green-400">${students.filter(s => s.active).length}</p>
                            </div>
                            <i class="fas fa-user-check text-3xl text-green-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">دانشجویان غیرفعال</p>
                                <p class="text-2xl font-bold text-gray-400">${students.filter(s => !s.active).length}</p>
                            </div>
                            <i class="fas fa-user-times text-3xl text-gray-400"></i>
                        </div>
                    </div>
                </div>
                
                <!-- Filter Section -->
                <div class="bg-slate-800 rounded-lg shadow-md p-4">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-filter text-indigo-400 ml-2"></i>
                        فیلترها
                    </h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <!-- Filter Type -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">نوع مسیر</label>
                            <select id="filter-type" onchange="employeeModule.updateFilterStepOptions()" 
                                    class="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="all">همه</option>
                                <option value="educational">مراحل تحصیلی</option>
                                <option value="defense">گردش دفاع</option>
                                <option value="requirements">ملزومات</option>
                            </select>
                        </div>
                        
                        <!-- Filter Step -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">مرحله</label>
                            <select id="filter-step" onchange="employeeModule.applyStudentFilter()" 
                                    class="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="all">همه مراحل</option>
                            </select>
                        </div>
                        
                        <!-- Filter by Empty Fields -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">فیلتر فیلدهای خالی</label>
                            <select id="filter-empty-field" onchange="employeeModule.applyStudentFilter()" 
                                    class="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="all">همه</option>
                                <option value="passportImage">تصویر پاسپورت</option>
                                <option value="administrativeOrder">تصویر امر اداری</option>
                                <option value="studentPhoto">عکس دانشجو</option>
                                <option value="passportNumber">شماره پاسپورت</option>
                                <option value="birthDate">تاریخ تولد</option>
                                <option value="email">ایمیل</option>
                                <option value="phone">شماره تماس</option>
                                <option value="university">دانشگاه</option>
                                <option value="field">رشته تحصیلی</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Filter Results Info -->
                    <div class="mt-4 flex items-center justify-between">
                        <p class="text-sm text-gray-400">
                            <span id="filter-count">${students.length}</span> دانشجو یافت شد
                        </p>
                        <button onclick="employeeModule.clearStudentFilter()" 
                                class="text-sm text-indigo-400 hover:text-indigo-300">
                            <i class="fas fa-times ml-1"></i>
                            پاک کردن فیلتر
                        </button>
                    </div>
                </div>
                
                <!-- Students List -->
                <div class="bg-slate-800 rounded-lg shadow-md p-4">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-list text-indigo-400 ml-2"></i>
                        لیست دانشجویان
                    </h3>
                    
                    <!-- Tabs for Active/Inactive -->
                    <div class="flex space-x-2 space-x-reverse mb-4 border-b border-slate-600">
                        <button onclick="employeeModule.switchStudentListTab('active')" 
                                id="student-list-tab-active"
                                class="px-6 py-3 font-medium border-b-2 border-green-500 text-green-400 transition-all">
                            <i class="fas fa-user-check ml-1"></i>
                            دانشجویان فعال (${students.filter(s => s.active).length})
                        </button>
                        <button onclick="employeeModule.switchStudentListTab('inactive')" 
                                id="student-list-tab-inactive"
                                class="px-6 py-3 font-medium border-b-2 border-transparent text-gray-400 hover:text-gray-300 transition-all">
                            <i class="fas fa-user-graduate ml-1"></i>
                            دانشجویان خاتمه یافته (${students.filter(s => !s.active).length})
                        </button>
                    </div>
                    
                    <!-- Active Students -->
                    <div id="students-list-container-active">
                        ${students.filter(s => s.active).length === 0 ? `
                            <div class="text-center py-8">
                                <i class="fas fa-user-graduate text-4xl text-gray-500 mb-4"></i>
                                <p class="text-gray-400">هنوز دانشجوی فعالی ثبت نشده است</p>
                            </div>
                        ` : `
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                ${students.filter(s => s.active).map(student => this.getStudentCardWithProgress(student)).join('')}
                            </div>
                        `}
                    </div>
                    
                    <!-- Inactive Students -->
                    <div id="students-list-container-inactive" style="display: none;">
                        ${students.filter(s => !s.active).length === 0 ? `
                            <div class="text-center py-8">
                                <i class="fas fa-user-graduate text-4xl text-gray-500 mb-4"></i>
                                <p class="text-gray-400">دانشجوی خاتمه یافته‌ای وجود ندارد</p>
                            </div>
                        ` : `
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                ${students.filter(s => !s.active).map(student => this.getStudentCardWithProgress(student)).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get student card
    getStudentCard(student) {
        return `
            <div class="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-all">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center">
                        <div class="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg ml-3">
                            ${student.name ? student.name.charAt(0) : 'د'}
                        </div>
                        <div>
                            <h4 class="font-bold text-white">${student.name}</h4>
                            <p class="text-sm text-gray-400">${student.studentId || 'بدون شناسه'}</p>
                        </div>
                    </div>
                    <span class="w-3 h-3 rounded-full ${student.active ? 'bg-green-500' : 'bg-gray-500'}"></span>
                </div>
                
                <div class="space-y-2 text-sm text-gray-300 mb-4">
                    <div class="flex items-center">
                        <i class="fas fa-university text-indigo-400 w-5 ml-2"></i>
                        <span>${student.university || 'نامشخص'}</span>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-graduation-cap text-indigo-400 w-5 ml-2"></i>
                        <span>${student.degree || 'نامشخص'} - ${student.field || 'نامشخص'}</span>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-phone text-indigo-400 w-5 ml-2"></i>
                        <span>${student.phone || 'نامشخص'}</span>
                    </div>
                </div>
                
                <button onclick="employeeModule.editStudentProfile('${student.id}')" 
                        class="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                    <i class="fas fa-edit ml-2"></i>
                    ویرایش پروفایل
                </button>
            </div>
        `;
    },
    
    // Get student card with progress info
    getStudentCardWithProgress(student) {
        const educationalSteps = student.educationalSteps || this.getDefaultEducationalSteps();
        const defenseSteps = student.defenseSteps || this.getDefaultDefenseSteps2();
        
        // Find current educational step
        const currentEducationalIndex = educationalSteps.findIndex(s => !s.completed);
        const currentEducationalStep = currentEducationalIndex !== -1 
            ? educationalSteps[currentEducationalIndex] 
            : null;
        const educationalProgress = (educationalSteps.filter(s => s.completed).length / educationalSteps.length) * 100;
        
        // Find current defense step
        const currentDefenseIndex = defenseSteps.findIndex(s => !s.completed);
        const currentDefenseStep = currentDefenseIndex !== -1 
            ? defenseSteps[currentDefenseIndex] 
            : null;
        const defenseProgress = (defenseSteps.filter(s => s.completed).length / defenseSteps.length) * 100;
        
        return `
            <div class="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-all relative group">
                <!-- Delete Button -->
                <button onclick="employeeModule.deleteStudent('${student.id}')" 
                        class="absolute top-2 left-2 bg-red-600 hover:bg-red-700 text-white w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                        title="حذف دانشجو">
                    <i class="fas fa-trash text-sm"></i>
                </button>
                
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center">
                        <div class="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg ml-3">
                            ${student.name ? student.name.charAt(0) : 'د'}
                        </div>
                        <div>
                            <h4 class="font-bold text-white">${student.name}</h4>
                            <p class="text-sm text-gray-400">${student.studentId || 'بدون شناسه'}</p>
                        </div>
                    </div>
                    <span class="w-3 h-3 rounded-full ${student.active ? 'bg-green-500' : 'bg-gray-500'}"></span>
                </div>
                
                <div class="space-y-2 text-sm text-gray-300 mb-4">
                    <div class="flex items-center">
                        <i class="fas fa-university text-indigo-400 w-5 ml-2"></i>
                        <span>${student.university || 'نامشخص'}</span>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-graduation-cap text-indigo-400 w-5 ml-2"></i>
                        <span>${student.degree || 'نامشخص'} - ${student.field || 'نامشخص'}</span>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-phone text-indigo-400 w-5 ml-2"></i>
                        <span>${student.phone || 'نامشخص'}</span>
                    </div>
                </div>
                
                <!-- Progress Info -->
                <div class="space-y-3 mb-4 p-3 bg-slate-800 rounded-lg">
                    <!-- Educational Progress -->
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-xs text-gray-400">
                                <i class="fas fa-book ml-1"></i>
                                مراحل تحصیلی
                            </span>
                            <span class="text-xs font-bold text-green-400">${Math.round(educationalProgress)}%</span>
                        </div>
                        <div class="w-full bg-slate-600 rounded-full h-1.5 mb-1">
                            <div class="bg-green-500 h-1.5 rounded-full" style="width: ${educationalProgress}%"></div>
                        </div>
                        ${currentEducationalStep ? `
                            <p class="text-xs text-gray-400">
                                <i class="fas fa-arrow-left ml-1"></i>
                                مرحله فعلی: <span class="text-green-400 font-medium">${currentEducationalStep.name}</span>
                            </p>
                        ` : `
                            <p class="text-xs text-green-400 font-medium">
                                <i class="fas fa-check-circle ml-1"></i>
                                تکمیل شده
                            </p>
                        `}
                    </div>
                    
                    <!-- Defense Progress -->
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-xs text-gray-400">
                                <i class="fas fa-shield-alt ml-1"></i>
                                گردش دفاع
                            </span>
                            <span class="text-xs font-bold text-blue-400">${Math.round(defenseProgress)}%</span>
                        </div>
                        <div class="w-full bg-slate-600 rounded-full h-1.5 mb-1">
                            <div class="bg-blue-500 h-1.5 rounded-full" style="width: ${defenseProgress}%"></div>
                        </div>
                        ${currentDefenseStep ? `
                            <p class="text-xs text-gray-400">
                                <i class="fas fa-arrow-left ml-1"></i>
                                مرحله فعلی: <span class="text-blue-400 font-medium">${currentDefenseStep.name}</span>
                            </p>
                        ` : `
                            <p class="text-xs text-blue-400 font-medium">
                                <i class="fas fa-check-circle ml-1"></i>
                                تکمیل شده
                            </p>
                        `}
                    </div>
                </div>
                
                <button onclick="employeeModule.editStudentProfile('${student.id}')" 
                        class="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                    <i class="fas fa-edit ml-2"></i>
                    ویرایش پروفایل
                </button>
            </div>
        `;
    },
    
    // Get all students
    getAllStudents() {
        // اول سعی کن از students_data در localStorage بگیری (شامل مراحل تحصیلی)
        try {
            const studentsData = localStorage.getItem('students_data');
            if (studentsData) {
                const parsedData = JSON.parse(studentsData);
                const studentsArray = Object.values(parsedData);
                if (studentsArray && studentsArray.length > 0) {
                    console.log(`✅ Loaded ${studentsArray.length} students from students_data`);
                    return studentsArray;
                }
            }
        } catch (error) {
            console.warn('⚠️ Error loading from students_data:', error);
        }
        
        // اگر students_data خالی بود، از DataModule بگیر
        if (typeof DataModule !== 'undefined' && DataModule.getUsers) {
            const users = DataModule.getUsers().filter(u => u.role === 'student');
            if (users && users.length > 0) {
                console.log(`📊 Loaded ${users.length} students from DataModule`);
                // اگر دانشجویان مراحل تحصیلی ندارن، اضافه کن
                return users.map(student => {
                    if (!student.educationalSteps) {
                        student.educationalSteps = this.getDefaultEducationalSteps();
                    }
                    if (!student.defenseSteps) {
                        student.defenseSteps = this.getDefaultDefenseSteps2();
                    }
                    return student;
                });
            }
        }
        
        // اگر DataModule موجود نبود، از دانشجویان نمونه استفاده کن
        if (typeof SampleStudentsData !== 'undefined') {
            const sampleStudents = SampleStudentsData.getSampleStudents();
            console.log(`📝 Loaded ${sampleStudents.length} sample students`);
            return sampleStudents.map(student => {
                if (!student.educationalSteps) {
                    student.educationalSteps = this.getDefaultEducationalSteps();
                }
                if (!student.defenseSteps) {
                    student.defenseSteps = this.getDefaultDefenseSteps2();
                }
                return student;
            });
        }
        
        // در صورت عدم دسترسی به هر دو، آرایه خالی برگردان
        console.warn('⚠️ No students found from any source');
        return [];
    },
    
    // Get active orders count
    getActiveOrdersCount() {
        if (typeof DataModule !== 'undefined' && DataModule.getOrders) {
            const orders = DataModule.getOrders();
            return orders.filter(o => ['pending', 'in_progress'].includes(o.status)).length;
        }
        return 0;
    },
    
    // Update filter step options based on filter type
    updateFilterStepOptions() {
        const filterType = document.getElementById('filter-type');
        const filterStep = document.getElementById('filter-step');
        
        if (!filterType || !filterStep) {
            console.warn('Filter elements not found');
            return;
        }
        
        const typeValue = filterType.value;
        console.log(`🔄 Updating filter options for type: ${typeValue}`);
        
        if (typeValue === 'all') {
            filterStep.disabled = true;
            filterStep.innerHTML = '<option value="all">همه مراحل</option>';
            console.log('  ✅ Disabled filter-step (type is "all")');
        } else if (typeValue === 'educational') {
            filterStep.disabled = false;
            const educationalSteps = this.getDefaultEducationalSteps();
            filterStep.innerHTML = '<option value="all">همه مراحل</option>' +
                educationalSteps.map((step, index) => 
                    `<option value="${index}">${index + 1}. ${step.name}</option>`
                ).join('') +
                '<option value="completed">✅ تکمیل شده</option>';
            console.log(`  ✅ Loaded ${educationalSteps.length} educational steps`);
        } else if (typeValue === 'defense') {
            filterStep.disabled = false;
            const defenseSteps = this.getDefaultDefenseSteps2();
            filterStep.innerHTML = '<option value="all">همه مراحل</option>' +
                defenseSteps.map((step, index) => 
                    `<option value="${index}">${index + 1}. ${step.name}</option>`
                ).join('') +
                '<option value="completed">✅ تکمیل شده</option>';
            console.log(`  ✅ Loaded ${defenseSteps.length} defense steps`);
        } else if (typeValue === 'requirements') {
            filterStep.disabled = false;
            const requirementsSteps = this.getDefaultRequirementsSteps();
            filterStep.innerHTML = '<option value="all">همه مراحل</option>' +
                requirementsSteps.map((step, index) => 
                    `<option value="${index}">${index + 1}. ${step.name}</option>`
                ).join('') +
                '<option value="completed">✅ تکمیل شده</option>';
            console.log(`  ✅ Loaded ${requirementsSteps.length} requirements steps`);
        }
    },
    
    // Apply student filter
    applyStudentFilter() {
        const filterTypeElement = document.getElementById('filter-type');
        const filterStepElement = document.getElementById('filter-step');
        
        if (!filterTypeElement || !filterStepElement) {
            console.warn('Filter elements not found');
            return;
        }
        
        const filterType = filterTypeElement.value;
        const filterStep = filterStepElement.value;
        
        const students = this.getAllStudents();
        
        console.log(`🔍 Filtering ${students.length} students by type: ${filterType}, step: ${filterStep}`);
        
        let filteredStudents = students;
        
        if (filterType === 'educational' && filterStep !== 'all') {
            const selectedStepIndex = parseInt(filterStep);
            
            filteredStudents = students.filter(s => {
                const steps = s.educationalSteps || this.getDefaultEducationalSteps();
                const currentStepIndex = steps.findIndex(step => !step.completed);
                
                if (filterStep === 'completed') {
                    // All steps completed
                    const allCompleted = currentStepIndex === -1;
                    if (allCompleted) {
                        console.log(`  ✅ ${s.name}: همه مراحل تکمیل شده`);
                    }
                    return allCompleted;
                } else {
                    // Show students who are at or after the selected step
                    // currentStepIndex = -1 means all completed (after all steps)
                    // currentStepIndex >= selectedStepIndex means at or after selected step
                    const matches = currentStepIndex >= selectedStepIndex || currentStepIndex === -1;
                    if (matches) {
                        const currentStep = currentStepIndex === -1 ? 'تکمیل شده' : steps[currentStepIndex]?.name;
                        console.log(`  ✅ ${s.name}: مرحله فعلی ${currentStepIndex} (${currentStep}) >= ${selectedStepIndex}`);
                    }
                    return matches;
                }
            });
        } else if (filterType === 'defense' && filterStep !== 'all') {
            const selectedStepIndex = parseInt(filterStep);
            
            filteredStudents = students.filter(s => {
                const steps = s.defenseSteps || this.getDefaultDefenseSteps2();
                const currentStepIndex = steps.findIndex(step => !step.completed);
                
                if (filterStep === 'completed') {
                    // All steps completed
                    const allCompleted = currentStepIndex === -1;
                    if (allCompleted) {
                        console.log(`  ✅ ${s.name}: همه مراحل دفاع تکمیل شده`);
                    }
                    return allCompleted;
                } else {
                    // Show students who are at or after the selected step
                    const matches = currentStepIndex >= selectedStepIndex || currentStepIndex === -1;
                    if (matches) {
                        const currentStep = currentStepIndex === -1 ? 'تکمیل شده' : steps[currentStepIndex]?.name;
                        console.log(`  ✅ ${s.name}: مرحله فعلی ${currentStepIndex} (${currentStep}) >= ${selectedStepIndex}`);
                    }
                    return matches;
                }
            });
        } else if (filterType === 'requirements' && filterStep !== 'all') {
            const selectedStepIndex = parseInt(filterStep);
            
            filteredStudents = students.filter(s => {
                const steps = s.requirementsSteps || this.getDefaultRequirementsSteps();
                const currentStepIndex = steps.findIndex(step => !step.completed);
                
                if (filterStep === 'completed') {
                    // All steps completed
                    const allCompleted = currentStepIndex === -1;
                    if (allCompleted) {
                        console.log(`  ✅ ${s.name}: همه ملزومات تکمیل شده`);
                    }
                    return allCompleted;
                } else {
                    // Show students who are at or after the selected step
                    const matches = currentStepIndex >= selectedStepIndex || currentStepIndex === -1;
                    if (matches) {
                        const currentStep = currentStepIndex === -1 ? 'تکمیل شده' : steps[currentStepIndex]?.name;
                        console.log(`  ✅ ${s.name}: مرحله فعلی ${currentStepIndex} (${currentStep}) >= ${selectedStepIndex}`);
                    }
                    return matches;
                }
            });
        }
        
        console.log(`📊 Filtered result: ${filteredStudents.length} students`);
        
        // Update the display
        const container = document.getElementById('students-list-container');
        const countSpan = document.getElementById('filter-count');
        
        if (countSpan) {
            countSpan.textContent = filteredStudents.length;
        }
        
        if (container) {
            if (filteredStudents.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-user-graduate text-4xl text-gray-500 mb-4"></i>
                        <p class="text-gray-400">دانشجویی با این فیلتر یافت نشد</p>
                        <p class="text-sm text-gray-500 mt-2">نوع: ${filterType}, مرحله: ${filterStep}</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${filteredStudents.map(student => this.getStudentCardWithProgress(student)).join('')}
                    </div>
                `;
            }
        }
    },
    
    // Clear student filter
    clearStudentFilter() {
        document.getElementById('filter-type').value = 'all';
        document.getElementById('filter-step').value = 'all';
        this.applyStudentFilter();
    },
    
    // Refresh students page
    refreshStudentsPage() {
        const app = Alpine.$data(document.querySelector('[x-data]'));
        if (app && app.currentPage === 'students') {
            const currentPage = app.currentPage;
            app.currentPage = '';
            setTimeout(() => {
                app.currentPage = currentPage;
                UTILS.showNotification('صفحه دانشجویان به‌روزرسانی شد', 'success');
            }, 10);
        }
    },
    
    // Switch student profile tabs
    switchStudentTab(tabName) {
        // Update tab buttons
        ['info', 'defense', 'graduation'].forEach(tab => {
            const tabBtn = document.getElementById(`tab-${tab}`);
            const content = document.getElementById(`content-${tab}`);
            
            if (tab === tabName) {
                tabBtn.classList.remove('border-transparent', 'text-gray-400');
                tabBtn.classList.add('border-indigo-500', 'text-indigo-400');
                content.style.display = 'block';
            } else {
                tabBtn.classList.remove('border-indigo-500', 'text-indigo-400');
                tabBtn.classList.add('border-transparent', 'text-gray-400');
                content.style.display = 'none';
            }
        });
    },
    
    // Get educational steps timeline
    getEducationalStepsTimeline(student) {
        const steps = student.educationalSteps || this.getDefaultEducationalSteps();
        const completedCount = steps.filter(s => s.completed).length;
        const progressPercent = (completedCount / steps.length) * 100;
        
        return `
            <!-- Action Buttons -->
            <div class="flex justify-end space-x-2 space-x-reverse mb-4">
                <button onclick="employeeModule.addNewEducationalStep('${student.id}')" 
                        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    <i class="fas fa-plus ml-2"></i>
                    اضافه کردن مرحله
                </button>
            </div>
            
            <div class="space-y-3">
                ${steps.map((step, index) => `
                    <div class="flex items-center space-x-3 space-x-reverse group bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-all">
                        <!-- Drag Handle -->
                        <div class="flex-shrink-0 cursor-move text-gray-400 hover:text-gray-600" title="جابجایی">
                            <i class="fas fa-grip-vertical"></i>
                        </div>
                        
                        <!-- Step Circle -->
                        <div class="relative flex-shrink-0">
                            <button 
                                onclick="employeeModule.toggleEducationalStep('${student.id}', ${index})"
                                class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
                                    step.completed 
                                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/50' 
                                        : 'bg-gray-300 hover:bg-green-300'
                                }">
                                ${step.completed 
                                    ? '<i class="fas fa-check text-white text-sm"></i>' 
                                    : '<i class="fas fa-circle text-gray-500 text-xs"></i>'
                                }
                            </button>
                        </div>
                        
                        <!-- Step Info -->
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold ${step.completed ? 'text-green-600' : 'text-gray-700'} leading-tight">
                                ${step.name}
                            </p>
                            ${step.date ? `
                                <p class="text-xs text-gray-500 mt-1">
                                    <i class="fas fa-calendar ml-1"></i>${new Date(step.date).toLocaleDateString('fa-IR')}
                                </p>
                            ` : ''}
                        </div>
                        
                        <!-- Action Buttons -->
                        <div class="flex-shrink-0 flex space-x-2 space-x-reverse opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="employeeModule.editEducationalStepName('${student.id}', ${index})" 
                                    class="text-blue-600 hover:text-blue-700 p-2" title="ویرایش نام">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="employeeModule.moveEducationalStepUp('${student.id}', ${index})" 
                                    class="text-indigo-600 hover:text-indigo-700 p-2 ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}" 
                                    title="انتقال به بالا" ${index === 0 ? 'disabled' : ''}>
                                <i class="fas fa-arrow-up"></i>
                            </button>
                            <button onclick="employeeModule.moveEducationalStepDown('${student.id}', ${index})" 
                                    class="text-indigo-600 hover:text-indigo-700 p-2 ${index === steps.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}" 
                                    title="انتقال به پایین" ${index === steps.length - 1 ? 'disabled' : ''}>
                                <i class="fas fa-arrow-down"></i>
                            </button>
                            <button onclick="employeeModule.deleteEducationalStep('${student.id}', ${index})" 
                                    class="text-red-600 hover:text-red-700 p-2" title="حذف">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Get defense steps timeline
    getDefenseStepsTimeline(student) {
        const steps = student.defenseSteps || this.getDefaultDefenseSteps2();
        const completedCount = steps.filter(s => s.completed).length;
        const progressPercent = (completedCount / steps.length) * 100;
        
        return `
            <!-- Action Buttons -->
            <div class="flex justify-end space-x-2 space-x-reverse mb-4">
                <button onclick="employeeModule.addNewDefenseStep('${student.id}')" 
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    <i class="fas fa-plus ml-2"></i>
                    اضافه کردن مرحله
                </button>
            </div>
            
            <div class="space-y-3">
                ${steps.map((step, index) => `
                    <div class="flex items-center space-x-3 space-x-reverse group bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-all">
                        <!-- Drag Handle -->
                        <div class="flex-shrink-0 cursor-move text-gray-400 hover:text-gray-600" title="جابجایی">
                            <i class="fas fa-grip-vertical"></i>
                        </div>
                        
                        <!-- Step Circle -->
                        <div class="relative flex-shrink-0">
                            <button 
                                onclick="employeeModule.toggleDefenseStep('${student.id}', ${index})"
                                class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
                                    step.completed 
                                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/50' 
                                        : 'bg-gray-300 hover:bg-blue-300'
                                }">
                                ${step.completed 
                                    ? '<i class="fas fa-check text-white text-sm"></i>' 
                                    : '<i class="fas fa-circle text-gray-500 text-xs"></i>'
                                }
                            </button>
                        </div>
                        
                        <!-- Step Info -->
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold ${step.completed ? 'text-blue-600' : 'text-gray-700'} leading-tight">
                                ${step.name}
                            </p>
                            ${step.date ? `
                                <p class="text-xs text-gray-500 mt-1">
                                    <i class="fas fa-calendar ml-1"></i>${new Date(step.date).toLocaleDateString('fa-IR')}
                                </p>
                            ` : ''}
                            ${step.name === 'تحدید مناقشه' && (step.defenseDate || step.referee1 || step.referee2) ? `
                                <div class="mt-2 text-xs text-gray-600 space-y-1">
                                    ${step.defenseDate ? `<p><i class="fas fa-calendar-check ml-1"></i>تاریخ دفاع: ${step.defenseDate}</p>` : ''}
                                    ${step.referee1 ? `<p><i class="fas fa-user ml-1"></i>داور اول: ${step.referee1}</p>` : ''}
                                    ${step.referee2 ? `<p><i class="fas fa-user ml-1"></i>داور دوم: ${step.referee2}</p>` : ''}
                                </div>
                            ` : ''}
                        </div>
                        
                        <!-- Action Buttons -->
                        <div class="flex-shrink-0 flex space-x-2 space-x-reverse opacity-0 group-hover:opacity-100 transition-opacity">
                            ${step.name === 'تحدید مناقشه' ? `
                                <button onclick="employeeModule.editDefenseStepDetails('${student.id}', ${index})" 
                                        class="text-purple-600 hover:text-purple-700 p-2" title="ویرایش جزئیات">
                                    <i class="fas fa-cog"></i>
                                </button>
                            ` : ''}
                            <button onclick="employeeModule.editDefenseStepName('${student.id}', ${index})" 
                                    class="text-blue-600 hover:text-blue-700 p-2" title="ویرایش نام">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="employeeModule.moveDefenseStepUp('${student.id}', ${index})" 
                                    class="text-indigo-600 hover:text-indigo-700 p-2 ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}" 
                                    title="انتقال به بالا" ${index === 0 ? 'disabled' : ''}>
                                <i class="fas fa-arrow-up"></i>
                            </button>
                            <button onclick="employeeModule.moveDefenseStepDown('${student.id}', ${index})" 
                                    class="text-indigo-600 hover:text-indigo-700 p-2 ${index === steps.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}" 
                                    title="انتقال به پایین" ${index === steps.length - 1 ? 'disabled' : ''}>
                                <i class="fas fa-arrow-down"></i>
                            </button>
                            <button onclick="employeeModule.deleteDefenseStep('${student.id}', ${index})" 
                                    class="text-red-600 hover:text-red-700 p-2" title="حذف">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Get student info tab content
    getStudentInfoTabContent(student) {
        const educationalSteps = student.educationalSteps || this.getDefaultEducationalSteps();
        const defenseSteps = student.defenseSteps || this.getDefaultDefenseSteps2();
        const requirementsSteps = student.requirementsSteps || this.getDefaultRequirementsSteps();
        
        const educationalCompleted = educationalSteps.filter(s => s.completed).length;
        const educationalPercent = (educationalCompleted / educationalSteps.length) * 100;
        const defenseCompleted = defenseSteps.filter(s => s.completed).length;
        const defensePercent = (defenseCompleted / defenseSteps.length) * 100;
        const requirementsCompleted = requirementsSteps.filter(s => s.completed).length;
        const requirementsPercent = (requirementsCompleted / requirementsSteps.length) * 100;
        
        return `
            <!-- کارت مسیر تحصیلی -->
            <div class="bg-slate-700 rounded-lg p-6 mb-4">
                <h4 class="font-bold text-white text-xl mb-4">
                    <i class="fas fa-route text-indigo-400 ml-2"></i>
                    مسیر تحصیلی
                </h4>
                
                <!-- Tabs Navigation -->
                <div class="flex space-x-2 space-x-reverse mb-6 border-b border-slate-600">
                    <button onclick="employeeModule.switchPathTab('educational', '${student.id}')" 
                            id="path-tab-educational"
                            class="px-6 py-3 font-medium border-b-2 border-indigo-500 text-indigo-400 transition-all">
                        <i class="fas fa-graduation-cap ml-1"></i>
                        مراحل تحصیلی
                        <span class="mr-2 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">${educationalCompleted}/${educationalSteps.length}</span>
                    </button>
                    <button onclick="employeeModule.switchPathTab('defense', '${student.id}')" 
                            id="path-tab-defense"
                            class="px-6 py-3 font-medium border-b-2 border-transparent text-gray-400 hover:text-white transition-all">
                        <i class="fas fa-shield-alt ml-1"></i>
                        گردش دفاع
                        <span class="mr-2 px-2 py-0.5 bg-slate-600 text-white text-xs rounded-full">${defenseCompleted}/${defenseSteps.length}</span>
                    </button>
                    <button onclick="employeeModule.switchPathTab('requirements', '${student.id}')" 
                            id="path-tab-requirements"
                            class="px-6 py-3 font-medium border-b-2 border-transparent text-gray-400 hover:text-white transition-all">
                        <i class="fas fa-tasks ml-1"></i>
                        ملزومات
                        <span class="mr-2 px-2 py-0.5 bg-slate-600 text-white text-xs rounded-full">${requirementsCompleted}/${requirementsSteps.length}</span>
                    </button>
                </div>
                
                <!-- Tab Content: مراحل تحصیلی -->
                <div id="path-content-educational">
                    <div class="mb-6">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-400">پیشرفت کلی:</span>
                            <span class="text-lg font-bold text-indigo-400">${Math.round(educationalPercent)}%</span>
                        </div>
                        <div class="w-full bg-slate-600 rounded-full h-2">
                            <div class="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500" 
                                 style="width: ${educationalPercent}%"></div>
                        </div>
                    </div>
                    ${this.getEducationalStepsTimeline(student)}
                </div>
                
                <!-- Tab Content: گردش دفاع -->
                <div id="path-content-defense" style="display: none;">
                    <div class="mb-6">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-400">پیشرفت کلی:</span>
                            <span class="text-lg font-bold text-blue-400">${Math.round(defensePercent)}%</span>
                        </div>
                        <div class="w-full bg-slate-600 rounded-full h-2">
                            <div class="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500" 
                                 style="width: ${defensePercent}%"></div>
                        </div>
                    </div>
                    ${this.getDefenseStepsTimeline(student)}
                </div>
                
                <!-- Tab Content: ملزومات -->
                <div id="path-content-requirements" style="display: none;">
                    <div class="mb-6">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-400">پیشرفت کلی:</span>
                            <span class="text-lg font-bold text-purple-400">${Math.round(requirementsPercent)}%</span>
                        </div>
                        <div class="w-full bg-slate-600 rounded-full h-2">
                            <div class="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500" 
                                 style="width: ${requirementsPercent}%"></div>
                        </div>
                    </div>
                    ${this.getRequirementsStepsTimeline(student)}
                </div>
                
                <!-- Legend -->
                <div class="flex items-center justify-center space-x-6 space-x-reverse mt-6 pt-4 border-t border-slate-600">
                    <div class="flex items-center">
                        <i class="fas fa-mouse-pointer text-indigo-400 ml-2 text-sm"></i>
                        <span class="text-xs text-gray-400">کلیک روی دایره: تیک زدن</span>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-sticky-note text-purple-400 ml-2 text-sm"></i>
                        <span class="text-xs text-gray-400">کلیک روی عنوان: یادداشت</span>
                    </div>
                </div>
            </div>
            
            <!-- اطلاعات شخصی -->
            <div class="bg-slate-700 rounded-lg p-4">
                <h4 class="font-bold text-white mb-3">
                    <i class="fas fa-user text-indigo-400 ml-2"></i>
                    اطلاعات شخصی
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">نام کامل</label>
                        <input type="text" id="edit-student-name" value="${student.name}"
                               class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">شماره دانشجویی</label>
                        <input type="text" id="edit-student-id" value="${student.studentId || ''}"
                               class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">شماره پاسپورت</label>
                        <input type="text" id="edit-passport" value="${student.passportNumber || ''}"
                               class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">تاریخ تولد</label>
                        <input type="date" id="edit-birthdate" value="${student.birthDate || ''}"
                               class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">جنسیت</label>
                        <select id="edit-gender" class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                            <option value="مرد" ${student.gender === 'مرد' ? 'selected' : ''}>مرد</option>
                            <option value="زن" ${student.gender === 'زن' ? 'selected' : ''}>زن</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">شماره تماس</label>
                        <input type="tel" id="edit-phone" value="${student.phone || ''}"
                               class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                    </div>
                </div>
            </div>
            
            <!-- اطلاعات تحصیلی -->
            <div class="bg-slate-700 rounded-lg p-4">
                <h4 class="font-bold text-white mb-3">
                    <i class="fas fa-graduation-cap text-indigo-400 ml-2"></i>
                    اطلاعات تحصیلی
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">دانشگاه</label>
                        <input type="text" id="edit-university" value="${student.university || ''}"
                               class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">رشته تحصیلی</label>
                        <input type="text" id="edit-field" value="${student.field || ''}"
                               class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">مقطع</label>
                        <select id="edit-degree" class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                            <option value="کارشناسی" ${student.degree === 'کارشناسی' ? 'selected' : ''}>کارشناسی</option>
                            <option value="کارشناسی ارشد" ${student.degree === 'کارشناسی ارشد' ? 'selected' : ''}>کارشناسی ارشد</option>
                            <option value="عاملا" ${student.degree === 'عاملا' ? 'selected' : ''}>عاملا</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">ایمیل</label>
                        <input type="email" id="edit-email" value="${student.email || ''}"
                               class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                    </div>
                </div>
            </div>
            
            <!-- وضعیت -->
            <div class="bg-slate-700 rounded-lg p-4">
                <h4 class="font-bold text-white mb-3">
                    <i class="fas fa-toggle-on text-indigo-400 ml-2"></i>
                    وضعیت
                </h4>
                <label class="flex items-center cursor-pointer">
                    <input type="checkbox" id="edit-active" ${student.active ? 'checked' : ''}
                           class="w-5 h-5 text-indigo-600 bg-slate-600 border-slate-500 rounded">
                    <span class="mr-3 text-white">دانشجو فعال است</span>
                </label>
            </div>
        `;
    },
    
    // Get defense workflow content
    getDefenseWorkflowContent(student) {
        const defenseSteps = student.defenseWorkflow || this.getDefaultDefenseSteps();
        const completedCount = defenseSteps.filter(s => s.completed).length;
        const progressPercent = (completedCount / defenseSteps.length) * 100;
        
        return `
            <div class="bg-slate-700 rounded-lg p-6">
                <div class="flex items-center justify-between mb-6">
                    <h4 class="font-bold text-white text-lg">
                        <i class="fas fa-shield-alt text-blue-400 ml-2"></i>
                        گردش دفاع
                    </h4>
                    <div class="text-left">
                        <p class="text-sm text-gray-400">پیشرفت کلی</p>
                        <p class="text-2xl font-bold text-white">${Math.round(progressPercent)}%</p>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="mb-8">
                    <div class="w-full bg-slate-600 rounded-full h-3">
                        <div class="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500" 
                             style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="flex justify-between mt-2 text-xs text-gray-400">
                        <span>${completedCount} از ${defenseSteps.length} مرحله تکمیل شده</span>
                    </div>
                </div>
                
                <!-- Steps -->
                <div class="space-y-4">
                    ${defenseSteps.map((step, index) => this.getWorkflowStepHTML(step, index, 'defense', student.id)).join('')}
                </div>
            </div>
        `;
    },
    
    // Get graduation workflow content
    getGraduationWorkflowContent(student) {
        const graduationSteps = student.graduationWorkflow || this.getDefaultGraduationSteps();
        const completedCount = graduationSteps.filter(s => s.completed).length;
        const progressPercent = (completedCount / graduationSteps.length) * 100;
        
        return `
            <div class="bg-slate-700 rounded-lg p-6">
                <div class="flex items-center justify-between mb-6">
                    <h4 class="font-bold text-white text-lg">
                        <i class="fas fa-graduation-cap text-green-400 ml-2"></i>
                        گردش فارغ‌التحصیلی
                    </h4>
                    <div class="text-left">
                        <p class="text-sm text-gray-400">پیشرفت کلی</p>
                        <p class="text-2xl font-bold text-white">${Math.round(progressPercent)}%</p>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="mb-8">
                    <div class="w-full bg-slate-600 rounded-full h-3">
                        <div class="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500" 
                             style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="flex justify-between mt-2 text-xs text-gray-400">
                        <span>${completedCount} از ${graduationSteps.length} مرحله تکمیل شده</span>
                    </div>
                </div>
                
                <!-- Steps -->
                <div class="space-y-4">
                    ${graduationSteps.map((step, index) => this.getWorkflowStepHTML(step, index, 'graduation', student.id)).join('')}
                </div>
            </div>
        `;
    },
    
    // Get workflow step HTML
    getWorkflowStepHTML(step, index, workflowType, studentId) {
        const isCompleted = step.completed;
        const colorClass = workflowType === 'defense' ? 'blue' : 'green';
        
        return `
            <div class="flex items-center space-x-4 space-x-reverse p-4 bg-slate-600 rounded-lg hover:bg-slate-500 transition-all">
                <div class="flex-shrink-0">
                    <button onclick="employeeModule.toggleWorkflowStep('${studentId}', '${workflowType}', ${index})"
                            class="w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                isCompleted 
                                ? `bg-${colorClass}-500 text-white` 
                                : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                            }">
                        ${isCompleted 
                            ? '<i class="fas fa-check text-xl"></i>' 
                            : `<span class="font-bold">${index + 1}</span>`
                        }
                    </button>
                </div>
                <div class="flex-1">
                    <h5 class="font-medium text-white">${step.name}</h5>
                    ${step.completedAt ? `
                        <p class="text-xs text-gray-400 mt-1">
                            <i class="fas fa-calendar-check ml-1"></i>
                            تکمیل شده: ${new Date(step.completedAt).toLocaleDateString('fa-IR')}
                        </p>
                    ` : ''}
                </div>
                <div class="flex-shrink-0">
                    ${isCompleted 
                        ? '<span class="text-xs px-3 py-1 bg-green-500 text-white rounded-full">تکمیل شده</span>'
                        : '<span class="text-xs px-3 py-1 bg-yellow-500 text-white rounded-full">در انتظار</span>'
                    }
                </div>
            </div>
        `;
    },
    
    // Toggle workflow step
    toggleWorkflowStep(studentId, workflowType, stepIndex) {
        const students = this.getAllStudents();
        const studentIndex = students.findIndex(s => s.id === studentId);
        
        if (studentIndex === -1) return;
        
        const student = students[studentIndex];
        const workflowKey = workflowType === 'defense' ? 'defenseWorkflow' : 'graduationWorkflow';
        
        if (!student[workflowKey]) {
            student[workflowKey] = workflowType === 'defense' 
                ? this.getDefaultDefenseSteps() 
                : this.getDefaultGraduationSteps();
        }
        
        const step = student[workflowKey][stepIndex];
        step.completed = !step.completed;
        step.completedAt = step.completed ? new Date().toISOString() : null;
        
        // Save to localStorage
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        studentsData[studentId] = student;
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        // ارسال رویداد به‌روزرسانی دانشجو
        if (typeof RealtimeEvents !== 'undefined') {
            RealtimeEvents.emit(RealtimeEvents.EVENTS.STUDENT_UPDATED, { studentId, student });
            RealtimeEvents.emit(RealtimeEvents.EVENTS.STUDENTS_CHANGED, { students: studentsData });
        }
        
        // Refresh the workflow content
        const contentDiv = document.getElementById(`content-${workflowType}`);
        if (contentDiv) {
            contentDiv.innerHTML = workflowType === 'defense' 
                ? this.getDefenseWorkflowContent(student)
                : this.getGraduationWorkflowContent(student);
        }
        
        UTILS.showNotification(
            step.completed ? 'مرحله تکمیل شد' : 'مرحله به حالت در انتظار برگشت',
            'success'
        );
    },
    
    // Switch path tab
    switchPathTab(tabName, studentId) {
        // Update tab buttons
        ['educational', 'defense'].forEach(tab => {
            const tabBtn = document.getElementById(`path-tab-${tab}`);
            const content = document.getElementById(`path-content-${tab}`);
            
            if (tab === tabName) {
                tabBtn.classList.remove('border-transparent', 'text-gray-400');
                tabBtn.classList.add('border-indigo-500', 'text-indigo-400');
                content.style.display = 'block';
            } else {
                tabBtn.classList.remove('border-indigo-500', 'text-indigo-400');
                tabBtn.classList.add('border-transparent', 'text-gray-400');
                content.style.display = 'none';
            }
        });
    },
    
    // Get default defense steps 2 (for defense workflow)
    getDefaultDefenseSteps2() {
        // Check if custom steps exist in localStorage
        const customSteps = localStorage.getItem('custom_defense_steps');
        if (customSteps) {
            try {
                return JSON.parse(customSteps);
            } catch (e) {
                console.error('Error parsing custom defense steps:', e);
            }
        }
        
        // Return default steps
        return [
            { name: 'لوح', completed: false, date: null, notes: '' },
            { name: 'پوستر', completed: false, date: null, notes: '' },
            { name: 'نسخ', completed: false, date: null, notes: '' },
            { name: 'ثبت عنوان', completed: false, date: null, notes: '' },
            { name: 'بارگزاری', completed: false, date: null, notes: '' },
            { name: 'استاد', completed: false, date: null, notes: '' },
            { name: 'مشابهت', completed: false, date: null, notes: '' },
            { name: 'مدیر گروه', completed: false, date: null, notes: '' },
            { name: 'معاون', completed: false, date: null, notes: '' },
            { name: 'تحدید مناقشه', completed: false, date: null, notes: '', defenseDate: '', referee1: '', referee2: '' }
        ];
    },
    
    // Toggle defense step
    toggleDefenseStep(studentId, stepIndex) {
        // Get fresh data from localStorage
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        let student = studentsData[studentId];
        
        // If not in localStorage, get from getAllStudents
        if (!student) {
            const students = this.getAllStudents();
            student = students.find(s => s.id === studentId);
            if (!student) return;
        }
        
        // Initialize defense steps if not exist
        if (!student.defenseSteps) {
            student.defenseSteps = this.getDefaultDefenseSteps2();
        }
        
        const step = student.defenseSteps[stepIndex];
        step.completed = !step.completed;
        step.date = step.completed ? new Date().toLocaleDateString('fa-IR') : null;
        
        // Save to localStorage
        studentsData[studentId] = student;
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        // Refresh the defense tab content (works in both modal and main view)
        const defenseContentDiv = document.getElementById('path-content-defense');
        if (defenseContentDiv) {
            defenseContentDiv.innerHTML = this.getDefenseStepsTimeline(student);
        }
        
        // Also try to refresh main content-info if exists
        const contentDiv = document.getElementById('content-info');
        if (contentDiv) {
            contentDiv.innerHTML = this.getStudentInfoTabContent(student);
            this.switchPathTab('defense', studentId);
        }
        
        UTILS.showNotification(
            step.completed ? `✓ ${step.name} تکمیل شد` : `${step.name} به حالت در انتظار برگشت`,
            'success'
        );
    },
    
    // Show defense step details modal
    showDefenseStepDetailsModal(studentId, stepIndex) {
        const students = this.getAllStudents();
        const student = students.find(s => s.id === studentId);
        
        if (!student) return;
        
        if (!student.defenseSteps) {
            student.defenseSteps = this.getDefaultDefenseSteps2();
        }
        
        const step = student.defenseSteps[stepIndex];
        
        const modalHTML = `
            <div id="defense-step-details-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg max-w-lg w-full">
                    <div class="p-6 border-b border-slate-700">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-bold text-white">
                                <i class="fas fa-shield-alt text-blue-400 ml-2"></i>
                                ${step.name}
                            </h3>
                            <button onclick="employeeModule.closeModal('defense-step-details-modal')" 
                                    class="text-gray-400 hover:text-white">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-6 space-y-4">
                        <!-- وضعیت -->
                        <div class="flex items-center justify-between bg-slate-700 rounded-lg p-4">
                            <span class="text-gray-300">وضعیت:</span>
                            <span class="px-3 py-1 rounded-full text-sm font-bold ${
                                step.completed 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-yellow-500 text-white'
                            }">
                                ${step.completed ? 'تکمیل شده ✓' : 'در انتظار'}
                            </span>
                        </div>
                        
                        ${step.date ? `
                            <div class="flex items-center justify-between bg-slate-700 rounded-lg p-4">
                                <span class="text-gray-300">تاریخ تکمیل:</span>
                                <span class="text-white font-bold">
                                    <i class="fas fa-calendar ml-2 text-blue-400"></i>
                                    ${step.date}
                                </span>
                            </div>
                        ` : ''}
                        
                        <!-- یادداشت -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                <i class="fas fa-edit text-blue-400 ml-1"></i>
                                یادداشت (اختیاری)
                            </label>
                            <textarea id="defense-step-notes-input" 
                                      rows="5"
                                      placeholder="توضیحات، یادداشت‌ها یا نکات مربوط به این مرحله را وارد کنید..."
                                      class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            >${step.notes || ''}</textarea>
                            <p class="text-xs text-gray-500 mt-2">
                                <i class="fas fa-info-circle ml-1"></i>
                                این یادداشت فقط برای شما قابل مشاهده است
                            </p>
                        </div>
                    </div>
                    
                    <div class="p-6 border-t border-slate-700 flex justify-end space-x-3 space-x-reverse">
                        <button onclick="employeeModule.closeModal('defense-step-details-modal')" 
                                class="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium">
                            <i class="fas fa-times ml-2"></i>
                            انصراف
                        </button>
                        <button onclick="employeeModule.saveDefenseStepNotes('${studentId}', ${stepIndex})" 
                                class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
                            <i class="fas fa-save ml-2"></i>
                            ذخیره یادداشت
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Focus on textarea
        setTimeout(() => {
            const textarea = document.getElementById('defense-step-notes-input');
            if (textarea) textarea.focus();
        }, 100);
    },
    
    // Save defense step notes
    saveDefenseStepNotes(studentId, stepIndex) {
        // Get fresh data from localStorage
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        let student = studentsData[studentId];
        
        // If not in localStorage, get from getAllStudents
        if (!student) {
            const students = this.getAllStudents();
            student = students.find(s => s.id === studentId);
            if (!student) return;
        }
        
        if (!student.defenseSteps) {
            student.defenseSteps = this.getDefaultDefenseSteps2();
        }
        
        const notes = document.getElementById('defense-step-notes-input').value.trim();
        student.defenseSteps[stepIndex].notes = notes;
        
        // Save to localStorage
        studentsData[studentId] = student;
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        // Close modal
        this.closeModal('defense-step-details-modal');
        
        // Refresh the defense tab content (works in both modal and main view)
        const defenseContentDiv = document.getElementById('path-content-defense');
        if (defenseContentDiv) {
            defenseContentDiv.innerHTML = this.getDefenseStepsTimeline(student);
        }
        
        // Also try to refresh main content-info if exists
        const contentDiv = document.getElementById('content-info');
        if (contentDiv) {
            contentDiv.innerHTML = this.getStudentInfoTabContent(student);
            this.switchPathTab('defense', studentId);
        }
        
        UTILS.showNotification(
            notes ? 'یادداشت ذخیره شد' : 'یادداشت حذف شد',
            'success'
        );
    },
    
    // Toggle educational step
    toggleEducationalStep(studentId, stepIndex) {
        // Get fresh data from localStorage
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        let student = studentsData[studentId];
        
        // If not in localStorage, get from getAllStudents
        if (!student) {
            const students = this.getAllStudents();
            student = students.find(s => s.id === studentId);
            if (!student) return;
        }
        
        // Initialize educational steps if not exist
        if (!student.educationalSteps) {
            student.educationalSteps = this.getDefaultEducationalSteps();
        }
        
        const step = student.educationalSteps[stepIndex];
        step.completed = !step.completed;
        step.date = step.completed ? new Date().toLocaleDateString('fa-IR') : null;
        
        // Save to localStorage
        studentsData[studentId] = student;
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        // Refresh the educational tab content (works in both modal and main view)
        const educationalContentDiv = document.getElementById('path-content-educational');
        if (educationalContentDiv) {
            educationalContentDiv.innerHTML = this.getEducationalStepsTimeline(student);
        }
        
        // Also try to refresh main content-info if exists
        const contentDiv = document.getElementById('content-info');
        if (contentDiv) {
            contentDiv.innerHTML = this.getStudentInfoTabContent(student);
            this.switchPathTab('educational', studentId);
        }
        
        UTILS.showNotification(
            step.completed ? `✓ ${step.name} تکمیل شد` : `${step.name} به حالت در انتظار برگشت`,
            'success'
        );
    },
    
    // Show step details modal
    showStepDetailsModal(studentId, stepIndex) {
        const students = this.getAllStudents();
        const student = students.find(s => s.id === studentId);
        
        if (!student) return;
        
        if (!student.educationalSteps) {
            student.educationalSteps = this.getDefaultEducationalSteps();
        }
        
        const step = student.educationalSteps[stepIndex];
        
        const modalHTML = `
            <div id="step-details-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg max-w-lg w-full">
                    <div class="p-6 border-b border-slate-700">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-bold text-white">
                                <i class="fas fa-sticky-note text-indigo-400 ml-2"></i>
                                ${step.name}
                            </h3>
                            <button onclick="employeeModule.closeModal('step-details-modal')" 
                                    class="text-gray-400 hover:text-white">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-6 space-y-4">
                        <!-- وضعیت -->
                        <div class="flex items-center justify-between bg-slate-700 rounded-lg p-4">
                            <span class="text-gray-300">وضعیت:</span>
                            <span class="px-3 py-1 rounded-full text-sm font-bold ${
                                step.completed 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-yellow-500 text-white'
                            }">
                                ${step.completed ? 'تکمیل شده ✓' : 'در انتظار'}
                            </span>
                        </div>
                        
                        ${step.date ? `
                            <div class="flex items-center justify-between bg-slate-700 rounded-lg p-4">
                                <span class="text-gray-300">تاریخ تکمیل:</span>
                                <span class="text-white font-bold">
                                    <i class="fas fa-calendar ml-2 text-indigo-400"></i>
                                    ${step.date}
                                </span>
                            </div>
                        ` : ''}
                        
                        <!-- یادداشت -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                <i class="fas fa-edit text-indigo-400 ml-1"></i>
                                یادداشت (اختیاری)
                            </label>
                            <textarea id="step-notes-input" 
                                      rows="5"
                                      placeholder="توضیحات، یادداشت‌ها یا نکات مربوط به این مرحله را وارد کنید..."
                                      class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white resize-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >${step.notes || ''}</textarea>
                            <p class="text-xs text-gray-500 mt-2">
                                <i class="fas fa-info-circle ml-1"></i>
                                این یادداشت فقط برای شما قابل مشاهده است
                            </p>
                        </div>
                    </div>
                    
                    <div class="p-6 border-t border-slate-700 flex justify-end space-x-3 space-x-reverse">
                        <button onclick="employeeModule.closeModal('step-details-modal')" 
                                class="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium">
                            <i class="fas fa-times ml-2"></i>
                            انصراف
                        </button>
                        <button onclick="employeeModule.saveStepNotes('${studentId}', ${stepIndex})" 
                                class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium">
                            <i class="fas fa-save ml-2"></i>
                            ذخیره یادداشت
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Focus on textarea
        setTimeout(() => {
            const textarea = document.getElementById('step-notes-input');
            if (textarea) textarea.focus();
        }, 100);
    },
    
    // Save step notes
    saveStepNotes(studentId, stepIndex) {
        // Get fresh data from localStorage
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        let student = studentsData[studentId];
        
        // If not in localStorage, get from getAllStudents
        if (!student) {
            const students = this.getAllStudents();
            student = students.find(s => s.id === studentId);
            if (!student) return;
        }
        
        if (!student.educationalSteps) {
            student.educationalSteps = this.getDefaultEducationalSteps();
        }
        
        const notes = document.getElementById('step-notes-input').value.trim();
        student.educationalSteps[stepIndex].notes = notes;
        
        // Save to localStorage
        studentsData[studentId] = student;
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        // Close modal
        this.closeModal('step-details-modal');
        
        // Refresh the educational tab content (works in both modal and main view)
        const educationalContentDiv = document.getElementById('path-content-educational');
        if (educationalContentDiv) {
            educationalContentDiv.innerHTML = this.getEducationalStepsTimeline(student);
        }
        
        // Also try to refresh main content-info if exists
        const contentDiv = document.getElementById('content-info');
        if (contentDiv) {
            contentDiv.innerHTML = this.getStudentInfoTabContent(student);
            this.switchPathTab('educational', studentId);
        }
        
        UTILS.showNotification(
            notes ? 'یادداشت ذخیره شد' : 'یادداشت حذف شد',
            'success'
        );
    },
    
    // Get default defense steps
    getDefaultDefenseSteps() {
        return [
            { name: 'ثبت درخواست دفاع', completed: false, completedAt: null },
            { name: 'تایید استاد راهنما', completed: false, completedAt: null },
            { name: 'تعیین اساتید داور', completed: false, completedAt: null },
            { name: 'ارسال رساله به داوران', completed: false, completedAt: null },
            { name: 'دریافت نظرات داوران', completed: false, completedAt: null },
            { name: 'تعیین تاریخ دفاع', completed: false, completedAt: null },
            { name: 'برگزاری جلسه دفاع', completed: false, completedAt: null },
            { name: 'اعلام نتیجه دفاع', completed: false, completedAt: null }
        ];
    },
    
    // Get default educational steps
    getDefaultEducationalSteps() {
        // Check if custom steps exist in localStorage
        const customSteps = localStorage.getItem('custom_educational_steps');
        if (customSteps) {
            try {
                return JSON.parse(customSteps);
            } catch (e) {
                console.error('Error parsing custom educational steps:', e);
            }
        }
        
        // Return default steps
        return [
            { name: 'محضر و اصالت', completed: false, date: null, notes: '' },
            { name: 'تنزیل نمره', completed: false, date: null, notes: '' },
            { name: 'تعدیل', completed: false, date: null, notes: '' },
            { name: 'ایرانداک خطه', completed: false, date: null, notes: '' },
            { name: 'ایرانداک رساله', completed: false, date: null, notes: '' },
            { name: 'مدرک لغت', completed: false, date: null, notes: '' },
            { name: 'ایجاد کردش', completed: false, date: null, notes: '' },
            { name: 'حاتمی', completed: false, date: null, notes: '' },
            { name: 'بارگزاری لغت', completed: false, date: null, notes: '' },
            { name: 'آزفا', completed: false, date: null, notes: '' },
            { name: 'ترجمه به اسماعیلی', completed: false, date: null, notes: '' },
            { name: 'دادگر', completed: false, date: null, notes: '' },
            { name: 'ارسال کد به تهران', completed: false, date: null, notes: '' },
            { name: 'وثیقه', completed: false, date: null, notes: '' },
            { name: 'تصدیق', completed: false, date: null, notes: '' },
            { name: 'تنضید', completed: false, date: null, notes: '' },
            { name: 'استلال', completed: false, date: null, notes: '' },
            { name: 'تجلید', completed: false, date: null, notes: '' },
            { name: 'ختم تجلید', completed: false, date: null, notes: '' },
            { name: 'قطعی', completed: false, date: null, notes: '' },
            { name: 'مدارک سابقه', completed: false, date: null, notes: '' },
            { name: 'ارسال', completed: false, date: null, notes: '' }
        ];
    },
    
    // Get default graduation steps
    getDefaultGraduationSteps() {
        return [
            { name: 'تکمیل واحدهای درسی', completed: false, completedAt: null },
            { name: 'تایید نهایی رساله', completed: false, completedAt: null },
            { name: 'ثبت درخواست فارغ‌التحصیلی', completed: false, completedAt: null },
            { name: 'بررسی مدارک توسط آموزش', completed: false, completedAt: null },
            { name: 'تسویه حساب مالی', completed: false, completedAt: null },
            { name: 'تسویه حساب کتابخانه', completed: false, completedAt: null },
            { name: 'صدور گواهی موقت', completed: false, completedAt: null },
            { name: 'صدور مدرک فارغ‌التحصیلی', completed: false, completedAt: null }
        ];
    },
    
    // Get agent tasks management content for employee
    getAgentTasksManagementContent(employeeId) {
        const raw = this.getemployeeAgentTasks(employeeId);
        const tasks = Array.isArray(raw) ? raw : [];
        
        // Group tasks by status
        const pendingTasks = tasks.filter(t => t.status === 'pending');
        const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
        const completedTasks = tasks.filter(t => t.status === 'completed');
        
        return `
            <div class="space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-white">
                        <i class="fas fa-tasks text-purple-400 ml-2"></i>
                        وظایف عامل‌ها
                    </h2>
                    <button onclick="employeeModule.showCreateAgentTaskModal('${employeeId}')" 
                            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
                        <i class="fas fa-plus-circle ml-2"></i>
                        تعریف وظیفه جدید
                    </button>
                </div>
                
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">کل وظایف</p>
                                <p class="text-2xl font-bold text-white">${tasks.length}</p>
                            </div>
                            <i class="fas fa-clipboard-list text-3xl text-purple-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">در انتظار</p>
                                <p class="text-2xl font-bold text-yellow-400">${pendingTasks.length}</p>
                            </div>
                            <i class="fas fa-clock text-3xl text-yellow-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">در حال انجام</p>
                                <p class="text-2xl font-bold text-blue-400">${inProgressTasks.length}</p>
                            </div>
                            <i class="fas fa-spinner text-3xl text-blue-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">تکمیل شده</p>
                                <p class="text-2xl font-bold text-green-400">${completedTasks.length}</p>
                            </div>
                            <i class="fas fa-check-circle text-3xl text-green-400"></i>
                        </div>
                    </div>
                </div>
                
                <!-- Filter Tabs -->
                <div class="bg-slate-800 rounded-lg p-2">
                    <div class="flex space-x-2 space-x-reverse">
                        <button onclick="employeeModule.filterAgentTasks('all', '${employeeId}')" 
                                id="filter-all"
                                class="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium">
                            همه (${tasks.length})
                        </button>
                        <button onclick="employeeModule.filterAgentTasks('pending', '${employeeId}')" 
                                id="filter-pending"
                                class="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600 font-medium">
                            در انتظار (${pendingTasks.length})
                        </button>
                        <button onclick="employeeModule.filterAgentTasks('in_progress', '${employeeId}')" 
                                id="filter-in_progress"
                                class="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600 font-medium">
                            در حال انجام (${inProgressTasks.length})
                        </button>
                        <button onclick="employeeModule.filterAgentTasks('completed', '${employeeId}')" 
                                id="filter-completed"
                                class="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600 font-medium">
                            تکمیل شده (${completedTasks.length})
                        </button>
                    </div>
                </div>
                
                <!-- Tasks Grid -->
                <div class="bg-slate-800 rounded-lg shadow-md p-4">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-list text-purple-400 ml-2"></i>
                        لیست وظایف تخصیص داده شده
                    </h3>
                    
                    <div id="agent-tasks-grid">
                        ${tasks.length === 0 ? `
                            <div class="text-center py-8">
                                <i class="fas fa-clipboard-list text-4xl text-gray-500 mb-4"></i>
                                <p class="text-gray-400">هنوز وظیفه‌ای برای عامل‌ها تعریف نکرده‌اید</p>
                                <button onclick="employeeModule.showCreateAgentTaskModal('${employeeId}')" 
                                        class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
                                    <i class="fas fa-plus-circle ml-2"></i>
                                    تعریف اولین وظیفه
                                </button>
                            </div>
                        ` : `
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-filter="all">
                                ${tasks.map((task, index) => this.getemployeeAgentTaskCard(task, employeeId, index + 1)).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get employee's agent tasks
    getemployeeAgentTasks(employeeId) {
        const agentTasksKey = 'agent_tasks';
        let allTasks;
        try {
            const raw = localStorage.getItem(agentTasksKey);
            const parsed = JSON.parse(raw || '[]');
            allTasks = Array.isArray(parsed) ? parsed : [];
        } catch(e) {
            allTasks = [];
        }
        return allTasks.filter(t => t.employeeId === employeeId);
    },
    
    // Get employee agent task card
    getemployeeAgentTaskCard(task, employeeId, taskNumber) {
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
        
        const statusIcons = {
            'pending': 'fa-clock',
            'in_progress': 'fa-spinner fa-spin',
            'completed': 'fa-check-circle'
        };
        
        const priorityBadge = task.priority === 'high' ? 
            '<span class="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full font-bold">فوری</span>' : '';
        
        const attachedFileHTML = task.attachedFile ? `
            <div class="mt-3 bg-slate-600 rounded-lg p-2">
                <div class="flex items-center space-x-2 space-x-reverse">
                    <i class="fas fa-paperclip text-purple-400"></i>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs text-white truncate">${task.attachedFile.name}</p>
                    </div>
                    <button onclick="employeeModule.downloadAgentTaskFile('${task.id}')" 
                            class="text-indigo-400 hover:text-indigo-300 p-1" title="دانلود">
                        <i class="fas fa-download text-sm"></i>
                    </button>
                </div>
            </div>
        ` : '';
        
        // Calculate time remaining
        const timeRemaining = this.calculateTimeRemaining(task.deadline);
        
        // Status change notification
        const statusChangeHTML = task.statusChangedAt ? `
            <div class="mt-2 text-xs ${task.status === 'completed' ? 'text-green-400' : 'text-blue-400'}">
                <i class="fas fa-info-circle ml-1"></i>
                ${task.status === 'in_progress' ? 'عامل کار را شروع کرد' : 'عامل وظیفه را تکمیل کرد'}
                - ${new Date(task.statusChangedAt).toLocaleString('fa-IR')}
            </div>
        ` : '';
        
        return `
            <div class="bg-slate-700 rounded-lg p-4 hover:shadow-xl transition-all relative" data-status="${task.status}">
                ${priorityBadge}
                
                <!-- Task Header -->
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center">
                        <span class="bg-purple-600 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center ml-2">${taskNumber}</span>
                        <span class="w-3 h-3 rounded-full ${statusColors[task.status] || 'bg-gray-500'}"></span>
                    </div>
                    <span class="text-xs px-2 py-1 rounded ${statusColors[task.status]} text-white flex items-center">
                        <i class="fas ${statusIcons[task.status]} ml-1"></i>
                        ${statusTexts[task.status] || task.status}
                    </span>
                </div>
                
                <!-- Task Title -->
                <h5 class="font-bold text-white mb-2 text-lg">${task.title}</h5>
                
                <!-- Task Description -->
                <p class="text-sm text-gray-400 mb-3 line-clamp-2">${task.description || ''}</p>
                
                <!-- Agent and Student Info -->
                <div class="space-y-2 text-xs text-gray-400 mb-3 pb-3 border-b border-slate-600">
                    <div class="flex items-center">
                        <i class="fas fa-user-shield text-purple-400 ml-1 w-4"></i>
                        <span>عامل: ${task.agentName}</span>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-user-graduate text-indigo-400 ml-1 w-4"></i>
                        <span>دانشجو: ${task.studentName}</span>
                    </div>
                </div>
                
                ${statusChangeHTML}
                
                <!-- Countdown Timer -->
                ${task.status !== 'completed' ? `
                    <div class="mb-3">
                        <p class="text-xs text-gray-400 mb-2">
                            <i class="fas fa-hourglass-half ml-1"></i>
                            زمان باقی‌مانده:
                        </p>
                        <div class="grid grid-cols-2 gap-2" id="emp-timer-${task.id}">
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
                ` : `
                    <div class="mb-3 bg-green-500 bg-opacity-20 border border-green-500 rounded-lg p-3 text-center">
                        <i class="fas fa-check-double text-green-400 text-2xl mb-2"></i>
                        <p class="text-sm text-green-400 font-bold">وظیفه تکمیل شده</p>
                        ${task.completedAt ? `
                            <p class="text-xs text-gray-400 mt-1">
                                ${new Date(task.completedAt).toLocaleString('fa-IR')}
                            </p>
                        ` : ''}
                    </div>
                `}
                
                <!-- Deadline -->
                <div class="text-xs text-gray-500 mb-3">
                    <i class="fas fa-calendar-alt ml-1"></i>
                    مهلت: ${task.deadline || 'نامشخص'}
                </div>
                
                ${attachedFileHTML}
                
                <!-- Actions -->
                <div class="mt-4 flex space-x-2 space-x-reverse">
                    <button onclick="employeeModule.viewAgentTaskDetails('${task.id}')" 
                            class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all">
                        <i class="fas fa-eye ml-1"></i>
                        جزئیات
                    </button>
                    ${task.status !== 'completed' ? `
                        <button onclick="employeeModule.deleteAgentTask('${task.id}', '${employeeId}')" 
                                class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all">
                            <i class="fas fa-trash ml-1"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    // Calculate time remaining (same as AgentModule)
    calculateTimeRemaining(deadline) {
        if (!deadline) {
            return { days: 0, hours: 0, isOverdue: false };
        }
        
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
    
    // Filter agent tasks
    filterAgentTasks(status, employeeId) {
        const tasks = this.getemployeeAgentTasks(employeeId);
        const filteredTasks = status === 'all' ? tasks : tasks.filter(t => t.status === status);
        
        // Update filter buttons
        ['all', 'pending', 'in_progress', 'completed'].forEach(s => {
            const btn = document.getElementById(`filter-${s}`);
            if (btn) {
                if (s === status) {
                    btn.classList.remove('bg-slate-700', 'text-gray-300');
                    btn.classList.add('bg-purple-600', 'text-white');
                } else {
                    btn.classList.remove('bg-purple-600', 'text-white');
                    btn.classList.add('bg-slate-700', 'text-gray-300');
                }
            }
        });
        
        // Update grid
        const grid = document.getElementById('agent-tasks-grid');
        if (grid) {
            if (filteredTasks.length === 0) {
                grid.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-filter text-4xl text-gray-500 mb-4"></i>
                        <p class="text-gray-400">هیچ وظیفه‌ای با این فیلتر یافت نشد</p>
                    </div>
                `;
            } else {
                grid.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-filter="${status}">
                        ${filteredTasks.map((task, index) => this.getemployeeAgentTaskCard(task, employeeId, index + 1)).join('')}
                    </div>
                `;
                
                // Restart timers
                setTimeout(() => this.startemployeeTimers(), 100);
            }
        }
    },
    
    // Start timers for employee view
    startemployeeTimers() {
        if (this.employeeTimers) {
            Object.values(this.employeeTimers).forEach(timer => clearInterval(timer));
        }
        this.employeeTimers = {};
        
        const agentTasksKey = 'agent_tasks';
        const allTasks = JSON.parse(localStorage.getItem(agentTasksKey) || '[]');
        
        allTasks.forEach(task => {
            if (task.status === 'completed') return;
            
            const timerElement = document.getElementById(`emp-timer-${task.id}`);
            if (!timerElement) return;
            
            this.employeeTimers[task.id] = setInterval(() => {
                const timeRemaining = this.calculateTimeRemaining(task.deadline);
                
                const daysElement = timerElement.querySelector('[data-days]');
                const hoursElement = timerElement.querySelector('[data-hours]');
                
                if (daysElement) daysElement.textContent = timeRemaining.days;
                if (hoursElement) hoursElement.textContent = timeRemaining.hours;
                
                if (timeRemaining.days === 0 && !timeRemaining.isOverdue) {
                    timerElement.classList.add('animate-pulse');
                    daysElement?.parentElement.classList.add('bg-red-600');
                    hoursElement?.parentElement.classList.add('bg-red-600');
                }
                
                if (timeRemaining.isOverdue) {
                    clearInterval(this.employeeTimers[task.id]);
                }
            }, 60000);
        });
    },
    
    // View agent task details
    viewAgentTaskDetails(taskId) {
        const agentTasksKey = 'agent_tasks';
        const allTasks = JSON.parse(localStorage.getItem(agentTasksKey) || '[]');
        const task = allTasks.find(t => t.id === taskId);
        
        if (!task) {
            UTILS.showNotification('وظیفه یافت نشد', 'error');
            return;
        }
        
        const statusTexts = {
            'pending': 'در انتظار',
            'in_progress': 'در حال انجام',
            'completed': 'تکمیل شده'
        };
        
        const modalHTML = `
            <div id="task-details-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-bold text-white">
                                <i class="fas fa-info-circle text-purple-400 ml-2"></i>
                                جزئیات وظیفه
                            </h3>
                            <button onclick="employeeModule.closeModal('task-details-modal')" 
                                    class="text-gray-400 hover:text-white">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-6 space-y-4">
                        <div class="bg-slate-700 rounded-lg p-4">
                            <h4 class="font-bold text-white text-xl mb-2">${task.title}</h4>
                            <p class="text-gray-300">${task.description}</p>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-slate-700 rounded-lg p-4">
                                <p class="text-sm text-gray-400 mb-1">وضعیت</p>
                                <p class="text-white font-bold">${statusTexts[task.status]}</p>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-4">
                                <p class="text-sm text-gray-400 mb-1">اولویت</p>
                                <p class="text-white font-bold">${task.priority === 'high' ? 'فوری' : 'عادی'}</p>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-4">
                                <p class="text-sm text-gray-400 mb-1">عامل</p>
                                <p class="text-white font-bold">${task.agentName}</p>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-4">
                                <p class="text-sm text-gray-400 mb-1">دانشجو</p>
                                <p class="text-white font-bold">${task.studentName}</p>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-4">
                                <p class="text-sm text-gray-400 mb-1">مهلت تحویل</p>
                                <p class="text-white font-bold">${task.deadline}</p>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-4">
                                <p class="text-sm text-gray-400 mb-1">تاریخ ایجاد</p>
                                <p class="text-white font-bold">${new Date(task.createdAt).toLocaleDateString('fa-IR')}</p>
                            </div>
                        </div>
                        
                        ${task.attachedFile ? `
                            <div class="bg-slate-700 rounded-lg p-4">
                                <p class="text-sm text-gray-400 mb-2">فایل ضمیمه</p>
                                <div class="flex items-center justify-between bg-slate-600 rounded-lg p-3">
                                    <div class="flex items-center space-x-3 space-x-reverse">
                                        <i class="fas fa-file text-purple-400 text-2xl"></i>
                                        <div>
                                            <p class="text-white font-medium">${task.attachedFile.name}</p>
                                            <p class="text-xs text-gray-400">${this.formatFileSize(task.attachedFile.size)}</p>
                                        </div>
                                    </div>
                                    <button onclick="employeeModule.downloadAgentTaskFile('${task.id}')" 
                                            class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                                        <i class="fas fa-download ml-2"></i>
                                        دانلود
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${task.completedAt ? `
                            <div class="bg-green-500 bg-opacity-20 border border-green-500 rounded-lg p-4">
                                <p class="text-green-400 font-bold mb-2">
                                    <i class="fas fa-check-circle ml-2"></i>
                                    وظیفه تکمیل شده
                                </p>
                                <p class="text-sm text-gray-300">
                                    تاریخ تکمیل: ${new Date(task.completedAt).toLocaleString('fa-IR')}
                                </p>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="p-6 border-t border-slate-700 flex justify-end">
                        <button onclick="employeeModule.closeModal('task-details-modal')" 
                                class="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg">
                            بستن
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // Delete agent task
    deleteAgentTask(taskId, employeeId) {
        if (!confirm('آیا از حذف این وظیفه اطمینان دارید؟')) {
            return;
        }
        
        const agentTasksKey = 'agent_tasks';
        let allTasks = JSON.parse(localStorage.getItem(agentTasksKey) || '[]');
        allTasks = allTasks.filter(t => t.id !== taskId);
        localStorage.setItem(agentTasksKey, JSON.stringify(allTasks));
        
        UTILS.showNotification('وظیفه حذف شد', 'success');
        this.refreshAgentTasksManagement(employeeId);
    },
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    // Refresh agent tasks management
    refreshAgentTasksManagement(employeeId) {
        const content = document.querySelector('[x-show="currentPage === \'agentTasksManagement\'"]');
        if (content) {
            content.innerHTML = this.getAgentTasksManagementContent(employeeId);
            setTimeout(() => this.startemployeeTimers(), 100);
        }
    },
    
    // Edit student profile
    editStudentProfile(studentId) {
        const students = this.getAllStudents();
        const student = students.find(s => s.id === studentId);
        
        if (!student) {
            UTILS.showNotification('دانشجو یافت نشد', 'error');
            return;
        }
        
        // Initialize workflows if not exist
        if (!student.defenseWorkflow) {
            student.defenseWorkflow = this.getDefaultDefenseSteps();
        }
        if (!student.graduationWorkflow) {
            student.graduationWorkflow = this.getDefaultGraduationSteps();
        }
        if (!student.educationalSteps) {
            student.educationalSteps = this.getDefaultEducationalSteps();
        }
        if (!student.defenseSteps) {
            student.defenseSteps = this.getDefaultDefenseSteps2();
        }
        
        const modalHTML = `
            <div id="edit-student-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                        <h3 class="text-lg font-bold text-white">
                            <i class="fas fa-user-edit text-indigo-400 ml-2"></i>
                            ویرایش پروفایل دانشجو - ${student.name}
                        </h3>
                    </div>
                    
                    <!-- Tabs Navigation -->
                    <div class="border-b border-slate-700 bg-slate-800 sticky top-[73px] z-10">
                        <div class="flex space-x-2 space-x-reverse px-6">
                            <button onclick="employeeModule.switchStudentTab('info')" 
                                    id="tab-info"
                                    class="px-4 py-3 font-medium border-b-2 border-indigo-500 text-indigo-400 transition-all">
                                <i class="fas fa-user ml-1"></i>
                                اطلاعات شخصی
                            </button>
                            <button onclick="employeeModule.switchStudentTab('defense')" 
                                    id="tab-defense"
                                    class="px-4 py-3 font-medium border-b-2 border-transparent text-gray-400 hover:text-white transition-all">
                                <i class="fas fa-shield-alt ml-1"></i>
                                گردش دفاع
                            </button>
                            <button onclick="employeeModule.switchStudentTab('graduation')" 
                                    id="tab-graduation"
                                    class="px-4 py-3 font-medium border-b-2 border-transparent text-gray-400 hover:text-white transition-all">
                                <i class="fas fa-graduation-cap ml-1"></i>
                                گردش فارغ‌التحصیلی
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-6 space-y-4">
                        <!-- Tab Content: اطلاعات شخصی -->
                        <div id="content-info" class="space-y-4">
                            ${this.getStudentInfoTabContent(student)}
                        </div>
                        
                        <!-- Tab Content: گردش دفاع -->
                        <div id="content-defense" class="space-y-4" style="display: none;">
                            ${this.getDefenseWorkflowContent(student)}
                        </div>
                        
                        <!-- Tab Content: گردش فارغ‌التحصیلی -->
                        <div id="content-graduation" class="space-y-4" style="display: none;">
                            ${this.getGraduationWorkflowContent(student)}
                        </div>
                    </div>
                    
                    <div class="p-6 border-t border-slate-700 flex justify-end space-x-3 space-x-reverse">
                        <button onclick="employeeModule.closeModal('edit-student-modal')" 
                                class="px-4 py-2 text-gray-400 hover:text-white">
                            انصراف
                        </button>
                        <button onclick="employeeModule.saveStudentProfile('${studentId}')" 
                                class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-save ml-2"></i>
                            ذخیره تغییرات
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // Save student profile
    saveStudentProfile(studentId) {
        const students = this.getAllStudents();
        const student = students.find(s => s.id === studentId);
        
        if (!student) {
            UTILS.showNotification('دانشجو یافت نشد', 'error');
            return;
        }
        
        const updatedData = {
            name: document.getElementById('edit-student-name').value,
            studentId: document.getElementById('edit-student-id').value,
            passportNumber: document.getElementById('edit-passport').value,
            birthDate: document.getElementById('edit-birthdate').value,
            gender: document.getElementById('edit-gender').value,
            phone: document.getElementById('edit-phone').value,
            university: document.getElementById('edit-university').value,
            field: document.getElementById('edit-field').value,
            degree: document.getElementById('edit-degree').value,
            email: document.getElementById('edit-email').value,
            active: document.getElementById('edit-active').checked,
            defenseWorkflow: student.defenseWorkflow,
            graduationWorkflow: student.graduationWorkflow,
            educationalSteps: student.educationalSteps,
            defenseSteps: student.defenseSteps
        };
        
        // Validation
        if (!updatedData.name || !updatedData.studentId) {
            UTILS.showNotification('لطفاً نام و شماره دانشجویی را وارد کنید', 'error');
            return;
        }
        
        // Update in DataModule if available
        if (typeof DataModule !== 'undefined' && DataModule.updateUser) {
            DataModule.updateUser(studentId, updatedData);
        }
        
        // Save to localStorage as backup
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        studentsData[studentId] = { ...studentsData[studentId], ...updatedData, updatedAt: new Date().toISOString() };
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        this.closeModal('edit-student-modal');
        this.refreshStudents();
        UTILS.showNotification('پروفایل دانشجو با موفقیت به‌روزرسانی شد', 'success');
    },
    
    // Toggle progress step
    toggleProgressStep(step, checked) {
        if (step === 'defense') {
            // Update defense icon
            const defenseIcon = document.getElementById('defense-step-icon');
            if (defenseIcon) {
                if (checked) {
                    defenseIcon.classList.remove('bg-slate-600');
                    defenseIcon.classList.add('bg-green-500');
                    defenseIcon.querySelector('i').classList.remove('fa-circle');
                    defenseIcon.querySelector('i').classList.add('fa-check');
                } else {
                    defenseIcon.classList.remove('bg-green-500');
                    defenseIcon.classList.add('bg-slate-600');
                    defenseIcon.querySelector('i').classList.remove('fa-check');
                    defenseIcon.querySelector('i').classList.add('fa-circle');
                    
                    // Also uncheck graduation if defense is unchecked
                    const graduationCheckbox = document.getElementById('edit-graduation-completed');
                    if (graduationCheckbox && graduationCheckbox.checked) {
                        graduationCheckbox.checked = false;
                        this.toggleProgressStep('graduation', false);
                    }
                }
                
                // Enable/disable graduation checkbox
                const graduationCheckbox = document.getElementById('edit-graduation-completed');
                if (graduationCheckbox) {
                    graduationCheckbox.disabled = !checked;
                }
            }
        } else if (step === 'graduation') {
            // Update graduation icon
            const graduationIcon = document.getElementById('graduation-step-icon');
            if (graduationIcon) {
                if (checked) {
                    graduationIcon.classList.remove('bg-slate-600');
                    graduationIcon.classList.add('bg-green-500');
                    graduationIcon.querySelector('i').classList.remove('fa-circle');
                    graduationIcon.querySelector('i').classList.add('fa-check');
                } else {
                    graduationIcon.classList.remove('bg-green-500');
                    graduationIcon.classList.add('bg-slate-600');
                    graduationIcon.querySelector('i').classList.remove('fa-check');
                    graduationIcon.querySelector('i').classList.add('fa-circle');
                }
            }
        }
        
        // Update overall progress
        const defenseChecked = document.getElementById('edit-defense-completed').checked;
        const graduationChecked = document.getElementById('edit-graduation-completed').checked;
        
        let progress = 0;
        if (defenseChecked && graduationChecked) {
            progress = 100;
        } else if (defenseChecked) {
            progress = 50;
        }
        
        const progressBar = document.getElementById('overall-progress-bar');
        const progressText = document.getElementById('overall-progress-text');
        
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
        if (progressText) {
            progressText.textContent = progress + '%';
        }
    },
    
    refreshStudents() {
        const content = document.querySelector('[x-show="currentPage === \'students\'"]');
        if (content) {
            let currentUserId = 'emp001';
            if (typeof ModalsModule !== 'undefined' && ModalsModule.getCurrentUser) {
                const user = ModalsModule.getCurrentUser();
                if (user) currentUserId = user.id;
            }
            content.innerHTML = this.getStudentsContent(currentUserId);
        }
    },

    // Get chat with manager content
    getChatWithManagerContent(userId) {
        const messages = this.getMyMessages(userId);
        const files = this.getMyFiles(userId);
        
        return `
            <div class="space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-white">
                        <i class="fas fa-comments text-indigo-400 ml-2"></i>
                        گفتگو با مدیر
                    </h2>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Chat Section -->
                    <div class="lg:col-span-2">
                        <div class="bg-slate-800 rounded-lg shadow-md">
                            <div class="p-4 border-b border-slate-700">
                                <h3 class="text-lg font-bold text-white">
                                    <i class="fas fa-comment-dots text-indigo-400 ml-2"></i>
                                    پیام‌ها
                                </h3>
                            </div>
                            
                            <!-- Messages Area -->
                            <div class="p-4 h-96 overflow-y-auto" id="emp-chat-messages">
                                ${messages.length === 0 ? `
                                    <div class="text-center py-8">
                                        <i class="fas fa-comments text-4xl text-gray-500 mb-4"></i>
                                        <p class="text-gray-400">هنوز پیامی ارسال نشده است</p>
                                    </div>
                                ` : `
                                    <div class="space-y-3">
                                        ${messages.map(msg => this.getChatMessage(msg, userId)).join('')}
                                    </div>
                                `}
                            </div>
                            
                            <!-- Send Message -->
                            <div class="p-4 border-t border-slate-700">
                                <div class="flex space-x-2 space-x-reverse">
                                    <input type="text" id="emp-message-input" 
                                           class="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                           placeholder="پیام خود را بنویسید..."
                                           onkeypress="if(event.key === 'Enter') employeeModule.sendMessage('${userId}')">
                                    <button onclick="employeeModule.sendMessage('${userId}')" 
                                            class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Files Section -->
                    <div class="lg:col-span-1">
                        <div class="bg-slate-800 rounded-lg shadow-md">
                            <div class="p-4 border-b border-slate-700 flex justify-between items-center">
                                <h3 class="text-lg font-bold text-white">
                                    <i class="fas fa-folder text-indigo-400 ml-2"></i>
                                    فایل‌های مشترک
                                </h3>
                                <button onclick="employeeModule.uploadFile('${userId}')" 
                                        class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-sm">
                                    <i class="fas fa-upload ml-1"></i>
                                    آپلود
                                </button>
                            </div>
                            
                            <div class="p-4 max-h-96 overflow-y-auto">
                                ${files.length === 0 ? `
                                    <div class="text-center py-8">
                                        <i class="fas fa-folder-open text-4xl text-gray-500 mb-4"></i>
                                        <p class="text-gray-400">هنوز فایلی آپلود نشده است</p>
                                    </div>
                                ` : `
                                    <div class="space-y-2">
                                        ${files.map(file => this.getFileCard(file)).join('')}
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get chat message
    getChatMessage(message, userId) {
        const isMe = message.senderId === userId;
        
        return `
            <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                <div class="max-w-xs lg:max-w-md ${isMe ? 'bg-indigo-600' : 'bg-slate-600'} rounded-lg p-3">
                    <p class="text-white text-sm">${message.text}</p>
                    <p class="text-xs text-gray-300 mt-1">${message.timestamp}</p>
                </div>
            </div>
        `;
    },
    
    // Get file card
    getFileCard(file) {
        const iconMap = {
            'pdf': 'fa-file-pdf text-red-400',
            'doc': 'fa-file-word text-blue-400',
            'docx': 'fa-file-word text-blue-400',
            'xls': 'fa-file-excel text-green-400',
            'xlsx': 'fa-file-excel text-green-400',
            'jpg': 'fa-file-image text-yellow-400',
            'png': 'fa-file-image text-yellow-400'
        };
        const ext = file.name.split('.').pop().toLowerCase();
        const icon = iconMap[ext] || 'fa-file text-gray-400';
        
        return `
            <div class="bg-slate-700 rounded-lg p-3 flex items-center justify-between">
                <div class="flex items-center">
                    <i class="fas ${icon} text-xl ml-2"></i>
                    <div>
                        <p class="text-white text-sm font-medium truncate max-w-[120px]">${file.name}</p>
                        <p class="text-xs text-gray-400">${file.uploadedByName}</p>
                    </div>
                </div>
                <button onclick="employeeModule.downloadFile('${file.id}')" 
                        class="text-indigo-400 hover:text-indigo-300 p-1">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;
    },
    
    // Data methods
    getCurrentemployee(userId) {
        const employees = [
            { id: 'emp001', name: 'ساره', email: 'zahra@edu-system.com' },
            { id: 'emp002', name: 'زینب', email: 'fatemeh@edu-system.com' },
            { id: 'emp003', name: 'فرزاد', email: 'farzad@edu-system.com' },
            { id: 'emp004', name: 'سلیمان', email: 'soleiman@edu-system.com' }
        ];
        return employees.find(c => c.id === userId) || employees[0];
    },
    
    getMyTasks(userId) {
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        return tasksData[userId] || [];
    },
    
    getMyMessages(userId) {
        const messagesData = JSON.parse(localStorage.getItem('employee_messages') || '{}');
        return messagesData[userId] || [];
    },
    
    getMyFiles(userId) {
        const filesData = JSON.parse(localStorage.getItem('employee_files') || '{}');
        return filesData[userId] || [];
    },
    
    saveMyMessages(userId, messages) {
        const messagesData = JSON.parse(localStorage.getItem('employee_messages') || '{}');
        messagesData[userId] = messages;
        localStorage.setItem('employee_messages', JSON.stringify(messagesData));
    },
    
    saveMyFiles(userId, files) {
        const filesData = JSON.parse(localStorage.getItem('employee_files') || '{}');
        filesData[userId] = files;
        localStorage.setItem('employee_files', JSON.stringify(filesData));
    },
    
    saveMyTasks(userId, tasks) {
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        tasksData[userId] = tasks;
        localStorage.setItem('employee_tasks', JSON.stringify(tasksData));
    },

    // Action methods
    updateTaskStatus(taskId, userId) {
        const tasks = this.getMyTasks(userId);
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex === -1) return;
        
        const statusOrder = ['pending', 'in_progress', 'completed'];
        
        const currentIndex = statusOrder.indexOf(tasks[taskIndex].status);
        const newStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
        tasks[taskIndex].status = newStatus;
        
        // اگر تکمیل شد، تاریخ تکمیل را ثبت کن
        if (newStatus === 'completed') {
            tasks[taskIndex].completedAt = new Date().toISOString();
            tasks[taskIndex].completedBy = userId;
        }
        
        this.saveMyTasks(userId, tasks);
        this.refreshMyTasks(userId);
        
        // نمایش پیام مناسب
        const statusTextsMsg = {
            'pending': 'وظیفه به حالت در انتظار برگشت',
            'in_progress': 'وظیفه در حال انجام است',
            'completed': 'وظیفه با موفقیت تکمیل شد ✓'
        };
        UTILS.showNotification(statusTextsMsg[newStatus], 'success');
    },
    
    sendMessage(userId) {
        const input = document.getElementById('emp-message-input');
        const text = input.value.trim();
        
        if (!text) return;
        
        const messages = this.getMyMessages(userId);
        messages.push({
            id: UTILS.generateId(),
            text: text,
            senderId: userId,
            senderName: this.getCurrentemployee(userId).name,
            timestamp: new Date().toLocaleString('fa-IR')
        });
        
        this.saveMyMessages(userId, messages);
        input.value = '';
        this.refreshChat(userId);
        
        // Scroll to bottom
        setTimeout(() => {
            const chatArea = document.getElementById('emp-chat-messages');
            if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
        }, 100);
        
        UTILS.showNotification('پیام ارسال شد', 'success');
    },
    
    uploadFile(userId) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.txt';
        
        fileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const files = this.getMyFiles(userId);
            const employee = this.getCurrentemployee(userId);
            
            if (file.size < 1024 * 1024) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    files.unshift({
                        id: UTILS.generateId(),
                        name: file.name,
                        size: file.size,
                        data: e.target.result,
                        uploadedAt: new Date().toLocaleString('fa-IR'),
                        uploadedBy: userId,
                        uploadedByName: employee.name
                    });
                    
                    this.saveMyFiles(userId, files);
                    this.refreshChat(userId);
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
                    uploadedBy: userId,
                    uploadedByName: employee.name
                });
                
                this.saveMyFiles(userId, files);
                this.refreshChat(userId);
                UTILS.showNotification('فایل آپلود شد', 'success');
            }
        };
        
        fileInput.click();
    },
    
    downloadFile(fileId) {
        // Find file in all employees' files
        const filesData = JSON.parse(localStorage.getItem('employee_files') || '{}');
        let file = null;
        
        for (const userId in filesData) {
            file = filesData[userId].find(f => f.id === fileId);
            if (file) break;
        }
        
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
    
    playVoice(taskId) {
        const audio = document.getElementById(`emp-audio-${taskId}`);
        const playIcon = document.getElementById(`emp-play-icon-${taskId}`);
        const progress = document.getElementById(`emp-progress-${taskId}`);
        
        if (!audio) return;
        
        if (audio.paused) {
            // Stop all other playing audios
            document.querySelectorAll('audio').forEach(a => {
                if (a.id !== `emp-audio-${taskId}`) {
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
    
    showDailyReportModal() {
        // دریافت کاربر فعلی از ModalsModule یا از طریق تابع گلوبال
        let currentUserId = 'emp001';
        if (typeof getCurrentUser === 'function') {
            const user = getCurrentUser();
            if (user) currentUserId = user.id;
        } else if (typeof ModalsModule !== 'undefined' && ModalsModule.getCurrentUser) {
            const user = ModalsModule.getCurrentUser();
            if (user) currentUserId = user.id;
        }
        
        const modalHTML = `
            <div id="daily-report-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg max-w-md w-full p-6">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-file-alt text-emerald-400 ml-2"></i>
                        ارسال گزارش روزانه
                    </h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">خلاصه کارهای انجام شده</label>
                            <textarea id="report-summary" rows="4"
                                      class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                      placeholder="خلاصه‌ای از کارهای انجام شده امروز..."></textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">وظایف تکمیل شده</label>
                                <input type="number" id="report-completed" min="0" value="0"
                                       class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">وظایف در حال انجام</label>
                                <input type="number" id="report-in-progress" min="0" value="0"
                                       class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-end space-x-3 space-x-reverse mt-6">
                        <button onclick="employeeModule.closeModal('daily-report-modal')" 
                                class="px-4 py-2 text-gray-400 hover:text-white">
                            انصراف
                        </button>
                        <button onclick="employeeModule.submitDailyReport('${currentUserId}')" 
                                class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg">
                            ارسال گزارش
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    submitDailyReport(userId) {
        const summary = document.getElementById('report-summary').value;
        const completedTasks = document.getElementById('report-completed').value;
        const inProgressTasks = document.getElementById('report-in-progress').value;
        
        if (!summary.trim()) {
            UTILS.showNotification('لطفاً خلاصه گزارش را وارد کنید', 'error');
            return;
        }
        
        const reportsData = JSON.parse(localStorage.getItem('employee_reports') || '{}');
        if (!reportsData[userId]) reportsData[userId] = [];
        
        reportsData[userId].unshift({
            id: UTILS.generateId(),
            date: new Date().toLocaleDateString('fa-IR'),
            summary: summary,
            completedTasks: parseInt(completedTasks) || 0,
            inProgressTasks: parseInt(inProgressTasks) || 0,
            submittedAt: new Date().toLocaleString('fa-IR')
        });
        
        localStorage.setItem('employee_reports', JSON.stringify(reportsData));
        
        this.closeModal('daily-report-modal');
        UTILS.showNotification('گزارش روزانه ارسال شد', 'success');
    },
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.remove();
    },
    
    refreshMyTasks(userId) {
        // روش اول: جستجوی المان با x-show
        const content = document.querySelector('[x-show="currentPage === \'myTasks\'"]');
        if (content) {
            content.innerHTML = this.getMyTasksContent(userId);
            return;
        }
        
        // روش دوم: جستجوی المان با id
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            // بررسی اینکه آیا در صفحه وظایف هستیم
            const tasksHeader = mainContent.querySelector('h2');
            if (tasksHeader && tasksHeader.textContent.includes('وظایف من')) {
                mainContent.innerHTML = this.getMyTasksContent(userId);
            }
        }
    },
    
    refreshChat(userId) {
        const content = document.querySelector('[x-show="currentPage === \'chatWithManager\'"]');
        if (content) {
            content.innerHTML = this.getChatWithManagerContent(userId);
        }
    },
    
    // Helper functions
    getFileIcon(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': 'fa-file-pdf text-red-400',
            'doc': 'fa-file-word text-blue-400',
            'docx': 'fa-file-word text-blue-400',
            'xls': 'fa-file-excel text-green-400',
            'xlsx': 'fa-file-excel text-green-400',
            'jpg': 'fa-file-image text-yellow-400',
            'png': 'fa-file-image text-yellow-400',
            'txt': 'fa-file-alt text-gray-400',
            'zip': 'fa-file-archive text-purple-400',
            'rar': 'fa-file-archive text-purple-400'
        };
        return iconMap[ext] || 'fa-file text-gray-400';
    },
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    downloadTaskFile(taskId, userId) {
        const tasks = this.getMyTasks(userId);
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
            
            // Add file to shared files
            this.addFileToSharedFiles(task.attachedFile, userId);
        } else {
            UTILS.showNotification('داده فایل موجود نیست', 'warning');
        }
    },
    
    addFileToSharedFiles(file, userId) {
        // Get shared files from localStorage
        const sharedFilesKey = `shared_files_${userId}`;
        let sharedFiles = JSON.parse(localStorage.getItem(sharedFilesKey) || '[]');
        
        // Check if file already exists
        const exists = sharedFiles.find(f => f.name === file.name && f.size === file.size);
        if (!exists) {
            sharedFiles.push({
                id: UTILS.generateId(),
                name: file.name,
                size: file.size,
                data: file.data,
                uploadedAt: new Date().toLocaleString('fa-IR'),
                uploadedBy: 'manager',
                uploadedByName: 'مدیر',
                source: 'task_attachment'
            });
            localStorage.setItem(sharedFilesKey, JSON.stringify(sharedFiles));
        }
    },
    
    // Show modal to create task for agent
    showCreateAgentTaskModal(employeeId) {
        // Get all agents
        const agents = DataModule.getUsers().filter(u => u.role === 'agent');
        
        // Get all students
        const students = DataModule.getUsers().filter(u => u.role === 'student');
        
        const modalHTML = `
            <div id="create-agent-task-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-bold text-white">
                                <i class="fas fa-plus-circle text-blue-400 ml-2"></i>
                                تعریف وظیفه برای عامل
                            </h3>
                            <button onclick="employeeModule.closeCreateAgentTaskModal()" 
                                    class="text-gray-400 hover:text-white">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-6 space-y-4">
                        <!-- نام دانشجو -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                <i class="fas fa-user-graduate text-indigo-400 ml-1"></i>
                                نام دانشجو
                            </label>
                            <select id="agent-task-student" 
                                    class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
                                <option value="">-- انتخاب دانشجو --</option>
                                ${students.map(s => `
                                    <option value="${s.id}">${s.name} - ${s.university || 'نامشخص'}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <!-- عنوان وظیفه -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                <i class="fas fa-heading text-indigo-400 ml-1"></i>
                                عنوان وظیفه
                            </label>
                            <input type="text" id="agent-task-title" 
                                   placeholder="مثال: نوشتن فصل اول رساله"
                                   class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
                        </div>
                        
                        <!-- توضیحات -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                <i class="fas fa-align-right text-indigo-400 ml-1"></i>
                                توضیحات
                            </label>
                            <textarea id="agent-task-description" 
                                      rows="4"
                                      placeholder="جزئیات و توضیحات وظیفه را وارد کنید..."
                                      class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white resize-none"></textarea>
                        </div>
                        
                        <!-- فایل ضمیمه -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                <i class="fas fa-paperclip text-indigo-400 ml-1"></i>
                                فایل ضمیمه (اختیاری)
                            </label>
                            <div class="flex items-center space-x-3 space-x-reverse">
                                <button onclick="document.getElementById('agent-task-file').click()" 
                                        class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
                                    <i class="fas fa-upload ml-2"></i>
                                    انتخاب فایل
                                </button>
                                <span id="agent-task-file-name" class="text-sm text-gray-400">فایلی انتخاب نشده</span>
                            </div>
                            <input type="file" id="agent-task-file" class="hidden" 
                                   onchange="employeeModule.handleAgentTaskFileSelect(event)">
                        </div>
                        
                        <!-- تخصیص به عامل -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                <i class="fas fa-user-shield text-indigo-400 ml-1"></i>
                                تخصیص به عامل
                            </label>
                            <select id="agent-task-agent" 
                                    class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
                                <option value="">-- انتخاب عامل --</option>
                                ${agents.map(a => `
                                    <option value="${a.id}">${a.name} - ${a.specialization || 'عمومی'}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <!-- زمان تحویل -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    <i class="fas fa-calendar text-indigo-400 ml-1"></i>
                                    تاریخ تحویل
                                </label>
                                <input type="date" id="agent-task-date" 
                                       class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    <i class="fas fa-clock text-indigo-400 ml-1"></i>
                                    ساعت تحویل
                                </label>
                                <input type="time" id="agent-task-time" 
                                       class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
                            </div>
                        </div>
                        
                        <!-- اولویت -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                <i class="fas fa-flag text-indigo-400 ml-1"></i>
                                اولویت
                            </label>
                            <select id="agent-task-priority" 
                                    class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
                                <option value="normal">عادی</option>
                                <option value="high">فوری</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="p-6 border-t border-slate-700 flex justify-end space-x-3 space-x-reverse">
                        <button onclick="employeeModule.closeCreateAgentTaskModal()" 
                                class="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium">
                            <i class="fas fa-times ml-2"></i>
                            انصراف
                        </button>
                        <button onclick="employeeModule.submitAgentTask('${employeeId}')" 
                                class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
                            <i class="fas fa-check ml-2"></i>
                            ثبت وظیفه
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // Handle file select for agent task
    handleAgentTaskFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const fileNameSpan = document.getElementById('agent-task-file-name');
        fileNameSpan.textContent = file.name;
        fileNameSpan.classList.remove('text-gray-400');
        fileNameSpan.classList.add('text-green-400');
    },
    
    // Close create agent task modal
    closeCreateAgentTaskModal() {
        const modal = document.getElementById('create-agent-task-modal');
        if (modal) {
            modal.remove();
        }
    },
    
    // Submit agent task
    submitAgentTask(employeeId) {
        const studentId = document.getElementById('agent-task-student').value;
        const title = document.getElementById('agent-task-title').value.trim();
        const description = document.getElementById('agent-task-description').value.trim();
        const agentId = document.getElementById('agent-task-agent').value;
        const date = document.getElementById('agent-task-date').value;
        const time = document.getElementById('agent-task-time').value;
        const priority = document.getElementById('agent-task-priority').value;
        const fileInput = document.getElementById('agent-task-file');
        
        // Validation
        if (!studentId) {
            UTILS.showNotification('لطفاً دانشجو را انتخاب کنید', 'error');
            return;
        }
        if (!title) {
            UTILS.showNotification('لطفاً عنوان وظیفه را وارد کنید', 'error');
            return;
        }
        if (!description) {
            UTILS.showNotification('لطفاً توضیحات را وارد کنید', 'error');
            return;
        }
        if (!agentId) {
            UTILS.showNotification('لطفاً عامل را انتخاب کنید', 'error');
            return;
        }
        if (!date) {
            UTILS.showNotification('لطفاً تاریخ تحویل را انتخاب کنید', 'error');
            return;
        }
        if (!time) {
            UTILS.showNotification('لطفاً ساعت تحویل را انتخاب کنید', 'error');
            return;
        }
        
        // Get student and agent info
        const students = DataModule.getUsers().filter(u => u.role === 'student');
        const agents = DataModule.getUsers().filter(u => u.role === 'agent');
        const student = students.find(s => s.id === studentId);
        const agent = agents.find(a => a.id === agentId);
        
        // Handle file if selected
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            
            reader.onload = (e) => {
                this.saveAgentTask({
                    studentId,
                    studentName: student ? student.name : 'نامشخص',
                    title,
                    description,
                    agentId,
                    agentName: agent ? agent.name : 'نامشخص',
                    date,
                    time,
                    priority,
                    employeeId,
                    attachedFile: {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        data: e.target.result
                    }
                });
            };
            
            reader.readAsDataURL(file);
        } else {
            this.saveAgentTask({
                studentId,
                studentName: student ? student.name : 'نامشخص',
                title,
                description,
                agentId,
                agentName: agent ? agent.name : 'نامشخص',
                date,
                time,
                priority,
                employeeId,
                attachedFile: null
            });
        }
    },
    
    // Save agent task
    saveAgentTask(taskData) {
        const task = {
            id: UTILS.generateId(),
            ...taskData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            deadline: `${taskData.date} ${taskData.time}`
        };
        
        // Get existing agent tasks
        const agentTasksKey = 'agent_tasks';
        let agentTasks = JSON.parse(localStorage.getItem(agentTasksKey) || '[]');
        
        // Add new task
        agentTasks.push(task);
        
        // Save to localStorage
        localStorage.setItem(agentTasksKey, JSON.stringify(agentTasks));
        
        // ارسال رویداد به‌روزرسانی وظایف عامل
        if (typeof RealtimeEvents !== 'undefined') {
            RealtimeEvents.emit(RealtimeEvents.EVENTS.AGENT_TASK_ADDED, { task });
            RealtimeEvents.emit(RealtimeEvents.EVENTS.AGENT_TASKS_CHANGED, { tasks: agentTasks });
        }
        
        // Close modal
        this.closeCreateAgentTaskModal();
        
        // Show success message
        UTILS.showNotification('وظیفه با موفقیت برای عامل ثبت شد', 'success');
        
        // Refresh tasks list
        this.refreshMyTasks(taskData.employeeId);
    },
    
    // Get agent tasks for a specific agent
    getAgentTasks(agentId) {
        const agentTasksKey = 'agent_tasks';
        const allTasks = JSON.parse(localStorage.getItem(agentTasksKey) || '[]');
        return allTasks.filter(t => t.agentId === agentId);
    },
    
    // Get agent task card
    getAgentTaskCard(task, taskNumber) {
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
            '<span class="mr-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded">فوری</span>' : '';
        
        const attachedFileHTML = task.attachedFile ? `
            <div class="mt-3 bg-slate-600 rounded-lg p-3">
                <div class="flex items-center space-x-3 space-x-reverse">
                    <i class="fas fa-paperclip text-blue-400 text-xl"></i>
                    <div class="flex-1">
                        <p class="text-xs text-gray-300 mb-1">فایل ضمیمه:</p>
                        <p class="text-sm text-white">${task.attachedFile.name}</p>
                    </div>
                    <button onclick="employeeModule.downloadAgentTaskFile('${task.id}')" 
                            class="text-indigo-400 hover:text-indigo-300 p-2" title="دانلود فایل">
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
                            <span class="bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ml-2">${taskNumber}</span>
                            <span class="w-3 h-3 rounded-full ${statusColors[task.status] || 'bg-gray-500'} ml-2"></span>
                            <h5 class="font-medium text-white">${task.title}</h5>
                            ${priorityBadge}
                        </div>
                        <p class="text-sm text-gray-400 mb-2">${task.description || ''}</p>
                        <div class="flex items-center text-xs text-gray-500 space-x-4 space-x-reverse mb-2">
                            <span><i class="fas fa-user-graduate ml-1"></i>${task.studentName}</span>
                            <span><i class="fas fa-user-shield ml-1"></i>${task.agentName}</span>
                        </div>
                        <div class="flex items-center text-xs text-gray-500 space-x-4 space-x-reverse">
                            <span><i class="fas fa-calendar ml-1"></i>${task.deadline || 'بدون مهلت'}</span>
                            <span><i class="fas fa-clock ml-1"></i>${new Date(task.createdAt).toLocaleDateString('fa-IR')}</span>
                        </div>
                        ${attachedFileHTML}
                    </div>
                    <div class="flex flex-col items-end space-y-2">
                        <span class="text-xs px-2 py-1 rounded ${statusColors[task.status]} text-white">
                            ${statusTexts[task.status] || task.status}
                        </span>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Download agent task file
    downloadAgentTaskFile(taskId) {
        const agentTasksKey = 'agent_tasks';
        const allTasks = JSON.parse(localStorage.getItem(agentTasksKey) || '[]');
        const task = allTasks.find(t => t.id === taskId);
        
        if (!task || !task.attachedFile) {
            UTILS.showNotification('فایل یافت نشد', 'error');
            return;
        }
        
        const link = document.createElement('a');
        link.href = task.attachedFile.data;
        link.download = task.attachedFile.name;
        link.click();
        UTILS.showNotification('فایل دانلود شد', 'success');
    }
};

// Global functions for app.js
window.getMyTasksContent = function() {
    try {
        // دریافت کاربر فعلی از ModalsModule
        let currentUserId = 'emp001';
        if (typeof ModalsModule !== 'undefined' && ModalsModule.getCurrentUser) {
            const user = ModalsModule.getCurrentUser();
            if (user) currentUserId = user.id;
        } else if (typeof getCurrentUser === 'function') {
            const user = getCurrentUser();
            if (user) currentUserId = user.id;
        }
        return EmployeeModule.getMyTasksContent(currentUserId);
    } catch (error) {
        console.error('Error in getMyTasksContent:', error);
        return `
            <div class="flex items-center justify-center h-64">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <p class="text-white text-lg mb-2">خطا در بارگذاری وظایف</p>
                    <p class="text-gray-400 text-sm">${error.message}</p>
                    <button onclick="location.reload()" class="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-redo ml-2"></i>
                        تلاش مجدد
                    </button>
                </div>
            </div>
        `;
    }
};

window.getStudentsContent = function() {
    try {
        // دریافت کاربر فعلی از ModalsModule
        let currentUserId = 'emp001';
        if (typeof ModalsModule !== 'undefined' && ModalsModule.getCurrentUser) {
            const user = ModalsModule.getCurrentUser();
            if (user) currentUserId = user.id;
        } else if (typeof getCurrentUser === 'function') {
            const user = getCurrentUser();
            if (user) currentUserId = user.id;
        }
        return EmployeeModule.getStudentsContent(currentUserId);
    } catch (error) {
        console.error('Error in getStudentsContent:', error);
        return `
            <div class="flex items-center justify-center h-64">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <p class="text-white text-lg mb-2">خطا در بارگذاری دانشجویان</p>
                    <p class="text-gray-400 text-sm">${error.message}</p>
                    <button onclick="location.reload()" class="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-redo ml-2"></i>
                        تلاش مجدد
                    </button>
                </div>
            </div>
        `;
    }
};

window.getAgentTasksManagementContent = function() {
    try {
        // دریافت کاربر فعلی
        let currentUserId = 'emp001';
        if (typeof ModalsModule !== 'undefined' && ModalsModule.getCurrentUser) {
            const user = ModalsModule.getCurrentUser();
            if (user) currentUserId = user.id;
        } else if (typeof getCurrentUser === 'function') {
            const user = getCurrentUser();
            if (user) currentUserId = user.id;
        }
        
        const content = EmployeeModule.getAgentTasksManagementContent(currentUserId);
        
        // Start timers after content is rendered
        setTimeout(() => {
            EmployeeModule.startemployeeTimers();
        }, 100);
        
        return content;
    } catch (error) {
        console.error('Error in getAgentTasksManagementContent:', error);
        return `
            <div class="flex items-center justify-center h-64">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <p class="text-white text-lg mb-2">خطا در بارگذاری وظایف عامل‌ها</p>
                    <p class="text-gray-400 text-sm">${error.message}</p>
                    <button onclick="location.reload()" class="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-redo ml-2"></i>
                        تلاش مجدد
                    </button>
                </div>
            </div>
        `;
    }
};

window.getChatWithManagerContent = function() {
    // دریافت کاربر فعلی از ModalsModule
    let currentUserId = 'emp001';
    if (typeof ModalsModule !== 'undefined' && ModalsModule.getCurrentUser) {
        const user = ModalsModule.getCurrentUser();
        if (user) currentUserId = user.id;
    } else if (typeof getCurrentUser === 'function') {
        const user = getCurrentUser();
        if (user) currentUserId = user.id;
    }
    return EmployeeModule.getChatWithManagerContent(currentUserId);
};


// Delete student function
EmployeeModule.deleteStudent = function(studentId) {
    if (!confirm('آیا از حذف این دانشجو مطمئن هستید؟ این عمل قابل بازگشت نیست.')) {
        return;
    }
    
    try {
        // Get students from localStorage
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        
        // Delete from students_data
        if (studentsData[studentId]) {
            delete studentsData[studentId];
            localStorage.setItem('students_data', JSON.stringify(studentsData));
        }
        
        // Also delete from users in DataModule
        const users = DataModule.getUsers();
        const updatedUsers = users.filter(u => u.id !== studentId);
        DataModule.saveUsers(updatedUsers);
        
        UTILS.showNotification('دانشجو با موفقیت حذف شد', 'success');
        
        // Refresh the page
        this.refreshStudentsPage();
    } catch (error) {
        console.error('Error deleting student:', error);
        UTILS.showNotification('خطا در حذف دانشجو', 'error');
    }
};

// Show add student modal
EmployeeModule.showAddStudentModal = function() {
    const modalHTML = `
        <div id="add-student-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-bold text-white">
                            <i class="fas fa-user-plus text-blue-400 ml-2"></i>
                            اضافه کردن دانشجوی جدید
                        </h3>
                        <button onclick="employeeModule.closeModal('add-student-modal')" 
                                class="text-gray-400 hover:text-white">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                
                <div class="p-6 space-y-4">
                    <!-- اطلاعات شخصی -->
                    <div class="bg-slate-700 rounded-lg p-4">
                        <h4 class="font-bold text-white mb-3">
                            <i class="fas fa-user text-indigo-400 ml-2"></i>
                            اطلاعات شخصی
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">نام کامل *</label>
                                <input type="text" id="new-student-name" required
                                       class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">شماره دانشجویی</label>
                                <input type="text" id="new-student-id"
                                       class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">شماره پاسپورت</label>
                                <input type="text" id="new-passport"
                                       class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">تاریخ تولد</label>
                                <input type="date" id="new-birthdate"
                                       class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">جنسیت</label>
                                <select id="new-gender" class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                                    <option value="مرد">مرد</option>
                                    <option value="زن">زن</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">شماره تماس *</label>
                                <input type="tel" id="new-phone" required
                                       class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                            </div>
                        </div>
                    </div>
                    
                    <!-- اطلاعات تحصیلی -->
                    <div class="bg-slate-700 rounded-lg p-4">
                        <h4 class="font-bold text-white mb-3">
                            <i class="fas fa-graduation-cap text-indigo-400 ml-2"></i>
                            اطلاعات تحصیلی
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">دانشگاه *</label>
                                <input type="text" id="new-university" required
                                       class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">رشته تحصیلی *</label>
                                <input type="text" id="new-field" required
                                       class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">مقطع *</label>
                                <select id="new-degree" required class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                                    <option value="کارشناسی">کارشناسی</option>
                                    <option value="کارشناسی ارشد">کارشناسی ارشد</option>
                                    <option value="عاملا">عاملا</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">ایمیل</label>
                                <input type="email" id="new-email"
                                       class="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white">
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="p-6 border-t border-slate-700 flex justify-end space-x-3 space-x-reverse">
                    <button onclick="employeeModule.closeModal('add-student-modal')" 
                            class="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium">
                        <i class="fas fa-times ml-2"></i>
                        انصراف
                    </button>
                    <button onclick="employeeModule.saveNewStudent()" 
                            class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
                        <i class="fas fa-save ml-2"></i>
                        ذخیره دانشجو
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// Save new student
EmployeeModule.saveNewStudent = function() {
    try {
        // Get form values
        const name = document.getElementById('new-student-name').value.trim();
        const studentId = document.getElementById('new-student-id').value.trim();
        const passportNumber = document.getElementById('new-passport').value.trim();
        const birthDate = document.getElementById('new-birthdate').value;
        const gender = document.getElementById('new-gender').value;
        const phone = document.getElementById('new-phone').value.trim();
        const university = document.getElementById('new-university').value.trim();
        const field = document.getElementById('new-field').value.trim();
        const degree = document.getElementById('new-degree').value;
        const email = document.getElementById('new-email').value.trim();
        
        // Validate required fields
        if (!name || !phone || !university || !field || !degree) {
            UTILS.showNotification('لطفاً فیلدهای ضروری را پر کنید', 'error');
            return;
        }
        
        // Generate new student ID
        const newId = 'std' + String(Date.now()).slice(-6);
        
        // Create new student object
        const newStudent = {
            id: newId,
            name: name,
            username: name.split(' ')[0].toLowerCase(),
            password: '123456',
            role: 'student',
            studentId: studentId || newId,
            passportNumber: passportNumber,
            birthDate: birthDate,
            gender: gender,
            phone: phone,
            university: university,
            field: field,
            degree: degree,
            email: email,
            active: true,
            createdAt: new Date().toISOString(),
            educationalSteps: this.getDefaultEducationalSteps(),
            defenseSteps: this.getDefaultDefenseSteps2(),
            requirementsSteps: this.getDefaultRequirementsSteps()
        };
        
        // Save to students_data
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        studentsData[newId] = newStudent;
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        // Also add to users in DataModule
        const users = DataModule.getUsers();
        users.push(newStudent);
        DataModule.saveUsers(users);
        
        UTILS.showNotification('دانشجوی جدید با موفقیت اضافه شد', 'success');
        
        // Close modal
        this.closeModal('add-student-modal');
        
        // Refresh the page
        this.refreshStudentsPage();
    } catch (error) {
        console.error('Error saving new student:', error);
        UTILS.showNotification('خطا در ذخیره دانشجو', 'error');
    }
};

// Show steps management modal
EmployeeModule.showStepsManagementModal = function() {
    const educationalSteps = this.getDefaultEducationalSteps();
    const defenseSteps = this.getDefaultDefenseSteps2();
    
    const modalHTML = `
        <div id="steps-management-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-slate-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-bold text-white">
                            <i class="fas fa-tasks text-purple-400 ml-2"></i>
                            مدیریت مراحل
                        </h3>
                        <button onclick="employeeModule.closeModal('steps-management-modal')" 
                                class="text-gray-400 hover:text-white">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                
                <div class="p-6">
                    <!-- Tabs -->
                    <div class="flex space-x-2 space-x-reverse mb-6 border-b border-slate-600">
                        <button onclick="employeeModule.switchStepsTab('educational')" 
                                id="steps-tab-educational"
                                class="px-6 py-3 font-medium border-b-2 border-green-500 text-green-400 transition-all">
                            <i class="fas fa-book ml-1"></i>
                            مراحل تحصیلی
                        </button>
                        <button onclick="employeeModule.switchStepsTab('defense')" 
                                id="steps-tab-defense"
                                class="px-6 py-3 font-medium border-b-2 border-transparent text-gray-400 hover:text-gray-300 transition-all">
                            <i class="fas fa-shield-alt ml-1"></i>
                            گردش دفاع
                        </button>
                    </div>
                    
                    <!-- Educational Steps Content -->
                    <div id="steps-content-educational">
                        <div class="mb-4">
                            <div class="flex items-center justify-between mb-4">
                                <p class="text-gray-300">
                                    <i class="fas fa-info-circle text-blue-400 ml-1"></i>
                                    این مراحل برای همه دانشجویان به صورت پیش‌فرض اعمال می‌شود
                                </p>
                                <button onclick="employeeModule.addCustomEducationalStep()" 
                                        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                                    <i class="fas fa-plus ml-1"></i>
                                    افزودن مرحله جدید
                                </button>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${educationalSteps.map((step, index) => `
                                <div class="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-all">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center flex-1">
                                            <span class="bg-green-600 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center ml-3">
                                                ${index + 1}
                                            </span>
                                            <div>
                                                <h5 class="font-medium text-white">${step.name}</h5>
                                                <p class="text-xs text-gray-400">مرحله ${index + 1} از ${educationalSteps.length}</p>
                                            </div>
                                        </div>
                                        <div class="flex items-center space-x-2 space-x-reverse">
                                            <button onclick="employeeModule.editStep('educational', ${index})" 
                                                    class="text-blue-400 hover:text-blue-300 p-2" title="ویرایش">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            ${step.isCustom ? `
                                                <button onclick="employeeModule.deleteStep('educational', ${index})" 
                                                        class="text-red-400 hover:text-red-300 p-2" title="حذف">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Defense Steps Content -->
                    <div id="steps-content-defense" style="display: none;">
                        <div class="mb-4">
                            <div class="flex items-center justify-between mb-4">
                                <p class="text-gray-300">
                                    <i class="fas fa-info-circle text-blue-400 ml-1"></i>
                                    این مراحل برای همه دانشجویان به صورت پیش‌فرض اعمال می‌شود
                                </p>
                                <button onclick="employeeModule.addCustomDefenseStep()" 
                                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                                    <i class="fas fa-plus ml-1"></i>
                                    افزودن مرحله جدید
                                </button>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${defenseSteps.map((step, index) => `
                                <div class="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-all">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center flex-1">
                                            <span class="bg-blue-600 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center ml-3">
                                                ${index + 1}
                                            </span>
                                            <div>
                                                <h5 class="font-medium text-white">${step.name}</h5>
                                                <p class="text-xs text-gray-400">مرحله ${index + 1} از ${defenseSteps.length}</p>
                                            </div>
                                        </div>
                                        <div class="flex items-center space-x-2 space-x-reverse">
                                            <button onclick="employeeModule.editStep('defense', ${index})" 
                                                    class="text-blue-400 hover:text-blue-300 p-2" title="ویرایش">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            ${step.isCustom ? `
                                                <button onclick="employeeModule.deleteStep('defense', ${index})" 
                                                        class="text-red-400 hover:text-red-300 p-2" title="حذف">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="p-6 border-t border-slate-700 flex justify-end space-x-3 space-x-reverse">
                    <button onclick="employeeModule.closeModal('steps-management-modal')" 
                            class="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium">
                        <i class="fas fa-times ml-2"></i>
                        بستن
                    </button>
                    <button onclick="employeeModule.saveStepsChanges()" 
                            class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium">
                        <i class="fas fa-save ml-2"></i>
                        ذخیره تغییرات
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// Switch steps tabs
EmployeeModule.switchStepsTab = function(tabName) {
    // Update tabs
    ['educational', 'defense'].forEach(tab => {
        const tabButton = document.getElementById(`steps-tab-${tab}`);
        const tabContent = document.getElementById(`steps-content-${tab}`);
        
        if (tab === tabName) {
            tabButton.classList.remove('border-transparent', 'text-gray-400');
            tabButton.classList.add('border-' + (tab === 'educational' ? 'green' : 'blue') + '-500', 
                                     'text-' + (tab === 'educational' ? 'green' : 'blue') + '-400');
            tabContent.style.display = 'block';
        } else {
            tabButton.classList.add('border-transparent', 'text-gray-400');
            tabButton.classList.remove('border-green-500', 'border-blue-500', 'text-green-400', 'text-blue-400');
            tabContent.style.display = 'none';
        }
    });
};

// Add custom educational step
EmployeeModule.addCustomEducationalStep = function() {
    const stepName = prompt('نام مرحله جدید را وارد کنید:');
    if (!stepName || stepName.trim() === '') {
        return;
    }
    
    // Get current default steps
    const customSteps = JSON.parse(localStorage.getItem('custom_educational_steps') || 'null');
    const defaultSteps = customSteps || this.getDefaultEducationalSteps();
    
    // Add new step
    defaultSteps.push({
        name: stepName.trim(),
        completed: false,
        date: null,
        notes: '',
        isCustom: true
    });
    
    // Save to localStorage
    localStorage.setItem('custom_educational_steps', JSON.stringify(defaultSteps));
    
    // Update all students
    this.applyStepsToAllStudents('educational', defaultSteps);
    
    UTILS.showNotification('مرحله جدید اضافه شد', 'success');
    
    // Reload modal
    this.closeModal('steps-management-modal');
    setTimeout(() => this.showStepsManagementModal(), 100);
};

// Add custom defense step
EmployeeModule.addCustomDefenseStep = function() {
    const stepName = prompt('نام مرحله جدید را وارد کنید:');
    if (!stepName || stepName.trim() === '') {
        return;
    }
    
    // Get current default steps
    const customSteps = JSON.parse(localStorage.getItem('custom_defense_steps') || 'null');
    const defaultSteps = customSteps || this.getDefaultDefenseSteps2();
    
    // Add new step
    defaultSteps.push({
        name: stepName.trim(),
        completed: false,
        date: null,
        notes: '',
        isCustom: true
    });
    
    // Save to localStorage
    localStorage.setItem('custom_defense_steps', JSON.stringify(defaultSteps));
    
    // Update all students
    this.applyStepsToAllStudents('defense', defaultSteps);
    
    UTILS.showNotification('مرحله جدید اضافه شد', 'success');
    
    // Reload modal
    this.closeModal('steps-management-modal');
    setTimeout(() => this.showStepsManagementModal(), 100);
};

// Edit step
EmployeeModule.editStep = function(type, index) {
    const storageKey = type === 'educational' ? 'custom_educational_steps' : 'custom_defense_steps';
    const customSteps = JSON.parse(localStorage.getItem(storageKey) || 'null');
    const defaultSteps = customSteps || (type === 'educational' ? this.getDefaultEducationalSteps() : this.getDefaultDefenseSteps2());
    
    if (index < 0 || index >= defaultSteps.length) {
        return;
    }
    
    const currentName = defaultSteps[index].name;
    const newName = prompt('نام جدید مرحله را وارد کنید:', currentName);
    
    if (!newName || newName.trim() === '' || newName === currentName) {
        return;
    }
    
    // Update step name
    defaultSteps[index].name = newName.trim();
    
    // Save to localStorage
    localStorage.setItem(storageKey, JSON.stringify(defaultSteps));
    
    // Update all students
    this.applyStepsToAllStudents(type, defaultSteps);
    
    UTILS.showNotification('نام مرحله تغییر کرد', 'success');
    
    // Reload modal
    this.closeModal('steps-management-modal');
    setTimeout(() => this.showStepsManagementModal(), 100);
};

// Delete step
EmployeeModule.deleteStep = function(type, index) {
    if (!confirm('آیا از حذف این مرحله اطمینان دارید؟ این عملیات برای همه دانشجویان اعمال می‌شود.')) {
        return;
    }
    
    const storageKey = type === 'educational' ? 'custom_educational_steps' : 'custom_defense_steps';
    const customSteps = JSON.parse(localStorage.getItem(storageKey) || 'null');
    const defaultSteps = customSteps || (type === 'educational' ? this.getDefaultEducationalSteps() : this.getDefaultDefenseSteps2());
    
    if (index < 0 || index >= defaultSteps.length) {
        return;
    }
    
    // Remove step
    defaultSteps.splice(index, 1);
    
    // Save to localStorage
    localStorage.setItem(storageKey, JSON.stringify(defaultSteps));
    
    // Update all students
    this.applyStepsToAllStudents(type, defaultSteps);
    
    UTILS.showNotification('مرحله حذف شد', 'success');
    
    // Reload modal
    this.closeModal('steps-management-modal');
    setTimeout(() => this.showStepsManagementModal(), 100);
};

// Save steps changes
EmployeeModule.saveStepsChanges = function() {
    UTILS.showNotification('تغییرات با موفقیت ذخیره شد', 'success');
    this.closeModal('steps-management-modal');
};

// Apply steps to all students
EmployeeModule.applyStepsToAllStudents = function(type, newSteps) {
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const stepKey = type === 'educational' ? 'educationalSteps' : 'defenseSteps';
    
    // Update each student
    Object.keys(studentsData).forEach(studentId => {
        const student = studentsData[studentId];
        const currentSteps = student[stepKey] || [];
        
        // Merge new steps with existing completion status
        const updatedSteps = newSteps.map((newStep, index) => {
            const existingStep = currentSteps[index];
            if (existingStep && existingStep.name === newStep.name) {
                // Keep existing step with its completion status
                return existingStep;
            } else if (existingStep) {
                // Name changed, keep completion status but update name
                return {
                    ...newStep,
                    completed: existingStep.completed,
                    date: existingStep.date,
                    notes: existingStep.notes || ''
                };
            } else {
                // New step
                return {
                    ...newStep,
                    completed: false,
                    date: null,
                    notes: ''
                };
            }
        });
        
        student[stepKey] = updatedSteps;
    });
    
    // Save back
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    console.log(`✅ Applied ${type} steps to ${Object.keys(studentsData).length} students`);
};

// Update applyStudentFilter to include empty field filter
EmployeeModule.applyStudentFilter = function() {
    const filterTypeElement = document.getElementById('filter-type');
    const filterStepElement = document.getElementById('filter-step');
    const filterEmptyFieldElement = document.getElementById('filter-empty-field');
    
    if (!filterTypeElement || !filterStepElement) {
        console.warn('Filter elements not found');
        return;
    }
    
    const filterType = filterTypeElement.value;
    const filterStep = filterStepElement.value;
    const filterEmptyField = filterEmptyFieldElement ? filterEmptyFieldElement.value : 'all';
    
    const students = this.getAllStudents();
    
    console.log(`🔍 Filtering ${students.length} students by type: ${filterType}, step: ${filterStep}, empty field: ${filterEmptyField}`);
    
    let filteredStudents = students;
    
    // Filter by educational/defense steps
    if (filterType === 'educational' && filterStep !== 'all') {
        const selectedStepIndex = parseInt(filterStep);
        
        filteredStudents = filteredStudents.filter(s => {
            const steps = s.educationalSteps || this.getDefaultEducationalSteps();
            const currentStepIndex = steps.findIndex(step => !step.completed);
            
            if (filterStep === 'completed') {
                const allCompleted = currentStepIndex === -1;
                if (allCompleted) {
                    console.log(`  ✅ ${s.name}: همه مراحل تکمیل شده`);
                }
                return allCompleted;
            } else {
                const matches = currentStepIndex >= selectedStepIndex || currentStepIndex === -1;
                if (matches) {
                    const currentStep = currentStepIndex === -1 ? 'تکمیل شده' : steps[currentStepIndex]?.name;
                    console.log(`  ✅ ${s.name}: مرحله فعلی ${currentStepIndex} (${currentStep}) >= ${selectedStepIndex}`);
                }
                return matches;
            }
        });
    } else if (filterType === 'defense' && filterStep !== 'all') {
        const selectedStepIndex = parseInt(filterStep);
        
        filteredStudents = filteredStudents.filter(s => {
            const steps = s.defenseSteps || this.getDefaultDefenseSteps2();
            const currentStepIndex = steps.findIndex(step => !step.completed);
            
            if (filterStep === 'completed') {
                const allCompleted = currentStepIndex === -1;
                if (allCompleted) {
                    console.log(`  ✅ ${s.name}: همه مراحل دفاع تکمیل شده`);
                }
                return allCompleted;
            } else {
                const matches = currentStepIndex >= selectedStepIndex || currentStepIndex === -1;
                if (matches) {
                    const currentStep = currentStepIndex === -1 ? 'تکمیل شده' : steps[currentStepIndex]?.name;
                    console.log(`  ✅ ${s.name}: مرحله فعلی ${currentStepIndex} (${currentStep}) >= ${selectedStepIndex}`);
                }
                return matches;
            }
        });
    }
    
    // Filter by empty fields
    if (filterEmptyField !== 'all') {
        filteredStudents = filteredStudents.filter(s => {
            const fieldValue = s[filterEmptyField];
            const isEmpty = !fieldValue || fieldValue === '' || fieldValue === null || fieldValue === undefined;
            if (isEmpty) {
                console.log(`  ✅ ${s.name}: فیلد ${filterEmptyField} خالی است`);
            }
            return isEmpty;
        });
    }
    
    console.log(`📊 Filtered result: ${filteredStudents.length} students`);
    
    // Update the display
    const container = document.getElementById('students-list-container');
    const countSpan = document.getElementById('filter-count');
    
    if (countSpan) {
        countSpan.textContent = filteredStudents.length;
    }
    
    if (container) {
        if (filteredStudents.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-user-graduate text-4xl text-gray-500 mb-4"></i>
                    <p class="text-gray-400">دانشجویی با این فیلتر یافت نشد</p>
                    <p class="text-sm text-gray-500 mt-2">نوع: ${filterType}, مرحله: ${filterStep}, فیلد خالی: ${filterEmptyField}</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${filteredStudents.map(student => this.getStudentCardWithProgress(student)).join('')}
                </div>
            `;
        }
    }
};

// Update clearStudentFilter to reset empty field filter too
EmployeeModule.clearStudentFilter = function() {
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-step').value = 'all';
    const filterEmptyField = document.getElementById('filter-empty-field');
    if (filterEmptyField) {
        filterEmptyField.value = 'all';
    }
    this.applyStudentFilter();
};


// Switch between active and inactive student list tabs
EmployeeModule.switchStudentListTab = function(tab) {
    // Update tab styles
    const activeTab = document.getElementById('student-list-tab-active');
    const inactiveTab = document.getElementById('student-list-tab-inactive');
    const activeContainer = document.getElementById('students-list-container-active');
    const inactiveContainer = document.getElementById('students-list-container-inactive');
    
    if (tab === 'active') {
        activeTab.classList.remove('border-transparent', 'text-gray-400');
        activeTab.classList.add('border-green-500', 'text-green-400');
        inactiveTab.classList.remove('border-gray-500', 'text-gray-300');
        inactiveTab.classList.add('border-transparent', 'text-gray-400');
        
        activeContainer.style.display = 'block';
        inactiveContainer.style.display = 'none';
    } else {
        inactiveTab.classList.remove('border-transparent', 'text-gray-400');
        inactiveTab.classList.add('border-gray-500', 'text-gray-300');
        activeTab.classList.remove('border-green-500', 'text-green-400');
        activeTab.classList.add('border-transparent', 'text-gray-400');
        
        inactiveContainer.style.display = 'block';
        activeContainer.style.display = 'none';
    }
};

// Switch path tab (educational, defense, requirements)
EmployeeModule.switchPathTab = function(tab, studentId) {
    // Update tab styles
    const educationalTab = document.getElementById('path-tab-educational');
    const defenseTab = document.getElementById('path-tab-defense');
    const requirementsTab = document.getElementById('path-tab-requirements');
    const educationalContent = document.getElementById('path-content-educational');
    const defenseContent = document.getElementById('path-content-defense');
    const requirementsContent = document.getElementById('path-content-requirements');
    
    // Reset all tabs
    [educationalTab, defenseTab, requirementsTab].forEach(t => {
        if (t) {
            t.classList.remove('border-indigo-500', 'text-indigo-600');
            t.classList.add('border-transparent', 'text-gray-600');
        }
    });
    
    // Hide all content
    [educationalContent, defenseContent, requirementsContent].forEach(c => {
        if (c) c.style.display = 'none';
    });
    
    // Show selected tab
    if (tab === 'educational' && educationalTab && educationalContent) {
        educationalTab.classList.remove('border-transparent', 'text-gray-600');
        educationalTab.classList.add('border-indigo-500', 'text-indigo-600');
        educationalContent.style.display = 'block';
    } else if (tab === 'defense' && defenseTab && defenseContent) {
        defenseTab.classList.remove('border-transparent', 'text-gray-600');
        defenseTab.classList.add('border-indigo-500', 'text-indigo-600');
        defenseContent.style.display = 'block';
    } else if (tab === 'requirements' && requirementsTab && requirementsContent) {
        requirementsTab.classList.remove('border-transparent', 'text-gray-600');
        requirementsTab.classList.add('border-indigo-500', 'text-indigo-600');
        requirementsContent.style.display = 'block';
    }
};

// Finish student work (deactivate student)
EmployeeModule.finishStudentWork = function(studentId) {
    if (!confirm('آیا مطمئن هستید که می‌خواهید دانشجو را به حالت غیرفعال تغییر دهید؟\nدانشجو به قسمت "دانشجویان خاتمه یافته" منتقل خواهد شد.')) {
        return;
    }
    
    // Get student data
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student) {
        UTILS.showNotification('دانشجو یافت نشد', 'error');
        return;
    }
    
    // Deactivate student
    student.active = false;
    student.finishedDate = new Date().toISOString();
    
    // Save
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Also update in DataModule if exists
    if (typeof DataModule !== 'undefined' && DataModule.updateUser) {
        DataModule.updateUser(studentId, { active: false, finishedDate: student.finishedDate });
    }
    
    UTILS.showNotification('دانشجو با موفقیت به حالت غیرفعال تغییر یافت', 'success');
    
    // Close modal and refresh
    this.closeModal('edit-student-modal');
    
    // Refresh the students page
    if (typeof appController !== 'undefined') {
        const content = this.getStudentsContent(appController().currentUser.id);
        const studentsContainer = document.querySelector('[x-show="currentPage === \'students\'"]');
        if (studentsContainer) {
            studentsContainer.innerHTML = content;
        }
    }
};

// Get requirements steps timeline
EmployeeModule.getRequirementsStepsTimeline = function(student) {
    const requirementsSteps = student.requirementsSteps || this.getDefaultRequirementsSteps();
    
    return `
        <div class="space-y-4">
            ${requirementsSteps.map((step, index) => `
                <div class="flex items-start space-x-4 space-x-reverse">
                    <!-- Step Icon -->
                    <div class="flex-shrink-0">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center ${step.completed ? 'bg-green-500' : 'bg-gray-400'}">
                            <i class="fas ${step.completed ? 'fa-check' : 'fa-circle'} text-white"></i>
                        </div>
                        ${index < requirementsSteps.length - 1 ? `
                            <div class="w-0.5 h-12 bg-gray-300 mx-auto mt-2"></div>
                        ` : ''}
                    </div>
                    
                    <!-- Step Content -->
                    <div class="flex-1 bg-gray-50 rounded-lg p-4 border ${step.completed ? 'border-green-300' : 'border-gray-300'}">
                        <div class="flex items-center justify-between mb-2">
                            <h5 class="font-bold text-gray-800">${step.name}</h5>
                            <label class="flex items-center cursor-pointer">
                                <input type="checkbox" ${step.completed ? 'checked' : ''} 
                                       onchange="employeeModule.toggleRequirementStep('${student.id}', ${index})"
                                       class="w-5 h-5 text-green-600 bg-white border-gray-300 rounded focus:ring-green-500">
                                <span class="mr-2 text-sm text-gray-600">${step.completed ? 'تکمیل شده' : 'تکمیل نشده'}</span>
                            </label>
                        </div>
                        ${step.date ? `
                            <p class="text-xs text-gray-500">
                                <i class="fas fa-calendar ml-1"></i>
                                تاریخ: ${new Date(step.date).toLocaleDateString('fa-IR')}
                            </p>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
};

// Get default requirements steps
EmployeeModule.getDefaultRequirementsSteps = function() {
    return [
        { name: 'امر اداری', completed: false, date: null },
        { name: 'پروپوزال', completed: false, date: null },
        { name: 'مدرک لغت', completed: false, date: null },
        { name: 'ترجمه پایان نامه فارسی', completed: false, date: null },
        { name: 'ملخص', completed: false, date: null },
        { name: 'مشابهت', completed: false, date: null },
        { name: 'ترجمه', completed: false, date: null },
        { name: 'قطعه', completed: false, date: null },
        { name: 'لافته', completed: false, date: null },
        { name: 'چهارنسخه', completed: false, date: null },
        { name: 'تنضید رساله', completed: false, date: null }
    ];
};

// Toggle requirement step completion
EmployeeModule.toggleRequirementStep = function(studentId, stepIndex) {
    // Get student data
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student) {
        UTILS.showNotification('دانشجو یافت نشد', 'error');
        return;
    }
    
    // Initialize requirements steps if not exist
    if (!student.requirementsSteps) {
        student.requirementsSteps = this.getDefaultRequirementsSteps();
    }
    
    // Toggle the step
    student.requirementsSteps[stepIndex].completed = !student.requirementsSteps[stepIndex].completed;
    
    // Set date if completed
    if (student.requirementsSteps[stepIndex].completed) {
        student.requirementsSteps[stepIndex].date = new Date().toISOString();
    } else {
        student.requirementsSteps[stepIndex].date = null;
    }
    
    // Save
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Also update in DataModule if exists
    if (typeof DataModule !== 'undefined' && DataModule.updateUser) {
        DataModule.updateUser(studentId, { requirementsSteps: student.requirementsSteps });
    }
    
    UTILS.showNotification('وضعیت مرحله به‌روز شد', 'success');
};


// Educational Steps Management Functions

// Add new educational step
EmployeeModule.addNewEducationalStep = function(studentId) {
    const stepName = prompt('نام مرحله جدید را وارد کنید:');
    if (!stepName || !stepName.trim()) return;
    
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student) {
        UTILS.showNotification('دانشجو یافت نشد', 'error');
        return;
    }
    
    if (!student.educationalSteps) {
        student.educationalSteps = this.getDefaultEducationalSteps();
    }
    
    student.educationalSteps.push({
        name: stepName.trim(),
        completed: false,
        date: null,
        notes: ''
    });
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Refresh view
    const educationalContentDiv = document.getElementById('path-content-educational');
    if (educationalContentDiv) {
        educationalContentDiv.innerHTML = this.getEducationalStepsTimeline(student);
    }
    
    UTILS.showNotification('مرحله جدید اضافه شد', 'success');
};

// Edit educational step name
EmployeeModule.editEducationalStepName = function(studentId, stepIndex) {
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student || !student.educationalSteps || !student.educationalSteps[stepIndex]) {
        UTILS.showNotification('مرحله یافت نشد', 'error');
        return;
    }
    
    const currentName = student.educationalSteps[stepIndex].name;
    const newName = prompt('نام جدید مرحله:', currentName);
    
    if (!newName || !newName.trim() || newName.trim() === currentName) return;
    
    student.educationalSteps[stepIndex].name = newName.trim();
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Refresh view
    const educationalContentDiv = document.getElementById('path-content-educational');
    if (educationalContentDiv) {
        educationalContentDiv.innerHTML = this.getEducationalStepsTimeline(student);
    }
    
    UTILS.showNotification('نام مرحله تغییر کرد', 'success');
};

// Move educational step up
EmployeeModule.moveEducationalStepUp = function(studentId, stepIndex) {
    if (stepIndex === 0) return;
    
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student || !student.educationalSteps) {
        UTILS.showNotification('مرحله یافت نشد', 'error');
        return;
    }
    
    // Swap with previous step
    const temp = student.educationalSteps[stepIndex];
    student.educationalSteps[stepIndex] = student.educationalSteps[stepIndex - 1];
    student.educationalSteps[stepIndex - 1] = temp;
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Refresh view
    const educationalContentDiv = document.getElementById('path-content-educational');
    if (educationalContentDiv) {
        educationalContentDiv.innerHTML = this.getEducationalStepsTimeline(student);
    }
    
    UTILS.showNotification('مرحله جابجا شد', 'success');
};

// Move educational step down
EmployeeModule.moveEducationalStepDown = function(studentId, stepIndex) {
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student || !student.educationalSteps || stepIndex >= student.educationalSteps.length - 1) {
        return;
    }
    
    // Swap with next step
    const temp = student.educationalSteps[stepIndex];
    student.educationalSteps[stepIndex] = student.educationalSteps[stepIndex + 1];
    student.educationalSteps[stepIndex + 1] = temp;
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Refresh view
    const educationalContentDiv = document.getElementById('path-content-educational');
    if (educationalContentDiv) {
        educationalContentDiv.innerHTML = this.getEducationalStepsTimeline(student);
    }
    
    UTILS.showNotification('مرحله جابجا شد', 'success');
};

// Delete educational step
EmployeeModule.deleteEducationalStep = function(studentId, stepIndex) {
    if (!confirm('آیا مطمئن هستید که می‌خواهید این مرحله را حذف کنید؟')) {
        return;
    }
    
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student || !student.educationalSteps) {
        UTILS.showNotification('مرحله یافت نشد', 'error');
        return;
    }
    
    student.educationalSteps.splice(stepIndex, 1);
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Refresh view
    const educationalContentDiv = document.getElementById('path-content-educational');
    if (educationalContentDiv) {
        educationalContentDiv.innerHTML = this.getEducationalStepsTimeline(student);
    }
    
    UTILS.showNotification('مرحله حذف شد', 'success');
};

// Defense Steps Management Functions

// Add new defense step
EmployeeModule.addNewDefenseStep = function(studentId) {
    const stepName = prompt('نام مرحله جدید را وارد کنید:');
    if (!stepName || !stepName.trim()) return;
    
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student) {
        UTILS.showNotification('دانشجو یافت نشد', 'error');
        return;
    }
    
    if (!student.defenseSteps) {
        student.defenseSteps = this.getDefaultDefenseSteps2();
    }
    
    student.defenseSteps.push({
        name: stepName.trim(),
        completed: false,
        date: null,
        notes: ''
    });
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Refresh view
    const defenseContentDiv = document.getElementById('path-content-defense');
    if (defenseContentDiv) {
        defenseContentDiv.innerHTML = this.getDefenseStepsTimeline(student);
    }
    
    UTILS.showNotification('مرحله جدید اضافه شد', 'success');
};

// Edit defense step name
EmployeeModule.editDefenseStepName = function(studentId, stepIndex) {
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student || !student.defenseSteps || !student.defenseSteps[stepIndex]) {
        UTILS.showNotification('مرحله یافت نشد', 'error');
        return;
    }
    
    const currentName = student.defenseSteps[stepIndex].name;
    const newName = prompt('نام جدید مرحله:', currentName);
    
    if (!newName || !newName.trim() || newName.trim() === currentName) return;
    
    student.defenseSteps[stepIndex].name = newName.trim();
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Refresh view
    const defenseContentDiv = document.getElementById('path-content-defense');
    if (defenseContentDiv) {
        defenseContentDiv.innerHTML = this.getDefenseStepsTimeline(student);
    }
    
    UTILS.showNotification('نام مرحله تغییر کرد', 'success');
};

// Edit defense step details (for تحدید مناقشه)
EmployeeModule.editDefenseStepDetails = function(studentId, stepIndex) {
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student || !student.defenseSteps || !student.defenseSteps[stepIndex]) {
        UTILS.showNotification('مرحله یافت نشد', 'error');
        return;
    }
    
    const step = student.defenseSteps[stepIndex];
    
    const modalHTML = `
        <div id="defense-details-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-lg max-w-md w-full p-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-edit text-blue-600 ml-2"></i>
                    ویرایش جزئیات ${step.name}
                </h3>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">تاریخ دفاع</label>
                        <input type="date" id="defense-date" value="${step.defenseDate || ''}"
                               class="w-full border border-gray-300 rounded-lg px-4 py-2">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">داور اول</label>
                        <input type="text" id="referee1" value="${step.referee1 || ''}" placeholder="نام داور اول"
                               class="w-full border border-gray-300 rounded-lg px-4 py-2">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">داور دوم</label>
                        <input type="text" id="referee2" value="${step.referee2 || ''}" placeholder="نام داور دوم"
                               class="w-full border border-gray-300 rounded-lg px-4 py-2">
                    </div>
                </div>
                
                <div class="flex justify-end space-x-3 space-x-reverse mt-6">
                    <button onclick="employeeModule.closeModal('defense-details-modal')" 
                            class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                        انصراف
                    </button>
                    <button onclick="employeeModule.saveDefenseStepDetails('${studentId}', ${stepIndex})" 
                            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                        <i class="fas fa-save ml-2"></i>
                        ذخیره
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// Save defense step details
EmployeeModule.saveDefenseStepDetails = function(studentId, stepIndex) {
    const defenseDate = document.getElementById('defense-date').value;
    const referee1 = document.getElementById('referee1').value.trim();
    const referee2 = document.getElementById('referee2').value.trim();
    
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student || !student.defenseSteps || !student.defenseSteps[stepIndex]) {
        UTILS.showNotification('مرحله یافت نشد', 'error');
        return;
    }
    
    student.defenseSteps[stepIndex].defenseDate = defenseDate;
    student.defenseSteps[stepIndex].referee1 = referee1;
    student.defenseSteps[stepIndex].referee2 = referee2;
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Close modal
    this.closeModal('defense-details-modal');
    
    // Refresh view
    const defenseContentDiv = document.getElementById('path-content-defense');
    if (defenseContentDiv) {
        defenseContentDiv.innerHTML = this.getDefenseStepsTimeline(student);
    }
    
    UTILS.showNotification('جزئیات مرحله به‌روز شد', 'success');
};

// Move defense step up
EmployeeModule.moveDefenseStepUp = function(studentId, stepIndex) {
    if (stepIndex === 0) return;
    
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student || !student.defenseSteps) {
        UTILS.showNotification('مرحله یافت نشد', 'error');
        return;
    }
    
    // Swap with previous step
    const temp = student.defenseSteps[stepIndex];
    student.defenseSteps[stepIndex] = student.defenseSteps[stepIndex - 1];
    student.defenseSteps[stepIndex - 1] = temp;
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Refresh view
    const defenseContentDiv = document.getElementById('path-content-defense');
    if (defenseContentDiv) {
        defenseContentDiv.innerHTML = this.getDefenseStepsTimeline(student);
    }
    
    UTILS.showNotification('مرحله جابجا شد', 'success');
};

// Move defense step down
EmployeeModule.moveDefenseStepDown = function(studentId, stepIndex) {
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student || !student.defenseSteps || stepIndex >= student.defenseSteps.length - 1) {
        return;
    }
    
    // Swap with next step
    const temp = student.defenseSteps[stepIndex];
    student.defenseSteps[stepIndex] = student.defenseSteps[stepIndex + 1];
    student.defenseSteps[stepIndex + 1] = temp;
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Refresh view
    const defenseContentDiv = document.getElementById('path-content-defense');
    if (defenseContentDiv) {
        defenseContentDiv.innerHTML = this.getDefenseStepsTimeline(student);
    }
    
    UTILS.showNotification('مرحله جابجا شد', 'success');
};

// Delete defense step
EmployeeModule.deleteDefenseStep = function(studentId, stepIndex) {
    if (!confirm('آیا مطمئن هستید که می‌خواهید این مرحله را حذف کنید؟')) {
        return;
    }
    
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    const student = studentsData[studentId];
    
    if (!student || !student.defenseSteps) {
        UTILS.showNotification('مرحله یافت نشد', 'error');
        return;
    }
    
    student.defenseSteps.splice(stepIndex, 1);
    
    studentsData[studentId] = student;
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    // Refresh view
    const defenseContentDiv = document.getElementById('path-content-defense');
    if (defenseContentDiv) {
        defenseContentDiv.innerHTML = this.getDefenseStepsTimeline(student);
    }
    
    UTILS.showNotification('مرحله حذف شد', 'success');
};

// Make EmployeeModule available globally for inline onclick handlers
window.EmployeeModule = EmployeeModule;
window.employeeModule = EmployeeModule; // alias with lowercase for compatibility
