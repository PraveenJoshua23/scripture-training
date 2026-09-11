# Scripture Training

A verse-memorisation app for Revelation, in English and Tamil. Four training
modes, a graded test, a missed-verse notebook, and streak tracking. No accounts,
no backend: progress lives in `localStorage`. It runs on the web and, wrapped in
a WebView by Capacitor, ships as an Android APK — see [Android](#android-apk).

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
| `npm run help:capture` | Regenerate the `/help` screenshots and callout positions |
| `npm run cf:preview` | Build and preview locally, including the transcription endpoint |
| `npm run cf:deploy` | Build and deploy to Cloudflare |
| `npm run android:apk` | Build, copy into the Android project, assemble the APK |

## Verse text and licensing

The app ships two verse-aligned datasets (22 chapters, 404 verses each). The
Tamil one is built by `scripts/build-verses.mjs` from the open
[Bible-Database](https://github.com/godlytalias/Bible-Database) dumps; the
English one no longer is — see below.

| Language | Version | Status |
| --- | --- | --- |
| English | New American Standard Bible (NASB1995) | © The Lockman Foundation — licensed, attribution required |
| Tamil | பரிசுத்த வேதாகமம் O.V. (Union Version) | Public domain base text |

**On NASB1995:** the English dataset holds NASB1995 text, swapped in by
[`b26ccf3`](https://github.com/PraveenJoshua23/scripture-training/commit/b26ccf3).
The Lockman Foundation has granted permission to use it.

That permission is conditional on the copyright notice appearing on every page.
[`Footer.tsx`](src/components/Footer.tsx) renders it whenever the active dataset
is NASB, including the clickable link to www.Lockman.org — keep both in place
when changing the footer.

`scripts/build-verses.mjs` still points at a public-domain KJV source, so
`npm run verses` rebuilds the English dataset as KJV rather than NASB. It is
there for adding languages, not for refreshing the English text.

### Adding another translation

Drop a JSON file at `public/data/rev.<lang>.json` matching this shape:

```json
{
  "lang": "en",
  "version": "WEB",
  "versionLabel": "World English Bible",
  "license": "Public domain",
  "book": "Revelation",
  "bookId": "revelation",
  "chapters": [{ "chapter": 1, "verses": [{ "v": 1, "text": "…" }] }]
}
```

The `versionLabel` and `license` fields are what the in-app footer displays.
Datasets must be verse-aligned with each other (same verse counts per chapter),
or switching languages mid-practice would move the reader to a different verse;
`npm run check` verifies this.

Swapping the text of a language the app already knows about stops there. Adding
a *new* language needs the code changes below.

## Adding a language

Say you're adding Hindi (`hi`). A dataset alone isn't enough — the language code
is a union type, and several tables are keyed by it, so the compiler will point
at most of what follows if you start from step 1.

**1. The dataset.** Either add a source to `SOURCES` in
[`scripts/build-verses.mjs`](scripts/build-verses.mjs) and run `npm run verses`,
or hand-write `public/data/rev.hi.json` in the shape shown above. Either way it
must be verse-aligned with the others: 22 chapters, 404 verses, same counts per
chapter.

**2. The language code.** Add it to `Lang` in
[`src/lib/types.ts`](src/lib/types.ts). Everything below is a `Record<Lang, …>`
or a `Lang`-keyed object, so `tsc` now fails until each is filled in — that is
the intended way to find them.

**3. UI strings.** Add a `hi:` block to `strings` in
[`src/lib/i18n.ts`](src/lib/i18n.ts). `StringKey` is derived from the `en` block
and `t()` indexes across all languages, so a key you forget is a compile error —
you cannot ship a half-translated block. (`t()` also falls back to the English
string at runtime, but that is a belt-and-braces guard, not a licence to skip
keys.)

**4. The language toggle.** Add the code to the array in
[`src/components/Nav.tsx`](src/components/Nav.tsx) (`['en', 'ta']`) and give it a
button label in its own script.

**5. Font and text styling.** Latin serif faces carry no Devanagari, Tamil, or
Arabic glyphs, so a script without its own face falls back to whatever the OS
picks and renders conjuncts inconsistently. Load a face in
[`src/app/layout.tsx`](src/app/layout.tsx) via `next/font/google`, expose it as a
CSS variable, and add a `.scripture-hi` rule in
[`src/app/globals.css`](src/app/globals.css) next to `.scripture-ta`. Scripts
with tall stacked marks usually want a looser `line-height`, as Tamil does.

**6. Speech.** Two tables in [`src/lib/speech.ts`](src/lib/speech.ts): `BCP47`
maps the code to a recognition locale (`hi-IN`), and `PREFERRED_VOICE` names the
`speechSynthesis` voice to read it in. Both modes degrade with a message where
the platform has no voice, so an imperfect guess here is safe.

**7. Grapheme handling.** `firstGrapheme` in
[`src/lib/text.ts`](src/lib/text.ts) uses `Intl.Segmenter` for Tamil, because a
Tamil letter is a cluster of code points and slicing by code unit splits a vowel
sign off its consonant. Any Indic or other complex script needs the same
treatment — extend the condition rather than adding a second branch.

**8. Checks.** `npm run check` asserts Tamil is verse-aligned with English; add
the same assertion for the new dataset in
[`scripts/check-logic.ts`](scripts/check-logic.ts). Then `npm run lint` and
`npm run build`.

Narration audio is optional and independent of all of this — the listening mode
falls back to `speechSynthesis` wherever no MP3 exists.

## Narration audio

Listening mode prefers a pre-generated MP3 per verse and falls back to the
browser's `speechSynthesis` when there isn't one, which is why generating audio
is optional and can be done a chapter at a time. The pipeline lives in
[`scripts/tts/`](scripts/tts/) and uses [ElevenLabs](https://elevenlabs.io);
`scripts/tts/README.md` covers it in more detail.

Verse text is read straight from the app's own dataset, so there is no separate
file to keep in sync.

```bash
pip3 install requests boto3
cp .env.example .env        # then fill in ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID
cd scripts/tts
```

Real environment variables win over `.env`, so a one-off run can override any
value inline. Then, per chapter:

```bash
python3 tts_generate.py --chapter 4 --dry-run   # prints the plan and credit cost, spends nothing
python3 tts_generate.py --chapter 4 --verses 1  # listen to one before buying a chapter
python3 tts_generate.py --chapter 4             # the rest; existing files are skipped unless --force
python3 publish_audio.py --lang ta              # copy into public/audio/ and update the manifest
```

MP3s are written to `../../../tts-output/` (a sibling of the repo, not inside it)
— deliberately **outside** version control, so a stray `git clean` can't delete
audio that cost real credits. `publish_audio.py`
copies them to `public/audio/<lang>/revelation/<chapter>/<verse>.mp3` and merges
`public/audio/manifest.json`, which is the only thing the app reads
([`src/lib/audio.ts`](src/lib/audio.ts)). Publishing one chapter never drops the
others from the manifest.

`upload_to_cdn.py` + `update_mapping.py` are an alternative path that puts the
audio in S3/R2 instead. The whole book is ~35 MB, which Cloudflare serves fine as
static assets, so the bucket isn't needed — but the scripts are there if the
audio outgrows the repo.

### Generating audio for another language

Nothing in the pipeline is Tamil-specific except the defaults. Point
`--source` at the other dataset and tell `publish_audio.py` which language it
was for:

```bash
python3 tts_generate.py --chapter 4 --source ../../public/data/rev.hi.json \
                        --output-dir ../../../tts-output-hi
python3 publish_audio.py --lang hi --output-dir ../../../tts-output-hi
```

Get the language right in **both** commands. `--source` decides which text is
sent to ElevenLabs; `--lang` decides where the files land and how the manifest
is keyed. Mismatch them and you get correct audio filed under the wrong
language, which the app will happily play over the wrong verses.

Give each language its own `--output-dir`, as above. `publish_audio.py` publishes
*every* `generation_manifest_ch*.json` it finds in that directory under the one
`--lang` you passed — so a shared output directory means yesterday's Tamil
chapters get copied into `public/audio/hi/` the next time you publish Hindi. The
files are named by chapter and verse only; nothing in them records the language.

Use a voice that actually speaks the target language — ElevenLabs' multilingual
models will read any script with whatever voice you hand them, and a
monolingual English voice reading Hindi is intelligible enough to pass a glance
and wrong enough to be useless for memorisation. Generate one verse and listen
before spending on a chapter.

Two more knobs worth knowing: `--model` picks between `v3` (default, best
quality), `multilingual`, and `flash` (half the credits per character), and
`--suffix` keeps A/B outputs apart (`--suffix _flash`). ElevenLabs bills roughly
one credit per character, and `--dry-run` prints the exact count before you
commit — chapter 4 comes to ≈2,163, but chapter length varies enough that it is
worth checking each time.

### Finding a voice id

`ELEVENLABS_VOICE_ID` is the voice's id, not its display name. Two ways to get
it.

**From the terminal** — lists every voice on the account and highlights name
matches:

```bash
cd scripts/tts
python3 find_voice_id.py            # defaults to searching "bhavatharini"
python3 find_voice_id.py sarah      # or any search term
```

It prints each voice's name, id, and labels, then the `export` line to copy. It
only sees voices already in **My Voices**, so a voice you have merely browsed in
the Voice Library won't appear — add it to your account first.

**From the ElevenLabs site** — go to [Voices](https://elevenlabs.io/app/voices),
browse the Voice Library, and add a voice you like to My Voices. Each voice card
there offers a copy-voice-ID action in its overflow menu, and the id also appears
in the URL while the voice is open. Either way it is the same value the API
returns: `GET https://api.elevenlabs.io/v1/voices` with an `xi-api-key` header,
which is exactly what `find_voice_id.py` wraps.

Pick by language coverage first and timbre second. The Voice Library can be
filtered by language, and voice cards list the languages the voice was trained
on — a voice with the target language listed will pronounce it markedly better
than one relying on the multilingual model alone.

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

## The help page

`/help` explains every screen with a screenshot and numbered callouts, written
for readers who have not used an app like this before. Two things make it
maintainable:

- **The screenshots carry no drawing.** They are plain PNGs in `public/help/`.
  The numbered boxes are HTML positioned over the image from
  `src/lib/help-hotspots.json`, so one image serves English and Tamil alike and
  the labels translate like any other string.
- **The callout positions are measured, not hand-placed.** Every control a
  callout points at carries a `data-help="…"` attribute.
  `npm run help:capture` builds the static export, serves it, drives each
  screen into the state worth showing, and records where those elements
  actually sit.

The images cost nothing until someone opens `/help`. Two things keep it that
way, and both are easy to undo by accident:

- Every link pointing at `/help` sets **`prefetch={false}`** (the nav tab, the
  home page link, and the `?` button on each practice screen). Without it,
  Next prefetches the route's RSC payload from every other page — and that
  payload carries the `<img>` tags, so the browser starts pulling a few hundred
  KB of screenshots on pages nobody asked for help from.
- The images are **`loading="lazy"`**, so opening `/help` fetches only the four
  or so shots near the viewport; the rest arrive as the reader scrolls.

So after any UI change that moves or renames one of those controls:

```
npm run help:capture
```

If a `data-help` attribute was renamed or removed, the run **fails** and names
the mark, rather than quietly dropping a callout from the guide. The shots and
the marks they carry are declared in the `SHOTS` array at the top of
`scripts/capture-help.ts`; the prose lives in `src/lib/help-content.ts`, where
each step is written in both languages side by side. Step *n* in a section
describes marker *n* of the shot above it, so the two lists stay aligned by
position.

The screenshots are captured at a phone width in the light theme, with the
English UI. Tamil readers get Tamil instructions over an English screenshot —
the numbers carry the meaning. Capturing a Tamil set as well would mean adding
a language axis to the script and doubling the images.

## Browser support

Two modes depend on the browser, and both degrade with a message rather than
breaking.

**Voice recitation** records with `MediaRecorder` and `getUserMedia`, then sends
the audio to Whisper. That is every current browser, Firefox included — the old
Web Speech API restriction went away with the move to Whisper. It does need a
secure context, so `getUserMedia` is unavailable over plain HTTP other than on
`localhost`.

**Listening** prefers the pre-generated narration in `public/audio/` and only
falls back to synthesis when a verse has none. On the web that is
`speechSynthesis`; the Android WebView does not implement it at all, so the app
speaks through the device's own TTS engine via
[`@capacitor-community/text-to-speech`](https://github.com/capacitor-community/text-to-speech)
instead. Both are behind `speak()` in [`src/lib/speech.ts`](src/lib/speech.ts),
which resolves when the utterance finishes so either backend can drive the same
advance-when-done logic. All 404 Tamil verses are
generated, so Tamil plays identically everywhere — which is what the generated
audio was for, since Tamil TTS voice availability varies by platform. English
has no generated audio and so still depends on `speechSynthesis` and whatever
voices the platform installs.

## Deploying

Deployed to Cloudflare Pages at
[scripture-training.pages.dev](https://scripture-training.pages.dev) as a static
export (`output: 'export'` in `next.config.ts`). A `*.pages.dev` hostname is
scoped to the project name, whereas a `*.workers.dev` one carries the account
name — which is why this is on Pages.

**Merging to `main` deploys to production**, via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The workflow runs
`npm run lint`, `npm run check`, and `npm run build`, then uploads `out/` to the
Pages project — so a merge that fails any of those gates never reaches the live
site. It can also be re-run by hand from the Actions tab without an empty commit.

This is a *direct-upload* Pages project, not a Git-connected one: Cloudflare does
not watch the repo, so this workflow is the only thing that makes a merge go
live. It needs two repository secrets:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The account ID shown by `npx wrangler whoami` |
| `CLOUDFLARE_API_TOKEN` | An API token with the **Cloudflare Pages: Edit** permission |

`npm run cf:deploy` still builds and deploys straight from a laptop, which is
useful for a hotfix; it needs `wrangler` authenticated locally first.

### The transcription endpoint

Voice recitation records audio and sends it to
[`functions/api/transcribe.ts`](functions/api/transcribe.ts), which transcribes
it with Whisper (`@cf/openai/whisper-large-v3-turbo`) on Workers AI. This is a
Pages Function: Pages deploys the `functions/` directory beside the static
export, so the app keeps `output: 'export'` and still gets one server endpoint.
`wrangler pages deploy out` picks `functions/` up automatically, so the existing
workflow needs no change.

It replaced the browser's own Web Speech API, which repeated words as they were
recognised and failed outright in browsers that block its recognition backend.

**The Android app calls this endpoint cross-origin**, from the WebView's own
`https://localhost`, and `audio/webm` is not a CORS-safelisted content type — so
the browser preflights the request. The Function answers that preflight for the
two Capacitor origins and echoes the header back on every response. The
allowlist is deliberate: each accepted request spends Workers AI neurons, so `*`
would hand the account's allocation to anyone. A new app origin (a custom
scheme, an iOS build on a different host) has to be added there or its
recitations fail with the connection error.

The `AI` binding is declared in `wrangler.jsonc`. Two consequences worth knowing:

- **`npm run dev` cannot serve it.** `next dev` knows nothing about
  `functions/`, so the endpoint 404s and the screen says so. Use
  `npm run cf:preview`, which runs `wrangler pages dev out --ai AI`.
- **Local runs bill the real account.** Workers AI has no local emulation —
  even `cf:preview` runs inference against Cloudflare.

Cost: the Workers AI free allocation is 10,000 Neurons/day, and this model costs
46.63 Neurons per audio minute — roughly 3.5 hours of recitation a day before
anything is billable.

### Android (APK)

The same static export is wrapped in an Android WebView by Capacitor, so there
is no second codebase: `capacitor.config.ts` points `webDir` at `out/`, and
`npx cap sync` copies that build into `android/`.

```bash
npm run android:apk   # build, sync, and assemble
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`, ~78 MB.
Building it needs the Android SDK and a JDK — installing Android Studio gets
both, the JDK as the JetBrains Runtime *inside* the app bundle rather than on
the system, so `java -version` still finds nothing and `JAVA_HOME` has to point
at it:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

Gradle also needs `android/local.properties` with `sdk.dir` set to the SDK
location (`~/Library/Android/sdk` on macOS). It is machine-specific and
gitignored, so each clone writes its own.

To build from Android Studio instead, run `npx cap sync android` first so it
picks up the current export.

To hand the APK to someone who just wants it on their phone, point them at
[docs/install-android.md](docs/install-android.md) — sideloading steps, the two
Play Protect warnings that are expected, and what does and does not work
offline.

### The app icon

`assets/icon-foreground.png` is the source; everything under `res/mipmap-*` is
generated from it and should not be edited by hand:

```bash
npx capacitor-assets generate --android
```

Two things about that source are easy to get wrong. The foreground carries the
symbol **on transparency with no tile of its own** — Android masks adaptive
icons into whatever shape the launcher uses, so a rounded square baked into the
artwork gets masked a second time and shows its corners. And the symbol should
**fill the canvas**, because `capacitor-assets` insets each layer by 16.7% to
place it in the safe zone itself; artwork pre-shrunk to the safe zone ends up
inset twice and reads as a small mark adrift in padding.

`icon-background.png` is a flat `#faf8f4`, the light theme's `--background`.
Keeping it distinct from the book's amber matters: the cross is a white shape
rather than a knockout, but the book's page edges do read against the
background, and an amber background would flatten them.

**The Gradle wrapper is pinned above what `cap add android` generates.**
Capacitor 8 writes a wrapper for Gradle 8.14.3, which runs on Java 24 at the
newest, while current Android Studio bundles JBR 25 — so the generated project
fails on a stock install with `Unsupported class file major version 69`. Gradle
9.1.0 is the first release that runs on Java 25, and Gradle 9's minimum
supported AGP is 8.4.0, comfortably below the 8.13.0 Capacitor pins. Capacitor's
own docs say Android Studio "will automatically install the proper JDK for
you", which is not currently true of the Gradle its template generates.

Two things differ from the web build:

- **The endpoint is absolute.** `functions/` is run by Pages, and the APK has no
  Pages. A relative `/api/transcribe` would resolve inside the bundle and 404,
  so `android:apk` sets `NEXT_PUBLIC_API_ORIGIN` and the transcription request
  goes back out to the deployed site. Web builds leave it unset and stay
  relative, exactly as before. **Recitation therefore needs a connection**, and
  the endpoint must be updated here if the app ever moves off `pages.dev`.
- **The audio ships inside the APK.** All 405 files, ~72 MB of it, which makes
  the install roughly 75 MB. That is the deliberate trade: Pages serves static
  assets with unlimited free bandwidth, so fetching them remotely would have
  cost nothing either — but memorisation happens on commutes and in quiet time,
  where a dead audio file is worse than a large one-time download. Everything
  except voice recitation works fully offline.

The microphone needs `RECORD_AUDIO` in `AndroidManifest.xml`; the WebView will
not grant `getUserMedia` unless the app itself holds the permission.

### Why still Pages, when Cloudflare points new projects at Workers

Cloudflare's current guidance is "if you are starting a new project, use Workers
instead of Pages" — Pages is not sunset and has no end date, but new features and
optimisations go to [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
and the Pages docs now carry a banner saying so. That is a real signal, and this
project will likely move eventually.

It has not moved yet because of the hostname. A Worker is served at
`<worker>.<account-subdomain>.workers.dev`, and this account's subdomain is
derived from the owner's email — so the public URL would carry a personal handle,
which is the specific thing [`915a505`](https://github.com/PraveenJoshua23/scripture-training/commit/915a505)
moved to Pages to avoid. Three ways out, whenever it is worth doing:

1. Change the account's workers.dev subdomain (Workers & Pages → **Change** next
   to *Your subdomain*). Note it is account-wide — every Worker on the account
   moves with it.
2. Serve from a custom domain and set `workers_dev: false`. This is what
   Cloudflare recommends for anything production, and it makes the whole question
   moot.
3. Stay on Pages until a custom domain exists anyway.

The migration itself is small for a static export: swap `pages_build_output_dir`
for `assets.directory` in `wrangler.jsonc`, and change the workflow's deploy
command from `pages deploy out --project-name=…` to plain `deploy`. One thing
does *not* carry over automatically — Pages infers 404 behaviour from the
presence of `404.html`, whereas Workers requires it to be explicit, so the
migration must also set `assets.not_found_handling` to `"404-page"` or the custom
404 silently stops being served.

**This target has no server.** Every route is prerendered and all state lives in
`localStorage`, so a static export costs nothing today. But the moment the app
needs a server route — an API handler, middleware, an auth callback, or a
database query — `output: 'export'` has to go, and the deployment moves to
Cloudflare Workers via `@opennextjs/cloudflare` (which is what this project used
before, so `git log` has a working reference). Pages Functions are the other
option, but the Next.js adapter for them is deprecated. Plan on Workers.
