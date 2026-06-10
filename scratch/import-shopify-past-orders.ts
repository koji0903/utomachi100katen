// scratch/import-shopify-past-orders.ts
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
        console.log("Loaded env variables");
    }
} catch (err: any) {
    console.error("Failed to load env:", err.message);
}

const API_VERSION = "2024-01";

async function importPastOrders() {
    console.log("=== Shopify 過去60日分の注文インポート処理開始 ===");
    
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    if (!domain || !token) {
        console.error("Shopify の設定値が足りません。");
        return;
    }

    // 60日前の日付を計算
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const createdAtMin = sixtyDaysAgo.toISOString();
    console.log(`取得開始日 (created_at_min): ${createdAtMin}`);

    // Shopify から過去60日分の注文を取得 (最大250件)
    const url = `https://${domain}/admin/api/${API_VERSION}/orders.json?status=any&limit=250&created_at_min=${createdAtMin}`;
    console.log(`Shopify API 呼び出し中: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": token,
            }
        });

        if (!response.ok) {
            const err = await response.json();
            console.error("Shopify API Error:", err);
            return;
        }

        const data = await response.json();
        const rawOrders = data.orders || [];
        console.log(`Shopify から取得した注文数: ${rawOrders.length} 件`);

        if (rawOrders.length === 0) {
            console.log("過去60日間に該当する注文はありませんでした。");
            return;
        }

        // 動的インポート
        const { processShopifyOrder } = await import("../src/lib/shopify-processor");

        let importedCount = 0;
        let skippedCount = 0;

        for (const rawOrder of rawOrders) {
            // ShopifyOrder インターフェースへのマッピング
            const order = {
                shopifyOrderId: rawOrder.id.toString(),
                createdAt: rawOrder.created_at,
                financialStatus: rawOrder.financial_status,
                totalPrice: parseFloat(rawOrder.total_price),
                lineItems: rawOrder.line_items.map((item: any) => ({
                    variantId: item.variant_id?.toString() || "",
                    sku: item.sku || "",
                    quantity: item.quantity,
                    price: parseFloat(item.price),
                })),
            };

            // 注文インポート実行
            const result = await processShopifyOrder(order);
            if (result.success) {
                console.log(`-> インポート成功: 注文ID ${order.shopifyOrderId} (${order.createdAt.split('T')[0]})`);
                importedCount++;
            } else if (result.reason === "duplicate") {
                skippedCount++;
            } else {
                console.log(`-> スキップまたは失敗: 注文ID ${order.shopifyOrderId} (${result.reason})`);
            }
        }

        console.log(`\n=== インポート結果 ===`);
        console.log(`新規インポート数: ${importedCount} 件`);
        console.log(`重複スキップ数: ${skippedCount} 件`);
        console.log(`処理した総注文数: ${rawOrders.length} 件`);

    } catch (error: any) {
        console.error("インポート処理中にエラーが発生しました:", error.message);
    }
    console.log("=== 処理終了 ===");
}

importPastOrders();
