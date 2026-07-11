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
    _online() { return !!(this._db() && SupabaseConnection.isOnline); },

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
        if (!this._online()) return true;

        try {
            // تبدیل فرمت اپ به فرمت Supabase
            const rows = users.map(u => this._userToProfile(u));
            const { error } = await this._db()
                .from('profiles')
                .upsert(rows, { onConflict: 'id' });
            if (error) throw error;
            this._cacheInvalidate('users');
            return true;
        } catch (e) {
            console.warn('⚠️ saveUsers Supabase خطا:', e.message);
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
        if (!this._online()) return true;

        try {
            const rows = orders.map(o => this._orderToDb(o));
            const { error } = await this._db()
                .from('orders')
                .upsert(rows, { onConflict: 'id' });
            if (error) throw error;
            this._cacheInvalidate('orders');
            return true;
        } catch (e) {
            console.warn('⚠️ saveOrders Supabase خطا:', e.message);
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
        if (!this._online()) return true;

        try {
            const rows = progressArray.map((item, idx) => ({
                student_id: studentId,
                path_type:  pathType,
                step_index: idx,
                status:     item ? item.status : 0,
                updated_at: new Date().toISOString()
            }));
            const { error } = await this._db()
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
                type:        tx.type,       // payment/refund/expense/income
                amount:      parseFloat(tx.amount) || 0,
                description: tx.description || null,
                created_by:  tx.createdBy   || tx.created_by  || null
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
    // TRANSFORMERS — اپ ↔ Supabase
    // ════════════════════════════════════════════════════════

    _userToProfile(u) {
        // role: 'doctor' → 'agent' (DB CHECK constraint accepts only manager/employee/agent/student)
        const validRoles = ['manager', 'employee', 'agent', 'student'];
        let role = u.role === 'doctor' ? 'agent' : u.role;
        if (!validRoles.includes(role)) role = 'student';

        return {
            id:              u.id,
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
            // degree: DB stores English values only (bachelor/masters/phd)
            degree:          SupabaseAuth._normalizeDegree(u.degree),
            passport_number: u.passportNumber  || null,
            bachelor_field:  u.bachelorField   || null,
            specialization:  u.specialization  || null
        };
    },

    _orderToDb(o) {
        // نرمال‌سازی status: 'active' → 'in_progress' (DB CHECK constraint)
        const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
        let status = o.status;
        if (status === 'active') status = 'in_progress';
        if (!validStatuses.includes(status)) status = 'pending';

        // نرمال‌سازی role: 'doctor' → 'agent'
        // (لازم نیست در orders، ولی assigned_agent_id باید UUID باشد)

        return {
            id:                    o.id,
            student_id:            o.studentId        || null,
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
            // v2 columns
            order_type_id:         o.orderTypeId      || null,
            revenue_agent_percent: o.revenueAgentPercent  != null ? o.revenueAgentPercent  : 60,
            revenue_manager_percent: o.revenueManagerPercent != null ? o.revenueManagerPercent : 40,
            updated_at:            new Date().toISOString()
        };
    },

    _dbToOrder(r) {
        return {
            id:                    r.id,
            studentId:             r.student_id,
            status:                r.status,
            stage:                 r.stage,
            progress:              r.progress        || 0,
            assignedAgentId:       r.assigned_agent_id,
            assignedDoctorId:      r.assigned_agent_id,   // backward-compat alias
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
            createdAt:             r.created_at,
            updatedAt:             r.updated_at
        };
    },

    _taskToDb(t, employeeId) {
        return {
            id:            t.id,
            assigned_to:   employeeId,
            created_by:    t.createdBy     || null,
            title:         t.title,
            description:   t.description  || null,
            priority:      t.priority     || 'normal',
            status:        t.status       || 'pending',
            due_date:      t.dueDate      || null,
            is_step_task:  t.isStepTask   || false,
            student_id:    t.studentId    || null,
            step_type:     t.stepType     || null,
            step_index:    t.stepIndex    != null ? t.stepIndex : null,
            step_name:     t.stepName     || null,
            voice_message: t.voiceMessage || null,
            order_id:      t.orderId      || null,
            updated_at:    new Date().toISOString()
        };
    },

    _dbToTask(r) {
        return {
            id:           r.id,
            title:        r.title,
            description:  r.description  || '',
            priority:     r.priority     || 'normal',
            status:       r.status       || 'pending',
            dueDate:      r.due_date     || '',
            isStepTask:   r.is_step_task || false,
            studentId:    r.student_id   || null,
            stepType:     r.step_type    || null,
            stepIndex:    r.step_index,
            stepName:     r.step_name    || null,
            voiceMessage: r.voice_message || null,
            orderId:      r.order_id     || null,
            createdBy:    r.created_by   || null,
            createdAt:    r.created_at
        };
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
            // is_system: true برای پیام‌های خودکار سیستمی، false برای چت انسانی
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
