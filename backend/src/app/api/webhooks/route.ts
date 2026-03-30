import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// Basic Webhook Handler for Gateways (M-Pesa, AzamPay, Stripe, Etc)

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        // Example check: Assuming M-Pesa or a generalized generic provider structure
        // providers often send an identifier like transactionId, amount, status
        console.log('--- Incoming Webhook ---');
        console.log(JSON.stringify(payload, null, 2));

        const { TransactionID, Amount, BillRefNumber, TransTime, BusinessShortCode } = payload;

        // 1. Authenticate Request
        // Some providers use HMAC signatures in Headers.
        // const signature = req.headers.get('x-provider-signature');
        // if (!isValidSignature(JSON.stringify(payload), signature, process.env.WEBHOOK_SECRET)) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        if (TransactionID && Amount && BillRefNumber) {
            // Probably M-Pesa C2B

            // Check if Transaction already exists
            const existingTx = await prisma.transaction.findUnique({
                where: { reference: TransactionID }
            });

            if (existingTx) {
                return NextResponse.json({ message: 'Transaction already processed' });
            }

            // Find Client based on BillRefNumber (could be phone or username)
            const client = await prisma.client.findFirst({
                where: { OR: [{ phone: BillRefNumber }, { username: BillRefNumber }] },
                include: {
                    subscriptions: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        include: { package: true }
                    }
                }
            });

            if (client) {
                let planName = 'Unknown Package';
                let packageId = null;
                let routerId = null;

                const lastSub = client.subscriptions[0];
                if (lastSub && lastSub.package) {
                    planName = lastSub.package.name;
                    packageId = lastSub.package.id;
                    routerId = lastSub.routerId || lastSub.package.routerId;
                }

                // Record Transaction
                await prisma.transaction.create({
                    data: {
                        clientId: client.id,
                        planName,
                        amount: Number(Amount),
                        type: 'MOBILE',
                        status: 'COMPLETED',
                        method: 'M-PESA/MOBILE-MONEY',
                        reference: TransactionID,
                    }
                });

                if (lastSub && lastSub.package && routerId) {
                    const pkg = lastSub.package;
                    const now = new Date();
                    const currentExpiry = new Date(lastSub.expiresAt);
                    let baseDate = now;

                    // If currently active and unexpired, append time. Otherwise start from now.
                    if (currentExpiry > now && lastSub.status === "ACTIVE") {
                        baseDate = currentExpiry;
                    }

                    const newExpiresAt = new Date(baseDate);
                    if (pkg.durationUnit === "MONTHS") {
                        newExpiresAt.setMonth(newExpiresAt.getMonth() + pkg.duration);
                    } else if (pkg.durationUnit === "DAYS") {
                        newExpiresAt.setDate(newExpiresAt.getDate() + pkg.duration);
                    } else if (pkg.durationUnit === "HOURS") {
                        newExpiresAt.setHours(newExpiresAt.getHours() + pkg.duration);
                    } else if (pkg.durationUnit === "MINUTES") {
                        newExpiresAt.setMinutes(newExpiresAt.getMinutes() + pkg.duration);
                    }

                    // Top up subscription
                    await prisma.subscription.update({
                        where: { id: lastSub.id },
                        data: {
                            expiresAt: newExpiresAt,
                            status: "ACTIVE",
                            updatedAt: new Date()
                        }
                    });

                    // Update client status
                    await prisma.client.update({
                        where: { id: client.id },
                        data: { status: "ACTIVE" }
                    });

                    // Physical Router Activation
                    try {
                        const { getMikroTikService } = await import("@/lib/mikrotik");
                        const mikrotik = await getMikroTikService(routerId);
                        const pwd = client.phone || "123456";
                        const type = client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
                        await mikrotik.activateService(client.username, pwd, pkg.name, type);

                        // Log success
                        await prisma.routerLog.create({
                            data: {
                                routerId: routerId,
                                action: "PAYMENT_ACTIVATION_SUCCESS",
                                details: `Webhook paid ${Amount} for ${pkg.name}. Activated ${type}`,
                                status: "success",
                                username: client.username
                            }
                        });
                    } catch (err: any) {
                        console.error("Webhook MikroTik activation error:", err);
                        await prisma.routerLog.create({
                            data: {
                                routerId: routerId,
                                action: "PAYMENT_ACTIVATION_FAILED",
                                details: `Webhook paid ${Amount} but activation failed: ${err.message}`,
                                status: "error",
                                username: client.username
                            }
                        });
                    }
                } else {
                    console.warn(`Client ${client.username} paid but has no previous subscription to renew.`);
                }
            } else {
                console.warn(`Webhook received for unknown user/ref: ${BillRefNumber}`);
                // Still record it as an unassigned transaction if necessary (requires schema adjustment to allow null clientId, skipping for now)
            }
        }

        return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });

    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
