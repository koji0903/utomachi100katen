// scratch/test-amazon-connection.ts
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
                // クォートの削除
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
    console.log("=== Amazon SP-API 接続テスト開始 ===");
    console.log(`AMAZON_USE_SANDBOX: ${process.env.AMAZON_USE_SANDBOX}`);
    console.log(`AMAZON_SELLER_ID: ${process.env.AMAZON_SELLER_ID}`);
    console.log(`AMAZON_APP_CLIENT_ID: ${process.env.AMAZON_APP_CLIENT_ID ? "設定あり" : "未設定"}`);
    
    // 環境変数が読み込まれた後にモジュールをロードする
    const { getAmazonOrders, getAmazonProduct } = await import("../src/lib/amazon");
    
    try {
        console.log("\n1. 注文一覧の取得テストを実行中...");
        const orders = await getAmazonOrders();
        console.log(`取得成功。注文数: ${orders.length} 件`);
        if (orders.length > 0) {
            console.log("取得できた注文のサンプル:");
            console.log(JSON.stringify(orders.slice(0, 2), null, 2));
        }

        console.log("\n2. 商品情報の取得テスト (ダミーSKU: 'TEST_SKU') を実行中...");
        const product = await getAmazonProduct("TEST_SKU");
        if (product) {
            console.log("商品情報取得成功:");
            console.log(JSON.stringify(product, null, 2));
        } else {
            console.log("商品情報が取得できませんでした (正常な動作、またはサンドボックスの制限)");
        }
        
    } catch (error: any) {
        console.error("テスト実行中にエラーが発生しました:", error.message);
    }
    console.log("\n=== テスト終了 ===");
}

runTest();
