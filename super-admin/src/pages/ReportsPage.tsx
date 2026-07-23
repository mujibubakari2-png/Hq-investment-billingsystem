import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, type ReportsData } from '../api';
import { fmtCurrency } from '../components/ui';
import { TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const PLAN_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  TRIALLING: '#06b6d4',
  SUSPENDED: '#ef4444',
  PENDING_APPROVAL: '#f59e0b',
  CANCELLED: '#6b7280',
};

function KpiCard({ label, value, sub, icon, trend }: { label: string; value: string; sub?: string; icon: React.ReactNode; trend?: number }) {
  return (
    <div className="sa-stat-card">
      <div className="sa-stat-card-header">
        <span className="sa-stat-card-label">{label}</span>
        <div className="sa-stat-card-icon">{icon}</div>
      </div>
      <div className="sa-stat-card-value">{value}</div>
      {(sub || trend !== undefined) && (
        <div className="sa-stat-card-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend !== undefined && (
            <>
              {trend >= 0
                ? <TrendingUp size={12} color="var(--success)" />
                : <TrendingDown size={12} color="var(--danger)" />}
              <span style={{ color: trend >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              <span>vs last month</span>
            </>
          )}
          {sub && !trend && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState('12');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sa-reports', period],
    queryFn: () => reportsApi.get(period),
  });

  const r: ReportsData | undefined = data;

  const mrrData = r?.mrrTrend.map(m => ({
    month: m.month.slice(5),
    revenue: m.revenue,
  })) ?? [];

  const growthData = r?.tenantGrowth.map(m => ({
    month: m.month.slice(5),
    tenants: m.count,
  })) ?? [];

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Platform <span className="sa-gradient-text">Reports</span></h1>
          <p>Revenue analytics and tenant growth insights</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="sa-select" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 140 }}>
            <option value="3">Last 3 months</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="24">Last 24 months</option>
          </select>
          <button className="sa-btn sa-btn-ghost" onClick={() => refetch()}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sa-stats-grid" style={{ marginBottom: 28 }}>
        <KpiCard
          label="Total Platform Revenue"
          value={isLoading ? '—' : fmtCurrency(r?.kpis.totalRevenue ?? 0)}
          icon={<DollarSign size={20} />}
        />
        <KpiCard
          label="Current Month MRR"
          value={isLoading ? '—' : fmtCurrency(r?.kpis.currentMonthRevenue ?? 0)}
          icon={<TrendingUp size={20} />}
          trend={r?.kpis.mrrGrowthPct}
        />
        <KpiCard
          label="Active Tenants"
          value={isLoading ? '—' : String(r?.kpis.activeTenants ?? 0)}
          sub={`of ${r?.kpis.totalTenants ?? 0} total`}
          icon={<Users size={20} />}
        />
        <KpiCard
          label="Churn Rate"
          value={isLoading ? '—' : `${r?.kpis.churnRate ?? 0}%`}
          icon={<TrendingDown size={20} />}
        />
        {(r?.kpis.overdueInvoices ?? 0) > 0 && (
          <KpiCard
            label="Overdue Invoices"
            value={String(r?.kpis.overdueInvoices ?? 0)}
            icon={<AlertTriangle size={20} />}
          />
        )}
        {(r?.kpis.expiringSoon ?? 0) > 0 && (
          <KpiCard
            label="Expiring in 30 Days"
            value={String(r?.kpis.expiringSoon ?? 0)}
            sub="tenants need renewal"
            icon={<AlertTriangle size={20} />}
          />
        )}
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* MRR Trend */}
        <div className="sa-card">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={15} /> Monthly Recurring Revenue (MRR)
          </div>
          {isLoading ? <div className="sa-skeleton" style={{ height: 200 }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={mrrData}>
                <defs>
                  <linearGradient id="mrrGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }}
                  formatter={(v) => [fmtCurrency(Number(v)), 'MRR']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#mrrGrad2)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tenant Growth */}
        <div className="sa-card">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={15} /> New Tenants per Month
          </div>
          {isLoading ? <div className="sa-skeleton" style={{ height: 200 }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }}
                  formatter={(v) => [v, 'New Tenants']}
                />
                <Bar dataKey="tenants" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Revenue by Plan */}
        <div className="sa-card">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16 }}>Revenue by SaaS Plan</div>
          {isLoading ? <div className="sa-skeleton" style={{ height: 180 }} /> : (r?.revenueByPlan?.length ?? 0) === 0 ? (
            <div className="sa-empty" style={{ minHeight: 120 }}><div className="sa-empty-title">No data yet</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Pie data={r!.revenueByPlan} dataKey="revenue" nameKey="planName" cx="50%" cy="50%" outerRadius={75} label={false} labelLine={false}>
                  {r!.revenueByPlan.map((_, i) => <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} formatter={(v) => [fmtCurrency(Number(v)), 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="sa-card">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16 }}>Tenant Status Breakdown</div>
          {isLoading ? <div className="sa-skeleton" style={{ height: 180 }} /> : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={r?.statusBreakdown ?? []} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={110} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {(r?.statusBreakdown ?? []).map((s, i) => (
                      <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {(r?.statusBreakdown ?? []).map(s => (
                  <span key={s.status} style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[s.status] ?? '#6b7280', flexShrink: 0 }} />
                    {s.status}: {s.count}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
