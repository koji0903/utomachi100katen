// src/lib/shopify.ts

/**
 * Shopify Admin API Integration Utility (Mock Implementation)
 * 
 * TODO: 実運用の際は 'shopify-api-node' などのライブラリを使用し、
 * Shopify Admin API のアクセストークンを用いた認証を実装する必要があります。
 */

export interface ShopifyProduct {
    id: string;
    variantId: string;
    inventoryLevel: number;
    price: number;
}

export interface ShopifyOrder {
    shopifyOrderId: string;
    createdAt: string;
    financialStatus: string;
    totalPrice: number;
    lineItems: {
        variantId: string;
        sku: string;
        quantity: number;
        price: number;
    }[];
}

/**
 * Shopify から商品情報を取得します
 * @param productId Shopify商品ID
 */
export async function getShopifyProduct(productId: string): Promise<ShopifyProduct | null> {
    console.log(`[Shopify] Fetching product: ${productId}`);

    // モックデータ: 実際は Shopify Admin API の Product / Variant API を使用
    return {
        id: productId,
        variantId: `VAR-${productId}`,
        inventoryLevel: Math.floor(Math.random() * 100),
        price: 3200,
    };
}

/**
 * Shopify から注文一覧を取得します
 */
export async function getShopifyOrders(): Promise<ShopifyOrder[]> {
    console.log(`[Shopify] Fetching latest orders...`);

    // モックデータ: 実際は Shopify Admin API の Order API を使用
    return [
        {
            shopifyOrderId: "SHP-1001",
            createdAt: new Date().toISOString(),
            financialStatus: "paid",
            totalPrice: 6400,
            lineItems: [
                { variantId: "VAR-GID-123", sku: "SKU-SHOPIFY-001", quantity: 2, price: 3200 }
            ]
        }
    ];
}

/**
 * Shopify の在庫数を更新します (Sync)
 */
export async function updateShopifyInventory(variantId: string, quantity: number) {
    console.log(`[Shopify] Updating inventory for variant ${variantId} to ${quantity}`);
    // 実際は Shopify Admin API の InventoryLevel API を使用
    return true;
}
