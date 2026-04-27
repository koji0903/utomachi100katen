import * as admin from "firebase-admin";

/**
 * サーバー配下（API Route等）でFirestoreにアクセスするためのAdmin SDK初期化
 */

const isEmulator =
    !!process.env.FIRESTORE_EMULATOR_HOST ||
    !!process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !!process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
    process.env.NEXT_PUBLIC_USE_EMULATOR === "true";

const getProjectId = () => {
    return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
           process.env.FIREBASE_PROJECT_ID || 
           process.env.GOOGLE_CLOUD_PROJECT ||
           process.env.GCLOUD_PROJECT;
};

export const getStorageBucket = () => {
    const pId = getProjectId();
    return process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
           process.env.FIREBASE_STORAGE_BUCKET || 
           (pId ? `${pId}.firebasestorage.app` : undefined);
};

/**
 * Admin SDKを確実に初期化するためのユーティリティ。
 */
export const ensureAdminInitialized = () => {
    if (admin.apps.length > 0) {
        // 既に初期化済みの場合、有効な設定を持っているか確認
        const app = admin.app();
        if (!app.options.projectId && !getProjectId()) {
            console.error("[firebase-admin] App is initialized but missing Project ID!");
        }
        return true;
    }

    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const pId = getProjectId();
    const sBucket = getStorageBucket();
    
    // 1. Explicit Service Account Key
    if (key) {
        try {
            const serviceAccount = JSON.parse(key);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id || pId,
                storageBucket: sBucket || `${serviceAccount.project_id || pId}.firebasestorage.app`,
            });
            console.log("[firebase-admin] Initialized with Service Account Key");
            return true;
        } catch (err: any) {
            console.error("[firebase-admin] Service Account Key init failed:", err.message);
        }
    } 
    
    // 2. Emulator Mode
    if (isEmulator) {
        admin.initializeApp({
            projectId: pId || "demo-emulator",
            storageBucket: sBucket || "demo-emulator.appspot.com",
        });
        console.log("[firebase-admin] Initialized for Emulator");
        return true;
    }

    // 3. Application Default Credentials
    try {
        const options: any = {
            credential: admin.credential.applicationDefault(),
            storageBucket: sBucket,
        };
        if (pId) options.projectId = pId;
        
        admin.initializeApp(options);
        console.log("[firebase-admin] Initialized with ADC. ProjectID:", pId || "auto-detect");
        return true;
    } catch (err: any) {
        if (process.env.NODE_ENV === "development") {
            try {
                const fs = require("fs");
                const path = require("path");
                const secretsDir = path.join(process.cwd(), "secrets");
                if (fs.existsSync(secretsDir)) {
                    const jsonFile = fs.readdirSync(secretsDir).find((f: string) => f.endsWith(".json"));
                    if (jsonFile) {
                        admin.initializeApp({
                            credential: admin.credential.cert(path.join(secretsDir, jsonFile)),
                            projectId: pId,
                            storageBucket: sBucket,
                        });
                        return true;
                    }
                }
            } catch (fsErr) {}
        }
        console.error("[firebase-admin] All init paths failed:", err.message);
    }
    
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

// 互換性のためのエクスポート
export const adminDb = getAdminDb();
export const adminAuth = getAdminAuth();
export const storageBucket = getStorageBucket();

export { admin };
