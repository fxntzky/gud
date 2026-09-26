import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CategoryNav,
  categoryLabel,
  type EditionView,
} from './components/CategoryNav';
import { EditionBatch } from './components/EditionBatch';
import { EditionSwitch } from './components/EditionSwitch';
import { EditionWelcome } from './components/EditionWelcome';
import { NewspaperHeader } from './components/NewspaperHeader';
import { WelcomePreloader } from './components/WelcomePreloader';
import {
  EDITION_LIMIT,
  EDITORIAL_RULESET_VERSION,
  STORIES_PER_REVEAL,
} from './config/edition';
import { editionCopy, editionLanguage } from './config/copy';
import { fallbackNews } from './data/fallbackNews';
import type {
  NewsArticle,
  NewsCategory,
  NewsEdition,
  NewsResponse,
} from './types/news';
import { formatUpdatedAt, getUtcEditionKey } from './utils/date';
import './styles/app.scss';

type Status = 'loading' | 'ready' | 'fallback';

const PRELOADER_MIN_MS = 1800;
const PRELOADER_EXIT_MS = 620;

const newsCategories: NewsCategory[] = [
  'science',
  'health',
  'nature',
  'technology',
  'society',
  'education',
  'culture',
  'community',
];

const cacheKeyForEdition = (
  editionKey: string,
  edition: NewsEdition,
): string =>
  `gud:edition:${EDITORIAL_RULESET_VERSION}:${edition}:${editionKey}`;

const isNewsCategory = (value: string | null): value is NewsCategory =>
  Boolean(value && newsCategories.includes(value as NewsCategory));

const readViewFromLocation = (): EditionView => {
  if (typeof window === 'undefined') return 'today';

  const category = new URLSearchParams(window.location.search).get('category');
  return isNewsCategory(category) ? category : 'today';
};

function chunkArticles(articles: NewsArticle[], size: number): NewsArticle[][] {
  const chunks: NewsArticle[][] = [];

  for (let index = 0; index < articles.length; index += size) {
    chunks.push(articles.slice(index, index + size));
  }

  return chunks;
}

function App() {
  const [edition, setEdition] = useState<NewsEdition | null>(null);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>();
  const [editionDate, setEditionDate] = useState(getUtcEditionKey());
  const [issueNumber, setIssueNumber] = useState(1);
  const [status, setStatus] = useState<Status>('loading');
  const [activeView, setActiveView] = useState<EditionView>(readViewFromLocation);
  const [visibleCount, setVisibleCount] = useState(STORIES_PER_REVEAL);
  const [preloaderVisible, setPreloaderVisible] = useState(false);
  const [preloaderLeaving, setPreloaderLeaving] = useState(false);
  const [backToTopVisible, setBackToTopVisible] = useState(false);
  const preloaderStartedAt = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!edition) return;

    const activeEdition = edition;
    const controller = new AbortController();
    const dateKey = getUtcEditionKey();
    const cacheKey = cacheKeyForEdition(dateKey, activeEdition);
    let hadCachedEdition = false;

    document.documentElement.lang = activeEdition === 'latam' ? 'es-419' : 'en';

    setStatus('loading');
    setPreloaderLeaving(false);
    setArticles([]);
    setGeneratedAt(undefined);
    setEditionDate(dateKey);
    setVisibleCount(STORIES_PER_REVEAL);

    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached) as NewsResponse;

        if (
          data.articles?.length > 0 &&
          data.editionDate === dateKey &&
          data.edition === activeEdition
        ) {
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
      window.localStorage.removeItem(cacheKey);
    }

    const loadNews = async () => {
      try {
        const response = await fetch(
          `/api/goodnews?date=${encodeURIComponent(dateKey)}&edition=${encodeURIComponent(activeEdition)}&rules=${encodeURIComponent(EDITORIAL_RULESET_VERSION)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`News endpoint returned ${response.status}`);
        }

        const data = (await response.json()) as NewsResponse;

        if (data.articles.length === 0) {
          throw new Error('Today’s edition is empty.');
        }

        if (data.edition !== activeEdition) {
          throw new Error('News endpoint returned the wrong GUD edition.');
        }

        setArticles(data.articles.slice(0, EDITION_LIMIT));
        setGeneratedAt(data.generatedAt);
        setEditionDate(data.editionDate ?? dateKey);
        setIssueNumber(data.issueNumber ?? 1);
        setVisibleCount(STORIES_PER_REVEAL);
        setStatus('ready');

        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {
          // Browser storage is only a speed-up.
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error(error);

        if (hadCachedEdition) return;

        setArticles(fallbackNews[activeEdition]);
        setGeneratedAt(new Date().toISOString());
        setEditionDate(dateKey);
        setVisibleCount(STORIES_PER_REVEAL);
        setStatus('fallback');
      }
    };

    void loadNews();

    return () => controller.abort();
  }, [edition]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(readViewFromLocation());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!edition || !preloaderVisible || status === 'loading') return;

    const elapsed = Date.now() - preloaderStartedAt.current;
    const remaining = Math.max(0, PRELOADER_MIN_MS - elapsed);
    const timeout = window.setTimeout(() => {
      setPreloaderLeaving(true);
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [edition, preloaderVisible, status]);

  useEffect(() => {
    if (!preloaderLeaving) return;

    const timeout = window.setTimeout(() => {
      setPreloaderVisible(false);
    }, PRELOADER_EXIT_MS);

    return () => window.clearTimeout(timeout);
  }, [preloaderLeaving]);

  useEffect(() => {
    const overlayVisible = !edition || preloaderVisible;
    document.documentElement.classList.toggle('is-preloading', overlayVisible);

    return () => {
      document.documentElement.classList.remove('is-preloading');
    };
  }, [edition, preloaderVisible]);

  useEffect(() => {
    setVisibleCount(STORIES_PER_REVEAL);
  }, [activeView, edition]);

  useEffect(() => {
    const updateBackToTop = () => {
      setBackToTopVisible(window.scrollY > window.innerHeight * 1.25);
    };

    updateBackToTop();
    window.addEventListener('scroll', updateBackToTop, { passive: true });
    window.addEventListener('resize', updateBackToTop);

    return () => {
      window.removeEventListener('scroll', updateBackToTop);
      window.removeEventListener('resize', updateBackToTop);
    };
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<NewsCategory, number>> = {};

    for (const article of articles) {
      counts[article.category] = (counts[article.category] ?? 0) + 1;
    }

    return counts;
  }, [articles]);

  const filteredArticles = useMemo(
    () =>
      activeView === 'today'
        ? articles
        : articles.filter((article) => article.category === activeView),
    [activeView, articles],
  );

  const visibleArticles = useMemo(
    () => filteredArticles.slice(0, visibleCount),
    [filteredArticles, visibleCount],
  );

  const batches = useMemo(
    () => chunkArticles(visibleArticles, STORIES_PER_REVEAL),
    [visibleArticles],
  );

  const activeEdition: NewsEdition = edition ?? 'english';
  const copy = editionCopy[activeEdition];
  const totalStories = filteredArticles.length;
  const hasMore = status !== 'loading' && visibleCount < totalStories;
  const editionComplete =
    status !== 'loading' && totalStories > 0 && visibleCount >= totalStories;
  const activeLabel =
    activeView === 'today'
      ? copy.today
      : categoryLabel(activeView, activeEdition);

  const selectView = (view: EditionView) => {
    if (!edition) return;

    setActiveView(view);

    const url = new URL(window.location.href);
    if (view === 'today') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', view);
    }
    url.searchParams.set('edition', edition);
    url.searchParams.delete('lang');

    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const selectEdition = (nextEdition: NewsEdition) => {
    if (nextEdition === edition && !preloaderVisible) return;

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('edition', nextEdition);
    nextUrl.searchParams.delete('lang');
    nextUrl.searchParams.delete('category');
    window.history.pushState(
      {},
      '',
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
    );

    setActiveView('today');
    setArticles([]);
    setGeneratedAt(undefined);
    setStatus('loading');
    setVisibleCount(STORIES_PER_REVEAL);
    setPreloaderLeaving(false);
    preloaderStartedAt.current = Date.now();
    setPreloaderVisible(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
    setEdition(nextEdition);
  };

  const scrollToTop = () => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

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
      {!edition && <EditionWelcome onSelect={selectEdition} />}

      {edition && preloaderVisible && (
        <WelcomePreloader
          edition={edition}
          editionDate={editionDate}
          leaving={preloaderLeaving}
        />
      )}

      <main
        className={`newspaper${!edition || preloaderVisible ? ' newspaper--preloading' : ''}`}
        aria-busy={status === 'loading' || preloaderVisible}
        aria-hidden={!edition || preloaderVisible || undefined}
      >
        <NewspaperHeader
          edition={activeEdition}
          editionDate={editionDate}
          issueNumber={issueNumber}
          generatedAt={generatedAt}
          storyCount={status === 'loading' ? 0 : articles.length}
          loading={status === 'loading'}
        />

        <div className="newspaper-controls">
          <CategoryNav
            activeView={activeView}
            counts={categoryCounts}
            total={articles.length}
            edition={activeEdition}
            onSelect={selectView}
          />
          <EditionSwitch edition={activeEdition} onChange={selectEdition} />
        </div>

        {activeView !== 'today' && status !== 'loading' && (
          <div className="newspaper__section-heading" aria-live="polite">
            <span>{activeLabel}</span>
            <span>{copy.storiesInEdition(totalStories)}</span>
          </div>
        )}

        {status === 'fallback' && (
          <aside className="newspaper__notice">{copy.fallback}</aside>
        )}

        {status !== 'loading' && totalStories > 0 && (
          <div className="newspaper__edition" lang={editionLanguage[activeEdition]}>
            {batches.map((batch, batchIndex) => (
              <EditionBatch
                key={`${activeEdition}-${activeView}-${batchIndex}-${batch[0]?.id ?? 'batch'}`}
                articles={batch}
                edition={activeEdition}
                batchIndex={batchIndex}
                startIndex={batchIndex * STORIES_PER_REVEAL}
                total={totalStories}
              />
            ))}
          </div>
        )}

        {status !== 'loading' && totalStories === 0 && (
          <section className="newspaper__empty" aria-live="polite">
            <p>{copy.empty(activeLabel)}</p>
            <button type="button" onClick={() => selectView('today')}>
              {copy.backToToday}
            </button>
          </section>
        )}

        {hasMore && (
          <div className="edition-turn" ref={sentinelRef} aria-live="polite">
            <span>
              {String(Math.min(visibleCount, totalStories)).padStart(2, '0')} /{' '}
              {totalStories}
            </span>
            <span className="edition-turn__label">{copy.nextThree}</span>
          </div>
        )}

        {editionComplete && (
          <footer className="newspaper__footer">
            <div className="newspaper__footer-count">
              {String(totalStories).padStart(2, '0')} / {totalStories} ·{' '}
              {activeView === 'today'
                ? copy.endOfEdition
                : copy.endOfSection(activeLabel)}
            </div>

            <div className="newspaper__footer-message">
              <h2>{copy.footerTitle}</h2>
              <p>{copy.footerLead}</p>
              <span>{copy.footerReturn}</span>
            </div>

            <div className="newspaper__footer-meta">
              <span>{copy.footerSource}</span>
              <span>{copy.footerRules}</span>
              <span>{formatUpdatedAt(generatedAt, activeEdition)}</span>
            </div>
          </footer>
        )}
      </main>

      {edition && !preloaderVisible && (
        <button
          type="button"
          className={`back-to-top${
            backToTopVisible ? ' back-to-top--visible' : ''
          }`}
          onClick={scrollToTop}
          aria-label={
            activeEdition === 'latam' ? 'Volver arriba' : 'Back to top'
          }
          tabIndex={backToTopVisible ? 0 : -1}
        >
          <span className="back-to-top__arrow" aria-hidden="true">
            ↑
          </span>
          <span className="back-to-top__label">
            {activeEdition === 'latam' ? 'ARRIBA' : 'TOP'}
          </span>
        </button>
      )}
    </>
  );
}

export default App;
