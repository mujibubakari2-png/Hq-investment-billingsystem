import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, planName } = await req.json();

    if (!email || !planName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = await readDb();
    const newSubscription = {
      id: Date.now().toString(),
      email,
      planName,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    db.subscriptions.push(newSubscription);
    await writeDb(db);

    return NextResponse.json({ 
      message: "Subscription successful", 
      subscription: newSubscription 
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
