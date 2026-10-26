// src/lib/shopify-processor.ts

import { adminDb, FieldValue } from "@/lib/firebase-admin";
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
        .get();

    let shopifyStore: { id: string, name: string } | null = null;
    const activeStoreDoc = storeSnap.docs.find(candidate => candidate.data().isTrashed !== true);
    if (activeStoreDoc) {
        shopifyStore = { id: activeStoreDoc.id, name: activeStoreDoc.data().name };
    }

    // 2. 重複チェック（過去のランダムID分も含めて事前確認）
    const deterministicTxRef = db.collection("transactions").doc(`shopify_${order.shopifyOrderId}`);
    const existingDocs = await db.collection("transactions")
        .where("shopifyOrderId", "==", order.shopifyOrderId)
        .get();

    if (!existingDocs.empty) {
        console.log(`[Shopify Processor] Order ${order.shopifyOrderId} already exists. Skipping.`);
        return { success: false, reason: "duplicate" };
    }

    const orderDate = (() => {
        const d = order.createdAt ? new Date(order.createdAt) : new Date();
        const ts = Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
        return new Date(ts + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    })();

    const customerNameStr = order.customer
        ? `${order.customer.lastName} ${order.customer.firstName}`.trim() || order.customer.email
        : (shopifyStore ? shopifyStore.name : "Shopify Customer");

    // リピーター判定 (Shopify APIのread_customers権限がなくても機能するようFirestore内から件数をカウント)
    let ordersCount = 1;
    if (order.customer?.id) {
        const matchingTxSnap = await db.collection("transactions")
            .where("shopifyCustomerId", "==", order.customer.id)
            .get();
        ordersCount = matchingTxSnap.size + 1;
    } else if (order.customer?.email) {
        const matchingTxSnap = await db.collection("transactions")
            .where("customerEmail", "==", order.customer.email)
            .get();
        ordersCount = matchingTxSnap.size + 1;
    }

    const newTransactionRef = deterministicTxRef;
    const transactionData = {
        customerName: customerNameStr,
        customerEmail: order.customer?.email || null,
        shopifyCustomerId: order.customer?.id || null,
        isRepeatCustomer: ordersCount > 1,
        shopifyOrdersCount: ordersCount,
        storeId: shopifyStore?.id || null,
        storeName: shopifyStore?.name || null,
        recipientType: "store",
        channel: "EC",
        transactionType: "Shopify注文",
        orderDate: orderDate,
        transactionStatus: "受注",
        subtotal: order.totalPrice,
        tax: 0,
        totalAmount: order.totalPrice,
        paidAmount: order.financialStatus === "paid" ? order.totalPrice : 0,
        balanceAmount: order.financialStatus === "paid" ? 0 : order.totalPrice,
        remarks: `Shopify Order ID: ${order.shopifyOrderId}`,
        shopifyOrderId: order.shopifyOrderId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };

    // 3. 必要な商品情報をトランザクションの前に取得し、同一商品の数量を集約する
    const productUpdatesMap = new Map<string, {
        docRef: FirebaseFirestore.DocumentReference;
        productId: string;
        productName: string;
        quantity: number;
    }>();
    const saleItems: any[] = [];
    
    for (const item of order.lineItems) {
        if (!item.variantId) continue;
        
        // 1. shopifyVariantIds の配列に含まれるか検索
        let pSnap = await db.collection("products")
            .where("shopifyVariantIds", "array-contains", item.variantId)
            .get();

        let productDoc = pSnap.docs.find(candidate => candidate.data().isTrashed !== true);

        // 2. 有効な商品が見つからなければ、後方互換性のため従来の shopifyVariantId (等価) で検索
        if (!productDoc) {
            pSnap = await db.collection("products")
                .where("shopifyVariantId", "==", item.variantId)
                .get();
            productDoc = pSnap.docs.find(candidate => candidate.data().isTrashed !== true);
        }

        if (productDoc) {
            const pData = productDoc.data();
            const existing = productUpdatesMap.get(productDoc.id);
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                productUpdatesMap.set(productDoc.id, {
                    docRef: productDoc.ref,
                    productId: productDoc.id,
                    productName: pData.name,
                    quantity: item.quantity
                });
            }

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

    // 4. 取引(Transaction)登録、明細登録、在庫減算、売上(Sales)登録をアトミックに書き込み
    const isDuplicateInTx = await db.runTransaction(async (txn: any) => {
        const existingTxDoc = await txn.get(newTransactionRef);
        if (existingTxDoc.exists) {
            return true;
        }

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
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }

        for (const update of productUpdatesMap.values()) {
            // アトミックな在庫減算
            txn.update(update.docRef, {
                stock: FieldValue.increment(-update.quantity),
                updatedAt: FieldValue.serverTimestamp()
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
                date: orderDate,
                createdAt: FieldValue.serverTimestamp()
            });
        }

        if (shopifyStore && saleItems.length > 0) {
            const saleRef = db.collection("sales").doc(`shopify_${order.shopifyOrderId}`);
            const saleData = {
                storeId: shopifyStore.id,
                storeName: shopifyStore.name,
                recipientType: 'store',
                type: 'daily',
                period: orderDate,
                items: saleItems,
                totalQuantity: saleItems.reduce((sum, item) => sum + item.quantity, 0),
                totalAmount: order.totalPrice,
                totalCommission: 0,
                totalNetProfit: order.totalPrice,
                inventoryEffects: [...productUpdatesMap.values()].map(update => ({
                    scope: 'main',
                    productId: update.productId,
                    quantity: -update.quantity,
                })),
                isTrashed: false,
                transactionId: newTransactionRef.id,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };
            txn.set(saleRef, saleData);
        }

        return false;
    });

    if (isDuplicateInTx) {
        console.log(`[Shopify Processor] Order ${order.shopifyOrderId} already exists in transaction. Skipping.`);
        return { success: false, reason: "duplicate" };
    }

    return { success: true, transactionId: newTransactionRef.id, orderId: order.shopifyOrderId };
}
