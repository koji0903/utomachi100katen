// src/lib/salesCockpitUtils.ts
/**
 * 定例会・経営会議向け 売上コックピット集計ユーティリティ
 * 経営陣（月次推移・店舗ポートフォリオ）と現場（日次・商品別個数推移）がひと目で把握できるKPI・推移データを算出
 */

import type { Product, RetailStore, SpotRecipient, Sale } from "./store";

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
    baseDate: Date = new Date()
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
            return {
                productId: pId,
                productName: p ? (p.variantName ? `${p.name} (${p.variantName})` : p.name) : "未特定商品",
                stock: p?.stock ?? 0,
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
