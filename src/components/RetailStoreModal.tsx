"use client";

import { useState, useEffect, useRef } from "react";
import { X, Save, Store, MapPin, Loader2, CheckCircle, AlertCircle, Plus, Image as ImageIcon, UploadCloud, Search, Check, Tag } from "lucide-react";
import { useStore, RetailStore, Product } from "@/lib/store";
import { useZipCode } from "@/lib/useZipCode";
import { NumberInput } from "@/components/NumberInput";
import { uploadImageWithCompression, ensureProcessableImage } from "@/lib/imageUpload";
import { showNotification } from "@/lib/notifications";
import { apiFetch, DemoModeError } from "@/lib/apiClient";

interface RetailStoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: RetailStore | null;
}

const BRAND = "#b27f79";

export function RetailStoreModal({ isOpen, onClose, initialData }: RetailStoreModalProps) {
    const { addRetailStore, updateRetailStore } = useStore();
    const { zipStatus, lookupZip } = useZipCode();

    const [formData, setFormData] = useState({
        name: "",
        zipCode: "",
        address: "",
        tel: "",
        email: "",
        pic: "",
        memo: "",
        commissionRate: 15,
        lat: undefined as number | undefined,
        lng: undefined as number | undefined,
        imageUrls: [] as string[],
        type: 'A' as 'A' | 'B' | 'C',
        pricingRule: 0,
        activeProductIds: [] as string[],
        useDifferentBilling: false,
        billingName: "",
        billingZipCode: "",
        billingAddress: "",
        billingTel: "",
        dailySalesGoal: 0,
        honorific: '御中' as '様' | '御中',
        squareLocationId: "",
        wholesaleRate: 60,
    });
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [geoResult, setGeoResult] = useState<"ok" | "error" | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const geocodeAbortControllerRef = useRef<AbortController | null>(null);

    // Image handling
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<{ url: string; fileIndex?: number; isExisting?: boolean }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name || "",
                    zipCode: initialData.zipCode || "",
                    address: initialData.address || "",
                    tel: initialData.tel || "",
                    email: initialData.email || "",
                    pic: initialData.pic || "",
                    memo: initialData.memo || "",
                    commissionRate: initialData.commissionRate ?? 15,
                    lat: initialData.lat,
                    lng: initialData.lng,
                    imageUrls: initialData.imageUrls || [],
                    type: initialData.type || 'A',
                    pricingRule: initialData.pricingRule ?? 0,
                    activeProductIds: initialData.activeProductIds || [],
                    useDifferentBilling: initialData.useDifferentBilling || false,
                    billingName: initialData.billingName || "",
                    billingZipCode: initialData.billingZipCode || "",
                    billingAddress: initialData.billingAddress || "",
                    billingTel: initialData.billingTel || "",
                    dailySalesGoal: initialData.dailySalesGoal || 0,
                    honorific: initialData.honorific || '御中',
                    squareLocationId: initialData.squareLocationId || "",
                    wholesaleRate: initialData.wholesaleRate ?? 60,
                });
                setPreviews((initialData.imageUrls || []).map(url => ({ url, isExisting: true })));
            } else {
                setFormData({ name: "", zipCode: "", address: "", tel: "", email: "", pic: "", memo: "", commissionRate: 15, lat: undefined, lng: undefined, imageUrls: [], type: 'A', pricingRule: 0, activeProductIds: [], useDifferentBilling: false, billingName: "", billingZipCode: "", billingAddress: "", billingTel: "", dailySalesGoal: 0, honorific: '御中', squareLocationId: "", wholesaleRate: 60 });
                setPreviews([]);
            }
            setImageFiles([]);
            setGeoResult(null);
        }
    }, [isOpen, initialData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (geocodeAbortControllerRef.current) {
                geocodeAbortControllerRef.current.abort();
            }
        };
    }, []);

    if (!isOpen) return null;

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        // Process files (convert HEIC if necessary)
        const processedFiles: File[] = [];
        for (const file of selectedFiles) {
            const processed = await ensureProcessableImage(file);
            processedFiles.push(processed);
        }

        const newFiles = [...imageFiles, ...processedFiles];
        setImageFiles(newFiles);

        const newPreviews = processedFiles.map((file, i) => ({
            url: URL.createObjectURL(file),
            fileIndex: imageFiles.length + i,
            isExisting: false
        }));
        setPreviews([...previews, ...newPreviews]);

        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeImage = (index: number) => {
        const nextPreviews = [...previews];
        nextPreviews.splice(index, 1);
        setPreviews(nextPreviews);
    };

    // When zip changes and reaches 7 digits, auto-fill address
    const handleZipChange = (raw: string) => {
        // Format as XXX-XXXX automatically
        const digits = raw.replace(/\D/g, "").slice(0, 7);
        const formatted = digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
        setFormData(prev => ({ ...prev, zipCode: formatted, lat: undefined, lng: undefined }));
        lookupZip(digits, ({ full }) => {
            setFormData(prev => ({ ...prev, address: full, lat: undefined, lng: undefined }));
        });
    };

    const handleBillingZipChange = (raw: string) => {
        const digits = raw.replace(/\D/g, "").slice(0, 7);
        const formatted = digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
        setFormData(prev => ({ ...prev, billingZipCode: formatted }));
        lookupZip(digits, ({ full }) => {
            setFormData(prev => ({ ...prev, billingAddress: full }));
        });
    };


    const handleGeocode = async () => {
        const addr = formData.address.trim();
        if (!addr) return;

        // Abort previous request
        if (geocodeAbortControllerRef.current) {
            geocodeAbortControllerRef.current.abort();
        }
        const controller = new AbortController();
        geocodeAbortControllerRef.current = controller;

        setIsGeocoding(true);
        setGeoResult(null);
        try {
            const res = await apiFetch("/api/geocode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address: addr }),
                signal: controller.signal
            });
            if (!res.ok) throw new Error();
            const { lat, lng } = await res.json();
            setFormData(prev => ({ ...prev, lat, lng }));
            setGeoResult("ok");
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
            if (err instanceof DemoModeError) {
                setGeoResult("error");
                return;
            }
            setGeoResult("error");
        } finally {
            if (controller.signal.aborted) return;
            setIsGeocoding(false);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // Upload new images
            const finalImageUrls: string[] = [];
            for (const p of previews) {
                if (p.isExisting) {
                    finalImageUrls.push(p.url);
                } else if (p.fileIndex !== undefined) {
                    const url = await uploadImageWithCompression(imageFiles[p.fileIndex], "stores");
                    finalImageUrls.push(url);
                }
            }

            const finalData = {
                ...formData,
                imageUrls: finalImageUrls,
                commissionRate: formData.type === 'A' ? formData.commissionRate : 0
            };

            if (initialData) {
                await updateRetailStore(initialData.id, finalData);
                showNotification("店舗情報を更新しました。");
            } else {
                await addRetailStore(finalData);
                showNotification("店舗・事業者を登録しました。");
            }
            onClose();
        } catch (error: any) {
            console.error("Failed to save store:", error);
            showNotification("保存に失敗しました。\n詳細: " + (error.message || "不明なエラー"), "error");
        } finally {
            setIsSaving(false);
        }
    };

    const inputCls = "w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-slate-50 focus:bg-white";

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl" style={{ backgroundColor: "#fdf5f5" }}>
                            <Store className="w-5 h-5" style={{ color: BRAND }} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">
                            {initialData ? "店舗・事業者情報を編集" : "新規販売店舗・事業者登録"}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto p-6">
                    <form id="retailstore-form" onSubmit={handleSubmit} className="space-y-5">

                        {/* 店舗写真 */}
                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-600">店舗・事業者写真</label>
                            <div className="flex flex-wrap gap-3">
                                {previews.map((p, i) => (
                                    <div key={i} className="w-24 h-24 rounded-xl border border-slate-200 overflow-hidden relative group">
                                        <img src={p.url} alt={`Store ${i}`} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(i)}
                                            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-slate-300 transition-all"
                                >
                                    <Plus className="w-6 h-6 mb-1" />
                                    <span className="text-[10px] font-bold">写真を追加</span>
                                </button>
                            </div>
                            <input type="file" multiple ref={fileInputRef} onChange={handleImageChange} accept="image/*,.heic,.heif" className="hidden" />
                            <p className="text-[10px] text-slate-400">
                                店舗の外観や内装の写真を複数登録できます。一覧画面には1枚目が表示されます。
                            </p>
                        </div>

                        {/* 店舗種別 */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">店舗種別 <span className="text-red-400">*</span></label>
                            <div className="flex gap-4">
                                {(['A', 'B', 'C'] as const).map(t => (
                                    <label key={t} className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="radio"
                                                name="storeType"
                                                checked={formData.type === t}
                                                onChange={() => setFormData({ ...formData, type: t })}
                                                className="peer appearance-none w-5 h-5 border-2 border-slate-200 rounded-full checked:border-[#b27f79] transition-all"
                                            />
                                            <div className="absolute w-2.5 h-2.5 bg-[#b27f79] rounded-full scale-0 peer-checked:scale-100 transition-transform" />
                                        </div>
                                        <span className={`text-sm font-medium transition-colors ${formData.type === t ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"}`}>
                                            {t === 'A' ? "委託販売 (A)" : t === 'B' ? "卸販売 (B)" : "直営 (C)"}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                                {formData.type === 'A'
                                    ? "売上発生時に販売手数料が計算されます。"
                                    : formData.type === 'B'
                                        ? "日報で商品を補充した時点で売上（手数料 0%）として計上されます。"
                                        : "自社での直接販売（手数料 0%）として扱われます。"}
                            </p>
                        </div>

                        {/* Square 連携設定 (直営店のみ) */}
                        {formData.type === 'C' && (
                            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                                        <Store className="w-3.5 h-3.5" />
                                    </div>
                                    <label className="text-sm font-bold text-slate-800">Square 連携設定</label>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Square Location ID</label>
                                    <input
                                        type="text"
                                        value={formData.squareLocationId}
                                        onChange={e => setFormData({ ...formData, squareLocationId: e.target.value })}
                                        className={inputCls}
                                        placeholder="例: L9QRG..."
                                    />
                                    <p className="text-[10px] text-purple-600/70 mt-1.5 leading-relaxed">
                                        このIDが設定されている店舗では、Squareの売上データ同期が可能になります。
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-semibold text-slate-600">店舗・事業者名 <span className="text-red-400">*</span></label>
                                <div className="flex gap-4">
                                    {(['様', '御中'] as const).map(h => (
                                        <label key={h} className="flex items-center gap-1.5 cursor-pointer group">
                                            <input
                                                type="radio"
                                                checked={formData.honorific === h}
                                                onChange={() => setFormData({ ...formData, honorific: h })}
                                                className="w-3.5 h-3.5 text-[#b27f79] focus:ring-[#b27f79]"
                                            />
                                            <span className="text-xs font-medium text-slate-600">{h}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <input type="text" required value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className={inputCls} placeholder="例: 道の駅 宇土マリーナ" />
                        </div>

                        {/* ① 郵便番号（先に入力 → 住所自動補完） */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                郵便番号
                                <span className="ml-1.5 text-[10px] font-normal text-slate-400">入力すると住所を自動補完します</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={formData.zipCode}
                                    onChange={e => handleZipChange(e.target.value)}
                                    className={inputCls}
                                    placeholder="869-0401"
                                    maxLength={8}
                                    inputMode="numeric"
                                />
                                {/* Status icon */}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {zipStatus === "loading" && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                                    {zipStatus === "ok" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                    {zipStatus === "notfound" && <AlertCircle className="w-4 h-4 text-amber-400" />}
                                    {zipStatus === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
                                </div>
                            </div>
                            {zipStatus === "notfound" && <p className="text-[11px] text-amber-500 mt-1">郵便番号が見つかりませんでした</p>}
                        </div>

                        {/* ② 住所（自動補完 or 手動） */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                <MapPin className="w-3 h-3 inline mr-1" />住所
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value, lat: undefined, lng: undefined })}
                                    className={`${inputCls} flex-1`}
                                    placeholder="郵便番号を入力すると自動補完されます"
                                />
                                {/* Geocode button */}
                                <button
                                    type="button"
                                    onClick={handleGeocode}
                                    disabled={isGeocoding || !formData.address}
                                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-xl transition-all disabled:opacity-50"
                                    style={{ backgroundColor: BRAND }}
                                    title="住所から緯度経度を取得（天気表示に必要）"
                                >
                                    {isGeocoding
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : geoResult === "ok"
                                            ? <CheckCircle className="w-3.5 h-3.5" />
                                            : <MapPin className="w-3.5 h-3.5" />
                                    }
                                    {isGeocoding ? "" : geoResult === "ok" ? "取得済" : "位置取得"}
                                </button>
                            </div>
                            {formData.lat && formData.lng && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                    📍 {formData.lat.toFixed(4)}, {formData.lng.toFixed(4)} — 天気の自動取得が有効です
                                </p>
                            )}
                            {geoResult === "error" && (
                                <p className="text-[11px] text-red-400 mt-1">
                                    位置情報の取得に失敗しました。住所を確認するか、APIキーを設定してください。
                                </p>
                            )}
                        </div>

                        {/* 手数料 */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                {formData.type === 'A' ? "販売手数料率 (%)" : "卸売・直営時は 0% 固定"} <span className="text-red-400">*</span>
                            </label>
                            <NumberInput required min={0} max={100}
                                value={formData.type === 'A' ? formData.commissionRate : 0}
                                disabled={formData.type !== 'A'}
                                onChange={val => setFormData({ ...formData, commissionRate: val ?? 0 })}
                                className={`${inputCls} text-right disabled:bg-slate-100 disabled:text-slate-400 transition-colors`} />
                        </div>

                        {/* 1日の売上目標額 */}
                        <div className="animate-in slide-in-from-left-2 duration-300">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                1日の売上目標額 (円)
                            </label>
                            <NumberInput
                                min={0}
                                value={formData.dailySalesGoal}
                                onChange={val => setFormData({ ...formData, dailySalesGoal: val ?? 0 })}
                                className={`${inputCls} text-right`}
                                placeholder="例: 50000"
                            />
                            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                                この店舗の「売上管理」画面にて、月の累計目標の達成率を計算するために使用されます。
                            </p>
                        </div>

                        {/* 販売価格ルール */}
                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                    <Save className="w-3.5 h-3.5" />
                                </div>
                                <label className="text-sm font-bold text-slate-800">販売価格ルール (自動計算用)</label>
                            </div>
                            <div className="space-y-2 animate-in slide-in-from-left-2 duration-200">
                                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                    価格加減率 (%) <span className="text-slate-400 font-normal ml-2">※正の値で値上げ、負の値で値下げ</span>
                                </label>
                                <div className="relative">
                                    <NumberInput
                                        value={formData.pricingRule}
                                        allowNegative
                                        onChange={val => setFormData({
                                            ...formData,
                                            pricingRule: val ?? 0
                                        })}
                                        className={`${inputCls} text-right pr-8`}
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                                商品管理で「販売価格」を変更した際、この店舗の「店舗別個別価格」を自動計算します。<br />
                                例: 15なら15%アップ、-20なら20%ダウンされます。
                            </p>
                        </div>

                        {/* 卸売率ルール */}
                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                                    <Tag className="w-3.5 h-3.5" />
                                </div>
                                <label className="text-sm font-bold text-slate-800">卸売率設定 (自動計算用)</label>
                            </div>
                            <div className="space-y-2 animate-in slide-in-from-left-2 duration-200">
                                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                    卸売率 (%) <span className="text-slate-400 font-normal ml-2">※販売価格に対する比率</span>
                                </label>
                                <div className="relative">
                                    <NumberInput
                                        value={formData.wholesaleRate}
                                        min={0}
                                        max={100}
                                        onChange={val => setFormData({
                                            ...formData,
                                            wholesaleRate: val ?? 60
                                        })}
                                        className={`${inputCls} text-right pr-8`}
                                        placeholder="60"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                                商品管理で「販売価格」を入力した際、この比率を掛けた値を「卸価格」として自動セットします。<br />
                                例: 60なら販売価格の60%が卸価格になります。
                            </p>
                        </div>

                        {/* 取扱商品設定 */}
                        <div className="pt-4 border-t border-slate-100">
                            <ProductAssignmentSection
                                activeProductIds={formData.activeProductIds}
                                onChange={(ids) => setFormData({ ...formData, activeProductIds: ids })}
                            />
                        </div>

                        {/* 連絡先 + 担当者 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">電話番号</label>
                                <input type="tel" value={formData.tel}
                                    onChange={e => setFormData({ ...formData, tel: e.target.value })}
                                    className={inputCls} placeholder="0964-00-0000" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">担当者名</label>
                                <input type="text" value={formData.pic}
                                    onChange={e => setFormData({ ...formData, pic: e.target.value })}
                                    className={inputCls} placeholder="例: 佐藤 花子" />
                            </div>
                        </div>

                        {/* メールアドレス */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">メールアドレス</label>
                            <input type="email" value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className={inputCls} placeholder="store@example.com" />
                        </div>

                        {/* 請求先情報 */}
                        <div className="pt-4 border-t border-slate-100 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                                        <Save className="w-3.5 h-3.5" />
                                    </div>
                                    <label className="text-sm font-bold text-slate-800">請求先情報</label>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.useDifferentBilling}
                                        onChange={e => setFormData({ ...formData, useDifferentBilling: e.target.checked })}
                                        className="w-4 h-4 rounded text-[#b27f79] focus:ring-[#b27f79] border-slate-300 transition-all"
                                    />
                                    <span className="text-xs font-medium text-slate-600">店舗情報と異なる場合のみ入力</span>
                                </label>
                            </div>

                            {formData.useDifferentBilling && (
                                <div className="p-4 bg-amber-50/30 rounded-2xl border border-amber-100/50 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">請求先名（会社名等）</label>
                                        <input
                                            type="text"
                                            value={formData.billingName}
                                            onChange={e => setFormData({ ...formData, billingName: e.target.value })}
                                            className={inputCls}
                                            placeholder="例: 株式会社◯◯ 経理部"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">郵便番号</label>
                                            <input
                                                type="text"
                                                value={formData.billingZipCode}
                                                onChange={e => handleBillingZipChange(e.target.value)}
                                                className={inputCls}
                                                placeholder="869-0401"
                                                maxLength={8}
                                                inputMode="numeric"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">住所</label>
                                            <input
                                                type="text"
                                                value={formData.billingAddress}
                                                onChange={e => setFormData({ ...formData, billingAddress: e.target.value })}
                                                className={inputCls}
                                                placeholder="請求書の送付先住所"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">電話番号</label>
                                        <input
                                            type="tel"
                                            value={formData.billingTel}
                                            onChange={e => setFormData({ ...formData, billingTel: e.target.value })}
                                            className={inputCls}
                                            placeholder="0964-00-0000"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 備忘録 */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">備忘録</label>
                            <textarea value={formData.memo}
                                onChange={e => setFormData({ ...formData, memo: e.target.value })}
                                rows={3} className={`${inputCls} resize-none`}
                                placeholder="契約条件、特記事項など" />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                    <button type="button" onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        キャンセル
                    </button>
                    <button type="submit" form="retailstore-form" disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all disabled:opacity-60"
                        style={{ backgroundColor: BRAND }}>
                        {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</> : <><Save className="w-4 h-4" /> 保存する</>}
                    </button>
                </div>
            </div >
        </div >
    );
}

function ProductAssignmentSection({
    activeProductIds,
    onChange
}: {
    activeProductIds: string[];
    onChange: (ids: string[]) => void;
}) {
    const { products, brands } = useStore();
    const [searchQuery, setSearchQuery] = useState("");

    const brandMap = new Map(brands.map(b => [b.id, b.name]));

    const filteredProducts = products.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) ||
            p.variantName?.toLowerCase().includes(q) ||
            brandMap.get(p.brandId)?.toLowerCase().includes(q);
    }).sort((a, b) => {
        const brandA = brandMap.get(a.brandId) || "";
        const brandB = brandMap.get(b.brandId) || "";
        if (brandA !== brandB) return brandA.localeCompare(brandB);
        return a.name.localeCompare(b.name);
    });

    const toggleProduct = (id: string) => {
        if (activeProductIds.includes(id)) {
            onChange(activeProductIds.filter(v => v !== id));
        } else {
            onChange([...activeProductIds, id]);
        }
    };

    const toggleAll = () => {
        if (activeProductIds.length === products.length) {
            onChange([]);
        } else {
            onChange(products.map(p => p.id));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                    <label className="text-sm font-bold text-slate-800">取扱商品設定</label>
                </div>
                <button
                    type="button"
                    onClick={toggleAll}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                    {activeProductIds.length === products.length ? "すべて解除" : "すべて選択"}
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="商品名やブランドで検索..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {filteredProducts.map(product => {
                    const isSelected = activeProductIds.includes(product.id);
                    const brandName = brandMap.get(product.brandId) || "不明";
                    return (
                        <button
                            key={product.id}
                            type="button"
                            onClick={() => toggleProduct(product.id)}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${isSelected
                                ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-500/20"
                                : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                                }`}
                        >
                            <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-200"
                                }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold text-slate-400 truncate mb-0.5">
                                    {brandName}
                                </div>
                                <div className={`text-xs font-bold truncate ${isSelected ? "text-emerald-900" : "text-slate-700"}`}>
                                    {product.name}
                                </div>
                                {product.variantName && (
                                    <div className="text-[10px] text-slate-400 truncate font-medium">
                                        {product.variantName}
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
            {filteredProducts.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                    商品が見つかりませんでした
                </div>
            )}
            <p className="text-[10px] text-slate-400 leading-relaxed">
                ここで選択した商品のみが売上入力画面や日報画面に表示されます。未設定の場合は全商品が表示されます。
            </p>
        </div>
    );
}
