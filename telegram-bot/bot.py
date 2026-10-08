#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bot.py — پوستهٔ سبک ربات تلگرام برای «تلگرام ارسال تعدیلات»

این ربات دیگر گفتگو ندارد. کارش فقط این است:
    • دکمهٔ منوی چت را به تلگرام وصل کند
    • با /start دکمهٔ «باز کردن تلگرام» بفرستد
    • /status وضعیت آخرین ارسال‌ها را نشان دهد
    • (اختیاری) با notify_on_new = true به مدیرها خبر دهد

تمام منطق ارسال فایل در تلگرام است:
    tadilat-app.html  +  js/tadilat-app.js  +  css/tadilat-app.css
و فایل‌ها مستقیم از مرورگر دانشجو به Supabase Storage می‌روند
(سقف ۵۰ مگابایت — به‌جای سقف ۲۰ مگابایتی دانلود Bot API).

اجرا:
    python bot.py                # اجرای ربات
    python bot.py --check        # بررسی سلامت توکن، دیتابیس، جدول‌ها و آدرس تلگرام
    python bot.py --set-menu     # فقط ثبت دکمهٔ منو (بدون اجرای حلقه)
    python bot.py --init-config  # ساخت config.json از روی نمونه

بدون هیچ وابستگی خارجی — فقط کتابخانهٔ استاندارد پایتون ۳.۸+
"""

import argparse
import html
import json
import os
import sys
import time
import traceback
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

from sbservice import Supabase, SupabaseError, safe_storage_key  # noqa: E402
from routing import Router, norm_name  # noqa: E402

CONFIG_FILE = os.path.join(_THIS_DIR, "config.json")
EXAMPLE_CONFIG = os.path.join(_THIS_DIR, "config.example.json")
STATE_FILE = os.path.join(_THIS_DIR, "bot_state.json")
LOG_FILE = os.path.join(_THIS_DIR, "bot.log")


# ══════════════════════════════════════════════════════════════
# لاگ
# ══════════════════════════════════════════════════════════════
def log(message, level="INFO"):
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = "[%s] %-5s %s" % (stamp, level, message)
    try:
        print(line, flush=True)
    except Exception:
        pass
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 5 * 1024 * 1024:
            os.replace(LOG_FILE, LOG_FILE + ".1")
        with open(LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════
# تنظیمات
# ══════════════════════════════════════════════════════════════
DEFAULTS = {
    "telegram_bot_token": "",
    "miniapp_url": "https://alkawthar.info/tadilat-app.html",
    "supabase_url": "https://tyzrexkneoexmcegaxlc.supabase.co",
    "supabase_anon_key": "",
    "storage_bucket": "student-documents",
    "admin_chat_ids": [],
    "notify_on_new": False,
    "notify_poll_seconds": 60,
    "menu_button_text": "تعدیلات",
    # دکمهٔ مینیاپ در منوی چت؟ پیش‌فرض خیر — لینک فقط در «بیو» می‌ماند
    # (برای برگرداندن دکمه: true و بعد python bot.py --set-menu)
    "menu_button_webapp": False,
    "poll_timeout": 50,
    "request_timeout": 60,
}


def _deep_merge(base, extra):
    out = dict(base)
    for key, value in (extra or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def load_config():
    cfg = dict(DEFAULTS)
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as fh:
            cfg = _deep_merge(cfg, json.load(fh))
    env_map = {
        "TELEGRAM_BOT_TOKEN": "telegram_bot_token",
        "SUPABASE_URL": "supabase_url",
        "SUPABASE_ANON_KEY": "supabase_anon_key",
        "MINIAPP_URL": "miniapp_url",
        "STORAGE_BUCKET": "storage_bucket",
    }
    for env_key, path in env_map.items():
        value = os.environ.get(env_key)
        if value:
            cfg[path] = value
    return cfg


# ══════════════════════════════════════════════════════════════
# کلاینت تلگرام
# ══════════════════════════════════════════════════════════════
class TelegramError(RuntimeError):
    def __init__(self, message, network=False):
        super().__init__(message)
        self.network = network


class Telegram:
    def __init__(self, token, timeout=60):
        self.token = token
        self.timeout = timeout
        self.base = "https://api.telegram.org/bot" + token

    def call(self, method, params=None, timeout=None):
        """یک متد Bot API؛ با تلاش مجدد در خطاهای شبکه."""
        last = None
        for attempt in range(4):
            try:
                return self._call_once(method, params, timeout)
            except TelegramError as exc:
                if not exc.network:
                    raise
                last = exc
            if attempt < 3:
                time.sleep(1.2 * (2 ** attempt))
        raise last

    def _call_once(self, method, params=None, timeout=None):
        url = "%s/%s" % (self.base, method)
        data = json.dumps(params or {}, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            url, data=data, method="POST",
            headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout or self.timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:400]
            raise TelegramError("HTTP %s در %s: %s" % (exc.code, method, detail)) from None
        except Exception as exc:  # noqa: BLE001 — شامل SSL/TLS و DNS
            raise TelegramError("اتصال به تلگرام برقرار نشد: %s" % (exc,),
                                network=True) from None
        if not payload.get("ok"):
            raise TelegramError("%s → %s" % (method, payload.get("description")))
        return payload.get("result")

    def me(self):
        return self.call("getMe")

    def get_updates(self, offset=None, timeout=50):
        params = {"timeout": timeout,
                  "allowed_updates": ["message", "callback_query"]}
        if offset is not None:
            params["offset"] = offset
        return self.call("getUpdates", params, timeout=timeout + 20) or []

    def send_message(self, chat_id, text, reply_markup=None):
        params = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if reply_markup:
            params["reply_markup"] = reply_markup
        try:
            return self.call("sendMessage", params)
        except TelegramError as exc:
            # اگر HTML خراب بود، بدون parse_mode دوباره تلاش کن
            log("sendMessage با HTML ناموفق بود (%s) — تلاش دوباره متنی" % exc, "WARN")
            params.pop("parse_mode", None)
            return self.call("sendMessage", params)

    def answer_callback_query(self, callback_id, text=None):
        params = {"callback_query_id": callback_id}
        if text:
            params["text"] = text
        try:
            return self.call("answerCallbackQuery", params, timeout=20)
        except TelegramError as exc:
            log("answerCallbackQuery ناموفق: %s" % exc, "WARN")

    def set_my_commands(self, commands):
        return self.call("setMyCommands", {"commands": commands})

    def set_menu_button(self, text, url):
        """دکمهٔ منوی چت‌های خصوصی را به تلگرام وصل می‌کند."""
        return self.call("setChatMenuButton", {
            "menu_button": {
                "type": "web_app",
                "text": text,
                "web_app": {"url": url},
            }
        })

    def get_menu_button(self):
        return self.call("getChatMenuButton")

    # ── Webhook (حالت Supabase Edge Function) ──
    def set_webhook(self, url, secret=None, drop_pending=True):
        params = {
            "url": url,
            "allowed_updates": ["message", "callback_query"],
            "drop_pending_updates": bool(drop_pending),
            "max_connections": 40,
        }
        if secret:
            params["secret_token"] = secret
        return self.call("setWebhook", params)

    def delete_webhook(self, drop_pending=False):
        return self.call("deleteWebhook", {"drop_pending_updates": bool(drop_pending)})

    def webhook_info(self):
        return self.call("getWebhookInfo")

    # ── بیو و دکمهٔ منو ──
    def set_description(self, text):
        """توضیحی که پیش از /start در چت نشان داده می‌شود."""
        return self.call("setMyDescription",
                         {"description": text, "parse_mode": "HTML"})

    def set_short_description(self, text):
        """بیوی کوتاه در پروفایل ربات."""
        return self.call("setMyShortDescription",
                         {"short_description": text, "parse_mode": "HTML"})

    def reset_menu_button(self):
        """دکمهٔ منو را به حالت پیش‌فرض برمی‌گرداند (دکمهٔ مینیاپ حذف می‌شود)."""
        return self.call("setChatMenuButton",
                         {"menu_button": {"type": "default"}})

    def send_chat_action(self, chat_id, action="typing"):
        """نشان می‌دهد ربات مشغول است. اگر نشد، کار متوقف نمی‌شود."""
        try:
            return self.call("sendChatAction",
                             {"chat_id": chat_id, "action": action}, timeout=15)
        except TelegramError as exc:
            log("sendChatAction ناموفق: %s" % exc, "WARN")

    def get_file(self, file_id):
        """مسیر فایل روی سرور تلگرام را می‌گیرد."""
        return self.call("getFile", {"file_id": file_id}, timeout=30)

    def download_file(self, file_path):
        """محتوای فایل را از تلگرام دانلود می‌کند (بایت)."""
        url = "https://api.telegram.org/file/bot%s/%s" % (self.token, file_path)
        last = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=180) as resp:
                    return resp.read()
            except Exception as exc:  # noqa: BLE001
                last = exc
                if attempt < 2:
                    time.sleep(1.5 * (attempt + 1))
        raise TelegramError("دانلود از تلگرام ناموفق: %s" % last)


# ══════════════════════════════════════════════════════════════
# وضعیت (offset و شناسه‌های اطلاع‌داده‌شده)
# ══════════════════════════════════════════════════════════════
class State:
    def __init__(self, path):
        self.path = path
        self.data = {"offset": None, "notified": [], "chats": {}}
        self.load()

    def load(self):
        if not os.path.exists(self.path):
            return
        try:
            with open(self.path, "r", encoding="utf-8") as fh:
                loaded = json.load(fh)
            if isinstance(loaded, dict):
                self.data["offset"] = loaded.get("offset")
                self.data["notified"] = loaded.get("notified") or []
                self.data["chats"] = loaded.get("chats") or {}
        except Exception as exc:  # noqa: BLE001
            log("خواندن فایل وضعیت ناموفق (%r)" % (exc,), "WARN")

    def save(self):
        tmp = self.path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(self.data, fh, ensure_ascii=False, indent=1)
            os.replace(tmp, self.path)
        except Exception as exc:  # noqa: BLE001
            log("ذخیرهٔ فایل وضعیت ناموفق: %r" % (exc,), "WARN")


# ══════════════════════════════════════════════════════════════
# متن‌ها
# ══════════════════════════════════════════════════════════════
def txt_welcome(url):
    return (
        "سلام 👋\n"
        "برای ارسال <b>تعدیلات</b>، دکمهٔ زیر را بزنید.\n\n"
        "داخل تلگرام:\n"
        "۱) نام و شمارهٔ دانشجویی خود را وارد می‌کنید\n"
        "۲) فایل‌ها را انتخاب می‌کنید (عکس، PDF، Word یا ویس — چندتایی)\n"
        "۳) ارسال را می‌زنید\n\n"
        "تعدیلات شما خودکار به <b>نویسندهٔ مربوط به خودت</b> می‌رسد و "
        "در صفحهٔ «تعدیلات» او دیده می‌شود.\n\n"
        "<b>از واتساپ هم می‌شود:</b> فایل را در واتساپ بزن Share → Telegram "
        "و برای همین ربات بفرست؛ خودش به آخرین درخواستت وصل می‌شود.\n\n"
        "<i>اگر دکمه باز نشد، این نشانی را در مرورگر باز کنید:</i>\n"
        "<code>%s</code>" % html.escape(url)
    )


TXT_HELP = (
    "<b>راهنمای ربات</b>\n\n"
    "/start — باز کردن تلگرام ارسال تعدیلات\n"
    "/status — وضعیت ارسال‌های قبلی\n"
    "/help — همین راهنما\n\n"
    "می‌توانید فایل‌ها را همین‌جا هم بفرستید (مثلاً فوروارد از واتساپ)؛\n"
    "خودکار به آخرین درخواستت وصل می‌شود."
)

TXT_STATUS_EMPTY = "هنوز تعدیلاتی ارسال نکرده‌اید.\nبرای شروع /start را بزنید."

STATUS_FA = {
    "draft": "ناتمام (ارسال کامل نشده)",
    "new": "ارسال شد — در انتظار نویسنده",
    "in_progress": "در دست بررسی نویسنده",
    "completed": "انجام شد ✅",
    "rejected": "رد شد",
}


def menu_keyboard(url, text):
    return {
        "inline_keyboard": [[
            {"text": "📤 " + text, "web_app": {"url": url}}
        ]]
    }


# ── دکمه‌های ثابت منوی چت ──
BTN_STATUS = "📋 وضعیت من"
BTN_DUE = "⏰ تاریخ تحویل"
BTN_FILES = "📁 فایل‌های من"
BTN_NEW = "🆕 تعدیلات جدید"


def main_keyboard():
    """کیبورد ثابت پایین صفحه."""
    return {
        "keyboard": [
            [{"text": BTN_STATUS}, {"text": BTN_DUE}],
            [{"text": BTN_FILES}, {"text": BTN_NEW}],
        ],
        "resize_keyboard": True,
        "is_persistent": True,
    }


def confirm_keyboard():
    """بله / نه برای تأیید هویت."""
    return {
        "inline_keyboard": [[
            {"text": "✅ بله، من هستم", "callback_data": "me:yes"},
            {"text": "❌ نه، من نیستم", "callback_data": "me:no"},
        ]]
    }


def skip_keyboard():
    """رد کردن شمارهٔ دانشجویی."""
    return {
        "inline_keyboard": [[
            {"text": "⏭ رد کردن", "callback_data": "num:skip"},
        ]]
    }


TXT_INTRO = (
    "سلام 👋 خوش آمدی به ربات <b>تعدیلات — شرکة الکوثر</b>\n\n"
    "لطفاً <b>اسمت را بنویس</b> (نام، نام پدر، نام جد).\n"
    "مثال: <i>محمد فاضل عباس الطالی</i>"
)

TXT_HELP_CHAT = (
    "<b>راهنمای ربات</b>\n\n"
    "۱) اسمت را می‌نویسی\n"
    "۲) اگر لازم بود شمارهٔ دانشجویی را وارد می‌کنی\n"
    "۳) تأیید می‌کنی که خودت هستی\n"
    "۴) فایل‌های تعدیلات را می‌فرستی (از فایل‌ها، واتساپ یا هرجا)\n\n"
    "<b>دکمه‌های پایین:</b>\n"
    "📋 وضعیت من — وضعیت آخرین ارسال‌ها\n"
    "⏰ تاریخ تحویل — زمان اعلام‌شده\n"
    "📁 فایل‌های من — فایل‌های ارسالی\n"
    "🆕 تعدیلات جدید — ارسال تازه\n\n"
    "/reset — پاک کردن و شروع از اول"
)

STATUS_CHAT = {
    "draft": "ناتمام",
    "new": "دریافت شد ⏳",
    "started": "شروع شد 🚀",
    "in_progress": "در حال انجام ✍️",
    "ready": "آماده تحویل 🎁",
    "completed": "تحویل شد ✅",
    "rejected": "رد شد ❌",
}


def fa_date(iso):
    """تاریخ خوانا از ISO (ساده و بدون وابستگی)."""
    if not iso:
        return "—"
    try:
        txt = str(iso).replace("T", " ")[:16]
        d, t = txt.split(" ")
        y, m, dd = d.split("-")
        return "%s/%s/%s — ساعت %s" % (dd, m, y, t)
    except Exception:  # noqa: BLE001
        return str(iso)[:16]


KIND_FA = {
    "photo": "عکس",
    "document": "فایل/PDF",
    "voice": "ویس",
    "audio": "صوت",
    "video": "ویدیو",
}


def extract_media(message):
    """فایل پیام تلگرام را برمی‌گرداند: dict یا None"""
    if message.get("photo"):
        photo = max(message["photo"],
                    key=lambda p: p.get("file_size") or p.get("width") or 0)
        return {"kind": "photo", "file_id": photo.get("file_id"),
                "file_name": "photo_%s.jpg" % (photo.get("file_unique_id") or "1"),
                "mime_type": "image/jpeg", "file_size": photo.get("file_size")}
    doc = message.get("document")
    if doc:
        return {"kind": "document", "file_id": doc.get("file_id"),
                "file_name": doc.get("file_name") or "document.pdf",
                "mime_type": doc.get("mime_type") or "application/octet-stream",
                "file_size": doc.get("file_size")}
    voice = message.get("voice")
    if voice:
        return {"kind": "voice", "file_id": voice.get("file_id"),
                "file_name": "voice_%s.ogg" % (voice.get("file_unique_id") or "1"),
                "mime_type": voice.get("mime_type") or "audio/ogg",
                "file_size": voice.get("file_size")}
    audio = message.get("audio")
    if audio:
        return {"kind": "audio", "file_id": audio.get("file_id"),
                "file_name": audio.get("file_name") or "audio.mp3",
                "mime_type": audio.get("mime_type") or "audio/mpeg",
                "file_size": audio.get("file_size")}
    video = message.get("video")
    if video:
        return {"kind": "video", "file_id": video.get("file_id"),
                "file_name": video.get("file_name") or "video.mp4",
                "mime_type": video.get("mime_type") or "video/mp4",
                "file_size": video.get("file_size")}
    return None


# ══════════════════════════════════════════════════════════════
# ربات
# ══════════════════════════════════════════════════════════════
class TadilatBot:
    def __init__(self, cfg, tg=None, sb=None, state=None):
        self.cfg = cfg
        self.url = (cfg.get("miniapp_url") or "").strip()
        self.menu_text = cfg.get("menu_button_text") or "تعدیلات"
        self.tg = tg or Telegram(cfg["telegram_bot_token"],
                                 timeout=int(cfg.get("request_timeout") or 60))
        self.sb = sb or Supabase(
            cfg.get("supabase_url") or "",
            cfg.get("supabase_anon_key") or "",
            bucket=cfg.get("storage_bucket") or "student-documents",
            timeout=int(cfg.get("request_timeout") or 60))
        self.state = state or State(STATE_FILE)
        self.router = Router(self.sb, logger=log)
        self.prefix = (cfg.get("storage_prefix") or "tadilat").strip("/")
        self.max_bytes = int(cfg.get("max_file_mb") or 20) * 1024 * 1024

    # ── کمکی ────────────────────────────────────────────────
    def _keyboard(self):
        return menu_keyboard(self.url, self.menu_text) if self.url else None

    def _send_app(self, chat_id, text):
        try:
            return self.tg.send_message(chat_id, text, self._keyboard())
        except TelegramError as exc:
            log("ارسال پیام ناموفق: %s" % exc, "ERROR")

    def _notify_admins(self, text):
        for chat in self.cfg.get("admin_chat_ids") or []:
            try:
                self.tg.send_message(chat, text)
            except Exception as exc:  # noqa: BLE001
                log("اطلاع به ادمین %s ناموفق: %s" % (chat, exc), "WARN")

    # ── ثبت دکمهٔ منو ───────────────────────────────────────
    def register_menu(self):
        """دکمهٔ منوی چت.

        طبق تنظیم `menu_button_webapp`:
          • false (پیش‌فرض) → دکمه برداشته می‌شود و لینک مینیاپ
            فقط در «بیو» ربات می‌ماند (setting با --set-bio)
          • true → دکمهٔ مینیاپ در منوی چت هم می‌آید
        """
        if not self.cfg.get("menu_button_webapp"):
            try:
                self.tg.reset_menu_button()
                log("دکمهٔ منو پیش‌فرض است (لینک مینیاپ در بیو ربات)")
            except TelegramError as exc:
                log("بازگرداندن دکمهٔ منو ناموفق: %s" % exc, "WARN")
            return False

        if not self.url:
            log("miniapp_url تنظیم نشده — دکمهٔ منو ثبت نمی‌شود", "WARN")
            return False
        if not self.url.lower().startswith("https://"):
            log("آدرس تلگرام باید HTTPS باشد (تلگرام آدرس غیرامن را رد می‌کند): %s"
                % self.url, "ERROR")
            return False
        try:
            self.tg.set_menu_button(self.menu_text, self.url)
            log("دکمهٔ منو ثبت شد → %s" % self.url)
            return True
        except TelegramError as exc:
            log("ثبت دکمهٔ منو ناموفق: %s" % exc, "ERROR")
            return False

    # ── مسیریابی و دریافت فایل فورواردشده ───────────────────
    def _latest_request(self, chat_id):
        try:
            rows = self.sb.select(
                "tadilat_requests",
                "select=*&telegram_user_id=eq.%d&order=created_at.desc&limit=1" % chat_id)
            return rows[0] if rows else None
        except SupabaseError as exc:
            log("خواندن آخرین درخواست ناموفق: %s" % exc, "WARN")
            return None

    def _create_request(self, chat_id, message, detection, source="telegram_bot"):
        """درخواست تازه برای دانشجویی که با نام تلگرامش تطبیق داده شده."""
        frm = message.get("from") or {}
        writer = detection.get("writer")
        row = {
            "source": source,
            "telegram_user_id": chat_id,
            "telegram_username": frm.get("username"),
            "telegram_name": " ".join(
                x for x in [frm.get("first_name"), frm.get("last_name")] if x).strip() or None,
            "student_id": detection.get("student_id"),
            "student_name": detection.get("student_name") or "—",
            "student_no": detection.get("student_no"),
            "name_source": "text",
            "assigned_agent_id": writer["agent_id"] if writer else None,
            "assigned_agent_name": writer["agent_name"] if writer else None,
            "routed_at": datetime.now(timezone.utc).isoformat() if writer else None,
            "routed_by": "auto" if writer else None,
            "routed_note": ("سفارش %s" % writer["order_id"]) if writer else None,
            "status": "draft",
        }
        created = self.sb.insert("tadilat_requests", [row])
        return created[0] if created else None

    def _storage_path(self, chat_id, request_id, filename):
        safe = safe_storage_key(filename, "file")
        return "%s/%s/%s/%s_%s" % (self.prefix, chat_id, request_id,
                                   uuid.uuid4().hex[:6], safe)

    def handle_media(self, message):
        """فایل فورواردشده (مثلاً از واتساپ) را به درخواست دانشجو می‌چسباند."""
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        media = extract_media(message)
        if chat_id is None or not media:
            return

        frm = message.get("from") or {}
        user_id = frm.get("id") or chat_id
        ch = self._chat_state(user_id)

        req = self._latest_request(chat_id)
        if not req:
            # از اطلاعاتی که در گفتگو گرفته شده استفاده کن
            detection = {
                "student_id": ch.get("profile_id"),
                "student_name": ch.get("name") or "—",
                "student_no": ch.get("student_no"),
            }
            if not detection.get("student_id"):
                # تلاش آخر: با نام پروفایل تلگرام
                guess = " ".join(x for x in [frm.get("first_name"),
                                             frm.get("last_name")] if x)
                if guess:
                    d2 = self.router.detect(guess) or {}
                    if d2.get("student_id"):
                        detection = d2
            req = self._create_request(chat_id, message, detection)
            if not req:
                self._send_app(chat_id, "❌ ساخت درخواست ناموفق بود؛ دوباره تلاش کنید.")
                return
            log("درخواست تازه از فایل ساخته شد: %s (دانشجو %s)"
                % (req.get("id"), detection.get("student_id")))
        elif ch.get("profile_id") and not req.get("student_id"):
            # درخواست قبلی بدون پروفایل بود → حالا وصلش کن
            try:
                self.sb.update("tadilat_requests",
                               "id=eq." + urllib.parse.quote(str(req["id"])),
                               {"student_id": ch["profile_id"],
                                "student_name": ch.get("name") or "—",
                                "student_no": ch.get("student_no")})
                req["student_id"] = ch["profile_id"]
            except SupabaseError as exc:
                log("وصل کردن پروفایل به درخواست ناموفق: %s" % exc, "WARN")

        request_id = req.get("id")

        # ۱) دانلود از تلگرام
        self.tg.send_chat_action(chat_id, "upload_document")
        try:
            info = self.tg.get_file(media["file_id"])
            file_path = info.get("file_path")
            if not file_path:
                raise RuntimeError("تلگرام مسیر فایل را برنگرداند")
            size = info.get("file_size") or media.get("file_size") or 0
            if size and size > self.max_bytes:
                self._send_app(
                    chat_id,
                    "⚠️ حجم این فایل %s مگابایت است؛ تلگرام اجازهٔ دانلود بیش از "
                    "%s مگابایت را به ربات نمی‌دهد.\n"
                    "لطفاً همین فایل را در <b>تلگرام</b> بفرست (سقف ۵۰ مگابایت)."
                    % (round(size / 1048576, 1), self.cfg.get("max_file_mb")))
                return
            data = self.tg.download_file(file_path)
        except Exception as exc:  # noqa: BLE001
            log("دانلود فایل از تلگرام ناموفق: %r" % (exc,), "ERROR")
            self._send_app(chat_id, "❌ دانلود فایل ناموفق بود؛ دوباره بفرستید.")
            return

        # ۲) آپلود در Supabase Storage
        path = self._storage_path(chat_id, request_id, media["file_name"])
        try:
            self.sb.upload(path, data, media.get("mime_type"))
        except SupabaseError as exc:
            log("آپلود در Storage ناموفق: %s" % exc, "ERROR")
            self._send_app(chat_id, "❌ ذخیرهٔ فایل ناموفق بود: %s"
                           % html.escape(str(exc)))
            return

        # ۳) ثبت ردیف فایل
        kind_db = "photo" if media["kind"] == "photo" else (
            "audio" if media["kind"] in ("audio", "voice") else "document")
        try:
            self.sb.insert("tadilat_files", [{
                "request_id": request_id,
                "kind": kind_db,
                "file_name": media["file_name"],
                "storage_path": path,
                "mime_type": media.get("mime_type"),
                "file_size": len(data),
                "duration": None,
                "caption": message.get("caption"),
                "telegram_file_id": media["file_id"],
            }])
        except SupabaseError as exc:
            log("ثبت ردیف فایل ناموفق: %s" % exc, "ERROR")
            self._send_app(chat_id, "❌ ثبت فایل ناموفق بود: %s" % html.escape(str(exc)))
            return

        # ۴) شمارنده + اگر درخواست بسته بود، دوباره بازش کن
        files_count = int(req.get("files_count") or 0) + 1
        patch = {"files_count": files_count}
        if req.get("status") in ("completed", "ready", "rejected"):
            patch["status"] = "new"
        try:
            self.sb.update("tadilat_requests",
                           "id=eq." + urllib.parse.quote(request_id), patch)
        except SupabaseError as exc:
            log("به‌روزرسانی درخواست ناموفق: %s" % exc, "WARN")

        writer_name = req.get("assigned_agent_name")
        if not writer_name and req.get("student_id"):
            writer = self.router.resolve_writer(req.get("student_id"),
                                                req.get("student_name"))
            if writer:
                writer_name = writer["agent_name"]
                try:
                    self.sb.update("tadilat_requests",
                                   "id=eq." + urllib.parse.quote(request_id), {
                                       "assigned_agent_id": writer["agent_id"],
                                       "assigned_agent_name": writer["agent_name"],
                                       "routed_at": datetime.now(timezone.utc).isoformat(),
                                       "routed_by": "auto",
                                       "routed_note": "سفارش %s" % writer["order_id"],
                                   })
                except SupabaseError as exc:
                    log("مسیریابی درخواست ناموفق: %s" % exc, "WARN")

        label = KIND_FA.get(media["kind"], media["kind"])
        self._send(
            chat_id,
            "✅ <b>تعدیلات شما ارسال شد</b>\n\n"
            "📎 %s دریافت شد (جمعاً %s فایل)\n"
            "🔖 کد پیگیری: <b>%s</b>\n%s\n\n"
            "از دکمه‌های پایین می‌توانی <b>وضعیت</b> و <b>تاریخ تحویل</b> "
            "را ببینی."
            % (label, files_count,
               html.escape(str(req.get("code") or request_id)),
               ("✍️ نویسندهٔ تو: <b>%s</b>" % html.escape(writer_name)) if writer_name
               else "⏳ در انتظار تعیین نویسنده"),
            main_keyboard())
        log("فایل به %s اضافه شد (%s)" % (request_id, kind_db))

    # ══════════════════════════════════════════════════════════
    # گفتگوی چتی: نام → (شماره) → تأیید → ارسال فایل
    # ══════════════════════════════════════════════════════════
    def _chat_state(self, user_id):
        """وضعیت گفتگوی هر کاربر."""
        chats = self.state.data.setdefault("chats", {})
        return chats.setdefault(str(user_id), {})

    def _chat_set(self, user_id, **kw):
        st = self._chat_state(user_id)
        st.update(kw)
        self.state.save()
        return st

    @staticmethod
    def _is_ready(st):
        """شناسایی تمام شده؟ (دانشجوی تازه پروفایل ندارد ولی آماده است)"""
        return (st or {}).get("stage") == "ready"

    def _chat_clear(self, user_id):
        self.state.data.setdefault("chats", {})[str(user_id)] = {}
        self.state.save()

    def _send(self, chat_id, text, keyboard=None):
        return self.tg.send_message(chat_id, text, reply_markup=keyboard)

    # ── شروع ──
    def _start_intro(self, chat_id, user_id):
        self._chat_set(user_id, stage="name", name=None, student_no=None,
                       candidate=None, profile_id=None)
        self._send(chat_id, TXT_INTRO)

    # ── قدم ۱: نام ──
    def _on_name(self, chat_id, user_id, text):
        if len(text) < 3:
            self._send(chat_id, "اسمت را کامل‌تر بنویس 🙂")
            return
        self.tg.send_chat_action(chat_id, "typing")
        det = {}
        try:
            det = self.router.detect(text) or {}
        except Exception as exc:  # noqa: BLE001
            log("تطبیق نام ناموفق: %r" % (exc,), "WARN")

        if det.get("student_id"):
            name = det.get("name") or text
            self._chat_set(user_id, stage="confirm", name=text,
                           candidate={"id": det.get("student_id"), "name": name,
                                      "student_no": det.get("student_no")})
            self._send(chat_id, "🔎 آیا تو <b>%s</b> هستی؟" % html.escape(name),
                       confirm_keyboard())
            return

        # پیدا نشد → شمارهٔ دانشجویی (اختیاری)
        self._chat_set(user_id, stage="number", name=text, candidate=None)
        self._send(chat_id,
                   "اسمت را در فهرست پیدا نکردم 🤔\n\n"
                   "اگر <b>شمارهٔ دانشجویی</b> داری بنویس تا دقیق‌تر پیدایت کنم.\n"
                   "اگر هم نداری، «رد کردن» را بزن.", skip_keyboard())

    # ── قدم ۲: شمارهٔ دانشجویی ──
    def _on_number(self, chat_id, user_id, text):
        st = self._chat_state(user_id)
        name = st.get("name") or ""
        det = {}
        try:
            det = self.router.detect(("%s %s" % (name, text)).strip()) or {}
        except Exception as exc:  # noqa: BLE001
            log("تطبیق شماره ناموفق: %r" % (exc,), "WARN")

        if det.get("student_id"):
            nm = det.get("name") or name
            self._chat_set(user_id, stage="confirm", student_no=text,
                           candidate={"id": det.get("student_id"), "name": nm,
                                      "student_no": det.get("student_no") or text})
            self._send(chat_id, "🔎 آیا تو <b>%s</b> هستی؟" % html.escape(nm),
                       confirm_keyboard())
            return

        # باز هم پیدا نشد → به‌عنوان دانشجوی تازه ادامه بده
        self._link(user_id, {"id": None, "name": name, "student_no": text})
        self._send(chat_id,
                   "پروفایلی با این مشخصات پیدا نکردم، ولی مشکلی نیست — "
                   "کارشناسان خودشان وصلش می‌کنند.\n\n"
                   "📤 حالا هر تعدیلاتی داری بفرست "
                   "(عکس، PDF، Word یا ویس — از فایل‌ها یا واتساپ).",
                   main_keyboard())

    # ── اتصال نهایی ──
    def _link(self, user_id, cand):
        self._chat_set(user_id, stage="ready",
                       profile_id=cand.get("id"),
                       name=cand.get("name") or "",
                       student_no=cand.get("student_no"),
                       candidate=None)

    # ── ورودی‌های متنی ──
    def handle_message(self, message):
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if chat_id is None:
            return
        frm = message.get("from") or {}
        user_id = frm.get("id") or chat_id
        text = (message.get("text") or "").strip()
        st = self._chat_state(user_id)

        # فایل (شامل فوروارد از واتساپ)
        if extract_media(message):
            if not self._is_ready(st):
                # هنوز معرفی نشده → اول شناسایی
                self._send(chat_id,
                           "📥 قبل از فرستادن فایل، یک‌بار خودت را معرفی کن:\n\n"
                           + TXT_INTRO)
                self._chat_set(user_id, stage="name")
                return
            self.handle_media(message)
            return

        # دستورها
        if text.startswith("/"):
            cmd = text.split()[0].split("@")[0].lower()
            if cmd in ("/start", "/app", "/new"):
                if self._is_ready(st):
                    self._chat_set(user_id, stage="ready")
                    self._send(chat_id,
                               "خوش آمدی دوباره 👋\n📤 هر فایلی بفرستی خودکار "
                               "به تعدیلاتت وصل می‌شود.",
                               main_keyboard())
                else:
                    self._start_intro(chat_id, user_id)
                return
            if cmd == "/help":
                self._send(chat_id, TXT_HELP_CHAT, main_keyboard())
                return
            if cmd == "/status":
                self.status(chat_id, user_id)
                return
            if cmd == "/reset":
                self._chat_clear(user_id)
                self._start_intro(chat_id, user_id)
                return
            self._send(chat_id, "دستور ناشناخته. /help را بزنید.")
            return

        # دکمه‌های منو
        if text == BTN_STATUS:
            self.status(chat_id, user_id)
            return
        if text == BTN_DUE:
            self.due_info(chat_id, user_id)
            return
        if text == BTN_FILES:
            self.files_info(chat_id, user_id)
            return
        if text == BTN_NEW:
            self._chat_set(user_id, stage="ready")
            self._send(chat_id,
                       "📤 بفرست! هر فایلی — عکس، PDF، Word یا ویس.\n"
                       "از واتساپ هم می‌شود: Share → Telegram.",
                       main_keyboard())
            return

        # جریان شناسایی
        if not self._is_ready(st):
            stage = st.get("stage") or "name"
            if stage in ("name", "ready"):
                self._on_name(chat_id, user_id, text)
                return
            if stage == "number":
                self._on_number(chat_id, user_id, text)
                return
            if stage == "confirm":
                self._send(chat_id,
                           "لطفاً از دکمه‌های بالا استفاده کن: ✅ بله یا ❌ نه")
                return

        # وصل شده و متن فرستاده
        self._send(chat_id,
                   "📎 هر فایلی بفرستی خودکار به تعدیلاتت وصل می‌شود.\n"
                   "از دکمه‌های پایین وضعیتت را ببین.",
                   main_keyboard())

    # ── دکمه‌های شیشه‌ای ──
    def handle_callback(self, query):
        data = (query.get("data") or "")
        self.tg.answer_callback_query(query.get("id"))
        chat = (query.get("message") or {}).get("chat") or {}
        chat_id = chat.get("id")
        frm = query.get("from") or {}
        user_id = frm.get("id") or chat_id
        if chat_id is None:
            return

        if data == "status":
            self.status(chat_id, user_id)
            return

        if data == "me:yes":
            cand = (self._chat_state(user_id).get("candidate") or {})
            self._link(user_id, cand)
            self._send(chat_id,
                       "✅ ثبت شد، <b>%s</b> عزیز!\n\n"
                       "📤 حالا هر تعدیلاتی داری بفرست — عکس، PDF، Word یا ویس.\n"
                       "می‌توانی از <b>واتساپ</b> هم Share → Telegram کنی."
                       % html.escape(cand.get("name") or ""),
                       main_keyboard())
            return

        if data == "me:no":
            self._chat_set(user_id, stage="name", candidate=None, profile_id=None)
            self._send(chat_id,
                       "باشه 🙂 اسمت را دقیق‌تر بنویس "
                       "(نام، نام پدر، نام جد) تا درست پیدایت کنم.")
            return

        if data == "num:skip":
            st = self._chat_state(user_id)
            self._link(user_id, {"id": None, "name": st.get("name") or "",
                                 "student_no": None})
            self._send(chat_id,
                       "بسیار خوب 👍 کارشناسان پروفایلت را وصل می‌کنند.\n\n"
                       "📤 حالا تعدیلاتت را بفرست.", main_keyboard())
            return

    # ── نمایش وضعیت ──
    def _my_requests(self, user_id, limit=5):
        st = self._chat_state(user_id)
        rows = []
        if st.get("profile_id"):
            try:
                rows = self.sb.select(
                    "tadilat_requests",
                    "select=*&student_id=eq.%s&order=created_at.desc&limit=%d"
                    % (urllib.parse.quote(str(st["profile_id"])), limit))
            except SupabaseError:
                rows = []
        if not rows:
            try:
                rows = self.sb.select(
                    "tadilat_requests",
                    "select=*&telegram_user_id=eq.%s&order=created_at.desc&limit=%d"
                    % (urllib.parse.quote(str(user_id)), limit))
            except SupabaseError:
                rows = []
        return rows or []

    def status(self, chat_id, user_id=None):
        uid = user_id or chat_id
        rows = self._my_requests(uid)
        if not rows:
            self._send(chat_id,
                       "هنوز تعدیلاتی ارسال نکرده‌ای.\n"
                       "هر فایلی بفرستی، همین‌جا وضعیتش را می‌بینی.",
                       main_keyboard())
            return

        out = ["📋 <b>وضعیت ارسال‌های تو</b>", ""]
        for r in rows:
            code = r.get("code") or "—"
            stt = STATUS_CHAT.get(r.get("status"), r.get("status") or "—")
            out.append("🔖 کد <b>%s</b>" % html.escape(str(code)))
            out.append("   %s" % stt)
            out.append("   📎 %s فایل · %s" % (r.get("files_count") or 0,
                                              fa_date(r.get("created_at"))))
            if r.get("assigned_agent_name"):
                out.append("   ✍️ %s" % html.escape(r["assigned_agent_name"]))
            if r.get("due_at"):
                out.append("   ⏰ تحویل: %s" % fa_date(r.get("due_at")))
            out.append("")
        self._send(chat_id, "\n".join(out), main_keyboard())

    def due_info(self, chat_id, user_id=None):
        rows = self._my_requests(user_id or chat_id)
        if not rows:
            self._send(chat_id, "هنوز ارسالی نداری.", main_keyboard())
            return
        r = rows[0]
        if r.get("due_at"):
            self._send(chat_id,
                       "⏰ زمان تحویل اعلام‌شده:\n<b>%s</b>\n\n"
                       "🔖 کد پیگیری: <b>%s</b>"
                       % (fa_date(r.get("due_at")),
                          html.escape(str(r.get("code") or "—"))),
                       main_keyboard())
        else:
            self._send(chat_id,
                       "⏰ هنوز زمان تحویلی برای این تعدیلات تعیین نشده.\n"
                       "به‌محض تعیین، همین‌جا می‌بینی.",
                       main_keyboard())

    def files_info(self, chat_id, user_id=None):
        rows = self._my_requests(user_id or chat_id, limit=1)
        if not rows:
            self._send(chat_id, "هنوز فایلی نفرستاده‌ای.", main_keyboard())
            return
        rid = rows[0].get("id")
        try:
            files = self.sb.select(
                "tadilat_files",
                "select=kind,file_name,file_size&request_id=eq.%s&order=created_at.asc"
                % urllib.parse.quote(str(rid)))
        except SupabaseError:
            files = []
        if not files:
            self._send(chat_id, "برای آخرین ارسال، فایلی ثبت نشده.", main_keyboard())
            return
        out = ["📁 <b>فایل‌های آخرین ارسال</b>",
               "🔖 کد <b>%s</b>" % html.escape(str(rows[0].get("code") or "—")), ""]
        for f in files:
            out.append("• %s %s <i>(%s)</i>"
                       % (KIND_FA.get(f.get("kind"), "📄"),
                          html.escape(f.get("file_name") or "فایل"),
                          round((f.get("file_size") or 0) / 1024)))
        self._send(chat_id, "\n".join(out), main_keyboard())


    # ── اطلاع‌رسانی اختیاری به مدیرها ───────────────────────
    def check_new_submissions(self):
        """درخواست‌های تازه را یک‌بار به مدیرها اطلاع می‌دهد."""
        if not (self.cfg.get("notify_on_new") and self.cfg.get("admin_chat_ids")):
            return
        try:
            rows = self.sb.select(
                "tadilat_requests",
                "select=id,student_name,files_count,created_at,source,status"
                "&status=eq.new&order=created_at.desc&limit=20")
        except SupabaseError as exc:
            log("بررسی درخواست‌های تازه ناموفق: %s" % exc, "WARN")
            return

        seen = set(self.state.data.get("notified") or [])
        fresh = [r for r in rows if r.get("id") and r["id"] not in seen]
        # قدیمی‌ترین تازه‌ها اول
        for row in reversed(fresh):
            label = "تلگرام" if row.get("source") != "telegram_bot" else "ربات"
            self._notify_admins(
                "🔔 <b>تعدیلات جدید</b> (%s)\n👤 %s\n📁 %d فایل\n🔖 <code>%s</code>"
                % (label,
                   html.escape(row.get("student_name") or "—"),
                   row.get("files_count") or 0,
                   html.escape(str(row.get("id")))))
            seen.add(row["id"])

        if fresh:
            # شناسه‌های تازه به بالای فهرست اضافه می‌شوند و فقط ۲۰۰ مورد نگه داشته می‌شود
            merged = []
            for rid in [r["id"] for r in rows if r.get("id")] + list(seen):
                if rid not in merged:
                    merged.append(rid)
            self.state.data["notified"] = merged[:200]
            self.state.save()
            log("%d درخواست تازه به مدیرها اطلاع داده شد" % len(fresh))

    # ── حلقهٔ اصلی ──────────────────────────────────────────
    def run(self):
        me = self.tg.me()
        log("ربات فعال شد: @%s (id=%s)" % (me.get("username"), me.get("id")))
        if not self.url:
            log("miniapp_url خالی است — ربات فقط پیام متنی می‌فرستد", "WARN")
        self.register_menu()
        try:
            self.tg.set_my_commands([
                {"command": "start", "description": "شروع / ارسال تعدیلات تازه"},
            {"command": "reset", "description": "پاک کردن و شروع از اول"},
                {"command": "status", "description": "وضعیت ارسال‌های من"},
                {"command": "help", "description": "راهنما"},
            ])
        except TelegramError as exc:
            log("setMyCommands ناموفق: %s" % exc, "WARN")

        notify = bool(self.cfg.get("notify_on_new") and self.cfg.get("admin_chat_ids"))
        notify_every = max(15, int(self.cfg.get("notify_poll_seconds") or 60))
        last_notify = 0.0
        if notify:
            log("اطلاع‌رسانی به مدیرها فعال است (هر %d ثانیه)" % notify_every)
            try:
                self.check_new_submissions()
            except Exception:  # noqa: BLE001
                log("بررسی اولیهٔ درخواست‌ها ناموفق:\n%s" % traceback.format_exc(), "WARN")

        offset = self.state.data.get("offset")
        # ── مهلت اجرا (برای GitHub Actions که هر بار محدود اجرا می‌شود) ──
        max_seconds = int(self.cfg.get("max_run_seconds") or 0)
        started_at = time.time()
        if max_seconds:
            log("حالت زمان‌دار: %d ثانیه (%.1f ساعت) — بعد از آن تمیز خارج می‌شود"
                % (max_seconds, max_seconds / 3600.0))
        while True:
            if max_seconds and (time.time() - started_at) >= max_seconds:
                log("مهلت اجرا تمام شد — خروج تمیز (offset=%s)" % offset)
                return
            try:
                updates = self.tg.get_updates(offset, int(self.cfg.get("poll_timeout") or 50))
                for update in updates:
                    offset = update["update_id"] + 1
                    self.state.data["offset"] = offset
                    self.state.save()
                    try:
                        if update.get("message"):
                            self.handle_message(update["message"])
                        elif update.get("callback_query"):
                            self.handle_callback(update["callback_query"])
                    except Exception:  # noqa: BLE001
                        log("خطا در پردازش به‌روزرسانی:\n%s" % traceback.format_exc(), "ERROR")

                if notify and (time.time() - last_notify) >= notify_every:
                    last_notify = time.time()
                    try:
                        self.check_new_submissions()
                    except Exception:  # noqa: BLE001
                        log("بررسی درخواست‌های تازه ناموفق:\n%s"
                            % traceback.format_exc(), "WARN")

            except TelegramError as exc:
                msg = str(exc)
                if "409" in msg or "terminated by other" in msg:
                    log("تعارض: نسخهٔ دیگری از ربات در حال اجراست — ۱۵ ثانیه صبر", "ERROR")
                    time.sleep(15)
                else:
                    log("خطای تلگرام: %s — ۵ ثانیه صبر" % msg, "WARN")
                    time.sleep(5)
            except KeyboardInterrupt:
                log("خروج به‌درخواست کاربر")
                return
            except Exception:  # noqa: BLE001
                log("خطای حلقهٔ اصلی:\n%s" % traceback.format_exc(), "ERROR")
                time.sleep(5)

    # ── بررسی سلامت ─────────────────────────────────────────
    def check(self):
        ok = True
        print("\n=== بررسی سلامت پوستهٔ ربات تعدیلات ===\n")

        token = self.cfg.get("telegram_bot_token") or ""
        if not token or ":" not in token:
            print("✗ توکن ربات تنظیم نشده → config.json → telegram_bot_token")
            ok = False
        else:
            try:
                me = self.tg.me()
                print("✓ توکن تلگرام معتبر است: @%s" % me.get("username"))
                try:
                    r = self.tg.get_menu_button() or {}
                    # getChatMenuButton خودِ آبجکت دکمه را برمی‌گرداند
                    # (نه داخل کلید menu_button) — هر دو شکل پشتیبانی می‌شود
                    if isinstance(r, dict) and r.get("type"):
                        mb = r
                    elif isinstance(r, dict):
                        mb = r.get("menu_button")
                    else:
                        mb = None
                    if mb and mb.get("type") == "web_app":
                        cur = (mb.get("web_app") or {}).get("url")
                        if cur == self.url:
                            print("✓ دکمهٔ منو روی تلگرام ثبت شده → %s" % cur)
                        else:
                            print("⚠ دکمهٔ منو روی آدرس دیگری است → %s" % cur)
                            print("  برای اصلاح: python bot.py --set-menu")
                    else:
                        print("⚠ دکمهٔ منو هنوز روی تلگرام نیست "
                              "(با --set-menu ثبت می‌شود)")
                        print("  نکته: خود تلگرام این مقدار را تا حدود یک دقیقه کش می‌کند؛"
                              " اگر تازه ثبت کرده‌اید، چند لحظه بعد دوباره بررسی کنید.")
                except TelegramError as exc:
                    print("⚠ خواندن دکمهٔ منو ناموفق: %s" % exc)
            except Exception as exc:  # noqa: BLE001
                if getattr(exc, "network", False):
                    print("⚠ به تلگرام وصل نشدم (مشکل شبکه، نه توکن): %s" % exc)
                    print("  اگر اینترنت/فیلترشکن ناپایدار است، دوباره اجرا کنید.")
                else:
                    print("✗ توکن تلگرام بی‌اعتبار است: %s" % exc)
                    ok = False

        if not self.url:
            print("✗ miniapp_url تنظیم نشده — بدون آن تلگرام باز نمی‌شود")
            ok = False
        elif not self.url.lower().startswith("https://"):
            print("✗ miniapp_url باید HTTPS باشد (تلگرام آدرس غیرامن را رد می‌کند): %s"
                  % self.url)
            ok = False
        else:
            try:
                req = urllib.request.Request(self.url, method="GET",
                                             headers={"User-Agent": "TadilatBot/1.0"})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    body = resp.read(4000).decode("utf-8", "replace")
                if "tadilat-app" in body or 'id="app"' in body:
                    print("✓ آدرس تلگرام در دسترس است (%s)" % self.url)
                else:
                    print("⚠ آدرس تلگرام پاسخ داد ولی صفحهٔ مورد انتظار نیست (%s)" % self.url)
                    ok = False
            except Exception as exc:  # noqa: BLE001
                print("✗ آدرس تلگرام در دسترس نیست: %s → %s" % (self.url, exc))
                ok = False

        try:
            rows = self.sb.select("profiles", "select=id&limit=1")
            print("✓ اتصال Supabase برقرار است (نمونهٔ profiles: %d ردیف)" % len(rows))
        except Exception as exc:  # noqa: BLE001
            print("✗ اتصال Supabase ناموفق: %s" % exc)
            ok = False

        for table in ("tadilat_requests", "tadilat_files"):
            try:
                if self.sb.table_exists(table):
                    print("✓ جدول %s موجود است" % table)
                else:
                    print("✗ جدول %s ساخته نشده → فایل "
                          "supabase/tadilat_telegram_migration.sql را در SQL Editor اجرا کنید"
                          % table)
                    ok = False
            except Exception as exc:  # noqa: BLE001
                print("✗ بررسی جدول %s ناموفق: %s" % (table, exc))
                ok = False

        probe = "tadilat/__healthcheck__/%s.txt" % uuid.uuid4().hex[:8]
        try:
            self.sb.upload(probe, b"tadilat shell healthcheck", "text/plain")
            self.sb.delete_object(probe)
            print("✓ آپلود در Storage کار می‌کند (bucket=%s)" % self.sb.bucket)
        except Exception as exc:  # noqa: BLE001
            print("✗ Storage ناموفق: %s" % exc)
            ok = False

        # ── مسیریابی دانشجو → نویسنده ──
        try:
            rows = self.sb.select("profiles", "select=id,name,role&limit=1000")
            agents_n = sum(1 for r in rows if r.get("role") == "agent")
            orders = self.sb.select(
                "orders", "select=id,student_name,assigned_agent_id&limit=1000")
            print("✓ نویسنده‌های ثبت‌شده: %d | سفارش‌های دارای نویسنده: %d"
                  % (agents_n, sum(1 for o in orders if o.get("assigned_agent_id"))))
        except Exception as exc:  # noqa: BLE001
            print("⚠ بررسی مسیریابی ناموفق: %s" % exc)

        print("\n=== نتیجه: %s ===\n"
              % ("همه‌چیز آماده است ✅" if ok else "نیاز به رفع ایراد دارد ❌"))
        return ok

    # ── گزارش مسیریابی روی دادهٔ واقعی ─────────────────────
    def report_routes(self):
        print("\n=== گزارش مسیریابی: دانشجو → نویسنده ===\n")
        self.router._ensure()
        print("دانشجو: %d | سفارش: %d | نویسنده: %d\n"
              % (len(self.router._students), len(self.router._orders),
                 len(self.router._agents)))

        rows = self.sb.select(
            "orders",
            "select=id,student_name,student_id,assigned_agent_id,status,created_at&limit=500")
        routed = failed = 0
        for o in rows:
            raw = o.get("student_name") or ""
            if not o.get("assigned_agent_id"):
                continue
            key = raw.strip()
            if not key or key in ("نامشخص",) or len(key) < 4:
                print("  – «%s» (دادهٔ نامعتبر) → نادیده" % raw)
                continue
            det = self.router.detect(raw)
            if det["student_id"]:
                writer = det["writer"]
                mark = "✓" if writer and writer["agent_id"] == o["assigned_agent_id"] else "≈"
                print("  %s «%s» → دانشجو %s | نویسنده: %s | سفارش %s"
                      % (mark, raw[:34], det["student_id"],
                         (writer or {}).get("agent_name") or "—", o.get("id")))
                routed += 1
            else:
                print("  ✗ «%s» → دانشجو پیدا نشد" % raw[:34])
                failed += 1
        print("\nمسیریابی موفق: %d | بی‌نتیجه: %d" % (routed, failed))
        print("\nنکته: سفارش‌های بدون نویسنده و دانشجوهای بدون سفارش در «استخر عمومی» می‌افتند.\n")
        return True


# ══════════════════════════════════════════════════════════════
# ورودی برنامه
# ══════════════════════════════════════════════════════════════
def main():
    global CONFIG_FILE

    parser = argparse.ArgumentParser(description="پوستهٔ ربات تلگرام تعدیلات")
    parser.add_argument("--check", action="store_true", help="بررسی سلامت تنظیمات و اتصال‌ها")
    parser.add_argument("--routes", action="store_true",
                        help="گزارش مسیریابی دانشجو → نویسنده روی دادهٔ واقعی")
    parser.add_argument("--set-menu", action="store_true",
                        help="فقط ثبت دکمهٔ منو و خروج")
    parser.add_argument("--init-config", action="store_true",
                        help="ساخت config.json از روی config.example.json")
    parser.add_argument("--config", default=CONFIG_FILE, help="مسیر فایل تنظیمات")
    parser.add_argument("--set-bio", action="store_true",
                        help="ثبت بیو ربات + انتقال لینک مینیاپ به بیو "
                             "و حذف دکمهٔ منو")
    parser.add_argument("--webhook", default=None,
                        help="ثبت Webhook روی Supabase Edge Function. "
                             "برای حذف: --webhook off")
    parser.add_argument("--webhook-info", action="store_true",
                        help="نمایش وضعیت Webhook فعلی")
    parser.add_argument("--max-seconds", type=int, default=0,
                        help="حداکثر مدت اجرا به ثانیه (برای GitHub Actions) — "
                             "۰ یعنی بی‌نهایت")
    args = parser.parse_args()

    CONFIG_FILE = args.config

    if args.init_config:
        if os.path.exists(CONFIG_FILE):
            print("ℹ️ فایل config.json از قبل وجود دارد: %s" % CONFIG_FILE)
            return 0
        with open(EXAMPLE_CONFIG, "r", encoding="utf-8") as src:
            content = src.read()
        with open(CONFIG_FILE, "w", encoding="utf-8") as dst:
            dst.write(content)
        print("✅ فایل ساخته شد: %s" % CONFIG_FILE)
        return 0

    if not os.path.exists(CONFIG_FILE):
        print("❌ فایل config.json پیدا نشد.")
        print("   یک‌بار این دستور را اجرا کنید:  python bot.py --init-config")
        return 2

    cfg = load_config()
    if not cfg.get("supabase_anon_key"):
        print("❌ supabase_anon_key در config.json تنظیم نشده است.")
        return 2

    # ── پروکسی برای تلگرام ──
    # در ایران api.telegram.org به IP فیلترینگ رزولو می‌شود، پس ربات باید
    # از پروکسی محلی (v2rayN/xray) رد شود. اگر خالی باشد، خودکار پیدا می‌شود.
    try:
        import netproxy
        netproxy.install(cfg.get("proxy"), logger=log)
    except Exception as exc:  # noqa: BLE001
        log("راه‌اندازی پروکسی نشد (بی‌اهمیت): %s" % exc, "WARN")

    # ── بیو ربات + انتقال مینیاپ به بیو ──
    if args.set_bio:
        tg = Telegram(cfg["telegram_bot_token"])
        url = cfg.get("miniapp_url") or "https://alkawthar.info/tadilat-app.html"
        desc = (
            "📤 <b>ارسال تعدیلات — شرکة الکوثر</b>\n\n"
            "اینجا اسمت را می‌نویسی، تأیید می‌کنی که خودت هستی و بعد "
            "فایل‌های تعدیلاتت را می‌فرستی — از فایل‌های گوشی یا "
            "از واتساپ (Share → Telegram).\n\n"
            "📋 با دکمه‌های پایین چت، وضعیت، تاریخ تحویل و فایل‌هایت "
            "را می‌بینی.\n\n"
            "🔗 <b>نسخهٔ مینیاپ:</b>\n%s\n\n"
            "برای شروع /start را بزنید." % url
        )
        short = "ارسال تعدیلات به شرکة الکوثر — اسمت را بنویس و فایل‌ها را بفرست."
        try:
            tg.set_description(desc[:512])
            print("✅ توضیح ربات (بیو) ثبت شد")
        except TelegramError as exc:
            print("❌ ثبت توضیح ناموفق: %s" % exc)
        try:
            tg.set_short_description(short[:120])
            print("✅ بیوی کوتاه ثبت شد")
        except TelegramError as exc:
            print("⚠️ بیوی کوتاه ثبت نشد: %s" % exc)
        try:
            tg.reset_menu_button()
            print("✅ دکمهٔ منو به حالت پیش‌فرض برگشت (دکمهٔ مینیاپ برداشته شد)")
        except TelegramError as exc:
            print("❌ حذف دکمهٔ منو ناموفق: %s" % exc)
        return 0

    # ── حالت Webhook (Supabase Edge Function) ──
    if args.webhook_info:
        tg = Telegram(cfg["telegram_bot_token"])
        info = tg.webhook_info() or {}
        url = info.get("url") or ""
        print("\n=== وضعیت Webhook ===")
        if url:
            print("  ✅ فعال → %s" % url)
            print("  در انتظار پردازش: %s" % (info.get("pending_update_count") or 0))
            if info.get("last_error_message"):
                print("  ⚠️ آخرین خطا: %s" % info["last_error_message"])
        else:
            print("  ℹ️ Webhook فعال نیست — ربات با getUpdates کار می‌کند")
        return 0

    if args.webhook is not None:
        tg = Telegram(cfg["telegram_bot_token"])
        target = str(args.webhook).strip()
        if target.lower() in ("off", "none", "delete", "0"):
            tg.delete_webhook(drop_pending=False)
            print("✅ Webhook حذف شد — ربات روی این دستگاه با getUpdates کار می‌کند.")
            return 0
        if not target.startswith("https://"):
            print("❌ آدرس Webhook باید https باشد. مثال:")
            print("   --webhook https://<ref>.supabase.co/functions/v1/telegram-bot")
            return 2
        secret = (cfg.get("webhook_secret") or "").strip()
        if not secret:
            print("⚠️ webhook_secret در config خالی است — بدون احراز هویت ثبت می‌شود.")
            print("   بهتر است یک رشتهٔ تصادفی بگذارید (همان در Secrets سوپابیس).")
        try:
            tg.set_webhook(target, secret or None)
        except TelegramError as exc:
            print("❌ ثبت Webhook ناموفق: %s" % exc)
            return 1
        print("✅ Webhook ثبت شد → %s" % target)
        if secret:
            print("   با کلید امنیتی %s…%s" % (secret[:4], secret[-4:]))
        print("\nحالا ربات روی Supabase پاسخ می‌دهد. اگر می‌خواهید")
        print("روی این کامپیوتر هم اجرا شود، اول Webhook را حذف کنید")
        print("(چون تلگرام هم‌زمان اجازهٔ هر دو را نمی‌دهد).")
        return 0

    if args.check:
        return 0 if TadilatBot(cfg).check() else 1

    if args.routes:
        return 0 if TadilatBot(cfg).report_routes() else 1

    if args.set_menu:
        bot = TadilatBot(cfg)
        try:
            me = bot.tg.me()
            print("ربات: @%s" % me.get("username"))
        except Exception as exc:  # noqa: BLE001
            print("❌ توکن ربات بی‌اعتبار است: %s" % exc)
            return 2
        return 0 if bot.register_menu() else 1

    if not cfg.get("telegram_bot_token"):
        print("❌ توکن ربات تنظیم نشده است.")
        print("   ۱) از @BotFather یک ربات بسازید و توکن بگیرید.")
        print("   ۲) توکن را در config.json → telegram_bot_token بگذارید.")
        return 2

    log("شروع پوستهٔ ربات تعدیلات…")
    if args.max_seconds:
        cfg["max_run_seconds"] = int(args.max_seconds)
    while True:
        try:
            TadilatBot(cfg).run()
            return 0
        except KeyboardInterrupt:
            log("ربات متوقف شد")
            return 0
        except Exception:  # noqa: BLE001
            log("ربات با خطا متوقف شد — ۱۰ ثانیه بعد دوباره اجرا می‌شود:\n%s"
                % traceback.format_exc(), "ERROR")
            time.sleep(10)


if __name__ == "__main__":
    sys.exit(main())
