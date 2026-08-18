'use client';

import { useStore } from '@/lib/store';
import { PASS_THRESHOLD } from '@/lib/progress';
import type { Score } from '@/lib/text';

const TOKEN_STYLES: Record<string, string> = {
  correct: 'text-correct',
  missing: 'bg-wrong-soft text-wrong rounded px-0.5',
  wrong: 'bg-wrong-soft text-wrong rounded px-0.5',
  extra: 'text-wrong line-through opacity-70',
};

/** Word-by-word diff of the attempt against the verse. */
export function ScoreView({ score }: { score: Score }) {
  const { t, settings } = useStore();
  const passed = score.accuracy >= PASS_THRESHOLD;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={`text-2xl font-semibold ${passed ? 'text-correct' : 'text-wrong'}`}
        >
          {score.accuracy}%
        </span>
        <span className="text-sm text-muted">
          {score.correct}/{score.total} {t('correct')}
        </span>
      </div>

      <p
        className={`scripture-${settings.lang} leading-relaxed flex flex-wrap gap-x-1.5 gap-y-1`}
        style={{ fontSize: `${settings.fontSize}px` }}
        lang={settings.lang}
      >
        {score.tokens.map((token, index) => (
          <span key={index} className={TOKEN_STYLES[token.status]}>
            {token.expected ?? token.actual}
          </span>
        ))}
      </p>
    </div>
  );
}
