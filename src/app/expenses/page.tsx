// src/app/expenses/page.tsx
"use client";

import { useState, Suspense, useMemo } from "react";
import { 
    Plus, Search, Receipt, Printer, Eye, Trash2, 
    Calendar, Tag, CreditCard, ChevronRight, 
    Filter, Download, Mail, ArrowUpRight
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Expense, ExpenseCategory } from "@/lib/types/expense";
import { showNotification } from "@/lib/notifications";
import { ExpenseUploadModal } from "@/components/Expenses/ExpenseUploadModal";
import { ExpenseReportModal } from "@/components/Expenses/ExpenseReportModal";
import { FilePreviewModal } from "@/components/Expenses/FilePreviewModal";

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
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'すべて'>('すべて');
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);

    if (!isLoaded) return <div className="p-8 text-slate-500">読み込み中...</div>;

    const filteredExpenses = expenses
        .filter(e => !e.isTrashed)
        .filter(e => e.date.startsWith(period))
        .filter(e => filterCategory === 'すべて' || e.category === filterCategory)
        .filter(e => 
            e.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.vendor || "").toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => b.date.localeCompare(a.date));

    const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div className="flex items-center gap-3 text-slate-900">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                        <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">支出・経費管理</h1>
                        <p className="text-slate-500 text-sm font-medium">レシートや請求書のAI解析・管理ができます。</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-600 text-white px-5 py-3 rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 font-bold active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        レシート・領収書を追加
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-slate-900">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <CreditCard className="w-12 h-12 text-slate-900" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 mb-1">今月の支出合計 ({period})</p>
                    <h3 className="text-3xl font-black">¥{totalAmount.toLocaleString()}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-bold text-slate-500 mb-1">未確認のレシート</p>
                    <h3 className="text-3xl font-black text-amber-500">
                        {expenses.filter(e => !e.isConfirmed && !e.isTrashed).length} <span className="text-sm font-bold text-slate-400">件</span>
                    </h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm bg-gradient-to-br from-white to-rose-50/30">
                    <p className="text-sm font-bold text-rose-500 mb-1">レポート出力</p>
                    <button 
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-2 text-rose-600 font-bold text-sm hover:underline"
                    >
                        <Download className="w-4 h-4" /> PDFレポートを作成
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="品目、購入先で検索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm font-bold text-slate-700"
                            />
                        </div>
                        <input 
                            type="month"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm font-bold text-slate-700"
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0 mr-1" />
                        {(['すべて', '備品', '消耗品', '飲食費', '交通費', '通信費', '光熱費', '広告宣伝費', '支払手数料', 'その他'] as const).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat)}
                                className={`px-4 py-2 rounded-full text-xs font-black transition-all border whitespace-nowrap ${filterCategory === cat ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-100' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-300'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Expense List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                                <th className="px-6 py-5">日付</th>
                                <th className="px-6 py-5">内容 / 購入先</th>
                                <th className="px-6 py-5">カテゴリー</th>
                                <th className="px-6 py-5 text-right">金額</th>
                                <th className="px-6 py-5 text-center">ステータス</th>
                                <th className="px-6 py-5 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredExpenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="text-sm font-bold text-slate-900">{expense.date}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div>
                                            <div className="text-sm font-bold text-slate-900 leading-tight">{expense.item}</div>
                                            <div className="text-[10px] text-slate-400 font-bold italic mt-0.5">{expense.vendor || '-'}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${CATEGORY_COLORS[expense.category]}`}>
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="text-sm font-black text-slate-900">¥{expense.amount.toLocaleString()}</div>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        {expense.isConfirmed ? (
                                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">確認済</span>
                                        ) : (
                                            <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 flex items-center justify-center gap-1.5 w-fit mx-auto">
                                                <Eye className="w-3 h-3" /> 要確認
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {expense.fileUrl && (
                                                <button 
                                                    onClick={() => setPreviewFile({ url: expense.fileUrl!, name: expense.item })}
                                                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                    title="領収書を表示"
                                                >
                                                    <Receipt className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => {
                                                    if (window.confirm("この支出記録を削除しますか？")) {
                                                        deleteExpense(expense.id);
                                                    }
                                                }}
                                                className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
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
                                    <td colSpan={6} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="p-6 bg-slate-50 text-slate-200 rounded-3xl">
                                                <Receipt className="w-16 h-16" />
                                            </div>
                                            <p className="text-slate-400 font-black tracking-widest text-sm uppercase">No Records Found</p>
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
