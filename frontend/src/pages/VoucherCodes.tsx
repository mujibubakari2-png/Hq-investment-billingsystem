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
import RouterIcon from '@mui/icons-material/Router';
import { vouchersApi } from '../api/client';
import type { Voucher } from '../types';
import GenerateVouchersModal from '../modals/GenerateVouchersModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import EditVoucherModal from '../modals/EditVoucherModal';

export default function VoucherCodes() {
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [routerFilter, setRouterFilter] = useState('All Routers');
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [editTargetId, setEditTargetId] = useState<string | null>(null);
    const [bulkDeleteStatus, setBulkDeleteStatus] = useState('Used');
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [entriesPerPage, setEntriesPerPage] = useState<number | 'All'>(10);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, routerFilter, entriesPerPage]);

    const fetchVouchers = async () => {
        setLoading(true);
        try {
            const res = await vouchersApi.list({ limit: '1000' });
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
        } catch (err) {
            console.error('Failed to revoke voucher', err);
            alert('Failed to revoke voucher');
        }
    };

    const handleBulkDelete = async () => {
        try {
            const isCheckboxSelection = selected.length > 0;
            const vouchersToDelete = isCheckboxSelection
                ? vouchers.filter(v => selected.includes(v.id))
                : vouchers.filter(v => v.status === bulkDeleteStatus);

            if (vouchersToDelete.length === 0) {
                alert(`No ${isCheckboxSelection ? 'selected' : bulkDeleteStatus} vouchers found to delete.`);
                setShowDeleteAllModal(false);
                return;
            }

            // Chunk deletions to avoid overwhelming backend/Prisma connection pool
            const chunkSize = 5;
            for (let i = 0; i < vouchersToDelete.length; i += chunkSize) {
                const chunk = vouchersToDelete.slice(i, i + chunkSize);
                await Promise.all(chunk.map(v => vouchersApi.delete(v.id)));
            }

            setShowDeleteAllModal(false);
            if (isCheckboxSelection) setSelected([]);
            fetchVouchers();
            alert(`${isCheckboxSelection ? 'Selected' : bulkDeleteStatus} vouchers deleted successfully!`);
        } catch (err) {
            console.error('Failed to mass-delete vouchers', err);
            alert('Failed to delete vouchers. Some may have been removed before the process failed.');
        }
    };

    const uniqueRouters = Array.from(new Set(vouchers.map(v => v.router || 'Unassigned')));

    const filtered = vouchers.filter(v => {
        const matchSearch = (v.code || '').includes(searchTerm) || (v.plan || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'All' || v.status === statusFilter;
        const routerName = v.router || 'Unassigned';
        const matchRouter = routerFilter === 'All Routers' || routerName === routerFilter;
        return matchSearch && matchStatus && matchRouter;
    });

    const unusedCount = vouchers.filter(v => v.status === 'Unused').length;
    const usedCount = vouchers.filter(v => v.status === 'Used').length;

    // Pagination Calculation
    const totalPages = entriesPerPage === 'All' ? 1 : Math.max(1, Math.ceil(filtered.length / entriesPerPage));
    const paginatedVouchers = entriesPerPage === 'All'
        ? filtered
        : filtered.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

    const toggleSelect = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };
    const toggleAll = () => {
        setSelected(prev => prev.length === paginatedVouchers.length ? [] : paginatedVouchers.map(v => v.id));
    };

    return (
        <div>
            {showGenerateModal && <GenerateVouchersModal onClose={() => setShowGenerateModal(false)} onGenerate={handleGenerate} />}
            {showEditModal && editTargetId && (
                <EditVoucherModal
                    voucher={vouchers.find(v => v.id === editTargetId) as Voucher}
                    onClose={() => setShowEditModal(false)}
                    onSave={fetchVouchers}
                />
            )}
            {showDeleteAllModal && (
                <ConfirmDeleteModal
                    title={`Delete ${selected.length > 0 ? selected.length + ' Selected' : 'All ' + bulkDeleteStatus} Vouchers`}
                    message={`This will permanently delete ${selected.length > 0 ? 'the selected' : 'all ' + bulkDeleteStatus.toLowerCase()} vouchers. This action cannot be undone.`}
                    confirmLabel={`Delete ${selected.length > 0 ? 'Selected' : 'All ' + bulkDeleteStatus}`}
                    onClose={() => setShowDeleteAllModal(false)}
                    onConfirm={handleBulkDelete}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select className="select-field" value={bulkDeleteStatus} onChange={(e) => setBulkDeleteStatus(e.target.value)} style={{ height: 36, padding: '4px 8px' }} disabled={selected.length > 0}>
                            <option value="Used">Used</option>
                            <option value="Unused">Unused</option>
                            <option value="Expired">Expired</option>
                            <option value="Revoked">Revoked</option>
                        </select>
                        <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => setShowDeleteAllModal(true)}>
                            <DeleteIcon fontSize="small" /> {selected.length > 0 ? `Delete Selected (${selected.length})` : `Delete All ${bulkDeleteStatus}`}
                        </button>
                    </div>
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
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="show-entries">
                            Show
                            <select
                                value={entriesPerPage}
                                onChange={e => setEntriesPerPage(e.target.value === 'All' ? 'All' : Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="All">All</option>
                            </select> entries
                        </div>
                        <select className="select-field" value={routerFilter} onChange={e => setRouterFilter(e.target.value)}>
                            {['All Routers', ...uniqueRouters].map(r => (
                                <option key={r} value={r}>
                                    {r} {r === 'All Routers' ? `(${vouchers.length})` : `(${vouchers.filter(v => (v.router || 'Unassigned') === r).length})`}
                                </option>
                            ))}
                        </select>
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
                                        {selected.length === paginatedVouchers.length && paginatedVouchers.length > 0 ? <CheckBoxIcon style={{ fontSize: 18, color: 'var(--primary)' }} /> : <CheckBoxOutlineBlankIcon style={{ fontSize: 18 }} />}
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
                            ) : paginatedVouchers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No vouchers found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedVouchers.map(v => (
                                    <tr key={v.id}>
                                        <td>
                                            <button className="btn-icon" onClick={() => toggleSelect(v.id)} style={{ background: 'none' }}>
                                                {selected.includes(v.id) ? <CheckBoxIcon style={{ fontSize: 18, color: 'var(--primary)' }} /> : <CheckBoxOutlineBlankIcon style={{ fontSize: 18 }} />}
                                            </button>
                                        </td>
                                        <td><span className="badge hotspot">{v.packageType || 'Hotspot'}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <RouterIcon style={{ fontSize: 18, color: 'var(--text-secondary)' }} />
                                                <span>{v.router}</span>
                                            </div>
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
                                                <button
                                                    className="btn-icon sync"
                                                    title="Copy Code"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(v.code);
                                                        alert(`Voucher code ${v.code} copied!`);
                                                    }}
                                                >
                                                    <ContentCopyIcon style={{ fontSize: 16 }} />
                                                </button>
                                                <button
                                                    className="btn-icon edit"
                                                    title="Edit"
                                                    onClick={() => {
                                                        setEditTargetId(v.id);
                                                        setShowEditModal(true);
                                                    }}
                                                >
                                                    <EditIcon style={{ fontSize: 16 }} />
                                                </button>
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
                    <div className="pagination-info">
                        Showing {filtered.length === 0 ? 0 : (currentPage - 1) * (entriesPerPage === 'All' ? filtered.length : entriesPerPage) + 1} to {entriesPerPage === 'All' ? filtered.length : Math.min(currentPage * entriesPerPage, filtered.length)} of {filtered.length} entries (filtered from {vouchers.length} total)
                    </div>
                    <div className="pagination-buttons">
                        <button
                            className="pagination-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                        >
                            Previous
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                                onClick={() => setCurrentPage(page)}
                            >
                                {page}
                            </button>
                        ))}

                        <button
                            className="pagination-btn"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
