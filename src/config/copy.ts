import type { NewsEdition, NewsLanguage } from '../types/news';

export const editionLanguage: Record<NewsEdition, NewsLanguage> = {
  english: 'en',
  latam: 'es',
};

export const editionLocale: Record<NewsEdition, string> = {
  english: 'en',
  latam: 'es-419',
};

export const editionCopy = {
  english: {
    name: 'GUD English',
    shortName: 'EN',
    today: 'Today',
    stories: (count: number) => `${count} ${count === 1 ? 'story' : 'stories'}`,
    storiesInEdition: (count: number) =>
      `${count} ${count === 1 ? 'story' : 'stories'} in today’s edition`,
    empty: (section: string) => `Nothing in ${section.toLowerCase()} made today’s edition.`,
    backToToday: 'Back to today',
    nextThree: 'Next three ↓',
    endOfEdition: 'END OF TODAY’S EDITION',
    endOfSection: (section: string) => `END OF ${section.toUpperCase()}`,
    footerTitle: 'LIFE IS GOOD.',
    footerLead: 'Go outside.',
    footerReturn: 'Come back tomorrow.',
    footerSource: 'One story per source. No infinite scroll.',
    footerRules: 'Deterministic editorial rules · no generative AI.',
    fallback: 'Local preview · run Vercel Dev to load today’s RSS edition.',
  },
  latam: {
    name: 'GUD Hispanoamérica',
    shortName: 'HISP.',
    today: 'Hoy',
    stories: (count: number) => `${count} ${count === 1 ? 'noticia' : 'noticias'}`,
    storiesInEdition: (count: number) =>
      `${count} ${count === 1 ? 'noticia' : 'noticias'} en la edición de hoy`,
    empty: (section: string) => `Hoy no entró ninguna noticia de ${section.toLowerCase()} en la edición.`,
    backToToday: 'Volver a hoy',
    nextThree: 'Siguientes tres ↓',
    endOfEdition: 'FIN DE LA EDICIÓN DE HOY',
    endOfSection: (section: string) => `FIN DE ${section.toUpperCase()}`,
    footerTitle: 'LA VIDA ES BUENA.',
    footerLead: 'Sal afuera.',
    footerReturn: 'Vuelve mañana.',
    footerSource: 'Una historia por fuente. Sin scroll infinito.',
    footerRules: 'Reglas editoriales deterministas · sin IA generativa.',
    fallback: 'Vista local · ejecuta Vercel Dev para cargar la edición RSS de hoy.',
  },
} as const;
