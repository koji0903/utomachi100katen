import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/firebase-admin";
import { withAuth, internalError, logError } from "@/lib/apiAuth";

const ALLOWED_FOLDERS = new Set<string>([
    "products",
    "print-archives",
    "settings",
    "stores",
    "invoices",
    "delivery_notes",
    "receipts",
    "summaries",
    "reports/activity",
    "reports/maintenance/before",
    "reports/maintenance/after",
]);

const ALLOWED_MIME_PREFIXES = ["image/"];
const ALLOWED_MIME_EXACT = new Set<string>([
    "application/pdf",
    "video/mp4",
]);

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

function sanitizeFileName(name: string): string {
    const base = name.replace(/^.*[\\/]/, "");
    return base.replace(/[^\w.\-]/g, "_").slice(0, 120) || "file";
}

function isAllowedMime(mime: string): boolean {
    if (ALLOWED_MIME_EXACT.has(mime)) return true;
    return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

export const POST = withAuth(async (req: NextRequest, { uid }) => {
    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    const folderPath = String(formData.get("folderPath") ?? "");

    if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_FOLDERS.has(folderPath)) {
        return NextResponse.json({ error: "Invalid folderPath" }, { status: 400 });
    }
    if (!file.type || !isAllowedMime(file.type)) {
        return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File size out of range" }, { status: 400 });
    }

    try {
        const bucket = admin.storage().bucket();
        if (!bucket.name) {
            logError("API-Upload", new Error("Storage bucket not configured"), { uid });
            return internalError();
        }

        const fileName = sanitizeFileName(file.name);
        const fullStoragePath = `${folderPath}/${Date.now()}_${fileName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const object = bucket.file(fullStoragePath);
        await object.save(buffer, {
            contentType: file.type,
            resumable: false,
            metadata: {
                metadata: { uploadedBy: uid },
            },
        });
        await object.makePublic().catch(() => {
            // Non-public buckets will surface via getSignedUrl below; swallow here.
        });

        let url: string;
        try {
            const [signed] = await object.getSignedUrl({
                action: "read",
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
            });
            url = signed;
        } catch {
            url = `https://storage.googleapis.com/${bucket.name}/${encodeURI(fullStoragePath)}`;
        }

        return NextResponse.json({ url, storagePath: fullStoragePath });
    } catch (error) {
        logError("API-Upload", error, { uid, folderPath });
        return internalError();
    }
});
