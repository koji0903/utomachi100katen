"use client";

import { useState, useEffect } from "react";
import { X, Save, Building2, MapPin, Phone, StickyNote } from "lucide-react";
import { useStore, SpotRecipient } from "@/lib/store";
import { showNotification } from "@/lib/notifications";

const BRAND = "#1e3a8a"; // Picking a professional blue for recipient management

interface SpotRecipientModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: SpotRecipient | null;
}

export function SpotRecipientModal({ isOpen, onClose, initialData }: SpotRecipientModalProps) {
    const { addSpotRecipient, updateSpotRecipient } = useStore();
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<Omit<SpotRecipient, "id" | "createdAt">>({
        name: "",
        zipCode: "",
        address: "",
        tel: "",
        memo: "",
        honorific: '御中' as '様' | '御中',
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || "",
                zipCode: initialData.zipCode || "",
                address: initialData.address || "",
                tel: initialData.tel || "",
                memo: initialData.memo || "",
                honorific: initialData.honorific || '御中',
            });
        } else {
            setFormData({
                name: "",
                zipCode: "",
                address: "",
                tel: "",
                memo: "",
                honorific: '御中',
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (initialData) {
                await updateSpotRecipient(initialData.id, formData);
                showNotification("スポット宛先を更新しました");
            } else {
                await addSpotRecipient(formData);
                showNotification("スポット宛先を登録しました");
            }
            onClose();
        } catch (err) {
            console.error("Save spot recipient failed:", err);
            showNotification("保存に失敗しました", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                                {initialData ? "スポット宛先を編集" : "新規スポット宛先"}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Spot Recipient Management</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 h-auto max-h-[70vh] overflow-y-auto">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between ml-1">
                            <label className="block text-xs font-bold text-slate-500">宛先名 <span className="text-red-500">*</span></label>
                            <div className="flex gap-4">
                                {(['様', '御中'] as const).map(h => (
                                    <label key={h} className="flex items-center gap-1.5 cursor-pointer group">
                                        <input
                                            type="radio"
                                            checked={formData.honorific === h}
                                            onChange={() => setFormData({ ...formData, honorific: h })}
                                            className="w-3.5 h-3.5 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                                        />
                                        <span className="text-xs font-medium text-slate-600">{h}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className={`${inputCls} pl-10`}
                                placeholder="例: 株式会社 〇〇"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* 郵便番号 */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 ml-1">郵便番号</label>
                            <input
                                value={formData.zipCode}
                                onChange={e => setFormData({ ...formData, zipCode: e.target.value })}
                                className={inputCls}
                                placeholder="123-4567"
                            />
                        </div>
                        {/* 電話番号 */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 ml-1">電話番号</label>
                            <div className="relative">
                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    value={formData.tel}
                                    onChange={e => setFormData({ ...formData, tel: e.target.value })}
                                    className={`${inputCls} pl-10`}
                                    placeholder="03-1234-5678"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 住所 */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 ml-1">住所</label>
                        <div className="relative">
                            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                className={`${inputCls} pl-10`}
                                placeholder="東京都..."
                            />
                        </div>
                    </div>

                    {/* メモ */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 ml-1">備考・メモ</label>
                        <div className="relative">
                            <StickyNote className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                            <textarea
                                value={formData.memo}
                                onChange={e => setFormData({ ...formData, memo: e.target.value })}
                                className={`${inputCls} pl-10 py-3 min-h-[100px] resize-none`}
                                placeholder="配送時の注意点など..."
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-all"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving || !formData.name}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[#1e3a8a] text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {initialData ? "変更を保存" : "登録する"}
                    </button>
                </div>
            </div>
        </div>
    );
}
