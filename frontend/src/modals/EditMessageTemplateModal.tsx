import { useState } from 'react';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

interface Template {
    id: string;
    name: string;
    type: string;
    content: string;
}

interface EditMessageTemplateModalProps {
    template: Template;
    onClose: () => void;
    onSave: (data: Template) => void;
}

const TEMPLATE_TYPES = ['Activation', 'Expiry', 'Payment', 'Custom', 'Reminder', 'Welcome'];

export default function EditMessageTemplateModal({ template, onClose, onSave }: EditMessageTemplateModalProps) {
    const [name, setName] = useState(template.name);
    const [type, setType] = useState(template.type);
    const [content, setContent] = useState(template.content);

    const handleSave = () => {
        onSave({ ...template, name, type, content });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                            <DescriptionIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Edit Template</div>
                            <div className="modal-subtitle">Update message template</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Template Name <span className="required">*</span></label>
                            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type <span className="required">*</span></label>
                            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                                {TEMPLATE_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Content <span className="required">*</span></label>
                        <textarea
                            className="form-input"
                            rows={5}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Available variables: {'{username}'}, {'{plan}'}, {'{expires}'}, {'{amount}'}, {'{reference}'}, {'{portal_url}'}, {'{hours}'}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!name || !content}>
                            <CheckIcon fontSize="small" /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
