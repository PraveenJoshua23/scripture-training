// Builds public/data/rev.<lang>.json from open Bible database dumps.
//
// Sources (both fetched at build time, not vendored):
//   https://github.com/godlytalias/Bible-Database
//   English/bible.json -> KJV (public domain)
//   Tamil/bible.json   -> Tamil O.V. / Union Version (public domain base text)
//   Hindi/bible.json   -> Hindi O.V. (public domain base text)
//
// Usage: node scripts/build-verses.mjs [lang ...]
//
// With no arguments every source is rebuilt — including English, which would
// replace the shipped NASB with KJV. Name the languages to rebuild just those;
// they are then validated against the rev.en.json already on disk.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const REVELATION_INDEX = 65; // 0-based position in the 66-book canon
const EXPECTED_CHAPTERS = 22;
const EXPECTED_VERSES = 404;

const SOURCES = [
  {
    lang: 'en',
    version: 'KJV',
    versionLabel: 'King James Version',
    book: 'Revelation',
    license: 'Public domain',
    url: 'https://raw.githubusercontent.com/godlytalias/Bible-Database/master/English/bible.json',
  },
  {
    lang: 'ta',
    version: 'TAOV',
    versionLabel: 'பரிசுத்த வேதாகமம் (O.V.)',
    book: 'வெளிப்படுத்தின விசேஷம்',
    license: 'Public domain (Tamil Union Version base text)',
    url: 'https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Tamil/bible.json',
  },
  {
    lang: 'hi',
    version: 'HIOV',
    versionLabel: 'पवित्र बाइबिल (O.V.)',
    book: 'प्रकाशितवाक्य',
    license: 'Public domain (Hindi O.V. base text)',
    url: 'https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Hindi/bible.json',
  },
];

// The dumps carry stray whitespace and occasional soft hyphens / zero-width marks.
function clean(text) {
  return text
    .replace(/­/g, '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extract(source) {
  process.stdout.write(`fetching ${source.lang} ... `);
  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`${source.url} responded ${res.status}`);
  const dump = await res.json();

  const book = dump.Book?.[REVELATION_INDEX];
  if (!book) throw new Error(`no book at index ${REVELATION_INDEX} in ${source.lang} dump`);

  const chapters = book.Chapter.map((chapter, ci) => ({
    chapter: ci + 1,
    verses: chapter.Verse.map((verse, vi) => ({
      v: vi + 1,
      text: clean(verse.Verse),
    })),
  }));

  console.log(
    `${chapters.length} chapters, ${chapters.reduce((n, c) => n + c.verses.length, 0)} verses`,
  );

  return {
    lang: source.lang,
    version: source.version,
    versionLabel: source.versionLabel,
    license: source.license,
    book: source.book,
    bookId: 'revelation',
    chapters,
  };
}

function validate(dataset, reference) {
  const problems = [];
  const total = dataset.chapters.reduce((n, c) => n + c.verses.length, 0);

  if (dataset.chapters.length !== EXPECTED_CHAPTERS) {
    problems.push(`expected ${EXPECTED_CHAPTERS} chapters, got ${dataset.chapters.length}`);
  }
  if (total !== EXPECTED_VERSES) {
    problems.push(`expected ${EXPECTED_VERSES} verses, got ${total}`);
  }
  for (const chapter of dataset.chapters) {
    for (const verse of chapter.verses) {
      if (!verse.text) problems.push(`empty text at ${chapter.chapter}:${verse.v}`);
    }
  }
  // Both languages must agree verse-for-verse, or the language switcher would
  // land the reader on a different verse than the one they were practising.
  if (reference) {
    for (const [i, chapter] of dataset.chapters.entries()) {
      const refChapter = reference.chapters[i];
      if (refChapter && refChapter.verses.length !== chapter.verses.length) {
        problems.push(
          `chapter ${chapter.chapter}: ${dataset.lang} has ${chapter.verses.length} verses, ` +
            `${reference.lang} has ${refChapter.verses.length}`,
        );
      }
    }
  }
  return problems;
}

const outDir = join(process.cwd(), 'public', 'data');
await mkdir(outDir, { recursive: true });

const wanted = process.argv.slice(2);
const selected = wanted.length ? SOURCES.filter((s) => wanted.includes(s.lang)) : SOURCES;
if (wanted.length && selected.length !== wanted.length) {
  throw new Error(`unknown language in ${wanted.join(', ')}`);
}

let reference = wanted.length
  ? JSON.parse(await readFile(join(outDir, 'rev.en.json'), 'utf8'))
  : null;
let failed = false;

for (const source of selected) {
  const dataset = await extract(source);
  const problems = validate(dataset, reference);

  if (problems.length) {
    failed = true;
    console.error(`  ✗ ${source.lang}:`);
    for (const problem of problems) console.error(`      ${problem}`);
  } else {
    console.log(`  ✓ ${source.lang} validated`);
  }

  await writeFile(join(outDir, `rev.${source.lang}.json`), JSON.stringify(dataset));
  reference ??= dataset;
}

if (failed) process.exit(1);
console.log(`\nwrote ${selected.length} datasets to public/data/`);
