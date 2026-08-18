'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import {
  chapterProgress,
  completedInMode,
  completedTotal,
  overallAccuracy,
} from '@/lib/progress';
import { totalVerses, verseCount } from '@/lib/verses';
import type { Mode } from '@/lib/types';
import type { StringKey } from '@/lib/i18n';

const MODES: { mode: Mode; href: string; key: StringKey; hint: StringKey }[] = [
  { mode: 'typing', href: '/typing', key: 'typing', hint: 'modeTypingHint' },
  { mode: 'blanks', href: '/blanks', key: 'blanks', hint: 'modeBlanksHint' },
  { mode: 'voice', href: '/voice', key: 'voice', hint: 'modeVoiceHint' },
  { mode: 'listening', href: '/listening', key: 'listening', hint: 'modeListeningHint' },
];

export default function HomePage() {
  const { dataset, t, progress, setRef, resetProgress } = useStore();

  if (!dataset) return <p className="text-muted py-12 text-center">{t('loading')}</p>;

  const total = totalVerses(dataset);
  const done = completedTotal(progress);
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl">🔥</span>
          <div>
            <p className="text-2xl font-semibold">
              {progress.streak.current}{' '}
              <span className="text-base font-normal text-muted">{t('streak')}</span>
            </p>
            {progress.streak.current === 0 ? (
              <p className="text-sm text-muted">{t('streakStart')}</p>
            ) : (
              <p className="text-sm text-muted">
                {t('streakLongest')}: {progress.streak.longest}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">{t('overallProgress')}</h2>
          <p className="text-sm text-muted tabular-nums">
            {done} / {total} {t('versesDone')} · {t('accuracy')} {overallAccuracy(progress)}%
          </p>
        </div>

        <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MODES.map(({ mode, key }) => (
            <div key={mode} className="rounded-xl bg-surface-muted p-3">
              <p className="text-xl font-semibold tabular-nums">
                {completedInMode(progress, mode)}
              </p>
              <p className="text-xs text-muted">{t(key)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">{t('howToTitle')}</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {MODES.map(({ href, key, hint }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-border bg-surface p-4 hover:border-accent transition-colors"
            >
              <p className="font-medium">{t(key)}</p>
              <p className="text-sm text-muted mt-0.5">{t(hint)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">{t('chapterProgress')}</h2>
        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
          {dataset.chapters.map((chapter) => {
            const { done: chapterDone, total: chapterTotal } = chapterProgress(
              progress,
              chapter.chapter,
              verseCount(dataset, chapter.chapter),
            );
            const ratio = chapterTotal ? chapterDone / chapterTotal : 0;
            return (
              <Link
                key={chapter.chapter}
                href="/typing"
                onClick={() => setRef({ chapter: chapter.chapter, verse: 1 })}
                title={`${t('chapter')} ${chapter.chapter} — ${chapterDone}/${chapterTotal}`}
                className="aspect-square rounded-lg bg-surface-muted relative overflow-hidden flex items-center justify-center text-sm hover:ring-2 hover:ring-accent transition-all"
              >
                <span
                  className="absolute inset-x-0 bottom-0 bg-accent-soft"
                  style={{ height: `${ratio * 100}%` }}
                />
                <span className="relative tabular-nums">{chapter.chapter}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {done > 0 && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t('resetConfirm'))) resetProgress();
          }}
          className="text-sm text-muted hover:text-wrong"
        >
          {t('resetProgress')}
        </button>
      )}
    </div>
  );
}
