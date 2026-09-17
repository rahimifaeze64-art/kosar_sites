#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
normalize_fa.py — نرمال‌سازی ساده متن فارسی برای مدل pocket-tts-farsi

- حذف اعراب
- یکسان‌سازی حروف عربی به فارسی (ي→ی، ك→ک، ة→ه، ى→ی)
- تبدیل ارقام فارسی/عربی به حروف (مدل با اعداد به‌صورت کلمه آموزش دیده)
- یکسان‌سازی نقطه‌گذاری و فاصله‌ها (نیم‌فاصله حفظ می‌شود)
- حذف ایموجی و نشانه‌های بولت
- chunk_text: شکستن متن به قطعه‌های کوتاه (پیش‌فرض ~۱۶ کلمه / زیر ۱۸ توکن)
"""

import re

# ── اعراب و علائم ترکیبی ──────────────────────────────────────
_HARAKAT = re.compile(r"[\u064B-\u065F\u0670\u06D6-\u06ED]")

# ── نگاشت حروف عربی به فارسی ─────────────────────────────────
_LETTER_MAP = {
    "\u064A": "\u06CC",  # ي → ی
    "\u0649": "\u06CC",  # ى → ی
    "\u0643": "\u06A9",  # ك → ک
    "\u0629": "\u0647",  # ة → ه
    "\u06C0": "\u0647",  # ۀ → ه
    "\u0623": "\u0627",  # أ → ا
    "\u0625": "\u0627",  # إ → ا
    "\u0622": "\u0627",  # آ → ا
}

# ── ارقام ─────────────────────────────────────────────────────
_PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
_ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
_DIGIT_TABLE = {ord(c): str(i) for i, c in enumerate(_PERSIAN_DIGITS)}
_DIGIT_TABLE.update({ord(c): str(i) for i, c in enumerate(_ARABIC_DIGITS)})

_YEKAN = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"]
_DAH = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"]
_DAHGAN = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"]
_SADGAN = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"]
_SCALES = ["", "هزار", "میلیون", "میلیارد", "بیلیون"]

_EMOJI = re.compile(
    "[" 
    "\U0001F000-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F1E6-\U0001F1FF"
    "\uFE0F\u200D\u20E3"
    "]",
    flags=re.UNICODE,
)

_NUM_RE = re.compile(r"\d+(?:[.,]\d+)?")


def _three(n: int) -> str:
    parts = []
    h, r = divmod(n, 100)
    if h:
        parts.append(_SADGAN[h])
    if r:
        if r < 10:
            parts.append(_YEKAN[r])
        elif r < 20:
            parts.append(_DAH[r - 10])
        else:
            d, y = divmod(r, 10)
            parts.append(_DAHGAN[d])
            if y:
                parts.append(_YEKAN[y])
    return " و ".join(parts)


def number_to_words(n: int) -> str:
    if n < 0:
        return "منفی " + number_to_words(-n)
    if n == 0:
        return "صفر"
    groups = []
    i = 0
    while n > 0:
        n, r = divmod(n, 1000)
        if r:
            s = _three(r)
            if i:
                s = (s + " " + _SCALES[i]).strip()
            groups.append(s)
        i += 1
    return " و ".join(reversed(groups))


def _num_replace(match: "re.Match") -> str:
    token = match.group(0)
    if "." in token or "," in token:
        head, _, tail = token.replace(",", ".").partition(".")
        head_s = number_to_words(int(head)) if head else "صفر"
        tail_s = " ".join(number_to_words(int(d)) for d in tail if d.isdigit())
        return f"{head_s} ممیز {tail_s}".strip()
    return number_to_words(int(token))


def normalize(text: str) -> str:
    """نرمال‌سازی متن فارسی برای ورودی مدل TTS."""
    if not text:
        return ""
    s = str(text)

    s = s.replace("\u00A0", " ").replace("\u200B", "")
    s = _HARAKAT.sub("", s)
    s = _EMOJI.sub(" ", s)
    for src, dst in _LETTER_MAP.items():
        s = s.replace(src, dst)

    s = s.translate(_DIGIT_TABLE)          # ارقام → ASCII برای تبدیل به کلمه
    s = _NUM_RE.sub(_num_replace, s)

    # نشانه‌های رایج (بولت، خط تیره فهرست، ستاره) → فاصله
    s = re.sub(r"[•●▪◦*_#`~^|<>\[\]{}/\\]+", " ", s)
    # نقطه‌گذاری مجاز را نگه می‌داریم اما تکرارها را یکی می‌کنیم
    s = s.replace("?", "؟").replace(";", "؛").replace(",", "،")
    s = re.sub(r"([.!؟؛:،])\1+", r"\1", s)
    # فاصله قبل از نقطه‌گذاری را حذف کن
    s = re.sub(r"\s+([.!؟؛:،])", r"\1", s)
    # فاصله‌گذاری بعد از نقطه‌گذاری
    s = re.sub(r"([.!؟؛:،])(?=\S)", r"\1 ", s)

    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()


_SPLIT_PRIMARY = re.compile(r"[.!؟!?؛;\n]+")
_SPLIT_SECONDARY = re.compile(r"[،,:]+")


def chunk_text(text: str, max_words: int = 16) -> list:
    """متن را به قطعه‌های کوتاه (پیش‌فرض ≤۱۶ کلمه) می‌شکند."""
    text = (text or "").strip()
    if not text:
        return []

    chunks = []
    for sentence in _SPLIT_PRIMARY.split(text):
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(sentence.split()) <= max_words:
            chunks.append(sentence)
            continue
        # تقسیم ثانویه روی ویرگول
        buffer = ""
        for part in _SPLIT_SECONDARY.split(sentence):
            part = part.strip()
            if not part:
                continue
            candidate = (buffer + "، " + part).strip("، ").strip() if buffer else part
            if len(candidate.split()) <= max_words:
                buffer = candidate
            else:
                if buffer:
                    chunks.append(buffer)
                buffer = part
        if buffer:
            chunks.append(buffer)

    # هر قطعه‌ای که هنوز بلند است را با کلمه بشکن
    final = []
    for c in chunks:
        words = c.split()
        if len(words) <= max_words:
            final.append(c)
            continue
        for i in range(0, len(words), max_words):
            final.append(" ".join(words[i:i + max_words]))
    return [c for c in final if c.strip()]


def normalize_and_chunk(text: str, max_words: int = 16) -> list:
    return chunk_text(normalize(text), max_words=max_words)


if __name__ == "__main__":
    import sys
    sample = sys.argv[1] if len(sys.argv) > 1 else "سلام، ۱۲۳ دانشجو در مرحله استلال هستند."
    print("normalized:", normalize(sample))
    print("chunks:")
    for i, c in enumerate(normalize_and_chunk(sample), 1):
        print(f"  {i}. {c}")
