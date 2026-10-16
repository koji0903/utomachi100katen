import { describe, it, expect } from "vitest";
import { calculateDaysRemaining, getStockoutStatus } from "@/lib/stockUtils";
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
});
