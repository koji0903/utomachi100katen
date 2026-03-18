import { NextRequest, NextResponse } from "next/server";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const folderPath = formData.get("folderPath") as string || "uploads";

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate storage configuration
        const bucketName = storage.app.options.storageBucket;
        console.log(`[API-Upload] Initializing upload for ${file.name}. Size: ${file.size} bytes. Bucket: ${bucketName}`);

        if (!bucketName) {
            console.error("[API-Upload] Storage bucket is not configured in firebaseConfig");
            return NextResponse.json({ error: "Storage bucket configuration missing" }, { status: 500 });
        }

        // Generate a unique filename
        const uniqueFileName = `${Date.now()}_${file.name}`;
        const fullStoragePath = `${folderPath}/${uniqueFileName}`;
        const storageRef = ref(storage, fullStoragePath);

        // Convert File to Uint8Array for stable Node.js upload
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Upload to Firebase Storage
        console.log(`[API-Upload] Starting uploadBytes to ${fullStoragePath}...`);
        const uploadResult = await uploadBytes(storageRef, uint8Array, {
            contentType: file.type || 'application/pdf',
        });

        console.log(`[API-Upload] Upload successful: ${uploadResult.metadata.fullPath}`);

        // Get download URL
        const downloadURL = await getDownloadURL(uploadResult.ref);

        return NextResponse.json({ 
            url: downloadURL,
            storagePath: fullStoragePath
        });
    } catch (error: any) {
        console.error("[API-Upload] Error details:", {
            message: error.message,
            code: error.code,
            name: error.name,
            stack: error.stack
        });
        
        return NextResponse.json(
            { 
                error: "Upload failed", 
                details: error.message,
                code: error.code
            },
            { status: 500 }
        );
    }
}
