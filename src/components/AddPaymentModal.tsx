// src/components/AddPaymentModal.tsx
"use client";

import { useState } from "react";
import { X, Calendar, CreditCard, Receipt, Loader2, Save } from "lucide-react";
import { useStore } from "@/lib/store";
import { showNotification } from "@/lib/notifications";

interface AddPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactionId: string;
    totalAmount: number;
    currentPaidAmount: number;
    invoiceId?: string;
}

const getLocalDateString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

export function AddPaymentModal({
    isOpen,
    onClose,
    transactionId,
    totalAmount,
    currentPaidAmount,
    invoiceId = ""
}: AddPaymentModalProps) {
    const { addInvoicePayment, updateTransaction } = useStore();
    const [isSaving, setIsSaving] = useState(false);

    const remainingAmount = Math.max(0, totalAmount - currentPaidAmount);

    // Form state
    const [date, setDate] = useState(getLocalDateString());
    const [amount, setAmount] = useState<number>(remainingAmount);
    const [method, setMethod] = useState<'銀行振込' | '現金' | 'QR決済' | 'その他'>('銀行振込');
    const [notes, setNotes] = useState("");

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!date || amount <= 0) {
            showNotification("有効な日付と入金額を入力してください。");
            return;
        }

        setIsSaving(true);
        try {
            // 1. Add payment record
            await addInvoicePayment({
                transactionId,
                invoiceId,
                date,
                amount,
                method,
                notes: notes.trim()
            });

            // 2. Propose & update Transaction status based on remaining balance
            const newTotalPaid = currentPaidAmount + amount;
            let targetStatus: '一部入金' | '入金済' = '一部入金';
            if (newTotalPaid >= totalAmount) {
                targetStatus = '入金済';
            }

            await updateTransaction(transactionId, {
                transactionStatus: targetStatus
            });

            showNotification(`入金記録を登録し、取引ステータスを「${targetStatus}」に更新しました。`);
            onClose();
        } catch (error) {
            console.error(error);
            showNotification("入金記録の保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                                <CreditCard className="w-5 h-5" />
                            </span>
                            入金記録を追加
                        </h2>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">Reconcile Bank / Cash Payment</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Remaining Balance Summary */}
                    <div className="p-5 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 flex justify-between items-center">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">請求額に対する現在の残高</span>
                            <span className="text-xs text-slate-500 font-bold mt-1 block">
                                請求総額: ¥{totalAmount.toLocaleString()} / 支払済: ¥{currentPaidAmount.toLocaleString()}
                            </span>
                        </div>
                        <span className="text-xl font-black text-emerald-600 font-mono">
                            ¥{remainingAmount.toLocaleString()}
                        </span>
                    </div>

                    <div className="space-y-5">
                        {/* Date */}
                        <div className="group text-slate-900">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                <Calendar className="w-3.5 h-3.5 text-slate-300" /> 入金日
                            </label>
                            <input 
                                type="date" 
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-black"
                            />
                        </div>

                        {/* Amount */}
                        <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                <Receipt className="w-3.5 h-3.5 text-slate-300" /> 入金額
                            </label>
                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">¥</span>
                                <input 
                                    type="number" 
                                    required
                                    min={1}
                                    value={amount || ""}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    className="w-full pl-10 pr-5 py-4 bg-slate-900 border-none rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all text-xl font-black text-white"
                                />
                            </div>
                        </div>

                        {/* Method */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                                <CreditCard className="w-3.5 h-3.5 text-slate-300" /> 入金方法
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {(['銀行振込', '現金', 'QR決済', 'その他'] as const).map(pm => (
                                    <button
                                        key={pm}
                                        type="button"
                                        onClick={() => setMethod(pm)}
                                        className={`py-3 text-[10px] font-black rounded-xl border transition-all ${method === pm ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'}`}
                                    >
                                        {pm}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="group text-slate-900">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                                備考（振込名義や金融機関名など）
                            </label>
                            <textarea 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="例: カ)ウマチジュウカテン 様より振込"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-bold text-slate-700 resize-none placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 border border-slate-200 text-slate-500 font-black text-sm rounded-2xl hover:bg-slate-50 transition-all"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-[2] py-4 bg-emerald-600 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>登録中...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>入金を登録する</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
