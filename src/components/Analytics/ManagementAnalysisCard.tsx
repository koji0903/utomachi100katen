"use client";

import { useState } from "react";
import { Sparkles, Brain, Loader2, RefreshCw, ChevronRight, Presentation, Award, TrendingUp } from "lucide-react";

interface ManagementAnalysisCardProps {
    period: string;
    viewMode: "monthly" | "daily";
    kpis: {
        totalRevenue: number;
        totalCOGS: number;
        grossProfit: number;
        totalNetProfit: number;
        cogRate: number;
    };
    abcAnalysis: any[];
    storeDistribution: any[];
    recentReports: any[];
    weatherSummary?: string;
    targetStoreTrends?: {
        name: string;
        revenue: number;
        share: number;
        topProducts: { name: string; qty: number }[];
    };
}

export function ManagementAnalysisCard({
    period,
    viewMode,
    kpis,
    abcAnalysis,
    storeDistribution,
    recentReports,
    weatherSummary,
    targetStoreTrends
}: ManagementAnalysisCardProps) {
    const [report, setReport] = useState<string>("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const generateReport = async () => {
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/analytics/management-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    period,
                    viewMode,
                    kpis,
                    abcAnalysis,
                    storeDistribution,
                    recentReports,
                    weatherSummary,
                    targetStoreTrends
                }),
            });
            const data = await res.json();
            if (data.report) {
                setReport(data.report);
            }
        } catch (error) {
            console.error("Management report generation failed:", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const renderInlineStyles = (text: string) => {
        // Split by bold **text**
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            const boldMatch = part.match(/\*\*([^*]+)\*\*/);
            if (boldMatch) {
                return <strong key={i} className="font-black text-indigo-900">{boldMatch[1]}</strong>;
            }
            return part;
        });
    };

    const formattedReport = report ? report.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h3 key={i} className="text-xl font-black text-indigo-900 mt-6 mb-4 border-b-2 border-indigo-100 pb-2">{renderInlineStyles(line.replace("# ", ""))}</h3>;
        if (line.startsWith("## ")) return <h4 key={i} className="text-lg font-black text-indigo-800 mt-5 mb-3 flex items-center gap-2"> {renderInlineStyles(line.replace("## ", ""))}</h4>;
        if (line.startsWith("### ")) return <h5 key={i} className="text-base font-bold text-indigo-700 mt-4 mb-2">{renderInlineStyles(line.replace("### ", ""))}</h5>;
        if (line.startsWith("- ")) return <li key={i} className="text-sm text-slate-700 ml-4 py-1 list-disc font-medium">{renderInlineStyles(line.replace("- ", ""))}</li>;
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm text-slate-600 leading-relaxed font-medium mb-2">{renderInlineStyles(line)}</p>;
    }) : null;

    return (
        <div className="relative group overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#1d4ed8] rounded-[2.5rem]" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/10 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/5 rounded-full -ml-32 -mb-32 blur-3xl" />

            <div className="relative p-8 sm:p-10 text-white min-h-[300px]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl group-hover:scale-105 transition-transform duration-500">
                            <Presentation className="w-8 h-8 text-blue-200" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-300/60 flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3" />
                                    Strategic Analysis
                                </span>
                                {isAnalyzing && <div className="flex gap-1"><div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" /><div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" /></div>}
                            </div>
                            <h2 className="text-3xl font-black text-white tracking-tighter leading-none italic">
                                経営分析レポート
                            </h2>
                        </div>
                    </div>
                    
                    <button 
                        onClick={generateReport}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2.5 px-8 py-4 bg-white text-[#1e3a8a] rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-blue-50 transition-all shadow-xl shadow-blue-900/40 active:scale-95 disabled:opacity-50"
                    >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                        レポートを生成
                    </button>
                </div>

                {!report && !isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                        <div className="p-5 bg-white/5 rounded-full mb-2">
                            <Award className="w-10 h-10 text-blue-200/40" />
                        </div>
                        <h3 className="text-xl font-bold text-blue-100">AIによる戦略的インサイト</h3>
                        <p className="max-w-md text-sm text-blue-200/60 leading-relaxed font-medium">
                            現在の売上実績・商品構成・現場の日報を統合的に分析し、<br />
                            ビジネスの成長を加速させるためのレポートを作成します。
                        </p>
                    </div>
                ) : isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                        <div className="relative">
                            <Brain className="w-16 h-16 text-blue-200/20 animate-pulse" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-300" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-lg font-black text-blue-100 italic animate-pulse">データを読み解いています...</p>
                            <p className="text-[10px] uppercase tracking-widest text-blue-200/40">KPI・販売トレンド・現場の声を統合中</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white/95 backdrop-blur-3xl rounded-[2rem] p-8 sm:p-12 text-slate-800 shadow-2xl shadow-indigo-900/20 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                    <Brain className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Generated by Utomachi AI</div>
                                    <div className="text-sm font-black text-slate-600">{period} 期 経営分析報告書</div>
                                </div>
                            </div>
                            {formattedReport}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
