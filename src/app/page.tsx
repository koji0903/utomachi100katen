"use client";

import { useState } from "react";
import { Plus, Search, Filter, Edit2, Trash2, Image as ImageIcon, Store } from "lucide-react";
import { useStore, Product } from "@/lib/store";
import { ProductModal } from "@/components/ProductModal";

export default function ProductsPage() {
  const { isLoaded, products, brands, suppliers, deleteProduct } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string | "all">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  if (!isLoaded) return <div className="p-8">読み込み中...</div>;

  const filteredProducts = products.filter((product) => {
    // Get the supplier and brand names for searching
    const supplier = suppliers.find(s => s.id === product.supplierId);
    const brand = brands.find(b => b.id === product.brandId);
    const searchTarget = `${product.name} ${supplier?.name || ""} ${brand?.name || ""}`.toLowerCase();

    const matchesSearch = searchTarget.includes(searchQuery.toLowerCase());
    const matchesBrand = selectedBrandId === "all" || product.brandId === selectedBrandId;

    return matchesSearch && matchesBrand;
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("この商品を削除してもよろしいですか？")) {
      deleteProduct(id);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">商品管理</h1>
          <p className="text-slate-500 mt-1 text-sm">ウトマチ百貨店の取扱商品を管理します。</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-[#1e3a8a] text-white px-4 py-2.5 rounded-lg hover:bg-blue-800 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          商品登録
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Filters */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="商品名や仕入先で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-slate-400 w-5 h-5" />
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] bg-white text-slate-700 font-medium transition-all cursor-pointer"
            >
              <option value="all">すべてのブランド</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-sm bg-white">
                <th className="p-5 font-semibold whitespace-nowrap">商品名</th>
                <th className="p-5 font-semibold whitespace-nowrap">ブランド</th>
                <th className="p-5 font-semibold whitespace-nowrap">仕入先</th>
                <th className="p-5 font-semibold text-right whitespace-nowrap">価格 (税込)</th>
                <th className="p-5 font-semibold text-right whitespace-nowrap">在庫</th>
                <th className="p-5 font-semibold text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const brand = brands.find(b => b.id === product.brandId);
                const supplier = suppliers.find(s => s.id === product.supplierId);

                return (
                  <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200 flex items-center justify-center">
                          {product.imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="font-medium text-slate-900 group-hover:text-[#1e3a8a] transition-colors">
                          {product.name}
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {brand ? brand.name : "不明"}
                      </span>
                    </td>
                    <td className="p-5 text-slate-600">{supplier ? supplier.name : "不明"}</td>
                    <td className="p-5 text-right flex flex-col items-end gap-1">
                      <div className="font-semibold text-slate-900">
                        ¥{product.sellingPrice.toLocaleString()}
                      </div>
                      {product.storePrices && product.storePrices.some(sp => sp.price > 0) && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded border border-pink-100">
                          <Store className="w-2.5 h-2.5" />
                          店舗別価格あり
                        </div>
                      )}
                    </td>
                    <td className="p-5 text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${product.stock < 50 ? 'bg-red-50 text-red-700 border border-red-100' : 'text-slate-700'}`}>
                        {product.stock}個
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="編集"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
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
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <Search className="w-8 h-8 text-slate-300" />
                      <p>条件に一致する商品が見つかりませんでした。</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingProduct}
      />
    </div>
  );
}
