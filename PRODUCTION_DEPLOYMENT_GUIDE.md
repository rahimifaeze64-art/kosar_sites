# راهنمای کامل دیپلوی Production

## 📋 فهرست مطالب
1. [پیش‌نیازها](#پیش-نیازها)
2. [آماده‌سازی سرور](#آماده-سازی-سرور)
3. [نصب و پیکربندی](#نصب-و-پیکربندی)
4. [دیپلوی بک‌اند](#دیپلوی-بک-اند)
5. [دیپلوی فرانت‌اند](#دیپلوی-فرانت-اند)
6. [پیکربندی Nginx](#پیکربندی-nginx)
7. [پیکربندی Gunicorn](#پیکربندی-gunicorn)
8. [SSL/HTTPS](#ssl-https)
9. [نگهداری و مانیتورینگ](#نگهداری-و-مانیتورینگ)

---

## پیش‌نیازها

### سرور
- Ubuntu 20.04 LTS یا بالاتر
- حداقل 2GB RAM
- حداقل 20GB فضای دیسک
- دسترسی root یا sudo

### نرم‌افزارها
- Python 3.8+
- PostgreSQL 12+ (اختیاری، SQLite برای شروع کافی است)
- Nginx
- Gunicorn
- Git

---

## آماده‌سازی سرور

### 1. به‌روزرسانی سیستم
```bash
sudo apt update
sudo apt upgrade -y
```

### 2. نصب پیش‌نیازها
```bash
# Python و ابزارهای مورد نیاز
sudo apt install -y python3 python3-pip python3-venv python3-dev

# Nginx
sudo apt install -y nginx

# ابزارهای سیستمی
sudo apt install -y build-essential libpq-dev git curl

# PostgreSQL (اختیاری)
# sudo apt install -y postgresql postgresql-contrib
```

### 3. ایجاد کاربر برای اپلیکیشن
```bash
sudo adduser alkawsar
sudo usermod -aG sudo alkawsar
su - alkawsar
```

---

## نصب و پیکربندی

### 1. کلون کردن پروژه
```bash
cd /home/alkawsar
git clone YOUR_REPOSITORY_URL edu-system
cd edu-system
```

یا اگر فایل‌ها را دارید:
```bash
# آپلود فایل‌ها با scp یا rsync
scp -r /path/to/project alkawsar@YOUR_SERVER_IP:/home/alkawsar/edu-system
```

### 2. ایجاد Virtual Environment
```bash
cd /home/alkawsar/edu-system/backend
python3 -m venv venv
source venv/bin/activate
```

### 3. نصب Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
```

---

## دیپلوی بک‌اند

### 1. پیکربندی Settings
```bash
cd /home/alkawsar/edu-system/backend

# کپی فایل تنظیمات production
cp config/settings_production.py config/settings_prod.py

# ویرایش تنظیمات
nano config/settings_prod.py
```

**تغییرات مهم در `settings_prod.py`:**
```python
# اضافه کردن IP سرور
ALLOWED_HOSTS = [
    'YOUR_SERVER_IP',
    'your-domain.com',
    'www.your-domain.com',
]

# تولید SECRET_KEY جدید
# در Python:
# from django.core.management.utils import get_random_secret_key
# print(get_random_secret_key())
SECRET_KEY = 'YOUR_NEW_SECRET_KEY_HERE'

# CORS
CORS_ALLOWED_ORIGINS = [
    "http://YOUR_SERVER_IP",
    "https://your-domain.com",
]
```

### 2. ایجاد پوشه‌های مورد نیاز
```bash
mkdir -p logs
mkdir -p media
mkdir -p staticfiles
```

### 3. اجرای Migrations
```bash
# استفاده از تنظیمات production
export DJANGO_SETTINGS_MODULE=config.settings_prod

python manage.py makemigrations
python manage.py migrate
```

### 4. ایجاد کاربرهای پیش‌فرض
```bash
python create_default_users.py
```

خروجی:
```
✅ Created user: taghizadeh (manager)
✅ Created user: sakhaei (employee)
✅ Created user: farzad (employee)
```

### 5. جمع‌آوری Static Files
```bash
python manage.py collectstatic --noinput
```

### 6. تست سرور
```bash
python manage.py runserver 0.0.0.0:8000
```

اگر کار کرد، با `Ctrl+C` متوقف کنید.

---

## پیکربندی Gunicorn

### 1. ایجاد فایل سرویس Gunicorn
```bash
sudo nano /etc/systemd/system/gunicorn.service
```

**محتوای فایل:**
```ini
[Unit]
Description=Gunicorn daemon for Educational Management System
After=network.target

[Service]
User=alkawsar
Group=www-data
WorkingDirectory=/home/alkawsar/edu-system/backend
Environment="DJANGO_SETTINGS_MODULE=config.settings_prod"
ExecStart=/home/alkawsar/edu-system/backend/venv/bin/gunicorn \
          --workers 3 \
          --bind unix:/home/alkawsar/edu-system/backend/gunicorn.sock \
          --timeout 120 \
          --access-logfile /home/alkawsar/edu-system/backend/logs/gunicorn-access.log \
          --error-logfile /home/alkawsar/edu-system/backend/logs/gunicorn-error.log \
          config.wsgi:application

[Install]
WantedBy=multi-user.target
```

### 2. فعال‌سازی و شروع Gunicorn
```bash
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
sudo systemctl status gunicorn
```

### 3. بررسی لاگ‌ها
```bash
sudo journalctl -u gunicorn
tail -f /home/alkawsar/edu-system/backend/logs/gunicorn-error.log
```

---

## پیکربندی Nginx

### 1. ایجاد فایل پیکربندی Nginx
```bash
sudo nano /etc/nginx/sites-available/edu-system
```

**محتوای فایل:**
```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP your-domain.com www.your-domain.com;
    
    client_max_body_size 10M;
    
    # Frontend (Static Files)
    location / {
        root /home/alkawsar/edu-system;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://unix:/home/alkawsar/edu-system/backend/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
    
    # Django Admin
    location /admin/ {
        proxy_pass http://unix:/home/alkawsar/edu-system/backend/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files (Django)
    location /static/ {
        alias /home/alkawsar/edu-system/backend/staticfiles/;
    }
    
    # Media files
    location /media/ {
        alias /home/alkawsar/edu-system/backend/media/;
    }
    
    # Logs
    access_log /var/log/nginx/edu-system-access.log;
    error_log /var/log/nginx/edu-system-error.log;
}
```

### 2. فعال‌سازی سایت
```bash
sudo ln -s /etc/nginx/sites-available/edu-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. تنظیم دسترسی‌ها
```bash
sudo chown -R alkawsar:www-data /home/alkawsar/edu-system
sudo chmod -R 755 /home/alkawsar/edu-system
```

---

## دیپلوی فرانت‌اند

### 1. به‌روزرسانی API URL در فرانت‌اند
```bash
cd /home/alkawsar/edu-system
nano js/api-orders.js
```

**تغییر baseURL:**
```javascript
const APIOrdersModule = {
    baseURL: 'http://YOUR_SERVER_IP/api',  // یا https://your-domain.com/api
    // ...
}
```

### 2. به‌روزرسانی صفحه لاگین
```bash
nano login.html
```

**تغییر URL در تابع handleLogin:**
```javascript
const response = await fetch('http://YOUR_SERVER_IP/api/auth/login/', {
    // یا: 'https://your-domain.com/api/auth/login/'
    // ...
});
```

---

## SSL/HTTPS (با Let's Encrypt)

### 1. نصب Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. دریافت گواهی SSL
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 3. تست تمدید خودکار
```bash
sudo certbot renew --dry-run
```

### 4. به‌روزرسانی تنظیمات Django
```python
# در settings_prod.py
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

---

## نگهداری و مانیتورینگ

### دستورات مفید

#### راه‌اندازی مجدد سرویس‌ها
```bash
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

#### بررسی وضعیت
```bash
sudo systemctl status gunicorn
sudo systemctl status nginx
```

#### مشاهده لاگ‌ها
```bash
# Gunicorn logs
tail -f /home/alkawsar/edu-system/backend/logs/gunicorn-error.log
tail -f /home/alkawsar/edu-system/backend/logs/gunicorn-access.log

# Django logs
tail -f /home/alkawsar/edu-system/backend/logs/django.log

# Nginx logs
sudo tail -f /var/log/nginx/edu-system-error.log
sudo tail -f /var/log/nginx/edu-system-access.log
```

#### پشتیبان‌گیری از دیتابیس
```bash
# SQLite
cp /home/alkawsar/edu-system/backend/db.sqlite3 /home/alkawsar/backups/db-$(date +%Y%m%d).sqlite3

# PostgreSQL
# pg_dump -U postgres edu_system > backup-$(date +%Y%m%d).sql
```

#### به‌روزرسانی کد
```bash
cd /home/alkawsar/edu-system
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart gunicorn

# Frontend - فقط refresh مرورگر
```

---

## Firewall (UFW)

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status
```

---

## چک‌لیست نهایی

- [ ] سرور به‌روزرسانی شده
- [ ] Python و dependencies نصب شده
- [ ] Virtual environment ایجاد شده
- [ ] تنظیمات production پیکربندی شده
- [ ] SECRET_KEY تغییر کرده
- [ ] ALLOWED_HOSTS تنظیم شده
- [ ] Migrations اجرا شده
- [ ] کاربرهای پیش‌فرض ایجاد شده
- [ ] Static files جمع‌آوری شده
- [ ] Gunicorn پیکربندی و اجرا شده
- [ ] Nginx پیکربندی و اجرا شده
- [ ] API URL در فرانت‌اند به‌روز شده
- [ ] SSL نصب شده (اختیاری)
- [ ] Firewall پیکربندی شده
- [ ] پشتیبان‌گیری تنظیم شده

---

## اطلاعات ورود پیش‌فرض

### کاربران سیستم:
1. **مدیر:**
   - نام کاربری: `taghizadeh`
   - رمز عبور: `taghizadeh`

2. **کارمند 1:**
   - نام کاربری: `sakhaei`
   - رمز عبور: `Z@z12345`

3. **کارمند 2:**
   - نام کاربری: `farzad`
   - رمز عبور: `F@f12345`

---

## پشتیبانی

در صورت بروز مشکل:
1. لاگ‌های Gunicorn را بررسی کنید
2. لاگ‌های Nginx را بررسی کنید
3. لاگ‌های Django را بررسی کنید
4. وضعیت سرویس‌ها را چک کنید

**تاریخ:** 2026-02-28  
**نسخه:** 1.0.0
