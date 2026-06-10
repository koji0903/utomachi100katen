// scratch/inspect-production-shopify-sales.ts
import fs from "fs";
import path from "path";

// .env.local をパースするが、エミュレータ環境変数は強制的に無効化して本番DBに接続する
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

// エミュレータを強制的に無効化して本番へ接続する
process.env.NEXT_PUBLIC_USE_EMULATOR = "false";
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

async function inspectProductionSales() {
    console.log("=== 本番環境 (Firestore) Shopify 関連データ調査 ===");

    // 本番の firebase-admin をインポート
    const { getAdminDb } = await import("../src/lib/firebase-admin");
    const db = getAdminDb();
    if (!db) {
        console.error("本番DBへの接続に失敗しました。");
        return;
    }

    try {
        // 1. 本番の Shopify 店舗のドキュメントIDを確認
        const storeSnap = await db.collection("retailStores")
            .where("name", "==", "Shopify")
            .where("isTrashed", "==", false)
            .get();

        let shopifyStoreId = null;
        if (!storeSnap.empty) {
            shopifyStoreId = storeSnap.docs[0].id;
            console.log(`[Shopify店舗] 発見されました。ID: ${shopifyStoreId}`);
        } else {
            console.log("[Shopify店舗] 「Shopify」という名前の有効な店舗は見つかりませんでした。");
        }

        // 2. 取引履歴 (transactions) に該当の注文があるか確認
        const targetOrderIds = ["7562019799336", "7454864146728", "7411240010024"];
        console.log("\n[取引履歴 (transactions)] 過去の注文データを検索中...");
        for (const orderId of targetOrderIds) {
            const tSnap = await db.collection("transactions")
                .where("shopifyOrderId", "==", orderId)
                .get();

            if (!tSnap.empty) {
                const doc = tSnap.docs[0];
                const data = doc.data();
                console.log(`- 注文ID: ${orderId} -> 登録あり (ドキュメントID: ${doc.id})`);
                console.log(`  storeId: ${data.storeId}`);
                console.log(`  storeName: ${data.storeName}`);
                console.log(`  customerName: ${data.customerName}`);
                console.log(`  orderDate: ${data.orderDate}`);
                console.log(`  totalAmount: ¥${data.totalAmount}`);
            } else {
                console.log(`- 注文ID: ${orderId} -> 登録なし`);
            }
        }

        // 3. 売上集計 (sales) に該当の注文や店舗に紐づくデータがあるか確認
        console.log("\n[売上集計 (sales)] 5月分の売上データを検索中...");
        // 2026年5月分の売上データを取得
        const sSnap = await db.collection("sales")
            .where("isTrashed", "==", false)
            .get();

        console.log(`総売上データ件数 (全体): ${sSnap.size} 件`);
        let shopifySalesInMay = 0;

        sSnap.docs.forEach((doc) => {
            const data = doc.data();
            // period が 2026-05 で始まり、かつ storeId が shopifyStoreId に一致するもの
            if (data.period && data.period.startsWith("2026-05")) {
                if (shopifyStoreId && data.storeId === shopifyStoreId) {
                    shopifySalesInMay++;
                    console.log(`- 売上レコード発見 (ID: ${doc.id})`);
                    console.log(`  period: ${data.period}`);
                    console.log(`  storeId: ${data.storeId}`);
                    console.log(`  totalAmount: ¥${data.totalAmount}`);
                    console.log(`  transactionId: ${data.transactionId || "(なし)"}`);
                }
            }
        });

        console.log(`\n5月分のShopify店舗売上レコード数: ${shopifySalesInMay} 件`);

    } catch (error: any) {
        console.error("調査中にエラーが発生しました:", error.message);
    }
}

inspectProductionSales();
