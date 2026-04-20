// src/components/AutoReportSettings.tsx
"use client";

import { useState, useMemo } from "react";
import {
    Mail, Calendar, Clock, Save,
    Play, Eye, AlertCircle, CheckCircle2,
    TrendingUp, TrendingDown, Minus, Package, Store,
    ChevronRight, ArrowRight
} from "lucide-react";
import { useStore, DEFAULT_REPORT_CONFIG } from "@/lib/store";
import { generateReportData, ReportData } from "@/lib/reportUtils";
import { apiFetch, DemoModeError } from "@/lib/apiClient";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";

export function AutoReportSettings() {
    const {
        reportConfig, updateReportConfig,
        sales, products, retailStores, dailyReports, spotRecipients
    } = useStore();

    const [isSaving, setIsSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [testSent, setTestSent] = useState(false);
    const [testError, setTestError] = useState<string | null>(null);
    const [localEmail, setLocalEmail] = useState(reportConfig.emailRecipient || "");

    // Sync local state when reportConfig loads
    useMemo(() => {
        if (reportConfig.emailRecipient && !localEmail) {
            setLocalEmail(reportConfig.emailRecipient);
        }
    }, [reportConfig.emailRecipient]);

    const reportData = useMemo(() => {
        return generateReportData(sales, products, retailStores, dailyReports, spotRecipients);
    }, [sales, products, retailStores, dailyReports, spotRecipients]);

    const handleEmailBlur = () => {
        if (localEmail !== reportConfig.emailRecipient) {
            updateReportConfig({ emailRecipient: localEmail });
        }
    };

    const sendTestEmail = async () => {
        setTestSent(false);
        setTestError(null);
        try {
            const res = await apiFetch('/api/reports/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    test: true,
                    recipient: localEmail,
                    data: reportData
                })
            });
            const result = await res.json();
            if (res.ok) {
                setTestSent(true);
            } else {
                setTestError(result.error || "送信に失敗しました");
            }
        } catch (e) {
            if (e instanceof DemoModeError) {
                setTestError(e.message);
            } else {
                setTestError("送信に失敗しました");
            }
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Mail className="w-6 h-6" style={{ color: BRAND }} />
                        自動レポート設定
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        売上状況や在庫補充のアラートを定期的にメールで受信します。
                    </p>
                </div>
                <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <Eye className="w-4 h-4" />
                    レポートをプレビュー
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Configuration Form */}
                <div className="md:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-6 space-y-6">
                            {/* Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-2xl" style={{ backgroundColor: reportConfig.isEnabled ? BRAND_LIGHT : '#f8fafc' }}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${reportConfig.isEnabled ? 'bg-white shadow-sm' : 'bg-slate-200'}`}>
                                        <Mail className={`w-5 h-5 ${reportConfig.isEnabled ? '' : 'text-slate-400'}`} style={{ color: reportConfig.isEnabled ? BRAND : undefined }} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-800">自動送信を有効にする</div>
                                        <div className="text-xs text-slate-400">設定したスケジュールでレポートを送信します</div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={reportConfig.isEnabled} onChange={e => updateReportConfig({ isEnabled: e.target.checked })} />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#b27f79]"></div>
                                </label>
                            </div>

                            <div className={`space-y-4 transition-opacity ${reportConfig.isEnabled ? 'opacity-100' : 'opacity-60'}`}>
                                {/* Recipient */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">送信先メールアドレス</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                        <input
                                            type="email"
                                            placeholder="example@yourdomain.com"
                                            value={localEmail}
                                            onChange={e => setLocalEmail(e.target.value)}
                                            onBlur={handleEmailBlur}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#b27f7920] focus:border-[#b27f79] outline-none transition-all font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Schedule */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">送信頻度</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                            <select
                                                value={reportConfig.frequency}
                                                onChange={e => updateReportConfig({ frequency: e.target.value as any })}
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#b27f7920] focus:border-[#b27f79] outline-none transition-all font-bold text-slate-700 appearance-none"
                                            >
                                                <option value="daily">毎日</option>
                                                <option value="weekly">毎週</option>
                                                <option value="monthly">毎月</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">送信時刻</label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                            <input
                                                type="time"
                                                value={reportConfig.sendTime}
                                                onChange={e => updateReportConfig({ sendTime: e.target.value })}
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#b27f7920] focus:border-[#b27f79] outline-none transition-all font-bold text-slate-700"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {reportConfig.frequency === 'weekly' && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">送信曜日</label>
                                        <div className="flex gap-2">
                                            {["日", "月", "火", "水", "木", "金", "土"].map((day, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => updateReportConfig({ sendDay: idx })}
                                                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${reportConfig.sendDay === idx
                                                        ? 'bg-[#b27f79] border-[#b27f79] text-white shadow-sm'
                                                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                                        }`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                <AlertCircle className="w-3 h-3" />
                                設定は自動的に保存されます
                            </div>
                            <button
                                onClick={sendTestEmail}
                                disabled={!localEmail}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-30"
                            >
                                <Play className="w-3 h-3" />
                                {testSent ? 'テストメール送信完了' : testError ? '送信失敗' : 'テストメールを送信'}
                                {testSent && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                {testError && <AlertCircle className="w-3 h-3 text-rose-400" />}
                            </button>
                        </div>
                        {testError && (
                            <div className="px-6 pb-4">
                                <p className="text-[10px] text-rose-500 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100 italic">
                                    エラー: {testError}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Quick Help Card */}
                    <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-amber-900">定期実行について</h4>
                            <p className="text-xs text-amber-700 leading-relaxed mt-1">
                                この機能は外部サービス（Cronジョブなど）との連携が必要です。設定を有効にすると、指定した日時にシステムがレポートを自動生成し、登録されたアドレスへ送信します。
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sidebar Insight Summary */}
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800">次回のレポート内容（予定）</h3>

                        <div className="space-y-3">
                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <div className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">今週の売上</div>
                                <div className="text-lg font-black text-blue-900">¥{reportData.weeklySales.currentAmount.toLocaleString()}</div>
                                <div className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${reportData.weeklySales.growthRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {reportData.weeklySales.growthRate >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                    前週比 {Math.abs(reportData.weeklySales.growthRate).toFixed(1)}%
                                </div>
                            </div>

                            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                                <div className="text-[10px] text-purple-500 font-bold uppercase tracking-wider mb-1">補充推奨</div>
                                <div className="text-lg font-black text-purple-900">{reportData.restockingRecommendations.length} 商品</div>
                                <div className="text-[10px] text-purple-400 font-medium mt-1">10日以内に在庫切れ予測</div>
                            </div>

                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-1">来週の予測</div>
                                <div className="text-lg font-black text-amber-900">¥{reportData.forecast.nextWeekPredictedAmount.toLocaleString()}</div>
                                <div className="text-[10px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                                    <ArrowRight className="w-2.5 h-2.5" />
                                    直近のトレンドから算出
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
                    <div className="relative bg-[#f8fafc] w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-base font-black text-slate-800">レポートプレビュー</h3>
                                <p className="text-[10px] text-slate-400 font-bold">{reportData.period.start} 〜 {reportData.period.end}</p>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors">
                                <Minus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Content - Simulating Email Body */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-8">
                                <div className="text-center space-y-2">
                                    <div className="inline-block px-4 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Weekly Performance Report</div>
                                    <h1 className="text-2xl font-black text-slate-900">今週の販売概況レポート</h1>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">今週の総売上（税込）</div>
                                        <div className="text-2xl font-black text-slate-900">¥{reportData.weeklySales.currentAmount.toLocaleString()}</div>
                                        <div className={`text-xs font-bold flex items-center gap-1 ${reportData.weeklySales.growthRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {reportData.weeklySales.growthRate >= 0 ? '▲' : '▼'} {Math.abs(reportData.weeklySales.growthRate).toFixed(1)}% <span className="text-slate-400 font-normal ml-1">前週比</span>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">来週の売上予測</div>
                                        <div className="text-2xl font-black text-slate-900">¥{reportData.forecast.nextWeekPredictedAmount.toLocaleString()}</div>
                                        <div className="text-xs text-slate-400">トレンド: {reportData.forecast.trend === 'up' ? '上昇基調' : reportData.forecast.trend === 'down' ? '低下基調' : '横ばい'}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                                            <Store className="w-3.5 h-3.5" /> 店舗売上ランキング
                                        </h4>
                                        <div className="space-y-2">
                                            {reportData.storeRanking.map((s, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-600 font-bold"><span className="text-slate-300 mr-2">{i + 1}</span>{s.name}</span>
                                                    <span className="font-black text-slate-800">¥{s.amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                                            <Package className="w-3.5 h-3.5" /> 売れ筋商品ランキング
                                        </h4>
                                        <div className="space-y-2">
                                            {reportData.productRanking.map((p, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-600 font-bold"><span className="text-slate-300 mr-2">{i + 1}</span>{p.name}</span>
                                                    <span className="font-black text-slate-800">{p.quantity} 個</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> 補充推奨（欠品アラート）
                                    </h4>
                                    <div className="overflow-hidden rounded-xl border border-slate-100">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-400 font-bold">
                                                <tr>
                                                    <th className="px-3 py-2">商品名</th>
                                                    <th className="px-3 py-2 text-right">現在庫</th>
                                                    <th className="px-3 py-2 text-right">予測日数</th>
                                                    <th className="px-3 py-2 text-right">推奨補充数</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 italic">
                                                {reportData.restockingRecommendations.length === 0 ? (
                                                    <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">欠品リスクのある商品はありません</td></tr>
                                                ) : (
                                                    reportData.restockingRecommendations.map((r, i) => (
                                                        <tr key={i}>
                                                            <td className="px-3 py-2 font-bold text-slate-700">{r.productName}</td>
                                                            <td className="px-3 py-2 text-right font-medium text-slate-500">{r.currentStock}</td>
                                                            <td className="px-3 py-2 text-right font-black text-rose-500">{r.estimatedDaysLeft < 0 ? '欠品中' : `${r.estimatedDaysLeft}日`}</td>
                                                            <td className="px-3 py-2 text-right font-black text-slate-900">+{r.recommendedQty}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-white p-6 border-t border-slate-100 flex justify-end shrink-0">
                            <button onClick={() => setShowPreview(false)} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors">
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
