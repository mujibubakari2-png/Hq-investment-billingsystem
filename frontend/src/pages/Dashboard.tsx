import { useState, useEffect } from 'react';
import { dashboardApi, routersApi } from '../api/client';
import type { DashboardResponse } from '../api/client';
import { useNavigate } from 'react-router-dom';
import authStore from '../stores/authStore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import WifiIcon from '@mui/icons-material/Wifi';
import RouterIcon from '@mui/icons-material/Router';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ErrorIcon from '@mui/icons-material/Error';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import CableIcon from '@mui/icons-material/Cable';
import SmsIcon from '@mui/icons-material/Sms';
import PeopleIcon from '@mui/icons-material/People';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ViewListIcon from '@mui/icons-material/ViewList';
import TimelineIcon from '@mui/icons-material/Timeline';
import BoltIcon from '@mui/icons-material/Bolt';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

// Formats a number as TZS currency
function fmt(n: number) { return `TSH ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`; }

export default function Dashboard() {
    const { user } = authStore.useAuth();
    const navigate = useNavigate();
    const [hiddenCards, setHiddenCards] = useState<Set<number>>(new Set());
    const [stats, setStats] = useState<DashboardResponse | null>(null);
    const [routers, setRouters] = useState<Array<{ name: string; host: string; status: string; lastSeen: string }>>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dashData, routerData] = await Promise.all([
                dashboardApi.getStats(),
                routersApi.list(),
            ]);
            setStats(dashData);
            setRouters(routerData as unknown as typeof routers);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchData(); }, []);

    const toggleCardVisibility = (index: number) => {
        setHiddenCards(prev => {
            const n = new Set(prev);
            if (n.has(index)) n.delete(index);
            else n.add(index);
            return n;
        });
    };

    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    const greetName = user?.username || 'User';
    const hour = now.getHours();
    const greeting = hour < 12 ? '☀️ Good morning!' : hour < 18 ? '🌤️ Good afternoon!' : '🌙 Good night!';

    const revenueCards = [
        { label: "Today's Revenue", value: fmt(0), change: null, color: '#e53935', icon: '💰' },
        { label: 'Monthly Revenue', value: fmt(stats?.monthlyRevenue ?? 0), change: null, color: '#00bcd4', icon: '📊' },
        { label: 'Active Users', value: String(stats?.activeSubscribers ?? 0), subtitle: `⚡ ${stats?.onlineUsers ?? 0} online`, change: null, color: '#4caf50', icon: '👥' },
        { label: 'Total Clients', value: String(stats?.totalClients ?? 0), change: null, color: '#9c27b0', icon: '🔋' },
    ];

    const voucherCards = [
        { label: 'Total Revenue', value: fmt(stats?.totalRevenue ?? 0), change: null, color: '#2196f3' },
        { label: 'Expired Subscribers', value: String(stats?.expiredSubscribers ?? 0), change: null, color: '#e91e63' },
    ];

    const recentTransactions = (stats?.recentTransactions ?? []).map(t => ({
        user: t.user,
        time: t.date,
        plan: '',
        type: '',
        amount: fmt(t.amount),
        method: t.method,
    }));

    const revenueAnalyticsData = (stats?.revenueChartData ?? []).map(d => ({
        date: d.name,
        revenue: d.value,
    }));

    const routerData = routers.map(r => ({
        name: r.name,
        ip: r.host,
        status: r.status,
        lastSeen: r.lastSeen || 'Unknown',
    }));

    if (loading && !stats) {
        return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading dashboard...</div>;
    }

    return (
        <div className="dashboard-new">
            {/* ===== DARK WELCOME HEADER ===== */}
            <div className="dash-welcome-bar">
                <div className="dash-welcome-left">
                    <div className="dash-welcome-avatar">{greetName.slice(0, 2).toUpperCase()}</div>
                    <div className="dash-welcome-text">
                        <h1>Welcome back, {greetName}!</h1>
                        <p>{greeting}</p>
                    </div>
                </div>
                <div className="dash-welcome-right" style={{ cursor: 'pointer' }} onClick={() => navigate('/mikrotiks')}>
                    <div className="dash-welcome-filter">
                        <span>⚙ Manage Routers</span>
                        <div className="dash-router-select">
                            Config
                            <KeyboardArrowDownIcon fontSize="small" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Date/Time Bar */}
            <div className="dash-datetime-bar">
                <div className="dash-datetime-left">
                    <span className="dash-chip date-chip">
                        <CalendarMonthIcon style={{ fontSize: 14 }} />
                        {dateStr}
                    </span>
                    <span className="dash-chip time-chip">
                        <AccessTimeIcon style={{ fontSize: 14 }} />
                        {timeStr}
                    </span>
                </div>
                <div className="dash-datetime-right">
                    <button className="dash-refresh-btn" onClick={() => fetchData()}>
                        <RefreshIcon style={{ fontSize: 16 }} />
                        Refresh Data
                    </button>
                    <div style={{ position: 'relative' }}>
                        <button className="dash-notif-btn" onClick={() => {
                            const notifEl = document.getElementById('dash-notif-dropdown');
                            if (notifEl) notifEl.style.display = notifEl.style.display === 'none' ? 'block' : 'none';
                        }}>
                            <NotificationsIcon style={{ fontSize: 18 }} />
                            <span className="notif-badge">1</span>
                        </button>
                        <div id="dash-notif-dropdown" style={{
                            display: 'none', position: 'absolute', top: '110%', right: 0,
                            background: 'var(--bg-card, #fff)', border: '1px solid var(--border, #e5e7eb)',
                            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                            minWidth: 280, zIndex: 999, overflow: 'hidden',
                        }}>
                            <div style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>
                                Notifications
                            </div>
                            <div style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e53935', display: 'inline-block' }} />
                                    <span>System updated successfully</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Just now</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== REVENUE STAT CARDS ===== */}
            <div className="dash-stat-grid">
                {revenueCards.map((card, i) => (
                    <div className="dash-stat-card" key={i}>
                        <div className="dash-stat-top">
                            <div className="dash-stat-icon-wrap" style={{ color: card.color }}>
                                <span style={{ fontSize: 20 }}>{card.icon}</span>
                            </div>
                            <button
                                className="dash-stat-eye"
                                onClick={() => toggleCardVisibility(i)}
                                title={hiddenCards.has(i) ? 'Show' : 'Hide'}
                            >
                                {hiddenCards.has(i) ? (
                                    <VisibilityOffIcon style={{ fontSize: 16 }} />
                                ) : (
                                    <VisibilityIcon style={{ fontSize: 16 }} />
                                )}
                            </button>
                        </div>
                        <div className="dash-stat-value" style={{ color: card.color }}>
                            {hiddenCards.has(i) ? '•••••' : card.value}
                        </div>
                        <div className="dash-stat-label">{card.label}</div>
                        {card.subtitle && (
                            <div className="dash-stat-subtitle">{card.subtitle}</div>
                        )}
                        {card.change !== null && (
                            <div className={`dash-stat-change ${card.change >= 0 ? 'up' : 'down'}`}>
                                {card.change >= 0 ? (
                                    <TrendingUpIcon style={{ fontSize: 14 }} />
                                ) : (
                                    <TrendingDownIcon style={{ fontSize: 14 }} />
                                )}
                                {card.change >= 0 ? '+' : ''}{card.change}%
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Voucher Revenue Cards */}
            <div className="dash-stat-grid voucher-row">
                {voucherCards.map((card, i) => (
                    <div className="dash-stat-card" key={i}>
                        <div className="dash-stat-top">
                            <div className="dash-stat-icon-wrap" style={{ background: card.color + '18' }}>
                                <span style={{ fontSize: 16, color: card.color }}>■</span>
                            </div>
                            <button
                                className="dash-stat-eye"
                                onClick={() => toggleCardVisibility(100 + i)}
                                title={hiddenCards.has(100 + i) ? 'Show' : 'Hide'}
                            >
                                {hiddenCards.has(100 + i) ? (
                                    <VisibilityOffIcon style={{ fontSize: 16 }} />
                                ) : (
                                    <VisibilityIcon style={{ fontSize: 16 }} />
                                )}
                            </button>
                        </div>
                        <div className="dash-stat-value" style={{ color: card.color }}>
                            {hiddenCards.has(100 + i) ? '•••••' : card.value}
                        </div>
                        <div className="dash-stat-label">{card.label}</div>
                        {card.change !== null && card.change !== undefined && (
                            <div className={`dash-stat-change ${(card.change ?? 0) >= 0 ? 'up' : 'down'}`}>
                                {(card.change ?? 0) >= 0 ? (
                                    <TrendingUpIcon style={{ fontSize: 14 }} />
                                ) : (
                                    <TrendingDownIcon style={{ fontSize: 14 }} />
                                )}
                                {(card.change ?? 0) >= 0 ? '+' : ''}{card.change}%
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ===== ROUTER STATUS + CONNECTION OVERVIEW ===== */}
            <div className="dash-two-col">
                {/* Router Status */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <div className="dash-card-title">
                            <RouterIcon style={{ fontSize: 18 }} />
                            Router Status
                        </div>
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
                            <thead>
                                <tr>
                                    <th>Router</th>
                                    <th>Status</th>
                                    <th>Last Seen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {routerData.map((r, i) => (
                                    <tr key={i}>
                                        <td>
                                            <div className="router-cell">
                                                <RouterIcon style={{ fontSize: 16, color: '#4caf50' }} />
                                                <div>
                                                    <div className="router-name">{r.name}</div>
                                                    <div className="router-ip">{r.ip}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="dash-badge online">{r.status}</span>
                                        </td>
                                        <td className="router-last-seen">{r.lastSeen}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Connection Overview */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <div className="dash-card-title">
                            <AutoAwesomeIcon style={{ fontSize: 18, color: '#9c27b0' }} />
                            Connection Overview
                        </div>
                    </div>
                    <div className="dash-card-body">
                        <div className="connection-grid">
                            {/* Hotspot */}
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
                                        <div className="conn-count-label">Active</div>
                                    </div>
                                    <div className="conn-count-item">
                                        <WifiIcon style={{ fontSize: 22, color: '#4caf50' }} />
                                        <div className="conn-count-num">{stats?.onlineUsers ?? 0}</div>
                                        <div className="conn-count-label">Online</div>
                                    </div>
                                </div>
                            </div>

                            {/* PPPoE */}
                            <div className="connection-section">
                                <div className="connection-type-header">
                                    <CableIcon style={{ fontSize: 16, color: '#2196f3' }} />
                                    <span className="conn-type-name">PPPoE</span>
                                    <span className="conn-type-sub">Direct connections</span>
                                </div>
                                <div className="conn-counts">
                                    <div className="conn-count-item">
                                        <CheckCircleIcon style={{ fontSize: 22, color: '#4caf50' }} />
                                        <div className="conn-count-num">0</div>
                                        <div className="conn-count-label">Active</div>
                                    </div>
                                    <div className="conn-count-item">
                                        <PersonIcon style={{ fontSize: 22, color: '#4caf50' }} />
                                        <div className="conn-count-num">0</div>
                                        <div className="conn-count-label">Online</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SMS Balance + Total Customers */}
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
            </div>

            {/* ===== TOP DATA USERS + RECENT TRANSACTIONS ===== */}
            <div className="dash-two-col">
                {/* Top Data Users */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <div className="dash-card-title">
                            <DataUsageIcon style={{ fontSize: 18 }} />
                            Top Data Users
                        </div>
                    </div>
                    <div className="dash-card-body dash-empty-state">
                        <div className="empty-icon">📊</div>
                        <p>No data usage recorded today.</p>
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <div className="dash-card-title">
                            <ReceiptLongIcon style={{ fontSize: 18, color: '#4caf50' }} />
                            Recent Transactions
                        </div>
                        <button className="dash-view-all-btn" onClick={() => navigate('/all-transactions')}>
                            <ViewListIcon style={{ fontSize: 14 }} />
                            View All
                        </button>
                    </div>
                    <div className="dash-card-body no-pad">
                        <table className="dash-transactions-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Plan</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentTransactions.map((tx, i) => (
                                    <tr key={i}>
                                        <td>
                                            <div className="tx-user-cell">
                                                <FiberManualRecordIcon style={{ fontSize: 8, color: '#e53935' }} />
                                                <div>
                                                    <div className="tx-username">{tx.user}</div>
                                                    <div className="tx-time">{tx.time}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="tx-plan">{tx.plan}</div>
                                            <div className="tx-type">{tx.type}</div>
                                        </td>
                                        <td>
                                            <div className="tx-amount">{tx.amount}</div>
                                            <div className="tx-method">{tx.method}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ===== SERVICE UTILIZATION ===== */}
            <div className="dash-card service-util-card">
                <div className="dash-card-header">
                    <div className="dash-card-title">
                        <WifiIcon style={{ fontSize: 18, color: '#4caf50' }} />
                        Service Utilization
                    </div>
                </div>
                <div className="dash-card-body">
                    <div className="service-tabs">
                        <button className="service-tab active" onClick={() => navigate('/packages')}>
                            ❤️ Hotspot Plans <span className="service-tab-count">{stats?.activeSubscribers ?? 0}</span>
                        </button>
                    </div>

                    <div className="service-plan-grid">
                        {(stats?.recentSubscriptions ?? []).slice(0, 5).map((sub: { id: string; username: string; plan: string; status: string }, i: number) => (
                            <div className="service-plan-item" key={i}>
                                <div className="service-plan-left">
                                    <FiberManualRecordIcon style={{ fontSize: 10, color: ['#e53935', '#e91e63', '#9c27b0', '#2196f3', '#4caf50'][i % 5] }} />
                                    <div>
                                        <div className="service-plan-name">{sub.plan}</div>
                                        <div className="service-plan-type">{sub.username}</div>
                                    </div>
                                </div>
                                <div className="service-plan-count">
                                    <span className={`badge ${sub.status.toLowerCase()}`}>{sub.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== REVENUE ANALYTICS + SYSTEM ACTIVITY ===== */}
            <div className="dash-two-col">
                {/* Revenue Analytics */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <div className="dash-card-title">
                            <TimelineIcon style={{ fontSize: 18, color: '#e53935' }} />
                            Revenue Analytics
                        </div>
                        <span className="dash-card-filter-label">Last 7 Days</span>
                    </div>
                    <div className="dash-card-body" style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueAnalyticsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2196f3" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#2196f3" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                <XAxis
                                    dataKey="date"
                                    stroke="var(--text-muted)"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={{ stroke: 'var(--border-light)' }}
                                />
                                <YAxis
                                    stroke="var(--text-muted)"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={{ stroke: 'var(--border-light)' }}
                                    tickFormatter={(v: number) => v.toLocaleString()}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1a1d2e',
                                        border: 'none',
                                        borderRadius: 8,
                                        color: '#fff',
                                        fontSize: 12,
                                        padding: '8px 14px',
                                    }}
                                    labelStyle={{ color: '#90caf9', fontWeight: 600, marginBottom: 4 }}
                                    formatter={(value: number | undefined) => [`Revenue: ${(value ?? 0).toLocaleString()}.00`, '']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#2196f3"
                                    strokeWidth={2.5}
                                    fill="url(#revenueGradient)"
                                    dot={{ r: 3, fill: '#2196f3', strokeWidth: 0 }}
                                    activeDot={{ r: 5, fill: '#2196f3', stroke: '#fff', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* System Activity */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <div className="dash-card-title">
                            <BoltIcon style={{ fontSize: 18, color: '#9c27b0' }} />
                            System Activity
                        </div>
                    </div>
                    <div className="dash-card-body no-pad">
                        <div className="system-activity-list">
                            {(stats?.systemActivities ?? []).slice(0, 5).map((act: { id: string; title: string; description: string; date: string; type: string; status: string }, i: number) => (
                                <div className="sys-activity-item" key={i}>
                                    <div className="sys-activity-icon-wrap" style={{ 
                                        background: act.type === 'login' ? 'rgba(244, 67, 54, 0.12)' : 'rgba(76, 175, 80, 0.12)', 
                                        color: act.type === 'login' ? '#f44336' : '#4caf50' 
                                    }}>
                                        {act.type === 'login' ? <BoltIcon style={{ fontSize: 16 }} /> : <ReceiptLongIcon style={{ fontSize: 16 }} />}
                                    </div>
                                    <div className="sys-activity-content">
                                        <div className="sys-activity-role">
                                            {act.title}
                                        </div>
                                        <div className="sys-activity-desc">
                                            {act.description}
                                        </div>
                                        <div className="sys-activity-time">{act.date}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
