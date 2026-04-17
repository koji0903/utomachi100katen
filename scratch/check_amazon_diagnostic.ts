import { adminDb } from "../src/lib/firebase-admin";
import { getAmazonProduct, getAmazonOrders } from "../src/lib/amazon";

async function runDiagnostic() {
    console.log("=== Amazon 同期状況 診断レポート ===");
    console.log("開始時刻:", new Date().toLocaleString());
    console.log("-----------------------------------");

    if (!adminDb) {
        console.error("❌ エラー: Firebase Admin SDK が初期化されていません。環境変数 FIREBASE_SERVICE_ACCOUNT_KEY を確認してください。");
        return;
    }

    try {
        console.log("[1/2] API 疎通テスト (Orders API)...");
        try {
            const orders = await getAmazonOrders();
            console.log(`  ✅ 成功: Orders API から ${orders.length} 件の最近の注文を取得できました。`);
        } catch (err: any) {
            console.error(`  ❌ 失敗: Orders API でエラーが発生しました。 (${err.message})`);
        }
        console.log("---");

        console.log("[2/2] 商品個別同期チェック (Listings API)...");
        const productsRef = adminDb.collection("products");
        const querySnapshot = await productsRef.where("amazonSyncEnabled", "==", true).get();

        if (querySnapshot.empty) {
            console.log("結果: Amazon同期が有効な商品が見つかりませんでした。");
            return;
        }

        console.log(`対象商品数: ${querySnapshot.size} 件`);
        console.log("");

        let successCount = 0;
        let failureCount = 0;
        let warningCount = 0;

        for (const productDoc of querySnapshot.docs) {
            const product = productDoc.data();
            const sku = product.amazonSku;
            const name = product.name;

            console.log(`[チェック中] ${name} (SKU: ${sku})`);

            if (!sku) {
                console.error(`  ❌ 失敗: SKUが設定されていません。`);
                failureCount++;
                continue;
            }

            try {
                const amazonData = await getAmazonProduct(sku);

                if (amazonData) {
                    console.log(`  ✅ 成功: Amazonとの通信を確認しました。`);
                    console.log(`    - Amazon在庫: ${amazonData.inventoryLevel} (システム在庫: ${product.stock || 0})`);
                    console.log(`    - Amazon価格: ¥${amazonData.price} (システム価格: ¥${product.sellingPrice || 0})`);
                    
                    if (amazonData.inventoryLevel !== product.stock) {
                        console.warn(`    - ⚠️ 注意: 在庫数に不一致があります。`);
                        warningCount++;
                    }
                    if (amazonData.price !== product.sellingPrice) {
                        console.warn(`    - ⚠️ 注意: 価格に不一致があります。`);
                        warningCount++;
                    }
                    successCount++;
                } else {
                    console.error(`  ❌ 失敗: Amazon側に該当するSKUが見つからないか、APIエラーが発生しました。`);
                    failureCount++;
                }
            } catch (err: any) {
                console.error(`  ❌ 失敗: 通信エラーが発生しました。 (${err.message})`);
                failureCount++;
            }
            console.log("---");
        }

        console.log("-----------------------------------");
        console.log("診断結果サマリー:");
        console.log(`- 正常接続: ${successCount} 件`);
        console.log(`- 設定不備/通信失敗: ${failureCount} 件`);
        console.log(`- データ不一致あり: ${warningCount} 件`);
        console.log("-----------------------------------");

    } catch (error: any) {
        console.error("診断中に致命的なエラーが発生しました:", error.message);
    }
}

runDiagnostic();
