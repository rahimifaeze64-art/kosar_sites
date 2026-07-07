function appData() {
    return {
        currentRole: 'manager',
        showModal: null,
        selectedOrder: null,
        
        // Sample data
        orders: [
            {
                id: 1,
                studentName: 'احمد محمدی',
                studentId: 'ST001',
                university: 'دانشگاه تهران',
                field: 'مهندسی کامپیوتر',
                degree: 'ارشد',
                type: 'نوشتن رساله',
                status: 'pending',
                stage: 'بررسی عنوان',
                deadline: '2024-02-15',
                assignedDoctor: null,
                progress: 25,
                tasks: [
                    { id: 1, title: 'انتخاب عنوان', status: 'completed', assignedTo: 'doctor', dueDate: '2024-01-10' },
                    { id: 2, title: 'تایید عنوان', status: 'in_progress', assignedTo: 'employee', dueDate: '2024-01-15' },
                    { id: 3, title: 'نوشتن استماره ۲', status: 'pending', assignedTo: 'doctor', dueDate: '2024-01-20' }
                ],
                rejectionHistory: []
            },
            {
                id: 2,
                studentName: 'زینب احمدی',
                studentId: 'ST002',
                university: 'دانشگاه شریف',
                field: 'مهندسی برق',
                degree: 'عاملا',
                type: 'نوشتن مقاله',
                status: 'approved',
                stage: 'نوشتن مقاله اول',
                deadline: '2024-03-01',
                assignedDoctor: 'عامل رضایی',
                progress: 60,
                tasks: [
                    { id: 1, title: 'انتخاب موضوع مقاله', status: 'completed', assignedTo: 'doctor', dueDate: '2024-01-05' },
                    { id: 2, title: 'نوشتن مقاله اول', status: 'in_progress', assignedTo: 'doctor', dueDate: '2024-01-25' }
                ],
                rejectionHistory: []
            },
            {
                id: 3,
                studentName: 'علی حسینی',
                studentId: 'ST003',
                university: 'دانشگاه امیرکبیر',
                field: 'مهندسی مکانیک',
                degree: 'ارشد',
                type: 'ترجمه رساله',
                status: 'rejected',
                stage: 'بازنگری',
                deadline: '2024-02-20',
                assignedDoctor: 'عامل احمدی',
                progress: 40,
                tasks: [
                    { id: 1, title: 'ترجمه فصل اول', status: 'rejected', assignedTo: 'translator', dueDate: '2024-01-12' }
                ],
                rejectionHistory: [
                    { date: '2024-01-12', reason: 'کیفیت ترجمه مناسب نیست', rejectedBy: 'employee' }
                ]
            }
        ],
        
        users: [
            { id: 1, name: 'عامل رضایی', role: 'doctor', specialization: 'مهندسی کامپیوتر', active: true },
            { id: 2, name: 'عامل احمدی', role: 'doctor', specialization: 'مهندسی مکانیک', active: true },
            { id: 3, name: 'مریم محمدی', role: 'employee', department: 'هماهنگی', active: true },
            { id: 4, name: 'حسن ترجمان', role: 'translator', languages: ['عربی', 'انگلیسی'], active: true },
            { id: 5, name: 'رضایی', role: 'agent', department: 'عملیات', active: true },
            { id: 6, name: 'کریمی', role: 'agent', department: 'عملیات', active: true }
        ],

        // Methods
        switchRole() {
            this.showModal = null;
            // Save role to localStorage
            localStorage.setItem('currentRole', this.currentRole);
        },

        getRoleName(role) {
            const roleNames = {
                'manager': 'مدیر',
                'employee': 'کارمند',
                'agent': 'عامل',
                'student': 'دانشجو'
            };
            return roleNames[role] || role;
        },

        getOrdersByStatus(status) {
            return this.orders.filter(order => order.status === status);
        },

        get filteredOrders() {
            // Filter orders based on current role
            switch(this.currentRole) {
                case 'student':
                    // Students see only their orders (for demo, showing all)
                    return this.orders;
                case 'doctor':
                    // Doctors see orders assigned to them
                    return this.orders.filter(order => order.assignedDoctor);
                case 'employee':
                    // Employees see orders that need empination
                    return this.orders.filter(order => ['pending', 'in_progress'].includes(order.status));
                default:
                    return this.orders;
            }
        },

        getStatusClass(status) {
            const classes = {
                'pending': 'bg-yellow-100 text-yellow-800',
                'approved': 'bg-green-100 text-green-800',
                'rejected': 'bg-red-100 text-red-800',
                'in_progress': 'bg-blue-100 text-blue-800',
                'completed': 'bg-purple-100 text-purple-800'
            };
            return classes[status] || 'bg-gray-100 text-gray-800';
        },

        getStatusText(status) {
            const texts = {
                'pending': 'در انتظار',
                'approved': 'تایید شده',
                'rejected': 'رد شده',
                'in_progress': 'در حال انجام',
                'completed': 'تکمیل شده'
            };
            return texts[status] || status;
        },

        viewOrder(order) {
            this.selectedOrder = order;
            this.showModal = 'viewOrder';
        },

        editOrder(order) {
            this.selectedOrder = { ...order };
            this.showModal = 'editOrder';
        },

        saveOrder() {
            const index = this.orders.findIndex(o => o.id === this.selectedOrder.id);
            if (index !== -1) {
                this.orders[index] = { ...this.selectedOrder };
            }
            this.showModal = null;
            this.saveData();
        },

        addNewOrder(orderData) {
            const newOrder = {
                id: this.orders.length + 1,
                ...orderData,
                status: 'pending',
                stage: 'ثبت اولیه',
                progress: 0,
                tasks: [],
                rejectionHistory: []
            };
            this.orders.push(newOrder);
            this.saveData();
            this.showModal = null;
        },

        assignTaskToDoctor(orderId, doctorId, taskDescription) {
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
                const doctor = this.users.find(u => u.id === doctorId);
                order.assignedDoctor = doctor.name;
                order.status = 'in_progress';
                order.tasks.push({
                    id: order.tasks.length + 1,
                    title: taskDescription,
                    status: 'pending',
                    assignedTo: 'doctor',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                });
                this.saveData();
            }
        },

        rejectTask(orderId, reason) {
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
                order.status = 'rejected';
                order.rejectionHistory.push({
                    date: new Date().toISOString().split('T')[0],
                    reason: reason,
                    rejectedBy: this.currentRole
                });
                this.saveData();
            }
        },

        approveTask(orderId) {
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
                order.status = 'approved';
                order.progress = Math.min(order.progress + 20, 100);
                this.saveData();
            }
        },

        // Data persistence
        saveData() {
            localStorage.setItem('ordersData', JSON.stringify(this.orders));
            localStorage.setItem('usersData', JSON.stringify(this.users));
        },

        loadData() {
            const savedOrders = localStorage.getItem('ordersData');
            const savedUsers = localStorage.getItem('usersData');
            const savedRole = localStorage.getItem('currentRole');
            
            if (savedOrders) {
                this.orders = JSON.parse(savedOrders);
            }
            if (savedUsers) {
                this.users = JSON.parse(savedUsers);
            }
            if (savedRole) {
                this.currentRole = savedRole;
            }
        },

        // Initialize
        init() {
            this.loadData();
        }
    }
}