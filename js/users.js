// Users Management Module (Manager Only)
const UsersModule = {
    // Get users management content
    getUsersContent() {
        const users = DataModule.getUsers();
        
        return `
            <div class="space-y-6">
                <!-- Users Header -->
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">مدیریت کاربران</h2>
                    <div class="flex gap-3">
                        <button onclick="UsersModule.showAddEmployeeModal()" 
                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium btn">
                            <i class="fas fa-user-plus ml-2"></i>
                            کارمند جدید
                        </button>
                        <button onclick="UsersModule.showAddAgentModal()" 
                                class="bg-yellow-600 hover:bg-yellow-700 text-gray-900 px-4 py-2 rounded-lg font-medium btn">
                            <i class="fas fa-user-tie ml-2"></i>
                            عامل جدید
                        </button>
                        <button onclick="openAddUserModal()" 
                                class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium btn">
                            <i class="fas fa-cog ml-2"></i>
                            کاربر دیگر
                        </button>
                    </div>
                </div>
                
                <!-- Users Stats -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="dashboard-card blue">
                        <div class="text-center">
                            <h3 class="text-lg font-semibold text-gray-700">کل کاربران</h3>
                            <p class="text-2xl font-bold text-blue-600">${users.length}</p>
                        </div>
                    </div>
                    <div class="dashboard-card green">
                        <div class="text-center">
                            <h3 class="text-lg font-semibold text-gray-700">دانشجویان</h3>
                            <p class="text-2xl font-bold text-green-600">${users.filter(u => u.role === CONFIG.ROLES.STUDENT).length}</p>
                        </div>
                    </div>
                    <div class="dashboard-card purple">
                        <div class="text-center">
                            <h3 class="text-lg font-semibold text-gray-700">عامل‌ها</h3>
                            <p class="text-2xl font-bold text-yellow-600">${users.filter(u => u.role === CONFIG.ROLES.AGENT).length}</p>
                        </div>
                    </div>
                    <div class="dashboard-card yellow">
                        <div class="text-center">
                            <h3 class="text-lg font-semibold text-gray-700">کارمندها</h3>
                            <p class="text-2xl font-bold text-yellow-600">${users.filter(u => u.role === CONFIG.ROLES.employee).length}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Users Table -->
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">نام</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">نام کاربری</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">نقش</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ایمیل</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">وضعیت</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">عملیات</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${this.getUsersTableRows(users)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Generate table rows for users
    getUsersTableRows(users) {
        // Reverse array to show newest users first (stack order)
        const reversedUsers = [...users].reverse();
        return reversedUsers.map(user => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <div class="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                                <span class="text-white font-medium">${user.name.charAt(0)}</span>
                            </div>
                        </div>
                        <div class="mr-4">
                            <div class="text-sm font-medium text-gray-900">${user.name}</div>
                            <div class="text-sm text-gray-500">${user.phone || 'تلفن ثبت نشده'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${user.username}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${this.getRoleClass(user.role)}">
                        ${this.getRoleText(user.role)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${user.email || 'ایمیل ثبت نشده'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${user.active ? 'فعال' : 'غیرفعال'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2 space-x-reverse">
                        <button onclick="window.editUser('${user.id}')" 
                                class="text-blue-600 hover:text-blue-900">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="window.toggleUserStatus('${user.id}')" 
                                class="text-${user.active ? 'red' : 'green'}-600 hover:text-${user.active ? 'red' : 'green'}-900">
                            <i class="fas fa-${user.active ? 'ban' : 'check'}"></i>
                        </button>
                        ${user.role !== CONFIG.ROLES.MANAGER ? `
                            <button onclick="window.deleteUser('${user.id}')" 
                                    class="text-red-600 hover:text-red-900">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    },
    
    // Add new user
    addUser(userData) {
        const users = DataModule.getUsers();
        
        // Check if username exists
        if (users.find(u => u.username === userData.username)) {
            UTILS.showNotification('نام کاربری قبلاً استفاده شده است', 'error');
            return false;
        }
        
        const newUser = {
            id: UTILS.generateId(),
            ...userData,
            active: true,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        DataModule.saveUsers(users);
        UTILS.showNotification('کاربر جدید با موفقیت اضافه شد', 'success');
        return true;
    },
    
    // Edit user
    editUser(userId, userData) {
        const users = DataModule.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            UTILS.showNotification('کاربر یافت نشد', 'error');
            return false;
        }
        
        users[userIndex] = { ...users[userIndex], ...userData };
        DataModule.saveUsers(users);
        UTILS.showNotification('اطلاعات کاربر به‌روزرسانی شد', 'success');
        return true;
    },
    
    // Toggle user status
    toggleUserStatus(userId) {
        const users = DataModule.getUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            UTILS.showNotification('کاربر یافت نشد', 'error');
            return false;
        }
        
        user.active = !user.active;
        DataModule.saveUsers(users);
        UTILS.showNotification(`کاربر ${user.active ? 'فعال' : 'غیرفعال'} شد`, 'success');
        return true;
    },
    
    // Delete user
    deleteUser(userId) {
        const users = DataModule.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            UTILS.showNotification('کاربر یافت نشد', 'error');
            return false;
        }
        
        if (users[userIndex].role === CONFIG.ROLES.MANAGER) {
            UTILS.showNotification('نمی‌توان مدیر را حذف کرد', 'error');
            return false;
        }
        
        users.splice(userIndex, 1);
        DataModule.saveUsers(users);
        UTILS.showNotification('کاربر حذف شد', 'success');
        return true;
    },
    
    // Helper methods
    getRoleClass(role) {
        const classes = {
            [CONFIG.ROLES.MANAGER]: 'bg-red-100 text-red-800',
            [CONFIG.ROLES.employee]: 'bg-blue-100 text-blue-800',
            [CONFIG.ROLES.AGENT]: 'bg-yellow-100 text-yellow-800',
            [CONFIG.ROLES.STUDENT]: 'bg-green-100 text-green-800'
        };
        return classes[role] || 'bg-gray-100 text-gray-800';
    },
    
    getRoleText(role) {
        const texts = {
            [CONFIG.ROLES.MANAGER]: 'مدیر',
            [CONFIG.ROLES.employee]: 'کارمند',
            [CONFIG.ROLES.AGENT]: 'عامل',
            [CONFIG.ROLES.STUDENT]: 'دانشجو'
        };
        return texts[role] || role;
    },

    // نمایش modal کارمند جدید
    showAddEmployeeModal() {
        this._showPersonModal('employee', 'کارمند جدید', 'bg-blue-600');
    },

    // نمایش modal عامل جدید
    showAddAgentModal() {
        this._showPersonModal('agent', 'عامل جدید', 'bg-yellow-600');
    },

    // modal عمومی برای افزودن کارمند/عامل
    _showPersonModal(role, title, btnColor) {
        const existing = document.getElementById('add-person-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'add-person-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div class="p-6 border-b flex justify-between items-center">
                    <h3 class="text-lg font-bold text-gray-800">
                        <i class="fas fa-user-plus text-blue-600 ml-2"></i>
                        ${title}
                    </h3>
                    <button onclick="document.getElementById('add-person-modal').remove()"
                            class="text-gray-400 hover:text-gray-600 text-xl">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">نام <span class="text-red-500">*</span></label>
                        <input type="text" id="person-name" placeholder="نام کامل"
                               class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">نام کاربری <span class="text-red-500">*</span></label>
                        <input type="text" id="person-username" placeholder="username"
                               class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">رمز عبور <span class="text-red-500">*</span></label>
                        <input type="password" id="person-password" placeholder="رمز عبور"
                               class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ایمیل</label>
                        <input type="email" id="person-email" placeholder="email@example.com"
                               class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">شماره تماس</label>
                        <input type="tel" id="person-phone" placeholder="شماره تلفن"
                               class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500">
                    </div>
                </div>
                <div class="p-6 pt-0 flex gap-3">
                    <button onclick="UsersModule._savePerson('${role}')"
                            class="flex-1 ${btnColor} text-white py-2 rounded-lg font-medium hover:opacity-90 btn">
                        <i class="fas fa-save ml-2"></i>
                        ذخیره
                    </button>
                    <button onclick="document.getElementById('add-person-modal').remove()"
                            class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium">
                        انصراف
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('person-name').focus();
    },

    // ذخیره کارمند/عامل جدید
    _savePerson(role) {
        const name = document.getElementById('person-name').value.trim();
        const username = document.getElementById('person-username').value.trim();
        const password = document.getElementById('person-password').value.trim();
        const email = document.getElementById('person-email').value.trim();
        const phone = document.getElementById('person-phone').value.trim();

        if (!name || !username || !password) {
            alert('لطفاً نام، نام کاربری و رمز عبور را وارد کنید');
            return;
        }

        const users = DataModule.getUsers();
        if (users.find(u => u.username === username)) {
            alert('این نام کاربری قبلاً استفاده شده است');
            return;
        }

        const newUser = {
            id: (role === 'employee' ? 'emp' : 'agent') + Date.now(),
            name,
            username,
            password,
            email: email || `${username}@edu-system.com`,
            phone: phone || '',
            role,
            active: true,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        DataModule.saveUsers(users);

        document.getElementById('add-person-modal').remove();
        UTILS.showNotification(`${role === 'employee' ? 'کارمند' : 'عامل'} جدید "${name}" اضافه شد`, 'success');

        // بازسازی صفحه
        const app = document.querySelector('[x-data]')?.__x?.$data;
        if (app) {
            const content = document.querySelector('[x-show="currentPage === \'users\'"]');
            if (content) content.innerHTML = UsersModule.getUsersContent();
        }
    }
};