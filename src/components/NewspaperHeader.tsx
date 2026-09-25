import { formatEditionDate, formatUpdatedAt } from '../utils/date';

interface NewspaperHeaderProps {
  editionDate?: string;
  issueNumber?: number;
  generatedAt?: string;
  storyCount: number;
  loading?: boolean;
}

const padIssue = (value?: number): string =>
  String(value ?? 1).padStart(3, '0');

export function NewspaperHeader({
  editionDate,
  issueNumber,
  generatedAt,
  storyCount,
  loading = false,
}: NewspaperHeaderProps) {
  return (
    <header className="newspaper-header">
      <div className="newspaper-header__topline">
        <span>Daily edition · No. {padIssue(issueNumber)}</span>
        <time dateTime={editionDate}>{formatEditionDate(editionDate)}</time>
        <span>Finite edition · one source per story</span>
      </div>

      <div className="newspaper-header__masthead">
        <h1>GUD</h1>
        <p>
          A daily selection of <strong>GOOD NEWS</strong>, because we love to share
          when things go right.
        </p>
      </div>

      <div className="newspaper-header__edition">
        <p className="newspaper-header__principle">
          The internet never ends. We keep it brief. Less makes more impact.
        </p>

        <p className="newspaper-header__status" aria-live="polite">
          {loading
            ? 'Assembling today’s edition…'
            : `${storyCount} ${storyCount === 1 ? 'story' : 'stories'} · ${formatUpdatedAt(generatedAt)}`}
        </p>
      </div>
    </header>
  );
}
