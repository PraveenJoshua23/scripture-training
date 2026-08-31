'use client';

import { useCallback, useMemo, useState } from 'react';
import { BlankDragBoard, type BankToken } from '@/components/BlankDragBoard';
import { PracticeShell } from '@/components/PracticeShell';
import { ScoreView } from '@/components/ScoreView';
import { ScriptureText } from '@/components/ScriptureText';
import { useIsCompact } from '@/lib/media';
import { useStore } from '@/lib/store';
import { getVerse, nextRef } from '@/lib/verses';
import {
  firstGrapheme,
  normalizeWord,
  pickBlankIndices,
  scoreAttempt,
  seedFrom,
  shuffle,
  splitWords,
  type Score,
} from '@/lib/text';
import { useVoiceTranscription } from '@/lib/transcribe';
import type { StringKey } from '@/lib/i18n';
import type { Verse, VerseRef } from '@/lib/types';

const LEVELS: { level: 1 | 2 | 3 | 4 | 5; key: StringKey }[] = [
  { level: 1, key: 'blankLevel1' },
  { level: 2, key: 'blankLevel2' },
  { level: 3, key: 'blankLevel3' },
  { level: 4, key: 'blankLevel4' },
  { level: 5, key: 'blankLevel5' },
];

export default function BlanksPage() {
  const { t, settings, setSettings, currentRef, dataset } = useStore();
  const level = settings.blankLevel;
  const verse = dataset ? getVerse(dataset, currentRef) : undefined;

  const controls = (
    <div className="space-y-3">
      <div data-help="blankLevels" className="flex gap-1 flex-wrap">
        {LEVELS.map(({ level: value, key }) => (
          <button
            key={value}
            type="button"
            onClick={() => setSettings({ blankLevel: value })}
            aria-pressed={level === value}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              level === value
                ? 'bg-accent text-white'
                : 'bg-surface-muted text-muted hover:text-foreground'
            }`}
          >
            {value}. {t(key)}
          </button>
        ))}
      </div>

      {level <= 3 && (
        <label data-help="blankDensity" className="flex items-center gap-3 text-sm text-muted">
          <span className="whitespace-nowrap">
            {t('blankDensity')} {Math.round(settings.blankDensity * 100)}%
          </span>
          <input
            type="range"
            min={10}
            max={100}
            step={10}
            value={Math.round(settings.blankDensity * 100)}
            onChange={(event) => setSettings({ blankDensity: Number(event.target.value) / 100 })}
            className="flex-1 accent-[var(--accent)]"
          />
        </label>
      )}
    </div>
  );

  return (
    <PracticeShell title={t('blanks')} controls={controls} helpAnchor="blanks">
      {verse && (
        // Remounting on verse, level, or density change clears the in-flight
        // attempt without an effect that reaches back into state.
        <BlanksPractice
          key={`${currentRef.chapter}:${currentRef.verse}:${level}:${settings.blankDensity}`}
          verse={verse}
          ref_={currentRef}
        />
      )}
    </PracticeShell>
  );
}

/** How many blanks currently hold this word. */
function typedCount(answers: Record<number, string>, word: string): number {
  const target = normalizeWord(word);
  return Object.values(answers).filter((value) => target && normalizeWord(value) === target).length;
}

/** Chips for a repeated word strike through one at a time, in bank order. */
function bankCountBefore(bank: BankToken[], token: BankToken): number {
  const target = normalizeWord(token.word);
  let seen = 0;
  for (const other of bank) {
    if (other.id === token.id) break;
    if (normalizeWord(other.word) === target) seen++;
  }
  return seen;
}

function BlanksPractice({ verse, ref_ }: { verse: Verse; ref_: VerseRef }) {
  const { dataset, t, setRef, record, settings } = useStore();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  /** Blank word index → bank token id. Drag-and-drop only. */
  const [placed, setPlaced] = useState<Record<number, number>>({});
  const [fullText, setFullText] = useState('');
  const [score, setScore] = useState<Score | null>(null);

  const level = settings.blankLevel;
  const speech = useVoiceTranscription(settings.lang);
  const compact = useIsCompact();
  // The word bank is what makes dragging meaningful, so it stays a level 1
  // affordance; levels 2–3 are recall exercises and remain typed.
  const dragMode = compact && level === 1;

  const words = useMemo(() => splitWords(verse.text), [verse.text]);
  const seed = seedFrom(ref_.chapter, ref_.verse);
  const blanks = useMemo(
    () => pickBlankIndices(verse.text, settings.blankDensity, seed),
    [verse.text, settings.blankDensity, seed],
  );
  // Ids ride along so two occurrences of the same word stay distinct chips.
  const bank = useMemo<BankToken[]>(
    () => shuffle(blanks.map((index, id) => ({ id, word: words[index] })), seed),
    [blanks, words, seed],
  );

  const placeToken = useCallback((blankIndex: number, token: BankToken) => {
    setPlaced((prev) => {
      const next: Record<number, number> = {};
      // A token lives in exactly one blank: moving it vacates wherever it was,
      // and the blank it lands on drops whatever it was holding.
      for (const [key, id] of Object.entries(prev)) {
        if (Number(key) !== blankIndex && id !== token.id) next[Number(key)] = id;
      }
      next[blankIndex] = token.id;
      return next;
    });
    setAnswers((prev) => ({ ...prev, [blankIndex]: token.word }));
  }, []);

  const clearSlot = useCallback((blankIndex: number) => {
    setPlaced((prev) => {
      const next = { ...prev };
      delete next[blankIndex];
      return next;
    });
    setAnswers((prev) => ({ ...prev, [blankIndex]: '' }));
  }, []);

  const check = () => {
    if (score) return;

    // Levels 1–3 only grade the blanked words; levels 4–5 grade the whole verse.
    let result: Score;
    if (level <= 3) {
      const expected = blanks.map((index) => words[index]).join(' ');
      const actual = blanks.map((index) => answers[index] ?? '').join(' ');
      result = scoreAttempt(expected, actual);
    } else {
      result = scoreAttempt(verse.text, level === 5 ? speech.transcript : fullText);
    }

    setScore(result);
    record({ ref: ref_, mode: 'blanks', accuracy: result.accuracy });
  };

  const retry = () => {
    setAnswers({});
    setPlaced({});
    setFullText('');
    setScore(null);
    speech.reset();
  };

  const goNext = () => {
    if (!dataset) return;
    const to = nextRef(dataset, ref_);
    if (to) setRef(to);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      check();
    }
  };

  return (
    <>
      {dragMode && (
        <BlankDragBoard
          words={words}
          blanks={blanks}
          tokens={bank}
          placed={placed}
          onPlace={placeToken}
          onClear={clearSlot}
          disabled={Boolean(score)}
        />
      )}

      {level <= 3 && !dragMode && (
        <div data-help="blankBoard" className="rounded-xl border border-border bg-surface p-4">
          <ScriptureText>
            <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-2">
              {words.map((word, index) => {
                if (!blanks.includes(index)) return <span key={index}>{word}</span>;
                const hint = level === 2 ? firstGrapheme(word, settings.lang) : '';
                const position = blanks.indexOf(index) + 1;
                return (
                  <span key={index} className="inline-flex items-baseline">
                    {hint && <span className="text-accent mr-0.5">{hint}</span>}
                    <input
                      value={answers[index] ?? ''}
                      onChange={(event) =>
                        setAnswers((prev) => ({ ...prev, [index]: event.target.value }))
                      }
                      onKeyDown={onKeyDown}
                      disabled={Boolean(score)}
                      aria-label={`${t('blanks')} ${position}`}
                      lang={settings.lang}
                      style={{
                        fontSize: `${settings.fontSize}px`,
                        width: `${Math.max(3, word.length + 1)}ch`,
                      }}
                      className="border-b-2 border-accent bg-transparent outline-none focus:bg-accent-soft px-0.5 text-center disabled:opacity-70"
                    />
                  </span>
                );
              })}
            </span>
          </ScriptureText>
        </div>
      )}

      {level === 1 && !dragMode && (
        <div data-help="blankBank" className="flex flex-wrap gap-1.5">
          {bank.map((token) => (
            <span
              key={token.id}
              className={`px-2 py-1 rounded-lg bg-surface-muted text-sm scripture-${settings.lang} ${
                typedCount(answers, token.word) > bankCountBefore(bank, token)
                  ? 'opacity-40 line-through'
                  : ''
              }`}
            >
              {token.word}
            </span>
          ))}
        </div>
      )}

      {level === 4 && (
        <textarea
          value={fullText}
          onChange={(event) => setFullText(event.target.value)}
          onKeyDown={onKeyDown}
          data-help="blankFull"
          disabled={Boolean(score)}
          rows={5}
          lang={settings.lang}
          aria-label={t('blankLevel4')}
          className={`scripture-${settings.lang} w-full rounded-xl border border-border bg-surface p-4 outline-none focus:border-accent disabled:opacity-70 resize-y`}
          style={{ fontSize: `${settings.fontSize}px` }}
        />
      )}

      {level === 5 && (
        <div data-help="blankVoice" className="rounded-xl border border-border bg-surface p-4 space-y-3">
          {!speech.supported ? (
            <p className="text-sm text-muted">{t('voiceUnsupported')}</p>
          ) : (
            <>
              <button
                type="button"
                onClick={speech.recording ? speech.stop : speech.start}
                disabled={Boolean(score) || speech.transcribing}
                className={`px-4 py-2 rounded-lg font-medium disabled:opacity-40 ${
                  speech.recording ? 'bg-wrong text-white' : 'bg-accent text-white'
                }`}
              >
                {speech.recording ? t('stopRecording') : t('startRecording')}
              </button>
              <p className="text-sm text-muted">
                {t('heard')}:{' '}
                <span className="text-foreground">
                  {speech.transcribing ? t('voiceTranscribing') : speech.transcript || '—'}
                </span>
              </p>
            </>
          )}
        </div>
      )}

      {score && <ScoreView score={score} />}

      <div className="flex gap-2 flex-wrap">
        {!score ? (
          <button
            type="button"
            onClick={check}
            data-help="check"
            className="px-4 py-2 rounded-lg bg-accent text-white font-medium"
          >
            {t('check')}
            <span className="ml-2 text-xs opacity-80">{t('checkHint')}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={goNext}
              className="px-4 py-2 rounded-lg bg-accent text-white font-medium"
            >
              {t('next')}
            </button>
            <button
              type="button"
              onClick={retry}
              className="px-4 py-2 rounded-lg border border-border"
            >
              {t('retry')}
            </button>
          </>
        )}
      </div>
    </>
  );
}
