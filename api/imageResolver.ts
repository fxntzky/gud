import Parser from 'rss-parser';
import type { NewsArticle } from '../src/types/news';

interface MediaEntry {
  $?: {
    url?: string;
    width?: string;
    height?: string;
    medium?: string;
    type?: string;
  };
  url?: string;
}

export interface ExtendedFeedItem extends Parser.Item {
  mediaContent?: MediaEntry | MediaEntry[];
  mediaThumbnail?: MediaEntry | MediaEntry[];
  contentEncoded?: string;
}

interface RankedImageCandidate {
  url: string;
  score: number;
}

const ARTICLE_IMAGE_TIMEOUT_MS = 2600;
const ARTICLE_IMAGE_CONCURRENCY = 6;
const MAX_HTML_BYTES = 220_000;
const MAX_CANDIDATES_PER_ARTICLE = 8;

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

const looksLikeUtilityImage = (url: URL): boolean => {
  const value = `${url.pathname}${url.search}`.toLowerCase();

  return (
    /\.(?:svg)(?:$|\?)/i.test(value) ||
    /(?:favicon|logo|icon|avatar|sprite|tracking|pixel|spacer|badge)/i.test(value) ||
    /(?:^|[\W_])1x1(?:[\W_]|$)/i.test(value)
  );
};

const looksLikeSmallImageUrl = (url: string): boolean =>
  /(?:thumb|thumbnail|small|tiny|preview|\b(?:120|150|180|200|240|300|320|360|400)x(?:90|120|150|180|200|240|300|320|360|400)\b)/i.test(
    url,
  );

export const normalizeImageUrl = (
  value?: string,
  baseUrl?: string,
): string | undefined => {
  if (!value) return undefined;

  try {
    const decoded = decodeHtmlEntities(value.trim());
    const url = new URL(decoded, baseUrl);

    if (url.protocol !== 'https:') return undefined;
    if (looksLikeUtilityImage(url)) return undefined;

    return url.href;
  } catch {
    return undefined;
  }
};

const dimensionBonus = (width?: string, height?: string): number => {
  const w = Number(width);
  const h = Number(height);

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return 0;
  }

  if (w >= 1600 && h >= 800) return 28;
  if (w >= 1200 && h >= 630) return 24;
  if (w >= 900 && h >= 500) return 18;
  if (w >= 700 && h >= 400) return 12;
  if (w >= 500 && h >= 280) return 5;
  if (w < 400 || h < 220) return -30;

  return 0;
};

const addCandidate = (
  candidates: RankedImageCandidate[],
  value: string | undefined,
  baseUrl: string,
  score: number,
) => {
  const url = normalizeImageUrl(value, baseUrl);
  if (!url) return;

  candidates.push({
    url,
    score: score - (looksLikeSmallImageUrl(url) ? 28 : 0),
  });
};

const rankedUniqueUrls = (
  candidates: RankedImageCandidate[],
): string[] => {
  const bestScoreByUrl = new Map<string, number>();

  for (const candidate of candidates) {
    const current = bestScoreByUrl.get(candidate.url);
    if (current === undefined || candidate.score > current) {
      bestScoreByUrl.set(candidate.url, candidate.score);
    }
  }

  return [...bestScoreByUrl.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CANDIDATES_PER_ARTICLE)
    .map(([url]) => url);
};

const mediaCandidates = (
  value: ExtendedFeedItem['mediaContent'] | ExtendedFeedItem['mediaThumbnail'],
  baseUrl: string,
  baseScore: number,
): RankedImageCandidate[] => {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  const candidates: RankedImageCandidate[] = [];

  for (const entry of entries) {
    addCandidate(
      candidates,
      entry?.$?.url ?? entry?.url,
      baseUrl,
      baseScore + dimensionBonus(entry?.$?.width, entry?.$?.height),
    );
  }

  return candidates;
};

const imagesFromHtml = (
  html: string | undefined,
  baseUrl: string,
  baseScore: number,
): RankedImageCandidate[] => {
  if (!html) return [];

  const candidates: RankedImageCandidate[] = [];
  const matches = html.matchAll(
    /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi,
  );

  for (const match of matches) {
    addCandidate(candidates, match[1], baseUrl, baseScore);
  }

  return candidates;
};

export const imageCandidatesFromFeedItem = (
  item: ExtendedFeedItem,
  articleUrl: string,
): string[] => {
  const candidates: RankedImageCandidate[] = [];

  // Full-size media usually beats thumbnails. Known RSS dimensions add weight.
  candidates.push(...mediaCandidates(item.mediaContent, articleUrl, 92));

  const enclosure = normalizeImageUrl(item.enclosure?.url, articleUrl);
  if (enclosure && !/\.mp[34](?:\?|$)/i.test(enclosure)) {
    candidates.push({
      url: enclosure,
      score: 82 - (looksLikeSmallImageUrl(enclosure) ? 28 : 0),
    });
  }

  candidates.push(
    ...imagesFromHtml(
      item.contentEncoded ?? item.content ?? item.summary,
      articleUrl,
      68,
    ),
  );

  // Thumbnail is deliberately last. It is a fallback, not the preferred image.
  candidates.push(...mediaCandidates(item.mediaThumbnail, articleUrl, 28));

  return rankedUniqueUrls(candidates);
};

export const imageFromFeedItem = (
  item: ExtendedFeedItem,
  articleUrl: string,
): string | undefined => imageCandidatesFromFeedItem(item, articleUrl)[0];

const attribute = (tag: string, name: string): string | undefined => {
  const quoted = tag.match(
    new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'),
  );
  if (quoted?.[1]) return quoted[1];

  const bare = tag.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, 'i'));
  return bare?.[1];
};

const imageCandidatesFromMetadataHtml = (
  html: string,
  articleUrl: string,
): string[] => {
  const candidates: RankedImageCandidate[] = [];
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const scoreByIdentity: Record<string, number> = {
    'og:image:secure_url': 118,
    'og:image': 114,
    'twitter:image': 104,
    'twitter:image:src': 102,
  };

  for (const tag of metaTags) {
    const identity = (
      attribute(tag, 'property') ?? attribute(tag, 'name') ?? ''
    ).toLowerCase();
    const score = scoreByIdentity[identity];
    if (!score) continue;

    addCandidate(candidates, attribute(tag, 'content'), articleUrl, score);
  }

  // JSON-LD often exposes the actual lead image even when RSS only has a thumb.
  for (const match of html.matchAll(
    /["']image["']\s*:\s*(?:\[\s*)?["'](https:\/\/[^"']+)["']/gi,
  )) {
    addCandidate(candidates, match[1], articleUrl, 108);
  }

  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const rel = (attribute(tag, 'rel') ?? '').toLowerCase();
    if (!rel.split(/\s+/).includes('image_src')) continue;

    addCandidate(candidates, attribute(tag, 'href'), articleUrl, 94);
  }

  return rankedUniqueUrls(candidates);
};

const readHead = async (response: Response): Promise<string> => {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let html = '';

  while (bytesRead < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    html += decoder.decode(value, { stream: true });

    if (/<\/head\s*>/i.test(html)) break;
  }

  void reader.cancel().catch(() => undefined);
  html += decoder.decode();

  return html;
};

const isSafeArticleUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host === '0.0.0.0' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

const imageCandidatesFromArticleMetadata = async (
  articleUrl: string,
): Promise<string[]> => {
  if (!isSafeArticleUrl(articleUrl)) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(articleUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'GUD/0.7 (+finite-daily-newspaper)',
      },
    });

    if (!response.ok) return [];

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return [];

    const html = await readHead(response);
    return imageCandidatesFromMetadataHtml(html, response.url || articleUrl);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

const unique = (values: Array<string | undefined>): string[] => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];

export const enrichArticleImages = async (
  articles: NewsArticle[],
): Promise<NewsArticle[]> => {
  const enriched = [...articles];
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= enriched.length) return;

      const article = enriched[index];

      // Always inspect article metadata, even when RSS supplied an image.
      // RSS often exposes only a low-resolution thumbnail while OpenGraph has
      // the full editorial image.
      const metadataCandidates = await imageCandidatesFromArticleMetadata(
        article.url,
      );
      const candidates = unique([
        ...metadataCandidates,
        ...(article.imageCandidates ?? []),
        article.imageUrl,
      ]).slice(0, MAX_CANDIDATES_PER_ARTICLE);

      enriched[index] = {
        ...article,
        imageUrl: candidates[0],
        imageCandidates: candidates.length > 0 ? candidates : undefined,
      };
    }
  };

  const workerCount = Math.min(ARTICLE_IMAGE_CONCURRENCY, enriched.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return enriched;
};
