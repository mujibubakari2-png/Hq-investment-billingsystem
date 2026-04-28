import { useState, useEffect } from 'react';
import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
    activation: { bg: '#dbeafe', color: '#2563eb' },
    expiry:     { bg: '#fef3c7', color: '#d97706' },
    payment:    { bg: '#d1fae5', color: '#059669' },
    reminder:   { bg: '#ede9fe', color: '#7c3aed' },
    custom:     { bg: '#f3f4f6', color: '#6b7280' },
    welcome:    { bg: '#cffafe', color: '#0891b2' },
};

function getTypeBadgeStyle(type: string) {
    const key = (type || 'custom').toLowerCase();
    return TYPE_COLORS[key] || TYPE_COLORS.custom;
}

export default function MessageTemplates() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editTemplate, setEditTemplate] = useState<Template | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await smsApi.templates.list();
            setTemplates(data as unknown as Template[]);
        } catch (err) {
            console.error('Failed to load templates:', err);
            setTemplates([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    // Auto-dismiss feedback
    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => setFeedback(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    const handleAddTemplate = async (data: object) => {
        try {
            await smsApi.templates.create(data as Record<string, unknown>);
            setShowAddModal(false);
            setFeedback({ type: 'success', message: 'Template created successfully!' });
            fetchTemplates();
        } catch (err) {
            console.error('Failed to add template:', err);
            setFeedback({ type: 'error', message: 'Failed to create template.' });
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await smsApi.templates.delete(deleteId);
            setDeleteId(null);
            setFeedback({ type: 'success', message: 'Template deleted.' });
            fetchTemplates();
        } catch (err) {
            console.error('Failed to delete template:', err);
            setFeedback({ type: 'error', message: 'Failed to delete template.' });
        }
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
        setFeedback({ type: 'success', message: 'Template content copied to clipboard!' });
    };

    const handleEditTemplate = async (updated: Template) => {
        try {
            await smsApi.templates.update(updated.id, updated as unknown as Record<string, unknown>);
            setEditTemplate(null);
            setFeedback({ type: 'success', message: 'Template updated successfully!' });
            fetchTemplates();
        } catch (err) {
            console.error('Failed to update template:', err);
            setFeedback({ type: 'error', message: 'Failed to update template.' });
        }
    };

    // Filter templates by search
    const filtered = templates.filter(t =>
        !searchTerm ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                        <DescriptionIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Message Templates</h1>
                        <p className="page-subtitle">Manage reusable SMS notification templates</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <AddIcon fontSize="small" /> Add Template
                    </button>
                </div>
            </div>

            {/* Feedback */}
            {feedback && (
                <div style={{
                    padding: '10px 16px', marginBottom: 16, borderRadius: 8,
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    color: feedback.type === 'success' ? '#16a34a' : '#dc2626',
                    fontSize: '0.9rem', fontWeight: 500,
                }}>
                    <CheckCircleIcon style={{ fontSize: 16 }} />
                    {feedback.message}
                </div>
            )}

            {/* Stat Cards */}
            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                {['Activation', 'Expiry', 'Payment', 'Reminder', 'Custom'].map(type => {
                    const count = templates.filter(t => t.type.toLowerCase() === type.toLowerCase()).length;
                    const style = getTypeBadgeStyle(type);
                    return (
                        <div key={type} className="stat-card" style={{
                            background: style.bg,
                            color: style.color,
                            borderLeft: `5px solid ${style.color}`,
                            cursor: 'pointer',
                        }} onClick={() => setSearchTerm(type)}>
                            <div className="stat-card-label" style={{ color: style.color }}>{type}</div>
                            <div className="stat-card-value" style={{ color: style.color }}>{count}</div>
                        </div>
                    );
                })}
            </div>

            {/* Table Card */}
            <div className="card">
                {/* Toolbar */}
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            {filtered.length} template{filtered.length !== 1 ? 's' : ''} total
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchTemplates()}>
                            <RefreshIcon fontSize="small" />
                        </button>
                    </div>
                </div>

                {/* Table */}
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
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ marginBottom: 10 }}><SyncIcon className="spin" /></div>
                                        Loading templates...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        <DescriptionIcon style={{ fontSize: 40, opacity: 0.3, marginBottom: 8 }} />
                                        <div>{searchTerm ? 'No templates match your search.' : 'No templates found. Add one to get started.'}</div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((tpl) => {
                                    const style = getTypeBadgeStyle(tpl.type);
                                    return (
                                        <tr key={tpl.id}>
                                            <td style={{ fontWeight: 600 }}>{tpl.name}</td>
                                            <td>
                                                <span
                                                    className="badge"
                                                    style={{
                                                        background: style.bg,
                                                        color: style.color,
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {tpl.type}
                                                </span>
                                            </td>
                                            <td style={{
                                                maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-secondary)',
                                            }}>
                                                {tpl.content}
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button className="btn-icon copy" title="Copy Content" onClick={() => handleCopy(tpl.content)}>
                                                        <ContentCopyIcon style={{ fontSize: 16 }} />
                                                    </button>
                                                    <button className="btn-icon edit" title="Edit Template" onClick={() => setEditTemplate(tpl)}>
                                                        <EditIcon style={{ fontSize: 16 }} />
                                                    </button>
                                                    <button className="btn-icon delete" title="Delete Template" onClick={() => setDeleteId(tpl.id)}>
                                                        <DeleteIcon style={{ fontSize: 16 }} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
