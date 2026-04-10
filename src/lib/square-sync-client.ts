// src/lib/square-sync-client.ts

import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
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
export async function syncWithSquare(storeId: string): Promise<SyncResult> {
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
                const res = await fetch("/api/square/sync", {
                    method: "POST",
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
        const orderRes = await fetch("/api/square/sync", {
            method: "POST",
            body: JSON.stringify({ action: "fetch-orders", locationId: squareLocationId })
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderData.detail || orderData.error);

        squareLocationId = orderData.locationId;
        const orders = orderData.orders || [];

        // 4. Firestore への注文反映 (Firestore 書き込み - Client Auth)
        let newOrdersCount = 0;
        const processedOrderIds = [];
        for (const order of orders) {
            const result = await processSquareOrder(order);
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
            const invRes = await fetch("/api/square/sync", {
                method: "POST",
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

        return {
            success: true,
            syncedProductsCount: productsWithId.length,
            newOrdersCount,
            message: `Square同期が完了しました。${productsWithId.length}件の在庫同期と${newOrdersCount}件の新規注文を処理しました。`
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
