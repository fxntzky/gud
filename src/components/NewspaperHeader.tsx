import type { NewsEdition } from '../types/news';
import { editionCopy } from '../config/copy';
import { formatEditionDate, formatUpdatedAt } from '../utils/date';

interface NewspaperHeaderProps {
  edition: NewsEdition;
  editionDate?: string;
  issueNumber?: number;
  generatedAt?: string;
  storyCount: number;
  loading?: boolean;
}

const padIssue = (value?: number): string =>
  String(value ?? 1).padStart(3, '0');

export function NewspaperHeader({
  edition,
  editionDate,
  issueNumber,
  generatedAt,
  storyCount,
  loading = false,
}: NewspaperHeaderProps) {
  const isLatam = edition === 'latam';
  const copy = editionCopy[edition];

  return (
    <header className="newspaper-header">
      <div className="newspaper-header__topline">
        <span>
          {isLatam ? 'Edición diaria · N.º' : 'Daily edition · No.'}{' '}
          {padIssue(issueNumber)}
        </span>
        <time dateTime={editionDate}>{formatEditionDate(editionDate, edition)}</time>
        <span>
          {isLatam
            ? 'Edición finita · una fuente por historia'
            : 'Finite edition · one source per story'}
        </span>
      </div>

      <div className="newspaper-header__masthead">
        <h1>GUD</h1>
        <p>
          {isLatam ? 'Una selección diaria de ' : 'A daily selection of '}
          <strong>GOOD NEWS</strong>
          {isLatam
            ? ', porque nos gusta compartir cuando las cosas salen bien.'
            : ', because we love to share when things go right.'}
        </p>
      </div>

      <div className="newspaper-header__edition">
        <p className="newspaper-header__principle">
          {isLatam
            ? 'Internet nunca termina. Nosotros lo mantenemos breve. Menos genera más impacto.'
            : 'The internet never ends. We keep it brief. Less makes more impact.'}
        </p>

        <p className="newspaper-header__status" aria-live="polite">
          {loading
            ? isLatam
              ? 'Armando la edición de hoy…'
              : 'Assembling today’s edition…'
            : `${copy.stories(storyCount)} · ${formatUpdatedAt(generatedAt, edition)}`}
        </p>
      </div>
    </header>
  );
}
