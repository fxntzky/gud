import Parser from 'rss-parser';
import { createHash } from 'node:crypto';
import { EDITION_LIMIT, EDITORIAL_RULESET_VERSION, FIRST_EDITION_DATE, } from '../server/edition.js';
import { classifyCategory } from '../server/classifyCategory.js';
import { enrichArticleImages, imageCandidatesFromFeedItem, } from '../server/imageResolver.js';
import { hasDisqualifyingSignal, hasPositiveOutcomeSignal, scoreGoodNews, } from '../server/goodNewsScore.js';
import { blockedPublisherDomains, newsSources, } from '../server/newsSources.js';
const parser = new Parser({
    timeout: 2800,
    headers: {
        'User-Agent': 'GUD/0.6 (+finite-daily-newspaper)',
    },
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['media:thumbnail', 'mediaThumbnail'],
            ['content:encoded', 'contentEncoded'],
        ],
    },
});
const MIN_SCORE = 4;
const MAX_LOOKBACK_HOURS = 72;
const SELECTION_WINDOWS_HOURS = [24, MAX_LOOKBACK_HOURS];
const SOURCE_CONCURRENCY = 30;
const MAX_EXCERPT_LENGTH = 320;
const STORY_SIMILARITY_THRESHOLD = 0.58;
const CATEGORY_SOFT_CAP = 6;
const emptyRejections = () => ({
    invalid: 0,
    blocked: 0,
    outOfWindow: 0,
    disqualified: 0,
    noPositiveOutcome: 0,
    belowScore: 0,
});
const cleanText = (value) => {
    if (!value)
        return undefined;
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
    if (!value || value.length <= MAX_EXCERPT_LENGTH)
        return value;
    const shortened = value.slice(0, MAX_EXCERPT_LENGTH);
    const lastSpace = shortened.lastIndexOf(' ');
    const end = lastSpace > 0 ? lastSpace : MAX_EXCERPT_LENGTH;
    return `${shortened.slice(0, end).trim()}…`;
};
const makeId = (source, title, link) => createHash('sha1').update(`${source}|${title}|${link}`).digest('hex');
const validHttpUrl = (value) => {
    if (!value)
        return undefined;
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol))
            return undefined;
        return url.href;
    }
    catch {
        return undefined;
    }
};
const hostnameMatches = (hostname, domain) => hostname === domain || hostname.endsWith(`.${domain}`);
const isBlockedPublisherUrl = (value) => {
    try {
        const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
        return blockedPublisherDomains.some((domain) => hostnameMatches(hostname, domain));
    }
    catch {
        return true;
    }
};
const normalizedTitle = (title) => {
    const stopWords = new Set([
        'a',
        'an',
        'and',
        'are',
        'as',
        'at',
        'be',
        'by',
        'for',
        'from',
        'has',
        'have',
        'how',
        'in',
        'is',
        'it',
        'its',
        'new',
        'of',
        'on',
        'that',
        'the',
        'this',
        'to',
        'with',
    ]);
    return title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 1 && !stopWords.has(token));
};
const storySimilarity = (left, right) => {
    if (left.length === 0 || right.length === 0)
        return 0;
    const a = new Set(left);
    const b = new Set(right);
    let intersection = 0;
    for (const token of a) {
        if (b.has(token))
            intersection += 1;
    }
    if (intersection === 0)
        return 0;
    const union = new Set([...a, ...b]).size;
    const jaccard = intersection / union;
    const containment = intersection / Math.min(a.size, b.size);
    if (intersection >= 4 && containment >= 0.66) {
        return Math.max(jaccard, STORY_SIMILARITY_THRESHOLD);
    }
    return jaccard;
};
const utcDateKey = (date = new Date()) => date.toISOString().slice(0, 10);
const getEditionDate = (req) => {
    const today = utcDateKey();
    const requested = Array.isArray(req.query.edition)
        ? req.query.edition[0]
        : req.query.edition;
    // Archive routing is intentionally not implemented yet. Pinning the endpoint
    // to today's UTC edition prevents arbitrary query strings from creating an
    // unbounded CDN cache surface.
    return requested === today ? requested : today;
};
const editionCutoffMs = (editionDate) => {
    const today = utcDateKey();
    if (editionDate === today)
        return Date.now();
    return Date.parse(`${editionDate}T23:59:59.999Z`);
};
const editionWindow = (editionDate) => {
    const end = editionCutoffMs(editionDate);
    const start = end - MAX_LOOKBACK_HOURS * 60 * 60 * 1000;
    return { start, end };
};
const isInEditionWindow = (value, editionDate) => {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp))
        return false;
    const { start, end } = editionWindow(editionDate);
    // GUD never stretches indefinitely to hit a quota. The current edition
    // prefers the last 24 hours and may look back up to 72 hours, then stops.
    return timestamp >= start && timestamp < end;
};
const issueNumberForDate = (editionDate) => {
    const first = Date.parse(`${FIRST_EDITION_DATE}T00:00:00.000Z`);
    const current = Date.parse(`${editionDate}T00:00:00.000Z`);
    if (Number.isNaN(first) || Number.isNaN(current) || current < first)
        return 1;
    return Math.floor((current - first) / 86_400_000) + 1;
};
const deterministicTieBreak = (editionDate, id) => Number.parseInt(createHash('sha1').update(`${editionDate}|${id}`).digest('hex').slice(0, 8), 16);
const toArticle = ({ sourceId: _sourceId, publisherDomain: _publisherDomain, sourcePriority: _sourcePriority, ...article }) => article;
const buildSourceCandidates = async (source, editionDate) => {
    const feed = await parser.parseURL(source.url);
    const rejected = emptyRejections();
    const candidates = [];
    for (const item of feed.items) {
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
        const excerpt = truncate(cleanText(item.contentSnippet ?? item.content ?? item.summary));
        const searchableText = `${title} ${excerpt ?? ''}`;
        if (hasDisqualifyingSignal(searchableText, title)) {
            rejected.disqualified += 1;
            continue;
        }
        // Generic science/technology novelty is not enough. A story must describe
        // a concrete beneficial outcome before it can enter the edition.
        if (!hasPositiveOutcomeSignal(searchableText)) {
            rejected.noPositiveOutcome += 1;
            continue;
        }
        const score = scoreGoodNews(searchableText);
        if (score < MIN_SCORE) {
            rejected.belowScore += 1;
            continue;
        }
        const imageCandidates = imageCandidatesFromFeedItem(item, link);
        candidates.push({
            id: makeId(source.name, title, link),
            title,
            url: link,
            source: source.name,
            publishedAt: new Date(publishedAt).toISOString(),
            category: classifyCategory(searchableText, source.category),
            excerpt,
            imageCandidates,
            imageUrl: imageCandidates[0],
            score,
            sourceId: source.id,
            publisherDomain: source.publisherDomain,
            sourcePriority: source.priority,
        });
    }
    return {
        candidates,
        diagnostics: {
            sourceId: source.id,
            source: source.name,
            feedItems: feed.items.length,
            candidates: candidates.length,
            rejected,
        },
    };
};
const fetchSourcesWithConcurrency = async (editionDate) => {
    const results = new Array(newsSources.length);
    let nextIndex = 0;
    const worker = async () => {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= newsSources.length)
                return;
            try {
                results[index] = {
                    status: 'fulfilled',
                    value: await buildSourceCandidates(newsSources[index], editionDate),
                };
            }
            catch (reason) {
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
    if (Number.isNaN(published) || Number.isNaN(cutoff))
        return Number.POSITIVE_INFINITY;
    return Math.max(0, (cutoff - published) / 3_600_000);
};
const buildEdition = (candidates, editionDate) => {
    const ranked = [...candidates].sort((a, b) => {
        const totalA = a.score + a.sourcePriority;
        const totalB = b.score + b.sourcePriority;
        if (totalB !== totalA)
            return totalB - totalA;
        const publishedDelta = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        if (publishedDelta !== 0)
            return publishedDelta;
        return (deterministicTieBreak(editionDate, b.id) -
            deterministicTieBreak(editionDate, a.id));
    });
    const accepted = [];
    const usedSources = new Set();
    const usedPublisherDomains = new Set();
    const categoryCounts = new Map();
    const canAccept = (article, enforceCategoryCap) => {
        if (usedSources.has(article.sourceId))
            return { ok: false, tokens: [] };
        if (usedPublisherDomains.has(article.publisherDomain)) {
            return { ok: false, tokens: [] };
        }
        if (enforceCategoryCap &&
            (categoryCounts.get(article.category) ?? 0) >= CATEGORY_SOFT_CAP) {
            return { ok: false, tokens: [] };
        }
        const tokens = normalizedTitle(article.title);
        const duplicateStory = accepted.some(({ tokens: otherTokens }) => storySimilarity(tokens, otherTokens) >= STORY_SIMILARITY_THRESHOLD);
        return { ok: !duplicateStory, tokens };
    };
    const accept = (article, tokens) => {
        accepted.push({ article, tokens });
        usedSources.add(article.sourceId);
        usedPublisherDomains.add(article.publisherDomain);
        categoryCounts.set(article.category, (categoryCounts.get(article.category) ?? 0) + 1);
    };
    // Freshness is a staged editorial preference, not a quota. GUD first takes
    // the strongest stories from 24h, then allows up to 72h and stops. Fewer
    // genuinely good stories are preferable to filler.
    for (const windowHours of SELECTION_WINDOWS_HOURS) {
        for (const article of ranked) {
            if (accepted.length >= EDITION_LIMIT)
                break;
            if (ageHoursAtEditionCutoff(article.publishedAt, editionDate) > windowHours) {
                continue;
            }
            const result = canAccept(article, true);
            if (result.ok)
                accept(article, result.tokens);
        }
        if (accepted.length >= EDITION_LIMIT)
            break;
    }
    // Category diversity is a soft constraint. Source/domain uniqueness, story
    // deduplication, positivity and political/sports exclusions are never relaxed.
    if (accepted.length < EDITION_LIMIT) {
        for (const article of ranked) {
            if (accepted.length >= EDITION_LIMIT)
                break;
            if (ageHoursAtEditionCutoff(article.publishedAt, editionDate) >
                MAX_LOOKBACK_HOURS) {
                continue;
            }
            const result = canAccept(article, false);
            if (result.ok)
                accept(article, result.tokens);
        }
    }
    return accepted.map(({ article }) => toArticle(article));
};
const errorMessage = (reason) => {
    if (reason instanceof Error)
        return reason.message;
    return String(reason);
};
export default async function handler(req, res) {
    if (req.method && req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed.' });
    }
    const editionDate = getEditionDate(req);
    try {
        const results = await fetchSourcesWithConcurrency(editionDate);
        const fulfilled = results.filter((result) => result.status === 'fulfilled');
        const fulfilledCandidates = fulfilled.flatMap((result) => result.value.candidates);
        const sourceDiagnostics = fulfilled.map((result) => result.value.diagnostics);
        const selectedArticles = buildEdition(fulfilledCandidates, editionDate);
        const articles = await enrichArticleImages(selectedArticles);
        const successfulSources = fulfilled.length;
        const sourcesWithCandidates = sourceDiagnostics.filter((source) => source.candidates > 0).length;
        const uniqueSources = new Set(articles.map((article) => article.source)).size;
        const failedSources = results.flatMap((result, index) => result.status === 'rejected'
            ? [
                {
                    source: newsSources[index].name,
                    id: newsSources[index].id,
                    reason: errorMessage(result.reason),
                },
            ]
            : []);
        const rejectionTotals = sourceDiagnostics.reduce((totals, source) => ({
            invalid: totals.invalid + source.rejected.invalid,
            blocked: totals.blocked + source.rejected.blocked,
            outOfWindow: totals.outOfWindow + source.rejected.outOfWindow,
            disqualified: totals.disqualified + source.rejected.disqualified,
            noPositiveOutcome: totals.noPositiveOutcome + source.rejected.noPositiveOutcome,
            belowScore: totals.belowScore + source.rejected.belowScore,
        }), emptyRejections());
        const totalFeedItems = sourceDiagnostics.reduce((total, source) => total + source.feedItems, 0);
        const { start, end } = editionWindow(editionDate);
        // The edition date is part of the request URL, so every day receives a new
        // CDN cache key. React reveals the paper three stories at a time, but the
        // complete tiny JSON edition is fetched once and shared by every visitor.
        res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600, stale-if-error=604800');
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        res.setHeader('Vercel-Cache-Tag', `gud-${editionDate}-${EDITORIAL_RULESET_VERSION}`);
        res.setHeader('X-GUD-Edition', editionDate);
        return res.status(200).json({
            articles,
            generatedAt: new Date().toISOString(),
            editionDate,
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
                imageCount: articles.filter((article) => Boolean(article.imageUrl)).length,
                imageCoverage: articles.length > 0
                    ? Number((articles.filter((article) => Boolean(article.imageUrl)).length / articles.length).toFixed(3))
                    : 0,
                windowHours: MAX_LOOKBACK_HOURS,
                preferredWindowHours: 24,
                selectedLookbackHours: Math.ceil(articles.reduce((oldest, article) => Math.max(oldest, ageHoursAtEditionCutoff(article.publishedAt, editionDate)), 0)),
                windowStart: new Date(start).toISOString(),
                windowEnd: new Date(end).toISOString(),
                totalFeedItems,
                rejections: rejectionTotals,
                failedSources,
            },
        });
    }
    catch (error) {
        console.error('GUD RSS error:', error);
        return res.status(500).json({
            articles: [],
            generatedAt: new Date().toISOString(),
            editionDate,
            issueNumber: issueNumberForDate(editionDate),
            count: 0,
            editionLimit: EDITION_LIMIT,
            editorialRulesetVersion: EDITORIAL_RULESET_VERSION,
            uniqueSources: 0,
            error: 'Unable to build today’s edition.',
        });
    }
}
