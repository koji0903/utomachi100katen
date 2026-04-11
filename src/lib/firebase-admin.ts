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

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth, admin };
function getApps() {
    throw new Error("Function not implemented.");
}

function initializeApp(arg0: { credential: admin.ServiceAccount; projectId: any; }) {
    throw new Error("Function not implemented.");
}
