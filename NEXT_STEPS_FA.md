# مراحل بعدی - چیکار کنم؟ 🚀

## 📍 موقعیت فعلی شما

شما الان در مسیر: `d:\desktop\kosar_software\`

پروژه شما **کاملاً آماده** است! حالا باید روی سرور دیپلوی کنید.

---

## 🎯 مرحله 1: آماده‌سازی فایل‌ها برای آپلود

### گزینه A: استفاده از اسکریپت خودکار (توصیه می‌شود)

```bash
# در Windows PowerShell یا Git Bash
cd d:\desktop\kosar_software
bash deploy.sh YOUR_SERVER_IP

# مثال:
# bash deploy.sh 192.168.1.100
```

این اسکریپت:
- ✅ API URL ها رو به‌روز می‌کنه
- ✅ تنظیمات Django رو آماده می‌کنه
- ✅ یک فایل فشرده `.tar.gz` می‌سازه
- ✅ دستورالعمل‌های نصب رو اضافه می‌کنه

### گزینه B: دستی (اگر اسکریپت کار نکرد)

1. **فایل‌های مورد نیاز رو کپی کنید:**
```
kosar_software/
├── backend/          (کل پوشه)
├── js/              (کل پوشه)
├── assets/          (کل پوشه)
├── css/             (کل پوشه)
├── *.html           (تمام فایل‌های HTML)
├── login.html
└── PRODUCTION_DEPLOYMENT_GUIDE.md
```

2. **فایل‌ها رو فشرده کنید:**
   - همه فایل‌های بالا رو انتخاب کنید
   - راست کلیک → Send to → Compressed (zipped) folder
   - اسم فایل: `edu-system.zip`

---

## 🎯 مرحله 2: آپلود به سرور

### روش 1: با WinSCP (ساده‌ترین روش برای Windows)

1. **دانلود WinSCP:**
   - https://winscp.net/eng/download.php

2. **اتصال به سرور:**
   - File Protocol: SFTP
   - Host name: `YOUR_SERVER_IP`
   - Port: 22
   - User name: `root` یا کاربر سرور
   - Password: رمز عبور سرور

3. **آپلود فایل‌ها:**
   - در سمت راست (سرور): برید به `/home/`
   - پوشه `alkawsar` بسازید
   - فایل فشرده رو به `/home/alkawsar/` آپلود کنید

### روش 2: با FileZilla

1. **دانلود FileZilla:**
   - https://filezilla-project.org/

2. **اتصال:**
   - Host: `sftp://YOUR_SERVER_IP`
   - Username: `root`
   - Password: رمز سرور
   - Port: 22

3. **آپلود:**
   - فایل فشرده رو به `/home/alkawsar/` بکشید

### روش 3: با SCP (اگر Git Bash دارید)

```bash
# در Git Bash
scp edu-system.zip root@YOUR_SERVER_IP:/home/alkawsar/
```

---

## 🎯 مرحله 3: اتصال به سرور

### با PuTTY (Windows)

1. **دانلود PuTTY:**
   - https://www.putty.org/

2. **اتصال:**
   - Host Name: `YOUR_SERVER_IP`
   - Port: 22
   - Connection type: SSH
   - کلیک روی Open

3. **ورود:**
   - login as: `root`
   - password: رمز سرور

### با Git Bash یا PowerShell

```bash
ssh root@YOUR_SERVER_IP
# وارد کردن رمز عبور
```

---

## 🎯 مرحله 4: نصب روی سرور

حالا که به سرور وصل شدید، این دستورات رو اجرا کنید:

### 1. آماده‌سازی اولیه

```bash
# به‌روزرسانی سیستم
apt update
apt upgrade -y

# نصب ابزارهای مورد نیاز
apt install -y python3 python3-pip python3-venv nginx unzip

# ایجاد کاربر
adduser alkawsar
# رمز عبور وارد کنید (مثلاً: alkawsar123)
usermod -aG sudo alkawsar

# تغییر به کاربر جدید
su - alkawsar
```

### 2. استخراج فایل‌ها

```bash
cd /home/alkawsar

# اگر فایل .tar.gz دارید:
tar -xzf edu-system-deploy-*.tar.gz
cd edu-system-deploy-*

# اگر فایل .zip دارید:
unzip edu-system.zip
cd edu-system
```

### 3. نصب Backend

```bash
cd backend

# ایجاد virtual environment
python3 -m venv venv
source venv/bin/activate

# نصب packages
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# ایجاد پوشه‌ها
mkdir -p logs media staticfiles
```

### 4. پیکربندی Settings

```bash
# ویرایش فایل تنظیمات
nano config/settings_production.py
```

**تغییرات مهم:**
```python
# خط 15: اضافه کردن IP سرور
ALLOWED_HOSTS = [
    'YOUR_SERVER_IP',  # IP سرور خودتون
    'localhost',
    '127.0.0.1',
]

# خط 50: اضافه کردن IP به CORS
CORS_ALLOWED_ORIGINS = [
    "http://YOUR_SERVER_IP",  # IP سرور خودتون
    "http://localhost",
]
```

**ذخیره و خروج:**
- `Ctrl + O` (ذخیره)
- `Enter` (تایید)
- `Ctrl + X` (خروج)

### 5. اجرای Migrations

```bash
# تنظیم متغیر محیطی
export DJANGO_SETTINGS_MODULE=config.settings_production

# اجرای migrations
python manage.py migrate

# ایجاد کاربران پیش‌فرض
python create_default_users.py

# جمع‌آوری static files
python manage.py collectstatic --noinput
```

**خروجی موفق:**
```
✅ Created user: taghizadeh (manager)
✅ Created user: sakhaei (employee)
✅ Created user: farzad (employee)
```

### 6. تست Backend

```bash
# تست سرور
python manage.py runserver 0.0.0.0:8000
```

**در مرورگر خودتون:**
- برید به: `http://YOUR_SERVER_IP:8000/admin/`
- اگر صفحه Django Admin دیدید، موفق بوده! ✅
- با `Ctrl + C` متوقفش کنید

---

## 🎯 مرحله 5: پیکربندی Gunicorn

```bash
# خروج از virtual environment
deactivate

# خروج از کاربر alkawsar
exit

# حالا به عنوان root هستید
sudo nano /etc/systemd/system/gunicorn.service
```

**محتوای فایل را کپی کنید:**
```ini
[Unit]
Description=Gunicorn daemon for Educational Management System
After=network.target

[Service]
User=alkawsar
Group=www-data
WorkingDirectory=/home/alkawsar/edu-system/backend
Environment="DJANGO_SETTINGS_MODULE=config.settings_production"
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

**ذخیره و راه‌اندازی:**
```bash
# شروع سرویس
sudo systemctl start gunicorn
sudo systemctl enable gunicorn

# بررسی وضعیت
sudo systemctl status gunicorn
```

**باید ببینید:**
```
● gunicorn.service - Gunicorn daemon...
   Active: active (running)
```

اگر خطا دیدید:
```bash
# مشاهده لاگ‌ها
sudo journalctl -u gunicorn -n 50
```

---

## 🎯 مرحله 6: پیکربندی Nginx

```bash
sudo nano /etc/nginx/sites-available/edu-system
```

**محتوای فایل (IP خودتون رو جایگزین کنید):**
```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;
    
    client_max_body_size 10M;
    
    # Frontend
    location / {
        root /home/alkawsar/edu-system;
        index index.html login.html;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://unix:/home/alkawsar/edu-system/backend/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Django Admin
    location /admin/ {
        proxy_pass http://unix:/home/alkawsar/edu-system/backend/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Static files
    location /static/ {
        alias /home/alkawsar/edu-system/backend/staticfiles/;
    }
    
    # Media files
    location /media/ {
        alias /home/alkawsar/edu-system/backend/media/;
    }
}
```

**فعال‌سازی:**
```bash
# لینک به sites-enabled
sudo ln -s /etc/nginx/sites-available/edu-system /etc/nginx/sites-enabled/

# حذف سایت پیش‌فرض
sudo rm /etc/nginx/sites-enabled/default

# تست پیکربندی
sudo nginx -t

# راه‌اندازی مجدد
sudo systemctl restart nginx
```

---

## 🎯 مرحله 7: تنظیم دسترسی‌ها

```bash
# تنظیم مالکیت
sudo chown -R alkawsar:www-data /home/alkawsar/edu-system

# تنظیم دسترسی‌ها
sudo chmod -R 755 /home/alkawsar/edu-system

# دسترسی خاص برای socket
sudo chmod 660 /home/alkawsar/edu-system/backend/gunicorn.sock
```

---

## 🎯 مرحله 8: پیکربندی Firewall

```bash
# اجازه دسترسی به پورت‌ها
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# فعال‌سازی
sudo ufw enable

# بررسی
sudo ufw status
```

---

## 🎉 مرحله 9: تست نهایی!

### 1. باز کردن سایت

در مرورگر خودتون برید به:
```
http://YOUR_SERVER_IP/login.html
```

### 2. ورود به سیستم

استفاده از یکی از کاربرهای پیش‌فرض:
- **نام کاربری:** `taghizadeh`
- **رمز عبور:** `taghizadeh`

### 3. تست Django Admin

```
http://YOUR_SERVER_IP/admin/
```

---

## 🔧 عیب‌یابی

### اگر صفحه باز نشد:

```bash
# بررسی وضعیت سرویس‌ها
sudo systemctl status gunicorn
sudo systemctl status nginx

# مشاهده لاگ‌ها
sudo tail -f /home/alkawsar/edu-system/backend/logs/gunicorn-error.log
sudo tail -f /var/log/nginx/error.log
```

### اگر API کار نکرد:

```bash
# بررسی socket
ls -la /home/alkawsar/edu-system/backend/gunicorn.sock

# راه‌اندازی مجدد
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

### اگر Static Files نمایش داده نشد:

```bash
cd /home/alkawsar/edu-system/backend
source venv/bin/activate
python manage.py collectstatic --noinput
sudo systemctl restart nginx
```

---

## 📝 دستورات مفید

### راه‌اندازی مجدد
```bash
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

### مشاهده لاگ‌ها
```bash
# Gunicorn
sudo tail -f /home/alkawsar/edu-system/backend/logs/gunicorn-error.log

# Nginx
sudo tail -f /var/log/nginx/error.log

# Django
sudo tail -f /home/alkawsar/edu-system/backend/logs/django.log
```

### پشتیبان‌گیری
```bash
# دیتابیس
cp /home/alkawsar/edu-system/backend/db.sqlite3 ~/backup-$(date +%Y%m%d).sqlite3

# فایل‌ها
tar -czf ~/edu-system-backup-$(date +%Y%m%d).tar.gz /home/alkawsar/edu-system
```

---

## ✅ چک‌لیست نهایی

- [ ] فایل‌ها آپلود شده
- [ ] Backend نصب شده
- [ ] Migrations اجرا شده
- [ ] کاربران پیش‌فرض ایجاد شده
- [ ] Gunicorn راه‌اندازی شده
- [ ] Nginx پیکربندی شده
- [ ] Firewall تنظیم شده
- [ ] سایت در مرورگر باز می‌شه
- [ ] می‌تونم لاگین کنم
- [ ] Django Admin کار می‌کنه

---

## 🎯 مرحله بعدی (اختیاری)

### 1. نصب SSL (HTTPS)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 2. تغییر رمزهای پیش‌فرض
```bash
cd /home/alkawsar/edu-system/backend
source venv/bin/activate
python manage.py changepassword taghizadeh
```

### 3. پشتیبان‌گیری خودکار
```bash
# اضافه کردن به crontab
crontab -e

# اضافه کردن این خط (هر روز ساعت 2 صبح):
0 2 * * * cp /home/alkawsar/edu-system/backend/db.sqlite3 ~/backups/db-$(date +\%Y\%m\%d).sqlite3
```

---

## 📞 نیاز به کمک؟

اگر در هر مرحله‌ای مشکل داشتید:

1. لاگ‌ها رو بررسی کنید
2. وضعیت سرویس‌ها رو چک کنید
3. دستورات رو دقیق اجرا کنید
4. IP سرور رو درست جایگزین کنید

**موفق باشید! 🚀**
