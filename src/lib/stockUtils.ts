// src/lib/stockUtils.ts
import { Product, Sale } from "./store";

export interface ProductStockBreakdown {
    mainStock: number; // 本社倉庫・拠点在庫
    storeStockTotal: number; // 委託・店頭配架在庫の合計
    totalStock: number; // 全社総在庫 (mainStock + storeStockTotal)
    storeStocks: { storeId: string; storeName: string; stock: number }[];
}

/**
 * 商品の本社倉庫在庫・店舗配架在庫・全社総在庫の内訳を算出
 */
export function getProductStockBreakdown(
    product: Product,
    storeStocks: { storeId: string; productId: string; stock: number }[] = [],
    retailStores?: { id: string; name: string }[]
): ProductStockBreakdown {
    const mainStock = product?.stock ?? 0;
    const storeMap = new Map<string, string>();
    if (retailStores) {
        retailStores.forEach(s => storeMap.set(s.id, s.name));
    }
    const relevant = storeStocks.filter(ss => ss.productId === product.id);
    const storeStockTotal = relevant.reduce((sum, ss) => sum + (ss.stock || 0), 0);
    const stores = relevant.map(ss => ({
        storeId: ss.storeId,
        storeName: storeMap.get(ss.storeId) || "店舗",
        stock: ss.stock || 0,
    }));

    return {
        mainStock,
        storeStockTotal,
        totalStock: mainStock + storeStockTotal,
        storeStocks: stores,
    };
}

/**
 * Calculates the estimated days until stockout for a product.
 * @param product The product to check
 * @param sales All sales records
 * @param allProducts Optional full product list to consider consumption via composite/set products
 * @param customStock Optional stock quantity to use (e.g. totalStock). Defaults to product.stock.
 * @returns number of days remaining, or Infinity if no sales found (or stock 0)
 */
export function calculateDaysRemaining(
    product: Product,
    sales: Sale[],
    allProducts?: Product[],
    customStock?: number
): number {
    const stock = customStock !== undefined ? customStock : (product?.stock ?? 0);
    if (stock <= 0) return 0;

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const productId = product.id;
    let totalSold = 0;

    // Find composite products that contain this product as a component
    const parentComposites = allProducts?.filter(p => !p.isTrashed && p.isComposite && p.components?.some(c => c.productId === productId)) || [];

    // Filter sales for this product in the last 30 days
    sales.forEach(sale => {
        if (sale.isTrashed) return;
        // Handle YYYY-MM-DD format
        const saleDate = new Date(sale.period);
        if (sale.type === 'daily' && !isNaN(saleDate.getTime())) {
            const saleTime = saleDate.getTime();
            if (saleTime >= thirtyDaysAgo.getTime() - 24 * 60 * 60 * 1000 && saleTime <= now.getTime() + 24 * 60 * 60 * 1000) {
                // Direct product sales
                const item = sale.items?.find(i => i.productId === productId);
                if (item) {
                    totalSold += item.quantity || 0;
                }
                // Indirect consumption through composite/set products
                if (parentComposites.length > 0) {
                    sale.items?.forEach(sItem => {
                        const parent = parentComposites.find(cp => cp.id === sItem.productId);
                        if (parent && parent.components) {
                            const comp = parent.components.find(c => c.productId === productId);
                            if (comp) {
                                totalSold += (comp.quantity || 0) * (sItem.quantity || 0);
                            }
                        }
                    });
                }
            }
        }
    });

    if (totalSold === 0) return Infinity;

    const dailyAvg = totalSold / 30;
    return Math.floor(stock / dailyAvg);
}

/**
 * Gets a status color/label based on days remaining.
 */
export function getStockoutStatus(days: number, isMainEmptyWithStoreStock: boolean = false) {
    if (isMainEmptyWithStoreStock) {
        return { label: "店頭在庫あり（本社要補充）", color: "text-amber-600", bg: "bg-amber-50" };
    }
    if (days === 0) return { label: "在庫切れ", color: "text-red-600", bg: "bg-red-50" };
    if (days <= 3) return { label: "直近で欠品予報", color: "text-red-500", bg: "bg-red-50" };
    if (days <= 7) return { label: "1週間以内に欠品", color: "text-amber-600", bg: "bg-amber-50" };
    if (days <= 14) return { label: "2週間以内に欠品", color: "text-amber-500", bg: "bg-amber-50" };
    if (days === Infinity) return { label: "動きなし", color: "text-slate-400", bg: "bg-slate-50" };
    return { label: `残り約${days}日分`, color: "text-emerald-600", bg: "bg-emerald-50" };
}
