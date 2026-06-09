// src/lib/shopify-processor.ts

import { adminDb, admin } from "@/lib/firebase-admin";
import { ShopifyOrder } from "./shopify";

/**
 * Shopify の注文データを本システムの Firestore に反映します
 */
export async function processShopifyOrder(order: ShopifyOrder) {
    console.log(`[Shopify Processor] Processing order: ${order.shopifyOrderId}`);

    if (!adminDb) {
        throw new Error("adminDb is not initialized");
    }
    const db = adminDb;

    // 1. 販売店舗「Shopify」を取得
    const storesRef = db.collection("retailStores");
    const storeSnap = await storesRef
        .where("name", "==", "Shopify")
        .where("isTrashed", "==", false)
        .get();

    let shopifyStore: { id: string, name: string } | null = null;
    if (!storeSnap.empty) {
        shopifyStore = { id: storeSnap.docs[0].id, name: storeSnap.docs[0].data().name };
    }

    // 2. 重複チェック
    const existingDocs = await db.collection("transactions")
        .where("shopifyOrderId", "==", order.shopifyOrderId)
        .get();

    if (!existingDocs.empty) {
        console.log(`[Shopify Processor] Order ${order.shopifyOrderId} already exists. Skipping.`);
        return { success: false, reason: "duplicate" };
    }

    const newTransactionRef = db.collection("transactions").doc();
    const transactionData = {
        customerName: shopifyStore ? shopifyStore.name : "Shopify Customer",
        storeId: shopifyStore?.id || null,
        storeName: shopifyStore?.name || null,
        channel: "EC",
        transactionType: "Shopify注文",
        orderDate: order.createdAt.split('T')[0],
        transactionStatus: "受注",
        subtotal: order.totalPrice,
        tax: 0,
        totalAmount: order.totalPrice,
        paidAmount: order.financialStatus === "paid" ? order.totalPrice : 0,
        balanceAmount: order.financialStatus === "paid" ? 0 : order.totalPrice,
        remarks: `Shopify Order ID: ${order.shopifyOrderId}`,
        shopifyOrderId: order.shopifyOrderId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 3. 必要な商品情報をトランザクションの前に取得しておく (トランザクション内でのクエリ読み取りを避けるため)
    const productUpdates: any[] = [];
    const saleItems: any[] = [];
    
    for (const item of order.lineItems) {
        if (!item.variantId) continue;
        const pSnap = await db.collection("products")
            .where("shopifyVariantId", "==", item.variantId)
            .get();

        if (!pSnap.empty) {
            const productDoc = pSnap.docs[0];
            const pData = productDoc.data();
            
            productUpdates.push({
                docRef: productDoc.ref,
                productId: productDoc.id,
                productName: pData.name,
                currentStock: pData.stock || 0,
                quantity: item.quantity
            });

            saleItems.push({
                productId: productDoc.id,
                quantity: item.quantity,
                priceAtSale: item.price,
                subtotal: item.quantity * item.price,
                commission: 0,
                netProfit: item.quantity * item.price
            });
        }
    }

    // 4. 取引(Transaction)登録、明細登録、在庫減算をアトミックに書き込み
    await db.runTransaction(async (txn: any) => {
        txn.set(newTransactionRef, transactionData);

        for (const item of order.lineItems) {
            const itemRef = db.collection("transaction_items").doc();
            txn.set(itemRef, {
                transactionId: newTransactionRef.id,
                productName: `Shopify商品 (${item.sku || item.variantId})`,
                quantity: item.quantity,
                unitPrice: item.price,
                amount: item.quantity * item.price,
                taxRate: 10,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        for (const update of productUpdates) {
            // 在庫減算
            txn.update(update.docRef, {
                stock: update.currentStock - update.quantity,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 在庫移動記録
            const movementRef = db.collection("stock_movements").doc();
            txn.set(movementRef, {
                productId: update.productId,
                productName: update.productName,
                type: 'out',
                quantity: update.quantity,
                reason: 'manual',
                remarks: 'Shopify注文による自動減算',
                referenceId: newTransactionRef.id,
                date: order.createdAt.split('T')[0],
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    });

    // 4. 売上(Sales)登録
    if (shopifyStore && saleItems.length > 0) {
        const saleData = {
            storeId: shopifyStore.id,
            type: 'daily',
            period: order.createdAt.split('T')[0],
            items: saleItems,
            totalAmount: order.totalPrice,
            isTrashed: false,
            transactionId: newTransactionRef.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection("sales").add(saleData);
    }

    return { success: true, transactionId: newTransactionRef.id, orderId: order.shopifyOrderId };
}
