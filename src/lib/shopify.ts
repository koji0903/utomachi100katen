// src/lib/shopify.ts

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = "2024-01";

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

async function shopifyFetch(path: string, options: RequestInit = {}) {
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
        throw new Error("Shopify API configuration missing (Domain or Access Token).");
    }

    const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        console.error(`[Shopify API Error] ${path}:`, error);
        throw new Error(error.errors || `Shopify API error: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Shopify から商品情報を取得します
 */
export async function getShopifyProduct(productId: string): Promise<any> {
    const cleanId = productId.replace("gid://shopify/Product/", "");
    const data = await shopifyFetch(`/products/${cleanId}.json`);
    return data.product;
}

/**
 * Shopify から最近の注文一覧を取得します
 */
export async function getShopifyOrders(): Promise<ShopifyOrder[]> {
    const data = await shopifyFetch("/orders.json?status=any&limit=10");
    return data.orders.map((order: any) => ({
        shopifyOrderId: order.id.toString(),
        createdAt: order.created_at,
        financialStatus: order.financial_status,
        totalPrice: parseFloat(order.total_price),
        lineItems: order.line_items.map((item: any) => ({
            variantId: item.variant_id?.toString() || "",
            sku: item.sku || "",
            quantity: item.quantity,
            price: parseFloat(item.price),
        })),
    }));
}

/**
 * Shopify の在庫数を更新します
 * @param variantId gid://shopify/ProductVariant/12345 または 12345
 * @param quantity 在庫数
 */
export async function updateShopifyInventory(variantId: string, quantity: number) {
    const cleanVariantId = variantId.replace("gid://shopify/ProductVariant/", "");
    
    // 1. バリアント情報を取得して inventory_item_id を特定
    const variantData = await shopifyFetch(`/variants/${cleanVariantId}.json`);
    const inventoryItemId = variantData.variant.inventory_item_id;

    // 2. ロケーションIDを取得 (最初の有効なロケーションを使用)
    const locationsData = await shopifyFetch("/locations.json");
    const locationId = locationsData.locations[0]?.id;

    if (!locationId) throw new Error("No Shopify locations found.");

    // 3. 在庫数を設定
    await shopifyFetch("/inventory_levels/set.json", {
        method: "POST",
        body: JSON.stringify({
            location_id: locationId,
            inventory_item_id: inventoryItemId,
            available: quantity,
        }),
    });

    return true;
}
