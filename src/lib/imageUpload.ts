import imageCompression from "browser-image-compression";
import { apiFetch } from "@/lib/apiClient";

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
            setTimeout(() => reject(new Error("HEIC conversion timed out")), 45000);
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
 * Main upload function with compression and mobile optimizations.
 */
export const uploadImageWithCompression = async (
    file: File,
    folderPath: string = "products"
): Promise<string> => {
    // 2-minute timeout for the entire process (mobile networks can be slow)
    const globalTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("アップロード処理がタイムアウトしました(120s)。通信環境の良い場所で再度お試しください。")), 120000);
    });

    const uploadLogic = async (): Promise<string> => {
        try {
            console.log(`[Upload] Starting process for: ${file.name} (Type: ${file.type}, Size: ${(file.size / 1024 / 1024).toFixed(2)} MB)`);

            // 0. Ensure format is processable (Convert HEIC if needed)
            let fileToUpload: File = await ensureProcessableImage(file);

            // 1. Compression options
            const isVideo = file.type.startsWith("video/");
            
            // 2. Try compression locally (Images only)
            if (!isVideo) {
                try {
                    console.log(`[ImageUpload] Starting compression...`);
                    const options = {
                        maxSizeMB: 0.8, // Slightly higher limit for better quality on Storage
                        maxWidthOrHeight: 1600, // Better resolution for maintenance reports
                        useWebWorker: true, // MUST be true for mobile to avoid freezing the UI thread
                        onProgress: (p: number) => {
                            if (p % 20 === 0) console.log(`[ImageUpload] Compression progress: ${p}%`);
                        }
                    };

                    const compressionTimeout = new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error("Compression timeout")), 45000);
                    });

                    const compressedFile: any = await Promise.race([
                        imageCompression(fileToUpload, options),
                        compressionTimeout
                    ]);

                    if (compressedFile instanceof File || compressedFile instanceof Blob) {
                        fileToUpload = compressedFile as File;
                        console.log(`[ImageUpload] Compression successful: ${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB`);
                    }
                } catch (compressionError) {
                    console.warn("[ImageUpload] Compression failed or timed out, using original file:", compressionError);
                }
            }

            // 3. Upload via Server-side API Proxy to bypass CORS and handle large payloads
            console.log(`[Upload] Sending to API Proxy: ${fileToUpload.name} (${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB)`);
            
            const formData = new FormData();
            formData.append("file", fileToUpload);
            formData.append("folderPath", folderPath);

            const response = await apiFetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                let errorMsg = "Upload failed";
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {}
                
                console.error(`[Upload] API error (${response.status}):`, errorMsg);
                
                // Special handling for common Vercel/Next.js limits
                if (response.status === 413) {
                    throw new Error("ファイルサイズが大きすぎます。自動圧縮に失敗した可能性があります。");
                }

                // Fallback: Convert to Base64 for Firestore storage as last resort
                // Only if file is small enough (Firestore limit is 1MB)
                if (fileToUpload.size < 1.1 * 1024 * 1024) {
                    console.log("[Upload] Falling back to Base64 due to API error");
                    return await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = () => reject(new Error("Base64 conversion failed"));
                        reader.readAsDataURL(fileToUpload);
                    });
                }

                throw new Error(errorMsg);
            }

            const data = await response.json();
            console.log(`[Upload] Upload successful: ${data.url}`);
            return data.url;

        } catch (error: any) {
            console.error("[Upload] Error in upload logic:", error);
            throw error;
        }
    };

    return Promise.race([uploadLogic(), globalTimeout]);
};
