import { useState } from 'react';
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

const houseMessages: Record<NewsEdition, ReadonlyArray<{ label: string; copy: string }>> = {
  english: [
    { label: 'House message', copy: 'life is gud.' },
    { label: 'House message', copy: 'today, in brief.' },
    { label: 'House message', copy: 'good news is still news.' },
    { label: 'House message', copy: 'from across the web.' },
  ],
  latam: [
    { label: 'Mensaje GUD', copy: 'la vida es gud.' },
    { label: 'Mensaje GUD', copy: 'hoy, en breve.' },
    { label: 'Mensaje GUD', copy: 'GOOD NEWS sigue siendo noticia.' },
    { label: 'Mensaje GUD', copy: 'desde toda la web.' },
  ],
};

const formatStoryNumber = (value: number): string =>
  String(value).padStart(2, '0');

export function ArticleCard({
  article,
  edition,
  index,
  total,
  variant = 'standard',
}: ArticleCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const isPlaceholder = article.url === '#';
  const storyNumber = index + 1;
  const hasImage = Boolean(article.imageUrl) && !imageFailed;
  const houseMessage = houseMessages[edition][index % houseMessages[edition].length];
  const isLatam = edition === 'latam';
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
      <div className="article-card__rail" aria-label={hasImage ? undefined : houseMessage.label}>
        {hasImage ? (
          <div className="article-card__media">
            {isPlaceholder ? (
              <img
                className="article-card__image"
                src={article.imageUrl}
                alt=""
                loading={variant === 'hero' ? 'eager' : 'lazy'}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
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
                  className="article-card__image"
                  src={article.imageUrl}
                  alt=""
                  loading={variant === 'hero' ? 'eager' : 'lazy'}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                />
              </a>
            )}
          </div>
        ) : (
          <aside className="article-card__house" aria-label={houseMessage.label}>
            <span>{houseMessage.label}</span>
            <strong>{houseMessage.copy}</strong>
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
