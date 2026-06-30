import { useState, useEffect } from 'react';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import { adminInvoicesApi } from '../api';
import { formatDate } from '../utils/formatters';

interface SaasInvoice {
    id: string;
    invoiceNumber: string;
    tenantName: string;
    tenantEmail: string;
    planName: string;
    amount: number;
    paidAmount: number;
    status: string; // 'PENDING' | 'PAID'
    dueDate: string;
    createdAt: string;
    displayStatus: 'Paid' | 'Unpaid' | 'Overdue' | 'Active' | 'Trial' | 'Suspended';
}

export default function Invoices() {
    const [invoices, setInvoices] = useState<SaasInvoice[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [loading, setLoading] = useState(true);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await adminInvoicesApi.list();

            const mapped = res.map((inv: any) => {
                let displayStatus: SaasInvoice['displayStatus'] = 'Unpaid';
                if (inv.status === 'PAID') {
                    displayStatus = 'Paid';
                } else if (inv.status === 'OVERDUE' || inv.status === 'EXPIRED') {
                    displayStatus = 'Overdue';
                } else if (inv.status === 'ACTIVE') {
                    displayStatus = 'Active';
                } else if (inv.status === 'TRIALLING') {
                    displayStatus = 'Trial';
                } else if (inv.status === 'SUSPENDED' || inv.status === 'CANCELLED') {
                    displayStatus = 'Suspended';
                } else if (inv.status === 'PENDING') {
                    if (new Date(inv.dueDate) < new Date()) {
                        displayStatus = 'Overdue';
                    } else {
                        displayStatus = 'Unpaid';
                    }
                }

                return {
                    ...inv,
                    displayStatus
                };
            });

            setInvoices(mapped);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handlePrintInvoice = (inv: SaasInvoice) => {
        const printContent = `
            <html><head><title>SaaS Invoice ${inv.invoiceNumber}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; }
                h1 { font-size: 1.8rem; margin-bottom: 4px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
                th { background: #f5f5f5; font-weight: 600; font-size: 0.85rem; }
                .total { font-weight: 700; font-size: 1.1rem; text-align: right; margin-top: 16px; }
            </style></head><body>
            <h1>Invoice ${inv.invoiceNumber}</h1>
            <p>Tenant: <strong>${inv.tenantName}</strong> (${inv.tenantEmail}) | Status: ${inv.displayStatus}</p>
            <p>Issued: ${formatDate(inv.createdAt)} | Due: ${formatDate(inv.dueDate)}</p>
            <table>
                <thead><tr><th>Description</th><th>Total</th></tr></thead>
                <tbody>
                    <tr>
                        <td>SaaS License - ${inv.planName}</td>
                        <td>${inv.amount.toLocaleString()} TZS</td>
                    </tr>
                </tbody>
            </table>
            <div class="total">Total: ${inv.amount.toLocaleString()} TZS</div>
            </body></html>
        `;
        const w = window.open('', '_blank');
        if (w) { w.document.write(printContent); w.document.close(); w.print(); }
    };

    const filtered = invoices.filter(inv => {
        const matchSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.tenantName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'All' || inv.displayStatus === statusFilter;
        return matchSearch && matchStatus;
    });

    const totalPaid = invoices.filter(i => i.displayStatus === 'Paid').reduce((s, i) => s + i.amount, 0);
    const totalUnpaid = invoices.filter(i => i.displayStatus === 'Unpaid').reduce((s, i) => s + i.amount, 0);
    const totalOverdue = invoices.filter(i => i.displayStatus === 'Overdue').reduce((s, i) => s + i.amount, 0);

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                        <ReceiptIcon />
                    </div>
                    <div>
                        <h1 className="page-title">SaaS Invoices</h1>
                        <p className="page-subtitle">Manage and track tenant license invoices</p>
                    </div>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid-3 gap-16" style={{ marginBottom: 24 }}>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--secondary)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Paid</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--secondary)', marginTop: 4 }}>{totalPaid.toLocaleString()} TZS</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{invoices.filter(i => i.displayStatus === 'Paid').length} invoices</div>
                </div>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--warning)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unpaid</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)', marginTop: 4 }}>{totalUnpaid.toLocaleString()} TZS</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{invoices.filter(i => i.displayStatus === 'Unpaid').length} invoices</div>
                </div>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Overdue</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)', marginTop: 4 }}>{totalOverdue.toLocaleString()} TZS</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{invoices.filter(i => i.displayStatus === 'Overdue').length} invoices</div>
                </div>
            </div>

            <div className="card">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="All">All Status</option>
                            <option value="Paid">Paid</option>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Active">Active</option>
                            <option value="Trial">Trial</option>
                            <option value="Suspended">Suspended</option>
                        </select>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input placeholder="Search tenant or invoice..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Tenant Name</th>
                                <th>Plan</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Issued Date</th>
                                <th>Due Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading invoices...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No invoices found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(inv => (
                                    <tr key={inv.id}>
                                        <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoiceNumber}</span></td>
                                        <td style={{ fontWeight: 500 }}>{inv.tenantName}</td>
                                        <td>{inv.planName}</td>
                                        <td style={{ fontWeight: 600 }}>{inv.amount.toLocaleString()} TZS</td>
                                        <td>
                                            <span className={`badge ${inv.displayStatus === 'Paid' || inv.displayStatus === 'Active' ? 'active' : inv.displayStatus === 'Overdue' ? 'expired' : 'inactive'}`}>
                                                {inv.displayStatus}
                                            </span>
                                        </td>
                                        <td>{formatDate(inv.createdAt)}</td>
                                        <td style={{ color: inv.displayStatus === 'Overdue' ? 'var(--danger)' : 'inherit' }}>{formatDate(inv.dueDate)}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon sync" title="Print" onClick={() => handlePrintInvoice(inv)}><PrintIcon style={{ fontSize: 16 }} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
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
