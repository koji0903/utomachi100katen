"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Search, ShoppingBag, CheckCircle, Clock } from "lucide-react";
import { useStore, Purchase } from "@/lib/store";
import { PurchaseModal } from "@/components/PurchaseModal";

export default function PurchasesPage() {
    const { isLoaded, purchases, products, suppliers, updatePurchase, deletePurchase } = useStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

    if (!isLoaded) return <div className="p-8">読み込み中...</div>;

    const filteredPurchases = purchases.filter((purchase) => {
        const product = products.find(p => p.id === purchase.productId);
        const supplier = suppliers.find(s => s.id === purchase.supplierId);
        const searchTarget = `${product?.name} ${supplier?.name}`.toLowerCase();
        return searchTarget.includes(searchQuery.toLowerCase());
    }).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

    const handleEdit = (purchase: Purchase) => {
        setEditingPurchase(purchase);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingPurchase(null);
        setIsModalOpen(true);
    };

    const handleToggleArrived = (purchase: Purchase) => {
        updatePurchase(purchase.id, { isArrived: !purchase.isArrived });
    };

    const handleDelete = (id: string) => {
        if (window.confirm("この仕入れ記録を削除してもよろしいですか？")) {
            deletePurchase(id);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">仕入れ管理</h1>
                        <p className="text-slate-500 mt-1 text-sm">商品の発注から入荷までのステータスを管理します。</p>
                    </div>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium"
                >
                    <Plus className="w-5 h-5" />
                    仕入れ登録
                </button>
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
                                <th className="p-5 font-semibold">商品名</th>
                                <th className="p-5 font-semibold">仕入先</th>
                                <th className="p-5 font-semibold text-center">数量</th>
                                <th className="p-5 font-semibold">発注日 / 入荷予定</th>
                                <th className="p-5 font-semibold text-center">ステータス</th>
                                <th className="p-5 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPurchases.map((purchase) => {
                                const product = products.find(p => p.id === purchase.productId);
                                const supplier = suppliers.find(s => s.id === purchase.supplierId);

                                return (
                                    <tr key={purchase.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-5 font-medium text-slate-900">{product?.name || "不明"}</td>
                                        <td className="p-5 text-slate-600">{supplier?.name || "不明"}</td>
                                        <td className="p-5 text-center text-slate-900 font-semibold">{purchase.quantity}</td>
                                        <td className="p-5 text-sm">
                                            <div className="text-slate-900">{purchase.orderDate}</div>
                                            <div className="text-slate-400 text-xs">予定: {purchase.expectedArrivalDate || "-"}</div>
                                        </td>
                                        <td className="p-5 text-center">
                                            <button
                                                onClick={() => handleToggleArrived(purchase)}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${purchase.isArrived
                                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                        : 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200'
                                                    }`}
                                            >
                                                {purchase.isArrived ? (
                                                    <><CheckCircle className="w-3 h-3" /> 入荷済み</>
                                                ) : (
                                                    <><Clock className="w-3 h-3" /> 入荷待ち</>
                                                )}
                                            </button>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
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
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredPurchases.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <Search className="w-8 h-8 text-slate-300" />
                                            <p>仕入れ記録が見つかりませんでした。</p>
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
