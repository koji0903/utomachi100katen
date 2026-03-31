"use client";

import React, { useState } from "react";
import { 
    X, Wallet, Calendar, Hash, Tag, Save, Plus
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PaymentMethod, ExpenseType } from "@/lib/types/expense";
import { showNotification } from "@/lib/notifications";

interface PettyCashReplenishModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PettyCashReplenishModal: React.FC<PettyCashReplenishModalProps> = ({
    isOpen,
    onClose,
}) => {
    const { addExpense } = useStore();
    const [amount, setAmount] = useState<number>(10000); // 1万円をデフォルト
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [memo, setMemo] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) {
            showNotification("正確な金額を入力してください");
            return;
        }

        setIsSubmitting(true);
        try {
            await addExpense({
                date,
                amount,
                item: "小口現金・補充",
                category: 'その他',
                paymentMethod: '小口現金',
                type: '補充',
                memo,
                isAnalyzed: false,
                isConfirmed: true,
            });
            showNotification("現金を補充しました");
            onClose();
            // Reset
            setAmount(10000);
            setMemo("");
        } catch (error) {
            console.error(error);
            showNotification("登録に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-8 py-6 bg-emerald-600 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <Plus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight leading-none uppercase italic">Refill Cash</h2>
                            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">現金の補充を記録</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Amount Field */}
                    <div className="group text-emerald-600">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                            <Hash className="w-3 h-3" /> Amount / 補充額
                        </label>
                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black opacity-30">¥</span>
                            <input
                                type="number"
                                value={amount === 0 ? '' : amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                className="w-full pl-12 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-2xl font-black text-emerald-600"
                                placeholder="0"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Date Field */}
                        <div className="group text-slate-900">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> Date / 日付
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-black text-slate-900"
                                required
                            />
                        </div>
                        {/* Static Type Info */}
                        <div className="group opacity-60">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                                <Wallet className="w-3 h-3" /> Target / 入金先
                            </label>
                            <div className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-400 cursor-not-allowed">
                                小口現金
                            </div>
                        </div>
                    </div>

                    {/* Memo Field */}
                    <div className="group text-slate-900">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                            Memo / メモ
                        </label>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-bold text-slate-600 min-h-[80px]"
                            placeholder="レジ金の補充、お釣り用の準備など"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            "Processing..."
                        ) : (
                            <>
                                <Save className="w-4 h-4" /> 補充を記録する
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
