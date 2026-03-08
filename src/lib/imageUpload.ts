import imageCompression from "browser-image-compression";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export const uploadImageWithCompression = async (
    file: File,
    folderPath: string = "products"
): Promise<string> => {
    // 1-minute timeout for the entire process to prevent UI hang
    const globalTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Upload process timed out (60s)")), 60000);
    });

    const uploadLogic = async (): Promise<string> => {
        // 1. Compression options
        const options = {
            maxSizeMB: 0.5, // 500KB max size
            maxWidthOrHeight: 800, // Resize up to 800px
            useWebWorker: false, // Disabled web worker to avoid potential hangs in some environments
        };

        let fileToUpload: File | Blob = file;

        try {
            console.log(`[ImageUpload] Starting process for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

            // 2. Try compression with an internal timeout
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

            // 3. Generate a unique filename
            const uniqueFileName = `${Date.now()}_${file.name}`;
            const storageRef = ref(storage, `${folderPath}/${uniqueFileName}`);

            console.log(`[ImageUpload] Starting upload to: ${folderPath}/${uniqueFileName}`);

            // 4. Upload to Firebase Storage
            const uploadResult = await uploadBytes(storageRef, fileToUpload);
            console.log(`[ImageUpload] Upload successful`);

            // 5. Get and return the download URL
            const downloadURL = await getDownloadURL(uploadResult.ref);
            console.log(`[ImageUpload] Download URL obtained: ${downloadURL.split('?')[0]}`);

            return downloadURL;
        } catch (error: any) {
            console.error("[ImageUpload] Error in upload logic:", error);
            if (error.code === 'storage/unauthorized') {
                console.error("[ImageUpload] HINT: Check your security rules.");
            } else if (error.name === 'FirebaseError' || error.message?.includes('CORS')) {
                console.error("[ImageUpload] HINT: This might be a CORS issue. Please follow the instructions in the implementation plan to fix the bucket's CORS settings.");
            }
            throw error;
        }
    };

    return Promise.race([uploadLogic(), globalTimeout]);
};
