// src/lib/square-sync-client.ts

import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { apiFetch } from "@/lib/apiClient";

import { db } from "@/lib/firebase";
import { processSquareOrder } from "./square-processor";

export interface SyncResult {
    success: boolean;
    syncedProductsCount: number;
    newOrdersCount: number;
    message: string;
    detail?: string;
}

/**
 * Client-side Square Synchronization
 * ブラウザ側で実行することで、ユーザーの認証コンテキストを利用して Firestore を更新します。
 */
export async function syncWithSquare(storeId: string, options?: { skipInventory?: boolean }): Promise<SyncResult> {
    const skipInventory = options?.skipInventory ?? false;

    try {
        console.log(`[Square Sync Client] Starting sync for store: ${storeId}`);

        // 0. 店舗情報の取得 (Location ID 特定のため)
        const storeDoc = await getDoc(doc(db, "retailStores", storeId));
        if (!storeDoc.exists()) throw new Error("店舗情報が見つかりません。");
        const storeData = storeDoc.data();
        let squareLocationId = storeData.squareLocationId || null;

        if (!squareLocationId) {
            throw new Error("この店舗には Square Location ID が設定されていません。");
        }

        // 1. 同期が有効な商品を取得 (Firestore 読み取り - Client Auth)
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("squareSyncEnabled", "==", true), where("isTrashed", "==", false));
        const querySnapshot = await getDocs(q);

        const productsToSync = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
        // 2. Square カタログの紐付け (JANコード)
        for (const product of productsToSync) {
            if (!product.squareVariantId && product.janCode) {
                const res = await apiFetch("/api/square/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "find-catalog", janCode: product.janCode })
                });
                const data = await res.json();
                if (data.success && data.catalogObj) {
                    await updateDoc(doc(db, "products", product.id), {
                        squareVariantId: data.catalogObj.id,
                        updatedAt: serverTimestamp()
                    });
                    product.squareVariantId = data.catalogObj.id;
                    console.log(`[Square Sync Client] Linked product ${product.name} to Square ID: ${data.catalogObj.id}`);
                }
            }
        }

        // 3. Square 注文データの取得 (API Proxy 経由)
        const orderRes = await apiFetch("/api/square/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "fetch-orders", locationId: squareLocationId })
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderData.detail || orderData.error);

        squareLocationId = orderData.locationId;
        const orders = orderData.orders || [];

        // 4. Firestore への注文反映 (Firestore 書き込み - Client Auth)
        let newOrdersCount = 0;
        const processedOrderIds = [];
        const targetStore = { id: storeId, name: storeData.name };

        for (const order of orders) {
            const result = await processSquareOrder(order, { 
                skipInventory,
                targetStore
            });


            if (result.success) {
                newOrdersCount++;
                processedOrderIds.push(order.id);
            }
        }

        // 5. 在庫情報の反映 (System -> Square)
        const productsWithId = productsToSync.filter(p => p.squareVariantId);
        const inventoryUpdates = productsWithId.map(p => ({
            catalogObjectId: p.squareVariantId,
            quantity: p.stock || 0
        }));

        if (inventoryUpdates.length > 0) {
            const invRes = await apiFetch("/api/square/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update-inventory",
                    locationId: squareLocationId,
                    inventoryUpdates
                })
            });
            if (!invRes.ok) {
                const invData = await invRes.json();
                console.error("[Square Sync Client] Inventory update failed:", invData);
                // 在庫反映のみの失敗は警告として扱う
            } else {
                // 同期時刻の更新
                for (const p of productsWithId) {
                    await updateDoc(doc(db, "products", p.id), {
                        lastSquareSyncAt: serverTimestamp()
                    });
                }
            }
        }

        // 6. 同期ログの保存
        const logData = {
            type: 'Square',
            storeId: storeId,
            locationId: squareLocationId,
            timestamp: serverTimestamp(),
            status: 'success',
            productCount: productsWithId.length,
            orderCount: newOrdersCount,
            details: {
                syncedProducts: productsWithId.map(p => p.name),
                newOrderIds: processedOrderIds
            }
        };
        await setDoc(doc(collection(db, "sync_logs")), logData);

        const hasApril8th = orders.some((o: any) => o.createdAt.startsWith('2026-04-08'));
        const updateMessage = hasApril8th 
            ? `Square同期が完了しました。4月8日のデータ修正を含む ${newOrdersCount} 件の注文を同期・リフレッシュしました。`
            : `Square同期が完了しました。${productsWithId.length}件の在庫同期と${newOrdersCount}件の新規注文を処理しました。`;

        return {
            success: true,
            syncedProductsCount: productsWithId.length,
            newOrdersCount,
            message: updateMessage
        };


    } catch (error: any) {
        console.error("Square Sync Client Error:", error);
        return {
            success: false,
            syncedProductsCount: 0,
            newOrdersCount: 0,
            message: "Square同期中にエラーが発生しました。",
            detail: error.message
        };
    }
}

/**
 * Square関連の全てのデータをFirestoreから削除してクリーンアップします。
 */
export async function resetSquareData(): Promise<{ success: boolean; message: string }> {
    try {
        console.log("[Square Reset] Starting comprehensive cleanup...");
        
        // 1. Transactionのクリーンアップ
        const qTransactions = query(collection(db, "transactions"), where("squareOrderId", "!=", null));
        const snapTransactions = await getDocs(qTransactions);
        const transIds = snapTransactions.docs.map(d => d.id);
        
        for (const tDoc of snapTransactions.docs) {
            await deleteDoc(tDoc.ref);
        }
        console.log(`[Square Reset] Deleted ${snapTransactions.docs.length} transactions.`);

        // 2. Transaction Itemのクリーンアップ
        for (const tId of transIds) {
            const qItems = query(collection(db, "transaction_items"), where("transactionId", "==", tId));
            const snapItems = await getDocs(qItems);
            for (const iDoc of snapItems.docs) await deleteDoc(iDoc.ref);
        }

        // 3. Salesのクリーンアップ (square_ID または transactionId 紐付け)
        const qSales = collection(db, "sales");
        const snapSales = await getDocs(qSales);
        let deletedSalesCount = 0;
        for (const sDoc of snapSales.docs) {
            const data = sDoc.data();
            if (sDoc.id.startsWith("square_") || (data.transactionId && transIds.includes(data.transactionId))) {
                await deleteDoc(sDoc.ref);
                deletedSalesCount++;
            }
        }
        console.log(`[Square Reset] Deleted ${deletedSalesCount} sales records.`);

        // 4. Stock Movementのクリーンアップ
        for (const tId of transIds) {
            const qStock = query(collection(db, "stock_movements"), where("referenceId", "==", tId));
            const snapStock = await getDocs(qStock);
            for (const stDoc of snapStock.docs) await deleteDoc(stDoc.ref);
        }

        return { success: true, message: "Square関連の全データを削除しました。在庫整合性を保つため、同期時は「在庫増減なし」モードでの同期を推奨します。" };
    } catch (error: any) {
        console.error("Square Reset Error:", error);
        return { success: false, message: "リセット中にエラーが発生しました: " + error.message };
    }
}
