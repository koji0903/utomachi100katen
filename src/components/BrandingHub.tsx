"use client";

import { useState, useRef } from "react";
import { X, Sparkles, Copy, Check, ChevronRight, BookOpen, ShoppingBag, Share2, AlertCircle, UploadCloud, Image as ImageIcon, Printer, Download, Video } from "lucide-react";
import { useStore, Product } from "@/lib/store";
import { uploadImageWithCompression, ensureProcessableImage } from "@/lib/imageUpload";
import { QRCodeSVG } from "qrcode.react";
import { POP_STYLES, POPStyle } from "@/lib/popStyles";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type CopyMode = "marketplace" | "story" | "social" | "pop" | "video";

interface BrandingHubProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const MODES: { id: CopyMode; label: string; icon: any; description: string; color: string }[] = [
    {
        id: "marketplace",
        label: "Marketplace",
        icon: ShoppingBag,
        description: "Amazon・Shopify向け SEO商品説明文",
        color: "blue",
    },
    {
        id: "story",
        label: "Story",
        icon: BookOpen,
        description: "HP・ブログ向けコラム文",
        color: "emerald",
    },
    {
        id: "social",
        label: "Social",
        icon: Share2,
        description: "SNS投稿文＋ハッシュタグ",
        color: "violet",
    },
    {
        id: "pop",
        label: "POP",
        icon: Printer,
        description: "店頭用POP・棚札の作成",
        color: "amber",
    },
    {
        id: "video",
        label: "Video",
        icon: Video,
        description: "ショート動画・リール用台本案",
        color: "rose",
    },
];

const modeColorMap = {
    marketplace: { active: "bg-blue-600 text-white", ring: "ring-blue-500/20 border-blue-500", result: "border-blue-100 bg-blue-50/50" },
    story: { active: "bg-emerald-600 text-white", ring: "ring-emerald-500/20 border-emerald-500", result: "border-emerald-100 bg-emerald-50/50" },
    social: { active: "bg-violet-600 text-white", ring: "ring-violet-500/20 border-violet-500", result: "border-violet-100 bg-violet-50/50" },
    pop: { active: "bg-amber-600 text-white", ring: "ring-amber-500/20 border-amber-500", result: "border-amber-100 bg-amber-50/50" },
    video: { active: "bg-rose-600 text-white", ring: "ring-rose-500/20 border-rose-500", result: "border-rose-100 bg-rose-50/50" },
};

export function BrandingHub({ isOpen, onClose, product }: BrandingHubProps) {
    const { brands, suppliers, updateProduct } = useStore();

    const brand = brands.find(b => b.id === product.brandId);

    const [activeMode, setActiveMode] = useState<CopyMode>("marketplace");
    const [generatedCopy, setGeneratedCopy] = useState<Record<CopyMode, string>>({
        marketplace: "",
        story: "",
        social: "",
        pop: "",
        video: "",
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState("");

    // POP states
    const [activePopStyle, setActivePopStyle] = useState<POPStyle>(POP_STYLES[0]);
    const popRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Story fields (local edits before saving)
    const [producerStory, setProducerStory] = useState(product.producerStory || "");
    const [regionBackground, setRegionBackground] = useState(product.regionBackground || "");
    const [servingSuggestion, setServingSuggestion] = useState(product.servingSuggestion || "");

    // Story image
    const storyImageInputRef = useRef<HTMLInputElement>(null);
    const [storyImagePreview, setStoryImagePreview] = useState<string | null>(product.storyImageUrl || null);
    const [storyImageFile, setStoryImageFile] = useState<File | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

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
                    name: product.name,
                    variant: product.variantName,
                    brand: brand?.name || "",
                    producerStory,
                    regionBackground,
                    servingSuggestion,
                    story: product.story,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (data.error === "quota_exceeded" || res.status === 429) {
                    setError("本日の無料利用枠を使い切りました。明日以降に再度お試しください（またはAPIキーの有料プランを有効にしてください）。");
                } else {
                    setError("生成に失敗しました。APIキーの設定をご確認ください。");
                }
                return;
            }
            setGeneratedCopy(prev => ({ ...prev, [activeMode]: data.copy || "" }));
        } catch (_e) {
            setError("接続エラーが発生しました。ネットワークをご確認ください。");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = async () => {
        const text = generatedCopy[activeMode];
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleStoryImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const processed = await ensureProcessableImage(file);
            setStoryImageFile(processed);
            setStoryImagePreview(URL.createObjectURL(processed));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let storyImageUrl = product.storyImageUrl || "";
            if (storyImageFile) {
                setIsUploadingImage(true);
                storyImageUrl = await uploadImageWithCompression(storyImageFile);
                setIsUploadingImage(false);
            }
            await updateProduct(product.id, {
                producerStory,
                regionBackground,
                servingSuggestion,
                storyImageUrl,
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
        } catch (error: any) {
            console.error("Failed to save branding info:", error);
            alert("保存に失敗しました。\n詳細: " + (error.message || "不明なエラー"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportPDF = async () => {
        if (!popRef.current) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(popRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: null,
            });
            const imgData = canvas.toDataURL("image/png");
            // A4 size: 210mm x 297mm. Simple landscape POP: e.g. 148mm x 105mm (A6)
            const pdf = new jsPDF("l", "mm", "a6");
            const width = pdf.internal.pageSize.getWidth();
            const height = pdf.internal.pageSize.getHeight();
            pdf.addImage(imgData, "PNG", 0, 0, width, height);
            pdf.save(`POP_${product.name}_${activePopStyle.id}.pdf`);
        } catch (e) {
            console.error(e);
            alert("PDFの書き出しに失敗しました。");
        } finally {
            setIsExporting(false);
        }
    };

    const currentCopy = generatedCopy[activeMode];
    const colors = modeColorMap[activeMode];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">BRANDING HUB</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                <span className="text-[#1e3a8a]">{product.name}</span>
                                {product.variantName && ` • ${product.variantName}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all active:scale-90 border border-transparent hover:border-slate-100">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

                        {/* Left: Story Input Fields */}
                        <div className="p-6 space-y-5">
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-emerald-500" />
                                    ストーリー情報
                                    <span className="text-xs font-normal text-slate-400 ml-1">— AIへの入力情報として使われます</span>
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1.5">生産者の思い</label>
                                        <textarea rows={3} value={producerStory}
                                            onChange={e => setProducerStory(e.target.value)}
                                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white resize-none"
                                            placeholder="例: 何十年も海苔と向き合ってきた。手間を惜しまないことが信条です…" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1.5">地域背景</label>
                                        <textarea rows={3} value={regionBackground}
                                            onChange={e => setRegionBackground(e.target.value)}
                                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white resize-none"
                                            placeholder="例: 熊本県宇土市は有明海に面し、古くから海苔の名産地として知られる…" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1.5">おすすめの食べ方</label>
                                        <textarea rows={2} value={servingSuggestion}
                                            onChange={e => setServingSuggestion(e.target.value)}
                                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white resize-none"
                                            placeholder="例: 炊き立てごはんに巻いて、素材の風味をそのままお楽しみください" />
                                    </div>
                                </div>
                            </div>

                            {/* Story image */}
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">ストーリー写真</label>
                                <div
                                    onClick={() => storyImageInputRef.current?.click()}
                                    className="w-full h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-violet-400 transition-all overflow-hidden relative group"
                                >
                                    {storyImagePreview ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={storyImagePreview} alt="Story" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-white text-xs font-medium flex items-center gap-1"><UploadCloud className="w-3.5 h-3.5" /> 変更</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center text-slate-400">
                                            <ImageIcon className="w-7 h-7 mx-auto mb-1 text-slate-300" />
                                            <p className="text-xs">生産者・風景写真をアップロード</p>
                                        </div>
                                    )}
                                    <input type="file" ref={storyImageInputRef} onChange={handleStoryImageChange} accept="image/*,.heic,.heif" className="hidden" />
                                </div>
                            </div>

                            {/* Save button */}
                            <button onClick={handleSave} disabled={isSaving || isUploadingImage}
                                className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${saveSuccess ? "bg-emerald-600 text-white" : "bg-slate-800 text-white hover:bg-slate-700"} disabled:opacity-50`}>
                                {saveSuccess ? <><Check className="w-4 h-4" /> 保存しました</> : isSaving ? "保存中..." : "ストーリー情報を保存"}
                            </button>
                        </div>

                        {/* Right: AI Copy Generation */}
                        <div className="p-6 space-y-5">
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-violet-500" />
                                    AIコピーライティング
                                </h3>

                                {/* Mode Tabs */}
                                <div className="flex gap-1.5 mb-4">
                                    {MODES.map(mode => {
                                        const Icon = mode.icon;
                                        const isActive = activeMode === mode.id;
                                        return (
                                            <button key={mode.id} onClick={() => setActiveMode(mode.id)}
                                                className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${isActive ? modeColorMap[mode.id].active : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                                                <Icon className="w-3.5 h-3.5" />
                                                {mode.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-slate-500 mb-4 pl-1">
                                    <ChevronRight className="w-3 h-3 inline text-slate-400" />
                                    {MODES.find(m => m.id === activeMode)?.description}
                                </p>

                                {/* Generate Button */}
                                <button onClick={handleGenerate} disabled={isGenerating}
                                    className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-700 hover:to-blue-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-500/20">
                                    {isGenerating ? (
                                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 生成中...</>
                                    ) : (
                                        <><Sparkles className="w-4 h-4" /> AIでPR文章を生成する</>
                                    )}
                                </button>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                                </div>
                            )}

                            {/* Result Area */}
                            <div className={`rounded-xl border p-4 min-h-[200px] relative transition-all ${currentCopy || activeMode === 'pop' ? colors.result : "bg-slate-50 border-slate-200"}`}>
                                {activeMode === 'pop' ? (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {POP_STYLES.map(style => (
                                                <button key={style.id} onClick={() => setActivePopStyle(style)}
                                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${activePopStyle.id === style.id ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                                                    {style.name}
                                                </button>
                                            ))}
                                        </div>

                                        {/* POP Preview Area */}
                                        <div ref={popRef} className={`w-full aspect-[1.414/1] ${activePopStyle.bgColor} ${activePopStyle.textColor} p-8 ${activePopStyle.borderStyle} ${activePopStyle.accentColor} relative overflow-hidden flex flex-col justify-between shadow-lg`}>
                                            <div className="relative z-10">
                                                <div className={`text-[10px] uppercase tracking-[0.3em] font-bold opacity-60 mb-1`}>{brand?.name || "Premium Selection"}</div>
                                                <h1 className={`text-3xl ${activePopStyle.fontFamily} font-black leading-tight mb-2 underline decoration-amber-500/50`}>{product.name}</h1>
                                                <p className="text-xs leading-relaxed line-clamp-4 font-medium opacity-90">{generatedCopy.pop || currentCopy || product.story || "こだわりの逸品をお届けします。"}</p>
                                            </div>

                                            <div className="flex justify-between items-end relative z-10">
                                                <div>
                                                    <div className="text-[10px] font-bold opacity-60">PRICE</div>
                                                    <div className={`text-4xl font-black italic ${activePopStyle.fontFamily}`}>
                                                        <span className="text-lg mr-0.5 NOT-italic">¥</span>
                                                        {product.sellingPrice.toLocaleString()}
                                                        <span className="text-xs ml-1 font-bold">(税込)</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="p-1 px-1 bg-white rounded shadow-sm">
                                                        <QRCodeSVG value={`https://utomachi.example.jp/products/${product.id}`} size={48} />
                                                    </div>
                                                    <div className="text-[8px] font-bold tracking-tighter opacity-70">STORY READ</div>
                                                </div>
                                            </div>

                                            {/* Decorative Elements */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mr-16 -mt-16 blur-xl" />
                                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full -ml-12 -mb-12 blur-xl" />
                                        </div>

                                        <button onClick={handleExportPDF} disabled={isExporting}
                                            className="w-full py-2.5 rounded-lg text-sm font-bold bg-slate-800 text-white hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                                            {isExporting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 作成中...</> : <><Download className="w-4 h-4" /> PDFでPOPをダウンロード</>}
                                        </button>
                                    </div>
                                ) : currentCopy ? (
                                    <>
                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{currentCopy}</p>
                                        <button onClick={handleCopy}
                                            className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                                            {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> コピー済</> : <><Copy className="w-3.5 h-3.5" /> コピー</>}
                                        </button>
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center gap-2 py-8">
                                        <Sparkles className="w-8 h-8" />
                                        <p className="text-xs">左側にストーリー情報を入力し、<br />「AIでPR文章を生成する」を押してください</p>
                                    </div>
                                )}
                            </div>

                            {/* Brand Guidelines badge */}
                            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-[10px] text-amber-700">
                                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                                <span>{activeMode === 'pop' ? "POPにはQRコードが自動付与され、スマートフォンから物語を読めるようになります" : "全モードに「地域文化 × 丁寧さ × 少しの遊び心」「ヒトとモノをつなぐ架け橋」のブランドガイドラインが自動注入されます"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
