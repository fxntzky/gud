import test from 'node:test';
import assert from 'node:assert/strict';
import { appliedReviewMap, composeEditorialEdition, resolveAuditUrls } from '../server/learning/editorialCuration.js';

const article = (id) => ({
  id, title: `Headline ${id}`, url: `https://example.com/${id}`, source: `Source ${id}`,
  publishedAt: '2026-09-29T07:00:00.000Z', category: 'science', language: 'en', score: 12,
});
const base = (count = 7) => ({
  editionDate: '2026-09-29', edition: 'english', language: 'en',
  generatedAt: '2026-09-29T08:00:00.000Z', articles: Array.from({ length: count }, (_, i) => article(`auto-${i}`)),
  count, uniqueSources: count, diagnostics: {},
});
const audit = (count = 7) => ([
  ...base(count).articles.map((a) => ({ ...a, lane: 'shortlist', published: true })),
  { id: 'explore-one', title: 'UNESCO starts literacy programme',
    url: 'https://www.unesco.org/en/articles/example', source: 'UNESCO',
    category: 'education', deck: 'Confirmed launch of local education initiative.',
    lane: 'exploration', published: false },
]);
const ids = (payload) => payload.articles.map((a) => a.id);

test('no human review: the automatic edition is unchanged and requires no editorial promotion', () => {
  const original = base();
  const result = composeEditorialEdition(original, audit(), new Map());
  assert.deepEqual(result.articles, original.articles);
  assert.equal(result.count, 7);
  assert.equal(original.curatedAt, undefined);
});

test('NO withdraws a published false positive; IRRELEVANT withdraws a positive but low-interest story', () => {
  const labels = new Map([['auto-0', 'not_constructive'], ['auto-1', 'irrelevant']]);
  const result = composeEditorialEdition(base(), audit(), labels);
  assert.equal(result.count, 5);
  assert.ok(!ids(result).includes('auto-0'));
  assert.ok(!ids(result).includes('auto-1'));
});

test('YES in Exploration promotes a previously rejected article with a valid original link', () => {
  const labels = new Map([['explore-one', 'constructive']]);
  const result = composeEditorialEdition(base(), audit(), labels);
  assert.equal(result.count, 8);
  assert.equal(result.articles[0].id, 'explore-one');
  assert.equal(result.articles[0].language, 'en');
  assert.equal(result.articles[0].category, 'education');
  assert.equal(result.articles[0].excerpt, 'Confirmed launch of local education initiative.');
  // Today's audit log predates capture of publication dates. Don't invent one.
  assert.equal(result.articles[0].publishedAt, '');
});

test('manual YES on a non-published shortlist entry also promotes it', () => {
  const entries = audit();
  entries.push({ ...article('shortlist-extra'), published: false, lane: 'shortlist' });
  const result = composeEditorialEdition(base(), entries, new Map([['shortlist-extra', 'constructive']]));
  assert.equal(result.articles[0].id, 'shortlist-extra');
});

test('manual YES outranks automatic items under the 12-item cap', () => {
  const original = base(12);
  const result = composeEditorialEdition(original, audit(12), new Map([['explore-one', 'constructive']]));
  assert.equal(result.count, 12);
  assert.equal(result.articles[0].id, 'explore-one');
  assert.ok(!ids(result).includes('auto-11'));
});

test('never silently drop an explicitly approved story due to cap', () => {
  const labels = new Map(base(12).articles.map((item) => [item.id, 'constructive']));
  labels.set('explore-one', 'constructive');
  assert.throws(() => composeEditorialEdition(base(12), audit(12), labels), /maximum is 12/);
});

test('clear removes prior override and restores original automatic story', () => {
  const labels = appliedReviewMap([{ id: 'auto-0', label: 'not_constructive' }], [
    { id: 'auto-0', label: 'clear' },
  ]);
  assert.ok(!labels.has('auto-0'));
  assert.equal(composeEditorialEdition(base(), audit(), labels).count, 7);
});

test('opinion can change: NO then YES restores the article as positive', () => {
  const labels = appliedReviewMap([{ id: 'auto-0', label: 'not_constructive' }], [
    { id: 'auto-0', label: 'constructive' },
  ]);
  assert.ok(ids(composeEditorialEdition(base(), audit(), labels)).includes('auto-0'));
});

test('cannot promote a missing or unsafe original source URL', () => {
  const entries = audit();
  entries[entries.length - 1].url = 'javascript:alert(1)';
  assert.throws(() => composeEditorialEdition(base(), entries, new Map([['explore-one', 'constructive']])), /metadata/);
});

test('an all-rejected human edition remains empty; do not pad it with fallback stories', () => {
  const labels = new Map(base().articles.map((item) => [item.id, 'not_constructive']));
  const result = composeEditorialEdition(base(), audit(), labels);
  assert.equal(result.count, 0);
  assert.deepEqual(result.articles, []);
});

test('automatic edition remains untouched for subsequent dates', () => {
  const first = base();
  composeEditorialEdition(first, audit(), new Map([['auto-0', 'not_constructive']]));
  const next = { ...base(), editionDate: '2026-09-30' };
  assert.equal(composeEditorialEdition(next, audit(), new Map()).count, 7);
  assert.equal(first.count, 7);
});


test('legacy Exploration URL is supplied once by the editor and persists across later revisions', () => {
  const noUrl = audit();
  const url = noUrl[noUrl.length - 1].url;
  delete noUrl[noUrl.length - 1].url;
  const resolved = resolveAuditUrls(noUrl, [{ id: 'explore-one', label: 'constructive', sourceUrl: url }], []);
  assert.equal(resolved.at(-1).url, url);
  assert.equal(composeEditorialEdition(base(), resolved, new Map([['explore-one', 'constructive']])).count, 8);
  const later = resolveAuditUrls(noUrl, [{ id: 'auto-0', label: 'not_constructive' }], [
    { id: 'explore-one', label: 'constructive', url },
  ]);
  assert.equal(later.at(-1).url, url);
});
