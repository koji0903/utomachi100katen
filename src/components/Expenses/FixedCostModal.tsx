// src/components/Expenses/FixedCostModal.tsx
"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Plus, Trash2, Loader2, Save, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { ExpenseCategory, PaymentMethod } from "@/lib/types/expense";
import { showNotification } from "@/lib/notifications";

interface FixedCostModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultPeriod: string; // YYYY-MM
}

interface FixedCostItem {
    id: string;
    enabled: boolean;
    category: ExpenseCategory;
    item: string;
    amount: number;
    paymentMethod: PaymentMethod;
    vendor: string;
}

const INITIAL_TEMPLATES: FixedCostItem[] = [
    {
        id: "rent",
        enabled: true,
        category: "地代家賃",
        item: "店舗・倉庫家賃",
        amount: 150000,
        paymentMethod: "銀行振込",
        vendor: "不動産管理会社"
    },
    {
        id: "payroll",
        enabled: true,
        category: "給与・手当",
        item: "店舗スタッフ給与・手当",
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
    }
];

export function FixedCostModal({ isOpen, onClose, defaultPeriod }: FixedCostModalProps) {
    const { addExpense, companySettings } = useStore();
    const [period, setPeriod] = useState(defaultPeriod);
    const [items, setItems] = useState<FixedCostItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Sync templates dynamically from global settings doc on mount / open
    useEffect(() => {
        if (isOpen) {
            const templates = companySettings?.fixedCostTemplates && companySettings.fixedCostTemplates.length > 0
                ? companySettings.fixedCostTemplates
                : INITIAL_TEMPLATES;
            setItems(templates);
        }
    }, [isOpen, companySettings]);

    if (!isOpen) return null;

    const handleToggleItem = (id: string) => {
        setItems(items.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item));
    };

    const handleUpdateField = (id: string, field: keyof FixedCostItem, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleAddCustomRow = () => {
        const newId = `custom_${Date.now()}`;
        const newItem: FixedCostItem = {
            id: newId,
            enabled: true,
            category: "その他",
            item: "新規固定費項目",
            amount: 10000,
            paymentMethod: "銀行振込",
            vendor: "支払先名"
        };
        setItems([...items, newItem]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const activeItems = items.filter(item => item.enabled);

        if (activeItems.length === 0) {
            showNotification("登録する固定費項目にチェックを入れてください。");
            return;
        }

        setIsSaving(true);
        try {
            // Register all active items
            // Date is set to the 1st day of the selected period (e.g. YYYY-MM-01)
            const targetDate = `${period}-01`;

            for (const item of activeItems) {
                await addExpense({
                    date: targetDate,
                    category: item.category,
                    paymentMethod: item.paymentMethod,
                    item: item.item,
                    amount: item.amount,
                    vendor: item.vendor,
                    isAnalyzed: false,
                    isConfirmed: true, // Auto-confirm since it's manual template
                    memo: "固定費テンプレートから一括自動登録"
                });
            }

            showNotification(`${activeItems.length}件の固定費を ${period} 月分として一括登録しました。`);
            onClose();
        } catch (error) {
            console.error(error);
            showNotification("固定費の一括登録に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <span className="p-2 bg-rose-50 rounded-xl text-rose-600">
                                <Sparkles className="w-5 h-5 animate-pulse" />
                            </span>
                            固定費テンプレートを一括追加
                        </h2>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">Bulk Overhead Templates with Live Editing</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold text-slate-500">対象月:</span>
                            <input 
                                type="month"
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500"
                            />
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/20">
                                <th className="pb-4 pl-4 w-12 text-center">有効</th>
                                <th className="pb-4 w-40">カテゴリー</th>
                                <th className="pb-4">品目・内容</th>
                                <th className="pb-4 w-48">購入先 / 支払先</th>
                                <th className="pb-4 w-44">支払方法</th>
                                <th className="pb-4 w-36 text-right pr-4">金額 (円)</th>
                                <th className="pb-4 w-12 text-center pr-4">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {items.map((item) => (
                                <tr key={item.id} className={`group hover:bg-slate-50/50 transition-colors ${!item.enabled ? 'opacity-40 grayscale' : ''}`}>
                                    {/* Checkbox */}
                                    <td className="py-4 pl-4 text-center">
                                        <input 
                                            type="checkbox"
                                            checked={item.enabled}
                                            onChange={() => handleToggleItem(item.id)}
                                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500/10 border-slate-300"
                                        />
                                    </td>
                                    {/* Category Select */}
                                    <td className="py-4">
                                        <select
                                            disabled={!item.enabled}
                                            value={item.category}
                                            onChange={(e) => handleUpdateField(item.id, "category", e.target.value as ExpenseCategory)}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-500 transition-colors"
                                        >
                                            {([
                                                '地代家賃', '給与・手当', '外注費', '水道光熱費', '諸会費・サブスク',
                                                '備品', '消耗品', '飲食費', '交通費', '通信費', '広告宣伝費', '支払手数料', 'その他'
                                            ] as ExpenseCategory[]).map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </td>
                                    {/* Item Input */}
                                    <td className="py-4">
                                        <input 
                                            type="text"
                                            disabled={!item.enabled}
                                            value={item.item}
                                            onChange={(e) => handleUpdateField(item.id, "item", e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500"
                                        />
                                    </td>
                                    {/* Vendor Input */}
                                    <td className="py-4">
                                        <input 
                                            type="text"
                                            disabled={!item.enabled}
                                            value={item.vendor}
                                            onChange={(e) => handleUpdateField(item.id, "vendor", e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500"
                                        />
                                    </td>
                                    {/* Payment Method Select */}
                                    <td className="py-4">
                                        <select
                                            disabled={!item.enabled}
                                            value={item.paymentMethod}
                                            onChange={(e) => handleUpdateField(item.id, "paymentMethod", e.target.value as PaymentMethod)}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-500 transition-colors"
                                        >
                                            {(['銀行振込', 'クレジット', '小口現金'] as PaymentMethod[]).map(pm => (
                                                <option key={pm} value={pm}>{pm}</option>
                                            ))}
                                        </select>
                                    </td>
                                    {/* Amount Input */}
                                    <td className="py-4 text-right pr-4">
                                        <div className="relative inline-block w-full">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">¥</span>
                                            <input 
                                                type="number"
                                                disabled={!item.enabled}
                                                value={item.amount || ""}
                                                onChange={(e) => handleUpdateField(item.id, "amount", Number(e.target.value))}
                                                className="w-full bg-slate-900 border-none rounded-xl pl-6 pr-3 py-2 text-right text-xs font-mono font-black text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                            />
                                        </div>
                                    </td>
                                    {/* Delete custom row */}
                                    <td className="py-4 text-center pr-4">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="text-slate-300 hover:text-rose-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <button
                        type="button"
                        onClick={handleAddCustomRow}
                        className="mt-6 flex items-center gap-2 px-5 py-3 border border-dashed border-slate-200 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50/20 hover:border-rose-200 transition-all font-black text-xs group"
                    >
                        <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                        行を追加する
                    </button>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs font-bold text-slate-400">
                        有効な項目: {items.filter(item => item.enabled).length} 件 / 一括登録金額: <span className="text-sm font-black text-slate-700">¥{items.filter(item => item.enabled).reduce((sum, item) => sum + item.amount, 0).toLocaleString()}</span>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-initial px-6 py-3.5 border border-slate-200 text-slate-500 font-black text-sm rounded-xl hover:bg-slate-50 transition-all"
                        >
                            閉じる
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSaving}
                            className="flex-[2] sm:flex-initial px-8 py-3.5 bg-rose-600 text-white font-black text-sm rounded-xl shadow-xl shadow-rose-100 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>一括登録中...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>固定費を一括追加</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
