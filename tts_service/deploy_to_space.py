#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""سینک کردن پوشهٔ tts_service به یک Hugging Face Space.

اجرا محلی:
    set HF_TOKEN=hf_xxx
    set HF_SPACE_ID=username/my-tts-space
    python tts_service/deploy_to_space.py

در GitHub Actions به‌صورت خودکار با سکرت HF_TOKEN و وریبل HF_SPACE_ID اجرا می‌شود.

نکته: فایل‌های voices/*.wav هم آپلود می‌شوند، تا صدای کلون‌شدهٔ شما بعد از هر
بیلد دوباره Space باقی بماند (فایل‌سیستم Space موقتی است).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# این‌ها داخل Space لازم نیستند
IGNORE = [
    "legacy_v1/*",
    ".venv/*",
    "__pycache__/*",
    "*/__pycache__/*",
    "*.pyc",
    "models/*",
    "output/*",
    "deploy_to_space.py",
]


def main() -> int:
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
    space_id = os.environ.get("HF_SPACE_ID")
    if not token:
        print("error: HF_TOKEN is not set", file=sys.stderr)
        return 2
    if not space_id:
        print("error: HF_SPACE_ID is not set (e.g. username/my-tts-space)", file=sys.stderr)
        return 2

    from huggingface_hub import HfApi

    api = HfApi(token=token)
    api.create_repo(repo_id=space_id, repo_type="space", space_sdk="docker", exist_ok=True)
    url = api.upload_folder(
        repo_id=space_id,
        repo_type="space",
        folder_path=str(HERE),
        ignore_patterns=IGNORE,
        commit_message="deploy: tts_service",
    )
    print(f"uploaded to https://huggingface.co/spaces/{space_id}")
    print(f"commit: {url}")
    print(f"api base: https://{space_id.replace('/', '-').replace('_', '-').lower()}.hf.space")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
