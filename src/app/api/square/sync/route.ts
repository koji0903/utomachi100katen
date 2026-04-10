// src/app/api/square/sync/route.ts

import { NextResponse } from "next/server";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSquareOrders, updateSquareInventory, findSquareCatalogByJan } from "@/lib/square";
import { processSquareOrder } from "@/lib/square-processor";

export async function POST(req: Request) {
    try {
        console.log("[Square Sync] Starting synchronization process...");

        // 1. 同期が有効な商品を取得
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("squareSyncEnabled", "==", true), where("isTrashed", "==", false));
        const querySnapshot = await getDocs(q);

        const productsToSync = [];
        const inventoryUpdates = [];
        const shopifySyncResults = [];

        for (const productDoc of querySnapshot.docs) {
            const product = { id: productDoc.id, ...productDoc.data() } as any;
            
            // Square ID がない場合、JANコードで検索・紐付けを試みる
            if (!product.squareVariantId && product.janCode) {
                console.log(`[Square Sync] Searching Catalog for JAN: ${product.janCode}`);
                const catalogObj = await findSquareCatalogByJan(product.janCode);
                if (catalogObj) {
                    await updateDoc(doc(db, "products", product.id), {
                        squareVariantId: catalogObj.id,
                        updatedAt: serverTimestamp()
                    });
                    product.squareVariantId = catalogObj.id;
                    console.log(`[Square Sync] Linked product ${product.name} to Square ID: ${catalogObj.id}`);
                }
            }

            if (product.squareVariantId) {
                productsToSync.push(product);
                // 本システムの在庫を Square に反映するためのデータ作成
                inventoryUpdates.push({
                    catalogObjectId: product.squareVariantId,
                    quantity: product.stock || 0
                });
            }
        }

        // 2. 在庫の同期 (本システム -> Square)
        const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID;
        if (SQUARE_LOCATION_ID && inventoryUpdates.length > 0) {
            console.log(`[Square Sync] Pushing inventory for ${inventoryUpdates.length} items...`);
            await updateSquareInventory(SQUARE_LOCATION_ID, inventoryUpdates);
            
            // 同期時刻の更新
            for (const product of productsToSync) {
                await updateDoc(doc(db, "products", product.id), {
                    lastSquareSyncAt: serverTimestamp()
                });
            }
        }

        // 3. 注文情報の取得と売上登録 (Square -> 本システム)
        let newOrdersCount = 0;
        const processedOrders = [];
        
        if (SQUARE_LOCATION_ID) {
            // 直近 24 時間の注文を取得 (実際は前回の同期時刻からの差分が理想)
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const orders = await getSquareOrders(SQUARE_LOCATION_ID, yesterday);
            
            for (const order of orders) {
                const result = await processSquareOrder(order);
                if (result.success) {
                    newOrdersCount++;
                    processedOrders.push(result.orderId);
                }
            }
        }

        // 4. 同期ログの保存
        const logData = {
            type: 'Square',
            timestamp: serverTimestamp(),
            status: 'success',
            productCount: productsToSync.length,
            orderCount: newOrdersCount,
            details: {
                syncedProducts: productsToSync.map(p => p.name),
                newOrderIds: processedOrders
            }
        };
        await setDoc(doc(collection(db, "sync_logs")), logData);

        return NextResponse.json({
            success: true,
            syncedProductsCount: productsToSync.length,
            newOrdersCount: newOrdersCount,
            message: `Square同期が完了しました。${productsToSync.length}件の在庫同期と${newOrdersCount}件の新規注文を処理しました。`
        });

    } catch (error: any) {
        console.error("Square Sync Error:", error);
        return NextResponse.json(
            { error: "Square同期中にエラーが発生しました。", detail: error.message },
            { status: 500 }
        );
    }
}
