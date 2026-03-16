"use client";

import { useState } from "react";
import { useStore, StoreStockMovement } from "@/lib/store";
import {
    X,
    Package,
    History,
    Settings,
    ArrowUpRight,
    ArrowDownRight,
    Search
} from "lucide-react";

interface StoreInventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    store: { id: string; name: string } | null;
}

export function StoreInventoryModal({ isOpen, onClose, store }: StoreInventoryModalProps) {
    const { products, storeStocks, storeStockMovements, updateStoreStock, suppliers } = useStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
    const [adjustmentTarget, setAdjustmentTarget] = useState<{ productId: string; productName: string; currentStock: number } | null>(null);

    if (!isOpen || !store) return null;

    const storeCurrentStocks = storeStocks.filter(ss => ss.storeId === store.id);
    const storeHistory = storeStockMovements
        .filter(sm => sm.storeId === store.id)
        .sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime());

    const filteredStock = storeCurrentStocks.filter(ss => {
        const product = products.find(p => p.id === ss.productId);
        return product?.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const getReasonLabel = (reason: string) => {
        switch (reason) {
            case 'restock': return '補充';
            case 'sale': return '売上';
            case 'loss': return '紛失';
            case 'return': return '返品';
            case 'manual': return '調整';
            default: return reason;
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-8 bg-[#1e3a8a] text-white flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                            <Package className="w-6 h-6 text-blue-100" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">{store.name} の在庫状況</h2>
                            <p className="text-blue-100/60 text-sm font-bold mt-0.5">店舗に配置されている商品の管理</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
                        <X className="w-8 h-8" />
                    </button>
                </div>

                {/* Tabs & Search */}
                <div className="px-8 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                    <div className="flex p-1 bg-slate-200/50 rounded-2xl w-fit">
                        <button
                            onClick={() => setActiveTab('stock')}
                            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'stock' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            在庫リスト
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'history' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            履歴
                        </button>
                    </div>

                    <div className="relative group max-w-xs w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1e3a8a] transition-colors" />
                        <input
                            type="text"
                            placeholder="商品を検索..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-[#1e3a8a] outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {activeTab === 'stock' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredStock.length === 0 ? (
                                <div className="col-span-full py-20 text-center text-slate-400 font-bold">
                                    配置されている在庫はありません
                                </div>
                            ) : (
                                filteredStock.map(ss => {
                                    const product = products.find(p => p.id === ss.productId);
                                    if (!product) return null;
                                    return (
                                        <div key={ss.id} className="p-5 bg-white border border-slate-200 rounded-3xl hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/5 transition-all group">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <div className="text-xs font-black text-[#1e3a8a] uppercase tracking-wider">
                                                        {suppliers.find(s => s.id === product.supplierId)?.name || "未設定"}
                                                    </div>
                                                    <h3 className="font-bold text-slate-900">{product.name}</h3>
                                                    <p className="text-[10px] text-slate-400 font-mono tracking-tight">{product.amazonSku || "No SKU"}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">現在の配置数</p>
                                                    <p className="text-3xl font-black text-slate-900">{ss.stock}</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-end">
                                                <button
                                                    onClick={() => setAdjustmentTarget({ productId: ss.productId, productName: product.name, currentStock: ss.stock })}
                                                    className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 font-bold rounded-xl text-xs hover:bg-blue-50 hover:text-[#1e3a8a] transition-all"
                                                >
                                                    <Settings className="w-3.5 h-3.5" />
                                                    補正・ロス入力
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">日時</th>
                                        <th className="px-6 py-4">商品名</th>
                                        <th className="px-6 py-4">種別</th>
                                        <th className="px-6 py-4 text-right">数量</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-sm">
                                    {storeHistory.map(move => (
                                        <tr key={move.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-slate-500 font-medium">
                                                {move.date}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-900">
                                                {move.productName}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${move.type === 'in' ? 'bg-blue-50 text-blue-600' :
                                                        move.type === 'out' ? 'bg-orange-50 text-orange-600' :
                                                            'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {getReasonLabel(move.reason)}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-black ${move.type === 'in' ? 'text-blue-600' : 'text-orange-600'
                                                }`}>
                                                <div className="flex items-center justify-end gap-1">
                                                    {move.type === 'in' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                                    {move.quantity}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {storeHistory.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold">
                                                履歴はありません
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white border border-slate-200 text-slate-700 font-black rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
                    >
                        閉じる
                    </button>
                </div>
            </div>

            {/* Internal Adjustment Modal */}
            {adjustmentTarget && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 bg-[#1e3a8a] text-white flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black">在庫補正・ロス入力</h3>
                                <p className="text-blue-100/70 text-sm font-bold mt-0.5">{adjustmentTarget.productName}</p>
                            </div>
                            <button onClick={() => setAdjustmentTarget(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <AdjustmentForm
                            target={adjustmentTarget}
                            storeId={store.id}
                            onComplete={() => {
                                setAdjustmentTarget(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function AdjustmentForm({ target, storeId, onComplete }: { target: { productId: string; currentStock: number }; storeId: string; onComplete: () => void }) {
    const { updateStoreStock } = useStore();
    const [qty, setQty] = useState<number>(0);
    const [reason, setReason] = useState<StoreStockMovement['reason']>('loss');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (qty === 0) return;
        setIsSubmitting(true);
        try {
            await updateStoreStock(storeId, target.productId, qty, reason);
            onComplete();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400">現在庫</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{target.currentStock}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-[#1e3a8a]">調整後</p>
                    <p className="text-2xl font-black text-[#1e3a8a] mt-1">{target.currentStock + qty}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">数量 (ロスはマイナスで入力)</label>
                    <input
                        type="number"
                        value={qty}
                        onChange={(e) => setQty(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#1e3a8a]"
                        placeholder="例: -1"
                    />
                </div>
                <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">理由</label>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value as any)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none appearance-none"
                    >
                        <option value="loss">紛失</option>
                        <option value="manual">手動調整</option>
                        <option value="return">外部在庫から戻り</option>
                    </select>
                </div>
            </div>

            <button
                type="submit"
                disabled={isSubmitting || qty === 0}
                className="w-full py-4 bg-[#1e3a8a] text-white font-black rounded-2xl hover:bg-blue-800 disabled:opacity-50 transition-all shadow-xl shadow-blue-900/10"
            >
                調整を保存する
            </button>
        </form>
    );
}
