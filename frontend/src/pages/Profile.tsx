import { useState } from 'react';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BadgeIcon from '@mui/icons-material/Badge';
import LockIcon from '@mui/icons-material/Lock';
import SaveIcon from '@mui/icons-material/Save';
import authStore from '../stores/authStore';

export default function Profile() {
    const { user } = authStore.useAuth();
    const [fullName, setFullName] = useState(user?.username || '');
    const [email, setEmail] = useState(user?.email || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');

    const initials = user?.username
        ? user.username.slice(0, 2).toUpperCase()
        : 'U';

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            // Profile update would go to API here
            await new Promise(resolve => setTimeout(resolve, 500));
            alert('Profile updated successfully!');
        } catch (err) {
            console.error('Failed to update profile:', err);
            alert('Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            alert('New password and confirmation do not match.');
            return;
        }
        if (!currentPassword || !newPassword) {
            alert('Please fill in all password fields.');
            return;
        }
        setSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            alert('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            console.error('Failed to change password:', err);
            alert('Failed to change password.');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { key: 'general' as const, label: 'Profile Info' },
        { key: 'security' as const, label: 'Security' },
    ];

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon">
                        <PersonIcon />
                    </div>
                    <div>
                        <h1 className="page-title">My Profile</h1>
                        <p className="page-subtitle">Manage your account settings and preferences</p>
                    </div>
                </div>
            </div>

            {/* Profile Card */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '24px' }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #e53935, #c62828)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '1.8rem', fontWeight: 700,
                        boxShadow: '0 4px 14px rgba(229, 57, 53, 0.35)',
                    }}>
                        {initials}
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>{user?.username || 'User'}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 4 }}>{user?.email}</p>
                        <span className="badge active" style={{ fontSize: '0.75rem' }}>{user?.role || 'User'}</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-light)', marginBottom: 24 }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '10px 24px', border: 'none', background: 'transparent', cursor: 'pointer',
                            fontWeight: activeTab === tab.key ? 700 : 400,
                            color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                            borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                            marginBottom: -2, fontSize: '0.95rem', transition: 'all 0.2s',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
                <div className="card" style={{ maxWidth: 600 }}>
                    <div style={{ padding: '24px' }}>
                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <BadgeIcon style={{ fontSize: 16, color: 'var(--primary)' }} /> Full Name
                            </label>
                            <input type="text" className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} />
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <EmailIcon style={{ fontSize: 16, color: 'var(--primary)' }} /> Email Address
                            </label>
                            <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>

                        <div className="form-group" style={{ marginBottom: 24 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <PhoneIcon style={{ fontSize: 16, color: 'var(--primary)' }} /> Phone Number
                            </label>
                            <input type="text" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>

                        <button
                            className="btn"
                            style={{
                                background: 'var(--primary)', color: '#fff', fontWeight: 700,
                                width: '100%', padding: '12px 0', fontSize: '1rem',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                            onClick={handleSaveProfile}
                            disabled={saving}
                        >
                            <SaveIcon fontSize="small" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
                <div className="card" style={{ maxWidth: 600 }}>
                    <div style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, color: 'var(--primary)' }}>
                            <LockIcon />
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Change Password</h3>
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">Current Password <span className="required">*</span></label>
                            <input type="password" className="form-input" placeholder="Enter current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">New Password <span className="required">*</span></label>
                            <input type="password" className="form-input" placeholder="Enter new password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        </div>

                        <div className="form-group" style={{ marginBottom: 24 }}>
                            <label className="form-label">Confirm New Password <span className="required">*</span></label>
                            <input type="password" className="form-input" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                        </div>

                        <button
                            className="btn"
                            style={{
                                background: 'var(--primary)', color: '#fff', fontWeight: 700,
                                width: '100%', padding: '12px 0', fontSize: '1rem',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                            onClick={handleChangePassword}
                            disabled={saving}
                        >
                            <LockIcon fontSize="small" />
                            {saving ? 'Updating...' : 'Change Password'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
