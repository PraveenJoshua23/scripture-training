'use client';

import { useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { getVerse, nextRef, prevRef } from '@/lib/verses';
import { VersePicker } from './VersePicker';
import { PeekButton } from './PeekButton';

interface Props {
  title: string;
  hint?: string;
  children: ReactNode;
  /** Rendered under the header, above the practice area. */
  controls?: ReactNode;
  onNavigate?: () => void;
}

export function PracticeShell({ title, hint, children, controls, onNavigate }: Props) {
  const { dataset, t, currentRef, setRef, settings, setSettings } = useStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!dataset) {
    return <p className="text-muted py-12 text-center">{t('loading')}</p>;
  }

  const verse = getVerse(dataset, currentRef);
  const previous = prevRef(dataset, currentRef);
  const upcoming = nextRef(dataset, currentRef);

  const go = (to: typeof previous) => {
    if (!to) return;
    setRef(to);
    onNavigate?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {hint && <p className="text-sm text-muted mt-0.5">{hint}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setSettings({ fontSize: Math.max(14, settings.fontSize - 2) })}
            aria-label={`${t('fontSize')} −`}
            className="w-8 h-8 rounded-lg border border-border text-sm hover:bg-surface-muted"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => setSettings({ fontSize: Math.min(40, settings.fontSize + 2) })}
            aria-label={`${t('fontSize')} +`}
            className="w-8 h-8 rounded-lg border border-border text-sm hover:bg-surface-muted"
          >
            A+
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="px-3 py-2 rounded-lg bg-accent-soft text-accent font-medium text-sm hover:brightness-95"
        >
          {dataset.book} {currentRef.chapter}:{currentRef.verse}
        </button>
        <button
          type="button"
          onClick={() => go(previous)}
          disabled={!previous}
          className="px-3 py-2 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-surface-muted"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => go(upcoming)}
          disabled={!upcoming}
          className="px-3 py-2 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-surface-muted"
        >
          →
        </button>
        {verse && <PeekButton text={verse.text} />}
      </div>

      {controls}

      {children}

      {pickerOpen && <VersePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
