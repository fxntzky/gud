// Pure composition: the automatic daily edition is immutable; reviewed editions
// are derived only when the editor explicitly presses SAVE EDITORIAL REVIEW.
// 'irrelevant' is POSITIVE for training, but NOT eligible for today's public feed.
const CATEGORIES = new Set([
  'science', 'health', 'nature', 'technology', 'society', 'education', 'culture', 'community',
]);

const validUrl = (value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
};

export function appliedReviewMap(priorReviews, changes) {
  const labels = new Map(priorReviews.map(({ id, label }) => [id, label]));
  for (const { id, label } of changes) {
    if (label === 'clear') labels.delete(id);
    else labels.set(id, label);
  }
  return labels;
}

// A stored original URL is required for promoting historical Exploration
// entries. This resolves current input first, then links from earlier saves.
export function resolveAuditUrls(decisions, changes, priorReviews) {
  const changesById = new Map(changes.map((row) => [row.id, row]));
  const priorById = new Map(priorReviews.map((row) => [row.id, row]));
  return decisions.map((row) => ({
    ...row, url: row.url || changesById.get(row.id)?.sourceUrl || priorById.get(row.id)?.url,
  }));
}

const promoteAuditArticle = (decision, base) => {
  if (!decision || !validUrl(decision.url) ||
      typeof decision.title !== 'string' || !decision.title.trim() ||
      typeof decision.source !== 'string' || !decision.source.trim() ||
      !CATEGORIES.has(decision.category)) {
    throw new Error('This reviewed article lacks valid publication metadata and cannot be promoted.');
  }
  const images = Array.isArray(decision.imageCandidates)
    ? decision.imageCandidates.filter((url) => typeof url === 'string' && validUrl(url)).slice(0, 8)
    : [];
  return {
    id: decision.id, title: decision.title, url: decision.url,
    source: decision.source,
    // Historical Exploration telemetry did not store publishedAt. An empty
    // string deliberately suppresses the date in the card, rather than
    // inventing a publication date from the edition generation timestamp.
    publishedAt: Number.isFinite(Date.parse(decision.publishedAt || '')) ? decision.publishedAt : '',
    category: decision.category, language: base.language,
    excerpt: decision.excerpt || decision.deck || undefined,
    ...(images.length ? { imageCandidates: images, imageUrl: images[0] } : {}),
    score: Number.isFinite(decision.ruleScore) ? decision.ruleScore : 0,
  };
};

export function composeEditorialEdition(base, auditDecisions, labelMap, limit = 12, timestamp = new Date().toISOString()) {
  if (!base || !Array.isArray(base.articles) || !Array.isArray(auditDecisions)) {
    throw new Error('An original edition and its audit log are required.');
  }
  const baseArticles = base.articles;
  const baseIds = new Set(baseArticles.map((a) => a.id));
  const yes = baseArticles.filter((article) => labelMap.get(article.id) === 'constructive');
  const additions = auditDecisions
    .filter((row) => !baseIds.has(row.id) && labelMap.get(row.id) === 'constructive')
    .map((row) => promoteAuditArticle(row, base));
  const explicitYes = [...yes, ...additions];
  // An explicit YES must never silently disappear to make room under the cap.
  if (explicitYes.length > limit) {
    throw new Error(`You selected ${explicitYes.length} YES stories, but the edition maximum is ${limit}. Remove or change a selection before saving.`);
  }
  // Unreviewed automatic stories fill any remaining space, preserving original order.
  const automatic = baseArticles.filter((article) => !labelMap.has(article.id));
  const articles = [...explicitYes, ...automatic].slice(0, limit);
  const imageCount = articles.filter((article) => Boolean(article.imageUrl)).length;
  return {
    ...base, articles, count: articles.length,
    uniqueSources: new Set(articles.map((article) => article.source)).size,
    curatedAt: timestamp, curated: true,
    diagnostics: {
      ...(base.diagnostics || {}), imageCount,
      imageCoverage: articles.length ? Number((imageCount / articles.length).toFixed(3)) : 0,
    },
  };
}
