// ============================================================
// users-data.js — کاربران سیستم
// ============================================================

const HARDCODED_USERS = [
    // مدیر
    {
        id: 'mgr001',
        name: 'تقی‌زاده',
        username: 'taghizadeh',
        password: 'taghizadeh1403',
        role: 'manager',
        email: 'taghizadeh@alkawsar.com',
        phone: '+98 912 123 4567',
        department: 'مدیریت',
        active: true
    },
    // کارمندان
    {
        id: 'emp001',
        name: 'ساره',
        username: 'sareh',
        password: 'sareh1403',
        role: 'employee',
        email: 'sareh@alkawsar.com',
        department: 'هماهنگی عمومی',
        active: true
    },
    {
        id: 'emp002',
        name: 'زینب',
        username: 'zainab',
        password: 'zainab1403',
        role: 'employee',
        email: 'zainab@alkawsar.com',
        department: 'هماهنگی پروژه‌ها',
        active: true
    },
    {
        id: 'emp003',
        name: 'فرزاد',
        username: 'farzad',
        password: 'farzad1403',
        role: 'employee',
        email: 'farzad@alkawsar.com',
        department: 'هماهنگی مالی',
        active: true
    },
    {
        id: 'emp004',
        name: 'حسینی',
        username: 'hosseini',
        password: 'hosseini1403',
        role: 'employee',
        email: 'hosseini@alkawsar.com',
        department: 'هماهنگی فنی',
        active: true
    },
    {
        id: 'emp005',
        name: 'مهدی',
        username: 'mahdi',
        password: 'mahdi1403',
        role: 'employee',
        email: 'mahdi@alkawsar.com',
        department: 'هماهنگی عمومی',
        active: true
    }
];

    // عامل‌ها
    {
        id: 'doc001',
        name: 'معصومی',
        username: 'masoumi',
        password: 'masoumi1403',
        role: 'agent',
        email: 'masoumi@alkawsar.com',
        specialization: 'نوشتن رساله',
        active: true
    },
    {
        id: 'doc002',
        name: 'ذوقی',
        username: 'zoghi',
        password: 'zoghi1403',
        role: 'agent',
        email: 'zoghi@alkawsar.com',
        specialization: 'نوشتن مقاله',
        active: true
    },
    {
        id: 'agent001',
        name: 'فتحی',
        username: 'fathi',
        password: 'fathi1403',
        role: 'agent',
        email: 'fathi@alkawsar.com',
        specialization: 'ترجمه',
        active: true
    },
    {
        id: 'agent002',
        name: 'سجادی',
        username: 'sajjadi',
        password: 'sajjadi1403',
        role: 'agent',
        email: 'sajjadi@alkawsar.com',
        specialization: 'تلخیص',
        active: true
    }
];

function findHardcodedUser(username, password) {
    return HARDCODED_USERS.find(
        u => u.username === username && u.password === password && u.active
    ) || null;
}

function getHardcodedUserById(id) {
    return HARDCODED_USERS.find(u => u.id === id) || null;
}

console.log(`✅ users-data.js loaded — ${HARDCODED_USERS.length} users`);
