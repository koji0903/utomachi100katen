"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Filter, Edit2, Trash2, Image as ImageIcon, Store, Box, HelpCircle, Sparkles, AlertTriangle, History, ArrowUpDown, ChevronUp, ChevronDown, RotateCcw, RefreshCw, User, Layers } from "lucide-react";
import { useStore, Product, Brand, Supplier } from "@/lib/store";
import { ProductModal } from "@/components/ProductModal";
import { BrandingHub } from "@/components/BrandingHub";
import { showNotification } from "@/lib/notifications";
import { apiFetch, DemoModeError, isDemoMode } from "@/lib/apiClient";
import { calculateDaysRemaining, getStockoutStatus } from "@/lib/stockUtils";
import { convertToCSV, parseCSV, downloadCSV } from "@/lib/csvUtils";
import { useRef } from "react";
import Link from "next/link";

export default function ProductsPage() {
  const { isLoaded, products, brands, suppliers, sales, addProduct, updateProduct, deleteProduct, restoreProduct, permanentlyDeleteProduct } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string | "all">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [brandingProduct, setBrandingProduct] = useState<Product | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // Note: The instruction provided a `filteredProducts` definition that uses `selectedBrands`
  // and a different filtering logic. To maintain syntactic correctness and align with the
  // existing `selectedBrandId` state, the `filteredProducts` logic is adapted to use
  // `selectedBrandId` and the original search criteria, while still being wrapped in `useMemo`
  // and moved as requested.
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchTrash = !!product.isTrashed === showTrash;
      // Get the supplier and brand names for searching
      const supplier = suppliers.find(s => s.id === product.supplierId);
      const brand = brands.find(b => b.id === product.brandId);
      const searchTarget = `${product.name} ${product.variantName || ""} ${supplier?.name || ""} ${brand?.name || ""}`.toLowerCase();

      const matchesSearch = searchTarget.includes(searchQuery.toLowerCase());
      const matchesBrand = selectedBrandId === "all" || product.brandId === selectedBrandId;

      return matchesSearch && matchesBrand && matchTrash;
    });
  }, [products, searchQuery, selectedBrandId, brands, suppliers, showTrash]);

  const sortedProducts = useMemo(() => {
    if (!sortConfig) return filteredProducts;

    return [...filteredProducts].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'brand':
          aValue = brands.find(brand => brand.id === a.brandId)?.name || "";
          bValue = brands.find(brand => brand.id === b.brandId)?.name || "";
          break;
        case 'supplier':
          aValue = suppliers.find(s => s.id === a.supplierId)?.name || "";
          bValue = suppliers.find(s => s.id === b.supplierId)?.name || "";
          break;
        case 'price':
          aValue = a.sellingPrice;
          bValue = b.sellingPrice;
          break;
        case 'stock':
          aValue = a.stock;
          bValue = b.stock;
          break;
        case 'tax':
          aValue = a.taxRate === 'reduced' ? 8 : 10;
          bValue = b.taxRate === 'reduced' ? 8 : 10;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredProducts, sortConfig, brands, suppliers]);

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

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleCreateVariant = (product: Product) => {
    setEditingProduct({
      ...product,
      id: "", // Clear ID to trigger addProduct instead of updateProduct
      variantName: "", // Clear variant name so user can input new one
      stock: 0, // Reset stock for new variant
    } as any);
    setIsModalOpen(true);
  };

  const handleExport = () => {
    const exportData = products.map(p => ({
      ID: p.id,
      商品名: p.name,
      バリエーション: p.variantName || "",
      ブランドID: p.brandId,
      ブランド名: brands.find(b => b.id === p.brandId)?.name || "",
      仕入先ID: p.supplierId,
      仕入先名: suppliers.find(s => s.id === p.supplierId)?.name || "",
      仕入価格: p.costPrice,
      販売価格: p.sellingPrice,
      在庫数: p.stock,
      アラート閾値: p.alertThreshold || 20,
      JANコード: p.janCode || "",
      税率: p.taxRate === 'reduced' ? '8%' : '10%',
    }));

    const csvContent = convertToCSV(exportData);
    downloadCSV(csvContent, `products_${new Date().toISOString().slice(0, 10)}.csv`);
    showNotification("商品をCSVで書き出しました。");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const rows = parseCSV(text);
        let updatedCount = 0;
        let addedCount = 0;

        for (const row of rows) {
          const productData = {
            name: row["商品名"],
            variantName: row["バリエーション"],
            brandId: row["ブランドID"],
            supplierId: row["仕入先ID"],
            costPrice: Number(row["仕入価格"]),
            sellingPrice: Number(row["販売価格"]),
            stock: Number(row["在庫数"]),
            alertThreshold: Number(row["アラート閾値"]),
            janCode: row["JANコード"],
            taxRate: row["税率"]?.includes("8") || row["税率"]?.includes("軽減") ? 'reduced' : 'standard',
          };

          if (row["ID"] && products.find(p => p.id === row["ID"])) {
            await updateProduct(row["ID"], productData as any);
            updatedCount++;
          } else {
            await addProduct(productData as any);
            addedCount++;
          }
        }
        showNotification(`インポート完了: 更新 ${updatedCount}件, 新規 ${addedCount}件`);
      } catch (err) {
        console.error("CSV Import error:", err);
        showNotification("CSVの読み込みに失敗しました。形式を確認してください。");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

  const handleDelete = (id: string) => {
    if (confirm("商品をゴミ箱に移動してもよろしいですか？関連するバリエーションも移動されます。")) {
      deleteProduct(id);
      showNotification("ゴミ箱に移動しました。");
    }
  };

  const handleRestore = (id: string) => {
    restoreProduct(id);
    showNotification("商品を復元しました。");
  };

  const handlePermanentDelete = (id: string) => {
    if (confirm("商品を完全に削除しますか？この操作は取り消せません。関連するバリエーションも完全に削除されます。")) {
      permanentlyDeleteProduct(id);
      showNotification("完全に削除しました。");
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div className="relative group">
          <div className="absolute -left-4 top-0 w-1 h-12 bg-blue-600 rounded-full opacity-0 group-hover:opacity-100 transition-all" />
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="bg-gradient-to-br from-blue-600 to-indigo-700 bg-clip-text text-transparent">
              Inventory
            </span>
            <span className="text-slate-300 font-light text-xl">/ 商品管理</span>
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            ウトマチ百貨店の取扱商品を一括管理・分析します
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          {/* Data Actions Group */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/50 border border-slate-200 rounded-2xl">
            <button
              onClick={() => setShowTrash(!showTrash)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-xs border ${showTrash ? 'bg-amber-100 text-amber-700 border-amber-200 shadow-inner' : 'bg-transparent text-slate-400 border-transparent hover:bg-white hover:text-slate-600'}`}
              title="ゴミ箱を表示"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {showTrash ? "戻る" : "ゴミ箱"}
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all border border-transparent hover:border-slate-200 hover:shadow-sm"
            >
              <Box className="w-3.5 h-3.5" />
              エクスポート
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all border border-transparent hover:border-slate-200 hover:shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              インポート
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".csv"
            className="hidden"
          />

          {/* Sync & Settings Group */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/50 border border-slate-200 rounded-2xl">
            <button
              onClick={async () => {
                if (!confirm("Amazonとの同期を開始しますか？")) return;
                try {
                  showNotification("Amazonと同期中...");
                  const res = await apiFetch("/api/amazon/sync", { method: "POST" });
                  const data = await res.json();
                  if (data.success) {
                    showNotification(`同期完了: 商品 ${data.syncedProducts.length}件, 新規注文 ${data.newOrdersCount}件\n「取引管理」ページで確認できます。`);
                  } else {
                    throw new Error(data.error);
                  }
                } catch (err: any) {
                  if (err instanceof DemoModeError) {
                    showNotification("デモ中はAmazon同期をご利用いただけません。", "error");
                  } else {
                    showNotification("同期に失敗しました。", "error");
                  }
                }
              }}
              className="flex items-center gap-2 bg-transparent text-amber-600/80 hover:bg-white hover:text-amber-700 px-4 py-2 rounded-xl border border-transparent hover:border-amber-100 transition-all shadow-sm font-bold text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Amazon同期
            </button>
            <Link
              href="/products/suppliers"
              className="flex items-center gap-2 bg-transparent text-slate-500 hover:bg-white hover:text-slate-700 px-4 py-2 rounded-xl border border-transparent hover:border-slate-200 transition-all shadow-sm font-bold text-xs"
            >
              <User className="w-3.5 h-3.5" />
              仕入先
            </Link>
          </div>

          {/* Manufacturing & Conversion Group (Prominent) */}
          <div className="flex items-center gap-2 p-1.5 bg-blue-50/50 border border-blue-100 rounded-[20px] shadow-sm">
            <Link
              href="/products/composite-production"
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-all shadow-md shadow-orange-200 font-black text-xs uppercase tracking-wider"
            >
              <Layers className="w-4 h-4" />
              商品の制作
            </Link>
            <Link
              href="/products/conversion"
              className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2.5 rounded-xl border border-blue-100 hover:bg-blue-50 transition-all shadow-sm font-black text-xs uppercase tracking-wider"
            >
              <History className="w-4 h-4" />
              在庫変換
            </Link>
          </div>

          {/* Main Action */}
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 hover:shadow-blue-200 font-black text-sm active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            新規登録
          </button>
        </div>
      </div>

      {/* Usage Guide for Staff */}
      <div className="mb-10 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 rounded-[28px] p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="p-3 bg-white text-blue-600 rounded-2xl shadow-sm shrink-0 border border-blue-100">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div className="text-sm">
          <h3 className="font-black text-blue-900 mb-2 uppercase tracking-wider flex items-center gap-2">
            Operation Guide
            <span className="text-blue-400 font-medium normal-case tracking-normal">/ 操作ガイド</span>
          </h3>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-blue-800/70 font-medium">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                <Edit2 className="w-3.5 h-3.5 text-blue-700" />
              </div>
              <span><span className="font-bold text-blue-900 underline decoration-blue-200 underline-offset-4">編集</span>: 既存情報の修正（誤字脱字など）</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-violet-700" />
              </div>
              <span><span className="font-bold text-violet-900 underline decoration-violet-200 underline-offset-4">ブランディング</span>: AIによるPR文生成・情報管理</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
                <Box className="w-3.5 h-3.5 text-purple-700" />
              </div>
              <span><span className="font-bold text-purple-900 underline decoration-purple-200 underline-offset-4">バリエーション</span>: 容量違い・容器違いの追加</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table Container */}
      <div className="hidden sm:block bg-white rounded-[32px] shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 bg-slate-50/30">
          <div className="relative flex-1 max-w-lg group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="text"
              placeholder="商品名や仕入先で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-medium"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 pl-4 pr-1 py-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <Filter className="text-slate-400 w-4 h-4" />
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 pr-8 py-2 focus:outline-none cursor-pointer appearance-none"
              >
                <option value="all">すべてのブランド</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <div className="pr-3 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-sm bg-white">
                <th
                  className="p-5 font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('name')}
                >
                  <div className="flex items-center gap-2">
                    商品名 {getSortIcon('name')}
                  </div>
                </th>
                <th
                  className="p-5 font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('brand')}
                >
                  <div className="flex items-center gap-2">
                    ブランド {getSortIcon('brand')}
                  </div>
                </th>
                <th
                  className="p-5 font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('supplier')}
                >
                  <div className="flex items-center gap-2">
                    仕入先 {getSortIcon('supplier')}
                  </div>
                </th>
                <th
                  className="p-5 font-semibold text-right whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('price')}
                >
                  <div className="flex items-center justify-end gap-2">
                    価格 (税込) {getSortIcon('price')}
                  </div>
                </th>
                <th
                  className="p-5 font-semibold text-center whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('tax')}
                >
                  <div className="flex items-center justify-center gap-2">
                    税率 {getSortIcon('tax')}
                  </div>
                </th>
                <th
                  className="p-5 font-semibold text-right whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('stock')}
                >
                  <div className="flex items-center justify-end gap-2">
                    在庫 {getSortIcon('stock')}
                  </div>
                </th>
                <th className="p-5 font-semibold text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product) => {
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
                        <div className="font-medium text-slate-900 group-hover:text-[#1e3a8a] transition-colors leading-tight">
                          {product.name}
                          {product.variantName && (
                            <span className="block text-xs text-slate-500 font-normal mt-0.5">
                              {product.variantName}
                            </span>
                          )}
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
                    <td className="p-5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${product.taxRate === 'reduced' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                        {product.taxRate === 'reduced' ? '8%' : '10%'}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold ${product.stock <= (product.alertThreshold ?? 20) ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-slate-700'}`}>
                          {product.stock}個
                        </span>
                        {(() => {
                          const days = calculateDaysRemaining(product, sales);
                          const status = getStockoutStatus(days);
                          return (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                              {status.label}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {product.isTrashed ? (
                          <>
                            <button
                              onClick={() => handleRestore(product.id)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="復元"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(product.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="完全削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(product)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="編集"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setBrandingProduct(product)}
                              className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                              title="ブランディングハブ：AIでPR文章を生成"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCreateVariant(product)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="バリエーションを作成"
                            >
                              <Box className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
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

      <div className="sm:hidden space-y-3 mt-4">
        {sortedProducts.map((product) => {
          const brand = brands.find(b => b.id === product.brandId);
          const supplier = suppliers.find(s => s.id === product.supplierId);
          return (
            <div key={product.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200 flex items-center justify-center">
                  {product.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 leading-tight">{product.name}</div>
                  {product.variantName && (
                    <div className="text-xs text-slate-500 mt-0.5">{product.variantName}</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {brand?.name || "不明"}
                    </span>
                    <span className="text-xs text-slate-500">{supplier?.name || "不明"}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${product.taxRate === 'reduced' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                      {product.taxRate === 'reduced' ? '8%' : '10%'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="font-bold text-slate-900">¥{product.sellingPrice.toLocaleString()}</div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${product.stock <= (product.alertThreshold ?? 20) ? 'bg-amber-50 text-amber-700' : 'text-slate-600'}`}>
                        在庫 {product.stock}個
                      </span>
                      {(() => {
                        const days = calculateDaysRemaining(product, sales);
                        const status = getStockoutStatus(days);
                        return (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                {product.isTrashed ? (
                  <>
                    <button onClick={() => handleRestore(product.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                      <RotateCcw className="w-3.5 h-3.5" /> 復元
                    </button>
                    <button onClick={() => handlePermanentDelete(product.id)} className="p-1.5 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> 完全削除
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleEdit(product)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> 編集
                    </button>
                    <button onClick={() => setBrandingProduct(product)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors">
                      <Sparkles className="w-3.5 h-3.5" /> PR
                    </button>
                    <button onClick={() => handleCreateVariant(product)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                      <Box className="w-3.5 h-3.5" /> 追加
                    </button>
                    <button onClick={() => handleDelete(product.id)} className="p-1.5 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">条件に一致する商品が見つかりませんでした。</p>
          </div>
        )}
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingProduct}
      />
      {brandingProduct && (
        <BrandingHub
          isOpen={!!brandingProduct}
          onClose={() => setBrandingProduct(null)}
          product={brandingProduct}
        />
      )}
    </div>
  );
}
