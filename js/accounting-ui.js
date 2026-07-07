// Personal Accounting UI - رابط کاربری حسابداری شخصی

const AccountingUI = {
    currentFilter: 'all',
    currentPerson: 'all',
    displayCurrency: 'تومان',

    init() {
        debugLogger('Initializing Accounting UI...', 'info');
        AccountingModule.init();
    },

    render() {
        const balance = AccountingModule.calculateBalance(this.currentPerson, this.displayCurrency);
        const transactions = this.getFilteredTransactions();
        const persons = AccountingModule.getPersons();
        const currencies = AccountingModule.getCurrencies();

        return `
        <div class="accounting-container">
            <!-- Currency Selector -->
            <div class="currency-selector-section">
                <div class="currency-selector-header">
                    <h3><i class="fas fa-money-bill-wave"></i> واحد پول نمایش</h3>
                    <select id="display-currency" onchange="AccountingUI.changeCurrency(this.value)" class="currency-select">
                        ${currencies.map(c => `
                            <option value="${c.code}" ${this.displayCurrency === c.code ? 'selected' : ''}>
                                ${c.name} (${c.symbol})
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <!-- Person Filter Section -->
            <div class="person-filter-section">
                <div class="person-filter-header">
                    <h3><i class="fas fa-users"></i> فیلتر بر اساس شخص</h3>
                    <button class="btn btn-sm btn-primary" onclick="AccountingUI.showAddPersonModal()">
                        <i class="fas fa-user-plus"></i> افزودن شخص
                    </button>
                </div>
                <div class="person-chips">
                    ${this.renderPersonChip('all', 'همه اشخاص')}
                    ${persons.map(p => this.renderPersonChip(p.id, p.name)).join('')}
                </div>
            </div>

            <div class="accounting-header">
                <div class="balance-cards">
                    ${this.renderBalanceCard('income', 'کل درآمد', balance.totalIncome, 'fa-arrow-up')}
                    ${this.renderBalanceCard('expense', 'کل هزینه', balance.totalExpense, 'fa-arrow-down')}
                    ${this.renderBalanceCard('debt', 'بدهی‌ها', balance.totalDebt, 'fa-hand-holding-usd')}
                    ${this.renderBalanceCard('credit', 'بستانکاری‌ها', balance.totalCredit, 'fa-coins')}
                    <div class="balance-card net">
                        <div class="card-icon"><i class="fas fa-wallet"></i></div>
                        <div class="card-content">
                            <h4>خالص دارایی</h4>
                            <p class="amount ${balance.netWorth >= 0 ? 'positive' : 'negative'}">
                                ${AccountingModule.formatCurrency(Math.abs(balance.netWorth))}
                                ${balance.netWorth < 0 ? '(منفی)' : ''}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="accounting-actions">
                <button class="btn btn-primary" onclick="AccountingUI.showAddTransactionModal()">
                    <i class="fas fa-plus"></i> افزودن تراکنش
                </button>
                <div class="filter-buttons">
                    ${this.renderFilterButton('all', 'همه')}
                    ${this.renderFilterButton('income', 'درآمد')}
                    ${this.renderFilterButton('expense', 'هزینه')}
                    ${this.renderFilterButton('debt', 'بدهی')}
                    ${this.renderFilterButton('credit', 'بستانکاری')}
                </div>
                <button class="btn btn-info" onclick="AccountingUI.showPersonsReport()">
                    <i class="fas fa-chart-bar"></i> گزارش اشخاص
                </button>
                <button class="btn btn-dark" onclick="AccountingModule.exportData()">
                    <i class="fas fa-download"></i> خروجی
                </button>
            </div>

            <div class="transactions-container">
                <h3><i class="fas fa-list"></i> لیست تراکنش‌ها</h3>
                ${this.renderTransactionsList(transactions)}
            </div>
        </div>`;
    },

    renderBalanceCard(type, title, amount, icon) {
        return `
        <div class="balance-card ${type}">
            <div class="card-icon"><i class="fas ${icon}"></i></div>
            <div class="card-content">
                <h4>${title}</h4>
                <p class="amount">${AccountingModule.formatCurrency(amount, this.displayCurrency)}</p>
            </div>
        </div>`;
    },

    renderFilterButton(type, label) {
        const active = this.currentFilter === type ? 'active' : '';
        return `<button class="filter-btn ${active}" onclick="AccountingUI.filterTransactions('${type}')">${label}</button>`;
    },
    
    renderPersonChip(personId, personName) {
        const active = this.currentPerson === personId ? 'active' : '';
        if (personId === 'all') {
            return `<button class="person-chip ${active}" onclick="AccountingUI.showAllPersonsList()">${personName}</button>`;
        }
        return `<button class="person-chip ${active}" onclick="AccountingUI.showPersonDetails('${personId}')">${personName}</button>`;
    },

    getFilteredTransactions() {
        let filters = {};
        
        if (this.currentFilter !== 'all') {
            filters.type = this.currentFilter;
        }
        
        if (this.currentPerson !== 'all') {
            filters.personId = this.currentPerson;
        }
        
        return AccountingModule.getTransactions(filters);
    },
    
    filterByPerson(personId) {
        this.currentPerson = personId;
        this.refresh();
    },
    
    changeCurrency(currency) {
        this.displayCurrency = currency;
        this.refresh();
    },

    filterTransactions(type) {
        this.currentFilter = type;
        const app = Alpine.$data(document.querySelector('[x-data]'));
        if (app) {
            const currentPage = app.currentPage;
            app.currentPage = '';
            setTimeout(() => {
                app.currentPage = currentPage;
            }, 10);
        }
    },

    refresh() {
        debugLogger('Refreshing accounting page...', 'info');
        const app = Alpine.$data(document.querySelector('[x-data]'));
        if (app) {
            const currentPage = app.currentPage;
            if (currentPage === 'accounting') {
                // Force re-render by toggling page
                app.currentPage = '';
                setTimeout(() => {
                    app.currentPage = 'accounting';
                    debugLogger('Accounting page refreshed', 'success');
                }, 10);
            } else {
                debugLogger('Not on accounting page, skipping refresh', 'info');
            }
        } else {
            debugLogger('Alpine app not found', 'error');
        }
    },

    renderTransactionsList(transactions) {
        if (transactions.length === 0) {
            return `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p> یک تراکنش جدید ثبت کنید هیچ تراکنشی ثبت نشده است</p>
            </div>`;
        }

        return `
        <div class="transactions-list">
            ${transactions.map(t => this.renderTransactionItem(t)).join('')}
        </div>`;
    },

    renderTransactionItem(t) {
        const personName = t.personId ? AccountingModule.getPersonName(t.personId) : '-';
        const displayAmount = AccountingModule.convertCurrency(t.amount, t.currency || 'تومان', this.displayCurrency);
        const description = t.description || 'بدون توضیحات';
        const shortDescription = description.length > 50 ? description.substring(0, 50) + '...' : description;
        
        return `
        <div class="transaction-item ${t.type}">
            <div class="transaction-main">
                <div>
                    <strong>${t.category}</strong>
                    ${t.personId ? `<span class="person-badge"><i class="fas fa-user"></i> ${personName}</span>` : ''}
                    <span class="currency-badge">${t.currency || 'تومان'}</span>
                </div>
                <div class="amount-display">
                    <span class="amount">${AccountingModule.formatCurrency(displayAmount, this.displayCurrency)}</span>
                    ${t.currency !== this.displayCurrency ? `<span class="original-amount">(${AccountingModule.formatCurrency(t.amount, t.currency)})</span>` : ''}
                </div>
            </div>
            <div class="transaction-meta">
                <span class="description-text" title="${description}">
                    <i class="fas fa-comment-alt"></i> ${shortDescription}
                </span>
                <span><i class="fas fa-calendar"></i> ${new Date(t.date).toLocaleDateString('fa-IR')}</span>
            </div>
            <div class="transaction-actions">
                <button onclick="AccountingModule.deleteTransaction('${t.id}'); AccountingUI.refresh()" title="حذف تراکنش">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`;
    },

    showAddTransactionModal() {
        const persons = AccountingModule.getPersons();
        const currencies = AccountingModule.getCurrencies();
        
        const modal = `
        <div class="modal-backdrop" onclick="AccountingUI.closeModal(event)">
            <div class="modal accounting-modal" onclick="event.stopPropagation()">
                <h3>افزودن تراکنش جدید</h3>
                <div class="form-group">
                    <label>نوع تراکنش</label>
                    <select id="acc-type" onchange="AccountingUI.updateCategoryOptions()">
                        <option value="income">درآمد</option>
                        <option value="expense">هزینه</option>
                        <option value="debt">بدهی</option>
                        <option value="credit">بستانکاری</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>شخص (اختیاری)</label>
                    <select id="acc-person">
                        <option value="">بدون شخص</option>
                        ${persons.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group flex-2">
                        <label>مبلغ</label>
                        <input id="acc-amount" type="number" placeholder="مبلغ را وارد کنید" min="0" step="1">
                    </div>
                    <div class="form-group flex-1">
                        <label>واحد پول</label>
                        <select id="acc-currency">
                            ${currencies.map(c => `
                                <option value="${c.code}" ${c.code === 'تومان' ? 'selected' : ''}>
                                    ${c.code}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>دسته‌بندی</label>
                    <select id="acc-category" onchange="AccountingUI.toggleCustomCategory()">
                        ${this.getCategoryOptions('income')}
                    </select>
                </div>
                <div class="form-group" id="custom-category-group" style="display: none;">
                    <label>دسته‌بندی سفارشی</label>
                    <input id="acc-custom-category" type="text" placeholder="نام دسته‌بندی جدید را وارد کنید">
                </div>
                <div class="form-group">
                    <label>توضیحات (اختیاری)</label>
                    <textarea id="acc-desc" placeholder="توضیحات تراکنش را وارد کنید" rows="3"></textarea>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-success" onclick="AccountingUI.submitTransaction()">
                        <i class="fas fa-check"></i> ثبت تراکنش
                    </button>
                    <button class="btn btn-secondary" onclick="AccountingUI.closeModal()">
                        <i class="fas fa-times"></i> انصراف
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modal);
    },
    
    getCategoryOptions(type) {
        const categories = AccountingModule.CATEGORIES[type.toUpperCase()] || [];
        return categories.map(cat => `<option value="${cat}">${cat}</option>`).join('') + 
               '<option value="__custom__">سایر (دسته‌بندی جدید)</option>';
    },
    
    toggleCustomCategory() {
        const categorySelect = document.getElementById('acc-category');
        const customGroup = document.getElementById('custom-category-group');
        const customInput = document.getElementById('acc-custom-category');
        
        if (categorySelect && customGroup) {
            if (categorySelect.value === '__custom__') {
                customGroup.style.display = 'block';
                if (customInput) {
                    customInput.focus();
                }
            } else {
                customGroup.style.display = 'none';
                if (customInput) {
                    customInput.value = '';
                }
            }
        }
    },
    
    updateCategoryOptions() {
        const typeSelect = document.getElementById('acc-type');
        const categorySelect = document.getElementById('acc-category');
        const customGroup = document.getElementById('custom-category-group');
        
        if (typeSelect && categorySelect) {
            const type = typeSelect.value;
            categorySelect.innerHTML = this.getCategoryOptions(type);
            
            // Hide custom category field when type changes
            if (customGroup) {
                customGroup.style.display = 'none';
                const customInput = document.getElementById('acc-custom-category');
                if (customInput) {
                    customInput.value = '';
                }
            }
        }
    },
    
    closeModal(event) {
        if (event) {
            event.stopPropagation();
        }
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    },

    submitTransaction() {
        const type = document.getElementById('acc-type').value;
        const amount = parseFloat(document.getElementById('acc-amount').value);
        const currency = document.getElementById('acc-currency').value;
        const categorySelect = document.getElementById('acc-category').value;
        const customCategory = document.getElementById('acc-custom-category').value.trim();
        const description = document.getElementById('acc-desc').value.trim();
        const personId = document.getElementById('acc-person').value;

        // Determine final category
        let category = categorySelect;
        if (categorySelect === '__custom__') {
            if (!customCategory) {
                UTILS.showNotification('لطفاً نام دسته‌بندی جدید را وارد کنید', 'error');
                return;
            }
            category = customCategory;
            
            // Add new category to the list for future use
            AccountingModule.addCustomCategory(type, customCategory);
        }

        if (!amount || !category) {
            UTILS.showNotification('مبلغ و دسته‌بندی الزامی است', 'error');
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            UTILS.showNotification('مبلغ باید یک عدد مثبت باشد', 'error');
            return;
        }

        try {
            const transaction = AccountingModule.addTransaction({ 
                type, 
                amount, 
                currency,
                category, 
                description,
                personId: personId || null
            });
            
            debugLogger('Transaction added successfully', 'success', transaction);
            UTILS.showNotification('تراکنش با موفقیت ثبت شد', 'success');
            this.closeModal();
            
            // Force reload data and refresh
            AccountingModule.loadData();
            this.refresh();
        } catch (error) {
            debugLogger('Error adding transaction', 'error', error);
            UTILS.showNotification('خطا در ثبت تراکنش', 'error');
        }
    },
    
    showAddPersonModal() {
        const modal = `
        <div class="modal-backdrop" onclick="AccountingUI.closeModal(event)">
            <div class="modal accounting-modal" onclick="event.stopPropagation()">
                <h3>افزودن شخص جدید</h3>
                <div class="form-group">
                    <label>نام شخص</label>
                    <input id="person-name" type="text" placeholder="نام کامل شخص را وارد کنید">
                </div>
                <div class="form-group">
                    <label>نوع شخص</label>
                    <select id="person-type">
                        <option value="student">دانشجو</option>
                        <option value="writer">نویسنده</option>
                        <option value="freelance">آزاد</option>
                        <option value="other">سایر</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>شماره تماس (اختیاری)</label>
                    <input id="person-phone" type="text" placeholder="شماره تماس">
                </div>
                <div class="form-group">
                    <label>توضیحات (اختیاری)</label>
                    <textarea id="person-notes" placeholder="توضیحات درباره شخص" rows="3"></textarea>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-success" onclick="AccountingUI.submitPerson()">
                        <i class="fas fa-check"></i> ثبت شخص
                    </button>
                    <button class="btn btn-secondary" onclick="AccountingUI.closeModal()">
                        <i class="fas fa-times"></i> انصراف
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modal);
    },
    
    submitPerson() {
        const name = document.getElementById('person-name')?.value.trim();
        const type = document.getElementById('person-type')?.value || 'other';
        const phone = document.getElementById('person-phone')?.value.trim();
        const notes = document.getElementById('person-notes')?.value.trim();

        if (!name) {
            if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
                UTILS.showNotification('نام شخص الزامی است', 'error');
            } else {
                alert('نام شخص الزامی است');
            }
            return;
        }

        try {
            debugLogger('Adding person...', 'info', { name, type, phone, notes });
            const newPerson = AccountingModule.addPerson({ name, type, phone, notes });
            debugLogger('Person added successfully', 'success', newPerson);
            debugLogger('Total persons now:', 'info', AccountingModule.getPersons().length);
            
            if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
                UTILS.showNotification('شخص با موفقیت اضافه شد', 'success');
            }
            
            this.closeModal();
            
            // Force reload data from localStorage before refresh
            AccountingModule.loadData();
            debugLogger('Data reloaded, persons count:', 'info', AccountingModule.getPersons().length);
            
            // Refresh the page
            this.refresh();
        } catch (error) {
            debugLogger('Error adding person', 'error', error);
            if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
                UTILS.showNotification('خطا در افزودن شخص: ' + error.message, 'error');
            } else {
                alert('خطا در افزودن شخص: ' + error.message);
            }
        }
    },
    
    showPersonsReport() {
        const persons = AccountingModule.getPersons();
        const personsWithBalance = persons.map(person => {
            const balance = AccountingModule.calculateBalance(person.id, this.displayCurrency);
            return { ...person, balance };
        });

        const modal = `
        <div class="modal-backdrop" onclick="AccountingUI.closeModal(event)">
            <div class="modal accounting-modal large-modal" onclick="event.stopPropagation()">
                <h3><i class="fas fa-chart-bar"></i> گزارش مالی اشخاص (${this.displayCurrency})</h3>
                <div class="persons-report">
                    ${personsWithBalance.length === 0 ? 
                        '<p class="text-center text-gray-500">هیچ شخصی ثبت نشده است</p>' :
                        personsWithBalance.map(p => `
                            <div class="person-report-card">
                                <div class="person-info">
                                    <h4><i class="fas fa-user"></i> ${p.name}</h4>
                                    ${p.phone ? `<p class="text-sm text-gray-600"><i class="fas fa-phone"></i> ${p.phone}</p>` : ''}
                                </div>
                                <div class="person-balance">
                                    <div class="balance-item">
                                        <span>درآمد:</span>
                                        <strong class="text-green-600">${AccountingModule.formatCurrency(p.balance.totalIncome, this.displayCurrency)}</strong>
                                    </div>
                                    <div class="balance-item">
                                        <span>هزینه:</span>
                                        <strong class="text-red-600">${AccountingModule.formatCurrency(p.balance.totalExpense, this.displayCurrency)}</strong>
                                    </div>
                                    <div class="balance-item">
                                        <span>بدهی:</span>
                                        <strong class="text-orange-600">${AccountingModule.formatCurrency(p.balance.totalDebt, this.displayCurrency)}</strong>
                                    </div>
                                    <div class="balance-item">
                                        <span>بستانکاری:</span>
                                        <strong class="text-blue-600">${AccountingModule.formatCurrency(p.balance.totalCredit, this.displayCurrency)}</strong>
                                    </div>
                                    <div class="balance-item net-balance">
                                        <span>خالص:</span>
                                        <strong class="${p.balance.netWorth >= 0 ? 'text-green-600' : 'text-red-600'}">
                                            ${AccountingModule.formatCurrency(Math.abs(p.balance.netWorth), this.displayCurrency)}
                                            ${p.balance.netWorth < 0 ? '(منفی)' : ''}
                                        </strong>
                                    </div>
                                </div>
                                <div class="person-actions">
                                    <button class="btn btn-sm btn-primary" onclick="AccountingUI.filterByPerson('${p.id}'); AccountingUI.closeModal()">
                                        <i class="fas fa-filter"></i> مشاهده تراکنش‌ها
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="AccountingUI.deletePerson('${p.id}')">
                                        <i class="fas fa-trash"></i> حذف
                                    </button>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="AccountingUI.closeModal()">
                        <i class="fas fa-times"></i> بستن
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modal);
    },
    
    deletePerson(personId) {
        if (confirm('آیا از حذف این شخص مطمئن هستید؟ تراکنش‌های مرتبط حذف نمی‌شوند.')) {
            try {
                AccountingModule.deletePerson(personId);
                if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
                    UTILS.showNotification('شخص با موفقیت حذف شد', 'success');
                }
                this.closeModal();
                this.refresh();
            } catch (error) {
                debugLogger('Error deleting person', 'error', error);
                if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
                    UTILS.showNotification('خطا در حذف شخص', 'error');
                }
            }
        }
    },
    
    showAllPersonsList() {
        const persons = AccountingModule.getPersons();
        
        // Group by type
        const personsByType = {
            student: persons.filter(p => p.type === 'student'),
            writer: persons.filter(p => p.type === 'writer'),
            freelance: persons.filter(p => p.type === 'freelance'),
            other: persons.filter(p => p.type === 'other' || !p.type)
        };
        
        const typeLabels = {
            student: 'دانشجو',
            writer: 'نویسنده',
            freelance: 'آزاد',
            other: 'سایر'
        };
        
        const typeIcons = {
            student: 'fa-user-graduate',
            writer: 'fa-pen-fancy',
            freelance: 'fa-user-tie',
            other: 'fa-user'
        };
        
        const modal = `
        <div class="modal-backdrop" onclick="AccountingUI.closeModal(event)">
            <div class="modal accounting-modal large-modal" onclick="event.stopPropagation()">
                <h3><i class="fas fa-users"></i> لیست همه اشخاص</h3>
                <div class="persons-list-by-type">
                    ${Object.keys(personsByType).map(type => {
                        const typePersons = personsByType[type];
                        if (typePersons.length === 0) return '';
                        
                        return `
                            <div class="person-type-section">
                                <h4 class="person-type-header">
                                    <i class="fas ${typeIcons[type]}"></i>
                                    ${typeLabels[type]} (${typePersons.length})
                                </h4>
                                <div class="person-type-list">
                                    ${typePersons.map(p => {
                                        const balance = AccountingModule.calculateBalance(p.id, this.displayCurrency);
                                        return `
                                            <div class="person-list-item" onclick="AccountingUI.showPersonDetails('${p.id}')">
                                                <div class="person-list-info">
                                                    <h5><i class="fas fa-user"></i> ${p.name}</h5>
                                                    ${p.phone ? `<p class="text-sm"><i class="fas fa-phone"></i> ${p.phone}</p>` : ''}
                                                </div>
                                                <div class="person-list-balance">
                                                    <span class="balance-badge income">درآمد: ${AccountingModule.formatCurrency(balance.totalIncome, this.displayCurrency)}</span>
                                                    <span class="balance-badge expense">هزینه: ${AccountingModule.formatCurrency(balance.totalExpense, this.displayCurrency)}</span>
                                                    <span class="balance-badge debt">بدهی: ${AccountingModule.formatCurrency(balance.totalDebt, this.displayCurrency)}</span>
                                                    <span class="balance-badge credit">طلب: ${AccountingModule.formatCurrency(balance.totalCredit, this.displayCurrency)}</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                    
                    ${persons.length === 0 ? '<p class="text-center text-gray-500 py-8">هیچ شخصی ثبت نشده است</p>' : ''}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="AccountingUI.closeModal()">
                        <i class="fas fa-times"></i> بستن
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modal);
    },
    
    showPersonDetails(personId) {
        this.closeModal();
        
        const person = AccountingModule.getPerson(personId);
        if (!person) {
            if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
                UTILS.showNotification('شخص یافت نشد', 'error');
            }
            return;
        }
        
        const balance = AccountingModule.calculateBalance(personId, this.displayCurrency);
        const transactions = AccountingModule.getTransactions({ personId });
        
        const typeLabels = {
            student: 'دانشجو',
            writer: 'نویسنده',
            freelance: 'آزاد',
            other: 'سایر'
        };
        
        const modal = `
        <div class="modal-backdrop" onclick="AccountingUI.closeModal(event)">
            <div class="modal accounting-modal large-modal" onclick="event.stopPropagation()">
                <div class="person-details-header">
                    <div>
                        <h3><i class="fas fa-user"></i> ${person.name}</h3>
                        <p class="text-sm text-gray-600">
                            <span class="badge">${typeLabels[person.type] || 'سایر'}</span>
                            ${person.phone ? `<i class="fas fa-phone ml-2"></i> ${person.phone}` : ''}
                        </p>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="AccountingUI.filterByPerson('${personId}'); AccountingUI.closeModal()">
                        <i class="fas fa-filter"></i> فیلتر در صفحه اصلی
                    </button>
                </div>
                
                <div class="person-balance-summary">
                    <div class="balance-summary-item income">
                        <i class="fas fa-arrow-up"></i>
                        <div>
                            <span>کل درآمد</span>
                            <strong>${AccountingModule.formatCurrency(balance.totalIncome, this.displayCurrency)}</strong>
                        </div>
                    </div>
                    <div class="balance-summary-item expense">
                        <i class="fas fa-arrow-down"></i>
                        <div>
                            <span>کل هزینه</span>
                            <strong>${AccountingModule.formatCurrency(balance.totalExpense, this.displayCurrency)}</strong>
                        </div>
                    </div>
                    <div class="balance-summary-item debt">
                        <i class="fas fa-hand-holding-usd"></i>
                        <div>
                            <span>بدهی</span>
                            <strong>${AccountingModule.formatCurrency(balance.totalDebt, this.displayCurrency)}</strong>
                        </div>
                    </div>
                    <div class="balance-summary-item credit">
                        <i class="fas fa-coins"></i>
                        <div>
                            <span>طلب</span>
                            <strong>${AccountingModule.formatCurrency(balance.totalCredit, this.displayCurrency)}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="person-transactions">
                    <h4><i class="fas fa-list"></i> تراکنش‌ها (${transactions.length})</h4>
                    ${transactions.length === 0 ? 
                        '<p class="text-center text-gray-500 py-4">هیچ تراکنشی ثبت نشده است</p>' :
                        `<div class="transactions-table">
                            ${transactions.map(t => `
                                <div class="transaction-row ${t.type}">
                                    <div class="transaction-info">
                                        <span class="transaction-type-badge ${t.type}">
                                            ${t.type === 'income' ? 'درآمد' : t.type === 'expense' ? 'هزینه' : t.type === 'debt' ? 'بدهی' : 'طلب'}
                                        </span>
                                        <span class="transaction-desc">${t.description}</span>
                                        <span class="transaction-date">${new Date(t.date).toLocaleDateString('fa-IR')}</span>
                                    </div>
                                    <div class="transaction-amount ${t.type}">
                                        ${AccountingModule.formatCurrency(t.amount, t.currency)}
                                        ${t.currency !== this.displayCurrency ? 
                                            `<span class="text-sm">(${AccountingModule.formatCurrency(t.convertedAmount || t.amount, this.displayCurrency)})</span>` : 
                                            ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>`
                    }
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="AccountingUI.closeModal()">
                        <i class="fas fa-times"></i> بستن
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modal);
    },

    closeModal(event) {

        if (event) {
            event.stopPropagation();
        }
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    }
};
