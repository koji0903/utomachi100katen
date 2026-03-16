"use client";

import { useStore } from "@/lib/store";
import {
    ClipboardList,
    ArrowLeft,
    CheckCircle2,
    Clock,
    ChevronRight,
    Plus
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InventoryAuditsPage() {
    const { inventoryAudits } = useStore();
    const router = useRouter();

    // Sort audits by date descending
    const sortedAudits = [...inventoryAudits].sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-[#1e3a8a] hover:bg-slate-50 rounded-xl transition-all shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <ClipboardList className="w-8 h-8 text-[#1e3a8a]" />
                            棚卸し履歴
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">
                            過去に実施した棚卸し記録の一覧です。
                        </p>
                    </div>
                </div>
                <Link
                    href="/inventory/audits/new"
                    className="flex items-center gap-2 px-6 py-3 bg-[#1e3a8a] text-white font-bold rounded-xl hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    新規棚卸しを開始
                </Link>
            </div>

            {/* Audit List */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100">
                    {sortedAudits.length === 0 ? (
                        <div className="p-20 text-center space-y-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto">
                                <ClipboardList className="w-8 h-8" />
                            </div>
                            <p className="text-slate-400 font-bold">棚卸し履歴がまだありません</p>
                            <Link
                                href="/inventory/audits/new"
                                className="inline-block text-[#1e3a8a] font-black text-sm hover:underline"
                            >
                                最初の実地棚卸しを開始する
                            </Link>
                        </div>
                    ) : (
                        sortedAudits.map((audit) => (
                            <Link
                                key={audit.id}
                                href={`/inventory/audits/${audit.id}`}
                                className="flex items-center justify-between p-6 hover:bg-slate-50/80 transition-all group"
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${audit.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                                        }`}>
                                        {audit.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <div className="text-lg font-black text-slate-900">{audit.date} の棚卸し</div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${audit.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {audit.status === 'completed' ? '完了' : '一時保存中'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-400">
                                                対象品目: {audit.items.length}件
                                            </span>
                                            {audit.status === 'completed' && (
                                                <span className="text-xs font-bold text-red-500">
                                                    在庫差異: {audit.items.filter(i => i.diff !== 0).length}件
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-slate-300 group-hover:text-slate-400 group-hover:translate-x-1 transition-all">
                                    <div className="text-right hidden sm:block">
                                        <div className="text-xs font-black text-slate-400 uppercase tracking-widest">実施日</div>
                                        <div className="text-sm font-bold text-slate-900">{audit.date}</div>
                                    </div>
                                    <ChevronRight className="w-6 h-6" />
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
