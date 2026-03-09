"use client";

import { useStore } from "@/lib/store";
import { Trash2, RotateCcw, Trash, AlertCircle } from "lucide-react";

export default function TrashPage() {
    const { trash, restoreFromTrash, permanentlyDeleteFromTrash, isLoaded } = useStore();

    if (!isLoaded) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[50vh]">
                <div className="animate-pulse text-slate-400 font-medium">読み込み中...</div>
            </div>
        );
    }

    const sortedTrash = [...trash].sort((a, b) => {
        const dateA = a.deletedAt?.seconds ? a.deletedAt.seconds : (typeof a.deletedAt === 'string' ? new Date(a.deletedAt).getTime() / 1000 : 0);
        const dateB = b.deletedAt?.seconds ? b.deletedAt.seconds : (typeof b.deletedAt === 'string' ? new Date(b.deletedAt).getTime() / 1000 : 0);
        return (dateB || 0) - (dateA || 0);
    });

    const formatDate = (deletedAt: any) => {
        if (!deletedAt) return "不明";
        const date = deletedAt.seconds ? new Date(deletedAt.seconds * 1000) : new Date(deletedAt);
        return date.toLocaleString('ja-JP', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const getCollectionLabel = (name: string) => {
        const labels: Record<string, string> = {
            'brands': 'ブランド',
            'suppliers': '仕入先',
            'products': '商品',
            'retailStores': '販売店',
            'inbound_shipments': '仕入れ',
            'sales': '売上',
            'daily_reports': '日報',
            'issued_documents': '帳票',
            'spot_recipients': 'スポット宛先',
            'business_challenges': '課題'
        };
        return labels[name] || name;
    };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto pb-24">
            <header className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-200/50">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">ゴミ箱</h1>
                        <p className="text-slate-500 font-medium italic">Trash Management</p>
                    </div>
                </div>
                <p className="text-slate-500 mt-4 leading-relaxed font-medium">
                    削除されたアイテムはここに一時的に保存されます。復元するか、完全に削除するかを選択してください。
                </p>
            </header>

            {trash.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-20 text-center shadow-sm">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner shadow-slate-100">
                        <Trash2 className="w-10 h-10 text-slate-200" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">ゴミ箱は空です</h3>
                    <p className="text-slate-400 font-medium">削除されたアイテムは見つかりませんでした。</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {sortedTrash.map((item) => (
                        <div key={item.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                            <div className="flex items-start gap-5">
                                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500 shrink-0">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#1e3a8a] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                                            {getCollectionLabel(item.collectionName)}
                                        </span>
                                        <span className="text-xs text-slate-400 font-bold tracking-tight">
                                            削除: {formatDate(item.deletedAt)}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 leading-tight group-hover:text-[#1e3a8a] transition-colors">{item.label}</h3>
                                    <p className="text-[10px] text-slate-300 font-mono tracking-tighter pt-1">ORIGINAL ID: {item.originalId}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-6 md:pt-0 border-t md:border-t-0 border-slate-50">
                                <button
                                    onClick={() => {
                                        if (confirm("このアイテムを復元しますか？")) {
                                            restoreFromTrash(item.id);
                                        }
                                    }}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-slate-700 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 shadow-sm"
                                >
                                    <RotateCcw className="w-5 h-5 text-slate-400" />
                                    <span>復元</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm("このアイテムを完全に削除しますか？\nこの操作は取り消せません。")) {
                                            permanentlyDeleteFromTrash(item.id);
                                        }
                                    }}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-100 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-95 shadow-sm shadow-red-100 hover:shadow-red-200"
                                >
                                    <Trash className="w-5 h-5" />
                                    <span>削除</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
