import { useState } from 'react';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

interface CreateInvoiceModalProps {
    onClose: () => void;
    onSave: (data: Record<string, unknown>) => void;
}

export default function CreateInvoiceModal({ onClose, onSave }: CreateInvoiceModalProps) {
    const [client, setClient] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [status, setStatus] = useState('Draft');
    const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: 0 }]);

    const addItem = () => {
        setItems([...items, { description: '', quantity: 1, unitPrice: 0 }]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: string, value: string | number) => {
        const updated = [...items];
        (updated[index] as any)[field] = value;
        setItems(updated);
    };

    const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const handleSave = () => {
        onSave({
            client,
            dueDate,
            status,
            amount: total,
            items: items.map(item => ({
                ...item,
                total: item.quantity * item.unitPrice,
            })),
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                            <ReceiptIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Create Invoice</div>
                            <div className="modal-subtitle">Generate a new invoice for a client</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Client Name <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="Client name" value={client} onChange={e => setClient(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Due Date <span className="required">*</span></label>
                            <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                            <option>Draft</option>
                            <option>Unpaid</option>
                            <option>Paid</option>
                        </select>
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>Invoice Items</label>
                            <button className="btn btn-secondary btn-sm" onClick={addItem} type="button">
                                <AddIcon fontSize="small" /> Add Item
                            </button>
                        </div>

                        {items.map((item, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 120px 40px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    {i === 0 && <label className="form-label" style={{ fontSize: '0.75rem' }}>Description</label>}
                                    <input type="text" className="form-input" placeholder="Item description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    {i === 0 && <label className="form-label" style={{ fontSize: '0.75rem' }}>Qty</label>}
                                    <input type="number" className="form-input" min={1} value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    {i === 0 && <label className="form-label" style={{ fontSize: '0.75rem' }}>Unit Price</label>}
                                    <input type="number" className="form-input" min={0} value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} />
                                </div>
                                <button className="btn-icon delete" onClick={() => removeItem(i)} disabled={items.length <= 1} style={{ height: 36 }}>
                                    <DeleteIcon style={{ fontSize: 16 }} />
                                </button>
                            </div>
                        ))}

                        <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', marginTop: 12, padding: '12px 0', borderTop: '2px solid var(--border)' }}>
                            Total: {total.toLocaleString()} TZS
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!client || !dueDate || items.every(i => !i.description)}>
                            <CheckIcon fontSize="small" /> Create Invoice
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
