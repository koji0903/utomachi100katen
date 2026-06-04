import { adminDb } from "../src/lib/firebase-admin";
import { getShopifyOrders, getShopifyProduct } from "../src/lib/shopify";

async function runDiagnostic() {
    console.log("=== Shopify 同期状況 診断レポート ===");
    console.log("開始時刻:", new Date().toLocaleString());
    console.log("-----------------------------------");

    if (!adminDb) {
        console.error("❌ エラー: Firebase Admin SDK が初期化されていません。環境変数 FIREBASE_SERVICE_ACCOUNT_KEY を確認してください。");
        return;
    }

    try {
        console.log("[1/2] API 疎通テスト (Orders API)...");
        try {
            const orders = await getShopifyOrders();
            console.log(`  ✅ 成功: Orders API から ${orders.length} 件の最近の注文を取得できました。`);
        } catch (err: any) {
            console.error(`  ❌ 失敗: Orders API でエラーが発生しました。 (${err.message})`);
        }
        console.log("---");

        console.log("[2/2] 商品個別同期チェック (Products API)...");
        const productsRef = adminDb.collection("products");
        const querySnapshot = await productsRef.where("shopifySyncEnabled", "==", true).get();

        if (querySnapshot.empty) {
            console.log("結果: Shopify同期が有効な商品が見つかりませんでした。");
            return;
        }

        console.log(`対象商品数: ${querySnapshot.size} 件`);
        console.log("");

        let successCount = 0;
        let failureCount = 0;
        let warningCount = 0;

        for (const productDoc of querySnapshot.docs) {
            const product = productDoc.data();
            const variantId = product.shopifyVariantId;
            const productId = product.shopifyProductId;
            const name = product.name;

            console.log(`[チェック中] ${name} (VariantId: ${variantId || "未設定"})`);

            if (!productId) {
                console.error(`  ❌ 失敗: shopifyProductId が設定されていません。`);
                failureCount++;
                continue;
            }

            try {
                // shopifyProductId または variantId を使って詳細取得
                // getShopifyProduct は productId を要求する
                const shopifyData = await getShopifyProduct(productId);

                if (shopifyData) {
                    console.log(`  ✅ 成功: Shopifyとの通信を確認しました。`);
                    
                    // バリアントの在庫を確認
                    const variant = shopifyData.variants?.find((v: any) => v.id.toString() === variantId?.replace("gid://shopify/ProductVariant/", ""));
                    if (variant) {
                        console.log(`    - Shopify在庫: ${variant.inventory_quantity} (システム在庫: ${product.stock || 0})`);
                        console.log(`    - Shopify価格: ¥${variant.price} (システム価格: ¥${product.sellingPrice || 0})`);
                        
                        if (variant.inventory_quantity !== product.stock) {
                            console.warn(`    - ⚠️ 注意: 在庫数に不一致があります。`);
                            warningCount++;
                        }
                        if (parseFloat(variant.price) !== product.sellingPrice) {
                            console.warn(`    - ⚠️ 注意: 価格に不一致があります。`);
                            warningCount++;
                        }
                    } else {
                        console.warn(`    - ⚠️ 注意: 指定の Variant ID が Shopify の商品詳細に見つかりませんでした。`);
                        warningCount++;
                    }
                    successCount++;
                } else {
                    console.error(`  ❌ 失敗: Shopify側に該当する商品が見つからないか、APIエラーが発生しました。`);
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
