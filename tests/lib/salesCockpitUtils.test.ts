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
    calculateConsultantStrategy,
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

    it("calculatePurchasingIntelligence: 直近の売上推移（急伸・鈍化）を反映し、販売実績のない休止商品は発注推奨から除外されること", () => {
        // 未販売・休止商品（在庫0、販売実績0）
        const dormantProduct: Product = {
            id: "dormant-1",
            name: "販売休止中の旧パッケージ商品",
            supplierId: "sup-1",
            sellingPrice: 500,
            costPrice: 250,
            stock: 0,
            alertThreshold: 5,
            isTrashed: false,
        } as Product;

        // 急伸商品（直近7日で急激に売れた商品）
        const surgingProduct: Product = {
            id: "surging-1",
            name: "SNSで話題の宇土海苔チップス",
            supplierId: "sup-2",
            sellingPrice: 400,
            costPrice: 200,
            stock: 2, // 残りわずか
            alertThreshold: 5,
            isTrashed: false,
        } as Product;

        const testProducts = [...mockProducts, dormantProduct, surgingProduct];

        // 直近7日間に surging-1 を合計14個（日販2.0個/日）販売した売上データを追加
        const surgingSales: Sale[] = [
            {
                id: "sale-surge-1",
                storeId: "store-1",
                type: "daily",
                period: "2026-11-04",
                totalAmount: 5600,
                items: [
                    { productId: "surging-1", quantity: 14, priceAtSale: 400, subtotal: 5600, commission: 0, netProfit: 5600 }
                ],
                isTrashed: false,
            } as Sale,
        ];

        const testSales = [...mockSales, ...surgingSales];

        const intel = calculatePurchasingIntelligence(
            testProducts,
            testSales,
            [],
            mockSuppliers,
            baseDate
        );

        // 1. 販売実績なし・在庫0の dormant-1 は発注推奨リストに入っていないこと
        const dormantRec = intel.recommendations.find(r => r.productId === "dormant-1");
        expect(dormantRec).toBeUndefined();
        expect(intel.inactiveZeroStockCount).toBeGreaterThanOrEqual(1);

        // 2. 急伸商品の surging-1 は発注推奨に入り、salesTrend が 'surging' と判定されること
        const surgingRec = intel.recommendations.find(r => r.productId === "surging-1");
        expect(surgingRec).toBeDefined();
        expect(surgingRec?.salesTrend).toBe("surging");
        expect(surgingRec?.soldQty7).toBe(14);
        expect(surgingRec?.soldQty30).toBe(14);
        expect(surgingRec?.isUrgent).toBe(true);
        expect(surgingRec?.recommendedOrderQty).toBeGreaterThan(0);
    });

    it("calculateConsultantStrategy: 小売業経営コンサルタント視点での粗利率・客単価・パレート分析が正しく算出されること", () => {
        const strategy = calculateConsultantStrategy(
            mockSales,
            mockProducts,
            mockStores,
            mockSpots,
            30,
            baseDate
        );

        // 30日売上と粗利
        expect(strategy.totalRevenue).toBeGreaterThan(0);
        expect(strategy.totalCost).toBeGreaterThan(0);
        expect(strategy.totalGrossProfit).toBe(strategy.totalRevenue - strategy.totalCost);
        expect(strategy.overallGrossMargin).toBeGreaterThan(0);

        // 客単価・買上点数（ゴミ箱除外で4件）
        expect(strategy.totalTransactions).toBe(4);
        expect(strategy.averageBasket).toBe(Math.round(strategy.totalRevenue / strategy.totalTransactions));
        expect(strategy.averageUnitsPerBasket).toBeGreaterThan(0);

        // 店舗別収益性
        expect(strategy.storesProfitability.length).toBeGreaterThan(0);
        const store1 = strategy.storesProfitability.find(s => s.storeId === "store-1");
        expect(store1).toBeDefined();
        expect(store1?.totalRevenue).toBe(9600);
        expect(store1?.grossProfit).toBe(4800);
        expect(store1?.grossMarginRatio).toBe(50);
        expect(store1?.averageBasket).toBe(3200); // 9600 / 3 transactions

        // 商品別パレート（ABC分析）
        expect(strategy.productsProfitability.length).toBeGreaterThan(0);
        const topProd = strategy.productsProfitability[0];
        expect(topProd.rankClass).toBe("A");
        expect(topProd.cumulativeRevenueShare).toBeGreaterThan(0);

        // コンサルタントアジェンダ提言
        expect(strategy.consultantAgendas.length).toBeGreaterThanOrEqual(3);
        expect(strategy.consultantAgendas.some(a => a.category === "利益率改善")).toBe(true);
        expect(strategy.consultantAgendas.some(a => a.category === "客単価アップ")).toBe(true);
        expect(strategy.consultantAgendas.some(a => a.category === "集中度・リスク")).toBe(true);
    });
});
