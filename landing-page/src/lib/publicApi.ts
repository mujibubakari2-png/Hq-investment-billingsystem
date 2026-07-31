import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/utils";

export function parseBoundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function publicApiError(scope: string, error: unknown, fallback: string, status = 500) {
  console.error(`[PUBLIC/${scope}] Error:`, error);
  return NextResponse.json(
    { success: false, error: getErrorMessage(error, fallback) },
    { status },
  );
}
