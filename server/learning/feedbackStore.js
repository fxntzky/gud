import { randomUUID } from 'node:crypto';
import { get, list, put } from '@vercel/blob';

// Append-only human review records: no concurrent read-modify-write race.
// Public visitors cannot access this private namespace.
const PREFIX = 'gud/private-reviews/v7/';
const keyFor = (date, edition, id) => `${PREFIX}${date}/${edition}/${id}/`;
const decode = async (pathname) => {
  const blob = await get(pathname, { access: 'private', useCache: false });
  if (blob?.statusCode !== 200 || !blob.stream) return null;
  return JSON.parse(await new Response(blob.stream).text());
};
export async function saveEditorialReview(review) {
  const key = `${keyFor(review.editionDate, review.edition, review.id)}${Date.now()}-${randomUUID()}.json`;
  const payload = {
    ...review,
    reviewedAt: new Date().toISOString(),
    origin: 'human_editor',
  };
  await put(key, JSON.stringify(payload), {
    access: 'private', addRandomSuffix: false, contentType: 'application/json',
  });
  return payload;
}

async function readAll(prefix, cap) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, limit: Math.min(100, cap - blobs.length), cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && blobs.length < cap);
  const records = [];
  // Bounded concurrency to prevent large simultaneous Blob requests.
  for (let i = 0; i < blobs.length; i += 8) {
    const group = await Promise.all(blobs.slice(i, i + 8).map((b) => decode(b.pathname).catch(() => null)));
    records.push(...group.filter(Boolean));
  }
  const latest = new Map();
  for (const row of records) {
    const key = `${row.editionDate}:${row.edition}:${row.id}`;
    if (!latest.has(key) || row.reviewedAt > latest.get(key).reviewedAt) latest.set(key, row);
  }
  return [...latest.values()];
}

export const getEditionReviews = async (date, edition) =>
  readAll(`${PREFIX}${date}/${edition}/`, 80);

// Weekly export; bounded rather than scanning the entire archive on every visit.
export const getReviewedTrainingRows = async () => {
  const records = await readAll(PREFIX, 1500);
  return records.filter((row) =>
    ['constructive', 'not_constructive'].includes(row.label) &&
    typeof row.title === 'string' && row.title.trim().length > 0,
  ).map(({ id, title, deck, label, reviewedAt }) => ({
    id, title, deck: deck || '', label, reviewedAt, origin: 'human_editor',
  }));
};
