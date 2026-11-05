"use client";

import { useMemo, useState } from "react";
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer
} from "recharts";
import {
    TrendingUp, Store, Package, Calendar, Award,
    AlertCircle, Sparkles, ChevronRight, BarChart3,
    ArrowUpRight, ArrowDownRight, Layers, ShoppingBag,
    Truck, AlertTriangle, CheckCircle2, Clock, ArrowRight,
    Compass, Target, PieChart, Users, DollarSign, Percent,
    ShieldAlert, Activity, Tag, Boxes, Sliders, GitBranch
} from "lucide-react";
import Link from "next/link";
import { useStore, type Product, type RetailStore, type SpotRecipient, type Sale, type Brand } from "@/lib/store";
import { calculateDaysRemaining, getStockoutStatus, getProductStockBreakdown } from "@/lib/stockUtils";
import {
    calculateExecutiveKpis,
    aggregateStoreDailySales,
    aggregateMonthlyStoreSales,
    aggregateProductDailySales,
    aggregateBrandCockpitData,
    calculateSkuProductivityAnalysis,
    calculatePurchasingIntelligence,
    calculateConsultantStrategy,
    type CockpitPeriodDays,
} from "@/lib/salesCockpitUtils";

// グラフ用カラーパレット
const PALETTE = [
    "#2563eb", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
    "#64748b", // slate
];

export function ExecutiveSalesCockpit() {
    const { unifiedSales, products, brands = [], retailStores, spotRecipients, purchases, suppliers, storeStocks, fixedCosts = [] } = useStore();

    // タブ: 'store' (店舗別) | 'monthly' (月次推移) | 'product' (商品別) | 'brand' (ブランド別) | 'sku' (SKU展開・生産性分析) | 'purchasing' (発注・仕入判断) | 'consultant' (コンサルタント戦略分析)
    const [activeTab, setActiveTab] = useState<'store' | 'monthly' | 'product' | 'brand' | 'sku' | 'purchasing' | 'consultant'>('store');
    
    // 店舗別ビュー用フィルタ (7日 / 30日 / 90日 / 360日)
    const [selectedStoreId, setSelectedStoreId] = useState<string>("ALL");
    const [storePeriodDays, setStorePeriodDays] = useState<CockpitPeriodDays>(7);

    // 商品別ビュー用フィルタ (7日 / 30日 / 90日 / 360日)
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [productPeriodDays, setProductPeriodDays] = useState<CockpitPeriodDays>(7);

    // ブランド別ビュー用フィルタ (7日 / 30日 / 90日 / 360日)
    const [selectedBrandId, setSelectedBrandId] = useState<string>("ALL");
    const [brandPeriodDays, setBrandPeriodDays] = useState<CockpitPeriodDays>(30);

    // SKU展開・生産性分析ビュー用フィルタ (過去6ヶ月 / 過去12ヶ月)
    const [skuMonthsCount, setSkuMonthsCount] = useState<6 | 12>(6);

    // コンサルタント分析ビュー用フィルタ (7日 / 30日 / 90日)
    const [consultantPeriodDays, setConsultantPeriodDays] = useState<7 | 30 | 90>(30);

    // 発注推奨リスト用フィルタ: 'all' | 'surging' | 'urgent'
    const [reorderTrendFilter, setReorderTrendFilter] = useState<'all' | 'surging' | 'urgent'>('all');

    // 有効な商品・ブランド・店舗
    const activeProducts = useMemo(() => products.filter(p => !p.isTrashed), [products]);
    const activeBrands = useMemo(() => brands.filter(b => !b.isTrashed), [brands]);
    const activeStores = useMemo(() => retailStores.filter(s => !s.isTrashed), [retailStores]);
    const activeSpots = useMemo(() => spotRecipients.filter(s => !s.isTrashed), [spotRecipients]);

    // 商品マップ (ID -> Product)
    const productMap = useMemo(() => {
        const map = new Map<string, Product>();
        products.forEach(p => map.set(p.id, p));
        return map;
    }, [products]);

    // ─────────────────────────────────────────────────────────────
    // 月次固定費の概算シミュレーション値（最新月または当月）
    // ─────────────────────────────────────────────────────────────
    const currentMonthFixedCost = useMemo(() => {
        const d = new Date();
        const currentMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const currentRecord = fixedCosts.find(fc => fc.targetMonth === currentMonthKey);
        if (currentRecord && currentRecord.totalFixedCost > 0) {
            return currentRecord.totalFixedCost;
        }
        // 当月未登録の場合は直近の登録月レコード、または最新レコード
        if (fixedCosts.length > 0) {
            const sorted = [...fixedCosts].sort((a, b) => (b.targetMonth || "").localeCompare(a.targetMonth || ""));
            return sorted[0]?.totalFixedCost || 0;
        }
        return 0;
    }, [fixedCosts]);

    // ─────────────────────────────────────────────────────────────
    // 1. エグゼクティブ・サマリー KPI
    // ─────────────────────────────────────────────────────────────
    const executiveKpis = useMemo(() => {
        return calculateExecutiveKpis(unifiedSales, products, retailStores, spotRecipients, new Date(), brands);
    }, [unifiedSales, products, retailStores, spotRecipients, brands]);

    // ─────────────────────────────────────────────────────────────
    // 2. 店舗別ビュー（日別売上 ＆ 主力商品個数推移）
    // ─────────────────────────────────────────────────────────────
    const storeViewData = useMemo(() => {
        return aggregateStoreDailySales(unifiedSales, selectedStoreId, storePeriodDays, products, new Date(), storeStocks);
    }, [unifiedSales, selectedStoreId, storePeriodDays, products, storeStocks]);

    // ─────────────────────────────────────────────────────────────
    // 3. 月次ビュー（店舗毎の月別売上推移 過去6ヶ月）
    // ─────────────────────────────────────────────────────────────
    const monthlyViewData = useMemo(() => {
        return aggregateMonthlyStoreSales(unifiedSales, retailStores, spotRecipients, 6);
    }, [unifiedSales, retailStores, spotRecipients]);

    // ─────────────────────────────────────────────────────────────
    // 4. ブランド別ビュー（全ブランド比較＆個別ブランド商品・配架分析）
    // ─────────────────────────────────────────────────────────────
    const brandCockpitData = useMemo(() => {
        return aggregateBrandCockpitData(
            unifiedSales,
            products,
            brands,
            retailStores,
            spotRecipients,
            selectedBrandId,
            brandPeriodDays,
            new Date(),
            storeStocks
        );
    }, [unifiedSales, products, brands, retailStores, spotRecipients, selectedBrandId, brandPeriodDays, storeStocks]);

    // ─────────────────────────────────────────────────────────────
    // 5. SKU展開・生産性分析（商品種類数の推移と売上・利益への影響）
    // ─────────────────────────────────────────────────────────────
    const skuAnalysis = useMemo(() => {
        return calculateSkuProductivityAnalysis(
            products,
            unifiedSales,
            brands,
            skuMonthsCount,
            new Date(),
            storeStocks
        );
    }, [products, unifiedSales, brands, skuMonthsCount, storeStocks]);

    // ─────────────────────────────────────────────────────────────
    // 4. 商品別ビュー（特定商品の直近7日・30日 販売個数・店舗別推移）
    // ─────────────────────────────────────────────────────────────
    const effectiveProductId = selectedProductId || (executiveKpis.topProduct?.id || activeProducts[0]?.id || "");

    const targetProduct = useMemo(() => {
        return productMap.get(effectiveProductId);
    }, [productMap, effectiveProductId]);

    const productViewData = useMemo(() => {
        if (!effectiveProductId) return null;
        return aggregateProductDailySales(
            unifiedSales,
            effectiveProductId,
            productPeriodDays,
            retailStores,
            spotRecipients
        );
    }, [unifiedSales, effectiveProductId, productPeriodDays, retailStores, spotRecipients]);

    // 在庫予測（全社総在庫・本社倉庫・店頭配架の内訳）
    const productStockInfo = useMemo(() => {
        if (!targetProduct) return null;
        const breakdown = getProductStockBreakdown(targetProduct, storeStocks, retailStores);
        const daysLeft = calculateDaysRemaining(
            targetProduct,
            unifiedSales.filter(s => !s.isTrashed),
            products,
            breakdown.totalStock
        );
        const isMainEmptyWithStoreStock = breakdown.mainStock <= 0 && breakdown.storeStockTotal > 0;
        return {
            breakdown,
            stock: breakdown.totalStock,
            mainStock: breakdown.mainStock,
            storeStockTotal: breakdown.storeStockTotal,
            daysLeft,
            status: getStockoutStatus(daysLeft, isMainEmptyWithStoreStock),
            isMainEmptyWithStoreStock,
        };
    }, [targetProduct, unifiedSales, products, storeStocks, retailStores]);

    // ─────────────────────────────────────────────────────────────
    // 5. 発注・仕入の意思決定情報（購買インテリジェンス）
    // ─────────────────────────────────────────────────────────────
    const purchasingIntelligence = useMemo(() => {
        return calculatePurchasingIntelligence(products, unifiedSales, purchases, suppliers, new Date(), storeStocks);
    }, [products, unifiedSales, purchases, suppliers, storeStocks]);

    // トレンド・緊急度フィルタ適用済みの発注推奨リスト
    const filteredRecommendations = useMemo(() => {
        return purchasingIntelligence.recommendations.filter(item => {
            if (reorderTrendFilter === 'surging') return item.salesTrend === 'surging';
            if (reorderTrendFilter === 'urgent') return item.isUrgent;
            return true;
        });
    }, [purchasingIntelligence.recommendations, reorderTrendFilter]);

    // ─────────────────────────────────────────────────────────────
    // 6. 小売業経営コンサルタント戦略分析（粗利率・客単価・GMROI・パレート）
    // ─────────────────────────────────────────────────────────────
    const consultantStrategy = useMemo(() => {
        return calculateConsultantStrategy(
            unifiedSales,
            products,
            retailStores,
            spotRecipients,
            consultantPeriodDays,
            new Date(),
            storeStocks
        );
    }, [unifiedSales, products, retailStores, spotRecipients, consultantPeriodDays, storeStocks]);

    // ─────────────────────────────────────────────────────────────
    // 7. コンサルタント視点での定例会サマリー示唆（ハイライト）
    // ─────────────────────────────────────────────────────────────
    const consultantInsights = useMemo(() => {
        const bullets: string[] = [];

        // 1. 売上モメンタム
        if (executiveKpis.rev7Growth !== null) {
            if (executiveKpis.rev7Growth >= 10) {
                bullets.push(`直近7日間の全社売上は ¥${executiveKpis.rev7.toLocaleString()}（前週比 +${executiveKpis.rev7Growth.toFixed(1)}%）と力強い成長軌道にあります。`);
            } else if (executiveKpis.rev7Growth <= -10) {
                bullets.push(`直近7日間の全社売上は ¥${executiveKpis.rev7.toLocaleString()}（前週比 ${executiveKpis.rev7Growth.toFixed(1)}%）と調整局面にあります。店舗巡回や重点商品のフェイス拡大を検討してください。`);
            } else {
                bullets.push(`直近7日間の全社売上は ¥${executiveKpis.rev7.toLocaleString()}（前週比 ${executiveKpis.rev7Growth >= 0 ? "+" : ""}${executiveKpis.rev7Growth.toFixed(1)}%）と安定水準を維持しています。`);
            }
        }

        // 2. 収益性・粗利率（コンサルタント視点）
        if (consultantStrategy.totalRevenue > 0) {
            bullets.push(`【粗利・限界利益】直近${consultantPeriodDays}日の全社粗利額は ¥${consultantStrategy.totalGrossProfit.toLocaleString()}（粗利率 ${consultantStrategy.overallGrossMargin.toFixed(1)}%）。平均客単価は ¥${consultantStrategy.averageBasket.toLocaleString()}（買上点数 ${consultantStrategy.averageUnitsPerBasket}点）です。`);
        }

        // 3. 主力牽引店舗
        if (executiveKpis.topStore) {
            bullets.push(`店舗別では「${executiveKpis.topStore.name}」が直近30日で ¥${executiveKpis.topStore.amount.toLocaleString()} を売り上げ、全社の最大シェアを牽引しています。`);
        }

        // 4. ブランド動向（主力ブランド）
        if (executiveKpis.topBrand) {
            bullets.push(`【ブランド動向】「${executiveKpis.topBrand.name}」が直近30日で売上 ¥${executiveKpis.topBrand.amount.toLocaleString()}（ブランド別首位）を牽引しています。「ブランド別動向」タブで各ブランドの構成比・粗利・配架状況を分析できます。`);
        }

        // 5. SKU展開効率・生産性
        if (skuAnalysis.currentTotalSkus > 0) {
            bullets.push(`【SKU展開効率】全${skuAnalysis.currentTotalSkus}商品中、直近稼働率は ${skuAnalysis.activeSkuRate.toFixed(1)}%（1稼働SKUあたり月商 約¥${skuAnalysis.revenuePerActiveSku.toLocaleString()}）。${skuAnalysis.currentInactiveSkus > 0 ? `直近30日売上ゼロの休眠${skuAnalysis.currentInactiveSkus}品に約¥${skuAnalysis.dormantCapitalTiedUp.toLocaleString()}の在庫資金が滞留しています。` : "全品目が販売稼働しており高効率なラインナップです。"}`);
        }

        // 6. 発注・仕入れの緊急判断材料
        if (purchasingIntelligence.urgentCount > 0) {
            bullets.push(`【発注判断】現在 ${purchasingIntelligence.urgentCount} 品目が至急発注推奨（欠品または7日以内欠品）です。想定仕入予算は約 ¥${purchasingIntelligence.totalRecommendedCost.toLocaleString()} で、早期の仕入確定が必要です。`);
        } else if (purchasingIntelligence.attentionCount > 0) {
            bullets.push(`【発注判断】向こう14日以内に欠品懸念のある商品が ${purchasingIntelligence.attentionCount} 品目あります。定例会にて仕入先へのロット発注の要否をご確認ください。`);
        }

        // 5. 滞留在庫への警鐘
        if (purchasingIntelligence.stagnantItems.length > 0) {
            const topStagnant = purchasingIntelligence.stagnantItems[0];
            bullets.push(`【仕入抑制】「${topStagnant.productName}」など ${purchasingIntelligence.stagnantItems.length} 品目が直近30日販売停滞（在庫総額約 ¥${purchasingIntelligence.stagnantItems.reduce((sum, i) => sum + i.stockValue, 0).toLocaleString()}）。追加仕入は見合わせ、セールやセット商品化での消化を推奨します。`);
        }

        return bullets;
    }, [executiveKpis, purchasingIntelligence, consultantStrategy, consultantPeriodDays]);

    return (
        <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8 animate-in fade-in duration-500">
            {/* Header: Title & Badges */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            経営・現場 定例会用
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">リアルタイム売上状況モニタリング</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <BarChart3 className="w-7 h-7 text-[#1e3a8a]" />
                        売上状況エグゼクティブ・コックピット
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1 font-medium">
                        店舗別・商品別の直近推移をひと目で把握し、定例ミーティングでの迅速な意思決定と現場アクションを支援します。
                    </p>
                </div>

                {/* Tab Switches */}
                <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl self-start md:self-center flex-wrap gap-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab('store')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'store'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Store className="w-4 h-4" />
                        店舗別動向
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('monthly')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'monthly'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Layers className="w-4 h-4" />
                        店舗毎・月次推移
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('product')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'product'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Package className="w-4 h-4" />
                        商品別推移
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('brand')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'brand'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Tag className="w-4 h-4 text-violet-600" />
                        ブランド別動向
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('sku')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'sku'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Boxes className="w-4 h-4 text-emerald-600" />
                        <span>SKU展開・生産性</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black">
                            経営指標
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('purchasing')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'purchasing'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Truck className="w-4 h-4" />
                        <span>発注・仕入判断</span>
                        {purchasingIntelligence.urgentCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('consultant')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'consultant'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Compass className="w-4 h-4 text-indigo-600" />
                        <span>コンサルタント戦略分析</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black">
                            定例会推奨
                        </span>
                    </button>
                </div>
            </div>

            {/* 5大エグゼクティブKPIカード */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                        <span>直近7日 売上高</span>
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                        ¥{executiveKpis.rev7.toLocaleString()}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold">
                        {executiveKpis.rev7Growth !== null ? (
                            executiveKpis.rev7Growth >= 0 ? (
                                <span className="text-emerald-600 flex items-center">
                                    <ArrowUpRight className="w-3 h-3" /> +{executiveKpis.rev7Growth.toFixed(1)}% (前週比)
                                </span>
                            ) : (
                                <span className="text-rose-600 flex items-center">
                                    <ArrowDownRight className="w-3 h-3" /> {executiveKpis.rev7Growth.toFixed(1)}% (前週比)
                                </span>
                            )
                        ) : (
                            <span className="text-slate-400">前週データ蓄積中</span>
                        )}
                    </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                        <span>直近30日 売上高</span>
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                        ¥{executiveKpis.rev30.toLocaleString()}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 font-bold">
                        日販: <span className="text-slate-900 font-black">¥{executiveKpis.dailyAvg30.toLocaleString()}</span>
                    </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-violet-200 transition-colors cursor-pointer group" onClick={() => setActiveTab('brand')}>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                        <span>30日 首位ブランド</span>
                        <Tag className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 truncate group-hover:text-violet-600 transition-colors" title={executiveKpis.topBrand?.name}>
                        {executiveKpis.topBrand?.name || "---"}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 font-bold">
                        売上: <span className="text-violet-600 font-black">¥{executiveKpis.topBrand?.amount.toLocaleString() ?? 0}</span>
                    </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-amber-200 transition-colors cursor-pointer group" onClick={() => setActiveTab('product')}>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                        <span>30日 最多出荷商品</span>
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 truncate group-hover:text-amber-600 transition-colors" title={executiveKpis.topProduct?.name}>
                        {executiveKpis.topProduct?.name || "---"}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 font-bold">
                        出荷: <span className="text-amber-600 font-black">{executiveKpis.topProduct?.qty.toLocaleString() ?? 0} 個</span>
                    </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-200 transition-colors cursor-pointer group" onClick={() => setActiveTab('store')}>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                        <span>30日 首位店舗</span>
                        <Store className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 truncate group-hover:text-purple-600 transition-colors" title={executiveKpis.topStore?.name}>
                        {executiveKpis.topStore?.name || "---"}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 font-bold">
                        売上: <span className="text-purple-600 font-black">¥{executiveKpis.topStore?.amount.toLocaleString() ?? 0}</span>
                    </div>
                </div>
            </div>

            {/* 定例会用コンサルタント・インサイト */}
            {consultantInsights.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-black text-blue-900">定例会での注目ポイント（現状診断）</span>
                    </div>
                    <ul className="space-y-1.5">
                        {consultantInsights.map((insight, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed font-medium">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                <span>{insight}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                TAB 1: 店舗別ビュー（日別売上推移 ＆ 商品個数推移）
            ───────────────────────────────────────────────────────────── */}
            {activeTab === 'store' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-blue-600" />
                                分析対象店舗:
                            </span>
                            <select
                                value={selectedStoreId}
                                onChange={e => setSelectedStoreId(e.target.value)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">全店舗合計（全チャネル）</option>
                                <optgroup label="登録店舗">
                                    {activeStores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </optgroup>
                                {activeSpots.length > 0 && (
                                    <optgroup label="スポット宛先 / 取引先">
                                        {activeSpots.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>

                        {/* Period Switch */}
                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                            <span className="text-xs font-bold text-slate-400">期間:</span>
                            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl flex-wrap gap-0.5">
                                {[
                                    { days: 7, label: "直近7日" },
                                    { days: 30, label: "直近30日" },
                                    { days: 90, label: "直近90日" },
                                    { days: 360, label: "通年360日" },
                                ].map(p => (
                                    <button
                                        key={p.days}
                                        type="button"
                                        onClick={() => setStorePeriodDays(p.days as CockpitPeriodDays)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                            storePeriodDays === p.days ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Chart 1: 日別売上金額の推移 ＆ 移動平均線 */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-blue-600" />
                                    日別売上金額の推移 ＆ 移動平均線（{storePeriodDays === 7 ? "直近7日間" : storePeriodDays === 30 ? "直近30日間" : storePeriodDays === 90 ? "直近90日間" : "通年360日間"}）
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    期間売上合計: <span className="font-black text-slate-800">¥{storeViewData.totalPeriodAmount.toLocaleString()}</span> / 販売総数: <span className="font-black text-slate-800">{storeViewData.totalPeriodQty.toLocaleString()}個</span>
                                </p>
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold flex items-center gap-3">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-200 inline-block" />
                                    日次売上額
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-0.5 bg-blue-600 inline-block" />
                                    7日移動平均
                                </span>
                                {storePeriodDays >= 90 && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500 inline-block" />
                                        30日移動平均
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="h-64 sm:h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={storeViewData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 10, fill: '#64748b' }}
                                        axisLine={false}
                                        tickLine={false}
                                        interval={storePeriodDays === 360 ? 29 : storePeriodDays === 90 ? 12 : storePeriodDays === 30 ? 4 : 0}
                                    />
                                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `¥${(v / 1000).toLocaleString()}k`} />
                                    <Tooltip
                                        formatter={(val: any, name: any) => [
                                            `¥${Number(val).toLocaleString()}`,
                                            name === "売上額" ? "日次売上額" : name
                                        ]}
                                        labelFormatter={(l: any) => `日付: ${l}`}
                                        contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                                    <Bar dataKey="売上額" name="日次売上額" fill="#bfdbfe" radius={[4, 4, 0, 0]} maxBarSize={storePeriodDays >= 90 ? 8 : 40} />
                                    <Line type="monotone" dataKey="7日移動平均" name="7日移動平均" stroke="#2563eb" strokeWidth={2.5} dot={storePeriodDays <= 30 ? { r: 2 } : false} activeDot={{ r: 4 }} />
                                    {storePeriodDays >= 90 && (
                                        <Line type="monotone" dataKey="30日移動平均" name="30日移動平均" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
                                    )}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 2: 商品ごとの売上個数の推移（上位5商品） */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    主力商品の売上個数の日次推移（上位5商品）
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    日ごとの販売個数の推移から、欠品兆候や売れ筋の波を把握します
                                </p>
                            </div>
                        </div>

                        {storeViewData.top5Items.length > 0 ? (
                            <div className="h-64 sm:h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={storeViewData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis
                                            dataKey="label"
                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                            axisLine={false}
                                            tickLine={false}
                                            interval={storePeriodDays === 360 ? 29 : storePeriodDays === 90 ? 12 : storePeriodDays === 30 ? 4 : 0}
                                        />
                                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip
                                            formatter={(val: any, name: any) => [`${val} 個`, name]}
                                            contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                                        {storeViewData.top5Items.map((item, idx) => (
                                            <Line
                                                key={item.productId}
                                                type="monotone"
                                                dataKey={item.productName}
                                                stroke={PALETTE[idx % PALETTE.length]}
                                                strokeWidth={2.5}
                                                dot={storePeriodDays <= 30 ? { r: 2.5 } : false}
                                                activeDot={{ r: 4 }}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-400 text-xs font-bold">
                                選択期間内の商品販売データがありません。
                            </div>
                        )}
                    </div>

                    {/* Table: 商品別売上明細ランキング */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                                <Package className="w-4 h-4 text-blue-600" />
                                対象店舗での商品別売上実績（{storePeriodDays === 7 ? "直近7日間" : storePeriodDays === 30 ? "直近30日間" : storePeriodDays === 90 ? "直近90日間" : "通年360日間"}）
                            </h4>
                            <span className="text-[11px] text-slate-500 font-bold">{storeViewData.sortedItems.length} 品目</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        <th className="py-3 px-4">商品名</th>
                                        <th className="py-3 px-4 text-right">販売個数</th>
                                        <th className="py-3 px-4 text-right">売上金額</th>
                                        <th className="py-3 px-4 text-right">
                                            {selectedStoreId === "ALL" ? "全社総在庫" : "店頭在庫"}
                                        </th>
                                        <th className="py-3 px-4 text-right">日販平均</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {storeViewData.sortedItems.slice(0, 8).map((item, i) => (
                                        <tr key={item.productId} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                    i === 0 ? "bg-amber-100 text-amber-800" :
                                                    i === 1 ? "bg-slate-200 text-slate-700" :
                                                    i === 2 ? "bg-orange-100 text-orange-800" :
                                                    "bg-slate-100 text-slate-500"
                                                }`}>
                                                    {i + 1}
                                                </span>
                                                <span className="truncate max-w-[200px] sm:max-w-xs">{item.productName}</span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-slate-900">{item.qty.toLocaleString()} 個</td>
                                            <td className="py-3 px-4 text-right font-black text-blue-600">¥{item.amount.toLocaleString()}</td>
                                            <td className="py-3 px-4 text-right">
                                                <div className={`font-black ${item.stock <= 5 ? "text-rose-600" : "text-slate-900"}`}>
                                                    {item.stock} 個
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-medium">
                                                    {selectedStoreId === "ALL"
                                                        ? `本社:${item.mainStock} / 店頭計:${item.storeStockTotal}`
                                                        : `本社倉庫:${item.mainStock}個`}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right text-slate-500 font-bold">
                                                {(item.qty / storePeriodDays).toFixed(1)} 個/日
                                            </td>
                                        </tr>
                                    ))}
                                    {storeViewData.sortedItems.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                                                データがありません
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                TAB 2: 店舗毎の月ごと売上推移（過去6ヶ月の全社ポートフォリオ）
            ───────────────────────────────────────────────────────────── */}
            {activeTab === 'monthly' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-blue-600" />
                                店舗別の月次売上推移（過去6ヶ月・積み上げ比較）
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                各店舗の月次成長傾向と、全社売上に占める店舗別シェアの推移を可視化します
                            </p>
                        </div>

                        <div className="h-72 sm:h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyViewData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `¥${(v / 10000).toLocaleString()}万`} />
                                    <Tooltip
                                        formatter={(val: any, name: any) => [`¥${Number(val).toLocaleString()}`, name]}
                                        contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                                    {monthlyViewData.mainStores.map((st, idx) => (
                                        <Bar
                                            key={st.id}
                                            dataKey={st.name}
                                            stackId="a"
                                            fill={PALETTE[idx % PALETTE.length]}
                                        />
                                    ))}
                                    {monthlyViewData.hasOthers && (
                                        <Bar dataKey="その他店舗" stackId="a" fill="#cbd5e1" />
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 店舗別パフォーマンス一覧（今月売上・前月比成長率） */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                                <Store className="w-4 h-4 text-blue-600" />
                                店舗別 月次業績サマリー（前月対比・6ヶ月累計）
                            </h4>
                            <span className="text-[11px] text-slate-500 font-bold">{monthlyViewData.storePerformance.length} 拠点</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        <th className="py-3 px-4">店舗 / 販売先</th>
                                        <th className="py-3 px-4 text-right">当月売上 ({monthlyViewData.currentMonthKey})</th>
                                        <th className="py-3 px-4 text-right">前月売上</th>
                                        <th className="py-3 px-4 text-right">前月比成長率</th>
                                        <th className="py-3 px-4 text-right">過去6ヶ月累計</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {monthlyViewData.storePerformance.map((st, idx) => (
                                        <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-black">
                                                    {idx + 1}
                                                </span>
                                                <span>{st.name}</span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-slate-900">
                                                ¥{st.curAmt.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4 text-right text-slate-500 font-bold">
                                                ¥{st.prevAmt.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4 text-right font-black">
                                                {st.growth !== null ? (
                                                    st.growth >= 0 ? (
                                                        <span className="text-emerald-600 inline-flex items-center gap-0.5">
                                                            <ArrowUpRight className="w-3 h-3" /> +{st.growth.toFixed(1)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-rose-600 inline-flex items-center gap-0.5">
                                                            <ArrowDownRight className="w-3 h-3" /> {st.growth.toFixed(1)}%
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-slate-400">---</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-blue-600">
                                                ¥{st.totalAll.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                TAB 3: 商品別ビュー（特定商品の直近7日・30日 販売個数・店舗シェア推移）
            ───────────────────────────────────────────────────────────── */}
            {activeTab === 'product' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-blue-600" />
                                対象商品を選択:
                            </span>
                            <select
                                value={effectiveProductId}
                                onChange={e => setSelectedProductId(e.target.value)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs sm:max-w-md"
                            >
                                {activeProducts.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.variantName ? `(${p.variantName})` : ""} - 現在庫: {p.stock}個
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Period Switch */}
                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                            <span className="text-xs font-bold text-slate-400">期間:</span>
                            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl flex-wrap gap-0.5">
                                {[
                                    { days: 7, label: "直近7日" },
                                    { days: 30, label: "直近30日" },
                                    { days: 90, label: "直近90日" },
                                    { days: 360, label: "通年360日" },
                                ].map(p => (
                                    <button
                                        key={p.days}
                                        type="button"
                                        onClick={() => setProductPeriodDays(p.days as CockpitPeriodDays)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                            productPeriodDays === p.days ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {productViewData && targetProduct && (
                        <>
                            {/* Product Status Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="p-4 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                        期間販売数
                                    </div>
                                    <div className="text-xl font-black text-slate-900">
                                        {productViewData.totalQty.toLocaleString()} <span className="text-xs font-bold text-slate-500">個</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                        日販: {productViewData.dailyVelocity.toFixed(1)} 個/日
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                        期間売上高
                                    </div>
                                    <div className="text-xl font-black text-blue-600">
                                        ¥{productViewData.totalAmount.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                        単価約 ¥{productViewData.totalQty > 0 ? Math.round(productViewData.totalAmount / productViewData.totalQty).toLocaleString() : 0}
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                        全社総在庫数
                                    </div>
                                    <div className={`text-xl font-black ${(productStockInfo?.stock ?? 0) <= 5 ? "text-rose-600" : "text-slate-900"}`}>
                                        {productStockInfo?.stock ?? 0} <span className="text-xs font-bold text-slate-500">個</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                        本社: {productStockInfo?.mainStock ?? 0}個 / 店頭計: {productStockInfo?.storeStockTotal ?? 0}個
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                        推定在庫残日数
                                    </div>
                                    <div className="text-xl font-black text-slate-900">
                                        {productStockInfo?.daysLeft === Infinity ? "余裕あり" : `${productStockInfo?.daysLeft} 日`}
                                    </div>
                                    <div className="mt-1">
                                        {productStockInfo && (
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight ${productStockInfo.status.bg} ${productStockInfo.status.color}`}>
                                                {productStockInfo.status.label}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 店頭配架の内訳 */}
                            {productStockInfo && productStockInfo.breakdown.storeStocks.length > 0 && (
                                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">店頭配架内訳:</span>
                                    {productStockInfo.breakdown.storeStocks.map(ss => (
                                        <span key={ss.storeId} className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 font-bold text-[11px] shadow-2xs">
                                            {ss.storeName}: <strong className="text-blue-700">{ss.stock}個</strong>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Chart: 日次販売個数推移 ＆ 移動平均線 */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-blue-600" />
                                        「{targetProduct.name}」の日別販売個数 ＆ 移動平均線（{productPeriodDays === 7 ? "直近7日間" : productPeriodDays === 30 ? "直近30日間" : productPeriodDays === 90 ? "直近90日間" : "通年360日間"}）
                                    </h3>
                                    <div className="text-[10px] text-slate-400 font-bold flex items-center gap-3">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-sm bg-blue-200 inline-block" />
                                            日次個数
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-3 h-0.5 bg-blue-700 inline-block" />
                                            7日移動平均
                                        </span>
                                        {productPeriodDays >= 90 && (
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500 inline-block" />
                                                30日移動平均
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="h-64 sm:h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={productViewData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="qtyGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 10, fill: '#64748b' }}
                                                axisLine={false}
                                                tickLine={false}
                                                interval={productPeriodDays === 360 ? 29 : productPeriodDays === 90 ? 12 : productPeriodDays === 30 ? 4 : 0}
                                            />
                                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip
                                                formatter={(val: any, name: any) => [
                                                    name === "販売金額" ? `¥${Number(val).toLocaleString()}` : `${val} 個`,
                                                    name
                                                ]}
                                                contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                                            <Area type="monotone" dataKey="販売個数" name="日次販売個数" stroke="#60a5fa" strokeWidth={1.5} fillOpacity={1} fill="url(#qtyGradient)" />
                                            <Line type="monotone" dataKey="7日移動平均" name="7日移動平均" stroke="#1d4ed8" strokeWidth={2.5} dot={productPeriodDays <= 30 ? { r: 2 } : false} activeDot={{ r: 4 }} />
                                            {productPeriodDays >= 90 && (
                                                <Line type="monotone" dataKey="30日移動平均" name="30日移動平均" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
                                            )}
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* 店舗別販売シェア */}
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                                        <Store className="w-4 h-4 text-blue-600" />
                                        この商品の店舗別出荷・販売内訳
                                    </h4>
                                    <span className="text-[11px] text-slate-500 font-bold">{productViewData.storeBreakdown.length} 店舗で販売</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                <th className="py-3 px-4">販売店舗</th>
                                                <th className="py-3 px-4 text-right">販売個数</th>
                                                <th className="py-3 px-4 text-right">販売シェア</th>
                                                <th className="py-3 px-4 text-right">売上金額</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                            {productViewData.storeBreakdown.map((item, idx) => {
                                                const share = productViewData.totalQty > 0 ? (item.qty / productViewData.totalQty) * 100 : 0;
                                                return (
                                                    <tr key={item.storeId} className="hover:bg-slate-50/60 transition-colors">
                                                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-black">
                                                                {idx + 1}
                                                            </span>
                                                            <span>{item.storeName}</span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-black text-slate-900">
                                                            {item.qty.toLocaleString()} 個
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <div className="inline-flex items-center gap-2">
                                                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, share)}%` }} />
                                                                </div>
                                                                <span className="font-bold text-slate-600 w-10 text-right">{share.toFixed(0)}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-black text-blue-600">
                                                            ¥{item.amount.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {productViewData.storeBreakdown.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                                                        対象期間での店舗販売データがありません
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                TAB: ブランド別動向・売上分析ビュー（ブランドポートフォリオ戦略コックピット）
            ───────────────────────────────────────────────────────────── */}
            {activeTab === 'brand' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Controls Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-violet-600" />
                                分析対象ブランド:
                            </span>
                            <select
                                value={selectedBrandId}
                                onChange={e => setSelectedBrandId(e.target.value)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 max-w-xs sm:max-w-md"
                            >
                                <option value="ALL">全ブランド比較（シェア・ランキング・推移）</option>
                                {brandCockpitData.brandsSummary.map(b => (
                                    <option key={b.brandId} value={b.brandId}>
                                        {b.brandName} ({b.productCount}商品 / 売上 ¥{b.revenue.toLocaleString()})
                                    </option>
                                ))}
                            </select>

                            <Link
                                href="/brands"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-800 hover:underline"
                            >
                                ブランド管理を開く
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>

                        {/* Period Switch */}
                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                            <span className="text-xs font-bold text-slate-400">期間:</span>
                            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl flex-wrap gap-0.5">
                                {[
                                    { days: 7, label: "直近7日" },
                                    { days: 30, label: "直近30日" },
                                    { days: 90, label: "直近90日" },
                                    { days: 360, label: "通年360日" },
                                ].map(p => (
                                    <button
                                        key={p.days}
                                        type="button"
                                        onClick={() => setBrandPeriodDays(p.days as CockpitPeriodDays)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                            brandPeriodDays === p.days
                                                ? 'bg-violet-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Brand Status KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                                <span>期間売上高</span>
                                {selectedBrandId !== "ALL" && brandCockpitData.selectedBrand && (
                                    <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                                        シェア {brandCockpitData.selectedBrand.sharePercent.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                            <div className="text-xl font-black text-slate-900">
                                ¥{selectedBrandId === "ALL"
                                    ? brandCockpitData.totalRevenue.toLocaleString()
                                    : (brandCockpitData.selectedBrand?.revenue ?? 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                {selectedBrandId === "ALL" ? "全ブランド合計売上" : `${brandCockpitData.selectedBrand?.brandName || "選択ブランド"} 売上`}
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                期間販売数
                            </div>
                            <div className="text-xl font-black text-blue-600">
                                {selectedBrandId === "ALL"
                                    ? brandCockpitData.totalQuantity.toLocaleString()
                                    : (brandCockpitData.selectedBrand?.quantity ?? 0).toLocaleString()}
                                <span className="text-xs font-bold text-slate-500 ml-1">個</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                日販: {(
                                    (selectedBrandId === "ALL"
                                        ? brandCockpitData.totalQuantity
                                        : (brandCockpitData.selectedBrand?.quantity ?? 0)) / brandPeriodDays
                                ).toFixed(1)} 個/日
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                                <span>実質粗利額 (粗利率)</span>
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    {(selectedBrandId === "ALL"
                                        ? brandCockpitData.overallGrossMargin
                                        : (brandCockpitData.selectedBrand?.grossMargin ?? 0)
                                    ).toFixed(1)}%
                                </span>
                            </div>
                            <div className="text-xl font-black text-emerald-600">
                                ¥{selectedBrandId === "ALL"
                                    ? brandCockpitData.totalGrossProfit.toLocaleString()
                                    : (brandCockpitData.selectedBrand?.grossProfit ?? 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                仕入原価・卸値反映済みの限界利益
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                展開SKU数 / 全社総在庫
                            </div>
                            <div className="text-xl font-black text-slate-900">
                                {selectedBrandId === "ALL"
                                    ? activeProducts.length
                                    : (brandCockpitData.selectedBrand?.productCount ?? 0)}
                                <span className="text-xs font-bold text-slate-500 ml-1">SKU</span>
                                <span className="text-slate-300 mx-1.5 font-normal">/</span>
                                <span className="text-violet-700">
                                    {selectedBrandId === "ALL"
                                        ? brandCockpitData.brandsSummary.reduce((sum, b) => sum + b.totalStock, 0).toLocaleString()
                                        : (brandCockpitData.selectedBrand?.totalStock ?? 0).toLocaleString()}
                                </span>
                                <span className="text-xs font-bold text-slate-500 ml-1">個</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">
                                {selectedBrandId === "ALL"
                                    ? `登録ブランド数: ${activeBrands.length} ブランド`
                                    : `本社: ${brandCockpitData.selectedBrand?.mainStock ?? 0}個 / 店頭計: ${brandCockpitData.selectedBrand?.storeStockTotal ?? 0}個`}
                            </div>
                        </div>
                    </div>

                    {/* Chart: Brand Daily Trend */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-violet-600" />
                                    {selectedBrandId === "ALL"
                                        ? `全ブランド 売上推移 ＆ ブランド別構成（${brandPeriodDays}日間）`
                                        : `「${brandCockpitData.selectedBrand?.brandName}」日別売上推移 ＆ 移動平均線（${brandPeriodDays}日間）`}
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    {selectedBrandId === "ALL"
                                        ? "全社の日別売上推移と上位ブランドの売上構成。7日移動平均（短期）・30日移動平均（中期）でトレンドを平滑化。"
                                        : "日々の売上推移（棒）に7日移動平均（実線）・30日移動平均（点線）を重ね合わせ、売上モメンタムを可視化。"}
                                </p>
                            </div>
                        </div>

                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={brandCockpitData.chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        tickLine={false}
                                        tickFormatter={v => v >= 10000 ? `¥${Math.round(v / 10000)}万` : `¥${v}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "0.75rem", color: "#fff", fontSize: "11px" }}
                                        formatter={(val: any, name: any) => [`¥${Number(val).toLocaleString()}`, name]}
                                        labelFormatter={(label, payload) => {
                                            const item = payload?.[0]?.payload;
                                            return item ? `${item.date} (${label}) 総販売個数: ${item.総販売個数 || 0}個` : label;
                                        }}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                                    />
                                    <Bar dataKey="売上額" name={selectedBrandId === "ALL" ? "全社日別売上" : "日別売上額"} fill="#c4b5fd" radius={[4, 4, 0, 0]} opacity={0.65} />
                                    <Line type="monotone" dataKey="7日移動平均" stroke="#2563eb" strokeWidth={2.5} dot={false} name="7日移動平均" />
                                    <Line type="monotone" dataKey="30日移動平均" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} name="30日移動平均" />
                                    {selectedBrandId === "ALL" && brandCockpitData.topBrandsForChart.map(tb => (
                                        <Line
                                            key={tb.id}
                                            type="monotone"
                                            dataKey={tb.name}
                                            stroke={tb.color}
                                            strokeWidth={1.5}
                                            dot={false}
                                            name={tb.name}
                                        />
                                    ))}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Brand Sales Ranking Table (All Brands) */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-violet-600" />
                                    ブランド別 売上・粗利・在庫実績ランキング（直近{brandPeriodDays}日間）
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    各ブランドの売上規模、全社シェア、粗利創出額、および店頭・本社の総在庫数を一覧比較できます。
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                                全 {brandCockpitData.brandsSummary.length} ブランド
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                        <th className="py-2.5 px-3">ブランド</th>
                                        <th className="py-2.5 px-3 text-center">SKU数</th>
                                        <th className="py-2.5 px-3 text-right">売上高</th>
                                        <th className="py-2.5 px-3 text-left">全社シェア</th>
                                        <th className="py-2.5 px-3 text-right">販売数</th>
                                        <th className="py-2.5 px-3 text-right">粗利額 (粗利率)</th>
                                        <th className="py-2.5 px-3 text-right">全社総在庫</th>
                                        <th className="py-2.5 px-3 text-center">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                    {brandCockpitData.brandsSummary.map((b, idx) => {
                                        const isSelected = selectedBrandId === b.brandId;
                                        return (
                                            <tr
                                                key={b.brandId}
                                                className={`hover:bg-slate-50 transition-colors ${isSelected ? "bg-violet-50/60 font-bold" : ""}`}
                                            >
                                                <td className="py-3 px-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                            idx === 0 ? "bg-amber-100 text-amber-700" :
                                                            idx === 1 ? "bg-slate-200 text-slate-700" :
                                                            idx === 2 ? "bg-orange-100 text-orange-700" :
                                                            "bg-slate-100 text-slate-500"
                                                        }`}>
                                                            {idx + 1}
                                                        </span>
                                                        <div>
                                                            <div className="font-black text-slate-900 flex items-center gap-1.5">
                                                                {b.brandName}
                                                                {isSelected && (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-200 text-violet-800">
                                                                        選択中
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {b.concept && (
                                                                <div className="text-[10px] text-slate-400 truncate max-w-xs">{b.concept}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-center font-bold text-slate-600">
                                                    {b.productCount} SKU
                                                </td>
                                                <td className="py-3 px-3 text-right font-black text-slate-900">
                                                    ¥{b.revenue.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-3 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden shrink-0">
                                                            <div
                                                                className="h-full bg-violet-500 rounded-full"
                                                                style={{ width: `${Math.min(100, b.sharePercent)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-600">
                                                            {b.sharePercent.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-right font-bold text-slate-700">
                                                    {b.quantity.toLocaleString()} 個
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <span className="font-bold text-emerald-600">¥{b.grossProfit.toLocaleString()}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold ml-1.5">({b.grossMargin.toFixed(1)}%)</span>
                                                </td>
                                                <td className="py-3 px-3 text-right font-bold text-slate-900">
                                                    {b.totalStock.toLocaleString()} 個
                                                    <span className="text-[10px] text-slate-400 block font-normal">
                                                        本社:{b.mainStock} / 店:{b.storeStockTotal}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedBrandId(b.brandId)}
                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors ${
                                                            isSelected
                                                                ? "bg-violet-600 text-white"
                                                                : "bg-slate-100 hover:bg-violet-100 text-slate-700 hover:text-violet-700"
                                                        }`}
                                                    >
                                                        {isSelected ? "選択中" : "商品・配架分析"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Deep-dive Section: Selected Brand Products & Store Breakdowns */}
                    {brandCockpitData.selectedBrand && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Products in this Brand (2 cols) */}
                            <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                            <Package className="w-4 h-4 text-violet-600" />
                                            「{brandCockpitData.selectedBrand.brandName}」商品別 売上・在庫消化
                                        </h3>
                                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                            ブランドを構成する商品の販売実績、粗利、現在庫、および推定在庫残日数です。
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        計 {brandCockpitData.selectedBrandProducts.length} 商品
                                    </span>
                                </div>

                                {brandCockpitData.selectedBrandProducts.length === 0 ? (
                                    <div className="py-10 text-center text-slate-400 text-xs font-medium">
                                        該当ブランドに紐づく有効な商品が登録されていません。
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                                    <th className="py-2 px-2.5">商品名</th>
                                                    <th className="py-2 px-2.5 text-right">販売数</th>
                                                    <th className="py-2 px-2.5 text-right">売上高</th>
                                                    <th className="py-2 px-2.5 text-right">粗利率</th>
                                                    <th className="py-2 px-2.5 text-right">ブランド内シェア</th>
                                                    <th className="py-2 px-2.5 text-right">総在庫</th>
                                                    <th className="py-2 px-2.5 text-center">在庫残日数</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                                {brandCockpitData.selectedBrandProducts.map(p => (
                                                    <tr key={p.productId} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-2.5 px-2.5">
                                                            <div className="font-black text-slate-900 truncate max-w-[180px] sm:max-w-xs" title={p.productName}>
                                                                {p.productName}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                本社: {p.mainStock}個 / 店頭計: {p.storeStockTotal}個
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-2.5 text-right font-bold text-slate-700">
                                                            {p.quantity.toLocaleString()} 個
                                                        </td>
                                                        <td className="py-2.5 px-2.5 text-right font-black text-slate-900">
                                                            ¥{p.revenue.toLocaleString()}
                                                        </td>
                                                        <td className="py-2.5 px-2.5 text-right font-bold text-emerald-600">
                                                            {p.grossMargin.toFixed(1)}%
                                                        </td>
                                                        <td className="py-2.5 px-2.5 text-right font-bold text-violet-700">
                                                            {p.shareInBrand.toFixed(1)}%
                                                        </td>
                                                        <td className={`py-2.5 px-2.5 text-right font-black ${p.stock <= 5 ? "text-rose-600" : "text-slate-900"}`}>
                                                            {p.stock.toLocaleString()} 個
                                                        </td>
                                                        <td className="py-2.5 px-2.5 text-center">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                                p.daysLeft <= 7 ? "bg-rose-100 text-rose-700" :
                                                                p.daysLeft <= 14 ? "bg-amber-100 text-amber-700" :
                                                                "bg-slate-100 text-slate-600"
                                                            }`}>
                                                                {p.daysLeft === Infinity ? "余裕あり" : `${p.daysLeft}日`}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Store Breakdown for this Brand (1 col) */}
                            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                                <div className="border-b border-slate-100 pb-3">
                                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                        <Store className="w-4 h-4 text-violet-600" />
                                        取扱店舗・配架別シェア
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                        「{brandCockpitData.selectedBrand.brandName}」の販売先別売上構成
                                    </p>
                                </div>

                                {brandCockpitData.selectedBrandStores.length === 0 ? (
                                    <div className="py-10 text-center text-slate-400 text-xs font-medium">
                                        この期間の店舗販売実績はありません。
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {brandCockpitData.selectedBrandStores.map((st, sIdx) => (
                                            <div key={st.storeId} className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate max-w-[150px]">
                                                        <span className="text-[10px] text-slate-400 font-black">#{sIdx + 1}</span>
                                                        {st.storeName}
                                                    </span>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-black text-slate-900">¥{st.revenue.toLocaleString()}</span>
                                                        <span className="text-[10px] text-slate-400 ml-1">({st.sharePercent.toFixed(1)}%)</span>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                    <div
                                                        className="h-full bg-violet-600 rounded-full"
                                                        style={{ width: `${Math.min(100, st.sharePercent)}%` }}
                                                    />
                                                </div>
                                                <div className="text-[10px] text-slate-400 text-right">
                                                    販売個数: {st.quantity.toLocaleString()} 個
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Consultant Strategy Box for Brands */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-50/70 via-indigo-50/40 to-white border border-violet-100 space-y-3">
                        <div className="flex items-center gap-2">
                            <Compass className="w-4 h-4 text-violet-700" />
                            <h4 className="text-xs font-black text-violet-900 uppercase tracking-wide">
                                小売業経営コンサルタント視点：ブランド戦略＆定例会アジェンダ
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700 leading-relaxed font-medium">
                            <div className="p-3.5 rounded-xl bg-white/80 border border-violet-100">
                                <div className="font-black text-slate-900 mb-1 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                                    ブランドポートフォリオの集中度
                                </div>
                                <p className="text-[11px] text-slate-600">
                                    {brandCockpitData.brandsSummary.length > 0 && brandCockpitData.brandsSummary[0].sharePercent >= 50 ? (
                                        <>首位ブランド「{brandCockpitData.brandsSummary[0].brandName}」が全社売上の {brandCockpitData.brandsSummary[0].sharePercent.toFixed(1)}% を占める集中型構造です。主力ブランドのブランド価値維持と並行して、第2ブランドの育成投資を定例会で検討してください。</>
                                    ) : (
                                        <>複数ブランドで売上シェアが分散されており、特定ブランドの需要変動リスクに強い健全なポートフォリオを形成しています。各ブランドの主力チャネルへの重点配架を進めてください。</>
                                    )}
                                </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-white/80 border border-violet-100">
                                <div className="font-black text-slate-900 mb-1 flex items-center gap-1.5">
                                    <Percent className="w-3.5 h-3.5 text-emerald-600" />
                                    ブランド別収益性（粗利率）の最適化
                                </div>
                                <p className="text-[11px] text-slate-600">
                                    全社平均粗利率 {brandCockpitData.overallGrossMargin.toFixed(1)}% に対して、高粗利ブランドの配架比率を高めることで企業全体の営業利益率が向上します。粗利率の低いブランドについては仕入ロット交渉または直販比率向上を図ってください。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                TAB: SKU（商品種類数）推移および展開効率・生産性分析ビュー
            ───────────────────────────────────────────────────────────── */}
            {activeTab === 'sku' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Controls Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                                SKU展開分析:
                            </span>
                            <span className="text-xs font-bold text-slate-500">
                                全 <span className="text-slate-900 font-black">{skuAnalysis.currentTotalSkus}</span> 商品種類（直近稼働: {skuAnalysis.currentActiveSkus} SKU / 休眠: {skuAnalysis.currentInactiveSkus} SKU）
                            </span>
                            <Link
                                href="/products"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800 hover:underline"
                            >
                                商品一覧・登録を開く
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>

                        {/* Period Switch */}
                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                            <span className="text-xs font-bold text-slate-400">分析期間:</span>
                            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl flex-wrap gap-0.5">
                                {[
                                    { months: 6, label: "過去6ヶ月推移" },
                                    { months: 12, label: "過去12ヶ月推移" },
                                ].map(p => (
                                    <button
                                        key={p.months}
                                        type="button"
                                        onClick={() => setSkuMonthsCount(p.months as 6 | 12)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                            skuMonthsCount === p.months
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 4大 SKU生産性 KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                                <span>稼働SKU率</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    skuAnalysis.activeSkuRate >= 75
                                        ? "bg-emerald-50 text-emerald-700"
                                        : skuAnalysis.activeSkuRate >= 50
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-rose-50 text-rose-700"
                                }`}>
                                    {skuAnalysis.activeSkuRate >= 75 ? "健全稼働" : skuAnalysis.activeSkuRate >= 50 ? "選別注意" : "要改善"}
                                </span>
                            </div>
                            <div className="text-xl font-black text-slate-900">
                                {skuAnalysis.activeSkuRate.toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                実稼働 {skuAnalysis.currentActiveSkus} / 全 {skuAnalysis.currentTotalSkus} SKU (休眠 {skuAnalysis.currentInactiveSkus}品)
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                1稼働SKUあたり売上
                            </div>
                            <div className="text-xl font-black text-blue-600">
                                ¥{skuAnalysis.revenuePerActiveSku.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                直近30日の1商品種類あたり売上創出力
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                1稼働SKUあたり粗利
                            </div>
                            <div className="text-xl font-black text-emerald-600">
                                ¥{skuAnalysis.profitPerActiveSku.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                仕入原価・卸値反映済みの手残り限界利益
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                                <span>SKU拡大弾力性</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    skuAnalysis.elasticityStatus === 'efficient'
                                        ? "bg-emerald-50 text-emerald-700"
                                        : skuAnalysis.elasticityStatus === 'moderate'
                                        ? "bg-blue-50 text-blue-700"
                                        : skuAnalysis.elasticityStatus === 'diluted'
                                        ? "bg-rose-50 text-rose-700"
                                        : "bg-slate-100 text-slate-600"
                                }`}>
                                    {skuAnalysis.elasticityStatus === 'efficient' ? "高効率拡大" :
                                     skuAnalysis.elasticityStatus === 'moderate' ? "安定拡大" :
                                     skuAnalysis.elasticityStatus === 'diluted' ? "希薄化警報" : "蓄積中"}
                                </span>
                            </div>
                            <div className="text-xl font-black text-slate-900">
                                {skuAnalysis.skuElasticity !== null ? skuAnalysis.skuElasticity.toFixed(2) : "---"}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5 truncate" title={skuAnalysis.elasticityComment}>
                                売上成長率 ÷ SKU増加率（1.0超で高効率）
                            </div>
                        </div>
                    </div>

                    {/* Elasticity Highlight Banner if Diluted or Efficient */}
                    {skuAnalysis.elasticityComment && (
                        <div className={`p-4 rounded-2xl border text-xs leading-relaxed font-medium flex items-start gap-3 ${
                            skuAnalysis.elasticityStatus === 'diluted'
                                ? "bg-rose-50/70 border-rose-200 text-rose-800"
                                : skuAnalysis.elasticityStatus === 'efficient'
                                ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                                : "bg-blue-50/60 border-blue-100 text-slate-700"
                        }`}>
                            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                            <div>
                                <span className="font-black mr-2">【SKU展開評価】</span>
                                <span>{skuAnalysis.elasticityComment}</span>
                            </div>
                        </div>
                    )}

                    {/* Chart: Monthly SKU Count vs Revenue vs Productivity */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                                    商品種類数（SKU）の推移 ＆ 売上・1SKUあたり生産性（過去{skuMonthsCount}ヶ月）
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    種類数（棒グラフ）の増加展開に対し、売上総額（青線）と1SKUあたり売上（橙線・右軸）がどう推移しているかを検証します。
                                </p>
                            </div>
                        </div>

                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={skuAnalysis.monthlyHistory} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <YAxis
                                        yAxisId="left"
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        tickLine={false}
                                        tickFormatter={v => v >= 10000 ? `¥${Math.round(v / 10000)}万` : `¥${v}`}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        tickLine={false}
                                        tickFormatter={v => `¥${Math.round(v / 1000)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "0.75rem", color: "#fff", fontSize: "11px" }}
                                        formatter={(val: any, name: any) => {
                                            if (name === "総SKU数" || name === "販売稼働SKU数" || name === "新投入SKU数") {
                                                return [`${val} SKU`, name];
                                            }
                                            return [`¥${Number(val).toLocaleString()}`, name];
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                                    <Bar yAxisId="left" dataKey="totalRevenue" fill="#93c5fd" radius={[4, 4, 0, 0]} name="売上総額" opacity={0.65} />
                                    <Line yAxisId="left" type="monotone" dataKey="totalGrossProfit" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="粗利総額" />
                                    <Line yAxisId="right" type="monotone" dataKey="revenuePerActiveSku" stroke="#f97316" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 4 }} name="1稼働SKUあたり売上 (右軸)" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Sub Monthly Table for detail */}
                        <div className="overflow-x-auto pt-2">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                        <th className="py-2 px-2.5">月次</th>
                                        <th className="py-2 px-2.5 text-center">総SKU数</th>
                                        <th className="py-2 px-2.5 text-center">稼働SKU数</th>
                                        <th className="py-2 px-2.5 text-center">稼働率</th>
                                        <th className="py-2 px-2.5 text-center">新投入SKU</th>
                                        <th className="py-2 px-2.5 text-right">売上総額</th>
                                        <th className="py-2 px-2.5 text-right">粗利総額 (率)</th>
                                        <th className="py-2 px-2.5 text-right">1稼働SKU売上</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {skuAnalysis.monthlyHistory.map(m => (
                                        <tr key={m.month} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-2 px-2.5 font-bold text-slate-900">{m.label}</td>
                                            <td className="py-2 px-2.5 text-center font-bold text-slate-600">{m.totalSkus}</td>
                                            <td className="py-2 px-2.5 text-center font-bold text-emerald-600">{m.activeSkus}</td>
                                            <td className="py-2 px-2.5 text-center">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                    m.activeSkuRate >= 75 ? "bg-emerald-50 text-emerald-700" :
                                                    m.activeSkuRate >= 50 ? "bg-amber-50 text-amber-700" :
                                                    "bg-rose-50 text-rose-700"
                                                }`}>
                                                    {m.activeSkuRate.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="py-2 px-2.5 text-center font-bold text-blue-600">
                                                {m.newSkusIntroduced > 0 ? `+${m.newSkusIntroduced}` : "0"}
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-black text-slate-900">
                                                ¥{m.totalRevenue.toLocaleString()}
                                            </td>
                                            <td className="py-2 px-2.5 text-right">
                                                <span className="font-bold text-emerald-600">¥{m.totalGrossProfit.toLocaleString()}</span>
                                                <span className="text-[10px] text-slate-400 ml-1 font-bold">({m.overallGrossMargin.toFixed(1)}%)</span>
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-bold text-orange-600">
                                                ¥{m.revenuePerActiveSku.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pareto Matrix (A/B/C/Inactive) */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-emerald-600" />
                                    SKUパレート・貢献度ポートフォリオ（直近30日間）
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    増えた商品種類が利益を生んでいるか、それとも売上0のまま資金を固定化させているかを4象限で分析します。
                                </p>
                            </div>
                            {skuAnalysis.dormantCapitalTiedUp > 0 && (
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                                        休眠品滞留資金: 約¥{skuAnalysis.dormantCapitalTiedUp.toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {skuAnalysis.paretoBreakdown.map(group => {
                                const isInactive = group.rank === 'inactive';
                                const isA = group.rank === 'A';
                                return (
                                    <div
                                        key={group.rank}
                                        className={`p-4 rounded-xl border flex flex-col justify-between ${
                                            isA
                                                ? "bg-emerald-50/40 border-emerald-200"
                                                : isInactive
                                                ? "bg-rose-50/40 border-rose-200"
                                                : "bg-slate-50/70 border-slate-200"
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`text-xs font-black px-2 py-0.5 rounded ${
                                                    isA ? "bg-emerald-600 text-white" :
                                                    group.rank === 'B' ? "bg-blue-600 text-white" :
                                                    group.rank === 'C' ? "bg-amber-600 text-white" :
                                                    "bg-rose-600 text-white"
                                                }`}>
                                                    {group.label}
                                                </span>
                                                <span className="text-xs font-black text-slate-900">
                                                    {group.skuCount} <span className="text-[10px] font-bold text-slate-400">SKU ({group.skuShare.toFixed(1)}%)</span>
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-medium mb-3">
                                                {group.description}
                                            </p>

                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-400">期間売上高</span>
                                                    <span className="font-black text-slate-900">
                                                        ¥{group.revenue.toLocaleString()}
                                                        <span className="text-[10px] text-slate-400 font-bold ml-1">({group.revenueShare.toFixed(1)}%)</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-400">粗利 (粗利率)</span>
                                                    <span className="font-bold text-emerald-600">
                                                        ¥{group.grossProfit.toLocaleString()}
                                                        <span className="text-[10px] text-slate-400 font-normal ml-1">({group.grossMargin.toFixed(1)}%)</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-400">在庫資産額 (投下資金)</span>
                                                    <span className={`font-bold ${isInactive ? "text-rose-600" : "text-slate-700"}`}>
                                                        ¥{group.totalStockValue.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[10px] text-slate-500">
                                            {isA && "★ 最優先で欠品防止＆店頭配架維持を推奨"}
                                            {group.rank === 'B' && "↑ Aランク昇格に向けた販促・セット組を推奨"}
                                            {group.rank === 'C' && "・補完品として低在庫運用を推奨"}
                                            {isInactive && "⚠ 追加仕入凍結＆早期換金（セール等）を推奨"}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Recent New SKUs Launch Tracker */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-emerald-600" />
                                    直近新商品（新投入SKU）の立ち上がり追跡（新展開の検証）
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    直近投入された商品の販売ペース、粗利、在庫消化状況から新展開の成功度を追跡します。
                                </p>
                            </div>
                        </div>

                        {skuAnalysis.recentNewSkus.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400 font-medium">
                                直近投入の新商品データはありません。
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                            <th className="py-2 px-2.5">商品名 / ブランド</th>
                                            <th className="py-2 px-2.5 text-center">初動日 (経過日数)</th>
                                            <th className="py-2 px-2.5 text-center">立ち上がり判定</th>
                                            <th className="py-2 px-2.5 text-right">30日販売数</th>
                                            <th className="py-2 px-2.5 text-right">30日売上高</th>
                                            <th className="py-2 px-2.5 text-right">粗利率</th>
                                            <th className="py-2 px-2.5 text-right">現在庫数</th>
                                            <th className="py-2 px-2.5 text-center">在庫残日数</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {skuAnalysis.recentNewSkus.map(p => (
                                            <tr key={p.productId} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-2.5 px-2.5">
                                                    <div className="font-black text-slate-900 truncate max-w-[180px] sm:max-w-xs" title={p.productName}>
                                                        {p.productName}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">{p.brandName}</div>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center font-bold text-slate-600">
                                                    {p.firstSaleDate}
                                                    <span className="text-[10px] text-slate-400 block font-normal">({p.daysSinceLaunch}日経過)</span>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                        p.status === 'rocket'
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : p.status === 'steady'
                                                            ? "bg-blue-100 text-blue-800"
                                                            : "bg-rose-100 text-rose-800"
                                                    }`}>
                                                        {p.status === 'rocket' ? "★ 好発進" :
                                                         p.status === 'steady' ? "順調推移" :
                                                         "滞留注意"}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-right font-bold text-slate-900">
                                                    {p.totalQuantity.toLocaleString()} 個
                                                </td>
                                                <td className="py-2.5 px-2.5 text-right font-black text-slate-900">
                                                    ¥{p.totalRevenue.toLocaleString()}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-right font-bold text-emerald-600">
                                                    {p.grossMargin.toFixed(1)}%
                                                </td>
                                                <td className="py-2.5 px-2.5 text-right font-bold text-slate-700">
                                                    {p.currentStock.toLocaleString()} 個
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                        p.daysLeft <= 7 ? "bg-rose-100 text-rose-700" :
                                                        p.daysLeft <= 14 ? "bg-amber-100 text-amber-700" :
                                                        "bg-slate-100 text-slate-600"
                                                    }`}>
                                                        {p.daysLeft === Infinity ? "余裕あり" : `${p.daysLeft}日`}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Consultant SKU Strategy Box */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white border border-emerald-200 space-y-4">
                        <div className="flex items-center gap-2">
                            <Compass className="w-5 h-5 text-emerald-700" />
                            <div>
                                <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wide">
                                    小売業経営コンサルタント視点：SKU展開戦略と定例会アクション
                                </h4>
                                <div className="text-sm font-black text-slate-900 mt-0.5">
                                    {skuAnalysis.consultantDiagnosis.headline}
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white/80 p-3.5 rounded-xl border border-emerald-100">
                            {skuAnalysis.consultantDiagnosis.summary}
                        </p>

                        <div className="space-y-2">
                            <div className="text-[11px] font-black uppercase text-emerald-900 tracking-wider">
                                定例会で決定すべき具体策（処方箋）：
                            </div>
                            <ul className="space-y-1.5">
                                {skuAnalysis.consultantDiagnosis.actionPoints.map((pt, pIdx) => (
                                    <li key={pIdx} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                        <span>{pt}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                TAB 4: 発注・仕入判断ビュー（購買意思決定支援コックピット）
            ───────────────────────────────────────────────────────────── */}
            {activeTab === 'purchasing' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* 購買判断サマリー（3つの判断軸） */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-rose-700 mb-1">
                                <span className="flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                                    至急発注推奨品目
                                </span>
                                <span className="bg-rose-200/80 text-rose-800 px-2 py-0.5 rounded-full font-black text-[9px]">
                                    欠品または7日以内
                                </span>
                            </div>
                            <div className="text-2xl font-black text-rose-900 tracking-tight">
                                {purchasingIntelligence.urgentCount} <span className="text-xs font-bold text-rose-700">品目</span>
                            </div>
                            <div className="text-[11px] text-rose-800 font-bold mt-1">
                                想定仕入予算: <span className="font-black text-rose-950">¥{purchasingIntelligence.totalRecommendedCost.toLocaleString()}</span>
                            </div>
                            <p className="text-[10px] text-rose-600/90 mt-2 font-medium">
                                次回定例会を待たず、今週中に仕入発注が必要な商品群です
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-blue-700 mb-1">
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                    入荷待ち（発注残）
                                </span>
                                <span className="bg-blue-200/80 text-blue-800 px-2 py-0.5 rounded-full font-black text-[9px]">
                                    二重発注防止
                                </span>
                            </div>
                            <div className="text-2xl font-black text-blue-900 tracking-tight">
                                {purchasingIntelligence.totalPendingOrderCount} <span className="text-xs font-bold text-blue-700">伝票</span>
                            </div>
                            <div className="text-[11px] text-blue-800 font-bold mt-1">
                                入荷待ち予定額: <span className="font-black text-blue-950">¥{purchasingIntelligence.totalPendingOrderAmount.toLocaleString()}</span>
                            </div>
                            <p className="text-[10px] text-blue-600/90 mt-2 font-medium">
                                すでに発注済みで納品を待っている仕入データです
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-amber-700 mb-1">
                                <span className="flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                    滞留・過剰在庫警告
                                </span>
                                <span className="bg-amber-200/80 text-amber-800 px-2 py-0.5 rounded-full font-black text-[9px]">
                                    仕入ストップ推奨
                                </span>
                            </div>
                            <div className="text-2xl font-black text-amber-900 tracking-tight">
                                {purchasingIntelligence.stagnantItems.length} <span className="text-xs font-bold text-amber-700">品目</span>
                            </div>
                            <div className="text-[11px] text-amber-800 font-bold mt-1">
                                滞留在庫資産額: <span className="font-black text-amber-950">¥{purchasingIntelligence.stagnantItems.reduce((sum, i) => sum + i.stockValue, 0).toLocaleString()}</span>
                            </div>
                            <p className="text-[10px] text-amber-700/90 mt-2 font-medium">
                                直近30日販売停滞。追加仕入を見合わせ、消化策が必要です
                            </p>
                        </div>
                    </div>

                    {/* Section 1: 緊急発注推奨リスト（購買判断テーブル） */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-blue-600" />
                                    発注推奨リスト（直近売上推移・在庫消化ペースに基づく仕入判断）
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    直近7日と30日の売上推移から需要トレンドを判定し、過不足のない適正発注数を算出（直近販売実績のない非稼働品は自動除外）
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* トレンドフィルター */}
                                <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-xs">
                                    <button
                                        type="button"
                                        onClick={() => setReorderTrendFilter('all')}
                                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                                            reorderTrendFilter === 'all'
                                                ? 'bg-blue-900 text-white shadow-xs'
                                                : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        すべて ({purchasingIntelligence.recommendations.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReorderTrendFilter('surging')}
                                        className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                                            reorderTrendFilter === 'surging'
                                                ? 'bg-rose-600 text-white shadow-xs'
                                                : 'text-rose-600 hover:text-rose-800'
                                        }`}
                                    >
                                        <span>🚀 急伸</span>
                                        <span>({purchasingIntelligence.recommendations.filter(r => r.salesTrend === 'surging').length})</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReorderTrendFilter('urgent')}
                                        className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                                            reorderTrendFilter === 'urgent'
                                                ? 'bg-rose-900 text-white shadow-xs'
                                                : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        <span>⚠️ 至急</span>
                                        <span>({purchasingIntelligence.urgentCount})</span>
                                    </button>
                                </div>

                                <Link
                                    href="/purchases"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a8a] text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition-colors shrink-0 shadow-sm"
                                >
                                    <span>仕入管理で発注を作成</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        <th className="py-3 px-4">商品名</th>
                                        <th className="py-3 px-4">仕入先 / 生産者</th>
                                        <th className="py-3 px-4 text-center">直近売上推移</th>
                                        <th className="py-3 px-4 text-right">全社総在庫</th>
                                        <th className="py-3 px-4 text-right">実効日販</th>
                                        <th className="py-3 px-4 text-center">推定在庫残</th>
                                        <th className="py-3 px-4 text-right">発注残 (入荷待)</th>
                                        <th className="py-3 px-4 text-right">推奨発注数</th>
                                        <th className="py-3 px-4 text-right">想定仕入額</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {filteredRecommendations.map((item, idx) => {
                                        const status = getStockoutStatus(item.daysRemaining, item.isMainZeroOnly);
                                        return (
                                            <tr key={item.productId} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-3 px-4 font-bold text-slate-800">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                            item.isUrgent ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
                                                        }`}>
                                                            {idx + 1}
                                                        </span>
                                                        <span className="truncate max-w-[160px] sm:max-w-xs" title={item.productName}>
                                                            {item.productName} {item.variantName ? `(${item.variantName})` : ""}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 truncate max-w-[120px]">
                                                    {item.supplierName}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {item.salesTrend === 'surging' && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                                                🚀 急伸（7日加速）
                                                            </span>
                                                        )}
                                                        {item.salesTrend === 'slowing' && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                                                📉 鈍化（慎重発注）
                                                            </span>
                                                        )}
                                                        {item.salesTrend === 'stable' && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600">
                                                                ➡️ 堅調
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-slate-500 font-bold tabular-nums">
                                                            7日: <span className="font-black text-slate-800">{item.soldQty7}</span>個 / 30日: <span className="font-black text-slate-800">{item.soldQty30}</span>個
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className={`font-black ${item.currentStock <= 0 ? "text-rose-600" : item.currentStock <= 5 ? "text-amber-600" : "text-slate-900"}`}>
                                                        {item.currentStock} 個
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 font-medium">
                                                        本社:{item.mainStock ?? 0} / 店頭:{item.storeStockTotal ?? 0}
                                                    </div>
                                                    {item.isMainZeroOnly && (
                                                        <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-black inline-block mt-0.5">
                                                            店頭有・本社補充
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold text-slate-700">
                                                    {item.dailyVelocity.toFixed(1)} 個/日
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${status.bg} ${status.color}`}>
                                                        {item.daysRemaining === Infinity ? "余裕あり" : `${item.daysRemaining}日分`}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    {item.pendingOrderQty > 0 ? (
                                                        <span className="text-blue-600 font-black">+{item.pendingOrderQty} 個</span>
                                                    ) : (
                                                        <span className="text-slate-400 font-bold">0</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right font-black text-slate-900">
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-md">
                                                        {item.recommendedOrderQty.toLocaleString()} 個
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-black text-blue-600">
                                                    ¥{item.estimatedCost.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredRecommendations.length === 0 && (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                                                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                                                該当する条件の発注推奨品目はありません。
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* 直近販売実績なし・休止商品の除外インフォメーション */}
                        {purchasingIntelligence.inactiveZeroStockCount > 0 && (
                            <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                                <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>
                                    直近30日間・7日間の販売実績がなく総在庫0の休止・非取扱商品（計 <strong className="text-slate-800 font-bold">{purchasingIntelligence.inactiveZeroStockCount}品目</strong>）は、不要な誤発注を防ぐため発注推奨リストから除外しています。
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Section 2: 仕入先別・発注ロットまとめ & 過剰在庫アラート（2カラム） */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 仕入先別発注まとめ */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                                    <Store className="w-4 h-4 text-blue-600" />
                                    仕入先別・発注集約サマリー（ロット・予算検討用）
                                </h4>
                                <span className="text-[11px] text-slate-500 font-bold">
                                    {purchasingIntelligence.supplierSummaries.length} 社
                                </span>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                                {purchasingIntelligence.supplierSummaries.map((sup, idx) => (
                                    <div key={sup.supplierId} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
                                                    {idx + 1}
                                                </span>
                                                <span>{sup.supplierName}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-medium mt-1">
                                                要発注: <span className="font-bold text-slate-700">{sup.itemCount} 品目</span> / 総数量: <span className="font-bold text-slate-700">{sup.totalQuantity.toLocaleString()} 個</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-base font-black text-blue-600">
                                                ¥{sup.totalCost.toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                想定仕入総額
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {purchasingIntelligence.supplierSummaries.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-xs font-bold">
                                        発注推奨対象の仕入先はありません
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 過剰・滞留在庫アラート */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-4 bg-amber-50/50 border-b border-slate-100 flex items-center justify-between">
                                <h4 className="text-xs font-black text-amber-900 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                    仕入抑制・過剰在庫アラート（販売停滞品）
                                </h4>
                                <span className="text-[11px] text-amber-800 font-bold">
                                    {purchasingIntelligence.stagnantItems.length} 品目
                                </span>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                                {purchasingIntelligence.stagnantItems.map((item, idx) => (
                                    <div key={item.productId} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm truncate max-w-xs" title={item.productName}>
                                                {item.productName} {item.variantName ? `(${item.variantName})` : ""}
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                                                30日販売数: <span className="font-bold text-slate-700">{item.soldQty30} 個</span> / 全社総在庫: <span className="font-bold text-amber-600">{item.currentStock} 個</span> <span className="text-[10px] text-slate-400 font-normal">(本社:{item.mainStock ?? 0} / 店頭計:{item.storeStockTotal ?? 0})</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                                                <span>資金回収予測: <strong className="font-bold text-slate-700">{item.monthsToDeplete >= 99 ? "消化不能 (0個販売)" : `${item.monthsToDeplete}ヶ月`}</strong></span>
                                                {!item.hasCostPrice && (
                                                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">原価未設定</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-rose-600">
                                                ¥{item.stockValue.toLocaleString()}
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                                寝ている投下資金 (原価)
                                            </div>
                                            <div className="text-[9px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                                                仕入原則凍結・早期現金化
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {purchasingIntelligence.stagnantItems.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-xs font-bold">
                                        過剰在庫や販売停滞品はありません。良好な回転率を維持しています。
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ───────────────────────────────────────────────────────────── */}
            {/* VIEW 5: 小売業経営コンサルタント 戦略コックピット (定例会討議用) */}
            {/* ───────────────────────────────────────────────────────────── */}
            {activeTab === 'consultant' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {/* ビュー・コントロールバー */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-white rounded-3xl border border-indigo-100">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Compass className="w-4 h-4 text-indigo-700" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
                                    定例会討議用・コンサルタント視点
                                </span>
                            </div>
                            <h3 className="font-black text-slate-900 text-base sm:text-lg">
                                小売業経営コンサルタント 戦略コックピット
                            </h3>
                            <p className="text-slate-500 text-xs mt-0.5">
                                売上高だけでなく、実質粗利高（手数料控除後 MQ）・損益分岐点（固定費回収）・交差比率（GMROI）・客単価から、定例会で打つべき具体アクションを提示します。
                            </p>
                        </div>

                        {/* 期間切替 (7日 vs 30日 vs 90日) */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-indigo-200/60 shadow-sm self-start sm:self-center flex-wrap">
                            {[
                                { days: 7, label: "直近7日" },
                                { days: 30, label: "直近30日" },
                                { days: 90, label: "直近90日" },
                            ].map(p => (
                                <button
                                    key={p.days}
                                    type="button"
                                    onClick={() => setConsultantPeriodDays(p.days as 7 | 30 | 90)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                        consultantPeriodDays === p.days
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 経営判断のための重要注意書き（免責・計算基準バッジ） */}
                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                        <div className="text-xs text-amber-900 leading-relaxed font-medium">
                            <span className="font-black">【定例会・経営数値に関する注意書き】</span>
                            <span className="ml-1">{consultantStrategy.disclaimerNotes.commissionNote}</span>
                            <span className="ml-2 text-amber-800">{consultantStrategy.disclaimerNotes.fixedCostNote}</span>
                        </div>
                    </div>

                    {/* 4大コンサルタント・コア指標 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        {/* 1. 実質手残り限界利益（MQ）＆ 粗利率 */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-300 transition-colors">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                                <span>実質手残り粗利 (限界利益 MQ)</span>
                                <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                ¥{consultantStrategy.totalGrossProfit.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                表面粗利: ¥{consultantStrategy.totalNominalGrossProfit.toLocaleString()} (手数料: -¥{consultantStrategy.totalCommission.toLocaleString()})
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs font-bold pt-2 border-t border-slate-100">
                                <span className="text-slate-500">実質粗利率 (手残り率)</span>
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                                    consultantStrategy.overallGrossMargin >= 35
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : consultantStrategy.overallGrossMargin >= 25
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'bg-rose-50 text-rose-700'
                                }`}>
                                    {consultantStrategy.overallGrossMargin.toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        {/* 2. 月次固定費回収進捗 ＆ 損益分岐点 */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-emerald-300 transition-colors">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                                <span>月次固定費回収進捗 (概算)</span>
                                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            {currentMonthFixedCost > 0 ? (
                                <>
                                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
                                        {Math.round((consultantStrategy.totalGrossProfit / currentMonthFixedCost) * 100)}%
                                        <span className="text-xs text-slate-400 font-bold">回収</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                        月次概算固定費: ¥{currentMonthFixedCost.toLocaleString()}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs font-bold pt-2 border-t border-slate-100">
                                        <span className="text-slate-500">損益分岐点売上高</span>
                                        <span className="text-slate-800 font-black">
                                            {consultantStrategy.overallGrossMargin > 0
                                                ? `¥${Math.round(currentMonthFixedCost / (consultantStrategy.overallGrossMargin / 100)).toLocaleString()}`
                                                : "算出中"}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-lg font-black text-slate-400 tracking-tight">
                                        固定費未登録
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium mt-1">
                                        「月次固定費管理」で登録すると損益分岐点が自動表示されます
                                    </div>
                                    <div className="mt-2 text-xs font-bold pt-2 border-t border-slate-100">
                                        <Link href="/fixed-costs" className="text-blue-600 hover:underline flex items-center gap-1">
                                            固定費を登録する <ArrowRight className="w-3 h-3" />
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 3. 全社交差比率（GMROI）＆ 在庫資本効率 */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-amber-300 transition-colors">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                                <span>交差比率 (GMROI・資金効率)</span>
                                <Target className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                {consultantStrategy.companyGmroi}%
                                <span className="text-xs text-slate-400 font-bold ml-1.5">投下資本回収率</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                ドル箱商品: <strong className="text-emerald-700 font-bold">{consultantStrategy.gmroiSummary.starCount}品目</strong> / 滞留: <strong className="text-rose-600 font-bold">{consultantStrategy.gmroiSummary.drainCount}品目</strong>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs font-bold pt-2 border-t border-slate-100">
                                <span className="text-slate-500">滞留中の寝ている資金</span>
                                <span className="text-rose-600 font-black">
                                    ¥{consultantStrategy.gmroiSummary.totalTiedUpCapitalInDrain.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* 4. 平均客単価（Basket Size） ＆ 買上点数 */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-blue-300 transition-colors">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                                <span>平均客単価 (Basket)</span>
                                <Users className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                ¥{consultantStrategy.averageBasket.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                伝票数: {consultantStrategy.totalTransactions}件 / 販売個数: {consultantStrategy.totalUnits.toLocaleString()}個
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100">
                                <span>買上点数: <strong className="text-slate-800 font-black">{consultantStrategy.averageUnitsPerBasket}点</strong></span>
                                <span>単価: <strong className="text-slate-800 font-black">¥{consultantStrategy.averageUnitPrice.toLocaleString()}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* 定例会討議アジェンダ（コンサルタント提言カード） */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-600" />
                                定例会アジェンダ・具体的アクション提言（コンサルタント分析）
                            </h4>
                            <span className="text-[11px] text-slate-400 font-medium">
                                直近{consultantPeriodDays}日間の実績に基づく診断
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {consultantStrategy.consultantAgendas.map((agenda, idx) => (
                                <div
                                    key={idx}
                                    className={`p-5 rounded-2xl border transition-all ${
                                        agenda.urgency === 'high'
                                            ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                                            : agenda.urgency === 'medium'
                                            ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
                                            : 'bg-white border-slate-200 hover:border-indigo-200'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                agenda.category === '利益率改善'
                                                    ? 'bg-indigo-100 text-indigo-800'
                                                    : agenda.category === '客単価アップ'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : agenda.category === '集中度・リスク'
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : 'bg-purple-100 text-purple-800'
                                            }`}>
                                                {agenda.category}
                                            </span>
                                            <span className="font-black text-slate-800 text-xs sm:text-sm">
                                                {agenda.title}
                                            </span>
                                        </div>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${
                                            agenda.urgency === 'high'
                                                ? 'bg-rose-600 text-white animate-pulse'
                                                : agenda.urgency === 'medium'
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-slate-200 text-slate-700'
                                        }`}>
                                            {agenda.urgency === 'high' ? '至急決議' : agenda.urgency === 'medium' ? '協議推奨' : '順調維持'}
                                        </span>
                                    </div>

                                    <p className="text-xs text-slate-600 leading-relaxed font-medium mb-3">
                                        {agenda.diagnostic}
                                    </p>

                                    <div className="p-3 bg-white/80 rounded-xl border border-slate-100 flex items-start gap-2">
                                        <ArrowRight className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                                        <p className="text-xs font-bold text-slate-800 leading-relaxed">
                                            <span className="text-indigo-700">定例会でのアクション: </span>
                                            {agenda.actionProposal}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* チャネル別ポートフォリオ（店頭 vs EC vs 催事） */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                            <div>
                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <PieChart className="w-4 h-4 text-blue-600" />
                                    販売チャネル別ポートフォリオ（売上シェア ＆ 粗利率の対比）
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    販路ごとの販売比率と利益率のバランスを把握し、リソース配分の意思決定を行います。
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full self-start sm:self-auto">
                                全社売上: ¥{consultantStrategy.totalRevenue.toLocaleString()}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {consultantStrategy.channelBreakdown.map((ch) => (
                                <div key={ch.channelKey} className="p-5 rounded-2xl bg-slate-50/60 border border-slate-100 hover:border-blue-200 transition-colors space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-slate-800 text-xs">{ch.label}</span>
                                        <span className="text-xs font-black text-blue-600">{ch.share.toFixed(1)}%</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, ch.share)}%` }}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                                        <div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">売上高</div>
                                            <div className="font-black text-slate-900">¥{ch.revenue.toLocaleString()}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">粗利率 (MQ%)</div>
                                            <div className={`font-black ${ch.grossMarginRatio >= 40 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                {ch.grossMarginRatio.toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium flex justify-between">
                                        <span>伝票数: {ch.transactionCount}件</span>
                                        <span>粗利: ¥{ch.grossProfit.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                            {consultantStrategy.channelBreakdown.length === 0 && (
                                <div className="col-span-3 p-8 text-center text-slate-400 text-xs font-bold">
                                    対象期間の販売データがありません
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 店舗別収益性 ＆ 客単価・買上点数マトリクス */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                            <div>
                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <Store className="w-4 h-4 text-emerald-600" />
                                    店舗別 収益性 ＆ 客単価・買上点数マトリクス
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    定例会にて「売上未達が客数減なのか、客単価・買上点数の低下なのか」を即時切り分ける診断表です。
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full self-start sm:self-auto">
                                対象店舗: {consultantStrategy.storesProfitability.length} 店舗・スポット
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                                        <th className="py-3 px-3">店舗・チャネル</th>
                                        <th className="py-3 px-3 text-right">売上高</th>
                                        <th className="py-3 px-3 text-right">粗利額 (MQ)</th>
                                        <th className="py-3 px-3 text-right">粗利率</th>
                                        <th className="py-3 px-3 text-right">客数 (伝票)</th>
                                        <th className="py-3 px-3 text-right">平均客単価</th>
                                        <th className="py-3 px-3 text-right">買上点数</th>
                                        <th className="py-3 px-3 text-right">平均商品単価</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {consultantStrategy.storesProfitability.map((st, idx) => {
                                        const isHighBasket = st.averageBasket >= consultantStrategy.averageBasket * 1.2 && st.transactionCount >= 2;
                                        const isLowBasket = st.averageBasket < consultantStrategy.averageBasket * 0.8 && st.transactionCount >= 2;

                                        return (
                                            <tr key={st.storeId} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                                        <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                                                        <span>{st.storeName}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        {st.channelType}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-right font-black text-slate-900">
                                                    ¥{st.totalRevenue.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-3 text-right font-bold text-indigo-700">
                                                    ¥{st.grossProfit.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                        st.grossMarginRatio >= 40
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : st.grossMarginRatio >= 30
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'bg-rose-50 text-rose-700'
                                                    }`}>
                                                        {st.grossMarginRatio.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right font-medium text-slate-600">
                                                    {st.transactionCount} 件
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <span className={`font-black ${
                                                        isHighBasket
                                                            ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md'
                                                            : isLowBasket
                                                            ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md'
                                                            : 'text-slate-800'
                                                    }`}>
                                                        ¥{st.averageBasket.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right font-bold text-slate-700">
                                                    {st.averageUnitsPerBasket} 点
                                                </td>
                                                <td className="py-3 px-3 text-right font-medium text-slate-500">
                                                    ¥{st.averageUnitPrice.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {consultantStrategy.storesProfitability.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-slate-400 text-xs font-bold">
                                                店舗販売データがありません
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 商品別パレート（ABC）分析 ＆ 粗利エース商品特定 */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                            <div>
                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <Award className="w-4 h-4 text-amber-500" />
                                    商品別 パレート（ABC）分析 ＆ 粗利マトリクス
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    売上貢献度（Aランク: 累積80% / Bランク: 95% / Cランク: 5%）と粗利率を掛け合わせ、重点育成・価格見直し品を特定します。
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full self-start sm:self-auto">
                                集計商品: {consultantStrategy.productsProfitability.length} 品目
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                                        <th className="py-3 px-3">ランク</th>
                                        <th className="py-3 px-3">商品名</th>
                                        <th className="py-3 px-3 text-right">販売数</th>
                                        <th className="py-3 px-3 text-right">売上高</th>
                                        <th className="py-3 px-3 text-right">実質粗利 (MQ)</th>
                                        <th className="py-3 px-3 text-right">手残り粗利率</th>
                                        <th className="py-3 px-3 text-right">年換算回転率</th>
                                        <th className="py-3 px-3 text-right">交差比率 (GMROI)</th>
                                        <th className="py-3 px-3 text-center">経営戦略・資本効率</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {consultantStrategy.productsProfitability.map((p) => (
                                        <tr key={p.productId} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-3">
                                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                                                    p.rankClass === 'A'
                                                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                                        : p.rankClass === 'B'
                                                        ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                    {p.rankClass}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="font-bold text-slate-900 truncate max-w-xs" title={p.productName}>
                                                    {p.productName}
                                                </div>
                                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                    <span>在庫: {p.currentStock}個 (¥{p.stockValue.toLocaleString()})</span>
                                                    {!p.hasCostPrice && (
                                                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">原価未設定(概算)</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-slate-700">
                                                {p.quantity.toLocaleString()} 個
                                            </td>
                                            <td className="py-3 px-3 text-right font-black text-slate-900">
                                                ¥{p.revenue.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-indigo-700">
                                                ¥{p.grossProfit.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                    p.grossMarginRatio >= 35
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : p.grossMarginRatio >= 25
                                                        ? 'bg-blue-50 text-blue-700'
                                                        : 'bg-rose-50 text-rose-700'
                                                }`}>
                                                    {p.grossMarginRatio.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-right font-medium text-slate-600">
                                                {p.turnoverAnnual} 回/年
                                            </td>
                                            <td className="py-3 px-3 text-right font-black">
                                                <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                                    p.gmroi >= 200
                                                        ? 'bg-emerald-100 text-emerald-800 font-black'
                                                        : p.gmroi >= 100
                                                        ? 'bg-blue-50 text-blue-700 font-bold'
                                                        : 'bg-rose-50 text-rose-700 font-bold'
                                                }`}>
                                                    {p.gmroi}%
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                {p.gmroiCategory === 'star' && (
                                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                                        <Sparkles className="w-2.5 h-2.5" /> 超ドル箱・エース
                                                    </span>
                                                )}
                                                {p.gmroiCategory === 'potential' && (
                                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                                                        高粗利ポテンシャル
                                                    </span>
                                                )}
                                                {p.gmroiCategory === 'traffic' && (
                                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1">
                                                        薄利多売・集客
                                                    </span>
                                                )}
                                                {p.gmroiCategory === 'drain' && (
                                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                                                        <ShieldAlert className="w-2.5 h-2.5" /> 滞留資金圧迫
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {consultantStrategy.productsProfitability.length === 0 && (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-slate-400 text-xs font-bold">
                                                商品販売データがありません
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
