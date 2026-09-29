import { useEffect, useState, type FormEvent } from 'react';
import type { NewsEdition } from '../types/news';
import '../styles/controlRoom.scss';

type Decision = {
  id: string; title: string; deck?: string; source: string; category: string; lane?: string; reason?: string;
  url?: string;
  ruleScore: number | null; mlLabel: string; mlScore: number | null;
  llm: { eligible: boolean | null; reason: string } | null; published: boolean;
};
type ReviewLabel = 'constructive' | 'not_constructive' | 'irrelevant';
type DraftLabel = ReviewLabel | 'clear';
type ReviewDrafts = Record<string, Record<string, DraftLabel>>;
const DRAFT_STORAGE_KEY = 'gud:editorial-drafts:v2';
const isReviewLabel = (value: unknown): value is ReviewLabel =>
  value === 'constructive' || value === 'not_constructive' || value === 'irrelevant';

const readDrafts = (): ReviewDrafts => {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const drafts: ReviewDrafts = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!/^\d{4}-\d{2}-\d{2}:(english|latam)$/.test(key) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
      const entries = Object.entries(value).filter(([id, label]) => /^[a-f0-9]{40}$/.test(id) && (isReviewLabel(label) || label === 'clear'));
      if (entries.length) drafts[key] = Object.fromEntries(entries) as Record<string, DraftLabel>;
    }
    return drafts;
  } catch { return {}; }
};
type Telemetry = {
  input: {
    sources: number; successfulSources: number; totalFeedItems: number;
    localQualified: number; shortlist: number; published: number;
    rejections: Record<string, number>;
  };
  ml: { version: string; available: boolean; samples?: number; trainingSamples: number;
    mode: string; scored: number; constructive: number; notConstructive: number };
  llm: {
    enabled: boolean; model: string | null; attempted: number; accepted: number;
    rejected: number; unknown: number; calls: number; inputTokens: number;
    outputTokens: number; totalTokens: number; estimatedUSD: number | null; errors: string[];
  };
  decisions: Decision[];
};
type EditionState = {
  status: string; count: number; generatedAt: string | null;
  candidateCount: number | null; sourcePool: number | null;
  telemetry: Telemetry | null; reviews: Record<string, ReviewLabel>;
  articles?: { id: string; url?: string }[];
};
type AdminData = {
  date: string; version: string; editionLimit: number; editionMinTarget: number;
  ml: { version: string; trainingSamples: number; humanSamples?: number;
    validation?: { precision: number; recall: number; falsePositiveRate: number; goldSamples: number } | null;
    mode: string; available: boolean };
  editions: Record<NewsEdition, EditionState>;
};
const utcToday = () => new Date().toISOString().slice(0, 10);
const twoWeeksAgo = () => new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
const displayCount = (value?: number | null) => value === null || value === undefined ? '—' : value.toLocaleString('en-US');
const statusCopy = (decision: Decision) =>
  !decision.llm ? 'OFF' : decision.llm.eligible === true ? 'PASS' :
    decision.llm.eligible === false ? 'REJECT' : 'UNRESOLVED';

const safeArticleUrl = (value?: string): string | null => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
};

const editorialSourceLink = (
  decision: Decision,
  publishedArticles: EditionState['articles'],
) => {
  const publishedUrl = publishedArticles?.find((article) => article.id === decision.id)?.url;
  const original = safeArticleUrl(decision.url) ?? safeArticleUrl(publishedUrl);
  return original ? { href: original, label: 'READ ORIGINAL ↗' } : {
    // Old Exploration snapshots did not persist their source URL. Provide a
    // clearly labelled search fallback, without a new backend/API request.
    href: `https://www.google.com/search?q=${encodeURIComponent(`"${decision.title}" "${decision.source}"`)}`,
    label: 'FIND SOURCE ↗',
  };
};

export function ControlRoom() {
  const [password, setPassword] = useState('');
  const [authorization, setAuthorization] = useState(''); // memory only, not storage
  const [edition, setEdition] = useState<NewsEdition>('english');
  const [date, setDate] = useState(utcToday);
  const [data, setData] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<ReviewDrafts>(readDrafts);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Only labels (article IDs, not article text or admin credentials) are cached.
  // A draft survives a refresh within the current browser tab and is never
  // sent to Blob until SAVE EDITORIAL REVIEW is pressed.
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts)); } catch { /* browser storage disabled */ }
  }, [drafts]);

  useEffect(() => {
    if (!Object.values(drafts).some((batch) => Object.keys(batch).length > 0)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [drafts]);

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) return;
    // ASCII password recommended; encode as UTF-8 for non-ASCII input too.
    const bytes = new TextEncoder().encode(`admin:${password}`);
    const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
    setAuthorization(`Basic ${encoded}`);
    setPassword('');
    setError('');
  };

  useEffect(() => {
    if (!authorization) return;
    const controller = new AbortController();
    const load = async () => {
      setBusy(true);
      setError('');
      setSuccess('');
      try {
        const response = await fetch(`/api/admin?date=${encodeURIComponent(date)}`, {
          signal: controller.signal,
          headers: { Authorization: authorization },
          cache: 'no-store',
        });
        if (!response.ok) {
          if (response.status === 401) {
            setAuthorization('');
            throw new Error('Incorrect access key.');
          }
          throw new Error(`Dashboard unavailable (${response.status}). Check Blob and server configuration.`);
        }
        const payload = await response.json() as AdminData;
        setData(payload);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load dashboard.');
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [authorization, date]);

  const current = data?.date === date ? data?.editions?.[edition] : undefined;
  const stats = current?.telemetry;
  const rejections = Object.entries(stats?.input.rejections || {}).filter(([, count]) => count > 0);
  const draftKey = `${date}:${edition}`;
  const activeDraft = drafts[draftKey] || {};
  const pendingCount = Object.keys(activeDraft).length;

  const selectedLabel = (id: string): ReviewLabel | undefined => {
    if (Object.prototype.hasOwnProperty.call(activeDraft, id)) {
      const label = activeDraft[id];
      return label === 'clear' ? undefined : label;
    }
    const saved = current?.reviews?.[id];
    return isReviewLabel(saved) ? saved : undefined;
  };
  const reviewedCount = (stats?.decisions || []).filter((entry) => !!selectedLabel(entry.id)).length;

  const chooseReview = (id: string, label: ReviewLabel) => {
    if (saving || busy) return;
    const savedValue = current?.reviews?.[id];
    const saved = isReviewLabel(savedValue) ? savedValue : undefined;
    setDrafts((previous) => {
      const changes = { ...(previous[draftKey] || {}) };
      const value = Object.prototype.hasOwnProperty.call(changes, id) ? changes[id] : saved;
      const selected = value === 'clear' ? undefined : value;
      const next = selected === label ? undefined : label;
      if (next === saved) delete changes[id];
      else changes[id] = next || 'clear';
      const updated = { ...previous };
      if (Object.keys(changes).length) updated[draftKey] = changes;
      else delete updated[draftKey];
      return updated;
    });
    setSuccess('');
    setError('');
  };

  const saveReview = async () => {
    if (!authorization || saving || busy || !pendingCount) return;
    const changes = Object.entries(activeDraft).map(([id, label]) => ({ id, label }));
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin-feedback', {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, edition, reviews: changes }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(detail?.error || `Review not saved (${response.status}).`);
      }
      const result = await response.json() as { saved: number };
      if (result.saved !== changes.length) throw new Error('Unexpected save confirmation. Please reload to verify.');
      setData((previous) => {
        if (!previous || previous.date !== date) return previous;
        const entry = previous.editions[edition];
        const reviews = { ...entry.reviews };
        for (const change of changes) {
          if (change.label === 'clear') delete reviews[change.id];
          else reviews[change.id] = change.label;
        }
        return {
          ...previous,
          editions: { ...previous.editions, [edition]: { ...entry, reviews } },
        };
      });
      setDrafts((previous) => {
        const updated = { ...previous };
        delete updated[draftKey];
        return updated;
      });
      setSuccess(`${result.saved} editorial change${result.saved === 1 ? '' : 's'} saved. Your review is now finalised for training export.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save review. Your draft has been preserved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="control-room">
      <header className="control-room__header">
        <div><span className="control-room__eyebrow">PRIVATE / OPERATIONS</span><h1>GUD<span> / </span>Control Room</h1></div>
        <a href="/" aria-label="Back to the newspaper">↗ NEWSPAPER</a>
      </header>
      {!authorization ? (
        <section className="control-room__login">
          <span className="control-room__eyebrow">AUTHENTICATION REQUIRED</span>
          <h2>Internal dashboard.</h2>
          <p>Operational data and editorial reviews are private. The access key stays in this page's memory and is not saved in localStorage.</p>
          <form onSubmit={login}>
            <label htmlFor="control-password">Admin access key</label>
            <input id="control-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" required />
            <button type="submit">ENTER →</button>
          </form>
          {error && <p role="alert" className="control-room__error">{error}</p>}
        </section>
      ) : (
        <>
          <nav className="control-room__toolbar" aria-label="Control room filters">
            <div className="control-room__toggle">
              <button className={edition === 'english' ? 'active' : ''} onClick={() => { setEdition('english'); setSuccess(''); setError(''); }} disabled={saving} type="button">ENGLISH</button>
              <button className={edition === 'latam' ? 'active' : ''} onClick={() => { setEdition('latam'); setSuccess(''); setError(''); }} disabled={saving} type="button">LATAM</button>
            </div>
            <label>UTC DATE <input type="date" value={date} min={twoWeeksAgo()} max={utcToday()} onChange={(event) => { setDate(event.target.value); setSuccess(''); setError(''); }} disabled={saving} /></label>
            <button type="button" className="control-room__text-button" disabled={saving} onClick={() => { setAuthorization(''); setData(null); }}>SIGN OUT</button>
          </nav>
          {busy && <p className="control-room__message" role="status">Loading private snapshot…</p>}
          {error && <p className="control-room__error" role="alert">{error}</p>}
          {success && <p className="control-room__success" role="status">{success}</p>}
          {data && data.date === date && <>
            <section className="control-room__intro">
              <span className="control-room__eyebrow">RULESET {data.version} · {edition.toUpperCase()}</span>
              <h2>{current?.status === 'ready' ? 'Edition generated.' : 'Not generated yet.'}</h2>
              <p>Edition target {data.editionMinTarget}–{data.editionLimit}. Quality is never padded to reach the minimum. Times shown in UTC.</p>
              <p className="control-room__eyebrow">{current?.generatedAt ? `GENERATED ${new Date(current.generatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC` : 'NO SNAPSHOT'}</p>
            </section>
            <section className="control-room__metrics" aria-label="Ingestion metrics">
              {[
                ['FEED ITEMS', stats?.input.totalFeedItems],
                ['RULE-ELIGIBLE', stats?.input.localQualified],
                ['SHORTLIST', stats?.input.shortlist],
                ['PUBLISHED', current?.count],
                ['SOURCES OK', stats?.input.successfulSources],
                ['REJECTIONS', Object.values(stats?.input.rejections || {}).reduce((total, n) => total + n, 0)],
              ].map(([name, value]) => <div key={String(name)}><span>{name}</span><strong>{displayCount(value as number | undefined)}</strong></div>)}
            </section>
            <div className="control-room__columns">
              <section className="control-room__panel">
                <div className="control-room__panel-heading"><h3>01 / RULE ENGINE</h3><span>LOCAL · NO TOKENS</span></div>
                <p>Deterministic rejection counts. Not an accuracy measurement.</p>
                {rejections.length ? rejections.map(([reason, count]) => (
                  <div className="control-room__kv" key={reason}><span>{reason}</span><strong>{displayCount(count)}</strong></div>
                )) : <p>No rejection telemetry for this date.</p>}
              </section>
              <section className="control-room__panel">
                <div className="control-room__panel-heading"><h3>02 / MACHINE LEARNING</h3><span>{data.ml.mode.toUpperCase()}</span></div>
                <p>Bootstrap predictions are advisory, not independently validated precision.</p>
                <div className="control-room__kv"><span>Model version</span><strong>{data.ml.version}</strong></div>
                <div className="control-room__kv"><span>Training samples</span><strong>{displayCount(data.ml.trainingSamples)}</strong></div>
                <div className="control-room__kv"><span>Human samples in deployed ML</span><strong>{displayCount(data.ml.humanSamples)}</strong></div>
                {data.ml.validation && <div className="control-room__kv"><span>Gold precision / FPR</span><strong>{(100 * data.ml.validation.precision).toFixed(1)}% / {(100 * data.ml.validation.falsePositiveRate).toFixed(1)}%</strong></div>}
                <div className="control-room__kv"><span>Saved reviews in this edition</span><strong>{Object.values(current?.reviews || {}).filter(isReviewLabel).length}</strong></div>
                <div className="control-room__kv"><span>Scored articles</span><strong>{displayCount(stats?.ml.scored)}</strong></div>
                <div className="control-room__kv"><span>Predicted constructive</span><strong>{displayCount(stats?.ml.constructive)}</strong></div>
                <div className="control-room__kv"><span>Predicted not constructive</span><strong>{displayCount(stats?.ml.notConstructive)}</strong></div>
              </section>
              <section className="control-room__panel">
                <div className="control-room__panel-heading"><h3>03 / LLM AUDITOR</h3><span>{stats?.llm.enabled ? 'ACTIVE · PAID' : 'DISABLED'}</span></div>
                <p>Only the post-ML shortlist can reach this stage. No per-reader calls.</p>
                <div className="control-room__kv"><span>Audited / requests</span><strong>{displayCount(stats?.llm.attempted)} / {displayCount(stats?.llm.calls)}</strong></div>
                <div className="control-room__kv"><span>Accepted / rejected</span><strong>{displayCount(stats?.llm.accepted)} / {displayCount(stats?.llm.rejected)}</strong></div>
                <div className="control-room__kv"><span>Input tokens</span><strong>{displayCount(stats?.llm.inputTokens)}</strong></div>
                <div className="control-room__kv"><span>Output tokens</span><strong>{displayCount(stats?.llm.outputTokens)}</strong></div>
                <div className="control-room__kv"><span>Estimated USD</span><strong>{stats?.llm.estimatedUSD == null ? 'Not configured' : `$${stats.llm.estimatedUSD.toFixed(6)}`}</strong></div>
                {!!stats?.llm.errors?.length && <p className="control-room__error">{stats.llm.errors.join(' · ')}</p>}
              </section>
            </div>
            <section className="control-room__reviews" aria-labelledby="review-heading">
              <div className="control-room__reviews-heading"><div><span className="control-room__eyebrow">EDITORIAL AUDIT LOG</span><h2 id="review-heading">Review the decisions.</h2></div><span>{stats?.decisions?.length ?? 0} ARTICLES</span></div>
              <p>Read the full source first. Your choices remain a local draft until you press SAVE EDITORIAL REVIEW. IRRELEVANT is positive news with low editorial priority, not a false positive.</p>
              {(stats?.decisions || []).map((item) => {
                const sourceLink = editorialSourceLink(item, current?.articles);
                return <article className="control-room__review" key={item.id}>
                <div className="control-room__review-content">
                  <span className="control-room__eyebrow">{item.lane === 'exploration' ? 'EXPLORATION · ' : 'SHORTLIST · '}{item.category} / {item.source}</span>
                  <h3>{item.title}</h3>
                  {item.deck && <p>{item.deck}</p>}
                  <a className="control-room__source-link" href={sourceLink.href} target="_blank" rel="noopener noreferrer" aria-label={`${sourceLink.label.replace(' ↗', '')}: ${item.title}`}>
                    {sourceLink.label}
                  </a>
                  <div className="control-room__review-tags">
                    <span>RULE: {item.ruleScore ?? 'NOT ELIGIBLE'}</span>
                    <span>ML: {item.mlLabel} {item.mlScore === null ? '' : `(${(item.mlScore * 100).toFixed(0)}% raw score)`}</span>
                    <span>LLM: {statusCopy(item)}</span>
                    <span>{item.published ? 'PUBLISHED' : 'NOT PUBLISHED'}</span>
                  </div>
                  {item.llm?.reason && <p className="control-room__reason">Audit: {item.llm.reason}</p>}
                </div>
                <div className="control-room__review-actions" role="group" aria-label={`Editorial review for ${item.title}`}>
                  <span>EDITORIAL DECISION · CLICK AGAIN TO CLEAR</span>
                  {([['constructive', 'YES'], ['not_constructive', 'NO'], ['irrelevant', 'IRRELEVANT']] as const).map(([label, title]) => (
                    <button key={label} type="button" disabled={saving || busy}
                      className={selectedLabel(item.id) === label ? 'is-selected' : ''}
                      aria-pressed={selectedLabel(item.id) === label}
                      onClick={() => chooseReview(item.id, label)}>{title}</button>
                  ))}
                  <small className="control-room__review-state">{Object.prototype.hasOwnProperty.call(activeDraft, item.id) ? 'UNSAVED CHANGE' : selectedLabel(item.id) ? 'SAVED' : 'UNREVIEWED'}</small>
                </div>
              </article>;
              })}
              {!stats?.decisions?.length && <p>There are no articles in the review queue for this edition.</p>}
              {!!stats?.decisions?.length && (
                <div className="control-room__save-bar" role="region" aria-label="Save editorial review">
                  <div className="control-room__save-info">
                    <strong>{reviewedCount} / {stats.decisions.length} REVIEWED</strong>
                    <span>{pendingCount ? `${pendingCount} UNSAVED CHANGE${pendingCount === 1 ? '' : 'S'}` : 'ALL CHANGES SAVED'}</span>
                    <div className="control-room__progress" aria-hidden="true"><span style={{ width: `${100 * reviewedCount / stats.decisions.length}%` }} /></div>
                    <small>Unselected articles are not treated as negative. Draft choices survive a refresh in this tab.</small>
                  </div>
                  <button type="button" className="control-room__save-button" disabled={!pendingCount || saving || busy} onClick={() => { void saveReview(); }}>
                    {saving ? 'SAVING…' : `SAVE EDITORIAL REVIEW${pendingCount ? ` (${pendingCount})` : ''}`}
                  </button>
                </div>
              )}
            </section>
          </>}
        </>
      )}
      <footer className="control-room__footer">GUD ENGINE · CONTROL ROOM / INTERNAL ONLY</footer>
    </main>
  );
}
