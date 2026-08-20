// ============================================================
// js/supabase-data.js
// لایه داده Supabase — همان امضای API موجود DataModule
// هر تابع اول Supabase را امتحان می‌کند، در صورت خطا
// به localStorage fallback می‌کند.
// ============================================================

const SupabaseDataModule = {

    // ── کش ──────────────────────────────────────────────────
    _cache: {},
    _cacheTTL: 60_000, // 60 ثانیه

    _cacheGet(key) {
        const entry = this._cache[key];
        if (!entry) return null;
        if (Date.now() - entry.ts > this._cacheTTL) { delete this._cache[key]; return null; }
        return entry.data;
    },
    _cacheSet(key, data) {
        this._cache[key] = { data, ts: Date.now() };
    },
    _cacheInvalidate(key) {
        delete this._cache[key];
    },

    // ── db helper ────────────────────────────────────────────
    _db() { return getSupabaseClient(); },

    // _online: client آماده است، چه isOnline set شده باشد چه نه
    // این اصلاح ضروری است چون isOnline ممکن است هنوز false باشد
    // اما client از قبل ساخته شده و قابل استفاده است
    _online() { return !!(this._db()); },

    // ════════════════════════════════════════════════════════
    // USERS / PROFILES
    // ════════════════════════════════════════════════════════

    async getUsers() {
        if (!this._online()) return this._localGetUsers();
        const cached = this._cacheGet('users');
        if (cached) return cached;

        try {
            const { data, error } = await this._db()
                .from('profiles')
                .select('*')
                .order('created_at');

            if (error) throw error;
            const users = data.map(p => SupabaseAuth._normalizeProfile(p));
            this._cacheSet('users', users);
            // فقط وقتی Supabase داده دارد localStorage را overwrite کن
            if (users.length > 0) {
                localStorage.setItem('edu_system_users', JSON.stringify(users));
            }
            return users;
        } catch (e) {
            console.warn('⚠️ getUsers Supabase خطا، fallback:', e.message);
            return this._localGetUsers();
        }
    },

    async saveUsers(users) {
        // ذخیره محلی همیشه
        localStorage.setItem('edu_system_users', JSON.stringify(users));

        const client = this._db();
        if (!client) return true;

        try {
            const rows = users.map(u => {
                const profile = this._userToProfile(u);
                // null در student_id باعث duplicate key می‌شه — فقط مقدار واقعی بفرست
                if (!profile.student_id) delete profile.student_id;
                return profile;
            });
            const { error } = await client
                .from('profiles')
                .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
            if (error) {
                console.warn('⚠️ saveUsers خطا:', error.message, error.code);
                if (error.code === '42501' || error.message.includes('policy')) {
                    console.error('🔒 RLS مشکل دارد! supabase/fix_rls_anon.sql را اجرا کن');
                }
                return false;
            }
            this._cacheInvalidate('users');
            return true;
        } catch (e) {
            console.warn('⚠️ saveUsers خطا:', e.message);
            return false;
        }
    },

    async getUserById(id) {
        if (!this._online()) {
            const users = this._localGetUsers();
            return users.find(u => u.id === id) || null;
        }
        try {
            const { data, error } = await this._db()
                .from('profiles').select('*').eq('id', id).single();
            if (error) throw error;
            return SupabaseAuth._normalizeProfile(data);
        } catch (e) {
            const users = this._localGetUsers();
            return users.find(u => u.id === id) || null;
        }
    },

    // ════════════════════════════════════════════════════════
    // EMP ACC ACCESS — دسترسی کارمند به صفحه حسابداری کارمندان
    // از جدول app_settings (key-value) استفاده می‌کند
    // ════════════════════════════════════════════════════════

    async getEmpAccAllowedIds() {
        const localKey = 'empAccAllowedIds';
        const localIds = JSON.parse(localStorage.getItem(localKey) || '[]');

        if (!this._online()) return localIds;
        try {
            const { data, error } = await this._db()
                .from('app_settings')
                .select('value')
                .eq('key', 'empAccAllowedIds')
                .single();

            if (error) {
                // جدول وجود ندارد — fallback به localStorage
                if (error.code === 'PGRST116' || error.code === '42P01') {
                    console.warn('⚠️ app_settings table missing — run app_settings_migration.sql');
                }
                return localIds;
            }

            const ids = Array.isArray(data?.value) ? data.value : [];
            // merge با local در صورت تفاوت
            const merged = [...new Set([...ids, ...localIds])];
            localStorage.setItem(localKey, JSON.stringify(merged));
            return merged;
        } catch (e) {
            console.warn('⚠️ getEmpAccAllowedIds خطا:', e.message);
            return localIds;
        }
    },

    async setEmpAccAccess(employeeId, granted) {
        const localKey = 'empAccAllowedIds';
        // آپدیت localStorage
        const ids = JSON.parse(localStorage.getItem(localKey) || '[]');
        if (granted && !ids.includes(employeeId)) {
            ids.push(employeeId);
        } else if (!granted) {
            const idx = ids.indexOf(employeeId);
            if (idx !== -1) ids.splice(idx, 1);
        }
        localStorage.setItem(localKey, JSON.stringify(ids));

        if (!this._online()) return true;
        try {
            const { error } = await this._db()
                .from('app_settings')
                .upsert(
                    { key: 'empAccAllowedIds', value: ids, updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                );
            if (error) {
                if (error.code === '42P01') {
                    console.warn('⚠️ app_settings table missing — run app_settings_migration.sql');
                } else {
                    console.warn('⚠️ setEmpAccAccess خطا:', error.message);
                }
                return false;
            }
            console.log(`✅ empAccAllowedIds=[${ids}] در Supabase ذخیره شد`);
            return true;
        } catch (e) {
            console.warn('⚠️ setEmpAccAccess خطا:', e.message);
            return false;
        }
    },

    // ════════════════════════════════════════════════════════
    // ORDERS
    // ════════════════════════════════════════════════════════

    async getOrders() {
        if (!this._online()) return this._localGetOrders();
        const cached = this._cacheGet('orders');
        if (cached) return cached;

        try {
            const { data, error } = await this._db()
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            const orders = data.map(r => this._dbToOrder(r));
            this._cacheSet('orders', orders);
            // فقط وقتی Supabase داده دارد localStorage را overwrite کن
            // در غیر این صورت داده‌های محلی از بین می‌روند
            if (orders.length > 0) {
                localStorage.setItem('edu_system_orders', JSON.stringify(orders));
            }
            return orders;
        } catch (e) {
            console.warn('⚠️ getOrders Supabase خطا، fallback:', e.message);
            return this._localGetOrders();
        }
    },

    async saveOrders(orders) {
        localStorage.setItem('edu_system_orders', JSON.stringify(orders));

        // به‌جای isOnline، مستقیم client رو چک می‌کنیم
        const client = this._db();
        if (!client) {
            console.warn('⚠️ saveOrders: Supabase client آماده نیست');
            return true; // localStorage OK بود
        }

        try {
            const rows = orders.map(o => this._orderToDb(o));
            const { error } = await client
                .from('orders')
                .upsert(rows, { onConflict: 'id' });
            if (error) {
                console.warn('⚠️ saveOrders upsert خطا:', error.message, error.code);
                if (error.code === '42501' || error.message.includes('policy')) {
                    console.error('🔒 RLS مشکل دارد! supabase/fix_rls_anon.sql را اجرا کن');
                }
                return false;
            }
            this._cacheInvalidate('orders');
            console.log(`✅ saveOrders: ${rows.length} سفارش در Supabase ذخیره شد`);
            return true;
        } catch (e) {
            console.warn('⚠️ saveOrders خطا:', e.message);
            return false;
        }
    },

    async saveOrder(order) {
        const orders = await this.getOrders();
        const idx = orders.findIndex(o => o.id === order.id);
        if (idx >= 0) orders[idx] = order; else orders.unshift(order);
        return this.saveOrders(orders);
    },

    async deleteOrder(orderId) {
        // حذف محلی
        const orders = this._localGetOrders().filter(o => o.id !== orderId);
        localStorage.setItem('edu_system_orders', JSON.stringify(orders));
        this._cacheInvalidate('orders');

        if (!this._online()) return true;
        try {
            const { error } = await this._db().from('orders').delete().eq('id', orderId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ deleteOrder خطا:', e.message);
            return false;
        }
    },

    // ════════════════════════════════════════════════════════
    // STUDENT PROGRESS
    // ════════════════════════════════════════════════════════

    async getStudentProgress(studentId, pathType) {
        const localKey = `prog_${studentId}_${pathType}`;
        if (!this._online()) {
            const raw = localStorage.getItem(localKey);
            return raw ? JSON.parse(raw) : [];
        }

        try {
            const { data, error } = await this._db()
                .from('student_progress')
                .select('step_index, status')
                .eq('student_id', studentId)
                .eq('path_type', pathType)
                .order('step_index');

            if (error) throw error;
            // تبدیل به فرمت آرایه‌ای که کد قدیمی انتظار دارد
            if (data.length === 0) {
                const local = localStorage.getItem(localKey);
                return local ? JSON.parse(local) : [];
            }
            const maxIdx = Math.max(...data.map(r => r.step_index));
            const arr = Array(maxIdx + 1).fill(null).map((_, i) => {
                const row = data.find(r => r.step_index === i);
                return { status: row ? row.status : 0 };
            });
            localStorage.setItem(localKey, JSON.stringify(arr));
            return arr;
        } catch (e) {
            console.warn('⚠️ getStudentProgress خطا:', e.message);
            const raw = localStorage.getItem(localKey);
            return raw ? JSON.parse(raw) : [];
        }
    },

    async saveStudentProgress(studentId, pathType, progressArray) {
        const localKey = `prog_${studentId}_${pathType}`;
        localStorage.setItem(localKey, JSON.stringify(progressArray));

        const client = this._db();
        if (!client) return true;

        try {
            const rows = progressArray.map((item, idx) => ({
                student_id: this._toUUID(studentId),
                path_type:  pathType,
                step_index: idx,
                status:     item ? item.status : 0,
                updated_at: new Date().toISOString()
            }));
            const { error } = await client
                .from('student_progress')
                .upsert(rows, { onConflict: 'student_id,path_type,step_index' });
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ saveStudentProgress خطا:', e.message);
            return false;
        }
    },

    // ════════════════════════════════════════════════════════
    // EMPLOYEE TASKS
    // ════════════════════════════════════════════════════════

    async getEmployeeTasks(employeeId) {
        if (!this._online()) return this._localGetEmployeeTasks(employeeId);
        try {
            const { data, error } = await this._db()
                .from('employee_tasks')
                .select('*')
                .eq('assigned_to', employeeId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            const tasks = data.map(r => this._dbToTask(r));
            // همگام‌سازی محلی
            const all = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
            all[employeeId] = tasks;
            localStorage.setItem('employee_tasks', JSON.stringify(all));
            return tasks;
        } catch (e) {
            console.warn('⚠️ getEmployeeTasks خطا:', e.message);
            return this._localGetEmployeeTasks(employeeId);
        }
    },

    async saveEmployeeTask(employeeId, task) {
        // ذخیره محلی
        const all = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        if (!all[employeeId]) all[employeeId] = [];
        const idx = all[employeeId].findIndex(t => t.id === task.id);
        if (idx >= 0) all[employeeId][idx] = task; else all[employeeId].unshift(task);
        localStorage.setItem('employee_tasks', JSON.stringify(all));

        if (!this._online()) return true;
        try {
            const row = this._taskToDb(task, employeeId);
            const { error } = await this._db()
                .from('employee_tasks')
                .upsert(row, { onConflict: 'id' });
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ saveEmployeeTask خطا:', e.message);
            return false;
        }
    },

    async updateTaskStatus(taskId, employeeId, newStatus) {
        // محلی
        const all = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        const tasks = all[employeeId] || [];
        const t = tasks.find(t => t.id === taskId);
        if (t) { t.status = newStatus; t.updatedAt = new Date().toISOString(); }
        localStorage.setItem('employee_tasks', JSON.stringify(all));

        if (!this._online()) return true;
        try {
            const { error } = await this._db()
                .from('employee_tasks')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', taskId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ updateTaskStatus خطا:', e.message);
            return false;
        }
    },

    // ════════════════════════════════════════════════════════
    // WORK HOURS
    // ════════════════════════════════════════════════════════

    async getWorkHours() {
        if (!this._online()) {
            const raw = localStorage.getItem('work_hours_data');
            return raw ? JSON.parse(raw) : [];
        }
        try {
            const { data, error } = await this._db()
                .from('work_hours')
                .select('*')
                .order('date', { ascending: false });
            if (error) throw error;
            const entries = data.map(r => this._dbToWorkHour(r));
            localStorage.setItem('work_hours_data', JSON.stringify(entries));
            return entries;
        } catch (e) {
            const raw = localStorage.getItem('work_hours_data');
            return raw ? JSON.parse(raw) : [];
        }
    },

    async saveWorkHour(entry) {
        const all = JSON.parse(localStorage.getItem('work_hours_data') || '[]');
        const idx = all.findIndex(e => e.id === entry.id);
        if (idx >= 0) all[idx] = entry; else all.unshift(entry);
        localStorage.setItem('work_hours_data', JSON.stringify(all));

        if (!this._online()) return true;
        try {
            const row = this._workHourToDb(entry);
            const { error } = await this._db()
                .from('work_hours')
                .upsert(row, { onConflict: 'id' });
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ saveWorkHour خطا:', e.message);
            return false;
        }
    },

    async deleteWorkHour(id) {
        // حذف از localStorage
        const all = JSON.parse(localStorage.getItem('work_hours_data') || '[]');
        const filtered = all.filter(e => e.id !== id);
        localStorage.setItem('work_hours_data', JSON.stringify(filtered));

        if (!this._online()) return true;
        try {
            const { error } = await this._db()
                .from('work_hours')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ deleteWorkHour خطا:', e.message);
            return false;
        }
    },

    // ════════════════════════════════════════════════════════
    // MESSAGES
    // ════════════════════════════════════════════════════════

    async getMessages(userId) {
        if (!this._online()) {
            const raw = localStorage.getItem('messages');
            const all = raw ? JSON.parse(raw) : [];
            return all.filter(m => m.senderId === userId || m.receiverId === userId);
        }
        try {
            const { data, error } = await this._db()
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at');
            if (error) throw error;
            return data.map(r => this._dbToMessage(r));
        } catch (e) {
            const raw = localStorage.getItem('messages');
            const all = raw ? JSON.parse(raw) : [];
            return all.filter(m => m.senderId === userId || m.receiverId === userId);
        }
    },

    async sendMessage(message) {
        // ذخیره محلی
        const all = JSON.parse(localStorage.getItem('messages') || '[]');
        all.push(message);
        localStorage.setItem('messages', JSON.stringify(all));

        if (!this._online()) return true;
        try {
            const { error } = await this._db()
                .from('messages')
                .insert(this._messageToDb(message));
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ sendMessage خطا:', e.message);
            return false;
        }
    },

    // ════════════════════════════════════════════════════════
    // ACCOUNTING TRANSACTIONS
    // ════════════════════════════════════════════════════════

    async getAccountingTransactions(orderId) {
        if (!this._online()) return [];
        try {
            let query = this._db().from('accounting_transactions').select('*');
            if (orderId) query = query.eq('order_id', orderId);
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('⚠️ getAccountingTransactions خطا:', e.message);
            return [];
        }
    },

    async saveAccountingTransaction(tx) {
        // IMPORTANT: agent_share و manager_share توسط DB trigger calculate_revenue_share
        // به صورت خودکار محاسبه می‌شوند. این مقادیر را در JS محاسبه نکن و
        // در tx قرار نده — DB آن‌ها را خودش پر می‌کند.
        if (!this._online()) return false;
        try {
            const row = {
                id:          tx.id          || undefined,
                order_id:    tx.orderId     || tx.order_id    || null,
                type:        tx.type,       // payment/refund/expense/income/agent_payment
                amount:      parseFloat(tx.amount) || 0,
                currency:    tx.currency    || 'تومان',
                description: tx.description || null,
                // agent_id ذخیره می‌شود ولی FK نیست — created_by رو فقط اگر UUID معتبر باشه می‌فرستیم
                agent_id:    tx.agentId     || tx.agent_id    || null,
                created_by:  this._isUUID(tx.createdBy || tx.created_by)
                             ? (tx.createdBy || tx.created_by)
                             : null,
                // agent_share و manager_share: توسط trigger پر می‌شوند — اینجا نمی‌فرستیم
            };
            const { error } = await this._db()
                .from('accounting_transactions')
                .upsert(row, { onConflict: 'id' });
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ saveAccountingTransaction خطا:', e.message);
            return false;
        }
    },

    // بررسی فرمت UUID
    _isUUID(val) {
        if (!val) return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    },

    // ════════════════════════════════════════════════════════
    // NOTIFICATIONS
    // ════════════════════════════════════════════════════════

    async getNotifications(userId) {
        if (!this._online()) return [];
        try {
            const { data, error } = await this._db()
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            return data;
        } catch (e) { return []; }
    },

    async markNotificationRead(notifId) {
        if (!this._online()) return false;
        try {
            const { error } = await this._db()
                .from('notifications')
                .update({ read: true })
                .eq('id', notifId);
            if (error) throw error;
            return true;
        } catch (e) { return false; }
    },

    // ════════════════════════════════════════════════════════
    // ORDER TYPES — کاتالوگ انواع سفارش (جدید v2)
    // ════════════════════════════════════════════════════════

    async getOrderTypes() {
        if (!this._online()) {
            const cached = localStorage.getItem('order_types_cache');
            return cached ? JSON.parse(cached) : [];
        }
        const cached = this._cacheGet('order_types');
        if (cached) return cached;
        try {
            const { data, error } = await this._db()
                .from('order_types').select('*').eq('active', true)
                .order('category').order('name');
            if (error) throw error;
            const rows = data.map(r => ({
                id: r.id, code: r.code, name: r.name, category: r.category || '',
                priceBachelor: parseFloat(r.price_bachelor) || 0,
                priceMasters:  parseFloat(r.price_masters)  || 0,
                pricePhd:      parseFloat(r.price_phd)      || 0,
                active: r.active
            }));
            this._cacheSet('order_types', rows);
            localStorage.setItem('order_types_cache', JSON.stringify(rows));
            return rows;
        } catch (e) {
            console.warn('⚠️ getOrderTypes خطا:', e.message);
            const c2 = localStorage.getItem('order_types_cache');
            return c2 ? JSON.parse(c2) : [];
        }
    },

    // ════════════════════════════════════════════════════════
    // STEP ASSIGNMENTS — تخصیص سراسری مراحل (جدید v2)
    // ════════════════════════════════════════════════════════

    async getStepAssignments() {
        if (!this._online()) return [];
        try {
            const { data, error } = await this._db()
                .from('step_assignments').select('*')
                .order('path_type').order('step_index');
            if (error) throw error;
            return data.map(r => ({
                id: r.id, pathType: r.path_type,
                stepIndex: r.step_index, employeeId: r.employee_id || null
            }));
        } catch (e) { console.warn('⚠️ getStepAssignments خطا:', e.message); return []; }
    },

    async saveStepAssignment(pathType, stepIndex, employeeId) {
        if (!this._online()) return false;
        const validPaths = ['defense', 'requirements', 'educational'];
        if (!validPaths.includes(pathType)) {
            console.error('saveStepAssignment: path_type نامعتبر:', pathType);
            return false;
        }
        try {
            const { error } = await this._db().from('step_assignments').upsert({
                path_type: pathType, step_index: stepIndex,
                employee_id: employeeId || null, updated_at: new Date().toISOString()
            }, { onConflict: 'path_type,step_index' });
            if (error) throw error;
            return true;
        } catch (e) { console.warn('⚠️ saveStepAssignment خطا:', e.message); return false; }
    },

    // ════════════════════════════════════════════════════════
    // ARCHIVE FILES — آرشیو فایل‌ها
    // ════════════════════════════════════════════════════════

    async getArchiveFiles(category = null) {
        const LOCAL_KEY = 'archiveFiles';
        if (!this._online()) {
            const raw = localStorage.getItem(LOCAL_KEY);
            const all = raw ? JSON.parse(raw) : [];
            return category ? all.filter(f => f.category === category) : all;
        }
        try {
            let query = this._db()
                .from('archived_files')
                .select('*')
                .order('created_at', { ascending: false });
            if (category) query = query.eq('category', category);
            const { data, error } = await query;
            if (error) throw error;
            const files = data.map(r => this._dbToArchiveFile(r));
            // به‌روزرسانی کامل cache
            if (!category) {
                localStorage.setItem(LOCAL_KEY, JSON.stringify(files));
            } else {
                const existing = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
                files.forEach(f => {
                    const idx = existing.findIndex(e => e.id === f.id);
                    if (idx >= 0) existing[idx] = f; else existing.push(f);
                });
                localStorage.setItem(LOCAL_KEY, JSON.stringify(existing));
            }
            return files;
        } catch (e) {
            console.warn('⚠️ getArchiveFiles خطا:', e.message);
            const raw = localStorage.getItem(LOCAL_KEY);
            const all = raw ? JSON.parse(raw) : [];
            return category ? all.filter(f => f.category === category) : all;
        }
    },

    async saveArchiveFile(fileRecord) {
        // ۱. localStorage همیشه
        const LOCAL_KEY = 'archiveFiles';
        const existing = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
        const idx = existing.findIndex(f => f.id === fileRecord.id);
        if (idx >= 0) existing[idx] = fileRecord; else existing.unshift(fileRecord);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(existing));

        if (!this._online()) return { id: fileRecord.id };
        try {
            const row = this._archiveFileToDb(fileRecord);
            const { data, error } = await this._db()
                .from('archived_files')
                .upsert(row, { onConflict: 'id' })
                .select('id')
                .single();
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('⚠️ saveArchiveFile خطا:', e.message);
            return null;
        }
    },

    async deleteArchiveFile(fileId, storagePath) {
        // ۱. localStorage
        const LOCAL_KEY = 'archiveFiles';
        const existing = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
        localStorage.setItem(LOCAL_KEY, JSON.stringify(existing.filter(f => f.id !== fileId)));

        if (!this._online()) return true;
        try {
            // حذف از Storage اگر path داشت
            if (storagePath && storagePath !== '#' && !storagePath.startsWith('blob:')) {
                // استخراج filename از URL
                const filename = storagePath.split('/').pop().split('?')[0];
                if (filename) {
                    await this._db().storage.from('archive-files').remove([filename]);
                }
            }
            // حذف رکورد از جدول
            const { error } = await this._db()
                .from('archived_files')
                .delete()
                .eq('id', fileId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ deleteArchiveFile خطا:', e.message);
            return false;
        }
    },

    // آپلود فایل واقعی به Supabase Storage bucket: archive-files
    async uploadArchiveFileToStorage(file, fileId) {
        if (!this._online()) return null;
        try {
            const ext = file.name.split('.').pop();
            const path = `${fileId}.${ext}`;
            const { data, error } = await this._db()
                .storage
                .from('archive-files')
                .upload(path, file, { upsert: true, contentType: file.type });
            if (error) throw error;
            const { data: urlData } = this._db()
                .storage
                .from('archive-files')
                .getPublicUrl(data.path);
            return { url: urlData?.publicUrl || null, path: data.path };
        } catch (e) {
            console.warn('⚠️ uploadArchiveFileToStorage خطا:', e.message);
            return null;
        }
    },

    // ── archive transformers ─────────────────────────────
    _archiveFileToDb(f) {
        return {
            id:             f.id,
            file_name:      f.name,
            file_path:      f.storagePath || f.url || f.name,
            file_size:      this._parseSizeToBytes(f.size),
            category:       f.category     || null,
            author:         f.author       || null,
            file_type:      f.type         || null,
            display_url:    f.url          || null,
            file_size_text: f.size         || null,
            student_id:     f.studentId    || null,
            order_id:       f.orderId      || null,
            uploaded_by:    f.uploadedById || null
        };
    },

    _dbToArchiveFile(r) {
        return {
            id:           r.id,
            name:         r.file_name,
            category:     r.category      || 'other',
            author:       r.author        || '',
            type:         r.file_type     || (r.file_name || '').split('.').pop().toLowerCase(),
            size:         r.file_size_text || (r.file_size ? Math.round(r.file_size / 1024) + ' KB' : ''),
            url:          r.display_url   || r.file_path || '#',
            storagePath:  r.file_path,
            uploadDate:   r.created_at,
            studentId:    r.student_id    || null,
            orderId:      r.order_id      || null,
            uploadedById: r.uploaded_by   || null
        };
    },

    _parseSizeToBytes(sizeText) {
        if (!sizeText) return null;
        const match = String(sizeText).match(/([\d.]+)\s*(bytes|kb|mb|gb)/i);
        if (!match) return null;
        const val = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        const map = { bytes: 1, kb: 1024, mb: 1048576, gb: 1073741824 };
        return Math.round(val * (map[unit] || 1));
    },

    // ════════════════════════════════════════════════════════
    // REALTIME SUBSCRIPTIONS
    // ════════════════════════════════════════════════════════

    _channels: {},

    subscribeToOrders(callback) {
        if (!this._online()) return;
        const channel = this._db()
            .channel('orders-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                (payload) => {
                    this._cacheInvalidate('orders');
                    callback(payload);
                })
            .subscribe();
        this._channels['orders'] = channel;
    },

    subscribeToMessages(userId, callback) {
        if (!this._online()) return;
        const channel = this._db()
            .channel(`messages-${userId}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages',
                  filter: `receiver_id=eq.${userId}` },
                callback)
            .subscribe();
        this._channels[`messages-${userId}`] = channel;
    },

    unsubscribeAll() {
        const client = this._db();
        if (!client) return;
        Object.values(this._channels).forEach(ch => client.removeChannel(ch));
        this._channels = {};
    },

    // ════════════════════════════════════════════════════════
    // MANAGEMENT CHAT — گفتگوی گروهی مدیریت
    // جدول: management_messages + management_message_reads
    // Storage bucket: management-chat-files
    // ════════════════════════════════════════════════════════

    // بارگذاری پیام‌ها (۱۰۰ پیام آخر)
    async getManagementMessages(limit = 100) {
        const LOCAL_KEY = 'mgmt_chat_messages';
        if (!this._online()) {
            const raw = localStorage.getItem(LOCAL_KEY);
            return raw ? JSON.parse(raw) : [];
        }
        try {
            const { data, error } = await this._db()
                .from('management_messages')
                .select('*')
                .eq('deleted', false)
                .order('created_at', { ascending: true })
                .limit(limit);
            if (error) {
                if (error.code === '42P01' || error.message?.includes('does not exist')) {
                    console.error('❌ جدول management_messages وجود ندارد! فایل supabase/management_chat_migration.sql را در Supabase اجرا کنید.');
                }
                throw error;
            }
            const msgs = data.map(r => this._dbToMgmtMsg(r));
            localStorage.setItem(LOCAL_KEY, JSON.stringify(msgs));
            return msgs;
        } catch (e) {
            console.warn('⚠️ getManagementMessages خطا:', e.message);
            const raw = localStorage.getItem(LOCAL_KEY);
            return raw ? JSON.parse(raw) : [];
        }
    },

    // ارسال پیام متنی
    async sendManagementMessage(msg) {
        // ذخیره محلی اول
        const LOCAL_KEY = 'mgmt_chat_messages';
        const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
        const localMsg = { ...msg, _pending: true };
        local.push(localMsg);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(local));

        if (!this._online()) return { id: msg.id, _offline: true };
        try {
            const row = this._mgmtMsgToDb(msg);
            const { data, error } = await this._db()
                .from('management_messages')
                .insert([row])
                .select('id')
                .single();
            if (error) {
                // جدول هنوز ساخته نشده
                if (error.code === '42P01' || error.message?.includes('does not exist')) {
                    console.error('❌ جدول management_messages وجود ندارد! فایل supabase/management_chat_migration.sql را در Supabase اجرا کنید.');
                }
                throw error;
            }
            // حذف pending از local و جایگزین با ID واقعی
            const updated = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
            const idx = updated.findIndex(m => m.id === msg.id);
            if (idx >= 0) { updated[idx]._pending = false; updated[idx].id = data.id; }
            localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
            return data;
        } catch (e) {
            console.warn('⚠️ sendManagementMessage خطا:', e.message);
            return null;
        }
    },

    // آپلود فایل (تصویر، PDF، صوت) به Storage
    async uploadManagementChatFile(file, msgId) {
        if (!this._online()) return null;
        try {
            const ext  = file.name.split('.').pop().toLowerCase();
            const path = `${msgId}.${ext}`;
            const { data, error } = await this._db()
                .storage
                .from('management-chat-files')
                .upload(path, file, { upsert: true, contentType: file.type });
            if (error) throw error;
            const { data: urlData } = this._db()
                .storage
                .from('management-chat-files')
                .getPublicUrl(data.path);
            return { url: urlData?.publicUrl || null, path: data.path };
        } catch (e) {
            console.warn('⚠️ uploadManagementChatFile خطا:', e.message);
            return null;
        }
    },

    // ارسال پیام فایل/تصویر/صوت
    async sendManagementFileMessage(file, sender) {
        const msgId = 'mgmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const ext   = file.name.split('.').pop().toLowerCase();
        const isVoice = file.type.startsWith('audio/');
        const isImage = file.type.startsWith('image/');
        const msgType = isVoice ? 'voice' : (isImage ? 'image' : 'file');

        // آپلود به Storage
        let fileUrl  = null;
        let filePath = null;
        const uploaded = await this.uploadManagementChatFile(file, msgId);
        if (uploaded) { fileUrl = uploaded.url; filePath = uploaded.path; }

        const msg = {
            id:          msgId,
            senderId:    sender.id,
            senderName:  sender.name,
            senderRole:  sender.role,
            msgType,
            content:     file.name,
            fileUrl,
            filePath,
            fileName:    file.name,
            fileType:    file.type,
            fileSize:    file.size,
            mentions:    [],
            createdAt:   new Date().toISOString()
        };
        return this.sendManagementMessage(msg);
    },

    // ویرایش پیام
    async editManagementMessage(msgId, newContent) {
        // محلی
        const LOCAL_KEY = 'mgmt_chat_messages';
        const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
        const idx = local.findIndex(m => m.id === msgId);
        if (idx >= 0) {
            local[idx].content  = newContent;
            local[idx].edited   = true;
            local[idx].editedAt = new Date().toISOString();
            localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
        }

        if (!this._online()) return true;
        try {
            const { error } = await this._db()
                .from('management_messages')
                .update({ content: newContent, edited: true, edited_at: new Date().toISOString() })
                .eq('id', msgId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ editManagementMessage خطا:', e.message);
            return false;
        }
    },

    // حذف منطقی پیام
    async deleteManagementMessage(msgId) {
        // محلی
        const LOCAL_KEY = 'mgmt_chat_messages';
        const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
        const updated = local.filter(m => m.id !== msgId);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));

        if (!this._online()) return true;
        try {
            const { error } = await this._db()
                .from('management_messages')
                .update({ deleted: true })
                .eq('id', msgId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ deleteManagementMessage خطا:', e.message);
            return false;
        }
    },

    // ثبت خوانده شدن پیام‌ها توسط کاربر
    async markManagementMessagesRead(userId, messageIds) {
        if (!this._online() || !messageIds.length) return true;
        try {
            const rows = messageIds.map(mid => ({
                message_id: mid,
                user_id:    userId,
                read_at:    new Date().toISOString()
            }));
            const { error } = await this._db()
                .from('management_message_reads')
                .upsert(rows, { onConflict: 'message_id,user_id', ignoreDuplicates: true });
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ markManagementMessagesRead خطا:', e.message);
            return false;
        }
    },

    // تعداد پیام‌های خوانده‌نشده
    async getUnreadManagementCount(userId) {
        if (!this._online()) return 0;
        try {
            const { data, error } = await this._db()
                .rpc('get_unread_management_messages', { p_user_id: userId });
            if (error) throw error;
            return data || 0;
        } catch (e) {
            return 0;
        }
    },

    // Realtime subscription برای پیام‌های جدید
    subscribeToManagementChat(callback) {
        if (!this._online()) return null;
        // اگر قبلاً subscribe شده، همان رو برمی‌گردانیم
        if (this._channels['mgmt_chat']) return this._channels['mgmt_chat'];
        try {
            const channel = this._db()
                .channel('mgmt_chat_rt')
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'management_messages' },
                    payload => { if (!payload.new?.deleted) callback('INSERT', this._dbToMgmtMsg(payload.new)); })
                .on('postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'management_messages' },
                    payload => { callback('UPDATE', this._dbToMgmtMsg(payload.new)); })
                .subscribe();
            this._channels['mgmt_chat'] = channel;
            return channel;
        } catch (e) {
            console.warn('⚠️ subscribeToManagementChat خطا:', e.message);
            return null;
        }
    },

    unsubscribeManagementChat() {
        const client = this._db();
        if (!client || !this._channels['mgmt_chat']) return;
        client.removeChannel(this._channels['mgmt_chat']);
        delete this._channels['mgmt_chat'];
    },

    // بارگذاری شرکت‌کنندگان واقعی (manager + employee) از profiles
    async getManagementChatParticipants() {
        if (!this._online()) {
            // fallback به localStorage
            const users = this._localGetUsers();
            return users.filter(u => u.role === 'manager' || u.role === 'employee');
        }
        try {
            const { data, error } = await this._db()
                .from('profiles')
                .select('id, name, username, role')
                .in('role', ['manager', 'employee'])
                .eq('active', true)
                .order('role')
                .order('name');
            if (error) throw error;
            return data.map(r => ({
                id:       r.id,
                name:     r.name     || 'کاربر',
                username: r.username || r.id,
                role:     r.role
            }));
        } catch (e) {
            console.warn('⚠️ getManagementChatParticipants خطا:', e.message);
            const users = this._localGetUsers();
            return users.filter(u => u.role === 'manager' || u.role === 'employee');
        }
    },

    // ── management chat transformers ─────────────────────────
    _mgmtMsgToDb(m) {
        return {
            // اگر id از نوع UUID است همان را بفرست، در غیر این صورت DB خودش تولید می‌کند
            ...(m.id && /^[0-9a-f-]{36}$/i.test(m.id) ? { id: m.id } : {}),
            sender_id:       String(m.senderId   || ''),
            sender_name:     String(m.senderName || ''),
            sender_role:     (m.senderRole === 'manager' ? 'manager' : 'employee'),
            msg_type:        m.msgType    || 'text',
            content:         m.content   || m.text || null,
            file_url:        m.fileUrl   || null,
            file_name:       m.fileName  || null,
            file_type:       m.fileType  || null,
            file_size:       m.fileSize  ? parseInt(m.fileSize) : null,
            mentions:        Array.isArray(m.mentions) ? m.mentions : [],
            related_task_id: m.relatedTaskId || null,
            edited:          m.edited    || false,
            edited_at:       m.editedAt  || null
        };
    },

    _dbToMgmtMsg(r) {
        return {
            id:            r.id,
            senderId:      r.sender_id,
            senderName:    r.sender_name  || '',
            senderRole:    r.sender_role  || 'employee',
            msgType:       r.msg_type     || 'text',
            content:       r.content      || '',
            text:          r.content      || '',
            fileUrl:       r.file_url     || null,
            fileName:      r.file_name    || null,
            fileType:      r.file_type    || null,
            fileSize:      r.file_size    || null,
            mentions:      r.mentions     || [],
            relatedTaskId: r.related_task_id || null,
            edited:        r.edited       || false,
            editedAt:      r.edited_at    || null,
            deleted:       r.deleted      || false,
            createdAt:     r.created_at
        };
    },

    // ════════════════════════════════════════════════════════
    // TRANSFORMERS — اپ ↔ Supabase
    // ════════════════════════════════════════════════════════

    _userToProfile(u) {
        const validRoles = ['manager', 'employee', 'agent', 'student'];
        let role = u.role === 'doctor' ? 'agent' : u.role;
        if (!validRoles.includes(role)) role = 'student';

        return {
            id:              u.id,          // original app ID مثل 'mgr001'
            name:            u.name            || 'کاربر',
            username:        u.username,
            role,
            email:           u.email           || null,
            phone:           u.phone           || null,
            active:          u.active          !== false,
            department:      u.department      || null,
            university:      u.university      || null,
            student_id:      u.studentId       || null,
            field:           u.field           || null,
            degree:          SupabaseAuth._normalizeDegree(u.degree),
            passport_number: u.passportNumber  || null,
            bachelor_field:  u.bachelorField   || null,
            specialization:  u.specialization  || null
        };
    },

    // تبدیل هر string ID به UUID معتبر (deterministic)
    // از crypto.subtle یا یه hash ساده استفاده می‌کنیم
    _toUUID(id) {
        if (!id) return null;
        const s = String(id);
        // اگر قبلاً UUID format معتبر است
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s;

        // hash ساده djb2 → 32 کاراکتر hex
        let h1 = 0x9e3779b9, h2 = 0x6c62272e;
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            h1 = Math.imul(h1 ^ c, 0x9e3779b9) >>> 0;
            h2 = Math.imul(h2 ^ c, 0x6c62272e) >>> 0;
        }
        // ساخت 32 hex digit از ترکیب hash و string
        const seed = (h1 >>> 0).toString(16).padStart(8, '0') +
                     (h2 >>> 0).toString(16).padStart(8, '0');
        // پر کردن بقیه از string خودش
        const raw = (seed + s.replace(/[^0-9a-f]/gi, '').toLowerCase())
                        .padEnd(32, '0')
                        .substring(0, 32);
        // فرمت UUID: 8-4-4-4-12
        // version=5, variant=8
        const a = raw.substring(0, 8);
        const b = raw.substring(8, 12);
        const c2 = '5' + raw.substring(13, 16);   // version 5
        const d = (parseInt(raw.substring(16, 18), 16) | 0x80).toString(16).padStart(2,'0')
                  + raw.substring(18, 20);           // variant
        const e = raw.substring(20, 32);
        return `${a}-${b}-${c2}-${d}-${e}`;
    },

    _orderToDb(o) {
        // نرمال‌سازی status: 'active' → 'in_progress' (DB CHECK constraint)
        const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
        let status = o.status;
        if (status === 'active') status = 'in_progress';
        if (!validStatuses.includes(status)) status = 'pending';

        return {
            id:                    o.id,           // original app ID مستقیم
            student_id:            o.studentId     || null,
            student_name:          o.studentName   || null,
            university:            o.university    || null,
            field:                 o.field         || null,
            degree:                o.degree        || null,
            order_type:            o.type          || null,
            deadline:              o.deadline      || null,
            deadline_datetime:     o.deadlineDateTime || null,
            phone:                 o.phone         || null,
            passport_number:       o.passportNumber || null,
            currency:              o.currency      || 'تومان',
            work_list:             JSON.stringify(o.workList || []),
            files:                 JSON.stringify(o.files   || []),
            title:                 o.title         || null,
            is_custom_order:       o.isCustomOrder || false,
            rejection_reason:      o.rejectionReason || null,
            rejection_history:     JSON.stringify(o.rejectionHistory || []),
            approved_at:           o.approvedAt    || null,
            assigned_at:           o.assignedAt    || null,
            completed_at:          o.completedAt   || null,
            doctor_share:          parseFloat(o.doctorShare)  || 0,
            manager_share:         parseFloat(o.managerShare) || 0,
            status,
            stage:                 o.stage            || null,
            progress:              o.progress         || 0,
            assigned_agent_id:     o.assignedAgentId  || o.assignedDoctorId || null,
            total_amount:          parseFloat(o.totalAmount)  || 0,
            paid_amount:           parseFloat(o.paidAmount)   || 0,
            payment_status:        o.paymentStatus    || 'unpaid',
            description:           o.description      || null,
            tasks:                 JSON.stringify(o.tasks     || []),
            work_log:              JSON.stringify(o.workLog   || []),
            order_type_id:         o.orderTypeId      || null,
            revenue_agent_percent: o.revenueAgentPercent  != null ? o.revenueAgentPercent  : 60,
            revenue_manager_percent: o.revenueManagerPercent != null ? o.revenueManagerPercent : 40,
            extra_costs:           JSON.stringify(o.extraCosts || []),
            updated_at:            new Date().toISOString()
        };
    },

    _dbToOrder(r) {
        return {
            id:                    r.id,
            studentId:             r.student_id,
            studentName:           r.student_name   || 'نامشخص',
            university:            r.university     || 'نامشخص',
            field:                 r.field          || '',
            degree:                r.degree         || '',
            type:                  r.order_type     || 'سایر',
            deadline:              r.deadline       || '',
            deadlineDateTime:      r.deadline_datetime || null,
            phone:                 r.phone          || '',
            passportNumber:        r.passport_number || '',
            currency:              r.currency       || 'تومان',
            workList:              this._parseJSON(r.work_list, []),
            files:                 this._parseJSON(r.files, []),
            title:                 r.title          || '',
            isCustomOrder:         r.is_custom_order || false,
            rejectionReason:       r.rejection_reason || '',
            rejectionHistory:      this._parseJSON(r.rejection_history, []),
            approvedAt:            r.approved_at    || null,
            assignedAt:            r.assigned_at    || null,
            completedAt:           r.completed_at   || null,
            doctorShare:           parseFloat(r.doctor_share)  || 0,
            managerShare:          parseFloat(r.manager_share) || 0,
            status:                r.status,
            stage:                 r.stage,
            progress:              r.progress        || 0,
            assignedAgentId:       r.assigned_agent_id,
            assignedDoctorId:      r.assigned_agent_id,
            totalAmount:           parseFloat(r.total_amount)  || 0,
            paidAmount:            parseFloat(r.paid_amount)   || 0,
            paymentStatus:         r.payment_status   || 'unpaid',
            description:           r.description     || '',
            tasks:                 this._parseJSON(r.tasks,   []),
            workLog:               this._parseJSON(r.work_log, []),
            // v2 columns
            orderTypeId:           r.order_type_id   || null,
            revenueAgentPercent:   r.revenue_agent_percent  != null ? parseFloat(r.revenue_agent_percent)  : 60,
            revenueManagerPercent: r.revenue_manager_percent != null ? parseFloat(r.revenue_manager_percent) : 40,
            extraCosts:            this._parseJSON(r.extra_costs, []),
            createdAt:             r.created_at,
            updatedAt:             r.updated_at
        };
    },

    _taskToDb(t, employeeId) {
        return {
            id:             t.id,
            assigned_to:    employeeId,
            created_by:     t.createdBy      || null,
            title:          t.title,
            description:    t.description    || null,
            priority:       t.priority       || 'normal',
            status:         t.status         || 'pending',
            due_date:       t.dueDate        || null,
            is_step_task:   t.isStepTask     || false,
            student_id:     t.studentId      || null,
            step_type:      t.stepType       || null,
            step_index:     t.stepIndex      != null ? t.stepIndex : null,
            step_name:      t.stepName       || null,
            voice_message:  t.voiceMessage   || null,
            voice_duration: t.voiceDuration  || null,
            additional_text: t.additionalText || null,
            order_id:       t.orderId        || null,
            reject_note:    t.rejectNote     || null,
            approved_at:    t.approvedAt     || null,
            rejected_at:    t.rejectedAt     || null,
            from_id:        t.fromId         || null,
            from_name:      t.fromName       || null,
            updated_at:     new Date().toISOString()
        };
    },

    _dbToTask(r) {
        return {
            id:             r.id,
            title:          r.title,
            description:    r.description    || '',
            priority:       r.priority       || 'normal',
            status:         r.status         || 'pending',
            dueDate:        r.due_date       || '',
            isStepTask:     r.is_step_task   || false,
            studentId:      r.student_id     || null,
            stepType:       r.step_type      || null,
            stepIndex:      r.step_index,
            stepName:       r.step_name      || null,
            voiceMessage:   r.voice_message  || null,
            voiceDuration:  r.voice_duration || null,
            additionalText: r.additional_text || null,
            orderId:        r.order_id       || null,
            createdBy:      r.created_by     || null,
            rejectNote:     r.reject_note    || null,
            approvedAt:     r.approved_at    || null,
            rejectedAt:     r.rejected_at    || null,
            fromId:         r.from_id        || null,
            fromName:       r.from_name      || null,
            createdAt:      r.created_at
        };
    },

    // ── وظایف ارسالی از کارمند برای مدیر ───────────────────
    // از همان جدول employee_tasks استفاده می‌کنیم — بدون نیاز به جدول جدید
    async getTasksForManager() {
        const MGR_KEY = 'tasks_for_manager';
        const localData = JSON.parse(localStorage.getItem(MGR_KEY) || '[]');
        if (!this._online()) return localData;
        try {
            // وظایفی که from_id دارند و به مدیر assigned شدند
            const { data, error } = await this._db()
                .from('employee_tasks')
                .select('*')
                .not('from_id', 'is', null)
                .order('created_at', { ascending: false });
            if (error) {
                // اگر ستون from_id هنوز در DB نیست، fallback به localStorage
                if (error.code === 'PGRST116' || error.message.includes('from_id')) {
                    console.warn('⚠️ ستون from_id هنوز نیست — migration اجرا کنید');
                }
                return localData;
            }
            if (data && data.length > 0) {
                const merged = data.map(r => ({
                    id:          r.id,
                    title:       r.title,
                    description: r.description || '',
                    dueDate:     r.due_date     || '',
                    priority:    r.priority     || 'low',
                    status:      r.status       || 'pending',
                    fromId:      r.from_id      || null,
                    fromName:    r.from_name    || null,
                    assignedToId: r.assigned_to || null,
                    assignedTo:  r.assigned_to  || null,
                    updatedAt:   r.updated_at,
                    createdAt:   r.created_at
                }));
                localStorage.setItem(MGR_KEY, JSON.stringify(merged));
                return merged;
            }
            return localData;
        } catch (e) {
            console.warn('⚠️ getTasksForManager خطا:', e.message);
            return localData;
        }
    },

    async saveTaskForManager(task) {
        const MGR_KEY = 'tasks_for_manager';
        // ذخیره محلی
        const all = JSON.parse(localStorage.getItem(MGR_KEY) || '[]');
        const idx = all.findIndex(t => t.id === task.id);
        if (idx >= 0) all[idx] = task; else all.unshift(task);
        localStorage.setItem(MGR_KEY, JSON.stringify(all));

        if (!this._online()) return true;
        try {
            // ذخیره در employee_tasks با from_id و assigned_to = مدیر
            const row = this._taskToDb(task, task.assignedToId || task.assignedTo || '');
            row.from_id   = task.fromId   || null;
            row.from_name = task.fromName || null;
            const { error } = await this._db()
                .from('employee_tasks')
                .upsert(row, { onConflict: 'id' });
            if (error) {
                if (error.code === '23514') {
                    // constraint violation — بدون from_id امتحان کن
                    console.warn('⚠️ saveTaskForManager constraint — migration اجرا کنید');
                } else {
                    throw error;
                }
            }
            return true;
        } catch (e) {
            console.warn('⚠️ saveTaskForManager خطا:', e.message);
            return false;
        }
    },

    async updateManagerTaskStatus(taskId, status) {
        const MGR_KEY = 'tasks_for_manager';
        // محلی
        const all = JSON.parse(localStorage.getItem(MGR_KEY) || '[]');
        const t = all.find(t => t.id === taskId);
        if (t) { t.status = status; t.updatedAt = new Date().toISOString(); }
        localStorage.setItem(MGR_KEY, JSON.stringify(all));

        if (!this._online()) return true;
        try {
            const { error } = await this._db()
                .from('employee_tasks')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', taskId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ updateManagerTaskStatus خطا:', e.message);
            return false;
        }
    },

    async deleteManagerTask(taskId) {
        const MGR_KEY = 'tasks_for_manager';
        const all = JSON.parse(localStorage.getItem(MGR_KEY) || '[]');
        localStorage.setItem(MGR_KEY, JSON.stringify(all.filter(t => t.id !== taskId)));

        if (!this._online()) return true;
        try {
            const { error } = await this._db()
                .from('employee_tasks')
                .delete()
                .eq('id', taskId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ deleteManagerTask خطا:', e.message);
            return false;
        }
    },

    _workHourToDb(e) {
        return {
            id:            e.id,
            employee_id:   e.employeeId,
            employee_name: e.employeeName || null,
            type:          e.type         || 'work',
            date:          e.date,
            start_time:    e.startTime    || null,
            end_time:      e.endTime      || null,
            total_hours:   parseFloat(e.totalHours) || null,
            amount:        parseFloat(e.amount)     || null,
            description:   e.description  || null,
            status:        e.status       || 'pending',
            updated_at:    new Date().toISOString()
        };
    },

    _dbToWorkHour(r) {
        return {
            id:           r.id,
            employeeId:   r.employee_id,
            employeeName: r.employee_name || '',
            type:         r.type,
            date:         r.date,
            startTime:    r.start_time    || '',
            endTime:      r.end_time      || '',
            totalHours:   r.total_hours   || 0,
            amount:       r.amount        || 0,
            description:  r.description   || '',
            status:       r.status        || 'pending',
            createdAt:    r.created_at,
            updatedAt:    r.updated_at
        };
    },

    _messageToDb(m) {
        return {
            id:          m.id ? String(m.id) : undefined,
            sender_id:   m.senderId   || null,
            receiver_id: m.receiverId || null,
            order_id:    m.orderId    || null,
            content:     m.content   || m.text || '',
            is_system:   m.isSystem  === true ? true : false
        };
    },

    _dbToMessage(r) {
        return {
            id:         r.id,
            senderId:   r.sender_id,
            receiverId: r.receiver_id,
            orderId:    r.order_id,
            content:    r.content,
            text:       r.content,
            isSystem:   r.is_system,
            createdAt:  r.created_at,
            readAt:     r.read_at
        };
    },

    // ── helpers ───────────────────────────────────────────────
    _normalizeStatus(s) {
        const map = { 'active': 'in_progress' };
        return map[s] || s || 'pending';
    },

    _parseJSON(val, def) {
        if (!val) return def;
        if (typeof val === 'object') return val;
        try { return JSON.parse(val); } catch { return def; }
    },

    // ── localStorage helpers ─────────────────────────────────
    _localGetUsers() {
        try {
            const raw = localStorage.getItem('edu_system_users')
                     || localStorage.getItem('users');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    _localGetOrders() {
        try {
            const raw = localStorage.getItem('edu_system_orders');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    _localGetEmployeeTasks(employeeId) {
        try {
            const all = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
            return all[employeeId] || [];
        } catch { return []; }
    }
};

console.log('📦 supabase-data.js بارگذاری شد');
