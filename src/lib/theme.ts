'use client';

import { useSyncExternalStore } from 'react';

/** 'system' follows the OS setting; the others override it. */
export type Theme = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'scripture-training/settings/v1';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

// Returns a primitive, so React can compare snapshots without caching.
function getSnapshot(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** The OS colour preference, kept live if the user changes it mid-session. */
export function useSystemTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'light');
}

export function resolveTheme(theme: Theme, system: 'light' | 'dark'): 'light' | 'dark' {
  return theme === 'system' ? system : theme;
}

/**
 * Runs before first paint to stamp the saved theme onto <html>, so an explicit
 * choice doesn't flash the system theme first. Kept in sync with `Settings`.
 */
export const THEME_INIT_SCRIPT = `
try {
  var raw = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  var theme = raw ? JSON.parse(raw).theme : null;
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  }
} catch (e) {}
`.trim();
