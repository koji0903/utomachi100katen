"use client";

import { useState } from "react";
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    AlertCircle,
    Clock,
    CheckCircle2,
    Tag,
    MessageSquare,
    Store,
    Smartphone,
    TrendingUp,
    Trash2,
    PlusCircle,
    X,
    ChevronDown,
    RotateCcw
} from "lucide-react";
import { useStore, BusinessChallenge } from "@/lib/store";
import { showNotification } from "@/lib/notifications";

const CATEGORIES = {
    system: { label: "システム課題", icon: Smartphone, color: "text-blue-600", bg: "bg-blue-50" },
    product: { label: "商品開発・改善", icon: Tag, color: "text-orange-600", bg: "bg-orange-50" },
    customer: { label: "顧客の声", icon: MessageSquare, color: "text-pink-600", bg: "bg-pink-50" },
    store: { label: "店舗・現場の声", icon: Store, color: "text-indigo-600", bg: "bg-indigo-50" },
    strategy: { label: "戦略・展開", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    other: { label: "その他", icon: AlertCircle, color: "text-slate-600", bg: "bg-slate-50" },
};

const PRIORITIES = {
    high: { label: "高", color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
    medium: { label: "中", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
    low: { label: "低", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
};

const STATUSES = {
    todo: { label: "未着手", icon: Clock, color: "text-slate-500" },
    doing: { label: "進行中", icon: TrendingUp, color: "text-blue-600" },
    done: { label: "完了", icon: CheckCircle2, color: "text-emerald-600" },
};

// --- Sub-components ---

const ChallengeCard = ({
    challenge,
    onEdit,
    onDelete,
    onRestore,
    onPermanentDelete,
    compact = false,
    showFullDescription = false
}: {
    challenge: BusinessChallenge;
    onEdit: (c: BusinessChallenge) => void;
    onDelete: (id: string) => void;
    onRestore?: (id: string) => void;
    onPermanentDelete?: (id: string) => void;
    compact?: boolean;
    showFullDescription?: boolean;
}) => {
    const cat = (CATEGORIES as any)[challenge.category] || CATEGORIES.other;
    const prio = (PRIORITIES as any)[challenge.priority] || PRIORITIES.medium;
    const stat = (STATUSES as any)[challenge.status] || STATUSES.todo;
    const formattedDate = (createdAt: any) => {
        if (!createdAt) return "";
        let date: Date;
        if (typeof createdAt === 'string') {
            date = new Date(createdAt);
        } else if (createdAt.toDate) {
            date = createdAt.toDate();
        } else if (createdAt.seconds) {
            date = new Date(createdAt.seconds * 1000);
        } else {
            return "";
        }
        return date.toLocaleDateString("ja-JP", { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    };

    return (
        <div className={`group bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all relative overflow-hidden flex ${compact ? 'rounded-2xl p-3 items-center gap-3' : 'rounded-3xl p-5 md:p-6 flex-col md:flex-row md:items-start gap-4 md:gap-6'}`}>
            {/* Category Icon */}
            <div className={`${compact ? 'w-8 h-8 rounded-xl' : 'w-10 h-10 md:w-12 md:h-12 rounded-2xl'} ${cat.bg} flex items-center justify-center shrink-0`}>
                <cat.icon className={`${compact ? 'w-4 h-4' : 'w-5 h-5 md:w-6 md:h-6'} ${cat.color}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {!compact && (
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cat.bg} ${cat.color}`}>
                            {cat.label}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${prio.bg} ${prio.color} border ${prio.border}`}>
                            優先度: {prio.label}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 ml-auto flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formattedDate(challenge.createdAt)}
                        </span>
                    </div>
                )}
                <div className={`font-bold text-slate-800 ${compact ? 'text-sm truncate' : 'text-base md:text-lg whitespace-pre-wrap'}`}>{challenge.title}</div>
                {challenge.status !== 'done' && challenge.description && (
                    <p className={`text-sm text-slate-500 mt-1.5 leading-relaxed ${showFullDescription ? 'whitespace-pre-wrap' : 'line-clamp-2'} ${compact ? 'text-xs truncate max-w-[200px]' : ''}`}>
                        {challenge.description}
                    </p>
                )}
                {compact && (
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${cat.bg} ${cat.color}`}>
                            {cat.label}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${prio.bg} ${prio.color} border ${prio.border}`}>
                            {prio.label}
                        </span>
                    </div>
                )}
            </div>

            {/* Status & Actions */}
            <div className={`flex items-center justify-end shrink-0 ${compact ? '' : 'pt-3 border-t border-slate-50 md:pt-0 md:border-t-0 md:flex-col md:h-full gap-2'}`}>
                {!compact && (
                    <div className={`flex items-center justify-end gap-1.5 ${stat.color} font-black text-xs w-full`}>
                        <stat.icon className="w-4 h-4" />
                        {stat.label}
                    </div>
                )}

                <div className="flex items-center gap-1">
                    {challenge.isTrashed ? (
                        <>
                            <button
                                onClick={() => onRestore?.(challenge.id)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                title="復元"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => onPermanentDelete?.(challenge.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="完全削除"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => onEdit(challenge)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="編集"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => onDelete(challenge.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="削除"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const EmptyState = ({ showTrash, onNewClick }: { showTrash: boolean; onNewClick: () => void }) => (
    <div className="py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-300">
        <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            {showTrash ? <Trash2 className="w-8 h-8 text-slate-300" /> : <CheckCircle2 className="w-8 h-8 text-slate-300" />}
        </div>
        <h3 className="text-lg font-bold text-slate-800">{showTrash ? "ゴミ箱は空です" : "課題はありません"}</h3>
        <p className="text-slate-400 text-sm mt-1">
            {showTrash ? "削除された課題はありません。" : "現在、表示条件に一致する課題は見つかりません。"}
        </p>
        {!showTrash && (
            <button
                onClick={onNewClick}
                className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all"
            >
                <PlusCircle className="w-5 h-5" />
                最初の課題を登録
            </button>
        )}
    </div>
);

export default function TodoPage() {
    const { challenges, addChallenge, updateChallenge, deleteChallenge, restoreChallenge, permanentlyDeleteChallenge, isLoaded } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChallenge, setEditingChallenge] = useState<BusinessChallenge | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [showTrash, setShowTrash] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        category: "system" as any,
        priority: "medium" as any,
        status: "todo" as any,
    });

    const handleOpenModal = (challenge?: BusinessChallenge) => {
        if (challenge) {
            setEditingChallenge(challenge);
            setFormData({
                title: challenge.title,
                description: challenge.description,
                category: challenge.category,
                priority: challenge.priority,
                status: challenge.status,
            });
        } else {
            setEditingChallenge(null);
            setFormData({
                title: "",
                description: "",
                category: "system",
                priority: "medium",
                status: "todo",
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingChallenge) {
                await updateChallenge(editingChallenge.id, formData);
                showNotification("課題を更新しました。");
            } else {
                await addChallenge(formData);
                showNotification("課題を登録しました。");
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save challenge:", error);
            showNotification("保存に失敗しました。", "error");
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm("この課題をゴミ箱に移動してもよろしいですか？")) {
            deleteChallenge(id);
            showNotification("ゴミ箱に移動しました。");
        }
    };

    const handleRestore = (id: string) => {
        restoreChallenge(id);
        showNotification("課題を復元しました。");
    };

    const handlePermanentDelete = (id: string) => {
        if (window.confirm("この課題を完全に削除しますか？この操作は取り消せません。")) {
            permanentlyDeleteChallenge(id);
            showNotification("完全に削除しました。");
        }
    };

    const filteredChallenges = (challenges || [])
        .filter(c => !!c.isTrashed === showTrash)
        .filter((c: BusinessChallenge) =>
            (filterCategory === "all" || c.category === filterCategory) &&
            (filterStatus === "all" || c.status === filterStatus) &&
            (c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.description.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a: BusinessChallenge, b: BusinessChallenge) => {
            // Sort by priority (High > Medium > Low)
            const pMap: Record<string, number> = { high: 0, medium: 1, low: 2 };
            const aPrio = pMap[a.priority] ?? 1;
            const bPrio = pMap[b.priority] ?? 1;
            if (aPrio !== bPrio) return aPrio - bPrio;

            // Then by createdAt (Oldest > Newest)
            const aTime = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : ((a.createdAt as any).toDate ? (a.createdAt as any).toDate().getTime() : 0)) : 0;
            const bTime = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : ((b.createdAt as any).toDate ? (b.createdAt as any).toDate().getTime() : 0)) : 0;
            return aTime - bTime;
        });

    if (!isLoaded) return <div className="p-8">読み込み中...</div>;

    return (
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        課題・ToDo管理
                        <span className="text-sm font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                            {filteredChallenges.length} 件
                        </span>
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium italic">
                        現場の声や運用上の課題を資産に変える
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowTrash(!showTrash)}
                        className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl shadow-sm active:scale-95 transition-all text-sm border ${showTrash ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    >
                        <Trash2 className="w-4 h-4" />
                        {showTrash ? "戻る" : "ゴミ箱"}
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-[#1e3a8a] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-900/10 hover:scale-105 active:scale-95 transition-all text-sm shrink-0"
                    >
                        <PlusCircle className="w-5 h-5" />
                        新しい課題を追加
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-6 flex flex-col md:flex-row gap-4 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="課題を検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="pl-4 pr-10 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none font-medium cursor-pointer"
                    >
                        <option value="all">すべてのカテゴリ</option>
                        {Object.entries(CATEGORIES).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                        ))}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="pl-4 pr-10 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none font-medium cursor-pointer"
                    >
                        <option value="all">すべてのステータス</option>
                        {Object.entries(STATUSES).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List / Kanban */}
            {showTrash ? (
                <div className="grid grid-cols-1 gap-4">
                    {filteredChallenges.length > 0 ? (
                        filteredChallenges.map((challenge: BusinessChallenge) => (
                            <ChallengeCard
                                key={challenge.id}
                                challenge={challenge}
                                onEdit={handleOpenModal}
                                onDelete={handleDelete}
                                onRestore={handleRestore}
                                onPermanentDelete={handlePermanentDelete}
                            />
                        ))
                    ) : (
                        <EmptyState showTrash={true} onNewClick={() => handleOpenModal()} />
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-10">
                    {Object.entries(STATUSES).map(([statusKey, statusInfo]) => {
                        const columnTasks = filteredChallenges.filter(c => c.status === statusKey);
                        return (
                            <div key={statusKey} className="flex flex-col gap-5">
                                {/* Column Header */}
                                <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100">
                                    <div className={`flex items-center gap-2 ${statusInfo.color} font-black text-lg`}>
                                        <statusInfo.icon className="w-6 h-6" />
                                        {statusInfo.label}
                                        <span className="text-sm font-medium text-slate-400 bg-slate-100 px-3 py-0.5 rounded-full ml-2">
                                            {columnTasks.length}
                                        </span>
                                    </div>
                                    {statusKey === 'todo' && (
                                        <button onClick={() => handleOpenModal()} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors text-sm font-bold">
                                            <PlusCircle className="w-4 h-4" />
                                            追加
                                        </button>
                                    )}
                                </div>

                                {/* Column Content */}
                                <div className="grid grid-cols-1 gap-4">
                                    {columnTasks.length > 0 ? (
                                        columnTasks.map((challenge: BusinessChallenge) => (
                                            <ChallengeCard
                                                key={challenge.id}
                                                challenge={challenge}
                                                onEdit={handleOpenModal}
                                                onDelete={handleDelete}
                                                compact={statusKey === 'done'}
                                                showFullDescription={statusKey === 'todo'}
                                            />
                                        ))
                                    ) : (
                                        <div className="py-10 text-center bg-slate-50/30 rounded-3xl border border-dashed border-slate-200">
                                            <span className="text-sm font-medium text-slate-400">{statusInfo.label}はありません</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative z-10 animate-in fade-in zoom-in duration-200">
                        <div className="p-8 pb-0 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                {editingChallenge ? "課題を編集" : "新しい課題を登録"}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">タイトル</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                                        placeholder="例：商品Aのパッケージ破損について"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">カテゴリ</label>
                                        <div className="relative">
                                            <select
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                                                className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none font-medium cursor-pointer"
                                            >
                                                {Object.entries(CATEGORIES).map(([key, val]) => (
                                                    <option key={key} value={key}>{val.label}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">優先度</label>
                                        <div className="relative">
                                            <select
                                                value={formData.priority}
                                                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                                                className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none font-medium cursor-pointer"
                                            >
                                                {Object.entries(PRIORITIES).map(([key, val]) => (
                                                    <option key={key} value={key}>{val.label}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">ステータス</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.entries(STATUSES).map(([key, val]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, status: key as any })}
                                                className={`py-3 rounded-2xl text-xs font-black transition-all border ${formData.status === key
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20'
                                                    : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'
                                                    }`}
                                            >
                                                {val.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">詳細・メモ</label>
                                    <textarea
                                        rows={4}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all font-medium resize-none"
                                        placeholder="具体的な内容や発生した状況、背景などを入力してください..."
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-[#1e3a8a] text-white py-4 rounded-3xl font-black text-lg shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                {editingChallenge ? "変更を保存する" : "課題を登録する"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
