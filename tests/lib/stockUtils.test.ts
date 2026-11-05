import { describe, it, expect } from "vitest";
import { calculateDaysRemaining, getStockoutStatus, getProductStockBreakdown } from "@/lib/stockUtils";
import { Product, Sale } from "@/lib/store";

describe("calculateDaysRemaining", () => {
    const dummyProduct: Product = {
        id: "prod_1",
        name: "テスト商品",
        stock: 30,
        sellingPrice: 1000,
        costPrice: 500,
        supplierId: "sup_1",
        brandId: "brand_1",
        taxRate: "standard",
        createdAt: "2026-01-01"
    };

    it("在庫が0の場合は0を返す", () => {
        const p = { ...dummyProduct, stock: 0 };
        expect(calculateDaysRemaining(p, [])).toBe(0);
    });

    it("売上データがない場合はInfinityを返す", () => {
        expect(calculateDaysRemaining(dummyProduct, [])).toBe(Infinity);
    });

    it("直近30日の日次売上に基づいて日数を正しく計算する", () => {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        const sales: Sale[] = [
            {
                id: "sale_1",
                storeId: "store_1",
                period: todayStr,
                type: "daily",
                totalAmount: 30000,
                totalQuantity: 30,
                totalCommission: 0,
                totalNetProfit: 15000,
                items: [
                    { productId: "prod_1", quantity: 30, priceAtSale: 1000, subtotal: 30000, commission: 0, netProfit: 15000 }
                ]
            }
        ];

        // 30個 / 30日 = 1日あたり1個。在庫30個なので30日分
        expect(calculateDaysRemaining(dummyProduct, sales)).toBe(30);
    });

    it("ゴミ箱に入っている売上データ(isTrashed: true)は計算から除外される", () => {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        const sales: Sale[] = [
            {
                id: "sale_trashed",
                storeId: "store_1",
                period: todayStr,
                type: "daily",
                totalAmount: 30000,
                totalQuantity: 30,
                totalCommission: 0,
                totalNetProfit: 15000,
                isTrashed: true,
                items: [
                    { productId: "prod_1", quantity: 30, priceAtSale: 1000, subtotal: 30000, commission: 0, netProfit: 15000 }
                ]
            }
        ];

        expect(calculateDaysRemaining(dummyProduct, sales)).toBe(Infinity);
    });

    it("セット商品の売上も構成品の消費として計算される", () => {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        // セット商品：prod_1 を 2個 含む
        const setProduct: Product = {
            id: "set_prod",
            name: "ギフトセット",
            brandId: "brand_1",
            supplierId: "sup_1",
            costPrice: 1000,
            sellingPrice: 3000,
            stock: 10,
            taxRate: "standard",
            isComposite: true,
            components: [
                { productId: "prod_1", quantity: 2 }
            ],
            createdAt: todayStr
        };

        // セット商品が15個売れた（＝ prod_1 は 30個 消費）
        const sales: Sale[] = [
            {
                id: "sale_set",
                storeId: "store_1",
                period: todayStr,
                type: "daily",
                totalAmount: 45000,
                totalQuantity: 15,
                totalCommission: 0,
                totalNetProfit: 20000,
                items: [
                    { productId: "set_prod", quantity: 15, priceAtSale: 3000, subtotal: 45000, commission: 0, netProfit: 20000 }
                ]
            }
        ];

        // dummyProduct.stock = 30. セット販売で 15 * 2 = 30個 消費 / 30日 = 1日あたり1個。在庫30個なので30日分
        expect(calculateDaysRemaining(dummyProduct, sales, [dummyProduct, setProduct])).toBe(30);
    });
});

describe("getStockoutStatus", () => {
    it("0日なら在庫切れ", () => {
        expect(getStockoutStatus(0).label).toBe("在庫切れ");
    });

    it("3日以内なら直近で欠品予報", () => {
        expect(getStockoutStatus(3).label).toBe("直近で欠品予報");
    });

    it("Infinityなら動きなし", () => {
        expect(getStockoutStatus(Infinity).label).toBe("動きなし");
    });

    it("十分な在庫があれば残り日数を表示", () => {
        expect(getStockoutStatus(20).label).toBe("残り約20日分");
    });

    it("本社在庫が0でも店頭在庫がある場合は適切な警告を返す", () => {
        expect(getStockoutStatus(15, true).label).toBe("店頭在庫あり（本社要補充）");
    });
});

describe("getProductStockBreakdown", () => {
    it("本社倉庫在庫と各店舗の店頭在庫を合算して全社総在庫を正しく算出する", () => {
        const dummyProduct: Product = {
            id: "prod_1",
            name: "テスト商品",
            stock: 10, // 本社倉庫に10個
            sellingPrice: 1000,
            costPrice: 500,
            supplierId: "sup_1",
            brandId: "brand_1",
            taxRate: "standard",
            createdAt: "2026-01-01"
        };

        const storeStocks = [
            { storeId: "store_1", productId: "prod_1", stock: 15 },
            { storeId: "store_2", productId: "prod_1", stock: 25 },
            { storeId: "store_1", productId: "other_prod", stock: 99 },
        ];

        const retailStores = [
            { id: "store_1", name: "宇土マリーナ直売所" },
            { id: "store_2", name: "熊本駅店" },
        ];

        const breakdown = getProductStockBreakdown(dummyProduct, storeStocks, retailStores);

        expect(breakdown.mainStock).toBe(10);
        expect(breakdown.storeStockTotal).toBe(40); // 15 + 25
        expect(breakdown.totalStock).toBe(50); // 10 + 40
        expect(breakdown.storeStocks.length).toBe(2);
        expect(breakdown.storeStocks[0].storeName).toBe("宇土マリーナ直売所");
        expect(breakdown.storeStocks[0].stock).toBe(15);
    });
});
