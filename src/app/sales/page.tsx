"use client";

import { useState, useMemo, useEffect } from "react";
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Save,
    Store as StoreIcon,
    DollarSign,
    Percent,
    TrendingUp,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { useStore, Product, RetailStore } from "@/lib/store";

export default function SalesPage() {
    const { isLoaded, products, retailStores, addSale } = useStore();

    // Selection state
    const [selectedStoreId, setSelectedStoreId] = useState<string>("");
    const [inputMode, setInputMode] = useState<'daily' | 'monthly'>('daily');
    const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [targetMonth, setTargetMonth] = useState<string>(new Date().toISOString().slice(0, 7));

    // Sales data state: Record<{ productId: string, quantity: number }>
    const [salesData, setSalesData] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Reset sales data when store or period changes
    useEffect(() => {
        setSalesData({});
        setSaveSuccess(false);
    }, [selectedStoreId, targetDate, targetMonth, inputMode]);

    const selectedStore = useMemo(() =>
        retailStores.find(s => s.id === selectedStoreId), [retailStores, selectedStoreId]
    );

    const handleQuantityChange = (productId: string, value: string) => {
        const qty = parseInt(value) || 0;
        setSalesData(prev => ({
            ...prev,
            [productId]: Math.max(0, qty) // No negative numbers
        }));
    };

    const calculateRowDetails = (product: Product, quantity: number) => {
        // Get store-specific price if exists, otherwise use base selling price
        const storePriceObj = product.storePrices?.find(sp => sp.storeId === selectedStoreId);
        const price = (storePriceObj && storePriceObj.price > 0) ? storePriceObj.price : product.sellingPrice;

        const subtotal = price * quantity;
        const commissionRate = selectedStore?.commissionRate ?? 15;
        const commission = Math.floor(subtotal * (commissionRate / 100));
        const netProfit = subtotal - commission;

        return { price, subtotal, commission, netProfit };
    };

    const totals = useMemo(() => {
        let totalQty = 0;
        let totalAmt = 0;
        let totalComm = 0;
        let totalNet = 0;

        products.forEach(product => {
            const qty = salesData[product.id] || 0;
            if (qty > 0) {
                const { subtotal, commission, netProfit } = calculateRowDetails(product, qty);
                totalQty += qty;
                totalAmt += subtotal;
                totalComm += commission;
                totalNet += netProfit;
            }
        });

        return { totalQty, totalAmt, totalComm, totalNet };
    }, [products, salesData, selectedStoreId, selectedStore]);

    const handleSave = async () => {
        if (!selectedStoreId) return;
        if (totals.totalQty === 0) {
            alert("売上個数を入力してください。");
            return;
        }

        setIsSaving(true);
        try {
            const saleItems = products
                .filter(p => (salesData[p.id] || 0) > 0)
                .map(p => {
                    const qty = salesData[p.id];
                    const details = calculateRowDetails(p, qty);
                    return {
                        productId: p.id,
                        quantity: qty,
                        priceAtSale: details.price,
                        subtotal: details.subtotal,
                        commission: details.commission,
                        netProfit: details.netProfit
                    };
                });

            await addSale({
                storeId: selectedStoreId,
                type: inputMode,
                period: inputMode === 'daily' ? targetDate : targetMonth,
                items: saleItems,
                totalQuantity: totals.totalQty,
                totalAmount: totals.totalAmt,
                totalCommission: totals.totalComm,
                totalNetProfit: totals.totalNet
            });

            setSaveSuccess(true);
            setSalesData({});
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Save error:", error);
            alert("保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isLoaded) return <div className="p-8">読み込み中...</div>;

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">売上入力</h1>
                    <p className="text-slate-500 mt-1 text-sm">店舗ごとの売上実績を手打ちで一括登録します。</p>
                </div>
                {saveSuccess && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-100 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium text-sm">売上データを保存しました</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar: Selection & Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">販売店舗</label>
                            <select
                                value={selectedStoreId}
                                onChange={(e) => setSelectedStoreId(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 font-medium"
                            >
                                <option value="">店舗を選択してください</option>
                                {retailStores.map(store => (
                                    <option key={store.id} value={store.id}>{store.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">入力モード</label>
                            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => setInputMode('daily')}
                                    className={`py-2 text-xs font-bold rounded-lg transition-all ${inputMode === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    日次
                                </button>
                                <button
                                    onClick={() => setInputMode('monthly')}
                                    className={`py-2 text-xs font-bold rounded-lg transition-all ${inputMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    月次
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {inputMode === 'daily' ? '対象日' : '対象月'}
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    type={inputMode === 'daily' ? 'date' : 'month'}
                                    value={inputMode === 'daily' ? targetDate : targetMonth}
                                    onChange={(e) => inputMode === 'daily' ? setTargetDate(e.target.value) : setTargetMonth(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-900"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Totals Summary Card */}
                    <div className="bg-blue-600 rounded-2xl shadow-lg p-6 text-white space-y-6 overflow-hidden relative">
                        <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 pointer-events-none" />
                        <div className="relative z-10">
                            <div className="text-xs font-bold text-blue-100 uppercase tracking-wider mb-4">入力合計</div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-blue-200 text-sm">売上個数</span>
                                    <span className="text-xl font-bold">{totals.totalQty}<small className="ml-1 text-xs">個</small></span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-blue-200 text-sm">売上総額</span>
                                    <span className="text-xl font-bold">¥{totals.totalAmt.toLocaleString()}</span>
                                </div>
                                <div className="h-px bg-blue-500/50 my-2" />
                                <div className="flex justify-between items-baseline">
                                    <span className="text-blue-200 text-sm">店舗手数料 ({selectedStore?.commissionRate ?? 15}%)</span>
                                    <span className="text-lg font-semibold text-blue-100">-¥{totals.totalComm.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-baseline pt-2">
                                    <span className="text-white text-sm font-bold">入金見込額</span>
                                    <span className="text-2xl font-black">¥{totals.totalNet.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={!selectedStoreId || totals.totalQty === 0 || isSaving}
                            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-white text-blue-600 rounded-xl font-bold shadow-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all relative z-10"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            {isSaving ? "保存中..." : "データを保存する"}
                        </button>
                    </div>
                </div>

                {/* Main: Input Grid */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                        {!selectedStoreId ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-4">
                                <div className="p-4 bg-slate-50 rounded-full">
                                    <StoreIcon className="w-12 h-12 text-slate-200" />
                                </div>
                                <p className="font-medium">まずは販売店舗を選択してください</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <StoreIcon className="w-5 h-5 text-blue-500" />
                                            {selectedStore?.name}
                                        </h3>
                                        <div className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                            {products.length} 商品が登録されています
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto flex-1">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                <th className="px-6 py-4">商品名</th>
                                                <th className="px-6 py-4 text-right">単価 (税込)</th>
                                                <th className="px-6 py-4 text-center w-32">売上個数</th>
                                                <th className="px-6 py-4 text-right">小計</th>
                                                <th className="px-6 py-4 text-right">入金額 (純利)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {products.map(product => {
                                                const qty = salesData[product.id] || 0;
                                                const { price, subtotal, netProfit } = calculateRowDetails(product, qty);

                                                return (
                                                    <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{product.name}</div>
                                                            <div className="text-[10px] text-slate-400 mt-0.5">{product.id.slice(0, 8)}...</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="text-sm font-medium text-slate-600">¥{price.toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={salesData[product.id] ?? ""}
                                                                onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                                                className={`w-full px-3 py-2 text-center font-black rounded-lg border transition-all ${qty > 0 ? 'bg-blue-50 border-blue-200 text-blue-600 ring-2 ring-blue-500/10' : 'bg-white border-slate-200 text-slate-400 focus:border-blue-400 focus:text-slate-900'} focus:outline-none`}
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className={`text-sm font-bold ${qty > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                                                                ¥{subtotal.toLocaleString()}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className={`text-sm font-black ${qty > 0 ? 'text-blue-600' : 'text-slate-200'}`}>
                                                                ¥{netProfit.toLocaleString()}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
