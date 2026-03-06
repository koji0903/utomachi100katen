import imageCompression from "browser-image-compression";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export const uploadImageWithCompression = async (
    file: File,
    folderPath: string = "products"
): Promise<string> => {
    // 1. Compression options
    const options = {
        maxSizeMB: 0.5, // 500KB max size
        maxWidthOrHeight: 800, // Resize up to 800px
        useWebWorker: true,
    };

    try {
        // 2. Compress the image
        const compressedFile = await imageCompression(file, options);
        console.log(`Original size: ${file.size / 1024 / 1024} MB`);
        console.log(`Compressed size: ${compressedFile.size / 1024 / 1024} MB`);

        // 3. Generate a unique filename
        const uniqueFileName = `${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `${folderPath}/${uniqueFileName}`);

        // 4. Upload to Firebase Storage
        const uploadTask = await uploadBytesResumable(storageRef, compressedFile);

        // 5. Get and return the download URL
        const downloadURL = await getDownloadURL(uploadTask.ref);
        return downloadURL;
    } catch (error) {
        console.error("Error compressing or uploading image:", error);
        throw error;
    }
};
