"use client";

import { ShoppingCart, Construction } from "lucide-react";

export default function OrdersPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="p-6 bg-slate-50 rounded-full mb-6">
                <ShoppingCart className="w-16 h-16 text-slate-300" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">注文管理</h1>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
                顧客からの注文管理機能は現在準備中です。
                今後のアップデートで追加される予定です。
            </p>
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-100">
                <Construction className="w-4 h-4" />
                近日公開予定
            </div>
        </div>
    );
}
