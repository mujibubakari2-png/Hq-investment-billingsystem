import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kenge_isp";

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("🌱 Seeding database...");

    // ─── Clear existing data ────────────────────────────────────────────
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.smsMessage.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.voucher.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.package.deleteMany();
    await prisma.client.deleteMany();
    await prisma.router.deleteMany();
    await prisma.paymentChannel.deleteMany();
    await prisma.messageTemplate.deleteMany();
    await prisma.systemSetting.deleteMany();
    await prisma.userOtp.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.saasPlan.deleteMany();

    console.log("  ✓ Cleared existing data");

    // ─── Saas Plans ─────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const basicPlan = await prisma.saasPlan.create({
        data: {
            id: "plan_basic",
            name: "Basic Plan",
            price: 50000,
            clientLimit: 100,
            createdAt: now,
            updatedAt: now,
        }
    });

    const standardPlan = await prisma.saasPlan.create({
        data: {
            id: "plan_standard",
            name: "Standard Plan",
            price: 150000,
            clientLimit: 500,
            createdAt: now,
            updatedAt: now,
        }
    });

    const premiumPlan = await prisma.saasPlan.create({
        data: {
            id: "plan_premium",
            name: "Premium Plan",
            price: 500000,
            clientLimit: 2000,
            createdAt: now,
            updatedAt: now,
        }
    });

    console.log("  ✓ Created Saas plans");

    // ─── System Users ───────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash("admin123", 12);

    const admin = await prisma.user.create({
        data: {
            username: "admin",
            email: "admin@example.com",
            password: hashedPassword,
            role: "SUPER_ADMIN",
            phone: "255700000001",
            lastLogin: new Date("2026-02-24T09:15:00"),
        },
    });

    const agent = await prisma.user.create({
        data: {
            username: "agent1",
            email: "agent1@hqinvestment.co.tz",
            password: hashedPassword,
            role: "AGENT",
            phone: "255700000002",
            lastLogin: new Date("2026-02-23T14:30:00"),
        },
    });

    await prisma.user.create({
        data: {
            username: "viewer1",
            email: "viewer1@hqinvestment.co.tz",
            password: hashedPassword,
            role: "VIEWER",
            status: "INACTIVE",
            lastLogin: new Date("2026-02-10T10:00:00"),
        },
    });

    // ─── Test User for TestSprite ──────────────────────────────────────────
    await prisma.user.create({
        data: {
            username: "testuser",
            email: "testuser@example.com",
            password: await bcrypt.hash("correct_password", 12),
            role: "ADMIN",
            status: "ACTIVE",
            phone: "255700000009",
            tenantId: (await prisma.tenant.create({
                data: {
                    name: "Test Tenant",
                    email: "testtenant@example.com",
                    planId: "plan_basic",
                }
            })).id,
        },
    });

    console.log("  ✓ Created system users (login: admin / admin123)");

    // ─── Routers ────────────────────────────────────────────────────────
    const router1 = await prisma.router.create({
        data: {
            name: "Core Router",
            host: "192.168.88.1",
            username: "admin",
            password: "password",
            port: 8728,
            apiPort: 8728,
            status: "ONLINE",
        }
    });

    console.log("  ✓ Created routers");

    // ─── Packages ───────────────────────────────────────────────────────
    const package1 = await prisma.package.create({
        data: {
            name: "Hotspot 1GB",
            type: "HOTSPOT",
            price: 1000,
            duration: 1,
            durationUnit: "DAYS",
            routerId: router1.id,
            status: "ACTIVE",
            uploadSpeed: 1,
            downloadSpeed: 1,
        }
    });

    const package2 = await prisma.package.create({
        data: {
            name: "PPPoE 10Mbps",
            type: "PPPOE",
            price: 30000,
            duration: 30,
            durationUnit: "DAYS",
            routerId: router1.id,
            status: "ACTIVE",
            uploadSpeed: 10,
            downloadSpeed: 10,
        }
    });

    console.log("  ✓ Created packages");

    // ─── Clients ────────────────────────────────────────────────────────
    const client1 = await prisma.client.create({
        data: {
            username: "testclient1",
            fullName: "Test Client One",
            email: "client1@example.com",
            phone: "255700000003",
            serviceType: "HOTSPOT",
            status: "ACTIVE",
        }
    });

    console.log("  ✓ Created clients");

    // ─── Transactions ───────────────────────────────────────────────────
    await prisma.transaction.create({
        data: {
            clientId: client1.id,
            amount: 1000,
            type: "MOBILE",
            method: "MPESA",
            status: "COMPLETED",
            reference: "TXN123456",
            planName: "Hotspot 1GB",
        }
    });

    console.log("  ✓ Created transactions");

    // ─── Router ─────────────────────────────────────────────────────────
    const router = await prisma.router.create({
        data: {
            name: "INVESTMENT-123",
            host: "192.168.88.1",
            username: "admin",
            port: 8728,
            type: "MikroTik",
            status: "ONLINE",
            activeUsers: 2,
            cpuLoad: 15,
            memoryUsed: 42,
            uptime: "15 days 4:23:11",
            lastSeen: new Date(),
        },
    });

    console.log("  ✓ Created router");

    // ─── Packages ───────────────────────────────────────────────────────
    const pkg5h = await prisma.package.create({
        data: {
            name: "masaa 5",
            type: "HOTSPOT",
            category: "PERSONAL",
            uploadSpeed: 4,
            downloadSpeed: 4,
            price: 300,
            duration: 5,
            durationUnit: "HOURS",
            hotspotType: "UNLIMITED",
            devices: 1,
            routerId: router.id,
        },
    });

    const pkg6h = await prisma.package.create({
        data: {
            name: "masaa 6",
            type: "HOTSPOT",
            category: "PERSONAL",
            uploadSpeed: 6,
            downloadSpeed: 6,
            price: 500,
            duration: 6,
            durationUnit: "HOURS",
            hotspotType: "UNLIMITED",
            devices: 1,
            routerId: router.id,
        },
    });

    const pkg24h = await prisma.package.create({
        data: {
            name: "masaa 24",
            type: "HOTSPOT",
            category: "PERSONAL",
            uploadSpeed: 6,
            downloadSpeed: 6,
            price: 1000,
            duration: 24,
            durationUnit: "HOURS",
            hotspotType: "UNLIMITED",
            devices: 1,
            routerId: router.id,
        },
    });

    const pkg3d = await prisma.package.create({
        data: {
            name: "siku 3",
            type: "HOTSPOT",
            category: "PERSONAL",
            uploadSpeed: 6,
            downloadSpeed: 6,
            price: 2500,
            duration: 3,
            durationUnit: "DAYS",
            hotspotType: "UNLIMITED",
            devices: 2,
            routerId: router.id,
        },
    });

    const pkg7d = await prisma.package.create({
        data: {
            name: "siku 7",
            type: "HOTSPOT",
            category: "PERSONAL",
            uploadSpeed: 6,
            downloadSpeed: 6,
            price: 5000,
            duration: 7,
            durationUnit: "DAYS",
            hotspotType: "UNLIMITED",
            devices: 3,
            routerId: router.id,
        },
    });

    const pkgPPPoE = await prisma.package.create({
        data: {
            name: "PPPoE Basic",
            type: "PPPOE",
            category: "BUSINESS",
            uploadSpeed: 10,
            downloadSpeed: 10,
            price: 15000,
            duration: 30,
            durationUnit: "DAYS",
            routerId: router.id,
        },
    });

    console.log("  ✓ Created packages");

    // ─── Clients ────────────────────────────────────────────────────────
    const clientsData = [
        { username: "0746052196", fullName: "0746052196", phone: "255746052196", serviceType: "HOTSPOT" as const, pkg: pkg24h },
        { username: "0698128719", fullName: "0698128719", phone: "255698128719", serviceType: "HOTSPOT" as const, pkg: pkg24h },
        { username: "0718949891", fullName: "0718949891", phone: "255718949891", serviceType: "HOTSPOT" as const, pkg: pkg5h },
        { username: "0689662378", fullName: "0689662378", phone: "255689662378", serviceType: "HOTSPOT" as const, pkg: pkg5h },
        { username: "0617461400", fullName: "061/461400", phone: "255617461400", serviceType: "HOTSPOT" as const, pkg: pkg3d },
        { username: "0616220040", fullName: "0616220040", phone: "255616220040", serviceType: "HOTSPOT" as const, pkg: pkg5h },
        { username: "HS-ST11737", fullName: "HS-ST11737", phone: "", serviceType: "HOTSPOT" as const, pkg: pkg24h },
        { username: "HS-XV15026", fullName: "HS XV15026", phone: "", serviceType: "HOTSPOT" as const, pkg: pkg24h },
        { username: "HS-UG65881", fullName: "HS UG65881", phone: "", serviceType: "HOTSPOT" as const, pkg: pkg5h },
        { username: "PPP001", fullName: "John Mwangi", phone: "255712345678", serviceType: "PPPOE" as const, pkg: pkgPPPoE, accountType: "BUSINESS" as const, email: "john@example.com" },
        { username: "PPP002", fullName: "Sarah Odhiambo", phone: "255723456789", serviceType: "PPPOE" as const, pkg: pkg3d, accountType: "BUSINESS" as const, status: "SUSPENDED" as const },
        { username: "0700111222", fullName: "Ali Hassan", phone: "255700111222", serviceType: "HOTSPOT" as const, status: "INACTIVE" as const },
    ];

    const clients: Record<string, { id: string }> = {};

    for (const c of clientsData) {
        const client = await prisma.client.create({
            data: {
                username: c.username,
                fullName: c.fullName,
                phone: c.phone,
                email: (c as { email?: string }).email,
                serviceType: c.serviceType,
                accountType: (c as { accountType?: "PERSONAL" | "BUSINESS" }).accountType || "PERSONAL",
                status: (c as { status?: string }).status as "ACTIVE" | "INACTIVE" | "SUSPENDED" || "ACTIVE",
            },
        });
        clients[c.username] = client;

        // Create active subscription if package specified
        if (c.pkg) {
            const now = new Date();
            const expiresAt = new Date(now);
            if (c.pkg.durationUnit === "HOURS") {
                expiresAt.setHours(expiresAt.getHours() + c.pkg.duration);
            } else if (c.pkg.durationUnit === "DAYS") {
                expiresAt.setDate(expiresAt.getDate() + c.pkg.duration);
            } else if (c.pkg.durationUnit === "MONTHS") {
                expiresAt.setMonth(expiresAt.getMonth() + c.pkg.duration);
            }

            await prisma.subscription.create({
                data: {
                    clientId: client.id,
                    packageId: c.pkg.id,
                    routerId: router.id,
                    status: "ACTIVE",
                    method: "palmpesa",
                    expiresAt,
                },
            });
        }
    }

    console.log("  ✓ Created clients with subscriptions");

    // ─── Expired Subscriptions ──────────────────────────────────────────
    const expiredSubs = [
        { username: "HS-ST11737", pkg: pkg24h, date: "2026-02-18T03:16:48", status: "EXTENDED" as const, method: "voucher - 4790" },
        { username: "HS-XV15026", pkg: pkg24h, date: "2026-02-17T12:03:30", status: "EXPIRED" as const, method: "voucher - 2018" },
        { username: "HS-UG65881", pkg: pkg5h, date: "2026-02-15T15:20:50", status: "EXPIRED" as const, method: "voucher - 3067" },
    ];

    for (const sub of expiredSubs) {
        if (clients[sub.username]) {
            await prisma.subscription.create({
                data: {
                    clientId: clients[sub.username].id,
                    packageId: sub.pkg.id,
                    routerId: router.id,
                    status: sub.status,
                    method: sub.method,
                    activatedAt: new Date(new Date(sub.date).getTime() - sub.pkg.duration * 60 * 60 * 1000),
                    expiresAt: new Date(sub.date),
                },
            });
        }
    }

    console.log("  ✓ Created expired subscriptions");

    // ─── Transactions ───────────────────────────────────────────────────
    const txns = [
        { username: "0746052196", plan: "masaa 24", amount: 1000, method: "palmpesa", status: "COMPLETED" as const, date: "2026-02-23T14:30:00", ref: "PAL-66753038201639" },
        { username: "0698128719", plan: "masaa 5", amount: 300, method: "palmpesa", status: "COMPLETED" as const, date: "2026-02-22T10:15:00", ref: "PAL-83054924031" },
        { username: "HS-ST11737", plan: "masaa 24", amount: 1000, method: "voucher", status: "COMPLETED" as const, date: "2026-02-17T09:00:00", ref: "VCH-4790", type: "VOUCHER" as const },
        { username: "0617461400", plan: "siku 3", amount: 2500, method: "palmpesa", status: "PENDING" as const, date: "2026-02-21T16:45:00", ref: "PAL-90125637482" },
        { username: "HS-XV15026", plan: "masaa 24", amount: 1000, method: "voucher", status: "COMPLETED" as const, date: "2026-02-16T11:20:00", ref: "VCH-2018", type: "VOUCHER" as const },
        { username: "PPP001", plan: "PPPoE Basic", amount: 15000, method: "Bank Transfer", status: "COMPLETED" as const, date: "2026-02-10T08:00:00", ref: "BNK-202602100001", type: "MANUAL" as const },
        { username: "0689662378", plan: "masaa 5", amount: 300, method: "Airtel Money", status: "FAILED" as const, date: "2026-02-22T19:30:00", ref: "AIR-00028374652" },
    ];

    for (const t of txns) {
        if (clients[t.username]) {
            await prisma.transaction.create({
                data: {
                    clientId: clients[t.username].id,
                    planName: t.plan,
                    amount: t.amount,
                    type: (t as { type?: string }).type as "MANUAL" | "MOBILE" | "VOUCHER" || "MOBILE",
                    method: t.method,
                    status: t.status,
                    reference: t.ref,
                    createdAt: new Date(t.date),
                },
            });
        }
    }

    console.log("  ✓ Created transactions");

    // ─── Vouchers ───────────────────────────────────────────────────────
    const vouchersData = [
        { code: "9175", pkg: pkg5h, status: "USED" as const, usedBy: "HS-TI27055", usedAt: "2026-02-21" },
        { code: "5921", pkg: pkg24h, status: "USED" as const, usedBy: "HS-QI861791", usedAt: "2026-02-14" },
        { code: "4790", pkg: pkg24h, status: "USED" as const, usedBy: "HS-ST11737", usedAt: "2026-02-16" },
        { code: "8842", pkg: pkg5h, status: "UNUSED" as const },
        { code: "3310", pkg: pkg3d, status: "UNUSED" as const },
        { code: "7723", pkg: pkg5h, status: "USED" as const, usedBy: "HS-EA502085", usedAt: "2026-02-13" },
        { code: "1547", pkg: pkg5h, status: "USED" as const, usedBy: "HS-UG65881", usedAt: "2026-02-12" },
        { code: "9902", pkg: pkg24h, status: "EXPIRED" as const },
        { code: "4421", pkg: pkg7d, status: "UNUSED" as const },
        { code: "6634", pkg: pkg5h, status: "USED" as const, usedBy: "0746052196", usedAt: "2026-02-10" },
    ];

    for (const v of vouchersData) {
        await prisma.voucher.create({
            data: {
                code: v.code,
                packageId: v.pkg.id,
                routerId: router.id,
                status: v.status,
                createdById: admin.id,
                usedBy: v.usedBy,
                usedAt: v.usedAt ? new Date(v.usedAt) : undefined,
            },
        });
    }

    console.log("  ✓ Created vouchers");

    // ─── Expenses ───────────────────────────────────────────────────────
    const expensesData = [
        { category: "Infrastructure", description: "Fiber optic cable installation", amount: 45000, date: "2026-02-20", ref: "EXP-001", userId: admin.id },
        { category: "Maintenance", description: "Router firmware upgrade service", amount: 8000, date: "2026-02-18", ref: "EXP-002", userId: admin.id },
        { category: "Utilities", description: "Server room electricity bill", amount: 12000, date: "2026-02-15", ref: "EXP-003", userId: agent.id },
        { category: "Staff", description: "Technician monthly salary", amount: 30000, date: "2026-02-01", ref: "EXP-004", userId: admin.id },
        { category: "Equipment", description: "Ubiquiti NanoBeam purchase", amount: 25000, date: "2026-02-08", ref: "EXP-005", userId: admin.id },
    ];

    for (const e of expensesData) {
        await prisma.expense.create({
            data: {
                category: e.category,
                description: e.description,
                amount: e.amount,
                date: new Date(e.date),
                reference: e.ref,
                createdById: e.userId,
            },
        });
    }

    console.log("  ✓ Created expenses");

    // ─── Invoices ───────────────────────────────────────────────────────
    if (clients["PPP001"] && clients["PPP002"] && clients["0746052196"]) {
        await prisma.invoice.create({
            data: {
                invoiceNumber: "INV-2026-001",
                clientId: clients["PPP001"].id,
                amount: 15000,
                status: "PAID",
                dueDate: new Date("2026-03-10"),
                issuedDate: new Date("2026-02-10"),
                items: {
                    create: [{ description: "PPPoE Basic - 30 Days", quantity: 1, unitPrice: 15000, total: 15000 }],
                },
            },
        });

        await prisma.invoice.create({
            data: {
                invoiceNumber: "INV-2026-002",
                clientId: clients["PPP002"].id,
                amount: 10000,
                status: "UNPAID",
                dueDate: new Date("2026-03-05"),
                issuedDate: new Date("2026-02-05"),
                items: {
                    create: [{ description: "PPPoE Lite - 30 Days", quantity: 1, unitPrice: 10000, total: 10000 }],
                },
            },
        });

        await prisma.invoice.create({
            data: {
                invoiceNumber: "INV-2026-003",
                clientId: clients["0746052196"].id,
                amount: 3000,
                status: "OVERDUE",
                dueDate: new Date("2026-02-23"),
                issuedDate: new Date("2026-02-16"),
                items: {
                    create: [{ description: "masaa 24 x 3", quantity: 3, unitPrice: 1000, total: 3000 }],
                },
            },
        });
    }

    console.log("  ✓ Created invoices");

    // ─── Payment Channels ──────────────────────────────────────────────
    await prisma.paymentChannel.createMany({
        data: [
            { name: "PalmPesa", provider: "M-Pesa", accountNumber: "255700000000", status: "ACTIVE" },
            { name: "Airtel Money", provider: "Airtel Money", accountNumber: "255680000000", status: "ACTIVE" },
            { name: "Cash Payment", provider: "Cash", status: "ACTIVE" },
            { name: "Bank Transfer", provider: "Bank Transfer", accountNumber: "CRDB: 01234567890", status: "INACTIVE" },
        ],
    });

    console.log("  ✓ Created payment channels");

    // ─── Message Templates ─────────────────────────────────────────────
    await prisma.messageTemplate.createMany({
        data: [
            { name: "Activation Notice", content: "Dear {name}, your {plan} has been activated. Expires: {expiry}. Thank you!", type: "ACTIVATION", variables: ["name", "plan", "expiry"] },
            { name: "Expiry Warning", content: "Dear {name}, your plan {plan} expires in {hours} hours. Recharge now to stay connected!", type: "EXPIRY", variables: ["name", "plan", "hours"] },
            { name: "Payment Confirmation", content: "Payment of TZS {amount} received for {plan}. Ref: {reference}. Thank you!", type: "PAYMENT", variables: ["amount", "plan", "reference"] },
            { name: "Renewal Reminder", content: "Hi {name}, your internet plan expired. Recharge with any package to get back online!", type: "REMINDER", variables: ["name"] },
        ],
    });

    console.log("  ✓ Created message templates");

    // ─── System Settings ───────────────────────────────────────────────
    await prisma.systemSetting.createMany({
        data: [
            { key: "company_name", value: "HQ Investment", group: "general" },
            { key: "company_email", value: "info@hqinvestment.co.tz", group: "general" },
            { key: "company_phone", value: "255700000001", group: "general" },
            { key: "currency", value: "TZS", group: "general" },
            { key: "timezone", value: "Africa/Dar_es_Salaam", group: "general" },
            { key: "auto_disconnect", value: "true", group: "network" },
            { key: "sms_enabled", value: "true", group: "notifications" },
            { key: "sms_on_activation", value: "true", group: "notifications" },
            { key: "sms_on_expiry", value: "true", group: "notifications" },
        ],
    });

    console.log("  ✓ Created system settings");

    // Use the unused variables to suppress warnings
    void pkg6h;
    void pkg7d;

    console.log("\n✅ Database seeded successfully!");
    console.log("   Login credentials: admin / admin123");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
