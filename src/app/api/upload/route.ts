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

        console.log(`[API-Upload] Received file: ${file.name}, size: ${file.size}, folder: ${folderPath}`);

        // Generate a unique filename
        const uniqueFileName = `${Date.now()}_${file.name}`;
        const fullStoragePath = `${folderPath}/${uniqueFileName}`;
        const storageRef = ref(storage, fullStoragePath);

        // Convert File to ArrayBuffer for Firebase Upload
        const bytes = await file.arrayBuffer();

        // Upload to Firebase Storage
        const uploadResult = await uploadBytes(storageRef, bytes, {
            contentType: file.type,
        });

        console.log(`[API-Upload] Upload successful for ${file.name} to ${fullStoragePath}`);

        // Get download URL
        const downloadURL = await getDownloadURL(uploadResult.ref);

        return NextResponse.json({ 
            url: downloadURL,
            storagePath: fullStoragePath
        });
    } catch (error: any) {
        console.error("[API-Upload] Detailed error:", error);
        return NextResponse.json(
            { error: "Upload failed", details: error.message },
            { status: 500 }
        );
    }
}
