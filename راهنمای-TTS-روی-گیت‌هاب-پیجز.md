# راهنمای افزودن «تبدیل متن به گفتار» به سایت (GitHub Pages)

این راهنما کنار پروژهٔ سایت (`kosar_sites`) قرار می‌گیرد و توضیح می‌دهد چطور قابلیت
تبدیل متن فارسی به گفتار — با صدای خودتان — روی سایت بالا بیاید.

---

## ۱) واقعیت فنی که همه‌چیز را تعیین می‌کند

**GitHub Pages فقط فایل ایستا (HTML/CSS/JS) سرو می‌کند.** نمی‌تواند پایتون یا PyTorch
اجرا کند. مدل ما ۱۰۹ میلیون پارامتر و ۴۲۰ مگابایت وزن دارد؛ نه در مرورگر قابل اجراست
(نیاز به پورت ONNX/WebGPU دارد که برای نسخهٔ فارسی وجود ندارد) و نه در صفحات گیت‌هاب
جایی برای اجرا هست.

پس معماری این است:

```
   مرورگر کاربر
        │
        │  ۱. صفحهٔ ایستا از GitHub Pages
        ▼
   alkawthar.info  (فقط HTML/JS)
        │
        │  ۲. fetch  →  POST /api/tts   {text, voice}
        ▼
   سرویس TTS روی Hugging Face Space یا سرور شما   ← مدل اینجا اجرا می‌شود
        │
        │  ۳. پاسخ: audio/wav
        ▼
   پخش صدا در مرورگر
```

سایت دست‌نخورده و ایستا می‌ماند؛ فقط یک `fetch` به سرویس اضافه می‌شود.

> نکته: چون سایت شما روی `https://alkawthar.info` است، سرویس هم باید **https** باشد،
> وگرنه مرورگر جلوی درخواست را می‌گیرد (Mixed Content). Hugging Face Space به‌صورت
> پیش‌فرض https می‌دهد.

---

## ۲) گزینه‌های میزبانی سرویس TTS

| گزینه | هزینه | مزیت | عیب |
|---|---|---|---|
| **Hugging Face Space (پیشنهاد)** | رایگان | https دائمی، بدون نیاز به کامپیوتر شما، CORS باز | مدل روی CPU عمومی؛ هر بیکاری Space خواب می‌رود و بار اول چند دقیقه بیدار می‌شود |
| کامپیوتر خودتان + تونل (cloudflared) | رایگان | مدل خودتان، سرعت خوب | کامپیوتر باید روشن بماند؛ آدرس تونل عوض می‌شود |
| VPS | ماهانه | پایدار و سریع | هزینه و نگهداری |

بقیهٔ این راهنما گزینهٔ اول را کامل توضیح می‌دهد. گزینهٔ دوم در انتهای همین پوشه در
`pocket-tts-farsi/README.fa.md` آمده (همان سرویس روی ویندوز خودتان).

---

## ۳) راه‌اندازی Space (یک‌بار، حدود ۱۵ دقیقه)

### ۳-۱. توکن Hugging Face بسازید
بروید به <https://huggingface.co/settings/tokens> → **New token** → نوع **Write** →
توکن را کپی کنید (`hf_...`).

### ۳-۲. سکرت‌ها را در گیت‌هاب بگذارید
در مخزن `rahimifaeze64-art/kosar_sites` → **Settings** → **Secrets and variables** → **Actions**:

- در تب **Secrets** → New repository secret:
  - نام: `HF_TOKEN` — مقدار: توکن `hf_...`
- در تب **Variables** → New repository variable:
  - نام: `HF_SPACE_ID` — مقدار: `username/نام-اسپیس` (مثلاً `rahimifaeze64/kosar-tts`)

### ۳-۳. اجازه بدهید ورک‌فلو سرویس را بسازد
فایل `.github/workflows/deploy-tts-space.yml` را push کنید. ورک‌فلو خودش Space را
می‌سازد و کل پوشهٔ `tts_service/` را آنجا آپلود می‌کند.

اگر ترجیح می‌دهید دستی باشد:

```bash
set HF_TOKEN=hf_xxxxxxxx
set HF_SPACE_ID=rahimifaeze64/kosar-tts
python tts_service/deploy_to_space.py
```

### ۳-۴. توکن مدیریت را تنظیم کنید (مهم)
Space به‌صورت پیش‌فرض **عمومی** است. یعنی هر کسی می‌تواند صدا ثبت یا حذف کند.
در Space → **Settings** → **Variables and secrets** → New secret:

- نام: `TTS_ADMIN_TOKEN` — مقدار: یک رمز دلخواه

از این به بعد ثبت/حذف صدا فقط با هدر `X-Admin-Token` ممکن است. (خودِ تبدیل متن به
گفتار عمومی می‌ماند — که همان چیزی است که می‌خواهیم.)

### ۳-۵. بیلد را تماشا کنید
در تب **Logs** اسپیس، اول ایمیج ساخته می‌شود (torch و وزن‌های مدل داخل ایمیج پخته
می‌شوند تا هر بار دانلود نشوند) و بعد سرویس بالا می‌آید. آدرس نهایی چیزی شبیه این است:

```
https://rahimifaeze64-kosar-tts.hf.space
```

با `GET /api/health` تست کنید.

### ۳-۶. صدای خودتان را ثبت کنید
۲ تا ۵ ثانیه از صدای خودتان ضبط کنید (بدون موسیقی و صدای دوم) و آپلود کنید:

```bash
curl -X POST "https://rahimifaeze64-kosar-tts.hf.space/api/voices/my_voice" ^
  -H "X-Admin-Token: رمز-شما" ^
  -F "file=@C:\path\to\myvoice.wav" ^
  -F "seconds=5" ^
  -F "trim=true"
```

یا ساده‌تر: صفحهٔ `tts-demo.html` سایت را باز کنید، در بخش «ثبت صدای خودتان» ضبط کنید،
توکن مدیریت را وارد کنید و «ذخیره صدا» را بزنید.

> ⚠️ روی Space رایگان، فایل‌سیستم با هر بیلد پاک می‌شود. برای اینکه صدا بماند، فایل
> `voices/my_voice.wav` را در مخزن (پوشهٔ `tts_service/voices/`) بگذارید تا همراه
> استقرار آپلود شود. یا در Space تنظیمات **Persistent Storage** را فعال کنید.

---

## ۴) استفاده در صفحات سایت

### ۴-۱. ویجت آماده (کمترین کار)
فایل `js/tts-widget.js` را در صفحاتی که می‌خواهید اضافه کنید:

```html
<script src="js/tts-widget.js"></script>
<script>
  FarsiTTS.init({
    apiBase: "https://rahimifaeze64-kosar-tts.hf.space",
    voice: "my_voice",
  });
</script>
```

بعد روی هر متنی که باید خوانده شود `data-tts` بگذارید — خودش دکمهٔ «🔊 شنیدن» می‌سازد:

```html
<p data-tts>زبان فارسی یکی از قدیمی‌ترین زبان‌های زندهٔ جهان است.</p>
<p data-tts data-tts-voice="sample_male">این یکی با صدای دیگر خوانده می‌شود.</p>
```

ویژگی‌ها: کش مرورگر (متن تکراری دوباره ساخته نمی‌شود)، توقف و پخش دوباره، دکمهٔ
در حال بارگذاری، و پشتیبانی از محتوایی که بعداً با JS اضافه می‌شود.

### ۴-۲. بدون ویجت، فقط با fetch
```js
async function speak(text) {
  const res = await fetch("https://rahimifaeze64-kosar-tts.hf.space/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: "my_voice" }),
  });
  if (!res.ok) throw new Error((await res.json()).detail);
  new Audio(URL.createObjectURL(await res.blob())).play();
}
```

### ۴-۳. صفحهٔ آزمایش
`tts-demo.html` را در سایت بگذارید: آدرس سرویس، انتخاب صدا، ضبط و ثبت صدای جدید،
و سه نمونه از کاربرد ویجت. برای تست سریع و برای عیب‌یابی مناسب است.

---

## ۵) API سرویس

| متد | مسیر | کار |
|---|---|---|
| `GET` | `/api/health` | وضعیت مدل + فهرست صداها |
| `GET` | `/api/voices` | فهرست صداها |
| `POST` | `/api/tts` | `{"text","voice","format"}` → `audio/wav` |
| `POST` | `/api/phonemes` | آواها و برنامهٔ قطعه‌بندی (برای عیب‌یابی کیفیت) |
| `POST` | `/api/voices/{name}` | ثبت صدا — نیازمند `X-Admin-Token` |
| `DELETE` | `/api/voices/{name}` | حذف صدا — نیازمند `X-Admin-Token` |

هدرهای پاسخ: `X-Audio-Seconds`، `X-Chunks`، `X-Sample-Rate`، `X-Generation-Seconds`.
مستندات تعاملی روی `/docs` است.

---

## ۶) عیب‌یابی

| نشانه | علت |
|---|---|
| `Failed to fetch` در کنسول | سرویس خواب است (Space رایگان بعد از بی‌کاری می‌خوابد) — صفحهٔ Space را باز کنید تا بیدار شود؛ یا `apiBase` غلط است. |
| `Mixed Content` | آدرس سرویس `http` است؛ باید `https` باشد. |
| درخواست CORS رد می‌شود | سرویس باید `Access-Control-Allow-Origin: *` بدهد؛ نسخهٔ `tts_service` داخل همین پوشه این کار را می‌کند. |
| ۴۰۱ روی ثبت صدا | `X-Admin-Token` را درست نفرستاده‌اید. |
| مدل جملهٔ نمونه را می‌گوید | نمونهٔ صدا بلندتر از ۵ ثانیه است. |
| خروجی سکوت است | متن غیرفارسی یا خالی بوده؛ با `/api/phonemes` بررسی کنید. |

---

## ۷) امنیت — دو نکتهٔ فوری

1. **توکن گیت‌هاب شما داخل آدرس ریموت مخزن ذخیره شده است**
   (`https://ghp_...@github.com/rahimifaeze64-art/kosar_sites.git`). هر کسی که به این
   پوشه یا تاریخچهٔ گیت دسترسی داشته باشد، آن توکن را می‌بیند. لطفاً:
   - توکن را در <https://github.com/settings/tokens> **revoke** کنید،
   - و ریموت را بدون توکن تنظیم کنید:
     ```
     git remote set-url origin https://github.com/rahimifaeze64-art/kosar_sites.git
     ```
     و برای push از Git Credential Manager یا SSH استفاده کنید.

2. **مجوز مدل تجاری نیست.** `pocket-tts-farsi-v2` تحت **CC-BY-NC-4.0** است، یعنی
   استفادهٔ **غیرتجاری**. اگر سایت شما درآمد دارد، برای این مدل باید مجوز بگیرید.
   همچنین صدای افراد را فقط با رضایت خودشان کلون کنید.
