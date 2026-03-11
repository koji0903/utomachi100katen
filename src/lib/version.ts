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

export const CURRENT_VERSION = "v1.2.1";
export const RELEASE_DATE = "2026.03.12";

export const FEATURE_STATUS_LIST: FeatureStatus[] = [
    {
        name: "基本的な売上・日次記録",
        description: "日次売上の入力、天気情報の自動取得、業務日報の作成機能。",
        status: "completed"
    },
    {
        name: "高度な在庫管理",
        description: "ブランド別の商品管理、欠品予測、セット商品の構成・在庫連動機能。",
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
        status: "ongoing"
    },
    {
        name: "課題・ToDo管理",
        description: "カンバン形式でのタスク・課題管理機能（レイアウト改善済）。",
        status: "completed"
    },
    {
        name: "自動レポート・通知機能",
        description: "特定の条件下でのメールやチャットへの自動報告機能。",
        status: "planned"
    }
];
