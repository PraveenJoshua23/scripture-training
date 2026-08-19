import type { Theme } from './theme';
import { THEME_STORAGE_KEY } from './theme';
import type { Lang, Range } from './types';

// Shared with the pre-paint theme script, which reads this key directly.
const STORAGE_KEY = THEME_STORAGE_KEY;

export interface Settings {
  lang: Lang;
  theme: Theme;
  /** Practice text size in px. */
  fontSize: number;
  /** Fraction of words blanked in fill-in-the-blank mode. */
  blankDensity: number;
  blankLevel: 1 | 2 | 3 | 4 | 5;
  speechRate: number;
  /** Where the reader left off. */
  chapter: number;
  verse: number;
  range: Range | null;
}

export function defaultSettings(): Settings {
  return {
    lang: 'en',
    theme: 'system',
    fontSize: 20,
    blankDensity: 0.2,
    blankLevel: 1,
    speechRate: 1,
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
