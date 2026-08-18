import type { Lang } from './types';

/**
 * Comparison is deliberately forgiving: memorisation is about the words, not
 * about reproducing curly quotes or the translators' punctuation.
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, '')
    .trim();
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function wordCount(text: string): number {
  return splitWords(text).length;
}

/**
 * First "letter" of a word, used for the hint difficulty level. Tamil letters
 * are grapheme clusters (base + vowel sign), so slicing by code unit would cut
 * a letter in half — segment instead where the runtime supports it.
 */
export function firstGrapheme(word: string, lang: Lang): string {
  const stripped = word.replace(/^[^\p{L}\p{N}]+/u, '');
  if (!stripped) return word.slice(0, 1);

  if (lang === 'ta' && typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ta', { granularity: 'grapheme' });
    const [first] = segmenter.segment(stripped);
    if (first) return first.segment;
  }
  return [...stripped][0] ?? stripped.slice(0, 1);
}

export type TokenStatus = 'correct' | 'wrong' | 'missing' | 'extra';

export interface ScoredToken {
  expected?: string;
  actual?: string;
  status: TokenStatus;
}

export interface Score {
  tokens: ScoredToken[];
  correct: number;
  total: number;
  /** 0–100, rounded. */
  accuracy: number;
}

/**
 * Word-level alignment via longest common subsequence, so a single dropped or
 * inserted word shifts one token rather than marking the whole rest wrong.
 */
export function scoreAttempt(expectedText: string, actualText: string): Score {
  const expected = splitWords(expectedText);
  const actual = splitWords(actualText);
  const e = expected.map(normalizeWord);
  const a = actual.map(normalizeWord);

  const lcs: number[][] = Array.from({ length: e.length + 1 }, () => new Array(a.length + 1).fill(0));
  for (let i = e.length - 1; i >= 0; i--) {
    for (let j = a.length - 1; j >= 0; j--) {
      lcs[i][j] = e[i] === a[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const tokens: ScoredToken[] = [];
  let correct = 0;
  let i = 0;
  let j = 0;

  while (i < e.length && j < a.length) {
    if (e[i] === a[j]) {
      tokens.push({ expected: expected[i], actual: actual[j], status: 'correct' });
      correct++;
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      tokens.push({ expected: expected[i], status: 'missing' });
      i++;
    } else {
      tokens.push({ actual: actual[j], status: 'extra' });
      j++;
    }
  }
  while (i < e.length) tokens.push({ expected: expected[i++], status: 'missing' });
  while (j < a.length) tokens.push({ actual: actual[j++], status: 'extra' });

  const total = e.length;
  return {
    tokens,
    correct,
    total,
    accuracy: total === 0 ? 0 : Math.round((correct / total) * 100),
  };
}

/** Live per-word feedback while typing: only judges words the user finished. */
export function liveWordStatuses(expectedText: string, typed: string): TokenStatus[] {
  const expected = splitWords(expectedText).map(normalizeWord);
  const typedWords = splitWords(typed).map(normalizeWord);
  const endsMidWord = typed.length > 0 && !/\s$/.test(typed);

  return typedWords.map((word, index) => {
    const target = expected[index];
    if (target === undefined) return 'extra';
    if (word === target) return 'correct';
    // Don't flag the word still being typed until it can no longer match.
    if (index === typedWords.length - 1 && endsMidWord && target.startsWith(word)) return 'correct';
    return 'wrong';
  });
}

export interface TypingStats {
  accuracy: number;
  wpm: number;
  cpm: number;
}

export function typingStats(expectedText: string, typed: string, elapsedMs: number): TypingStats {
  const minutes = elapsedMs / 60000;
  const chars = typed.length;
  const words = wordCount(typed);
  const statuses = liveWordStatuses(expectedText, typed);
  const correct = statuses.filter((s) => s === 'correct').length;

  return {
    accuracy: statuses.length === 0 ? 100 : Math.round((correct / statuses.length) * 100),
    wpm: minutes > 0 ? Math.round(words / minutes) : 0,
    cpm: minutes > 0 ? Math.round(chars / minutes) : 0,
  };
}

/**
 * Picks which word positions to blank out, spread evenly across the verse so
 * the gaps don't clump at one end. Deterministic per verse+density, so the
 * same verse doesn't reshuffle its blanks on every re-render.
 */
export function pickBlankIndices(text: string, density: number, seed: number): number[] {
  const words = splitWords(text);
  const eligible = words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => normalizeWord(word).length > 1)
    .map(({ index }) => index);

  if (eligible.length === 0) return [];

  const wanted = Math.max(1, Math.round(eligible.length * density));
  if (wanted >= eligible.length) return eligible;

  const step = eligible.length / wanted;
  const offset = seed % Math.max(1, Math.floor(step));
  const picked = new Set<number>();
  for (let n = 0; n < wanted; n++) {
    const at = Math.min(eligible.length - 1, Math.floor(n * step) + offset);
    picked.add(eligible[at]);
  }
  return [...picked].sort((x, y) => x - y);
}

/** Stable small integer from a verse reference, for deterministic blank layout. */
export function seedFrom(chapter: number, verse: number): number {
  return (chapter * 31 + verse * 17) % 97;
}

export function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
