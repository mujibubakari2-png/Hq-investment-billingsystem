import { useState } from 'react';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import type { Expense } from '../types';

interface EditExpenseModalProps {
    expense: Expense;
    onClose: () => void;
    onSave: (data: Expense) => void;
}

const CATEGORIES = ['Internet', 'Equipment', 'Salary', 'Rent', 'Utilities', 'Marketing', 'Transport', 'Office Supplies', 'Other'];

export default function EditExpenseModal({ expense, onClose, onSave }: EditExpenseModalProps) {
    const [description, setDescription] = useState(expense.description);
    const [category, setCategory] = useState(expense.category);
    const [amount, setAmount] = useState(String(expense.amount));
    const [date, setDate] = useState(expense.date ? new Date(expense.date).toISOString().split('T')[0] : '');
    const [status, setStatus] = useState(expense.status || 'Approved');
    const [reference, setReference] = useState(expense.reference || '');

    const handleSave = () => {
        onSave({
            ...expense,
            description,
            category,
            amount: Number(amount),
            date,
            status,
            reference,
        });
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
                            <div className="modal-title">Edit Expense</div>
                            <div className="modal-subtitle">Update expense record</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Description <span className="required">*</span></label>
                        <input type="text" className="form-input" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Category <span className="required">*</span></label>
                            <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Amount (TZS) <span className="required">*</span></label>
                            <input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Date</label>
                            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                                <option>Approved</option>
                                <option>Pending</option>
                                <option>Rejected</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Reference</label>
                        <input type="text" className="form-input" placeholder="Payment reference" value={reference} onChange={e => setReference(e.target.value)} />
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!description || !amount}>
                            <CheckIcon fontSize="small" /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
