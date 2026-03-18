// src/components/Expenses/ExpenseReportModal.tsx
"use client";

import { useState } from "react";
import { X, Download, Mail, Loader2, Calendar, FileText, CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { generateExpensePDF } from "@/lib/expenseReportUtils";
import { showNotification } from "@/lib/notifications";

interface ExpenseReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ExpenseReportModal({ isOpen, onClose }: ExpenseReportModalProps) {
    const { expenses, companySettings } = useStore();
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [receiptEmail, setReceiptEmail] = useState("utomachi2024@gmail.com");

    if (!isOpen) return null;

    const filteredExpenses = expenses
        .filter(e => !e.isTrashed)
        .filter(e => e.date >= startDate && e.date <= endDate)
        .sort((a, b) => a.date.localeCompare(b.date));

    const handleDownload = () => {
        setIsGenerating(true);
        try {
            const doc = generateExpensePDF(filteredExpenses, `${startDate} - ${endDate}`);
            doc.save(`expense_report_${startDate}_${endDate}.pdf`);
            showNotification("PDFレポートをダウンロードしました。");
        } catch (error) {
            console.error(error);
            showNotification("PDF作成に失敗しました。");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendEmail = async () => {
        if (!receiptEmail) {
            showNotification("送信先メールアドレスを入力してください。");
            return;
        }

        setIsSending(true);
        try {
            const doc = generateExpensePDF(filteredExpenses, `${startDate} - ${endDate}`);
            const pdfBase64 = doc.output('datauristring');

            const response = await fetch("/api/reports/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    period: `${startDate} 〜 ${endDate}`,
                    recipient: receiptEmail,
                    pdfBase64: pdfBase64
                })
            });

            if (!response.ok) throw new Error("Email sending failed");

            showNotification("レポートをメール送信しました。");
        } catch (error) {
            console.error(error);
            showNotification("メール送信に失敗しました。");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <Download className="w-5 h-5 text-rose-500" />
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">レポート出力</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Period selection */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                            <Calendar className="w-4 h-4" /> 期間を選択
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">開始日</label>
                                <input 
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">終了日</label>
                                <input 
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm font-bold"
                                />
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-500 flex justify-between">
                            <span>対象データ数:</span>
                            <span className="text-rose-600">{filteredExpenses.length} 件</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={handleDownload}
                            disabled={isGenerating || filteredExpenses.length === 0}
                            className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5 text-rose-500" />}
                            PDFをローカルに保存
                        </button>

                        <div className="relative py-2 text-center">
                            <span className="bg-white px-4 text-[10px] font-black text-slate-300 uppercase relative z-10">またはメールで送信</span>
                            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-100 z-0"></div>
                        </div>

                        <div className="space-y-4">
                            <input 
                                type="email"
                                placeholder="送信先メールアドレス"
                                value={receiptEmail}
                                onChange={(e) => setReceiptEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm font-medium"
                            />
                            <button
                                onClick={handleSendEmail}
                                disabled={isSending || filteredExpenses.length === 0}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5 text-rose-400" />}
                                レポートをメールで送信
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
