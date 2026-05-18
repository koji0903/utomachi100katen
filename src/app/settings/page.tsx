"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useStore, CompanySettings, DEFAULT_COMPANY_SETTINGS, FixedCostItem } from "@/lib/store";
import { useZipCode } from "@/lib/useZipCode";
import { ExpenseCategory, PaymentMethod } from "@/lib/types/expense";
import {
    Building2, Phone, MapPin, Hash, Calculator,
    Save, CheckCircle2, ChevronDown, Info, FileText, Loader2, CheckCircle, AlertCircle,
    CloudSun, Mail, ChevronRight, Plus, Trash2
} from "lucide-react";
import { SettingsImageUpload } from "@/components/SettingsImageUpload";
import { uploadImageWithCompression } from "@/lib/imageUpload";
import { showNotification } from "@/lib/notifications";

const ROUNDING_OPTIONS = [
    { value: "floor", label: "切り捨て", desc: "例: 消費税 123.7円 → 123円" },
    { value: "round", label: "四捨五入", desc: "例: 消費税 123.5円 → 124円" },
    { value: "ceil", label: "切り上げ", desc: "例: 消費税 123.1円 → 124円" },
] as const;

export default function SettingsPage() {
    const { companySettings, saveCompanySettings } = useStore();
    const { zipStatus, lookupZip } = useZipCode();

    const [form, setForm] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [sealFile, setSealFile] = useState<File | null>(null);
    const [sealPreview, setSealPreview] = useState<string | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Populate form when data loads
    useEffect(() => {
        if (companySettings) {
            setForm({
                ...DEFAULT_COMPANY_SETTINGS,
                ...companySettings
            });
            setLogoPreview(companySettings.logoUrl || null);
            setSealPreview(companySettings.sealUrl || null);
        }
    }, [companySettings]);

    const handleChange = (field: keyof CompanySettings, value: string) => {
        setSaved(false);
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleZipChange = (raw: string) => {
        const digits = raw.replace(/\D/g, "").slice(0, 7);
        const formatted = digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
        setSaved(false);
        setForm(prev => ({ ...prev, zipCode: formatted }));
        lookupZip(digits, ({ full }) => {
            setForm(prev => ({ ...prev, address: full }));
        });
    };

    const handleLogoSelect = (file: File | null) => {
        setSaved(false);
        setLogoFile(file);
        if (file) {
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSealSelect = (file: File | null) => {
        setSaved(false);
        setSealFile(file);
        if (file) {
            setSealPreview(URL.createObjectURL(file));
        }
    };

    const handleClearLogo = () => {
        setSaved(false);
        setLogoFile(null);
        setLogoPreview(null);
        setForm(prev => ({ ...prev, logoUrl: "" }));
    };

    const handleClearSeal = () => {
        setSaved(false);
        setSealFile(null);
        setSealPreview(null);
        setForm(prev => ({ ...prev, sealUrl: "" }));
    };

    const handleTemplateToggle = (id: string) => {
        setSaved(false);
        const updated = (form.fixedCostTemplates || []).map(item =>
            item.id === id ? { ...item, enabled: !item.enabled } : item
        );
        setForm(prev => ({ ...prev, fixedCostTemplates: updated }));
    };

    const handleTemplateFieldChange = (id: string, field: keyof FixedCostItem, value: any) => {
        setSaved(false);
        const updated = (form.fixedCostTemplates || []).map(item =>
            item.id === id ? { ...item, [field]: value } : item
        );
        setForm(prev => ({ ...prev, fixedCostTemplates: updated }));
    };

    const handleAddTemplateRow = () => {
        setSaved(false);
        const newId = `template_${Date.now()}`;
        const newItem: FixedCostItem = {
            id: newId,
            enabled: true,
            category: "その他",
            item: "新規固定費項目",
            amount: 10000,
            paymentMethod: "銀行振込",
            vendor: "支払先名"
        };
        setForm(prev => ({
            ...prev,
            fixedCostTemplates: [...(prev.fixedCostTemplates || []), newItem]
        }));
    };

    const handleRemoveTemplateRow = (id: string) => {
        setSaved(false);
        const updated = (form.fixedCostTemplates || []).filter(item => item.id !== id);
        setForm(prev => ({ ...prev, fixedCostTemplates: updated }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let updatedSettings = { ...form };

            // Upload logo if changed
            if (logoFile) {
                const url = await uploadImageWithCompression(logoFile, "settings");
                updatedSettings.logoUrl = url;
            }

            // Upload seal if changed
            if (sealFile) {
                const url = await uploadImageWithCompression(sealFile, "settings");
                updatedSettings.sealUrl = url;
            }

            await saveCompanySettings(updatedSettings);
            setSaved(true);
            showNotification("設定を保存しました。");
            setLogoFile(null);
            setSealFile(null);
            setTimeout(() => setSaved(false), 3000);
        } catch (error: any) {
            console.error("Failed to save settings:", error);
            showNotification("保存に失敗しました。\n詳細: " + (error.message || "不明なエラー"), "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
                    <Building2 className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">基本設定</h1>
                    <p className="text-slate-500 mt-0.5 text-sm">自社情報とインボイス番号・税計算ルールを設定します。</p>
                </div>
            </div>

            <div className="space-y-6">

                {/* ── 1. 自社情報 ─────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <h2 className="font-semibold text-slate-800 text-sm">自社情報</h2>
                        <span className="ml-auto text-[10px] text-slate-400">帳票に印刷されます</span>
                    </div>
                    <div className="p-6 space-y-5">
                        {/* 会社名 */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                会社名 / 屋号 <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.companyName}
                                onChange={e => handleChange("companyName", e.target.value)}
                                placeholder="例: 合同会社ウトマチ百貨店"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                            />
                        </div>

                        {/* 郵便番号 + 住所 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    <MapPin className="w-3 h-3 inline mr-1" />郵便番号
                                    <span className="ml-1 text-[10px] font-normal text-slate-400">入力すると住所を自動補完</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={form.zipCode}
                                        onChange={e => handleZipChange(e.target.value)}
                                        placeholder="860-0001"
                                        maxLength={8}
                                        inputMode="numeric"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors pr-9"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {zipStatus === "loading" && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                                        {zipStatus === "ok" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                        {zipStatus === "notfound" && <AlertCircle className="w-4 h-4 text-amber-400" />}
                                    </div>
                                </div>
                                {zipStatus === "notfound" && <p className="text-[11px] text-amber-500 mt-1">郵便番号が見つかりませんでした</p>}
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">住所</label>
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={e => handleChange("address", e.target.value)}
                                    placeholder="郵便番号を入力すると自動補完されます"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                                />
                            </div>
                        </div>

                        {/* 電話番号 + FAX */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    <Phone className="w-3 h-3 inline mr-1" />電話番号
                                </label>
                                <input
                                    type="tel"
                                    value={form.tel}
                                    onChange={e => handleChange("tel", e.target.value)}
                                    placeholder="0964-00-0000"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    FAX番号
                                </label>
                                <input
                                    type="tel"
                                    value={form.fax}
                                    onChange={e => handleChange("fax", e.target.value)}
                                    placeholder="0964-00-0000"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                                />
                            </div>
                        </div>

                        {/* 担当者情報 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 text-blue-600">
                                    担当者 肩書
                                </label>
                                <input
                                    type="text"
                                    value={form.picTitle}
                                    onChange={e => handleChange("picTitle", e.target.value)}
                                    placeholder="例: 代表社員 / 店長"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 text-blue-600">
                                    担当者名
                                </label>
                                <input
                                    type="text"
                                    value={form.picName}
                                    onChange={e => handleChange("picName", e.target.value)}
                                    placeholder="例: 山田 太郎"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── 2. インボイス登録番号 ────────────────────────── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-amber-50/60">
                        <Hash className="w-4 h-4 text-amber-600" />
                        <h2 className="font-semibold text-slate-800 text-sm">インボイス登録番号</h2>
                        <span className="ml-auto text-[10px] text-amber-600 font-medium">適格請求書発行事業者</span>
                    </div>
                    <div className="p-6">
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            登録番号（T-）
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm select-none">T-</span>
                            <input
                                type="text"
                                value={form.invoiceNumber.replace(/^T-?/, "")}
                                onChange={e => handleChange("invoiceNumber", `T-${e.target.value.replace(/^T-?/, "")}`)}
                                placeholder="1234567890123"
                                maxLength={13}
                                pattern="[0-9]*"
                                inputMode="numeric"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-colors font-mono"
                            />
                        </div>
                        <div className="flex items-start gap-1.5 mt-2 text-[11px] text-slate-400">
                            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>国税庁に登録された13桁の番号を入力してください。帳票の右上に「登録番号 T-XXXXXXXXXXXXX」として印刷されます。</span>
                        </div>
                    </div>
                </div>

                {/* ── 3. 会計ルール（端数処理） ───────────────────── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <Calculator className="w-4 h-4 text-slate-500" />
                        <h2 className="font-semibold text-slate-800 text-sm">消費税の端数処理ルール</h2>
                    </div>
                    <div className="p-6">
                        <p className="text-xs text-slate-500 mb-4">消費税額を計算する際の1円未満の端数処理方法を選択してください。インボイス制度では取引ごとまたは請求書単位での切り捨てが一般的です。</p>
                        <div className="space-y-3">
                            {ROUNDING_OPTIONS.map(opt => (
                                <label
                                    key={opt.value}
                                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${form.roundingMode === opt.value
                                        ? "border-blue-400 bg-blue-50 shadow-sm"
                                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="roundingMode"
                                        value={opt.value}
                                        checked={form.roundingMode === opt.value}
                                        onChange={() => handleChange("roundingMode", opt.value)}
                                        className="mt-0.5 accent-blue-600"
                                    />
                                    <div>
                                        <div className="text-sm font-semibold text-slate-800">{opt.label}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── 4. 振込先口座 ────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100" style={{ backgroundColor: "#fdf5f5" }}>
                        <span className="text-sm" style={{ color: "#b27f79" }}>🏦</span>
                        <h2 className="font-semibold text-slate-800 text-sm">振込先口座</h2>
                        <span className="ml-auto text-[10px] text-slate-400">支払明細書に印刷されます</span>
                    </div>
                    <div className="p-6 space-y-8 divide-y divide-slate-100">
                        {/* 第1口座 */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded w-fit">第1口座</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">銀行名</label>
                                    <input type="text" value={form.bankName ?? ""} onChange={e => handleChange("bankName", e.target.value)}
                                        placeholder="例: 肥後銀行" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">支店名</label>
                                    <input type="text" value={form.bankBranch ?? ""} onChange={e => handleChange("bankBranch", e.target.value)}
                                        placeholder="例: 宇土支店" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">口座種別</label>
                                    <select value={form.bankAccountType ?? "普通"} onChange={e => handleChange("bankAccountType", e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors bg-white">
                                        <option value="普通">普通</option>
                                        <option value="当座">当座</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">口座番号</label>
                                    <input type="text" value={form.bankAccountNumber ?? ""} onChange={e => handleChange("bankAccountNumber", e.target.value)}
                                        placeholder="1234567" inputMode="numeric" maxLength={10}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">口座名義</label>
                                    <input type="text" value={form.bankAccountHolder ?? ""} onChange={e => handleChange("bankAccountHolder", e.target.value)}
                                        placeholder="ウトマチヒャッカテン" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors" />
                                </div>
                            </div>
                        </div>

                        {/* 第2口座 */}
                        <div className="pt-8 space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded w-fit">第2口座（任意）</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">銀行名</label>
                                    <input type="text" value={form.bankName2 ?? ""} onChange={e => handleChange("bankName2", e.target.value)}
                                        placeholder="例: 楽天銀行" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">支店名</label>
                                    <input type="text" value={form.bankBranch2 ?? ""} onChange={e => handleChange("bankBranch2", e.target.value)}
                                        placeholder="例: 第一営業支店" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">口座種別</label>
                                    <select value={form.bankAccountType2 ?? "普通"} onChange={e => handleChange("bankAccountType2", e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors bg-white">
                                        <option value="普通">普通</option>
                                        <option value="当座">当座</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">口座番号</label>
                                    <input type="text" value={form.bankAccountNumber2 ?? ""} onChange={e => handleChange("bankAccountNumber2", e.target.value)}
                                        placeholder="1234567" inputMode="numeric" maxLength={10}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">口座名義</label>
                                    <input type="text" value={form.bankAccountHolder2 ?? ""} onChange={e => handleChange("bankAccountHolder2", e.target.value)}
                                        placeholder="ウトマチヒャッカテン" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── 5. 印影・ロゴ画像 ─────────────────────────── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <span className="text-sm text-slate-500">🖼</span>
                        <h2 className="font-semibold text-slate-800 text-sm">帳票用画像</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <SettingsImageUpload
                            label="ロゴ画像"
                            description="（未入力の場合はデフォルトロゴを使用）"
                            previewUrl={logoPreview}
                            onFileSelect={handleLogoSelect}
                            onClear={handleClearLogo}
                            isUploading={isSaving}
                        />
                        <SettingsImageUpload
                            label="印影画像"
                            description="（透過PNG推奨）"
                            previewUrl={sealPreview}
                            onFileSelect={handleSealSelect}
                            onClear={handleClearSeal}
                            isUploading={isSaving}
                        />
                    </div>
                </div>


                {/* ── 6. 固定費テンプレート初期設定 ───────────────────── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <span className="text-sm">💸</span>
                        <h2 className="font-semibold text-slate-800 text-sm">固定費テンプレート初期設定</h2>
                        <span className="ml-auto text-[10px] text-slate-400">一括登録モーダルの初期値になります</span>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-xs text-slate-500">経費入力画面の「固定費を一括登録」モーダルを開いたときに、デフォルトで入力される初期項目・金額を恒久的に管理できます。チェックを外した項目はデフォルトでオフになります。</p>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/20">
                                        <th className="pb-3 pl-2 w-10 text-center">有効</th>
                                        <th className="pb-3 w-32">カテゴリー</th>
                                        <th className="pb-3">品目・内容</th>
                                        <th className="pb-3 w-40">購入先 / 支払先</th>
                                        <th className="pb-3 w-32">支払方法</th>
                                        <th className="pb-3 w-28 text-right pr-2">金額 (円)</th>
                                        <th className="pb-3 w-10 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {(form.fixedCostTemplates || []).map((item) => (
                                        <tr key={item.id} className={`group hover:bg-slate-50/30 transition-colors ${!item.enabled ? 'opacity-40 grayscale' : ''}`}>
                                            {/* Enabled Checkbox */}
                                            <td className="py-3 text-center pl-2">
                                                <input 
                                                    type="checkbox"
                                                    checked={item.enabled}
                                                    onChange={() => handleTemplateToggle(item.id)}
                                                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500/10 border-slate-300"
                                                />
                                            </td>
                                            {/* Category Input with Datalist */}
                                            <td className="py-3 pr-2">
                                                <input
                                                    type="text"
                                                    list="category-options"
                                                    disabled={!item.enabled}
                                                    value={item.category}
                                                    onChange={(e) => handleTemplateFieldChange(item.id, "category", e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400"
                                                    placeholder="カテゴリー"
                                                />
                                            </td>
                                            {/* Item Input with Datalist */}
                                            <td className="py-3 pr-2">
                                                <input 
                                                    type="text"
                                                    list="item-options"
                                                    disabled={!item.enabled}
                                                    value={item.item}
                                                    onChange={(e) => handleTemplateFieldChange(item.id, "item", e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400"
                                                    placeholder="品目・内容"
                                                />
                                            </td>
                                            {/* Vendor Input */}
                                            <td className="py-3 pr-2">
                                                <input 
                                                    type="text"
                                                    disabled={!item.enabled}
                                                    value={item.vendor}
                                                    onChange={(e) => handleTemplateFieldChange(item.id, "vendor", e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400"
                                                />
                                            </td>
                                            {/* Payment Method Select */}
                                            <td className="py-3 pr-2">
                                                <select
                                                    disabled={!item.enabled}
                                                    value={item.paymentMethod}
                                                    onChange={(e) => handleTemplateFieldChange(item.id, "paymentMethod", e.target.value as PaymentMethod)}
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
                                                >
                                                    {(['銀行振込', 'クレジット', '小口現金'] as PaymentMethod[]).map(pm => (
                                                        <option key={pm} value={pm}>{pm}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            {/* Amount Input */}
                                            <td className="py-3 pr-2 text-right">
                                                <div className="relative inline-block w-full">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">¥</span>
                                                    <input 
                                                        type="number"
                                                        disabled={!item.enabled}
                                                        value={item.amount || ""}
                                                        onChange={(e) => handleTemplateFieldChange(item.id, "amount", Number(e.target.value))}
                                                        className="w-full bg-slate-900 border-none rounded-lg pl-5 pr-2 py-1.5 text-right text-xs font-mono font-black text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    />
                                                </div>
                                            </td>
                                            {/* Delete button */}
                                            <td className="py-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTemplateRow(item.id)}
                                                    className="text-slate-300 hover:text-red-500 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <button
                            type="button"
                            onClick={handleAddTemplateRow}
                            className="mt-3 flex items-center gap-1.5 px-4 py-2 border border-dashed border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-blue-50/20 hover:border-blue-200 transition-all font-black text-xs group"
                        >
                            <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
                            初期項目を追加する
                        </button>

                        {/* Datalists for Predefined Standard Categories and Items */}
                        <datalist id="category-options">
                            <option value="地代家賃" />
                            <option value="給与・手当" />
                            <option value="外注費" />
                            <option value="水道光熱費" />
                            <option value="諸会費・サブスク" />
                            <option value="備品" />
                            <option value="消耗品" />
                            <option value="飲食費" />
                            <option value="交通費" />
                            <option value="通信費" />
                            <option value="広告宣伝費" />
                            <option value="支払手数料" />
                            <option value="その他" />
                        </datalist>

                        <datalist id="item-options">
                            <option value="店舗・倉庫家賃" />
                            <option value="店舗スタッフ給与・手当" />
                            <option value="配送・ロジスティクス委託費" />
                            <option value="店舗電気・ガス・水道代（概算）" />
                            <option value="POSレジ・会計・在庫システム月額" />
                            <option value="インターネット回線・電話代" />
                            <option value="SNS広告・Web広告運用費" />
                            <option value="店舗清掃・消耗品購入費" />
                            <option value="税理士・会計士顧問料" />
                        </datalist>
                    </div>
                </div>


                {/* ── 7. 自動レポート設定（リンク） ───────────────────── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <Mail className="w-4 h-4 text-slate-500" />
                        <h2 className="font-semibold text-slate-800 text-sm">自動レポート</h2>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">レポート送信設定</h3>
                                <p className="text-xs text-slate-500 mt-1">週次の売上概況や在庫補充アラートをメールで自動送信します。</p>
                            </div>
                            <Link
                                href="/settings/reports"
                                className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                設定画面を開く
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* ── 保存ボタン ──────────────────────────────────── */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${saved
                            ? "bg-emerald-600 text-white"
                            : "text-white disabled:opacity-60"
                            }`}
                        style={!saved ? { backgroundColor: "#b27f79" } : undefined}
                    >
                        {isSaving ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 保存中...</>
                        ) : saved ? (
                            <><CheckCircle2 className="w-4 h-4" /> 保存しました</>
                        ) : (
                            <><Save className="w-4 h-4" /> 設定を保存する</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
