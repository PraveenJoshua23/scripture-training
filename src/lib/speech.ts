'use client';

import { useSyncExternalStore } from 'react';
import type { Lang } from './types';

export const BCP47: Record<Lang, string> = { en: 'en-US', ta: 'ta-IN' };

// Capability detection is a read of an external system that never changes for
// the life of the page, so it needs no subscription — just a stable snapshot
// that reports false during server rendering.
const noopSubscribe = () => () => {};

function useIsSupported(probe: () => boolean): boolean {
  return useSyncExternalStore(noopSubscribe, probe, () => false);
}

// The voice list is a genuine external store: it starts empty in Chrome and is
// populated asynchronously. getSnapshot must return a stable reference between
// changes, so the list is cached and only replaced when it actually differs.
let voiceCache: SpeechSynthesisVoice[] = [];

function voicesSubscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return () => {};
  const handler = () => {
    voiceCache = window.speechSynthesis.getVoices();
    onChange();
  };
  window.speechSynthesis.addEventListener('voiceschanged', handler);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
}

function voicesSnapshot(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return voiceCache;
  const current = window.speechSynthesis.getVoices();
  if (current.length !== voiceCache.length) voiceCache = current;
  return voiceCache;
}

const EMPTY_VOICES: SpeechSynthesisVoice[] = [];

/**
 * The voice each language is read in. Both are Apple system voices, so they're
 * present on macOS and iOS but not on Windows/Android — hence the fallbacks in
 * `pickVoice` rather than a hard requirement.
 */
const PREFERRED_VOICE: Record<Lang, string> = { en: 'Moira', ta: 'Vani' };

/**
 * Resolves the voice to read `lang` in: the preferred one by name, else any
 * voice for that language, else nothing (the platform default then applies).
 * Moira is en-IE rather than en-US, so matching is by language prefix.
 */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | null {
  const prefix = lang === 'ta' ? 'ta' : 'en';
  const matching = voices.filter((voice) => voice.lang.toLowerCase().startsWith(prefix));
  const wanted = PREFERRED_VOICE[lang].toLowerCase();
  return matching.find((voice) => voice.name.toLowerCase().includes(wanted)) ?? matching[0] ?? null;
}

export function useSpeechSynthesis(lang: Lang) {
  const supported = useIsSupported(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  );
  const all = useSyncExternalStore(voicesSubscribe, voicesSnapshot, () => EMPTY_VOICES);

  // Identity is stable between voiceschanged events, since the picked voice
  // comes straight out of the cached list.
  return { supported, voice: pickVoice(all, lang) };
}
