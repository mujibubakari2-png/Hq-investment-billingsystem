import { useState, useEffect } from 'react';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import DeleteIcon from '@mui/icons-material/Delete';
import { invoicesApi } from '../api/client';
import type { Invoice } from '../types';
import CreateInvoiceModal from '../modals/CreateInvoiceModal';
import ViewInvoiceModal from '../modals/ViewInvoiceModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import { formatDate } from '../utils/formatters';

export default function Invoices() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await invoicesApi.list();
            setInvoices((res.data || []) as unknown as Invoice[]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleDelete = async (id: string) => {
        try {
            await invoicesApi.delete(id);
            setDeleteInvoice(null);
            fetchInvoices();
        } catch (err) {
            console.error('Failed to delete invoice:', err);
        }
    };

    const handleCreateInvoice = async (data: Record<string, unknown>) => {
        try {
            await invoicesApi.create(data);
            setShowCreateModal(false);
            fetchInvoices();
        } catch (err) {
            console.error('Failed to create invoice:', err);
            alert('Failed to create invoice.');
        }
    };

    const handlePrintInvoice = (inv: Invoice) => {
        const itemsHtml = (inv.items || []).map(item =>
            '<tr><td>' + item.description + '</td><td>' + item.quantity + '</td><td>' + item.unitPrice.toLocaleString() + ' TZS</td><td>' + item.total.toLocaleString() + ' TZS</td></tr>'
        ).join('');
        const printContent = `
            <html><head><title>Invoice ${inv.invoiceNumber}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; }
                h1 { font-size: 1.8rem; margin-bottom: 4px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
                th { background: #f5f5f5; font-weight: 600; font-size: 0.85rem; }
                .total { font-weight: 700; font-size: 1.1rem; text-align: right; margin-top: 16px; }
            </style></head><body>
            <h1>Invoice ${inv.invoiceNumber}</h1>
            <p>Client: <strong>${inv.client}</strong> | Status: ${inv.status}</p>
            <p>Issued: ${formatDate(inv.issuedDate)} | Due: ${formatDate(inv.dueDate)}</p>
            <table>
                <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="total">Total: ${inv.amount.toLocaleString()} TZS</div>
            </body></html>
        `;
        const w = window.open('', '_blank');
        if (w) { w.document.write(printContent); w.document.close(); w.print(); }
    };

    const filtered = invoices.filter(inv => {
        const matchSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || inv.client.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'All' || inv.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
    const totalUnpaid = invoices.filter(i => i.status === 'Unpaid').reduce((s, i) => s + i.amount, 0);
    const totalOverdue = invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0);

    return (
        <div>
            {showCreateModal && (
                <CreateInvoiceModal
                    onClose={() => setShowCreateModal(false)}
                    onSave={handleCreateInvoice}
                />
            )}
            {viewInvoice && (
                <ViewInvoiceModal
                    invoice={viewInvoice}
                    onClose={() => setViewInvoice(null)}
                />
            )}
            {deleteInvoice && (
                <ConfirmDeleteModal
                    title="Delete Invoice"
                    message={`Are you sure you want to delete invoice ${deleteInvoice.invoiceNumber}? This action cannot be undone.`}
                    onClose={() => setDeleteInvoice(null)}
                    onConfirm={() => handleDelete(deleteInvoice.id)}
                />
            )}

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
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <AddIcon fontSize="small" /> Create Invoice
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid-3 gap-16" style={{ marginBottom: 24 }}>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--secondary)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Paid</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--secondary)', marginTop: 4 }}>{totalPaid.toLocaleString()} TZS</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{invoices.filter(i => i.status === 'Paid').length} invoices</div>
                </div>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--warning)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unpaid</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)', marginTop: 4 }}>{totalUnpaid.toLocaleString()} TZS</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{invoices.filter(i => i.status === 'Unpaid').length} invoices</div>
                </div>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Overdue</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)', marginTop: 4 }}>{totalOverdue.toLocaleString()} TZS</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{invoices.filter(i => i.status === 'Overdue').length} invoices</div>
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
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading invoices...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No invoices found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(inv => (
                                    <tr key={inv.id}>
                                        <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoiceNumber}</span></td>
                                        <td style={{ fontWeight: 500 }}>{inv.client}</td>
                                        <td style={{ fontWeight: 600 }}>{inv.amount.toLocaleString()} TZS</td>
                                        <td>
                                            <span className={`badge ${inv.status === 'Paid' ? 'active' : inv.status === 'Overdue' ? 'expired' : 'inactive'}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td>{formatDate(inv.issuedDate)}</td>
                                        <td style={{ color: inv.status === 'Overdue' ? 'var(--danger)' : 'inherit' }}>{formatDate(inv.dueDate)}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon view" title="View" onClick={() => setViewInvoice(inv)}><VisibilityIcon style={{ fontSize: 16 }} /></button>
                                                <button className="btn-icon sync" title="Print" onClick={() => handlePrintInvoice(inv)}><PrintIcon style={{ fontSize: 16 }} /></button>
                                                <button className="btn-icon delete" title="Delete" onClick={() => setDeleteInvoice(inv)}>
                                                    <DeleteIcon style={{ fontSize: 16 }} />
                                                </button>
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
