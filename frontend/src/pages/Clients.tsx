/**
 * Clients page — refactored to use the shared DataTable component (RD-001).
 * All table markup, search, pagination, CSV export, and skeleton loading are
 * now handled by DataTable. This file only owns business logic and column defs.
 */
import { useState, useEffect, useCallback } from 'react';
import PeopleIcon from '@mui/icons-material/People';
import AddIcon from '@mui/icons-material/Add';
import PhoneIcon from '@mui/icons-material/Phone';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import WifiIcon from '@mui/icons-material/Wifi';
import { normalizeApiList } from '../utils/apiResponse';
import { clientsApi, radiusSyncApi } from '../api';
import { formatDate } from '../utils/formatters';
import AddClientModal from '../modals/AddClientModal';
import EditClientModal from '../modals/EditClientModal';
import ViewClientModal from '../modals/ViewClientModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import DataTable, { type Column } from '../components/DataTable';
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
    const [onlineUsernames, setOnlineUsernames] = useState<Set<string>>(new Set());
    const [radiusOnlineCount, setRadiusOnlineCount] = useState(0);

    const fetchRadiusOnline = async () => {
        try {
            const stats = await radiusSyncApi.getOnlineStats();
            setOnlineUsernames(new Set(stats.onlineUsernames || []));
            setRadiusOnlineCount(stats.totalOnline || 0);
        } catch {
            // Non-blocking
        }
    };

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
            setClients(normalizeApiList<Client>(res));
            setTotal(res.total);
        } catch (err) {
            console.error('Failed to fetch clients:', err);
        } finally {
            setLoading(false);
        }
    }, [page, entriesPerPage, statusFilter, searchTerm]);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    useEffect(() => {
        fetchRadiusOnline();
        const id = setInterval(fetchRadiusOnline, 30_000);
        return () => clearInterval(id);
    }, []);

    const handleDelete = async () => {
        if (!deleteClient) return;
        try {
            await clientsApi.delete(deleteClient.id);
            setDeleteClient(null);
            fetchClients();
        } catch (err) { console.error('Failed to delete client:', err); }
    };

    const handleAddClient = async (data: Record<string, unknown>) => {
        try {
            await clientsApi.create(data);
            setShowAddModal(false);
            fetchClients();
        } catch (err) { console.error('Failed to add client:', err); }
    };

    const handleEditClient = async (updated: Client) => {
        try {
            await clientsApi.update(updated.id, updated as unknown as Record<string, unknown>);
            setEditClient(null);
            fetchClients();
        } catch (err) { console.error('Failed to edit client:', err); }
    };

    // ── Column definitions ────────────────────────────────────────────────────
    const columns: Column<Client>[] = [
        {
            key: 'fullName',
            label: 'Full Name',
            sortable: true,
            render: (client) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="user-avatar red">
                        {client.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontWeight: 500 }}>{client.fullName}</div>
                        {client.plan && <span className="cell-sub">{client.plan}</span>}
                    </div>
                </div>
            ),
        },
        {
            key: 'phone',
            label: 'Phone',
            hideBelow: 'sm',
            render: (client) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PhoneIcon style={{ fontSize: 14, color: 'var(--text-muted)' }} />
                    {client.phone}
                </div>
            ),
        },
        {
            key: 'serviceType',
            label: 'Service Type',
            hideBelow: 'md',
            render: (client) => (
                <>
                    <span className={`badge ${client.serviceType ? client.serviceType.toLowerCase() : 'unknown'}`}>
                        {client.serviceType || 'Unknown'}
                    </span>
                    {onlineUsernames.has(client.username) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, fontSize: '0.7rem', color: '#4caf50', fontWeight: 700 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4caf50', boxShadow: '0 0 5px #4caf50', display: 'inline-block' }} />
                            Online
                        </span>
                    )}
                </>
            ),
        },
        {
            key: 'createdOn',
            label: 'Created On',
            hideBelow: 'lg',
            sortable: true,
            render: (client) => <>📅 {formatDate(client.createdOn)}</>,
        },
        {
            key: 'actions',
            label: 'Actions',
            width: '120px',
            align: 'center',
            render: (client) => (
                <div className="table-actions">
                    <button className="btn-icon view" title="View" onClick={(e) => { e.stopPropagation(); setViewClient(client); }}>
                        <VisibilityIcon style={{ fontSize: 16 }} />
                    </button>
                    <button className="btn-icon edit" title="Edit" onClick={(e) => { e.stopPropagation(); setEditClient(client); }}>
                        <EditIcon style={{ fontSize: 16 }} />
                    </button>
                    <button className="btn-icon delete" title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteClient(client); }}>
                        <DeleteIcon style={{ fontSize: 16 }} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {/* Modals */}
            {viewClient && (
                <ViewClientModal
                    client={viewClient}
                    onClose={() => setViewClient(null)}
                    onEdit={() => { setEditClient(viewClient); setViewClient(null); }}
                />
            )}
            {editClient && (
                <EditClientModal
                    client={editClient}
                    onClose={() => { setEditClient(null); fetchClients(); }}
                    onSave={handleEditClient}
                />
            )}
            {deleteClient && (
                <ConfirmDeleteModal
                    title="Delete Client"
                    message="Are you sure you want to delete this client? This will permanently remove all associated data."
                    onClose={() => setDeleteClient(null)}
                    onConfirm={handleDelete}
                />
            )}

            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon"><PeopleIcon /></div>
                    <div>
                        <h1 className="page-title">Customer Management</h1>
                        <p className="page-subtitle">All clients including both PPPoE and Hotspot clients</p>
                    </div>
                </div>
                <div className="page-header-right">
                    {radiusOnlineCount > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(76,175,80,0.12)', color: '#4caf50', borderRadius: 8, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, marginRight: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4caf50', boxShadow: '0 0 6px #4caf50', display: 'inline-block' }} />
                            <WifiIcon style={{ fontSize: 14 }} />
                            {radiusOnlineCount} clients online (RADIUS)
                        </span>
                    )}
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <AddIcon fontSize="small" /> Add Client
                    </button>
                </div>
            </div>

            {/* Data Table card */}
            <div className="card" style={{ padding: 0 }}>
                <DataTable<Client>
                    ariaLabel="Clients table"
                    columns={columns}
                    data={clients}
                    total={total}
                    loading={loading}
                    page={page}
                    onPageChange={setPage}
                    pageSize={entriesPerPage}
                    onPageSizeChange={(s) => { setEntriesPerPage(s); setPage(1); }}
                    searchValue={searchTerm}
                    onSearchChange={(v) => { setSearchTerm(v); setPage(1); }}
                    emptyMessage="No clients found. Add your first client to get started."
                    csvExport={{
                        filename: 'clients_export',
                        headers: ['Full Name', 'Phone', 'Service Type', 'Status', 'Created On'],
                        rowMapper: (c) => [c.fullName, c.phone, c.serviceType || '', c.status || '', formatDate(c.createdOn)],
                    }}
                    toolbarLeft={
                        <div className="status-dropdown">
                            <label>Status:</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                                className="select-field"
                            >
                                {['Active', 'All', 'Banned', 'Disabled', 'Expired', 'Inactive', 'Limited', 'Suspended'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    }
                />
            </div>

            {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} onSave={handleAddClient} />}
        </div>
    );
}
