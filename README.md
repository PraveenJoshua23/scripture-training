# Scripture Training

A verse-memorisation web app for Revelation, in English and Tamil. Four training
modes, a graded test, a missed-verse notebook, and streak tracking. No accounts,
no backend: progress lives in `localStorage`.

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
| `npm run cf:preview` | Build and preview the Cloudflare Worker locally |
| `npm run cf:deploy` | Build and deploy to Cloudflare |

## Verse text and licensing

The app ships two verse-aligned datasets (22 chapters, 404 verses each). The
Tamil one is built by `scripts/build-verses.mjs` from the open
[Bible-Database](https://github.com/godlytalias/Bible-Database) dumps; the
English one no longer is — see below.

| Language | Version | Status |
| --- | --- | --- |
| English | New American Standard Bible (NASB1995) | © The Lockman Foundation — **no licence secured** |
| Tamil | பரிசுத்த வேதாகமம் O.V. (Union Version) | Public domain base text |

**On NASB1995:** the English dataset currently holds NASB1995 text, swapped in
by [`b26ccf3`](https://github.com/PraveenJoshua23/scripture-training/commit/b26ccf3).
That translation is under active copyright held by the Lockman Foundation, and
reproducing a whole book of it — including by scraping it into a local dataset —
goes beyond what an "internal use only" framing covers. A licence enquiry is
drafted at [`docs/nasb-permission-request.md`](docs/nasb-permission-request.md)
but has not been sent, so **this text is unlicensed until it is**.

Two ways back to a clean footing, whichever suits: send the enquiry and hold the
text privately until it is answered, or rebuild the English dataset from the
public-domain KJV — `npm run verses` does exactly that, since
`scripts/build-verses.mjs` still points at the KJV source. The previous KJV text
is also kept verbatim at `public/data/rev.en.kjv.backup.json`, so switching back
is a file copy.

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

Voice recitation needs the Web Speech API (Chrome, Edge, Safari — not Firefox)
and listening mode needs `speechSynthesis`; Tamil TTS voice availability varies
by platform. Both modes degrade with a message rather than breaking.

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
