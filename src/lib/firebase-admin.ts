import * as admin from "firebase-admin";

/**
 * サーバー配下（API Route等）でFirestoreにアクセスするためのAdmin SDK初期化
 */

const isEmulator =
    !!process.env.FIRESTORE_EMULATOR_HOST ||
    !!process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;

const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

/**
 * Admin SDKを確実に初期化し、認証またはデータベースのインスタンスを返すためのユーティリティ。
 * モジュールロード時ではなく、実際に必要になったタイミング（Lazy）で初期化を行うことで、
 * 環境変数の読み込み順序や再エントリーによる問題を回避します。
 */
export const ensureAdminInitialized = () => {
    if (admin.apps.length) return true;

    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (key) {
        try {
            const serviceAccount = JSON.parse(key);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id,
                storageBucket,
            });
            console.log("[firebase-admin] Admin SDK initialized with Service Account");
            return true;
        } catch (err: any) {
            console.error("[firebase-admin] Failed to initialize Admin SDK with Service Account:", err.message);
        }
    } else if (isEmulator) {
        admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-emulator",
            storageBucket,
        });
        console.log("[firebase-admin] Admin SDK initialized for Emulator");
        return true;
    }
    
    console.warn("[firebase-admin] Initialization failed: FIREBASE_SERVICE_ACCOUNT_KEY is missing and not in emulator mode.");
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

// 既存コードとの互換性のためのエクスポート（関数版の使用を推奨）
export const adminDb = getAdminDb();
export const adminAuth = getAdminAuth();

export { admin };
