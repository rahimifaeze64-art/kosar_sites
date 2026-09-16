#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
door_server.py
────────────────────────────────────────────────────────────────
سرور کنترل در شرکت روی Raspberry Pi — برای اجرای ۲۴ ساعته

این برنامه همیشه روی پورت مشخص گوش می‌دهد و درخواست‌ها را
به‌صورت خودکار دریافت و روی GPIO اجرا می‌کند:
    POST /open   → باز کردن در
    POST /close  → بستن در
    GET  /health → تست اتصال و وضعیت
    GET  /       → اطلاعات سرویس

هنگام اجرا، آدرس‌های لازم (IP داخلی، IP عمومی، گیت‌وی، آدرس پنل)
و وضعیت GPIO/فایروال/توکن را چاپ می‌کند.

اجرا:
    pip3 install -r requirements.txt
    python3 door_server.py

تنظیمات از طریق متغیرهای محیطی (همه اختیاری):
    DOOR_TOKEN           توکن امنیتی (خالی = بدون احراز هویت)
    DOOR_PORT            پورت سرور (پیش‌فرض 5000)
    DOOR_OPEN_PIN        پین رله باز کردن  (پیش‌فرض BCM 18)
    DOOR_CLOSE_PIN       پین رله بستن در    (پیش‌فرض BCM 23)
    DOOR_PULSE_SECONDS   مدت پالس رله       (پیش‌فرض 1.0)
    DOOR_RELAY_MODE      dual | single      (پیش‌فرض dual)
    DOOR_ACTIVE_HIGH     1 اگر رله active-high است
    DOOR_SETUP_FIREWALL  0 برای غیرفعال کردن باز کردن خودکار فایروال
"""

import os
import sys
import hmac
import time
import socket
import shutil
import signal
import logging
import platform
import ipaddress
import subprocess
import threading
import urllib.request
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify

# ── تنظیمات ──────────────────────────────────────────────────────
HOST = os.environ.get("DOOR_HOST", "0.0.0.0")
PORT = int(os.environ.get("DOOR_PORT", "5000"))

# توکن امنیتی. اگر مقدار داشته باشد، همه درخواست‌ها باید هدر
# X-Door-Token (یا ?token=) صحیح بفرستند.
API_TOKEN = os.environ.get("DOOR_TOKEN", "").strip()

# پین‌های GPIO با شماره‌گذاری BCM
OPEN_PIN  = int(os.environ.get("DOOR_OPEN_PIN", "18"))
CLOSE_PIN = int(os.environ.get("DOOR_CLOSE_PIN", "23"))

# مدت زمان فعال بودن رله برای هر دستور (ثانیه)
PULSE_SECONDS = float(os.environ.get("DOOR_PULSE_SECONDS", "1.0"))

# حالت رله:
#   dual   → دو رله جدا برای باز و بسته (پیش‌فرض)
#   single → یک رله؛ هر دستور فقط یک پالس می‌فرستد (درِ تاگل)
RELAY_MODE = os.environ.get("DOOR_RELAY_MODE", "dual").strip().lower()

# منطق فعال‌سازی رله. ماژول‌های رله ارزان‌قیمت معمولاً active-low هستند.
ACTIVE_HIGH = os.environ.get("DOOR_ACTIVE_HIGH", "0").strip().lower() in ("1", "true", "yes", "on")

# باز کردن خودکار پورت در فایروال هنگام بالا آمدن
SETUP_FIREWALL = os.environ.get("DOOR_SETUP_FIREWALL", "1").strip().lower() not in ("0", "false", "no", "off")

# ── ترفند امنیتی بدون توکن ───────────────────────────────────────
# فقط درخواست‌هایی که از همان شبکه محلی (همان مودم) آمده‌اند پذیرفته می‌شوند.
# به این ترتیب حتی اگر آدرس روی اینترنت لو برود، درخواست بیرونی رد می‌شود.
LAN_ONLY = os.environ.get("DOOR_LAN_ONLY", "1").strip().lower() not in ("0", "false", "no", "off")

# اگر خواستی سابنت را دستی بدهی (با کاما جدا کن): "192.168.1.0/24,10.0.0.0/8"
ALLOWED_SUBNETS = [s.strip() for s in os.environ.get("DOOR_ALLOWED_SUBNETS", "").split(",") if s.strip()]

# HTTPS اختیاری: اگر پنل با https باز می‌شود، مرورگر درخواست http به IP محلی را
# بلاک می‌کند (mixed content). با فعال کردن این گزینه روی https سرو می‌شود.
HTTPS = os.environ.get("DOOR_HTTPS", "0").strip().lower() in ("1", "true", "yes", "on")
_SCHEME = "https" if HTTPS else "http"
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CERT_FILE = os.environ.get("DOOR_CERT", os.path.join(_BASE_DIR, "cert.pem"))
KEY_FILE  = os.environ.get("DOOR_KEY",  os.path.join(_BASE_DIR, "key.pem"))

# ── لاگ ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("door")

app = Flask(__name__)

# ── GPIO (با fallback برای تست روی لپ‌تاپ) ───────────────────────
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except Exception:
    GPIO_AVAILABLE = False

    class _MockGPIO:
        BCM = "BCM"
        OUT = "OUT"
        HIGH = 1
        LOW = 0

        def setwarnings(self, *_): pass
        def setmode(self, *_): pass
        def setup(self, *_): pass
        def output(self, *_): pass
        def cleanup(self, *_): pass

    GPIO = _MockGPIO()
    log.warning("RPi.GPIO پیدا نشد → حالت شبیه‌سازی فعال است (بدون کنترل واقعی GPIO)")


# ── وضعیت داخلی ──────────────────────────────────────────────────
_state_lock    = threading.Lock()
_action_lock   = threading.Lock()   # جلوگیری از اجرای هم‌زمان دو دستور
_state         = "unknown"          # open | closed | unknown
_last_action   = None
_last_at       = None
_started_at    = datetime.now()
_command_count = 0


def _relay_on(pin):
    GPIO.output(pin, GPIO.HIGH if ACTIVE_HIGH else GPIO.LOW)


def _relay_off(pin):
    GPIO.output(pin, GPIO.HIGH if not ACTIVE_HIGH else GPIO.LOW)


def setup_gpio():
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(OPEN_PIN, GPIO.OUT)
    GPIO.setup(CLOSE_PIN, GPIO.OUT)
    _relay_off(OPEN_PIN)
    _relay_off(CLOSE_PIN)


def _pulse(pin):
    """رله را برای مدت کوتاه روشن و سپس خاموش می‌کند."""
    _relay_on(pin)
    time.sleep(PULSE_SECONDS)
    _relay_off(pin)


def execute_action(action):
    """
    دستور را روی GPIO اجرا می‌کند.
    خروجی: (ok: bool, message: str)
    """
    global _state, _last_action, _last_at, _command_count

    if not _action_lock.acquire(blocking=False):
        return False, "busy"        # یک دستور دیگر در حال اجراست

    try:
        if RELAY_MODE == "single":
            _pulse(OPEN_PIN)
        elif action == "open":
            _pulse(OPEN_PIN)
        else:
            _pulse(CLOSE_PIN)

        with _state_lock:
            _state       = "open" if action == "open" else "closed"
            _last_action = action
            _last_at     = datetime.now().isoformat(timespec="seconds")
            _command_count += 1

        log.info("✅ دستور %s اجرا شد (توسط: %s)", action, _client_name())
        return True, "ok"
    finally:
        _action_lock.release()


def _client_name():
    try:
        data = request.get_json(silent=True) or {}
        return str(data.get("requested_by") or request.remote_addr or "unknown")
    except Exception:
        return request.remote_addr or "unknown"


# ── احراز هویت ───────────────────────────────────────────────────
def _authorized():
    if not API_TOKEN:
        return True
    supplied = request.headers.get("X-Door-Token") or request.args.get("token", "")
    return hmac.compare_digest(str(supplied), API_TOKEN)


def require_token(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        # پیش‌پرواز CORS (OPTIONS) توکن ندارد و نباید رد شود
        if request.method == "OPTIONS":
            return fn(*args, **kwargs)
        if not _authorized():
            log.warning("⛔ درخواست رد شد (توکن نامعتبر) از %s", request.remote_addr)
            return jsonify({"ok": False, "error": "unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper


# ── CORS (لازم چون پنل وب از دامنه دیگری درخواست می‌زند) ─────────
@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"]  = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Door-Token"
    resp.headers["Access-Control-Max-Age"]       = "86400"
    return resp


# ── Endpoint ها ──────────────────────────────────────────────────
@app.route("/health", methods=["GET", "OPTIONS"])
@require_token
def health():
    if request.method == "OPTIONS":
        return ("", 204)
    with _state_lock:
        return jsonify({
            "ok":          True,
            "status":      _state,
            "last_action": _last_action,
            "last_at":     _last_at,
            "commands":    _command_count,
            "uptime":      str(datetime.now() - _started_at).split(".")[0],
            "gpio":        GPIO_AVAILABLE,
            "mode":        RELAY_MODE,
            "server_time": datetime.now().isoformat(timespec="seconds"),
        })


@app.route("/open", methods=["POST", "OPTIONS"])
@require_token
def open_door():
    if request.method == "OPTIONS":
        return ("", 204)
    ok, msg = execute_action("open")
    if not ok:
        return jsonify({"ok": False, "error": msg}), 409
    return jsonify({"ok": True, "status": "open", "action": "open"})


@app.route("/close", methods=["POST", "OPTIONS"])
@require_token
def close_door():
    if request.method == "OPTIONS":
        return ("", 204)
    ok, msg = execute_action("close")
    if not ok:
        return jsonify({"ok": False, "error": msg}), 409
    return jsonify({"ok": True, "status": "closed", "action": "close"})


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "kosar-company-door",
        "endpoints": ["GET /health", "POST /open", "POST /close"],
        "auth": bool(API_TOKEN),
        "gpio": GPIO_AVAILABLE,
    })


# ── اطلاعات شبکه برای چاپ هنگام اجرا ─────────────────────────────
def get_local_ip():
    """IP داخلی که رزبری با آن به مودم وصل است."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))     # هیچ بسته‌ای ارسال نمی‌شود
        return s.getsockname()[0]
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"
    finally:
        s.close()


def get_gateway():
    """IP مودم (گیت‌وی پیش‌فرض)."""
    for cmd in (["ip", "route"], ["route", "-n"]):
        if not shutil.which(cmd[0]):
            continue
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=5).stdout
            for line in out.splitlines():
                if line.strip().startswith("default") or " 0.0.0.0 " in line:
                    parts = line.split()
                    for p in parts:
                        if p.count(".") == 3 and not p.startswith("0.0.0.0"):
                            return p
        except Exception:
            continue
    return "نامشخص"


def get_public_ip():
    """IP عمومی شرکت از سرویس‌های مختلف."""
    for url in ("https://api.ipify.org", "https://ifconfig.me/ip", "https://icanhazip.com"):
        try:
            with urllib.request.urlopen(url, timeout=6) as r:
                ip = r.read().decode().strip()
                if ip:
                    return ip
        except Exception:
            continue
    return None


def is_cgnat(ip):
    if not ip:
        return False
    try:
        a, b = int(ip.split(".")[0]), int(ip.split(".")[1])
        return a == 100 and 64 <= b <= 127
    except Exception:
        return False


def get_local_cidr():
    """سابنت شبکه محلی را از خود سیستم می‌خواند؛ مثلاً 192.168.1.50/24."""
    try:
        out = subprocess.run(["ip", "-o", "-f", "inet", "addr", "show"],
                             capture_output=True, text=True, timeout=5).stdout
        local = get_local_ip()
        for line in out.splitlines():
            parts = line.split()
            for i, p in enumerate(parts):
                if p == "inet" and i + 1 < len(parts):
                    cidr = parts[i + 1]
                    if cidr.startswith(local + "/"):
                        return cidr
                    if cidr.startswith(("192.168.", "10.", "172.")):
                        return cidr
    except Exception:
        pass
    # پیش‌فرض رایج مودم‌های خانگی/شرکتی
    return get_local_ip() + "/24"


_networks_lock = threading.Lock()
_networks_cache = None


def _allowed_networks():
    """لیست شبکه‌های مجاز (لوکال‌هاست + سابنت خودت)."""
    global _networks_cache
    with _networks_lock:
        if _networks_cache is not None:
            return _networks_cache

        nets = [ipaddress.ip_network("127.0.0.0/8"),
                ipaddress.ip_network("::1/128")]

        sources = ALLOWED_SUBNETS or [get_local_cidr()]
        for s in sources:
            try:
                nets.append(ipaddress.ip_network(s, strict=False))
            except Exception:
                log.warning("سابنت نامعتبر نادیده گرفته شد: %s", s)

        _networks_cache = nets
        return nets


def is_lan_client(ip):
    """آیا درخواست از همان شبکه محلی آمده است؟"""
    if not ip:
        return False
    if ip.startswith("::ffff:"):        # IPv4 نگاشت‌شده به IPv6
        ip = ip[7:]
    try:
        addr = ipaddress.ip_address(ip)
    except Exception:
        return False
    return any(addr in net for net in _allowed_networks())


# ── گیت شبکه محلی: بدون توکن، فقط از همان مودم ───────────────────
@app.before_request
def restrict_to_lan():
    if not LAN_ONLY:
        return None
    if request.method == "OPTIONS":     # پیش‌پرواز CORS را رد نکن
        return None
    if is_lan_client(request.remote_addr):
        return None
    log.warning("⛔ درخواست از بیرون شبکه رد شد: %s %s از %s",
                request.method, request.path, request.remote_addr)
    return jsonify({
        "ok": False,
        "error": "forbidden",
        "reason": "فقط از داخل شبکه شرکت قابل دسترسی است",
    }), 403


# ── باز کردن خودکار پورت در فایروال ─────────────────────────────
def ensure_firewall():
    """اگر فایروال نرم‌افزاری فعال باشد، پورت را باز می‌کند."""
    rule = f"{PORT}/tcp"

    if shutil.which("ufw"):
        try:
            status = subprocess.run(["ufw", "status"], capture_output=True, text=True, timeout=5).stdout
        except Exception:
            status = ""

        if "Status: active" not in status:
            log.info("🛡 فایروال ufw فعال نیست → نیازی به باز کردن پورت نبود")
            return

        try:
            r = subprocess.run(["sudo", "-n", "ufw", "allow", rule],
                               capture_output=True, text=True, timeout=8)
            if r.returncode == 0:
                log.info("🛡 فایروال ufw: پورت %s باز شد", rule)
            else:
                log.warning("⚠ ufw فعال است ولی باز نشد. دستی اجرا کن:  sudo ufw allow %s", rule)
        except Exception:
            log.warning("⚠ برای باز کردن فایروال دستی اجرا کن:  sudo ufw allow %s", rule)
        return

    log.info("🛡 ufw نصب نیست → فایروال نرم‌افزاری روی رزبری غیرفعال است")


def ensure_cert():
    """ساخت گواهی SSL خودامضا در صورت فعال بودن HTTPS."""
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        return True
    if not shutil.which("openssl"):
        log.error("openssl نصب نیست؛ نمی‌توان گواهی ساخت:  sudo apt install -y openssl")
        return False
    try:
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", KEY_FILE, "-out", CERT_FILE, "-days", "3650",
            "-subj", "/CN=kosar-door.local",
        ], check=True, capture_output=True, timeout=60)
        log.info("🔐 گواهی SSL خودامضا ساخته شد: %s", CERT_FILE)
        return True
    except Exception as e:
        log.error("ساخت گواهی ناموفق: %s", e)
        return False


def print_server_report(local_ip, public_ip, gateway):
    """چاپ اطلاعات لازم هنگام اجرا."""
    line = "═" * 62
    print()
    print(line)
    print("   🚪  سرور کنترل در شرکت — Raspberry Pi")
    print(line)
    print(f"   زمان اجرا     : {_started_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   سیستم        : {platform.system()} {platform.release()} ({platform.machine()})")
    print(f"   Python        : {platform.python_version()}")
    print(f"   گوش دادن روی  : {HOST}:{PORT}   (۲۴ ساعته و خودکار)")
    print(line)
    print("   🌐 شبکه")
    print(f"   IP داخلی رزبری : {local_ip}")
    print(f"   IP مودم (گیت‌وی): {gateway}")
    print(f"   IP عمومی شرکت  : {public_ip or 'دریافت نشد (اینترنت قطع است؟)'}")
    print(line)
    print("   🔗 آدرس‌ها")
    print(f"   آدرس پنل (LAN) : {_SCHEME}://{local_ip}:{PORT}")
    print(f"   تست داخلی      : {_SCHEME}://{local_ip}:{PORT}/health")
    if LAN_ONLY and not HTTPS:
        print("   ⚠ اگر پنل با https باز می‌شود، این آدرس باید https باشد")
        print("     → با DOOR_HTTPS=1 اجرا کن")
    print(line)
    print("   ⚙ کنترل در")
    print(f"   پین باز کردن   : BCM {OPEN_PIN}")
    print(f"   پین بستن       : BCM {CLOSE_PIN}")
    print(f"   حالت رله       : {RELAY_MODE}")
    print(f"   مدت پالس       : {PULSE_SECONDS} ثانیه")
    print(f"   active-high    : {ACTIVE_HIGH}")
    print(f"   GPIO واقعی     : {'بله ✅' if GPIO_AVAILABLE else 'نه ❌ (شبیه‌سازی)'}")
    print(f"   توکن امنیتی    : {'فعال ✅' if API_TOKEN else 'غیرفعال (لازم نیست)'}")
    if LAN_ONLY:
        nets = ", ".join(str(n) for n in _allowed_networks())
        print(f"   فقط شبکه محلی  : فعال ✅   ({nets})")
        print("                    درخواست از اینترنت به‌صورت خودکار رد می‌شود")
    else:
        print("   فقط شبکه محلی  : غیرفعال ⚠ (همه شبکه‌ها پذیرفته می‌شوند)")
    print(line)
    print("   📡 Endpoint ها")
    print(f"   POST  {_SCHEME}://{local_ip}:{PORT}/open    → باز کردن در")
    print(f"   POST  {_SCHEME}://{local_ip}:{PORT}/close   → بستن در")
    print(f"   GET   {_SCHEME}://{local_ip}:{PORT}/health  → وضعیت")
    print(line)

    if LAN_ONLY:
        print("   📶 حالت شبکه محلی (بدون توکن و بدون اینترنت)")
        print("      ۱) گوشی را به همان وای‌فای مودم شرکت وصل کن")
        print(f"      ۲) در پنل، آدرس API را بگذار:  {_SCHEME}://{local_ip}:{PORT}")
        print("      ۳) توکن را خالی بگذار")
        print("      هیچ پورت‌فورواردی لازم نیست.")
        if public_ip:
            print("      نکته: پورت روی اینترنت باز نیست؛ پس از بیرون شبکه کار نمی‌کند (طبق خواسته).")
        print(line)
    elif is_cgnat(public_ip):
        print("   ⚠ هشدار CGNAT: IP عمومی در محدوده 100.64.x.x است.")
        print("     پورت‌فوروارد مودم کار نمی‌کند؛ از تونل استفاده کن:")
        print("     cloudflared tunnel --url http://localhost:%d" % PORT)
        print(line)
    else:
        print("   📌 یادآوری: پورت‌فوروارد مودم را روی")
        print(f"      {PORT} TCP  →  {local_ip}:{PORT}   تنظیم کن.")
        print(line)

    print("   برای توقف: Ctrl+C")
    print(line)
    print()
    sys.stdout.flush()


# ── اجرای همیشه‌فعال با راه‌اندازی مجدد خودکار ───────────────────
def run_forever():
    if HTTPS:
        ssl_ctx = (CERT_FILE, KEY_FILE)
        run = lambda: app.run(host=HOST, port=PORT, threaded=True,
                              debug=False, use_reloader=False, ssl_context=ssl_ctx)
        engine = "flask+ssl (HTTPS)"
    else:
        try:
            from waitress import serve
            run = lambda: serve(app, host=HOST, port=PORT, threads=8)
            engine = "waitress"
        except ImportError:
            run = lambda: app.run(host=HOST, port=PORT, threaded=True, debug=False, use_reloader=False)
            engine = "flask"

    log.info("سرور با %s در حال گوش دادن است...", engine)
    while True:
        try:
            run()
            log.warning("سرور غیرمنتظره متوقف شد؛ راه‌اندازی مجدد در ۳ ثانیه...")
        except KeyboardInterrupt:
            raise
        except SystemExit:
            raise
        except Exception as e:
            log.error("خطای سرور: %s → راه‌اندازی مجدد در ۳ ثانیه", e)
        time.sleep(3)


# ── خروج تمیز ────────────────────────────────────────────────────
def _shutdown(*_):
    log.info("خاموش شدن سرور... آزادسازی GPIO")
    try:
        _relay_off(OPEN_PIN)
        _relay_off(CLOSE_PIN)
        GPIO.cleanup()
    except Exception:
        pass
    raise SystemExit(0)


if __name__ == "__main__":
    setup_gpio()
    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    if SETUP_FIREWALL:
        ensure_firewall()

    if HTTPS and not ensure_cert():
        log.warning("⚠ HTTPS غیرفعال شد → روی HTTP ادامه می‌دهیم")
        HTTPS = False
        _SCHEME = "http"

    local_ip = get_local_ip()
    gateway  = get_gateway()
    public_ip = get_public_ip()
    print_server_report(local_ip, public_ip, gateway)

    if not API_TOKEN:
        log.warning("DOOR_TOKEN خالی است → بدون احراز هویت. هر کسی آدرس را بداند می‌تواند در را باز کند.")

    run_forever()
