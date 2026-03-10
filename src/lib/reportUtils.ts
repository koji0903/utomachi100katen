// src/lib/reportUtils.ts
import { Sale, Product, RetailStore, DailyReport } from "./store";

export interface ReportData {
    period: {
        start: string;
        end: string;
    };
    weeklySales: {
        currentAmount: number;
        previousAmount: number;
        growthRate: number;
    };
    storeRanking: {
        name: string;
        amount: number;
    }[];
    productRanking: {
        name: string;
        quantity: number;
    }[];
    forecast: {
        nextWeekPredictedAmount: number;
        trend: 'up' | 'down' | 'stable';
    };
    restockingRecommendations: {
        productId: string;
        productName: string;
        currentStock: number;
        estimatedDaysLeft: number;
        recommendedQty: number;
    }[];
}

export function generateReportData(
    sales: Sale[],
    products: Product[],
    retailStores: RetailStore[],
    dailyReports: DailyReport[]
): ReportData {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 1. Weekly Sales Calculation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);
    const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0];

    const currentWeekSales = sales.filter(s => s.type === 'daily' && s.period >= sevenDaysAgoStr && s.period < todayStr);
    const previousWeekSales = sales.filter(s => s.type === 'daily' && s.period >= fourteenDaysAgoStr && s.period < sevenDaysAgoStr);

    const currentAmount = currentWeekSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const previousAmount = previousWeekSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const growthRate = previousAmount === 0 ? 0 : ((currentAmount - previousAmount) / previousAmount) * 100;

    // 2. Store Ranking
    const storeTotals: Record<string, number> = {};
    currentWeekSales.forEach(s => {
        storeTotals[s.storeId] = (storeTotals[s.storeId] || 0) + s.totalAmount;
    });
    const storeRanking = Object.entries(storeTotals)
        .map(([id, amount]) => ({
            name: retailStores.find(rs => rs.id === id)?.name || "Unknown Store",
            amount
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    // 3. Product Ranking
    const productTotals: Record<string, number> = {};
    currentWeekSales.forEach(s => {
        s.items.forEach(item => {
            productTotals[item.productId] = (productTotals[item.productId] || 0) + item.quantity;
        });
    });
    const productRanking = Object.entries(productTotals)
        .map(([id, quantity]) => ({
            name: products.find(p => p.id === id)?.name || "Unknown Product",
            quantity
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

    // 4. Forecast Logic (Simple 4-week MA)
    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(now.getDate() - 28);
    const twentyEightDaysAgoStr = twentyEightDaysAgo.toISOString().split('T')[0];

    const lastFourWeeksSales = sales.filter(s => s.type === 'daily' && s.period >= twentyEightDaysAgoStr && s.period < todayStr);
    const avgWeeklyAmount = lastFourWeeksSales.reduce((sum, s) => sum + s.totalAmount, 0) / 4;

    // Trend detection
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (growthRate > 5) trend = 'up';
    else if (growthRate < -5) trend = 'down';

    const nextWeekPredictedAmount = Math.round(avgWeeklyAmount * (1 + growthRate / 100));

    // 5. Restocking Recommendations
    // Calculate daily velocity (last 14 days)
    const velocityMap: Record<string, number> = {};
    const last14DaysSales = sales.filter(s => s.type === 'daily' && s.period >= fourteenDaysAgoStr && s.period < todayStr);

    last14DaysSales.forEach(s => {
        s.items.forEach(item => {
            velocityMap[item.productId] = (velocityMap[item.productId] || 0) + (item.quantity / 14);
        });
    });

    const restockingRecommendations = products
        .filter(p => !p.isTrashed)
        .map(p => {
            const velocity = velocityMap[p.id] || 0;
            const currentStock = p.stock || 0;
            const estimatedDaysLeft = velocity === 0 ? 999 : Math.round(currentStock / velocity);

            // Recommend if stock is below threshold or runs out in < 10 days
            const threshold = p.alertThreshold || 10;
            const needsRestock = currentStock <= threshold || estimatedDaysLeft < 10;

            if (needsRestock) {
                return {
                    productId: p.id,
                    productName: p.name,
                    currentStock,
                    estimatedDaysLeft,
                    recommendedQty: Math.max(0, Math.round(velocity * 14) - currentStock) // Aim for 14 days of stock
                };
            }
            return null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => a.estimatedDaysLeft - b.estimatedDaysLeft)
        .slice(0, 10);

    return {
        period: {
            start: sevenDaysAgoStr,
            end: todayStr
        },
        weeklySales: {
            currentAmount,
            previousAmount,
            growthRate
        },
        storeRanking,
        productRanking,
        forecast: {
            nextWeekPredictedAmount,
            trend
        },
        restockingRecommendations
    };
}
