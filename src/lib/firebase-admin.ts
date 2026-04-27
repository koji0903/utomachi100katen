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
    const id = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
               process.env.FIREBASE_PROJECT_ID || 
               process.env.GOOGLE_CLOUD_PROJECT ||
               process.env.GCLOUD_PROJECT;
    
    // 最終手段として、このプロジェクトの既知のIDをフォールバックとして使用
    // これにより "Unable to detect a Project Id" エラーを回避する
    return id || "utomachi100katen"; 
};

export const getStorageBucket = () => {
    const pId = getProjectId();
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
                   process.env.FIREBASE_STORAGE_BUCKET;
    
    if (bucket) return bucket;
    
    // staging か production かを判定してデフォルトを返す
    if (pId === "utomachi100katen-staging-d6583") {
        return "utomachi100katen-staging-d6583.firebasestorage.app";
    }
    return "utomachi100katen.firebasestorage.app";
};

/**
 * Admin SDKを確実に初期化するためのユーティリティ。
 */
export const ensureAdminInitialized = () => {
    if (admin.apps.length > 0) return true;

    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const pId = getProjectId();
    const sBucket = getStorageBucket();
    
    console.log(`[firebase-admin] Attempting init for Project: ${pId}`);

    // 1. Explicit Service Account Key
    if (key) {
        try {
            const serviceAccount = JSON.parse(key);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id || pId,
                storageBucket: sBucket,
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
            projectId: pId,
            storageBucket: sBucket || "demo-emulator.appspot.com",
        });
        console.log("[firebase-admin] Initialized for Emulator");
        return true;
    }

    // 3. Application Default Credentials (Vercel Integration etc.)
    try {
        const options: any = {
            credential: admin.credential.applicationDefault(),
            projectId: pId,
            storageBucket: sBucket,
        };
        admin.initializeApp(options);
        console.log("[firebase-admin] Initialized with ADC");
        return true;
    } catch (err: any) {
        console.error("[firebase-admin] ADC init failed:", err.message);
        
        // Final fallback: try to init with just project ID (will work for some operations, but not storage/auth without creds)
        try {
            if (admin.apps.length === 0) {
                admin.initializeApp({
                    projectId: pId,
                    storageBucket: sBucket,
                });
                console.warn("[firebase-admin] Initialized with ONLY ProjectID (Limited capability)");
                return true;
            }
        } catch (finalErr) {}
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

// 以前の adminDb / adminAuth 定数も getter に置き換える
export const adminDb = getAdminDb();
export const adminAuth = getAdminAuth();

export { admin };
