"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { useStore, Brand } from "@/lib/store";
import { BrandModal } from "@/components/BrandModal";
import { showNotification } from "@/lib/notifications";

export default function BrandsPage() {
    const { isLoaded, brands, deleteBrand } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

    if (!isLoaded) return <div className="p-8">読み込み中...</div>;

    const handleEdit = (brand: Brand) => {
        setEditingBrand(brand);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingBrand(null);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("このブランドを削除してもよろしいですか？")) {
            deleteBrand(id);
            showNotification("ブランドを削除しました。");
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ブランド管理</h1>
                    <p className="text-slate-500 mt-1 text-sm">商品のブランド（旧カテゴリー）を管理します。</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-[#1e3a8a] text-white px-4 py-2.5 rounded-lg hover:bg-blue-800 transition-colors shadow-sm font-medium"
                >
                    <Plus className="w-5 h-5" />
                    ブランド登録
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-sm bg-white">
                                <th className="p-5 font-semibold whitespace-nowrap">ブランド名称</th>
                                <th className="p-5 font-semibold whitespace-nowrap text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {brands.map((brand) => (
                                <tr key={brand.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-medium text-slate-900">{brand.name}</div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(brand)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="編集"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(brand.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="削除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {brands.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="p-12 text-center text-slate-500">
                                        ブランドが登録されていません。
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <BrandModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingBrand}
            />
        </div>
    );
}
