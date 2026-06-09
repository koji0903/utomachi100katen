import { adminDb } from "@/lib/firebase-admin";

/**
 * Verifies that the given recipient is allowed to receive automated mail.
 * Source of truth: company_settings/main.notificationEmails (string[]).
 * Falls back to GMAIL_USER if the list is empty or the doc is missing,
 * so initial setup works without manual config.
 */
export async function isRecipientAllowed(recipient: string): Promise<boolean> {
    const target = recipient.trim().toLowerCase();
    if (!target) return false;

    // 開発環境やエミュレータ起動時はテストを容易にするため制限をスキップ
    if (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_USE_EMULATOR === "true") {
        return true;
    }

    const list = new Set<string>();
    
    // GMAIL_USER (送信元) および デフォルト通知先 info@matching-k.jp は常に許可
    if (process.env.GMAIL_USER) {
        list.add(process.env.GMAIL_USER.trim().toLowerCase());
    }
    list.add("info@matching-k.jp");

    if (adminDb) {
        try {
            const snap = await adminDb.collection("company_settings").doc("main").get();
            const data = snap.exists ? snap.data() : null;
            const emails = Array.isArray(data?.notificationEmails) ? data!.notificationEmails : [];
            for (const e of emails) {
                if (typeof e === "string") list.add(e.trim().toLowerCase());
            }
        } catch {
            // fall through
        }
    }

    return list.has(target);
}
