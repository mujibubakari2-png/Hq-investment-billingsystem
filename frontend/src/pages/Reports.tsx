import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupIcon from '@mui/icons-material/Group';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { revenueChartData, subscriberGrowthData, mockExpenses } from '../data/mockData';

const COLORS = ['#e53935', '#4caf50', '#2196f3', '#ff9800', '#9c27b0'];

const expenseByCategory = mockExpenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
}, {});

const expensePieData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }));

export default function Reports() {
    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                        <BarChartIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Reports & Analytics</h1>
                        <p className="page-subtitle">Business insights and performance metrics</p>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="stat-cards" style={{ marginBottom: 24 }}>
                <div className="stat-card blue">
                    <div className="stat-card-label">Total Revenue</div>
                    <div className="stat-card-value">150,000</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>TZS All-time</div>
                    <div className="stat-card-icon"><AttachMoneyIcon style={{ fontSize: 48 }} /></div>
                </div>
                <div className="stat-card green">
                    <div className="stat-card-label">Monthly Revenue</div>
                    <div className="stat-card-value">45,000</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>TZS Feb 2026</div>
                    <div className="stat-card-icon"><TrendingUpIcon style={{ fontSize: 48 }} /></div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-card-label">Total Clients</div>
                    <div className="stat-card-value">95</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>+12 this month</div>
                    <div className="stat-card-icon"><GroupIcon style={{ fontSize: 48 }} /></div>
                </div>
                <div className="stat-card orange">
                    <div className="stat-card-label">Total Expenses</div>
                    <div className="stat-card-value">
                        {(mockExpenses.reduce((s, e) => s + e.amount, 0) / 1000).toFixed(0)}K
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>TZS this period</div>
                    <div className="stat-card-icon"><BarChartIcon style={{ fontSize: 48 }} /></div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                {/* Revenue Chart */}
                <div className="card card-body">
                    <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Daily Revenue (TZS)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={revenueChartData}>
                            <defs>
                                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#e53935" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#e53935" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Area type="monotone" dataKey="value" stroke="#e53935" fill="url(#revGrad)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Subscriber Growth */}
                <div className="card card-body">
                    <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Subscriber Growth</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={subscriberGrowthData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="clients" fill="#4caf50" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Expense Breakdown */}
                <div className="card card-body">
                    <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Expense by Category</h3>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                        <ResponsiveContainer width="60%" height={200}>
                            <PieChart>
                                <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                                    {expensePieData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ flex: 1 }}>
                            {expensePieData.map((item, i) => (
                                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.82rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                                        {item.name}
                                    </div>
                                    <strong>{item.value.toLocaleString()}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top Stats */}
                <div className="card card-body">
                    <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Performance Summary</h3>
                    {[
                        { label: 'Net Profit', value: '25,000 TZS', positive: true },
                        { label: 'Avg Revenue/Client', value: '472 TZS' },
                        { label: 'Active Rate', value: '79%', positive: true },
                        { label: 'Expiry Rate', value: '21%', negative: true },
                        { label: 'Vouchers Generated', value: '10' },
                        { label: 'SMS Sent', value: '45' },
                    ].map(item => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                            <strong style={{ color: item.positive ? 'var(--secondary)' : item.negative ? 'var(--danger)' : 'var(--text-primary)' }}>
                                {item.value}
                            </strong>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
