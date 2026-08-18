# Scripture Training

A verse-memorisation web app for Revelation, in English and Tamil — modelled on
[말씀 훈련소](https://bible-training.pages.dev/). Four training modes, a graded test,
a missed-verse notebook, and streak tracking. No accounts, no backend: progress
lives in `localStorage`.

## Running it

```bash
npm install
npm run verses   # fetch + build the verse datasets into public/data/
npm run dev
```

Then open http://localhost:3000.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run verses` | Rebuild `public/data/rev.*.json` from source |
| `npm run check` | Run the scoring / progress / range logic checks |
| `npm run cf:preview` | Build and preview the Cloudflare Worker locally |
| `npm run cf:deploy` | Build and deploy to Cloudflare |

## Verse text and licensing

The app ships two verse-aligned datasets (22 chapters, 404 verses each), built
by `scripts/build-verses.mjs` from the open
[Bible-Database](https://github.com/godlytalias/Bible-Database) dumps:

| Language | Version | Status |
| --- | --- | --- |
| English | King James Version (KJV) | Public domain |
| Tamil | பரிசுத்த வேதாகமம் O.V. (Union Version) | Public domain base text |

**On NASB1995:** the app does *not* ship NASB1995 text. That translation is
under active copyright held by the Lockman Foundation, and reproducing a whole
book of it — including by scraping it into a local dataset — is a reproduction
the "internal use only" framing doesn't cover. The PRD's own success criteria
call for zero copyrighted verse text without a confirmed licence, so the app
uses public-domain texts instead.

If you obtain a NASB1995 licence (or any other translation you hold rights to),
the app can use it without any code changes — see below.

### Adding another translation

Drop a JSON file at `public/data/rev.<lang>.json` matching this shape:

```json
{
  "lang": "en",
  "version": "NASB1995",
  "versionLabel": "New American Standard Bible 1995",
  "license": "Licensed from The Lockman Foundation",
  "book": "Revelation",
  "bookId": "revelation",
  "chapters": [{ "chapter": 1, "verses": [{ "v": 1, "text": "…" }] }]
}
```

The `versionLabel` and `license` fields are what the in-app footer displays.
Datasets must be verse-aligned with each other (same verse counts per chapter),
or switching languages mid-practice would move the reader to a different verse;
`npm run check` verifies this.

## How it's put together

```
src/lib/       verses.ts (loading, ranges, navigation)
               text.ts (tokenising, LCS scoring, blank selection)
               progress.ts (localStorage, streaks, missed verses)
               settings.ts, i18n.ts, speech.ts, store.tsx
src/app/       one route per mode: typing, blanks, voice, listening, test, review
src/components/ PracticeShell (shared chrome), VersePicker, ScoreView, …
scripts/       build-verses.mjs (dataset build), check-logic.ts (logic checks)
```

A few decisions worth knowing:

- **Scoring** aligns words by longest common subsequence, so one dropped word
  shifts a single token instead of marking the rest of the verse wrong.
  Comparison ignores case and punctuation.
- **A verse counts as complete** at 90% accuracy (`PASS_THRESHOLD`), tracked
  per mode. Falling short logs it to the missed-verse notebook; passing later
  resolves it.
- **Streaks** advance once per local day, on the first verse cleared that day.
- **Tamil letters** are grapheme clusters, so the first-letter hint level uses
  `Intl.Segmenter` rather than slicing by code unit.
- **Blank positions** are deterministic per verse and density, so blanks don't
  reshuffle on every render.

## Browser support

Voice recitation needs the Web Speech API (Chrome, Edge, Safari — not Firefox)
and listening mode needs `speechSynthesis`; Tamil TTS voice availability varies
by platform. Both modes degrade with a message rather than breaking.

## Deploying

Configured for Cloudflare Workers via `@opennextjs/cloudflare` (rather than a
static export) so server routes and a database can be added later without
re-platforming. `npm run cf:deploy` builds and deploys; it needs `wrangler`
to be authenticated against your Cloudflare account first.
