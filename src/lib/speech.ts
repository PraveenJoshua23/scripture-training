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
interface SpeechRecognitionEvent extends Event {
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

const BCP47: Record<Lang, string> = { en: 'en-US', ta: 'ta-IN' };

// Capability detection is a read of an external system that never changes for
// the life of the page, so it needs no subscription — just a stable snapshot
// that reports false during server rendering.
const noopSubscribe = () => () => {};

function useIsSupported(probe: () => boolean): boolean {
  return useSyncExternalStore(noopSubscribe, probe, () => false);
}

export function useSpeechRecognition(lang: Lang) {
  const supported = useIsSupported(() => getConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Finalised speech accumulates here; interim results are appended for display
  // only, so a re-recognised phrase doesn't duplicate itself in the transcript.
  const finalRef = useRef('');

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getConstructor();
    if (!Ctor) return;

    recognitionRef.current?.abort();
    finalRef.current = '';
    setTranscript('');
    setError(null);

    const recognition = new Ctor();
    recognition.lang = BCP47[lang];
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current += `${result[0].transcript} `;
        else interim += result[0].transcript;
      }
      setTranscript((finalRef.current + interim).trim());
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
    finalRef.current = '';
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

export function useSpeechSynthesis(lang: Lang) {
  const supported = useIsSupported(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  );
  const all = useSyncExternalStore(voicesSubscribe, voicesSnapshot, () => EMPTY_VOICES);

  const prefix = lang === 'ta' ? 'ta' : 'en';
  const matching = all.filter((voice) => voice.lang.toLowerCase().startsWith(prefix));

  return { supported, voices: matching.length ? matching : all };
}
