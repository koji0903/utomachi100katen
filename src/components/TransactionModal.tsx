"use client";

import { useState, useEffect } from "react";
import { X, Save, FileText, Plus } from "lucide-react";
import { useStore, Transaction } from "@/lib/store";
import { NumberInput } from "@/components/NumberInput";
import { Tooltip } from "@/components/ui/Tooltip";

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Transaction | null;
}

const CHANNELS = ['スポット注文', '卸販売', '委託販売', '店頭販売', 'EC', 'イベント販売'] as const;
const STATUSES = ['受注', '納品済', '請求済', '一部入金', '入金済', '完了'] as const;

export function TransactionModal({ isOpen, onClose, initialData }: TransactionModalProps) {
    const { addTransaction, updateTransaction, retailStores, spotRecipients, addSpotRecipient } = useStore();

    const [customerType, setCustomerType] = useState<'retail' | 'spot'>('retail');
    const [isNewSpot, setIsNewSpot] = useState(false);

    const [formData, setFormData] = useState({
        customerName: "",
        transactionType: "物販",
        channel: "スポット注文" as Transaction['channel'],
        orderDate: new Date().toISOString().split("T")[0],
        deliveryDate: "",
        invoiceDate: "",
        dueDate: "",
        transactionStatus: "受注" as Transaction['transactionStatus'],
        subtotal: 0,
        tax: 0,
        totalAmount: 0,
        remarks: ""
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Try to infer customerType based on existing data
                const isRetail = retailStores.some(r => r.name === initialData.customerName);
                const isSpot = spotRecipients.some(s => s.name === initialData.customerName);
                
                if (isRetail) {
                    setCustomerType('retail');
                    setIsNewSpot(false);
                } else if (isSpot) {
                    setCustomerType('spot');
                    setIsNewSpot(false);
                } else if (initialData.customerName) {
                    // It's a spot but not in the list, or just free text. Treat as spot new item.
                    setCustomerType('spot');
                    setIsNewSpot(true);
                }

                setFormData({
                    customerName: initialData.customerName,
                    transactionType: initialData.transactionType || "物販",
                    channel: initialData.channel,
                    orderDate: initialData.orderDate || new Date().toISOString().split("T")[0],
                    deliveryDate: initialData.deliveryDate || "",
                    invoiceDate: initialData.invoiceDate || "",
                    dueDate: initialData.dueDate || "",
                    transactionStatus: initialData.transactionStatus,
                    subtotal: initialData.subtotal || 0,
                    tax: initialData.tax || 0,
                    totalAmount: initialData.totalAmount || 0,
                    remarks: initialData.remarks || ""
                });
            } else {
                setCustomerType('retail');
                setIsNewSpot(false);
                setFormData({
                    customerName: "",
                    transactionType: "物販",
                    channel: "スポット注文",
                    orderDate: new Date().toISOString().split("T")[0],
                    deliveryDate: "",
                    invoiceDate: "",
                    dueDate: "",
                    transactionStatus: "受注",
                    subtotal: 0,
                    tax: 0,
                    totalAmount: 0,
                    remarks: ""
                });
            }
        }
    }, [isOpen, initialData]);

    // Auto-calculate total from subtotal+tax, assuming we don't have items.
    // If we have items in the future, that logic would go here.
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            totalAmount: prev.subtotal + prev.tax
        }));
    }, [formData.subtotal, formData.tax]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Auto-register new spot recipient if needed
        if (customerType === 'spot' && isNewSpot && formData.customerName.trim() !== '') {
            // Check if it doesn't already exist to avoid duplicates
            if (!spotRecipients.some(s => s.name === formData.customerName.trim())) {
                addSpotRecipient({ name: formData.customerName.trim() });
            }
        }

        const submission = {
            ...formData,
            paidAmount: initialData ? initialData.paidAmount : 0,
            balanceAmount: initialData ? initialData.balanceAmount : formData.totalAmount
        };

        if (initialData) {
            updateTransaction(initialData.id, submission);
        } else {
            addTransaction(submission);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white min-h-[72px]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                            {initialData ? "取引情報を編集" : "新規取引を追加"}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors flex-shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto w-full">
                    <form id="transaction-form" onSubmit={handleSubmit} className="space-y-6 max-w-full">
                        
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">基本情報</h3>
                            
                            <div className="space-y-4">
                                <div className="flex p-1 bg-slate-200/50 rounded-lg max-w-sm w-full">
                                    <button
                                        type="button"
                                        onClick={() => { 
                                            setCustomerType('retail'); 
                                            setIsNewSpot(false); 
                                            setFormData(prev => ({ ...prev, channel: '卸販売' }));
                                            if (formData.customerName && !retailStores.some(r => r.name === formData.customerName)) {
                                                setFormData(prev => ({ ...prev, customerName: "" }));
                                            }
                                        }}
                                        className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${customerType === 'retail' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        販売店舗・事業者
                                        <Tooltip content="設定＞販売店舗管理で登録済みの得意先を選択します。" position="bottom" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { 
                                            setCustomerType('spot'); 
                                            setFormData(prev => ({ ...prev, channel: 'スポット注文' }));
                                            if (formData.customerName && retailStores.some(r => r.name === formData.customerName)) {
                                                setFormData(prev => ({ ...prev, customerName: "" }));
                                            }
                                        }}
                                        className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${customerType === 'spot' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        スポット（都度）
                                        <Tooltip content="一時的な取引や、個人への直接販売などの宛先を入力します。" position="bottom" />
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 block">取引先名 <span className="text-red-500">*</span></label>
                                    {customerType === 'retail' ? (
                                        <select
                                            required
                                            value={formData.customerName}
                                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                        >
                                            <option value="" disabled>取引先（店舗・事業者）を選択</option>
                                            {retailStores.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                        </select>
                                    ) : (
                                        <div className="space-y-2">
                                            {isNewSpot ? (
                                                <div className="flex gap-2">
                                                    <input
                                                        required
                                                        type="text"
                                                        value={formData.customerName}
                                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                                        placeholder="新しい宛先名を入力"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => { setIsNewSpot(false); setFormData({ ...formData, customerName: "" }); }}
                                                        className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 flex-shrink-0"
                                                    >
                                                        戻る
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <select
                                                        required
                                                        value={formData.customerName}
                                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                                    >
                                                        <option value="" disabled>既存のスポット宛先を選択</option>
                                                        {spotRecipients.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setIsNewSpot(true); setFormData({...formData, customerName: ""}); }}
                                                        className="flex-shrink-0 px-4 flex items-center gap-1.5 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
                                                    >
                                                        <Plus className="w-4 h-4" /> 新規
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 block">取引種別</label>
                                    <input
                                        type="text"
                                        value={formData.transactionType}
                                        onChange={(e) => setFormData({ ...formData, transactionType: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                        placeholder="例: 物販"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                        チャネル <span className="text-red-500">*</span>
                                        <Tooltip content="取引の発生元を選択します。売上分析に利用されます。" position="right" />
                                    </label>
                                    <select
                                        required
                                        value={formData.channel}
                                        onChange={(e) => setFormData({ ...formData, channel: e.target.value as any })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                    >
                                        {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">日付情報</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 block">取引日（受注日） <span className="text-red-500">*</span></label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.orderDate}
                                        onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 block">納品日</label>
                                    <input
                                        type="date"
                                        value={formData.deliveryDate}
                                        onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 block">請求日</label>
                                    <input
                                        type="date"
                                        value={formData.invoiceDate}
                                        onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 block">支払期限</label>
                                    <input
                                        type="date"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">金額・状況</h3>
                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                        ステータス <span className="text-red-500">*</span>
                                        <Tooltip content="取引の進行状況です。請求前のもの、入金待ちのものを区別できます。" position="right" />
                                    </label>
                                    <select
                                        required
                                        value={formData.transactionStatus}
                                        onChange={(e) => setFormData({ ...formData, transactionStatus: e.target.value as any })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                    >
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 block uppercase">小計（税抜）</label>
                                    <NumberInput
                                        value={formData.subtotal}
                                        onChange={v => setFormData({ ...formData, subtotal: v || 0 })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-right font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 block uppercase">消費税</label>
                                    <NumberInput
                                        value={formData.tax}
                                        onChange={v => setFormData({ ...formData, tax: v || 0 })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-right font-mono"
                                    />
                                </div>
                                <div className="col-span-2 text-right mt-2">
                                    <span className="text-xs font-bold text-slate-500 mr-4">合計金額（税込）:</span>
                                    <span className="text-2xl font-black text-slate-900 tracking-tight">¥{formData.totalAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">備考</label>
                            <textarea
                                value={formData.remarks}
                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 min-h-[80px]"
                                placeholder="必要に応じてメモを入力"
                            />
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50 mt-auto min-h-[72px]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        type="submit"
                        form="transaction-form"
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-colors shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
}
