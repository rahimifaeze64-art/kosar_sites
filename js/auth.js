// Enhanced Authentication Module for Django Integration
const AuthModule = {
    // Current user state
    currentUser: null,
    isAuthenticated: false,
    
    // Initialize authentication
    async init() {
        try {
            debugLogger('Initializing authentication module...', 'info');
            
            // Try to get current user from API
            try {
                this.currentUser = await APIDataModule.getCurrentUser();
                if (this.currentUser) {
                    this.isAuthenticated = true;
                    debugLogger('User authenticated via API', 'success', this.currentUser);
                } else {
                    debugLogger('No authenticated user found', 'info');
                }
            } catch (error) {
                debugLogger('API authentication check failed, using demo mode', 'warning', error);
                // Fallback to demo mode with localStorage users
                this.initDemoMode();
            }
            
            debugLogger('Authentication module initialized', 'success');
        } catch (error) {
            debugLogger('Error initializing authentication', 'error', error);
            this.initDemoMode();
        }
    },
    
    // Initialize demo mode (for development/testing)
    initDemoMode() {
        debugLogger('Initializing demo mode authentication', 'info');
        
        // Use the first manager user as default
        const users = DataModule ? DataModule.getUsers() : [];
        const defaultUser = users.find(u => u.role === 'manager') || users[0];
        
        if (defaultUser) {
            this.currentUser = defaultUser;
            this.isAuthenticated = true;
            debugLogger('Demo mode user set', 'success', defaultUser);
        }
    },
    
    // Login method
    async login(username, password) {
        try {
            debugLogger('Attempting login...', 'info', { username });
            
            // Try API login first
            try {
                const result = await APIDataModule.login(username, password);
                this.currentUser = result.user;
                this.isAuthenticated = true;
                debugLogger('API login successful', 'success', this.currentUser);
                return { success: true, user: this.currentUser };
            } catch (apiError) {
                debugLogger('API login failed, trying demo mode', 'warning', apiError);
                
                // Fallback to demo mode
                const users = DataModule ? DataModule.getUsers() : [];
                const user = users.find(u => u.username === username && u.password === password);
                
                if (user) {
                    this.currentUser = user;
                    this.isAuthenticated = true;
                    debugLogger('Demo mode login successful', 'success', user);
                    return { success: true, user: this.currentUser };
                } else {
                    throw new Error('نام کاربری یا رمز عبور اشتباه است');
                }
            }
        } catch (error) {
            debugLogger('Login failed', 'error', error);
            return { success: false, error: error.message };
        }
    },
    
    // Logout method
    async logout() {
        try {
            debugLogger('Attempting logout...', 'info');
            
            // Try API logout
            try {
                await APIDataModule.logout();
                debugLogger('API logout successful', 'success');
            } catch (error) {
                debugLogger('API logout failed, continuing with local logout', 'warning', error);
            }
            
            // Clear local state
            this.currentUser = null;
            this.isAuthenticated = false;
            
            debugLogger('Logout completed', 'success');
            return { success: true };
        } catch (error) {
            debugLogger('Logout failed', 'error', error);
            return { success: false, error: error.message };
        }
    },
    
    // Switch user (demo mode)
    switchUser(userId) {
        try {
            debugLogger(`Switching to user: ${userId}`, 'info');
            
            const users = DataModule ? DataModule.getUsers() : [];
            const user = users.find(u => u.id === userId);
            
            if (user) {
                this.currentUser = user;
                this.isAuthenticated = true;
                debugLogger('User switched successfully', 'success', user);
                return { success: true, user: this.currentUser };
            } else {
                throw new Error('کاربر یافت نشد');
            }
        } catch (error) {
            debugLogger('User switch failed', 'error', error);
            return { success: false, error: error.message };
        }
    },
    
    // Get current user
    getCurrentUser() {
        return this.currentUser;
    },
    
    // Check if user is authenticated
    isUserAuthenticated() {
        return this.isAuthenticated && this.currentUser !== null;
    },
    
    // Check user role
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    },
    
    // Check if user has permission
    hasPermission(permission) {
        if (!this.currentUser) return false;
        
        const rolePermissions = {
            'manager': ['all'],
            'employee': ['view_orders', 'manage_orders', 'view_students', 'manage_students'],
            'doctor': ['view_assigned_orders', 'update_orders', 'upload_files'],
            'student': ['view_own_orders', 'create_orders'],
            'translator': ['view_translation_orders', 'update_translation_orders']
        };
        
        const userPermissions = rolePermissions[this.currentUser.role] || [];
        return userPermissions.includes('all') || userPermissions.includes(permission);
    },
    
    // Legacy methods for backward compatibility
    isLoggedIn() {
        return this.isUserAuthenticated();
    },
    
    // Register new student (legacy method)
    registerStudent(userData) {
        const users = DataModule.getUsers();
        
        // Check if username exists
        if (users.find(u => u.username === userData.username)) {
            UTILS.showNotification('نام کاربری قبلاً استفاده شده است', 'error');
            return false;
        }
        
        const newUser = {
            id: UTILS.generateId(),
            ...userData,
            role: CONFIG.ROLES.STUDENT,
            active: true,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        DataModule.saveUsers(users);
        UTILS.showNotification('ثبت نام موفقیت‌آمیز بود', 'success');
        return true;
    }
};

// Initialize authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Disable auth module when API is disabled
        const enableAPI = false; // Match with api.js and app.js setting
        
        if (!enableAPI) {
            debugLogger('Authentication module disabled (API disabled)', 'info');
            return;
        }
        
        await AuthModule.init();
        debugLogger('Authentication ready', 'success');
    } catch (error) {
        debugLogger('Authentication initialization failed', 'error', error);
    }
});