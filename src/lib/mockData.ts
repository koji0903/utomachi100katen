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

export const mockProducts: Product[] = [
    {
        id: "prod_001",
        name: "宇土の恵み 焼き海苔",
        categoryId: "cat_002",
        supplierId: "sup_001",
        costPrice: 300,
        sellingPrice: 540,
        stock: 120,
        story: "有明海で育った風味豊かな初摘み海苔です。",
        createdAt: "2026-03-01T10:00:00Z",
    },
    {
        id: "prod_002",
        name: "合格祈願 天然塩",
        categoryId: "cat_001",
        supplierId: "sup_002",
        costPrice: 150,
        sellingPrice: 380,
        stock: 50,
        story: "名水百選「轟水源」近くで精製された清めの塩。",
        createdAt: "2026-03-02T14:30:00Z",
    },
    {
        id: "prod_003",
        name: "炙りタコめしの素",
        categoryId: "cat_003",
        supplierId: "sup_003",
        costPrice: 400,
        sellingPrice: 850,
        stock: 30,
        story: "地元のタコを香ばしく炙りました。",
        createdAt: "2026-03-05T09:15:00Z",
    },
];
