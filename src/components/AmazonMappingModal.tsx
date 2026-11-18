"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    X,
    RefreshCw,
    Plus,
    Trash2,
    Save,
    Search,
    Link2,
    AlertCircle,
    CheckCircle2,
    Loader2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { apiFetch, checkIsDemoMode } from "@/lib/apiClient";
import { showNotification } from "@/lib/notifications";

interface AmazonMappingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface MappingComponentDraft {
    id: string;
    productId: string;
    quantityInput: string;
}

interface MappingRowDraft {
    sku: string;
    asin: string;
    amazonTitle: string;
    status: string[];
    enabled: boolean;
    components: MappingComponentDraft[];
    isCustomSku?: boolean;
}

const createComponentDraft = (productId = "", quantity = 1): MappingComponentDraft => ({
    id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId,
    quantityInput: String(quantity),
});

export function AmazonMappingModal({ isOpen, onClose }: AmazonMappingModalProps) {
    const { products } = useStore();

    const [rows, setRows] = useState<MappingRowDraft[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [listingsError, setListingsError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [onlyUnmapped, setOnlyUnmapped] = useState(false);
    const [newCustomSku, setNewCustomSku] = useState("");

    const activeProducts = useMemo(
        () => products.filter((p) => !p.isTrashed),
        [products]
    );

    interface ApiMappingItem {
        sku: string;
        asin?: string;
        amazonTitle?: string;
        enabled?: boolean;
        components?: { productId: string; quantity: number }[];
    }

    interface ApiListingItem {
        sku: string;
        asin?: string;
        itemName?: string;
        status?: string[];
    }

    const fetchAndBuildRows = useCallback(async (fetchListings: boolean) => {
        const res = await apiFetch(
            `/api/amazon/mappings${fetchListings ? "?fetchListings=1" : ""}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || "データの取得に失敗しました");
        }

        const savedMap = new Map<string, ApiMappingItem>();
        for (const m of (data.mappings || []) as ApiMappingItem[]) {
            if (m.sku) savedMap.set(m.sku, m);
        }

        const listingMap = new Map<string, ApiListingItem>();
        for (const l of (data.listings || []) as ApiListingItem[]) {
            if (l.sku) listingMap.set(l.sku, l);
        }

        const mergedSkus = new Set<string>([
            ...Array.from(listingMap.keys()),
            ...Array.from(savedMap.keys()),
        ]);

        const nextRows: MappingRowDraft[] = Array.from(mergedSkus).map((sku) => {
            const listing = listingMap.get(sku);
            const saved = savedMap.get(sku);

            const components: MappingComponentDraft[] =
                saved?.components && saved.components.length > 0
                    ? saved.components.map((c) =>
                        createComponentDraft(c.productId, c.quantity || 1)
                    )
                    : [];

            return {
                sku,
                asin: listing?.asin || saved?.asin || "",
                amazonTitle: listing?.itemName || saved?.amazonTitle || "",
                status: Array.isArray(listing?.status) ? listing.status : [],
                enabled: saved ? saved.enabled !== false : true,
                components,
                isCustomSku: !listing,
            };
        });

        nextRows.sort((a, b) => {
            const aBuyable = a.status.includes("BUYABLE") ? 0 : 1;
            const bBuyable = b.status.includes("BUYABLE") ? 0 : 1;
            if (aBuyable !== bBuyable) return aBuyable - bBuyable;
            return a.sku.localeCompare(b.sku);
        });

        return {
            nextRows,
            listingsError: data.listingsError ? String(data.listingsError) : null,
        };
    }, []);

    const handleReload = async () => {
        setIsLoading(true);
        setListingsError(null);
        try {
            const result = await fetchAndBuildRows(true);
            setRows(result.nextRows);
            setListingsError(result.listingsError);
        } catch (err: unknown) {
            if (checkIsDemoMode()) {
                setListingsError("デモモードではAmazon API連携をご利用いただけません。");
            } else {
                setListingsError(err instanceof Error ? err.message : "読み込みに失敗しました");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        fetchAndBuildRows(true)
            .then((result) => {
                if (cancelled) return;
                setRows(result.nextRows);
                setListingsError(result.listingsError);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                if (checkIsDemoMode()) {
                    setListingsError("デモモードではAmazon API連携をご利用いただけません。");
                } else {
                    setListingsError(err instanceof Error ? err.message : "読み込みに失敗しました");
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, fetchAndBuildRows]);

    const filteredRows = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return rows.filter((row) => {
            const isMapped = row.components.some((c) => c.productId !== "");
            if (onlyUnmapped && isMapped) return false;
            if (!q) return true;
            return (
                row.sku.toLowerCase().includes(q) ||
                row.asin.toLowerCase().includes(q) ||
                row.amazonTitle.toLowerCase().includes(q)
            );
        });
    }, [rows, searchQuery, onlyUnmapped]);

    const mappedCount = useMemo(
        () => rows.filter((r) => r.components.some((c) => c.productId !== "")).length,
        [rows]
    );

    const handleAddComponent = (sku: string) => {
        setRows((prev) =>
            prev.map((row) =>
                row.sku === sku
                    ? { ...row, components: [...row.components, createComponentDraft()] }
                    : row
            )
        );
    };

    const handleRemoveComponent = (sku: string, compId: string) => {
        setRows((prev) =>
            prev.map((row) =>
                row.sku === sku
                    ? {
                        ...row,
                        components: row.components.filter((c) => c.id !== compId),
                    }
                    : row
            )
        );
    };

    const handleChangeComponentProduct = (sku: string, compId: string, productId: string) => {
        setRows((prev) =>
            prev.map((row) =>
                row.sku === sku
                    ? {
                        ...row,
                        components: row.components.map((c) =>
                            c.id === compId ? { ...c, productId } : c
                        ),
                    }
                    : row
            )
        );
    };

    const handleChangeComponentQty = (sku: string, compId: string, rawValue: string) => {
        const normalized = rawValue
            .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
            .replace(/\D/g, "")
            .replace(/^0+(?=\d)/, "");

        setRows((prev) =>
            prev.map((row) =>
                row.sku === sku
                    ? {
                        ...row,
                        components: row.components.map((c) =>
                            c.id === compId ? { ...c, quantityInput: normalized } : c
                        ),
                    }
                    : row
            )
        );
    };

    const handleBlurComponentQty = (sku: string, compId: string) => {
        setRows((prev) =>
            prev.map((row) =>
                row.sku === sku
                    ? {
                        ...row,
                        components: row.components.map((c) => {
                            if (c.id !== compId) return c;
                            const parsed = parseInt(c.quantityInput, 10);
                            return {
                                ...c,
                                quantityInput: !parsed || parsed < 1 ? "1" : String(parsed),
                            };
                        }),
                    }
                    : row
            )
        );
    };

    const handleToggleEnabled = (sku: string) => {
        setRows((prev) =>
            prev.map((row) => (row.sku === sku ? { ...row, enabled: !row.enabled } : row))
        );
    };

    const handleAddCustomSku = () => {
        const sku = newCustomSku.trim();
        if (!sku) return;
        if (rows.some((r) => r.sku === sku)) {
            showNotification("同じSKUがすでに一覧に存在します。", "error");
            return;
        }
        setRows((prev) => [
            {
                sku,
                asin: "",
                amazonTitle: "",
                status: [],
                enabled: true,
                components: [createComponentDraft()],
                isCustomSku: true,
            },
            ...prev,
        ]);
        setNewCustomSku("");
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = rows
                .map((row) => ({
                    sku: row.sku,
                    asin: row.asin,
                    amazonTitle: row.amazonTitle,
                    enabled: row.enabled,
                    components: row.components
                        .filter((c) => c.productId.trim() !== "")
                        .map((c) => ({
                            productId: c.productId,
                            quantity: Math.max(1, parseInt(c.quantityInput, 10) || 1),
                        })),
                }))
                .filter((row) => row.components.length > 0);

            const res = await apiFetch("/api/amazon/mappings", {
                method: "POST",
                body: JSON.stringify({ mappings: payload }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "保存に失敗しました");
            }
            showNotification(`Amazon SKUマッピングを保存しました（${payload.length}件）。`);
            onClose();
        } catch (err: unknown) {
            showNotification(err instanceof Error ? err.message : "保存に失敗しました。", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[92vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                            <Link2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                                Amazon SKU 紐づけ設定（セット販売・複数SKU対応）
                            </h2>
                            <p className="text-xs text-slate-500">
                                Amazonの出品SKUごとに、システム内の「どの商品を何個」販売・在庫減算するかを紐づけます。
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                        aria-label="閉じる"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="SKU・ASIN・Amazon商品名で検索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none whitespace-nowrap">
                            <input
                                type="checkbox"
                                checked={onlyUnmapped}
                                onChange={(e) => setOnlyUnmapped(e.target.checked)}
                                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            />
                            未紐づけのみ
                        </label>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                placeholder="手動でSKU追加..."
                                value={newCustomSku}
                                onChange={(e) => setNewCustomSku(e.target.value)}
                                className="w-36 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                            />
                            <button
                                type="button"
                                onClick={handleAddCustomSku}
                                className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700"
                            >
                                追加
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => void handleReload()}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                            Amazon出品一覧を再取得
                        </button>
                    </div>
                </div>

                {/* Error Alert */}
                {listingsError && (
                    <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 shrink-0">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{listingsError}</span>
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {isLoading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                            <p className="text-sm font-medium">Amazon出品情報とマッピング設定を読み込み中...</p>
                        </div>
                    ) : filteredRows.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm">
                            該当するSKUがありません。
                        </div>
                    ) : (
                        filteredRows.map((row) => {
                            const isMapped = row.components.some((c) => c.productId !== "");
                            const isBuyable = row.status.includes("BUYABLE");

                            return (
                                <div
                                    key={row.sku}
                                    className={`p-4 rounded-xl border transition-all ${
                                        isMapped
                                            ? "border-emerald-200 bg-emerald-50/20"
                                            : "border-slate-200 bg-white"
                                    }`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        {/* Left: Amazon Listing Info */}
                                        <div className="md:w-[42%] space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-xs font-mono font-bold">
                                                    {row.sku}
                                                </span>
                                                {row.asin && (
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-mono">
                                                        {row.asin}
                                                    </span>
                                                )}
                                                {row.status.length > 0 && (
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            isBuyable
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : "bg-slate-100 text-slate-500"
                                                        }`}
                                                    >
                                                        {isBuyable ? "出品中" : "停止/在庫0"}
                                                    </span>
                                                )}
                                                {isMapped ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        紐づけ済
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] font-bold text-amber-600">
                                                        未紐づけ
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                                {row.amazonTitle || "（Amazon商品名未取得）"}
                                            </p>
                                            {isMapped && (
                                                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer pt-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={row.enabled}
                                                        onChange={() => handleToggleEnabled(row.sku)}
                                                        className="rounded border-slate-300 text-emerald-600"
                                                    />
                                                    売上取り込み時にこの紐づけを有効にする
                                                </label>
                                            )}
                                        </div>

                                        {/* Right: System Products & Quantities */}
                                        <div className="flex-1 space-y-2">
                                            {row.components.map((comp) => (
                                                <div
                                                    key={comp.id}
                                                    className="flex items-center gap-2"
                                                >
                                                    <select
                                                        value={comp.productId}
                                                        onChange={(e) =>
                                                            handleChangeComponentProduct(
                                                                row.sku,
                                                                comp.id,
                                                                e.target.value
                                                            )
                                                        }
                                                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                                    >
                                                        <option value="">-- システム商品を選択 --</option>
                                                        {activeProducts.map((p) => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.name}
                                                                {p.variantName ? ` (${p.variantName})` : ""}
                                                                {` [在庫:${p.stock}]`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className="text-xs text-slate-400 font-bold">×</span>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={comp.quantityInput}
                                                            onFocus={(e) => e.currentTarget.select()}
                                                            onChange={(e) =>
                                                                handleChangeComponentQty(
                                                                    row.sku,
                                                                    comp.id,
                                                                    e.target.value
                                                                )
                                                            }
                                                            onBlur={() =>
                                                                handleBlurComponentQty(row.sku, comp.id)
                                                            }
                                                            className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-right"
                                                            title="1注文あたりの減算個数"
                                                        />
                                                        <span className="text-xs text-slate-500">個</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleRemoveComponent(row.sku, comp.id)
                                                        }
                                                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                                        title="削除"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}

                                            <button
                                                type="button"
                                                onClick={() => handleAddComponent(row.sku)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                                {row.components.length === 0
                                                    ? "システム商品を紐づける"
                                                    : "構成商品を追加（セット販売用）"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4 shrink-0">
                    <div className="text-xs text-slate-500">
                        全 <span className="font-bold text-slate-800">{rows.length}</span> SKU中{" "}
                        <span className="font-bold text-emerald-700">{mappedCount}</span> 件紐づけ設定済み
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {isSaving ? "保存中..." : "マッピングを保存"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
