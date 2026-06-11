// scratch/sync-shopify-past-customers.ts
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

// 本番DB強制接続
process.env.NEXT_PUBLIC_USE_EMULATOR = "false";
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

const API_VERSION = "2024-01";

async function syncPastCustomers() {
    console.log("=== Shopify 過去60日の注文顧客情報同期処理開始 ===");
    
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    if (!domain || !token) {
        console.error("Shopify の設定値が足りません。");
        return;
    }

    const { getAdminDb } = await import("../src/lib/firebase-admin");
    const db = getAdminDb();
    if (!db) {
        console.error("本番DBへの接続に失敗しました。");
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

        // 注文を時系列（昇順）にソートして、顧客ごとの購入数を正しくカウントする
        const sortedOrders = rawOrders.slice().sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
        const customerPurchaseCounter: Record<string, number> = {};

        let updatedCount = 0;
        let notFoundCount = 0;
        let noCustomerCount = 0;

        for (const rawOrder of sortedOrders) {
            const shopifyOrderId = rawOrder.id.toString();
            const customer = rawOrder.customer;

            if (!customer) {
                console.log(`-> 注文 ID ${shopifyOrderId}: 顧客情報がありません。スキップします。`);
                noCustomerCount++;
                continue;
            }

            const customerId = customer.id.toString();
            // 顧客ごとの購入カウンタをインクリメント
            customerPurchaseCounter[customerId] = (customerPurchaseCounter[customerId] || 0) + 1;
            const currentCount = customerPurchaseCounter[customerId];

            const customerNameStr = `${customer.last_name || ""} ${customer.first_name || ""}`.trim() || customer.email || "Shopify Customer";

            // Firestore の transactions コレクションから shopifyOrderId が一致するドキュメントを探す
            const txSnap = await db.collection("transactions")
                .where("shopifyOrderId", "==", shopifyOrderId)
                .get();

            if (txSnap.empty) {
                console.log(`-> 注文 ID ${shopifyOrderId}: Firestore に対応する取引が見つかりません。`);
                notFoundCount++;
                continue;
            }

            // 更新処理
            for (const doc of txSnap.docs) {
                await doc.ref.update({
                    customerName: customerNameStr,
                    customerEmail: customer.email || null,
                    shopifyCustomerId: customerId,
                    isRepeatCustomer: currentCount > 1,
                    shopifyOrdersCount: currentCount,
                });
                console.log(`-> 同期成功: 取引ID ${doc.id} (注文ID: ${shopifyOrderId}) -> 顧客名: ${customerNameStr}, 累計注文: ${currentCount}回目`);
                updatedCount++;
            }
        }

        console.log(`\n=== 同期結果 ===`);
        console.log(`同期更新数: ${updatedCount} 件`);
        console.log(`取引未検出数: ${notFoundCount} 件`);
        console.log(`顧客情報無し数: ${noCustomerCount} 件`);

    } catch (error: any) {
        console.error("同期処理中にエラーが発生しました:", error.message);
    }
    console.log("=== 処理終了 ===");
}

syncPastCustomers();
