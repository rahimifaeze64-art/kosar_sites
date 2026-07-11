// ============================================================
// js/hardcoded-users.js
// لیست ثابت کاربران سیستم (مدیر + کارمند + عامل)
// برای تغییر رمز عبور، فقط همین فایل را ویرایش کن
// ============================================================

const HARDCODED_USERS = [

    // ─── مدیر ────────────────────────────────────────────────
    {
        id:         'mgr001',
        name:       'تقی‌زاده',
        username:   'taghizadeh',
        password:   'taghizadeh1403',
        role:       'manager',
        email:      'taghizadeh@alkawsar.com',
        phone:      '+98 912 123 4567',
        department: 'مدیریت',
        active:     true,
        createdAt:  '2024-01-01T00:00:00.000Z'
    },

    // ─── کارمندان ─────────────────────────────────────────────
    {
        id:         'emp001',
        name:       'ساره',
        username:   'sareh',
        password:   'sareh1403',
        role:       'employee',
        email:      'sareh@alkawsar.com',
        phone:      '',
        department: 'هماهنگی عمومی',
        active:     true,
        createdAt:  '2024-01-01T00:00:00.000Z'
    },
    {
        id:         'emp002',
        name:       'زینب',
        username:   'zainab',
        password:   'zainab1403',
        role:       'employee',
        email:      'zainab@alkawsar.com',
        phone:      '',
        department: 'هماهنگی پروژه‌ها',
        active:     true,
        createdAt:  '2024-01-01T00:00:00.000Z'
    },
    {
        id:         'emp003',
        name:       'فرزاد',
        username:   'farzad',
        password:   'farzad1403',
        role:       'employee',
        email:      'farzad@alkawsar.com',
        phone:      '',
        department: 'هماهنگی مالی',
        active:     true,
        createdAt:  '2024-01-01T00:00:00.000Z'
    },
    {
        id:         'emp004',
        name:       'حسینی',
        username:   'hosseini',
        password:   'hosseini1403',
        role:       'employee',
        email:      'hosseini@alkawsar.com',
        phone:      '',
        department: 'هماهنگی فنی',
        active:     true,
        createdAt:  '2024-01-01T00:00:00.000Z'
    },
    {
        id:         'emp005',
        name:       'مهدی',
        username:   'mahdi',
        password:   'mahdi1403',
        role:       'employee',
        email:      'mahdi@alkawsar.com',
        phone:      '',
        department: 'هماهنگی عمومی',
        active:     true,
        createdAt:  '2024-01-01T00:00:00.000Z'
    },

    // ─── عامل‌ها ──────────────────────────────────────────────
    {
        id:             'doc001',
        name:           'معصومی',
        username:       'masoumi',
        password:       'masoumi1403',
        role:           'agent',
        email:          'masoumi@alkawsar.com',
        phone:          '',
        specialization: 'نوشتن رساله',
        department:     'عملیات',
        active:         true,
        createdAt:      '2024-01-01T00:00:00.000Z'
    },
    {
        id:             'doc002',
        name:           'ذوقی',
        username:       'zoghi',
        password:       'zoghi1403',
        role:           'agent',
        email:          'zoghi@alkawsar.com',
        phone:          '',
        specialization: 'نوشتن مقاله',
        department:     'عملیات',
        active:         true,
        createdAt:      '2024-01-01T00:00:00.000Z'
    },
    {
        id:             'agent001',
        name:           'فتحی',
        username:       'fathi',
        password:       'fathi1403',
        role:           'agent',
        email:          'fathi@alkawsar.com',
        phone:          '',
        specialization: 'ترجمه',
        department:     'عملیات',
        active:         true,
        createdAt:      '2024-01-01T00:00:00.000Z'
    },
    {
        id:             'agent002',
        name:           'سجادی',
        username:       'sajjadi',
        password:       'sajjadi1403',
        role:           'agent',
        email:          'sajjadi@alkawsar.com',
        phone:          '',
        specialization: 'تلخیص',
        department:     'عملیات',
        active:         true,
        createdAt:      '2024-01-01T00:00:00.000Z'
    }
];

// ── جستجو در لیست هاردکد ─────────────────────────────────────
function findHardcodedUser(username, password) {
    return HARDCODED_USERS.find(
        u => u.username === username && u.password === password && u.active
    ) || null;
}

function getHardcodedUserById(id) {
    return HARDCODED_USERS.find(u => u.id === id) || null;
}

console.log(`📦 hardcoded-users.js بارگذاری شد — ${HARDCODED_USERS.length} کاربر`);
