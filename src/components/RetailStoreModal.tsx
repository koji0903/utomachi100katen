"use client";

import { useState, useEffect } from "react";
import { X, Save, Store } from "lucide-react";
import { useStore, RetailStore } from "@/lib/store";

interface RetailStoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: RetailStore | null;
}

export function RetailStoreModal({ isOpen, onClose, initialData }: RetailStoreModalProps) {
    const { addRetailStore, updateRetailStore } = useStore();
    const [formData, setFormData] = useState({
        name: "",
        zipCode: "",
        address: "",
        tel: "",
        email: "",
        pic: "",
        memo: "",
        commissionRate: 15, // Default 15%
    });

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
                });
            } else {
                setFormData({
                    name: "",
                    zipCode: "",
                    address: "",
                    tel: "",
                    email: "",
                    pic: "",
                    memo: "",
                    commissionRate: 15,
                });
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (initialData) {
            updateRetailStore(initialData.id, formData);
        } else {
            addRetailStore(formData);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                            <Store className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                            {initialData ? "販売店舗を編集" : "新規販売店舗登録"}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    <form id="retailstore-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">店舗名 <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all bg-slate-50 focus:bg-white"
                                    placeholder="例: 道の駅 宇土マリーナ"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">手数料率 (%) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    max="100"
                                    value={formData.commissionRate}
                                    onChange={(e) => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all bg-slate-50 focus:bg-white text-right"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">郵便番号</label>
                                <input
                                    type="text"
                                    value={formData.zipCode}
                                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all bg-slate-50 focus:bg-white"
                                    placeholder="869-0401"
                                />
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">住所</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all bg-slate-50 focus:bg-white"
                                    placeholder="熊本県宇土市..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">電話番号</label>
                                <input
                                    type="tel"
                                    value={formData.tel}
                                    onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all bg-slate-50 focus:bg-white"
                                    placeholder="090-0000-0000"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">担当者名</label>
                                <input
                                    type="text"
                                    value={formData.pic}
                                    onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all bg-slate-50 focus:bg-white"
                                    placeholder="例: 佐藤 花子"
                                />
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">備忘録</label>
                                <textarea
                                    value={formData.memo}
                                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all bg-slate-50 focus:bg-white resize-none"
                                    placeholder="契約条件など"
                                />
                            </div>
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
                        form="retailstore-form"
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-colors shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        保存する
                    </button>
                </div>
            </div>
        </div>
    );
}
