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

            // حذف از Supabase
            if (typeof SupabaseDataModule !== 'undefined' && typeof SupabaseDataModule._db === 'function') {
                const client = SupabaseDataModule._db();
                if (client) {
                    toDelete.forEach(t => {
                        client.from('employee_tasks').delete().eq('id', t.id)
                            .then(({ error }) => { if (error) console.warn('⚠️ task delete Supabase خطا:', error.message); });
                    });
                }
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
            const assignmentsKnown = Object.keys(assignments).length > 0;

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

            // حذف از Supabase
            if (typeof SupabaseDataModule !== 'undefined' && typeof SupabaseDataModule._db === 'function') {
                const client = SupabaseDataModule._db();
                if (client) {
                    toDelete.forEach(t => {
                        client.from('employee_tasks').delete().eq('id', t.id)
                            .then(({ error }) => { if (error) console.warn('⚠️ reconcile delete خطا:', error.message); });
                    });
                }
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

            // حذف از Supabase
            if (typeof SupabaseDataModule !== 'undefined' && typeof SupabaseDataModule._db === 'function') {
                const client = SupabaseDataModule._db();
                if (client) {
                    toDelete.forEach(t => {
                        client.from('employee_tasks').delete().eq('id', t.id)
                            .then(({ error }) => { if (error) console.warn('⚠️ cleanup delete خطا:', error.message); });
                    });
                }
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
            const typeNames = { defense: 'گردش دفاع', educational: 'فارغ‌التحصیلی', requirements: 'ملزومات' };
            const typeName = typeNames[type] || type;

            Object.keys(studentsData).forEach(studentId => {
                const student = studentsData[studentId];
                if (!student) return;

                let steps = [];
                if (type === 'defense')      steps = student.defenseSteps      || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultDefenseSteps2()       : []);
                else if (type === 'educational') steps = student.educationalSteps  || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultEducationalSteps()    : []);
                else if (type === 'requirements') steps = student.requirementsSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultRequirementsSteps()  : []);

                if (!steps || !steps[stepIndex]) return;
                const thisStep = steps[stepIndex];

                // اگر این مرحله قبلاً تکمیل شده، نیازی نیست
                if (thisStep.completed) return;

                // بررسی: مرحله قبلی تکمیل شده باشد یا این اولین مرحله باشد
                const prevCompleted = stepIndex === 0 || (steps[stepIndex - 1] && steps[stepIndex - 1].completed);
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
        const nextIndex = doneIndex + 1;

        const assignedEmployeeId = this.getAssignedEmployee(type, nextIndex);
        if (!assignedEmployeeId) return; // مرحله بعدی به کسی تخصیص داده نشده

        // دریافت اطلاعات دانشجو
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        const student = studentsData[studentId] || { name: studentId };

        // تعیین نام مرحله بعدی
        let nextStepName = opts.nextStepName || '';
        if (!nextStepName) {
            let steps = [];
            if (type === 'defense') steps = student.defenseSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultDefenseSteps2() : []);
            else if (type === 'educational') steps = student.educationalSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultEducationalSteps() : []);
            else if (type === 'requirements') steps = student.requirementsSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultRequirementsSteps() : []);

            if (nextIndex >= steps.length) return;
            const nextStep = steps[nextIndex];
            if (!nextStep) return;
            nextStepName = nextStep.name || `مرحله ${nextIndex + 1}`;

            // بررسی آیا قبلاً تکمیل شده
            if (nextStep.completed) return;
        }

        // نوع مسیر به فارسی
        const typeNames = { defense: 'گردش دفاع', educational: 'فارغ‌التحصیلی', requirements: 'ملزومات' };
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
            }

            if (steps && steps[stepIndex]) {
                steps[stepIndex].completed = true;
                steps[stepIndex].date = new Date().toLocaleDateString('fa-IR');
                steps[stepIndex].completedBy = employeeId;
                steps[stepIndex].completedByName = this.getEmployeeName(employeeId);
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

            // مرحله بعدی را "در حال انجام" کن (اگر وجود دارد و هنوز کامل نشده)
            if (stepIndex + 1 < totalSteps) {
                while (prog.length <= stepIndex + 1) prog.push({ status: 0 });
                if (prog[stepIndex + 1].status !== STATUS_COMPLETED) {
                    prog[stepIndex + 1] = { status: STATUS_CURRENT };
                }
            }

            localStorage.setItem(progKey, JSON.stringify(prog));
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
        const types = ['defense', 'educational', 'requirements'];
        const typeNames = { defense: 'گردش دفاع', educational: 'فارغ‌التحصیلی', requirements: 'ملزومات' };
        let created = 0;

        Object.keys(studentsData).forEach(studentId => {
            const student = studentsData[studentId];
            if (!student) return;

            types.forEach(type => {
                let steps = [];
                if (type === 'defense')
                    steps = student.defenseSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultDefenseSteps2() : []);
                else if (type === 'educational')
                    steps = student.educationalSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultEducationalSteps() : []);
                else if (type === 'requirements')
                    steps = student.requirementsSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultRequirementsSteps() : []);

                if (!steps || steps.length === 0) return;

                // پیدا کردن اولین مرحله‌ای که تکمیل نشده
                const activeIdx = steps.findIndex(s => !s.completed);
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

        let steps = [];
        if (type === 'defense')
            steps = student.defenseSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultDefenseSteps2() : []);
        else if (type === 'educational')
            steps = student.educationalSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultEducationalSteps() : []);
        else if (type === 'requirements')
            steps = student.requirementsSteps || (typeof EmployeeModule !== 'undefined' ? EmployeeModule.getDefaultRequirementsSteps() : []);

        if (!steps || !steps[0] || steps[0].completed) return;

        const typeNames = { defense: 'گردش دفاع', educational: 'فارغ‌التحصیلی', requirements: 'ملزومات' };
        const stepName = steps[0].name || 'مرحله ۱';

        // بررسی تکراری
        const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        const empTasks = tasksData[employeeId] || [];
        const exists = empTasks.find(t =>
            t.isStepTask && t.studentId === studentId &&
            t.stepType === type && t.stepIndex === 0 && t.status !== 'completed'
        );
        if (exists) return;

        this.createTaskForEmployee({
            employeeId,
            studentId,
            studentName: student.name || studentId,
            type,
            stepIndex: 0,
            stepName,
            typeName: typeNames[type] || type,
        });
    },

};

// expose globally
window.StepAssignmentModule = StepAssignmentModule;
