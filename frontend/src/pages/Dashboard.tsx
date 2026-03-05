import { useState } from 'react';
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

// --- Mock data for the new dashboard layout ---
const revenueCards = [
    {
        label: "Today's Revenue",
        value: 'TSH 0.00',
        change: -100,
        color: '#e53935',
        icon: '💰',
    },
    {
        label: 'Monthly Revenue',
        value: 'TSH 2,500.00',
        change: -82.4,
        color: '#00bcd4',
        icon: '📊',
    },
    {
        label: 'Active Users',
        value: '3',
        subtitle: '⚡ 2 online',
        change: null,
        color: '#4caf50',
        icon: '👥',
    },
    {
        label: "Today's Recharges",
        value: '3',
        change: null,
        color: '#9c27b0',
        icon: '🔋',
    },
];

const voucherCards = [
    {
        label: "Today's Voucher Revenue",
        value: 'TSH 2,500.00',
        change: 166.7,
        color: '#2196f3',
    },
    {
        label: 'Monthly Voucher Revenue',
        value: 'TSH 6,500.00',
        change: -77.8,
        color: '#e91e63',
    },
];

const routerData = [
    {
        name: 'INVESTMENT-123',
        ip: '10.7.0.187',
        status: 'Online',
        lastSeen: 'Mar 2, 2026 23:00',
    },
];

const recentTransactions = [
    { user: 'HS-10MI361', time: '2 hrs ago', plan: 'masaa 6', type: 'Hotspot', amount: 'TSH 500.00', method: 'voucher - 2135' },
    { user: 'HS-CWK6147', time: '3 hrs ago', plan: 'masaa 74', type: 'Hotspot', amount: 'TSH 1,000.00', method: 'voucher - 5175' },
    { user: 'HS-GI039307', time: '1 days ago', plan: 'masaa 24', type: 'Hotspot', amount: 'TSH 1,000.00', method: 'voucher - 5221' },
    { user: 'HS-ZCT8206', time: '1 days ago', plan: 'masaa 6', type: 'Hotspot', amount: 'TSH 500.00', method: 'voucher - 5809' },
    { user: 'HS-XV15026', time: '1 days ago', plan: 'masaa 6', type: 'Hotspot', amount: 'TSH 500.00', method: 'voucher - 8579' },
];

const servicePlans = [
    { name: 'masaa 6', type: 'Hotspot Plan', users: 41, color: '#e53935' },
    { name: 'masaa 24', type: 'Hotspot Plan', users: 25, color: '#e91e63' },
    { name: 'siku 3', type: 'Hotspot Plan', users: 3, color: '#9c27b0' },
];

const revenueAnalyticsData = [
    { date: 'Feb 26', revenue: 3200 },
    { date: 'Feb 27', revenue: 3400 },
    { date: 'Feb 28', revenue: 3000 },
    { date: 'Mar 1', revenue: 2800 },
    { date: 'Mar 2', revenue: 3800 },
    { date: 'Mar 3', revenue: 3500 },
    { date: 'Mar 4', revenue: 1500 },
];

const systemActivityData = [
    { role: 'SuperAdmin', email: 'mujibubakan7@gmail.com', action: 'logged in via...', time: '11 Oct, 2026 19:11', color: '#e53935' },
    { role: 'SuperAdmin', email: 'mujibubakan7@gmail.com', action: 'logged in via...', time: '4/0 Oct, 2026 18:11', color: '#e53935' },
    { role: 'SuperAdmin', email: 'mujibubakan2@gmail.com', action: 'logged in via...', time: '3/4 Oct, 2026 11:11', color: '#e53935' },
    { role: 'User', email: "User 'unknown' logged out from IP...", action: '', time: '3/2 Oct, 2026 11:11', color: '#2196f3' },
    { role: 'SuperAdmin', email: 'mujibubakan2@gmail.com', action: 'logged in via...', time: '18 Oct, 2026 11:11', color: '#e53935' },
];

export default function Dashboard() {
    const [hiddenCards, setHiddenCards] = useState<Set<number>>(new Set());

    const toggleCardVisibility = (index: number) => {
        setHiddenCards(prev => {
            const n = new Set(prev);
            if (n.has(index)) n.delete(index);
            else n.add(index);
            return n;
        });
    };

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    return (
        <div className="dashboard-new">
            {/* ===== DARK WELCOME HEADER ===== */}
            <div className="dash-welcome-bar">
                <div className="dash-welcome-left">
                    <div className="dash-welcome-avatar">MR</div>
                    <div className="dash-welcome-text">
                        <h1>Welcome back, Mujibu!</h1>
                        <p>🌙 Good night!</p>
                    </div>
                </div>
                <div className="dash-welcome-right">
                    <div className="dash-welcome-filter">
                        <span>⚙ Filter by Router</span>
                        <div className="dash-router-select">
                            All Routers
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
                    <button className="dash-refresh-btn">
                        <RefreshIcon style={{ fontSize: 16 }} />
                        Refresh Data
                    </button>
                    <button className="dash-notif-btn">
                        <NotificationsIcon style={{ fontSize: 18 }} />
                        <span className="notif-badge">1</span>
                    </button>
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
                        <div className={`dash-stat-change ${card.change >= 0 ? 'up' : 'down'}`}>
                            {card.change >= 0 ? (
                                <TrendingUpIcon style={{ fontSize: 14 }} />
                            ) : (
                                <TrendingDownIcon style={{ fontSize: 14 }} />
                            )}
                            {card.change >= 0 ? '+' : ''}{card.change}%
                        </div>
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
                                <div className="router-count-num">1</div>
                                <div className="router-count-label">Online</div>
                            </div>
                            <div className="router-count-item">
                                <CancelIcon style={{ fontSize: 28, color: '#e53935' }} />
                                <div className="router-count-num">0</div>
                                <div className="router-count-label">Offline</div>
                            </div>
                            <div className="router-count-item">
                                <ErrorIcon style={{ fontSize: 28, color: '#e53935' }} />
                                <div className="router-count-num">1</div>
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
                                        <div className="conn-count-num">3</div>
                                        <div className="conn-count-label">Active</div>
                                    </div>
                                    <div className="conn-count-item">
                                        <WifiIcon style={{ fontSize: 22, color: '#4caf50' }} />
                                        <div className="conn-count-num">2</div>
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
                                <span className="conn-footer-value">23 registered</span>
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
                        <button className="dash-view-all-btn">
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
                        <button className="service-tab active">
                            ❤️ Hotspot Plans <span className="service-tab-count">{servicePlans.length}</span>
                        </button>
                    </div>

                    <div className="service-plan-grid">
                        {servicePlans.map((plan, i) => (
                            <div className="service-plan-item" key={i}>
                                <div className="service-plan-left">
                                    <FiberManualRecordIcon style={{ fontSize: 10, color: plan.color }} />
                                    <div>
                                        <div className="service-plan-name">{plan.name}</div>
                                        <div className="service-plan-type">{plan.type}</div>
                                    </div>
                                </div>
                                <div className="service-plan-count">
                                    <span className="service-plan-num">{plan.users}</span>
                                    <span className="service-plan-unit">users</span>
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
                            {systemActivityData.map((item, i) => (
                                <div className="sys-activity-item" key={i}>
                                    <div className="sys-activity-dot" style={{ background: item.color }} />
                                    <div className="sys-activity-content">
                                        <div className="sys-activity-role" style={{ color: item.color }}>
                                            {item.role}
                                        </div>
                                        <div className="sys-activity-desc">
                                            {item.email}{item.action ? ` ${item.action}` : ''}
                                        </div>
                                        <div className="sys-activity-time">{item.time}</div>
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
