---
title: Pocket TTS Farsi API
emoji: 🎙️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: cc-by-nc-4.0
---

# سرویس تبدیل متن فارسی به گفتار (Pocket-TTS Farsi v2)

سرویس HTTP برای مدل [`mehdi-hf/pocket-tts-farsi-v2`](https://huggingface.co/mehdi-hf/pocket-tts-farsi-v2)
با کلون‌سازی صدا. روی CPU اجرا می‌شود.

- صفحهٔ آزمایش: `/`
- مستندات تعاملی API: `/docs`
- صدا: `/home/user/app/voices/*.wav` (نمونهٔ صدای کلون‌شده)

## API

```
GET  /api/health          وضعیت مدل و فهرست صداها
GET  /api/voices          فهرست صداها
POST /api/tts             {"text": "...", "voice": "my_voice"}  →  audio/wav
POST /api/phonemes        {"text": "..."}  →  آواها و برنامهٔ قطعه‌بندی
POST /api/voices/{name}   ثبت صدا (multipart "file") — نیازمند X-Admin-Token
DELETE /api/voices/{name} حذف صدا — نیازمند X-Admin-Token
```

### مثال

```bash
curl -X POST "https://<USER>-<SPACE>.hf.space/api/tts" \
  -H "Content-Type: application/json" \
  -d '{"text":"سلام، حال شما چطور است؟","voice":"my_voice"}' \
  --output out.wav
```

## متغیرهای محیطی

| نام | کار |
|---|---|
| `TTS_ADMIN_TOKEN` | اگر تنظیم شود، ثبت/حذف صدا فقط با هدر `X-Admin-Token` ممکن است. **روی Space عمومی حتماً تنظیم کنید.** |
| `FARSI_TTS_VOICE` | نام صدای پیش‌فرض (پیش‌فرض: `sample_female`) |

## نکات

- **متن باید فارسی باشد**؛ مدل روی آوا آموزش دیده، سرویس خودش نرمال‌سازی و آوانویسی را انجام می‌دهد.
- **نمونهٔ صدا حداکثر ۵ ثانیه.** نمونهٔ بلندتر مدل را وادار می‌کند جملهٔ خودِ نمونه را بگوید.
- مجوز مدل **CC-BY-NC-4.0** است: استفادهٔ **غیرتجاری**. صدای افراد را فقط با رضایت خودشان کلون کنید.
