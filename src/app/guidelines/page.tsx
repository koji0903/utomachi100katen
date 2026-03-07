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
    BarChart3
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
                <GuideSection title="基本操作の最短ルート" icon={BookOpen} color="#2563eb">
                    <div className="mt-2">
                        <StepItem
                            number="1"
                            title="マスタ準備（商品・ブランド・店舗）"
                            desc="まずは「商品管理」「ブランド管理」「店舗管理」で、日々の記録の土台を作ります。商品ごとの「在庫アラート数」を設定するのがポイントです。"
                        />
                        <StepItem
                            number="2"
                            title="日々の売上入力"
                            desc="「売上入力」から、その日の実績を登録します。日次だけでなく月次の入力もサポート。入力ミスは「実績ログ」からいつでも修正可能です。"
                        />
                        <StepItem
                            number="3"
                            title="現場のリポート（業務日報）"
                            desc="数値には現れない「陳列の変化」や「接客の手応え」を写真と共に記録します。Before/After写真を残すことで、改善の歴史が積み上がります。"
                        />
                        <StepItem
                            number="4"
                            title="数字の裏側を読む（分析）"
                            desc="「事業分析」で曜日ごとの傾向や天気との相関を確認。データが溜まるほど、次の仕入れや人員配置の精度が上がります。"
                        />
                    </div>
                </GuideSection>

                {/* 2. 在庫と仕入れの最適化 */}
                <GuideSection title="在庫切れ・過剰在庫を防ぐ" icon={Package} color="#d97706">
                    <p className="text-sm text-slate-600 mb-6 font-medium">
                        適正な在庫量は、キャッシュフローの健全化に直結します。
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InsightBox
                            title="スマートアラート"
                            icon={ShieldCheck}
                            desc="商品ごとにアラートしきい値を設定。ダッシュボードに表示される警告を確認し、迅速な追加発注（仕入れ）に繋げましょう。"
                        />
                        <InsightBox
                            title="仕入れの履歴管理"
                            icon={ArrowRight}
                            desc="「仕入れ管理」でいつ、どこから、いくらで仕入れたかを記録。原価の推移や仕入先の評価に役立ててください。"
                        />
                        <InsightBox
                            title="支払い状況の把握"
                            icon={BarChart3}
                            desc="未払いの仕入れがないか、「支払い管理」で一元管理。月末の資金繰りをスムーズにします。"
                        />
                        <InsightBox
                            title="季節変動の予測"
                            icon={Lightbulb}
                            desc="昨年の同時期の売上データを参照し、必要な在庫量を予測。繁忙期前の準備を万全にします。"
                        />
                    </div>
                </GuideSection>

                {/* 3. ブランディングと展示戦略 */}
                <GuideSection title="ブランドを育てる" icon={Sparkles} color="#db2777">
                    <p className="text-sm text-slate-600 mb-6 font-medium">
                        ブランドの世界観を統一し、顧客に伝えるための機能です。
                    </p>
                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 bg-pink-50 rounded-2xl border border-pink-100">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm text-pink-600">
                                <Tag className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-pink-900 mb-1">共通ブランドコンセプト</h4>
                                <p className="text-xs text-pink-700 leading-relaxed">
                                    ブランド管理で「ブランド全体に共通するコンセプト」を設定できます。商品はすべてこのコンセプトを体現するものとして管理しましょう。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm text-indigo-600">
                                <Store className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-indigo-900 mb-1">VMDの記録（視覚演出）</h4>
                                <p className="text-xs text-indigo-700 leading-relaxed">
                                    「店舗管理」の情報と「業務日報」の写真を紐付け。どの陳列が売上に繋がったかを視覚的に分析します。
                                </p>
                            </div>
                        </div>
                    </div>
                </GuideSection>

                {/* 4. 経営判断の高度化 */}
                <GuideSection title="データに基づいた経営" icon={TrendingUp} color="#059669">
                    <p className="text-sm text-slate-600 mb-6 font-medium">
                        「なんとなく」の判断から「確信」の判断へ移行しましょう。
                    </p>
                    <ul className="space-y-3">
                        {[
                            "曜日別売上分析による最適な人員配置の決定",
                            "天気と売上の相関から、雨の日キャンペーンなどを企画",
                            "商品別利益率を確認し、注力すべきブランドや商品を特定",
                            "帳票管理機能を活用し、納品書・請求書をデジタル資産化",
                            "月次実績の推移から、長期的な成長戦略を策定"
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
