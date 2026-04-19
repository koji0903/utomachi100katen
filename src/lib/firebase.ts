// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if it hasn't been initialized already (handles Next.js HMR)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
});
export const storage = getStorage(app);

// --- Firebase Emulator 接続 (ローカル開発専用) ---
// NEXT_PUBLIC_USE_EMULATOR=true が設定されているときのみ、
// Auth / Firestore / Storage をローカルエミュレータに接続する。
// 本番・Preview(staging) では環境変数未設定のためこの分岐は実行されない。
const shouldUseEmulator =
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_EMULATOR === "true";

// HMR で二重接続されないよう、接続済みフラグを globalThis に保持する
const globalForEmulator = globalThis as unknown as { __firebaseEmulatorConnected?: boolean };

if (shouldUseEmulator && !globalForEmulator.__firebaseEmulatorConnected) {
    const host = process.env.NEXT_PUBLIC_EMULATOR_HOST || "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectStorageEmulator(storage, host, 9199);
    globalForEmulator.__firebaseEmulatorConnected = true;
    // eslint-disable-next-line no-console
    console.info(`[firebase] Emulator connected @ ${host} (auth:9099, firestore:8080, storage:9199)`);
}

export default app;
