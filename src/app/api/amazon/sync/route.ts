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

        // 2. 注文情報の取得 (Mock)
        const orders = await getAmazonOrders();
        for (const order of orders) {
            // 既に登録済みかチェック（amazonOrderId で検索）
            const existingQuery = query(collection(db, "transactions"), where("amazonOrderId", "==", order.amazonOrderId));
            const existingDocs = await getDocs(existingQuery);

            if (existingDocs.empty) {
                // 新規取引として登録
                const transactionData = {
                    customerName: "Amazon Customer",
                    channel: "EC",
                    transactionType: "Amazon注文",
                    orderDate: order.purchaseDate.split('T')[0],
                    deliveryDate: "",
                    invoiceDate: "",
                    dueDate: "",
                    transactionStatus: "受注",
                    subtotal: order.totalAmount, // 簡易化のため
                    tax: 0,
                    totalAmount: order.totalAmount,
                    paidAmount: 0,
                    balanceAmount: order.totalAmount,
                    remarks: `Amazon Order ID: ${order.amazonOrderId}`,
                    amazonOrderId: order.amazonOrderId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };

                const newDocRef = doc(collection(db, "transactions"));
                await setDoc(newDocRef, transactionData);

                // 明細の登録
                for (const item of order.items) {
                    await setDoc(doc(collection(db, "transactionItems")), {
                        transactionId: newDocRef.id,
                        productName: `Amazon商品 (${item.sku})`,
                        quantity: item.quantity,
                        unitPrice: item.price,
                        amount: item.quantity * item.price,
                        taxRate: 10,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            syncedProducts: syncResults,
            newOrdersCount: orders.length,
            message: "Amazon同期が正常に完了しました。新しい取引が「取引管理」に追加されました。"
        });

    } catch (error: any) {
        console.error("Amazon Sync Error:", error);
        return NextResponse.json(
            { error: "Amazon同期中にエラーが発生しました。", detail: error.message },
            { status: 500 }
        );
    }
}
