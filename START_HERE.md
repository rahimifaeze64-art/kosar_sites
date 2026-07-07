# 🚀 از اینجا شروع کنید!

## شما الان کجا هستید؟

📍 مسیر: `d:\desktop\kosar_software\`

✅ پروژه شما **100% آماده** است!

---

## 3 قدم ساده تا دیپلوی

### قدم 1️⃣: آماده‌سازی (2 دقیقه)

**گزینه A - خودکار (توصیه می‌شود):**
```bash
bash deploy.sh YOUR_SERVER_IP
```

**گزینه B - دستی:**
1. تمام فایل‌ها رو انتخاب کنید
2. فشرده کنید (zip)
3. اسم بذارید: `edu-system.zip`

---

### قدم 2️⃣: آپلود به سرور (5 دقیقه)

**با WinSCP (ساده‌ترین):**
1. دانلود: https://winscp.net
2. اتصال به سرور با IP و رمز
3. آپلود فایل به `/home/alkawsar/`

---

### قدم 3️⃣: نصب روی سرور (10 دقیقه)

**اتصال با PuTTY:**
1. دانلود: https://www.putty.org
2. اتصال به سرور
3. اجرای دستورات زیر:

```bash
# 1. آماده‌سازی
apt update && apt install -y python3 python3-pip python3-venv nginx unzip
adduser alkawsar
su - alkawsar

# 2. استخراج
cd /home/alkawsar
unzip edu-system.zip
cd edu-system/backend

# 3. نصب Python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt gunicorn
mkdir -p logs media staticfiles

# 4. تنظیمات (IP خودتون رو بذارید)
nano config/settings_production.py
# خط 15: ALLOWED_HOSTS = ['YOUR_SERVER_IP', ...]
# خط 50: CORS_ALLOWED_ORIGINS = ["http://YOUR_SERVER_IP", ...]
# Ctrl+O, Enter, Ctrl+X

# 5. دیتابیس
export DJANGO_SETTINGS_MODULE=config.settings_production
python manage.py migrate
python create_default_users.py
python manage.py collectstatic --noinput

# 6. Gunicorn (خروج از alkawsar)
exit
sudo nano /etc/systemd/system/gunicorn.service
# کپی محتوا از NEXT_STEPS_FA.md
sudo systemctl start gunicorn
sudo systemctl enable gunicorn

# 7. Nginx
sudo nano /etc/nginx/sites-available/edu-system
# کپی محتوا و جایگزین YOUR_SERVER_IP
sudo ln -s /etc/nginx/sites-available/edu-system /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 8. دسترسی‌ها
sudo chown -R alkawsar:www-data /home/alkawsar/edu-system
sudo chmod -R 755 /home/alkawsar/edu-system

# 9. Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw enable
```

---

## ✅ تست

باز کنید: `http://YOUR_SERVER_IP/login.html`

ورود با:
- نام کاربری: `taghizadeh`
- رمز عبور: `taghizadeh`

---

## 📚 راهنماهای کامل

- **جزئیات بیشتر:** `NEXT_STEPS_FA.md`
- **راهنمای کامل:** `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **خلاصه پروژه:** `FINAL_RELEASE_SUMMARY_FA.md`

---

## 🆘 مشکل دارید؟

```bash
# بررسی وضعیت
sudo systemctl status gunicorn
sudo systemctl status nginx

# مشاهده لاگ‌ها
sudo tail -f /home/alkawsar/edu-system/backend/logs/gunicorn-error.log
sudo tail -f /var/log/nginx/error.log
```

**موفق باشید! 🎉**
