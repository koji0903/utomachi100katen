"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Calendar,
    Save,
    Store as StoreIcon,
    TrendingUp,
    CheckCircle2,
    BarChart3,
    CloudSun, Cloud, CloudRain, CloudSnow,
    Thermometer, Wind, Package, ChevronLeft,
    Sparkles, Edit2, Trash2, RotateCcw,
    ArrowUpDown, ChevronUp, ChevronDown, Target, RefreshCw, FileText
} from "lucide-react";
import { useStore, Product, RetailStore, Sale } from "@/lib/store";
import { getHolidayName } from "@/lib/holidays";
import { SalesAnalysisTab } from "@/components/SalesAnalysisTab";
import { NumberInput } from "@/components/NumberInput";
import { showNotification } from "@/lib/notifications";
import { syncWithSquare } from "@/lib/square-sync-client";
import { apiFetch, checkIsDemoMode } from "@/lib/apiClient";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";

// ─── Weather helpers ──────────────────────────────────────────────────────────
function WeatherIcon({ main, size = 4 }: { main?: string; size?: number }) {
    const cls = `w-${size} h-${size}`;
    if (!main) return <CloudSun className={`${cls} text-slate-300`} />;
    if (main.includes("Rain") || main.includes("Drizzle")) return <CloudRain className={`${cls} text-blue-400`} />;
    if (main.includes("Snow")) return <CloudSnow className={`${cls} text-sky-300`} />;
    if (main.includes("Cloud")) return <Cloud className={`${cls} text-slate-400`} />;
    return <CloudSun className={`${cls} text-amber-400`} />;
}

// ─── Sales Input Tab ──────────────────────────────────────────────────────────
function SalesInputTab({ editingSale, onClearEdit }: { editingSale: Sale | null; onClearEdit: () => void }) {
    const { isLoaded, products, brands, retailStores, spotRecipients, dailyWeather, dailyReports, addSale, updateSale, deleteSale, fetchAndSaveWeatherIfNeeded, mutateSales, mutateDailyReports, mutateTransactions, mutateTransactionItems } = useStore();


    const [selectedStoreId, setSelectedStoreId] = useState<string>(""); // Format: "type:id" (e.g. "store:xxx" or "spot:yyy")
    const [inputMode, setInputMode] = useState<'daily' | 'monthly'>('daily');
    const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [targetMonth, setTargetMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [salesData, setSalesData] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [isSyncingSquare, setIsSyncingSquare] = useState(false);

    const handleSquareSync = async () => {
        if (!selectedStore?.squareLocationId) {
            showNotification("この店舗にはSquareの位置IDが設定されていません。", "error");
            return;
        }

        if (!window.confirm(`${selectedStore.name} のSquareデータを同期しますか？\n(全期間の注文取込と在庫の書き込みを行います)`)) {
            return;
        }

        setIsSyncingSquare(true);
        try {
            const result = await syncWithSquare(selectedStore.id);
            if (result.success) {
                showNotification(result.message, "success");
                // リフレッシュを強制実行
                await mutateSales();
                await mutateDailyReports();
                await mutateTransactions();
                await mutateTransactionItems();
            } else {

                let errorMessage = result.message;
                if (result.detail) errorMessage += `\n詳解: ${result.detail}`;
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            console.error("Square Sync Error:", error);
            showNotification(error.message || "Square同期中にエラーが発生しました。", "error");
        } finally {
            setIsSyncingSquare(false);
        }
    };

    // For inline spot creation
    const [isCreatingSpot, setIsCreatingSpot] = useState(false);
    const [newSpotName, setNewSpotName] = useState("");
    const { addSpotRecipient } = useStore();

    useEffect(() => {
        if (editingSale) {
            setSelectedStoreId(editingSale.recipientType === 'spot' ? `spot:${editingSale.storeId}` : `store:${editingSale.storeId}`);
            setInputMode(editingSale.type || 'daily');
            if (editingSale.type === 'monthly') {
                setTargetMonth(editingSale.period);
            } else {
                setTargetDate(editingSale.period);
            }
            const data: Record<string, number> = {};
            editingSale.items.forEach(item => {
                data[item.productId] = item.quantity;
            });
            setSalesData(data);
        } else {
            setSalesData({});
        }
        setSaveSuccess(false);
    }, [editingSale]);

    const selectedStoreIdRaw = selectedStoreId.includes(':') ? selectedStoreId.split(':')[1] : selectedStoreId;
    const isSpotSelection = selectedStoreId.startsWith('spot:');

    const selectedStore = useMemo(() =>
        retailStores.find(s => s.id === selectedStoreIdRaw), [retailStores, selectedStoreIdRaw]
    );

    const selectedSpot = useMemo(() =>
        spotRecipients.find(s => s.id === selectedStoreIdRaw), [spotRecipients, selectedStoreIdRaw]
    );

    // Fetch weather automatically if missing
    useEffect(() => {
        if (selectedStore && selectedStore.lat && selectedStore.lng && inputMode === 'daily') {
            fetchAndSaveWeatherIfNeeded(selectedStore.id, selectedStore.lat, selectedStore.lng, targetDate);
        }
    }, [selectedStore, inputMode, targetDate, fetchAndSaveWeatherIfNeeded]);

    const weatherInfo = useMemo(() => {
        if (!selectedStoreIdRaw || inputMode !== 'daily' || isSpotSelection) return null;
        // Priority: 1. Daily Report, 2. Automated Daily Weather
        const report = dailyReports.find(r => r.storeId === selectedStoreIdRaw && r.date === targetDate);
        if (report?.temperature !== undefined) {
            return {
                temp: report.temperature,
                tempMin: report.temperatureMin,
                tempMax: report.temperatureMax,
                weather: report.weather,
                weatherMain: report.weatherMain 
            };
        }
        const auto = dailyWeather.find(w => w.storeId === selectedStoreIdRaw && w.date === targetDate);
        if (auto) {
            return {
                temp: auto.temp,
                tempMin: auto.tempMin,
                tempMax: auto.tempMax,
                weather: auto.weather,
                weatherMain: auto.weatherMain 
            };
        }
        return null;
    }, [selectedStoreId, targetDate, inputMode, dailyReports, dailyWeather]);

    const sortedProducts = useMemo(() => {
        const brandMap = new Map(brands.map(b => [b.id, b.name]));

        // Filter products based on store assignment (only for retail stores, spots can get any)
        let filteredProducts = [...products];
        if (!isSpotSelection && selectedStore?.activeProductIds && selectedStore.activeProductIds.length > 0) {
            filteredProducts = products.filter(p => selectedStore.activeProductIds?.includes(p.id));
        }

        const base = filteredProducts.sort((a, b) => {
            const brandA = brandMap.get(a.brandId) || "";
            const brandB = brandMap.get(b.brandId) || "";
            if (brandA !== brandB) return brandA.localeCompare(brandB);
            return a.name.localeCompare(b.name);
        });

        if (!sortConfig) return base;

        return [...base].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortConfig.key) {
                case 'name':
                    aValue = a.name;
                    bValue = b.name;
                    break;
                case 'brand':
                    aValue = brandMap.get(a.brandId) || "";
                    bValue = brandMap.get(b.brandId) || "";
                    break;
                case 'price':
                    const storePriceA = a.storePrices?.find(sp => sp.storeId === selectedStoreIdRaw)?.price ?? a.sellingPrice;
                    const storePriceB = b.storePrices?.find(sp => sp.storeId === selectedStoreIdRaw)?.price ?? b.sellingPrice;
                    aValue = storePriceA;
                    bValue = storePriceB;
                    break;
                case 'quantity':
                    aValue = salesData[a.id] || 0;
                    bValue = salesData[b.id] || 0;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [products, brands, sortConfig, salesData, selectedStoreIdRaw, isSpotSelection, selectedStore]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            setSortConfig(null);
            return;
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
        return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />;
    };

    const handleQuantityChange = (productId: string, value: string) => {
        const qty = parseInt(value) || 0;
        setSalesData(prev => ({ ...prev, [productId]: Math.max(0, qty) }));
    };

    const calculateRowDetails = (product: Product, quantity: number) => {
        const storePriceObj = product.storePrices?.find(sp => sp.storeId === selectedStoreIdRaw);
        const price = (storePriceObj && storePriceObj.price > 0 && !isSpotSelection) ? storePriceObj.price : product.sellingPrice;
        const subtotal = price * quantity;
        
        let commissionRate = 0;
        if (!isSpotSelection) {
            // Safety: only type 'A' (Consignment) has commission. B and C are 0%.
            commissionRate = selectedStore?.type === 'A' ? (selectedStore.commissionRate ?? 15) : 0;
        }
        
        const commission = Math.floor(subtotal * (commissionRate / 100));
        const netProfit = subtotal - commission;
        return { price, subtotal, commission, netProfit };
    };

    const totals = useMemo(() => {
        let totalQty = 0, totalAmt = 0, totalComm = 0, totalNet = 0;
        products.forEach(product => {
            const qty = salesData[product.id] || 0;
            if (qty > 0) {
                const { subtotal, commission, netProfit } = calculateRowDetails(product, qty);
                totalQty += qty; totalAmt += subtotal; totalComm += commission; totalNet += netProfit;
            }
        });
        return { totalQty, totalAmt, totalComm, totalNet };
    }, [products, salesData, selectedStoreIdRaw, isSpotSelection, selectedStore]);

    const handleSave = async () => {
        if (!selectedStoreIdRaw) return;
        if (totals.totalQty === 0) { alert("売上個数を入力してください。"); return; }
        setIsSaving(true);
        try {
            const saleItems = products.filter(p => (salesData[p.id] || 0) > 0).map(p => {
                const qty = salesData[p.id];
                const details = calculateRowDetails(p, qty);
                return { productId: p.id, quantity: qty, priceAtSale: details.price, subtotal: details.subtotal, commission: details.commission, netProfit: details.netProfit };
            });

            const saleData = {
                storeId: selectedStoreIdRaw,
                recipientType: isSpotSelection ? 'spot' as const : 'store' as const,
                type: inputMode,
                period: inputMode === 'daily' ? targetDate : targetMonth,
                items: saleItems,
                totalQuantity: totals.totalQty,
                totalAmount: totals.totalAmt,
                totalCommission: totals.totalComm,
                totalNetProfit: totals.totalNet,
                ...(inputMode === 'daily' && weatherInfo ? {
                    weather: weatherInfo.weather,
                    weatherMain: weatherInfo.weatherMain,
                    temperature: weatherInfo.temp,
                    temperatureMin: weatherInfo.tempMin,
                    temperatureMax: weatherInfo.tempMax
                } : {})
            };

            if (editingSale) {
                await updateSale(editingSale.id, saleData);
                onClearEdit();
            } else {
                await addSale(saleData);
            }

            setSaveSuccess(true);
            if (!editingSale) setSalesData({});
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Save error:", error);
            alert("保存に失敗しました。");
        } finally { setIsSaving(false); }
    };

    const handleDelete = async () => {
        if (!editingSale) return;
        if (!window.confirm("この売上データを削除してもよろしいですか？在庫数も自動的に差し戻されます。")) return;

        setIsSaving(true);
        try {
            await deleteSale(editingSale.id);
            onClearEdit();
        } catch (error) {
            console.error("Delete error:", error);
            alert("削除に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateSpot = async () => {
        if (!newSpotName.trim()) return;
        setIsSaving(true);
        try {
            const newSpot = await addSpotRecipient({ name: newSpotName.trim() });
            setSelectedStoreId(`spot:${newSpot.id}`);
            setIsCreatingSpot(false);
            setNewSpotName("");
        } catch (error) {
            console.error("Spot creation error:", error);
            alert("スポットの追加に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isLoaded) return <div className="p-8">読み込み中...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">販売店舗・事業者</label>
                        {!isCreatingSpot && (
                            <select value={selectedStoreId} onChange={e => {
                                if (e.target.value === "new_spot") {
                                    setIsCreatingSpot(true);
                                    setSelectedStoreId("");
                                } else {
                                    setSelectedStoreId(e.target.value);
                                }
                            }}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 font-medium">
                                <option value="">宛先を選択してください</option>
                                <optgroup label="登録店舗">
                                    {retailStores.map(store => <option key={`store:${store.id}`} value={`store:${store.id}`}>{store.name}</option>)}
                                </optgroup>
                                {spotRecipients.filter(s => !s.isTrashed).length > 0 && (
                                    <optgroup label="スポット宛先">
                                        {spotRecipients.filter(s => !s.isTrashed).map(spot => <option key={`spot:${spot.id}`} value={`spot:${spot.id}`}>{spot.name}</option>)}
                                    </optgroup>
                                )}
                                <optgroup label="新規作成">
                                    <option value="new_spot">＋ 新規スポット宛先を追加</option>
                                </optgroup>
                            </select>
                        )}
                        {!isCreatingSpot && selectedStore?.squareLocationId && (
                            <button
                                type="button"
                                onClick={handleSquareSync}
                                disabled={isSyncingSquare}
                                className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSquare ? "animate-spin" : ""}`} />
                                {isSyncingSquare ? "Square同期中..." : "Squareから同期"}
                            </button>
                        )}
                        {isCreatingSpot && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newSpotName}
                                    onChange={e => setNewSpotName(e.target.value)}
                                    placeholder="スポット宛先名"
                                    className="w-full px-4 py-2 bg-slate-50 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 text-sm font-bold"
                                    autoFocus
                                />
                                <button
                                    onClick={handleCreateSpot}
                                    disabled={!newSpotName.trim()}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                                >
                                    登録
                                </button>
                                <button
                                    onClick={() => {
                                        setIsCreatingSpot(false);
                                        setNewSpotName("");
                                    }}
                                    className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-200 whitespace-nowrap"
                                >
                                    取消
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">入力モード</label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                            {(['daily', 'monthly'] as const).map(mode => (
                                <button key={mode} onClick={() => setInputMode(mode)}
                                    className={`py-2 text-xs font-bold rounded-lg transition-all ${inputMode === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {mode === 'daily' ? '日次' : '月次'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {inputMode === 'daily' ? '対象日' : '対象月'}
                            {inputMode === 'daily' && getHolidayName(targetDate) && (
                                <span className="ml-1 text-red-500 font-black">({getHolidayName(targetDate)})</span>
                            )}
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input type={inputMode === 'daily' ? 'date' : 'month'}
                                value={inputMode === 'daily' ? targetDate : targetMonth}
                                onChange={e => inputMode === 'daily' ? setTargetDate(e.target.value) : setTargetMonth(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-900" />
                        </div>
                    </div>
                </div>

                {/* Totals card */}
                <div className="bg-blue-600 rounded-2xl shadow-lg p-6 text-white space-y-6 overflow-hidden relative">
                    <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 pointer-events-none" />
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-blue-100 uppercase tracking-wider mb-4">入力合計</div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-baseline">
                                <span className="text-blue-200 text-sm">売上個数</span>
                                <span className="text-xl font-bold">{totals.totalQty}<small className="ml-1 text-xs">個</small></span>
                            </div>
                            <div className="flex justify-between items-baseline">
                                <span className="text-blue-200 text-sm">売上総額</span>
                                <span className="text-xl font-bold">¥{totals.totalAmt.toLocaleString()}</span>
                            </div>
                            <div className="h-px bg-blue-500/50 my-2" />
                            <div className="flex justify-between items-baseline">
                                <span className="text-blue-200 text-sm">
                                    {isSpotSelection ? "店舗手数料 (0%)" : `店舗手数料 (${selectedStore?.commissionRate ?? 15}%)`}
                                </span>
                                <span className="text-lg font-semibold text-blue-100">-¥{totals.totalComm.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-baseline pt-2">
                                <span className="text-white text-sm font-bold">入金見込額</span>
                                <span className="text-2xl font-black">¥{totals.totalNet.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={!selectedStoreIdRaw || totals.totalQty === 0 || isSaving}
                        className={`w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-bold shadow-md transition-all relative z-10 ${editingSale ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200' : 'bg-white text-blue-600 hover:bg-blue-50'}`}>
                        {isSaving ? <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${editingSale ? 'border-amber-700' : 'border-blue-600'}`} /> : (editingSale ? <Edit2 className="w-5 h-5" /> : <Save className="w-5 h-5" />)}
                        {isSaving ? "保存中..." : (editingSale ? "データを更新する" : "データを保存する")}
                    </button>
                    {editingSale && (
                        <div className="space-y-2 mt-4">
                            <button onClick={onClearEdit} className="w-full py-2 text-xs font-bold text-blue-100 hover:text-white transition-colors underline decoration-blue-400">
                                編集をキャンセルして新規入力に戻る
                            </button>
                            <button onClick={handleDelete} disabled={isSaving}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-red-100 hover:text-white hover:bg-red-500/20 transition-all border border-red-400/30 text-xs">
                                <Trash2 className="w-4 h-4" />
                                この売上データを削除する
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Input table */}
            <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                    {!selectedStoreIdRaw ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-4">
                            <div className="p-4 bg-slate-50 rounded-full"><StoreIcon className="w-12 h-12 text-slate-200" /></div>
                            <p className="font-medium">まずは販売先（店舗またはスポット）を選択してください</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <StoreIcon className="w-5 h-5 text-blue-500" />{isSpotSelection ? selectedSpot?.name : selectedStore?.name}
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        {weatherInfo && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                                                <WeatherIcon main={weatherInfo.weatherMain} size={4} />
                                                <div className="flex flex-col items-center justify-center">
                                                    <span className="text-xs font-bold text-slate-700 leading-tight">{weatherInfo.temp}°C</span>
                                                    {(weatherInfo.tempMin !== undefined && weatherInfo.tempMax !== undefined) && (
                                                        <span className="text-[9px] font-bold leading-none mt-0.5">
                                                            <span className="text-red-400">{weatherInfo.tempMax}°</span>
                                                            <span className="text-slate-300 mx-0.5">/</span>
                                                            <span className="text-blue-400">{weatherInfo.tempMin}°</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500">{weatherInfo.weather}</span>
                                            </div>
                                        )}
                                        <div className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">{products.length} 商品が登録されています</div>
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                            <th
                                                className="px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                                onClick={() => requestSort('name')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    商品名 {getSortIcon('name')}
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-4 text-right cursor-pointer hover:bg-slate-50 transition-colors"
                                                onClick={() => requestSort('price')}
                                            >
                                                <div className="flex items-center justify-end gap-2 text-right">
                                                    単価 {getSortIcon('price')}
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-4 text-center w-32 cursor-pointer hover:bg-slate-50 transition-colors"
                                                onClick={() => requestSort('quantity')}
                                            >
                                                <div className="flex items-center justify-center gap-2">
                                                    売上個数 {getSortIcon('quantity')}
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-right">小計</th>
                                            <th className="px-6 py-4 text-right">入金額 (純利)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedProducts.map(product => {
                                            const qty = salesData[product.id] || 0;
                                            const { price, subtotal, netProfit } = calculateRowDetails(product, qty);
                                            return (
                                                <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                                                                {brands.find(b => b.id === product.brandId)?.name || "不明"}
                                                            </span>
                                                        </div>
                                                        <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors mt-0.5">{product.name}</div>
                                                        {product.variantName && (
                                                            <div className="text-[10px] text-slate-500 font-medium">{product.variantName}</div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right"><div className="text-sm font-medium text-slate-600">¥{price.toLocaleString()}</div></td>
                                                    <td className="px-6 py-4">
                                                        <NumberInput
                                                            min={0}
                                                            value={salesData[product.id]}
                                                            onChange={val => handleQuantityChange(product.id, val !== undefined ? val.toString() : "")}
                                                            className={`w-full px-3 py-2 text-center font-black rounded-lg border transition-all ${qty > 0 ? 'bg-blue-50 border-blue-200 text-blue-600 ring-2 ring-blue-500/10' : 'bg-white border-slate-200 text-slate-400 focus:border-blue-400 focus:text-slate-900'} focus:outline-none`}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 text-right"><div className={`text-sm font-bold ${qty > 0 ? 'text-slate-900' : 'text-slate-300'}`}>¥{subtotal.toLocaleString()}</div></td>
                                                    <td className="px-6 py-4 text-right"><div className={`text-sm font-black ${qty > 0 ? 'text-blue-600' : 'text-slate-200'}`}>¥{netProfit.toLocaleString()}</div></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Daily Log Tab ────────────────────────────────────────────────────────────
function DailyLogTab({ onEdit, filterDate }: { onEdit: (sale: Sale) => void, filterDate?: string }) {

    const { sales, unifiedSales, products, brands, retailStores, spotRecipients, dailyReports, dailyWeather, deleteSale, restoreSale, permanentlyDeleteSale, mutateSales, mutateDailyReports, mutateTransactions, mutateTransactionItems } = useStore();


    // Filter controls
    const [logType, setLogType] = useState<'daily' | 'monthly'>('daily');
    const [filterStoreId, setFilterStoreId] = useState<string>("");
    const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [showTrash, setShowTrash] = useState(false);
    const [isTransposed, setIsTransposed] = useState(false);
    const [isSyncingSquare, setIsSyncingSquare] = useState(false);
    const searchParams = useSearchParams();
    const highlightId = searchParams.get("id");

    const handleSquareSync = async () => {
        if (!filterStoreId) return;
        const filterParts = filterStoreId.split(':');
        if (filterParts[0] !== 'store') return;
        const storeId = filterParts[1];
        const store = retailStores.find(s => s.id === storeId);

        if (!store?.squareLocationId) {
            showNotification("この店舗にはSquareの位置IDが設定されていません。", "error");
            return;
        }

        if (!window.confirm(`${store.name} のSquareデータを同期しますか？\n(全期間の注文取込と在庫の書き込みを行います)`)) {
            return;
        }

        setIsSyncingSquare(true);
        try {
            const result = await syncWithSquare(store.id);
            if (result.success) {
                showNotification(result.message, "success");
                // リフレッシュを強制実行
                await mutateSales();
                await mutateDailyReports();
                await mutateTransactions();
                await mutateTransactionItems();
            } else {
                let errorMessage = result.message;
                if (result.detail) errorMessage += `\n詳解: ${result.detail}`;
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            console.error("Square Sync Error:", error);
            showNotification(error.message || "Square同期中にエラーが発生しました。", "error");
        } finally {
            setIsSyncingSquare(false);
        }
    };

    const handleDiagnostics = () => {
        console.log("--- SQUARE 同期・未連携商品の診断レポート ---");
        const unlinkedSales = sales.filter(s => s.items.some(i => i.productId === 'SQUARE_UNLINKED'));
        
        if (unlinkedSales.length === 0) {
            console.log("未連携の商品は現在見つかりませんでした。");
            alert("未連携の商品は現在見つかりませんでした。再度「Square同期」をやり直してからお試しください。");
            return;
        }

        const report: any[] = [];
        const uniqueItems = new Set();

        unlinkedSales.forEach(s => {
            s.items.filter(i => i.productId === 'SQUARE_UNLINKED').forEach(i => {
                const key = `${i.productName}|${i.catalogObjectId}`;
                if (!uniqueItems.has(key)) {
                    uniqueItems.add(key);
                    report.push({
                        "商品名(Square)": i.productName || "不明",
                        "カタログID": i.catalogObjectId || "N/A",
                        "推定金額": i.subtotal / (i.quantity || 1),
                        "最終確認日": s.period,
                        "店舗": s.storeName || s.storeId
                    });
                }
            });
        });

        console.table(report);
        console.log("--- 抽出完了 ---");
        console.log("上記カタログIDを、Firestoreのproductsコレクション内の商品データの squareVariantId フィールドに設定してください。");
        alert("ブラウザのコンソール（F12）に診断レポートを出力しました。未連携商品のカタログIDを確認できます。");
    };



    useEffect(() => {
        if (filterDate) {
            setLogType('daily');
            setFilterMonth(filterDate.slice(0, 7));
        }
    }, [filterDate]);

    // Build product name map
    const productMap = useMemo(() => {
        const m: Record<string, string> = {};
        products.forEach(p => { m[p.id] = p.variantName ? `${p.name} (${p.variantName})` : p.name; });
        m["SQUARE_UNLINKED"] = "【未連携商品】(Square)";
        return m;

    }, [products]);

    const storeMap = useMemo(() => {
        const m: Record<string, string> = {};
        retailStores.forEach(s => { m[s.id] = s.name; });
        spotRecipients.forEach(s => { m[s.id] = s.name; });
        return m;
    }, [retailStores, spotRecipients]);

    // Filter sales to selected logType + selected filters
    const filteredSales = useMemo(() => {
        return unifiedSales
            .filter(s => !!s.isTrashed === showTrash)
            .filter(s => s.type === logType || (!s.type && logType === 'daily'))
            .filter(s => {
                if (!filterStoreId) return true;
                const filterParts = filterStoreId.split(':');
                if (filterParts.length === 2) {
                    // Treat undefined recipientType as 'store' for backward compatibility
                    const recordType = s.recipientType || 'store';
                    return s.storeId === filterParts[1] && recordType === filterParts[0];
                }
                return s.storeId === filterStoreId; // fallback for old data without prefix
            })
            .filter(s => {
                if (filterDate) {
                    return s.period === filterDate;
                }
                if (logType === 'daily') {
                    return s.period.startsWith(filterMonth);
                } else {
                    return s.period.startsWith(filterYear);
                }
            });
    }, [unifiedSales, logType, filterStoreId, filterMonth, filterYear, filterDate, showTrash]);

    useEffect(() => {
        if (highlightId && filteredSales.length > 0) {
            setTimeout(() => {
                const el = document.getElementById(`sale-${highlightId}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [highlightId, filteredSales.length]);

    const sortedSales = useMemo(() => {
        // When transposed, user wants chronological order (oldest -> newest) for columns
        if (isTransposed) {
            return [...filteredSales].sort((a, b) => a.period.localeCompare(b.period));
        }

        const base = [...filteredSales].sort((a, b) => b.period.localeCompare(a.period));

        if (!sortConfig) return base;

        return [...filteredSales].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortConfig.key) {
                case 'period':
                    aValue = a.period;
                    bValue = b.period;
                    break;
                case 'store':
                    aValue = storeMap[a.storeId] || "";
                    bValue = storeMap[b.storeId] || "";
                    break;
                case 'totalQuantity':
                    aValue = a.totalQuantity;
                    bValue = b.totalQuantity;
                    break;
                case 'totalAmount':
                    aValue = a.totalAmount;
                    bValue = b.totalAmount;
                    break;
                case 'totalNetProfit':
                    aValue = a.totalNetProfit;
                    bValue = b.totalNetProfit;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredSales, sortConfig, storeMap, isTransposed]);

    // Build weather lookup: key = "YYYY-MM-DD|storeId"
    const weatherMap = useMemo(() => {
        const m: Record<string, { temp?: number; tempMin?: number; tempMax?: number; weather?: string; weatherMain?: string; humidity?: number; windSpeed?: number }> = {};
        // 1. Process dailyWeather (Automated)
        dailyWeather.forEach(w => {
            const key = `${w.date}|${w.storeId}`;
            m[key] = { temp: w.temp, tempMin: w.tempMin, tempMax: w.tempMax, weather: w.weather, weatherMain: w.weatherMain, humidity: w.humidity, windSpeed: w.windSpeed };
        });
        // 2. Process dailyReports (Manual entry - overrides automated if exists)
        dailyReports.filter(r => r.type === 'store' && r.storeId && r.date).forEach(r => {
            const key = `${r.date}|${r.storeId}`;
            if (r.temperature !== undefined) {
                m[key] = { temp: r.temperature, tempMin: r.temperatureMin, tempMax: r.temperatureMax, weather: r.weather, weatherMain: r.weatherMain, humidity: r.humidity, windSpeed: r.windSpeed };
            }
        });
        return m;
    }, [dailyReports, dailyWeather]);

    // All product IDs that appear in filtered sales (for column headers)
    const usedProductIds = useMemo(() => {
        const ids = new Set<string>();
        filteredSales.forEach(s => s.items.forEach(item => ids.add(item.productId)));
        return [...ids].sort((a, b) => (productMap[a] ?? a).localeCompare(productMap[b] ?? b));
    }, [filteredSales, productMap]);

    const summary = useMemo(() => {
        const productStats: Record<string, number> = {};
        let totalAmt = 0;
        let totalQty = 0;
        let totalNet = 0;
        const entryDays = new Set<string>();

        filteredSales.forEach(sale => {
            totalAmt += sale.totalAmount;
            totalQty += sale.totalQuantity;
            totalNet += sale.totalNetProfit || 0;
            entryDays.add(sale.period);
            sale.items.forEach(item => {
                productStats[item.productId] = (productStats[item.productId] || 0) + item.quantity;
            });
        });

        const daysInPeriod = entryDays.size || 1;
        const avgDailySales = totalAmt / daysInPeriod;

        // Achievement rate if store selected
        let achievementRate = 0;
        let storeGoal = 0;
        if (filterStoreId) {
            const filterParts = filterStoreId.split(':');
            const targetId = filterParts.length === 2 ? filterParts[1] : filterStoreId;
            const store = retailStores.find(s => s.id === targetId);
            storeGoal = store?.dailySalesGoal || 0;
            if (storeGoal > 0) {
                // 分子は日毎の平均売上、分母は、日毎の売上目標
                achievementRate = (avgDailySales / storeGoal) * 100;
            }
        }

        // Convert to array and sort by quantity desc
        const sortedProductStats = Object.entries(productStats)
            .map(([id, qty]) => ({ id, name: productMap[id] || id, qty }))
            .sort((a, b) => b.qty - a.qty);

        return { totalAmt, totalQty, totalNet, sortedProductStats, avgDailySales, achievementRate, storeGoal, daysInPeriod };
    }, [filteredSales, productMap, logType, filterMonth, filterStoreId, retailStores]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            setSortConfig(null);
            return;
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
        return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />;
    };

    if (filteredSales.length === 0 && sales.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4" style={{ backgroundColor: BRAND_LIGHT }}>
                    <BarChart3 className="w-10 h-10" style={{ color: BRAND }} />
                </div>
                <h3 className="text-base font-bold text-slate-700 mb-2">実績データがありません</h3>
                <p className="text-sm text-slate-400 max-w-sm">「売上入力」タブからデータを登録してください。</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Filter bar */}
            <div className="flex flex-wrap gap-4 bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                    {(['daily', 'monthly'] as const).map(type => (
                        <button key={type} onClick={() => setLogType(type)}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${logType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {type === 'daily' ? '日次実績' : '月次実績'}
                        </button>
                    ))}
                </div>

                <div className="h-8 w-px bg-slate-200 self-center hidden sm:block" />

                <div className="flex items-center gap-2">
                    <StoreIcon className="w-4 h-4 text-slate-400" />
                    <select value={filterStoreId} onChange={e => setFilterStoreId(e.target.value)}
                        className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 font-medium text-slate-700">
                        <option value="">すべての宛先</option>
                        <optgroup label="登録店舗">
                            {retailStores.map(s => <option key={`store:${s.id}`} value={`store:${s.id}`}>{s.name}</option>)}
                        </optgroup>
                        {spotRecipients.length > 0 && (
                            <optgroup label="スポット宛先">
                                {spotRecipients.map(s => <option key={`spot:${s.id}`} value={`spot:${s.id}`}>{s.name}</option>)}
                            </optgroup>
                        )}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {logType === 'daily' ? (
                        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                            className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 font-medium text-slate-700" />
                    ) : (
                        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                            className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 font-medium text-slate-700">
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                <option key={y} value={y.toString()}>{y}年</option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="h-8 w-px bg-slate-200 self-center hidden sm:block" />

                <button
                    onClick={() => setIsTransposed(!isTransposed)}
                    className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all border ${isTransposed ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}
                    title="行列を入れ替えて表示"
                >
                    <ArrowUpDown className={`w-4 h-4 transition-transform ${isTransposed ? 'rotate-90' : ''}`} />
                    縦横切替
                </button>

                <div className="h-8 w-px bg-slate-200 self-center hidden sm:block" />

                {retailStores.find(s => `store:${s.id}` === filterStoreId)?.squareLocationId && (
                    <>
                        <button
                            onClick={handleSquareSync}
                            disabled={isSyncingSquare}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSquare ? "animate-spin" : ""}`} />
                            {isSyncingSquare ? "同期中..." : "Square同期"}
                        </button>
                        {!isSyncingSquare && (
                            <button
                                onClick={handleDiagnostics}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                                title="未連携商品の詳細をコンソールに出力します"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                連携診断
                            </button>
                        )}
                    </>
                )}



                <button
                    onClick={() => setShowTrash(!showTrash)}
                    className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all border ${showTrash ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}
                >
                    <Trash2 className="w-4 h-4" />
                    {showTrash ? "ゴミ箱を非表示" : "ゴミ箱を表示"}
                </button>

                <div className="ml-auto flex items-center text-xs text-slate-400 font-medium self-center">
                    {filteredSales.length}件 / {usedProductIds.length}商品
                </div>
            </div>

            {/* Summary Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">期間売上総額</div>
                    <div className="flex items-baseline justify-between mb-1">
                        <div className="text-2xl font-black" style={{ color: BRAND }}>
                            ¥{summary.totalAmt.toLocaleString()}
                        </div>
                        <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            入金: ¥{summary.totalNet.toLocaleString()}
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold border-t border-slate-50 pt-1.5 flex justify-between">
                        <span>平均売上（日）</span>
                        <span className="text-slate-600">¥{Math.round(summary.avgDailySales).toLocaleString()}</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">目標達成状況</div>
                    {summary.storeGoal > 0 ? (
                        <>
                            <div className="flex items-end justify-between mb-1.5">
                                <div className="text-2xl font-black text-slate-800">
                                    {Math.round(summary.achievementRate)}<small className="ml-1 text-xs text-slate-400">%</small>
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 pb-1">目標: ¥{summary.storeGoal.toLocaleString()}/日</div>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000"
                                    style={{
                                        width: `${Math.min(summary.achievementRate, 100)}%`,
                                        backgroundColor: summary.achievementRate >= 100 ? '#10b981' : BRAND
                                    }}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full pt-1 opacity-40">
                            <Target className="w-5 h-5 text-slate-300 mb-1" />
                            <span className="text-[10px] font-bold text-slate-400">目標未設定</span>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">期間販売合計</div>
                    <div className="text-2xl font-black text-slate-800">
                        {summary.totalQty.toLocaleString()}<small className="ml-1 text-xs text-slate-400">個</small>
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold border-t border-slate-50 pt-1.5 flex justify-between">
                        <span>日平均</span>
                        <span className="text-slate-600">{(summary.totalQty / summary.daysInPeriod).toFixed(1)}個</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">商品別売上</div>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {summary.sortedProductStats.map(stat => (
                            <div key={stat.id} className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[60px]">{stat.name}</span>
                                <span className="text-[11px] font-black text-blue-600">{stat.qty}</span>
                            </div>
                        ))}
                        {summary.sortedProductStats.length === 0 && <span className="text-[10px] text-slate-300">なし</span>}
                    </div>
                </div>
            </div>

            {filteredSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-200">
                    <Package className="w-10 h-10 text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400">選択した条件に一致するデータがありません</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        {!isTransposed ? (
                            <table className="w-full text-sm border-collapse min-w-[700px]">
                                <thead>
                                    {/* Row 1: date / store / weather + product group header */}
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th
                                            className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap w-28 cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={() => requestSort('period')}
                                        >
                                            <div className="flex items-center gap-2">
                                                {logType === 'daily' ? '日付' : '対象月'} {getSortIcon('period')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={() => requestSort('store')}
                                        >
                                            <div className="flex items-center gap-2">
                                                店舗 / 宛先 {getSortIcon('store')}
                                            </div>
                                        </th>
                                        {logType === 'daily' && <th className="px-4 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap w-40">天気</th>}
                                        {usedProductIds.map(pid => (
                                            <th key={pid} className="px-3 py-3 text-center text-xs font-bold text-slate-600 whitespace-nowrap min-w-[90px]">
                                                {productMap[pid] ?? pid.slice(0, 8)}
                                            </th>
                                        ))}
                                        <th
                                            className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={() => requestSort('totalQuantity')}
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                個数 {getSortIcon('totalQuantity')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={() => requestSort('totalAmount')}
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                売上額 {getSortIcon('totalAmount')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={() => requestSort('totalNetProfit')}
                                        >
                                            <div className="flex items-center justify-end gap-2 text-right">
                                                入金額 {getSortIcon('totalNetProfit')}
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap w-20">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedSales.map((sale, idx) => {
                                        const weatherKey = `${sale.period}|${sale.storeId}`;
                                        const mw = weatherMap[weatherKey];
                                        // Priority: 1. Sale record's weather fields, 2. Fallback to weatherMap
                                        const w = sale.temperature !== undefined 
                                            ? { 
                                                temp: sale.temperature, 
                                                tempMin: sale.temperatureMin ?? mw?.tempMin, 
                                                tempMax: sale.temperatureMax ?? mw?.tempMax, 
                                                weather: sale.weather ?? mw?.weather, 
                                                weatherMain: sale.weatherMain ?? mw?.weatherMain
                                              }
                                            : mw;
                                        const itemQtyMap: Record<string, number> = {};
                                        sale.items.forEach(it => { itemQtyMap[it.productId] = it.quantity; });

                                        const dateObj = new Date(sale.period);
                                        const dayOfWeek = dateObj.getDay();
                                        const holidayName = getHolidayName(sale.period);

                                        let bgClass = idx % 2 === 0 ? '' : 'bg-slate-50/30';
                                        if (dayOfWeek === 0 || !!holidayName) bgClass = 'bg-red-50/40';
                                        else if (dayOfWeek === 6) bgClass = 'bg-blue-50/40';

                                        const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
                                        const dayLabel = dayLabels[dayOfWeek];

                                        return (
                                            <tr 
                                                key={sale.id} 
                                                id={`sale-${sale.id}`}
                                                className={`border-b transition-all duration-500 ${
                                                    highlightId === sale.id 
                                                        ? "bg-blue-100/50 border-blue-200 ring-2 ring-blue-500/20" 
                                                        : `border-slate-100 hover:bg-slate-50/60 ${bgClass}`
                                                }`}
                                            >
                                                <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap text-xs">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{sale.period.replace(/-/g, "/")}</span>
                                                        <span className={`text-[9px] px-1 py-0.5 rounded ${dayOfWeek === 0 || !!holidayName ? "text-red-600 bg-red-100" : dayOfWeek === 6 ? "text-blue-600 bg-blue-100" : "text-slate-400 bg-slate-100"}`}>
                                                            {dayLabel}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-[11px] font-medium leading-tight">
                                                    {storeMap[sale.storeId] ?? sale.storeId}
                                                    {sale.recipientType === 'spot' && <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded">スポット</span>}
                                                    {(sale as any).isInvoice && <span className="ml-1 text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-black">請求書</span>}
                                                </td>
                                                {logType === 'daily' && (
                                                    <td className="px-4 py-3">
                                                        {w ? (
                                                            <div className="flex items-center gap-1.5 justify-center">
                                                                <WeatherIcon main={w.weatherMain} size={4} />
                                                                <div className="text-center">
                                                                    <div className="font-bold text-slate-800 text-[10px] leading-none">{w.temp}°C</div>
                                                                    {(w.tempMin !== undefined && w.tempMax !== undefined) && (
                                                                        <div className="flex items-center gap-0.5 mt-0.5 justify-center">
                                                                            <span className="text-[9px] font-bold text-red-500">{w.tempMax}°</span>
                                                                            <span className="text-[8px] text-slate-300">/</span>
                                                                            <span className="text-[9px] font-bold text-blue-500">{w.tempMin}°</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : <div className="text-center text-[9px] text-slate-300">なし</div>}
                                                    </td>
                                                )}
                                                {usedProductIds.map(pid => {
                                                    const qty = itemQtyMap[pid] ?? 0;
                                                    return (
                                                        <td key={pid} className="px-3 py-3 text-center">
                                                            {qty > 0 ? (
                                                                <span className="inline-flex items-center justify-center min-w-[1.8rem] px-1.5 py-0.5 rounded-lg font-black text-xs"
                                                                    style={{ backgroundColor: BRAND_LIGHT, color: BRAND }}>
                                                                    {qty}
                                                                </span>
                                                            ) : <span className="text-slate-100 text-[10px]">—</span>}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap text-xs">
                                                    {sale.totalQuantity}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-slate-700 whitespace-nowrap text-xs">
                                                    ¥{sale.totalAmount.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right font-black whitespace-nowrap text-xs" style={{ color: BRAND }}>
                                                    ¥{sale.totalNetProfit.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {showTrash ? (
                                                        <button onClick={() => restoreSale(sale.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><RotateCcw className="w-4 h-4" /></button>
                                                    ) : (sale as any).isInvoice ? (
                                                        <Link href={`/documents?id=${sale.id}`} className="p-1.5 text-blue-400 hover:bg-slate-50 rounded-lg inline-block" title="請求書詳細を表示">
                                                            <FileText className="w-4 h-4" />
                                                        </Link>
                                                    ) : (
                                                        <button onClick={() => onEdit(sale)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                                        <td colSpan={logType === 'daily' ? 3 : 2} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            商品別合計
                                        </td>
                                        {usedProductIds.map(pid => {
                                            const total = filteredSales.reduce((sum, s) => sum + (s.items.find(it => it.productId === pid)?.quantity ?? 0), 0);
                                            return (
                                                <td key={pid} className="px-3 py-3 text-center">
                                                    {total > 0 ? <span className="text-sm font-black text-slate-700">{total}</span> : <span className="text-slate-200 text-xs">—</span>}
                                                </td>
                                            );
                                        })}
                                        <td colSpan={4} className="bg-slate-50/20"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        ) : (
                            /* ──────── Transposed Table (Product Rows, Date Columns) ──────── */
                            <table className="w-full text-sm border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                                            商品名 / 日付
                                        </th>
                                        {sortedSales.map(sale => {
                                            const dateObj = new Date(sale.period);
                                            const dayOfWeek = dateObj.getDay();
                                            const holidayName = getHolidayName(sale.period);
                                            const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
                                            const dayLabel = dayLabels[dayOfWeek];
                                            const isSun = dayOfWeek === 0 || !!holidayName;
                                            const isSat = dayOfWeek === 6;

                                            const weatherKey = `${sale.period}|${sale.storeId}`;
                                            const mw = weatherMap[weatherKey];
                                            const w = sale.temperature !== undefined 
                                                ? { 
                                                    temp: sale.temperature, 
                                                    tempMin: sale.temperatureMin ?? mw?.tempMin, 
                                                    tempMax: sale.temperatureMax ?? mw?.tempMax, 
                                                    weather: sale.weather ?? mw?.weather, 
                                                    weatherMain: sale.weatherMain ?? mw?.weatherMain
                                                  }
                                                : mw;
                                            return (
                                                <th key={sale.id} className="px-3 py-3 text-center whitespace-nowrap min-w-[80px]">
                                                    <div className="text-[10px] font-bold text-slate-500 mb-0.5 leading-none">
                                                        {sale.period.split('-').slice(1).join('/')}
                                                    </div>
                                                    <div className={`text-[10px] inline-block px-1 rounded font-black ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-slate-400'}`}>
                                                        {dayLabel}
                                                    </div>
                                                    {logType === 'daily' && w && (
                                                        <div className="mt-1 flex flex-col items-center">
                                                            <div className="flex items-center gap-1 justify-center">
                                                                <WeatherIcon main={w.weatherMain} size={3} />
                                                                <span className="text-[9px] font-bold text-slate-700">{w.temp}°</span>
                                                            </div>
                                                            {(w.tempMin !== undefined && w.tempMax !== undefined) && (
                                                                <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                                                    <span className="text-[8px] font-bold text-red-500">{w.tempMax}°</span>
                                                                    <span className="text-[8px] text-slate-300">/</span>
                                                                    <span className="text-[8px] font-bold text-blue-500">{w.tempMin}°</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </th>
                                            );
                                        })}
                                        <th className="px-6 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50 border-l border-slate-200">
                                            合計個数
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usedProductIds.map((pid, idx) => {
                                        let rowQtyTotal = 0;
                                        return (
                                            <tr key={pid} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                                <td className="px-6 py-3 font-bold text-slate-700 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-slate-100">
                                                    <div className="text-[10px] text-slate-400 leading-tight mb-0.5">
                                                        {brands.find(b => b.id === products.find(p => p.id === pid)?.brandId)?.name || ""}
                                                    </div>
                                                    <div className="text-xs truncate max-w-[150px]">{productMap[pid] ?? pid}</div>
                                                </td>
                                                {sortedSales.map(sale => {
                                                    const qty = sale.items.find(it => it.productId === pid)?.quantity ?? 0;
                                                    rowQtyTotal += qty;
                                                    return (
                                                        <td key={`${sale.id}-${pid}`} className="px-3 py-3 text-center">
                                                            {qty > 0 ? (
                                                                <span className="inline-flex items-center justify-center min-w-[1.8rem] px-1.5 py-0.5 rounded-lg font-black text-xs"
                                                                    style={{ backgroundColor: BRAND_LIGHT, color: BRAND }}>
                                                                    {qty}
                                                                </span>
                                                            ) : <span className="text-slate-100 text-[10px]">—</span>}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-6 py-3 text-right bg-slate-50/30 border-l border-slate-100 font-black text-slate-800 text-sm">
                                                    {rowQtyTotal}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-200 bg-slate-100/50">
                                        <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                                            日毎売上合計 (個)
                                        </td>
                                        {sortedSales.map(sale => (
                                            <td key={`total-${sale.id}`} className="px-3 py-4 text-center font-black text-slate-700">
                                                {sale.totalQuantity}
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 text-right font-black text-blue-600 bg-blue-50/50 border-l border-slate-200">
                                            {filteredSales.reduce((s, r) => s + r.totalQuantity, 0)}
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-50/80">
                                        <td className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                                            日毎入金額 (¥)
                                        </td>
                                        {sortedSales.map(sale => (
                                            <td key={`net-${sale.id}`} className="px-3 py-3 text-center text-[10px] font-bold text-slate-500">
                                                ¥{sale.totalNetProfit.toLocaleString()}
                                            </td>
                                        ))}
                                        <td className="px-6 py-3 text-right font-black text-blue-700 bg-blue-100/30 border-l border-slate-200">
                                            ¥{filteredSales.reduce((s, r) => s + (r.totalNetProfit || 0), 0).toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

import { convertToCSV, downloadCSV } from "@/lib/csvUtils";

// ─── Page ─────────────────────────────────────────────────────────────────────
function SalesPageContent() {
    const searchParams = useSearchParams();
    const queryTab = searchParams.get('tab') as 'input' | 'log' | 'analysis' | null;
    const filterDate = searchParams.get('date');

    const [activeTab, setActiveTab] = useState<'input' | 'log' | 'analysis'>(queryTab || 'input');
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const { sales, unifiedSales, products, retailStores } = useStore();

    const handleExport = () => {
        // Build export rows from sales data
        const exportRows: any[] = [];

        unifiedSales.forEach(sale => {
            const store = retailStores.find(s => s.id === sale.storeId);
            sale.items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                exportRows.push({
                    ID: sale.id,
                    日付: sale.period,
                    区分: sale.type === 'daily' ? '日次' : '月次',
                    店舗名: store?.name || '不明',
                    商品ID: item.productId,
                    商品名: product?.name || '不明',
                    バリエーション: product?.variantName || '',
                    単価: item.priceAtSale,
                    数量: item.quantity,
                    小計: item.subtotal,
                    店舗手数料: item.commission,
                    純利益: item.netProfit
                });
            });
        });

        const csv = convertToCSV(exportRows);
        downloadCSV(csv, `sales_export_${new Date().toISOString().slice(0, 10)}.csv`);
    };

    useEffect(() => {
        if (queryTab) {
            setActiveTab(queryTab);
        }
        // Amazon同期をバックグラウンドで実行（未認証・デモモード時はスキップ）
        if (checkIsDemoMode()) return;
        apiFetch("/api/amazon/sync", { method: "POST" }).catch(() => {
            // バックグラウンド処理のためサイレント
        });
    }, [queryTab]);

    // Show success toast from input tab — handled inside SalesInputTab
    const tabs = [
        { id: 'input', label: '売上入力', icon: Save },
        { id: 'log', label: '実績ログ', icon: BarChart3 },
        { id: 'analysis', label: '販売分析', icon: Sparkles },
    ] as const;

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        {filterDate && (
                            <Link href="/sales" className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </Link>
                        )}
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            {filterDate ? `${filterDate.replace(/-/g, "/")} の売上実績` : "売上管理"}
                        </h1>
                    </div>
                    <p className="text-slate-500 text-sm">売上の入力と日別実績・天気の確認</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm font-medium"
                    >
                        <Save className="w-4 h-4 text-slate-400" />
                        実績CSV出力
                    </button>
                </div>
            </div>

            {/* Tab bar */}
            {!filterDate && (
                <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-6 w-fit">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Icon className="w-4 h-4" />
                                {tab.label}
                                {tab.id === 'log' && unifiedSales.filter(s => s.type === 'daily').length > 0 && (
                                    <span className="ml-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: BRAND }}>
                                        {unifiedSales.filter(s => s.type === 'daily').length}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Tab content */}
            {activeTab === 'input' && !filterDate && (
                <SalesInputTab
                    editingSale={editingSale}
                    onClearEdit={() => setEditingSale(null)}
                />
            )}
            {activeTab === 'log' && (
                <DailyLogTab
                    filterDate={filterDate || undefined}
                    onEdit={(sale) => {
                        setEditingSale(sale);
                        setActiveTab('input');
                    }}
                />
            )}
            {activeTab === 'analysis' && !filterDate && <SalesAnalysisTab />}
        </div>
    );
}

export default function SalesPage() {
    return (
        <Suspense fallback={<div className="p-8">読み込み中...</div>}>
            <SalesPageContent />
        </Suspense>
    );
}
