import { prisma } from '../src/lib/prisma';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import 'dotenv/config';



const API_BASE = process.env.APP_URL || 'http://localhost:3000';
const PROVIDERS = ['PALMPESA', 'ZENOPAY', 'HARAKAPAY', 'MONGIKE'];

function getAccessSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("Invalid JWT_ACCESS_SECRET");
    }
    return secret;
}

function signTestToken(payload: any): string {
    return jwt.sign(
        { ...payload, tokenType: "access" },
        getAccessSecret(),
        {
            expiresIn: "2h",
            issuer: "hq-investment-isp",
            audience: "hq-investment-app",
        }
    );
}

// Ensure the tenant has all required payment channels configured
async function setupPaymentChannels(tenantId: string) {
    console.log('\n--- Setting up Payment Channels ---');
    
    for (const provider of PROVIDERS) {
        // Platform Global Channel (tenantId = null) for License renewals
        const existingGlobal = await prisma.paymentChannel.findFirst({
            where: { provider, tenantId: null }
        });
        
        if (!existingGlobal) {
            console.log(`Creating global PaymentChannel for ${provider}...`);
            await prisma.paymentChannel.create({
                data: {
                    name: provider,
                    provider,
                    status: 'ACTIVE',
                    webhookSecret: 'test-webhook-secret-123',
                }
            });
        }
        
        // Tenant Channel for Customer Payments
        const existingTenant = await prisma.paymentChannel.findFirst({
            where: { provider, tenantId }
        });
        
        if (!existingTenant) {
            console.log(`Creating tenant PaymentChannel for ${provider}...`);
            await prisma.paymentChannel.create({
                data: {
                    name: provider,
                    provider,
                    status: 'ACTIVE',
                    tenantId,
                    webhookSecret: 'test-webhook-secret-123',
                }
            });
        }
    }
}

async function runTests() {
    console.log('=== STARTING PAYMENT CHANNEL TESTS ===');
    console.log(`API Base URL: ${API_BASE}`);
    
    // 1. Setup Mock DB Data
    console.log('\n--- Setting up DB Data ---');
    const plan = await prisma.saasPlan.findFirst() || await prisma.saasPlan.create({
        data: { name: 'Test Plan', price: 10000, pppoeLimit: 10, maxRouters: 1 }
    });

    let tenant = await prisma.tenant.findFirst({ where: { slug: 'test-tenant' } });
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'Test Tenant',
                slug: 'test-tenant',
                status: 'ACTIVE',
                planId: plan.id,
                email: 'test@example.com'
            }
        });
    }
    
    let admin = await prisma.user.findFirst({ where: { tenantId: tenant.id, role: 'ADMIN' } });
    if (!admin) {
        admin = await prisma.user.create({
            data: {
                tenantId: tenant.id,
                email: 'admin@test-tenant.com',
                username: 'testadmin',
                password: 'dummy',
                role: 'ADMIN',
                fullName: 'Test Admin'
            }
        });
    }

    // Set up Global and Tenant payment channels for webhook tests
    await setupPaymentChannels(tenant.id);

    const token = signTestToken({
        userId: admin.id,
        username: admin.username,
        role: admin.role,
        tenantId: tenant.id
    });
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    // 2. Test License Renewal Flows
    console.log('\n=============================================');
    console.log('   TESTING SAAS LICENSE RENEWALS (PLATFORM)    ');
    console.log('=============================================');
    
    for (const provider of PROVIDERS) {
        console.log(`\n--- Testing License Flow for ${provider} ---`);
        
        // Setup pending invoice
        const invoiceNumber = `INV-TEST-${provider}-${Date.now()}`;
        const invoice = await prisma.tenantInvoice.create({
            data: {
                invoiceNumber,
                tenantId: tenant.id,
                planId: plan.id,
                packageMonths: 1,
                amount: 1000,
                status: 'PENDING',
                dueDate: new Date()
            }
        });

        // 2a. Test Webhook Simulation
        const webhookSecret = 'test-webhook-secret-123';
        
        let webhookPayload: any;
        let webhookHeaders: any = { 'Content-Type': 'application/json' };
        
        if (provider === 'PALMPESA') {
            webhookPayload = { TransactionId: 'TX123', AccountReference: invoiceNumber, Amount: 1000, ResultCode: '0' };
            webhookHeaders['x-webhook-secret'] = webhookSecret;
        } else if (provider === 'ZENOPAY') {
            webhookPayload = { order_id: invoiceNumber, transaction_id: 'TX123', amount: 1000, status: 'COMPLETED' };
            const hmac = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(webhookPayload)).digest('hex');
            webhookHeaders['x-zeno-signature'] = hmac;
        } else if (provider === 'HARAKAPAY') {
            webhookPayload = { reference: invoiceNumber, transaction_id: 'TX123', amount: 1000, status: 'COMPLETED' };
            const hmac = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(webhookPayload)).digest('hex');
            webhookHeaders['x-haraka-signature'] = hmac;
        } else if (provider === 'MONGIKE') {
            webhookPayload = { reference: invoiceNumber, transaction_id: 'TX123', amount: 1000, status: 'COMPLETED' };
            const hmac = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(webhookPayload)).digest('hex');
            webhookHeaders['x-mongike-signature'] = hmac;
        }

        console.log(`Simulating webhook for License Invoice ${invoiceNumber}...`);
        const webhookUrl = `${API_BASE}/api/payments/${provider.toLowerCase()}/webhook`;
        try {
            const webhookRes = await fetch(webhookUrl, { method: 'POST', headers: webhookHeaders, body: JSON.stringify(webhookPayload) });
            const webhookJson = await webhookRes.json();
            
            if (webhookRes.ok) {
                console.log(`✅ Webhook success: ${JSON.stringify(webhookJson)}`);
                const updatedInvoice = await prisma.tenantInvoice.findUnique({ where: { id: invoice.id } });
                if (updatedInvoice?.status === 'PAID') {
                    console.log(`✅ Database verify: Invoice status is PAID`);
                } else {
                    console.log(`❌ Database verify failed: Invoice status is ${updatedInvoice?.status}`);
                }
            } else {
                console.log(`❌ Webhook failed: [${webhookRes.status}] ${JSON.stringify(webhookJson)}`);
            }
        } catch (err: any) {
            console.log(`❌ Webhook error: ${err.message}`);
        }
    }


    // 3. Test Customer Hotspot/PPPoE Flows
    console.log('\n=============================================');
    console.log(' TESTING CUSTOMER PAYMENTS (TENANT LEVEL)      ');
    console.log('=============================================');

    let package_db = await prisma.package.findFirst({ where: { tenantId: tenant.id } });
    if (!package_db) {
        package_db = await prisma.package.create({
            data: { name: 'Test Package', price: 1000, type: 'HOTSPOT', uploadSpeed: 10, downloadSpeed: 10, tenantId: tenant.id, duration: 1, durationUnit: 'MONTHS' }
        });
    }

    let client = await prisma.client.findFirst({ where: { tenantId: tenant.id } });
    if (!client) {
        client = await prisma.client.create({
            data: { username: 'testclient', fullName: 'Test Client', phone: '0700000000', serviceType: 'HOTSPOT', status: 'ACTIVE', tenantId: tenant.id }
        });
    }

    for (const provider of PROVIDERS) {
        console.log(`\n--- Testing Customer Flow for ${provider} ---`);
        
        // Setup pending transaction
        const refNumber = `TX-TEST-${provider}-${Date.now()}`;
        const transaction = await prisma.transaction.create({
            data: {
                reference: refNumber,
                amount: 1000,
                status: 'PENDING',
                type: 'MOBILE',
                method: provider,
                clientId: client.id,
                tenantId: tenant.id,
                packageId: package_db.id,
                planName: package_db.name
            }
        });

        // 3b. Test Webhook Simulation
        const webhookSecret = 'test-webhook-secret-123';
        
        let webhookPayload: any;
        let webhookHeaders: any = { 'Content-Type': 'application/json' };
        
        if (provider === 'PALMPESA') {
            webhookPayload = { TransactionId: 'TX456', AccountReference: refNumber, Amount: 1000, ResultCode: '0' };
            webhookHeaders['x-webhook-secret'] = webhookSecret;
        } else if (provider === 'ZENOPAY') {
            webhookPayload = { order_id: refNumber, transaction_id: 'TX456', amount: 1000, status: 'COMPLETED' };
            const hmac = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(webhookPayload)).digest('hex');
            webhookHeaders['x-zeno-signature'] = hmac;
        } else if (provider === 'HARAKAPAY') {
            webhookPayload = { reference: refNumber, transaction_id: 'TX456', amount: 1000, status: 'COMPLETED' };
            const hmac = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(webhookPayload)).digest('hex');
            webhookHeaders['x-haraka-signature'] = hmac;
        } else if (provider === 'MONGIKE') {
            webhookPayload = { reference: refNumber, transaction_id: 'TX456', amount: 1000, status: 'COMPLETED' };
            const hmac = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(webhookPayload)).digest('hex');
            webhookHeaders['x-mongike-signature'] = hmac;
        }

        console.log(`Simulating webhook for Customer Transaction ${refNumber}...`);
        const webhookUrl = `${API_BASE}/api/webhooks/tenant/${tenant.id}/${provider}`;
        try {
            const webhookRes = await fetch(webhookUrl, { method: 'POST', headers: webhookHeaders, body: JSON.stringify(webhookPayload) });
            const webhookJson = await webhookRes.json();
            
            if (webhookRes.ok) {
                console.log(`✅ Webhook success: ${JSON.stringify(webhookJson)}`);
                const updatedTx = await prisma.transaction.findUnique({ where: { id: transaction.id } });
                if (updatedTx?.status === 'COMPLETED') {
                    console.log(`✅ Database verify: Transaction status is COMPLETED`);
                } else {
                    console.log(`❌ Database verify failed: Transaction status is ${updatedTx?.status}`);
                }
            } else {
                console.log(`❌ Webhook failed: [${webhookRes.status}] ${JSON.stringify(webhookJson)}`);
            }
        } catch (err: any) {
            console.log(`❌ Webhook error: ${err.message}`);
        }
    }

    console.log('\n=== TESTING COMPLETED ===');
    await prisma.$disconnect();
}

runTests().catch(e => {
    console.error('Test script failed:', e);
    prisma.$disconnect();
    process.exit(1);
});
