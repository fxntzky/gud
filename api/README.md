# GUD

A finite digital newspaper for constructive and genuinely good news.

**The internet never ends. This newspaper does.**

GUD deliberately avoids generative AI and paid news APIs. It ingests public
RSS/Atom feeds from ordinary publishers and primary institutions, applies
deterministic editorial rules, deduplicates events and publishes one shared
daily edition.

## Product rules

- The edition has no quota. Fewer strong stories are better than filler.
- 24 stories is only a hard safety cap.
- Maximum 1 story per publisher/domain.
- Dedicated “good news” / “positive news” competitors are blacklisted.
- Duplicate coverage of the same event is collapsed to one story.
- Electoral / partisan politics and sports-result fandom are excluded.
- A story must describe a concrete beneficial outcome, not merely sound upbeat.
- External articles always open in a new tab.
- No infinite scroll. The newspaper ends.

## Freshness

GUD first selects qualifying stories from the previous 24 hours and may expand
the window to 72 hours. It stops there. It does not reach farther back merely to
hit an arbitrary story count.

The response is cached as one shared daily edition. React initially mounts only
3 stories and reveals the next 3 with `IntersectionObserver` as the reader moves
through the paper.

## Images

Image resolution follows this order:

1. RSS `media:content`
2. RSS `media:thumbnail`
3. RSS enclosure
4. first useful image in RSS content
5. article `og:image:secure_url`
6. article `og:image`
7. `twitter:image`
8. `link[rel=image_src]`
9. JSON-LD lead image

Article-page metadata is fetched only for selected stories still missing an
image, with bounded concurrency, a short timeout and a small HTML read limit.
Images are never generated and no generic stock photography is inserted.

If a real image still cannot be resolved, the left media rail becomes an
explicit **HOUSE MESSAGE** block using neutral editorial copy such as “life is gud.”. It is visually separated
from the story so it can never be mistaken for editorial photography. The same
rail can later host clearly-labelled supported causes once those organizations
are deliberately selected.

## Stack

- Vite
- React
- TypeScript
- SCSS
- Vercel Functions
- `rss-parser`
- Vercel CDN caching
- No database yet
- No OpenAI API

## Local setup

```bash
npm install
npm run dev:vercel
```

Use `npm run dev:vercel` for the complete app because `/api/goodnews` is a
Vercel Function.

## Existing Vercel project

If this code replaces files inside the local `gud` folder already linked to
Vercel, keep `.vercel/`, `.env.local` and your existing `package-lock.json`.

If unpacked into a fresh folder, run:

```bash
npx vercel link
```

Then link to the existing Vercel project `good-news` rather than creating a new
project.

## Data flow

```text
curated ordinary / primary sources
  ↓
RSS normalization
  ↓
competitor blacklist
  ↓
GUD Score + hard editorial exclusions
  ↓
cross-publisher story dedupe
  ↓
1 story per publisher/domain
  ↓
24h → at most 72h
  ↓
up to 24 strong stories (not a quota)
  ↓
RSS image resolver
  ↓
OpenGraph / Twitter image fallback for missing images
  ↓
date-keyed Vercel CDN cache
  ↓
React
  ↓
3 stories → scroll → 3 stories → end of the finite daily edition
```

## Important files

- `api/newsSources.ts` — source pool and competitor blacklist.
- `api/goodNewsScore.ts` — deterministic editorial rules.
- `api/classifyCategory.ts` — deterministic category classification.
- `api/imageResolver.ts` — RSS + article-metadata image resolution.
- `api/goodnews.ts` — ingestion, selection, dedupe, image enrichment and cache.
- `src/components/ArticleCard.tsx` — article row, media rail and house-message fallback.
- `src/App.tsx` — one API fetch plus progressive 3-at-a-time rendering.
- `src/styles/app.scss` — editorial visual system and responsive layout.

## Closing rule

**LIFE IS GOOD.**  
*Go outside.*

## Deployment note

Production uses a single Vercel Function at `api/goodnews.js`. Shared backend logic lives in `server/` so helper modules are not treated as separate API Functions on the Hobby plan.
