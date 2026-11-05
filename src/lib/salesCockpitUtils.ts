// src/lib/salesCockpitUtils.ts
/**
 * 定例会・経営会議向け 売上コックピット集計ユーティリティ
 * 経営陣（月次推移・店舗ポートフォリオ）と現場（日次・商品別個数推移）がひと目で把握できるKPI・推移データを算出
 */

import type { Product, RetailStore, SpotRecipient, Sale, Supplier, Purchase } from "./store";
import { calculateDaysRemaining } from "./stockUtils";

// YYYY-MM-DD
export function formatDateYmd(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// 基準日から過去N日間の日付配列（YYYY-MM-DD）
export function getPastDaysList(days: number, baseDate: Date = new Date()): string[] {
    const list: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        list.push(formatDateYmd(d));
    }
    return list;
}

// 基準日から過去Nヶ月の YYYY-MM 配列
export function getPastMonthsList(monthsCount: number, baseDate: Date = new Date()): string[] {
    const list: string[] = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        list.push(`${y}-${m}`);
    }
    return list;
}

export interface ExecutiveKpiSummary {
    rev7: number;
    prevRev7: number;
    rev7Growth: number | null;
    rev30: number;
    dailyAvg30: number;
    topProduct: { id: string; name: string; qty: number; amount: number } | null;
    topStore: { id: string; name: string; amount: number } | null;
}

/**
 * 1. エグゼクティブ・サマリーKPIの算出（直近7日・前週7日・直近30日）
 */
export function calculateExecutiveKpis(
    sales: Sale[],
    products: Product[],
    retailStores: RetailStore[],
    spotRecipients: SpotRecipient[],
    baseDate: Date = new Date()
): ExecutiveKpiSummary {
    const validSales = sales.filter(s => !s.isTrashed && s.period);

    const last7Days = getPastDaysList(7, baseDate);
    const prev7Days = (() => {
        const list: string[] = [];
        for (let i = 13; i >= 7; i--) {
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() - i);
            list.push(formatDateYmd(d));
        }
        return list;
    })();
    const last30Days = getPastDaysList(30, baseDate);

    const last7Sales = validSales.filter(s => last7Days.includes(s.period));
    const prev7Sales = validSales.filter(s => prev7Days.includes(s.period));
    const last30Sales = validSales.filter(s => last30Days.includes(s.period));

    const rev7 = last7Sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const prevRev7 = prev7Sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const rev7Growth = prevRev7 > 0 ? ((rev7 - prevRev7) / prevRev7) * 100 : null;

    const rev30 = last30Sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const dailyAvg30 = Math.round(rev30 / 30);

    // 商品名マップ
    const prodMap = new Map<string, Product>();
    products.forEach(p => prodMap.set(p.id, p));

    // 店舗名マップ
    const storeMap = new Map<string, string>();
    retailStores.forEach(s => storeMap.set(s.id, s.name));
    spotRecipients.forEach(s => storeMap.set(s.id, s.name));

    // 直近30日の商品別販売集計
    const prodCountMap = new Map<string, { qty: number; amount: number }>();
    last30Sales.forEach(s => {
        s.items?.forEach(item => {
            const cur = prodCountMap.get(item.productId) || { qty: 0, amount: 0 };
            prodCountMap.set(item.productId, {
                qty: cur.qty + (item.quantity || 0),
                amount: cur.amount + (item.subtotal || (item.quantity * item.priceAtSale) || 0),
            });
        });
    });

    let topProduct: { id: string; name: string; qty: number; amount: number } | null = null;
    for (const [pId, val] of Array.from(prodCountMap.entries())) {
        if (!topProduct || val.qty > topProduct.qty) {
            const p = prodMap.get(pId);
            topProduct = {
                id: pId,
                name: p ? (p.variantName ? `${p.name} (${p.variantName})` : p.name) : "未特定商品",
                qty: val.qty,
                amount: val.amount,
            };
        }
    }

    // 直近30日の店舗別売上集計
    const storeRevMap = new Map<string, number>();
    last30Sales.forEach(s => {
        const cur = storeRevMap.get(s.storeId) || 0;
        storeRevMap.set(s.storeId, cur + (s.totalAmount || 0));
    });

    let topStore: { id: string; name: string; amount: number } | null = null;
    for (const [sId, amt] of Array.from(storeRevMap.entries())) {
        if (!topStore || amt > topStore.amount) {
            topStore = {
                id: sId,
                name: storeMap.get(sId) || "店舗",
                amount: amt,
            };
        }
    }

    return {
        rev7,
        prevRev7,
        rev7Growth,
        rev30,
        dailyAvg30,
        topProduct,
        topStore,
    };
}

/**
 * 2. 店舗別・日次売上および主力商品個数推移の集計
 */
export function aggregateStoreDailySales(
    sales: Sale[],
    storeId: string, // "ALL" または特定 storeId
    daysCount: 7 | 30,
    products: Product[],
    baseDate: Date = new Date(),
    storeStocks: { storeId: string; productId: string; stock: number }[] = []
) {
    const days = getPastDaysList(daysCount, baseDate);
    const validSales = sales.filter(s => !s.isTrashed && s.period);

    const targetSales = validSales.filter(s => {
        if (!days.includes(s.period)) return false;
        if (storeId !== "ALL" && s.storeId !== storeId) return false;
        return true;
    });

    const prodMap = new Map<string, Product>();
    products.forEach(p => prodMap.set(p.id, p));

    // 商品別集計
    const itemAggMap = new Map<string, { qty: number; amount: number }>();
    targetSales.forEach(s => {
        s.items?.forEach(item => {
            const cur = itemAggMap.get(item.productId) || { qty: 0, amount: 0 };
            itemAggMap.set(item.productId, {
                qty: cur.qty + (item.quantity || 0),
                amount: cur.amount + (item.subtotal || (item.quantity * item.priceAtSale) || 0),
            });
        });
    });

    const sortedItems = Array.from(itemAggMap.entries())
        .map(([pId, data]) => {
            const p = prodMap.get(pId);
            const mainStock = p?.stock ?? 0;
            const relevantSS = storeStocks.filter(ss => ss.productId === pId);
            const storeStockTotal = relevantSS.reduce((sum, ss) => sum + (ss.stock || 0), 0);
            const thisStoreStock = storeId !== "ALL"
                ? (relevantSS.find(ss => ss.storeId === storeId)?.stock ?? 0)
                : 0;
            const displayStock = storeId !== "ALL" ? thisStoreStock : (mainStock + storeStockTotal);

            return {
                productId: pId,
                productName: p ? (p.variantName ? `${p.name} (${p.variantName})` : p.name) : "未特定商品",
                stock: displayStock,
                mainStock,
                storeStockTotal,
                thisStoreStock,
                isStoreSpecific: storeId !== "ALL",
                ...data
            };
        })
        .sort((a, b) => b.qty - a.qty);

    const top5Items = sortedItems.slice(0, 5);

    const chartData = days.map(dStr => {
        const daySales = targetSales.filter(s => s.period === dStr);
        const totalAmount = daySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        const totalQty = daySales.reduce((sum, s) => sum + (s.totalQuantity || 0), 0);

        const parts = dStr.split("-");
        const label = `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;

        const row: Record<string, any> = {
            date: dStr,
            label,
            売上額: totalAmount,
            総販売個数: totalQty,
        };

        top5Items.forEach(item => {
            let pQty = 0;
            daySales.forEach(s => {
                s.items?.forEach(i => {
                    if (i.productId === item.productId) {
                        pQty += (i.quantity || 0);
                    }
                });
            });
            row[item.productName] = pQty;
        });

        return row;
    });

    const totalPeriodAmount = targetSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalPeriodQty = targetSales.reduce((sum, s) => sum + (s.totalQuantity || 0), 0);

    return {
        chartData,
        top5Items,
        sortedItems,
        totalPeriodAmount,
        totalPeriodQty,
    };
}

/**
 * 3. 店舗別・月次売上推移（過去Nヶ月）
 */
export function aggregateMonthlyStoreSales(
    sales: Sale[],
    retailStores: RetailStore[],
    spotRecipients: SpotRecipient[],
    monthsCount: number = 6,
    baseDate: Date = new Date()
) {
    const pastMonths = getPastMonthsList(monthsCount, baseDate);
    const validSales = sales.filter(s => !s.isTrashed && s.period);

    const filtered = validSales.filter(s => {
        const m = s.period.slice(0, 7);
        return pastMonths.includes(m);
    });

    const storeMap = new Map<string, string>();
    retailStores.forEach(s => storeMap.set(s.id, s.name));
    spotRecipients.forEach(s => storeMap.set(s.id, s.name));

    // 店舗ごとの累計売上
    const storeTotalMap = new Map<string, number>();
    filtered.forEach(s => {
        const cur = storeTotalMap.get(s.storeId) || 0;
        storeTotalMap.set(s.storeId, cur + (s.totalAmount || 0));
    });

    const activeStores = Array.from(storeTotalMap.entries())
        .map(([sId, total]) => ({
            id: sId,
            name: storeMap.get(sId) || "店舗",
            total,
        }))
        .sort((a, b) => b.total - a.total);

    const mainStores = activeStores.slice(0, 6);
    const otherStoreIds = new Set(activeStores.slice(6).map(s => s.id));

    const chartData = pastMonths.map(mStr => {
        const mSales = filtered.filter(s => s.period.startsWith(mStr));
        const parts = mStr.split("-");
        const label = `${parseInt(parts[0], 10)}年${parseInt(parts[1], 10)}月`;

        const row: Record<string, any> = {
            month: mStr,
            label,
            合計: mSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
        };

        mainStores.forEach(st => {
            const storeAmount = mSales
                .filter(s => s.storeId === st.id)
                .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
            row[st.name] = storeAmount;
        });

        if (otherStoreIds.size > 0) {
            const otherAmount = mSales
                .filter(s => otherStoreIds.has(s.storeId))
                .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
            row["その他店舗"] = otherAmount;
        }

        return row;
    });

    const currentMonthKey = pastMonths[pastMonths.length - 1];
    const prevMonthKey = pastMonths[pastMonths.length - 2];

    const storePerformance = activeStores.map(st => {
        const curSales = filtered.filter(s => s.storeId === st.id && s.period.startsWith(currentMonthKey));
        const prevSales = filtered.filter(s => s.storeId === st.id && s.period.startsWith(prevMonthKey));

        const curAmt = curSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        const prevAmt = prevSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        const growth = prevAmt > 0 ? ((curAmt - prevAmt) / prevAmt) * 100 : null;

        return {
            id: st.id,
            name: st.name,
            curAmt,
            prevAmt,
            growth,
            totalAll: st.total,
        };
    });

    return {
        chartData,
        mainStores,
        hasOthers: otherStoreIds.size > 0,
        storePerformance,
        currentMonthKey,
    };
}

/**
 * 4. 商品別・日次販売個数および店舗別出荷内訳
 */
export function aggregateProductDailySales(
    sales: Sale[],
    productId: string,
    daysCount: 7 | 30,
    retailStores: RetailStore[],
    spotRecipients: SpotRecipient[],
    baseDate: Date = new Date()
) {
    const days = getPastDaysList(daysCount, baseDate);
    const validSales = sales.filter(s => !s.isTrashed && s.period);

    const relevantSales = validSales.filter(s => {
        if (!days.includes(s.period)) return false;
        return s.items?.some(i => i.productId === productId);
    });

    const storeMap = new Map<string, string>();
    retailStores.forEach(s => storeMap.set(s.id, s.name));
    spotRecipients.forEach(s => storeMap.set(s.id, s.name));

    const chartData = days.map(dStr => {
        const daySales = relevantSales.filter(s => s.period === dStr);
        let dayQty = 0;
        let dayAmount = 0;

        daySales.forEach(s => {
            s.items?.forEach(item => {
                if (item.productId === productId) {
                    dayQty += (item.quantity || 0);
                    dayAmount += (item.subtotal || (item.quantity * item.priceAtSale) || 0);
                }
            });
        });

        const parts = dStr.split("-");
        const label = `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;

        return {
            date: dStr,
            label,
            販売個数: dayQty,
            販売金額: dayAmount,
        };
    });

    const storeBreakdownMap = new Map<string, { qty: number; amount: number }>();
    relevantSales.forEach(s => {
        const sId = s.storeId || "unknown";
        s.items?.forEach(item => {
            if (item.productId === productId) {
                const cur = storeBreakdownMap.get(sId) || { qty: 0, amount: 0 };
                storeBreakdownMap.set(sId, {
                    qty: cur.qty + (item.quantity || 0),
                    amount: cur.amount + (item.subtotal || (item.quantity * item.priceAtSale) || 0),
                });
            }
        });
    });

    const storeBreakdown = Array.from(storeBreakdownMap.entries())
        .map(([sId, data]) => ({
            storeId: sId,
            storeName: storeMap.get(sId) || "店舗",
            ...data,
        }))
        .sort((a, b) => b.qty - a.qty);

    const totalQty = chartData.reduce((sum, d) => sum + d.販売個数, 0);
    const totalAmount = chartData.reduce((sum, d) => sum + d.販売金額, 0);
    const dailyVelocity = totalQty / daysCount;

    return {
        chartData,
        storeBreakdown,
        totalQty,
        totalAmount,
        dailyVelocity,
    };
}

export type SalesTrend = 'surging' | 'stable' | 'slowing';

export interface ReorderRecommendation {
    productId: string;
    productName: string;
    variantName?: string;
    product: Product;
    supplierId: string;
    supplierName: string;
    currentStock: number; // 全社総在庫 (本社+店頭)
    mainStock?: number; // 本社倉庫在庫
    storeStockTotal?: number; // 店頭配架計
    isMainZeroOnly?: boolean; // 本社のみ欠品（店頭在庫あり）
    dailyVelocity: number; // 採用された実効日販（推移を反映）
    dailyVelocity30: number; // 直近30日日販
    dailyVelocity7: number; // 直近7日日販
    soldQty30: number; // 直近30日販売数
    soldQty7: number; // 直近7日販売数
    salesTrend: SalesTrend; // 'surging' (直近急伸) | 'stable' (安定) | 'slowing' (直近鈍化)
    daysRemaining: number;
    pendingOrderQty: number; // 発注済み未入荷数量
    isUrgent: boolean; // 7日以内欠品または在庫0
    isAttention: boolean; // 14日以内欠品またはしきい値以下
    recommendedOrderQty: number; // 推奨発注数
    unitCost: number;
    estimatedCost: number;
}

export interface StagnantStockItem {
    productId: string;
    productName: string;
    variantName?: string;
    product: Product;
    supplierName: string;
    currentStock: number; // 全社総在庫
    mainStock?: number; // 本社倉庫在庫
    storeStockTotal?: number; // 店頭配架計
    daysRemaining: number;
    soldQty30: number;
    unitCost: number;
    stockValue: number; // 在庫金額
}

export interface SupplierOrderSummary {
    supplierId: string;
    supplierName: string;
    itemCount: number;
    totalQuantity: number;
    totalCost: number;
    items: ReorderRecommendation[];
}

export interface PurchasingIntelligence {
    urgentCount: number;
    attentionCount: number;
    totalRecommendedCost: number;
    totalPendingOrderCount: number;
    totalPendingOrderAmount: number;
    inactiveZeroStockCount: number; // 直近販売実績がなく在庫0の非稼働・休止商品数（除外対象）
    recommendations: ReorderRecommendation[];
    supplierSummaries: SupplierOrderSummary[];
    stagnantItems: StagnantStockItem[];
}

/**
 * 5. 発注・仕入の意思決定情報（推奨発注、発注残、仕入先サマリー、滞留在庫）の算出
 */
export function calculatePurchasingIntelligence(
    products: Product[],
    sales: Sale[],
    purchases: Purchase[],
    suppliers: Supplier[],
    baseDate: Date = new Date(),
    storeStocks: { storeId: string; productId: string; stock: number }[] = []
): PurchasingIntelligence {
    const validProducts = products.filter(p => !p.isTrashed);
    const validSales = sales.filter(s => !s.isTrashed);
    const validPurchases = purchases.filter(p => !p.isTrashed);

    const supplierMap = new Map<string, Supplier>();
    suppliers.filter(s => !s.isTrashed).forEach(s => supplierMap.set(s.id, s));

    // 発注残（入荷待ち数量）の集計: status が 'received' または 'paid' 以外の仕入伝票
    const pendingOrderQtyMap = new Map<string, number>();
    let totalPendingOrderCount = 0;
    let totalPendingOrderAmount = 0;

    validPurchases.forEach(p => {
        const isPending = p.status !== 'received' && p.status !== 'paid';
        if (isPending) {
            totalPendingOrderCount++;
            totalPendingOrderAmount += (p.totalAmount || 0);

            p.items?.forEach(item => {
                const pendingQty = Math.max(0, (item.quantity || 0) - (item.receivedQuantity || 0));
                const cur = pendingOrderQtyMap.get(item.productId) || 0;
                pendingOrderQtyMap.set(item.productId, cur + pendingQty);
            });
        }
    });

    // 過去7日および過去30日間の商品別販売数量の集計
    const last7Days = getPastDaysList(7, baseDate);
    const last30Days = getPastDaysList(30, baseDate);

    const soldQty7Map = new Map<string, number>();
    const soldQty30Map = new Map<string, number>();

    validSales.forEach(s => {
        if (!s.period) return;
        const is7 = last7Days.includes(s.period);
        const is30 = last30Days.includes(s.period);
        if (!is7 && !is30) return;

        s.items?.forEach(i => {
            const qty = i.quantity || 0;
            if (is30) {
                const cur30 = soldQty30Map.get(i.productId) || 0;
                soldQty30Map.set(i.productId, cur30 + qty);
            }
            if (is7) {
                const cur7 = soldQty7Map.get(i.productId) || 0;
                soldQty7Map.set(i.productId, cur7 + qty);
            }
        });
    });

    const recommendations: ReorderRecommendation[] = [];
    const stagnantItems: StagnantStockItem[] = [];
    let inactiveZeroStockCount = 0;

    validProducts.forEach(product => {
        const soldQty30 = soldQty30Map.get(product.id) || 0;
        const soldQty7 = soldQty7Map.get(product.id) || 0;
        const dailyVelocity30 = soldQty30 / 30;
        const dailyVelocity7 = soldQty7 / 7;

        // トレンド推移判定
        let salesTrend: SalesTrend = 'stable';
        if (soldQty7 >= 2 && dailyVelocity7 >= dailyVelocity30 * 1.3) {
            salesTrend = 'surging'; // 直近7日で売上が急伸
        } else if (soldQty30 >= 3 && dailyVelocity7 < dailyVelocity30 * 0.7) {
            salesTrend = 'slowing'; // 直近7日で売上が鈍化
        }

        // 推移を反映した実効日販速度
        let effectiveVelocity = dailyVelocity30;
        if (salesTrend === 'surging') {
            effectiveVelocity = Math.max(dailyVelocity7, dailyVelocity30);
        } else if (salesTrend === 'slowing') {
            effectiveVelocity = (dailyVelocity7 * 2 + dailyVelocity30) / 3;
        }

        const mainStock = product.stock ?? 0;
        const relevantSS = storeStocks.filter(ss => ss.productId === product.id);
        const storeStockTotal = relevantSS.reduce((sum, ss) => sum + (ss.stock || 0), 0);
        const totalStock = mainStock + storeStockTotal;

        // 実効日販に基づく在庫消化日数
        const daysRemaining = effectiveVelocity > 0
            ? Math.floor(totalStock / effectiveVelocity)
            : (totalStock > 0 ? Infinity : 0);

        const pendingOrderQty = pendingOrderQtyMap.get(product.id) || 0;
        const threshold = product.alertThreshold ?? 5; // 統一基準しきい値 (未設定時は5)

        const isZeroStock = totalStock <= 0;
        const isMainZeroOnly = mainStock <= 0 && storeStockTotal > 0;
        const isUnderThreshold = totalStock <= threshold;
        const isRunningOutSoon = daysRemaining !== Infinity && daysRemaining <= 14;

        // 【重要】直近販売実績のない非稼働・休止商品（直近30日も7日も0個）の判定
        const hasRecentSales = soldQty30 > 0 || soldQty7 > 0;

        if (!hasRecentSales && isZeroStock) {
            // 販売実績がなく在庫も0 ＝ 取り扱っていない／休止中の商品のため、発注推奨から除外
            inactiveZeroStockCount++;
        }

        const supplier = supplierMap.get(product.supplierId) || null;
        const supplierName = supplier?.name || "仕入先未設定";
        const unitCost = product.costPrice || 0;

        // 要発注判定:
        // 直近で販売実績があり、かつ（全社総在庫が0、しきい値以下、14日以内欠品、または本社欠品で店舗少）
        if (hasRecentSales && (isZeroStock || isUnderThreshold || isRunningOutSoon || (isMainZeroOnly && effectiveVelocity > 0))) {
            // 推奨発注数: 
            // トレンドに応じてカバー日数を調整（急伸時は45日分、通常は30日分、鈍化時は20日分）
            const daysToCover = salesTrend === 'surging' ? 45 : (salesTrend === 'slowing' ? 20 : 30);
            const targetStock = effectiveVelocity > 0
                ? Math.max(Math.ceil(effectiveVelocity * daysToCover), threshold * 2)
                : Math.max(threshold * 2, 10);

            // 有効在庫 = 全社総在庫 + 入荷待ち
            const effectiveStock = totalStock + pendingOrderQty;
            const shortage = Math.max(0, targetStock - effectiveStock);

            // 不足がある場合、または在庫0で発注残もない場合
            if (shortage > 0 || (isZeroStock && pendingOrderQty === 0)) {
                const recommendedOrderQty = shortage > 0 ? shortage : Math.max(threshold * 2, 10);
                const isUrgent = isZeroStock || (daysRemaining !== Infinity && daysRemaining <= 7);

                recommendations.push({
                    productId: product.id,
                    productName: product.name,
                    variantName: product.variantName,
                    product,
                    supplierId: product.supplierId || "unassigned",
                    supplierName,
                    currentStock: totalStock,
                    mainStock,
                    storeStockTotal,
                    isMainZeroOnly,
                    dailyVelocity: effectiveVelocity,
                    dailyVelocity30,
                    dailyVelocity7,
                    soldQty30,
                    soldQty7,
                    salesTrend,
                    daysRemaining,
                    pendingOrderQty,
                    isUrgent,
                    isAttention: !isUrgent,
                    recommendedOrderQty,
                    unitCost,
                    estimatedCost: unitCost * recommendedOrderQty,
                });
            }
        }

        // 滞留・過剰在庫判定:
        // 1. 直近30日販売ゼロで全社在庫が眠っている商品（非販売品だが在庫資産がある）
        // 2. 販売はあるが在庫消化に90日以上かかる過剰在庫
        const isStagnant = (soldQty30 === 0 && totalStock > 0) || (daysRemaining > 90 && totalStock > threshold * 3);
        if (isStagnant && totalStock > 0) {
            stagnantItems.push({
                productId: product.id,
                productName: product.name,
                variantName: product.variantName,
                product,
                supplierName,
                currentStock: totalStock,
                mainStock,
                storeStockTotal,
                daysRemaining,
                soldQty30,
                unitCost,
                stockValue: totalStock * unitCost,
            });
        }
    });

    // 推奨発注リストのソート: 緊急度（残日数の少ない順）
    recommendations.sort((a, b) => {
        const aDays = a.daysRemaining === Infinity ? 999 : a.daysRemaining;
        const bDays = b.daysRemaining === Infinity ? 999 : b.daysRemaining;
        return aDays - bDays || b.estimatedCost - a.estimatedCost;
    });

    // 滞留在庫リストのソート: 在庫金額の大きい順
    stagnantItems.sort((a, b) => b.stockValue - a.stockValue);

    // 仕入先別サマリーの構築
    const supplierSummaryMap = new Map<string, SupplierOrderSummary>();
    recommendations.forEach(rec => {
        const sId = rec.supplierId;
        const cur = supplierSummaryMap.get(sId) || {
            supplierId: sId,
            supplierName: rec.supplierName,
            itemCount: 0,
            totalQuantity: 0,
            totalCost: 0,
            items: [],
        };
        cur.itemCount++;
        cur.totalQuantity += rec.recommendedOrderQty;
        cur.totalCost += rec.estimatedCost;
        cur.items.push(rec);
        supplierSummaryMap.set(sId, cur);
    });

    const supplierSummaries = Array.from(supplierSummaryMap.values())
        .sort((a, b) => b.totalCost - a.totalCost);

    const urgentCount = recommendations.filter(r => r.isUrgent).length;
    const attentionCount = recommendations.filter(r => r.isAttention).length;
    const totalRecommendedCost = recommendations.reduce((sum, r) => sum + r.estimatedCost, 0);

    return {
        urgentCount,
        attentionCount,
        totalRecommendedCost,
        totalPendingOrderCount,
        totalPendingOrderAmount,
        inactiveZeroStockCount,
        recommendations,
        supplierSummaries,
        stagnantItems,
    };
}

// ─────────────────────────────────────────────────────────────
// 5. 小売業経営コンサルタント戦略分析（粗利率・客単価・チャネル・パレート）
// ─────────────────────────────────────────────────────────────

export interface ConsultantStoreProfitability {
    storeId: string;
    storeName: string;
    channelType: string;
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    grossMarginRatio: number; // %
    transactionCount: number;
    totalUnits: number;
    averageBasket: number; // 客単価 (売上 / 伝票数)
    averageUnitsPerBasket: number; // 平均買上点数 (個数 / 伝票数)
    averageUnitPrice: number; // 平均商品単価 (売上 / 個数)
}

export interface ConsultantProductProfitability {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
    cost: number;
    grossProfit: number;
    grossMarginRatio: number; // %
    revenueShare: number; // %
    cumulativeRevenueShare: number; // %
    rankClass: 'A' | 'B' | 'C';
    isHighMarginAce: boolean;
    isLowMarginAlert: boolean;
}

export interface ConsultantChannelBreakdown {
    channelKey: string;
    label: string;
    revenue: number;
    share: number; // %
    cost: number;
    grossProfit: number;
    grossMarginRatio: number; // %
    transactionCount: number;
}

export interface ConsultantStrategyIntelligence {
    periodDays: 7 | 30;
    totalRevenue: number;
    totalCost: number;
    totalGrossProfit: number;
    overallGrossMargin: number; // %
    totalTransactions: number;
    totalUnits: number;
    averageBasket: number;
    averageUnitsPerBasket: number;
    averageUnitPrice: number;
    channelBreakdown: ConsultantChannelBreakdown[];
    storesProfitability: ConsultantStoreProfitability[];
    productsProfitability: ConsultantProductProfitability[];
    paretoRatio: {
        top20PercentProductCount: number;
        top20RevenueShare: number; // %
        dependenceLevel: 'high' | 'moderate' | 'balanced';
    };
    consultantAgendas: {
        category: '利益率改善' | '客単価アップ' | '集中度・リスク' | 'チャネル戦略';
        title: string;
        diagnostic: string;
        actionProposal: string;
        urgency: 'high' | 'medium' | 'low';
    }[];
}

/**
 * 定例会向け 経営コンサルタント戦略分析データの算出
 */
export function calculateConsultantStrategy(
    sales: Sale[],
    products: Product[],
    retailStores: RetailStore[],
    spotRecipients: SpotRecipient[],
    periodDays: 7 | 30 = 30,
    baseDate: Date = new Date()
): ConsultantStrategyIntelligence {
    const days = getPastDaysList(periodDays, baseDate);
    const validSales = sales.filter(s => !s.isTrashed && s.period && days.includes(s.period));

    // 商品マップ
    const prodMap = new Map<string, Product>();
    products.forEach(p => prodMap.set(p.id, p));

    // 店舗マップ
    const storeMap = new Map<string, { name: string; channelType: string }>();
    retailStores.forEach(s => {
        let channelType = "委託販売店舗";
        if (s.name.includes("Amazon") || s.name.toLowerCase().includes("ec")) {
            channelType = "EC (Amazon/オンライン)";
        } else if (s.type === "C") {
            channelType = "直営・店頭店舗";
        }
        storeMap.set(s.id, { name: s.name, channelType });
    });
    spotRecipients.forEach(s => {
        storeMap.set(s.id, { name: s.name, channelType: "催事・特設スポット" });
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalUnits = 0;
    const totalTransactions = validSales.length;

    // 店舗別集計
    const storeAggMap = new Map<string, {
        revenue: number;
        cost: number;
        units: number;
        transactions: number;
    }>();

    // 商品別集計
    const prodAggMap = new Map<string, {
        quantity: number;
        revenue: number;
        cost: number;
    }>();

    // チャネル別集計
    const channelAggMap = new Map<string, {
        label: string;
        revenue: number;
        cost: number;
        transactions: number;
    }>();

    validSales.forEach(sale => {
        const storeInfo = storeMap.get(sale.storeId) || { name: sale.storeName || "その他店舗", channelType: "店頭店舗" };
        let channelKey = storeInfo.channelType;
        if (sale.salesChannel) {
            if (sale.salesChannel.includes("Amazon") || sale.salesChannel.includes("EC")) {
                channelKey = "EC (Amazon/オンライン)";
            } else if (sale.salesChannel.includes("催事") || sale.salesChannel.includes("イベント")) {
                channelKey = "催事・特設スポット";
            }
        }

        let saleCost = 0;
        let saleRevenue = sale.totalAmount || 0;
        let saleUnits = 0;

        sale.items?.forEach(item => {
            const p = prodMap.get(item.productId);
            const unitCost = p?.costPrice ?? 0;
            const itemCost = item.variableCostAmount !== undefined && item.variableCostAmount > 0
                ? item.variableCostAmount
                : (item.quantity * unitCost);
            const itemRev = item.subtotal || (item.quantity * item.priceAtSale) || 0;
            const itemQty = item.quantity || 0;

            saleCost += itemCost;
            saleUnits += itemQty;

            // 商品集計
            const curP = prodAggMap.get(item.productId) || { quantity: 0, revenue: 0, cost: 0 };
            prodAggMap.set(item.productId, {
                quantity: curP.quantity + itemQty,
                revenue: curP.revenue + itemRev,
                cost: curP.cost + itemCost,
            });
        });

        // 売上データに totalQuantity があれば尊重
        if (sale.totalQuantity && sale.totalQuantity > 0) {
            saleUnits = sale.totalQuantity;
        }

        totalRevenue += saleRevenue;
        totalCost += saleCost;
        totalUnits += saleUnits;

        // 店舗集計
        const curStore = storeAggMap.get(sale.storeId) || { revenue: 0, cost: 0, units: 0, transactions: 0 };
        storeAggMap.set(sale.storeId, {
            revenue: curStore.revenue + saleRevenue,
            cost: curStore.cost + saleCost,
            units: curStore.units + saleUnits,
            transactions: curStore.transactions + 1,
        });

        // チャネル集計
        const curChan = channelAggMap.get(channelKey) || { label: channelKey, revenue: 0, cost: 0, transactions: 0 };
        channelAggMap.set(channelKey, {
            label: channelKey,
            revenue: curChan.revenue + saleRevenue,
            cost: curChan.cost + saleCost,
            transactions: curChan.transactions + 1,
        });
    });

    const totalGrossProfit = totalRevenue - totalCost;
    const overallGrossMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const averageBasket = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;
    const averageUnitsPerBasket = totalTransactions > 0 ? Math.round((totalUnits / totalTransactions) * 10) / 10 : 0;
    const averageUnitPrice = totalUnits > 0 ? Math.round(totalRevenue / totalUnits) : 0;

    // 店舗別収益性配列
    const storesProfitability: ConsultantStoreProfitability[] = Array.from(storeAggMap.entries()).map(([storeId, data]) => {
        const storeInfo = storeMap.get(storeId) || { name: "店舗", channelType: "店頭店舗" };
        const grossProfit = data.revenue - data.cost;
        const grossMarginRatio = data.revenue > 0 ? (grossProfit / data.revenue) * 100 : 0;
        const avgBasket = data.transactions > 0 ? Math.round(data.revenue / data.transactions) : 0;
        const avgUnits = data.transactions > 0 ? Math.round((data.units / data.transactions) * 10) / 10 : 0;
        const avgUnitPx = data.units > 0 ? Math.round(data.revenue / data.units) : 0;

        return {
            storeId,
            storeName: storeInfo.name,
            channelType: storeInfo.channelType,
            totalRevenue: data.revenue,
            totalCost: data.cost,
            grossProfit,
            grossMarginRatio,
            transactionCount: data.transactions,
            totalUnits: data.units,
            averageBasket: avgBasket,
            averageUnitsPerBasket: avgUnits,
            averageUnitPrice: avgUnitPx,
        };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // チャネル別配列
    const channelBreakdown: ConsultantChannelBreakdown[] = Array.from(channelAggMap.entries()).map(([channelKey, data]) => {
        const profit = data.revenue - data.cost;
        const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
        const share = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
        return {
            channelKey,
            label: data.label,
            revenue: data.revenue,
            share,
            cost: data.cost,
            grossProfit: profit,
            grossMarginRatio: margin,
            transactionCount: data.transactions,
        };
    }).sort((a, b) => b.revenue - a.revenue);

    // 商品別パレート（ABC）分析
    const rawProductsProfit = Array.from(prodAggMap.entries()).map(([productId, data]) => {
        const p = prodMap.get(productId);
        const profit = data.revenue - data.cost;
        const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
        const revShare = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
        return {
            productId,
            productName: p ? (p.variantName ? `${p.name} (${p.variantName})` : p.name) : "未特定商品",
            quantity: data.quantity,
            revenue: data.revenue,
            cost: data.cost,
            grossProfit: profit,
            grossMarginRatio: margin,
            revenueShare: revShare,
            cumulativeRevenueShare: 0,
            rankClass: 'C' as 'A' | 'B' | 'C',
            isHighMarginAce: false,
            isLowMarginAlert: false,
        };
    }).sort((a, b) => b.revenue - a.revenue);

    let cumulative = 0;
    const productsProfitability: ConsultantProductProfitability[] = rawProductsProfit.map((prod, idx) => {
        cumulative += prod.revenueShare;
        let rank: 'A' | 'B' | 'C' = 'C';
        if (cumulative <= 80 || idx === 0) {
            rank = 'A';
        } else if (cumulative <= 95) {
            rank = 'B';
        } else {
            rank = 'C';
        }

        const isHighMarginAce = (rank === 'A' || rank === 'B') && prod.grossMarginRatio >= overallGrossMargin && prod.revenue > 0;
        const isLowMarginAlert = prod.quantity >= 5 && prod.grossMarginRatio < 25;

        return {
            ...prod,
            cumulativeRevenueShare: Math.min(100, Math.round(cumulative * 10) / 10),
            rankClass: rank,
            isHighMarginAce,
            isLowMarginAlert,
        };
    });

    // パレート分析（80:20分析）
    const totalProdCount = Math.max(1, productsProfitability.length);
    const top20PercentCount = Math.max(1, Math.ceil(totalProdCount * 0.2));
    const top20Rev = productsProfitability.slice(0, top20PercentCount).reduce((sum, p) => sum + p.revenue, 0);
    const top20RevenueShare = totalRevenue > 0 ? Math.round((top20Rev / totalRevenue) * 100) : 0;

    let dependenceLevel: 'high' | 'moderate' | 'balanced' = 'moderate';
    if (top20RevenueShare >= 80) {
        dependenceLevel = 'high';
    } else if (top20RevenueShare < 60) {
        dependenceLevel = 'balanced';
    }

    // ─────────────────────────────────────────────────────────────
    // 定例会アジェンダ・具体的提言の自動生成
    // ─────────────────────────────────────────────────────────────
    const consultantAgendas: ConsultantStrategyIntelligence['consultantAgendas'] = [];

    // 1. 粗利率・利益構造診断
    const lowMarginItems = productsProfitability.filter(p => p.isLowMarginAlert);
    const highMarginAces = productsProfitability.filter(p => p.isHighMarginAce);
    if (overallGrossMargin < 35 && totalRevenue > 0) {
        consultantAgendas.push({
            category: '利益率改善',
            title: `全社粗利率の底上げ検討（現在 ${overallGrossMargin.toFixed(1)}%）`,
            diagnostic: `全社粗利率が35%を下回っており、販促値引きや原価高騰による利益圧迫が懸念されます。${lowMarginItems.length > 0 ? `特に「${lowMarginItems[0].productName}」（粗利率 ${lowMarginItems[0].grossMarginRatio.toFixed(1)}%）の薄利傾向が目立ちます。` : ""}`,
            actionProposal: '定例会にて、低粗利商品の販売価格見直し、仕入ロット増による原価低減、または高粗利商品とのセット販売化を決定してください。',
            urgency: 'high',
        });
    } else {
        consultantAgendas.push({
            category: '利益率改善',
            title: `高粗利エース商品のフェイス拡大（全社粗利率 ${overallGrossMargin.toFixed(1)}% 良好）`,
            diagnostic: `粗利額 ¥${totalGrossProfit.toLocaleString()}（粗利率 ${overallGrossMargin.toFixed(1)}%）と健全な水準を維持しています。${highMarginAces.length > 0 ? `「${highMarginAces[0].productName}」などの高粗利エースが利益の柱となっています。` : ""}`,
            actionProposal: '主力店舗のゴールデンゾーン（目線の高さ）への高粗利商品の陳列拡大と、POP販促の強化を指示してください。',
            urgency: 'low',
        });
    }

    // 2. 客単価・買上点数の分解診断
    const lowestBasketStore = [...storesProfitability].filter(s => s.transactionCount >= 3).sort((a, b) => a.averageBasket - b.averageBasket)[0];
    const highestBasketStore = [...storesProfitability].filter(s => s.transactionCount >= 3).sort((a, b) => b.averageBasket - a.averageBasket)[0];
    consultantAgendas.push({
        category: '客単価アップ',
        title: `客単価構造の分解（全社平均: ¥${averageBasket.toLocaleString()} / 買上点数: ${averageUnitsPerBasket}点）`,
        diagnostic: `売上＝客数×客単価。最高客単価店舗は「${highestBasketStore?.storeName || "主力店"}」（¥${highestBasketStore?.averageBasket.toLocaleString()}）に対し、最低客単価店舗は「${lowestBasketStore?.storeName || "一部店舗"}」（¥${lowestBasketStore?.averageBasket.toLocaleString() || 0}）と格差が存在します。`,
        actionProposal: lowestBasketStore
            ? `客単価が低い「${lowestBasketStore.storeName}」では、レジ横のついで買いPOP設置や複数個まとめ買い割引（2個購入で¥50引等）を現場と合意してください。`
            : '全店舗でレジ横のクロスセル商材の展開と、スタッフによるおすすめ推奨トークの徹底を定例会で指示してください。',
        urgency: lowestBasketStore && lowestBasketStore.averageBasket < averageBasket * 0.7 ? 'high' : 'medium',
    });

    // 3. パレート集中リスクと商品開発
    if (dependenceLevel === 'high') {
        const top1Prod = productsProfitability[0];
        consultantAgendas.push({
            category: '集中度・リスク',
            title: `特定商品への売上集中リスク（上位20%でシェア ${top20RevenueShare}%）`,
            diagnostic: `売れ筋上位20%（${top20PercentCount}品目）で売上の${top20RevenueShare}%を占める極端な集中構造です。${top1Prod ? `特に「${top1Prod.productName}」の動向が全社業績を左右する状態です。` : ""}`,
            actionProposal: 'トップ商品の欠品防止（安全在庫＋1週間分）を徹底するとともに、定例会にてBランク上位商品のプロモーション強化による「第2の柱」育成を推進してください。',
            urgency: 'high',
        });
    } else {
        consultantAgendas.push({
            category: '集中度・リスク',
            title: `バランスの良い商品ポートフォリオ（上位20%シェア ${top20RevenueShare}%）`,
            diagnostic: `売れ筋が特定1〜2商品に偏っておらず、複数商品で売上を分散獲得できています（ロングテールが機能）。`,
            actionProposal: '各商品の販売チャネルごとの特性（どの店舗でどの商品が伸びているか）を精査し、店舗別推奨ラインナップの最適化を図ってください。',
            urgency: 'low',
        });
    }

    // 4. チャネル戦略
    if (channelBreakdown.length > 1) {
        const topChannel = channelBreakdown[0];
        const subChannel = channelBreakdown[1];
        consultantAgendas.push({
            category: 'チャネル戦略',
            title: `チャネルミックスの最適化（主軸: ${topChannel.label} ${topChannel.share.toFixed(1)}%）`,
            diagnostic: `最大チャネル「${topChannel.label}」（粗利率 ${topChannel.grossMarginRatio.toFixed(1)}%）に次ぎ、「${subChannel.label}」（シェア ${subChannel.share.toFixed(1)}%、粗利率 ${subChannel.grossMarginRatio.toFixed(1)}%）が展開中。`,
            actionProposal: topChannel.grossMarginRatio > subChannel.grossMarginRatio
                ? `より粗利率の高い「${topChannel.label}」への供給優先度を高めつつ、「${subChannel.label}」の販売手数料・物流コストの改善を検討してください。`
                : `利益率の高い「${subChannel.label}」の販売構成比をさらに拡大するため、専用商品や在庫枠の拡充を検討してください。`,
            urgency: 'medium',
        });
    }

    return {
        periodDays,
        totalRevenue,
        totalCost,
        totalGrossProfit,
        overallGrossMargin,
        totalTransactions,
        totalUnits,
        averageBasket,
        averageUnitsPerBasket,
        averageUnitPrice,
        channelBreakdown,
        storesProfitability,
        productsProfitability,
        paretoRatio: {
            top20PercentProductCount: top20PercentCount,
            top20RevenueShare,
            dependenceLevel,
        },
        consultantAgendas,
    };
}
