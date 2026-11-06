"use client";

import {
    Sparkles,
    Clock,
    Calendar,
    ArrowLeft,
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
                    {/* v1.28.0 */}
                    <div className="relative">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-sm ring-4 ring-blue-50" />
                        <div>
                            <div className="text-xs font-black text-blue-600 mb-1 uppercase tracking-wider">{CURRENT_VERSION} - {RELEASE_DATE}</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">振込先第3口座の追加登録 ＆ 請求先ごとの記載口座選択・基本設定記憶機能</h3>
                            <ul className="space-y-2">
                                {[
                                    "管理設定に「第3口座（任意）」の登録枠を新設：銀行名、支店名、口座種別、口座番号、口座名義を第1口座・第2口座と同様に管理可能に",
                                    "請求書作成時の記載口座セレクター：相手先や取引内容に合わせて「第1口座」「第2口座」「第3口座」「全口座並記」をワンクリックで選択可能",
                                    "請求先ごとの基本口座記憶（自動反映）：請求書作成時に「この相手先の基本口座として保存する」にチェックを入れて保存すると、次回以降同じ相手先宛ての請求書作成時に自動で記憶口座が反映",
                                    "店舗・取引先マスタでの基本振込口座設定：店舗・事業者編集モーダルの「請求先・振込先設定」にて、各店舗の基本振込先口座を事前設定可能に",
                                    "請求書プレビュー＆発行帳票での指定口座単独または全口座並記の正確な印字出力に対応"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.27.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.27.0 - 2026.11.06</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">店舗別月次売上推移の個別項目（単独）棒グラフ表示切替機能を追加</h3>
                            <ul className="space-y-2">
                                {[
                                    "店舗別月次売上推移グラフでの単独表示切替：従来の「全店舗（積み上げ比較）」に加え、プルダウンまたは各店舗ピルボタンから特定の店舗を選択して、その拠点単独の月次売上推移の棒グラフに瞬時に切り替え可能に",
                                    "グラフ凡例（レジェンド）クリックによる直感的フォーカス：グラフ下部の店舗名凡例をクリックするだけで、該当店舗の単独棒グラフと全店舗積み上げ比較をシームレスにトグル切替できるインタラクティブ操作を導入",
                                    "月次業績一覧テーブルとの完全双方向連動：下部の店舗別月次業績サマリーテーブルの各行クリックや「単独表示」ボタンからもグラフ表示店舗をダイレクトに切り替えられ、現在フォーカス中の拠点をハイライト表示"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.26.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.26.0 - 2026.11.06</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">商品種類数（SKU）推移 ＆ 展開生産性・カニバリゼーション分析を新設</h3>
                            <ul className="space-y-2">
                                {[
                                    "定例会向けコックピットに「SKU展開・生産性」タブを新設：商品種類の増加が売上や利益を押し上げているか、それともカニバリゼーション（共食い）や死に筋化を起こしているかを経営視点で検証できる専用ダッシュボードを追加",
                                    "月次SKU数推移と1SKUあたり売上・粗利の複合可視化：過去6ヶ月・12ヶ月にわたる総SKU数（種類数）と販売稼働SKU数の推移を棒グラフ、売上総額と1稼働SKUあたり売上を折れ線グラフで同時描画し、種類の拡充による希薄化を即座に検知",
                                    "SKU拡大弾力性（Elasticity）指標の導入：SKU増加率に対して売上が何倍のペースで成長しているかを自動算出。高効率拡大（弾力性1.0超）・安定拡大・希薄化警報の3段階でSKU投資効率を判定",
                                    "直近30日のSKUパレート・4象限ポートフォリオ分析：Aランク（売上上位80%を稼ぐ中核主力品）、Bランク（次15%の育成品）、Cランク（下位5%の補完品）、休眠品（売上0の非稼働品）に分類し、休眠品に寝ている在庫資産額（投下資金）をアラート表示",
                                    "新商品（新投入SKU）の立ち上がり追跡：直近投入された商品の販売ペース、粗利率、現在庫、および在庫残日数から「好発進」「順調」「滞留注意」を自動判定",
                                    "小売業経営コンサルタントによるSKU拡大戦略の処方箋：現在のSKU展開フェーズ（健全拡大・選別最適化・ラインナップ整理）と、定例会で決定すべき具体的なアクション（スクラップ＆ビルドルール、休眠品資金回収など）を提示"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.25.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.25.0 - 2026.11.06</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">売上状況エグゼクティブ・コックピットに「ブランド別動向分析」を新設</h3>
                            <ul className="space-y-2">
                                {[
                                    "定例会向けコックピットに「ブランド別動向」タブを新設：店舗別・商品別に加え、ブランド軸での売上推移・構成比・粗利・総在庫を定例会でひと目で横断分析できる専用ダッシュボードを追加",
                                    "全ブランド横断の売上・シェア・粗利・総在庫ランキング比較：ブランドごとの売上高、販売個数、全社売上シェア（%プログレスバー）、粗利額（限界利益）、粗利率、および本社・店頭の総在庫数を一覧で比較把握可能に",
                                    "ブランド別日次推移グラフ（7日・30日移動平均線付き）：期間幅（7日・30日・90日・360日）に連動し、日別売上額と7日移動平均（短期）・30日移動平均（中期）を描画。ALL選択時は全社売上と上位ブランドの売上構成推移を同時表示",
                                    "ブランド内・商品別売上＆消化ペース（在庫残日数）の深掘り：選択ブランドに属する商品ごとの販売数、売上高、粗利率、ブランド内シェア%、本社・店頭在庫、および現在の消化ペースに基づく在庫残日数を可視化",
                                    "取扱店舗・配架別売上シェアの可視化：選択ブランドがどの店舗・スポット販売先で売れているか（店舗別売上高・販売数・構成比）を直感的なプログレスバーで表示",
                                    "小売業経営コンサルタントによるブランド戦略診断：ブランドポートフォリオの集中度（特定ブランド依存リスク）や粗利率水準の健全性を自動診断し、定例会での意思決定アジェンダを提示",
                                    "5大エグゼクティブKPIカードへのトップブランド情報統合：サマリーカードに「30日 首位ブランド」を追加し、ワンクリックでブランド別動向タブへジャンプ可能に"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.24.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.24.0 - 2026.11.06</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">ダッシュボード「販促準備アラート」のカード削除機能を追加</h3>
                            <ul className="space-y-2">
                                {[
                                    "販促準備アラートカードに「削除」ボタンを新設：ダッシュボード上の各販促準備アラートカード（右上クイックアクションおよび下部フッター）に削除ボタンを設置。PC・スマートフォン双方で直感的にアラートを非表示・削除可能に",
                                    "カスタム行事および祝日・システム行事の安全な非表示対応：独自行事のデータベース完全削除に加え、祝日や季節イベントなどの自動生成行事も『非表示アーカイブ』として安全に記憶・管理し、ダッシュボードから除外可能に",
                                    "行事編集モーダル内での削除操作の統合：行事の編集モーダル内でも削除ボタンを共通配置し、内容確認時や編集時にもスムーズにアラートを削除できるようUIを整備"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.23.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.23.0 - 2026.11.05</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">利益計算の厳密化・交差比率（GMROI）導入＆業務冗長性の構造的改善</h3>
                            <ul className="space-y-2">
                                {[
                                    "利益計算の厳密化（名目表面粗利と実質手残り粗利の分離）：売上原価だけでなく委託販売手数料やECモール手数料を直接変動費として控除した「実質手残り限界利益（MQ）」を厳密に計算。名目粗利と実際の手残り額を併記し、委託手数料控除後の手残り粗利率を正確に可視化",
                                    "原価未設定商品の誤判定（偽のエース選定）を根絶：原価（costPrice）が未登録・0円の商品が「粗利率100%のエース商品」として誤認定されるバグを是正。原価未設定商品は『原価未設定（概算）』バッジを表示し、経営判断のミスリードを完全に防止",
                                    "未確定固定費の免責注記・損益分岐点（BEP）回収進捗の実装：コックピット上部に『固定費は月次固定費管理に基づく概算シミュレーション値であり未確定データを含む』旨の免責注記バッジを明記。当月固定費に対する限界利益の回収進捗率（%）と損益分岐点売上高を自動算出",
                                    "小売業コンサルタント指標「交差比率（GMROI）」マトリクスの導入：売上至上主義の罠（薄利多売・在庫抱え込み）を回避するため、粗利率×商品回転率による交差比率を導入。商品群を『超ドル箱スター（GMROI 200%超）』『高粗利ポテンシャル』『薄利多売集客』『滞留資金圧迫』の4象限で診断",
                                    "過剰在庫・滞留投下資本アラートの強化：滞留品リストに『寝ている投下資金（原価ベース資産額）』および現在の消化ペースに基づく『資金回収予測月数』を表示。売上規模だけでなく投下資本の回転・キャッシュフローを重視した経営判断を支援",
                                    "月次固定費（/fixed-costs）と経費管理（/expenses）の二重計上防止：経費管理画面で固定費連動レコードに『固定費連動』バッジを表示。画面上部に固定費管理へのクイック連携案内を配置し、通常経費での家賃や給与の重複手入力を抑止",
                                    "売上入力（/sales）における帳票売上（納品書・請求書）との二重登録ガード：納品書・請求書を発行済みの取引が売上に自動集計される仕組みを画面上で明確に案内し、店頭POS・日次締めレシート売上との二重入力を防止",
                                    "商品管理（/products）クイックハブの設置：商品管理画面上部に原材料変換・複合生産・在庫管理・仕入管理へ直接1クリックで行き来できるクイックタブナビゲーションを新設し、メニューを行き来する冗長な動線を解消"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.22.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.22.0 - 2026.11.05</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">ページの勝手な自動リロード問題を完全終息・根絶</h3>
                            <ul className="space-y-2">
                                {[
                                    "旧Workbox Service Workerの完全排除（Self-Destruct）：sw.js に self.skipWaiting() を再配備してブラウザに残留していた古いWorkboxを強制退役させ、CacheStorageの完全消去と自己登録解除を実行。古いキャッシュと最新コードの不整合（ChunkLoadError）によるNext.jsの強制location.reload()を根本から阻止",
                                    "第0ミリ秒 同期クリーンアップスクリプトの配置：app/layout.tsx の <head> 最先頭にインラインスクリプトを設置し、ページのハイドレーション開始前に残存Service WorkerとCacheStorageを完全消滅。controllerchange リスナーの無力化によりリロード暴発を徹底封殺",
                                    "/sw.js のキャッシュ完全無効化ヘッダー設定：next.config.ts にて /sw.js に対する Cache-Control: no-store, no-cache, must-revalidate を設定し、最新の自己破壊スクリプトがブラウザやCDNにキャッシュされず即時適用されるよう防護",
                                    "SWR 60秒後の一斉再フェッチ・メインスレッドフリーズ防止：store.ts の swrConfig にて revalidateIfStale: false, shouldRetryOnError: false, dedupingInterval: 300,000 (5分) を適用し、ダッシュボード閲覧中の不要な全コレクション一斉再取得とHMRハートビート切断（Fast Refresh full reload）を完全抑止",
                                    "isLoaded反転による画面全消去（疑似リロード）の防止：app/page.tsx にて初期データが存在する場合は一時的なロード中状態による全コンポーネントアンマウント（チラつき・再描画）を防止し、安定した画面表示を恒久的に維持",
                                    "useAuth() の loading プロパティ未定義参照バグを解消：store.ts での型不整合を解消し、認証ステート評価のチラつきを根絶"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.21.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.21.0 - 2026.11.05</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">エグゼクティブ・コックピットの90日・360日期間拡張と移動平均線トレンド可視化</h3>
                            <ul className="space-y-2">
                                {[
                                    "四半期（90日）および通年（360日）期間選択の追加：店舗別動向・商品別推移の両ビューにおいて、従来の7日・30日に加え、四半期業績や年次繁閑サイクル・季節トレンドを俯瞰できる「直近90日」「通年360日」の幅選択を新設",
                                    "日別売上推移への移動平均線（7日・30日MA）の重畳表示：日々の曜日要因（土日祝の山と平日の谷）による売上ノイズを平滑化する「7日移動平均線」および長期用の「30日移動平均線」を同時描画し、基調トレンドの上昇・下降を一目で把握可能に",
                                    "商品別販売個数グラフへの移動平均線導入：特定商品の販売個数面グラフの上に7日・30日移動平均線を重ねて表示し、日販ペースの勢いと持続性を視覚的に明瞭化",
                                    "長期間表示におけるX軸ラベル表示の自動最適化：360日（月単位間引き）や90日（約2週間間引き）など、データ点数が多い期間でもグラフが重ならず美しく表示されるよう軸インターバルを動的調整",
                                    "コンサルタント戦略分析ビューの90日間分析対応：粗利率・限界利益MQ・客単価・チャネル別ポートフォリオの期間選択に「直近90日」を追加し、中期的視野での経営戦略討議を強力に支援"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.20.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.20.0 - 2026.11.05</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">直近売上推移連動の発注判断・非販売品除外 ＆ 自動リロード根本根絶</h3>
                            <ul className="space-y-2">
                                {[
                                    "自動リロード問題の根本的根絶：next.config.ts から PWA（@ducanh2912/next-pwa）ラッパーを完全撤廃し、Webpack によるクライアント側 sw-entry（reloadOnOnline / controllerchange リスナー）の自動注入を完全に排除",
                                    "安全な Service Worker アンインストーラーの配備：public/sw.js で self.skipWaiting() や clients.claim() を一切呼ばずに登録解除と CacheStorage 全消去を行う安全設計に移行し、ブラウザのコントローラー変化による不意の再読み込みを防止",
                                    "AppLayout でのセッション制御とキャッシュクリア：ブラウザ上に残存する古い Service Worker とキャッシュストレージを初回のみ安全に解除し、毎レンダリングでの不要なアンレジスターAPI呼び出しを抑止",
                                    "全ボタン要素の type=\"button\" 徹底：ダッシュボードおよびコックピット内の全切り替えボタンに明示的な type=\"button\" を指定し、暗黙のフォーム送信（ページ再読み込み）リスクを完全排除",
                                    "直近売上推移（7日 vs 30日）を反映した発注判断：直近7日間で需要が急増している「🚀 急伸（7日加速）」商品と「📉 鈍化（慎重発注）」商品を自動判定し、目標カバー日数を動的調整して欠品防止と過剰在庫抑制を両立",
                                    "販売していない商品（非稼働・休止品）の発注推奨からの完全除外：直近30日間・7日間の販売実績がなく在庫0の休止・非取扱商品を判定し、推奨リストから自動除外（除外件数を画面に明記）。現在実動している重点商品のみに絞り込んだ購買意思決定を実現",
                                    "発注推奨リストのトレンドクイックフィルター新設：「すべて（販売中）」「🚀 急伸」「⚠️ 至急（7日以内）」のワンクリック絞り込みを追加し、定例会議での仕入検討を加速"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.19.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.19.0 - 2026.11.05</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">全社総在庫・店頭配架在庫の統合管理と在庫アラート適正化</h3>
                            <ul className="space-y-2">
                                {[
                                    "全社総在庫（倉庫在庫＋店頭配架在庫）の統合集約：委託店舗への出荷納品で本社倉庫在庫が引き落とされた後も、店頭に実在庫がある場合は「店頭配架在庫」として合算集約し、ダッシュボード上で全品在庫切れと誤認される構造的課題を解消",
                                    "ダッシュボード在庫アラート判定の適正化：本社倉庫単体のみを評価していた従来の判定を「全社総在庫」基準へ刷新。発報しきい値も在庫管理画面と統一（全社総在庫5個以下でアラート）",
                                    "在庫ステータスバッジの細分化（店頭在庫あり・本社要補充）：本社倉庫が0個でも店頭に在庫が存在する場合は、致命的な「在庫切れ」ではなく「店頭在庫あり（本社要補充）」としてアンバー色で明確に区別",
                                    "エグゼクティブ・コックピット（店舗別・商品別）の在庫表示拡充：店舗別推移表では該当店舗の店頭在庫数を正しく表示し、全店選択時は「全社総在庫（倉庫/店頭内訳）」を表示。商品別推移でも店舗別配架内訳ピルを表示",
                                    "発注・仕入判断コックピットの在庫消化日数適正化：販売ペースに対する在庫残日数の計算を全社総在庫ベースに改修し、店頭在庫が豊富にある商品の誤った緊急発注アラートを抑止",
                                    "滞留在庫・発注推奨における拠点別内訳の可視化：仕入判断画面にて、全社総在庫とともに「本社倉庫」「店頭配架計」の内訳を表示し、仕入判断と店間移動判断を同時に行えるよう改善"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.18.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.18.0 - 2026.11.05</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">ダッシュボード自動リロード防止 ＆ 小売業経営コンサルタント戦略分析コックピットを新設</h3>
                            <ul className="space-y-2">
                                {[
                                    "ダッシュボード自動リロード問題の根本解消：PWA Service Workerのキャッシュ競合およびWorkboxクライアントクレームによる予期しないページリロードを完全抑止。全環境でアクティブなService Workerを自動クリーンアップ",
                                    "Amazon同期のセッションスロットリング：ダッシュボード表示時のAmazon自動同期にセッションストレージ制御を導入し、同一セッション内での不要な重複実行・データ更新揺れを防止",
                                    "コンサルタント戦略分析タブの新設：経営陣と現場の定例会向けに、売上高（P×Q）だけでなく「粗利高（限界利益 MQ）」「粗利率（%）」「客単価」「買上点数」「商品単価」を一目で把握できる戦略ビューを追加",
                                    "定例会アジェンダ・具体的提言の自動生成：「利益率改善」「客単価アップ」「集中度・リスク」「チャネル戦略」の4大重要テーマについて、現状の診断と会議で決定すべき具体アクションを緊急度付きで提示",
                                    "販売チャネル別ポートフォリオ：実店舗（直営・委託） vs EC（Amazon等） vs スポット催事の売上構成比と粗利率の対比により、販路ごとの利益貢献度とリソース配分の意思決定を支援",
                                    "店舗別 収益性＆客単価・買上点数マトリクス：全店舗・スポットの売上・粗利・客数・平均客単価・平均買上点数・平均商品単価を一覧表で比較し、売上要因（客数減か客単価減か）を即時切り分け可能に",
                                    "商品別パレート（ABC）分析＆粗利マトリクス：累積売上比率によるA/B/Cランク分類、上位20%商品が占める売上シェアの集中リスク判定、および「高粗利エース商品」と「薄利・原価改善要商品」の自動ラベリング"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.17.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.17.0 - 2026.11.05</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">発注・仕入の意思決定支援コックピットを新設</h3>
                            <ul className="space-y-2">
                                {[
                                    "発注・仕入判断タブの新設：コックピット内に購買意思決定ビューを追加し、欠品リスク・発注残・推奨仕入予算を一画面で確認可能に",
                                    "在庫消化ペース連動の緊急発注推奨リスト：直近30日の日販速度と発注残（入荷待ち数量）を考慮し、適正な推奨発注数と想定仕入金額を自動算出",
                                    "二重発注防止のための入荷待ち（発注残）表示：発注済み・仕入待ちの伝票件数および入荷待ち予定総額を集計し、誤った過剰発注を未然に防止",
                                    "仕入先別・発注ロット集約サマリー：仕入先ごとに発注推奨品目数・総数量・想定仕入金額を集計し、ロット条件の検討と経営陣の予算承認を迅速化",
                                    "過剰・滞留在庫（販売停滞品）アラート：直近30日間販売ゼロの在庫品を特定し、仕入ストップ推奨と在庫資産額を表示してキャッシュフロー悪化を防止",
                                    "仕入管理画面（/purchases）への直通導線：発注が必要な商品を即座に仕入伝票として作成できるようスムーズな業務連携を確保",
                                    "経営陣・現場向けコンサルタント示唆の拡充：直近の緊急発注推奨額や過剰在庫の消化アドバイスを自動ハイライト"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.16.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.16.0 - 2026.11.05</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">定例会向け 売上状況エグゼクティブ・コックピットを新設</h3>
                            <ul className="space-y-2">
                                {[
                                    "経営・現場の定例会向けダッシュボード新設：売上状況エグゼクティブ・コックピットをダッシュボード中央に配置し、会議でひと目で現状を把握可能に",
                                    "店舗別×日次売上推移（直近7日間・30日間）：店舗選択（全店舗または各拠点）と期間切り替えで、日別売上金額の波を即座に可視化",
                                    "店舗内の商品別売上個数の推移グラフ：上位5商品の売上個数をマルチ折れ線グラフで表示し、売れ筋の推移や欠品兆候を直感的に特定",
                                    "商品別売上ランキング＆日販平均表：店舗ごとの商品別売上個数・売上金額・現在庫数・1日あたり平均販売数を一覧表示",
                                    "店舗毎の月別売上推移（過去6ヶ月）：全社売上における店舗別シェアの推移を積み上げ棒グラフで可視化し、前月比成長率バッジを表示",
                                    "商品別×日次販売推移と店舗別シェア：特定商品の日別販売個数・売上金額の推移エリアチャートと、どの店舗で売れているかの内訳シェアを表示",
                                    "現在庫・推定在庫残日数のリアルタイム連動：売れ行きペースに応じた在庫残日数とアラート判定を統合し、定例会での追加発注・補充判断を直結支援",
                                    "経営コンサルタント視点の現状示唆：直近7日売上の前週比モメンタム、最大牽引店舗、売れ筋商品の在庫リスクを自動ハイライト表示"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.15.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.15.0 - 2026.11.02</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">帳票・在庫・入金管理の業務整合性を強化</h3>
                            <ul className="space-y-2">
                                {[
                                    "納品書の下書き保存では在庫を動かさず、発行完了時だけ出庫するよう業務ルールを明確化",
                                    "納品書の発行・編集・削除・復元と在庫・移動履歴を一括保存し、通信失敗による片側だけの更新を防止",
                                    "セット商品の構成変更後も正確に差し戻せるよう、納品書ごとの在庫影響を保存",
                                    "納品書の複製下書きによる二重出庫を解消し、在庫スキップ・取引紐付け等の設定も複製",
                                    "在庫自動出庫導入前の旧納品書を編集しても、過去分が突然在庫へ加算・減算されない互換処理を追加",
                                    "請求残高を超える入金を画面と保存処理の両方で防止",
                                    "請求書を削除・復元した際、関連する入金記録も一括で削除・復元して孤立データを防止",
                                    "合算請求書の選択対象を納品書だけに限定し、誤操作を防止",
                                    "マイナス在庫を商品名・数量付きで目立つよう表示し、棚卸しへ直接移動できる導線を追加"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.14.1 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.14.1 - 2026.11.02</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">仕入数量と在庫反映の整合性を改善</h3>
                            <ul className="space-y-2">
                                {[
                                    "即時仕入・仕入済み・支払済みでは、発注数の変更に入荷数を自動同期して在庫への反映漏れを防止",
                                    "部分入荷では、発注数を減らした場合に入荷数が発注数を超えないよう自動補正",
                                    "ステータス順を「発注済み → 仕入待ち → 部分入荷 → 仕入済み」へ統一し、部分入荷分が誤って差し戻される経路を解消",
                                    "仕入数量同期とステータス遷移の回帰テストを追加"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.14.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.14.0 - 2026.10.30</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">請求書の振込手数料注意書きを選択可能に</h3>
                            <ul className="space-y-2">
                                {[
                                    "請求書作成・編集画面に、振込手数料の注意書きを記載するか選べるチェック項目を追加",
                                    "設定内容を帳票データに保存し、プレビュー・印刷・PDF保存・再ダウンロードへ一貫して反映",
                                    "既存の請求書は従来どおり注意書きを表示し、過去データとの互換性を維持"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.13.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.13.0 - 2026.10.26</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">実行環境と主要依存パッケージの安全性更新</h3>
                            <ul className="space-y-2">
                                {[
                                    "Node.js実行環境を24.22.1 LTSへ統一し、GitHub ActionsもNode.js 24対応版へ更新してローカル・CI・本番の差異を解消",
                                    "Firebase Adminを14.5.0へ更新し、旧依存に含まれていた認証・通信・データ処理ライブラリの脆弱性へ対応",
                                    "Nodemailerを10.2.1へ更新し、メールアドレス解析・外部参照・DoS関連の既知問題へ対応",
                                    "React・React DOMを19.3.1、Firebase Web SDKを12.19.0へ更新",
                                    "Next.js 16.4.3に合わせてESLint設定を統一し、Tailwind CSS・SWR・Recharts等を互換範囲内で更新",
                                    "PWA依存は監査上安全な版へ固定し、サービスワーカー生成と本番ビルドを再検証"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.12.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.12.0 - 2026.10.26</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">入力済み売上の編集機能を改善</h3>
                            <ul className="space-y-2">
                                {[
                                    "実績ログの各売上に、分かりやすい「編集」ボタンを追加",
                                    "入力済み売上の販売店舗・スポット宛先、対象日・対象月、商品ごとの売上個数、販路・送料・手数料・資材費を変更可能",
                                    "店舗や個数を変更した際は、変更前の在庫を差し戻して変更後の在庫だけを差分反映",
                                    "編集中であることと変更可能項目を画面上部に表示し、新規入力との取り違えを防止"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.11.1 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.11.1 - 2026.10.24</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">Node.js 脆弱性対応とランタイム・依存関係セキュリティの強化</h3>
                            <ul className="space-y-2">
                                {[
                                    "Node.js 脆弱性対応（CVE-2026-111497等）：BrotliデコーダーのRCE脆弱性やTLS検証バイパス等の重要セキュリティ勧告に対応した安全なバージョン（v26.12.1 / v22.23.4+）への適合",
                                    "実行エンジンの保護制約：package.json に engines フィールド（node >=22.23.4）を定義し、脆弱なEOLバージョン（Node 20以下）での誤実行を防止",
                                    "CI/CDパイプラインの更新：GitHub Actions ワークフロー（test.yml）の Node.js バージョンを安全な LTS（v22）へ引き上げ",
                                    "バージョン統一ファイルの配備：.nvmrc および .node-version を新規配置し、複数環境間での安全なNode.jsバージョン指定を徹底",
                                    "依存パッケージの脆弱性自動修復：npm audit fix を適用し、Zod・Serialize-JavaScript等の依存パッケージの既知脆弱性を解消"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.11.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.11.0 - 2026.10.23</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">商品・仕入・在庫・売上・取引管理のデータ整合性強化</h3>
                            <ul className="space-y-2">
                                {[
                                    "伝票と在庫を一括保存：仕入・売上・日報補充・販促・在庫変換・商品制作で、途中失敗による片側だけの更新を防止",
                                    "差分更新と二重反映防止：部分入荷や売上編集は変更差分だけを反映し、削除・復元の重複操作では在庫を再増減しないよう改善",
                                    "セット商品履歴の保護：売上登録時の在庫影響を保存し、後からセット構成を変更しても過去売上を正しく差し戻せるよう改善",
                                    "棚卸しの競合防止：完了判定と在庫調整をトランザクション化し、複数端末からの同時完了でも二重計上を防止",
                                    "販売入力のマスター整合：削除済み商品・販売先を新規選択から除外し、卸販売では販売先別の卸請求単価を優先",
                                    "取引先IDの保持：名称変更後も取引先との紐付けが切れないよう、販売先・スポット宛先をIDで保存",
                                    "外部連携の補正：Shopify・Amazon・Square売上の集計値と在庫影響を統一し、削除済み商品の誤連携やSquare再同期時の在庫差異を防止",
                                    "日報補充の二重減算防止：委託販売先だけを本部在庫から店舗在庫へ振り替え、卸・直営では補充と売上の重複減算をしないよう修正"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.10.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.10.0 - 2026.10.23</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">商品・仕入先・販売先別価格設定の統合と誤操作防止</h3>
                            <ul className="space-y-2">
                                {[
                                    "新規商品登録の仕入先固定を解消：先頭業者の自動選択を廃止し、商品画面で仕入先・生産者を必ず確認して選べるよう改善",
                                    "設定ルートの統合：商品別仕入先の重複ページを商品管理へ集約し、仕入先マスター→商品登録→販売先別価格の手順を明示",
                                    "仕入原価の参照元を統一：仕入先側の重複価格編集を廃止し、発注・自動発注も商品マスターの仕入先・仕入原価を使用",
                                    "仕入登録の誤操作防止：新規仕入でも先頭業者を自動選択せず、担当者が仕入先を明示的に確認して選択",
                                    "販売先別価格を一画面化：販売価格と卸請求単価を販売先ごとに並べ、委託販売・卸販売・直営の区分と使用目的を表示",
                                    "手動価格の保護：標準販売価格を変更しても既存の販売先別価格を自動上書きせず、明示的な再計算操作に限定",
                                    "価格計算のテスト追加：未設定価格の補完、明示的な全再計算、削除済み販売先の除外を自動検証"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.9.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.9.0 - 2026.10.16</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">データ集計精度向上・ファイル圧縮最適化・全画面防御ガードの実装</h3>
                            <ul className="space-y-2">
                                {[
                                    "売上予測・消化速度のゴミ箱除外：4週間売上予測および14日間商品消化速度（velocityMap）からゴミ箱レコードを除外し、正確な発注推奨数を算出",
                                    "月次MQ算出の完全整合性：MQ集計（triggerMonthlyMqCalculation）において削除済みの売上・作業ログを集計対象から確実に除外",
                                    "PDF・SVG画像圧縮処理のバイパス：PDF帳票や領収書のアップロード時に不要な画像圧縮処理をスキップし、アップロード処理を高速化・安定化",
                                    "印刷アーカイブのクロスオリジン安全性向上：別オリジンURLプレビュー印刷時のSame-Origin制約エラーを防止し、タイムスタンプソートの不正値耐性を強化",
                                    "帳票・経費・作業ログの例外安全防御：日付プロパティ未定義時における文字列操作（startsWith / localeCompare）クラッシュを全画面で包括的に防止"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.8.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.8.0 - 2026.10.16</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">外部連携・委託在庫・データ整合性の総合改修とUX向上</h3>
                            <ul className="space-y-2">
                                {[
                                    "委託販売店在庫判定の統一：店舗タイプ判定を共通関数に統合し、売上登録や日報補充における委託在庫の不整合を解消",
                                    "Square同期の整合性強化：注文取込時のアトミック増減（increment）およびPush直前の最新在庫再取得による在庫巻き戻りを防止",
                                    "ゴミ箱復元時の取引明細連動：取引（transactions）復元・完全削除時に紐づく取引明細（transaction_items）を自動連動処理",
                                    "欠品予測のセット商品連動：構成品の欠品予測に組み合わせ商品の販売実績を反映し、ダッシュボードおよび自動発注の精度を向上",
                                    "帳票エディタのUX改善：明細編集や内税・外税・税率切り替え時の二重発火と合計金額のチラつきを解消",
                                    "天気予報バッチのJST同期：OpenWeatherMap予報のタイムスタンプ判定をJST基準に統一し、日々の最高・最低気温の取得精度を改善",
                                    "固定費管理の二重送信防止：固定費保存処理中の多重クリック防止ロック（isSaving）およびローディング表示を導入"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.7.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.7.0 - 2026.10.16</div>
                            <h3 className="font-bold text-slate-800 mb-2 underline decoration-blue-200 underline-offset-4 decoration-2">システム全体の不具合分析と安定稼働環境への改善</h3>
                            <ul className="space-y-2">
                                {[
                                    "データ整合性とアトミック更新：Firestoreトランザクションによる在庫・売上の競合防止、棚卸し時のアトミック増減を導入",
                                    "外部連携（Square / Shopify / Amazon）の堅牢化：Square売上削除スコープ適正化、Shopify注文取込・在庫更新順序の改善、Server ActionsのAdmin SDK移行",
                                    "フロントエンドUX保護：Firestoreリアルタイムリスナーによる入力中フォームの意図しない上書き（state wipeout）を防止",
                                    "二重送信防止とクラッシュ隔離：各種登録・保存処理での多重クリック防止ロック（isSaving）導入およびErrorBoundaryによるサイドバー保護",
                                    "メモリリークとリソース解放：OpenCV WASMの輪郭・マトリックスメモリ破棄徹底、BlobプレビューURLの確実な解放",
                                    "テスト・セキュリティルールの拡充：在庫計算ロジックのVitestテストスイート追加、Firestore/Storage未許可操作ルールの修正"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* v1.6.0 */}
                    <div className="relative opacity-60">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
                        <div>
                            <div className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">v1.6.0 - 2026.03.31</div>
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
