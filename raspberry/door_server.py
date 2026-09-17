#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
door_server.py — تک‌فایلِ کنترل در شرکت روی Raspberry Pi
════════════════════════════════════════════════════════════════
همه‌چیز در همین یک فایل است: سرور، نصب وابستگی‌ها، و ساخت سرویس ۲۴ ساعته.

اجرا (همین یکی کافیه، همه کار خودکار انجام می‌شود):
    sudo python3 door_server.py install     ← نصب دائمی ۲۴ ساعته (توصیه‌شده)
    python3 door_server.py                  ← اجرای دستی برای تست
    python3 door_server.py status           ← وضعیت سرویس
    python3 door_server.py uninstall        ← حذف کامل سرویس

Endpoint ها:
    POST /open    → باز کردن در   (GPIO 23)
    POST /close   → بستن در        (GPIO 24)
    GET  /health  → وضعیت و تست اتصال

امنیت: DOOR_LAN_ONLY=1 (پیش‌فرض) → فقط درخواست‌های داخل شبکه شرکت پذیرفته
می‌شوند؛ بدون توکن و بدون پورتفوروارد. درخواست از اینترنت خودکار رد می‌شود.

تنظیمات با متغیر محیطی (همه اختیاری):
    DOOR_PORT / DOOR_OPEN_PIN / DOOR_CLOSE_PIN
    DOOR_PULSE_SECONDS / DOOR_RELAY_MODE / DOOR_ACTIVE_HIGH
    DOOR_TOKEN / DOOR_LAN_ONLY / DOOR_HTTPS / DOOR_SETUP_FIREWALL
"""

import os
import sys
import time
import hmac
import errno
import socket
import shutil
import signal
import logging
import platform
import ipaddress
import subprocess
import threading
import urllib.request
import importlib
from datetime import datetime
from functools import wraps

# ── تنظیمات ──────────────────────────────────────────────────────
HOST = os.environ.get("DOOR_HOST", "0.0.0.0")
PORT = int(os.environ.get("DOOR_PORT", "5000"))

# توکن امنیتی. خالی = بدون توکن (در حالت LAN_ONLY امن است).
API_TOKEN = os.environ.get("DOOR_TOKEN", "").strip()

# پین‌های GPIO با شماره‌گذاری BCM (اپتوکوپلرها)
OPEN_PIN  = int(os.environ.get("DOOR_OPEN_PIN", "23"))
CLOSE_PIN = int(os.environ.get("DOOR_CLOSE_PIN", "24"))

# مدت فعال بودن خروجی برای هر دستور (ثانیه)
# حداقل ۵ ثانیه لازم است تا کنترلر/ریموت در فرمان را تشخیص دهد.
PULSE_SECONDS = float(os.environ.get("DOOR_PULSE_SECONDS", "5.0"))

# dual = دو کانال جدا | single = یک کانال تاگل
RELAY_MODE = os.environ.get("DOOR_RELAY_MODE", "dual").strip().lower()

# اپتوکوپلرها معمولاً active-low هستند. اگر با HIGH روشن می‌شوند =1
ACTIVE_HIGH = os.environ.get("DOOR_ACTIVE_HIGH", "0").strip().lower() in ("1", "true", "yes", "on")

# باز کردن خودکار پورت در فایروال هنگام بالا آمدن
SETUP_FIREWALL = os.environ.get("DOOR_SETUP_FIREWALL", "1").strip().lower() not in ("0", "false", "no", "off")

# ترفند امنیتی: فقط درخواست‌های همان شبکه محلی پذیرفته شوند
LAN_ONLY = os.environ.get("DOOR_LAN_ONLY", "1").strip().lower() not in ("0", "false", "no", "off")
ALLOWED_SUBNETS = [s.strip() for s in os.environ.get("DOOR_ALLOWED_SUBNETS", "").split(",") if s.strip()]

# HTTPS اختیاری (اگر پنل با https باز می‌شود)
HTTPS = os.environ.get("DOOR_HTTPS", "0").strip().lower() in ("1", "true", "yes", "on")
_SCHEME = "https" if HTTPS else "http"
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CERT_FILE = os.environ.get("DOOR_CERT", os.path.join(_BASE_DIR, "cert.pem"))
KEY_FILE  = os.environ.get("DOOR_KEY",  os.path.join(_BASE_DIR, "key.pem"))

SERVICE_NAME = "door-server"
SERVICE_PATH = f"/etc/systemd/system/{SERVICE_NAME}.service"


def in_venv():
    return sys.prefix != getattr(sys, "base_prefix", sys.prefix)


def system_python():
    """پایتون سیستم (نه venv) — چون GPIO apt فقط برای پایتون سیستم دیده می‌شود."""
    if in_venv() and os.path.exists("/usr/bin/python3"):
        return "/usr/bin/python3"
    return sys.executable or "/usr/bin/python3"

# ── نصب خودکار وابستگی‌های پایتون ────────────────────────────────
def _pip_install(pkgs):
    for extra in ([], ["--break-system-packages"]):
        try:
            cmd = [sys.executable, "-m", "pip", "install", "--quiet", *extra, *pkgs]
            if subprocess.run(cmd, timeout=240).returncode == 0:
                return True
        except Exception:
            pass
    return False


try:
    from flask import Flask, request, jsonify
except ImportError:
    print("📦 نصب خودکار flask و waitress ...")
    if not _pip_install(["flask", "waitress"]):
        sys.exit("❌ نصب خودکار ناموفق بود. دستی اجرا کن:  pip3 install flask waitress")
    importlib.invalidate_caches()
    from flask import Flask, request, jsonify


# ── لاگ ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("door")

app = Flask(__name__)

# ── GPIO (با fallback برای تست) ──────────────────────────────────
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


def _reexec_with(py):
    print(f"↻ اجرای مجدد با {py} ...\n")
    sys.stdout.flush()
    try:
        os.execv(py, [py, os.path.abspath(__file__), *sys.argv[1:]])
    except Exception as e:
        print(f"اجرای مجدد ناموفق بود: {e}")


def maybe_reexec_for_gpio():
    """
    اگر داخل venv هستیم و GPIO فقط برای پایتون سیستم نصب است،
    همین اسکریپت را با پایتون سیستم دوباره اجرا می‌کنیم تا GPIO واقعی کار کند.
    """
    if GPIO_AVAILABLE or not in_venv():
        return
    sys_py = "/usr/bin/python3"
    if not os.path.exists(sys_py):
        return
    try:
        if subprocess.run([sys_py, "-c", "import RPi.GPIO"],
                          capture_output=True, timeout=20).returncode == 0:
            _reexec_with(sys_py)
    except Exception:
        pass


# ── وضعیت داخلی ──────────────────────────────────────────────────
_state_lock    = threading.Lock()
_action_lock   = threading.Lock()
_state         = "unknown"
_last_action   = None
_last_at       = None
_last_pin      = None
_last_level    = None
_started_at    = datetime.now()
_command_count = 0

# پین فیزیکی روی هدر ۴۰ پین متناظر هر BCM
_PHYSICAL_PIN = {23: 16, 24: 18, 25: 22, 17: 11, 27: 13, 22: 15, 5: 29, 6: 31,
                 12: 32, 13: 33, 16: 36, 19: 35, 20: 38, 21: 40, 26: 37}


def _pin_label(pin):
    phys = _PHYSICAL_PIN.get(pin)
    return f"BCM {pin}" + (f" (پین فیزیکی {phys})" if phys else "")


def _active_level():
    return GPIO.HIGH if ACTIVE_HIGH else GPIO.LOW


def _inactive_level():
    return GPIO.HIGH if not ACTIVE_HIGH else GPIO.LOW


def _level_name(level):
    return "HIGH (3.3V)" if level == GPIO.HIGH else "LOW (0V)"


def _relay_on(pin):
    GPIO.output(pin, _active_level())


def _relay_off(pin):
    GPIO.output(pin, _inactive_level())


def setup_gpio():
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(OPEN_PIN, GPIO.OUT)
    GPIO.setup(CLOSE_PIN, GPIO.OUT)
    _relay_off(OPEN_PIN)
    _relay_off(CLOSE_PIN)
    log.info("🔧 GPIO آماده: باز=%s | بستن=%s | حالت=%s | پالس=%.1fs",
             _pin_label(OPEN_PIN), _pin_label(CLOSE_PIN), RELAY_MODE, PULSE_SECONDS)


def _pulse(pin, action):
    on, off = _active_level(), _inactive_level()
    log.info("🔌 دستور «%s» → %s فعال شد | سطح: %s | مدت: %.1f ثانیه",
             "باز کردن" if action == "open" else "بستن", _pin_label(pin), _level_name(on), PULSE_SECONDS)
    _relay_on(pin)
    time.sleep(PULSE_SECONDS)
    _relay_off(pin)
    log.info("   ↳ %s غیرفعال شد | سطح: %s", _pin_label(pin), _level_name(off))


def execute_action(action):
    global _state, _last_action, _last_at, _last_pin, _last_level, _command_count

    if not _action_lock.acquire(blocking=False):
        return False, "busy"

    try:
        if RELAY_MODE == "single":
            pin = OPEN_PIN
        elif action == "open":
            pin = OPEN_PIN
        else:
            pin = CLOSE_PIN

        _pulse(pin, action)

        with _state_lock:
            _state       = "open" if action == "open" else "closed"
            _last_action = action
            _last_at     = datetime.now().isoformat(timespec="seconds")
            _last_pin    = pin
            _last_level  = _level_name(_active_level())
            _command_count += 1

        log.info("✅ دستور «%s» روی %s اجرا شد (توسط: %s)",
                 "باز کردن" if action == "open" else "بستن", _pin_label(pin), _client_name())
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
        if request.method == "OPTIONS":
            return fn(*args, **kwargs)
        if not _authorized():
            log.warning("⛔ توکن نامعتبر از %s", request.remote_addr)
            return jsonify({"ok": False, "error": "unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper


# ── CORS ─────────────────────────────────────────────────────────
@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"]  = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Door-Token"
    resp.headers["Access-Control-Max-Age"]       = "86400"
    return resp


# ── تشخیص شبکه محلی ──────────────────────────────────────────────
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"
    finally:
        s.close()


def get_local_cidr():
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
    return get_local_ip() + "/24"


_networks_cache = None
_networks_lock = threading.Lock()


def _allowed_networks():
    global _networks_cache
    with _networks_lock:
        if _networks_cache is not None:
            return _networks_cache
        nets = [ipaddress.ip_network("127.0.0.0/8"), ipaddress.ip_network("::1/128")]
        for s in (ALLOWED_SUBNETS or [get_local_cidr()]):
            try:
                nets.append(ipaddress.ip_network(s, strict=False))
            except Exception:
                log.warning("سابنت نامعتبر نادیده گرفته شد: %s", s)
        _networks_cache = nets
        return nets


def is_lan_client(ip):
    if not ip:
        return False
    if ip.startswith("::ffff:"):
        ip = ip[7:]
    try:
        addr = ipaddress.ip_address(ip)
    except Exception:
        return False
    return any(addr in net for net in _allowed_networks())


@app.before_request
def restrict_to_lan():
    if not LAN_ONLY or request.method == "OPTIONS":
        return None
    if is_lan_client(request.remote_addr):
        return None
    log.warning("⛔ درخواست از بیرون شبکه رد شد: %s %s از %s",
                request.method, request.path, request.remote_addr)
    return jsonify({"ok": False, "error": "forbidden",
                    "reason": "فقط از داخل شبکه شرکت"}), 403


def get_gateway():
    for cmd in (["ip", "route"], ["route", "-n"]):
        if not shutil.which(cmd[0]):
            continue
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=5).stdout
            for line in out.splitlines():
                if line.strip().startswith("default") or " 0.0.0.0 " in line:
                    for p in line.split():
                        if p.count(".") == 3 and not p.startswith("0.0.0.0"):
                            return p
        except Exception:
            continue
    return "نامشخص"


def get_public_ip():
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


# ── فایروال ──────────────────────────────────────────────────────
def ensure_firewall():
    rule = f"{PORT}/tcp"
    if not shutil.which("ufw"):
        log.info("🛡 ufw نصب نیست → فایروال نرم‌افزاری غیرفعال است")
        return
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
            log.warning("⚠ برای باز کردن فایروال:  sudo ufw allow %s", rule)
    except Exception:
        log.warning("⚠ برای باز کردن فایروال:  sudo ufw allow %s", rule)


def ensure_cert():
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        return True
    if not shutil.which("openssl"):
        log.error("openssl نصب نیست:  sudo apt install -y openssl")
        return False
    try:
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", KEY_FILE, "-out", CERT_FILE, "-days", "3650",
            "-subj", "/CN=kosar-door.local",
        ], check=True, capture_output=True, timeout=60)
        log.info("🔐 گواهی SSL ساخته شد: %s", CERT_FILE)
        return True
    except Exception as e:
        log.error("ساخت گواهی ناموفق: %s", e)
        return False


# ── Endpoint ها ──────────────────────────────────────────────────
@app.route("/health", methods=["GET", "OPTIONS"])
@require_token
def health():
    if request.method == "OPTIONS":
        return ("", 204)
    with _state_lock:
        return jsonify({
            "ok": True, "status": _state, "last_action": _last_action,
            "last_at": _last_at, "commands": _command_count,
            "uptime": str(datetime.now() - _started_at).split(".")[0],
            "gpio": GPIO_AVAILABLE, "mode": RELAY_MODE,
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
    return jsonify({"service": "kosar-company-door",
                    "endpoints": ["GET /health", "POST /open", "POST /close"],
                    "auth": bool(API_TOKEN), "gpio": GPIO_AVAILABLE})


# ── گزارش شروع ───────────────────────────────────────────────────
def print_server_report(local_ip, public_ip, gateway):
    line = "═" * 62
    print()
    print(line)
    print("   🚪  سرور کنترل در شرکت — Raspberry Pi")
    print(line)
    print(f"   زمان اجرا     : {_started_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   سیستم        : {platform.system()} {platform.release()} ({platform.machine()})")
    print(f"   Python        : {platform.python_version()}")
    print(f"   گوش دادن روی  : {HOST}:{PORT}")
    print(line)
    print("   🌐 شبکه")
    print(f"   IP داخلی رزبری : {local_ip}")
    print(f"   IP مودم (گیت‌وی): {gateway}")
    print(f"   IP عمومی شرکت  : {public_ip or 'دریافت نشد'}")
    print(line)
    print("   🔗 آدرس پنل")
    print(f"   {_SCHEME}://{local_ip}:{PORT}")
    print(f"   تست: {_SCHEME}://{local_ip}:{PORT}/health")
    print(line)
    print("   ⚙ کنترل در")
    print(f"   اپتوکوپلر باز  : BCM {OPEN_PIN}")
    print(f"   اپتوکوپلر بستن : BCM {CLOSE_PIN}")
    print(f"   حالت خروجی     : {RELAY_MODE}   |   پالس: {PULSE_SECONDS}s   |   active-high: {ACTIVE_HIGH}")
    print(f"   GPIO واقعی     : {'بله ✅' if GPIO_AVAILABLE else 'نه ❌ (شبیه‌سازی)'}")
    if in_venv():
        print("   محیط           : venv ⚠ (بسته‌های apt اینجا دیده نمی‌شوند)")
    print(f"   توکن امنیتی    : {'فعال ✅' if API_TOKEN else 'غیرفعال (لازم نیست)'}")
    if LAN_ONLY:
        print(f"   فقط شبکه محلی  : فعال ✅ ({', '.join(str(n) for n in _allowed_networks())})")
    print(line)
    if LAN_ONLY:
        print("   📶 گوشی را به همان وای‌فای مودم وصل کن و در پنل بگذار:")
        print(f"      آدرس API: {_SCHEME}://{local_ip}:{PORT}   (توکن: خالی)")
    elif is_cgnat(public_ip):
        print("   ⚠ CGNAT: از تونل استفاده کن.")
    else:
        print(f"   📌 پورت‌فوروارد: {PORT} TCP → {local_ip}:{PORT}")
    print(line)
    print("   توقف: Ctrl+C")
    print(line)
    print()
    sys.stdout.flush()


# ── اجرای همیشه‌فعال ─────────────────────────────────────────────
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
            run = lambda: app.run(host=HOST, port=PORT, threaded=True,
                                  debug=False, use_reloader=False)
            engine = "flask"

    log.info("سرور با %s در حال گوش دادن است...", engine)
    while True:
        try:
            run()
            log.warning("سرور متوقف شد؛ راه‌اندازی مجدد در ۳ ثانیه...")
        except (KeyboardInterrupt, SystemExit):
            raise
        except OSError as e:
            if e.errno == errno.EADDRINUSE:
                log.error(
                    "پورت %d قبلاً اشغال است (یک نمونهٔ دیگر در حال اجراست).\n"
                    "   ببندش و دوباره اجرا کن:\n"
                    "     sudo systemctl stop door-server 2>/dev/null; pkill -f door_server.py\n"
                    "     sudo ss -tlnp | grep %d", PORT, PORT)
                log.error("تلاش مجدد در ۱۵ ثانیه...")
                time.sleep(15)
                continue
            log.error("خطای سرور: %s → راه‌اندازی مجدد در ۳ ثانیه", e)
        except Exception as e:
            log.error("خطای سرور: %s → راه‌اندازی مجدد در ۳ ثانیه", e)
        time.sleep(3)


def _shutdown(*_):
    log.info("خاموش شدن سرور... آزادسازی GPIO")
    try:
        _relay_off(OPEN_PIN)
        _relay_off(CLOSE_PIN)
        GPIO.cleanup()
    except Exception:
        pass
    raise SystemExit(0)


# ── نصب سرویس systemd (همه‌چیز از همین فایل) ────────────────────
def build_service_unit():
    script  = os.path.abspath(__file__)
    workdir = os.path.dirname(script)
    user    = os.environ.get("SUDO_USER") or os.environ.get("USER") or "pi"
    py      = system_python()

    lines = [
        "[Unit]",
        "Description=Kosar Company Door Server (Raspberry Pi GPIO)",
        "After=network-online.target",
        "Wants=network-online.target",
        "",
        "[Service]",
        "Type=simple",
        f"User={user}",
        f'WorkingDirectory="{workdir}"',
        f"Environment=DOOR_PORT={PORT}",
        f"Environment=DOOR_OPEN_PIN={OPEN_PIN}",
        f"Environment=DOOR_CLOSE_PIN={CLOSE_PIN}",
        f"Environment=DOOR_PULSE_SECONDS={PULSE_SECONDS}",
        f"Environment=DOOR_RELAY_MODE={RELAY_MODE}",
        f"Environment=DOOR_ACTIVE_HIGH={1 if ACTIVE_HIGH else 0}",
        f"Environment=DOOR_SETUP_FIREWALL={1 if SETUP_FIREWALL else 0}",
        f"Environment=DOOR_LAN_ONLY={1 if LAN_ONLY else 0}",
        f"Environment=DOOR_HTTPS={1 if HTTPS else 0}",
    ]
    if API_TOKEN:
        lines.append(f"Environment=DOOR_TOKEN={API_TOKEN}")
    lines += [
        f'ExecStart={py} "{script}"',
        "Restart=always",
        "RestartSec=3",
        "",
        "[Install]",
        "WantedBy=multi-user.target",
        "",
    ]
    return "\n".join(lines)


def _systemctl(*args):
    try:
        return subprocess.run(["systemctl", *args], capture_output=True, text=True, timeout=30)
    except Exception as e:
        log.error("systemctl اجرا نشد: %s", e)
        return None


def gpio_install_hint():
    return (
        "برای فعال شدن GPIO واقعی:\n"
        "   sudo apt update\n"
        "   sudo apt install -y python3-lgpio python3-rpi.gpio\n"
        "   و برنامه را با پایتون سیستم اجرا کن (نه داخل venv):\n"
        "   deactivate ; python3 door_server.py\n"
        "اگر venv لازم است: python3 -m venv --system-site-packages venv"
    )


def _gpio_import_ok():
    try:
        importlib.invalidate_caches()
        import RPi.GPIO  # noqa: F401
        return True
    except Exception:
        return False


def ensure_gpio_apt():
    """نصب کتابخانه GPIO روی رزبری (فقط وقتی root هستیم)."""
    if GPIO_AVAILABLE or os.geteuid() != 0 or not shutil.which("apt-get"):
        return
    if platform.machine() not in ("armv7l", "aarch64", "armv6l"):
        return
    try:
        log.info("📦 نصب کتابخانه GPIO (lgpio / rpi.gpio) ...")
        subprocess.run(["apt-get", "update", "-qq"], timeout=240)
        for pkg in ("python3-lgpio", "python3-rpi-lgpio", "python3-rpi.gpio"):
            subprocess.run(["apt-get", "install", "-y", "-qq", pkg], timeout=240)
    except Exception:
        pass
    # آخرین راه: نصب از pip (rpi-lgpio جایگزین RPi.GPIO روی سیستم‌های جدید)
    if not _gpio_import_ok():
        log.info("📦 نصب rpi-lgpio با pip ...")
        _pip_install(["rpi-lgpio"])


def install_service():
    if os.geteuid() != 0:
        print("❌ با sudo اجرا کن:   sudo python3 door_server.py install")
        return 1

    ensure_gpio_apt()
    if HTTPS:
        ensure_cert()

    try:
        with open(SERVICE_PATH, "w", encoding="utf-8") as f:
            f.write(build_service_unit())
    except Exception as e:
        print(f"❌ نوشتن فایل سرویس ناموفق بود: {e}")
        return 1

    _systemctl("daemon-reload")
    _systemctl("enable", SERVICE_NAME)
    _systemctl("restart", SERVICE_NAME)

    print()
    print("═" * 62)
    print("   ✅ سرویس نصب و اجرا شد — ۲۴ ساعته و خودکار")
    print("═" * 62)
    print(f"   فایل سرویس : {SERVICE_PATH}")
    print(f"   اجرا از     : {os.path.abspath(__file__)}")
    print()
    print("   وضعیت  : sudo systemctl status door-server")
    print("   لاگ    : journalctl -u door-server -f")
    print("   توقف   : sudo systemctl stop door-server")
    print("   حذف    : sudo python3 door_server.py uninstall")
    print("═" * 62)
    return 0


def uninstall_service():
    if os.geteuid() != 0:
        print("❌ با sudo اجرا کن:   sudo python3 door_server.py uninstall")
        return 1
    _systemctl("stop", SERVICE_NAME)
    _systemctl("disable", SERVICE_NAME)
    try:
        if os.path.exists(SERVICE_PATH):
            os.remove(SERVICE_PATH)
    except Exception:
        pass
    _systemctl("daemon-reload")
    print("🗑  سرویس حذف شد.")
    return 0


def service_status():
    r = _systemctl("status", SERVICE_NAME, "--no-pager")
    if r:
        print(r.stdout or r.stderr)
    local_ip = get_local_ip()
    print()
    print(f"🔗 آدرس پنل (اگر سرویس فعال است): {_SCHEME}://{local_ip}:{PORT}")
    return 0


# ── main ─────────────────────────────────────────────────────────
def main():
    args = [a.lower() for a in sys.argv[1:]]
    cmd = args[0] if args else "run"

    if cmd in ("install", "enable"):
        return install_service()
    if cmd in ("uninstall", "remove"):
        return uninstall_service()
    if cmd in ("status",):
        return service_status()
    if cmd in ("help", "-h", "--help"):
        print(__doc__)
        return 0
    if cmd not in ("run", "start", ""):
        print(f"دستور نامشخص: {cmd}\n")
        print(__doc__)
        return 1

    # اگر GPIO نبود، تلاش کن نصب شود و با پایتون مناسب دوباره اجرا کن
    if not GPIO_AVAILABLE:
        ensure_gpio_apt()
        if _gpio_import_ok():
            _reexec_with(system_python())
    maybe_reexec_for_gpio()      # اگر داخل venv باشیم، خودکار با پایتون سیستم اجرا می‌شود

    setup_gpio()
    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    if SETUP_FIREWALL:
        ensure_firewall()

    global HTTPS, _SCHEME
    if HTTPS and not ensure_cert():
        log.warning("⚠ HTTPS غیرفعال شد → روی HTTP ادامه می‌دهیم")
        HTTPS = False
        _SCHEME = "http"

    print_server_report(get_local_ip(), get_public_ip(), get_gateway())

    if not GPIO_AVAILABLE:
        log.warning("GPIO در حالت شبیه‌سازی است.\n%s", gpio_install_hint())
    if not API_TOKEN and not LAN_ONLY:
        log.warning("بدون توکن و بدون محدودیت شبکه → هر کسی می‌تواند در را باز کند!")

    run_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
