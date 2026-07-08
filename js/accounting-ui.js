/**
 * رابط کاربری حسابداری شخصی (مدیر)
 */
const AccountingUI = (function() {
    'use strict';

    let currentFilter = 'all';
    let currentPerson = 'all';
    let displayCurrency = 'تومان';

    const TYPE_LABELS = {
        income: 'درآمد',
        expense: 'هزینه',
        debt: 'بدهی',
        credit: 'بستانکاری'
    };

    const PERSON_TYPE_LABELS = {
        student: 'دانشجو',
        writer: 'نویسنده',
        freelance: 'آزاد',
        other: 'سایر'
    };

    function notify(msg, type) {
        if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
            UTILS.showNotification(msg, type);
        } else {
            alert(msg);
        }
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function init() {
        AccountingModule.init();
    }

    function refresh() {
        const appEl = document.querySelector('[x-data]');
        if (appEl && typeof Alpine !== 'undefined' && Alpine.$data) {
            const app = Alpine.$data(appEl);
            if (app && app.currentPage === 'accounting') {
                const page = app.currentPage;
                app.currentPage = '';
                setTimeout(() => { app.currentPage = page; }, 10);
                return;
            }
        }
        const container = document.getElementById('accounting-app');
        if (container) {
            container.innerHTML = render();
        }
    }

    function closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    }

    function render() {
        const balance = AccountingModule.calculateBalance(currentPerson, displayCurrency);
        const transactions = getFilteredTransactions();
        const persons = AccountingModule.getPersons();
        const currencies = AccountingModule.getCurrencies();
        const activePerson = currentPerson !== 'all' ? AccountingModule.getPerson(currentPerson) : null;

        return `
        <div class="accounting-container">
            <div class="currency-selector-section">
                <div class="currency-selector-header">
                    <h3><i class="fas fa-money-bill-wave"></i> واحد پول نمایش</h3>
                    <select id="display-currency" onchange="AccountingUI.changeCurrency(this.value)" class="currency-select">
                        ${currencies.map(c => `
                            <option value="${c.code}" ${displayCurrency === c.code ? 'selected' : ''}>
                                ${escapeHtml(c.name)} (${escapeHtml(c.symbol)})
                            </option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="person-filter-section">
                <div class="person-filter-header">
                    <h3><i class="fas fa-users"></i> فیلتر بر اساس شخص</h3>
                    <div class="person-filter-actions">
                        <button class="btn btn-sm btn-info" onclick="AccountingUI.showAllPersonsList()">
                            <i class="fas fa-list"></i> لیست اشخاص
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="AccountingUI.showAddPersonModal()">
                            <i class="fas fa-user-plus"></i> افزودن شخص
                        </button>
                    </div>
                </div>
                <div class="person-chips">
                    ${renderPersonChip('all', 'همه اشخاص')}
                    ${persons.map(p => renderPersonChip(p.id, p.name)).join('')}
                </div>
                ${activePerson ? `
                    <div class="active-person-banner">
                        <span><i class="fas fa-filter"></i> فیلتر فعال: <strong>${escapeHtml(activePerson.name)}</strong></span>
                        <button class="btn btn-sm btn-secondary" onclick="AccountingUI.filterByPerson('all')">حذف فیلتر</button>
                    </div>` : ''}
            </div>

            <div class="accounting-header">
                <div class="balance-cards">
                    ${renderBalanceCard('income', 'کل درآمد', balance.totalIncome, 'fa-arrow-up')}
                    ${renderBalanceCard('expense', 'کل هزینه', balance.totalExpense, 'fa-arrow-down')}
                    ${renderBalanceCard('debt', 'بدهی‌ها', balance.totalDebt, 'fa-hand-holding-usd')}
                    ${renderBalanceCard('credit', 'بستانکاری‌ها', balance.totalCredit, 'fa-coins')}
                    <div class="balance-card net-balance-card">
                        <div class="card-icon"><i class="fas fa-chart-line"></i></div>
                        <div class="card-content">
                            <h4>تراز جریان نقد</h4>
                            <p class="amount ${balance.netBalance >= 0 ? 'positive' : 'negative'}">
                                ${AccountingModule.formatCurrency(Math.abs(balance.netBalance), displayCurrency)}
                                ${balance.netBalance < 0 ? '(منفی)' : ''}
                            </p>
                        </div>
                    </div>
                    <div class="balance-card net">
                        <div class="card-icon"><i class="fas fa-wallet"></i></div>
                        <div class="card-content">
                            <h4>خالص دارایی</h4>
                            <p class="amount ${balance.netWorth >= 0 ? 'positive' : 'negative'}">
                                ${AccountingModule.formatCurrency(Math.abs(balance.netWorth), displayCurrency)}
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
                    ${renderFilterButton('all', 'همه')}
                    ${renderFilterButton('income', 'درآمد')}
                    ${renderFilterButton('expense', 'هزینه')}
                    ${renderFilterButton('debt', 'بدهی')}
                    ${renderFilterButton('credit', 'بستانکاری')}
                </div>
                <button class="btn btn-info" onclick="AccountingUI.showPersonsReport()">
                    <i class="fas fa-chart-bar"></i> گزارش اشخاص
                </button>
                <button class="btn btn-dark" onclick="AccountingModule.exportData()">
                    <i class="fas fa-download"></i> خروجی
                </button>
            </div>

            <div class="transactions-container">
                <h3><i class="fas fa-list"></i> لیست تراکنش‌ها (${transactions.length})</h3>
                ${renderTransactionsList(transactions)}
            </div>
        </div>`;
    }

    function renderBalanceCard(type, title, amount, icon) {
        return `
        <div class="balance-card ${type}">
            <div class="card-icon"><i class="fas ${icon}"></i></div>
            <div class="card-content">
                <h4>${title}</h4>
                <p class="amount">${AccountingModule.formatCurrency(amount, displayCurrency)}</p>
            </div>
        </div>`;
    }

    function renderFilterButton(type, label) {
        const active = currentFilter === type ? 'active' : '';
        return `<button type="button" class="filter-btn ${active}" onclick="AccountingUI.filterTransactions('${type}')">${label}</button>`;
    }

    function renderPersonChip(personId, personName) {
        const active = currentPerson === personId ? 'active' : '';
        const safeId = escapeHtml(personId);
        const safeName = escapeHtml(personName);
        const detailsBtn = personId !== 'all'
            ? `<button type="button" class="person-chip-detail" title="جزئیات" onclick="event.stopPropagation(); AccountingUI.showPersonDetails('${safeId}')"><i class="fas fa-eye"></i></button>`
            : '';
        return `
            <div class="person-chip-wrap ${active}">
                <button type="button" class="person-chip ${active}" onclick="AccountingUI.filterByPerson('${safeId}')">${safeName}</button>
                ${detailsBtn}
            </div>`;
    }

    function getFilteredTransactions() {
        const filters = {};
        if (currentFilter !== 'all') filters.type = currentFilter;
        if (currentPerson !== 'all') filters.personId = currentPerson;
        return AccountingModule.getTransactions(filters);
    }

    function filterByPerson(personId) {
        currentPerson = personId || 'all';
        refresh();
    }

    function changeCurrency(currency) {
        displayCurrency = currency || 'تومان';
        refresh();
    }

    function filterTransactions(type) {
        currentFilter = type || 'all';
        refresh();
    }

    function renderTransactionsList(transactions) {
        if (!transactions.length) {
            return `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>هیچ تراکنشی ثبت نشده است</p>
                <button class="btn btn-primary btn-sm" onclick="AccountingUI.showAddTransactionModal()">ثبت اولین تراکنش</button>
            </div>`;
        }

        return `<div class="transactions-list">${transactions.map(t => renderTransactionItem(t)).join('')}</div>`;
    }

    function renderTransactionItem(t) {
        const personName = t.personId ? AccountingModule.getPersonName(t.personId) : '';
        const displayAmount = AccountingModule.convertAmount(t.amount, t.currency || 'تومان', displayCurrency);
        const description = t.description || 'بدون توضیحات';
        const shortDesc = description.length > 60 ? description.slice(0, 60) + '…' : description;
        const txCurrency = t.currency || 'تومان';

        return `
        <div class="transaction-item ${t.type}">
            <div class="transaction-main">
                <div>
                    <strong>${escapeHtml(t.category)}</strong>
                    <span class="transaction-type-label">${TYPE_LABELS[t.type] || t.type}</span>
                    ${personName ? `<span class="person-badge"><i class="fas fa-user"></i> ${escapeHtml(personName)}</span>` : ''}
                    <span class="currency-badge">${escapeHtml(txCurrency)}</span>
                </div>
                <div class="amount-display">
                    <span class="amount">${AccountingModule.formatCurrency(displayAmount, displayCurrency)}</span>
                    ${txCurrency !== displayCurrency ? `<span class="original-amount">(${AccountingModule.formatCurrency(t.amount, txCurrency)})</span>` : ''}
                </div>
            </div>
            <div class="transaction-meta">
                <span class="description-text" title="${escapeHtml(description)}">
                    <i class="fas fa-comment-alt"></i> ${escapeHtml(shortDesc)}
                </span>
                <span><i class="fas fa-calendar"></i> ${new Date(t.date).toLocaleDateString('fa-IR')}</span>
            </div>
            <div class="transaction-actions">
                <button type="button" onclick="AccountingUI.showEditTransactionModal('${t.id}')" title="ویرایش">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" onclick="AccountingUI.confirmDeleteTransaction('${t.id}')" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`;
    }

    function getCategoryOptions(type) {
        const categories = AccountingModule.getCategories(type);
        return categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('') +
            '<option value="__custom__">سایر (دسته‌بندی جدید)</option>';
    }

    function toggleCustomCategory() {
        const select = document.getElementById('acc-category');
        const group = document.getElementById('custom-category-group');
        const input = document.getElementById('acc-custom-category');
        if (!select || !group) return;
        const show = select.value === '__custom__';
        group.style.display = show ? 'block' : 'none';
        if (show && input) input.focus();
        else if (input) input.value = '';
    }

    function updateCategoryOptions() {
        const typeSelect = document.getElementById('acc-type');
        const categorySelect = document.getElementById('acc-category');
        if (!typeSelect || !categorySelect) return;
        categorySelect.innerHTML = getCategoryOptions(typeSelect.value);
        toggleCustomCategory();
    }

    function showAddTransactionModal() {
        showTransactionModal(null);
    }

    function showEditTransactionModal(id) {
        const tx = AccountingModule.getTransactions().find(t => t.id === id);
        if (!tx) {
            notify('تراکنش یافت نشد', 'error');
            return;
        }
        showTransactionModal(tx);
    }

    function showTransactionModal(existing) {
        closeModal();
        const persons = AccountingModule.getPersons();
        const currencies = AccountingModule.getCurrencies();
        const isEdit = !!existing;
        const type = existing?.type || 'income';

        const modal = `
        <div class="modal-backdrop" onclick="AccountingUI.closeModal(event)">
            <div class="modal accounting-modal" onclick="event.stopPropagation()">
                <h3>${isEdit ? 'ویرایش تراکنش' : 'افزودن تراکنش جدید'}</h3>
                <input type="hidden" id="acc-edit-id" value="${existing?.id || ''}">
                <div class="form-group">
                    <label>نوع تراکنش</label>
                    <select id="acc-type" onchange="AccountingUI.updateCategoryOptions()">
                        ${Object.entries(TYPE_LABELS).map(([val, label]) =>
                            `<option value="${val}" ${type === val ? 'selected' : ''}>${label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>شخص (اختیاری)</label>
                    <select id="acc-person">
                        <option value="">بدون شخص</option>
                        ${persons.map(p => `<option value="${p.id}" ${existing?.personId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group flex-2">
                        <label>مبلغ</label>
                        <input id="acc-amount" type="number" min="0" step="1" value="${existing?.amount || ''}" placeholder="مبلغ">
                    </div>
                    <div class="form-group flex-1">
                        <label>واحد پول</label>
                        <select id="acc-currency">
                            ${currencies.map(c => `
                                <option value="${c.code}" ${(existing?.currency || 'تومان') === c.code ? 'selected' : ''}>${escapeHtml(c.code)}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>دسته‌بندی</label>
                    <select id="acc-category" onchange="AccountingUI.toggleCustomCategory()">
                        ${getCategoryOptions(type)}
                    </select>
                </div>
                <div class="form-group" id="custom-category-group" style="display:none;">
                    <label>دسته‌بندی سفارشی</label>
                    <input id="acc-custom-category" type="text" placeholder="نام دسته‌بندی جدید">
                </div>
                <div class="form-group">
                    <label>توضیحات (اختیاری)</label>
                    <textarea id="acc-desc" rows="3" placeholder="توضیحات">${escapeHtml(existing?.description || '')}</textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-success" onclick="AccountingUI.submitTransaction()">
                        <i class="fas fa-check"></i> ${isEdit ? 'ذخیره تغییرات' : 'ثبت تراکنش'}
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="AccountingUI.closeModal()">انصراف</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modal);

        const catSelect = document.getElementById('acc-category');
        if (existing?.category && catSelect) {
            const exists = Array.from(catSelect.options).some(o => o.value === existing.category);
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = existing.category;
                opt.textContent = existing.category;
                catSelect.insertBefore(opt, catSelect.lastElementChild);
            }
            catSelect.value = existing.category;
        }
    }

    function submitTransaction() {
        const editId = document.getElementById('acc-edit-id')?.value;
        const type = document.getElementById('acc-type').value;
        const amount = parseFloat(document.getElementById('acc-amount').value);
        const currency = document.getElementById('acc-currency').value;
        const categorySelect = document.getElementById('acc-category').value;
        const customCategory = document.getElementById('acc-custom-category')?.value.trim() || '';
        const description = document.getElementById('acc-desc').value.trim();
        const personId = document.getElementById('acc-person').value || null;

        let category = categorySelect;
        if (categorySelect === '__custom__') {
            if (!customCategory) {
                notify('نام دسته‌بندی جدید را وارد کنید', 'error');
                return;
            }
            category = customCategory;
            AccountingModule.addCustomCategory(type, customCategory);
        }

        if (!category || isNaN(amount) || amount <= 0) {
            notify('مبلغ و دسته‌بندی الزامی است', 'error');
            return;
        }

        const payload = { type, amount, currency, category, description, personId };

        if (editId) {
            AccountingModule.updateTransaction(editId, payload);
            notify('تراکنش ویرایش شد', 'success');
        } else {
            AccountingModule.addTransaction(payload);
            notify('تراکنش ثبت شد', 'success');
        }

        closeModal();
        refresh();
    }

    function confirmDeleteTransaction(id) {
        if (confirm('آیا از حذف این تراکنش مطمئن هستید؟')) {
            AccountingModule.deleteTransaction(id);
            notify('تراکنش حذف شد', 'success');
            refresh();
        }
    }

    function showAddPersonModal() {
        closeModal();
        const modal = `
        <div class="modal-backdrop" onclick="AccountingUI.closeModal(event)">
            <div class="modal accounting-modal" onclick="event.stopPropagation()">
                <h3>افزودن شخص جدید</h3>
                <div class="form-group">
                    <label>نام شخص</label>
                    <input id="person-name" type="text" placeholder="نام کامل">
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
                    <textarea id="person-notes" rows="3" placeholder="توضیحات"></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-success" onclick="AccountingUI.submitPerson()">ثبت شخص</button>
                    <button type="button" class="btn btn-secondary" onclick="AccountingUI.closeModal()">انصراف</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modal);
    }

    function submitPerson() {
        const name = document.getElementById('person-name')?.value.trim();
        if (!name) {
            notify('نام شخص الزامی است', 'error');
            return;
        }

        AccountingModule.addPerson({
            name,
            type: document.getElementById('person-type')?.value || 'other',
            phone: document.getElementById('person-phone')?.value.trim() || '',
            notes: document.getElementById('person-notes')?.value.trim() || ''
        });

        notify('شخص اضافه شد', 'success');
        closeModal();
        refresh();
    }

    function showPersonsReport() {
        closeModal();
        const persons = AccountingModule.getPersons();
        const rows = persons.map(p => {
            const b = AccountingModule.calculateBalance(p.id, displayCurrency);
            return `
            <div class="person-report-card">
                <div class="person-info">
                    <h4><i class="fas fa-user"></i> ${escapeHtml(p.name)}</h4>
                    ${p.phone ? `<p class="text-sm"><i class="fas fa-phone"></i> ${escapeHtml(p.phone)}</p>` : ''}
                </div>
                <div class="person-balance">
                    <div class="balance-item"><span>درآمد:</span><strong class="text-green">${AccountingModule.formatCurrency(b.totalIncome, displayCurrency)}</strong></div>
                    <div class="balance-item"><span>هزینه:</span><strong class="text-red">${AccountingModule.formatCurrency(b.totalExpense, displayCurrency)}</strong></div>
                    <div class="balance-item"><span>بدهی:</span><strong class="text-orange">${AccountingModule.formatCurrency(b.totalDebt, displayCurrency)}</strong></div>
                    <div class="balance-item"><span>بستانکاری:</span><strong class="text-blue">${AccountingModule.formatCurrency(b.totalCredit, displayCurrency)}</strong></div>
                    <div class="balance-item net-balance"><span>خالص:</span><strong>${AccountingModule.formatCurrency(Math.abs(b.netWorth), displayCurrency)}${b.netWorth < 0 ? ' (منفی)' : ''}</strong></div>
                </div>
                <div class="person-actions">
                    <button type="button" class="btn btn-sm btn-primary" onclick="AccountingUI.filterByPerson('${p.id}'); AccountingUI.closeModal();">
                        <i class="fas fa-filter"></i> فیلتر
                    </button>
                    <button type="button" class="btn btn-sm btn-info" onclick="AccountingUI.showPersonDetails('${p.id}')">
                        <i class="fas fa-eye"></i> جزئیات
                    </button>
                    <button type="button" class="btn btn-sm btn-danger" onclick="AccountingUI.deletePerson('${p.id}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            </div>`;
        }).join('');

        const modal = `
        <div class="modal-backdrop" onclick="AccountingUI.closeModal(event)">
            <div class="modal accounting-modal large-modal" onclick="event.stopPropagation()">
                <h3><i class="fas fa-chart-bar"></i> گزارش مالی اشخاص (${escapeHtml(displayCurrency)})</h3>
                <div class="persons-report">
                    ${persons.length ? rows : '<p class="text-center empty-text">هیچ شخصی ثبت نشده است</p>'}
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="AccountingUI.closeModal()">بستن</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modal);
    }

    function deletePerson(personId) {
        if (!confirm('آیا از حذف این شخص مطمئن هستید؟ تراکنش‌های مرتبط حذف نمی‌شوند.')) return;
        AccountingModule.deletePerson(personId);
        if (currentPerson === personId) currentPerson = 'all';
        notify('شخص حذف شد', 'success');
        closeModal();
        refresh();
    }

    function showAllPersonsList() {
        closeModal();
        const persons = AccountingModule.getPersons();
        const grouped = { student: [], writer: [], freelance: [], other: [] };
        persons.forEach(p => {
            const key = grouped[p.type] ? p.type : 'other';
            grouped[key].push(p);
        });

        const sections = Object.keys(grouped).map(type => {
            const list = grouped[type];
            if (!list.length) return '';
            return `
            <div class="person-type-section">
                <h4 class="person-type-header">${PERSON_TYPE_LABELS[type]} (${list.length})</h4>
                <div class="person-type-list">
                    ${list.map(p => {
                        const b = AccountingModule.calculateBalance(p.id, displayCurrency);
                        return `
                        <div class="person-list-item">
                            <div class="person-list-info">
                                <h5><i class="fas fa-user"></i> ${escapeHtml(p.name)}</h5>
                                ${p.phone ? `<p class="text-sm"><i class="fas fa-phone"></i> ${escapeHtml(p.phone)}</p>` : ''}
                            </div>
                            <div class="person-list-balance">
                                <span class="balance-badge income">درآمد: ${AccountingModule.formatCurrency(b.totalIncome, displayCurrency)}</span>
                                <span class="balance-badge expense">هزینه: ${AccountingModule.formatCurrency(b.totalExpense, displayCurrency)}</span>
                            </div>
                            <div class="person-list-actions">
                                <button type="button" class="btn btn-sm btn-primary" onclick="AccountingUI.filterByPerson('${p.id}'); AccountingUI.closeModal();">فیلتر</button>
                                <button type="button" class="btn btn-sm btn-info" onclick="AccountingUI.showPersonDetails('${p.id}')">جزئیات</button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }).join('');

        const modal = `
        <div class="modal-backdrop" onclick="AccountingUI.closeModal(event)">
            <div class="modal accounting-modal large-modal" onclick="event.stopPropagation()">
                <h3><i class="fas fa-users"></i> لیست اشخاص</h3>
                <div class="persons-list-by-type">
                    ${persons.length ? sections : '<p class="text-center empty-text">هیچ شخصی ثبت نشده است</p>'}
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="AccountingUI.closeModal()">بستن</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modal);
    }

    function showPersonDetails(personId) {
        closeModal();
        const person = AccountingModule.getPerson(personId);
        if (!person) {
            notify('شخص یافت نشد', 'error');
            return;
        }

        const balance = AccountingModule.calculateBalance(personId, displayCurrency);
        const transactions = AccountingModule.getTransactions({ personId });

        const modal = `
        <div class="modal-backdrop" onclick="AccountingUI.closeModal(event)">
            <div class="modal accounting-modal large-modal" onclick="event.stopPropagation()">
                <div class="person-details-header">
                    <div>
                        <h3><i class="fas fa-user"></i> ${escapeHtml(person.name)}</h3>
                        <p class="text-sm">
                            <span class="badge">${PERSON_TYPE_LABELS[person.type] || 'سایر'}</span>
                            ${person.phone ? `<i class="fas fa-phone ml-2"></i> ${escapeHtml(person.phone)}` : ''}
                        </p>
                    </div>
                    <button type="button" class="btn btn-sm btn-primary" onclick="AccountingUI.filterByPerson('${personId}'); AccountingUI.closeModal();">
                        <i class="fas fa-filter"></i> فیلتر در صفحه اصلی
                    </button>
                </div>
                <div class="person-balance-summary">
                    ${['income', 'expense', 'debt', 'credit'].map(type => {
                        const labels = { income: 'کل درآمد', expense: 'کل هزینه', debt: 'بدهی', credit: 'طلب' };
                        const icons = { income: 'fa-arrow-up', expense: 'fa-arrow-down', debt: 'fa-hand-holding-usd', credit: 'fa-coins' };
                        const keys = { income: 'totalIncome', expense: 'totalExpense', debt: 'totalDebt', credit: 'totalCredit' };
                        return `
                        <div class="balance-summary-item ${type}">
                            <i class="fas ${icons[type]}"></i>
                            <div><span>${labels[type]}</span><strong>${AccountingModule.formatCurrency(balance[keys[type]], displayCurrency)}</strong></div>
                        </div>`;
                    }).join('')}
                </div>
                <div class="person-transactions">
                    <h4><i class="fas fa-list"></i> تراکنش‌ها (${transactions.length})</h4>
                    ${transactions.length ? `
                    <div class="transactions-table">
                        ${transactions.map(t => {
                            const converted = AccountingModule.convertAmount(t.amount, t.currency || 'تومان', displayCurrency);
                            return `
                            <div class="transaction-row ${t.type}">
                                <div class="transaction-info">
                                    <span class="transaction-type-badge ${t.type}">${TYPE_LABELS[t.type]}</span>
                                    <span class="transaction-desc">${escapeHtml(t.description || t.category)}</span>
                                    <span class="transaction-date">${new Date(t.date).toLocaleDateString('fa-IR')}</span>
                                </div>
                                <div class="transaction-amount ${t.type}">
                                    ${AccountingModule.formatCurrency(t.amount, t.currency || 'تومان')}
                                    ${(t.currency || 'تومان') !== displayCurrency ? `<span class="text-sm">(${AccountingModule.formatCurrency(converted, displayCurrency)})</span>` : ''}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>` : '<p class="text-center empty-text">تراکنشی ثبت نشده</p>'}
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="AccountingUI.closeModal()">بستن</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modal);
    }

    return {
        init,
        render,
        refresh,
        closeModal,
        changeCurrency,
        filterTransactions,
        filterByPerson,
        getCategoryOptions,
        toggleCustomCategory,
        updateCategoryOptions,
        showAddTransactionModal,
        showEditTransactionModal,
        showTransactionModal,
        submitTransaction,
        confirmDeleteTransaction,
        showAddPersonModal,
        submitPerson,
        showPersonsReport,
        deletePerson,
        showAllPersonsList,
        showPersonDetails
    };
})();
