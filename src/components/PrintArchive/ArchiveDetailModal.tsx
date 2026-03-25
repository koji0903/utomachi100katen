"use client";

import { useState } from "react";
import { X, FileText, Printer, Eye, MessageSquare, History, Calendar, User, Save, Trash2, Tag, Plus, Check, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { PrintArchive, PrintArchiveHistory, ArchiveCategory } from "@/lib/types/printArchive";
import { showNotification } from "@/lib/notifications";

const CATEGORIES: ArchiveCategory[] = ['出荷伝票', '請求書', '領収書', '納品書', 'その他'];

interface ArchiveDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    archive: PrintArchive;
}

export function ArchiveDetailModal({ isOpen, onClose, archive }: ArchiveDetailModalProps) {
    const { updatePrintArchive, logArchiveActivity, deletePrintArchive } = useStore();
    const [memo, setMemo] = useState(archive.memo || "");
    const [isEditingMemo, setIsEditingMemo] = useState(false);
    const [isEditingCategory, setIsEditingCategory] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<ArchiveCategory>(archive.category);
    const [newTag, setNewTag] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingCategory, setIsSavingCategory] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    if (!isOpen) return null;

    const handleUpdateMemo = async () => {
        setIsSaving(true);
        try {
            await updatePrintArchive(archive.id, { memo });
            await logArchiveActivity(archive.id, 'update_memo', 'メモを更新しました');
            showNotification("メモを更新しました。");
            setIsEditingMemo(false);
        } catch (error) {
            showNotification("更新に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateCategory = async (newCategory: ArchiveCategory) => {
        if (newCategory === archive.category) {
            setIsEditingCategory(false);
            return;
        }
        setSelectedCategory(newCategory);
        setIsSavingCategory(true);
        try {
            await updatePrintArchive(archive.id, { category: newCategory });
            await logArchiveActivity(archive.id, 'update_category', `カテゴリーを「${newCategory}」に変更しました`);
            showNotification("カテゴリーを更新しました。");
            setIsEditingCategory(false);
        } catch (error) {
            showNotification("更新に失敗しました。");
        } finally {
            setIsSavingCategory(false);
        }
    };

    const handleAddTag = async () => {
// ... (omitted for brevity in replacement chunk, but I'll use multi_replace or ensure context)
        if (!newTag) return;
        const updatedTags = [...(archive.tags || []), newTag];
        try {
            await updatePrintArchive(archive.id, { tags: updatedTags });
            setNewTag("");
        } catch (error) {
            showNotification("タグの追加に失敗しました。");
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        const updatedTags = (archive.tags || []).filter(t => t !== tagToRemove);
        try {
            await updatePrintArchive(archive.id, { tags: updatedTags });
        } catch (error) {
            showNotification("タグの削除に失敗しました。");
        }
    };

    const handlePrint = async () => {
        setIsPrinting(true);
        logArchiveActivity(archive.id, 'print', '印刷用データを準備しています');
        
        try {
            // Fetch the PDF as a blob to bypass cross-origin print blocks
            const response = await fetch(archive.fileUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            // Create a hidden iframe for printing
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = blobUrl;
            document.body.appendChild(iframe);

            iframe.onload = () => {
                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    // Cleanup
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                        URL.revokeObjectURL(blobUrl);
                        setIsPrinting(false);
                    }, 1000);
                }, 500);
            };
        } catch (error) {
            console.error("Print failed, falling back to new tab:", error);
            // Fallback: Open in new tab
            const win = window.open(archive.fileUrl, '_blank');
            if (win) {
                win.onload = () => win.print();
            }
            setIsPrinting(false);
        }
    };

    const getActionLabel = (action: PrintArchiveHistory['action']) => {
        switch (action) {
            case 'upload': return 'アップロード';
            case 'preview': return 'プレビュー表示';
            case 'print': return '印刷';
            case 'update_memo': return 'メモ更新';
            case 'update_category': return 'カテゴリー更新';
            default: return action;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Left Side: Preview */}
                <div className="flex-1 bg-slate-100 flex flex-col">
                    <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            <span className="font-bold text-slate-800 truncate max-w-[300px]">{archive.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handlePrint}
                                disabled={isPrinting}
                                className={`flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-bold shadow-sm ${isPrinting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Printer className={`w-4 h-4 ${isPrinting ? 'animate-pulse' : ''}`} /> 
                                {isPrinting ? '準備中...' : '印刷'}
                            </button>
                            <a 
                                href={archive.fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                title="ブラウザで直接開く"
                            >
                                <Eye className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                    <div className="flex-1 relative bg-slate-200 shadow-inner overflow-hidden">
                        <iframe 
                            src={`${archive.fileUrl}#toolbar=0&navpanes=0&scrollbar=1`} 
                            className="w-full h-full border-none"
                            title="PDF Preview"
                        />
                        {/* Overlay to detect initial load if needed, but standard iframe usually works */}
                    </div>
                </div>

                {/* Right Side: Details & History */}
                <div className="w-80 sm:w-96 border-l border-slate-200 flex flex-col bg-white">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h2 className="text-lg font-bold text-slate-900">詳細情報</h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
                        {/* Meta Info */}
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">カテゴリー</label>
                                    {!isEditingCategory ? (
                                        <button 
                                            onClick={() => setIsEditingCategory(true)}
                                            className="text-[10px] font-bold text-indigo-600 hover:underline"
                                        >
                                            編集
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => setIsEditingCategory(false)}
                                            className="text-[10px] font-bold text-slate-400 hover:underline"
                                        >
                                            キャンセル
                                        </button>
                                    )}
                                </div>
                                {!isEditingCategory ? (
                                    <div className="text-sm font-bold text-slate-900 px-3 py-2 bg-indigo-50 rounded-lg text-indigo-700 border border-indigo-100 inline-block">
                                        {archive.category}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        {CATEGORIES.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => handleUpdateCategory(cat)}
                                                disabled={isSavingCategory}
                                                className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-between ${archive.category === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                            >
                                                {cat}
                                                {archive.category === cat && <Check className="w-3 h-3" />}
                                                {isSavingCategory && selectedCategory === cat && <Loader2 className="w-3 h-3 animate-spin" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">タグ</label>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {(archive.tags || []).map(tag => (
                                        <span key={tag} className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-white border border-indigo-200 px-2 py-1 rounded-lg">
                                            {tag}
                                            <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-1">
                                    <input 
                                        type="text" 
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                        placeholder="新しいタグ..."
                                        className="flex-1 text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                                    />
                                    <button 
                                        onClick={handleAddTag}
                                        className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Memo Section */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5" /> メモ
                                </label>
                                {!isEditingMemo ? (
                                    <button 
                                        onClick={() => setIsEditingMemo(true)}
                                        className="text-xs font-bold text-indigo-600 hover:underline"
                                    >
                                        編集
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button 
                                            disabled={isSaving}
                                            onClick={() => setIsEditingMemo(false)}
                                            className="text-xs font-bold text-slate-500 hover:underline"
                                        >
                                            取消
                                        </button>
                                        <button 
                                            disabled={isSaving}
                                            onClick={handleUpdateMemo}
                                            className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                                        >
                                            {isSaving ? "保存中..." : "保存"}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 min-h-[100px]">
                                {isEditingMemo ? (
                                    <textarea 
                                        value={memo}
                                        onChange={(e) => setMemo(e.target.value)}
                                        className="w-full h-full bg-transparent border-none focus:ring-0 text-sm font-medium resize-none p-0"
                                        autoFocus
                                        rows={4}
                                    />
                                ) : (
                                    <p className="text-sm text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">
                                        {archive.memo || <span className="text-slate-300 italic">メモはありません</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* History Section */}
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5" /> 操作履歴
                            </label>
                            <div className="space-y-4">
                                {(archive.history || []).slice(0, 10).map((item, idx) => (
                                    <div key={item.id} className="relative pl-6 pb-2 group">
                                        {/* Timeline Line */}
                                        {idx !== (archive.history || []).length - 1 && (
                                            <div className="absolute left-[7px] top-4 bottom-[-16px] w-[2px] bg-slate-100 group-last:hidden" />
                                        )}
                                        {/* Timeline Dot */}
                                        <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white bg-slate-200 shadow-sm" />
                                        
                                        <div className="text-xs font-bold text-slate-800">{getActionLabel(item.action)}</div>
                                        <div className="text-[10px] text-slate-400 flex items-center gap-3 mt-1 font-medium">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(item.timestamp).toLocaleString()}
                                            </span>
                                            {item.userName && (
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {item.userName}
                                                </span>
                                            )}
                                        </div>
                                        {item.detail && (
                                            <div className="text-[10px] text-slate-500 mt-1.5 bg-slate-50 border border-slate-100 px-2 py-1 rounded inline-block italic font-medium">
                                                {item.detail}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(archive.history || []).length === 0 && (
                                    <div className="text-xs text-slate-400 text-center py-4 italic">
                                        履歴はありません
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-slate-50/30">
                        <div className="text-[10px] text-slate-400 flex justify-between items-center">
                            <span>登録日: {new Date(archive.createdAt?.seconds ? archive.createdAt.seconds * 1000 : archive.createdAt).toLocaleDateString()}</span>
                            {!archive.isTrashed && (
                                <button 
                                    onClick={() => {
                                        if (window.confirm("このアーカイブをゴミ箱に移動しますか？")) {
                                            deletePrintArchive(archive.id);
                                            onClose();
                                        }
                                    }}
                                    className="text-red-400 hover:text-red-600 flex items-center gap-1 font-bold transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> 削除
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
