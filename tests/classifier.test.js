import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialGuard } from '../server/classification/editorialGuard.js';
import { classifyML, getMLStatus } from '../server/classification/mlClassifier.js';
import { auditShortlist } from '../server/classification/llmAuditor.js';
import { EDITION_MIN_TARGET, EDITION_LIMIT } from '../server/edition.js';

test('edition target is 4, max is 12', () => {
  assert.equal(EDITION_MIN_TARGET, 4);
  assert.equal(EDITION_LIMIT, 12);
});

test('unilateral military and sports victories are not constructive progress', () => {
  const headlines = [
    'Ukrainian forces restored control of strategic positions',
    'Ukraine celebrates successful military offensive',
    'Ukraine retakes villages from Russian forces',
    'Military engineers successfully launch a new missile system',
    'A football team defeats rivals and wins the championship',
    'Equipo de fútbol gana la final ante su rival',
    'Fuerzas militares capturan nuevas posiciones',
  ];
  for (const title of headlines) assert.ok(editorialGuard({ title }), title);
});

test('climate deterioration is not accidentally promoted by recovery or discovery vocabulary', () => {
  const headlines = [
    'Climate change threatens coral reef recovery in warming oceans',
    'Restored reefs face record losses as warming intensifies',
    'Scientists discover an alarming decline in rainforest biodiversity',
    'El cambio climático acelera el deshielo y científicos descubren una nueva propiedad del hielo',
    'New record of accelerating global warming worries researchers',
  ];
  for (const title of headlines) assert.ok(editorialGuard({ title }), title);
});

test('constructive restoration and aid are not blocked merely for mentioning previous harm', () => {
  const headlines = [
    'Scientists restore a damaged wetland after years of conservation',
    'A hospital opens free clinics after a natural disaster',
    'Volunteers rebuild homes for displaced families',
    'Tras la sequía, restauran un humedal y regresa la fauna',
  ];
  for (const title of headlines) assert.equal(editorialGuard({ title }), null, title);
});

test('bootstrapped local ML is advisory until independently validated', () => {
  const status = getMLStatus();
  assert.ok(status.available);
  assert.ok(status.trainingSamples >= 30);
  assert.equal(status.mode, 'advisory');
  const result = classifyML({ title: 'Volunteers restore a public library' });
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
});

test('LLM is truly disabled by default without configured key', async () => {
  const prior = process.env.GUD_LLM_ENABLED;
  const key = process.env.OPENAI_API_KEY;
  process.env.GUD_LLM_ENABLED = 'false';
  delete process.env.OPENAI_API_KEY;
  try {
    const result = await auditShortlist(Array.from({ length: 800 }, (_, i) => ({ id: `${i}`, title: 'sample' })));
    assert.equal(result.meta.enabled, false);
    assert.equal(result.meta.calls, 0);
    assert.equal(result.decisions.size, 0);
  } finally {
    if (prior === undefined) delete process.env.GUD_LLM_ENABLED;
    else process.env.GUD_LLM_ENABLED = prior;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});

test('LLM paid stage never sees more than 18 shortlisted items', async () => {
  const prior = Object.fromEntries(['GUD_LLM_ENABLED', 'OPENAI_API_KEY', 'GUD_MAX_AUDIT_ARTICLES', 'GUD_MAX_LLM_TOKENS_PER_EDITION'].map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const sent = [];
  process.env.GUD_LLM_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.GUD_MAX_AUDIT_ARTICLES = '18';
  process.env.GUD_MAX_LLM_TOKENS_PER_EDITION = '14000';
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const batch = JSON.parse(request.messages[1].content);
    sent.push(...batch);
    return { ok: true, json: async () => ({
      usage: { prompt_tokens: 300, completion_tokens: 60, total_tokens: 360 },
      choices: [{ message: { content: JSON.stringify({ decisions: batch.map((entry) => ({ id: entry.id, eligible: false, reason: 'test' })) }) } }],
    }) };
  };
  try {
    const pool = Array.from({ length: 800 }, (_, i) => ({ id: `id${i}`, title: 'Generic test article', deck: '', category: 'science' }));
    const result = await auditShortlist(pool);
    assert.ok(result.meta.calls <= 3);
    assert.equal(sent.length, 18);
    assert.equal(result.decisions.size, 18);
    assert.equal(sent.some((entry) => entry.id === 'id18'), false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
