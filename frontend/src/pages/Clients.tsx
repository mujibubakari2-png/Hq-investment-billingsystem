import { useState } from 'react';
import PeopleIcon from '@mui/icons-material/People';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import SortIcon from '@mui/icons-material/UnfoldMore';
import { mockClients } from '../data/mockData';
import AddClientModal from '../modals/AddClientModal';
import EditClientModal from '../modals/EditClientModal';
import ViewClientModal from '../modals/ViewClientModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import type { Client } from '../types';

export default function Clients() {
    const [statusFilter, setStatusFilter] = useState('Active');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [entriesPerPage, setEntriesPerPage] = useState(25);
    const [viewClient, setViewClient] = useState<Client | null>(null);
    const [editClient, setEditClient] = useState<Client | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const filteredClients = mockClients.filter((client) => {
        const matchesStatus = statusFilter === 'All' || client.status === statusFilter;
        const matchesSearch =
            client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.phone.includes(searchTerm);
        return matchesStatus && matchesSearch;
    });

    return (
        <div>
            {viewClient && <ViewClientModal client={viewClient} onClose={() => setViewClient(null)} onEdit={() => { setEditClient(viewClient); setViewClient(null); }} />}
            {editClient && <EditClientModal client={editClient} onClose={() => setEditClient(null)} />}
            {showDeleteModal && <ConfirmDeleteModal title="Delete Client" message="Are you sure you want to delete this client? This will permanently remove all associated data." onClose={() => setShowDeleteModal(false)} onConfirm={() => console.log('Deleted client')} />}
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
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="select-field"
                            >
                                <option value="Active">Active</option>
                                <option value="All">All</option>
                                <option value="Banned">Banned</option>
                                <option value="Disabled">Disabled</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Limited">Limited</option>
                                <option value="Suspended">Suspended</option>
                            </select>
                        </div>
                        <div className="show-entries">
                            <select
                                value={entriesPerPage}
                                onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <button className="btn btn-secondary btn-sm">
                            <FileDownloadIcon fontSize="small" /> Export
                        </button>
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search customers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
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
                            {filteredClients.map((client) => (
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
                                        <span className={`badge ${client.serviceType.toLowerCase()}`}>
                                            {client.serviceType}
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
                                            <button className="btn-icon delete" title="Delete" onClick={() => setShowDeleteModal(true)}>
                                                <DeleteIcon style={{ fontSize: 16 }} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="pagination">
                    <div className="pagination-info">
                        Showing 1 to {Math.min(entriesPerPage, filteredClients.length)} of{' '}
                        {filteredClients.length} entries
                    </div>
                    <div className="pagination-buttons">
                        <button className="pagination-btn">Previous</button>
                        <button className="pagination-btn active">1</button>
                        <button className="pagination-btn">Next</button>
                    </div>
                </div>
            </div>

            {/* Add Client Modal */}
            {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} />}
        </div>
    );
}
