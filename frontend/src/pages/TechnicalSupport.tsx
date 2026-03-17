import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import ChatIcon from '@mui/icons-material/Chat';

export default function TechnicalSupport() {
    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                        <SupportAgentIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Technical Support</h1>
                        <p className="page-subtitle">Get help with your system</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center', padding: '32px 20px' }}>
                        <EmailIcon style={{ fontSize: 48, color: 'var(--info)', marginBottom: 12 }} />
                        <h3 style={{ marginBottom: 8 }}>Email Support</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>Send us an email and we'll respond within 24 hours</p>
                        <button className="btn btn-primary" onClick={() => window.location.href = 'mailto:support@hqinvestment.co.tz'}>support@hqinvestment.co.tz</button>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center', padding: '32px 20px' }}>
                        <PhoneIcon style={{ fontSize: 48, color: 'var(--secondary)', marginBottom: 12 }} />
                        <h3 style={{ marginBottom: 8 }}>Phone Support</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>Call us during business hours (8AM - 6PM EAT)</p>
                        <button className="btn btn-success" onClick={() => window.location.href = 'tel:+255621085215'}>+255 621 085 215 <br /> +255 766 487 125</button>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center', padding: '32px 20px' }}>
                        <ChatIcon style={{ fontSize: 48, color: 'var(--purple)', marginBottom: 12 }} />
                        <h3 style={{ marginBottom: 8 }}>Live Chat</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>Chat with our support team in real-time</p>
                        <button className="btn btn-secondary" onClick={() => alert('Live chat is coming soon! Please use email or phone for now.')}>Start Chat</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
