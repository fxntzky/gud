import { createHash, timingSafeEqual } from 'node:crypto';
export function authorizedAdmin(req) {
  const secret = process.env.GUD_ADMIN_PASSWORD;
  if (!secret || secret.length < 16) return false;
  const header = req.headers.authorization || '';
  if (!/^Basic /i.test(header)) return false;
  let plain = '';
  try { plain = Buffer.from(header.replace(/^Basic\s+/i, ''), 'base64').toString('utf8'); }
  catch { return false; }
  const supplied = plain.startsWith('admin:') ? plain.slice(6) : '';
  const actualHash = createHash('sha256').update(secret).digest();
  const suppliedHash = createHash('sha256').update(supplied).digest();
  return timingSafeEqual(actualHash, suppliedHash);
}
