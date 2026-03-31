"use client";

import { useState, useMemo, useEffect } from "react";
import { 
    Plus, X, Receipt, FileText, Store, Users, UserCircle, Clock, Link2 
} from "lucide-react";
import { useStore, IssuedDocument, SpotRecipient, InvoiceItem, InvoiceAdjustment } from "@/lib/store";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { SpotRecipientInput } from "@/components/SpotRecipientInput";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import { NumberInput } from "@/components/NumberInput";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";

const today = () => new Date().toISOString().split("T")[0];
const year = new Date().getFullYear().toString();

interface NewDocumentModalProps {
    onClose: () => void;
    editingDoc?: IssuedDocument;
    initialTransactionId?: string;
}

export function NewDocumentModal({ onClose, editingDoc, initialTransactionId }: NewDocumentModalProps) {
    const { 
        retailStores, suppliers, saveIssuedDocument, updateIssuedDocument, 
        generateDocNumber, updateSpotRecipient, transactions, sales, products, spotRecipients 
    } = useStore();

    const [docType, setDocType] = useState<IssuedDocument["type"]>(editingDoc?.type ?? "delivery_note");
    const [recipientType, setRecipientType] = useState<"store" | "supplier" | "spot">(editingDoc?.recipientType ?? "store");
    const [storeId, setStoreId] = useState(editingDoc?.storeId ?? "");
    const [supplierId, setSupplierId] = useState(editingDoc?.supplierId ?? "");
    const [spotRecipient, setSpotRecipient] = useState<SpotRecipient | null>(null);
    const [period, setPeriod] = useState(editingDoc?.period ?? new Date().toISOString().slice(0, 7));
    const [periodMode, setPeriodMode] = useState<"month" | "day">(editingDoc?.period.length === 10 ? "day" : "month");
    const [isSaving, setIsSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [hidePrices, setHidePrices] = useState(editingDoc?.hidePrices ?? false);
    const [transactionId, setTransactionId] = useState(editingDoc?.transactionId ?? initialTransactionId ?? "");

    const recipientName = useMemo(() => {
        if (recipientType === "store") return retailStores.find(s => s.id === storeId)?.name ?? "";
        if (recipientType === "supplier") return suppliers.find(s => s.id === supplierId)?.name ?? "";
        return spotRecipient?.name ?? "";
    }, [recipientType, storeId, supplierId, spotRecipient, retailStores, suppliers]);

    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>(editingDoc?.details ?? []);
    const [invoiceAdjustments, setInvoiceAdjustments] = useState<InvoiceAdjustment[]>(editingDoc?.adjustments ?? []);
    const [taxRate, setTaxRate] = useState<8 | 10>((editingDoc?.taxRate as 8 | 10) ?? 8);
    const [taxType, setTaxType] = useState<'inclusive' | 'exclusive'>('inclusive');
    const [finalAdjustment, setFinalAdjustment] = useState(editingDoc?.finalAdjustment ?? 0);
    const [totalAmountState, setTotalAmountState] = useState(editingDoc?.totalAmount ?? 0);
    const [paymentMethod, setPaymentMethod] = useState<IssuedDocument['paymentMethod']>(editingDoc?.paymentMethod ?? "現金");

    useEffect(() => {
        if (editingDoc?.spotRecipientId) {
            const spot = spotRecipients.find(r => r.id === editingDoc.spotRecipientId);
            if (spot) setSpotRecipient(spot);
        }
    }, [editingDoc, spotRecipients]);

    useEffect(() => {
        if (editingDoc) return;

        if ((docType === "invoice" || docType === "delivery_note") && recipientName && period) {
            if (recipientType === "spot") {
                setInvoiceItems([]);
                return;
            }

            const filtered = (sales || []).filter(s => {
                const matchStore = recipientType === "store" ? s.storeId === storeId : true;
                const matchPeriod = period ? s.period.startsWith(period) : true;
                return matchStore && matchPeriod;
            });

            const map = new Map<string, InvoiceItem>();
            for (const sale of filtered) {
                for (const item of sale.items) {
                    const product = products.find(p => p.id === item.productId);
                    if (!product) continue;
                    const key = item.productId;
                    if (map.has(key)) {
                        const existing = map.get(key)!;
                        existing.quantity += item.quantity;
                        existing.subtotal += item.subtotal;
                    } else {
                        map.set(key, {
                            id: crypto.randomUUID(),
                            productId: product.id,
                            label: product.name + (product.variantName ? ` (${product.variantName})` : ""),
                            quantity: item.quantity,
                            unitPrice: item.priceAtSale,
                            subtotal: item.subtotal,
                        });
                    }
                }
            }
            setInvoiceItems(Array.from(map.values()));
        }
    }, [docType, recipientName, period, sales, products, editingDoc, recipientType, storeId]);

    const canPreview = recipientName && period;

    const handleSave = async (status: "draft" | "issued") => {
        if (!recipientName || !period) return;
        setIsSaving(true);
        try {
            const totalAmount = (docType === "invoice" || docType === "delivery_note" || docType === "receipt") ? totalAmountState : 0;
            const payload = {
                type: docType,
                period,
                recipientType,
                storeId: recipientType === "store" ? storeId : undefined,
                supplierId: recipientType === "supplier" ? supplierId : undefined,
                spotRecipientId: recipientType === "spot" ? spotRecipient?.id : undefined,
                recipientName,
                totalAmount,
                taxRate: (docType === "invoice" || docType === "delivery_note") ? taxRate : undefined,
                taxType: (docType === "invoice" || docType === "delivery_note") ? taxType : undefined,
                details: (docType === "invoice" || docType === "delivery_note") ? invoiceItems : undefined,
                adjustments: (docType === "invoice" || docType === "delivery_note") ? invoiceAdjustments : undefined,
                finalAdjustment: (docType === "invoice" || docType === "delivery_note") ? finalAdjustment : undefined,
                hidePrices: docType === "delivery_note" ? hidePrices : undefined,
                paymentMethod: docType === "receipt" ? paymentMethod : undefined,
                memo: editingDoc?.memo ?? "",
                transactionId: ((docType === "invoice" || docType === "delivery_note") && transactionId) ? transactionId : undefined,
            };

            if (editingDoc) {
                await updateIssuedDocument(editingDoc.id, payload);
            } else {
                const docNumber = generateDocNumber(docType, year);
                await saveIssuedDocument({
                    ...payload,
                    docNumber,
                    status,
                    issuedDate: today(),
                });
            }

            if (recipientType === "spot" && spotRecipient) {
                await updateSpotRecipient(spotRecipient.id, { lastUsedAt: new Date().toISOString() });
            }

            onClose();
        } catch (err) {
            console.error("Save failed:", err);
            alert("保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    const fmtDate = (d: string) => d.replace(/-/g, "/");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className={`bg-white rounded-2xl shadow-2xl w-full translate-y-0 opacity-100 transition-all duration-300 ${docType === 'invoice' ? 'max-w-4xl' : 'max-w-lg'}`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: BRAND_LIGHT }}>
                            <Plus className="w-4 h-4" style={{ color: BRAND }} />
                        </div>
                        <div className="font-bold text-slate-900">{editingDoc ? "帳票を編集" : "新規帳票を作成"}</div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">書類種別</label>
                        <div className="grid grid-cols-4 gap-2 p-1 bg-slate-100 rounded-xl">
                            {([["delivery_note", "納品書", Receipt], ["invoice", "請求書", Receipt], ["receipt", "領収書", Receipt], ["payment_summary", "支払明細", FileText]] as const).map(([type, label, Icon]) => (
                                <button key={type} onClick={() => setDocType(type)}
                                    className={`flex items-center justify-center gap-1 py-2.5 text-[10px] font-bold rounded-lg transition-all ${docType === type ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
                                    <Icon className="w-3.5 h-3.5" />{label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">宛先種別</label>
                        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                            {([["store", "販売店舗・事業者", Store], ["supplier", "仕入先", Users], ["spot", "スポット", UserCircle]] as const).map(([type, label, Icon]) => (
                                <button key={type} onClick={() => setRecipientType(type)}
                                    className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${recipientType === type ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
                                    <Icon className="w-3.5 h-3.5" />{label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">宛先</label>
                        {recipientType === "store" && (
                            <select value={storeId} onChange={e => setStoreId(e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 font-medium text-slate-900">
                                <option value="">店舗を選択してください</option>
                                {retailStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        )}
                        {recipientType === "supplier" && (
                            <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 font-medium text-slate-900">
                                <option value="">仕入先を選択してください</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        )}
                        {recipientType === "spot" && (
                            <SpotRecipientInput value={spotRecipient} onChange={setSpotRecipient} />
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">対象期間</label>
                        <div className="flex gap-2">
                            <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                                <button onClick={() => setPeriodMode("month")}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${periodMode === "month" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>月次</button>
                                <button onClick={() => setPeriodMode("day")}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${periodMode === "day" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>日次</button>
                            </div>
                            <input type={periodMode === "month" ? "month" : "date"} value={period}
                                onChange={e => setPeriod(e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 font-medium text-slate-900" />
                        </div>
                    </div>

                    {docType === "delivery_note" && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                            <input
                                type="checkbox"
                                id="hidePrices"
                                checked={hidePrices}
                                onChange={e => setHidePrices(e.target.checked)}
                                className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
                            />
                            <label htmlFor="hidePrices" className="text-sm font-bold text-slate-700 cursor-pointer">
                                納品書に価格を表示しない
                            </label>
                        </div>
                    )}

                    {(docType === "invoice" || docType === "delivery_note") && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">紐付ける取引 (任意)</label>
                            <select value={transactionId} onChange={e => setTransactionId(e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 font-medium text-slate-900">
                                <option value="">紐付ける取引を選択...</option>
                                {transactions.filter(t => !t.isTrashed).map(t => (
                                    <option key={t.id} value={t.id}>{t.customerName} - {fmtDate(t.orderDate)} ({t.id.slice(-6)})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {(docType === "invoice" || docType === "delivery_note") && recipientName && period && (
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

                    {docType === "receipt" && (
                        <div className="pt-4 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">領収金額</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                                    <NumberInput
                                        value={totalAmountState}
                                        onChange={(val) => setTotalAmountState(val || 0)}
                                        fallbackValue={0}
                                        className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">支払方法</label>
                                <select 
                                    value={paymentMethod} 
                                    onChange={e => setPaymentMethod(e.target.value as any)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none"
                                >
                                    <option value="現金">現金</option>
                                    <option value="銀行振込">銀行振込</option>
                                    <option value="QR決済">QR決済</option>
                                    <option value="その他">その他</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100">キャンセル</button>
                    <button onClick={() => handleSave("draft")} disabled={!canPreview || isSaving}
                        className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 disabled:opacity-50">
                        下書き保存
                    </button>
                    <button onClick={() => handleSave("issued")} disabled={!canPreview || isSaving}
                        className="px-4 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-all"
                        style={{ backgroundColor: BRAND }}>
                        発行して保存
                    </button>
                </div>
            </div>

            {showPreview && (
                <DocumentPreviewModal
                    type={docType}
                    storeId={recipientType === "store" ? storeId : undefined}
                    supplierId={recipientType === "supplier" ? supplierId : undefined}
                    spotRecipientId={recipientType === "spot" ? spotRecipient?.id : undefined}
                    period={(docType === "delivery_note" || docType === "invoice") ? period : undefined}
                    month={docType === "payment_summary" ? period : undefined}
                    customDetails={(docType === "invoice" || docType === "delivery_note") ? invoiceItems : undefined}
                    customAdjustments={(docType === "invoice" || docType === "delivery_note") ? invoiceAdjustments : undefined}
                    customTaxRate={(docType === "invoice" || docType === "delivery_note") ? taxRate : undefined}
                    customTaxType={(docType === "invoice" || docType === "delivery_note") ? taxType : undefined}
                    hidePrices={docType === "delivery_note" ? hidePrices : false}
                    onClose={() => setShowPreview(false)}
                />
            )}
        </div>
    );
}
