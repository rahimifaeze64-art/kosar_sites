# -*- coding: utf-8 -*-
"""
routing.py — مسیریابی «دانشجو → نویسندهٔ مربوطه»

زنجیره (بر اساس ساختار واقعی همین دیتابیس):
    ۱) نام/شمارهٔ دانشجویی → profiles (role=student)      → student_id
    ۲) student_id یا نام دانشجو → orders                   → assigned_agent_id
       (در این دیتابیس orders.student_id عملاً خالی است و
        تطبیق با student_name انجام می‌شود)
    ۳) assigned_agent_id → profiles (role=agent)          → نام نویسنده

همین منطق در تلگرام (js/tadilat-app.js) هم پیاده شده تا هر دو مسیر
(تلگرام و ربات) یکسان مسیریابی کنند.

بدون وابستگی خارجی.
"""

import re
import time

_HARAKAT = re.compile(r"[\u064B-\u0652\u0670\u0640]")
_INVISIBLE = re.compile(r"[\u200b-\u200f\u202a-\u202e]")
_ALEF_MAP = (("ي", "ی"), ("ك", "ک"), ("ۀ", "ه"), ("ة", "ه"), ("أ", "ا"),
             ("إ", "ا"), ("آ", "ا"), ("ٱ", "ا"), ("ؤ", "و"), ("ئ", "ی"))
_FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def norm_name(value):
    """نام فارسی/عربی را برای مقایسه یکسان‌سازی می‌کند."""
    if not value:
        return ""
    text = _HARAKAT.sub("", str(value).strip())
    text = _INVISIBLE.sub(" ", text)
    for src, dst in _ALEF_MAP:
        text = text.replace(src, dst)
    return re.sub(r"\s+", " ", text).strip()


def norm_name_key(value):
    """کلید مقایسه: بدون فاصله و نیم‌فاصله."""
    return norm_name(value).replace(" ", "")


def extract_student_no(text):
    """بلندترین عدد ۶ رقمی و بیشتر را به‌عنوان شمارهٔ دانشجویی برمی‌گرداند."""
    if not text:
        return None
    digits = str(text).translate(_FA_DIGITS)
    found = re.findall(r"\d{6,}", digits)
    return max(found, key=len) if found else None


class Router:
    """فهرست دانشجوها، سفارش‌ها و نویسنده‌ها را کش می‌کند و مسیر را می‌سازد."""

    def __init__(self, sb, ttl=600, logger=None):
        self.sb = sb
        self.ttl = ttl
        self.log = logger or (lambda *a, **k: None)
        self._students = []
        self._orders = []
        self._agents = {}
        self._loaded_at = 0.0

    # ── بارگذاری ─────────────────────────────────────────────
    def _ensure(self):
        if self._students and (time.time() - self._loaded_at) < self.ttl:
            return
        try:
            rows = self.sb.select(
                "profiles", "select=id,name,student_id,role&limit=2000")
            self._agents = {r["id"]: (r.get("name") or r["id"])
                            for r in rows if r.get("role") == "agent"}
            self._students = [
                {"id": r["id"], "name": r.get("name") or "",
                 "key": norm_name_key(r.get("name")),
                 "student_id": (r.get("student_id") or "").strip()}
                for r in rows if r.get("role") == "student" and r.get("id")
            ]
        except Exception as exc:  # noqa: BLE001
            self.log("بارگذاری فهرست دانشجوها ناموفق: %s" % exc)
        try:
            orders = self.sb.select(
                "orders",
                "select=id,student_id,student_name,assigned_agent_id,created_at"
                "&assigned_agent_id=not.is.null&order=created_at.desc&limit=1000")
            self._orders = [
                {"id": o.get("id"),
                 "student_id": o.get("student_id") or None,
                 "key": norm_name_key(o.get("student_name")),
                 "agent_id": o.get("assigned_agent_id") or None,
                 "created_at": o.get("created_at") or ""}
                for o in (orders or []) if o.get("assigned_agent_id")
            ]
        except Exception as exc:  # noqa: BLE001
            self.log("بارگذاری سفارش‌ها ناموفق: %s" % exc)
        self._loaded_at = time.time()
        self.log("مسیریاب آماده شد: %d دانشجو، %d سفارش، %d نویسنده"
                 % (len(self._students), len(self._orders), len(self._agents)))

    # ── تطبیق دانشجو ─────────────────────────────────────────
    def match_student(self, raw_text):
        """خروجی: (student_id | None, matched_name | None, student_no | None)"""
        self._ensure()
        text = str(raw_text or "")
        student_no = extract_student_no(text)

        if student_no:
            for row in self._students:
                if row["student_id"] and row["student_id"] == student_no:
                    return row["id"], row["name"], student_no

        # شناسه‌های غیرعددی مثل GRAD-N018
        compact = re.sub(r"[\s\u200b-\u200f\u202a-\u202e]+", "",
                         text.translate(_FA_DIGITS)).upper()
        if len(compact) >= 5:
            hits = []
            for row in self._students:
                sid = (row["student_id"] or "").strip()
                if len(sid) < 5:
                    continue
                key = re.sub(r"\s+", "", sid).upper()
                if key in compact:
                    hits.append((len(key), key, row))
            if hits:
                hits.sort(key=lambda h: h[0], reverse=True)
                longest = hits[0]
                tied = [h for h in hits if h[0] == longest[0] and h[1] != longest[1]]
                if not tied:
                    return longest[2]["id"], longest[2]["name"], longest[2]["student_id"]

        key = norm_name_key(re.sub(r"\d+", " ", text.translate(_FA_DIGITS)))
        if not key or len(key) < 4:
            return None, None, student_no

        exact = [r for r in self._students if r["key"] == key]
        if len(exact) == 1:
            return exact[0]["id"], exact[0]["name"], student_no

        partial = []
        for row in self._students:
            rk = row["key"]
            if not rk or len(rk) < 4:
                continue
            if key in rk or rk in key:
                ratio = min(len(rk), len(key)) / max(len(rk), len(key))
                if ratio >= 0.6:
                    partial.append((ratio, row))
        if partial:
            partial.sort(key=lambda item: item[0], reverse=True)
            if len(partial) == 1 or partial[1][0] < partial[0][0]:
                return partial[0][1]["id"], partial[0][1]["name"], student_no
        return None, None, student_no

    # ── مسیریابی به نویسنده ──────────────────────────────────
    def resolve_writer(self, student_id, student_name):
        """خروجی: {agent_id, agent_name, order_id} یا None"""
        self._ensure()
        key = norm_name_key(student_name)
        hits = []
        for order in self._orders:
            if not order["agent_id"]:
                continue
            if student_id and order["student_id"] and order["student_id"] == student_id:
                hits.append(order)
                continue
            ok = order["key"]
            if not key or len(key) < 4 or not ok or len(ok) < 4:
                continue
            if ok == key:
                hits.append(order)
            elif (ok in key or key in ok):
                ratio = min(len(ok), len(key)) / max(len(ok), len(key))
                if ratio >= 0.75:
                    hits.append(order)
        if not hits:
            return None
        hits.sort(key=lambda o: str(o["created_at"]), reverse=True)
        top = hits[0]
        return {
            "agent_id": top["agent_id"],
            "agent_name": self._agents.get(top["agent_id"], top["agent_id"]),
            "order_id": top["id"],
        }

    def detect(self, raw_text):
        """یک‌باره: تطبیق دانشجو + یافتن نویسنده. خروجی: dict"""
        student_id, matched, student_no = self.match_student(raw_text)
        writer = self.resolve_writer(student_id, matched or raw_text) if student_id else None
        return {
            "student_id": student_id,
            "student_name": matched,
            "student_no": student_no,
            "writer": writer,
        }
