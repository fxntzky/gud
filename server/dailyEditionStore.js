import { get, put } from '@vercel/blob';

const BLOB_ACCESS = 'private';
const SNAPSHOT_PREFIX = 'gud/daily-editions';

const pathnameForEdition = (
  editionDate,
  edition,
  rulesetVersion,
) =>
  `${SNAPSHOT_PREFIX}/${rulesetVersion}/${editionDate}/${edition}.json`;

const streamToText = async (stream) => {
  if (!stream) return '';
  return new Response(stream).text();
};

export const sharedEditionStoreConfigured = () => true;

export const readDailyEdition = async ({
  editionDate,
  edition,
  rulesetVersion,
}) => {
  const pathname = pathnameForEdition(
    editionDate,
    edition,
    rulesetVersion,
  );

  try {
    const result = await get(pathname, {
      access: BLOB_ACCESS,
      useCache: false,
    });

    if (
      !result ||
      result.statusCode !== 200 ||
      !result.stream
    ) {
      return null;
    }

    const raw = await streamToText(result.stream);

    if (!raw) return null;

    return JSON.parse(raw);
  } catch (error) {
    console.error(
      'GUD daily edition read error:',
      error,
    );

    return null;
  }
};

export const commitDailyEdition = async ({
  editionDate,
  edition,
  rulesetVersion,
  payload,
}) => {
  const pathname = pathnameForEdition(
    editionDate,
    edition,
    rulesetVersion,
  );

  try {
    await put(
      pathname,
      JSON.stringify(payload),
      {
        access: BLOB_ACCESS,
        addRandomSuffix: false,
        contentType:
          'application/json; charset=utf-8',
      },
    );

    return payload;
  } catch {
    // First writer wins.
    // If two requests generate the same daily edition
    // concurrently, only one snapshot is committed.
    // Every other request reads that exact winning snapshot.
    const winner = await readDailyEdition({
      editionDate,
      edition,
      rulesetVersion,
    });

    if (winner) return winner;

    throw new Error(
      'Unable to commit or recover the shared daily edition.',
    );
  }
};
