"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    X, FileText, CheckCircle2, Pencil, ChevronDown, Loader2,
    Thermometer, Wind, Plus, ClipboardList, Trash2, AlertTriangle,
    ChevronRight, ChevronLeft, Store, Image as ImageIcon, UploadCloud, Save, Package, Gift,
    Cloud, CloudSun, CloudRain, CloudSnow, Sparkles, RefreshCw, Copy, Video, RotateCcw,
    Search, Check, Brain
} from "lucide-react";
import { useStore, DailyReport, RestockingItem, PromotionItem } from "@/lib/store";
import { uploadImageWithCompression, ensureProcessableImage } from "@/lib/imageUpload";
import { getHolidayName } from "@/lib/holidays";
import { apiFetch, DemoModeError, checkIsDemoMode } from "@/lib/apiClient";
import { showNotification } from "@/lib/notifications";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";
const today = () => new Date().toISOString().slice(0, 10);

// ─── weather helpers ──────────────────────────────────────────────────────────
function WeatherIcon({ main, size = 5 }: { main?: string; size?: number }) {
    const cls = `w-${size} h-${size}`;
    if (!main) return <CloudSun className={`${cls} text-slate-300`} />;
    if (main.includes("Rain") || main.includes("Drizzle")) return <CloudRain className={`${cls} text-blue-400`} />;
    if (main.includes("Snow")) return <CloudSnow className={`${cls} text-sky-300`} />;
    if (main.includes("Cloud")) return <Cloud className={`${cls} text-slate-400`} />;
    return <CloudSun className={`${cls} text-amber-400`} />;
}

type WeatherData = { weather: string; main: string; temp: number; tempMin?: number; tempMax?: number; humidity: number; windSpeed: number };

// ─── Restocking Row ───────────────────────────────────────────────────────────
function RestockingRow({
    item, products, onChange, onRemove,
}: {
    item: RestockingItem;
    products: { id: string; name: string; variantName?: string }[];
    onChange: (v: RestockingItem) => void;
    onRemove: () => void;
}) {
    const baseInputCls = "bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all";
    return (
        <div className="flex gap-2 items-center">
            <select
                value={item.productId}
                onChange={e => {
                    const p = products.find(p => p.id === e.target.value);
                    onChange({ productId: e.target.value, productName: p ? `${p.name}${p.variantName ? " " + p.variantName : ""}` : "", qty: item.qty });
                }}
                className={`flex-1 ${baseInputCls}`}
            >
                <option value="">商品を選択</option>
                {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.variantName ? ` (${p.variantName})` : ""}</option>
                ))}
            </select>
            {/* Qty stepper */}
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shrink-0">
                <button type="button" onClick={() => onChange({ ...item, qty: Math.max(1, item.qty - 1) })}
                    className="px-3 py-2.5 text-slate-500 hover:bg-slate-50 font-bold text-sm active:scale-95 transition-transform">−</button>
                <span className="px-3 text-sm font-bold text-slate-800 min-w-[2rem] text-center">{item.qty}</span>
                <button type="button" onClick={() => onChange({ ...item, qty: item.qty + 1 })}
                    className="px-3 py-2.5 text-slate-500 hover:bg-slate-50 font-bold text-sm active:scale-95 transition-transform">＋</button>
            </div>
            <button type="button" onClick={onRemove}
                className="p-2 text-slate-300 hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

// ─── Promotion Row ───────────────────────────────────────────────────────────
function PromotionRow({
    item, products, onChange, onRemove,
}: {
    item: PromotionItem;
    products: { id: string; name: string; variantName?: string }[];
    onChange: (v: PromotionItem) => void;
    onRemove: () => void;
}) {
    const baseInputCls = "bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all";
    return (
        <div className="flex flex-col gap-2 p-3 border border-slate-100 rounded-xl bg-slate-50/50">
            <div className="flex gap-2 items-center">
                <select
                    value={item.productId}
                    onChange={e => {
                        const p = products.find(p => p.id === e.target.value);
                        onChange({ ...item, productId: e.target.value, productName: p ? `${p.name}${p.variantName ? " " + p.variantName : ""}` : "" });
                    }}
                    className={`flex-1 ${baseInputCls}`}
                >
                    <option value="">商品を選択</option>
                    {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.variantName ? ` (${p.variantName})` : ""}</option>
                    ))}
                </select>
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shrink-0 bg-white">
                    <button type="button" onClick={() => onChange({ ...item, qty: Math.max(1, item.qty - 1) })}
                        className="px-3 py-2 text-slate-500 hover:bg-slate-50 font-bold text-sm active:scale-95 transition-transform">−</button>
                    <span className="px-3 text-sm font-bold text-slate-800 min-w-[2rem] text-center">{item.qty}</span>
                    <button type="button" onClick={() => onChange({ ...item, qty: item.qty + 1 })}
                        className="px-3 py-2 text-slate-500 hover:bg-slate-50 font-bold text-sm active:scale-95 transition-transform">＋</button>
                </div>
                <button type="button" onClick={onRemove}
                    className="p-2 text-slate-300 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="flex gap-2">
                <input type="text" placeholder="提供先（山田様、インフルエンサー等）" value={item.toWhom || ""} onChange={e => onChange({ ...item, toWhom: e.target.value })} className={`flex-1 ${baseInputCls} text-xs`} />
                <input type="text" placeholder="目的（ご挨拶、試食、宣伝活動等）" value={item.purpose || ""} onChange={e => onChange({ ...item, purpose: e.target.value })} className={`flex-1 ${baseInputCls} text-xs`} />
            </div>
        </div>
    );
}

// ─── Report Form (new OR edit) ────────────────────────────────────────────────
function ReportForm({
    onClose,
    onSaved,
    editData,
}: {
    onClose: () => void;
    onSaved: () => void;
    editData?: DailyReport;
}) {
    const { retailStores, products, addDailyReport, updateDailyReport, addSale, fetchAndSaveWeatherIfNeeded } = useStore();
    const isEdit = !!editData;

    const [type, setType] = useState<"office" | "store" | "activity">(editData?.type ?? "store");
    const [date, setDate] = useState(editData?.date ?? today());
    const [worker, setWorker] = useState(editData?.worker ?? "山口");
    const [title, setTitle] = useState(editData?.title ?? "");
    const [content, setContent] = useState(editData?.content ?? "");
    const [involvedProductIds, setInvolvedProductIds] = useState<string[]>(editData?.involvedProductIds ?? []);
    const [officeNote, setOfficeNote] = useState(editData?.officeNote ?? "");
    const [storeId, setStoreId] = useState(editData?.storeId ?? "");
    const [storeTopics, setStoreTopics] = useState(editData?.storeTopics ?? "");
    const [displayBeforeImageUrls, setDisplayBeforeImageUrls] = useState<string[]>(editData?.displayBeforeImageUrls ?? []);
    const [displayAfterImageUrls, setDisplayAfterImageUrls] = useState<string[]>(editData?.displayAfterImageUrls ?? []);
    const [restocking, setRestocking] = useState<RestockingItem[]>(editData?.restocking ?? []);
    const [promotions, setPromotions] = useState<PromotionItem[]>(editData?.promotions ?? []);
    const [imageUrl, setImageUrl] = useState(editData?.imageUrl ?? "");
    const [aiAnalysis, setAiAnalysis] = useState(editData?.aiAnalysis ?? "");
    const [productSearchQuery, setProductSearchQuery] = useState("");

    // AI Generation states
    const [instaCopy, setInstaCopy] = useState("");
    const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Image files for upload (newly added files)
    const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
    const [afterFiles, setAfterFiles] = useState<File[]>([]);

    // Previews: combines existing URLs and newly selected file previews
    const [beforePreviews, setBeforePreviews] = useState<{ url: string; fileIndex?: number; isExisting?: boolean }[]>(
        (editData?.displayBeforeImageUrls ?? []).map(url => ({ url, isExisting: true }))
    );
    const [afterPreviews, setAfterPreviews] = useState<{ url: string; fileIndex?: number; isExisting?: boolean }[]>(
        (editData?.displayAfterImageUrls ?? []).map(url => ({ url, isExisting: true }))
    );

    const beforeInputRef = useRef<HTMLInputElement>(null);
    const afterInputRef = useRef<HTMLInputElement>(null);
    const activityInputRef = useRef<HTMLInputElement>(null);

    const [weather, setWeather] = useState<WeatherData | null>(
        editData?.weatherMain
            ? { weather: editData.weather ?? "", main: editData.weatherMain, temp: editData.temperature ?? 0, humidity: editData.humidity ?? 0, windSpeed: editData.windSpeed ?? 0 }
            : null
    );
    const [fetchingWeather, setFetchingWeather] = useState(false);
    const [weatherError, setWeatherError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingActivityImage, setIsUploadingActivityImage] = useState(false);

    const selectedStore = retailStores.find(s => s.id === storeId);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Auto-fetch weather when store with lat/lng is selected (not when editing and store unchanged)
    useEffect(() => {
        if (!selectedStore?.lat || !selectedStore?.lng || type !== "store") {
            if (!isEdit) setWeather(null);
            return;
        }
        // If editing and the store hasn't changed, keep existing weather
        if (isEdit && storeId === editData?.storeId && weather) return;

        // Abort previous request
        if (abortControllerRef.current) {
            try {
                abortControllerRef.current.abort();
            } catch (e) {
                // Ignore errors during abort
            }
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        if (checkIsDemoMode()) {
            setWeather(null);
            setFetchingWeather(false);
            return;
        }

        setFetchingWeather(true);
        setWeatherError(null);

        const fetchWeather = async () => {
            let timeoutId: any;
            try {
                // Use a timeout to prevent hanging UI
                timeoutId = setTimeout(() => controller.abort(), 10000);

                const res = await apiFetch(`/api/weather?lat=${selectedStore.lat}&lon=${selectedStore.lng}`, {
                    signal: controller.signal
                });
                
                const d = await res.json();
                
                if (!res.ok) {
                    throw new Error(d.error || `天気情報の取得に失敗しました (${res.status})`);
                }

                if (d.error) {
                    throw new Error(d.error);
                }

                if (!controller.signal.aborted) {
                    setWeather(d);
                    // Successfully fetched, now sync it to the store's cache
                    fetchAndSaveWeatherIfNeeded(selectedStore.id, selectedStore.lat!, selectedStore.lng!, date);
                }
            } catch (err: any) {
                const isAbort = err?.name === 'AbortError';
                
                if (isAbort && abortControllerRef.current !== controller) {
                    // Aborted because a new request started - do nothing
                    return;
                }

                console.error("Weather fetch error:", err);
                
                if (!controller.signal.aborted || isAbort) {
                    setWeather(null);
                    setWeatherError(isAbort ? "取得がタイムアウトしました" : (err.message || "天気の取得に失敗しました"));
                }
            } finally {
                clearTimeout(timeoutId);
                // Only reset loading if this is still the active controller
                if (abortControllerRef.current === controller) {
                    setFetchingWeather(false);
                }
            }
        };

        fetchWeather();

        return () => {
            try {
                controller.abort();
            } catch (e) {
                // Ignore errors during abort
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeId, selectedStore?.lat, selectedStore?.lng, date, type]);

    // Cleanup object URLs on unmount
    useEffect(() => {
        return () => {
            beforePreviews.forEach(p => { if (!p.isExisting) URL.revokeObjectURL(p.url); });
            afterPreviews.forEach(p => { if (!p.isExisting) URL.revokeObjectURL(p.url); });
        };
    }, [beforePreviews, afterPreviews]);

    const handleBeforeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        const processedFiles: File[] = [];
        for (const file of selectedFiles) {
            const processed = await ensureProcessableImage(file);
            processedFiles.push(processed);
        }

        const newFiles = [...beforeFiles, ...processedFiles];
        setBeforeFiles(newFiles);

        const newPreviews = processedFiles.map((file, i) => ({
            url: URL.createObjectURL(file),
            fileIndex: beforeFiles.length + i,
            isExisting: false
        }));
        setBeforePreviews([...beforePreviews, ...newPreviews]);

        if (beforeInputRef.current) beforeInputRef.current.value = "";
    };

    const handleAfterChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        const processedFiles: File[] = [];
        for (const file of selectedFiles) {
            const processed = await ensureProcessableImage(file);
            processedFiles.push(processed);
        }

        const newFiles = [...afterFiles, ...processedFiles];
        setAfterFiles(newFiles);

        const newPreviews = processedFiles.map((file, i) => ({
            url: URL.createObjectURL(file),
            fileIndex: afterFiles.length + i,
            isExisting: false
        }));
        setAfterPreviews([...afterPreviews, ...newPreviews]);

        if (afterInputRef.current) afterInputRef.current.value = "";
    };

    const handleActivityImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingActivityImage(true);
        try {
            const url = await uploadImageWithCompression(file, "reports/activity");
            setImageUrl(url);
        } catch (error: any) {
            console.error("Activity image upload error:", error);
            showNotification("画像のアップロードに失敗しました。\n詳細: " + (error.message || "不明なエラー"), "error");
        } finally {
            setIsUploadingActivityImage(false);
            if (activityInputRef.current) activityInputRef.current.value = "";
        }
    };

    const removeBeforeImage = (index: number) => {
        const preview = beforePreviews[index];
        const nextPreviews = [...beforePreviews];
        nextPreviews.splice(index, 1);
        setBeforePreviews(nextPreviews);

        if (!preview.isExisting && preview.fileIndex !== undefined) {
            // We don't necessarily need to remove from beforeFiles because we'll filter before submit
            // but for cleanliness:
            // Note: correctly managing indices in files array when removing is tricky
            // Easier: just reconstruct files when submitting based on current previews
        }
    };

    const removeAfterImage = (index: number) => {
        const nextPreviews = [...afterPreviews];
        nextPreviews.splice(index, 1);
        setAfterPreviews(nextPreviews);
    };

    const addRestockingItem = () => {
        setRestocking(prev => [...prev, { productId: "", productName: "", qty: 1 }]);
    };

    const addPromotionItem = () => {
        setPromotions(prev => [...prev, { productId: "", productName: "", qty: 1, toWhom: "", purpose: "" }]);
    };

    const handleGenerateInstaStory = async () => {
        if (!content && !storeTopics && !officeNote) {
            showNotification("生成するための内容を入力してください。", "error");
            return;
        }
        setIsGeneratingMarketing(true);
        try {
            const res = await apiFetch("/api/generate-copy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "daily-report",
                    name: title || (type === "store" ? storeId : "日常業務"),
                    story: content || storeTopics || officeNote,
                }),
            });
            const data = await res.json();
            if (data.copy) {
                setInstaCopy(data.copy);
            } else {
                showNotification("生成に失敗しました", "error");
            }
        } catch (error) {
            if (error instanceof DemoModeError) {
                showNotification(error.message, "error");
            } else {
                console.error(error);
                showNotification("生成中にエラーが発生しました。", "error");
            }
        } finally {
            setIsGeneratingMarketing(false);
        }
    };

    const handleAnalyzeReport = async () => {
        if (!content && !storeTopics && !officeNote) {
            showNotification("分析するための内容を入力してください。", "error");
            return;
        }
        setIsAnalyzing(true);
        try {
            const res = await apiFetch("/api/reports/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type,
                    date,
                    worker,
                    storeName: selectedStore?.name,
                    weather: weather?.weather,
                    temp: weather?.temp,
                    content,
                    storeTopics,
                    officeNote,
                    restocking: restocking.filter(r => r.productId),
                }),
            });
            const data = await res.json();
            if (data.analysis) {
                setAiAnalysis(data.analysis);
            } else {
                showNotification("分析に失敗しました", "error");
            }
        } catch (error) {
            if (error instanceof DemoModeError) {
                showNotification(error.message, "error");
            } else {
                console.error(error);
                showNotification("分析中にエラーが発生しました。", "error");
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!worker.trim()) return;
        setIsSaving(true);
        try {
            // 1. Upload new Before images sequentially (Safer for mobile memory/CPU)
            const beforeUrls: string[] = [];
            for (const p of beforePreviews) {
                if (p.isExisting) {
                    beforeUrls.push(p.url);
                } else if (p.fileIndex !== undefined && beforeFiles[p.fileIndex]) {
                    const url = await uploadImageWithCompression(beforeFiles[p.fileIndex], "reports/maintenance/before");
                    beforeUrls.push(url);
                }
            }

            // 2. Upload new After images sequentially
            const afterUrls: string[] = [];
            for (const p of afterPreviews) {
                if (p.isExisting) {
                    afterUrls.push(p.url);
                } else if (p.fileIndex !== undefined && afterFiles[p.fileIndex]) {
                    const url = await uploadImageWithCompression(afterFiles[p.fileIndex], "reports/maintenance/after");
                    afterUrls.push(url);
                }
            }

            const payload: Omit<DailyReport, "id" | "createdAt"> = {
                date, worker, type,
                ...(weather ? {
                    weather: weather.weather,
                    weatherMain: weather.main,
                    temperature: weather.temp,
                    temperatureMin: weather.tempMin,
                    temperatureMax: weather.tempMax,
                    humidity: weather.humidity,
                    windSpeed: weather.windSpeed
                } : {}),
                title,
                content,
                involvedProductIds,
                imageUrl,
                promotions: promotions.filter(p => p.productId),
                ...(type === "office"
                    ? { officeNote }
                    : type === "store"
                        ? {
                            storeId, storeName: selectedStore?.name ?? editData?.storeName ?? "",
                            restocking: restocking.filter(r => r.productId),
                            storeTopics,
                            displayBeforeImageUrls: beforeUrls,
                            displayAfterImageUrls: afterUrls,
                        }
                        : {}
                ),
                aiAnalysis,
            };

            // NEW: Automatic sale for Wholesale (B) stores
            // Only for new reports of type 'store' with restocking items
            if (!isEdit && type === "store" && selectedStore?.type === 'B' && restocking.length > 0) {
                const saleItems = restocking
                    .filter(r => r.productId)
                    .map(r => {
                        const p = products.find(prod => prod.id === r.productId);
                        const price = p?.sellingPrice || 0;
                        const subtotal = price * r.qty;
                        return {
                            productId: r.productId,
                            quantity: r.qty,
                            priceAtSale: price,
                            subtotal: subtotal,
                            commission: 0, // 卸販売のため手数料なし
                            netProfit: subtotal
                        };
                    });

                if (saleItems.length > 0) {
                    const totalAmount = saleItems.reduce((acc, item) => acc + item.subtotal, 0);
                    const totalQuantity = saleItems.reduce((acc, item) => acc + item.quantity, 0);

                    await addSale({
                        storeId: selectedStore.id,
                        type: 'daily',
                        period: date,
                        items: saleItems,
                        totalQuantity,
                        totalAmount,
                        totalCommission: 0,
                        totalNetProfit: totalAmount
                    });
                }
            }

            if (isEdit && editData) {
                await updateDailyReport(editData.id, payload);
            } else {
                await addDailyReport(payload);
            }
            onSaved();
        } catch (error: any) {
            console.error("Save report error:", error);
            if (error.message && (error.message.includes("upload") || error.message.includes("Compression"))) {
                showNotification("画像のアップロード中にエラーが発生しました。\n詳細: " + error.message, "error");
            } else {
                showNotification("保存に失敗しました。\n詳細: " + (error.message || "不明なエラー"), "error");
            }
        } finally {
            setIsSaving(false);
        }
    };

    const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all";

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-slate-50 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: BRAND }}>
                            {isEdit ? <Pencil className="w-5 h-5 text-white" /> : <FileText className="w-5 h-5 text-white" />}
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 text-base">{isEdit ? "日報を編集" : "日報入力"}</h2>
                            <p className="text-xs text-slate-400">
                                {date.replace(/-/g, "/")}
                                {getHolidayName(date) && <span className="ml-1 text-red-500 font-bold">({getHolidayName(date)})</span>}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable body */}
                <form id="report-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">

                    {/* Type toggle */}
                    <div className="grid grid-cols-3 gap-2 bg-white rounded-2xl p-1.5 border border-slate-200">
                        {([
                            { value: "store", label: "🏪 店舗メンテ" },
                            { value: "activity", label: "📸 活動記録" },
                            { value: "office", label: "🖥 事務所" },
                        ] as const).map(opt => (
                            <button key={opt.value} type="button"
                                onClick={() => setType(opt.value)}
                                className={`py-3 rounded-xl text-xs font-bold transition-all ${type === opt.value ? "text-white shadow-sm" : "text-slate-500"}`}
                                style={type === opt.value ? { backgroundColor: BRAND } : {}}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Date + Worker */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">📅 日付</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">👤 作業者 <span className="text-red-400">*</span></label>
                            <input type="text" required value={worker} onChange={e => setWorker(e.target.value)}
                                placeholder="例: 田中" className={inputCls} />
                        </div>
                    </div>

                    {/* ─── 活動記録 ─── */}
                    {type === "activity" && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">🏷 タイトル</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                                    placeholder="例: 山田商店さまへの初訪問" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">📝 内容・ストーリー</label>
                                <textarea
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    rows={5}
                                    placeholder={"活動の内容を具体的に記入してください。\n例: 新商品のサンプルを持って山田商店さんへ。店主の山田さんが「これ、うちの常連さんが好きそうだよ」と喜んでくれました。"}
                                    className={`${inputCls} resize-none leading-relaxed`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-2 flex items-center justify-between">
                                    <span>📦 関連商品</span>
                                    {involvedProductIds.length > 0 && (
                                        <span className="text-[10px] bg-[#b27f79]/10 text-[#b27f79] px-2 py-0.5 rounded-full font-bold">
                                            {involvedProductIds.length}点選択中
                                        </span>
                                    )}
                                </label>

                                {/* Product Search */}
                                <div className="relative mb-3">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                        <Search className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={productSearchQuery}
                                        onChange={e => setProductSearchQuery(e.target.value)}
                                        placeholder="商品名で検索..."
                                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#b27f79]/20 transition-all placeholder:text-slate-400"
                                    />
                                    {productSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setProductSearchQuery("")}
                                            className="absolute inset-y-0 right-3 flex items-center text-slate-300 hover:text-slate-500"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
                                    {products
                                        .filter(p => {
                                            if (!productSearchQuery) return true;
                                            const query = productSearchQuery.toLowerCase();
                                            return p.name.toLowerCase().includes(query) ||
                                                (p.variantName?.toLowerCase().includes(query));
                                        })
                                        .map(p => {
                                            const isSelected = involvedProductIds.includes(p.id);
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isSelected) setInvolvedProductIds(involvedProductIds.filter(id => id !== p.id));
                                                        else setInvolvedProductIds([...involvedProductIds, p.id]);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${isSelected ? "bg-[#b27f79] text-white border-[#b27f79] ring-2 ring-[#b27f79]/20 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
                                                >
                                                    {isSelected && <Check className="w-3 h-3" />}
                                                    {p.name}{p.variantName ? ` (${p.variantName})` : ""}
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── 事務所 ─── */}
                    {type === "office" && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <label className="block text-xs font-semibold text-slate-500 mb-2">📝 作業内容・メモ</label>
                            <textarea
                                value={officeNote}
                                onChange={e => setOfficeNote(e.target.value)}
                                rows={6}
                                placeholder={"今日の作業内容を自由に記入してください。\n例: 請求書の整理、発注書の作成、在庫確認..."}
                                className={`${inputCls} resize-none leading-relaxed`}
                            />
                        </div>
                    )}

                    {/* ─── 店舗メンテ ─── */}
                    {type === "store" && (
                        <>
                            {/* Store selector */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                                <label className="block text-xs font-semibold text-slate-500">🏪 訪問店舗</label>
                                <div className="relative">
                                    <select
                                        value={storeId}
                                        onChange={e => setStoreId(e.target.value)}
                                        className={`${inputCls} appearance-none pr-10`}
                                    >
                                        <option value="">店舗を選択してください</option>
                                        {retailStores.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}{s.address ? ` — ${s.address.slice(0, 15)}…` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>

                                {/* Weather card */}
                                {storeId && (
                                    <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: BRAND_LIGHT }}>
                                        {fetchingWeather ? (
                                            <><Loader2 className="w-5 h-5 animate-spin text-slate-400" /><span className="text-xs text-slate-400">天気取得中...</span></>
                                        ) : weather ? (
                                            <>
                                                <WeatherIcon main={weather.main} size={7} />
                                                <div>
                                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                                        {weather.temp}°C
                                                        {(weather.tempMin !== undefined && weather.tempMax !== undefined) && (
                                                            <span className="text-xs font-bold leading-none">
                                                                <span className="text-red-400">{weather.tempMax}°</span>
                                                                <span className="text-slate-300 mx-0.5">/</span>
                                                                <span className="text-blue-400">{weather.tempMin}°</span>
                                                            </span>
                                                        )}
                                                        <span className="font-normal text-slate-500 text-sm">{weather.weather}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-400 flex gap-2 mt-0.5">
                                                        <span><Thermometer className="w-3 h-3 inline" /> 湿度 {weather.humidity}%</span>
                                                        <span><Wind className="w-3 h-3 inline" /> {weather.windSpeed}m/s</span>
                                                    </div>
                                                </div>
                                                <span className="ml-auto text-xs text-slate-400">自動取得 ✓</span>
                                            </>
                                        ) : !selectedStore?.lat ? (
                                            <span className="text-xs text-slate-400">📍 店舗に位置情報を登録すると天気が自動取得されます</span>
                                        ) : (
                                            <span className="text-xs text-red-400">
                                                {weatherError || "天気の取得に失敗しました"}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Restocking */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-slate-500">📦 補充した商品</label>
                                    <button type="button" onClick={addRestockingItem}
                                        className="flex items-center gap-1 text-xs font-medium text-white px-3 py-1.5 rounded-lg"
                                        style={{ backgroundColor: BRAND }}>
                                        <Plus className="w-3.5 h-3.5" /> 追加
                                    </button>
                                </div>
                                {restocking.length === 0 ? (
                                    <button type="button" onClick={addRestockingItem}
                                        className="w-full border-2 border-dashed border-slate-200 rounded-xl py-4 text-sm text-slate-400 hover:border-slate-300 transition-colors flex items-center justify-center gap-2">
                                        <Package className="w-4 h-4" /> タップして商品を追加
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        {restocking.map((item, i) => {
                                            const filteredProducts = (selectedStore?.activeProductIds && selectedStore.activeProductIds.length > 0)
                                                ? products.filter(p => selectedStore.activeProductIds?.includes(p.id))
                                                : products;
                                            return (
                                                <RestockingRow
                                                    key={i}
                                                    item={item}
                                                    products={filteredProducts}
                                                    onChange={v => setRestocking(prev => prev.map((x, j) => j === i ? v : x))}
                                                    onRemove={() => setRestocking(prev => prev.filter((_, j) => j !== i))}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Display Photos Before/After */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                                <label className="block text-xs font-semibold text-slate-500">📸 陳列写真（Before/After）</label>

                                <div className="space-y-4">
                                    {/* Before Section */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Before</p>
                                        <div className="flex flex-wrap gap-3">
                                            {beforePreviews.map((p, i) => (
                                                <div key={i} className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden relative group">
                                                    <img src={p.url} alt={`Before ${i}`} className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeBeforeImage(i)}
                                                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => beforeInputRef.current?.click()}
                                                className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-slate-300 transition-all"
                                            >
                                                <Plus className="w-5 h-5 mb-1" />
                                                <span className="text-[10px] font-medium">追加</span>
                                            </button>
                                        </div>
                                        <input type="file" multiple ref={beforeInputRef} onChange={handleBeforeChange} accept="image/*,.heic,.heif" className="hidden" />
                                    </div>

                                    {/* After Section */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">After</p>
                                        <div className="flex flex-wrap gap-3">
                                            {afterPreviews.map((p, i) => (
                                                <div key={i} className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden relative group">
                                                    <img src={p.url} alt={`After ${i}`} className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeAfterImage(i)}
                                                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => afterInputRef.current?.click()}
                                                className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-slate-300 transition-all"
                                            >
                                                <Plus className="w-5 h-5 mb-1" />
                                                <span className="text-[10px] font-medium">追加</span>
                                            </button>
                                        </div>
                                        <input type="file" multiple ref={afterInputRef} onChange={handleAfterChange} accept="image/*,.heic,.heif" className="hidden" />
                                    </div>
                                </div>

                                <p className="text-[10px] text-slate-400 leading-tight">
                                    陳列のBefore/Afterを複数枚記録することで、改善効果をより多角的に振り返ることができます。
                                </p>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                                <label className="block text-xs font-semibold text-slate-500 mb-2">💬 トピックス</label>
                                <textarea
                                    value={storeTopics}
                                    onChange={e => setStoreTopics(e.target.value)}
                                    rows={4}
                                    placeholder={"例: お客様から「プレゼント用に包んでほしい」との要望あり\n陳列を入れ替えたところ視認性が上がった\n今週末のイベントで来客増加が見込まれる"}
                                    className={`${inputCls} resize-none leading-relaxed`}
                                />
                            </div>
                        </>
                    )}

                    {/* 🎁 販促・サンプル提供 (Activity & Store) */}
                    {(type === "activity" || type === "store") && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5"><Gift className="w-4 h-4 text-[#b27f79]" /> 本日のサンプル配布・販促実績</label>
                                <button type="button" onClick={addPromotionItem}
                                    className="flex items-center gap-1 text-xs font-medium text-[#b27f79] hover:bg-[#b27f79]/10 px-3 py-1.5 rounded-lg border border-[#b27f79]/20 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> 追加
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400">※登録した商品は自動的にメイン在庫から引き落とされ、原価分の「広告宣伝費」が自動計上されます。</p>
                            {promotions.length === 0 ? (
                                <button type="button" onClick={addPromotionItem}
                                    className="w-full border-2 border-dashed border-slate-200 rounded-xl py-4 text-sm text-slate-400 hover:border-slate-300 transition-colors flex items-center justify-center gap-2">
                                    <Gift className="w-4 h-4" /> タップして販促・サンプル商品を追加
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    {promotions.map((item, i) => (
                                        <PromotionRow
                                            key={i}
                                            item={item}
                                            products={products}
                                            onChange={v => setPromotions(prev => prev.map((x, j) => j === i ? v : x))}
                                            onRemove={() => setPromotions(prev => prev.filter((_, j) => j !== i))}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 📸 メイン写真 (Activity / Other) */}
                    {(type === "activity" || type === "office") && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                            <label className="block text-xs font-semibold text-slate-500">📸 写真を追加</label>
                            {imageUrl ? (
                                <div className="relative w-full aspect-video rounded-xl overflow-hidden group">
                                    {(imageUrl.startsWith("data:video/") || imageUrl.toLowerCase().includes(".mp4") || imageUrl.toLowerCase().includes(".mov") || imageUrl.toLowerCase().includes(".webm")) ? (
                                        <video src={imageUrl} className="w-full h-full object-cover" controls muted playsInline />
                                    ) : (
                                        <img src={imageUrl} alt="Main" className="w-full h-full object-cover" />
                                    )}
                                    <button type="button" onClick={() => setImageUrl("")} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    disabled={isUploadingActivityImage}
                                    onClick={() => {
                                        console.log("Activity image button clicked");
                                        activityInputRef.current?.click();
                                    }}
                                    className="w-full aspect-video border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                                >
                                    {isUploadingActivityImage ? (
                                        <Loader2 className="w-8 h-8 mb-2 animate-spin" />
                                    ) : (
                                        <Video className="w-8 h-8 mb-2 text-indigo-500" />
                                    )}
                                    <span className="text-sm">
                                        {isUploadingActivityImage ? "アップロード中..." : "写真または動画をアップロード"}
                                    </span>
                                </button>
                            )}
                            <input
                                type="file"
                                ref={activityInputRef}
                                onChange={handleActivityImageChange}
                                accept="image/*,.heic,.heif,video/*"
                                className="hidden"
                                id="activity-image-input"
                                name="activity-image-input"
                            />
                        </div>
                    )}

                    {/* ✨ AI Instagram Story Generator */}
                    <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-bold text-indigo-900">Instagram ストーリー生成</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleGenerateInstaStory}
                                disabled={isGeneratingMarketing || (!content && !storeTopics && !officeNote)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 active:scale-95 disabled:opacity-50 transition-all"
                            >
                                {isGeneratingMarketing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                生成する
                            </button>
                        </div>

                        {instaCopy ? (
                            <div className="bg-white rounded-xl border border-indigo-100 p-3.5 relative">
                                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                                    {instaCopy}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(instaCopy);
                                        showNotification("クリップボードにコピーしました！");
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all"
                                    title="コピー"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-400 text-center py-2">
                                日報の内容をAIが魅力的な「ブランドストーリー」に変換します ✨
                            </p>
                        )}
                    </div>

                    {/* ✨ AI Analysis / Insights */}
                    <div className="bg-indigo-900/5 rounded-2xl border border-indigo-200 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-indigo-900 rounded-lg flex items-center justify-center text-white shadow-md">
                                    <Brain className="w-4 h-4" />
                                </div>
                                <div>
                                    <span className="text-sm font-black text-indigo-950 block">AI分析・アドバイス</span>
                                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Manager Insight</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleAnalyzeReport}
                                disabled={isAnalyzing || (!content && !storeTopics && !officeNote)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-900 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 transition-all hover:bg-indigo-800"
                            >
                                {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                分析を実行
                            </button>
                        </div>

                        {aiAnalysis ? (
                            <div className="bg-white/60 rounded-xl border border-indigo-100 p-4 relative group">
                                <div className="text-xs text-indigo-900 whitespace-pre-wrap leading-relaxed font-medium">
                                    {aiAnalysis}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAiAnalysis("")}
                                    className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-[11px] text-slate-400 font-bold mb-1">
                                    AIが店長に代わって日報を一歩深く分析します。
                                </p>
                                <p className="text-[9px] text-indigo-300 font-bold uppercase tracking-tighter">
                                    Advice • Feedback • Next Action
                                </p>
                            </div>
                        )}
                    </div>
                </form>

                {/* Footer */}
                <div className="px-5 pt-3 pb-6 border-t border-slate-200 bg-white">
                    <button
                        type="submit"
                        form="report-form"
                        disabled={isSaving || isUploadingActivityImage || !worker.trim()}
                        className="w-full flex items-center justify-center gap-2 py-4 text-white font-bold rounded-2xl text-base transition-all disabled:opacity-50 active:scale-[0.98]"
                        style={{ backgroundColor: BRAND }}
                    >
                        {isSaving
                            ? <><Loader2 className="w-5 h-5 animate-spin" /> 保存中...</>
                            : isEdit
                                ? <><Save className="w-5 h-5" /> 変更を保存する</>
                                : <><CheckCircle2 className="w-5 h-5" /> 日報を保存する</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Report Card ──────────────────────────────────────────────────────────────
function ReportCard({
    report,
    onDelete,
    onEdit,
    onRestore,
    onPermanentDelete,
}: {
    report: DailyReport;
    onDelete: () => void;
    onEdit: () => void;
    onRestore: () => void;
    onPermanentDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const isStore = report.type === "store";
    const isActivity = report.type === "activity";
    const dateLabel = report.date.replace(/-/g, "/");

    const typeLabel = isActivity ? "活動記録" : isStore ? "店舗メンテ" : "事務所作業";
    const typeColor = isActivity ? "#b27f79" : isStore ? "#1e3a8a" : "#94a3b8";

    const handleDeleteConfirm = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setConfirmDelete(false);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Summary row — tap to expand */}
            <button
                className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                onClick={() => { setExpanded(e => !e); setConfirmDelete(false); }}
            >
                {/* Left accent */}
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: typeColor }} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{dateLabel}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ backgroundColor: typeColor + "20", color: typeColor }}>
                            {isActivity ? "📸 活動記録" : isStore ? "🏪 店舗メンテ" : "🖥 事務所"}
                        </span>
                        {isStore && report.storeName && (
                            <span className="text-xs text-slate-500 font-medium truncate">@ {report.storeName}</span>
                        )}
                    </div>
                    {(report.title || isActivity) && (
                        <div className="text-sm font-bold text-slate-900 mt-1 truncate">
                            {report.title || "無題の活動記録"}
                        </div>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            {report.worker}
                        </span>
                        {report.temperature !== undefined && (
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                <WeatherIcon main={report.weatherMain} size={3} />
                                {report.temperature}°C
                            </span>
                        )}
                        {isStore && report.restocking && report.restocking.length > 0 && (
                            <span className="text-[10px] text-slate-400 font-bold">📦 {report.restocking.length}件</span>
                        )}
                    </div>
                </div>

                <ChevronRight className={`w-4 h-4 text-slate-300 shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
            </button>

            {/* Expanded detail */}
            {expanded && (
                <div className="px-5 pb-4 pt-1 border-t border-slate-100 space-y-4 text-sm">
                    {/* Main Image for Activity */}
                    {report.imageUrl && (
                        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm mt-3">
                            {(report.imageUrl.startsWith("data:video/") || report.imageUrl.toLowerCase().includes(".mp4") || report.imageUrl.toLowerCase().includes(".mov") || report.imageUrl.toLowerCase().includes(".webm")) ? (
                                <video src={report.imageUrl} className="w-full aspect-video object-cover" controls muted playsInline />
                            ) : (
                                <img src={report.imageUrl} alt="Daily Report" className="w-full aspect-video object-cover" />
                            )}
                        </div>
                    )}

                    {/* Content / Story / Office note */}
                    {(report.content || report.officeNote || report.storeTopics) && (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 px-1 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3" /> {(isActivity || isStore) ? "STORY / TOPICS" : "WORK LOG"}
                            </h4>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {report.content || report.officeNote || report.storeTopics}
                            </p>
                        </div>
                    )}

                    {/* AI Analysis View */}
                    {report.aiAnalysis && (
                        <div className="bg-indigo-900/5 border border-indigo-100 rounded-2xl p-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-900/10 rounded-full -mr-12 -mt-12 blur-2xl" />
                            <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-[0.15em] mb-3 px-1 flex items-center gap-1.5 relative z-10">
                                <Brain className="w-3 h-3 text-indigo-600" /> AI INSIGHT & ADVICE
                            </h4>
                            <div className="text-sm text-indigo-950 leading-relaxed whitespace-pre-wrap font-medium relative z-10 animate-in fade-in slide-in-from-left-2 duration-500">
                                {report.aiAnalysis}
                            </div>
                        </div>
                    )}

                    {/* Involved Products */}
                    {report.involvedProductIds && report.involvedProductIds.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 px-1">INVOLVED PRODUCTS</p>
                            <div className="flex flex-wrap gap-2">
                                {report.involvedProductIds.map(id => (
                                    <span key={id} className="px-3 py-1 bg-[#b27f79]/5 text-[#b27f79] text-[10px] font-bold rounded-lg border border-[#b27f79]/10">
                                        #{id.slice(0, 8)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Restocking (Store mode) */}
                    {isStore && report.restocking && report.restocking.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 px-1">RESTOCKING</p>
                            <div className="space-y-1">
                                {report.restocking.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50 rounded-lg">
                                        <span className="text-slate-700">{item.productName || "商品"}</span>
                                        <span className="font-bold text-slate-900">{item.qty} 個</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Photos Before/After (Store mode) */}
                    {isStore && ((report.displayBeforeImageUrls && report.displayBeforeImageUrls.length > 0) ||
                        (report.displayAfterImageUrls && report.displayAfterImageUrls.length > 0)) && (
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] px-1">STORE DISPLAY COMPARISON</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Before</div>
                                        {report.displayBeforeImageUrls?.map((url, i) => (
                                            <div key={i} className="aspect-[4/3] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                                                <img src={url} alt="Before" className="w-full h-full object-cover" onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }} />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider px-1">After</div>
                                        {report.displayAfterImageUrls?.map((url, i) => (
                                            <div key={i} className="aspect-[4/3] rounded-xl bg-indigo-50 border border-indigo-100 overflow-hidden">
                                                <img src={url} alt="After" className="w-full h-full object-cover" onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        {report.isTrashed ? (
                            <>
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); onRestore(); }}
                                    className="flex items-center gap-1.5 text-xs font-bold text-green-600 hover:text-green-700 px-3 py-2 rounded-xl hover:bg-green-50 transition-colors"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> 復元
                                </button>
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); if (window.confirm("このデータを完全に削除しますか？この操作は取り消せません。")) onPermanentDelete(); }}
                                    className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> 完全削除
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); onEdit(); }}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    <Pencil className="w-3.5 h-3.5" /> 編集
                                </button>

                                {confirmDelete ? (
                                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 animate-in fade-in duration-150">
                                        <span className="text-xs text-red-600 font-bold">ゴミ箱に移動しますか？</span>
                                        <button
                                            type="button"
                                            onClick={handleDeleteConfirm}
                                            className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            移動
                                        </button>
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
                                            className="text-xs text-slate-400 font-bold hover:text-slate-600 px-2"
                                        >
                                            戻る
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
                                        className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-500 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> 削除
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function ReportsPageContent() {
    const searchParams = useSearchParams();
    const { products, retailStores, sales, dailyReports, spotRecipients, deleteDailyReport, restoreDailyReport, permanentlyDeleteDailyReport, isLoaded } = useStore();
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState<DailyReport | null>(null);
    const [toast, setToast] = useState<"saved" | "updated" | null>(null);
    const [filterType, setFilterType] = useState<"all" | "office" | "store" | "activity">("all");
    const [showTrash, setShowTrash] = useState(false);

    const filterDate = searchParams.get("date");

    const showToast = (type: "saved" | "updated") => {
        setToast(type);
        setTimeout(() => setToast(null), 3000);
    };

    const handleNewSaved = () => { setShowForm(false); showToast("saved"); };
    const handleEditSaved = () => { setEditTarget(null); showToast("updated"); };


    const sorted = [...dailyReports]
        .filter(r => !!r.isTrashed === showTrash)
        .sort((a, b) => b.date.localeCompare(a.date));
    let filtered = filterType === "all" ? sorted : sorted.filter(r => r.type === filterType);

    if (filterDate) {
        filtered = filtered.filter(r => r.date === filterDate);
    }

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: BRAND }}>
                        <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {filterDate && (
                                <Link href="/reports" className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </Link>
                            )}
                            <h1 className="text-xl font-bold text-slate-900">
                                {filterDate ? `${filterDate.replace(/-/g, "/")} の日報` : "業務日報"}
                            </h1>
                        </div>
                        <p className="text-xs text-slate-400">現場の記録を積み上げる</p>
                    </div>
                </div>
                {!filterDate && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowTrash(!showTrash)}
                            className={`flex items-center gap-2 px-4 py-3 font-bold rounded-2xl shadow-sm active:scale-95 transition-all text-sm border ${showTrash ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                        >
                            <Trash2 className="w-4 h-4" />
                            {showTrash ? "戻る" : "ゴミ箱"}
                        </button>
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 px-4 py-3 text-white font-bold rounded-2xl shadow-sm active:scale-95 transition-transform text-sm"
                            style={{ backgroundColor: BRAND }}
                        >
                            <Plus className="w-4 h-4" /> 日報を書く
                        </button>
                    </div>
                )}
            </div>


            {/* Toast */}
            {toast && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm font-medium animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4" />
                    {toast === "saved" ? "日報を保存しました ✨" : "日報を更新しました ✏️"}
                </div>
            )}

            {/* Filter tabs */}
            {dailyReports.length > 0 && (
                <div className="flex gap-2 mb-4">
                    {([
                        { value: "all", label: "すべて" },
                        { value: "activity", label: "📸 活動記録" },
                        { value: "store", label: "🏪 店舗" },
                        { value: "office", label: "🖥 事務所" },
                    ] as const).map(f => (
                        <button key={f.value}
                            onClick={() => setFilterType(f.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filterType === f.value ? "text-white" : "text-slate-500 bg-white border border-slate-200"}`}
                            style={filterType === f.value ? { backgroundColor: BRAND } : {}}
                        >
                            {f.label}
                        </button>
                    ))}
                    <span className="ml-auto text-xs text-slate-400 self-center">{filtered.length}件</span>
                </div>
            )}

            {/* List */}
            {!isLoaded ? (
                <div className="space-y-3">
                    {[1, 2].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4" style={{ backgroundColor: BRAND_LIGHT }}>
                        <ClipboardList className="w-10 h-10" style={{ color: BRAND }} />
                    </div>
                    <h3 className="text-base font-bold text-slate-700 mb-1">
                        {filterType !== "all" ? "該当する日報はありません" : "日報がまだありません"}
                    </h3>
                    <p className="text-sm text-slate-400 mb-6 max-w-xs">
                        現場での気づきや作業内容を記録すると、売上との相関分析にも活用できます。
                    </p>
                    {filterType === "all" && (
                        <button onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 px-5 py-3 text-white font-bold rounded-2xl"
                            style={{ backgroundColor: BRAND }}>
                            <Plus className="w-4 h-4" /> 最初の日報を書く
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(report => (
                        <ReportCard
                            key={report.id}
                            report={report}
                            onDelete={() => deleteDailyReport(report.id)}
                            onEdit={() => setEditTarget(report)}
                            onRestore={() => restoreDailyReport(report.id)}
                            onPermanentDelete={() => permanentlyDeleteDailyReport(report.id)}
                        />
                    ))}
                </div>
            )}

            {/* New Report Form */}
            {showForm && (
                <ReportForm onClose={() => setShowForm(false)} onSaved={handleNewSaved} />
            )}

            {/* Edit Report Form */}
            {editTarget && (
                <ReportForm
                    onClose={() => setEditTarget(null)}
                    onSaved={handleEditSaved}
                    editData={editTarget}
                />
            )}
        </div>
    );
}

export default function ReportsPage() {
    return (
        <Suspense fallback={<div className="p-8">読み込み中...</div>}>
            <ReportsPageContent />
        </Suspense>
    );
}
