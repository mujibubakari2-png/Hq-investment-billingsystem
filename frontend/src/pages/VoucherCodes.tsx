import { useState, useEffect } from 'react';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PrintIcon from '@mui/icons-material/Print';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { vouchersApi } from '../api/client';
import type { Voucher } from '../types';
import GenerateVouchersModal from '../modals/GenerateVouchersModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';

export default function VoucherCodes() {
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [routerFilter, setRouterFilter] = useState('All Routers');
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchVouchers = async () => {
        setLoading(true);
        try {
            const res = await vouchersApi.list();
            setVouchers((res.data || []) as unknown as Voucher[]);
        } catch (err) {
            console.error('Failed to fetch vouchers', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVouchers();
    }, []);

    const handleGenerate = async (data: any) => {
        try {
            await vouchersApi.generate(data);
            setShowGenerateModal(false);
            fetchVouchers();
        } catch (err) {
            console.error('Failed to generate vouchers', err);
        }
    };

    const handleRevoke = async () => {
        if (!deleteTargetId) return;
        try {
            await vouchersApi.delete(deleteTargetId);
            setDeleteTargetId(null);
            setShowDeleteModal(false);
            fetchVouchers();
            alert('Voucher revoked successfully!');
        } catch (err) {
            console.error('Failed to revoke voucher', err);
            alert('Failed to revoke voucher');
        }
    };

    const handleDeleteAllUsed = async () => {
        try {
            // Note: in a real environment this would be a custom API method, here we loop delete for MVP
            const usedVouchers = vouchers.filter(v => v.status === 'Used');
            await Promise.all(usedVouchers.map(v => vouchersApi.delete(v.id)));
            setShowDeleteAllModal(false);
            fetchVouchers();
            alert('Used vouchers deleted successfully!');
        } catch (err) {
            console.error('Failed to mass-delete used vouchers', err);
            alert('Failed to mass-delete used vouchers');
        }
    };

    const uniqueRouters = Array.from(new Set(vouchers.map(v => v.router)));

    const filtered = vouchers.filter(v => {
        const matchSearch = v.code.includes(searchTerm) || v.plan.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'All' || v.status === statusFilter;
        const matchRouter = routerFilter === 'All Routers' || v.router === routerFilter;
        return matchSearch && matchStatus && matchRouter;
    });

    const unusedCount = vouchers.filter(v => v.status === 'Unused').length;
    const usedCount = vouchers.filter(v => v.status === 'Used').length;

    const toggleSelect = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };
    const toggleAll = () => {
        setSelected(prev => prev.length === filtered.length ? [] : filtered.map(v => v.id));
    };

    return (
        <div>
            {showGenerateModal && <GenerateVouchersModal onClose={() => setShowGenerateModal(false)} onGenerate={handleGenerate} />}
            {showDeleteAllModal && (
                <ConfirmDeleteModal
                    title="Delete All Used Vouchers"
                    message="This will permanently delete all used vouchers. This action cannot be undone."
                    confirmLabel="Delete All Used"
                    onClose={() => setShowDeleteAllModal(false)}
                    onConfirm={handleDeleteAllUsed}
                />
            )}
            {showDeleteModal && (
                <ConfirmDeleteModal
                    title="Revoke Voucher"
                    message="Are you sure you want to revoke this voucher?"
                    confirmLabel="Revoke"
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={handleRevoke}
                />
            )}

            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
                        <ConfirmationNumberIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Voucher Codes</h1>
                        <p className="page-subtitle">Manage voucher codes for customer plans</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => setShowGenerateModal(true)}>
                        <AddIcon fontSize="small" /> Add Voucher
                    </button>
                    <button className="btn btn-secondary" onClick={() => {
                        const printVouchers = selected.length > 0 ? filtered.filter(v => selected.includes(v.id)) : filtered;
                        const rows = printVouchers.map(v =>
                            '<tr><td>' + v.code + '</td><td>' + v.plan + '</td><td>' + v.router + '</td><td>' + v.status + '</td></tr>'
                        ).join('');
                        const html = `<html><head><title>Voucher Codes</title><style>
                            body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
                            th { background: #f5f5f5; font-weight: 600; }
                            .code { font-family: monospace; font-weight: 700; letter-spacing: 2px; }
                        </style></head><body>
                            <h2>Voucher Codes</h2>
                            <table><thead><tr><th>Code</th><th>Plan</th><th>Router</th><th>Status</th></tr></thead>
                            <tbody>${rows}</tbody></table>
                        </body></html>`;
                        const w = window.open('', '_blank');
                        if (w) { w.document.write(html); w.document.close(); w.print(); }
                    }}>
                        <PrintIcon fontSize="small" /> Print
                    </button>
                    <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => setShowDeleteAllModal(true)}>
                        <DeleteIcon fontSize="small" /> Delete All Used
                    </button>
                </div>
            </div>

            {/* Summary stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius)', padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', color: '#2e7d32', fontWeight: 700 }}>✓</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#2e7d32' }}>{unusedCount}</div>
                    <div style={{ color: '#388e3c', fontWeight: 500 }}>Total Unused Vouchers</div>
                </div>
                <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 'var(--radius)', padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', color: '#c62828', fontWeight: 700 }}>✗</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#c62828' }}>{usedCount}</div>
                    <div style={{ color: '#d32f2f', fontWeight: 500 }}>Total Used Vouchers</div>
                </div>
            </div>

            <div className="card">
                {/* Filter by Router chips */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Filter by Router</div>
                    <div className="filter-chips">
                        {['All Routers', ...uniqueRouters].map(r => (
                            <button
                                key={r}
                                className={`filter-chip ${routerFilter === r ? 'active' : ''}`}
                                onClick={() => setRouterFilter(r)}
                            >
                                {r} {r === 'All Routers' ? `(${vouchers.length})` : `(${vouchers.filter(v => v.router === r).length})`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="show-entries">
                            Show <select><option>10</option><option>25</option><option>50</option></select> entries
                        </div>
                        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="All">All Status</option>
                            <option value="Unused">Unused</option>
                            <option value="Used">Used</option>
                            <option value="Expired">Expired</option>
                            <option value="Revoked">Revoked</option>
                        </select>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input placeholder="Search vouchers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <button className="btn-icon" onClick={toggleAll} style={{ background: 'none' }}>
                                        {selected.length === filtered.length && filtered.length > 0 ? <CheckBoxIcon style={{ fontSize: 18, color: 'var(--primary)' }} /> : <CheckBoxOutlineBlankIcon style={{ fontSize: 18 }} />}
                                    </button>
                                </th>
                                <th>Type</th>
                                <th>Routers</th>
                                <th>Plan Name</th>
                                <th>Code Voucher</th>
                                <th>Status Voucher</th>
                                <th>Customer</th>
                                <th>Generated By</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading vouchers...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No vouchers found.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(v => (
                                    <tr key={v.id}>
                                        <td>
                                            <button className="btn-icon" onClick={() => toggleSelect(v.id)} style={{ background: 'none' }}>
                                                {selected.includes(v.id) ? <CheckBoxIcon style={{ fontSize: 18, color: 'var(--primary)' }} /> : <CheckBoxOutlineBlankIcon style={{ fontSize: 18 }} />}
                                            </button>
                                        </td>
                                        <td><span className="badge hotspot">{v.packageType || 'Hotspot'}</span></td>
                                        <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 16 }}>🖥️</span>{v.router}
                                        </td>
                                        <td>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>🎫 {v.plan}</span>
                                        </td>
                                        <td>
                                            <span style={{ display: 'inline-block', background: '#222', color: '#fff', padding: '2px 14px', borderRadius: 3, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 }}>
                                                {v.code}
                                            </span>
                                        </td>
                                        <td><span className={`badge ${v.status === 'Used' ? 'expired' : v.status === 'Unused' ? 'active' : 'inactive'}`}>{v.status}</span></td>
                                        <td>{v.customer ?? '—'}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {v.createdBy}
                                                <span className="badge active" style={{ padding: '1px 6px', fontSize: '0.65rem' }}>A</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon sync" title="Copy Code" onClick={() => navigator.clipboard.writeText(v.code)}>
                                                    <ContentCopyIcon style={{ fontSize: 16 }} />
                                                </button>
                                                <button className="btn-icon edit" title="Edit" onClick={() => alert(`Voucher ${v.code} - Plan: ${v.plan}, Router: ${v.router}, Status: ${v.status}`)}><EditIcon style={{ fontSize: 16 }} /></button>
                                                <button
                                                    className="btn-icon delete"
                                                    title="Revoke"
                                                    onClick={() => {
                                                        setDeleteTargetId(v.id);
                                                        setShowDeleteModal(true);
                                                    }}
                                                >
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
                    <div className="pagination-info">Showing 1 to {filtered.length} of {vouchers.length} entries</div>
                    <div className="pagination-buttons">
                        <button className="pagination-btn">Previous</button>
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
