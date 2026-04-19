"use client";

import { useState, useMemo } from "react";
import { Search, Filter, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Package, User } from "lucide-react";
import { useStore, Product } from "@/lib/store";
import { showNotification } from "@/lib/notifications";
import Link from "next/link";

export default function ProductSuppliersPage() {
  const { isLoaded, products, brands, suppliers, updateProduct } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string | "all">("all");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Filter products (exclude trashed)
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (product.isTrashed) return false;
      
      const supplier = suppliers.find(s => s.id === product.supplierId);
      const brand = brands.find(b => b.id === product.brandId);
      const searchTarget = `${product.name} ${product.variantName || ""} ${supplier?.name || ""} ${brand?.name || ""}`.toLowerCase();

      const matchesSearch = searchTarget.includes(searchQuery.toLowerCase());
      const matchesBrand = selectedBrandId === "all" || product.brandId === selectedBrandId;

      return matchesSearch && matchesBrand;
    });
  }, [products, searchQuery, selectedBrandId, brands, suppliers]);

  // Sort by brand then name
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const brandA = brands.find(brand => brand.id === a.brandId)?.name || "";
      const brandB = brands.find(brand => brand.id === b.brandId)?.name || "";
      if (brandA !== brandB) return brandA.localeCompare(brandB);
      return a.name.localeCompare(b.name);
    });
  }, [filteredProducts, brands]);

  const handleSupplierChange = async (productId: string, supplierId: string) => {
    setUpdatingIds(prev => new Set(prev).add(productId));
    try {
      await updateProduct(productId, { supplierId });
      showNotification("仕入先を更新しました");
    } catch (error) {
      console.error("Failed to update supplier:", error);
      showNotification("仕入先の更新に失敗しました", "error");
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  if (!isLoaded) return <div className="p-8">読み込み中...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto min-h-screen bg-slate-50/30">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link 
            href="/products" 
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1e3a8a] transition-colors mb-2 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            商品管理へ戻る
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200">
              <User className="w-6 h-6" />
            </span>
            仕入先の一括設定
          </h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            各商品の仕入先を一覧で効率的に設定できます。変更は即座に保存されます。
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="商品名や現在の仕入先で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-slate-50/50"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="text-slate-400 w-5 h-5 hidden sm:block" />
          <select
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="flex-1 sm:flex-none border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-white text-slate-700 font-bold transition-all cursor-pointer min-w-[200px]"
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

      {/* Main List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-black uppercase tracking-widest bg-slate-50/50">
                <th className="p-5">商品情報</th>
                <th className="p-5">ブランド</th>
                <th className="p-5 w-72">仕入先設定</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedProducts.map((product) => {
                const brand = brands.find(b => b.id === product.brandId);
                const isUpdating = updatingIds.has(product.id);

                return (
                  <tr key={product.id} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center border border-slate-200 text-slate-400">
                          {product.imageUrl ? (
                             /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={product.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                            {product.name}
                          </div>
                          {product.variantName && (
                            <div className="text-xs text-slate-500 font-medium">{product.variantName}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-100/50">
                        {brand?.name || "未設定"}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="relative group/select">
                        <select
                          value={product.supplierId}
                          onChange={(e) => handleSupplierChange(product.id, e.target.value)}
                          disabled={isUpdating}
                          className={`w-full pl-4 pr-10 py-2.5 rounded-xl border appearance-none cursor-pointer transition-all text-sm font-bold
                            ${isUpdating 
                              ? 'bg-slate-50 border-slate-200 text-slate-400' 
                              : 'bg-white border-slate-200 text-slate-700 group-hover/select:border-blue-400 group-hover/select:ring-4 group-hover/select:ring-blue-500/5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm'
                            }`}
                        >
                          <option value="" disabled>仕入先を選択...</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          {isUpdating ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                          ) : (
                            <div className="flex flex-col -gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* Status indicators */}
                        {!isUpdating && product.supplierId && (
                           <div className="absolute -top-1.5 -right-1 flex items-center justify-center w-4 h-4 bg-green-500 text-white rounded-full border-2 border-white shadow-sm scale-0 group-hover/select:scale-100 transition-transform">
                             <CheckCircle2 className="w-2.5 h-2.5" />
                           </div>
                        )}
                        {!product.supplierId && (
                           <div className="absolute -top-1.5 -right-1 flex items-center justify-center w-4 h-4 bg-amber-500 text-white rounded-full border-2 border-white shadow-sm scale-100 group-hover/select:scale-0 transition-transform">
                             <AlertCircle className="w-2.5 h-2.5" />
                           </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedProducts.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-20 text-center text-slate-400 bg-slate-50/20">
                    <div className="flex flex-col items-center gap-3">
                      <Search className="w-10 h-10 text-slate-200" />
                      <p className="font-medium">条件に一致する商品が見つかりませんでした。</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 bg-blue-50/50 border border-blue-100 rounded-2xl p-6 flex gap-5 items-start">
        <div className="p-3 bg-white text-blue-600 rounded-xl shadow-sm border border-blue-100/50">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-black text-blue-900 mb-1.5 uppercase tracking-wider text-sm">スマート設定</h3>
          <p className="text-sm text-blue-800/70 leading-relaxed font-medium">
            この画面での変更はリアルタイムで保存されます。全ての商品の仕入先が正しく設定されていることを確認してください。
            未設定の商品は <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-black">!</span> アイコンが表示されます。
          </p>
        </div>
      </div>
    </div>
  );
}
