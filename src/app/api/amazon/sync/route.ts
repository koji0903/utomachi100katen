// src/app/api/amazon/sync/route.ts

import { NextResponse } from "next/server";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAmazonProduct, getAmazonOrders } from "@/lib/amazon";

export async function POST(req: Request) {
    try {
        console.log("[Amazon Sync] Starting synchronization process...");

        // 1. 同期が有効な商品を取得
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("amazonSyncEnabled", "==", true));
        const querySnapshot = await getDocs(q);

        const syncResults = [];

        for (const productDoc of querySnapshot.docs) {
            const product = productDoc.data();
            if (product.amazonAsin) {
                // Amazon から最新情報を取得 (Mock)
                const amazonData = await getAmazonProduct(product.amazonAsin);

                if (amazonData) {
                    // ここでは例として同期時刻のみ更新。
                    // 実際は在庫数の調整などを行うロジックが入ります。
                    await updateDoc(doc(db, "products", productDoc.id), {
                        lastAmazonSyncAt: serverTimestamp(),
                        // amazonStock: amazonData.inventoryLevel, // 必要に応じて追加
                    });

                    syncResults.push({
                        id: productDoc.id,
                        name: product.name,
                        asin: product.amazonAsin,
                        status: "Synced"
                    });
                }
            }
        }

        // 1.5. 販売店舗・事業者の中から「Amazon」という名前の店舗を探す
        const storesRef = collection(db, "retailStores");
        const storeQuery = query(storesRef, where("name", "==", "Amazon"), where("isTrashed", "==", false));
        const storeSnap = await getDocs(storeQuery);
        let amazonStore: { id: string, name: string } | null = null;
        if (!storeSnap.empty) {
            amazonStore = { id: storeSnap.docs[0].id, name: storeSnap.docs[0].data().name };
            console.log(`[Amazon Sync] Found linked store: ${amazonStore.name} (${amazonStore.id})`);
        }

        // 2. 注文情報の取得 (Mock)
        const orders = await getAmazonOrders();
        let newOrdersCount = 0;

        for (const order of orders) {
            // 既に登録済みかチェック（amazonOrderId で検索）
            const existingQuery = query(collection(db, "transactions"), where("amazonOrderId", "==", order.amazonOrderId));
            const existingDocs = await getDocs(existingQuery);

            if (existingDocs.empty) {
                newOrdersCount++;
                // 新規取引として登録
                const transactionData = {
                    customerName: amazonStore ? amazonStore.name : "Amazon Customer",
                    storeId: amazonStore?.id || null,
                    storeName: amazonStore?.name || null,
                    channel: "EC",
                    transactionType: "Amazon注文",
                    orderDate: order.purchaseDate.split('T')[0],
                    deliveryDate: "",
                    invoiceDate: "",
                    dueDate: "",
                    transactionStatus: "受注",
                    subtotal: order.totalAmount,
                    tax: 0,
                    totalAmount: order.totalAmount,
                    paidAmount: 0,
                    balanceAmount: order.totalAmount,
                    remarks: `Amazon Order ID: ${order.amazonOrderId}`,
                    amazonOrderId: order.amazonOrderId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };

                const newRef = doc(collection(db, "transactions"));
                await setDoc(newRef, transactionData);

                // 明細の登録と売上レコードの作成準備
                const saleItems = [];
                for (const item of order.items) {
                    await setDoc(doc(collection(db, "transactionItems")), {
                        transactionId: newRef.id,
                        productName: `Amazon商品 (${item.sku})`,
                        quantity: item.quantity,
                        unitPrice: item.price,
                        amount: item.quantity * item.price,
                        taxRate: 10,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });

                    // 商品マスタから商品を特定（SKU または ASIN）
                    const pQuery = query(collection(db, "products"), where("amazonSku", "==", item.sku));
                    const pSnap = await getDocs(pQuery);

                    let productId = null;
                    if (!pSnap.empty) {
                        productId = pSnap.docs[0].id;
                        const pData = pSnap.docs[0].data();

                        // 在庫の減算
                        const currentStock = pData.stock || 0;
                        await updateDoc(doc(db, "products", productId), {
                            stock: currentStock - item.quantity,
                            updatedAt: serverTimestamp()
                        });

                        saleItems.push({
                            productId,
                            quantity: item.quantity,
                            priceAtSale: item.price,
                            subtotal: item.quantity * item.price,
                            commission: 0, // Amazon手数料ロジックが必要ならここに追加
                            netProfit: item.quantity * item.price
                        });
                    }
                }

                // 売上レコードとして登録（ダッシュボード等に反映させるため）
                if (amazonStore && saleItems.length > 0) {
                    const saleData = {
                        storeId: amazonStore.id,
                        type: 'daily',
                        period: order.purchaseDate.split('T')[0],
                        items: saleItems,
                        totalAmount: order.totalAmount,
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
            message: `Amazon同期が完了しました。${newOrdersCount}件の新規注文を登録し、売上に反映しました。`
        });

    } catch (error: any) {
        console.error("Amazon Sync Error:", error);
        return NextResponse.json(
            { error: "Amazon同期中にエラーが発生しました。", detail: error.message },
            { status: 500 }
        );
    }
}
