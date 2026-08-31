'use client';

import { useState, useSyncExternalStore } from 'react';
import { PracticeShell } from '@/components/PracticeShell';
import { ScoreView } from '@/components/ScoreView';
import { useStore } from '@/lib/store';
import { getVerse, nextRef } from '@/lib/verses';
import { scoreAttempt, type Score } from '@/lib/text';
import { useVoiceTranscription, type TranscribeLogEntry } from '@/lib/transcribe';
import type { Verse, VerseRef } from '@/lib/types';

export default function VoicePage() {
  const { dataset, t, currentRef } = useStore();
  const verse = dataset ? getVerse(dataset, currentRef) : undefined;

  return (
    <PracticeShell title={t('voice')} hint={t('voicePrompt')} helpAnchor="voice">
      {verse && (
        // Keyed on the reference so moving to another verse starts a clean attempt.
        <VoicePractice
          key={`${currentRef.chapter}:${currentRef.verse}`}
          verse={verse}
          ref_={currentRef}
        />
      )}
    </PracticeShell>
  );
}

function formatLog(entries: TranscribeLogEntry[]): string {
  return entries
    .map((entry) => `${String(entry.at).padStart(6, ' ')}ms ${entry.detail}`)
    .join('\n');
}

/**
 * Shows what happened during a recitation behind `?debug=1`: the container the
 * browser recorded, how much audio it produced, and how the transcription
 * request fared. Enough to tell a microphone problem from a service one.
 */
function RecordingLog({ entries }: { entries: TranscribeLogEntry[] }) {
  const { t } = useStore();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatLog(entries));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the text is selectable either way.
    }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted">{t('voiceLogTitle')}</p>
        <button
          type="button"
          onClick={copy}
          disabled={entries.length === 0}
          className="text-xs px-2 py-1 rounded border border-border disabled:opacity-40"
        >
          {copied ? t('voiceLogCopied') : t('voiceLogCopy')}
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted">{t('voiceLogEmpty')}</p>
      ) : (
        <pre className="text-[11px] leading-snug text-muted max-h-64 overflow-auto whitespace-pre-wrap break-all select-all">
          {formatLog(entries)}
        </pre>
      )}
    </div>
  );
}

/** Maps a failure from the recorder or the endpoint onto what to tell the user. */
function errorKey(error: string) {
  switch (error) {
    case 'mic-blocked':
      return 'voiceMicBlocked' as const;
    case 'network':
      return 'voiceNetworkError' as const;
    case 'no-endpoint':
      return 'voiceNoEndpoint' as const;
    case 'no-speech':
    case 'no-audio':
      return 'voiceNoSpeech' as const;
    case 'server':
      return 'voiceServerError' as const;
    default:
      return 'voiceGenericError' as const;
  }
}

const noopSubscribe = () => () => {};

/**
 * The recognition log is a diagnostic rather than a feature, so it stays behind
 * `?debug=1`. The query string is read as an external snapshot rather than
 * through `useSearchParams` because every route here is prerendered to static
 * HTML, and it reports false during that prerender.
 */
function useDebugFlag(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).has('debug'),
    () => false,
  );
}

function VoicePractice({ verse, ref_ }: { verse: Verse; ref_: VerseRef }) {
  const { dataset, t, setRef, record, settings } = useStore();
  const [score, setScore] = useState<Score | null>(null);
  const speech = useVoiceTranscription(settings.lang);
  const debug = useDebugFlag();

  const check = () => {
    if (score) return;
    const result = scoreAttempt(verse.text, speech.transcript);
    setScore(result);
    record({ ref: ref_, mode: 'voice', accuracy: result.accuracy });
  };

  const retry = () => {
    setScore(null);
    speech.reset();
  };

  const goNext = () => {
    if (!dataset) return;
    const to = nextRef(dataset, ref_);
    if (to) setRef(to);
  };

  return (
    <>
      {!speech.supported ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          {t('voiceUnsupported')}
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={speech.recording ? speech.stop : speech.start}
              data-help="voiceRecord"
              disabled={Boolean(score) || speech.transcribing}
              className={`px-4 py-2 rounded-lg font-medium disabled:opacity-40 ${
                speech.recording ? 'bg-wrong text-white' : 'bg-accent text-white'
              }`}
            >
              {speech.recording ? t('stopRecording') : t('startRecording')}
            </button>
            {(speech.recording || speech.transcribing) && (
              <span className="text-sm text-muted flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-wrong animate-pulse" />
                {speech.recording ? t('listening_') : t('voiceTranscribing')}
              </span>
            )}
          </div>

          <div data-help="voiceHeard">
            <p className="text-xs uppercase tracking-wide text-muted mb-1">{t('heard')}</p>
            <p
              className={`scripture-${settings.lang} min-h-[3rem] leading-relaxed`}
              style={{ fontSize: `${settings.fontSize}px` }}
              lang={settings.lang}
              aria-live="polite"
            >
              {speech.transcript || <span className="text-muted">—</span>}
            </p>
          </div>

          {speech.error && (
            <p className="text-sm text-wrong">
              {t(errorKey(speech.error))}
              {debug && <span className="text-muted"> ({speech.error})</span>}
            </p>
          )}

          {debug && <RecordingLog entries={speech.log} />}
        </div>
      )}

      {score && <ScoreView score={score} />}

      <div className="flex gap-2 flex-wrap">
        {!score ? (
          <button
            type="button"
            onClick={check}
            data-help="check"
            disabled={!speech.transcript.trim() || speech.transcribing}
            className="px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-40"
          >
            {t('check')}
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
