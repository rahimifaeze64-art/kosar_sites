# سرویس TTS فارسی روی Hugging Face Spaces (Docker SDK)
#
# چرا اینجا و نه روی GitHub Pages؟
#   GitHub Pages فقط فایل ایستا سرو می‌کند. این مدل ۴۲۰ مگابایت وزن و یک
#   کتابخانهٔ PyTorch می‌خواهد؛ در مرورگر و روی Pages قابل اجرا نیست.
#   پس مدل اینجا (Space) اجرا می‌شود و سایت Pages فقط با fetch صدایش را می‌گیرد.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/opt/hf \
    FARSI_TTS_MODELS=/opt/hf \
    FARSI_TTS_OUTPUT=/tmp/tts-out

# libsndfile برای خواندن mp3/ogg هنگام ثبت صدا
RUN apt-get update \
 && apt-get install -y --no-install-recommends libsndfile1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ۱) تورت CPU نسخهٔ CPU — روی لینوکس، PyPI به‌صورت پیش‌فرض بیلد CUDA (حدود ۳ گیگ) می‌دهد
RUN pip install torch==2.13.0 --index-url https://download.pytorch.org/whl/cpu

# ۲) بقیهٔ وابستگی‌ها (از جمله خود pocket-tts فورک‌شده)
COPY requirements.txt .
RUN pip install -r requirements.txt

# ۳) وزن‌های مدل را داخل ایمیج بپز تا هر بار بالا آمدن Space دوباره دانلود نشود
RUN python -c "\
from huggingface_hub import snapshot_download; \
snapshot_download('mehdi-hf/pocket-tts-farsi-v2'); \
snapshot_download('mehdi-hf/Homo-GE2PE-Persian-HF')"

# ۴) کد سرویس
COPY . .

EXPOSE 7860
CMD ["python", "-m", "farsi_tts", "--host", "0.0.0.0", "--port", "7860"]
