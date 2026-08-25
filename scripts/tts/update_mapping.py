#!/usr/bin/env python3
"""
Update the app's verse-to-audio mapping with the new CDN URLs.

This default implementation updates a JSON config file at MAPPING_FILE,
structured as:
    {
      "revelation": {
        "4": {
          "1": "https://cdn.example.com/audio/tamil/revelation/4/revelation_4_v1.mp3",
          "2": "...",
          ...
        }
      }
    }

If your app actually stores this mapping in a database instead of a JSON
config, replace `write_json_mapping()` below with a DB call — the shape
of `verse -> url` pairs from upload_manifest.json stays the same either way.
Share your table/column schema and I'll adapt this function directly.

Usage:
    python update_mapping.py
"""

import os
import sys
import json

UPLOAD_MANIFEST = "output/upload_manifest.json"
# Written into public/ so the Next.js app can fetch it alongside rev.ta.json.
MAPPING_FILE = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                 "public", "data", "verse_audio_mapping.json")
)


def write_json_mapping(book_key: str, chapter_key: str, verse_urls: dict):
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, "r", encoding="utf-8") as f:
            mapping = json.load(f)
    else:
        mapping = {}

    mapping.setdefault(book_key, {})
    mapping[book_key][chapter_key] = verse_urls

    with open(MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print(f"Updated {MAPPING_FILE}: {book_key}.{chapter_key} -> {len(verse_urls)} verse(s)")


def main():
    if not os.path.exists(UPLOAD_MANIFEST):
        print(f"ERROR: {UPLOAD_MANIFEST} not found. Run upload_to_cdn.py first.", file=sys.stderr)
        sys.exit(1)

    with open(UPLOAD_MANIFEST, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    verse_urls = {
        str(r["verse"]): r["url"]
        for r in manifest["results"]
        if r["status"] == "ok" and r["url"]
    }

    if not verse_urls:
        print("No successful uploads to map.", file=sys.stderr)
        sys.exit(1)

    write_json_mapping(manifest["book"], str(manifest["chapter"]), verse_urls)


if __name__ == "__main__":
    main()
