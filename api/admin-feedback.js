import { authorizedAdmin } from '../server/learning/adminAuth.js';
import { readTelemetry } from '../server/learning/telemetryStore.js';
import { saveEditorialReviewBatch } from '../server/learning/feedbackStore.js';
import { validateReviewBatch } from '../server/learning/reviewLogic.js';

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
    const telemetry = await readTelemetry(date, edition);
    if (!telemetry?.decisions) return res.status(404).json({ error: 'No reviewable edition for this date.' });
    const byId = new Map(telemetry.decisions.map((item) => [item.id, item]));
    const check = validateReviewBatch(reviews, new Set(byId.keys()));
    if (!check.valid) return res.status(400).json({ error: check.error });
    const saved = await saveEditorialReviewBatch({
      editionDate: date, edition,
      changes: reviews.map(({ id, label }) => ({ article: byId.get(id), label })),
    });
    return res.status(201).json({
      saved: saved.length,
      reviews: saved.map(({ id, label, reviewedAt }) => ({ id, label, reviewedAt })),
    });
  } catch (error) {
    console.error('GUD editorial batch review write error:', error);
    return res.status(503).json({ error: 'Unable to save the editorial review.' });
  }
}
