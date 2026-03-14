"use client";

import { useState } from "react";
import { ArrowRight, History, Box, Plus, Save, ChevronLeft, AlertCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { showNotification } from "@/lib/notifications";
import { NumberInput } from "@/components/NumberInput";
import Link from "next/link";

export default function StockConversionPage() {
    const { products, addStockConversion, stockConversions, isLoaded } = useStore();
    const [inputProductId, setInputProductId] = useState("");
    const [outputProductId, setOutputProductId] = useState("");
    const [inputQty, setInputQty] = useState(0);
    const [outputQty, setOutputQty] = useState(0);
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            await addStockConversion({
                date: new Date().toISOString().split("T")[0],
                inputProductId,
                inputQty,
                outputProductId,
                outputQty,
                notes
            });

            showNotification("在庫変換を記録しました。在庫が更新されました。");
            setInputProductId("");
            setOutputProductId("");
            setInputQty(0);
            setOutputQty(0);
            setNotes("");
        } catch (error) {
            console.error("Conversion error:", error);
            showNotification("エラーが発生しました。", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="mb-8 flex items-center gap-4">
                <Link
                    href="/products"
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">在庫変換・加工記録</h1>
                    <p className="text-slate-500 text-sm mt-1">原料から製品への変換や、小分け作業を記録します。</p>
                </div>
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
                                        {products.map(p => (
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
                                        {products.map(p => (
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
                            {[...stockConversions].sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()).map((conv) => {
                                const inputP = products.find(p => p.id === conv.inputProductId);
                                const outputP = products.find(p => p.id === conv.outputProductId);
                                return (
                                    <div key={conv.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                                        <div className="flex justify-between items-start text-[10px] text-slate-400 font-medium">
                                            <span>{conv.date}</span>
                                            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-sm">加工</span>
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
                            {stockConversions.length === 0 && (
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
