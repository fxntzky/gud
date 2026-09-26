import type { NewsCategory, NewsEdition } from '../types/news';

export type EditionView = 'today' | NewsCategory;

interface CategoryNavProps {
  activeView: EditionView;
  counts: Partial<Record<NewsCategory, number>>;
  total: number;
  edition: NewsEdition;
  onSelect: (view: EditionView) => void;
}

const categoryOrder: NewsCategory[] = [
  'science',
  'health',
  'nature',
  'technology',
  'society',
  'education',
  'culture',
  'community',
];

const labels: Record<NewsEdition, Record<'today' | NewsCategory, string>> = {
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
): string => labels[edition][category];

const viewHref = (view: EditionView, edition: NewsEdition): string => {
  const params = new URLSearchParams({ edition });
  if (view !== 'today') params.set('category', view);
  return `?${params.toString()}`;
};

export function CategoryNav({
  activeView,
  counts,
  total,
  edition,
  onSelect,
}: CategoryNavProps) {
  return (
    <nav
      className="category-nav"
      aria-label={edition === 'latam' ? 'Secciones de GUD' : 'GUD sections'}
    >
      <a
        className={`category-nav__item${activeView === 'today' ? ' category-nav__item--active' : ''}`}
        href={viewHref('today', edition)}
        aria-current={activeView === 'today' ? 'page' : undefined}
        onClick={(event) => {
          event.preventDefault();
          onSelect('today');
        }}
      >
        <span>{labels[edition].today}</span>
        <small>{total}</small>
      </a>

      {categoryOrder.map((category) => (
        <a
          key={category}
          className={`category-nav__item${activeView === category ? ' category-nav__item--active' : ''}`}
          href={viewHref(category, edition)}
          aria-current={activeView === category ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            onSelect(category);
          }}
        >
          <span>{labels[edition][category]}</span>
          <small>{counts[category] ?? 0}</small>
        </a>
      ))}
    </nav>
  );
}
