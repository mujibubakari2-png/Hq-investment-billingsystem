import { useState, useEffect, useCallback } from 'react';
import PeopleIcon from '@mui/icons-material/People';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import SortIcon from '@mui/icons-material/UnfoldMore';
import { clientsApi } from '../api/client';
import AddClientModal from '../modals/AddClientModal';
import EditClientModal from '../modals/EditClientModal';
import ViewClientModal from '../modals/ViewClientModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import type { Client } from '../types';

export default function Clients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('Active');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [entriesPerPage, setEntriesPerPage] = useState(25);
    const [page, setPage] = useState(1);
    const [viewClient, setViewClient] = useState<Client | null>(null);
    const [editClient, setEditClient] = useState<Client | null>(null);
    const [deleteClient, setDeleteClient] = useState<Client | null>(null);

    const fetchClients = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {
                page: String(page),
                limit: String(entriesPerPage),
            };
            if (statusFilter && statusFilter !== 'All') params.status = statusFilter.toUpperCase();
            if (searchTerm) params.search = searchTerm;

            const res = await clientsApi.list(params);
            setClients(res.data as unknown as Client[]);
            setTotal(res.total);
        } catch (err) {
            console.error('Failed to fetch clients:', err);
        } finally {
            setLoading(false);
        }
    }, [page, entriesPerPage, statusFilter, searchTerm]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const handleDelete = async () => {
        if (!deleteClient) return;
        try {
            await clientsApi.delete(deleteClient.id);
            setDeleteClient(null);
            fetchClients();
        } catch (err) {
            console.error('Failed to delete client:', err);
        }
    };

    const handleAddClient = async (data: Record<string, unknown>) => {
        try {
            await clientsApi.create(data);
            setShowAddModal(false);
            fetchClients();
        } catch (err) {
            console.error('Failed to add client:', err);
        }
    };

    const handleEditClient = async (updated: Client) => {
        try {
            await clientsApi.update(updated.id, updated as unknown as Record<string, unknown>);
            setEditClient(null);
            fetchClients();
        } catch (err) {
            console.error('Failed to edit client:', err);
        }
    };

    const totalPages = Math.ceil(total / entriesPerPage);

    return (
        <div>
            {viewClient && <ViewClientModal client={viewClient} onClose={() => setViewClient(null)} onEdit={() => { setEditClient(viewClient); setViewClient(null); }} />}
            {editClient && <EditClientModal client={editClient} onClose={() => { setEditClient(null); fetchClients(); }} onSave={handleEditClient} />}
            {deleteClient && <ConfirmDeleteModal title="Delete Client" message="Are you sure you want to delete this client? This will permanently remove all associated data." onClose={() => setDeleteClient(null)} onConfirm={handleDelete} />}
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon">
                        <PeopleIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Customer Management</h1>
                        <p className="page-subtitle">All clients including both PPPoE and Hotspot clients</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <AddIcon fontSize="small" /> Add Client
                    </button>
                </div>
            </div>

            {/* Card with table */}
            <div className="card">
                {/* Toolbar */}
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="status-dropdown">
                            <label>Status:</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                                className="select-field"
                            >
                                <option value="Active">Active</option>
                                <option value="All">All</option>
                                <option value="Banned">Banned</option>
                                <option value="Disabled">Disabled</option>
                                <option value="Expired">Expired</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Limited">Limited</option>
                                <option value="Suspended">Suspended</option>
                            </select>
                        </div>
                        <div className="show-entries">
                            <select
                                value={entriesPerPage}
                                onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setPage(1); }}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                            const csvContent = 'Full Name,Phone,Service Type,Status,Created On\n' +
                                clients.map(c => `"${c.fullName}","${c.phone}","${c.serviceType || ''}","${c.status || ''}","${c.createdOn}"`).join('\n');
                            const blob = new Blob([csvContent], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'clients_export.csv';
                            a.click();
                            URL.revokeObjectURL(url);
                        }}>
                            <FileDownloadIcon fontSize="small" /> Export
                        </button>
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search customers..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>
                                        Full Name <SortIcon style={{ fontSize: 14, verticalAlign: 'middle' }} />
                                    </th>
                                    <th>Phone</th>
                                    <th>Service Type</th>
                                    <th>
                                        Created On <SortIcon style={{ fontSize: 14, verticalAlign: 'middle' }} />
                                    </th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map((client) => (
                                    <tr key={client.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div className="user-avatar red">
                                                    {client.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>{client.fullName}</div>
                                                    {client.plan && (
                                                        <span className="cell-sub">{client.plan}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <PhoneIcon style={{ fontSize: 14, color: 'var(--text-muted)' }} />
                                                {client.phone}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${client.serviceType ? client.serviceType.toLowerCase() : 'unknown'}`}>
                                                {client.serviceType || 'Unknown'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                📅 {client.createdOn}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon view" title="View" onClick={() => setViewClient(client)}>
                                                    <VisibilityIcon style={{ fontSize: 16 }} />
                                                </button>
                                                <button className="btn-icon edit" title="Edit" onClick={() => setEditClient(client)}>
                                                    <EditIcon style={{ fontSize: 16 }} />
                                                </button>
                                                <button className="btn-icon delete" title="Delete" onClick={() => setDeleteClient(client)}>
                                                    <DeleteIcon style={{ fontSize: 16 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="pagination">
                    <div className="pagination-info">
                        Showing {Math.min((page - 1) * entriesPerPage + 1, total)} to {Math.min(page * entriesPerPage, total)} of{' '}
                        {total} entries
                    </div>
                    <div className="pagination-buttons">
                        <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(p => (
                            <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                        ))}
                        <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                </div>
            </div>

            {/* Add Client Modal */}
            {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} onSave={handleAddClient} />}
        </div>
    );
}
