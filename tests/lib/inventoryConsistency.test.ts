import { describe, expect, it } from "vitest";
import {
    PURCHASE_STATUS_ORDER,
    diffInventoryEffects,
    getDailyReportInventoryEffects,
    getDeliveryNoteInventoryEffects,
    getPersistedDeliveryNoteInventoryEffects,
    getPurchaseInventoryEffects,
    getSaleInventoryEffects,
    mergePurchaseItemUpdate,
    normalizeSaleTotals,
} from "@/lib/inventoryConsistency";

describe("inventoryConsistency", () => {
    it("納品書は下書きでは在庫を動かさず、発行時だけ出庫する", () => {
        const base = {
            type: "delivery_note",
            details: [{ productId: "p1", quantity: 3 }],
        };

        expect(getDeliveryNoteInventoryEffects({ ...base, status: "draft" }, [{ id: "p1" }], [])).toEqual([]);
        expect(getDeliveryNoteInventoryEffects({ ...base, status: "issued" }, [{ id: "p1" }], [])).toEqual([
            { scope: "main", productId: "p1", quantity: -3 },
        ]);
    });

    it("納品書の複製下書きは在庫を二重に減らさない", () => {
        const issued = getDeliveryNoteInventoryEffects({
            type: "delivery_note",
            status: "issued",
            details: [{ productId: "p1", quantity: 2 }],
        }, [{ id: "p1" }], []);
        const duplicateDraft = getDeliveryNoteInventoryEffects({
            type: "delivery_note",
            status: "draft",
            details: [{ productId: "p1", quantity: 2 }],
        }, [{ id: "p1" }], []);

        expect(diffInventoryEffects(issued, issued)).toEqual([]);
        expect(duplicateDraft).toEqual([]);
    });

    it("納品書の削除・復元は保存済みの在庫影響を正確に差し戻す", () => {
        const active = {
            type: "delivery_note",
            status: "issued",
            inventoryEffects: [{ scope: "main" as const, productId: "component", quantity: -6 }],
            details: [{ productId: "set", quantity: 2 }],
        };
        const activeEffects = getDeliveryNoteInventoryEffects(active, [], []);
        const trashedEffects = getDeliveryNoteInventoryEffects({ ...active, isTrashed: true }, [], []);

        expect(diffInventoryEffects(activeEffects, trashedEffects)).toEqual([
            { scope: "main", productId: "component", quantity: 6 },
        ]);
        expect(diffInventoryEffects(trashedEffects, activeEffects)).toEqual(activeEffects);
    });

    it("委託先連携または明示的なスキップ指定がある納品書は在庫を減らさない", () => {
        const doc = {
            type: "delivery_note",
            status: "issued",
            storeId: "wholesale",
            details: [{ productId: "p1", quantity: 3 }],
        };
        const products = [{ id: "p1" }];

        expect(getDeliveryNoteInventoryEffects(doc, products, [
            { id: "wholesale", linkedConsignmentStoreId: "consignment" },
        ])).toEqual([]);
        expect(getDeliveryNoteInventoryEffects({ ...doc, skipInventoryAdjustment: true }, products, [])).toEqual([]);
    });

    it("在庫履歴のない旧納品書は編集時に遡って在庫へ反映しない", () => {
        const legacy = {
            type: "delivery_note",
            status: "issued",
            details: [{ productId: "p1", quantity: 20 }],
        };
        const products = [{ id: "p1" }];

        expect(getPersistedDeliveryNoteInventoryEffects(legacy, products, [], false)).toEqual([]);
        expect(getPersistedDeliveryNoteInventoryEffects(legacy, products, [], true)).toEqual([
            { scope: "main", productId: "p1", quantity: -20 },
        ]);
    });

    it("即時仕入で発注数を変更した場合は入荷数も同じ数量へ同期する", () => {
        const item = mergePurchaseItemUpdate(
            { productId: "p1", quantity: 1, receivedQuantity: 1, unitCost: 100, totalCost: 100 },
            { quantity: 10 },
            true,
        );

        expect(item).toMatchObject({ quantity: 10, receivedQuantity: 10 });
        expect(getPurchaseInventoryEffects({ status: "received", items: [item] })).toEqual([
            { scope: "main", productId: "p1", quantity: 10 },
        ]);
    });

    it("部分入荷で発注数を減らした場合は入荷数が発注数を超えないよう補正する", () => {
        expect(mergePurchaseItemUpdate(
            { productId: "p1", quantity: 10, receivedQuantity: 7, unitCost: 100, totalCost: 1000 },
            { quantity: 5 },
            false,
        )).toMatchObject({ quantity: 5, receivedQuantity: 5 });
    });

    it("仕入ステータスは仕入待ちの後に部分入荷、仕入済みへ進む", () => {
        expect(PURCHASE_STATUS_ORDER).toEqual([
            "ordered_pending",
            "ordered",
            "waiting",
            "partially_received",
            "received",
            "paid",
        ]);
        const partialIndex = PURCHASE_STATUS_ORDER.indexOf("partially_received");
        expect(PURCHASE_STATUS_ORDER[partialIndex + 1]).toBe("received");
    });

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

    it("売上編集で店舗と個数を同時変更した場合は旧店舗へ戻し、新しい在庫だけを減らす", () => {
        const products = [{ id: "p1" }];
        const stores = [{ id: "consignment", type: "A" }, { id: "direct", type: "C" }];
        const previous = getSaleInventoryEffects(
            { storeId: "consignment", items: [{ productId: "p1", quantity: 2 }] },
            products,
            stores,
        );
        const next = getSaleInventoryEffects(
            { storeId: "direct", items: [{ productId: "p1", quantity: 5 }] },
            products,
            stores,
        );

        expect(diffInventoryEffects(previous, next)).toEqual([
            { scope: "store", storeId: "consignment", productId: "p1", quantity: 2 },
            { scope: "main", storeId: undefined, productId: "p1", quantity: -5 },
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
