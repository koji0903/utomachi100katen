// src/app/expenses/page.tsx
"use client";

import { useState, Suspense, useMemo } from "react";
import { 
    Plus, Search, Receipt, Printer, Eye, Trash2, 
    Calendar, Tag, CreditCard, ChevronRight, 
    Filter, Download, Mail, ArrowUpRight, Edit2
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Expense, ExpenseCategory, PaymentMethod } from "@/lib/types/expense";
import { showNotification } from "@/lib/notifications";
import { ExpenseUploadModal } from "@/components/Expenses/ExpenseUploadModal";
import { ExpenseReportModal } from "@/components/Expenses/ExpenseReportModal";
import { FilePreviewModal } from "@/components/Expenses/FilePreviewModal";
import { ExpenseEditModal } from "@/components/Expenses/ExpenseEditModal";

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
    '備品': 'text-blue-600 bg-blue-50 border-blue-100',
    '消耗品': 'text-emerald-600 bg-emerald-50 border-emerald-100',
    '飲食費': 'text-orange-600 bg-orange-50 border-orange-100',
    '交通費': 'text-purple-600 bg-purple-50 border-purple-100',
    '通信費': 'text-cyan-600 bg-cyan-50 border-cyan-100',
    '光熱費': 'text-yellow-600 bg-yellow-50 border-yellow-100',
    '広告宣伝費': 'text-rose-600 bg-rose-50 border-rose-100',
    '支払手数料': 'text-slate-600 bg-slate-50 border-slate-100',
    'その他': 'text-slate-500 bg-slate-50 border-slate-200',
};

function ExpensePageContent() {
    const { isLoaded, expenses, deleteExpense } = useStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'すべて'>('すべて');
    const [filterPaymentMethod, setFilterPaymentMethod] = useState<PaymentMethod | 'すべて'>('すべて');
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);

    if (!isLoaded) return <div className="p-8 text-slate-500 font-bold">読み込み中...</div>;

    const filteredExpenses = expenses
        .filter(e => !e.isTrashed)
        .filter(e => e.date.startsWith(period))
        .filter(e => filterCategory === 'すべて' || e.category === filterCategory)
        .filter(e => filterPaymentMethod === 'すべて' || (e.paymentMethod || '小口現金') === filterPaymentMethod)
        .filter(e => 
            e.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.vendor || "").toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => b.date.localeCompare(a.date));

    const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setIsEditModalOpen(true);
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div className="flex items-center gap-3 text-slate-900">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shadow-sm border border-rose-100">
                        <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">支出・経費管理</h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Expense & Receipt Tracking</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-3.5 rounded-2xl hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 font-black active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        記録を追加
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-slate-900">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <CreditCard className="w-16 h-16 text-slate-900" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Monthly Total ({period})</p>
                    <h3 className="text-4xl font-black tracking-tighter">¥{totalAmount.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Real-time update</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <Eye className="w-16 h-16 text-amber-500" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Needs Confirmation</p>
                    <h3 className="text-4xl font-black tracking-tighter text-amber-500">
                        {expenses.filter(e => !e.isConfirmed && !e.isTrashed).length} <span className="text-sm font-bold text-slate-400">items</span>
                    </h3>
                    <div className="mt-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Awaiting review</span>
                    </div>
                </div>
                <div className="bg-rose-600 p-6 rounded-[2rem] shadow-xl shadow-rose-100 group cursor-pointer hover:-translate-y-1 transition-all" onClick={() => setIsReportModalOpen(true)}>
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                        <Download className="w-16 h-16 text-white" />
                    </div>
                    <p className="text-[10px] font-black text-rose-100 uppercase tracking-widest mb-2">Export Data</p>
                    <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                        レポート出力 <ArrowUpRight className="w-5 h-5" />
                    </h3>
                    <p className="text-[10px] text-rose-100 font-bold opacity-80 leading-relaxed uppercase">Generate PDF report for accountants</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1 flex gap-4">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-rose-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="品目、購入先で検索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-black text-slate-700 placeholder:text-slate-300"
                            />
                        </div>
                        <input 
                            type="month"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-black text-slate-900"
                        />
                    </div>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                            <Tag className="w-4 h-4 text-slate-400 flex-shrink-0 mr-2" />
                            {(['すべて', '備品', '消耗品', '飲食費', '交通費', '通信費', '光熱費', '広告宣伝費', '支払手数料', 'その他'] as const).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilterCategory(cat)}
                                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all border whitespace-nowrap uppercase tracking-widest ${filterCategory === cat ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-100' : 'bg-white text-slate-400 border-slate-100 hover:border-rose-300 hover:bg-rose-50/10 hover:text-rose-500'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide">
                            <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0 mr-2" />
                            {(['すべて', 'クレジット', '小口現金'] as const).map(pm => (
                                <button
                                    key={pm}
                                    onClick={() => setFilterPaymentMethod(pm)}
                                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all border whitespace-nowrap uppercase tracking-widest ${filterPaymentMethod === pm ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:bg-slate-50/10 hover:text-slate-900'}`}
                                >
                                    {pm}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expense List */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mb-12">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <th className="px-8 py-6">Date</th>
                                <th className="px-8 py-6">Description / Vendor</th>
                                <th className="px-8 py-6">Category</th>
                                <th className="px-8 py-6">Payment</th>
                                <th className="px-8 py-6 text-right">Amount</th>
                                <th className="px-8 py-6 text-center">Status</th>
                                <th className="px-8 py-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredExpenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-slate-50/30 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="text-sm font-black text-slate-900">{expense.date}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div>
                                            <div className="text-sm font-black text-slate-900 leading-tight group-hover:text-rose-600 transition-colors">{expense.item}</div>
                                            <div className="text-[10px] text-slate-400 font-bold italic mt-1 uppercase tracking-wider">{expense.vendor || '-'}</div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black border uppercase tracking-widest ${CATEGORY_COLORS[expense.category]}`}>
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            {(expense.paymentMethod === 'クレジット') ? (
                                                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                            ) : (
                                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-600">¥</div>
                                            )}
                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                                                {expense.paymentMethod || '小口現金'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="text-sm font-black text-slate-900 bg-slate-900 text-white px-3 py-1 w-fit ml-auto rounded-lg shadow-sm">¥{expense.amount.toLocaleString()}</div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        {expense.isConfirmed ? (
                                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100 uppercase tracking-widest">Confirmed</span>
                                        ) : (
                                            <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-100 flex items-center justify-center gap-2 w-fit mx-auto uppercase tracking-widest">
                                                <Eye className="w-3.5 h-3.5" /> Review
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end gap-3 translate-x-2 group-hover:translate-x-0 transition-transform">
                                            {expense.fileUrl && (
                                                <button 
                                                    onClick={() => setPreviewFile({ url: expense.fileUrl!, name: expense.item })}
                                                    className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100 hover:scale-110 active:scale-95"
                                                    title="領収書を表示"
                                                >
                                                    <Receipt className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleEdit(expense)}
                                                className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all shadow-sm bg-white border border-slate-100 hover:scale-110 active:scale-95"
                                                title="内容を編集"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if (window.confirm("この支出記録を削除しますか？")) {
                                                        deleteExpense(expense.id);
                                                    }
                                                }}
                                                className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100 hover:scale-110 active:scale-95"
                                                title="削除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredExpenses.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="p-8 bg-slate-50 text-slate-200 rounded-[2.5rem] border border-slate-100 shadow-inner">
                                                <Receipt className="w-20 h-20" />
                                            </div>
                                            <div>
                                                <p className="text-slate-400 font-black tracking-[0.3em] text-xs uppercase mb-2">No Records Found</p>
                                                <p className="text-slate-300 text-[10px] font-bold">この期間の支出データはまだありません</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ExpenseUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
            />

            <ExpenseReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
            />

            <ExpenseEditModal 
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingExpense(null);
                }}
                expense={editingExpense}
            />

            <FilePreviewModal 
                isOpen={!!previewFile}
                onClose={() => setPreviewFile(null)}
                fileUrl={previewFile?.url || ""}
                fileName={previewFile?.name}
            />
        </div>
    );
}

export default function ExpensesPage() {
    return (
        <Suspense fallback={<div className="p-8">読み込み中...</div>}>
            <ExpensePageContent />
        </Suspense>
    );
}
