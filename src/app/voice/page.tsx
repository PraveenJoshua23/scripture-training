'use client';

import { useState } from 'react';
import { PracticeShell } from '@/components/PracticeShell';
import { ScoreView } from '@/components/ScoreView';
import { useStore } from '@/lib/store';
import { getVerse, nextRef } from '@/lib/verses';
import { scoreAttempt, type Score } from '@/lib/text';
import { useSpeechRecognition } from '@/lib/speech';
import type { Verse, VerseRef } from '@/lib/types';

export default function VoicePage() {
  const { dataset, t, currentRef } = useStore();
  const verse = dataset ? getVerse(dataset, currentRef) : undefined;

  return (
    <PracticeShell title={t('voice')} hint={t('voicePrompt')} helpAnchor="voice">
      {verse && (
        // Keyed on the reference so moving to another verse starts a clean attempt.
        <VoicePractice
          key={`${currentRef.chapter}:${currentRef.verse}`}
          verse={verse}
          ref_={currentRef}
        />
      )}
    </PracticeShell>
  );
}

function VoicePractice({ verse, ref_ }: { verse: Verse; ref_: VerseRef }) {
  const { dataset, t, setRef, record, settings } = useStore();
  const [score, setScore] = useState<Score | null>(null);
  const speech = useSpeechRecognition(settings.lang);

  const check = () => {
    if (score) return;
    const result = scoreAttempt(verse.text, speech.transcript);
    setScore(result);
    record({ ref: ref_, mode: 'voice', accuracy: result.accuracy });
  };

  const retry = () => {
    setScore(null);
    speech.reset();
  };

  const goNext = () => {
    if (!dataset) return;
    const to = nextRef(dataset, ref_);
    if (to) setRef(to);
  };

  return (
    <>
      {!speech.supported ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          {t('voiceUnsupported')}
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={speech.listening ? speech.stop : speech.start}
              data-help="voiceRecord"
              disabled={Boolean(score)}
              className={`px-4 py-2 rounded-lg font-medium disabled:opacity-40 ${
                speech.listening ? 'bg-wrong text-white' : 'bg-accent text-white'
              }`}
            >
              {speech.listening ? t('stopRecording') : t('startRecording')}
            </button>
            {speech.listening && (
              <span className="text-sm text-muted flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-wrong animate-pulse" />
                {t('listening_')}
              </span>
            )}
          </div>

          <div data-help="voiceHeard">
            <p className="text-xs uppercase tracking-wide text-muted mb-1">{t('heard')}</p>
            <p
              className={`scripture-${settings.lang} min-h-[3rem] leading-relaxed`}
              style={{ fontSize: `${settings.fontSize}px` }}
              lang={settings.lang}
              aria-live="polite"
            >
              {speech.transcript || <span className="text-muted">—</span>}
            </p>
          </div>

          {speech.error && (
            <p className="text-sm text-wrong">
              {speech.error === 'not-allowed' ? t('voiceUnsupported') : speech.error}
            </p>
          )}
        </div>
      )}

      {score && <ScoreView score={score} />}

      <div className="flex gap-2 flex-wrap">
        {!score ? (
          <button
            type="button"
            onClick={check}
            data-help="check"
            disabled={!speech.transcript.trim()}
            className="px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-40"
          >
            {t('check')}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={goNext}
              className="px-4 py-2 rounded-lg bg-accent text-white font-medium"
            >
              {t('next')}
            </button>
            <button
              type="button"
              onClick={retry}
              className="px-4 py-2 rounded-lg border border-border"
            >
              {t('retry')}
            </button>
          </>
        )}
      </div>
    </>
  );
}
