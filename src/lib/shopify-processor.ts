// src/lib/shopify-processor.ts

import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShopifyOrder } from "./shopify";

/**
 * Shopify の注文データを本システムの Firestore に反映します
 */
export async function processShopifyOrder(order: ShopifyOrder) {
    console.log(`[Shopify Processor] Processing order: ${order.shopifyOrderId}`);

    // 1. 販売店舗「Shopify」を取得
    const storesRef = collection(db, "retailStores");
    const storeQuery = query(storesRef, where("name", "==", "Shopify"), where("isTrashed", "==", false));
    const storeSnap = await getDocs(storeQuery);
    let shopifyStore: { id: string, name: string } | null = null;
    if (!storeSnap.empty) {
        shopifyStore = { id: storeSnap.docs[0].id, name: storeSnap.docs[0].data().name };
    }

    // 2. 重複チェック
    const existingQuery = query(collection(db, "transactions"), where("shopifyOrderId", "==", order.shopifyOrderId));
    const existingDocs = await getDocs(existingQuery);
    if (!existingDocs.empty) {
        console.log(`[Shopify Processor] Order ${order.shopifyOrderId} already exists. Skipping.`);
        return { success: false, reason: "duplicate" };
    }

    // 3. 取引(Transaction)登録
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const newRef = doc(collection(db, "transactions"));
    await setDoc(newRef, transactionData);

    // 4. 明細登録と在庫減算
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

        // 商品マスタ特定 (shopifyVariantId)
        const pQuery = query(collection(db, "products"), where("shopifyVariantId", "==", item.variantId));
        const pSnap = await getDocs(pQuery);

        if (!pSnap.empty) {
            const productId = pSnap.docs[0].id;
            const pData = pSnap.docs[0].data();

            // 在庫減算
            const currentStock = pData.stock || 0;
            await updateDoc(doc(db, "products", productId), {
                stock: currentStock - item.quantity,
                updatedAt: serverTimestamp()
            });

            // 在庫移動記録
            await setDoc(doc(collection(db, "stock_movements")), {
                productId: productId,
                productName: pData.name,
                type: 'out',
                quantity: item.quantity,
                reason: 'manual',
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

    // 5. 売上(Sales)登録
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

    return { success: true, transactionId: newRef.id, orderId: order.shopifyOrderId };
}
