import * as admin from "firebase-admin";

/**
 * サーバー配下（API Route等）でFirestoreにアクセスするためのAdmin SDK初期化
 */
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

// Firebase Admin SDK は下記の環境変数が設定されていると自動的にエミュレータへ接続する:
//   - FIRESTORE_EMULATOR_HOST (例: 127.0.0.1:8080)
//   - FIREBASE_AUTH_EMULATOR_HOST (例: 127.0.0.1:9099)
//   - FIREBASE_STORAGE_EMULATOR_HOST (例: 127.0.0.1:9199)
// エミュレータ使用時は credential を用意できなくても projectId だけで初期化できる。
const isEmulator =
    !!process.env.FIRESTORE_EMULATOR_HOST ||
    !!process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;

const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!admin.apps.length) {
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
            storageBucket,
        });
    } else if (isEmulator) {
        // エミュレータ専用のダミー初期化（ローカル開発用）
        admin.initializeApp({
            projectId:
                process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-emulator",
            storageBucket,
        });
    }
}

// 外部からのアクセス用に安全にエクスポート
// ビルド時に環境変数がなくてもエラーにならないように null チェックを行う
export const adminDb = admin.apps.length ? admin.firestore() : null as any;
export const adminAuth = admin.apps.length ? admin.auth() : null as any;
export { admin };
