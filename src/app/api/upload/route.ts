import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminStorage, getStorageBucket } from "@/lib/firebase-admin";
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
    "estimates",
    "reports/activity",
    "reports/maintenance/before",
    "reports/maintenance/after",
]);

const ALLOWED_MIME_TYPES = new Set<string>([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "application/pdf",
    "video/mp4",
]);

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

function sanitizeFileName(name: string): string {
    const base = name.replace(/^.*[\\/]/, "");
    return base.replace(/[^\w.\-]/g, "_").slice(0, 120) || "file";
}

function isAllowedMime(mime: string): boolean {
    return ALLOWED_MIME_TYPES.has(mime.toLowerCase());
}

/**
 * ファイルバッファの先頭マジックバイトを検証し、SVG/HTML 等の偽装アップロードを防止する
 */
function hasValidMagicBytes(buffer: Buffer, mime: string): boolean {
    const normalized = mime.toLowerCase();
    switch (normalized) {
        case "image/jpeg":
            return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        case "image/png":
            return (
                buffer.length >= 8 &&
                buffer[0] === 0x89 &&
                buffer[1] === 0x50 &&
                buffer[2] === 0x4e &&
                buffer[3] === 0x47 &&
                buffer[4] === 0x0d &&
                buffer[5] === 0x0a &&
                buffer[6] === 0x1a &&
                buffer[7] === 0x0a
            );
        case "image/gif": {
            if (buffer.length < 6) return false;
            const header = buffer.subarray(0, 6).toString("ascii");
            return header === "GIF87a" || header === "GIF89a";
        }
        case "image/webp":
            return (
                buffer.length >= 12 &&
                buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
                buffer.subarray(8, 12).toString("ascii") === "WEBP"
            );
        case "application/pdf":
            return buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF";
        case "video/mp4":
        case "image/heic":
        case "image/heif":
            return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
        default:
            return false;
    }
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
        const storage = getAdminStorage();
        if (!storage) {
            throw new Error("Firebase Admin SDK の初期化に失敗しました。");
        }
        
        const sBucket = getStorageBucket();
        const bucket = storage.bucket(sBucket);
        
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

        if (!hasValidMagicBytes(buffer, file.type)) {
            return NextResponse.json(
                { error: "ファイル内容が不正、またはサポートされていない形式です。" },
                { status: 400 },
            );
        }

        const object = bucket.file(fullStoragePath);
        const downloadToken = crypto.randomUUID();
        
        await object.save(buffer, {
            contentType: file.type,
            resumable: false,
            metadata: {
                metadata: {
                    uploadedBy: uid,
                    firebaseStorageDownloadTokens: downloadToken,
                },
            },
        });

        const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fullStoragePath)}?alt=media&token=${downloadToken}`;

        return NextResponse.json({ url, storagePath: fullStoragePath });
    } catch (error: unknown) {
        logError("API-Upload", error, { uid, folderPath });
        return internalError();
    }
});
