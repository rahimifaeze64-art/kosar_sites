# شروع سریع 🚀

## برای توسعه‌دهندگان (Development)

### 1. نصب و راه‌اندازی Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # در Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python create_default_users.py
python manage.py runserver 8000
```

### 2. باز کردن Frontend
```bash
# در ترمینال جدید
python -m http.server 8080
# یا
npx http-server -p 8080
```

سپس مرورگر را باز کنید: `http://localhost:8080`

### 3. ورود به سیستم
- نام کاربری: `taghizadeh`
- رمز عبور: `taghizadeh`

---

## برای دیپلوی Production

### روش سریع
```bash
# 1. آماده‌سازی
chmod +x deploy.sh
./deploy.sh YOUR_SERVER_IP

# 2. آپلود به سرور
scp edu-system-deploy-*.tar.gz user@YOUR_SERVER_IP:/home/user/

# 3. در سرور
ssh user@YOUR_SERVER_IP
tar -xzf edu-system-deploy-*.tar.gz
cd edu-system-deploy-*
chmod +x install.sh
./install.sh
```

### مستندات کامل
- `PRODUCTION_DEPLOYMENT_GUIDE.md` - راهنمای کامل
- `FINAL_RELEASE_SUMMARY_FA.md` - خلاصه نهایی

---

## تست سیستم

### تست Backend
```bash
cd backend
python manage.py test
```

### تست اتصال API
باز کنید: `test-backend-integration.html`

---

## کاربران پیش‌فرض

| نقش | نام کاربری | رمز عبور |
|-----|-----------|----------|
| مدیر | taghizadeh | taghizadeh |
| کارمند | sakhaei | Z@z12345 |
| کارمند | farzad | F@f12345 |

---

## پشتیبانی

مشکل دارید؟ فایل‌های زیر را بررسی کنید:
- `PRODUCTION_DEPLOYMENT_GUIDE.md`
- `FRONTEND_BACKEND_INTEGRATION_GUIDE.md`
- `INTEGRATION_SUMMARY_FA.md`
