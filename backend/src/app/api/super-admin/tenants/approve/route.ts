import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, getUserFromRequest } from "@/lib/auth";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload || userPayload.role !== "SUPER_ADMIN") {
            return errorResponse("Unauthorized. Only Super Admin can approve accounts.", 403);
        }

        const body = await req.json();
        const tenantId = body.tenantId;

        if (!tenantId) {
            return errorResponse("Missing tenantId in request body.", 400);
        }

        const targetTenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!targetTenant) {
            return errorResponse("Tenant not found.", 404);
        }

        if (targetTenant.status !== "PENDING_APPROVAL") {
            return errorResponse(`Tenant is already ${targetTenant.status} — cannot approve again.`, 400);
        }

        // Calculate a fresh 10-day trial starting exactly from the moment of approval
        const trialStart = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 10);

        const updatedTenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                status: "TRIALLING",   // trial tracking — auto-suspends when trialEnd passes
                trialStart,
                trialEnd
            }
        });

        // Send approval email
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || "smtp.ethereal.email",
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === "true",
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            const mailOptions = {
                from: process.env.SMTP_FROM || '"HQ INVESTMENT" <no-reply@hqinvestment.local>',
                to: targetTenant.email,
                subject: "Account Approved - Welcome to HQ INVESTMENT",
                text: `Hello ${targetTenant.name},\n\nYour account has been approved. Your 10-day free trial starts now!\n\nYou can log in here: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173/'}`,
                html: `<div style="font-family: sans-serif; padding: 20px;">
                        <h2>Account Approved!</h2>
                        <p>Hello <strong>${targetTenant.name}</strong>,</p>
                        <p>Your account has been successfully reviewed and approved by our administration team.</p>
                        <p>Your 10-day free trial has been activated and starts <strong>now</strong>.</p>
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173/'}" style="background-color: #1d4ed8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Log In to Dashboard</a>
                       </div>`
            };

            await transporter.sendMail(mailOptions);
            console.log("Approval email sent successfully to", targetTenant.email);
        } catch (mailError) {
            console.error("Failed to send approval email. Check SMTP settings:", mailError);
        }

        return jsonResponse({
            message: "Tenant approved successfully! Their 10-day trial has begun.",
            tenant: {
                id: updatedTenant.id,
                name: updatedTenant.name,
                status: updatedTenant.status,
                trialEnd: updatedTenant.trialEnd
            }
        });

    } catch (e) {
        console.error("Approve Tenant Error:", e);
        return errorResponse("Internal server error", 500);
    }
}
