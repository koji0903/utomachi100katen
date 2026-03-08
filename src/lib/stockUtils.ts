// src/lib/stockUtils.ts
import { Product, Sale } from "./store";

/**
 * Calculates the estimated days until stockout for a product.
 * @param product The product to check
 * @param sales All sales records
 * @returns number of days remaining, or Infinity if no sales found (or stock 0)
 */
export function calculateDaysRemaining(product: Product, sales: Sale[]): number {
    if (product.stock <= 0) return 0;

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const productId = product.id;
    let totalSold = 0;

    // Filter sales for this product in the last 30 days
    sales.forEach(sale => {
        // Handle YYYY-MM-DD format
        const saleDate = new Date(sale.period);
        if (sale.type === 'daily' && saleDate >= thirtyDaysAgo && saleDate <= now) {
            const item = sale.items.find(i => i.productId === productId);
            if (item) {
                totalSold += item.quantity;
            }
        }
    });

    if (totalSold === 0) return Infinity;

    const dailyAvg = totalSold / 30;
    return Math.floor(product.stock / dailyAvg);
}

/**
 * Gets a status color/label based on days remaining.
 */
export function getStockoutStatus(days: number) {
    if (days === 0) return { label: "在庫切れ", color: "text-red-600", bg: "bg-red-50" };
    if (days <= 3) return { label: "直近で欠品予報", color: "text-red-500", bg: "bg-red-50" };
    if (days <= 7) return { label: "1週間以内に欠品", color: "text-amber-600", bg: "bg-amber-50" };
    if (days <= 14) return { label: "2週間以内に欠品", color: "text-amber-500", bg: "bg-amber-50" };
    if (days === Infinity) return { label: "動きなし", color: "text-slate-400", bg: "bg-slate-50" };
    return { label: `残り約${days}日分`, color: "text-emerald-600", bg: "bg-emerald-50" };
}
