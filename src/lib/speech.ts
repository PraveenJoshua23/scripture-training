'use client';

import { useSyncExternalStore } from 'react';
import type { Lang } from './types';

/**
 * Android's WebView does not implement `speechSynthesis` at all, so listening
 * had no voice there — English has no pre-generated narration to fall back on,
 * and the screen disabled itself. The native build talks to the device's own
 * TTS engine through Capacitor instead.
 *
 * Read off the global Capacitor injects into the native WebView rather than
 * through `@capacitor/core`, so the web bundle carries no Capacitor at all.
 */
function isNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(
      (window as { Capacitor?: { isNativePlatform?(): boolean } }).Capacitor?.isNativePlatform?.(),
    )
  );
}

/**
 * Loaded on demand: the plugin reads `window` as it initialises, which throws
 * during the static export's prerender. Nothing imports it until a native
 * device actually speaks.
 *
 * The plugin object must never be *returned* from an async function. Capacitor
 * exposes it as a Proxy that turns any property read into a native call, so
 * awaiting it makes the runtime probe for `.then` and the bridge answers
 * `"TextToSpeech.then()" is not implemented on android` — the speak promise
 * then never settles and playback hangs. Destructure it and use it in place.
 */
function loadTts() {
  return import('@capacitor-community/text-to-speech');
}

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

/**
 * Speaks `text` and resolves when the utterance finishes, so both backends can
 * drive the same "advance when it ends" logic. `voice` is a web concept — the
 * native engine picks its own from the language tag.
 */
export async function speak(options: {
  text: string;
  lang: string;
  rate: number;
  voice: SpeechSynthesisVoice | null;
}): Promise<void> {
  if (isNative()) {
    const { TextToSpeech } = await loadTts();
    await TextToSpeech.speak({ text: options.text, lang: options.lang, rate: options.rate });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(options.text);
    utterance.lang = options.lang;
    utterance.rate = options.rate;
    if (options.voice) utterance.voice = options.voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('speech-failed'));
    window.speechSynthesis.speak(utterance);
  });
}

/** Silences whichever backend is speaking; safe to call when none is. */
export function cancelSpeech(): void {
  if (isNative()) {
    void loadTts().then(({ TextToSpeech }) => TextToSpeech.stop());
    return;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function useSpeechSynthesis(lang: Lang) {
  const supported = useIsSupported(
    () => isNative() || (typeof window !== 'undefined' && 'speechSynthesis' in window),
  );
  const all = useSyncExternalStore(voicesSubscribe, voicesSnapshot, () => EMPTY_VOICES);

  // Identity is stable between voiceschanged events, since the picked voice
  // comes straight out of the cached list.
  return { supported, voice: pickVoice(all, lang) };
}
