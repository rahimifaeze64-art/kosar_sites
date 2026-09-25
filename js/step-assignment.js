/**
 * سیستم تخصیص مراحل به کارمندان
 * Step Assignment System
 * 
 * این ماژول مدیریت می‌کند:
 * 1. تخصیص هر مرحله از گردش دفاع / فارغ‌التحصیلی / ملزومات به یک کارمند خاص
 * 2. وقتی مدیر یک مرحله را کامل می‌کند، مرحله بعدی به کارمند مربوطه به عنوان وظیفه ارسال می‌شود
 * 3. وقتی کارمند وظیفه را تکمیل می‌کند، مرحله مربوطه در پروفایل دانشجو سبز می‌شود
 */

const StepAssignmentModule = {

    // لیست کارمندان ثابت (همگام با app.js و hardcoded-users.js)
    EMPLOYEES: [
        { id: 'emp001', name: 'سارا سادات حسینی' },
        { id: 'emp002', name: 'زینب بتول محمدی' },
        { id: 'emp003', name: 'علیرضا غلامی فرزاد' },
        { id: 'emp004', name: 'سید محمد فاضلی' },
        { id: 'emp005', name: 'مهدی خدایاری' },
    ],

    // کلید ذخیره‌سازی در localStorage
    STORAGE_KEY: 'step_assignments',

    // صف تغییرات هنوزارسال‌نشده به Supabase (پشتیبانی آفلاین + sync صحیح)
    PENDING_KEY: 'step_assignments_pending',

    // نشانگر sync موفق تخصیص‌ها در این سشن (حافظه) — برای reconcileStepTasks
    // تا وقتی همه مراحل بدون تخصیص‌اند هم، پاک‌سازی وظایف زائد انجام شود
    _syncedFromSupabase: false,

    /**
     * لیست کارمندان: ترکیب لیست ثابت با کاربران سیستم (edu_system_users)
     * تا کاربران داینامیک هم در dropdown مدیریت مراحل نمایش داده شوند
     */
    getEmployees() {
        const list = [...this.EMPLOYEES];
        try {
            const users = JSON.parse(localStorage.getItem('edu_system_users') || '[]');
            users.forEach(u => {
                const isEmployee = u && (u.role === 'employee' || u.role === 'کارمند' ||
                    (u.id && String(u.id).startsWith('emp')));
                if (!isEmployee) return;
                if (!list.find(e => e.id === u.id)) {
                    list.push({ id: u.id, name: u.name || u.username || u.email || u.id });
                }
            });
        } catch (e) { /* ignore */ }
        return list;
    },

    // ─── ذخیره و بارگذاری تخصیص‌ها ──────────────────────────────────────────

    /** بارگذاری همه تخصیص‌ها
     *  ساختار: { defense: { "0": "emp001", "2": "emp003", ... }, educational: {...}, requirements: {...} }
     */
    getAssignments() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
        } catch (e) {
            return {};
        }
    },

    /**
     * بارگذاری تخصیص‌ها از Supabase در پس‌زمینه و sync با localStorage
     * وقتی صفحه مدیریت مراحل باز می‌شود صدا زده می‌شود
     *
     * ⚠️ منبع اصلی = Supabase. فقط تغییرات محلیِ هنوزارسال‌نشده (صف pending)
     * روی نتیجه اعمال می‌شوند — دیگر مقادیر قدیمی محلی روی داده تازه ابر نوشته نمی‌شوند.
     */
    async syncAssignmentsFromSupabase() {
        try {
            const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
            if (!client) return;

            const { data, error } = await client
                .from('step_assignments')
                .select('path_type, step_index, employee_id');
            if (error) throw error;

            const merged = {};
            (data || []).forEach(row => {
                if (!merged[row.path_type]) merged[row.path_type] = {};
                if (row.employee_id) {
                    merged[row.path_type][row.step_index] = row.employee_id;
                }
            });

            // اعمال تغییرات محلیِ در صف انتظار (تازه‌تر از ابر — آخرین نیت کاربر)
            const pending = this._getPendingQueue();
            pending.forEach(p => {
                if (!merged[p.pathType]) merged[p.pathType] = {};
                if (p.employeeId) merged[p.pathType][p.stepIndex] = p.employeeId;
                else delete merged[p.pathType][p.stepIndex];
            });

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
            // نشانگر sync موفق در این سشن — حتی اگر نتیجه خالی باشد (همه مراحل بدون تخصیص)
            this._syncedFromSupabase = true;

            // تلاش مجدد برای ارسال تغییرات صف‌شده
            if (pending.length > 0) {
                const remaining = [];
                for (const p of pending) {
                    if (typeof SupabaseDataModule !== 'undefined' &&
                        typeof SupabaseDataModule.saveStepAssignment === 'function') {
                        const ok = await SupabaseDataModule.saveStepAssignment(p.pathType, p.stepIndex, p.employeeId);
                        if (!ok) remaining.push(p);
                    } else {
                        remaining.push(p);
                    }
                }
                this._setPendingQueue(remaining);
                if (remaining.length === 0) {
                    console.log('✅ همه تغییرات صف‌شده تخصیص‌ها به Supabase ارسال شد');
                }
            }

            console.log('✅ step_assignments از Supabase sync شد');
        } catch (e) {
            console.warn('⚠️ syncAssignmentsFromSupabase خطا:', e.message);
        }
    },

    /** ذخیره تخصیص یک مرحله
     * @param {string} type  - "defense" | "educational" | "requirements"
     * @param {number} stepIndex
     * @param {string} employeeId - "emp001" | "" (برای حذف تخصیص)
     */
    saveAssignment(type, stepIndex, employeeId) {
        // کارمند قبلی را قبل از تغییر ذخیره کن
        const prevEmployeeId = this.getAssignedEmployee(type, stepIndex);

        // ذخیره محلی همیشه
        const assignments = this.getAssignments();
        if (!assignments[type]) assignments[type] = {};
        if (employeeId) {
            assignments[type][stepIndex] = employeeId;
        } else {
            delete assignments[type][stepIndex];
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(assignments));

        // ثبت در صف همگام‌سازی — تا وقتی که با موفقیت به Supabase برسد آنجا می‌ماند
        this._enqueuePending(type, stepIndex, employeeId || null);

        // ── ذخیره در Supabase — تک‌مسیر واحد ────────────────────────────────
        this._pushAssignmentToSupabase(type, stepIndex, employeeId || null);

        // ── اگر تخصیص حذف یا به کارمند دیگری تغییر کرد → task‌های pending کارمند قبلی پاک شوند ──
        if (prevEmployeeId && prevEmployeeId !== employeeId) {
            this._removeStepTasksForEmployee(prevEmployeeId, type, stepIndex);
        }

        // ── اگر کارمندی تخصیص داده شد، بررسی کن آیا این مرحله "فعال" است ──
        if (employeeId) {
            this._createTaskIfStepActive(type, stepIndex, employeeId);
        }
    },

    // ─── صف همگام‌سازی تخصیص‌ها (پشتیبانی آفلاین + جلوگیری از تداخل sync) ───

    _getPendingQueue() {
        try {
            return JSON.parse(localStorage.getItem(this.PENDING_KEY) || '[]');
        } catch (e) { return []; }
    },

    _setPendingQueue(queue) {
        try {
            localStorage.setItem(this.PENDING_KEY, JSON.stringify(queue || []));
        } catch (e) { console.warn('⚠️ _setPendingQueue خطا:', e.message); }
    },

    /** ثبت تغییر تخصیص در صف — تا زمانی که با موفقیت به Supabase برسد */
    _enqueuePending(type, stepIndex, employeeId) {
        try {
            const queue = this._getPendingQueue();
            const entry = {
                pathType: type,
                stepIndex: Number(stepIndex),
                employeeId: employeeId || null,
                updatedAt: new Date().toISOString()
            };
            const idx = queue.findIndex(p => p.pathType === type && Number(p.stepIndex) === Number(stepIndex));
            if (idx >= 0) queue[idx] = entry; else queue.push(entry);
            this._setPendingQueue(queue);
        } catch (e) {
            console.warn('⚠️ _enqueuePending خطا:', e.message);
        }
    },

    /**
     * ارسال تخصیص به Supabase — تک‌مسیر واحد (SupabaseDataModule.saveStepAssignment)
     * در صورت خطا، تغییر در صف می‌ماند تا در sync بعدی دوباره ارسال شود
     */
    async _pushAssignmentToSupabase(type, stepIndex, employeeId) {
        if (typeof SupabaseDataModule === 'undefined' ||
            typeof SupabaseDataModule.saveStepAssignment !== 'function') return;

        const ok = await SupabaseDataModule.saveStepAssignment(type, stepIndex, employeeId);
        if (ok) {
            // با موفقیت ارسال شد → از صف حذف کن
            const queue = this._getPendingQueue().filter(p =>
                !(p.pathType === type && Number(p.stepIndex) === Number(stepIndex)));
            this._setPendingQueue(queue);
            console.log(`✅ step_assignments: ${type}[${stepIndex}] → ${employeeId || 'حذف تخصیص'}`);
        } else {
            console.warn('⚠️ ذخیره تخصیص در Supabase ناموفق بود — در صف همگام‌سازی ماند');
            if (typeof UTILS !== 'undefined' && typeof UTILS.showNotification === 'function') {
                UTILS.showNotification('ذخیره تخصیص در سرور ناموفق بود — بعداً به‌صورت خودکار تلاش می‌شود', 'error');
            }
        }
    },

    /**
     * حذف task‌های pending یک مرحله از کارتابل کارمند
     * وقتی مرحله به حالت «بدون تخصیص» برگردانده می‌شود
     */
    _removeStepTasksForEmployee(employeeId, type, stepIndex) {
        try {
            const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
            const empTasks = (tasksData[employeeId] || []);
            const toDelete = empTasks.filter(t =>
                t.isStepTask &&
                t.stepType  === type &&
                t.stepIndex === stepIndex &&
                t.status    !== 'completed'
            );

            if (toDelete.length === 0) return;

            tasksData[employeeId] = empTasks.filter(t => !toDelete.includes(t));
            localStorage.setItem('employee_tasks', JSON.stringify(tasksData));
            console.log(`🗑️ ${toDelete.length} task(s) حذف شد از ${employeeId} برای ${type}[${stepIndex}]`);

            // حذف از Supabase — با helper امن (پشتیبانی از ID غیر UUID مثل step_...)
            if (typeof SupabaseDataModule !== 'undefined' && typeof SupabaseDataModule.deleteEmployeeTaskById === 'function') {
                toDelete.forEach(t => {
                    SupabaseDataModule.deleteEmployeeTaskById(t.id)
                        .catch(e => console.warn('⚠️ task delete Supabase خطا:', e.message));
                });
            }
        } catch (e) {
            console.warn('⚠️ _removeStepTasksForEmployee خطا:', e);
        }
    },

    /**
     * پاک‌سازی وظایف مرحله‌ایِ زائد یک کارمند:
     *  ۱) تسک‌های pending تکراری (همان دانشجو/مسیر/مرحله — قدیمی‌ترین نگه داشته می‌شود)
     *  ۲) تسک‌هایی که مرحله‌شان دیگر به این کارمند تخصیص ندارد
     *  ۳) تسک‌هایی که مرحله دانشجو از قبل تکمیل شده (اگر students_data موجود باشد)
     * بعد از syncAssignmentsFromSupabase صدا زده می‌شود تا تسک‌های حذف‌شده توسط مدیر
     * در دستگاه کارمند هم پاک شوند و دوباره ساخته نشوند.
     */
    reconcileStepTasks(employeeId) {
        try {
            const assignments = this.getAssignments(); // تازه sync شده
            // «شناخته‌شده» یعنی یا تخصیصی داریم یا حداقل یک‌بار در این سشن از
            // Supabase خوانده‌ایم — وگرنه وقتی همه مراحل بدون تخصیص‌اند،
            // شیء assignments خالی می‌شود و پاک‌سازی وظایف زائد skip می‌شد
            const assignmentsKnown = Object.keys(assignments).length > 0
                || this._syncedFromSupabase === true;

            const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
            const tasks = tasksData[employeeId] || [];
            if (tasks.length === 0) return 0;

            const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
            const seen = {};
            const toDelete = [];
            const keep = [];

            tasks.forEach(t => {
                if (!t.isStepTask || t.status === 'completed') { keep.push(t); return; }

                // ۱) مرحله دیگر به این کارمند تخصیص ندارد؟
                //    (اگر تخصیص‌ها اصلاً بارگذاری نشده‌اند، این قانون را رد کن)
                if (assignmentsKnown) {
                    const assigned = assignments[t.stepType] && assignments[t.stepType][t.stepIndex];
                    if (assigned !== employeeId) { toDelete.push(t); return; }
                }

                // ۲) مرحله دانشجو تکمیل شده؟ (فقط اگر داده دانشجو روی این دستگاه موجود باشد)
                const student = studentsData[t.studentId];
                if (student) {
                    // مسیر اشتباه (مثلاً وظیفه دفاع برای دانشجوی «در حال تحصیل») → حذف
                    // فقط وقتی currentPath صریح داریم تا حذف اشتباه رخ ندهد
                    if (student.currentPath && !this.isStepPathEligible(student, t.stepType)) {
                        toDelete.push(t); return;
                    }
                    // ملزومه‌ای که برای این دانشجو «لازم نیست» → وظیفهٔ آن حذف شود
                    if (t.stepType === 'requirements' && t.stepName &&
                        !this.isRequirementSelected(student, t.stepName)) {
                        toDelete.push(t); return;
                    }
                    let steps = null;
                    if (t.stepType === 'defense')          steps = student.defenseSteps;
                    else if (t.stepType === 'educational') steps = student.educationalSteps;
                    else if (t.stepType === 'requirements') steps = student.requirementsSteps;
                    const st = steps && steps[t.stepIndex];
                    if (st && st.completed) { toDelete.push(t); return; }
                }

                // ۳) تکراری؟
                const key = `${t.studentId}|${t.stepType}|${t.stepIndex}`;
                if (seen[key]) { toDelete.push(t); return; }
                seen[key] = true;

                keep.push(t);
            });

            if (toDelete.length === 0) return 0;

            tasksData[employeeId] = keep;
            localStorage.setItem('employee_tasks', JSON.stringify(tasksData));
            console.log(`🧹 reconcileStepTasks: ${toDelete.length} وظیفه زائد از کارتابل ${employeeId} پاک شد`);

            // حذف از Supabase — با helper امن (پشتیبانی از ID غیر UUID مثل step_...)
            if (typeof SupabaseDataModule !== 'undefined' && typeof SupabaseDataModule.deleteEmployeeTaskById === 'function') {
                toDelete.forEach(t => {
                    SupabaseDataModule.deleteEmployeeTaskById(t.id)
                        .catch(e => console.warn('⚠️ reconcile delete خطا:', e.message));
                });
            }

            // رفرش کارتابل اگر در حال نمایش است
            if (typeof EmployeeModule !== 'undefined' && typeof EmployeeModule.refreshMyTasks === 'function') {
                EmployeeModule.refreshMyTasks(employeeId);
            }
            return toDelete.length;
        } catch (e) {
            console.warn('⚠️ reconcileStepTasks خطا:', e);
            return 0;
        }
    },

    /**
     * پاک‌سازی دستی همه وظایف مرحله‌ایِ در انتظار کارمند (دکمه جاروی کارتابل)
     * برای مواقعی که تخصیص اشتباه باعث ساخت انبوه وظیفه شده است.
     * وظایف تکمیل‌شده به‌عنوان سابقه حفظ می‌شوند.
     */
    async cleanupAllMyStepTasks(employeeId) {
        if (!confirm('همه وظایف «مراحل دانشجویان»ِ در انتظار پاک شوند؟\n(وظایف تکمیل‌شده حفظ می‌شوند)')) return;
        try {
            const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
            const tasks = tasksData[employeeId] || [];
            const toDelete = tasks.filter(t => t.isStepTask && t.status !== 'completed');

            if (toDelete.length === 0) {
                if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
                    UTILS.showNotification('وظیفه مرحله‌ای در انتظاری وجود ندارد', 'info');
                }
                return;
            }

            tasksData[employeeId] = tasks.filter(t => !(t.isStepTask && t.status !== 'completed'));
            localStorage.setItem('employee_tasks', JSON.stringify(tasksData));
            console.log(`🧹 cleanupAllMyStepTasks: ${toDelete.length} وظیفه از ${employeeId} پاک شد`);

            // حذف از Supabase — با helper امن (پشتیبانی از ID غیر UUID مثل step_...)
            if (typeof SupabaseDataModule !== 'undefined' && typeof SupabaseDataModule.deleteEmployeeTaskById === 'function') {
                toDelete.forEach(t => {
                    SupabaseDataModule.deleteEmployeeTaskById(t.id)
                        .catch(e => console.warn('⚠️ cleanup delete خطا:', e.message));
                });
            }

            if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
                UTILS.showNotification(`🧹 ${toDelete.length} وظیفه مرحله‌ای پاک شد`, 'success');
            }
            if (typeof EmployeeModule !== 'undefined' && typeof EmployeeModule.refreshMyTasks === 'function') {
                EmployeeModule.refreshMyTasks(employeeId);
            }
        } catch (e) {
            console.warn('⚠️ cleanupAllMyStepTasks خطا:', e);
        }
    },

    /**
     * اگر مرحله‌ای به کارمند تخصیص داده شد و شرایط فعال بودن را داشت،
     * برای همه دانشجویانی که این مرحله در انتظارشان است task بساز.
     */
    _createTaskIfStepActive(type, stepIndex, employeeId) {
        try {
            const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
            const typeNames = { defense: 'گردش دفاع', educational: 'فارغ‌التحصیلی', requirements: 'ملزومات', studying: 'در حال تحصیل' };
            const typeName = typeNames[type] || type;

            Object.keys(studentsData).forEach(studentId => {
                const student = studentsData[studentId];
                if (!student) return;

                // 🔒 فقط دانشجویان همین مسیر — جلوگیری از ارسال انبوه وظایف دفاع
                // به دانشجویان «در حال تحصیل»
                if (!this.isStepPathEligible(student, type)) return;

                const steps = this._stepsForPath(student, type);
                if (!steps || !steps[stepIndex]) return;
                const thisStep = steps[stepIndex];

                // اگر این ملزومه برای دانشجو لازم نیست، وظیفه‌ای ساخته نشود
                if (type === 'requirements' && !this.isRequirementSelected(student, thisStep.name)) return;

                // اگر این مرحله قبلاً تکمیل شده، نیازی نیست
                if (thisStep.completed) return;

                // بررسی: مرحله قبلی تکمیل شده باشد یا این اولین مرحله باشد
                // (ملزومه‌ای که «لازم نیست» هم مثل تکمیل‌شده در نظر گرفته می‌شود)
                const prev = steps[stepIndex - 1];
                const prevCompleted = stepIndex === 0 ||
                    (prev && (prev.completed ||
                        (type === 'requirements' && !this.isRequirementSelected(student, prev.name))));
                if (!prevCompleted) return;

                // بررسی تکراری نبودن task
                const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
                const empTasks = tasksData[employeeId] || [];
                const exists = empTasks.find(t =>
                    t.isStepTask &&
                    t.studentId === studentId &&
                    t.stepType  === type &&
                    t.stepIndex === stepIndex &&
                    t.status    !== 'completed'
                );
                if (exists) return;

                const stepName = thisStep.name || ('مرحله ' + (stepIndex + 1));
                this.createTaskForEmployee({
                    employeeId,
                    studentId,
                    studentName: student.name || studentId,
                    type,
                    stepIndex,
                    stepName,
                    typeName,
                });
            });
        } catch (e) {
            console.warn('⚠️ _createTaskIfStepActive خطا:', e);
        }
    },

    /** دریافت کارمند تخصیص‌یافته به یک مرحله
     * @returns {string|null}  employeeId or null
     */
    getAssignedEmployee(type, stepIndex) {
        const assignments = this.getAssignments();
        return (assignments[type] && assignments[type][stepIndex]) || null;
    },

    /** دریافت نام کارمند */
    getEmployeeName(employeeId) {
        if (!employeeId) return '';
        const emp = this.getEmployees().find(e => e.id === employeeId);
        return emp ? emp.name : employeeId;
    },

    // ─── رندر dropdown تخصیص ─────────────────────────────────────────────────

    /**
     * تولید HTML برای نمایش dropdown کارمند در مدیریت مراحل
     */
    renderAssignDropdown(type, stepIndex) {
        const currentEmployee = this.getAssignedEmployee(type, stepIndex);
        const options = this.getEmployees().map(emp =>
            `<option value="${emp.id}" ${currentEmployee === emp.id ? 'selected' : ''}>${emp.name}</option>`
        ).join('');

        return `
            <select
                onchange="StepAssignmentModule.saveAssignment('${type}', ${stepIndex}, this.value)"
                class="step-assign-select bg-slate-600 text-white text-xs rounded-lg px-2 py-1 border border-slate-500 hover:border-blue-500 focus:border-blue-500 focus:outline-none min-w-[90px] cursor-pointer"
                title="تخصیص به کارمند">
                <option value="">بدون تخصیص</option>
                ${options}
            </select>
        `;
    },

    // ─── ایجاد وظیفه برای کارمند ─────────────────────────────────────────────

    /**
     * وقتی مدیر مرحله N را تیک سبز می‌زند، اگر مرحله N+1 به کارمندی تخصیص داده شده،
     * برای آن کارمند یک وظیفه ایجاد کن
     *
     * @param {string} studentId
     * @param {string} type      - "defense" | "educational" | "requirements"
     * @param {number} doneIndex - ایندکس مرحله‌ای که الان تکمیل شد
     * @param {object} [opts]    - { stepName, totalSteps } - اگر مراحل از students_data نباشند
     */
    triggerNextStepTask(studentId, type, doneIndex, opts = {}) {
        // دریافت اطلاعات دانشجو
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        const student = studentsData[studentId] || { name: studentId };

        // 🔒 فقط دانشجویان همین مسیر
        if (!this.isStepPathEligible(student, type)) return;

        // مراحل مربوط به این مسیر
        const steps = this._stepsForPath(student, type);

        // تعیین ایندکس مرحله بعدی
        // برای «ملزومات»، ملزومه‌های «لازم نیست» (requirementsExcluded) رد می‌شوند
        let nextIndex = doneIndex + 1;
        if (type === 'requirements') {
            nextIndex = -1;
            for (let j = doneIndex + 1; j < steps.length; j++) {
                const s = steps[j];
                if (!s || s.completed) continue;
                if (!this.isRequirementSelected(student, s.name)) continue;
                nextIndex = j;
                break;
            }
            if (nextIndex === -1) return; // ملزومهٔ لازمِ بعدی وجود ندارد
        }

        const assignedEmployeeId = this.getAssignedEmployee(type, nextIndex);
        if (!assignedEmployeeId) return; // مرحله بعدی به کسی تخصیص داده نشده

        // تعیین نام مرحله بعدی
        let nextStepName = (type === 'requirements') ? '' : (opts.nextStepName || '');
        if (!nextStepName) {
            if (nextIndex >= steps.length) return;
            const nextStep = steps[nextIndex];
            if (!nextStep) return;
            nextStepName = nextStep.name || `مرحله ${nextIndex + 1}`;

            // بررسی آیا قبلاً تکمیل شده / لازم نیست
            if (nextStep.completed) return;
            if (type === 'requirements' && !this.isRequirementSelected(student, nextStep.name)) return;
        }

        // نوع مسیر به فارسی
        const typeNames = { defense: 'گردش دفاع', educational: 'فارغ‌التحصیلی', requirements: 'ملزومات', studying: 'در حال تحصیل' };
        const typeName = typeNames[type] || type;

        // ایجاد وظیفه برای کارمند
        this.createTaskForEmployee({
            employeeId: assignedEmployeeId,
            studentId: studentId,
            studentName: student.name || studentId,
            type: type,
            stepIndex: nextIndex,
            stepName: nextStepName,
            typeName: typeName,
        });
    },

    /**
     * وظیفه را در localStorage ذخیره کن و به کارمند اطلاع بده
     */
    createTaskForEmployee({ employeeId, studentId, studentName, type, stepIndex, stepName, typeName }) {
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        if (!tasksData[employeeId]) tasksData[employeeId] = [];

        // بررسی تکراری نبودن (همان مرحله برای همان دانشجو)
        const duplicate = tasksData[employeeId].find(t =>
            t.isStepTask && t.studentId === studentId && t.stepType === type && t.stepIndex === stepIndex && t.status !== 'completed'
        );
        if (duplicate) {
            console.log(`⏩ Task already exists for step ${stepIndex} of ${type} for student ${studentId}`);
            return;
        }

        const task = {
            id: `step_${studentId}_${type}_${stepIndex}_${Date.now()}`,
            title: `${typeName} - مرحله ${stepIndex + 1}: ${stepName}`,
            description: `دانشجو: ${studentName}\nمرحله: ${stepName}\nمسیر: ${typeName}`,
            status: 'pending',
            priority: 'normal',
            createdAt: new Date().toISOString(),
            dueDate: '',
            // اطلاعات اضافه برای auto-complete
            isStepTask: true,
            studentId: studentId,
            studentName: studentName,
            stepType: type,
            stepIndex: stepIndex,
            stepName: stepName,
        };

        tasksData[employeeId].push(task);
        localStorage.setItem('employee_tasks', JSON.stringify(tasksData));

        // ذخیره در Supabase در پس‌زمینه
        if (typeof SupabaseDataModule !== 'undefined' &&
            typeof SupabaseConnection !== 'undefined' &&
            SupabaseConnection.isOnline) {
            SupabaseDataModule.saveEmployeeTask(employeeId, task)
                .catch(e => console.warn('⚠️ saveEmployeeTask async خطا:', e.message));

            // ارسال پیام سیستمی اطلاع‌رسانی (is_system = true)
            SupabaseDataModule.sendMessage({
                senderId:   null,
                receiverId: employeeId,
                content:    `📋 وظیفه جدید: ${stepName} (${typeName}) برای دانشجو ${studentName || studentId}`,
                isSystem:   true     // ← پیام خودکار سیستمی
            }).catch(() => {});
        }

        console.log(`✅ Task created for employee ${employeeId}: step ${stepIndex} of ${type} for student ${studentId}`);
        if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
            UTILS.showNotification(
                `📋 وظیفه «${stepName}» برای ${this.getEmployeeName(employeeId)} ارسال شد`,
                'success'
            );
        }
    },

    // ─── تکمیل خودکار مراحل قبلی ─────────────────────────────────────────────

    /**
     * وقتی مرحله‌ای تکمیل می‌شود، همهٔ مراحل قبلیِ همان مسیر هم باید «تکمیل شده» شوند.
     * دلیل: گردش کار ترتیبی است؛ تا مرحلهٔ N در اختیار کارمند قرار بگیرد یعنی
     * مراحل ۰..N-1 از قبل انجام شده‌اند. بدون این کار، نمای شیت مراحل قبلی را
     * قرمز (تکمیل‌نشده) نشان می‌داد.
     *
     * @param {string} studentId
     * @param {string} stepType  - "defense" | "educational" | "requirements"
     * @param {number} stepIndex - ایندکس مرحله‌ای که تازه تکمیل شده
     * @param {object} [opts]    - { skipSync: true } برای جلوگیری از sync دوباره
     * @returns {boolean} true اگر چیزی تغییر کرد
     */
    autoCompletePreviousSteps(studentId, stepType, stepIndex, opts = {}) {
        try {
            const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
            const student = studentsData[studentId];
            if (!student) return false;

            let steps;
            if (stepType === 'defense') {
                if (!student.defenseSteps) student.defenseSteps = (typeof EmployeeModule !== 'undefined') ? EmployeeModule.getDefaultDefenseSteps2() : [];
                steps = student.defenseSteps;
            } else if (stepType === 'educational') {
                if (!student.educationalSteps) student.educationalSteps = (typeof EmployeeModule !== 'undefined') ? EmployeeModule.getDefaultEducationalSteps() : [];
                steps = student.educationalSteps;
            } else if (stepType === 'requirements') {
                if (!student.requirementsSteps) student.requirementsSteps = (typeof EmployeeModule !== 'undefined') ? EmployeeModule.getDefaultRequirementsSteps() : [];
                steps = student.requirementsSteps;
            } else if (stepType === 'studying') {
                if (!student.studyingSteps) student.studyingSteps = (typeof EmployeeModule !== 'undefined') ? EmployeeModule.getDefaultStudyingSteps() : [];
                steps = student.studyingSteps;
            }
            if (!Array.isArray(steps) || steps.length === 0) return false;

            const today = new Date().toLocaleDateString('fa-IR');
            let changed = false;

            // ۱) مراحل ۰..stepIndex را تکمیل کن
            for (let i = 0; i <= stepIndex && i < steps.length; i++) {
                const st = steps[i];
                if (!st || st.completed) continue;
                st.completed  = true;
                st.paused     = false;
                st.inProgress = false;
                st.date       = st.date || today;
                changed = true;
            }
            if (changed) {
                studentsData[studentId] = student;
                localStorage.setItem('students_data', JSON.stringify(studentsData));
            }

            // ۲) آرایهٔ prog_ نمای شیت را هم‌راستا کن
            const totalSteps = steps.length;
            const progKey = `prog_${studentId}_${stepType}`;
            let prog = [];
            try {
                const raw = localStorage.getItem(progKey);
                if (raw) prog = JSON.parse(raw) || [];
            } catch (e) { prog = []; }
            while (prog.length < totalSteps) prog.push({ status: 0 });

            let progChanged = false;
            for (let i = 0; i <= stepIndex && i < totalSteps; i++) {
                if (!prog[i] || prog[i].status !== 2) { prog[i] = { status: 2 }; progChanged = true; }
            }
            if (stepIndex + 1 < totalSteps) {
                if (!prog[stepIndex + 1] || prog[stepIndex + 1].status !== 2) {
                    if (prog[stepIndex + 1]?.status !== 1) { prog[stepIndex + 1] = { status: 1 }; progChanged = true; }
                }
            }
            if (progChanged) {
                localStorage.setItem(progKey, JSON.stringify(prog));
                try { localStorage.setItem(`progts_${studentId}_${stepType}`, String(Date.now())); } catch (e) {}
            }

            // ۳) sync به Supabase
            if (!opts.skipSync) {
                const sb = (typeof SupabaseDataModule !== 'undefined') ? SupabaseDataModule : null;
                if (sb && typeof sb.saveStudentProgress === 'function') {
                    sb.saveStudentProgress(studentId, stepType, prog)
                        .catch(e => console.warn('⚠️ autoCompletePreviousSteps sync خطا:', e.message));
                }
            }

            return changed || progChanged;
        } catch (e) {
            console.warn('⚠️ autoCompletePreviousSteps خطا:', e);
            return false;
        }
    },

    /**
     * آیا این ملزومه برای دانشجو لازم است؟
     * دانشجوی بدون تنظیمات → همه لازم است.
     */
    isRequirementSelected(student, stepName) {
        if (!student) return true;
        const excluded = student.requirementsExcluded;
        if (!Array.isArray(excluded)) return true;
        return !excluded.includes(stepName);
    },

    /**
     * آیا این دانشجو واقعاً در این مسیر قرار دارد؟
     * جلوگیری از ساخته‌شدن وظیفه برای دانشجویان «در حال تحصیل» در مسیر دفاع.
     * اگر currentPath موجود نباشد، به نشانه‌های شروع مسیر تکیه می‌کنیم.
     */
    isStepPathEligible(student, type) {
        if (!student) return false;
        const cp = student.currentPath;

        if (type === 'defense') {
            if (cp) return cp === 'defense';
            return student.defenseStarted === true ||
                (Array.isArray(student.defenseSteps) && student.defenseSteps.some(s => s && s.completed));
        }
        if (type === 'requirements') {
            if (cp) return cp === 'defense' || cp === 'requirements';
            return student.defenseStarted === true ||
                (Array.isArray(student.requirementsSteps) && student.requirementsSteps.some(s => s && s.completed));
        }
        if (type === 'educational') {
            if (cp) return cp === 'educational';
            return student.graduated === true ||
                (Array.isArray(student.educationalSteps) && student.educationalSteps.some(s => s && s.completed));
        }
        if (type === 'studying') {
            if (cp) return cp === 'studying';
            return (Array.isArray(student.studyingSteps) && student.studyingSteps.some(s => s && s.completed));
        }
        return true;
    },

    /** انتخاب آرایهٔ مراحل یک مسیر از دانشجو */
    _stepsForPath(student, type) {
        if (!student) return [];
        if (type === 'defense')      return student.defenseSteps      || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultDefenseSteps2() : []);
        if (type === 'educational')  return student.educationalSteps  || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultEducationalSteps() : []);
        if (type === 'requirements') return student.requirementsSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultRequirementsSteps() : []);
        if (type === 'studying')     return student.studyingSteps     || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultStudyingSteps() : []);
        return [];
    },

    // ─── تکمیل خودکار مرحله وقتی کارمند وظیفه را انجام داد ─────────────────

    /**
     * وقتی کارمند یک وظیفه step را کامل می‌کند، مرحله مربوطه را در پروفایل دانشجو سبز می‌کند
     * @param {object} task - شیء وظیفه
     * @param {string} employeeId
     */
    onTaskCompleted(task, employeeId) {
        if (!task.isStepTask) return;

        const { studentId, stepType, stepIndex, stepName } = task;

        // ══════════════════════════════════════════════════════
        // 1. آپدیت students_data (برای پروفایل دانشجو و employee.js)
        // ══════════════════════════════════════════════════════
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        const student = studentsData[studentId];

        if (student) {
            let steps;
            if (stepType === 'defense') {
                if (!student.defenseSteps) student.defenseSteps = (typeof EmployeeModule !== 'undefined') ? EmployeeModule.getDefaultDefenseSteps2() : [];
                steps = student.defenseSteps;
            } else if (stepType === 'educational') {
                if (!student.educationalSteps) student.educationalSteps = (typeof EmployeeModule !== 'undefined') ? EmployeeModule.getDefaultEducationalSteps() : [];
                steps = student.educationalSteps;
            } else if (stepType === 'requirements') {
                if (!student.requirementsSteps) student.requirementsSteps = (typeof EmployeeModule !== 'undefined') ? EmployeeModule.getDefaultRequirementsSteps() : [];
                steps = student.requirementsSteps;
            } else if (stepType === 'studying') {
                if (!student.studyingSteps) student.studyingSteps = (typeof EmployeeModule !== 'undefined') ? EmployeeModule.getDefaultStudyingSteps() : [];
                steps = student.studyingSteps;
            }

            if (steps && steps[stepIndex]) {
                const today = new Date().toLocaleDateString('fa-IR');
                steps[stepIndex].completed  = true;
                steps[stepIndex].inProgress = false;
                steps[stepIndex].paused     = false;
                steps[stepIndex].date = today;
                steps[stepIndex].completedBy = employeeId;
                steps[stepIndex].completedByName = this.getEmployeeName(employeeId);

                // مراحل قبلیِ همان مسیر هم خودکار تکمیل شوند (رفع باگ قرمز شدن مرحلهٔ قبل)
                // عمداً روی همان آبجکت محلی انجام می‌شود تا نوشتن بعدی آن را از دست ندهد
                for (let i = 0; i < stepIndex && i < steps.length; i++) {
                    const st = steps[i];
                    if (st && !st.completed) {
                        st.completed  = true;
                        st.inProgress = false;
                        st.paused     = false;
                        st.date       = st.date || today;
                    }
                }

                studentsData[studentId] = student;
                localStorage.setItem('students_data', JSON.stringify(studentsData));
            }

            // بررسی اتوماتیک انتقال به فارغ‌التحصیلی
            if (stepType === 'defense' && student.defenseSteps) {
                const allDone = student.defenseSteps.every(s => s.completed);
                if (allDone) {
                    student.currentPath = 'educational';
                    if (!student.educationalSteps || student.educationalSteps.length === 0) {
                        student.educationalSteps = (typeof EmployeeModule !== 'undefined') ? EmployeeModule.getDefaultEducationalSteps() : [];
                    }
                    studentsData[studentId] = student;
                    localStorage.setItem('students_data', JSON.stringify(studentsData));
                    // trigger اولین مرحله فارغ‌التحصیلی
                    setTimeout(() => this.triggerFirstStepTask(studentId, 'educational'), 300);
                    setTimeout(() => {
                        UTILS.showNotification('🎓 همه مراحل دفاع تکمیل شد! دانشجو به مسیر فارغ‌التحصیلی منتقل شد.', 'success');
                    }, 400);
                }
            }
        }

        // ── ۲. آپدیت prog_${studentId}_${stepType} (برای نمای شیت)
        //    نمای شیت از STATUS_COMPLETED = 2 استفاده می‌کند
        // ══════════════════════════════════════════════════════
        const STATUS_COMPLETED = 2;
        const STATUS_CURRENT   = 1;
        const progKey = `prog_${studentId}_${stepType}`;

        try {
            // تعداد کل مراحل را بدست بیاور
            let totalSteps = 0;
            if (typeof EmployeeModule !== 'undefined') {
                if (stepType === 'defense')      totalSteps = EmployeeModule.getDefaultDefenseSteps2().length;
                else if (stepType === 'educational') totalSteps = EmployeeModule.getDefaultEducationalSteps().length;
                else if (stepType === 'requirements') totalSteps = EmployeeModule.getDefaultRequirementsSteps().length;
                else if (stepType === 'studying') totalSteps = EmployeeModule.getDefaultStudyingSteps().length;
            }

            // بارگذاری یا ساخت آرایه پیشرفت
            let prog = [];
            const savedProg = localStorage.getItem(progKey);
            if (savedProg) {
                prog = JSON.parse(savedProg);
            }

            // اطمینان از اینکه آرایه به اندازه کافی بزرگ است
            while (prog.length <= stepIndex) {
                prog.push({ status: 0 });
            }

            // تیک سبز در نمای شیت
            prog[stepIndex] = { status: STATUS_COMPLETED };

            // مراحل قبلی هم سبز شوند (رفع باگ قرمز شدن مرحلهٔ قبل)
            for (let i = 0; i < stepIndex; i++) {
                if (!prog[i] || prog[i].status !== STATUS_COMPLETED) {
                    prog[i] = { status: STATUS_COMPLETED };
                }
            }

            // مرحله بعدی را "در حال انجام" کن (اگر وجود دارد و هنوز کامل نشده)
            if (stepIndex + 1 < totalSteps) {
                while (prog.length <= stepIndex + 1) prog.push({ status: 0 });
                if (prog[stepIndex + 1].status !== STATUS_COMPLETED) {
                    prog[stepIndex + 1] = { status: STATUS_CURRENT };
                }
            }

            localStorage.setItem(progKey, JSON.stringify(prog));
            // مهر ویرایش محلی — اینجا تکمیل مرحله توسط کارمند است (ویرایش واقعی)
            try { localStorage.setItem(`progts_${studentId}_${stepType}`, String(Date.now())); } catch (e) {}
            console.log(`✅ Sheet view updated: prog_${studentId}_${stepType}[${stepIndex}] = completed`);

            // ── sync به Supabase ──────────────────────────────
            const sb = (typeof SupabaseDataModule !== 'undefined') ? SupabaseDataModule : null;
            if (sb && typeof sb.saveStudentProgress === 'function') {
                sb.saveStudentProgress(studentId, stepType, prog)
                    .catch(e => console.warn('⚠️ step-assignment prog sync خطا:', e.message));
            }
        } catch (e) {
            console.warn('⚠️ Could not update sheet view progress:', e);
        }

        // ══════════════════════════════════════════════════════
        // 3. نمایش اعلان و trigger مرحله بعدی
        // ══════════════════════════════════════════════════════
        const studentName = (student && student.name) || studentId;
        if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
            UTILS.showNotification(
                `✅ مرحله «${stepName}» برای دانشجو ${studentName} تکمیل شد`,
                'success'
            );
        }

        // trigger وظیفه مرحله بعدی برای کارمند بعدی
        this.triggerNextStepTask(studentId, stepType, stepIndex);

        console.log(`✅ Step ${stepIndex} of ${stepType} auto-completed for student ${studentId} by employee ${employeeId}`);
    },

    // ─── ارسال وظایف مراحل فعال به کارمندان ────────────────────────────────────

    /**
     * برای همه دانشجویان، مرحله «فعال فعلی» هر مسیر را بررسی کن
     * اگر آن مرحله به کارمندی تخصیص داده شده و هنوز task ندارد → task بساز
     *
     * مدیر می‌تواند از دکمه «همگام‌سازی وظایف» این را اجرا کند
     */
    syncAllActiveSteps() {
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        const types = ['studying', 'defense', 'educational', 'requirements'];
        const typeNames = { defense: 'گردش دفاع', educational: 'فارغ‌التحصیلی', requirements: 'ملزومات', studying: 'در حال تحصیل' };
        let created = 0;

        Object.keys(studentsData).forEach(studentId => {
            const student = studentsData[studentId];
            if (!student) return;

            types.forEach(type => {
                // 🔒 فقط دانشجویان همین مسیر (جلوگیری از ارسال وظایف دفاع به «در حال تحصیل»)
                if (!this.isStepPathEligible(student, type)) return;

                const steps = this._stepsForPath(student, type);
                if (!steps || steps.length === 0) return;

                // پیدا کردن اولین مرحله‌ای که تکمیل نشده
                // برای «ملزومات»، ملزومه‌های لازم‌نبوده (requirementsExcluded) رد می‌شوند
                const activeIdx = (type === 'requirements')
                    ? steps.findIndex(s => s && !s.completed && this.isRequirementSelected(student, s.name))
                    : steps.findIndex(s => s && !s.completed);
                if (activeIdx === -1) return; // همه تموم شده

                const employeeId = this.getAssignedEmployee(type, activeIdx);
                if (!employeeId) return; // به کسی تخصیص نداده

                // بررسی تکراری نبودن
                const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
                const empTasks = tasksData[employeeId] || [];
                const exists = empTasks.find(t =>
                    t.isStepTask &&
                    t.studentId === studentId &&
                    t.stepType  === type &&
                    t.stepIndex === activeIdx &&
                    t.status    !== 'completed'
                );
                if (exists) return;

                const stepName = steps[activeIdx].name || ('مرحله ' + (activeIdx + 1));
                this.createTaskForEmployee({
                    employeeId,
                    studentId,
                    studentName: student.name || studentId,
                    type,
                    stepIndex: activeIdx,
                    stepName,
                    typeName: typeNames[type],
                });
                created++;
            });
        });

        const msg = created > 0
            ? `✅ ${created} وظیفه جدید برای کارمندان ارسال شد`
            : 'همه وظایف قبلاً ارسال شده‌اند';
        if (typeof UTILS !== 'undefined' && UTILS.showNotification) {
            UTILS.showNotification(msg, created > 0 ? 'success' : 'info');
        }
        console.log(`syncAllActiveSteps: ${created} tasks created`);
        return created;
    },

    /**
     * trigger مرحله اول (index=0) یک مسیر برای یک دانشجوی مشخص
     * وقتی دانشجو وارد مسیر جدید می‌شود صدا زده می‌شود
     */
    triggerFirstStepTask(studentId, type) {
        const employeeId = this.getAssignedEmployee(type, 0);
        if (!employeeId) return;

        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        const student = studentsData[studentId];
        if (!student) return;

        // 🔒 فقط دانشجویان همین مسیر
        if (!this.isStepPathEligible(student, type)) return;

        const steps = this._stepsForPath(student, type);
        if (!steps || steps.length === 0) return;

        // برای «ملزومات» اولین ملزومهٔ لازم و تکمیل‌نشده را هدف بگیر
        let targetIdx = 0;
        if (type === 'requirements') {
            targetIdx = steps.findIndex(s => s && !s.completed && this.isRequirementSelected(student, s.name));
            if (targetIdx === -1) return;
        } else if (steps[0].completed) {
            return;
        }

        const targetEmployeeId = this.getAssignedEmployee(type, targetIdx) || employeeId;
        const typeNames = { defense: 'گردش دفاع', educational: 'فارغ‌التحصیلی', requirements: 'ملزومات', studying: 'در حال تحصیل' };
        const stepName = steps[targetIdx].name || ('مرحله ' + (targetIdx + 1));

        // بررسی تکراری
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        const empTasks = tasksData[targetEmployeeId] || [];
        const exists = empTasks.find(t =>
            t.isStepTask && t.studentId === studentId &&
            t.stepType === type && t.stepIndex === targetIdx && t.status !== 'completed'
        );
        if (exists) return;

        this.createTaskForEmployee({
            employeeId: targetEmployeeId,
            studentId,
            studentName: student.name || studentId,
            type,
            stepIndex: targetIdx,
            stepName,
            typeName: typeNames[type] || type,
        });
    },

};

// expose globally
window.StepAssignmentModule = StepAssignmentModule;
