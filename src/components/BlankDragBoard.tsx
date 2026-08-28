'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScriptureText } from '@/components/ScriptureText';
import { useStore } from '@/lib/store';

/**
 * A bank word. Repeated words in a verse produce separate tokens with the same
 * text, so placing one must not consume the other — hence the id.
 */
export interface BankToken {
  id: number;
  word: string;
}

interface DragState {
  token: BankToken;
  x: number;
  y: number;
  /** Cleared once the pointer travels far enough to count as a drag. */
  tap: boolean;
}

/** Pixels of travel before a press is treated as a drag rather than a tap. */
const DRAG_THRESHOLD = 8;

function blankIndexAt(x: number, y: number): number | null {
  const element = document.elementFromPoint(x, y);
  const slot = element?.closest<HTMLElement>('[data-blank-index]');
  if (!slot || slot.dataset.blankIndex === undefined) return null;
  return Number(slot.dataset.blankIndex);
}

/**
 * Touch-first fill-in-the-blank: drag a word from the bank onto a blank, or tap
 * the word and then tap the blank. Both gestures run through the same
 * `place` call, which also makes the board keyboard-operable — every chip and
 * slot is a real button.
 */
export function BlankDragBoard({
  words,
  blanks,
  tokens,
  placed,
  onPlace,
  onClear,
  disabled,
}: {
  words: string[];
  /** Word indices that are blanked, in verse order. */
  blanks: number[];
  tokens: BankToken[];
  /** Blank word index → the id of the token sitting in it. */
  placed: Record<number, number>;
  onPlace: (blankIndex: number, token: BankToken) => void;
  onClear: (blankIndex: number) => void;
  disabled: boolean;
}) {
  const { t, settings } = useStore();
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const usedIds = new Set(Object.values(placed));
  const tokenById = new Map(tokens.map((token) => [token.id, token]));

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
    setOver(null);
  }, []);

  const place = useCallback(
    (blankIndex: number, token: BankToken) => {
      // A blank holds one word; dropping onto a full one replaces its occupant,
      // which returns the old token to the bank on its own.
      onPlace(blankIndex, token);
      setSelected(null);
    },
    [onPlace],
  );

  // Window-level listeners so a drag that leaves the chip (or the board) still
  // tracks, and still ends if the pointer is released anywhere.
  useEffect(() => {
    if (!drag) return;

    const move = (event: PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const moved =
        Math.abs(event.clientX - state.x) > DRAG_THRESHOLD ||
        Math.abs(event.clientY - state.y) > DRAG_THRESHOLD;
      const next = { ...state, x: event.clientX, y: event.clientY, tap: state.tap && !moved };
      dragRef.current = next;
      setDrag(next);
      setOver(next.tap ? null : blankIndexAt(event.clientX, event.clientY));
    };

    const up = (event: PointerEvent) => {
      const state = dragRef.current;
      endDrag();
      if (!state) return;
      if (state.tap) {
        // A tap arms the chip; the next tap on a blank places it.
        setSelected((prev) => (prev === state.token.id ? null : state.token.id));
        return;
      }
      const target = blankIndexAt(event.clientX, event.clientY);
      if (target !== null) place(target, state.token);
    };

    const cancel = () => endDrag();

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [drag, endDrag, place]);

  const startDrag = (token: BankToken, event: React.PointerEvent) => {
    if (disabled || usedIds.has(token.id)) return;
    const state: DragState = { token, x: event.clientX, y: event.clientY, tap: true };
    dragRef.current = state;
    setDrag(state);
  };

  const onSlot = (blankIndex: number) => {
    if (disabled) return;
    const selectedToken = selected === null ? null : tokenById.get(selected);
    if (selectedToken) {
      place(blankIndex, selectedToken);
      return;
    }
    // No word armed: tapping a filled blank sends its word back to the bank.
    if (placed[blankIndex] !== undefined) onClear(blankIndex);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-4">
        <ScriptureText>
          <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-2.5">
            {words.map((word, index) => {
              if (!blanks.includes(index)) return <span key={index}>{word}</span>;

              const token = placed[index] === undefined ? null : tokenById.get(placed[index]);
              const position = blanks.indexOf(index) + 1;
              const armed = selected !== null && !token;

              return (
                <span key={index} className="inline-flex items-baseline">
                  <button
                    type="button"
                    data-blank-index={index}
                    onClick={() => onSlot(index)}
                    disabled={disabled}
                    aria-label={
                      token
                        ? `${t('blanks')} ${position}: ${token.word}`
                        : `${t('blanks')} ${position}`
                    }
                    style={{
                      fontSize: `${settings.fontSize}px`,
                      minWidth: `${Math.max(3, word.length + 1)}ch`,
                    }}
                    className={`border-b-2 px-1 text-center align-baseline transition-colors disabled:opacity-70 ${
                      over === index
                        ? 'border-accent bg-accent text-white'
                        : token
                          ? 'border-accent bg-accent-soft'
                          : armed
                            ? 'border-accent bg-accent-soft/60 animate-pulse'
                            : 'border-accent'
                    }`}
                  >
                    {token ? token.word : ' '}
                  </button>
                </span>
              );
            })}
          </span>
        </ScriptureText>
      </div>

      <p className="text-sm text-muted">{t('blankDragHint')}</p>

      <div className="flex flex-wrap gap-2">
        {tokens.map((token) => {
          const used = usedIds.has(token.id);
          return (
            <button
              key={token.id}
              type="button"
              // Pointer events cover mouse and touch alike; HTML5 drag-and-drop
              // does not fire on touch at all, which is the target here.
              onPointerDown={(event) => startDrag(token, event)}
              onClick={(event) => {
                // A pointer tap already toggled this on pointerup; letting the
                // click through would immediately toggle it back. `detail === 0`
                // marks a keyboard activation, which is the only case left.
                if (disabled || used || event.detail !== 0) return;
                setSelected((prev) => (prev === token.id ? null : token.id));
              }}
              disabled={disabled || used}
              aria-pressed={selected === token.id}
              className={`scripture-${settings.lang} touch-none select-none rounded-lg px-3 py-2 text-base transition-all ${
                used
                  ? 'bg-surface-muted text-muted line-through opacity-40'
                  : selected === token.id
                    ? 'bg-accent text-white ring-2 ring-accent'
                    : 'bg-surface-muted hover:bg-accent-soft'
              } ${drag?.token.id === token.id && !drag.tap ? 'opacity-30' : ''}`}
            >
              {token.word}
            </button>
          );
        })}
      </div>

      {drag && !drag.tap && (
        <span
          aria-hidden
          className={`scripture-${settings.lang} pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-accent px-3 py-2 text-base text-white shadow-lg`}
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.token.word}
        </span>
      )}
    </div>
  );
}
