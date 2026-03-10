"use client";

/**
 * SpotRecipientInput — スポット（非登録）宛先入力コンポーネント
 *
 * - 過去のスポット宛先をサジェスト（名寄せ）
 * - 新規入力も可能
 * - 郵便番号 → 住所自動補完（useZipCode）
 * - onSelect(SpotRecipient) でフォームに返す
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, UserPlus, X, MapPin, Phone, Loader2, CheckCircle2, Building2, ExternalLink } from "lucide-react";
import { useStore, SpotRecipient } from "@/lib/store";

const BRAND = "#b27f79";
const BRAND_LIGHT = "#fdf5f5";

interface SpotRecipientInputProps {
    value?: SpotRecipient | null;
    onChange: (recipient: SpotRecipient | null) => void;
    className?: string;
}

// ─── Zip Code hook (inline, reuses the same API pattern as useZipCode) ─────
function useZipLookup() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lookup = useCallback(async (zip: string): Promise<string | null> => {
        const clean = zip.replace(/-/g, '');
        if (clean.length !== 7) return null;
        setLoading(true); setError(null);
        try {
            const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${clean}`);
            const data = await res.json();
            if (data.results?.[0]) {
                const r = data.results[0];
                return `${r.address1}${r.address2}${r.address3}`;
            }
            setError("住所が見つかりません");
            return null;
        } catch {
            setError("検索に失敗しました");
            return null;
        } finally { setLoading(false); }
    }, []);
    return { lookup, loading, error };
}

export function SpotRecipientInput({ value, onChange, className = "" }: SpotRecipientInputProps) {
    const { spotRecipients, addSpotRecipient, deleteSpotRecipient } = useStore();
    const [query, setQuery] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [mode, setMode] = useState<"search" | "new">("search");
    const [isSaving, setIsSaving] = useState(false);

    // New recipient form state
    const [form, setForm] = useState({ name: "", zipCode: "", address: "", tel: "", memo: "" });
    const { lookup: lookupZip, loading: zipLoading, error: zipError } = useZipLookup();

    const inputRef = useRef<HTMLInputElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);

    // Filtered suggestions with robust null checks
    const suggestions = (spotRecipients || [])
        .filter(r => {
            if (!r || !r.name || r.isTrashed) return false;
            if (!query) return true;
            const q = query.toLowerCase();
            const nameMatch = r.name?.toLowerCase().includes(q);
            const addressMatch = r.address?.toLowerCase().includes(q);
            return nameMatch || addressMatch;
        })
        .sort((a, b) => {
            const dateA = a.lastUsedAt ? (typeof a.lastUsedAt === 'string' ? new Date(a.lastUsedAt).getTime() : ((a.lastUsedAt as any).toDate ? (a.lastUsedAt as any).toDate().getTime() : 0)) : 0;
            const dateB = b.lastUsedAt ? (typeof b.lastUsedAt === 'string' ? new Date(b.lastUsedAt).getTime() : ((b.lastUsedAt as any).toDate ? (b.lastUsedAt as any).toDate().getTime() : 0)) : 0;
            return dateB - dateA;
        })
        .slice(0, 8);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!dropRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleSelect = (r: SpotRecipient) => {
        onChange(r);
        setShowDropdown(false);
        setQuery("");
    };

    const handleClear = () => {
        onChange(null);
        setQuery("");
        setMode("search");
    };

    const handleZipChange = async (zip: string) => {
        setForm(f => ({ ...f, zipCode: zip }));
        if (zip.replace(/-/g, '').length === 7) {
            const addr = await lookupZip(zip);
            if (addr) setForm(f => ({ ...f, address: addr }));
        }
    };

    const handleSaveNew = async () => {
        if (!form.name.trim()) return;
        setIsSaving(true);
        try {
            const recipient = await addSpotRecipient({
                name: form.name.trim(),
                zipCode: form.zipCode || undefined,
                address: form.address || undefined,
                tel: form.tel || undefined,
                memo: form.memo || undefined,
            });
            onChange(recipient);
            setMode("search");
            setForm({ name: "", zipCode: "", address: "", tel: "", memo: "" });
        } finally { setIsSaving(false); }
    };

    // ── If a recipient is selected, show summary card ─────────────────────────
    if (value) {
        return (
            <div className={`flex items-start gap-3 p-3 rounded-xl border-2 ${className}`} style={{ borderColor: BRAND, backgroundColor: BRAND_LIGHT }}>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900">{value.name}</div>
                    {value.address && <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{value.address}</div>}
                    {value.tel && <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" />{value.tel}</div>}
                    <div className="text-[10px] mt-1 font-bold" style={{ color: BRAND }}>スポット宛先</div>
                </div>
                <button onClick={handleClear} className="p-1 rounded-lg hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    // ── Search mode ────────────────────────────────────────────────────────────
    if (mode === "search") {
        return (
            <div className={`relative ${className}`}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        placeholder="宛先名を入力して検索…"
                        onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
                        onFocus={() => setShowDropdown(true)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 text-slate-900 text-sm transition-all"
                    />
                </div>

                {/* Dropdown */}
                {showDropdown && (
                    <div ref={dropRef} className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                        {suggestions.length > 0 && (
                            <div className="py-1">
                                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">過去のスポット宛先</div>
                                {suggestions.map(r => (
                                    <button key={r.id} onClick={() => handleSelect(r)}
                                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-2.5">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black" style={{ backgroundColor: BRAND_LIGHT, color: BRAND }}>
                                            {r.name[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-semibold text-slate-800 text-sm">{r.name}</div>
                                            {r.address && <div className="text-xs text-slate-400 truncate">{r.address}</div>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="border-t border-slate-100">
                            <button onClick={() => { setMode("new"); setForm(f => ({ ...f, name: query })); setShowDropdown(false); }}
                                className="w-full flex items-center gap-2 px-3 py-3 hover:bg-slate-50 transition-colors">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: BRAND_LIGHT }}>
                                    <UserPlus className="w-4 h-4" style={{ color: BRAND }} />
                                </div>
                                <span className="text-sm font-semibold text-slate-700">
                                    {query ? `「${query}」を新規スポット宛先として登録` : "新規スポット宛先を登録"}
                                </span>
                            </button>
                            <Link href="/spot-recipients"
                                className="w-full flex items-center justify-between px-3 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-t border-slate-100 group">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 border border-slate-200">
                                        <Building2 className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 group-hover:text-blue-600">
                                        スポット宛先を管理
                                    </span>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400" />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── New recipient form ─────────────────────────────────────────────────────
    return (
        <div className={`space-y-3 bg-slate-50 rounded-xl border border-slate-200 p-4 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" style={{ color: BRAND }} />
                    新規スポット宛先
                </div>
                <button onClick={() => setMode("search")} className="text-xs text-slate-400 hover:text-slate-600">← 戻る</button>
            </div>

            {/* Name */}
            <div>
                <label className="text-[11px] font-bold text-slate-500 mb-0.5 block">宛先名 <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                    placeholder="株式会社〇〇 / 〇〇様" />
            </div>

            {/* Zip / Address */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[11px] font-bold text-slate-500 mb-0.5 block">郵便番号</label>
                    <div className="relative">
                        <input type="text" value={form.zipCode} onChange={e => handleZipChange(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 pr-7"
                            placeholder="000-0000" maxLength={8} />
                        {zipLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
                    </div>
                    {zipError && <div className="text-[10px] text-red-500 mt-0.5">{zipError}</div>}
                </div>
                <div>
                    <label className="text-[11px] font-bold text-slate-500 mb-0.5 block">電話番号</label>
                    <input type="tel" value={form.tel} onChange={e => setForm(f => ({ ...f, tel: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                        placeholder="000-0000-0000" />
                </div>
            </div>
            <div>
                <label className="text-[11px] font-bold text-slate-500 mb-0.5 block">住所</label>
                <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                    placeholder="自動補完、または手入力" />
            </div>
            <div>
                <label className="text-[11px] font-bold text-slate-500 mb-0.5 block">メモ</label>
                <input type="text" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                    placeholder="社内メモ（任意）" />
            </div>

            <div className="flex gap-2 pt-1">
                <button onClick={() => setMode("search")} className="flex-1 py-2 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                    キャンセル
                </button>
                <button onClick={handleSaveNew}
                    disabled={!form?.name || !form.name.trim() || isSaving}
                    className="flex-1 py-2 text-sm text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                    style={{ backgroundColor: BRAND }}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {isSaving ? "保存中..." : "登録して選択"}
                </button>
            </div>
        </div>
    );
}
