import { describe, it, expect } from "vitest";
import {
    formatDateYmd,
    getPastDaysList,
    getPastMonthsList,
    calculateExecutiveKpis,
    aggregateStoreDailySales,
    aggregateMonthlyStoreSales,
    aggregateProductDailySales,
    calculatePurchasingIntelligence,
} from "@/lib/salesCockpitUtils";
import type { Sale, Product, RetailStore, SpotRecipient, Supplier, Purchase } from "@/lib/store";

describe("salesCockpitUtils", () => {
    const baseDate = new Date("2026-11-05T12:00:00Z");

    const mockProducts: Product[] = [
        {
            id: "prod-1",
            name: "ウトマチ特製ドレッシング",
            supplierId: "sup-2",
            sellingPrice: 800,
            costPrice: 400,
            stock: 25,
            alertThreshold: 10,
            isTrashed: false,
        } as Product,
        {
            id: "prod-2",
            name: "宇土産 完熟トマトジュース",
            supplierId: "sup-1",
            sellingPrice: 1200,
            costPrice: 600,
            stock: 5,
            alertThreshold: 15,
            isTrashed: false,
        } as Product,
        {
            id: "prod-3",
            name: "季節限定ジャム（在庫滞留中）",
            supplierId: "sup-1",
            sellingPrice: 900,
            costPrice: 500,
            stock: 40,
            alertThreshold: 10,
            isTrashed: false,
        } as Product,
    ];

    const mockStores: RetailStore[] = [
        {
            id: "store-1",
            name: "宇土マリーナ直売所",
            type: "A",
            isTrashed: false,
        } as RetailStore,
        {
            id: "store-2",
            name: "熊本駅店",
            type: "C",
            isTrashed: false,
        } as RetailStore,
    ];

    const mockSpots: SpotRecipient[] = [
        {
            id: "spot-1",
            name: "宇土秋祭り 特設ブース",
            isTrashed: false,
        } as SpotRecipient,
    ];

    const mockSuppliers: Supplier[] = [
        {
            id: "sup-1",
            name: "宇土アグリファーム",
            isTrashed: false,
        } as Supplier,
        {
            id: "sup-2",
            name: "肥後調味料醸造",
            isTrashed: false,
        } as Supplier,
    ];

    const mockSales: Sale[] = [
        // 2026-11-05 (今日)
        {
            id: "sale-1",
            storeId: "store-1",
            type: "daily",
            period: "2026-11-05",
            totalQuantity: 3,
            totalAmount: 2400,
            totalCommission: 0,
            totalNetProfit: 2400,
            items: [
                { productId: "prod-1", quantity: 3, priceAtSale: 800, subtotal: 2400, commission: 0, netProfit: 2400 }
            ],
            isTrashed: false,
        } as Sale,
        // 2026-11-04 (昨日)
        {
            id: "sale-2",
            storeId: "store-2",
            type: "daily",
            period: "2026-11-04",
            totalQuantity: 2,
            totalAmount: 2400,
            totalCommission: 0,
            totalNetProfit: 2400,
            items: [
                { productId: "prod-2", quantity: 2, priceAtSale: 1200, subtotal: 2400, commission: 0, netProfit: 2400 }
            ],
            isTrashed: false,
        } as Sale,
        // 2026-10-25 (11日前)
        {
            id: "sale-3",
            storeId: "store-1",
            type: "daily",
            period: "2026-10-25",
            totalQuantity: 5,
            totalAmount: 4000,
            totalCommission: 0,
            totalNetProfit: 4000,
            items: [
                { productId: "prod-1", quantity: 5, priceAtSale: 800, subtotal: 4000, commission: 0, netProfit: 4000 }
            ],
            isTrashed: false,
        } as Sale,
        // 2026-10-15 (21日前)
        {
            id: "sale-4",
            storeId: "store-1",
            type: "daily",
            period: "2026-10-15",
            totalQuantity: 4,
            totalAmount: 3200,
            totalCommission: 0,
            totalNetProfit: 3200,
            items: [
                { productId: "prod-1", quantity: 4, priceAtSale: 800, subtotal: 3200, commission: 0, netProfit: 3200 }
            ],
            isTrashed: false,
        } as Sale,
        // ゴミ箱の売上（除外されるべき）
        {
            id: "sale-trashed",
            storeId: "store-1",
            type: "daily",
            period: "2026-11-05",
            totalQuantity: 10,
            totalAmount: 100000,
            totalCommission: 0,
            totalNetProfit: 100000,
            items: [
                { productId: "prod-1", quantity: 10, priceAtSale: 10000, subtotal: 100000, commission: 0, netProfit: 100000 }
            ],
            isTrashed: true,
        } as Sale,
    ];

    it("日付ヘルパーが正しいフォーマットと日付リストを返す", () => {
        expect(formatDateYmd(baseDate)).toBe("2026-11-05");

        const days7 = getPastDaysList(7, baseDate);
        expect(days7.length).toBe(7);
        expect(days7[0]).toBe("2026-10-30");
        expect(days7[6]).toBe("2026-11-05");

        const months6 = getPastMonthsList(6, baseDate);
        expect(months6.length).toBe(6);
        expect(months6[5]).toBe("2026-11");
        expect(months6[0]).toBe("2026-06");
    });

    it("calculateExecutiveKpis が直近7日・30日売上とトップ商品・店舗を正確に算出する", () => {
        const kpis = calculateExecutiveKpis(mockSales, mockProducts, mockStores, mockSpots, baseDate);

        // 直近7日 (10/30 ~ 11/05): sale-1 (2400) + sale-2 (2400) = 4800
        expect(kpis.rev7).toBe(4800);

        // 前週7日 (10/23 ~ 10/29): sale-3 (4000)
        expect(kpis.prevRev7).toBe(4000);
        expect(kpis.rev7Growth).toBeCloseTo(((4800 - 4000) / 4000) * 100);

        // 直近30日: sale-1 (2400) + sale-2 (2400) + sale-3 (4000) + sale-4 (3200) = 12000
        expect(kpis.rev30).toBe(12000);
        expect(kpis.dailyAvg30).toBe(Math.round(12000 / 30));

        // トップ商品: prod-1 (3 + 5 + 4 = 12個)
        expect(kpis.topProduct?.id).toBe("prod-1");
        expect(kpis.topProduct?.qty).toBe(12);

        // トップ店舗: store-1 (2400 + 4000 + 3200 = 9600)
        expect(kpis.topStore?.id).toBe("store-1");
        expect(kpis.topStore?.amount).toBe(9600);
    });

    it("aggregateStoreDailySales が特定店舗および全店舗の日次売上・商品個数を算出する", () => {
        // 全店舗合計
        const allResult = aggregateStoreDailySales(mockSales, "ALL", 7, mockProducts, baseDate);
        expect(allResult.chartData.length).toBe(7);
        expect(allResult.totalPeriodAmount).toBe(4800);
        expect(allResult.totalPeriodQty).toBe(5);

        // 特定店舗: store-1 (11/05に3個, 2400円)
        const store1Result = aggregateStoreDailySales(mockSales, "store-1", 7, mockProducts, baseDate);
        expect(store1Result.totalPeriodAmount).toBe(2400);
        expect(store1Result.totalPeriodQty).toBe(3);
        expect(store1Result.top5Items[0].productId).toBe("prod-1");
        expect(store1Result.top5Items[0].qty).toBe(3);
    });

    it("aggregateMonthlyStoreSales が過去6ヶ月の店舗別月次推移を算出する", () => {
        const monthly = aggregateMonthlyStoreSales(mockSales, mockStores, mockSpots, 6, baseDate);
        expect(monthly.chartData.length).toBe(6);

        // 2026-11 の合計: sale-1 (2400) + sale-2 (2400) = 4800
        const novData = monthly.chartData.find(d => d.month === "2026-11");
        expect(novData?.合計).toBe(4800);

        // 2026-10 の合計: sale-3 (4000) + sale-4 (3200) = 7200
        const octData = monthly.chartData.find(d => d.month === "2026-10");
        expect(octData?.合計).toBe(7200);

        // 店舗パフォーマンス一覧
        expect(monthly.storePerformance.length).toBe(2);
        const store1Perf = monthly.storePerformance.find(s => s.id === "store-1");
        expect(store1Perf?.curAmt).toBe(2400);
        expect(store1Perf?.prevAmt).toBe(7200);
    });

    it("aggregateProductDailySales が特定商品の販売推移と店舗別内訳を算出する", () => {
        const prod1Result = aggregateProductDailySales(mockSales, "prod-1", 30, mockStores, mockSpots, baseDate);
        expect(prod1Result.chartData.length).toBe(30);
        expect(prod1Result.totalQty).toBe(12);
        expect(prod1Result.totalAmount).toBe(9600);

        // 店舗別内訳 (store-1 のみで販売)
        expect(prod1Result.storeBreakdown.length).toBe(1);
        expect(prod1Result.storeBreakdown[0].storeId).toBe("store-1");
        expect(prod1Result.storeBreakdown[0].qty).toBe(12);
    });

    it("calculatePurchasingIntelligence が緊急発注推奨、発注残、仕入先まとめ、滞留在庫を正確に算出する", () => {
        // 仕入データ（入荷待ち1件、仕入完了1件）
        const mockPurchases: Purchase[] = [
            {
                id: "po-1",
                type: "A",
                status: "ordered", // 入荷待ち
                supplierId: "sup-1",
                totalAmount: 6000,
                orderDate: "2026-11-04",
                items: [
                    { productId: "prod-2", quantity: 10, receivedQuantity: 0, unitCost: 600, totalCost: 6000 }
                ],
                isTrashed: false,
            } as Purchase,
            {
                id: "po-2",
                type: "A",
                status: "received", // 納品済み（発注残ではない）
                supplierId: "sup-2",
                totalAmount: 4000,
                orderDate: "2026-10-20",
                items: [
                    { productId: "prod-1", quantity: 10, receivedQuantity: 10, unitCost: 400, totalCost: 4000 }
                ],
                isTrashed: false,
            } as Purchase,
        ];

        const intel = calculatePurchasingIntelligence(
            mockProducts,
            mockSales,
            mockPurchases,
            mockSuppliers,
            baseDate
        );

        // prod-2 は現在庫5個、しきい値15個で在庫不足。発注残が10個ある。
        // 目標在庫 = max(30, 15*2) = 30個。
        // 不足 = 30 - (5 + 10) = 15個推奨。
        const prod2Rec = intel.recommendations.find(r => r.productId === "prod-2");
        expect(prod2Rec).toBeDefined();
        expect(prod2Rec?.pendingOrderQty).toBe(10);
        expect(prod2Rec?.supplierName).toBe("宇土アグリファーム");
        expect(prod2Rec?.recommendedOrderQty).toBeGreaterThan(0);

        // 入荷待ち集計
        expect(intel.totalPendingOrderCount).toBe(1);
        expect(intel.totalPendingOrderAmount).toBe(6000);

        // 滞留在庫: prod-3 は直近30日販売ゼロで現在庫40個
        const stagnant = intel.stagnantItems.find(i => i.productId === "prod-3");
        expect(stagnant).toBeDefined();
        expect(stagnant?.soldQty30).toBe(0);
        expect(stagnant?.stockValue).toBe(40 * 500); // 20,000円
    });
});
