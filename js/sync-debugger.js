// ============================================================
// js/sync-debugger.js
// دیباگر قوی ذخیره/بارگذاری پیشرفت دانشجویان
// ── نحوهٔ استفاده ──
// ۱) داخل کنسول مرورگر (همان صفحه‌ای که شیت/مدیریت دانشجویان باز است):
//        SyncDebugger.run()          → بررسی کامل + گزارش
//        SyncDebugger.watch()        → مانیتور زندهٔ نوشته‌شدن کلیدهای prog_
//        SyncDebugger.student('id')  → جزئیات یک دانشجو
//        SyncDebugger.diff('id','defense') → مقایسهٔ محلی vs دیتابیس
// یا تگ <script src="js/sync-debugger.js"></script> به index.html اضافه کنید
// ============================================================

(function () {
    'use strict';

    const PATHS = ['defense', 'educational', 'requirements', 'studying'];
    const STATUS_NAMES = { 0: 'ناتمام', 1: 'در حال انجام', 2: 'تکمیل', 3: 'متوقف' };

    const _log = (icon, msg, style) => console.log(`%c${icon} ${msg}`, style || 'color:#64748b');
    const _ok  = (msg) => _log('✅', msg, 'color:#16a34a;font-weight:bold');
    const _err = (msg) => _log('❌', msg, 'color:#dc2626;font-weight:bold');
    const _warn = (msg) => _log('⚠️', msg, 'color:#d97706;font-weight:bold');
    const _info = (msg) => _log('ℹ️', msg);

    function _sb() {
        return (typeof SupabaseDataModule !== 'undefined' && SupabaseDataModule._db && SupabaseDataModule._db())
            ? SupabaseDataModule : null;
    }

    // کل لیست دانشجویان — از هر دو منبع
    function _allStudentIds() {
        const ids = new Set();
        try {
            const users = JSON.parse(localStorage.getItem('edu_system_users') || '[]');
            users.filter(u => u && u.role === 'student').forEach(u => ids.add(String(u.id)));
        } catch (e) {}
        try {
            const sd = JSON.parse(localStorage.getItem('students_data') || '{}');
            Object.keys(sd).forEach(k => ids.add(String(k)));
        } catch (e) {}
        // دانشجوهای دارای prog_
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('prog_')) {
                const rest = k.slice(5);
                const lastUs = rest.lastIndexOf('_');
                if (lastUs > 0) ids.add(rest.slice(0, lastUs));
            }
        }
        return [...ids];
    }

    const report = { errors: [], warnings: [], infos: [] };

    async function run() {
        console.clear();
        console.log('%c╔══════════════════════════════════════════╗\n║   🔬 دیباگر ذخیره/بارگذاری پیشرفت — شروع   ║\n╚══════════════════════════════════════════╝', 'color:#2563eb;font-weight:bold;font-size:14px');
        report.errors = []; report.warnings = []; report.infos = [];

        // ── ۱. اتصال ──
        _info('── ۱. اتصال Supabase ──');
        const sb = _sb();
        if (!sb) {
            _err('SupabaseDataModule یا client در دسترس نیست! صفحه در حالت آفلاین است — همه‌چیز فقط localStorage ذخیره می‌شود.');
            report.errors.push('client در دسترس نیست');
        } else {
            _ok('Supabase client آماده است');
            const online = typeof SupabaseConnection !== 'undefined' ? SupabaseConnection.isOnline : 'نامشخص';
            _info(`SupabaseConnection.isOnline = ${online}`);
        }

        // ── ۲. تست مستقیم نوشتن/خواندن DB ──
        _info('── ۲. تست نوشتن/خواندن مستقیم DB (جدول student_progress) ──');
        if (sb) {
            try {
                const t0 = performance.now();
                const { data, error } = await sb._db()
                    .from('student_progress')
                    .select('student_id, path_type, step_index, status, updated_at')
                    .limit(5);
                const dt = Math.round(performance.now() - t0);
                if (error) {
                    _err(`خواندن student_progress ناموفق: ${error.message}`);
                    report.errors.push('خطای خواندن student_progress: ' + error.message);
                    if (error.message.includes('JWT') || error.message.includes('token') || error.message.includes('Unauthorized')) {
                        _warn('به نظر می‌رسد نشست/توکن منقضی شده — دوباره لاین کنید.');
                    }
                    if (error.message.includes('relation') || error.message.includes('does not exist')) {
                        _warn('جدول student_progress وجود ندارد — supabase/sync_fix_all.sql را اجرا کنید.');
                    }
                } else {
                    _ok(`خواندن DB موفق (${dt}ms) — نمونه: ${JSON.stringify(data[0] || 'جدول خالی!')}`);
                    if (!data || data.length === 0) {
                        _warn('جدول student_progress خالی برگشت! یا هیچ‌وقت ذخیره نشده یا RLS مانع خواندن است.');
                        report.warnings.push('student_progress خالی');
                    }
                }
            } catch (e) {
                _err('استثنا در تست DB: ' + e.message);
                report.errors.push('تست DB: ' + e.message);
            }
        }

        // ── ۳. نشست کاربر (RLS به نشست وابسته است) ──
        _info('── ۳. نشست کاربر ──');
        try {
            const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
            if (client) {
                const { data: sessionData } = await client.auth.getSession();
                if (sessionData && sessionData.session) {
                    _ok(`نشست فعال: ${sessionData.session.user.email || sessionData.session.user.id}`);
                } else {
                    _warn('نشست Supabase Auth فعال نیست! اگر RLS بر اساس auth.uid() باشد، نوشتن/خواندن محدود می‌شود.');
                    report.warnings.push('بدون نشست auth');
                }
            }
        } catch (e) { _warn('بررسی نشست: ' + e.message); }

        // ── ۴. دانشجویان و کلیدهای prog_ ──
        _info('── ۴. وضعیت محلی دانشجویان ──');
        const studentIds = _allStudentIds();
        _info(`${studentIds.length} دانشجو یافت شد`);

        let localProgKeys = 0, totalDone = 0, totalCurrent = 0;
        studentIds.forEach(id => {
            PATHS.forEach(p => {
                const raw = localStorage.getItem(`prog_${id}_${p}`);
                if (raw) {
                    localProgKeys++;
                    try {
                        const arr = JSON.parse(raw);
                        totalDone   += arr.filter(x => (x?.status ?? 0) === 2).length;
                        totalCurrent+= arr.filter(x => (x?.status ?? 0) === 1).length;
                    } catch (e) {}
                }
            });
        });
        _info(`کلیدهای prog_ محلی: ${localProgKeys} | مراحل تکمیل‌شده: ${totalDone} | در حال انجام: ${totalCurrent}`);

        // بررسی students_data
        try {
            const sd = JSON.parse(localStorage.getItem('students_data') || '{}');
            _info(`students_data: ${Object.keys(sd).length} دانشجو`);
            if (Object.keys(sd).length === 0) {
                _warn('students_data خالی است — شیت از edu_system_users استفاده می‌کند ولی پروفایل‌سازی (پروفایل/مراحل) ممکن است خراب باشد.');
                report.warnings.push('students_data خالی');
            }
        } catch (e) {}

        // ── ۵. مقایسهٔ محلی vs DB برای هر دانشجو/مسیر ──
        _info('── ۵. مقایسهٔ localStorage (prog_) با دیتابیس ──');
        if (sb) {
            let mismatch = 0, checked = 0, dbMissing = 0;
            const mismatches = [];
            const t0 = performance.now();
            const { data: dbRows, error } = await sb._db()
                .from('student_progress')
                .select('student_id, path_type, step_index, status, updated_at');
            if (!error && dbRows) {
                // گروه‌بندی DB
                const dbMap = {};
                dbRows.forEach(r => {
                    const k = `${r.student_id}|${r.path_type}`;
                    (dbMap[k] = dbMap[k] || []).push(r);
                });
                studentIds.forEach(id => {
                    PATHS.forEach(p => {
                        const raw = localStorage.getItem(`prog_${id}_${p}`);
                        if (!raw) return;
                        let local;
                        try { local = JSON.parse(raw); } catch (e) { return; }
                        const dbArr = dbMap[`${id}|${p}`] || [];
                        checked++;
                        if (dbArr.length === 0) {
                            dbMissing++;
                            mismatches.push(`⚠️ ${id}/${p}: در محلی هست (${local.filter(x=>x?.status===2).length} تکمیل) ولی در DB هیچ ردیفی نیست → هنوز آپلود نشده (تغییر اخیر؟ اینترنت؟)`);
                            return;
                        }
                        // مقایسهٔ وضعیت هر مرحله
                        local.forEach((item, idx) => {
                            const ls = (item?.status ?? 0);
                            const dbRow = dbArr.find(r => r.step_index === idx);
                            const ds = dbRow ? dbRow.status : 0;
                            if (ls === 2 && ds !== 2) {
                                mismatch++;
                                mismatches.push(`❌ ${id}/${p}[${idx}]: محلی=تکمیل | DB=${STATUS_NAMES[ds]} (updated_at: ${dbRow?.updated_at || '—'}) → ذخیرهٔ DB از دست رفته یا بازنویسی شده`);
                            } else if (ds === 2 && ls !== 2) {
                                mismatch++;
                                mismatches.push(`🟡 ${id}/${p}[${idx}]: DB=تکمیل | محلی=${STATUS_NAMES[ls]} → بارگذاری از DB هنوز اعمال نشده (رفرش لازم؟)`);
                            }
                        });
                    });
                });
                const dt = Math.round(performance.now() - t0);
                _info(`بررسی ${checked} جفت دانشجو/مسیر در ${dt}ms انجام شد`);
                if (mismatch === 0 && dbMissing === 0) {
                    _ok('همهٔ وضعیت‌های محلی با DB یکسان‌اند — ذخیره‌سازی سالم است 🎉');
                } else {
                    if (dbMissing > 0) _err(`${dbMissing} مسیر در DB ردیفی ندارد (آپلود نشده)`);
                    if (mismatch > 0) _err(`${mismatch} مغایرت بین محلی و DB`);
                    mismatches.slice(0, 25).forEach(m => console.log('   ' + m));
                    if (mismatches.length > 25) console.log(`   ... و ${mismatches.length - 25} مورد دیگر`);
                    report.errors.push(...mismatches.slice(0, 10));
                }
            } else {
                _err('خواندن کل student_progress برای مقایسه ناموفق: ' + (error?.message || '?'));
            }
        }

        // ── ۶. گیت ضد-ریست students-sync ──
        _info('── ۶. students-sync (گیت ضد-ریست) ──');
        if (typeof window.StudentsSync !== 'undefined') {
            _ok('StudentsSync بارگذاری شده');
        } else {
            _err('StudentsSync موجود نیست! فایل students-sync.js لود نشده — تغییرات students_data به DB نمی‌رود.');
            report.errors.push('StudentsSync موجود نیست');
        }

        // ── ۶.۵. گارد ضد بازنویسی (progts_ / progdbts_) ──
        _info('── ۶.۵. گارد anti-clobber بین مرورگرها ──');
        try {
            let localEditCount = 0, dbStampCount = 0, staleCount = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('progts_') && localStorage.getItem(k) !== '0') localEditCount++;
                if (k && k.startsWith('progdbts_')) dbStampCount++;
            }
            studentIds.forEach(id => {
                PATHS.forEach(p => {
                    const localTs = Number(localStorage.getItem(`progts_${id}_${p}`) || 0);
                    const dbTs    = Number(localStorage.getItem(`progdbts_${id}_${p}`) || 0);
                    // محلی دست‌نخورده ولی DB داده دارد → در صورت sync اشتباه، DB خراب می‌شد
                    if (dbTs > 0 && localTs === 0) staleCount++;
                });
            });
            _info(`مهرهای ویرایش محلی: ${localEditCount} | مهرهای DB: ${dbStampCount} | مسیرهای دست‌نخوردهٔ محافظت‌شده: ${staleCount}`);
            if (localEditCount === 0 && dbStampCount === 0) {
                _warn('هنوز مهر زمانی ثبت نشده — ممکن است نسخهٔ جدید کد لود نشده باشد (hard refresh کنید).');
            } else {
                _ok('گارد anti-clobber فعال است — مرورگرهای دست‌نخورده نمی‌توانند DB را بازنویسی کنند');
            }
        } catch (e) {}

        // ── ۷. جمع‌بندی ──
        console.log('%c╔═══════ جمع‌بندی ═══════╗', 'color:#2563eb;font-weight:bold;font-size:13px');
        if (report.errors.length === 0 && report.warnings.length === 0) {
            console.log('%c✅ هیچ مشکلی یافت نشد', 'color:#16a34a;font-weight:bold;font-size:13px');
        } else {
            if (report.errors.length)   console.log(`%c❌ ${report.errors.length} خطا`, 'color:#dc2626;font-weight:bold');
            if (report.warnings.length) console.log(`%c⚠️ ${report.warnings.length} هشدار`, 'color:#d97706;font-weight:bold');
        }
        _info('ابزارها: watch() | student("id") | diff("id","defense") | forcePush("id","defense") | resetGuards("id") | backup() | restore(json) | pushAll()');

        return report;
    }

    // ── جزئیات یک دانشجو ──
    async function student(id) {
        _info(`── جزئیات دانشجو: ${id} ──`);
        for (const p of PATHS) {
            const raw = localStorage.getItem(`prog_${id}_${p}`);
            if (raw) {
                const arr = JSON.parse(raw);
                const summary = arr.map(x => (x?.status ?? 0)).join(',');
                const done = arr.filter(x => (x?.status ?? 0) === 2).length;
                _info(`${p}: [${summary}] → ${done}/${arr.length} تکمیل`);
            } else {
                _info(`${p}: بدون کلید prog_`);
            }
        }
        try {
            const sd = JSON.parse(localStorage.getItem('students_data') || '{}');
            const s = sd[id];
            if (s) {
                ['defenseSteps','educationalSteps','requirementsSteps'].forEach(k => {
                    if (Array.isArray(s[k])) {
                        const done = s[k].filter(x => x?.completed).length;
                        _info(`students_data.${k}: ${done}/${s[k].length} تکمیل | statuses: [${s[k].map(x => x?.completed ? 2 : x?.paused ? 3 : x?.inProgress ? 1 : 0).join(',')}]`);
                    }
                });
            } else {
                _warn('این دانشجو در students_data نیست');
            }
        } catch (e) {}
        await diff(id, 'defense');
        await diff(id, 'educational');
    }

    // ── مقایسهٔ محلی vs DB برای یک دانشجو/مسیر ──
    async function diff(id, path) {
        const sb = _sb();
        if (!sb) { _err('client نیست'); return; }
        try {
            const { data, error } = await sb._db()
                .from('student_progress')
                .select('step_index, status, updated_at')
                .eq('student_id', id)
                .eq('path_type', path);
            if (error) { _err(error.message); return; }
            const local = JSON.parse(localStorage.getItem(`prog_${id}_${path}`) || '[]');
            const dbStatuses = {};
            (data || []).forEach(r => {
                // جدیدترین updated_at برنده
                if (!dbStatuses[r.step_index] || String(r.updated_at) > String(dbStatuses[r.step_index].updated_at)) {
                    dbStatuses[r.step_index] = r;
                }
            });
            const maxLen = Math.max(local.length, Object.keys(dbStatuses).length);
            const rows = [];
            for (let i = 0; i < maxLen; i++) {
                const ls = (local[i]?.status ?? '—');
                const ds = dbStatuses[i] ? dbStatuses[i].status : '—';
                rows.push({ مرحله: i, محلی: STATUS_NAMES[ls] ?? ls, دیتابیس: STATUS_NAMES[ds] ?? ds, 'updated_at': dbStatuses[i]?.updated_at || '—', یکی: ls === ds ? '✅' : '❌' });
            }
            console.log(`📊 ${id}/${path}:`, rows);
        } catch (e) { _err(e.message); }
    }

    // ── مانیتور زندهٔ تغییرات ──
    let _watching = false;
    const _watched = new Map();
    function watch() {
        if (_watching) { _info('مانیتور قبلاً فعال است'); return; }
        _watching = true;
        _ok('مانیتور زنده فعال شد — هر تغییر prog_ / students_data گزارش می‌شود. توقف: SyncDebugger.stop()');
        // ثبت وضعیت اولیه
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('prog_') || k === 'students_data')) _watched.set(k, localStorage.getItem(k));
        }
        _origSet = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function (key, value) {
            const prev = _watched.get(key);
            if ((key.startsWith('prog_') || key === 'students_data') && prev !== value) {
                if (key === 'students_data') {
                    _log('📝', `students_data تغییر کرد (${Math.round((value||'').length/1024)}KB)`, 'color:#2563eb;font-weight:bold');
                } else {
                    // تغییر وضعیت‌ها را خلاصه کن
                    try {
                        const arr = JSON.parse(value);
                        const s = arr.map(x => (x?.status ?? 0)).join(',');
                        _log('📝', `${key} → [${s}]`, 'color:#2563eb;font-weight:bold');
                        if (prev) {
                            try {
                                const pArr = JSON.parse(prev);
                                const diffs = [];
                                arr.forEach((x, i) => { if ((x?.status ?? 0) !== (pArr[i]?.status ?? 0)) diffs.push(`مرحله ${i}: ${STATUS_NAMES[pArr[i]?.status ?? 0]} → ${STATUS_NAMES[x?.status ?? 0]}`); });
                                if (diffs.length) console.log('   تغییرات: ' + diffs.join(' | '));
                            } catch (e) {}
                        }
                    } catch (e) { _log('📝', `${key} تغییر کرد`, 'color:#2563eb'); }
                }
            }
            _watched.set(key, value);
            return _origSet(key, value);
        };
    }
    let _origSet = null;
    function stop() {
        if (_origSet) {
            localStorage.setItem = _origSet;
            _origSet = null;
            _watching = false;
            _ok('مانیتور متوقف شد');
        }
    }

    // ── پشتیبان‌گیری کامل از کلیدهای prog_ (دانلود JSON) ──
    function backup() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('prog_')) data[k] = JSON.parse(localStorage.getItem(k));
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `progress-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
        a.click();
        _ok(`پشتیبان‌گیری شد — ${Object.keys(data).length} کلید prog_`);
        return data;
    }

    // ── بازیابی پشتیبان (localStorage + ارسال به DB) ──
    async function restore(json) {
        let data;
        try { data = typeof json === 'string' ? JSON.parse(json) : json; }
        catch (e) { _err('JSON نامعتبر: ' + e.message); return; }
        const sb = _sb();
        let localCount = 0, dbCount = 0;
        for (const [key, arr] of Object.entries(data || {})) {
            if (!key.startsWith('prog_') || !Array.isArray(arr)) continue;
            localStorage.setItem(key, JSON.stringify(arr));
            localCount++;
            if (sb) {
                const rest = key.slice(5);
                const us = rest.lastIndexOf('_');
                const studentId = rest.slice(0, us);
                const pathType = rest.slice(us + 1);
                const ok = await sb.saveStudentProgress(studentId, pathType, arr).catch(() => false);
                if (ok) dbCount++;
            }
        }
        _ok(`بازیابی شد — ${localCount} کلید محلی، ${dbCount} مسیر در دیتابیس`);
    }

    // ── ارسال فوری همهٔ کلیدهای prog_ محلی به دیتابیس (repair) ──
    // استفاده وقتی DB صفر شده ولی نسخهٔ محلی سالم است (مثلاً همین مرورگر)
    async function pushAll() {
        const sb = _sb();
        if (!sb) { _err('client نیست'); return; }
        let count = 0, errors = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith('prog_')) continue;
            const rest = k.slice(5);
            const us = rest.lastIndexOf('_');
            const studentId = rest.slice(0, us);
            const pathType = rest.slice(us + 1);
            if (!PATHS.includes(pathType)) continue;
            try {
                const arr = JSON.parse(localStorage.getItem(k));
                if (!Array.isArray(arr) || arr.length === 0) continue;
                const ok = await sb.saveStudentProgress(studentId, pathType, arr).catch(() => false);
                if (ok) count++; else errors++;
            } catch (e) { errors++; }
        }
        if (count > 0) _ok(`repair: ${count} مسیر محلی به دیتابیس ارسال شد${errors ? ` (${errors} خطا)` : ''}`);
        else _err(`repair: چیزی ارسال نشد (${errors} خطا)`);
    }

    // ── ارسال اجباری یک مسیر از محلی به DB (با نادیده گرفتن گارد زمانی) ──
    // استفاده وقتی می‌دانید نسخهٔ محلی همین مرورگر درست است
    async function forcePush(studentId, pathType) {
        const sb = _sb();
        if (!sb) { _err('client نیست'); return; }
        const raw = localStorage.getItem(`prog_${studentId}_${pathType}`);
        if (!raw) { _err(`prog_${studentId}_${pathType} محلی یافت نشد`); return; }
        const arr = JSON.parse(raw);
        const ok = await sb.saveStudentProgress(studentId, pathType, arr).catch(() => false);
        if (ok) _ok(`forcePush: ${studentId}/${pathType} → [${arr.map(p => p?.status ?? 0).join(',')}] در DB ذخیره شد`);
        else _err('forcePush ناموفق');
    }

    // ── پاک‌کردن مهرهای زمانی گارد (وقتی خراب/ناهم‌تراز شده‌اند) ──
    function resetGuards(studentId) {
        let count = 0;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (k.startsWith('progts_') || k.startsWith('progdbts_')) {
                if (!studentId || k.includes(`_${studentId}_`)) { localStorage.removeItem(k); count++; }
            }
        }
        _ok(`resetGuards: ${count} مهر زمانی پاک شد${studentId ? ` (${studentId})` : ''} — بعدی: SyncDebugger.run()`);
    }

    // expose
    window.SyncDebugger = { run, student, diff, watch, stop, backup, restore, pushAll, forcePush, resetGuards, report };

    // اگر این فایل با تگ script لود شده باشد، خودکار یک بار run نمی‌کنیم —
    // کاربر کنترل دارد. فقط آماده بودن را اعلام کن.
    console.log('%c🔬 SyncDebugger آماده است — اجرا: SyncDebugger.run()', 'color:#2563eb;font-weight:bold;font-size:13px');
})();
