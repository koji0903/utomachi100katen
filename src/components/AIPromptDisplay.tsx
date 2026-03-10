"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, Terminal } from "lucide-react";

interface AIPromptDisplayProps {
    prompt: string;
    title?: string;
}

export function AIPromptDisplay({ prompt, title = "AI プロンプトを表示" }: AIPromptDisplayProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!prompt) return null;

    return (
        <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-200">
            <div
                className="flex items-center justify-between px-4 py-2.5 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">{title}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCopy();
                        }}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${copied
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 active:scale-95"
                            }`}
                    >
                        {copied ? (
                            <><Check className="w-3 h-3" /> コピー済</>
                        ) : (
                            <><Copy className="w-3 h-3" /> プロンプトをコピー</>
                        )}
                    </button>
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="p-4 bg-slate-900 border-t border-slate-800 animate-in slide-in-from-top-1 duration-200">
                    <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed break-all">
                        {prompt}
                    </pre>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-all"
                        >
                            {copied ? (
                                <><Check className="w-3.5 h-3.5 text-emerald-400" /> コピー完了</>
                            ) : (
                                <><Copy className="w-3.5 h-3.5" /> 全文をコピーして外部AIで使う</>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
