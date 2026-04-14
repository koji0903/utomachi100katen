"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Save, ShoppingBag, Plus, Trash2 } from "lucide-react";
import { useStore, Purchase, PurchaseItem } from "@/lib/store";
import { NumberInput } from "@/components/NumberInput";
import { Tooltip } from "@/components/ui/Tooltip";

interface PurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Purchase | null;
}

export function PurchaseModal({ isOpen, onClose, initialData }: PurchaseModalProps) {
    const { products, suppliers, addPurchase, updatePurchase } = useStore();

    const [formData, setFormData] = useState({
        type: 'A' as 'A' | 'B',
        status: 'ordered_pending' as Purchase['status'],
        supplierId: "",
        items: [] as PurchaseItem[],
        totalAmount: 0,
        orderDate: new Date().toISOString().split("T")[0],
        arrivalDate: "",
        receivedDate: "",
        paymentDate: "",
        expectedArrivalDate: "",
        memo: "",
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Determine items (migrate legacy if items is missing)
                let itemsList = initialData.items || [];
                if (itemsList.length === 0 && initialData.productId) {
                    itemsList = [{
                        productId: initialData.productId,
                        quantity: initialData.quantity || 1,
                        receivedQuantity: (initialData.status === 'received' || initialData.status === 'paid') ? (initialData.quantity || 1) : 0,
                        unitCost: initialData.unitCost || 0,
                        totalCost: initialData.totalCost || 0
                    }];
                }

                setFormData({
                    type: initialData.type || 'A',
                    status: initialData.status as Purchase['status'] || 'ordered_pending',
                    supplierId: initialData.supplierId,
                    items: itemsList,
                    totalAmount: initialData.totalAmount || initialData.totalCost || 0,
                    orderDate: initialData.orderDate,
                    arrivalDate: initialData.arrivalDate || "",
                    receivedDate: initialData.receivedDate || initialData.arrivalDate || "",
                    paymentDate: initialData.paymentDate || "",
                    expectedArrivalDate: initialData.expectedArrivalDate || "",
                    memo: initialData.memo || "",
                });
            } else {
                setFormData({
                    type: 'A',
                    status: 'ordered_pending',
                    supplierId: suppliers.length > 0 ? suppliers[0].id : "",
                    items: [],
                    totalAmount: 0,
                    orderDate: new Date().toISOString().split("T")[0],
                    arrivalDate: "",
                    receivedDate: "",
                    paymentDate: "",
                    expectedArrivalDate: "",
                    memo: "",
                });
            }
        }
    }, [isOpen, initialData, suppliers]);

    const activeSupplier = useMemo(() => {
        return suppliers.find(s => s.id === formData.supplierId);
    }, [suppliers, formData.supplierId]);

    // Provided products by this supplier
    const availableProducts = useMemo(() => {
        if (!activeSupplier || !activeSupplier.suppliedProducts) return [];
        return activeSupplier.suppliedProducts.map(sp => {
            const prod = products.find(p => p.id === sp.productId);
            // Ignore products that don't exist anymore
            if (!prod) return null;
            return {
                id: sp.productId,
                name: prod.name,
                purchasePrice: sp.purchasePrice
            };
        }).filter(Boolean) as {id: string, name: string, purchasePrice: number}[];
    }, [activeSupplier, products]);

    // Auto-calculate total amounts
    useEffect(() => {
        const total = formData.items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);
        setFormData(prev => ({ ...prev, totalAmount: total }));
    }, [formData.items]);

    if (!isOpen) return null;

    const handleTypeChange = (type: 'A' | 'B') => {
        const today = new Date().toISOString().split("T")[0];
        if (type === 'B') {
            setFormData(prev => ({
                ...prev,
                type: 'B',
                status: 'received',
                orderDate: today,
                arrivalDate: today,
                receivedDate: today,
                items: prev.items.map(i => ({ ...i, receivedQuantity: i.quantity }))
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                type: 'A',
                status: 'ordered_pending',
            }));
        }
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                { 
                    productId: availableProducts.length > 0 ? availableProducts[0].id : "", 
                    quantity: 1, 
                    receivedQuantity: prev.type === 'B' ? 1 : 0,
                    unitCost: availableProducts.length > 0 ? availableProducts[0].purchasePrice : 0, 
                    totalCost: availableProducts.length > 0 ? availableProducts[0].purchasePrice : 0 
                }
            ]
        }));
    };

    const updateItem = (index: number, updates: Partial<PurchaseItem>) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            const item = { ...newItems[index], ...updates };
            // If product changes, update unitCost automatically
            if (updates.productId) {
                const sp = availableProducts.find(p => p.id === updates.productId);
                if (sp) item.unitCost = sp.purchasePrice;
            }
            item.totalCost = item.quantity * item.unitCost;
            newItems[index] = item;
            return { ...prev, items: newItems };
        });
    };

    const removeItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Remove items with no productId
        const validItems = formData.items.filter(i => i.productId !== "");

        const submission = {
            ...formData,
            items: validItems
        };

        if (initialData) {
            updatePurchase(initialData.id, submission);
        } else {
            addPurchase(submission);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                            {initialData ? "仕入情報を編集" : "新規仕入作成"}
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
                    <div className="flex p-1 bg-slate-100 rounded-lg mb-6 max-w-sm mx-auto">
                        <button
                            type="button"
                            onClick={() => handleTypeChange('A')}
                            className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-all ${formData.type === 'A' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            パターンA (発注管理)
                            <Tooltip content="発注書を作成し、後日入荷するフローです。在庫は入荷時に反映されます。" position="bottom" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTypeChange('B')}
                            className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-all ${formData.type === 'B' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            パターンB (即時仕入)
                            <Tooltip content="当日仕入れた商品を即座に在庫へ反映するフローです。" position="bottom" />
                        </button>
                    </div>

                    <form id="purchase-form" onSubmit={handleSubmit} className="space-y-6">
                        
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">基本情報</h3>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                    仕入先 <span className="text-red-500">*</span>
                                    <Tooltip content="事前に『設定』＞『仕入先管理』で登録された仕入先のみ選択可能です。" position="right" />
                                </label>
                                <select
                                    required
                                    value={formData.supplierId}
                                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value, items: [] })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                                >
                                    <option value="" disabled>仕入先を選択</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 block text-emerald-600">ステータス</label>
                                    <select
                                        required
                                        disabled={formData.type === 'B'}
                                        value={formData.status}
                                        onChange={(e) => {
                                            const newStatus = e.target.value as Purchase['status'];
                                            const today = new Date().toISOString().split('T')[0];
                                            const update: any = { status: newStatus };
                                            
                                            if (newStatus === 'received' || newStatus === 'paid') {
                                                update.receivedDate = today;
                                                update.arrivalDate = today;
                                                // Auto sync received quantity
                                                update.items = formData.items.map(i => ({ ...i, receivedQuantity: i.quantity }));
                                                
                                                if (newStatus === 'paid' && !formData.paymentDate) {
                                                    update.paymentDate = today;
                                                }
                                            } else if (newStatus === 'partially_received' && !formData.receivedDate && !formData.arrivalDate) {
                                                update.receivedDate = today;
                                                update.arrivalDate = today;
                                            }
                                            setFormData({ ...formData, ...update });
                                        }}
                                        className="w-full px-4 py-2.5 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white disabled:bg-slate-100 font-bold text-emerald-700"
                                    >
                                        <option value="ordered_pending">発注未（予定）</option>
                                        <option value="ordered">発注済み</option>
                                        <option value="waiting">仕入待ち</option>
                                        <option value="partially_received">部分入荷</option>
                                        <option value="received">仕入済み（在庫反映）</option>
                                        <option value="paid">支払済</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 block">発注日</label>
                                    <input
                                        type="date"
                                        required
                                        disabled={formData.type === 'B'}
                                        value={formData.orderDate}
                                        onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white disabled:bg-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 block">
                                        {formData.type === 'B' ? "入荷日" : (formData.status === 'received' || formData.status === 'paid' ? "実際の入荷日" : "入荷予定日")}
                                    </label>
                                    <input
                                        type="date"
                                        required={formData.type === 'B' || formData.status === 'received' || formData.status === 'paid'}
                                        value={formData.type === 'B' || formData.status === 'received' || formData.status === 'paid' ? (formData.arrivalDate || formData.receivedDate) : formData.expectedArrivalDate}
                                        onChange={(e) => {
                                            if (formData.type === 'B' || formData.status === 'received' || formData.status === 'paid') {
                                                setFormData({ ...formData, arrivalDate: e.target.value, receivedDate: e.target.value });
                                            } else {
                                                setFormData({ ...formData, expectedArrivalDate: e.target.value });
                                            }
                                        }}
                                        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white ${formData.status === 'received' || formData.status === 'paid' ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-300'}`}
                                    />
                                </div>
                                {formData.status === 'paid' ? (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-sm font-semibold text-indigo-700 block">支払日</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.paymentDate}
                                            onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-indigo-50/30 font-medium text-indigo-700"
                                        />
                                    </div>
                                ) : (
                                    <div></div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">備考</label>
                                <textarea
                                    value={formData.memo}
                                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                                    rows={2}
                                    placeholder="仕入に関するメモを入力してください（例：請求書番号、特記事項など）"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white placeholder:text-slate-400 text-sm"
                                />
                            </div>
                        </div>

                        {formData.supplierId && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-sm font-bold text-slate-800">発注商品一覧</h3>
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        disabled={availableProducts.length === 0}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> 商品を追加
                                    </button>
                                </div>

                                {availableProducts.length === 0 ? (
                                    <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg text-center border border-slate-100 border-dashed">
                                        この仕入先には取扱商品が設定されていません。<br/>仕入先管理から商品を追加してください。
                                    </p>
                                ) : formData.items.length === 0 ? (
                                    <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg text-center border border-slate-100 border-dashed">
                                        上の「商品を追加」ボタンから発注する商品を選択してください。
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {formData.items.map((item, index) => (
                                            <div key={index} className="flex gap-3 bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                                                <div className="flex-1 space-y-3">
                                                    <div className="grid grid-cols-[1fr_80px_100px_100px_100px] gap-3 items-end">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-500 block uppercase">商品 *</label>
                                                            <select
                                                                required
                                                                value={item.productId}
                                                                onChange={(e) => updateItem(index, { productId: e.target.value })}
                                                                className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-emerald-500"
                                                            >
                                                                <option value="" disabled>選択...</option>
                                                                {availableProducts.map(p => (
                                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                                ))}
                                                                {/* Optional: Add existing products that might have been removed from supplier list just in case */}
                                                                {item.productId && !availableProducts.find(p => p.id === item.productId) && (
                                                                    <option value={item.productId}>{products.find(p => p.id === item.productId)?.name || '不明'}</option>
                                                                )}
                                                            </select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-500 block uppercase">発注数 *</label>
                                                            <NumberInput
                                                                required
                                                                min={1}
                                                                value={item.quantity}
                                                                onChange={(val) => updateItem(index, { quantity: val ?? 1 })}
                                                                className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-right bg-slate-50 focus:bg-white focus:outline-emerald-500"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className={`text-[10px] font-black block uppercase ${item.receivedQuantity > 0 && item.receivedQuantity < item.quantity ? 'text-amber-500' : 'text-slate-500'}`}>入荷数</label>
                                                            <NumberInput
                                                                min={0}
                                                                max={item.quantity}
                                                                value={item.receivedQuantity}
                                                                onChange={(val) => updateItem(index, { receivedQuantity: val ?? 0 })}
                                                                className={`w-full px-2 py-2 border rounded-lg text-sm text-right font-bold transition-colors ${item.receivedQuantity === item.quantity ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : item.receivedQuantity > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-300'}`}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-500 block uppercase">単価 *</label>
                                                            <NumberInput
                                                                required
                                                                min={0}
                                                                value={item.unitCost}
                                                                onChange={(val) => updateItem(index, { unitCost: val ?? 0 })}
                                                                className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-right bg-slate-50 focus:bg-white focus:outline-emerald-500"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-500 block uppercase">小計（税込）</label>
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                value={`¥${item.totalCost.toLocaleString()}`}
                                                                className="w-full px-2 py-2 border border-transparent rounded-lg text-sm text-right font-medium text-slate-700 bg-slate-100 focus:outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="self-center p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))}

                                        <div className="flex justify-end pt-3 pr-10">
                                            <div className="text-right space-y-1 bg-emerald-50 p-3 rounded-lg border border-emerald-100 pr-4 pl-8 inline-block">
                                                <span className="text-xs font-bold text-emerald-600 block">総合計（税込）</span>
                                                <span className="text-2xl font-black text-emerald-700 tracking-tight">
                                                    ¥{formData.totalAmount.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
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
                        disabled={formData.items.length === 0 && !!formData.supplierId}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        情報を保存
                    </button>
                </div>
            </div>
        </div>
    );
}
