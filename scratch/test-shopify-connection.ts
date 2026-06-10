// scratch/test-shopify-connection.ts
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

async function runTest() {
    console.log("=== Shopify API 接続テスト開始 ===");
    console.log(`SHOPIFY_STORE_DOMAIN: ${process.env.SHOPIFY_STORE_DOMAIN}`);
    console.log(`SHOPIFY_ADMIN_ACCESS_TOKEN: ${process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ? "設定あり" : "未設定"}`);
    
    // 動的インポート
    const { getShopifyOrders } = await import("../src/lib/shopify");
    
    try {
        console.log("\nShopify から最近の注文情報を取得中...");
        const orders = await getShopifyOrders();
        console.log(`取得成功。注文数: ${orders.length} 件`);
        if (orders.length > 0) {
            console.log("取得できた注文のサンプル:");
            console.log(JSON.stringify(orders.slice(0, 2), null, 2));
        }
    } catch (error: any) {
        console.error("テスト実行中にエラーが発生しました:", error.message);
    }
    console.log("\n=== テスト終了 ===");
}

runTest();
