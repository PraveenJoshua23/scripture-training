'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Lang } from './types';

/**
 * Records a recitation and has it transcribed by Whisper on Workers AI.
 *
 * This replaces the browser's own speech recognition, which reported a phrase
 * repeatedly as it grew and had to be un-duplicated by guesswork, and which
 * fails outright in browsers that block its recognition backend. Recording and
 * transcribing in one step gives one authoritative transcript instead, at the
 * cost of live text while speaking.
 */

const ENDPOINT = '/api/transcribe';

/** A verse takes seconds; this only exists so a forgotten session can't run on. */
const MAX_SECONDS = 120;

export interface TranscribeLogEntry {
  /** Milliseconds since recording started. */
  at: number;
  detail: string;
}

const noopSubscribe = () => () => {};

function probeSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * The container the browser will actually record: Chrome gives WebM/Opus,
 * Safari only MP4. Whisper accepts both, so this just takes the first that the
 * browser admits to supporting and otherwise lets it choose.
 */
function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useVoiceTranscription(lang: Lang) {
  const supported = useSyncExternalStore(noopSubscribe, probeSupport, () => false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<TranscribeLogEntry[]>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = useCallback((detail: string) => {
    const at = Date.now() - startedAtRef.current;
    setLog((entries) => [...entries, { at, detail }]);
  }, []);

  // The microphone indicator stays on until every track is stopped, so this
  // runs on both the normal and the failed path.
  const releaseMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const send = useCallback(async () => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    const type = recorderRef.current?.mimeType || 'audio/webm';
    const audio = new Blob(chunks, { type });
    addLog(`recorded ${Math.round(audio.size / 1024)}kB of ${type}`);

    if (audio.size === 0) {
      setError('no-audio');
      return;
    }

    setTranscribing(true);
    const sentAt = Date.now();
    try {
      const response = await fetch(`${ENDPOINT}?lang=${lang}`, {
        method: 'POST',
        headers: { 'Content-Type': type },
        body: audio,
      });
      addLog(`${response.status} after ${Date.now() - sentAt}ms`);

      if (!response.ok) {
        // A 404 means the static export is being served without its Function —
        // `next dev` does that, so it is worth naming separately.
        setError(response.status === 404 ? 'no-endpoint' : 'server');
        return;
      }

      const data = (await response.json()) as { text?: string };
      const text = (data.text ?? '').trim();
      addLog(`transcript: "${text}"`);
      if (!text) {
        setError('no-speech');
        return;
      }
      setTranscript(text);
    } catch (cause) {
      addLog(`request failed: ${String(cause)}`);
      setError('network');
    } finally {
      setTranscribing(false);
    }
  }, [lang, addLog]);

  const stop = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    addLog('stopped');
    // `onstop` releases the microphone and uploads what was captured.
    recorderRef.current?.stop();
    setRecording(false);
  }, [addLog]);

  const start = useCallback(async () => {
    if (!probeSupport()) return;

    setError(null);
    setTranscript('');
    setLog([]);
    startedAtRef.current = Date.now();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      addLog(`microphone refused: ${String(cause)}`);
      setError('mic-blocked');
      return;
    }

    streamRef.current = stream;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      releaseMicrophone();
      void send();
    };

    recorderRef.current = recorder;
    addLog(`recording as ${recorder.mimeType || 'browser default'}`);
    recorder.start();
    setRecording(true);
    timerRef.current = setTimeout(stop, MAX_SECONDS * 1000);
  }, [addLog, releaseMicrophone, send, stop]);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return { supported, recording, transcribing, transcript, error, log, start, stop, reset };
}
