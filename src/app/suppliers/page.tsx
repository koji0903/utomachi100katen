"use client";

import { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Search, Users, Building2, Wheat, ArrowUpDown, ChevronUp, ChevronDown, RotateCcw, Box } from "lucide-react";
import { useStore, Supplier } from "@/lib/store";
import { SupplierModal } from "@/components/SupplierModal";
import { showNotification } from "@/lib/notifications";

export default function SuppliersPage() {
    const { isLoaded, suppliers, deleteSupplier, restoreSupplier, permanentlyDeleteSupplier } = useStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [showTrash, setShowTrash] = useState(false);

    const filteredSuppliers = useMemo(() => {
        return suppliers
            .filter(s => !!s.isTrashed === showTrash)
            .filter((supplier) =>
                supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                supplier.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                supplier.tel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                supplier.pic?.toLowerCase().includes(searchQuery.toLowerCase())
            );
    }, [suppliers, searchQuery, showTrash]);

    const sortedSuppliers = useMemo(() => {
        if (!sortConfig) return filteredSuppliers;

        return [...filteredSuppliers].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortConfig.key) {
                case 'name':
                    aValue = a.name;
                    bValue = b.name;
                    break;
                case 'category':
                    aValue = a.category || "";
                    bValue = b.category || "";
                    break;
                case 'pic':
                    aValue = a.pic || "";
                    bValue = b.pic || "";
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredSuppliers, sortConfig]);

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
        return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-600" /> : <ChevronDown className="w-3 h-3 text-indigo-600" />;
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingSupplier(null);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("この仕入先をゴミ箱に移動してもよろしいですか？")) {
            deleteSupplier(id);
            showNotification("ゴミ箱に移動しました。");
        }
    };

    const handleRestore = (id: string) => {
        restoreSupplier(id);
        showNotification("仕入先を復元しました。");
    };

    const handlePermanentDelete = (id: string) => {
        if (window.confirm("この仕入先を完全に削除しますか？この操作は取り消せません。")) {
            permanentlyDeleteSupplier(id);
            showNotification("完全に削除しました。");
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto">
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
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTrash(!showTrash)}
                        className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl shadow-sm active:scale-95 transition-all text-sm border ${showTrash ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    >
                        <Trash2 className="w-4 h-4" />
                        {showTrash ? "戻る" : "ゴミ箱"}
                    </button>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        仕入先登録
                    </button>
                </div>
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
                                <th
                                    className="p-5 font-semibold cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => requestSort('name')}
                                >
                                    <div className="flex items-center gap-2">
                                        仕入先名 {getSortIcon('name')}
                                    </div>
                                </th>
                                <th
                                    className="p-5 font-semibold cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => requestSort('category')}
                                >
                                    <div className="flex items-center gap-2">
                                        カテゴリー {getSortIcon('category')}
                                    </div>
                                </th>
                                <th
                                    className="p-5 font-semibold cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => requestSort('pic')}
                                >
                                    <div className="flex items-center gap-2">
                                        担当者 {getSortIcon('pic')}
                                    </div>
                                </th>
                                <th className="p-5 font-semibold">電話番号</th>
                                <th className="p-5 font-semibold text-center">取扱商品</th>
                                <th className="p-5 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSuppliers.map((supplier) => (
                                <tr key={supplier.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                                            {supplier.name}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        {supplier.category === 'Manufacturer' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                                <Building2 className="w-3 h-3" /> 委託製造業者
                                            </span>
                                        )}
                                        {supplier.category === 'Producer' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                                <Wheat className="w-3 h-3" /> 一次生産者
                                            </span>
                                        )}
                                        {!supplier.category && <span className="text-xs text-slate-400 italic">未設定</span>}
                                    </td>
                                    <td className="p-5 text-slate-600">
                                        {supplier.pic || <span className="text-slate-400 italic">未登録</span>}
                                    </td>
                                    <td className="p-5 text-slate-600">
                                        {supplier.tel || <span className="text-slate-400 italic">未登録</span>}
                                    </td>
                                    <td className="p-5 text-center">
                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                                            <Box className="w-3 h-3 text-slate-400" />
                                            {supplier.suppliedProducts?.length || 0}
                                            <span className="font-normal text-slate-500">点</span>
                                        </div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {supplier.isTrashed ? (
                                                <>
                                                    <button
                                                        onClick={() => handleRestore(supplier.id)}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title="復元"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDelete(supplier.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="完全削除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
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
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredSuppliers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500">
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
