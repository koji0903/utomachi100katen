"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Search, Store, CloudSun, Cloud, CloudRain, CloudSnow, Thermometer, Wind, MapPin, ExternalLink, Phone, User, RefreshCw } from "lucide-react";
import { useStore, RetailStore } from "@/lib/store";
import { RetailStoreModal } from "@/components/RetailStoreModal";
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
        setState({ status: "loading" });
        fetch(`/api/weather?lat=${store.lat}&lon=${store.lng}`)
            .then(r => r.json())
            .then(data => {
                if (data.error === "OPENWEATHER_API_KEY not configured") {
                    setState({ status: "no_key" });
                } else if (data.error) {
                    setState({ status: "error" });
                } else {
                    setState({ status: "ok", data });
                }
            })
            .catch(() => setState({ status: "error" }));
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
}: {
    store: RetailStore;
    refresh: number;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const gmapsUrl = store.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`
        : null;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
            {/* Card header stripe */}
            <div className="h-1.5" style={{ backgroundColor: BRAND }} />

            <div className="p-5">
                {/* Store name + actions */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: BRAND_LIGHT }}>
                            <Store className="w-4 h-4" style={{ color: BRAND }} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 truncate">{store.name}</h3>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: BRAND }}>
                                手数料 {store.commissionRate ?? 0}%
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="編集">
                            <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
                    <div className="flex items-center gap-1.5 mb-2">
                        <CloudSun className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">現在の天気</span>
                    </div>
                    <WeatherWidget store={store} refresh={refresh} />
                </div>

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
    const { isLoaded, retailStores, deleteRetailStore } = useStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<RetailStore | null>(null);
    const [refresh, setRefresh] = useState(0);

    if (!isLoaded) return <div className="p-8 text-slate-500 animate-pulse">読み込み中...</div>;

    const filtered = retailStores.filter(s =>
        `${s.name} ${s.pic ?? ""} ${s.address ?? ""} ${s.tel ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleEdit = (store: RetailStore) => { setEditingStore(store); setIsModalOpen(true); };
    const handleCreate = () => { setEditingStore(null); setIsModalOpen(true); };
    const handleDelete = (id: string) => {
        if (window.confirm("この店舗を削除してもよろしいですか？")) {
            deleteRetailStore(id);
            showNotification("店舗を削除しました。");
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
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">販売店舗管理</h1>
                        <p className="text-slate-500 text-sm mt-0.5">各店舗の情報と現在の天気をリアルタイムで確認できます</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
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
                        店舗登録
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md mb-6">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                    type="text"
                    placeholder="店舗名・担当者名で検索..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all bg-white"
                    style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                />
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 mb-6">
                <div className="text-sm text-slate-500">
                    <span className="font-bold text-slate-900">{retailStores.length}</span> 店舗登録済み
                    {retailStores.filter(s => s.lat && s.lng).length > 0 && (
                        <span className="ml-3 text-xs text-slate-400">
                            📍 天気表示対応: {retailStores.filter(s => s.lat && s.lng).length}店舗
                        </span>
                    )}
                </div>
            </div>

            {/* Card Grid */}
            {filtered.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(store => (
                        <StoreCard
                            key={store.id}
                            store={store}
                            refresh={refresh}
                            onEdit={() => handleEdit(store)}
                            onDelete={() => handleDelete(store.id)}
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
                            <Plus className="w-4 h-4" /> 最初の店舗を登録
                        </button>
                    )}
                </div>
            )}

            <RetailStoreModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingStore}
            />
        </div>
    );
}
