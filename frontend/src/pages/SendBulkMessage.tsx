import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SmsIcon from '@mui/icons-material/Sms';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GroupIcon from '@mui/icons-material/Group';
import RouterIcon from '@mui/icons-material/Router';
import PhoneIcon from '@mui/icons-material/Phone';
import TimerIcon from '@mui/icons-material/Timer';
import ScienceIcon from '@mui/icons-material/Science';
import EditNoteIcon from '@mui/icons-material/EditNote';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import BatchPredictionIcon from '@mui/icons-material/BatchPrediction';

const placeholders = [
    { variable: '[[name]]', label: 'Customer Name' },
    { variable: '[[user_name]]', label: 'Username' },
    { variable: '[[phone]]', label: 'Phone Number' },
    { variable: '[[company_name]]', label: 'Company Name' },
    { variable: '[[service_type]]', label: 'Service Type' },
    { variable: '[[account_type]]', label: 'Account Type' },
    { variable: '[[balance]]', label: 'Account Balance' },
    { variable: '[[router_name]]', label: 'Router Name' },
];

export default function SendBulkMessage() {
    const navigate = useNavigate();
    const [messageContent, setMessageContent] = useState('');
    const [customerGroup, setCustomerGroup] = useState('');
    const [router, setRouter] = useState('all');
    const [sendVia, setSendVia] = useState('');
    const [batchSize, setBatchSize] = useState('10');
    const [delayBetween, setDelayBetween] = useState('5');
    const [testMode, setTestMode] = useState(false);

    const insertPlaceholder = (variable: string) => {
        setMessageContent(prev => prev + variable);
    };

    return (
        <div>
            {/* Breadcrumb + Back */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <span style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 500 }}>Communication</span>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <SmsIcon style={{ color: 'var(--text-secondary)' }} /> Send Bulk Message
                    </h1>
                </div>
                <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ArrowBackIcon fontSize="small" /> Back to Dashboard
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {/* Left: Compose Form */}
                <div>
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: '1rem' }}>
                            <SmsIcon style={{ color: 'var(--text-secondary)' }} /> Compose Bulk Message
                        </h3>

                        {/* Row 1: Customer Group + Filter by Router */}
                        <div className="grid-2 gap-16" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600 }}>
                                    <GroupIcon style={{ fontSize: 16 }} /> Customer Group
                                </label>
                                <select className="form-select" value={customerGroup} onChange={e => setCustomerGroup(e.target.value)}>
                                    <option value="">Select Customer Group</option>
                                    <option value="all">All Customers</option>
                                    <option value="active">Active Subscribers</option>
                                    <option value="expired">Expired Subscribers</option>
                                    <option value="hotspot">Hotspot Users</option>
                                    <option value="pppoe">PPPoE Users</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--secondary)', fontWeight: 600 }}>
                                    <RouterIcon style={{ fontSize: 16 }} /> Filter by Router
                                </label>
                                <select className="form-select" value={router} onChange={e => setRouter(e.target.value)}>
                                    <option value="all">All Routers</option>
                                    <option value="investment-123">INVESTMENT-123</option>
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Send Via + Batch Size */}
                        <div className="grid-2 gap-16" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--info)', fontWeight: 600 }}>
                                    <PhoneIcon style={{ fontSize: 16 }} /> Send Via
                                </label>
                                <select className="form-select" value={sendVia} onChange={e => setSendVia(e.target.value)}>
                                    <option value="">Select Method</option>
                                    <option value="sms">SMS</option>
                                    <option value="whatsapp">WhatsApp</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--secondary)', fontWeight: 600 }}>
                                    <BatchPredictionIcon style={{ fontSize: 16 }} /> Batch Size
                                </label>
                                <select className="form-select" value={batchSize} onChange={e => setBatchSize(e.target.value)}>
                                    <option value="5">5 Messages per batch</option>
                                    <option value="10">10 Messages per batch</option>
                                    <option value="25">25 Messages per batch</option>
                                    <option value="50">50 Messages per batch</option>
                                </select>
                                <div className="form-hint">Higher batch sizes for large customer lists</div>
                            </div>
                        </div>

                        {/* Row 3: Delay + Test Mode */}
                        <div className="grid-2 gap-16" style={{ marginBottom: 20 }}>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600 }}>
                                    <TimerIcon style={{ fontSize: 16 }} /> Delay Between Batches
                                </label>
                                <select className="form-select" value={delayBetween} onChange={e => setDelayBetween(e.target.value)}>
                                    <option value="3">3 Seconds</option>
                                    <option value="5">5 Seconds</option>
                                    <option value="10">10 Seconds</option>
                                    <option value="30">30 Seconds</option>
                                </select>
                                <div className="form-hint" style={{ color: 'var(--primary)' }}>Prevents provider rate limiting</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                                    <ScienceIcon style={{ fontSize: 16 }} /> Test Mode
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                    <div
                                        onClick={() => setTestMode(!testMode)}
                                        style={{
                                            width: 40, height: 22, borderRadius: 12, cursor: 'pointer',
                                            background: testMode ? 'var(--primary)' : '#d1d5db',
                                            position: 'relative', transition: 'all 0.2s',
                                        }}
                                    >
                                        <div style={{
                                            width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                            position: 'absolute', top: 2, left: testMode ? 20 : 2,
                                            transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                        }} />
                                    </div>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                        Enable test mode (no messages sent)
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Message Content */}
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                                <EditNoteIcon style={{ fontSize: 16 }} /> Message Content
                            </label>
                            <textarea
                                className="form-input"
                                placeholder="Type your message here..."
                                rows={5}
                                value={messageContent}
                                onChange={e => setMessageContent(e.target.value)}
                                style={{ resize: 'vertical', fontFamily: 'inherit' }}
                            />
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                {messageContent.length} characters
                            </div>
                        </div>
                    </div>

                    {/* Send button */}
                    <button className="btn" style={{ background: 'var(--primary)', color: '#fff', fontWeight: 600, padding: '10px 24px', marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <SendIcon fontSize="small" /> Send Messages
                    </button>
                </div>

                {/* Right: Placeholders Panel */}
                <div>
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '1rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>↗</span> Message Placeholders
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {placeholders.map((p) => (
                                <div
                                    key={p.variable}
                                    onClick={() => insertPlaceholder(p.variable)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        cursor: 'pointer', padding: '4px 0',
                                    }}
                                >
                                    <code style={{
                                        background: '#fef2f2', color: 'var(--primary)', padding: '2px 8px',
                                        borderRadius: 4, fontSize: '0.8rem', fontWeight: 500,
                                    }}>
                                        {p.variable}
                                    </code>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Quick Tips */}
                        <div style={{
                            marginTop: 20, padding: '12px 14px',
                            background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: '0.85rem', color: '#16a34a' }}>
                                <TipsAndUpdatesIcon style={{ fontSize: 16 }} /> Quick Tips
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#374151', lineHeight: 1.6 }}>
                                Click on any placeholder to insert it into your message.<br />
                                Use test mode to preview messages before sending.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
