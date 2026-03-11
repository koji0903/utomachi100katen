"use client";

import { useState, useMemo } from "react";
import { 
    Search, Filter, Eye, Plus, ChevronDown, ChevronUp, 
    Calendar, User, Tag, CreditCard, ArrowRight,
    TrendingUp, AlertCircle, CheckCircle2, Clock, Check
} from "lucide-react";
import { useStore, Transaction } from "@/lib/store";
import { TransactionModal } from "@/components/TransactionModal";
import Link from "next/link";

const BRAND = "#1e3a8a"; // Use the blue brand color for Transactions
const BRAND_LIGHT = "#eff6ff";

const fmtMoney = (n: number) => `¥${n.toLocaleString()}`;
const fmtDate = (d: string) => d.replace(/-/g, "/");

function StatusBadge({ status }: { status: Transaction['transactionStatus'] }) {
    const config = {
        '受注': { label: '受注', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Clock },
        '納品済': { label: '納品済', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: Calendar },
        '請求済': { label: '請求済', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: Tag },
        '一部入金': { label: '一部入金', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: CreditCard },
        '入金済': { label: '入金済', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 },
        '完了': { label: '完了', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: TrendingUp },
    };
    const c = config[status] || { label: status, color: 'bg-slate-50 text-slate-500 border-slate-100', icon: AlertCircle };
    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${c.color} shadow-sm`}>
            <Icon className="w-3 h-3" />{c.label}
        </span>
    );
}

export default function TransactionsPage() {
    const { isLoaded, transactions, invoicePayments } = useStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [sortDesc, setSortDesc] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filtered = useMemo(() => {
        if (!isLoaded) return [];
        return transactions
            .filter(t => !t.isTrashed)
            .filter(t => {
                const q = searchQuery.toLowerCase();
                return !searchQuery || 
                    t.customerName.toLowerCase().includes(q) ||
                    t.transactionType.toLowerCase().includes(q) ||
                    t.orderDate.includes(q);
            })
            .sort((a, b) => {
                const dateA = new Date(a.orderDate);
                const dateB = new Date(b.orderDate);
                return sortDesc 
                    ? dateB.getTime() - dateA.getTime() 
                    : dateA.getTime() - dateB.getTime();
            });
    }, [transactions, searchQuery, sortDesc, isLoaded]);

    const dashboardMetrics = useMemo(() => {
        if (!isLoaded) return { ongoing: 0, unpaid: 0, totalBalance: 0, monthSales: 0, monthPaid: 0 };
        
        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // e.g., "2026-03"

        let ongoing = 0;
        let unpaid = 0;
        let totalBalance = 0;
        let monthSales = 0;
        let monthPaid = 0;

        transactions.forEach(t => {
            if (t.isTrashed) return;
            
            // 進行中取引数 (Ongoing): status !== '完了'
            if (t.transactionStatus !== '完了') {
                ongoing++;
            }
            
            // 未入金取引数 (Unpaid): has some balance
            if (t.balanceAmount > 0) {
                unpaid++;
            }
            
            // 売掛残高 (Total Balance): sum of balances
            totalBalance += t.balanceAmount;
            
            // 今月売上 (Sales this month): orderDate starts with currentMonthPrefix
            if (t.orderDate.startsWith(currentMonthPrefix)) {
                monthSales += t.totalAmount;
            }
            
            // 今月入金額 (Amount paid this month): we approximate this by checking if the _transaction_ was this month, 
            // OR ideally we'd look at invoicePayments. For simplicity, if we only have transaction list here, 
            // maybe we shouldn't rely on orderDate for payments. Wait, we don't have invoicePayments imported here.
            // Let's import invoicePayments to get accurate monthPaid.
        });

        return { ongoing, unpaid, totalBalance, monthSales, monthPaid };
    }, [transactions, isLoaded]); // We'll add invoicePayments in a moment.

    if (!isLoaded) return <div className="p-8 text-slate-500 animate-pulse">読み込み中...</div>;

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">取引管理</h1>
                    <p className="text-slate-500 mt-1 text-sm">受注から入金完了までの全取引を一元管理</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all hover:translate-y-[-1px] active:translate-y-[1px]" 
                    style={{ backgroundColor: BRAND }}
                >
                    <Plus className="w-4 h-4" />新規取引を追加
                </button>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-50/50 rounded-full blur-xl" />
                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        <Clock className="w-4 h-4 text-blue-500" />進行中取引数
                    </div>
                    <div className="text-3xl font-black text-slate-900">{dashboardMetrics.ongoing}<span className="text-sm font-bold text-slate-400 ml-1">件</span></div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-50/50 rounded-full blur-xl" />
                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        <AlertCircle className="w-4 h-4 text-rose-500" />未入金取引数
                    </div>
                    <div className="text-3xl font-black text-rose-600">{dashboardMetrics.unpaid}<span className="text-sm font-bold text-rose-400 ml-1">件</span></div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 border-l-4 border-l-amber-500 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-50/50 rounded-full blur-xl" />
                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        <CreditCard className="w-4 h-4 text-amber-500" />売掛残高
                    </div>
                    <div className="text-2xl font-black text-slate-900">{fmtMoney(dashboardMetrics.totalBalance)}</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50/50 rounded-full blur-xl" />
                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        <TrendingUp className="w-4 h-4 text-indigo-500" />今月売上
                    </div>
                    <div className="text-2xl font-black text-slate-900">{fmtMoney(dashboardMetrics.monthSales)}</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 border-l-4 border-l-emerald-500 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50/50 rounded-full blur-xl" />
                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        <Check className="w-4 h-4 text-emerald-500" />今月入金額
                    </div>
                    <div className="text-2xl font-black text-slate-900">{fmtMoney(dashboardMetrics.monthPaid)}</div>
                </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-4 items-center shadow-sm">
                <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="取引先名・管理番号などで検索…"
                        className="flex-1 text-sm bg-transparent focus:outline-none text-slate-800 placeholder:text-slate-400" />
                </div>
                <button onClick={() => setSortDesc(v => !v)}
                    className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                    取引日 {sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                <div className="text-xs text-slate-400 font-bold px-2">{filtered.length}件の取引</div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {filtered.map((t) => (
                    <Link key={t.id} href={`/transactions/${t.id}`}
                        className="group bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center gap-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                        <div className="flex-1 min-w-[200px] space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-blue-600 tracking-widest uppercase py-0.5 px-2 bg-blue-50 rounded">Transaction</span>
                                <span className="text-xs font-mono text-slate-400">ID: {t.id.slice(-6)}</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-700 transition-colors">{t.customerName}</h3>
                            <div className="flex items-center gap-3 text-sm text-slate-500 font-bold">
                                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{fmtDate(t.orderDate)}</span>
                                <span className="flex items-center gap-1"><Tag className="w-4 h-4" />{t.transactionType}</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 px-6 border-x border-slate-100 shrink-0">
                            <StatusBadge status={t.transactionStatus} />
                            <div className="text-xs text-slate-400 font-bold">ステータス</div>
                        </div>

                        <div className="text-right min-w-[140px] shrink-0">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">取引合計金額</div>
                            <div className="text-xl font-black text-slate-900">{fmtMoney(t.totalAmount)}</div>
                            <div className="text-[10px] text-rose-500 font-black mt-1">
                                {t.balanceAmount > 0 ? `残り残高: ${fmtMoney(t.balanceAmount)}` : '完済'}
                            </div>
                        </div>

                        <div className="flex items-center justify-center p-3 rounded-xl bg-slate-50 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:translate-x-1">
                            <ArrowRight className="w-5 h-5" />
                        </div>
                    </Link>
                ))}

                {filtered.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 py-20 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                            <AlertCircle className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="font-bold text-slate-700">取引が見つかりません</h3>
                        <p className="text-sm text-slate-400">検索条件を変えてお試しください</p>
                    </div>
                )}
            </div>

            <TransactionModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
}
