'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { ScriptureText } from './ScriptureText';

/** Press-and-hold to reveal the reference text, so a peek is always deliberate. */
export function PeekButton({ text }: { text: string }) {
  const { t } = useStore();
  const [showing, setShowing] = useState(false);

  const hide = () => setShowing(false);
  const show = () => setShowing(true);

  // A release that never reaches the button — pointer capture refused, or the
  // finger lifted over some other element — would otherwise leave the peek
  // stuck open, which reveals the verse indefinitely.
  useEffect(() => {
    if (!showing) return;
    window.addEventListener('pointerup', hide);
    window.addEventListener('pointercancel', hide);
    return () => {
      window.removeEventListener('pointerup', hide);
      window.removeEventListener('pointercancel', hide);
    };
  }, [showing]);

  return (
    <>
      <button
        type="button"
        onPointerDown={(event) => {
          show();
          // Keep the pointer aimed at the button so a finger sliding off mid-hold
          // doesn't drop the release. Best-effort: a refused capture still leaves
          // the window-level listeners above to close the peek.
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Pointer already released or otherwise not capturable.
          }
        }}
        onPointerUp={hide}
        onPointerCancel={hide}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); // Space would otherwise scroll the page.
            show();
          }
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
          className="fixed inset-0 z-30 bg-background/95 flex items-center justify-center p-6 pointer-events-none"
          aria-live="polite"
        >
          <ScriptureText text={text} className="max-w-2xl" />
        </div>
      )}
    </>
  );
}
