"use client";

import { useState, useMemo } from "react";
import { 
    Clock, Plus, Trash2, Calendar, User, 
    Box, Award, AlertTriangle, CheckCircle2, 
    Play, Activity, Sparkles, TrendingUp,
    ArrowLeft, Search
} from "lucide-react";
import { useStore, WorkLog } from "@/lib/store";
import { NumberInput } from "@/components/NumberInput";
import { showNotification } from "@/lib/notifications";

export default function WorkLogsPage() {
    const { 
        workLogs = [], 
        products = [], 
        addWorkLog, 
        deleteWorkLog 
    } = useStore();

    // UI state
    const [viewMode, setViewMode] = useState<"list" | "create">("list");
    const [searchQuery, setSearchQuery] = useState("");

    // Form state
    const defaultForm = {
        workDate: new Date().toISOString().split("T")[0],
        workerName: "製造担当 A",
        workType: "製造" as WorkLog["workType"],
        workMinutes: 60,
        relatedProductId: products[0]?.id || "",
        producedQuantity: 10
    };

    const [formData, setFormData] = useState(defaultForm);

    // List of work types mapping precisely to the enum
    const workTypes = ["製造", "包装", "ラベル貼り", "出荷", "配送", "仕入", "営業", "EC登録", "問い合わせ対応", "イベント販売", "その他"] as const;

    // Estimate hourly wage rate (Standard: ¥1,200/hr = ¥20/min)
    const HOURLY_LABOR_WAGE = 1200;
    const MINUTE_LABOR_WAGE = 20;

    // Filter work logs list
    const filteredLogs = useMemo(() => {
        return workLogs.filter(w => {
            const matchesSearch = w.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                w.workType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (w.relatedProductName && w.relatedProductName.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesSearch;
        }).sort((a, b) => b.workDate.localeCompare(a.workDate));
    }, [workLogs, searchQuery]);

    // Live calculations for the work log entry
    const logCalculation = useMemo(() => {
        const selectedProd = products.find(p => p.id === formData.relatedProductId);
        const s = selectedProd?.standardSellingPrice || selectedProd?.sellingPrice || 0;
        const v = selectedProd?.standardVariableCost || selectedProd?.costPrice || 0;
        
        // Standard marginal profit (MQ) per unit
        const unitMq = s - v;
        const totalMq = unitMq * formData.producedQuantity;

        // Estimated labor cost for this time block
        const estLaborCost = formData.workMinutes * MINUTE_LABOR_WAGE;

        // Real-time MQ produced per hour in this session
        const sessionMqPerHour = formData.workMinutes > 0 
            ? Math.round(totalMq / (formData.workMinutes / 60)) 
            : 0;

        // Recovery / Efficiency rating
        const isProfitable = sessionMqPerHour >= HOURLY_LABOR_WAGE;
        
        return {
            productName: selectedProd?.name || "未選択の商品",
            unitMq,
            totalMq,
            estLaborCost,
            sessionMqPerHour,
            isProfitable
        };
    }, [formData, products]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.relatedProductId) {
            showNotification("関連する商品を選択してください", "error");
            return;
        }

        const selectedProd = products.find(p => p.id === formData.relatedProductId);

        try {
            await addWorkLog({
                workDate: formData.workDate,
                workerName: formData.workerName,
                workType: formData.workType,
                workMinutes: formData.workMinutes,
                relatedProductId: formData.relatedProductId,
                relatedProductName: selectedProd?.name || "不明な商品",
                producedQuantity: formData.producedQuantity,
                laborCost: logCalculation.estLaborCost,
                efficiencyRating: logCalculation.isProfitable ? "excellent" : "caution"
            });

            showNotification("作業記録を保存しました", "success");
            setFormData(prev => ({
                ...prev,
                producedQuantity: 10,
                workMinutes: 60
            }));
            setViewMode("list");
        } catch (err: any) {
            console.error("Failed to add work log:", err);
            showNotification("作業記録の保存に失敗しました", "error");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("この作業記録を削除してもよろしいですか？")) {
            try {
                await deleteWorkLog(id);
                showNotification("作業記録を削除しました", "success");
            } catch (err) {
                showNotification("削除に失敗しました", "error");
            }
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header section with premium design */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Clock className="w-6 h-6 text-[#1e3a8a]" />
                        製造工数・労働MQ記録
                    </h1>
                    <p className="text-slate-500 text-xs mt-1">
                        誰が、何分間で、どの商品を何個製造したかを記録し、時間あたりの労働MQ（労働の付加価値回収率）を測定します。
                    </p>
                </div>
                <div>
                    {viewMode === "list" ? (
                        <button
                            onClick={() => setViewMode("create")}
                            className="w-full md:w-auto px-6 py-3 bg-[#1e3a8a] text-white font-black text-sm rounded-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            新規作業を記録
                        </button>
                    ) : (
                        <button
                            onClick={() => setViewMode("list")}
                            className="w-full md:w-auto px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            記録一覧に戻る
                        </button>
                    )}
                </div>
            </div>

            {/* List View */}
            {viewMode === "list" && (
                <div className="space-y-6">
                    {/* Performance Metrics Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">総製造工数</span>
                                <span className="text-lg font-black text-slate-800">
                                    {Math.round(workLogs.reduce((acc, curr) => acc + (curr.workMinutes || 0), 0) / 60)} 時間
                                </span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">人件費相当額</span>
                                <span className="text-lg font-black text-amber-600">
                                    ¥{workLogs.reduce((acc, curr) => acc + (curr.laborCost || 0), 0).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                <Award className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">工数回収成功率</span>
                                <span className="text-lg font-black text-emerald-600">
                                    {(() => {
                                        if (workLogs.length === 0) return "0.0";
                                        const successCount = workLogs.filter(w => w.efficiencyRating === "excellent").length;
                                        return ((successCount / workLogs.length) * 100).toFixed(1);
                                    })()}%
                                </span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">回収成功回数 / 総数</span>
                                <span className="text-lg font-black text-indigo-600">
                                    {workLogs.filter(w => w.efficiencyRating === "excellent").length} / {workLogs.length} 回
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Filters bar */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                        <div className="relative w-full max-w-xs">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="作業者名、商品名、作業タイプで検索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                            />
                        </div>
                    </div>

                    {/* Work Logs List Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {filteredLogs.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Activity className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                                <p className="text-sm font-bold">作業記録が見つかりません</p>
                                <p className="text-xs mt-1">「新規作業を記録」から、メンバーの製造工数を記録してください。</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                            <th className="py-4 px-6">日付</th>
                                            <th className="py-4 px-6">作業者 / 内容</th>
                                            <th className="py-4 px-6">製造商品</th>
                                            <th className="py-4 px-6 text-right">工数 (分)</th>
                                            <th className="py-4 px-6 text-right">見積人件費</th>
                                            <th className="py-4 px-6 text-center">MQ労働回収評価</th>
                                            <th className="py-4 px-6 text-center">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {filteredLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-4 px-6 font-bold text-slate-800">
                                                    {log.workDate}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="font-semibold text-slate-700">{log.workerName}</div>
                                                    <span className="inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 mt-1">
                                                        {log.workType}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="font-medium text-slate-800">{log.relatedProductName || "不明な商品"}</div>
                                                    {log.producedQuantity && (
                                                        <div className="text-xs text-slate-400 mt-0.5">成果数量: {log.producedQuantity} 個</div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-right font-bold text-slate-800">
                                                    {log.workMinutes} 分
                                                </td>
                                                <td className="py-4 px-6 text-right font-semibold text-amber-600">
                                                    ¥{(log.laborCost || 0).toLocaleString()}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    {log.efficiencyRating === "excellent" ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> 健全 (100%+)
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                                                            <AlertTriangle className="w-3.5 h-3.5" /> 回収アラーム
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <button
                                                        onClick={() => handleDelete(log.id)}
                                                        className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-100 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Work Log Form */}
            {viewMode === "create" && (
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                                製造作業記録入力
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 block">作業日</label>
                                    <div className="relative">
                                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="date"
                                            required
                                            value={formData.workDate}
                                            onChange={(e) => setFormData({ ...formData, workDate: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 block">作業メンバー名</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.workerName}
                                        onChange={(e) => setFormData({ ...formData, workerName: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                                        placeholder="例: 製造メンバー A"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 block">作業種別</label>
                                    <select
                                        value={formData.workType}
                                        onChange={(e) => setFormData({ ...formData, workType: e.target.value as WorkLog["workType"] })}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-white cursor-pointer"
                                    >
                                        {workTypes.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 block">製造対象商品</label>
                                    <select
                                        required
                                        value={formData.relatedProductId}
                                        onChange={(e) => setFormData({ ...formData, relatedProductId: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-white cursor-pointer"
                                    >
                                        <option value="" disabled>商品を選択してください</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} {p.variantName ? `(${p.variantName})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 block">作業工数 (分)</label>
                                    <NumberInput
                                        min={1}
                                        value={formData.workMinutes}
                                        onChange={(val) => setFormData({ ...formData, workMinutes: val ?? 60 })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-right text-sm font-bold bg-blue-50/20"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 block">成果数量 (製造個数 / パッケージ個数)</label>
                                    <NumberInput
                                        min={1}
                                        value={formData.producedQuantity}
                                        onChange={(val) => setFormData({ ...formData, producedQuantity: val ?? 10 })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-right text-sm font-bold bg-emerald-50/20"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview Alarm & Submit Column */}
                    <div className="space-y-6">
                        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6 sticky top-6">
                            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase block">
                                リアルタイム工数回収プレビュー
                            </span>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                                    <span className="text-xs font-bold text-slate-400">標準単価MQ</span>
                                    <span className="text-sm font-bold text-white">
                                        ¥{logCalculation.unitMq.toLocaleString()} / 個
                                    </span>
                                </div>

                                <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                                    <span className="text-xs font-bold text-slate-400">総創出MQ</span>
                                    <span className="text-sm font-bold text-emerald-400">
                                        ¥{logCalculation.totalMq.toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                                    <span className="text-xs font-bold text-slate-400">見積製造人件費</span>
                                    <span className="text-sm font-bold text-amber-400">
                                        ¥{logCalculation.estLaborCost.toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-xs font-black text-slate-300">時間あたり創出MQ</span>
                                    <span className="text-xl font-black text-indigo-400">
                                        ¥{logCalculation.sessionMqPerHour.toLocaleString()} / h
                                    </span>
                                </div>
                            </div>

                            {/* Efficiency alarms panel */}
                            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 space-y-3">
                                <div className="flex gap-2.5 items-start">
                                    {!logCalculation.isProfitable ? (
                                        <>
                                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                                            <div>
                                                <span className="text-xs font-bold text-amber-300 block">工数回収アラーム！</span>
                                                <span className="text-[10px] text-slate-400 leading-relaxed block">
                                                    時間あたり付加価値(¥{logCalculation.sessionMqPerHour.toLocaleString()}/h)が、製造人件費(¥{HOURLY_LABOR_WAGE}/h)を下回っています。作業工程の簡素化や、販売単価の見直しが必要です。
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-xs font-bold text-emerald-300 block">製造MQ回収 達成！</span>
                                                <span className="text-[10px] text-slate-400 leading-relaxed block">
                                                    労働価値を回収できています。非常に優れた労働MQ率(¥{logCalculation.sessionMqPerHour.toLocaleString()}/h)を維持しています。
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Play className="w-4 h-4" />
                                作業記録を確定・保存
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
}
