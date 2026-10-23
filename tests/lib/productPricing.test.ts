import { describe, expect, it } from "vitest";
import type { RetailStore } from "@/lib/store";
import { fillMissingStorePrices, recalculateStorePrices } from "@/lib/productPricing";

const stores: RetailStore[] = [
    { id: "consignment", name: "委託店", type: "A", pricingRule: 10, wholesaleRate: 70 },
    { id: "wholesale", name: "卸売店", type: "B", pricingRule: 0, wholesaleRate: 60 },
];

describe("productPricing", () => {
    it("未設定の販売先価格だけを補完し、手動設定は上書きしない", () => {
        const result = fillMissingStorePrices(
            1000,
            stores,
            [{ storeId: "consignment", price: 1234 }],
            [{ storeId: "wholesale", price: 555 }],
        );

        expect(result.changed).toBe(true);
        expect(result.storePrices).toEqual([
            { storeId: "consignment", price: 1234 },
            { storeId: "wholesale", price: 1000 },
        ]);
        expect(result.storeWholesalePrices).toEqual([
            { storeId: "wholesale", price: 555 },
            { storeId: "consignment", price: 700 },
        ]);
    });

    it("明示的な再計算では店舗ルールから全価格を作り直す", () => {
        expect(recalculateStorePrices(1000, stores)).toEqual({
            storePrices: [
                { storeId: "consignment", price: 1100 },
                { storeId: "wholesale", price: 1000 },
            ],
            storeWholesalePrices: [
                { storeId: "consignment", price: 700 },
                { storeId: "wholesale", price: 600 },
            ],
        });
    });

    it("ゴミ箱の販売先は価格設定対象から除外する", () => {
        const result = recalculateStorePrices(1000, [
            ...stores,
            { id: "deleted", name: "削除済み", isTrashed: true },
        ]);

        expect(result.storePrices.map(entry => entry.storeId)).not.toContain("deleted");
        expect(result.storeWholesalePrices.map(entry => entry.storeId)).not.toContain("deleted");
    });
});
