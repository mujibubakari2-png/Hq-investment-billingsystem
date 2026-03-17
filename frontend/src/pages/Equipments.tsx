import { useState, useEffect } from 'react';
import DevicesIcon from '@mui/icons-material/Devices';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import AddEquipmentModal from '../modals/AddEquipmentModal';
import EditEquipmentModal from '../modals/EditEquipmentModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import { equipmentApi } from '../api/client';
import type { Equipment } from '../types';

export default function Equipments() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [editEquipment, setEditEquipment] = useState<Equipment | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchEquipment = async () => {
        setLoading(true);
        try {
            const data = await equipmentApi.list();
            setEquipmentList(data as unknown as Equipment[]);
        } catch (err) {
            console.error('Failed to load equipment:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEquipment();
    }, []);

    const filtered = equipmentList.filter(eq =>
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEditEquipment = async (updated: Equipment) => {
        try {
            await equipmentApi.update(updated.id, updated as unknown as Record<string, unknown>);
            setEditEquipment(null);
            fetchEquipment();
        } catch (err) {
            console.error('Failed to update equipment:', err);
            alert('Failed to update equipment.');
        }
    };

    return (
        <div>
            {showAddModal && <AddEquipmentModal onClose={() => setShowAddModal(false)} onSave={async (data) => {
                try {
                    await equipmentApi.create(data as Record<string, unknown>);
                    setShowAddModal(false);
                    fetchEquipment();
                } catch (err) {
                    console.error('Failed to add equipment:', err);
                    alert('Failed to add equipment.');
                }
            }} />}
            {editEquipment && (
                <EditEquipmentModal
                    equipment={editEquipment}
                    onClose={() => setEditEquipment(null)}
                    onSave={handleEditEquipment}
                />
            )}
            {deleteId && (
                <ConfirmDeleteModal
                    title="Remove Equipment"
                    message="Are you sure you want to remove this equipment from inventory?"
                    confirmLabel="Remove"
                    onClose={() => setDeleteId(null)}
                    onConfirm={async () => {
                        try {
                            await equipmentApi.delete(deleteId);
                            setDeleteId(null);
                            fetchEquipment();
                        } catch (err) {
                            console.error('Failed to remove equipment:', err);
                            alert('Failed to remove equipment.');
                        }
                    }}
                />
            )}

            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--teal-light)', color: 'var(--teal)' }}>
                        <DevicesIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Equipments</h1>
                        <p className="page-subtitle">Manage your network equipment inventory</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <AddIcon fontSize="small" /> Add Equipment
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="show-entries">
                            Show <select><option>10</option><option>25</option></select> entries
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input placeholder="Search equipment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Serial Number</th>
                                <th>Status</th>
                                <th>Location</th>
                                <th>Assigned To</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading equipment...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No equipment found.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(eq => (
                                    <tr key={eq.id}>
                                        <td style={{ fontWeight: 500 }}>{eq.name}</td>
                                        <td>{eq.type}</td>
                                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{eq.serialNumber}</span></td>
                                        <td><span className={`badge ${eq.status === 'Active' ? 'active' : eq.status === 'Maintenance' ? 'expired' : 'inactive'}`}>{eq.status}</span></td>
                                        <td>{eq.location}</td>
                                        <td>{eq.assignedTo || '—'}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon edit" onClick={() => setEditEquipment(eq)}><EditIcon style={{ fontSize: 16 }} /></button>
                                                <button className="btn-icon delete" onClick={() => setDeleteId(eq.id)}>
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
                    <div className="pagination-info">Showing 1 to {filtered.length} of {equipmentList.length} entries</div>
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
