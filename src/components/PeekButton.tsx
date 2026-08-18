'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { ScriptureText } from './ScriptureText';

/** Press-and-hold to reveal the reference text, so a peek is always deliberate. */
export function PeekButton({ text }: { text: string }) {
  const { t } = useStore();
  const [showing, setShowing] = useState(false);

  const hide = () => setShowing(false);
  const show = () => setShowing(true);

  return (
    <>
      <button
        type="button"
        onPointerDown={show}
        onPointerUp={hide}
        onPointerLeave={hide}
        onPointerCancel={hide}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') show();
        }}
        onKeyUp={hide}
        onBlur={hide}
        aria-pressed={showing}
        className="px-3 py-2 rounded-lg border border-border text-sm text-muted hover:bg-surface-muted select-none touch-none"
      >
        {t('peek')}
      </button>

      {showing && (
        <div
          className="fixed inset-0 z-30 bg-background/95 flex items-center justify-center p-6"
          aria-live="polite"
        >
          <ScriptureText text={text} className="max-w-2xl" />
        </div>
      )}
    </>
  );
}
