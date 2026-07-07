# 🚀 مراحل بعدی: آماده‌سازی و دیپلوی سیستم

## ✅ وضعیت فعلی

سیستم شما **100% آماده** است:
- ✅ فرانت‌اند به بک‌اند متصل شده
- ✅ تمام API ها کار می‌کنند
- ✅ پیام‌ها و فایل‌ها در سرور ذخیره می‌شوند
- ✅ کاربران پیش‌فرض ایجاد شده‌اند
- ✅ تنظیمات production آماده است

---

## 📍 شما الان اینجا هستید

```
[✅ توسعه محلی] → [📍 شما اینجا هستید] → [🎯 دیپلوی روی سرور]
```

---

## 🎯 مرحله 1: تست محلی (Local Testing)

### قبل از دیپلوی، باید سیستم رو محلی تست کنید:

#### 1.1 راه‌اندازی بک‌اند Django

```bash
# باز کردن ترمینال اول
cd d:\desktop\kosar_software\backend

# فعال کردن virtual environment (اگر ندارید، ایجاد کنید)
python -m venv venv
venv\Scripts\activate

# نصب dependencies
pip install -r requirements.txt

# اجرای migrations
python manage.py makemigrations
python manage.py migrate

# ایجاد کاربران پیش‌فرض
python create_default_users.py

# راه‌اندازی سرور
python manage.py runserver 0.0.0.0:8000
```

**خروجی موفق:**
```
Starting development server at http://0.0.0.0:8000/
Quit the server with CTRL-BREAK.
```

#### 1.2 تست فرانت‌اند

```bash
# باز کردن ترمینال دوم
cd d:\desktop\kosar_software

# اگر Python HTTP Server دارید:
python -m http.server 8080

# یا با Node.js:
npx http-server -p 8080
```

#### 1.3 تست سیستم

1. **باز کردن مرورگر:**
   - فرانت‌اند: `http://localhost:8080/login.html`
   - بک‌اند Admin: `http://localhost:8000/admin/`

2. **ورود با کاربران پیش‌فرض:**
   - مدیر: `taghizadeh` / `taghizadeh`
   - کارمند 1: `sakhaei` / `Z@z12345`
   - کارمند 2: `farzad` / `F@f12345`

3. **تست عملکردها:**
   - ✅ ایجاد سفارش جدید
   - ✅ ارسال پیام
   - ✅ آپلود فایل
   - ✅ تخصیص وظیفه به عامل
   - ✅ بررسی ذخیره در دیتابیس

#### 1.4 بررسی Console

باز کردن Developer Tools (F12) و بررسی:
- ✅ هیچ خطای قرمز نباشد
- ✅ API calls موفق باشند (Status 200)
- ✅ پیام "Backend not available" نیاید

---

## 🎯 مرحله 2: آماده‌سازی برای Production

### 2.1 تنظیمات بک‌اند

```bash
cd backend
```

**ویرایش `config/settings_production.py`:**

```python
# تغییر دهید:
ALLOWED_HOSTS = [
    'YOUR_SERVER_IP',           # مثال: '185.123.45.67'
    'your-domain.com',          # مثال: 'alkawsar.com'
    'www.your-domain.com',
]

# تولید SECRET_KEY جدید
# در Python shell:
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())

SECRET_KEY = 'YOUR_NEW_SECRET_KEY_HERE'

# CORS
CORS_ALLOWED_ORIGINS = [
    "http://YOUR_SERVER_IP",
    "https://your-domain.com",
]
```

### 2.2 تنظیمات فرانت‌اند

**ویرایش `js/api-orders.js`:**

```javascript
const APIOrdersModule = {
    baseURL: 'http://YOUR_SERVER_IP/api',  // یا 'https://your-domain.com/api'
    // ...
}
```

**ویرایش `login.html`:**

```javascript
// خط 234 تقریباً
const response = await fetch('http://YOUR_SERVER_IP/api/auth/login/', {
    // یا: 'https://your-domain.com/api/auth/login/'
    // ...
});
```

---

## 🎯 مرحله 3: دیپلوی روی سرور

### 3.1 اطلاعات سرور شما

**لطفاً این اطلاعات را آماده کنید:**

```
IP سرور: _________________
نام دامنه (اختیاری): _________________
نام کاربری SSH: _________________
رمز عبور SSH: _________________
سیستم عامل سرور: Ubuntu 20.04 / 22.04 / ...
```

### 3.2 اتصال به سرور

```bash
# از ترمینال محلی
ssh username@YOUR_SERVER_IP

# یا با PuTTY در Windows
```

### 3.3 نصب پیش‌نیازها روی سرور

```bash
# به‌روزرسانی سیستم
sudo apt update
sudo apt upgrade -y

# نصب Python و ابزارها
sudo apt install -y python3 python3-pip python3-venv python3-dev
sudo apt install -y nginx
sudo apt install -y build-essential libpq-dev git curl

# نصب PostgreSQL (اختیاری - SQLite برای شروع کافی است)
# sudo apt install -y postgresql postgresql-contrib
```

### 3.4 آپلود فایل‌ها به سرور

**روش 1: با Git (توصیه می‌شود)**

```bash
# روی سرور
cd /home/username
git clone YOUR_REPOSITORY_URL edu-system
```

**روش 2: با SCP**

```bash
# از کامپیوتر محلی
scp -r d:\desktop\kosar_software username@YOUR_SERVER_IP:/home/username/edu-system
```

**روش 3: با FileZilla یا WinSCP**
- نصب FileZilla
- اتصال به سرور با SFTP
- آپلود پوشه `kosar_software`

### 3.5 راه‌اندازی بک‌اند روی سرور

```bash
# روی سرور
cd /home/username/edu-system/backend

# ایجاد virtual environment
python3 -m venv venv
source venv/bin/activate

# نصب dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# تنظیم environment variable
export DJANGO_SETTINGS_MODULE=config.settings_production

# اجرای migrations
python manage.py makemigrations
python manage.py migrate

# ایجاد کاربران پیش‌فرض
python create_default_users.py

# جمع‌آوری static files
python manage.py collectstatic --noinput

# ایجاد پوشه‌های مورد نیاز
mkdir -p logs media
```

### 3.6 پیکربندی Gunicorn

```bash
sudo nano /etc/systemd/system/gunicorn.service
```

**محتوای فایل:**

```ini
[Unit]
Description=Gunicorn daemon for Educational Management System
After=network.target

[Service]
User=username
Group=www-data
WorkingDirectory=/home/username/edu-system/backend
Environment="DJANGO_SETTINGS_MODULE=config.settings_production"
ExecStart=/home/username/edu-system/backend/venv/bin/gunicorn \
          --workers 3 \
          --bind unix:/home/username/edu-system/backend/gunicorn.sock \
          --timeout 120 \
          --access-logfile /home/username/edu-system/backend/logs/gunicorn-access.log \
          --error-logfile /home/username/edu-system/backend/logs/gunicorn-error.log \
          config.wsgi:application

[Install]
WantedBy=multi-user.target
```

**فعال‌سازی:**

```bash
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
sudo systemctl status gunicorn
```

### 3.7 پیکربندی Nginx

```bash
sudo nano /etc/nginx/sites-available/edu-system
```

**محتوای فایل:**

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP your-domain.com;
    
    client_max_body_size 10M;
    
    # Frontend
    location / {
        root /home/username/edu-system;
        index index.html login.html;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://unix:/home/username/edu-system/backend/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Django Admin
    location /admin/ {
        proxy_pass http://unix:/home/username/edu-system/backend/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Static files
    location /static/ {
        alias /home/username/edu-system/backend/staticfiles/;
    }
    
    # Media files
    location /media/ {
        alias /home/username/edu-system/backend/media/;
    }
}
```

**فعال‌سازی:**

```bash
sudo ln -s /etc/nginx/sites-available/edu-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3.8 تنظیم Firewall

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status
```

---

## 🎯 مرحله 4: تست سیستم روی سرور

### 4.1 دسترسی به سیستم

```
فرانت‌اند: http://YOUR_SERVER_IP/login.html
بک‌اند Admin: http://YOUR_SERVER_IP/admin/
```

### 4.2 ورود و تست

1. ورود با کاربران پیش‌فرض
2. ایجاد سفارش جدید
3. ارسال پیام
4. آپلود فایل
5. بررسی ذخیره در دیتابیس

### 4.3 بررسی لاگ‌ها

```bash
# Gunicorn logs
tail -f /home/username/edu-system/backend/logs/gunicorn-error.log

# Nginx logs
sudo tail -f /var/log/nginx/error.log

# Django logs
tail -f /home/username/edu-system/backend/logs/django.log
```

---

## 🎯 مرحله 5: نصب SSL (HTTPS) - اختیاری

### 5.1 نصب Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 5.2 دریافت گواهی SSL

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 5.3 تست تمدید خودکار

```bash
sudo certbot renew --dry-run
```

---

## 📊 چک‌لیست نهایی

### قبل از دیپلوی:
- [ ] تست محلی انجام شد
- [ ] همه API ها کار می‌کنند
- [ ] کاربران پیش‌فرض ایجاد شدند
- [ ] تنظیمات production آماده است

### حین دیپلوی:
- [ ] اتصال به سرور برقرار شد
- [ ] پیش‌نیازها نصب شدند
- [ ] فایل‌ها آپلود شدند
- [ ] بک‌اند راه‌اندازی شد
- [ ] Gunicorn پیکربندی شد
- [ ] Nginx پیکربندی شد
- [ ] Firewall تنظیم شد

### بعد از دیپلوی:
- [ ] سیستم از طریق IP قابل دسترسی است
- [ ] ورود کار می‌کند
- [ ] سفارش جدید ایجاد می‌شود
- [ ] پیام‌ها ارسال می‌شوند
- [ ] فایل‌ها آپلود می‌شوند
- [ ] SSL نصب شد (اختیاری)

---

## 🆘 رفع مشکلات رایج

### مشکل 1: Gunicorn راه‌اندازی نمی‌شود

```bash
# بررسی لاگ
sudo journalctl -u gunicorn -n 50

# راه‌اندازی مجدد
sudo systemctl restart gunicorn
```

### مشکل 2: Nginx خطا می‌دهد

```bash
# بررسی تنظیمات
sudo nginx -t

# بررسی لاگ
sudo tail -f /var/log/nginx/error.log
```

### مشکل 3: Static files نمایش داده نمی‌شوند

```bash
# جمع‌آوری مجدد
cd /home/username/edu-system/backend
source venv/bin/activate
python manage.py collectstatic --noinput

# تنظیم دسترسی‌ها
sudo chown -R username:www-data /home/username/edu-system
sudo chmod -R 755 /home/username/edu-system
```

### مشکل 4: API ها کار نمی‌کنند

```bash
# بررسی CORS در settings_production.py
# بررسی ALLOWED_HOSTS
# بررسی baseURL در js/api-orders.js
```

---

## 📞 مراحل بعدی شما

### گام 1: تست محلی (امروز)
```bash
cd d:\desktop\kosar_software\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python create_default_users.py
python manage.py runserver
```

### گام 2: آماده‌سازی اطلاعات سرور (امروز)
- IP سرور
- نام کاربری و رمز عبور
- نام دامنه (اگر دارید)

### گام 3: دیپلوی (فردا یا هر زمان که آماده بودید)
- اتصال به سرور
- اجرای دستورات بالا
- تست سیستم

---

## 💡 نکات مهم

1. **پشتیبان‌گیری:** قبل از هر تغییری، از دیتابیس پشتیبان بگیرید
2. **امنیت:** رمزهای پیش‌فرض را در production تغییر دهید
3. **مانیتورینگ:** لاگ‌ها را به طور منظم بررسی کنید
4. **به‌روزرسانی:** سیستم را به طور منظم به‌روز کنید

---

## 📚 منابع مفید

- [راهنمای کامل دیپلوی](PRODUCTION_DEPLOYMENT_GUIDE.md)
- [مستندات API](backend/API_COMPLETE_DOCUMENTATION.md)
- [راهنمای شروع سریع](START_HERE.md)

---

**تاریخ:** 2026-02-28  
**نسخه:** 1.0.0  
**وضعیت:** ✅ آماده برای دیپلوی
