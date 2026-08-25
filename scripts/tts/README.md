# Tamil TTS Pipeline (ElevenLabs)

Generates per-verse Tamil MP3 narration via ElevenLabs and uploads it to
S3-compatible storage (AWS S3 or Cloudflare R2), then updates a verse→URL
mapping file.

Verse text is read **directly from `public/data/rev.ta.json`** (the app's own
Tamil text, TAOV / public domain) — there is no placeholder file to fill in.

## Setup

```bash
pip3 install requests boto3
cp ../../.env.example ../../.env   # then fill in the values
```

Credentials are read from `scripture-training/.env`, which is gitignored.
Real environment variables override the file, so you can do a one-off:

```bash
ELEVENLABS_VOICE_ID=other python3 tts_generate.py --chapter 4
```

## Run order

```bash
# 1. Confirm the voice exists on your account
python3 find_voice_id.py bhavatharini

# 2. See what would be generated + the credit cost, without spending any
python3 tts_generate.py --chapter 4 --dry-run

# 3. Generate one verse first and listen to it before committing to the chapter
python3 tts_generate.py --chapter 4 --verses 1

# 4. Generate the rest (already-generated files are skipped unless --force)
python3 tts_generate.py --chapter 4
# -> output/revelation_4_v1.mp3 ... v11.mp3, output/generation_manifest.json

# 5. Upload to CDN
python3 upload_to_cdn.py
# -> output/upload_manifest.json (verse -> public URL)

# 6. Update the app's verse-to-audio mapping
python3 update_mapping.py
# -> public/data/verse_audio_mapping.json
```

## Notes

- `--dry-run` prints the exact character count; ElevenLabs bills ~1 credit per
  character, so chapter 4 costs ≈2,163 credits.
- Object ACLs are **not** set by default: Cloudflare R2 rejects `ACL:public-read`
  outright, and AWS S3 buckets with "bucket owner enforced" ownership do too.
  Grant public read via bucket policy / custom domain instead. Set
  `CDN_SET_PUBLIC_ACL=1` only for a legacy bucket that genuinely needs the ACL.
- Rate limiting: 0.5s pause between ElevenLabs calls. Adjust for your plan.
- **The app does not consume `verse_audio_mapping.json` yet.** `src/app/listening/page.tsx`
  currently uses the browser's `speechSynthesis`. Wiring the listening page to
  prefer pre-generated MP3s (falling back to speechSynthesis) is a separate change.
