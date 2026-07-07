# راهنمای Deploy بک‌اند Django

## 🚀 Deploy روی VPS (Ubuntu)

### مرحله 1: آماده‌سازی سرور

```bash
# بروزرسانی سیستم
sudo apt update && sudo apt upgrade -y

# نصب پکیج‌های مورد نیاز
sudo apt install -y python3.10 python3-pip python3-venv
sudo apt install -y postgresql postgresql-contrib
sudo apt install -y nginx
sudo apt install -y git
```

### مرحله 2: تنظیم PostgreSQL

```bash
# ورود به PostgreSQL
sudo -u postgres psql

# ایجاد دیتابیس و کاربر
CREATE DATABASE edu_system_db;
CREATE USER edu_system_user WITH PASSWORD 'your_strong_password';
ALTER ROLE edu_system_user SET client_encoding TO 'utf8';
ALTER ROLE edu_system_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE edu_system_user SET timezone TO 'Asia/Tehran';
GRANT ALL PRIVILEGES ON DATABASE edu_system_db TO edu_system_user;
\q
```

### مرحله 3: کلون پروژه

```bash
# ایجاد دایرکتوری
sudo mkdir -p /var/www/edu-system
cd /var/www/edu-system

# کلون پروژه (یا آپلود فایل‌ها)
git clone your-repo-url .
# یا
scp -r /path/to/project/* user@server:/var/www/edu-system/
```

### مرحله 4: تنظیم Virtual Environment

```bash
# ایجاد virtual environment
python3 -m venv venv

# فعال‌سازی
source venv/bin/activate

# نصب وابستگی‌ها
cd backend
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

### مرحله 5: تنظیم Environment Variables

```bash
# ایجاد فایل .env
nano /var/www/edu-system/backend/.env
```

محتوای فایل `.env`:
```env
DEBUG=False
SECRET_KEY=your-very-secret-key-here-change-this
ALLOWED_HOSTS=your-domain.com,www.your-domain.com,server-ip

# Database
DB_ENGINE=django.db.backends.postgresql
DB_NAME=edu_system_db
DB_USER=edu_system_user
DB_PASSWORD=your_strong_password
DB_HOST=localhost
DB_PORT=5432

# Email (اختیاری)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### مرحله 6: بروزرسانی settings.py

```python
# backend/config/settings.py
import os
from pathlib import Path

# Environment variables
DEBUG = os.getenv('DEBUG', 'False') == 'True'
SECRET_KEY = os.getenv('SECRET_KEY', 'change-this-in-production')
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost').split(',')

# Database
DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.postgresql'),
        'NAME': os.getenv('DB_NAME', 'edu_system_db'),
        'USER': os.getenv('DB_USER', 'edu_system_user'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

# Static files
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_ROOT = BASE_DIR / 'media'
```

### مرحله 7: Migrate و Collect Static

```bash
cd /var/www/edu-system/backend

# Migrate
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic --noinput

# Load initial data
python create_initial_data.py
```

### مرحله 8: تنظیم Gunicorn

```bash
# ایجاد فایل سرویس
sudo nano /etc/systemd/system/gunicorn.service
```

محتوای فایل:
```ini
[Unit]
Description=Gunicorn daemon for Educational System
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/edu-system/backend
Environment="PATH=/var/www/edu-system/venv/bin"
ExecStart=/var/www/edu-system/venv/bin/gunicorn \
          --workers 4 \
          --bind unix:/var/www/edu-system/backend/gunicorn.sock \
          config.wsgi:application

[Install]
WantedBy=multi-user.target
```

```bash
# فعال‌سازی و شروع سرویس
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
sudo systemctl status gunicorn
```

### مرحله 9: تنظیم Nginx

```bash
# ایجاد فایل کانفیگ
sudo nano /etc/nginx/sites-available/edu-system
```

محتوای فایل:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 10M;

    location = /favicon.ico { access_log off; log_not_found off; }
    
    location /static/ {
        alias /var/www/edu-system/backend/staticfiles/;
    }

    location /media/ {
        alias /var/www/edu-system/backend/media/;
    }

    location / {
        include proxy_params;
        proxy_pass http://unix:/var/www/edu-system/backend/gunicorn.sock;
    }
}
```

```bash
# فعال‌سازی سایت
sudo ln -s /etc/nginx/sites-available/edu-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### مرحله 10: تنظیم SSL (Let's Encrypt)

```bash
# نصب Certbot
sudo apt install -y certbot python3-certbot-nginx

# دریافت گواهی SSL
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# تست تمدید خودکار
sudo certbot renew --dry-run
```

---

## 🐳 Deploy با Docker (ساده‌تر)

### Dockerfile

```dockerfile
FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn psycopg2-binary

COPY backend/ .

RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "config.wsgi:application"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:14
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=edu_system_db
      - POSTGRES_USER=edu_system_user
      - POSTGRES_PASSWORD=your_strong_password
    restart: always

  web:
    build: .
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4
    volumes:
      - ./backend:/app
      - static_volume:/app/staticfiles
      - media_volume:/app/media
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      - db
    restart: always

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - static_volume:/app/staticfiles
      - media_volume:/app/media
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - web
    restart: always

volumes:
  postgres_data:
  static_volume:
  media_volume:
```

```bash
# اجرا
docker-compose up -d

# Migrate
docker-compose exec web python manage.py migrate

# Create superuser
docker-compose exec web python manage.py createsuperuser
```

---

## 🎯 Deploy روی Heroku (ساده‌ترین)

### مرحله 1: نصب Heroku CLI

```bash
# نصب
curl https://cli-assets.heroku.com/install.sh | sh

# لاگین
heroku login
```

### مرحله 2: ایجاد اپلیکیشن

```bash
cd backend
heroku create your-app-name
```

### مرحله 3: اضافه کردن PostgreSQL

```bash
heroku addons:create heroku-postgresql:mini
```

### مرحله 4: تنظیم Environment Variables

```bash
heroku config:set DEBUG=False
heroku config:set SECRET_KEY=your-secret-key
heroku config:set ALLOWED_HOSTS=your-app-name.herokuapp.com
```

### مرحله 5: ایجاد Procfile

```
web: gunicorn config.wsgi --log-file -
release: python manage.py migrate
```

### مرحله 6: ایجاد runtime.txt

```
python-3.10.12
```

### مرحله 7: Deploy

```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main

# Create superuser
heroku run python manage.py createsuperuser
```

---

## 📊 Monitoring و Maintenance

### نصب Monitoring Tools

```bash
# نصب Sentry (Error Tracking)
pip install sentry-sdk

# در settings.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[DjangoIntegration()],
    traces_sample_rate=1.0,
)
```

### تنظیم Backup خودکار

```bash
# ایجاد اسکریپت backup
sudo nano /usr/local/bin/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/edu-system"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U edu_system_user edu_system_db > $BACKUP_DIR/db_$DATE.sql

# Backup media files
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /var/www/edu-system/backend/media/

# حذف backup های قدیمی (بیشتر از 30 روز)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
# اجازه اجرا
sudo chmod +x /usr/local/bin/backup-db.sh

# اضافه کردن به crontab (روزانه ساعت 2 صبح)
sudo crontab -e
0 2 * * * /usr/local/bin/backup-db.sh
```

---

## 🔧 Troubleshooting

### مشکلات رایج:

#### 1. خطای 502 Bad Gateway
```bash
# بررسی لاگ Gunicorn
sudo journalctl -u gunicorn

# بررسی لاگ Nginx
sudo tail -f /var/log/nginx/error.log

# ریستارت سرویس‌ها
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

#### 2. خطای Database Connection
```bash
# بررسی وضعیت PostgreSQL
sudo systemctl status postgresql

# بررسی اتصال
psql -U edu_system_user -d edu_system_db -h localhost
```

#### 3. خطای Static Files
```bash
# جمع‌آوری مجدد
python manage.py collectstatic --noinput

# بررسی دسترسی‌ها
sudo chown -R www-data:www-data /var/www/edu-system/backend/staticfiles/
```

---

## ✅ چک‌لیست نهایی

- [ ] PostgreSQL نصب و تنظیم شده
- [ ] Environment variables تنظیم شده
- [ ] DEBUG=False در production
- [ ] SECRET_KEY تغییر کرده
- [ ] ALLOWED_HOSTS تنظیم شده
- [ ] Migrations اجرا شده
- [ ] Static files جمع‌آوری شده
- [ ] Superuser ایجاد شده
- [ ] Gunicorn راه‌اندازی شده
- [ ] Nginx پیکربندی شده
- [ ] SSL نصب شده
- [ ] Firewall تنظیم شده
- [ ] Backup خودکار فعال شده
- [ ] Monitoring راه‌اندازی شده

**🎉 سیستم آماده استفاده است!**
