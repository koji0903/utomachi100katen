"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Edit2, Trash2, Search, ShoppingBag, CheckCircle, Clock, ChevronLeft, Sparkles, RotateCcw } from "lucide-react";
import { useStore, Purchase } from "@/lib/store";
import { PurchaseModal } from "@/components/PurchaseModal";
import { calculateDaysRemaining } from "@/lib/stockUtils";
import { showNotification } from "@/lib/notifications";
import { Tooltip } from "@/components/ui/Tooltip";

function PurchasesPageContent() {
    const { isLoaded, purchases, products, suppliers, sales, addPurchase, updatePurchase, deletePurchase, restorePurchase, permanentlyDeletePurchase } = useStore();
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showTrash, setShowTrash] = useState(false);

    const handleAutoGenerate = async () => {
        if (!window.confirm("在庫不足の商品に対して、自動的に発注データを作成しますか？")) return;

        setIsGenerating(true);

        try {
            // Group needed products by supplierId
            const supplierOrders: { [supplierId: string]: { productId: string, quantity: number, unitCost: number, totalCost: number }[] } = {};

            for (const product of products) {
                const days = calculateDaysRemaining(product, sales);
                const isUnderThreshold = product.stock <= (product.alertThreshold ?? 20);
                const isRunningOutSoon = days !== Infinity && days <= 7;

                if (isUnderThreshold || isRunningOutSoon) {
                    // Check if there's already an active PO (ordered_pending/ordered) for THIS product
                    const hasActivePO = purchases.some(p => p.status !== 'received' && p.status !== 'paid' && (p.items || []).some(i => i.productId === product.id));
                    if (hasActivePO) continue;

                    const threshold = product.alertThreshold ?? 20;
                    const quantity = Math.max(threshold * 2, 10); // Simple restock rule

                    if (!supplierOrders[product.supplierId]) {
                        supplierOrders[product.supplierId] = [];
                    }
                    // Fetch accurate unit cost from the supplier's provided products if available
                    const supplier = suppliers.find(s => s.id === product.supplierId);
                    const suppliedProd = supplier?.suppliedProducts?.find(sp => sp.productId === product.id);
                    const costPrice = suppliedProd ? suppliedProd.purchasePrice : (product.costPrice || 0);

                    supplierOrders[product.supplierId].push({
                        productId: product.id,
                        quantity,
                        unitCost: costPrice,
                        totalCost: costPrice * quantity
                    });
                }
            }

            const supplierIds = Object.keys(supplierOrders);
            if (supplierIds.length > 0) {
                for (const supplierId of supplierIds) {
                    const items = supplierOrders[supplierId];
                    const totalAmount = items.reduce((sum, item) => sum + item.totalCost, 0);

                    await addPurchase({
                        type: 'A',
                        status: 'ordered_pending',
                        supplierId,
                        items,
                        totalAmount,
                        orderDate: new Date().toISOString().split('T')[0],
                        expectedArrivalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 7 days
                    });
                }
                showNotification(`${supplierIds.length}件の仕入先に対する発注オーダーを自動作成しました。`);
            } else {
                showNotification("現在、補充が必要な商品はありません。");
            }
        } catch (err) {
            console.error(err);
            showNotification("エラーが発生しました。");
        } finally {
            setIsGenerating(false);
        }
    };

    const filterDate = searchParams.get("date");

    if (!isLoaded) return <div className="p-8">読み込み中...</div>;

    const filteredPurchases = purchases
        .filter(p => !!p.isTrashed === showTrash)
        .filter((purchase) => {
            // Search filter
            const supplier = suppliers.find(s => s.id === purchase.supplierId);
            const itemsMatches = (purchase.items || []).some(item => {
                const product = products.find(p => p.id === item.productId);
                return product?.name.toLowerCase().includes(searchQuery.toLowerCase());
            });
            const matchesSearch = itemsMatches || (supplier?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

            // Date filter
            const matchesDate = !filterDate || purchase.orderDate === filterDate || purchase.arrivalDate === filterDate;

            return matchesSearch && matchesDate;
        }).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

    const handleEdit = (purchase: Purchase) => {
        setEditingPurchase(purchase);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingPurchase(null);
        setIsModalOpen(true);
    };

    const handleToggleStatus = (purchase: Purchase) => {
        const statusOrder: Purchase['status'][] = ['ordered_pending', 'ordered', 'waiting', 'received', 'paid'];
        const currentIndex = statusOrder.indexOf(purchase.status);

        let nextStatus: Purchase['status'];
        if (currentIndex < statusOrder.length - 1) {
            nextStatus = statusOrder[currentIndex + 1];
        } else {
            // Loop back to the beginning
            nextStatus = statusOrder[0];
        }

        const update: Partial<Purchase> = { status: nextStatus };

        // Auto-set dates (or reset them if looping back)
        if (nextStatus === 'received') {
            update.receivedDate = new Date().toISOString().split('T')[0];
            update.arrivalDate = update.receivedDate;
        } else if (nextStatus === 'paid') {
            update.paymentDate = new Date().toISOString().split('T')[0];
        } else if (nextStatus === 'ordered_pending') {
            // Reset dates when looping back
            update.receivedDate = "";
            update.arrivalDate = "";
            update.paymentDate = "";
        }

        updatePurchase(purchase.id, update);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("この発注記録をゴミ箱に移動してもよろしいですか？")) {
            deletePurchase(id);
            showNotification("ゴミ箱に移動しました。");
        }
    };

    const handleRestore = (id: string) => {
        restorePurchase(id);
        showNotification("発注記録を復元しました。");
    };

    const handlePermanentDelete = (id: string) => {
        if (window.confirm("この発注記録を完全に削除しますか？この操作は取り消せません。")) {
            permanentlyDeletePurchase(id);
            showNotification("完全に削除しました。");
        }
    };

    const getStatusBadge = (status: Purchase['status']) => {
        switch (status) {
            case 'ordered_pending':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        <Clock className="w-3 h-3" /> 未（予定）
                    </span>
                );
            case 'ordered':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                        <ShoppingBag className="w-3 h-3" /> 発注済
                    </span>
                );
            case 'waiting':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" /> 仕入待ち
                    </span>
                );
            case 'received':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3" /> 仕入済み
                    </span>
                );
            case 'paid':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                        <CheckCircle className="w-3 h-3" /> 支払済
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {status}
                    </span>
                );
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {filterDate && (
                                <Link href="/purchases" className="p-1 hover:bg-emerald-50 rounded-lg text-emerald-400 hover:text-emerald-600 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </Link>
                            )}
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                                {filterDate ? `${filterDate.replace(/-/g, "/")} の記録` : "仕入管理"}
                            </h1>
                        </div>
                        <p className="text-slate-500 text-sm">仕入先への発注から入荷、直接入荷の管理を一元化します。</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowTrash(!showTrash)}
                        className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl shadow-sm active:scale-95 transition-all text-sm border ${showTrash ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    >
                        <Trash2 className="w-4 h-4" />
                        {showTrash ? "戻る" : "ゴミ箱"}
                    </button>
                    <Tooltip content="在庫数と過去の販売ペースから、今後一週間で不足しそうな商品を自動計算して発注オーダー(パターンA)を作成します。" position="bottom">
                        <button
                            onClick={handleAutoGenerate}
                            disabled={isGenerating}
                            className="hidden sm:flex items-center gap-2 bg-white text-emerald-700 px-4 py-2.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors shadow-sm font-bold text-sm disabled:opacity-50"
                        >
                            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-pulse' : ''}`} />
                            {isGenerating ? "生成中..." : "欠品予測から自動生成"}
                        </button>
                    </Tooltip>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        新規仕入登録
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="商品名や仕入先で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-sm bg-white">
                                <th className="p-5 font-semibold">種別</th>
                                <th className="p-5 font-semibold">仕入先</th>
                                <th className="p-5 font-semibold">発注/入荷内容</th>
                                <th className="p-5 font-semibold text-right">発注合計金額</th>
                                <th className="p-5 font-semibold">日付</th>
                                <th className="p-5 font-semibold text-center">ステータス</th>
                                <th className="p-5 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPurchases.map((purchase) => {
                                const supplier = suppliers.find(s => s.id === purchase.supplierId);
                                const items = purchase.items || [];

                                return (
                                    <tr key={purchase.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${purchase.type === 'A' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                                                パターン{purchase.type}
                                            </span>
                                        </td>
                                        <td className="p-5 text-slate-900 font-bold">{supplier?.name || "不明"}</td>
                                        <td className="p-5 text-sm text-slate-700">
                                            <div className="space-y-1">
                                                {items.map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 justify-between max-w-[200px]">
                                                        <span className="truncate" title={products.find(p => p.id === item.productId)?.name}>{products.find(p => p.id === item.productId)?.name || "不明"}</span>
                                                        <span className="text-slate-500 font-medium whitespace-nowrap">x {item.quantity}</span>
                                                    </div>
                                                ))}
                                                {items.length === 0 && (
                                                    <span className="text-slate-400 italic">商品がありません</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-5 text-right font-bold text-emerald-700">
                                            ¥{(purchase.totalAmount || 0).toLocaleString()}
                                        </td>
                                        <td className="p-5 text-xs text-slate-500">
                                            <div>発注: {purchase.orderDate}</div>
                                            {purchase.type === 'A' && purchase.status !== 'received' && purchase.status !== 'paid' && (
                                                <div className="text-blue-400">予定: {purchase.expectedArrivalDate || "-"}</div>
                                            )}
                                            {(purchase.status === 'received' || purchase.status === 'paid') && (
                                                <div className="text-emerald-500 font-medium">入荷: {purchase.arrivalDate || purchase.receivedDate}</div>
                                            )}
                                            {purchase.status === 'paid' && (
                                                <div className="text-indigo-500 font-medium text-[10px]">支払: {purchase.paymentDate}</div>
                                            )}
                                        </td>
                                        <td className="p-5 text-center">
                                            <button
                                                onClick={() => handleToggleStatus(purchase)}
                                                className="transition-all hover:scale-105 active:scale-95"
                                            >
                                                {getStatusBadge(purchase.status)}
                                            </button>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {purchase.isTrashed ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleRestore(purchase.id)}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="復元"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handlePermanentDelete(purchase.id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="完全削除"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleEdit(purchase)}
                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                            title="編集"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(purchase.id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="削除"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredPurchases.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <Search className="w-8 h-8 text-slate-300" />
                                            <p>発注記録が見つかりませんでした。</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <PurchaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingPurchase}
            />
        </div>
    );
}

export default function PurchasesPage() {
    return (
        <Suspense fallback={<div className="p-8">読み込み中...</div>}>
            <PurchasesPageContent />
        </Suspense>
    );
}
