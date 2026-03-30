// src/components/Expenses/ExpenseEditModal.tsx
"use client";

import { useState, useEffect } from "react";
import { 
    X, FileText, Loader2, Check, 
    Receipt, Store, Calendar, CreditCard, 
    Tag, Maximize2, Save
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Expense, ExpenseCategory } from "@/lib/types/expense";
import { showNotification } from "@/lib/notifications";
import { FilePreviewModal } from "./FilePreviewModal";

interface ExpenseEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    expense: Expense | null;
}

const CATEGORIES: ExpenseCategory[] = ['備品', '消耗品', '飲食費', '交通費', '通信費', '光熱費', '広告宣伝費', '支払手数料', 'その他'];

export function ExpenseEditModal({ isOpen, onClose, expense }: ExpenseEditModalProps) {
    const { updateExpense } = useStore();
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [date, setDate] = useState("");
    const [vendor, setVendor] = useState("");
    const [amount, setAmount] = useState<number>(0);
    const [item, setItem] = useState("");
    const [category, setCategory] = useState<ExpenseCategory>('消耗品');
    const [memo, setMemo] = useState("");

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Initial load from expense prop
    useEffect(() => {
        if (expense && isOpen) {
            setDate(expense.date);
            setVendor(expense.vendor || "");
            setAmount(expense.amount);
            setItem(expense.item);
            setCategory(expense.category);
            setMemo(expense.memo || "");
        }
    }, [expense, isOpen]);

    if (!isOpen || !expense) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !amount || !item) {
            showNotification("必須項目を入力してください。");
            return;
        }

        setIsSaving(true);
        try {
            await updateExpense(expense.id, {
                date,
                vendor,
                amount,
                item,
                category,
                memo,
                isConfirmed: true, // Mark as confirmed after edit
            });

            showNotification("変更を保存しました。");
            onClose();
        } catch (error) {
            console.error(error);
            showNotification("保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    const isPdf = expense.fileUrl?.toLowerCase().endsWith(".pdf");

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in duration-300">
                    {/* Left: Preview */}
                    <div className="flex-1 bg-slate-50 p-6 md:p-10 flex flex-col border-b md:border-b-0 md:border-r border-slate-100 items-center justify-center relative">
                        <div className="absolute top-8 left-8 text-slate-900">
                            <h2 className="text-2xl font-black flex items-center gap-2">
                                <span className="p-2 bg-rose-50 rounded-xl">
                                    <Receipt className="w-6 h-6 text-rose-500" />
                                </span>
                                内容を編集
                            </h2>
                            <p className="text-slate-400 text-xs mt-1 font-bold italic tracking-wide uppercase">Edit Expense details</p>
                        </div>

                        {expense.fileUrl ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-slate-100 p-4 shadow-sm overflow-hidden group relative mt-16">
                                {isPdf ? (
                                    <div className="w-full h-full relative">
                                        <iframe 
                                            src={`${expense.fileUrl}#toolbar=0&navpanes=0`}
                                            className="w-full h-full border-0 rounded-2xl bg-slate-50 pointer-events-none"
                                            title="PDF Preview"
                                        />
                                        <div className="absolute inset-0 bg-transparent z-10" />
                                    </div>
                                ) : (
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <img 
                                            src={expense.fileUrl} 
                                            alt="Receipt Preview" 
                                            className="max-w-full max-h-[500px] object-contain rounded-2xl shadow-lg transition-transform group-hover:scale-[1.01]"
                                        />
                                    </div>
                                )}
                                
                                <div className="absolute bottom-6 flex items-center gap-3 z-20">
                                    <button 
                                        type="button"
                                        onClick={() => setIsPreviewOpen(true)}
                                        className="bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-black hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20"
                                    >
                                        <Maximize2 className="w-3.5 h-3.5" /> プレビューを拡大
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-slate-300">
                                <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-100">
                                    <Receipt className="w-16 h-16" />
                                </div>
                                <p className="font-bold text-sm tracking-widest uppercase">No attachment</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Form */}
                    <div className="w-full md:w-[450px] bg-white p-6 md:p-10 overflow-y-auto custom-scrollbar">
                        <div className="flex justify-end mb-6">
                            <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="space-y-6">
                                <div className="group text-slate-900">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <Calendar className="w-3.5 h-3.5 text-slate-300" /> 日付
                                    </label>
                                    <input 
                                        type="date" 
                                        required
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-black"
                                    />
                                </div>

                                <div className="group text-slate-900">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <Store className="w-3.5 h-3.5 text-slate-300" /> 購入先
                                    </label>
                                    <input 
                                        type="text" 
                                        placeholder="店名など"
                                        value={vendor}
                                        onChange={(e) => setVendor(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-black"
                                    />
                                </div>

                                <div className="group text-slate-900">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <Receipt className="w-3.5 h-3.5 text-slate-300" /> 品目・内容
                                    </label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="例: 事務手数料"
                                        value={item}
                                        onChange={(e) => setItem(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-black"
                                    />
                                </div>

                                <div className="group">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <CreditCard className="w-3.5 h-3.5 text-slate-300" /> 金額
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">¥</span>
                                        <input 
                                            type="number" 
                                            required
                                            value={amount || ""}
                                            onChange={(e) => setAmount(Number(e.target.value))}
                                            className="w-full pl-10 pr-5 py-4 bg-slate-900 border-none rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-xl font-black text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                                        <Tag className="w-3.5 h-3.5 text-slate-300" /> カテゴリー
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {CATEGORIES.map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setCategory(cat)}
                                                className={`px-3 py-2 text-[10px] font-black rounded-xl border transition-all ${category === cat ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-rose-200 hover:bg-white'}`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="group text-slate-900">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                                        メモ
                                    </label>
                                    <textarea 
                                        value={memo}
                                        onChange={(e) => setMemo(e.target.value)}
                                        rows={2}
                                        placeholder="補足事項があれば入力してください"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-bold text-slate-700 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 divide-y divide-slate-100">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`w-full py-5 bg-slate-900 text-white font-black text-lg rounded-[1.5rem] shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-3 ${isSaving ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:bg-black hover:-translate-y-1'}`}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            <span>保存中...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-6 h-6" />
                                            <span>内容を更新する</span>
                                        </>
                                    )}
                                </button>
                                <p className="text-[10px] text-slate-400 text-center mt-4 font-bold uppercase tracking-widest pt-4">Finalize and Update</p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <FilePreviewModal 
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                fileUrl={expense.fileUrl || ""}
                fileName={expense.item}
            />
        </>
    );
}
