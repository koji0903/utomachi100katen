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
        const storageRef = ref(storage, `${folderPath}/${uniqueFileName}`);

        // Convert File to ArrayBuffer for Firebase Upload in Node environment
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Upload to Firebase Storage (Server-to-Server doesn't have CORS issues)
        const uploadResult = await uploadBytes(storageRef, buffer, {
            contentType: file.type,
        });

        console.log(`[API-Upload] Upload successful for ${file.name}`);

        // Get download URL
        const downloadURL = await getDownloadURL(uploadResult.ref);

        return NextResponse.json({ url: downloadURL });
    } catch (error: any) {
        console.error("[API-Upload] Detailed error:", error);
        return NextResponse.json(
            { error: "Upload failed", details: error.message },
            { status: 500 }
        );
    }
}
