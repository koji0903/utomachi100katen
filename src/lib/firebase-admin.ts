import * as admin from "firebase-admin";

/**
 * サーバー配下（API Route等）でFirestoreにアクセスするためのAdmin SDK初期化
 */

const isEmulator =
    !!process.env.FIRESTORE_EMULATOR_HOST ||
    !!process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !!process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
    process.env.NEXT_PUBLIC_USE_EMULATOR === "true";

const projectId = 
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
    process.env.FIREBASE_PROJECT_ID || 
    process.env.GOOGLE_CLOUD_PROJECT;

const storageBucket = 
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
    process.env.FIREBASE_STORAGE_BUCKET || 
    (projectId ? `${projectId}.firebasestorage.app` : undefined);

/**
 * Admin SDKを確実に初期化し、認証またはデータベースのインスタンスを返すためのユーティリティ。
 */
export const ensureAdminInitialized = () => {
    if (admin.apps.length) return true;

    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    // 1. Explicit Service Account Key (JSON string)
    if (key) {
        try {
            const serviceAccount = JSON.parse(key);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id || projectId,
                storageBucket: storageBucket || `${serviceAccount.project_id || projectId}.firebasestorage.app`,
            });
            console.log("[firebase-admin] Admin SDK initialized with Service Account Key (ENV)");
            return true;
        } catch (err: any) {
            console.error("[firebase-admin] Failed to initialize Admin SDK with Service Account Key:", err.message);
        }
    } 
    
    // 2. Emulator Mode
    if (isEmulator) {
        admin.initializeApp({
            projectId: projectId || "demo-emulator",
            storageBucket: storageBucket || "demo-emulator.appspot.com",
        });
        console.log("[firebase-admin] Admin SDK initialized for Emulator");
        return true;
    }

    // 3. Application Default Credentials
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: projectId,
            storageBucket: storageBucket,
        });
        console.log("[firebase-admin] Admin SDK initialized with Application Default Credentials");
        return true;
    } catch (err: any) {
        // Fallback to local secrets file search if in development
        if (process.env.NODE_ENV === "development") {
            try {
                const fs = require("fs");
                const path = require("path");
                const secretsDir = path.join(process.cwd(), "secrets");
                if (fs.existsSync(secretsDir)) {
                    const files = fs.readdirSync(secretsDir);
                    const jsonFile = files.find((f: string) => f.endsWith(".json"));
                    if (jsonFile) {
                        const filePath = path.join(secretsDir, jsonFile);
                        admin.initializeApp({
                            credential: admin.credential.cert(filePath),
                            projectId: projectId,
                            storageBucket: storageBucket,
                        });
                        console.log(`[firebase-admin] Admin SDK initialized with local secret file: ${jsonFile}`);
                        return true;
                    }
                }
            } catch (fsErr) {
                // Silently ignore
            }
        }
        console.warn("[firebase-admin] Fallback initialization failed:", err.message);
    }
    
    console.warn("[firebase-admin] Initialization failed: No valid credentials found.");
    return false;
};

export const getAdminDb = () => {
    if (!ensureAdminInitialized()) return null;
    return admin.firestore();
};

export const getAdminAuth = () => {
    if (!ensureAdminInitialized()) return null;
    return admin.auth();
};

export const getAdminStorage = () => {
    if (!ensureAdminInitialized()) return null;
    return admin.storage();
};

// 既存コードとの互換性のためのエクスポート（関数版の使用を推奨）
export const adminDb = getAdminDb();
export const adminAuth = getAdminAuth();

export { admin, storageBucket };
