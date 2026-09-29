import { useEffect, useState, type FormEvent } from 'react';
import type { NewsEdition } from '../types/news';
import '../styles/controlRoom.scss';

type Decision = {
  id: string; title: string; deck?: string; source: string; category: string; lane?: string; reason?: string;
  ruleScore: number | null; mlLabel: string; mlScore: number | null;
  llm: { eligible: boolean | null; reason: string } | null; published: boolean;
};
type ReviewLabel = 'constructive' | 'not_constructive' | 'uncertain';
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

export function ControlRoom() {
  const [password, setPassword] = useState('');
  const [authorization, setAuthorization] = useState(''); // memory only, not storage
  const [edition, setEdition] = useState<NewsEdition>('english');
  const [date, setDate] = useState(utcToday);
  const [data, setData] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const review = async (id: string, label: ReviewLabel) => {
    if (!authorization || saving) return;
    setSaving(id);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin-feedback', {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, edition, id, label }),
      });
      if (!response.ok) throw new Error(`Review not saved (${response.status}).`);
      setData((current) => current ? ({
        ...current,
        editions: {
          ...current.editions,
          [edition]: {
            ...current.editions[edition],
            reviews: { ...current.editions[edition].reviews, [id]: label },
          },
        },
      }) : current);
      setSuccess('Editorial label saved for the training export.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save review.');
    } finally {
      setSaving('');
    }
  };

  const current = data?.editions?.[edition];
  const stats = current?.telemetry;
  const rejections = Object.entries(stats?.input.rejections || {}).filter(([, count]) => count > 0);

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
              <button className={edition === 'english' ? 'active' : ''} onClick={() => setEdition('english')} type="button">ENGLISH</button>
              <button className={edition === 'latam' ? 'active' : ''} onClick={() => setEdition('latam')} type="button">LATAM</button>
            </div>
            <label>UTC DATE <input type="date" value={date} min={twoWeeksAgo()} max={utcToday()} onChange={(event) => setDate(event.target.value)} /></label>
            <button type="button" className="control-room__text-button" onClick={() => { setAuthorization(''); setData(null); }}>SIGN OUT</button>
          </nav>
          {busy && <p className="control-room__message" role="status">Loading private snapshot…</p>}
          {error && <p className="control-room__error" role="alert">{error}</p>}
          {success && <p className="control-room__success" role="status">{success}</p>}
          {data && <>
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
                <div className="control-room__kv"><span>Human-verified</span><strong>{displayCount(data.ml.humanSamples)}</strong></div>
                {data.ml.validation && <div className="control-room__kv"><span>Gold precision / FPR</span><strong>{(100 * data.ml.validation.precision).toFixed(1)}% / {(100 * data.ml.validation.falsePositiveRate).toFixed(1)}%</strong></div>}
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
              <p>Labels saved here are human-verified training candidates. An LLM decision or reader vote never becomes ground truth automatically.</p>
              {(stats?.decisions || []).map((item) => <article className="control-room__review" key={item.id}>
                <div className="control-room__review-content">
                  <span className="control-room__eyebrow">{item.lane === 'exploration' ? 'EXPLORATION · ' : 'SHORTLIST · '}{item.category} / {item.source}</span>
                  <h3>{item.title}</h3>
                  {item.deck && <p>{item.deck}</p>}
                  <div className="control-room__review-tags">
                    <span>RULE: {item.ruleScore ?? 'NOT ELIGIBLE'}</span>
                    <span>ML: {item.mlLabel} {item.mlScore === null ? '' : `(${(item.mlScore * 100).toFixed(0)}% raw score)`}</span>
                    <span>LLM: {statusCopy(item)}</span>
                    <span>{item.published ? 'PUBLISHED' : 'NOT PUBLISHED'}</span>
                  </div>
                  {item.llm?.reason && <p className="control-room__reason">Audit: {item.llm.reason}</p>}
                </div>
                <div className="control-room__review-actions" role="group" aria-label={`Editorial review for ${item.title}`}>
                  <span>DOES THIS BELONG IN GUD?</span>
                  {([['constructive', '↑ YES'], ['not_constructive', '↓ NO'], ['uncertain', '? REVIEW']] as const).map(([label, title]) => (
                    <button key={label} type="button" disabled={!!saving}
                      className={current?.reviews?.[item.id] === label ? 'is-selected' : ''}
                      aria-pressed={current?.reviews?.[item.id] === label}
                      onClick={() => { void review(item.id, label); }}>{saving === item.id ? '…' : title}</button>
                  ))}
                </div>
              </article>)}
              {!stats?.decisions?.length && <p>There are no articles in the review queue for this edition.</p>}
            </section>
          </>}
        </>
      )}
      <footer className="control-room__footer">GUD ENGINE · CONTROL ROOM / INTERNAL ONLY</footer>
    </main>
  );
}
