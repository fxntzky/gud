import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LATAM_EXPLORATION_LIMIT, LATAM_OUTCOME_TARGET,
  retainLatamDiagnostic, selectLatamDiagnosticExploration,
} from '../server/learning/explorationSampler.js';

const date = '2026-09-30';
const candidate = (source, number, reason = 'missing_legacy_outcome', mlLabel = 'constructive') => ({
  id: `${source}-${reason}-${number}`,
  title: `Example ${number}`,
  sourceId: `source-${source}`,
  source: `Publisher ${source}`,
  category: ['science', 'education', 'nature', 'society', 'health', 'culture'][number % 6],
  mlLabel,
  mlScore: mlLabel === 'constructive' ? 0.56 : 0.43,
  reason,
  url: `https://example.org/${source}/${number}`,
  deck: 'Feed excerpt retained for human inspection',
});

test('LATAM retention is bounded per publisher and does not require high ML scores', () => {
  const pool = [];
  for (let i = 0; i < 70; i++) {
    retainLatamDiagnostic(pool, candidate(1, i, 'missing_legacy_outcome', i % 2 ? 'constructive' : 'not_constructive'), date);
    retainLatamDiagnostic(pool, candidate(1, i, 'below_rule_score', 'not_constructive'), date);
  }
  assert.equal(pool.filter(x => x.reason === 'missing_legacy_outcome').length, 8);
  assert.equal(pool.filter(x => x.reason === 'below_rule_score').length, 3);
  assert.ok(pool.some(x => x.mlScore < 0.55), 'no ML confidence floor for LATAM diagnostics');
  const reversed = [];
  for (let i = 69; i >= 0; i--) {
    retainLatamDiagnostic(reversed, candidate(1, i, 'missing_legacy_outcome', i % 2 ? 'constructive' : 'not_constructive'), date);
    retainLatamDiagnostic(reversed, candidate(1, i, 'below_rule_score', 'not_constructive'), date);
  }
  assert.deepEqual(pool.map(x => x.id).sort(), reversed.map(x => x.id).sort());
});

test('LATAM diagnostic queue prioritizes noPositiveOutcome with diverse classes, sources and categories', () => {
  const diagnostics = Array.from({ length: 24 }, (_, source) => {
    const exploration = [];
    for (let i = 0; i < 8; i++) {
      retainLatamDiagnostic(exploration, candidate(source, i, 'missing_legacy_outcome', i % 2 ? 'constructive' : 'not_constructive'), date);
    }
    for (let i = 0; i < 3; i++) {
      retainLatamDiagnostic(exploration, candidate(source, 100 + i, i % 2 ? 'legacy_false_positive' : 'below_rule_score'), date);
    }
    return { sourceId: `source-${source}`, exploration };
  });
  const first = selectLatamDiagnosticExploration(diagnostics, date);
  const second = selectLatamDiagnosticExploration([...diagnostics].reverse(), date);
  assert.equal(first.selected.length, LATAM_EXPLORATION_LIMIT);
  assert.equal(first.diagnostics.selectedOutcome, LATAM_OUTCOME_TARGET);
  assert.equal(first.diagnostics.selectedOther, LATAM_EXPLORATION_LIMIT - LATAM_OUTCOME_TARGET);
  assert.equal(new Set(first.selected.map(x => x.id)).size, LATAM_EXPLORATION_LIMIT);
  assert.ok(first.diagnostics.sampledPublisherCount >= 12);
  assert.ok(first.diagnostics.sampledCategoryCount >= 4);
  assert.ok(first.selected.some(x => x.mlLabel === 'constructive'));
  assert.ok(first.selected.some(x => x.mlLabel === 'not_constructive'));
  assert.ok(first.selected.every(x => x.url.startsWith('https://')));
  assert.deepEqual(first.selected.map(x => x.id), second.selected.map(x => x.id), 'stable diagnostic selection');
});

test('sparse diagnostic pool returns available items without padding or inventing stories', () => {
  const rows = [candidate(1, 1), candidate(2, 2, 'below_rule_score')];
  const selected = selectLatamDiagnosticExploration([{ exploration: rows }], date);
  assert.equal(selected.selected.length, 2);
  assert.equal(selected.diagnostics.selectedOutcome, 1);
  assert.equal(selected.diagnostics.selectedOther, 1);
});
