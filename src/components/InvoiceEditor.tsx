"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Search, Percent, Calculator, ChevronRight } from "lucide-react";
import { useStore, Product, InvoiceItem, InvoiceAdjustment } from "@/lib/store";
import { NumberInput } from "@/components/NumberInput";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";

interface InvoiceEditorProps {
    items: InvoiceItem[];
    adjustments: InvoiceAdjustment[];
    taxRate: 8 | 10;
    taxType?: 'inclusive' | 'exclusive';
    finalAdjustment?: number;
    onChange: (data: { items: InvoiceItem[]; adjustments: InvoiceAdjustment[]; taxRate: 8 | 10; taxType: 'inclusive' | 'exclusive'; totalAmount: number; finalAdjustment?: number }) => void;
}

export function InvoiceEditor({ items, adjustments, taxRate, taxType = 'inclusive', onChange, finalAdjustment = 0 }: InvoiceEditorProps) {
    const { products } = useStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [showProductSearch, setShowProductSearch] = useState(false);

    // Filtering products for search
    const filteredProducts = useMemo(() => {
        const q = searchQuery.toLowerCase();
        if (!q) return products;
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.variantName?.toLowerCase().includes(q)
        );
    }, [products, searchQuery]);

    // Calculation Logic
    const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.subtotal, 0), [items]);
    const taxAmount = taxType === 'inclusive' 
        ? Math.floor(subtotal - (subtotal / (1 + taxRate / 100))) 
        : Math.floor(subtotal * (taxRate / 100));
    const adjustmentsTotal = useMemo(() => adjustments.reduce((sum, adj) => sum + adj.amount, 0), [adjustments]);
    const grandTotal = taxType === 'inclusive' 
        ? subtotal + adjustmentsTotal 
        : subtotal + taxAmount + adjustmentsTotal;

    // Trigger onChange when something changes
    useEffect(() => {
        onChange({ items, adjustments, taxRate, taxType, totalAmount: grandTotal + finalAdjustment, finalAdjustment });
    }, [items, adjustments, taxRate, taxType, grandTotal, finalAdjustment]);

    // Handlers
    const addItem = (product?: Product) => {
        const productUnitPrice = product?.sellingPrice ?? 0;
        let unitPrice = productUnitPrice;

        if (taxType === 'exclusive' && productUnitPrice > 0) {
            const pTaxRate = product?.taxRate === 'reduced' ? 8 : 10;
            unitPrice = Math.round(productUnitPrice / (1 + pTaxRate / 100));
        }

        const newItem: InvoiceItem = {
            id: crypto.randomUUID(),
            productId: product?.id,
            label: product ? `${product.name}${product.variantName ? ` (${product.variantName})` : ""}` : "新しい項目",
            quantity: 1,
            unitPrice: unitPrice,
            subtotal: unitPrice
        };
        onChange({ items: [...items, newItem], adjustments, taxRate, taxType, totalAmount: grandTotal, finalAdjustment });
    };

    const updateItem = (id: string, updates: Partial<InvoiceItem>) => {
        const newItems = items.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, ...updates };
            // Auto subtotal
            updated.subtotal = updated.quantity * updated.unitPrice;
            return updated;
        });
        onChange({ items: newItems, adjustments, taxRate, taxType, totalAmount: grandTotal, finalAdjustment });
    };

    const removeItem = (id: string) => {
        onChange({ items: items.filter(i => i.id !== id), adjustments, taxRate, taxType, totalAmount: grandTotal, finalAdjustment });
    };

    const addAdjustment = () => {
        const newAdj: InvoiceAdjustment = {
            id: crypto.randomUUID(),
            label: "値引き",
            amount: 0
        };
        onChange({ items, adjustments: [...adjustments, newAdj], taxRate, taxType, totalAmount: grandTotal, finalAdjustment });
    };

    const updateAdjustment = (id: string, updates: Partial<InvoiceAdjustment>) => {
        const newAdjs = adjustments.map(adj => adj.id === id ? { ...adj, ...updates } : adj);
        onChange({ items, adjustments: newAdjs, taxRate, taxType, totalAmount: grandTotal, finalAdjustment });
    };

    const removeAdjustment = (id: string) => {
        onChange({ items, adjustments: adjustments.filter(a => a.id !== id), taxRate, taxType, totalAmount: grandTotal, finalAdjustment });
    };

    return (
        <div className="space-y-6">
            {/* Header / Tax Rate */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Calculator className="w-4 h-4" style={{ color: BRAND }} />
                    明細編集
                </h3>
                <div className="flex gap-4">
                    <div className="flex p-1 bg-slate-100 rounded-lg">
                        <button
                            onClick={() => onChange({ items, adjustments, taxRate, taxType: 'inclusive', totalAmount: grandTotal, finalAdjustment })}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${taxType === 'inclusive' ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}
                        >
                            内税
                        </button>
                        <button
                            onClick={() => onChange({ items, adjustments, taxRate, taxType: 'exclusive', totalAmount: grandTotal, finalAdjustment })}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${taxType === 'exclusive' ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}
                        >
                            外税
                        </button>
                    </div>
                    <div className="flex p-1 bg-slate-100 rounded-lg">
                        {[8, 10].map(rate => (
                            <button
                                key={rate}
                                onClick={() => onChange({ items, adjustments, taxRate: rate as 8 | 10, taxType, totalAmount: grandTotal, finalAdjustment })}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${taxRate === rate ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}
                            >
                                {rate}%
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="px-2 py-3 text-left">内容 / 商品名</th>
                            <th className="px-2 py-3 text-right w-24">単価</th>
                            <th className="px-2 py-3 text-right w-20">個数</th>
                            <th className="px-2 py-3 text-right w-28">小計</th>
                            <th className="px-2 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {items.map((item) => (
                            <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="py-2 px-2">
                                    <input
                                        type="text"
                                        value={item.label}
                                        onChange={e => updateItem(item.id, { label: e.target.value })}
                                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-slate-700 placeholder:text-slate-300"
                                        placeholder="項目名を入力..."
                                    />
                                </td>
                                <td className="py-2 px-2 text-right">
                                    <NumberInput
                                        value={item.unitPrice}
                                        onChange={val => updateItem(item.id, { unitPrice: val ?? 0 })}
                                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-right text-sm font-mono font-medium text-slate-700"
                                    />
                                </td>
                                <td className="py-2 px-2 text-right">
                                    <NumberInput
                                        value={item.quantity}
                                        onChange={val => updateItem(item.id, { quantity: val ?? 1 })}
                                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-right text-sm font-mono font-medium text-slate-700"
                                    />
                                </td>
                                <td className="py-2 px-2 text-right">
                                    <span className="font-mono text-slate-900 font-bold">¥{item.subtotal.toLocaleString()}</span>
                                </td>
                                <td className="py-2 px-2 text-center">
                                    <button onClick={() => removeItem(item.id)} className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <button
                        onClick={() => setShowProductSearch(!showProductSearch)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-slate-300 hover:text-slate-500 transition-all"
                    >
                        <Search className="w-3.5 h-3.5" />
                        商品マスターから追加
                    </button>

                    {showProductSearch && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-2 max-h-64 overflow-y-auto">
                            <input
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="商品名で検索..."
                                className="w-full px-3 py-2 text-xs border border-slate-100 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-rose-100"
                            />
                            {filteredProducts.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        addItem(p);
                                        setShowProductSearch(false);
                                        setSearchQuery("");
                                    }}
                                    className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-left"
                                >
                                    <div>
                                        <div className="text-xs font-bold text-slate-800">{p.name}</div>
                                        <div className="text-[10px] text-slate-400">{p.variantName}</div>
                                    </div>
                                    <div className="text-xs font-mono font-bold text-slate-500">¥{p.sellingPrice?.toLocaleString()}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    onClick={() => addItem()}
                    className="px-4 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-slate-300 hover:text-slate-500 transition-all shrink-0"
                >
                    未登録商品を追加
                </button>
            </div>

            {/* Adjustments Section */}
            <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">請求額調整（割引・端数調整など）</h4>
                    <button onClick={addAdjustment} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100">
                        <Plus className="w-3 h-3" />調整行を追加
                    </button>
                </div>
                {adjustments.map((adj) => (
                    <div key={adj.id} className="flex items-center gap-3 bg-slate-50/50 p-2 rounded-lg group">
                        <input
                            type="text"
                            value={adj.label}
                            onChange={e => updateAdjustment(adj.id, { label: e.target.value })}
                            className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-xs font-medium text-slate-600"
                            placeholder="調整内容（例：大口割引）"
                        />
                        <NumberInput
                            value={adj.amount}
                            allowNegative
                            onChange={val => updateAdjustment(adj.id, { amount: val ?? 0 })}
                            className="w-24 bg-transparent border-none focus:ring-0 p-0 text-right text-xs font-mono font-bold text-rose-600"
                        />
                        <button onClick={() => removeAdjustment(adj.id)} className="p-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Calculation Summary Card */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-lg shadow-slate-200">
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                        <span>小計（{taxType === 'inclusive' ? '税込' : '税抜'}）</span>
                        <span>¥{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1"><Percent className="w-3 h-3" /> {taxType === 'inclusive' ? '内消費税' : '消費税'}（{taxRate}%）</span>
                        <span>¥{taxAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 font-medium pt-2 border-t border-white/5">
                        <span className="flex items-center gap-1">最終調整（端数・値引き等）</span>
                        <NumberInput
                            value={finalAdjustment}
                            allowNegative
                            onChange={val => onChange({ items, adjustments, taxRate, taxType, totalAmount: grandTotal + (val ?? 0), finalAdjustment: (val ?? 0) })}
                            className="w-24 bg-transparent border-none focus:ring-0 p-0 text-right text-sm font-mono font-bold text-white placeholder:text-slate-700"
                            placeholder="0"
                        />
                    </div>
                </div>
                <div className="flex justify-between items-baseline pt-4 border-t border-white/10">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">最終請求額（税込）</span>
                    <span className="text-3xl font-black tabular-nums">¥{(grandTotal + finalAdjustment).toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}
