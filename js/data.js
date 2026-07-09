// Data Management Module
// نسخه داده - هر بار که لیست دانشجویان تغییر کند این عدد را افزایش دهید
const DATA_VERSION = '2025.07.09.v4';

const DataModule = {
    // Initialize default data
    initializeData() {
        try {
            if (typeof debugLogger !== 'undefined') {
                debugLogger('Initializing data module...', 'info');
            }

            // اگر نسخه داده تغییر کرده، localStorage را پاک و با داده جدید جایگزین کن
            const storedVersion = localStorage.getItem('data_version');
            if (storedVersion !== DATA_VERSION) {
                console.log(`🔄 نسخه داده تغییر کرده (${storedVersion} → ${DATA_VERSION}). بازنشانی داده‌ها...`);
                localStorage.removeItem(CONFIG.STORAGE_KEYS.USERS);
                localStorage.removeItem(CONFIG.STORAGE_KEYS.ORDERS);
                localStorage.removeItem('students_data');
                localStorage.setItem('data_version', DATA_VERSION);
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

            // مقداردهی پیشرفت دانشجویان فارغ‌التحصیل (grad001-grad056)
            // گردش دفاع و ملزومات = کاملاً تکمیل | فارغ‌التحصیلی = مرحله اول در حال انجام
            this._initGradStudentsProgress();
            
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
                return [];
            }
            
            const orders = JSON.parse(ordersStr);
            
            if (!Array.isArray(orders)) {
                return [];
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
            return [];
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

    // مقداردهی پیشرفت دانشجویان فارغ‌التحصیل در localStorage
    _initGradStudentsProgress() {
        const gradIds = [
            'grad001','grad002','grad003','grad004','grad005','grad006','grad007',
            'grad008','grad009','grad010','grad011','grad012','grad013','grad014',
            'grad015','grad016','grad017','grad018','grad019','grad020','grad021',
            'grad022','grad023','grad024','grad025','grad026','grad027','grad028',
            'grad029','grad030','grad031','grad032','grad033','grad034','grad035',
            'grad036','grad037','grad038','grad039','grad040','grad041','grad042',
            'grad043','grad044','grad045','grad046','grad047','grad048','grad049',
            'grad050','grad051','grad052','grad053','grad054','grad055','grad056'
        ];

        // تعداد مراحل هر مسیر از localStorage یا پیش‌فرض
        const getStepCount = (key, defaultCount) => {
            try {
                const raw = localStorage.getItem(key);
                if (raw) return JSON.parse(raw).length;
            } catch(e) {}
            return defaultCount;
        };

        const defenseCount      = getStepCount('custom_defense_steps', 17);
        const requirementsCount = getStepCount('custom_requirements_steps', 11);
        const educationalCount  = getStepCount('custom_educational_steps', 21);

        const STATUS_COMPLETED = 2;
        const STATUS_CURRENT   = 1;
        const STATUS_INCOMPLETE = 0;

        gradIds.forEach(id => {
            // گردش دفاع - همه تکمیل
            if (!localStorage.getItem(`prog_${id}_defense`)) {
                const prog = Array(defenseCount).fill(null).map(() => ({ status: STATUS_COMPLETED }));
                localStorage.setItem(`prog_${id}_defense`, JSON.stringify(prog));
            }
            // ملزومات - همه تکمیل
            if (!localStorage.getItem(`prog_${id}_requirements`)) {
                const prog = Array(requirementsCount).fill(null).map(() => ({ status: STATUS_COMPLETED }));
                localStorage.setItem(`prog_${id}_requirements`, JSON.stringify(prog));
            }
            // فارغ‌التحصیلی - مرحله اول در حال انجام، بقیه تکمیل نشده
            if (!localStorage.getItem(`prog_${id}_educational`)) {
                const prog = Array(educationalCount).fill(null).map((_, i) => ({
                    status: i === 0 ? STATUS_CURRENT : STATUS_INCOMPLETE
                }));
                localStorage.setItem(`prog_${id}_educational`, JSON.stringify(prog));
            }
        });
    },

    // Default users data
    getDefaultUsers() {
        return [
            // Manager - مدیر
            {
                id: 'mgr001',
                name: 'دکتر تقی زاده',
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
            {
                id: 'emp005',
                name: 'مهدی',
                username: 'mahdi',
                password: '123456',
                role: CONFIG.ROLES.employee,
                email: 'mahdi@edu-system.com',
                phone: '+98 917 678 9012',
                department: 'هماهنگی عمومی',
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
                name: 'طیف حیدر نعومي',
                username: 'tayf.haider',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'tayf.haider@gmail.com',
                phone: '+964 770 001 0001',
                university: 'جامعه المصطفی',
                studentId: 'STD2024001',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-15T00:00:00.000Z'
            },
            {
                id: 'std002',
                name: 'حیدر احسان عبد علي هيكل',
                username: 'haider.ihsan',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'haider.ihsan@gmail.com',
                phone: '+964 770 001 0002',
                university: 'جامعه المصطفی',
                studentId: 'STD2024002',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-16T00:00:00.000Z'
            },
            {
                id: 'std003',
                name: 'اسماء حسن کاطع',
                username: 'asmaa.hasan',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'asmaa.hasan@gmail.com',
                phone: '+964 770 001 0003',
                university: 'جامعه المصطفی',
                studentId: 'STD2024003',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-17T00:00:00.000Z'
            },
            {
                id: 'std004',
                name: 'فرهاد حسین علی ارکوازي',
                username: 'farhad.hussein',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'farhad.hussein@gmail.com',
                phone: '+964 770 001 0004',
                university: 'جامعه المصطفی',
                studentId: 'STD2024004',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-18T00:00:00.000Z'
            },
            {
                id: 'std005',
                name: 'عارف حسیب محمد محمد',
                username: 'aref.hasib',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'aref.hasib@gmail.com',
                phone: '+964 770 001 0005',
                university: 'جامعه المصطفی',
                studentId: 'STD2024005',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-19T00:00:00.000Z'
            },
            {
                id: 'std006',
                name: 'علي محمود عبد عبد',
                username: 'ali.mahmoud',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'ali.mahmoud@gmail.com',
                phone: '+964 770 001 0006',
                university: 'جامعه المصطفی',
                studentId: 'STD2024006',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-20T00:00:00.000Z'
            },
            {
                id: 'std007',
                name: 'مهدي جاسم محمد الساعدي',
                username: 'mahdi.jasim',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'mahdi.jasim@gmail.com',
                phone: '+964 770 001 0007',
                university: 'جامعه المصطفی',
                studentId: 'STD2024007',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-21T00:00:00.000Z'
            },
            {
                id: 'std008',
                name: 'مالک جبار فشاخ',
                username: 'malik.jabbar',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'malik.jabbar@gmail.com',
                phone: '+964 770 001 0008',
                university: 'جامعه المصطفی',
                studentId: 'STD2024008',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-22T00:00:00.000Z'
            },
            {
                id: 'std009',
                name: 'احمد حرز سکوت',
                username: 'ahmad.hirz',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'ahmad.hirz@gmail.com',
                phone: '+964 770 001 0009',
                university: 'جامعه المصطفی',
                studentId: 'STD2024009',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-23T00:00:00.000Z'
            },
            {
                id: 'std010',
                name: 'محمد عبیس لعیبي النائلي',
                username: 'mohammad.ubais',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'mohammad.ubais@gmail.com',
                phone: '+964 770 001 0010',
                university: 'جامعه المصطفی',
                studentId: 'STD2024010',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-24T00:00:00.000Z'
            },
            {
                id: 'std011',
                name: 'ذوالفقار ناصر غافل الفحام',
                username: 'dhulfiqar.nasir',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'dhulfiqar.nasir@gmail.com',
                phone: '+964 770 001 0011',
                university: 'جامعه المصطفی',
                studentId: 'STD2024011',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-25T00:00:00.000Z'
            },
            {
                id: 'std012',
                name: 'غزوان فیصل هادي العوادي',
                username: 'ghazwan.faisal',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'ghazwan.faisal@gmail.com',
                phone: '+964 770 001 0012',
                university: 'جامعه المصطفی',
                studentId: 'STD2024012',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-26T00:00:00.000Z'
            },
            {
                id: 'std013',
                name: 'سیف علي اسود الحسین',
                username: 'saif.ali',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'saif.ali@gmail.com',
                phone: '+964 770 001 0013',
                university: 'جامعه المصطفی',
                studentId: 'STD2024013',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-27T00:00:00.000Z'
            },
            {
                id: 'std014',
                name: 'علي اتیلا اسماعیل الرفاعي',
                username: 'ali.atila',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'ali.atila@gmail.com',
                phone: '+964 770 001 0014',
                university: 'جامعه المصطفی',
                studentId: 'STD2024014',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-28T00:00:00.000Z'
            },
            {
                id: 'std015',
                name: 'رسول محمد کاظم کاظم',
                username: 'rasool.mohammad',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'rasool.mohammad@gmail.com',
                phone: '+964 770 001 0015',
                university: 'جامعه المصطفی',
                studentId: 'STD2024015',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-29T00:00:00.000Z'
            },
            {
                id: 'std016',
                name: 'محمد حسین حسن الجعباوي',
                username: 'mohammad.hussein',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'mohammad.hussein@gmail.com',
                phone: '+964 770 001 0016',
                university: 'جامعه المصطفی',
                studentId: 'STD2024016',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-30T00:00:00.000Z'
            },
            {
                id: 'std017',
                name: 'مرتضی غسان مجید محسن',
                username: 'mortadha.ghassan',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'mortadha.ghassan@gmail.com',
                phone: '+964 770 001 0017',
                university: 'جامعه المصطفی',
                studentId: 'STD2024017',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-01-31T00:00:00.000Z'
            },
            {
                id: 'std018',
                name: 'حسنین صبري شکر الجبوري',
                username: 'husanain.sabri',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'husanain.sabri@gmail.com',
                phone: '+964 770 001 0018',
                university: 'جامعه المصطفی',
                studentId: 'STD2024018',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-02-01T00:00:00.000Z'
            },
            {
                id: 'std019',
                name: 'محمد طارق اسماعیل اسماعیل',
                username: 'mohammad.tariq',
                password: '123456',
                role: CONFIG.ROLES.STUDENT,
                email: 'mohammad.tariq@gmail.com',
                phone: '+964 770 001 0019',
                university: 'جامعه المصطفی',
                studentId: 'STD2024019',
                field: 'حقوق',
                bachelorField: 'حقوق',
                degree: CONFIG.DEGREES.MASTERS,
                passportNumber: '',
                active: true,
                createdAt: '2024-02-02T00:00:00.000Z'
            },
            // دانشجویان فارغ‌التحصیلی (گردش دفاع و ملزومات کامل)
            { id:'grad001', name:'زمان فاضل احمد الشروفي',   username:'zaman.fadhel',    password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD001', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad002', name:'سماح کریم نجم بهادلی',      username:'samah.karim',      password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD002', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad003', name:'زینب جبار وذاح البهادلی',   username:'zainab.jabbar',    password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD003', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad004', name:'رائد فیصل عبیس الجبوری',    username:'raed.faisal',      password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD004', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad005', name:'کرار عمار حمید حمید',        username:'karar.ammar',      password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD005', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad006', name:'حسین علي حسین الفطن',        username:'hussein.ali.fatan', password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD006', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad007', name:'الحسن زید عبود الغریري',     username:'alhassan.zaid',    password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD007', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad008', name:'علي فالح رشید ال صبر',       username:'ali.falih',        password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD008', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad009', name:'جعفر داخل عبد العارضي',      username:'jafar.dakhil',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD009', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad010', name:'محمد فاضل عباس عباس',        username:'mohammad.fadhel',  password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD010', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad011', name:'مهدي صالح مهدي الجنابي',      username:'mahdi.salih',      password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD011', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad012', name:'اسراء صباح البدیري',           username:'israa.sabah',      password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD012', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad013', name:'حسام ابراهیم محمود الکیشوان',  username:'husam.ibrahim',    password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD013', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad014', name:'لیث محمد عبدالیمه العبودي',    username:'laith.mohammad',   password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD014', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad015', name:'علي صالح ناصر ناصر',           username:'ali.salih.nasir',  password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD015', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad016', name:'علي صکبان علي الجاسم',         username:'ali.sakban',       password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD016', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad017', name:'مهند ناهی کبر کبر',            username:'mohanad.nahi',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD017', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad018', name:'ابتهاج عبدالستار عبدالرحیم عبدالرحیم', username:'ibtihaj.abd', password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD018', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad019', name:'هات محمد صبري صبري',           username:'hat.mohammad',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD019', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad020', name:'مصطفی نجم العبادة',             username:'mustafa.najm',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD020', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad021', name:'سلطان علي یاسر الصافي',        username:'sultan.ali',       password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD021', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad022', name:'علي احمد مهدي مهدي',           username:'ali.ahmad.mahdi',  password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD022', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad023', name:'واثق غني عبد الصالحی',         username:'wathiq.ghani',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD023', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad024', name:'ابراهیم عواد کاظم الجعباوي',   username:'ibrahim.awad',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD024', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad025', name:'یاسر خضیر عباس التمیمي',       username:'yaser.khudhair',   password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD025', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad026', name:'رامي صادق کریم الربیعي',       username:'rami.sadiq',       password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD026', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad027', name:'لیث حیدر هاشم الخیاط',         username:'laith.haider',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD027', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad028', name:'مصطفی جاسم محمد الیاسري',      username:'mustafa.jasim',    password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD028', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad029', name:'سجاد مصطفی محمد محمد',         username:'sajjad.mustafa',   password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD029', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad030', name:'عمار جبار کشاش الشرماني',      username:'ammar.jabbar',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD030', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad031', name:'محمد رائد محمود محمود',         username:'mohammad.raed',    password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD031', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad032', name:'علی منیر حمزه الجوراني',        username:'ali.munir',        password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD032', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad033', name:'عبدالله عبدالمنعم عاجل العمري', username:'abdullah.abd',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD033', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad034', name:'محمد صبار سعید العباسي',        username:'mohammad.sabbar',  password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD034', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad035', name:'احمد علی فلاح التمیمي',         username:'ahmad.ali.falah',  password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD035', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad036', name:'عبدالله صلاح عبید الرماحي',     username:'abdullah.salah',   password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD036', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad037', name:'نور حیدر خیرالله خیرالله',       username:'noor.haider',      password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD037', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad038', name:'فلاح مجیل محمد محمد',           username:'falah.majeel',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD038', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad039', name:'علي غني حبیب الغزي',            username:'ali.ghani',        password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD039', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad040', name:'احمد غیث جبار ابوناصریه',       username:'ahmad.ghaith',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD040', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad041', name:'غدیر عیسی خلیل خلیل',           username:'ghadir.isa',       password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD041', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad042', name:'عباس صلال صاحب الشکري',         username:'abbas.salal',      password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD042', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad043', name:'محمد جواد کاظم الشویل',         username:'mohammad.jawad2',  password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD043', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad044', name:'نور الدین فلاح حسین العود',      username:'nuruddin.falah',   password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD044', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad045', name:'قسور بریر هاشم الوردی',         username:'qasur.brarir',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD045', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad046', name:'یعقوب محمد یعقوب یعقوب',        username:'yaqoob.mohammad',  password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD046', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad047', name:'مصطفی منعم صالح صالح',          username:'mustafa.munem',    password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD047', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad048', name:'جعفر کریم سلمان سلمان',          username:'jafar.karim',      password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD048', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad049', name:'احمد صائب زید الجنابي',          username:'ahmad.saib',       password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD049', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad050', name:'علي حمزه جواد العجیلي',          username:'ali.hamza',        password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD050', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad051', name:'مصطفی احمد محسن الکبیسي',        username:'mustafa.ahmad2',   password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD051', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad052', name:'حسین عباس فاضل المحمد',          username:'hussein.abbas',    password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD052', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad053', name:'سجاد علي ثامر الخفاجي',          username:'sajjad.ali',       password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD053', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad054', name:'جبار حمید حسین بیرماني',         username:'jabbar.hamid',     password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD054', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad055', name:'اخلاص عبدالامیر سوادي الغالب',   username:'ikhlас.abd',       password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD055', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' },
            { id:'grad056', name:'حیدر مکي محمدرضا الحضیري',       username:'haider.maki',      password:'123456', role:CONFIG.ROLES.STUDENT, university:'جامعه المصطفی', studentId:'GRAD056', field:'حقوق', degree:CONFIG.DEGREES.MASTERS, active:true, createdAt:'2023-09-01T00:00:00.000Z' }
        ];
    }

};