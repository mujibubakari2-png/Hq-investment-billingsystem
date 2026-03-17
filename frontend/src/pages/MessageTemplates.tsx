import { useState, useEffect } from 'react';
import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { smsApi } from '../api/client';
import AddMessageTemplateModal from '../modals/AddMessageTemplateModal';
import EditMessageTemplateModal from '../modals/EditMessageTemplateModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';

interface Template {
    id: string;
    name: string;
    type: string;
    content: string;
}

export default function MessageTemplates() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editTemplate, setEditTemplate] = useState<Template | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await smsApi.templates.list();
            setTemplates(data as unknown as Template[]);
        } catch (err) {
            console.error('Failed to load templates:', err);
            // Fallback to defaults if API not available
            setTemplates([
                { id: '1', name: 'Activation Notice', type: 'Activation', content: 'Your account {username} has been activated with plan {plan}. Expires: {expires}' },
                { id: '2', name: 'Expiry Warning', type: 'Expiry', content: 'Your subscription expires in {hours} hours. Recharge at {portal_url} to continue.' },
                { id: '3', name: 'Payment Confirmation', type: 'Payment', content: 'Payment of TZS {amount} received. Ref: {reference}. Your account has been credited.' },
                { id: '4', name: 'Welcome Message', type: 'Custom', content: 'Welcome to HQ Investment! Your account {username} has been created. Login at {portal_url}' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleAddTemplate = async (data: object) => {
        try {
            await smsApi.templates.create(data as Record<string, unknown>);
            setShowAddModal(false);
            fetchTemplates();
        } catch (err) {
            console.error('Failed to add template:', err);
            alert('Failed to add template.');
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await smsApi.templates.delete(deleteId);
            setDeleteId(null);
            fetchTemplates();
        } catch (err) {
            console.error('Failed to delete template:', err);
            alert('Failed to delete template.');
        }
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
        alert('Template content copied to clipboard!');
    };

    const handleEditTemplate = async (updated: Template) => {
        try {
            await smsApi.templates.update(updated.id, updated as unknown as Record<string, unknown>);
            setEditTemplate(null);
            fetchTemplates();
        } catch (err) {
            console.error('Failed to update template:', err);
            alert('Failed to update template.');
        }
    };

    return (
        <div>
            {showAddModal && <AddMessageTemplateModal onClose={() => setShowAddModal(false)} onSave={handleAddTemplate} />}
            {editTemplate && (
                <EditMessageTemplateModal
                    template={editTemplate}
                    onClose={() => setEditTemplate(null)}
                    onSave={handleEditTemplate}
                />
            )}
            {deleteId && (
                <ConfirmDeleteModal
                    title="Delete Template"
                    message="Are you sure you want to delete this message template? This action cannot be undone."
                    onClose={() => setDeleteId(null)}
                    onConfirm={handleDelete}
                />
            )}

            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                        <DescriptionIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Message Templates</h1>
                        <p className="page-subtitle">Manage SMS notification templates</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}><AddIcon fontSize="small" /> Add Template</button>
                </div>
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Content</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading templates...
                                    </td>
                                </tr>
                            ) : templates.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No templates found.
                                    </td>
                                </tr>
                            ) : (
                                templates.map((tpl) => (
                                    <tr key={tpl.id}>
                                        <td style={{ fontWeight: 500 }}>{tpl.name}</td>
                                        <td><span className="badge active">{tpl.type}</span></td>
                                        <td style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{tpl.content}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon sync" title="Copy" onClick={() => handleCopy(tpl.content)}><ContentCopyIcon style={{ fontSize: 16 }} /></button>
                                                <button className="btn-icon edit" title="Edit" onClick={() => setEditTemplate(tpl)}><EditIcon style={{ fontSize: 16 }} /></button>
                                                <button className="btn-icon delete" title="Delete" onClick={() => setDeleteId(tpl.id)}><DeleteIcon style={{ fontSize: 16 }} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
