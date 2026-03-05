import { useState } from 'react';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import DeleteIcon from '@mui/icons-material/Delete';
import { mockInvoices } from '../data/mockData';

export default function Invoices() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const filtered = mockInvoices.filter(inv => {
        const matchSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || inv.client.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'All' || inv.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const totalPaid = mockInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
    const totalUnpaid = mockInvoices.filter(i => i.status === 'Unpaid').reduce((s, i) => s + i.amount, 0);
    const totalOverdue = mockInvoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0);

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                        <ReceiptIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Invoices</h1>
                        <p className="page-subtitle">Manage and track client invoices</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary">
                        <AddIcon fontSize="small" /> Create Invoice
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--secondary)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Paid</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--secondary)', marginTop: 4 }}>{totalPaid.toLocaleString()} TZS</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{mockInvoices.filter(i => i.status === 'Paid').length} invoices</div>
                </div>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--warning)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unpaid</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)', marginTop: 4 }}>{totalUnpaid.toLocaleString()} TZS</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{mockInvoices.filter(i => i.status === 'Unpaid').length} invoices</div>
                </div>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Overdue</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)', marginTop: 4 }}>{totalOverdue.toLocaleString()} TZS</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{mockInvoices.filter(i => i.status === 'Overdue').length} invoices</div>
                </div>
            </div>

            <div className="card">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="All">All Status</option>
                            <option>Paid</option>
                            <option>Unpaid</option>
                            <option>Overdue</option>
                            <option>Draft</option>
                        </select>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input placeholder="Search invoices..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Client</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Issued Date</th>
                                <th>Due Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(inv => (
                                <tr key={inv.id}>
                                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoiceNumber}</span></td>
                                    <td style={{ fontWeight: 500 }}>{inv.client}</td>
                                    <td style={{ fontWeight: 600 }}>{inv.amount.toLocaleString()} TZS</td>
                                    <td>
                                        <span className={`badge ${inv.status === 'Paid' ? 'active' : inv.status === 'Overdue' ? 'expired' : 'inactive'}`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td>{inv.issuedDate}</td>
                                    <td style={{ color: inv.status === 'Overdue' ? 'var(--danger)' : 'inherit' }}>{inv.dueDate}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="btn-icon view" title="View"><VisibilityIcon style={{ fontSize: 16 }} /></button>
                                            <button className="btn-icon sync" title="Print"><PrintIcon style={{ fontSize: 16 }} /></button>
                                            <button className="btn-icon delete" title="Delete"><DeleteIcon style={{ fontSize: 16 }} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="pagination">
                    <div className="pagination-info">Showing 1 to {filtered.length} of {filtered.length} entries</div>
                    <div className="pagination-buttons">
                        <button className="pagination-btn">Previous</button>
                        <button className="pagination-btn active">1</button>
                        <button className="pagination-btn">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
