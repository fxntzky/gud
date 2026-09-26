import type { NewsArticle, NewsEdition } from '../types/news';
import { ArticleCard, type ArticleVariant } from './ArticleCard';

interface EditionBatchProps {
  articles: NewsArticle[];
  edition: NewsEdition;
  batchIndex: number;
  startIndex: number;
  total: number;
}

const getVariant = (batchIndex: number, localIndex: number): ArticleVariant => {
  if (batchIndex === 0 && localIndex === 0) return 'hero';
  return 'standard';
};

export function EditionBatch({
  articles,
  edition,
  batchIndex,
  startIndex,
  total,
}: EditionBatchProps) {
  const isLatam = edition === 'latam';

  return (
    <section
      className={`edition-batch ${batchIndex === 0 ? 'edition-batch--opening' : ''}`}
      aria-label={
        isLatam
          ? `Noticias ${startIndex + 1} a ${startIndex + articles.length}`
          : `Stories ${startIndex + 1} to ${startIndex + articles.length}`
      }
    >
      {articles.map((article, localIndex) => (
        <ArticleCard
          key={article.id}
          article={article}
          edition={edition}
          index={startIndex + localIndex}
          total={total}
          variant={getVariant(batchIndex, localIndex)}
        />
      ))}
    </section>
  );
}
