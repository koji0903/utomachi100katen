// src/lib/amazon.ts

/**
 * Amazon SP-API Integration Utility (Mock Implementation)
 * 
 * TODO: 実運用の際は 'amazon-sp-api' などのライブラリを使用し、
 * LWA (Login with Amazon) トークン交換フローを実装する必要があります。
 */

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
 * Amazon SP-API から商品情報を取得します
 * @param asin ASIN
 */
export async function getAmazonProduct(asin: string): Promise<AmazonProduct | null> {
    console.log(`[Amazon] Fetching product: ${asin}`);

    // モックデータ: 実際は SP-API の Listings Items API などを使用
    return {
        asin,
        sku: `SKU-${asin}`,
        inventoryLevel: Math.floor(Math.random() * 100),
        price: 2500,
    };
}

/**
 * Amazon SP-API から注文一覧を取得します
 */
export async function getAmazonOrders(): Promise<AmazonOrder[]> {
    console.log(`[Amazon] Fetching latest orders...`);

    // モックデータ: 実際は SP-API の Orders API を使用
    return [
        {
            amazonOrderId: "503-1234567-1234567",
            purchaseDate: new Date().toISOString(),
            orderStatus: "Unshipped",
            totalAmount: 5000,
            items: [
                { sku: "SKU-B00XXXXXXX", quantity: 2, price: 2500 }
            ]
        }
    ];
}

/**
 * Amazon の在庫数を更新します (Sync)
 */
export async function updateAmazonInventory(sku: string, quantity: number) {
    console.log(`[Amazon] Updating inventory for ${sku} to ${quantity}`);
    // 実際は SP-API の Listings Items API または JSON Interchange を使用
    return true;
}
