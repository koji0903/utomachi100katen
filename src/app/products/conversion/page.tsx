"use client";

import { useState, useMemo } from "react";
import { ArrowRight, History, Box, Plus, Save, ChevronLeft, AlertCircle, Layers, Clock, User, Sparkles, Store, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { showNotification } from "@/lib/notifications";
import { NumberInput } from "@/components/NumberInput";
import Link from "next/link";

export default function StockConversionPage() {
    const { products, addStockConversion, deleteStockConversion, stockConversions, addWorkLog, isLoaded } = useStore();
    const [inputProductId, setInputProductId] = useState("");
    const [outputProductId, setOutputProductId] = useState("");
    const [inputQty, setInputQty] = useState(0);
    const [outputQty, setOutputQty] = useState(0);
    const [notes, setNotes] = useState("");
    const [recordWorkLog, setRecordWorkLog] = useState(true);
    const [workMinutes, setWorkMinutes] = useState<number>(0);
    const [workerName, setWorkerName] = useState("製造担当 A");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const activeConversions = useMemo(() => {
        return stockConversions.filter((record: any) => !record.isTrashed).sort((a, b) => {
            const timeA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt as string).getTime() : 0) || 0;
            const timeB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt as string).getTime() : 0) || 0;
            return timeB - timeA;
        });
    }, [stockConversions]);

    if (!isLoaded) return <div className="p-8 text-slate-500">読み込み中...</div>;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputProductId || !outputProductId || inputQty <= 0 || outputQty <= 0) {
            showNotification("すべての項目を正しく入力してください。", "error");
            return;
        }

        if (inputProductId === outputProductId) {
            showNotification("変換元と変換先には異なる商品を選択してください。", "error");
            return;
        }

        const inputProduct = products.find(p => p.id === inputProductId);
        if (!inputProduct || inputProduct.stock < inputQty) {
            showNotification("変換元の在庫が不足しています。", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const today = new Date().toISOString().split("T")[0];
            await addStockConversion({
                date: today,
                inputProductId,
                inputQty,
                outputProductId,
                outputQty,
                notes
            });

            let workLogMsg = "";
            if (recordWorkLog && workMinutes >= 1) {
                const outputProduct = products.find(p => p.id === outputProductId);
                const HOURLY_LABOR_WAGE = 1200;
                const MINUTE_LABOR_WAGE = 20;
                const s = outputProduct?.standardSellingPrice || outputProduct?.sellingPrice || 0;
                const v = outputProduct?.standardVariableCost || outputProduct?.costPrice || 0;
                const totalMq = (s - v) * outputQty;
                const estLaborCost = workMinutes * MINUTE_LABOR_WAGE;
                const sessionMqPerHour = Math.round(totalMq / (workMinutes / 60));
                const isProfitable = sessionMqPerHour >= HOURLY_LABOR_WAGE;

                await addWorkLog({
                    workDate: today,
                    workerName: workerName.trim() || "製造担当",
                    workType: "包装",
                    workMinutes,
                    relatedProductId: outputProductId,
                    relatedProductName: outputProduct?.name || "不明な商品",
                    producedQuantity: outputQty,
                    workMemo: notes || `在庫変換（${inputProduct.name} ${inputQty} → ${outputProduct?.name || ""} ${outputQty}）と同時記録`,
                    laborCost: estLaborCost,
                    efficiencyRating: isProfitable ? "excellent" : "caution"
                });
                workLogMsg = `（製造工数 ${workMinutes}分も同時に記録しました）`;
            }

            showNotification(`在庫変換を記録しました。在庫が更新されました。${workLogMsg}`);
            setInputProductId("");
            setOutputProductId("");
            setInputQty(0);
            setOutputQty(0);
            setWorkMinutes(0);
            setNotes("");
        } catch (error) {
            console.error("Conversion error:", error);
            showNotification("エラーが発生しました。", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
            {/* 業務導線クイックハブ */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide border-b border-slate-200/80">
                <Link
                    href="/inventory"
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                    <Store className="w-3.5 h-3.5 text-slate-500" /> 在庫管理
                </Link>
                <Link
                    href="/products/composite-production"
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                    <Sparkles className="w-3.5 h-3.5 text-slate-500" /> セット商品制作
                </Link>
                <Link
                    href="/products/conversion"
                    className="px-4 py-2 bg-[#1e3a8a] text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-2 whitespace-nowrap"
                >
                    <Layers className="w-3.5 h-3.5" /> 小分け・在庫変換
                </Link>
                <Link
                    href="/work-logs"
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                    <Clock className="w-3.5 h-3.5 text-slate-500" /> 製造工数記録
                </Link>
                <Link
                    href="/products"
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                    <Box className="w-3.5 h-3.5 text-slate-500" /> 商品マスタ
                </Link>
            </div>

            <div className="mb-8 flex items-center gap-4">
                <Link
                    href="/inventory"
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">在庫変換・加工記録</h1>
                    <p className="text-slate-500 text-sm mt-1">原料から製品への変換や、小分け作業と製造工数を一括で記録します。</p>
                </div>
            </div>

            <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div className="text-sm">
                        <p className="font-bold text-orange-900">組み合わせ商品の制作はこちら</p>
                        <p className="text-orange-700/70 text-xs">登録済みのBOM（構成表）に基づいて在庫を引き落とす場合は、制作画面が便利です。</p>
                    </div>
                </div>
                <Link
                    href="/products/composite-production"
                    className="px-4 py-2 bg-white border border-orange-200 text-orange-700 text-xs font-bold rounded-xl hover:bg-orange-100 transition-all shadow-sm shrink-0"
                >
                    制作画面へ
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Conversion Form */}
                <div className="md:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <Box className="w-5 h-5 text-blue-600" />
                                変換の実行
                            </h2>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-600">変換元（原料）</label>
                                    <select
                                        required
                                        value={inputProductId}
                                        onChange={(e) => setInputProductId(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50"
                                    >
                                        <option value="">商品を選択</option>
                                        {products.filter(p => !p.isTrashed).map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} {p.variantName} (在庫: {p.stock})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-600">使用量</label>
                                    <div className="relative">
                                        <NumberInput
                                            value={inputQty}
                                            onChange={(val) => setInputQty(val || 0)}
                                            fallbackValue={0}
                                            min={0}
                                            className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                                            placeholder="数量"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">個/kg</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <div className="p-2 bg-blue-50 rounded-full">
                                    <ArrowRight className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-600">変換先（製品）</label>
                                    <select
                                        required
                                        value={outputProductId}
                                        onChange={(e) => setOutputProductId(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all bg-slate-50"
                                    >
                                        <option value="">商品を選択</option>
                                        {products.filter(p => !p.isTrashed).map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} {p.variantName} (在庫: {p.stock})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-600">生成量</label>
                                    <div className="relative">
                                        <NumberInput
                                            value={outputQty}
                                            onChange={(val) => setOutputQty(val || 0)}
                                            fallbackValue={0}
                                            min={0}
                                            className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-bold"
                                            placeholder="数量"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">個/kg</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="text-sm font-semibold text-slate-600">備考・メモ</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                                    rows={2}
                                    placeholder="精米作業、小分けパック詰めなど..."
                                />
                            </div>

                            {/* 製造工数（作業時間）の同時記録セクション */}
                            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="flex items-center gap-2 text-xs font-black text-indigo-900">
                                        <Clock className="w-4 h-4 text-indigo-600" />
                                        作業時間・担当者（製造工数として同時記録）
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={recordWorkLog}
                                        onChange={(e) => setRecordWorkLog(e.target.checked)}
                                        className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </label>
                                {recordWorkLog && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-100/80 animate-in fade-in duration-200">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                                作業時間（分） <span className="text-[10px] font-normal text-slate-400">※1分以上で記録</span>
                                            </label>
                                            <div className="relative">
                                                <NumberInput
                                                    value={workMinutes}
                                                    onChange={(val) => setWorkMinutes(val ?? 0)}
                                                    fallbackValue={0}
                                                    min={0}
                                                    className="w-full pl-3.5 pr-9 py-2 bg-white border border-indigo-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    placeholder="例: 20"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">分</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                                <User className="w-3.5 h-3.5 text-indigo-500" />
                                                担当者名
                                            </label>
                                            <input
                                                type="text"
                                                value={workerName}
                                                onChange={(e) => setWorkerName(e.target.value)}
                                                className="w-full px-3.5 py-2 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                placeholder="例: 製造担当 A"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex items-center justify-center gap-2 bg-[#1e3a8a] text-white py-3.5 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                {isSubmitting ? "実行中..." : "在庫変換を実行・記録する"}
                            </button>
                        </div>
                    </form>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-900 leading-relaxed">
                            <span className="font-bold block mb-1">注意点</span>
                            在庫変換を実行すると、即座に商品の在庫数に反映されます。
                            原料と製品の重量差（目減り）がある場合でも、入力された通りの数量が加減算されます。
                        </div>
                    </div>
                </div>

                {/* Conversion History */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
                        <div className="p-5 border-b border-slate-100 flex items-center gap-2 shrink-0">
                            <History className="w-5 h-5 text-slate-400" />
                            <h2 className="font-bold text-slate-800">最近の記録</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {activeConversions.map((conv) => {
                                const inputP = products.find(p => p.id === conv.inputProductId);
                                const outputP = products.find(p => p.id === conv.outputProductId);
                                return (
                                    <div key={conv.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                                            <span>{conv.date}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-sm">加工</span>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (!window.confirm(`「${inputP?.name || "変換元"} (-${conv.inputQty}) → ${outputP?.name || "変換先"} (+${conv.outputQty})」の変換記録を取り消し、在庫を元に戻しますか？`)) return;
                                                        try {
                                                            await deleteStockConversion(conv.id);
                                                            showNotification("在庫変換記録を取り消し、在庫をロールバックしました。");
                                                        } catch (err) {
                                                            console.error(err);
                                                            showNotification("取消処理に失敗しました。", "error");
                                                        }
                                                    }}
                                                    title="この変換記録を取り消して在庫を元に戻す"
                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs font-semibold text-slate-700 leading-tight">
                                            <div className="flex items-center gap-2">
                                                <span className="text-red-500">-{conv.inputQty}</span>
                                                <span className="truncate">{inputP?.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-green-500">+{conv.outputQty}</span>
                                                <span className="truncate">{outputP?.name}</span>
                                            </div>
                                        </div>
                                        {conv.notes && (
                                            <div className="text-[11px] text-slate-500 italic mt-1 bg-white/50 p-1.5 rounded">
                                                {conv.notes}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {activeConversions.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-12">
                                    <p>記録はありません</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
