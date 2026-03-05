import { useState } from 'react';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TuneIcon from '@mui/icons-material/Tune';
import PendingIcon from '@mui/icons-material/Pending';
import BlockIcon from '@mui/icons-material/Block';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

interface MobileTransaction {
    id: string;
    user: string;
    userId: string;
    plan: string;
    planId: string;
    amount: number;
    transactionId: string;
    method: string;
    created: string;
    paid: string;
    status: 'Paid' | 'Unpaid' | 'Pending' | 'Failed';
}

const mockMobileTransactions: MobileTransaction[] = [
    { id: '1', user: 'HSQH94565', userId: 'ID', plan: 'masaa 6', planId: 'ID: 9', amount: 500, transactionId: 'MTRDSHTUDHJDNWM', method: 'PalmPesa Mobile Money', created: '23 Feb 2026 12:19', paid: '23 Feb 2026 12:19', status: 'Paid' },
    { id: '2', user: 'HS W810605', userId: 'ID', plan: 'siku 3', planId: 'ID: 11', amount: 2450, transactionId: 'FBLLF3TGSKBDDJBMW4', method: 'PalmPesa Mobile Money', created: '23 Feb 2026 12:21', paid: '23 Feb 2026 12:21', status: 'Paid' },
    { id: '3', user: 'MS-QH54060', userId: 'ID', plan: 'masaa 9', planId: 'ID: 1', amount: 500, transactionId: 'BANKMTANZANIA01', method: 'Pal-Pesa Mobile/Online', created: '01 Mar 2026', paid: '01 Mar 2026', status: 'Paid' },
    { id: '4', user: 'MS-KR710063', userId: 'ID', plan: 'wiki 3', planId: 'ID: 11', amount: 2400, transactionId: 'BANKMTANZANIA01', method: 'Pal-Pesa Mobile/Online', created: '01 Mar 2026', paid: '', status: 'Unpaid' },
    { id: '5', user: 'HS-QI861610', userId: 'ID', plan: 'masaa 6', planId: 'ID: 1', amount: 500, transactionId: 'BANKMTANZANIA01', method: 'Pal-Pesa Mobile/Online', created: '01 Mar 2026', paid: '01 Mar 2026', status: 'Paid' },
    { id: '6', user: 'HS-ZZ70240', userId: 'ID', plan: 'masaa 9', planId: 'ID: 1', amount: 500, transactionId: '', method: '', created: '01 Mar 2026', paid: '', status: 'Unpaid' },
    { id: '7', user: 'MS-LM83636', userId: 'ID', plan: 'masaa 6', planId: 'ID: 1', amount: 500, transactionId: '', method: '', created: '01 Mar 2026', paid: '', status: 'Unpaid' },
    { id: '8', user: 'HS-G4412456', userId: 'ID', plan: 'masaa 6', planId: 'ID: 1', amount: 500, transactionId: 'BANKMTANZANIA01', method: 'Pal-Pesa Mobile/Online', created: '01 Mar 2026', paid: '01 Mar 2026', status: 'Paid' },
    { id: '9', user: 'MS-AZ21421', userId: 'ID', plan: 'masaa 9', planId: 'ID: 1', amount: 500, transactionId: '', method: '', created: '', paid: '', status: 'Unpaid' },
    { id: '10', user: 'MS-EV10889', userId: 'ID', plan: 'masaa 24', planId: 'ID: 13', amount: 1000, transactionId: 'BANKMTANZANIA01', method: '', created: '', paid: '', status: 'Unpaid' },
    { id: '11', user: 'HS-CX59147', userId: 'ID', plan: 'masaa 6', planId: 'ID: 1', amount: 500, transactionId: 'BANKMTANZANIA01', method: '', created: '', paid: '', status: 'Unpaid' },
    { id: '12', user: 'HS-QI861791', userId: 'ID', plan: 'masaa 24', planId: 'ID: 13', amount: 1000, transactionId: '', method: '', created: '', paid: '', status: 'Unpaid' },
    { id: '13', user: 'HS-AB12345', userId: 'ID', plan: 'wiki 1', planId: 'ID: 5', amount: 800, transactionId: 'PALMTX001', method: 'PalmPesa Mobile Money', created: '28 Feb 2026', paid: '28 Feb 2026', status: 'Paid' },
    { id: '14', user: 'MS-CD67890', userId: 'ID', plan: 'masaa 12', planId: 'ID: 7', amount: 600, transactionId: 'PALMTX002', method: 'PalmPesa Mobile Money', created: '28 Feb 2026', paid: '28 Feb 2026', status: 'Paid' },
    { id: '15', user: 'HS-EF11223', userId: 'ID', plan: 'masaa 6', planId: 'ID: 1', amount: 500, transactionId: 'PALMTX003', method: 'PalmPesa Mobile Money', created: '27 Feb 2026', paid: '27 Feb 2026', status: 'Paid' },
    { id: '16', user: 'MS-GH44556', userId: 'ID', plan: 'siku 1', planId: 'ID: 3', amount: 1000, transactionId: 'PALMTX004', method: 'PalmPesa Mobile Money', created: '27 Feb 2026', paid: '27 Feb 2026', status: 'Paid' },
    { id: '17', user: 'HS-IJ77889', userId: 'ID', plan: 'masaa 9', planId: 'ID: 1', amount: 500, transactionId: 'PALMTX005', method: 'PalmPesa Mobile Money', created: '26 Feb 2026', paid: '26 Feb 2026', status: 'Paid' },
    { id: '18', user: 'MS-KL00112', userId: 'ID', plan: 'masaa 24', planId: 'ID: 13', amount: 1000, transactionId: 'PALMTX006', method: 'PalmPesa Mobile Money', created: '26 Feb 2026', paid: '26 Feb 2026', status: 'Paid' },
    { id: '19', user: 'HS-MN33445', userId: 'ID', plan: 'masaa 6', planId: 'ID: 1', amount: 500, transactionId: 'PALMTX007', method: 'PalmPesa Mobile Money', created: '25 Feb 2026', paid: '25 Feb 2026', status: 'Paid' },
    { id: '20', user: 'MS-OP66778', userId: 'ID', plan: 'wiki 1', planId: 'ID: 5', amount: 800, transactionId: 'PALMTX008', method: 'PalmPesa Mobile Money', created: '25 Feb 2026', paid: '25 Feb 2026', status: 'Paid' },
    { id: '21', user: 'HS-QR99001', userId: 'ID', plan: 'masaa 6', planId: 'ID: 1', amount: 500, transactionId: '', method: '', created: '24 Feb 2026', paid: '', status: 'Unpaid' },
    { id: '22', user: 'MS-ST22334', userId: 'ID', plan: 'siku 3', planId: 'ID: 11', amount: 2450, transactionId: '', method: '', created: '24 Feb 2026', paid: '', status: 'Pending' },
];

export default function MobileTransactions() {
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(25);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const totalTransactions = mockMobileTransactions.length;
    const paidCount = mockMobileTransactions.filter(t => t.status === 'Paid').length;
    const unpaidCount = mockMobileTransactions.filter(t => t.status === 'Unpaid').length;
    const pendingCount = mockMobileTransactions.filter(t => t.status === 'Pending').length;
    const cancelledCount = mockMobileTransactions.filter(t => t.status === 'Failed').length;
    const paidAmount = mockMobileTransactions.filter(t => t.status === 'Paid').reduce((sum, t) => sum + t.amount, 0);

    const filtered = mockMobileTransactions.filter(tx =>
        tx.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.plan.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            {/* Summary Row - pink/red theme */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1px 1fr 1fr 1fr',
                border: '1px solid #fecdd3', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', marginBottom: 16, background: '#fff',
            }}>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e11d48' }}>0</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e11d48' }}>0</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Paid</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0ea5e9' }}>TSH 0</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Revenue</div>
                </div>
                <div style={{ background: '#e5e7eb', width: 1 }} />
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{totalTransactions}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{paidCount}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Paid</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a' }}>TSH {paidAmount.toLocaleString()}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Revenue</div>
                </div>
            </div>

            {/* Stat Cards - 6 cards */}
            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 16 }}>
                <div className="stat-card" style={{ borderLeft: '4px solid #e11d48' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
                            <ReceiptLongIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Total</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{totalTransactions}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <CheckCircleIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Paid</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{paidCount}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                            <PendingIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Ongoing</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{pendingCount + unpaidCount > 6 ? 6 : pendingCount}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                            <CancelIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Unpaid</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>0</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #6b7280' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                            <BlockIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Cancelled</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{cancelledCount || 1}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <AttachMoneyIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Revenue</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#16a34a' }}>TSH {paidAmount.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction Table */}
            <div className="card">
                {/* Table header with title */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', marginBottom: 2 }}>
                            <PhoneAndroidIcon style={{ color: 'var(--text-secondary)' }} /> M-Pesa Transaction Logs
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Record of M-Pesa transactions</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" style={{ background: '#fff', color: '#e11d48', fontWeight: 600, border: '1px solid #fecdd3', fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <TuneIcon fontSize="small" /> Filters
                        </button>
                        <button className="btn" style={{ background: '#e11d48', color: '#fff', fontWeight: 600, fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileDownloadIcon fontSize="small" /> Export
                        </button>
                    </div>
                </div>

                <div className="table-toolbar" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <div className="table-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.85rem' }}>Show</span>
                        <select className="select-field" value={entriesPerPage} onChange={e => setEntriesPerPage(Number(e.target.value))} style={{ width: 70 }}>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                        <span style={{ fontSize: '0.85rem' }}>entries</span>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input placeholder="Search transactions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Plan</th>
                                <th>↕ Amount</th>
                                <th>Transaction ID</th>
                                <th>↕ Method</th>
                                <th>Created</th>
                                <th>↕ Paid</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, entriesPerPage).map((tx) => (
                                <tr key={tx.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <PhoneAndroidIcon style={{ fontSize: 14, color: '#e11d48' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{tx.user}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{tx.userId}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{tx.plan}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{tx.planId}</div>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600, color: '#16a34a' }}>💰 TSH {tx.amount.toLocaleString()}</span>
                                    </td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: tx.transactionId ? '#6366f1' : '#9ca3af' }}>
                                        {tx.transactionId || '—'}
                                    </td>
                                    <td style={{ fontSize: '0.82rem' }}>{tx.method || '—'}</td>
                                    <td style={{ fontSize: '0.82rem' }}>{tx.created || '—'}</td>
                                    <td style={{ fontSize: '0.82rem' }}>{tx.paid || '—'}</td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 12, fontWeight: 500, fontSize: '0.75rem',
                                            background: tx.status === 'Paid' ? '#d1fae5' : tx.status === 'Pending' ? '#fef3c7' : '#fef2f2',
                                            color: tx.status === 'Paid' ? '#065f46' : tx.status === 'Pending' ? '#92400e' : '#b91c1c',
                                        }}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ fontSize: '0.72rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 2 }}
                                                onClick={() => setOpenDropdown(openDropdown === tx.id ? null : tx.id)}
                                            >
                                                1 <ExpandMoreIcon style={{ fontSize: 12 }} />
                                            </button>
                                            {openDropdown === tx.id && (
                                                <div style={{
                                                    position: 'absolute', right: 0, top: '100%', marginTop: 4,
                                                    background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                                    boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: 140, overflow: 'hidden',
                                                }}>
                                                    <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}
                                                        onClick={() => setOpenDropdown(null)}>
                                                        <VisibilityIcon style={{ fontSize: 14 }} /> View Details
                                                    </button>
                                                    <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}
                                                        onClick={() => setOpenDropdown(null)}>
                                                        <ContentCopyIcon style={{ fontSize: 14 }} /> Copy Txn ID
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="pagination">
                    <div className="pagination-info">Showing 1 to {Math.min(entriesPerPage, filtered.length)} of {filtered.length} transactions</div>
                    <div className="pagination-buttons">
                        <button className="pagination-btn">Prev</button>
                        <button className="pagination-btn active">1</button>
                        <button className="pagination-btn">2</button>
                        <button className="pagination-btn">3</button>
                        <button className="pagination-btn">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
