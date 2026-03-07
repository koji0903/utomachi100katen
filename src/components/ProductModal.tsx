"use client";

import { useState, useEffect, useRef } from "react";
import { X, Save, Box, Image as ImageIcon, UploadCloud, Sparkles, Store } from "lucide-react";
import { useStore, Product } from "@/lib/store";
import { uploadImageWithCompression } from "@/lib/imageUpload";

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Product | null;
}

export function ProductModal({ isOpen, onClose, initialData }: ProductModalProps) {
    const { brands, suppliers, retailStores, addProduct, updateProduct } = useStore();

    const defaultFormData = {
        name: "",
        variantName: "",
        brandId: "",
        supplierId: "",
        costPrice: 0,
        sellingPrice: 0,
        storePrices: [] as { storeId: string; price: number }[],
        stock: 0,
        story: "",
        producerStory: "",
        regionBackground: "",
        servingSuggestion: "",
        imageUrl: "",
        taxRate: 'standard' as 'standard' | 'reduced',
    };

    const [formData, setFormData] = useState(defaultFormData);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isGeneratingStory, setIsGeneratingStory] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Set default values when data loads or modal opens
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name,
                    variantName: initialData.variantName || "",
                    brandId: initialData.brandId,
                    supplierId: initialData.supplierId,
                    costPrice: initialData.costPrice,
                    sellingPrice: initialData.sellingPrice,
                    storePrices: initialData.storePrices || [],
                    stock: initialData.stock,
                    story: initialData.story || "",
                    producerStory: initialData.producerStory || "",
                    regionBackground: initialData.regionBackground || "",
                    servingSuggestion: initialData.servingSuggestion || "",
                    imageUrl: initialData.imageUrl || "",
                    taxRate: initialData.taxRate || 'standard',
                });

                setImagePreview(initialData.imageUrl || null);
            } else {
                setFormData({
                    ...defaultFormData,
                    brandId: brands.length > 0 ? brands[0].id : "",
                    supplierId: suppliers.length > 0 ? suppliers[0].id : "",
                    storePrices: [],
                });
                setImagePreview(null);
            }
            setImageFile(null);
        }
    }, [isOpen, initialData, brands, suppliers]);

    if (!isOpen) return null;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUploading(true);
        let currentImageUrl = formData.imageUrl;

        try {
            if (imageFile) {
                currentImageUrl = await uploadImageWithCompression(imageFile);
            }

            const finalData = { ...formData, imageUrl: currentImageUrl };

            if (initialData && initialData.id) {
                updateProduct(initialData.id, finalData);
            } else {
                addProduct(finalData);
            }

            onClose();
        } catch (error) {
            console.error("Failed to save product:", error);
            alert("画像のアップロードまたは商品の保存に失敗しました。");
        } finally {
            setIsUploading(false);
        }
    };

    const handleGenerateStory = async () => {
        if (!formData.name || !formData.brandId) {
            alert("「商品名」と「ブランド」を先に入力してください。");
            return;
        }

        setIsGeneratingStory(true);
        try {
            const brand = brands.find(b => b.id === formData.brandId)?.name || "不明";

            const response = await fetch("/api/generate-story", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    brand: brand,
                    features: formData.story // Pass existing story as features if any
                }),
            });

            if (!response.ok) {
                throw new Error("API request failed");
            }

            const data = await response.json();
            if (data.story) {
                setFormData(prev => ({ ...prev, story: data.story }));
            }
        } catch (error) {
            console.error("Story generation error:", error);
            alert("ストーリーの生成に失敗しました。時間をおいて再実行してください。");
        } finally {
            setIsGeneratingStory(false);
        }
    };

    const handleStorePriceChange = (storeId: string, price: number) => {
        setFormData(prev => {
            const existing = prev.storePrices.find(sp => sp.storeId === storeId);
            let newStorePrices;
            if (existing) {
                newStorePrices = prev.storePrices.map(sp =>
                    sp.storeId === storeId ? { ...sp, price } : sp
                );
            } else {
                newStorePrices = [...prev.storePrices, { storeId, price }];
            }
            return { ...prev, storePrices: newStorePrices };
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-[#1e3a8a] rounded-lg">
                            <Box className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                            {initialData ? "商品編集" : "新規商品登録"}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <form id="product-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Image Upload Area */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">商品画像</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-48 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all overflow-hidden relative group"
                            >
                                {imagePreview ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-white text-sm font-medium flex items-center gap-2">
                                                <UploadCloud className="w-4 h-4" /> 画像を変更
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400 p-4 text-center">
                                        <ImageIcon className="w-10 h-10 mb-3 text-slate-300" />
                                        <p className="text-sm font-medium text-slate-600">クリックして画像をアップロード</p>
                                        <p className="text-xs mt-1">JPEG, PNG等 (自動で圧縮されます)</p>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">商品名 <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white"
                                    placeholder="例: 宇土の恵み 焼き海苔"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">タイプ・容器・重量</label>
                                <input
                                    type="text"
                                    value={formData.variantName}
                                    onChange={(e) => setFormData({ ...formData, variantName: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white"
                                    placeholder="例: メガボトル, クラフト, 100g"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">ブランド <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    value={formData.brandId}
                                    onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white cursor-pointer"
                                >
                                    <option value="" disabled>ブランドを選択</option>
                                    {brands.map((brand) => (
                                        <option key={brand.id} value={brand.id}>
                                            {brand.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-semibold text-slate-700 block">仕入先 <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    value={formData.supplierId}
                                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white cursor-pointer"
                                >
                                    <option value="" disabled>仕入先を選択</option>
                                    {suppliers.map((supplier) => (
                                        <option key={supplier.id} value={supplier.id}>
                                            {supplier.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">原価 (円) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={formData.costPrice || ""}
                                    onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white text-right"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">販売価格 (円) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={formData.sellingPrice || ""}
                                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white text-right"
                                    placeholder="0"
                                />
                            </div>

                            {/* Tax Rate */}
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-semibold text-slate-700 block">消費税区分</label>
                                <div className="flex gap-3">
                                    {([['standard', '標準税率（10%）', 'bg-blue-50 border-blue-400 text-blue-700'], ['reduced', '軽減税率（8%）★', 'bg-green-50 border-green-400 text-green-700']] as const).map(([val, label, activeClasses]) => (
                                        <label key={val} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer text-sm font-medium transition-all flex-1 justify-center ${formData.taxRate === val
                                                ? activeClasses + ' shadow-sm'
                                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                                            }`}>
                                            <input
                                                type="radio"
                                                name="taxRate"
                                                value={val}
                                                checked={formData.taxRate === val}
                                                onChange={() => setFormData({ ...formData, taxRate: val })}
                                                className="sr-only"
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-400">★ 軽減税率: 食品・飲料（酒類除く）、定期購読新聞など</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">在庫 <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={formData.stock || ""}
                                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white text-right"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Store Specific Prices */}
                        <div className="space-y-4 border-t border-slate-100 pt-6">
                            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                                <Store className="w-4 h-4 text-pink-500" />
                                販売店舗別価格設定
                            </h3>
                            {retailStores.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">「販売店舗管理」で店舗を登録すると、ここで個別の価格を設定できます。</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {retailStores.map(store => {
                                        const storePrice = formData.storePrices.find(sp => sp.storeId === store.id)?.price || 0;
                                        return (
                                            <div key={store.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                <label className="text-sm font-medium text-slate-600 mb-2 block">{store.name}</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={storePrice || ""}
                                                        onChange={(e) => handleStorePriceChange(store.id, Number(e.target.value))}
                                                        className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-right text-sm"
                                                        placeholder="店舗別価格"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-semibold text-slate-700 block">
                                    ストーリー <span className="text-slate-400 text-xs font-normal ml-2">任意</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleGenerateStory}
                                    disabled={isGeneratingStory}
                                    className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-full font-medium transition-colors disabled:opacity-50"
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    {isGeneratingStory ? "生成中..." : "AIで自動生成"}
                                </button>
                            </div>
                            <textarea
                                rows={3}
                                value={formData.story}
                                onChange={(e) => setFormData({ ...formData, story: e.target.value })}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white resize-none"
                                placeholder="商品の背景や生産者の想いをご記入ください..."
                            />
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        type="submit"
                        form="product-form"
                        disabled={isUploading}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-[#1e3a8a] rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/50 transition-colors shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        {isUploading ? "保存中..." : "保存する"}
                    </button>
                </div>
            </div>
        </div>
    );
}
