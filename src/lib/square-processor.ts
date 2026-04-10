// src/lib/square-processor.ts

import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SquareOrder } from "./square";

/**
 * Square の注文データを本システムの Firestore に反映します
 */
export async function processSquareOrder(order: SquareOrder) {
    console.log(`[Square Processor] Processing order: ${order.id}`);

    // 1. 直営店（販売店舗）を Square Location ID から特定
    const storesRef = collection(db, "retailStores");
    const storeQuery = query(storesRef, where("squareLocationId", "==", order.locationId), where("isTrashed", "==", false));
    const storeSnap = await getDocs(storeQuery);
    
    let retailStore: { id: string, name: string } | null = null;
    if (!storeSnap.empty) {
        retailStore = { id: storeSnap.docs[0].id, name: storeSnap.docs[0].data().name };
    } else {
        console.warn(`[Square Processor] No store found for Location ID: ${order.locationId}`);
        // もし店舗が見つからない場合は「Square直営店」という名前の店舗を探すなどのフォールバックを検討
    }

    // 2. 重複チェック
    const existingQuery = query(collection(db, "transactions"), where("squareOrderId", "==", order.id));
    const existingDocs = await getDocs(existingQuery);
    if (!existingDocs.empty) {
        console.log(`[Square Processor] Order ${order.id} already exists. Skipping.`);
        return { success: false, reason: "duplicate" };
    }

    const orderTotal = (order.totalMoney.amount / 100); // Square は最小通貨単位（セント、円など。日本円の場合はそのままのケースも多いが要確認）

    // 3. 取引(Transaction)登録
    const transactionData = {
        customerName: retailStore ? retailStore.name : "Square Customer",
        storeId: retailStore?.id || null,
        storeName: retailStore?.name || null,
        channel: "店頭販売",
        transactionType: "Square注文",
        orderDate: order.createdAt.split('T')[0],
        transactionStatus: "完了",
        subtotal: orderTotal,
        tax: 0,
        totalAmount: orderTotal,
        paidAmount: orderTotal,
        balanceAmount: 0,
        remarks: `Square Order ID: ${order.id}`,
        squareOrderId: order.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const transRef = doc(collection(db, "transactions"));
    await setDoc(transRef, transactionData);

    // 4. 明細登録と商品マスタ紐付け・在庫減算
    const saleItems = [];
    const productsRef = collection(db, "products");

    for (const item of order.lineItems) {
        const itemAmount = (item.basePriceMoney.amount / 100) * parseFloat(item.quantity);

        await setDoc(doc(collection(db, "transactionItems")), {
            transactionId: transRef.id,
            productName: `${item.name}${item.variationName ? ` (${item.variationName})` : ''}`,
            quantity: parseFloat(item.quantity),
            unitPrice: (item.basePriceMoney.amount / 100),
            amount: itemAmount,
            taxRate: 10,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // 商品の特定 (Square Catalog Object ID または名寄せ/SKUは今回は注文データからはSKUが取れないことが多いためCatalog IDで紐付ける)
        // ※ Square Orders API の line_items には SKU が直接含まれないことが多いため、Catalog API で引く必要がある場合があります
        // 今回は squareVariantId での紐付けを優先します
        let productId: string | null = null;
        let productName: string | null = null;
        let currentStock = 0;

        if (item.catalogObjectId) {
            const pQuery = query(productsRef, where("squareVariantId", "==", item.catalogObjectId));
            const pSnap = await getDocs(pQuery);

            if (!pSnap.empty) {
                productId = pSnap.docs[0].id;
                const pData = pSnap.docs[0].data();
                productName = pData.name;
                currentStock = pData.stock || 0;
            }
        }

        if (productId) {
            const qty = parseFloat(item.quantity);
            // 在庫減算
            await updateDoc(doc(db, "products", productId), {
                stock: currentStock - qty,
                updatedAt: serverTimestamp()
            });

            // 在庫移動記録
            await setDoc(doc(collection(db, "stock_movements")), {
                productId: productId,
                productName: productName,
                type: 'out',
                quantity: qty,
                reason: 'sale',
                remarks: 'Square注文による自動減算',
                referenceId: transRef.id,
                date: order.createdAt.split('T')[0],
                createdAt: serverTimestamp()
            });

            saleItems.push({
                productId,
                quantity: qty,
                priceAtSale: (item.basePriceMoney.amount / 100),
                subtotal: itemAmount,
                commission: 0,
                netProfit: itemAmount
            });
        }
    }

    // 5. 売上(Sales)登録
    if (retailStore && saleItems.length > 0) {
        const saleData = {
            storeId: retailStore.id,
            type: 'daily',
            period: order.createdAt.split('T')[0],
            items: saleItems,
            totalAmount: orderTotal,
            isTrashed: false,
            transactionId: transRef.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        await setDoc(doc(collection(db, "sales")), saleData);
    }

    return { success: true, transactionId: transRef.id, orderId: order.id };
}
