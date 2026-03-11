"use client";

import { useState } from "react";
import { useStore, IssuedDocument, InvoicePayment } from "@/lib/store";
import { NumberInput } from "@/components/NumberInput";
import { X, CreditCard, Save } from "lucide-react";

interface InvoicePaymentModalProps {
    invoice: IssuedDocument;
    initialAmount: number; // Remaining balance
    onClose: () => void;
}

const BRAND = "#b27f79";
const BRAND_LIGHT = "#f5eeee";

export function InvoicePaymentModal({ invoice, initialAmount, onClose }: InvoicePaymentModalProps) {
    const { addInvoicePayment, saveIssuedDocument, generateDocNumber } = useStore();
    const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [amount, setAmount] = useState<number>(initialAmount);
    const [method, setMethod] = useState<InvoicePayment['method']>("銀行振込");
    const [notes, setNotes] = useState("");
    const [issueReceipt, setIssueReceipt] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!date || amount <= 0) {
            alert("入金日と0円より大きい入金額を入力してください。");
            return;
        }

        setIsSaving(true);
        try {
            const payment = await addInvoicePayment({
                invoiceId: invoice.id,
                date,
                amount,
                method,
                notes
            });

            if (issueReceipt) {
                const year = new Date().getFullYear().toString();
                const docNumber = generateDocNumber('receipt', year);
                await saveIssuedDocument({
                    type: 'receipt',
                    docNumber,
                    status: 'issued',
                    issuedDate: date,
                    period: invoice.period,
                    recipientType: invoice.recipientType,
                    storeId: invoice.storeId,
                    supplierId: invoice.supplierId,
                    recipientName: invoice.recipientName,
                    totalAmount: amount,
                    taxRate: invoice.taxRate,
                    paymentMethod: method,
                    memo: notes || "お品代として",
                    sourceDocId: payment.id,
                });
            }

            onClose();
        } catch (error) {
            console.error("Failed to save payment:", error);
            alert("入金の登録に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: BRAND_LIGHT }}>
                            <CreditCard className="w-5 h-5" style={{ color: BRAND }} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-900">入金登録</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{invoice.docNumber}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-4">
                    {/* Date */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">入金日</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
                        />
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span>入金額</span>
                            <span className="text-[10px] text-slate-400 font-normal">現在の残高: ¥{initialAmount.toLocaleString()}</span>
                        </label>
                        <NumberInput
                            value={amount}
                            onChange={(val) => setAmount(val || 0)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
                            placeholder="0"
                            min={1}
                        />
                        {amount > initialAmount && (
                            <p className="mt-1 text-[10px] text-amber-600 font-medium">※入金額が現在の残高を上回っています。</p>
                        )}
                    </div>

                    {/* Method */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">支払方法</label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value as InvoicePayment['method'])}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
                        >
                            <option value="銀行振込">銀行振込</option>
                            <option value="現金">現金</option>
                            <option value="QR決済">QR決済</option>
                            <option value="その他">その他</option>
                        </select>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">備考</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="振込名義や特記事項など..."
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
                        />
                    </div>

                    {/* Issue Receipt Checkbox */}
                    <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <input
                            type="checkbox"
                            id="issueReceipt"
                            checked={issueReceipt}
                            onChange={(e) => setIssueReceipt(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="issueReceipt" className="text-sm font-bold text-slate-700 cursor-pointer">
                            登録と同時に領収書を発行する
                        </label>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors bg-white"
                        disabled={isSaving}
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || amount <= 0}
                        className="flex items-center gap-1.5 px-6 py-2 text-sm font-bold text-white rounded-xl transition-colors disabled:opacity-50"
                        style={{ backgroundColor: BRAND }}
                    >
                        {isSaving ? "保存中..." : <><Save className="w-4 h-4" /> 登録する</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
