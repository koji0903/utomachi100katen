// src/lib/store.ts
"use client";

import useSWR from "swr";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Helper to remove undefined properties before sending to Firestore
const cleanObject = (obj: any) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) {
            delete newObj[key];
        }
    });
    return newObj;
};
import type { RoundingMode } from "@/lib/taxUtils";

// ─── 自社情報 / 会計設定 ─────────────────────────────────────────────
export interface CompanySettings {
    companyName: string;
    zipCode: string;
    address: string;
    tel: string;
    invoiceNumber: string;  // T-XXXXXXXXXXXXX
    roundingMode: RoundingMode;
    fax?: string;            // FAX番号
    picName?: string;        // 担当者名
    picTitle?: string;       // 担当者肩書
    // 振込先口座1
    bankName?: string;       // 銀行名
    bankBranch?: string;     // 支店名
    bankAccountType?: string; // 普通 / 当座
    bankAccountNumber?: string;
    bankAccountHolder?: string;
    // 振込先口座2
    bankName2?: string;
    bankBranch2?: string;
    bankAccountType2?: string;
    bankAccountNumber2?: string;
    bankAccountHolder2?: string;
    // ブランド資産
    logoUrl?: string;        // ロゴ画像 URL
    sealUrl?: string;        // 印影画像 URL
    // 天気自動取得設定
    weatherFetchTime?: string; // e.g. "14:00"
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
    companyName: '',
    zipCode: '',
    address: '',
    tel: '',
    invoiceNumber: '',
    roundingMode: 'floor',
    fax: '',
    picName: '',
    picTitle: '',
    bankName: '',
    bankBranch: '',
    bankAccountType: '普通',
    bankAccountNumber: '',
    bankAccountHolder: '',
    bankName2: '',
    bankBranch2: '',
    bankAccountType2: '普通',
    bankAccountNumber2: '',
    bankAccountHolder2: '',
    weatherFetchTime: '14:00',
};

export interface RetailStore extends BaseEntity {
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
    imageUrls?: string[]; // 店舗写真
    type?: 'A' | 'B'; // A: 委託販売, B: 卸販売
    createdAt?: string | any;
    updatedAt?: string | any;
    pricingRule?: number; // Percentage offset (e.g., 15 for +15%, -20 for -20%)
    activeProductIds?: string[]; // IDs of products carried by this store
    // 請求先情報（店舗情報と異なる場合）
    useDifferentBilling?: boolean;
    billingName?: string;
    billingZipCode?: string;
    billingAddress?: string;
    billingTel?: string;
    dailySalesGoal?: number; // 1日の売上目標額
}


// 日報
export interface RestockingItem {
    productId: string;
    productName: string;
    qty: number;
}

export interface DailyReport extends BaseEntity {
    id: string;
    date: string;            // YYYY-MM-DD
    worker: string;          // 作業者名
    type: 'office' | 'store' | 'activity'; // 事務所作業 | 店舗メンテ | 活動記録
    title?: string;          // タイトル
    content?: string;        // 内容（ストーリー）
    // 天気（自動取得）
    weather?: string;        // e.g. "晴れ"
    weatherMain?: string;    // e.g. "Clear"
    temperature?: number;    // 気温（℃）
    humidity?: number;       // 湿度（%）
    windSpeed?: number;      // 風速 m/s
    // 関連商品・店舗
    involvedProductIds?: string[]; // 関連商品
    // 事務所作業
    officeNote?: string;
    // 店舗メンテナンス
    storeId?: string;
    storeName?: string;
    restocking?: RestockingItem[];
    storeTopics?: string;
    displayBeforeImageUrls?: string[];
    displayAfterImageUrls?: string[];
    imageUrl?: string;       // メイン写真 URL
    createdAt?: string | any;
    updatedAt?: string | any;
}

export interface Sale extends BaseEntity {
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

export interface Purchase extends BaseEntity {
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

export interface DailyWeather {
    id: string;      // storeId_YYYY-MM-DD
    storeId: string;
    date: string;     // YYYY-MM-DD
    weather: string;
    weatherMain: string;
    temp: number;
    humidity: number;
    windSpeed: number;
    updatedAt?: string | any;
}

export interface Brand extends BaseEntity {
    id: string;
    name: string;
    concept?: string;
    story?: string;
    imageUrl?: string;
}

export interface InvoiceItem {
    id: string;
    productId?: string;
    label: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface InvoiceAdjustment {
    id: string;
    label: string;
    amount: number;
}

// ─── 発行済み帳票レコード ───────────────────────────────────────────────
export interface IssuedDocument extends BaseEntity {
    id: string;
    type: 'delivery_note' | 'payment_summary' | 'invoice';
    docNumber: string;          // "DN-2026-001", "INV-2026-001" or branch variants
    status: 'draft' | 'issued';
    issuedDate: string;         // YYYY-MM-DD
    period: string;             // YYYY-MM or YYYY-MM-DD
    recipientType: 'store' | 'supplier' | 'spot';
    storeId?: string;
    supplierId?: string;
    spotRecipientId?: string;
    recipientName: string;      // 非正規化表示名
    totalAmount: number;
    taxRate?: 8 | 10;
    details?: InvoiceItem[];
    adjustments?: InvoiceAdjustment[];
    finalAdjustment?: number;
    hidePrices?: boolean;
    memo?: string;
    createdAt?: string | any;
}

// ─── スポット（非登録）宛先マスター ───────────────────────────────────
export interface SpotRecipient extends BaseEntity {
    id: string;
    name: string;
    zipCode?: string;
    address?: string;
    tel?: string;
    memo?: string;
    lastUsedAt?: string;        // ISO date — 最終使用日（名寄せ優先順位用）
    createdAt?: string | any;
}

export interface Supplier extends BaseEntity {
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

export interface BusinessChallenge extends BaseEntity {
    id: string;
    title: string;
    description: string;
    category: 'system' | 'product' | 'customer' | 'store' | 'strategy' | 'other';
    priority: 'high' | 'medium' | 'low';
    status: 'todo' | 'doing' | 'done';
    createdAt: string | any;
    updatedAt?: string | any;
}

export interface StockConversion {
    id: string;
    date: string; // YYYY-MM-DD
    inputProductId: string;
    inputQty: number;
    outputProductId: string;
    outputQty: number;
    notes?: string;
    createdAt?: string | any;
}

export interface Activity {
    id: string;
    type: 'create' | 'update' | 'delete' | 'system';
    category: 'product' | 'brand' | 'store' | 'sale' | 'report' | 'purchase' | 'other';
    title: string;
    detail?: string;
    userId?: string;
    userName?: string;
    createdAt: string | any;
}

export interface TrashItem {
    id: string;
    originalId: string;
    collectionName: string;
    data: any;
    deletedAt: string | any;
    label: string; // e.g., "商品: ○○", "売上: INV-2026-001"
}

export interface BaseEntity {
    isTrashed?: boolean;
}

export interface Product extends BaseEntity {
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
    // EC / Product Detail fields
    productContent?: string; // 商品内容
    ingredients?: string; // 原材料
    amount?: string; // 内容量
    storageMethod?: string; // 保存方法
    shelfLife?: string; // 賞味期限
    shippingMethod?: string; // 配送方法
    precautions?: string; // 注意点
    dimensions?: { width: number; height: number; depth: number }; // サイズ
    // Branding Hub fields
    producerStory?: string; // 生産者の思い
    regionBackground?: string; // 地域背景
    servingSuggestion?: string; // おすすめの食べ方
    storyImageUrl?: string; // ストーリー用写真URL
    imageUrl?: string;
    taxRate?: 'standard' | 'reduced'; // 標準税率(10%) or 軽減税率(8%)
    alertThreshold?: number; // 在庫アラートのしきい値
    janCode?: string; // JANコード (CSV連携用)
    isComposite?: boolean; // セット商品フラグ
    components?: { productId: string; quantity: number }[]; // 構成要素
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
    const { data: issuedDocuments = [], mutate: mutateIssuedDocuments } = useSWR<IssuedDocument[]>("issued_documents", () => fetcher<IssuedDocument>("issued_documents"), swrConfig);
    const { data: dailyWeather = [], mutate: mutateDailyWeather } = useSWR<DailyWeather[]>("daily_weather", () => fetcher<DailyWeather>("daily_weather"), swrConfig);
    const { data: spotRecipients = [], mutate: mutateSpotRecipients } = useSWR<SpotRecipient[]>("spot_recipients", () => fetcher<SpotRecipient>("spot_recipients"), swrConfig);
    const { data: challenges = [], mutate: mutateChallenges } = useSWR<BusinessChallenge[]>("business_challenges", () => fetcher<BusinessChallenge>("business_challenges"), swrConfig);
    const { data: stockConversions = [], mutate: mutateStockConversions } = useSWR<StockConversion[]>("stock_conversions", () => fetcher<StockConversion>("stock_conversions"), swrConfig);
    const { data: activities = [], mutate: mutateActivities } = useSWR<Activity[]>("activities", () => fetcher<Activity>("activities"), swrConfig);
    const { data: trash = [], mutate: mutateTrash } = useSWR<TrashItem[]>("trash", () => fetcher<TrashItem>("trash"), swrConfig);

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

    const isLoaded = !loadingBrands && !loadingSuppliers && !loadingProducts && !loadingRetailStores && !loadingPurchases && !loadingSales && !loadingPayments && !loadingReports;

    // --- Activity Logging Helper ---
    const logActivity = async (activity: Omit<Activity, "id" | "createdAt">) => {
        const newRef = doc(collection(db, "activities"));
        const newActivity = {
            id: newRef.id,
            ...activity,
            createdAt: new Date().toISOString()
        };
        mutateActivities([newActivity, ...activities], false);
        await setDoc(newRef, {
            ...activity,
            createdAt: serverTimestamp()
        });
        mutateActivities();
    };

    // --- Brand Actions ---
    const addBrand = async (brandData: Omit<Brand, "id">) => {
        const newRef = doc(collection(db, "brands"));
        const newBrand = { id: newRef.id, ...brandData };
        mutateBrands([newBrand, ...brands], false);
        await setDoc(newRef, brandData);
        mutateBrands();
    };

    const updateBrand = async (id: string, data: Partial<Omit<Brand, "id">>) => {
        mutateBrands(brands.map((b) => (b.id === id ? { ...b, ...data } : b)), false);
        await updateDoc(doc(db, "brands", id), data);
        mutateBrands();
    };

    const deleteBrand = async (id: string) => {
        await updateDoc(doc(db, "brands", id), { isTrashed: true });
        mutateBrands();
    };

    const restoreBrand = async (id: string) => {
        await updateDoc(doc(db, "brands", id), { isTrashed: false });
        mutateBrands();
    };

    const permanentlyDeleteBrand = async (id: string) => {
        await deleteDoc(doc(db, "brands", id));
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
        logActivity({
            type: 'create',
            category: 'product',
            title: `商品「${productData.name}」を追加しました`,
            detail: `価格: ¥${productData.sellingPrice.toLocaleString()}`
        });
        mutateProducts();
    };

    const updateProduct = async (id: string, productUpdate: Partial<Omit<Product, "id" | "createdAt">>) => {
        mutateProducts(products.map((p) => p.id === id ? { ...p, ...productUpdate } : p) as Product[], false);

        const docRef = doc(db, "products", id);
        await updateDoc(docRef, productUpdate);
        logActivity({
            type: 'update',
            category: 'product',
            title: `商品情報を更新しました`,
            detail: productUpdate.name || id
        });
        mutateProducts();
    };

    const deleteProduct = async (id: string) => {
        const product = products.find(p => p.id === id);
        await updateDoc(doc(db, "products", id), { isTrashed: true });
        logActivity({
            type: 'delete',
            category: 'product',
            title: `商品をゴミ箱に移動しました`,
            detail: product?.name || id
        });
        mutateProducts();
    };

    const restoreProduct = async (id: string) => {
        await updateDoc(doc(db, "products", id), { isTrashed: false });
        mutateProducts();
    };

    const permanentlyDeleteProduct = async (id: string) => {
        await deleteDoc(doc(db, "products", id));
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
        await updateDoc(doc(db, "suppliers", id), { isTrashed: true });
        mutateSuppliers();
    };

    const restoreSupplier = async (id: string) => {
        await updateDoc(doc(db, "suppliers", id), { isTrashed: false });
        mutateSuppliers();
    };

    const permanentlyDeleteSupplier = async (id: string) => {
        await deleteDoc(doc(db, "suppliers", id));
        mutateSuppliers();
    };

    // --- RetailStore Actions ---
    const addRetailStore = async (storeData: Omit<RetailStore, "id" | "createdAt" | "updatedAt">) => {
        const newRef = doc(collection(db, "retailStores"));
        const newStore = { id: newRef.id, ...storeData, createdAt: new Date().toISOString() };
        mutateRetailStores([...retailStores, newStore as RetailStore], false);
        await setDoc(newRef, {
            ...storeData,
            createdAt: serverTimestamp(),
        });
        logActivity({
            type: 'create',
            category: 'store',
            title: `店舗「${storeData.name}」を登録しました`,
        });
        mutateRetailStores();
    };

    const updateRetailStore = async (id: string, storeUpdate: Partial<Omit<RetailStore, "id" | "updatedAt">>) => {
        mutateRetailStores(retailStores.map((s) => (s.id === id ? { ...s, ...storeUpdate } : s)), false);
        const docRef = doc(db, "retailStores", id);
        await updateDoc(docRef, {
            ...storeUpdate,
            updatedAt: serverTimestamp(),
        });
        logActivity({
            type: 'update',
            category: 'store',
            title: `店舗情報を更新しました`,
            detail: retailStores.find(s => s.id === id)?.name
        });
        mutateRetailStores();
    };

    const deleteRetailStore = async (id: string) => {
        await updateDoc(doc(db, "retailStores", id), { isTrashed: true });
        mutateRetailStores();
    };

    const restoreRetailStore = async (id: string) => {
        await updateDoc(doc(db, "retailStores", id), { isTrashed: false });
        mutateRetailStores();
    };

    const permanentlyDeleteRetailStore = async (id: string) => {
        await deleteDoc(doc(db, "retailStores", id));
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
        const purchase = purchases.find(p => p.id === id);
        if (!purchase) return;

        // Correct stock if the purchase was completed
        if (purchase.status === 'completed' && !purchase.isTrashed) {
            const product = products.find(p => p.id === purchase.productId);
            if (product) {
                const newStock = (product.stock || 0) - purchase.quantity;
                await updateProduct(product.id, { stock: newStock });
            }
        }

        await updateDoc(doc(db, "inbound_shipments", id), { isTrashed: true });
        mutatePurchases();
    };

    const restorePurchase = async (id: string) => {
        const purchase = purchases.find(p => p.id === id);
        if (!purchase) return;

        // Redo stock if the purchase was completed
        if (purchase.status === 'completed') {
            const product = products.find(p => p.id === purchase.productId);
            if (product) {
                const newStock = (product.stock || 0) + purchase.quantity;
                await updateProduct(product.id, { stock: newStock });
            }
        }

        await updateDoc(doc(db, "inbound_shipments", id), { isTrashed: false });
        mutatePurchases();
    };

    const permanentlyDeletePurchase = async (id: string) => {
        await deleteDoc(doc(db, "inbound_shipments", id));
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

        // Stock adjustment logic
        for (const item of saleData.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            if (product.isComposite && product.components) {
                // Adjust components
                for (const comp of product.components) {
                    const compProduct = products.find(p => p.id === comp.productId);
                    if (compProduct) {
                        const newStock = (compProduct.stock || 0) - (comp.quantity * item.quantity);
                        await updateProduct(compProduct.id, { stock: newStock });
                    }
                }
            } else {
                // Adjust simple product result
                const newStock = (product.stock || 0) - item.quantity;
                await updateProduct(product.id, { stock: newStock });
            }
        }

        mutateSales([newSale as Sale, ...sales], false);
        await setDoc(newRef, {
            ...saleData,
            updatedAt: serverTimestamp(),
        });
        logActivity({
            type: 'create',
            category: 'sale',
            title: `売上を記録しました`,
            detail: `${retailStores.find(s => s.id === saleData.storeId)?.name} / ¥${saleData.totalAmount.toLocaleString()}`
        });
        mutateSales();
    };

    // --- Stock Conversion Actions ---
    const addStockConversion = async (data: Omit<StockConversion, "id" | "createdAt">) => {
        const newRef = doc(collection(db, "stock_conversions"));
        const newConv: StockConversion = {
            id: newRef.id,
            ...data,
            createdAt: new Date().toISOString()
        };

        // Adjust stocks
        const inputProduct = products.find(p => p.id === data.inputProductId);
        if (inputProduct) {
            await updateProduct(inputProduct.id, { stock: (inputProduct.stock || 0) - data.inputQty });
        }
        const outputProduct = products.find(p => p.id === data.outputProductId);
        if (outputProduct) {
            await updateProduct(outputProduct.id, { stock: (outputProduct.stock || 0) + data.outputQty });
        }

        mutateStockConversions([newConv, ...stockConversions], false);
        await setDoc(newRef, { ...data, createdAt: serverTimestamp() });
        mutateStockConversions();
    };

    const updateSale = async (id: string, saleData: Partial<Sale>) => {
        mutateSales(sales.map((s) => s.id === id ? { ...s, ...saleData } : s) as Sale[], false);
        const docRef = doc(db, "sales", id);
        await updateDoc(docRef, {
            ...cleanObject(saleData),
            updatedAt: serverTimestamp(),
        });
        mutateSales();
    };

    const deleteSale = async (id: string) => {
        const sale = sales.find(s => s.id === id);
        if (!sale) return;

        // Reverse stock adjustments
        for (const item of sale.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            if (product.isComposite && product.components) {
                // Reverse components
                for (const comp of product.components) {
                    const compProduct = products.find(p => p.id === comp.productId);
                    if (compProduct) {
                        const restoredStock = (compProduct.stock || 0) + (comp.quantity * item.quantity);
                        await updateProduct(compProduct.id, { stock: restoredStock });
                    }
                }
            } else {
                // Reverse simple product
                const restoredStock = (product.stock || 0) + item.quantity;
                await updateProduct(product.id, { stock: restoredStock });
            }
        }

        await updateDoc(doc(db, "sales", id), { isTrashed: true });
        mutateSales();
    };

    const restoreSale = async (id: string) => {
        const sale = sales.find(s => s.id === id);
        if (!sale) return;

        // Re-apply stock adjustments
        for (const item of sale.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            if (product.isComposite && product.components) {
                for (const comp of product.components) {
                    const compProduct = products.find(p => p.id === comp.productId);
                    if (compProduct) {
                        const newStock = (compProduct.stock || 0) - (comp.quantity * item.quantity);
                        await updateProduct(compProduct.id, { stock: newStock });
                    }
                }
            } else {
                const newStock = (product.stock || 0) - item.quantity;
                await updateProduct(product.id, { stock: newStock });
            }
        }

        await updateDoc(doc(db, "sales", id), { isTrashed: false });
        mutateSales();
    };

    const permanentlyDeleteSale = async (id: string) => {
        await deleteDoc(doc(db, "sales", id));
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
        logActivity({
            type: 'create',
            category: 'report',
            title: `業務日報「${reportData.title || '無題'}」を提出しました`,
            detail: `担当: ${reportData.worker}`
        });
        mutateDailyReports();
    };

    const deleteDailyReport = async (id: string) => {
        await updateDoc(doc(db, "daily_reports", id), { isTrashed: true });
        mutateDailyReports();
    };

    const restoreDailyReport = async (id: string) => {
        await updateDoc(doc(db, "daily_reports", id), { isTrashed: false });
        mutateDailyReports();
    };

    const permanentlyDeleteDailyReport = async (id: string) => {
        await deleteDoc(doc(db, "daily_reports", id));
        mutateDailyReports();
    };

    const updateDailyReport = async (id: string, data: Partial<Omit<DailyReport, "id" | "createdAt">>) => {
        mutateDailyReports((dailyReports ?? []).map(r => r.id === id ? { ...r, ...data } : r), false);
        await updateDoc(doc(db, "daily_reports", id), { ...data, updatedAt: serverTimestamp() });
        mutateDailyReports();
    };

    // --- Issued Document Actions ---

    /** 帳票番号の採番: 同じ prefix の既存番号を参照して次の連番を返す */
    const generateDocNumber = (type: 'delivery_note' | 'payment_summary' | 'invoice', year: string): string => {
        const prefix = type === 'delivery_note' ? 'DN' : type === 'payment_summary' ? 'PM' : 'INV';
        const base = `${prefix}-${year}-`;
        const existing = issuedDocuments
            .filter(d => d.docNumber.startsWith(base) && !d.docNumber.includes('-', base.length + 2))
            .map(d => parseInt(d.docNumber.replace(base, '')) || 0);
        const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
        return `${base}${String(next).padStart(3, '0')}`;
    };

    const saveIssuedDocument = async (data: Omit<IssuedDocument, 'id' | 'createdAt'>): Promise<IssuedDocument> => {
        const newRef = doc(collection(db, 'issued_documents'));
        const newDoc: IssuedDocument = { id: newRef.id, ...data, createdAt: new Date().toISOString() };
        mutateIssuedDocuments([newDoc, ...issuedDocuments], false);
        await setDoc(newRef, { ...cleanObject(data), createdAt: serverTimestamp() });
        mutateIssuedDocuments();
        return newDoc;
    };

    const duplicateDocument = async (id: string): Promise<IssuedDocument | null> => {
        const original = issuedDocuments.find(d => d.id === id);
        if (!original) return null;
        // Strip existing branch suffix to get the base number
        const baseNumber = original.docNumber.replace(/-\d{2}$/, '');
        // Find existing branches for this base
        const branches = issuedDocuments
            .filter(d => d.docNumber.startsWith(baseNumber + '-') && /^\d{2}$/.test(d.docNumber.slice(baseNumber.length + 1)))
            .map(d => parseInt(d.docNumber.slice(baseNumber.length + 1)) || 0);
        // If the original itself has no branch and no branches exist yet, start at -01
        const nextBranch = branches.length > 0 ? Math.max(...branches) + 1 : 1;
        const newDocNumber = `${baseNumber}-${String(nextBranch).padStart(2, '0')}`;
        return saveIssuedDocument(({
            type: original.type,
            docNumber: newDocNumber,
            status: 'draft' as const,
            issuedDate: new Date().toISOString().split('T')[0],
            period: original.period,
            recipientType: original.recipientType,
            storeId: original.storeId,
            supplierId: original.supplierId,
            spotRecipientId: original.spotRecipientId,
            recipientName: original.recipientName,
            totalAmount: original.totalAmount,
            taxRate: original.taxRate,
            details: original.details,
            adjustments: original.adjustments,
            finalAdjustment: original.finalAdjustment,
            memo: original.memo,
        }));
    };

    const convertToInvoice = async (id: string): Promise<IssuedDocument | null> => {
        const original = issuedDocuments.find(d => d.id === id);
        if (!original || original.type !== 'delivery_note') return null;

        const year = new Date().getFullYear().toString();
        const newDocNumber = generateDocNumber('invoice', year);

        return saveIssuedDocument({
            type: 'invoice',
            docNumber: newDocNumber,
            status: 'draft' as const,
            issuedDate: new Date().toISOString().split('T')[0],
            period: original.period,
            recipientType: original.recipientType,
            storeId: original.storeId,
            supplierId: original.supplierId,
            spotRecipientId: original.spotRecipientId,
            recipientName: original.recipientName,
            totalAmount: original.totalAmount,
            taxRate: original.taxRate,
            details: original.details,
            adjustments: original.adjustments,
            finalAdjustment: original.finalAdjustment,
            memo: original.memo,
        });
    };

    const updateIssuedDocument = async (id: string, data: Partial<Omit<IssuedDocument, 'id' | 'createdAt'>>) => {
        mutateIssuedDocuments(issuedDocuments.map(d => d.id === id ? { ...d, ...data } : d), false);
        await updateDoc(doc(db, 'issued_documents', id), cleanObject(data));
        mutateIssuedDocuments();
    };

    const deleteIssuedDocument = async (id: string) => {
        await updateDoc(doc(db, 'issued_documents', id), { isTrashed: true });
        mutateIssuedDocuments();
    };

    const restoreIssuedDocument = async (id: string) => {
        await updateDoc(doc(db, 'issued_documents', id), { isTrashed: false });
        mutateIssuedDocuments();
    };

    const permanentlyDeleteIssuedDocument = async (id: string) => {
        await deleteDoc(doc(db, 'issued_documents', id));
        mutateIssuedDocuments();
    };

    // --- Spot Recipient Actions ---
    const addSpotRecipient = async (data: Omit<SpotRecipient, 'id' | 'createdAt'>): Promise<SpotRecipient> => {
        // 名寄せ: 同名が既に存在する場合は lastUsedAt を更新して返す
        const existing = spotRecipients.find(r => r.name.trim() === data.name.trim());
        if (existing) {
            const updated = { ...existing, lastUsedAt: new Date().toISOString() };
            mutateSpotRecipients(spotRecipients.map(r => r.id === existing.id ? updated : r), false);
            await updateDoc(doc(db, 'spot_recipients', existing.id), { lastUsedAt: serverTimestamp() });
            mutateSpotRecipients();
            return updated;
        }
        const newRef = doc(collection(db, 'spot_recipients'));
        const newRecipient: SpotRecipient = { id: newRef.id, ...data, lastUsedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
        mutateSpotRecipients([newRecipient, ...spotRecipients], false);
        await setDoc(newRef, { ...data, lastUsedAt: serverTimestamp(), createdAt: serverTimestamp() });
        mutateSpotRecipients();
        return newRecipient;
    };

    const deleteSpotRecipient = async (id: string) => {
        await updateDoc(doc(db, 'spot_recipients', id), { isTrashed: true });
        mutateSpotRecipients();
    };

    const restoreSpotRecipient = async (id: string) => {
        await updateDoc(doc(db, 'spot_recipients', id), { isTrashed: false });
        mutateSpotRecipients();
    };

    const permanentlyDeleteSpotRecipient = async (id: string) => {
        await deleteDoc(doc(db, 'spot_recipients', id));
        mutateSpotRecipients();
    };

    // --- Business Challenge Actions ---
    const addChallenge = async (data: Omit<BusinessChallenge, 'id' | 'createdAt'>) => {
        const newRef = doc(collection(db, 'business_challenges'));
        const newChallenge: BusinessChallenge = {
            id: newRef.id,
            ...data,
            createdAt: new Date().toISOString()
        };
        mutateChallenges([newChallenge, ...challenges], false);
        await setDoc(newRef, { ...data, createdAt: serverTimestamp() });
        mutateChallenges();
    };

    const updateChallenge = async (id: string, data: Partial<Omit<BusinessChallenge, 'id' | 'createdAt'>>) => {
        mutateChallenges(challenges.map(c => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c), false);
        await updateDoc(doc(db, 'business_challenges', id), { ...cleanObject(data), updatedAt: serverTimestamp() });
        mutateChallenges();
    };

    const deleteChallenge = async (id: string) => {
        await updateDoc(doc(db, 'business_challenges', id), { isTrashed: true });
        mutateChallenges();
    };

    const restoreChallenge = async (id: string) => {
        await updateDoc(doc(db, 'business_challenges', id), { isTrashed: false });
        mutateChallenges();
    };

    const permanentlyDeleteChallenge = async (id: string) => {
        await deleteDoc(doc(db, 'business_challenges', id));
        mutateChallenges();
    };

    // --- Daily Weather Actions ---
    const saveDailyWeather = async (data: Omit<DailyWeather, "updatedAt">) => {
        const docRef = doc(db, "daily_weather", data.id);
        await setDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        mutateDailyWeather();
    };

    // --- Trash Actions ---
    const moveToTrash = async (originalId: string, collectionName: string, data: any, label: string) => {
        const newRef = doc(collection(db, "trash"));
        const trashItem: TrashItem = {
            id: newRef.id,
            originalId,
            collectionName,
            data,
            label,
            deletedAt: new Date().toISOString(),
        };
        mutateTrash([trashItem, ...trash], false);
        await setDoc(newRef, {
            ...trashItem,
            deletedAt: serverTimestamp()
        });
        mutateTrash();
    };

    const restoreFromTrash = async (id: string) => {
        const item = trash.find(t => t.id === id);
        if (!item) return;

        // Restore to original collection
        const originalRef = doc(db, item.collectionName, item.originalId);
        await setDoc(originalRef, item.data);

        // Special handling: Sale/Purchase stock logic
        if (item.collectionName === 'sales') {
            const sale = item.data as Sale;
            for (const sItem of sale.items) {
                const product = products.find(p => p.id === sItem.productId);
                if (product) {
                    if (product.isComposite && product.components) {
                        for (const comp of product.components) {
                            const compProduct = products.find(p => p.id === comp.productId);
                            if (compProduct) {
                                await updateProduct(compProduct.id, { stock: (compProduct.stock || 0) - (comp.quantity * sItem.quantity) });
                            }
                        }
                    } else {
                        await updateProduct(product.id, { stock: (product.stock || 0) - sItem.quantity });
                    }
                }
            }
        } else if (item.collectionName === 'inbound_shipments') {
            const purchase = item.data as Purchase;
            if (purchase.status === 'completed') {
                const product = products.find(p => p.id === purchase.productId);
                if (product) {
                    await updateProduct(product.id, { stock: (product.stock || 0) + purchase.quantity });
                }
            }
        }

        // Remove from trash
        mutateTrash(trash.filter(t => t.id !== id), false);
        await deleteDoc(doc(db, "trash", id));
        mutateTrash();

        // Mutate affected collections
        mutateBrands();
        mutateSuppliers();
        mutateProducts();
        mutateRetailStores();
        mutatePurchases();
        mutateSales();
        mutateDailyReports();
        mutateIssuedDocuments();
        mutateSpotRecipients();
        mutateChallenges();
    };

    const permanentlyDeleteFromTrash = async (id: string) => {
        mutateTrash(trash.filter(t => t.id !== id), false);
        await deleteDoc(doc(db, "trash", id));
        mutateTrash();
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
        updateSale,
        deleteSale,
        upsertPaymentRecord,
        dailyReports: (dailyReports ?? []).slice().sort((a, b) => b.date.localeCompare(a.date)),
        addDailyReport,
        updateDailyReport,
        deleteDailyReport,
        // Issued Documents
        issuedDocuments,
        generateDocNumber,
        saveIssuedDocument,
        duplicateDocument,
        convertToInvoice,
        updateIssuedDocument,
        deleteIssuedDocument,
        // Spot Recipients
        spotRecipients,
        addSpotRecipient,
        deleteSpotRecipient,
        // Business Challenges
        challenges,
        addChallenge,
        updateChallenge,
        deleteChallenge,
        // Stock Conversions
        stockConversions,
        addStockConversion,
        // Daily Weather
        dailyWeather,
        saveDailyWeather,
        activities,
        logActivity,
        // Brands
        restoreBrand,
        permanentlyDeleteBrand,
        // Products
        restoreProduct,
        permanentlyDeleteProduct,
        // Suppliers
        restoreSupplier,
        permanentlyDeleteSupplier,
        // Stores
        restoreRetailStore,
        permanentlyDeleteRetailStore,
        // Purchases
        restorePurchase,
        permanentlyDeletePurchase,
        // Sales
        restoreSale,
        permanentlyDeleteSale,
        // Reports
        restoreDailyReport,
        permanentlyDeleteDailyReport,
        // Documents
        restoreIssuedDocument,
        permanentlyDeleteIssuedDocument,
        // Spot Recipients
        restoreSpotRecipient,
        permanentlyDeleteSpotRecipient,
        // Challenges
        restoreChallenge,
        permanentlyDeleteChallenge,
        trash,
        restoreFromTrash,
        permanentlyDeleteFromTrash,
    };
}
