"use client";

import { Plus, Edit2, Trash2, Sparkles, Image as ImageIcon, ArrowUpDown, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { useState, useMemo } from "react";
import { useStore, Brand } from "@/lib/store";
import { BrandModal } from "@/components/BrandModal";
import { BrandBrandingHub } from "@/components/BrandBrandingHub";
import { showNotification } from "@/lib/notifications";

export default function BrandsPage() {
    const { isLoaded, brands, products, deleteBrand, restoreBrand, permanentlyDeleteBrand } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
    const [brandingBrand, setBrandingBrand] = useState<Brand | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [showTrash, setShowTrash] = useState(false);

    const brandStats = useMemo(() => {
        return brands
            .filter(b => !!b.isTrashed === showTrash)
            .map(brand => {
                const productCount = products.filter(p => p.brandId === brand.id).length;
                return { ...brand, productCount };
            });
    }, [brands, products, showTrash]);

    const sortedBrands = useMemo(() => {
        if (!sortConfig) return brandStats;

        return [...brandStats].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortConfig.key) {
                case 'name':
                    aValue = a.name;
                    bValue = b.name;
                    break;
                case 'productCount':
                    aValue = a.productCount;
                    bValue = b.productCount;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [brandStats, sortConfig]);

    if (!isLoaded) return <div className="p-8">読み込み中...</div>;

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            setSortConfig(null);
            return;
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
        return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />;
    };

    const handleEdit = (brand: Brand) => {
        setEditingBrand(brand);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingBrand(null);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("このブランドをゴミ箱に移動してもよろしいですか？")) {
            deleteBrand(id);
            showNotification("ゴミ箱に移動しました。");
        }
    };

    const handleRestore = (id: string) => {
        restoreBrand(id);
        showNotification("ブランドを復元しました。");
    };

    const handlePermanentDelete = (id: string) => {
        if (window.confirm("このブランドを完全に削除しますか？この操作は取り消せません。")) {
            permanentlyDeleteBrand(id);
            showNotification("完全に削除しました。");
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ブランド管理</h1>
                    <p className="text-slate-500 mt-1 text-sm">商品のブランド（旧カテゴリー）を管理します。</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowTrash(!showTrash)}
                        className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl shadow-sm active:scale-95 transition-all text-sm border ${showTrash ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    >
                        <Trash2 className="w-4 h-4" />
                        {showTrash ? "戻る" : "ゴミ箱"}
                    </button>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 bg-[#1e3a8a] text-white px-4 py-2.5 rounded-lg hover:bg-blue-800 transition-colors shadow-sm font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        ブランド登録
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-sm bg-white">
                                <th className="p-5 font-semibold whitespace-nowrap w-20">イメージ</th>
                                <th
                                    className="p-5 font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => requestSort('name')}
                                >
                                    <div className="flex items-center gap-2">
                                        ブランド名称 {getSortIcon('name')}
                                    </div>
                                </th>
                                <th
                                    className="p-5 font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors text-right"
                                    onClick={() => requestSort('productCount')}
                                >
                                    <div className="flex items-center justify-end gap-2 text-right">
                                        登録商品数 {getSortIcon('productCount')}
                                    </div>
                                </th>
                                <th className="p-5 font-semibold whitespace-nowrap text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedBrands.map((brand) => (
                                <tr key={brand.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-5 w-20">
                                        {brand.imageUrl ? (
                                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-100 shadow-sm">
                                                <img src={brand.imageUrl} alt={brand.name} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                                                <ImageIcon className="w-5 h-5 text-slate-300" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-5">
                                        <div className="font-medium text-slate-900">{brand.name}</div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                            {brand.productCount} 点
                                        </span>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {brand.isTrashed ? (
                                                <>
                                                    <button
                                                        onClick={() => handleRestore(brand.id)}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title="復元"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDelete(brand.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="完全削除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleEdit(brand)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="編集"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setBrandingBrand(brand)}
                                                        className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                                        title="ブランド・ブランディング"
                                                    >
                                                        <Sparkles className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(brand.id)}
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
                            ))}
                            {brands.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-12 text-center text-slate-500">
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
            {brandingBrand && (
                <BrandBrandingHub
                    isOpen={!!brandingBrand}
                    onClose={() => setBrandingBrand(null)}
                    brand={brandingBrand}
                />
            )}
        </div>
    );
}
