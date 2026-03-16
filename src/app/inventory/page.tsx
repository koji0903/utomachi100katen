"use client";

import { useState } from "react";
import { useStore, StoreStockMovement } from "@/lib/store";
import {
    Package,
    History,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    ClipboardList,
    Plus,
    Filter,
    ChevronUp,
    ChevronDown,
    ArrowUpDown,
    Settings,
    X
} from "lucide-react";
import Link from "next/link";

export default function InventoryPage() {
    const { products, stockMovements, suppliers, storeStocks, retailStores, loadingProducts, updateStoreStock } = useStore();
    const [viewType, setViewType] = useState<'global' | 'store'>('global');
    const [selectedStoreId, setSelectedStoreId] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [adjustmentTarget, setAdjustmentTarget] = useState<{ storeId: string; productId: string; productName: string; currentStock: number } | null>(null);

    // Get low stock products
    const lowStockProducts = products.filter(p => !p.isTrashed && (p.stock || 0) <= (p.alertThreshold || 5));

    // Get recent stock movements
    const recentMovements = [...stockMovements]
        .sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime())
        .slice(0, 10);

    // Filter and Sort products
    const filteredProducts = products
        .filter(p => {
            const matchesSearch = !p.isTrashed &&
                (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.amazonSku?.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesSupplier = selectedSupplierId === "all" || p.supplierId === selectedSupplierId;

            return matchesSearch && matchesSupplier;
        })
        .sort((a, b) => {
            if (!sortConfig) return 0;

            let valA: any = a[sortConfig.key as keyof typeof a];
            let valB: any = b[sortConfig.key as keyof typeof b];

            // Handle numeric values
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            // Handle string values
            valA = (valA || "").toString().toLowerCase();
            valB = (valB || "").toString().toLowerCase();

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const getReasonLabel = (reason: string) => {
        switch (reason) {
            case 'sale': return '売上';
            case 'purchase': return '仕入';
            case 'audit': return '棚卸調整';
            case 'amazon_sync': return 'Amazon同期';
            case 'manual': return '手動調整';
            case 'return': return '返品';
            case 'waste': return '廃棄';
            default: return reason;
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Package className="w-8 h-8 text-[#1e3a8a]" />
                        在庫管理
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        在庫状況の確認、履歴の追跡、および棚卸しを行います。
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/inventory/audits"
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <ClipboardList className="w-5 h-5" />
                        棚卸し履歴
                    </Link>
                    <Link
                        href="/inventory/audits/new"
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#1e3a8a] text-white font-bold rounded-xl hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10"
                    >
                        <Plus className="w-5 h-5" />
                        新規棚卸し
                    </Link>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#1e3a8a]">
                            <Package className="w-6 h-6" />
                        </div>
                        {lowStockProducts.length > 0 && (
                            <div className="px-3 py-1 bg-red-50 text-red-600 text-xs font-black rounded-full flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                在庫不足あり
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">総商品数</p>
                        <p className="text-3xl font-black text-slate-900 leading-none mt-1">
                            {products.filter(p => !p.isTrashed).length}
                            <span className="text-lg ml-1 font-bold text-slate-400">品目</span>
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">在庫アラート</p>
                        <p className="text-3xl font-black text-red-600 leading-none mt-1">
                            {lowStockProducts.length}
                            <span className="text-lg ml-1 font-bold text-slate-400">品目</span>
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                        <History className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">本日の在庫移動</p>
                        <p className="text-3xl font-black text-slate-900 leading-none mt-1">
                            {stockMovements.filter(m => m.date === new Date().toISOString().split('T')[0]).length}
                            <span className="text-lg ml-1 font-bold text-slate-400">件</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* View Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
                <button
                    onClick={() => setViewType('global')}
                    className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${viewType === 'global' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    全体在庫
                </button>
                <button
                    onClick={() => setViewType('store')}
                    className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${viewType === 'store' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    店舗別配置
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Inventory List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="font-black text-slate-900 flex items-center gap-2">
                                <Package className="w-5 h-5 text-slate-400" />
                                {viewType === 'global' ? '在庫一覧' : '店舗在庫一覧'}
                            </h2>
                            <div className="flex items-center gap-3">
                                {viewType === 'store' && (
                                    <div className="relative group">
                                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1e3a8a] transition-colors" />
                                        <select
                                            value={selectedStoreId}
                                            onChange={(e) => setSelectedStoreId(e.target.value)}
                                            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-[#1e3a8a] transition-all outline-none appearance-none cursor-pointer hover:bg-slate-50 min-w-[160px]"
                                        >
                                            <option value="">店舗を選択</option>
                                            {retailStores.filter(s => !s.isTrashed).map(store => (
                                                <option key={store.id} value={store.id}>{store.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {viewType === 'global' && (
                                    <>
                                        <div className="relative group">
                                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1e3a8a] transition-colors" />
                                            <select
                                                value={selectedSupplierId}
                                                onChange={(e) => setSelectedSupplierId(e.target.value)}
                                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-[#1e3a8a] transition-all outline-none appearance-none cursor-pointer hover:bg-slate-50"
                                            >
                                                <option value="all">すべての仕入先</option>
                                                {suppliers.filter(s => !s.isTrashed).map(supplier => (
                                                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1e3a8a] transition-colors" />
                                            <input
                                                type="text"
                                                placeholder="商品名・SKUで検索"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-[#1e3a8a] transition-all outline-none w-64"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th
                                            className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors group"
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center gap-1">
                                                商品名
                                                {sortConfig?.key === 'name' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-[#1e3a8a]" /> : <ChevronDown className="w-3 h-3 text-[#1e3a8a]" />
                                                ) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4">仕入先</th>
                                        <th
                                            className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors group"
                                            onClick={() => handleSort('stock')}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                現在庫
                                                {sortConfig?.key === 'stock' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-[#1e3a8a]" /> : <ChevronDown className="w-3 h-3 text-[#1e3a8a]" />
                                                ) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors group"
                                            onClick={() => handleSort('alertThreshold')}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                アラート閾値
                                                {sortConfig?.key === 'alertThreshold' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-[#1e3a8a]" /> : <ChevronDown className="w-3 h-3 text-[#1e3a8a]" />
                                                ) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-center">ステータス</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {viewType === 'global' ? (
                                        filteredProducts.map((product) => (
                                            <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-900">{product.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{product.amazonSku || "No SKU"}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-bold text-slate-500">
                                                        {suppliers.find(s => s.id === product.supplierId)?.name || "未設定"}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`text-lg font-black ${(product.stock || 0) <= (product.alertThreshold || 5) ? 'text-red-600' : 'text-slate-900'}`}>
                                                        {product.stock || 0}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-400">
                                                    {product.alertThreshold || 5}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {(product.stock || 0) <= (product.alertThreshold || 5) ? (
                                                        <span className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-black rounded-lg">要発注</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-lg">適正</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        storeStocks
                                            .filter(ss => ss.storeId === selectedStoreId)
                                            .map(ss => {
                                                const product = products.find(p => p.id === ss.productId);
                                                if (!product) return null;
                                                return (
                                                    <tr key={ss.id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-slate-900">{product.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{product.amazonSku || "No SKU"}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs font-bold text-slate-500">
                                                                {suppliers.find(s => s.id === product.supplierId)?.name || "未設定"}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="text-lg font-black text-slate-900">
                                                                {ss.stock || 0}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-400 italic">
                                                            -
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className="px-2 py-1 bg-slate-50 text-slate-500 text-[10px] font-black rounded-lg">店舗保管</span>
                                                                <button
                                                                    onClick={() => setAdjustmentTarget({ storeId: ss.storeId, productId: ss.productId, productName: product.name, currentStock: ss.stock })}
                                                                    className="p-1.5 text-slate-400 hover:text-[#1e3a8a] hover:bg-slate-100 rounded-lg transition-all"
                                                                    title="在庫調整"
                                                                >
                                                                    <Settings className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                    )}
                                    {viewType === 'store' && !selectedStoreId && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold">
                                                店舗を選択してください
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Recent Activity Log */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="font-black text-slate-900 flex items-center gap-2">
                                <History className="w-5 h-5 text-slate-400" />
                                最近の履歴
                            </h2>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                            {recentMovements.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 font-bold text-sm">
                                    履歴がありません
                                </div>
                            ) : (
                                recentMovements.map((move) => (
                                    <div key={move.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="text-xs font-bold text-slate-900 line-clamp-1">{move.productName}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${move.type === 'in' ? 'bg-blue-50 text-blue-600' :
                                                        move.type === 'out' ? 'bg-orange-50 text-orange-600' :
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {getReasonLabel(move.reason)}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400">{move.date}</span>
                                                </div>
                                            </div>
                                            <div className={`flex items-center font-black ${move.type === 'in' ? 'text-blue-600' :
                                                move.type === 'out' ? 'text-orange-600' :
                                                    'text-slate-900'
                                                }`}>
                                                {move.type === 'in' ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
                                                {move.quantity}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Adjustment Modal */}
            {adjustmentTarget && (
                <StoreStockAdjustmentModal
                    target={adjustmentTarget}
                    onClose={() => setAdjustmentTarget(null)}
                />
            )}
        </div>
    );
}

function StoreStockAdjustmentModal({ target, onClose }: { target: { storeId: string; productId: string; productName: string; currentStock: number }; onClose: () => void }) {
    const { updateStoreStock } = useStore();
    const [qty, setQty] = useState<number>(0);
    const [reason, setReason] = useState<StoreStockMovement['reason']>('loss');
    const [remarks, setRemarks] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (qty === 0) return;
        setIsSubmitting(true);
        try {
            await updateStoreStock(target.storeId, target.productId, qty, reason, undefined, new Date().toISOString().split('T')[0]);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 bg-[#1e3a8a] text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black">在庫調整</h3>
                        <p className="text-blue-100/70 text-sm font-bold mt-0.5">{target.productName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">現在庫</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{target.currentStock}</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                            <p className="text-[10px] font-black text-[#1e3a8a] uppercase tracking-widest">調整後</p>
                            <p className="text-2xl font-black text-[#1e3a8a] mt-1">{target.currentStock + qty}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-black text-slate-700 mb-2">調整内容 (増分/減分)</label>
                            <input
                                type="number"
                                value={qty}
                                onChange={(e) => setQty(Number(e.target.value))}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black focus:ring-4 focus:ring-blue-500/10 focus:border-[#1e3a8a] outline-none transition-all"
                                placeholder="例: -1 (紛失), 2 (入庫)"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-black text-slate-700 mb-2">理由</label>
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value as any)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-[#1e3a8a] outline-none transition-all appearance-none"
                            >
                                <option value="loss">紛失</option>
                                <option value="manual">手動調整</option>
                                <option value="return">返品</option>
                                <option value="restock">補充</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-black text-slate-700 mb-2">備考</label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-[#1e3a8a] outline-none transition-all h-24 resize-none"
                                placeholder="詳細な理由など"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || qty === 0}
                        className="w-full py-4 bg-[#1e3a8a] text-white font-black rounded-2xl hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-900/10"
                    >
                        {isSubmitting ? '処理中...' : '調整を実行する'}
                    </button>
                </form>
            </div>
        </div>
    );
}
