'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PracticeShell } from '@/components/PracticeShell';
import { ScoreView } from '@/components/ScoreView';
import { ScriptureText } from '@/components/ScriptureText';
import { useStore } from '@/lib/store';
import { getVerse, nextRef } from '@/lib/verses';
import { liveWordStatuses, scoreAttempt, splitWords, typingStats, type Score } from '@/lib/text';

export default function TypingPage() {
  const { dataset, t, currentRef, setRef, record, settings } = useStore();
  const [typed, setTyped] = useState('');
  const [score, setScore] = useState<Score | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const verse = dataset ? getVerse(dataset, currentRef) : undefined;

  const reset = () => {
    setTyped('');
    setScore(null);
    setStartedAt(null);
    setElapsed(0);
  };

  // Tick only while typing is in flight, so WPM stays live without a permanent timer.
  useEffect(() => {
    if (startedAt === null || score) return;
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(id);
  }, [startedAt, score]);

  const stats = useMemo(
    () => typingStats(verse?.text ?? '', typed, elapsed),
    [verse?.text, typed, elapsed],
  );

  const statuses = useMemo(
    () => liveWordStatuses(verse?.text ?? '', typed),
    [verse?.text, typed],
  );

  const check = () => {
    if (!verse || score) return;
    const result = scoreAttempt(verse.text, typed);
    setScore(result);
    record({ ref: currentRef, mode: 'typing', accuracy: result.accuracy });
  };

  const goNext = () => {
    if (!dataset) return;
    const to = nextRef(dataset, currentRef);
    if (to) setRef(to);
    reset();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Bare Enter inserts a newline; grading is deliberate, so a stray Enter
    // mid-verse never submits an unfinished attempt.
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      check();
    }
  };

  return (
    <PracticeShell title={t('typing')} hint={t('typingPrompt')} onNavigate={reset}>
      {verse && (
        <>
          <div className="rounded-xl border border-border bg-surface p-4">
            <ScriptureText>
              <span className="flex flex-wrap gap-x-1.5 gap-y-1">
                {splitWords(verse.text).map((word, index) => {
                  const status = statuses[index];
                  return (
                    <span
                      key={index}
                      className={
                        status === 'correct'
                          ? 'text-correct'
                          : status === 'wrong'
                            ? 'bg-wrong-soft text-wrong rounded px-0.5'
                            : 'text-muted'
                      }
                    >
                      {word}
                    </span>
                  );
                })}
              </span>
            </ScriptureText>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted">
            <span>
              {t('accuracy')} <strong className="text-foreground">{stats.accuracy}%</strong>
            </span>
            <span>
              {t('wpm')} <strong className="text-foreground">{stats.wpm}</strong>
            </span>
            <span>
              {t('cpm')} <strong className="text-foreground">{stats.cpm}</strong>
            </span>
          </div>

          <textarea
            ref={textareaRef}
            value={typed}
            onChange={(event) => {
              if (startedAt === null && event.target.value.length > 0) setStartedAt(Date.now());
              setTyped(event.target.value);
            }}
            onKeyDown={onKeyDown}
            disabled={Boolean(score)}
            rows={5}
            lang={settings.lang}
            aria-label={t('typingPrompt')}
            className={`scripture-${settings.lang} w-full rounded-xl border border-border bg-surface p-4 outline-none focus:border-accent disabled:opacity-70 resize-y`}
            style={{ fontSize: `${settings.fontSize}px` }}
          />

          {score && <ScoreView score={score} />}

          <div className="flex gap-2 flex-wrap">
            {!score ? (
              <button
                type="button"
                onClick={check}
                disabled={!typed.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-40"
              >
                {t('check')}
                <span className="ml-2 text-xs opacity-80">{t('checkHint')}</span>
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
                  onClick={reset}
                  className="px-4 py-2 rounded-lg border border-border"
                >
                  {t('retry')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </PracticeShell>
  );
}
