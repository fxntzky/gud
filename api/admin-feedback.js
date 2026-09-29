import { dangerouslyDeleteByTag } from '@vercel/functions';
import { authorizedAdmin } from '../server/learning/adminAuth.js';
import { readTelemetry } from '../server/learning/telemetryStore.js';
import { validateReviewBatch } from '../server/learning/reviewLogic.js';
import { getEditionReviews, saveEditorialReviewBatch } from '../server/learning/feedbackStore.js';
import { readDailyEdition } from '../server/dailyEditionStore.js';
import { EDITORIAL_RULESET_VERSION, EDITION_LIMIT } from '../server/edition.js';
import { appliedReviewMap, composeEditorialEdition, resolveAuditUrls } from '../server/learning/editorialCuration.js';
import { commitCuratedEdition } from '../server/learning/curatedEditionStore.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!authorizedAdmin(req)) return res.status(401).json({ error: 'Unauthorized.' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Invalid JSON.' }); }

  const { date, edition, reviews } = body || {};
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !['english', 'latam'].includes(edition)) {
    return res.status(400).json({ error: 'Invalid edition or date.' });
  }
  const age = (Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`) -
    Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(age) || age < 0 || age > 14) {
    return res.status(400).json({ error: 'Date outside editable window.' });
  }
  try {
    const key = { editionDate: date, edition, rulesetVersion: EDITORIAL_RULESET_VERSION };
    const [telemetry, base, prior] = await Promise.all([
      readTelemetry(date, edition), readDailyEdition(key), getEditionReviews(date, edition),
    ]);
    if (!base || !telemetry?.decisions) return res.status(404).json({ error: 'No reviewable edition for this date.' });
    const byId = new Map(telemetry.decisions.map((item) => [item.id, item]));
    const check = validateReviewBatch(reviews, new Set(byId.keys()));
    if (!check.valid) return res.status(400).json({ error: check.error });
    const labels = appliedReviewMap(prior, reviews);
    // Historical Exploration entries may require a one-time source URL paste.
    const resolvedDecisions = resolveAuditUrls(telemetry.decisions, reviews, prior);
    const resolvedById = new Map(resolvedDecisions.map((row) => [row.id, row]));
    let curated;
    try {
      curated = composeEditorialEdition(base, resolvedDecisions, labels, EDITION_LIMIT);
    } catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : 'Invalid editorial selection.' });
    }
    // Feedback is recorded first. A failed derived-publication write leaves the
    // draft retryable; repeating SAVE is idempotent at the classification level.
    const saved = await saveEditorialReviewBatch({
      editionDate: date, edition,
      changes: reviews.map(({ id, label }) => ({ article: resolvedById.get(id), label })),
    });
    await commitCuratedEdition(key, curated);
    // The public CDN keeps its full-day cache in normal operation. One admin
    // SAVE clears only this edition's cached response, so the very next request
    // reads the edited shared snapshot instead of receiving one stale copy.
    await dangerouslyDeleteByTag(`gud-${date}-${edition}-${EDITORIAL_RULESET_VERSION}`, {
      revalidationDeadlineSeconds: 0,
    });
    return res.status(201).json({
      saved: saved.length,
      reviews: saved.map(({ id, label, reviewedAt }) => ({ id, label, reviewedAt })),
      publication: {
        count: curated.count, curatedAt: curated.curatedAt,
        articles: curated.articles.map(({ id, url }) => ({ id, url })),
      },
    });
  } catch (error) {
    console.error('GUD editorial batch review write error:', error);
    return res.status(503).json({ error: 'Unable to finish saving or publishing the review. The review draft is preserved in your tab; retry SAVE. The saved feedback remains intact.' });
  }
}
