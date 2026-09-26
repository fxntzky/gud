import { useEffect, useMemo, useState } from 'react';
import type { NewsArticle, NewsEdition } from '../types/news';
import { categoryLabel } from './CategoryNav';
import { formatDate, formatRelativeTime } from '../utils/date';
import { trackOutboundSourceClick } from '../utils/analytics';

export type ArticleVariant = 'hero' | 'feature' | 'standard' | 'compact' | 'wide';

interface ArticleCardProps {
  article: NewsArticle;
  edition: NewsEdition;
  index: number;
  total: number;
  variant?: ArticleVariant;
}

const formatStoryNumber = (value: number): string =>
  String(value).padStart(2, '0');

const uniqueImageCandidates = (article: NewsArticle): string[] => [
  ...new Set(
    [...(article.imageCandidates ?? []), article.imageUrl].filter(
      (value): value is string => Boolean(value),
    ),
  ),
];

export function ArticleCard({
  article,
  edition,
  index,
  total,
  variant = 'standard',
}: ArticleCardProps) {
  const candidates = useMemo(() => uniqueImageCandidates(article), [article]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const isPlaceholder = article.url === '#';
  const storyNumber = index + 1;
  const currentImage = candidates[candidateIndex];
  const hasImage = Boolean(currentImage);
  const isLatam = edition === 'latam';

  useEffect(() => {
    setCandidateIndex(0);
  }, [article.id]);

  const tryNextImage = () => {
    setCandidateIndex((current) => current + 1);
  };

  const handleOutboundClick = () =>
    trackOutboundSourceClick({
      source: article.source,
      edition,
    });

  const cardClassName = [
    'article-card',
    `article-card--${variant}`,
    !hasImage ? 'article-card--house-rail' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClassName}>
      <div className="article-card__rail" aria-label={hasImage ? undefined : article.title}>
        {hasImage ? (
          <div className="article-card__media">
            {isPlaceholder ? (
              <img
                key={currentImage}
                className="article-card__image"
                src={currentImage}
                alt=""
                loading={variant === 'hero' ? 'eager' : 'lazy'}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={tryNextImage}
              />
            ) : (
              <a
                className="article-card__media-link"
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleOutboundClick}
                aria-label={
                  isLatam
                    ? `Leer ${article.title} en ${article.source}`
                    : `Read ${article.title} at ${article.source}`
                }
              >
                <img
                  key={currentImage}
                  className="article-card__image"
                  src={currentImage}
                  alt=""
                  loading={variant === 'hero' ? 'eager' : 'lazy'}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={tryNextImage}
                />
              </a>
            )}
          </div>
        ) : (
          <aside className="article-card__house" aria-label={article.title}>
            <span>{article.source}</span>
            <strong>{article.title}</strong>
          </aside>
        )}
      </div>

      <div className="article-card__body">
        <div
          className="article-card__number"
          aria-label={
            isLatam
              ? `Noticia ${storyNumber} de ${total}`
              : `Story ${storyNumber} of ${total}`
          }
        >
          <span>{formatStoryNumber(storyNumber)}</span>
          <span>/ {total}</span>
        </div>

        <div className="article-card__meta">
          <span>{categoryLabel(article.category, edition)}</span>
          <span>{formatRelativeTime(article.publishedAt, edition)}</span>
        </div>

        <h2>
          {isPlaceholder ? (
            article.title
          ) : (
            <a
              className="article-card__title-link"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOutboundClick}
            >
              {article.title}
            </a>
          )}
        </h2>

        {article.excerpt && <p className="article-card__excerpt">{article.excerpt}</p>}

        <div className="article-card__source">
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, edition)}</time>

          {!isPlaceholder && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOutboundClick}
            >
              {article.source} <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
