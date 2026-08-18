'use client';

import { useStore } from '@/lib/store';
import { verseCount } from '@/lib/verses';
import type { Range, VerseRef } from '@/lib/types';

interface Props {
  range: Range;
  onChange: (range: Range) => void;
}

export function RangeSelector({ range, onChange }: Props) {
  const { dataset, t } = useStore();
  if (!dataset) return null;

  const edit = (edge: 'start' | 'end', patch: Partial<VerseRef>) => {
    const next: VerseRef = { ...range[edge], ...patch };
    // Clamp the verse to the chapter that's now selected, otherwise switching
    // to a shorter chapter would leave a reference that doesn't exist.
    next.verse = Math.min(Math.max(1, next.verse), verseCount(dataset, next.chapter) || 1);
    onChange({ ...range, [edge]: next });
  };

  const edgeInputs = (edge: 'start' | 'end', label: string) => {
    const ref = range[edge];
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted w-12 shrink-0">{label}</span>
        <select
          value={ref.chapter}
          onChange={(event) => edit(edge, { chapter: Number(event.target.value) })}
          aria-label={`${label} ${t('chapter')}`}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
        >
          {dataset.chapters.map((c) => (
            <option key={c.chapter} value={c.chapter}>
              {t('chapter')} {c.chapter}
            </option>
          ))}
        </select>
        <select
          value={ref.verse}
          onChange={(event) => edit(edge, { verse: Number(event.target.value) })}
          aria-label={`${label} ${t('verse')}`}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
        >
          {Array.from({ length: verseCount(dataset, ref.chapter) }, (_, i) => i + 1).map((v) => (
            <option key={v} value={v}>
              {t('verse')} {v}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
      <p className="text-xs uppercase tracking-wide text-muted">{t('range')}</p>
      {edgeInputs('start', t('from'))}
      {edgeInputs('end', t('to'))}
    </div>
  );
}
