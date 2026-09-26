import type { NewsEdition } from '../types/news';

interface EditionSwitchProps {
  edition: NewsEdition;
  onChange: (edition: NewsEdition) => void;
}

const editions: NewsEdition[] = ['english', 'latam'];

const labels: Record<NewsEdition, { long: string; short: string }> = {
  english: { long: 'GUD English', short: 'EN' },
  latam: { long: 'GUD Hispanoamérica', short: 'HISP.' },
};

export function EditionSwitch({ edition, onChange }: EditionSwitchProps) {
  return (
    <div className="language-switch" aria-label="GUD edition">
      {editions.map((option) => (
        <button
          key={option}
          type="button"
          className={`language-switch__item${edition === option ? ' language-switch__item--active' : ''}`}
          aria-pressed={edition === option}
          onClick={() => onChange(option)}
        >
          <span className="edition-switch__long">{labels[option].long}</span>
          <span className="edition-switch__short">{labels[option].short}</span>
        </button>
      ))}
    </div>
  );
}
