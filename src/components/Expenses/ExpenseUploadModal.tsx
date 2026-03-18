// src/components/Expenses/ExpenseUploadModal.tsx
"use client";

import { useState, useEffect } from "react";
import { X, Upload, FileText, Loader2, Check, AlertCircle, Receipt, Store, Calendar, CreditCard, Plus, Tag } from "lucide-react";
import { useStore } from "@/lib/store";
import { Expense, ExpenseCategory } from "@/lib/types/expense";
import { showNotification } from "@/lib/notifications";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

interface ExpenseUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CATEGORIES: ExpenseCategory[] = ['備品', '消耗品', '飲食費', '交通費', '通信費', '光熱費', '広告宣伝費', '支払手数料', 'その他'];

export function ExpenseUploadModal({ isOpen, onClose }: ExpenseUploadModalProps) {
    const { addExpense } = useStore();
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state (AI will fill these)
    const [date, setDate] = useState("");
    const [vendor, setVendor] = useState("");
    const [amount, setAmount] = useState<number>(0);
    const [item, setItem] = useState("");
    const [category, setCategory] = useState<ExpenseCategory>('消耗品');
    const [memo, setMemo] = useState("");

    const [isAnalyzed, setIsAnalyzed] = useState(false);

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            analyzeFile(selectedFile);
        }
    };

    const analyzeFile = async (selectedFile: File) => {
        setIsAnalyzing(true);
        setIsAnalyzed(false);
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);

            const response = await fetch("/api/expenses/analyze", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("AI分析に失敗しました");

            const data = await response.json();
            
            // Fill form with AI results
            if (data.date) setDate(data.date);
            if (data.vendor) setVendor(data.vendor);
            if (data.amount) setAmount(data.amount);
            if (data.item) setItem(data.item);
            if (data.category && CATEGORIES.includes(data.category)) {
                setCategory(data.category as ExpenseCategory);
            }
            
            setIsAnalyzed(true);
            showNotification("AIによる解析が完了しました。内容を確認してください。");
        } catch (error) {
            console.error(error);
            showNotification("AI解析に失敗しました。手動で入力してください。");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !date || !amount || !item) {
            showNotification("必須項目を入力してください。");
            return;
        }

        setIsSaving(true);
        try {
            // 1. Upload to Storage
            const uniqueFileName = `${Date.now()}_${file.name}`;
            const storagePath = `expenses/${uniqueFileName}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            const fileUrl = await getDownloadURL(storageRef);

            // 2. Save to Firestore
            await addExpense({
                date,
                vendor,
                amount,
                item,
                category,
                memo,
                fileUrl,
                storagePath,
                isAnalyzed: true,
                isConfirmed: true, // User clicked "Save" after review
                isTrashed: false
            });

            showNotification("支出を記録しました。");
            onClose();
            // Reset
            setFile(null);
            setDate("");
            setVendor("");
            setAmount(0);
            setItem("");
            setCategory('消耗品');
            setMemo("");
            setIsAnalyzed(false);
        } catch (error) {
            console.error(error);
            showNotification("保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Left: Upload & Preview */}
                <div className="flex-1 bg-slate-50 p-8 flex flex-col border-b md:border-b-0 md:border-r border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <Plus className="w-6 h-6 text-rose-500" />
                            記録を追加
                        </h2>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center relative">
                        {file ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm overflow-hidden">
                                {file.type.startsWith('image/') ? (
                                    <img 
                                        src={URL.createObjectURL(file)} 
                                        alt="Receipt" 
                                        className="max-w-full max-h-[400px] object-contain rounded-lg"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-4 text-slate-400">
                                        <FileText className="w-24 h-24" />
                                        <span className="font-bold text-sm">{file.name}</span>
                                    </div>
                                )}
                                <button 
                                    onClick={() => setFile(null)}
                                    className="mt-4 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    ファイルを変更
                                </button>
                            </div>
                        ) : (
                            <label className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-white hover:bg-rose-50/30 hover:border-rose-300 transition-all cursor-pointer group">
                                <div className="p-6 bg-rose-50 rounded-full text-rose-500 mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-10 h-10" />
                                </div>
                                <span className="font-bold text-slate-600">レシート・領収書をアップロード</span>
                                <span className="text-xs text-slate-400 mt-2">PDFまたは画像 (JPG, PNG)</span>
                                <input type="file" onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                            </label>
                        )}

                        {isAnalyzing && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl">
                                <Loader2 className="w-12 h-12 text-rose-500 animate-spin mb-4" />
                                <p className="font-bold text-slate-900">AIが内容を分析中...</p>
                                <p className="text-xs text-slate-500 mt-1">数秒お待ちください</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Form */}
                <div className="w-full md:w-[400px] bg-white p-8 overflow-y-auto custom-scrollbar">
                    <div className="flex justify-end mb-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                            <X className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {isAnalyzed && (
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                                <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                <div className="text-xs text-emerald-700 font-medium">
                                    AI分析が完了しました。自動入力された内容を確認・修正してください。
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                    <Calendar className="w-3 h-3" /> 日付
                                </label>
                                <input 
                                    type="date" 
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm font-bold"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                    <Store className="w-3 h-3" /> 購入先
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="例: セブンイレブン, Amazon"
                                    value={vendor}
                                    onChange={(e) => setVendor(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm font-bold"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                    <Receipt className="w-3 h-3" /> 品目・内容
                                </label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="例: 事務手数料, 飲料代"
                                    value={item}
                                    onChange={(e) => setItem(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm font-bold"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                    <CreditCard className="w-3 h-3" /> 金額
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                                    <input 
                                        type="number" 
                                        required
                                        value={amount || ""}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm font-black"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                    <Tag className="w-3 h-3" /> カテゴリー
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setCategory(cat)}
                                            className={`px-3 py-2 text-[10px] font-bold rounded-lg border transition-all ${category === cat ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-rose-300'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                    メモ
                                </label>
                                <textarea 
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm font-medium resize-none"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving || !file}
                            className={`w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2 ${isSaving || !file ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'}`}
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "この内容で保存する"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
