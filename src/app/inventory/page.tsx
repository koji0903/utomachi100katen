"use client";

import { useState, useMemo } from "react";
import { useStore, StoreStockMovement } from "@/lib/store";
import { showNotification } from "@/lib/notifications";
import { syncWithSquare, resetSquareData } from "@/lib/square-sync-client";

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
    X,
    RefreshCw,
    Store
} from "lucide-react";
import Link from "next/link";

export default function InventoryPage() {
    const { products, stockMovements, suppliers, storeStocks, retailStores, loadingProducts, updateStoreStock, mutateSales, mutateProducts, mutateStockMovements, sales } = useStore();

    const [viewType, setViewType] = useState<'global' | 'store' | 'delivery'>('global');
    const [selectedStoreId, setSelectedStoreId] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [adjustmentTarget, setAdjustmentTarget] = useState<{ storeId: string; productId: string; productName: string; currentStock: number } | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

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
            case 'square_sync': return 'Square同期';
            case 'manual': return '手動調整';
            case 'return': return '返品';
            case 'waste': return '廃棄';
            default: return reason;
        }
    };

    const handleSquareSync = async () => {
        const squareStores = retailStores.filter(s => s.type === 'C' && s.squareLocationId);
        if (squareStores.length === 0) {
            showNotification("Square連携設定が有効な直営店が見つかりません。", "error");
            return;
        }
        let targetStore = squareStores.find(s => s.id === selectedStoreId);
        if (!targetStore) targetStore = squareStores[0];

        if (!window.confirm(`${targetStore.name} のSquareデータを同期しますか？\n(直近1週間の注文取込と在庫の書き込みを行います)`)) {
            return;
        }

        setIsSyncing(true);
        try {
            const result = await syncWithSquare(targetStore.id);
            if (result.success) {
                showNotification(result.message, "success");
                await mutateSales();
                await mutateProducts();
                await mutateStockMovements();
            } else {

                let errorMessage = result.message;
                if (result.detail) errorMessage += `\n詳解: ${result.detail}`;
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            console.error("Square Sync Error:", error);
            showNotification(error.message || "Square同期中にエラーが発生しました。", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    // Calculate weekly sales for replenishment view
    const weeklySalesData = useMemo(() => {
        if (viewType !== 'delivery' || !selectedStoreId) return { thisWeekSales: {} as Record<string, number>, lastWeekSales: {} as Record<string, number>, twoWeeksAgoSales: {} as Record<string, number> };

        // Define this week (Mon-Sun) and last week (Mon-Sun)
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
        monday.setHours(0, 0, 0, 0);

        const lastMonday = new Date(monday);
        lastMonday.setDate(monday.getDate() - 7);

        const twoWeeksAgoMonday = new Date(lastMonday);
        twoWeeksAgoMonday.setDate(lastMonday.getDate() - 7);

        const thisWeekSales: Record<string, number> = {};
        const lastWeekSales: Record<string, number> = {};
        const twoWeeksAgoSales: Record<string, number> = {};

        sales.filter(s => !s.isTrashed).forEach(sale => {
            if (sale.storeId !== selectedStoreId) return;
            const saleDate = new Date(sale.period);
            
            if (saleDate >= monday) {
                sale.items.forEach(item => {
                    thisWeekSales[item.productId] = (thisWeekSales[item.productId] || 0) + item.quantity;
                });
            } else if (saleDate >= lastMonday && saleDate < monday) {
                sale.items.forEach(item => {
                    lastWeekSales[item.productId] = (lastWeekSales[item.productId] || 0) + item.quantity;
                });
            } else if (saleDate >= twoWeeksAgoMonday && saleDate < lastMonday) {
                sale.items.forEach(item => {
                    twoWeeksAgoSales[item.productId] = (twoWeeksAgoSales[item.productId] || 0) + item.quantity;
                });
            }
        });

        return { thisWeekSales, lastWeekSales, twoWeeksAgoSales };
    }, [viewType, selectedStoreId, sales]);
    


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
                    {retailStores.some(s => s.type === 'C' && s.squareLocationId) && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSquareSync}
                                disabled={isSyncing}
                                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:bg-purple-300 transition-all shadow-lg shadow-purple-900/10 active:scale-95"
                            >
                                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                                {isSyncing ? 'Square同期中' : 'Square同期'}
                            </button>
                        </div>
                    )}

                    <button
                        onClick={async () => {
                            setIsSyncing(true);
                            try {
                                const res = await fetch("/api/amazon/sync", { method: "POST" });
                                const data = await res.json();
                                if (data.success) {
                                    showNotification(data.message, "success");
                                    await mutateProducts();
                                    await mutateStockMovements();
                                } else {
                                    throw new Error(data.message || data.error);
                                }
                            } catch (error: any) {
                                console.error("Amazon Sync Error:", error);
                                showNotification(error.message, "error");
                            } finally {
                                setIsSyncing(false);
                            }
                        }}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#FF9900] text-white font-bold rounded-xl hover:bg-[#e68a00] disabled:bg-[#ffcc80] transition-all shadow-lg shadow-orange-900/10 active:scale-95"
                    >
                        <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Amazon同期中' : 'Amazon同期'}
                    </button>

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
                <button
                    onClick={() => setViewType('delivery')}
                    className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${viewType === 'delivery' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    納品判断アシスト
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Inventory List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="font-black text-slate-900 flex items-center gap-2">
                                <Package className="w-5 h-5 text-slate-400" />
                                {viewType === 'global' ? '在庫一覧' : viewType === 'store' ? '店舗在庫一覧' : '納品判断シート'}
                            </h2>
                            <div className="flex items-center gap-3">
                                {(viewType === 'store' || viewType === 'delivery') && (
                                    <div className="relative group">
                                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1e3a8a] transition-colors" />
                                        <select
                                            value={selectedStoreId}
                                            onChange={(e) => setSelectedStoreId(e.target.value)}
                                            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-[#1e3a8a] transition-all outline-none appearance-none cursor-pointer hover:bg-slate-50 min-w-[160px]"
                                        >
                                            <option value="">店舗を選択</option>
                                            {retailStores.filter(s => !s.isTrashed && s.type === 'A').map(store => (
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
                                        <th className="px-6 py-4 text-right">
                                            {viewType === 'delivery' ? '売上推移 (週)' : 'アラート閾値'}
                                        </th>
                                        <th className="px-6 py-4 text-center">ステータス</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {viewType === 'delivery' ? (
                                        (() => {
                                            const store = retailStores.find(s => s.id === selectedStoreId);
                                            const activeIds = store?.activeProductIds || [];
                                            const { thisWeekSales, lastWeekSales, twoWeeksAgoSales } = weeklySalesData;

                                            return activeIds.map(pid => {
                                                const product = products.find(p => p.id === pid);
                                                if (!product) return null;
                                                const ss = storeStocks.find(s => s.storeId === selectedStoreId && s.productId === pid);
                                                const currentStock = ss?.stock || 0;
                                                const tw = thisWeekSales[pid] || 0;
                                                const lw = lastWeekSales[pid] || 0;
                                                const tway = twoWeeksAgoSales[pid] || 0;

                                                // Status Logic
                                                let status = { label: "安定", color: "bg-slate-50 text-slate-500" };
                                                if (currentStock <= 0) {
                                                    status = { label: "欠品中", color: "bg-red-50 text-red-600" };
                                                } else if (currentStock < (tw + lw) / 2) {
                                                    status = { label: "不足気味", color: "bg-orange-50 text-orange-600" };
                                                } else if (tw > 0 && currentStock < tw) {
                                                    status = { label: "要補充", color: "bg-amber-50 text-amber-600" };
                                                }

                                                return (
                                                    <tr key={pid} className="hover:bg-slate-50/80 transition-colors">
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
                                                            <div className="flex flex-col items-end">
                                                                <span className={`text-lg font-black ${currentStock <= 3 ? 'text-red-600' : 'text-slate-900'}`}>
                                                                    {currentStock}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">店舗在庫</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-3 text-right">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-sm font-black text-blue-600">{tw}</span>
                                                                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">今週</span>
                                                                </div>
                                                                <div className="w-px h-6 bg-slate-100 mx-1"></div>
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-sm font-black text-slate-700">{lw}</span>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">先週</span>
                                                                </div>
                                                                <div className="flex flex-col items-end opacity-50">
                                                                    <span className="text-sm font-black text-slate-400">{tway}</span>
                                                                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">先々週</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`px-2 py-1 text-[10px] font-black rounded-lg ${status.color}`}>
                                                                {status.label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()
                                    ) : viewType === 'global' ? (
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
                                        (() => {
                                            const store = retailStores.find(s => s.id === selectedStoreId);
                                            const activeIds = store?.activeProductIds || [];

                                            // Show all products in activeProductIds, even if no stock entry exists
                                            return activeIds.map(pid => {
                                                const product = products.find(p => p.id === pid);
                                                if (!product) return null;
                                                const ss = storeStocks.find(s => s.storeId === selectedStoreId && s.productId === pid);
                                                const currentStock = ss?.stock || 0;

                                                return (
                                                    <tr key={pid} className="hover:bg-slate-50/80 transition-colors">
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
                                                                {currentStock}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-400 italic">
                                                            -
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className="px-2 py-1 bg-slate-50 text-slate-500 text-[10px] font-black rounded-lg">店舗保管</span>
                                                                <button
                                                                    onClick={() => setAdjustmentTarget({ storeId: selectedStoreId, productId: pid, productName: product.name, currentStock })}
                                                                    className="p-1.5 text-slate-400 hover:text-[#1e3a8a] hover:bg-slate-100 rounded-lg transition-all"
                                                                    title="在庫調整"
                                                                >
                                                                    <Settings className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()
                                    )}
                                    {(viewType === 'store' || viewType === 'delivery') && !selectedStoreId && (
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
    const [inputType, setInputType] = useState<'diff' | 'absolute'>('diff');
    const [reason, setReason] = useState<StoreStockMovement['reason']>('manual');
    const [remarks, setRemarks] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (qty === 0) return;
        setIsSubmitting(true);
        try {
            const finalReason = inputType === 'absolute' ? 'audit' : reason;
            await updateStoreStock(target.storeId, target.productId, qty, finalReason, undefined, new Date().toISOString().split('T')[0], inputType === 'absolute');
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
                            <p className="text-[10px] font-black text-[#1e3a8a] uppercase tracking-widest">更新後</p>
                            <p className="text-2xl font-black text-[#1e3a8a] mt-1">
                                {inputType === 'absolute' ? qty : target.currentStock + qty}
                            </p>
                        </div>
                    </div>

                    <div className="flex p-1 bg-slate-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => { setInputType('diff'); setQty(0); }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${inputType === 'diff' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-slate-500'}`}
                        >
                            増減入力
                        </button>
                        <button
                            type="button"
                            onClick={() => { setInputType('absolute'); setQty(target.currentStock); }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${inputType === 'absolute' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-slate-500'}`}
                        >
                            現在数を直接入力
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-black text-slate-700 mb-2">
                                {inputType === 'diff' ? '増分/減分 (例: -1)' : '現在の正確な在庫数'}
                            </label>
                            <input
                                type="number"
                                value={qty}
                                onChange={(e) => setQty(Number(e.target.value))}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black focus:ring-4 focus:ring-blue-500/10 focus:border-[#1e3a8a] outline-none transition-all"
                                placeholder={inputType === 'diff' ? "例: -1 (紛失), 2 (入庫)" : "現在の個数を入力"}
                            />
                        </div>

                        {inputType === 'diff' && (
                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">理由</label>
                                <select
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value as any)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-[#1e3a8a] outline-none transition-all appearance-none"
                                >
                                    <option value="manual">手動調整</option>
                                    <option value="loss">紛失・破損</option>
                                    <option value="return">返品</option>
                                    <option value="restock">補充</option>
                                </select>
                            </div>
                        )}

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
                        disabled={isSubmitting || (inputType === 'diff' && qty === 0)}
                        className="w-full py-4 bg-[#1e3a8a] text-white font-black rounded-2xl hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-900/10"
                    >
                        {isSubmitting ? '処理中...' : (inputType === 'absolute' ? '在庫数を確定する' : '調整を実行する')}
                    </button>
                </form>
            </div>
        </div>
    );
}
