// src/lib/square-processor.ts

import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SquareOrder } from "./square";

/**
 * Square の金額（最小単位）をシステム用の金額に変換します
 * JPYなどの0小数点通貨はそのまま、USDなどは1/100にします
 */
const formatSquareMoney = (money: { amount: number, currency: string }) => {
    if (!money) return 0;
    const currency = (money.currency || '').toUpperCase();
    if (currency === 'JPY') return money.amount;
    return money.amount / 100;
};



/**
 * Square の注文データを本システムの Firestore に反映します
 */
export async function processSquareOrder(order: SquareOrder, options?: { skipInventory?: boolean, targetStore?: { id: string, name: string } }) {
    const skipInventory = options?.skipInventory ?? false;
    const targetStore = options?.targetStore;
    console.log(`[Square Processor] Processing order: ${order.id}${skipInventory ? ' (In SkipInventory Mode)' : ''}`);



    let retailStore: { id: string, name: string } | null = null;

    if (targetStore) {
        retailStore = targetStore;
    } else if (order.locationId) {
        // 1. 直営店（販売店舗）を Square Location ID から特定
        const storesRef = collection(db, "retailStores");
        const storeQuery = query(storesRef, where("squareLocationId", "==", order.locationId), where("isTrashed", "==", false));
        const storeSnap = await getDocs(storeQuery);

        
        if (!storeSnap.empty) {
            retailStore = { id: storeSnap.docs[0].id, name: storeSnap.docs[0].data().name };
        } else {
            console.error(`[Square Processor] No store found for Location ID: ${order.locationId} | Order: ${order.id}`);
            
            // 【診断ログ】登録されている全ての Location ID を出力（原因特定しやすくするため）
            const allStoresSnap = await getDocs(collection(db, "retailStores"));
            const registeredIds = allStoresSnap.docs.map(d => `${d.data().name}: ${d.data().squareLocationId}`).filter(id => id.includes('undefined') === false);
            console.log(`[Square Processor] Registered Location IDs in custom DB:`, registeredIds);
            
            // もし店舗が見つからない場合は「Square直営店」という名前の店舗を探すなどのフォールバックを検討
        }
    }



    let isUpdate = false;
    let transRef;

    const orderDate = order.createdAt.split('T')[0];

    // --- 【超強力クリーンアップ】重複やゴミデータの徹底排除 ---
    const cleanupExistingRecords = async () => {
        if (!order.id) return;

        // 1. Transactionのクリーンアップ
        const qTransactions = query(collection(db, "transactions"), where("squareOrderId", "==", order.id));
        const snapTransactions = await getDocs(qTransactions);

        for (const tDoc of snapTransactions.docs) {
            const tId = tDoc.id;
            isUpdate = true;
            transRef = tDoc.ref;
            
            // 明細の削除
            if (tId) {
                const qItems = query(collection(db, "transaction_items"), where("transactionId", "==", tId));
                const snapItems = await getDocs(qItems);
                for (const iDoc of snapItems.docs) await deleteDoc(iDoc.ref);
            }

            
            // 紐づく売上データの削除 (transactionId ベース)
            if (tId) {
                const qSalesByTrans = query(collection(db, "sales"), where("transactionId", "==", tId));
                const snapSales = await getDocs(qSalesByTrans);
                for (const sDoc of snapSales.docs) await deleteDoc(sDoc.ref);
            }
        }

        // 2. 日付と店舗が一致する古い売上データの削除 (念のための掃き出し)
        if (retailStore) {
            const qSalesByDate = query(
                collection(db, "sales"), 
                where("period", "==", orderDate), 
                where("storeId", "==", retailStore.id),
                where("isTrashed", "==", false)
            );
            const snapSalesByDate = await getDocs(qSalesByDate);
            for (const sDoc of snapSalesByDate.docs) {
                const sData = sDoc.data();
                // Square由来である可能性が高いもの（transactionIdがある、または特定のIDパターン）を削除
                if (sData.transactionId || sDoc.id.startsWith("square_") || sData.remarks?.includes("Square")) {
                    await deleteDoc(sDoc.ref);
                }
            }
        }
    };

    await cleanupExistingRecords();

    if (!transRef) {
        transRef = doc(collection(db, "transactions"));
    }



    let orderTotalRaw = formatSquareMoney(order.totalMoney);
    const totalOrderDiscount = formatSquareMoney(order.totalDiscountMoney || { amount: 0, currency: "JPY" });
    const netTotalFromSquare = order.netAmounts ? formatSquareMoney(order.netAmounts.total_money) : null;
    
    // 各明細の合計額（割引・税反映後）の合計を算出
    const itemsGrossSum = order.lineItems.reduce((sum, item) => sum + formatSquareMoney(item.totalMoney), 0);

    // 【重要】実質的な合計金額の決定
    // 1. Square APIの net_amounts があればそれを最優先
    // 2. ない場合は (gross - discount) で算出
    let effectiveOrderTotal = netTotalFromSquare ?? orderTotalRaw;

    if (netTotalFromSquare === null && orderTotalRaw === itemsGrossSum && totalOrderDiscount > 0) {
        effectiveOrderTotal = orderTotalRaw - totalOrderDiscount;
    }

    // デバッグログ
    console.log(`[Square Processor] Order ${order.id} | raw: ${orderTotalRaw} | netApi: ${netTotalFromSquare} | discount: ${totalOrderDiscount} | final: ${effectiveOrderTotal}`);

    // 案分比率
    const discountRatio = itemsGrossSum > 0 ? (effectiveOrderTotal / itemsGrossSum) : 1;



    // 3. 取引(Transaction)登録
    const transactionData = {
        customerName: retailStore ? retailStore.name : "Square Customer",
        storeId: retailStore?.id || null,
        storeName: retailStore?.name || null,
        channel: "店頭販売",
        transactionType: "Square注文",
        orderDate: order.createdAt.split('T')[0],
        transactionStatus: "完了",
        subtotal: effectiveOrderTotal,
        tax: 0,
        totalAmount: effectiveOrderTotal,
        paidAmount: effectiveOrderTotal,
        balanceAmount: 0,

        remarks: `Square Order ID: ${order.id}`,
        squareOrderId: order.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const transData = {
        ...transactionData,
        updatedAt: serverTimestamp(),
    };
    // createdAt は新規作成時のみセット
    if (!isUpdate) {
        (transData as any).createdAt = serverTimestamp();
    }

    await setDoc(transRef, transData, { merge: true });


    // 4. 明細登録と商品マスタ紐付け・在庫減算
    const saleItems = [];
    const productsRef = collection(db, "products");

    for (const item of order.lineItems) {
        const itemAmountUndiscounted = formatSquareMoney(item.totalMoney);
        // 按分比率を適用して実質的な金額を算出
        const itemAmount = Math.round(itemAmountUndiscounted * discountRatio);
        const qty = parseFloat(item.quantity);
        const unitPrice = itemAmount / qty;

        console.log(`[Square Processor]   Item: ${item.name} | qty: ${qty} | origTotal: ${itemAmountUndiscounted} | effectiveAmount: ${itemAmount} | unitPrice: ${unitPrice}`);



        await setDoc(doc(collection(db, "transaction_items")), {
            transactionId: transRef.id,
            productName: `${item.name}${item.variationName ? ` (${item.variationName})` : ''}`,
            quantity: qty,
            unitPrice: unitPrice,
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
            } else {
                console.warn(`[Square Processor] Product not found for Catalog ID: ${item.catalogObjectId} (${item.name}). Trying name match...`);
            }
        }


        // --- フォールバック: 名前での検索 ---
        if (!productId && item.name) {
            const pQueryByName = query(productsRef, where("name", "==", item.name), where("isTrashed", "==", false));
            const pSnapByName = await getDocs(pQueryByName);
            if (!pSnapByName.empty) {

                productId = pSnapByName.docs[0].id;
                const pData = pSnapByName.docs[0].data();
                productName = pData.name;
                currentStock = pData.stock || 0;
                console.log(`[Square Processor]   -> Found by Name match: ${productName}`);
            }
        }

        // --- 最終手段: 未連携 (SQUARE_UNLINKED) として扱う ---
        if (!productId) {
            console.warn(`[Square Processor]   -> NO MATCH for ${item.name}. Mapping to SQUARE_UNLINKED.`);
            productId = "SQUARE_UNLINKED";
            productName = `[未連携] ${item.name}`;
            currentStock = 0;
        }



        if (productId) {
            const qty = parseFloat(item.quantity);
            
            // 在庫への影響は新規作成時かつ在庫スキップモードでない場合のみ
            if (!isUpdate && !skipInventory) {
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
            }

            saleItems.push({
                productId,
                quantity: qty,
                priceAtSale: unitPrice,
                subtotal: itemAmount,
                commission: 0,
                netProfit: itemAmount,
                productName: productName || item.name,
                catalogObjectId: item.catalogObjectId
            });

            console.log(`[SQUARE_LINK_DIAG] Order:${order.id} | Item:${item.name} | CatalogID:${item.catalogObjectId || 'N/A'} -> MapTo:${productId}`);
        }


    }

    // 5. 売上(Sales)登録
    // 注意: saleItems が 0 件でも、金額(effectiveOrderTotal)が 0 でなければ売上を記録する
    if (retailStore && (saleItems.length > 0 || effectiveOrderTotal !== 0)) {
        const totalQuantity = saleItems.reduce((sum, i) => sum + i.quantity, 0);
        const saleId = `square_${order.id}`;
        
        const saleData = {
            id: saleId,
            storeId: retailStore.id,
            storeName: retailStore.name,
            recipientType: 'store',
            type: 'daily',
            period: order.createdAt.split('T')[0],
            items: saleItems,
            totalQuantity: totalQuantity,
            totalAmount: effectiveOrderTotal,
            totalCommission: 0,
            totalNetProfit: effectiveOrderTotal,
            isTrashed: false,
            transactionId: transRef.id,
            remarks: "Square連携売上",
            updatedAt: serverTimestamp(),
        };



        // 新規作成時のみ createdAt を設定
        if (!isUpdate) {
            (saleData as any).createdAt = serverTimestamp();
        }

        // 確定的ID（square_ORDER_ID）を使用して確実に上書き更新する
        await setDoc(doc(db, "sales", saleId), saleData, { merge: true });
        console.log(`[Square Processor] Sales record updated for order ${order.id}. Correct Amount: ¥${effectiveOrderTotal}`);

        const unlinkedCount = saleItems.filter(i => i.productId === 'SQUARE_UNLINKED').length;
        if (unlinkedCount > 0) {
            console.log(`[Square Processor]   Warning: ${unlinkedCount} items were unlinked and tracked as SQUARE_UNLINKED to preserve revenue.`);
        }
    } else {
        if (!retailStore) console.error(`[Square Processor] FAILED to save Sale record because no retailStore was found for ${order.locationId}`);
        if (saleItems.length === 0 && effectiveOrderTotal === 0) console.error(`[Square Processor] FAILED to save Sale record because no saleItems or revenue found for order ${order.id}`);
    }




    return { success: true, transactionId: transRef.id, orderId: order.id };
}
