"use client";

import { useState, useRef } from "react";
import { FileText, RefreshCw, Loader2, Mail } from "lucide-react";
import { useStore } from "@/lib/store";
import { generateMonthlySalesReport, MonthlySalesReportData } from "@/lib/reportUtils";
import { downloadPdfFromElement, getPdfBase64FromElement } from "@/lib/pdfGenerator";
import { apiFetch, DemoModeError } from "@/lib/apiClient";

export function MonthlySalesReport() {
    const { products, retailStores, unifiedSales, spotRecipients, expenses, isLoaded } = useStore();
    
    // Monthly Report State
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [monthlyReportData, setMonthlyReportData] = useState<MonthlySalesReportData | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState("info@matching-k.jp");
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    const handleGenerateMonthlyReport = () => {
        setIsGenerating(true);
        // Simulate a small delay for better UX
        setTimeout(() => {
            const data = generateMonthlySalesReport(reportMonth, unifiedSales, products, retailStores, spotRecipients, expenses);
            setMonthlyReportData(data);
            setIsGenerating(false);
        }, 600);
    };

    const handleDownloadPdf = async () => {
        if (!reportRef.current) return;
        setIsExportingPdf(true);
        try {
            const filename = `monthly_report_${reportMonth}.pdf`;
            await downloadPdfFromElement(reportRef.current, filename);
        } catch (error) {
            console.error("PDF Export error:", error);
        } finally {
            setIsExportingPdf(false);
        }
    };

    const handleSendEmail = async () => {
        if (!reportRef.current || !monthlyReportData) return;
        setIsSendingEmail(true);
        try {
            const pdfBase64 = await getPdfBase64FromElement(reportRef.current);
            
            // Optimize payload: Strip out detailed product items from summaryData
            // The API only needs store-level totals for the email body.
            const slimSummaryData = {
                ...monthlyReportData,
                totals: monthlyReportData.totals.map(({ items, ...rest }) => ({
                    ...rest,
                    // We don't send individual items to the email API to stay under payload limits
                    // The PDF already contains the full breakdown.
                }))
            };

            const response = await apiFetch("/api/reports/send-monthly", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipient: recipientEmail,
                    month: reportMonth,
                    pdfBase64: pdfBase64,
                    summaryData: slimSummaryData
                }),
            });
            const result = await response.json();
            if (result.success) {
                alert("レポートをメールで送信しました。");
            } else {
                throw new Error(result.error || "送信に失敗しました");
            }
        } catch (error) {
            if (error instanceof DemoModeError) {
                alert(error.message);
            } else {
                console.error("Email share error:", error);
                alert(`メール送信に失敗しました`);
            }
        } finally {
            setIsSendingEmail(false);
        }
    };

    if (!isLoaded) return null;

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 text-sm">月次損益レポート</h2>
                        <p className="text-[10px] text-slate-400 font-medium">売上高・手数料・営業経費・最終純利益の月次集計出力</p>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">対象月を選択</label>
                        <input
                            type="month"
                            value={reportMonth}
                            onChange={(e) => setReportMonth(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleGenerateMonthlyReport}
                            disabled={isGenerating}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-all text-sm h-[46px]"
                        >
                            {isGenerating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                            月次レポートを出力
                        </button>
                    </div>
                </div>

                {monthlyReportData && (
                    <div className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Report Content for PDF Export */}
                        <div ref={reportRef} style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: '0' }}>{reportMonth.replace(/-/g, "/")} 月次損益（P&L）レポート</h3>
                                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>出力日: {new Date().toLocaleDateString("ja-JP")}</p>
                            </div>

                            {/* Grand Summary Section */}
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#475569', margin: '0' }}>【損益総合サマリ】</h4>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                                    <div style={{ backgroundColor: '#f5f7ff', border: '1.5px solid #e0e7ff', borderRadius: '12px', padding: '12px' }}>
                                        <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6366f1', marginBottom: '4px', margin: '0' }}>合計売上</p>
                                        <p style={{ fontSize: '16px', fontWeight: '900', color: '#1e1b4b', margin: '0' }}>¥{monthlyReportData.grandTotalAmount.toLocaleString()}</p>
                                    </div>
                                    <div style={{ backgroundColor: '#fff7ed', border: '1.5px solid #ffedd5', borderRadius: '12px', padding: '12px' }}>
                                        <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ea580c', marginBottom: '4px', margin: '0' }}>委託手数料</p>
                                        <p style={{ fontSize: '16px', fontWeight: '900', color: '#9a3412', margin: '0' }}>
                                            ¥{(
                                                monthlyReportData.totals.reduce((sum, store) => {
                                                    const storeObj = retailStores.find(rs => rs.id === store.storeId);
                                                    return sum + (storeObj?.commissionRate ? store.storeTotalAmount * (storeObj.commissionRate / 100) : 0);
                                                }, 0)
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                    <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fee2e2', borderRadius: '12px', padding: '12px' }}>
                                        <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ef4444', marginBottom: '4px', margin: '0' }}>営業経費</p>
                                        <p style={{ fontSize: '16px', fontWeight: '900', color: '#991b1b', margin: '0' }}>¥{monthlyReportData.totalExpenses.toLocaleString()}</p>
                                    </div>
                                    <div style={{ 
                                        backgroundColor: monthlyReportData.netProfit >= 0 ? '#f0fdf4' : '#fff5f5', 
                                        border: monthlyReportData.netProfit >= 0 ? '1.5px solid #dcfce7' : '1.5px solid #fee2e2', 
                                        borderRadius: '12px', 
                                        padding: '12px' 
                                    }}>
                                        <p style={{ 
                                            fontSize: '9px', 
                                            fontWeight: 'bold', 
                                            textTransform: 'uppercase', 
                                            letterSpacing: '0.05em', 
                                            color: monthlyReportData.netProfit >= 0 ? '#16a34a' : '#ef4444', 
                                            marginBottom: '4px', 
                                            margin: '0' 
                                        }}>最終純利益</p>
                                        <p style={{ 
                                            fontSize: '16px', 
                                            fontWeight: '900', 
                                            color: monthlyReportData.netProfit >= 0 ? '#14532d' : '#7f1d1d', 
                                            margin: '0' 
                                        }}>¥{monthlyReportData.netProfit.toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Per-Store Summary Table */}
                                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '10px', marginTop: '16px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>店舗別売上実績</span>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#334155', marginBottom: '24px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                                            <th style={{ textAlign: 'left', padding: '8px 12px' }}>店舗名</th>
                                            <th style={{ textAlign: 'right', padding: '8px 12px' }}>手数料率</th>
                                            <th style={{ textAlign: 'right', padding: '8px 12px' }}>売上個数</th>
                                            <th style={{ textAlign: 'right', padding: '8px 12px' }}>売上金額</th>
                                        </tr>
                                    </thead>
                                    <tbody style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                                        {monthlyReportData.totals.map((store) => {
                                            const storeObj = retailStores.find(rs => rs.id === store.storeId);
                                            return (
                                                <tr key={store.storeId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px 12px', fontWeight: '500' }}>{store.storeName}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                                                        {storeObj?.commissionRate ? `${storeObj.commissionRate}%` : '0%'}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{store.storeTotalQuantity.toLocaleString()}個</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>¥{store.storeTotalAmount.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* 営業経費内訳テーブル */}
                                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '10px', marginTop: '24px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>営業経費内訳（一般管理費）</span>
                                </div>
                                {monthlyReportData.expenseDetails.length === 0 ? (
                                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0', textAlign: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0', marginBottom: '24px' }}>
                                        当月の営業経費の登録はありませんでした。
                                    </p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#334155', marginBottom: '24px' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>経費カテゴリー</th>
                                                <th style={{ textAlign: 'right', padding: '8px 12px' }}>合計金額</th>
                                                <th style={{ textAlign: 'right', padding: '8px 12px', width: '80px' }}>構成比</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthlyReportData.expenseDetails.map((exp) => (
                                                <tr key={exp.category} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px 12px', fontWeight: '500' }}>{exp.category}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>¥{exp.amount.toLocaleString()}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                                                        {monthlyReportData.totalExpenses > 0 ? ((exp.amount / monthlyReportData.totalExpenses) * 100).toFixed(1) : 0}%
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr style={{ backgroundColor: '#fff5f5', fontWeight: 'bold', borderTop: '1.5px solid #fecaca' }}>
                                                <td style={{ padding: '8px 12px', color: '#b91c1c' }}>経費合計</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#b91c1c' }}>¥{monthlyReportData.totalExpenses.toLocaleString()}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#b91c1c' }}>100.0%</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Detailed Section Indicator */}
                            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginTop: '32px', marginBottom: '16px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#475569', margin: '0' }}>【店舗別商品明細】</h4>
                            </div>

                            {/* Detailed Table Content */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {monthlyReportData.totals.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '16px' }}>
                                        <div style={{ color: '#fbbf24', fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
                                        <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b', margin: '0' }}>集計データがありませんでした</p>
                                    </div>
                                ) : (
                                    monthlyReportData.totals.map((store) => (
                                        <div key={store.storeId} style={{ border: '1.5px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                            <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1' }}>
                                                    <span style={{ fontSize: '14px' }}>🏪</span>
                                                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', margin: '0' }}>{store.storeName}</h3>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '900', color: '#000000' }}>¥{store.storeTotalAmount.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div>
                                                {store.items.map((item, i) => (
                                                    <div key={item.productId} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i === store.items.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                                        <div style={{ flex: '1', paddingRight: '16px' }}>
                                                            <div style={{
                                                                fontSize: '12px',
                                                                fontWeight: '500',
                                                                color: '#334155',
                                                                margin: '0',
                                                                lineHeight: '2.0',
                                                                paddingBottom: '4px',
                                                                overflow: 'visible'
                                                            }}>
                                                                {item.productName}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: '0' }}>
                                                            <span style={{ fontSize: '12px', width: '45px', textAlign: 'right', fontWeight: '500', color: '#64748b' }}>{item.quantity}個</span>
                                                            <span style={{ fontSize: '12px', fontWeight: 'bold', width: '90px', textAlign: 'right', color: '#0f172a' }}>¥{item.amount.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Monthly Report Action Buttons */}
                        <div className="p-5 bg-white border-t border-slate-100 flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleDownloadPdf}
                                    disabled={isExportingPdf || monthlyReportData.totals.length === 0}
                                    className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 active:scale-95 transition-all text-sm h-[52px]"
                                >
                                    {isExportingPdf ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <FileText className="w-5 h-5" />
                                    )}
                                    PDFをダウンロード
                                </button>

                                <button
                                    onClick={() => setMonthlyReportData(null)}
                                    className="flex-1 px-5 py-4 bg-white hover:bg-slate-50 text-slate-500 font-bold rounded-2xl border border-slate-200 active:scale-95 transition-all text-sm h-[52px]"
                                >
                                    集計を閉じる
                                </button>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex flex-col gap-3">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">送信先メールアドレス</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="email"
                                                value={recipientEmail}
                                                onChange={(e) => setRecipientEmail(e.target.value)}
                                                placeholder="info@matching-k.jp"
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            />
                                            <button
                                                onClick={handleSendEmail}
                                                disabled={isSendingEmail || !recipientEmail}
                                                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold rounded-2xl shadow-md active:scale-95 transition-all text-sm min-w-[140px] h-[52px]"
                                            >
                                                {isSendingEmail ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <Mail className="w-5 h-5" />
                                                )}
                                                メール送信
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
