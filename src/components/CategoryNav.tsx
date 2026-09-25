import type { NewsCategory } from '../types/news';

export type EditionView = 'today' | NewsCategory;

interface CategoryNavProps {
  activeView: EditionView;
  counts: Partial<Record<NewsCategory, number>>;
  total: number;
  onSelect: (view: EditionView) => void;
}

const categoryOrder: NewsCategory[] = [
  'science',
  'planet',
  'health',
  'people',
  'culture',
  'technology',
  'animals',
  'world',
];

export const categoryLabel = (category: NewsCategory): string => {
  if (category === 'technology') return 'Tech';
  return category.charAt(0).toUpperCase() + category.slice(1);
};

const viewHref = (view: EditionView): string =>
  view === 'today' ? '?' : `?category=${encodeURIComponent(view)}`;

export function CategoryNav({
  activeView,
  counts,
  total,
  onSelect,
}: CategoryNavProps) {
  const availableCategories = categoryOrder.filter(
    (category) => (counts[category] ?? 0) > 0,
  );

  return (
    <nav className="category-nav" aria-label="GUD sections">
      <a
        className={`category-nav__item${activeView === 'today' ? ' category-nav__item--active' : ''}`}
        href={viewHref('today')}
        aria-current={activeView === 'today' ? 'page' : undefined}
        onClick={(event) => {
          event.preventDefault();
          onSelect('today');
        }}
      >
        <span>Today</span>
        <small>{total}</small>
      </a>

      {availableCategories.map((category) => (
        <a
          key={category}
          className={`category-nav__item${activeView === category ? ' category-nav__item--active' : ''}`}
          href={viewHref(category)}
          aria-current={activeView === category ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            onSelect(category);
          }}
        >
          <span>{categoryLabel(category)}</span>
          <small>{counts[category]}</small>
        </a>
      ))}
    </nav>
  );
}
