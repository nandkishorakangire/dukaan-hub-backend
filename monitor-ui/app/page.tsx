'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const API = `${API_BASE}/api/v1`;
const REFRESH_INTERVAL_MS = 5000;

interface RecentRequest {
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  at: string;
}

interface Analytics {
  total: number;
  active: number;
  failures: number;
  uptime_seconds: number;
  average_latency_ms: number;
  by_status: Record<string, number>;
  by_method: Record<string, number>;
  recent: RecentRequest[];
}

interface SystemInfo {
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
}

interface StatusResponse {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptime: number;
  timestamp: string;
  version: string;
  system: SystemInfo;
  analytics: Analytics;
}

interface HealthResponse {
  status: string;
  database: string;
}

type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

/* ------------------------------- formatting ------------------------------ */

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** i;
  return `${scaled >= 100 || i === 0 ? Math.round(scaled) : scaled.toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value ?? 0);
}

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour12: false });
  } catch {
    return '—';
  }
}

/* --------------------------------- icons --------------------------------- */

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'activity':
      return <svg {...common}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>;
    case 'database':
      return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'requests':
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h10" /><path d="m17 15 3 3-3 3" /></svg>;
    case 'pulse':
      return <svg {...common}><path d="M3 12h3l2-5 3 10 3-7 2 2h5" /></svg>;
    case 'alert':
      return <svg {...common}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>;
    case 'refresh':
      return <svg {...common}><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>;
    case 'memory':
      return <svg {...common}><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 7V4M12 7V4M17 7V4M7 20v-3M12 20v-3M17 20v-3" /></svg>;
    case 'server':
      return <svg {...common}><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01" /></svg>;
    case 'node':
      return <svg {...common}><path d="M12 3 3 8v8l9 5 9-5V8l-9-5Z" /><path d="M9 15V10l6 5v-5" /></svg>;
    case 'external':
      return <svg {...common}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

/* -------------------------------- components ------------------------------ */

function StatCard({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  icon: string;
}) {
  return (
    <article className={`card stat-card tone-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon"><Icon name={icon} /></span>
      </div>
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </article>
  );
}

function Meter({ label, value, max, display, color }: { label: string; value: number; max: number; display: string; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <strong>{display}</strong>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card panel">
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/* ---------------------------------- page ---------------------------------- */

export default function MonitorPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [metrics, setMetrics] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [metricFilter, setMetricFilter] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [statusRes, healthRes, metricsRes] = await Promise.all([
        fetch(`${API}/monitor/status`, { cache: 'no-store' }),
        fetch(`${API}/monitor/health`, { cache: 'no-store' }),
        fetch(`${API}/metrics`, { cache: 'no-store' }),
      ]);

      if (!statusRes.ok) throw new Error(`Status endpoint returned ${statusRes.status}`);

      setStatus((await statusRes.json()) as StatusResponse);
      if (healthRes.ok) setHealth((await healthRes.json()) as HealthResponse);
      if (metricsRes.ok) setMetrics(await metricsRes.text());
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach the API');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const overallTone: Tone = !status ? 'neutral' : status.status === 'ok' && status.database === 'up' ? 'good' : 'bad';
  const analytics = status?.analytics;

  const heapPct = status && status.system.memory.heapTotal > 0
    ? Math.round((status.system.memory.heapUsed / status.system.memory.heapTotal) * 100)
    : 0;

  const statusBuckets = useMemo(() => {
    const source = analytics?.by_status ?? {};
    return [
      { key: '2xx', label: '2xx Success', count: source['2xx'] ?? 0, color: '#34d399' },
      { key: '3xx', label: '3xx Redirect', count: source['3xx'] ?? 0, color: '#38bdf8' },
      { key: '4xx', label: '4xx Client', count: source['4xx'] ?? 0, color: '#fbbf24' },
      { key: '5xx', label: '5xx Server', count: source['5xx'] ?? 0, color: '#fb7185' },
    ];
  }, [analytics?.by_status]);

  const maxStatusCount = Math.max(1, ...statusBuckets.map((b) => b.count));

  const methodEntries = useMemo(
    () => Object.entries(analytics?.by_method ?? {}).sort((a, b) => b[1] - a[1]),
    [analytics?.by_method],
  );

  const filteredMetrics = useMemo(() => {
    if (!metricFilter.trim()) return metrics;
    const needle = metricFilter.trim().toLowerCase();
    return metrics
      .split('\n')
      .filter((line) => line.toLowerCase().includes(needle))
      .join('\n');
  }, [metrics, metricFilter]);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon name="activity" size={22} /></span>
          <div>
            <h1>DukaanHub <span>Monitor</span></h1>
            <p>Server status, analytics &amp; infrastructure metrics</p>
          </div>
        </div>

        <div className="topbar-right">
          <span className={`live-pill tone-${overallTone}`}>
            <span className="live-dot" />
            {!status ? 'Connecting' : status.status === 'ok' ? 'All systems live' : 'Degraded'}
          </span>
          <div className="updated">
            <span>{lastUpdated ? `Updated ${formatClock(lastUpdated.toISOString())}` : 'Waiting for data…'}</span>
            <button type="button" onClick={() => void load()} disabled={refreshing} className="refresh-btn" aria-label="Refresh now">
              <Icon name="refresh" size={16} />
              <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="banner banner-error">
          <Icon name="alert" size={18} />
          <span><strong>Connection issue:</strong> {error}. Retrying automatically every {REFRESH_INTERVAL_MS / 1000}s.</span>
        </div>
      ) : null}

      {status && status.status !== 'ok' ? (
        <div className="banner banner-warn">
          <Icon name="alert" size={18} />
          <span>Service is reporting a degraded state. Check the database and recent 5xx responses below.</span>
        </div>
      ) : null}

      {/* Headline metrics */}
      <section className="stat-grid" aria-label="Key metrics">
        <StatCard
          label="Server status"
          value={status ? (status.status === 'ok' ? 'Healthy' : 'Degraded') : '—'}
          sub={status ? `API v${status.version}` : 'Connecting…'}
          tone={overallTone}
          icon="activity"
        />
        <StatCard
          label="Database"
          value={status ? (status.database === 'up' ? 'Connected' : 'Offline') : '—'}
          sub={health ? `Health probe: ${health.status}` : 'Checking connection'}
          tone={status?.database === 'up' ? 'good' : status ? 'bad' : 'neutral'}
          icon="database"
        />
        <StatCard
          label="Process uptime"
          value={status ? formatUptime(status.uptime) : '—'}
          sub={status ? `Since ${formatClock(status.timestamp)}` : undefined}
          tone="info"
          icon="clock"
        />
        <StatCard
          label="Total requests"
          value={status ? formatNumber(analytics?.total ?? 0) : '—'}
          sub={analytics ? `${formatNumber(analytics.uptime_seconds)}s tracked` : undefined}
          tone="info"
          icon="requests"
        />
        <StatCard
          label="In flight now"
          value={analytics ? formatNumber(analytics.active) : '—'}
          sub="Active requests"
          tone="info"
          icon="pulse"
        />
        <StatCard
          label="System failures"
          value={analytics ? formatNumber(analytics.failures) : '—'}
          sub={analytics ? `Avg latency ${analytics.average_latency_ms} ms` : undefined}
          tone={analytics && analytics.failures > 0 ? 'bad' : 'good'}
          icon="alert"
        />
      </section>

      <div className="split">
        {/* Resource usage */}
        <Panel title="Resource usage" subtitle="Live Node.js process memory" action={<span className="chip"><Icon name="memory" size={14} /> {status?.system.nodeVersion ?? '—'}</span>}>
          {status ? (
            <div className="panel-body">
              <Meter
                label="Heap in use"
                value={status.system.memory.heapUsed}
                max={status.system.memory.heapTotal}
                display={`${formatBytes(status.system.memory.heapUsed)} / ${formatBytes(status.system.memory.heapTotal)} · ${heapPct}%`}
                color="linear-gradient(90deg, #22d3ee, #6366f1)"
              />
              <div className="mini-grid">
                <div className="mini-stat"><span>Resident (RSS)</span><strong>{formatBytes(status.system.memory.rss)}</strong></div>
                <div className="mini-stat"><span>External</span><strong>{formatBytes(status.system.memory.external)}</strong></div>
                <div className="mini-stat"><span>Array buffers</span><strong>{formatBytes(status.system.memory.arrayBuffers)}</strong></div>
                <div className="mini-stat"><span>Heap total</span><strong>{formatBytes(status.system.memory.heapTotal)}</strong></div>
              </div>
            </div>
          ) : <div className="skeleton" />}
        </Panel>

        {/* System info */}
        <Panel title="Runtime" subtitle="Host and process details" action={<span className="chip"><Icon name="server" size={14} /> PID {status?.system.pid ?? '—'}</span>}>
          {status ? (
            <div className="panel-body kv-list">
              <div className="kv"><span>Node.js</span><strong>{status.system.nodeVersion}</strong></div>
              <div className="kv"><span>Platform</span><strong>{status.system.platform} · {status.system.arch}</strong></div>
              <div className="kv"><span>Process ID</span><strong>{status.system.pid}</strong></div>
              <div className="kv"><span>API version</span><strong>{status.version}</strong></div>
              <div className="kv"><span>Last sampled</span><strong>{formatClock(status.timestamp)}</strong></div>
            </div>
          ) : <div className="skeleton" />}
        </Panel>
      </div>

      <div className="split">
        {/* Traffic analytics */}
        <Panel title="Traffic analytics" subtitle={`${formatNumber(analytics?.total ?? 0)} requests recorded`}>
          <div className="panel-body">
            <div className="bar-list">
              {statusBuckets.map((bucket) => (
                <div className="bar-row" key={bucket.key}>
                  <span className="bar-label">{bucket.label}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(bucket.count / maxStatusCount) * 100}%`, background: bucket.color }} />
                  </div>
                  <strong className="bar-value">{formatNumber(bucket.count)}</strong>
                </div>
              ))}
            </div>

            <div className="divider" />

            <h3 className="sub-title">By HTTP method</h3>
            {methodEntries.length ? (
              <div className="chips">
                {methodEntries.map(([method, count]) => (
                  <span className="method-chip" key={method}>
                    <strong>{method}</strong> <span>{formatNumber(count)}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="empty">No application traffic recorded yet.</p>
            )}
          </div>
        </Panel>

        {/* Recent failures / requests */}
        <Panel title="Recent requests" subtitle="Latest 20 application calls (monitoring excluded)">
          <div className="panel-body table-wrap">
            {analytics?.recent?.length ? (
              <table className="req-table">
                <thead>
                  <tr><th>Time</th><th>Method</th><th>Path</th><th>Status</th><th>ms</th></tr>
                </thead>
                <tbody>
                  {analytics.recent.map((req, idx) => (
                    <tr key={`${req.at}-${idx}`}>
                      <td className="muted">{formatClock(req.at)}</td>
                      <td><span className={`method method-${req.method.toLowerCase()}`}>{req.method}</span></td>
                      <td className="path" title={req.path}>{req.path}</td>
                      <td><span className={`code code-${Math.floor(req.status / 100)}xx`}>{req.status}</span></td>
                      <td className="muted">{req.duration_ms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty">No requests recorded yet. Make a call to any API route to see it here.</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Prometheus metrics */}
      <Panel
        title="Prometheus metrics"
        subtitle="Raw /metrics output — scrape-ready for Grafana"
        action={
          <button type="button" className="ghost-btn" onClick={() => setShowMetrics((v) => !v)}>
            {showMetrics ? 'Hide' : 'Show'} metrics
          </button>
        }
      >
        {showMetrics ? (
          <div className="panel-body">
            <div className="metrics-toolbar">
              <input
                type="search"
                value={metricFilter}
                onChange={(event) => setMetricFilter(event.target.value)}
                placeholder="Filter metrics (e.g. http_requests, process_cpu)"
                aria-label="Filter metrics"
              />
              <span className="chip"><Icon name="external" size={14} /> /api/v1/metrics</span>
            </div>
            <pre className="metrics-output">{filteredMetrics || 'No metrics available.'}</pre>
          </div>
        ) : null}
      </Panel>

      <footer className="footer">
        <span>DukaanHub server monitor · auto-refresh every {REFRESH_INTERVAL_MS / 1000}s</span>
        <span>Endpoints: <code>/api/v1/monitor/status</code> · <code>/api/v1/monitor/health</code> · <code>/api/v1/metrics</code></span>
      </footer>
    </main>
  );
}
