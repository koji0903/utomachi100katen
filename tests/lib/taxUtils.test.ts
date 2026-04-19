import { describe, it, expect } from "vitest";
import {
    applyRounding,
    calcTax,
    summarizeTaxByRate,
    TAX_RATES,
} from "@/lib/taxUtils";

describe("applyRounding", () => {
    it("floor は切り捨て", () => {
        expect(applyRounding(1.9, "floor")).toBe(1);
    });
    it("ceil は切り上げ", () => {
        expect(applyRounding(1.1, "ceil")).toBe(2);
    });
    it("round は四捨五入", () => {
        expect(applyRounding(1.5, "round")).toBe(2);
        expect(applyRounding(1.4, "round")).toBe(1);
    });
});

describe("calcTax", () => {
    it("標準税率 10% の税額と合計が正しい", () => {
        const r = calcTax(1000, "standard", "floor");
        expect(r.taxRate).toBeCloseTo(TAX_RATES.standard);
        expect(r.taxAmount).toBe(100);
        expect(r.total).toBe(1100);
    });

    it("軽減税率 8% で端数が切り捨てされる", () => {
        const r = calcTax(123, "reduced", "floor");
        // 123 * 0.08 = 9.84 → floor → 9
        expect(r.taxAmount).toBe(9);
        expect(r.total).toBe(132);
    });
});

describe("summarizeTaxByRate", () => {
    it("税抜(exclusive) で標準・軽減の合計が正しく計算される", () => {
        const r = summarizeTaxByRate(
            [
                { amount: 1000, rateType: "standard" },
                { amount: 500, rateType: "reduced" },
            ],
            "floor",
            "exclusive"
        );
        expect(r.standard.subtotal).toBe(1000);
        expect(r.standard.taxAmount).toBe(100);
        expect(r.reduced.subtotal).toBe(500);
        expect(r.reduced.taxAmount).toBe(40);
        expect(r.grandTotal).toBe(1640);
        expect(r.totalTax).toBe(140);
    });

    it("rateType 未指定は standard として扱われる", () => {
        const r = summarizeTaxByRate(
            [{ amount: 1000 }],
            "floor",
            "exclusive"
        );
        expect(r.standard.subtotal).toBe(1000);
        expect(r.reduced.subtotal).toBe(0);
    });
});
