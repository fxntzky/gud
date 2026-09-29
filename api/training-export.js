import { authorizedAdmin } from '../server/learning/adminAuth.js';
import { getReviewedTrainingRows } from '../server/learning/feedbackStore.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!authorizedAdmin(req)) return res.status(401).json({ error: 'Unauthorized.' });
  try {
    const rows = await getReviewedTrainingRows();
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    return res.status(200).send(rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
  } catch (error) {
    console.error('GUD training export unavailable:', error);
    return res.status(503).json({ error: 'Unable to export validated reviews.' });
  }
}
