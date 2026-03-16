"use client";

import { useStore } from "@/lib/store";
import {
    ClipboardList,
    ArrowLeft,
    CheckCircle2,
    Save,
    Trash2,
    TriangleAlert,
    ArrowRight
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import type { InventoryAudit, InventoryAuditItem } from "@/lib/store";

export default function InventoryAuditDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const {
        inventoryAudits,
        products,
        updateInventoryAudit,
        completeInventoryAudit,
        addInventoryAudit
    } = useStore();

    const [audit, setAudit] = useState<InventoryAudit | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize or fetch audit
    useEffect(() => {
        if (id === 'new') {
            setIsNew(true);
            const today = new Date().toISOString().split('T')[0];
            const items: InventoryAuditItem[] = products
                .filter(p => !p.isTrashed)
                .map(p => ({
                    productId: p.id,
                    productName: p.name,
                    expectedStock: p.stock || 0,
                    actualStock: p.stock || 0,
                    diff: 0,
                    remarks: ''
                }));

            setAudit({
                id: 'new',
                date: today,
                status: 'draft',
                items,
                isTrashed: false
            } as InventoryAudit);
        } else {
            const found = inventoryAudits.find(a => a.id === id);
            if (found) {
                setAudit(found);
            }
        }
    }, [id, inventoryAudits, products]);

    const handleStockChange = (productId: string, actualValue: string) => {
        if (!audit) return;
        const actual = parseInt(actualValue) || 0;

        setAudit(prev => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map(item => {
                    if (item.productId === productId) {
                        return {
                            ...item,
                            actualStock: actual,
                            diff: actual - item.expectedStock
                        };
                    }
                    return item;
                })
            };
        });
    };

    const totals = useMemo(() => {
        if (!audit) return { diffCount: 0, totalDiff: 0 };
        return {
            diffCount: audit.items.filter(i => i.diff !== 0).length,
            totalDiff: audit.items.reduce((sum, i) => sum + i.diff, 0)
        };
    }, [audit]);

    const handleSave = async () => {
        if (!audit) return;
        setIsSaving(true);
        try {
            if (isNew) {
                const { id: _, status: __, ...auditData } = audit as any;
                const newId = await addInventoryAudit({ ...auditData, status: 'draft' });
                router.replace(`/inventory/audits/${newId}`);
            } else {
                await updateInventoryAudit(audit.id, {
                    date: audit.date,
                    items: audit.items,
                    remarks: audit.remarks
                });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleComplete = async () => {
        if (!audit || id === 'new') return;
        if (!window.confirm("棚卸しを確定しますか？在庫数が実在庫数に更新され、履歴が記録されます。")) return;

        setIsSaving(true);
        try {
            await completeInventoryAudit(audit.id, audit);
            router.push('/inventory/audits');
        } finally {
            setIsSaving(false);
        }
    };

    if (!audit) return <div className="p-20 text-center font-bold text-slate-400">読み込み中...</div>;

    const isCompleted = audit.status === 'completed';

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/inventory/audits')}
                        className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-[#1e3a8a] hover:bg-slate-50 rounded-xl transition-all shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <ClipboardList className="w-8 h-8 text-[#1e3a8a]" />
                            {isNew ? '新規棚卸し' : `${audit.date} の棚卸し`}
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">
                            実在庫を入力してシステムの在庫数を調整します。
                        </p>
                    </div>
                </div>

                {!isCompleted && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            一時保存
                        </button>
                        {!isNew && (
                            <button
                                onClick={handleComplete}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-900/10 active:scale-95 disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                棚卸しを確定
                            </button>
                        )}
                    </div>
                )}
            </div>

            {isCompleted && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3 text-green-700 font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                    この棚卸しは完了しており、在庫調整が反映済みです。
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">対象品目</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{audit.items.length} 品目</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">不一致件数</p>
                    <p className={`text-2xl font-black mt-1 ${totals.diffCount > 0 ? 'text-red-500' : 'text-slate-900'}`}>
                        {totals.diffCount} 品目
                    </p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">在庫変動合計</p>
                    <p className={`text-2xl font-black mt-1 ${totals.totalDiff > 0 ? 'text-blue-600' : totals.totalDiff < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {totals.totalDiff > 0 ? '+' : ''}{totals.totalDiff}
                    </p>
                </div>
            </div>

            {/* Item List */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4">商品名</th>
                            <th className="px-6 py-4 text-center">システム在庫</th>
                            <th className="px-6 py-4 text-center"></th>
                            <th className="px-6 py-4 text-center w-40">実在庫数</th>
                            <th className="px-6 py-4 text-right">差異</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {audit.items.map((item) => (
                            <tr key={item.productId} className={`transition-colors ${item.diff !== 0 ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'}`}>
                                <td className="px-6 py-4 font-bold text-slate-900">{item.productName}</td>
                                <td className="px-6 py-4 text-center text-slate-400 font-bold">{item.expectedStock}</td>
                                <td className="px-6 py-4 text-center">
                                    <ArrowRight className="w-4 h-4 text-slate-300 mx-auto" />
                                </td>
                                <td className="px-6 py-4">
                                    <input
                                        type="number"
                                        min="0"
                                        disabled={isCompleted}
                                        value={item.actualStock}
                                        onChange={(e) => handleStockChange(item.productId, e.target.value)}
                                        className="w-full text-center py-2 bg-white border border-slate-200 rounded-xl font-black text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none disabled:bg-slate-50 disabled:text-slate-400"
                                    />
                                </td>
                                <td className="px-6 py-4 text-right underline decoration-dotted decoration-slate-200 underline-offset-4">
                                    <span className={`text-lg font-black ${item.diff > 0 ? 'text-blue-600' :
                                            item.diff < 0 ? 'text-red-600' :
                                                'text-slate-300'
                                        }`}>
                                        {item.diff > 0 ? `+${item.diff}` : item.diff}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Remarks */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 space-y-3">
                <h3 className="font-black text-slate-900 flex items-center gap-2">
                    備考・メモ
                </h3>
                <textarea
                    disabled={isCompleted}
                    value={audit.remarks || ''}
                    onChange={(e) => setAudit(prev => prev ? { ...prev, remarks: e.target.value } : null)}
                    placeholder="棚卸しに関する特記事項があれば入力してください"
                    className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none disabled:bg-slate-50 disabled:text-slate-400"
                ></textarea>
            </div>

            {!isCompleted && (
                <div className="flex justify-end p-4">
                    {isNew ? (
                        <p className="text-sm font-bold text-slate-400 italic">※「一時保存」すると棚卸し番号が発行され、確定が可能になります。</p>
                    ) : (
                        <p className="text-sm font-bold text-amber-600 flex items-center gap-1.5">
                            <TriangleAlert className="w-4 h-4" />
                            確定すると在庫調整が実行されます。慎重に操作してください。
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
