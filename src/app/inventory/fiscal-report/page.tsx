"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    FileSpreadsheet,
    Printer,
    SlidersHorizontal,
    Search,
    Calendar,
    Building2,
    CheckCircle2,
    X,
    Filter,
    HelpCircle,
    Package,
    TrendingUp,
    TrendingDown,
    ArrowUpDown,
    Check,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
    generateFiscalInventoryReport,
    getFiscalYearPresets,
    exportFiscalReportToCsv,
    type FiscalReportItem,
} from "@/lib/fiscalInventoryReport";
import { showNotification } from "@/lib/notifications";

const EXCLUDED_STORAGE_KEY = "fiscal_report_excluded_product_ids_v1";

export default function FiscalInventoryReportPage() {
    const router = useRouter();
    const {
        products,
        stockMovements,
        storeStockMovements,
        storeStocks,
        purchases,
        brands,
        suppliers,
        companySettings,
        isLoaded,
    } = useStore();

    // 決算年度プリセット（10月末決算基準）
    const presets = useMemo(() => getFiscalYearPresets(), []);

    // 期間ステート
    const [startDate, setStartDate] = useState(presets.latestClosed.startDate);
    const [endDate, setEndDate] = useState(presets.latestClosed.endDate);
    const [activePreset, setActivePreset] = useState<"latest" | "previous" | "current" | "custom">("latest");

    // 集計範囲（店舗預け在庫を含むか）
    const [includeStoreStock, setIncludeStoreStock] = useState(true);

    // 除外商品IDリスト（ローカルストレージに永続化）
    const [excludedProductIds, setExcludedProductIds] = useState<string[]>([]);
    const [isProductFilterModalOpen, setIsProductFilterModalOpen] = useState(false);

    // 一覧フィルター＆ソート
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBrandFilter, setSelectedBrandFilter] = useState("all");
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState("all");
    const [activeTab, setActiveTab] = useState<"active" | "excluded">("active");
    const [sortKey, setSortKey] = useState<keyof FiscalReportItem>("endingAmount");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    // 除外商品IDの復元
    useEffect(() => {
        try {
            const saved = localStorage.getItem(EXCLUDED_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) setExcludedProductIds(parsed);
            }
        } catch (e) {
            console.error("Failed to load excluded products:", e);
        }
    }, []);

    // 除外設定の保存
    const handleUpdateExcluded = (newExcluded: string[]) => {
        setExcludedProductIds(newExcluded);
        try {
            localStorage.setItem(EXCLUDED_STORAGE_KEY, JSON.stringify(newExcluded));
            showNotification("決算対象商品の設定を保存しました。");
        } catch (e) {
            console.error("Failed to save excluded products:", e);
        }
    };

    // プリセット切り替え
    const handleSelectPreset = (presetKey: "latest" | "previous" | "current") => {
        setActivePreset(presetKey);
        if (presetKey === "latest") {
            setStartDate(presets.latestClosed.startDate);
            setEndDate(presets.latestClosed.endDate);
        } else if (presetKey === "previous") {
            setStartDate(presets.previousClosed.startDate);
            setEndDate(presets.previousClosed.endDate);
        } else if (presetKey === "current") {
            setStartDate(presets.currentFiscalYear.startDate);
            setEndDate(presets.currentFiscalYear.endDate);
        }
    };

    // レポート計算
    const report = useMemo(() => {
        if (!isLoaded) return null;
        return generateFiscalInventoryReport({
            products,
            stockMovements,
            storeStockMovements,
            storeStocks,
            purchases,
            brands,
            suppliers,
            startDate,
            endDate,
            includeStoreStock,
            excludedProductIds,
        });
    }, [
        isLoaded,
        products,
        stockMovements,
        storeStockMovements,
        storeStocks,
        purchases,
        brands,
        suppliers,
        startDate,
        endDate,
        includeStoreStock,
        excludedProductIds,
    ]);

    // テーブル表示用フィルタ・ソート
    const displayedItems = useMemo(() => {
        if (!report) return [];
        const source = activeTab === "active" ? report.items : report.excludedItems;

        return source
            .filter((item) => {
                if (selectedBrandFilter !== "all" && item.brandId !== selectedBrandFilter) return false;
                if (selectedSupplierFilter !== "all" && item.supplierId !== selectedSupplierFilter) return false;
                if (searchTerm.trim()) {
                    const q = searchTerm.toLowerCase();
                    const matchName = item.productName.toLowerCase().includes(q);
                    const matchSku = item.sku?.toLowerCase().includes(q);
                    const matchVariant = item.variantName?.toLowerCase().includes(q);
                    if (!matchName && !matchSku && !matchVariant) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const valA = a[sortKey] ?? 0;
                const valB = b[sortKey] ?? 0;
                if (typeof valA === "number" && typeof valB === "number") {
                    return sortDirection === "asc" ? valA - valB : valB - valA;
                }
                const strA = String(valA);
                const strB = String(valB);
                return sortDirection === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
            });
    }, [report, activeTab, selectedBrandFilter, selectedSupplierFilter, searchTerm, sortKey, sortDirection]);

    const handleSort = (key: keyof FiscalReportItem) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    };

    // CSVエクスポート
    const handleExportCsv = () => {
        if (!report) return;
        const csv = exportFiscalReportToCsv(report, companySettings?.companyName || "宇土まち100花展");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `決算在庫レポート_${startDate}_${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification("決算在庫レポートをCSV出力しました。");
    };

    // 印刷
    const handlePrint = () => {
        window.print();
    };

    if (!isLoaded || !report) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a8a] rounded-full animate-spin" />
                <p className="text-sm font-bold text-slate-500">決算在庫レポートを集計中...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 print:p-0 print:m-0 print:max-w-none print:space-y-4">
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 10mm 12mm;
                    }
                    html, body {
                        background: #ffffff !important;
                        height: auto !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .printable-fiscal-table thead {
                        display: table-header-group;
                    }
                    .printable-fiscal-table tfoot {
                        display: table-row-group;
                    }
                    .printable-fiscal-table tr {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                }
            `}</style>
            {/* 画面ヘッダー（印刷時は非表示） */}
            <div className="space-y-4 print:hidden">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.back()}
                        className="p-2 text-slate-400 hover:text-[#1e3a8a] hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <Link
                        href="/inventory"
                        className="text-xs font-bold text-slate-400 hover:text-[#1e3a8a] transition-colors"
                    >
                        在庫管理
                    </Link>
                    <span className="text-slate-300">/</span>
                    <span className="text-xs font-bold text-slate-600">決算在庫管理レポート</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/60 rounded-lg text-xs font-black tracking-wide mb-2">
                            <span>10月末決算対応</span>
                            <span>•</span>
                            <span>棚卸資産明細書</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                            決算在庫管理レポート
                        </h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            年度末（10月末）時点の在庫数量・原価評価額、および期間内の入出庫推移を正確に集計します。
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={() => setIsProductFilterModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-sm rounded-xl transition-all shadow-xs"
                        >
                            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                            対象商品設定
                            {excludedProductIds.length > 0 && (
                                <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-xs font-black">
                                    {excludedProductIds.length} 除外
                                </span>
                            )}
                        </button>
                        <button
                            onClick={handleExportCsv}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-sm rounded-xl transition-all shadow-xs"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            CSV出力
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#1e3a8a] text-white hover:bg-blue-800 font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-900/10 active:scale-95"
                        >
                            <Printer className="w-4 h-4" />
                            帳票印刷 / PDF保存
                        </button>
                    </div>
                </div>
            </div>

            {/* 印刷用ヘッダー（印刷時のみ表示） */}
            <div className="hidden print:block mb-6 border-b-2 border-slate-800 pb-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">決算在庫管理レポート（期末棚卸資産明細書）</h1>
                        <p className="text-xs text-slate-600 mt-1">
                            対象期間: {startDate} 〜 {endDate} （10月末決算期） / 集計基準: 原価法（個別・最終仕入原価）
                        </p>
                        <p className="text-xs text-slate-600">
                            対象範囲: {includeStoreStock ? "全社総在庫（自社倉庫 ＋ 委託先預け在庫）" : "自社倉庫（本部実在庫）のみ"}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">{companySettings?.companyName || "宇土まち100花展"}</div>
                        <div className="text-[10px] text-slate-500">作成日: {new Date().toLocaleDateString("ja-JP")}</div>
                        {/* 承認印欄 */}
                        <div className="flex gap-2 mt-2 justify-end">
                            <div className="w-14 h-14 border border-slate-300 rounded text-[9px] flex flex-col justify-between items-center p-1">
                                <span className="text-slate-400">代表者</span>
                                <span className="border-t border-slate-200 w-full"></span>
                            </div>
                            <div className="w-14 h-14 border border-slate-300 rounded text-[9px] flex flex-col justify-between items-center p-1">
                                <span className="text-slate-400">経理責任者</span>
                                <span className="border-t border-slate-200 w-full"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* コントロールバー（印刷時は非表示） */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 print:hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* プリセットボタン */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                            決算期の選択
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => handleSelectPreset("latest")}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    activePreset === "latest"
                                        ? "bg-[#1e3a8a] text-white shadow-xs ring-2 ring-blue-500/20"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                                }`}
                            >
                                {presets.latestClosed.label}
                            </button>
                            <button
                                onClick={() => handleSelectPreset("previous")}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    activePreset === "previous"
                                        ? "bg-[#1e3a8a] text-white shadow-xs ring-2 ring-blue-500/20"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                                }`}
                            >
                                {presets.previousClosed.label}
                            </button>
                            <button
                                onClick={() => handleSelectPreset("current")}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    activePreset === "current"
                                        ? "bg-[#1e3a8a] text-white shadow-xs ring-2 ring-blue-500/20"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                                }`}
                            >
                                {presets.currentFiscalYear.label}
                            </button>
                        </div>
                    </div>

                    {/* 日付範囲カスタム指定 */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div>
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1">
                                開始日（期首）
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setActivePreset("custom");
                                }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                        <span className="text-slate-400 mt-5 font-bold">〜</span>
                        <div>
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1">
                                終了日（期末日）
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setActivePreset("custom");
                                }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                </div>

                {/* 集計範囲切り替え */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-slate-600">在庫の集計範囲:</span>
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                            <input
                                type="radio"
                                name="storeScope"
                                checked={includeStoreStock}
                                onChange={() => setIncludeStoreStock(true)}
                                className="w-4 h-4 text-[#1e3a8a] focus:ring-blue-500"
                            />
                            <span>全社総在庫（自社倉庫 ＋ 委託先店舗預け在庫）</span>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">税務・会計標準</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                            <input
                                type="radio"
                                name="storeScope"
                                checked={!includeStoreStock}
                                onChange={() => setIncludeStoreStock(false)}
                                className="w-4 h-4 text-[#1e3a8a] focus:ring-blue-500"
                            />
                            <span>自社倉庫（本部実在庫）のみ</span>
                        </label>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>期首 ＋ 期間入庫 － 期間出庫 ＝ 期末在庫の完全等式で検証されます</span>
                    </div>
                </div>
            </div>

            {/* 活動開始前期間の案内（印刷時は非表示） */}
            {report.summary.totalBeginningQty === 0 &&
                report.summary.totalInboundQty === 0 &&
                report.summary.totalOutboundQty === 0 &&
                report.summary.totalEndingQty === 0 && (
                    <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3 print:hidden shadow-xs">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-900 leading-relaxed">
                            <span className="font-bold">仕入・取扱開始前の決算期間です：</span>
                            指定された期間（{startDate} 〜 {endDate}）は、当社の仕入・事業活動開始日（2026年3月）より前の期間のため、取扱前として期首・期末在庫および入出庫はすべて 0（計上なし）となっています。
                        </div>
                    </div>
                )}

            {/* サマリーカード（KPI） */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
                {/* 期末棚卸評価額 */}
                <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs print:p-3 print:border-slate-300">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">期末棚卸総評価額</span>
                        <Building2 className="w-4 h-4 text-[#1e3a8a] print:hidden" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums print:text-xl">
                        ¥{report.summary.totalEndingAmount.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                        {endDate} 時点 原価ベース評価
                    </p>
                </div>

                {/* 期末総在庫数 */}
                <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs print:p-3 print:border-slate-300">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">期末総在庫数</span>
                        <Package className="w-4 h-4 text-emerald-600 print:hidden" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums print:text-xl">
                        {report.summary.totalEndingQty.toLocaleString()}{" "}
                        <span className="text-xs font-normal text-slate-500">点</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                        対象: {report.summary.activeSkuCount} SKU（除外: {report.summary.excludedSkuCount}）
                    </p>
                </div>

                {/* 期間中総入庫 */}
                <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs print:p-3 print:border-slate-300">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">期間中総入庫</span>
                        <TrendingUp className="w-4 h-4 text-blue-600 print:hidden" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-blue-700 tracking-tight tabular-nums print:text-xl">
                        +{report.summary.totalInboundQty.toLocaleString()}{" "}
                        <span className="text-xs font-normal text-slate-500">点</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                        仕入・生産・受入の合計
                    </p>
                </div>

                {/* 期間中総出庫 */}
                <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs print:p-3 print:border-slate-300">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">期間中総出庫</span>
                        <TrendingDown className="w-4 h-4 text-rose-600 print:hidden" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-rose-700 tracking-tight tabular-nums print:text-xl">
                        -{report.summary.totalOutboundQty.toLocaleString()}{" "}
                        <span className="text-xs font-normal text-slate-500">点</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                        売上・納品・販促等の合計
                    </p>
                </div>
            </div>

            {/* テーブルセクション */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:overflow-visible print:border-none print:shadow-none">
                {/* テーブルヘッダー操作部（印刷時は非表示） */}
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                    {/* タブ（決算対象 / 除外商品） */}
                    <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                        <button
                            onClick={() => setActiveTab("active")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === "active"
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            決算対象商品 ({report.items.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("excluded")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === "excluded"
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            除外商品 ({report.excludedItems.length})
                        </button>
                    </div>

                    {/* 検索・絞り込み */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* ブランド絞り込み */}
                        <select
                            value={selectedBrandFilter}
                            onChange={(e) => setSelectedBrandFilter(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                        >
                            <option value="all">すべてのブランド</option>
                            {brands.filter((b) => !b.isTrashed).map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>

                        {/* 仕入先絞り込み */}
                        <select
                            value={selectedSupplierFilter}
                            onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                        >
                            <option value="all">すべての仕入先</option>
                            {suppliers.filter((s) => !s.isTrashed).map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>

                        {/* 検索入力 */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="商品名・SKUで検索..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none w-48 sm:w-60"
                            />
                        </div>
                    </div>
                </div>

                {/* 明細テーブル */}
                <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left text-xs border-collapse printable-fiscal-table">
                        <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200/80 print:bg-slate-100 print:text-slate-700">
                            <tr>
                                <th className="px-4 py-3 print:px-2 print:py-1.5">商品情報</th>
                                <th className="px-3 py-3 print:px-2 print:py-1.5">ブランド / 仕入先</th>
                                <th
                                    onClick={() => handleSort("costPrice")}
                                    className="px-3 py-3 text-right cursor-pointer hover:bg-slate-100/60 print:px-2 print:py-1.5"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        原価単価
                                        <ArrowUpDown className="w-3 h-3 text-slate-400 print:hidden" />
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort("beginningStock")}
                                    className="px-3 py-3 text-right cursor-pointer hover:bg-slate-100/60 print:px-2 print:py-1.5"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        期首在庫
                                        <ArrowUpDown className="w-3 h-3 text-slate-400 print:hidden" />
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort("inboundQty")}
                                    className="px-3 py-3 text-right cursor-pointer hover:bg-slate-100/60 print:px-2 print:py-1.5"
                                >
                                    <div className="flex items-center justify-end gap-1 text-blue-700">
                                        期間入庫
                                        <ArrowUpDown className="w-3 h-3 text-slate-400 print:hidden" />
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort("outboundQty")}
                                    className="px-3 py-3 text-right cursor-pointer hover:bg-slate-100/60 print:px-2 print:py-1.5"
                                >
                                    <div className="flex items-center justify-end gap-1 text-rose-700">
                                        期間出庫
                                        <ArrowUpDown className="w-3 h-3 text-slate-400 print:hidden" />
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort("endingStock")}
                                    className="px-3 py-3 text-right cursor-pointer hover:bg-slate-100/60 print:px-2 print:py-1.5"
                                >
                                    <div className="flex items-center justify-end gap-1 font-black text-slate-800">
                                        期末在庫数
                                        <ArrowUpDown className="w-3 h-3 text-slate-400 print:hidden" />
                                    </div>
                                </th>
                                {includeStoreStock && (
                                    <th className="px-3 py-3 text-right text-[9px] text-slate-400 font-semibold print:px-2 print:py-1.5">
                                        （内訳: 本部 / 委託）
                                    </th>
                                )}
                                <th
                                    onClick={() => handleSort("endingAmount")}
                                    className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100/60 font-black text-slate-900 print:px-2 print:py-1.5"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        期末評価額
                                        <ArrowUpDown className="w-3 h-3 text-slate-400 print:hidden" />
                                    </div>
                                </th>
                                <th className="px-3 py-3 text-center print:hidden">除外設定</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                            {displayedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-bold">
                                        該当する商品データがありません
                                    </td>
                                </tr>
                            ) : (
                                displayedItems.map((item) => (
                                    <tr
                                        key={item.productId}
                                        className={`hover:bg-slate-50/70 transition-colors ${
                                            item.isExcluded ? "opacity-60 bg-slate-50/50" : ""
                                        }`}
                                    >
                                        {/* 商品名 */}
                                        <td className="px-4 py-3 font-bold text-slate-900 print:px-2 print:py-1.5">
                                            <div>{item.productName}</div>
                                            {item.variantName && (
                                                <div className="text-[10px] text-slate-400 font-medium">
                                                    {item.variantName}
                                                </div>
                                            )}
                                            {item.sku && (
                                                <div className="text-[9px] font-mono text-slate-400">
                                                    SKU: {item.sku}
                                                </div>
                                            )}
                                        </td>

                                        {/* ブランド / 仕入先 */}
                                        <td className="px-3 py-3 text-slate-600 print:px-2 print:py-1.5">
                                            <div className="font-semibold">{item.brandName}</div>
                                            <div className="text-[10px] text-slate-400">{item.supplierName}</div>
                                        </td>

                                        {/* 原価 */}
                                        <td className="px-3 py-3 text-right font-mono text-slate-700 print:px-2 print:py-1.5">
                                            ¥{item.costPrice.toLocaleString()}
                                        </td>

                                        {/* 期首在庫 */}
                                        <td className="px-3 py-3 text-right font-mono text-slate-600 print:px-2 print:py-1.5">
                                            {item.beginningStock}
                                        </td>

                                        {/* 期間入庫 */}
                                        <td className="px-3 py-3 text-right font-mono font-bold text-blue-700 print:px-2 print:py-1.5">
                                            {item.inboundQty > 0 ? `+${item.inboundQty}` : "-"}
                                        </td>

                                        {/* 期間出庫 */}
                                        <td className="px-3 py-3 text-right font-mono font-bold text-rose-700 print:px-2 print:py-1.5">
                                            {item.outboundQty > 0 ? `-${item.outboundQty}` : "-"}
                                        </td>

                                        {/* 期末在庫数 */}
                                        <td className="px-3 py-3 text-right font-mono font-black text-slate-900 text-sm print:px-2 print:py-1.5">
                                            <span className={item.endingStock < 0 ? "text-red-600 font-black" : ""}>
                                                {item.endingStock}
                                            </span>
                                        </td>

                                        {/* 内訳 */}
                                        {includeStoreStock && (
                                            <td className="px-3 py-3 text-right font-mono text-[10px] text-slate-400 print:px-2 print:py-1.5">
                                                <span>{item.mainEndingStock}</span> / <span>{item.storeEndingStock}</span>
                                            </td>
                                        )}

                                        {/* 期末評価額 */}
                                        <td className="px-4 py-3 text-right font-mono font-black text-slate-900 text-sm print:px-2 print:py-1.5">
                                            ¥{item.endingAmount.toLocaleString()}
                                        </td>

                                        {/* 除外トグルボタン（印刷時は非表示） */}
                                        <td className="px-3 py-3 text-center print:hidden">
                                            <button
                                                onClick={() => {
                                                    const next = item.isExcluded
                                                        ? excludedProductIds.filter((id) => id !== item.productId)
                                                        : [...excludedProductIds, item.productId];
                                                    handleUpdateExcluded(next);
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                                    item.isExcluded
                                                        ? "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                                                        : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                                                }`}
                                            >
                                                {item.isExcluded ? "対象に戻す" : "除外する"}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {/* 合計フッター */}
                        <tfoot className="bg-slate-100/80 font-black text-slate-900 border-t-2 border-slate-300 print:bg-slate-200">
                            <tr>
                                <td colSpan={2} className="px-4 py-3 print:px-2 print:py-1.5">
                                    【合計 ({report.summary.activeSkuCount} SKU)】
                                </td>
                                <td className="px-3 py-3 text-right print:px-2 print:py-1.5">-</td>
                                <td className="px-3 py-3 text-right font-mono print:px-2 print:py-1.5">
                                    {report.summary.totalBeginningQty.toLocaleString()}
                                </td>
                                <td className="px-3 py-3 text-right font-mono text-blue-700 print:px-2 print:py-1.5">
                                    +{report.summary.totalInboundQty.toLocaleString()}
                                </td>
                                <td className="px-3 py-3 text-right font-mono text-rose-700 print:px-2 print:py-1.5">
                                    -{report.summary.totalOutboundQty.toLocaleString()}
                                </td>
                                <td className="px-3 py-3 text-right font-mono text-sm print:px-2 print:py-1.5">
                                    {report.summary.totalEndingQty.toLocaleString()}
                                </td>
                                {includeStoreStock && <td className="px-3 py-3 print:px-2 print:py-1.5">-</td>}
                                <td className="px-4 py-3 text-right font-mono text-base print:px-2 print:py-1.5">
                                    ¥{report.summary.totalEndingAmount.toLocaleString()}
                                </td>
                                <td className="print:hidden"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* 印刷用フッター注記（印刷時のみ表示） */}
            <div className="hidden print:block text-[10px] text-slate-500 border-t border-slate-300 pt-3 mt-4 leading-relaxed">
                <div className="flex justify-between items-start gap-4">
                    <div>
                        <p>※ 計算式：期首在庫 ＋ 期間入庫 － 期間出庫 ＝ 期末在庫（各商品の初回仕入・取扱開始日以前は 0 として算出）</p>
                        <p>※ 評価基準：商品マスター登録の個別仕入原価（税抜/評価単価）に基づく原価法評価</p>
                        {report.summary.excludedSkuCount > 0 && (
                            <p>※ 決算対象外として除外設定された {report.summary.excludedSkuCount} SKU は上記明細および合計額から除かれています。</p>
                        )}
                    </div>
                    <div className="text-right shrink-0">
                        <div>{companySettings?.companyName || "宇土まち100花展"} 棚卸資産管理システム</div>
                    </div>
                </div>
            </div>

            {/* 対象商品設定モーダル */}
            {isProductFilterModalOpen && (
                <ProductFilterModal
                    products={products}
                    brands={brands}
                    suppliers={suppliers}
                    excludedProductIds={excludedProductIds}
                    onSave={(newExcluded) => {
                        handleUpdateExcluded(newExcluded);
                        setIsProductFilterModalOpen(false);
                    }}
                    onClose={() => setIsProductFilterModalOpen(false)}
                />
            )}
        </div>
    );
}

/**
 * 決算対象商品・除外商品の選択モーダル
 */
function ProductFilterModal({
    products,
    brands,
    suppliers,
    excludedProductIds,
    onSave,
    onClose,
}: {
    products: any[];
    brands: any[];
    suppliers: any[];
    excludedProductIds: string[];
    onSave: (excluded: string[]) => void;
    onClose: () => void;
}) {
    const [excluded, setExcluded] = useState<Set<string>>(new Set(excludedProductIds));
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBrand, setSelectedBrand] = useState("all");

    const brandMap = new Map(brands.map((b) => [b.id, b.name]));

    const activeProducts = products.filter((p) => !p.isTrashed);

    const filtered = activeProducts.filter((p) => {
        if (selectedBrand !== "all" && p.brandId !== selectedBrand) return false;
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.amazonSku?.toLowerCase().includes(q);
        }
        return true;
    });

    const toggle = (id: string) => {
        const next = new Set(excluded);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setExcluded(next);
    };

    const handleSelectAll = () => {
        setExcluded(new Set()); // 全て対象（除外0）
    };

    const handleExcludeAllFiltered = () => {
        const next = new Set(excluded);
        filtered.forEach((p) => next.add(p.id));
        setExcluded(next);
    };

    const handleIncludeAllFiltered = () => {
        const next = new Set(excluded);
        filtered.forEach((p) => next.delete(p.id));
        setExcluded(next);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">決算対象商品の選択設定</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            決算棚卸資産の計算に含める商品をチェックしてください（チェックを外すと除外されます）。
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filter Controls */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                        >
                            <option value="all">すべてのブランド</option>
                            {brands.filter((b) => !b.isTrashed).map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="商品名で検索..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium w-48"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <button
                            type="button"
                            onClick={handleIncludeAllFiltered}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-100"
                        >
                            表示品をすべて対象
                        </button>
                        <button
                            type="button"
                            onClick={handleExcludeAllFiltered}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-rose-600 hover:bg-rose-50"
                        >
                            表示品をすべて除外
                        </button>
                    </div>
                </div>

                {/* Product List */}
                <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
                    <div className="text-xs text-slate-500 font-bold mb-2 flex items-center justify-between">
                        <span>全 {filtered.length} 品目</span>
                        <span>
                            対象: <span className="text-[#1e3a8a] font-black">{activeProducts.length - excluded.size}</span> / 除外: <span className="text-rose-600 font-black">{excluded.size}</span>
                        </span>
                    </div>

                    {filtered.map((product) => {
                        const isIncluded = !excluded.has(product.id);
                        return (
                            <label
                                key={product.id}
                                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-all ${
                                    isIncluded ? "bg-white" : "bg-slate-50/70 opacity-60"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={isIncluded}
                                        onChange={() => toggle(product.id)}
                                        className="w-4 h-4 rounded text-[#1e3a8a] focus:ring-blue-500 border-slate-300"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-slate-900">{product.name}</div>
                                        <div className="text-[10px] text-slate-400">
                                            {brandMap.get(product.brandId) || "ブランド未設定"} {product.amazonSku ? `• ${product.amazonSku}` : ""}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-xs font-mono font-bold text-slate-700">
                                        原価: ¥{(product.costPrice || 0).toLocaleString()}
                                    </div>
                                    <div className={`text-[10px] font-bold ${isIncluded ? "text-emerald-600" : "text-rose-500"}`}>
                                        {isIncluded ? "決算対象" : "除外"}
                                    </div>
                                </div>
                            </label>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <button
                        onClick={handleSelectAll}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                        すべての除外を解除（全品対象）
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={() => onSave(Array.from(excluded))}
                            className="px-5 py-2 bg-[#1e3a8a] text-white rounded-xl text-xs font-bold hover:bg-blue-800 shadow-sm"
                        >
                            設定を適用する
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
