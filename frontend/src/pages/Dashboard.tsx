/**
 * Dashboard — FE-001 refactor
 *
 * This file is now a thin orchestrator: it owns state, fetches data, and
 * computes derived values. All rendering is delegated to sub-components in
 * ./components/dashboard/DashboardWidgets.tsx.
 *
 * Before: 714 lines of mixed state + fetch + JSX
 * After:  ~120 lines of pure orchestration logic
 */

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi, routersApi } from '../api';
import type { DashboardResponse } from '../api';
import { useSearchParams } from 'react-router-dom';
import authStore from '../stores/authStore';
import { formatDateTime } from '../utils/formatters';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    WelcomeBar,
    DateTimeBar,
    StatCards,
    RouterStatusCard,
    ConnectionOverviewCard,
    RechargeRecordsCard,
    RecentTransactionsCard,
    ServiceUtilizationCard,
    RevenueAnalyticsCard,
    SystemActivityCard,
    type AnalyticsPeriod,
    type Router,
} from '../components/dashboard/DashboardWidgets';
import './Dashboard.css';

function fmt(n: number) { return `TSH ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`; }

function getTrendMeta(currentValue: number | undefined, trend: number | null | undefined) {
    if (trend === null || trend === undefined || Number.isNaN(trend)) {
        return { change: null as number | null, subtitle: null as string | null };
    }

    const safeCurrent = Number(currentValue ?? 0);
    const normalizedTrend = Number(trend ?? 0);
    const direction = normalizedTrend >= 0 ? 'up' : 'down';
    const absoluteTrend = Math.abs(normalizedTrend);
    const previousValue = normalizedTrend === 0 ? safeCurrent : safeCurrent / (1 + normalizedTrend / 100);
    const changeAmount = Math.abs(safeCurrent - previousValue);

    return {
        change: Math.round(normalizedTrend),
        subtitle: normalizedTrend === 0
            ? 'No change vs last period'
            : `Sales ${direction === 'up' ? 'up' : 'down'} by ${fmt(changeAmount)}`,
        percentLabel: `${direction === 'up' ? '+' : '-'}${absoluteTrend.toFixed(1)}%`,
    };
}

export default function Dashboard() {
    const { user } = authStore.useAuth();
    const [searchParams] = useSearchParams();
    const tenantIdParam = searchParams.get('tenantId');

    // ── State ──────────────────────────────────────────────────────────────
    const [hiddenCards, setHiddenCards] = useState<Set<number>>(new Set());
    const [stats, setStats] = useState<DashboardResponse | null>(null);
    const [routers, setRouters] = useState<Router[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRouter, setSelectedRouter] = useState('All');
    const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('daily');
    const [now, setNow] = useState(new Date());

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // ── Data fetching ──────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [dashData, routerData] = await Promise.all([
                dashboardApi.getStats(tenantIdParam || undefined, selectedRouter),
                routersApi.list(),
            ]);
            setStats(dashData);
            setRouters(routerData as unknown as Router[]);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [tenantIdParam, selectedRouter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-refresh every 30 seconds (real-time RADIUS online status)
    useEffect(() => {
        const t = setInterval(fetchData, 30_000);
        return () => clearInterval(t);
    }, [fetchData]);

    // ── Derived values ─────────────────────────────────────────────────────
    const greetName = user?.username || 'User';
    const hour = now.getHours();
    const greeting = tenantIdParam
        ? `Viewing dashboard for tenant: ${tenantIdParam}`
        : hour < 12 ? '☀️ Good morning!' : hour < 18 ? '🌤️ Good afternoon!' : '🌙 Good night!';

    const dateStr = now.toLocaleDateString('en-US', { timeZone: 'Africa/Dar_es_Salaam', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Africa/Dar_es_Salaam', hour12: false });

    const monthlyRevenueTrend = getTrendMeta(stats?.monthlyRevenue, stats?.monthlyRevenueTrend);
    const monthlyVoucherTrend = getTrendMeta(stats?.monthlyVoucherRev, stats?.monthlyVoucherRevTrend);

    const revenueCards = [
        { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), subtitle: `${stats?.todayRechargesMobile || 0} payments received today`, change: null, color: '#e53935', icon: '💰', accent: 'accent-red' },
        { label: 'Monthly Revenue', value: fmt(stats?.monthlyRevenue ?? 0), subtitle: monthlyRevenueTrend.subtitle ?? `${stats?.monthlyRechargesMobile || 0} payments this month`, change: monthlyRevenueTrend.change, color: '#00bcd4', icon: '📊', accent: 'accent-blue' },
        { label: 'Active Subscribers', value: String(stats?.activeSubscribers ?? 0), subtitle: `⚡ ${stats?.onlineUsers ?? 0} currently online`, change: null, color: '#4caf50', icon: '👥', accent: 'accent-green' },
        { label: 'Total Customers', value: String(stats?.totalClients ?? 0), subtitle: `${stats?.newCustomersThisMonth || 0} new this month`, change: null, color: '#9c27b0', icon: '🔋', accent: 'accent-purple' },
    ];

    const voucherCards = [
        { label: 'Today Voucher Rev', value: fmt(stats?.todayVoucherRev ?? 0), subtitle: `${stats?.vouchersUsedToday || 0} active vouchers`, change: null, color: '#2196f3', accent: 'accent-blue' },
        { label: 'Monthly Voucher Rev', value: fmt(stats?.monthlyVoucherRev ?? 0), subtitle: monthlyVoucherTrend.subtitle ?? `${stats?.vouchersUsedMonth || 0} active vouchers`, change: monthlyVoucherTrend.change, color: '#e91e63', accent: 'accent-red' },
    ];

    const recentTransactions = (stats?.recentTransactions ?? []).map(t => ({
        user: t.user,
        time: formatDateTime(t.date),
        planType: t.planType,
        timeActive: t.timeActiveSys,
        amount: fmt(t.amount),
        method: t.method,
        isVoucher: t.isVoucher,
        transactionType: t.transactionType,
        paymentChannel: t.paymentChannel,
    }));

    const revenueAnalyticsData = (stats?.revenueAnalytics?.[analyticsPeriod] ?? []).map(d => ({
        date: d.name,
        revenue: d.value,
    }));

    const routerData = routers.map(r => ({
        name: r.name,
        ip: r.host,
        status: r.status,
        lastSeen: r.lastSeen || 'Unknown',
    }));

    const toggleCardVisibility = (id: number) => {
        setHiddenCards(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    // ── Loading / Error guards ─────────────────────────────────────────────
    if (loading && !stats) {
        return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading your dashboard...</div>;
    }

    if (error && !stats) {
        return (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                <ErrorIcon style={{ fontSize: 48, color: '#e53935', marginBottom: 16 }} />
                <h3>Unable to load dashboard data</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Check your connection and try again.</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={fetchData}>
                    <RefreshIcon style={{ fontSize: 16, marginRight: 8 }} /> Retry
                </button>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="dashboard-new">
            <WelcomeBar
                greetName={greetName}
                greeting={greeting}
                routers={routers}
                selectedRouter={selectedRouter}
                onRouterChange={setSelectedRouter}
            />

            <DateTimeBar
                dateStr={dateStr}
                timeStr={timeStr}
                loading={loading}
                onRefresh={fetchData}
            />

            {/* Revenue stat cards */}
            <StatCards cards={revenueCards} hiddenCards={hiddenCards} idOffset={0} onToggle={toggleCardVisibility} />

            {/* Voucher revenue cards (offset by 100 to avoid id clash) */}
            <StatCards cards={voucherCards} hiddenCards={hiddenCards} idOffset={100} onToggle={toggleCardVisibility} />

            <div className="dash-two-col">
                <RouterStatusCard stats={stats} routerData={routerData} />
                <ConnectionOverviewCard stats={stats} />
            </div>

            <div className="dash-two-col">
                <RechargeRecordsCard stats={stats} />
                <RecentTransactionsCard transactions={recentTransactions} />
            </div>

            <ServiceUtilizationCard stats={stats} />

            <div className="dash-two-col">
                <RevenueAnalyticsCard
                    data={revenueAnalyticsData}
                    period={analyticsPeriod}
                    onPeriodChange={setAnalyticsPeriod}
                />
                <SystemActivityCard activities={stats?.systemActivities ?? []} />
            </div>
        </div>
    );
}
