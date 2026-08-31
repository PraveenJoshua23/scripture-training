/**
 * Exercises the scoring, progress, and range logic without a browser.
 * Run with: npx tsx scripts/check-logic.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  firstGrapheme,
  liveWordStatuses,
  pickBlankIndices,
  scoreAttempt,
  splitWords,
} from '../src/lib/text';
import {
  PASS_THRESHOLD,
  activeStreak,
  completedInMode,
  emptyProgress,
  expireStreak,
  localDay,
  openMissed,
  recordAttempt,
} from '../src/lib/progress';
import { clampRef, expandRange, nextRef, prevRef } from '../src/lib/verses';
import { createTranscriptBuilder, type SpeechRecognitionEvent } from '../src/lib/speech';
import type { Dataset } from '../src/lib/types';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const en = JSON.parse(readFileSync('public/data/rev.en.json', 'utf8')) as Dataset;
const ta = JSON.parse(readFileSync('public/data/rev.ta.json', 'utf8')) as Dataset;

console.log('datasets');
check('English has 22 chapters / 404 verses', () => {
  assert.equal(en.chapters.length, 22);
  assert.equal(en.chapters.reduce((n, c) => n + c.verses.length, 0), 404);
});
check('Tamil is verse-aligned with English', () => {
  assert.equal(ta.chapters.length, en.chapters.length);
  en.chapters.forEach((chapter, i) => {
    assert.equal(ta.chapters[i].verses.length, chapter.verses.length, `chapter ${i + 1}`);
  });
});
check('no empty verse text in either language', () => {
  for (const dataset of [en, ta]) {
    for (const chapter of dataset.chapters) {
      for (const verse of chapter.verses) assert.ok(verse.text.length > 0);
    }
  }
});

console.log('scoring');
check('exact match scores 100', () => {
  const text = en.chapters[0].verses[0].text;
  assert.equal(scoreAttempt(text, text).accuracy, 100);
});
check('punctuation and case are forgiven', () => {
  const score = scoreAttempt('Behold, He is coming!', 'behold he is coming');
  assert.equal(score.accuracy, 100);
});
check('a dropped word costs one token, not the rest of the verse', () => {
  const score = scoreAttempt('alpha bravo charlie delta', 'alpha charlie delta');
  assert.equal(score.correct, 3);
  assert.equal(score.tokens.filter((t) => t.status === 'missing').length, 1);
});
check('an inserted word is flagged as extra', () => {
  const score = scoreAttempt('alpha bravo', 'alpha zulu bravo');
  assert.equal(score.correct, 2);
  assert.equal(score.tokens.filter((t) => t.status === 'extra').length, 1);
});
check('empty attempt scores 0', () => {
  assert.equal(scoreAttempt('alpha bravo', '').accuracy, 0);
});
check('Tamil text scores exact matches', () => {
  const text = ta.chapters[0].verses[0].text;
  assert.equal(scoreAttempt(text, text).accuracy, 100);
});

console.log('live typing feedback');
check('word being typed is not flagged early', () => {
  const statuses = liveWordStatuses('Behold he is coming', 'Beho');
  assert.equal(statuses[0], 'correct');
});
check('a finished wrong word is flagged', () => {
  const statuses = liveWordStatuses('Behold he is coming', 'Belold ');
  assert.equal(statuses[0], 'wrong');
});

console.log('blanks');
check('blank density scales the number of blanks', () => {
  const text = en.chapters[0].verses[0].text;
  const few = pickBlankIndices(text, 0.2, 3);
  const many = pickBlankIndices(text, 0.8, 3);
  assert.ok(many.length > few.length);
  assert.ok(few.length >= 1);
});
check('blank picks are deterministic for a verse', () => {
  const text = en.chapters[0].verses[0].text;
  assert.deepEqual(pickBlankIndices(text, 0.3, 7), pickBlankIndices(text, 0.3, 7));
});
check('blank indices are always in range', () => {
  const text = en.chapters[0].verses[0].text;
  const words = splitWords(text);
  for (const index of pickBlankIndices(text, 0.5, 11)) {
    assert.ok(index >= 0 && index < words.length);
  }
});
check('Tamil first grapheme keeps the vowel sign attached', () => {
  // "தே" is a base consonant plus a vowel sign — slicing by code unit splits it.
  const grapheme = firstGrapheme('தேவன்', 'ta');
  assert.ok(grapheme.length >= 1);
  assert.ok('தேவன்'.startsWith(grapheme));
});
check('English first letter is a single character', () => {
  assert.equal(firstGrapheme('Revelation', 'en'), 'R');
});

console.log('progress and streaks');
check('a passing attempt marks the verse complete in that mode', () => {
  const state = recordAttempt(emptyProgress(), {
    ref: { chapter: 1, verse: 1 },
    mode: 'typing',
    accuracy: 95,
  });
  assert.equal(completedInMode(state, 'typing'), 1);
  assert.equal(state.streak.current, 1);
});
check('a failing attempt logs a missed verse and does not complete it', () => {
  const state = recordAttempt(emptyProgress(), {
    ref: { chapter: 2, verse: 3 },
    mode: 'blanks',
    accuracy: 40,
  });
  assert.equal(completedInMode(state, 'blanks'), 0);
  assert.equal(openMissed(state).length, 1);
  assert.equal(state.streak.current, 0);
});
check('passing later resolves the earlier miss', () => {
  let state = recordAttempt(emptyProgress(), {
    ref: { chapter: 2, verse: 3 },
    mode: 'blanks',
    accuracy: 40,
  });
  state = recordAttempt(state, { ref: { chapter: 2, verse: 3 }, mode: 'blanks', accuracy: 98 });
  assert.equal(openMissed(state).length, 0);
});
check('the same verse is not logged twice while still open', () => {
  let state = recordAttempt(emptyProgress(), {
    ref: { chapter: 4, verse: 1 },
    mode: 'typing',
    accuracy: 10,
  });
  state = recordAttempt(state, { ref: { chapter: 4, verse: 1 }, mode: 'typing', accuracy: 20 });
  assert.equal(openMissed(state).length, 1);
});
check('two passes on the same day do not double the streak', () => {
  let state = recordAttempt(emptyProgress(), {
    ref: { chapter: 1, verse: 1 },
    mode: 'typing',
    accuracy: 100,
  });
  state = recordAttempt(state, { ref: { chapter: 1, verse: 2 }, mode: 'typing', accuracy: 100 });
  assert.equal(state.streak.current, 1);
});
check('a consecutive day extends the streak, a gap resets it', () => {
  const base = emptyProgress();
  const yesterday = localDay(Date.now() - 86400000);
  const longAgo = localDay(Date.now() - 5 * 86400000);

  const continued = recordAttempt(
    { ...base, streak: { current: 4, longest: 4, lastDay: yesterday } },
    { ref: { chapter: 1, verse: 1 }, mode: 'typing', accuracy: 100 },
  );
  assert.equal(continued.streak.current, 5);
  assert.equal(continued.streak.longest, 5);

  const broken = recordAttempt(
    { ...base, streak: { current: 9, longest: 9, lastDay: longAgo } },
    { ref: { chapter: 1, verse: 1 }, mode: 'typing', accuracy: 100 },
  );
  assert.equal(broken.streak.current, 1);
  assert.equal(broken.streak.longest, 9, 'longest is preserved across a broken streak');
});
check('the pass threshold is the boundary', () => {
  const justPassed = recordAttempt(emptyProgress(), {
    ref: { chapter: 1, verse: 1 },
    mode: 'typing',
    accuracy: PASS_THRESHOLD,
  });
  assert.equal(completedInMode(justPassed, 'typing'), 1);

  const justFailed = recordAttempt(emptyProgress(), {
    ref: { chapter: 1, verse: 1 },
    mode: 'typing',
    accuracy: PASS_THRESHOLD - 1,
  });
  assert.equal(completedInMode(justFailed, 'typing'), 0);
});
check('a streak read after a missed day shows as broken', () => {
  const today = localDay();
  const yesterday = localDay(Date.now() - 86400000);
  const twoDaysAgo = localDay(Date.now() - 2 * 86400000);

  assert.equal(activeStreak({ current: 6, longest: 9, lastDay: today }), 6, 'today keeps it alive');
  assert.equal(
    activeStreak({ current: 6, longest: 9, lastDay: yesterday }),
    6,
    'yesterday is still savable today',
  );
  assert.equal(
    activeStreak({ current: 6, longest: 9, lastDay: twoDaysAgo }),
    0,
    'one fully missed day breaks it',
  );
  assert.equal(activeStreak({ current: 0, longest: 0, lastDay: null }), 0);
});
check('expireStreak zeroes a broken run but keeps the longest', () => {
  const longAgo = localDay(Date.now() - 5 * 86400000);
  const expired = expireStreak({
    ...emptyProgress(),
    streak: { current: 9, longest: 12, lastDay: longAgo },
  });
  assert.equal(expired.streak.current, 0);
  assert.equal(expired.streak.longest, 12);
  assert.equal(expired.streak.lastDay, longAgo, 'lastDay is kept so the next pass restarts at 1');

  // An expired streak that is then practised restarts cleanly at 1.
  const restarted = recordAttempt(expired, {
    ref: { chapter: 1, verse: 1 },
    mode: 'typing',
    accuracy: 100,
  });
  assert.equal(restarted.streak.current, 1);
  assert.equal(restarted.streak.longest, 12);
});
check('expireStreak leaves a live streak untouched by identity', () => {
  const live = { ...emptyProgress(), streak: { current: 3, longest: 3, lastDay: localDay() } };
  assert.equal(expireStreak(live), live);
});
check('recordAttempt does not mutate the previous state', () => {
  const before = emptyProgress();
  recordAttempt(before, { ref: { chapter: 1, verse: 1 }, mode: 'typing', accuracy: 100 });
  assert.equal(Object.keys(before.verses).length, 0);
  assert.equal(before.streak.current, 0);
});

console.log('navigation and ranges');
check('a range spanning chapters expands in order', () => {
  const refs = expandRange(en, { start: { chapter: 1, verse: 19 }, end: { chapter: 2, verse: 2 } });
  assert.deepEqual(refs, [
    { chapter: 1, verse: 19 },
    { chapter: 1, verse: 20 },
    { chapter: 2, verse: 1 },
    { chapter: 2, verse: 2 },
  ]);
});
check('a reversed range is normalised rather than returning nothing', () => {
  const refs = expandRange(en, { start: { chapter: 2, verse: 2 }, end: { chapter: 1, verse: 19 } });
  assert.equal(refs.length, 4);
});
check('a whole-book range covers all 404 verses', () => {
  const refs = expandRange(en, { start: { chapter: 1, verse: 1 }, end: { chapter: 22, verse: 21 } });
  assert.equal(refs.length, 404);
});
check('next rolls over the chapter boundary and stops at the end', () => {
  assert.deepEqual(nextRef(en, { chapter: 1, verse: 20 }), { chapter: 2, verse: 1 });
  assert.equal(nextRef(en, { chapter: 22, verse: 21 }), undefined);
});
check('prev rolls back to the last verse of the previous chapter', () => {
  assert.deepEqual(prevRef(en, { chapter: 2, verse: 1 }), { chapter: 1, verse: 20 });
  assert.equal(prevRef(en, { chapter: 1, verse: 1 }), undefined);
});
check('an out-of-bounds reference is clamped into the book', () => {
  assert.deepEqual(clampRef(en, { chapter: 99, verse: 99 }), { chapter: 22, verse: 21 });
  assert.deepEqual(clampRef(en, { chapter: 0, verse: 0 }), { chapter: 1, verse: 1 });
});

console.log('voice transcript');

/** Builds an `onresult` event from `[transcript, isFinal]` pairs. */
function resultEvent(resultIndex: number, entries: [string, boolean][]): SpeechRecognitionEvent {
  const results = entries.map(([transcript, isFinal]) => ({
    0: { transcript },
    isFinal,
    length: 1,
  }));
  return {
    resultIndex,
    results: Object.assign({ length: results.length }, results),
  } as unknown as SpeechRecognitionEvent;
}

check('interim results are replaced, not accumulated', () => {
  const builder = createTranscriptBuilder();
  assert.equal(builder.add(resultEvent(0, [['the', false]])), 'the');
  assert.equal(builder.add(resultEvent(0, [['the Revelation', false]])), 'the Revelation');
  assert.equal(builder.add(resultEvent(0, [['the Revelation of', true]])), 'the Revelation of');
});

check('a final result re-delivered at the same index is not repeated', () => {
  // Chrome on Android keeps resultIndex at 0 and re-sends results that are
  // already final, which the old append-as-they-arrive logic duplicated.
  const builder = createTranscriptBuilder();
  const event = resultEvent(0, [['The Revelation of Jesus Christ', true]]);
  assert.equal(builder.add(event), 'The Revelation of Jesus Christ');
  assert.equal(builder.add(event), 'The Revelation of Jesus Christ');
  assert.equal(builder.add(event), 'The Revelation of Jesus Christ');
});

check('a growing result list keeps each phrase exactly once', () => {
  const builder = createTranscriptBuilder();
  builder.add(resultEvent(0, [['The Revelation', true]]));
  builder.add(resultEvent(1, [['The Revelation', true], ['of Jesus', false]]));
  const out = builder.add(
    resultEvent(1, [['The Revelation', true], ['of Jesus Christ', true]]),
  );
  assert.equal(out, 'The Revelation of Jesus Christ');
});

check('text is kept when the engine starts a fresh result batch', () => {
  const builder = createTranscriptBuilder();
  builder.add(resultEvent(0, [['The Revelation', true], ['of Jesus Christ', true]]));
  const out = builder.add(resultEvent(0, [['which God gave him', true]]));
  assert.equal(out, 'The Revelation of Jesus Christ which God gave him');
});

check('a final phrase grown at the same index replaces rather than repeats', () => {
  const builder = createTranscriptBuilder();
  builder.add(resultEvent(0, [['the Revelation', true]]));
  const out = builder.add(resultEvent(0, [['the Revelation from Jesus Christ', true]]));
  assert.equal(out, 'the Revelation from Jesus Christ');
});

check('new speech at a reused index is kept alongside the earlier phrase', () => {
  // Android keeps a one-entry result list across utterances, so a same-length
  // batch can still be a fresh phrase — dropping it would lose the recitation.
  const builder = createTranscriptBuilder();
  builder.add(resultEvent(0, [['the Revelation from Jesus Christ', true]]));
  const out = builder.add(resultEvent(0, [['which God gave him', true]]));
  assert.equal(out, 'the Revelation from Jesus Christ which God gave him');
});

check('the full Android event stream transcribes each word once', () => {
  const builder = createTranscriptBuilder();
  let out = '';
  for (const [text, isFinal] of [
    ['the', false],
    ['the Revelation', false],
    ['the Revelation from', true],
    ['the Revelation from', true],
    ['the Revelation from Jesus', true],
    ['the Revelation from Jesus Christ', true],
    ['which', false],
    ['which God gave him', true],
  ] as [string, boolean][]) {
    out = builder.add(resultEvent(0, [[text, isFinal]]));
  }
  assert.equal(out, 'the Revelation from Jesus Christ which God gave him');
});

check('a phrase restated at a new index each time is not repeated', () => {
  // The shape seen on Android: the engine appends each growing snapshot as a
  // *new* final result beside the old ones, rather than overwriting one slot.
  const builder = createTranscriptBuilder();
  const snapshots = [
    'revelation',
    'revelation',
    'revelation of',
    'revelation of Jesus',
    'revelation of Jesus Christ',
  ];
  let out = '';
  snapshots.forEach((_, i) => {
    const entries = snapshots.slice(0, i + 1).map((text) => [text, true] as [string, boolean]);
    out = builder.add(resultEvent(i, entries));
  });
  assert.equal(out, 'revelation of Jesus Christ');
});

check('the two restatement shapes mixed together still transcribe once', () => {
  const builder = createTranscriptBuilder();
  builder.add(resultEvent(0, [['the', false]]));
  builder.add(resultEvent(0, [['the revelation', true]]));
  builder.add(resultEvent(1, [['the revelation', true], ['the revelation of', true]]));
  builder.add(resultEvent(1, [['the revelation', true], ['the revelation of Jesus', true]]));
  const out = builder.add(
    resultEvent(2, [
      ['the revelation', true],
      ['the revelation of Jesus', true],
      ['the revelation of Jesus Christ', true],
    ]),
  );
  assert.equal(out, 'the revelation of Jesus Christ');
});

check('punctuation added when a result is finalised does not hide a restatement', () => {
  const builder = createTranscriptBuilder();
  builder.add(resultEvent(0, [['The Revelation of Jesus Christ', true]]));
  const out = builder.add(
    resultEvent(1, [
      ['The Revelation of Jesus Christ', true],
      ['The Revelation of Jesus Christ, which God gave Him', true],
    ]),
  );
  assert.equal(out, 'The Revelation of Jesus Christ, which God gave Him');
});

check('a restatement does not swallow a longer word that starts the same', () => {
  const builder = createTranscriptBuilder();
  const out = builder.add(resultEvent(1, [['revelation', true], ['revelations of John', true]]));
  assert.equal(out, 'revelation revelations of John');
});

check('genuinely new speech after a restated phrase is kept', () => {
  const builder = createTranscriptBuilder();
  builder.add(resultEvent(0, [['the revelation', true]]));
  builder.add(resultEvent(1, [['the revelation', true], ['the revelation of Jesus Christ', true]]));
  const out = builder.add(
    resultEvent(2, [
      ['the revelation', true],
      ['the revelation of Jesus Christ', true],
      ['which God gave him', true],
    ]),
  );
  assert.equal(out, 'the revelation of Jesus Christ which God gave him');
});

check('reset clears both banked and in-flight text', () => {
  const builder = createTranscriptBuilder();
  builder.add(resultEvent(0, [['The Revelation', true], ['of Jesus', true]]));
  builder.add(resultEvent(0, [['which God gave him', true]]));
  builder.reset();
  assert.equal(builder.add(resultEvent(0, [['Blessed is he', true]])), 'Blessed is he');
});

check('Tamil results behave the same as English', () => {
  const builder = createTranscriptBuilder();
  const event = resultEvent(0, [['சீக்கிரத்தில் சம்மதிக்க', true]]);
  assert.equal(builder.add(event), 'சீக்கிரத்தில் சம்மதிக்க');
  assert.equal(builder.add(event), 'சீக்கிரத்தில் சம்மதிக்க');
});

console.log(`\n${passed} checks passed`);
