"use client";

import { useState, Suspense } from "react";
import { Plus, Search, FileText, Printer, Eye, MoreVertical, Trash2, Tag, Calendar, History, MessageSquare } from "lucide-react";
import { useStore } from "@/lib/store";
import { PrintArchive } from "@/lib/types/printArchive";
import { showNotification } from "@/lib/notifications";
import { UploadModal } from "@/components/PrintArchive/UploadModal";
import { ArchiveDetailModal } from "@/components/PrintArchive/ArchiveDetailModal";

function PrintArchivePageContent() {
    const { isLoaded, printArchives, deletePrintArchive, logArchiveActivity } = useStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedArchive, setSelectedArchive] = useState<PrintArchive | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [showTrash, setShowTrash] = useState(false);

    if (!isLoaded) return <div className="p-8 text-slate-500">読み込み中...</div>;

    const filteredArchives = printArchives
        .filter(a => !!a.isTrashed === showTrash)
        .filter((archive) => {
            const matchesSearch = 
                archive.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (archive.memo || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (archive.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
                archive.category.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        })
        .sort((a, b) => new Date(b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : b.updatedAt).getTime() - new Date(a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : a.updatedAt).getTime());

    const handleDelete = (id: string) => {
        if (window.confirm("このアーカイブをゴミ箱に移動してもよろしいですか？")) {
            deletePrintArchive(id);
            showNotification("ゴミ箱に移動しました。");
        }
    };

    const handlePreview = (archive: PrintArchive) => {
        openDetail(archive);
    };

    const handlePrint = (archive: PrintArchive) => {
        logArchiveActivity(archive.id, 'print', '印刷用プレビューを開きました');
        // Simple print: open in new tab and suggest printing
        const win = window.open(archive.fileUrl, '_blank');
        if (win) {
            win.onload = () => {
                win.print();
            };
        }
    };

    const openDetail = (archive: PrintArchive) => {
        setSelectedArchive(archive);
        setIsDetailModalOpen(true);
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Printer className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">印刷アーカイブ</h1>
                        <p className="text-slate-500 text-sm">各種伝票や資料PDFを一元管理・印刷できます。</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowTrash(!showTrash)}
                        className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl shadow-sm active:scale-95 transition-all text-sm border ${showTrash ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    >
                        <Trash2 className="w-4 h-4" />
                        {showTrash ? "戻る" : "ゴミ箱"}
                    </button>
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        新規アップロード
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="タイトル、カテゴリー、メモで検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-sm bg-white">
                                <th className="p-5 font-semibold">ドキュメント</th>
                                <th className="p-5 font-semibold">カテゴリー</th>
                                <th className="p-5 font-semibold">タグ</th>
                                <th className="p-5 font-semibold">最終更新</th>
                                <th className="p-5 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredArchives.map((archive) => (
                                <tr key={archive.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div 
                                                className="cursor-pointer group/title"
                                                onClick={() => openDetail(archive)}
                                            >
                                                <div className="font-bold text-slate-900 leading-tight mb-0.5 group-hover/title:text-indigo-600 transition-colors">{archive.title}</div>
                                                <div className="text-xs text-slate-400 truncate max-w-[200px]">{archive.fileName}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                            {archive.category}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex flex-wrap gap-1">
                                            {(archive.tags || []).map(tag => (
                                                <span key={tag} className="flex items-center gap-1 text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                    <Tag className="w-3 h-3" /> {tag}
                                                </span>
                                            ))}
                                            {(archive.tags || []).length === 0 && <span className="text-slate-300 text-xs">-</span>}
                                        </div>
                                    </td>
                                    <td className="p-5 text-sm text-slate-500">
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            {new Date(archive.updatedAt?.seconds ? archive.updatedAt.seconds * 1000 : archive.updatedAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handlePreview(archive)}
                                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="プレビュー"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handlePrint(archive)}
                                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="印刷"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => openDetail(archive)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="詳細・履歴・メモ"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(archive.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="削除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredArchives.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <FileText className="w-12 h-12 text-slate-200" />
                                            <p className="text-slate-400">アーカイブが見つかりませんでした。</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <UploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
            />

            {selectedArchive && (
                <ArchiveDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    archive={selectedArchive}
                />
            )}
        </div>
    );
}

export default function PrintArchivePage() {
    return (
        <Suspense fallback={<div className="p-8">読み込み中...</div>}>
            <PrintArchivePageContent />
        </Suspense>
    );
}
