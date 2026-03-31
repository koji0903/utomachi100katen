// src/lib/types/expense.ts
import { BaseEntity } from "../store";

export type ExpenseCategory = 
    | '備品' 
    | '消耗品' 
    | '飲食費' 
    | '交通費' 
    | '通信費' 
    | '光熱費' 
    | '広告宣伝費' 
    | '支払手数料' 
    | 'その他';

export type PaymentMethod = 'クレジット' | '小口現金';

export interface Expense extends BaseEntity {
    id: string;
    date: string;          // YYYY-MM-DD
    category: ExpenseCategory;
    paymentMethod: PaymentMethod;
    item: string;          // 品目・内容
    amount: number;        // 金額
    vendor?: string;       // 購入先（店舗名など）
    fileUrl?: string;      // 領収書・レシートのURL
    storagePath?: string;  // Storage上のパス
    memo?: string;         // メモ
    isAnalyzed: boolean;   // AI分析済みか
    isConfirmed: boolean;  // 人間が確認済みか
    createdAt: any;
    updatedAt: any;
}
