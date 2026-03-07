"use client";

import { useState, useEffect } from "react";
import { X, Save, Store, MapPin, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useStore, RetailStore } from "@/lib/store";
import { useZipCode } from "@/lib/useZipCode";

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
    });
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [geoResult, setGeoResult] = useState<"ok" | "error" | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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
                });
            } else {
                setFormData({ name: "", zipCode: "", address: "", tel: "", email: "", pic: "", memo: "", commissionRate: 15, lat: undefined, lng: undefined });
            }
            setGeoResult(null);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

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

    const handleGeocode = async () => {
        // 住所フィールドのみ送信（郵便番号を結合するとGSI APIが失敗するため）
        const addr = formData.address.trim();
        if (!addr) return;
        setIsGeocoding(true);
        setGeoResult(null);
        try {
            const res = await fetch("/api/geocode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address: addr }),
            });
            if (!res.ok) throw new Error();
            const { lat, lng } = await res.json();
            setFormData(prev => ({ ...prev, lat, lng }));
            setGeoResult("ok");
        } catch {
            setGeoResult("error");
        } finally {
            setIsGeocoding(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (initialData) {
                await updateRetailStore(initialData.id, formData);
            } else {
                await addRetailStore(formData);
            }
            onClose();
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
                            {initialData ? "店舗情報を編集" : "新規販売店舗登録"}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto p-6">
                    <form id="retailstore-form" onSubmit={handleSubmit} className="space-y-5">

                        {/* 店舗名 */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">店舗名 <span className="text-red-400">*</span></label>
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
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">手数料率 (%) <span className="text-red-400">*</span></label>
                            <input type="number" required min="0" max="100" value={formData.commissionRate}
                                onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                                className={`${inputCls} text-right`} />
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
            </div>
        </div>
    );
}
