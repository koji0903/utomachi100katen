"use client";

import { useState, useEffect } from "react";
import { X, Save, Users, Building2, Wheat, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useStore, Supplier } from "@/lib/store";
import { useZipCode } from "@/lib/useZipCode";
import { showNotification } from "@/lib/notifications";

interface SupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Supplier | null;
}

export function SupplierModal({ isOpen, onClose, initialData }: SupplierModalProps) {
    const { addSupplier, updateSupplier } = useStore();
    const { zipStatus, lookupZip } = useZipCode();

    const defaultForm = {
        name: "",
        category: "" as "" | "Manufacturer" | "Producer",
        zipCode: "",
        address: "",
        tel: "",
        email: "",
        pic: "",
        bankName: "",
        branchName: "",
        accountType: "普通",
        accountNumber: "",
        accountHolder: "",
        closingDay: "",
        paymentDay: "",
        memo: "",
    };

    const [formData, setFormData] = useState(defaultForm);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name || "",
                    category: initialData.category || "",
                    zipCode: initialData.zipCode || "",
                    address: initialData.address || "",
                    tel: initialData.tel || "",
                    email: initialData.email || "",
                    pic: initialData.pic || "",
                    bankName: initialData.bankInfo?.bankName || "",
                    branchName: initialData.bankInfo?.branchName || "",
                    accountType: initialData.bankInfo?.accountType || "普通",
                    accountNumber: initialData.bankInfo?.accountNumber || "",
                    accountHolder: initialData.bankInfo?.accountHolder || "",
                    closingDay: initialData.paymentTerms?.closingDay?.toString() || "",
                    paymentDay: initialData.paymentTerms?.paymentDay?.toString() || "",
                    memo: initialData.memo || "",
                });
            } else {
                setFormData(defaultForm);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    // Zip auto-fill handler
    const handleZipChange = (raw: string) => {
        const digits = raw.replace(/\D/g, "").slice(0, 7);
        const formatted = digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
        setFormData(prev => ({ ...prev, zipCode: formatted }));
        lookupZip(digits, ({ full }) => {
            setFormData(prev => ({ ...prev, address: full }));
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const supplierData: Omit<Supplier, "id"> = {
            name: formData.name,
            category: formData.category || undefined,
            zipCode: formData.zipCode || undefined,
            address: formData.address || undefined,
            tel: formData.tel || undefined,
            email: formData.email || undefined,
            pic: formData.pic || undefined,
            bankInfo: (formData.bankName || formData.accountNumber) ? {
                bankName: formData.bankName || undefined,
                branchName: formData.branchName || undefined,
                accountType: formData.accountType,
                accountNumber: formData.accountNumber || undefined,
                accountHolder: formData.accountHolder || undefined,
            } : undefined,
            paymentTerms: (formData.closingDay || formData.paymentDay) ? {
                closingDay: formData.closingDay ? parseInt(formData.closingDay) : undefined,
                paymentDay: formData.paymentDay ? parseInt(formData.paymentDay) : undefined,
            } : undefined,
            memo: formData.memo || undefined,
        };
        if (initialData) {
            updateSupplier(initialData.id, supplierData);
            showNotification("仕入先を更新しました。");
        } else {
            addSupplier(supplierData);
            showNotification("仕入先を登録しました。");
        }
        onClose();
    };

    const inputClass = "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white text-sm";
    const labelClass = "text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5";

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Users className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                            {initialData ? "仕入先を編集" : "新規仕入先登録"}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <form id="supplier-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Basic Info */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">基本情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className={labelClass}>仕入先名 *</label>
                                    <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} placeholder="例: 住吉海苔本舗" />
                                </div>

                                <div className="md:col-span-2 space-y-1.5">
                                    <label className={labelClass}>カテゴリー</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button type="button" onClick={() => setFormData({ ...formData, category: 'Manufacturer' })}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${formData.category === 'Manufacturer' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                            <Building2 className={`w-5 h-5 ${formData.category === 'Manufacturer' ? 'text-blue-600' : 'text-slate-400'}`} />
                                            <div>
                                                <div className={`font-semibold text-sm ${formData.category === 'Manufacturer' ? 'text-blue-700' : 'text-slate-700'}`}>委託製造業者</div>
                                                <div className="text-xs text-slate-500">加工品・計画発注メイン</div>
                                            </div>
                                        </button>
                                        <button type="button" onClick={() => setFormData({ ...formData, category: 'Producer' })}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${formData.category === 'Producer' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                            <Wheat className={`w-5 h-5 ${formData.category === 'Producer' ? 'text-green-600' : 'text-slate-400'}`} />
                                            <div>
                                                <div className={`font-semibold text-sm ${formData.category === 'Producer' ? 'text-green-700' : 'text-slate-700'}`}>一次生産者</div>
                                                <div className="text-xs text-slate-500">農家・直接入荷メイン</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>担当者名</label>
                                    <input type="text" value={formData.pic} onChange={(e) => setFormData({ ...formData, pic: e.target.value })} className={inputClass} placeholder="例: 山田 太郎" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>電話番号</label>
                                    <input type="tel" value={formData.tel} onChange={(e) => setFormData({ ...formData, tel: e.target.value })} className={inputClass} placeholder="090-0000-0000" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>メールアドレス</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} placeholder="example@mail.com" />
                                </div>
                                {/* ① 郵便番号 */}
                                <div className="space-y-1.5">
                                    <label className={labelClass}>
                                        郵便番号
                                        <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">入力すると住所を自動補完</span>
                                    </label>
                                    <div className="relative">
                                        <input type="text" value={formData.zipCode}
                                            onChange={e => handleZipChange(e.target.value)}
                                            className={inputClass} placeholder="869-0401"
                                            maxLength={8} inputMode="numeric" />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {zipStatus === "loading" && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                                            {zipStatus === "ok" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                            {zipStatus === "notfound" && <AlertCircle className="w-4 h-4 text-amber-400" />}
                                        </div>
                                    </div>
                                    {zipStatus === "notfound" && <p className="text-[11px] text-amber-500">郵便番号が見つかりませんでした</p>}
                                </div>
                                {/* ② 住所（自動補完 or 手動） */}
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className={labelClass}>住所</label>
                                    <input type="text" value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        className={inputClass} placeholder="郵便番号を入力すると自動補完されます" />
                                </div>
                            </div>
                        </div>

                        {/* Payment Terms */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">支払い条件</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className={labelClass}>締日（毎月何日）</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="1" max="31" value={formData.closingDay} onChange={(e) => setFormData({ ...formData, closingDay: e.target.value })} className={inputClass} placeholder="末日=31" />
                                        <span className="text-sm text-slate-500 whitespace-nowrap">日締め</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>支払日（翌月何日）</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="1" max="31" value={formData.paymentDay} onChange={(e) => setFormData({ ...formData, paymentDay: e.target.value })} className={inputClass} placeholder="例: 20" />
                                        <span className="text-sm text-slate-500 whitespace-nowrap">日払い</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bank Info */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">銀行口座情報</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className={labelClass}>銀行名</label>
                                    <input type="text" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} className={inputClass} placeholder="例: ○○銀行" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>支店名</label>
                                    <input type="text" value={formData.branchName} onChange={(e) => setFormData({ ...formData, branchName: e.target.value })} className={inputClass} placeholder="例: 宇土支店" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>口座種別</label>
                                    <select value={formData.accountType} onChange={(e) => setFormData({ ...formData, accountType: e.target.value })} className={inputClass}>
                                        <option value="普通">普通</option>
                                        <option value="当座">当座</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>口座番号</label>
                                    <input type="text" value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} className={inputClass} placeholder="1234567" />
                                </div>
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className={labelClass}>口座名義</label>
                                    <input type="text" value={formData.accountHolder} onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })} className={inputClass} placeholder="例: スミヨシノリホンポ" />
                                </div>
                            </div>
                        </div>

                        {/* Memo */}
                        <div className="space-y-1.5">
                            <label className={labelClass}>備考</label>
                            <textarea value={formData.memo} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} rows={3} className={inputClass + " resize-none"} placeholder="取引条件など" />
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                        キャンセル
                    </button>
                    <button type="submit" form="supplier-form" className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                        <Save className="w-4 h-4" />
                        保存する
                    </button>
                </div>
            </div>
        </div>
    );
}
