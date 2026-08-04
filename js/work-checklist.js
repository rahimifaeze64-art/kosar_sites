// Work Checklist Module — ماژول چک‌لیست کاری
const WorkChecklistModule = {

    // ─── State ───────────────────────────────────────────────────
    supabase: null,
    currentUser: null,

    // ─── Init ─────────────────────────────────────────────────────
    async init(user) {
        this.currentUser = user;
        // از همان getSupabaseClient که بقیه سیستم استفاده می‌کند
        if (typeof getSupabaseClient === 'function') {
            this.supabase = getSupabaseClient();
        }
        if (!this.supabase && window.supabaseClient) {
            this.supabase = window.supabaseClient;
        }
        await this.render();
    },

    // ─── Supabase helpers ─────────────────────────────────────────
    async getCategories() {
        if (this.supabase) {
            const { data, error } = await this.supabase
                .from('checklist_categories')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: true });
            if (error) {
                console.error('❌ خطا در دریافت دسته‌بندی‌ها از Supabase:', error.message);
            } else if (data) {
                // cache در localStorage به‌روز کن
                this._localSet('wc_categories_' + this.currentUser.id, data);
                return data;
            }
        }
        return this._localGet('wc_categories_' + this.currentUser.id) || [];
    },

    async saveCategory(cat) {
        if (this.supabase) {
            const { data, error } = await this.supabase
                .from('checklist_categories')
                .upsert(cat)
                .select()
                .single();
            if (error) {
                console.error('❌ خطا در ذخیره دسته‌بندی در Supabase:', error.message);
            } else if (data) {
                // بروزرسانی localStorage به عنوان cache
                const all = this._localGet('wc_categories_' + this.currentUser.id) || [];
                const idx = all.findIndex(c => c.id === data.id);
                if (idx >= 0) all[idx] = data; else all.push(data);
                this._localSet('wc_categories_' + this.currentUser.id, all);
                return data;
            }
        }
        // fallback به localStorage (آفلاین یا خطا)
        const all = this._localGet('wc_categories_' + this.currentUser.id) || [];
        const idx = all.findIndex(c => c.id === cat.id);
        if (idx >= 0) all[idx] = cat; else all.push(cat);
        this._localSet('wc_categories_' + this.currentUser.id, all);
        return cat;
    },

    async deleteCategory(id) {
        if (this.supabase) {
            const { error: e1 } = await this.supabase.from('checklist_items').delete().eq('category_id', id);
            if (e1) console.error('❌ خطا در حذف آیتم‌های دسته از Supabase:', e1.message);
            const { error: e2 } = await this.supabase.from('checklist_tasks').delete().eq('category_id', id);
            if (e2) console.error('❌ خطا در حذف تسک‌های دسته از Supabase:', e2.message);
            const { error: e3 } = await this.supabase.from('checklist_categories').delete().eq('id', id);
            if (e3) console.error('❌ خطا در حذف دسته‌بندی از Supabase:', e3.message);
        }
        const cats = (this._localGet('wc_categories_' + this.currentUser.id) || []).filter(c => c.id !== id);
        this._localSet('wc_categories_' + this.currentUser.id, cats);
        const items = (this._localGet('wc_items_' + this.currentUser.id) || []).filter(i => i.category_id !== id);
        this._localSet('wc_items_' + this.currentUser.id, items);
        const tasks = (this._localGet('wc_tasks_' + this.currentUser.id) || []).filter(t => t.category_id !== id);
        this._localSet('wc_tasks_' + this.currentUser.id, tasks);
    },

    async getItems(categoryId) {
        if (this.supabase) {
            const { data, error } = await this.supabase
                .from('checklist_items')
                .select('*')
                .eq('category_id', categoryId)
                .order('created_at', { ascending: true });
            if (error) {
                console.error('❌ خطا در دریافت آیتم‌ها از Supabase:', error.message);
            } else if (data) {
                return data;
            }
        }
        return (this._localGet('wc_items_' + this.currentUser.id) || []).filter(i => i.category_id === categoryId);
    },

    async saveItem(item) {
        if (this.supabase) {
            const { data, error } = await this.supabase
                .from('checklist_items')
                .upsert(item)
                .select()
                .single();
            if (error) {
                console.error('❌ خطا در ذخیره آیتم در Supabase:', error.message);
            } else if (data) {
                // بروزرسانی localStorage به عنوان cache
                const all = this._localGet('wc_items_' + this.currentUser.id) || [];
                const idx = all.findIndex(i => i.id === data.id);
                if (idx >= 0) all[idx] = data; else all.push(data);
                this._localSet('wc_items_' + this.currentUser.id, all);
                return data;
            }
        }
        // fallback به localStorage (آفلاین یا خطا)
        const all = this._localGet('wc_items_' + this.currentUser.id) || [];
        const idx = all.findIndex(i => i.id === item.id);
        if (idx >= 0) all[idx] = item; else all.push(item);
        this._localSet('wc_items_' + this.currentUser.id, all);
        return item;
    },

    async deleteItem(id) {
        if (this.supabase) {
            const { error: e1 } = await this.supabase.from('checklist_tasks').delete().eq('item_id', id);
            if (e1) console.error('❌ خطا در حذف تسک‌های آیتم از Supabase:', e1.message);
            const { error: e2 } = await this.supabase.from('checklist_items').delete().eq('id', id);
            if (e2) console.error('❌ خطا در حذف آیتم از Supabase:', e2.message);
        }
        const items = (this._localGet('wc_items_' + this.currentUser.id) || []).filter(i => i.id !== id);
        this._localSet('wc_items_' + this.currentUser.id, items);
        const tasks = (this._localGet('wc_tasks_' + this.currentUser.id) || []).filter(t => t.item_id !== id);
        this._localSet('wc_tasks_' + this.currentUser.id, tasks);
    },

    async getTasks(itemId) {
        if (this.supabase) {
            const { data, error } = await this.supabase
                .from('checklist_tasks')
                .select('*')
                .eq('item_id', itemId)
                .order('sort_order', { ascending: true });
            if (error) {
                console.error('❌ خطا در دریافت تسک‌ها از Supabase:', error.message);
            } else if (data) {
                return data;
            }
        }
        return (this._localGet('wc_tasks_' + this.currentUser.id) || []).filter(t => t.item_id === itemId);
    },

    async saveTask(task) {
        if (this.supabase) {
            const { data, error } = await this.supabase
                .from('checklist_tasks')
                .upsert(task)
                .select()
                .single();
            if (error) {
                console.error('❌ خطا در ذخیره تسک در Supabase:', error.message);
            } else if (data) {
                // بروزرسانی localStorage به عنوان cache
                const all = this._localGet('wc_tasks_' + this.currentUser.id) || [];
                const idx = all.findIndex(t => t.id === data.id);
                if (idx >= 0) all[idx] = data; else all.push(data);
                this._localSet('wc_tasks_' + this.currentUser.id, all);
                return data;
            }
        }
        // fallback به localStorage (آفلاین یا خطا)
        const all = this._localGet('wc_tasks_' + this.currentUser.id) || [];
        const idx = all.findIndex(t => t.id === task.id);
        if (idx >= 0) all[idx] = task; else all.push(task);
        this._localSet('wc_tasks_' + this.currentUser.id, all);
        return task;
    },

    // ذخیره حذف تسک در Supabase + localStorage
    async _deleteTaskById(id) {
        if (this.supabase) {
            const { error } = await this.supabase.from('checklist_tasks').delete().eq('id', id);
            if (error) console.error('❌ خطا در حذف تسک از Supabase:', error.message);
        }
        const tasks = (this._localGet('wc_tasks_' + this.currentUser.id) || []).filter(t => t.id !== id);
        this._localSet('wc_tasks_' + this.currentUser.id, tasks);
    },

    // ─── localStorage helpers ─────────────────────────────────────
    _localGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    _localSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
    _uuid() { return 'wc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); },

    // ─── Main Render ──────────────────────────────────────────────
    async render() {
        const container = document.getElementById('work-checklist-root');
        if (!container) return;
        container.innerHTML = `
            <div class="space-y-6" id="wc-wrapper">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                        <span class="bg-yellow-500/20 p-2 rounded-xl">
                            <i class="fas fa-check-square text-yellow-400"></i>
                        </span>
                        چک‌لیست کاری
                    </h2>
                    <button onclick="WorkChecklistModule.showAddCategoryModal()"
                            class="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg">
                        <i class="fas fa-plus"></i>
                        دسته‌بندی جدید
                    </button>
                </div>
                <div id="wc-categories-container" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="col-span-full flex items-center justify-center py-16">
                        <i class="fas fa-spinner fa-spin text-3xl text-yellow-400"></i>
                    </div>
                </div>
            </div>`;
        await this.renderCategories();
    },

    async renderCategories() {
        const container = document.getElementById('wc-categories-container');
        if (!container) return;
        const cats = await this.getCategories();
        if (!cats.length) {
            container.innerHTML = `
                <div class="col-span-full text-center py-16 bg-white/5 rounded-2xl border border-white/10">
                    <i class="fas fa-layer-group text-5xl text-yellow-400/50 mb-4 block"></i>
                    <p class="text-black-400 text-lg mb-2">هنوز دسته‌بندی ندارید</p>
                    <p class="text-black-300/60 text-sm">با کلیک روی «دسته‌بندی جدید» شروع کنید</p>
                </div>`;
            return;
        }
        container.innerHTML = cats.map(cat => this._buildCategoryCard(cat)).join('');
        // render items inside each category
        for (const cat of cats) {
            await this.renderItems(cat.id);
        }
    },

    _buildCategoryCard(cat) {
        const colors = {
            yellow: 'border-yellow-500/40 bg-yellow-900/20',
            blue:   'border-blue-500/40 bg-blue-900/20',
            green:  'border-green-500/40 bg-green-900/20',
            yellow: 'border-yellow-500/40 bg-yellow-900/20',
            red:    'border-red-500/40 bg-red-900/20',
            pink:   'border-pink-500/40 bg-pink-900/20',
        };
        const iconColors = {
            yellow: 'text-yellow-400', blue: 'text-black-400',
            green:  'text-green-400',  yellow: 'text-yellow-400',
            red:    'text-red-400',    pink:   'text-pink-400',
        };
        const clr = cat.color || 'yellow';
        return `
        <div class="rounded-2xl border ${colors[clr] || colors.yellow} p-5 space-y-4 backdrop-blur-sm" id="wc-cat-${cat.id}">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <i class="${cat.icon || 'fas fa-folder'} text-xl ${iconColors[clr] || iconColors.yellow}"></i>
                    <h3 class="text-white font-bold text-lg">${this._esc(cat.name)}</h3>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="WorkChecklistModule.showAddItemModal('${cat.id}')"
                            class="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1" title="افزودن آیتم">
                        <i class="fas fa-plus text-xs"></i> آیتم
                    </button>
                    <button onclick="WorkChecklistModule.showEditCategoryModal('${cat.id}')"
                            class="text-black-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all" title="ویرایش">
                        <i class="fas fa-edit text-sm"></i>
                    </button>
                    <button onclick="WorkChecklistModule.confirmDeleteCategory('${cat.id}')"
                            class="text-red-400 hover:text-white p-1.5 rounded-lg hover:bg-red-500/20 transition-all" title="حذف دسته‌بندی">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </div>
            </div>
            ${cat.description ? `<p class="text-black-400/70 text-sm">${this._esc(cat.description)}</p>` : ''}
            <div id="wc-items-${cat.id}" class="space-y-3 min-h-[40px]">
                <i class="fas fa-spinner fa-spin text-yellow-400 text-sm block text-center py-2"></i>
            </div>
        </div>`;
    },

    async renderItems(categoryId) {
        const container = document.getElementById('wc-items-' + categoryId);
        if (!container) return;
        const items = await this.getItems(categoryId);
        if (!items.length) {
            container.innerHTML = `<p class="text-black-300/50 text-sm text-center py-2 italic">آیتمی وجود ندارد — یک آیتم اضافه کنید</p>`;
            return;
        }
        container.innerHTML = items.map(item => this._buildItemCard(item)).join('');
    },

    _buildItemCard(item) {
        return `
        <div class="bg-white/5 rounded-xl border border-white/10 overflow-hidden" id="wc-item-${item.id}">
            <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 cursor-pointer"
                 onclick="WorkChecklistModule.toggleItemExpand('${item.id}')">
                <div class="flex items-center gap-3">
                    <i class="fas fa-chevron-left text-xs text-black-300 transition-transform duration-200" id="wc-chevron-${item.id}"></i>
                    <i class="${item.icon || 'fas fa-list-check'} text-black-300 text-sm"></i>
                    <span class="text-white font-medium">${this._esc(item.name)}</span>
                    <span class="bg-yellow-500/20 text-yellow-300 text-xs px-2 py-0.5 rounded-full" id="wc-item-count-${item.id}">...</span>
                </div>
                <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                    <button onclick="WorkChecklistModule.showEditItemModal('${item.id}')"
                            class="text-black-300 hover:text-white p-1 rounded hover:bg-white/10 transition-all" title="ویرایش">
                        <i class="fas fa-edit text-xs"></i>
                    </button>
                    <button onclick="WorkChecklistModule.confirmDeleteItem('${item.id}')"
                            class="text-red-400 hover:text-white p-1 rounded hover:bg-red-500/20 transition-all" title="حذف">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
            <div class="hidden px-4 py-3 space-y-2" id="wc-tasks-panel-${item.id}">
                <div id="wc-tasks-list-${item.id}" class="space-y-2">
                    <i class="fas fa-spinner fa-spin text-xs text-yellow-400"></i>
                </div>
                <div class="flex gap-2 mt-3">
                    <input type="text" id="wc-new-task-input-${item.id}"
                           placeholder="وظیفه جدید را بنویسید..."
                           onkeydown="if(event.key==='Enter') WorkChecklistModule.addTask('${item.id}')"
                           class="flex-1 bg-white/10 text-white placeholder-blue-300/50 text-sm px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-yellow-500"/>
                    <button onclick="WorkChecklistModule.addTask('${item.id}')"
                            class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-sm transition-all">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
        </div>`;
    },

    async toggleItemExpand(itemId) {
        const panel = document.getElementById('wc-tasks-panel-' + itemId);
        const chevron = document.getElementById('wc-chevron-' + itemId);
        if (!panel) return;
        const isHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        if (chevron) chevron.style.transform = isHidden ? 'rotate(-90deg)' : '';
        if (isHidden) await this.renderTasks(itemId);
    },

    async renderTasks(itemId) {
        const container = document.getElementById('wc-tasks-list-' + itemId);
        const countBadge = document.getElementById('wc-item-count-' + itemId);
        if (!container) return;
        const tasks = await this.getTasks(itemId);
        if (countBadge) {
            const done = tasks.filter(t => t.is_done).length;
            countBadge.textContent = done + '/' + tasks.length;
        }
        if (!tasks.length) {
            container.innerHTML = `<p class="text-black-300/50 text-sm italic py-1">هنوز وظیفه‌ای تعریف نشده</p>`;
            return;
        }
        container.innerHTML = tasks.map(t => this._buildTaskRow(t)).join('');
    },

    _buildTaskRow(task) {
        const done = task.is_done;
        return `
        <div class="flex items-center gap-3 group py-1 px-2 rounded-lg hover:bg-white/5 transition-all" id="wc-task-row-${task.id}">
            <input type="checkbox" ${done ? 'checked' : ''}
                   onchange="WorkChecklistModule.toggleTask('${task.id}', this.checked)"
                   class="w-4 h-4 accent-yellow-500 cursor-pointer flex-shrink-0"/>
            <span id="wc-task-text-${task.id}"
                  class="flex-1 text-sm ${done ? 'line-through text-black-300/50' : 'text-white'}">${this._esc(task.title)}</span>
            ${task.note ? `<i class="fas fa-sticky-note text-yellow-400/60 text-xs" title="${this._esc(task.note)}"></i>` : ''}
            <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all flex-shrink-0">
                <button onclick="WorkChecklistModule.showEditTaskModal('${task.id}')"
                        class="text-black-400 hover:text-white p-1 rounded transition-all" title="ویرایش">
                    <i class="fas fa-edit text-xs"></i>
                </button>
                <button onclick="WorkChecklistModule.deleteTask('${task.id}', '${task.item_id}')"
                        class="text-red-400 hover:text-white p-1 rounded transition-all" title="حذف">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </div>
        </div>`;
    },

    // ─── Task Actions ─────────────────────────────────────────────
    async addTask(itemId) {
        const input = document.getElementById('wc-new-task-input-' + itemId);
        if (!input || !input.value.trim()) return;
        const task = {
            id: this._uuid(),
            item_id: itemId,
            category_id: null,
            title: input.value.trim(),
            is_done: false,
            note: '',
            sort_order: Date.now(),
            created_at: new Date().toISOString(),
            user_id: this.currentUser.id,
        };
        await this.saveTask(task);
        input.value = '';
        await this.renderTasks(itemId);
    },

    async toggleTask(taskId, isDone) {
        let task;
        if (this.supabase) {
            const { data } = await this.supabase
                .from('checklist_tasks').select('*').eq('id', taskId).single();
            task = data;
        } else {
            task = (this._localGet('wc_tasks_' + this.currentUser.id) || []).find(t => t.id === taskId);
        }
        if (!task) return;
        task.is_done = isDone;
        task.done_at = isDone ? new Date().toISOString() : null;
        await this.saveTask(task);
        // بروزرسانی UI بدون re-render کامل
        const span = document.getElementById('wc-task-text-' + taskId);
        if (span) {
            span.className = 'flex-1 text-sm ' + (isDone ? 'line-through text-black-300/50' : 'text-white');
        }
        const badge = document.getElementById('wc-item-count-' + task.item_id);
        if (badge) {
            const tasks = await this.getTasks(task.item_id);
            const done = tasks.filter(t => t.is_done).length;
            badge.textContent = done + '/' + tasks.length;
        }
    },

    async deleteTask(taskId, itemId) {
        if (!confirm('این وظیفه حذف شود؟')) return;
        await this._deleteTaskById(taskId);
        const row = document.getElementById('wc-task-row-' + taskId);
        if (row) row.remove();
        await this.renderTasks(itemId);
    },

    // ─── Modal: Add/Edit Category ─────────────────────────────────
    showAddCategoryModal() {
        this._showCategoryModal(null);
    },

    async showEditCategoryModal(id) {
        const cats = await this.getCategories();
        const cat = cats.find(c => c.id === id);
        if (cat) this._showCategoryModal(cat);
    },

    _showCategoryModal(cat) {
        const isEdit = !!cat;
        const colors = ['yellow','blue','green','yellow','red','pink'];
        const icons  = [
            'fas fa-folder','fas fa-briefcase','fas fa-star','fas fa-bell',
            'fas fa-fire','fas fa-rocket','fas fa-heart','fas fa-book',
            'fas fa-code','fas fa-chart-bar','fas fa-cogs','fas fa-graduation-cap'
        ];
        const html = `
        <div class="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4" id="wc-modal-overlay" onclick="if(event.target.id==='wc-modal-overlay') WorkChecklistModule.closeModal()">
            <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-white font-bold text-lg">${isEdit ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}</h3>
                    <button onclick="WorkChecklistModule.closeModal()" class="text-black-300 hover:text-white">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">نام دسته‌بندی *</label>
                        <input id="wc-cat-name" value="${cat ? this._esc(cat.name) : ''}"
                               class="w-full bg-white/10 text-white placeholder-blue-300/50 px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-yellow-500"
                               placeholder="مثال: مدیریت دانشجو"/>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">توضیح (اختیاری)</label>
                        <input id="wc-cat-desc" value="${cat && cat.description ? this._esc(cat.description) : ''}"
                               class="w-full bg-white/10 text-white placeholder-blue-300/50 px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-yellow-500"
                               placeholder="توضیح کوتاه..."/>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-2 block">رنگ</label>
                        <div class="flex gap-2">
                            ${colors.map(c => `
                            <label class="cursor-pointer">
                                <input type="radio" name="wc-cat-color" value="${c}" ${(!cat && c==='yellow') || (cat && cat.color===c) ? 'checked' : ''} class="sr-only"/>
                                <div class="w-8 h-8 rounded-full bg-${c}-500 ring-2 ring-offset-2 ring-offset-slate-800 ring-transparent peer-checked:ring-white transition-all"
                                     onclick="document.querySelectorAll('[name=wc-cat-color]').forEach(r=>r.value==='${c}'?r.click():null)"
                                     id="wc-color-dot-${c}"></div>
                            </label>`).join('')}
                        </div>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-2 block">آیکون</label>
                        <div class="grid grid-cols-6 gap-2">
                            ${icons.map(ic => `
                            <label class="cursor-pointer">
                                <input type="radio" name="wc-cat-icon" value="${ic}" ${(!cat && ic==='fas fa-folder') || (cat && cat.icon===ic) ? 'checked' : ''} class="sr-only wc-icon-radio"/>
                                <div class="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-all border border-transparent hover:border-yellow-500 wc-icon-btn"
                                     onclick="WorkChecklistModule._selectIcon('${ic}')">
                                    <i class="${ic} text-black-400"></i>
                                </div>
                            </label>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button onclick="WorkChecklistModule.saveCategoryFromModal('${cat ? cat.id : ''}')"
                            class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-xl font-medium transition-all">
                        <i class="fas fa-save ml-2"></i>${isEdit ? 'ذخیره تغییرات' : 'ایجاد دسته‌بندی'}
                    </button>
                    <button onclick="WorkChecklistModule.closeModal()"
                            class="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition-all">
                        انصراف
                    </button>
                </div>
            </div>
        </div>`;
        document.getElementById('modals-container').insertAdjacentHTML('beforeend', html);
    },

    _selectIcon(ic) {
        document.querySelectorAll('.wc-icon-radio').forEach(r => {
            const btn = r.nextElementSibling;
            if (r.value === ic) {
                r.checked = true;
                if (btn) btn.classList.add('border-yellow-500', 'bg-yellow-500/20');
            } else {
                if (btn) btn.classList.remove('border-yellow-500', 'bg-yellow-500/20');
            }
        });
    },

    async saveCategoryFromModal(existingId) {
        const name = document.getElementById('wc-cat-name')?.value.trim();
        if (!name) { alert('لطفاً نام دسته‌بندی را وارد کنید'); return; }
        const desc = document.getElementById('wc-cat-desc')?.value.trim() || '';
        const colorRadio = document.querySelector('input[name="wc-cat-color"]:checked');
        const iconRadio  = document.querySelector('input[name="wc-cat-icon"]:checked');
        const cat = {
            id: existingId || this._uuid(),
            user_id: this.currentUser.id,
            name,
            description: desc,
            color: colorRadio ? colorRadio.value : 'yellow',
            icon: iconRadio  ? iconRadio.value  : 'fas fa-folder',
            created_at: new Date().toISOString(),
        };
        await this.saveCategory(cat);
        this.closeModal();
        await this.renderCategories();
    },

    // ─── Modal: Delete Category ───────────────────────────────────
    confirmDeleteCategory(id) {
        if (!confirm('این دسته‌بندی و تمام آیتم‌ها و وظایف آن حذف شوند؟')) return;
        this.deleteCategory(id).then(() => this.renderCategories());
    },

    // ─── Modal: Add/Edit Item ─────────────────────────────────────
    showAddItemModal(categoryId) {
        this._showItemModal(categoryId, null);
    },

    async showEditItemModal(itemId) {
        const allItems = this.supabase
            ? (await this.supabase.from('checklist_items').select('*').eq('id', itemId).single()).data
            : (this._localGet('wc_items_' + this.currentUser.id) || []).find(i => i.id === itemId);
        if (allItems) this._showItemModal(allItems.category_id, allItems);
    },

    _showItemModal(categoryId, item) {
        const isEdit = !!item;
        const icons = [
            'fas fa-list-check','fas fa-file-alt','fas fa-tasks','fas fa-clipboard',
            'fas fa-phone','fas fa-envelope','fas fa-calendar','fas fa-user',
            'fas fa-flag','fas fa-exclamation-circle','fas fa-check-circle','fas fa-info-circle'
        ];
        const html = `
        <div class="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4" id="wc-modal-overlay" onclick="if(event.target.id==='wc-modal-overlay') WorkChecklistModule.closeModal()">
            <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-white font-bold text-lg">${isEdit ? 'ویرایش آیتم' : 'آیتم جدید'}</h3>
                    <button onclick="WorkChecklistModule.closeModal()" class="text-black-300 hover:text-white">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">نام آیتم *</label>
                        <input id="wc-item-name" value="${item ? this._esc(item.name) : ''}"
                               class="w-full bg-white/10 text-white placeholder-blue-300/50 px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-yellow-500"
                               placeholder="مثال: بررسی پرونده دانشجو"/>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-2 block">آیکون</label>
                        <div class="grid grid-cols-6 gap-2">
                            ${icons.map(ic => `
                            <label class="cursor-pointer">
                                <input type="radio" name="wc-item-icon" value="${ic}" ${(!item && ic==='fas fa-list-check') || (item && item.icon===ic) ? 'checked' : ''} class="sr-only wc-item-icon-radio"/>
                                <div class="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-all border border-transparent hover:border-blue-500 wc-item-icon-btn"
                                     onclick="WorkChecklistModule._selectItemIcon('${ic}')">
                                    <i class="${ic} text-black-400 text-sm"></i>
                                </div>
                            </label>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button onclick="WorkChecklistModule.saveItemFromModal('${categoryId}', '${item ? item.id : ''}')"
                            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-all">
                        <i class="fas fa-save ml-2"></i>${isEdit ? 'ذخیره تغییرات' : 'ایجاد آیتم'}
                    </button>
                    <button onclick="WorkChecklistModule.closeModal()"
                            class="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition-all">
                        انصراف
                    </button>
                </div>
            </div>
        </div>`;
        document.getElementById('modals-container').insertAdjacentHTML('beforeend', html);
        // highlight selected icon
        setTimeout(() => {
            const sel = item ? item.icon : 'fas fa-list-check';
            this._selectItemIcon(sel);
        }, 50);
    },

    _selectItemIcon(ic) {
        document.querySelectorAll('.wc-item-icon-radio').forEach(r => {
            const btn = r.nextElementSibling;
            if (r.value === ic) {
                r.checked = true;
                if (btn) btn.classList.add('border-blue-500', 'bg-blue-500/20');
            } else {
                if (btn) btn.classList.remove('border-blue-500', 'bg-blue-500/20');
            }
        });
    },

    async saveItemFromModal(categoryId, existingId) {
        const name = document.getElementById('wc-item-name')?.value.trim();
        if (!name) { alert('لطفاً نام آیتم را وارد کنید'); return; }
        const iconRadio = document.querySelector('input[name="wc-item-icon"]:checked');
        const item = {
            id: existingId || this._uuid(),
            category_id: categoryId,
            user_id: this.currentUser.id,
            name,
            icon: iconRadio ? iconRadio.value : 'fas fa-list-check',
            created_at: new Date().toISOString(),
        };
        await this.saveItem(item);
        this.closeModal();
        await this.renderItems(categoryId);
    },

    // ─── Modal: Delete Item ───────────────────────────────────────
    async confirmDeleteItem(itemId) {
        if (!confirm('این آیتم و تمام وظایف آن حذف شود؟')) return;
        let catId = null;
        if (this.supabase) {
            const { data } = await this.supabase.from('checklist_items').select('category_id').eq('id', itemId).single();
            catId = data?.category_id;
        } else {
            const it = (this._localGet('wc_items_' + this.currentUser.id) || []).find(i => i.id === itemId);
            catId = it?.category_id;
        }
        await this.deleteItem(itemId);
        if (catId) await this.renderItems(catId);
    },

    // ─── Modal: Edit Task ─────────────────────────────────────────
    async showEditTaskModal(taskId) {
        let task;
        if (this.supabase) {
            const { data } = await this.supabase.from('checklist_tasks').select('*').eq('id', taskId).single();
            task = data;
        } else {
            task = (this._localGet('wc_tasks_' + this.currentUser.id) || []).find(t => t.id === taskId);
        }
        if (!task) return;
        const html = `
        <div class="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4" id="wc-modal-overlay" onclick="if(event.target.id==='wc-modal-overlay') WorkChecklistModule.closeModal()">
            <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-white font-bold text-lg">ویرایش وظیفه</h3>
                    <button onclick="WorkChecklistModule.closeModal()" class="text-black-300 hover:text-white">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">عنوان وظیفه *</label>
                        <input id="wc-edit-task-title" value="${this._esc(task.title)}"
                               class="w-full bg-white/10 text-white px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-yellow-500"/>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">یادداشت</label>
                        <textarea id="wc-edit-task-note" rows="3"
                                  class="w-full bg-white/10 text-white px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-yellow-500 resize-none"
                                  placeholder="یادداشت اضافی...">${task.note || ''}</textarea>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button onclick="WorkChecklistModule.saveEditedTask('${task.id}', '${task.item_id}')"
                            class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-xl font-medium transition-all">
                        <i class="fas fa-save ml-2"></i>ذخیره
                    </button>
                    <button onclick="WorkChecklistModule.closeModal()"
                            class="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition-all">
                        انصراف
                    </button>
                </div>
            </div>
        </div>`;
        document.getElementById('modals-container').insertAdjacentHTML('beforeend', html);
    },

    async saveEditedTask(taskId, itemId) {
        const title = document.getElementById('wc-edit-task-title')?.value.trim();
        if (!title) { alert('عنوان نمی‌تواند خالی باشد'); return; }
        const note = document.getElementById('wc-edit-task-note')?.value.trim() || '';
        let task;
        if (this.supabase) {
            const { data } = await this.supabase.from('checklist_tasks').select('*').eq('id', taskId).single();
            task = data;
        } else {
            task = (this._localGet('wc_tasks_' + this.currentUser.id) || []).find(t => t.id === taskId);
        }
        if (!task) return;
        task.title = title;
        task.note  = note;
        await this.saveTask(task);
        this.closeModal();
        await this.renderTasks(itemId);
    },

    // ─── Utility ──────────────────────────────────────────────────
    closeModal() {
        const overlay = document.getElementById('wc-modal-overlay');
        if (overlay) overlay.remove();
    },

    _esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#39;');
    },

    // ─── Public content getter (for app.js) ───────────────────────
    getWorkChecklistContent() {
        return `
        <div id="work-checklist-root" class="min-h-[60vh]">
            <div class="flex items-center justify-center py-16">
                <i class="fas fa-spinner fa-spin text-3xl text-yellow-400"></i>
            </div>
        </div>`;
    },
};

// Make accessible globally
window.WorkChecklistModule = WorkChecklistModule;
