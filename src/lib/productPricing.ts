import type { RetailStore } from "@/lib/store";

export type StorePriceEntry = { storeId: string; price: number };

export const getSuggestedRetailPrice = (sellingPrice: number, store: RetailStore) =>
    Math.round(sellingPrice * (1 + (store.pricingRule ?? 0) / 100));

export const getSuggestedWholesalePrice = (sellingPrice: number, store: RetailStore) =>
    Math.round(sellingPrice * ((store.wholesaleRate ?? 60) / 100));

export function fillMissingStorePrices(
    sellingPrice: number,
    stores: RetailStore[],
    storePrices: StorePriceEntry[],
    storeWholesalePrices: StorePriceEntry[],
) {
    const nextStorePrices = [...storePrices];
    const nextWholesalePrices = [...storeWholesalePrices];
    let changed = false;

    for (const store of stores.filter(store => !store.isTrashed)) {
        if (!nextStorePrices.some(entry => entry.storeId === store.id)) {
            nextStorePrices.push({ storeId: store.id, price: getSuggestedRetailPrice(sellingPrice, store) });
            changed = true;
        }
        if (!nextWholesalePrices.some(entry => entry.storeId === store.id)) {
            nextWholesalePrices.push({ storeId: store.id, price: getSuggestedWholesalePrice(sellingPrice, store) });
            changed = true;
        }
    }

    return {
        changed,
        storePrices: nextStorePrices,
        storeWholesalePrices: nextWholesalePrices,
    };
}

export function recalculateStorePrices(sellingPrice: number, stores: RetailStore[]) {
    const activeStores = stores.filter(store => !store.isTrashed);
    return {
        storePrices: activeStores.map(store => ({
            storeId: store.id,
            price: getSuggestedRetailPrice(sellingPrice, store),
        })),
        storeWholesalePrices: activeStores.map(store => ({
            storeId: store.id,
            price: getSuggestedWholesalePrice(sellingPrice, store),
        })),
    };
}
