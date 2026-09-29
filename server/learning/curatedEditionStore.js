import { get, put } from '@vercel/blob';

const pathnameFor = ({ editionDate, edition, rulesetVersion }) =>
  `gud/curated-editions/${rulesetVersion}/${editionDate}/${edition}.json`;

// The baseline edition remains immutable. Only SAVE writes this secondary
// snapshot. Reads are consistent even when a revision overwrites the same key.
export async function readCuratedEdition(key) {
  try {
    const blob = await get(pathnameFor(key), { access: 'private', useCache: false });
    if (blob?.statusCode !== 200 || !blob.stream) return null;
    return JSON.parse(await new Response(blob.stream).text());
  } catch (error) {
    console.error('GUD curated edition read error:', error);
    return null;
  }
}

export async function commitCuratedEdition(key, payload) {
  await put(pathnameFor(key), JSON.stringify(payload), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
    // Underlying Blob cache also needs a bounded lifetime for overwritten files.
    cacheControlMaxAge: 60, contentType: 'application/json; charset=utf-8',
  });
  return payload;
}
