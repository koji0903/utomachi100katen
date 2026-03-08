"use client";

import {
    BookOpen,
    CheckCircle2,
    ArrowRight,
    TrendingUp,
    Package,
    Store,
    FileText,
    Sparkles,
    ShieldCheck,
    Lightbulb,
    BarChart3,
    Layers,
    RefreshCw
} from "lucide-react";

// --- Components ---

function GuideSection({ title, children, icon: Icon, color = "#1e3a8a" }: { title: string; children: React.ReactNode; icon: any; color?: string }) {
    return (
        <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
                        <Icon className="w-6 h-6" style={{ color }} />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">{title}</h2>
                </div>
                <div className="space-y-4">
                    {children}
                </div>
            </div>
        </section>
    );
}

function StepItem({ number, title, desc }: { number: string; title: string; desc: string }) {
    return (
        <div className="flex gap-4 group">
            <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-md">
                    {number}
                </div>
                <div className="flex-1 w-0.5 bg-slate-100 my-1 group-last:hidden" />
            </div>
            <div className="pb-6">
                <h3 className="font-bold text-slate-800 mb-1">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

function InsightBox({ title, desc, icon: Icon }: { title: string; desc: string; icon: any }) {
    return (
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-700">{title}</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
        </div>
    );
}

// --- Main Page ---

export default function GuidelinesPage() {
    return (
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">

            {/* Hero Section */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold animate-pulse">
                    <Sparkles className="w-4 h-4" />
                    ご利用ガイド
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
                    ウトマチ百貨店 <br className="sm:hidden" /> 成功のためのステップ
                </h1>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
                    このツールは、単なる在庫管理や売上記録の道具ではありません。 <br />
                    現場の記録を「改善のヒント」に変え、経営をより豊かにするためのパートナーです。
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 1. 基本操作の流れ */}
                <GuideSection title="業務を迷わせない整理術" icon={BookOpen} color="#2563eb">
                    <p className="text-sm text-slate-600 mb-6 font-medium">
                        機能が増えても迷わないよう、サイドバーを「業務」「在庫」「分析」「マスタ」に整理しました。
                    </p>
                    <div className="mt-2">
                        <StepItem
                            number="1"
                            title="マスタ準備（商品・ブランド・店舗）"
                            desc="まずは土台作りから。商品登録では JANコード や 軽減税率 の設定も可能です。ブランド単位のコンセプトもここで設定します。"
                        />
                        <StepItem
                            number="2"
                            title="日々の記録（売上・日報・ToDo）"
                            desc="「業務（デイリー）」グループに集約。日々の売上や現場の気づき、忘れてはいけない課題をクイックに登録しましょう。"
                        />
                        <StepItem
                            number="3"
                            title="在庫の動きと将来予測"
                            desc="単なる在庫数だけでなく「残り何日で欠品するか」の予測を確認。セット商品の構成や、加工（玄米→白米）による在庫変換もサポートしています。"
                        />
                        <StepItem
                            number="4"
                            title="ECへの展開"
                            desc="詳細情報（原材料、サイズ等）を入力し、「商品詳細をコピー」ボタンでShopifyやAmazonへの出品作業を効率化します。"
                        />
                    </div>
                </GuideSection>

                {/* 2. 在庫管理と高度な運用 */}
                <GuideSection title="高度な在庫・仕入れ運用" icon={Package} color="#d97706">
                    <p className="text-sm text-slate-600 mb-6 font-medium">
                        単なる管理から「予測」と「付加価値」を生む運用へ。
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InsightBox
                            title="欠品予測プロフェッショナル"
                            icon={ShieldCheck}
                            desc="過去の販売推移から「残り約◯日分」を自動計算。予測に基づく早めの仕入れでチャンスロスを防ぎます。"
                        />
                        <InsightBox
                            title="セット商品（複合構成）"
                            icon={Layers}
                            desc="複数の商品を組み合わせたセット販売に対応。セットが売れると、構成する中身の在庫も連動して減る仕組みです。"
                        />
                        <InsightBox
                            title="在庫変換（加工・小分け）"
                            icon={RefreshCw}
                            desc="仕入れた商品をそのまま売るだけでなく、精米や小分け、セット化などの「変換作業」を記録し、在庫を正確に追跡します。"
                        />
                        <InsightBox
                            title="支払い・仕入先管理"
                            icon={BarChart3}
                            desc="仕入先ごとの支払い状況を一元管理。未払いの確認や資金繰りの予測がダッシュボードからスムーズに行えます。"
                        />
                    </div>
                </GuideSection>

                {/* 3. EC展開とブランディング */}
                <GuideSection title="EC展開と価値の伝達" icon={Sparkles} color="#db2777">
                    <p className="text-sm text-slate-600 mb-6 font-medium">
                        ShopifyやAmazonなど、外部チャネルへの展開を強力にサポートします。
                    </p>
                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 bg-pink-50 rounded-2xl border border-pink-100">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm text-pink-600">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-pink-900 mb-1">EC連携メタデータの活用</h4>
                                <p className="text-xs text-pink-700 leading-relaxed">
                                    原材料、内容量、保存方法、賞味期限、サイズ情報など、EC運営に不可欠な情報を一括管理。「商品詳細コピー」機能で、出品作業を数秒で終わらせましょう。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm text-indigo-600">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-indigo-900 mb-1">ストーリーテリング</h4>
                                <p className="text-xs text-indigo-700 leading-relaxed">
                                    生産者の思いや地域背景を「ストーリー」として蓄積。AIによる紹介文生成機能を活用して、商品の魅力を最大限に引き出します。
                                </p>
                            </div>
                        </div>
                    </div>
                </GuideSection>

                {/* 4. 経営判断の高度化 */}
                <GuideSection title="データに基づいた経営" icon={TrendingUp} color="#059669">
                    <p className="text-sm text-slate-600 mb-6 font-medium">
                        蓄積された全てのデータが、あなたの経営の武器になります。
                    </p>
                    <ul className="space-y-3">
                        {[
                            "曜日・天気別の売上相関による最適な在庫・人員配置",
                            "ブランド・店舗別の利益率分析による注力ポイントの特定",
                            "在庫回転率の把握によるデッドストックの早期発見",
                            "ワンクリックでの納品書・請求書（PDF）発行とペーパーレス化",
                            "加工変換（付加価値向上）のプロセス管理とコスト把握"
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </GuideSection>

            </div>

            {/* Support section */}
            <div className="bg-[#1e3a8a] rounded-[2rem] p-10 text-center text-white space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-[0.03] rounded-full -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-[0.03] rounded-full -ml-24 -mb-24" />

                <h2 className="text-2xl font-bold relative z-10">準備はよろしいですか？</h2>
                <p className="text-blue-100 max-w-lg mx-auto relative z-10">
                    使い方がわからなくなったら、いつでもこのガイドに戻ってきてください。 <br />
                    あなたのビジネスの成長を、このツールと共に全力で応援しています。
                </p>
                <div className="pt-4 relative z-10">
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-8 py-3 bg-white text-blue-900 rounded-xl font-black shadow-xl hover:scale-105 transition-transform"
                    >
                        ダッシュボードに戻る
                    </button>
                </div>
            </div>

        </div>
    );
}

import { Tag } from "lucide-react";
