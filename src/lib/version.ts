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

export const CURRENT_VERSION = "v1.9.0";
export const RELEASE_DATE = "2026.10.16";

export const FEATURE_STATUS_LIST: FeatureStatus[] = [
    {
        name: "基本的な売上・日次記録",
        description: "日次売上の入力、天気情報の自動取得、業務日報の作成機能。",
        status: "completed"
    },
    {
        name: "高度な在庫管理",
        description: "ブランド別の商品管理、セット商品の構成連動欠品予測、委託店舗在庫の完全同期機能。",
        status: "completed"
    },
    {
        name: "発注・仕入れ管理",
        description: "仕入先管理、発注書作成、欠品予測からの自動発注生成機能。",
        status: "completed"
    },
    {
        name: "帳票アーカイブ",
        description: "納品書、請求書等のPDF発行および過去データの蓄積機能。",
        status: "completed"
    },
    {
        name: "売上分析ダッシュボード",
        description: "店舗別・曜日別の売上推移、利益率の可視化機能。",
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
        description: "アトミック在庫更新、ゴミ箱除外集計、PDF/画像圧縮バイパス、全画面防御ガードによる例外安全稼働環境の確立。",
        status: "completed"
    }
];
