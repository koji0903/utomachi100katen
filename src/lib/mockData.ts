// src/lib/mockData.ts

export interface Category {
    id: string;
    name: string;
}

export interface Supplier {
    id: string;
    name: string;
    contact?: string;
}

export interface Product {
    id: string;
    name: string;
    categoryId: string;
    supplierId: string;
    costPrice: number;
    sellingPrice: number;
    stock: number;
    story?: string;
    createdAt: string;
}

export const mockCategories: Category[] = [
    { id: "cat_001", name: "おいのり" },
    { id: "cat_002", name: "のりでノリノリ" },
    { id: "cat_003", name: "ABURI" },
    { id: "cat_004", name: "その他" },
];

export const mockSuppliers: Supplier[] = [
    { id: "sup_001", name: "網田漁協", contact: "0964-xx-xxxx" },
    { id: "sup_002", name: "轟泉自然工房", contact: "0964-yy-yyyy" },
    { id: "sup_003", name: "宇土マリーナ", contact: "0964-zz-zzzz" },
];

export const mockBrands = [
    { id: "brand_001", name: "宇土マチブランド" },
    { id: "brand_002", name: "網田ネーブル" },
];

export const mockRetailStores = [
    { id: "store_001", name: "宇土マリーナ おみやげ館", type: "A", address: "宇土市下網田町" },
    { id: "store_002", name: "道の駅 宇土マリーナ", type: "B", address: "宇土市下網田町" },
];

export const mockProducts: any[] = [
    {
        id: "prod_001",
        name: "宇土の恵み 焼き海苔",
        categoryId: "cat_002",
        supplierId: "sup_001",
        brandId: "brand_001",
        costPrice: 300,
        sellingPrice: 540,
        stock: 120,
        story: "有明海で育った風味豊かな初摘み海苔です。",
        createdAt: "2026-03-01T10:00:00Z",
        // MQ Fields
        standardSellingPrice: 540,
        standardVariableCost: 300,
        standardMq: 240,
        standardMqRate: 44.4,
        standardWorkMinutes: 10,
        mqPerHour: 1440,
        productCategory: "加工品",
        producerId: "sup_001",
        isMqTarget: true,
    },
    {
        id: "prod_002",
        name: "合格祈願 天然塩",
        categoryId: "cat_001",
        supplierId: "sup_002",
        brandId: "brand_001",
        costPrice: 150,
        sellingPrice: 380,
        stock: 50,
        story: "名水百選「轟水源」近くで精製された清めの塩。",
        createdAt: "2026-03-02T14:30:00Z",
        // MQ Fields
        standardSellingPrice: 380,
        standardVariableCost: 150,
        standardMq: 230,
        standardMqRate: 60.5,
        standardWorkMinutes: 5,
        mqPerHour: 2760,
        productCategory: "特産品",
        producerId: "sup_002",
        isMqTarget: true,
    },
    {
        id: "prod_003",
        name: "炙りタコめしの素",
        categoryId: "cat_003",
        supplierId: "sup_003",
        brandId: "brand_002",
        costPrice: 400,
        sellingPrice: 850,
        stock: 30,
        story: "地元のタコを香ばしく炙りました。",
        createdAt: "2026-03-05T09:15:00Z",
        // MQ Fields
        standardSellingPrice: 850,
        standardVariableCost: 400,
        standardMq: 450,
        standardMqRate: 52.9,
        standardWorkMinutes: 15,
        mqPerHour: 1800,
        productCategory: "加工品",
        producerId: "sup_003",
        isMqTarget: true,
    },
];

export const mockSales = [
    {
        id: "sale_001",
        storeId: "store_001",
        period: "2026-03-20",
        totalAmount: 1500,
        items: [{ productId: "prod_001", quantity: 2, subtotal: 1080 }],
    }
];

export const mockWorkLogs: any[] = [
    {
        id: "work_001",
        workDate: "2026-05-18",
        workType: "製造",
        relatedProductId: "prod_001",
        workMinutes: 120,
        workerName: "田中 太郎",
        workMemo: "焼き海苔のカットと袋詰め作業を行います。",
        estimatedLaborCost: 2400,
        mqPerWorkHour: 4800,
        createdAt: "2026-05-18T10:00:00Z"
    },
    {
        id: "work_002",
        workDate: "2026-05-18",
        workType: "包装",
        relatedProductId: "prod_002",
        workMinutes: 60,
        workerName: "山田 花子",
        workMemo: "天然塩の小分け袋詰めおよび合格祈願シールの貼り付け作業。",
        estimatedLaborCost: 1200,
        mqPerWorkHour: 13800,
        createdAt: "2026-05-18T11:30:00Z"
    },
    {
        id: "work_003",
        workDate: "2026-05-19",
        workType: "ラベル貼り",
        relatedProductId: "prod_003",
        workMinutes: 90,
        workerName: "佐藤 次郎",
        workMemo: "炙りタコめしの素のレトルトパウチ外装箱組み立てとラベル貼付。",
        estimatedLaborCost: 1800,
        mqPerWorkHour: 9000,
        createdAt: "2026-05-19T09:00:00Z"
    }
];

export const mockFixedCosts: any[] = [
    {
        id: "2026-05",
        targetMonth: "2026-05",
        rentCost: 150000,
        laborCost: 385000,
        utilityCost: 28000,
        communicationCost: 0,
        vehicleCost: 0,
        softwareCost: 12800,
        otherFixedCost: 20000,
        totalFixedCost: 595800,
        items: [
            {
                id: "rent",
                enabled: true,
                category: "地代家賃",
                item: "店舗・倉庫家賃",
                amount: 150000,
                paymentMethod: "銀行振込",
                vendor: "UTOMESHI株式会社"
            },
            {
                id: "payroll",
                enabled: true,
                category: "給与・手当",
                item: "店舗スタッフ給料・手当",
                amount: 300000,
                paymentMethod: "銀行振込",
                vendor: "従業員一同"
            },
            {
                id: "outsourcing",
                enabled: true,
                category: "外注費",
                item: "配送・ロジスティクス委託費",
                amount: 85000,
                paymentMethod: "銀行振込",
                vendor: "ヤマト運輸・佐川急便"
            },
            {
                id: "utilities",
                enabled: true,
                category: "水道光熱費",
                item: "店舗電気・ガス・水道代（概算）",
                amount: 28000,
                paymentMethod: "クレジット",
                vendor: "東京電力・東京ガス"
            },
            {
                id: "subscription",
                enabled: true,
                category: "諸会費・サブスク",
                item: "POSレジ・会計・在庫システム月額",
                amount: 12800,
                paymentMethod: "クレジット",
                vendor: "スマレジ・MFクラウド"
            },
            {
                id: "other_advisory",
                enabled: true,
                category: "その他",
                item: "税理士・会計士顧問料",
                amount: 10000,
                paymentMethod: "銀行振込",
                vendor: "支払先名"
            },
            {
                id: "other_misc",
                enabled: true,
                category: "その他2",
                item: "その他固定費項目",
                amount: 10000,
                paymentMethod: "銀行振込",
                vendor: "支払先名"
            }
        ],
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-01T00:00:00Z"
    }
];

export const mockMqSummaries: any[] = [
    {
        id: "2026-05",
        targetMonth: "2026-05",
        totalSales: 1250000,
        totalVariableCost: 520000,
        totalMq: 730000,
        averageMqRate: 58.4,
        totalFixedCost: 595800,
        operatingProfit: 134200,
        totalWorkMinutes: 270,
        mqPerHour: 162222,
        productSummaries: [
            {
                productId: "prod_001",
                productName: "宇土の恵み 焼き海苔",
                salesVolume: 800,
                salesAmount: 432000,
                variableCostAmount: 240000,
                mqAmount: 192000,
                mqRate: 44.4,
                workMinutes: 120,
                mqPerHour: 96000
            },
            {
                productId: "prod_002",
                productName: "合格祈願 天然塩",
                salesVolume: 1200,
                salesAmount: 456000,
                variableCostAmount: 180000,
                mqAmount: 276000,
                mqRate: 60.5,
                workMinutes: 60,
                mqPerHour: 276000
            },
            {
                productId: "prod_003",
                productName: "炙りタコめしの素",
                salesVolume: 425,
                salesAmount: 362000,
                variableCostAmount: 100000,
                mqAmount: 262000,
                mqRate: 72.4,
                workMinutes: 90,
                mqPerHour: 174667
            }
        ],
        channelSummaries: [
            {
                channelName: "道の駅 宇土マリーナ",
                salesAmount: 550000,
                variableCostAmount: 250000,
                mqAmount: 300000,
                mqRate: 54.5
            },
            {
                channelName: "ECサイト",
                salesAmount: 480000,
                variableCostAmount: 170000,
                mqAmount: 310000,
                mqRate: 64.6
            },
            {
                channelName: "ふるさと納税",
                salesAmount: 220000,
                variableCostAmount: 100000,
                mqAmount: 120000,
                mqRate: 54.5
            }
        ],
        customerSummaries: [
            {
                customerId: "cust_001",
                customerName: "一般消費者",
                salesAmount: 1030000,
                variableCostAmount: 420000,
                mqAmount: 610000,
                mqRate: 59.2
            },
            {
                customerId: "cust_002",
                customerName: "宇土物産商事(株)",
                salesAmount: 220000,
                variableCostAmount: 100000,
                mqAmount: 120000,
                mqRate: 54.5
            }
        ],
        createdAt: "2026-05-19T00:00:00Z",
        updatedAt: "2026-05-19T00:00:00Z"
    }
];

export const mockBusinessManuals = [
    {
        id: "manual_001",
        title: "支出・経費管理マニュアル",
        category: "経費管理",
        order: 1,
        content: `# 支出・経費管理マニュアル

このマニュアルでは、ウトマチ百貨店における日々の経費入力、固定費の一括登録、および領収書のスキャン手順について説明します。
正確な経費入力を行うことで、経営分析ダッシュボードの「営業経費」および「最終純利益（営業利益）」が自動計算され、Gemini AIから高精度な財務アドバイスを得ることができます。

---

## 📌 経費登録の3つの方法

### 1. 毎月の固定費を一括登録する（推奨 💡）
家賃や給与、サブスクなど、毎月決まって発生する固定費はテンプレートから一括登録できます。

- **操作手順**:
  1. メニューから **「支出・経費管理」** 画面を開きます。
  2. 画面右上にある薄いピンク色の **「➕ 固定費を一括登録」** ボタンをクリックします。
  3. テンプレート一覧（地代家賃、人件費、サブスク、概算光熱費など）が表示されます。
  4. 金額や適用日を個別に編集し、不要なもののチェックを外します。
  5. 最下部の **「固定費を一括登録」** ボタンを押して完了します。

### 2. レシート・領収書をAIスキャンで個別登録する（AI OCR 📸）
日々の買い出しや備品購入などのレシートは、画像から自動解析して登録できます。

- **操作手順**:
  1. メニューから **「支出・経費管理」** 画面を開きます。
  2. 画面右上にある黒い **「📅 記録を追加」** ボタンをクリックします。
  3. レシートや領収書の写真（JPEG/PNGなど）をドラッグ＆ドロップまたは選択してアップロードします。
  4. **Gemini AI** が自動的に「日付」「金額」「カテゴリー」「支払先」をスキャンしてフォームに入力します。
  5. 内容を確認・微調整し、支払方法を選択して **「追加する」** ボタンをクリックします。

### 3. 小口現面の補充と移管管理（手許金のインアウト 🏦）
オフィスの金庫にある小口現金の補充や銀行への移管フローです。

- **小口現金の補充**:
  - 銀行から現金を引き出して補充した際、**「➕ 現金を補充する」** ボタンから金額と補充元銀行を入力して登録します。
- **銀行への預け入れ（移管）**:
  - 小口現金を銀行口座へ預け入れた際、**「↗️ 銀行へ移管」** ボタンから金額と移管先銀行を入力して登録します。
  - ※これらの補充や移管は、営業経費（コスト）からは正しく除外され、純利益計算を歪めることなく「手許の小口現金残金」のみを正確に連動させます。

---

## 🔍 入力後のデータ連携と経営活用

登録した経費データは、システム全体にリアルタイムで反映されます。

1. **店舗・事業分析 (Analytics)**:
   - KPIカードに「営業経費」と「最終純利益」が表示され、収支状況が一瞬でわかります。
   - 経費カテゴリー別の円グラフで、何にコストが多く使われているか（比率）を確認できます。
   - 滝のように流れる **損益計算書 (P&L)** で月次の財務状況を詳細に確認できます。
2. **Gemini AI 財務レポート**:
   - 損益分岐点（BEP）や、カテゴリー別のコスト削減案について、プロのCFO視点のアドバイスレポートが出力されます。`,
        createdAt: "2026-05-18T10:00:00Z",
        updatedAt: "2026-05-18T10:00:00Z",
        attachedDocumentIds: [],
        links: []
    }
];

export const getMockData = (collectionName: string): any[] => {
    switch (collectionName) {
        case "brands": return mockBrands;
        case "suppliers": return mockSuppliers;
        case "products": return mockProducts;
        case "retailStores": return mockRetailStores;
        case "sales": return mockSales;
        case "workLogs": return mockWorkLogs;
        case "fixedCosts": return mockFixedCosts;
        case "mqSummaries": return mockMqSummaries;
        case "business_manuals": return mockBusinessManuals;
        default: return [];
    }
};
