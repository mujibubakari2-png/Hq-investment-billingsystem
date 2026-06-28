/**
 * Dashboard sub-components — FE-001
 *
 * Extracted from Dashboard.tsx (714 lines → ~100 lines each).
 * All components are pure/presentational — data is passed as props from Dashboard.tsx.
 */

import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RouterIcon from '@mui/icons-material/Router';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ErrorIcon from '@mui/icons-material/Error';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import CableIcon from '@mui/icons-material/Cable';
import WifiIcon from '@mui/icons-material/Wifi';
import PersonIcon from '@mui/icons-material/Person';
import SmsIcon from '@mui/icons-material/Sms';
import PeopleIcon from '@mui/icons-material/People';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import BoltIcon from '@mui/icons-material/Bolt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ViewListIcon from '@mui/icons-material/ViewList';
import TimelineIcon from '@mui/icons-material/Timeline';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import LoginIcon from '@mui/icons-material/Login';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import PaymentIcon from '@mui/icons-material/Payment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsIcon from '@mui/icons-material/Notifications';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { DashboardResponse } from '../../api';
import { formatDateTime } from '../../utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Router = { id: string; name: string; host: string; status: string; lastSeen: string };
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

// ── WelcomeBar ────────────────────────────────────────────────────────────────

interface WelcomeBarProps {
    greetName: string;
    greeting: string;
    routers: Router[];
    selectedRouter: string;
    onRouterChange: (id: string) => void;
}

export function WelcomeBar({ greetName, greeting, routers, selectedRouter, onRouterChange }: WelcomeBarProps) {
    return (
        <div className="dash-welcome-bar">
            <div className="dash-welcome-left">
                <div className="dash-welcome-avatar">{greetName.slice(0, 2).toUpperCase()}</div>
                <div className="dash-welcome-text">
                    <h1>Welcome back, {greetName}!</h1>
                    <p>{greeting}</p>
                </div>
            </div>
            <div className="dash-welcome-right">
                <div className="dash-welcome-filter">
                    <span>Filter by Router:</span>
                    <div className="dash-router-select">
                        <select
                            value={selectedRouter}
                            onChange={e => onRouterChange(e.target.value)}
                            style={{ border: 'none', background: 'transparent', color: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', outline: 'none', padding: '0 4px', width: '100%', appearance: 'none' }}
                        >
                            <option value="All">All Routers</option>
                            {routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <KeyboardArrowDownIcon fontSize="small" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── DateTimeBar ───────────────────────────────────────────────────────────────

interface DateTimeBarProps {
    dateStr: string;
    timeStr: string;
    loading: boolean;
    onRefresh: () => void;
}

export function DateTimeBar({ dateStr, timeStr, loading, onRefresh }: DateTimeBarProps) {
    return (
        <div className="dash-datetime-bar">
            <div className="dash-datetime-left">
                <span className="dash-chip date-chip"><CalendarMonthIcon style={{ fontSize: 14 }} />{dateStr}</span>
                <span className="dash-chip time-chip"><AccessTimeIcon style={{ fontSize: 14 }} />{timeStr}</span>
            </div>
            <div className="dash-datetime-right">
                <button className="dash-refresh-btn" disabled={loading} onClick={onRefresh} style={{ opacity: loading ? 0.7 : 1 }}>
                    <RefreshIcon style={{ fontSize: 16 }} className={loading ? 'spin' : ''} />
                    {loading ? 'Refreshing...' : 'Refresh Data'}
                </button>
                <div style={{ position: 'relative' }}>
                    <button className="dash-notif-btn" onClick={() => {
                        const el = document.getElementById('dash-notif-dropdown');
                        if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                    }}>
                        <NotificationsIcon style={{ fontSize: 18 }} />
                        <span className="notif-badge">1</span>
                    </button>
                    <div id="dash-notif-dropdown" style={{ display: 'none', position: 'absolute', top: '110%', right: 0, background: 'var(--bg-card, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 280, zIndex: 999, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>Notifications</div>
                        <div style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e53935', display: 'inline-block' }} />
                                <span>System updated successfully — all services running normally</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Just now</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardData {
    label: string; value: string; subtitle: string | null;
    change: number | null; color: string; icon?: string; accent: string;
}

interface StatCardsProps {
    cards: StatCardData[];
    hiddenCards: Set<number>;
    idOffset?: number;
    onToggle: (i: number) => void;
}

export function StatCards({ cards, hiddenCards, idOffset = 0, onToggle }: StatCardsProps) {
    return (
        <div className="dash-stat-grid">
            {cards.map((card, i) => {
                const id = idOffset + i;
                return (
                    <div className={`dash-stat-card ${card.accent}`} key={id}>
                        <div className="dash-stat-top">
                            <div className="dash-stat-icon-wrap" style={{ color: card.color }}>
                                {card.icon && <span style={{ fontSize: 20 }}>{card.icon}</span>}
                            </div>
                            <button className="dash-stat-eye" onClick={() => onToggle(id)} title={hiddenCards.has(id) ? 'Show' : 'Hide'}>
                                {hiddenCards.has(id) ? <VisibilityOffIcon style={{ fontSize: 16 }} /> : <VisibilityIcon style={{ fontSize: 16 }} />}
                            </button>
                        </div>
                        <div className="dash-stat-value" style={{ color: card.color }}>
                            {hiddenCards.has(id) ? '•••••' : card.value}
                        </div>
                        <div className="dash-stat-label">{card.label}</div>
                        {card.subtitle && <div className="dash-stat-subtitle">{card.subtitle}</div>}
                        {card.change !== null && card.change !== undefined && (
                            <div className={`dash-stat-change ${card.change >= 0 ? 'up' : 'down'}`}>
                                {card.change >= 0 ? <TrendingUpIcon style={{ fontSize: 14 }} /> : <TrendingDownIcon style={{ fontSize: 14 }} />}
                                {card.change >= 0 ? '▲' : '▼'} {card.change >= 0 ? '+' : '-'}{Math.abs(card.change).toFixed(1)}%
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── RouterStatusCard ──────────────────────────────────────────────────────────

interface RouterStatusCardProps {
    stats: DashboardResponse | null;
    routerData: { name: string; ip: string; status: string; lastSeen: string }[];
}

export function RouterStatusCard({ stats, routerData }: RouterStatusCardProps) {
    return (
        <div className="dash-card">
            <div className="dash-card-header">
                <div className="dash-card-title"><RouterIcon style={{ fontSize: 18 }} />Router Status</div>
            </div>
            <div className="dash-card-body">
                <div className="router-status-counts">
                    <div className="router-count-item">
                        <CheckCircleIcon style={{ fontSize: 28, color: '#4caf50' }} />
                        <div className="router-count-num">{stats?.onlineRouters ?? 0}</div>
                        <div className="router-count-label">Online</div>
                    </div>
                    <div className="router-count-item">
                        <CancelIcon style={{ fontSize: 28, color: '#e53935' }} />
                        <div className="router-count-num">{(stats?.totalRouters ?? 0) - (stats?.onlineRouters ?? 0)}</div>
                        <div className="router-count-label">Offline</div>
                    </div>
                    <div className="router-count-item">
                        <ErrorIcon style={{ fontSize: 28, color: '#e53935' }} />
                        <div className="router-count-num">{stats?.totalRouters ?? 0}</div>
                        <div className="router-count-label">Total</div>
                    </div>
                </div>
                <table className="dash-router-table">
                    <thead><tr><th>Router</th><th>Status</th><th>Last Seen</th></tr></thead>
                    <tbody>
                        {routerData.map((r, i) => (
                            <tr key={i}>
                                <td>
                                    <div className="router-cell">
                                        <RouterIcon style={{ fontSize: 16, color: '#4caf50' }} />
                                        <div><div className="router-name">{r.name}</div><div className="router-ip">{r.ip}</div></div>
                                    </div>
                                </td>
                                <td><span className="dash-badge online">{r.status}</span></td>
                                <td className="router-last-seen">{r.lastSeen}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── ConnectionOverviewCard ────────────────────────────────────────────────────

export function ConnectionOverviewCard({ stats }: { stats: DashboardResponse | null }) {
    return (
        <div className="dash-card">
            <div className="dash-card-header">
                <div className="dash-card-title"><AutoAwesomeIcon style={{ fontSize: 18, color: '#9c27b0' }} />Connection Overview</div>
            </div>
            <div className="dash-card-body">
                <div className="connection-grid">
                    <div className="connection-section">
                        <div className="connection-type-header">
                            <SettingsInputAntennaIcon style={{ fontSize: 16, color: '#e53935' }} />
                            <span className="conn-type-name">Hotspot</span>
                            <span className="conn-type-sub">WiFi connections</span>
                        </div>
                        <div className="conn-counts">
                            <div className="conn-count-item">
                                <CheckCircleIcon style={{ fontSize: 22, color: '#4caf50' }} />
                                <div className="conn-count-num">{stats?.activeSubscribers ?? 0}</div>
                                <div className="conn-count-label">Total Active</div>
                            </div>
                            <div className="conn-count-item">
                                <WifiIcon style={{ fontSize: 22, color: '#4caf50' }} />
                                <div className="conn-count-num">{stats?.hotspotOnlineUsers ?? 0}</div>
                                <div className="conn-count-label">Online (Hotspot)</div>
                            </div>
                        </div>
                    </div>
                    <div className="connection-section">
                        <div className="connection-type-header">
                            <CableIcon style={{ fontSize: 16, color: '#2196f3' }} />
                            <span className="conn-type-name">PPPoE</span>
                            <span className="conn-type-sub">Direct connections</span>
                        </div>
                        <div className="conn-counts">
                            <div className="conn-count-item">
                                <PersonIcon style={{ fontSize: 22, color: '#4caf50' }} />
                                <div className="conn-count-num">{stats?.pppoeOnlineUsers ?? 0}</div>
                                <div className="conn-count-label">Online (PPPoE)</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="connection-footer">
                    <div className="conn-footer-item">
                        <SmsIcon style={{ fontSize: 16, color: '#2196f3' }} />
                        <span className="conn-footer-label">SMS Balance</span>
                    </div>
                    <div className="conn-footer-item">
                        <PeopleIcon style={{ fontSize: 16, color: '#9c27b0' }} />
                        <span className="conn-footer-label">Total Customers</span>
                        <span className="conn-footer-value">{stats?.totalClients ?? 0} registered</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── RechargeRecordsCard ───────────────────────────────────────────────────────

export function RechargeRecordsCard({ stats }: { stats: DashboardResponse | null }) {
    return (
        <div className="dash-card">
            <div className="dash-card-header">
                <div className="dash-card-title"><DataUsageIcon style={{ fontSize: 18, color: '#2196f3' }} />Today's Recharge Records</div>
            </div>
            <div className="dash-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
                {[
                    { icon: <SettingsInputAntennaIcon style={{ color: '#00bcd4', fontSize: '24px' }} />, label: 'Voucher Subscriptions', sub: 'Users paid via Voucher', value: stats?.todayRechargesVoucher ?? 0, color: '#00bcd4' },
                    { icon: <BoltIcon style={{ color: '#e53935', fontSize: '24px' }} />, label: 'Payment Channel', sub: 'Users paid via Mpesa/Mobile', value: stats?.todayRechargesMobile ?? 0, color: '#e53935' },
                ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-lighter, rgba(0,0,0,0.03))', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {row.icon}
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{row.label}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.sub}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: row.color }}>{row.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── RecentTransactionsCard ────────────────────────────────────────────────────

interface TxRow { user: string; time: string; planType: string; amount: string; isVoucher: boolean; paymentChannel: string }

export function RecentTransactionsCard({ transactions }: { transactions: TxRow[] }) {
    const navigate = useNavigate();
    return (
        <div className="dash-card">
            <div className="dash-card-header">
                <div className="dash-card-title"><ReceiptLongIcon style={{ fontSize: 18, color: '#4caf50' }} />Today's Transactions</div>
                <button className="dash-view-all-btn" onClick={() => navigate('/all-transactions')}>
                    <ViewListIcon style={{ fontSize: 14 }} />View All
                </button>
            </div>
            <div className="dash-card-body no-pad">
                {transactions.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No transactions recorded today yet.</div>
                ) : (
                    <table className="dash-transactions-table">
                        <thead><tr><th>User</th><th>Plan</th><th>Amount</th><th>Channel</th></tr></thead>
                        <tbody>
                            {transactions.map((tx, i) => (
                                <tr key={i}>
                                    <td>
                                        <div className="tx-user-cell">
                                            <FiberManualRecordIcon style={{ fontSize: 8, color: tx.isVoucher ? '#9c27b0' : '#2196f3' }} />
                                            <div><div className="tx-username">{tx.user}</div><div className="tx-time">{tx.time}</div></div>
                                        </div>
                                    </td>
                                    <td><div className="tx-plan">{tx.planType}</div></td>
                                    <td><div className="tx-amount">{tx.amount}</div></td>
                                    <td>
                                        {tx.isVoucher ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(156,39,176,0.12)', color: '#9c27b0', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>🎟️ Voucher</span>
                                        ) : (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(33,150,243,0.12)', color: '#2196f3', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>💳 {tx.paymentChannel}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ── ServiceUtilizationCard ────────────────────────────────────────────────────

export function ServiceUtilizationCard({ stats }: { stats: DashboardResponse | null }) {
    const navigate = useNavigate();
    const COLORS = ['#e53935', '#e91e63', '#9c27b0', '#2196f3', '#4caf50'];
    return (
        <div className="dash-card service-util-card">
            <div className="dash-card-header">
                <div className="dash-card-title"><WifiIcon style={{ fontSize: 18, color: '#4caf50' }} />Service Utilization</div>
            </div>
            <div className="dash-card-body">
                <div className="service-tabs">
                    <button className="service-tab active" onClick={() => navigate('/packages')}>
                        ❤️ Hotspot Plans <span className="service-tab-count">{stats?.activeSubscribers ?? 0}</span>
                    </button>
                </div>
                <div className="service-plan-grid">
                    {(stats?.serviceUtilization ?? []).map((pkg, i) => (
                        <div className="service-plan-item" key={i}>
                            <div className="service-plan-left">
                                <FiberManualRecordIcon style={{ fontSize: 10, color: COLORS[i % 5] }} />
                                <div>
                                    <div className="service-plan-name">{pkg.name}</div>
                                    <div className="service-plan-type" style={{ fontSize: '0.8rem', opacity: 0.8 }}>{pkg.type} Plan</div>
                                </div>
                            </div>
                            <div className="service-plan-count">
                                <span className="badge active" style={{ fontWeight: 'bold' }}>{pkg.activeUsersCount} Users</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── RevenueAnalyticsCard ──────────────────────────────────────────────────────

interface RevenueAnalyticsCardProps {
    data: { date: string; revenue: number }[];
    period: AnalyticsPeriod;
    onPeriodChange: (p: AnalyticsPeriod) => void;
}

export function RevenueAnalyticsCard({ data, period, onPeriodChange }: RevenueAnalyticsCardProps) {
    const periodBtn = (p: AnalyticsPeriod, label: string) => (
        <button
            onClick={() => onPeriodChange(p)}
            style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: period === p ? 'var(--primary)' : 'transparent', color: period === p ? '#fff' : 'inherit', fontSize: '0.75rem', cursor: 'pointer' }}
        >{label}</button>
    );
    return (
        <div className="dash-card">
            <div className="dash-card-header">
                <div className="dash-card-title"><TimelineIcon style={{ fontSize: 18, color: '#e53935' }} />Revenue Analytics</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {periodBtn('daily', 'Day')}{periodBtn('weekly', 'Week')}{periodBtn('monthly', 'Month')}{periodBtn('yearly', 'Year')}
                </div>
            </div>
            <div className="dash-card-body" style={{ padding: '20px 20px 12px' }}>
                {/* Fixed pixel height wrapper prevents Recharts "width/height = -1" error
                    that occurs when ResponsiveContainer uses height="100%" on a flex/grid parent */}
                <div style={{ position: 'relative', width: '100%', height: 260, minWidth: 1, minHeight: 1 }}>
                    <ResponsiveContainer width="100%" height={260} minWidth={1} minHeight={1} debounce={50}>
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2196f3" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#2196f3" stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border-light)' }} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border-light)' }} tickFormatter={(v: number) => v.toLocaleString()} />
                            <Tooltip
                                contentStyle={{ background: '#1a1d2e', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, padding: '8px 14px' }}
                                labelStyle={{ color: '#90caf9', fontWeight: 600, marginBottom: 4 }}
                                formatter={(value: unknown) => [`Revenue: ${((value as number) ?? 0).toLocaleString()}.00`, '']}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#2196f3" strokeWidth={2.5} fill="url(#revenueGradient)" dot={{ r: 3, fill: '#2196f3', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#2196f3', stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

// ── SystemActivityCard ────────────────────────────────────────────────────────

interface ActivityItem { id: string; title: string; description: string; date: string; type: string; status: string }

export function SystemActivityCard({ activities }: { activities: ActivityItem[] }) {
    return (
        <div className="dash-card">
            <div className="dash-card-header">
                <div className="dash-card-title"><BoltIcon style={{ fontSize: 18, color: '#9c27b0' }} />System Activity</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 6 }}>Last 5 days</span>
            </div>
            <div className="dash-card-body no-pad">
                <div className="system-activity-list">
                    {activities.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent activity in the last 5 days.</div>
                    )}
                    {activities.slice(0, 10).map((act, i) => {
                        const isLogin = act.type === 'login';
                        const isVoucher = act.description?.toLowerCase().includes('voucher');
                        const color = isLogin ? '#2196f3' : isVoucher ? '#9c27b0' : '#4caf50';
                        const bg = isLogin ? 'rgba(33,150,243,0.12)' : isVoucher ? 'rgba(156,39,176,0.12)' : 'rgba(76,175,80,0.12)';
                        return (
                            <div className="sys-activity-item" key={i}>
                                <div className="sys-activity-icon-wrap" style={{ background: bg, color }}>
                                    {isLogin ? <LoginIcon style={{ fontSize: 16 }} /> : isVoucher ? <ConfirmationNumberIcon style={{ fontSize: 16 }} /> : <PaymentIcon style={{ fontSize: 16 }} />}
                                </div>
                                <div className="sys-activity-content">
                                    <div className="sys-activity-role" style={{ color }}>{act.title}</div>
                                    <div className="sys-activity-desc">{act.description}</div>
                                    <div className="sys-activity-time">{formatDateTime(act.date)}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
