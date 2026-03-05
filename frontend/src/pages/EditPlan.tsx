import { useState } from 'react';
import EditNoteIcon from '@mui/icons-material/EditNote';
import InfoIcon from '@mui/icons-material/Info';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useNavigate, useParams } from 'react-router-dom';

export default function EditPlan() {
    const { id: _id } = useParams();
    const navigate = useNavigate();

    const [servicePlan, _setServicePlan] = useState('INVESTMENT-123 ● masaa 24');
    const [createdDate, setCreatedDate] = useState('23/02/2026');
    const [createdTime, setCreatedTime] = useState('22:34:11');
    const [expiresDate, setExpiresDate] = useState('24/02/2026');
    const [expiresTime, setExpiresTime] = useState('22:34:11');

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
                        <EditNoteIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Edit Plan</h1>
                        <p className="page-subtitle">Modify customer service plan details and expiration settings</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <div className="breadcrumb">
                        <a href="/">Dashboard</a> <span>/</span>{' '}
                        <a href="/active-subscribers">Plans</a> <span>/</span> Edit Plan
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="info-box">
                <div className="info-box-title">
                    <InfoIcon fontSize="small" /> Instructions
                </div>
                <ul>
                    <li>Select the appropriate service plan for the customer</li>
                    <li>Set the expiration date and time correctly</li>
                    <li>Deadline times are marked in bold and be avoided</li>
                    <li>Changes will take effect immediately after saving</li>
                </ul>
            </div>

            {/* Form Card */}
            <div className="card">
                <div className="card-body">
                    {/* Customer Information */}
                    <div className="form-section-title">
                        <PersonIcon fontSize="small" /> Customer Information
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ color: 'var(--primary)' }}>
                            <span style={{ fontWeight: 700 }}>●</span> Select Account
                        </label>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 14px',
                            background: 'var(--bg-hover)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                        }}>
                            <PersonIcon fontSize="small" style={{ color: 'var(--text-muted)' }} />
                            <span>HS-CW99147</span>
                        </div>
                        <div className="form-hint">This field is read only and can not be modified</div>
                    </div>

                    {/* Service Configuration */}
                    <div className="form-section-title">
                        <SettingsIcon fontSize="small" /> Service Configuration
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            <span style={{ fontWeight: 700 }}>●</span> Service Plan
                        </label>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 14px',
                            background: 'var(--bg-hover)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                        }}>
                            <span style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: 'var(--secondary)',
                                display: 'inline-block',
                            }} />
                            {servicePlan}
                        </div>
                        <div className="form-hint">Select the service plan that best fits the customer's needs</div>
                    </div>

                    {/* Timeline Information */}
                    <div className="form-section-title">
                        <CalendarMonthIcon fontSize="small" /> Timeline Information
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CalendarMonthIcon fontSize="small" style={{ color: 'var(--info)' }} />
                            <strong>Created On</strong>
                        </label>
                        <div className="form-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CalendarMonthIcon fontSize="small" style={{ color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    value={createdDate}
                                    onChange={(e) => setCreatedDate(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                🕐
                                <input
                                    type="text"
                                    className="form-input"
                                    value={createdTime}
                                    onChange={(e) => setCreatedTime(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 16 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CalendarMonthIcon fontSize="small" style={{ color: 'var(--primary)' }} />
                            <strong>Expires On</strong>
                        </label>
                        <div className="form-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CalendarMonthIcon fontSize="small" style={{ color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    value={expiresDate}
                                    onChange={(e) => setExpiresDate(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                🕐
                                <input
                                    type="text"
                                    className="form-input"
                                    value={expiresTime}
                                    onChange={(e) => setExpiresTime(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="form-hint" style={{ marginTop: 8 }}>
                            ⓘ Set when this plan should expire. The service is automatically disabled after this date and time.
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                            ← Cancel
                        </button>
                        <button className="btn btn-primary">
                            ✓ Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
