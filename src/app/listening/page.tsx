'use client';

import { useCallback, useEffect, useState } from 'react';
import { PracticeShell } from '@/components/PracticeShell';
import { ScriptureText } from '@/components/ScriptureText';
import { useStore } from '@/lib/store';
import { getChapter, getVerse, nextRef } from '@/lib/verses';
import { useSpeechSynthesis } from '@/lib/speech';
import { PASS_THRESHOLD } from '@/lib/progress';

type PlayMode = 'single' | 'repeat' | 'chapter';

export default function ListeningPage() {
  const { dataset, t, currentRef, setRef, record, settings, setSettings } = useStore();
  const { supported, voices } = useSpeechSynthesis(settings.lang);

  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<PlayMode>('single');
  // Bumped to replay the same verse; changing it re-runs the playback effect.
  const [playToken, setPlayToken] = useState(0);

  const verse = dataset ? getVerse(dataset, currentRef) : undefined;
  const chapter = dataset ? getChapter(dataset, currentRef.chapter) : undefined;

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
  }, []);

  const text = verse?.text;
  const { chapter: chapterNo, verse: verseNo } = currentRef;
  const { lang, speechRate, voiceUri } = settings;

  // Playback is driven entirely from this effect: it talks to speechSynthesis
  // (an external system) and only advances state from the utterance callback,
  // never synchronously during the effect body.
  useEffect(() => {
    if (!playing || !supported || !text || !dataset) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    utterance.rate = speechRate;
    const chosen = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceUri);
    if (chosen) utterance.voice = chosen;

    utterance.onend = () => {
      // Hearing the verse through counts as covering it in listening mode.
      record({ ref: { chapter: chapterNo, verse: verseNo }, mode: 'listening', accuracy: PASS_THRESHOLD });

      if (mode === 'repeat') {
        setPlayToken((token) => token + 1);
        return;
      }
      if (mode === 'chapter') {
        const to = nextRef(dataset, { chapter: chapterNo, verse: verseNo });
        // Continuous play stays within the chapter the reader started in.
        if (to && to.chapter === chapterNo) {
          setRef(to);
          return;
        }
      }
      setPlaying(false);
    };
    utterance.onerror = () => setPlaying(false);

    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [
    playing,
    playToken,
    supported,
    text,
    dataset,
    chapterNo,
    verseNo,
    lang,
    speechRate,
    voiceUri,
    mode,
    record,
    setRef,
  ]);

  const controls = (
    <div className="space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        {(
          [
            ['single', t('play')],
            ['repeat', t('repeatVerse')],
            ['chapter', t('playChapter')],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              mode === value
                ? 'bg-accent text-white'
                : 'bg-surface-muted text-muted hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3 text-sm text-muted">
        <span className="whitespace-nowrap">
          {t('speed')} {settings.speechRate.toFixed(1)}×
        </span>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.1}
          value={settings.speechRate}
          onChange={(event) => setSettings({ speechRate: Number(event.target.value) })}
          className="flex-1 accent-[var(--accent)]"
        />
      </label>

      {voices.length > 0 && (
        <label className="flex items-center gap-3 text-sm text-muted">
          <span className="whitespace-nowrap">{t('ttsVoice')}</span>
          <select
            value={settings.voiceUri ?? ''}
            onChange={(event) => setSettings({ voiceUri: event.target.value || null })}
            className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-foreground"
          >
            <option value="">—</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );

  return (
    <PracticeShell title={t('listening')} controls={controls} onNavigate={stop}>
      {!supported && (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          {t('ttsUnsupported')}
        </p>
      )}

      {verse && (
        <>
          <div className="rounded-xl border border-border bg-surface p-4">
            <ScriptureText text={verse.text} />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => (playing ? stop() : setPlaying(true))}
              disabled={!supported}
              className="px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-40"
            >
              {playing ? t('pause') : t('play')}
            </button>
          </div>

          {chapter && (
            <ol className="rounded-xl border border-border bg-surface divide-y divide-border">
              {chapter.verses.map((v) => (
                <li key={v.v}>
                  <button
                    type="button"
                    onClick={() => setRef({ chapter: currentRef.chapter, verse: v.v })}
                    className={`w-full text-left px-4 py-2.5 flex gap-3 hover:bg-surface-muted transition-colors ${
                      v.v === currentRef.verse ? 'bg-accent-soft' : ''
                    }`}
                  >
                    <span className="text-xs text-accent tabular-nums pt-1 w-6 shrink-0">{v.v}</span>
                    <span className={`scripture-${settings.lang} text-sm line-clamp-2`}>
                      {v.text}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </PracticeShell>
  );
}
