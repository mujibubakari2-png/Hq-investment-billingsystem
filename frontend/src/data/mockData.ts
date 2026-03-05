import type { Client, Package, Transaction, ExpiredSubscriber, DashboardStats, Router, Voucher, SystemUser, Expense, Invoice, PaymentChannel, TutorialVideo } from '../types';

export const dashboardStats: DashboardStats = {
    totalClients: 95,
    activeSubscribers: 2,
    expiredSubscribers: 10,
    totalRevenue: 150000,
    monthlyRevenue: 45000,
    onlineUsers: 2,
    totalRouters: 1,
    onlineRouters: 1,
};

export const mockClients: Client[] = [
    { id: '1', username: '0746052196', fullName: '0746052196', phone: '255746052196', serviceType: 'Hotspot', status: 'Active', accountType: 'Personal', createdOn: 'Feb 23, 2026', router: 'INVESTMENT-123' },
    { id: '2', username: '0698128719', fullName: '0698128719', phone: '255698128719', serviceType: 'Hotspot', status: 'Active', accountType: 'Personal', createdOn: 'Feb 22, 2026', router: 'INVESTMENT-123', plan: 'masaa 24' },
    { id: '3', username: '0718949891', fullName: '0718949891', phone: '255718949891', serviceType: 'Hotspot', status: 'Active', accountType: 'Personal', createdOn: 'Feb 22, 2026', plan: 'masaa 5' },
    { id: '4', username: '0689662378', fullName: '0689662378', phone: '255689662378', serviceType: 'Hotspot', status: 'Active', accountType: 'Personal', createdOn: 'Feb 22, 2026', plan: 'masaa 5' },
    { id: '5', username: '0617461400', fullName: '061/461400', phone: '255617461400', serviceType: 'Hotspot', status: 'Active', accountType: 'Personal', createdOn: 'Feb 21, 2026', plan: 'siku 3' },
    { id: '6', username: '0616220040', fullName: '0616220040', phone: '255616220040', serviceType: 'Hotspot', status: 'Active', accountType: 'Personal', createdOn: 'Feb 21, 2026', plan: 'masaa 5' },
    { id: '7', username: 'HS-ST11737', fullName: 'HS-ST11737', phone: '', serviceType: 'Hotspot', status: 'Active', accountType: 'Personal', createdOn: 'Feb 17, 2026', plan: 'masaa 24' },
    { id: '8', username: 'HS-XV15026', fullName: 'HS XV15026', phone: '', serviceType: 'Hotspot', status: 'Active', accountType: 'Personal', createdOn: 'Feb 16, 2026', plan: 'masaa 24' },
    { id: '9', username: 'HS-UG65881', fullName: 'HS UG65881', phone: '', serviceType: 'Hotspot', status: 'Active', accountType: 'Personal', createdOn: 'Feb 15, 2026', plan: 'masaa 5' },
    { id: '10', username: 'PPP001', fullName: 'John Mwangi', phone: '255712345678', email: 'john@example.com', serviceType: 'PPPoE', status: 'Active', accountType: 'Business', createdOn: 'Feb 10, 2026', plan: 'siku 7', router: 'INVESTMENT-123' },
    { id: '11', username: 'PPP002', fullName: 'Sarah Odhiambo', phone: '255723456789', serviceType: 'PPPoE', status: 'Suspended', accountType: 'Business', createdOn: 'Feb 5, 2026', plan: 'siku 3', router: 'INVESTMENT-123' },
    { id: '12', username: '0700111222', fullName: 'Ali Hassan', phone: '255700111222', serviceType: 'Hotspot', status: 'Inactive', accountType: 'Personal', createdOn: 'Jan 30, 2026' },
];

export const mockExpiredSubscribers: ExpiredSubscriber[] = [
    { id: '1', username: 'HS-CI961595', plan: 'masaa 5', type: 'Hotspot', router: 'INVESTMENT-123', expiredDate: '2026-02-24 01:01:18', days: 0, method: 'palmpesa - 66753038201639', status: 'Expired' },
    { id: '2', username: 'HS-QN87640', plan: 'masaa 5', type: 'Hotspot', router: 'INVESTMENT-123', expiredDate: '2026-02-22 05:16:31', days: 2, method: 'palmpesa - 83054924031', status: 'Expired' },
    { id: '3', username: 'HS-CH07610', plan: 'masaa 5', type: 'Hotspot', router: 'INVESTMENT-123', expiredDate: '2026-02-22 08:15:51', days: 2, method: 'palmpesa - 60798562123', status: 'Expired' },
    { id: '4', username: 'HS-EY15939', plan: 'masaa 24', type: 'Hotspot', router: 'INVESTMENT-123', expiredDate: '2026-02-21 12:26:25', days: 3, method: 'palmpesa - 80794186527', status: 'Expired' },
    { id: '5', username: 'HS-TI27055', plan: 'masaa 5', type: 'Hotspot', router: 'INVESTMENT-123', expiredDate: '2026-03-01 14:55:30', days: 0, method: 'voucher - 9175', status: 'Extended' },
    { id: '6', username: 'HS-QI861791', plan: 'masaa 24', type: 'Hotspot', router: 'INVESTMENT-123', expiredDate: '2026-02-15 23:22:31', days: 9, method: 'voucher - 5921', status: 'Expired' },
    { id: '7', username: 'HS-ST11737', plan: 'masaa 24', type: 'Hotspot', router: 'INVESTMENT-123', expiredDate: '2026-02-18 03:16:48', days: 6, method: 'voucher - 4790', status: 'Extended' },
    { id: '8', username: 'HS-EA502085', plan: 'masaa 5', type: 'Hotspot', router: 'INVESTMENT-123', expiredDate: '2026-03-01 02:12:15', days: 0, method: 'voucher - 1037', status: 'Expired' },
    { id: '9', username: 'HS-XV15026', plan: 'masaa 24', type: 'Hotspot', router: 'INVESTMENT-123', expiredDate: '2026-02-17 12:03:30', days: 7, method: 'voucher - 2018', status: 'Expired' },
    { id: '10', username: 'HS-UG65881', plan: 'masaa 5', type: 'Hotspot', router: 'INVESTMENT-123', expiredDate: '2026-02-15 15:20:50', days: 9, method: 'voucher - 3067', status: 'Expired' },
];

export const mockPackages: Package[] = [
    { id: '1', name: 'masaa 6', type: 'Hotspot', category: 'Personal', bandwidth: '6M/6M', uploadSpeed: 6, uploadUnit: 'Mbps', downloadSpeed: 6, downloadUnit: 'Mbps', price: 500, router: 'INVESTMENT-123', validity: '6 Hrs', duration: 6, durationUnit: 'Hours', status: 'Active', hotspotType: 'Unlimited', devices: 1 },
    { id: '2', name: 'masaa 24', type: 'Hotspot', category: 'Personal', bandwidth: '6M/6M', uploadSpeed: 6, uploadUnit: 'Mbps', downloadSpeed: 6, downloadUnit: 'Mbps', price: 1000, router: 'INVESTMENT-123', validity: '24 Hrs', duration: 24, durationUnit: 'Hours', status: 'Active', hotspotType: 'Unlimited', devices: 1 },
    { id: '3', name: 'siku 3', type: 'Hotspot', category: 'Personal', bandwidth: '6M/6M', uploadSpeed: 6, uploadUnit: 'Mbps', downloadSpeed: 6, downloadUnit: 'Mbps', price: 2500, router: 'INVESTMENT-123', validity: '3 Days', duration: 3, durationUnit: 'Days', status: 'Active', hotspotType: 'Unlimited', devices: 2 },
    { id: '4', name: 'siku 7', type: 'Hotspot', category: 'Personal', bandwidth: '6M/6M', uploadSpeed: 6, uploadUnit: 'Mbps', downloadSpeed: 6, downloadUnit: 'Mbps', price: 5000, router: 'INVESTMENT-123', validity: '7 Days', duration: 7, durationUnit: 'Days', status: 'Active', hotspotType: 'Unlimited', devices: 3 },
    { id: '5', name: 'masaa 5', type: 'Hotspot', category: 'Personal', bandwidth: '4M/4M', uploadSpeed: 4, uploadUnit: 'Mbps', downloadSpeed: 4, downloadUnit: 'Mbps', price: 300, router: 'INVESTMENT-123', validity: '5 Hrs', duration: 5, durationUnit: 'Hours', status: 'Active', hotspotType: 'Unlimited', devices: 1 },
    { id: '6', name: 'PPPoE Basic', type: 'PPPoE', category: 'Business', bandwidth: '10M/10M', uploadSpeed: 10, uploadUnit: 'Mbps', downloadSpeed: 10, downloadUnit: 'Mbps', price: 15000, router: 'INVESTMENT-123', validity: '30 Days', duration: 30, durationUnit: 'Days', status: 'Active' },
];

export const mockTransactions: Transaction[] = [
    { id: '1', user: '0746052196', planName: 'masaa 24', amount: 1000, type: 'Mobile', method: 'palmpesa', status: 'Completed', date: 'Feb 23, 2026 14:30', expiryDate: 'Feb 24, 2026 14:30', reference: 'PAL-66753038201639' },
    { id: '2', user: '0698128719', planName: 'masaa 5', amount: 300, type: 'Mobile', method: 'palmpesa', status: 'Completed', date: 'Feb 22, 2026 10:15', expiryDate: 'Feb 22, 2026 15:15', reference: 'PAL-83054924031' },
    { id: '3', user: 'HS-ST11737', planName: 'masaa 24', amount: 1000, type: 'Voucher', method: 'voucher', status: 'Completed', date: 'Feb 17, 2026 09:00', expiryDate: 'Feb 18, 2026 09:00', reference: 'VCH-4790' },
    { id: '4', user: '0617461400', planName: 'siku 3', amount: 2500, type: 'Mobile', method: 'palmpesa', status: 'Pending', date: 'Feb 21, 2026 16:45', expiryDate: 'Feb 24, 2026 16:45', reference: 'PAL-90125637482' },
    { id: '5', user: 'HS-XV15026', planName: 'masaa 24', amount: 1000, type: 'Voucher', method: 'voucher', status: 'Completed', date: 'Feb 16, 2026 11:20', expiryDate: 'Feb 17, 2026 11:20', reference: 'VCH-2018' },
    { id: '6', user: 'PPP001', planName: 'PPPoE Basic', amount: 15000, type: 'Manual', method: 'Bank Transfer', status: 'Completed', date: 'Feb 10, 2026 08:00', expiryDate: 'Mar 10, 2026 08:00', reference: 'BNK-202602100001' },
    { id: '7', user: '0689662378', planName: 'masaa 5', amount: 300, type: 'Mobile', method: 'Airtel Money', status: 'Failed', date: 'Feb 22, 2026 19:30', reference: 'AIR-00028374652' },
];

export const mockRouters: Router[] = [
    { id: '1', name: 'INVESTMENT-123', host: '192.168.88.1', username: 'admin', port: 8728, type: 'MikroTik', status: 'Online', activeUsers: 2, cpuLoad: 15, memoryUsed: 42, uptime: '15 days 4:23:11', lastSeen: 'Now' },
];

export const mockVouchers: Voucher[] = [
    { id: '1', code: '9175', plan: 'masaa 5', router: 'INVESTMENT-123', packageType: 'Hotspot', status: 'Used', createdBy: 'Ng\'u bu rash di bakan', createdAt: 'Feb 20, 2026', usedBy: 'HS-TI27055', usedAt: 'Feb 21, 2026', customer: 1 },
    { id: '2', code: '5921', plan: 'masaa 24', router: 'INVESTMENT-123', packageType: 'Hotspot', status: 'Used', createdBy: 'Ng\'u bu rash di bakan', createdAt: 'Feb 14, 2026', usedBy: 'HS-QI861791', usedAt: 'Feb 14, 2026', customer: 2 },
    { id: '3', code: '4790', plan: 'masaa 24', router: 'INVESTMENT-123', packageType: 'Hotspot', status: 'Used', createdBy: 'Ng\'u bu rash di bakan', createdAt: 'Feb 16, 2026', usedBy: 'HS-ST11737', usedAt: 'Feb 16, 2026', customer: 3 },
    { id: '4', code: '8842', plan: 'masaa 5', router: 'INVESTMENT-123', packageType: 'Hotspot', status: 'Unused', createdBy: 'Ng\'u bu rash di bakan', createdAt: 'Feb 22, 2026' },
    { id: '5', code: '3310', plan: 'siku 3', router: 'INVESTMENT-123', packageType: 'Hotspot', status: 'Unused', createdBy: 'Ng\'u bu rash di bakan', createdAt: 'Feb 23, 2026' },
    { id: '6', code: '7723', plan: 'masaa 5', router: 'INVESTMENT-123', packageType: 'Hotspot', status: 'Used', createdBy: 'Ng\'u bu rash di bakan', createdAt: 'Feb 13, 2026', usedBy: 'HS-EA502085', usedAt: 'Feb 13, 2026', customer: 4 },
    { id: '7', code: '1547', plan: 'masaa 5', router: 'INVESTMENT-123', packageType: 'Hotspot', status: 'Used', createdBy: 'Ng\'u bu rash di bakan', createdAt: 'Feb 12, 2026', usedBy: 'HS-UG65881', usedAt: 'Feb 12, 2026', customer: 5 },
    { id: '8', code: '9902', plan: 'masaa 24', router: 'INVESTMENT-123', packageType: 'Hotspot', status: 'Expired', createdBy: 'Ng\'u bu rash di bakan', createdAt: 'Feb 01, 2026' },
    { id: '9', code: '4421', plan: 'siku 7', router: 'INVESTMENT-123', packageType: 'Hotspot', status: 'Unused', createdBy: 'Ng\'u bu rash di bakan', createdAt: 'Feb 24, 2026' },
    { id: '10', code: '6634', plan: 'masaa 5', router: 'INVESTMENT-123', packageType: 'Hotspot', status: 'Used', createdBy: 'Ng\'u bu rash di bakan', createdAt: 'Feb 10, 2026', usedBy: '0746052196', usedAt: 'Feb 10, 2026', customer: 6 },
];

export const mockSystemUsers: SystemUser[] = [
    { id: '1', username: 'admin', email: 'admin@hqinvestment.co.tz', role: 'Super Admin', status: 'Active', lastLogin: 'Feb 24, 2026 09:15', phone: '255700000001' },
    { id: '2', username: 'agent1', email: 'agent1@hqinvestment.co.tz', role: 'Agent', status: 'Active', lastLogin: 'Feb 23, 2026 14:30', phone: '255700000002' },
    { id: '3', username: 'viewer1', email: 'viewer1@hqinvestment.co.tz', role: 'Viewer', status: 'Inactive', lastLogin: 'Feb 10, 2026 10:00' },
];

export const mockExpenses: Expense[] = [
    { id: '1', category: 'Infrastructure', description: 'Fiber optic cable installation', amount: 45000, date: 'Feb 20, 2026', reference: 'EXP-001', createdBy: 'admin' },
    { id: '2', category: 'Maintenance', description: 'Router firmware upgrade service', amount: 8000, date: 'Feb 18, 2026', reference: 'EXP-002', createdBy: 'admin' },
    { id: '3', category: 'Utilities', description: 'Server room electricity bill', amount: 12000, date: 'Feb 15, 2026', reference: 'EXP-003', createdBy: 'agent1' },
    { id: '4', category: 'Staff', description: 'Technician monthly salary', amount: 30000, date: 'Feb 01, 2026', reference: 'EXP-004', createdBy: 'admin' },
    { id: '5', category: 'Equipment', description: 'Ubiquiti NanoBeam purchase', amount: 25000, date: 'Feb 08, 2026', reference: 'EXP-005', createdBy: 'admin' },
];

export const mockInvoices: Invoice[] = [
    { id: '1', invoiceNumber: 'INV-2026-001', client: 'PPP001', amount: 15000, status: 'Paid', dueDate: 'Mar 10, 2026', issuedDate: 'Feb 10, 2026', items: [{ description: 'PPPoE Basic - 30 Days', quantity: 1, unitPrice: 15000, total: 15000 }] },
    { id: '2', invoiceNumber: 'INV-2026-002', client: 'PPP002', amount: 10000, status: 'Unpaid', dueDate: 'Mar 05, 2026', issuedDate: 'Feb 05, 2026', items: [{ description: 'PPPoE Lite - 30 Days', quantity: 1, unitPrice: 10000, total: 10000 }] },
    { id: '3', invoiceNumber: 'INV-2026-003', client: '0746052196', amount: 3000, status: 'Overdue', dueDate: 'Feb 23, 2026', issuedDate: 'Feb 16, 2026', items: [{ description: 'masaa 24 x 3', quantity: 3, unitPrice: 1000, total: 3000 }] },
];

export const mockPaymentChannels: PaymentChannel[] = [
    { id: '1', name: 'PalmPesa', provider: 'M-Pesa', accountNumber: '255700000000', status: 'Active', createdAt: 'Jan 01, 2026' },
    { id: '2', name: 'Airtel Money', provider: 'Airtel Money', accountNumber: '255680000000', status: 'Active', createdAt: 'Jan 01, 2026' },
    { id: '3', name: 'Cash Payment', provider: 'Cash', status: 'Active', createdAt: 'Jan 01, 2026' },
    { id: '4', name: 'Bank Transfer', provider: 'Bank Transfer', accountNumber: 'CRDB: 01234567890', status: 'Inactive', createdAt: 'Jan 15, 2026' },
];

export const mockTutorialVideos: TutorialVideo[] = [
    { id: '1', title: 'Getting Started with the Dashboard', description: 'Learn the basics of navigating and using the ISP billing dashboard.', duration: '5:32', category: 'Basics', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: '2', title: 'Managing Clients & Subscribers', description: 'How to add, edit, and manage your internet clients and subscribers.', duration: '8:15', category: 'Client Management', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: '3', title: 'Creating Service Packages', description: 'Step-by-step guide to creating Hotspot and PPPoE packages.', duration: '6:47', category: 'Package Management', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: '4', title: 'Generating Voucher Codes', description: 'How to bulk generate, print, and manage voucher codes.', duration: '4:20', category: 'Vouchers', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: '5', title: 'MikroTik Router Integration', description: 'Connecting and syncing your MikroTik router with the billing system.', duration: '10:05', category: 'Network', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: '6', title: 'Transaction & Finance Management', description: 'Tracking payments, expenses, and generating financial reports.', duration: '7:33', category: 'Finance', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
];

export const revenueChartData = [
    { name: '01', value: 4000 }, { name: '02', value: 3000 }, { name: '03', value: 2000 },
    { name: '04', value: 2780 }, { name: '05', value: 1890 }, { name: '06', value: 2390 },
    { name: '07', value: 3490 }, { name: '08', value: 2000 }, { name: '09', value: 2780 },
    { name: '10', value: 3500 }, { name: '11', value: 4200 }, { name: '12', value: 3800 },
    { name: '13', value: 4000 }, { name: '14', value: 3200 }, { name: '15', value: 2900 },
    { name: '16', value: 4300 }, { name: '17', value: 5100 }, { name: '18', value: 4600 },
    { name: '19', value: 3900 }, { name: '20', value: 4200 },
];

export const subscriberGrowthData = [
    { month: 'Sep', clients: 45 }, { month: 'Oct', clients: 58 }, { month: 'Nov', clients: 67 },
    { month: 'Dec', clients: 72 }, { month: 'Jan', clients: 83 }, { month: 'Feb', clients: 95 },
];
