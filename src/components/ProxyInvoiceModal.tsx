"use client";

import { useState } from "react";
import { Plus, X, Users } from "lucide-react";
import { useStore, InvoiceItem, InvoiceAdjustment } from "@/lib/store";
import { ProxyInvoicePreviewModal } from "./ProxyInvoicePreviewModal";
import { InvoiceEditor } from "@/components/InvoiceEditor";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";
const today = () => new Date().toISOString().split("T")[0];
const year = new Date().getFullYear().toString();

interface ProxyInvoiceModalProps {
    onClose: () => void;
}

export function ProxyInvoiceModal({ onClose }: ProxyInvoiceModalProps) {
    const { suppliers, generateDocNumber, saveIssuedDocument } = useStore();

    const [supplierId, setSupplierId] = useState("");
    const [period, setPeriod] = useState(today());
    const [isSaving, setIsSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
    const [invoiceAdjustments, setInvoiceAdjustments] = useState<InvoiceAdjustment[]>([]);
    const [taxRate, setTaxRate] = useState<8 | 10>(8);
    const [taxType, setTaxType] = useState<'inclusive' | 'exclusive'>('inclusive');
    const [finalAdjustment, setFinalAdjustment] = useState(0);
    const [totalAmountState, setTotalAmountState] = useState(0);

    const [generatedDocNumber, setGeneratedDocNumber] = useState<string | null>(null);

    const supplier = suppliers.find(s => s.id === supplierId);
    const canPreview = supplierId && period && invoiceItems.length > 0;

    const handleSave = async (status: "draft" | "issued", openPreviewAfter = false) => {
        if (!supplier || !period) return;
        setIsSaving(true);
        try {
            const payload = {
                type: "proxy_invoice" as const,
                period,
                recipientType: "supplier" as const,
                supplierId: supplier.id,
                recipientName: supplier.name, 
                totalAmount: totalAmountState,
                taxRate,
                taxType,
                details: invoiceItems,
                adjustments: invoiceAdjustments,
                finalAdjustment,
                memo: "代行作成分",
            };

            const docNumber = generatedDocNumber || `P-INV-${Date.now().toString().slice(-8)}`;
            if (!generatedDocNumber) {
                setGeneratedDocNumber(docNumber);
            }

            await saveIssuedDocument({
                ...payload,
                docNumber,
                status,
                issuedDate: today(),
            });

            if (openPreviewAfter) {
                setShowPreview(true);
            } else {
                onClose();
            }
        } catch (err) {
            console.error("Save failed:", err);
            alert("保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl translate-y-0 opacity-100 transition-all duration-300">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: BRAND_LIGHT }}>
                            <Plus className="w-4 h-4" style={{ color: BRAND }} />
                        </div>
                        <div className="font-bold text-slate-900">請求書作成代行（仕入先からの請求）</div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">発行元（仕入先）</label>
                            <div className="flex items-center gap-2">
                                <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl">
                                    <Users className="w-4 h-4" />
                                </div>
                                <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-900">
                                    <option value="">仕入先を選択してください</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">請求日</label>
                            <input type="date" value={period}
                                onChange={e => setPeriod(e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 font-medium text-slate-900" />
                        </div>
                    </div>

                    {supplierId && period && (
                        <div className="pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                            <InvoiceEditor
                                items={invoiceItems}
                                adjustments={invoiceAdjustments}
                                taxRate={taxRate}
                                taxType={taxType}
                                onChange={(data) => {
                                    setInvoiceItems(data.items);
                                    setInvoiceAdjustments(data.adjustments);
                                    setTaxRate(data.taxRate);
                                    setTaxType(data.taxType);
                                    setTotalAmountState(data.totalAmount);
                                    setFinalAdjustment(data.finalAdjustment || 0);
                                }}
                                finalAdjustment={finalAdjustment}
                            />
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100">キャンセル</button>
                    <button 
                        onClick={() => handleSave("draft", false)} 
                        disabled={!canPreview || isSaving}
                        className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl disabled:opacity-50 transition-all hover:bg-slate-50"
                    >
                        下書き保存
                    </button>
                    <button onClick={() => handleSave("draft", true)} disabled={!canPreview || isSaving}
                        className="px-4 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-all"
                        style={{ backgroundColor: BRAND }}>
                        プレビューして発行
                    </button>
                </div>
            </div>

            {showPreview && (
                <ProxyInvoicePreviewModal
                    supplierId={supplierId}
                    period={period}
                    docNumber={generatedDocNumber || undefined}
                    customDetails={invoiceItems}
                    customAdjustments={invoiceAdjustments}
                    customTaxRate={taxRate}
                    customTaxType={taxType}
                    onClose={() => setShowPreview(false)}
                    onSuccess={onClose}
                />
            )}
        </div>
    );
}
