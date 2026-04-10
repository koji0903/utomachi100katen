// src/lib/square.ts

const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_ENV = process.env.SQUARE_ENVIRONMENT || 'production';
const BASE_URL = SQUARE_ENV === 'production' 
    ? "https://connect.squareup.com/v2" 
    : "https://connect.squareupsandbox.com/v2";

export interface SquareOrder {
    id: string;
    locationId: string;
    createdAt: string;
    totalMoney: {
        amount: number;
        currency: string;
    };
    lineItems: {
        uid: string;
        catalogObjectId?: string;
        name: string;
        quantity: string;
        basePriceMoney: {
            amount: number;
            currency: string;
        };
        variationName?: string;
    }[];
    state: string;
}

export interface SquareInventoryCount {
    catalogObjectId: string;
    quantity: number;
    locationId: string;
    updatedAt: string;
}

async function squareFetch(path: string, options: RequestInit = {}) {
    if (!SQUARE_ACCESS_TOKEN) {
        throw new Error("Square API configuration missing (Access Token).");
    }

    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SQUARE_ACCESS_TOKEN}`,
            "Square-Version": "2024-01-18",
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        console.error(`[Square API Error] ${path}:`, error);
        throw new Error(error.errors?.[0]?.detail || `Square API error: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Square から注文一覧を取得します (ページネーション対応)
 */
export async function getSquareOrders(locationId: string, beginTime?: string): Promise<SquareOrder[]> {
    let allOrders: SquareOrder[] = [];
    let cursor: string | undefined = undefined;

    do {
        const body: any = {
            location_ids: [locationId],
            query: {
                filter: {
                    state_filter: { states: ["COMPLETED"] }
                },
                sort: {
                    sort_field: "CREATED_AT",
                    sort_order: "DESC"
                }
            }
        };

        if (beginTime) {
            body.query.filter.date_time_filter = {
                created_at: { start_at: beginTime }
            };
        }

        if (cursor) {
            body.cursor = cursor;
        }

        const data = await squareFetch("/orders/search", {
            method: "POST",
            body: JSON.stringify(body)
        });

        const pageOrders = (data.orders || []).map((order: any) => ({
            id: order.id,
            locationId: order.location_id,
            createdAt: order.created_at,
            totalMoney: order.total_money,
            lineItems: (order.line_items || []).map((item: any) => ({
                uid: item.uid,
                catalogObjectId: item.catalog_object_id,
                name: item.name,
                quantity: item.quantity,
                basePriceMoney: item.base_price_money,
                variationName: item.variation_name
            })),
            state: order.state
        }));

        allOrders = [...allOrders, ...pageOrders];
        cursor = data.cursor;

        // 安全策: あまりに膨大な場合はループを抜ける (1000件程度)
        if (allOrders.length > 1000) break;

    } while (cursor);

    return allOrders;
}


/**
 * Square の在庫数を一括で設定します (PHYSICAL_COUNT)
 * @param locationId 
 * @param updates { catalogObjectId: string, quantity: number }[]
 */
export async function updateSquareInventory(locationId: string, updates: { catalogObjectId: string, quantity: number }[]) {
    if (updates.length === 0) return true;

    const idempotencyKey = crypto.randomUUID();
    const now = new Date().toISOString();

    const changes = updates.map(update => ({
        type: "PHYSICAL_COUNT",
        physical_count: {
            catalog_object_id: update.catalogObjectId,
            location_id: locationId,
            state: "IN_STOCK",
            quantity: update.quantity.toString(),
            occurred_at: now
        }
    }));

    await squareFetch("/inventory/changes/batch-create", {
        method: "POST",
        body: JSON.stringify({
            idempotency_key: idempotencyKey,
            changes
        })
    });

    return true;
}

/**
 * Square の現在の在庫数を取得します
 */
export async function getSquareInventoryCounts(locationId: string, catalogObjectIds: string[]): Promise<SquareInventoryCount[]> {
    if (catalogObjectIds.length === 0) return [];

    const data = await squareFetch("/inventory/counts/batch-retrieve", {
        method: "POST",
        body: JSON.stringify({
            location_ids: [locationId],
            catalog_object_ids: catalogObjectIds
        })
    });

    return (data.counts || []).map((count: any) => ({
        catalogObjectId: count.catalog_object_id,
        quantity: parseFloat(count.quantity),
        locationId: count.location_id,
        updatedAt: count.calculated_at
    }));
}

/**
 * JANコードから Square Catalog Object を検索します
 */
export async function findSquareCatalogByJan(janCode: string): Promise<any | null> {
    const data = await squareFetch("/catalog/search", {
        method: "POST",
        body: JSON.stringify({
            query: {
                exact_query: {
                    attribute_name: "sku", // Square では SKU フィールドに JAN を入れるのが一般的
                    attribute_value: janCode
                }
            },
            types: ["ITEM_VARIATION"]
        })
    });

    return data.objects?.[0] || null;
}
