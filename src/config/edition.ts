// 12 is a hard safety cap, not an editorial quota.
// Four stories is the editorial target floor, never a filler requirement.
// If fewer than four genuinely worthwhile stories exist, GUD publishes fewer.
export const EDITION_MIN_TARGET = 4;
export const EDITION_LIMIT = 12;
export const STORIES_PER_REVEAL = 3;
export const FIRST_EDITION_DATE = '2026-09-25';

// Bump this whenever editorial eligibility or the source network changes. It invalidates both the
// browser edition cache and Vercel's URL-based CDN cache for the current day.
export const EDITORIAL_RULESET_VERSION = '7.0.1';
