"use client";

import { useState, useMemo } from "react";
import {
    Plus, Edit2, Trash2, Search, Building2,
    MapPin, Phone, StickyNote, RotateCcw,
    ChevronRight, Calendar
} from "lucide-react";
import { useStore, SpotRecipient } from "@/lib/store";
import { SpotRecipientModal } from "@/components/SpotRecipientModal";
import { showNotification } from "@/lib/notifications";

const BRAND = "#1e3a8a";
const BRAND_LIGHT = "#eff6ff";

export default function SpotRecipientsPage() {
    const {
        isLoaded,
        spotRecipients,
        deleteSpotRecipient,
        restoreSpotRecipient,
        permanentlyDeleteSpotRecipient,
        permanentlyDeleteAllSpotRecipients
    } = useStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecipient, setEditingRecipient] = useState<SpotRecipient | null>(null);
    const [showTrash, setShowTrash] = useState(false);

    const filtered = useMemo(() => {
        if (!isLoaded) return [];
        return spotRecipients
            .filter(r => !!r.isTrashed === showTrash)
            .filter(r =>
                `${r.name} ${r.address ?? ""} ${r.tel ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => {
                const dateA = a.lastUsedAt || a.createdAt?.seconds ? new Date(a.lastUsedAt || (a.createdAt.seconds * 1000)).getTime() : 0;
                const dateB = b.lastUsedAt || b.createdAt?.seconds ? new Date(b.lastUsedAt || (b.createdAt.seconds * 1000)).getTime() : 0;
                return dateB - dateA;
            });
    }, [spotRecipients, searchQuery, showTrash, isLoaded]);

    if (!isLoaded) return <div className="p-8 text-slate-500 animate-pulse">読み込み中...</div>;

    const handleEdit = (recipient: SpotRecipient) => {
        setEditingRecipient(recipient);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingRecipient(null);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("この宛先をゴミ箱に移動してもよろしいですか？")) {
            deleteSpotRecipient(id);
            showNotification("ゴミ箱に移動しました");
        }
    };

    const handleRestore = (id: string) => {
        restoreSpotRecipient(id);
        showNotification("宛先を復元しました");
    };

    const handlePermanentDelete = (id: string) => {
        if (window.confirm("この宛先を完全に削除しますか？この操作は取り消せません。")) {
            permanentlyDeleteSpotRecipient(id);
            showNotification("完全に削除しました");
        }
    };

    const handleClearAll = async () => {
        if (window.confirm("すべてのスポット宛先データを完全に削除しますか？\nこの操作は取り消せません。")) {
            if (window.confirm("本当によろしいですか？")) {
                await permanentlyDeleteAllSpotRecipients();
                showNotification("すべてのデータを削除しました");
            }
        }
    }

    const formatDate = (isoStr?: string | any) => {
        if (!isoStr) return "---";
        try {
            const date = typeof isoStr === 'string' ? new Date(isoStr) : new Date(isoStr.seconds * 1000);
            return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
        } catch {
            return "---";
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-blue-50">
                        <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">スポット宛先管理</h1>
                        <p className="text-slate-500 text-sm mt-0.5">帳票作成時に指定された非登録宛先の一覧</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTrash(!showTrash)}
                        className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl shadow-sm active:scale-95 transition-all text-sm border ${showTrash ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    >
                        <Trash2 className="w-4 h-4" />
                        {showTrash ? "戻る" : "ゴミ箱"}
                    </button>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#1e3a8a] text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/10 hover:opacity-90 active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        新規宛先を登録
                    </button>
                </div>
            </div>

            {/* Warning / Clean up zone (Only if data exists) */}
            {!showTrash && spotRecipients.length > 0 && (
                <div className="flex justify-end">
                    <button
                        onClick={handleClearAll}
                        className="text-[10px] font-bold text-red-400 hover:text-red-600 flex items-center gap-1 bg-red-50/50 px-3 py-1.5 rounded-lg border border-red-100/50 transition-colors"
                    >
                        <Trash2 className="w-3 h-3" />
                        データを全削除してリセット
                    </button>
                </div>
            )}

            {/* Filter bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-4 items-center shadow-sm">
                <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="宛先名・住所・電話番号で検索..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                </div>
                <div className="text-sm text-slate-400 font-medium">
                    表示件数: <span className="text-slate-900 font-bold">{filtered.length}</span> 件
                </div>
            </div>

            {/* List */}
            {filtered.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map(recipient => (
                        <div key={recipient.id} className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-bold text-slate-900 truncate flex items-center gap-2">
                                        {recipient.name}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                            <Calendar className="w-3.5 h-3.5" />
                                            最終使用: {formatDate(recipient.lastUsedAt)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {showTrash ? (
                                        <>
                                            <button onClick={() => handleRestore(recipient.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="復元">
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handlePermanentDelete(recipient.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="完全削除">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleEdit(recipient)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編集">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(recipient.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="削除">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 space-y-2">
                                {recipient.address && (
                                    <div className="flex items-start gap-2 text-slate-600">
                                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                                        <span className="text-[11px] leading-relaxed">{recipient.address} {recipient.zipCode ? ` (〒${recipient.zipCode})` : ""}</span>
                                    </div>
                                )}
                                {recipient.tel && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="text-[11px]">{recipient.tel}</span>
                                    </div>
                                )}
                                {recipient.memo && (
                                    <div className="flex items-start gap-2 text-slate-500 bg-slate-50 p-2 rounded-lg mt-2">
                                        <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-300" />
                                        <p className="text-[11px] line-clamp-2 italic">{recipient.memo}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-200 py-16 flex flex-col items-center justify-center text-center px-6 shadow-sm">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-4">
                        <Building2 className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1">{searchQuery ? "見つかりませんでした" : "宛先がまだありません"}</h3>
                    <p className="text-sm text-slate-400 max-w-sm">
                        {searchQuery ? "検索条件を変えてお試しください" : "帳票作成時にスポットで指定された宛先はここに自動収集されます"}
                    </p>
                </div>
            )}

            <SpotRecipientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingRecipient}
            />
        </div>
    );
}
