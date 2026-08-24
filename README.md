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
