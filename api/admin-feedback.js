import { authorizedAdmin } from '../server/learning/adminAuth.js';
import { readTelemetry } from '../server/learning/telemetryStore.js';
import { saveEditorialReview } from '../server/learning/feedbackStore.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!authorizedAdmin(req)) return res.status(401).json({ error: 'Unauthorized.' });
  try {
    const { date, edition, id, label } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !['english', 'latam'].includes(edition) ||
        !/^[a-f0-9]{40}$/.test(id || '') ||
        !['constructive', 'not_constructive', 'uncertain'].includes(label)) {
      return res.status(400).json({ error: 'Invalid review.' });
    }
    const telemetry = await readTelemetry(date, edition);
    const article = telemetry?.decisions?.find((entry) => entry.id === id);
    if (!article) return res.status(404).json({ error: 'Article not in the private shortlist.' });
    const saved = await saveEditorialReview({
      editionDate: date, edition, id, label,
      title: article.title, deck: article.deck || '', source: article.source,
      previous: { mlLabel: article.mlLabel, llm: article.llm, published: article.published },
    });
    return res.status(201).json({ id: saved.id, label: saved.label, reviewedAt: saved.reviewedAt });
  } catch (error) {
    console.error('GUD editorial review write error:', error);
    return res.status(503).json({ error: 'Unable to save the review.' });
  }
}
