import type { NewsArticle } from '../types/news';

export const fallbackNews: NewsArticle[] = [
  {
    id: 'fallback-1',
    title: 'The newspaper is ready. Live stories arrive when the RSS endpoint is running.',
    url: '#',
    source: 'GUD',
    publishedAt: new Date().toISOString(),
    category: 'world',
    excerpt:
      'Run the project with Vercel Dev to activate the serverless RSS endpoint locally.',
    score: 10,
  },
];
