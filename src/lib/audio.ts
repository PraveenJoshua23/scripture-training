'use client';

import { useEffect, useState } from 'react';
import type { Lang, VerseRef } from './types';

/** Which verses have pre-generated narration, by lang then chapter. */
export type AudioManifest = Partial<Record<Lang, Record<string, number[]>>>;

const BOOK = 'revelation';

let pending: Promise<AudioManifest> | undefined;

export function loadAudioManifest(): Promise<AudioManifest> {
  if (!pending) {
    pending = fetch('/audio/manifest.json')
      .then((res) => (res.ok ? (res.json() as Promise<AudioManifest>) : {}))
      // No manifest just means nothing has been generated yet — fall back quietly.
      .catch(() => ({}));
  }
  return pending;
}

export function audioUrlFor(manifest: AudioManifest, lang: Lang, ref: VerseRef): string | undefined {
  const has = manifest[lang]?.[String(ref.chapter)]?.includes(ref.verse);
  return has ? `/audio/${lang}/${BOOK}/${ref.chapter}/${ref.verse}.mp3` : undefined;
}

/**
 * Resolves the narration URL for a verse, or undefined when there is no
 * pre-generated file — callers fall back to speechSynthesis in that case.
 */
export function useVerseAudio(lang: Lang, ref: VerseRef): string | undefined {
  const [manifest, setManifest] = useState<AudioManifest>({});

  useEffect(() => {
    let live = true;
    loadAudioManifest().then((m) => {
      if (live) setManifest(m);
    });
    return () => {
      live = false;
    };
  }, []);

  return audioUrlFor(manifest, lang, ref);
}
