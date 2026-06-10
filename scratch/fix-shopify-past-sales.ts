// scratch/fix-shopify-past-sales.ts
import fs from "fs";
import path from "path";

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
    }
} catch (err: any) {
    console.error("Failed to load env:", err.message);
}

// 本番DB強制接続
process.env.NEXT_PUBLIC_USE_EMULATOR = "false";
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

const shopifyStoreId = "gD1LFyg3rQ6KbPlLkb4d"; // 本番のShopify店舗ID
const targetOrders = [
    {
        shopifyOrderId: "7562019799336",
        transactionId: "jDodYLVXrRrPTSaBvkqV",
        date: "2026-05-28",
        totalPrice: 4980,
        items: [
            {
                shopifyVariantId: "50515794854184", // ふりかけボトル
                quantity: 5,
                price: 780
            }
            // Tipは実商品ではないため対象外とする
        ]
    },
    {
        shopifyOrderId: "7454864146728",
        transactionId: "JFb06QDeHbAQnA2TCPcF",
        date: "2026-05-06",
        totalPrice: 4590,
        items: [
            {
                shopifyVariantId: "50515794854184", // ふりかけボトル
                quantity: 5,
                price: 780
            }
        ]
    },
    {
        shopifyOrderId: "7411240010024",
        transactionId: "h8OEuHZXvBEhoIqmg6wa",
        date: "2026-04-18",
        totalPrice: 3120,
        items: [
            {
                shopifyVariantId: "50515794854184", // ふりかけボトル
                quantity: 3,
                price: 780
            }
        ]
    }
];

async function runMigration() {
    console.log("=== 本番環境データ復旧マイグレーション実行 ===");

    const { getAdminDb, admin } = await import("../src/lib/firebase-admin");
    const db = getAdminDb();
    if (!db) {
        console.error("本番DBへの接続に失敗しました。");
        return;
    }

    try {
        // 1. 店舗の isTrashed 欠落を修正 (isTrashed が未定義のものを false に更新)
        console.log("\n1. 店舗データの isTrashed フィールド修正を開始します...");
        const storeSnap = await db.collection("retailStores").get();
        for (const doc of storeSnap.docs) {
            const data = doc.data();
            if (data.isTrashed === undefined) {
                await doc.ref.update({ isTrashed: false });
                console.log(`- 店舗 "${data.name}" (${doc.id}) の isTrashed を false に更新しました。`);
            }
        }

        // 2. 過去の Shopify 取引データ (transactions) の店舗紐付けを修正
        console.log("\n2. 過去の Shopify 取引データの店舗紐付けを修正します...");
        for (const order of targetOrders) {
            const tRef = db.collection("transactions").doc(order.transactionId);
            await tRef.update({
                storeId: shopifyStoreId,
                storeName: "Shopify",
                customerName: "Shopify Customer",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`- 取引ID: ${order.transactionId} (注文 #${order.shopifyOrderId}) の店舗紐付けを完了。`);
        }

        // 3. 売上データ (sales) の作成と登録
        console.log("\n3. 売上データ (sales) の復旧作成を開始します...");
        for (const order of targetOrders) {
            // すでにこの取引に関連する sales が存在するかチェック
            const existingSales = await db.collection("sales")
                .where("transactionId", "==", order.transactionId)
                .get();

            if (!existingSales.empty) {
                console.log(`- 取引ID: ${order.transactionId} の売上データはすでに存在します。スキップします。`);
                continue;
            }

            // 売上明細 (items) の組み立て
            const saleItems = [];
            let totalQty = 0;

            for (const item of order.items) {
                // ShopifyバリアントIDからFirestore上の商品情報を取得
                let pSnap = await db.collection("products")
                    .where("shopifyVariantIds", "array-contains", item.shopifyVariantId)
                    .get();

                if (pSnap.empty) {
                    pSnap = await db.collection("products")
                        .where("shopifyVariantId", "==", item.shopifyVariantId)
                        .get();
                }

                if (!pSnap.empty) {
                    const pDoc = pSnap.docs[0];
                    saleItems.push({
                        productId: pDoc.id,
                        productName: pDoc.data().name,
                        quantity: item.quantity,
                        priceAtSale: item.price,
                        subtotal: item.quantity * item.price,
                        commission: 0,
                        netProfit: item.quantity * item.price
                    });
                    totalQty += item.quantity;
                } else {
                    console.warn(`[警告] バリアントID: ${item.shopifyVariantId} に一致する商品がFirestoreに見つかりませんでした。`);
                }
            }

            if (saleItems.length > 0) {
                const saleData = {
                    storeId: shopifyStoreId,
                    storeName: "Shopify",
                    type: "daily",
                    period: order.date,
                    items: saleItems,
                    totalQuantity: totalQty,
                    totalAmount: order.totalPrice, // 注文総額 (送料や手数料を含む場合があるため payload の totalPrice)
                    totalCommission: 0,
                    totalNetProfit: order.totalPrice,
                    isTrashed: false,
                    transactionId: order.transactionId,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                await db.collection("sales").add(saleData);
                console.log(`- 売上レコード作成成功: 日付: ${order.date}, 金額: ¥${order.totalPrice} (取引ID: ${order.transactionId})`);
            } else {
                console.error(`- 取引ID: ${order.transactionId} に対する売上明細の構築に失敗したため、作成をスキップしました。`);
            }
        }

        console.log("\n=== マイグレーション処理が正常に完了しました ===");

    } catch (e: any) {
        console.error("\nマイグレーション中にエラーが発生しました:", e.message);
    }
}

runMigration();
