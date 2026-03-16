"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
    Package,
    History,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    ClipboardList,
    Plus
} from "lucide-react";
import Link from "next/link";

export default function InventoryPage() {
    const { products, stockMovements, inventoryAudits, loadingProducts } = useStore();
    const [searchTerm, setSearchTerm] = useState("");

    // Get low stock products
    const lowStockProducts = products.filter(p => !p.isTrashed && (p.stock || 0) <= (p.alertThreshold || 5));

    // Get recent stock movements
    const recentMovements = [...stockMovements]
        .sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime())
        .slice(0, 10);

    // Filter products for the list
    const filteredProducts = products.filter(p =>
        !p.isTrashed &&
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.amazonSku?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Inventory List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="font-black text-slate-900 flex items-center gap-2">
                                <Package className="w-5 h-5 text-slate-400" />
                                在庫一覧
                            </h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="商品名・SKUで検索"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">商品名</th>
                                        <th className="px-6 py-4 text-right">現在庫</th>
                                        <th className="px-6 py-4 text-right">アラート閾値</th>
                                        <th className="px-6 py-4 text-center">ステータス</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredProducts.map((product) => (
                                        <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{product.name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{product.amazonSku || "No SKU"}</div>
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
                                    ))}
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
        </div>
    );
}
