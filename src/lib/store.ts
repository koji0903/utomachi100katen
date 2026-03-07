// src/lib/store.ts
"use client";

import useSWR from "swr";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { RoundingMode } from "@/lib/taxUtils";

// ─── 自社情報 / 会計設定 ─────────────────────────────────────────────
export interface CompanySettings {
    companyName: string;
    zipCode: string;
    address: string;
    tel: string;
    invoiceNumber: string;  // T-XXXXXXXXXXXXX
    roundingMode: RoundingMode;
    // 挙込先口座
    bankName?: string;       // 銀行名
    bankBranch?: string;     // 支店名
    bankAccountType?: string; // 普通 / 当座
    bankAccountNumber?: string;
    bankAccountHolder?: string;
    // ブランド資産
    logoUrl?: string;        // ロゴ画像 URL
    sealUrl?: string;        // 印影画像 URL
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
    companyName: '',
    zipCode: '',
    address: '',
    tel: '',
    invoiceNumber: '',
    roundingMode: 'floor',
    bankName: '',
    bankBranch: '',
    bankAccountType: '普通',
    bankAccountNumber: '',
    bankAccountHolder: '',
};

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
    lat?: number;   // 緯度（OpenWeatherMap 連携用）
    lng?: number;   // 経度
}

// 日報
export interface RestockingItem {
    productId: string;
    productName: string;
    qty: number;
}

export interface DailyReport {
    id: string;
    date: string;            // YYYY-MM-DD
    worker: string;          // 作業者名
    type: 'office' | 'store'; // 事務所作業 | 店舗メンテ
    // 天気（自動取得）
    weather?: string;        // e.g. "晴れ"
    weatherMain?: string;    // e.g. "Clear"
    temperature?: number;    // 気温（℃）
    humidity?: number;       // 湿度（%）
    windSpeed?: number;      // 風速 m/s
    // 事務所作業
    officeNote?: string;
    // 店舗メンテナンス
    storeId?: string;
    storeName?: string;
    restocking?: RestockingItem[];
    storeTopics?: string;
    createdAt?: string | any;
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
    type: 'A' | 'B';
    status: 'ordered' | 'waiting' | 'completed';
    productId: string;
    supplierId: string;
    orderDate: string;
    arrivalDate?: string;
    expectedArrivalDate?: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    createdAt?: string | any;
}

export interface Brand {
    id: string;
    name: string;
}

export interface Supplier {
    id: string;
    name: string;
    category?: 'Manufacturer' | 'Producer'; // 委託製造業者 or 一次生産者
    zipCode?: string;
    address?: string;
    tel?: string;
    email?: string;
    pic?: string; // Person in Charge
    bankInfo?: {
        bankName?: string;
        branchName?: string;
        accountType?: string; // 普通 or 当座
        accountNumber?: string;
        accountHolder?: string;
    };
    paymentTerms?: {
        closingDay?: number;  // e.g. 末日=31, 20日=20
        paymentDay?: number;  // 翌月何日払い
    };
    memo?: string;
}

export interface PaymentRecord {
    id: string;
    supplierId: string;
    month: string; // YYYY-MM
    totalAmount: number;
    status: 'unpaid' | 'paid';
    paidDate?: string; // ISO date string
    createdAt?: string | any;
}

export interface Product {
    id: string;
    name: string;
    variantName?: string; // e.g., "Mega Bottle", "Craft", "100g"
    brandId: string;
    supplierId: string;
    costPrice: number;
    sellingPrice: number; // Default base price
    storePrices?: { storeId: string; price: number }[]; // Store-specific prices
    stock: number;
    story?: string;
    // Branding Hub fields
    producerStory?: string; // 生産者の思い
    regionBackground?: string; // 地域背景
    servingSuggestion?: string; // おすすめの食べ方
    storyImageUrl?: string; // ストーリー用写真URL
    imageUrl?: string;
    taxRate?: 'standard' | 'reduced'; // 標準税率(10%) or 軽減税率(8%)
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
    const { data: purchases = [], mutate: mutatePurchases, isLoading: loadingPurchases } = useSWR<Purchase[]>("inbound_shipments", () => fetcher<Purchase>("inbound_shipments"), swrConfig);
    const { data: sales = [], mutate: mutateSales, isLoading: loadingSales } = useSWR<Sale[]>("sales", () => fetcher<Sale>("sales"), swrConfig);
    const { data: paymentRecords = [], mutate: mutatePaymentRecords, isLoading: loadingPayments } = useSWR<PaymentRecord[]>("payment_records", () => fetcher<PaymentRecord>("payment_records"), swrConfig);
    const { data: dailyReports = [], mutate: mutateDailyReports, isLoading: loadingReports } = useSWR<DailyReport[]>("daily_reports", () => fetcher<DailyReport>("daily_reports"), swrConfig);

    // Company Settings — fetched once from Firestore doc (not a collection)
    const { data: companySettings = DEFAULT_COMPANY_SETTINGS, mutate: mutateCompanySettings } = useSWR<CompanySettings>(
        "company_settings",
        async () => {
            const snap = await getDoc(doc(db, "company_settings", "main"));
            if (snap.exists()) return { ...DEFAULT_COMPANY_SETTINGS, ...snap.data() } as CompanySettings;
            return DEFAULT_COMPANY_SETTINGS;
        },
        { ...swrConfig, revalidateOnFocus: false }
    );

    const isLoaded = !loadingBrands && !loadingSuppliers && !loadingProducts && !loadingRetailStores && !loadingPurchases && !loadingSales && !loadingPayments;

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

    // --- Purchase Actions (Inbound Shipments) ---
    const addPurchase = async (purchaseData: Omit<Purchase, "id" | "createdAt">) => {
        const newRef = doc(collection(db, "inbound_shipments"));
        const newPurchase = {
            id: newRef.id,
            ...purchaseData,
            createdAt: new Date().toISOString(),
        };

        // If status is completed, increment stock
        if (purchaseData.status === 'completed') {
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

        // If shifting to completed status, increment stock
        if (purchaseUpdate.status === 'completed' && currentPurchase.status !== 'completed') {
            const product = products.find(p => p.id === currentPurchase.productId);
            if (product) {
                const newStock = (product.stock || 0) + (purchaseUpdate.quantity || currentPurchase.quantity);
                await updateProduct(product.id, { stock: newStock });
            }
        }

        mutatePurchases(purchases.map((p) => p.id === id ? { ...p, ...purchaseUpdate } : p) as Purchase[], false);
        const docRef = doc(db, "inbound_shipments", id);
        await updateDoc(docRef, purchaseUpdate);
        mutatePurchases();
    };

    const deletePurchase = async (id: string) => {
        mutatePurchases(purchases.filter((p) => p.id !== id), false);
        const docRef = doc(db, "inbound_shipments", id);
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

    // --- Payment Record Actions ---
    const upsertPaymentRecord = async (supplierId: string, month: string, update: Partial<Omit<PaymentRecord, 'id' | 'createdAt'>>) => {
        // Look for existing record
        const existing = paymentRecords.find(pr => pr.supplierId === supplierId && pr.month === month);
        if (existing) {
            // Update
            mutatePaymentRecords(paymentRecords.map(pr => pr.id === existing.id ? { ...pr, ...update } : pr), false);
            const docRef = doc(db, "payment_records", existing.id);
            await updateDoc(docRef, update);
        } else {
            // Create
            const newRef = doc(collection(db, "payment_records"));
            const newRecord: PaymentRecord = {
                id: newRef.id,
                supplierId,
                month,
                totalAmount: 0,
                status: 'unpaid',
                createdAt: new Date().toISOString(),
                ...update,
            };
            mutatePaymentRecords([...paymentRecords, newRecord], false);
            await setDoc(newRef, { supplierId, month, totalAmount: 0, status: 'unpaid', createdAt: serverTimestamp(), ...update });
        }
        mutatePaymentRecords();
    };

    // --- Company Settings Actions ---
    const saveCompanySettings = async (data: CompanySettings) => {
        mutateCompanySettings(data, false);
        await setDoc(doc(db, "company_settings", "main"), data);
        mutateCompanySettings();
    };

    // --- Daily Report Actions ---
    const addDailyReport = async (reportData: Omit<DailyReport, "id" | "createdAt">) => {
        const newRef = doc(collection(db, "daily_reports"));
        const newReport: DailyReport = { id: newRef.id, ...reportData, createdAt: new Date().toISOString() };
        mutateDailyReports([newReport, ...(dailyReports ?? [])], false);
        await setDoc(newRef, { ...reportData, createdAt: serverTimestamp() });
        mutateDailyReports();
    };

    const deleteDailyReport = async (id: string) => {
        mutateDailyReports((dailyReports ?? []).filter(r => r.id !== id), false);
        await deleteDoc(doc(db, "daily_reports", id));
        mutateDailyReports();
    };

    const updateDailyReport = async (id: string, data: Partial<Omit<DailyReport, "id" | "createdAt">>) => {
        mutateDailyReports((dailyReports ?? []).map(r => r.id === id ? { ...r, ...data } : r), false);
        await updateDoc(doc(db, "daily_reports", id), { ...data, updatedAt: serverTimestamp() });
        mutateDailyReports();
    };

    return {
        isLoaded,
        companySettings,
        saveCompanySettings,
        brands,
        suppliers,
        products,
        retailStores,
        purchases,
        paymentRecords,
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
        upsertPaymentRecord,
        dailyReports: dailyReports ?? [],
        addDailyReport,
        updateDailyReport,
        deleteDailyReport,
    };
}
