// scratch/test-shopify-webhook.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";

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
    }
} catch (err: any) {
    console.error("Failed to load env:", err.message);
}

async function testWebhook() {
    console.log("=== Shopify Webhook 開通テスト開始 ===");
    
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) {
        console.error("SHOPIFY_WEBHOOK_SECRET が設定されていません。.env.local を確認してください。");
        return;
    }

    // テスト用のダミー注文データ
    // バリアントID '51331791520040' は「おいのり２個セット ボトル」に設定したID
    const orderPayload = {
        id: 9999999999999, // 重複を避けるためユニークなテスト用ID
        created_at: new Date().toISOString(),
        financial_status: "paid",
        total_price: "1888.00",
        line_items: [
            {
                variant_id: 51331791520040,
                sku: "TEST-OINORI-BOTTLE",
                quantity: 1,
                price: "1888.00"
            }
        ]
    };

    const bodyString = JSON.stringify(orderPayload);
    
    // HMAC 署名の生成 (Shopifyの仕様に準拠した sha256 + base64)
    const hmac = crypto
        .createHmac("sha256", secret)
        .update(bodyString, "utf8")
        .digest("base64");

    const url = "http://localhost:3000/api/shopify/webhook";
    console.log(`\nテスト用 Webhook リクエストを送信します...`);
    console.log(`URL: ${url}`);
    console.log(`X-Shopify-Hmac-Sha256: ${hmac}`);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Hmac-Sha256": hmac
            },
            body: bodyString
        });

        console.log(`ステータスコード: ${response.status} ${response.statusText}`);
        
        const responseData = await response.json();
        console.log("サーバーレスポンス:");
        console.log(JSON.stringify(responseData, null, 2));

        if (response.ok && responseData.success) {
            console.log("\n[結果] 連携チェック成功！署名検証が通り、注文処理が正常に受け付けられました。");
            
            // 在庫が正しく引き落とされたか確認
            console.log("\n商品の在庫数が減少したかチェックしています...");
            const { getAdminDb } = await import("../src/lib/firebase-admin");
            const db = getAdminDb();
            if (db) {
                const snap = await db.collection("products")
                    .where("shopifyVariantIds", "array-contains", "51331791520040")
                    .get();
                if (!snap.empty) {
                    const p = snap.docs[0].data();
                    console.log(`商品名: ${p.name}`);
                    console.log(`現在の在庫数 (stock): ${p.stock} 個 (テスト完了後に適宜戻してください)`);
                }
            }
        } else {
            console.error("\n[結果] 連携エラーが発生しました。レスポンスを確認してください。");
        }

    } catch (error: any) {
        console.error("\nリクエスト送信中にエラーが発生しました:", error.message);
        console.log("ローカルサーバー (npm run dev) が起動していることを確認してください。");
    }
    console.log("\n=== テスト終了 ===");
}

testWebhook();
