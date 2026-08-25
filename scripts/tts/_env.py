"""Load key=value pairs from the repo-root .env into os.environ.

Real environment variables always win, so you can override a .env value for a
single run:  ELEVENLABS_VOICE_ID=other python3 tts_generate.py --chapter 4
"""

import os

ENV_FILE = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
)


def load_env(path: str = ENV_FILE) -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key, val)
