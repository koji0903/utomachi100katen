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
                    {/* v1.14.0 */}
                    <div className="relative">
                        <div className="absolute -left-[2.15rem] top-1.5 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-sm ring-4 ring-blue-50" />
                        <div>
                            <div className="text-xs font-black text-blue-600 mb-1 uppercase tracking-wider">{CURRENT_VERSION} - {RELEASE_DATE}</div>
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
