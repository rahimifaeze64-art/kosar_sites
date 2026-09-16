# کنترل در شرکت با Raspberry Pi

این پوشه شامل سرور Raspberry Pi است که دستورهای باز/بسته شدن در را از پنل وب
(`js/company-door.js`) می‌گیرد و روی GPIO رله را فعال می‌کند.

## ۱) سخت‌افزار

```
Raspberry Pi ──GPIO──► ماژول رله ──► کنترلر در (موتور/برد در)
```

| رله | پین BCM پیش‌فرض | کاربرد |
|-----|------------------|--------|
| رله ۱ | `18` | باز کردن |
| رله ۲ | `23` | بستن |

- اگر در فقط **یک رله تاگل** دارد، با `DOOR_RELAY_MODE=single` هر دستور یک پالس می‌فرستد.
- برق رله را از 5V خودِ Pi و زمین مشترک بگیر (GND مشترک اجباری است).
- بیشتر ماژول‌های رله **active-low** هستند؛ اگر برعکس بود `DOOR_ACTIVE_HIGH=1` بگذار.

## ۲) نصب روی Raspberry Pi

```bash
sudo apt update
sudo apt install -y python3-pip python3-rpi.gpio

mkdir -p /home/pi/door
# فایل door_server.py و requirements.txt را داخل این پوشه کپی کن
cd /home/pi/door
pip3 install -r requirements.txt
```

## ۳) اجرای دستی (تست)

```bash
export DOOR_TOKEN="یک-توکن-تصادفی"
python3 door_server.py
```

تست از روی همان Pi:

```bash
curl -X POST http://127.0.0.1:5000/open -H "X-Door-Token: یک-توکن-تصادفی"
```

## ۴) اجرای دائم (systemd)

```bash
sudo cp door-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now door-server
sudo systemctl status door-server
journalctl -u door-server -f
```

## ۵) اتصال از اینترنت

سه روش، از امن‌ترین به کم‌امن‌ترین:

1. **Cloudflare Tunnel / ngrok (توصیه‌شده)** — بدون باز کردن پورت روی مودم.
   ```bash
   cloudflared tunnel --url http://localhost:5000
   ```
   آدرسی مثل `https://xxxx.trycloudflare.com` می‌دهد؛ همان را در تنظیمات پنل بگذار.

2. **Port Forwarding روی مودم شرکت** — پورت خارجی (مثلاً `8443`) را به `IP:5000` رزبری فوروارد کن.
   - IP رزبری را روی مودم **Static/DHCP Reservation** کن تا عوض نشود.
   - آدرس پنل: `http://PUBLIC_IP:8443` (اگر IP ثابت داری).
   - اگر IP داینامیک است از DDNS استفاده کن.

3. **Tailscale (VPN)** — رزبری و کلاینت‌ها به یک شبکه خصوصی وصل می‌شوند؛ امن‌ترین حالت.

> مهم: حتماً `DOOR_TOKEN` را تنظیم کن. بدون توکن هر کسی که آدرس را بداند می‌تواند در را باز کند.

## ۶) تنظیم در پنل وب

در صفحه «در شرکت» روی آیکون چرخ‌دنده بزن و:

- **آدرس API**: `http://PUBLIC_IP:8443` یا آدرس تونل
- **توکن**: همان `DOOR_TOKEN`

ذخیره کن و «تست اتصال» بزن.

## ۷) رفع اشکال

| نشانه | علت احتمالی |
|-------|-------------|
| پنل می‌گوید «اتصالات برقرار نیست» | آدرس API خالی است |
| خطای CORS / Network | سرور بالا نیست یا پورت فوروارد نشده |
| خطای 401 | توکن پنل با `DOOR_TOKEN` یکی نیست |
| خطای 409 | دستور قبلی هنوز در حال اجراست |
| رله برعکس کار می‌کند | `DOOR_ACTIVE_HIGH` را تغییر بده |
| `RPi.GPIO پیدا نشد` | روی خود رزبری اجرا نشده یا `python3-rpi.gpio` نصب نیست |
