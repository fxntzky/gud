// The positive/negative classifier and editorial interest are independent axes.
// 'irrelevant' is a constructive story with low editorial relevance, NEVER a negative.
// 'duplicate' is editorial-only: the story may be constructive, but GUD already covered it.
export const REVIEW_LABELS = Object.freeze(['constructive', 'not_constructive', 'irrelevant', 'duplicate', 'clear']);
export const isReviewLabel = (value) => REVIEW_LABELS.includes(value);

export function validateReviewBatch(reviews, eligibleIds) {
  if (!Array.isArray(reviews) || reviews.length < 1 || reviews.length > 40) {
    return { valid: false, error: 'Review batch must contain 1–40 changes.' };
  }
  const seen = new Set();
  for (const row of reviews) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
      typeof row.id !== 'string' || !/^[a-f0-9]{40}$/.test(row.id) ||
      !isReviewLabel(row.label) || !eligibleIds.has(row.id) || seen.has(row.id) ||
      (row.sourceUrl !== undefined && (row.label !== 'constructive' ||
        typeof row.sourceUrl !== 'string' || row.sourceUrl.length > 2048 ||
        !/^https?:\/\/[^\s]+$/i.test(row.sourceUrl)))) {
      return { valid: false, error: 'Invalid, duplicate or unknown editorial review.' };
    }
    seen.add(row.id);
  }
  return { valid: true };
}

// Old per-item records and new single-write batches coexist in the same namespace.
export function flattenReviewRecords(documents) {
  return documents.flatMap((document) => {
    if (!document || typeof document !== 'object') return [];
    if (document.kind === 'editorial_review_batch' && Array.isArray(document.reviews)) {
      return document.reviews;
    }
    return document.id && document.label ? [document] : [];
  }).filter((row) => {
    if (!row || typeof row !== 'object') return false;
    if (typeof row.id !== 'string' || typeof row.editionDate !== 'string' ||
      typeof row.edition !== 'string' || typeof row.reviewedAt !== 'string') return false;
    // Historical '?' labels remain in storage but never become training truth.
    return isReviewLabel(row.label) || row.label === 'uncertain';
  });
}

export function latestReviewRecords(rows) {
  const latest = new Map();
  for (const row of rows) {
    const key = `${row.editionDate}:${row.edition}:${row.id}`;
    const previous = latest.get(key);
    if (!previous || row.reviewedAt >= previous.reviewedAt) latest.set(key, row);
  }
  // A clear tombstone must hide earlier votes; never train on 'clear' or 'uncertain'.
  return [...latest.values()].filter((row) => !['clear', 'uncertain'].includes(row.label));
}

export function toTrainingRow(row) {
  // Duplicate/repeated stories are deliberately excluded from classifier training.
  // Their editorial problem is repetition, not positive-vs-negative classification.
  if (!row || !['constructive', 'not_constructive', 'irrelevant'].includes(row.label) ||
    typeof row.title !== 'string' || !row.title.trim()) return null;
  return {
    id: row.id, title: row.title, deck: row.deck || '',
    // A boring but positive article remains a POSITIVE classification sample.
    label: row.label === 'irrelevant' ? 'constructive' : row.label,
    editorialDecision: row.label,
    editorialRelevance: row.label === 'constructive' ? 'high' :
      row.label === 'irrelevant' ? 'low' : null,
    reviewedAt: row.reviewedAt, origin: 'human_editor',
  };
}
