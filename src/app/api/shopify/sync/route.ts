// src/app/api/shopify/sync/route.ts

import { NextResponse } from "next/server";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getShopifyProduct, getShopifyOrders, updateShopifyInventory } from "@/lib/shopify";
import { processShopifyOrder } from "@/lib/shopify-processor";
import { withAuth, internalError, logError } from "@/lib/apiAuth";

export const POST = withAuth(async (_req, { uid }) => {
    try {
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("shopifySyncEnabled", "==", true));
        const querySnapshot = await getDocs(q);

        const syncResults = [];

        for (const productDoc of querySnapshot.docs) {
            const product = productDoc.data();
            if (product.shopifyVariantId) {
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

        const orders = await getShopifyOrders();
        let newOrdersCount = 0;
        const processedOrders = [];

        for (const order of orders) {
            const result = await processShopifyOrder(order);
            if (result.success) {
                newOrdersCount++;
                processedOrders.push(result.orderId);
            }
        }

        const logData = {
            type: 'Shopify',
            timestamp: serverTimestamp(),
            status: 'success',
            productCount: syncResults.length,
            orderCount: newOrdersCount,
            triggeredBy: uid,
            details: {
                syncedProducts: syncResults.map(p => p.name),
                newOrderIds: processedOrders
            }
        };
        await setDoc(doc(collection(db, "sync_logs")), logData);

        return NextResponse.json({
            success: true,
            syncedProducts: syncResults,
            newOrdersCount: newOrdersCount,
            newOrderIds: processedOrders,
            message: `Shopify同期が完了しました。${syncResults.length}件の商品と${newOrdersCount}件の注文を処理しました。`
        });

    } catch (error) {
        logError("Shopify Sync", error, { uid });
        return internalError();
    }
});
