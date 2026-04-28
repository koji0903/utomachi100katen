import imageCompression from "browser-image-compression";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

/**
 * Detects if a file is a HEIC or HEIF image.
 */
export const isHeicFile = (file: File | Blob): boolean => {
    if (!(file instanceof File) && !(file instanceof Blob)) return false;

    const name = (file as any).name?.toLowerCase() || "";
    const type = file.type.toLowerCase();

    return (
        name.endsWith(".heic") ||
        name.endsWith(".heif") ||
        type === "image/heic" ||
        type === "image/heif" ||
        type.includes("heic") ||
        type.includes("heif")
    );
};

/**
 * Ensures a file is in a processable/previewable format (JPEG).
 * If it's a HEIC file, it converts it to JPEG.
 */
export const ensureProcessableImage = async (file: File): Promise<File> => {
    if (!isHeicFile(file)) return file;

    try {
        console.log(`[ImageUpload] HEIC detected, converting...: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Dynamic import to avoid loading heic2any for all users
        const heic2any = (await import("heic2any")).default;
        
        // Timeout for HEIC conversion as it can hang on mobile
        const conversionTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("HEIC変換がタイムアウトしました。")), 45000);
        });

        const conversionPromise = heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.7
        });

        const convertedBlob = await Promise.race([conversionPromise, conversionTimeout]);

        // heic2any can return an array if multiple images are in one HEIC, take the first one
        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

        // Create a new File object from the blob
        const newFileName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
        const processedFile = new File([finalBlob], newFileName, {
            type: "image/jpeg",
            lastModified: Date.now()
        });

        console.log(`[ImageUpload] HEIC conversion successful: ${processedFile.name} (${(processedFile.size / 1024 / 1024).toFixed(2)} MB)`);
        return processedFile;
    } catch (error) {
        console.error("[ImageUpload] HEIC conversion failed or timed out, falling back to original:", error);
        return file;
    }
};

/**
 * Compresses an image file with predefined settings for the app.
 */
export const compressImage = async (file: File): Promise<File> => {
    if (file.type.startsWith("video/")) return file;

    try {
        console.log(`[ImageUpload] Starting compression for: ${file.name}`);
        const options = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
            onProgress: (p: number) => {
                if (p % 25 === 0) console.log(`[ImageUpload] Compression progress: ${p}%`);
            }
        };

        const compressionTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("画像圧縮がタイムアウトしました。")), 45000);
        });

        const compressedFile: any = await Promise.race([
            imageCompression(file, options),
            compressionTimeout
        ]);

        if (compressedFile instanceof File || compressedFile instanceof Blob) {
            console.log(`[ImageUpload] Compression successful: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
            return compressedFile as File;
        }
        return file;
    } catch (error) {
        console.warn("[ImageUpload] Compression failed, using original:", error);
        return file;
    }
};

/**
 * Uploads a file directly to Firebase Storage using the Client SDK.
 * This bypasses the /api/upload route, avoiding Vercel payload limits and Admin SDK credential issues.
 */
export const uploadFile = async (
    file: File,
    folderPath: string,
    maxRetries: number = 2
): Promise<string> => {
    let lastError: any;
    
    for (let i = 0; i <= maxRetries; i++) {
        try {
            if (i > 0) console.log(`[Upload] Retry ${i}/${maxRetries} for ${file.name}`);
            
            // ファイル名のサニタイズ（APIルートで行っていた処理と同等）
            const sanitizeFileName = (name: string) => {
                const base = name.replace(/^.*[\\/]/, "");
                return base.replace(/[^\w.\-]/g, "_").slice(0, 120) || "file";
            };
            const fileName = sanitizeFileName(file.name);
            const fullStoragePath = `${folderPath}/${Date.now()}_${fileName}`;
            
            const storageRef = ref(storage, fullStoragePath);
            
            // アップロードタスクの作成
            const uploadTask = uploadBytesResumable(storageRef, file, {
                contentType: file.type,
            });

            // プロミスでアップロード完了を待機
            const downloadURL = await new Promise<string>((resolve, reject) => {
                uploadTask.on(
                    'state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        if (progress % 25 === 0) console.log(`[Upload] Progress: ${progress}%`);
                    },
                    (error) => {
                        reject(error);
                    },
                    async () => {
                        // アップロード完了後、ダウンロードURLを取得
                        try {
                            const url = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(url);
                        } catch (err) {
                            reject(err);
                        }
                    }
                );
            });

            return downloadURL;
        } catch (error: any) {
            lastError = error;
            console.error(`[Upload] Attempt ${i + 1} failed:`, error.message);
            if (i < maxRetries) await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    
    throw lastError || new Error("アップロードに失敗しました。");
};

/**
 * Legacy wrapper for backward compatibility or simple one-off uploads.
 */
export const uploadImageWithCompression = async (
    file: File,
    folderPath: string = "products"
): Promise<string> => {
    const globalTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("アップロード処理がタイムアウトしました(120s)。")), 120000);
    });

    const logic = async () => {
        const processable = await ensureProcessableImage(file);
        const compressed = await compressImage(processable);
        return await uploadFile(compressed, folderPath);
    };

    return Promise.race([logic(), globalTimeout]);
};
