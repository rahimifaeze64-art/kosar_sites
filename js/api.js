// API Integration Module for Django Backend
const APIModule = {
    // Base configuration
    baseURL: 'http://127.0.0.1:8000/api',
    
    // CSRF Token management
    csrfToken: null,
    
    // Initialize API module
    async init() {
        try {
            debugLogger('Initializing API module...', 'info');
            await this.getCSRFToken();
            debugLogger('API module initialized successfully', 'success');
        } catch (error) {
            debugLogger('Error initializing API module', 'error', error);
        }
    },
    
    // Get CSRF token for Django
    async getCSRFToken() {
        try {
            const response = await fetch(`${this.baseURL}/auth/user/`, {
                credentials: 'include'
            });
            
            // Extract CSRF token from cookies
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'csrftoken') {
                    this.csrfToken = value;
                    break;
                }
            }
            
            if (!this.csrfToken) {
                // Try to get from meta tag if available
                const csrfMeta = document.querySelector('meta[name="csrf-token"]');
                if (csrfMeta) {
                    this.csrfToken = csrfMeta.getAttribute('content');
                }
            }
            
            debugLogger('CSRF token obtained', 'info', { token: this.csrfToken ? 'present' : 'missing' });
        } catch (error) {
            debugLogger('Error getting CSRF token', 'error', error);
        }
    },
    
    // Generic API request method
    async request(endpoint, options = {}) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const defaultOptions = {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.csrfToken && { 'X-CSRFToken': this.csrfToken })
                }
            };
            
            const finalOptions = {
                ...defaultOptions,
                ...options,
                headers: {
                    ...defaultOptions.headers,
                    ...options.headers
                }
            };
            
            debugLogger(`API Request: ${options.method || 'GET'} ${url}`, 'info', finalOptions);
            
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Network error' }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            debugLogger(`API Response: ${options.method || 'GET'} ${url}`, 'success', data);
            
            return data;
        } catch (error) {
            debugLogger(`API Error: ${options.method || 'GET'} ${endpoint}`, 'error', error);
            throw error;
        }
    },
    
    // Authentication methods
    auth: {
        async login(username, password) {
            return await APIModule.request('/auth/login/', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
        },
        
        async logout() {
            return await APIModule.request('/auth/logout/', {
                method: 'POST'
            });
        },
        
        async getCurrentUser() {
            return await APIModule.request('/auth/user/');
        }
    },
    
    // User management methods
    users: {
        async getAll() {
            return await APIModule.request('/users/');
        },
        
        async create(userData) {
            return await APIModule.request('/users/', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        },
        
        async update(userId, userData) {
            return await APIModule.request(`/users/${userId}/`, {
                method: 'PUT',
                body: JSON.stringify(userData)
            });
        },
        
        async delete(userId) {
            return await APIModule.request(`/users/${userId}/`, {
                method: 'DELETE'
            });
        }
    },
    
    // Student management methods
    students: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            const endpoint = queryString ? `/students/?${queryString}` : '/students/';
            return await APIModule.request(endpoint);
        },
        
        async create(studentData) {
            return await APIModule.request('/students/', {
                method: 'POST',
                body: JSON.stringify(studentData)
            });
        },
        
        async update(studentId, studentData) {
            return await APIModule.request(`/students/${studentId}/`, {
                method: 'PUT',
                body: JSON.stringify(studentData)
            });
        },
        
        async delete(studentId) {
            return await APIModule.request(`/students/${studentId}/`, {
                method: 'DELETE'
            });
        },
        
        async getStatistics() {
            return await APIModule.request('/students/statistics/');
        }
    },
    
    // Order management methods
    orders: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            const endpoint = queryString ? `/orders/?${queryString}` : '/orders/';
            return await APIModule.request(endpoint);
        },
        
        async create(orderData) {
            return await APIModule.request('/orders/', {
                method: 'POST',
                body: JSON.stringify(orderData)
            });
        },
        
        async update(orderId, orderData) {
            return await APIModule.request(`/orders/${orderId}/`, {
                method: 'PUT',
                body: JSON.stringify(orderData)
            });
        },
        
        async delete(orderId) {
            return await APIModule.request(`/orders/${orderId}/`, {
                method: 'DELETE'
            });
        },
        
        async assign(orderId, doctorId) {
            return await APIModule.request(`/orders/${orderId}/assign_doctor/`, {
                method: 'POST',
                body: JSON.stringify({ doctor_id: doctorId })
            });
        },
        
        async approve(orderId) {
            return await APIModule.request(`/orders/${orderId}/approve/`, {
                method: 'POST'
            });
        },
        
        async reject(orderId, reason) {
            return await APIModule.request(`/orders/${orderId}/reject/`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });
        }
    },
    
    // File management methods
    files: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            const endpoint = queryString ? `/files/?${queryString}` : '/files/';
            return await APIModule.request(endpoint);
        },
        
        async upload(formData) {
            // For file uploads, don't set Content-Type header (let browser set it)
            return await APIModule.request('/files/', {
                method: 'POST',
                headers: {
                    ...(APIModule.csrfToken && { 'X-CSRFToken': APIModule.csrfToken })
                },
                body: formData
            });
        },
        
        async download(fileId) {
            const response = await fetch(`${APIModule.baseURL}/files/${fileId}/download/`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('File download failed');
            }
            
            return response.blob();
        }
    },
    
    // Dashboard methods
    dashboard: {
        async getStats() {
            return await APIModule.request('/dashboard/stats/');
        },
        
        async getRecentOrders() {
            return await APIModule.request('/dashboard/recent_orders/');
        }
    }
};

// Enhanced Data Module that uses API instead of localStorage
const APIDataModule = {
    // Cache for frequently accessed data
    cache: {
        users: null,
        students: null,
        orders: null,
        currentUser: null
    },
    
    // Cache expiry times (in milliseconds)
    cacheExpiry: {
        users: 5 * 60 * 1000,      // 5 minutes
        students: 2 * 60 * 1000,   // 2 minutes
        orders: 1 * 60 * 1000,     // 1 minute
        currentUser: 10 * 60 * 1000 // 10 minutes
    },
    
    // Initialize API data module
    async init() {
        try {
            debugLogger('Initializing API Data module...', 'info');
            await APIModule.init();
            
            // Try to get current user
            try {
                this.cache.currentUser = await APIModule.auth.getCurrentUser();
                debugLogger('Current user loaded from API', 'success', this.cache.currentUser);
            } catch (error) {
                debugLogger('No authenticated user found', 'info');
            }
            
            debugLogger('API Data module initialized successfully', 'success');
        } catch (error) {
            debugLogger('Error initializing API Data module', 'error', error);
            // Fallback to localStorage if API is not available
            this.fallbackToLocalStorage();
        }
    },
    
    // Fallback to localStorage when API is not available
    fallbackToLocalStorage() {
        debugLogger('Falling back to localStorage data', 'warning');
        // Use the original DataModule as fallback
        if (typeof DataModule !== 'undefined') {
            DataModule.initializeData();
        }
    },
    
    // Check if cache is valid
    isCacheValid(key) {
        const cached = this.cache[key];
        if (!cached || !cached.timestamp) return false;
        
        const now = Date.now();
        const expiry = this.cacheExpiry[key] || 60000; // Default 1 minute
        
        return (now - cached.timestamp) < expiry;
    },
    
    // Set cache with timestamp
    setCache(key, data) {
        this.cache[key] = {
            data: data,
            timestamp: Date.now()
        };
    },
    
    // Get cache data
    getCache(key) {
        const cached = this.cache[key];
        return cached ? cached.data : null;
    },
    
    // Authentication methods
    async login(username, password) {
        try {
            const result = await APIModule.auth.login(username, password);
            this.cache.currentUser = { data: result.user, timestamp: Date.now() };
            return result;
        } catch (error) {
            debugLogger('Login failed', 'error', error);
            throw error;
        }
    },
    
    async logout() {
        try {
            await APIModule.auth.logout();
            this.cache.currentUser = null;
            // Clear all caches on logout
            this.cache = {
                users: null,
                students: null,
                orders: null,
                currentUser: null
            };
        } catch (error) {
            debugLogger('Logout failed', 'error', error);
            throw error;
        }
    },
    
    async getCurrentUser() {
        if (this.isCacheValid('currentUser')) {
            return this.getCache('currentUser');
        }
        
        try {
            const user = await APIModule.auth.getCurrentUser();
            this.setCache('currentUser', user);
            return user;
        } catch (error) {
            debugLogger('Failed to get current user', 'error', error);
            return null;
        }
    },
    
    // Users methods
    async getUsers() {
        if (this.isCacheValid('users')) {
            return this.getCache('users');
        }
        
        try {
            const users = await APIModule.users.getAll();
            this.setCache('users', users);
            return users;
        } catch (error) {
            debugLogger('Failed to get users from API, using fallback', 'error', error);
            // Fallback to localStorage
            return DataModule ? DataModule.getUsers() : [];
        }
    },
    
    async addUser(userData) {
        try {
            const newUser = await APIModule.users.create(userData);
            // Invalidate users cache
            this.cache.users = null;
            return newUser;
        } catch (error) {
            debugLogger('Failed to add user via API', 'error', error);
            throw error;
        }
    },
    
    // Students methods
    async getStudents(params = {}) {
        const cacheKey = 'students';
        if (!params || Object.keys(params).length === 0) {
            if (this.isCacheValid(cacheKey)) {
                return this.getCache(cacheKey);
            }
        }
        
        try {
            const students = await APIModule.students.getAll(params);
            if (!params || Object.keys(params).length === 0) {
                this.setCache(cacheKey, students);
            }
            return students;
        } catch (error) {
            debugLogger('Failed to get students from API', 'error', error);
            // For students, we don't have localStorage fallback since they're new
            return [];
        }
    },
    
    async addStudent(studentData) {
        try {
            const newStudent = await APIModule.students.create(studentData);
            // Invalidate students cache
            this.cache.students = null;
            return newStudent;
        } catch (error) {
            debugLogger('Failed to add student via API', 'error', error);
            throw error;
        }
    },
    
    // Orders methods
    async getOrders(params = {}) {
        const cacheKey = 'orders';
        if (!params || Object.keys(params).length === 0) {
            if (this.isCacheValid(cacheKey)) {
                return this.getCache(cacheKey);
            }
        }
        
        try {
            const orders = await APIModule.orders.getAll(params);
            if (!params || Object.keys(params).length === 0) {
                this.setCache(cacheKey, orders);
            }
            return orders;
        } catch (error) {
            debugLogger('Failed to get orders from API, using fallback', 'error', error);
            // Fallback to localStorage
            return DataModule ? DataModule.getOrders() : [];
        }
    },
    
    async addOrder(orderData) {
        try {
            const newOrder = await APIModule.orders.create(orderData);
            // Invalidate orders cache
            this.cache.orders = null;
            return newOrder;
        } catch (error) {
            debugLogger('Failed to add order via API', 'error', error);
            throw error;
        }
    },
    
    async assignOrder(orderId, doctorId) {
        try {
            const result = await APIModule.orders.assign(orderId, doctorId);
            // Invalidate orders cache
            this.cache.orders = null;
            return result;
        } catch (error) {
            debugLogger('Failed to assign order via API', 'error', error);
            throw error;
        }
    },
    
    async approveOrder(orderId) {
        try {
            const result = await APIModule.orders.approve(orderId);
            // Invalidate orders cache
            this.cache.orders = null;
            return result;
        } catch (error) {
            debugLogger('Failed to approve order via API', 'error', error);
            throw error;
        }
    },
    
    async rejectOrder(orderId, reason) {
        try {
            const result = await APIModule.orders.reject(orderId, reason);
            // Invalidate orders cache
            this.cache.orders = null;
            return result;
        } catch (error) {
            debugLogger('Failed to reject order via API', 'error', error);
            throw error;
        }
    },
    
    // Dashboard methods
    async getDashboardStats() {
        try {
            return await APIModule.dashboard.getStats();
        } catch (error) {
            debugLogger('Failed to get dashboard stats from API', 'error', error);
            // Return mock data as fallback
            return {
                total_orders: 0,
                pending_orders: 0,
                in_progress_orders: 0,
                completed_orders: 0,
                total_revenue: 0,
                total_students: 0,
                active_doctors: 0
            };
        }
    },
    
    async getRecentOrders() {
        try {
            return await APIModule.dashboard.getRecentOrders();
        } catch (error) {
            debugLogger('Failed to get recent orders from API', 'error', error);
            return [];
        }
    }
};

// Initialize API Data Module when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Check if API should be enabled (can be controlled via config or environment)
        const enableAPI = true; // Set to false to disable API and use localStorage only
        
        if (!enableAPI) {
            debugLogger('API integration disabled, using localStorage only', 'info');
            APIDataModule.isAvailable = false;
            return;
        }
        
        await APIDataModule.init();
        debugLogger('API integration ready', 'success');
    } catch (error) {
        debugLogger('API integration failed, using fallback', 'error', error);
        APIDataModule.isAvailable = false;
    }
});