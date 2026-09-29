import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReviewBatch, flattenReviewRecords, latestReviewRecords, toTrainingRow,
} from '../server/learning/reviewLogic.js';

const a = 'a'.repeat(40);
const b = 'b'.repeat(40);
const ids = new Set([a, b]);
const row = (id, label, reviewedAt, title = 'News headline') => ({
  editionDate: '2026-09-29', edition: 'english', id, label, title,
  deck: 'Context', reviewedAt,
});

test('single save batch validates three editorial choices and clear', () => {
  assert.equal(validateReviewBatch([
    { id: a, label: 'constructive' }, { id: b, label: 'irrelevant' },
  ], ids).valid, true);
  assert.equal(validateReviewBatch([{ id: a, label: 'clear' }], ids).valid, true);
  assert.equal(validateReviewBatch([{ id: a, label: 'not_constructive' }], ids).valid, true);
});

test('batch rejects duplicates, unknown IDs, legacy uncertainty and oversized input', () => {
  const invalid = [
    [], [{ id: a, label: 'constructive' }, { id: a, label: 'irrelevant' }],
    [{ id: 'f'.repeat(40), label: 'constructive' }], [{ id: a, label: 'uncertain' }],
    Array.from({ length: 41 }, () => ({ id: a, label: 'constructive' })),
  ];
  for (const changes of invalid) assert.equal(validateReviewBatch(changes, ids).valid, false);
});

test('daily diagnostic review can save an entire 34-article queue in one batch', () => {
  const rows = Array.from({ length: 34 }, (_, i) => ({
    id: i.toString(16).padStart(40, '0'), label: 'constructive',
  }));
  assert.equal(validateReviewBatch(rows, new Set(rows.map(x => x.id))).valid, true);
});

test('old per-item records and new one-write batches are both readable', () => {
  const docs = [
    row(a, 'constructive', '2026-09-29T16:00:00.000Z'),
    { kind: 'editorial_review_batch', reviews: [
      row(a, 'irrelevant', '2026-09-29T16:20:00.000Z'),
      row(b, 'not_constructive', '2026-09-29T16:20:00.000Z'),
    ] },
  ];
  const latest = latestReviewRecords(flattenReviewRecords(docs));
  assert.equal(latest.length, 2);
  assert.equal(latest.find((entry) => entry.id === a)?.label, 'irrelevant');
  assert.equal(latest.find((entry) => entry.id === b)?.label, 'not_constructive');
});

test('clearing a saved vote does not resurrect an earlier label', () => {
  const latest = latestReviewRecords([
    row(a, 'constructive', '2026-09-29T16:00:00.000Z'),
    row(a, 'clear', '2026-09-29T16:20:00.000Z'),
  ]);
  assert.deepEqual(latest, []);
});

test('IRRELEVANT trains positive classification but low editorial relevance', () => {
  const boring = toTrainingRow(row(a, 'irrelevant', '2026-09-29T16:00:00.000Z'));
  assert.equal(boring.label, 'constructive');
  assert.equal(boring.editorialDecision, 'irrelevant');
  assert.equal(boring.editorialRelevance, 'low');
  assert.equal(toTrainingRow(row(b, 'constructive', '2026-09-29T16:00:00.000Z')).editorialRelevance, 'high');
  assert.equal(toTrainingRow(row(a, 'not_constructive', '2026-09-29T16:00:00.000Z')).label, 'not_constructive');
  assert.equal(toTrainingRow(row(a, 'clear', '2026-09-29T16:00:00.000Z')), null);
  assert.equal(toTrainingRow(row(a, 'uncertain', '2026-09-29T16:00:00.000Z')), null);
});


test('historical source URL accepts only sensible HTTP(S) input on YES', () => {
  assert.equal(validateReviewBatch([
    { id: a, label: 'constructive', sourceUrl: 'https://www.unesco.org/en/articles/example' },
  ], ids).valid, true);
  assert.equal(validateReviewBatch([
    { id: a, label: 'constructive', sourceUrl: 'javascript:alert(1)' },
  ], ids).valid, false);
  assert.equal(validateReviewBatch([
    { id: a, label: 'not_constructive', sourceUrl: 'https://example.org/story' },
  ], ids).valid, false);
});
