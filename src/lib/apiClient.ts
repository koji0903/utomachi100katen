import { auth } from "@/lib/firebase";

/**
 * Thrown by apiFetch when the user is in demo mode (no Firebase session)
 * so callers can display "デモ中は利用できません" UX.
 */
export class DemoModeError extends Error {
    constructor() {
        super("この機能はデモ中はご利用いただけません");
        this.name = "DemoModeError";
    }
}

/**
 * Returns true if the browser is currently in demo mode.
 * Kept in sync with authContext.tsx's localStorage key.
 */
export function checkIsDemoMode(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("demo_mode") === "true";
}

/**
 * fetch wrapper that attaches the current user's Firebase ID token.
 * - Throws DemoModeError in demo mode so UI can show a friendly message.
 * - Throws if no user is signed in (caller should redirect to /login).
 * - All app code should use this instead of calling fetch('/api/...') directly.
 */
export async function apiFetch(
    input: string,
    init: RequestInit = {},
): Promise<Response> {
    if (checkIsDemoMode()) {
        throw new DemoModeError();
    }
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Not authenticated");
    }
    const idToken = await user.getIdToken();
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${idToken}`);
    return fetch(input, { ...init, headers });
}
