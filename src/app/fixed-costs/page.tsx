"use client";

import { useState, useMemo, useEffect } from "react";
import { 
    Coins, Save, Calendar, Landmark, Users, 
    Zap, Wifi, Truck, Monitor, BarChart3, 
    Activity, ChevronRight, HelpCircle, Sparkles, RotateCcw
} from "lucide-react";
import { useStore, FixedCost } from "@/lib/store";
import { NumberInput } from "@/components/NumberInput";
import { showNotification } from "@/lib/notifications";

const DEFAULT_TEMPLATES = [
    { category: "地代家賃", amount: 150000, enabled: true },
    { category: "給与・手当", amount: 300000, enabled: true },
    { category: "外注費", amount: 85000, enabled: true },
    { category: "水道光熱費", amount: 28000, enabled: true },
    { category: "諸会費・サブスク", amount: 12800, enabled: true }
];

export default function FixedCostsPage() {
    const { 
        isLoaded,
        fixedCosts = [], 
        saveFixedCosts,
        companySettings
    } = useStore();

    // Select month state (YYYY-MM)
    const [targetMonth, setTargetMonth] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        return `${y}-${m}`;
    });

    // Form inputs state
    const [formData, setFormData] = useState({
        rentCost: 0,
        laborCost: 0,
        utilityCost: 0,
        communicationCost: 0,
        vehicleCost: 0,
        softwareCost: 0,
        otherFixedCost: 0
    });

    // Track initialized/loaded month to avoid resetting user edits or entering infinite loops
    const [loadedMonth, setLoadedMonth] = useState<string>("");

    // Load existing record for selected month or fall back to company templates from Basic Settings
    useEffect(() => {
        if (!isLoaded) return;
        if (loadedMonth === targetMonth) return;

        const existing = fixedCosts.find(c => c.id === targetMonth);
        if (existing) {
            setFormData({
                rentCost: existing.rentCost || 0,
                laborCost: existing.laborCost || 0,
                utilityCost: existing.utilityCost || 0,
                communicationCost: existing.communicationCost || 0,
                vehicleCost: existing.vehicleCost || 0,
                softwareCost: existing.softwareCost || 0,
                otherFixedCost: existing.otherFixedCost || 0
            });
            showNotification(`${targetMonth}の固定費データを読み込みました`, "info");
            setLoadedMonth(targetMonth);
        } else if (companySettings) {
            const templates = companySettings?.fixedCostTemplates && companySettings.fixedCostTemplates.length > 0
                ? companySettings.fixedCostTemplates
                : DEFAULT_TEMPLATES;
            
            const initial = {
                rentCost: 0,
                laborCost: 0,
                utilityCost: 0,
                communicationCost: 0,
                vehicleCost: 0,
                softwareCost: 0,
                otherFixedCost: 0
            };

            templates.forEach(item => {
                if (!item.enabled) return;
                const cat = item.category;
                const amt = item.amount || 0;
                
                if (cat === "地代家賃") {
                    initial.rentCost += amt;
                } else if (cat === "給与・手当" || cat === "外注費") {
                    initial.laborCost += amt;
                } else if (cat === "水道光熱費") {
                    initial.utilityCost += amt;
                } else if (cat === "通信費") {
                    initial.communicationCost += amt;
                } else if (cat === "諸会費・サブスク") {
                    initial.softwareCost += amt;
                } else if (cat === "交通費") {
                    initial.vehicleCost += amt;
                } else {
                    initial.otherFixedCost += amt;
                }
            });

            setFormData(initial);
            showNotification(`基本設定のテンプレートから初期値を読み込みました`, "info");
            setLoadedMonth(targetMonth);
        }
    }, [targetMonth, fixedCosts, isLoaded, loadedMonth, companySettings]);

    // Live total fixed costs calculation
    const totalFixedCost = useMemo(() => {
        return (
            formData.rentCost +
            formData.laborCost +
            formData.utilityCost +
            formData.communicationCost +
            formData.vehicleCost +
            formData.softwareCost +
            formData.otherFixedCost
        );
    }, [formData]);

    // Dynamic cost items configuration
    const costItems = [
        { key: "rentCost", label: "地代家賃・賃料 (店舗/工場/倉庫)", icon: Landmark, color: "text-blue-500 bg-blue-50" },
        { key: "laborCost", label: "正社員給与・固定労務費 (基本人件費)", icon: Users, color: "text-emerald-500 bg-emerald-50" },
        { key: "utilityCost", label: "水道光熱費 (電気・水道・ガスなど)", icon: Zap, color: "text-amber-500 bg-amber-50" },
        { key: "communicationCost", label: "通信費・ネット利用料", icon: Wifi, color: "text-purple-500 bg-purple-50" },
        { key: "vehicleCost", label: "車両費・運搬具リース・保険料", icon: Truck, color: "text-orange-500 bg-orange-50" },
        { key: "softwareCost", label: "ソフトウェア利用料 (POS・会計・SaaS)", icon: Monitor, color: "text-indigo-500 bg-indigo-50" },
        { key: "otherFixedCost", label: "その他固定費・諸経費", icon: BarChart3, color: "text-slate-500 bg-slate-100" }
    ];

    const handleResetToTemplates = () => {
        const templates = companySettings?.fixedCostTemplates && companySettings.fixedCostTemplates.length > 0
            ? companySettings.fixedCostTemplates
            : DEFAULT_TEMPLATES;
        
        const initial = {
            rentCost: 0,
            laborCost: 0,
            utilityCost: 0,
            communicationCost: 0,
            vehicleCost: 0,
            softwareCost: 0,
            otherFixedCost: 0
        };

        templates.forEach(item => {
            if (!item.enabled) return;
            const cat = item.category;
            const amt = item.amount || 0;
            
            if (cat === "地代家賃") {
                initial.rentCost += amt;
            } else if (cat === "給与・手当" || cat === "外注費") {
                initial.laborCost += amt;
            } else if (cat === "水道光熱費") {
                initial.utilityCost += amt;
            } else if (cat === "通信費") {
                initial.communicationCost += amt;
            } else if (cat === "諸会費・サブスク") {
                initial.softwareCost += amt;
            } else if (cat === "交通費") {
                initial.vehicleCost += amt;
            } else {
                initial.otherFixedCost += amt;
            }
        });

        setFormData(initial);
        showNotification("基本設定のテンプレート値にリセットしました。保存するまで変更は確定されません。", "success");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await saveFixedCosts({
                id: targetMonth,
                targetMonth: targetMonth,
                rentCost: formData.rentCost,
                laborCost: formData.laborCost,
                utilityCost: formData.utilityCost,
                communicationCost: formData.communicationCost,
                vehicleCost: formData.vehicleCost,
                softwareCost: formData.softwareCost,
                otherFixedCost: formData.otherFixedCost,
                totalFixedCost: totalFixedCost
            });
            showNotification(`${targetMonth}の固定費を保存しました`, "success");
        } catch (err: any) {
            console.error("Failed to save fixed costs:", err);
            showNotification("固定費の保存に失敗しました: " + err.message, "error");
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Coins className="w-6 h-6 text-[#1e3a8a]" />
                        毎月の固定費管理
                    </h1>
                    <p className="text-slate-500 text-xs mt-1">
                        家賃、正社員給与、光熱費、ソフトウェア代など、生産量に依存せず毎月定常的に発生する固定費 (F) を登録します。
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                        type="month"
                        required
                        value={targetMonth}
                        onChange={(e) => setTargetMonth(e.target.value)}
                        className="py-2.5 px-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-slate-800 bg-white cursor-pointer"
                    />
                </div>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form column */}
                <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            {targetMonth}度 固定経費入力
                        </h3>
                        {fixedCosts.some(c => c.id === targetMonth) && (
                            <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-full border border-indigo-150">
                                登録済みレコードの編集
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {costItems.map((item) => {
                            const IconComponent = item.icon;
                            return (
                                <div key={item.key} className="space-y-2 p-4 bg-slate-50/50 rounded-xl border border-slate-150/40">
                                    <label className="text-xs font-bold text-slate-700 block flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${item.color}`}>
                                            <IconComponent className="w-3.5 h-3.5" />
                                        </div>
                                        {item.label}
                                    </label>
                                    <NumberInput
                                        min={0}
                                        value={(formData as any)[item.key]}
                                        onChange={(val) => setFormData({ ...formData, [item.key]: val ?? 0 })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-right text-sm font-semibold bg-white"
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end pt-4 gap-3 flex-wrap">
                        <button
                            type="button"
                            onClick={handleResetToTemplates}
                            className="px-6 py-3.5 border border-slate-200 text-slate-600 hover:text-[#1e3a8a] hover:bg-blue-50/20 font-black text-xs rounded-xl transition-all flex items-center gap-2"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            基本設定のテンプレートから値を呼び出す
                        </button>
                        <button
                            type="submit"
                            className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center gap-2 hover:scale-[1.02] active:scale-95"
                        >
                            <Save className="w-4 h-4" />
                            {targetMonth}度の固定費を保存する
                        </button>
                    </div>
                </form>

                {/* Sidebar column */}
                <div className="space-y-6">
                    {/* Sum Card */}
                    <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
                        <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase block">
                            固定費回収状況シミュレータ
                        </span>

                        <div className="space-y-2">
                            <span className="text-xs text-slate-400 block font-bold">合計固定費 (F)</span>
                            <span className="text-3xl font-black text-white block tracking-tight">
                                ¥{totalFixedCost.toLocaleString()}
                            </span>
                        </div>

                        {/* Interactive allocation preview */}
                        {totalFixedCost > 0 && (
                            <div className="space-y-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">経費ポートフォリオ</span>
                                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                                    {costItems.map((item) => {
                                        const val = (formData as any)[item.key];
                                        const pct = (val / totalFixedCost) * 100;
                                        if (pct === 0) return null;
                                        let bgClass = "bg-slate-400";
                                        if (item.key === "rentCost") bgClass = "bg-blue-500";
                                        if (item.key === "laborCost") bgClass = "bg-emerald-500";
                                        if (item.key === "utilityCost") bgClass = "bg-amber-500";
                                        if (item.key === "communicationCost") bgClass = "bg-purple-500";
                                        if (item.key === "vehicleCost") bgClass = "bg-orange-500";
                                        if (item.key === "softwareCost") bgClass = "bg-indigo-500";
                                        return (
                                            <div 
                                                key={item.key} 
                                                className={`h-full ${bgClass} transition-all`} 
                                                style={{ width: `${pct}%` }} 
                                                title={`${item.label}: ${pct.toFixed(1)}%`}
                                            />
                                        );
                                    })}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400 font-bold">
                                    {costItems.map((item) => {
                                        const val = (formData as any)[item.key];
                                        if (val === 0) return null;
                                        return (
                                            <div key={item.key} className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    item.key === "rentCost" ? "bg-blue-500" :
                                                    item.key === "laborCost" ? "bg-emerald-500" :
                                                    item.key === "utilityCost" ? "bg-amber-500" :
                                                    item.key === "communicationCost" ? "bg-purple-500" :
                                                    item.key === "vehicleCost" ? "bg-orange-500" :
                                                    item.key === "softwareCost" ? "bg-indigo-500" :
                                                    "bg-slate-400"
                                                }`} />
                                                <span className="truncate">{item.label.split(" (")[0]}: {((val / totalFixedCost) * 100).toFixed(0)}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 flex gap-2.5 items-start">
                            <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                            <div className="text-[10px] text-slate-400 leading-relaxed">
                                <span className="font-bold text-slate-300 block mb-1">MQ会計の思想</span>
                                固定費は、売上や製造工数に一切関係なく発生するコストです。月次の限界利益（MQ）がこの固定費額を上回ったとき、初めて会社の「営業利益」が誕生します。
                            </div>
                        </div>
                    </div>

                    {/* Historical Logs List */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-600" />
                            過去の固定費一覧
                        </h3>
                        {fixedCosts.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">過去の固定費データはありません。</p>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {fixedCosts.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setTargetMonth(c.id)}
                                        className="w-full py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors px-2 rounded-lg"
                                    >
                                        <div>
                                            <span className="text-xs font-black text-slate-800">{c.targetMonth}</span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5">
                                                家賃: ¥{c.rentCost.toLocaleString()} / 人件費: ¥{c.laborCost.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-black text-indigo-600">
                                                ¥{c.totalFixedCost.toLocaleString()}
                                            </span>
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
