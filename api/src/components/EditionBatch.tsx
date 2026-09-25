import type { NewsArticle } from '../types/news';
import { ArticleCard, type ArticleVariant } from './ArticleCard';

interface EditionBatchProps {
  articles: NewsArticle[];
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
  batchIndex,
  startIndex,
  total,
}: EditionBatchProps) {
  return (
    <section
      className={`edition-batch ${batchIndex === 0 ? 'edition-batch--opening' : ''}`}
      aria-label={`Stories ${startIndex + 1} to ${startIndex + articles.length}`}
    >
      {articles.map((article, localIndex) => (
        <ArticleCard
          key={article.id}
          article={article}
          index={startIndex + localIndex}
          total={total}
          variant={getVariant(batchIndex, localIndex)}
        />
      ))}
    </section>
  );
}
