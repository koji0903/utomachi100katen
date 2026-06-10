// scratch/test-shopify-products.ts
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
        console.log("Loaded .env.local variables");
    } else {
        console.warn(".env.local file not found");
    }
} catch (err: any) {
    console.error("Failed to load .env.local:", err.message);
}

// 動的インポートを使用して、firebase-admin や shopify.ts をロードする
async function runTest() {
    console.log("=== Shopify 商品連携テスト開始 ===");
    console.log(`SHOPIFY_STORE_DOMAIN: ${process.env.SHOPIFY_STORE_DOMAIN}`);
    
    try {
        // 1. Shopify API から登録されている商品リストを取得 (最初の5件)
        const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products.json?limit=5`;
        console.log(`\nShopify から商品リストを取得中 (URL: ${url})...`);
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
            }
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Shopify APIエラー: ${JSON.stringify(err)}`);
        }
        
        const data = await response.json();
        const products = data.products || [];
        console.log(`取得成功。Shopify上の商品数: ${products.length} 件`);
        
        if (products.length > 0) {
            console.log("\nShopify上の商品データサンプル (最初の2件):");
            products.slice(0, 2).forEach((p: any) => {
                console.log(`- 商品名: ${p.title} (ID: ${p.id})`);
                console.log(`  バリアント数: ${p.variants?.length || 0}`);
                if (p.variants && p.variants.length > 0) {
                    p.variants.forEach((v: any, index: number) => {
                        console.log(`    [Variant ${index + 1}] ID: ${v.id}, SKU: ${v.sku || "(未設定)"}, 価格: ${v.price}, 在庫管理: ${v.inventory_management || "なし"}`);
                    });
                }
            });
        } else {
            console.log("Shopify上に商品が登録されていません。");
        }
        
        // 2. 本システム (Firestore) 上の Shopify同期有効な商品数を確認
        console.log("\nFirestore 上の Shopify同期有効な商品をチェック中...");
        const { getAdminDb } = await import("../src/lib/firebase-admin");
        const db = getAdminDb();
        if (db) {
            const snap = await db.collection("products").where("shopifySyncEnabled", "==", true).get();
            console.log(`Firestore 上で Shopify同期が有効な商品数: ${snap.size} 件`);
            if (snap.size > 0) {
                snap.docs.forEach((doc) => {
                    const p = doc.data();
                    console.log(`- 商品名: ${p.name}`);
                    console.log(`  ShopifyバリアントID: ${p.shopifyVariantId || "(未設定)"}`);
                    console.log(`  現在の自社実在庫数 (stock): ${p.stock || 0}`);
                });
            }
        } else {
            console.warn("Firestoreに接続できませんでした (エミュレータが起動していない可能性があります)");
        }
        
    } catch (error: any) {
        console.error("テスト実行中にエラーが発生しました:", error.message);
    }
    console.log("\n=== テスト終了 ===");
}

runTest();
