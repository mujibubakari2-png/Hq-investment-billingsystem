import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const templates = [
    { id: '1', name: 'Activation Notice', type: 'Activation', content: 'Your account {username} has been activated with plan {plan}. Expires: {expires}' },
    { id: '2', name: 'Expiry Warning', type: 'Expiry', content: 'Your subscription expires in {hours} hours. Recharge at {portal_url} to continue.' },
    { id: '3', name: 'Payment Confirmation', type: 'Payment', content: 'Payment of TZS {amount} received. Ref: {reference}. Your account has been credited.' },
    { id: '4', name: 'Welcome Message', type: 'Custom', content: 'Welcome to HQ Investment! Your account {username} has been created. Login at {portal_url}' },
];

export default function MessageTemplates() {
    return (
        <div>
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
                    <button className="btn btn-primary"><AddIcon fontSize="small" /> Add Template</button>
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
                            {templates.map((tpl) => (
                                <tr key={tpl.id}>
                                    <td style={{ fontWeight: 500 }}>{tpl.name}</td>
                                    <td><span className="badge active">{tpl.type}</span></td>
                                    <td style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{tpl.content}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="btn-icon sync" title="Copy"><ContentCopyIcon style={{ fontSize: 16 }} /></button>
                                            <button className="btn-icon edit"><EditIcon style={{ fontSize: 16 }} /></button>
                                            <button className="btn-icon delete"><DeleteIcon style={{ fontSize: 16 }} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
