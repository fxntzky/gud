import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { editorialGuard } from '../server/classification/editorialGuard.js';
import { hasDisqualifyingSignal, hasFalsePositiveSignal, hasQualifyingOutcome, scoreGoodNews } from '../server/goodNewsScore.js';
import { classifyML, getMLStatus } from '../server/classification/mlClassifier.js';

// These are independent regression examples, not ML training data or factual
// verification of the source articles. Two headlines were visible in a user
// screenshot of the earlier GUD edition; remaining examples are synthetic.
const { observed, negativeVariants, constructiveControls } = JSON.parse(
  readFileSync(new URL('./fixtures/editorial-regressions.json', import.meta.url), 'utf8'),
);

// Mirrors the current production order in api/goodnews.js. In particular, the
// cheap title guard runs before resolving the page deck, running ML or forming
// the shortlist that might reach the paid LLM. These tests demand an EARLY veto.
test('observed false positives are blocked by the title-only prefetch guard', () => {
  for (const row of observed) {
    assert.equal(editorialGuard({ title: row.title }), row.expectedVeto, row.id);
    assert.equal(editorialGuard({ title: row.title, deck: row.deck }), row.expectedVeto, row.id);
  }
});

test('new phrasings of the same adverse event types are excluded before ML / LLM', () => {
  for (const row of negativeVariants) {
    assert.equal(editorialGuard({ title: row.title }), row.expectedVeto, row.title);
  }
});

test('an adverse event in historical context does not veto a constructive headline', () => {
  for (const row of constructiveControls) {
    assert.equal(editorialGuard({ title: row.title }), null, row.title);
  }
});

test('observed headlines have a documented local-gate outcome, independently of ML', () => {
  assert.equal(getMLStatus().mode, 'advisory');
  for (const row of observed) {
    const prefetchVeto = hasDisqualifyingSignal(row.title, row.title, '') ||
      editorialGuard({ title: row.title });
    assert.ok(prefetchVeto, row.id);
    // Diagnostic only: legacy positivity is not allowed to override a veto.
    const input = { title: row.title, deck: row.deck, excerpt: row.deck, category: 'science' };
    const combined = `${row.title} ${row.deck}`;
    assert.ok(typeof hasFalsePositiveSignal(input) === 'boolean');
    assert.ok(typeof hasQualifyingOutcome(input) === 'boolean');
    assert.ok(Number.isFinite(scoreGoodNews(combined, row.title, row.deck)));
    assert.ok(['constructive', 'not_constructive', 'unknown'].includes(classifyML(row).label));
  }
});
