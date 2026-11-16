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
        // p1: 2026-10-15 に入庫 15 (期間内), 2026-10-25 に出庫 5 (期間内), 2026-11-05 に出庫 2 (期末後)
        // 現在庫が 10 なので、期末時点(2026-10-31)の在庫は 10 + 2 = 12
        // 期間中入庫 15、期間中出庫 5 なので、期首在庫は 12 - 15 + 5 = 2
        const mockMovements = [
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
});
