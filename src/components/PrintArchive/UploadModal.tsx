"use client";

import { useState } from "react";
import { X, Upload, FileText, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { ArchiveCategory } from "@/lib/types/printArchive";
import { showNotification } from "@/lib/notifications";
import { apiFetch } from "@/lib/apiClient";

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CATEGORIES: ArchiveCategory[] = ['出荷伝票', '請求書', '領収書', '納品書', 'その他'];

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
    const { addPrintArchive } = useStore();
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState<ArchiveCategory>('その他');
    const [memo, setMemo] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== "application/pdf") {
                showNotification("PDFファイルのみアップロード可能です。");
                return;
            }
            setFile(selectedFile);
            if (!title) {
                setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title) return;

        setIsUploading(true);
        
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folderPath", "print-archives");

            const response = await apiFetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "アップロードに失敗しました。");
            }

            const { url, storagePath } = result;

            await addPrintArchive({
                title,
                fileName: file.name,
                fileUrl: url,
                storagePath: storagePath, 
                category,
                memo,
                tags: [] // Tags can be added later
            });

            showNotification("アーカイブを追加しました。");
            onClose();
            // Reset form
            setFile(null);
            setTitle("");
            setCategory('その他');
            setMemo("");
        } catch (error: any) {
            console.error(error);
            showNotification(error.message || "エラーが発生しました。");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-900">新規アップロード</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* File Upload Area */}
                    <div className="relative">
                        <label className="block text-sm font-bold text-slate-700 mb-2">PDFファイル</label>
                        <div className={`relative border-2 border-dashed rounded-xl transition-all ${file ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-400 bg-slate-50'}`}>
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isUploading}
                            />
                            <div className="p-8 text-center">
                                {file ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <FileText className="w-10 h-10 text-indigo-500" />
                                        <div className="text-sm font-bold text-slate-900 truncate max-w-full italic px-4">
                                            {file.name}
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={(e) => { e.preventDefault(); setFile(null); }}
                                            className="text-xs text-red-500 hover:underline mt-1"
                                        >
                                            ファイルを変更する
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Upload className="w-10 h-10 text-slate-400" />
                                        <div className="text-sm text-slate-500">
                                            クリックまたはドラッグ＆ドロップでPDFを選択
                                        </div>
                                        <div className="text-xs text-slate-400">PDFのみ対応 (最大20MB)</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">タイトル</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            placeholder="文書のタイトルを入力"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                            disabled={isUploading}
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">カテゴリー</label>
                        <div className="grid grid-cols-3 gap-2">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategory(cat)}
                                    className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${category === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                    disabled={isUploading}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Memo */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">メモ (任意)</label>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            rows={3}
                            placeholder="保管に関するメモなど..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium resize-none"
                            disabled={isUploading}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95"
                            disabled={isUploading}
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={!file || !title || isUploading}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 ${isUploading ? 'cursor-not-allowed' : 'hover:bg-indigo-700 shadow-indigo-200'}`}
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    アップロード中...
                                </>
                            ) : (
                                "保存する"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
