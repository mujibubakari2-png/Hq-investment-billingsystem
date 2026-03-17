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
                where: { OR: [{ phone: BillRefNumber }, { username: BillRefNumber }] }
            });

            if (client) {
                // Record Transaction
                await prisma.transaction.create({
                    data: {
                        clientId: client.id,
                        amount: Number(Amount),
                        type: 'MOBILE',
                        status: 'COMPLETED',
                        method: 'M-PESA',
                        reference: TransactionID,
                    }
                });

                // Top up wallet / renew subscription logic here
                // ...
            } else {
                console.warn(`Webhook received for unknown user/ref: ${BillRefNumber}`);
                // Still record it as an unassigned transaction perhaps
            }
        }

        return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });

    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
