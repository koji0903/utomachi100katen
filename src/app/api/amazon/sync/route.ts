// src/app/api/amazon/sync/route.ts

import { NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";
import { getAmazonProduct, getAmazonOrders } from "@/lib/amazon";

export async function POST(req: Request) {
    try {
        console.log("[Amazon Sync] Starting synchronization process (Server/Admin SDK)...");

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
                console.log(`[Amazon Sync] Skipping sync. Last sync was ${Math.floor(diffMinutes)} minutes ago.`);
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
                    // Amazon から最新情報を取得
                    const amazonData = await getAmazonProduct(sku);

                    if (amazonData) {
                        // 在庫・価格情報の更新
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
                    console.error(`[Amazon Sync] Error syncing product ${product.name}:`, err);
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
                // 既に登録済みかチェック
                const existingDocs = await adminDb.collection("transactions")
                    .where("amazonOrderId", "==", order.amazonOrderId)
                    .get();

                if (existingDocs.empty) {
                    newOrdersCount++;
                    processedOrders.push(order.amazonOrderId);
                    
                    // 取引データの作成
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

                    await transactionRef.set(transactionData);

                    // 明細の登録
                    const saleItems = [];
                    for (const item of order.items) {
                        await adminDb.collection("transaction_items").add({
                            transactionId: transactionRef.id,
                            productName: `Amazon商品 (${item.sku})`,
                            quantity: item.quantity,
                            unitPrice: item.price,
                            amount: item.quantity * item.price,
                            taxRate: 10,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });

                        // 商品マスタの特定と在庫減算
                        const pSnap = await adminDb.collection("products")
                            .where("amazonSku", "==", item.sku)
                            .get();

                        if (!pSnap.empty) {
                            const pDoc = pSnap.docs[0];
                            const pId = pDoc.id;
                            const pData = pDoc.data();

                            await pDoc.ref.update({
                                stock: (pData.stock || 0) - item.quantity,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });

                            // 在庫移動の記録
                            await adminDb.collection("stock_movements").add({
                                productId: pId,
                                productName: pData.name,
                                type: 'out',
                                quantity: item.quantity,
                                reason: 'amazon_sync',
                                referenceId: transactionRef.id,
                                date: order.purchaseDate.split('T')[0],
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            });

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

                    // 売上データ作成
                    if (amazonStore && saleItems.length > 0) {
                        await adminDb.collection("sales").add({
                            storeId: amazonStore.id,
                            type: 'daily',
                            period: order.purchaseDate.split('T')[0],
                            items: saleItems,
                            totalAmount: order.totalAmount,
                            isTrashed: false,
                            transactionId: transactionRef.id,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                }
            } catch (err) {
                console.error(`[Amazon Sync] Error processing order ${order.amazonOrderId}:`, err);
            }
        }

        // 3. 同期ログの保存
        await adminDb.collection("sync_logs").add({
            type: 'Amazon',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'success',
            productCount: syncResults.length,
            orderCount: newOrdersCount,
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
            message: `Amazon同期が完了しました。${syncResults.length}件の商品と${newOrdersCount}件の注文を処理きました。`
        });

    } catch (error: any) {
        console.error("Amazon Sync Error:", error);
        return NextResponse.json(
            { error: "Amazon同期中にエラーが発生しました。", detail: error.message },
            { status: 500 }
        );
    }
}
