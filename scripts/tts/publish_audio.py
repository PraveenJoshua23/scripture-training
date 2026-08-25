#!/usr/bin/env python3
"""
Copy generated MP3s into public/audio/ and write the manifest the app reads.

This is the alternative to upload_to_cdn.py + update_mapping.py: the whole book
is ~35 MB, which Cloudflare serves fine as static assets, so no bucket needed.

    python3 publish_audio.py            # publish every generation_manifest_ch*.json
    python3 publish_audio.py --lang ta  # language the audio was generated for

Layout:
    public/audio/ta/revelation/4/1.mp3
    public/audio/manifest.json   ->  {"ta": {"4": [1, 2, 3, ...]}}
"""

import os
import sys
import json
import glob
import shutil
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "..", "tts-output"))
PUBLIC_AUDIO = os.path.normpath(os.path.join(HERE, "..", "..", "public", "audio"))
MANIFEST = os.path.join(PUBLIC_AUDIO, "manifest.json")


def parse_args():
    p = argparse.ArgumentParser(description="Publish generated MP3s into public/audio/.")
    p.add_argument("--lang", default="ta", help="Language code the audio is for (default: ta).")
    p.add_argument("--book", default="revelation", help="Book slug (default: revelation).")
    p.add_argument("--output-dir", default=OUTPUT_DIR, help="Where the generated MP3s live.")
    return p.parse_args()


def main():
    args = parse_args()

    manifests = sorted(glob.glob(os.path.join(args.output_dir, "generation_manifest_ch*.json")))
    if not manifests:
        print(f"ERROR: no generation_manifest_ch*.json in {args.output_dir}. "
              f"Run tts_generate.py first.", file=sys.stderr)
        sys.exit(1)

    # Merge into any existing manifest so publishing one chapter doesn't drop the rest.
    index = {}
    if os.path.exists(MANIFEST):
        with open(MANIFEST, "r", encoding="utf-8") as f:
            index = json.load(f)
    index.setdefault(args.lang, {})

    copied = skipped = 0
    for path in manifests:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        chapter = data["chapter"]
        dest_dir = os.path.join(PUBLIC_AUDIO, args.lang, args.book, str(chapter))
        os.makedirs(dest_dir, exist_ok=True)

        verses = []
        for r in data["results"]:
            if r["status"] != "ok" or not r.get("file"):
                skipped += 1
                continue
            src = r["file"] if os.path.isabs(r["file"]) else os.path.join(args.output_dir, os.path.basename(r["file"]))
            if not os.path.exists(src):
                print(f"  WARN: missing {src}", file=sys.stderr)
                skipped += 1
                continue
            shutil.copy2(src, os.path.join(dest_dir, f"{r['verse']}.mp3"))
            verses.append(r["verse"])
            copied += 1

        if verses:
            index[args.lang][str(chapter)] = sorted(verses)
            print(f"  ch {chapter:>2}: {len(verses)} file(s) -> {dest_dir}")

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2, sort_keys=True)

    total = sum(len(v) for v in index[args.lang].values())
    print(f"\nCopied {copied} file(s){f', skipped {skipped}' if skipped else ''}.")
    print(f"Manifest: {MANIFEST} ({total} verse(s) for '{args.lang}')")


if __name__ == "__main__":
    main()
