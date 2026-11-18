"use client";

import { useState, useMemo } from "react";
import { ArrowRight, History, Box, Plus, Save, ChevronLeft, AlertCircle, Layers, Package, ArrowDown, Calculator, Clock, Sparkles, User, Store, RotateCcw } from "lucide-react";
import { useStore, CompositeProduction } from "@/lib/store";
import { showNotification } from "@/lib/notifications";
import { NumberInput } from "@/components/NumberInput";
import Link from "next/link";

export default function CompositeProductionPage() {
    const { products, addCompositeProduction, deleteCompositeProduction, compositeProductions, addWorkLog, isLoaded } = useStore();
    const [selectedProductId, setSelectedProductId] = useState("");
    const [productionQty, setProductionQty] = useState(0);
    const [notes, setNotes] = useState("");
    const [recordWorkLog, setRecordWorkLog] = useState(true);
    const [workMinutes, setWorkMinutes] = useState<number>(0);
    const [workerName, setWorkerName] = useState("製造担当 A");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 組み合わせ商品のみを抽出
    const compositeProducts = useMemo(() => {
        return products.filter(p => !p.isTrashed && p.isComposite && p.components && p.components.length > 0);
    }, [products]);

    // 選択された商品の詳細
    const selectedProduct = useMemo(() => {
        return compositeProducts.find(p => p.id === selectedProductId);
    }, [compositeProducts, selectedProductId]);

    // 最大制作可能数の計算
    const maxPossibleQty = useMemo(() => {
        if (!selectedProduct || !selectedProduct.components) return 0;
        
        const possibilities = selectedProduct.components.map(comp => {
            const compProduct = products.find(p => p.id === comp.productId);
            if (!compProduct) return 0;
            return Math.floor((compProduct.stock || 0) / comp.quantity);
        });

        return Math.min(...possibilities);
    }, [selectedProduct, products]);

    const activeProductions = useMemo(() => {
        return compositeProductions.filter(record => !record.isTrashed).sort((a, b) => {
            const timeA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt as string).getTime() : 0) || 0;
            const timeB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt as string).getTime() : 0) || 0;
            return timeB - timeA;
        });
    }, [compositeProductions]);

    if (!isLoaded) return <div className="p-8 text-slate-500 font-bold">読み込み中...</div>;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || productionQty <= 0) {
            showNotification("商品を選択し、数量を入力してください。", "error");
            return;
        }

        if (productionQty > maxPossibleQty) {
            if (!confirm(`構成商品の在庫が不足しています（最大制作可能数: ${maxPossibleQty}）。強行しますか？`)) {
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const today = new Date().toISOString().split("T")[0];
            const productionComponents = selectedProduct.components!.map(comp => {
                const compP = products.find(p => p.id === comp.productId);
                return {
                    productId: comp.productId,
                    productName: compP?.name || "不明な商品",
                    quantity: comp.quantity * productionQty
                };
            });

            await addCompositeProduction({
                date: today,
                productId: selectedProduct.id,
                productName: selectedProduct.name,
                quantity: productionQty,
                components: productionComponents,
                notes
            });

            let workLogMsg = "";
            if (recordWorkLog && workMinutes >= 1) {
                const HOURLY_LABOR_WAGE = 1200;
                const MINUTE_LABOR_WAGE = 20;
                const s = selectedProduct.standardSellingPrice || selectedProduct.sellingPrice || 0;
                const v = selectedProduct.standardVariableCost || selectedProduct.costPrice || 0;
                const totalMq = (s - v) * productionQty;
                const estLaborCost = workMinutes * MINUTE_LABOR_WAGE;
                const sessionMqPerHour = Math.round(totalMq / (workMinutes / 60));
                const isProfitable = sessionMqPerHour >= HOURLY_LABOR_WAGE;

                await addWorkLog({
                    workDate: today,
                    workerName: workerName.trim() || "製造担当",
                    workType: "製造",
                    workMinutes,
                    relatedProductId: selectedProduct.id,
                    relatedProductName: selectedProduct.name,
                    producedQuantity: productionQty,
                    workMemo: notes || "セット商品制作と同時記録",
                    laborCost: estLaborCost,
                    efficiencyRating: isProfitable ? "excellent" : "caution"
                });
                workLogMsg = `（製造工数 ${workMinutes}分も同時に記録しました）`;
            }

            showNotification(`${selectedProduct.name} を ${productionQty}個 制作しました。在庫が更新されました。${workLogMsg}`);
            setSelectedProductId("");
            setProductionQty(0);
            setWorkMinutes(0);
            setNotes("");
        } catch (error) {
            console.error("Production error:", error);
            showNotification("エラーが発生しました。", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
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
                    className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-2 whitespace-nowrap"
                >
                    <Sparkles className="w-3.5 h-3.5" /> セット商品制作
                </Link>
                <Link
                    href="/products/conversion"
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                    <Layers className="w-3.5 h-3.5 text-slate-500" /> 小分け・在庫変換
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
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Layers className="w-7 h-7 text-orange-500" />
                        組み合わせ商品の制作
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">セット商品や加工品の制作と在庫引き落とし・製造工数の記録を一括で行います。</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h2 className="font-black text-slate-800 flex items-center gap-2">
                                <Package className="w-5 h-5 text-[#1e3a8a]" />
                                制作指示
                            </h2>
                            <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-1 rounded-full uppercase tracking-wider">Composite Production</span>
                        </div>

                        <div className="p-6 space-y-8">
                            {/* Product Selection */}
                            <div className="space-y-4">
                                <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                                    制作する商品（セット品）
                                </label>
                                <select
                                    required
                                    value={selectedProductId}
                                    onChange={(e) => {
                                        setSelectedProductId(e.target.value);
                                        setProductionQty(0);
                                    }}
                                    className="w-full px-5 py-4 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#1e3a8a] transition-all bg-slate-50 text-lg font-bold"
                                >
                                    <option value="">商品を選択してください</option>
                                    {compositeProducts.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {p.variantName} (現在庫: {p.stock})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedProduct && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* BOM Preview */}
                                    <div className="bg-orange-50/50 rounded-2xl border border-orange-100 p-5 mb-8">
                                        <h3 className="text-xs font-black text-orange-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Calculator className="w-3.5 h-3.5" />
                                            構成商品（BOM）と必要量
                                        </h3>
                                        <div className="space-y-3">
                                            {selectedProduct.components?.map((comp, idx) => {
                                                const compP = products.find(p => p.id === comp.productId);
                                                const totalNeeded = comp.quantity * productionQty;
                                                const isShortage = compP ? compP.stock < totalNeeded : true;
                                                
                                                return (
                                                    <div key={idx} className="flex items-center justify-between bg-white/60 p-3 rounded-xl border border-orange-100/50">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-800">{compP?.name || "不明"}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold">1個あたり {comp.quantity}使用</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right">
                                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">現在庫</div>
                                                                <div className={`text-sm font-black ${compP && compP.stock < comp.quantity ? 'text-red-500' : 'text-slate-600'}`}>
                                                                    {compP?.stock || 0}
                                                                </div>
                                                            </div>
                                                            <div className="w-px h-8 bg-orange-100"></div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] font-black text-orange-700 uppercase tracking-tighter">必要数</div>
                                                                <div className={`text-sm font-black ${isShortage && productionQty > 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                                                    {totalNeeded}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-black text-slate-700">制作数量</label>
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                                    最大制作可能: {maxPossibleQty}個
                                                </span>
                                            </div>
                                            <div className="relative">
                                                <NumberInput
                                                    value={productionQty}
                                                    onChange={(val) => setProductionQty(val || 0)}
                                                    fallbackValue={0}
                                                    min={0}
                                                    className="w-full pl-6 pr-12 py-4 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all text-2xl font-black bg-green-50/10"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-black">個</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-sm font-black text-slate-700">備考・メモ</label>
                                            <textarea
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                className="w-full p-4 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#1e3a8a] transition-all resize-none h-[116px] text-sm font-medium bg-slate-50/50"
                                                placeholder="詰め合わせ作業、ギフト包装など..."
                                            />
                                        </div>
                                    </div>

                                    {/* 製造工数（作業時間）の同時記録セクション */}
                                    <div className="mt-6 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <span className="flex items-center gap-2 text-sm font-black text-indigo-900">
                                                <Clock className="w-4 h-4 text-indigo-600" />
                                                製造工数（作業時間）も同時に記録する
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={recordWorkLog}
                                                onChange={(e) => setRecordWorkLog(e.target.checked)}
                                                className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </label>
                                        {recordWorkLog && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-indigo-100/80 animate-in fade-in duration-200">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                                        作業時間（分） <span className="text-[10px] font-normal text-slate-400">※1分以上で工数記録</span>
                                                    </label>
                                                    <div className="relative">
                                                        <NumberInput
                                                            value={workMinutes}
                                                            onChange={(val) => setWorkMinutes(val ?? 0)}
                                                            fallbackValue={0}
                                                            min={0}
                                                            className="w-full pl-4 pr-10 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                            placeholder="例: 30"
                                                        />
                                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">分</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                        <User className="w-3.5 h-3.5 text-indigo-500" />
                                                        担当者名
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={workerName}
                                                        onChange={(e) => setWorkerName(e.target.value)}
                                                        className="w-full px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        placeholder="例: 製造担当 A"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!selectedProduct && (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-300 gap-4 border-2 border-dashed border-slate-100 rounded-3xl">
                                    <Layers className="w-12 h-12 opacity-20" />
                                    <p className="font-bold text-sm">制作する商品を選択してください</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedProduct || productionQty <= 0}
                                className="w-full flex items-center justify-center gap-3 bg-[#1e3a8a] text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-800 transition-all shadow-xl shadow-blue-900/10 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Save className="w-6 h-6" />
                                {isSubmitting ? "記録中..." : "制作を実行して在庫を更新する"}
                            </button>
                        </div>
                    </form>

                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-4">
                        <AlertCircle className="w-6 h-6 text-blue-600 shrink-0" />
                        <div className="text-sm text-blue-900 leading-relaxed font-medium">
                            <span className="font-black block mb-1">制作の仕組み</span>
                            この操作を行うと、完成品の在庫が増加し、構成商品の在庫が自動的に減少します。
                            構成商品の在庫が不足している場合でも実行可能ですが、マイナス在庫となりますのでご注意ください。
                        </div>
                    </div>
                </div>

                {/* History Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[700px]">
                        <div className="p-6 border-b border-slate-100 flex items-center gap-2 shrink-0">
                            <History className="w-5 h-5 text-slate-400" />
                            <h2 className="font-black text-slate-800">最近の制作記録</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {activeProductions.map((prod) => (
                                <div key={prod.id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3 hover:bg-white transition-all hover:shadow-md hover:border-blue-100 group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{prod.date}</span>
                                            <span className="text-sm font-black text-slate-800 mt-0.5 group-hover:text-[#1e3a8a] transition-colors">{prod.productName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-[10px] font-black">+{prod.quantity}</span>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!window.confirm(`「${prod.productName} (+${prod.quantity})」の制作記録を取り消し、完成品・構成部材の在庫を元に戻しますか？`)) return;
                                                    try {
                                                        await deleteCompositeProduction(prod.id);
                                                        showNotification("制作記録を取り消し、在庫をロールバックしました。");
                                                    } catch (err) {
                                                        console.error(err);
                                                        showNotification("取消処理に失敗しました。", "error");
                                                    }
                                                }}
                                                title="この制作記録を取り消して在庫を元に戻す"
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1.5 border-t border-slate-200/50 pt-3">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">使用部材</p>
                                        {prod.components.map((comp, ci) => (
                                            <div key={ci} className="flex justify-between text-[11px] font-bold text-slate-500">
                                                <span className="truncate flex-1 mr-2">{comp.productName}</span>
                                                <span className="text-red-500 shrink-0">-{comp.quantity}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {prod.notes && (
                                        <div className="text-[11px] text-slate-500 italic mt-2 bg-white p-2 rounded-xl border border-slate-100">
                                            {prod.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {activeProductions.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-12 gap-3">
                                    <Package className="w-10 h-10 opacity-10" />
                                    <p className="font-bold">制作記録はありません</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
