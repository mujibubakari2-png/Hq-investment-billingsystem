import { useState } from 'react';
import DevicesIcon from '@mui/icons-material/Devices';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

interface AddEquipmentModalProps {
    onClose: () => void;
    onSave?: (data: object) => void;
}

const EQUIPMENT_TYPES = ['Router', 'Switch', 'Antenna', 'OLT', 'ONT', 'Server', 'UPS', 'Cable', 'Other'];

export default function AddEquipmentModal({ onClose, onSave }: AddEquipmentModalProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState('Router');
    const [serialNumber, setSerialNumber] = useState('');
    const [status, setStatus] = useState('Active');
    const [location, setLocation] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [purchaseDate, setPurchaseDate] = useState('');
    const [notes, setNotes] = useState('');

    const handleSave = () => {
        if (onSave) onSave({ name, type, serialNumber, status, location, assignedTo, purchaseDate, notes });
        onClose();
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
                            <div className="modal-title">Add Equipment</div>
                            <div className="modal-subtitle">Add new network equipment to inventory</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Equipment Name <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="e.g., MikroTik hAP ac³" value={name} onChange={e => setName(e.target.value)} />
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
                            <input type="text" className="form-input" placeholder="Manufacturer serial number" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                                <option>Active</option>
                                <option>Inactive</option>
                                <option>Maintenance</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Location <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="e.g., Server Room, Tower A" value={location} onChange={e => setLocation(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Assigned To</label>
                            <input type="text" className="form-input" placeholder="Client or staff name" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Purchase Date</label>
                        <input type="date" className="form-input" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-input" rows={3} placeholder="Additional notes..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left">Fields marked with <span style={{ color: 'var(--primary)' }}>*</span> are required</div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!name || !location}>
                            <CheckIcon fontSize="small" /> Add Equipment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
