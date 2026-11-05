"use client";

import { useMemo, useState } from "react";
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer
} from "recharts";
import {
    TrendingUp, Store, Package, Calendar, Award,
    AlertCircle, Sparkles, ChevronRight, BarChart3,
    ArrowUpRight, ArrowDownRight, Layers, ShoppingBag
} from "lucide-react";
import Link from "next/link";
import { useStore, type Product, type RetailStore, type SpotRecipient, type Sale } from "@/lib/store";
import { calculateDaysRemaining, getStockoutStatus } from "@/lib/stockUtils";
import {
    calculateExecutiveKpis,
    aggregateStoreDailySales,
    aggregateMonthlyStoreSales,
    aggregateProductDailySales,
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
    const { unifiedSales, products, retailStores, spotRecipients } = useStore();

    // タブ: 'store' (店舗別) | 'monthly' (月次推移) | 'product' (商品別)
    const [activeTab, setActiveTab] = useState<'store' | 'monthly' | 'product'>('store');
    
    // 店舗別ビュー用フィルタ
    const [selectedStoreId, setSelectedStoreId] = useState<string>("ALL");
    const [storePeriodDays, setStorePeriodDays] = useState<7 | 30>(7);

    // 商品別ビュー用フィルタ
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [productPeriodDays, setProductPeriodDays] = useState<7 | 30>(7);

    // 有効な商品・店舗
    const activeProducts = useMemo(() => products.filter(p => !p.isTrashed), [products]);
    const activeStores = useMemo(() => retailStores.filter(s => !s.isTrashed), [retailStores]);
    const activeSpots = useMemo(() => spotRecipients.filter(s => !s.isTrashed), [spotRecipients]);

    // 商品マップ (ID -> Product)
    const productMap = useMemo(() => {
        const map = new Map<string, Product>();
        products.forEach(p => map.set(p.id, p));
        return map;
    }, [products]);

    // ─────────────────────────────────────────────────────────────
    // 1. エグゼクティブ・サマリー KPI
    // ─────────────────────────────────────────────────────────────
    const executiveKpis = useMemo(() => {
        return calculateExecutiveKpis(unifiedSales, products, retailStores, spotRecipients);
    }, [unifiedSales, products, retailStores, spotRecipients]);

    // ─────────────────────────────────────────────────────────────
    // 2. 店舗別ビュー（日別売上 ＆ 主力商品個数推移）
    // ─────────────────────────────────────────────────────────────
    const storeViewData = useMemo(() => {
        return aggregateStoreDailySales(unifiedSales, selectedStoreId, storePeriodDays, products);
    }, [unifiedSales, selectedStoreId, storePeriodDays, products]);

    // ─────────────────────────────────────────────────────────────
    // 3. 月次ビュー（店舗毎の月別売上推移 過去6ヶ月）
    // ─────────────────────────────────────────────────────────────
    const monthlyViewData = useMemo(() => {
        return aggregateMonthlyStoreSales(unifiedSales, retailStores, spotRecipients, 6);
    }, [unifiedSales, retailStores, spotRecipients]);

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

    // 在庫予測
    const productStockInfo = useMemo(() => {
        if (!targetProduct) return null;
        const daysLeft = calculateDaysRemaining(targetProduct, unifiedSales.filter(s => !s.isTrashed), products);
        return {
            stock: targetProduct.stock,
            daysLeft,
            status: getStockoutStatus(daysLeft),
        };
    }, [targetProduct, unifiedSales, products]);

    // ─────────────────────────────────────────────────────────────
    // 5. コンサルタント視点での定例会サマリー示唆（ハイライト）
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

        // 2. 主力牽引店舗
        if (executiveKpis.topStore) {
            bullets.push(`店舗別では「${executiveKpis.topStore.name}」が直近30日で ¥${executiveKpis.topStore.amount.toLocaleString()} を売り上げ、全社の最大シェアを牽引しています。`);
        }

        // 3. 売れ筋＆在庫リスク
        if (executiveKpis.topProduct) {
            const p = productMap.get(executiveKpis.topProduct.id);
            const daysRemaining = p ? calculateDaysRemaining(p, unifiedSales.filter(s => !s.isTrashed), products) : Infinity;
            if (daysRemaining !== Infinity && daysRemaining <= 10) {
                bullets.push(`主力売れ筋「${executiveKpis.topProduct.name}」は直近30日で ${executiveKpis.topProduct.qty}個 出荷。在庫残が推計 ${daysRemaining}日分 と逼迫しており、次回定例会前の補充手配を推奨します。`);
            } else {
                bullets.push(`商品別では「${executiveKpis.topProduct.name}」が直近30日で ${executiveKpis.topProduct.qty}個（¥${executiveKpis.topProduct.amount.toLocaleString()}）を出荷し、トップの支持を得ています。`);
            }
        }

        return bullets;
    }, [executiveKpis, productMap, unifiedSales, products]);

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
                <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl self-start md:self-center">
                    <button
                        onClick={() => setActiveTab('store')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'store'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Store className="w-4 h-4" />
                        店舗別動向
                    </button>
                    <button
                        onClick={() => setActiveTab('monthly')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'monthly'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Layers className="w-4 h-4" />
                        店舗毎・月次推移
                    </button>
                    <button
                        onClick={() => setActiveTab('product')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'product'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Package className="w-4 h-4" />
                        商品別推移
                    </button>
                </div>
            </div>

            {/* 4大エグゼクティブKPIカード */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                        <span>直近7日間 売上高</span>
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
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

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                        <span>直近30日間 売上高</span>
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        ¥{executiveKpis.rev30.toLocaleString()}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 font-bold">
                        日販平均: <span className="text-slate-900 font-black">¥{executiveKpis.dailyAvg30.toLocaleString()}</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-amber-200 transition-colors">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                        <span>30日 最多出荷商品</span>
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="text-sm sm:text-base font-black text-slate-900 truncate" title={executiveKpis.topProduct?.name}>
                        {executiveKpis.topProduct?.name || "---"}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 font-bold">
                        出荷総数: <span className="text-amber-600 font-black">{executiveKpis.topProduct?.qty.toLocaleString() ?? 0} 個</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-200 transition-colors">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-2">
                        <span>30日 トップ売上店舗</span>
                        <Store className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <div className="text-sm sm:text-base font-black text-slate-900 truncate" title={executiveKpis.topStore?.name}>
                        {executiveKpis.topStore?.name || "---"}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 font-bold">
                        売上高: <span className="text-purple-600 font-black">¥{executiveKpis.topStore?.amount.toLocaleString() ?? 0}</span>
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
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="text-xs font-bold text-slate-400">期間:</span>
                            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl">
                                <button
                                    onClick={() => setStorePeriodDays(7)}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                                        storePeriodDays === 7 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    直近7日間
                                </button>
                                <button
                                    onClick={() => setStorePeriodDays(30)}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                                        storePeriodDays === 30 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    直近30日間
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Chart 1: 日別売上金額の推移 */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-blue-600" />
                                    日別売上金額の推移（{storePeriodDays === 7 ? "直近7日間" : "直近30日間"}）
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    期間売上合計: <span className="font-black text-slate-800">¥{storeViewData.totalPeriodAmount.toLocaleString()}</span> / 販売総数: <span className="font-black text-slate-800">{storeViewData.totalPeriodQty.toLocaleString()}個</span>
                                </p>
                            </div>
                        </div>

                        <div className="h-64 sm:h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={storeViewData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `¥${(v / 1000).toLocaleString()}k`} />
                                    <Tooltip
                                        formatter={(val: any) => [`¥${Number(val).toLocaleString()}`, "売上金額"]}
                                        labelFormatter={(l: any) => `日付: ${l}`}
                                        contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                                    />
                                    <Bar dataKey="売上額" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={40} />
                                </BarChart>
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
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
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
                                                dot={{ r: 3 }}
                                                activeDot={{ r: 5 }}
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
                                対象店舗での商品別売上実績（{storePeriodDays === 7 ? "直近7日間" : "直近30日間"}）
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
                                        <th className="py-3 px-4 text-right">現在庫数</th>
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
                                                <span className={`font-bold ${item.stock <= 5 ? "text-rose-600" : "text-slate-600"}`}>
                                                    {item.stock} 個
                                                </span>
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
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="text-xs font-bold text-slate-400">期間:</span>
                            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl">
                                <button
                                    onClick={() => setProductPeriodDays(7)}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                                        productPeriodDays === 7 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    直近7日間
                                </button>
                                <button
                                    onClick={() => setProductPeriodDays(30)}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                                        productPeriodDays === 30 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    直近30日間
                                </button>
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
                                        現在庫数
                                    </div>
                                    <div className={`text-xl font-black ${(productStockInfo?.stock ?? 0) <= 5 ? "text-rose-600" : "text-slate-900"}`}>
                                        {productStockInfo?.stock ?? 0} <span className="text-xs font-bold text-slate-500">個</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                        アラート基準: {targetProduct.alertThreshold ?? 20} 個
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

                            {/* Chart: 日次販売個数・金額推移 */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-blue-600" />
                                    「{targetProduct.name}」の日別販売個数・売上推移
                                </h3>

                                <div className="h-64 sm:h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={productViewData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="qtyGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip
                                                formatter={(val: any, name: any) => [name === "販売個数" ? `${val} 個` : `¥${Number(val).toLocaleString()}`, name]}
                                                contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                                            />
                                            <Area type="monotone" dataKey="販売個数" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#qtyGradient)" />
                                        </AreaChart>
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
        </section>
    );
}
