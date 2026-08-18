import type { Chapter, Dataset, Lang, Range, Verse, VerseRef } from './types';

const cache = new Map<Lang, Promise<Dataset>>();

export function loadDataset(lang: Lang): Promise<Dataset> {
  let pending = cache.get(lang);
  if (!pending) {
    pending = fetch(`/data/rev.${lang}.json`).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${lang} verses (${res.status})`);
      return res.json() as Promise<Dataset>;
    });
    // A failed fetch shouldn't poison the cache — let the next attempt retry.
    pending.catch(() => cache.delete(lang));
    cache.set(lang, pending);
  }
  return pending;
}

export function getChapter(dataset: Dataset, chapter: number): Chapter | undefined {
  return dataset.chapters[chapter - 1];
}

export function getVerse(dataset: Dataset, ref: VerseRef): Verse | undefined {
  return getChapter(dataset, ref.chapter)?.verses[ref.verse - 1];
}

export function verseCount(dataset: Dataset, chapter: number): number {
  return getChapter(dataset, chapter)?.verses.length ?? 0;
}

export function totalVerses(dataset: Dataset): number {
  return dataset.chapters.reduce((n, c) => n + c.verses.length, 0);
}

export function refKey(ref: VerseRef): string {
  return `${ref.chapter}:${ref.verse}`;
}

export function parseRefKey(key: string): VerseRef {
  const [chapter, verse] = key.split(':').map(Number);
  return { chapter, verse };
}

export function compareRefs(a: VerseRef, b: VerseRef): number {
  return a.chapter - b.chapter || a.verse - b.verse;
}

/** Flattens a range into the ordered list of verses it covers. */
export function expandRange(dataset: Dataset, range: Range): VerseRef[] {
  const [start, end] =
    compareRefs(range.start, range.end) <= 0 ? [range.start, range.end] : [range.end, range.start];

  const refs: VerseRef[] = [];
  for (let chapter = start.chapter; chapter <= end.chapter; chapter++) {
    const count = verseCount(dataset, chapter);
    if (!count) continue;
    const from = chapter === start.chapter ? start.verse : 1;
    const to = chapter === end.chapter ? Math.min(end.verse, count) : count;
    for (let verse = from; verse <= to; verse++) refs.push({ chapter, verse });
  }
  return refs;
}

export function nextRef(dataset: Dataset, ref: VerseRef): VerseRef | undefined {
  if (ref.verse < verseCount(dataset, ref.chapter)) {
    return { chapter: ref.chapter, verse: ref.verse + 1 };
  }
  if (ref.chapter < dataset.chapters.length) {
    return { chapter: ref.chapter + 1, verse: 1 };
  }
  return undefined;
}

export function prevRef(dataset: Dataset, ref: VerseRef): VerseRef | undefined {
  if (ref.verse > 1) return { chapter: ref.chapter, verse: ref.verse - 1 };
  if (ref.chapter > 1) {
    const chapter = ref.chapter - 1;
    return { chapter, verse: verseCount(dataset, chapter) };
  }
  return undefined;
}

export function clampRef(dataset: Dataset, ref: VerseRef): VerseRef {
  const chapter = Math.min(Math.max(1, ref.chapter), dataset.chapters.length);
  const verse = Math.min(Math.max(1, ref.verse), verseCount(dataset, chapter) || 1);
  return { chapter, verse };
}
