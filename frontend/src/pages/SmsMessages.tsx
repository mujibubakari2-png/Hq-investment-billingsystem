import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SmsIcon from '@mui/icons-material/Sms';
import SendIcon from '@mui/icons-material/Send';
import { smsApi } from '../api/client';
import type { SmsMessage } from '../types';

export default function SmsMessages() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<SmsMessage[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const res = await smsApi.list();
            setMessages(res.data as unknown as SmsMessage[]);
        } catch (err) {
            console.error('Failed to load messages:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const sentCount = messages.filter(m => m.status === 'Sent').length;
    const failedCount = messages.filter(m => m.status === 'Failed').length;

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
                    <div className="stat-card-value">{sentCount}</div>
                </div>
                <div className="stat-card red">
                    <div className="stat-card-label">Failed</div>
                    <div className="stat-card-value">{failedCount}</div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-card-label">Total</div>
                    <div className="stat-card-value">{messages.length}</div>
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
                            {loading ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading messages...
                                    </td>
                                </tr>
                            ) : messages.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No messages found.
                                    </td>
                                </tr>
                            ) : (
                                messages.map((msg) => (
                                    <tr key={msg.id}>
                                        <td style={{ fontWeight: 500 }}>{msg.recipient}</td>
                                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.message}</td>
                                        <td><span className={`badge ${msg.status.toLowerCase() === 'sent' ? 'active' : 'expired'}`}>{msg.status}</span></td>
                                        <td>{new Date(msg.sentAt).toLocaleString()}</td>
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
