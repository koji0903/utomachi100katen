"use client";

import { useState, useMemo, useEffect } from "react";
import {
    FileText, Receipt, Search, Filter, Copy, Eye,
    Pencil, Trash2, CheckCircle2, Clock, ChevronDown,
    ChevronUp, Store, Users, UserCircle, Plus, X,
    Download,
} from "lucide-react";
import { useStore, IssuedDocument, SpotRecipient, InvoiceItem, InvoiceAdjustment } from "@/lib/store";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { SpotRecipientInput } from "@/components/SpotRecipientInput";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import { summarizeTaxByRate } from "@/lib/taxUtils";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";

const today = () => new Date().toISOString().split("T")[0];
const year = new Date().getFullYear().toString();

// ─── Types ────────────────────────────────────────────────────────────────────
type DocStatus = "all" | "draft" | "issued";
type DocType = "all" | "delivery_note" | "payment_summary" | "invoice";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtMoney = (n: number) => `¥${n.toLocaleString()}`;
const fmtDate = (d: string) => d.replace(/-/g, "/");

function StatusBadge({ status }: { status: "draft" | "issued" }) {
    return status === "issued" ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" />発行済
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
            <Clock className="w-2.5 h-2.5" />下書き
        </span>
    );
}

function TypeBadge({ type }: { type: IssuedDocument["type"] }) {
    if (type === "delivery_note") return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: BRAND_LIGHT, color: BRAND }}>
            <Receipt className="w-2.5 h-2.5" />納品書
        </span>
    );
    if (type === "invoice") return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
            <Receipt className="w-2.5 h-2.5" />請求書
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600">
            <FileText className="w-2.5 h-2.5" />支払明細
        </span>
    );
}

// ─── New Document Form Modal ──────────────────────────────────────────────────
function NewDocumentModal({ onClose }: { onClose: () => void }) {
    const { retailStores, suppliers, saveIssuedDocument, generateDocNumber } = useStore();
    const [docType, setDocType] = useState<IssuedDocument["type"]>("delivery_note");
    const [recipientType, setRecipientType] = useState<"store" | "supplier" | "spot">("store");
    const [storeId, setStoreId] = useState("");
    const [supplierId, setSupplierId] = useState("");
    const [spotRecipient, setSpotRecipient] = useState<SpotRecipient | null>(null);
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [periodMode, setPeriodMode] = useState<"month" | "day">("month");
    const [isSaving, setIsSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const recipientName = useMemo(() => {
        if (recipientType === "store") return retailStores.find(s => s.id === storeId)?.name ?? "";
        if (recipientType === "supplier") return suppliers.find(s => s.id === supplierId)?.name ?? "";
        return spotRecipient?.name ?? "";
    }, [recipientType, storeId, supplierId, spotRecipient, retailStores, suppliers]);

    // Edit states for Invoice
    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
    const [invoiceAdjustments, setInvoiceAdjustments] = useState<InvoiceAdjustment[]>([]);
    const [taxRate, setTaxRate] = useState<8 | 10>(10);
    const [totalAmountState, setTotalAmountState] = useState(0);

    // Effect to initialize items for Invoice
    const { sales, products } = useStore();
    useEffect(() => {
        if (docType === "invoice" && recipientName && period) {
            // Logic to fetch initial items (aggregate from sales similar to preview)
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
    }, [docType, recipientName, period, sales, products]);

    const canPreview = recipientName && period;

    const handleSave = async (status: "draft" | "issued") => {
        if (!recipientName || !period) return;
        setIsSaving(true);
        try {
            const docNumber = generateDocNumber(docType, year);
            const totalAmount = docType === "invoice" ? totalAmountState : 0;
            await saveIssuedDocument({
                type: docType,
                docNumber,
                status,
                issuedDate: today(),
                period,
                recipientType,
                storeId: recipientType === "store" ? storeId : undefined,
                supplierId: recipientType === "supplier" ? supplierId : undefined,
                spotRecipientId: recipientType === "spot" ? spotRecipient?.id : undefined,
                recipientName,
                totalAmount,
                taxRate: docType === "invoice" ? taxRate : undefined,
                details: docType === "invoice" ? invoiceItems : undefined,
                adjustments: docType === "invoice" ? invoiceAdjustments : undefined,
                memo: "",
            });
            onClose(); // Automatically close after save
        } catch (err) {
            console.error("Save failed:", err);
            alert("保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className={`bg-white rounded-2xl shadow-2xl w-full translate-y-0 opacity-100 transition-all duration-300 ${docType === 'invoice' ? 'max-w-4xl' : 'max-w-lg'}`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: BRAND_LIGHT }}>
                            <Plus className="w-4 h-4" style={{ color: BRAND }} />
                        </div>
                        <div className="font-bold text-slate-900">新規帳票を作成</div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Doc type */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">書類種別</label>
                        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                            {([["delivery_note", "納品書", Receipt], ["invoice", "請求書", Receipt], ["payment_summary", "支払明細", FileText]] as const).map(([type, label, Icon]) => (
                                <button key={type} onClick={() => setDocType(type)}
                                    className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-all ${docType === type ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
                                    <Icon className="w-4 h-4" />{label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Recipient type */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">宛先種別</label>
                        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                            {([["store", "販売店舗", Store], ["supplier", "仕入先", Users], ["spot", "スポット", UserCircle]] as const).map(([type, label, Icon]) => (
                                <button key={type} onClick={() => setRecipientType(type)}
                                    className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${recipientType === type ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
                                    <Icon className="w-3.5 h-3.5" />{label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Recipient selector */}
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

                    {/* Period */}
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

                    {/* Invoice Editor */}
                    {docType === "invoice" && recipientName && period && (
                        <div className="pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                            <InvoiceEditor
                                items={invoiceItems}
                                adjustments={invoiceAdjustments}
                                taxRate={taxRate}
                                onChange={(data) => {
                                    setInvoiceItems(data.items);
                                    setInvoiceAdjustments(data.adjustments);
                                    setTaxRate(data.taxRate);
                                    setTotalAmountState(data.totalAmount);
                                }}
                            />
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

            {/* Preview modal (opened from within) */}
            {showPreview && (
                <DocumentPreviewModal
                    type={docType}
                    storeId={recipientType === "store" ? storeId : undefined}
                    supplierId={recipientType === "supplier" ? supplierId : undefined}
                    period={(docType === "delivery_note" || docType === "invoice") ? period : undefined}
                    month={docType === "payment_summary" ? period : undefined}
                    customDetails={docType === "invoice" ? invoiceItems : undefined}
                    customAdjustments={docType === "invoice" ? invoiceAdjustments : undefined}
                    customTaxRate={docType === "invoice" ? taxRate : undefined}
                    onClose={() => setShowPreview(false)}
                />
            )}
        </div>
    );
}

// ─── Documents Page ───────────────────────────────────────────────────────────
export default function DocumentsPage() {
    const { isLoaded, issuedDocuments, duplicateDocument, deleteIssuedDocument, updateIssuedDocument } = useStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<DocStatus>("all");
    const [filterType, setFilterType] = useState<DocType>("all");
    const [sortDesc, setSortDesc] = useState(true);
    const [showNewModal, setShowNewModal] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<IssuedDocument | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

    // ── Filter + sort ─────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        if (!isLoaded) return [];
        return issuedDocuments
            .filter(d => {
                const matchType = filterType === "all" || d.type === filterType;
                const matchStatus = filterStatus === "all" || d.status === filterStatus;
                const q = searchQuery.toLowerCase();
                const matchSearch = !searchQuery ||
                    d.recipientName.toLowerCase().includes(q) ||
                    d.docNumber.toLowerCase().includes(q) ||
                    d.period.includes(q);
                return matchType && matchStatus && matchSearch;
            })
            .sort((a, b) => {
                const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt || 0);
                return sortDesc
                    ? dateB.getTime() - dateA.getTime()
                    : dateA.getTime() - dateB.getTime();
            });
    }, [issuedDocuments, filterStatus, filterType, searchQuery, sortDesc, isLoaded]);

    const stats = useMemo(() => {
        if (!isLoaded) return { total: 0, issued: 0, draft: 0, delivery: 0, invoice: 0, payment: 0 };
        return {
            total: issuedDocuments.length,
            issued: issuedDocuments.filter(d => d.status === "issued").length,
            draft: issuedDocuments.filter(d => d.status === "draft").length,
            delivery: issuedDocuments.filter(d => d.type === "delivery_note").length,
            invoice: issuedDocuments.filter(d => d.type === "invoice").length,
            payment: issuedDocuments.filter(d => d.type === "payment_summary").length,
        };
    }, [issuedDocuments, isLoaded]);

    const handleDuplicate = async (id: string) => {
        setDuplicatingId(id);
        try { await duplicateDocument(id); }
        finally { setDuplicatingId(null); }
    };

    const handleDelete = async (id: string) => {
        await deleteIssuedDocument(id);
        setDeletingId(null);
    };

    const handleMarkIssued = async (d: IssuedDocument) => {
        await updateIssuedDocument(d.id, { status: "issued", issuedDate: today() });
    };

    if (!isLoaded) return <div className="p-8 text-slate-500 animate-pulse">読み込み中...</div>;

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">帳票アーカイブ</h1>
                    <p className="text-slate-500 mt-1 text-sm">発行済み・下書きの帳票を一元管理</p>
                </div>
                <button onClick={() => setShowNewModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition-all hover:opacity-90"
                    style={{ backgroundColor: BRAND }}>
                    <Plus className="w-4 h-4" />新規帳票を作成
                </button>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                {[
                    { label: "総件数", value: stats.total, color: "#6366f1" },
                    { label: "発行済", value: stats.issued, color: "#10b981" },
                    { label: "下書き", value: stats.draft, color: "#f59e0b" },
                    { label: "納品書", value: stats.delivery, color: BRAND },
                    { label: "請求書", value: stats.invoice, color: "#f43f5e" },
                    { label: "支払明細", value: stats.payment, color: "#6366f1" },
                ].map(item => (
                    <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-3 flex sm:flex-col sm:items-start items-center gap-2.5">
                        <div className="w-2 h-8 rounded-full" style={{ backgroundColor: item.color + "40", borderLeft: `3px solid ${item.color}` }} />
                        <div>
                            <div className="text-xs text-slate-400 font-medium">{item.label}</div>
                            <div className="text-lg font-black text-slate-900">{item.value}<span className="text-xs text-slate-400 ml-0.5">件</span></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="宛先名・書類番号・期間で検索…"
                        className="flex-1 text-sm bg-transparent focus:outline-none text-slate-800 placeholder:text-slate-400" />
                    {searchQuery && <button onClick={() => setSearchQuery("")}><X className="w-3.5 h-3.5 text-slate-400" /></button>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as DocStatus)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none">
                        <option value="all">すべての状態</option>
                        <option value="issued">発行済</option>
                        <option value="draft">下書き</option>
                    </select>
                    <select value={filterType} onChange={e => setFilterType(e.target.value as DocType)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none">
                        <option value="all">すべての書類</option>
                        <option value="delivery_note">納品書</option>
                        <option value="invoice">請求書</option>
                        <option value="payment_summary">支払明細</option>
                    </select>
                    <button onClick={() => setSortDesc(v => !v)}
                        className="flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
                        発行日 {sortDesc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                    </button>
                </div>
                <div className="ml-auto text-xs text-slate-400 font-medium self-center">{filtered.length}件表示</div>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: BRAND_LIGHT }}>
                        <FileText className="w-8 h-8" style={{ color: BRAND }} />
                    </div>
                    <h3 className="font-bold text-slate-700 mb-1">帳票がありません</h3>
                    <p className="text-sm text-slate-400 mb-4">「新規帳票を作成」から最初の帳票を発行してください</p>
                    <button onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl"
                        style={{ backgroundColor: BRAND }}>
                        <Plus className="w-4 h-4" />新規作成
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="px-4 py-3 text-left">書類番号</th>
                                    <th className="px-4 py-3 text-left">種別</th>
                                    <th className="px-4 py-3 text-left">宛先</th>
                                    <th className="px-4 py-3 text-left">対象期間</th>
                                    <th className="px-4 py-3 text-left">発行日</th>
                                    <th className="px-4 py-3 text-left">状態</th>
                                    <th className="px-4 py-3 text-right">合計金額</th>
                                    <th className="px-4 py-3 text-center">アクション</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((doc, idx) => (
                                    <tr key={doc.id}
                                        className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-50/20"}`}>
                                        <td className="px-4 py-3">
                                            <span className="font-mono font-bold text-slate-800 text-xs tracking-wide">{doc.docNumber}</span>
                                        </td>
                                        <td className="px-4 py-3"><TypeBadge type={doc.type} /></td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-slate-800">{doc.recipientName}</div>
                                            {doc.recipientType === "spot" && (
                                                <div className="text-[10px] text-amber-500 font-bold">スポット</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs font-medium">{fmtDate(doc.period)}</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(doc.issuedDate)}</td>
                                        <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                                            {doc.totalAmount > 0 ? fmtMoney(doc.totalAmount) : <span className="text-slate-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {deletingId === doc.id ? (
                                                <div className="flex items-center gap-1 justify-center">
                                                    <span className="text-xs text-red-600 font-medium">削除しますか？</span>
                                                    <button onClick={() => handleDelete(doc.id)}
                                                        className="text-xs font-bold text-white bg-red-500 rounded-lg px-2 py-1 hover:bg-red-600">
                                                        削除
                                                    </button>
                                                    <button onClick={() => setDeletingId(null)}
                                                        className="text-xs font-bold text-slate-500 bg-slate-100 rounded-lg px-2 py-1 hover:bg-slate-200">
                                                        取消
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 justify-center">
                                                    <button onClick={() => setPreviewDoc(doc)}
                                                        title="プレビュー / PDF"
                                                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDuplicate(doc.id)}
                                                        disabled={duplicatingId === doc.id}
                                                        title="複製（枝番付与）"
                                                        className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-40">
                                                        {duplicatingId === doc.id
                                                            ? <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                                            : <Copy className="w-4 h-4" />}
                                                    </button>
                                                    {doc.status === "draft" && (
                                                        <button onClick={() => handleMarkIssued(doc)}
                                                            title="発行済みにする"
                                                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => setDeletingId(doc.id)}
                                                        title="削除"
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showNewModal && <NewDocumentModal onClose={() => setShowNewModal(false)} />}
            {previewDoc && (
                <DocumentPreviewModal
                    type={previewDoc.type}
                    storeId={previewDoc.storeId}
                    supplierId={previewDoc.supplierId}
                    period={previewDoc.period}
                    month={previewDoc.period}
                    docNumber={previewDoc.docNumber}
                    recipientName={previewDoc.recipientName}
                    customDetails={previewDoc.details}
                    customAdjustments={previewDoc.adjustments}
                    customTaxRate={previewDoc.taxRate}
                    onClose={() => setPreviewDoc(null)}
                />
            )}
        </div>
    );
}
