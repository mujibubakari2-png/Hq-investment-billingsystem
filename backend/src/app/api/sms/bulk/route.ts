import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// POST /api/sms/bulk - send bulk SMS
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { recipients, message, clientIds } = body;

        if (!message) return errorResponse("Message is required");

        const messages = [];

        if (clientIds && clientIds.length > 0) {
            // Send to specific clients
            const clients = await prisma.client.findMany({
                where: { id: { in: clientIds } },
                select: { id: true, phone: true },
            });

            for (const client of clients) {
                if (client.phone) {
                    const sms = await prisma.smsMessage.create({
                        data: {
                            clientId: client.id,
                            recipient: client.phone,
                            message,
                            type: "BROADCAST",
                            status: "SENT",
                        },
                    });
                    messages.push(sms);
                }
            }
        } else if (recipients && recipients.length > 0) {
            // Send to phone numbers directly
            for (const recipient of recipients) {
                const sms = await prisma.smsMessage.create({
                    data: {
                        recipient,
                        message,
                        type: "BROADCAST",
                        status: "SENT",
                    },
                });
                messages.push(sms);
            }
        }

        return jsonResponse({ 
            success: true,
            sent: messages.length, 
            messages 
        }, 201);
    } catch (e) {
        console.error("SMS BULK ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
