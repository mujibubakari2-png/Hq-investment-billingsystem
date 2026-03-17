import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import InventoryIcon from '@mui/icons-material/Inventory';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { packagesApi } from '../api/client';
import type { Package } from '../types';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import AddPackageModal from '../modals/AddPackageModal';

export default function Packages() {
    const navigate = useNavigate();
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('All Types');
    const [statusFilter, setStatusFilter] = useState('All Status');
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const fetchPackages = async () => {
        setLoading(true);
        try {
            const data = await packagesApi.list();
            setPackages(data as unknown as Package[]);
        } catch (err) { console.error('Failed to load packages:', err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchPackages(); }, []);

    const handleDelete = async () => {
        if (!deleteId) return;
        try { await packagesApi.delete(deleteId); setDeleteId(null); fetchPackages(); }
        catch (err) { console.error('Failed to delete package:', err); }
    };

    const handleAddPackage = async (data: any) => {
        try {
            await packagesApi.create(data);
            setShowAddModal(false);
            fetchPackages();
        } catch (err) {
            console.error('Failed to create package:', err);
            alert('Failed to create package. Check required fields.');
        }
    };

    const filtered = packages.filter(pkg => {
        const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'All Types' || pkg.type === typeFilter;
        const matchesStatus = statusFilter === 'All Status' || pkg.status === statusFilter;
        return matchesSearch && matchesType && matchesStatus;
    });

    return (
        <div>
            {showAddModal && <AddPackageModal onClose={() => setShowAddModal(false)} onSave={handleAddPackage} />}
            {deleteId && (
                <ConfirmDeleteModal
                    title="Delete Package"
                    message="Are you sure you want to delete this package? All associated data will be affected."
                    onClose={() => setDeleteId(null)}
                    onConfirm={handleDelete}
                />
            )}

            {loading && <div className="loading-indicator" style={{ textAlign: 'center', padding: '2rem' }}>Loading packages...</div>}

            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon">
                        <InventoryIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Packages</h1>
                        <p className="page-subtitle">Manage your service packages</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <AddIcon fontSize="small" /> Add Package
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input type="text" placeholder="Search packages..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <select className="select-field" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            <option>All Types</option>
                            <option>Hotspot</option>
                            <option>PPPoE</option>
                        </select>
                        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option>All Status</option>
                            <option>Active</option>
                            <option>Inactive</option>
                        </select>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Package Name</th>
                                <th>Type</th>
                                <th>Bandwidth</th>
                                <th>Price</th>
                                <th>Router</th>
                                <th>Validity</th>
                                <th>Devices</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(pkg => (
                                <tr key={pkg.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div className="user-avatar purple" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>
                                                {pkg.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{pkg.name}</div>
                                                <span className="cell-sub">{pkg.category}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span className={`badge ${pkg.type.toLowerCase()}`}>{pkg.type}</span></td>
                                    <td>📊 {pkg.bandwidth}</td>
                                    <td>💰 {pkg.price.toLocaleString()} TZS</td>
                                    <td>🖥️ {pkg.router}</td>
                                    <td>⏱️ {pkg.validity}</td>
                                    <td>{pkg.devices ?? '—'}</td>
                                    <td><span className={`badge ${pkg.status.toLowerCase()}`}>{pkg.status}</span></td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="btn-icon edit" title="Edit" onClick={() => navigate(`/edit-package/${pkg.id}`)}>
                                                <EditIcon style={{ fontSize: 16 }} />
                                            </button>
                                            <button className="btn-icon delete" title="Delete" onClick={() => setDeleteId(pkg.id)}>
                                                <DeleteIcon style={{ fontSize: 16 }} />
                                            </button>
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
                        <button className="pagination-btn">Prev</button>
                        <button className="pagination-btn active">1</button>
                        <button className="pagination-btn">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
