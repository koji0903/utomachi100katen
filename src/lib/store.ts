// src/lib/store.ts
"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, getDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/authContext";
import { getMockData } from "@/lib/mockData";
import { syncProductToAmazon } from "@/app/actions/amazon";

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
import type { PrintArchive, PrintArchiveHistory } from "./types/printArchive";
import type { Expense, ExpenseCategory } from "./types/expense";

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
}

export interface AutoReportConfig {
    isEnabled: boolean;
    emailRecipient: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    sendDay: number; // 0: Sun, 1: Mon, ...
    sendTime: string; // "HH:mm"
    updatedAt?: string | any;
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
};

export const DEFAULT_REPORT_CONFIG: AutoReportConfig = {
    isEnabled: false,
    emailRecipient: '',
    frequency: 'weekly',
    sendDay: 1, // Monday
    sendTime: '09:00',
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
    type?: 'A' | 'B' | 'C'; // A: 委託販売, B: 卸販売, C: 直営
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
    honorific?: '様' | '御中';
    squareLocationId?: string; // Square Location ID
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
    temperatureMin?: number; // 最低気温（℃）
    temperatureMax?: number; // 最高気温（℃）
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
    storeName?: string;
    recipientType?: 'store' | 'spot';
    type: 'daily' | 'monthly';
    period: string; // YYYY-MM-DD or YYYY-MM
    items: {
        productId: string;
        quantity: number;
        priceAtSale: number;
        subtotal: number;
        commission: number;
        netProfit: number;
        productName?: string;
        catalogObjectId?: string;
    }[];


    totalQuantity: number;
    totalAmount: number;
    totalCommission: number;
    totalNetProfit: number;
    // 天気（売上記録時）
    weather?: string;
    weatherMain?: string;
    temperature?: number;
    temperatureMin?: number;
    temperatureMax?: number;
    updatedAt?: string | any;
}

export interface PurchaseItem {
    productId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
}

export interface Purchase extends BaseEntity {
    id: string;
    type: 'A' | 'B';
    status: 'ordered_pending' | 'ordered' | 'waiting' | 'received' | 'paid';
    supplierId: string;
    items: PurchaseItem[];
    totalAmount: number;
    orderDate: string;
    arrivalDate?: string;      // 実際の仕入日 (receivedDateとしても機能)
    receivedDate?: string;     // 仕入日 (一貫性のため追加)
    paymentDate?: string;      // 支払い日
    expectedArrivalDate?: string;
    memo?: string;
    createdAt?: string | any;

    // Legacy fields for backward compatibility during migration
    productId?: string;
    quantity?: number;
    unitCost?: number;
    totalCost?: number;
}

export interface DailyWeather {
    id: string;      // storeId_YYYY-MM-DD
    storeId: string;
    date: string;     // YYYY-MM-DD
    weather: string;
    weatherMain: string;
    temp: number;
    tempMin?: number;
    tempMax?: number;
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
    remarks?: string;
}

export interface InvoiceAdjustment {
    id: string;
    label: string;
    amount: number;
}

// ─── 発行済み帳票レコード ───────────────────────────────────────────────
export interface IssuedDocument extends BaseEntity {
    id: string;
    type: 'delivery_note' | 'payment_summary' | 'invoice' | 'receipt';
    docNumber: string;          // "DN-2026-001", "INV-2026-001", "RC-2026-001" or branch variants
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
    taxType?: 'inclusive' | 'exclusive';
    details?: InvoiceItem[];
    adjustments?: InvoiceAdjustment[];
    finalAdjustment?: number;
    hidePrices?: boolean;
    memo?: string;
    paymentMethod?: '銀行振込' | '現金' | 'QR決済' | 'その他'; // Used for receipts
    transactionId?: string;
    sourceDocId?: string;       // 元になった帳票のID（納品書から請求書を作った場合など）
    sourceDocIds?: string[];    // 元になった複数の帳票ID（合算請求書の場合）
    fulfillmentStatus?: 'pending' | 'sent' | 'paid'; // 請求書の状態管理
    pdfUrl?: string;            // Firebase Storage上のPDFへのリンク
    createdAt?: string | any;
}

export interface InvoicePayment extends BaseEntity {
    id: string;
    invoiceId: string;
    date: string;
    amount: number;
    transactionId?: string;
    method: '銀行振込' | '現金' | 'QR決済' | 'その他';
    notes?: string;
    createdAt?: string | any;
}

// ─── 取引（Transactions） ───────────────────────────────────────────────
export interface Transaction extends BaseEntity {
    id: string;
    transactionType: string;
    customerName: string;
    storeId?: string;       // 関連する販売店舗ID
    storeName?: string;     // 関連する販売店舗名 (非正規化)
    channel: 'スポット注文' | '卸販売' | '委託販売' | '店頭販売' | 'EC' | 'イベント販売';
    orderDate: string;
    deliveryDate: string;
    invoiceDate: string;
    dueDate: string;
    transactionStatus: '受注' | '納品済' | '請求済' | '一部入金' | '入金済' | '完了';
    subtotal: number;
    tax: number;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    remarks: string;
    createdAt?: string | any;
    updatedAt?: string | any;
}

// ─── 取引明細（Transaction Items） ──────────────────────────────────────
export interface TransactionItem extends BaseEntity {
    id: string;
    transactionId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: number;
    remarks?: string;
    createdAt?: string | any;
    updatedAt?: string | any;
}

// Helper function to calculate the remaining balance of an invoice
export const calculateInvoiceBalance = (invoice: IssuedDocument, payments: InvoicePayment[]): number => {
    if (invoice.type !== 'invoice') return 0;

    const totalPaid = payments
        .filter(p => !p.isTrashed && p.invoiceId === invoice.id)
        .reduce((sum, p) => sum + p.amount, 0);

    return Math.max(0, invoice.totalAmount - totalPaid);
};

// ─── スポット（非登録）宛先マスター ───────────────────────────────────
export interface SpotRecipient extends BaseEntity {
    id: string;
    name: string;
    zipCode?: string;
    address?: string;
    tel?: string;
    memo?: string;
    lastUsedAt?: string;        // ISO date — 最終使用日（名寄せ優先順位用）
    honorific?: '様' | '御中';
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
    suppliedProducts?: { productId: string; purchasePrice: number }[];
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

export interface ChallengeComment {
    id: string;
    content: string;
    author: string;
    createdAt: string | any;
}

export interface BusinessChallenge extends BaseEntity {
    id: string;
    title: string;
    description: string;
    author?: string; // 投稿者
    category: 'system' | 'product' | 'customer' | 'store' | 'strategy' | 'other';
    priority: 'high' | 'medium' | 'low';
    status: 'todo' | 'doing' | 'waiting' | 'done';
    createdAt: string | any;
    updatedAt?: string | any;
    comments?: ChallengeComment[];
}

export interface BusinessManual extends BaseEntity {
    id: string;
    title: string;
    category: string;
    content: string; // Markdown
    links: { label: string; url: string }[];
    attachedDocumentIds?: string[]; // IDs of associated PrintArchive records
    order: number;
    updatedAt?: string | any;
    createdAt?: string | any;
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

// ─── 在庫移動履歴（Stock Movements） ────────────────────────────────────
export interface StockMovement extends BaseEntity {
    id: string;
    productId: string;
    productName: string; // 非正規化
    type: 'in' | 'out' | 'adjustment'; // 入庫, 出庫, 調整
    quantity: number; // 変動量
    reason: 'sale' | 'purchase' | 'audit' | 'return' | 'waste' | 'amazon_sync' | 'manual';
    referenceId?: string; // 関連する取引IDや仕入ID
    date: string; // YYYY-MM-DD
    remarks?: string;
    createdAt?: string | any;
}

// ─── 棚卸し（Inventory Audits） ──────────────────────────────────────────
export interface InventoryAuditItem {
    productId: string;
    productName: string;
    expectedStock: number; // システム上の在庫
    actualStock: number;   // 実在庫
    diff: number;          // 差異
    remarks?: string;
}

export interface InventoryAudit extends BaseEntity {
    id: string;
    date: string; // YYYY-MM-DD
    status: 'draft' | 'completed';
    items: InventoryAuditItem[];
    performedBy?: string;
    remarks?: string;
    createdAt?: string | any;
    completedAt?: string | any;
}

// ─── 店舗別在庫（Store Stocks） ──────────────────────────────────────────
export interface StoreStock extends BaseEntity {
    id: string; // storeId_productId
    storeId: string;
    productId: string;
    stock: number;
    updatedAt?: string | any;
}

export interface StoreStockMovement extends BaseEntity {
    id: string;
    storeId: string;
    productId: string;
    productName: string;
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason: 'restock' | 'sale' | 'loss' | 'return' | 'manual' | 'audit';
    referenceId?: string; // DailyReport ID or Sale ID
    date: string;
    remarks?: string;
    createdAt?: string | any;
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
    // Amazon Integration fields
    amazonAsin?: string;
    amazonSku?: string;
    amazonSyncEnabled?: boolean;
    // Shopify Integration fields
    shopifyProductId?: string;
    shopifyVariantId?: string;
    shopifySyncEnabled?: boolean;
    lastShopifySyncAt?: string | any;
    // Square Integration fields
    squareSyncEnabled?: boolean;
    squareVariantId?: string; // Square Catalog Object ID for this product/variant
    lastSquareSyncAt?: string | any;
    createdAt?: string | any;
}

// Reusable fetcher for SWR
const fetcher = async <T>(collectionName: string, isDemoMode: boolean): Promise<T[]> => {
    if (!collectionName) return [];
    if (isDemoMode) {
        return getMockData(collectionName);
    }
    const querySnapshot = await getDocs(collection(db, collectionName));

    return querySnapshot.docs.map((doc) => {
        let data = { id: doc.id, ...doc.data() } as any;

        // Migrate legacy purchases to new format
        if (collectionName === 'inbound_shipments') {
            if (!data.items && data.productId) {
                data.items = [{
                    productId: data.productId,
                    quantity: data.quantity || 1,
                    unitCost: data.unitCost || 0,
                    totalCost: data.totalCost || 0
                }];
                data.totalAmount = data.totalCost || 0;
            }
        }

        return data as T;
    });
};

const swrConfig = {
    revalidateOnFocus: false, // Prevents unnecessary reads on window focus
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // 1 minute deduplication
};

export function useStore() {
    const { isAuthLoading, user, isDemoMode } = useAuth() as any; // Temporary fix for type mismatch if any

    const checkDemoMode = () => {
        if (isDemoMode) {
            alert("デモモードではデータの変更・保存はできません。実際の運用データには影響ありません。");
            return true;
        }
        return false;
    };

    // Fetch data using SWR
    const { data: brands = [], mutate: mutateBrands, isLoading: loadingBrands } = useSWR<Brand[]>(["brands", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<Brand>(col, demo), swrConfig);
    const { data: suppliers = [], mutate: mutateSuppliers, isLoading: loadingSuppliers } = useSWR<Supplier[]>(["suppliers", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<Supplier>(col, demo), swrConfig);
    const { data: products = [], mutate: mutateProducts, isLoading: loadingProducts } = useSWR<Product[]>(["products", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<Product>(col, demo), swrConfig);
    const { data: retailStores = [], mutate: mutateRetailStores, isLoading: loadingRetailStores } = useSWR<RetailStore[]>(["retailStores", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<RetailStore>(col, demo), swrConfig);
    const { data: purchases = [], mutate: mutatePurchases, isLoading: loadingPurchases } = useSWR<Purchase[]>(["inbound_shipments", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<Purchase>(col, demo), swrConfig);
    const { data: sales = [], mutate: mutateSales, isLoading: loadingSales } = useSWR<Sale[]>(["sales", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<Sale>(col, demo), swrConfig);
    const { data: paymentRecords = [], mutate: mutatePaymentRecords, isLoading: loadingPayments } = useSWR<PaymentRecord[]>(["payment_records", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<PaymentRecord>(col, demo), swrConfig);
    const { data: dailyReports = [], mutate: mutateDailyReports, isLoading: loadingReports } = useSWR<DailyReport[]>(["daily_reports", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<DailyReport>(col, demo), swrConfig);
    const { data: issuedDocuments = [], mutate: mutateIssuedDocuments } = useSWR<IssuedDocument[]>(["issued_documents", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<IssuedDocument>(col, demo), swrConfig);
    const { data: dailyWeather = [], mutate: mutateDailyWeather } = useSWR<DailyWeather[]>(["daily_weather", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<DailyWeather>(col, demo), swrConfig);
    const { data: invoicePayments = [], mutate: mutateInvoicePayments } = useSWR<InvoicePayment[]>(["invoice_payments", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<InvoicePayment>(col, demo), swrConfig);
    const { data: rawTransactions = [], mutate: mutateTransactions } = useSWR<Transaction[]>(["transactions", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<Transaction>(col, demo), swrConfig);
    const { data: transactionItems = [], mutate: mutateTransactionItems } = useSWR<TransactionItem[]>(["transaction_items", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<TransactionItem>(col, demo), swrConfig);
    const { data: spotRecipients = [], mutate: mutateSpotRecipients } = useSWR<SpotRecipient[]>(["spot_recipients", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<SpotRecipient>(col, demo), swrConfig);
    const { data: challenges = [], mutate: mutateChallenges } = useSWR<BusinessChallenge[]>(["business_challenges", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<BusinessChallenge>(col, demo), swrConfig);
    const { data: stockConversions = [], mutate: mutateStockConversions } = useSWR<StockConversion[]>(["stock_conversions", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<StockConversion>(col, demo), swrConfig);
    const { data: activities = [], mutate: mutateActivities } = useSWR<Activity[]>(["activities", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<Activity>(col, demo), swrConfig);
    const { data: trash = [], mutate: mutateTrash } = useSWR<TrashItem[]>(["trash", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<TrashItem>(col, demo), swrConfig);
    const { data: stockMovements = [], mutate: mutateStockMovements } = useSWR<StockMovement[]>(["stock_movements", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<StockMovement>(col, demo), swrConfig);
    const { data: inventoryAudits = [], mutate: mutateInventoryAudits } = useSWR<InventoryAudit[]>(["inventory_audits", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<InventoryAudit>(col, demo), swrConfig);
    const { data: storeStocks = [], mutate: mutateStoreStocks } = useSWR<StoreStock[]>(["store_stocks", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<StoreStock>(col, demo), swrConfig);
    const { data: storeStockMovements = [], mutate: mutateStoreStockMovements } = useSWR<StoreStockMovement[]>(["store_stock_movements", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<StoreStockMovement>(col, demo), swrConfig);
    const { data: printArchives = [], mutate: mutatePrintArchives, isLoading: loadingPrintArchives } = useSWR<PrintArchive[]>(["print_archives", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<PrintArchive>(col, demo), swrConfig);
    const { data: expenses = [], mutate: mutateExpenses, isLoading: loadingExpenses } = useSWR<Expense[]>(["expenses", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<Expense>(col, demo), swrConfig);
    const { data: businessManuals = [], mutate: mutateBusinessManuals } = useSWR<BusinessManual[]>(["business_manuals", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<BusinessManual>(col, demo), swrConfig);

    // Auto Report Config
    const { data: reportConfig = DEFAULT_REPORT_CONFIG, mutate: mutateReportConfig } = useSWR<AutoReportConfig>(
        "auto_report_config",
        async () => {
            const snap = await getDoc(doc(db, "settings", "auto_report"));
            if (snap.exists()) return { ...DEFAULT_REPORT_CONFIG, ...snap.data() } as AutoReportConfig;
            return DEFAULT_REPORT_CONFIG;
        },
        { ...swrConfig, revalidateOnFocus: false }
    );

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

    const isLoaded = !loadingBrands && !loadingSuppliers && !loadingProducts && !loadingRetailStores && !loadingPurchases && !loadingSales && !loadingPayments && !loadingReports && !loadingPrintArchives;

    const updateReportConfig = async (data: Partial<AutoReportConfig>) => {
        if (checkDemoMode()) return;
        const newConfig = { ...reportConfig, ...data, updatedAt: serverTimestamp() };
        mutateReportConfig(newConfig as AutoReportConfig, false);
        await setDoc(doc(db, "settings", "auto_report"), newConfig, { merge: true });
        mutateReportConfig();
    };

    // --- Activity Logging Helper ---
    const logActivity = async (activity: Omit<Activity, "id" | "createdAt">) => {
        if (isDemoMode) return; // Silent return for activity logging
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
        if (checkDemoMode()) return;
        const newRef = doc(collection(db, "brands"));
        const newBrand = { id: newRef.id, ...brandData };
        mutateBrands([newBrand, ...brands], false);
        await setDoc(newRef, brandData);
        mutateBrands();
    };

    const updateBrand = async (id: string, data: Partial<Omit<Brand, "id">>) => {
        if (checkDemoMode()) return;
        mutateBrands(brands.map((b) => (b.id === id ? { ...b, ...data } : b)), false);
        await updateDoc(doc(db, "brands", id), data);
        mutateBrands();
    };

    const deleteBrand = async (id: string) => {
        if (checkDemoMode()) return;
        await updateDoc(doc(db, "brands", id), { isTrashed: true });
        mutateBrands();
    };

    const restoreBrand = async (id: string) => {
        if (checkDemoMode()) return;
        await updateDoc(doc(db, "brands", id), { isTrashed: false });
        mutateBrands();
    };

    const permanentlyDeleteBrand = async (id: string) => {
        await deleteDoc(doc(db, "brands", id));
        mutateBrands();
    };

    // --- Product Actions ---
    const addProduct = async (productData: Omit<Product, "id" | "createdAt">) => {
        if (checkDemoMode()) return;
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
        if (checkDemoMode()) return;
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

        // Amazon同期が有効な場合、バックグラウンドでプッシュ
        const product = products.find(p => p.id === id);
        if (product && product.amazonSyncEnabled) {
            syncProductToAmazon(id).catch(err => console.error("Amazon sync failed on update:", err));
        }
    };

    const deleteProduct = async (id: string) => {
        if (checkDemoMode()) return;
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
        if (checkDemoMode()) return;
        await updateDoc(doc(db, "products", id), { isTrashed: false });
        mutateProducts();
    };

    const permanentlyDeleteProduct = async (id: string) => {
        await deleteDoc(doc(db, "products", id));
        mutateProducts();
    };

    // --- Supplier Actions ---
    const addSupplier = async (supplierData: Omit<Supplier, "id">) => {
        if (checkDemoMode()) return;
        const newRef = doc(collection(db, "suppliers"));
        const newSupplier = { id: newRef.id, ...supplierData };
        mutateSuppliers([...suppliers, newSupplier], false);
        await setDoc(newRef, supplierData);
        mutateSuppliers();
    };

    const updateSupplier = async (id: string, supplierUpdate: Partial<Omit<Supplier, "id">>) => {
        if (checkDemoMode()) return;
        mutateSuppliers(suppliers.map((s) => (s.id === id ? { ...s, ...supplierUpdate } : s)), false);
        const docRef = doc(db, "suppliers", id);
        await updateDoc(docRef, supplierUpdate);
        mutateSuppliers();
    };

    const deleteSupplier = async (id: string) => {
        if (checkDemoMode()) return;
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
        if (checkDemoMode()) return;
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
        if (checkDemoMode()) return;
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
        if (checkDemoMode()) return;
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
        if (checkDemoMode()) return;
        const newRef = doc(collection(db, "inbound_shipments"));
        const newPurchase = {
            id: newRef.id,
            ...purchaseData,
            createdAt: new Date().toISOString(),
        };

        // If status is received/paid, increment stock
        if (purchaseData.status === 'received' || purchaseData.status === 'paid') {
            const items = purchaseData.items || [];
            for (const item of items) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    const newStock = (product.stock || 0) + item.quantity;
                    await updateProduct(product.id, { stock: newStock });
                    await logStockMovement({
                        productId: product.id,
                        productName: product.name,
                        type: 'in',
                        quantity: item.quantity,
                        reason: 'purchase',
                        referenceId: newRef.id,
                        date: purchaseData.arrivalDate || purchaseData.receivedDate || purchaseData.orderDate
                    });
                }
            }
        }

        mutatePurchases([...purchases, newPurchase as Purchase], false);
        await setDoc(newRef, {
            ...cleanObject(purchaseData),
            createdAt: serverTimestamp(),
        });
        mutatePurchases();
    };

    const updatePurchase = async (id: string, purchaseUpdate: Partial<Omit<Purchase, "id" | "createdAt">>) => {
        const currentPurchase = purchases.find(p => p.id === id);
        if (!currentPurchase) return;

        const wasReceived = (currentPurchase.status === 'received' || currentPurchase.status === 'paid') && !currentPurchase.isTrashed;
        const isNowReceived = (purchaseUpdate.status === 'received' || purchaseUpdate.status === 'paid' || (!purchaseUpdate.status && wasReceived)) && !currentPurchase.isTrashed;

        // 1. If it WAS received, undo the previous stock first
        if (wasReceived) {
            const items = currentPurchase.items || [];
            for (const item of items) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    await updateProduct(product.id, { stock: (product.stock || 0) - item.quantity });
                    await logStockMovement({
                        productId: product.id,
                        productName: product.name,
                        type: 'out',
                        quantity: item.quantity,
                        reason: 'manual', // adjustment for update
                        remarks: `仕入情報の更新による在庫差し戻し (ID: ${id})`,
                        referenceId: id,
                        date: currentPurchase.arrivalDate || currentPurchase.receivedDate || new Date().toISOString().split('T')[0]
                    });
                }
            }
        }

        // 2. If it IS NOW received (or remains received), apply the new stock
        if (isNowReceived) {
            const items = purchaseUpdate.items || currentPurchase.items || [];
            for (const item of items) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    await updateProduct(product.id, { stock: (product.stock || 0) + item.quantity });
                    await logStockMovement({
                        productId: product.id,
                        productName: product.name,
                        type: 'in',
                        quantity: item.quantity,
                        reason: 'purchase',
                        remarks: `仕入情報の更新による在庫反映 (ID: ${id})`,
                        referenceId: id,
                        date: purchaseUpdate.arrivalDate || purchaseUpdate.receivedDate || currentPurchase.arrivalDate || currentPurchase.receivedDate || new Date().toISOString().split('T')[0]
                    });
                }
            }
        }

        // Auto-set dates based on status
        if (purchaseUpdate.status === 'received' && !purchaseUpdate.receivedDate) {
            purchaseUpdate.receivedDate = new Date().toISOString().split('T')[0];
            purchaseUpdate.arrivalDate = purchaseUpdate.receivedDate;
        }
        if (purchaseUpdate.status === 'paid' && !purchaseUpdate.paymentDate) {
            purchaseUpdate.paymentDate = new Date().toISOString().split('T')[0];
        }

        mutatePurchases(purchases.map((p) => p.id === id ? { ...p, ...purchaseUpdate } : p) as Purchase[], false);
        const docRef = doc(db, "inbound_shipments", id);
        await updateDoc(docRef, cleanObject(purchaseUpdate));
        mutatePurchases();
    };

    const deletePurchase = async (id: string) => {
        const purchase = purchases.find(p => p.id === id);
        if (!purchase) return;

        // Correct stock if the purchase was received
        const wasReceived = (purchase.status === 'received' || purchase.status === 'paid');
        if (wasReceived && !purchase.isTrashed) {
            const items = purchase.items || [];
            for (const item of items) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    const newStock = (product.stock || 0) - item.quantity;
                    await updateProduct(product.id, { stock: newStock });
                    await logStockMovement({
                        productId: product.id,
                        productName: product.name,
                        type: 'out',
                        quantity: item.quantity,
                        reason: 'manual',
                        remarks: `仕入記録の削除による在庫差し戻し (ID: ${id})`,
                        referenceId: id,
                        date: new Date().toISOString().split('T')[0]
                    });
                }
            }
        }

        await updateDoc(doc(db, "inbound_shipments", id), { isTrashed: true });
        mutatePurchases();
    };

    const restorePurchase = async (id: string) => {
        const purchase = purchases.find(p => p.id === id);
        if (!purchase) return;

        // Redo stock if the purchase was received
        const wasReceived = (purchase.status === 'received' || purchase.status === 'paid');
        if (wasReceived) {
            const items = purchase.items || [];
            for (const item of items) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    const newStock = (product.stock || 0) + item.quantity;
                    await updateProduct(product.id, { stock: newStock });
                    await logStockMovement({
                        productId: product.id,
                        productName: product.name,
                        type: 'in',
                        quantity: item.quantity,
                        reason: 'purchase',
                        remarks: `仕入記録の復元による在庫反映 (ID: ${id})`,
                        referenceId: id,
                        date: purchase.arrivalDate || purchase.receivedDate || new Date().toISOString().split('T')[0]
                    });
                }
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
        const targetStore = saleData.storeId ? retailStores.find(s => s.id === saleData.storeId) : null;
        const isConsignment = targetStore?.type === 'A';

        for (const item of saleData.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            if (product.isComposite && product.components) {
                // Adjust components
                for (const comp of product.components) {
                    const compProduct = products.find(p => p.id === comp.productId);
                    if (compProduct) {
                        // Overall stock deduction (only if NOT consignment)
                        if (!isConsignment) {
                            const newStock = (compProduct.stock || 0) - (comp.quantity * item.quantity);
                            await updateProduct(compProduct.id, { stock: newStock });
                            await logStockMovement({
                                productId: compProduct.id,
                                productName: compProduct.name,
                                type: 'out',
                                quantity: comp.quantity * item.quantity,
                                reason: 'sale',
                                referenceId: newRef.id,
                                date: saleData.period.split('T')[0]
                            });
                        }

                        // Store stock deduction (only if consignment)
                        if (isConsignment) {
                            await updateStoreStock(saleData.storeId!, compProduct.id, -(comp.quantity * item.quantity), 'sale', newRef.id, saleData.period.split('T')[0]);
                        }
                    }
                }
            } else {
                // Adjust simple product
                // Overall stock deduction (only if NOT consignment)
                if (!isConsignment) {
                    const newStock = (product.stock || 0) - item.quantity;
                    await updateProduct(product.id, { stock: newStock });
                    await logStockMovement({
                        productId: product.id,
                        productName: product.name,
                        type: 'out',
                        quantity: item.quantity,
                        reason: 'sale',
                        referenceId: newRef.id,
                        date: saleData.period.split('T')[0]
                    });
                }

                // Store stock deduction (only if consignment)
                if (isConsignment) {
                    await updateStoreStock(saleData.storeId!, product.id, -item.quantity, 'sale', newRef.id, saleData.period.split('T')[0]);
                }
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
        const currentSale = sales.find(s => s.id === id);
        if (!currentSale) return;

        const newSale = { ...currentSale, ...saleData } as Sale;

        // 1. Reverse old stock adjustments
        const oldStore = currentSale.storeId ? retailStores.find(s => s.id === currentSale.storeId) : null;
        const wasConsignment = oldStore?.type === 'A';

        for (const item of currentSale.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            if (product.isComposite && product.components) {
                for (const comp of product.components) {
                    const compProduct = products.find(p => p.id === comp.productId);
                    if (compProduct) {
                        if (!wasConsignment) {
                            await updateProduct(compProduct.id, { stock: (compProduct.stock || 0) + (comp.quantity * item.quantity) });
                        } else {
                            await updateStoreStock(currentSale.storeId, compProduct.id, (comp.quantity * item.quantity), 'return', id, new Date().toISOString().split('T')[0]);
                        }
                    }
                }
            } else {
                if (!wasConsignment) {
                    await updateProduct(product.id, { stock: (product.stock || 0) + item.quantity });
                } else {
                    await updateStoreStock(currentSale.storeId, product.id, item.quantity, 'return', id, new Date().toISOString().split('T')[0]);
                }
            }
        }

        // 2. Apply new stock adjustments
        const newStore = newSale.storeId ? retailStores.find(s => s.id === newSale.storeId) : null;
        const isNowConsignment = newStore?.type === 'A';

        for (const item of newSale.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            if (product.isComposite && product.components) {
                for (const comp of product.components) {
                    const compProduct = products.find(p => p.id === comp.productId);
                    if (compProduct) {
                        if (!isNowConsignment) {
                            await updateProduct(compProduct.id, { stock: (compProduct.stock || 0) - (comp.quantity * item.quantity) });
                        } else {
                            await updateStoreStock(newSale.storeId, compProduct.id, -(comp.quantity * item.quantity), 'sale', id, newSale.period.split('T')[0]);
                        }
                    }
                }
            } else {
                if (!isNowConsignment) {
                    await updateProduct(product.id, { stock: (product.stock || 0) - item.quantity });
                } else {
                    await updateStoreStock(newSale.storeId, product.id, -item.quantity, 'sale', id, newSale.period.split('T')[0]);
                }
            }
        }

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
        const targetStore = sale.storeId ? retailStores.find(s => s.id === sale.storeId) : null;
        const isConsignment = targetStore?.type === 'A';

        for (const item of sale.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            if (product.isComposite && product.components) {
                // Reverse components
                for (const comp of product.components) {
                    const compProduct = products.find(p => p.id === comp.productId);
                    if (compProduct) {
                        // Revert Overall stock (only if NOT consignment)
                        if (!isConsignment) {
                            const restoredStock = (compProduct.stock || 0) + (comp.quantity * item.quantity);
                            await updateProduct(compProduct.id, { stock: restoredStock });
                        }
                        // Revert Store stock (only if consignment)
                        if (isConsignment) {
                            await updateStoreStock(sale.storeId, compProduct.id, (comp.quantity * item.quantity), 'return', id, new Date().toISOString().split('T')[0]);
                        }
                    }
                }
            } else {
                // Reverse simple product
                // Revert Overall stock (only if NOT consignment)
                if (!isConsignment) {
                    const restoredStock = (product.stock || 0) + item.quantity;
                    await updateProduct(product.id, { stock: restoredStock });
                }
                // Revert Store stock (only if consignment)
                if (isConsignment) {
                    await updateStoreStock(sale.storeId, product.id, item.quantity, 'return', id, new Date().toISOString().split('T')[0]);
                }
            }
        }

        await updateDoc(doc(db, "sales", id), { isTrashed: true });
        mutateSales();
    };

    const restoreSale = async (id: string) => {
        const sale = sales.find(s => s.id === id);
        if (!sale) return;

        // Re-apply stock adjustments
        const targetStore = sale.storeId ? retailStores.find(s => s.id === sale.storeId) : null;
        const isConsignment = targetStore?.type === 'A';

        for (const item of sale.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            if (product.isComposite && product.components) {
                for (const comp of product.components) {
                    const compProduct = products.find(p => p.id === comp.productId);
                    if (compProduct) {
                        // Re-apply Overall stock (only if NOT consignment)
                        if (!isConsignment) {
                            const newStock = (compProduct.stock || 0) - (comp.quantity * item.quantity);
                            await updateProduct(compProduct.id, { stock: newStock });
                        }
                        // Re-apply Store stock (only if consignment)
                        if (isConsignment) {
                            await updateStoreStock(sale.storeId, compProduct.id, -(comp.quantity * item.quantity), 'sale', id, sale.period.split('T')[0]);
                        }
                    }
                }
            } else {
                // Re-apply simple product
                // Re-apply Overall stock (only if NOT consignment)
                if (!isConsignment) {
                    const newStock = (product.stock || 0) - item.quantity;
                    await updateProduct(product.id, { stock: newStock });
                }
                // Re-apply Store stock (only if consignment)
                if (isConsignment) {
                    await updateStoreStock(sale.storeId, product.id, -item.quantity, 'sale', id, sale.period.split('T')[0]);
                }
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
        mutateDailyReports([newReport, ...dailyReports], false);
        await setDoc(newRef, { ...reportData, createdAt: serverTimestamp() });

        // Restocking logic: Transfer from main inventory to store inventory
        if (reportData.type === 'store' && reportData.storeId && reportData.restocking && reportData.restocking.length > 0) {
            for (const item of reportData.restocking) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    // 1. Deduct from main stock
                    await updateProduct(product.id, { stock: (product.stock || 0) - item.qty });
                    await logStockMovement({
                        productId: product.id,
                        productName: product.name,
                        type: 'out',
                        quantity: item.qty,
                        reason: 'manual', // or add 'restock' to reasons
                        remarks: `${reportData.storeName}への補充`,
                        referenceId: newRef.id,
                        date: reportData.date
                    });

                    // 2. Add to store stock
                    const retailStore = retailStores.find(s => s.id === reportData.storeId);
                    if (retailStore?.type === 'A') {
                        await updateStoreStock(reportData.storeId, product.id, item.qty, 'restock', newRef.id, reportData.date);
                    }
                }
            }
        }
        logActivity({
            type: 'create',
            category: 'report',
            title: `業務日報「${reportData.title || '無題'}」を提出しました`,
            detail: `担当: ${reportData.worker}`
        });
        mutateDailyReports();
    };

    const deleteDailyReport = async (id: string) => {
        const report = dailyReports.find(r => r.id === id);
        if (!report) return;

        // Reverse restocking logic
        if (report.type === 'store' && report.storeId && report.restocking && report.restocking.length > 0) {
            for (const item of report.restocking) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    // Reverse Deduction from main stock
                    await updateProduct(product.id, { stock: (product.stock || 0) + item.qty });
                    
                    // Reverse Addition to store stock
                    const retailStore = retailStores.find(s => s.id === report.storeId);
                    if (retailStore?.type === 'A') {
                        await updateStoreStock(report.storeId, product.id, -item.qty, 'restock', id, report.date);
                    }
                }
            }
        }

        await updateDoc(doc(db, "daily_reports", id), { isTrashed: true });
        mutateDailyReports();
    };

    const restoreDailyReport = async (id: string) => {
        const report = dailyReports.find(r => r.id === id);
        if (!report) return;

        // Re-apply restocking logic
        if (report.type === 'store' && report.storeId && report.restocking && report.restocking.length > 0) {
            for (const item of report.restocking) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    await updateProduct(product.id, { stock: (product.stock || 0) - item.qty });
                    const retailStore = retailStores.find(s => s.id === report.storeId);
                    if (retailStore?.type === 'A') {
                        await updateStoreStock(report.storeId, product.id, item.qty, 'restock', id, report.date);
                    }
                }
            }
        }

        await updateDoc(doc(db, "daily_reports", id), { isTrashed: false });
        mutateDailyReports();
    };

    const permanentlyDeleteDailyReport = async (id: string) => {
        await deleteDoc(doc(db, "daily_reports", id));
        mutateDailyReports();
    };

    const updateDailyReport = async (id: string, data: Partial<Omit<DailyReport, "id" | "createdAt">>) => {
        const currentReport = dailyReports.find(r => r.id === id);
        if (!currentReport) return;

        // 1. Reverse old restocking
        if (currentReport.type === 'store' && currentReport.storeId && currentReport.restocking && currentReport.restocking.length > 0) {
            for (const item of currentReport.restocking) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    await updateProduct(product.id, { stock: (product.stock || 0) + item.qty });
                    const retailStore = retailStores.find(s => s.id === currentReport.storeId);
                    if (retailStore?.type === 'A') {
                        await updateStoreStock(currentReport.storeId, product.id, -item.qty, 'restock', id, currentReport.date);
                    }
                }
            }
        }

        const newReport = { ...currentReport, ...data } as DailyReport;

        // 2. Apply new restocking
        if (newReport.type === 'store' && newReport.storeId && newReport.restocking && newReport.restocking.length > 0) {
            for (const item of newReport.restocking) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    await updateProduct(product.id, { stock: (product.stock || 0) - item.qty });
                    const retailStore = retailStores.find(s => s.id === newReport.storeId);
                    if (retailStore?.type === 'A') {
                        await updateStoreStock(newReport.storeId, product.id, item.qty, 'restock', id, newReport.date);
                    }
                }
            }
        }

        mutateDailyReports(dailyReports.map(r => r.id === id ? { ...r, ...data } : r), false);
        await updateDoc(doc(db, "daily_reports", id), { ...cleanObject(data), updatedAt: serverTimestamp() });
        mutateDailyReports();
    };

    // --- Issued Document Actions ---

    /** 帳票番号の採番: 同じ prefix の既存番号を参照して次の連番を返す */
    const generateDocNumber = (type: 'delivery_note' | 'payment_summary' | 'invoice' | 'receipt', year: string): string => {
        const prefix = type === 'delivery_note' ? 'DN' : type === 'payment_summary' ? 'PM' : type === 'receipt' ? 'RC' : 'INV';
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

        // --- Stock Deduction for Delivery Note ---
        if (data.type === 'delivery_note' && data.details) {
            for (const item of data.details) {
                if (item.productId) {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        if (product.isComposite && product.components) {
                            for (const comp of product.components) {
                                const compProduct = products.find(p => p.id === comp.productId);
                                if (compProduct) {
                                    await updateProduct(compProduct.id, { stock: (compProduct.stock || 0) - (comp.quantity * item.quantity) });
                                    await logStockMovement({
                                        productId: compProduct.id,
                                        productName: compProduct.name,
                                        type: 'out',
                                        quantity: comp.quantity * item.quantity,
                                        reason: 'sale',
                                        remarks: `納品書発行 (${data.docNumber}) による出庫`,
                                        referenceId: newRef.id,
                                        date: data.issuedDate
                                    });
                                }
                            }
                        } else {
                            await updateProduct(product.id, { stock: (product.stock || 0) - item.quantity });
                            await logStockMovement({
                                productId: product.id,
                                productName: product.name,
                                type: 'out',
                                quantity: item.quantity,
                                reason: 'sale',
                                remarks: `納品書発行 (${data.docNumber}) による出庫`,
                                referenceId: newRef.id,
                                date: data.issuedDate
                            });
                        }
                    }
                }
            }
        }

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
            taxType: original.taxType ?? 'inclusive',
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
            taxType: original.taxType ?? 'inclusive',
            details: original.details,
            adjustments: original.adjustments,
            finalAdjustment: original.finalAdjustment,
            memo: original.memo,
            transactionId: original.transactionId, // Carry over transaction link
            sourceDocId: id, // Link to source delivery note
            fulfillmentStatus: 'pending', // Default for new invoice
        });
    };

    const convertMultipleToInvoice = async (ids: string[]): Promise<IssuedDocument | null> => {
        const originals = issuedDocuments.filter(d => ids.includes(d.id) && d.type === 'delivery_note');
        if (originals.length === 0) return null;

        // Ensure all have same recipient
        const first = originals[0];
        const allSameRecipient = originals.every(d =>
            d.recipientType === first.recipientType &&
            d.storeId === first.storeId &&
            d.supplierId === first.supplierId &&
            d.spotRecipientId === first.spotRecipientId
        );
        if (!allSameRecipient) {
            alert("異なる宛先の納品書を合算することはできません。");
            return null;
        }

        const year = new Date().getFullYear().toString();
        const newDocNumber = generateDocNumber('invoice', year);

        // Sort originals by issuedDate (oldest first)
        const sortedOriginals = [...originals].sort((a, b) => (a.issuedDate || "").localeCompare(b.issuedDate || ""));

        // New logic: Flat aggregation with remarks (preserve all items)
        const aggregatedItems: InvoiceItem[] = [];
        for (const doc of sortedOriginals) {
            if (!doc.details) continue;
            const dateStr = doc.issuedDate; // YYYY-MM-DD
            const formattedDate = dateStr ? `${parseInt(dateStr.split('-')[1])}月${parseInt(dateStr.split('-')[2])}日` : "";
            
            for (const item of doc.details) {
                aggregatedItems.push({
                    ...item,
                    id: crypto.randomUUID(),
                    remarks: formattedDate ? `${formattedDate}分 ${item.remarks || ""}`.trim() : item.remarks
                });
            }
        }

        const totalAmount = aggregatedItems.reduce((sum, item) => sum + item.subtotal, 0);

        return saveIssuedDocument({
            type: 'invoice',
            docNumber: newDocNumber,
            status: 'draft',
            issuedDate: new Date().toISOString().split('T')[0],
            period: first.period, // Use first as default
            recipientType: first.recipientType,
            storeId: first.storeId,
            supplierId: first.supplierId,
            spotRecipientId: first.spotRecipientId,
            recipientName: first.recipientName,
            totalAmount: totalAmount,
            taxRate: first.taxRate || 8,
            taxType: first.taxType || 'inclusive',
            details: aggregatedItems,
            adjustments: [],
            finalAdjustment: 0,
            memo: originals.map(d => d.docNumber).join(', ') + " の合算請求書",
            sourceDocIds: ids,
            fulfillmentStatus: 'pending',
        });
    };

    const updateIssuedDocument = async (id: string, data: Partial<Omit<IssuedDocument, 'id' | 'createdAt'>>) => {
        const oldDoc = issuedDocuments.find(d => d.id === id);
        if (oldDoc) {
            // 1. Reverse old stock if it was a delivery note
            if (oldDoc.type === 'delivery_note' && oldDoc.details && !oldDoc.isTrashed) {
                for (const item of oldDoc.details) {
                    if (item.productId) {
                        const product = products.find(p => p.id === item.productId);
                        if (product) {
                            if (product.isComposite && product.components) {
                                for (const comp of product.components) {
                                    const compProduct = products.find(p => p.id === comp.productId);
                                    if (compProduct) {
                                        await updateProduct(compProduct.id, { stock: (compProduct.stock || 0) + (comp.quantity * item.quantity) });
                                    }
                                }
                            } else {
                                await updateProduct(product.id, { stock: (product.stock || 0) + item.quantity });
                            }
                        }
                    }
                }
            }

            // 2. Apply new stock if the updated doc is a delivery note
            const newDoc = { ...oldDoc, ...data } as IssuedDocument;
            if (newDoc.type === 'delivery_note' && newDoc.details && !newDoc.isTrashed) {
                for (const item of newDoc.details) {
                    if (item.productId) {
                        const product = products.find(p => p.id === item.productId);
                        if (product) {
                            if (product.isComposite && product.components) {
                                for (const comp of product.components) {
                                    const compProduct = products.find(p => p.id === comp.productId);
                                    if (compProduct) {
                                        await updateProduct(compProduct.id, { stock: (compProduct.stock || 0) - (comp.quantity * item.quantity) });
                                    }
                                }
                            } else {
                                await updateProduct(product.id, { stock: (product.stock || 0) - item.quantity });
                            }
                        }
                    }
                }
            }
        }

        mutateIssuedDocuments(issuedDocuments.map(d => d.id === id ? { ...d, ...data } : d), false);
        await updateDoc(doc(db, 'issued_documents', id), cleanObject(data));
        mutateIssuedDocuments();
    };

    const deleteIssuedDocument = async (id: string) => {
        const oldDoc = issuedDocuments.find(d => d.id === id);
        if (oldDoc && oldDoc.type === 'delivery_note' && oldDoc.details && !oldDoc.isTrashed) {
            // Restore stock
            for (const item of oldDoc.details) {
                if (item.productId) {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        if (product.isComposite && product.components) {
                            for (const comp of product.components) {
                                const compProduct = products.find(p => p.id === comp.productId);
                                if (compProduct) {
                                    await updateProduct(compProduct.id, { stock: (compProduct.stock || 0) + (comp.quantity * item.quantity) });
                                }
                            }
                        } else {
                            await updateProduct(product.id, { stock: (product.stock || 0) + item.quantity });
                        }
                    }
                }
            }
        }
        await updateDoc(doc(db, 'issued_documents', id), { isTrashed: true });
        mutateIssuedDocuments();
    };


    const restoreIssuedDocument = async (id: string) => {
        const docToRestore = issuedDocuments.find(d => d.id === id);
        if (docToRestore && docToRestore.type === 'delivery_note' && docToRestore.details && docToRestore.isTrashed) {
            // Re-deduct stock
            for (const item of docToRestore.details) {
                if (item.productId) {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        if (product.isComposite && product.components) {
                            for (const comp of product.components) {
                                const compProduct = products.find(p => p.id === comp.productId);
                                if (compProduct) {
                                    await updateProduct(compProduct.id, { stock: (compProduct.stock || 0) - (comp.quantity * item.quantity) });
                                }
                            }
                        } else {
                            await updateProduct(product.id, { stock: (product.stock || 0) - item.quantity });
                        }
                    }
                }
            }
        }
        await updateDoc(doc(db, 'issued_documents', id), { isTrashed: false });
        mutateIssuedDocuments();
    };


    const permanentlyDeleteIssuedDocument = async (id: string) => {
        await deleteDoc(doc(db, 'issued_documents', id));
        mutateIssuedDocuments();
    };

    // --- Invoice Payment Actions ---
    const addInvoicePayment = async (data: Omit<InvoicePayment, 'id' | 'createdAt'>): Promise<InvoicePayment> => {
        const newRef = doc(collection(db, 'invoice_payments'));
        const newPayment: InvoicePayment = { id: newRef.id, ...data, createdAt: new Date().toISOString() };
        mutateInvoicePayments([newPayment, ...invoicePayments], false);
        await setDoc(newRef, { ...cleanObject(data), createdAt: serverTimestamp() });
        mutateInvoicePayments();
        return newPayment;
    };

    const updateInvoicePayment = async (id: string, data: Partial<Omit<InvoicePayment, 'id' | 'createdAt'>>) => {
        mutateInvoicePayments(invoicePayments.map(p => p.id === id ? { ...p, ...data } : p), false);
        await updateDoc(doc(db, 'invoice_payments', id), cleanObject(data));
        mutateInvoicePayments();
    };

    const deleteInvoicePayment = async (id: string) => {
        await updateDoc(doc(db, 'invoice_payments', id), { isTrashed: true });
        mutateInvoicePayments();
    };

    const restoreInvoicePayment = async (id: string) => {
        await updateDoc(doc(db, 'invoice_payments', id), { isTrashed: false });
        mutateInvoicePayments();
    };

    const permanentlyDeleteInvoicePayment = async (id: string) => {
        mutateInvoicePayments(invoicePayments.filter(p => p.id !== id), false);
        await deleteDoc(doc(db, "invoice_payments", id));
        mutateInvoicePayments();
    };

    // --- Transaction Actions ---

    // 計算済みの transactions を導出
    const transactions = useMemo(() => {
        return rawTransactions.map(t => {
            const payments = invoicePayments.filter(p => p.transactionId === t.id && !p.isTrashed);
            const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
            return {
                ...t,
                paidAmount,
                balanceAmount: t.totalAmount - paidAmount
            };
        });
    }, [rawTransactions, invoicePayments]);

    const addTransaction = async (data: Omit<Transaction, "id" | "createdAt" | "updatedAt">) => {
        const newRef = doc(collection(db, "transactions"));
        const payload = {
            ...data,
            id: newRef.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        mutateTransactions([payload as Transaction, ...rawTransactions], false);
        await setDoc(newRef, payload);
        mutateTransactions();
        return newRef.id;
    };

    const updateTransaction = async (id: string, data: Partial<Transaction>) => {
        const docRef = doc(db, "transactions", id);
        const cleaned = cleanObject(data);
        mutateTransactions(rawTransactions.map(t => t.id === id ? { ...t, ...cleaned } : t), false);
        await updateDoc(docRef, { ...cleaned, updatedAt: serverTimestamp() });
        mutateTransactionItems(); // trigger re-fetch if needed
        mutateTransactions();
    };

    const deleteTransaction = async (id: string) => {
        const transaction = rawTransactions.find(t => t.id === id);
        if (!transaction) return;
        await moveToTrash(id, "transactions", transaction, `取引: ${transaction.customerName} (${transaction.orderDate})`);
        mutateTransactions(rawTransactions.filter(t => t.id !== id), false);
        await deleteDoc(doc(db, "transactions", id));
        mutateTransactions();
    };

    const restoreTransaction = async (id: string) => {
        await restoreFromTrash(id);
        mutateTransactions();
    };

    const permanentlyDeleteTransaction = async (id: string) => {
        mutateTransactions(rawTransactions.filter(t => t.id !== id), false);
        await deleteDoc(doc(db, "transactions", id));
        mutateTransactions();
    };

    // --- Transaction Item Actions ---
    const addTransactionItem = async (data: Omit<TransactionItem, "id" | "createdAt" | "updatedAt">) => {
        const newRef = doc(collection(db, "transaction_items"));
        const payload = {
            ...data,
            id: newRef.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        mutateTransactionItems([payload as TransactionItem, ...transactionItems], false);
        await setDoc(newRef, payload);
        mutateTransactionItems();
        return newRef.id;
    };

    const updateTransactionItem = async (id: string, data: Partial<TransactionItem>) => {
        const docRef = doc(db, "transaction_items", id);
        const cleaned = cleanObject(data);
        mutateTransactionItems(transactionItems.map(t => t.id === id ? { ...t, ...cleaned } : t), false);
        await updateDoc(docRef, { ...cleaned, updatedAt: serverTimestamp() });
        mutateTransactionItems();
    };

    const deleteTransactionItem = async (id: string) => {
        const item = transactionItems.find(t => t.id === id);
        if (!item) return;
        await moveToTrash(id, "transaction_items", item, `取引明細: ${item.productName}`);
        mutateTransactionItems(transactionItems.filter(t => t.id !== id), false);
        await deleteDoc(doc(db, "transaction_items", id));
        mutateTransactionItems();
    };

    const restoreTransactionItem = async (id: string) => {
        await restoreFromTrash(id);
        mutateTransactionItems();
    };

    const permanentlyDeleteTransactionItem = async (id: string) => {
        mutateTransactionItems(transactionItems.filter(t => t.id !== id), false);
        await deleteDoc(doc(db, "transaction_items", id));
        mutateTransactionItems();
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

    const updateSpotRecipient = async (id: string, data: Partial<Omit<SpotRecipient, 'id' | 'createdAt'>>) => {
        mutateSpotRecipients(spotRecipients.map(r => r.id === id ? { ...r, ...data } : r), false);
        await updateDoc(doc(db, 'spot_recipients', id), cleanObject(data));
        mutateSpotRecipients();
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

    const permanentlyDeleteAllSpotRecipients = async () => {
        const batch = writeBatch(db);
        spotRecipients.forEach(r => {
            batch.delete(doc(db, 'spot_recipients', r.id));
        });
        await batch.commit();
        mutateSpotRecipients([]);
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

    const addChallengeComment = async (id: string, comment: Omit<ChallengeComment, 'id' | 'createdAt'>) => {
        const challenge = (challenges || []).find(c => c.id === id);
        if (!challenge) return;

        const newComment: ChallengeComment = {
            id: crypto.randomUUID(),
            ...comment,
            createdAt: new Date().toISOString()
        };

        const updatedComments = [...(challenge.comments || []), newComment];
        
        mutateChallenges(challenges.map(c => c.id === id ? { ...c, comments: updatedComments } : c), false);
        await updateDoc(doc(db, "business_challenges", id), { 
            comments: updatedComments,
            updatedAt: serverTimestamp()
        });
        mutateChallenges();
    };

    const updateChallengeComment = async (challengeId: string, commentId: string, content: string) => {
        const challenge = (challenges || []).find(c => c.id === challengeId);
        if (!challenge || !challenge.comments) return;

        const updatedComments = challenge.comments.map(c => 
            c.id === commentId ? { ...c, content, updatedAt: new Date().toISOString() } : c
        );

        mutateChallenges(challenges.map(c => c.id === challengeId ? { ...c, comments: updatedComments } : c), false);
        await updateDoc(doc(db, "business_challenges", challengeId), {
            comments: updatedComments,
            updatedAt: serverTimestamp()
        });
        mutateChallenges();
    };

    const deleteChallengeComment = async (challengeId: string, commentId: string) => {
        const challenge = (challenges || []).find(c => c.id === challengeId);
        if (!challenge || !challenge.comments) return;

        const updatedComments = challenge.comments.filter(c => c.id !== commentId);

        mutateChallenges(challenges.map(c => c.id === challengeId ? { ...c, comments: updatedComments } : c), false);
        await updateDoc(doc(db, "business_challenges", challengeId), {
            comments: updatedComments,
            updatedAt: serverTimestamp()
        });
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

    const fetchAndSaveWeatherIfNeeded = async (storeId: string, lat: number, lng: number, date: string) => {
        const today = new Date().toISOString().split('T')[0];
        // Only fetch for today or a specific target date
        if (!date) date = today;

        const weatherId = `${storeId}_${date}`;
        // Check if we already have it
        if (dailyWeather.some(w => w.id === weatherId)) {
            return; // Already exists
        }

        try {
            const res = await fetch(`/api/weather?lat=${lat}&lon=${lng}`);
            if (!res.ok) throw new Error("Failed to fetch weather");
            const data = await res.json();

            if (data.weather) {
                await saveDailyWeather({
                    id: weatherId,
                    storeId,
                    date,
                    weather: data.weather,
                    weatherMain: data.main,
                    temp: data.temp,
                    tempMin: data.tempMin,
                    tempMax: data.tempMax,
                    humidity: data.humidity,
                    windSpeed: data.windSpeed
                });
            }
        } catch (error) {
            console.error("Failed to fetch/save weather automatically:", error);
        }
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
            const isReceived = (purchase.status === 'received' || purchase.status === 'paid');
            if (isReceived) {
                const purchaseItems = purchase.items || [];
                for (const pItem of purchaseItems) {
                    const product = products.find(p => p.id === pItem.productId);
                    if (product) {
                        await updateProduct(product.id, { stock: (product.stock || 0) + pItem.quantity });
                    }
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
        mutateTransactions();
        mutateSpotRecipients();
        mutateChallenges();
    };

    const permanentlyDeleteFromTrash = async (id: string) => {
        mutateTrash(trash.filter(t => t.id !== id), false);
        await deleteDoc(doc(db, "trash", id));
        mutateTrash();
    };
    const logStockMovement = async (movement: Omit<StockMovement, "id" | "createdAt">) => {
        const newRef = doc(collection(db, "stock_movements"));
        const newMovement = {
            id: newRef.id,
            ...movement,
            createdAt: new Date().toISOString()
        };
        mutateStockMovements([newMovement as StockMovement, ...stockMovements], false);
        await setDoc(newRef, {
            ...movement,
            createdAt: serverTimestamp()
        });
        mutateStockMovements();
    };

    const logStoreStockMovement = async (movement: Omit<StoreStockMovement, "id" | "createdAt">) => {
        const newRef = doc(collection(db, "store_stock_movements"));
        const newMovement = {
            id: newRef.id,
            ...movement,
            createdAt: new Date().toISOString()
        };
        mutateStoreStockMovements([newMovement as StoreStockMovement, ...storeStockMovements], false);
        await setDoc(newRef, {
            ...movement,
            createdAt: serverTimestamp()
        });
        mutateStoreStockMovements();
    };

    const updateStoreStock = async (storeId: string, productId: string, qty: number, reason: StoreStockMovement['reason'], referenceId?: string, date?: string, isAbsolute: boolean = false) => {
        const docId = `${storeId}_${productId}`;
        const storeStockRef = doc(db, "store_stocks", docId);
        const currentSS = storeStocks.find(ss => ss.id === docId);
        const currentStock = currentSS?.stock || 0;

        let newStock: number;
        let diff: number;

        if (isAbsolute) {
            newStock = qty;
            diff = newStock - currentStock;
        } else {
            diff = qty;
            newStock = currentStock + diff;
        }

        if (diff === 0 && !isAbsolute) return; // No change needed

        const product = products.find(p => p.id === productId);

        // Update Store Stock
        await setDoc(storeStockRef, {
            storeId,
            productId,
            stock: newStock,
            updatedAt: serverTimestamp()
        }, { merge: true });

        mutateStoreStocks((prev = []) => {
            const exists = prev.some(ss => ss.id === docId);
            if (exists) return prev.map(ss => ss.id === docId ? { ...ss, stock: newStock } : ss);
            return [{ id: docId, storeId, productId, stock: newStock } as StoreStock, ...prev];
        }, false);

        // Log Store Movement
        await logStoreStockMovement({
            storeId,
            productId,
            productName: product?.name || "不明な商品",
            type: diff >= 0 ? 'in' : 'out',
            quantity: Math.abs(diff),
            reason,
            referenceId,
            date: date || new Date().toISOString().split('T')[0]
        });

        mutateStoreStocks();
    };

    const addInventoryAudit = async (auditData: Omit<InventoryAudit, "id" | "createdAt">) => {
        const newRef = doc(collection(db, "inventory_audits"));
        const newAudit = {
            id: newRef.id,
            ...auditData,
            createdAt: new Date().toISOString()
        };
        mutateInventoryAudits([newAudit as InventoryAudit, ...inventoryAudits], false);
        await setDoc(newRef, {
            ...auditData,
            createdAt: serverTimestamp()
        });
        mutateInventoryAudits();
        return newRef.id;
    };

    const updateInventoryAudit = async (id: string, auditUpdate: Partial<Omit<InventoryAudit, "id" | "createdAt">>) => {
        mutateInventoryAudits(inventoryAudits.map(a => a.id === id ? { ...a, ...auditUpdate } : a), false);
        await updateDoc(doc(db, "inventory_audits", id), cleanObject(auditUpdate));
        mutateInventoryAudits();
    };

    const completeInventoryAudit = async (id: string, audit: InventoryAudit) => {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        const date = now.split('T')[0];

        // 1. Update each product stock and log movement
        for (const item of audit.items) {
            if (item.diff !== 0) {
                // Adjust product stock
                const productRef = doc(db, "products", item.productId);
                const currentProduct = products.find(p => p.id === item.productId);
                const newStock = (currentProduct?.stock || 0) + item.diff;
                batch.update(productRef, {
                    stock: newStock,
                    updatedAt: serverTimestamp()
                });

                // Log movement
                const moveRef = doc(collection(db, "stock_movements"));
                batch.set(moveRef, {
                    productId: item.productId,
                    productName: item.productName,
                    type: 'adjustment',
                    quantity: item.diff,
                    reason: 'audit',
                    referenceId: id,
                    date: date,
                    createdAt: serverTimestamp()
                });
            }
        }

        // 2. Mark audit as completed
        const auditRef = doc(db, "inventory_audits", id);
        batch.update(auditRef, {
            status: 'completed',
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await batch.commit();

        mutateProducts();
        mutateStockMovements();
        mutateInventoryAudits();

        logActivity({
            type: 'system',
            category: 'other',
            title: `棚卸し（${audit.date}）を完了しました`,
            detail: `${audit.items.filter(i => i.diff !== 0).length}件の在庫差異を調整しました`
        });
    };

    // --- Print Archive Actions ---
    const addPrintArchive = async (data: Omit<PrintArchive, "id" | "createdAt" | "updatedAt" | "history">) => {
        const newRef = doc(collection(db, "print_archives"));
        const newArchive: PrintArchive = {
            id: newRef.id,
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            history: [{
                id: Math.random().toString(36).substring(2, 9),
                action: 'upload',
                timestamp: new Date().toISOString(),
                detail: 'ファイルをアップロードしました'
            }]
        };
        mutatePrintArchives([newArchive, ...printArchives], false);
        await setDoc(newRef, {
            ...data,
            history: newArchive.history,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        mutatePrintArchives();
    };

    const updatePrintArchive = async (id: string, data: Partial<Omit<PrintArchive, "id" | "createdAt" | "updatedAt">>) => {
        mutatePrintArchives(printArchives.map(a => a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a), false);
        await updateDoc(doc(db, "print_archives", id), {
            ...data,
            updatedAt: serverTimestamp()
        });
        mutatePrintArchives();
    };

    const deletePrintArchive = async (id: string) => {
        await updateDoc(doc(db, "print_archives", id), { isTrashed: true });
        mutatePrintArchives();
    };

    const logArchiveActivity = async (id: string, action: PrintArchiveHistory['action'], detail?: string) => {
        const archive = printArchives.find(a => a.id === id);
        if (!archive) return;

        const newHistory: PrintArchiveHistory = {
            id: Math.random().toString(36).substring(2, 9),
            action,
            timestamp: new Date().toISOString(),
            detail
        };

        const updatedHistory = [newHistory, ...(archive.history || [])];
        mutatePrintArchives(printArchives.map(a => a.id === id ? { ...a, history: updatedHistory, updatedAt: new Date().toISOString() } : a), false);

        await updateDoc(doc(db, "print_archives", id), {
            history: updatedHistory,
            updatedAt: serverTimestamp()
        });
        mutatePrintArchives();
    };

    const restorePrintArchive = async (id: string) => {
        await updateDoc(doc(db, "print_archives", id), { isTrashed: false });
        mutatePrintArchives();
    };

    const permanentlyDeletePrintArchive = async (id: string) => {
        await deleteDoc(doc(db, "print_archives", id));
        mutatePrintArchives();
    };

    // --- Business Manual Actions ---
    const addBusinessManual = async (data: Omit<BusinessManual, "id" | "updatedAt" | "createdAt">) => {
        if (checkDemoMode()) return;
        const newRef = doc(collection(db, "business_manuals"));
        const newManual: BusinessManual = {
            id: newRef.id,
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        mutateBusinessManuals([newManual, ...businessManuals], false);
        await setDoc(newRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        mutateBusinessManuals();
        return newRef.id;
    };

    const updateBusinessManual = async (id: string, data: Partial<Omit<BusinessManual, "id" | "createdAt" | "updatedAt">>) => {
        if (checkDemoMode()) return;
        mutateBusinessManuals(businessManuals.map(m => m.id === id ? { ...m, ...data, updatedAt: new Date().toISOString() } : m), false);
        await updateDoc(doc(db, "business_manuals", id), {
            ...data,
            updatedAt: serverTimestamp()
        });
        mutateBusinessManuals();
    };

    const deleteBusinessManual = async (id: string) => {
        if (checkDemoMode()) return;
        await deleteDoc(doc(db, "business_manuals", id));
        mutateBusinessManuals();
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
        convertMultipleToInvoice,
        updateIssuedDocument,
        deleteIssuedDocument,
        // Invoice Payments
        invoicePayments,
        addInvoicePayment,
        updateInvoicePayment,
        deleteInvoicePayment,
        // Spot Recipients
        spotRecipients,
        addSpotRecipient,
        updateSpotRecipient,
        deleteSpotRecipient,
        permanentlyDeleteAllSpotRecipients,
        // Business Challenges
        challenges,
        addChallenge,
        addChallengeComment,
        updateChallengeComment,
        deleteChallengeComment,
        updateChallenge,
        deleteChallenge,
        // Stock Conversions
        stockConversions,
        addStockConversion,
        // Daily Weather
        dailyWeather,
        saveDailyWeather,
        fetchAndSaveWeatherIfNeeded,
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
        restoreInvoicePayment,
        permanentlyDeleteInvoicePayment,
        // Transactions
        transactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        restoreTransaction,
        permanentlyDeleteTransaction,
        // Transaction Items
        transactionItems,
        addTransactionItem,
        updateTransactionItem,
        deleteTransactionItem,
        restoreTransactionItem,
        permanentlyDeleteTransactionItem,
        // Spot Recipients
        restoreSpotRecipient,
        permanentlyDeleteSpotRecipient,
        // Challenges
        restoreChallenge,
        permanentlyDeleteChallenge,
        trash,
        restoreFromTrash,
        permanentlyDeleteFromTrash,
        // Auto Report
        reportConfig,
        updateReportConfig,
        // Inventory
        stockMovements,
        inventoryAudits,
        logStockMovement,
        addInventoryAudit,
        updateInventoryAudit,
        completeInventoryAudit,
        loadingProducts,
        // Store Stocks
        storeStocks,
        storeStockMovements,
        updateStoreStock,
        // Print Archives
        printArchives,
        addPrintArchive,
        updatePrintArchive,
        deletePrintArchive,
        logArchiveActivity,
        restorePrintArchive,
        permanentlyDeletePrintArchive,
        // Expenses
        expenses,
        addExpense: async (data: Omit<Expense, "id" | "createdAt" | "updatedAt">) => {
            const newRef = doc(collection(db, "expenses"));
            const newExpense: Expense = {
                id: newRef.id,
                ...data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            mutateExpenses([newExpense, ...expenses], false);
            await setDoc(newRef, {
                ...data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            mutateExpenses();
            return newRef.id;
        },
        updateExpense: async (id: string, data: Partial<Omit<Expense, "id" | "createdAt" | "updatedAt">>) => {
            mutateExpenses(expenses.map(e => e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e), false);
            await updateDoc(doc(db, "expenses", id), {
                ...data,
                updatedAt: serverTimestamp()
            });
            mutateExpenses();
        },
        deleteExpense: async (id: string) => {
            await updateDoc(doc(db, "expenses", id), { isTrashed: true });
            mutateExpenses();
        },
        restoreExpense: async (id: string) => {
            await updateDoc(doc(db, "expenses", id), { isTrashed: false });
            mutateExpenses();
        },
        permanentlyDeleteExpense: async (id: string) => {
            await deleteDoc(doc(db, "expenses", id));
            mutateExpenses();
        },
        // Business Manuals
        businessManuals,
        addBusinessManual,
        updateBusinessManual,
        deleteBusinessManual,
        // Mutation hooks for specialized refreshing
        mutateSales,
        mutateDailyReports,
        mutateTransactions,
        mutateTransactionItems,
        mutateProducts,
        mutateStockMovements,
        mutateRetailStores
    };

}
