import { render, fireEvent, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import AddClientModal from '../modals/AddClientModal';
import AddEquipmentModal from '../modals/AddEquipmentModal';
import AddExpenseModal from '../modals/AddExpenseModal';
import AddMessageTemplateModal from '../modals/AddMessageTemplateModal';
import AddPackageModal from '../modals/AddPackageModal';
import AddPaymentChannelModal from '../modals/AddPaymentChannelModal';
import AddRouterModal from '../modals/AddRouterModal';
import AddSystemUserModal from '../modals/AddSystemUserModal';
import AddTransactionModal from '../modals/AddTransactionModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import CreateInvoiceModal from '../modals/CreateInvoiceModal';
import EditClientModal from '../modals/EditClientModal';
import EditEquipmentModal from '../modals/EditEquipmentModal';
import EditExpenseModal from '../modals/EditExpenseModal';
import EditMessageTemplateModal from '../modals/EditMessageTemplateModal';
import EditVoucherModal from '../modals/EditVoucherModal';
import ExtendSubscriberModal from '../modals/ExtendSubscriberModal';
import GenerateVouchersModal from '../modals/GenerateVouchersModal';
import MikrotikScriptModal from '../modals/MikrotikScriptModal';
import RouterDetailModal from '../modals/RouterDetailModal';
import SendSmsModal from '../modals/SendSmsModal';
import ViewClientModal from '../modals/ViewClientModal';
import ViewInvoiceModal from '../modals/ViewInvoiceModal';
import ViewTransactionModal from '../modals/ViewTransactionModal';
import WireGuardConfigModal from '../modals/WireGuardConfigModal';

vi.mock('../api', () => ({
    clientsApi: {
        create: vi.fn(() => Promise.resolve({})),
        update: vi.fn(() => Promise.resolve({})),
        list: vi.fn(() => Promise.resolve([])),
    },
    routersApi: {
        list: vi.fn(() => Promise.resolve([])),
        wireguard: {
            getConfig: vi.fn(() => Promise.resolve({ config: 'sample config', status: 'active' })),
            activate: vi.fn(() => Promise.resolve({})),
            deactivate: vi.fn(() => Promise.resolve({})),
            pushConfig: vi.fn(() => Promise.resolve({})),
        },
    },
    paymentChannelsApi: {
        create: vi.fn(() => Promise.resolve({})),
    },
    packagesApi: {
        list: vi.fn(() => Promise.resolve([])),
    },
    systemUsersApi: {
        list: vi.fn(() => Promise.resolve({ users: [] })),
    },
    smsApi: {
        send: vi.fn(() => Promise.resolve({})),
    },
}));

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) } as any)));

const router = {
    id: 'router-1',
    name: 'Router 1',
    host: '192.168.88.1',
    apiPort: 8728,
    port: 8728,
    status: 'Online',
    activeUsers: 0,
    cpuLoad: 0,
    memoryUsed: 0,
    uptime: '1h',
    lastSeen: new Date().toISOString(),
    type: 'MikroTik',
    username: 'admin',
    password: 'secret',
    lanIp: '192.168.88.1/24',
    lanGateway: '192.168.88.1',
    hotspotPoolRange: '192.168.88.10-192.168.88.100',
    pppoePoolRange: '192.168.88.200-192.168.88.250',
    dns: '8.8.8.8',
} as any;
const client = { id: 'client-1', fullName: 'Test Client', username: 'testclient', email: 'test@example.com', phone: '0712345678', accountType: 'Personal', status: 'Active', serviceType: 'Hotspot', createdOn: '2026-01-01', plan: 'Basic', router: null } as any;
const transaction = { id: 'tx-1', username: 'testclient', planId: 'plan-1', amount: 1000, type: 'payment', method: 'cash', reference: 'ref', router: 'router-1', notes: 'note' } as any;
const invoice = { id: 'inv-1', invoiceNumber: 'INV-001', client: 'Test Client', amount: 1000, status: 'Paid', dueDate: '2026-08-01', issuedDate: '2026-07-01', items: [{ description: 'Service', quantity: 1, unitPrice: 1000, total: 1000 }] } as any;
const voucher = { id: 'voucher-1', code: 'ABC123', status: 'Active', plan: 'Basic', router: 'router-1', createdBy: 'admin', createdAt: '2026-07-01' } as any;
const expense = { id: 'expense-1', category: 'Maintenance', description: 'Fix', amount: 5000, date: '2026-07-07', reference: 'REF-1', createdBy: 'admin' } as any;
const template = { id: 'tmpl-1', name: 'Welcome', type: 'Custom', content: 'Hello' } as any;
const subscriber = { id: 'sub-1', name: 'Subscriber', planId: 'plan-1' } as any;

const clickClose = (container: HTMLElement) => {
    const closeButton = container.querySelector('.modal-close') as HTMLElement | null;
    if (closeButton) {
        fireEvent.click(closeButton);
        return;
    }
    const overlay = container.querySelector('.modal-overlay') as HTMLElement | null;
    if (overlay) {
        fireEvent.click(overlay);
        return;
    }
    throw new Error('No close control found');
};

const expectModalOpen = (text: RegExp) => {
    const matches = within(document.body).queryAllByText(text);
    expect(matches.length).toBeGreaterThan(0);
};

const getModalTitle = (container: HTMLElement, text: RegExp) => {
    const root = container && typeof (container as any).querySelector === 'function'
        ? ((container.querySelector('.modal') as HTMLElement | null) ?? container)
        : document.body;
    const titleElement = (root.querySelector('.modal-title, h1, h2, h3') as HTMLElement | null)
        || Array.from(root.querySelectorAll('*')).find(el => text.test(el.textContent || '')) as HTMLElement | null;
    if (!titleElement) {
        throw new Error('Modal title element not found');
    }
    expect(text.test(titleElement.textContent || '')).toBe(true);
    return titleElement;
};

describe('Frontend modals', () => {
    let onClose: () => void;
    let onSave: (...args: any[]) => void;
    let onGenerate: () => Promise<void>;
    let onDelete: () => void;
    let onSend: (data: any) => void;
    let onEdit: (data?: any) => void;

    beforeEach(() => {
        onClose = vi.fn<() => void>();
        onSave = vi.fn<(...args: any[]) => void>();
        onGenerate = vi.fn<() => Promise<void>>(async () => {});
        onDelete = vi.fn<() => void>();
        onSend = vi.fn<(data: any) => void>();
        onEdit = vi.fn<(data?: any) => void>();
        vi.clearAllMocks();
    });

    it('renders AddClientModal and closes', () => {
        const { container } = render(<AddClientModal onClose={onClose} onSave={onSave} />);
        expect(screen.getByText(/Add New Client/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders AddEquipmentModal and closes', () => {
        const { container } = render(<AddEquipmentModal onClose={onClose} onSave={onSave} />);
        expect(getModalTitle(container, /Add Equipment/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders AddExpenseModal and closes', () => {
        const { container } = render(<AddExpenseModal onClose={onClose} onSave={onSave} />);
        expect(getModalTitle(container, /Add Expense/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders AddMessageTemplateModal and closes', () => {
        const { container } = render(<AddMessageTemplateModal onClose={onClose} onSave={onSave} />);
        expect(getModalTitle(container, /Add Message Template/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders AddPackageModal and closes', () => {
        const { container } = render(<AddPackageModal onClose={onClose} onSave={onSave} />);
        expect(getModalTitle(container, /Add Package/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders AddPaymentChannelModal and closes', () => {
        const { container } = render(<AddPaymentChannelModal onClose={onClose} onSave={onSave} />);
        expect(getModalTitle(container, /Add Payment Channel/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders AddRouterModal and closes', () => {
        const { container } = render(<AddRouterModal onClose={onClose} onSave={onSave} />);
        expect(getModalTitle(container, /Add New Router/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders AddSystemUserModal and closes', () => {
        const { container } = render(<AddSystemUserModal onClose={onClose} onSave={onSave} />);
        expectModalOpen(/Add (Team Member|User|System User)/i);
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders AddTransactionModal and closes', () => {
        const { container } = render(<AddTransactionModal onClose={onClose} onSave={onSave} />);
        expect(getModalTitle(container, /Add Transaction/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders ConfirmDeleteModal and closes', () => {
        const { container } = render(<ConfirmDeleteModal title="Confirm" message="Delete?" onClose={onClose} onConfirm={onClose} />);
        expect(screen.getByText(/Confirm/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders CreateInvoiceModal and closes', () => {
        const { container } = render(<CreateInvoiceModal onClose={onClose} onSave={onSave} />);
        expect(getModalTitle(container, /Create Invoice/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders EditClientModal and closes', () => {
        const { container } = render(<EditClientModal client={client} onClose={onClose} onSave={onSave} />);
        expect(screen.getByText(/Edit Client/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders EditEquipmentModal and closes', () => {
        const { container } = render(<EditEquipmentModal equipment={{ id: 'equip-1', name: 'router', type: 'Router', serialNumber: 'SN-1234', status: 'Active', location: 'site' }} onClose={onClose} onSave={onSave} />);
        expect(screen.getByText(/Edit Equipment/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders EditExpenseModal and closes', () => {
        const { container } = render(<EditExpenseModal expense={expense} onClose={onClose} onSave={onSave} />);
        expect(screen.getByText(/Edit Expense/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders EditMessageTemplateModal and closes', () => {
        const { container } = render(<EditMessageTemplateModal template={template} onClose={onClose} onSave={onSave} />);
        expect(getModalTitle(container, /Edit Template/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders EditVoucherModal and closes', () => {
        const { container } = render(<EditVoucherModal voucher={voucher} onClose={onClose} onSave={onSave} />);
        expect(screen.getByText(/Edit Voucher/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders ExtendSubscriberModal and closes', () => {
        const { container } = render(<ExtendSubscriberModal subscriber={subscriber} onClose={onClose} onSave={onSave} />);
        expect(getModalTitle(container, /Extend Subscription/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders GenerateVouchersModal and closes', () => {
        const { container } = render(<GenerateVouchersModal onClose={onClose} onGenerate={onGenerate} />);
        expect(getModalTitle(container, /Generate Vouchers/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders MikrotikScriptModal and closes', () => {
        const { container } = render(<MikrotikScriptModal router={router} onClose={onClose} />);
        expect(screen.getByText(/MikroTik Configuration Script/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });



    it('renders RouterDetailModal and closes', () => {
        const { container } = render(
            <MemoryRouter>
                <RouterDetailModal router={router} onClose={onClose} onDelete={onDelete} />
            </MemoryRouter>
        );
        expect(screen.getByText(router.name)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders SendSmsModal and closes', () => {
        const { container } = render(<SendSmsModal templates={[]} onClose={onClose} onSend={onSend} />);
        expect(getModalTitle(container, /Send SMS/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders ViewClientModal and closes', () => {
        const { container } = render(<ViewClientModal client={client} onClose={onClose} onEdit={onEdit} />);
        expect(screen.getByText(/Client Details|View Client/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders ViewInvoiceModal and closes', () => {
        const { container } = render(<ViewInvoiceModal invoice={invoice} onClose={onClose} />);
        expect(screen.getByText(`Invoice ${invoice.invoiceNumber}`)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders ViewTransactionModal and closes', () => {
        const { container } = render(<ViewTransactionModal transaction={transaction} onClose={onClose} />);
        expect(screen.getByText(/Transaction Details|View Transaction/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders WireGuardConfigModal and closes', () => {
        const { container } = render(<WireGuardConfigModal router={router} onClose={onClose} />);
        expect(screen.getByText(/WireGuard/i)).toBeInTheDocument();
        clickClose(container);
        expect(onClose).toHaveBeenCalled();
    });
});
