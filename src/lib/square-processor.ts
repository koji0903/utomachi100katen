// src/lib/square-processor.ts

import { collection, getDocs, getDoc, query, where, doc, serverTimestamp, increment, runTransaction } from "firebase/firestore";
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
        const storeQuery = query(storesRef, where("squareLocationId", "==", order.locationId));
        const storeSnap = await getDocs(storeQuery);

        const activeStoreDoc = storeSnap.docs.find(candidate => candidate.data().isTrashed !== true);
        if (activeStoreDoc) {
            retailStore = { id: activeStoreDoc.id, name: activeStoreDoc.data().name };
        } else {
            console.error(`[Square Processor] No store found for Location ID: ${order.locationId} | Order: ${order.id}`);

            // 【診断ログ】登録されている全ての Location ID を出力（原因特定しやすくするため）
            const allStoresSnap = await getDocs(collection(db, "retailStores"));
            const registeredIds = allStoresSnap.docs.map(d => `${d.data().name}: ${d.data().squareLocationId}`).filter(id => id.includes('undefined') === false);
            console.log(`[Square Processor] Registered Location IDs in custom DB:`, registeredIds);
        }
    }

    const orderDate = (() => {
        const d = order.createdAt ? new Date(order.createdAt) : new Date();
        const ts = Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
        return new Date(ts + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    })();

    // 既存 Transaction の参照を特定（後方互換のため旧ランダムIDも検索、無ければ決定論的ID）
    const existingTxSnap = await getDocs(query(collection(db, "transactions"), where("squareOrderId", "==", order.id)));
    const transRef = !existingTxSnap.empty
        ? existingTxSnap.docs[0].ref
        : doc(db, "transactions", `square_${order.id}`);

    const orderTotalRaw = formatSquareMoney(order.totalMoney);
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

    console.log(`[Square Processor] Order ${order.id} | raw: ${orderTotalRaw} | netApi: ${netTotalFromSquare} | discount: ${totalOrderDiscount} | final: ${effectiveOrderTotal}`);

    // 案分比率
    const discountRatio = itemsGrossSum > 0 ? (effectiveOrderTotal / itemsGrossSum) : 1;

    // 2. 明細準備と商品マスタ紐付け・BOM展開（トランザクション前に読み取り完了）
    const saleItems: Array<{
        productId: string;
        quantity: number;
        priceAtSale: number;
        subtotal: number;
        commission: number;
        netProfit: number;
        productName: string;
        catalogObjectId?: string;
    }> = [];
    const transactionItemPayloads: Array<{
        id: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        amount: number;
        taxRate: number;
    }> = [];
    const desiredEffectsMap = new Map<string, { productName: string; quantity: number }>();
    const productsRef = collection(db, "products");

    for (let idx = 0; idx < order.lineItems.length; idx++) {
        const item = order.lineItems[idx];
        const itemAmountUndiscounted = formatSquareMoney(item.totalMoney);
        // 按分比率を適用して実質的な金額を算出
        const itemAmount = Math.round(itemAmountUndiscounted * discountRatio);
        const qty = parseFloat(item.quantity) || 0;
        const unitPrice = qty > 0 ? itemAmount / qty : 0;

        console.log(`[Square Processor]   Item: ${item.name} | qty: ${qty} | origTotal: ${itemAmountUndiscounted} | effectiveAmount: ${itemAmount} | unitPrice: ${unitPrice}`);

        transactionItemPayloads.push({
            id: `square_${order.id}_${idx}`,
            productName: `${item.name}${item.variationName ? ` (${item.variationName})` : ''}`,
            quantity: qty,
            unitPrice: unitPrice,
            amount: itemAmount,
            taxRate: 10,
        });

        let productId: string | null = null;
        let productName: string | null = null;
        let productData: any = null;

        if (item.catalogObjectId) {
            const pQuery = query(productsRef, where("squareVariantId", "==", item.catalogObjectId));
            const pSnap = await getDocs(pQuery);
            const activeProductDoc = pSnap.docs.find(candidate => candidate.data().isTrashed !== true);
            if (activeProductDoc) {
                productId = activeProductDoc.id;
                productData = activeProductDoc.data();
                productName = productData.name;
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
                productData = pSnapByName.docs[0].data();
                productName = productData.name;
                console.log(`[Square Processor]   -> Found by Name match: ${productName}`);
            }
        }

        // --- 最終手段: 未連携 (SQUARE_UNLINKED) として扱う ---
        if (!productId) {
            console.warn(`[Square Processor]   -> NO MATCH for ${item.name}. Mapping to SQUARE_UNLINKED.`);
            productId = "SQUARE_UNLINKED";
            productName = `[未連携] ${item.name}`;
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

        // 在庫影響の集計（セット商品の場合は構成商品BOMに展開）
        if (productId !== "SQUARE_UNLINKED" && qty > 0) {
            const isComposite = productData?.isComposite === true && Array.isArray(productData.components) && productData.components.length > 0;
            if (isComposite) {
                for (const comp of productData.components) {
                    const compProductId = typeof comp?.productId === "string" ? comp.productId : "";
                    const compQty = Number(comp?.quantity) || 0;
                    if (!compProductId || compQty <= 0) continue;

                    const compSnap = await getDoc(doc(db, "products", compProductId));
                    if (!compSnap.exists() || compSnap.data()?.isTrashed === true) {
                        console.warn(`[Square Processor] Component product ${compProductId} for composite ${productId} not found or trashed. Skipping.`);
                        continue;
                    }
                    const compName = String(compSnap.data()?.name || productName || "不明な商品");
                    const deductQty = compQty * qty;
                    const existing = desiredEffectsMap.get(compProductId);
                    desiredEffectsMap.set(compProductId, {
                        productName: compName,
                        quantity: (existing ? existing.quantity : 0) - deductQty,
                    });
                }
            } else {
                const existing = desiredEffectsMap.get(productId);
                desiredEffectsMap.set(productId, {
                    productName: productName || item.name,
                    quantity: (existing ? existing.quantity : 0) - qty,
                });
            }
        }
    }

    const desiredInventoryEffects = [...desiredEffectsMap.entries()].map(([productId, entry]) => ({
        scope: 'main' as const,
        productId,
        quantity: entry.quantity,
    }));

    const saleId = `square_${order.id}`;
    const saleRef = doc(db, "sales", saleId);
    const shouldSaveSale = Boolean(retailStore && (saleItems.length > 0 || effectiveOrderTotal !== 0));
    const totalQuantity = saleItems.reduce((sum, i) => sum + i.quantity, 0);

    // 3. トランザクションで既存売上読み取り〜在庫差分計算〜書き込みをアトミックに実行
    await runTransaction(db, async (txn) => {
        const [existingSaleSnap, currentTxSnap] = await Promise.all([
            txn.get(saleRef),
            txn.get(transRef),
        ]);

        const isUpdate = existingSaleSnap.exists() || currentTxSnap.exists();
        let previousInventoryEffects: Array<{ scope: 'main'; productId: string; quantity: number }> = [];

        if (existingSaleSnap.exists()) {
            const prevSaleData = existingSaleSnap.data();
            previousInventoryEffects = Array.isArray(prevSaleData.inventoryEffects)
                ? prevSaleData.inventoryEffects.filter((effect: any) => effect.scope === 'main')
                : (prevSaleData.items || [])
                    .filter((item: any) => item.productId && item.productId !== 'SQUARE_UNLINKED')
                    .map((item: any) => ({ scope: 'main' as const, productId: item.productId, quantity: -item.quantity }));
        }

        // 取引(Transaction)登録
        const transData: Record<string, any> = {
            customerName: retailStore ? retailStore.name : "Square Customer",
            storeId: retailStore?.id || null,
            storeName: retailStore?.name || null,
            recipientType: "store",
            channel: "店頭販売",
            transactionType: "Square注文",
            orderDate: orderDate,
            transactionStatus: "完了",
            subtotal: effectiveOrderTotal,
            tax: 0,
            totalAmount: effectiveOrderTotal,
            paidAmount: effectiveOrderTotal,
            balanceAmount: 0,
            remarks: `Square Order ID: ${order.id}`,
            squareOrderId: order.id,
            updatedAt: serverTimestamp(),
        };
        if (!currentTxSnap.exists()) {
            transData.createdAt = serverTimestamp();
        }
        txn.set(transRef, transData, { merge: true });

        // 明細登録（決定論的IDで上書き）
        for (const itemPayload of transactionItemPayloads) {
            const itemRef = doc(db, "transaction_items", itemPayload.id);
            txn.set(itemRef, {
                transactionId: transRef.id,
                productName: itemPayload.productName,
                quantity: itemPayload.quantity,
                unitPrice: itemPayload.unitPrice,
                amount: itemPayload.amount,
                taxRate: itemPayload.taxRate,
                updatedAt: serverTimestamp(),
                ...(isUpdate ? {} : { createdAt: serverTimestamp() }),
            }, { merge: true });
        }

        // 売上(Sales)登録と在庫差分反映
        if (shouldSaveSale && retailStore) {
            const recordedInventoryEffects = skipInventory ? previousInventoryEffects : desiredInventoryEffects;

            if (!skipInventory) {
                const deltas = new Map<string, number>();
                for (const effect of previousInventoryEffects) {
                    deltas.set(effect.productId, (deltas.get(effect.productId) || 0) - effect.quantity);
                }
                for (const effect of desiredInventoryEffects) {
                    deltas.set(effect.productId, (deltas.get(effect.productId) || 0) + effect.quantity);
                }
                for (const [productId, quantity] of deltas) {
                    if (!quantity) continue;
                    const effectEntry = desiredEffectsMap.get(productId);
                    const fallbackSaleItem = saleItems.find(item => item.productId === productId);
                    txn.update(doc(db, "products", productId), {
                        stock: increment(quantity),
                        updatedAt: serverTimestamp(),
                    });
                    txn.set(doc(collection(db, "stock_movements")), {
                        productId,
                        productName: effectEntry?.productName || fallbackSaleItem?.productName || '不明な商品',
                        type: quantity > 0 ? 'in' : 'out',
                        quantity: Math.abs(quantity),
                        reason: quantity > 0 ? 'return' : 'sale',
                        remarks: isUpdate ? 'Square注文更新による在庫差分反映' : 'Square注文による自動減算',
                        referenceId: transRef.id,
                        date: orderDate,
                        createdAt: serverTimestamp(),
                    });
                }
            }

            const saleData: Record<string, any> = {
                id: saleId,
                storeId: retailStore.id,
                storeName: retailStore.name,
                recipientType: 'store',
                type: 'daily',
                period: orderDate,
                items: saleItems,
                totalQuantity: totalQuantity,
                totalAmount: effectiveOrderTotal,
                totalCommission: 0,
                totalNetProfit: effectiveOrderTotal,
                inventoryEffects: recordedInventoryEffects,
                isTrashed: false,
                transactionId: transRef.id,
                remarks: "Square連携売上",
                updatedAt: serverTimestamp(),
            };
            if (!existingSaleSnap.exists()) {
                saleData.createdAt = serverTimestamp();
            }

            txn.set(saleRef, saleData, { merge: true });
        }
    });

    if (shouldSaveSale) {
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
