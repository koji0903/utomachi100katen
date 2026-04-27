"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    FileText, Receipt, Search, Filter, Copy, Eye,
    Pencil, Trash2, CheckCircle2, Clock, ChevronDown,
    ChevronUp, Store, Users, UserCircle, Plus, X,
    Download, RotateCcw, FilePlus, Link2, CreditCard, Package, Check,
    Loader2, FileStack, ExternalLink
} from "lucide-react";
import { useStore, IssuedDocument } from "@/lib/store";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { NewDocumentModal } from "@/components/NewDocumentModal";
import { summarizeTaxByRate } from "@/lib/taxUtils";
import { calculateInvoiceBalance } from "@/lib/store";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";

const today = () => new Date().toISOString().split("T")[0];
const year = new Date().getFullYear().toString();

// ─── Types ────────────────────────────────────────────────────────────────────
type DocStatus = "all" | "draft" | "issued" | "paid";
type DocType = "all" | "delivery_note" | "invoice" | "receipt" | "payment_summary";

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

function TypeBadge({ doc, allDocs }: { doc: IssuedDocument, allDocs: IssuedDocument[] }) {
    const { type, sourceDocId } = doc;
    const sourceDoc = sourceDocId ? allDocs.find(d => d.id === sourceDocId) : null;
    const hasLinkedInvoice = type === "delivery_note" && allDocs.some(d => d.type === "invoice" && d.sourceDocId === doc.id && !d.isTrashed);

    if (type === "delivery_note") return (
        <div className="flex flex-col gap-1 items-start">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: BRAND_LIGHT, color: BRAND }}>
                <Receipt className="w-2.5 h-2.5" />納品書
            </span>
            {hasLinkedInvoice && (
                <span className="text-[8px] text-emerald-600 flex items-center gap-0.5 px-1 font-bold animate-in fade-in slide-in-from-left-1 duration-500">
                    <Check className="w-2 h-2" />
                    請求書作成済み
                </span>
            )}
        </div>
    );
    if (type === "invoice") return (
        <div className="flex flex-col gap-1 items-start">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                <Receipt className="w-2.5 h-2.5" />請求書
            </span>
            {sourceDoc && (
                <span className="text-[8px] text-slate-400 flex items-center gap-0.5 px-1 font-bold">
                    <Link2 className="w-2 h-2" />
                    納品書 {sourceDoc.docNumber} より
                </span>
            )}
        </div>
    );
    if (type === "receipt") return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-600 border border-cyan-100">
            <Receipt className="w-2.5 h-2.5" />領収書
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
            <FileText className="w-2.5 h-2.5" />支払明細
        </span>
    );
}

function FulfillmentBadge({ doc, onUpdate }: { doc: IssuedDocument, onUpdate: (status: IssuedDocument['fulfillmentStatus']) => void }) {
    if (doc.type !== 'invoice') return null;
    const status = doc.fulfillmentStatus || 'pending';

    const cycle: Record<string, IssuedDocument['fulfillmentStatus']> = {
        'pending': 'sent',
        'sent': 'paid',
        'paid': 'pending'
    };

    const config = {
        'pending': { label: '未', icon: Clock, color: 'text-slate-400 bg-slate-50 border-slate-200' },
        'sent': { label: '渡し済み', icon: Package, color: 'text-blue-600 bg-blue-50 border-blue-200' },
        'paid': { label: '入金済み', icon: CreditCard, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
    };

    const c = config[status];

    return (
        <button
            onClick={() => onUpdate(cycle[status])}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.color} transition-all active:scale-95`}
            title="クリックで状態を切り替え"
        >
            <c.icon className="w-2.5 h-2.5" />{c.label}
        </button>
    );
}

// ─── Documents Page ───────────────────────────────────────────────────────────

// ─── Documents Page ───────────────────────────────────────────────────────────
function DocumentsPageContent() {
    const { isLoaded, issuedDocuments, invoicePayments, duplicateDocument, convertToInvoice, convertMultipleToInvoice, deleteIssuedDocument, restoreIssuedDocument, permanentlyDeleteIssuedDocument, updateIssuedDocument } = useStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<DocStatus>("all");
    const [filterType, setFilterType] = useState<DocType>("all");
    const [sortDesc, setSortDesc] = useState(true);
    const [showNewModal, setShowNewModal] = useState(false);
    const [editingDoc, setEditingDoc] = useState<IssuedDocument | null>(null);
    const [previewDoc, setPreviewDoc] = useState<IssuedDocument | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
    const [convertingId, setConvertingId] = useState<string | null>(null);
    const [downloadingDoc, setDownloadingDoc] = useState<IssuedDocument | null>(null);
    const [showTrash, setShowTrash] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isConvertingMultiple, setIsConvertingMultiple] = useState(false);
    const searchParams = useSearchParams();
    const highlightId = searchParams.get("id");

    // ── Filter + sort ─────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        if (!isLoaded) return [];
        const filtered = issuedDocuments
            .filter(d => showTrash ? d.isTrashed : !d.isTrashed)
            .filter(d => filterType === "all" || d.type === filterType)
            .filter(d => {
                if (filterStatus === "all") return true;
                if (filterStatus === "paid") return d.fulfillmentStatus === "paid";
                return d.status === filterStatus;
            })
            .filter(d => {
                const q = searchQuery.toLowerCase();
                const matchSearch = !searchQuery ||
                    d.recipientName.toLowerCase().includes(q) ||
                    d.docNumber.toLowerCase().includes(q) ||
                    d.period.includes(q);
                return matchSearch;
            })
            .sort((a, b) => {
                const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt || 0);
                return sortDesc
                    ? dateB.getTime() - dateA.getTime()
                    : dateA.getTime() - dateB.getTime();
            });
        return filtered;
    }, [issuedDocuments, filterStatus, filterType, searchQuery, sortDesc, isLoaded, showTrash]);

    useEffect(() => {
        if (highlightId && filtered.length > 0) {
            setTimeout(() => {
                const el = document.getElementById(`doc-${highlightId}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [highlightId, filtered.length]);

    const stats = useMemo(() => {
        if (!isLoaded) return { total: 0, issued: 0, draft: 0, delivery: 0, invoice: 0, payment: 0, trashed: 0 };
        const activeDocs = issuedDocuments.filter(d => !d.isTrashed);
        return {
            total: activeDocs.length,
            issued: activeDocs.filter(d => d.status === "issued").length,
            draft: activeDocs.filter(d => d.status === "draft").length,
            delivery: activeDocs.filter(d => d.type === "delivery_note").length,
            invoice: activeDocs.filter(d => d.type === "invoice").length,
            receipt: activeDocs.filter(d => d.type === "receipt").length,
            payment: activeDocs.filter(d => d.type === "payment_summary").length,
            trashed: issuedDocuments.filter(d => d.isTrashed).length,
        };
    }, [issuedDocuments, isLoaded]);

    const financeStats = useMemo(() => {
        if (!isLoaded) return { unpaidCount: 0, arBalance: 0, thisMonthPayments: 0 };
        
        const activeInvoices = issuedDocuments.filter(d => !d.isTrashed && d.type === 'invoice' && d.status === 'issued');
        
        let unpaidCount = 0;
        let arBalance = 0;
        
        activeInvoices.forEach(inv => {
            const balance = calculateInvoiceBalance(inv, invoicePayments);
            if (balance > 0) {
                unpaidCount++;
                arBalance += balance;
            }
        });
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        const thisMonthPayments = invoicePayments
            .filter(p => !p.isTrashed && p.date.startsWith(currentMonth))
            .reduce((sum, p) => sum + p.amount, 0);
            
        return { unpaidCount, arBalance, thisMonthPayments };
    }, [issuedDocuments, invoicePayments, isLoaded]);

    const handleDuplicate = async (id: string) => {
        setDuplicatingId(id);
        try { await duplicateDocument(id); }
        finally { setDuplicatingId(null); }
    };

    const handleDelete = async (id: string) => {
        await deleteIssuedDocument(id);
        setDeletingId(null);
    };

    const handleConvertToInvoice = async (id: string) => {
        setConvertingId(id);
        try {
            await convertToInvoice(id);
        } finally {
            setConvertingId(null);
        }
    };

    const handleConvertMultipleToInvoice = async () => {
        if (selectedIds.length === 0) return;
        setIsConvertingMultiple(true);
        try {
            const result = await convertMultipleToInvoice(selectedIds);
            if (result) {
                alert("合算請求書を作成しました。");
                setSelectedIds([]);
            }
        } finally {
            setIsConvertingMultiple(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filtered.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filtered.map(d => d.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
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
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowTrash(!showTrash)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl shadow-sm transition-all border ${showTrash ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    >
                        <Trash2 className="w-4 h-4" />
                        {showTrash ? "戻る" : "ゴミ箱"}
                    </button>
                    <button onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition-all hover:opacity-90"
                        style={{ backgroundColor: BRAND }}>
                        <Plus className="w-4 h-4" />新規帳票を作成
                    </button>
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-xs font-black">
                            {selectedIds.length} 件選択中
                        </div>
                        <p className="text-sm font-medium text-rose-700">
                            同じ宛先の納品書を選択して合算請求書を作成できます
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleConvertMultipleToInvoice}
                            disabled={isConvertingMultiple}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-rose-700 transition-all disabled:opacity-50"
                        >
                            {isConvertingMultiple ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileStack className="w-4 h-4" />}
                            選択した納品書を合算して請求書を作成
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-4 py-2 text-rose-600 text-sm font-bold hover:bg-rose-100/50 rounded-xl transition-all"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            )}

            {/* Financial Overview (For Invoices) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -z-10" />
                    <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                        <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">未入金</div>
                        <div className="text-xl font-black text-slate-900 leading-none mt-1">{financeStats.unpaidCount}<span className="text-[10px] text-slate-400 ml-1">件</span></div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-10" />
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                        <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">売掛残高</div>
                        <div className="text-xl font-black text-slate-900 leading-none mt-1">{fmtMoney(financeStats.arBalance)}</div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10" />
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">今月入金</div>
                        <div className="text-xl font-black text-slate-900 leading-none mt-1">{fmtMoney(financeStats.thisMonthPayments)}</div>
                    </div>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                {[
                    { label: "総件数", value: stats.total, color: "#6366f1" },
                    { label: "発行済", value: stats.issued, color: "#10b981" },
                    { label: "下書き", value: stats.draft, color: "#f59e0b" },
                    { label: "納品書", value: stats.delivery, color: BRAND },
                    { label: "請求書", value: stats.invoice, color: "#f43f5e" },
                    { label: "領収書", value: stats.receipt, color: "#06b6d4" },
                    { label: "支払明細", value: stats.payment, color: "#6366f1" },
                ].map(item => (
                    <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-3 flex sm:flex-col sm:items-start items-center gap-2.5">
                        <div className="w-2 h-8 rounded-full" style={{ backgroundColor: item.color + "40", borderLeft: `3px solid ${item.color}` }} />
                        <div className="flex-1">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.label}</div>
                            <div className="text-lg font-black text-slate-900 leading-none mt-1">{item.value}<span className="text-[10px] text-slate-400 ml-0.5">件</span></div>
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
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as DocStatus)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none">
                        <option value="all">すべての状態</option>
                        <option value="draft">下書き</option>
                        <option value="issued">発行済み</option>
                        <option value="paid">入金済み</option>
                    </select>
                    <select value={filterType} onChange={e => setFilterType(e.target.value as DocType)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none">
                        <option value="all">すべての書類</option>
                        <option value="delivery_note">納品書</option>
                        <option value="invoice">請求書</option>
                        <option value="receipt">領収書</option>
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
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: showTrash ? '#fff7ed' : BRAND_LIGHT }}>
                        {showTrash ? <Trash2 className="w-8 h-8 text-amber-500" /> : <FileText className="w-8 h-8" style={{ color: BRAND }} />}
                    </div>
                    <h3 className="font-bold text-slate-700 mb-1">{showTrash ? "ゴミ箱は空です" : "帳票がありません"}</h3>
                    <p className="text-sm text-slate-400 mb-4">{showTrash ? "削除された帳票はありません" : "「新規帳票を作成」から最初の帳票を発行してください"}</p>
                    {!showTrash && (
                        <button onClick={() => setShowNewModal(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl"
                            style={{ backgroundColor: BRAND }}>
                            <Plus className="w-4 h-4" />新規作成
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="px-4 py-3 text-center w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filtered.length && filtered.length > 0}
                                            onChange={toggleSelectAll}
                                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left">書類番号</th>
                                    <th className="px-4 py-3 text-left">種別</th>
                                    <th className="px-4 py-3 text-left">宛先</th>
                                    <th className="px-4 py-3 text-left">対象期間</th>
                                    <th className="px-4 py-3 text-left">発行日</th>
                                    <th className="px-4 py-3 text-left">状態</th>
                                    <th className="px-4 py-3 text-right">ご請求/合計</th>
                                    <th className="px-4 py-3 text-right">入金日</th>
                                    <th className="px-4 py-3 text-right">残高</th>
                                    <th className="px-4 py-3 text-center">アクション</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((doc, idx) => (
                                    <tr 
                                        key={doc.id}
                                        id={`doc-${doc.id}`}
                                        className={`border-b transition-all duration-500 ${
                                            highlightId === doc.id 
                                                ? "bg-rose-100 border-rose-300 ring-4 ring-rose-500/10 scale-[1.01] shadow-md relative z-10" 
                                                : `border-slate-100 hover:bg-slate-50/60 ${idx % 2 === 0 ? "" : "bg-slate-50/20"} ${selectedIds.includes(doc.id) ? "bg-rose-50/50" : ""} ${doc.status === 'draft' ? 'bg-amber-50/30' : ''}`
                                        }`}
                                    >
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(doc.id)}
                                                onChange={() => toggleSelect(doc.id)}
                                                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono font-bold text-slate-800 text-xs tracking-wide">{doc.docNumber}</span>
                                        </td>
                                        <td className="px-4 py-3"><TypeBadge doc={doc} allDocs={issuedDocuments} /></td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-slate-800">{doc.recipientName}</div>
                                            {doc.recipientType === "spot" && (
                                                <div className="text-[10px] text-amber-500 font-bold">スポット</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs font-medium">{fmtDate(doc.period)}</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(doc.issuedDate)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <StatusBadge status={doc.status} />
                                                <FulfillmentBadge doc={doc} onUpdate={(s) => updateIssuedDocument(doc.id, { fulfillmentStatus: s })} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                                            {doc.totalAmount > 0 ? fmtMoney(doc.totalAmount) : <span className="text-slate-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs">
                                            {doc.type === 'invoice' ? (() => {
                                                const payments = invoicePayments.filter(p => p.invoiceId === doc.id && !p.isTrashed).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                                return payments.length > 0 ? <span className="text-slate-600 font-medium">{fmtDate(payments[0].date)}</span> : <span className="text-slate-400">未入金</span>;
                                            })() : doc.type === 'receipt' ? (
                                                <span className="text-slate-600 font-medium">{fmtDate(doc.issuedDate)}</span>
                                            ) : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {doc.type === 'invoice' ? (() => {
                                                const bal = calculateInvoiceBalance(doc, invoicePayments);
                                                if (bal === 0) return <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold whitespace-nowrap">完済</span>;
                                                return <span className="text-[11px] text-rose-500 font-bold whitespace-nowrap">{fmtMoney(bal)}</span>;
                                            })() : doc.type === 'receipt' ? (
                                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold whitespace-nowrap">受領済</span>
                                            ) : <span className="text-slate-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 justify-center">
                                                {doc.pdfUrl && (
                                                    <a
                                                        href={doc.pdfUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="PDFを表示"
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                )}
                                                {doc.isTrashed ? (
                                                    <>
                                                        <button
                                                            onClick={() => restoreIssuedDocument(doc.id)}
                                                            title="復元"
                                                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => { if (window.confirm("この帳票を完全に削除しますか？")) permanentlyDeleteIssuedDocument(doc.id); }}
                                                            title="完全削除"
                                                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => setPreviewDoc(doc)}
                                                            title="プレビュー / PDF"
                                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setDownloadingDoc(doc)}
                                                            title="PDFダウンロード"
                                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setEditingDoc(doc)}
                                                            title="編集"
                                                            className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors">
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDuplicate(doc.id)}
                                                            disabled={duplicatingId === doc.id}
                                                            title="複製（枝番付与）"
                                                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-40">
                                                            {duplicatingId === doc.id
                                                                ? <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                                                : <Copy className="w-4 h-4" />}
                                                        </button>
                                                        {doc.type === 'delivery_note' && (() => {
                                                            const isConverted = issuedDocuments.some(d => d.type === "invoice" && d.sourceDocId === doc.id && !d.isTrashed);
                                                            return (
                                                                <button onClick={() => handleConvertToInvoice(doc.id)}
                                                                    disabled={convertingId === doc.id}
                                                                    title={isConverted ? "請求書を再作成" : "請求書を作成"}
                                                                    className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${isConverted
                                                                        ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                                                        : 'bg-rose-50 text-rose-600 hover:bg-rose-100 animate-pulse-subtle'}`}>
                                                                    {convertingId === doc.id
                                                                        ? <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                                                                        : <FilePlus className="w-4 h-4" />}
                                                                </button>
                                                            );
                                                        })()}
                                                        <button onClick={() => { if (window.confirm("この帳票をごみ箱に移動しますか？")) handleDelete(doc.id); }}
                                                            title="削除"
                                                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
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
            {editingDoc && <NewDocumentModal editingDoc={editingDoc} onClose={() => setEditingDoc(null)} />}
            {previewDoc && (
                <DocumentPreviewModal
                    type={previewDoc.type}
                    storeId={previewDoc.storeId}
                    supplierId={previewDoc.supplierId}
                    period={previewDoc.period}
                    month={previewDoc.period}
                    docNumber={previewDoc.docNumber}
                    recipientName={previewDoc.recipientName}
                    spotRecipientId={previewDoc.spotRecipientId}
                    customDetails={previewDoc.details}
                    customAdjustments={previewDoc.adjustments}
                    customTaxRate={previewDoc.taxRate}
                    hidePrices={previewDoc.hidePrices}
                    onClose={() => setPreviewDoc(null)}
                />
            )}
            {downloadingDoc && (
                <DocumentPreviewModal
                    type={downloadingDoc.type}
                    storeId={downloadingDoc.storeId}
                    supplierId={downloadingDoc.supplierId}
                    period={downloadingDoc.type !== 'payment_summary' ? downloadingDoc.period : undefined}
                    month={downloadingDoc.type === 'payment_summary' ? downloadingDoc.period : undefined}
                    docNumber={downloadingDoc.docNumber}
                    recipientName={downloadingDoc.recipientName}
                    spotRecipientId={downloadingDoc.spotRecipientId}
                    customDetails={downloadingDoc.details}
                    customAdjustments={downloadingDoc.adjustments}
                    customTaxRate={downloadingDoc.taxRate}
                    hidePrices={downloadingDoc.hidePrices}
                    autoDownload={true}
                    onClose={() => setDownloadingDoc(null)}
                />
            )}
        </div>
    );
}

export default function DocumentsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-slate-500 animate-pulse">読み込み中...</div>}>
            <DocumentsPageContent />
        </Suspense>
    );
}
