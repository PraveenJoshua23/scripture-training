'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Lang } from './types';

// The Web Speech API is still vendor-prefixed in most shipping browsers and
// isn't in the DOM lib types, so we describe just the surface we use.
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}
export interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const BCP47: Record<Lang, string> = { en: 'en-US', ta: 'ta-IN' };

// Capability detection is a read of an external system that never changes for
// the life of the page, so it needs no subscription — just a stable snapshot
// that reports false during server rendering.
const noopSubscribe = () => () => {};

function useIsSupported(probe: () => boolean): boolean {
  return useSyncExternalStore(noopSubscribe, probe, () => false);
}

/** Comparison words: lowercase, punctuation dropped, so "Christ," matches "christ". */
function compareWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Whether `next` is `previous` repeated, possibly with more words on the end —
 * the engine restating a phrase it has already reported rather than moving on
 * to new speech. Compared word by word so "Revelation" doesn't swallow
 * "Revelations", and so punctuation added when a result is finalised
 * ("Christ" → "Christ,") doesn't hide the match.
 */
function restates(previous: string, next: string): boolean {
  const before = compareWords(previous);
  const after = compareWords(next);
  if (before.length === 0 || after.length < before.length) return false;
  return before.every((word, i) => after[i] === word);
}

/**
 * Folds a sequence of recognised phrases into the text that was actually said,
 * dropping each phrase that merely restates the one before it.
 */
function collapse(chunks: string[]): string {
  const kept: string[] = [];
  for (const chunk of chunks) {
    const text = chunk.trim().replace(/\s+/g, ' ');
    if (!text) continue;
    const last = kept.length - 1;
    // The longer of the two wins: a phrase that grew replaces what it grew
    // from, and a phrase that shrank back is a stale restatement to drop.
    if (last >= 0 && restates(kept[last], text)) kept[last] = text;
    else if (last >= 0 && restates(text, kept[last])) continue;
    else kept.push(text);
  }
  return kept.join(' ');
}

/**
 * Assembles the transcript from `onresult` events.
 *
 * Results can't be appended as they arrive. Mobile engines (Chrome on Android
 * especially) report a phrase over and over as it grows, each time marked
 * final — "revelation", "revelation", "revelation of", "revelation of Jesus" —
 * so appending gave a transcript that repeated every word once per event.
 * Worse, the restatements arrive in two different shapes: sometimes overwriting
 * one result slot, sometimes appended as new results alongside the old ones.
 *
 * So each result is stored at its own index — which makes an overwrite in place
 * harmless — and the whole store is then folded by `collapse`, which drops any
 * phrase that only restates the phrase before it. That covers both shapes,
 * including a mixture of the two, because the fold looks at the assembled text
 * rather than at how the engine chose to number it.
 */
export function createTranscriptBuilder() {
  // Final results of the current batch, held at their result index.
  let finals: string[] = [];
  // Phrases from batches the engine has stopped reporting.
  let committed: string[] = [];

  const bank = () => {
    committed = [...committed, ...finals];
    finals = [];
  };

  return {
    add(event: SpeechRecognitionEvent): string {
      // A shorter list than last time means the engine started a fresh batch
      // rather than extending the old one, so bank what it is about to forget.
      if (event.results.length < finals.length) bank();

      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        // Text unrelated to what already sits in this slot means the engine has
        // restarted its numbering for new speech, so the finished phrase is
        // banked before the slot is overwritten. `collapse` cannot recover it
        // afterwards — by then the phrase is gone from the store.
        const held = finals[i];
        if (held && !restates(held, text) && !restates(text, held)) bank();

        if (result.isFinal) finals[i] = text;
        else {
          // An interim guess may be finalised at this index later, so keep the
          // slot empty rather than leaving the guess behind to be counted twice.
          finals[i] = '';
          interim = `${interim} ${text}`;
        }
      }

      return collapse([...committed, ...finals, interim]);
    },
    reset() {
      finals = [];
      committed = [];
    },
  };
}

export function useSpeechRecognition(lang: Lang) {
  const supported = useIsSupported(() => getConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const builderRef = useRef<ReturnType<typeof createTranscriptBuilder> | null>(null);
  builderRef.current ??= createTranscriptBuilder();

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getConstructor();
    if (!Ctor) return;

    recognitionRef.current?.abort();
    builderRef.current?.reset();
    setTranscript('');
    setError(null);

    const recognition = new Ctor();
    recognition.lang = BCP47[lang];
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      setTranscript(builderRef.current!.add(event));
    };
    recognition.onerror = (event) => {
      setError((event as Event & { error?: string }).error ?? 'error');
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [lang]);

  const reset = useCallback(() => {
    builderRef.current?.reset();
    setTranscript('');
    setError(null);
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, transcript, error, start, stop, reset };
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
