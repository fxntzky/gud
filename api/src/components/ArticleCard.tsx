import { useEffect, useMemo, useState } from 'react';
import type { NewsArticle } from '../types/news';
import { formatDate, formatRelativeTime } from '../utils/date';

export type ArticleVariant = 'hero' | 'feature' | 'standard' | 'compact' | 'wide';

interface ArticleCardProps {
  article: NewsArticle;
  index: number;
  total: number;
  variant?: ArticleVariant;
}

const houseMessages = [
  { label: 'House message', copy: 'life is gud.' },
  { label: 'House message', copy: 'today, in brief.' },
  { label: 'House message', copy: 'good news is still news.' },
  { label: 'House message', copy: 'from across the web.' },
] as const;

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
  const houseMessage = houseMessages[index % houseMessages.length];
  const cardClassName = [
    'article-card',
    `article-card--${variant}`,
    !hasImage ? 'article-card--house-rail' : '',
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    setCandidateIndex(0);
  }, [article.id]);

  const tryNextImage = () => {
    setCandidateIndex((current) => current + 1);
  };


  return (
    <article className={cardClassName}>
      <div
        className="article-card__rail"
        aria-label={hasImage ? undefined : houseMessage.label}
      >
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
                aria-label={`Read ${article.title} at ${article.source}`}
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
          <aside className="article-card__house" aria-label="GUD house message">
            <span>{houseMessage.label}</span>
            <strong>{houseMessage.copy}</strong>
          </aside>
        )}
      </div>

      <div className="article-card__body">
        <div
          className="article-card__number"
          aria-label={`Story ${storyNumber} of ${total}`}
        >
          <span>{formatStoryNumber(storyNumber)}</span>
          <span>/ {total}</span>
        </div>

        <div className="article-card__meta">
          <span>{article.category}</span>
          <span>{formatRelativeTime(article.publishedAt)}</span>
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
            >
              {article.title}
            </a>
          )}
        </h2>

        {article.excerpt && (
          <p className="article-card__excerpt">{article.excerpt}</p>
        )}

        <div className="article-card__source">
          <time dateTime={article.publishedAt}>
            {formatDate(article.publishedAt)}
          </time>

          {!isPlaceholder && (
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              {article.source} <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
