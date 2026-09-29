import { get, put } from '@vercel/blob';
import { EDITORIAL_RULESET_VERSION } from '../edition.js';

const pathFor = (date, edition) => `gud/private-telemetry/${EDITORIAL_RULESET_VERSION}/${date}/${edition}.json`;
export async function saveTelemetry(date, edition, payload) {
  try {
    await put(pathFor(date, edition), JSON.stringify(payload), {
      access: 'private', addRandomSuffix: false, contentType: 'application/json',
    });
    return true;
  } catch (error) {
    console.error('GUD telemetry could not be saved:', error);
    return false;
  }
}
export async function readTelemetry(date, edition) {
  try {
    const result = await get(pathFor(date, edition), { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text());
  } catch { return null; }
}
