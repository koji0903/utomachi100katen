"use client";

/**
 * SalesAnalysisTab — 販売実績分析コンポーネント
 *
 * 分析軸:
 *   1. 曜日別売上 (棒グラフ) — どの曜日が売れやすいか
 *   2. 天気×売上 (グループ棒グラフ) — 天気と売上の関係
 *   3. 月次推移 (折れ線) — 売上・入金の時系列
 *   4. 商品ランキング (水平棒グラフ) — 売れ筋TOP商品
 */

import { useMemo, useState } from "react";
import {
    BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, Cell,
} from "recharts";
import {
    TrendingUp, CloudSun, Cloud, CloudRain, CloudSnow,
    Calendar, Store, Package, Sparkles, Info, RefreshCw
} from "lucide-react";
import { useStore } from "@/lib/store";
import { syncWithSquare } from "@/lib/square-sync-client";
import { showNotification } from "@/lib/notifications";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const WEEKDAY_COLORS = [
    "#f97316", "#6366f1", "#6366f1", "#6366f1", "#6366f1", "#6366f1", "#10b981"
];

// ─── Insight Card ─────────────────────────────────────────────────────────────
function InsightCard({ icon: Icon, label, value, sub, color = BRAND }:
    { icon: React.ElementType; label: string; value: string; sub?: string; color?: string }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "20" }}>
                <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="min-w-0">
                <div className="text-xs text-slate-400 font-medium">{label}</div>
                <div className="text-lg font-black text-slate-900 leading-none mt-0.5">{value}</div>
                {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
            </div>
        </div>
    );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, unit = "個" }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
            <div className="font-bold text-slate-700 mb-1">{label}</div>
            {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                    <span className="text-slate-500">{p.name === 'avgQty' ? '平均個数' : p.name === 'avgAmount' ? '平均金額' : p.name === 'amount' ? '売上額' : p.name === 'net' ? '入金額' : p.name}:</span>
                    <span className="font-bold text-slate-800">{typeof p.value === 'number' && unit === '¥' ? `¥${p.value.toLocaleString()}` : `${p.value.toFixed ? p.value.toFixed(1) : p.value}${unit}`}</span>
                </div>
            ))}
        </div>
    );
}

function WeatherLabel({ main }: { main: string }) {
    if (main.includes("Rain")) return <><CloudRain className="w-3 h-3 inline text-blue-400 mr-0.5" />雨</>
    if (main.includes("Snow")) return <><CloudSnow className="w-3 h-3 inline text-sky-300 mr-0.5" />雪</>
    if (main.includes("Cloud")) return <><Cloud className="w-3 h-3 inline text-slate-400 mr-0.5" />曇</>
    if (main === "None") return <>（日報なし）</>
    return <><CloudSun className="w-3 h-3 inline text-amber-400 mr-0.5" />晴</>
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SalesAnalysisTab() {
    const { sales, unifiedSales, products, retailStores, dailyReports } = useStore();

    const [filterStoreId, setFilterStoreId] = useState("");
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
    const [isSyncing, setIsSyncing] = useState(false);

    // Product name map
    const productMap = useMemo(() => {
        const m: Record<string, string> = {};
        products.forEach(p => { m[p.id] = p.variantName ? `${p.name} (${p.variantName})` : p.name; });
        return m;
    }, [products]);

    // Weather lookup: "YYYY-MM-DD|storeId" → weatherMain
    const weatherMap = useMemo(() => {
        const m: Record<string, { weatherMain: string; temp?: number }> = {};
        dailyReports.filter(r => r.type === 'store' && r.storeId && r.date).forEach(r => {
            const key = `${r.date}|${r.storeId}`;
            if (!m[key]) m[key] = { weatherMain: r.weatherMain ?? "Clear", temp: r.temperature };
        });
        return m;
    }, [dailyReports]);

    // Available years from sales data
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        sales.forEach(s => { if (s.period?.length >= 4) years.add(s.period.slice(0, 4)); });
        return [...years].sort().reverse();
    }, [sales]);

    // Filtered sales (Daily entries for weekday/weather analysis)
    const dailySales = useMemo(() => {
        return unifiedSales.filter(s => {
            if (s.isTrashed) return false;
            if (filterStoreId && s.storeId !== filterStoreId) return false;
            if (!s.period.startsWith(filterYear)) return false;
            // Only include daily/spot entries for daily analysis
            return s.type === 'daily' || !s.type;
        });
    }, [unifiedSales, filterStoreId, filterYear]);

    // ── 1. 曜日別売上 ──────────────────────────────────────────────────────────
    const weekdayData = useMemo(() => {
        const counts = Array(7).fill(null).map((_, i) => ({
            day: WEEKDAYS[i], qty: 0, amount: 0, count: 0, dayIdx: i
        }));
        dailySales.forEach(sale => {
            const d = new Date(sale.period);
            const dow = d.getDay(); // 0=Sun
            counts[dow].qty += sale.totalQuantity;
            counts[dow].amount += sale.totalAmount;
            counts[dow].count++;
        });
        // Compute average
        return counts.map(c => ({
            ...c,
            avgQty: c.count > 0 ? +(c.qty / c.count).toFixed(1) : 0,
            avgAmount: c.count > 0 ? Math.round(c.amount / c.count) : 0,
        }));
    }, [dailySales]);

    const bestWeekday = useMemo(() => {
        const sorted = [...weekdayData].filter(d => d.count > 0).sort((a, b) => b.avgQty - a.avgQty);
        return sorted[0] ?? null;
    }, [weekdayData]);

    // ── 2. 天気×売上 ──────────────────────────────────────────────────────────
    const weatherData = useMemo(() => {
        const buckets: Record<string, { qty: number; amount: number; count: number }> = {};
        dailySales.forEach(sale => {
            const key = `${sale.period}|${sale.storeId}`;
            const w = weatherMap[key];
            const label = w ? (
                w.weatherMain.includes("Rain") ? "雨" :
                    w.weatherMain.includes("Snow") ? "雪" :
                        w.weatherMain.includes("Cloud") ? "曇り" : "晴れ"
            ) : "日報なし";
            if (!buckets[label]) buckets[label] = { qty: 0, amount: 0, count: 0 };
            buckets[label].qty += sale.totalQuantity;
            buckets[label].amount += sale.totalAmount;
            buckets[label].count++;
        });
        const ORDER = ["晴れ", "曇り", "雨", "雪", "日報なし"];
        return ORDER.filter(k => buckets[k]).map(label => ({
            label,
            avgQty: +(buckets[label].qty / buckets[label].count).toFixed(1),
            avgAmount: Math.round(buckets[label].amount / buckets[label].count),
            count: buckets[label].count,
        }));
    }, [dailySales, weatherMap]);

    const bestWeather = useMemo(() => {
        return [...weatherData].filter(w => w.label !== "日報なし").sort((a, b) => b.avgQty - a.avgQty)[0] ?? null;
    }, [weatherData]);

    // ── 3. 月次推移 ──────────────────────────────────────────────────────────
    const monthlyData = useMemo(() => {
        const months: Record<string, { qty: number; amount: number; net: number }> = {};
        dailySales.forEach(sale => {
            const month = sale.period.slice(0, 7);
            if (!months[month]) months[month] = { qty: 0, amount: 0, net: 0 };
            months[month].qty += sale.totalQuantity;
            months[month].amount += sale.totalAmount;
            months[month].net += sale.totalNetProfit;
        });
        return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({
            label: month.replace(/^(\d{4})-(\d{2})$/, "$1/$2"),
            ...v,
        }));
    }, [dailySales]);

    // ── 4. 商品ランキング ─────────────────────────────────────────────────────
    const productRanking = useMemo(() => {
        const totals: Record<string, number> = {};
        dailySales.forEach(sale => {
            sale.items.forEach(item => {
                if (!totals[item.productId]) totals[item.productId] = 0;
                totals[item.productId] += item.quantity;
            });
        });
        return Object.entries(totals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([pid, qty]) => ({ name: productMap[pid] ?? pid.slice(0, 12), qty }));
    }, [dailySales, productMap]);

    // ── Empty state ────────────────────────────────────────────────────────────
    if (dailySales.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4" style={{ backgroundColor: BRAND_LIGHT }}>
                    <TrendingUp className="w-10 h-10" style={{ color: BRAND }} />
                </div>
                <h3 className="text-base font-bold text-slate-700 mb-2">分析データがありません</h3>
                <p className="text-sm text-slate-400 max-w-sm">「売上入力」タブから日次データを登録すると、ここで傾向分析が表示されます。</p>
            </div>
        );
    }

    const COLORS = [BRAND, "#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4"];

    const handleSquareSync = async () => {
        if (!filterStoreId) {
            showNotification("同期する店舗を選択してください。", "error");
            return;
        }

        const store = retailStores.find(s => s.id === filterStoreId);
        if (!store?.squareLocationId) {
            showNotification("この店舗にはSquare Location IDが設定されていません。", "error");
            return;
        }

        if (!window.confirm(`${store.name} のSquareデータを同期しますか？\n(直近24時間の注文取込と在庫の書き込みを行います)`)) {
            return;
        }

        setIsSyncing(true);
        try {
            const result = await syncWithSquare(filterStoreId);
            if (result.success) {
                showNotification(result.message, "success");
            } else {
                let errorMessage = result.message;
                if (result.detail) errorMessage += `\n詳解: ${result.detail}`;
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            console.error("Square Sync Error:", error);
            showNotification(error.message || "Square同期中にエラーが発生しました。", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-slate-400" />
                    <select value={filterStoreId} onChange={e => setFilterStoreId(e.target.value)}
                        className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none font-medium text-slate-700">
                        <option value="">すべての店舗</option>
                        {retailStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                        className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none font-medium text-slate-700">
                        {availableYears.length > 0
                            ? availableYears.map(y => <option key={y} value={y}>{y}年</option>)
                            : <option value={filterYear}>{filterYear}年</option>}
                    </select>
                </div>
                {filterStoreId && retailStores.find(s => s.id === filterStoreId)?.squareLocationId && (
                    <button
                        onClick={handleSquareSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Square同期中..." : "Squareと同期"}
                    </button>
                )}
                <div className="ml-auto flex items-center text-xs text-slate-400 font-medium self-center gap-1">
                    <Info className="w-3 h-3" />
                    {dailySales.length}日分のデータを分析中
                </div>
            </div>

            {/* KPI Insight Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <InsightCard
                    icon={TrendingUp}
                    label="売上ピーク曜日"
                    value={bestWeekday ? `${bestWeekday.day}曜日` : "—"}
                    sub={bestWeekday ? `平均 ${bestWeekday.avgQty}個/日` : ""}
                    color="#6366f1"
                />
                <InsightCard
                    icon={CloudSun}
                    label="売上が伸びる天気"
                    value={bestWeather?.label ?? "—"}
                    sub={bestWeather ? `平均 ${bestWeather.avgQty}個/日` : "天気データが必要"}
                    color="#f59e0b"
                />
                <InsightCard
                    icon={Package}
                    label="売れ筋NO.1"
                    value={productRanking[0]?.name.slice(0, 10) ?? "—"}
                    sub={productRanking[0] ? `累計 ${productRanking[0].qty}個` : ""}
                    color={BRAND}
                />
                <InsightCard
                    icon={Sparkles}
                    label="分析期間 総売上"
                    value={`¥${dailySales.reduce((s, r) => s + r.totalAmount, 0).toLocaleString()}`}
                    sub={`${dailySales.reduce((s, r) => s + r.totalQuantity, 0)}個 / ${dailySales.length}日間`}
                    color="#10b981"
                />
            </div>

            {/* Charts — 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 1. 曜日別 平均売上個数 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 text-sm mb-1">📅 曜日別 平均売上個数</h3>
                    <p className="text-xs text-slate-400 mb-4">各曜日の1日あたり平均販売個数（データがある曜日のみ）</p>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={weekdayData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="day" tick={{ fontSize: 12, fontWeight: 700 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip unit="個" />} />
                            <Bar dataKey="avgQty" name="平均売上個数" radius={[6, 6, 0, 0]}>
                                {weekdayData.map((entry, i) => (
                                    <Cell key={i} fill={
                                        bestWeekday?.dayIdx === entry.dayIdx ? BRAND : "#e2e8f0"
                                    } />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    {bestWeekday && bestWeekday.count > 0 && (
                        <div className="mt-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2" style={{ backgroundColor: BRAND_LIGHT, color: BRAND }}>
                            <Sparkles className="w-3.5 h-3.5" />
                            <strong>{bestWeekday.day}曜日</strong>が最も売上個数が多く、平均<strong>{bestWeekday.avgQty}個/日</strong>です（{bestWeekday.count}日間のデータ）
                        </div>
                    )}
                </div>

                {/* 2. 天気×売上 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 text-sm mb-1">☁️ 天気別 平均売上個数</h3>
                    <p className="text-xs text-slate-400 mb-4">天気ごとの1日あたり平均販売個数（天気は日報から自動取得）</p>
                    {weatherData.filter(w => w.label !== "日報なし").length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[220px] text-slate-300">
                            <CloudSun className="w-10 h-10 mb-2" />
                            <p className="text-xs text-center">日報に天気データがありません<br />「業務日報」で店舗訪問を記録すると分析できます</p>
                        </div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={weatherData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 600 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip unit="個" />} />
                                    <Bar dataKey="avgQty" name="平均売上個数" radius={[6, 6, 0, 0]}>
                                        {weatherData.map((entry, i) => (
                                            <Cell key={i} fill={
                                                entry.label === "晴れ" ? "#fbbf24" :
                                                    entry.label === "曇り" ? "#94a3b8" :
                                                        entry.label === "雨" ? "#60a5fa" :
                                                            entry.label === "雪" ? "#7dd3fc" : "#e2e8f0"
                                            } />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            {bestWeather && (
                                <div className="mt-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2" style={{ backgroundColor: "#fef9ec", color: "#b45309" }}>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <strong>{bestWeather.label}</strong>の日が最も売れやすく、平均<strong>{bestWeather.avgQty}個/日</strong>（{bestWeather.count}日間のデータ）
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 3. 月次推移 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 text-sm mb-1">📈 月次売上推移</h3>
                    <p className="text-xs text-slate-400 mb-4">月別の売上総額と入金額の推移</p>
                    {monthlyData.length < 2 ? (
                        <div className="flex flex-col items-center justify-center h-[220px] text-slate-300">
                            <TrendingUp className="w-10 h-10 mb-2" />
                            <p className="text-xs text-center">複数月のデータが揃うと<br />推移グラフが表示されます</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={monthlyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                                <Tooltip content={<CustomTooltip unit="¥" />} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                <Line type="monotone" dataKey="amount" name="売上額" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1" }} />
                                <Line type="monotone" dataKey="net" name="入金額" stroke={BRAND} strokeWidth={2.5} dot={{ r: 4, fill: BRAND }} strokeDasharray="5 3" />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* 4. 商品ランキング */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 text-sm mb-1">🏆 売れ筋商品ランキング</h3>
                    <p className="text-xs text-slate-400 mb-4">期間内の累計販売個数TOP8</p>
                    {productRanking.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[220px] text-slate-300">
                            <Package className="w-10 h-10 mb-2" />
                            <p className="text-xs">データがありません</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {productRanking.map((item, i) => {
                                const max = productRanking[0].qty;
                                const pct = max > 0 ? (item.qty / max) * 100 : 0;
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-xs font-black text-slate-400 w-5 text-right shrink-0">
                                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-slate-700 truncate">{item.name}</span>
                                                <span className="text-xs font-black text-slate-900 ml-2 shrink-0">{item.qty}個</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Supplemental: 温度と売上の関係 (scatter-light: bucketed) */}
            {(() => {
                // Build temperature buckets: <10, 10-15, 15-20, 20-25, 25-30, >30
                const ranges = [
                    { label: "〜10°C", min: -99, max: 10 },
                    { label: "10〜15°C", min: 10, max: 15 },
                    { label: "15〜20°C", min: 15, max: 20 },
                    { label: "20〜25°C", min: 20, max: 25 },
                    { label: "25〜30°C", min: 25, max: 30 },
                    { label: "30°C〜", min: 30, max: 99 },
                ];
                const buckets = ranges.map(r => ({ ...r, qty: 0, count: 0 }));
                dailySales.forEach(sale => {
                    const key = `${sale.period}|${sale.storeId}`;
                    const w = weatherMap[key];
                    if (!w || w.temp === undefined) return;
                    const bucket = buckets.find(b => w.temp! >= b.min && w.temp! < b.max);
                    if (bucket) { bucket.qty += sale.totalQuantity; bucket.count++; }
                });
                const data = buckets.filter(b => b.count > 0).map(b => ({
                    label: b.label,
                    avgQty: +(b.qty / b.count).toFixed(1),
                    count: b.count,
                }));
                if (data.length < 2) return null;
                return (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <h3 className="font-bold text-slate-800 text-sm mb-1">🌡 気温帯別 平均売上個数</h3>
                        <p className="text-xs text-slate-400 mb-4">気温と販売個数の関係（日報の気温データから集計）</p>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip unit="個" />} />
                                <Bar dataKey="avgQty" name="平均売上個数" radius={[6, 6, 0, 0]} fill="#60a5fa" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                );
            })()}
        </div>
    );
}
