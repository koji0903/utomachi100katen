// src/components/Expenses/FilePreviewModal.tsx
"use client";

import { X, ExternalLink, Download, FileText, Loader2, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";

interface FilePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    fileType?: string; // Optional: can be derived from URL extension or explicitly passed
    fileName?: string;
}

export function FilePreviewModal({ isOpen, onClose, fileUrl, fileType, fileName }: FilePreviewModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Derive file type from URL if not provided
    const derivedType = fileType || (
        fileUrl.toLowerCase().includes(".pdf") ? "application/pdf" : 
        fileUrl.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|svg)$/) ? "image" : "unknown"
    );

    const isPdf = derivedType === "application/pdf" || fileUrl.toLowerCase().endsWith(".pdf");
    const isImage = derivedType === "image" || !isPdf; // Default to image if not PDF for broader support

    useEffect(() => {
        if (!isOpen) return;
        setIsLoading(true);
        setError(null);
    }, [isOpen, fileUrl]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-rose-50 rounded-xl">
                            {isPdf ? <FileText className="w-6 h-6 text-rose-500" /> : <Loader2 className="w-6 h-6 text-rose-500" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900">プレビュー</h2>
                            <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mt-0.5">{fileName || (isPdf ? "PDF Document" : "Receipt Image")}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <a 
                            href={fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-2"
                            title="別ウィンドウで開く"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                        <button 
                            onClick={onClose}
                            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-slate-50/50 p-4 md:p-8 flex items-center justify-center relative overflow-hidden">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-50/80">
                            <Loader2 className="w-12 h-12 text-rose-500 animate-spin mb-4" />
                            <p className="text-sm font-bold text-slate-500">ファイルを読み込んでいます...</p>
                        </div>
                    )}

                    {isPdf ? (
                        <iframe 
                            src={`${fileUrl}#toolbar=0&navpanes=0`}
                            className="w-full h-full border-0 rounded-2xl shadow-sm bg-white"
                            onLoad={() => setIsLoading(false)}
                            onError={() => {
                                setError("PDFの読み込みに失敗しました");
                                setIsLoading(false);
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <img 
                                src={fileUrl} 
                                alt="Receipt Preview" 
                                className="max-w-full max-h-full object-contain rounded-2xl shadow-xl transition-transform"
                                onLoad={() => setIsLoading(false)}
                                onError={() => {
                                    setError("画像の読み込みに失敗しました");
                                    setIsLoading(false);
                                }}
                            />
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-rose-50/50 backdrop-blur-sm">
                            <div className="p-4 bg-white rounded-3xl shadow-xl border border-rose-100 flex flex-col items-center gap-4 text-center max-w-sm">
                                <div className="p-3 bg-rose-50 rounded-full">
                                    <X className="w-8 h-8 text-rose-500" />
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 mb-1">{error}</p>
                                    <p className="text-xs text-slate-500">ブラウザの設定により表示できない場合があります</p>
                                </div>
                                <button 
                                    onClick={() => window.open(fileUrl, '_blank')}
                                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    別タブで開いて確認する
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-center gap-6 bg-white shrink-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Full Preview System Integrated</p>
                </div>
            </div>
        </div>
    );
}
