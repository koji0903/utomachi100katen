"use client";

import {
    Sparkles,
    CheckCircle2,
    Clock,
    Calendar,
    ArrowLeft,
    Box,
    CheckCircle,
    Layout
} from "lucide-react";
import Link from "next/link";
import { FEATURE_STATUS_LIST, CURRENT_VERSION, RELEASE_DATE, FeatureStatus } from "@/lib/version";

function StatusBadge({ status }: { status: FeatureStatus['status'] }) {
    switch (status) {
        case 'completed':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <CheckCircle className="w-3 h-3" />
                    実装済
                </span>
            );
        case 'ongoing':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <Clock className="w-3 h-3 animate-pulse" />
                    調整中 / 改善中
                </span>
            );
        case 'planned':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <Calendar className="w-3 h-3" />
                    計画中
                </span>
            );
    }
}

export default function UpdatesPage() {
    return (
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">

            {/* Header */}
            <div className="space-y-4">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-slate-400 hover:text-[#1e3a8a] transition-colors text-sm font-bold group"
                >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    戻る
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-100 pb-8">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black">
                            <Sparkles className="w-3.5 h-3.5" />
                            UPDATES & ROADMAP
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                            機能の実現状況と更新履歴
                        </h1>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-3xl font-black text-[#1e3a8a] tabular-nums tracking-tighter">
                            {CURRENT_VERSION}
                        </div>
                        <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                            Released on {RELEASE_DATE}
                        </div>
                    </div>
                </div>
            </div>

            {/* Current Status List */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <Layout className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">主要機能のステータス</h2>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {FEATURE_STATUS_LIST.map((feature, idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-shadow"
                        >
                            <div className="space-y-1">
                                <h3 className="font-black text-slate-800">{feature.name}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                                    {feature.description}
                                </p>
                            </div>
                            <div className="shrink-0">
                                <StatusBadge status={feature.status} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent History (Simple static list for now) */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <Clock className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">最近の主な更新内容</h2>
                </div>

                <div className="space-y-8 pl-5 relative border-l-2 border-slate-100 ml-5">
                    {/* v1.6.0 */}
                    <div className="relative">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-rose-500 border-4 border-white shadow-sm ring-4 ring-rose-50" />
                        <div>
                            <div className="text-xs font-black text-rose-600 mb-1 uppercase tracking-wider">{CURRENT_VERSION} - {RELEASE_DATE}</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-rose-200 underline-offset-4 decoration-2">AI支出・経費管理の導入とUX改善</h3>
                            <ul className="space-y-2">
                                {[
                                    "Gemini AIによるレシート解析：写真やPDFから日付・金額・品目などを自動抽出",
                                    "内蔵プレイヤーによるプレビュー：別タブを開かずPDFや画像を詳細に確認可能",
                                    "支出データの編集機能：AI抽出結果の微調整や手動での内容修正に対応",
                                    "モバイルカメラ連携：デバイスのカメラで領収書を直接撮影してアップロード可能",
                                    "セッション管理の改善：デモ環境でのログアウト挙動およびリダイレクト処理の安定化"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.5.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.5.0 - 2026.03.16</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-orange-200 underline-offset-4 decoration-2">Amazon SP-API 販売連携の導入</h3>
                            <ul className="space-y-2">
                                {[
                                    "Amazon SP-API 連携基盤の実装：在庫同期・注文データの自動取り込みに対応",
                                    "Amazon 出品商品紐付け：各商品ごとに ASIN / SKU の設定および同期スイッチを導入",
                                    "手動同期機能：商品一覧ページからワンクリックで Amazon データの最新化が可能に",
                                    "取引管理への自動計上：Amazon での注文を「ECチャネル」の取引として自動登録",
                                    "環境変数管理の強化：SP-API 認証情報の安全な管理フローを確立"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.4.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.4.0 - 2026.03.14</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">仕入管理の刷新と入力UXの大幅向上</h3>
                            <ul className="space-y-2">
                                {[
                                    "「仕入管理」機能の刷新：発注・仕入待ち・仕入済み・支払済のフルワークフローに対応",
                                    "カレンダー連携：発注・仕入・支払予定がカレンダー上で一目で確認可能に",
                                    "数値入力UXの改善：フォーカス時の全選択、スマートな「0」処理を導入し操作性を向上",
                                    "業務日報の改善：関連商品選択に全件表示と高速検索フィルターを導入",
                                    "システム修正：Vercelデプロイ時のTypeScript型エラーを解消"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.3.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.3.0 - 2026.03.13</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">月次売上レポート機能の追加</h3>
                            <ul className="space-y-2">
                                {[
                                    "月次売上レポート出力機能の追加（店舗別・商品別の集計）",
                                    "レポートのPDFダウンロード機能の追加",
                                    "レポート表示用UIの新規実装（インディゴ基調のデザイン）"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.2.1 - 2026.03.12</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">UI・UXの洗練と機能追加</h3>
                            <ul className="space-y-2">
                                {[
                                    "バージョン表記と機能実現状況ページの追加",
                                    "売上管理の実績ログでの「最高気温・最低気温」表示対応",
                                    "売上管理の店舗フィルターにおける過去データとの整合性向上",
                                    "課題・ToDo管理のレイアウト改善"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.1.0 - 2026.03.10</div>
                            <h3 className="font-bold text-slate-700 mb-2 cursor-not-allowed">アクセシビリティ改善</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                全体の色調調整、フォントサイズの最適化、ハイコントラスト対応など、利用のしやすさを向上。
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer message */}
            <div className="pt-8 text-center border-t border-slate-100">
                <p className="text-sm text-slate-400 font-medium italic">
                    ※ これらの機能は、日々の現場の声を聞きながら、常に進化を続けています。
                </p>
            </div>

        </div>
    );
}
