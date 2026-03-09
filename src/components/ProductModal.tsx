"use client";

import { useState, useEffect, useRef } from "react";
import { X, Save, Box, Image as ImageIcon, UploadCloud, Sparkles, Store, Tag, AlertTriangle, Plus, HelpCircle, Copy, Check, Instagram, Camera, Share2, Layers, RefreshCw, MessageSquare } from "lucide-react";
import { useStore, Product } from "@/lib/store";
import { uploadImageWithCompression } from "@/lib/imageUpload";
import { showNotification } from "@/lib/notifications";

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Product | null;
}

export function ProductModal({ isOpen, onClose, initialData }: ProductModalProps) {
    const { products, brands, suppliers, retailStores, addProduct, updateProduct } = useStore();

    const [activeTab, setActiveTab] = useState<'basic' | 'ec' | 'marketing'>('basic');
    const [instaCopy, setInstaCopy] = useState("");
    const [imagePrompt, setImagePrompt] = useState("");
    const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);

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
        alertThreshold: 20,
        janCode: "",
        isComposite: false,
        components: [] as { productId: string; quantity: number }[],
        productContent: "",
        ingredients: "",
        amount: "",
        storageMethod: "",
        shelfLife: "",
        shippingMethod: "",
        precautions: "",
        dimensions: { width: 0, height: 0, depth: 0 },
    };

    const [formData, setFormData] = useState(defaultFormData);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isGeneratingStory, setIsGeneratingStory] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
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
                    alertThreshold: initialData.alertThreshold ?? 20,
                    janCode: initialData.janCode || "",
                    isComposite: initialData.isComposite || false,
                    components: initialData.components || [],
                    productContent: initialData.productContent || "",
                    ingredients: initialData.ingredients || "",
                    amount: initialData.amount || "",
                    storageMethod: initialData.storageMethod || "",
                    shelfLife: initialData.shelfLife || "",
                    shippingMethod: initialData.shippingMethod || "",
                    precautions: initialData.precautions || "",
                    dimensions: initialData.dimensions || { width: 0, height: 0, depth: 0 },
                });

                setImagePreview(initialData.imageUrl || null);
            } else {
                setFormData({
                    ...defaultFormData,
                    brandId: brands.length > 0 ? brands[0].id : "",
                    supplierId: suppliers.length > 0 ? suppliers[0].id : "",
                    storePrices: [],
                    janCode: "",
                });
                setImagePreview(null);
            }
            setImageFile(null);
            setActiveTab('basic');
            setInstaCopy("");
            setImagePrompt("");
        }
    }, [isOpen, initialData, brands, suppliers]);


    if (!isOpen) return null;

    const handleCopyText = (text: string, message: string) => {
        navigator.clipboard.writeText(text);
        setIsCopying(true);
        setTimeout(() => setIsCopying(false), 2000);
        showNotification(message, "success");
    };

    const handleCopyDetails = () => {
        const dimensionsStr = formData.dimensions.height || formData.dimensions.width || formData.dimensions.depth
            ? `${formData.dimensions.height || 0}mm x ${formData.dimensions.width || 0}mm x ${formData.dimensions.depth || 0}mm`
            : "未設定";

        const text = `
【商品詳細情報】
商品名: ${formData.name} ${formData.variantName}
商品内容: ${formData.productContent || "未設定"}
原材料: ${formData.ingredients || "未設定"}
内容量: ${formData.amount || "未設定"}
保存方法: ${formData.storageMethod || "未設定"}
賞味期限: ${formData.shelfLife || "未設定"}
配送方法: ${formData.shippingMethod || "未設定"}
サイズ: ${dimensionsStr}
注意点: ${formData.precautions || "なし"}
JANコード: ${formData.janCode || "なし"}
`.trim();

        handleCopyText(text, "商品詳細をコピーしました");
    };

    const handleGenerateMarketing = async (mode: 'social' | 'image-prompt') => {
        if (!formData.name || !formData.brandId) {
            alert("「商品名」と「ブランド」を先に入力してください。");
            return;
        }

        setIsGeneratingMarketing(true);
        try {
            const brand = brands.find(b => b.id === formData.brandId);
            const brandName = brand?.name || "不明";

            const response = await fetch("/api/generate-copy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode,
                    name: formData.name,
                    brand: brandName,
                    variant: formData.variantName,
                    producerStory: formData.producerStory,
                    regionBackground: formData.regionBackground,
                    servingSuggestion: formData.servingSuggestion,
                    story: formData.story,
                }),
            });

            const data = await response.json();
            if (data.copy) {
                if (mode === 'social') setInstaCopy(data.copy);
                if (mode === 'image-prompt') setImagePrompt(data.copy);
            }
        } catch (error) {
            console.error("Marketing generation error:", error);
            showNotification("生成に失敗しました", "error");
        } finally {
            setIsGeneratingMarketing(false);
        }
    };

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
                showNotification("商品を更新しました。");
            } else {
                addProduct(finalData);
                showNotification("商品を登録しました。");
            }

            onClose();
        } catch (error: any) {
            console.error("Failed to save product:", error);
            showNotification("保存に失敗しました。\n詳細: " + (error.message || "不明なエラー"), "error");
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
            const brand = brands.find(b => b.id === formData.brandId);
            const brandName = brand?.name || "不明";
            const brandConcept = brand?.concept || "";

            const response = await fetch("/api/generate-story", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    brand: brandName,
                    brandConcept: brandConcept,
                    features: formData.story
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
            alert("ストーリーの生成に失敗しました。");
        } finally {
            setIsGeneratingStory(false);
        }
    };

    const handleApplyBrandBranding = () => {
        const brand = brands.find(b => b.id === formData.brandId);

        if (!brand) {
            alert("ブランドが選択されていないか、データが見つかりません。");
            return;
        }

        if (window.confirm("ブランドのコンセプトとストーリーをこの商品に反映させますか？（現在入力されている内容は上書きされます）")) {
            const nextData = {
                ...formData,
                story: brand.story || formData.story,
                producerStory: brand.concept || formData.producerStory,
            };

            if (brand.imageUrl && !formData.imageUrl) {
                setImagePreview(brand.imageUrl);
                nextData.imageUrl = brand.imageUrl;
            }

            setFormData(nextData);
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

                <div className="flex-1 overflow-y-auto">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-slate-100 px-6 sticky top-0 bg-white z-10">
                        {(['basic', 'ec', 'marketing'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-4 text-sm font-bold transition-all relative ${activeTab === tab ? "text-[#1e3a8a]" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                {tab === 'basic' && "基本情報"}
                                {tab === 'ec' && "詳細・EC連携"}
                                {tab === 'marketing' && (
                                    <span className="flex items-center gap-1.5">
                                        マーケティング支援
                                        <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                                    </span>
                                )}
                                {activeTab === tab && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1e3a8a] animate-in fade-in slide-in-from-bottom-1" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        <form id="product-form" onSubmit={handleSubmit} className="space-y-6">

                            {activeTab === 'basic' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    {/* Image Upload Area */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 block text-xs uppercase tracking-wider">商品画像</label>
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full h-48 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all overflow-hidden relative group"
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
                                                    <p className="text-xs mt-1">JPEG, PNG, HEIC等 (自動で圧縮されます)</p>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleImageChange}
                                                accept="image/*,.heic,.heif"
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

                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-700 block text-xs uppercase tracking-wider">JANコード (13桁)</label>
                                            <input
                                                type="text"
                                                value={formData.janCode}
                                                onChange={(e) => setFormData({ ...formData, janCode: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white"
                                                placeholder="49XXXXXXXXXXX"
                                            />
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
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-700 block">在庫 <span className="text-red-500">*</span></label>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                value={formData.stock || ""}
                                                onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white text-right font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-amber-700 block flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5" /> 在庫しきい値
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.alertThreshold}
                                                onChange={(e) => setFormData({ ...formData, alertThreshold: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all bg-amber-50/30 text-right"
                                            />
                                        </div>
                                    </div>

                                    {/* Store Prices */}
                                    <div className="space-y-3 pt-2">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Store className="w-3.5 h-3.5" /> 店舗別個別価格
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {retailStores.map(store => {
                                                const storePrice = formData.storePrices.find(sp => sp.storeId === store.id)?.price || 0;
                                                return (
                                                    <div key={store.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <span className="text-[11px] font-bold text-slate-500 flex-1 truncate">{store.name}</span>
                                                        <input
                                                            type="number"
                                                            value={storePrice || ""}
                                                            onChange={(e) => handleStorePriceChange(store.id, Number(e.target.value))}
                                                            className="w-20 px-2 py-1.5 text-xs text-right border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/10"
                                                            placeholder="個別価格"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Story Section */}
                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-slate-700">商品ストーリー / 紹介文</label>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={handleApplyBrandBranding}
                                                    className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 border border-blue-100 transition-colors">
                                                    ブランド同期
                                                </button>
                                                <button type="button" onClick={handleGenerateStory} disabled={isGeneratingStory}
                                                    className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1.5 rounded-lg hover:bg-purple-100 border border-purple-100 transition-colors disabled:opacity-50">
                                                    {isGeneratingStory ? "生成中..." : "AI生成"}
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            rows={4}
                                            value={formData.story}
                                            onChange={(e) => setFormData({ ...formData, story: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/10 bg-slate-50 focus:bg-white text-sm leading-relaxed transition-all resize-none"
                                            placeholder="生産者の想いや、地域の背景などを物語として記録します..."
                                        />
                                    </div>

                                    {/* BOM Selection */}
                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <Layers className="w-4 h-4 text-orange-500" />
                                                セット商品（複数構成）
                                            </label>
                                            <input
                                                type="checkbox"
                                                checked={formData.isComposite}
                                                onChange={(e) => setFormData({ ...formData, isComposite: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                            />
                                        </div>
                                        {formData.isComposite && (
                                            <div className="space-y-3 bg-orange-50/30 p-4 rounded-2xl border border-orange-100">
                                                {formData.components.map((comp, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center">
                                                        <select
                                                            value={comp.productId}
                                                            onChange={(e) => {
                                                                const next = [...formData.components];
                                                                next[idx].productId = e.target.value;
                                                                setFormData({ ...formData, components: next });
                                                            }}
                                                            className="flex-1 text-xs border border-slate-300 rounded-lg p-2 bg-white"
                                                        >
                                                            <option value="">商品を選択</option>
                                                            {products.filter(p => p.id !== initialData?.id).map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="number"
                                                            value={comp.quantity}
                                                            onChange={(e) => {
                                                                const next = [...formData.components];
                                                                next[idx].quantity = Number(e.target.value);
                                                                setFormData({ ...formData, components: next });
                                                            }}
                                                            className="w-16 text-xs border border-slate-300 rounded-lg p-2 text-right"
                                                        />
                                                        <button onClick={() => setFormData({ ...formData, components: formData.components.filter((_, i) => i !== idx) })}
                                                            className="p-2 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => setFormData({ ...formData, components: [...formData.components, { productId: "", quantity: 1 }] })}
                                                    className="w-full py-2 bg-white border border-dashed border-orange-200 text-orange-600 font-bold text-[11px] rounded-lg hover:bg-orange-50 mr-2 transition-colors">
                                                    + 構成商品を追加
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'ec' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">商品内容（説明文）</label>
                                            <textarea rows={4} value={formData.productContent} onChange={(e) => setFormData({ ...formData, productContent: e.target.value })}
                                                className="w-full p-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/10" placeholder="ECサイト向けの詳細説明..." />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-700">原材料</label>
                                                <input type="text" value={formData.ingredients} onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                                                    className="w-full p-3 text-sm border border-slate-200 rounded-xl" placeholder="例: 海苔、醤油..." />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-700">内容量</label>
                                                <input type="text" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                    className="w-full p-3 text-sm border border-slate-200 rounded-xl" placeholder="例: 100g, 50枚..." />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-700">保存方法</label>
                                                <input type="text" value={formData.storageMethod} onChange={(e) => setFormData({ ...formData, storageMethod: e.target.value })}
                                                    className="w-full p-3 text-sm border border-slate-200 rounded-xl" placeholder="例: 冷暗所..." />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-700">賞味期限</label>
                                                <input type="text" value={formData.shelfLife} onChange={(e) => setFormData({ ...formData, shelfLife: e.target.value })}
                                                    className="w-full p-3 text-sm border border-slate-200 rounded-xl" placeholder="例: 1年..." />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-700">配送方法</label>
                                                <select value={formData.shippingMethod} onChange={(e) => setFormData({ ...formData, shippingMethod: e.target.value })}
                                                    className="w-full p-3 text-sm border border-slate-200 rounded-xl bg-white">
                                                    <option value="">配送方法を選択</option>
                                                    <option value="Standard">通常便</option>
                                                    <option value="Chilled">冷蔵便</option>
                                                    <option value="Frozen">冷凍便</option>
                                                    <option value="Post">ポスト投函</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-700">注意点</label>
                                                <input type="text" value={formData.precautions} onChange={(e) => setFormData({ ...formData, precautions: e.target.value })}
                                                    className="w-full p-3 text-sm border border-slate-200 rounded-xl" placeholder="例: アレルギー..." />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-slate-700">サイズ情報 (mm)</label>
                                            <div className="grid grid-cols-3 gap-3">
                                                {(['height', 'width', 'depth'] as const).map(dim => (
                                                    <input key={dim} type="number" placeholder={dim === 'height' ? '縦' : dim === 'width' ? '横' : '奥'}
                                                        value={formData.dimensions[dim]} onChange={(e) => setFormData({ ...formData, dimensions: { ...formData.dimensions, [dim]: Number(e.target.value) } })}
                                                        className="p-3 text-sm border border-slate-200 rounded-xl" />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'marketing' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    {/* Instagram Copy Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white">
                                                    <Instagram className="w-5 h-5" />
                                                </div>
                                                <h3 className="font-bold text-slate-800">Instagram 投稿文生成</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleGenerateMarketing('social')}
                                                disabled={isGeneratingMarketing}
                                                className="text-xs font-bold text-white bg-[#1e3a8a] px-4 py-2 rounded-xl hover:bg-blue-800 transition-all flex items-center gap-2 disabled:opacity-50"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                投稿文を生成
                                            </button>
                                        </div>

                                        <div className="relative group">
                                            <textarea
                                                rows={8}
                                                readOnly
                                                value={instaCopy}
                                                className="w-full p-5 text-sm border border-slate-200 rounded-2xl bg-slate-50 leading-relaxed font-medium text-slate-700 focus:bg-white transition-colors"
                                                placeholder="AIがInstagram向けの温かいストーリー投稿文を提案します..."
                                            />
                                            {instaCopy && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyText(instaCopy, "投稿文をコピーしました")}
                                                    className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur border border-slate-200 rounded-lg shadow-sm hover:bg-white transition-all text-slate-500 hover:text-[#1e3a8a]"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 text-center italic">「生産者の想い」や「ストーリー」を詳しく入力するほど、より感動的な文章になります。</p>
                                    </div>

                                    {/* Image Scene Prompt Section */}
                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                                    <Camera className="w-5 h-5" />
                                                </div>
                                                <h3 className="font-bold text-slate-800">撮影・画像構成案</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleGenerateMarketing('image-prompt')}
                                                disabled={isGeneratingMarketing}
                                                className="text-xs font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 border border-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50"
                                            >
                                                <Camera className="w-3.5 h-3.5" />
                                                シーン案を生成
                                            </button>
                                        </div>

                                        <div className="relative group">
                                            <div className="w-full p-5 text-sm border border-slate-200 rounded-2xl bg-emerald-50/20 italic text-emerald-800 leading-relaxed min-h-[100px]">
                                                {imagePrompt || "Instagram映えする商品のコーディネートや、撮影の構図案を生成します。そのままAI画像生成に使用することも可能です。"}
                                            </div>
                                            {imagePrompt && (
                                                <div className="mt-4 flex gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyText(imagePrompt, "プロンプトをコピーしました")}
                                                        className="flex-1 py-2 text-xs font-bold text-emerald-700 bg-white border border-emerald-200 rounded-lg shadow-sm hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" /> プロンプトをコピー
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            showNotification("AIアシスタントにチャットで画像生成を依頼してください", "info");
                                                        }}
                                                        className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5" /> AIに画像を依頼
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </form>
                    </div>
                </div>

                <div className="flex items-center justify-between p-6 border-t border-slate-100 bg-slate-50/30">
                    <button
                        type="button"
                        onClick={handleCopyDetails}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#1e3a8a] bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                    >
                        {isCopying ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                        商品情報をコピー (EC用)
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            form="product-form"
                            disabled={isUploading}
                            className="flex items-center gap-2 px-8 py-2.5 text-sm font-black text-white bg-[#1e3a8a] rounded-xl hover:bg-blue-800 disabled:opacity-50 transition-all shadow-lg shadow-blue-900/10 active:scale-95"
                        >
                            <Save className="w-4 h-4" />
                            {isUploading ? "保存中..." : "保存する"}
                        </button>
                    </div>
                </div>
            </div >
        </div >
    );
}
