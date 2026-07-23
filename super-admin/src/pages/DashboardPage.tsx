import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { overviewApi, type OverviewData } from '../api';
import { StatusBadge, Trend, fmtCurrency, fmtDate, Alert } from '../components/ui';
import {
  Users, CheckCircle2, XCircle, Clock, AlertTriangle,
  TrendingUp, CreditCard, Shield, ArrowRight, Building2, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const PLAN_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

function StatCard({
  label, value, icon, iconType, trend, sub, onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconType: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
  trend?: number;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <div className="sa-stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="sa-stat-header">
        <span className="sa-stat-label">{label}</span>
        <div className={`sa-stat-icon ${iconType}`}>{icon}</div>
      </div>
      <div className="sa-stat-value">{value}</div>
      <div className="sa-stat-footer">
        {trend !== undefined && <Trend value={trend} />}
        {sub && <span className="sa-stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery<OverviewData>({
    queryKey: ['sa-overview'],
    queryFn: overviewApi.get,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="sa-loading-center">
        <div className="sa-spinner" />
        <span>Loading platform data…</span>
      </div>
    );
  }

  if (error || !data) {
    return <Alert type="danger" title="Failed to load overview" message={String(error || 'Unknown error')} />;
  }

  const { overview, revenue, alerts, planDistribution, recentPayments, recentTenants } = data;

  // Build chart data from plan distribution for sparkline
  const planChartData = planDistribution.map(p => ({ name: p.name, value: p.tenantCount }));

  // Build MRR trend data (mock visual with current month highlight)
  const mrrChartData = [
    { month: 'Last', value: revenue.lastMonthMRR },
    { month: 'This', value: revenue.platformMRR },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Platform <span className="sa-gradient-text">Overview</span></h1>
          <p>Real-time platform health, tenant status, and revenue metrics</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={() => navigate('/tenants')}>
          <Users size={15} /> Manage Tenants
        </button>
      </div>

      {/* Expiry Alerts */}
      {alerts.expiringIn7Days > 0 && (
        <Alert
          type="danger"
          title={`${alerts.expiringIn7Days} tenant license(s) expiring within 7 days`}
          message="Renew or extend licenses to prevent service interruption for affected tenants."
        />
      )}
      {alerts.expiringIn30Days > 0 && alerts.expiringIn7Days === 0 && (
        <Alert
          type="warning"
          title={`${alerts.expiringIn30Days} tenant license(s) expiring within 30 days`}
          message="Review licenses and reach out to tenants for renewal."
        />
      )}
      {overview.pendingTenants > 0 && (
        <Alert
          type="info"
          title={`${overview.pendingTenants} tenant(s) pending approval`}
          message="New tenant registrations are waiting for your review and approval."
        />
      )}

      {/* Main Stats */}
      <div className="sa-stats-grid">
        <StatCard
          label="Total Tenants"
          value={overview.totalTenants}
          icon={<Building2 size={18} />}
          iconType="primary"
          onClick={() => navigate('/tenants')}
          sub="All registered"
        />
        <StatCard
          label="Active Tenants"
          value={overview.activeTenants}
          icon={<CheckCircle2 size={18} />}
          iconType="success"
          onClick={() => navigate('/tenants?status=ACTIVE')}
          sub="Fully licensed"
        />
        <StatCard
          label="Trialling"
          value={overview.triallingTenants}
          icon={<Clock size={18} />}
          iconType="accent"
          onClick={() => navigate('/tenants?status=TRIALLING')}
          sub="On trial period"
        />
        <StatCard
          label="Suspended"
          value={overview.suspendedTenants}
          icon={<XCircle size={18} />}
          iconType="danger"
          onClick={() => navigate('/tenants?status=SUSPENDED')}
          sub="Require attention"
        />
        <StatCard
          label="Platform MRR"
          value={fmtCurrency(revenue.platformMRR)}
          icon={<TrendingUp size={18} />}
          iconType="success"
          trend={revenue.mrrTrend}
          sub="License revenue"
        />
        <StatCard
          label="Pending Approval"
          value={overview.pendingTenants}
          icon={<AlertTriangle size={18} />}
          iconType="warning"
          onClick={() => navigate('/tenants?status=PENDING_APPROVAL')}
          sub="Awaiting review"
        />
        <StatCard
          label="Expiring in 7d"
          value={alerts.expiringIn7Days}
          icon={<Shield size={18} />}
          iconType={alerts.expiringIn7Days > 0 ? 'danger' : 'primary'}
          onClick={() => navigate('/licenses')}
          sub="Critical renewals"
        />
        <StatCard
          label="Expiring in 30d"
          value={alerts.expiringIn30Days}
          icon={<CreditCard size={18} />}
          iconType={alerts.expiringIn30Days > 5 ? 'warning' : 'primary'}
          onClick={() => navigate('/licenses')}
          sub="Upcoming renewals"
        />
      </div>

      {/* Charts Row */}
      <div className="sa-grid-2 sa-mb-28">
        {/* Plan Distribution Pie */}
        <div className="sa-card">
          <div className="sa-card-header">
            <span className="sa-card-title">SaaS Plan Distribution</span>
            <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => navigate('/plans')}>
              View Plans <ArrowRight size={12} />
            </button>
          </div>
          {planChartData.length > 0 ? (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {planChartData.map((_, i) => (
                      <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }}
                    formatter={(val) => [Number(val), 'Tenants']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="sa-empty" style={{ padding: '40px 0' }}>
              <span className="sa-text-muted">No plans configured</span>
            </div>
          )}
        </div>

        {/* MRR Chart */}
        <div className="sa-card">
          <div className="sa-card-header">
            <span className="sa-card-title">License Revenue (MRR)</span>
            <Trend value={revenue.mrrTrend} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
              {fmtCurrency(revenue.platformMRR)}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 8 }}>
              this month
            </span>
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrrChartData}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }}
                  formatter={(v) => [fmtCurrency(Number(v)), 'Revenue']}
                />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#mrrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="sa-grid-2">
        {/* Recent Payments */}
        <div className="sa-card">
          <div className="sa-card-header">
            <span className="sa-card-title">Recent License Payments</span>
            <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => navigate('/licenses')}>
              All <ArrowRight size={12} />
            </button>
          </div>
          {recentPayments.length === 0 ? (
            <div className="sa-empty" style={{ padding: '30px 0' }}>
              <Activity size={28} color="var(--text-disabled)" />
              <span>No payments yet</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentPayments.slice(0, 6).map(p => (
                <div key={p.id} className="sa-flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.tenantName}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {p.paymentMethod} · {fmtDate(p.createdAt)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flex: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 10 }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--success)' }}>
                      {fmtCurrency(p.amount)}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Tenants */}
        <div className="sa-card">
          <div className="sa-card-header">
            <span className="sa-card-title">Recent Registrations</span>
            <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => navigate('/tenants')}>
              All <ArrowRight size={12} />
            </button>
          </div>
          {recentTenants.length === 0 ? (
            <div className="sa-empty" style={{ padding: '30px 0' }}>
              <Users size={28} color="var(--text-disabled)" />
              <span>No recent registrations</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentTenants.map(t => (
                <div
                  key={t.id}
                  className="sa-flex-between"
                  style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => navigate(`/tenants/${t.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: 'white',
                    }}>
                      {t.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {t.planName} · {fmtDate(t.createdAt)}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
