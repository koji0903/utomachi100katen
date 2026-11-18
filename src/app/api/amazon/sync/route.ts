// src/app/api/amazon/sync/route.ts

import { NextResponse } from "next/server";
import { adminDb, FieldValue } from "@/lib/firebase-admin";
import { getAmazonProduct, getAmazonOrders } from "@/lib/amazon";
import { withAuth, internalError, logError } from "@/lib/apiAuth";

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (_req, { uid }) => {
    try {
        if (!adminDb) {
            logError("Amazon Sync", new Error("adminDb is not initialized"));
            return internalError();
        }
        const db = adminDb;

        // 0. スロットリングの確認（前回の実行から10分間はスキップ）
        const logsRef = db.collection("sync_logs");
        const lastLogSnap = await logsRef
            .where("type", "==", "Amazon")
            .orderBy("timestamp", "desc")
            .limit(1)
            .get();

        if (!lastLogSnap.empty) {
            const lastLog = lastLogSnap.docs[0].data();
            let lastTimestamp = new Date(0);
            if (lastLog.timestamp) {
                if (typeof lastLog.timestamp.toDate === "function") {
                    lastTimestamp = lastLog.timestamp.toDate();
                } else if (lastLog.timestamp instanceof Date) {
                    lastTimestamp = lastLog.timestamp;
                } else {
                    lastTimestamp = new Date(lastLog.timestamp);
                }
            }
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
        const productsRef = db.collection("products");
        const querySnapshot = await productsRef.where("amazonSyncEnabled", "==", true).get();

        const syncResults = [];

        for (const productDoc of querySnapshot.docs) {
            const product = productDoc.data();
            if (product.isTrashed === true) continue;
            const sku = product.amazonSku;

            if (sku) {
                try {
                    const amazonData = await getAmazonProduct(sku);

                    if (amazonData) {
                        await productDoc.ref.update({
                            lastAmazonSyncAt: FieldValue.serverTimestamp(),
                            amazonReferenceStock: amazonData.inventoryLevel,
                            amazonReferencePrice: amazonData.price,
                            updatedAt: FieldValue.serverTimestamp()
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
        const storesRef = db.collection("retailStores");
        const storeSnap = await storesRef
            .where("name", "==", "Amazon")
            .get();

        let amazonStore: { id: string, name: string } | null = null;
        const activeStoreDoc = storeSnap.docs.find(candidate => candidate.data().isTrashed !== true);
        if (activeStoreDoc) {
            amazonStore = { id: activeStoreDoc.id, name: activeStoreDoc.data().name };
        }

        // 1.6. Amazon SKU マッピングおよび商品マスターを事前ロード
        const [mappingsSnap, allProductsSnap] = await Promise.all([
            db.collection("amazon_sku_mappings").get(),
            db.collection("products").get(),
        ]);

        const activeProductMap = new Map<string, {
            id: string;
            name: string;
            sellingPrice: number;
            amazonSku?: string;
            isComposite?: boolean;
            components?: { productId: string; quantity: number }[];
        }>();
        const amazonSkuToProductMap = new Map<string, {
            id: string;
            name: string;
            sellingPrice: number;
            isComposite?: boolean;
            components?: { productId: string; quantity: number }[];
        }>();

        for (const pDoc of allProductsSnap.docs) {
            const pData = pDoc.data();
            if (pData.isTrashed === true) continue;
            const entry = {
                id: pDoc.id,
                name: String(pData.name || ""),
                sellingPrice: Number(pData.sellingPrice) || 0,
                amazonSku: pData.amazonSku ? String(pData.amazonSku).trim() : undefined,
                isComposite: pData.isComposite === true,
                components: Array.isArray(pData.components)
                    ? pData.components
                        .filter((c: any) => c && typeof c.productId === "string" && Number(c.quantity) > 0)
                        .map((c: any) => ({ productId: c.productId, quantity: Number(c.quantity) }))
                    : undefined,
            };
            activeProductMap.set(pDoc.id, entry);
            if (entry.amazonSku) {
                amazonSkuToProductMap.set(entry.amazonSku, entry);
            }
        }

        const addProductStockDeduction = (
            productUpdates: Map<string, { productName: string; quantity: number }>,
            targetProdId: string,
            deductQty: number
        ) => {
            const prod = activeProductMap.get(targetProdId);
            if (!prod) return;
            if (prod.isComposite && prod.components && prod.components.length > 0) {
                for (const comp of prod.components) {
                    const compProd = activeProductMap.get(comp.productId);
                    const compName = compProd ? compProd.name : prod.name;
                    const compDeduct = deductQty * comp.quantity;
                    const existing = productUpdates.get(comp.productId);
                    productUpdates.set(comp.productId, {
                        productName: compName,
                        quantity: (existing ? existing.quantity : 0) + compDeduct,
                    });
                }
            } else {
                const existing = productUpdates.get(prod.id);
                productUpdates.set(prod.id, {
                    productName: prod.name,
                    quantity: (existing ? existing.quantity : 0) + deductQty,
                });
            }
        };

        const skuMappingMap = new Map<string, { productId: string; quantity: number }[]>();
        for (const mDoc of mappingsSnap.docs) {
            const mData = mDoc.data();
            if (mData.enabled === false) continue;
            const skuKey = String(mData.sku || "").trim();
            if (!skuKey || !Array.isArray(mData.components)) continue;
            const comps = mData.components
                .filter((c: unknown): c is { productId: string; quantity?: unknown } =>
                    Boolean(c && typeof c === "object" && "productId" in c && typeof (c as { productId?: unknown }).productId === "string" && activeProductMap.has((c as { productId: string }).productId))
                )
                .map((c) => ({
                    productId: c.productId,
                    quantity: Math.max(1, Math.floor(Number(c.quantity) || 1)),
                }));
            if (comps.length > 0) {
                skuMappingMap.set(skuKey, comps);
            }
        }

        // 2. 注文情報（最新）の取得
        const orders = await getAmazonOrders();
        let newOrdersCount = 0;
        const processedOrders = [];

        for (const order of orders) {
            try {
                if (!order.items || order.items.length === 0) {
                    console.warn(`[Amazon Sync] Order ${order.amazonOrderId} has 0 items. Skipping.`);
                    continue;
                }

                const existingDocs = await db.collection("transactions")
                    .where("amazonOrderId", "==", order.amazonOrderId)
                    .get();

                if (existingDocs.empty) {
                    const saleItems: any[] = [];
                    const productUpdates: Map<string, { productName: string; quantity: number }> = new Map();

                    for (const item of order.items) {
                        const skuKey = String(item.sku || "").trim();
                        const mappedComponents = skuMappingMap.get(skuKey);

                        if (mappedComponents && mappedComponents.length > 0) {
                            const lineTotal = Math.round(Number(item.price) || 0);
                            const weights = mappedComponents.map((comp) => {
                                const prod = activeProductMap.get(comp.productId);
                                return Math.max(1, (prod?.sellingPrice || 0) * comp.quantity);
                            });
                            const totalWeight = weights.reduce((s, w) => s + w, 0);
                            let allocated = 0;

                            mappedComponents.forEach((comp, idx) => {
                                const prod = activeProductMap.get(comp.productId);
                                if (!prod) return;

                                const deductQty = item.quantity * comp.quantity;
                                addProductStockDeduction(productUpdates, prod.id, deductQty);

                                const isLast = idx === mappedComponents.length - 1;
                                const partSubtotal = isLast
                                    ? Math.max(0, lineTotal - allocated)
                                    : Math.round((lineTotal * weights[idx]) / totalWeight);
                                allocated += partSubtotal;

                                const unitPriceAtSale = deductQty > 0 ? Math.round(partSubtotal / deductQty) : 0;
                                saleItems.push({
                                    productId: prod.id,
                                    quantity: deductQty,
                                    priceAtSale: unitPriceAtSale,
                                    subtotal: partSubtotal,
                                    commission: 0,
                                    netProfit: partSubtotal,
                                });
                            });
                        } else {
                            // フォールバック: 商品マスターの amazonSku で直接紐づけ
                            const prod = amazonSkuToProductMap.get(skuKey);
                            if (prod) {
                                addProductStockDeduction(productUpdates, prod.id, item.quantity);
                                const lineTotal = Math.round(Number(item.price) || 0);
                                const unitPrice = item.quantity > 0 ? Math.round(lineTotal / item.quantity) : 0;
                                saleItems.push({
                                    productId: prod.id,
                                    quantity: item.quantity,
                                    priceAtSale: unitPrice,
                                    subtotal: lineTotal,
                                    commission: 0,
                                    netProfit: lineTotal,
                                });
                            }
                        }
                    }

                    const orderDateStr = (() => {
                        const d = order.purchaseDate ? new Date(order.purchaseDate) : new Date();
                        const ts = Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
                        return new Date(ts + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
                    })();

                    // Use atomic transaction for order processing
                    const isDuplicateInTx = await db.runTransaction(async (txn: any) => {
                        const transactionRef = db.collection("transactions").doc(`amazon_${order.amazonOrderId}`);
                        const existingTxDoc = await txn.get(transactionRef);
                        if (existingTxDoc.exists) {
                            return true;
                        }

                        const itemsSubtotalSum = saleItems.reduce((s, i) => s + i.subtotal, 0);
                        const effectiveOrderTotal = order.totalAmount > 0 ? order.totalAmount : itemsSubtotalSum;
                        const effectiveSaleTotal = itemsSubtotalSum > 0 ? itemsSubtotalSum : effectiveOrderTotal;

                        const transactionData = {
                            customerName: amazonStore ? amazonStore.name : "Amazon Customer",
                            storeId: amazonStore?.id || null,
                            storeName: amazonStore?.name || null,
                            recipientType: "store",
                            channel: "EC",
                            transactionType: "Amazon注文",
                            orderDate: orderDateStr,
                            transactionStatus: "受注",
                            subtotal: effectiveOrderTotal,
                            tax: 0,
                            totalAmount: effectiveOrderTotal,
                            paidAmount: 0,
                            balanceAmount: effectiveOrderTotal,
                            remarks: `Amazon Order ID: ${order.amazonOrderId}`,
                            amazonOrderId: order.amazonOrderId,
                            createdAt: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                        };

                        txn.set(transactionRef, transactionData);

                        for (const item of order.items) {
                            const lineTotal = Math.round(Number(item.price) || 0);
                            const unitPrice = item.quantity > 0 ? Math.round(lineTotal / item.quantity) : 0;
                            const itemRef = db.collection("transaction_items").doc();
                            txn.set(itemRef, {
                                transactionId: transactionRef.id,
                                productName: `Amazon商品 (${item.sku})`,
                                quantity: item.quantity,
                                unitPrice: unitPrice,
                                amount: lineTotal,
                                taxRate: 10,
                                createdAt: FieldValue.serverTimestamp(),
                                updatedAt: FieldValue.serverTimestamp(),
                            });
                        }

                        for (const [pId, update] of productUpdates.entries()) {
                            const pRef = db.collection("products").doc(pId);
                            txn.update(pRef, {
                                stock: FieldValue.increment(-update.quantity),
                                updatedAt: FieldValue.serverTimestamp()
                            });

                            const movementRef = db.collection("stock_movements").doc();
                            txn.set(movementRef, {
                                productId: pId,
                                productName: update.productName,
                                type: 'out',
                                quantity: update.quantity,
                                reason: 'amazon_sync',
                                referenceId: transactionRef.id,
                                date: orderDateStr,
                                createdAt: FieldValue.serverTimestamp()
                            });
                        }

                        if (amazonStore && saleItems.length > 0) {
                            const saleRef = db.collection("sales").doc(`amazon_${order.amazonOrderId}`);
                            txn.set(saleRef, {
                                storeId: amazonStore.id,
                                storeName: amazonStore.name,
                                recipientType: 'store',
                                type: 'daily',
                                period: orderDateStr,
                                items: saleItems,
                                totalQuantity: saleItems.reduce((sum, item) => sum + item.quantity, 0),
                                totalAmount: effectiveSaleTotal,
                                totalCommission: 0,
                                totalNetProfit: effectiveSaleTotal,
                                inventoryEffects: [...productUpdates.entries()].map(([productId, update]) => ({
                                    scope: 'main',
                                    productId,
                                    quantity: -update.quantity,
                                })),
                                isTrashed: false,
                                transactionId: transactionRef.id,
                                createdAt: FieldValue.serverTimestamp(),
                                updatedAt: FieldValue.serverTimestamp(),
                            });
                        }

                        return false;
                    });

                    if (!isDuplicateInTx) {
                        newOrdersCount++;
                        processedOrders.push(order.amazonOrderId);
                    }
                }
            } catch (err) {
                logError("Amazon Sync:order", err, { amazonOrderId: order.amazonOrderId });
            }
        }

        await db.collection("sync_logs").add({
            type: 'Amazon',
            timestamp: FieldValue.serverTimestamp(),
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
