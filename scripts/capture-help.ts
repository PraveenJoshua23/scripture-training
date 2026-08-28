/**
 * Regenerates the screenshots and callout coordinates behind /help.
 *
 *   npm run help:capture            # builds the static export and serves it
 *   npm run help:capture -- --url http://localhost:3000   # use a running server
 *
 * Screenshots are plain, unannotated PNGs; the numbered boxes drawn over them
 * on the help page come from `src/lib/help-hotspots.json`, which this script
 * writes by measuring the real elements in the page. That keeps one image
 * serving both languages and both themes, and keeps the callouts pinned to the
 * layout rather than to hand-tuned pixel values.
 *
 * Every element a callout points at carries a `data-help="…"` attribute. A mark
 * that no longer resolves fails the run rather than silently vanishing from the
 * guide, so a renamed or deleted control is caught here.
 */
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Page } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'out');
const IMAGE_DIR = path.join(ROOT, 'public', 'help');
const JSON_PATH = path.join(ROOT, 'src', 'lib', 'help-hotspots.json');

/** Phone-shaped, because that is what most readers will be holding. */
const VIEWPORT = { width: 390, height: 900 };
const SCALE = 1.5;
/** Shots grow to fit their callouts, within these bounds. */
const MIN_SHOT_HEIGHT = 520;
const MAX_SHOT_HEIGHT = 1500;

/** 0 lets the OS pick a free port, so an unrelated server can't collide. */
const PORT = Number(process.env.HELP_CAPTURE_PORT ?? 0);

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Shot {
  key: string;
  path: string;
  /** `data-help` keys to outline, in the order the help page numbers them. */
  marks: string[];
  /** Runs after load, before measuring — drive the UI into the state to show. */
  prepare?: (page: Page, verses: string[]) => Promise<void>;
  /** Extra selectors to hide before the shot. */
  hide?: string[];
  maxHeight?: number;
}

/** Pretend the attempt in the typing shot took this long, for a sane WPM. */
const TYPING_ELAPSED_MS = 15000;

/** A partly-typed attempt, with one word wrong, so the live colouring shows. */
function partialAttempt(text: string): string {
  const words = text.split(/\s+/);
  const upto = Math.max(4, Math.ceil(words.length * 0.55));
  const kept = words.slice(0, upto);
  if (kept.length > 3) kept[kept.length - 2] = 'servants';
  return kept.join(' ');
}

const SHOTS: Shot[] = [
  {
    key: 'home',
    path: '/',
    marks: ['modes', 'lang', 'theme', 'streak', 'progressBar', 'modeCounts', 'chapterGrid'],
  },
  {
    key: 'basics',
    path: '/typing',
    marks: ['ref', 'prev', 'next', 'peek', 'fontSize'],
    maxHeight: 560,
  },
  {
    key: 'typing',
    path: '/typing',
    marks: ['typingVerse', 'typingStats', 'typingInput', 'check'],
    prepare: async (page, verses) => {
      // Filling the box instantly would report a WPM in the thousands. Pinning
      // the clock either side of the fill makes the speed read as a plausible
      // ~60 WPM, and makes it the same on every run.
      await page.evaluate(() => {
        const base = Date.now();
        (window as unknown as { __base: number }).__base = base;
        Date.now = () => base;
      });
      await page.fill('[data-help="typingInput"]', partialAttempt(verses[0]));
      await page.evaluate((ms) => {
        const base = (window as unknown as { __base: number }).__base;
        Date.now = () => base + ms;
      }, TYPING_ELAPSED_MS);
      await page.waitForTimeout(400);
    },
  },
  {
    key: 'blanks1',
    path: '/blanks',
    marks: ['blankLevels', 'blankDensity', 'blankBoard', 'blankBank'],
    prepare: async (page, verses) => {
      await setLevel(page, 1);
      // Fill the first blank so the shot shows a filled gap next to empty ones.
      // It has to be the *right* word — a guide that pictures a wrong answer
      // teaches the wrong answer. `data-blank-index` is the word's position in
      // the verse, which is what makes the correct chip identifiable here.
      const slot = page.locator('[data-blank-index]').first();
      const index = Number(await slot.getAttribute('data-blank-index'));
      const expected = verses[0].split(/\s+/).filter(Boolean)[index];
      const chip = page
        .locator('[data-help="blankBank"] button')
        .filter({ hasText: new RegExp(`^${escapeRegExp(expected)}$`) })
        .first();

      if ((await chip.count()) > 0) {
        await chip.click();
        await slot.click();
        await page.waitForTimeout(150);
      }
    },
  },
  {
    key: 'blanks2',
    path: '/blanks',
    marks: ['blankBoard'],
    prepare: (page) => setLevel(page, 2),
  },
  {
    key: 'blanks3',
    path: '/blanks',
    marks: ['blankBoard'],
    prepare: (page) => setLevel(page, 3),
  },
  {
    key: 'blanks4',
    path: '/blanks',
    marks: ['blankFull'],
    prepare: (page) => setLevel(page, 4),
  },
  {
    key: 'blanks5',
    path: '/blanks',
    marks: ['blankVoice'],
    prepare: (page) => setLevel(page, 5),
  },
  {
    key: 'voice',
    path: '/voice',
    marks: ['voiceRecord', 'voiceHeard', 'check'],
    prepare: async (page, verses) => {
      await page.evaluate((text) => {
        (window as unknown as { __helpTranscript?: string }).__helpTranscript = text;
      }, partialAttempt(verses[0]));
      await page.click('[data-help="voiceRecord"]');
      await page.waitForTimeout(300);
    },
  },
  {
    key: 'listening',
    path: '/listening',
    marks: ['listenModes', 'listenSpeed', 'listenPlay', 'listenList'],
    // The chapter list runs to every verse; four rows are enough to show what
    // it is, and keep the shot a readable height.
    hide: ['[data-help="listenList"] li:nth-child(n+5)'],
  },
  {
    key: 'testSetup',
    path: '/test',
    marks: ['testRange', 'testCount', 'testStart'],
    maxHeight: 620,
  },
  {
    key: 'testRun',
    path: '/test',
    marks: ['testCounter', 'testProgress', 'testRef', 'testInput', 'testSubmit'],
    prepare: async (page, verses) => {
      await page.click('[data-help="testStart"]');
      await page.fill('[data-help="testInput"]', partialAttempt(verses[0]));
    },
  },
  {
    key: 'testResult',
    path: '/test',
    marks: ['testScore', 'testMissed'],
    prepare: async (page, verses) => {
      await page.click('[data-help="testStart"]');
      // Default range is 1:1–1:5. Answer the first three well and the rest
      // poorly, so the result screen shows both a score and a missed list.
      for (let i = 0; i < 5; i++) {
        await page.fill('[data-help="testInput"]', i < 3 ? verses[i] : partialAttempt(verses[i]));
        await page.click('[data-help="testSubmit"]');
        await page.waitForTimeout(60);
      }
      await page.waitForSelector('[data-help="testScore"]');
    },
  },
  {
    key: 'review',
    path: '/review',
    marks: ['reviewList', 'reviewPractise', 'reviewClear'],
    maxHeight: 700,
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function setLevel(page: Page, level: number): Promise<void> {
  await page.locator('[data-help="blankLevels"] button').nth(level - 1).click();
  await page.waitForTimeout(200);
}

/**
 * Seeds storage and stubs the speech APIs. Runs before the app's own scripts,
 * so the first paint already has the state the screenshots need.
 *
 * Chromium ships no speech recognition, which would otherwise render the
 * "not supported" notice in place of every voice control.
 */
function initScript(today: string): string {
  const settings = {
    lang: 'en',
    theme: 'light',
    fontSize: 20,
    blankDensity: 0.2,
    blankLevel: 1,
    speechRate: 1,
    chapter: 1,
    verse: 1,
    range: null,
  };

  // Enough history that the dashboard and the missed list have something to say.
  const verses: Record<string, unknown> = {};
  const done: [number, number, string[]][] = [
    [1, 1, ['typing', 'blanks']],
    [1, 2, ['typing']],
    [1, 3, ['typing', 'voice', 'listening']],
    [1, 4, ['blanks']],
    [1, 5, ['typing', 'blanks', 'voice']],
    [2, 1, ['listening']],
    [2, 2, ['typing']],
    [3, 1, ['voice']],
  ];
  for (const [chapter, verse, modes] of done) {
    verses[`${chapter}:${verse}`] = { modes, best: 96, attempts: 2, lastAt: Date.now() };
  }

  const progress = {
    version: 1,
    verses,
    missed: [
      { ref: '1:7', mode: 'typing', accuracy: 72, at: Date.now(), resolved: false },
      { ref: '2:4', mode: 'voice', accuracy: 64, at: Date.now(), resolved: false },
    ],
    streak: { current: 5, longest: 12, lastDay: today },
  };

  return `
    localStorage.setItem('scripture-training/settings/v1', ${JSON.stringify(JSON.stringify(settings))});
    localStorage.setItem('scripture-training/progress/v1', ${JSON.stringify(JSON.stringify(progress))});

    class HelpRecognition extends EventTarget {
      constructor() { super(); this.lang = ''; this.continuous = false; this.interimResults = false;
        this.onresult = null; this.onerror = null; this.onend = null; }
      start() {
        setTimeout(() => {
          const transcript = window.__helpTranscript || '';
          if (!transcript || !this.onresult) return;
          this.onresult({ resultIndex: 0, results: { length: 1, 0: { 0: { transcript }, isFinal: true, length: 1 } } });
        }, 30);
      }
      // Deliberately never fires onend: the shot should show the live state.
      stop() {}
      abort() {}
    }
    window.SpeechRecognition = HelpRecognition;
    window.webkitSpeechRecognition = HelpRecognition;
  `;
}

/** Freezes motion and hides the caret, so repeated runs produce identical PNGs. */
const STILL_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

async function measure(page: Page, key: string): Promise<Box | null> {
  return page.evaluate((k) => {
    const el = document.querySelector(`[data-help="${k}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height };
  }, key);
}

async function capture(context: BrowserContext, base: string, shot: Shot, verses: string[]) {
  const page = await context.newPage();
  const missing: string[] = [];

  try {
    await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: STILL_CSS });
    // The verse text arrives over fetch, so nothing is marked until it lands.
    await page.waitForSelector('[data-help]', { timeout: 15000 });
    await shot.prepare?.(page, verses);

    const hide = ['footer', ...(shot.hide ?? [])];
    await page.evaluate((selectors) => {
      for (const selector of selectors) {
        document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          el.style.display = 'none';
        });
      }
    }, hide);

    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);

    const boxes: { key: string; box: Box }[] = [];
    for (const key of shot.marks) {
      // Marks that only appear once `prepare` has driven the UI need a moment.
      await page
        .waitForSelector(`[data-help="${key}"]`, { timeout: 5000 })
        .catch(() => null);
      const box = await measure(page, key);
      if (!box) missing.push(key);
      else boxes.push({ key, box });
    }

    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const lowest = boxes.reduce((max, { box }) => Math.max(max, box.y + box.h), 0);
    const height = Math.min(
      shot.maxHeight ?? MAX_SHOT_HEIGHT,
      docHeight,
      Math.max(MIN_SHOT_HEIGHT, Math.ceil(lowest) + 24),
    );

    await page.screenshot({
      path: path.join(IMAGE_DIR, `${shot.key}.png`),
      fullPage: true,
      clip: { x: 0, y: 0, width: VIEWPORT.width, height },
    });

    const markers = boxes
      .filter(({ box }) => box.y + box.h <= height + 1)
      .map(({ key, box }, index) => {
        const x = round((box.x / VIEWPORT.width) * 100);
        // A horizontally scrolling row (the mode tabs) is wider than the shot,
        // so clamp rather than let the outline spill past the image.
        const w = Math.min(round((box.w / VIEWPORT.width) * 100), 100 - x);
        return { key, n: index + 1, x, y: round((box.y / height) * 100), w, h: round((box.h / height) * 100) };
      });

    const clipped = boxes.length - markers.length;
    if (clipped > 0) missing.push(`${clipped} mark(s) fell below the crop`);

    return {
      result: {
        key: shot.key,
        image: `/help/${shot.key}.png`,
        width: VIEWPORT.width,
        height,
        markers,
      },
      missing,
    };
  } finally {
    await page.close();
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

async function resolveFile(urlPath: string): Promise<string | null> {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  const base = path.join(OUT_DIR, clean);
  // `output: 'export'` writes /typing.html, but keep the directory form working.
  for (const candidate of [base, `${base}.html`, path.join(base, 'index.html')]) {
    if (!candidate.startsWith(OUT_DIR)) continue;
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next shape.
    }
  }
  return null;
}

/**
 * Serves the static export. Building first rather than driving `next dev` keeps
 * runs reproducible, and sidesteps the single-instance lock that would make
 * this fail whenever a dev server is already open in the same checkout.
 */
function serveExport(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    void resolveFile(req.url ?? '/').then((file) => {
      if (!file) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}

function build(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['next', 'build'], { cwd: ROOT, stdio: 'inherit', env: process.env });
    proc.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`next build exited with ${code}`)),
    );
  });
}

async function main() {
  const urlArg = process.argv.indexOf('--url');
  const external = urlArg !== -1 ? process.argv[urlArg + 1] : null;

  let server: Server | null = null;
  let base = external ?? '';
  if (!external) {
    console.log('Building the static export…');
    await build();
    server = await serveExport(PORT);
    const address = server.address();
    if (typeof address === 'string' || address === null) throw new Error('No port assigned');
    base = `http://localhost:${address.port}`;
    console.log(`Serving out/ on ${base}`);
  }

  const browser = await chromium.launch();
  let failures = 0;

  try {
    await mkdir(IMAGE_DIR, { recursive: true });

    const dataset = JSON.parse(
      await readFile(path.join(ROOT, 'public', 'data', 'rev.en.json'), 'utf8'),
    ) as { chapters: { verses: { text: string }[] }[] };
    const verses = dataset.chapters[0].verses.map((v) => v.text);

    const now = new Date();
    const today = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;

    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: SCALE,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(initScript(today));

    const shots: Record<string, unknown> = {};
    for (const shot of SHOTS) {
      const { result, missing } = await capture(context, base, shot, verses);
      shots[shot.key] = result;
      if (missing.length > 0) {
        failures++;
        console.error(`  ✗ ${shot.key}: ${missing.join(', ')}`);
      } else {
        console.log(`  ✓ ${shot.key} (${result.markers.length} callouts, ${result.height}px)`);
      }
    }

    await writeFile(
      JSON_PATH,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), viewport: VIEWPORT, scale: SCALE, shots }, null, 2)}\n`,
    );
    console.log(`\nWrote ${path.relative(ROOT, JSON_PATH)} and ${SHOTS.length} images.`);
  } finally {
    await browser.close();
    server?.close();
  }

  if (failures > 0) {
    console.error(
      `\n${failures} shot(s) had unresolved marks — a data-help attribute was renamed or removed.`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
