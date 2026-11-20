import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Site, type User } from '../api';
import { ask } from '../lib/confirm';

interface Row { label: string; value: number }
interface Totals { visitors: number; pageviews: number; bounceRate: number | null; visitDuration: number | null }
interface Report {
  from: string; to: string; days: number;
  totals: Totals; previous: Totals | null;
  series: { date: string; visitors: number; pageviews: number }[];
  pages: Row[]; sources: Row[]; countries: Row[]; devices: Row[];
}
interface Link { configured: boolean; settings: { propertyId?: string }; hasKey: boolean; canManage: boolean }
interface Overview { siteId: string; name: string; domain: string | null; connected: boolean; totals?: Totals; previous?: Totals | null; series?: { date: string; visitors: number }[]; error?: string }

const RANGES = [7, 30, 90] as const;
const n0 = (n: number) => n.toLocaleString();
const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const longDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const clock = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;

/** "+12%" or "-4%", or nothing when there is no earlier period to compare with. */
function change(now: number, before?: number | null): { text: string; dir: 'up' | 'down' | 'flat' } | null {
  if (before == null) return null;
  if (before === 0) return now === 0 ? { text: 'No change', dir: 'flat' } : { text: 'New', dir: 'up' };
  const p = Math.round(((now - before) / before) * 100);
  return { text: `${p > 0 ? '+' : ''}${p}%`, dir: p > 0 ? 'up' : p < 0 ? 'down' : 'flat' };
}
const Delta = ({ c, days }: { c: ReturnType<typeof change>; days: number }) => c
  ? <span className={`an-delta${c.dir === 'flat' ? ' flat' : ''}`}>{c.dir !== 'flat' && <span aria-hidden>{c.dir === 'up' ? '▲' : '▼'} </span>}{c.text}<span className="muted"> vs the previous {days} days</span></span>
  : <span className="an-delta muted">No earlier period to compare with</span>;

/** A tick step that gives 3 to 5 round gridlines. */
function niceMax(v: number) {
  if (v <= 0) return 4;
  const raw = v / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return step * 4;
}

/** One line over time, with a crosshair and a tooltip. The line is the only series shown at a time. */
function Trend({ data, metric, label }: { data: { date: string; visitors: number; pageviews: number }[]; metric: 'visitors' | 'pageviews'; label: string }) {
  const W = 760, H = 250, L = 46, R = 14, T = 14, B = 30;
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<SVGSVGElement>(null);
  const vals = data.map((d) => d[metric]);
  const top = niceMax(Math.max(0, ...vals));
  const x = (i: number) => L + (data.length < 2 ? (W - L - R) / 2 : (i / (data.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = vals.length ? `${line} L${x(vals.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` : '';
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const labelAt = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter((v, i, a) => data.length && a.indexOf(v) === i);

  const move = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !data.length) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - L) / (W - L - R)) * (data.length - 1)))));
  };
  const h = hover == null ? null : data[hover];
  return (
    <div className="an-chart">
      <svg ref={box} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} per day, ${data[0] ? shortDate(data[0].date) : ''} to ${data.length ? shortDate(data[data.length - 1].date) : ''}`}
        onPointerMove={move} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="an-grid" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="an-tick">{n0(Math.round(t))}</text>
          </g>
        ))}
        {labelAt.map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="an-tick">{shortDate(data[i].date)}</text>)}
        {area && <path d={area} className="an-area" />}
        {line && <path d={line} className="an-line" />}
        {h && hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="an-cross" />
            <circle cx={x(hover)} cy={y(h[metric])} r="4.5" className="an-dot" />
          </g>
        )}
      </svg>
      {h && hover != null && (
        <div className="an-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{longDate(h.date)}</b>
          <span>{n0(h.visitors)} visitors</span>
          <span>{n0(h.pageviews)} page views</span>
        </div>
      )}
    </div>
  );
}

/** One bar per row, largest first, all in one colour; the figure is printed beside it. */
function Ranked({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="an-card">
      <h3>{title}</h3>
      {!rows.length ? <p className="muted">{empty}</p> : (
        <ol className="an-ranked">
          {rows.map((r) => (
            <li key={r.label}>
              <span className="an-name" title={r.label}>{r.label}</span>
              <span className="an-bar"><i style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></span>
              <span className="an-num">{n0(r.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Spark({ values }: { values: number[] }) {
  const W = 120, H = 32;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, values.length - 1)) * (W - 4) + 2).toFixed(1)} ${(H - 3 - (v / max) * (H - 8)).toFixed(1)}`).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} className="an-spark" aria-hidden><path d={pts} className="an-line thin" /></svg>;
}

const Seg = <T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; t: string }[]; onChange: (v: T) => void; label: string }) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map((o) => <button key={String(o.v)} className={value === o.v ? 'on' : ''} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.t}</button>)}
  </div>
);

// ------------------------------------------------------------------ connecting a website

function ConnectForm({ site, link, onSaved, onCancel }: { site: Site; link: Link | null; onSaved: () => void; onCancel?: () => void }) {
  const [propertyId, setPropertyId] = useState(link?.settings.propertyId ?? '');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const keeping = !!link?.hasKey;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api(`/sites/${site.id}/analytics`, { method: 'PUT', body: { settings: { propertyId }, secret: secret || undefined } });
      setSecret('');
      onSaved();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const readFile = async (f?: File) => { if (f) setSecret(await f.text()); };

  return (
    <form className="an-form" onSubmit={submit}>
      <details className="more an-steps">
        <summary>How to set this up (3 steps)</summary>
        <ol>
          <li>In <b>Google Cloud</b>, make a service account, turn on the <b>Google Analytics Data API</b> for the project, and make a key for the account. Google gives you a .json file.</li>
          <li>In <b>Google Analytics</b>, open Admin, then Property access management, and add the service account's email address as a <b>Viewer</b>.</li>
          <li>In Admin, then Property details, copy the <b>Property ID</b> (a number). Paste it below with the contents of the .json file.</li>
        </ol>
      </details>
      <label>GA4 property ID <input inputMode="numeric" value={propertyId} onChange={(e) => setPropertyId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="123456789" required /><small className="muted">A number, not the measurement ID that starts with G-.</small></label>
      <label>Service account file
        <textarea rows={4} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={keeping ? 'Saved. Leave empty to keep it.' : 'Paste the contents of the .json file'} required={!keeping} spellCheck={false} />
        <input type="file" accept=".json,application/json" onChange={(e) => readFile(e.target.files?.[0])} aria-label="Choose the service account .json file" />
      </label>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row-actions">
        <button className="primary" disabled={busy}>{busy ? 'Checking…' : link?.configured ? 'Save' : 'Connect'}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
      <p className="muted">The numbers are checked with Google before anything is saved. The file stays on the server and is never shown again.</p>
    </form>
  );
}

// ------------------------------------------------------------------ one website

function SiteView({ site, days, onChanged }: { site: Site; days: number; onChanged: () => void }) {
  const [link, setLink] = useState<Link | null | undefined>(undefined);
  const [report, setReport] = useState<Report | null>(null);
  const [metric, setMetric] = useState<'visitors' | 'pageviews'>('visitors');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const loadLink = () => api<Link>(`/sites/${site.id}/analytics`).then(setLink).catch((x) => { setErr((x as Error).message); setLink(null); });
  const loadReport = (fresh = false) => {
    setLoading(true); setErr('');
    api<Report>(`/sites/${site.id}/analytics/report?days=${days}${fresh ? '&fresh=1' : ''}`).then(setReport).catch((x) => { setErr((x as Error).message); setReport(null); }).finally(() => setLoading(false));
  };
  useEffect(() => { setLink(undefined); setReport(null); setEditing(false); loadLink(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [site.id]);
  useEffect(() => { if (link?.configured && !editing) loadReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [link?.configured, days, site.id]);

  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const down = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [menu]);

  if (link === undefined) return <p className="muted">Loading…</p>;
  if (!link?.configured || editing) {
    if (!link?.canManage) return <p className="an-empty">Analytics is not connected for {site.name} yet. Ask an admin to connect it.</p>;
    return (
      <section className="an-card an-connect">
        <h3>{link?.configured ? 'Change the connection' : `Connect analytics for ${site.domains[0] ?? site.name}`}</h3>
        {!link?.configured && <p className="muted">Show this website's visitors, page views and top pages here, read from Google Analytics.</p>}
        <ConnectForm site={site} link={link} onSaved={() => { setEditing(false); loadLink(); onChanged(); }} onCancel={editing ? () => setEditing(false) : undefined} />
      </section>
    );
  }

  const t = report?.totals; const pv = report?.previous;
  const tiles: { label: string; value: string; delta?: ReturnType<typeof change> }[] = t ? [
    { label: 'Visitors', value: n0(t.visitors), delta: change(t.visitors, pv?.visitors) },
    { label: 'Page views', value: n0(t.pageviews), delta: change(t.pageviews, pv?.pageviews) },
    ...(t.bounceRate != null ? [{ label: 'Bounce rate', value: `${Math.round(t.bounceRate)}%` }] : []),
    ...(t.visitDuration != null ? [{ label: 'Visit duration', value: clock(t.visitDuration) }] : []),
  ] : [];

  const empty = !!report && report.series.every((d) => d.visitors === 0 && d.pageviews === 0) && report.pages.length + report.sources.length + report.countries.length + report.devices.length === 0;

  return (
    <>
      <header className="an-dhead">
        <div className="an-dtitle">
          <h3>{site.domains[0] ?? site.name}</h3>
          <p className="muted">Google Analytics{link.settings.propertyId ? ` · property ${link.settings.propertyId}` : ''}{report ? ` · ${shortDate(report.from)} to ${shortDate(report.to)}` : ''}</p>
        </div>
        <span className="an-dactions">
          <button type="button" className="an-icon" aria-label="Refresh the numbers" data-tip="Refresh" disabled={loading} onClick={() => loadReport(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={loading ? 'an-spin' : undefined}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
          </button>
          {link.canManage && (
            <div className="an-menu" ref={menuRef}>
              <button type="button" className={`an-icon${menu ? ' on' : ''}`} aria-label="Analytics settings" aria-haspopup="menu" aria-expanded={menu} data-tip="Settings" onClick={() => setMenu((m) => !m)}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                </svg>
              </button>
              {menu && (
                <div className="an-menu-pop" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); setEditing(true); }}>Change connection</button>
                  <button type="button" role="menuitem" className="danger" onClick={async () => {
                    setMenu(false);
                    if (await ask({ title: 'Disconnect analytics?', message: `${site.name} stops showing visitor numbers here. Nothing changes in Google Analytics.`, confirmLabel: 'Disconnect' })) {
                      await api(`/sites/${site.id}/analytics`, { method: 'DELETE' }); setReport(null); loadLink(); onChanged();
                    }
                  }}>Disconnect</button>
                </div>
              )}
            </div>
          )}
        </span>
      </header>
      {err && <p className="err" role="alert">{err}</p>}
      {loading && !report && <p className="muted">Loading the numbers…</p>}
      {report && (
        <>
          <div className="an-stats">
            {tiles.map((x) => (
              <div key={x.label} className="an-stat">
                <span className="an-stat-label">{x.label}</span>
                <b>{x.value}</b>
                {x.delta !== undefined && <Delta c={x.delta} days={report.days} />}
              </div>
            ))}
          </div>

          {empty ? (
            <section className="an-card an-none">
              <h3>No visits recorded yet</h3>
              <p className="muted">Google has not received any visits for this website in the last {report.days} days. Numbers appear here once the website is live with the tracking code, and Google can take up to 48 hours to show the first ones.</p>
            </section>
          ) : (
            <>
              <section className="an-card">
                <div className="an-card-head">
                  <h3>{metric === 'visitors' ? 'Visitors' : 'Page views'} per day</h3>
                  <Seg label="Measure" value={metric} onChange={setMetric} options={[{ v: 'visitors', t: 'Visitors' }, { v: 'pageviews', t: 'Page views' }]} />
                </div>
                <Trend data={report.series} metric={metric} label={metric === 'visitors' ? 'Visitors' : 'Page views'} />
                <details className="more an-table">
                  <summary>Show as a table</summary>
                  <div className="dt-wrap">
                    <table className="data-table"><thead><tr><th>Day</th><th>Visitors</th><th>Page views</th></tr></thead>
                      <tbody>{[...report.series].reverse().map((d) => <tr key={d.date}><td>{longDate(d.date)}</td><td>{n0(d.visitors)}</td><td>{n0(d.pageviews)}</td></tr>)}</tbody></table>
                  </div>
                </details>
              </section>
              <div className="an-grid2">
                <Ranked title="Top pages" rows={report.pages} empty="No page views in this period." />
                <Ranked title="Where visitors come from" rows={report.sources} empty="No visits in this period." />
                <Ranked title="Countries" rows={report.countries} empty="No visits in this period." />
                <Ranked title="Devices" rows={report.devices} empty="No visits in this period." />
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------ every website, always in view

/** The four websites in a column: each with its visitors, the change and a small trend. The chosen one is shown in full beside it. */
function SiteList({ days, activeId, onPick, tick }: { days: number; activeId: string; onPick: (id: string) => void; tick: number }) {
  const [rows, setRows] = useState<Overview[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { setErr(''); api<Overview[]>(`/analytics/overview?days=${days}`).then(setRows).catch((x) => setErr((x as Error).message)); }, [days, tick]);
  const total = useMemo(() => (rows ?? []).reduce((n, r) => n + (r.totals?.visitors ?? 0), 0), [rows]);
  return (
    <aside className="an-list" aria-label="Websites">
      <div className="an-list-head"><b>Websites</b>{rows && <span className="muted">{n0(total)} visitors in all</span>}</div>
      {err && <p className="err" role="alert">{err}</p>}
      {!rows && !err && <p className="muted an-list-note">Loading…</p>}
      <ul>
        {(rows ?? []).map((r) => {
          const c = r.totals ? change(r.totals.visitors, r.previous?.visitors) : null;
          return (
            <li key={r.siteId}>
              <button type="button" className={r.siteId === activeId ? 'on' : ''} aria-current={r.siteId === activeId ? 'true' : undefined} onClick={() => onPick(r.siteId)}>
                {r.connected && r.totals ? (
                  <>
                    <span className="an-li-row"><span className="an-li-name">{r.domain ?? r.name}</span><b className="an-li-num">{n0(r.totals.visitors)}</b></span>
                    <span className="an-li-foot">
                      {r.totals.visitors === 0 && !(r.previous?.visitors) ? <span className="muted">No visits yet</span>
                        : c ? <span className={`an-delta${c.dir === 'flat' ? ' flat' : ''}`}>{c.dir !== 'flat' && <span aria-hidden>{c.dir === 'up' ? '▲' : '▼'} </span>}{c.text}</span> : <span className="muted">No earlier period</span>}
                      {(r.series ?? []).some((x) => x.visitors > 0) && <Spark values={(r.series ?? []).map((x) => x.visitors)} />}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="an-li-row"><span className="an-li-name">{r.domain ?? r.name}</span></span>
                    <span className="an-li-note muted">{r.connected ? (r.error ?? 'Could not load the numbers.') : 'Not connected yet'}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/** Visitor numbers from Google Analytics. The websites are listed down the left, always; the one picked is shown in full on the right. */
export function Analytics({ site, user: _user, onSelect }: { site: Site; user: User; onSelect: (id: string) => void }) {
  const [days, setDays] = useState<number>(() => { try { const v = Number(localStorage.getItem('cms_analytics_days')); return [7, 30, 90].includes(v) ? v : 30; } catch { return 30; } });
  const [tick, setTick] = useState(0); // bumped when a connection changes, so the list refreshes
  useEffect(() => { try { localStorage.setItem('cms_analytics_days', String(days)); } catch { /* ignore */ } }, [days]);
  return (
    <div className="analytics">
      <header className="an-head">
        <h2>Analytics</h2>
        <Seg label="Time range" value={days} onChange={setDays} options={RANGES.map((d) => ({ v: d, t: `${d} days` }))} />
      </header>
      <div className="an-layout">
        <SiteList days={days} activeId={site.id} onPick={onSelect} tick={tick} />
        <div className="an-detail">
          <SiteView key={site.id} site={site} days={days} onChanged={() => setTick((t) => t + 1)} />
        </div>
      </div>
    </div>
  );
}
