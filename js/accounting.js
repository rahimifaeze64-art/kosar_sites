/**
 * سیستم حسابداری شخصی
 * ذخیره‌سازی: localStorage (اصلی) + Supabase accounting_transactions (sync)
 */
const AccountingModule = (function() {
    'use strict';

    const STORAGE_KEY = 'personal_accounting_data';

    // ── آیا Supabase در دسترس است؟ ──────────────────────────
    function _sb() {
        return typeof SupabaseDataModule !== 'undefined' &&
               typeof SupabaseConnection !== 'undefined' &&
               SupabaseConnection.isOnline === true
               ? SupabaseDataModule : null;
    }

    function _currentUserId() {
        try {
            const u = JSON.parse(localStorage.getItem('currentUser') ||
                                 localStorage.getItem('edu_system_current_user') || 'null');
            return u ? u.id : null;
        } catch { return null; }
    }

    const DEFAULT_CATEGORIES = {
        INCOME: ['درآمد شرکت', 'فروش خدمات', 'سود پروژه', 'سایر درآمدها'],
        EXPENSE: ['هزینه‌های عملیاتی', 'حقوق و دستمزد', 'اجاره و امکانات', 'تجهیزات و ابزار', 'سایر هزینه‌ها'],
        DEBT: ['بدهی به شرکا', 'وام و تسهیلات', 'بدهی به تامین‌کنندگان', 'سایر بدهی‌ها'],
        CREDIT: ['طلب از مشتریان', 'پیش پرداخت داده شده', 'سپرده‌های پرداختی', 'سایر بستانکاری‌ها']
    };

    const CURRENCIES = {
        TOMAN: { code: 'تومان', symbol: 'تومان', name: 'تومان' },
        RIAL: { code: 'ریال', symbol: 'ریال', name: 'ریال' },
        DOLLAR: { code: 'دلار', symbol: '$', name: 'دلار آمریکا' },
        DINAR: { code: 'دینار', symbol: 'د.ع', name: 'دینار عراق' }
    };

    const DEFAULT_EXCHANGE_RATES = {
        'تومان': 1,
        'ریال': 0.1,
        'دلار': 170000,
        'دینار': 130
    };

    const TRANSACTION_TYPES = {
        INCOME: 'income',
        EXPENSE: 'expense',
        DEBT: 'debt',
        CREDIT: 'credit'
    };

    let data = null;
    let exchangeRates = { ...DEFAULT_EXCHANGE_RATES };
    let initialized = false;

    function log(msg, type, extra) {
        if (typeof debugLogger === 'function') debugLogger(msg, type, extra);
    }

    function cloneCategories() {
        return {
            income: [...DEFAULT_CATEGORIES.INCOME],
            expense: [...DEFAULT_CATEGORIES.EXPENSE],
            debt: [...DEFAULT_CATEGORIES.DEBT],
            credit: [...DEFAULT_CATEGORIES.CREDIT]
        };
    }

    function normalizeData(raw) {
        const base = {
            transactions: [],
            persons: [],
            customCategories: cloneCategories(),
            settings: { currency: 'تومان', dateFormat: 'persian' }
        };

        if (!raw || typeof raw !== 'object') return base;

        return {
            transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
            persons: Array.isArray(raw.persons) ? raw.persons : [],
            customCategories: mergeCustomCategories(raw.customCategories),
            settings: { ...base.settings, ...(raw.settings || {}) }
        };
    }

    function mergeCustomCategories(custom) {
        const merged = cloneCategories();
        if (!custom || typeof custom !== 'object') return merged;

        ['income', 'expense', 'debt', 'credit'].forEach(type => {
            if (Array.isArray(custom[type])) {
                custom[type].forEach(cat => {
                    if (cat && !merged[type].includes(cat)) merged[type].push(cat);
                });
            }
        });
        return merged;
    }

    function getCategories(type) {
        const key = (type || 'income').toLowerCase();
        return data?.customCategories?.[key] ? [...data.customCategories[key]] : [];
    }

    function init() {
        loadData();
        initialized = true;
        // بارگذاری async از Supabase در پس‌زمینه
        _loadFromSupabase().catch(() => {});
    }

    function loadData() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            data = saved ? normalizeData(JSON.parse(saved)) : normalizeData(null);

            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.exchangeRates && typeof parsed.exchangeRates === 'object') {
                    exchangeRates = { ...DEFAULT_EXCHANGE_RATES, ...parsed.exchangeRates };
                }
            }

            if (!saved) saveData();
            log('Accounting data loaded', 'info');
        } catch (error) {
            log('Error loading accounting data', 'error', error);
            data = normalizeData(null);
            exchangeRates = { ...DEFAULT_EXCHANGE_RATES };
        }
    }

    function saveData() {
        const payload = { ...data, exchangeRates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        log('Accounting data saved', 'info');
    }

    // ── sync یک تراکنش به Supabase ──────────────────────────
    function _syncTransactionToSupabase(transaction, deleted = false) {
        const sb = _sb();
        if (!sb) return;

        if (deleted) {
            // حذف از Supabase
            const client = sb._db ? sb._db() : null;
            if (client) {
                client.from('accounting_transactions')
                    .delete().eq('id', transaction.id)
                    .then(({ error }) => {
                        if (error) console.warn('⚠️ accounting delete خطا:', error.message);
                        else console.log('✅ تراکنش از Supabase حذف شد:', transaction.id);
                    });
            }
            return;
        }

        // ذخیره/آپدیت در Supabase
        sb.saveAccountingTransaction({
            id:          transaction.id,
            type:        transaction.type,
            amount:      transaction.amount,
            description: `[${transaction.category || ''}] ${transaction.description || ''}`.trim(),
            createdBy:   transaction.personId || _currentUserId() || null
        })
        .then(ok => { if (ok) console.log('✅ تراکنش در Supabase ذخیره شد:', transaction.id); })
        .catch(e => console.warn('⚠️ accounting sync خطا:', e.message));
    }

    // ── بارگذاری اولیه از Supabase ──────────────────────────
    async function _loadFromSupabase() {
        const sb = _sb();
        if (!sb) return;
        try {
            const rows = await sb.getAccountingTransactions(null);
            if (!rows || rows.length === 0) return;

            // تبدیل فرمت Supabase → فرمت محلی
            const converted = rows.map(r => ({
                id:          r.id,
                type:        r.type || 'income',
                amount:      parseFloat(r.amount) || 0,
                currency:    'تومان',
                category:    _extractCategory(r.description),
                description: _extractDescription(r.description),
                personId:    r.created_by || null,
                date:        r.created_at || new Date().toISOString(),
                createdAt:   r.created_at || new Date().toISOString()
            }));

            // merge با داده‌های محلی (بر اساس id)
            const existing = data.transactions.map(t => t.id);
            converted.forEach(t => {
                if (!existing.includes(t.id)) data.transactions.push(t);
            });
            saveData();
            console.log(`✅ ${converted.length} تراکنش از Supabase بارگذاری شد`);
        } catch (e) {
            console.warn('⚠️ _loadFromSupabase خطا:', e.message);
        }
    }

    function _extractCategory(description) {
        if (!description) return '';
        const match = description.match(/^\[([^\]]*)\]/);
        return match ? match[1] : '';
    }

    function _extractDescription(description) {
        if (!description) return '';
        return description.replace(/^\[[^\]]*\]\s*/, '');
    }

    function generateId() {
        return 'acc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    }

    function convertAmount(amount, fromCurrency, toCurrency) {
        const fromRate = exchangeRates[fromCurrency] || 1;
        const toRate = exchangeRates[toCurrency] || 1;
        return (parseFloat(amount) * fromRate) / toRate;
    }

    function addTransaction(transactionData) {
        const amount = parseFloat(transactionData.amount);
        if (isNaN(amount) || amount <= 0) return null;

        const transaction = {
            id: generateId(),
            type: transactionData.type,
            amount,
            currency: transactionData.currency || 'تومان',
            category: transactionData.category,
            description: (transactionData.description || '').trim(),
            personId: transactionData.personId || null,
            date: transactionData.date || new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        data.transactions.push(transaction);
        saveData();
        log('Transaction added', 'success', transaction);

        // sync به Supabase در پس‌زمینه
        _syncTransactionToSupabase(transaction);

        return transaction;
    }

    function updateTransaction(id, updates) {
        const index = data.transactions.findIndex(t => t.id === id);
        if (index === -1) return null;

        const next = { ...data.transactions[index], ...updates, updatedAt: new Date().toISOString() };
        if (updates.amount !== undefined) next.amount = parseFloat(updates.amount);
        data.transactions[index] = next;
        saveData();

        // sync به Supabase در پس‌زمینه
        _syncTransactionToSupabase(next);

        return next;
    }

    function deleteTransaction(id) {
        const index = data.transactions.findIndex(t => t.id === id);
        if (index === -1) return null;
        const deleted = data.transactions.splice(index, 1)[0];
        saveData();

        // حذف از Supabase در پس‌زمینه
        _syncTransactionToSupabase(deleted, true);

        return deleted;
    }

    function getTransactions(filters = {}) {
        let transactions = [...data.transactions];

        if (filters.type) transactions = transactions.filter(t => t.type === filters.type);
        if (filters.category) transactions = transactions.filter(t => t.category === filters.category);
        if (filters.personId) transactions = transactions.filter(t => t.personId === filters.personId);

        if (filters.dateFrom) {
            const from = new Date(filters.dateFrom);
            transactions = transactions.filter(t => new Date(t.date) >= from);
        }
        if (filters.dateTo) {
            const to = new Date(filters.dateTo);
            to.setHours(23, 59, 59, 999);
            transactions = transactions.filter(t => new Date(t.date) <= to);
        }

        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        return transactions;
    }

    function calculateBalance(personId = 'all', targetCurrency = 'تومان') {
        let transactions = data.transactions;
        if (personId && personId !== 'all') {
            transactions = transactions.filter(t => t.personId === personId);
        }

        const sumByType = (type) => transactions
            .filter(t => t.type === type)
            .reduce((sum, t) => sum + convertAmount(t.amount, t.currency || 'تومان', targetCurrency), 0);

        const totalIncome = sumByType(TRANSACTION_TYPES.INCOME);
        const totalExpense = sumByType(TRANSACTION_TYPES.EXPENSE);
        const totalDebt = sumByType(TRANSACTION_TYPES.DEBT);
        const totalCredit = sumByType(TRANSACTION_TYPES.CREDIT);

        return {
            totalIncome,
            totalExpense,
            totalDebt,
            totalCredit,
            netBalance: totalIncome - totalExpense,
            netWorth: totalIncome - totalExpense + totalCredit - totalDebt,
            currency: targetCurrency
        };
    }

    function getStatsByCategory(type, targetCurrency = 'تومان') {
        const stats = {};
        data.transactions.filter(t => t.type === type).forEach(t => {
            if (!stats[t.category]) stats[t.category] = { amount: 0, count: 0 };
            stats[t.category].amount += convertAmount(t.amount, t.currency || 'تومان', targetCurrency);
            stats[t.category].count += 1;
        });
        return stats;
    }

    function getMonthlySummary(year, month, targetCurrency = 'تومان') {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const monthly = data.transactions.filter(t => {
            const d = new Date(t.date);
            return d >= startDate && d <= endDate;
        });

        const income = monthly
            .filter(t => t.type === TRANSACTION_TYPES.INCOME)
            .reduce((s, t) => s + convertAmount(t.amount, t.currency || 'تومان', targetCurrency), 0);

        const expense = monthly
            .filter(t => t.type === TRANSACTION_TYPES.EXPENSE)
            .reduce((s, t) => s + convertAmount(t.amount, t.currency || 'تومان', targetCurrency), 0);

        return { income, expense, balance: income - expense, transactions: monthly };
    }

    function addPerson(personData) {
        const name = (personData.name || '').trim();
        if (!name) return null;

        const person = {
            id: generateId(),
            name,
            type: personData.type || 'other',
            phone: (personData.phone || '').trim(),
            notes: (personData.notes || '').trim(),
            createdAt: new Date().toISOString()
        };
        data.persons.push(person);
        saveData();
        return person;
    }

    function getPersons() {
        return [...(data.persons || [])];
    }

    function getPerson(id) {
        return data.persons.find(p => p.id === id) || null;
    }

    function getPersonName(id) {
        const person = getPerson(id);
        return person ? person.name : 'نامشخص';
    }

    function updatePerson(id, updates) {
        const index = data.persons.findIndex(p => p.id === id);
        if (index === -1) return null;
        data.persons[index] = { ...data.persons[index], ...updates };
        saveData();
        return data.persons[index];
    }

    function deletePerson(id) {
        const index = data.persons.findIndex(p => p.id === id);
        if (index === -1) return null;
        const deleted = data.persons.splice(index, 1)[0];
        saveData();
        return deleted;
    }

    function formatCurrency(amount, currency) {
        const curr = currency || data.settings.currency || 'تومان';
        const formatted = new Intl.NumberFormat('fa-IR').format(Math.round(parseFloat(amount) || 0));
        return `${formatted} ${curr}`;
    }

    function getCurrencies() {
        return Object.values(CURRENCIES);
    }

    function addCustomCategory(type, categoryName) {
        const key = (type || '').toLowerCase();
        const name = (categoryName || '').trim();
        if (!name || !data.customCategories[key]) return false;
        if (!data.customCategories[key].includes(name)) {
            data.customCategories[key].push(name);
            saveData();
        }
        return true;
    }

    function updateExchangeRate(currency, rate) {
        exchangeRates[currency] = parseFloat(rate) || 1;
        saveData();
    }

    function getExchangeRates() {
        return { ...exchangeRates };
    }

    function exportData() {
        const payload = { ...data, exchangeRates };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `accounting-data-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function importData(jsonData) {
        try {
            const imported = JSON.parse(jsonData);
            if (!imported.transactions || !Array.isArray(imported.transactions)) return false;
            data = normalizeData(imported);
            if (imported.exchangeRates) {
                exchangeRates = { ...DEFAULT_EXCHANGE_RATES, ...imported.exchangeRates };
            }
            saveData();
            return true;
        } catch (error) {
            log('Error importing data', 'error', error);
            return false;
        }
    }

    return {
        STORAGE_KEY,
        TRANSACTION_TYPES,
        CATEGORIES: DEFAULT_CATEGORIES,
        init,
        loadData,
        saveData,
        getCategories,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        getTransactions,
        calculateBalance,
        getStatsByCategory,
        getMonthlySummary,
        addPerson,
        getPersons,
        getPerson,
        getPersonName,
        updatePerson,
        deletePerson,
        formatCurrency,
        convertCurrency: convertAmount,
        convertAmount,
        getCurrencies,
        addCustomCategory,
        updateExchangeRate,
        getExchangeRates,
        exportData,
        importData
    };
})();
