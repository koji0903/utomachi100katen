"use client";

import { useState, useMemo } from "react";
import { BookOpen, Plus, Edit2, Trash2, ArrowRightCircle, ExternalLink, Sparkles, AlertCircle } from "lucide-react";
import { useStore, BusinessManual } from "@/lib/store";
import { GuidelineEditorModal } from "@/components/GuidelineEditorModal";
import { showNotification } from "@/lib/notifications";

export default function GuidelinesPage() {
    const { businessManuals, deleteBusinessManual, printArchives, isLoaded } = useStore();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingManual, setEditingManual] = useState<BusinessManual | undefined>(undefined);

    const categories = useMemo(() => {
        const cats = new Set(businessManuals.map(m => m.category));
        return Array.from(cats).sort();
    }, [businessManuals]);

    const activeManual = useMemo(() => {
        if (selectedId) return businessManuals.find(m => m.id === selectedId);
        if (businessManuals.length > 0) return businessManuals[0];
        return null;
    }, [businessManuals, selectedId]);

    const attachedDocs = useMemo(() => {
        if (!activeManual || !activeManual.attachedDocumentIds) return [];
        return printArchives.filter(a => activeManual.attachedDocumentIds?.includes(a.id));
    }, [activeManual, printArchives]);

    if (!isLoaded) {
        return (
            <div className="h-full flex items-center justify-center text-slate-400 p-20">
                <div className="text-center space-y-3">
                    <BookOpen className="w-12 h-12 mx-auto animate-pulse opacity-20" />
                    <p className="text-sm font-bold tracking-tighter">読み込み中...</p>
                </div>
            </div>
        );
    }

    const handleDelete = async (id: string, title: string) => {
        if (window.confirm(`「${title}」を削除してもよろしいですか？`)) {
            await deleteBusinessManual(id);
            showNotification("削除しました");
            if (selectedId === id) setSelectedId(null);
        }
    };

    const handleEdit = (manual: BusinessManual) => {
        setEditingManual(manual);
        setEditorOpen(true);
    };

    const handleNew = () => {
        setEditingManual(undefined);
        setEditorOpen(true);
    };

    // Markdown Parser (Basic but premium looking)
    const renderMarkdown = (content: string) => {
        const renderInlineStyles = (line: string) => {
            // 1. Split by links [label](url)
            const parts = line.split(/(\[[^\]]+\]\([^)]+\))/g);
            return parts.flatMap((part, i) => {
                const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
                if (linkMatch) {
                    return (
                        <a key={`l-${i}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold transition-colors">
                            {linkMatch[1]}
                        </a>
                    );
                }
                
                // 2. Split by bold **text**
                const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
                return boldParts.map((bp, j) => {
                    const boldMatch = bp.match(/\*\*([^*]+)\*\*/);
                    if (boldMatch) {
                        return <strong key={`b-${i}-${j}`} className="font-black text-slate-900">{boldMatch[1]}</strong>;
                    }
                    return bp;
                });
            });
        };

        return content.split("\n").map((line, i) => {
            if (line.startsWith("# ")) return <h1 key={i} className="text-3xl font-black mb-6 mt-8 border-b-4 border-blue-100 pb-3 text-slate-900 tracking-tight">{line.slice(2)}</h1>;
            if (line.startsWith("## ")) return <h2 key={i} className="text-2xl font-bold mb-4 mt-8 text-slate-800 border-l-4 border-blue-500 pl-4">{line.slice(3)}</h2>;
            if (line.startsWith("### ")) return <h3 key={i} className="text-xl font-bold mb-3 mt-6 text-slate-800">{line.slice(4)}</h3>;
            if (line.startsWith("- ")) return <li key={i} className="ml-6 list-disc text-slate-600 mb-2 leading-relaxed">{renderInlineStyles(line.slice(2))}</li>;
            if (line.trim() === "") return <div key={i} className="h-4" />;
            return <p key={i} className="text-slate-600 leading-relaxed mb-4 text-base font-medium">{renderInlineStyles(line)}</p>;
        });
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Standard Operations
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-blue-600" />
                        業務フロー・マニュアル
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">誰でも同じ業務ができる。共通の標準化プロセスをここに蓄積します。</p>
                </div>
                <button
                    onClick={handleNew}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-sm shadow-xl hover:scale-105 transition-transform"
                >
                    <Plus className="w-4 h-4" />
                    手順を新規作成
                </button>
            </div>

            {businessManuals.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-20 text-center space-y-6">
                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                        <BookOpen className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-slate-800">マニュアルがまだありません</h3>
                        <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                            右上のボタンから、配送手順、在庫管理、経費の承認フローなど、<br />
                            チームで共有すべき業務マニュアルを追加しましょう。
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar / Navigation */}
                    <aside className="lg:col-span-1 space-y-10">
                        {categories.map(cat => (
                            <div key={cat} className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">{cat}</h3>
                                <div className="space-y-1.5 px-1">
                                    {businessManuals.filter(m => m.category === cat).sort((a, b) => a.order - b.order).map(manual => (
                                        <button
                                            key={manual.id}
                                            onClick={() => setSelectedId(manual.id)}
                                            className={`w-full flex items-center justify-between group px-4 py-3.5 rounded-2xl text-left text-sm font-bold transition-all ${selectedId === manual.id || (selectedId === null && activeManual?.id === manual.id)
                                                ? "bg-blue-600 text-white shadow-xl shadow-blue-200 scale-[1.02]"
                                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                                }`}
                                        >
                                            <span className="truncate pr-2">{manual.title}</span>
                                            <ArrowRightCircle className={`w-4 h-4 shrink-0 transition-all ${selectedId === manual.id || (selectedId === null && activeManual?.id === manual.id) ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0"}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </aside>

                    {/* Main Content Area */}
                    <main className="lg:col-span-3">
                        {activeManual ? (
                            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Content Header */}
                                <div className="p-8 pb-6 border-b border-slate-50 flex justify-between items-start sticky top-0 bg-white/80 backdrop-blur-md z-10 mx-2">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{activeManual.category}</span>
                                        <h2 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">{activeManual.title}</h2>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(activeManual)}
                                            className="p-3 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all"
                                            title="編集"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(activeManual.id, activeManual.title)}
                                            className="p-3 bg-slate-50 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                                            title="削除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-10 lg:p-14 space-y-14">
                                    {/* Markdown Content */}
                                    <div className="max-w-none">
                                        {activeManual.content ? renderMarkdown(activeManual.content) : (
                                            <div className="flex flex-col items-center justify-center py-24 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
                                                <AlertCircle className="w-10 h-10 text-slate-300 mb-4" />
                                                <p className="text-slate-400 text-sm font-medium">マニュアル本文が未入力です。「編集」ボタンから内容を追加してください。</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Internal Documents Section */}
                                    {attachedDocs.length > 0 && (
                                        <div className="pt-12 border-t border-slate-100">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-emerald-500" />
                                                社内関連書類（アーカイブ）
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                {attachedDocs.map((doc) => (
                                                    <a
                                                        key={doc.id}
                                                        href={doc.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-white hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300"
                                                    >
                                                        <div className="flex items-center gap-5">
                                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm transition-all group-hover:scale-110 group-hover:rotate-3 group-hover:bg-emerald-600 group-hover:text-white">
                                                                <BookOpen className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <div className="text-base font-black text-slate-700 tracking-tight group-hover:text-emerald-700 transition-colors line-clamp-1">{doc.title}</div>
                                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{doc.category}</div>
                                                            </div>
                                                        </div>
                                                        <ArrowRightCircle className="w-5 h-5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-emerald-600 transition-all -translate-x-4 group-hover:translate-x-0" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* External Links Section */}
                                    {activeManual.links && activeManual.links.length > 0 && (
                                        <div className="pt-12 border-t border-slate-100">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-blue-500" />
                                                関連リソース・外部リンク
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                {activeManual.links.map((link, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-white hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300"
                                                    >
                                                        <div className="flex items-center gap-5">
                                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm transition-all group-hover:scale-110 group-hover:rotate-3 group-hover:bg-blue-600 group-hover:text-white">
                                                                <ExternalLink className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-base font-black text-slate-700 tracking-tight group-hover:text-blue-700 transition-colors">{link.label || "無題のリンク"}</div>
                                                        </div>
                                                        <ArrowRightCircle className="w-5 h-5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-blue-600 transition-all -translate-x-4 group-hover:translate-x-0" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[500px] text-slate-300 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                                <BookOpen className="w-12 h-12 opacity-20 mb-4" />
                                <p className="text-sm font-bold tracking-tight">左のメニューからマニュアルを選択してください</p>
                            </div>
                        )}
                    </main>
                </div>
            )}

            {/* Modals */}
            <GuidelineEditorModal
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                manual={editingManual}
            />
        </div>
    );
}


import { Tag } from "lucide-react";
