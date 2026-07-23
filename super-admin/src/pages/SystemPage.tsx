import { useQuery } from '@tanstack/react-query';
import { systemApi, type SystemHealth } from '../api';
import { Alert } from '../components/ui';
import { RefreshCw, Database, Server, Cpu, Clock, CheckCircle2, AlertTriangle, XCircle, Activity, Zap } from 'lucide-react';

function StatusDot({ status }: { status: string }) {
  const color = status === 'ok' ? 'var(--success)' : status === 'degraded' || status === 'warning' ? 'var(--warning)' : 'var(--danger)';
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6, flexShrink: 0 }} />;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'ok') return <CheckCircle2 size={18} color="var(--success)" />;
  if (status === 'degraded' || status === 'warning') return <AlertTriangle size={18} color="var(--warning)" />;
  return <XCircle size={18} color="var(--danger)" />;
}

function HealthCard({ title, icon, status, children }: { title: string; icon: React.ReactNode; status?: string; children: React.ReactNode }) {
  return (
    <div className="sa-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
          {icon} {title}
        </div>
        {status && <StatusIcon status={status} />}
      </div>
      {children}
    </div>
  );
}

function MetricRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function SystemPage() {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['sa-system'],
    queryFn: systemApi.health,
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const health: SystemHealth | undefined = data;

  const overallStatus = health?.status ?? 'ok';
  const statusBannerColor = overallStatus === 'ok' ? 'var(--success)' : overallStatus === 'degraded' ? 'var(--warning)' : 'var(--danger)';
  const statusLabel = overallStatus === 'ok' ? 'All Systems Operational' : overallStatus === 'degraded' ? 'System Degraded' : 'Critical Issues Detected';

  const memPct = health?.memory?.usage_pct ?? 0;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>System <span className="sa-gradient-text">Health</span></h1>
          <p>Platform infrastructure status and monitoring</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {dataUpdatedAt > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <button className="sa-btn sa-btn-ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
      </div>

      {error && <Alert type="danger" title="Failed to load system health" message={String(error)} />}

      {/* Overall Status Banner */}
      <div style={{ background: `${statusBannerColor}18`, border: `1px solid ${statusBannerColor}40`, borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <StatusDot status={overallStatus} />
        <div>
          <div style={{ fontWeight: 700, color: statusBannerColor, fontSize: 15 }}>{statusLabel}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Uptime: {health ? `${Math.floor((health.uptime_sec || 0) / 3600)}h ${Math.floor(((health.uptime_sec || 0) % 3600) / 60)}m` : '—'} · Node {health?.node_version ?? '—'} · {health?.environment ?? '—'}
          </div>
        </div>
        {health?.diagnostics && health.diagnostics.length > 0 && (
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--warning)' }}>
            ⚠ {health.diagnostics.length} diagnostic issue{health.diagnostics.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Health Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>

        {/* Database */}
        <HealthCard title="PostgreSQL Database" icon={<Database size={16} />} status={isLoading ? 'ok' : health?.database?.status}>
          {isLoading ? <div className="sa-skeleton" style={{ height: 60 }} /> : (
            <>
              <MetricRow label="Status" value={<span style={{ color: health?.database?.connected ? 'var(--success)' : 'var(--danger)' }}>{health?.database?.connected ? 'Connected' : 'Disconnected'}</span>} />
              <MetricRow label="Latency" value={health?.database?.latency_ms != null ? `${health.database.latency_ms}ms` : '—'} />
              <MetricRow label="Schema" value={health?.database?.schema_verified ? '✓ Verified' : '✗ Failed'} />
            </>
          )}
        </HealthCard>

        {/* Redis */}
        <HealthCard title="Redis Cache" icon={<Zap size={16} />} status={isLoading ? 'ok' : health?.redis?.status}>
          {isLoading ? <div className="sa-skeleton" style={{ height: 60 }} /> : (
            <>
              <MetricRow label="Status" value={<span style={{ color: health?.redis?.connected ? 'var(--success)' : 'var(--danger)' }}>{health?.redis?.connected ? 'Connected' : 'Unavailable'}</span>} />
              <MetricRow label="Latency" value={health?.redis?.latency_ms != null ? `${health.redis.latency_ms}ms` : '—'} />
            </>
          )}
        </HealthCard>

        {/* Queue */}
        <HealthCard title="BullMQ Job Queue" icon={<Activity size={16} />} status={isLoading ? 'ok' : health?.queue?.status}>
          {isLoading ? <div className="sa-skeleton" style={{ height: 80 }} /> : (
            <>
              <MetricRow label="Waiting" value={health?.queue?.waiting ?? 0} />
              <MetricRow label="Active" value={health?.queue?.active ?? 0} />
              <MetricRow label="Failed" value={<span style={{ color: (health?.queue?.failed ?? 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>{health?.queue?.failed ?? 0}</span>} />
              <MetricRow label="Delayed" value={health?.queue?.delayed ?? 0} />
            </>
          )}
        </HealthCard>

        {/* Memory */}
        <HealthCard title="Server Memory" icon={<Cpu size={16} />} status={isLoading ? 'ok' : health?.memory?.status}>
          {isLoading ? <div className="sa-skeleton" style={{ height: 80 }} /> : (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Heap Usage</span><span>{memPct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${memPct}%`, background: memPct > 90 ? 'var(--danger)' : memPct > 70 ? 'var(--warning)' : 'var(--success)', borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>
              <MetricRow label="Heap Used" value={`${health?.memory?.heap_used_mb ?? 0} MB`} />
              <MetricRow label="Heap Total" value={`${health?.memory?.heap_total_mb ?? 0} MB`} />
              <MetricRow label="RSS" value={`${health?.memory?.rss_mb ?? 0} MB`} />
            </>
          )}
        </HealthCard>
      </div>

      {/* Platform Stats */}
      {health?.platform_stats && (
        <div className="sa-card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><Server size={16} /> Platform Statistics</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total Tenants', value: health.platform_stats.totalTenants, color: 'var(--accent)' },
              { label: 'Active Tenants', value: health.platform_stats.activeTenants, color: 'var(--success)' },
              { label: 'Pending Approval', value: health.platform_stats.pendingTenants, color: 'var(--warning)' },
              { label: 'Total Invoices', value: health.platform_stats.totalInvoices, color: 'var(--text-secondary)' },
              { label: 'Pending Payments', value: health.platform_stats.pendingPayments, color: health.platform_stats.pendingPayments > 0 ? 'var(--danger)' : 'var(--success)' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cron Jobs */}
      {health?.cron_jobs && (
        <div className="sa-card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} /> Scheduled Cron Jobs
          </div>
          <div className="sa-table-container">
            <table className="sa-table">
              <thead><tr><th>Job Name</th><th>Schedule</th><th>Endpoint</th></tr></thead>
              <tbody>
                {health.cron_jobs.map((job, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{job.name}</td>
                    <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{job.schedule}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{job.endpoint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {health?.diagnostics && health.diagnostics.length > 0 && (
        <div className="sa-card" style={{ marginTop: 16, borderColor: 'var(--warning)' }}>
          <div style={{ fontWeight: 700, color: 'var(--warning)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} /> System Diagnostics</div>
          {health.diagnostics.map((d, i) => (
            <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 6, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {d}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
