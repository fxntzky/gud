import type { CSSProperties } from 'react';
import { formatEditionDate } from '../utils/date';

interface WelcomePreloaderProps {
  editionDate?: string;
  leaving?: boolean;
}

const letters = ['G', 'U', 'D'] as const;

export function WelcomePreloader({
  editionDate,
  leaving = false,
}: WelcomePreloaderProps) {
  return (
    <div
      className={`gud-preloader${leaving ? ' gud-preloader--leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading today’s GUD edition"
    >
      <div className="gud-preloader__frame">
        <div className="gud-preloader__topline">
          <span>Welcome to GUD</span>
          <span>{formatEditionDate(editionDate)}</span>
        </div>

        <div className="gud-preloader__center">
          <div className="gud-preloader__word" aria-hidden="true">
            {letters.map((letter, index) => (
              <span
                className="gud-preloader__letter"
                key={letter}
                style={{ '--letter-index': index } as CSSProperties}
              >
                <span>{letter}</span>
              </span>
            ))}
          </div>

          <p>A daily selection of good news.</p>
        </div>

        <div className="gud-preloader__bottom">
          <div className="gud-preloader__bottom-copy">
            <span>Assembling today’s edition</span>
            <span>From across the web</span>
          </div>

          <div className="gud-preloader__progress" aria-hidden="true">
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}
