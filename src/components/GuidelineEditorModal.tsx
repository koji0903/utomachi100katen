"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Link as LinkIcon, BookOpen, Save } from "lucide-react";
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

    // Very basic markdown partial renderer for preview
    const renderPreview = (text: string) => {
        return text.split("\n").map((line, i) => {
            if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-black mb-4 mt-6 border-b pb-2">{line.slice(2)}</h1>;
            if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mb-3 mt-5">{line.slice(3)}</h2>;
            if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-bold mb-2 mt-4">{line.slice(4)}</h3>;
            if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc text-slate-700">{line.slice(2)}</li>;
            if (line.trim() === "") return <br key={i} />;
            return <p key={i} className="text-slate-600 leading-relaxed mb-2">{line}</p>;
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
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">マニュアル本文（Markdown）</label>
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
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="# 手順の概要\n1. ○○を行う\n2. △△を確認する\n\n## 注意点\n- □□は忘れずに！"
                                className="w-full h-[300px] p-6 bg-slate-50 border border-slate-200 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono text-sm leading-relaxed"
                            />
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
