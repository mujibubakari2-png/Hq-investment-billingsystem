import { useNavigate } from 'react-router-dom';
import SmsIcon from '@mui/icons-material/Sms';
import SendIcon from '@mui/icons-material/Send';

const messages = [
    { id: '1', recipient: '0746052196', message: 'Your subscription has been activated. Plan: masaa 24', status: 'Sent', sentAt: 'Feb 23, 2026 14:30' },
    { id: '2', recipient: '0698128719', message: 'Your subscription has been activated. Plan: masaa 6', status: 'Sent', sentAt: 'Feb 22, 2026 10:15' },
    { id: '3', recipient: '0617461400', message: 'Payment received. TZS 2,500', status: 'Failed', sentAt: 'Feb 21, 2026 16:45' },
];

export default function SmsMessages() {
    const navigate = useNavigate();
    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>
                        <SmsIcon />
                    </div>
                    <div>
                        <h1 className="page-title">SMS Messages</h1>
                        <p className="page-subtitle">SMS notification history</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => navigate('/send-bulk-message')}><SendIcon fontSize="small" /> Send SMS</button>
                </div>
            </div>

            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="stat-card green">
                    <div className="stat-card-label">Sent</div>
                    <div className="stat-card-value">2</div>
                </div>
                <div className="stat-card red">
                    <div className="stat-card-label">Failed</div>
                    <div className="stat-card-value">1</div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-card-label">Total</div>
                    <div className="stat-card-value">3</div>
                </div>
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Recipient</th>
                                <th>Message</th>
                                <th>Status</th>
                                <th>Sent At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {messages.map((msg) => (
                                <tr key={msg.id}>
                                    <td style={{ fontWeight: 500 }}>{msg.recipient}</td>
                                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.message}</td>
                                    <td><span className={`badge ${msg.status.toLowerCase() === 'sent' ? 'active' : 'expired'}`}>{msg.status}</span></td>
                                    <td>{msg.sentAt}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
