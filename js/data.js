// Data Management Module
const DataModule = {
    // Initialize default data
    initializeData() {
        try {
            if (typeof debugLogger !== 'undefined') {
                debugLogger('Initializing data module...', 'info');
            }
            
            if (!localStorage.getItem(CONFIG.STORAGE_KEYS.USERS)) {
                if (typeof debugLogger !== 'undefined') {
                    debugLogger('No users found, creating default users', 'info');
                }
                this.saveUsers(this.getDefaultUsers());
            } else {
                if (typeof debugLogger !== 'undefined') {
                    debugLogger('Users found in localStorage', 'info');
                }
            }
            
            if (!localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS)) {
                if (typeof debugLogger !== 'undefined') {
                    debugLogger('No orders found, creating default orders', 'info');
                }
                this.saveOrders(this.getDefaultOrders());
            } else {
                if (typeof debugLogger !== 'undefined') {
                    debugLogger('Orders found in localStorage', 'info');
                }
            }
            
            if (typeof debugLogger !== 'undefined') {
                debugLogger('Data module initialized successfully', 'success');
            }
        } catch (error) {
            if (typeof debugLogger !== 'undefined') {
                debugLogger('Error initializing data module', 'error', error);
            }
            console.error('Error initializing data module:', error);
        }
    },
    
    // Get users from localStorage
    getUsers() {
        try {
            const users = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS);
            const result = users ? JSON.parse(users) : this.getDefaultUsers();
            if (typeof debugLogger !== 'undefined') {
                debugLogger(`Retrieved ${result.length} users`, 'info');
            }
            return result;
        } catch (error) {
            if (typeof debugLogger !== 'undefined') {
                debugLogger('Error getting users', 'error', error);
            }
            console.error('Error getting users:', error);
            return this.getDefaultUsers();
        }
    },

    // Save users to localStorage
    saveUsers(users) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, JSON.stringify(users));
            if (typeof debugLogger !== 'undefined') {
                debugLogger(`Saved ${users.length} users to localStorage`, 'success');
            }
            
            // ارسال رویداد به‌روزرسانی
            if (typeof RealtimeEvents !== 'undefined') {
                RealtimeEvents.emit(RealtimeEvents.EVENTS.USERS_CHANGED, { users });
            }
        } catch (error) {
            if (typeof debugLogger !== 'undefined') {
                debugLogger('Error saving users', 'error', error);
            }
        }
    },
    
    // Get orders from localStorage
    getOrders() {
        try {
            const ordersStr = localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS);
            
            if (!ordersStr) {
                if (typeof debugLogger !== 'undefined') {
                    debugLogger('No orders in localStorage, returning defaults', 'info');
                }
                return this.getDefaultOrders();
            }
            
            const orders = JSON.parse(ordersStr);
            
            if (!Array.isArray(orders)) {
                if (typeof debugLogger !== 'undefined') {
                    debugLogger('Invalid orders data in localStorage, returning defaults', 'warning');
                }
                return this.getDefaultOrders();
            }
            
            if (typeof debugLogger !== 'undefined') {
                debugLogger(`Retrieved ${orders.length} orders`, 'info');
            }
            return orders;
        } catch (error) {
            if (typeof debugLogger !== 'undefined') {
                debugLogger('Error getting orders', 'error', error);
            }
            console.error('Error getting orders:', error);
            return this.getDefaultOrders();
        }
    },
    
    // Save orders to localStorage
    saveOrders(orders) {
        try {
            if (!orders || !Array.isArray(orders)) {
                if (typeof debugLogger !== 'undefined') {
                    debugLogger('Invalid orders data', 'error', orders);
                }
                return false;
            }
            
            localStorage.setItem(CONFIG.STORAGE_KEYS.ORDERS, JSON.stringify(orders));
            
            if (typeof debugLogger !== 'undefined') {
                debugLogger(`Saved ${orders.length} orders to localStorage`, 'success');
            }
            
            // ارسال رویداد به‌روزرسانی
            if (typeof RealtimeEvents !== 'undefined') {
                RealtimeEvents.emit(RealtimeEvents.EVENTS.ORDERS_CHANGED, { orders });
            }
            
            return true;
        } catch (error) {
            if (typeof debugLogger !== 'undefined') {
                debugLogger('Error saving orders', 'error', error);
            }
            console.error('Error saving orders:', error);
            return false;
        }
    },

    // Default users data
    getDefaultUsers() {
        return [
            // Manager - مدیر
            {
                id: 'mgr001',
                name: 'عامل تقی زاده',
                username: 'manager',
                password: '123456',
                role: CONFIG.ROLES.MANAGER,
                email: 'taghizadeh@edu-system.com',
                phone: '+98 912 123 4567',
                active: true,
                createdAt: '2024-01-01T00:00:00.000Z'
            },
            
            // employees - کارمند‌ها
            {
                id: 'emp001',
                name: 'ساره',
                username: 'zahra',
                password: '123456',
                role: CONFIG.ROLES.employee,
                email: 'zahra@edu-system.com',
                phone: '+98 913 234 5678',
                department: 'هماهنگی عمومی',
                active: true,
                createdAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'emp002',
                name: 'زینب',
                username: 'fatemeh',
                password: '123456',
                role: CONFIG.ROLES.employee,
                email: 'fatemeh@edu-system.com',
                phone: '+98 914 345 6789',
                department: 'هماهنگی پروژه‌ها',
                active: true,
                createdAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'emp003',
                name: 'فرزاد',
                username: 'farzad',
                password: '123456',
                role: CONFIG.ROLES.employee,
                email: 'farzad@edu-system.com',
                phone: '+98 915 456 7890',
                department: 'هماهنگی مالی',
                active: true,
                createdAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'emp004',
                name: 'حسینی م',
                username: 'soleiman',
                password: '123456',
                role: CONFIG.ROLES.employee,
                email: 'soleiman@edu-system.com',
                phone: '+98 916 567 8901',
                department: 'هماهنگی فنی',
                active: true,
                createdAt: '2024-01-01T00:00:00.000Z'
            },
            
            // Agents - عامل‌ها
            {
                id: 'doc001',
                name: 'عامل معصومی',
                username: 'masoumi',
                password: '123456',
                role: 'agent',
                email: 'masoumi@edu-system.com',
                phone: '+98 915 456 7890',
                specialization: 'نوشتن رساله',
                department: 'عملیات',
                active: true,
                createdAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'doc002',
                name: 'عامل ذوقی',
                username: 'zoghi',
                password: '123456',
                role: 'agent',
                email: 'zoghi@edu-system.com',
                phone: '+98 916 567 8901',
                specialization: 'نوشتن مقاله',
                department: 'عملیات',
                active: true,
                createdAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'agent001',
                name: 'فتحی',
                username: 'rezaei',
                password: '123456',
                role: 'agent',
                email: 'rezaei@edu-system.com',
                phone: '+98 917 678 9012',
                specialization: 'ترجمه',
                department: 'عملیات',
                active: true,
                createdAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'agent002',
                name: 'سجادی',
                username: 'karimi',
                password: '123456',
                role: 'agent',
                email: 'karimi@edu-system.com',
                phone: '+98 918 789 0123',
                specialization: 'تلخیص',
                department: 'عملیات',
                active: true,
                createdAt: '2024-01-01T00:00:00.000Z'
            },
            
            // Students - دانشجویان
            {
                id: 'std001',
                name: 'قاسم محمود حسن بغدادی',
                username: 'qasim',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'qasim.baghdadi@gmail.com',
                phone: '+964 775 678 9012',
                university: 'دانشگاه قم',
                studentId: 'QOM2024001',
                field: 'حقوق محض',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: 'A12345678',
                active: true,
                createdAt: '2024-01-15T00:00:00.000Z'
            },
            {
                id: 'std002',
                name: 'حسن یاسر کرار حسینی',
                username: 'hassan',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'hassan.hosseini@gmail.com',
                phone: '+964 776 789 0123',
                university: 'جامعه المصطفی',
                studentId: 'MOS2024002',
                field: 'حقوق عمومی',
                bachelorField: 'علوم سیاسی',
                degree: CONFIG.DEGREES.PHD,
                passportNumber: 'B23456789',
                active: true,
                createdAt: '2024-01-20T00:00:00.000Z'
            },
            {
                id: 'std003',
                name: 'علی عبدالله صالح نجفی',
                username: 'ali.abdullah',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'ali.abdullah@gmail.com',
                phone: '+964 772 345 6789',
                university: 'دانشگاه کربلا',
                studentId: 'KRB2024003',
                field: 'حقوق خصوصی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.BACHELORS,
                passportNumber: 'G3456789',
                active: true,
                createdAt: '2024-02-01T00:00:00.000Z'
            },
            {
                id: 'std004',
                name: 'زینب حسین جاسم موسوی',
                username: 'fatima.hussein',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'fatima.hussein@gmail.com',
                phone: '+964 773 456 7890',
                university: 'جامعه المصطفی',
                studentId: 'MOS2024004',
                field: 'حقوق جنایی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: 'G4567890',
                active: true,
                createdAt: '2024-02-10T00:00:00.000Z'
            },
            {
                id: 'std005',
                name: 'محمد جواد کاظم عبدالرضا',
                username: 'mohammad.javad',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'mohammad.javad@gmail.com',
                phone: '+964 774 567 8901',
                university: 'دانشگاه بغداد',
                studentId: 'BGD2024005',
                field: 'حقوق عمومی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.PHD,
                passportNumber: 'G5678901',
                active: true,
                createdAt: '2024-01-20T00:00:00.000Z'
            },
            {
                id: 'std006',
                name: 'زینب حسین عبدالله سجادی',
                username: 'zainab.hussein',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'zainab.hussein@gmail.com',
                phone: '+964 775 678 9012',
                university: 'دانشگاه قم',
                studentId: 'QOM2024006',
                field: 'حقوق بین‌الملل',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: 'G6789012',
                active: true,
                createdAt: '2024-02-15T00:00:00.000Z'
            },
            {
                id: 'std007',
                name: 'احمد صالح موسی الزبیدی',
                username: 'ahmad.saleh',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'ahmad.saleh@gmail.com',
                phone: '+964 776 789 0123',
                university: 'دانشگاه نجف',
                studentId: 'NJF2024007',
                field: 'حقوق خصوصی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.BACHELORS,
                passportNumber: 'G7890123',
                active: true,
                createdAt: '2024-03-01T00:00:00.000Z'
            },
            {
                id: 'std008',
                name: 'مریم سعید جعفر البصری',
                username: 'maryam.saeed',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'maryam.saeed@gmail.com',
                phone: '+964 777 890 1234',
                university: 'جامعه المصطفی',
                studentId: 'MOS2024008',
                field: 'حقوق جنایی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: 'G8901234',
                active: true,
                createdAt: '2024-01-25T00:00:00.000Z'
            },
            {
                id: 'std009',
                name: 'حسین علی محمد الکربلائی',
                username: 'hussein.ali',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'hussein.ali@gmail.com',
                phone: '+964 778 901 2345',
                university: 'دانشگاه کربلا',
                studentId: 'KRB2024009',
                field: 'حقوق بین‌الملل',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.PHD,
                passportNumber: 'G9012345',
                active: true,
                createdAt: '2024-01-05T00:00:00.000Z'
            },
            {
                id: 'std010',
                name: 'سارا محمود رضا الموصلی',
                username: 'sara.mahmoud',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'sara.mahmoud@gmail.com',
                phone: '+964 779 012 3456',
                university: 'دانشگاه بغداد',
                studentId: 'BGD2024010',
                field: 'حقوق عمومی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.BACHELORS,
                passportNumber: 'G0123456',
                active: true,
                createdAt: '2024-03-10T00:00:00.000Z'
            },
            {
                id: 'std011',
                name: 'عمر فاضل کریم التکریتی',
                username: 'omar.fadel',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'omar.fadel@gmail.com',
                phone: '+964 780 123 4567',
                university: 'دانشگاه قم',
                studentId: 'QOM2024011',
                field: 'حقوق خصوصی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: 'G1234567',
                active: true,
                createdAt: '2024-03-15T00:00:00.000Z'
            },
            {
                id: 'std012',
                name: 'نور الهدی سعید احمد الأنباری',
                username: 'noor.saeed',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'noor.saeed@gmail.com',
                phone: '+964 781 234 5678',
                university: 'جامعه المصطفی',
                studentId: 'MOS2024012',
                field: 'حقوق جنایی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.PHD,
                passportNumber: 'G2345678',
                active: true,
                createdAt: '2024-01-18T00:00:00.000Z'
            },
            {
                id: 'std013',
                name: 'یوسف جمال عبدالکریم الدیوانی',
                username: 'youssef.jamal',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'youssef.jamal@gmail.com',
                phone: '+964 782 345 6789',
                university: 'دانشگاه کربلا',
                studentId: 'KRB2024013',
                field: 'حقوق بین‌الملل',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.BACHELORS,
                passportNumber: 'G3456789',
                active: true,
                createdAt: '2024-02-20T00:00:00.000Z'
            },
            {
                id: 'std014',
                name: 'هدی رشید طارق السامرائی',
                username: 'huda.rashid',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'huda.rashid@gmail.com',
                phone: '+964 783 456 7890',
                university: 'دانشگاه نجف',
                studentId: 'NJF2024014',
                field: 'حقوق عمومی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: 'G4567890',
                active: true,
                createdAt: '2024-02-25T00:00:00.000Z'
            },
            {
                id: 'std015',
                name: 'کریم عادل وهاب الحلی',
                username: 'karim.adel',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'karim.adel@gmail.com',
                phone: '+964 784 567 8901',
                university: 'دانشگاه بغداد',
                studentId: 'BGD2024015',
                field: 'حقوق خصوصی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.PHD,
                passportNumber: 'G5678901',
                active: true,
                createdAt: '2024-01-12T00:00:00.000Z'
            },
            {
                id: 'std016',
                name: 'رقیه حمید جاسم الرمادی',
                username: 'ruqayya.hamid',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'ruqayya.hamid@gmail.com',
                phone: '+964 785 678 9012',
                university: 'جامعه المصطفی',
                studentId: 'MOS2024016',
                field: 'حقوق جنایی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.BACHELORS,
                passportNumber: 'G6789012',
                active: true,
                createdAt: '2024-03-05T00:00:00.000Z'
            },
            {
                id: 'std017',
                name: 'طارق نبیل فؤاد الفلوجی',
                username: 'tariq.nabil',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'tariq.nabil@gmail.com',
                phone: '+964 786 789 0123',
                university: 'دانشگاه قم',
                studentId: 'QOM2024017',
                field: 'حقوق بین‌الملل',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: 'G7890123',
                active: true,
                createdAt: '2024-02-05T00:00:00.000Z'
            },
            {
                id: 'std018',
                name: 'سمیه عباس ناصر الحیدری',
                username: 'sumayya.abbas',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'sumayya.abbas@gmail.com',
                phone: '+964 787 890 1234',
                university: 'دانشگاه کربلا',
                studentId: 'KRB2024018',
                field: 'حقوق عمومی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.PHD,
                passportNumber: 'G8901234',
                active: true,
                createdAt: '2024-01-22T00:00:00.000Z'
            },
            {
                id: 'std019',
                name: 'بلال صادق منصور الدجیلی',
                username: 'bilal.sadiq',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'bilal.sadiq@gmail.com',
                phone: '+964 788 901 2345',
                university: 'دانشگاه نجف',
                studentId: 'NJF2024019',
                field: 'حقوق خصوصی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.BACHELORS,
                passportNumber: 'G9012345',
                active: true,
                createdAt: '2024-03-12T00:00:00.000Z'
            },
            {
                id: 'std020',
                name: 'لیلی ماجد رحیم البعقوبی',
                username: 'layla.majed',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'layla.majed@gmail.com',
                phone: '+964 789 012 3456',
                university: 'دانشگاه بغداد',
                studentId: 'BGD2024020',
                field: 'حقوق جنایی',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: 'G0123456',
                active: true,
                createdAt: '2024-02-28T00:00:00.000Z'
            }
        ];
    },

    // Default orders data
    getDefaultOrders() {
        return [
            {
                id: 'ord001',
                studentId: 'std001',
                studentName: 'قاسم محمود حسن بغدادی',
                university: 'دانشگاه قم',
                field: 'حقوق محض',
                degree: CONFIG.DEGREES.MASTERS,
                type: CONFIG.ORDER_TYPES.THESIS,
                status: CONFIG.ORDER_STATUS.IN_PROGRESS,
                stage: 'عامل در حال نوشتن رساله شما است',
                estimatedDays: 45,
                deadline: '2025-06-15',
                assignedDoctor: 'عامل معصومی',
                assignedDoctorId: 'doc001',
                progress: 45,
                totalAmount: 800,
                doctorShare: 480,
                managerShare: 320,
                paymentStatus: 'partial',
                paidAmount: 400,
                createdAt: '2025-01-15T00:00:00.000Z',
                tasks: [
                    {
                        id: 'task001',
                        title: 'انتخاب عنوان رساله',
                        status: CONFIG.ORDER_STATUS.COMPLETED,
                        assignedTo: 'doctor',
                        assignedUserId: 'doc001',
                        dueDate: '2025-02-01',
                        completedAt: '2025-01-28T00:00:00.000Z'
                    },
                    {
                        id: 'task002',
                        title: 'تایید عنوان توسط لجنه',
                        status: CONFIG.ORDER_STATUS.COMPLETED,
                        assignedTo: 'employee',
                        assignedUserId: 'emp001',
                        dueDate: '2025-02-10',
                        completedAt: '2025-02-08T00:00:00.000Z'
                    },
                    {
                        id: 'task003',
                        title: 'نوشتن فصل اول رساله',
                        status: CONFIG.ORDER_STATUS.IN_PROGRESS,
                        assignedTo: 'doctor',
                        assignedUserId: 'doc001',
                        dueDate: '2025-04-15'
                    }
                ],
                rejectionHistory: []
            },
            {
                id: 'ord002',
                studentId: 'std002',
                studentName: 'حسن یاسر کرار حسینی',
                university: 'جامعه المصطفی',
                field: 'حقوق عمومی',
                degree: CONFIG.DEGREES.PHD,
                type: CONFIG.ORDER_TYPES.ARTICLE,
                status: CONFIG.ORDER_STATUS.PENDING,
                stage: 'در انتظار تایید مدیر',
                estimatedDays: 0,
                deadline: '2025-05-20',
                assignedDoctor: null,
                assignedDoctorId: null,
                progress: 0,
                totalAmount: 600,
                doctorShare: 420,
                managerShare: 180,
                paymentStatus: 'pending',
                paidAmount: 0,
                createdAt: '2025-01-20T00:00:00.000Z',
                tasks: [],
                rejectionHistory: []
            },
            {
                id: 'ord003',
                studentId: 'std001',
                studentName: 'قاسم محمود حسن بغدادی',
                university: 'دانشگاه قم',
                field: 'حقوق محض',
                degree: CONFIG.DEGREES.MASTERS,
                type: CONFIG.ORDER_TYPES.ARTICLE,
                status: CONFIG.ORDER_STATUS.APPROVED,
                stage: 'مدیر پروژه را تایید کرد - هماهنگی در حال انجام است',
                estimatedDays: 30,
                deadline: '2025-07-01',
                assignedDoctor: null,
                assignedDoctorId: null,
                progress: 10,
                totalAmount: 300,
                doctorShare: 210,
                managerShare: 90,
                paymentStatus: 'pending',
                paidAmount: 0,
                createdAt: '2025-01-25T00:00:00.000Z',
                tasks: [],
                rejectionHistory: []
            }
        ];
    }
};
