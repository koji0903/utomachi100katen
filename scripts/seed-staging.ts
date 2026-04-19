/* eslint-disable no-console */
/**
 * scripts/seed-staging.ts
 *
 * Firebase staging プロジェクト or Emulator にダミーデータを投入する。
 *
 * 安全装置:
 *   - 本番プロジェクトへの誤実行を防ぐため、接続先 projectId が
 *     本番 ("utomachi100katen") だったら即座に abort する。
 *   - 実行は SEED_TARGET=emulator|staging の明示指定が必須。
 *
 * 使い方:
 *   npm run seed:emulator    # エミュレータへ投入
 *   npm run seed:staging     # staging Firebase プロジェクトへ投入
 *                            # (事前に GOOGLE_APPLICATION_CREDENTIALS で
 *                            #  staging のサービスアカウント JSON を指定)
 */
import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as fs from "node:fs";
import * as path from "node:path";

const PROD_PROJECT_ID = "utomachi100katen";
const STAGING_PROJECT_ID = "utomachi100katen-staging-d6583";

type Target = "emulator" | "staging";

function resolveTarget(): Target {
    const t = process.env.SEED_TARGET;
    if (t === "emulator" || t === "staging") return t;
    throw new Error(
        "SEED_TARGET must be set to 'emulator' or 'staging'. Use npm run seed:emulator / seed:staging"
    );
}

function initAdmin(target: Target) {
    if (getApps().length > 0) return;

    if (target === "emulator") {
        if (!process.env.FIRESTORE_EMULATOR_HOST) {
            throw new Error(
                "Emulator mode requires FIRESTORE_EMULATOR_HOST (and sibling vars). Use npm run seed:emulator."
            );
        }
        initializeApp({
            projectId: STAGING_PROJECT_ID, // emulator はプロジェクトID実在チェックしない
            storageBucket: `${STAGING_PROJECT_ID}.firebasestorage.app`,
        });
        return;
    }

    // target === "staging"
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (credPath) {
        const abs = path.resolve(credPath);
        const sa = JSON.parse(fs.readFileSync(abs, "utf8"));
        if (sa.project_id === PROD_PROJECT_ID) {
            throw new Error(
                `Refusing to seed into PRODUCTION project (${PROD_PROJECT_ID}). Check GOOGLE_APPLICATION_CREDENTIALS.`
            );
        }
        initializeApp({
            credential: cert(sa),
            projectId: sa.project_id,
            storageBucket: `${sa.project_id}.firebasestorage.app`,
        });
    } else if (jsonEnv) {
        const sa = JSON.parse(jsonEnv);
        if (sa.project_id === PROD_PROJECT_ID) {
            throw new Error(
                `Refusing to seed into PRODUCTION project (${PROD_PROJECT_ID}). Check FIREBASE_SERVICE_ACCOUNT_KEY.`
            );
        }
        initializeApp({
            credential: cert(sa),
            projectId: sa.project_id,
            storageBucket: `${sa.project_id}.firebasestorage.app`,
        });
    } else {
        // ADC フォールバック
        initializeApp({
            credential: applicationDefault(),
            projectId: STAGING_PROJECT_ID,
            storageBucket: `${STAGING_PROJECT_ID}.firebasestorage.app`,
        });
    }
}

async function seedAuth() {
    const auth = getAuth();
    const testUsers = [
        { email: "admin@test.local", password: "Test1234!", displayName: "Staging 管理者" },
        { email: "user@test.local", password: "Test1234!", displayName: "Staging テストユーザー" },
    ];

    for (const u of testUsers) {
        try {
            const existing = await auth.getUserByEmail(u.email).catch(() => null);
            if (existing) {
                await auth.updateUser(existing.uid, {
                    password: u.password,
                    displayName: u.displayName,
                });
                console.log(`  ↻ auth user updated: ${u.email}`);
            } else {
                await auth.createUser({
                    email: u.email,
                    password: u.password,
                    displayName: u.displayName,
                    emailVerified: true,
                });
                console.log(`  + auth user created: ${u.email}`);
            }
        } catch (err) {
            console.error(`  ! auth seed failed for ${u.email}`, err);
        }
    }
}

async function seedFirestore() {
    const db = getFirestore();
    const now = new Date();

    const brands = [
        { id: "brand_test_01", name: "テストブランドA", isTrashed: false },
        { id: "brand_test_02", name: "テストブランドB", isTrashed: false },
    ];
    for (const b of brands) {
        await db.collection("brands").doc(b.id).set({ ...b, updatedAt: now }, { merge: true });
    }
    console.log(`  + brands: ${brands.length} docs`);

    const retailStores = [
        {
            id: "store_test_01",
            name: "テスト店舗（下北沢）",
            address: "東京都世田谷区北沢2-0-0",
            lat: 35.661,
            lng: 139.667,
            isTrashed: false,
        },
    ];
    for (const s of retailStores) {
        await db.collection("retailStores").doc(s.id).set({ ...s, updatedAt: now }, { merge: true });
    }
    console.log(`  + retailStores: ${retailStores.length} docs`);

    const suppliers = [
        { id: "supplier_test_01", name: "テスト仕入先", isTrashed: false },
    ];
    for (const s of suppliers) {
        await db.collection("suppliers").doc(s.id).set({ ...s, updatedAt: now }, { merge: true });
    }
    console.log(`  + suppliers: ${suppliers.length} docs`);

    const products = [
        {
            id: "product_test_01",
            name: "テスト商品A",
            brandId: "brand_test_01",
            supplierId: "supplier_test_01",
            price: 1000,
            cost: 400,
            stock: 100,
            isTrashed: false,
        },
        {
            id: "product_test_02",
            name: "テスト商品B",
            brandId: "brand_test_02",
            supplierId: "supplier_test_01",
            price: 2500,
            cost: 900,
            stock: 50,
            isTrashed: false,
        },
    ];
    for (const p of products) {
        await db.collection("products").doc(p.id).set({ ...p, updatedAt: now }, { merge: true });
    }
    console.log(`  + products: ${products.length} docs`);

    await db
        .collection("company_settings")
        .doc("default")
        .set({ companyName: "Staging 用 会社設定", updatedAt: now }, { merge: true });
    console.log(`  + company_settings/default`);
}

async function seedStorage() {
    const storage = getStorage();
    const bucket = storage.bucket();

    const localIcon = path.resolve(process.cwd(), "public/icon-192x192.png");
    if (!fs.existsSync(localIcon)) {
        console.log(`  - skip storage seed (file not found: ${localIcon})`);
        return;
    }
    const dest = "seed/test-image.png";
    await bucket.upload(localIcon, {
        destination: dest,
        metadata: { contentType: "image/png" },
    });
    console.log(`  + storage: uploaded ${localIcon} -> ${dest}`);
}

async function main() {
    const target = resolveTarget();
    console.log(`\n🌱 Seeding target: ${target}`);

    initAdmin(target);

    console.log("\n[Auth]");
    await seedAuth();

    console.log("\n[Firestore]");
    await seedFirestore();

    console.log("\n[Storage]");
    try {
        await seedStorage();
    } catch (err) {
        console.warn("  ! storage seed skipped:", (err as Error).message);
    }

    console.log("\n✅ Seed completed");
}

main().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
