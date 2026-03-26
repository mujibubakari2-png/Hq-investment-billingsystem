import { useState } from 'react';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SearchIcon from '@mui/icons-material/Search';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SchoolIcon from '@mui/icons-material/School';
import RouterIcon from '@mui/icons-material/Router';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import InventoryIcon from '@mui/icons-material/Inventory';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import SettingsIcon from '@mui/icons-material/Settings';
import SmsIcon from '@mui/icons-material/Sms';
import PaymentIcon from '@mui/icons-material/Payment';

interface TutorialVideo {
    id: string;
    title: string;
    description: string;
    duration: string;
    category: string;
    icon: React.ReactNode;
}

const tutorials: TutorialVideo[] = [
    {
        id: '1', title: 'Getting Started with HQ Investment ISP',
        description: 'Learn the basics of the ISP billing system including dashboard overview, navigation, and initial system setup.',
        duration: '8:45', category: 'Getting Started',
        icon: <SchoolIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '2', title: 'Adding & Configuring MikroTik Routers',
        description: 'Step-by-step guide to adding your MikroTik routers, configuring API access, and managing PPPoE/Hotspot profiles.',
        duration: '12:30', category: 'Network',
        icon: <RouterIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '3', title: 'Client Management Guide',
        description: 'How to add, edit, suspend and manage your ISP clients. Includes bulk operations and CSV export methods.',
        duration: '10:15', category: 'Clients',
        icon: <PeopleIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '4', title: 'Creating & Managing Service Packages',
        description: 'Create Hotspot and PPPoE packages with bandwidth limits, durations, burst settings and pricing configuration.',
        duration: '9:20', category: 'Packages',
        icon: <InventoryIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '5', title: 'Voucher Code System',
        description: 'Generate voucher codes for Hotspot access, print voucher batches, and track voucher usage and revenue.',
        duration: '7:50', category: 'Packages',
        icon: <ConfirmationNumberIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '6', title: 'Payment & Transaction Management',
        description: 'Track payments, manage mobile transactions, process recharges and view comprehensive payment records.',
        duration: '11:10', category: 'Finance',
        icon: <ReceiptLongIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '7', title: 'Configuring Payment Channels',
        description: 'Set up M-Pesa, PalmPesa, HarakaPay and other mobile payment channels for automated billing.',
        duration: '14:25', category: 'Finance',
        icon: <PaymentIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '8', title: 'SMS & Communication Setup',
        description: 'Configure SMS notifications for activations, expirations and payment reminders. Create message templates and send bulk SMS.',
        duration: '6:40', category: 'Communications',
        icon: <SmsIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '9', title: 'Hotspot Login Page Customization',
        description: 'Customize the MikroTik Hotspot login page with your company branding, logos, colors and custom fields.',
        duration: '8:55', category: 'Network',
        icon: <RouterIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '10', title: 'System Settings & User Roles',
        description: 'Configure system-wide settings, manage admin/agent users, roles and permissions for secure access control.',
        duration: '7:15', category: 'Administration',
        icon: <SettingsIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '11', title: 'Reports & Analytics Deep Dive',
        description: 'Generate revenue reports, analyze subscriber growth trends, and track expense breakdowns with visual charts.',
        duration: '9:35', category: 'Reports',
        icon: <ReceiptLongIcon style={{ fontSize: 20 }} />,
    },
    {
        id: '12', title: 'Invoice Generation & Management',
        description: 'Create, send and track invoices for your clients. Manage paid/unpaid invoices and generate printable PDF invoices.',
        duration: '6:20', category: 'Finance',
        icon: <ReceiptLongIcon style={{ fontSize: 20 }} />,
    },
];

const categories = ['All', ...Array.from(new Set(tutorials.map(t => t.category)))];

export default function TutorialVideos() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    const filtered = tutorials.filter(t => {
        const matchesSearch =
            t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'rgba(156,39,176,0.12)', color: '#9c27b0' }}>
                        <PlayCircleIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Tutorial Videos</h1>
                        <p className="page-subtitle">Learn how to use every feature of the ISP billing system</p>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="search-input" style={{ flex: 1, minWidth: 200 }}>
                        <SearchIcon className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search tutorials..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 20,
                                    border: selectedCategory === cat ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: selectedCategory === cat ? 'var(--primary)' : 'transparent',
                                    color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: selectedCategory === cat ? 600 : 400,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tutorial Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 20,
            }}>
                {filtered.map(video => (
                    <div
                        key={video.id}
                        className="card"
                        style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        onMouseOver={e => {
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)';
                        }}
                        onMouseOut={e => {
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                            (e.currentTarget as HTMLElement).style.boxShadow = '';
                        }}
                    >
                        {/* Video Thumbnail Placeholder */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1a1d2e 0%, #2d3148 100%)',
                            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                            height: 160,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                        }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backdropFilter: 'blur(8px)',
                                transition: 'transform 0.2s',
                            }}>
                                <PlayCircleIcon style={{ fontSize: 36, color: '#fff' }} />
                            </div>
                            <div style={{
                                position: 'absolute', bottom: 8, right: 10,
                                background: 'rgba(0,0,0,0.7)',
                                color: '#fff', fontSize: '0.72rem', fontWeight: 600,
                                padding: '2px 8px', borderRadius: 4,
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                                <AccessTimeIcon style={{ fontSize: 12 }} />
                                {video.duration}
                            </div>
                            <div style={{
                                position: 'absolute', top: 10, left: 10,
                                background: 'rgba(229,57,53,0.85)',
                                color: '#fff', fontSize: '0.7rem', fontWeight: 600,
                                padding: '3px 10px', borderRadius: 12,
                            }}>
                                {video.category}
                            </div>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: 8,
                                    background: 'var(--primary-light, rgba(229,57,53,0.1))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--primary)',
                                }}>
                                    {video.icon}
                                </div>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3, flex: 1, margin: 0 }}>
                                    {video.title}
                                </h3>
                            </div>
                            <p style={{
                                fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                                margin: 0,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}>
                                {video.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <SearchIcon style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 12 }} />
                    <h3 style={{ fontWeight: 600, marginBottom: 4 }}>No tutorials found</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Try adjusting your search or filter criteria
                    </p>
                </div>
            )}

            {/* Help Banner */}
            <div className="card" style={{ marginTop: 24, overflow: 'hidden' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #1a1d2e 0%, #2d3148 100%)',
                    padding: '32px 28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: 16,
                }}>
                    <div>
                        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>
                            Need more help?
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem' }}>
                            Contact our support team for personalized assistance with your setup
                        </p>
                    </div>
                    <button
                        className="btn"
                        style={{
                            background: '#e53935', color: '#fff', fontWeight: 700,
                            padding: '10px 24px', fontSize: '0.9rem',
                            borderRadius: 8, border: 'none', cursor: 'pointer',
                        }}
                        onClick={() => window.location.href = '/technical-support'}
                    >
                        Contact Support
                    </button>
                </div>
            </div>
        </div>
    );
}
