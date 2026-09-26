// 24 remains a hard safety cap, not an editorial quota.
// A GUD edition is as long as the day's genuinely worthwhile stories require.
export const EDITION_LIMIT = 24;
export const STORIES_PER_REVEAL = 3;
export const FIRST_EDITION_DATE = '2026-09-25';
// Bump this whenever editorial eligibility or the source network changes. It invalidates both the
// browser edition cache and Vercel's URL-based CDN cache for the current day.
export const EDITORIAL_RULESET_VERSION = '6.7';
