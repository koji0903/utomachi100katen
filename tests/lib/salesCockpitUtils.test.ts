import { describe, it, expect } from "vitest";
import {
    formatDateYmd,
    getPastDaysList,
    getPastMonthsList,
    calculateExecutiveKpis,
    aggregateStoreDailySales,
    aggregateMonthlyStoreSales,
    aggregateProductDailySales,
    aggregateBrandCockpitData,
    calculateSkuProductivityAnalysis,
    calculatePurchasingIntelligence,
    calculateConsultantStrategy,
} from "@/lib/salesCockpitUtils";
import type { Sale, Product, RetailStore, SpotRecipient, Supplier, Purchase, Brand } from "@/lib/store";

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

    it("aggregateStoreDailySales が特定店舗および全店舗の日次売上・商品個数・移動平均線を算出する (7日・90日・360日)", () => {
        // 全店舗合計 (7日)
        const allResult7 = aggregateStoreDailySales(mockSales, "ALL", 7, mockProducts, baseDate);
        expect(allResult7.chartData.length).toBe(7);
        expect(allResult7.totalPeriodAmount).toBe(4800);
        expect(allResult7.totalPeriodQty).toBe(5);
        expect(allResult7.chartData[6]["7日移動平均"]).toBeDefined();

        // 90日間の集計
        const allResult90 = aggregateStoreDailySales(mockSales, "ALL", 90, mockProducts, baseDate);
        expect(allResult90.chartData.length).toBe(90);
        expect(allResult90.chartData[89]["7日移動平均"]).toBeDefined();
        expect(allResult90.chartData[89]["30日移動平均"]).toBeDefined();

        // 360日間の通年集計
        const allResult360 = aggregateStoreDailySales(mockSales, "ALL", 360, mockProducts, baseDate);
        expect(allResult360.chartData.length).toBe(360);
        expect(allResult360.chartData[359]["7日移動平均"]).toBeDefined();
        expect(allResult360.chartData[359]["30日移動平均"]).toBeDefined();

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

    it("aggregateProductDailySales が特定商品の販売推移・移動平均線と店舗別内訳を算出する (30日・90日・360日)", () => {
        const prod1Result = aggregateProductDailySales(mockSales, "prod-1", 30, mockStores, mockSpots, baseDate);
        expect(prod1Result.chartData.length).toBe(30);
        expect(prod1Result.totalQty).toBe(12);
        expect(prod1Result.totalAmount).toBe(9600);
        expect(prod1Result.chartData[29]["7日移動平均"]).toBeDefined();

        // 90日・360日
        const prod1Result90 = aggregateProductDailySales(mockSales, "prod-1", 90, mockStores, mockSpots, baseDate);
        expect(prod1Result90.chartData.length).toBe(90);
        expect(prod1Result90.chartData[89]["7日移動平均"]).toBeDefined();
        expect(prod1Result90.chartData[89]["30日移動平均"]).toBeDefined();

        const prod1Result360 = aggregateProductDailySales(mockSales, "prod-1", 360, mockStores, mockSpots, baseDate);
        expect(prod1Result360.chartData.length).toBe(360);

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

    it("calculateConsultantStrategy: 委託手数料控除後の実質手残り粗利（MQ）および交差比率（GMROI）が正しく算出されること", () => {
        // 委託手数料を含む売上テストデータ
        const consignmentSale: Sale = {
            id: "sale-consignment-1",
            storeId: "store-1",
            type: "daily",
            period: "2026-11-05",
            totalQuantity: 10,
            totalAmount: 10000,
            totalCommission: 2000, // 20%手数料
            totalNetProfit: 8000,
            items: [
                {
                    productId: "prod-1", // sellingPrice: 800, costPrice: 400
                    quantity: 10,
                    priceAtSale: 1000,
                    subtotal: 10000,
                    commission: 2000,
                    netProfit: 8000,
                    variableCostAmount: 4000, // 原価 400 * 10
                }
            ],
            isTrashed: false,
        } as Sale;

        const storeStocks = [
            { storeId: "store-1", productId: "prod-1", stock: 15 },
        ];

        const strategy = calculateConsultantStrategy(
            [consignmentSale],
            mockProducts,
            mockStores,
            mockSpots,
            30,
            baseDate,
            storeStocks
        );

        // 1. 表面粗利 vs 実質手残り粗利（手数料控除後）の峻別
        // 売上 10,000, 原価 4,000, 手数料 2,000
        expect(strategy.totalRevenue).toBe(10000);
        expect(strategy.totalCost).toBe(4000);
        expect(strategy.totalCommission).toBe(2000);
        // 表面粗利 = 10,000 - 4,000 = 6,000 (60%)
        expect(strategy.totalNominalGrossProfit).toBe(6000);
        expect(strategy.nominalGrossMargin).toBe(60);
        // 実質手残り限界利益 = 10,000 - 4,000 - 2,000 = 4,000 (40%)
        expect(strategy.totalGrossProfit).toBe(4000);
        expect(strategy.overallGrossMargin).toBe(40);

        // 2. 交差比率 (GMROI) と 在庫資本効率
        expect(strategy.productsProfitability.length).toBe(1);
        const p1 = strategy.productsProfitability[0];
        expect(p1.productId).toBe("prod-1");
        expect(p1.currentStock).toBe(40); // mainStock 25 + storeStock 15
        expect(p1.stockValue).toBe(40 * 400); // 16,000円
        expect(p1.turnoverAnnual).toBeGreaterThan(0);
        expect(p1.gmroi).toBeGreaterThan(0);
        expect(p1.gmroiCategory).toBeDefined();

        // 3. 注意書き（免責事項）の生成
        expect(strategy.disclaimerNotes.commissionNote).toContain("実質粗利");
        expect(strategy.disclaimerNotes.fixedCostNote).toContain("固定費");
    });

    it("ブランド別動向分析 (aggregateBrandCockpitData) が正しく売上・粗利・商品・配架店舗を集計できること", () => {
        const mockBrands: Brand[] = [
            { id: "brand-1", name: "宇土マチプレミアム", concept: "最高峰の宇土産品", isTrashed: false },
            { id: "brand-2", name: "網田ネーブル特選", concept: "柑橘ブランド", isTrashed: false },
        ];

        const productsWithBrand: Product[] = [
            {
                id: "prod-1",
                name: "ウトマチ特製ドレッシング",
                brandId: "brand-1",
                sellingPrice: 800,
                costPrice: 400,
                stock: 20,
                isTrashed: false,
            } as Product,
            {
                id: "prod-2",
                name: "宇土産 完熟トマトジュース",
                brandId: "brand-1",
                sellingPrice: 1200,
                costPrice: 600,
                stock: 10,
                isTrashed: false,
            } as Product,
            {
                id: "prod-3",
                name: "網田ネーブルゼリー",
                brandId: "brand-2",
                sellingPrice: 500,
                costPrice: 250,
                stock: 30,
                isTrashed: false,
            } as Product,
        ];

        const storeStocks = [
            { storeId: "store-1", productId: "prod-1", stock: 10 },
            { storeId: "store-2", productId: "prod-1", stock: 5 },
        ];

        // 全ブランド集計 (ALL)
        const brandDataAll = aggregateBrandCockpitData(
            mockSales,
            productsWithBrand,
            mockBrands,
            mockStores,
            mockSpots,
            "ALL",
            30,
            baseDate,
            storeStocks
        );

        expect(brandDataAll.totalRevenue).toBeGreaterThan(0);
        expect(brandDataAll.brandsSummary.length).toBeGreaterThanOrEqual(2);
        
        // brand-1 が売上首位
        const brand1Summary = brandDataAll.brandsSummary.find(b => b.brandId === "brand-1");
        expect(brand1Summary).toBeDefined();
        expect(brand1Summary?.brandName).toBe("宇土マチプレミアム");
        expect(brand1Summary?.productCount).toBe(2);
        // 在庫: prod-1 (main 20 + store 15 = 35) + prod-2 (main 10) = 45
        expect(brand1Summary?.totalStock).toBe(45);
        expect(brand1Summary?.grossMargin).toBe(50); // 粗利率 50%

        // 時系列チャートデータの検証
        expect(brandDataAll.chartData.length).toBe(30);
        expect(brandDataAll.chartData[29]).toHaveProperty("売上額");
        expect(brandDataAll.chartData[29]).toHaveProperty("7日移動平均");

        // 個別ブランド集計 ("brand-1")
        const brandDataSelected = aggregateBrandCockpitData(
            mockSales,
            productsWithBrand,
            mockBrands,
            mockStores,
            mockSpots,
            "brand-1",
            30,
            baseDate,
            storeStocks
        );

        expect(brandDataSelected.selectedBrand).toBeDefined();
        expect(brandDataSelected.selectedBrand?.brandId).toBe("brand-1");
        expect(brandDataSelected.selectedBrandProducts.length).toBe(2);
        expect(brandDataSelected.selectedBrandStores.length).toBeGreaterThan(0);
        expect(brandDataSelected.selectedBrandStores[0]).toHaveProperty("storeName");
    });

    it("SKU展開および生産性分析 (calculateSkuProductivityAnalysis) が正しく月次推移・パレート・弾力性を算出できること", () => {
        const mockBrands: Brand[] = [
            { id: "brand-1", name: "宇土マチプレミアム", isTrashed: false },
        ];

        const productsWithDates: Product[] = [
            {
                id: "prod-1",
                name: "定番ドレッシング",
                brandId: "brand-1",
                costPrice: 400,
                sellingPrice: 800,
                stock: 20,
                createdAt: "2026-06-01",
                isTrashed: false,
            } as Product,
            {
                id: "prod-2",
                name: "人気トマトジュース",
                brandId: "brand-1",
                costPrice: 600,
                sellingPrice: 1200,
                stock: 10,
                createdAt: "2026-08-01",
                isTrashed: false,
            } as Product,
            {
                id: "prod-3",
                name: "新作ネーブルゼリー",
                brandId: "brand-1",
                costPrice: 250,
                sellingPrice: 500,
                stock: 30,
                createdAt: "2026-10-15",
                isTrashed: false,
            } as Product,
            {
                id: "prod-4",
                name: "休眠ジャム",
                brandId: "brand-1",
                costPrice: 300,
                sellingPrice: 600,
                stock: 15,
                createdAt: "2026-06-01",
                isTrashed: false,
            } as Product,
        ];

        const multiMonthSales: Sale[] = [
            // 2026-06: prod-1 のみ販売 (1 SKU 稼働)
            {
                id: "sale-jun",
                storeId: "store-1",
                type: "daily",
                period: "2026-06-15",
                totalQuantity: 10,
                totalAmount: 8000,
                totalCommission: 0,
                totalNetProfit: 4000,
                items: [{ productId: "prod-1", quantity: 10, priceAtSale: 800, subtotal: 8000, commission: 0, netProfit: 4000 }],
            } as Sale,
            // 2026-11 (直近): prod-1, prod-2, prod-3 販売 (3 SKU 稼働)
            {
                id: "sale-nov",
                storeId: "store-1",
                type: "daily",
                period: "2026-11-05",
                totalQuantity: 20,
                totalAmount: 20000,
                totalCommission: 0,
                totalNetProfit: 10000,
                items: [
                    { productId: "prod-1", quantity: 10, priceAtSale: 800, subtotal: 8000, commission: 0, netProfit: 4000 },
                    { productId: "prod-2", quantity: 5, priceAtSale: 1200, subtotal: 6000, commission: 0, netProfit: 3000 },
                    { productId: "prod-3", quantity: 12, priceAtSale: 500, subtotal: 6000, commission: 0, netProfit: 3000 },
                ],
            } as Sale,
        ];

        const analysis = calculateSkuProductivityAnalysis(
            productsWithDates,
            multiMonthSales,
            mockBrands,
            6,
            baseDate
        );

        // 基本SKUメトリクス
        expect(analysis.currentTotalSkus).toBe(4);
        expect(analysis.currentActiveSkus).toBe(3); // prod-1, prod-2, prod-3
        expect(analysis.currentInactiveSkus).toBe(1); // prod-4 は売上ゼロ
        expect(analysis.activeSkuRate).toBe(75); // 3 / 4 * 100 = 75%
        expect(analysis.revenuePerActiveSku).toBeGreaterThan(0);
        expect(analysis.profitPerActiveSku).toBeGreaterThan(0);

        // 休眠品資産（prod-4: 15個 * 300円 = 4,500円）
        expect(analysis.dormantCapitalTiedUp).toBe(4500);

        // 月次履歴
        expect(analysis.monthlyHistory.length).toBe(6);
        const novMonth = analysis.monthlyHistory.find(m => m.month === "2026-11");
        expect(novMonth).toBeDefined();
        expect(novMonth?.activeSkus).toBe(3);
        expect(novMonth?.totalRevenue).toBe(20000);

        // パレート分析
        expect(analysis.paretoBreakdown.length).toBe(4); // A, B, C, inactive
        const inactiveGroup = analysis.paretoBreakdown.find(g => g.rank === "inactive");
        expect(inactiveGroup?.skuCount).toBe(1);
        expect(inactiveGroup?.totalStockValue).toBe(4500);

        // 新規SKU追跡
        expect(analysis.recentNewSkus.length).toBeGreaterThan(0);

        // コンサルタント診断
        expect(analysis.consultantDiagnosis.headline).toBeDefined();
        expect(analysis.consultantDiagnosis.actionPoints.length).toBeGreaterThanOrEqual(3);
    });
});
