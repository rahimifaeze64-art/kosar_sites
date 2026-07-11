// ============================================================
// students-sync.js
// Bridge مرکزی برای sync داده دانشجویان به Supabase
//
// مشکل: ده‌ها جای در کد localStorage.setItem('students_data', ...) صدا زده می‌شود.
// راه‌حل: این فایل localStorage.setItem رو override می‌کند تا هر بار که
//         students_data ذخیره شد، sync به Supabase هم انجام شود.
//
// بارگذاری: این فایل باید بعد از supabase-data.js و supabase-config.js
//           ولی قبل از employee.js و بقیه فایل‌ها لود شود.
// ============================================================

(function () {
    'use strict';

    const STUDENTS_KEY = 'students_data';
    const DEBOUNCE_MS  = 1500;   // تاخیر برای جلوگیری از sync بیش از حد
    let _debounceTimer = null;

    // ── Helper ──────────────────────────────────────────────
    function _sb() {
        return typeof SupabaseDataModule !== 'undefined' &&
               typeof SupabaseConnection  !== 'undefined' &&
               SupabaseConnection.isOnline === true
               ? SupabaseDataModule : null;
    }

    // ── تبدیل student.defenseSteps به فرمت student_progress ─
    // فرمت ذخیره در employee.js: [{ name, completed, date, notes, ... }, ...]
    // فرمت student_progress:     [{ status: 0|1|2 }, ...]  (0=pending,1=current,2=done)
    function _stepsToProgress(stepsArr) {
        if (!Array.isArray(stepsArr)) return [];
        let foundFirst = false;
        // از آخر به اول می‌رویم تا اولین مرحله ناتمام رو پیدا کنیم
        const statuses = stepsArr.map(s => s.completed ? 2 : 0);
        // اولین 0 بعد از آخرین 2 = وضعیت 1 (در حال انجام)
        for (let i = 0; i < statuses.length; i++) {
            if (statuses[i] === 0 && !foundFirst) {
                statuses[i] = 1;
                foundFirst = true;
            }
        }
        return statuses.map(s => ({ status: s }));
    }

    // ── sync یک دانشجو به Supabase ─────────────────────────
    async function _syncStudent(studentId, student) {
        const sb = _sb();
        if (!sb) return;

        const pathMap = [
            { key: 'defenseSteps',       pathType: 'defense'      },
            { key: 'educationalSteps',   pathType: 'educational'  },
            { key: 'requirementsSteps',  pathType: 'requirements' },
        ];

        for (const { key, pathType } of pathMap) {
            if (!student[key] || !Array.isArray(student[key])) continue;
            const progress = _stepsToProgress(student[key]);
            if (progress.length === 0) continue;
            try {
                await sb.saveStudentProgress(studentId, pathType, progress);
            } catch (e) {
                console.warn(`⚠️ students-sync [${studentId}/${pathType}]:`, e.message);
            }
        }
    }

    // ── sync همه دانشجویان (debounced) ───────────────────────
    function _syncAll(studentsData) {
        const sb = _sb();
        if (!sb) return;

        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(async () => {
            const entries = Object.entries(studentsData);
            console.log(`🔄 students-sync: syncing ${entries.length} students to Supabase...`);
            let synced = 0;
            for (const [id, student] of entries) {
                await _syncStudent(id, student);
                synced++;
            }
            console.log(`✅ students-sync: ${synced} students synced`);
        }, DEBOUNCE_MS);
    }

    // ── Override localStorage.setItem ────────────────────────
    const _origSetItem = localStorage.setItem.bind(localStorage);

    localStorage.setItem = function (key, value) {
        // اجرای اصلی همیشه انجام می‌شه
        _origSetItem(key, value);

        // اگر students_data تغییر کرد، sync کن
        if (key === STUDENTS_KEY) {
            try {
                const parsed = JSON.parse(value);
                if (parsed && typeof parsed === 'object') {
                    _syncAll(parsed);
                }
            } catch (e) {
                // JSON parse خطا — نادیده می‌گیریم
            }
        }
    };

    // ── بارگذاری اولیه از Supabase ──────────────────────────
    // هنگام load صفحه: اگر Supabase آنلاین است، پیشرفت دانشجویان را
    // از Supabase بخوان و با students_data محلی merge کن
    async function _initialLoad() {
        const sb = _sb();
        if (!sb) return;

        try {
            const raw = localStorage.getItem(STUDENTS_KEY);
            const studentsData = raw ? JSON.parse(raw) : {};
            const studentIds = Object.keys(studentsData);
            if (studentIds.length === 0) return;

            const pathTypes = ['defense', 'educational', 'requirements'];
            const pathToKey = {
                defense:      'defenseSteps',
                educational:  'educationalSteps',
                requirements: 'requirementsSteps'
            };

            let mergeCount = 0;

            for (const studentId of studentIds) {
                const student = studentsData[studentId];

                for (const pathType of pathTypes) {
                    try {
                        const progress = await sb.getStudentProgress(studentId, pathType);
                        if (!progress || progress.length === 0) continue;

                        const stepsKey = pathToKey[pathType];
                        const localSteps = student[stepsKey];
                        if (!Array.isArray(localSteps) || localSteps.length === 0) continue;

                        // merge: وضعیت Supabase را اعمال کن روی ساختار محلی
                        const merged = localSteps.map((step, i) => {
                            const prog = progress[i];
                            if (!prog) return step;
                            return {
                                ...step,
                                completed: prog.status === 2,
                                // اگر status=1 یعنی در حال انجام (completed=false)
                            };
                        });

                        student[stepsKey] = merged;
                        mergeCount++;
                    } catch (e) {
                        // ادامه می‌دهیم
                    }
                }

                studentsData[studentId] = student;
            }

            if (mergeCount > 0) {
                // ذخیره بدون trigger کردن دوباره sync
                _origSetItem(STUDENTS_KEY, JSON.stringify(studentsData));
                console.log(`✅ students-sync: initial load merged ${mergeCount} paths from Supabase`);
            }
        } catch (e) {
            console.warn('⚠️ students-sync initial load خطا:', e.message);
        }
    }

    // ── اجرای initial load بعد از اتصال Supabase ────────────
    // منتظر می‌مانیم تا supabase-init.js اتصال را برقرار کند
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(_initialLoad, 2000); // 2 ثانیه صبر برای اتصال
        });
    } else {
        setTimeout(_initialLoad, 2000);
    }

    // expose برای دسترسی دستی
    window.StudentsSync = {
        syncStudent:  _syncStudent,
        syncAll:      (data) => _syncAll(data || JSON.parse(localStorage.getItem(STUDENTS_KEY) || '{}')),
        initialLoad:  _initialLoad,
    };

    console.log('📦 students-sync.js بارگذاری شد — students_data override فعال');
})();
