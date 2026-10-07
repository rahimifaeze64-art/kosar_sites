# -*- coding: utf-8 -*-
"""
sbservice.py — کلاینت سبک Supabase (PostgREST + Storage) بدون وابستگی خارجی

چرا بدون کتابخانهٔ رسمی؟
  • سرویس‌های دیگر این پروژه (مثل tts_service) هم فقط با کتابخانهٔ استاندارد
    پایتون کار می‌کنند؛ نصب pip روی سرور لازم نیست.
  • هر دو بخش موردنیاز (REST و Storage) با urllib قابل استفاده‌اند.
"""

import json
import mimetypes
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

# شبکه‌های بین‌المللی (به‌ویژه از ایران) گاهی TLS را وسط راه می‌بندند؛
# پس خطای شبکه با کمی صبر دوباره تلاش می‌شود.
RETRY_ATTEMPTS = 4
RETRY_BASE_DELAY = 1.2


class SupabaseError(RuntimeError):
    """خطای برگشتی از Supabase با پیام خوانا."""

    def __init__(self, message, status=None, code=None, body=None, network=False):
        super().__init__(message)
        self.status = status
        self.code = code
        self.body = body
        self.network = network       # True یعنی مشکل اتصال بود، نه درخواست


# ── کلید امن Storage ─────────────────────────────────────────
# Supabase Storage برای نام آبجکت فقط کاراکترهای ASCII را می‌پذیرد.
# (در همین پروژه قبلاً خطای "Invalid key" با نام فارسی رخ داده است.)
_TR = {
    "آ": "a", "أ": "a", "إ": "a", "ا": "a", "ب": "b", "پ": "p", "ت": "t", "ث": "s",
    "ج": "j", "چ": "ch", "ح": "h", "خ": "kh", "د": "d", "ذ": "z", "ر": "r", "ز": "z",
    "ژ": "zh", "س": "s", "ش": "sh", "ص": "s", "ض": "z", "ط": "t", "ظ": "z", "ع": "a",
    "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ک": "k", "گ": "g", "ل": "l", "م": "m",
    "ن": "n", "و": "v", "ؤ": "v", "ه": "h", "ة": "h", "ي": "y", "ی": "y", "ئ": "y",
    "ء": "", "‌": "_", "‎": "", "‏": "",
}

_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]")


def safe_storage_key(value, fallback="file"):
    """نام فارسی/عربی را به کلید ASCII قابل استفاده در Storage تبدیل می‌کند."""
    if not value:
        return fallback
    out = []
    for ch in str(value):
        if ch in _TR:
            out.append(_TR[ch])
        elif _SAFE_RE.match(ch) is None:  # حرف/رقم/نقطه/خط‌تیره — مجاز
            out.append(ch)
        elif ch.isspace():                # فاصله → زیرخط
            out.append("_")
        # بقیهٔ کاراکترها حذف می‌شوند
    text = "".join(out)
    text = re.sub(r"_{2,}", "_", text).strip("_")
    return text or fallback


class Supabase:
    """دسترسی به PostgREST و Storage با کلید anon."""

    def __init__(self, url, key, bucket="student-documents", timeout=60):
        self.url = (url or "").rstrip("/")
        self.key = key
        self.bucket = bucket
        self.timeout = timeout
        self._headers = {
            "apikey": self.key,
            "Authorization": "Bearer " + self.key,
        }

    # ── درخواست خام ──────────────────────────────────────────
    def _call(self, method, path, *, body=None, headers=None, ctype="application/json",
              raw=False):
        """یک درخواست؛ با تلاش مجدد در خطاهای شبکه/۵xx."""
        last = None
        for attempt in range(RETRY_ATTEMPTS):
            try:
                return self._call_once(method, path, body=body, headers=headers,
                                       ctype=ctype, raw=raw)
            except SupabaseError as exc:
                # خطای واقعی سرویس (۴xx) تکرار نمی‌شود؛ فقط شبکه و ۵xx/۴۲۹
                retryable = exc.network or exc.status is None or \
                    (exc.status or 0) >= 500 or exc.status == 429
                if not retryable:
                    raise
                last = exc
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_BASE_DELAY * (2 ** attempt))
        raise last

    def _call_once(self, method, path, *, body=None, headers=None,
                   ctype="application/json", raw=False):
        url = path if path.startswith("http") else self.url + path
        h = dict(self._headers)
        if headers:
            h.update(headers)
        data = None
        if body is not None:
            if raw:
                data = body
            else:
                data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            h["Content-Type"] = ctype
        req = urllib.request.Request(url, data=data, headers=h, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = resp.read()
                if not payload:
                    return None
                text = payload.decode("utf-8", "replace")
                try:
                    return json.loads(text)
                except ValueError:
                    return text
        except urllib.error.HTTPError as exc:
            text = exc.read().decode("utf-8", "replace")
            code = None
            message = text
            try:
                parsed = json.loads(text)
                message = parsed.get("message") or parsed.get("error") or text
                code = parsed.get("code")
            except ValueError:
                pass
            raise SupabaseError(message, status=exc.code, code=code, body=text) from None
        except Exception as exc:  # noqa: BLE001 — شامل SSL/TLS و DNS
            raise SupabaseError(
                "اتصال به Supabase برقرار نشد: %s" % (exc,), network=True) from None

    # ── PostgREST ────────────────────────────────────────────
    def select(self, table, query="select=*"):
        return self._call("GET", "/rest/v1/%s?%s" % (table, query)) or []

    def insert(self, table, rows, return_rows=True):
        prefer = "return=representation" if return_rows else "return=minimal"
        return self._call(
            "POST",
            "/rest/v1/" + table,
            body=rows,
            headers={"Prefer": prefer},
        )

    def update(self, table, filters, patch, return_rows=True):
        prefer = "return=representation" if return_rows else "return=minimal"
        return self._call(
            "PATCH",
            "/rest/v1/%s?%s" % (table, filters),
            body=patch,
            headers={"Prefer": prefer},
        )

    def upsert(self, table, rows, on_conflict):
        return self._call(
            "POST",
            "/rest/v1/%s?on_conflict=%s" % (table, urllib.parse.quote(on_conflict)),
            body=rows,
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )

    def delete(self, table, filters):
        return self._call("DELETE", "/rest/v1/%s?%s" % (table, filters))

    def table_exists(self, table):
        """آیا جدول در schema cache ساخته شده است؟"""
        try:
            self._call("GET", "/rest/v1/%s?select=*&limit=1" % table)
            return True
        except SupabaseError as exc:
            if exc.status == 404 or (exc.code or "").startswith("PGRST2"):
                return False
            raise

    # ── Storage ──────────────────────────────────────────────
    def upload(self, path, data, content_type=None):
        ctype = content_type or mimetypes.guess_type(path)[0] or "application/octet-stream"
        url = "/storage/v1/object/%s/%s" % (self.bucket, urllib.parse.quote(path))
        return self._call(
            "POST",
            url,
            body=data,
            headers={"x-upsert": "true"},
            ctype=ctype,
            raw=True,
        )

    def download(self, path):
        url = "/storage/v1/object/%s/%s" % (self.bucket, urllib.parse.quote(path))
        return self._call("GET", url)

    def delete_object(self, path):
        url = "/storage/v1/object/%s/%s" % (self.bucket, urllib.parse.quote(path))
        return self._call("DELETE", url)

    def signed_url(self, path, expires_in=3600 * 8):
        """لینک موقت برای نمایش در صفحهٔ سایت (باکت خصوصی است)."""
        url = "/storage/v1/object/sign/%s/%s" % (self.bucket, urllib.parse.quote(path))
        res = self._call("POST", url, body={"expiresIn": int(expires_in)})
        if isinstance(res, dict) and res.get("signedURL"):
            return self.url + "/storage/v1" + res["signedURL"]
        return None
