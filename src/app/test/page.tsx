'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { RangeSelector } from '@/components/RangeSelector';
import { ScoreView } from '@/components/ScoreView';
import { expandRange, getVerse, refKey } from '@/lib/verses';
import { scoreAttempt, type Score } from '@/lib/text';
import { PASS_THRESHOLD } from '@/lib/progress';
import type { Range, VerseRef } from '@/lib/types';

interface Answer {
  ref: VerseRef;
  score: Score;
}

export default function TestPage() {
  const { dataset, t, settings, setSettings, record } = useStore();
  const [range, setRange] = useState<Range>(
    settings.range ?? { start: { chapter: 1, verse: 1 }, end: { chapter: 1, verse: 5 } },
  );
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [finished, setFinished] = useState(false);

  const refs = useMemo(
    () => (dataset ? expandRange(dataset, range) : []),
    [dataset, range],
  );

  if (!dataset) return <p className="text-muted py-12 text-center">{t('loading')}</p>;

  const start = () => {
    setSettings({ range });
    setRunning(true);
    setFinished(false);
    setIndex(0);
    setTyped('');
    setAnswers([]);
  };

  const submitCurrent = () => {
    const ref = refs[index];
    const verse = getVerse(dataset, ref);
    if (!verse) return;

    const score = scoreAttempt(verse.text, typed);
    record({ ref, mode: 'typing', accuracy: score.accuracy });

    const nextAnswers = [...answers, { ref, score }];
    setAnswers(nextAnswers);
    setTyped('');

    if (index + 1 < refs.length) {
      setIndex(index + 1);
    } else {
      setRunning(false);
      setFinished(true);
    }
  };

  const restart = () => {
    setRunning(false);
    setFinished(false);
    setAnswers([]);
    setIndex(0);
    setTyped('');
  };

  if (finished) {
    const passedCount = answers.filter((a) => a.score.accuracy >= PASS_THRESHOLD).length;
    const average = Math.round(
      answers.reduce((sum, a) => sum + a.score.accuracy, 0) / (answers.length || 1),
    );
    const missed = answers.filter((a) => a.score.accuracy < PASS_THRESHOLD);

    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold">{t('testResult')}</h1>

        <div
          data-help="testScore"
          className="rounded-xl border border-border bg-surface p-5 flex items-center gap-6"
        >
          <div>
            <p className="text-3xl font-semibold">{average}%</p>
            <p className="text-sm text-muted">{t('score')}</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-correct">
              {passedCount}
              <span className="text-muted text-lg">/{answers.length}</span>
            </p>
            <p className="text-sm text-muted">{t('passed')}</p>
          </div>
        </div>

        {missed.length > 0 && (
          <section data-help="testMissed" className="space-y-2">
            <h2 className="font-medium">{t('missedVerses')}</h2>
            {missed.map((answer) => (
              <div key={refKey(answer.ref)} className="space-y-1">
                <p className="text-sm text-accent font-medium">
                  {dataset.book} {answer.ref.chapter}:{answer.ref.verse}
                </p>
                <ScoreView score={answer.score} />
              </div>
            ))}
          </section>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={restart}
            className="px-4 py-2 rounded-lg bg-accent text-white font-medium"
          >
            {t('startOver')}
          </button>
        </div>
      </div>
    );
  }

  if (running) {
    const ref = refs[index];
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t('testTitle')}</h1>
          <span data-help="testCounter" className="text-sm text-muted tabular-nums">
            {t('question')} {index + 1} {t('of')} {refs.length}
          </span>
        </div>

        <div data-help="testProgress" className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(index / refs.length) * 100}%` }}
          />
        </div>

        <p data-help="testRef" className="text-xl font-medium text-accent">
          {dataset.book} {ref.chapter}:{ref.verse}
        </p>

        <textarea
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submitCurrent();
            }
          }}
          rows={5}
          autoFocus
          data-help="testInput"
          lang={settings.lang}
          aria-label={`${t('question')} ${index + 1}`}
          className={`scripture-${settings.lang} w-full rounded-xl border border-border bg-surface p-4 outline-none focus:border-accent resize-y`}
          style={{ fontSize: `${settings.fontSize}px` }}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={submitCurrent}
            data-help="testSubmit"
            className="px-4 py-2 rounded-lg bg-accent text-white font-medium"
          >
            {index + 1 < refs.length ? t('next') : t('submitTest')}
            <span className="ml-2 text-xs opacity-80">{t('checkHint')}</span>
          </button>
          <button
            type="button"
            onClick={restart}
            className="px-4 py-2 rounded-lg border border-border"
          >
            {t('startOver')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">{t('testTitle')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('testIntro')}</p>
      </div>

      <RangeSelector range={range} onChange={setRange} />

      <p data-help="testCount" className="text-sm text-muted">
        {refs.length} {t('versesDone')}
      </p>

      <button
        type="button"
        onClick={start}
        data-help="testStart"
        disabled={refs.length === 0}
        className="px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-40"
      >
        {t('startTest')}
      </button>
    </div>
  );
}
