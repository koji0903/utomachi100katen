// src/app/api/shopify/sync/route.ts

import { NextResponse } from "next/server";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getShopifyProduct, getShopifyOrders, updateShopifyInventory } from "@/lib/shopify";

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

        // 1.5. 販売店舗の中から「Shopify」という名前の店舗を探す（Amazonと同様）
        const storesRef = collection(db, "retailStores");
        const storeQuery = query(storesRef, where("name", "==", "Shopify"), where("isTrashed", "==", false));
        const storeSnap = await getDocs(storeQuery);
        let shopifyStore: { id: string, name: string } | null = null;
        if (!storeSnap.empty) {
            shopifyStore = { id: storeSnap.docs[0].id, name: storeSnap.docs[0].data().name };
            console.log(`[Shopify Sync] Found linked store: ${shopifyStore.name} (${shopifyStore.id})`);
        }

        // 2. 注文情報（最新）の取得
        const orders = await getShopifyOrders();
        let newOrdersCount = 0;

        for (const order of orders) {
            // 既に登録済みかチェック（shopifyOrderId で検索）
            const existingQuery = query(collection(db, "transactions"), where("shopifyOrderId", "==", order.shopifyOrderId));
            const existingDocs = await getDocs(existingQuery);

            if (existingDocs.empty) {
                newOrdersCount++;
                // 新規取引として登録
                const transactionData = {
                    customerName: shopifyStore ? shopifyStore.name : "Shopify Customer",
                    storeId: shopifyStore?.id || null,
                    storeName: shopifyStore?.name || null,
                    channel: "EC",
                    transactionType: "Shopify注文",
                    orderDate: order.createdAt.split('T')[0],
                    deliveryDate: "",
                    invoiceDate: "",
                    dueDate: "",
                    transactionStatus: "受注",
                    subtotal: order.totalPrice,
                    tax: 0,
                    totalAmount: order.totalPrice,
                    paidAmount: 0,
                    balanceAmount: order.totalPrice,
                    remarks: `Shopify Order ID: ${order.shopifyOrderId}`,
                    shopifyOrderId: order.shopifyOrderId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };

                const newRef = doc(collection(db, "transactions"));
                await setDoc(newRef, transactionData);

                // 明細の登録と在庫減算
                const saleItems = [];
                for (const item of order.lineItems) {
                    await setDoc(doc(collection(db, "transactionItems")), {
                        transactionId: newRef.id,
                        productName: `Shopify商品 (${item.sku || item.variantId})`,
                        quantity: item.quantity,
                        unitPrice: item.price,
                        amount: item.quantity * item.price,
                        taxRate: 10,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });

                    // 商品マスタから特定（shopifyVariantId）
                    const pQuery = query(collection(db, "products"), where("shopifyVariantId", "==", item.variantId));
                    const pSnap = await getDocs(pQuery);

                    if (!pSnap.empty) {
                        const productId = pSnap.docs[0].id;
                        const pData = pSnap.docs[0].data();

                        // 在庫の減算
                        const currentStock = pData.stock || 0;
                        await updateDoc(doc(db, "products", productId), {
                            stock: currentStock - item.quantity,
                            updatedAt: serverTimestamp()
                        });

                        // 在庫移動の記録
                        await setDoc(doc(collection(db, "stock_movements")), {
                            productId: productId,
                            productName: pData.name,
                            type: 'out',
                            quantity: item.quantity,
                            reason: 'manual', // 店頭・EC共通
                            remarks: 'Shopify注文による自動減算',
                            referenceId: newRef.id,
                            date: order.createdAt.split('T')[0],
                            createdAt: serverTimestamp()
                        });

                        saleItems.push({
                            productId,
                            quantity: item.quantity,
                            priceAtSale: item.price,
                            subtotal: item.quantity * item.price,
                            commission: 0,
                            netProfit: item.quantity * item.price
                        });
                    }
                }

                // 売上レコードとして登録
                if (shopifyStore && saleItems.length > 0) {
                    const saleData = {
                        storeId: shopifyStore.id,
                        type: 'daily',
                        period: order.createdAt.split('T')[0],
                        items: saleItems,
                        totalAmount: order.totalPrice,
                        isTrashed: false,
                        transactionId: newRef.id,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    };
                    await setDoc(doc(collection(db, "sales")), saleData);
                }
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
