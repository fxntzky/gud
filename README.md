# GUD · Hybrid Classification Engine v7.0

A finite digital newspaper for constructive news. **Compute once, serve everyone.**
This ZIP extends the existing GUD project without replacing its React newspaper,
curated source lists, category navigation, image resolver or daily shared snapshots.

## Editorial contract

- **4 stories** is the *target* minimum, never a forced filler quota.
- **12 stories** is the hard maximum for each edition (English and LATAM).
- 24 h preferred news window, expandable to 72 h; one story per publisher/domain.
- Constructive progress is not synonymous with a favorable result for a military
  actor, a sports competitor, a company, or the sentiment of an article headline.
- If the local selection is weak or the paid auditor rejects stories, publish fewer.

## Production execution — austerity first

```text
Vercel Cron (once per day per edition)
    ↓
Existing source ingestion / feed bounds / deduplication
    ↓
Rules (existing safeguards + event-direction guard)
    ↓
Portable local ML scoring (initially advisory)
    ↓
SHORTLIST (hard max 18 articles per edition)
    ↓
Optional paid LLM audit (OFF unless deliberately enabled)
    ↓
Shared edition in private Vercel Blob (maximum 12 published)
    ↓
One snapshot distributed to all readers via CDN/browser cache
```

There is **no reader-triggered RSS ingestion, LLM use, or ML training**. If today's
snapshot has not yet been generated, the previous shared snapshot can be served
briefly with a short 60-second CDN cache; if none exists, return a non-generating
503 and show a temporary availability notice.

Cron schedule in `vercel.json`: English 07:00 UTC, LATAM 07:15 UTC daily. Verify that
your Vercel plan supports the configured cron count and function duration.
`CRON_SECRET` is checked in both cron endpoints and by the generation handler.
Never set `GUD_ALLOW_ON_DEMAND_BUILD=true` on production or preview deployments.

## Three-stage classification

**01 · Rule Engine:** the existing lexical score and editorial eligibility are
retained as the cold-start baseline. `server/classification/editorialGuard.js`
adds high-specificity vetoes for competitive military successes, sports-result
positivity, and worsening environmental/discovery stories. We use direction and
outcome checks before generic positive vocabulary. Legacy patterns remain
imperfect; the supplied tests cover representative regressions, not every headline.

**02 · ML:** `server/classification/model.json` is a small TF-IDF (uni/bi-grams)
plus logistic-regression model exported as portable JSON. Node inference requires
no Python package, no paid endpoint and no token usage. The **initial 115 synthetic
bootstrap examples are NOT production evidence**. The initial model is advisory,
used as a small ranking signal, and may not automatically reject or rescue legacy
candidates. Separately verified human examples accumulate in the private feedback
store. A model may change the hard eligibility boundary only when it passes a
separately curated, non-overlapping real-world gold dataset, and the deployment
explicitly enables `GUD_ML_HARD_FILTER=true`. Its raw probability is not calibrated
accuracy. Legacy rejects with potential ML value enter a small **human-only
exploration queue** and never reach the LLM or newspaper unless later reviewed.

**03 · LLM:** `server/classification/llmAuditor.js` is disabled by default. When
configured, it receives ONLY the locally shortlisted articles: maximum 18 per
edition, batches of 6, maximum 3 requests and a configurable token-reservation
budget. Its JSON decision is used as an editorial veto; unresolved articles do
not pass automatically. If all requests fail, fallback only to strict local
candidates. None of the original unfiltered feed pool is sent to the paid API.
The dashboard records actual token usage and estimates USD only when deliberate
input/output token pricing is configured.

## Control Room (private frontend)

Access **`/control`**. The route renders an English-language internal dashboard
and does not reveal operational data until authorized by `GET /api/admin`.
Set `GUD_ADMIN_PASSWORD` to a long (>=16 chars) password. The interface keeps the
access key in the active page's memory only; it does not write it to localStorage.
Use HTTPS and add Vercel Firewall / Deployment Protection for brute-force defence.
The dashboard itself runs **no ingestion, no ML training and no paid audits**.

It displays, per edition and UTC day (last 14 days): source/feed counts, rejection
reasons, ML model status and predictions, LLM requests and tokens, cost estimate,
shortlist audit log, publication state and a bounded **exploration** lane. Human
editors can label an article **YES / NO / UNCERTAIN**. All reviews are authenticated,
refer to an actual existing private shortlist item and are saved append-only in
private Blob. UNCERTAIN is not exported as a training label. No public voting API is
included in this cut: anonymous feedback would require abuse/rate limiting first.

## Automated learning

- Vercel daily generation saves telemetry and a small review queue once per edition.
- `POST /api/admin-feedback` stores authenticated human corrections in private Blob.
- `GET /api/training-export` exports **only human-reviewed** YES/NO labels (NDJSON).
- `.github/workflows/gud-train.yml` runs weekly on Monday at 09:00 UTC (or manually),
  fetches the private verified labels, trains a candidate, runs regression tests,
  and commits the changed **model JSON only**. Vercel can then deploy the new model
  through the existing Git integration. Configure GitHub repository secrets
  `GUD_BASE_URL` (e.g. `https://your-project.vercel.app`) and `GUD_ADMIN_PASSWORD`.
  Workflow requires repo Actions write permission; it skips safely if secrets are absent.
- `data/training/editorial_seed.jsonl`: synthetic cold-start examples only.
- `data/training/validated.jsonl`: empty locally, `.gitignore`d, filled by export.
- `data/training/gold.jsonl`: **must be a separate, manually checked real-world
  holdout** before allowing automatic ML promotion. The promotion gate requires
  >=100 human labels, >=40 distinct gold examples, >=0.92 positive precision,
  <=0.08 false-positive rate and >=0.50 recall on the independent gold set.
- Predictions from the LLM and ML **never automatically label their own training
  data**. Human-reviewed labels are the only auto-collected supervised data.

The first model is intentionally advisory and no precision figure is fabricated.
The weekly training job can refresh its weights while the validated filter stays
disabled until real evaluation evidence exists.

## Environment variables

Copy `.env.example` into local/private environment or configure Vercel variables.
The following are **not** contained in this ZIP:

| Variable | Purpose |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Existing private Vercel Blob integration |
| `CRON_SECRET` | Required for cron-only ingestion |
| `GUD_ADMIN_PASSWORD` | Private dashboard / verified-label export |
| `GUD_LLM_ENABLED` | `false` by default, `true` only with deliberate budget |
| `OPENAI_API_KEY` | Optional, server-only; never use `VITE_` prefix |
| `GUD_LLM_MODEL` | Defaults to `gpt-4.1-nano` |
| `GUD_MAX_AUDIT_ARTICLES` | Defaults to 18, hard capped at 18 |
| `GUD_MAX_LLM_TOKENS_PER_EDITION` | Defaults to 6000, hard capped at 14000 |
| `GUD_LLM_INPUT_USD_PER_1M` / `GUD_LLM_OUTPUT_USD_PER_1M` | Optional explicit price inputs for dashboard estimates |
| `GUD_ML_HARD_FILTER` | `false` until independent validation |
| `GUD_ALLOW_ON_DEMAND_BUILD` | `false`; set `true` only for local Vercel Dev preview |

**IMPORTANT:** Deploy with `CRON_SECRET` and Blob configured, or the reader endpoint
will correctly refrain from expensive on-demand generation and may display the
availability notice until the first scheduled build.

## Local usage and tests

```bash
npm install
npm test
npm run build
npm run dev:vercel
# For local preview only, set GUD_ALLOW_ON_DEMAND_BUILD=true in .env.local
```

Optional model retraining outside Actions:

```bash
python3 -m pip install scikit-learn==1.8.0
npm run train:ml
```

The Python script is a *training-time* dependency only. Node performs inference in
production from the bundled JSON file. Do not commit API keys or exported private
labels. The ZIP intentionally excludes `.env.local`, `.git`, `node_modules`, `dist`,
`.vercel` and build caches. Retain your existing Vercel project association and
private configuration before copying the new source over the project folder.

## Operational boundaries / next work

This is the first **functional hybrid integration**, not a claim that a tiny
synthetic ML model is already more precise than a language model. Monitor precision
of reviewed real articles, broaden the holdout across EN/ES, tune local model
admission thresholds from data, and keep independent tests of false positives.
Daily snapshot caching prevents repeated paid analysis within the edition; a
cross-day, cross-language persistent LLM-result cache is not yet included.
