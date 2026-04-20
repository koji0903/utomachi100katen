"use client";

import { useState, useEffect } from "react";
import { Sparkles, Brain, Loader2, RefreshCw, ChevronRight } from "lucide-react";
import { useStore, DailyReport } from "@/lib/store";
import Link from "next/link";
import { apiFetch, DemoModeError, isDemoMode } from "@/lib/apiClient";

export function ReportSummaryCard() {
    const { dailyReports, isLoaded } = useStore();
    const [summary, setSummary] = useState<string>("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [lastScanCount, setLastScanCount] = useState(0);

    // Helper to parse dates robustly
    const parseReportDate = (r: DailyReport) => {
        const d = r.createdAt || r.date;
        if (!d) return new Date(0);
        if (d instanceof Date) return d;
        if (typeof d === 'string') {
            // Firestore date strings (YYYY-MM-DD or ISO)
            const date = new Date(d);
            return isNaN(date.getTime()) ? new Date(0) : date;
        }
        if (d.toDate) return d.toDate();
        if (d.seconds) return new Date(d.seconds * 1000);
        return new Date(0);
    };

    const getRecentReportsData = () => {
        const now = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        
        // 1. Try to get reports from the last 7 days
        let filtered = dailyReports
            .filter(r => !r.isTrashed)
            .filter(r => parseReportDate(r) >= sevenDaysAgo);
        
        let label = "直近7日間";

        // 2. If no reports in 7 days, fallback to the latest 5 reports ever
        if (filtered.length === 0) {
            filtered = [...dailyReports]
                .filter(r => !r.isTrashed)
                .sort((a, b) => parseReportDate(b).getTime() - parseReportDate(a).getTime())
                .slice(0, 5);
            label = filtered.length > 0 ? "すべての期間の最新" : "直近7日間";
        }

        return {
            reports: filtered.sort((a, b) => parseReportDate(b).getTime() - parseReportDate(a).getTime()),
            label
        };
    };

    const analyzeReports = async (reports: DailyReport[]) => {
        if (reports.length === 0) return;
        if (isDemoMode()) return;

        setIsAnalyzing(true);
        try {
            const res = await apiFetch("/api/reports/summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reports }),
            });
            const data = await res.json();
            if (data.summary) {
                setSummary(data.summary);
                setLastScanCount(reports.length);
                localStorage.setItem("report_ai_summary", data.summary);
                localStorage.setItem("report_ai_summary_date", new Date().toISOString());
                localStorage.setItem("report_ai_summary_count", reports.length.toString());
            }
        } catch (error) {
            if (!(error instanceof DemoModeError)) {
                console.error("Failed to analyze reports:", error);
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    useEffect(() => {
        if (!isLoaded) return;
        
        const { reports } = getRecentReportsData();
        if (reports.length === 0) return;

        // Try load from cache
        const cachedSummary = localStorage.getItem("report_ai_summary");
        const cachedDate = localStorage.getItem("report_ai_summary_date");
        const cachedCount = localStorage.getItem("report_ai_summary_count");

        const isCacheValid = cachedDate && 
                             (new Date().getTime() - new Date(cachedDate).getTime() < 1000 * 60 * 60 * 12) && // 12 hours
                             cachedCount === reports.length.toString();

        if (isCacheValid && cachedSummary) {
            setSummary(cachedSummary);
            setLastScanCount(reports.length);
        } else {
            analyzeReports(reports);
        }
    }, [isLoaded, dailyReports.length]);

    const { reports: recentReports, label: periodLabel } = getRecentReportsData();

    if (!isLoaded) return null;
    
    // Even if no reports, we show the card with a "Let's write a report" message
    const hasData = recentReports.length > 0 || summary;

    const formattedSummary = summary ? summary.split("\n").map((line, i) => {
        if (line.includes("🟢")) return <div key={i} className="text-emerald-700 font-black mt-4 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">{line}</div>;
        if (line.includes("🟡")) return <div key={i} className="text-amber-700 font-black mt-4 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">{line}</div>;
        if (line.includes("🔵")) return <div key={i} className="text-indigo-700 font-black mt-4 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">{line}</div>;
        if (line.startsWith("-")) return <div key={i} className="text-sm text-slate-600 ml-4 py-1 relative before:content-[''] before:absolute before:left-[-12px] before:top-[14px] before:w-1.5 before:h-1.5 before:bg-slate-200 before:rounded-full font-medium">{line.replace("- ", "")}</div>;
        return <p key={i} className="text-sm text-slate-500 leading-relaxed font-medium">{line}</p>;
    }) : null;

    return (
        <div className="relative group">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-[2.5rem] blur-2xl group-hover:from-indigo-500/10 group-hover:to-purple-500/10 transition-all duration-700" />
            
            <div className="relative bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-indigo-100 p-8 shadow-sm hover:shadow-xl hover:shadow-indigo-900/5 transition-all duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-900 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-indigo-900/20 group-hover:scale-110 transition-transform duration-500">
                            <Brain className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500/60">AI Intelligence</span>
                                {isAnalyzing && <div className="flex gap-0.5"><div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" /><div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" /><div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" /></div>}
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none italic">
                                業務サマリー & インサイト
                            </h2>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => analyzeReports(recentReports)}
                        disabled={isAnalyzing || recentReports.length === 0}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-50 active:scale-95"
                    >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        再分析
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-8 space-y-2">
                        {isAnalyzing && !summary ? (
                            <div className="space-y-4 py-8">
                                <div className="h-4 bg-slate-100 rounded-full animate-pulse w-3/4" />
                                <div className="h-4 bg-slate-100 rounded-full animate-pulse w-1/2" />
                                <div className="h-4 bg-slate-100 rounded-full animate-pulse w-2/3" />
                            </div>
                        ) : !hasData ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                                <Sparkles className="w-8 h-8 text-slate-300 mb-3" />
                                <p className="text-sm text-slate-400 font-bold mb-1">日報データがまだありません</p>
                                <p className="text-[10px] text-slate-300 uppercase tracking-widest">分析を開始するには最初の日報を投稿してください</p>
                            </div>
                        ) : (
                            <div className="bg-indigo-50/20 rounded-[2rem] p-6 border border-indigo-50/50 min-h-[120px]">
                                {formattedSummary}
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-4 flex flex-col justify-between items-center text-center p-8 bg-gradient-to-br from-indigo-900 to-[#1e3a8a] rounded-[2rem] text-white shadow-2xl shadow-indigo-900/20 relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                         
                         <div className="relative z-10 w-full">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/60 mb-6 font-mono">対象期間: {periodLabel}</div>
                            <div className="flex flex-col items-center">
                                <div className="text-5xl font-black tracking-tighter mb-2 italic">
                                    {lastScanCount}<span className="text-xl ml-1 font-bold opacity-40">件</span>
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-blue-200">読み込んだ日報数</div>
                            </div>
                         </div>

                         <div className="relative z-10 mt-10 w-full space-y-4">
                            <p className="text-[11px] text-blue-100/60 font-medium leading-relaxed italic">
                                {recentReports.length > 0 
                                    ? "AIが現場の声を統合し、経営のヒントを導き出しました。"
                                    : "日報を投稿すると、AIがこの場所で業務の傾向を分析します。"}
                            </p>
                            <Link href="/reports" className="group/btn flex items-center justify-center gap-2 w-full py-4 bg-white/10 hover:bg-white text-white hover:text-indigo-900 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                                {recentReports.length > 0 ? "日報一覧を確認" : "日報を作成する"} <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </Link>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
