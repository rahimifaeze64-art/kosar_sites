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

    // ── diff: آخرین وضعیت سینک‌شده هر دانشجو (id → امضای JSON) ──
    // null یعنی هنوز seed نشده → اولین sync کل داده ارسال می‌شود (مثل رفتار قدیمی)
    let _syncedSigs = null;
    const SYNC_STUDENT_DEBOUNCE_MS = 400;  // debounce مسیر sync تکی (iframe)

    // ⚠️ گیت ضد-ریست: تا بارگذاری اولیه از Supabase (pull) تمام نشده، هیچ sync
    // صعودی نباید انجام شود. علت: هنگام باز شدن مرورگر جدید، init-students-data.js
    // students_data را با مراحل پیش‌فرضِ همه-ناتمام می‌سازد؛ اگر همین دادهٔ
    // پیش‌فرض قبل از pull به DB برود، مراحل تکمیل‌شده در DB صفر می‌شوند
    // (باگ «ریست شدن سبزها در مرورگر جدید»).
    let _initialPullDone = false;

    // از بیرون (supabase-init.js) صدا زده می‌شود بعد از getAllStudentProgress
    function markInitialPullDone() {
        _initialPullDone = true;
        console.log('✅ students-sync: گیت ضد-ریست باز شد — sync صعودی فعال');
    }

    function _sig(student) {
        try { return JSON.stringify(student); } catch (e) { return null; }
    }

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
        // 0=ناتمام، 1=در حال انجام، 2=تکمیل شده، 3=متوقف شده
        const statuses = stepsArr.map(s => s.completed ? 2 : (s.paused ? 3 : (s.inProgress ? 1 : 0)));
        return statuses.map(s => ({ status: s }));
    }

    // ── sync یک دانشجو به Supabase ─────────────────────────
    async function _syncStudent(studentId, student) {
        const sb = _sb();
        if (!sb) return false;
        let ok = true; // نتیجه نهایی — false یعنی بخشی سینک نشد (بعداً دوباره تلاش شود)

        // ── ۱. sync پیشرفت مراحل (student_progress) ──────────
        const pathMap = [
            { key: 'defenseSteps',       pathType: 'defense'      },
            { key: 'educationalSteps',   pathType: 'educational'  },
            { key: 'requirementsSteps',  pathType: 'requirements' },
        ];

        // سه مسیر به‌صورت «موازی» ارسال می‌شوند — await ترتیبی یعنی ۳ round-trip
        // پشت‌سرهم به‌ازای هر دانشجو (یکی از علت‌های اصلی کندی sync)
        await Promise.all(pathMap.map(({ key, pathType }) => {
            if (!student[key] || !Array.isArray(student[key])) return null;
            const progress = _stepsToProgress(student[key]);
            if (progress.length === 0) return null;
            // 🔍 دیاگستیک: وضعیتی که به DB فرستاده می‌شود — برای ردیابی نویسندهٔ 0ها
            console.log(`📤 students-sync: ${studentId}/${pathType} → [${progress.map(p => p.status).join(',')}]`);
            return sb.saveStudentProgress(studentId, pathType, progress)
                .catch(e => { ok = false; console.warn(`⚠️ students-sync [${studentId}/${pathType}]:`, e.message); });
        }));

        // ── ۲. sync وضعیت تحصیلی به profiles ─────────────────
        // graduated, current_path, active, finished_date
        try {
            const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
            if (!client) return ok;

            const profileUpdate = {};

            // graduated
            if (student.graduated !== undefined)
                profileUpdate.graduated = !!student.graduated;

            // graduated_date
            if (student.graduatedDate)
                profileUpdate.graduated_date = student.graduatedDate;

            // current_path — 'studying' (در حال تحصیل) هم یک مسیر مستقل است
            if (student.currentPath && ['defense','educational','requirements','studying'].includes(student.currentPath))
                profileUpdate.current_path = student.currentPath;

            // active
            if (student.active !== undefined)
                profileUpdate.active = !!student.active;

            // finished_date
            if (student.finishedDate)
                profileUpdate.finished_date = student.finishedDate;

            // students_meta — ذخیره کامل برای fallback
            profileUpdate.students_meta = {
                defenseStepsCount:     (student.defenseSteps     || []).length,
                educationalStepsCount: (student.educationalSteps || []).length,
                requirementsCount:     (student.requirementsSteps|| []).length,
                defenseCompleted:      (student.defenseSteps     || []).filter(s=>s.completed).length,
                educationalCompleted:  (student.educationalSteps || []).filter(s=>s.completed).length,
                requirementsCompleted: (student.requirementsSteps|| []).filter(s=>s.completed).length,
                lastUpdated:           new Date().toISOString(),
            };

            if (Object.keys(profileUpdate).length > 0) {
                const { error } = await client
                    .from('profiles')
                    .update(profileUpdate)
                    .eq('id', studentId);

                if (error && error.code !== 'PGRST116') { // PGRST116 = no row matched (student با این id نیست)
                    ok = false;
                    console.warn(`⚠️ students-sync profile update [${studentId}]:`, error.message);
                }
            }
        } catch (e) {
            ok = false;
            console.warn(`⚠️ students-sync profile sync [${studentId}]:`, e.message);
        }
        return ok;
    }

    // ── sync همه دانشجویان (debounced) ───────────────────────
    function _syncAll(studentsData) {
        // تا pull اولیه تمام نشده، چیزی به DB نرو — دادهٔ محلی پیش‌فرض است
        if (!_initialPullDone) {
            console.log('⏭️ students-sync: skip (initial pull نه کامل شده — جلوگیری از ریست)');
            return;
        }
        const sb = _sb();
        if (!sb) return;

        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(async () => {
            const entries = Object.entries(studentsData);

            // ── diff: فقط دانشجویانی که از آخرین sync موفق تغییر کرده‌اند ──
            const isFirstSync = (_syncedSigs === null);
            if (isFirstSync) _syncedSigs = {};
            const changed = [];
            entries.forEach(([id, student]) => {
                const sig = _sig(student);
                if (isFirstSync || _syncedSigs[id] !== sig) changed.push([id, student, sig]);
            });

            if (changed.length === 0) return;

            console.log(`🔄 students-sync: syncing ${changed.length}/${entries.length} changed students to Supabase...`);
            // همگام‌سازی موازی با window متحرک (۸ درخواست همزمان، بدون انتظار تمام‌وکمال
            // هر دسته برای شروع دستهٔ بعد) — ۳۰۵ دانشجو ≈ ۴ برابر سریع‌تر از دسته‌بندی ترتیبی
            const MAX_CONCURRENT = 8;
            let idx = 0;
            let synced = 0;
            const worker = async () => {
                while (idx < changed.length) {
                    const [id, student, sig] = changed[idx++];
                    await _syncStudent(id, student)
                        .then((ok) => {
                            if (ok !== false) _syncedSigs[id] = sig; // فقط sync موفق علامت بخورد
                            synced++;
                        })
                        .catch(e => console.warn(`⚠️ students-sync [${id}]:`, e.message));
                }
            };
            await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, changed.length) }, worker));
            console.log(`✅ students-sync: ${synced} students synced`);
        }, DEBOUNCE_MS);
    }

    // ── sync تکی دانشجو با debounce ──────────────────────────
    // مسیر sheet (iframe) بعد از هر toggle این را صدا می‌زند؛ debounce کوتاه باعث
    // می‌شود چند تغییر پشت‌سرهم فقط یک‌بار ارسال شوند و diff هم اعمال شود
    const _pendingStudents = new Map();
    let _studentFlushTimer = null;

    function syncStudentDebounced(studentId, student) {
        if (!studentId || !student) return;
        _pendingStudents.set(String(studentId), student);
        if (_studentFlushTimer) clearTimeout(_studentFlushTimer);
        _studentFlushTimer = setTimeout(_flushPendingStudents, SYNC_STUDENT_DEBOUNCE_MS);
    }

    async function _flushPendingStudents() {
        _studentFlushTimer = null;
        if (_pendingStudents.size === 0) return;
        // تا pull اولیه تمام نشده، ارسال نکن (همان گیت ضد-ریست)
        if (!_initialPullDone) return;
        const pending = Array.from(_pendingStudents.entries());
        _pendingStudents.clear();

        if (!_sb()) return; // آفلاین — تغییر بعدی دوباره sync می‌کند

        const isFirstSync = (_syncedSigs === null);
        if (isFirstSync) _syncedSigs = {};

        const toSync = [];
        pending.forEach(([id, student]) => {
            const sig = _sig(student);
            if (_syncedSigs[id] !== sig) toSync.push([id, student, sig]);
        });
        if (toSync.length === 0) return;

        // window متحرک — ۸ درخواست همزمان، بدون انتظار تمام‌وکمال هر دسته
        const MAX_CONCURRENT = 8;
        let idx = 0;
        const worker = async () => {
            while (idx < toSync.length) {
                const [id, student, sig] = toSync[idx++];
                await _syncStudent(id, student)
                    .then((ok) => { if (ok !== false) _syncedSigs[id] = sig; })
                    .catch(e => console.warn(`⚠️ students-sync [${id}]:`, e.message));
            }
        };
        await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, toSync.length) }, worker));
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

            // ── بارگذاری وضعیت profiles (graduated, current_path, etc.) ──
            try {
                const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
                if (client) {
                    const { data: profileRows, error } = await client
                        .from('profiles')
                        .select('id, graduated, graduated_date, current_path, active, finished_date')
                        .in('id', studentIds)
                        .eq('role', 'student');

                    if (!error && profileRows && profileRows.length > 0) {
                        profileRows.forEach(p => {
                            if (!studentsData[p.id]) return;
                            const s = studentsData[p.id];
                            // فقط اگر Supabase مقدار صریح دارد override کن
                            if (p.graduated !== null && p.graduated !== undefined)
                                s.graduated = p.graduated;
                            if (p.graduated_date)
                                s.graduatedDate = p.graduated_date;
                            if (p.current_path)
                                s.currentPath = p.current_path;
                            if (p.active !== null && p.active !== undefined)
                                s.active = p.active;
                            if (p.finished_date)
                                s.finishedDate = p.finished_date;
                        });
                        console.log(`✅ students-sync: loaded status for ${profileRows.length} students from profiles`);
                    }
                }
            } catch (e) {
                console.warn('⚠️ students-sync profile load خطا:', e.message);
            }

            // ── سریع‌سازی: کل پیشرفت همهٔ دانشجویان در «یک» درخواست ──
            //    قدیمی: برای هر دانشجو × هر ۳ مسیر یک درخواست جدا و ترتیبی
            //    (با ۵۰ دانشجو = ۱۵۰ round-trip پشت‌سرهم!) — اکنون فقط ۱ درخواست.
            // ⚠️ رقابت: بین خواندن studentsData در ابتدای این تابع و الان، ممکن است
            // کاربر (شیت/مدیر) مرحله‌ای toggle کرده باشد. نوشتنِ برگشتیِ آبجکت کهنه
            // toggles را از students_data پاک می‌کرد و sync معکوس، DB را هم خراب.
            // راه‌حل: بعد از رسیدن پاسخ ابر، students_data را «دوباره» می‌خوانیم و
            // merge فقط روی نسخهٔ تازه اعمال می‌شود.
            const progressMap = await sb.getAllStudentProgress();

            // ── ریدِ تازه برای جلوگیری از پاک‌شدن toggles همزمان ──
            let freshData;
            try {
                const raw = localStorage.getItem(STUDENTS_KEY);
                freshData = raw ? JSON.parse(raw) : studentsData;
            } catch (e) {
                freshData = studentsData;
            }

            if (progressMap) {
                for (const studentId of studentIds) {
                    const student = freshData[studentId] || studentsData[studentId];
                    if (!student) continue;

                    for (const pathType of pathTypes) {
                        try {
                            const progress = progressMap[`${studentId}_${pathType}`];
                            if (!progress || progress.length === 0) continue;

                            const stepsKey = pathToKey[pathType];
                            const localSteps = student[stepsKey];
                            if (!Array.isArray(localSteps) || localSteps.length === 0) continue;

                            // merge: وضعیت Supabase را اعمال کن روی ساختار محلی
                            // 2=تکمیل، 3=متوقف، 1=در حال انجام، 0=ناتمام
                            const merged = localSteps.map((step, i) => {
                                const prog = progress[i];
                                if (!prog) return step;
                                return {
                                    ...step,
                                    completed:  prog.status === 2,
                                    paused:     prog.status === 3,
                                    inProgress: prog.status === 1,
                                };
                            });

                            student[stepsKey] = merged;
                            mergeCount++;
                        } catch (e) {
                            // ادامه می‌دهیم
                        }
                    }

                    freshData[studentId] = student;
                }
            }

            if (mergeCount > 0) {
                // ذخیره بدون trigger کردن دوباره sync — روی نسخهٔ «تازه»
                _origSetItem(STUDENTS_KEY, JSON.stringify(freshData));
                console.log(`✅ students-sync: initial load merged ${mergeCount} paths from Supabase`);
            }

            // ── seed اسنپ‌شات diff ──
            // دانشجویانی که داده‌شان از Supabase آمد «سینک‌شده» فرض می‌شوند تا اولین
            // ویرایش کاربر فقط همان دانشجو را sync کند. دانشجویان بدون داده در
            // Supabase علامت نمی‌خورند تا در اولین sync (مثل رفتار قدیمی) ارسال شوند.
            if (_syncedSigs === null && progressMap) {
                _syncedSigs = {};
                Object.entries(studentsData).forEach(([id, student]) => {
                    const hasDbData = pathTypes.some(pt => Array.isArray(progressMap[`${id}_${pt}`]));
                    if (hasDbData) _syncedSigs[id] = _sig(student);
                });
            }
        } catch (e) {
            console.warn('⚠️ students-sync initial load خطا:', e.message);
        } finally {
            // pull اولیه تمام شد (موفق یا شکست) — گیت sync باز شود
            // (شکست هم باز می‌کنیم وگرنه تا ری‌استعاد بعدی هیچ‌چیز سینک نمی‌شود)
            markInitialPullDone();
        }
    }

    // ── اجرای initial load به‌محض آنلاین شدن Supabase ────────
    // به‌جای صبرِ کورکورانهٔ ۲ ثانیه‌ای: هر ۵۰۰ms چک می‌کنیم و به‌محض
    // آماده شدن اتصال اجرا می‌شود (سقف ۱۵ ثانیه)
    function _startInitialLoadWhenOnline() {
        let waited = 0;
        const tryRun = () => {
            if (_sb() || waited >= 15000) { _initialLoad(); return; }
            waited += 500;
            setTimeout(tryRun, 500);
        };
        tryRun();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _startInitialLoadWhenOnline);
    } else {
        _startInitialLoadWhenOnline();
    }

    // expose برای دسترسی دستی
    window.StudentsSync = {
        syncStudent:    syncStudentDebounced,   // با debounce — مسیر sheet/iframe
        syncStudentNow: _syncStudent,           // فوری (بدون debounce)
        syncAll:        (data) => _syncAll(data || JSON.parse(localStorage.getItem(STUDENTS_KEY) || '{}')),
        flushPending:   _flushPendingStudents,  // ارسال فوری تغییرات در انتظار
        initialLoad:    _initialLoad,
        markInitialPullDone,                    // گیت ضد-ریست (supabase-init صدا می‌زند)
    };

    console.log('📦 students-sync.js بارگذاری شد — students_data override فعال');
})();
