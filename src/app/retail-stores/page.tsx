"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Edit2, Trash2, Search, Store, CloudSun, Cloud, CloudRain, CloudSnow, Thermometer, Wind, MapPin, ExternalLink, Phone, User, RefreshCw, Image as ImageIcon, ArrowUpDown, RotateCcw, X, Filter, ChevronDown, Check, Package } from "lucide-react";
import { useStore, RetailStore } from "@/lib/store";
import { RetailStoreModal } from "@/components/RetailStoreModal";
import { WeatherHistoryModal } from "@/components/WeatherHistoryModal";
import { StoreInventoryModal } from "@/components/StoreInventoryModal";
import { showNotification } from "@/lib/notifications";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";

// ─── Weather widget ───────────────────────────────────────────────────────────

type WeatherData = {
    weather: string;
    main: string;
    icon: string;
    temp: number;
    humidity: number;
    windSpeed: number;
};

type WeatherState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ok"; data: WeatherData }
    | { status: "no_coords" }
    | { status: "no_key" }
    | { status: "error" };

function weatherIcon(main: string) {
    if (main.includes("Rain") || main.includes("Drizzle")) return <CloudRain className="w-8 h-8 text-blue-400" />;
    if (main.includes("Snow")) return <CloudSnow className="w-8 h-8 text-sky-300" />;
    if (main.includes("Cloud")) return <Cloud className="w-8 h-8 text-slate-400" />;
    return <CloudSun className="w-8 h-8 text-amber-400" />;
}

function WeatherWidget({ store, refresh }: { store: RetailStore; refresh: number }) {
    const [state, setState] = useState<WeatherState>({ status: "idle" });

    useEffect(() => {
        if (!store.lat || !store.lng) {
            setState({ status: "no_coords" });
            return;
        }

        const controller = new AbortController();
        let isCurrent = true;

        const fetchData = async () => {
            setState({ status: "loading" });
            try {
                const res = await fetch(`/api/weather?lat=${store.lat}&lon=${store.lng}`, {
                    signal: controller.signal
                });

                if (!res.ok) throw new Error(`Weather API failed: ${res.status}`);
                const data = await res.json();

                if (!isCurrent) return;

                if (data.error === "OPENWEATHER_API_KEY not configured") {
                    setState({ status: "no_key" });
                } else if (data.error) {
                    setState({ status: "error" });
                } else {
                    setState({ status: "ok", data });
                }
            } catch (err: any) {
                // If it's an abort or the component unmounted, silence it completely
                if (err.name === 'AbortError' || controller.signal.aborted || !isCurrent) {
                    return;
                }
                console.error("WeatherWidget fetch error:", err);
                setState({ status: "error" });
            }
        };

        fetchData();

        return () => {
            isCurrent = false;
            // Only abort if the signal isn't already aborted
            if (!controller.signal.aborted) {
                controller.abort();
            }
        };
    }, [store.lat, store.lng, refresh]);

    if (state.status === "idle" || state.status === "loading") {
        return (
            <div className="flex items-center gap-2 text-slate-400 text-xs animate-pulse">
                <div className="w-6 h-6 rounded-full bg-slate-100" />
                <span>天気を取得中...</span>
            </div>
        );
    }

    if (state.status === "no_coords") {
        return (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>住所から位置情報を取得すると天気が表示されます</span>
            </div>
        );
    }

    if (state.status === "no_key") {
        return (
            <div className="flex items-center gap-1.5 text-xs text-amber-500">
                ⚙️ <span>.env.local に OPENWEATHER_API_KEY を設定すると天気が表示されます</span>
            </div>
        );
    }

    if (state.status === "error") {
        return <div className="text-xs text-red-400">天気の取得に失敗しました</div>;
    }

    const { data } = state;
    return (
        <div className="flex items-center gap-3">
            {weatherIcon(data.main)}
            <div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-slate-800">{data.temp}°C</span>
                    <span className="text-sm text-slate-500">{data.weather}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center gap-0.5">
                        <Thermometer className="w-3 h-3" /> 湿度 {data.humidity}%
                    </span>
                    <span className="flex items-center gap-0.5">
                        <Wind className="w-3 h-3" /> {data.windSpeed}m/s
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Store Card ────────────────────────────────────────────────────────────────
function StoreCard({
    store,
    refresh,
    onEdit,
    onDelete,
    onRestore,
    onPermanentDelete,
    onShowHistory,
    onShowInventory,
}: {
    store: RetailStore;
    refresh: number;
    onEdit: () => void;
    onDelete: () => void;
    onRestore: () => void;
    onPermanentDelete: () => void;
    onShowHistory: () => void;
    onShowInventory: () => void;
}) {
    const gmapsUrl = store.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`
        : null;

    const isDirect = store.type === 'C';

    return (
        <div className={`rounded-2xl border transition-all overflow-hidden group relative ${isDirect
            ? "bg-gradient-to-br from-blue-50/50 to-white border-blue-200 shadow-blue-100/50 shadow-md ring-1 ring-blue-100"
            : "bg-white border-slate-200 shadow-sm hover:shadow-md"
            }`}>
            {isDirect && (
                <div className="absolute top-0 right-0 p-3 z-10">
                    <div className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-bl-xl rounded-tr-lg shadow-sm flex items-center gap-1">
                        <Check className="w-3 h-3" /> 直営店
                    </div>
                </div>
            )}
            <div className="p-5">
                {/* Store Image */}
                <div className="mb-4 aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative group/img">
                    {store.imageUrls && store.imageUrls.length > 0 ? (
                        <img src={store.imageUrls[0]} alt={store.name} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                            <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                            <span className="text-[10px] font-medium tracking-wider uppercase">No Image</span>
                        </div>
                    )}
                </div>

                {/* Store name + actions */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: BRAND_LIGHT }}>
                            <Store className="w-4 h-4" style={{ color: BRAND }} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 truncate">{store.name}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${store.type === 'B' ? "bg-indigo-500 text-white" :
                                    store.type === 'C' ? "bg-blue-600 text-white" :
                                        "bg-emerald-500 text-white"
                                    }`}>
                                    {store.type === 'B' ? "卸 (B)" : store.type === 'C' ? "直営 (C)" : "委託 (A)"}
                                </span>
                                {(store.type === 'A' || store.type === 'B') && (
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: BRAND }}>
                                        手数料 {store.type === 'B' ? 0 : (store.commissionRate ?? 0)}%
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {store.isTrashed ? (
                            <div className="flex items-center gap-1">
                                <button onClick={onRestore} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="復元">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={onPermanentDelete} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="完全削除">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="編集">
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info rows */}
                <div className="space-y-1.5 mb-4 text-sm">
                    {store.address && (
                        <div className="flex items-start gap-2 text-slate-600">
                            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                            <span className="text-xs leading-relaxed">{store.address}</span>
                            {gmapsUrl && (
                                <a href={gmapsUrl} target="_blank" rel="noopener noreferrer"
                                    className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors" title="Google Maps で開く">
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    )}
                    {store.tel && (
                        <div className="flex items-center gap-2 text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <a href={`tel:${store.tel}`} className="text-xs hover:text-blue-600 transition-colors">{store.tel}</a>
                        </div>
                    )}
                    {store.pic && (
                        <div className="flex items-center gap-2 text-slate-600">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs">{store.pic}</span>
                        </div>
                    )}
                </div>

                {/* Weather divider */}
                <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                            <CloudSun className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">現在の天気</span>
                        </div>
                        <button onClick={onShowHistory} className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-700 transition-colors">
                            <RotateCcw className="w-3 h-3" />
                            履歴
                        </button>
                    </div>
                    <WeatherWidget store={store} refresh={refresh} />
                </div>

                {/* Inventory Access */}
                {store.type === 'A' && (
                    <div className="mt-4">
                        <button
                            onClick={onShowInventory}
                            className="w-full py-2.5 bg-slate-50 text-slate-700 font-black rounded-xl text-xs hover:bg-[#1e3a8a] hover:text-white transition-all border border-slate-100 flex items-center justify-center gap-2 group/inv"
                        >
                            <Package className="w-4 h-4 text-[#1e3a8a] group-hover/inv:text-white transition-colors" />
                            在庫・履歴を確認
                        </button>
                    </div>
                )}

                {/* Memo */}
                {store.memo && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400 line-clamp-2">{store.memo}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RetailStoresPage() {
    const { isLoaded, retailStores, deleteRetailStore, restoreRetailStore, permanentlyDeleteRetailStore } = useStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<RetailStore | null>(null);
    const [historyStore, setHistoryStore] = useState<RetailStore | null>(null);
    const [inventoryStore, setInventoryStore] = useState<RetailStore | null>(null);
    const [refresh, setRefresh] = useState(0);
    const [sortBy, setSortBy] = useState<'name' | 'type' | 'commission'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [showTrash, setShowTrash] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'A' | 'B' | 'C'>('all');

    const counts = useMemo(() => {
        const base = retailStores.filter(s => !!s.isTrashed === showTrash);
        return {
            all: base.length,
            A: base.filter(s => s.type === 'A').length,
            B: base.filter(s => s.type === 'B').length,
            C: base.filter(s => s.type === 'C').length,
        };
    }, [retailStores, showTrash]);

    const filtered = useMemo(() => {
        return retailStores
            .filter(s => !!s.isTrashed === showTrash)
            .filter(s => filterType === 'all' || s.type === filterType)
            .filter(s =>
                `${s.name} ${s.pic ?? ""} ${s.address ?? ""} ${s.tel ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase())
            );
    }, [retailStores, searchQuery, showTrash, filterType]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortBy) {
                case 'name':
                    aValue = a.name;
                    bValue = b.name;
                    break;
                case 'type':
                    aValue = a.type;
                    bValue = b.type;
                    break;
                case 'commission':
                    aValue = a.commissionRate ?? 0;
                    bValue = b.commissionRate ?? 0;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filtered, sortBy, sortOrder]);

    if (!isLoaded) return <div className="p-8 text-slate-500 animate-pulse">読み込み中...</div>;

    const handleEdit = (store: RetailStore) => { setEditingStore(store); setIsModalOpen(true); };
    const handleCreate = () => { setEditingStore(null); setIsModalOpen(true); };
    const handleDelete = (id: string) => {
        if (window.confirm("この店舗・事業者をゴミ箱に移動してもよろしいですか？")) {
            deleteRetailStore(id);
            showNotification("ゴミ箱に移動しました。");
        }
    };

    const handleRestore = (id: string) => {
        restoreRetailStore(id);
        showNotification("店舗・事業者を復元しました。");
    };

    const handlePermanentDelete = (id: string) => {
        if (window.confirm("この店舗・事業者を完全に削除しますか？この操作は取り消せません。")) {
            permanentlyDeleteRetailStore(id);
            showNotification("完全に削除しました。");
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: BRAND_LIGHT }}>
                        <Store className="w-6 h-6" style={{ color: BRAND }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">販売店舗・事業者管理</h1>
                        <p className="text-slate-500 text-sm mt-0.5">各店舗・事業者の情報と現在の天気をリアルタイムで確認できます</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTrash(!showTrash)}
                        className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl shadow-sm active:scale-95 transition-all text-sm border ${showTrash ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    >
                        <Trash2 className="w-4 h-4" />
                        {showTrash ? "戻る" : "ゴミ箱"}
                    </button>
                    <button
                        onClick={() => setRefresh(r => r + 1)}
                        className="p-2.5 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                        title="天気を更新"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2.5 text-white font-medium rounded-xl transition-colors shadow-sm"
                        style={{ backgroundColor: BRAND }}
                    >
                        <Plus className="w-4 h-4" />
                        店舗・事業者登録
                    </button>
                </div>
            </div>

            {/* Search, Filter & Sort */}
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="relative max-w-md flex-1 group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="店舗・事業者名・担当者名で検索..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all bg-white"
                            style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filterType === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                すべて <span className="ml-1 opacity-50">{counts.all}</span>
                            </button>
                            <button
                                onClick={() => setFilterType('A')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filterType === 'A' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                委託 <span className={`ml-1 ${filterType === 'A' ? 'text-emerald-100' : 'opacity-50'}`}>{counts.A}</span>
                            </button>
                            <button
                                onClick={() => setFilterType('B')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filterType === 'B' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                卸 <span className={`ml-1 ${filterType === 'B' ? 'text-indigo-100' : 'opacity-50'}`}>{counts.B}</span>
                            </button>
                            <button
                                onClick={() => setFilterType('C')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filterType === 'C' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                直営 <span className={`ml-1 ${filterType === 'C' ? 'text-blue-100' : 'opacity-50'}`}>{counts.C}</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-1 px-2 py-1 text-slate-400">
                                <ArrowUpDown className="w-3.5 h-3.5" />
                            </div>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as any)}
                                className="bg-transparent text-xs font-bold text-slate-600 pr-4 py-1.5 focus:outline-none border-none cursor-pointer"
                            >
                                <option value="name">店名順</option>
                                <option value="type">区分順</option>
                                <option value="commission">手数料順</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                                className={`p-1.5 rounded-lg transition-all ${sortOrder === 'desc' ? 'bg-slate-50 text-blue-600' : 'hover:bg-slate-50 text-slate-400'}`}
                                title={sortOrder === 'asc' ? '昇順' : '降順'}
                            >
                                <ArrowUpDown className={`w-3.5 h-3.5 transition-transform duration-300 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 mb-6">
                <div className="text-sm text-slate-500">
                    <span className="font-bold text-slate-900">{retailStores.length}</span> 店舗・事業者登録済み
                    {retailStores.filter(s => s.lat && s.lng).length > 0 && (
                        <span className="ml-3 text-xs text-slate-400">
                            📍 天気表示対応: {retailStores.filter(s => s.lat && s.lng).length}店舗
                        </span>
                    )}
                </div>
            </div>

            {/* Card Grid */}
            {sorted.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sorted.map(store => (
                        <StoreCard
                            key={store.id}
                            store={store}
                            refresh={refresh}
                            onEdit={() => handleEdit(store)}
                            onDelete={() => handleDelete(store.id)}
                            onRestore={() => handleRestore(store.id)}
                            onPermanentDelete={() => handlePermanentDelete(store.id)}
                            onShowHistory={() => setHistoryStore(store)}
                            onShowInventory={() => setInventoryStore(store)}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 rounded-2xl mb-4" style={{ backgroundColor: BRAND_LIGHT }}>
                        <Store className="w-10 h-10" style={{ color: BRAND }} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-1">
                        {searchQuery ? "検索結果がありません" : "店舗がまだ登録されていません"}
                    </h3>
                    <p className="text-sm text-slate-400 mb-5">
                        {searchQuery ? "検索ワードを変えてお試しください" : "「店舗登録」ボタンから最初の店舗を追加しましょう"}
                    </p>
                    {!searchQuery && (
                        <button onClick={handleCreate}
                            className="flex items-center gap-2 px-5 py-2.5 text-white font-medium rounded-xl"
                            style={{ backgroundColor: BRAND }}>
                            <Plus className="w-4 h-4" /> 最初の店舗・事業者を登録
                        </button>
                    )}
                </div>
            )}

            <RetailStoreModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingStore}
            />

            <WeatherHistoryModal
                isOpen={!!historyStore}
                onClose={() => setHistoryStore(null)}
                store={historyStore}
            />

            <StoreInventoryModal
                isOpen={!!inventoryStore}
                onClose={() => setInventoryStore(null)}
                store={inventoryStore}
            />
        </div>
    );
}
