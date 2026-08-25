#!/usr/bin/env python3
"""
Look up the exact voice_id for "Bhavatharini" (or search any name) on your
ElevenLabs account. Voice display names don't always match search terms
exactly, so this prints all voices and highlights close matches.

Usage:
    export ELEVENLABS_API_KEY="your-key-here"
    python find_voice_id.py [search_term]
"""

import os
import sys
import requests

from _env import load_env

load_env()

API_BASE = "https://api.elevenlabs.io/v1"


def main():
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("ERROR: set ELEVENLABS_API_KEY", file=sys.stderr)
        sys.exit(1)

    search_term = sys.argv[1].lower() if len(sys.argv) > 1 else "bhavatharini"

    resp = requests.get(
        f"{API_BASE}/voices",
        headers={"xi-api-key": api_key},
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"ElevenLabs API error {resp.status_code}: {resp.text[:500]}", file=sys.stderr)
        sys.exit(1)

    voices = resp.json().get("voices", [])
    print(f"Found {len(voices)} voice(s) on this account.\n")

    matches = []
    for v in voices:
        name = v.get("name", "")
        vid = v.get("voice_id", "")
        labels = v.get("labels", {})
        line = f"  {name!r:30s} id={vid}  labels={labels}"
        print(line)
        if search_term in name.lower():
            matches.append((name, vid))

    print()
    if matches:
        print(f"Matches for '{search_term}':")
        for name, vid in matches:
            print(f"  -> {name}: {vid}")
        print(f"\nSet: export ELEVENLABS_VOICE_ID=\"{matches[0][1]}\"")
    else:
        print(
            f"No voice matched '{search_term}'. If 'Bhavatharini' isn't listed, "
            "it may not be on your plan/library — check the ElevenLabs Voice "
            "Library and add it to 'My Voices' first, or use Instant Voice "
            "Cloning / a similar Tamil-capable voice instead."
        )


if __name__ == "__main__":
    main()
