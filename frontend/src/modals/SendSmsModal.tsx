import { useState } from 'react';
import SmsIcon from '@mui/icons-material/Sms';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import type { MessageTemplate } from '../types';

interface SendSmsModalProps {
    templates?: MessageTemplate[];
    onClose: () => void;
    onSend?: (data: object) => void;
    defaultRecipient?: string;
}

export default function SendSmsModal({ templates = [], onClose, onSend, defaultRecipient }: SendSmsModalProps) {
    const [recipientType, setRecipientType] = useState(defaultRecipient ? 'individual' : 'all');
    const [recipientPhone, setRecipientPhone] = useState(defaultRecipient || '');
    const [templateId, setTemplateId] = useState('');
    const [message, setMessage] = useState('');

    const handleTemplateChange = (id: string) => {
        setTemplateId(id);
        const tmpl = templates.find(t => t.id === id);
        if (tmpl) setMessage(tmpl.content);
    };

    const handleSend = () => {
        if (onSend) onSend({ recipientType, recipientPhone, message });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--cyan-light)', color: 'var(--cyan)' }}>
                            <SmsIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Send SMS</div>
                            <div className="modal-subtitle">Send a message to clients</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Recipient</label>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            {[
                                { value: 'all', label: 'All Clients' },
                                { value: 'active', label: 'Active' },
                                { value: 'expired', label: 'Expired' },
                                { value: 'individual', label: 'Individual' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    className={`btn btn-sm ${recipientType === opt.value ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setRecipientType(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {recipientType === 'individual' && (
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Phone number e.g. 255700000000"
                                value={recipientPhone}
                                onChange={e => setRecipientPhone(e.target.value)}
                            />
                        )}
                    </div>

                    {templates.length > 0 && (
                        <div className="form-group">
                            <label className="form-label">Use Template (Optional)</label>
                            <select className="form-select" value={templateId} onChange={e => handleTemplateChange(e.target.value)}>
                                <option value="">-- Select Template --</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Message <span className="required">*</span></label>
                        <textarea
                            className="form-input"
                            rows={5}
                            placeholder="Type your message here..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                        <div className="form-hint">{message.length} characters · ~{Math.ceil(message.length / 160)} SMS</div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSend} disabled={!message.trim()}>
                            <SendIcon fontSize="small" /> Send SMS
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
