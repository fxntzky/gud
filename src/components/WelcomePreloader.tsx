import { useEffect, useState } from 'react';
import type { NewsEdition } from '../types/news';
import { formatEditionDate } from '../utils/date';

interface WelcomePreloaderProps {
  edition: NewsEdition;
  editionDate?: string;
  leaving?: boolean;
}

const FRAME_MS = 1050;

const frames = {
  english: [
    { word: 'GOOD NEWS', status: 'CURATING TODAY’S EDITION' },
    { word: 'GUD NEWS', status: 'CHECKING SOURCES' },
    { word: 'GOOD NEWS', status: 'FILTERING THE NOISE' },
    { word: 'GUD', status: 'BUILDING GUD' },
  ],
  latam: [
    { word: 'GOOD NEWS', status: 'SELECCIONANDO LA EDICIÓN DE HOY' },
    { word: 'GUD NEWS', status: 'REVISANDO FUENTES' },
    { word: 'GOOD NEWS', status: 'FILTRANDO EL RUIDO' },
    { word: 'GUD', status: 'CONSTRUYENDO GUD' },
  ],
} as const;

export function WelcomePreloader({
  edition,
  editionDate,
  leaving = false,
}: WelcomePreloaderProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const isLatam = edition === 'latam';
  const sequence = frames[edition];
  const frame = sequence[frameIndex % sequence.length];
  const isWideWord = frame.word.length > 3;

  useEffect(() => {
    setFrameIndex(0);
    if (leaving) return;

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % sequence.length);
    }, FRAME_MS);

    return () => window.clearInterval(interval);
  }, [edition, leaving, sequence.length]);

  return (
    <div
      className={`gud-preloader${leaving ? ' gud-preloader--leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={
        isLatam
          ? 'Cargando la edición de GUD Hispanoamérica'
          : 'Loading today’s GUD English edition'
      }
    >
      <div className="gud-preloader__frame">
        <div className="gud-preloader__topline">
          <span>{isLatam ? 'GUD Hispanoamérica' : 'Welcome to GUD'}</span>
          <span>{formatEditionDate(editionDate, edition)}</span>
        </div>

        <div className="gud-preloader__center">
          <div
            className={`gud-preloader__word${
              isWideWord ? ' gud-preloader__word--wide' : ''
            }`}
            aria-hidden="true"
          >
            <span key={`${edition}-${frameIndex}`}>{frame.word}</span>
          </div>

          <p>
            {isLatam
              ? 'Una selección diaria de GOOD NEWS.'
              : 'A daily selection of GOOD NEWS.'}
          </p>
        </div>

        <div className="gud-preloader__bottom">
          <div className="gud-preloader__bottom-copy" aria-hidden="true">
            <span key={`${edition}-status-${frameIndex}`}>{frame.status}</span>
            <span>
              {isLatam
                ? 'Fuentes originales en español'
                : 'Original English-language sources'}
            </span>
          </div>

          <div className="gud-preloader__progress" aria-hidden="true">
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}
