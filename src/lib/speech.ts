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

const join = (parts: string[]) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

/**
 * Whether `next` is the engine refining the phrase it already reported as
 * `previous` — a re-send of the same text, or the same text grown by a few more
 * words — rather than a new stretch of speech that happens to reuse the slot.
 */
function isRevisionOf(previous: string, next: string): boolean {
  const a = previous.toLowerCase();
  const b = next.toLowerCase();
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * Assembles the transcript from `onresult` events.
 *
 * Results can't be appended as they arrive. Mobile engines (Chrome on Android
 * in particular) re-deliver results that are already final, with `resultIndex`
 * stuck at 0 and the phrase growing word by word, so appending each event
 * repeated everything said so far once per event — "the / the the / the the the
 * Revelation …". Instead every result is stored *at its own index* and the
 * transcript is rebuilt from that store, which makes a re-delivery a harmless
 * overwrite. Text only moves into `committed` when the engine reuses a slot for
 * genuinely new speech, so nothing already recognised is lost either.
 */
export function createTranscriptBuilder() {
  // Final results of the current batch, held at their result index.
  let finals: string[] = [];
  // Text from batches the engine has stopped reporting.
  let committed = '';

  const flush = () => {
    committed = join([committed, ...finals]);
    finals = [];
  };

  return {
    add(event: SpeechRecognitionEvent): string {
      // A shorter list than last time means a fresh batch rather than an
      // extension of the old one, so bank what it is about to forget.
      if (event.results.length < finals.length) flush();

      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();

        // Unrelated text arriving where a final result already sits is the
        // engine restarting its numbering, not correcting itself, so the
        // finished phrase is banked before the slot is reused.
        if (finals[i] && !isRevisionOf(finals[i], text)) flush();

        if (result.isFinal) finals[i] = text;
        else {
          // An interim guess may be finalised at this index later, so keep the
          // slot empty rather than leaving the guess behind to be counted twice.
          finals[i] = '';
          interim = join([interim, text]);
        }
      }

      return join([committed, ...finals, interim]);
    },
    reset() {
      finals = [];
      committed = '';
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
