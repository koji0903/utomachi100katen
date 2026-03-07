"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    type PieLabelRenderProps,
} from "recharts";
import { TrendingUp, DollarSign, Percent, ShoppingBag, Store, Filter, ChevronLeft, ChevronRight, FileText } from "lucide-react";

type ViewMode = "monthly" | "daily";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

// Format numbers as ¥ currency
const fmtYen = (v: number) => `¥${Math.round(v).toLocaleString()}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function AnalyticsPage() {
    const { isLoaded, sales, products, retailStores, purchases } = useStore();

    const now = new Date();
    const [viewMode, setViewMode] = useState<ViewMode>("monthly");
    const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    const [selectedStoreId, setSelectedStoreId] = useState("all");
    const [pdfModal, setPdfModal] = useState(false);

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
        const buckets: Record<string, { label: string; revenue: number; grossProfit: number; netProfit: number }> = {};

        if (viewMode === "monthly") {
            // All 12 months of the selected year
            for (let m = 1; m <= 12; m++) {
                const key = `${selectedYear}-${String(m).padStart(2, "0")}`;
                buckets[key] = { label: `${m}月`, revenue: 0, grossProfit: 0, netProfit: 0 };
            }
        } else {
            // All days in the selected month
            const [y, mo] = selectedMonth.split("-").map(Number);
            const daysInMonth = new Date(y, mo, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const key = `${selectedMonth}-${String(d).padStart(2, "0")}`;
                buckets[key] = { label: `${d}日`, revenue: 0, grossProfit: 0, netProfit: 0 };
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
        return Object.values(buckets);
    }, [periodSales, viewMode, selectedYear, selectedMonth, productCostMap]);

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
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="font-bold text-slate-800 mb-4 text-sm">売上・利益の推移</h2>
                {trendData.some(d => d.revenue > 0) ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={trendData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                            <YAxis tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                            <Tooltip content={customTooltip} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="revenue" name="売上高" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="grossProfit" name="粗利益" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="netProfit" name="純利益" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-[280px] flex items-center justify-center text-slate-300 flex-col gap-2">
                        <TrendingUp className="w-12 h-12" />
                        <p className="text-sm">この期間の売上データがありません</p>
                    </div>
                )}
            </div>

            {/* Charts Row 2: Pie + Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Store Share Pie */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h2 className="font-bold text-slate-800 mb-4 text-sm">店舗別売上シェア</h2>
                    {storePieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie data={storePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
                                    label={(props: PieLabelRenderProps) => `${props.name ?? ""} ${(((props.percent ?? 0)) * 100).toFixed(0)}%`}
                                    labelLine={false}>
                                    {storePieData.map((_, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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
                    <h2 className="font-bold text-slate-800 mb-4 text-sm">商品別販売数ランキング（TOP 8）</h2>
                    {productRankData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={productRankData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} width={100} />
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                <Tooltip formatter={(v: any) => [`${v}個`, "販売数"]} />
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
                <div className="px-6 py-4 border-b border-slate-100">
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
