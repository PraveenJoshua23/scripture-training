'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { verseCount } from '@/lib/verses';
import { isComplete } from '@/lib/progress';

export function VersePicker({ onClose }: { onClose: () => void }) {
  const { dataset, t, currentRef, setRef, progress } = useStore();
  const [chapter, setChapter] = useState(currentRef.chapter);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape closes; focus moves into the dialog so keyboard users aren't stranded.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!dataset) return null;
  const verses = verseCount(dataset, chapter);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('selectPassage')}
        className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border max-h-[85dvh] flex flex-col outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-medium">{t('selectPassage')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-foreground px-2 py-1"
          >
            {t('close')}
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted mb-2">{t('chapter')}</p>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
              {dataset.chapters.map((c) => (
                <button
                  key={c.chapter}
                  type="button"
                  onClick={() => setChapter(c.chapter)}
                  aria-pressed={chapter === c.chapter}
                  className={`aspect-square rounded-lg text-sm transition-colors ${
                    chapter === c.chapter
                      ? 'bg-accent text-white'
                      : 'bg-surface-muted hover:bg-accent-soft'
                  }`}
                >
                  {c.chapter}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted mb-2">{t('verse')}</p>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
              {Array.from({ length: verses }, (_, i) => i + 1).map((verse) => {
                const done = isComplete(progress, { chapter, verse });
                return (
                  <button
                    key={verse}
                    type="button"
                    onClick={() => {
                      setRef({ chapter, verse });
                      onClose();
                    }}
                    className={`aspect-square rounded-lg text-sm transition-colors ${
                      done
                        ? 'bg-correct-soft text-correct hover:bg-correct hover:text-white'
                        : 'bg-surface-muted hover:bg-accent-soft'
                    }`}
                  >
                    {verse}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
