import { useEffect, useMemo, useRef, useState } from 'react';
import { EditionBatch } from './components/EditionBatch';
import { NewspaperHeader } from './components/NewspaperHeader';
import { WelcomePreloader } from './components/WelcomePreloader';
import {
  EDITION_LIMIT,
  EDITORIAL_RULESET_VERSION,
  STORIES_PER_REVEAL,
} from './config/edition';
import { fallbackNews } from './data/fallbackNews';
import type { NewsArticle, NewsResponse } from './types/news';
import { formatUpdatedAt, getUtcEditionKey } from './utils/date';
import './styles/app.scss';

type Status = 'loading' | 'ready' | 'fallback';

const PRELOADER_MIN_MS = 1800;
const PRELOADER_EXIT_MS = 620;

const cacheKeyForEdition = (editionKey: string): string =>
  `gud:edition:${EDITORIAL_RULESET_VERSION}:${editionKey}`;

function chunkArticles(articles: NewsArticle[], size: number): NewsArticle[][] {
  const chunks: NewsArticle[][] = [];

  for (let index = 0; index < articles.length; index += size) {
    chunks.push(articles.slice(index, index + size));
  }

  return chunks;
}

function App() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>();
  const [editionDate, setEditionDate] = useState(getUtcEditionKey());
  const [issueNumber, setIssueNumber] = useState(1);
  const [status, setStatus] = useState<Status>('loading');
  const [visibleCount, setVisibleCount] = useState(STORIES_PER_REVEAL);
  const [preloaderVisible, setPreloaderVisible] = useState(true);
  const [preloaderLeaving, setPreloaderLeaving] = useState(false);
  const preloaderStartedAt = useRef(Date.now());
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const editionKey = getUtcEditionKey();
    let hadCachedEdition = false;

    try {
      const cached = window.localStorage.getItem(cacheKeyForEdition(editionKey));
      if (cached) {
        const data = JSON.parse(cached) as NewsResponse;

        if (data.articles?.length > 0 && data.editionDate === editionKey) {
          hadCachedEdition = true;
          setArticles(data.articles.slice(0, EDITION_LIMIT));
          setGeneratedAt(data.generatedAt);
          setEditionDate(data.editionDate);
          setIssueNumber(data.issueNumber ?? 1);
          setVisibleCount(STORIES_PER_REVEAL);
          setStatus('ready');
        }
      }
    } catch {
      window.localStorage.removeItem(cacheKeyForEdition(editionKey));
    }

    const loadNews = async () => {
      try {
        const response = await fetch(
          `/api/goodnews?edition=${encodeURIComponent(editionKey)}&rules=${encodeURIComponent(EDITORIAL_RULESET_VERSION)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`News endpoint returned ${response.status}`);
        }

        const data = (await response.json()) as NewsResponse;

        if (data.articles.length === 0) {
          throw new Error('Today’s edition is empty.');
        }

        setArticles(data.articles.slice(0, EDITION_LIMIT));
        setGeneratedAt(data.generatedAt);
        setEditionDate(data.editionDate ?? editionKey);
        setIssueNumber(data.issueNumber ?? 1);
        setVisibleCount(STORIES_PER_REVEAL);
        setStatus('ready');

        try {
          window.localStorage.setItem(
            cacheKeyForEdition(editionKey),
            JSON.stringify(data),
          );
        } catch {
          // Browser storage is only a speed-up.
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error(error);

        if (hadCachedEdition) return;

        setArticles(fallbackNews);
        setGeneratedAt(new Date().toISOString());
        setEditionDate(editionKey);
        setVisibleCount(STORIES_PER_REVEAL);
        setStatus('fallback');
      }
    };

    void loadNews();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    const elapsed = Date.now() - preloaderStartedAt.current;
    const remaining = Math.max(0, PRELOADER_MIN_MS - elapsed);
    const timeout = window.setTimeout(() => {
      setPreloaderLeaving(true);
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!preloaderLeaving) return;

    const timeout = window.setTimeout(() => {
      setPreloaderVisible(false);
    }, PRELOADER_EXIT_MS);

    return () => window.clearTimeout(timeout);
  }, [preloaderLeaving]);

  useEffect(() => {
    document.documentElement.classList.toggle('is-preloading', preloaderVisible);

    return () => {
      document.documentElement.classList.remove('is-preloading');
    };
  }, [preloaderVisible]);

  const visibleArticles = useMemo(
    () => articles.slice(0, visibleCount),
    [articles, visibleCount],
  );

  const batches = useMemo(
    () => chunkArticles(visibleArticles, STORIES_PER_REVEAL),
    [visibleArticles],
  );

  const totalStories = articles.length;
  const hasMore = status === 'ready' && visibleCount < totalStories;
  const editionComplete =
    status === 'ready' && totalStories > 0 && visibleCount >= totalStories;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        observer.unobserve(entry.target);
        setVisibleCount((current) =>
          Math.min(current + STORIES_PER_REVEAL, totalStories),
        );
      },
      {
        rootMargin: '0px 0px 18% 0px',
        threshold: 0.15,
      },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, totalStories, visibleCount]);

  return (
    <>
      {preloaderVisible && (
        <WelcomePreloader
          editionDate={editionDate}
          leaving={preloaderLeaving}
        />
      )}

      <main
        className={`newspaper${preloaderVisible ? ' newspaper--preloading' : ''}`}
        aria-busy={status === 'loading' || preloaderVisible}
        aria-hidden={preloaderVisible || undefined}
      >
        <NewspaperHeader
          editionDate={editionDate}
          issueNumber={issueNumber}
          generatedAt={generatedAt}
          storyCount={status === 'loading' ? 0 : totalStories}
          loading={status === 'loading'}
        />

        {status === 'fallback' && (
          <aside className="newspaper__notice">
            Local preview · run <code>npm run dev:vercel</code> to load today’s RSS edition.
          </aside>
        )}

        {status !== 'loading' && (
          <div className="newspaper__edition">
            {batches.map((batch, batchIndex) => (
              <EditionBatch
                key={`${batchIndex}-${batch[0]?.id ?? 'batch'}`}
                articles={batch}
                batchIndex={batchIndex}
                startIndex={batchIndex * STORIES_PER_REVEAL}
                total={totalStories}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="edition-turn" ref={sentinelRef} aria-live="polite">
            <span>
              {String(Math.min(visibleCount, totalStories)).padStart(2, '0')} /{' '}
              {totalStories}
            </span>
            <span className="edition-turn__label">Next three ↓</span>
          </div>
        )}

        {editionComplete && (
          <footer className="newspaper__footer">
            <div className="newspaper__footer-count">
              {String(totalStories).padStart(2, '0')} / {totalStories} · END OF TODAY’S EDITION
            </div>

            <div className="newspaper__footer-message">
              <h2>LIFE IS GOOD.</h2>
              <p>Go outside.</p>
              <span>Come back tomorrow.</span>
            </div>

            <div className="newspaper__footer-meta">
              <span>One story per source. No infinite scroll.</span>
              <span>Deterministic editorial rules · no generative AI.</span>
              <span>{formatUpdatedAt(generatedAt)}</span>
            </div>
          </footer>
        )}
      </main>
    </>
  );
}

export default App;
