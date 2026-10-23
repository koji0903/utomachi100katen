import { describe, expect, it } from "vitest";
import {
    diffInventoryEffects,
    getDailyReportInventoryEffects,
    getPurchaseInventoryEffects,
    getSaleInventoryEffects,
    normalizeSaleTotals,
} from "@/lib/inventoryConsistency";

describe("inventoryConsistency", () => {
    it("部分入荷の更新は前回との差分だけを返す", () => {
        const previous = getPurchaseInventoryEffects({
            status: "partially_received",
            items: [{ productId: "p1", quantity: 10, receivedQuantity: 3 }],
        });
        const next = getPurchaseInventoryEffects({
            status: "partially_received",
            items: [{ productId: "p1", quantity: 10, receivedQuantity: 7 }],
        });

        expect(diffInventoryEffects(previous, next)).toEqual([
            { scope: "main", productId: "p1", quantity: 4 },
        ]);
    });

    it("仕入の削除は入荷済み数量を差し戻す", () => {
        const active = getPurchaseInventoryEffects({
            status: "received",
            items: [{ productId: "p1", quantity: 5, receivedQuantity: 5 }],
        });
        const trashed = getPurchaseInventoryEffects({
            status: "received",
            isTrashed: true,
            items: [{ productId: "p1", quantity: 5, receivedQuantity: 5 }],
        });

        expect(diffInventoryEffects(active, trashed)[0].quantity).toBe(-5);
    });

    it("委託販売は店舗在庫、卸・直営販売は本部在庫を減らす", () => {
        const products = [{ id: "p1" }];
        const stores = [{ id: "a", type: "A" }, { id: "b", type: "B" }];

        expect(getSaleInventoryEffects({ storeId: "a", items: [{ productId: "p1", quantity: 2 }] }, products, stores)).toEqual([
            { scope: "store", storeId: "a", productId: "p1", quantity: -2 },
        ]);
        expect(getSaleInventoryEffects({ storeId: "b", items: [{ productId: "p1", quantity: 2 }] }, products, stores)).toEqual([
            { scope: "main", storeId: undefined, productId: "p1", quantity: -2 },
        ]);
    });

    it("セット商品は構成品ごとの在庫差分に展開する", () => {
        const effects = getSaleInventoryEffects(
            { storeId: "direct", items: [{ productId: "set", quantity: 3 }] },
            [{ id: "set", isComposite: true, components: [{ productId: "p1", quantity: 2 }, { productId: "p2", quantity: 1 }] }],
            [{ id: "direct", type: "C" }],
        );

        expect(effects).toEqual([
            { scope: "main", storeId: undefined, productId: "p1", quantity: -6 },
            { scope: "main", storeId: undefined, productId: "p2", quantity: -3 },
        ]);
    });

    it("在庫調整をスキップした売上の空スナップショットを再計算しない", () => {
        expect(getSaleInventoryEffects(
            { storeId: "direct", items: [{ productId: "p1", quantity: 2 }], inventoryEffects: [] },
            [{ id: "p1" }],
            [{ id: "direct", type: "C" }],
        )).toEqual([]);
    });

    it("外部連携由来の欠落した売上合計を明細から補完する", () => {
        expect(normalizeSaleTotals({
            items: [
                { quantity: 2, subtotal: 1000, commission: 100, netProfit: 900 },
                { quantity: 1, subtotal: 600, commission: 0 },
            ],
        })).toMatchObject({
            totalQuantity: 3,
            totalAmount: 1600,
            totalCommission: 100,
            totalNetProfit: 1500,
        });
    });

    it("日報補充は委託先だけ本部から店舗へ振り替え、直営・卸では二重減算しない", () => {
        const report = {
            type: "store",
            storeId: "store-a",
            restocking: [{ productId: "p1", qty: 4 }],
            promotions: [{ productId: "p2", qty: 1 }],
        };

        expect(getDailyReportInventoryEffects(report, [{ id: "store-a", type: "A" }])).toEqual([
            { scope: "main", productId: "p1", quantity: -4 },
            { scope: "store", storeId: "store-a", productId: "p1", quantity: 4 },
            { scope: "main", productId: "p2", quantity: -1 },
        ]);
        expect(getDailyReportInventoryEffects(report, [{ id: "store-a", type: "C" }])).toEqual([
            { scope: "main", productId: "p2", quantity: -1 },
        ]);
    });
});
