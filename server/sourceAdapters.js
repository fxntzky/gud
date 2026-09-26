import Parser from 'rss-parser';

const parser = new Parser({
    timeout: 5000,
    headers: {
        'User-Agent': 'GUD/0.9 (+finite-edition-newspaper)',
    },
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['media:thumbnail', 'mediaThumbnail'],
            ['content:encoded', 'contentEncoded'],
        ],
    },
});

const LISTING_TIMEOUT_MS = 5000;
const ARTICLE_TIMEOUT_MS = 2600;
const MAX_LISTING_BYTES = 650_000;
const MAX_ARTICLE_BYTES = 220_000;
const DEFAULT_WEB_LINK_LIMIT = 18;
const ARTICLE_CONCURRENCY = 5;

const decodeEntities = (value = '') =>
    value
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#8211;|&#x2013;/gi, '–')
        .replace(/&#8212;|&#x2014;/gi, '—')
        .replace(/&#8220;|&#8221;|&#x201c;|&#x201d;/gi, '"')
        .replace(/&#(\d+);/g, (match, code) => {
            const number = Number(code);
            return Number.isFinite(number) ? String.fromCodePoint(number) : match;
        });

const cleanText = (value) => {
    if (!value) return undefined;
    const text = decodeEntities(String(value))
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text || undefined;
};

const htmlAttribute = (tag, name) => {
    const match = tag.match(
        new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'),
    );
    return match?.[1];
};

const fetchHtmlPrefix = async (url, timeoutMs, maxBytes) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (compatible; GUD/0.9; +finite-edition-newspaper)',
                Accept: 'text/html,application/xhtml+xml',
            },
        });

        if (!response.ok) {
            throw new Error(`Status code ${response.status}`);
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('text/html')) {
            throw new Error(
                `Unexpected content type ${contentType || 'unknown'}`,
            );
        }

        if (!response.body?.getReader) {
            return (await response.text()).slice(0, maxBytes);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let html = '';
        let bytes = 0;

        try {
            while (bytes < maxBytes) {
                const { done, value } = await reader.read();
                if (done) break;
                bytes += value.byteLength;
                html += decoder.decode(value, { stream: true });
                if (/<\/html>/i.test(html)) break;
            }
            html += decoder.decode();
        } finally {
            await reader.cancel().catch(() => undefined);
        }

        return html.slice(0, maxBytes);
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

const metaContent = (html, wantedKeys) => {
    const wanted = new Set(wantedKeys.map((key) => key.toLowerCase()));
    const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

    for (const tag of tags) {
        const key = (
            htmlAttribute(tag, 'property') ??
            htmlAttribute(tag, 'name') ??
            htmlAttribute(tag, 'itemprop') ??
            ''
        ).toLowerCase();
        if (!wanted.has(key)) continue;
        const content = cleanText(htmlAttribute(tag, 'content'));
        if (content) return content;
    }

    return undefined;
};

const extractTitle = (html, fallback) =>
    metaContent(html, ['og:title', 'twitter:title', 'headline']) ??
    cleanText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ??
    cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ??
    cleanText(fallback);

const extractDescription = (html) =>
    metaContent(html, [
        'og:description',
        'twitter:description',
        'description',
    ]);

const monthNumber = (name) => {
    const months = {
        enero: 1,
        febrero: 2,
        marzo: 3,
        abril: 4,
        mayo: 5,
        junio: 6,
        julio: 7,
        agosto: 8,
        septiembre: 9,
        setiembre: 9,
        octubre: 10,
        noviembre: 11,
        diciembre: 12,
    };
    return months[name.toLowerCase()];
};

const spanishDateToIso = (day, monthName, year) => {
    const month = monthNumber(monthName);
    if (!month) return undefined;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`;
};

const extractPublishedAt = (html) => {
    const metaDate = metaContent(html, [
        'article:published_time',
        'og:published_time',
        'datepublished',
        'date',
        'pubdate',
        'parsely-pub-date',
    ]);
    if (metaDate && !Number.isNaN(Date.parse(metaDate))) return metaDate;

    const jsonLd = html.match(
        /["']datePublished["']\s*:\s*["']([^"']+)["']/i,
    )?.[1];
    if (jsonLd && !Number.isNaN(Date.parse(jsonLd))) return jsonLd;

    const timeDate = html.match(
        /<time\b[^>]*datetime\s*=\s*["']([^"']+)["']/i,
    )?.[1];
    if (timeDate && !Number.isNaN(Date.parse(timeDate))) return timeDate;

    const text = cleanText(html.slice(0, 90_000));
    const spanish = text?.match(
        /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(20\d{2})\b/i,
    );
    if (spanish) {
        return spanishDateToIso(spanish[1], spanish[2], spanish[3]);
    }

    const shortSpanish = text?.match(
        /\b(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)\.?\s+(20\d{2})\b/i,
    );
    if (shortSpanish) {
        const shortMonths = {
            ene: 'enero',
            feb: 'febrero',
            mar: 'marzo',
            abr: 'abril',
            may: 'mayo',
            jun: 'junio',
            jul: 'julio',
            ago: 'agosto',
            sep: 'septiembre',
            sept: 'septiembre',
            oct: 'octubre',
            nov: 'noviembre',
            dic: 'diciembre',
        };
        return spanishDateToIso(
            shortSpanish[1],
            shortMonths[shortSpanish[2].toLowerCase()],
            shortSpanish[3],
        );
    }

    const numeric = text?.match(
        /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/,
    );
    if (numeric) {
        const day = Number(numeric[1]);
        const month = Number(numeric[2]);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            return `${numeric[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`;
        }
    }

    const monthFirst = text?.match(
        /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(\d{1,2}),?\s+(20\d{2})\b/i,
    );
    if (monthFirst) {
        return spanishDateToIso(monthFirst[2], monthFirst[1], monthFirst[3]);
    }

    return undefined;
};

const extractImage = (html, baseUrl) => {
    const raw = metaContent(html, ['og:image', 'twitter:image']);
    if (!raw) return undefined;
    try {
        return new URL(raw, baseUrl).href;
    } catch {
        return undefined;
    }
};

const hostnameMatches = (hostname, domain) =>
    hostname === domain || hostname.endsWith(`.${domain}`);

const shouldKeepLink = (source, url) => {
    const target = `${url.pathname}${url.search}`;
    const includes = source.webPathIncludes ?? [];
    const excludes = source.webPathExcludes ?? [];

    if (includes.length > 0 && !includes.some((part) => target.includes(part))) {
        return false;
    }
    if (excludes.some((part) => target.includes(part))) return false;
    if (/\.(?:jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3)$/i.test(url.pathname)) {
        return false;
    }
    return true;
};

const GENERIC_LINK_TEXT = /^(?:leer\s+(?:más|artículo)|ver\s+(?:más|nota|artículo)|más\s+información|seguir\s+leyendo|read\s+more)$/i;

const discoverArticleLinks = (html, source) => {
    const links = [];
    const seen = new Set();
    const anchorPattern =
        /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = anchorPattern.exec(html))) {
        const anchorText = cleanText(match[2]);
        if (!anchorText || anchorText.length < 16) continue;
        if (GENERIC_LINK_TEXT.test(anchorText)) continue;

        let url;
        try {
            url = new URL(decodeEntities(match[1]), source.url);
        } catch {
            continue;
        }

        if (!['http:', 'https:'].includes(url.protocol)) continue;
        const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
        if (!hostnameMatches(hostname, source.publisherDomain)) continue;
        url.hash = '';
        if (!shouldKeepLink(source, url)) continue;

        const href = url.href;
        if (seen.has(href)) continue;
        seen.add(href);

        // Many institutional and magazine listings expose a publication date
        // next to the headline. Keeping that small local fragment lets us avoid
        // an extra article request when the date is already available.
        const contextStart = Math.max(0, match.index - 320);
        const contextEnd = Math.min(html.length, anchorPattern.lastIndex + 720);
        links.push({
            href,
            anchorText,
            contextHtml: html.slice(contextStart, contextEnd),
        });

        if (links.length >= (source.webLinkLimit ?? DEFAULT_WEB_LINK_LIMIT)) {
            break;
        }
    }

    return links;
};

const buildWebItem = async ({ href, anchorText, contextHtml }) => {
    // Fast path: if the listing itself contains a date, keep the headline and
    // let goodnews.js fetch article metadata only for items that survive the
    // 72-hour window and the cheap title veto.
    const listingPublishedAt = extractPublishedAt(contextHtml ?? '');
    if (listingPublishedAt) {
        return {
            title: anchorText,
            link: href,
            isoDate: listingPublishedAt,
            pubDate: listingPublishedAt,
        };
    }

    const html = await fetchHtmlPrefix(
        href,
        ARTICLE_TIMEOUT_MS,
        MAX_ARTICLE_BYTES,
    );
    const title = extractTitle(html, anchorText);
    const publishedAt = extractPublishedAt(html);
    const description = extractDescription(html);
    const imageUrl = extractImage(html, href);

    if (!title || !publishedAt) return undefined;

    return {
        title,
        link: href,
        isoDate: publishedAt,
        pubDate: publishedAt,
        summary: description,
        contentSnippet: description,
        enclosure: imageUrl
            ? { url: imageUrl, type: 'image/jpeg' }
            : undefined,
    };
};

const fetchWebItems = async (source) => {
    const listingHtml = await fetchHtmlPrefix(
        source.url,
        LISTING_TIMEOUT_MS,
        MAX_LISTING_BYTES,
    );
    const links = discoverArticleLinks(listingHtml, source);
    const items = new Array(links.length);
    let nextIndex = 0;

    const worker = async () => {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= links.length) return;

            try {
                items[index] = await buildWebItem(links[index]);
            } catch {
                items[index] = undefined;
            }
        }
    };

    await Promise.all(
        Array.from(
            { length: Math.min(ARTICLE_CONCURRENCY, links.length) },
            () => worker(),
        ),
    );

    return items.filter(Boolean);
};

export const fetchSourceItems = async (source) => {
    if (source.type === 'web') {
        return fetchWebItems(source);
    }

    const feed = await parser.parseURL(source.url);
    return feed.items ?? [];
};
