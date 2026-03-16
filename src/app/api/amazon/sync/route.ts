// src/app/api/amazon/sync/route.ts

import { NextResponse } from "next/server";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAmazonProduct, getAmazonOrders } from "@/lib/amazon";

export async function POST(req: Request) {
    try {
        console.log("[Amazon Sync] Starting synchronization process...");

        // 1. 同期が有効な商品を取得
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("amazonSyncEnabled", "==", true));
        const querySnapshot = await getDocs(q);

        const syncResults = [];

        for (const productDoc of querySnapshot.docs) {
            const product = productDoc.data();
            if (product.amazonAsin) {
                // Amazon から最新情報を取得 (Mock)
                const amazonData = await getAmazonProduct(product.amazonAsin);

                if (amazonData) {
                    // ここでは例として同期時刻のみ更新。
                    // 実際は在庫数の調整などを行うロジックが入ります。
                    await updateDoc(doc(db, "products", productDoc.id), {
                        lastAmazonSyncAt: serverTimestamp(),
                        // amazonStock: amazonData.inventoryLevel, // 必要に応じて追加
                    });

                    syncResults.push({
                        id: productDoc.id,
                        name: product.name,
                        asin: product.amazonAsin,
                        status: "Synced"
                    });
                }
            }
        }

        // 2. 注文情報の取得 (Mock)
        const orders = await getAmazonOrders();
        // TODO: 取得した注文情報を Firestore の transactions 等に登録する処理

        return NextResponse.json({
            success: true,
            syncedProducts: syncResults,
            newOrdersCount: orders.length,
            message: "Amazon同期が正常に完了しました。"
        });

    } catch (error: any) {
        console.error("Amazon Sync Error:", error);
        return NextResponse.json(
            { error: "Amazon同期中にエラーが発生しました。", detail: error.message },
            { status: 500 }
        );
    }
}
