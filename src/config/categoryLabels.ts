import type { NewsCategory, NewsEdition } from '../types/news';

export const categoryLabels: Record<NewsEdition, Record<'today' | NewsCategory, string>> = {
  english: {
    today: 'Today',
    science: 'Science',
    health: 'Health',
    nature: 'Nature',
    technology: 'Tech',
    society: 'Society',
    education: 'Education',
    culture: 'Culture',
    community: 'Community',
  },
  latam: {
    today: 'Hoy',
    science: 'Ciencia',
    health: 'Salud',
    nature: 'Naturaleza',
    technology: 'Tecnología',
    society: 'Sociedad',
    education: 'Educación',
    culture: 'Cultura',
    community: 'Comunidad',
  },
};

export const categoryLabel = (
  category: NewsCategory,
  edition: NewsEdition = 'english',
): string => categoryLabels[edition][category];
