// Work Checklist Module — ماژول چک‌لیست کاری
const WorkChecklistModule = {

    // ─── State ───────────────────────────────────────────────────
    supabase: null,
    currentUser: null,
    _initializing: false,   // جلوگیری از double-init
    _initialized: false,    // آیا قبلاً init شده

    // ─── Init ─────────────────────────────────────────────────────
    async init(user) {
        // جلوگیری از اجرای همزمان چند init
        if (this._initializing) {
            console.log('🔍 [WC] init already in progress, skip');
            return;
        }
        this._initializing = true;
        this._initialized = false;
        console.log('🔍 [WC] WorkChecklistModule.init called, user:', user?.id, user?.role);
        this.currentUser = user;
        // از همان getSupabaseClient که بقیه سیستم استفاده می‌کند
        if (typeof getSupabaseClient === 'function') {
            this.supabase = getSupabaseClient();
        }
        if (!this.supabase && window.supabaseClient) {
            this.supabase = window.supabaseClient;
        }
        console.log('🔍 [WC] supabase client:', this.supabase ? 'OK' : 'NULL');
        // اگر user معتبر نبود، از localStorage بگیر
        if (!this.currentUser || !this.currentUser.id) {
            try {
                const saved = localStorage.getItem('currentUser');
                if (saved) this.currentUser = JSON.parse(saved);
                console.log('🔍 [WC] user from localStorage:', this.currentUser?.id);
            } catch(e) {}
        }
        if (!this.currentUser || !this.currentUser.id) {
            console.error('❌ [WC] WorkChecklistModule.init: کاربر معتبر نیست');
            this._initializing = false;
            return;
        }
        console.log('✅ [WC] calling render...');
        await this._syncInboxFromSupabase();
        await this.render();
        console.log('✅ [WC] render done');
        // بعد از sync، shared section رو دوباره رندر کن
        // (چون sync async بود و ممکنه بعد از render اول تموم شده باشه)
        await this.renderSharedSection();
        this._initializing = false;
        this._initialized = true;
    },

    // ─── Supabase helpers ─────────────────────────────────────────
    async getCategories() {
        const localKey = 'wc_categories_' + this.currentUser.id;
        const localData = this._localGet(localKey) || [];
        console.log('🔍 [WC] getCategories localStorage:', localData.length, '| supabase:', !!this.supabase);

        // اگه localStorage داده داره، فوری برگردون + background sync
        if (localData.length > 0) {
            if (this.supabase) {
                // background sync — فقط داده‌های خود کاربر رو replace کن، shared رو حفظ کن
                this.supabase
                    .from('checklist_categories')
                    .select('*')
                    .eq('user_id', this.currentUser.id)
                    .order('created_at', { ascending: true })
                    .then(({ data }) => {
                        if (data && data.length > 0) {
                            const current = this._localGet(localKey) || [];
                            // حفظ آیتم‌های shared (shared_from موجود و متفاوت با کاربر فعلی)
                            const sharedItems = current.filter(c => c.shared_from && c.shared_from !== this.currentUser.id);
                            // merge: داده‌های Supabase + shared items
                            const merged = [...data];
                            sharedItems.forEach(s => {
                                const idx = merged.findIndex(m => m.id === s.id);
                                if (idx >= 0) {
                                    // نگاشت original_id فقط در localStorage است — هنگام جایگزینی با ردیف دیتابیس حفظ شود
                                    if (s.original_id && !merged[idx].original_id) merged[idx] = { ...merged[idx], original_id: s.original_id };
                                } else {
                                    merged.push(s);
                                }
                            });
                            this._localSet(localKey, merged);
                        }
                    })
                    .catch(() => {});
            }
            return localData;
        }

        // localStorage خالیه → Supabase با timeout
        if (this.supabase) {
            try {
                const supabasePromise = this.supabase
                    .from('checklist_categories')
                    .select('*')
                    .eq('user_id', this.currentUser.id)
                    .order('created_at', { ascending: true })
                    .then(res => res);
                const timeoutPromise = new Promise(resolve =>
                    setTimeout(() => {
                        console.warn('⚠️ [WC] getCategories TIMEOUT 4s');
                        resolve({ data: null, error: { message: 'timeout' } });
                    }, 4000)
                );
                const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);
                console.log('🔍 [WC] getCategories Supabase: data:', data?.length, '| error:', error?.message);
                if (!error && data) {
                    // حفظ shared items هنگام ست کردن از Supabase
                    const current = this._localGet(localKey) || [];
                    const sharedItems = current.filter(c => c.shared_from && c.shared_from !== this.currentUser.id);
                    const merged = [...data];
                    sharedItems.forEach(s => {
                        const idx = merged.findIndex(m => m.id === s.id);
                        if (idx >= 0) {
                            // نگاشت original_id فقط در localStorage است — حفظ شود
                            if (s.original_id && !merged[idx].original_id) merged[idx] = { ...merged[idx], original_id: s.original_id };
                        } else {
                            merged.push(s);
                        }
                    });
                    this._localSet(localKey, merged);
                    return merged;
                }
            } catch(e) {
                console.error('❌ [WC] getCategories exception:', e.message);
            }
        }
        return localData; // [] اگه هم Supabase fail شد
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
        const localKey = 'wc_items_' + this.currentUser.id;
        const localData = (this._localGet(localKey) || []).filter(i => i.category_id === categoryId);
        console.log('🔍 [WC] getItems:', categoryId, '| localStorage:', localData.length);

        // اگه localStorage داده داره، فوری برگردون + background sync (مثل getCategories)
        if (localData.length > 0) {
            if (this.supabase) {
                this.supabase
                    .from('checklist_items')
                    .select('*')
                    .eq('category_id', categoryId)
                    .order('created_at', { ascending: true })
                    .then(({ data }) => {
                        if (data && data.length > 0) {
                            const allItems = this._localGet(localKey) || [];
                            data.forEach(d => {
                                const idx = allItems.findIndex(i => i.id === d.id);
                                if (idx >= 0) allItems[idx] = this._keepLocalMapping(d, allItems[idx]); else allItems.push(d);
                            });
                            this._localSet(localKey, allItems);
                        }
                    })
                    .catch(() => {});
            }
            return localData;
        }

        // localStorage خالیه → Supabase با timeout
        if (this.supabase) {
            try {
                const t0 = Date.now();
                const supabasePromise = this.supabase
                    .from('checklist_items')
                    .select('*')
                    .eq('category_id', categoryId)
                    .order('created_at', { ascending: true })
                    .then(res => res);
                const timeoutPromise = new Promise(resolve =>
                    setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 4000)
                );
                const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);
                console.log('🔍 [WC] getItems Supabase:', Date.now()-t0, 'ms | data:', data?.length, '| error:', error?.message);
                if (!error && data) {
                    const allItems = this._localGet(localKey) || [];
                    data.forEach(d => {
                        const idx = allItems.findIndex(i => i.id === d.id);
                        if (idx >= 0) allItems[idx] = this._keepLocalMapping(d, allItems[idx]); else allItems.push(d);
                    });
                    this._localSet(localKey, allItems);
                    return data;
                }
            } catch(e) {
                console.error('❌ [WC] getItems exception:', e.message);
            }
        }
        console.log('🔍 [WC] getItems localStorage fallback:', localData.length);
        return localData;
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
        const localKey = 'wc_tasks_' + this.currentUser.id;
        const localData = (this._localGet(localKey) || [])
            .filter(t => t.item_id === itemId)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        // اگه localStorage داده داره، فوری برگردون
        // ⚠️ background sync رو اینجا نمی‌زنیم تا ترتیب drag/drop override نشه
        // sync فقط وقتی localStorage خالیه انجام می‌شه
        if (localData.length > 0) {
            return localData;
        }

        // localStorage خالیه → Supabase با timeout
        if (this.supabase) {
            try {
                const supabasePromise = this.supabase
                    .from('checklist_tasks')
                    .select('*')
                    .eq('item_id', itemId)
                    .order('sort_order', { ascending: true })
                    .then(res => res);
                const timeoutPromise = new Promise(resolve =>
                    setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 4000)
                );
                const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);
                if (!error && data) {
                    const allTasks = this._localGet(localKey) || [];
                    data.forEach(d => {
                        const idx = allTasks.findIndex(t => t.id === d.id);
                        if (idx >= 0) allTasks[idx] = this._keepLocalMapping(d, allTasks[idx]); else allTasks.push(d);
                    });
                    this._localSet(localKey, allTasks);
                    return data.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                }
            } catch(e) {
                console.error('❌ [WC] getTasks exception:', e.message);
            }
        }
        return localData;
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

    // ─── Drag & Drop برای وظایف ──────────────────────────────────
    _initDragDrop(container, itemId) {
        let dragging = null;

        container.querySelectorAll('.wc-drag-item').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                dragging = row;
                row.classList.add('opacity-50', 'scale-95');
                e.dataTransfer.effectAllowed = 'move';
            });
            row.addEventListener('dragend', () => {
                row.classList.remove('opacity-50', 'scale-95');
                container.querySelectorAll('.wc-drag-over').forEach(el => el.classList.remove('wc-drag-over', 'border-t-2', 'border-lime-500'));
                dragging = null;
                this._saveTaskOrder(container, itemId);
            });
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!dragging || dragging === row) return;
                e.dataTransfer.dropEffect = 'move';
                const rect = row.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                container.querySelectorAll('.wc-drag-over').forEach(el => el.classList.remove('wc-drag-over', 'border-t-2', 'border-lime-500'));
                row.classList.add('wc-drag-over', 'border-t-2', 'border-lime-500');
                if (e.clientY > mid) {
                    row.after(dragging);
                } else {
                    row.before(dragging);
                }
            });
        });
    },

    async _saveTaskOrder(container, itemId) {
        const rows = container.querySelectorAll('.wc-drag-item');
        const updates = [];
        rows.forEach((row, idx) => {
            const taskId = row.dataset.taskId;
            updates.push({ id: taskId, sort_order: idx });
        });

        // ── ۱. اول localStorage رو آپدیت کن ──────────────────────
        const all = this._localGet('wc_tasks_' + this.currentUser.id) || [];
        updates.forEach(u => {
            const t = all.find(t => t.id === u.id);
            if (t) t.sort_order = u.sort_order;
        });
        this._localSet('wc_tasks_' + this.currentUser.id, all);

        // ── ۲. Supabase رو آپدیت کن ───────────────────────────────
        if (this.supabase) {
            // همه آپدیت‌ها رو موازی بفرست
            await Promise.all(updates.map(u =>
                this.supabase
                    .from('checklist_tasks')
                    .update({ sort_order: u.sort_order })
                    .eq('id', u.id)
                    .then(({ error }) => {
                        if (error) console.warn('⚠️ [WC] sort_order update error:', error.message);
                    })
            ));
        }

        // ── ۳. badge تعداد رو از localStorage بخون (نه از Supabase) ──
        const badge = document.getElementById('wc-item-count-' + itemId);
        if (badge) {
            const tasks = (this._localGet('wc_tasks_' + this.currentUser.id) || [])
                .filter(t => t.item_id === itemId);
            const done = tasks.filter(t => t.is_done).length;
            badge.textContent = done + '/' + tasks.length;
        }
    },

    // ─── localStorage helpers ─────────────────────────────────────
    _localGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    _localSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
    _uuid() { return 'wc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); },

    // ─── Main Render ──────────────────────────────────────────────
    async render() {
        const container = document.getElementById('work-checklist-root');
        console.log('🔍 [WC] render() — container:', container ? 'FOUND' : 'NOT FOUND');
        if (!container) return;
        container.innerHTML = `
            <div class="space-y-6" id="wc-wrapper">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                        <span class="bg-lime-500/20 p-2 rounded-xl">
                            <i class="fas fa-check-square text-lime-400"></i>
                        </span>
                        چک‌لیست کاری
                    </h2>
                    <button onclick="WorkChecklistModule.showAddCategoryModal()"
                            class="bg-lime-600 hover:bg-lime-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg">
                        <i class="fas fa-plus"></i>
                        دسته‌بندی جدید
                    </button>
                </div>
                <div id="wc-categories-container" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="col-span-full flex items-center justify-center py-16">
                        <i class="fas fa-spinner fa-spin text-3xl text-lime-400"></i>
                    </div>
                </div>

                <!-- ═══ چک‌لیست‌های به اشتراک گذاشته شده ═══ -->
                <div id="wc-shared-section"></div>
            </div>`;
        await this.renderCategories();
        await this.renderSharedSection();
    },

    async renderSharedSection() {
        const el = document.getElementById('wc-shared-section');
        if (!el || !this.currentUser) return;

        // ── ۱. دریافتی‌ها (inbox) ──────────────────────────────────
        const inbox       = this._localGet('wc_inbox_' + this.currentUser.id) || [];
        const sharedCats  = inbox.filter(r => r.type === 'category');
        const sharedItems = inbox.filter(r => r.type === 'item');

        // ── ۲. ارسالی‌ها (چیزهایی که خودم به اشتراک گذاشتم) ─────
        const myShareMap   = this._localGet('wc_shares_' + this.currentUser.id) || {};
        const myShareKeys  = Object.keys(myShareMap).filter(k => myShareMap[k] && myShareMap[k].length > 0);
        const myCats       = await this.getCategories();
        const myItems      = this._localGet('wc_items_' + this.currentUser.id) || [];
        const allUsers     = typeof HARDCODED_USERS !== 'undefined' ? HARDCODED_USERS : [];

        // ── ۳. بخش ارسالی‌ها ──────────────────────────────────────
        const sentHTML = myShareKeys.map(key => {
            const [type, refId] = key.split(':');
            const sharedWith = myShareMap[key] || [];
            const userNames  = sharedWith.map(uid => {
                const u = allUsers.find(x => x.id === uid);
                return u ? u.name : uid;
            });

            if (type === 'category') {
                const cat = myCats.find(c => c.id === refId);
                if (!cat) return '';
                const catItems = myItems.filter(i => i.category_id === refId);
                return `
                <div class="rounded-xl border border-lime-500/25 bg-lime-900/10 p-4">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-2">
                            <i class="${cat.icon || 'fas fa-folder'} text-lime-400"></i>
                            <span class="text-white font-medium text-sm">${this._esc(cat.name)}</span>
                            <span class="text-xs bg-lime-500/20 text-lime-300 border border-lime-500/30 px-2 py-0.5 rounded-full">
                                دسته‌بندی
                            </span>
                            <span class="text-xs text-gray-500">${catItems.length} آیتم</span>
                        </div>
                        <div class="flex items-center gap-1 flex-wrap">
                            ${userNames.map(n => `
                            <span class="text-xs bg-slate-600 text-gray-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <i class="fas fa-user text-xs text-lime-400"></i>${this._esc(n)}
                            </span>`).join('')}
                            <button onclick="WorkChecklistModule.showShareCategoryModal('${refId}')"
                                    class="text-xs text-lime-400 hover:text-white px-2 py-0.5 rounded border border-lime-500/30 hover:bg-lime-500/20 transition-all">
                                <i class="fas fa-edit text-xs"></i> ویرایش
                            </button>
                        </div>
                    </div>
                </div>`;
            }

            if (type === 'item') {
                const item = myItems.find(i => i.id === refId);
                if (!item) return '';
                return `
                <div class="rounded-xl border border-blue-500/25 bg-blue-900/10 p-4">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-2">
                            <i class="${item.icon || 'fas fa-list-check'} text-blue-400"></i>
                            <span class="text-white font-medium text-sm">${this._esc(item.name)}</span>
                            <span class="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                آیتم
                            </span>
                        </div>
                        <div class="flex items-center gap-1 flex-wrap">
                            ${userNames.map(n => `
                            <span class="text-xs bg-slate-600 text-gray-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <i class="fas fa-user text-xs text-blue-400"></i>${this._esc(n)}
                            </span>`).join('')}
                            <button onclick="WorkChecklistModule.showShareItemModal('${refId}')"
                                    class="text-xs text-blue-400 hover:text-white px-2 py-0.5 rounded border border-blue-500/30 hover:bg-blue-500/20 transition-all">
                                <i class="fas fa-edit text-xs"></i> ویرایش
                            </button>
                        </div>
                    </div>
                </div>`;
            }
            return '';
        }).filter(Boolean).join('');

        // ── ۴. بخش دریافتی‌ها ─────────────────────────────────────
        const allMyItems = this._localGet('wc_items_' + this.currentUser.id) || [];
        const catsHTML = await Promise.all(sharedCats.map(async rec => {
            // دستهٔ کپی‌شده در لیست من: کپی جدید (original_id) یا کپی قدیمی (همان id اصلی)
            // یا (بعد از reload که نگاشت محلی پاک می‌شود) تطبیق با نام از طریق رکورد share
            const catCopy = myCats.find(c => c.shared_from === rec.ownerId && (c.original_id === rec.id || c.id === rec.id))
                         || myCats.find(c => c.shared_from === rec.ownerId && c.id !== rec.id && c.name === rec.name);
            const copyCatId = catCopy ? catCopy.id : rec.id;
            // آیتم‌های کپی‌شدهٔ این دسته (با حذف تکراری احتمالی بین کپی قدیمی/جدید)
            const seenIds = new Set();
            const catItems = allMyItems
                .filter(i => i.shared_from && (i.category_id === copyCatId || i.category_id === rec.id))
                .filter(i => {
                    const key = i.original_id || i.id;
                    if (seenIds.has(key)) return false;
                    seenIds.add(key);
                    return true;
                });
            const itemsHtml = catItems.map(item => this._buildSharedItemCard(item, rec.ownerName)).join('');
            return `
            <div class="rounded-2xl border border-purple-500/30 bg-purple-900/10 p-5 space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i class="${rec.icon || 'fas fa-folder'} text-xl text-purple-400"></i>
                        <div>
                            <h4 class="text-white font-bold">${this._esc(rec.name)}</h4>
                            <p class="text-xs text-purple-300 mt-0.5">
                                <i class="fas fa-user-friends ml-1"></i>از ${this._esc(rec.ownerName)}
                            </p>
                        </div>
                    </div>
                    <span class="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">دسته‌بندی مشترک</span>
                </div>
                ${catItems.length > 0
                    ? `<div class="space-y-2">${itemsHtml}</div>`
                    : `<p class="text-gray-500 text-sm text-center py-3 italic">آیتمی موجود نیست</p>`}
            </div>`;
        }));

        const standaloneItems = sharedItems.filter(rec => !sharedCats.find(c => c.id === rec.catId));
        const itemsOnlyHTML = standaloneItems.map(rec => {
            // کپی آیتم در لیست من: کپی جدید (original_id) یا کپی قدیمی (همان id اصلی) یا تطبیق نام
            const item = allMyItems.find(i => i.shared_from === rec.ownerId && i.original_id === rec.id)
                      || allMyItems.find(i => i.id === rec.id && i.shared_from)
                      || allMyItems.find(i => i.shared_from === rec.ownerId && i.name === rec.name);
            if (!item) return '';
            return `
            <div class="rounded-2xl border border-blue-500/30 bg-blue-900/10 p-4">
                ${this._buildSharedItemCard(item, rec.ownerName)}
            </div>`;
        }).filter(Boolean).join('');

        // ── ۵. ترکیب نهایی ────────────────────────────────────────
        const hasSent     = sentHTML.length > 0;
        const hasReceived = inbox.length > 0;

        if (!hasSent && !hasReceived) { el.innerHTML = ''; return; }

        el.innerHTML = `
        <div class="space-y-5">
            ${hasSent ? `
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-bold text-white flex items-center gap-3">
                        <span class="bg-lime-500/20 p-2 rounded-xl">
                            <i class="fas fa-share-alt text-lime-400"></i>
                        </span>
                        چک‌لیست‌های به اشتراک گذاشته‌شده توسط من
                        <span class="bg-lime-600 text-white text-xs rounded-full px-2 py-0.5">${myShareKeys.length}</span>
                    </h3>
                    <button onclick="WorkChecklistModule.renderSharedSection()"
                            class="text-gray-400 hover:text-white text-sm p-1 rounded" title="بروزرسانی">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
                <div class="space-y-2">${sentHTML}</div>
            </div>` : ''}

            ${hasReceived ? `
            <div class="space-y-3">
                <h3 class="text-xl font-bold text-white flex items-center gap-3">
                    <span class="bg-purple-500/20 p-2 rounded-xl">
                        <i class="fas fa-inbox text-purple-400"></i>
                    </span>
                    چک‌لیست‌های دریافت‌شده
                    <span class="bg-purple-600 text-white text-xs rounded-full px-2 py-0.5">${inbox.length}</span>
                </h3>
                ${catsHTML.join('')}
                ${itemsOnlyHTML}
            </div>` : ''}
        </div>`;
    },

    _buildSharedItemCard(item, ownerName) {
        return `
        <div class="bg-white/5 rounded-xl border border-white/10 overflow-hidden" id="wc-shared-item-${item.id}">
            <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 cursor-pointer"
                 onclick="WorkChecklistModule.toggleSharedItemExpand('${item.id}')">
                <div class="flex items-center gap-3">
                    <i class="fas fa-chevron-left text-xs text-gray-400 transition-transform duration-200"
                       id="wc-shared-chevron-${item.id}"></i>
                    <i class="${item.icon || 'fas fa-list-check'} text-purple-300 text-sm"></i>
                    <span class="text-white font-medium">${this._esc(item.name)}</span>
                    <span class="bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded-full"
                          id="wc-shared-count-${item.id}">...</span>
                </div>
                <span class="text-xs text-gray-500 flex-shrink-0" onclick="event.stopPropagation()">
                    <i class="fas fa-user ml-1 text-purple-400"></i>${this._esc(ownerName || '')}
                </span>
            </div>
            <div class="hidden px-4 py-3 space-y-2" id="wc-shared-tasks-panel-${item.id}">
                <div id="wc-shared-tasks-list-${item.id}" class="space-y-2">
                    <i class="fas fa-spinner fa-spin text-xs text-purple-400"></i>
                </div>
                <div class="flex gap-2 mt-3">
                    <input type="text" id="wc-shared-new-task-${item.id}"
                           placeholder="وظیفه جدید..."
                           onkeydown="if(event.key==='Enter') WorkChecklistModule.addTask('${item.id}')"
                           class="flex-1 bg-white/10 text-white placeholder-gray-500 text-sm px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-purple-500"/>
                    <button onclick="WorkChecklistModule.addTask('${item.id}')"
                            class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition-all">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
        </div>`;
    },

    async toggleSharedItemExpand(itemId) {
        const panel   = document.getElementById('wc-shared-tasks-panel-' + itemId);
        const chevron = document.getElementById('wc-shared-chevron-' + itemId);
        if (!panel) return;
        const isHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        if (chevron) chevron.style.transform = isHidden ? 'rotate(-90deg)' : '';
        if (isHidden) {
            const container  = document.getElementById('wc-shared-tasks-list-' + itemId);
            const countBadge = document.getElementById('wc-shared-count-' + itemId);
            const tasks = await this.getTasks(itemId);
            const sorted = [...tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            if (countBadge) {
                const done = sorted.filter(t => t.is_done).length;
                countBadge.textContent = done + '/' + sorted.length;
            }
            if (container) {
                if (!sorted.length) {
                    container.innerHTML = `<p class="text-gray-500 text-sm italic py-1">هنوز وظیفه‌ای تعریف نشده</p>`;
                } else {
                    container.innerHTML = sorted.map(t => this._buildTaskRow(t)).join('');
                    this._initDragDrop(container, itemId);
                }
            }
        }
    },

    async renderCategories() {
        if (!this.currentUser || !this.currentUser.id) {
            console.warn('⚠️ renderCategories: currentUser ندارد، skip');
            return;
        }
        const container = document.getElementById('wc-categories-container');
        console.log('🔍 [WC] wc-categories-container:', container ? 'FOUND' : 'NOT FOUND');
        if (!container) return;
        const cats = await this.getCategories();
        console.log('🔍 [WC] categories count:', cats?.length, cats);
        if (!cats.length) {
            container.innerHTML = `
                <div class="col-span-full text-center py-16 bg-white/5 rounded-2xl border border-white/10">
                    <i class="fas fa-layer-group text-5xl text-lime-400/50 mb-4 block"></i>
                    <p class="text-black-400 text-lg mb-2">هنوز دسته‌بندی ندارید</p>
                    <p class="text-black-300/60 text-sm">با کلیک روی «دسته‌بندی جدید» شروع کنید</p>
                </div>`;
            return;
        }

        // همه آیتم‌ها رو یکجا بگیر قبل از هر DOM write
        console.log('🔍 [WC] fetching all items before DOM write...');
        const allItemsMap = {};
        for (const cat of cats) {
            try {
                const items = await this.getItems(cat.id);
                allItemsMap[cat.id] = items || [];
                console.log('🔍 [WC] items for cat', cat.id, ':', items?.length);
            } catch(e) {
                console.error('❌ [WC] getItems error for cat', cat.id, ':', e.message);
                allItemsMap[cat.id] = [];
            }
        }

        // حالا یکجا DOM رو بنویس
        console.log('🔍 [WC] writing DOM...');
        try {
            container.innerHTML = cats.map(cat => {
                const items = allItemsMap[cat.id] || [];
                return this._buildCategoryCardWithItems(cat, items);
            }).join('');
        } catch(e) {
            console.error('❌ [WC] DOM write error:', e);
            container.innerHTML = `<p class="text-red-400 p-4">خطا در نمایش: ${e.message}</p>`;
        }
        console.log('✅ [WC] renderCategories done — DOM written');
    },

    _buildCategoryCard(cat) {
        return this._buildCategoryCardWithItems(cat, []);
    },

    _buildCategoryCardWithItems(cat, items) {
        const colors = {
            lime: 'border-lime-500/40 bg-lime-900/20',
            blue:   'border-blue-500/40 bg-blue-900/20',
            green:  'border-green-500/40 bg-green-900/20',
            red:    'border-red-500/40 bg-red-900/20',
            pink:   'border-pink-500/40 bg-pink-900/20',
        };
        const iconColors = {
            lime: 'text-lime-400', blue: 'text-blue-400',
            green:  'text-green-400',
            red:    'text-red-400',    pink:   'text-pink-400',
        };
        const clr = cat.color || 'lime';
        const itemsHtml = (items || []).map(item => {
            try { return this._buildItemCard(item); }
            catch(e) { console.error('❌ [WC] _buildItemCard error:', e); return ''; }
        }).join('');
        return `
        <div class="rounded-2xl border ${colors[clr] || colors.lime} p-5 space-y-4 backdrop-blur-sm" id="wc-cat-${cat.id}">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <i class="${cat.icon || 'fas fa-folder'} text-xl ${iconColors[clr] || iconColors.lime}"></i>
                    <h3 class="text-white font-bold text-lg">${this._esc(cat.name)}</h3>
                    ${(() => {
                        const shareMap = this._localGet('wc_shares_' + this.currentUser.id) || {};
                        const shareKey = 'category:' + cat.id;
                        const sharedWith = shareMap[shareKey] || [];
                        const isSharedFrom = cat.shared_from && cat.shared_from !== this.currentUser.id;
                        if (sharedWith.length > 0) {
                            return `<span class="text-xs bg-lime-500/20 text-lime-300 border border-lime-500/30 px-2 py-0.5 rounded-full flex items-center gap-1"><i class="fas fa-share-alt text-xs"></i>${sharedWith.length} نفر</span>`;
                        }
                        if (isSharedFrom) {
                            const allUsers = typeof HARDCODED_USERS !== 'undefined' ? HARDCODED_USERS : [];
                            const owner = allUsers.find(u => u.id === cat.shared_from);
                            return `<span class="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full flex items-center gap-1"><i class="fas fa-user-friends text-xs"></i>${owner ? owner.name : 'همکار'}</span>`;
                        }
                        return '';
                    })()}
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="WorkChecklistModule.showAddItemModal('${cat.id}')"
                            class="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1" title="افزودن آیتم">
                        <i class="fas fa-plus text-xs"></i> آیتم
                    </button>
                    <button onclick="WorkChecklistModule.showShareCategoryModal('${cat.id}')"
                            class="text-lime-400 hover:text-white p-1.5 rounded-lg hover:bg-lime-500/20 transition-all" title="اشتراک‌گذاری دسته‌بندی">
                        <i class="fas fa-share-alt text-sm"></i>
                    </button>
                    <button onclick="WorkChecklistModule.showEditCategoryModal('${cat.id}')"
                            class="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all" title="ویرایش">
                        <i class="fas fa-edit text-sm"></i>
                    </button>
                    <button onclick="WorkChecklistModule.confirmDeleteCategory('${cat.id}')"
                            class="text-red-400 hover:text-white p-1.5 rounded-lg hover:bg-red-500/20 transition-all" title="حذف دسته‌بندی">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </div>
            </div>
            ${cat.description ? `<p class="text-gray-400/70 text-sm">${this._esc(cat.description)}</p>` : ''}
            <div id="wc-items-${cat.id}" class="space-y-3 min-h-[40px]">
                ${items.length === 0
                    ? `<p class="text-gray-400/70 text-sm text-center py-2 italic">آیتمی وجود ندارد — یک آیتم اضافه کنید</p>`
                    : itemsHtml
                }
            </div>
        </div>`;
    },

    async renderItems(categoryId) {
        const container = document.getElementById('wc-items-' + categoryId);
        console.log('🔍 [WC] renderItems:', categoryId, '| container:', container ? 'FOUND' : 'NOT FOUND');
        if (!container) return;
        try {
            const items = await this.getItems(categoryId);
            console.log('🔍 [WC] renderItems got items:', items?.length, items);
            if (!items.length) {
                container.innerHTML = `<p class="text-black-300/50 text-sm text-center py-2 italic">آیتمی وجود ندارد — یک آیتم اضافه کنید</p>`;
                return;
            }
            container.innerHTML = items.map(item => this._buildItemCard(item)).join('');
        } catch(e) {
            console.error('❌ [WC] renderItems error:', e);
            container.innerHTML = `<p class="text-red-400 text-xs p-2">خطا: ${e.message}</p>`;
        }
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
                    <span class="bg-lime-500/20 text-lime-300 text-xs px-2 py-0.5 rounded-full" id="wc-item-count-${item.id}">...</span>
                    ${(() => {
                        const shareMap = this._localGet('wc_shares_' + this.currentUser.id) || {};
                        const sharedWith = shareMap['item:' + item.id] || [];
                        const isSharedFrom = item.shared_from && item.shared_from !== this.currentUser.id;
                        if (sharedWith.length > 0) return `<span class="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full"><i class="fas fa-share-alt text-xs ml-0.5"></i>${sharedWith.length}</span>`;
                        if (isSharedFrom) return `<span class="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full"><i class="fas fa-user-friends text-xs"></i></span>`;
                        return '';
                    })()}
                </div>
                <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                    <button onclick="WorkChecklistModule.showShareItemModal('${item.id}')"
                            class="text-blue-400 hover:text-white p-1 rounded hover:bg-blue-500/20 transition-all" title="اشتراک‌گذاری">
                        <i class="fas fa-share-alt text-xs"></i>
                    </button>
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
                    <i class="fas fa-spinner fa-spin text-xs text-lime-400"></i>
                </div>
                <div class="flex gap-2 mt-3">
                    <input type="text" id="wc-new-task-input-${item.id}"
                           placeholder="وظیفه جدید را بنویسید..."
                           onkeydown="if(event.key==='Enter') WorkChecklistModule.addTask('${item.id}')"
                           class="flex-1 bg-white/10 text-white placeholder-blue-300/50 text-sm px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-lime-500"/>
                    <button onclick="WorkChecklistModule.addTask('${item.id}')"
                            class="bg-lime-600 hover:bg-lime-700 text-white px-3 py-2 rounded-lg text-sm transition-all">
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
        // مرتب‌سازی بر اساس sort_order
        const sorted = [...tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        if (countBadge) {
            const done = sorted.filter(t => t.is_done).length;
            countBadge.textContent = done + '/' + sorted.length;
        }
        if (!sorted.length) {
            container.innerHTML = `<p class="text-black-300/50 text-sm italic py-1">هنوز وظیفه‌ای تعریف نشده</p>`;
            return;
        }
        container.innerHTML = sorted.map(t => this._buildTaskRow(t)).join('');
        this._initDragDrop(container, itemId);
    },

    _buildTaskRow(task) {
        const done = task.is_done;
        return `
        <div class="flex items-center gap-3 group py-1 px-2 rounded-lg hover:bg-white/5 transition-all wc-drag-item" id="wc-task-row-${task.id}" draggable="true" data-task-id="${task.id}">
            <span class="wc-drag-handle cursor-grab active:cursor-grabbing text-white/20 hover:text-white/60 flex-shrink-0 select-none" title="جابه‌جایی">
                <i class="fas fa-grip-vertical text-xs"></i>
            </span>
            <input type="checkbox" ${done ? 'checked' : ''}
                   onchange="WorkChecklistModule.toggleTask('${task.id}', this.checked)"
                   class="w-4 h-4 accent-lime-500 cursor-pointer flex-shrink-0"/>
            <span id="wc-task-text-${task.id}"
                  class="flex-1 text-sm ${done ? 'line-through text-black-300/50' : 'text-white'}">${this._esc(task.title)}</span>
            ${task.note ? `<i class="fas fa-sticky-note text-lime-400/60 text-xs" title="${this._esc(task.note)}"></i>` : ''}
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
        // خواندن category_id از آیتم مربوطه
        let catId = null;
        if (this.supabase) {
            const { data } = await this.supabase.from('checklist_items').select('category_id').eq('id', itemId).single();
            catId = data?.category_id || null;
        } else {
            const it = (this._localGet('wc_items_' + this.currentUser.id) || []).find(i => i.id === itemId);
            catId = it?.category_id || null;
        }
        const task = {
            id: this._uuid(),
            item_id: itemId,
            category_id: catId,
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
        const allTasks = await this.getTasks(task.item_id);
        const doneCount = allTasks.filter(t => t.is_done).length;
        if (badge) {
            badge.textContent = doneCount + '/' + allTasks.length;
        }
        // اگر همه وظایف کامل شدند، پس از یک لحظه ریست کن
        if (isDone && allTasks.length > 0 && doneCount === allTasks.length) {
            await this._resetItemTasks(task.item_id, allTasks);
        }
    },

    async _resetItemTasks(itemId, tasks) {
        // نمایش انیمیشن تکمیل
        const panel = document.getElementById('wc-tasks-list-' + itemId);
        if (panel) {
            panel.insertAdjacentHTML('beforeend', `
                <div id="wc-complete-anim-${itemId}" class="flex items-center justify-center gap-2 py-3 mt-2 bg-lime-500/20 rounded-xl border border-lime-500/30 text-lime-300 font-medium text-sm animate-pulse">
                    <i class="fas fa-check-circle text-lime-400 text-lg"></i>
                    آفرین! همه وظایف انجام شد — ریست می‌شود...
                </div>`);
        }
        // یک ثانیه صبر کن بعد ریست
        await new Promise(resolve => setTimeout(resolve, 1200));
        // همه وظایف را به حالت انجام‌نشده برگردان
        for (const t of tasks) {
            t.is_done = false;
            t.done_at = null;
            await this.saveTask(t);
        }
        // re-render لیست وظایف
        await this.renderTasks(itemId);
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
        const colors = ['lime','blue','green','lime','red','pink'];
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
                               class="w-full bg-white/10 text-white placeholder-blue-300/50 px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-lime-500"
                               placeholder="مثال: مدیریت دانشجو"/>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">توضیح (اختیاری)</label>
                        <input id="wc-cat-desc" value="${cat && cat.description ? this._esc(cat.description) : ''}"
                               class="w-full bg-white/10 text-white placeholder-blue-300/50 px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-lime-500"
                               placeholder="توضیح کوتاه..."/>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-2 block">رنگ</label>
                        <div class="flex gap-2">
                            ${colors.map(c => `
                            <label class="cursor-pointer">
                                <input type="radio" name="wc-cat-color" value="${c}" ${(!cat && c==='lime') || (cat && cat.color===c) ? 'checked' : ''} class="sr-only"/>
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
                                <div class="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-all border border-transparent hover:border-lime-500 wc-icon-btn"
                                     onclick="WorkChecklistModule._selectIcon('${ic}')">
                                    <i class="${ic} text-black-400"></i>
                                </div>
                            </label>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button onclick="WorkChecklistModule.saveCategoryFromModal('${cat ? cat.id : ''}')"
                            class="flex-1 bg-lime-600 hover:bg-lime-700 text-white py-2.5 rounded-xl font-medium transition-all">
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
                if (btn) btn.classList.add('border-lime-500', 'bg-lime-500/20');
            } else {
                if (btn) btn.classList.remove('border-lime-500', 'bg-lime-500/20');
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
            color: colorRadio ? colorRadio.value : 'lime',
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
                               class="w-full bg-white/10 text-white placeholder-blue-300/50 px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-lime-500"
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
                               class="w-full bg-white/10 text-white px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-lime-500"/>
                    </div>
                    <div>
                        <label class="text-black-400 text-sm mb-1 block">یادداشت</label>
                        <textarea id="wc-edit-task-note" rows="3"
                                  class="w-full bg-white/10 text-white px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-lime-500 resize-none"
                                  placeholder="یادداشت اضافی...">${task.note || ''}</textarea>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button onclick="WorkChecklistModule.saveEditedTask('${task.id}', '${task.item_id}')"
                            class="flex-1 bg-lime-600 hover:bg-lime-700 text-white py-2.5 rounded-xl font-medium transition-all">
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

    // ═══════════════════════════════════════════════════════════
    // ─── Share (به اشتراک‌گذاری) ─────────────────────────────────
    // ═══════════════════════════════════════════════════════════

    // دریافت لیست همه کاربران (مدیر + کارمندان) به جز خود کاربر فعلی
    _getShareableUsers() {
        const allUsers = typeof HARDCODED_USERS !== 'undefined' ? HARDCODED_USERS : [];
        return allUsers.filter(u =>
            u.active !== false &&
            u.id !== this.currentUser.id &&
            (u.role === 'manager' || u.role === 'employee')
        );
    },

    // ─── share یک دسته‌بندی ─────────────────────────────────────
    async showShareCategoryModal(catId) {
        const cats = await this.getCategories();
        const cat  = cats.find(c => c.id === catId);
        if (!cat) return;

        const users    = this._getShareableUsers();
        const existing = this._getShareRecord('category', catId);   // {sharedWith:[userId,...]}

        const html = `
        <div class="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4"
             id="wc-modal-overlay"
             onclick="if(event.target.id==='wc-modal-overlay') WorkChecklistModule.closeModal()">
          <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-white font-bold text-lg flex items-center gap-2">
                <i class="fas fa-share-alt text-lime-400"></i>
                اشتراک‌گذاری دسته‌بندی
              </h3>
              <button onclick="WorkChecklistModule.closeModal()" class="text-gray-400 hover:text-white">
                <i class="fas fa-times text-xl"></i>
              </button>
            </div>
            <p class="text-gray-400 text-sm mb-4">
              دسته‌بندی <span class="text-white font-medium">«${this._esc(cat.name)}»</span>
              را با چه کسی به اشتراک بگذاریم؟
            </p>
            <div class="space-y-2 max-h-56 overflow-y-auto mb-5">
              ${users.length === 0
                ? '<p class="text-gray-500 text-sm text-center py-4">کاربر دیگری یافت نشد</p>'
                : users.map(u => {
                    const isShared = existing.includes(u.id);
                    return `
                  <label class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-700 cursor-pointer transition-all">
                    <input type="checkbox" value="${u.id}" ${isShared ? 'checked' : ''}
                           class="w-4 h-4 accent-lime-500 wc-share-user-cb">
                    <div class="w-8 h-8 rounded-full bg-lime-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      ${u.name.charAt(0)}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-white text-sm font-medium">${this._esc(u.name)}</p>
                      <p class="text-gray-500 text-xs">${u.role === 'manager' ? 'مدیر' : 'کارمند'}</p>
                    </div>
                    ${isShared ? '<span class="text-xs text-lime-400"><i class="fas fa-check-circle"></i></span>' : ''}
                  </label>`;
                }).join('')}
            </div>
            <div class="flex gap-3">
              <button onclick="WorkChecklistModule._saveShareCategory('${catId}')"
                      class="flex-1 bg-lime-600 hover:bg-lime-700 text-white py-2.5 rounded-xl font-medium transition-all">
                <i class="fas fa-share-alt ml-2"></i>ذخیره اشتراک‌گذاری
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

    async _saveShareCategory(catId) {
        const checked = [...document.querySelectorAll('.wc-share-user-cb:checked')].map(cb => cb.value);
        const cats    = await this.getCategories();
        const cat     = cats.find(c => c.id === catId);
        if (!cat) return;

        const allItems = this._localGet('wc_items_' + this.currentUser.id) || [];
        const catItems = allItems.filter(i => i.category_id === catId);
        const allTasks = this._localGet('wc_tasks_' + this.currentUser.id) || [];

        checked.forEach(targetUserId => {
            // ثبت رکورد share برای دسته
            this._addShareRecord('category', catId, targetUserId, {
                ownerName: this.currentUser.name || this.currentUser.username,
                ownerId:   this.currentUser.id,
                catName:   cat.name,
                catIcon:   cat.icon,
                catColor:  cat.color,
            });

            // ۱) اول دسته کپی می‌شود تا id کپی برای آیتم‌ها استفاده شود
            //    (کپی باید id جدید داشته باشد تا ردیف Supabase سازنده بازنویسی نشود)
            const copiedCat = this._copyCategoryToUser(cat, targetUserId);

            // ۲) ثبت رکورد share برای همه آیتم‌های دسته
            catItems.forEach(item => {
                this._addShareRecord('item', item.id, targetUserId, {
                    ownerName:  this.currentUser.name || this.currentUser.username,
                    ownerId:    this.currentUser.id,
                    catId,
                    itemName:   item.name,
                    itemIcon:   item.icon,
                });
                // کپی آیتم با category_idِ جدید (id کپی دسته)
                const copiedItem = this._copyItemToUser(item, targetUserId, copiedCat.id);
                // کپی تسک‌های این آیتم با item_idِ جدید (id کپی آیتم)
                const itemTasks = allTasks.filter(t => t.item_id === item.id);
                itemTasks.forEach(t => this._copyTaskToUser(t, targetUserId, copiedItem.id, copiedItem.category_id));
            });
        });

        // حذف share از کسانی که unchecked شدند
        const allUsers  = this._getShareableUsers();
        const unchecked = allUsers.map(u => u.id).filter(uid => !checked.includes(uid));
        unchecked.forEach(targetUserId => {
            this._removeShareRecord('category', catId, targetUserId);
        });

        this.closeModal();
        this._showShareToast(checked.length > 0
            ? `دسته‌بندی با ${checked.length} نفر به اشتراک گذاشته شد`
            : 'اشتراک‌گذاری لغو شد');
        await this.renderCategories();
    },

    // ─── share یک آیتم ──────────────────────────────────────────
    async showShareItemModal(itemId) {
        const allItems = this._localGet('wc_items_' + this.currentUser.id) || [];
        const item     = allItems.find(i => i.id === itemId);
        if (!item) return;

        const users    = this._getShareableUsers();
        const existing = this._getShareRecord('item', itemId);

        const html = `
        <div class="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4"
             id="wc-modal-overlay"
             onclick="if(event.target.id==='wc-modal-overlay') WorkChecklistModule.closeModal()">
          <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-white font-bold text-lg flex items-center gap-2">
                <i class="fas fa-share-alt text-blue-400"></i>
                اشتراک‌گذاری آیتم
              </h3>
              <button onclick="WorkChecklistModule.closeModal()" class="text-gray-400 hover:text-white">
                <i class="fas fa-times text-xl"></i>
              </button>
            </div>
            <p class="text-gray-400 text-sm mb-4">
              آیتم <span class="text-white font-medium">«${this._esc(item.name)}»</span>
              را با چه کسی به اشتراک بگذاریم؟
            </p>
            <div class="space-y-2 max-h-56 overflow-y-auto mb-5">
              ${users.length === 0
                ? '<p class="text-gray-500 text-sm text-center py-4">کاربر دیگری یافت نشد</p>'
                : users.map(u => {
                    const isShared = existing.includes(u.id);
                    return `
                  <label class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-700 cursor-pointer transition-all">
                    <input type="checkbox" value="${u.id}" ${isShared ? 'checked' : ''}
                           class="w-4 h-4 accent-blue-500 wc-share-user-cb">
                    <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      ${u.name.charAt(0)}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-white text-sm font-medium">${this._esc(u.name)}</p>
                      <p class="text-gray-500 text-xs">${u.role === 'manager' ? 'مدیر' : 'کارمند'}</p>
                    </div>
                    ${isShared ? '<span class="text-xs text-blue-400"><i class="fas fa-check-circle"></i></span>' : ''}
                  </label>`;
                }).join('')}
            </div>
            <div class="flex gap-3">
              <button onclick="WorkChecklistModule._saveShareItem('${itemId}')"
                      class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-all">
                <i class="fas fa-share-alt ml-2"></i>ذخیره اشتراک‌گذاری
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

    async _saveShareItem(itemId) {
        const checked = [...document.querySelectorAll('.wc-share-user-cb:checked')].map(cb => cb.value);
        const allItems = this._localGet('wc_items_' + this.currentUser.id) || [];
        const item     = allItems.find(i => i.id === itemId);
        if (!item) return;
        const allTasks = this._localGet('wc_tasks_' + this.currentUser.id) || [];

        // پیدا کردن دسته مادر برای کپی
        const cats = await this.getCategories();
        const cat  = cats.find(c => c.id === item.category_id);

        checked.forEach(targetUserId => {
            this._addShareRecord('item', itemId, targetUserId, {
                ownerName: this.currentUser.name || this.currentUser.username,
                ownerId:   this.currentUser.id,
                itemName:  item.name,
                itemIcon:  item.icon,
                catId:     item.category_id,
            });
            // ۱) کپی دسته مادر (اگر وجود داشت) — id کپی برای آیتم لازم است
            const copiedCat = cat ? this._copyCategoryToUser(cat, targetUserId) : null;
            // ۲) کپی خود آیتم با category_idِ جدید
            const copiedItem = this._copyItemToUser(item, targetUserId, copiedCat ? copiedCat.id : null);
            // ۳) کپی تسک‌های این آیتم با item_idِ جدید
            const itemTasks = allTasks.filter(t => t.item_id === itemId);
            itemTasks.forEach(t => this._copyTaskToUser(t, targetUserId, copiedItem.id, copiedItem.category_id));
        });

        // حذف اشتراک از کسانی که unchecked شدند
        const allUsers  = this._getShareableUsers();
        const unchecked = allUsers.map(u => u.id).filter(uid => !checked.includes(uid));
        unchecked.forEach(uid => this._removeShareRecord('item', itemId, uid));

        this.closeModal();
        this._showShareToast(checked.length > 0
            ? `آیتم با ${checked.length} نفر به اشتراک گذاشته شد`
            : 'اشتراک‌گذاری لغو شد');
    },

    // ─── Share record helpers (localStorage + Supabase) ──────────
    // کلید: wc_shares_{ownerId}   → { 'category:catId': [userId,...], 'item:itemId': [...] }
    _getShareRecord(type, id) {
        const map = this._localGet('wc_shares_' + this.currentUser.id) || {};
        return map[type + ':' + id] || [];
    },

    _addShareRecord(type, id, targetUserId, meta) {
        // ── localStorage ──
        const map  = this._localGet('wc_shares_' + this.currentUser.id) || {};
        const key  = type + ':' + id;
        if (!map[key]) map[key] = [];
        if (!map[key].includes(targetUserId)) map[key].push(targetUserId);
        this._localSet('wc_shares_' + this.currentUser.id, map);

        // ── Supabase ──
        if (this.supabase) {
            this.supabase
                .from('checklist_shares')
                .upsert({
                    owner_id:   this.currentUser.id,
                    target_id:  targetUserId,
                    owner_name: this.currentUser.name || this.currentUser.username || 'همکار',
                    share_type: type,
                    ref_id:     id,
                    ref_name:   meta.catName || meta.itemName || id,
                    ref_icon:   meta.catIcon || meta.itemIcon || 'fas fa-share-alt',
                    ref_color:  meta.catColor || 'blue',
                }, { onConflict: 'owner_id,target_id,share_type,ref_id' })
                .then(({ error }) => {
                    if (error) console.warn('⚠️ [WC] share upsert error:', error.message);
                    else console.log('✅ [WC] share saved to Supabase');
                });
        }

        // ── inbox مخاطب (localStorage) ──
        const inbox = this._localGet('wc_inbox_' + targetUserId) || [];
        const exists = inbox.find(r => r.type === type && r.id === id && r.ownerId === this.currentUser.id);
        if (!exists) {
            inbox.push({
                type,
                id,
                ownerId:   this.currentUser.id,
                ownerName: meta.ownerName || 'همکار',
                name:      meta.catName || meta.itemName || id,
                icon:      meta.catIcon || meta.itemIcon || 'fas fa-share-alt',
                color:     meta.catColor || 'blue',
                sharedAt:  new Date().toISOString(),
            });
            this._localSet('wc_inbox_' + targetUserId, inbox);
        }
    },

    _removeShareRecord(type, id, targetUserId) {
        // ── localStorage مالک ──
        const map = this._localGet('wc_shares_' + this.currentUser.id) || {};
        const key = type + ':' + id;
        if (map[key]) {
            map[key] = map[key].filter(uid => uid !== targetUserId);
            if (map[key].length === 0) delete map[key];
            this._localSet('wc_shares_' + this.currentUser.id, map);
        }

        // ── Supabase ──
        if (this.supabase) {
            this.supabase
                .from('checklist_shares')
                .delete()
                .eq('owner_id',   this.currentUser.id)
                .eq('target_id',  targetUserId)
                .eq('share_type', type)
                .eq('ref_id',     id)
                .then(({ error }) => {
                    if (error) console.warn('⚠️ [WC] share delete error:', error.message);
                });
        }

        // ── inbox مخاطب ──
        const inbox = this._localGet('wc_inbox_' + targetUserId) || [];
        this._localSet('wc_inbox_' + targetUserId, inbox.filter(r => !(r.type === type && r.id === id && r.ownerId === this.currentUser.id)));
    },

    // sync shares دریافتی از Supabase برای کاربر فعلی
    async _syncInboxFromSupabase() {
        if (!this.supabase || !this.currentUser) return;
        try {
            // ── ۱. inbox: share‌هایی که به من ارسال شده ──────────────
            const { data: inboxData, error: inboxErr } = await this.supabase
                .from('checklist_shares')
                .select('*')
                .eq('target_id', this.currentUser.id);

            if (!inboxErr && inboxData) {
                const inbox = inboxData.map(row => ({
                    type:      row.share_type,
                    id:        row.ref_id,
                    ownerId:   row.owner_id,
                    ownerName: row.owner_name || 'همکار',
                    name:      row.ref_name   || row.ref_id,
                    icon:      row.ref_icon   || 'fas fa-share-alt',
                    color:     row.ref_color  || 'blue',
                    sharedAt:  row.created_at,
                }));
                this._localSet('wc_inbox_' + this.currentUser.id, inbox);
                console.log('✅ [WC] inbox synced from Supabase:', inbox.length);
            }

            // ── ۲. sent: share‌هایی که من ارسال کردم ────────────────
            const { data: sentData, error: sentErr } = await this.supabase
                .from('checklist_shares')
                .select('*')
                .eq('owner_id', this.currentUser.id);

            const shareMap = {};
            if (!sentErr && sentData && sentData.length > 0) {
                // ساخت shareMap از داده Supabase
                sentData.forEach(row => {
                    const key = row.share_type + ':' + row.ref_id;
                    if (!shareMap[key]) shareMap[key] = [];
                    if (!shareMap[key].includes(row.target_id)) {
                        shareMap[key].push(row.target_id);
                    }
                });
                // merge با localStorage (که ممکنه اطلاعات بیشتری داشته باشه)
                const localMap = this._localGet('wc_shares_' + this.currentUser.id) || {};
                Object.keys(shareMap).forEach(key => {
                    localMap[key] = shareMap[key];
                });
                this._localSet('wc_shares_' + this.currentUser.id, localMap);
                console.log('✅ [WC] sent shares synced from Supabase:', sentData.length);
            }

            // ── ۳. ترمیم رکوردهای خراب‌شده توسط باگ قدیمی اشتراک‌گذاری ──
            await this._reclaimHijackedShares(shareMap);

        } catch(e) {
            console.warn('⚠️ [WC] _syncInboxFromSupabase:', e.message);
        }
    },

    // ─── ترمیم باگ قدیمی اشتراک‌گذاری ────────────────────────────
    // قبلاً کپیِ share با همان id اصلی در Supabase ذخیره می‌شد؛ چون id کلید اصلی است،
    // ردیف اصلیِ سازنده بازنویسی می‌شد (user_id به مخاطب تغییر می‌کرد) و چک‌لیست از
    // صفحه سازنده پاک می‌شد. اینجا فقط رکوردهایی ترمیم می‌شوند که idشان در رکوردهای
    // share ما وجود دارد (یعنی خودِ ردیف اصلی) و مالکیتشان جابه‌جا شده است:
    // ردیف اصلی به سازنده برمی‌گردد و مخاطب کپی درست با id جدید می‌گیرد.
    // (کپی‌های سالم جدید هم shared_from=ما دارند ولی idشان در رکورد share نیست → دست‌نخورده)
    // (دسته‌ای که سازنده حذف کرده باشد ردیفی در Supabase ندارد → resurrect نمی‌شود)
    async _reclaimHijackedShares(shareMap) {
        if (!this.supabase || !this.currentUser) return;
        try {
            const me = this.currentUser.id;
            shareMap = shareMap || {};

            // id دسته‌های به‌اشتراک‌گذاشته (از رکوردهای share نوع category)
            const refIds = Object.keys(shareMap)
                .filter(k => k.startsWith('category:'))
                .map(k => k.split(':')[1]);

            // دستهٔ مادرِ آیتم‌های به‌اشتراک‌گذاشته — اگر خود آیتم hijack شده باشد
            const itemShareIds = Object.keys(shareMap)
                .filter(k => k.startsWith('item:'))
                .map(k => k.split(':')[1]);
            if (itemShareIds.length > 0) {
                const { data: hijItems } = await this.supabase
                    .from('checklist_items')
                    .select('id, category_id, user_id')
                    .in('id', itemShareIds)
                    .eq('shared_from', me);
                (hijItems || []).forEach(i => {
                    if (i.user_id !== me && i.category_id) refIds.push(i.category_id);
                });
            }

            for (const refId of [...new Set(refIds)]) {
                const { data: row } = await this.supabase
                    .from('checklist_categories')
                    .select('*')
                    .eq('id', refId)
                    .maybeSingle();
                // ردیف نیست → حذف شده توسط سازنده (resurrect نمی‌شود)
                // ردیف مال خودِ سازنده است → سالم است
                // shared_from ما نیست → ربطی به ما ندارد
                if (!row || row.user_id === me || row.shared_from !== me) continue;
                // آیتم‌ها و تسک‌های hijack شدهٔ این دسته
                const { data: hItems } = await this.supabase
                    .from('checklist_items').select('*')
                    .eq('category_id', refId).eq('shared_from', me);
                const items = hItems || [];
                const itemIds = items.map(i => i.id);
                let tasks = [];
                if (itemIds.length > 0) {
                    const { data: hTasks } = await this.supabase
                        .from('checklist_tasks').select('*')
                        .in('item_id', itemIds).eq('shared_from', me);
                    tasks = hTasks || [];
                }

                // ۱) برای هر مخاطب، کپی درست با id جدید بساز (توابع کپی idempotent هستند)
                const origCat = { ...row, user_id: me, shared_from: null };
                const targets = (shareMap['category:' + refId] && shareMap['category:' + refId].length > 0)
                    ? shareMap['category:' + refId]
                    : [row.user_id];
                for (const targetUserId of targets) {
                    const copiedCat = this._copyCategoryToUser(origCat, targetUserId);
                    for (const item of items) {
                        const copiedItem = this._copyItemToUser(item, targetUserId, copiedCat.id);
                        tasks.filter(t => t.item_id === item.id)
                             .forEach(t => this._copyTaskToUser(t, targetUserId, copiedItem.id, copiedCat.id));
                    }
                }

                // ۲) ردیف‌های اصلی را به سازنده برگردان
                await this.supabase.from('checklist_categories')
                    .upsert({ ...row, user_id: me, shared_from: null });
                if (items.length > 0) {
                    await this.supabase.from('checklist_items')
                        .upsert(items.map(i => ({ ...i, user_id: me, shared_from: null })));
                }
                if (tasks.length > 0) {
                    await this.supabase.from('checklist_tasks')
                        .upsert(tasks.map(t => ({ ...t, user_id: me, shared_from: null })));
                }
                console.log('✅ [WC] reclaimed hijacked checklist category:', refId);
            }
        } catch(e) {
            console.warn('⚠️ [WC] _reclaimHijackedShares:', e.message);
        }
    },

    // ─── کپی داده به localStorage و Supabase کاربر مقصد ─────────
    // ⚠️ نکته مهم: کپی باید «id جدید» داشته باشد؛ اگر کپی با همان id اصلی در
    // Supabase ذخیره شود، چون id کلید اصلی (PRIMARY KEY) است، ردیف اصلیِ سازنده
    // بازنویسی می‌شود (user_id به مخاطب تغییر می‌کند) و چک‌لیست از صفحه سازنده پاک می‌شود.
    // به همین دلیل کپی‌ها id جدید + فیلد original_id (فقط localStorage) می‌گیرند.
    _stripLocalOnly(obj) {
        if (!obj) return obj;
        const { original_id, ...rest } = obj;
        return rest;
    },

    // هنگام جایگزینی ردیف دیتابیس در کش محلی، نگاشت original_id (فقط محلی) حفظ شود
    _keepLocalMapping(dbRow, localRow) {
        if (localRow && localRow.original_id && !dbRow.original_id) {
            return { ...dbRow, original_id: localRow.original_id };
        }
        return dbRow;
    },

    _copyCategoryToUser(cat, targetUserId) {
        const key  = 'wc_categories_' + targetUserId;
        const list = this._localGet(key) || [];
        // کپی قبلیِ همین دسته از همین سازنده (کپی جدید با original_id یا کپی قدیمی با همان id)
        const idx  = list.findIndex(c =>
            c.shared_from === this.currentUser.id && (c.original_id === cat.id || c.id === cat.id));

        let copy;
        if (idx >= 0) {
            // به‌روزرسانی کپی موجود — هویت کپی (id) ثابت می‌ماند
            copy = { ...cat, ...list[idx], user_id: targetUserId, shared_from: this.currentUser.id };
            copy.name  = cat.name;
            copy.icon  = cat.icon;
            copy.color = cat.color;
            if (cat.description !== undefined) copy.description = cat.description;
            // کپی قدیمی (با id اصلی) → مهاجرت به id جدید + اصلاح ارجاع آیتم‌ها
            if (!copy.original_id && copy.id === cat.id) {
                copy.original_id = cat.id;
                copy.id = this._uuid();
                this._migrateLegacyCatRefs(cat.id, copy.id, targetUserId);
            }
            list[idx] = copy;
        } else {
            // کپی جدید با id جدید — ردیف جداگانه در Supabase برای مخاطب
            copy = { ...cat, id: this._uuid(), original_id: cat.id, user_id: targetUserId, shared_from: this.currentUser.id };
            list.push(copy);
        }
        this._localSet(key, list);

        if (this.supabase) {
            this.supabase.from('checklist_categories')
                .upsert(this._stripLocalOnly({ ...copy }))
                .then(({ error }) => { if (error) console.warn('⚠️ [WC] copy cat to supabase:', error.message); });
        }
        return copy;
    },

    _copyItemToUser(item, targetUserId, newCategoryId) {
        const key  = 'wc_items_' + targetUserId;
        const list = this._localGet(key) || [];
        const idx  = list.findIndex(i =>
            i.shared_from === this.currentUser.id && (i.original_id === item.id || i.id === item.id));

        let copy;
        if (idx >= 0) {
            copy = { ...item, ...list[idx], user_id: targetUserId, shared_from: this.currentUser.id };
            copy.name = item.name;
            copy.icon = item.icon;
            if (newCategoryId) copy.category_id = newCategoryId;
            if (!copy.original_id && copy.id === item.id) {
                copy.original_id = item.id;
                copy.id = this._uuid();
                this._migrateLegacyItemRefs(item.id, copy.id, targetUserId);
            }
            list[idx] = copy;
        } else {
            copy = { ...item, id: this._uuid(), original_id: item.id, user_id: targetUserId, shared_from: this.currentUser.id };
            if (newCategoryId) copy.category_id = newCategoryId;
            list.push(copy);
        }
        this._localSet(key, list);

        if (this.supabase) {
            this.supabase.from('checklist_items')
                .upsert(this._stripLocalOnly({ ...copy }))
                .then(({ error }) => { if (error) console.warn('⚠️ [WC] copy item to supabase:', error.message); });
        }
        return copy;
    },

    _copyTaskToUser(task, targetUserId, newItemId, newCategoryId) {
        const key  = 'wc_tasks_' + targetUserId;
        const list = this._localGet(key) || [];
        const idx  = list.findIndex(t =>
            t.shared_from === this.currentUser.id && (t.original_id === task.id || t.id === task.id));

        let copy;
        if (idx >= 0) {
            copy = { ...task, ...list[idx], user_id: targetUserId, shared_from: this.currentUser.id };
            // محتوا را تازه کن ولی پیشرفت مخاطب (is_done/done_at) حفظ شود
            copy.title      = task.title;
            copy.note       = task.note ?? '';
            copy.sort_order = task.sort_order ?? copy.sort_order ?? 0;
            if (newItemId)     copy.item_id     = newItemId;
            if (newCategoryId) copy.category_id = newCategoryId;
            if (!copy.original_id && copy.id === task.id) {
                copy.original_id = task.id;
                copy.id = this._uuid();
            }
            list[idx] = copy;
        } else {
            copy = { ...task, id: this._uuid(), original_id: task.id, user_id: targetUserId, shared_from: this.currentUser.id };
            if (newItemId)     copy.item_id     = newItemId;
            if (newCategoryId) copy.category_id = newCategoryId;
            list.push(copy);
        }
        this._localSet(key, list);

        if (this.supabase) {
            this.supabase.from('checklist_tasks')
                .upsert(this._stripLocalOnly({ ...copy }))
                .then(({ error }) => { if (error) console.warn('⚠️ [WC] copy task to supabase:', error.message); });
        }
        return copy;
    },

    // اصلاح ارجاع تسک‌های کپی‌شدهٔ قدیمی پس از مهاجرت id آیتم
    _migrateLegacyItemRefs(oldItemId, newItemId, targetUserId) {
        const tKey  = 'wc_tasks_' + targetUserId;
        const tasks = this._localGet(tKey) || [];
        let changed = false;
        tasks.forEach(t => {
            if (t.item_id !== oldItemId) return;
            // کپی قدیمی تسک → id جدید تا با تسک اصلی سازنده تداخل نکند
            if (t.shared_from === this.currentUser.id && !t.original_id) {
                t.original_id = t.id;
                t.id = this._uuid();
            }
            t.item_id = newItemId;
            changed = true;
        });
        if (changed) this._localSet(tKey, tasks);
    },

    // اصلاح ارجاع آیتم‌ها/تسک‌های کپی‌شدهٔ قدیمی پس از مهاجرت id دسته
    _migrateLegacyCatRefs(oldCatId, newCatId, targetUserId) {
        const iKey  = 'wc_items_' + targetUserId;
        const items = this._localGet(iKey) || [];
        let changed = false;
        items.forEach(it => {
            if (it.category_id !== oldCatId) return;
            // کپی قدیمی آیتم → id جدید + اصلاح تسک‌های وابسته
            if (it.shared_from === this.currentUser.id && !it.original_id) {
                const oldItemId = it.id;
                it.original_id = oldItemId;
                it.id = this._uuid();
                this._migrateLegacyItemRefs(oldItemId, it.id, targetUserId);
            }
            it.category_id = newCatId;
            changed = true;
        });
        if (changed) this._localSet(iKey, items);
    },

    // ─── Toast notification ───────────────────────────────────────
    _showShareToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-700 border border-lime-500/40 text-white px-6 py-3 rounded-xl shadow-2xl z-[9999] flex items-center gap-2 text-sm font-medium animate-fade-in';
        toast.innerHTML = `<i class="fas fa-check-circle text-lime-400"></i>${msg}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    // ─── Public content getter (for app.js) ───────────────────────
    getWorkChecklistContent() {
        return `
        <div id="work-checklist-root" class="min-h-[60vh]">
            <div class="flex items-center justify-center py-16">
                <i class="fas fa-spinner fa-spin text-3xl text-lime-400"></i>
            </div>
        </div>`;
    },
};

// Make accessible globally
window.WorkChecklistModule = WorkChecklistModule;
