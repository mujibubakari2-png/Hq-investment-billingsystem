import PersonIcon from '@mui/icons-material/Person';
import CloseIcon from '@mui/icons-material/Close';
import WifiIcon from '@mui/icons-material/Wifi';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import type { Client } from '../types';
import { formatDate } from '../utils/formatters';

interface ViewClientModalProps {
    client: Client;
    onClose: () => void;
    onEdit?: () => void;
}

export default function ViewClientModal({ client, onClose, onEdit }: ViewClientModalProps) {
    const initials = client.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || client.username.slice(0, 2).toUpperCase();

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon">
                            <PersonIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Client Details</div>
                            <div className="modal-subtitle">Account information</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    {/* Profile header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
                        <div className="user-avatar blue" style={{ width: 56, height: 56, fontSize: '1.2rem' }}>
                            {initials}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{client.fullName}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>@{client.username}</div>
                            <div style={{ marginTop: 4 }}>
                                <span className={`badge ${client.status.toLowerCase()}`}>{client.status}</span>
                                <span className={`badge ${client.serviceType.toLowerCase()}`} style={{ marginLeft: 6 }}>{client.serviceType}</span>
                            </div>
                        </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid-2 gap-16">
                        {client.phone && (
                            <div className="info-item">
                                <div className="info-label"><PhoneIcon style={{ fontSize: 14 }} /> Phone</div>
                                <div className="info-value">{client.phone}</div>
                            </div>
                        )}
                        {client.email && (
                            <div className="info-item">
                                <div className="info-label"><EmailIcon style={{ fontSize: 14 }} /> Email</div>
                                <div className="info-value">{client.email}</div>
                            </div>
                        )}
                        <div className="info-item">
                            <div className="info-label">Account Type</div>
                            <div className="info-value">{client.accountType}</div>
                        </div>
                        <div className="info-item">
                            <div className="info-label"><CalendarTodayIcon style={{ fontSize: 14 }} /> Created On</div>
                            <div className="info-value">{formatDate(client.createdOn)}</div>
                        </div>
                        {client.router && (
                            <div className="info-item">
                                <div className="info-label"><WifiIcon style={{ fontSize: 14 }} /> Router</div>
                                <div className="info-value">{client.router}</div>
                            </div>
                        )}
                        {client.plan && (
                            <div className="info-item">
                                <div className="info-label">Current Plan</div>
                                <div className="info-value">{client.plan}</div>
                            </div>
                        )}
                        {client.expiresOn && (
                            <div className="info-item">
                                <div className="info-label">Expires On</div>
                                <div className="info-value" style={{ color: 'var(--danger)' }}>{formatDate(client.expiresOn)}</div>
                            </div>
                        )}
                        {client.dataUsed && (
                            <div className="info-item">
                                <div className="info-label">Data Used</div>
                                <div className="info-value">{client.dataUsed}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Close</button>
                        {onEdit && (
                            <button className="btn btn-primary" onClick={onEdit}>
                                Edit Client
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
