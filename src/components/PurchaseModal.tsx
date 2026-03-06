"use client";

import { useState, useEffect } from "react";
import { X, Save, ShoppingBag } from "lucide-react";
import { useStore, Purchase, Product, Supplier } from "@/lib/store";

interface PurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Purchase | null;
}

export function PurchaseModal({ isOpen, onClose, initialData }: PurchaseModalProps) {
    const { products, suppliers, addPurchase, updatePurchase } = useStore();

    const [formData, setFormData] = useState({
        productId: "",
        supplierId: "",
        orderDate: new Date().toISOString().split("T")[0],
        expectedArrivalDate: "",
        quantity: 1,
        isArrived: false,
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    productId: initialData.productId,
                    supplierId: initialData.supplierId,
                    orderDate: initialData.orderDate,
                    expectedArrivalDate: initialData.expectedArrivalDate,
                    quantity: initialData.quantity,
                    isArrived: initialData.isArrived,
                });
            } else {
                setFormData({
                    productId: products.length > 0 ? products[0].id : "",
                    supplierId: suppliers.length > 0 ? suppliers[0].id : "",
                    orderDate: new Date().toISOString().split("T")[0],
                    expectedArrivalDate: "",
                    quantity: 1,
                    isArrived: false,
                });
            }
        }
    }, [isOpen, initialData, products, suppliers]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (initialData) {
            updatePurchase(initialData.id, formData);
        } else {
            addPurchase(formData);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                            {initialData ? "仕入れ情報を編集" : "新規仕入れ登録"}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <form id="purchase-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">対象商品 <span className="text-red-500">*</span></label>
                            <select
                                required
                                value={formData.productId}
                                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white"
                            >
                                <option value="" disabled>商品を選択</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">仕入先 <span className="text-red-500">*</span></label>
                            <select
                                required
                                value={formData.supplierId}
                                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white"
                            >
                                <option value="" disabled>仕入先を選択</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">発注日</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.orderDate}
                                    onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">入荷予定日</label>
                                <input
                                    type="date"
                                    value={formData.expectedArrivalDate}
                                    onChange={(e) => setFormData({ ...formData, expectedArrivalDate: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">数量</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white text-right"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="isArrived"
                                checked={formData.isArrived}
                                onChange={(e) => setFormData({ ...formData, isArrived: e.target.checked })}
                                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                            />
                            <label htmlFor="isArrived" className="text-sm font-medium text-slate-700 cursor-pointer">
                                入荷済み
                            </label>
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        type="submit"
                        form="purchase-form"
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        保存する
                    </button>
                </div>
            </div>
        </div>
    );
}
