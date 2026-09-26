import { createHash } from 'node:crypto';
import {
    EDITION_LIMIT,
    EDITORIAL_RULESET_VERSION,
    FIRST_EDITION_DATE,
} from '../server/edition.js';
import { classifyCategory } from '../server/classifyCategory.js';
import {
    enrichArticleImages,
    imageCandidatesFromFeedItem,
} from '../server/imageResolver.js';
import {
    hasDisqualifyingSignal,
    hasQualifyingOutcome,
    scoreGoodNews,
} from '../server/goodNewsScore.js';
import {
    blockedPublisherDomains,
    getNewsSources,
} from '../server/newsSources.js';
import { fetchSourceItems } from '../server/sourceAdapters.js';

const MIN_SCORE = 2;
const MAX_LOOKBACK_HOURS = 72;
const SELECTION_WINDOWS_HOURS = [24, MAX_LOOKBACK_HOURS];
const SOURCE_CONCURRENCY = 30;
const MAX_EXCERPT_LENGTH = 320;
const STORY_SIMILARITY_THRESHOLD = 0.58;
const CATEGORY_SOFT_CAP = 6;
const SUPPORTED_EDITIONS = new Set(['english', 'latam']);

const emptyRejections = () => ({
    invalid: 0,
    blocked: 0,
    outOfWindow: 0,
    wrongLanguage: 0,
    disqualified: 0,
    noPositiveOutcome: 0,
    belowScore: 0,
});

const cleanText = (value) => {
    if (!value) return undefined;

    const withoutHtml = value.replace(/<[^>]*>/g, ' ');
    const normalized = withoutHtml
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&#39;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();

    return normalized || undefined;
};

const truncate = (value) => {
    if (!value || value.length <= MAX_EXCERPT_LENGTH) return value;

    const shortened = value.slice(0, MAX_EXCERPT_LENGTH);
    const lastSpace = shortened.lastIndexOf(' ');
    const end = lastSpace > 0 ? lastSpace : MAX_EXCERPT_LENGTH;
    return `${shortened.slice(0, end).trim()}…`;
};

const PAGE_CONTEXT_TIMEOUT_MS = 1800;
const PAGE_CONTEXT_MAX_BYTES = 180_000;
const MIN_USEFUL_DECK_LENGTH = 55;

const htmlAttribute = (tag, name) => {
    const match = tag.match(
        new RegExp(`${name}\\s*=\\s*[\"']([^\"']+)[\"']`, 'i'),
    );
    return match?.[1];
};

const extractMetaDeck = (html) => {
    const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
    const priorities = ['og:description', 'twitter:description', 'description'];

    for (const wanted of priorities) {
        for (const tag of tags) {
            const key = (
                htmlAttribute(tag, 'property') ?? htmlAttribute(tag, 'name') ?? ''
            ).toLowerCase();
            if (key !== wanted) continue;

            const content = cleanText(htmlAttribute(tag, 'content'));
            if (content && content.length >= MIN_USEFUL_DECK_LENGTH) {
                return truncate(content);
            }
        }
    }

    return undefined;
};

const readHtmlPrefix = async (response) => {
    if (!response.body?.getReader) {
        const text = await response.text();
        return text.slice(0, PAGE_CONTEXT_MAX_BYTES);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let html = '';

    try {
        while (bytes < PAGE_CONTEXT_MAX_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            html += decoder.decode(value, { stream: true });
            if (/<\/head>/i.test(html)) break;
        }
        html += decoder.decode();
    } finally {
        await reader.cancel().catch(() => undefined);
    }

    return html.slice(0, PAGE_CONTEXT_MAX_BYTES);
};

const fetchPageDeck = async (url) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGE_CONTEXT_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; GUD/0.8; +finite-edition-newspaper)',
                Accept: 'text/html,application/xhtml+xml',
            },
        });

        if (!response.ok) return undefined;
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('text/html')) return undefined;

        return extractMetaDeck(await readHtmlPrefix(response));
    } catch {
        return undefined;
    } finally {
        clearTimeout(timeout);
    }
};

const resolveEditorialContext = async (item, link) => {
    const summary = truncate(cleanText(item.summary));
    const snippet = truncate(cleanText(item.contentSnippet));
    const content = truncate(cleanText(item.content ?? item.contentEncoded));

    let deck = summary ?? snippet;
    let excerpt = snippet ?? content ?? summary;

    // Most RSS feeds expose the deck as summary/contentSnippet. When they do not,
    // read only the article <head> and use its description metadata. We never
    // download the full article body for editorial classification.
    if (!deck || deck.length < MIN_USEFUL_DECK_LENGTH) {
        const pageDeck = await fetchPageDeck(link);
        if (pageDeck) deck = pageDeck;
    }

    if (!excerpt) excerpt = deck;

    return {
        deck: deck ?? excerpt,
        excerpt,
    };
};

const makeId = (language, source, title, link) =>
    createHash('sha1')
        .update(`${language}|${source}|${title}|${link}`)
        .digest('hex');

const validHttpUrl = (value) => {
    if (!value) return undefined;

    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) return undefined;
        return url.href;
    } catch {
        return undefined;
    }
};

const hostnameMatches = (hostname, domain) =>
    hostname === domain || hostname.endsWith(`.${domain}`);

const isBlockedPublisherUrl = (value) => {
    try {
        const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
        return blockedPublisherDomains.some((domain) =>
            hostnameMatches(hostname, domain),
        );
    } catch {
        return true;
    }
};

const normalizeText = (value) =>
    value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const stopWords = new Set([
    // English
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
    'have', 'how', 'in', 'is', 'it', 'its', 'new', 'of', 'on', 'that', 'the',
    'this', 'to', 'with', 'after', 'before',
    // Spanish
    'al', 'como', 'con', 'de', 'del', 'el', 'en', 'es', 'esta', 'este', 'la',
    'las', 'lo', 'los', 'mas', 'para', 'por', 'que', 'se', 'su', 'sus', 'un',
    'una', 'y', 'tras',
]);

const canonicalToken = (token) => {
    if (/^(?:fail|fails|failed|failing|failure|fracasa|fracaso|falla|fallo|fallida|fallido)$/.test(token)) return 'fail';
    if (/^(?:rescue|rescues|rescued|rescuing|rescate|rescata|rescatan|rescato|rescatado|rescatada)$/.test(token)) return 'rescue';
    if (/^(?:return|returns|returned|returning|regresa|regreso|vuelve|volvio)$/.test(token)) return 'return';
    if (/^(?:aging|ageing|envejecido|envejecida)$/.test(token)) return 'aging';
    if (/^(?:spacecraft|spaceship|nave|aeronave)$/.test(token)) return 'spacecraft';
    if (/^(?:telescope|telescopio)$/.test(token)) return 'telescope';
    if (/^(?:mission|missions|mision|misiones)$/.test(token)) return 'mission';
    if (/^(?:earth|tierra)$/.test(token)) return 'earth';
    if (/^(?:restore|restores|restored|restoring|restaurar|restaura|restauro|restaurado)$/.test(token)) return 'restore';
    if (/^(?:recover|recovers|recovered|recovering|recupera|recupero|recuperado)$/.test(token)) return 'recover';
    return token;
};

const normalizedTokens = (value) =>
    normalizeText(value)
        .split(/\s+/)
        .filter((token) => token.length > 1 && !stopWords.has(token))
        .map(canonicalToken);

const storySimilarity = (left, right) => {
    if (left.length === 0 || right.length === 0) return 0;

    const a = new Set(left);
    const b = new Set(right);
    let intersection = 0;

    for (const token of a) {
        if (b.has(token)) intersection += 1;
    }

    if (intersection === 0) return 0;

    const union = new Set([...a, ...b]).size;
    const jaccard = intersection / union;
    const containment = intersection / Math.min(a.size, b.size);

    if (intersection >= 4 && containment >= 0.58) {
        return Math.max(jaccard, STORY_SIMILARITY_THRESHOLD);
    }

    return jaccard;
};

const storiesMatch = (article, acceptedArticle) =>
    storySimilarity(article.titleTokens, acceptedArticle.titleTokens) >=
    STORY_SIMILARITY_THRESHOLD;


const getRequestedEdition = (req) => {
    const requested = Array.isArray(req.query.edition)
        ? req.query.edition[0]
        : req.query.edition;

    if (SUPPORTED_EDITIONS.has(requested)) return requested;

    // Legacy v5 URLs remain readable during the migration.
    const legacyLanguage = Array.isArray(req.query.lang)
        ? req.query.lang[0]
        : req.query.lang;
    return legacyLanguage === 'es' ? 'latam' : 'english';
};

const languageForEdition = (edition) =>
    edition === 'latam' ? 'es' : 'en';

const utcDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const getEditionDate = (req) => {
    const today = utcDateKey();
    const requestedDate = Array.isArray(req.query.date)
        ? req.query.date[0]
        : req.query.date;
    const legacyEditionParam = Array.isArray(req.query.edition)
        ? req.query.edition[0]
        : req.query.edition;
    const requested = requestedDate ??
        (/^\d{4}-\d{2}-\d{2}$/.test(legacyEditionParam ?? '')
            ? legacyEditionParam
            : undefined);

    return requested === today ? requested : today;
};

const editionCutoffMs = (editionDate) => {
    const today = utcDateKey();
    if (editionDate === today) return Date.now();
    return Date.parse(`${editionDate}T23:59:59.999Z`);
};

const editionWindow = (editionDate) => {
    const end = editionCutoffMs(editionDate);
    const start = end - MAX_LOOKBACK_HOURS * 60 * 60 * 1000;
    return { start, end };
};

const isInEditionWindow = (value, editionDate) => {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return false;

    const { start, end } = editionWindow(editionDate);
    return timestamp >= start && timestamp < end;
};

const issueNumberForDate = (editionDate) => {
    const first = Date.parse(`${FIRST_EDITION_DATE}T00:00:00.000Z`);
    const current = Date.parse(`${editionDate}T00:00:00.000Z`);

    if (Number.isNaN(first) || Number.isNaN(current) || current < first) return 1;
    return Math.floor((current - first) / 86_400_000) + 1;
};

const deterministicTieBreak = (editionDate, language, id) =>
    Number.parseInt(
        createHash('sha1')
            .update(`${editionDate}|${language}|${id}`)
            .digest('hex')
            .slice(0, 8),
        16,
    );

const toArticle = ({
    sourceId: _sourceId,
    publisherDomain: _publisherDomain,
    sourcePriority: _sourcePriority,
    titleTokens: _titleTokens,
    ...article
}) => article;

const buildSourceCandidates = async (source, editionDate, language) => {
    const sourceItems = await fetchSourceItems(source);
    const rejected = emptyRejections();
    const candidates = [];

    for (const item of sourceItems) {
        const title = cleanText(item.title);
        const link = validHttpUrl(item.link);
        const publishedAt = item.isoDate ?? item.pubDate;

        if (!title || !link || !publishedAt) {
            rejected.invalid += 1;
            continue;
        }

        if (isBlockedPublisherUrl(link)) {
            rejected.blocked += 1;
            continue;
        }

        if (!isInEditionWindow(publishedAt, editionDate)) {
            rejected.outOfWindow += 1;
            continue;
        }

        // Cheap title-only veto first. This avoids fetching page metadata for
        // stories that are already clearly outside GUD's editorial scope.
        if (hasDisqualifyingSignal(title, title, '')) {
            rejected.disqualified += 1;
            continue;
        }

        const { deck, excerpt } = await resolveEditorialContext(item, link);
        const searchableText = [title, deck, excerpt]
            .filter(Boolean)
            .join(' ');

        if (hasDisqualifyingSignal(searchableText, title, deck)) {
            rejected.disqualified += 1;
            continue;
        }

        const category = classifyCategory(searchableText, source.category);

        // v6.3: eligibility and ranking are separate. Every story must first
        // describe a realized, desirable outcome in its title/deck. Scoring then
        // ranks the eligible stories instead of turning positive vocabulary into
        // an admission ticket.
        if (
            !hasQualifyingOutcome({
                title,
                deck,
                excerpt,
                category,
            })
        ) {
            rejected.noPositiveOutcome += 1;
            continue;
        }

        const score = scoreGoodNews(searchableText, title, deck);
        if (score < MIN_SCORE) {
            rejected.belowScore += 1;
            continue;
        }

        const imageCandidates = imageCandidatesFromFeedItem(item, link);

        candidates.push({
            id: makeId(language, source.name, title, link),
            title,
            url: link,
            source: source.name,
            publishedAt: new Date(publishedAt).toISOString(),
            category,
            language,
            excerpt,
            imageCandidates,
            imageUrl: imageCandidates[0],
            score,
            sourceId: source.id,
            publisherDomain: source.publisherDomain,
            sourcePriority: source.priority,
            titleTokens: normalizedTokens(title),
        });
    }

    return {
        candidates,
        diagnostics: {
            sourceId: source.id,
            source: source.name,
            feedItems: sourceItems.length,
            candidates: candidates.length,
            rejected,
        },
    };
};

const fetchSourcesWithConcurrency = async (newsSources, editionDate, language) => {
    const results = new Array(newsSources.length);
    let nextIndex = 0;

    const worker = async () => {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= newsSources.length) return;

            try {
                results[index] = {
                    status: 'fulfilled',
                    value: await buildSourceCandidates(
                        newsSources[index],
                        editionDate,
                        language,
                    ),
                };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    };

    const workerCount = Math.min(SOURCE_CONCURRENCY, newsSources.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
};

const ageHoursAtEditionCutoff = (publishedAt, editionDate) => {
    const published = new Date(publishedAt).getTime();
    const cutoff = editionCutoffMs(editionDate);
    if (Number.isNaN(published) || Number.isNaN(cutoff)) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, (cutoff - published) / 3_600_000);
};

const buildEdition = (candidates, editionDate, language) => {
    const ranked = [...candidates].sort((a, b) => {
        const totalA = a.score + a.sourcePriority;
        const totalB = b.score + b.sourcePriority;
        if (totalB !== totalA) return totalB - totalA;

        const publishedDelta =
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        if (publishedDelta !== 0) return publishedDelta;

        return (
            deterministicTieBreak(editionDate, language, b.id) -
            deterministicTieBreak(editionDate, language, a.id)
        );
    });

    const accepted = [];
    const usedSources = new Set();
    const usedPublisherDomains = new Set();
    const categoryCounts = new Map();

    const canAccept = (article, enforceCategoryCap) => {
        if (usedSources.has(article.sourceId)) return false;
        if (usedPublisherDomains.has(article.publisherDomain)) return false;

        if (
            enforceCategoryCap &&
            (categoryCounts.get(article.category) ?? 0) >= CATEGORY_SOFT_CAP
        ) {
            return false;
        }

        return !accepted.some((other) => storiesMatch(article, other));
    };

    const accept = (article) => {
        accepted.push(article);
        usedSources.add(article.sourceId);
        usedPublisherDomains.add(article.publisherDomain);
        categoryCounts.set(
            article.category,
            (categoryCounts.get(article.category) ?? 0) + 1,
        );
    };

    for (const windowHours of SELECTION_WINDOWS_HOURS) {
        for (const article of ranked) {
            if (accepted.length >= EDITION_LIMIT) break;
            if (ageHoursAtEditionCutoff(article.publishedAt, editionDate) > windowHours) {
                continue;
            }
            if (canAccept(article, true)) accept(article);
        }
        if (accepted.length >= EDITION_LIMIT) break;
    }

    if (accepted.length < EDITION_LIMIT) {
        for (const article of ranked) {
            if (accepted.length >= EDITION_LIMIT) break;
            if (
                ageHoursAtEditionCutoff(article.publishedAt, editionDate) >
                MAX_LOOKBACK_HOURS
            ) {
                continue;
            }
            if (canAccept(article, false)) accept(article);
        }
    }

    return accepted.map(toArticle);
};

const errorMessage = (reason) =>
    reason instanceof Error ? reason.message : String(reason);

export default async function handler(req, res) {
    if (req.method && req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const editionDate = getEditionDate(req);
    const edition = getRequestedEdition(req);
    const language = languageForEdition(edition);
    const newsSources = getNewsSources(edition);

    try {
        const results = await fetchSourcesWithConcurrency(
            newsSources,
            editionDate,
            language,
        );
        const fulfilled = results.filter((result) => result.status === 'fulfilled');
        const fulfilledCandidates = fulfilled.flatMap(
            (result) => result.value.candidates,
        );
        const sourceDiagnostics = fulfilled.map(
            (result) => result.value.diagnostics,
        );
        const selectedArticles = buildEdition(
            fulfilledCandidates,
            editionDate,
            edition,
        );
        const articles = await enrichArticleImages(selectedArticles);

        const successfulSources = fulfilled.length;
        const sourcesWithCandidates = sourceDiagnostics.filter(
            (source) => source.candidates > 0,
        ).length;
        const uniqueSources = new Set(
            articles.map((article) => article.source),
        ).size;
        const failedSources = results.flatMap((result, index) =>
            result.status === 'rejected'
                ? [
                      {
                          source: newsSources[index].name,
                          id: newsSources[index].id,
                          reason: errorMessage(result.reason),
                      },
                  ]
                : [],
        );

        const rejectionTotals = sourceDiagnostics.reduce(
            (totals, source) => ({
                invalid: totals.invalid + source.rejected.invalid,
                blocked: totals.blocked + source.rejected.blocked,
                outOfWindow: totals.outOfWindow + source.rejected.outOfWindow,
                wrongLanguage:
                    totals.wrongLanguage + source.rejected.wrongLanguage,
                disqualified:
                    totals.disqualified + source.rejected.disqualified,
                noPositiveOutcome:
                    totals.noPositiveOutcome + source.rejected.noPositiveOutcome,
                belowScore: totals.belowScore + source.rejected.belowScore,
            }),
            emptyRejections(),
        );

        const totalFeedItems = sourceDiagnostics.reduce(
            (total, source) => total + source.feedItems,
            0,
        );
        const { start, end } = editionWindow(editionDate);

        res.setHeader(
            'Vercel-CDN-Cache-Control',
            'public, max-age=86400, stale-while-revalidate=3600, stale-if-error=604800',
        );
        res.setHeader(
            'Cache-Control',
            'public, max-age=300, stale-while-revalidate=60',
        );
        res.setHeader(
            'Vercel-Cache-Tag',
            `gud-${editionDate}-${edition}-${EDITORIAL_RULESET_VERSION}`,
        );
        res.setHeader('X-GUD-Edition', edition);
        res.setHeader('X-GUD-Edition-Date', editionDate);
        res.setHeader('X-GUD-Language', language);
        res.setHeader('Content-Language', edition === 'latam' ? 'es-419' : 'en');

        return res.status(200).json({
            articles,
            generatedAt: new Date().toISOString(),
            editionDate,
            edition,
            language,
            issueNumber: issueNumberForDate(editionDate),
            count: articles.length,
            editionLimit: EDITION_LIMIT,
            editorialRulesetVersion: EDITORIAL_RULESET_VERSION,
            uniqueSources,
            sourcePool: newsSources.length,
            successfulSources,
            sourcesWithCandidates,
            candidateCount: fulfilledCandidates.length,
            diagnostics: {
                imageCount: articles.filter((article) => Boolean(article.imageUrl))
                    .length,
                imageCoverage:
                    articles.length > 0
                        ? Number(
                              (
                                  articles.filter((article) =>
                                      Boolean(article.imageUrl),
                                  ).length / articles.length
                              ).toFixed(3),
                          )
                        : 0,
                windowHours: MAX_LOOKBACK_HOURS,
                preferredWindowHours: 24,
                selectedLookbackHours: Math.ceil(
                    articles.reduce(
                        (oldest, article) =>
                            Math.max(
                                oldest,
                                ageHoursAtEditionCutoff(
                                    article.publishedAt,
                                    editionDate,
                                ),
                            ),
                        0,
                    ),
                ),
                windowStart: new Date(start).toISOString(),
                windowEnd: new Date(end).toISOString(),
                totalFeedItems,
                rejections: rejectionTotals,
                failedSources,
            },
        });
    } catch (error) {
        console.error('GUD source ingestion error:', error);
        return res.status(500).json({
            articles: [],
            generatedAt: new Date().toISOString(),
            editionDate,
            edition,
            language,
            issueNumber: issueNumberForDate(editionDate),
            count: 0,
            editionLimit: EDITION_LIMIT,
            editorialRulesetVersion: EDITORIAL_RULESET_VERSION,
            uniqueSources: 0,
            error: 'Unable to build today’s edition.',
        });
    }
}
