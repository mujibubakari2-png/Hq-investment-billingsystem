import { useState } from 'react';
import DevicesIcon from '@mui/icons-material/Devices';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import AddEquipmentModal from '../modals/AddEquipmentModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';

interface Equipment {
    id: string;
    name: string;
    type: string;
    serialNumber: string;
    status: 'Active' | 'Inactive' | 'Maintenance';
    location: string;
    assignedTo?: string;
}

const equipmentList: Equipment[] = [
    { id: '1', name: 'INVESTMENT-123', type: 'MikroTik Router', serialNumber: 'MT-00123-HQ', status: 'Active', location: 'Tower A', assignedTo: 'Network Team' },
    { id: '2', name: 'Ubiquiti NanoBeam M5', type: 'Antenna', serialNumber: 'UB-NB-00452', status: 'Active', location: 'Rooftop B' },
    { id: '3', name: 'Cisco SG350 Switch', type: 'Switch', serialNumber: 'CIS-SG350-009', status: 'Active', location: 'Server Room' },
    { id: '4', name: 'APC UPS 1500VA', type: 'UPS', serialNumber: 'APC-1500-887', status: 'Maintenance', location: 'Server Room' },
    { id: '5', name: 'Ubiquiti EdgeRouter 4', type: 'Router', serialNumber: 'UB-ER4-0021', status: 'Inactive', location: 'Warehouse' },
];

export default function Equipments() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const filtered = equipmentList.filter(eq =>
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            {showAddModal && <AddEquipmentModal onClose={() => setShowAddModal(false)} />}
            {showDeleteModal && (
                <ConfirmDeleteModal
                    title="Remove Equipment"
                    message="Are you sure you want to remove this equipment from inventory?"
                    confirmLabel="Remove"
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={() => console.log('Equipment removed')}
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
                            {filtered.map(eq => (
                                <tr key={eq.id}>
                                    <td style={{ fontWeight: 500 }}>{eq.name}</td>
                                    <td>{eq.type}</td>
                                    <td><span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{eq.serialNumber}</span></td>
                                    <td><span className={`badge ${eq.status === 'Active' ? 'active' : eq.status === 'Maintenance' ? 'expired' : 'inactive'}`}>{eq.status}</span></td>
                                    <td>{eq.location}</td>
                                    <td>{eq.assignedTo || '—'}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="btn-icon edit"><EditIcon style={{ fontSize: 16 }} /></button>
                                            <button className="btn-icon delete" onClick={() => setShowDeleteModal(true)}>
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
