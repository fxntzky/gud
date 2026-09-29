import { randomUUID } from 'node:crypto';
import { get, list, put } from '@vercel/blob';
import { flattenReviewRecords, latestReviewRecords, toTrainingRow } from './reviewLogic.js';

// Append-only batches: one private Blob write per SAVE, no shared-state overwrite.
// Keep the v7 prefix to retain reviews saved by the previous per-item UI.
const PREFIX = 'gud/private-reviews/v7/';
const keyFor = (date, edition) => `${PREFIX}${date}/${edition}/`;

const decode = async (pathname) => {
  const blob = await get(pathname, { access: 'private', useCache: false });
  if (blob?.statusCode !== 200 || !blob.stream) return null;
  return JSON.parse(await new Response(blob.stream).text());
};

export async function saveEditorialReviewBatch({ editionDate, edition, changes }) {
  const reviewedAt = new Date().toISOString();
  const reviews = changes.map(({ article, label }) => ({
    editionDate, edition, id: article.id, label,
    title: article.title, deck: article.deck || '', source: article.source,
    previous: { mlLabel: article.mlLabel, llm: article.llm, published: article.published },
    reviewedAt, origin: 'human_editor',
  }));
  const key = `${keyFor(editionDate, edition)}batch-${Date.now()}-${randomUUID()}.json`;
  await put(key, JSON.stringify({ kind: 'editorial_review_batch', editionDate, edition, reviewedAt, reviews }), {
    access: 'private', addRandomSuffix: false, contentType: 'application/json',
  });
  return reviews;
}

async function readAll(prefix, cap) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, limit: Math.min(100, cap - blobs.length), cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && blobs.length < cap);
  const documents = [];
  for (let i = 0; i < blobs.length; i += 8) {
    const group = await Promise.all(blobs.slice(i, i + 8).map((b) => decode(b.pathname).catch(() => null)));
    documents.push(...group.filter(Boolean));
  }
  return latestReviewRecords(flattenReviewRecords(documents));
}

export const getEditionReviews = (date, edition) => readAll(keyFor(date, edition), 80);

// Weekly export: classifier label and editorial taste are separate fields.
export const getReviewedTrainingRows = async () => {
  const rows = await readAll(PREFIX, 1500);
  return rows.map(toTrainingRow).filter(Boolean);
};
