"use client";

import Link from "next/link";
import {
    LayoutDashboard,
    BarChart3,
    FileText,
    Archive,
    Store,
    Package,
    Tag,
    Users,
    AlertTriangle,
    ArrowRight,
    Plus,
    Sparkles,
    Search,
    BookOpen,
    ShoppingCart,
    ShoppingBag
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { CalendarView } from "@/components/CalendarView";

export default function DashboardPage() {
    const { isLoaded, products, brands, retailStores, sales, dailyReports, purchases } = useStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const currentMonthStats = useMemo(() => {
        const now = new Date();
        const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        return {
            sales: sales.filter(s => s.period.startsWith(monthPrefix)).reduce((sum, s) => sum + s.totalAmount, 0),
            reports: dailyReports.filter(r => r.date.startsWith(monthPrefix)).length,
            purchases: purchases.filter(p => p.orderDate?.startsWith(monthPrefix) || p.arrivalDate?.startsWith(monthPrefix)).length,
            label: `${now.getMonth() + 1}月の実績`
        };
    }, [sales, dailyReports, purchases]);

    if (!isLoaded) return <div className="p-8">読み込み中...</div>;

    // Stats
    const totalProducts = products.length;
    const totalBrands = brands.length;
    const totalStores = retailStores.length;

    // Low Stock Items (threshold: per-product or 20)
    const lowStockItems = products
        .filter(p => p.stock <= (p.alertThreshold ?? 20))
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5);

    const quickActions = [
        {
            name: "売上入力",
            desc: "本日の売上実績を登録",
            href: "/sales",
            icon: BarChart3,
            color: "bg-blue-600",
            accent: "text-blue-600",
            bg: "bg-blue-50"
        },
        {
            name: "業務日報",
            desc: "店舗巡回・作業の記録",
            href: "/reports",
            icon: FileText,
            color: "bg-emerald-600",
            accent: "text-emerald-600",
            bg: "bg-emerald-50"
        },
        {
            name: "帳票作成",
            desc: "納品書・請求書の発行",
            href: "/documents",
            icon: Archive,
            color: "bg-indigo-600",
            accent: "text-indigo-600",
            bg: "bg-indigo-50"
        },
        {
            name: "店舗管理",
            desc: "店舗情報・陳列状況の管理",
            href: "/retail-stores",
            icon: Store,
            color: "bg-pink-600",
            accent: "text-pink-600",
            bg: "bg-pink-50"
        },
    ];

    return (
        <div className="p-5 sm:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#1e3a8a]">
                            <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/60">Overview</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        ダッシュボード
                    </h1>
                    <p className="text-slate-500 mt-1.5 text-sm font-medium">ウトマチ百貨店の業務状況をリアルタイムで把握します。</p>
                </div>
                {mounted && (
                    <div className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm self-start">
                        最終更新: {new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
            </div>

            {/* Quick Actions Section */}
            <section>
                <div className="flex items-center gap-2 mb-6 text-slate-400">
                    <Plus className="w-3.5 h-3.5" />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Quick Actions</h2>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {quickActions.map((action, idx) => (
                        <Link
                            key={action.name}
                            href={action.href}
                            style={{ animationDelay: `${idx * 50}ms` }}
                            className="group bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1 transition-all duration-300 flex flex-col items-start gap-4 animate-in fade-in slide-in-from-bottom-4"
                        >
                            <div className={`p-4 rounded-2xl ${action.bg} ${action.accent} group-hover:scale-110 transition-transform duration-300`}>
                                <action.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 text-base sm:text-lg">{action.name}</h3>
                                <p className="text-slate-400 text-[11px] leading-relaxed mt-1 font-medium">{action.desc}</p>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300 group-hover:text-[#1e3a8a] transition-colors">
                                START <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Monthly Summary Section */}
            <section className="bg-[#1e3a8a] rounded-[2.5rem] p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden group">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/10 transition-colors duration-700" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full -ml-32 -mb-32 blur-3xl" />

                <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-blue-200/60 font-black text-[10px] uppercase tracking-[0.3em]">
                            <Sparkles className="w-4 h-4" />
                            {currentMonthStats.label}
                        </div>
                        <h3 className="text-3xl sm:text-4xl font-black tracking-tight leading-none italic">PERFORMANCE</h3>
                        <p className="text-blue-100/70 text-sm font-medium mt-2">今月の主要指標をサマリー形式で表示しています</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 flex-1 max-w-4xl w-full">
                        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-6 border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-2 text-blue-200 text-[10px] font-black uppercase tracking-widest mb-3">
                                <BarChart3 className="w-4 h-4 opacity-50" /> 売上合計
                            </div>
                            <div className="text-3xl font-black tracking-tighter">¥{currentMonthStats.sales.toLocaleString()}</div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-6 border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-2 text-emerald-200 text-[10px] font-black uppercase tracking-widest mb-3">
                                <FileText className="w-4 h-4 opacity-50" /> 日報提出
                            </div>
                            <div className="text-3xl font-black tracking-tighter">{currentMonthStats.reports}<span className="text-sm ml-1 font-bold opacity-50">件</span></div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-6 border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-2 text-amber-200 text-[10px] font-black uppercase tracking-widest mb-3">
                                <ShoppingBag className="w-4 h-4 opacity-50" /> 仕入件数
                            </div>
                            <div className="text-3xl font-black tracking-tighter">{currentMonthStats.purchases}<span className="text-sm ml-1 font-bold opacity-50">件</span></div>
                        </div>
                    </div>

                    <Link href="/analytics" className="px-8 py-4 bg-white text-[#1e3a8a] rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-900/20 self-start xl:self-center">
                        View Analytics
                    </Link>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Calendar Section */}
                    <CalendarView />

                    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-bold text-slate-900 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                在庫アラート
                            </h2>
                            <Link href="/products" className="text-xs font-bold text-[#1e3a8a] hover:underline">
                                商品一覧へ
                            </Link>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {lowStockItems.length > 0 ? (
                                lowStockItems.map((product) => (
                                    <div key={product.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                                                {product.imageUrl ? (
                                                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package className="w-4 h-4 text-slate-300" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">{product.name}</div>
                                                <div className="text-[10px] text-slate-500">{product.variantName || "通常版"}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm font-bold ${product.stock < (product.alertThreshold ?? 20) / 2 ? "text-red-600" : "text-amber-600"}`}>
                                                在庫 {product.stock}個
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-medium">
                                                (しきい値: {product.alertThreshold ?? 20}個)
                                            </div>
                                            <Link href="/products" className="text-[10px] text-blue-600 font-bold hover:underline">
                                                管理画面を開く
                                            </Link>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-12 text-center text-slate-400">
                                    <div className="mb-2 flex justify-center">
                                        <Sparkles className="w-8 h-8 text-emerald-100" />
                                    </div>
                                    在庫不足の商品は現在ありません。
                                </div>
                            )}
                        </div>
                    </section>

                    {/* System Overview */}
                    <section>
                        <div className="flex items-center gap-2 mb-6 text-slate-400">
                            <BarChart3 className="w-3.5 h-3.5" />
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">System Status</h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                            <div className="bg-white p-7 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                                <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <Package className="w-4 h-4 text-blue-500/50" />
                                    Products
                                </div>
                                <div className="text-4xl font-black text-slate-900 tracking-tighter">{totalProducts}</div>
                            </div>
                            <div className="bg-white p-7 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                                <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <Tag className="w-4 h-4 text-emerald-500/50" />
                                    Brands
                                </div>
                                <div className="text-4xl font-black text-slate-900 tracking-tighter">{totalBrands}</div>
                            </div>
                            <div className="bg-white p-7 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                                <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <Store className="w-4 h-4 text-amber-500/50" />
                                    Stores
                                </div>
                                <div className="text-4xl font-black text-slate-900 tracking-tighter">{totalStores}</div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Sidebar Mini Column */}
                <div className="space-y-6">
                    <div className="bg-[#1e3a8a] rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2">最新情報をチェック</h3>
                            <p className="text-blue-100 text-sm mb-4 leading-relaxed">
                                直近の業務日報や売上傾向を確認して、販売戦略を立てましょう。
                            </p>
                            <Link href="/analytics" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-white/20">
                                事業分析をみる <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                        <Sparkles className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5" />
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-blue-600" />
                            新規登録
                        </h3>
                        <div className="space-y-2">
                            <Link href="/brands" className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-sm group">
                                <span className="text-slate-600 font-medium">ブランド登録</span>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                            </Link>
                            <Link href="/retail-stores" className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-sm group">
                                <span className="text-slate-600 font-medium">店舗登録</span>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                            </Link>
                            <Link href="/suppliers" className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-sm group">
                                <span className="text-slate-600 font-medium">仕入先登録</span>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                            </Link>
                            <Link href="/todo" className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-sm group">
                                <span className="text-slate-600 font-medium font-bold text-blue-600">課題・ToDoの追加</span>
                                <Plus className="w-4 h-4 text-blue-600" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Guideline Banner */}
            <div className="bg-[#1e3a8a] rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-[0.05] rounded-full -mr-16 -mt-16" />
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">さらに有効活用するために</h3>
                        <p className="text-sm text-blue-100 italic">操作マニュアル・ブランディング・経営分析のコツを確認しましょう。</p>
                    </div>
                </div>
                <Link
                    href="/guidelines"
                    className="px-6 py-2.5 bg-white text-blue-900 rounded-xl font-black text-sm hover:scale-105 transition-transform shrink-0 relative z-10 shadow-lg"
                >
                    ご利用ガイドをみる
                </Link>
            </div>
        </div>
    );
}
