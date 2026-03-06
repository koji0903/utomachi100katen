"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Search, Store } from "lucide-react";
import { useStore, RetailStore } from "@/lib/store";
import { RetailStoreModal } from "@/components/RetailStoreModal";

export default function RetailStoresPage() {
    const { isLoaded, retailStores, deleteRetailStore } = useStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<RetailStore | null>(null);

    if (!isLoaded) return <div className="p-8">読み込み中...</div>;

    const filteredStores = retailStores.filter((store) =>
        store.name.includes(searchQuery)
    );

    const handleEdit = (store: RetailStore) => {
        setEditingStore(store);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingStore(null);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("この販売店舗を削除してもよろしいですか？商品の設定金額も削除される可能性があります。")) {
            deleteRetailStore(id);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-pink-50 text-pink-600 rounded-xl">
                        <Store className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">販売店舗管理</h1>
                        <p className="text-slate-500 mt-1 text-sm">商品の卸先や販売先となる店舗を管理します。</p>
                    </div>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2.5 rounded-lg hover:bg-pink-700 transition-colors shadow-sm font-medium"
                >
                    <Plus className="w-5 h-5" />
                    店舗登録
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="店舗名で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-sm bg-white">
                                <th className="p-5 font-semibold">店舗名</th>
                                <th className="p-5 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStores.map((store) => (
                                <tr key={store.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-medium text-slate-900 group-hover:text-pink-600 transition-colors">{store.name}</div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(store)}
                                                className="p-2 text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                                                title="編集"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(store.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="削除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredStores.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="p-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <Search className="w-8 h-8 text-slate-300" />
                                            <p>販売店舗が見つかりませんでした。</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <RetailStoreModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingStore}
            />
        </div>
    );
}
