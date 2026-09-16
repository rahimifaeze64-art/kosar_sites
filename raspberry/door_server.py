#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
door_server.py
────────────────────────────────────────────────────────────────
سرور کنترل در شرکت روی Raspberry Pi

این برنامه همیشه روی پورت 5000 گوش می‌دهد و دو endpoint دارد:
    POST /open   → باز کردن در
    POST /close  → بستن در
    GET  /health → تست اتصال (برای دکمه «تست اتصال» در پنل)

فرانت‌اند (js/company-door.js) همین آدرس را در localStorage با کلید
`door_api_base` ذخیره می‌کند و توکن را با هدر `X-Door-Token` می‌فرستد.

اجرا:
    pip3 install -r requirements.txt
    python3 door_server.py

تنظیمات از طریق متغیرهای محیطی (همه اختیاری):
    DOOR_TOKEN         توکن امنیتی (خالی = بدون احراز هویت)
    DOOR_PORT          پورت سرور (پیش‌فرض 5000)
    DOOR_OPEN_PIN      پین رله باز کردن  (پیش‌فرض BCM 18)
    DOOR_CLOSE_PIN     پین رله بستن در    (پیش‌فرض BCM 23)
    DOOR_PULSE_SECONDS مدت پالس رله       (پیش‌فرض 1.0)
    DOOR_RELAY_MODE    dual | single      (پیش‌فرض dual)
    DOOR_ACTIVE_HIGH   1 اگر رله‌ات active-high است
"""

import os
import hmac
import time
import signal
import logging
import threading
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
    log.info("GPIO آماده شد  open=BCM%d  close=BCM%d  mode=%s  pulse=%.1fs  active_high=%s",
             OPEN_PIN, CLOSE_PIN, RELAY_MODE, PULSE_SECONDS, ACTIVE_HIGH)


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
    global _state, _last_action, _last_at

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

        log.info("دستور %s اجرا شد (توسط: %s)", action, _client_name())
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
            log.warning("درخواست رد شد (توکن نامعتبر) از %s", request.remote_addr)
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
            "ok":         True,
            "status":     _state,
            "last_action": _last_action,
            "last_at":    _last_at,
            "gpio":       GPIO_AVAILABLE,
            "mode":       RELAY_MODE,
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
    })


# ── خروج تمیز ────────────────────────────────────────────────────
def _shutdown(*_):
    log.info("خاموش شدن سرور...")
    _relay_off(OPEN_PIN)
    _relay_off(CLOSE_PIN)
    try:
        GPIO.cleanup()
    except Exception:
        pass
    raise SystemExit(0)


if __name__ == "__main__":
    setup_gpio()
    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    log.info("سرور کنترل در روی %s:%d در حال اجراست", HOST, PORT)
    if not API_TOKEN:
        log.warning("DOOR_TOKEN خالی است → سرور بدون احراز هویت اجرا می‌شود! فقط در شبکه داخلی استفاده کن.")

    # waitress برای اجرا در محیط واقعی (چند ریسه، پایدار). اگر نبود، Flask.
    try:
        from waitress import serve
        log.info("اجرا با waitress")
        serve(app, host=HOST, port=PORT, threads=4)
    except ImportError:
        log.info("waitress نصب نیست → اجرا با سرور توسعه Flask")
        app.run(host=HOST, port=PORT, threaded=True, debug=False)
