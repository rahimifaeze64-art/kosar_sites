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

    // لیست کارمندان ثابت (همگام با app.js)
    EMPLOYEES: [
        { id: 'emp001', name: 'سارا سادات حسینی' },
        { id: 'emp002', name: 'زینب بتول محمدی' },
        { id: 'emp003', name: 'علیرضا غلامی فرزاد' },
        { id: 'emp004', name: 'سید محمد فاضلی' },
    ],

    // کلید ذخیره‌سازی در localStorage
    STORAGE_KEY: 'step_assignments',

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

    /** ذخیره تخصیص یک مرحله
     * @param {string} type  - "defense" | "educational" | "requirements"
     * @param {number} stepIndex
     * @param {string} employeeId - "emp001" | "" (برای حذف تخصیص)
     */
    saveAssignment(type, stepIndex, employeeId) {
        // ذخیره محلی همیشه
        const assignments = this.getAssignments();
        if (!assignments[type]) assignments[type] = {};
        if (employeeId) {
            assignments[type][stepIndex] = employeeId;
        } else {
            delete assignments[type][stepIndex];
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(assignments));

        // ذخیره در Supabase در پس‌زمینه (step_assignments table)
        if (typeof DataModule !== 'undefined' && typeof DataModule.saveStepAssignment === 'function') {
            DataModule.saveStepAssignment(type, stepIndex, employeeId || null)
                .catch(e => console.warn('⚠️ saveStepAssignment async خطا:', e.message));
        }

        // ── اگر کارمندی تخصیص داده شد، بررسی کن آیا این مرحله "فعال" است ──
        // یعنی مرحله قبلی تکمیل شده (یا این اولین مرحله است) و خودش هنوز تکمیل نشده
        if (employeeId) {
            this._createTaskIfStepActive(type, stepIndex, employeeId);
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
        const emp = this.EMPLOYEES.find(e => e.id === employeeId);
        return emp ? emp.name : employeeId;
    },

    // ─── رندر dropdown تخصیص ─────────────────────────────────────────────────

    /**
     * تولید HTML برای نمایش dropdown کارمند در مدیریت مراحل
     */
    renderAssignDropdown(type, stepIndex) {
        const currentEmployee = this.getAssignedEmployee(type, stepIndex);
        const options = this.EMPLOYEES.map(emp =>
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

        // ══════════════════════════════════════════════════════
        // 2. آپدیت prog_${studentId}_${stepType} (برای نمای شیت)
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
