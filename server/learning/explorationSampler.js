import { createHash } from 'node:crypto';

// Bounded diagnostic sampling: these articles are NOT candidates for automatic
// publication, LLM audit, or machine-learning training until human-labelled.
const OUTCOME_REASON = 'missing_legacy_outcome';
export const LATAM_EXPLORATION_LIMIT = 16;
export const LATAM_OUTCOME_TARGET = 12;
const PER_SOURCE_OUTCOME_CAP = 8;
const PER_SOURCE_OTHER_CAP = 3;

const rank = (date, entry) => createHash('sha256')
  .update(`${date}|${entry.id}|${entry.sourceId}|${entry.reason}`)
  .digest('hex');

const isOutcome = (entry) => entry.reason === OUTCOME_REASON;

// Called only after validity, source, date and language checks. Reservoir-like
// top-k by seeded hash avoids selecting just the earliest items in each feed.
// At most 11 items are held per publisher, regardless of its feed size.
export function retainLatamDiagnostic(pool, entry, date) {
  const capacity = isOutcome(entry) ? PER_SOURCE_OUTCOME_CAP : PER_SOURCE_OTHER_CAP;
  const cohort = pool.filter((item) => isOutcome(item) === isOutcome(entry));
  if (cohort.some((item) => item.id === entry.id)) return;
  if (cohort.length < capacity) {
    pool.push(entry);
    return;
  }
  const worst = cohort.reduce((current, item) =>
    rank(date, item) > rank(date, current) ? item : current,
  );
  if (rank(date, entry) < rank(date, worst)) {
    pool.splice(pool.indexOf(worst), 1, entry);
  }
}

// Select distinct articles while preferring new publishers and new categories.
// ML's synthetic bootstrap is used ONLY as a diversity dimension, never as a
// ground-truth label or calibrated confidence estimate.
function takeDiverse(pool, quota, chosen, date, categoryCounts, sourceCounts) {
  const chosenIds = new Set(chosen.map(({ id }) => id));
  let picked = 0;
  while (picked < quota) {
    const available = pool.filter((item) => !chosenIds.has(item.id) &&
      (sourceCounts.get(item.sourceId) || 0) < 2);
    if (!available.length) break;
    available.sort((a, b) =>
      (sourceCounts.get(a.sourceId) || 0) - (sourceCounts.get(b.sourceId) || 0) ||
      (categoryCounts.get(a.category) || 0) - (categoryCounts.get(b.category) || 0) ||
      rank(date, a).localeCompare(rank(date, b)));
    const entry = available[0];
    chosen.push(entry);
    chosenIds.add(entry.id);
    sourceCounts.set(entry.sourceId, (sourceCounts.get(entry.sourceId) || 0) + 1);
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);
    picked++;
  }
  return picked;
}

export function selectLatamDiagnosticExploration(sourceDiagnostics, date) {
  const pool = sourceDiagnostics.flatMap((source) => source.exploration || []);
  const outcome = pool.filter(isOutcome);
  const others = pool.filter((item) => !isOutcome(item));
  const chosen = [];
  const categoryCounts = new Map();
  const sourceCounts = new Map();
  const take = (entries, count) => takeDiverse(entries, count, chosen, date, categoryCounts, sourceCounts);

  // Half the outcome sample examines disagreement (ML constructive, Rules no),
  // half provides a control sample, including the ML's negative predictions.
  take(outcome.filter((item) => item.mlLabel === 'constructive'), 6);
  take(outcome.filter((item) => item.mlLabel !== 'constructive'), 6);
  take(outcome, LATAM_OUTCOME_TARGET - chosen.length);
  const outcomeCount = chosen.length;
  take(others, LATAM_EXPLORATION_LIMIT - LATAM_OUTCOME_TARGET);
  take(outcome, LATAM_EXPLORATION_LIMIT - chosen.length);
  take(others, LATAM_EXPLORATION_LIMIT - chosen.length);

  return {
    selected: chosen,
    diagnostics: {
      method: 'latam_diversified_rejection_sample_v1',
      limit: LATAM_EXPLORATION_LIMIT,
      outcomeTarget: LATAM_OUTCOME_TARGET,
      selectedOutcome: chosen.filter(isOutcome).length,
      selectedOther: chosen.filter((item) => !isOutcome(item)).length,
      sampledPublisherCount: new Set(chosen.map((item) => item.sourceId)).size,
      sampledCategoryCount: new Set(chosen.map((item) => item.category)).size,
      retainedOutcomePool: outcome.length,
      retainedOtherPool: others.length,
      firstPassOutcome: outcomeCount,
      // Diagnostics only; do not describe this as a statistically random sample.
    },
  };
}
