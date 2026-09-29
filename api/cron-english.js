import newsHandler from './goodnews.js';
export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.query = { ...req.query, edition: 'english' };
  return newsHandler(req, res);
}
