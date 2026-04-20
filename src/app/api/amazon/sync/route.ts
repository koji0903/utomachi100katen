// src/app/api/amazon/sync/route.ts

import { NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";
import { getAmazonProduct, getAmazonOrders } from "@/lib/amazon";
import { withAuth, internalError, logError } from "@/lib/apiAuth";

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (_req, { uid }) => {
    try {
        // 0. スロットリングの確認（前回の実行から10分間はスキップ）
        const logsRef = adminDb.collection("sync_logs");
        const lastLogSnap = await logsRef
            .where("type", "==", "Amazon")
            .orderBy("timestamp", "desc")
            .limit(1)
            .get();

        if (!lastLogSnap.empty) {
            const lastLog = lastLogSnap.docs[0].data();
            const lastTimestamp = lastLog.timestamp?.toDate() || new Date(0);
            const now = new Date();
            const diffMinutes = (now.getTime() - lastTimestamp.getTime()) / (1000 * 60);

            if (diffMinutes < 10) {
                return NextResponse.json({
                    success: true,
                    skipped: true,
                    message: "前回の同期から間もないため、スキップしました（10分間隔制限）"
                });
            }
        }

        // 1. 同期が有効な商品を取得
        const productsRef = adminDb.collection("products");
        const querySnapshot = await productsRef.where("amazonSyncEnabled", "==", true).get();

        const syncResults = [];

        for (const productDoc of querySnapshot.docs) {
            const product = productDoc.data();
            const sku = product.amazonSku;

            if (sku) {
                try {
                    const amazonData = await getAmazonProduct(sku);

                    if (amazonData) {
                        await productDoc.ref.update({
                            lastAmazonSyncAt: admin.firestore.FieldValue.serverTimestamp(),
                            amazonReferenceStock: amazonData.inventoryLevel,
                            amazonReferencePrice: amazonData.price,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });

                        syncResults.push({
                            id: productDoc.id,
                            name: product.name,
                            sku: sku,
                            status: "Synced"
                        });
                    }
                } catch (err) {
                    logError("Amazon Sync:product", err, { productId: productDoc.id, sku });
                    syncResults.push({
                        id: productDoc.id,
                        name: product.name,
                        sku: sku,
                        status: "Failed"
                    });
                }
            }
        }

        // 1.5. Amazon用の店舗を特定
        const storesRef = adminDb.collection("retailStores");
        const storeSnap = await storesRef
            .where("name", "==", "Amazon")
            .where("isTrashed", "==", false)
            .get();

        let amazonStore: { id: string, name: string } | null = null;
        if (!storeSnap.empty) {
            amazonStore = { id: storeSnap.docs[0].id, name: storeSnap.docs[0].data().name };
        }

        // 2. 注文情報（最新）の取得
        const orders = await getAmazonOrders();
        let newOrdersCount = 0;
        const processedOrders = [];

        for (const order of orders) {
            try {
                const existingDocs = await adminDb.collection("transactions")
                    .where("amazonOrderId", "==", order.amazonOrderId)
                    .get();

                if (existingDocs.empty) {
                    const saleItems: any[] = [];
                    const productUpdates: Map<string, { newStock: number; productName: string; quantity: number }> = new Map();

                    for (const item of order.items) {
                        const pSnap = await adminDb.collection("products")
                            .where("amazonSku", "==", item.sku)
                            .get();

                        if (!pSnap.empty) {
                            const pDoc = pSnap.docs[0];
                            const pId = pDoc.id;
                            const pData = pDoc.data();
                            const newStock = (pData.stock || 0) - item.quantity;

                            productUpdates.set(pId, { newStock, productName: pData.name, quantity: item.quantity });
                            saleItems.push({
                                productId: pId,
                                quantity: item.quantity,
                                priceAtSale: item.price,
                                subtotal: item.quantity * item.price,
                                commission: 0,
                                netProfit: item.quantity * item.price
                            });
                        }
                    }

                    // Use atomic transaction for order processing
                    await adminDb.runTransaction(async (txn) => {
                        const transactionRef = adminDb.collection("transactions").doc();
                        const transactionData = {
                            customerName: amazonStore ? amazonStore.name : "Amazon Customer",
                            storeId: amazonStore?.id || null,
                            storeName: amazonStore?.name || null,
                            channel: "EC",
                            transactionType: "Amazon注文",
                            orderDate: order.purchaseDate.split('T')[0],
                            transactionStatus: "受注",
                            subtotal: order.totalAmount,
                            tax: 0,
                            totalAmount: order.totalAmount,
                            paidAmount: 0,
                            balanceAmount: order.totalAmount,
                            remarks: `Amazon Order ID: ${order.amazonOrderId}`,
                            amazonOrderId: order.amazonOrderId,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        };

                        txn.set(transactionRef, transactionData);

                        for (const item of order.items) {
                            const itemRef = adminDb.collection("transaction_items").doc();
                            txn.set(itemRef, {
                                transactionId: transactionRef.id,
                                productName: `Amazon商品 (${item.sku})`,
                                quantity: item.quantity,
                                unitPrice: item.price,
                                amount: item.quantity * item.price,
                                taxRate: 10,
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                        }

                        for (const [pId, update] of productUpdates.entries()) {
                            const pRef = adminDb.collection("products").doc(pId);
                            txn.update(pRef, {
                                stock: update.newStock,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });

                            const movementRef = adminDb.collection("stock_movements").doc();
                            txn.set(movementRef, {
                                productId: pId,
                                productName: update.productName,
                                type: 'out',
                                quantity: update.quantity,
                                reason: 'amazon_sync',
                                referenceId: transactionRef.id,
                                date: order.purchaseDate.split('T')[0],
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                        }
                    });

                    if (amazonStore && saleItems.length > 0) {
                        await adminDb.collection("sales").add({
                            storeId: amazonStore.id,
                            type: 'daily',
                            period: order.purchaseDate.split('T')[0],
                            items: saleItems,
                            totalAmount: order.totalAmount,
                            isTrashed: false,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }

                    newOrdersCount++;
                    processedOrders.push(order.amazonOrderId);
                }
            } catch (err) {
                logError("Amazon Sync:order", err, { amazonOrderId: order.amazonOrderId });
                processedOrders.push(order.amazonOrderId);
            }
        }

        await adminDb.collection("sync_logs").add({
            type: 'Amazon',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'success',
            productCount: syncResults.length,
            orderCount: newOrdersCount,
            triggeredBy: uid,
            details: {
                syncedProducts: syncResults.map(p => p.name),
                newOrderIds: processedOrders
            }
        });

        return NextResponse.json({
            success: true,
            syncedProducts: syncResults,
            newOrdersCount: newOrdersCount,
            newOrderIds: processedOrders,
            message: `Amazon同期が完了しました。${syncResults.length}件の商品と${newOrdersCount}件の注文を処理しました。`
        });

    } catch (error) {
        logError("Amazon Sync", error, { uid });
        return internalError();
    }
});
