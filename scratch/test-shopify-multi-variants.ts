// scratch/test-shopify-multi-variants.ts
import fs from "fs";
import path from "path";

// .env.local を手動でパースして環境変数に設定する
try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, "utf-8");
        envConfig.split("\n").forEach((line) => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || "";
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
    }
} catch (err: any) {
    console.error("Failed to load env:", err.message);
}

async function runTest() {
    console.log("=== Shopify 複数バリアントID連携テスト ===");
    
    // 動的インポート
    const { getAdminDb } = await import("../src/lib/firebase-admin");
    const db = getAdminDb();
    
    if (!db) {
        console.error("Firestore DBに接続できませんでした。");
        return;
    }

    try {
        // テスト用のバリアントID (「【箱入り２個セット】おいのり」の「必勝祈願」バリアントID)
        const targetVariantId = "51331791520040";
        console.log(`\n1. 注文に含まれるバリアントID: '${targetVariantId}' で Firestore を検索します...`);

        // ① 新しく実装した shopifyVariantIds (配列) による array-contains 検索
        console.log("クエリ実行: db.collection('products').where('shopifyVariantIds', 'array-contains', variantId)");
        let pSnap = await db.collection("products")
            .where("shopifyVariantIds", "array-contains", targetVariantId)
            .get();

        if (pSnap.empty) {
            console.log("-> 配列クエリで商品が見つかりませんでした。旧フィールドでの等価検索を実行します...");
            // ② 従来の shopifyVariantId による検索
            pSnap = await db.collection("products")
                .where("shopifyVariantId", "==", targetVariantId)
                .get();
        }

        if (!pSnap.empty) {
            const doc = pSnap.docs[0];
            const pData = doc.data();
            console.log("-> 商品の特定に成功しました！");
            console.log(`   商品名: ${pData.name} ${pData.variantName || ""}`);
            console.log(`   ドキュメントID: ${doc.id}`);
            console.log(`   設定されている shopifyVariantIds: ${JSON.stringify(pData.shopifyVariantIds || [])}`);
            console.log(`   設定されている shopifyVariantId: ${pData.shopifyVariantId || "(なし)"}`);
            console.log(`   現在の在庫数: ${pData.stock || 0}`);
        } else {
            console.log("-> 商品を特定できませんでした。データベースに対象商品が存在しないか、バリアントIDが設定されていません。");
            console.log("※ 管理画面で商品に「51331791520040」を含むバリアントIDを設定した上で再度お試しください。");
        }

    } catch (error: any) {
        console.error("エラーが発生しました:", error.message);
    }
    console.log("\n=== テスト終了 ===");
}

runTest();
