import { authorizedAdmin } from '../server/learning/adminAuth.js';
import { readDailyEdition } from '../server/dailyEditionStore.js';
import { readTelemetry } from '../server/learning/telemetryStore.js';
import { getEditionReviews } from '../server/learning/feedbackStore.js';
import { readCuratedEdition } from '../server/learning/curatedEditionStore.js';
import {
  EDITORIAL_RULESET_VERSION,
  EDITION_LIMIT,
  EDITION_MIN_TARGET,
} from '../server/edition.js';
import { getMLStatus } from '../server/classification/mlClassifier.js';

const buildReviewSummary = (reviews) => {
  const summary = {
    saved: reviews.length,
    falsePositivesCorrected: 0,
    confirmedPositives: 0,
    promotedPositives: 0,
    otherNegativeReviews: 0,
    irrelevant: 0,
    repeated: 0,
  };

  for (const review of reviews) {
    switch (review.label) {
      case 'constructive':
        if (review.previous?.published === false) {
          summary.promotedPositives += 1;
        } else {
          summary.confirmedPositives += 1;
        }
        break;

      case 'not_constructive':
        if (review.previous?.published === true) {
          summary.falsePositivesCorrected += 1;
        } else {
          summary.otherNegativeReviews += 1;
        }
        break;

      case 'irrelevant':
        summary.irrelevant += 1;
        break;

      case 'duplicate':
        summary.repeated += 1;
        break;

      default:
        break;
    }
  }

  return summary;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed.',
    });
  }

  if (
    !process.env.GUD_ADMIN_PASSWORD ||
    process.env.GUD_ADMIN_PASSWORD.length < 16
  ) {
    return res.status(503).json({
      error: 'Dashboard password is not configured.',
    });
  }

  if (!authorizedAdmin(req)) {
    return res.status(401).json({
      error: 'Unauthorized.',
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const requested = Array.isArray(req.query?.date)
    ? req.query.date[0]
    : req.query?.date;

  const selected = /^\d{4}-\d{2}-\d{2}$/.test(requested || '')
    ? requested
    : today;

  // The control room only fetches recent daily telemetry;
  // it is not a general Blob browser.
  const age =
    (
      Date.parse(`${today}T00:00:00Z`) -
      Date.parse(`${selected}T00:00:00Z`)
    ) /
    86_400_000;

  if (
    !Number.isFinite(age) ||
    age < 0 ||
    age > 14
  ) {
    return res.status(400).json({
      error: 'Choose a date from the last 14 days.',
    });
  }

  try {
    const editions = {};

    for (const edition of ['english', 'latam']) {
      const [
        baseSnapshot,
        curatedSnapshot,
        originalTelemetry,
        reviews,
      ] = await Promise.all([
        readDailyEdition({
          editionDate: selected,
          edition,
          rulesetVersion: EDITORIAL_RULESET_VERSION,
        }),

        readCuratedEdition({
          editionDate: selected,
          edition,
          rulesetVersion: EDITORIAL_RULESET_VERSION,
        }),

        readTelemetry(selected, edition),

        getEditionReviews(selected, edition),
      ]);

      const snapshot = curatedSnapshot || baseSnapshot;

      const liveIds = new Set(
        (snapshot?.articles || []).map((item) => item.id),
      );

      const reviewedUrls = new Map(
        reviews
          .filter((row) => row.url)
          .map((row) => [row.id, row.url]),
      );

      const telemetry = originalTelemetry
        ? {
            ...originalTelemetry,

            decisions: (
              originalTelemetry.decisions || []
            ).map((item) => ({
              ...item,

              url:
                item.url ||
                reviewedUrls.get(item.id),

              published: liveIds.has(item.id),
            })),
          }
        : null;

      const reviewSummary =
        buildReviewSummary(reviews);

      editions[edition] = {
        status: snapshot
          ? 'ready'
          : 'not_generated',

        generatedAt:
          snapshot?.generatedAt || null,

        curatedAt:
          snapshot?.curatedAt || null,

        count:
          snapshot?.count ?? 0,

        sourcePool:
          snapshot?.sourcePool ?? null,

        candidateCount:
          snapshot?.candidateCount ?? null,

        telemetry,

        reviews: Object.fromEntries(
          reviews.map((row) => [
            row.id,
            row.label,
          ]),
        ),

        reviewSummary,

        // The public snapshot retains article URLs.
        // This lets existing shortlists link to their sources
        // even before telemetry has URLs.
        articles: (
          snapshot?.articles || []
        ).map(
          ({
            id,
            title,
            source,
            category,
            url,
          }) => ({
            id,
            title,
            source,
            category,
            url,
          }),
        ),
      };
    }

    return res.status(200).json({
      date: selected,
      version: EDITORIAL_RULESET_VERSION,
      ml: getMLStatus(),
      editionLimit: EDITION_LIMIT,
      editionMinTarget: EDITION_MIN_TARGET,
      editions,
    });
  } catch (error) {
    console.error(
      'GUD private dashboard error:',
      error,
    );

    return res.status(503).json({
      error:
        'Private operational data unavailable.',
    });
  }
}