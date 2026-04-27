import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";
import { z, ZodError, ZodType } from "zod";

export type AuthedContext = {
    uid: string;
    email: string | null;
    token: DecodedIdToken;
};

export type AuthedHandler = (
    req: NextRequest,
    ctx: AuthedContext,
) => Promise<Response> | Response;

/**
 * Extracts and verifies a Firebase ID token from the Authorization header.
 * Returns a 401 Response on failure, otherwise an AuthedContext.
 */
export async function verifyAuth(
    req: NextRequest,
): Promise<AuthedContext | NextResponse> {
    const header = req.headers.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        console.warn("[verifyAuth] No Bearer token found in header");
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
        );
    }
    const idToken = match[1];
    try {
        if (!adminAuth) {
            console.error("[verifyAuth] adminAuth is null");
            return NextResponse.json(
                { error: "Server auth not configured" },
                { status: 500 },
            );
        }
        const decoded = await adminAuth.verifyIdToken(idToken);
        return {
            uid: decoded.uid,
            email: decoded.email ?? null,
            token: decoded,
        };
    } catch (err: any) {
        console.error(`[verifyAuth] Token verification failed: ${err.message}`);
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
        );
    }
}

/**
 * Wraps a Next.js route handler and requires a valid Firebase ID token.
 * Handlers receive an AuthedContext as their second argument.
 */
export function withAuth(handler: AuthedHandler) {
    return async (req: NextRequest) => {
        const auth = await verifyAuth(req);
        if (auth instanceof NextResponse) return auth;
        return handler(req, auth);
    };
}

/**
 * Gates an endpoint with the CRON_SECRET bearer token (used by Vercel Cron).
 */
export function withCronSecret(
    handler: (req: NextRequest) => Promise<Response> | Response,
) {
    return async (req: NextRequest) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
            return NextResponse.json(
                { error: "CRON_SECRET not configured" },
                { status: 500 },
            );
        }
        const header = req.headers.get("authorization");
        if (header !== `Bearer ${secret}`) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }
        return handler(req);
    };
}

/**
 * Parses and validates a JSON body against a Zod schema.
 * Returns the parsed data, or a 400 Response with a safe message on failure.
 * Error details are intentionally not echoed back to the client; log internally.
 */
export async function parseJson<T extends ZodType>(
    req: NextRequest,
    schema: T,
): Promise<z.infer<T> | NextResponse> {
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }
    const result = schema.safeParse(raw);
    if (!result.success) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[parseJson] validation failed:", summarizeZodError(result.error));
        }
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 },
        );
    }
    return result.data;
}

function summarizeZodError(err: ZodError): string {
    return err.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
}

/**
 * Standard 500 response that does not leak internal error details.
 * Always log the real error server-side via logError().
 */
export function internalError(): NextResponse {
    return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
    );
}

/**
 * Server-side error logger. Keeps raw error in Vercel/Cloud logs,
 * strips obvious PII keys before stringifying.
 */
export function logError(tag: string, error: unknown, meta?: Record<string, unknown>) {
    const e = error as { message?: string; code?: string; name?: string };
    const safeMeta = meta ? redactPii(meta) : undefined;
    // eslint-disable-next-line no-console
    console.error(`[${tag}]`, {
        name: e?.name,
        code: e?.code,
        message: e?.message,
        ...safeMeta,
    });
}

const PII_KEYS = new Set([
    "email",
    "recipient",
    "recipients",
    "phone",
    "token",
    "idToken",
    "authorization",
    "password",
    "apiKey",
]);

function redactPii(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (PII_KEYS.has(k)) {
            out[k] = "[REDACTED]";
        } else if (v && typeof v === "object" && !Array.isArray(v)) {
            out[k] = redactPii(v as Record<string, unknown>);
        } else {
            out[k] = v;
        }
    }
    return out;
}
