import type { Lang, Range } from './types';

const STORAGE_KEY = 'scripture-training/settings/v1';

export interface Settings {
  lang: Lang;
  /** Practice text size in px. */
  fontSize: number;
  /** Fraction of words blanked in fill-in-the-blank mode. */
  blankDensity: number;
  blankLevel: 1 | 2 | 3 | 4 | 5;
  speechRate: number;
  voiceUri: string | null;
  /** Where the reader left off. */
  chapter: number;
  verse: number;
  range: Range | null;
}

export function defaultSettings(): Settings {
  return {
    lang: 'en',
    fontSize: 20,
    blankDensity: 0.2,
    blankLevel: 1,
    speechRate: 1,
    voiceUri: null,
    chapter: 1,
    verse: 1,
    range: null,
  };
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return defaultSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Non-fatal; settings just won't survive the session.
  }
}
