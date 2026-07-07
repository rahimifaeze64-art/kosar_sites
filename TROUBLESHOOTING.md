# راهنمای رفع مشکلات - Troubleshooting

## مشکل: "لطفا ابتدا وارد سیستم شوید"

### علت:
این خطا زمانی رخ می‌دهد که `currentUser` در localStorage وجود ندارد یا null است.

### راه‌حل:

#### 1. بررسی ورود به سیستم
مطمئن شوید که وارد سیستم شده‌اید:
```javascript
// در Console مرورگر:
localStorage.getItem('currentUser')
```

اگر `null` بود، باید وارد سیستم شوید.

#### 2. ورود دستی به سیستم (برای تست)

**برای کارمند:**
```javascript
localStorage.setItem('currentUser', JSON.stringify({
    id: 'emp001',
    name: 'زهرا',
    username: 'zahra',
    role: 'employee',
    email: 'zahra@edu-system.com'
}));
location.reload();
```

**برای عامل:**
```javascript
localStorage.setItem('currentUser', JSON.stringify({
    id: 'agent001',
    name: 'رضایی',
    username: 'rezaei',
    role: 'agent',
    email: 'rezaei@edu-system.com'
}));
location.reload();
```

**برای مدیر:**
```javascript
localStorage.setItem('currentUser', JSON.stringify({
    id: 'mgr001',
    name: 'عامل تقی زاده',
    username: 'manager',
    role: 'manager',
    email: 'taghizadeh@edu-system.com'
}));
location.reload();
```

#### 3. استفاده از Role Switcher
در sidebar پایین صفحه، از dropdown "تغییر نقش" استفاده کنید:
1. نقش مورد نظر را انتخاب کنید
2. صفحه به صورت خودکار بارگذاری مجدد می‌شود

#### 4. استفاده از فایل‌های تست
از فایل‌های تست آماده استفاده کنید:
- `test-employee-chat.html` - برای تست صفحه پیام‌ها
- `test-agent-features.html` - برای تست قابلیت‌های عامل‌ها

---

## مشکل: صفحه پیام‌ها خالی است

### علت:
ممکن است هنوز پیامی ارسال نشده باشد.

### راه‌حل:
1. یک شخص از لیست را انتخاب کنید
2. پیام خود را تایپ کنید
3. دکمه ارسال را بزنید یا Enter را فشار دهید

---

## مشکل: لیست افراد خالی است

### علت:
تابع `getAllPeopleForChat()` به درستی کار نمی‌کند.

### راه‌حل:
1. صفحه را Refresh کنید (F5)
2. Cache مرورگر را پاک کنید (Ctrl+Shift+Delete)
3. مطمئن شوید که فای