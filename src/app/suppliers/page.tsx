"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Search, Users } from "lucide-react";
import { useStore, Supplier } from "@/lib/store";
import { SupplierModal } from "@/components/SupplierModal";

export default function SuppliersPage() {
    const { isLoaded, suppliers, deleteSupplier } = useStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    if (!isLoaded) return <div className="p-8">読み込み中...</div>;

    const filteredSuppliers = suppliers.filter((supplier) =>
        supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.tel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.pic?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingSupplier(null);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("この仕入先を削除してもよろしいですか？")) {
            deleteSupplier(id);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">仕入先管理</h1>
                        <p className="text-slate-500 mt-1 text-sm">商品の卸元や生産者の基本情報を管理します。</p>
                    </div>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
                >
                    <Plus className="w-5 h-5" />
                    仕入先登録
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="仕入先名や連絡先で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-sm bg-white">
                                <th className="p-5 font-semibold">仕入先名</th>
                                <th className="p-5 font-semibold">担当者</th>
                                <th className="p-5 font-semibold">電話番号</th>
                                <th className="p-5 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSuppliers.map((supplier) => (
                                <tr key={supplier.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                                            {supplier.name}
                                        </div>
                                    </td>
                                    <td className="p-5 text-slate-600">
                                        {supplier.pic || <span className="text-slate-400 italic">未登録</span>}
                                    </td>
                                    <td className="p-5 text-slate-600">
                                        {supplier.tel || <span className="text-slate-400 italic">未登録</span>}
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(supplier)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="編集"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(supplier.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="削除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredSuppliers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <Search className="w-8 h-8 text-slate-300" />
                                            <p>仕入先が見つかりませんでした。</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <SupplierModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingSupplier}
            />
        </div>
    );
}
