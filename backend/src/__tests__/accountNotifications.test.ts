/// <reference types="jest" />

const mockGetTenantClient = jest.fn();
const mockSendEmail = jest.fn();
const mockSmsCreate = jest.fn();

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
}));

jest.mock('@/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Account notifications', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
    process.env.ACCOUNT_NOTIFICATIONS_ENABLED = 'true';
    process.env.ACCOUNT_SMS_NOTIFICATIONS_ENABLED = 'false';
    process.env.ACCOUNT_PORTAL_URL = 'https://portal.example.com';
  });

  it('sends account created email when notifications are enabled', async () => {
    const { sendAccountCreatedNotifications } = require('@/lib/accountNotifications');
    mockGetTenantClient.mockReturnValue({
      smsMessage: { create: mockSmsCreate },
    });
    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-1' });

    await sendAccountCreatedNotifications({
      tenantId: 'tenant-x',
      tenantName: 'Tenant X',
      email: 'user@example.com',
      phone: '+10000000000',
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.com',
      subject: 'Account Received - Pending Approval',
      text: expect.stringContaining('Your account was created successfully'),
    }));
    expect(mockSmsCreate).not.toHaveBeenCalled();
  });

  it('logs an SMS record when SMS notifications are enabled for account approved notifications', async () => {
    const { sendAccountApprovedNotifications } = require('@/lib/accountNotifications');
    process.env.ACCOUNT_SMS_NOTIFICATIONS_ENABLED = 'true';
    mockGetTenantClient.mockReturnValue({
      smsMessage: { create: mockSmsCreate },
    });
    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-2' });

    await sendAccountApprovedNotifications({
      tenantId: 'tenant-y',
      tenantName: 'Tenant Y',
      email: 'tenanty@example.com',
      phone: '+10000000001',
    });

    expect(mockGetTenantClient).toHaveBeenCalledWith('tenant-y');
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSmsCreate).toHaveBeenCalledTimes(1);
    expect(mockSmsCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipient: '+10000000001',
        message: expect.stringContaining('your account is approved'),
        tenantId: 'tenant-y',
      }),
    });
  });

  it('skips all notifications when ACCOUNT_NOTIFICATIONS_ENABLED is false', async () => {
    const { sendAccountCreatedNotifications } = require('@/lib/accountNotifications');
    process.env.ACCOUNT_NOTIFICATIONS_ENABLED = 'false';
    mockGetTenantClient.mockReturnValue({
      smsMessage: { create: mockSmsCreate },
    });

    await sendAccountCreatedNotifications({
      tenantId: 'tenant-z',
      tenantName: 'Tenant Z',
      email: 'tenantz@example.com',
      phone: '+10000000002',
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSmsCreate).not.toHaveBeenCalled();
  });
});
