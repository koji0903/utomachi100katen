// src/app/api/shopify/sync/route.ts

import { NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";
import { getShopifyProduct, getShopifyOrders, updateShopifyInventory } from "@/lib/shopify";
import { processShopifyOrder } from "@/lib/shopify-processor";
import { withAuth, internalError, logError } from "@/lib/apiAuth";

export const POST = withAuth(async (_req, { uid }) => {
    try {
        if (!adminDb) {
            logError("Shopify Sync", new Error("adminDb is not initialized"));
            return internalError();
        }
        const db = adminDb;
        const productsRef = db.collection("products");
        const querySnapshot = await productsRef.where("shopifySyncEnabled", "==", true).get();

        const syncResults = [];

        for (const productDoc of querySnapshot.docs) {
            const product = productDoc.data();
            if (product.shopifyVariantId) {
                const currentStock = product.stock || 0;
                const success = await updateShopifyInventory(product.shopifyVariantId, currentStock);

                if (success) {
                    await productDoc.ref.update({
                        lastShopifySyncAt: admin.firestore.FieldValue.serverTimestamp(),
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
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'success',
            productCount: syncResults.length,
            orderCount: newOrdersCount,
            triggeredBy: uid,
            details: {
                syncedProducts: syncResults.map(p => p.name),
                newOrderIds: processedOrders
            }
        };
        await db.collection("sync_logs").add(logData);

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
