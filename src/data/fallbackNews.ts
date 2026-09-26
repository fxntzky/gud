import type { NewsArticle, NewsEdition } from '../types/news';

export const fallbackNews: Record<NewsEdition, NewsArticle[]> = {
  english: [
    {
      id: 'fallback-en-1',
      title: 'The newspaper is ready. Live stories arrive when the RSS endpoint is running.',
      url: '#',
      source: 'GUD',
      publishedAt: new Date().toISOString(),
      category: 'society',
      language: 'en',
      excerpt:
        'Run the project with Vercel Dev to activate the serverless RSS endpoint locally.',
      score: 10,
    },
  ],
  latam: [
    {
      id: 'fallback-latam-1',
      title: 'El diario está listo. Las noticias llegan cuando el endpoint RSS está activo.',
      url: '#',
      source: 'GUD',
      publishedAt: new Date().toISOString(),
      category: 'society',
      language: 'es',
      excerpt:
        'Ejecuta el proyecto con Vercel Dev para activar el endpoint RSS local.',
      score: 10,
    },
  ],
};
