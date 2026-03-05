import { useState } from 'react';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

interface AddExpenseModalProps {
    onClose: () => void;
    onSave?: (data: object) => void;
}

const CATEGORIES = ['Infrastructure', 'Maintenance', 'Staff', 'Utilities', 'Equipment', 'Marketing', 'Transport', 'Office', 'Other'];

export default function AddExpenseModal({ onClose, onSave }: AddExpenseModalProps) {
    const [category, setCategory] = useState('Infrastructure');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');

    const handleSave = () => {
        if (onSave) onSave({ category, description, amount: Number(amount), date, reference });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
                            <AccountBalanceWalletIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Add Expense</div>
                            <div className="modal-subtitle">Record a new business expense</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Category <span className="required">*</span></label>
                            <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Amount (TZS) <span className="required">*</span></label>
                            <input type="number" className="form-input" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description <span className="required">*</span></label>
                        <input type="text" className="form-input" placeholder="Brief description of the expense" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Date <span className="required">*</span></label>
                            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Reference Number</label>
                            <input type="text" className="form-input" placeholder="Receipt or invoice number" value={reference} onChange={e => setReference(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left">Fields marked with <span style={{ color: 'var(--primary)' }}>*</span> are required</div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!description || !amount}>
                            <CheckIcon fontSize="small" /> Add Expense
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
