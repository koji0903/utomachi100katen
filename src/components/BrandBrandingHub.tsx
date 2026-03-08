// src/components/BrandBrandingHub.tsx
"use client";

import { useState } from "react";
import { X, Sparkles, Copy, Check, BookOpen, Share2, AlertCircle, Quote, Save } from "lucide-react";
import { useStore, Brand } from "@/lib/store";

type BrandCopyMode = "manifesto" | "social" | "press";

interface BrandBrandingHubProps {
    isOpen: boolean;
    onClose: () => void;
    brand: Brand;
}

const MODES: { id: BrandCopyMode; label: string; icon: any; description: string; color: string }[] = [
    {
        id: "manifesto",
        label: "Manifesto",
        icon: Quote,
        description: "ブランドの理念・マニフェスト文",
        color: "blue",
    },
    {
        id: "social",
        label: "Social",
        icon: Share2,
        description: "ブランド公式SNS用紹介文",
        color: "violet",
    },
    {
        id: "press",
        label: "Press",
        icon: BookOpen,
        description: "プレスリリース・メディア向け紹介文",
        color: "emerald",
    },
];

const modeColorMap = {
    manifesto: { active: "bg-blue-600 text-white", ring: "ring-blue-500/20 border-blue-500", result: "border-blue-100 bg-blue-50/50" },
    social: { active: "bg-violet-600 text-white", ring: "ring-violet-500/20 border-violet-500", result: "border-violet-100 bg-violet-50/50" },
    press: { active: "bg-emerald-600 text-white", ring: "ring-emerald-500/20 border-emerald-500", result: "border-emerald-100 bg-emerald-50/50" },
};

export function BrandBrandingHub({ isOpen, onClose, brand }: BrandBrandingHubProps) {
    const { updateBrand } = useStore();

    const [activeMode, setActiveMode] = useState<BrandCopyMode>("manifesto");
    const [generatedCopy, setGeneratedCopy] = useState<Record<BrandCopyMode, string>>({
        manifesto: "",
        social: "",
        press: "",
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState("");

    // Local edits for brand story/concept if needed
    const [story, setStory] = useState(brand.story || "");

    if (!isOpen) return null;

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError("");
        try {
            const res = await fetch("/api/generate-copy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: activeMode,
                    name: brand.name,
                    concept: brand.concept, // Use brand.concept if not editing in this hub
                    story,
                    isBrandLevel: true, // Custom flag for API to adjust prompt
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError("生成に失敗しました。時間をおいて再度お試しください。");
                return;
            }
            setGeneratedCopy(prev => ({ ...prev, [activeMode]: data.copy || "" }));
        } catch (_e) {
            setError("接続エラーが発生しました。");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateBrand(brand.id, {
                story,
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
        } catch (_e) {
            alert("保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopy = async () => {
        const text = generatedCopy[activeMode];
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const currentCopy = generatedCopy[activeMode];
    const colors = modeColorMap[activeMode];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">ブランド・ブランディング</h2>
                            <p className="text-xs text-slate-500 font-medium">ブランド名: {brand.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-2">
                                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                                ブランドの想い（AIへのインプット）
                            </label>
                            <textarea
                                rows={4}
                                value={story}
                                onChange={(e) => setStory(e.target.value)}
                                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 focus:bg-white resize-none"
                                placeholder="ブランドの背景、共通の想い、大切にしていることを入力してください..."
                            />
                        </div>

                        {/* Save button */}
                        <button onClick={handleSave} disabled={isSaving}
                            className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${saveSuccess ? "bg-emerald-600 text-white" : "bg-slate-800 text-white hover:bg-slate-700"} disabled:opacity-50`}>
                            {saveSuccess ? <><Check className="w-4 h-4" /> 保存しました</> : isSaving ? "保存中..." : <><Save className="w-4 h-4" /> ブランド情報を保存</>}
                        </button>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <div className="flex gap-1.5 mb-4 p-1 bg-slate-100 rounded-xl">
                            {MODES.map(mode => {
                                const Icon = mode.icon;
                                const isActive = activeMode === mode.id;
                                return (
                                    <button key={mode.id} onClick={() => setActiveMode(mode.id)}
                                        className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${isActive ? modeColorMap[mode.id].active : "text-slate-500 hover:bg-slate-200"}`}>
                                        <Icon className="w-3.5 h-3.5" />
                                        {mode.label}
                                    </button>
                                );
                            })}
                        </div>

                        <button onClick={handleGenerate} disabled={isGenerating}
                            className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20">
                            {isGenerating ? (
                                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 生成中...</>
                            ) : (
                                <><Sparkles className="w-4 h-4" /> AIでマニフェストを生成する</>
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                        </div>
                    )}

                    <div className={`rounded-xl border p-5 min-h-[200px] relative transition-all ${currentCopy ? colors.result : "bg-slate-50 border-slate-200"}`}>
                        {currentCopy ? (
                            <>
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap italic font-serif tracking-wide">{currentCopy}</p>
                                <button onClick={handleCopy}
                                    className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                                    {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> コピー済</> : <><Copy className="w-3.5 h-3.5" /> コピー</>}
                                </button>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center gap-2 py-12">
                                <Quote className="w-8 h-8 opacity-20" />
                                <p className="text-xs">ブランドの想いを入力し、<br />AIでマニフェストを生成してください</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
