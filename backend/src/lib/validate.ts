/**
 * API Request Body Validation Helper
 *
 * BE-003 FIX: Provides a single, consistent way to validate and parse
 * incoming request bodies against a Zod schema before any handler logic runs.
 *
 * Usage in any API route:
 *
 *   import { parseBody } from '@/lib/validate';
 *   import { z } from 'zod';
 *
 *   const CreateClientSchema = z.object({
 *     username:    z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/),
 *     fullName:    z.string().min(1).max(128),
 *     phone:       z.string().optional(),
 *     serviceType: z.enum(['HOTSPOT', 'PPPOE']),
 *   });
 *
 *   export async function POST(req: NextRequest) {
 *     const result = await parseBody(CreateClientSchema, req);
 *     if (!result.ok) return result.error;  // 400 response with Zod errors
 *     const data = result.data;             // fully typed and validated
 *     ...
 *   }
 */

import { NextRequest } from 'next/server';
import { ZodSchema, ZodError, z } from 'zod';
import { errorResponse } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ParseResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: Response };

// ── Core Helper ───────────────────────────────────────────────────────────────

/**
 * Parse and validate a NextRequest JSON body against a Zod schema.
 *
 * Returns `{ ok: true, data }` on success, or `{ ok: false, error: Response }`
 * with a 400 JSON response describing the validation errors.
 *
 * @example
 * const result = await parseBody(MySchema, req);
 * if (!result.ok) return result.error;
 * const { fieldA, fieldB } = result.data;
 */
export async function parseBody<T>(
  schema: ZodSchema<T>,
  req: NextRequest
): Promise<ParseResult<T>> {
  let raw: unknown;

  // Parse JSON — handle empty or malformed bodies gracefully
  try {
    const text = await req.text();
    if (!text || text.trim() === '') {
      return {
        ok: false,
        data: null,
        error: errorResponse('Request body is empty. Expected a JSON object.', 400),
      };
    }
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      data: null,
      error: errorResponse('Request body is not valid JSON.', 400),
    };
  }

  // Validate against schema
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = formatZodErrors(parsed.error);
    return {
      ok: false,
      data: null,
      error: new Response(
        JSON.stringify({
          error: 'Validation failed',
          message: 'One or more fields are invalid.',
          issues,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { ok: true, data: parsed.data, error: null };
}

/**
 * Parse query parameters against a Zod schema.
 * Useful for validating search/filter params on GET routes.
 */
export function parseQuery<T>(
  schema: ZodSchema<T>,
  req: NextRequest
): ParseResult<T> {
  const params: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    const issues = formatZodErrors(parsed.error);
    return {
      ok: false,
      data: null,
      error: new Response(
        JSON.stringify({ error: 'Invalid query parameters', issues }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { ok: true, data: parsed.data, error: null };
}

// ── Error Formatter ───────────────────────────────────────────────────────────

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const issues: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!issues[path]) issues[path] = [];
    issues[path].push(issue.message);
  }
  return issues;
}

// ── Common Reusable Schema Fragments ─────────────────────────────────────────
// Import these in route files instead of redefining the same validators.

export const schemas = {
  /** CUID string (Prisma default ID format) */
  id: z.string().cuid(),

  /** Non-empty trimmed string */
  text: (min = 1, max = 255) =>
    z.string().min(min, `Must be at least ${min} characters`).max(max, `Must be at most ${max} characters`).trim(),

  /** E.164 or local Tanzania phone number */
  phone: z.string().regex(/^(\+?255|0)[0-9]{9}$/, 'Invalid phone number format').optional(),

  /** Email */
  email: z.string().email('Invalid email address').optional(),

  /** Safe alphanumeric username for MikroTik/RADIUS compatibility */
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(64, 'Username must be at most 64 characters')
    .regex(/^[a-zA-Z0-9_.\-@]+$/, 'Username can only contain letters, numbers, dots, hyphens, underscores, and @'),

  /** Positive integer amount in TZS */
  amount: z
    .number({ error: 'Amount is required and must be a number' })
    .int('Amount must be a whole number')
    .min(100, 'Amount must be at least 100 TZS')
    .max(10_000_000, 'Amount exceeds maximum (10,000,000 TZS)'),

  /** ISO 8601 datetime string */
  datetime: z.string().datetime({ message: 'Must be a valid ISO 8601 date-time string' }),

  /** Pagination params */
  pagination: z.object({
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};
