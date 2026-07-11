// ============================================================
// js/supabase-auth.js
// احراز هویت از طریق Supabase با fallback به localStorage
// ============================================================

const SupabaseAuth = {

    // ── ورود به سیستم ─────────────────────────────────────────
    async login(username, password) {
        const client = getSupabaseClient();

        // اگر Supabase پیکربندی نشده → fallback به localStorage
        if (!client || !SupabaseConnection.isConfigured) {
            return this._localLogin(username, password);
        }

        try {
            // در Supabase Auth باید با ایمیل وارد شود.
            // ما username را به ایمیل مجازی تبدیل می‌کنیم.
            // (پیش‌فرض: username@kowsar.local)
            // اگر کاربر ایمیل واقعی دارد، از آن استفاده می‌کنیم.
            const emailToUse = username.includes('@')
                ? username
                : `${username}@kowsar.local`;

            const { data, error } = await client.auth.signInWithPassword({
                email: emailToUse,
                password: password
            });

            if (error) {
                console.warn('⚠️ Supabase login خطا، fallback به localStorage:', error.message);
                return this._localLogin(username, password);
            }

            // دریافت پروفایل از جدول profiles
            const profile = await this._getProfile(data.user.id);
            if (!profile) {
                return { success: false, error: 'پروفایل کاربر یافت نشد' };
            }

            const user = this._normalizeProfile(profile);
            this._saveCurrentUser(user);
            console.log('✅ ورود از طریق Supabase موفق:', user.username);
            return { success: true, user };

        } catch (e) {
            console.warn('⚠️ Supabase login exception، fallback:', e.message);
            return this._localLogin(username, password);
        }
    },

    // ── خروج از سیستم ─────────────────────────────────────────
    async logout() {
        const client = getSupabaseClient();
        if (client && SupabaseConnection.isConfigured) {
            try {
                await client.auth.signOut();
            } catch (e) {
                console.warn('⚠️ Supabase signOut خطا:', e.message);
            }
        }
        this._clearCurrentUser();
        console.log('✅ خروج از سیستم انجام شد');
        return { success: true };
    },

    // ── بررسی نشست فعلی ──────────────────────────────────────
    async getSession() {
        const client = getSupabaseClient();
        if (!client || !SupabaseConnection.isConfigured) {
            // fallback: بخوان از localStorage
            const saved = localStorage.getItem('currentUser');
            return saved ? JSON.parse(saved) : null;
        }

        try {
            const { data: { session } } = await client.auth.getSession();
            if (!session) {
                // بررسی localStorage به عنوان fallback
                const saved = localStorage.getItem('currentUser');
                return saved ? JSON.parse(saved) : null;
            }

            const profile = await this._getProfile(session.user.id);
            if (!profile) return null;

            const user = this._normalizeProfile(profile);
            this._saveCurrentUser(user);
            return user;
        } catch (e) {
            const saved = localStorage.getItem('currentUser');
            return saved ? JSON.parse(saved) : null;
        }
    },

    // ── ثبت کاربر جدید (توسط مدیر از طریق Supabase signUp) ──
    // NOTE: client.auth.admin.createUser() نیاز به service_role key دارد و
    // از browser قابل استفاده نیست. به جای آن از signUp استفاده می‌کنیم.
    // بعد از ایجاد، مدیر باید از داشبورد Supabase ایمیل تأیید را Confirm کند،
    // یا در تنظیمات پروژه "Confirm email" را غیرفعال کند.
    async createUser(userData) {
        const client = getSupabaseClient();
        if (!client || !SupabaseConnection.isConfigured) {
            return this._localCreateUser(userData);
        }

        try {
            const emailToUse = userData.email || `${userData.username}@kowsar.local`;

            // ساخت کاربر در auth.users
            const { data, error } = await client.auth.signUp({
                email: emailToUse,
                password: userData.password,
                options: {
                    data: {
                        name:     userData.name,
                        username: userData.username,
                        role:     userData.role === 'doctor' ? 'agent' : (userData.role || 'student')
                    }
                }
            });

            if (error) throw error;

            // trigger on_auth_user_created پروفایل پایه می‌سازد.
            // فیلدهای اضافه را آپدیت می‌کنیم:
            if (data.user) {
                const { error: profileError } = await client
                    .from('profiles')
                    .update({
                        phone:           userData.phone        || null,
                        department:      userData.department   || null,
                        university:      userData.university   || null,
                        student_id:      userData.studentId    || null,
                        field:           userData.field        || null,
                        degree:          this._normalizeDegree(userData.degree),
                        passport_number: userData.passportNumber || null,
                        bachelor_field:  userData.bachelorField  || null,
                        specialization:  userData.specialization || null,
                        active:          userData.active !== false
                    })
                    .eq('id', data.user.id);

                if (profileError) console.warn('⚠️ profile update خطا:', profileError.message);
            }

            return { success: true, userId: data.user?.id };
        } catch (e) {
            console.error('❌ createUser خطا:', e.message);
            // fallback به localStorage
            return this._localCreateUser(userData);
        }
    },

    // ── لاگین محلی (fallback) ─────────────────────────────────
    _localLogin(username, password) {
        try {
            const usersStr = localStorage.getItem('edu_system_users')
                          || localStorage.getItem('users');
            const users = usersStr ? JSON.parse(usersStr) : [];
            const user = users.find(u =>
                u.username === username &&
                u.password === password &&
                u.active !== false
            );
            if (!user) {
                return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
            }
            this._saveCurrentUser(user);
            console.log('✅ ورود محلی (localStorage):', username);
            return { success: true, user };
        } catch (e) {
            return { success: false, error: 'خطا در ورود محلی' };
        }
    },

    // ── ساخت کاربر محلی (fallback) ───────────────────────────
    _localCreateUser(userData) {
        try {
            const usersStr = localStorage.getItem('edu_system_users') || '[]';
            const users = JSON.parse(usersStr);
            if (users.find(u => u.username === userData.username)) {
                return { success: false, error: 'نام کاربری قبلاً استفاده شده' };
            }
            const newUser = {
                ...userData,
                id: userData.id || ('usr_' + Date.now()),
                createdAt: new Date().toISOString()
            };
            users.push(newUser);
            localStorage.setItem('edu_system_users', JSON.stringify(users));
            return { success: true, userId: newUser.id };
        } catch (e) {
            return { success: false, error: 'خطا در ساخت کاربر محلی' };
        }
    },

    // ── دریافت پروفایل از Supabase ────────────────────────────
    async _getProfile(userId) {
        const client = getSupabaseClient();
        if (!client) return null;
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) { console.warn('⚠️ getProfile خطا:', error.message); return null; }
        return data;
    },

    // ── نرمال‌سازی پروفایل Supabase به فرمت اپ ───────────────
    // NOTE: degree از DB به شکل انگلیسی (masters/phd/bachelor) می‌آید.
    // UI می‌تواند برای نمایش از CONFIG.DEGREE_TO_FA استفاده کند.
    _normalizeProfile(p) {
        return {
            id:              p.id,
            name:            p.name,
            username:        p.username,
            role:            p.role === 'doctor' ? 'agent' : p.role, // نرمال‌سازی role
            email:           p.email        || '',
            phone:           p.phone        || '',
            active:          p.active       !== false,
            department:      p.department   || '',
            university:      p.university   || '',
            studentId:       p.student_id   || '',
            field:           p.field        || '',
            degree:          p.degree       || 'masters',   // English DB value
            degreeLabel:     this._persianDegree(p.degree), // Persian display only
            passportNumber:  p.passport_number || '',
            bachelorField:   p.bachelor_field  || '',
            specialization:  p.specialization  || '',
            createdAt:       p.created_at
        };
    },

    // ── تبدیل درجه انگلیسی ↔ فارسی ──────────────────────────
    _normalizeDegree(d) {
        const map = { 'ارشد': 'masters', 'دکتری': 'phd', 'دكتراه': 'phd', 'کارشناسی': 'bachelor' };
        return map[d] || d || 'masters';
    },
    _persianDegree(d) {
        const map = { 'masters': 'ارشد', 'phd': 'دكتراه', 'bachelor': 'کارشناسی' };
        return map[d] || d || 'ارشد';
    },

    // ── ذخیره/پاک کردن کاربر جاری ────────────────────────────
    _saveCurrentUser(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('edu_system_current_user', JSON.stringify(user));
    },
    _clearCurrentUser() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('edu_system_current_user');
    }
};

console.log('📦 supabase-auth.js بارگذاری شد');
