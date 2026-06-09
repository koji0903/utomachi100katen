import { adminDb } from "../src/lib/firebase-admin";
import { getShopifyOrders, updateShopifyInventory } from "../src/lib/shopify";
import { processShopifyOrder } from "../src/lib/shopify-processor";

async function runShopifySyncTest() {
    console.log("=== Shopify 同期テスト開始 ===");
    console.log("開始時刻:", new Date().toLocaleString());
    console.log("-----------------------------------");

    if (!adminDb) {
        console.error("❌ エラー: Firebase Admin SDK が初期化されていません。環境変数 FIREBASE_SERVICE_ACCOUNT_KEY を確認してください。");
        return;
    }

    try {
        const db = adminDb;
        const productsRef = db.collection("products");
        
        console.log("[1/3] 在庫同期（プッシュ）のテスト...");
        // shopifySyncEnabled == true の商品をロード
        const q = await productsRef.where("shopifySyncEnabled", "==", true).get();
        console.log(`同期対象の商品数: ${q.size} 件`);

        const syncResults = [];
        for (const productDoc of q.docs) {
            const product = productDoc.data();
            if (product.shopifyVariantId) {
                const currentStock = product.stock || 0;
                console.log(`  - [送信中] ${product.name} (VariantId: ${product.shopifyVariantId}) -> 在庫数: ${currentStock}`);
                try {
                    const success = await updateShopifyInventory(product.shopifyVariantId, currentStock);
                    if (success) {
                        console.log(`    ✅ 成功: Shopifyの在庫を ${currentStock} に更新しました。`);
                        syncResults.push({
                            id: productDoc.id,
                            name: product.name,
                            variantId: product.shopifyVariantId,
                            status: "Synced"
                        });
                    }
                } catch (err: any) {
                    console.error(`    ❌ 失敗: 在庫更新エラー: ${err.message}`);
                }
            } else {
                console.warn(`  - ⚠️ 警告: ${product.name} は同期有効ですが shopifyVariantId がありません。`);
            }
        }
        console.log("---");

        console.log("[2/3] 注文同期（取り込み）のテスト...");
        console.log("  - Shopifyから最新の注文を取得中...");
        const orders = await getShopifyOrders();
        console.log(`  - 取得できた注文数: ${orders.length} 件`);

        let newOrdersCount = 0;
        const processedOrders = [];

        for (const order of orders) {
            console.log(`  - [処理中] Shopify注文 ID: ${order.shopifyOrderId} (日付: ${order.createdAt})`);
            try {
                const result = await processShopifyOrder(order);
                if (result.success) {
                    console.log(`    ✅ 成功: 新規注文として本システムに取り込みました (Transaction ID: ${result.transactionId})`);
                    newOrdersCount++;
                    processedOrders.push(result.orderId);
                } else {
                    console.log(`    ℹ️ スキップ: ${result.reason === "duplicate" ? "登録済み（重複）" : result.reason}`);
                }
            } catch (err: any) {
                console.error(`    ❌ 失敗: 注文処理エラー: ${err.message}`);
            }
        }
        console.log("---");

        console.log("[3/3] 同期ログの記録テスト...");
        const logData = {
            type: 'Shopify_Test',
            timestamp: new Date(),
            status: 'success',
            productCount: syncResults.length,
            orderCount: newOrdersCount,
            triggeredBy: 'test_script',
            details: {
                syncedProducts: syncResults.map(p => p.name),
                newOrderIds: processedOrders
            }
        };
        await db.collection("sync_logs").add(logData);
        console.log("  ✅ 成功: 同期テストログを `sync_logs` に記録しました。");

        console.log("-----------------------------------");
        console.log("同期テスト完了！");
        console.log(`- 在庫同期成功商品: ${syncResults.length} 件`);
        console.log(`- 新規取り込み注文: ${newOrdersCount} 件`);
        console.log("-----------------------------------");

    } catch (error: any) {
        console.error("❌ 同期テスト中にエラーが発生しました:", error.message);
    }
}

runShopifySyncTest();
