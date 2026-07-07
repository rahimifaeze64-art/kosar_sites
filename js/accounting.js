// Personal Accounting System - سیستم حسابداری شخصی
const AccountingModule = {
    // Storage key for accounting data
    STORAGE_KEY: 'personal_accounting_data',
    
    // Supported currencies
    CURRENCIES: {
        TOMAN: { code: 'تومان', symbol: 'تومان', name: 'تومان' },
        RIAL: { code: 'ریال', symbol: 'ریال', name: 'ریال' },
        DOLLAR: { code: 'دلار', symbol: '$', name: 'دلار آمریکا' },
        DINAR: { code: 'دینار', symbol: 'د.ع', name: 'دینار عراق' }
    },
    
    // Exchange rates (relative to Toman)
    EXCHANGE_RATES: {
        'تومان': 1,
        'ریال': 0.1,
        'دلار': 170000,
        'دینار': 130
    },
    
    // Transaction types
    TRANSACTION_TYPES: {
        INCOME: 'income',      // درآمد
        EXPENSE: 'expense',    // هزینه
        DEBT: 'debt',          // بدهی
        CREDIT: 'credit'       // بستانکاری
    },
    
    // Categories for transactions
    CATEGORIES: {
        INCOME: [
            'درآمد شرکت',
            'فروش خدمات',
            'سود پروژه',
            'سایر درآمدها'
        ],
        EXPENSE: [
            'هزینه‌های عملیاتی',
            'حقوق و دستمزد',
            'اجاره و امکانات',
            'تجهیزات و ابزار',
            'سایر هزینه‌ها'
        ],
        DEBT: [
            'بدهی به شرکا',
            'وام و تسهیلات',
            'بدهی به تامین‌کنندگان',
            'سایر بدهی‌ها'
        ],
        CREDIT: [
            'طلب از مشتریان',
            'پیش پرداخت داده شده',
            'سپرده‌های پرداختی',
            'سایر بستانکاری‌ها'
        ]
    },
    
    // Initialize accounting module
    init() {
        try {
            debugLogger('Initializing Accounting Module...', 'info');
            this.loadData();
            debugLogger('Accounting Module initialized successfully', 'success');
        } catch (error) {
            debugLogger('Error initializing Accounting Module', 'error', error);
        }
    },
    
    // Load data from localStorage
    loadData() {
        const savedData = localStorage.getItem(this.STORAGE_KEY);
        if (savedData) {
            this.data = JSON.parse(savedData);
            // Ensure persons array exists
            if (!this.data.persons) {
                this.data.persons = [];
            }
            // Load custom categories if they exist
            if (this.data.customCategories) {
                // Merge custom categories with default ones
                Object.keys(this.data.customCategories).forEach(type => {
                    if (this.CATEGORIES[type.toUpperCase()]) {
                        this.data.customCategories[type].forEach(cat => {
                            if (!this.CATEGORIES[type.toUpperCase()].includes(cat)) {
                                this.CATEGORIES[type.toUpperCase()].push(cat);
                            }
                        });
                    }
                });
            }
        } else {
            this.data = {
                transactions: [],
                persons: [],
                accounts: [],
                customCategories: {
                    income: [],
                    expense: [],
                    debt: [],
                    credit: []
                },
                settings: {
                    currency: 'تومان',
                    dateFormat: 'persian'
                }
            };
            this.saveData();
        }
    },
    
    // Save data to localStorage
    saveData() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        debugLogger('Accounting data saved', 'info');
    },
    
    // Add new transaction
    addTransaction(transactionData) {
        const transaction = {
            id: this.generateId(),
            type: transactionData.type,
            amount: parseFloat(transactionData.amount),
            currency: transactionData.currency || 'تومان',
            category: transactionData.category,
            description: transactionData.description || '',
            personId: transactionData.personId || null,
            date: transactionData.date || new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        this.data.transactions.push(transaction);
        this.saveData();
        
        debugLogger('Transaction added', 'success', transaction);
        return transaction;
    },
    
    // Update transaction
    updateTransaction(id, updates) {
        const index = this.data.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            this.data.transactions[index] = { ...this.data.transactions[index], ...updates };
            this.saveData();
            debugLogger('Transaction updated', 'success', this.data.transactions[index]);
            return this.data.transactions[index];
        }
        return null;
    },
    
    // Delete transaction
    deleteTransaction(id) {
        const index = this.data.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            const deleted = this.data.transactions.splice(index, 1)[0];
            this.saveData();
            debugLogger('Transaction deleted', 'success', deleted);
            return deleted;
        }
        return null;
    },
    
    // Get all transactions
    getTransactions(filters = {}) {
        let transactions = [...this.data.transactions];
        
        // Apply filters
        if (filters.type) {
            transactions = transactions.filter(t => t.type === filters.type);
        }
        
        if (filters.category) {
            transactions = transactions.filter(t => t.category === filters.category);
        }
        
        if (filters.personId) {
            transactions = transactions.filter(t => t.personId === filters.personId);
        }
        
        if (filters.dateFrom) {
            transactions = transactions.filter(t => new Date(t.date) >= new Date(filters.dateFrom));
        }
        
        if (filters.dateTo) {
            transactions = transactions.filter(t => new Date(t.date) <= new Date(filters.dateTo));
        }
        
        // Sort by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return transactions;
    },
    
    // Calculate balance
    calculateBalance(personId = 'all', targetCurrency = 'تومان') {
        let transactions = this.data.transactions;
        
        // Filter by person if specified
        if (personId !== 'all') {
            transactions = transactions.filter(t => t.personId === personId);
        }
        
        // Convert all amounts to target currency
        const convertAmount = (amount, fromCurrency) => {
            const fromRate = this.EXCHANGE_RATES[fromCurrency] || 1;
            const toRate = this.EXCHANGE_RATES[targetCurrency] || 1;
            return (amount * fromRate) / toRate;
        };
        
        const income = transactions
            .filter(t => t.type === this.TRANSACTION_TYPES.INCOME)
            .reduce((sum, t) => sum + convertAmount(t.amount, t.currency || 'تومان'), 0);
            
        const expense = transactions
            .filter(t => t.type === this.TRANSACTION_TYPES.EXPENSE)
            .reduce((sum, t) => sum + convertAmount(t.amount, t.currency || 'تومان'), 0);
            
        const debt = transactions
            .filter(t => t.type === this.TRANSACTION_TYPES.DEBT)
            .reduce((sum, t) => sum + convertAmount(t.amount, t.currency || 'تومان'), 0);
            
        const credit = transactions
            .filter(t => t.type === this.TRANSACTION_TYPES.CREDIT)
            .reduce((sum, t) => sum + convertAmount(t.amount, t.currency || 'تومان'), 0);
        
        return {
            totalIncome: income,
            totalExpense: expense,
            totalDebt: debt,
            totalCredit: credit,
            netBalance: income - expense,
            netWorth: income - expense + credit - debt,
            currency: targetCurrency
        };
    },
    
    // Get statistics by category
    getStatsByCategory(type) {
        const transactions = this.data.transactions.filter(t => t.type === type);
        const stats = {};
        
        transactions.forEach(t => {
            if (!stats[t.category]) {
                stats[t.category] = {
                    amount: 0,
                    count: 0
                };
            }
            stats[t.category].amount += t.amount;
            stats[t.category].count += 1;
        });
        
        return stats;
    },
    
    // Get monthly summary
    getMonthlySummary(year, month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const monthlyTransactions = this.data.transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate >= startDate && transactionDate <= endDate;
        });
        
        const income = monthlyTransactions
            .filter(t => t.type === this.TRANSACTION_TYPES.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);
            
        const expense = monthlyTransactions
            .filter(t => t.type === this.TRANSACTION_TYPES.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);
        
        return {
            income,
            expense,
            balance: income - expense,
            transactions: monthlyTransactions
        };
    },
    
    // Generate unique ID
    generateId() {
        return 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    // Person Management Methods
    
    // Add new person
    addPerson(personData) {
        const person = {
            id: this.generateId(),
            name: personData.name,
            type: personData.type || 'other', // دانشجو، نویسنده، آزاد، سایر
            phone: personData.phone || '',
            notes: personData.notes || '',
            createdAt: new Date().toISOString()
        };
        
        this.data.persons.push(person);
        this.saveData();
        
        debugLogger('Person added', 'success', person);
        return person;
    },
    
    // Get all persons
    getPersons() {
        return this.data.persons || [];
    },
    
    // Get person by ID
    getPerson(id) {
        return this.data.persons.find(p => p.id === id);
    },
    
    // Get person name by ID
    getPersonName(id) {
        const person = this.getPerson(id);
        return person ? person.name : 'نامشخص';
    },
    
    // Update person
    updatePerson(id, updates) {
        const index = this.data.persons.findIndex(p => p.id === id);
        if (index !== -1) {
            this.data.persons[index] = { ...this.data.persons[index], ...updates };
            this.saveData();
            debugLogger('Person updated', 'success', this.data.persons[index]);
            return this.data.persons[index];
        }
        return null;
    },
    
    // Delete person
    deletePerson(id) {
        const index = this.data.persons.findIndex(p => p.id === id);
        if (index !== -1) {
            const deleted = this.data.persons.splice(index, 1)[0];
            this.saveData();
            debugLogger('Person deleted', 'success', deleted);
            return deleted;
        }
        return null;
    },
    
    // Format currency
    formatCurrency(amount, currency = null) {
        const curr = currency || this.data.settings.currency || 'تومان';
        const formatted = new Intl.NumberFormat('fa-IR').format(Math.round(amount));
        return `${formatted} ${curr}`;
    },
    
    // Convert currency
    convertCurrency(amount, fromCurrency, toCurrency) {
        const fromRate = this.EXCHANGE_RATES[fromCurrency] || 1;
        const toRate = this.EXCHANGE_RATES[toCurrency] || 1;
        return (amount * fromRate) / toRate;
    },
    
    // Update exchange rate
    updateExchangeRate(currency, rate) {
        this.EXCHANGE_RATES[currency] = rate;
        debugLogger('Exchange rate updated', 'info', { currency, rate });
    },
    
    // Get all currencies
    getCurrencies() {
        return Object.values(this.CURRENCIES);
    },
    
    // Add custom category
    addCustomCategory(type, categoryName) {
        const typeUpper = type.toUpperCase();
        
        if (!this.CATEGORIES[typeUpper]) {
            debugLogger('Invalid transaction type', 'error', { type });
            return false;
        }
        
        // Check if category already exists
        if (this.CATEGORIES[typeUpper].includes(categoryName)) {
            return true;
        }
        
        // Add to categories
        this.CATEGORIES[typeUpper].push(categoryName);
        
        // Save to custom categories in data
        if (!this.data.customCategories) {
            this.data.customCategories = {
                income: [],
                expense: [],
                debt: [],
                credit: []
            };
        }
        
        if (!this.data.customCategories[type]) {
            this.data.customCategories[type] = [];
        }
        
        if (!this.data.customCategories[type].includes(categoryName)) {
            this.data.customCategories[type].push(categoryName);
            this.saveData();
            debugLogger('Custom category added', 'success', { type, categoryName });
        }
        
        return true;
    },
    
    // Export data
    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `accounting-data-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    },
    
    // Import data
    importData(jsonData) {
        try {
            const importedData = JSON.parse(jsonData);
            if (importedData.transactions && Array.isArray(importedData.transactions)) {
                this.data = importedData;
                this.saveData();
                debugLogger('Data imported successfully', 'success');
                return true;
            }
        } catch (error) {
            debugLogger('Error importing data', 'error', error);
        }
        return false;
    }
};