"use client";

import { useState, useEffect } from "react";
import { X, Save, ShoppingBag } from "lucide-react";
import { useStore, Purchase, Product, Supplier } from "@/lib/store";
import { NumberInput } from "@/components/NumberInput";

interface PurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Purchase | null;
}

export function PurchaseModal({ isOpen, onClose, initialData }: PurchaseModalProps) {
    const { products, suppliers, addPurchase, updatePurchase } = useStore();

    const [formData, setFormData] = useState({
        type: 'A' as 'A' | 'B',
        status: 'ordered' as 'ordered' | 'waiting' | 'completed',
        productId: "",
        supplierId: "",
        orderDate: new Date().toISOString().split("T")[0],
        arrivalDate: "",
        expectedArrivalDate: "",
        quantity: 1,
        unitCost: 0,
        totalCost: 0,
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    type: initialData.type || 'A',
                    status: initialData.status || 'ordered',
                    productId: initialData.productId,
                    supplierId: initialData.supplierId,
                    orderDate: initialData.orderDate,
                    arrivalDate: initialData.arrivalDate || "",
                    expectedArrivalDate: initialData.expectedArrivalDate || "",
                    quantity: initialData.quantity,
                    unitCost: initialData.unitCost || 0,
                    totalCost: initialData.totalCost || 0,
                });
            } else {
                setFormData({
                    type: 'A',
                    status: 'ordered',
                    productId: products.length > 0 ? products[0].id : "",
                    supplierId: suppliers.length > 0 ? suppliers[0].id : "",
                    orderDate: new Date().toISOString().split("T")[0],
                    arrivalDate: "",
                    expectedArrivalDate: "",
                    quantity: 1,
                    unitCost: 0,
                    totalCost: 0,
                });
            }
        }
    }, [isOpen, initialData, products, suppliers]);

    // Auto-calculate total cost
    useEffect(() => {
        setFormData(prev => ({ ...prev, totalCost: prev.unitCost * prev.quantity }));
    }, [formData.unitCost, formData.quantity]);

    if (!isOpen) return null;

    const handleTypeChange = (type: 'A' | 'B') => {
        const today = new Date().toISOString().split("T")[0];
        if (type === 'B') {
            setFormData(prev => ({
                ...prev,
                type: 'B',
                status: 'completed',
                orderDate: today,
                arrivalDate: today,
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                type: 'A',
                status: 'ordered',
            }));
        }
    };

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[95vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
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

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    <div className="flex p-1 bg-slate-100 rounded-lg mb-6">
                        <button
                            onClick={() => handleTypeChange('A')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formData.type === 'A' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            パターンA (予約発注)
                        </button>
                        <button
                            onClick={() => handleTypeChange('B')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formData.type === 'B' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            パターンB (直接入荷)
                        </button>
                    </div>

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
                                    disabled={formData.type === 'B'}
                                    value={formData.orderDate}
                                    onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">
                                    {formData.type === 'B' ? "入荷日" : "入荷予定日"}
                                </label>
                                <input
                                    type="date"
                                    required={formData.type === 'B'}
                                    value={formData.type === 'B' ? formData.arrivalDate : formData.expectedArrivalDate}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        [formData.type === 'B' ? 'arrivalDate' : 'expectedArrivalDate']: e.target.value
                                    })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">数量</label>
                                <NumberInput
                                    required
                                    min={1}
                                    value={formData.quantity}
                                    onChange={(val) => setFormData({ ...formData, quantity: val ?? 1 })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white text-right"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">仕入単価</label>
                                <NumberInput
                                    required
                                    min={0}
                                    value={formData.unitCost}
                                    onChange={(val) => setFormData({ ...formData, unitCost: val ?? 0 })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white text-right"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">仕入合計</label>
                            <input
                                type="text"
                                readOnly
                                value={`¥${formData.totalCost.toLocaleString()}`}
                                className="w-full px-4 py-2.5 border border-transparent rounded-lg bg-emerald-50 text-emerald-700 font-bold text-right"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">ステータス</label>
                            <select
                                required
                                disabled={formData.type === 'B'}
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white disabled:bg-slate-100"
                            >
                                <option value="ordered">発注済</option>
                                <option value="waiting">入荷待ち</option>
                                <option value="completed">入荷完了</option>
                            </select>
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50 mt-auto">
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
