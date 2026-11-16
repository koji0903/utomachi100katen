import { Product, StockMovement, StoreStockMovement, StoreStock, Brand, Supplier, Purchase } from "@/lib/store";

export interface FiscalReportItem {
    productId: string;
    productName: string;
    variantName?: string;
    sku?: string;
    brandId: string;
    brandName: string;
    supplierId: string;
    supplierName: string;
    costPrice: number;
    sellingPrice: number;
    beginningStock: number;
    inboundQty: number;
    outboundQty: number;
    endingStock: number;
    endingAmount: number;
    mainEndingStock: number;
    storeEndingStock: number;
    isExcluded: boolean;
}

export interface FiscalReportSummary {
    totalBeginningQty: number;
    totalInboundQty: number;
    totalOutboundQty: number;
    totalEndingQty: number;
    totalEndingAmount: number;
    totalItemsCount: number;
    activeSkuCount: number;
    excludedSkuCount: number;
    startDate: string;
    endDate: string;
}

export interface FiscalReportResult {
    summary: FiscalReportSummary;
    items: FiscalReportItem[];
    excludedItems: FiscalReportItem[];
}

export interface GenerateFiscalReportParams {
    products: Product[];
    stockMovements: StockMovement[];
    storeStockMovements: StoreStockMovement[];
    storeStocks: StoreStock[];
    purchases?: Purchase[];
    brands?: Brand[];
    suppliers?: Supplier[];
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    includeStoreStock?: boolean; // 委託先店舗の預け在庫も含めるか (default: true)
    excludedProductIds?: string[];
}

/**
 * 10月末決算を基準とした決算年度のプリセット日付範囲を取得する
 * 例: 現在が2026年11月の場合、直近決算期は 2025-11-01 〜 2026-10-31
 */
export function getFiscalYearPresets(baseDate = new Date()) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth() + 1; // 1-12

    // 10月末決算の場合、11月以降なら当年の10月末が決算期末。10月以前なら前年の10月末が直近確定決算期末。
    const latestClosedEndYear = month >= 11 ? year : year - 1;
    const latestClosedStartYear = latestClosedEndYear - 1;

    // 直近確定決算期 (例: 2025/11/01 〜 2026/10/31)
    const latestClosed = {
        label: `${latestClosedEndYear}年10月期（直近決算期）`,
        startDate: `${latestClosedStartYear}-11-01`,
        endDate: `${latestClosedEndYear}-10-31`,
    };

    // 前年度決算期 (例: 2024/11/01 〜 2025/10/31)
    const previousClosed = {
        label: `${latestClosedEndYear - 1}年10月期（前年度決算期）`,
        startDate: `${latestClosedStartYear - 1}-11-01`,
        endDate: `${latestClosedEndYear - 1}-10-31`,
    };

    // 今期進行期 (例: 2026/11/01 〜 今日)
    const currentYearStart = `${latestClosedEndYear}-11-01`;
    const todayStr = baseDate.toISOString().split("T")[0];
    const currentFiscalYear = {
        label: `${latestClosedEndYear + 1}年10月期（今期・進行中）`,
        startDate: currentYearStart,
        endDate: todayStr,
    };

    return {
        latestClosed,
        previousClosed,
        currentFiscalYear,
    };
}

function extractDateOnly(val: any): string | null {
    if (!val) return null;
    if (typeof val === "string") {
        const m = val.match(/^\d{4}-\d{2}-\d{2}/);
        return m ? m[0] : null;
    }
    if (typeof val === "object" && typeof val.toDate === "function") {
        try {
            return val.toDate().toISOString().split("T")[0];
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * 決算在庫レポートを計算する
 */
export function generateFiscalInventoryReport(params: GenerateFiscalReportParams): FiscalReportResult {
    const {
        products,
        stockMovements,
        storeStockMovements,
        storeStocks,
        purchases = [],
        brands = [],
        suppliers = [],
        startDate,
        endDate,
        includeStoreStock = true,
        excludedProductIds = [],
    } = params;

    const brandMap = new Map(brands.map(b => [b.id, b.name]));
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));
    const excludedSet = new Set(excludedProductIds);

    // ─── 商品ごとの取扱・仕入初日（firstActivityDate）の構築 ───
    const productFirstDateMap = new Map<string, string>();
    const registerProductDate = (productId: string, rawDate: any) => {
        const dateStr = extractDateOnly(rawDate);
        if (!dateStr) return;
        const current = productFirstDateMap.get(productId);
        if (!current || dateStr < current) {
            productFirstDateMap.set(productId, dateStr);
        }
    };

    // 1. 仕入伝票から初仕入日
    for (const pur of purchases) {
        if (pur.isTrashed) continue;
        const pDate = pur.arrivalDate || pur.receivedDate || pur.orderDate;
        if (pur.items && Array.isArray(pur.items)) {
            for (const item of pur.items) {
                if (item.productId) registerProductDate(item.productId, pDate);
            }
        }
        if (pur.productId) {
            registerProductDate(pur.productId, pDate);
        }
    }

    // 2. 本部在庫変動履歴から
    for (const sm of stockMovements) {
        if (sm.productId && sm.date) {
            registerProductDate(sm.productId, sm.date);
        }
    }

    // 3. 店舗在庫変動履歴から
    for (const ssm of storeStockMovements) {
        if (ssm.productId && ssm.date) {
            registerProductDate(ssm.productId, ssm.date);
        }
    }

    // 全社としての初活動日（全商品の最小実績日）
    let companyEarliestDate: string | null = null;
    for (const d of productFirstDateMap.values()) {
        if (!companyEarliestDate || d < companyEarliestDate) {
            companyEarliestDate = d;
        }
    }

    // 本部・店舗の現在庫マップ
    const mainCurrentStockMap = new Map<string, number>();
    for (const p of products) {
        if (!p.isTrashed) {
            mainCurrentStockMap.set(p.id, p.stock || 0);
        }
    }

    const storeCurrentStockMap = new Map<string, number>();
    if (includeStoreStock) {
        for (const ss of storeStocks) {
            storeCurrentStockMap.set(ss.productId, (storeCurrentStockMap.get(ss.productId) || 0) + (ss.stock || 0));
        }
    }

    // ─── 期間後（endDate の翌日以降〜現在）の変動集計（期末在庫の逆算用） ───
    const mainPostEndInbound = new Map<string, number>();
    const mainPostEndOutbound = new Map<string, number>();

    // ─── 期間内（startDate 〜 endDate）の変動集計 ───
    const mainPeriodInbound = new Map<string, number>();
    const mainPeriodOutbound = new Map<string, number>();

    for (const sm of stockMovements) {
        if (!sm.productId || !sm.date) continue;
        const qty = sm.quantity || 0;
        if (qty <= 0) continue;

        const isAfter = sm.date > endDate;
        const isWithin = sm.date >= startDate && sm.date <= endDate;

        if (sm.type === 'in' || sm.reason === 'purchase') {
            if (isAfter) mainPostEndInbound.set(sm.productId, (mainPostEndInbound.get(sm.productId) || 0) + qty);
            if (isWithin) mainPeriodInbound.set(sm.productId, (mainPeriodInbound.get(sm.productId) || 0) + qty);
        } else if (sm.type === 'out' || sm.reason === 'sale' || sm.reason === 'return') {
            if (isAfter) mainPostEndOutbound.set(sm.productId, (mainPostEndOutbound.get(sm.productId) || 0) + qty);
            if (isWithin) mainPeriodOutbound.set(sm.productId, (mainPeriodOutbound.get(sm.productId) || 0) + qty);
        } else if (sm.type === 'adjustment') {
            // 棚卸調整: 正なら入庫、負なら出庫相当
            if (qty > 0) {
                if (isAfter) mainPostEndInbound.set(sm.productId, (mainPostEndInbound.get(sm.productId) || 0) + qty);
                if (isWithin) mainPeriodInbound.set(sm.productId, (mainPeriodInbound.get(sm.productId) || 0) + qty);
            } else {
                const absQty = Math.abs(qty);
                if (isAfter) mainPostEndOutbound.set(sm.productId, (mainPostEndOutbound.get(sm.productId) || 0) + absQty);
                if (isWithin) mainPeriodOutbound.set(sm.productId, (mainPeriodOutbound.get(sm.productId) || 0) + absQty);
            }
        }
    }

    // ─── 店舗預け在庫の変動集計（includeStoreStock === true の場合） ───
    const storePostEndNet = new Map<string, number>(); // 期間後の純変動
    const storePeriodNet = new Map<string, number>();   // 期間内の純変動
    const storePeriodSales = new Map<string, number>(); // 委託先での純売上出庫

    if (includeStoreStock) {
        for (const ssm of storeStockMovements) {
            if (!ssm.productId || !ssm.date) continue;
            const qty = ssm.quantity || 0;
            if (qty <= 0) continue;

            const isAfter = ssm.date > endDate;
            const isWithin = ssm.date >= startDate && ssm.date <= endDate;

            const isPlus = ssm.type === 'in' || ssm.reason === 'restock' || ssm.reason === 'return';
            const delta = isPlus ? qty : -qty;

            if (isAfter) {
                storePostEndNet.set(ssm.productId, (storePostEndNet.get(ssm.productId) || 0) + delta);
            }
            if (isWithin) {
                storePeriodNet.set(ssm.productId, (storePeriodNet.get(ssm.productId) || 0) + delta);
                if (ssm.reason === 'sale') {
                    storePeriodSales.set(ssm.productId, (storePeriodSales.get(ssm.productId) || 0) + qty);
                }
            }
        }
    }

    // ─── 商品ごとのレポート行生成 ───
    const activeProducts = products.filter(p => !p.isTrashed);
    const allItems: FiscalReportItem[] = [];

    for (const p of activeProducts) {
        const isExcluded = excludedSet.has(p.id);
        const costPrice = p.costPrice || 0;
        const sellingPrice = p.sellingPrice || 0;

        // 商品の取扱初日（商品固有の実績日、または商品作成日、または全社初活動日）
        const pCreatedDate = extractDateOnly(p.createdAt);
        const effectiveFirstDate = productFirstDateMap.get(p.id) || pCreatedDate || companyEarliestDate;

        // 判定1: 取扱開始前（期間末時点でもまだ仕入れ・取扱が始まっていない過去期間、例: 2025年10月期）
        if (effectiveFirstDate && endDate < effectiveFirstDate) {
            allItems.push({
                productId: p.id,
                productName: p.name,
                variantName: p.variantName,
                sku: p.amazonSku,
                brandId: p.brandId,
                brandName: brandMap.get(p.brandId) || "未設定",
                supplierId: p.supplierId,
                supplierName: supplierMap.get(p.supplierId) || "未設定",
                costPrice,
                sellingPrice,
                beginningStock: 0,
                inboundQty: 0,
                outboundQty: 0,
                endingStock: 0,
                endingAmount: 0,
                mainEndingStock: 0,
                storeEndingStock: 0,
                isExcluded,
            });
            continue;
        }

        // 本部在庫の期末値（現在庫から期末後変動を逆算）
        const mainCurrent = mainCurrentStockMap.get(p.id) || 0;
        const mainPostIn = mainPostEndInbound.get(p.id) || 0;
        const mainPostOut = mainPostEndOutbound.get(p.id) || 0;
        // 期末在庫 = 現在庫 - (期末後入庫) + (期末後出庫)
        let mainEnding = mainCurrent - mainPostIn + mainPostOut;
        if (mainEnding < 0) mainEnding = 0;

        // 委託先店舗在庫の期末値
        let storeEnding = 0;
        if (includeStoreStock) {
            const storeCurrent = storeCurrentStockMap.get(p.id) || 0;
            const storePostNet = storePostEndNet.get(p.id) || 0;
            storeEnding = Math.max(0, storeCurrent - storePostNet);
        }

        const endingStock = mainEnding + storeEnding;

        // 期間中の入出庫
        const mainIn = mainPeriodInbound.get(p.id) || 0;
        const mainOut = mainPeriodOutbound.get(p.id) || 0;

        let inboundQty = mainIn;
        let outboundQty = mainOut;

        // 店舗在庫を含める場合：全社視点での入出庫
        // 本部から店舗への移動(補充)は全社総在庫としては社内振替のため、
        // 全社総在庫の純変動 = 本部純変動 + 店舗純変動
        if (includeStoreStock) {
            const storeSales = storePeriodSales.get(p.id) || 0;
            // 委託先売上出庫を全社出庫に反映
            outboundQty += storeSales;
        }

        // 期首在庫 = 期末在庫 - 期間入庫 + 期間出庫
        let beginningStock = endingStock - inboundQty + outboundQty;

        // 判定2: 取扱開始期（初仕入期・創業初年度、例: 2026年10月期の期首 2025-11-01）
        // 期間開始日時点ではまだ取扱前なので、期首在庫は必ず 0
        if (effectiveFirstDate && startDate < effectiveFirstDate) {
            beginningStock = 0;
            // 会計等式: beginningStock(0) + inboundQty - outboundQty = endingStock を維持
            // 初期登録残差や初期仕入等がある場合、受入合計に包含して等式を一致させる
            inboundQty = endingStock + outboundQty;
        } else if (beginningStock < 0) {
            beginningStock = 0;
            inboundQty = endingStock + outboundQty;
        }

        const endingAmount = endingStock * costPrice;

        allItems.push({
            productId: p.id,
            productName: p.name,
            variantName: p.variantName,
            sku: p.amazonSku,
            brandId: p.brandId,
            brandName: brandMap.get(p.brandId) || "未設定",
            supplierId: p.supplierId,
            supplierName: supplierMap.get(p.supplierId) || "未設定",
            costPrice,
            sellingPrice,
            beginningStock,
            inboundQty,
            outboundQty,
            endingStock,
            endingAmount,
            mainEndingStock: mainEnding,
            storeEndingStock: storeEnding,
            isExcluded,
        });
    }

    // 商品名順にソート
    allItems.sort((a, b) => {
        if (a.brandName !== b.brandName) return a.brandName.localeCompare(b.brandName);
        return a.productName.localeCompare(b.productName);
    });

    const items = allItems.filter(i => !i.isExcluded);
    const excludedItems = allItems.filter(i => i.isExcluded);

    // ─── サマリー集計（決算対象商品のみ） ───
    let totalBeginningQty = 0;
    let totalInboundQty = 0;
    let totalOutboundQty = 0;
    let totalEndingQty = 0;
    let totalEndingAmount = 0;

    for (const item of items) {
        totalBeginningQty += item.beginningStock;
        totalInboundQty += item.inboundQty;
        totalOutboundQty += item.outboundQty;
        totalEndingQty += item.endingStock;
        totalEndingAmount += item.endingAmount;
    }

    const summary: FiscalReportSummary = {
        totalBeginningQty,
        totalInboundQty,
        totalOutboundQty,
        totalEndingQty,
        totalEndingAmount,
        totalItemsCount: allItems.length,
        activeSkuCount: items.length,
        excludedSkuCount: excludedItems.length,
        startDate,
        endDate,
    };

    return {
        summary,
        items,
        excludedItems,
    };
}

/**
 * 決算在庫レポートのCSVエクスポート文字列を生成する
 */
export function exportFiscalReportToCsv(report: FiscalReportResult, companyName = "宇土まち100花展"): string {
    const { summary, items } = report;
    const lines: string[] = [];

    // ヘッダー情報
    lines.push(`"決算在庫管理レポート（棚卸資産明細書）"`);
    lines.push(`"会社名","${companyName}"`);
    lines.push(`"対象期間","${summary.startDate} 〜 ${summary.endDate}"`);
    lines.push(`"出力日時","${new Date().toLocaleString("ja-JP")}"`);
    lines.push(`"対象商品数","${summary.activeSkuCount} SKU (除外: ${summary.excludedSkuCount} SKU)"`);
    lines.push(`"期末棚卸総評価額","${summary.totalEndingAmount.toLocaleString()} 円"`);
    lines.push("");

    // 明細ヘッダー
    const headerCols = [
        "商品コード/SKU",
        "商品名",
        "バリエーション",
        "ブランド",
        "仕入先",
        "原価(評価単価)",
        "期首在庫",
        "期間入庫",
        "期間出庫",
        "期末総在庫",
        "本部実在庫",
        "委託店舗預け在庫",
        "期末評価額(円)",
    ];
    lines.push(headerCols.map(c => `"${c}"`).join(","));

    // 明細行
    for (const item of items) {
        const row = [
            item.sku || "",
            item.productName,
            item.variantName || "",
            item.brandName,
            item.supplierName,
            item.costPrice,
            item.beginningStock,
            item.inboundQty,
            item.outboundQty,
            item.endingStock,
            item.mainEndingStock,
            item.storeEndingStock,
            item.endingAmount,
        ];
        lines.push(row.map(val => typeof val === "number" ? val : `"${String(val).replace(/"/g, '""')}"`).join(","));
    }

    // 合計行
    lines.push("");
    const totalRow = [
        "【合計】",
        "",
        "",
        "",
        "",
        "",
        summary.totalBeginningQty,
        summary.totalInboundQty,
        summary.totalOutboundQty,
        summary.totalEndingQty,
        "",
        "",
        summary.totalEndingAmount,
    ];
    lines.push(totalRow.map(val => typeof val === "number" ? val : `"${val}"`).join(","));

    return "\uFEFF" + lines.join("\r\n"); // UTF-8 BOM付き
}
