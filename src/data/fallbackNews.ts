import type { NewsArticle, NewsEdition } from '../types/news';

export const fallbackNews: Record<NewsEdition, NewsArticle[]> = {
  english: [
    {
      id: 'fallback-en-1',
      title: 'The shared edition is not available yet.',
      url: '#',
      source: 'GUD',
      publishedAt: new Date().toISOString(),
      category: 'society',
      language: 'en',
      excerpt:
        'GUD does not fetch or classify news for individual visitors. The next scheduled edition will appear here.',
      score: 10,
    },
  ],
  latam: [
    {
      id: 'fallback-latam-1',
      title: 'La edición compartida todavía no está disponible.',
      url: '#',
      source: 'GUD',
      publishedAt: new Date().toISOString(),
      category: 'society',
      language: 'es',
      excerpt:
        'GUD no consulta ni clasifica noticias por visitante. La próxima edición programada aparecerá aquí.',
      score: 10,
    },
  ],
};
