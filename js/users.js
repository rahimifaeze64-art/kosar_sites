// Users Management Module (Manager Only)
const UsersModule = {
    // Get users management content
    getUsersContent() {
        const users = DataModule.getUsers();
        
        return `
            <div class="space-y-6">
                <!-- Users Header -->
                <div class="flex justify-center items-center mb-6">
                    <button onclick="openAddUserModal()" 
                            class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium btn shadow-lg">
                        <i class="fas fa-user-plus ml-2"></i>
                        افزودن کاربر
                    </button>
                </div>
                
                <h2 class="text-2xl font-bold text-gray-800 mb-4">مدیریت کاربران</h2>
                
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
                            <p class="text-2xl font-bold text-purple-600">${users.filter(u => u.role === CONFIG.ROLES.AGENT).length}</p>
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
            [CONFIG.ROLES.AGENT]: 'bg-purple-100 text-purple-800',
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
    }
};