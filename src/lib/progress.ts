import type { Mode, VerseRef } from './types';
import { refKey } from './verses';

const STORAGE_KEY = 'scripture-training/progress/v1';

export interface VerseProgress {
  /** Modes this verse has been completed in at least once. */
  modes: Mode[];
  /** Best accuracy achieved, 0–100. */
  best: number;
  attempts: number;
  lastAt: number;
}

export interface MissedEntry {
  ref: string;
  mode: Mode;
  accuracy: number;
  at: number;
  /** Cleared once the verse is answered correctly again. */
  resolved: boolean;
}

export interface ProgressState {
  version: 1;
  verses: Record<string, VerseProgress>;
  missed: MissedEntry[];
  streak: {
    current: number;
    longest: number;
    /** Local date string (YYYY-MM-DD) of the last day a verse was practised. */
    lastDay: string | null;
  };
}

export const PASS_THRESHOLD = 90;

export function emptyProgress(): ProgressState {
  return {
    version: 1,
    verses: {},
    missed: [],
    streak: { current: 0, longest: 0, lastDay: null },
  };
}

export function localDay(at: number = Date.now()): string {
  const d = new Date(at);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function loadProgress(): ProgressState {
  if (typeof window === 'undefined') return emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    // Defensive merge: a partially-written or older payload should degrade to
    // defaults rather than crash the app on boot and strand the user's data.
    return {
      version: 1,
      verses: parsed.verses ?? {},
      missed: parsed.missed ?? [],
      streak: parsed.streak ?? { current: 0, longest: 0, lastDay: null },
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(state: ProgressState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private-mode failure: practice still works, it just won't persist.
  }
}

export interface AttemptInput {
  ref: VerseRef;
  mode: Mode;
  accuracy: number;
}

/** Returns a new state with the attempt recorded; never mutates the input. */
export function recordAttempt(state: ProgressState, attempt: AttemptInput): ProgressState {
  const key = refKey(attempt.ref);
  const now = Date.now();
  const passed = attempt.accuracy >= PASS_THRESHOLD;
  const existing = state.verses[key];

  const verse: VerseProgress = {
    modes:
      passed && !existing?.modes.includes(attempt.mode)
        ? [...(existing?.modes ?? []), attempt.mode]
        : existing?.modes ?? [],
    best: Math.max(existing?.best ?? 0, attempt.accuracy),
    attempts: (existing?.attempts ?? 0) + 1,
    lastAt: now,
  };

  let missed = state.missed;
  if (passed) {
    // Clearing the verse resolves whatever it was previously logged for.
    missed = missed.map((entry) =>
      entry.ref === key && !entry.resolved ? { ...entry, resolved: true } : entry,
    );
  } else {
    const alreadyOpen = missed.some(
      (entry) => entry.ref === key && entry.mode === attempt.mode && !entry.resolved,
    );
    if (!alreadyOpen) {
      missed = [
        ...missed,
        { ref: key, mode: attempt.mode, accuracy: attempt.accuracy, at: now, resolved: false },
      ];
    }
  }

  return {
    ...state,
    verses: { ...state.verses, [key]: verse },
    missed,
    streak: passed ? bumpStreak(state.streak, now) : state.streak,
  };
}

function bumpStreak(streak: ProgressState['streak'], at: number): ProgressState['streak'] {
  const today = localDay(at);
  if (streak.lastDay === today) return streak;

  // One cleared verse sustains the day; a gap of more than one day resets.
  const current = streak.lastDay && daysBetween(streak.lastDay, today) === 1 ? streak.current + 1 : 1;
  return {
    current,
    longest: Math.max(streak.longest, current),
    lastDay: today,
  };
}

export function openMissed(state: ProgressState): MissedEntry[] {
  return state.missed.filter((entry) => !entry.resolved);
}

export function clearMissed(state: ProgressState): ProgressState {
  return { ...state, missed: [] };
}

export function isComplete(state: ProgressState, ref: VerseRef): boolean {
  return (state.verses[refKey(ref)]?.modes.length ?? 0) > 0;
}

export function completedInMode(state: ProgressState, mode: Mode): number {
  return Object.values(state.verses).filter((verse) => verse.modes.includes(mode)).length;
}

export function completedTotal(state: ProgressState): number {
  return Object.values(state.verses).filter((verse) => verse.modes.length > 0).length;
}

export function overallAccuracy(state: ProgressState): number {
  const scores = Object.values(state.verses).map((verse) => verse.best);
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function chapterProgress(
  state: ProgressState,
  chapter: number,
  verseTotal: number,
): { done: number; total: number } {
  let done = 0;
  for (let verse = 1; verse <= verseTotal; verse++) {
    if (isComplete(state, { chapter, verse })) done++;
  }
  return { done, total: verseTotal };
}
