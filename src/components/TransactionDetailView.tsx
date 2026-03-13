"use client";

import { useMemo } from "react";
import { 
    Calendar, User, Tag, CreditCard, ChevronLeft, 
    FileText, Receipt, Package, ArrowRight,
    TrendingUp, CheckCircle2, AlertCircle, Clock,
    Download, Eye, ExternalLink, Plus
} from "lucide-react";
import { useStore, Transaction, IssuedDocument, InvoicePayment, TransactionItem } from "@/lib/store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TransactionModal } from "@/components/TransactionModal";
import { NewDocumentModal } from "@/components/NewDocumentModal";

const BRAND = "#1e3a8a";
const BRAND_LIGHT = "#eff6ff";

const fmtMoney = (n: number) => `¥${n.toLocaleString()}`;
const fmtDate = (d: string) => d.replace(/-/g, "/");

interface TransactionDetailViewProps {
    id: string;
}

export function TransactionDetailView({ id }: TransactionDetailViewProps) {
    const { isLoaded, transactions, issuedDocuments, invoicePayments, transactionItems } = useStore();
    const router = useRouter();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);

    const transaction = useMemo(() => transactions.find(t => t.id === id), [transactions, id]);
    
    // Related data linked via transactionId
    const linkedDocs = useMemo(() => 
        issuedDocuments.filter(d => d.transactionId === id && !d.isTrashed), 
    [issuedDocuments, id]);
    
    const linkedPayments = useMemo(() => 
        invoicePayments.filter(p => p.transactionId === id && !p.isTrashed), 
    [invoicePayments, id]);

    // Transaction Items linked to this transaction
    const linkedItems = useMemo(() => 
        transactionItems.filter(item => item.transactionId === id && !item.isTrashed),
    [transactionItems, id]);

    if (!isLoaded) return <div className="p-8 text-slate-500 animate-pulse">読み込み中...</div>;
    if (!transaction) return (
        <div className="p-20 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900">取引が見つかりません</h2>
            <button onClick={() => router.push('/transactions')} className="mt-4 text-blue-600 font-bold hover:underline">取引一覧に戻る</button>
        </div>
    );

    const statusConfig = {
        '受注': { label: '受注', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Clock },
        '納品済': { label: '納品済', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: Calendar },
        '請求済': { label: '請求済', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: Tag },
        '一部入金': { label: '一部入金', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: CreditCard },
        '入金済': { label: '入金済', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 },
        '完了': { label: '完了', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: TrendingUp },
    };
    const sc = statusConfig[transaction.transactionStatus as keyof typeof statusConfig] || { label: transaction.transactionStatus, color: 'bg-slate-50 text-slate-500 border-slate-100', icon: AlertCircle };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header & Back Link */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                    <button onClick={() => router.push('/transactions')}
                        className="flex items-center gap-1 text-xs font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest mb-2 group">
                        <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />取引一覧へ戻る
                    </button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{transaction.customerName}</h1>
                        <span className={`px-3 py-1 rounded-full text-xs font-black border ${sc.color} shadow-sm flex items-center gap-1.5`}>
                            <sc.icon className="w-3.5 h-3.5" />{sc.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 font-bold mt-2">
                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-300" />受注日: {fmtDate(transaction.orderDate)}</span>
                        <span className="flex items-center gap-1.5"><Tag className="w-4 h-4 text-slate-300" />{transaction.transactionType}</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-xs font-mono text-slate-400">ID: {transaction.id}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsEditModalOpen(true)}
                        className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                    >
                        取引を編集
                    </button>
                    <button 
                        onClick={() => setIsNewDocModalOpen(true)}
                        className="px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition-all active:scale-95" 
                        style={{ backgroundColor: BRAND }}
                    >
                        新規帳票を作成
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Summary & Main Info */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Financial Overview Card */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-blue-500" />取引サマリー
                            </h2>
                        </div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-1">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">取引総額（税込）</div>
                                <div className="text-3xl font-black text-slate-900 leading-none">{fmtMoney(transaction.totalAmount)}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">入金済額</div>
                                <div className="text-3xl font-black text-emerald-600 leading-none">{fmtMoney(transaction.paidAmount)}</div>
                            </div>
                            <div className={`space-y-1 p-4 rounded-2xl border ${transaction.balanceAmount > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                <div className={`text-[10px] font-black uppercase tracking-wider ${transaction.balanceAmount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {transaction.balanceAmount > 0 ? '現在の残高' : 'ステータス'}
                                </div>
                                <div className={`text-2xl font-black leading-none ${transaction.balanceAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {transaction.balanceAmount > 0 ? fmtMoney(transaction.balanceAmount) : '完済済'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Product Breakdown Table */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Package className="w-4 h-4 text-indigo-500" />商品明細一覧
                            </h2>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{linkedItems.length}件のアイテム</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-8 py-4 text-left">商品名</th>
                                        <th className="px-8 py-4 text-right">数量</th>
                                        <th className="px-8 py-4 text-right">単価</th>
                                        <th className="px-8 py-4 text-right">小計</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {linkedItems.map((item: TransactionItem) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-4 font-bold text-slate-800">{item.productName}</td>
                                            <td className="px-8 py-4 text-right font-mono font-bold text-slate-600">{item.quantity}</td>
                                            <td className="px-8 py-4 text-right text-slate-500">{fmtMoney(item.unitPrice)}</td>
                                            <td className="px-8 py-4 text-right font-black text-slate-800">{fmtMoney(item.amount)}</td>
                                        </tr>
                                    ))}
                                    {linkedItems.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-bold italic">
                                                明細が登録されていません
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {linkedItems.length > 0 && (
                                    <tfoot className="bg-slate-50/50">
                                        <tr>
                                            <td colSpan={3} className="px-8 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-wider font-mono">小計</td>
                                            <td className="px-8 py-4 text-right font-black text-slate-900 border-t border-slate-200">{fmtMoney(linkedItems.reduce((s: number, i: TransactionItem) => s + i.amount, 0))}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Timeline / Sidebar Content */}
                <div className="space-y-8">
                    {/* Related Documents */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="w-4 h-4 text-rose-500" />関連帳票一覧
                            </h2>
                            <span className="bg-white text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full border border-slate-100 shadow-sm">
                                {linkedDocs.length}
                            </span>
                        </div>
                        <div className="p-4 space-y-3">
                            {linkedDocs.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <p className="text-xs font-bold text-slate-400">リンクされた帳票なし</p>
                                </div>
                            ) : (
                                linkedDocs.map((doc: IssuedDocument) => (
                                    <div key={doc.id} className="group p-4 bg-white rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {doc.type === 'delivery_note' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />}
                                                {doc.type === 'invoice' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />}
                                                {doc.type === 'receipt' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />}
                                                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">
                                                    {doc.type === 'delivery_note' ? '納品書' : doc.type === 'invoice' ? '請求書' : doc.type === 'receipt' ? '領収書' : '帳票'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-mono text-slate-300 font-bold">{doc.docNumber}</span>
                                        </div>
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <div className="text-sm font-black text-slate-800">{fmtDate(doc.issuedDate)}</div>
                                                <div className="text-[10px] text-slate-400 font-bold">発行日</div>
                                            </div>
                                            <div className="flex gap-1.5 animate-in slide-in-from-right-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                <button className="p-2 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors shadow-sm"><Eye className="w-3.5 h-3.5" /></button>
                                                <button className="p-2 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors shadow-sm"><Download className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <button 
                                onClick={() => setIsNewDocModalOpen(true)}
                                className="w-full py-4 text-xs font-black text-slate-400 hover:text-blue-600 border border-dashed border-slate-200 rounded-2xl hover:bg-blue-50/50 hover:border-blue-200 transition-all flex items-center justify-center gap-2 group"
                            >
                                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                                新しい帳票を紐付ける
                            </button>
                        </div>
                    </div>

                    {/* Payment History */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-emerald-500" />入金履歴一覧
                            </h2>
                            <span className="bg-white text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full border border-slate-100 shadow-sm">
                                {linkedPayments.length}
                            </span>
                        </div>
                        <div className="p-4 relative">
                            {linkedPayments.length > 0 && <div className="absolute left-6 top-8 bottom-8 w-px bg-slate-100" />}
                            <div className="space-y-6">
                                {linkedPayments.length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-xs font-bold text-slate-400">入金記録なし</p>
                                    </div>
                                ) : (
                                    linkedPayments.map((payment: InvoicePayment) => (
                                        <div key={payment.id} className="relative pl-8">
                                            <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-emerald-50 border-2 border-emerald-500 z-10 box-content -ml-2.5 shadow-[0_0_0_4px_rgba(255,255,255,1)]" />
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs font-black text-slate-400 uppercase tracking-wider">{fmtDate(payment.date)}</div>
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full">{payment.method}</span>
                                            </div>
                                            <div className="text-lg font-black text-slate-900 mt-0.5">{fmtMoney(payment.amount)}</div>
                                            {payment.notes && <div className="text-[10px] text-slate-400 italic mt-1 font-bold">"{payment.notes}"</div>}
                                        </div>
                                    ))
                                )}
                            </div>
                            <button className="w-full mt-6 py-4 text-xs font-black text-slate-400 hover:text-emerald-600 border border-dashed border-slate-200 rounded-2xl hover:bg-emerald-50/50 hover:border-emerald-200 transition-all flex items-center justify-center gap-2 group">
                                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                                入金記録を追加
                            </button>
                        </div>
                    </div>

                    {/* Additional Metadata */}
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                        <div className="space-y-1">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">チャネル</div>
                            <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <ArrowRight className="w-3.5 h-3.5 text-blue-500" />{transaction.channel || '指定なし'}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">備考・社内メモ</div>
                            <div className="text-sm text-slate-600 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-200 shadow-inner italic">
                                {transaction.remarks || '備考はありません。'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isEditModalOpen && (
                <TransactionModal 
                    isOpen={isEditModalOpen} 
                    onClose={() => setIsEditModalOpen(false)} 
                    initialData={transaction}
                />
            )}

            {isNewDocModalOpen && (
                <NewDocumentModal 
                    onClose={() => setIsNewDocModalOpen(false)} 
                    initialTransactionId={id}
                />
            )}
        </div>
    );
}
