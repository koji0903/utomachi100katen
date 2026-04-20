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
        console.log(`[ImageUpload] HEIC detected, converting...: ${file.name}`);
        const heic2any = (await import("heic2any")).default;
        const convertedBlob = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.8
        });

        // heic2any can return an array if multiple images are in one HEIC, take the first one
        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

        // Create a new File object from the blob
        const newFileName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
        const processedFile = new File([finalBlob], newFileName, {
            type: "image/jpeg",
            lastModified: Date.now()
        });

        console.log(`[ImageUpload] HEIC conversion successful: ${processedFile.name}`);
        return processedFile;
    } catch (error) {
        console.error("[ImageUpload] HEIC conversion failed, falling back to original:", error);
        return file;
    }
};

export const uploadImageWithCompression = async (
    file: File,
    folderPath: string = "products"
): Promise<string> => {
    // 1-minute timeout for the entire process to prevent UI hang
    const globalTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Upload process timed out (60s)")), 60000);
    });

    const uploadLogic = async (): Promise<string> => {
        // 0. Ensure format is processable (Convert HEIC if needed)
        let fileToUpload: File = await ensureProcessableImage(file);

        // 1. Compression options
        const options = {
            maxSizeMB: 0.5, // 500KB max size
            maxWidthOrHeight: 800, // Resize up to 800px
            useWebWorker: false,
        };

        const isVideo = file.type.startsWith("video/");

        try {
            console.log(`[Upload] Starting process for: ${fileToUpload.name} (Type: ${fileToUpload.type}, Size: ${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB)`);

            // 2. Try compression locally (Images only)
            if (!isVideo) {
                try {
                    // Adjust compression for Storage (Allow higher quality if we have Storage)
                    const storageOptions = {
                        ...options,
                        maxSizeMB: 1.0, // Storage allows larger files than Firestore
                        maxWidthOrHeight: 1200, // Better resolution
                    };

                    const compressionTimeout = new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error("Compression timeout")), 20000);
                    });

                    const compressedFile: any = await Promise.race([
                        imageCompression(fileToUpload, storageOptions),
                        compressionTimeout
                    ]);

                    if (compressedFile instanceof File || compressedFile instanceof Blob) {
                        fileToUpload = compressedFile as File;
                    }

                    console.log(`[ImageUpload] Compression finished: ${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB`);
                } catch (compressionError) {
                    console.warn("[ImageUpload] Compression failed or timed out, using original file:", compressionError);
                }
            }

            // 3. Upload via Server-side API Proxy to bypass CORS
            console.log(`[Upload] Starting upload via API Proxy to: ${folderPath}`);
            const formData = new FormData();
            formData.append("file", fileToUpload);
            formData.append("folderPath", folderPath);

            const response = await apiFetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("[Upload] Storage upload failed:", errorData);
                
                // If it's a "Forbidden" error, it's likely rules or paywall
                if (response.status === 403) {
                    console.warn("[Upload] Permission denied. Falling back to Base64.");
                }

                // Fallback: Convert to Base64 for Firestore storage (Zero Config)
                const convertToBase64 = async (fileToConvert: Blob): Promise<string> => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(fileToConvert);
                    });
                };

                try {
                    console.log("[Upload] Falling back to Base64 due to Storage error");
                    // For Base64, we NEED aggressive compression
                    const aggressiveOptions = {
                        maxSizeMB: 0.15, // 150KB target for Firestore
                        maxWidthOrHeight: 600,
                        useWebWorker: false,
                    };
                    const aggressiveBlob = (await imageCompression(fileToUpload, aggressiveOptions)) as any;
                    const base64 = await convertToBase64(aggressiveBlob);

                    if (base64.length > 950000) { // Safety margin for 1MB limit
                        throw new Error("File is too large for fallback storage.");
                    }

                    return base64;
                } catch (fallbackError: any) {
                    throw new Error("Storage upload failed and Base64 fallback also failed: " + (fallbackError.message || "Unknown error"));
                }
            }

            const data = await response.json();
            console.log(`[Upload] Upload successful via Proxy: ${data.url}`);

            return data.url;
        } catch (error: any) {
            console.error("[Upload] Error in upload logic:", error);
            throw error;
        }
    };

    return Promise.race([uploadLogic(), globalTimeout]);
};
