import { describe, expect, it } from "vitest";
import {
    generateFiscalInventoryReport,
    getFiscalYearPresets,
    exportFiscalReportToCsv,
} from "@/lib/fiscalInventoryReport";

describe("fiscalInventoryReport", () => {
    it("10月末決算の年度プリセットが正しく算出される", () => {
        // 2026年11月16日の場合、直近確定決算期は 2025/11/01 〜 2026/10/31
        const presets = getFiscalYearPresets(new Date("2026-11-16"));
        expect(presets.latestClosed.startDate).toBe("2025-11-01");
        expect(presets.latestClosed.endDate).toBe("2026-10-31");
        expect(presets.latestClosed.label).toContain("2026年10月期");

        expect(presets.previousClosed.startDate).toBe("2024-11-01");
        expect(presets.previousClosed.endDate).toBe("2025-10-31");

        expect(presets.currentFiscalYear.startDate).toBe("2026-11-01");
    });

    it("期間内の入出庫および期末在庫・期首在庫が等式通り正確に計算される", () => {
        const mockProducts = [
            { id: "p1", name: "商品A", stock: 10, costPrice: 500, sellingPrice: 1000, brandId: "b1", supplierId: "s1" } as any,
            { id: "p2", name: "商品B", stock: 20, costPrice: 300, sellingPrice: 600, brandId: "b1", supplierId: "s1" } as any,
        ];

        // stockMovements:
        // p1: 前期 2025-10-01 に入庫 2 (前期繰越), 2026-10-15 に入庫 15 (期間内), 2026-10-25 に出庫 5 (期間内), 2026-11-05 に出庫 2 (期末後)
        // 現在庫が 10 なので、期末時点(2026-10-31)の在庫は 10 + 2 = 12
        // 期間中入庫 15、期間中出庫 5 なので、期首在庫は 12 - 15 + 5 = 2
        const mockMovements = [
            { productId: "p1", type: "in", quantity: 2, date: "2025-10-01" } as any,
            { productId: "p1", type: "in", quantity: 15, date: "2026-10-15" } as any,
            { productId: "p1", type: "out", quantity: 5, date: "2026-10-25" } as any,
            { productId: "p1", type: "out", quantity: 2, date: "2026-11-05" } as any,
        ];

        const report = generateFiscalInventoryReport({
            products: mockProducts,
            stockMovements: mockMovements,
            storeStockMovements: [],
            storeStocks: [],
            startDate: "2025-11-01",
            endDate: "2026-10-31",
            includeStoreStock: false,
        });

        const p1Item = report.items.find(i => i.productId === "p1");
        expect(p1Item).toBeDefined();
        expect(p1Item?.endingStock).toBe(12);
        expect(p1Item?.inboundQty).toBe(15);
        expect(p1Item?.outboundQty).toBe(5);
        expect(p1Item?.beginningStock).toBe(2);
        expect(p1Item!.beginningStock + p1Item!.inboundQty - p1Item!.outboundQty).toBe(p1Item!.endingStock);
        expect(p1Item?.endingAmount).toBe(12 * 500); // 6,000円
    });

    it("決算対象外に指定された商品はサマリー集計から除外される", () => {
        const mockProducts = [
            { id: "p1", name: "商品A", stock: 10, costPrice: 500, brandId: "b1", supplierId: "s1" } as any,
            { id: "p2", name: "非売サンプル品", stock: 50, costPrice: 100, brandId: "b1", supplierId: "s1" } as any,
        ];

        const report = generateFiscalInventoryReport({
            products: mockProducts,
            stockMovements: [],
            storeStockMovements: [],
            storeStocks: [],
            startDate: "2025-11-01",
            endDate: "2026-10-31",
            excludedProductIds: ["p2"],
        });

        expect(report.items.length).toBe(1);
        expect(report.items[0].productId).toBe("p1");
        expect(report.excludedItems.length).toBe(1);
        expect(report.excludedItems[0].productId).toBe("p2");
        expect(report.summary.activeSkuCount).toBe(1);
        expect(report.summary.excludedSkuCount).toBe(1);
        expect(report.summary.totalEndingAmount).toBe(10 * 500); // p1のみ計上
    });

    it("CSVエクスポートがBOM付きUTF-8で正しく出力される", () => {
        const mockProducts = [
            { id: "p1", name: "宇土産海苔", stock: 5, costPrice: 400, amazonSku: "SKU-NORI", brandId: "b1", supplierId: "s1" } as any,
        ];

        const report = generateFiscalInventoryReport({
            products: mockProducts,
            stockMovements: [],
            storeStockMovements: [],
            storeStocks: [],
            startDate: "2025-11-01",
            endDate: "2026-10-31",
        });

        const csv = exportFiscalReportToCsv(report);
        expect(csv.startsWith("\uFEFF")).toBe(true);
        expect(csv).toContain("決算在庫管理レポート（棚卸資産明細書）");
        expect(csv).toContain("宇土産海苔");
        expect(csv).toContain("SKU-NORI");
    });

    it("仕入開始前（2026年3月より前）の2025年10月決算期は、現在庫があっても全品在庫0・評価額0となる", () => {
        // 商品A: 現在庫14、初回仕入が2026-03-17
        const mockProducts = [
            { id: "p1", name: "商品A", stock: 14, costPrice: 1000, brandId: "b1", supplierId: "s1" } as any,
        ];
        // 2026年3月に仕入実績
        const mockPurchases = [
            { id: "pur1", arrivalDate: "2026-03-17", items: [{ productId: "p1", quantity: 50 }] } as any,
        ];
        const mockMovements = [
            { productId: "p1", type: "in", quantity: 50, date: "2026-03-17" } as any,
            { productId: "p1", type: "out", quantity: 36, date: "2026-04-10" } as any,
        ];

        // 2025年10月決算（2024-11-01 〜 2025-10-31）
        const report2025 = generateFiscalInventoryReport({
            products: mockProducts,
            purchases: mockPurchases,
            stockMovements: mockMovements,
            storeStockMovements: [],
            storeStocks: [],
            startDate: "2024-11-01",
            endDate: "2025-10-31",
        });

        expect(report2025.items.length).toBe(1);
        const item = report2025.items[0];
        expect(item.beginningStock).toBe(0);
        expect(item.inboundQty).toBe(0);
        expect(item.outboundQty).toBe(0);
        expect(item.endingStock).toBe(0);
        expect(item.endingAmount).toBe(0);
        expect(report2025.summary.totalEndingAmount).toBe(0);
        expect(report2025.summary.totalEndingQty).toBe(0);
    });

    it("初仕入期（2026年10月決算期）では期首在庫が0となり、期末在庫が正しく算出される", () => {
        const mockProducts = [
            { id: "p1", name: "商品A", stock: 14, costPrice: 1000, brandId: "b1", supplierId: "s1" } as any,
        ];
        const mockPurchases = [
            { id: "pur1", arrivalDate: "2026-03-17", items: [{ productId: "p1", quantity: 50 }] } as any,
        ];
        const mockMovements = [
            { productId: "p1", type: "in", quantity: 50, date: "2026-03-17" } as any,
            { productId: "p1", type: "out", quantity: 36, date: "2026-04-10" } as any,
        ];

        // 2026年10月決算（2025-11-01 〜 2026-10-31）
        const report2026 = generateFiscalInventoryReport({
            products: mockProducts,
            purchases: mockPurchases,
            stockMovements: mockMovements,
            storeStockMovements: [],
            storeStocks: [],
            startDate: "2025-11-01",
            endDate: "2026-10-31",
        });

        const item = report2026.items[0];
        // 2025年11月1日時点ではまだ仕入前なので期首在庫は0
        expect(item.beginningStock).toBe(0);
        expect(item.endingStock).toBe(14);
        expect(item.endingAmount).toBe(14 * 1000);
        // 会計等式の成立確認
        expect(item.beginningStock + item.inboundQty - item.outboundQty).toBe(item.endingStock);
    });

    it("負の棚卸調整（type: 'adjustment', quantity < 0）がスキップされず期間出庫および期末逆算に反映される", () => {
        // 期首在庫10、期間中入庫20、期間中出庫5、期間中棚卸減耗-3 → 期末22、期末後棚卸減耗-2 → 現在庫20
        const mockProducts = [
            { id: "p1", name: "商品A", stock: 20, costPrice: 500, brandId: "b1", supplierId: "s1" } as any,
        ];
        const mockMovements = [
            { productId: "p1", type: "in", quantity: 10, date: "2025-10-01" } as any,
            { productId: "p1", type: "in", quantity: 20, date: "2026-05-01" } as any,
            { productId: "p1", type: "out", quantity: 5, date: "2026-06-01" } as any,
            { productId: "p1", type: "adjustment", quantity: -3, reason: "audit", date: "2026-10-31" } as any,
            { productId: "p1", type: "adjustment", quantity: -2, reason: "audit", date: "2026-11-10" } as any,
        ];

        const report = generateFiscalInventoryReport({
            products: mockProducts,
            stockMovements: mockMovements,
            storeStockMovements: [],
            storeStocks: [],
            startDate: "2025-11-01",
            endDate: "2026-10-31",
            includeStoreStock: false,
        });

        const item = report.items[0];
        expect(item.endingStock).toBe(22); // 現在庫20 + 期末後減耗2 = 22
        expect(item.inboundQty).toBe(20);
        expect(item.outboundQty).toBe(8); // 通常出庫5 + 棚卸減耗3 = 8
        expect(item.beginningStock).toBe(10); // 22 - 20 + 8 = 10
    });

    it("売上・納品書削除時の取消戻し入庫（type: 'in', reason: 'return'）が入庫を水増しせず出庫から相殺控除される", () => {
        // 期首10、仕入20、売上出庫8、売上削除による戻し3（純出庫5） → 期末25（現在庫25）
        const mockProducts = [
            { id: "p1", name: "商品A", stock: 25, costPrice: 500, brandId: "b1", supplierId: "s1" } as any,
        ];
        const mockMovements = [
            { productId: "p1", type: "in", reason: "purchase", quantity: 10, date: "2025-10-01" } as any,
            { productId: "p1", type: "in", reason: "purchase", quantity: 20, date: "2026-04-01" } as any,
            { productId: "p1", type: "out", reason: "sale", quantity: 8, date: "2026-05-01" } as any,
            { productId: "p1", type: "in", reason: "return", quantity: 3, date: "2026-05-02" } as any,
        ];

        const report = generateFiscalInventoryReport({
            products: mockProducts,
            stockMovements: mockMovements,
            storeStockMovements: [],
            storeStocks: [],
            startDate: "2025-11-01",
            endDate: "2026-10-31",
            includeStoreStock: false,
        });

        const item = report.items[0];
        expect(item.endingStock).toBe(25);
        expect(item.inboundQty).toBe(20); // 23に水増しされない
        expect(item.outboundQty).toBe(5); // 8 - 3 = 5
        expect(item.beginningStock).toBe(10);
    });

    it("全社視点（includeStoreStock: true）で本部から委託店舗への補充移動が社内振替として二重出庫計上されない", () => {
        // 期首0（2026-03初仕入50）、本部→店舗補充20、店舗で12販売（うち2返品取消で純販売10）、本部で直接販売5
        // 本部期末在庫: 50 - 20 - 5 = 25、店舗期末在庫: 20 - 10 = 10 → 全社期末在庫: 35
        // 全社純入庫: 50、全社純出庫: 本部直接販売5 + 店舗純販売10 = 15 (補充20は社内振替のため控除)
        const mockProducts = [
            { id: "p1", name: "商品A", stock: 25, costPrice: 500, brandId: "b1", supplierId: "s1" } as any,
        ];
        const mockStoreStocks = [
            { id: "s1_p1", storeId: "store-a", productId: "p1", stock: 10 } as any,
        ];
        const mockMovements = [
            { productId: "p1", type: "in", reason: "purchase", quantity: 50, date: "2026-03-01" } as any,
            { productId: "p1", type: "out", reason: "manual", quantity: 20, date: "2026-04-01" } as any, // 店舗補充
            { productId: "p1", type: "out", reason: "sale", quantity: 5, date: "2026-05-01" } as any,   // 本部直販
        ];
        const mockStoreMovements = [
            { storeId: "store-a", productId: "p1", type: "in", reason: "restock", quantity: 20, date: "2026-04-01" } as any,
            { storeId: "store-a", productId: "p1", type: "out", reason: "sale", quantity: 12, date: "2026-05-10" } as any,
            { storeId: "store-a", productId: "p1", type: "in", reason: "return", quantity: 2, date: "2026-05-11" } as any,
        ];

        const report = generateFiscalInventoryReport({
            products: mockProducts,
            stockMovements: mockMovements,
            storeStockMovements: mockStoreMovements,
            storeStocks: mockStoreStocks,
            startDate: "2025-11-01",
            endDate: "2026-10-31",
            includeStoreStock: true,
        });

        const item = report.items[0];
        expect(item.mainEndingStock).toBe(25);
        expect(item.storeEndingStock).toBe(10);
        expect(item.endingStock).toBe(35);
        expect(item.outboundQty).toBe(15); // (25 - 20) + (12 - 2) = 15
        expect(item.inboundQty).toBe(50);  // 水増しされない
        expect(item.beginningStock).toBe(0);
    });
});
