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
        return NextResponse.json({ error: "無効なフォームデータです。" }, { status: 400 });
    }

    const file = formData.get("file");
    const folderPath = String(formData.get("folderPath") ?? "");

    if (!(file instanceof File)) {
        return NextResponse.json({ error: "ファイルが提供されていません。" }, { status: 400 });
    }
    if (!ALLOWED_FOLDERS.has(folderPath)) {
        return NextResponse.json({ error: "無効な保存先フォルダです。" }, { status: 400 });
    }
    if (!file.type || !isAllowedMime(file.type)) {
        return NextResponse.json({ error: "サポートされていないファイル形式です。" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
        return NextResponse.json({ error: "ファイルサイズが制限(15MB)を超えています。" }, { status: 400 });
    }

    try {
        const storage = admin.storage();
        const bucket = storage.bucket();
        
        if (!bucket.name) {
            console.error("[API-Upload] Storage bucket name is missing. App might not be initialized with storageBucket.");
            // Try to re-initialize or log environment state
            logError("API-Upload", new Error("Storage bucket not configured"), { uid, folderPath });
            return NextResponse.json({ error: "ストレージの設定が不完全です。管理者にお問い合わせください。" }, { status: 500 });
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
        } catch (signedErr: any) {
            console.warn("[API-Upload] getSignedUrl failed, falling back to public URL:", signedErr.message);
            url = `https://storage.googleapis.com/${bucket.name}/${encodeURI(fullStoragePath)}`;
        }

        return NextResponse.json({ url, storagePath: fullStoragePath });
    } catch (error: any) {
        logError("API-Upload", error, { uid, folderPath });
        return NextResponse.json({ 
            error: "ファイルの保存に失敗しました。", 
            detail: process.env.NODE_ENV === 'development' ? error.message : undefined 
        }, { status: 500 });
    }
});
