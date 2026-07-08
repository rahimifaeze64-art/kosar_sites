// Order Tabs Module - محتوای تب‌های صفحه سفارش
const OrderTabsModule = {
    // Overview Tab - تب مشخصات کلی
    getOverviewTab(order, currentUser) {
        return `
            <div class="space-y-6">
                <!-- Order Header -->
                <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="text-xl font-bold text-gray-800">${order.studentName}</h4>
                            <p class="text-gray-600">${order.type}</p>
                            <p class="text-sm text-gray-500">${order.university} - ${order.field} - ${order.degree}</p>
                        </div>
                        <div class="text-left">
                            <span class="px-3 py-1 rounded-full text-sm font-medium ${typeof OrdersModule !== 'undefined' ? OrdersModule.getStatusClass(order.status) : 'bg-blue-100 text-blue-800'}">
                                ${typeof OrdersModule !== 'undefined' ? OrdersModule.getStatusText(order.status) : order.status}
                            </span>
                            <p class="text-lg font-bold text-green-600 mt-2">${order.totalAmount} تومان</p>
                        </div>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="mt-4">
                        <div class="flex justify-between text-sm text-gray-600 mb-1">
                            <span>پیشرفت کار</span>
                            <span>${order.progress || 0}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-3">
                            <div class="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                                 style="width: ${order.progress || 0}%"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Assignment Info -->
                ${order.assignedDoctor ? `
                    <div class="bg-purple-50 p-4 rounded-lg">
                        <h5 class="font-semibold text-purple-800 mb-2">
                            <i class="fas fa-user-md ml-1"></i>
                            اطلاعات تخصیص
                        </h5>
                        <p><strong>عامل مسئول:</strong> ${order.assignedDoctor}</p>
                        <p><strong>تاریخ تخصیص:</strong> ${order.assignedAt}</p>
                        ${order.assignmentNotes ? `<p><strong>توضیحات:</strong> ${order.assignmentNotes}</p>` : ''}
                    </div>
                ` : ''}
                
                <!-- Student Details -->
                <div class="bg-white border rounded-lg p-4">
                    <h5 class="font-semibold text-gray-800 mb-3">
                        <i class="fas fa-user-graduate ml-1"></i>
                        مشخصات دانشجو
                    </h5>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><strong>نام:</strong> ${order.studentName}</div>
                        <div><strong>دانشگاه:</strong> ${order.university}</div>
                        <div><strong>رشته:</strong> ${order.field}</div>
                        <div><strong>مقطع:</strong> ${order.degree}</div>
                        <div><strong>نوع سفارش:</strong> ${order.type}</div>
                        <div><strong>مهلت تحویل:</strong> ${order.deadline}</div>
                    </div>
                    ${order.description ? `
                        <div class="mt-4">
                            <strong>توضیحات:</strong>
                            <p class="text-gray-600 mt-1">${order.description}</p>
                        </div>
                    ` : ''}
                    
                    <!-- Additional Student Info -->
                    ${order.nickname ? `<div><strong>لقب:</strong> ${order.nickname}</div>` : ''}
                    ${order.birthDate ? `<div><strong>تاریخ تولد:</strong> ${order.birthDate}</div>` : ''}
                    ${order.passportNumber ? `<div><strong>شماره پاسپورت:</strong> ${order.passportNumber}</div>` : ''}
                    ${order.gender ? `<div><strong>جنسیت:</strong> ${order.gender}</div>` : ''}
                    ${order.phone ? `<div><strong>شماره تماس:</strong> ${order.phone}</div>` : ''}
                    ${order.behestanUsername ? `<div><strong>نام کاربری بهستان:</strong> ${order.behestanUsername}</div>` : ''}
                    ${order.studentId ? `<div><strong>شماره دانشجویی:</strong> ${order.studentId}</div>` : ''}
                    
                    <!-- Custom Fields from Step 1 -->
                    ${order.customFields1 && order.customFields1.length > 0 ? `
                        <div class="col-span-2 mt-4 pt-4 border-t">
                            <strong class="block mb-2">فیلدهای اضافی:</strong>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                ${order.customFields1.map(field => `
                                    <div class="text-sm">
                                        <span class="text-gray-600">${field.label}:</span>
                                        <span class="text-gray-800">${field.value}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    // Work List Tab - تب لیست کارها
    getWorkListTab(order, currentUser) {
        const isManager = currentUser.role === CONFIG.ROLES.MANAGER;
        const workList = order.workList || [];
        const workDetails = order.workDetails || {};
        const workPrices = order.workPrices || {};
        
        // Helper function to check if work is delayed
        const isDelayed = (deadline) => {
            if (!deadline) return false;
            const today = new Date();
            const dueDate = new Date(deadline);
            return dueDate < today;
        };
        
        // Helper function to get days remaining
        const getDaysRemaining = (deadline) => {
            if (!deadline) return null;
            const today = new Date();
            const dueDate = new Date(deadline);
            const diffTime = dueDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        };
        
        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h4 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-tasks ml-2"></i>
                        لیست کارها و اولویت‌ها
                    </h4>
                    ${isManager ? `
                        <button onclick="editWorkList('${order.id}')" 
                                class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            <i class="fas fa-edit ml-2"></i>
                            ویرایش لیست کارها
                        </button>
                    ` : ''}
                </div>
                
                <!-- Work List -->
                <div class="bg-white border rounded-lg p-4">
                    ${workList.length === 0 ? `
                        <div class="text-center py-8">
                            <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">هنوز کاری تعریف نشده است</p>
                        </div>
                    ` : `
                        <div class="space-y-3">
                            ${workList.map((work, index) => {
                                const details = workDetails[work] || {};
                                const deadline = details.deadline;
                                const price = workPrices[work] || 0;
                                const delayed = deadline && isDelayed(deadline);
                                const daysRemaining = deadline ? getDaysRemaining(deadline) : null;
                                
                                let statusColor = 'bg-green-100 border-green-200';
                                let statusText = 'در موعد';
                                let statusIcon = 'check-circle';
                                
                                if (delayed) {
                                    statusColor = 'bg-red-100 border-red-200';
                                    statusText = 'تاخیر دارد';
                                    statusIcon = 'exclamation-circle';
                                } else if (daysRemaining !== null && daysRemaining <= 3) {
                                    statusColor = 'bg-yellow-100 border-yellow-200';
                                    statusText = 'نزدیک به موعد';
                                    statusIcon = 'clock';
                                }
                                
                                return `
                                    <div class="flex items-start bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border ${statusColor}">
                                        <div class="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg ml-4">
                                            ${index + 1}
                                        </div>
                                        <div class="flex-1">
                                            <h5 class="font-bold text-gray-800 text-lg mb-2">${work}</h5>
                                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                                <div class="flex items-center">
                                                    <i class="fas fa-calendar-alt text-blue-600 ml-2"></i>
                                                    <div>
                                                        <p class="text-gray-600 text-xs">زمان تحویل</p>
                                                        <p class="font-medium text-gray-800">${deadline || 'تعیین نشده'}</p>
                                                    </div>
                                                </div>
                                                <div class="flex items-center">
                                                    <i class="fas fa-money-bill-wave text-green-600 ml-2"></i>
                                                    <div>
                                                        <p class="text-gray-600 text-xs">قیمت</p>
                                                        <p class="font-medium text-gray-800">${price.toLocaleString()} ${order.currency || 'تومان'}</p>
                                                    </div>
                                                </div>
                                                <div class="flex items-center">
                                                    <i class="fas fa-${statusIcon} ${delayed ? 'text-red-600' : daysRemaining <= 3 ? 'text-yellow-600' : 'text-green-600'} ml-2"></i>
                                                    <div>
                                                        <p class="text-gray-600 text-xs">وضعیت</p>
                                                        <p class="font-medium ${delayed ? 'text-red-600' : daysRemaining <= 3 ? 'text-yellow-600' : 'text-green-600'}">
                                                            ${statusText}
                                                            ${daysRemaining !== null ? `(${daysRemaining > 0 ? daysRemaining + ' روز مانده' : Math.abs(daysRemaining) + ' روز تاخیر'})` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex-shrink-0">
                                            <span class="px-3 py-1 ${delayed ? 'bg-red-100 text-red-800' : daysRemaining <= 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'} rounded-full text-sm font-medium">
                                                <i class="fas fa-${statusIcon} ml-1"></i>
                                                ${statusText}
                                            </span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
                
                <!-- Custom Fields from Step 2 -->
                ${order.customFields2 && order.customFields2.length > 0 ? `
                    <div class="bg-white border rounded-lg p-4">
                        <h5 class="font-semibold text-gray-800 mb-3">فیلدهای اضافی نوع کار</h5>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            ${order.customFields2.map(field => `
                                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <span class="font-medium text-gray-700">${field.label}:</span>
                                    <span class="text-gray-900">${field.value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Work Statistics -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <i class="fas fa-list-ol text-3xl text-blue-600 mb-2"></i>
                        <p class="text-sm text-blue-700">تعداد کل کارها</p>
                        <p class="text-2xl font-bold text-blue-900">${workList.length}</p>
                    </div>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <i class="fas fa-check-double text-3xl text-green-600 mb-2"></i>
                        <p class="text-sm text-green-700">در موعد</p>
                        <p class="text-2xl font-bold text-green-900">${workList.filter(w => {
                            const d = workDetails[w]?.deadline;
                            return d && !isDelayed(d) && getDaysRemaining(d) > 3;
                        }).length}</p>
                    </div>
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                        <i class="fas fa-clock text-3xl text-yellow-600 mb-2"></i>
                        <p class="text-sm text-yellow-700">نزدیک به موعد</p>
                        <p class="text-2xl font-bold text-yellow-900">${workList.filter(w => {
                            const d = workDetails[w]?.deadline;
                            const days = d ? getDaysRemaining(d) : null;
                            return days !== null && days <= 3 && days >= 0;
                        }).length}</p>
                    </div>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <i class="fas fa-exclamation-triangle text-3xl text-red-600 mb-2"></i>
                        <p class="text-sm text-red-700">تاخیر دارد</p>
                        <p class="text-2xl font-bold text-red-900">${workList.filter(w => {
                            const d = workDetails[w]?.deadline;
                            return d && isDelayed(d);
                        }).length}</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Follow-up Tab - تب پیگیری (ترکیب فایل‌ها و گفتگوها)
    getFollowUpTab(order, currentUser) {
        const isManager = currentUser.role === CONFIG.ROLES.MANAGER;
        const isemployee = currentUser.role === CONFIG.ROLES.employee;
        const isAssignedDoctor = currentUser.id === order.assignedDoctorId;
        const canUploadFiles = true;
        const canSendMessage = isManager || isemployee || isAssignedDoctor;
        
        const files = order.files || [];
        const messages = order.questions || [];
        
        return `
            <div class="space-y-6">
                <h4 class="text-xl font-bold text-gray-800">
                    <i class="fas fa-clipboard-check ml-2"></i>
                    پیگیری سفارش
                </h4>
                
                <!-- Files Section -->
                <div class="bg-white border rounded-lg p-4">
                    <div class="flex justify-between items-center mb-4">
                        <h5 class="text-lg font-semibold text-gray-800">
                            <i class="fas fa-file ml-2"></i>
                            فایل‌های پروژه
                        </h5>
                        ${canUploadFiles ? `
                            <button onclick="OrderTabsModule.showUploadFileModal('${order.id}')" 
                                    class="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                <i class="fas fa-upload ml-2"></i>
                                آپلود فایل
                            </button>
                        ` : ''}
                    </div>
                    
                    ${files.length === 0 ? `
                        <div class="text-center py-6 bg-gray-50 rounded-lg">
                            <i class="fas fa-file text-3xl text-gray-300 mb-3"></i>
                            <p class="text-gray-500 text-sm">هنوز فایلی آپلود نشده است</p>
                            ${canUploadFiles ? '<p class="text-xs text-gray-400 mt-1">اولین فایل را آپلود کنید</p>' : ''}
                        </div>
                    ` : `
                        <div class="space-y-2 max-h-[300px] overflow-y-auto">
                            ${files.map(file => `
                                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                    <div class="flex items-center flex-1">
                                        <i class="fas fa-file text-xl text-blue-600 ml-3"></i>
                                        <div class="flex-1 min-w-0">
                                            <p class="font-medium text-gray-800 truncate">${file.name}</p>
                                            <div class="flex items-center space-x-2 space-x-reverse text-xs text-gray-500 mt-1">
                                                ${file.fileType ? `<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">${file.fileType}</span>` : ''}
                                                <span>${file.uploadedByName || 'نامشخص'}</span>
                                                <span>•</span>
                                                <span>${file.uploadedAt}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex space-x-2 space-x-reverse">
                                        <button onclick="downloadFile('${file.id}')" 
                                                class="text-blue-600 hover:text-blue-800 p-2" title="دانلود">
                                            <i class="fas fa-download"></i>
                                        </button>
                                        ${canUploadFiles ? `
                                            <button onclick="deleteFile('${file.id}', '${order.id}')" 
                                                    class="text-red-600 hover:text-red-800 p-2" title="حذف">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                    
                    ${canUploadFiles && files.length > 0 ? `
                        <div class="mt-3 pt-3 border-t">
                            <p class="text-xs text-gray-500">
                                <i class="fas fa-info-circle ml-1"></i>
                                فرمت‌های مجاز: PDF, DOC, DOCX, TXT, JPG, PNG, GIF • حداکثر حجم: 10 مگابایت
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    // Files Tab - تب فایل‌ها (DEPRECATED - use getFollowUpTab instead)
    getFilesTab(order, currentUser) {
        // همه نقش‌ها می‌توانند فایل آپلود کنند - حل مشکل سوم
        const canUploadFiles = true; // تغییر از isAssignedDoctor به true
        const files = order.files || [];
        
        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h4 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-file ml-2"></i>
                        فایل‌های پروژه
                    </h4>
                    ${canUploadFiles ? `
                        <button onclick="uploadFile('${order.id}')" 
                                class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            <i class="fas fa-upload ml-2"></i>
                            آپلود فایل جدید
                        </button>
                    ` : ''}
                </div>
                
                <div class="bg-white border rounded-lg p-4">
                    ${files.length === 0 ? `
                        <div class="text-center py-8">
                            <i class="fas fa-file text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">هنوز فایلی آپلود نشده است</p>
                            ${canUploadFiles ? '<p class="text-sm text-gray-400 mt-2">اولین فایل را آپلود کنید</p>' : ''}
                        </div>
                    ` : `
                        <div class="space-y-3">
                            ${files.map(file => `
                                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div class="flex items-center">
                                        <i class="fas fa-file text-2xl text-blue-600 ml-3"></i>
                                        <div>
                                            <p class="font-medium">${file.name}</p>
                                            <p class="text-sm text-gray-500">
                                                آپلود شده توسط ${file.uploadedByName || 'نامشخص'} در ${file.uploadedAt}
                                            </p>
                                        </div>
                                    </div>
                                    <div class="flex space-x-2 space-x-reverse">
                                        <button onclick="downloadFile('${file.id}')" 
                                                class="text-blue-600 hover:text-blue-800 p-1" title="دانلود">
                                            <i class="fas fa-download"></i>
                                        </button>
                                        ${canUploadFiles ? `
                                            <button onclick="deleteFile('${file.id}', '${order.id}')" 
                                                    class="text-red-600 hover:text-red-800 p-1" title="حذف">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
                
                ${canUploadFiles ? `
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h5 class="font-semibold text-blue-800 mb-2">راهنمای آپلود فایل</h5>
                        <ul class="text-sm text-blue-700 space-y-1">
                            <li>• فرمت‌های مجاز: PDF, DOC, DOCX, TXT, JPG, PNG, GIF</li>
                            <li>• حداکثر حجم فایل: 10 مگابایت</li>
                            <li>• نام فایل‌ها را به صورت توصیفی انتخاب کنید</li>
                            <li>• همه اعضای تیم می‌توانند فایل آپلود کنند</li>
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Chat Tab - تب گفتگوها
    getChatTab(order, currentUser) {
        const isManager = currentUser.role === CONFIG.ROLES.MANAGER;
        const isemployee = currentUser.role === CONFIG.ROLES.employee;
        const isAssignedDoctor = currentUser.id === order.assignedDoctorId;
        const canSendMessage = isManager || isemployee || isAssignedDoctor;
        
        const messages = order.questions || [];
        
        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h4 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-comments ml-2"></i>
                        گفتگوها
                    </h4>
                    <span class="text-sm text-gray-500">${messages.length} پیام</span>
                </div>
                
                <!-- Messages Area -->
                <div class="bg-white border rounded-lg p-4 min-h-[400px] max-h-[500px] overflow-y-auto">
                    ${messages.length === 0 ? `
                        <div class="text-center py-8">
                            <i class="fas fa-comments text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">هنوز پیامی ارسال نشده است</p>
                            ${canSendMessage ? '<p class="text-sm text-gray-400 mt-2">اولین پیام را ارسال کنید</p>' : ''}
                        </div>
                    ` : `
                        <div class="space-y-4" id="messages-container">
                            ${messages.map(msg => this.getChatMessage(msg, currentUser)).join('')}
                        </div>
                    `}
                </div>
                
                <!-- Send Message Area -->
                ${canSendMessage ? `
                    <div class="bg-gray-50 border rounded-lg p-4">
                        <div class="space-y-3">
                            <textarea id="new-message-${order.id}" rows="3" 
                                      class="w-full border border-gray-300 rounded-lg px-3 py-2"
                                      placeholder="پیام خود را بنویسید..."></textarea>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-gray-500">
                                    ${isAssignedDoctor ? 'پیام شما برای مدیر ارسال خواهد شد' : 'پیام شما برای عامل ارسال خواهد شد'}
                                </span>
                                <button onclick="sendMessage('${order.id}')" 
                                        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                                    <i class="fas fa-paper-plane ml-2"></i>
                                    ارسال پیام
                                </button>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p class="text-yellow-800 text-center">
                            <i class="fas fa-lock ml-2"></i>
                            شما مجاز به ارسال پیام در این گفتگو نیستید
                        </p>
                    </div>
                `}
            </div>
        `;
    },
    
    // Get individual chat message
    getChatMessage(message, currentUser) {
        const isMyMessage = message.askedBy === currentUser.id;
        const messageClass = isMyMessage ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8';
        
        return `
            <div class="message ${messageClass} p-4 rounded-lg">
                <div class="flex justify-between items-start mb-2">
                    <div class="font-medium text-gray-800">
                        ${message.askedByName || 'کاربر'}
                    </div>
                    <div class="text-xs text-gray-500">
                        ${message.askedAt}
                    </div>
                </div>
                <div class="text-gray-700">
                    ${message.question}
                </div>
                ${message.answer ? `
                    <div class="mt-3 pt-3 border-t border-gray-200">
                        <div class="font-medium text-gray-800 mb-1">پاسخ:</div>
                        <div class="text-gray-700">${message.answer}</div>
                        <div class="text-xs text-gray-500 mt-1">${message.answeredAt}</div>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Financial Tab - تب مالی
    getFinancialTab(order, currentUser) {
        const isManager = currentUser.role === CONFIG.ROLES.MANAGER;
        const isAgent = currentUser.role === 'agent';
        const currency = order.currency || 'تومان';
        
        // برای عامل‌ها فقط درآمدشان را نمایش بده
        if (isAgent) {
            return `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h4 class="text-xl font-bold text-gray-800">
                            <i class="fas fa-dollar-sign ml-2"></i>
                            اطلاعات مالی
                        </h4>
                    </div>
                    
                    <!-- Currency Display -->
                    <div class="bg-gray-50 border rounded-lg p-3">
                        <span class="text-sm text-gray-600">واحد پول:</span>
                        <span class="font-bold text-gray-800 mr-2">${currency}</span>
                    </div>
                    
                    <!-- Agent Income Only -->
                    <div class="bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg p-8 text-white shadow-lg text-center">
                        <i class="fas fa-money-bill-wave text-5xl mb-4 opacity-80"></i>
                        <h5 class="text-lg font-semibold mb-2 opacity-90">درآمد شما از این سفارش</h5>
                        <p class="text-4xl font-bold mb-2">
                            ${(order.doctorShare || 0).toLocaleString()}
                        </p>
                        <p class="text-xl opacity-90">${currency}</p>
                    </div>
                    
                    <!-- Work List with Prices -->
                    ${order.workList && order.workList.length > 0 ? `
                        <div class="bg-white border rounded-lg p-4">
                            <h5 class="font-semibold text-gray-800 mb-3">
                                <i class="fas fa-list-ul ml-2"></i>
                                لیست کارها و قیمت‌ها
                            </h5>
                            <div class="space-y-2">
                                ${order.workList.map(work => {
                                    const price = (order.workPrices && order.workPrices[work]) || 0;
                                    return `
                                        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                            <span class="font-medium text-gray-700">${work}</span>
                                            <span class="text-green-600 font-bold">${price.toLocaleString()} ${currency}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p class="text-blue-800 text-sm">
                            <i class="fas fa-info-circle ml-2"></i>
                            این مبلغ درآمد شما از انجام این سفارش است. برای مشاهده کل درآمدهای خود به بخش "درآمد من" مراجعه کنید.
                        </p>
                    </div>
                </div>
            `;
        }
        
        // برای مدیر اطلاعات کامل مالی
        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h4 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-dollar-sign ml-2"></i>
                        اطلاعات مالی
                    </h4>
                    ${isManager ? `
                        <button onclick="editFinancialInfo('${order.id}')" 
                                class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            <i class="fas fa-edit ml-2"></i>
                            ویرایش اطلاعات مالی
                        </button>
                    ` : ''}
                </div>
                
                <!-- Currency Display -->
                <div class="bg-gray-50 border rounded-lg p-3">
                    <span class="text-sm text-gray-600">واحد پول:</span>
                    <span class="font-bold text-gray-800 mr-2">${currency}</span>
                </div>
                
                <!-- Financial Summary -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h5 class="font-semibold text-green-800 mb-2">مبلغ کل</h5>
                        <p class="text-2xl font-bold text-green-600">
                            ${(order.totalAmount || 0).toLocaleString()} ${currency}
                        </p>
                    </div>
                    
                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h5 class="font-semibold text-purple-800 mb-2">سهم واسط</h5>
                        <p class="text-2xl font-bold text-purple-600">
                            ${(order.agentShare || 0).toLocaleString()} ${currency}
                        </p>
                    </div>
                    
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h5 class="font-semibold text-red-800 mb-2">تخفیف</h5>
                        <p class="text-2xl font-bold text-red-600">
                            ${(order.discount || 0).toLocaleString()} ${currency}
                        </p>
                    </div>
                    
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h5 class="font-semibold text-blue-800 mb-2">سهم شرکت</h5>
                        <p class="text-2xl font-bold text-blue-600">
                            ${(order.companyShare || 0).toLocaleString()} ${currency}
                        </p>
                    </div>
                    
                    <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <h5 class="font-semibold text-indigo-800 mb-2">سهم عامل/عامل</h5>
                        <p class="text-2xl font-bold text-indigo-600">
                            ${(order.doctorShare || 0).toLocaleString()} ${currency}
                        </p>
                    </div>
                    
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h5 class="font-semibold text-yellow-800 mb-2">طلب از دانشجو</h5>
                        <p class="text-2xl font-bold text-yellow-600">
                            ${(order.studentDebt || 0).toLocaleString()} ${currency}
                        </p>
                    </div>
                    
                    <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <h5 class="font-semibold text-orange-800 mb-2">بدهی به عوامل</h5>
                        <p class="text-2xl font-bold text-orange-600">
                            ${(order.agentDebt || 0).toLocaleString()} ${currency}
                        </p>
                    </div>
                </div>
                
                <!-- Custom Financial Fields -->
                ${order.customFields3 && order.customFields3.length > 0 ? `
                    <div class="bg-white border rounded-lg p-4">
                        <h5 class="font-semibold text-gray-800 mb-3">فیلدهای اضافی مالی</h5>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            ${order.customFields3.map(field => `
                                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <span class="font-medium text-gray-700">${field.label}:</span>
                                    <span class="text-gray-900">${field.value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Payment Status -->
                <div class="bg-white border rounded-lg p-4">
                    <h5 class="font-semibold text-gray-800 mb-3">وضعیت پرداخت</h5>
                    <div class="space-y-3">
                        <div class="flex justify-between items-center">
                            <span>مبلغ پرداخت شده:</span>
                            <span class="font-bold text-green-600">
                                ${(order.paidAmount || 0).toLocaleString()} ${currency}
                            </span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span>مبلغ باقی‌مانده:</span>
                            <span class="font-bold text-red-600">
                                ${((order.totalAmount || 0) - (order.paidAmount || 0)).toLocaleString()} ${currency}
                            </span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-3">
                            <div class="bg-green-600 h-3 rounded-full" 
                                 style="width: ${((order.paidAmount || 0) / (order.totalAmount || 1)) * 100}%"></div>
                        </div>
                    </div>
                </div>
                
                ${isManager ? `
                    <!-- Payment Actions -->
                    <div class="bg-gray-50 border rounded-lg p-4">
                        <h5 class="font-semibold text-gray-800 mb-3">عملیات مالی</h5>
                        <div class="flex flex-wrap gap-3">
                            <button onclick="recordPayment('${order.id}')" 
                                    class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                                <i class="fas fa-plus ml-2"></i>
                                ثبت پرداخت
                            </button>
                            <button onclick="addStudentDebt('${order.id}')" 
                                    class="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700">
                                <i class="fas fa-user-plus ml-2"></i>
                                ثبت طلب از دانشجو
                            </button>
                            <button onclick="addAgentDebt('${order.id}')" 
                                    class="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">
                                <i class="fas fa-users ml-2"></i>
                                ثبت بدهی به عوامل
                            </button>
                            <button onclick="generateInvoice('${order.id}')" 
                                    class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                                <i class="fas fa-file-invoice ml-2"></i>
                                صدور فاکتور
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Progress Tab - تب پیشرفت کار
    getProgressTab(order, currentUser) {
        // استفاده از سیستم پیشرفت کار جدید برای همه انواع سفارش‌ها
        return `
            <div class="space-y-6">
                <!-- کانتینر سیستم پیشرفت کار -->
                <div id="thesis-workflow-container"></div>
            </div>
        `;
    },
    
    
    // History Tab - تب تاریخچه
    getHistoryTab(order, currentUser) {
        const workLog = order.workLog || [];
        
        return `
            <div class="space-y-6">
                <h4 class="text-xl font-bold text-gray-800">
                    <i class="fas fa-history ml-2"></i>
                    تاریخچه فعالیت‌ها
                </h4>
                
                <div class="bg-white border rounded-lg p-4">
                    ${workLog.length === 0 ? `
                        <div class="text-center py-8">
                            <i class="fas fa-history text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">هنوز فعالیتی ثبت نشده است</p>
                        </div>
                    ` : `
                        <div class="space-y-3">
                            ${workLog.map(log => `
                                <div class="flex items-start space-x-3 space-x-reverse p-3 bg-gray-50 rounded-lg">
                                    <div class="flex-shrink-0">
                                        <i class="fas fa-${this.getLogIcon(log.type)} text-blue-600"></i>
                                    </div>
                                    <div class="flex-1">
                                        <p class="text-sm font-medium text-gray-800">${log.message}</p>
                                        ${log.notes ? `<p class="text-sm text-gray-600 mt-1">${log.notes}</p>` : ''}
                                        <p class="text-xs text-gray-500 mt-1">${log.timestamp}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    },
    
    // Get log icon based on type
    getLogIcon(type) {
        const icons = {
            'assignment': 'user-plus',
            'file_upload': 'upload',
            'question': 'question',
            'answer': 'reply',
            'progress': 'chart-line',
            'completion': 'flag-checkered'
        };
        return icons[type] || 'info';
    },
    
    // Show upload file modal with file type selection
    showUploadFileModal(orderId) {
        const fileTypes = [
            'اولیه',
            'تعدیل شده',
            'تنضید قبل دفاع',
            'تنضید بعد دفاع',
            'تنضید اولیه',
            'تعدیل بعد دفاع',
            'استلال عراقی بعد دفاع',
            'تنضید ایرانداک',
            'سایر'
        ];
        
        const modalHTML = `
            <div class="modal-backdrop" onclick="OrderTabsModule.closeUploadModal(event)">
                <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-upload ml-2"></i>آپلود فایل جدید</h3>
                        <button onclick="OrderTabsModule.closeUploadModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="space-y-4">
                            <!-- File Type Selection -->
                            <div class="form-group">
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    <i class="fas fa-tag ml-1"></i>
                                    نوع فایل
                                </label>
                                <select id="file-type-select" class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    <option value="">انتخاب کنید...</option>
                                    ${fileTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
                                </select>
                            </div>
                            
                            <!-- File Input -->
                            <div class="form-group">
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    <i class="fas fa-file ml-1"></i>
                                    انتخاب فایل
                                </label>
                                <input type="file" id="file-input" 
                                       accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                                       class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <p class="text-xs text-gray-500 mt-2">
                                    <i class="fas fa-info-circle ml-1"></i>
                                    فرمت‌های مجاز: PDF, DOC, DOCX, TXT, JPG, PNG, GIF • حداکثر حجم: 10 مگابایت
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button onclick="OrderTabsModule.uploadFileWithType('${orderId}')" 
                                class="btn btn-primary">
                            <i class="fas fa-upload ml-2"></i>
                            آپلود فایل
                        </button>
                        <button onclick="OrderTabsModule.closeUploadModal()" 
                                class="btn btn-secondary">
                            <i class="fas fa-times ml-2"></i>
                            انصراف
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // Upload file with type
    uploadFileWithType(orderId) {
        const fileTypeSelect = document.getElementById('file-type-select');
        const fileInput = document.getElementById('file-input');
        
        if (!fileTypeSelect || !fileInput) {
            UTILS.showNotification('خطا در یافتن عناصر فرم', 'error');
            return;
        }
        
        const fileType = fileTypeSelect.value;
        const file = fileInput.files[0];
        
        if (!fileType) {
            UTILS.showNotification('لطفاً نوع فایل را انتخاب کنید', 'error');
            return;
        }
        
        if (!file) {
            UTILS.showNotification('لطفاً یک فایل انتخاب کنید', 'error');
            return;
        }
        
        // Check file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            UTILS.showNotification('حجم فایل نباید بیشتر از 10 مگابایت باشد', 'error');
            return;
        }
        
        // Simulate file upload (در واقعیت باید به سرور ارسال شود)
        const currentUser = ModalsModule.getCurrentUser();
        const newFile = {
            id: 'file_' + Date.now(),
            name: file.name,
            fileType: fileType,
            size: file.size,
            uploadedBy: currentUser.id,
            uploadedByName: currentUser.name,
            uploadedAt: new Date().toLocaleDateString('fa-IR'),
            url: URL.createObjectURL(file) // موقت - در واقعیت باید URL سرور باشد
        };
        
        // Add file to order
        const orders = DataModule.getOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        
        if (orderIndex !== -1) {
            if (!orders[orderIndex].files) {
                orders[orderIndex].files = [];
            }
            orders[orderIndex].files.push(newFile);
            DataModule.saveOrders(orders);
            
            UTILS.showNotification('فایل با موفقیت آپلود شد', 'success');
            this.closeUploadModal();
            
            // Refresh the order detail page
            if (typeof OrderPagesModule !== 'undefined') {
                OrderPagesModule.showOrderPage(orderId);
            }
        } else {
            UTILS.showNotification('خطا در آپلود فایل', 'error');
        }
    },
    
    // Close upload modal
    closeUploadModal(event) {
        if (event) {
            event.stopPropagation();
        }
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    }
};