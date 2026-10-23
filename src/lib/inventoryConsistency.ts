export type InventoryEffect = {
    scope: "main" | "store";
    productId: string;
    quantity: number;
    storeId?: string;
};

type PurchaseLike = {
    status: string;
    isTrashed?: boolean;
    items?: Array<{
        productId: string;
        quantity: number;
        receivedQuantity?: number;
    }>;
};

type ProductLike = {
    id: string;
    isComposite?: boolean;
    components?: Array<{ productId: string; quantity: number }>;
};

type StoreLike = {
    id: string;
    type?: string;
};

type SaleLike = {
    storeId: string;
    isTrashed?: boolean;
    items?: Array<{ productId: string; quantity: number }>;
    inventoryEffects?: InventoryEffect[];
};

type SaleTotalsLike = {
    items?: Array<{
        quantity?: number;
        subtotal?: number;
        commission?: number;
        netProfit?: number;
    }>;
    totalQuantity?: number;
    totalAmount?: number;
    totalCommission?: number;
    totalNetProfit?: number;
};

type DailyReportLike = {
    type: string;
    storeId?: string;
    isTrashed?: boolean;
    restocking?: Array<{ productId: string; qty: number }>;
    promotions?: Array<{ productId: string; qty: number }>;
};

const effectKey = (effect: InventoryEffect) =>
    `${effect.scope}:${effect.storeId || "main"}:${effect.productId}`;

export function mergeInventoryEffects(effects: InventoryEffect[]): InventoryEffect[] {
    const merged = new Map<string, InventoryEffect>();

    for (const effect of effects) {
        if (!effect.productId || !Number.isFinite(effect.quantity) || effect.quantity === 0) continue;
        const key = effectKey(effect);
        const current = merged.get(key);
        merged.set(key, current
            ? { ...current, quantity: current.quantity + effect.quantity }
            : { ...effect });
    }

    return [...merged.values()].filter(effect => effect.quantity !== 0);
}

export function getPurchaseInventoryEffects(purchase?: PurchaseLike | null): InventoryEffect[] {
    if (!purchase || purchase.isTrashed) return [];
    if (!['partially_received', 'received', 'paid'].includes(purchase.status)) return [];

    return mergeInventoryEffects((purchase.items || []).map(item => {
        const isFullyReceived = purchase.status === 'received' || purchase.status === 'paid';
        const receivedQuantity = item.receivedQuantity ?? (isFullyReceived ? item.quantity : 0);
        return { scope: 'main' as const, productId: item.productId, quantity: receivedQuantity };
    }));
}

export function getSaleInventoryEffects(
    sale: SaleLike | null | undefined,
    products: ProductLike[],
    stores: StoreLike[],
): InventoryEffect[] {
    if (!sale || sale.isTrashed) return [];
    // 空配列も「在庫調整を意図的に行わなかった」という確定スナップショットとして扱う
    if (sale.inventoryEffects) return mergeInventoryEffects(sale.inventoryEffects);

    const store = stores.find(item => item.id === sale.storeId);
    const isConsignment = store?.type === 'A' || store?.type === 'consignment';
    const scope = isConsignment ? 'store' as const : 'main' as const;

    const effects: InventoryEffect[] = [];
    for (const item of sale.items || []) {
        const product = products.find(candidate => candidate.id === item.productId);
        if (!product) continue;

        if (product.isComposite && product.components?.length) {
            for (const component of product.components) {
                effects.push({
                    scope,
                    storeId: isConsignment ? sale.storeId : undefined,
                    productId: component.productId,
                    quantity: -(component.quantity * item.quantity),
                });
            }
        } else {
            effects.push({
                scope,
                storeId: isConsignment ? sale.storeId : undefined,
                productId: product.id,
                quantity: -item.quantity,
            });
        }
    }

    return mergeInventoryEffects(effects);
}

export function diffInventoryEffects(
    previous: InventoryEffect[],
    next: InventoryEffect[],
): InventoryEffect[] {
    return mergeInventoryEffects([
        ...previous.map(effect => ({ ...effect, quantity: -effect.quantity })),
        ...next,
    ]);
}

export function getDailyReportInventoryEffects(
    report: DailyReportLike | null | undefined,
    stores: StoreLike[],
): InventoryEffect[] {
    if (!report || report.isTrashed) return [];
    const effects: InventoryEffect[] = [];
    const store = report.storeId ? stores.find(item => item.id === report.storeId) : undefined;
    const isConsignment = store?.type === 'A' || store?.type === 'consignment';

    if (report.type === 'store' && report.storeId && isConsignment) {
        for (const item of report.restocking || []) {
            effects.push({ scope: 'main', productId: item.productId, quantity: -item.qty });
            effects.push({ scope: 'store', storeId: report.storeId, productId: item.productId, quantity: item.qty });
        }
    }
    for (const item of report.promotions || []) {
        effects.push({ scope: 'main', productId: item.productId, quantity: -item.qty });
    }

    return mergeInventoryEffects(effects);
}

export function normalizeSaleTotals<T extends SaleTotalsLike>(sale: T): T & Required<Pick<SaleTotalsLike,
    'totalQuantity' | 'totalAmount' | 'totalCommission' | 'totalNetProfit'
>> {
    const items = sale.items || [];
    const totalQuantity = sale.totalQuantity ?? items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalAmount = sale.totalAmount ?? items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const totalCommission = sale.totalCommission ?? items.reduce((sum, item) => sum + (item.commission || 0), 0);
    const totalNetProfit = sale.totalNetProfit ?? items.reduce(
        (sum, item) => sum + (item.netProfit ?? ((item.subtotal || 0) - (item.commission || 0))),
        0,
    );

    return { ...sale, totalQuantity, totalAmount, totalCommission, totalNetProfit };
}
