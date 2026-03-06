// src/lib/store.ts
"use client";

import useSWR from "swr";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Brand {
    id: string;
    name: string;
}

export interface Supplier {
    id: string;
    name: string;
    contact?: string;
}

export interface Product {
    id: string;
    name: string;
    brandId: string;
    supplierId: string;
    costPrice: number;
    sellingPrice: number;
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

    const isLoaded = !loadingBrands && !loadingSuppliers && !loadingProducts;

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

    // --- Supplier Actions (Placeholder for future feature) ---
    const addSupplier = async (name: string, contact: string) => {
        const newRef = doc(collection(db, "suppliers"));
        const newSupplier = { id: newRef.id, name, contact };
        mutateSuppliers([...suppliers, newSupplier], false);
        await setDoc(newRef, { name, contact });
        mutateSuppliers();
    };

    return {
        isLoaded,
        brands,
        suppliers,
        products,
        addBrand,
        updateBrand,
        deleteBrand,
        addProduct,
        updateProduct,
        deleteProduct,
        addSupplier,
    };
}
