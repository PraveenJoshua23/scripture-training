'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { translator, type StringKey } from './i18n';
import { createPersistentStore } from './persistent-store';
import {
  emptyProgress,
  loadProgress,
  recordAttempt,
  saveProgress,
  type AttemptInput,
  type ProgressState,
} from './progress';
import { defaultSettings, loadSettings, saveSettings, type Settings } from './settings';
import type { Dataset, Lang, VerseRef } from './types';
import { clampRef, loadDataset } from './verses';

// Module-level so the server snapshots keep a stable identity across renders.
const SERVER_SETTINGS = defaultSettings();
const SERVER_PROGRESS = emptyProgress();

const settingsStore = createPersistentStore<Settings>({
  load: loadSettings,
  save: saveSettings,
  serverValue: SERVER_SETTINGS,
});

const progressStore = createPersistentStore<ProgressState>({
  load: loadProgress,
  save: saveProgress,
  serverValue: SERVER_PROGRESS,
});

interface StoreValue {
  dataset: Dataset | null;
  settings: Settings;
  progress: ProgressState;
  t: (key: StringKey) => string;
  setSettings: (patch: Partial<Settings>) => void;
  setLang: (lang: Lang) => void;
  setRef: (ref: VerseRef) => void;
  currentRef: VerseRef;
  record: (attempt: AttemptInput) => void;
  setProgress: (next: ProgressState) => void;
  resetProgress: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const settings = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.getSnapshot,
    settingsStore.getServerSnapshot,
  );
  const progress = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
    progressStore.getServerSnapshot,
  );

  const [dataset, setDataset] = useState<Dataset | null>(null);

  // Mirror the chosen theme onto <html>; 'system' clears the override so the
  // prefers-color-scheme media query takes back over.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    let active = true;
    loadDataset(settings.lang)
      .then((next) => {
        if (active) setDataset(next);
      })
      .catch(() => {
        if (active) setDataset(null);
      });
    return () => {
      active = false;
    };
  }, [settings.lang]);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    settingsStore.update((prev) => ({ ...prev, ...patch }));
  }, []);

  const setProgress = useCallback((next: ProgressState) => progressStore.set(next), []);

  const record = useCallback((attempt: AttemptInput) => {
    progressStore.update((prev) => recordAttempt(prev, attempt));
  }, []);

  const resetProgress = useCallback(() => progressStore.set(emptyProgress()), []);

  // Language switches keep the reader on the same verse — the datasets are
  // verse-aligned, so the reference carries across unchanged.
  const setLang = useCallback((lang: Lang) => setSettings({ lang }), [setSettings]);

  const currentRef = useMemo<VerseRef>(() => {
    const ref = { chapter: settings.chapter, verse: settings.verse };
    return dataset ? clampRef(dataset, ref) : ref;
  }, [dataset, settings.chapter, settings.verse]);

  const setRef = useCallback(
    (ref: VerseRef) => setSettings({ chapter: ref.chapter, verse: ref.verse }),
    [setSettings],
  );

  const value = useMemo<StoreValue>(
    () => ({
      dataset,
      settings,
      progress,
      t: translator(settings.lang),
      setSettings,
      setLang,
      setRef,
      currentRef,
      record,
      setProgress,
      resetProgress,
    }),
    [
      dataset,
      settings,
      progress,
      setSettings,
      setLang,
      setRef,
      currentRef,
      record,
      setProgress,
      resetProgress,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
