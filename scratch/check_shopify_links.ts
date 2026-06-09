import { adminDb } from "../src/lib/firebase-admin";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = "2024-01";

async function shopifyFetch(path: string) {
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
        throw new Error("Shopify API configuration missing.");
    }
    const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}${path}`;
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
    });
    if (!response.ok) {
        throw new Error(`Shopify API error: ${response.statusText}`);
    }
    return response.json();
}

async function checkShopifyLinks() {
    console.log("=== Shopify 商品紐付け状況チェック ===");
    console.log("開始時刻:", new Date().toLocaleString());
    console.log("-----------------------------------");

    if (!adminDb) {
        console.error("❌ エラー: Firebase Admin SDK が初期化されていません。");
        return;
    }

    try {
        // 1. システム側の全アクティブ商品を取得
        const productsRef = adminDb.collection("products");
        const productSnap = await productsRef.get();
        
        const localProducts = productSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            sku: doc.data().sku,
            shopifyProductId: doc.data().shopifyProductId,
            shopifyVariantId: doc.data().shopifyVariantId,
            shopifySyncEnabled: doc.data().shopifySyncEnabled || false
        }));

        console.log(`本システムのアクティブ商品総数: ${localProducts.length} 件`);

        const linkedLocal = localProducts.filter(p => p.shopifyVariantId || p.shopifyProductId);
        const unlinkedLocal = localProducts.filter(p => !p.shopifyVariantId && !p.shopifyProductId);
        const syncEnabledLocal = localProducts.filter(p => p.shopifySyncEnabled);

        console.log(`- Shopify情報が登録されている商品: ${linkedLocal.length} 件`);
        console.log(`- Shopify情報が未登録の商品: ${unlinkedLocal.length} 件`);
        console.log(`- 同期(shopifySyncEnabled)が有効な商品: ${syncEnabledLocal.length} 件`);
        console.log("");

        // 2. Shopify側の全商品・バリアントを取得
        console.log("Shopifyストアから商品データを取得中...");
        const shopifyData = await shopifyFetch("/products.json?limit=250");
        const shopifyProducts = shopifyData.products || [];

        // Shopify側のバリアント一覧を平坦化
        const shopifyVariants: any[] = [];
        shopifyProducts.forEach((p: any) => {
            p.variants.forEach((v: any) => {
                shopifyVariants.push({
                    productId: p.id.toString(),
                    productTitle: p.title,
                    variantId: v.id.toString(),
                    variantTitle: v.title,
                    sku: v.sku,
                    price: v.price
                });
            });
        });

        console.log(`Shopifyストアのバリアント総数: ${shopifyVariants.length} 件`);
        console.log("-----------------------------------");

        // 3. マッチング調査
        const unlinkedShopifyVariants = [];
        const linkedShopifyVariants = [];

        for (const sv of shopifyVariants) {
            // システム側で shopifyVariantId (または productId & variantId) が一致するものを探す
            // システム側は "gid://shopify/ProductVariant/12345" または "12345" 形式で保持している可能性があるため、部分一致等で比較
            const matched = localProducts.find(lp => {
                if (!lp.shopifyVariantId) return false;
                const cleanLpVariantId = lp.shopifyVariantId.replace("gid://shopify/ProductVariant/", "");
                return cleanLpVariantId === sv.variantId;
            });

            if (matched) {
                linkedShopifyVariants.push({
                    shopify: sv,
                    local: matched
                });
            } else {
                unlinkedShopifyVariants.push(sv);
            }
        }

        console.log("■ Shopify側から見た紐付け結果:");
        console.log(`- システムと紐付け済みのShopify商品: ${linkedShopifyVariants.length} 件`);
        console.log(`- システムと未紐付けのShopify商品: ${unlinkedShopifyVariants.length} 件`);
        console.log("");

        if (unlinkedShopifyVariants.length > 0) {
            console.log("⚠️ 未紐付けのShopify商品一覧:");
            unlinkedShopifyVariants.forEach(sv => {
                console.log(`  - [Shopify] 商品名: ${sv.productTitle} (${sv.variantTitle !== "Default Title" ? sv.variantTitle : "通常"}) | SKU: ${sv.sku || "未設定"} | VariantID: ${sv.variantId}`);
            });
            console.log("");
        }

        if (unlinkedLocal.length > 0) {
            console.log("⚠️ Shopify情報が未設定のシステム内商品一覧 (上位10件を表示):");
            unlinkedLocal.slice(0, 10).forEach(lp => {
                console.log(`  - [本システム] 商品名: ${lp.name} | SKU: ${lp.sku || "未設定"} | ID: ${lp.id}`);
            });
            if (unlinkedLocal.length > 10) {
                console.log(`    ... 他 ${unlinkedLocal.length - 10} 件`);
            }
        }

        console.log("-----------------------------------");
        console.log("チェック完了！");

    } catch (error: any) {
        console.error("❌ エラーが発生しました:", error.message);
    }
}

checkShopifyLinks();
