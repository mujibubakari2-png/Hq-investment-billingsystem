import { NextResponse } from 'next/server';

// GET /api/plans — Fetch SaaS plans from backend and expose to landing page
export async function GET() {
    try {
        const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
        const res = await fetch(`${backendUrl}/api/saas-plans`, {
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
            console.error('Backend plans fetch failed:', res.status);
            return NextResponse.json([], { status: 200 });
        }

        const plans = await res.json();
        return NextResponse.json(plans);
    } catch (error) {
        console.error('Plans proxy error:', error);
        // Return empty array instead of error so landing page degrades gracefully
        return NextResponse.json([], { status: 200 });
    }
}
