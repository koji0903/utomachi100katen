export interface FeatureStatus {
    name: string;
    description: string;
    status: 'completed' | 'ongoing' | 'planned';
}

export interface VersionInfo {
    version: string;
    releaseDate: string;
    description: string;
    features: FeatureStatus[];
}

export const CURRENT_VERSION = "v1.20.0";
export const RELEASE_DATE = "2026.11.05";

export const FEATURE_STATUS_LIST: FeatureStatus[] = [
    {
        name: "直近売上推移連動の発注判断・非販売品除外 ＆ 自動リロード根本根絶",
        description: "発注推奨リストにおいて直近7日・30日の販売推移（急伸・安定・鈍化）を反映した適正発注数を算出。直近販売実績のない非稼働・休止品を自動除外し誤発注を根絶。PWAラッパー完全撤廃と安全なアンインストーラーによりページの予期しない自動リロードを徹底解消。",
        status: "completed"
    },
    {
        name: "全社総在庫・店舗在庫統合と在庫判定の適正化",
        description: "本社倉庫在庫（拠点在庫）だけでなく、各委託店舗への店頭配架在庫を統合した「全社総在庫」を算出。店舗在庫がある場合の誤った欠品・至急発注アラートを解消し、店頭配架内訳の可視化と正確な在庫消化日数を実現。",
        status: "completed"
    },
    {
        name: "小売業コンサルタント戦略分析コックピット",
        description: "経営陣と現場の定例会向け戦略分析。粗利高（限界利益 MQ）・粗利率、客単価・買上点数・商品単価の分解、パレート分析（ABCランク・売れ筋集中リスク）、チャネル別ポートフォリオ、および具体的アクション提言の自動生成。",
        status: "completed"
    },
    {
        name: "ダッシュボード安定化・自動リロード抑制",
        description: "Service Workerの不要なキャッシュハイジャックやチャンク不整合による意図しない自動リロードを完全抑止。Amazon自動同期のセッションスロットリングと連動し、安定した画面閲覧環境を提供。",
        status: "completed"
    },
    {
        name: "基本的な売上・日次記録",
        description: "日次・月次売上の入力、入力済み売上の店舗・日付・商品個数・費用編集、天気情報の自動取得、業務日報の作成機能。",
        status: "completed"
    },
    {
        name: "高度な在庫管理",
        description: "ブランド別の商品管理、セット商品の構成連動欠品予測、委託店舗在庫の完全同期機能。",
        status: "completed"
    },
    {
        name: "発注・仕入れ管理",
        description: "仕入先マスター、商品ごとの仕入先・生産者設定、発注書作成、欠品予測からの自動発注生成、およびコックピットでの発注判断・過剰在庫警告機能。",
        status: "completed"
    },
    {
        name: "商品・販売先別価格管理",
        description: "商品登録時の明示的な仕入先選択、標準価格、販売先別の販売価格・卸請求単価を一画面で安全に設定する機能。",
        status: "completed"
    },
    {
        name: "帳票アーカイブ",
        description: "見積書、納品書、請求書等のPDF発行、請求書注意書きの表示選択、納品書発行と在庫の一括更新、および過去データの蓄積機能。",
        status: "completed"
    },
    {
        name: "売上分析ダッシュボード",
        description: "経営陣・現場合同定例会用の売上状況エグゼクティブ・コックピット。店舗別直近7日・30日の日別売上推移、商品別売上個数の推移、店舗別月次推移、商品別販売シェアの即時可視化機能。",
        status: "completed"
    },
    {
        name: "課題・ToDo管理",
        description: "カンバン形式でのタスク・課題管理機能（レイアウト改善済）。",
        status: "completed"
    },
    {
        name: "自動レポート・通知機能",
        description: "特定の条件下でのメールやチャットへの自動報告機能。",
        status: "completed"
    },
    {
        name: "月次売上レポート",
        description: "対象月ごとの店舗別・商品別売上集計およびPDF出力機能。",
        status: "completed"
    },
    {
        name: "Amazon 販売連携",
        description: "Amazon SP-API と連携した在庫同期および注文データの自動取り込み機能。",
        status: "completed"
    },
    {
        name: "AI支出・経費管理",
        description: "Gemini AIによるレシート解析。画像・PDFプレビューおよび編集・検索機能。",
        status: "completed"
    },
    {
        name: "高信頼性・データ整合性基盤",
        description: "仕入・売上・日報・納品書・棚卸し・在庫変換・商品制作の伝票と在庫を一括更新し、下書き・複製時の二重出庫や過入金を含む不整合を防止する基盤。",
        status: "completed"
    },
    {
        name: "セキュリティ・脆弱性対策",
        description: "Node.js 24 LTSへの実行環境統一、GitHub Actions実行基盤・Firebase Admin・Nodemailer・React等の更新、依存関係監査と継続的な脆弱性対策。",
        status: "completed"
    }
];
