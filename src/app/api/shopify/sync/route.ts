// src/app/api/shopify/sync/route.ts

import { NextResponse } from "next/server";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getShopifyProduct, getShopifyOrders, updateShopifyInventory } from "@/lib/shopify";
import { processShopifyOrder } from "@/lib/shopify-processor";

export async function POST(req: Request) {
    try {
        console.log("[Shopify Sync] Starting synchronization process...");

        // 1. 同期が有効な商品を取得
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("shopifySyncEnabled", "==", true));
        const querySnapshot = await getDocs(q);

        const syncResults = [];

        for (const productDoc of querySnapshot.docs) {
            const product = productDoc.data();
            if (product.shopifyVariantId) {
                // Shopify へ本システムの最新在庫を反映
                const currentStock = product.stock || 0;
                const success = await updateShopifyInventory(product.shopifyVariantId, currentStock);

                if (success) {
                    await updateDoc(doc(db, "products", productDoc.id), {
                        lastShopifySyncAt: serverTimestamp(),
                    });

                    syncResults.push({
                        id: productDoc.id,
                        name: product.name,
                        variantId: product.shopifyVariantId,
                        status: "Synced"
                    });
                }
            }
        }

        // 2. 注文情報（最新）の取得
        const orders = await getShopifyOrders();
        let newOrdersCount = 0;

        for (const order of orders) {
            const result = await processShopifyOrder(order);
            if (result.success) {
                newOrdersCount++;
            }
        }

        return NextResponse.json({
            success: true,
            syncedProducts: syncResults,
            newOrdersCount: newOrdersCount,
            message: `Shopify同期が完了しました。${newOrdersCount}件の新規注文を登録しました。`
        });

    } catch (error: any) {
        console.error("Shopify Sync Error:", error);
        return NextResponse.json(
            { error: "Shopify同期中にエラーが発生しました。", detail: error.message },
            { status: 500 }
        );
    }
}
