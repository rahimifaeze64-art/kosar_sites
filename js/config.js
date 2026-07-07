// Configuration and Constants
const CONFIG = {
    APP_NAME: 'سیستم مدیریت تحصیلی',
    VERSION: '1.0.0',
    
    // API Configuration - FORCE OFFLINE MODE
    API_ENABLED: false,  // Set to false to use localStorage only
    API_BASE_URL: 'http://127.0.0.1:8000/api',
    
    // User Roles
    ROLES: {
        MANAGER: 'manager',
        employee: 'employee', 
        AGENT: 'agent',
        STUDENT: 'student'
    },
    
    // Order Status - فقط 3 حالت
    ORDER_STATUS: {
        PENDING: 'pending',        // در انتظار
        IN_PROGRESS: 'in_progress', // در حال انجام
        COMPLETED: 'completed'      // تکمیل شده
    },
    
    // Order Types
    ORDER_TYPES: {
        THESIS: 'نوشتن رساله',
        ARTICLE: 'نوشتن مقاله',
        TRANSLATION: 'ترجمه رساله',
        SUMMARY: 'تلخیص',
        PRESENTATION: 'آماده‌سازی ارائه',
        RESEARCH: 'تحقیق و بررسی'
    },
    
    // Pricing (in USD)
    PRICING: {
        'نوشتن رساله': {
            masters: 800,
            phd: 1200,
            doctorShare: 0.6,
            managerShare: 0.4
        },
        'نوشتن مقاله': {
            price: 300,
            doctorShare: 0.7,
            managerShare: 0.3
        },
        'ترجمه رساله': {
            perPage: 5,
            translatorShare: 0.6,
            managerShare: 0.4
        },
        'تلخیص': {
            perPage: 3,
            translatorShare: 0.5,
            managerShare: 0.5
        },
        'آماده‌سازی ارائه': {
            price: 150,
            doctorShare: 0.6,
            managerShare: 0.4
        },
        'تحقیق و بررسی': {
            price: 200,
            doctorShare: 0.6,
            managerShare: 0.4
        }
    },
    
    // Universities (Main options + custom)
    UNIVERSITIES: [
        'دانشگاه قم',
        'جامعه المصطفی',
        'سایر (وارد کنید)'
    ],
    
    // Academic Specializations (تخصص‌های تحصیلی)
    SPECIALIZATIONS: [
        'حقوق محض',
        'حقوق عمومی',
        'حقوق خصوصی',
        'حقوق بین‌الملل',
        'سایر (وارد کنید)'
    ],
    
    // Previous Degree Fields (مقطع کارشناسی قبلی - برای پروفایل)
    BACHELOR_FIELDS: [
        'حقوق',
        'علوم سیاسی',
        'فقه و مبانی حقوق',
        'الهیات',
        'علوم اجتماعی',
        'روابط بین‌الملل',
        'سایر (وارد کنید)'
    ],
    
    // Academic Fields for current study
    FIELDS: [
        'حقوق محض',
        'حقوق عمومی',
        'حقوق خصوصی',
        'حقوق بین‌الملل',
        'سایر (وارد کنید)'
    ],
    
    // Degree Levels
    DEGREES: {
        MASTERS: 'ارشد',
        PHD: 'دكتراه'
    },
    
    // Task Types
    TASK_TYPES: {
        TITLE_SELECTION: 'انتخاب عنوان',
        TITLE_APPROVAL: 'تایید عنوان',
        FORM2_WRITING: 'نوشتن استماره ۲',
        FORM2_REVIEW: 'بررسی استماره ۲',
        THESIS_WRITING: 'نوشتن رساله',
        ARTICLE_WRITING: 'نوشتن مقاله',
        TRANSLATION: 'ترجمه',
        REVIEW: 'بررسی و تایید',
        REVISION: 'تعدیل و اصلاح',
        FINAL_REVIEW: 'بررسی نهایی',
        DEFENSE_PREP: 'آماده‌سازی دفاع'
    },
    
    // Notification Types
    NOTIFICATION_TYPES: {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info'
    },
    
    // Local Storage Keys
    STORAGE_KEYS: {
        USERS: 'edu_system_users',
        ORDERS: 'edu_system_orders',
        CURRENT_USER: 'edu_system_current_user',
        SETTINGS: 'edu_system_settings'
    }
};

// Utility Functions
const UTILS = {
    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Format date to Persian
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('fa-IR');
    },
    
    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },
    
    // Calculate order price
    calculateOrderPrice(orderType, degree, pages = 0) {
        const pricing = CONFIG.PRICING[orderType];
        if (!pricing) return 0;
        
        if (orderType === 'نوشتن رساله') {
            return degree === 'دكتراه' ? pricing.phd : pricing.masters;
        } else if (orderType === 'ترجمه رساله' || orderType === 'تلخیص') {
            return pages * pricing.perPage;
        } else {
            return pricing.price || 0;
        }
    },
    
    // Calculate shares
    calculateShares(orderType, totalAmount) {
        const pricing = CONFIG.PRICING[orderType];
        if (!pricing) return { doctorShare: 0, managerShare: 0 };
        
        const doctorShare = totalAmount * (pricing.doctorShare || pricing.translatorShare || 0);
        const managerShare = totalAmount * pricing.managerShare;
        
        return { doctorShare, managerShare };
    },
    
    // Show notification
    showNotification(message, type = 'info', duration = 3000) {
        try {
            debugLogger(`Showing notification: ${message}`, 'info', { type, duration });
            
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'notificationSlide 0.3s ease-out reverse';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, duration);
        } catch (error) {
            debugLogger('Error showing notification', 'error', error);
            // Fallback to alert
            alert(message);
        }
    },
    
    // Validate form data
    validateForm(data, rules) {
        const errors = {};
        
        for (const field in rules) {
            const rule = rules[field];
            const value = data[field];
            
            if (rule.required && (!value || value.toString().trim() === '')) {
                errors[field] = `${rule.label} الزامی است`;
                continue;
            }
            
            if (value && rule.minLength && value.length < rule.minLength) {
                errors[field] = `${rule.label} باید حداقل ${rule.minLength} کاراکتر باشد`;
            }
            
            if (value && rule.maxLength && value.length > rule.maxLength) {
                errors[field] = `${rule.label} نباید بیشتر از ${rule.maxLength} کاراکتر باشد`;
            }
            
            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors[field] = `فرمت ${rule.label} صحیح نیست`;
            }
        }
        
        return errors;
    },
    
    // Deep clone object
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    
    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};