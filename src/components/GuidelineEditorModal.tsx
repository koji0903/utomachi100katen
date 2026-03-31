"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Link as LinkIcon, BookOpen, Save, Bold, Heading1, Heading2, Heading3, List } from "lucide-react";
import { useStore, BusinessManual } from "@/lib/store";
import { showNotification } from "@/lib/notifications";

interface GuidelineEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    manual?: BusinessManual;
}

export function GuidelineEditorModal({ isOpen, onClose, manual }: GuidelineEditorModalProps) {
    const { addBusinessManual, updateBusinessManual } = useStore();
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("");
    const [content, setContent] = useState("");
    const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
    const [isPreview, setIsPreview] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (manual) {
            setTitle(manual.title);
            setCategory(manual.category);
            setContent(manual.content);
            setLinks(manual.links || []);
        } else {
            setTitle("");
            setCategory("");
            setContent("");
            setLinks([]);
        }
        setIsPreview(false);
    }, [manual, isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!title.trim() || !category.trim()) {
            showNotification("タイトルとカテゴリーは必須です。", "error");
            return;
        }

        try {
            if (manual) {
                await updateBusinessManual(manual.id, {
                    title,
                    category,
                    content,
                    links,
                    order: manual.order || 0
                });
                showNotification("マニュアルを更新しました。");
            } else {
                await addBusinessManual({
                    title,
                    category,
                    content,
                    links,
                    order: Date.now() // Simple ordering
                });
                showNotification("マニュアルを新規作成しました。");
            }
            onClose();
        } catch (error) {
            console.error(error);
            showNotification("データの保存に失敗しました。", "error");
        }
    };

    const addLink = () => {
        setLinks([...links, { label: "", url: "" }]);
    };

    const updateLink = (index: number, field: "label" | "url", value: string) => {
        const newLinks = [...links];
        newLinks[index][field] = value;
        setLinks(newLinks);
    };

    const removeLink = (index: number) => {
        setLinks(links.filter((_, i) => i !== index));
    };

    const insertMarkdown = (type: 'bold' | 'h1' | 'h2' | 'h3' | 'list' | 'link') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        let prefix = "";
        let suffix = "";
        let skipFocus = false;

        switch (type) {
            case 'bold': prefix = "**"; suffix = "**"; break;
            case 'h1': prefix = "# "; break;
            case 'h2': prefix = "## "; break;
            case 'h3': prefix = "### "; break;
            case 'list': prefix = "- "; break;
            case 'link':
                const label = prompt("表示する文字を入力してください", selectedText) || "リンク";
                const url = prompt("URLを入力してください", "https://");
                if (url) {
                    prefix = `[${label}](${url})`;
                    suffix = "";
                    // Special case for link insertion: we replace selected text if it was used as label
                    const newContent = content.substring(0, start) + prefix + content.substring(end);
                    setContent(newContent);
                    skipFocus = true;
                } else {
                    return;
                }
                break;
        }

        if (!skipFocus) {
            const newContent = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
            setContent(newContent);
            
            // Re-focus and set selection
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(
                    start + prefix.length,
                    start + prefix.length + selectedText.length
                );
            }, 10);
        }
    };

    // Very basic markdown partial renderer for preview
    const renderPreview = (text: string) => {
        const renderInlineStyles = (line: string) => {
            // 1. Split by links [label](url)
            const parts = line.split(/(\[[^\]]+\]\([^)]+\))/g);
            return parts.flatMap((part, i) => {
                const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
                if (linkMatch) {
                    return (
                        <a key={`l-${i}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">
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

        return text.split("\n").map((line, i) => {
            if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-black mb-4 mt-6 border-b pb-2">{line.slice(2)}</h1>;
            if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mb-3 mt-5">{line.slice(3)}</h2>;
            if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-bold mb-2 mt-4">{line.slice(4)}</h3>;
            if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc text-slate-700">{renderInlineStyles(line.slice(2))}</li>;
            if (line.trim() === "") return <br key={i} />;
            return <p key={i} className="text-slate-600 leading-relaxed mb-2">{renderInlineStyles(line)}</p>;
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800">{manual ? "マニュアルを編集" : "新規マニュアル作成"}</h2>
                            <p className="text-xs text-slate-400 font-medium tracking-tight">Markdown形式で業務手順を記載します</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">カテゴリー</label>
                            <input
                                type="text"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="例: 出荷作業, 店舗運営, 事務"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">タイトル</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="例: 注文確定から発送までの流れ"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">マニュアル本文</label>
                            <button
                                onClick={() => setIsPreview(!isPreview)}
                                className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all border ${isPreview ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                            >
                                {isPreview ? "編集に戻る" : "プレビューを表示"}
                            </button>
                        </div>

                        {isPreview ? (
                            <div className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl min-h-[300px] prose prose-slate">
                                {content ? renderPreview(content) : <p className="text-slate-300 italic">本文が空です</p>}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Toolbar */}
                                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 transition-all focus-within:ring-2 focus-within:ring-blue-500/20">
                                    <button 
                                        onClick={() => insertMarkdown('bold')} 
                                        className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 hover:text-blue-600 transition-all" 
                                        title="太字"
                                    >
                                        <Bold className="w-4 h-4" />
                                    </button>
                                    <div className="w-px h-4 bg-slate-200 mx-1" />
                                    <button 
                                        onClick={() => insertMarkdown('h1')} 
                                        className="px-2 py-1.5 hover:bg-white hover:shadow-sm rounded-xl text-[10px] font-black text-slate-600 hover:text-blue-600 transition-all"
                                        title="大見出し"
                                    >
                                        H1
                                    </button>
                                    <button 
                                        onClick={() => insertMarkdown('h2')} 
                                        className="px-2 py-1.5 hover:bg-white hover:shadow-sm rounded-xl text-[10px] font-black text-slate-600 hover:text-blue-600 transition-all"
                                        title="中見出し"
                                    >
                                        H2
                                    </button>
                                    <button 
                                        onClick={() => insertMarkdown('h3')} 
                                        className="px-2 py-1.5 hover:bg-white hover:shadow-sm rounded-xl text-[10px] font-black text-slate-600 hover:text-blue-600 transition-all"
                                        title="小見出し"
                                    >
                                        H3
                                    </button>
                                    <div className="w-px h-4 bg-slate-200 mx-1" />
                                    <button 
                                        onClick={() => insertMarkdown('list')} 
                                        className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 hover:text-blue-600 transition-all"
                                        title="リスト"
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => insertMarkdown('link')} 
                                        className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 hover:text-blue-600 transition-all"
                                        title="リンク挿入"
                                    >
                                        <LinkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <textarea
                                    ref={textareaRef}
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="ここからマニュアルを作成... ツールバーを使って簡単に装飾できます。"
                                    className="w-full h-[350px] p-6 bg-slate-50 border border-slate-200 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono text-sm leading-relaxed"
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">外部リンク (関連マニュアルや資料など)</label>
                            <button
                                onClick={addLink}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                リンクを追加
                            </button>
                        </div>

                        <div className="space-y-3">
                            {links.map((link, idx) => (
                                <div key={idx} className="flex gap-3 animate-in slide-in-from-right-2 duration-200">
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={link.label}
                                                onChange={(e) => updateLink(idx, "label", e.target.value)}
                                                placeholder="表示名称 (例: Shopify管理画面)"
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm font-medium"
                                            />
                                        </div>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                                <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={link.url}
                                                onChange={(e) => updateLink(idx, "url", e.target.value)}
                                                placeholder="URL (https://...)"
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm font-mono"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeLink(idx)}
                                        className="p-2.5 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all self-center"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {links.length === 0 && (
                                <p className="text-center py-6 text-slate-300 text-xs italic border-2 border-dashed border-slate-100 rounded-2xl">
                                    リンクは登録されていません
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all"
                    >
                        <Save className="w-4 h-4" />
                        保存して公開
                    </button>
                </div>
            </div>
        </div>
    );
}
