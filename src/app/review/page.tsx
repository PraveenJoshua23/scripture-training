'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { clearMissed, openMissed } from '@/lib/progress';
import { getVerse, parseRefKey } from '@/lib/verses';
import type { Mode } from '@/lib/types';
import type { StringKey } from '@/lib/i18n';

const MODE_ROUTES: Record<Mode, string> = {
  typing: '/typing',
  blanks: '/blanks',
  voice: '/voice',
  listening: '/listening',
};

export default function ReviewPage() {
  const { dataset, t, progress, setProgress, setRef, settings } = useStore();

  if (!dataset) return <p className="text-muted py-12 text-center">{t('loading')}</p>;

  const missed = openMissed(progress);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{t('missedVerses')}</h1>
          <p className="text-sm text-muted mt-0.5">
            {missed.length} {t('versesDone')}
          </p>
        </div>
        {missed.length > 0 && (
          <button
            type="button"
            onClick={() => setProgress(clearMissed(progress))}
            data-help="reviewClear"
            className="text-sm text-muted hover:text-wrong px-2 py-1 shrink-0"
          >
            {t('clearList')}
          </button>
        )}
      </div>

      {missed.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-muted">
          {t('noMissed')}
        </p>
      ) : (
        <ul data-help="reviewList" className="space-y-2">
          {missed.map((entry) => {
            const ref = parseRefKey(entry.ref);
            const verse = getVerse(dataset, ref);
            return (
              <li
                key={`${entry.ref}-${entry.mode}-${entry.at}`}
                className="rounded-xl border border-border bg-surface p-4 space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-accent font-medium">
                    {dataset.book} {ref.chapter}:{ref.verse}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-muted text-muted">
                    {t(entry.mode as StringKey)}
                  </span>
                  <span className="text-xs text-wrong">{entry.accuracy}%</span>
                </div>

                {verse && (
                  <p className={`scripture-${settings.lang} text-sm text-muted line-clamp-2`}>
                    {verse.text}
                  </p>
                )}

                <Link
                  href={MODE_ROUTES[entry.mode]}
                  onClick={() => setRef(ref)}
                  data-help="reviewPractise"
                  className="inline-block text-sm px-3 py-1.5 rounded-lg bg-accent-soft text-accent font-medium"
                >
                  {t('practiceMissed')}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
