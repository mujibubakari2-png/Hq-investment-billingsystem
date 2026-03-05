import { useState } from 'react';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

interface AddMessageTemplateModalProps {
    onClose: () => void;
    onSave?: (data: object) => void;
}

const VARIABLES = ['{name}', '{plan}', '{expiry}', '{amount}', '{voucher}', '{company}'];

export default function AddMessageTemplateModal({ onClose, onSave }: AddMessageTemplateModalProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState('Activation');
    const [content, setContent] = useState('');

    const insertVariable = (variable: string) => {
        setContent(prev => prev + variable);
    };

    const handleSave = () => {
        if (onSave) onSave({ name, type, content });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
                            <DescriptionIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Add Message Template</div>
                            <div className="modal-subtitle">Create a reusable SMS template</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Template Name <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="e.g., Activation Welcome" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Template Type <span className="required">*</span></label>
                            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                                <option>Activation</option>
                                <option>Expiry</option>
                                <option>Payment</option>
                                <option>Reminder</option>
                                <option>Custom</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Message Content <span className="required">*</span></label>
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Insert variable:</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {VARIABLES.map(v => (
                                    <button
                                        key={v}
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => insertVariable(v)}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <textarea
                            className="form-input"
                            rows={5}
                            placeholder="Dear {name}, your {plan} subscription is now active and expires on {expiry}. Thank you for choosing us!"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                        <div className="form-hint">{content.length} characters · ~{Math.ceil(content.length / 160)} SMS</div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left">Fields marked with <span style={{ color: 'var(--primary)' }}>*</span> are required</div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!name || !content}>
                            <CheckIcon fontSize="small" /> Save Template
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
