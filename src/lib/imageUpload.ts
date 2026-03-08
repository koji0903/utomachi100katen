import imageCompression from "browser-image-compression";

export const uploadImageWithCompression = async (
    file: File,
    folderPath: string = "products"
): Promise<string> => {
    // 1-minute timeout for the entire process to prevent UI hang
    const globalTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Upload process timed out (60s)")), 600000);
    });

    const uploadLogic = async (): Promise<string> => {
        // 1. Compression options
        const options = {
            maxSizeMB: 0.5, // 500KB max size
            maxWidthOrHeight: 800, // Resize up to 800px
            useWebWorker: false,
        };

        let fileToUpload: File | Blob = file;

        try {
            console.log(`[ImageUpload] Starting process for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

            // 2. Try compression locally
            try {
                const compressionTimeout = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error("Compression timeout")), 20000);
                });

                fileToUpload = await Promise.race([
                    imageCompression(file, options),
                    compressionTimeout
                ]);

                console.log(`[ImageUpload] Compression finished: ${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB`);
            } catch (compressionError) {
                console.warn("[ImageUpload] Compression failed or timed out, using original file:", compressionError);
                fileToUpload = file;
            }

            // 3. Upload via Server-side API Proxy to bypass CORS
            console.log(`[ImageUpload] Starting upload via API Proxy to: ${folderPath}`);
            const formData = new FormData();
            formData.append("file", fileToUpload as any);
            formData.append("folderPath", folderPath);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.warn("[ImageUpload] Proxy upload failed, trying Base64 fallback:", errorData);

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
                    let base64 = await convertToBase64(fileToUpload as Blob);

                    // If even after initial compression it's too big (approx > 600KB base64)
                    // we try an aggressive compression specifically for Base64
                    if (base64.length > 600000) {
                        console.log(`[ImageUpload] Base64 too large (${base64.length}), trying aggressive compression...`);
                        const aggressiveOptions = {
                            maxSizeMB: 0.1, // 100KB target
                            maxWidthOrHeight: 500, // Smaller dimensions
                            useWebWorker: false,
                        };
                        const aggressiveBlob = await imageCompression(file as File, aggressiveOptions);
                        base64 = await convertToBase64(aggressiveBlob);
                    }

                    if (base64.length > 900000) { // Hard limit to avoid 1MB Firestore limit
                        throw new Error("Image is too large even after aggressive compression. Please check Firebase Storage settings.");
                    }

                    console.log("[ImageUpload] Using Base64 fallback (size: " + base64.length + ")");
                    return base64;
                } catch (fallbackError: any) {
                    throw new Error("Fallback upload failed: " + (fallbackError.message || "Unknown error"));
                }
            }

            const data = await response.json();
            console.log(`[ImageUpload] Upload successful via Proxy`);

            return data.url;
        } catch (error: any) {
            console.error("[ImageUpload] Error in upload logic:", error);
            throw error;
        }
    };

    return Promise.race([uploadLogic(), globalTimeout]);
};
