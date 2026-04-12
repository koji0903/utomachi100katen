import * as admin from "firebase-admin";

/**
 * サーバー配下（API Route等）でFirestoreにアクセスするためのAdmin SDK初期化
 */
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) 
    : null;

if (!admin.apps.length && serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
    });
}

// 外部からのアクセス用に安全にエクスポート
// ビルド時に環境変数がなくてもエラーにならないように null チェックを行う
export const adminDb = admin.apps.length ? admin.firestore() : null as any;
export const adminAuth = admin.apps.length ? admin.auth() : null as any;
export { admin };
