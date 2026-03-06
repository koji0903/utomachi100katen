// src/lib/store.ts
"use client";

import useSWR from "swr";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface RetailStore {
    id: string;
    name: string;
    zipCode?: string;
    address?: string;
    tel?: string;
    email?: string;
    pic?: string; // Person in Charge
    memo?: string;
    commissionRate?: number; // In percentage (e.g., 15)
}

export interface Sale {
    id: string;
    storeId: string;
    type: 'daily' | 'monthly';
    period: string; // YYYY-MM-DD or YYYY-MM
    items: {
        productId: string;
        quantity: number;
        priceAtSale: number;
        subtotal: number;
        commission: number;
        netProfit: number;
    }[];
    totalQuantity: number;
    totalAmount: number;
    totalCommission: number;
    totalNetProfit: number;
    updatedAt?: string | any;
}

export interface Purchase {
    id: string;
    productId: string;
    supplierId: string;
    orderDate: string;
    expectedArrivalDate: string;
    quantity: number;
    isArrived: boolean;
    createdAt?: string | any;
}

export interface Brand {
    id: string;
    name: string;
}

export interface Supplier {
    id: string;
    name: string;
    zipCode?: string;
    address?: string;
    tel?: string;
    email?: string;
    pic?: string; // Person in Charge
    memo?: string;
}

export interface Product {
    id: string;
    name: string;
    brandId: string;
    supplierId: string;
    costPrice: number;
    sellingPrice: number; // Default base price
    storePrices?: { storeId: string; price: number }[]; // Store-specific prices
    stock: number;
    story?: string;
    imageUrl?: string;
    createdAt?: string | any;
}

// Reusable fetcher for SWR
const fetcher = async <T>(collectionName: string): Promise<T[]> => {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as unknown as T));
};

const swrConfig = {
    revalidateOnFocus: false, // Prevents unnecessary reads on window focus
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // 1 minute deduplication
};

export function useStore() {
    // Fetch data using SWR
    const { data: brands = [], mutate: mutateBrands, isLoading: loadingBrands } = useSWR<Brand[]>("brands", () => fetcher<Brand>("brands"), swrConfig);
    const { data: suppliers = [], mutate: mutateSuppliers, isLoading: loadingSuppliers } = useSWR<Supplier[]>("suppliers", () => fetcher<Supplier>("suppliers"), swrConfig);
    const { data: products = [], mutate: mutateProducts, isLoading: loadingProducts } = useSWR<Product[]>("products", () => fetcher<Product>("products"), swrConfig);
    const { data: retailStores = [], mutate: mutateRetailStores, isLoading: loadingRetailStores } = useSWR<RetailStore[]>("retailStores", () => fetcher<RetailStore>("retailStores"), swrConfig);
    const { data: purchases = [], mutate: mutatePurchases, isLoading: loadingPurchases } = useSWR<Purchase[]>("purchases", () => fetcher<Purchase>("purchases"), swrConfig);
    const { data: sales = [], mutate: mutateSales, isLoading: loadingSales } = useSWR<Sale[]>("sales", () => fetcher<Sale>("sales"), swrConfig);

    const isLoaded = !loadingBrands && !loadingSuppliers && !loadingProducts && !loadingRetailStores && !loadingPurchases && !loadingSales;

    // --- Brand Actions ---
    const addBrand = async (name: string) => {
        const newRef = doc(collection(db, "brands"));
        const newBrand = { id: newRef.id, name };

        // Optimistic UI update
        mutateBrands([...brands, newBrand], false);

        // Write to Firestore
        await setDoc(newRef, { name });
        mutateBrands(); // Revalidate
    };

    const updateBrand = async (id: string, name: string) => {
        mutateBrands(brands.map((b) => (b.id === id ? { ...b, name } : b)), false);
        const docRef = doc(db, "brands", id);
        await updateDoc(docRef, { name });
        mutateBrands();
    };

    const deleteBrand = async (id: string) => {
        mutateBrands(brands.filter((b) => b.id !== id), false);
        const docRef = doc(db, "brands", id);
        await deleteDoc(docRef);
        mutateBrands();
    };

    // --- Product Actions ---
    const addProduct = async (productData: Omit<Product, "id" | "createdAt">) => {
        const newRef = doc(collection(db, "products"));
        const newProduct = {
            id: newRef.id,
            ...productData,
            createdAt: new Date().toISOString(), // Optimistic Date
        };

        mutateProducts([...products, newProduct as Product], false);

        await setDoc(newRef, {
            ...productData,
            createdAt: serverTimestamp(),
        });
        mutateProducts();
    };

    const updateProduct = async (id: string, productUpdate: Partial<Omit<Product, "id" | "createdAt">>) => {
        mutateProducts(products.map((p) => p.id === id ? { ...p, ...productUpdate } : p) as Product[], false);

        const docRef = doc(db, "products", id);
        await updateDoc(docRef, productUpdate);
        mutateProducts();
    };

    const deleteProduct = async (id: string) => {
        mutateProducts(products.filter((p) => p.id !== id), false);
        const docRef = doc(db, "products", id);
        await deleteDoc(docRef);
        mutateProducts();
    };

    // --- Supplier Actions ---
    const addSupplier = async (supplierData: Omit<Supplier, "id">) => {
        const newRef = doc(collection(db, "suppliers"));
        const newSupplier = { id: newRef.id, ...supplierData };
        mutateSuppliers([...suppliers, newSupplier], false);
        await setDoc(newRef, supplierData);
        mutateSuppliers();
    };

    const updateSupplier = async (id: string, supplierUpdate: Partial<Omit<Supplier, "id">>) => {
        mutateSuppliers(suppliers.map((s) => (s.id === id ? { ...s, ...supplierUpdate } : s)), false);
        const docRef = doc(db, "suppliers", id);
        await updateDoc(docRef, supplierUpdate);
        mutateSuppliers();
    };

    const deleteSupplier = async (id: string) => {
        mutateSuppliers(suppliers.filter((s) => s.id !== id), false);
        const docRef = doc(db, "suppliers", id);
        await deleteDoc(docRef);
        mutateSuppliers();
    };

    // --- RetailStore Actions ---
    const addRetailStore = async (storeData: Omit<RetailStore, "id">) => {
        const newRef = doc(collection(db, "retailStores"));
        const newStore = { id: newRef.id, ...storeData };
        mutateRetailStores([...retailStores, newStore], false);
        await setDoc(newRef, storeData);
        mutateRetailStores();
    };

    const updateRetailStore = async (id: string, storeUpdate: Partial<Omit<RetailStore, "id">>) => {
        mutateRetailStores(retailStores.map((s) => (s.id === id ? { ...s, ...storeUpdate } : s)), false);
        const docRef = doc(db, "retailStores", id);
        await updateDoc(docRef, storeUpdate);
        mutateRetailStores();
    };

    const deleteRetailStore = async (id: string) => {
        mutateRetailStores(retailStores.filter((s) => s.id !== id), false);
        const docRef = doc(db, "retailStores", id);
        await deleteDoc(docRef);
        mutateRetailStores();
    };

    // --- Purchase Actions ---
    const addPurchase = async (purchaseData: Omit<Purchase, "id" | "createdAt">) => {
        const newRef = doc(collection(db, "purchases"));
        const newPurchase = {
            id: newRef.id,
            ...purchaseData,
            createdAt: new Date().toISOString(),
        };

        // If added as Arrived, increment stock
        if (purchaseData.isArrived) {
            const product = products.find(p => p.id === purchaseData.productId);
            if (product) {
                const newStock = (product.stock || 0) + purchaseData.quantity;
                await updateProduct(product.id, { stock: newStock });
            }
        }

        mutatePurchases([...purchases, newPurchase as Purchase], false);
        await setDoc(newRef, {
            ...purchaseData,
            createdAt: serverTimestamp(),
        });
        mutatePurchases();
    };

    const updatePurchase = async (id: string, purchaseUpdate: Partial<Omit<Purchase, "id" | "createdAt">>) => {
        const currentPurchase = purchases.find(p => p.id === id);
        if (!currentPurchase) return;

        // If shifting to Arrived status, increment stock
        if (purchaseUpdate.isArrived === true && !currentPurchase.isArrived) {
            const product = products.find(p => p.id === currentPurchase.productId);
            if (product) {
                const newStock = (product.stock || 0) + (purchaseUpdate.quantity || currentPurchase.quantity);
                await updateProduct(product.id, { stock: newStock });
            }
        }

        mutatePurchases(purchases.map((p) => p.id === id ? { ...p, ...purchaseUpdate } : p) as Purchase[], false);
        const docRef = doc(db, "purchases", id);
        await updateDoc(docRef, purchaseUpdate);
        mutatePurchases();
    };

    const deletePurchase = async (id: string) => {
        mutatePurchases(purchases.filter((p) => p.id !== id), false);
        const docRef = doc(db, "purchases", id);
        await deleteDoc(docRef);
        mutatePurchases();
    };

    // --- Sale Actions ---
    const addSale = async (saleData: Omit<Sale, "id" | "updatedAt">) => {
        const newRef = doc(collection(db, "sales"));
        const newSale = {
            id: newRef.id,
            ...saleData,
            updatedAt: new Date().toISOString(),
        };
        mutateSales([newSale as Sale, ...sales], false);
        await setDoc(newRef, {
            ...saleData,
            updatedAt: serverTimestamp(),
        });
        mutateSales();
    };

    const deleteSale = async (id: string) => {
        mutateSales(sales.filter((s) => s.id !== id), false);
        const docRef = doc(db, "sales", id);
        await deleteDoc(docRef);
        mutateSales();
    };

    return {
        isLoaded,
        brands,
        suppliers,
        products,
        retailStores,
        purchases,
        addBrand,
        updateBrand,
        deleteBrand,
        addProduct,
        updateProduct,
        deleteProduct,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        addRetailStore,
        updateRetailStore,
        deleteRetailStore,
        addPurchase,
        updatePurchase,
        deletePurchase,
        sales,
        addSale,
        deleteSale,
    };
}
