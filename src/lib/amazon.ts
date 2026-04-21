// src/lib/amazon.ts

/**
 * Amazon SP-API Integration Utility
 * LWA (Login with Amazon) トークン交換フローおよび Orders API を使用。
 */

const SP_API_REGION_ENDPOINT = process.env.AMAZON_USE_SANDBOX === "true"
    ? "https://sandbox.sellingpartnerapi-fe.amazon.com"
    : "https://sellingpartnerapi-fe.amazon.com"; // Far East (Japan)
const LWA_ENDPOINT = "https://api.amazon.com/auth/o2/token";
const MARKETPLACE_ID_JP = "A1VC38T7YXB528"; // Amazon.co.jp

export interface AmazonProduct {
    asin: string;
    sku: string;
    inventoryLevel: number;
    price: number;
}

export interface AmazonOrder {
    amazonOrderId: string;
    purchaseDate: string;
    orderStatus: string;
    totalAmount: number;
    items: {
        sku: string;
        quantity: number;
        price: number;
    }[];
}

/**
 * LWA (Login with Amazon) からアクセストークンを取得します
 */
async function getAccessToken(): Promise<string> {
    const clientId = process.env.AMAZON_APP_CLIENT_ID;
    const clientSecret = process.env.AMAZON_APP_CLIENT_SECRET;
    const refreshToken = process.env.AMAZON_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Amazon API 認証情報が設定されていません。(.env.local を確認してください)");
    }

    const response = await fetch(LWA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Amazon LWA Token Error: ${errorData.error_description || response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Amazon SP-API から商品詳細を取得します
 * Listings Items API (2021-08-01) を使用
 */
export async function getAmazonProduct(sku: string): Promise<AmazonProduct | null> {
    try {
        const accessToken = await getAccessToken();
        const sellerId = process.env.AMAZON_SELLER_ID;
        const trimmedSku = sku.trim();

        if (!sellerId) throw new Error("AMAZON_SELLER_ID が未設定です。");

        const url = `${SP_API_REGION_ENDPOINT}/listings/2021-08-01/items/${sellerId}/${trimmedSku}?marketplaceIds=${MARKETPLACE_ID_JP}&includedData=summaries,attributes`;
        
        console.log(`[Amazon] Fetching product listing (SKU): ${trimmedSku}`);

        const response = await fetch(url, {
            headers: {
                "x-amz-access-token": accessToken,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Listings API Error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        const summary = data.summaries?.[0];
        const attributes = data.attributes || {};

        // 価格情報の抽出 (製品タイプによってパスが異なる場合があるため、汎用的なパスを試行)
        let price = 0;
        const purchasableOffer = attributes.purchasable_offer?.[0];
        if (purchasableOffer?.our_price?.[0]?.schedule?.[0]?.value_with_tax) {
            price = purchasableOffer.our_price[0].schedule[0].value_with_tax;
        } else if (attributes.list_price?.[0]?.value_with_tax) {
            price = attributes.list_price[0].value_with_tax;
        }

        // 在庫情報の抽出
        let inventoryLevel = 0;
        const fulfillmentAvailability = attributes.fulfillment_availability?.[0];
        if (fulfillmentAvailability?.quantity !== undefined) {
            inventoryLevel = fulfillmentAvailability.quantity;
        }

        return {
            asin: summary?.asin || "",
            sku: sku,
            inventoryLevel: inventoryLevel,
            price: price,
        };
    } catch (error) {
        console.error("[Amazon Product Error]", error);
        return null;
    }
}

/**
 * Amazon SP-API から最新の注文一覧を取得します
 */
export async function getAmazonOrders(): Promise<AmazonOrder[]> {
    try {
        const accessToken = await getAccessToken();
        
        // 直近1週間（7日間）の注文を取得
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        // SP-API expects ISO 8601 without milliseconds, e.g., 2026-04-14T01:21:20Z
        const createdAfter = oneWeekAgo.toISOString().split('.')[0] + 'Z';

        const queryParams = new URLSearchParams();
        queryParams.append('MarketplaceIds', MARKETPLACE_ID_JP);
        queryParams.append('CreatedAfter', createdAfter);
        
        // Use commas in a single encode as standard for SP-API
        queryParams.append('OrderStatuses', 'Unshipped,PartiallyShipped,Shipped');

        // AWS API Gateway (SP-API) often requires commas to be UNENCODED to correctly parse them as an array.
        // It treats %2C as a single continuous string and fails the enum validation.
        const queryString = queryParams.toString().replace(/%2C/g, ',');
        const url = `${SP_API_REGION_ENDPOINT}/orders/v0/orders?${queryString}`;
        
        console.log(`[Amazon] Fetching orders URL: ${url}`);

        const response = await fetch(url, {
            headers: {
                "x-amz-access-token": accessToken,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Orders API Error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        const orders = data.payload?.Orders || [];

        const formattedOrders: AmazonOrder[] = [];

        for (const order of orders) {
            // 各注文のアイテム詳細を取得
            const itemsUrl = `${SP_API_REGION_ENDPOINT}/orders/v0/orders/${order.AmazonOrderId}/orderItems`;
            const itemsRes = await fetch(itemsUrl, {
                headers: { "x-amz-access-token": accessToken }
            });

            const itemsData = await itemsRes.json();
            const items = itemsData.payload?.OrderItems || [];

            formattedOrders.push({
                amazonOrderId: order.AmazonOrderId,
                purchaseDate: order.PurchaseDate,
                orderStatus: order.OrderStatus,
                totalAmount: parseFloat(order.OrderTotal?.Amount || "0"),
                items: items.map((item: any) => ({
                    sku: item.SellerSKU,
                    quantity: item.QuantityOrdered,
                    price: parseFloat(item.ItemPrice?.Amount || "0")
                }))
            });
        }

        return formattedOrders;
    } catch (error) {
        console.error("[Amazon Orders Error]", error);
        return [];
    }
}

/**
 * Amazon の出品情報を更新します (在庫および価格)
 * Listings Items API (2021-08-01) を使用します。
 */
export async function updateAmazonListing(sku: string, quantity?: number, price?: number) {
    try {
        const accessToken = await getAccessToken();
        const sellerId = process.env.AMAZON_SELLER_ID;
        const productType = process.env.AMAZON_PRODUCT_TYPE || "PRODUCT"; // デフォルト
        
        if (!sellerId) throw new Error("AMAZON_SELLER_ID が未設定です。");

        const url = `${SP_API_REGION_ENDPOINT}/listings/2021-08-01/items/${sellerId}/${sku}?marketplaceIds=${MARKETPLACE_ID_JP}`;
        
        const patches = [];

        // 在庫数のパッチ
        if (quantity !== undefined) {
            patches.push({
                op: "replace",
                path: "/attributes/fulfillment_availability",
                value: [{
                    fulfillment_channel_code: "DEFAULT",
                    quantity: quantity
                }]
            });
        }

        // 価格のパッチ
        if (price !== undefined) {
            patches.push({
                op: "replace",
                path: "/attributes/purchasable_offer",
                value: [{
                    our_price: [{
                        schedule: [{
                            value_with_tax: price,
                            currency: "JPY"
                        }]
                    }]
                }]
            });
        }

        if (patches.length === 0) return true;

        console.log(`[Amazon] Updating listing for ${sku}: quantity=${quantity}, price=${price}`);

        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                "x-amz-access-token": accessToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                productType: productType,
                patches: patches
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Listing Patch API Error: ${JSON.stringify(error)}`);
        }

        return true;
    } catch (error) {
        console.error("[Amazon Listing Sync Error]", error);
        return false;
    }
}

// 既存の互換性のためのエイリアス
export const updateAmazonInventory = (sku: string, quantity: number) => updateAmazonListing(sku, quantity);
