import { useState } from 'react';
import DevicesIcon from '@mui/icons-material/Devices';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import type { Equipment } from '../types';

interface EditEquipmentModalProps {
    equipment: Equipment;
    onClose: () => void;
    onSave: (data: Equipment) => void;
}

const EQUIPMENT_TYPES = ['Router', 'Switch', 'Antenna', 'OLT', 'ONT', 'Server', 'UPS', 'Cable', 'Other'];

export default function EditEquipmentModal({ equipment, onClose, onSave }: EditEquipmentModalProps) {
    const [name, setName] = useState(equipment.name);
    const [type, setType] = useState(equipment.type);
    const [serialNumber, setSerialNumber] = useState(equipment.serialNumber);
    const [status, setStatus] = useState(equipment.status);
    const [location, setLocation] = useState(equipment.location);
    const [assignedTo, setAssignedTo] = useState(equipment.assignedTo || '');
    const [purchaseDate, setPurchaseDate] = useState(equipment.purchaseDate || '');
    const [notes, setNotes] = useState(equipment.notes || '');

    const handleSave = () => {
        onSave({
            ...equipment,
            name, type, serialNumber, status: status as Equipment['status'],
            location, assignedTo, purchaseDate, notes,
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--teal-light)', color: 'var(--teal)' }}>
                            <DevicesIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Edit Equipment</div>
                            <div className="modal-subtitle">Update equipment details</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Equipment Name <span className="required">*</span></label>
                            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Equipment Type <span className="required">*</span></label>
                            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                                {EQUIPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Serial Number</label>
                            <input type="text" className="form-input" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-select" value={status} onChange={e => setStatus(e.target.value as Equipment['status'])}>
                                <option>Active</option>
                                <option>Inactive</option>
                                <option>Maintenance</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Location <span className="required">*</span></label>
                            <input type="text" className="form-input" value={location} onChange={e => setLocation(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Assigned To</label>
                            <input type="text" className="form-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Purchase Date</label>
                        <input type="date" className="form-input" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left">Fields marked with <span style={{ color: 'var(--primary)' }}>*</span> are required</div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!name || !location}>
                            <CheckIcon fontSize="small" /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
