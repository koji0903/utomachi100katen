// src/lib/store.ts
"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, getDoc, writeBatch, increment, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiFetch, DemoModeError, checkIsDemoMode } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";
import { getMockData } from "@/lib/mockData";
import { syncProductToAmazon } from "@/app/actions/amazon";
import {
    diffInventoryEffects,
    getDailyReportInventoryEffects,
    getPurchaseInventoryEffects,
    getSaleInventoryEffects,
    mergeInventoryEffects,
    normalizeSaleTotals,
    type InventoryEffect,
} from "@/lib/inventoryConsistency";

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
import { applyRounding, type RoundingMode } from "@/lib/taxUtils";
import type { PrintArchive, PrintArchiveHistory } from "./types/printArchive";
import type { Expense, ExpenseCategory, PaymentMethod } from "./types/expense";

export interface FixedCostItem {
    id: string;
    enabled: boolean;
    category: string; // 標準カテゴリの選択とカスタム文字列設定を両立するため string に緩和
    item: string;
    amount: number;
    paymentMethod: PaymentMethod;
    vendor: string;
}

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
    fixedCostTemplates?: FixedCostItem[]; // 固定費初期テンプレート
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
    logoUrl: '',
    sealUrl: '',
    fixedCostTemplates: [
        {
            id: "rent",
            enabled: true,
            category: "地代家賃",
            item: "店舗・倉庫家賃",
            amount: 150000,
            paymentMethod: "銀行振込",
            vendor: "不動産管理会社"
        },
        {
            id: "payroll",
            enabled: true,
            category: "給与・手当",
            item: "店舗スタッフ給与・手当",
            amount: 300000,
            paymentMethod: "銀行振込",
            vendor: "従業員一同"
        },
        {
            id: "outsourcing",
            enabled: true,
            category: "外注費",
            item: "配送・ロジスティクス委託費",
            amount: 85000,
            paymentMethod: "銀行振込",
            vendor: "ヤマト運輸・佐川急便"
        },
        {
            id: "utilities",
            enabled: true,
            category: "水道光熱費",
            item: "店舗電気・ガス・水道代（概算）",
            amount: 28000,
            paymentMethod: "クレジット",
            vendor: "東京電力・東京ガス"
        },
        {
            id: "subscription",
            enabled: true,
            category: "諸会費・サブスク",
            item: "POSレジ・会計・在庫システム月額",
            amount: 12800,
            paymentMethod: "クレジット",
            vendor: "スマレジ・MFクラウド"
        },
        {
            id: "other_advisory",
            enabled: true,
            category: "その他",
            item: "税理士・会計士顧問料",
            amount: 10000,
            paymentMethod: "銀行振込",
            vendor: "支払先名"
        },
        {
            id: "other_misc",
            enabled: true,
            category: "その他2",
            item: "その他固定費項目",
            amount: 10000,
            paymentMethod: "銀行振込",
            vendor: "支払先名"
        }
    ]
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
    wholesaleRate?: number; // Percentage of selling price (e.g., 60 for 60%)
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
    linkedConsignmentStoreId?: string; // 紐付け先委託販売先 (タイプB用)
}

export const isConsignmentStore = (store?: RetailStore | null): boolean => {
    if (!store) return false;
    return store.type === 'A' || (store.type as string) === 'consignment';
};


// 日報
export interface RestockingItem {
    productId: string;
    productName: string;
    qty: number;
}

export interface PromotionItem {
    productId: string;
    productName: string;
    qty: number;
    toWhom?: string;
    purpose?: string;
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
    promotions?: PromotionItem[]; // 販促・サンプル提供実績
    storeTopics?: string;
    displayBeforeImageUrls?: string[];
    displayAfterImageUrls?: string[];
    imageUrl?: string;       // メイン写真 URL
    aiAnalysis?: string;     // AI による分析・アドバイス
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
        // 追加
        variableCostAmount?: number;
        mqAmount?: number;
        mqRate?: number;
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
    // 追加
    salesChannel?: string;
    customerId?: string;
    customerName?: string;
    customerEmail?: string | null;
    shopifyCustomerId?: string | null;
    isRepeatCustomer?: boolean;
    shopifyOrdersCount?: number | null;
    transactionId?: string;
    inventoryEffects?: InventoryEffect[]; // 登録時の在庫影響を保存し、後日の商品構成変更でも正確に差し戻す
    shippingCost?: number;
    platformFee?: number;
    packagingCost?: number;
    variableCostAmount?: number;
    mqAmount?: number;
    mqRate?: number;
}

export interface PurchaseItem {
    productId: string;
    quantity: number;
    receivedQuantity: number; // 入荷済みの数量
    unitCost: number;
    totalCost: number;
}

export interface Purchase extends BaseEntity {
    id: string;
    type: 'A' | 'B';
    status: 'ordered_pending' | 'ordered' | 'partially_received' | 'waiting' | 'received' | 'paid';
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
    type: 'estimate' | 'delivery_note' | 'payment_summary' | 'invoice' | 'receipt' | 'proxy_invoice';
    docNumber: string;          // "EST-2026-001", "DN-2026-001", "INV-2026-001", "RC-2026-001" or branch variants
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
    linkedConsignmentStoreId?: string; // 紐付け先委託販売先
    skipInventoryAdjustment?: boolean; // 在庫減算をスキップするか
    attributeSalesToLinkedStore?: boolean; // 売上を紐付け先に計上するか
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
    customerEmail?: string;
    shopifyCustomerId?: string;
    isRepeatCustomer?: boolean;
    shopifyOrdersCount?: number;
    storeId?: string;       // 関連する販売店舗ID
    storeName?: string;     // 関連する販売店舗名 (非正規化)
    spotRecipientId?: string; // 関連するスポット宛先ID
    recipientType?: 'store' | 'spot';
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
    invoiceNumber?: string; // T-XXXXXXXXXXXXX (インボイス登録番号)
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

export interface CompositeProduction extends BaseEntity {
    id: string;
    date: string; // YYYY-MM-DD
    productId: string;
    productName: string;
    quantity: number;
    components: {
        productId: string;
        productName: string;
        quantity: number; // 1単位あたりの必要量ではなく、この制作における合計使用量
    }[];
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
    reason: 'sale' | 'purchase' | 'audit' | 'return' | 'waste' | 'amazon_sync' | 'manual' | 'promotion' | 'production' | 'conversion';
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

// ─── 販促準備タスク（Promotion Tasks） ────────────────────────────────────
export interface PromotionTask {
    id: string; // {storeId}_{eventDate}_{taskKey}
    storeId: string;
    eventDate: string; // YYYY-MM-DD
    eventName: string;
    taskKey: string;   // e.g. "procurement", "marketing", "floor", "final"
    isCompleted: boolean;
    updatedAt?: string | any;
}

export interface PromotionEvent extends BaseEntity {
    id: string;         // For custom: UUID, for system: YYYY-MM-DD_Name
    name: string;
    date: string;       // YYYY-MM-DD
    description?: string;
    icon?: string;
    type: 'system' | 'custom';
    createdAt?: string | any;
}

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
    reason: 'restock' | 'sale' | 'loss' | 'return' | 'manual' | 'audit' | 'promotion';
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
    storeWholesalePrices?: { storeId: string; price: number }[]; // Store-specific wholesale prices
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
    shopifyVariantIds?: string[];
    shopifySyncEnabled?: boolean;
    lastShopifySyncAt?: string | any;
    // Square Integration fields
    squareSyncEnabled?: boolean;
    squareVariantId?: string; // Square Catalog Object ID for this product/variant
    lastSquareSyncAt?: string | any;
    createdAt?: string | any;
    // MQ Fields
    standardSellingPrice?: number;
    standardVariableCost?: number;
    standardMq?: number;
    standardMqRate?: number;
    standardWorkMinutes?: number;
    mqPerHour?: number;
    productCategory?: string;
    producerId?: string;
    isMqTarget?: boolean;
}

export interface WorkLog extends BaseEntity {
    id: string;
    workDate: string; // YYYY-MM-DD
    workType: '製造' | '包装' | 'ラベル貼り' | '出荷' | '配送' | '仕入' | '営業' | 'EC登録' | '問い合わせ対応' | 'イベント販売' | 'その他';
    relatedProductId?: string;
    relatedProductName?: string;
    relatedOrderId?: string;
    workMinutes: number;
    workerName: string;
    workMemo?: string;
    producedQuantity?: number;
    laborCost?: number;
    estimatedLaborCost?: number;
    mqPerWorkHour?: number;
    efficiencyRating?: string;
    createdAt?: string | any;
}

export interface FixedCost extends BaseEntity {
    id: string; // targetMonth matching YYYY-MM
    targetMonth: string; // YYYY-MM
    rentCost: number;
    laborCost: number;
    utilityCost: number;
    communicationCost: number;
    vehicleCost: number;
    softwareCost: number;
    otherFixedCost: number;
    totalFixedCost: number;
    items?: FixedCostItem[];
    createdAt?: string | any;
    updatedAt?: string | any;
}

export interface MqSummary extends BaseEntity {
    id: string; // targetMonth matching YYYY-MM
    targetMonth: string; // YYYY-MM
    totalSales: number;
    totalVariableCost: number;
    totalMq: number;
    averageMqRate: number;
    totalFixedCost: number;
    operatingProfit: number;
    totalWorkMinutes: number;
    mqPerHour: number;
    productSummaries: {
        productId: string;
        productName: string;
        salesVolume: number;
        salesAmount: number;
        variableCostAmount: number;
        mqAmount: number;
        mqRate: number;
        workMinutes: number;
        mqPerHour: number;
    }[];
    channelSummaries: {
        channelName: string;
        salesAmount: number;
        variableCostAmount: number;
        mqAmount: number;
        mqRate: number;
    }[];
    customerSummaries: {
        customerId: string;
        customerName: string;
        salesAmount: number;
        variableCostAmount: number;
        mqAmount: number;
        mqRate: number;
    }[];
    createdAt?: string | any;
    updatedAt?: string | any;
}

// Reusable fetcher for SWR
const fetcher = async <T>(collectionName: string, isDemoMode: boolean): Promise<T[]> => {
    if (!collectionName) return [];
    if (isDemoMode) {
        const mockData = getMockData(collectionName);
        return collectionName === 'sales'
            ? mockData.map(item => normalizeSaleTotals(item))
            : mockData;
    }
    const querySnapshot = await getDocs(collection(db, collectionName));

    return querySnapshot.docs.map((doc) => {
        const data = { id: doc.id, ...doc.data() } as any;

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

        if (collectionName === 'sales') {
            return normalizeSaleTotals(data) as T;
        }

        return data as T;
    });
};

const swrConfig = {
    revalidateOnFocus: false, // Prevents unnecessary reads on window focus
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // 1 minute deduplication
};

let globalHasLoadedOnce = false;

export function useStore() {
    const { isAuthLoading, user, isDemoMode } = useAuth() as any; // Temporary fix for type mismatch if any

    if (!user && !isDemoMode) {
        globalHasLoadedOnce = false;
    }

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
    const { data: compositeProductions = [], mutate: mutateCompositeProductions } = useSWR<CompositeProduction[]>(["composite_productions", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<CompositeProduction>(col, demo), swrConfig);
    const { data: inventoryAudits = [], mutate: mutateInventoryAudits } = useSWR<InventoryAudit[]>(["inventory_audits", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<InventoryAudit>(col, demo), swrConfig);
    const { data: storeStocks = [], mutate: mutateStoreStocks } = useSWR<StoreStock[]>(["store_stocks", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<StoreStock>(col, demo), swrConfig);
    const { data: storeStockMovements = [], mutate: mutateStoreStockMovements } = useSWR<StoreStockMovement[]>(["store_stock_movements", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<StoreStockMovement>(col, demo), swrConfig);
    const { data: printArchives = [], mutate: mutatePrintArchives, isLoading: loadingPrintArchives } = useSWR<PrintArchive[]>(["print_archives", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<PrintArchive>(col, demo), swrConfig);
    const { data: expenses = [], mutate: mutateExpenses, isLoading: loadingExpenses } = useSWR<Expense[]>(["expenses", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<Expense>(col, demo), swrConfig);
    const { data: businessManuals = [], mutate: mutateBusinessManuals } = useSWR<BusinessManual[]>(["business_manuals", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<BusinessManual>(col, demo), swrConfig);
    const { data: promotionTasks = [], mutate: mutatePromotionTasks } = useSWR<PromotionTask[]>(["seasonal_tasks", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<PromotionTask>(col, demo), swrConfig);
    const { data: promotionEvents = [], mutate: mutatePromotionEvents } = useSWR<PromotionEvent[]>(["promotion_events", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<PromotionEvent>(col, demo), swrConfig);
    const { data: workLogs = [], mutate: mutateWorkLogs, isLoading: loadingWorkLogs } = useSWR<WorkLog[]>(["workLogs", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<WorkLog>(col, demo), swrConfig);
    const { data: fixedCosts = [], mutate: mutateFixedCosts, isLoading: loadingFixedCosts } = useSWR<FixedCost[]>(["fixedCosts", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<FixedCost>(col, demo), swrConfig);
    const { data: mqSummaries = [], mutate: mutateMqSummaries, isLoading: loadingMqSummaries } = useSWR<MqSummary[]>(["mqSummaries", isDemoMode], ([col, demo]: [string, boolean]) => fetcher<MqSummary>(col, demo), swrConfig);

    // Auto Report Config
    const { data: reportConfig = DEFAULT_REPORT_CONFIG, mutate: mutateReportConfig } = useSWR<AutoReportConfig>(
        ["auto_report_config", isDemoMode],
        async ([, demo]: [string, boolean]) => {
            if (demo) return DEFAULT_REPORT_CONFIG;
            const snap = await getDoc(doc(db, "settings", "auto_report"));
            if (snap.exists()) return { ...DEFAULT_REPORT_CONFIG, ...snap.data() } as AutoReportConfig;
            return DEFAULT_REPORT_CONFIG;
        },
        { ...swrConfig, revalidateOnFocus: false }
    );

    // Company Settings — fetched once from Firestore doc (not a collection)
    const { data: companySettings = DEFAULT_COMPANY_SETTINGS, mutate: mutateCompanySettings, isLoading: loadingCompanySettings } = useSWR<CompanySettings>(
        ["company_settings", isDemoMode],
        async ([, demo]: [string, boolean]) => {
            if (demo) return DEFAULT_COMPANY_SETTINGS;
            const snap = await getDoc(doc(db, "company_settings", "main"));
            if (snap.exists()) return { ...DEFAULT_COMPANY_SETTINGS, ...snap.data() } as CompanySettings;
            return DEFAULT_COMPANY_SETTINGS;
        },
        { ...swrConfig, revalidateOnFocus: false }
    );

    const isLoadedComputed = !loadingBrands && !loadingSuppliers && !loadingProducts && !loadingRetailStores && !loadingPurchases && !loadingSales && !loadingPayments && !loadingReports && !loadingPrintArchives && !loadingWorkLogs && !loadingFixedCosts && !loadingMqSummaries && !loadingCompanySettings;

    if (isLoadedComputed && (user || isDemoMode)) {
        globalHasLoadedOnce = true;
    }

    const isLoaded = globalHasLoadedOnce || isLoadedComputed;

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
        const shouldSyncAmazon = productUpdate.amazonSyncEnabled ?? product?.amazonSyncEnabled;
        if (shouldSyncAmazon) {
            syncProductToAmazon(id).catch(err => console.error("Amazon sync failed on update:", err));
        }
    };
    const adjustProductStock = async (productId: string, delta: number) => {
        if (delta === 0 || isDemoMode) return;
        
        // Optimistic update using functional update to handle rapid sequences
        mutateProducts((prev = []) => prev.map((p) => p.id === productId ? { ...p, stock: (p.stock || 0) + delta } : p), false);

        const docRef = doc(db, "products", productId);
        await updateDoc(docRef, {
            stock: increment(delta)
        });
        mutateProducts();
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

    const appendInventoryEffectsToBatch = (
        batch: ReturnType<typeof writeBatch>,
        effects: InventoryEffect[],
        context: { referenceId: string; date: string; source: 'purchase' | 'sale' | 'report' | 'conversion' | 'production'; remarks: string },
    ) => {
        const mergedEffects = mergeInventoryEffects(effects);
        if ((mergedEffects.length * 2) + 1 > 450) {
            throw new Error('一度に更新する商品数が多すぎます。明細を分けて登録してください。');
        }

        for (const effect of mergedEffects) {
            if (!effect.quantity) continue;
            const product = products.find(item => item.id === effect.productId);
            const productName = product?.name || '不明な商品';
            const movementType = effect.quantity > 0 ? 'in' : 'out';

            if (effect.scope === 'main') {
                batch.update(doc(db, 'products', effect.productId), {
                    stock: increment(effect.quantity),
                    updatedAt: serverTimestamp(),
                });
                batch.set(doc(collection(db, 'stock_movements')), {
                    productId: effect.productId,
                    productName,
                    type: movementType,
                    quantity: Math.abs(effect.quantity),
                    reason: context.source === 'purchase'
                        ? (effect.quantity > 0 ? 'purchase' : 'manual')
                        : context.source === 'sale'
                            ? (effect.quantity > 0 ? 'return' : 'sale')
                            : context.source === 'conversion' || context.source === 'production'
                                ? context.source
                                : 'manual',
                    referenceId: context.referenceId,
                    date: context.date,
                    remarks: context.remarks,
                    createdAt: serverTimestamp(),
                });
                continue;
            }

            if (!effect.storeId) {
                throw new Error(`店舗在庫の更新先が見つかりません (${effect.productId})`);
            }
            batch.set(doc(db, 'store_stocks', `${effect.storeId}_${effect.productId}`), {
                storeId: effect.storeId,
                productId: effect.productId,
                stock: increment(effect.quantity),
                updatedAt: serverTimestamp(),
            }, { merge: true });
            batch.set(doc(collection(db, 'store_stock_movements')), {
                storeId: effect.storeId,
                productId: effect.productId,
                productName,
                type: movementType,
                quantity: Math.abs(effect.quantity),
                reason: context.source === 'report'
                    ? 'restock'
                    : (effect.quantity > 0 ? 'return' : 'sale'),
                referenceId: context.referenceId,
                date: context.date,
                remarks: context.remarks,
                createdAt: serverTimestamp(),
            });
        }
    };

    const applyInventoryEffectsToLocalCache = (effects: InventoryEffect[]) => {
        const mainEffects = new Map<string, number>();
        const storeEffects = new Map<string, InventoryEffect>();
        for (const effect of effects) {
            if (effect.scope === 'main') {
                mainEffects.set(effect.productId, (mainEffects.get(effect.productId) || 0) + effect.quantity);
            } else if (effect.storeId) {
                const key = `${effect.storeId}_${effect.productId}`;
                const current = storeEffects.get(key);
                storeEffects.set(key, current
                    ? { ...current, quantity: current.quantity + effect.quantity }
                    : effect);
            }
        }
        if (mainEffects.size) {
            mutateProducts((current = []) => current.map(product => mainEffects.has(product.id)
                ? { ...product, stock: (product.stock || 0) + (mainEffects.get(product.id) || 0) }
                : product), false);
        }
        if (storeEffects.size) {
            mutateStoreStocks((current = []) => {
                const next = [...current];
                for (const [id, effect] of storeEffects) {
                    const index = next.findIndex(item => item.id === id);
                    if (index >= 0) {
                        next[index] = { ...next[index], stock: (next[index].stock || 0) + effect.quantity };
                    } else {
                        next.unshift({
                            id,
                            storeId: effect.storeId!,
                            productId: effect.productId,
                            stock: effect.quantity,
                        });
                    }
                }
                return next;
            }, false);
        }
    };

    const refreshInventoryCaches = (effects: InventoryEffect[]) => {
        applyInventoryEffectsToLocalCache(effects);
        mutateProducts();
        mutateStoreStocks();
        mutateStockMovements();
        mutateStoreStockMovements();
    };

    // --- Purchase Actions (Inbound Shipments) ---
    const addPurchase = async (purchaseData: Omit<Purchase, "id" | "createdAt">) => {
        if (checkDemoMode()) return;
        const newRef = doc(collection(db, "inbound_shipments"));
        const items = (purchaseData.items || []).map(item => ({
            ...item,
            receivedQuantity: item.receivedQuantity ?? (purchaseData.type === 'B' ? item.quantity : 0),
        }));
        const newPurchase: Purchase = {
            id: newRef.id,
            ...purchaseData,
            items,
            createdAt: new Date().toISOString(),
        };
        const effects = getPurchaseInventoryEffects(newPurchase);
        const batch = writeBatch(db);
        batch.set(newRef, {
            ...cleanObject({ ...purchaseData, items }),
            createdAt: serverTimestamp(),
        });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: newRef.id,
            date: newPurchase.arrivalDate || newPurchase.receivedDate || newPurchase.orderDate,
            source: 'purchase',
            remarks: '仕入登録による在庫反映',
        });
        await batch.commit();
        mutatePurchases([...purchases, newPurchase], false);
        refreshInventoryCaches(effects);
        mutatePurchases();
    };

    const updatePurchase = async (id: string, purchaseUpdate: Partial<Omit<Purchase, "id" | "createdAt">>) => {
        if (checkDemoMode()) return;
        const currentPurchase = purchases.find(p => p.id === id);
        if (!currentPurchase) return;

        // Auto-set dates based on status
        if (purchaseUpdate.status === 'received' && !purchaseUpdate.receivedDate) {
            purchaseUpdate.receivedDate = new Date().toISOString().split('T')[0];
            purchaseUpdate.arrivalDate = purchaseUpdate.receivedDate;
        }
        if (purchaseUpdate.status === 'paid' && !purchaseUpdate.paymentDate) {
            purchaseUpdate.paymentDate = new Date().toISOString().split('T')[0];
        }
        const nextPurchase = { ...currentPurchase, ...purchaseUpdate } as Purchase;
        const effects = diffInventoryEffects(
            getPurchaseInventoryEffects(currentPurchase),
            getPurchaseInventoryEffects(nextPurchase),
        );
        const batch = writeBatch(db);
        batch.update(doc(db, "inbound_shipments", id), cleanObject(purchaseUpdate));
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: id,
            date: nextPurchase.arrivalDate || nextPurchase.receivedDate || nextPurchase.orderDate,
            source: 'purchase',
            remarks: '仕入更新による在庫差分反映',
        });
        await batch.commit();
        mutatePurchases(purchases.map((p) => p.id === id ? nextPurchase : p), false);
        refreshInventoryCaches(effects);
        mutatePurchases();
    };

    const deletePurchase = async (id: string) => {
        if (checkDemoMode()) return;
        const purchase = purchases.find(p => p.id === id);
        if (!purchase || purchase.isTrashed) return;
        const nextPurchase = { ...purchase, isTrashed: true };
        const effects = diffInventoryEffects(
            getPurchaseInventoryEffects(purchase),
            getPurchaseInventoryEffects(nextPurchase),
        );
        const batch = writeBatch(db);
        batch.update(doc(db, "inbound_shipments", id), { isTrashed: true });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: id,
            date: new Date().toISOString().split('T')[0],
            source: 'purchase',
            remarks: '仕入削除による在庫差し戻し',
        });
        await batch.commit();
        mutatePurchases(purchases.map(item => item.id === id ? nextPurchase : item), false);
        refreshInventoryCaches(effects);
        mutatePurchases();
    };

    const restorePurchase = async (id: string) => {
        if (checkDemoMode()) return;
        const purchase = purchases.find(p => p.id === id);
        if (!purchase || !purchase.isTrashed) return;
        const nextPurchase = { ...purchase, isTrashed: false };
        const effects = diffInventoryEffects(
            getPurchaseInventoryEffects(purchase),
            getPurchaseInventoryEffects(nextPurchase),
        );
        const batch = writeBatch(db);
        batch.update(doc(db, "inbound_shipments", id), { isTrashed: false });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: id,
            date: purchase.arrivalDate || purchase.receivedDate || purchase.orderDate,
            source: 'purchase',
            remarks: '仕入復元による在庫反映',
        });
        await batch.commit();
        mutatePurchases(purchases.map(item => item.id === id ? nextPurchase : item), false);
        refreshInventoryCaches(effects);
        mutatePurchases();
    };

    const permanentlyDeletePurchase = async (id: string) => {
        if (checkDemoMode()) return;
        const purchase = purchases.find(item => item.id === id);
        if (purchase && !purchase.isTrashed) {
            throw new Error('仕入記録は先にゴミ箱へ移動してください。');
        }
        await deleteDoc(doc(db, "inbound_shipments", id));
        mutatePurchases();
    };

    // --- Sale Actions ---
    const addSale = async (saleData: Omit<Sale, "id" | "updatedAt">) => {
        if (checkDemoMode()) return;
        const newRef = doc(collection(db, "sales"));
        const normalizedSale = normalizeSaleTotals(saleData);
        const calculatedEffects = getSaleInventoryEffects(normalizedSale, products, retailStores);
        const newSale: Sale = {
            id: newRef.id,
            ...normalizedSale,
            inventoryEffects: calculatedEffects,
            updatedAt: new Date().toISOString(),
        };
        const batch = writeBatch(db);
        batch.set(newRef, {
            ...cleanObject(normalizedSale),
            inventoryEffects: calculatedEffects,
            updatedAt: serverTimestamp(),
        });
        appendInventoryEffectsToBatch(batch, calculatedEffects, {
            referenceId: newRef.id,
            date: normalizedSale.period.split('T')[0],
            source: 'sale',
            remarks: '売上登録による在庫反映',
        });
        await batch.commit();
        mutateSales([newSale, ...sales], false);
        refreshInventoryCaches(calculatedEffects);
        logActivity({
            type: 'create',
            category: 'sale',
            title: `売上を記録しました`,
            detail: `${retailStores.find(s => s.id === normalizedSale.storeId)?.name || normalizedSale.storeName || '販売先未設定'} / ¥${normalizedSale.totalAmount.toLocaleString()}`
        });
        mutateSales();
    };

    // --- Stock Conversion Actions ---
    const addStockConversion = async (data: Omit<StockConversion, "id" | "createdAt">) => {
        if (checkDemoMode()) return;
        const newRef = doc(collection(db, "stock_conversions"));
        const newConv: StockConversion = {
            id: newRef.id,
            ...data,
            createdAt: new Date().toISOString()
        };

        const effects: InventoryEffect[] = [
            { scope: 'main', productId: data.inputProductId, quantity: -data.inputQty },
            { scope: 'main', productId: data.outputProductId, quantity: data.outputQty },
        ];
        const batch = writeBatch(db);
        batch.set(newRef, { ...data, createdAt: serverTimestamp() });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: newRef.id,
            date: data.date,
            source: 'conversion',
            remarks: `在庫変換: ${data.notes || '備考なし'}`,
        });
        await batch.commit();
        mutateStockConversions([newConv, ...stockConversions], false);
        refreshInventoryCaches(effects);
        mutateStockConversions();
    };

    const addCompositeProduction = async (data: Omit<CompositeProduction, "id" | "createdAt">) => {
        if (checkDemoMode()) return;
        const newRef = doc(collection(db, "composite_productions"));
        const newProduction: CompositeProduction = {
            id: newRef.id,
            ...data,
            createdAt: new Date().toISOString()
        };

        const effects: InventoryEffect[] = [
            { scope: 'main', productId: data.productId, quantity: data.quantity },
            ...data.components.map(component => ({
                scope: 'main' as const,
                productId: component.productId,
                quantity: -component.quantity,
            })),
        ];
        const batch = writeBatch(db);
        batch.set(newRef, { ...data, createdAt: serverTimestamp() });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: newRef.id,
            date: data.date,
            source: 'production',
            remarks: `商品制作: ${data.productName}`,
        });
        await batch.commit();
        mutateCompositeProductions([newProduction, ...compositeProductions], false);
        refreshInventoryCaches(effects);

        logActivity({
            type: 'create',
            category: 'product',
            title: `商品「${data.productName}」を制作しました`,
            detail: `制作数量: ${data.quantity}`
        });

        mutateCompositeProductions();
    };

    const updateSale = async (id: string, saleData: Partial<Sale>) => {
        if (checkDemoMode()) return;
        const currentSale = sales.find(s => s.id === id);
        if (!currentSale) return;
        const oldEffects = getSaleInventoryEffects(currentSale, products, retailStores);
        const saleWithoutOldSnapshot = { ...currentSale, ...saleData, inventoryEffects: undefined } as Sale;
        const normalizedSale = normalizeSaleTotals(saleWithoutOldSnapshot) as Sale;
        const newEffects = getSaleInventoryEffects(normalizedSale, products, retailStores);
        const newSale = { ...normalizedSale, inventoryEffects: newEffects };
        const effects = diffInventoryEffects(oldEffects, newEffects);
        const batch = writeBatch(db);
        batch.update(doc(db, "sales", id), {
            ...cleanObject(saleData),
            totalQuantity: newSale.totalQuantity,
            totalAmount: newSale.totalAmount,
            totalCommission: newSale.totalCommission,
            totalNetProfit: newSale.totalNetProfit,
            inventoryEffects: newEffects,
            updatedAt: serverTimestamp(),
        });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: id,
            date: newSale.period.split('T')[0],
            source: 'sale',
            remarks: '売上更新による在庫差分反映',
        });
        await batch.commit();
        mutateSales(sales.map((s) => s.id === id ? newSale : s), false);
        refreshInventoryCaches(effects);
        mutateSales();
    };

    const deleteSale = async (id: string) => {
        if (checkDemoMode()) return;
        const sale = sales.find(s => s.id === id);
        if (!sale || sale.isTrashed) return;
        const nextSale = { ...sale, isTrashed: true };
        const effects = diffInventoryEffects(
            getSaleInventoryEffects(sale, products, retailStores),
            getSaleInventoryEffects(nextSale, products, retailStores),
        );
        const batch = writeBatch(db);
        batch.update(doc(db, "sales", id), { isTrashed: true });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: id,
            date: new Date().toISOString().split('T')[0],
            source: 'sale',
            remarks: '売上削除による在庫差し戻し',
        });
        await batch.commit();
        mutateSales(sales.map(item => item.id === id ? nextSale : item), false);
        refreshInventoryCaches(effects);
        mutateSales();
    };

    const restoreSale = async (id: string) => {
        if (checkDemoMode()) return;
        const sale = sales.find(s => s.id === id);
        if (!sale || !sale.isTrashed) return;
        const nextSale = { ...sale, isTrashed: false };
        const effects = diffInventoryEffects(
            getSaleInventoryEffects(sale, products, retailStores),
            getSaleInventoryEffects(nextSale, products, retailStores),
        );
        const batch = writeBatch(db);
        batch.update(doc(db, "sales", id), { isTrashed: false });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: id,
            date: sale.period.split('T')[0],
            source: 'sale',
            remarks: '売上復元による在庫反映',
        });
        await batch.commit();
        mutateSales(sales.map(item => item.id === id ? nextSale : item), false);
        refreshInventoryCaches(effects);
        mutateSales();
    };

    const permanentlyDeleteSale = async (id: string) => {
        if (checkDemoMode()) return;
        const sale = sales.find(item => item.id === id);
        if (sale && !sale.isTrashed) {
            throw new Error('売上記録は先にゴミ箱へ移動してください。');
        }
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
    const getPromotionExpenseData = (report: DailyReport) => {
        let amount = 0;
        const memos: string[] = [];
        for (const item of report.promotions || []) {
            const product = products.find(candidate => candidate.id === item.productId);
            if (!product) continue;
            amount += (product.costPrice || 0) * item.qty;
            memos.push(`${product.name} × ${item.qty} (${item.toWhom || '-'})`);
        }
        return {
            amount,
            memo: memos.join(', ') + (report.content ? `\n\n${report.content.slice(0, 50)}...` : ''),
            item: `サンプル/販促提供（${report.title || report.worker}）`,
        };
    };

    const addDailyReport = async (reportData: Omit<DailyReport, "id" | "createdAt">) => {
        if (checkDemoMode()) return;
        const newRef = doc(collection(db, "daily_reports"));
        const newReport: DailyReport = { id: newRef.id, ...reportData, createdAt: new Date().toISOString() };
        const effects = getDailyReportInventoryEffects(newReport, retailStores);
        const promotionExpense = getPromotionExpenseData(newReport);
        const batch = writeBatch(db);
        batch.set(newRef, { ...cleanObject(reportData), createdAt: serverTimestamp() });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: newRef.id,
            date: reportData.date,
            source: 'report',
            remarks: '日報の補充・販促による在庫反映',
        });
        if (promotionExpense.amount > 0) {
            const expenseRef = doc(collection(db, "expenses"));
            batch.set(expenseRef, {
                id: expenseRef.id,
                date: reportData.date,
                type: '支払',
                category: '広告宣伝費',
                paymentMethod: '小口現金',
                ...promotionExpense,
                referenceId: newRef.id,
                isAnalyzed: false,
                isConfirmed: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        }
        await batch.commit();
        mutateDailyReports([newReport, ...dailyReports], false);
        refreshInventoryCaches(effects);
        mutateExpenses();

        logActivity({
            type: 'create',
            category: 'report',
            title: `業務日報「${reportData.title || '無題'}」を提出しました`,
            detail: `担当: ${reportData.worker}`
        });
        mutateDailyReports();
    };

    const deleteDailyReport = async (id: string) => {
        if (checkDemoMode()) return;
        const report = dailyReports.find(r => r.id === id);
        if (!report || report.isTrashed) return;
        const nextReport = { ...report, isTrashed: true };
        const effects = diffInventoryEffects(
            getDailyReportInventoryEffects(report, retailStores),
            getDailyReportInventoryEffects(nextReport, retailStores),
        );
        const batch = writeBatch(db);
        batch.update(doc(db, "daily_reports", id), { isTrashed: true });
        const relatedExpense = expenses.find(e => e.referenceId === id);
        if (relatedExpense) batch.update(doc(db, "expenses", relatedExpense.id), { isTrashed: true, updatedAt: serverTimestamp() });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: id,
            date: report.date,
            source: 'report',
            remarks: '日報削除による在庫差し戻し',
        });
        await batch.commit();
        mutateDailyReports(dailyReports.map(item => item.id === id ? nextReport : item), false);
        refreshInventoryCaches(effects);
        mutateExpenses();
        mutateDailyReports();
    };

    const restoreDailyReport = async (id: string) => {
        if (checkDemoMode()) return;
        const report = dailyReports.find(r => r.id === id);
        if (!report || !report.isTrashed) return;
        const nextReport = { ...report, isTrashed: false };
        const effects = diffInventoryEffects(
            getDailyReportInventoryEffects(report, retailStores),
            getDailyReportInventoryEffects(nextReport, retailStores),
        );
        const batch = writeBatch(db);
        batch.update(doc(db, "daily_reports", id), { isTrashed: false });
        const relatedExpense = expenses.find(e => e.referenceId === id);
        if (relatedExpense) batch.update(doc(db, "expenses", relatedExpense.id), { isTrashed: false, updatedAt: serverTimestamp() });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: id,
            date: report.date,
            source: 'report',
            remarks: '日報復元による在庫反映',
        });
        await batch.commit();
        mutateDailyReports(dailyReports.map(item => item.id === id ? nextReport : item), false);
        refreshInventoryCaches(effects);
        mutateExpenses();
        mutateDailyReports();
    };

    const permanentlyDeleteDailyReport = async (id: string) => {
        if (checkDemoMode()) return;
        const report = dailyReports.find(item => item.id === id);
        if (report && !report.isTrashed) throw new Error('日報は先にゴミ箱へ移動してください。');
        await deleteDoc(doc(db, "daily_reports", id));
        mutateDailyReports();
    };

    const updateDailyReport = async (id: string, data: Partial<Omit<DailyReport, "id" | "createdAt">>) => {
        if (checkDemoMode()) return;
        const currentReport = dailyReports.find(r => r.id === id);
        if (!currentReport) return;
        const newReport = { ...currentReport, ...data } as DailyReport;
        const effects = diffInventoryEffects(
            getDailyReportInventoryEffects(currentReport, retailStores),
            getDailyReportInventoryEffects(newReport, retailStores),
        );
        const promotionExpense = getPromotionExpenseData(newReport);
        const relatedExpense = expenses.find(e => e.referenceId === id);
        const batch = writeBatch(db);
        batch.update(doc(db, "daily_reports", id), { ...cleanObject(data), updatedAt: serverTimestamp() });
        appendInventoryEffectsToBatch(batch, effects, {
            referenceId: id,
            date: newReport.date,
            source: 'report',
            remarks: '日報更新による在庫差分反映',
        });
        if (relatedExpense && promotionExpense.amount === 0) {
            batch.update(doc(db, "expenses", relatedExpense.id), { isTrashed: true, updatedAt: serverTimestamp() });
        } else if (promotionExpense.amount > 0) {
            const expenseRef = relatedExpense ? doc(db, "expenses", relatedExpense.id) : doc(collection(db, "expenses"));
            batch.set(expenseRef, {
                id: expenseRef.id,
                date: newReport.date,
                type: '支払',
                category: '広告宣伝費',
                paymentMethod: '小口現金',
                ...promotionExpense,
                referenceId: id,
                isAnalyzed: relatedExpense?.isAnalyzed ?? false,
                isConfirmed: relatedExpense?.isConfirmed ?? true,
                isTrashed: false,
                ...(relatedExpense ? {} : { createdAt: serverTimestamp() }),
                updatedAt: serverTimestamp(),
            }, { merge: true });
        }
        await batch.commit();
        mutateDailyReports(dailyReports.map(r => r.id === id ? newReport : r), false);
        refreshInventoryCaches(effects);
        mutateExpenses();
        mutateDailyReports();
    };

    // --- Issued Document Actions ---

    /** 帳票番号の採番: 同じ prefix の既存番号を参照して次の連番を返す */
    const generateDocNumber = (type: IssuedDocument['type'], year: string): string => {
        const prefix = type === 'estimate' ? 'EST' : type === 'delivery_note' ? 'DN' : type === 'payment_summary' ? 'PM' : type === 'receipt' ? 'RC' : 'INV';
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
        // 紐付け先の委託販売先がある場合、在庫減算は委託先の日報で行われるためここではスキップする
        const recipientStore = data.storeId ? retailStores.find(s => s.id === data.storeId) : null;
        const isLinkedConsignment = !!data.linkedConsignmentStoreId || !!recipientStore?.linkedConsignmentStoreId;
        const shouldSkipInventory = data.skipInventoryAdjustment !== undefined ? data.skipInventoryAdjustment : isLinkedConsignment;

        if (data.type === 'delivery_note' && data.details && !shouldSkipInventory) {
            for (const item of data.details) {
                if (item.productId) {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        if (product.isComposite && product.components) {
                            for (const comp of product.components) {
                                const compProduct = products.find(p => p.id === comp.productId);
                                if (compProduct) {
                                    await adjustProductStock(compProduct.id, -(comp.quantity * item.quantity));
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
                            await adjustProductStock(product.id, -item.quantity);
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
            status: 'issued' as const,
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
        const aggregatedAdjustments: InvoiceAdjustment[] = [];
        let aggregatedFinalAdjustment = 0;

        for (const doc of sortedOriginals) {
            const dateStr = doc.issuedDate; // YYYY-MM-DD
            const formattedDate = dateStr ? `${parseInt(dateStr.split('-')[1])}月${parseInt(dateStr.split('-')[2])}日` : "";
            
            if (doc.details) {
                for (const item of doc.details) {
                    aggregatedItems.push({
                        ...item,
                        id: crypto.randomUUID(),
                        remarks: formattedDate ? `${formattedDate}分 ${item.remarks || ""}`.trim() : item.remarks
                    });
                }
            }
            if (doc.adjustments) {
                for (const adj of doc.adjustments) {
                    aggregatedAdjustments.push({
                        ...adj,
                        id: crypto.randomUUID(),
                        label: formattedDate ? `${adj.label} (${formattedDate}分)` : adj.label,
                    });
                }
            }
            if (doc.finalAdjustment) {
                aggregatedFinalAdjustment += doc.finalAdjustment;
            }
        }

        const taxRate = first.taxRate || 8;
        const taxType = first.taxType || 'inclusive';
        const itemsSubtotal = aggregatedItems.reduce((sum, item) => sum + item.subtotal, 0);
        const adjustmentsTotal = aggregatedAdjustments.reduce((sum, adj) => sum + adj.amount, 0);
        const baseAmount = itemsSubtotal + adjustmentsTotal;
        const taxAmount = taxType === 'exclusive'
            ? applyRounding(baseAmount * (taxRate / 100), companySettings?.roundingMode || 'floor')
            : 0;
        const totalAmount = baseAmount + taxAmount + aggregatedFinalAdjustment;

        return saveIssuedDocument({
            type: 'invoice',
            docNumber: newDocNumber,
            status: 'issued',
            issuedDate: new Date().toISOString().split('T')[0],
            period: first.period, // Use first as default
            recipientType: first.recipientType,
            storeId: first.storeId,
            supplierId: first.supplierId,
            spotRecipientId: first.spotRecipientId,
            recipientName: first.recipientName,
            totalAmount: totalAmount,
            taxRate: taxRate,
            taxType: taxType,
            details: aggregatedItems,
            adjustments: aggregatedAdjustments,
            finalAdjustment: aggregatedFinalAdjustment,
            memo: originals.map(d => d.docNumber).join(', ') + " の合算請求書",
            sourceDocIds: ids,
            fulfillmentStatus: 'pending',
        });
    };

    const updateIssuedDocument = async (id: string, data: Partial<Omit<IssuedDocument, 'id' | 'createdAt'>>) => {
        const oldDoc = issuedDocuments.find(d => d.id === id);
        if (oldDoc) {
            // 1. Reverse old stock if it was a delivery note
            const oldRecipientStore = oldDoc.storeId ? retailStores.find(s => s.id === oldDoc.storeId) : null;
            const isOldLinked = !!oldDoc.linkedConsignmentStoreId || !!oldRecipientStore?.linkedConsignmentStoreId;
            const shouldOldSkip = oldDoc.skipInventoryAdjustment !== undefined ? oldDoc.skipInventoryAdjustment : isOldLinked;

            if (oldDoc.type === 'delivery_note' && oldDoc.details && !oldDoc.isTrashed && !shouldOldSkip) {
                for (const item of oldDoc.details) {
                    if (item.productId) {
                        const product = products.find(p => p.id === item.productId);
                        if (product) {
                            if (product.isComposite && product.components) {
                                for (const comp of product.components) {
                                    const compProduct = products.find(p => p.id === comp.productId);
                                    if (compProduct) {
                                        await adjustProductStock(compProduct.id, (comp.quantity * item.quantity));
                                    }
                                }
                            } else {
                                await adjustProductStock(product.id, item.quantity);
                            }
                        }
                    }
                }
            }

            // 2. Apply new stock if the updated doc is a delivery note
            const newDoc = { ...oldDoc, ...data } as IssuedDocument;
            const newRecipientStore = newDoc.storeId ? retailStores.find(s => s.id === newDoc.storeId) : null;
            const isNewLinked = !!newDoc.linkedConsignmentStoreId || !!newRecipientStore?.linkedConsignmentStoreId;
            const shouldNewSkip = newDoc.skipInventoryAdjustment !== undefined ? newDoc.skipInventoryAdjustment : isNewLinked;

            if (newDoc.type === 'delivery_note' && newDoc.details && !newDoc.isTrashed && !shouldNewSkip) {
                for (const item of newDoc.details) {
                    if (item.productId) {
                        const product = products.find(p => p.id === item.productId);
                        if (product) {
                            if (product.isComposite && product.components) {
                                for (const comp of product.components) {
                                    const compProduct = products.find(p => p.id === comp.productId);
                                    if (compProduct) {
                                        await adjustProductStock(compProduct.id, -(comp.quantity * item.quantity));
                                    }
                                }
                            } else {
                                await adjustProductStock(product.id, -item.quantity);
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
        if (!oldDoc) return;
        const recipientStore = oldDoc.storeId ? retailStores.find(s => s.id === oldDoc.storeId) : null;
        const isLinkedConsignment = !!oldDoc.linkedConsignmentStoreId || !!recipientStore?.linkedConsignmentStoreId;
        const shouldSkipOld = oldDoc.skipInventoryAdjustment !== undefined ? oldDoc.skipInventoryAdjustment : isLinkedConsignment;

        if (oldDoc && oldDoc.type === 'delivery_note' && oldDoc.details && !oldDoc.isTrashed && !shouldSkipOld) {
            // Restore stock
            for (const item of oldDoc.details) {
                if (item.productId) {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        if (product.isComposite && product.components) {
                            for (const comp of product.components) {
                                const compProduct = products.find(p => p.id === comp.productId);
                                if (compProduct) {
                                    await adjustProductStock(compProduct.id, (comp.quantity * item.quantity));
                                }
                            }
                        } else {
                            await adjustProductStock(product.id, item.quantity);
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
        const recipientStore = docToRestore?.storeId ? retailStores.find(s => s.id === docToRestore.storeId) : null;
        const isLinkedConsignment = !!docToRestore?.linkedConsignmentStoreId || !!recipientStore?.linkedConsignmentStoreId;
        const shouldSkipRestore = docToRestore?.skipInventoryAdjustment !== undefined ? docToRestore.skipInventoryAdjustment : isLinkedConsignment;

        if (docToRestore && docToRestore.type === 'delivery_note' && docToRestore.details && docToRestore.isTrashed && !shouldSkipRestore) {
            // Re-deduct stock
            for (const item of docToRestore.details) {
                if (item.productId) {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        if (product.isComposite && product.components) {
                            for (const comp of product.components) {
                                const compProduct = products.find(p => p.id === comp.productId);
                                if (compProduct) {
                                    await adjustProductStock(compProduct.id, -(comp.quantity * item.quantity));
                                }
                            }
                        } else {
                            await adjustProductStock(product.id, -item.quantity);
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
            const paidAmount = payments.length > 0
                ? payments.reduce((sum, p) => sum + p.amount, 0)
                : (t.paidAmount || 0);
            return {
                ...t,
                paidAmount,
                balanceAmount: Math.max(0, t.totalAmount - paidAmount)
            };
        });
    }, [rawTransactions, invoicePayments]);

    const addTransaction = async (data: Omit<Transaction, "id" | "createdAt" | "updatedAt">) => {
        if (checkDemoMode()) return;
        const newRef = doc(collection(db, "transactions"));
        const payload = {
            ...cleanObject(data),
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
        if (checkDemoMode()) return;
        const docRef = doc(db, "transactions", id);
        const cleaned = cleanObject(data);
        mutateTransactions(rawTransactions.map(t => t.id === id ? { ...t, ...cleaned } : t), false);
        await updateDoc(docRef, { ...cleaned, updatedAt: serverTimestamp() });
        mutateTransactionItems(); // trigger re-fetch if needed
        mutateTransactions();
    };

    const deleteTransaction = async (id: string) => {
        if (checkDemoMode()) return;
        const transaction = rawTransactions.find(t => t.id === id);
        if (!transaction) return;
        const relatedItems = transactionItems.filter(item => item.transactionId === id);
        if ((relatedItems.length * 2) + 2 > 450) {
            throw new Error('取引明細が多すぎます。明細を分けて処理してください。');
        }
        const batch = writeBatch(db);
        const newTrashItems: TrashItem[] = [];
        for (const item of relatedItems) {
            const trashRef = doc(collection(db, 'trash'));
            const trashItem: TrashItem = {
                id: trashRef.id,
                originalId: item.id,
                collectionName: 'transaction_items',
                data: item,
                label: `取引明細: ${item.productName}`,
                deletedAt: new Date().toISOString(),
            };
            newTrashItems.push(trashItem);
            batch.set(trashRef, { ...trashItem, deletedAt: serverTimestamp() });
            batch.delete(doc(db, 'transaction_items', item.id));
        }
        const transactionTrashRef = doc(collection(db, 'trash'));
        const transactionTrashItem: TrashItem = {
            id: transactionTrashRef.id,
            originalId: id,
            collectionName: 'transactions',
            data: transaction,
            label: `取引: ${transaction.customerName} (${transaction.orderDate})`,
            deletedAt: new Date().toISOString(),
        };
        batch.set(transactionTrashRef, { ...transactionTrashItem, deletedAt: serverTimestamp() });
        batch.delete(doc(db, 'transactions', id));
        await batch.commit();
        mutateTrash([transactionTrashItem, ...newTrashItems, ...trash], false);
        mutateTransactionItems(transactionItems.filter(item => item.transactionId !== id), false);
        mutateTransactions(rawTransactions.filter(t => t.id !== id), false);
        mutateTrash();
        mutateTransactionItems();
        mutateTransactions();
    };

    const restoreTransaction = async (id: string) => {
        if (checkDemoMode()) return;
        const trashItem = trash.find(t => t.originalId === id && t.collectionName === 'transactions') || trash.find(t => t.id === id);
        if (trashItem) {
            const relatedTrashItems = trash.filter(t =>
                t.collectionName === 'transaction_items' && (t.data as TransactionItem)?.transactionId === trashItem.originalId
            );
            if ((relatedTrashItems.length * 2) + 2 > 450) {
                throw new Error('取引明細が多すぎます。明細を分けて処理してください。');
            }
            const batch = writeBatch(db);
            batch.set(doc(db, 'transactions', trashItem.originalId), trashItem.data);
            batch.delete(doc(db, 'trash', trashItem.id));
            for (const related of relatedTrashItems) {
                batch.set(doc(db, 'transaction_items', related.originalId), related.data);
                batch.delete(doc(db, 'trash', related.id));
            }
            await batch.commit();
            mutateTrash(trash.filter(item => item.id !== trashItem.id && !relatedTrashItems.some(related => related.id === item.id)), false);
            mutateTrash();
            mutateTransactionItems();
        }
        mutateTransactions();
    };

    const permanentlyDeleteTransaction = async (id: string) => {
        if (checkDemoMode()) return;
        if (rawTransactions.some(item => item.id === id)) {
            throw new Error('取引は先にゴミ箱へ移動してください。');
        }
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
            const updated = { ...existing, ...data, isTrashed: false, lastUsedAt: new Date().toISOString() };
            mutateSpotRecipients(spotRecipients.map(r => r.id === existing.id ? updated : r), false);
            await updateDoc(doc(db, 'spot_recipients', existing.id), {
                ...cleanObject(data),
                isTrashed: false,
                lastUsedAt: serverTimestamp(),
            });
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
        if (!checkDemoMode()) {
            await deleteDoc(doc(db, 'business_challenges', id));
        }
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
        if (isDemoMode) return;
        const today = new Date().toISOString().split('T')[0];
        if (!date) date = today;

        const weatherId = `${storeId}_${date}`;
        if (dailyWeather.some(w => w.id === weatherId)) {
            return;
        }

        try {
            const res = await apiFetch(`/api/weather?lat=${lat}&lon=${lng}`);
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
            if (error instanceof DemoModeError) return;
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
            const targetStore = sale.storeId ? retailStores.find(s => s.id === sale.storeId) : null;
            const isConsignment = targetStore?.type === 'A' || (targetStore?.type as string) === 'consignment';
            for (const sItem of sale.items) {
                const product = products.find(p => p.id === sItem.productId);
                if (product) {
                    if (product.isComposite && product.components) {
                        for (const comp of product.components) {
                            const compProduct = products.find(p => p.id === comp.productId);
                            if (compProduct) {
                                if (!isConsignment) {
                                    await adjustProductStock(compProduct.id, -(comp.quantity * sItem.quantity));
                                } else {
                                    await updateStoreStock(sale.storeId, compProduct.id, -(comp.quantity * sItem.quantity), 'sale', item.originalId, sale.period.split('T')[0]);
                                }
                            }
                        }
                    } else {
                        if (!isConsignment) {
                            await adjustProductStock(product.id, -sItem.quantity);
                        } else {
                            await updateStoreStock(sale.storeId, product.id, -sItem.quantity, 'sale', item.originalId, sale.period.split('T')[0]);
                        }
                    }
                }
            }
        } else if (item.collectionName === 'inbound_shipments') {
            const purchase = item.data as Purchase;
            const isReceived = (purchase.status === 'received' || purchase.status === 'paid' || purchase.status === 'partially_received');
            if (isReceived) {
                const purchaseItems = purchase.items || [];
                for (const pItem of purchaseItems) {
                    const receivedQty = pItem.receivedQuantity ?? (purchase.status === 'partially_received' ? 0 : pItem.quantity);
                    if (receivedQty > 0) {
                        const product = products.find(p => p.id === pItem.productId);
                        if (product) {
                            await adjustProductStock(product.id, receivedQty);
                        }
                    }
                }
            }
        } else if (item.collectionName === 'transactions') {
            const relatedTrashItems = trash.filter(t => t.collectionName === 'transaction_items' && (t.data as any)?.transactionId === item.originalId);
            for (const rItem of relatedTrashItems) {
                const rOriginalRef = doc(db, rItem.collectionName, rItem.originalId);
                await setDoc(rOriginalRef, rItem.data);
                await deleteDoc(doc(db, "trash", rItem.id));
            }
        }

        // Remove from trash
        mutateTrash(trash.filter(t => t.id !== id && !((item.collectionName === 'transactions') && t.collectionName === 'transaction_items' && (t.data as any)?.transactionId === item.originalId)), false);
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
        mutateTransactionItems();
        mutateSpotRecipients();
        mutateChallenges();
    };

    const permanentlyDeleteFromTrash = async (id: string) => {
        const item = trash.find(t => t.id === id);
        if (item && item.collectionName === 'transactions') {
            const relatedTrashItems = trash.filter(t => t.collectionName === 'transaction_items' && (t.data as any)?.transactionId === item.originalId);
            for (const rItem of relatedTrashItems) {
                await deleteDoc(doc(db, "trash", rItem.id));
            }
            mutateTrash(trash.filter(t => t.id !== id && !relatedTrashItems.some(r => r.id === t.id)), false);
        } else {
            mutateTrash(trash.filter(t => t.id !== id), false);
        }
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

    const updateStoreStock = async (
        storeId: string,
        productId: string,
        qty: number,
        reason: StoreStockMovement['reason'],
        referenceId?: string,
        date?: string,
        isAbsolute: boolean = false,
        remarks?: string
    ) => {
        if (checkDemoMode()) return;
        const docId = `${storeId}_${productId}`;
        const storeStockRef = doc(db, "store_stocks", docId);
        const currentSS = storeStocks.find(ss => ss.id === docId);
        const currentStock = currentSS?.stock || 0;
        const product = products.find(p => p.id === productId);
        const movementRef = doc(collection(db, "store_stock_movements"));
        const movementDate = date || new Date().toISOString().split('T')[0];
        let diff = qty;

        if (isAbsolute) {
            diff = await runTransaction(db, async transaction => {
                const latest = await transaction.get(storeStockRef);
                const latestStock = latest.exists() ? (latest.data().stock || 0) : 0;
                const actualDiff = qty - latestStock;
                transaction.set(storeStockRef, {
                    storeId,
                    productId,
                    stock: qty,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                if (actualDiff !== 0) {
                    transaction.set(movementRef, {
                        storeId,
                        productId,
                        productName: product?.name || "不明な商品",
                        type: actualDiff >= 0 ? 'in' : 'out',
                        quantity: Math.abs(actualDiff),
                        reason,
                        referenceId,
                        date: movementDate,
                        ...(remarks !== undefined ? { remarks } : {}),
                        createdAt: serverTimestamp(),
                    });
                }
                return actualDiff;
            });
        } else {
            if (diff === 0) return;
            const batch = writeBatch(db);
            batch.set(storeStockRef, {
                storeId,
                productId,
                stock: increment(diff),
                updatedAt: serverTimestamp(),
            }, { merge: true });
            batch.set(movementRef, {
                storeId,
                productId,
                productName: product?.name || "不明な商品",
                type: diff >= 0 ? 'in' : 'out',
                quantity: Math.abs(diff),
                reason,
                referenceId,
                date: movementDate,
                ...(remarks !== undefined ? { remarks } : {}),
                createdAt: serverTimestamp(),
            });
            await batch.commit();
        }

        const newStock = isAbsolute ? qty : currentStock + diff;

        mutateStoreStocks((prev = []) => {
            const exists = prev.some(ss => ss.id === docId);
            if (exists) return prev.map(ss => ss.id === docId ? { ...ss, stock: isAbsolute ? newStock : (ss.stock || 0) + diff } : ss);
            return [{ id: docId, storeId, productId, stock: newStock } as StoreStock, ...prev];
        }, false);
        mutateStoreStockMovements();
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
        if (checkDemoMode()) return;
        const currentAudit = inventoryAudits.find(item => item.id === id);
        if (audit.status === 'completed' || currentAudit?.status === 'completed') {
            return;
        }
        const now = new Date().toISOString();
        const date = now.split('T')[0];
        const diffByProduct = new Map<string, number>();
        for (const item of audit.items) {
            if (item.diff !== 0) {
                diffByProduct.set(item.productId, (diffByProduct.get(item.productId) || 0) + item.diff);
            }
        }
        if ((diffByProduct.size * 2) + 1 > 450) {
            throw new Error('棚卸し対象の商品数が多すぎます。棚卸しを分けて実施してください。');
        }
        const auditRef = doc(db, "inventory_audits", id);
        const movementRefs = new Map(
            [...diffByProduct.keys()].map(productId => [productId, doc(collection(db, "stock_movements"))]),
        );
        const wasApplied = await runTransaction(db, async transaction => {
            const latestAudit = await transaction.get(auditRef);
            if (!latestAudit.exists()) throw new Error('棚卸し記録が見つかりません。');
            if (latestAudit.data().status === 'completed') return false;

            for (const [productId, diff] of diffByProduct) {
                const product = products.find(item => item.id === productId);
                transaction.update(doc(db, "products", productId), {
                    stock: increment(diff),
                    updatedAt: serverTimestamp(),
                });
                transaction.set(movementRefs.get(productId)!, {
                    productId,
                    productName: product?.name || '不明な商品',
                    type: 'adjustment',
                    quantity: diff,
                    reason: 'audit',
                    referenceId: id,
                    date,
                    createdAt: serverTimestamp(),
                });
            }
            transaction.update(auditRef, {
                status: 'completed',
                completedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            return true;
        });
        if (!wasApplied) return;

        if (diffByProduct.size > 0) {
            mutateProducts(
                (prev = []) => prev.map(p => diffByProduct.has(p.id) ? { ...p, stock: (p.stock || 0) + (diffByProduct.get(p.id) || 0) } : p),
                false
            );
        }

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



    // --- Unified Sales Performance (Computed) ---
    const unifiedSales = useMemo(() => {
        const manualSales = sales.filter(s => !s.isTrashed);

        // 1. 請求書に紐付いている納品書を特定（二重計上防止）
        const invoicedDocIds = new Set(
            issuedDocuments
                .filter(d => d.type === 'invoice' && !d.isTrashed)
                .flatMap(d => [d.sourceDocId, ...(d.sourceDocIds || [])])
                .filter(Boolean)
        );
        
        // Convert Invoices and non-invoiced Delivery Notes to Sale-compatible format
        const documentSales = issuedDocuments
            .filter(d => !d.isTrashed && (
                (d.type === 'invoice' && (d.status === 'issued' || d.fulfillmentStatus === 'paid' || d.fulfillmentStatus === 'sent' || !d.status)) ||
                (d.type === 'delivery_note' && d.status === 'issued' && !invoicedDocIds.has(d.id))
            ))
            .flatMap(d => {
                const saleItems = d.details?.map(item => ({
                    productId: item.productId || 'custom',
                    productName: item.label,
                    quantity: item.quantity,
                    priceAtSale: item.unitPrice,
                    subtotal: item.subtotal,
                    commission: 0,
                    netProfit: item.subtotal
                })) || [];

                const docLinkedStoreId = d.linkedConsignmentStoreId || (d.storeId && retailStores.find(s => s.id === d.storeId)?.linkedConsignmentStoreId);
                const linkedStore = docLinkedStoreId ? retailStores.find(s => s.id === docLinkedStoreId) : null;
                const shouldAttributeToLinked = d.attributeSalesToLinkedStore !== undefined ? d.attributeSalesToLinkedStore : !!docLinkedStoreId;

                const baseSale = {
                    id: d.id,
                    storeId: (shouldAttributeToLinked && docLinkedStoreId) ? docLinkedStoreId : d.storeId || d.spotRecipientId || 'unknown',
                    storeName: (shouldAttributeToLinked && linkedStore) ? linkedStore.name : d.recipientName,
                    recipientType: d.recipientType === 'spot' ? 'spot' as const : 'store' as const,
                    items: saleItems,
                    totalQuantity: saleItems.reduce((sum, i) => sum + i.quantity, 0),
                    totalAmount: d.totalAmount,
                    totalCommission: 0,
                    totalNetProfit: d.totalAmount,
                    isInvoice: d.type === 'invoice',
                    isDeliveryNote: d.type === 'delivery_note',
                    docNumber: d.docNumber,
                    transactionId: d.transactionId,
                    updatedAt: d.createdAt || d.issuedDate,
                };

                // Determine effective date(s)
                const results: any[] = [];
                const primaryPeriod = d.period || d.issuedDate;
                
                if (primaryPeriod) {
                    const isDaily = primaryPeriod.includes('-') && primaryPeriod.split('-').length === 3;
                    
                    results.push({
                        ...baseSale,
                        type: isDaily ? 'daily' as const : 'monthly' as const,
                        period: primaryPeriod,
                    });

                    // If it's a monthly invoice but has a specific issuedDate, 
                    // also create a daily entry so it appears on the calendar
                    if (!isDaily && d.issuedDate && d.issuedDate !== primaryPeriod) {
                        results.push({
                            ...baseSale,
                            type: 'daily' as const,
                            period: d.issuedDate,
                        });
                    }
                }

                return results;
            });

        // Deduplication and Merging
        const result = [...manualSales];
        
        documentSales.forEach(docSale => {
            // Heuristic Deduplication: 
            // 1. Same transactionId if exists
            // 2. Same store, period, and amount (within 1 yen)
            const duplicateIndex = result.findIndex(s => 
                (docSale.transactionId && (s as any).transactionId === docSale.transactionId) ||
                (s.storeId === docSale.storeId && 
                 s.period === docSale.period && 
                 Math.abs(s.totalAmount - docSale.totalAmount) < 2)
            );
            
            if (duplicateIndex !== -1) {
                // Prioritize Document (Invoice/DN) over manual entry
                result[duplicateIndex] = docSale;
            } else {
                result.push(docSale);
            }
        });

        // 取引(Transaction)から顧客情報を紐付ける
        const mappedResult = result.map(s => {
            if (s.transactionId) {
                const tx = transactions.find(t => t.id === s.transactionId);
                if (tx) {
                    return {
                        ...s,
                        customerName: tx.customerName,
                        customerEmail: (tx as any).customerEmail,
                        shopifyCustomerId: (tx as any).shopifyCustomerId,
                        isRepeatCustomer: (tx as any).isRepeatCustomer,
                        shopifyOrdersCount: (tx as any).shopifyOrdersCount,
                    };
                }
            }
            return s;
        });

        return mappedResult.sort((a, b) => b.period.localeCompare(a.period));
    }, [sales, issuedDocuments, transactions, retailStores]);

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
        sales,
        unifiedSales, // Added combined sales
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
        mutateRetailStores,
        // Composite Production
        compositeProductions,
        addCompositeProduction,
        mutateCompositeProductions,
        // Promotion Tasks
        promotionTasks,
        togglePromotionTask: async (task: Omit<PromotionTask, "updatedAt">) => {
            if (checkDemoMode()) return;
            const taskWithUpdate = { 
                ...task, 
                isCompleted: !task.isCompleted, 
                updatedAt: new Date().toISOString() 
            };
            
            // Optimistic update
            const newTasks = promotionTasks.some(t => t.id === task.id)
                ? promotionTasks.map(t => t.id === task.id ? { ...t, ...taskWithUpdate } : t)
                : [...promotionTasks, taskWithUpdate as PromotionTask];
                
            mutatePromotionTasks(newTasks, false);
            
            await setDoc(doc(db, "seasonal_tasks", task.id), {
                ...taskWithUpdate,
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            mutatePromotionTasks();
        },
        mutatePromotionTasks,

        // Promotion Events (Custom & Overrides)
        promotionEvents: (promotionEvents ?? []).filter(e => !e.isTrashed),
        savePromotionEvent: async (event: Omit<PromotionEvent, 'createdAt'>) => {
            const now = new Date().toISOString();
            const eventWithUpdate = { 
                ...event, 
                createdAt: (event as any).createdAt || now,
                updatedAt: now 
            };
            const col = "promotion_events";
            
            const newEvents = promotionEvents.some(e => e.id === event.id)
                ? promotionEvents.map(e => e.id === event.id ? { ...e, ...eventWithUpdate } : e)
                : [...promotionEvents, eventWithUpdate as PromotionEvent];
            
            mutatePromotionEvents(newEvents, false);
            if (checkDemoMode()) return;
            try {
                await setDoc(doc(db, col, event.id), { ...eventWithUpdate, isTrashed: false }, { merge: true });
            } finally {
                mutatePromotionEvents();
            }
        },
        deletePromotionEvent: async (id: string) => {
            const col = "promotion_events";
            const newEvents = promotionEvents.filter(e => e.id !== id);
            mutatePromotionEvents(newEvents, false);
            if (checkDemoMode()) return;
            try {
                await updateDoc(doc(db, col, id), { isTrashed: true });
            } finally {
                mutatePromotionEvents();
            }
        },
        // MQ Accounting Action Handlers
        workLogs,
        mutateWorkLogs,
        addWorkLog: async (data: Omit<WorkLog, "id" | "createdAt">) => {
            const newRef = doc(collection(db, "workLogs"));
            const newLog: WorkLog = {
                id: newRef.id,
                ...data,
                createdAt: new Date().toISOString()
            };
            mutateWorkLogs([newLog, ...workLogs], false);
            if (checkDemoMode()) return newRef.id;
            await setDoc(newRef, {
                ...data,
                createdAt: serverTimestamp()
            });
            mutateWorkLogs();
            return newRef.id;
        },
        updateWorkLog: async (id: string, data: Partial<Omit<WorkLog, "id" | "createdAt">>) => {
            mutateWorkLogs(workLogs.map(l => l.id === id ? { ...l, ...data } : l), false);
            if (checkDemoMode()) return;
            await updateDoc(doc(db, "workLogs", id), data);
            mutateWorkLogs();
        },
        deleteWorkLog: async (id: string) => {
            mutateWorkLogs(workLogs.filter(l => l.id !== id), false);
            if (checkDemoMode()) return;
            await deleteDoc(doc(db, "workLogs", id));
            mutateWorkLogs();
        },
        fixedCosts,
        mutateFixedCosts,
        saveFixedCosts: async (data: Omit<FixedCost, "createdAt" | "updatedAt">) => {
            const docRef = doc(db, "fixedCosts", data.id);
            const now = new Date().toISOString();
            const record = {
                ...data,
                createdAt: now,
                updatedAt: now
            };
            const newCosts = fixedCosts.some(c => c.id === data.id)
                ? fixedCosts.map(c => c.id === data.id ? record : c)
                : [...fixedCosts, record];
            mutateFixedCosts(newCosts, false);

            // Mapping FixedCost aggregate fields to template categories from Basic Settings
            const fieldMappings: Record<string, string[]> = {
                rentCost: ["地代家賃"],
                laborCost: ["給与・手当", "外注費"],
                utilityCost: ["水道光熱費"],
                communicationCost: ["通信費"],
                vehicleCost: ["交通費"],
                softwareCost: ["諸会費・サブスク"],
                otherFixedCost: ["その他", "その他2"]
            };

            const templates = (data as any).items && (data as any).items.length > 0
                ? (data as any).items.filter((t: any) => t.enabled)
                : (companySettings?.fixedCostTemplates && companySettings.fixedCostTemplates.length > 0
                    ? companySettings.fixedCostTemplates.filter(t => t.enabled)
                    : []);

            let newExpenses = [...(expenses || [])];
            const targetDate = `${data.targetMonth}-01`;
            const activeSyncedExpenseIds = new Set<string>();

            // Process each FixedCost field to generate proportional allocations or default fallbacks
            for (const [fieldKey, categories] of Object.entries(fieldMappings)) {
                const totalAmount = Number((data as any)[fieldKey]) || 0;
                const fieldTemplates = templates.filter((t: any) => categories.includes(t.category));
                const templateSum = fieldTemplates.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

                if (totalAmount > 0) {
                    if (fieldTemplates.length === 0) {
                        // Fallback: Create a single default expense record if no template exists
                        const expenseId = `fixed_${data.targetMonth}_${fieldKey}`;
                        activeSyncedExpenseIds.add(expenseId);

                        const defaultCategory = categories[0] || "その他";
                        const defaultPaymentMethod = (defaultCategory === "地代家賃" || defaultCategory === "給与・手当" ? "銀行振込" : defaultCategory === "その他" ? "小口現金" : "クレジット");

                        const expenseRecord: Expense = {
                            id: expenseId,
                            date: targetDate,
                            category: defaultCategory,
                            paymentMethod: defaultPaymentMethod,
                            item: `${defaultCategory}・経費 (毎月の固定費管理)`,
                            amount: totalAmount,
                            vendor: "固定費一括計上",
                            isAnalyzed: false,
                            isConfirmed: true,
                            memo: "毎月の固定費管理から自動同期 (基本設定テンプレートなし)",
                            isTrashed: false,
                            createdAt: now,
                            updatedAt: now
                        };

                        newExpenses = newExpenses.some(e => e.id === expenseId)
                            ? newExpenses.map(e => e.id === expenseId ? expenseRecord : e)
                            : [expenseRecord, ...newExpenses];

                        if (!isDemoMode) {
                            await setDoc(doc(db, "expenses", expenseId), {
                                date: targetDate,
                                category: defaultCategory,
                                paymentMethod: defaultPaymentMethod,
                                item: `${defaultCategory}・経費 (毎月の固定費管理)`,
                                amount: totalAmount,
                                vendor: "固定費一括計上",
                                isAnalyzed: false,
                                isConfirmed: true,
                                memo: "毎月の固定費管理から自動同期 (基本設定テンプレートなし)",
                                isTrashed: false,
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp()
                            }, { merge: true });
                        }
                    } else {
                        // Proportional distribution among matching templates
                        let distributedSum = 0;
                        for (let idx = 0; idx < fieldTemplates.length; idx++) {
                            const template = fieldTemplates[idx];
                            const isLast = idx === fieldTemplates.length - 1;
                            const share = templateSum > 0 
                                ? (template.amount || 0) / templateSum 
                                : 1 / fieldTemplates.length;
                            
                            const allocatedAmount = isLast
                                ? totalAmount - distributedSum
                                : Math.round(totalAmount * share);
                            distributedSum += allocatedAmount;
                            const expenseId = `fixed_${data.targetMonth}_${template.id || template.category}`;
                            activeSyncedExpenseIds.add(expenseId);

                            const expenseRecord: Expense = {
                                id: expenseId,
                                date: targetDate,
                                category: template.category,
                                paymentMethod: template.paymentMethod || "銀行振込",
                                item: template.item || `${template.category}・固定費`,
                                amount: allocatedAmount,
                                vendor: template.vendor || "固定費一括計上",
                                isAnalyzed: false,
                                isConfirmed: true,
                                memo: "毎月の固定費管理から自動同期 (テンプレート連動)",
                                isTrashed: false,
                                createdAt: now,
                                updatedAt: now
                            };

                            newExpenses = newExpenses.some(e => e.id === expenseId)
                               ? newExpenses.map(e => e.id === expenseId ? expenseRecord : e)
                               : [expenseRecord, ...newExpenses];

                            if (!isDemoMode) {
                                await setDoc(doc(db, "expenses", expenseId), {
                                    date: targetDate,
                                    category: template.category,
                                    paymentMethod: template.paymentMethod || "銀行振込",
                                    item: template.item || `${template.category}・固定費`,
                                    amount: allocatedAmount,
                                    vendor: template.vendor || "固定費一括計上",
                                    isAnalyzed: false,
                                    isConfirmed: true,
                                    memo: "毎月の固定費管理から自動同期 (テンプレート連動)",
                                    isTrashed: false,
                                    createdAt: serverTimestamp(),
                                    updatedAt: serverTimestamp()
                                }, { merge: true });
                            }
                        }
                    }
                }
            }

            // Clean up: Soft-delete/Trash any previously synced fixed-cost expense records for this month that are no longer active
            const prefix = `fixed_${data.targetMonth}_`;
            for (const exp of newExpenses) {
                if (exp.id.startsWith(prefix) && !activeSyncedExpenseIds.has(exp.id)) {
                    if (!exp.isTrashed) {
                        newExpenses = newExpenses.map(e => e.id === exp.id ? { ...e, isTrashed: true, updatedAt: now } : e);
                        if (!isDemoMode) {
                            await updateDoc(doc(db, "expenses", exp.id), { isTrashed: true, updatedAt: serverTimestamp() }).catch(() => {});
                        }
                    }
                }
            }

            mutateExpenses(newExpenses, false);

            if (checkDemoMode()) return;

            // Write fixed cost aggregates
            await setDoc(docRef, {
                ...data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            mutateFixedCosts();
            mutateExpenses();
        },
        mqSummaries,
        mutateMqSummaries,
        triggerMonthlyMqCalculation: async (targetMonth: string) => {
            const monthSales = unifiedSales.filter(s => !s.isTrashed && (s.period || '').startsWith(targetMonth));
            const monthWorkLogs = workLogs.filter(w => !w.isTrashed && (w.workDate || '').startsWith(targetMonth));
            const monthFixedCost = fixedCosts.find(c => c.targetMonth === targetMonth) || {
                rentCost: 0, laborCost: 0, utilityCost: 0, communicationCost: 0, vehicleCost: 0, softwareCost: 0, otherFixedCost: 0, totalFixedCost: 0
            };

            let totalSales = 0;
            let totalVariableCost = 0;
            let totalMq = 0;
            let totalWorkMinutes = 0;

            const productSummaryMap: Record<string, {
                productId: string;
                productName: string;
                salesVolume: number;
                salesAmount: number;
                variableCostAmount: number;
                mqAmount: number;
                mqRate: number;
                workMinutes: number;
                mqPerHour: number;
            }> = {};

            const channelSummaryMap: Record<string, {
                channelName: string;
                salesAmount: number;
                variableCostAmount: number;
                mqAmount: number;
                mqRate: number;
            }> = {};

            const customerSummaryMap: Record<string, {
                customerId: string;
                customerName: string;
                salesAmount: number;
                variableCostAmount: number;
                mqAmount: number;
                mqRate: number;
            }> = {};

            monthSales.forEach(sale => {
                const channel = sale.salesChannel || "店頭販売";
                const custId = sale.customerId || "一般消費者";
                const custName = sale.customerId ? (spotRecipients.find(r => r.id === sale.customerId)?.name || "一般消費者") : "一般消費者";

                if (!channelSummaryMap[channel]) {
                    channelSummaryMap[channel] = { channelName: channel, salesAmount: 0, variableCostAmount: 0, mqAmount: 0, mqRate: 0 };
                }
                if (!customerSummaryMap[custId]) {
                    customerSummaryMap[custId] = { customerId: custId, customerName: custName, salesAmount: 0, variableCostAmount: 0, mqAmount: 0, mqRate: 0 };
                }

                sale.items.forEach(item => {
                    const prod = products.find(p => p.id === item.productId);
                    const prodName = item.productName || prod?.name || "不明な商品";
                    
                    const qty = item.quantity ?? 0;
                    const price = item.priceAtSale ?? 0;
                    const amt = item.subtotal ?? (qty * price);

                    const stdVarCostPerUnit = prod?.standardVariableCost ?? prod?.costPrice ?? 0;
                    const itemVarCost = item.variableCostAmount ?? (qty * stdVarCostPerUnit);
                    const itemMq = item.mqAmount ?? (amt - itemVarCost);

                    totalSales += amt;
                    totalVariableCost += itemVarCost;
                    totalMq += itemMq;

                    if (!productSummaryMap[item.productId]) {
                        productSummaryMap[item.productId] = {
                            productId: item.productId,
                            productName: prodName,
                            salesVolume: 0,
                            salesAmount: 0,
                            variableCostAmount: 0,
                            mqAmount: 0,
                            mqRate: 0,
                            workMinutes: 0,
                            mqPerHour: 0
                        };
                    }
                    productSummaryMap[item.productId].salesVolume += qty;
                    productSummaryMap[item.productId].salesAmount += amt;
                    productSummaryMap[item.productId].variableCostAmount += itemVarCost;
                    productSummaryMap[item.productId].mqAmount += itemMq;

                    channelSummaryMap[channel].salesAmount += amt;
                    channelSummaryMap[channel].variableCostAmount += itemVarCost;
                    channelSummaryMap[channel].mqAmount += itemMq;

                    customerSummaryMap[custId].salesAmount += amt;
                    customerSummaryMap[custId].variableCostAmount += itemVarCost;
                    customerSummaryMap[custId].mqAmount += itemMq;
                });
            });

            monthWorkLogs.forEach(w => {
                totalWorkMinutes += w.workMinutes;
                if (w.relatedProductId && productSummaryMap[w.relatedProductId]) {
                    productSummaryMap[w.relatedProductId].workMinutes += w.workMinutes;
                }
            });

            const productSummaries = Object.values(productSummaryMap).map(p => {
                p.mqRate = p.salesAmount > 0 ? parseFloat(((p.mqAmount / p.salesAmount) * 100).toFixed(1)) : 0;
                p.mqPerHour = p.workMinutes > 0 ? Math.round(p.mqAmount / (p.workMinutes / 60)) : 0;
                return p;
            });

            const channelSummaries = Object.values(channelSummaryMap).map(ch => {
                ch.mqRate = ch.salesAmount > 0 ? parseFloat(((ch.mqAmount / ch.salesAmount) * 100).toFixed(1)) : 0;
                return ch;
            });

            const customerSummaries = Object.values(customerSummaryMap).map(cu => {
                cu.mqRate = cu.salesAmount > 0 ? parseFloat(((cu.mqAmount / cu.salesAmount) * 100).toFixed(1)) : 0;
                return cu;
            });

            const averageMqRate = totalSales > 0 ? parseFloat(((totalMq / totalSales) * 100).toFixed(1)) : 0;
            const operatingProfit = totalMq - monthFixedCost.totalFixedCost;
            const mqPerHour = totalWorkMinutes > 0 ? Math.round(totalMq / (totalWorkMinutes / 60)) : 0;

            const finalSummary: MqSummary = {
                id: targetMonth,
                targetMonth,
                totalSales,
                totalVariableCost,
                totalMq,
                averageMqRate,
                totalFixedCost: monthFixedCost.totalFixedCost,
                operatingProfit,
                totalWorkMinutes,
                mqPerHour,
                productSummaries,
                channelSummaries,
                customerSummaries,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            mutateMqSummaries(
                mqSummaries.some(s => s.id === targetMonth)
                    ? mqSummaries.map(s => s.id === targetMonth ? finalSummary : s)
                    : [...mqSummaries, finalSummary],
                false
            );

            if (checkDemoMode()) return;
            await setDoc(doc(db, "mqSummaries", targetMonth), {
                ...finalSummary,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            mutateMqSummaries();
        }
    };

}
