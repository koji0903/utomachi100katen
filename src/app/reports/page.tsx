"use client";

import { useState, useEffect, useRef } from "react";
import {
    X, FileText, CheckCircle2, Pencil, ChevronDown, Loader2,
    Thermometer, Wind, Plus, ClipboardList, Trash2, AlertTriangle,
    ChevronRight, Store, Image as ImageIcon, UploadCloud, Save, Package,
    Cloud, CloudSun, CloudRain, CloudSnow
} from "lucide-react";
import { useStore, DailyReport, RestockingItem } from "@/lib/store";
import { uploadImageWithCompression } from "@/lib/imageUpload";

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

type WeatherData = { weather: string; main: string; temp: number; humidity: number; windSpeed: number };

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
    const { retailStores, products, addDailyReport, updateDailyReport } = useStore();
    const isEdit = !!editData;

    const [type, setType] = useState<"office" | "store">(editData?.type ?? "store");
    const [date, setDate] = useState(editData?.date ?? today());
    const [worker, setWorker] = useState(editData?.worker ?? "");
    const [officeNote, setOfficeNote] = useState(editData?.officeNote ?? "");
    const [storeId, setStoreId] = useState(editData?.storeId ?? "");
    const [storeTopics, setStoreTopics] = useState(editData?.storeTopics ?? "");
    const [displayBeforeImageUrls, setDisplayBeforeImageUrls] = useState<string[]>(editData?.displayBeforeImageUrls ?? []);
    const [displayAfterImageUrls, setDisplayAfterImageUrls] = useState<string[]>(editData?.displayAfterImageUrls ?? []);
    const [restocking, setRestocking] = useState<RestockingItem[]>(editData?.restocking ?? []);

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

    const [weather, setWeather] = useState<WeatherData | null>(
        editData?.weatherMain
            ? { weather: editData.weather ?? "", main: editData.weatherMain, temp: editData.temperature ?? 0, humidity: editData.humidity ?? 0, windSpeed: editData.windSpeed ?? 0 }
            : null
    );
    const [fetchingWeather, setFetchingWeather] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const selectedStore = retailStores.find(s => s.id === storeId);

    // Auto-fetch weather when store with lat/lng is selected (not when editing and store unchanged)
    useEffect(() => {
        if (!selectedStore?.lat || !selectedStore?.lng) {
            if (!isEdit) setWeather(null);
            return;
        }
        // If editing and the store hasn't changed, keep existing weather
        if (isEdit && storeId === editData?.storeId && weather) return;
        setFetchingWeather(true);
        fetch(`/api/weather?lat=${selectedStore.lat}&lon=${selectedStore.lng}`)
            .then(r => r.json())
            .then(d => { if (!d.error) setWeather(d); })
            .catch(() => { })
            .finally(() => setFetchingWeather(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeId, selectedStore?.lat, selectedStore?.lng]);

    const handleBeforeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newFiles = [...beforeFiles, ...files];
        setBeforeFiles(newFiles);

        const newPreviews = files.map((file, i) => ({
            url: URL.createObjectURL(file),
            fileIndex: beforeFiles.length + i,
            isExisting: false
        }));
        setBeforePreviews([...beforePreviews, ...newPreviews]);

        // Reset input value to allow selecting same file again
        if (beforeInputRef.current) beforeInputRef.current.value = "";
    };

    const handleAfterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newFiles = [...afterFiles, ...files];
        setAfterFiles(newFiles);

        const newPreviews = files.map((file, i) => ({
            url: URL.createObjectURL(file),
            fileIndex: afterFiles.length + i,
            isExisting: false
        }));
        setAfterPreviews([...afterPreviews, ...newPreviews]);

        if (afterInputRef.current) afterInputRef.current.value = "";
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!worker.trim()) return;
        setIsSaving(true);
        try {
            // 1. Upload new Before images
            const beforeUrls: string[] = [];
            for (const p of beforePreviews) {
                if (p.isExisting) {
                    beforeUrls.push(p.url);
                } else if (p.fileIndex !== undefined) {
                    const url = await uploadImageWithCompression(beforeFiles[p.fileIndex]);
                    beforeUrls.push(url);
                }
            }

            // 2. Upload new After images
            const afterUrls: string[] = [];
            for (const p of afterPreviews) {
                if (p.isExisting) {
                    afterUrls.push(p.url);
                } else if (p.fileIndex !== undefined) {
                    const url = await uploadImageWithCompression(afterFiles[p.fileIndex]);
                    afterUrls.push(url);
                }
            }

            const payload: Omit<DailyReport, "id" | "createdAt"> = {
                date, worker, type,
                ...(weather ? { weather: weather.weather, weatherMain: weather.main, temperature: weather.temp, humidity: weather.humidity, windSpeed: weather.windSpeed } : {}),
                ...(type === "office"
                    ? { officeNote }
                    : {
                        storeId, storeName: selectedStore?.name ?? editData?.storeName ?? "",
                        restocking: restocking.filter(r => r.productId),
                        storeTopics,
                        displayBeforeImageUrls: beforeUrls,
                        displayAfterImageUrls: afterUrls,
                    }),
            };
            if (isEdit && editData) {
                await updateDailyReport(editData.id, payload);
            } else {
                await addDailyReport(payload);
            }
            onSaved();
        } catch (error) {
            console.error("Save report error:", error);
            alert("保存に失敗しました。");
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
                            <p className="text-xs text-slate-400">{date}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable body */}
                <form id="report-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">

                    {/* Type toggle */}
                    <div className="grid grid-cols-2 gap-2 bg-white rounded-2xl p-1.5 border border-slate-200">
                        {([
                            { value: "store", label: "🏪 店舗メンテ" },
                            { value: "office", label: "🖥 事務所作業" },
                        ] as const).map(opt => (
                            <button key={opt.value} type="button"
                                onClick={() => setType(opt.value)}
                                className={`py-3 rounded-xl text-sm font-bold transition-all ${type === opt.value ? "text-white shadow-sm" : "text-slate-500"}`}
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
                                                    <div className="font-bold text-slate-800">{weather.temp}°C <span className="font-normal text-slate-500 text-sm">{weather.weather}</span></div>
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
                                            <span className="text-xs text-red-400">天気の取得に失敗しました</span>
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
                                        {restocking.map((item, i) => (
                                            <RestockingRow
                                                key={i}
                                                item={item}
                                                products={products}
                                                onChange={v => setRestocking(prev => prev.map((x, j) => j === i ? v : x))}
                                                onRemove={() => setRestocking(prev => prev.filter((_, j) => j !== i))}
                                            />
                                        ))}
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
                                        <input type="file" multiple ref={beforeInputRef} onChange={handleBeforeChange} accept="image/*" className="hidden" />
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
                                        <input type="file" multiple ref={afterInputRef} onChange={handleAfterChange} accept="image/*" className="hidden" />
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
                </form>

                {/* Footer */}
                <div className="px-5 pt-3 pb-6 border-t border-slate-200 bg-white">
                    <button
                        type="submit"
                        form="report-form"
                        disabled={isSaving || !worker.trim()}
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
}: {
    report: DailyReport;
    onDelete: () => void;
    onEdit: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    // Inline delete confirmation state
    const [confirmDelete, setConfirmDelete] = useState(false);

    const isStore = report.type === "store";
    const dateLabel = report.date.replace(/-/g, "/");

    const handleDeleteConfirm = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setConfirmDelete(false);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Summary row — tap to expand */}
            <button
                className="w-full text-left p-4 flex items-center gap-3"
                onClick={() => { setExpanded(e => !e); setConfirmDelete(false); }}
            >
                {/* Left accent */}
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: isStore ? BRAND : "#94a3b8" }} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{dateLabel}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={isStore ? { backgroundColor: BRAND_LIGHT, color: BRAND } : { backgroundColor: "#f1f5f9", color: "#64748b" }}>
                            {isStore ? "🏪 店舗メンテ" : "🖥 事務所"}
                        </span>
                        {isStore && report.storeName && (
                            <span className="text-xs text-slate-500 truncate">{report.storeName}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400">👤 {report.worker}</span>
                        {report.temperature !== undefined && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <WeatherIcon main={report.weatherMain} size={3} />
                                {report.temperature}°C
                            </span>
                        )}
                        {isStore && report.restocking && report.restocking.length > 0 && (
                            <span className="text-xs text-slate-400">📦 {report.restocking.length}品目補充</span>
                        )}
                    </div>
                </div>

                <ChevronRight className={`w-4 h-4 text-slate-300 shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
            </button>

            {/* Expanded detail */}
            {expanded && (
                <div className="px-5 pb-4 pt-1 border-t border-slate-100 space-y-3 text-sm">
                    {/* Weather detail */}
                    {report.temperature !== undefined && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                            <WeatherIcon main={report.weatherMain} size={6} />
                            <div>
                                <span className="font-semibold text-slate-700">{report.temperature}°C {report.weather}</span>
                                {report.humidity && <span className="text-xs text-slate-400 ml-2">湿度{report.humidity}% / 風速{report.windSpeed}m/s</span>}
                            </div>
                        </div>
                    )}

                    {/* Office note */}
                    {report.officeNote && (
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">📝 作業内容</p>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{report.officeNote}</p>
                        </div>
                    )}

                    {/* Restocking */}
                    {report.restocking && report.restocking.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-2">📦 補充商品</p>
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

                    {/* Display Comparison (Multiple Photos) */}
                    {((report.displayBeforeImageUrls && report.displayBeforeImageUrls.length > 0) ||
                        (report.displayAfterImageUrls && report.displayAfterImageUrls.length > 0)) && (
                            <div>
                                <p className="text-xs font-semibold text-slate-400 mb-2">📸 商品陳列 Before / After</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Before Column */}
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Before</div>
                                        <div className="space-y-2">
                                            {report.displayBeforeImageUrls && report.displayBeforeImageUrls.length > 0 ? (
                                                report.displayBeforeImageUrls.map((url, i) => (
                                                    <div key={i} className="aspect-[4/3] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative group">
                                                        <img
                                                            src={url}
                                                            alt={`Before ${i}`}
                                                            className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-105"
                                                            onClick={() => window.open(url, '_blank')}
                                                        />
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="aspect-[4/3] rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-[10px] font-bold">No Image</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* After Column */}
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider px-1">After</div>
                                        <div className="space-y-2">
                                            {report.displayAfterImageUrls && report.displayAfterImageUrls.length > 0 ? (
                                                report.displayAfterImageUrls.map((url, i) => (
                                                    <div key={i} className="aspect-[4/3] rounded-xl bg-slate-100 border border-blue-100 overflow-hidden relative group">
                                                        <img
                                                            src={url}
                                                            alt={`After ${i}`}
                                                            className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-105"
                                                            onClick={() => window.open(url, '_blank')}
                                                        />
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="aspect-[4/3] rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-[10px] font-bold">No Image</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    {/* Topics */}
                    {report.storeTopics && (
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">💬 トピックス</p>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{report.storeTopics}</p>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        {/* Edit */}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onEdit(); }}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <Pencil className="w-3.5 h-3.5" /> 編集
                        </button>

                        {/* Delete — with inline confirm */}
                        {confirmDelete ? (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 animate-in fade-in duration-150">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <span className="text-xs text-red-600 font-medium">削除しますか？</span>
                                <button
                                    type="button"
                                    onClick={handleDeleteConfirm}
                                    className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-lg transition-colors"
                                >
                                    削除
                                </button>
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
                                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    キャンセル
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
                                className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> 削除
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
    const { dailyReports, deleteDailyReport, isLoaded } = useStore();
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState<DailyReport | null>(null);
    const [toast, setToast] = useState<"saved" | "updated" | null>(null);
    const [filterType, setFilterType] = useState<"all" | "office" | "store">("all");

    const showToast = (type: "saved" | "updated") => {
        setToast(type);
        setTimeout(() => setToast(null), 3000);
    };

    const handleNewSaved = () => { setShowForm(false); showToast("saved"); };
    const handleEditSaved = () => { setEditTarget(null); showToast("updated"); };

    const sorted = [...dailyReports].sort((a, b) => b.date.localeCompare(a.date));
    const filtered = filterType === "all" ? sorted : sorted.filter(r => r.type === filterType);

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: BRAND }}>
                        <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">業務日報</h1>
                        <p className="text-xs text-slate-400 mt-0.5">現場の記録を積み上げる</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-3 text-white font-bold rounded-2xl shadow-sm active:scale-95 transition-transform text-sm"
                    style={{ backgroundColor: BRAND }}
                >
                    <Plus className="w-4 h-4" /> 日報を書く
                </button>
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
