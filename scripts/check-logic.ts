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
  completedInMode,
  emptyProgress,
  localDay,
  openMissed,
  recordAttempt,
} from '../src/lib/progress';
import { clampRef, expandRange, nextRef, prevRef } from '../src/lib/verses';
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

console.log(`\n${passed} checks passed`);
