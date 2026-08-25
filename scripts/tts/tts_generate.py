#!/usr/bin/env python3
"""
Tamil TTS generation using ElevenLabs, sourced directly from the app's own
verse data (public/data/rev.ta.json) — no hand-filled placeholder file.

Credentials come from scripture-training/.env (gitignored; see .env.example),
or from real environment variables, which take precedence.

Usage:
    python tts_generate.py --chapter 4
    python tts_generate.py --chapter 4 --verses 1,5,11
    python tts_generate.py --chapter 4 --dry-run   # validates inputs, no API calls

Output:
    ./output/revelation_{chapter}_v{n}.mp3  (one file per verse)
    ./output/generation_manifest.json
"""

import os
import sys
import json
import time
import argparse
import requests

from _env import load_env

load_env()

# Repo-relative default: scripts/tts/ -> ../../public/data/rev.ta.json
DEFAULT_SOURCE = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "data", "rev.ta.json")
)
# Default lives OUTSIDE the git repo: generated audio is expensive and
# untracked, and a stray git clean/rebase in the repo must not be able to
# delete it. Override with --output-dir.
OUTPUT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "tts-output")
)
BOOK_SLUG = "revelation"

API_BASE = "https://api.elevenlabs.io/v1"
# Credit cost per character, per elevenlabs.io/pricing/api ($0.10 vs $0.05 /1K).
# Note: eleven_turbo_v2_5 is deprecated and functionally equivalent to flash.
MODELS = {
    "v3": ("eleven_v3", 1.0),
    "multilingual": ("eleven_multilingual_v2", 1.0),
    "flash": ("eleven_flash_v2_5", 0.5),
}
DEFAULT_MODEL = "v3"
OUTPUT_FORMAT = "mp3_44100_128"

# Defaults; override per-run with --stability/--similarity/--style/--speed.
# stability      0.0-1.0  lower = more emotional range, higher = more monotone
#                         (v3 treats 0.0/0.5/1.0 as Creative/Natural/Robust)
# similarity     0.0-1.0  how closely to adhere to the reference voice
# style          0.0-1.0  style exaggeration; 0 is safest for narration
# speed          0.7-1.2  1.0 = default; lower is slower. Useful for memorization.
# Chosen 2026-08-25 after A/B on Rev 4:2 ("B_reverent"): steadier, more
# measured delivery for scripture narration. NOTE: eleven_v3 ignores "speed"
# entirely (measured: 0.7 and 1.2 both yield identical duration); it is honored
# by eleven_multilingual_v2. Playback speed is handled client-side instead.
DEFAULT_VOICE_SETTINGS = {
    "stability": 0.8,
    "similarity_boost": 0.75,
    "style": 0.0,
    "use_speaker_boost": True,
    "speed": 1.0,
}


def get_env_or_die(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        print(f"ERROR: environment variable {name} is not set.", file=sys.stderr)
        sys.exit(1)
    return val


def load_verses(path: str, chapter: int, only):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    match = [c for c in data.get("chapters", []) if c.get("chapter") == chapter]
    if not match:
        available = sorted(c.get("chapter") for c in data.get("chapters", []))
        print(f"ERROR: chapter {chapter} not found in {path}. Available: {available}", file=sys.stderr)
        sys.exit(1)

    verses = [{"verse": v["v"], "text": v["text"].strip()} for v in match[0]["verses"]]
    if only:
        verses = [v for v in verses if v["verse"] in only]
        missing = only - {v["verse"] for v in verses}
        if missing:
            print(f"ERROR: requested verse(s) not in chapter {chapter}: {sorted(missing)}", file=sys.stderr)
            sys.exit(1)

    empty = [v["verse"] for v in verses if not v["text"]]
    if empty:
        print(f"ERROR: empty verse text for verse(s) {empty} in {path}", file=sys.stderr)
        sys.exit(1)

    return verses


MAX_ATTEMPTS = 4


def synthesize_verse(api_key: str, voice_id: str, text: str, model_id: str, settings: dict) -> bytes:
    """Synthesize one verse, retrying transient network/5xx/429 failures.

    Sustained runs hit read timeouts and connection resets from the API; those
    are worth retrying. A 4xx other than 429 is a real error, so fail fast.
    """
    last = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return _post_tts(api_key, voice_id, text, model_id, settings)
        except RetryableError as e:
            last = e
            if attempt == MAX_ATTEMPTS:
                break
            backoff = 2 ** attempt  # 2s, 4s, 8s
            print(f"[retry {attempt}/{MAX_ATTEMPTS - 1} in {backoff}s: {e}]", end=" ", flush=True)
            time.sleep(backoff)
    raise RuntimeError(f"giving up after {MAX_ATTEMPTS} attempts: {last}")


class RetryableError(Exception):
    pass


def _post_tts(api_key: str, voice_id: str, text: str, model_id: str, settings: dict) -> bytes:
    url = f"{API_BASE}/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": model_id,
        "output_format": OUTPUT_FORMAT,
        "voice_settings": settings,
    }
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=120)
    except requests.exceptions.RequestException as e:
        raise RetryableError(str(e)) from e

    if resp.status_code == 200:
        return resp.content
    if resp.status_code == 429 or resp.status_code >= 500:
        raise RetryableError(f"HTTP {resp.status_code}: {resp.text[:200]}")
    raise RuntimeError(f"ElevenLabs API error {resp.status_code}: {resp.text[:500]}")


def parse_args():
    p = argparse.ArgumentParser(description="Generate Tamil verse audio via ElevenLabs.")
    p.add_argument("--chapter", required=True,
                   help="Chapter number, comma-separated list (1,2,3), or 'all'.")
    p.add_argument("--source", default=DEFAULT_SOURCE, help=f"Verse JSON (default: {DEFAULT_SOURCE})")
    p.add_argument("--verses", help="Comma-separated verse numbers, e.g. 1,5,11. Default: all.")
    p.add_argument("--dry-run", action="store_true", help="Validate inputs and print plan; make no API calls.")
    p.add_argument("--force", action="store_true", help="Re-synthesize verses whose MP3 already exists.")
    p.add_argument("--model", choices=sorted(MODELS), default=DEFAULT_MODEL,
                   help=f"TTS model (default: {DEFAULT_MODEL}). 'flash' bills at half rate.")
    p.add_argument("--output-dir", default=OUTPUT_DIR, help=f"Where MP3s are written (default: {OUTPUT_DIR}).")
    p.add_argument("--suffix", default="", help="Appended to filenames, e.g. --suffix _flash for A/B tests.")
    p.add_argument("--stability", type=float, help="0.0-1.0 (default 0.5). Lower = more expressive.")
    p.add_argument("--similarity", type=float, help="0.0-1.0 (default 0.75).")
    p.add_argument("--style", type=float, help="0.0-1.0 (default 0.3). 0 is flattest/safest.")
    p.add_argument("--speed", type=float, help="0.7-1.2 (default 1.0). Lower = slower narration.")
    return p.parse_args()


def resolve_chapters(path: str, spec: str):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    available = sorted(c["chapter"] for c in data.get("chapters", []))
    if spec.strip().lower() == "all":
        return available
    return [int(x) for x in spec.split(",")]


def main():
    args = parse_args()
    only = {int(x) for x in args.verses.split(",")} if args.verses else None
    chapters = resolve_chapters(args.source, args.chapter)
    if only and len(chapters) > 1:
        print("ERROR: --verses only makes sense with a single chapter.", file=sys.stderr)
        sys.exit(1)
    model_id, rate = MODELS[args.model]

    settings = dict(DEFAULT_VOICE_SETTINGS)
    for flag, key in [("stability", "stability"), ("similarity", "similarity_boost"),
                      ("style", "style"), ("speed", "speed")]:
        val = getattr(args, flag)
        if val is not None:
            settings[key] = val
    if not 0.7 <= settings["speed"] <= 1.2:
        print(f"ERROR: --speed must be between 0.7 and 1.2 (got {settings['speed']}).", file=sys.stderr)
        sys.exit(1)
    for key in ("stability", "similarity_boost", "style"):
        if not 0.0 <= settings[key] <= 1.0:
            print(f"ERROR: {key} must be between 0.0 and 1.0 (got {settings[key]}).", file=sys.stderr)
            sys.exit(1)

    if args.dry_run:
        total_chars = total_verses = 0
        print(f"DRY RUN — {BOOK_SLUG}, model: {model_id}, chapters: {chapters}")
        for ch in chapters:
            vs = load_verses(args.source, ch, only)
            chars = sum(len(v["text"]) for v in vs)
            print(f"  ch {ch:>2}: {len(vs):>3} verses, {chars:>6} chars")
            total_chars += chars
            total_verses += len(vs)
        credits = int(total_chars * rate)
        print(f"\n{total_verses} verse(s), {total_chars} characters total.")
        print(f"Model {model_id} bills {rate} credit/char -> ~{credits} credits "
              f"(~${credits * 0.0001:.2f} pay-as-you-go).")
        print(f"Voice settings: {settings}")
        print("No API calls made. Drop --dry-run to generate.")
        return

    api_key = get_env_or_die("ELEVENLABS_API_KEY")
    voice_id = get_env_or_die("ELEVENLABS_VOICE_ID")

    os.makedirs(args.output_dir, exist_ok=True)
    print(f"model={model_id} settings={settings}")

    grand_ok = grand_total = 0
    for chapter in chapters:
        verses = load_verses(args.source, chapter, only)
        print(f"\n=== {BOOK_SLUG} chapter {chapter}: {len(verses)} verse(s) ===")
        results = generate_chapter(args, chapter, verses, api_key, voice_id, model_id, settings)
        grand_ok += sum(1 for r in results if r["status"] == "ok")
        grand_total += len(results)

    print(f"\nALL DONE: {grand_ok}/{grand_total} verses across {len(chapters)} chapter(s).")
    if grand_ok < grand_total:
        sys.exit(1)


def generate_chapter(args, chapter, verses, api_key, voice_id, model_id, settings):
    results = []
    for v in verses:
        n = v["verse"]
        text = v["text"]
        out_path = os.path.join(args.output_dir, f"{BOOK_SLUG}_{chapter}_v{n}{args.suffix}.mp3")

        if os.path.exists(out_path) and not args.force:
            print(f"  Verse {n}: exists, skipping (--force to overwrite) -> {out_path}")
            results.append({"verse": n, "file": out_path, "status": "ok", "skipped": True})
            continue

        print(f"  Verse {n}: synthesizing ({len(text)} chars)...", end=" ", flush=True)
        try:
            audio_bytes = synthesize_verse(api_key, voice_id, text, model_id, settings)
            with open(out_path, "wb") as f:
                f.write(audio_bytes)
            print(f"OK ({len(audio_bytes) / 1024:.1f} KB) -> {out_path}")
            results.append({"verse": n, "file": out_path, "status": "ok"})
        except Exception as e:
            print(f"FAILED: {e}")
            results.append({"verse": n, "file": None, "status": "failed", "error": str(e)})

        time.sleep(0.5)  # be polite to the API / avoid rate limits

    manifest_path = os.path.join(args.output_dir, f"generation_manifest_ch{chapter}.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"book": BOOK_SLUG, "chapter": chapter, "model": model_id,
                   "voice_settings": settings, "results": results}, f,
                  ensure_ascii=False, indent=2)

    ok_count = sum(1 for r in results if r["status"] == "ok")
    print(f"  chapter {chapter}: {ok_count}/{len(results)} ok -> {manifest_path}")
    return results


if __name__ == "__main__":
    main()
