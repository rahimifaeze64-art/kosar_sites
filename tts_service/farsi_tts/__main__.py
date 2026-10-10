"""Entry point for the local server: `python -m farsi_tts`."""

from .server import main

if __name__ == "__main__":
    raise SystemExit(main())
