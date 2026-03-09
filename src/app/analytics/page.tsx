"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import {
    BarChart, Bar, Line, PieChart, Pie, Cell,
    ScatterChart, Scatter, ZAxis, ReferenceLine,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    type PieLabelRenderProps,
} from "recharts";
import { TrendingUp, DollarSign, Percent, ShoppingBag, Store, Filter, ChevronLeft, ChevronRight, FileText, BarChart3, PieChart as PieIcon, ListFilter } from "lucide-react";
import { showNotification } from "@/lib/notifications";

type ViewMode = "monthly" | "daily";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

// Format numbers as ¥ currency
const fmtYen = (v: number) => `¥${Math.round(v).toLocaleString()}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function AnalyticsPage() {
    const { isLoaded, sales, products, brands, retailStores, purchases } = useStore();

    const now = new Date();
    const [viewMode, setViewMode] = useState<ViewMode>("monthly");
    const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    const [selectedStoreId, setSelectedStoreId] = useState("all");
    const [pdfModal, setPdfModal] = useState(false);
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
    const [showYoY, setShowYoY] = useState(false);

    // Filter sales by store
    const storeSales = useMemo(() => {
        if (selectedStoreId === "all") return sales;
        return sales.filter(s => s.storeId === selectedStoreId);
    }, [sales, selectedStoreId]);

    // Filter sales by period
    const periodSales = useMemo(() => {
        if (viewMode === "monthly") {
            return storeSales.filter(s => s.period.startsWith(selectedYear));
        } else {
            return storeSales.filter(s => s.period.startsWith(selectedMonth));
        }
    }, [storeSales, viewMode, selectedYear, selectedMonth]);

    // Build a product cost map: productId -> costPrice
    const productCostMap = useMemo(() => {
        const m: Record<string, number> = {};
        products.forEach(p => { m[p.id] = p.costPrice; });
        return m;
    }, [products]);

    // Compute COGS (cost of goods sold) for a sale record
    const computeCOGS = (sale: (typeof sales)[number]) =>
        sale.items.reduce((sum, item) => sum + (productCostMap[item.productId] ?? 0) * item.quantity, 0);

    // Global KPI totals over filtered period
    const kpiTotals = useMemo(() => {
        let totalRevenue = 0, totalCOGS = 0, totalNetProfit = 0;
        for (const sale of periodSales) {
            totalRevenue += sale.totalAmount;
            totalCOGS += computeCOGS(sale);
            totalNetProfit += sale.totalNetProfit;
        }
        const grossProfit = totalRevenue - totalCOGS;
        const cogRate = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;
        return { totalRevenue, totalCOGS, grossProfit, totalNetProfit, cogRate };
    }, [periodSales, productCostMap]);

    // ─── Trend Chart Data ───
    const trendData = useMemo(() => {
        const buckets: Record<string, { key: string; label: string; revenue: number; grossProfit: number; netProfit: number; prevRevenue: number }> = {};

        if (viewMode === "monthly") {
            // All 12 months of the selected year
            for (let m = 1; m <= 12; m++) {
                const key = `${selectedYear}-${String(m).padStart(2, "0")}`;
                buckets[key] = { key, label: `${m}月`, revenue: 0, grossProfit: 0, netProfit: 0, prevRevenue: 0 };
            }
        } else {
            // All days in the selected month
            const [y, mo] = selectedMonth.split("-").map(Number);
            const daysInMonth = new Date(y, mo, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const key = `${selectedMonth}-${String(d).padStart(2, "0")}`;
                buckets[key] = { key, label: `${d}日`, revenue: 0, grossProfit: 0, netProfit: 0, prevRevenue: 0 };
            }
        }

        for (const sale of periodSales) {
            const key = viewMode === "monthly" ? sale.period.slice(0, 7) : sale.period.slice(0, 10);
            if (buckets[key]) {
                const cogs = computeCOGS(sale);
                buckets[key].revenue += sale.totalAmount;
                buckets[key].grossProfit += sale.totalAmount - cogs;
                buckets[key].netProfit += sale.totalNetProfit;
            }
        }

        // Previous year comparison
        if (showYoY) {
            const prevPeriodSales = storeSales.filter(s => {
                if (viewMode === "monthly") {
                    const prevYear = (Number(selectedYear) - 1).toString();
                    return s.period.startsWith(prevYear);
                } else {
                    const [y, m] = selectedMonth.split("-");
                    const prevYearMonth = `${Number(y) - 1}-${m}`;
                    return s.period.startsWith(prevYearMonth);
                }
            });

            prevPeriodSales.forEach(sale => {
                const parts = sale.period.split("-");
                // Key construction for mapping (e.g., 2024-03 -> 2025-03 mapping)
                const currentYear = viewMode === "monthly" ? selectedYear : selectedMonth.split("-")[0];
                const key = viewMode === "monthly"
                    ? `${currentYear}-${parts[1]}`
                    : `${selectedMonth}-${parts[2]}`;

                if (buckets[key]) {
                    buckets[key].prevRevenue = (buckets[key].prevRevenue || 0) + sale.totalAmount;
                }
            });
        }

        return Object.values(buckets);
    }, [periodSales, storeSales, viewMode, selectedYear, selectedMonth, productCostMap, showYoY]);

    // ─── ABC Analysis Data ───
    const abcData = useMemo(() => {
        const productStats: Record<string, { id: string; name: string; revenue: number }> = {};
        periodSales.forEach(sale => {
            sale.items.forEach(item => {
                if (!productStats[item.productId]) {
                    const p = products.find(p => p.id === item.productId);
                    productStats[item.productId] = {
                        id: item.productId,
                        name: p ? `${p.name}${p.variantName ? ` (${p.variantName})` : ""}` : "不明",
                        revenue: 0
                    };
                }
                productStats[item.productId].revenue += item.subtotal;
            });
        });

        const sorted = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);
        const totalRevenue = sorted.reduce((sum, p) => sum + p.revenue, 0);

        let cumulative = 0;
        return sorted.map(p => {
            cumulative += p.revenue;
            const ratio = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
            let group: "A" | "B" | "C" = "C";
            if (ratio <= 70) group = "A";
            else if (ratio <= 90) group = "B";

            return { ...p, cumulativeRatio: ratio, group };
        });
    }, [periodSales, products]);

    // ─── Store Share Pie Data ───
    const storePieData = useMemo(() => {
        const map: Record<string, number> = {};
        for (const sale of periodSales) {
            map[sale.storeId] = (map[sale.storeId] || 0) + sale.totalAmount;
        }
        return Object.entries(map).map(([storeId, revenue]) => ({
            name: retailStores.find(s => s.id === storeId)?.name ?? "不明",
            value: revenue,
        })).sort((a, b) => b.value - a.value);
    }, [periodSales, retailStores]);

    // ─── Product Ranking Data ───
    const productRankData = useMemo(() => {
        const map: Record<string, number> = {};
        for (const sale of periodSales) {
            for (const item of sale.items) {
                map[item.productId] = (map[item.productId] || 0) + item.quantity;
            }
        }
        return Object.entries(map).map(([productId, qty]) => {
            const p = products.find(p => p.id === productId);
            return {
                name: p ? `${p.name}${p.variantName ? ` (${p.variantName})` : ""}` : "不明",
                qty,
            };
        }).sort((a, b) => b.qty - a.qty).slice(0, 8);
    }, [periodSales, products]);

    // ─── Brand Profitability Data ───
    const brandProfitData = useMemo(() => {
        const map: Record<string, { name: string; revenue: number; grossProfit: number; netProfit: number }> = {};

        for (const sale of periodSales) {
            for (const item of sale.items) {
                const product = products.find(p => p.id === item.productId);
                if (!product) continue;

                const brandId = product.brandId;
                const brand = brands.find(b => b.id === brandId);
                const brandName = brand?.name ?? "不明";

                if (!map[brandId]) {
                    map[brandId] = { name: brandName, revenue: 0, grossProfit: 0, netProfit: 0 };
                }

                const itemCOGS = (productCostMap[item.productId] ?? 0) * item.quantity;

                map[brandId].revenue += item.subtotal;
                map[brandId].grossProfit += (item.subtotal - itemCOGS);
                map[brandId].netProfit += item.netProfit;
            }
        }

        return Object.values(map).sort((a, b) => b.netProfit - a.netProfit || b.revenue - a.revenue).slice(0, 5);
    }, [periodSales, products, brands, productCostMap]);

    // ─── Store Quadrant Data ───
    const storeQuadrantData = useMemo(() => {
        const map: Record<string, { name: string; revenue: number; netProfit: number }> = {};
        periodSales.forEach(sale => {
            if (!map[sale.storeId]) {
                map[sale.storeId] = {
                    name: retailStores.find(s => s.id === sale.storeId)?.name ?? "不明",
                    revenue: 0,
                    netProfit: 0
                };
            }
            map[sale.storeId].revenue += sale.totalAmount;
            map[sale.storeId].netProfit += sale.totalNetProfit;
        });

        return Object.values(map).map(s => ({
            ...s,
            margin: s.revenue > 0 ? (s.netProfit / s.revenue) * 100 : 0
        })).filter(s => s.revenue > 0);
    }, [periodSales, retailStores]);

    const quadrantStats = useMemo(() => {
        if (storeQuadrantData.length === 0) return { avgRevenue: 0, avgMargin: 0 };
        const totalRev = storeQuadrantData.reduce((sum, s) => sum + s.revenue, 0);
        const totalMargin = storeQuadrantData.reduce((sum, s) => sum + s.margin, 0);
        return {
            avgRevenue: totalRev / storeQuadrantData.length,
            avgMargin: totalMargin / storeQuadrantData.length
        };
    }, [storeQuadrantData]);

    // ─── Summary Table Data ───
    const tableRows = useMemo(() => {
        if (viewMode === "monthly") {
            const buckets: Record<string, { period: string; revenue: number; cogs: number; netProfit: number }> = {};
            for (let m = 1; m <= 12; m++) {
                const key = `${selectedYear}-${String(m).padStart(2, "0")}`;
                buckets[key] = { period: `${m}月`, revenue: 0, cogs: 0, netProfit: 0 };
            }
            for (const sale of periodSales) {
                const key = sale.period.slice(0, 7);
                if (buckets[key]) {
                    buckets[key].revenue += sale.totalAmount;
                    buckets[key].cogs += computeCOGS(sale);
                    buckets[key].netProfit += sale.totalNetProfit;
                }
            }
            return Object.entries(buckets).map(([, v]) => v);
        } else {
            // Group by store
            const buckets: Record<string, { period: string; revenue: number; cogs: number; netProfit: number }> = {};
            for (const sale of periodSales) {
                const storeId = sale.storeId;
                const name = retailStores.find(s => s.id === storeId)?.name ?? "不明";
                if (!buckets[storeId]) buckets[storeId] = { period: name, revenue: 0, cogs: 0, netProfit: 0 };
                buckets[storeId].revenue += sale.totalAmount;
                buckets[storeId].cogs += computeCOGS(sale);
                buckets[storeId].netProfit += sale.totalNetProfit;
            }
            return Object.values(buckets);
        }
    }, [periodSales, viewMode, selectedYear, retailStores, productCostMap]);

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        sales.forEach(s => years.add(s.period.slice(0, 4)));
        if (!years.has(now.getFullYear().toString())) years.add(now.getFullYear().toString());
        return Array.from(years).sort().reverse();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sales]);

    if (!isLoaded) {
        return (
            <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center space-y-3">
                    <TrendingUp className="w-12 h-12 mx-auto opacity-30" />
                    <p>読み込み中...</p>
                </div>
            </div>
        );
    }

    const changeMonth = (delta: number) => {
        const [y, m] = selectedMonth.split("-").map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    };

    const handleLegendClick = (data: any) => {
        const { dataKey } = data;
        setHiddenSeries(prev => {
            const next = new Set(prev);
            if (next.has(dataKey)) next.delete(dataKey);
            else next.add(dataKey);
            return next;
        });
    };

    const handleBarClick = (data: any) => {
        if (viewMode === "monthly" && data?.key) {
            setSelectedMonth(data.key);
            setViewMode("daily");
            showNotification(`${data.label}の日次データにドリルダウンしました。`);
        }
    };

    const kpiCards = [
        {
            label: "売上高",
            value: fmtYen(kpiTotals.totalRevenue),
            sub: `仕入原価 ${fmtYen(kpiTotals.totalCOGS)}`,
            icon: DollarSign,
            color: "bg-blue-50 text-blue-600",
        },
        {
            label: "売上総利益（粗利）",
            value: fmtYen(kpiTotals.grossProfit),
            sub: `原価率 ${fmtPct(kpiTotals.cogRate)}`,
            icon: TrendingUp,
            color: "bg-emerald-50 text-emerald-600",
        },
        {
            label: "手数料差引後 純利益",
            value: fmtYen(kpiTotals.totalNetProfit),
            sub: "店舗手数料控除後",
            icon: ShoppingBag,
            color: "bg-violet-50 text-violet-600",
        },
        {
            label: "原価率",
            value: fmtPct(kpiTotals.cogRate),
            sub: "低いほど利益率が高い",
            icon: Percent,
            color: "bg-amber-50 text-amber-600",
        },
    ];

    const customTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
                <div className="font-bold text-slate-700 mb-2">{label}</div>
                {payload.map((p: any) => (
                    <div key={p.dataKey} className="flex justify-between gap-4">
                        <span style={{ color: p.color }}>{p.name}</span>
                        <span className="font-bold">¥{Math.round(p.value).toLocaleString()}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <>
            <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-violet-600 text-white rounded-xl shadow-md">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">事業分析</h1>
                            <p className="text-slate-500 mt-0.5 text-sm">売上・利益・原価率の統合ダッシュボード</p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {/* View Mode */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                            {(["monthly", "daily"] as ViewMode[]).map(mode => (
                                <button key={mode} onClick={() => setViewMode(mode)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                                    {mode === "monthly" ? "月次" : "日次"}
                                </button>
                            ))}
                        </div>

                        {/* Period picker */}
                        {viewMode === "monthly" ? (
                            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                                className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
                            </select>
                        ) : (
                            <div className="flex items-center gap-1 border border-slate-200 rounded-lg bg-white px-2 py-1">
                                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded-md text-slate-500">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm font-bold text-slate-800 px-2 min-w-[90px] text-center">
                                    {selectedMonth.replace("-", "年")}月
                                </span>
                                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded-md text-slate-500">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Store filter */}
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg bg-white px-3 py-2">
                            <Store className="w-4 h-4 text-slate-400" />
                            <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                                className="text-sm font-medium text-slate-700 bg-white focus:outline-none">
                                <option value="all">すべての店舗</option>
                                {retailStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        {/* YoY Toggle */}
                        <button
                            onClick={() => setShowYoY(!showYoY)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all ${showYoY ? "bg-orange-100 text-orange-700 border border-orange-200 shadow-sm" : "bg-white text-slate-600 border border-slate-200"}`}
                        >
                            <TrendingUp className="w-4 h-4" />
                            前年比較
                        </button>

                        {/* PDF Button */}
                        {selectedStoreId !== "all" && (
                            <button
                                onClick={() => setPdfModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                                style={{ backgroundColor: "#b27f79" }}
                            >
                                <FileText className="w-4 h-4" />
                                納品書PDF
                            </button>
                        )}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {kpiCards.map(card => {
                        const Icon = card.icon;
                        return (
                            <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-lg ${card.color}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="text-xs font-semibold text-slate-500">{card.label}</div>
                                </div>
                                <div className="text-2xl font-black text-slate-900">{card.value}</div>
                                <div className="text-xs text-slate-400 mt-1">{card.sub}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Charts Row 1: Trend */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-slate-400" />
                            <h2 className="font-bold text-slate-800 text-sm">売上・利益の推移</h2>
                        </div>
                        {viewMode === "monthly" && (
                            <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-md">
                                💡 グラフをクリックして日次へドリルダウン
                            </span>
                        )}
                    </div>
                    {trendData.some(d => d.revenue > 0) ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={trendData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }} onClick={(e: any) => e && handleBarClick(e.activePayload?.[0]?.payload)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <YAxis tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <Tooltip content={customTooltip} cursor={{ fill: "#f8fafc" }} />
                                <Legend
                                    wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                                    onClick={handleLegendClick}
                                    cursor="pointer"
                                />
                                <Bar dataKey="revenue" name="売上高" fill="#3b82f6" hide={hiddenSeries.has("revenue")} radius={[4, 4, 0, 0]} barSize={24} />
                                <Bar dataKey="grossProfit" name="粗利益" fill="#10b981" hide={hiddenSeries.has("grossProfit")} radius={[4, 4, 0, 0]} barSize={24} />
                                <Bar dataKey="netProfit" name="純利益" fill="#8b5cf6" hide={hiddenSeries.has("netProfit")} radius={[4, 4, 0, 0]} barSize={24} />
                                {showYoY && (
                                    <Line type="monotone" dataKey="prevRevenue" name="前年売上" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-300 flex-col gap-2">
                            <TrendingUp className="w-12 h-12" />
                            <p className="text-sm">この期間の売上データがありません</p>
                        </div>
                    )}
                </div>

                {/* Brands Profit Ranking */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-4 h-4 text-slate-400" />
                        <h2 className="font-bold text-slate-800 text-sm">ブランド別利益ランキング（TOP 5）</h2>
                    </div>
                    {brandProfitData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={brandProfitData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <YAxis tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <Tooltip content={customTooltip} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="revenue" name="売上高" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={32} />
                                <Bar dataKey="netProfit" name="純利益" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-slate-300 flex-col gap-2">
                            <TrendingUp className="w-12 h-12" />
                            <p className="text-sm">データなし</p>
                        </div>
                    )}
                </div>

                {/* Store Quadrant Analysis */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-slate-400" />
                            <h2 className="font-bold text-slate-800 text-sm">店舗別パフォーマンス・クアドラント</h2>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                            横軸: 売上高 / 縦軸: 利益率
                        </div>
                    </div>
                    {storeQuadrantData.length > 0 ? (
                        <div className="relative">
                            <ResponsiveContainer width="100%" height={320}>
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis
                                        type="number"
                                        dataKey="revenue"
                                        name="売上高"
                                        unit="円"
                                        tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`}
                                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="margin"
                                        name="利益率"
                                        unit="%"
                                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    />
                                    <ZAxis type="number" range={[60, 400]} />
                                    <Tooltip
                                        cursor={{ strokeDasharray: '3 3' }}
                                        content={({ active, payload }: any) => {
                                            if (!active || !payload?.length) return null;
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[150px]">
                                                    <div className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">{data.name}</div>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">売上高:</span>
                                                            <span className="font-bold">{fmtYen(data.revenue)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">純利益:</span>
                                                            <span className="font-bold">{fmtYen(data.netProfit)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">利益率:</span>
                                                            <span className="font-bold text-blue-600">{fmtPct(data.margin)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
                                    <ReferenceLine x={quadrantStats.avgRevenue} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'top', value: '平均売上', fill: '#94a3b8', fontSize: 10 }} />
                                    <ReferenceLine y={quadrantStats.avgMargin} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'right', value: '平均利益率', fill: '#94a3b8', fontSize: 10 }} />
                                    <Scatter name="Stores" data={storeQuadrantData} fill="#3b82f6" />
                                </ScatterChart>
                            </ResponsiveContainer>

                            {/* quadrant labels */}
                            <div className="absolute top-0 right-0 p-2 text-[9px] font-bold text-slate-300 pointer-events-none uppercase tracking-widest">Efficiency Stars</div>
                            <div className="absolute bottom-0 right-0 p-2 text-[9px] font-bold text-slate-300 pointer-events-none uppercase tracking-widest">Volume Drivers</div>
                            <div className="absolute top-0 left-0 p-2 text-[9px] font-bold text-slate-300 pointer-events-none uppercase tracking-widest">Niche Luxury</div>
                            <div className="absolute bottom-0 left-0 p-2 text-[9px] font-bold text-slate-300 pointer-events-none uppercase tracking-widest">Low Performers</div>
                        </div>
                    ) : (
                        <div className="h-[320px] flex items-center justify-center text-slate-300 flex-col gap-2">
                            <Store className="w-12 h-12" />
                            <p className="text-sm">十分なデータがありません</p>
                        </div>
                    )}
                </div>

                {/* ABC Analysis Section */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                        <ListFilter className="w-4 h-4 text-slate-500" />
                        <h2 className="font-bold text-slate-800 text-sm">商品貢献度分析 (ABC分析)</h2>
                        <span className="ml-auto text-[10px] text-slate-400">売上上位 70%(A) / 90%(B) / その他(C)</span>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {(["A", "B", "C"] as const).map(group => {
                                const groupItems = abcData.filter(d => d.group === group);
                                const groupRevenue = groupItems.reduce((sum, item) => sum + item.revenue, 0);
                                const totalRevenue = abcData.reduce((sum, item) => sum + item.revenue, 0);
                                const share = totalRevenue > 0 ? (groupRevenue / totalRevenue) * 100 : 0;

                                const colors = {
                                    A: "border-blue-200 bg-blue-50 text-blue-700",
                                    B: "border-emerald-200 bg-emerald-50 text-emerald-700",
                                    C: "border-slate-200 bg-slate-50 text-slate-700"
                                };

                                return (
                                    <div key={group} className={`p-4 rounded-xl border ${colors[group]}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xl font-black">{group}</span>
                                            <span className="text-xs font-bold">{fmtPct(share)} share</span>
                                        </div>
                                        <div className="text-sm font-bold">{fmtYen(groupRevenue)}</div>
                                        <div className="text-[10px] mt-1 opacity-70 cursor-default" title={groupItems.map(i => i.name).join("\n")}>
                                            {groupItems.length} 商品
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-[11px]">
                                <thead>
                                    <tr className="text-slate-400 border-b border-slate-100">
                                        <th className="px-2 py-2 text-left">ランク</th>
                                        <th className="px-2 py-2 text-left">商品名</th>
                                        <th className="px-2 py-2 text-right">売上高</th>
                                        <th className="px-2 py-2 text-right">累計構成比</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {abcData.slice(0, 10).map((p, i) => (
                                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                                            <td className="px-2 py-2 font-bold text-slate-400">{i + 1}</td>
                                            <td className="px-2 py-2 text-slate-700 font-medium truncate max-w-[200px]">{p.name}</td>
                                            <td className="px-2 py-2 text-right font-bold text-slate-900">{fmtYen(p.revenue)}</td>
                                            <td className="px-2 py-2 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${p.group === 'A' ? 'bg-blue-500' : p.group === 'B' ? 'bg-emerald-500' : 'bg-slate-400'}`} style={{ width: `${p.cumulativeRatio}%` }} />
                                                    </div>
                                                    <span className="w-8 font-mono">{Math.round(p.cumulativeRatio)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Charts Row 3: Pie + Ranking */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Store Share Pie */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <PieIcon className="w-4 h-4 text-slate-400" />
                            <h2 className="font-bold text-slate-800 text-sm">店舗別売上シェア</h2>
                        </div>
                        {storePieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie data={storePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
                                        label={(props: PieLabelRenderProps) => `${props.name ?? ""} ${(((props.percent ?? 0)) * 100).toFixed(0)}%`}
                                        labelLine={false}>
                                        {storePieData.map((_, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="white" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    <Tooltip formatter={(v: any) => fmtYen(Number(v))} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[240px] flex items-center justify-center text-slate-300 flex-col gap-2">
                                <Store className="w-10 h-10" />
                                <p className="text-sm">データなし</p>
                            </div>
                        )}
                    </div>

                    {/* Product Ranking */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-4 h-4 text-slate-400" />
                            <h2 className="font-bold text-slate-800 text-sm">商品別販売数ランキング（TOP 8）</h2>
                        </div>
                        {productRankData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={productRankData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} width={100} />
                                    <Tooltip formatter={(v: any) => [`${v}個`, "販売数"]} cursor={{ fill: "#f8fafc" }} />
                                    <Bar dataKey="qty" name="販売数" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                                        {productRankData.map((_, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[240px] flex items-center justify-center text-slate-300 flex-col gap-2">
                                <ShoppingBag className="w-10 h-10" />
                                <p className="text-sm">データなし</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="font-bold text-slate-800 text-sm">
                            {viewMode === "monthly" ? `${selectedYear}年 月次明細` : `${selectedMonth.replace("-", "年")}月 店舗別明細`}
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                                    <th className="px-5 py-3 font-semibold text-left">期間 / 店舗</th>
                                    <th className="px-5 py-3 font-semibold text-right">売上高</th>
                                    <th className="px-5 py-3 font-semibold text-right">粗利益</th>
                                    <th className="px-5 py-3 font-semibold text-right">純利益</th>
                                    <th className="px-5 py-3 font-semibold text-right">原価率</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableRows.map((row, i) => {
                                    const gp = row.revenue - row.cogs;
                                    const cogRate = row.revenue > 0 ? (row.cogs / row.revenue) * 100 : 0;
                                    const hasData = row.revenue > 0;
                                    return (
                                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5 font-medium text-slate-700">{row.period}</td>
                                            <td className={`px-5 py-3.5 text-right font-bold ${hasData ? "text-slate-900" : "text-slate-300"}`}>{fmtYen(row.revenue)}</td>
                                            <td className={`px-5 py-3.5 text-right font-bold ${hasData ? "text-emerald-600" : "text-slate-300"}`}>{fmtYen(gp)}</td>
                                            <td className={`px-5 py-3.5 text-right font-bold ${hasData ? "text-violet-600" : "text-slate-300"}`}>{fmtYen(row.netProfit)}</td>
                                            <td className="px-5 py-3.5 text-right">
                                                {hasData ? (
                                                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${cogRate < 40 ? "bg-emerald-100 text-emerald-700" : cogRate < 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                                        {fmtPct(cogRate)}
                                                    </span>
                                                ) : <span className="text-slate-300">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr className="text-sm">
                                    <td className="px-5 py-4 font-bold text-slate-700">合計</td>
                                    <td className="px-5 py-4 text-right font-black text-slate-900">{fmtYen(kpiTotals.totalRevenue)}</td>
                                    <td className="px-5 py-4 text-right font-black text-emerald-600">{fmtYen(kpiTotals.grossProfit)}</td>
                                    <td className="px-5 py-4 text-right font-black text-violet-600">{fmtYen(kpiTotals.totalNetProfit)}</td>
                                    <td className="px-5 py-4 text-right">
                                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${kpiTotals.cogRate < 40 ? "bg-emerald-100 text-emerald-700" : kpiTotals.cogRate < 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                            {fmtPct(kpiTotals.cogRate)}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
            {pdfModal && (
                <DocumentPreviewModal
                    type="delivery_note"
                    storeId={selectedStoreId}
                    period={viewMode === "monthly" ? selectedYear : selectedMonth}
                    onClose={() => setPdfModal(false)}
                />
            )}
        </>
    );
}
