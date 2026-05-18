"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
    Plus, ArrowLeft, Search, Filter, 
    TrendingUp, Coins, Package, Truck, Percent, 
    ShoppingBag, Calendar, User, ShoppingCart, 
    AlertTriangle, CheckCircle, Edit2 
} from "lucide-react";
import { useStore } from "@/lib/store";
import { NumberInput } from "@/components/NumberInput";
import { showNotification } from "@/lib/notifications";

const getTimestampString = (val: any): string => {
    if (!val) return "";
    if (typeof val === "string") return val;
    if (typeof val.toDate === "function") {
        try {
            return val.toDate().toISOString();
        } catch (e) {}
    }
    if (val.seconds !== undefined) {
        return new Date(val.seconds * 1000).toISOString();
    }
    if (val instanceof Date) {
        return val.toISOString();
    }
    return String(val);
};

export default function OrdersPage() {
    const { 
        unifiedSales = [], 
        products = [], 
        retailStores = [], 
        spotRecipients = [], 
        updateSale
    } = useStore();

    // UI state
    const [searchQuery, setSearchQuery] = useState("");
    const [channelFilter, setChannelFilter] = useState("all");

    // Modal state for in-context MQ variable tuning
    const [selectedSaleForMqEdit, setSelectedSaleForMqEdit] = useState<any | null>(null);
    const [editMqChannel, setEditMqChannel] = useState("店頭販売");
    const [editMqShipping, setEditMqShipping] = useState(0);
    const [editMqPlatform, setEditMqPlatform] = useState(0);
    const [editMqPackaging, setEditMqPackaging] = useState(0);
    const [isSavingMq, setIsSavingMq] = useState(false);

    // Sales channel list
    const salesChannels = ["店頭販売", "ECサイト", "卸販売", "ふるさと納税", "その他"];

    // Compute dynamic MQ fields for all actual sales from unifiedSales
    const computedSales = useMemo(() => {
        return (unifiedSales || []).map(sale => {
            let itemsGrossAmount = 0;
            let itemsTotalVarCost = 0;
            let itemsTotalQty = 0;

            const calculatedItems = (sale.items || []).map(item => {
                const product = products.find(p => p.id === item.productId);
                const stdSelling = product?.standardSellingPrice || product?.sellingPrice || 0;
                const stdVarCost = product?.standardVariableCost || product?.costPrice || 0;

                const price = item.priceAtSale || stdSelling;
                const qty = item.quantity || 0;
                const subtotal = item.subtotal || (qty * price);
                const itemVarCost = qty * stdVarCost;
                const itemMq = subtotal - itemVarCost;
                const itemMqRate = subtotal > 0 ? parseFloat(((itemMq / subtotal) * 100).toFixed(1)) : 0;

                itemsGrossAmount += subtotal;
                itemsTotalVarCost += itemVarCost;
                itemsTotalQty += qty;

                return {
                    ...item,
                    productName: item.productName || product?.name || "未選択の商品",
                    subtotal,
                    variableCostAmount: itemVarCost,
                    mqAmount: itemMq,
                    mqRate: itemMqRate
                };
            });

            // Commission, shipping, packaging acts as variable costs in MQ accounting
            const commission = sale.totalCommission || 0;
            const shipping = sale.shippingCost || 0;
            const platform = sale.platformFee || 0;
            const packaging = sale.packagingCost || 0;

            // Heuristic to derive sales channel if not explicitly stored
            let derivedChannel = sale.salesChannel;
            if (!derivedChannel) {
                if ((sale as any).isInvoice) {
                    derivedChannel = "卸販売";
                } else {
                    const store = retailStores.find(st => st.id === sale.storeId);
                    if (store) {
                        if (store.type === 'B') derivedChannel = "卸販売";
                        else if (store.type === 'C') derivedChannel = "店頭販売";
                        else derivedChannel = "店頭販売";
                    } else if (sale.recipientType === 'spot') {
                        derivedChannel = "卸販売";
                    } else {
                        derivedChannel = "店頭販売";
                    }
                }
            }

            const totalSales = sale.totalAmount || itemsGrossAmount;
            const totalVariableCost = itemsTotalVarCost + commission + shipping + platform + packaging;
            const overallMq = totalSales - totalVariableCost;
            const overallMqRate = totalSales > 0 ? parseFloat(((overallMq / totalSales) * 100).toFixed(1)) : 0;

            return {
                ...sale,
                items: calculatedItems,
                totalQuantity: itemsTotalQty || sale.totalQuantity || 0,
                totalAmount: totalSales,
                totalCommission: commission,
                salesChannel: derivedChannel,
                shippingCost: shipping,
                platformFee: platform,
                packagingCost: packaging,
                variableCostAmount: totalVariableCost,
                mqAmount: overallMq,
                mqRate: overallMqRate
            };
        });
    }, [unifiedSales, products, retailStores]);

    // Filter sales list to display
    const filteredSales = useMemo(() => {
        return computedSales.filter(s => {
            const matchesSearch = s.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (s.customerId && s.customerId.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (s.storeName && s.storeName.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const matchesChannel = channelFilter === "all" || s.salesChannel === channelFilter;
            return matchesSearch && matchesChannel;
        }).sort((a, b) => {
            const periodCompare = b.period.localeCompare(a.period);
            if (periodCompare !== 0) return periodCompare;
            
            // Stable secondary sort: by creation/update timestamp descending
            const bTime = getTimestampString((b as any).createdAt || (b as any).updatedAt);
            const aTime = getTimestampString((a as any).createdAt || (a as any).updatedAt);
            return bTime.localeCompare(aTime) || b.id.localeCompare(a.id);
        });
    }, [computedSales, searchQuery, channelFilter]);

    const handleOpenMqEdit = (sale: any) => {
        setSelectedSaleForMqEdit(sale);
        setEditMqChannel(sale.salesChannel || "店頭販売");
        setEditMqShipping(sale.shippingCost || 0);
        setEditMqPlatform(sale.platformFee || 0);
        setEditMqPackaging(sale.packagingCost || 0);
    };

    const handleSaveMqMetadata = async () => {
        if (!selectedSaleForMqEdit) return;
        setIsSavingMq(true);
        try {
            await updateSale(selectedSaleForMqEdit.id, {
                salesChannel: editMqChannel,
                shippingCost: editMqShipping,
                platformFee: editMqPlatform,
                packagingCost: editMqPackaging
            });
            showNotification("MQ変動費情報を更新しました！", "success");
            setSelectedSaleForMqEdit(null);
        } catch (err: any) {
            console.error("Failed to update MQ metadata:", err);
            showNotification("更新に失敗しました: " + err.message, "error");
        } finally {
            setIsSavingMq(false);
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header section with glassmorphism */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <ShoppingBag className="w-6 h-6 text-[#1e3a8a]" />
                        注文・販路MQ管理
                    </h1>
                    <p className="text-slate-500 text-xs mt-1">
                        売上管理ページの全実データと連動し、商品の売上、配送料、各種変動費を分解して真の付加価値（MQ）をリアルタイムに計算します。
                    </p>
                </div>
                <div>
                    <Link
                        href="/sales"
                        className="w-full md:w-auto px-6 py-3 bg-[#1e3a8a] text-white font-black text-sm rounded-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-95 text-center"
                    >
                        <Plus className="w-4 h-4" />
                        新規売上・注文登録へ
                    </Link>
                </div>
            </div>

            <div className="space-y-6">
                {/* Analytics Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">総受注件数</span>
                            <span className="text-lg font-black text-slate-800">{filteredSales.length} 件</span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">総売上額</span>
                            <span className="text-lg font-black text-emerald-600">
                                ¥{filteredSales.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <Coins className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">総変動費</span>
                            <span className="text-lg font-black text-amber-600">
                                ¥{filteredSales.reduce((acc, curr) => acc + (curr.variableCostAmount || 0), 0).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Coins className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">総MQ (付加価値)</span>
                            <span className="text-lg font-black text-indigo-600">
                                ¥{filteredSales.reduce((acc, curr) => acc + (curr.mqAmount || 0), 0).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 col-span-2 lg:col-span-1">
                        <div className="p-3 bg-pink-50 text-pink-600 rounded-xl">
                            <Percent className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">平均MQ率</span>
                            <span className="text-lg font-black text-pink-600">
                                {(() => {
                                    const tS = filteredSales.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
                                    const tM = filteredSales.reduce((acc, curr) => acc + (curr.mqAmount || 0), 0);
                                    return tS > 0 ? ((tM / tS) * 100).toFixed(1) : "0.0";
                                })()}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="注文IDや顧客名で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={channelFilter}
                            onChange={(e) => setChannelFilter(e.target.value)}
                            className="flex-1 sm:flex-none py-2 px-4 border border-slate-200 rounded-xl focus:outline-none text-sm bg-white cursor-pointer"
                        >
                            <option value="all">すべての販路</option>
                            {salesChannels.map(ch => (
                                <option key={ch} value={ch}>{ch}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Orders Table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {filteredSales.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                            <p className="text-sm font-bold">売上・注文データが見つかりません</p>
                            <p className="text-xs mt-1">「売上管理」ページからデータを登録するか、検索・フィルター条件を変更してください。</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <th className="py-4 px-6">日付 / 注文ID</th>
                                        <th className="py-4 px-6">顧客 / 販路</th>
                                        <th className="py-4 px-6">注文内訳</th>
                                        <th className="py-4 px-6 text-right">売上総額</th>
                                        <th className="py-4 px-6 text-right">MQ額 (MQ率)</th>
                                        <th className="py-4 px-6 text-center">ステータス</th>
                                        <th className="py-4 px-6 text-center">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {filteredSales.map((sale, idx) => (
                                        <tr key={`${sale.id}-${sale.period}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-bold text-slate-800">{sale.period}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">ID: {sale.id.slice(0, 8)}...</div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                                    {sale.customerId === "一般消費者" 
                                                        ? "一般消費者" 
                                                        : (spotRecipients.find(r => r.id === sale.customerId)?.name || sale.customerId || "一般消費者")
                                                    }
                                                </div>
                                                <span className={`inline-block mt-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                                                    sale.salesChannel === "ECサイト" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                                                    sale.salesChannel === "店頭販売" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                                    sale.salesChannel === "卸販売" ? "bg-purple-50 text-purple-700 border border-purple-100" :
                                                    sale.salesChannel === "ふるさと納税" ? "bg-orange-50 text-orange-700 border border-orange-100" :
                                                    "bg-slate-50 text-slate-700 border border-slate-100"
                                                }`}>
                                                    {sale.salesChannel || "店頭販売"}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="space-y-1">
                                                    {(sale.items || []).map((item, idx) => (
                                                        <div key={idx} className="text-xs text-slate-500">
                                                            {item.productName || "不明な商品"} x {item.quantity}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-bold text-slate-800">
                                                ¥{(sale.totalAmount || 0).toLocaleString()}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="font-extrabold text-indigo-600">
                                                    ¥{(sale.mqAmount || 0).toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-bold">
                                                    ({sale.mqRate || 0}%)
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                                                    <CheckCircle className="w-3.5 h-3.5" /> 連動中
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenMqEdit(sale)}
                                                        className="p-1.5 bg-blue-50 text-[#1e3a8a] rounded-lg hover:bg-blue-100 transition-colors"
                                                        title="MQ変動費情報を調整"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <Link
                                                        href={`/sales?id=${sale.id}`}
                                                        className="p-1.5 bg-slate-50 text-slate-650 rounded-lg hover:bg-slate-100 transition-colors"
                                                        title="売上管理で数量・商品を編集"
                                                    >
                                                        <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* In-Context MQ Variable Edit Modal */}
            {selectedSaleForMqEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div 
                        className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-slate-900 text-white p-6 relative">
                            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                                <Coins className="w-5 h-5 text-amber-400" />
                                MQ・変動費の調整
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                {selectedSaleForMqEdit.period} - {selectedSaleForMqEdit.storeName || "不明な取引先"} (売上: ¥{selectedSaleForMqEdit.totalAmount?.toLocaleString()})
                            </p>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 block">販売チャネル (販路)</label>
                                <select
                                    value={editMqChannel}
                                    onChange={(e) => setEditMqChannel(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-white cursor-pointer"
                                >
                                    <option value="店頭販売">店頭販売</option>
                                    <option value="ECサイト">ECサイト</option>
                                    <option value="卸販売">卸販売</option>
                                    <option value="ふるさと納税">ふるさと納税</option>
                                    <option value="その他">その他</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                                        <Truck className="w-3.5 h-3.5 text-slate-400" /> 送料負担 (円)
                                    </label>
                                    <NumberInput
                                        min={0}
                                        value={editMqShipping}
                                        onChange={(val) => setEditMqShipping(val ?? 0)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-right text-sm"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                                        <Coins className="w-3.5 h-3.5 text-slate-400" /> 手数料等 (円)
                                    </label>
                                    <NumberInput
                                        min={0}
                                        value={editMqPlatform}
                                        onChange={(val) => setEditMqPlatform(val ?? 0)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-right text-sm"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                                        <Package className="w-3.5 h-3.5 text-slate-400" /> 梱包包材 (円)
                                    </label>
                                    <NumberInput
                                        min={0}
                                        value={editMqPackaging}
                                        onChange={(val) => setEditMqPackaging(val ?? 0)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-right text-sm"
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed space-y-1">
                                <div className="font-bold text-slate-700">💡 変動費・限界利益(MQ)会計のアドバイス:</div>
                                <p>配送料や梱包資材、ECサイトの決済手数料は、売上に比例して発生する「変動費」です。これらを正確に差し引くことで、真の付加価値である限界利益（MQ）が可視化されます。</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedSaleForMqEdit(null)}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveMqMetadata}
                                disabled={isSavingMq}
                                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-black text-xs rounded-xl transition-all shadow-sm flex items-center gap-1"
                            >
                                {isSavingMq ? "保存中..." : "変更を保存する"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
