// src/components/Expenses/ExpenseUploadModal.tsx
"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { 
    X, Upload, FileText, Loader2, Check, 
    Receipt, Store, Calendar, CreditCard, 
    Plus, Tag, Camera, RefreshCcw, Maximize2, Sparkles, Scan
} from "lucide-react";
import { useStore } from "@/lib/store";
import { uploadImageWithCompression } from "@/lib/imageUpload";
import { Expense, ExpenseCategory, PaymentMethod } from "@/lib/types/expense";
import { showNotification } from "@/lib/notifications";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { FilePreviewModal } from "./FilePreviewModal";
import { ensureProcessableImage } from "@/lib/imageUpload";
import { scanReceipt, loadOpenCV } from "@/lib/imageScanner";
import imageCompression from "browser-image-compression";
import { apiFetch, DemoModeError } from "@/lib/apiClient";

interface ExpenseUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CATEGORIES: ExpenseCategory[] = ['備品', '消耗品', '飲食費', '交通費', '通信費', '光熱費', '広告宣伝費', '支払手数料', 'その他'];

export function ExpenseUploadModal({ isOpen, onClose }: ExpenseUploadModalProps) {
    const { addExpense } = useStore();
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanStatus, setScanStatus] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state (AI will fill these)
    const [date, setDate] = useState("");
    const [vendor, setVendor] = useState("");
    const [amount, setAmount] = useState<number>(0);
    const [item, setItem] = useState("");
    const [category, setCategory] = useState<ExpenseCategory>('消耗品');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('小口現金');
    const [memo, setMemo] = useState("");

    const [isAnalyzed, setIsAnalyzed] = useState(false);
    const [analyzedFields, setAnalyzedFields] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'preview' | 'form'>('preview');

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const objectUrl = useMemo(() => {
        if (!file) return null;
        return URL.createObjectURL(file);
    }, [file]);

    // Cleanup object URL
    useEffect(() => {
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [objectUrl]);

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setIsAnalyzing(true);
        try {
            // 1. Format correction (HEIC -> JPEG)
            let processedFile = await ensureProcessableImage(selectedFile);
            
            // 2. Pre-resize before scanning for better performance and memory safety
            if (processedFile.type.startsWith('image/')) {
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1280, // Downsample early
                    useWebWorker: true,
                };
                try {
                    processedFile = await imageCompression(processedFile, options);
                } catch (ce) {
                    console.warn("[ExpenseUpload] Early compression failed:", ce);
                }
            }

            // 3. Receipt Scanner (Automatic Crop & Warp)
            if (processedFile.type.startsWith('image/')) {
                setIsScanning(true);
                setScanProgress(0);
                setScanStatus("準備中...");
                try {
                    // Start pre-loading OpenCV just in case
                    loadOpenCV().catch(e => console.warn("OpenCV preload failed:", e));

                    const scannedFile = await scanReceipt(processedFile, (p) => {
                        setScanProgress(p.percent);
                        setScanStatus(p.message);
                    });
                    processedFile = scannedFile;
                } catch (se) {
                    console.warn("[ExpenseUpload] Scanning failed, using original:", se);
                } finally {
                    setIsScanning(false);
                }
            }

            setFile(processedFile);
            analyzeFile(processedFile);
        } catch (error: any) {
            console.error("[ExpenseUpload] Error processing file:", error);
            showNotification(`ファイルの処理に失敗しました: ${error.message}`);
            setIsAnalyzing(false);
            setIsScanning(false);
        }
    };

    const analyzeFile = async (selectedFile: File) => {
        setIsAnalyzing(true);
        setIsAnalyzed(false);
        setAnalyzedFields(new Set());
        
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);

            const response = await apiFetch("/api/expenses/analyze", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("AI分析に失敗しました");
            }

            const data = await response.json();
            
            const newAnalyzedFields = new Set<string>();
            
            // Fill form with AI results
            if (data.date) {
                setDate(data.date);
                newAnalyzedFields.add("date");
            }
            if (data.vendor) {
                setVendor(data.vendor);
                newAnalyzedFields.add("vendor");
            }
            if (data.amount) {
                setAmount(data.amount);
                newAnalyzedFields.add("amount");
            }
            if (data.item) {
                setItem(data.item);
                newAnalyzedFields.add("item");
            }
            if (data.category && CATEGORIES.includes(data.category)) {
                setCategory(data.category as ExpenseCategory);
                newAnalyzedFields.add("category");
            }
            if (data.paymentMethod && (data.paymentMethod === 'クレジット' || data.paymentMethod === '小口現金')) {
                setPaymentMethod(data.paymentMethod as PaymentMethod);
                newAnalyzedFields.add("paymentMethod");
            }
            
            setAnalyzedFields(newAnalyzedFields);
            setIsAnalyzed(true);
            showNotification("AIによる解析が完了しました。内容を確認してください。");
            // Auto-switch to form tab on mobile after analysis
            setActiveTab('form');
        } catch (error: any) {
            if (error instanceof DemoModeError) {
                showNotification(error.message);
            } else {
                console.error(error);
                showNotification(`AI解析に失敗しました`);
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !amount || !item) {
            showNotification("必須項目を入力してください。");
            return;
        }

        setIsSaving(true);
        try {
            let fileUrl = "";
            let storagePath = "";
            
            // 1. Upload to Storage if file exists
            if (file) {
                fileUrl = await uploadImageWithCompression(file, "receipts");
                // Note: storagePath is optional now as we use the Proxy URL
            }

            // 2. Save to Firestore
            await addExpense({
                date,
                vendor,
                amount,
                item,
                category,
                paymentMethod,
                type: '支払',
                memo,
                fileUrl: fileUrl || undefined,
                storagePath: storagePath || undefined,
                isAnalyzed: !!file && isAnalyzed,
                isConfirmed: true,
                isTrashed: false,
            });

            showNotification("支出を記録しました。");
            resetState();
            onClose();
        } catch (error: any) {
            console.error(error);
            showNotification(`保存に失敗しました。\n詳細: ${error.message || "不明なエラー"}`, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const resetState = () => {
        setFile(null);
        setDate("");
        setVendor("");
        setAmount(0);
        setItem("");
        setCategory('消耗品');
        setPaymentMethod('小口現金');
        setMemo("");
        setIsAnalyzed(false);
        setAnalyzedFields(new Set());
        setActiveTab('preview');
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md overflow-hidden">
                <div className="bg-white md:rounded-[2rem] shadow-2xl w-full h-full md:w-[95%] md:max-w-5xl md:h-[90vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in duration-300 relative">
                    {/* Header: Mobile only */}
                    <div className="md:hidden flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-40">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-50 rounded-lg">
                                <Plus className="w-5 h-5 text-rose-500" />
                            </div>
                            <span className="font-black text-slate-900">記録を追加</span>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>

                    {/* Left: Upload & Preview */}
                    <div className={`flex-1 bg-slate-50 p-6 md:p-10 flex flex-col border-b md:border-b-0 md:border-r border-slate-100 overflow-y-auto ${activeTab === 'preview' ? 'flex' : 'hidden md:flex'}`}>
                        <div className="flex items-center justify-between mb-8 text-slate-900">
                            <div>
                                <h2 className="text-2xl font-black flex items-center gap-2">
                                    <span className="p-2 bg-rose-50 rounded-xl">
                                        <Plus className="w-6 h-6 text-rose-500" />
                                    </span>
                                    記録を追加
                                </h2>
                                <p className="text-slate-400 text-xs mt-1 font-bold">画像またはPDFをリアルタイム分析します</p>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center relative">
                            {!file ? (
                                <div className="flex flex-col items-center justify-center gap-6 p-12 text-center">
                                    <div className="p-8 bg-slate-100 rounded-[2.5rem] border border-slate-200">
                                        <Receipt className="w-16 h-16 text-slate-300" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-black text-slate-400">画像がありません</p>
                                        <p className="text-xs text-slate-300 mt-2 font-bold uppercase tracking-wider">No Receipt Selected</p>
                                    </div>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="mt-4 px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-black text-xs hover:bg-slate-50 transition-all flex items-center gap-2"
                                    >
                                        <Upload className="w-3.5 h-3.5" /> 画像を選択する
                                    </button>
                                </div>
                            ) : file && objectUrl ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-slate-100 p-4 shadow-sm overflow-hidden group relative">
                                    {file.type.startsWith('image/') ? (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <img 
                                                src={objectUrl} 
                                                alt="Receipt Preview" 
                                                className="max-w-full max-h-[500px] object-contain rounded-2xl shadow-lg transition-transform group-hover:scale-[1.01]"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full relative group">
                                            <iframe 
                                                src={`${objectUrl}#toolbar=0&navpanes=0`}
                                                className="w-full h-full border-0 rounded-2xl bg-slate-50 pointer-events-none"
                                                title="PDF Preview"
                                            />
                                            {/* Mask to prevent iframe interaction and allow click to expand */}
                                            <div className="absolute inset-0 bg-transparent z-10"></div>
                                        </div>
                                    )}
                                    
                                    <div className="absolute bottom-6 flex items-center gap-3 z-20">
                                        <button 
                                            type="button"
                                            onClick={() => setIsPreviewOpen(true)}
                                            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-black hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20"
                                        >
                                            <Maximize2 className="w-3.5 h-3.5" /> 拡大プレビュー
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                resetState();
                                                fileInputRef.current?.click();
                                            }}
                                            className="bg-white/95 backdrop-blur px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-white hover:text-rose-600 transition-all flex items-center gap-2 shadow-sm"
                                        >
                                            <RefreshCcw className="w-3.5 h-3.5" /> 再選択
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col gap-4">
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white hover:bg-rose-50/30 hover:border-rose-300 transition-all cursor-pointer group"
                                    >
                                        <div className="p-6 bg-rose-50 rounded-2xl text-rose-500 mb-4 group-hover:scale-110 transition-transform">
                                            <Camera className="w-10 h-10" />
                                        </div>
                                        <span className="font-black text-slate-700 text-lg">写真を撮る</span>
                                        <span className="text-xs text-slate-400 mt-2 font-bold italic tracking-wide uppercase">Capture Receipt</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-32 flex items-center justify-center border-2 border-slate-100 rounded-2xl bg-slate-50 hover:bg-white hover:border-rose-200 transition-all cursor-pointer group gap-4 px-8"
                                    >
                                        <div className="p-3 bg-white rounded-xl text-slate-400 group-hover:text-rose-400 transition-colors shadow-sm">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <div className="text-left">
                                            <span className="block font-black text-slate-600">ファイルを選択</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Image or PDF</span>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('form');
                                            // Set some defaults if needed
                                            if (!date) setDate(new Date().toISOString().slice(0, 10));
                                        }}
                                        className="h-20 flex items-center justify-center border-2 border-slate-100 border-dashed rounded-2xl bg-white hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer group gap-4 px-8"
                                    >
                                        <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-slate-600 transition-colors">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <span className="block font-black text-slate-600 text-sm">直接入力する</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Record Without File</span>
                                        </div>
                                    </button>
                                </div>
                            )}

                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleFileChange} 
                                className="hidden" 
                                accept="image/*,application/pdf" 
                            />
                            <input 
                                type="file" 
                                ref={cameraInputRef}
                                onChange={handleFileChange} 
                                className="hidden" 
                                accept="image/*" 
                                capture="environment" 
                            />

                            {(isAnalyzing || isScanning) && (
                                <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center z-30 rounded-[2rem]">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-rose-500 blur-2xl opacity-20 animate-pulse"></div>
                                        <Loader2 className={`w-16 h-16 ${isScanning ? 'text-blue-500' : 'text-rose-500'} animate-spin mb-6 relative`} />
                                    </div>
                                    <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
                                        {isScanning ? (
                                            <div className="w-full max-w-xs space-y-4">
                                                <div className="flex items-center justify-center gap-2 text-blue-600 mb-1">
                                                    <Scan className="w-5 h-5 animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Smart Scanner</span>
                                                </div>
                                                <p className="font-black text-slate-900 text-xl tracking-tight text-center">レシートを自動補正中</p>
                                                
                                                <div className="space-y-2">
                                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                                                            style={{ width: `${scanProgress}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between items-center px-1">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">{scanStatus}</span>
                                                        <span className="text-[10px] text-blue-600 font-black tracking-tighter">{scanProgress}%</span>
                                                    </div>
                                                </div>

                                                <div className="pt-4 flex justify-center">
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            setIsScanning(false);
                                                            if (file) {
                                                                analyzeFile(file);
                                                            }
                                                        }}
                                                        className="text-[10px] font-black text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1.5 rounded-full transition-all tracking-wider uppercase"
                                                    >
                                                        補正をスキップして解析へ
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 text-rose-500 mb-1">
                                                    <Sparkles className="w-5 h-5" />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">AI Intelligence</span>
                                                </div>
                                                <p className="font-black text-slate-900 text-xl tracking-tight">AIが内容を分析中</p>
                                                <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest italic">Extracting data with Gemini...</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Form */}
                    <div className={`w-full md:w-[450px] bg-white p-6 md:p-10 overflow-y-auto custom-scrollbar pb-32 md:pb-10 ${activeTab === 'form' ? 'block' : 'hidden md:block'}`}>
                        <div className="hidden md:flex justify-end mb-6">
                            <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            {isAnalyzed && (
                                <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-4 duration-500">
                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                        <Check className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-emerald-800 font-black mb-1 uppercase tracking-wider">AI Analysis Result</p>
                                        <p className="text-xs text-emerald-700/80 font-bold leading-relaxed">
                                            抽出された内容を確認して保存してください。
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6">
                                <div className="group text-slate-900">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between mb-2">
                                        <span className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-slate-300" /> 日付
                                        </span>
                                        {analyzedFields.has("date") && <span className="text-[9px] text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded italic font-bold">AI</span>}
                                    </label>
                                    <input 
                                        type="date" 
                                        required
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-black ${analyzedFields.has("date") ? 'bg-emerald-50/20 border-emerald-100' : ''}`}
                                    />
                                </div>

                                <div className="group text-slate-900">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between mb-2">
                                        <span className="flex items-center gap-2">
                                            <Store className="w-3.5 h-3.5 text-slate-300" /> 購入先
                                        </span>
                                        {analyzedFields.has("vendor") && <span className="text-[9px] text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded italic font-bold">AI</span>}
                                    </label>
                                    <input 
                                        type="text" 
                                        placeholder="店名など"
                                        value={vendor}
                                        onChange={(e) => setVendor(e.target.value)}
                                        className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-black ${analyzedFields.has("vendor") ? 'bg-emerald-50/20 border-emerald-100' : ''}`}
                                    />
                                </div>

                                <div className="group text-slate-900">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between mb-2">
                                        <span className="flex items-center gap-2">
                                            <Receipt className="w-3.5 h-3.5 text-slate-300" /> 品目・内容
                                        </span>
                                        {analyzedFields.has("item") && <span className="text-[9px] text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded italic font-bold">AI</span>}
                                    </label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="例: 事務手数料"
                                        value={item}
                                        onChange={(e) => setItem(e.target.value)}
                                        className={`w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-black ${analyzedFields.has("item") ? 'bg-emerald-50/20 border-emerald-100' : ''}`}
                                    />
                                </div>

                                <div className="group">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between mb-2">
                                        <span className="flex items-center gap-2">
                                            <CreditCard className="w-3.5 h-3.5 text-slate-300" /> 金額
                                        </span>
                                        {analyzedFields.has("amount") && <span className="text-[9px] text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded italic font-bold">AI</span>}
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">¥</span>
                                        <input 
                                            type="number" 
                                            inputMode="numeric"
                                            required
                                            value={amount || ""}
                                            onChange={(e) => setAmount(Number(e.target.value))}
                                            className={`w-full pl-10 pr-5 py-4 bg-slate-900 border-none rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-xl font-black text-white ${analyzedFields.has("amount") ? 'bg-slate-800' : ''}`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                                        <Tag className="w-3.5 h-3.5 text-slate-300" /> カテゴリー
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {CATEGORIES.map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setCategory(cat)}
                                                className={`px-3 py-2 text-[10px] font-black rounded-xl border transition-all ${category === cat ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-rose-200 hover:bg-white'}`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between mb-3">
                                        <span className="flex items-center gap-2">
                                            <CreditCard className="w-3.5 h-3.5 text-slate-300" /> 支払方法
                                        </span>
                                        {analyzedFields.has("paymentMethod") && <span className="text-[9px] text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded italic font-bold">AI</span>}
                                    </label>
                                    <div className="flex gap-2">
                                        {(['クレジット', '小口現金'] as PaymentMethod[]).map(pm => (
                                            <button
                                                key={pm}
                                                type="button"
                                                onClick={() => setPaymentMethod(pm)}
                                                className={`flex-1 py-3 text-xs font-black rounded-xl border transition-all ${paymentMethod === pm ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                            >
                                                {pm}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
 
                            <div className="pt-4 md:pt-4 fixed md:static bottom-0 left-0 right-0 p-6 md:p-0 bg-white md:bg-transparent border-t md:border-0 border-slate-100 z-50">
                                <button
                                    type="submit"
                                    disabled={isSaving || isAnalyzing || isScanning}
                                    className={`w-full py-5 bg-rose-600 text-white font-black text-lg rounded-[1.5rem] shadow-xl shadow-rose-200 active:scale-95 transition-all flex items-center justify-center gap-3 ${isSaving || isAnalyzing || isScanning ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:bg-rose-700 hover:-translate-y-1'}`}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            <span>保存中...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-6 h-6" />
                                            <span>支出を記録する</span>
                                        </>
                                    )}
                                </button>
                                <p className="hidden md:block text-[10px] text-slate-400 text-center mt-4 font-bold uppercase tracking-widest">Verify and Save</p>
                            </div>
                        </form>
                    </div>

                    {/* Mobile Bottom Navigation: Tab Bar */}
                    {file && (
                        <div className="md:hidden fixed bottom-24 left-6 right-6 flex bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-2xl shadow-2xl z-50 border border-white/10 ring-1 ring-black/20">
                            <button
                                type="button"
                                onClick={() => setActiveTab('preview')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${activeTab === 'preview' ? 'bg-white text-slate-900 shadow-lg scale-[1.02]' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Receipt className="w-4 h-4" />
                                プレビュー
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('form')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${activeTab === 'form' ? 'bg-white text-slate-900 shadow-lg scale-[1.02]' : 'text-slate-400 hover:text-white'}`}
                            >
                                <FileText className="w-4 h-4" />
                                内容確認
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <FilePreviewModal 
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                fileUrl={objectUrl || ""}
                fileName={file?.name}
                fileType={file?.type}
            />
            
            <style jsx global>{`
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
            `}</style>
        </>
    );
}
