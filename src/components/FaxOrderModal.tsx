"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
    X,
    Printer,
    Download,
    Plus,
    Trash2,
    FileText,
    Loader2,
    ChevronDown,
    ChevronUp,
    RotateCcw,
    Settings,
    Save,
    CheckCircle2,
} from "lucide-react";
import { useStore, Purchase } from "@/lib/store";
import { downloadPdfFromElement } from "@/lib/pdfGenerator";
import { showNotification } from "@/lib/notifications";

interface FaxOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPurchase?: Purchase | null;
}

interface FaxOrderLineItem {
    id: string;
    productId: string;
    quantityInput: string;
    janCodeOverride?: string;
}

export const DEFAULT_FAX_ORDER_NOTES =
    "表ラベルなし・裏ラベルなし・裏ラベルは別にお願いします。販売者欄にマッチング株式会社の記載をお願いします";

const formatJapaneseDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr.replace(/-/g, "/");
    return `${year}年${month}月${day}日`;
};

const createEmptyLine = (): FaxOrderLineItem => ({
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: "",
    quantityInput: "1",
});

export function FaxOrderModal({ isOpen, onClose, initialPurchase }: FaxOrderModalProps) {
    const { suppliers, products, companySettings, purchases, addPurchase, updatePurchase } = useStore();
    const previewRef = useRef<HTMLDivElement>(null);

    const [savedPurchaseId, setSavedPurchaseId] = useState<string | null>(
        () => initialPurchase?.id || null
    );
    const [isReceived, setIsReceived] = useState<boolean>(
        () => initialPurchase ? (initialPurchase.status === "received" || initialPurchase.status === "paid") : false
    );
    const [isSaving, setIsSaving] = useState(false);

    const [orderDate, setOrderDate] = useState<string>(
        () => initialPurchase?.orderDate || new Date().toISOString().split("T")[0]
    );
    const [supplierId, setSupplierId] = useState<string>(
        () => initialPurchase?.supplierId || ""
    );
    const [supplierFax, setSupplierFax] = useState<string>(
        () => initialPurchase?.faxNumber || ""
    );
    const [filterBySupplier, setFilterBySupplier] = useState<boolean>(true);
    const [items, setItems] = useState<FaxOrderLineItem[]>(() => {
        if (!initialPurchase) return [createEmptyLine()];
        const purchaseItems =
            initialPurchase.items && initialPurchase.items.length > 0
                ? initialPurchase.items
                : initialPurchase.productId
                    ? [
                        {
                            productId: initialPurchase.productId,
                            quantity: initialPurchase.quantity || 1,
                            receivedQuantity: 0,
                            unitCost: initialPurchase.unitCost || 0,
                            totalCost: initialPurchase.totalCost || 0,
                        },
                    ]
                    : [];

        if (purchaseItems.length > 0) {
            return purchaseItems.map((it, idx) => {
                const faxItemMeta = initialPurchase.faxItems?.find((fi) => fi.productId === it.productId);
                return {
                    id: `init-${idx}-${Date.now()}`,
                    productId: it.productId,
                    quantityInput: String(it.quantity || 1),
                    janCodeOverride: faxItemMeta?.janCodeOverride,
                };
            });
        }
        return [createEmptyLine()];
    });
    const [notes, setNotes] = useState<string>(
        () => initialPurchase?.faxNotes || initialPurchase?.memo || DEFAULT_FAX_ORDER_NOTES
    );

    const [companyInfoOverride, setCompanyInfoOverride] = useState<{
        companyName?: string;
        zipCode?: string;
        address?: string;
        tel?: string;
        fax?: string;
        picName?: string;
    }>({});

    const companyInfo = useMemo(
        () => ({
            companyName: companyInfoOverride.companyName ?? companySettings?.companyName ?? "",
            zipCode: companyInfoOverride.zipCode ?? companySettings?.zipCode ?? "",
            address: companyInfoOverride.address ?? companySettings?.address ?? "",
            tel: companyInfoOverride.tel ?? companySettings?.tel ?? "",
            fax: companyInfoOverride.fax ?? companySettings?.fax ?? "",
            picName: companyInfoOverride.picName ?? companySettings?.picName ?? "",
        }),
        [companyInfoOverride, companySettings]
    );

    const updateCompanyField = (
        field: keyof typeof companyInfo,
        value: string
    ) => {
        setCompanyInfoOverride((prev) => ({ ...prev, [field]: value }));
    };

    const [showCompanyEditor, setShowCompanyEditor] = useState(false);
    const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const activeSuppliers = useMemo(
        () => suppliers.filter((s) => !s.isTrashed),
        [suppliers]
    );

    const activeProducts = useMemo(
        () => products.filter((p) => !p.isTrashed),
        [products]
    );

    const selectedSupplier = useMemo(
        () => activeSuppliers.find((s) => s.id === supplierId) || null,
        [activeSuppliers, supplierId]
    );

    const supplierScopedProducts = useMemo(() => {
        if (!supplierId) return activeProducts;
        return activeProducts.filter((p) => p.supplierId === supplierId);
    }, [activeProducts, supplierId]);

    // 選択中の仕入先に紐づく商品がある場合は絞り込みオプションを有効に
    const displayedProductOptions = useMemo(() => {
        if (filterBySupplier && supplierId && supplierScopedProducts.length > 0) {
            return supplierScopedProducts;
        }
        return activeProducts;
    }, [filterBySupplier, supplierId, supplierScopedProducts, activeProducts]);

    const resolvedItems = useMemo(() => {
        return items.map((line) => {
            const product = activeProducts.find((p) => p.id === line.productId) || null;
            const janCode =
                line.janCodeOverride !== undefined
                    ? line.janCodeOverride
                    : product?.janCode || "";
            const quantity = parseInt(line.quantityInput, 10) || 0;
            return {
                ...line,
                quantity,
                product,
                janCode,
            };
        });
    }, [items, activeProducts]);

    const validPreviewItems = useMemo(
        () => resolvedItems.filter((item) => item.product !== null),
        [resolvedItems]
    );

    const totalQuantity = useMemo(
        () => validPreviewItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        [validPreviewItems]
    );

    const handleAddLine = () => {
        setItems((prev) => [...prev, createEmptyLine()]);
    };

    const handleRemoveLine = (id: string) => {
        setItems((prev) => {
            if (prev.length <= 1) {
                return [createEmptyLine()];
            }
            return prev.filter((item) => item.id !== id);
        });
    };

    const handleChangeLineProduct = (id: string, productId: string) => {
        const product = activeProducts.find((p) => p.id === productId);
        setItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        productId,
                        janCodeOverride: product?.janCode || "",
                    }
                    : item
            )
        );
    };

    const handleChangeLineQuantity = (id: string, rawValue: string) => {
        const normalized = rawValue
            .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
            .replace(/\D/g, "")
            .replace(/^0+(?=\d)/, "");

        setItems((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, quantityInput: normalized } : item
            )
        );
    };

    const handleBlurLineQuantity = (id: string) => {
        setItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                const parsed = parseInt(item.quantityInput, 10);
                if (!parsed || parsed < 1) {
                    return { ...item, quantityInput: "1" };
                }
                return { ...item, quantityInput: String(parsed) };
            })
        );
    };

    const handleChangeLineJan = (id: string, janCode: string) => {
        setItems((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, janCodeOverride: janCode } : item
            )
        );
    };

    const saveFaxOrder = async (options?: { nextReceived?: boolean; silent?: boolean }): Promise<string | null> => {
        if (!supplierId) {
            if (!options?.silent) showNotification("注文先を選択してください。", "error");
            return null;
        }
        if (validPreviewItems.length === 0) {
            if (!options?.silent) showNotification("注文商品を1つ以上選択してください。", "error");
            return null;
        }

        const targetReceived = options?.nextReceived !== undefined ? options.nextReceived : isReceived;
        const existing = savedPurchaseId ? purchases.find((p) => p.id === savedPurchaseId) : undefined;
        const today = new Date().toISOString().split("T")[0];

        const purchaseItems = validPreviewItems.map((item) => {
            const unitCost = item.product?.costPrice || 0;
            const quantity = Math.max(1, item.quantity || 1);
            return {
                productId: item.productId,
                quantity,
                receivedQuantity: targetReceived ? quantity : 0,
                unitCost,
                totalCost: unitCost * quantity,
            };
        });
        const totalAmount = purchaseItems.reduce((sum, item) => sum + item.totalCost, 0);

        const nextStatus: Purchase["status"] = targetReceived
            ? (existing?.status === "paid" ? "paid" : "received")
            : (!existing || existing.status === "received" || existing.status === "paid" ? "ordered" : existing.status);

        const receivedDate = targetReceived ? (existing?.receivedDate || existing?.arrivalDate || today) : "";
        const arrivalDate = targetReceived ? (existing?.arrivalDate || existing?.receivedDate || today) : "";

        const faxNumberValue = supplierFax.trim();
        const faxItemsMeta = validPreviewItems.map((item) => ({
            productId: item.productId,
            janCodeOverride: item.janCodeOverride ?? item.janCode ?? "",
        }));

        const payload = {
            type: "A" as const,
            status: nextStatus,
            supplierId,
            items: purchaseItems,
            totalAmount,
            orderDate: orderDate || today,
            receivedDate,
            arrivalDate,
            paymentDate: targetReceived ? existing?.paymentDate : "",
            memo: notes,
            orderMethod: "fax" as const,
            faxNumber: faxNumberValue,
            faxNotes: notes,
            faxItems: faxItemsMeta,
        };

        setIsSaving(true);
        try {
            if (savedPurchaseId) {
                await updatePurchase(savedPurchaseId, payload);
                if (!options?.silent) {
                    showNotification(
                        targetReceived
                            ? "FAX注文票を更新し、入荷済みとして在庫数に反映しました。"
                            : "FAX注文票の履歴を更新しました。"
                    );
                }
                return savedPurchaseId;
            } else {
                const newId = await addPurchase(payload);
                if (newId) setSavedPurchaseId(newId);
                if (!options?.silent) {
                    showNotification(
                        targetReceived
                            ? "FAX注文票を履歴に保存し、入荷済みとして在庫数に反映しました。"
                            : "FAX注文票を仕入履歴に保存しました。"
                    );
                }
                return newId || null;
            }
        } catch (err) {
            console.error("Failed to save FAX order:", err);
            if (!options?.silent) showNotification("FAX注文票の保存に失敗しました。", "error");
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleReceived = async (checked: boolean) => {
        if (!checked && savedPurchaseId) {
            const existing = purchases.find((p) => p.id === savedPurchaseId);
            if (existing && (existing.status === "received" || existing.status === "paid")) {
                if (!window.confirm("入荷済みのチェックを外して「発注済」に戻しますか？反映された在庫数も差し戻されます。")) {
                    return;
                }
            }
        }
        setIsReceived(checked);
        if (savedPurchaseId) {
            await saveFaxOrder({ nextReceived: checked });
        }
    };

    const handlePrint = async () => {
        if (!savedPurchaseId && supplierId && validPreviewItems.length > 0) {
            await saveFaxOrder({ silent: true });
        }
        window.print();
    };

    const handleDownloadPdf = async () => {
        if (!previewRef.current) return;
        setIsGeneratingPdf(true);
        try {
            if (!savedPurchaseId && supplierId && validPreviewItems.length > 0) {
                await saveFaxOrder({ silent: true });
            }
            const supplierPart = selectedSupplier?.name
                ? `_${selectedSupplier.name.replace(/[\\/:*?"<>|\s]/g, "")}`
                : "";
            const datePart = orderDate || new Date().toISOString().split("T")[0];
            await downloadPdfFromElement(
                previewRef.current,
                `FAX注文票${supplierPart}_${datePart}.pdf`
            );
            showNotification("FAX注文票のPDFをダウンロードしました。");
        } catch (err) {
            console.error("FAX order PDF generation failed:", err);
            showNotification("PDFの生成に失敗しました。", "error");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto print:static print:p-0 print:bg-white print:backdrop-blur-none print:overflow-visible print:block">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden max-h-[95vh] print:max-h-none print:overflow-visible print:shadow-none print:rounded-none print:block">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-white shrink-0 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                                FAX注文票の作成・出力
                            </h2>
                            <p className="text-xs text-slate-500">
                                注文先・商品を選択し、A4印刷またはPDF出力できます
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => saveFaxOrder()}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            <span>{savedPurchaseId ? "履歴を更新" : "履歴に保存"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            <span className="hidden sm:inline">印刷</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            disabled={isGeneratingPdf}
                            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {isGeneratingPdf ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            <span>{isGeneratingPdf ? "生成中..." : "PDF出力"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
                            aria-label="閉じる"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Mobile Tab Switcher */}
                <div className="flex lg:hidden border-b border-slate-200 bg-slate-50 shrink-0 print:hidden">
                    <button
                        type="button"
                        onClick={() => setMobileTab("edit")}
                        className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                            mobileTab === "edit"
                                ? "text-emerald-700 bg-white border-b-2 border-emerald-600"
                                : "text-slate-500"
                        }`}
                    >
                        注文内容の入力
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileTab("preview")}
                        className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                            mobileTab === "preview"
                                ? "text-emerald-700 bg-white border-b-2 border-emerald-600"
                                : "text-slate-500"
                        }`}
                    >
                        FAX注文票プレビュー
                    </button>
                </div>

                {/* Main Content: 2-Pane */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden print:block print:overflow-visible">
                    {/* Left Pane: Form */}
                    <div
                        className={`w-full lg:w-[440px] xl:w-[480px] border-r border-slate-200 overflow-y-auto p-4 sm:p-5 space-y-5 bg-white shrink-0 print:hidden ${
                            mobileTab === "edit" ? "block" : "hidden lg:block"
                        }`}
                    >
                        {/* 注文日・注文先 */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                基本情報
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        注文日
                                    </label>
                                    <input
                                        type="date"
                                        value={orderDate}
                                        onChange={(e) => setOrderDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        送信先FAX番号（任意）
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="例: 096-XXX-XXXX"
                                        value={supplierFax}
                                        onChange={(e) => setSupplierFax(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    注文先（仕入先データベース）
                                </label>
                                <select
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                >
                                    <option value="">-- 仕入先を選択してください --</option>
                                    {activeSuppliers.map((supplier) => (
                                        <option key={supplier.id} value={supplier.id}>
                                            {supplier.name}
                                            {supplier.pic ? `（担当: ${supplier.pic}）` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 注文商品リスト */}
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    注文商品・数量
                                </h3>
                                {supplierId && supplierScopedProducts.length > 0 && (
                                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={filterBySupplier}
                                            onChange={(e) => setFilterBySupplier(e.target.checked)}
                                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>この仕入先の商品のみ</span>
                                    </label>
                                )}
                            </div>

                            <div className="space-y-2.5">
                                {resolvedItems.map((line, index) => (
                                    <div
                                        key={line.id}
                                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-bold text-slate-400">
                                                商品 #{index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveLine(line.id)}
                                                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                                title="行を削除"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div>
                                            <select
                                                value={line.productId}
                                                onChange={(e) =>
                                                    handleChangeLineProduct(line.id, e.target.value)
                                                }
                                                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                            >
                                                <option value="">-- 商品を選択 --</option>
                                                {displayedProductOptions.map((product) => (
                                                    <option key={product.id} value={product.id}>
                                                        {product.name}
                                                        {product.variantName
                                                            ? ` (${product.variantName})`
                                                            : ""}
                                                        {product.janCode
                                                            ? ` [JAN: ${product.janCode}]`
                                                            : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2">
                                                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                                                    JANコード
                                                </label>
                                                <input
                                                    type="text"
                                                    value={line.janCode}
                                                    onChange={(e) =>
                                                        handleChangeLineJan(line.id, e.target.value)
                                                    }
                                                    placeholder="未登録（手入力可）"
                                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                                                    数量
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={line.quantityInput}
                                                    onFocus={(e) => e.currentTarget.select()}
                                                    onChange={(e) =>
                                                        handleChangeLineQuantity(line.id, e.target.value)
                                                    }
                                                    onBlur={() => handleBlurLineQuantity(line.id)}
                                                    placeholder="1"
                                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-right bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={handleAddLine}
                                className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                商品を追加
                            </button>
                        </div>

                        {/* 備考 */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    備考
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setNotes(DEFAULT_FAX_ORDER_NOTES)}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 transition-colors"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    デフォルトに戻す
                                </button>
                            </div>
                            <textarea
                                rows={4}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                        </div>

                        {/* 自社情報 */}
                        <div className="pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowCompanyEditor(!showCompanyEditor)}
                                className="w-full flex items-center justify-between text-left py-1"
                            >
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        自社情報（設定から自動取得）
                                    </h3>
                                    <p className="text-xs text-slate-600 mt-0.5 truncate max-w-[300px]">
                                        {companyInfo.companyName || "未設定（管理設定で登録できます）"}
                                    </p>
                                </div>
                                {showCompanyEditor ? (
                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                            </button>

                            {showCompanyEditor && (
                                <div className="mt-3 space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <div className="flex justify-end">
                                        <Link
                                            href="/settings"
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                                        >
                                            <Settings className="w-3 h-3" />
                                            自社情報設定を開く
                                        </Link>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                            会社名・屋号
                                        </label>
                                        <input
                                            type="text"
                                            value={companyInfo.companyName}
                                            onChange={(e) =>
                                                updateCompanyField("companyName", e.target.value)
                                            }
                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                                郵便番号
                                            </label>
                                            <input
                                                type="text"
                                                value={companyInfo.zipCode}
                                                onChange={(e) =>
                                                    updateCompanyField("zipCode", e.target.value)
                                                }
                                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                                担当者名
                                            </label>
                                            <input
                                                type="text"
                                                value={companyInfo.picName}
                                                onChange={(e) =>
                                                    updateCompanyField("picName", e.target.value)
                                                }
                                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                            住所
                                        </label>
                                        <input
                                            type="text"
                                            value={companyInfo.address}
                                            onChange={(e) =>
                                                updateCompanyField("address", e.target.value)
                                            }
                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                                TEL
                                            </label>
                                            <input
                                                type="text"
                                                value={companyInfo.tel}
                                                onChange={(e) =>
                                                    updateCompanyField("tel", e.target.value)
                                                }
                                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                                FAX
                                            </label>
                                            <input
                                                type="text"
                                                value={companyInfo.fax}
                                                onChange={(e) =>
                                                    updateCompanyField("fax", e.target.value)
                                                }
                                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 入荷確認フラグ（在庫反映） */}
                        <div className={`border rounded-xl p-3.5 transition-colors ${isReceived ? "bg-emerald-50/70 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                            <label className="flex items-start gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={isReceived}
                                    disabled={isSaving}
                                    onChange={(e) => handleToggleReceived(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                                        <CheckCircle2 className={`w-4 h-4 ${isReceived ? "text-emerald-600" : "text-slate-400"}`} />
                                        <span>入荷済み（在庫数に反映する）</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                        {savedPurchaseId
                                            ? isReceived
                                                ? "入荷済みとして在庫数に反映されています。チェックを外すと発注済みに戻り在庫が差し戻されます。"
                                                : "商品が入荷したらチェックを入れてください。即座に各商品の在庫数が増加します。"
                                            : "チェックを入れて保存すると、最初から入荷済みとして在庫数へ加算されます。"}
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Right Pane: A4 Preview */}
                    <div
                        className={`flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 print:p-0 print:bg-white print:overflow-visible print:block ${
                            mobileTab === "preview" ? "block" : "hidden lg:block"
                        }`}
                    >
                        <div
                            ref={previewRef}
                            className="bg-white shadow-lg mx-auto printable-document"
                            style={{
                                width: "210mm",
                                minHeight: "297mm",
                                padding: "16mm 18mm",
                                fontFamily:
                                    "'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'BIZ UDPGothic', 'Meiryo', sans-serif",
                                color: "#111827",
                                lineHeight: "1.6",
                                boxSizing: "border-box",
                                position: "relative",
                            }}
                        >
                            <style jsx global>{`
                                @media print {
                                    @page {
                                        size: A4 portrait;
                                        margin: 0;
                                    }
                                    html,
                                    body {
                                        margin: 0 !important;
                                        padding: 0 !important;
                                        width: 210mm !important;
                                        height: auto !important;
                                        background: #fff !important;
                                        -webkit-print-color-adjust: exact !important;
                                        print-color-adjust: exact !important;
                                    }
                                    body * {
                                        visibility: hidden !important;
                                    }
                                    .printable-document,
                                    .printable-document * {
                                        visibility: visible !important;
                                    }
                                    .printable-document {
                                        position: absolute !important;
                                        left: 0 !important;
                                        top: 0 !important;
                                        width: 210mm !important;
                                        min-height: 297mm !important;
                                        margin: 0 !important;
                                        padding: 16mm 18mm !important;
                                        box-shadow: none !important;
                                        background: #ffffff !important;
                                        box-sizing: border-box !important;
                                    }
                                    .printable-document table tr {
                                        page-break-inside: avoid;
                                        break-inside: avoid;
                                    }
                                }
                            `}</style>

                            {/* 注文日 */}
                            <div
                                style={{
                                    textAlign: "right",
                                    fontSize: "12px",
                                    color: "#374151",
                                    marginBottom: "8px",
                                }}
                            >
                                注文日：{formatJapaneseDate(orderDate)}
                            </div>

                            {/* タイトル */}
                            <div
                                style={{
                                    textAlign: "center",
                                    borderTop: "2px solid #111827",
                                    borderBottom: "2px solid #111827",
                                    padding: "10px 0",
                                    marginBottom: "24px",
                                }}
                            >
                                <h1
                                    style={{
                                        fontSize: "26px",
                                        fontWeight: 700,
                                        letterSpacing: "0.35em",
                                        textIndent: "0.35em",
                                        margin: 0,
                                        color: "#111827",
                                    }}
                                >
                                    FAX注文票
                                </h1>
                            </div>

                            {/* 注文先 & 自社情報 */}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    gap: "24px",
                                    marginBottom: "24px",
                                }}
                            >
                                {/* 左：注文先 */}
                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            color: "#6b7280",
                                            marginBottom: "4px",
                                            letterSpacing: "0.08em",
                                        }}
                                    >
                                        【注文先】
                                    </div>
                                    <div
                                        style={{
                                            borderBottom: "2px solid #111827",
                                            paddingBottom: "6px",
                                            marginBottom: "8px",
                                        }}
                                    >
                                        <span style={{ fontSize: "20px", fontWeight: 700 }}>
                                            {selectedSupplier?.name || "（注文先を選択してください）"}
                                        </span>
                                        <span style={{ fontSize: "15px", marginLeft: "10px" }}>
                                            御中
                                        </span>
                                    </div>

                                    <div style={{ fontSize: "11px", color: "#374151", lineHeight: "1.7" }}>
                                        {selectedSupplier?.pic && (
                                            <div>ご担当者：{selectedSupplier.pic} 様</div>
                                        )}
                                        {(selectedSupplier?.zipCode || selectedSupplier?.address) && (
                                            <div>
                                                {selectedSupplier.zipCode && `〒${selectedSupplier.zipCode} `}
                                                {selectedSupplier.address}
                                            </div>
                                        )}
                                        {(selectedSupplier?.tel || supplierFax) && (
                                            <div>
                                                {selectedSupplier?.tel && `TEL: ${selectedSupplier.tel}`}
                                                {selectedSupplier?.tel && supplierFax && " ／ "}
                                                {supplierFax && `FAX: ${supplierFax}`}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 右：自社情報 */}
                                <div
                                    style={{
                                        width: "260px",
                                        border: "1px solid #d1d5db",
                                        borderRadius: "4px",
                                        padding: "10px 12px",
                                        fontSize: "11px",
                                        color: "#1f2937",
                                        lineHeight: "1.65",
                                        backgroundColor: "#f9fafb",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            color: "#6b7280",
                                            marginBottom: "4px",
                                            letterSpacing: "0.08em",
                                        }}
                                    >
                                        【発注元（自社情報）】
                                    </div>
                                    <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "2px" }}>
                                        {companyInfo.companyName || "（自社名未設定）"}
                                    </div>
                                    {companyInfo.zipCode && <div>〒{companyInfo.zipCode}</div>}
                                    {companyInfo.address && <div>{companyInfo.address}</div>}
                                    {companyInfo.tel && <div>TEL：{companyInfo.tel}</div>}
                                    {companyInfo.fax && <div>FAX：{companyInfo.fax}</div>}
                                    {companyInfo.picName && <div>担当：{companyInfo.picName}</div>}
                                </div>
                            </div>

                            {/* 挨拶文 */}
                            <p
                                style={{
                                    fontSize: "12px",
                                    color: "#1f2937",
                                    marginBottom: "16px",
                                }}
                            >
                                いつも大変お世話になっております。下記の通り注文いたしますので、お手配のほどよろしくお願い申し上げます。
                            </p>

                            {/* 注文明細テーブル */}
                            <table
                                style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    marginBottom: "20px",
                                    fontSize: "12px",
                                }}
                            >
                                <thead>
                                    <tr style={{ backgroundColor: "#f3f4f6" }}>
                                        <th
                                            style={{
                                                border: "1px solid #374151",
                                                padding: "8px 6px",
                                                width: "44px",
                                                textAlign: "center",
                                                fontWeight: 700,
                                            }}
                                        >
                                            No.
                                        </th>
                                        <th
                                            style={{
                                                border: "1px solid #374151",
                                                padding: "8px 10px",
                                                textAlign: "left",
                                                fontWeight: 700,
                                            }}
                                        >
                                            注文商品名
                                        </th>
                                        <th
                                            style={{
                                                border: "1px solid #374151",
                                                padding: "8px 10px",
                                                width: "150px",
                                                textAlign: "center",
                                                fontWeight: 700,
                                            }}
                                        >
                                            JANコード
                                        </th>
                                        <th
                                            style={{
                                                border: "1px solid #374151",
                                                padding: "8px 10px",
                                                width: "90px",
                                                textAlign: "right",
                                                fontWeight: 700,
                                            }}
                                        >
                                            数量
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {validPreviewItems.length > 0 ? (
                                        validPreviewItems.map((item, idx) => (
                                            <tr key={item.id}>
                                                <td
                                                    style={{
                                                        border: "1px solid #374151",
                                                        padding: "8px 6px",
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    {idx + 1}
                                                </td>
                                                <td
                                                    style={{
                                                        border: "1px solid #374151",
                                                        padding: "8px 10px",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {item.product?.name}
                                                    {item.product?.variantName
                                                        ? ` (${item.product.variantName})`
                                                        : ""}
                                                </td>
                                                <td
                                                    style={{
                                                        border: "1px solid #374151",
                                                        padding: "8px 10px",
                                                        textAlign: "center",
                                                        fontFamily: "monospace",
                                                        fontSize: "12px",
                                                    }}
                                                >
                                                    {item.janCode || "―"}
                                                </td>
                                                <td
                                                    style={{
                                                        border: "1px solid #374151",
                                                        padding: "8px 10px",
                                                        textAlign: "right",
                                                        fontWeight: 700,
                                                        fontSize: "14px",
                                                    }}
                                                >
                                                    {item.quantity}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                style={{
                                                    border: "1px solid #374151",
                                                    padding: "24px 10px",
                                                    textAlign: "center",
                                                    color: "#9ca3af",
                                                }}
                                            >
                                                注文商品を選択するとここに表示されます
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {validPreviewItems.length > 0 && (
                                    <tfoot>
                                        <tr style={{ backgroundColor: "#f9fafb" }}>
                                            <td
                                                colSpan={3}
                                                style={{
                                                    border: "1px solid #374151",
                                                    padding: "8px 10px",
                                                    textAlign: "right",
                                                    fontWeight: 700,
                                                }}
                                            >
                                                合計数量
                                            </td>
                                            <td
                                                style={{
                                                    border: "1px solid #374151",
                                                    padding: "8px 10px",
                                                    textAlign: "right",
                                                    fontWeight: 700,
                                                    fontSize: "14px",
                                                }}
                                            >
                                                {totalQuantity}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>

                            {/* 備考欄 */}
                            <div
                                style={{
                                    border: "1px solid #374151",
                                    borderRadius: "4px",
                                    padding: "12px 14px",
                                    minHeight: "96px",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        color: "#374151",
                                        marginBottom: "6px",
                                        borderBottom: "1px solid #e5e7eb",
                                        paddingBottom: "4px",
                                    }}
                                >
                                    備考
                                </div>
                                <div
                                    style={{
                                        fontSize: "12px",
                                        color: "#111827",
                                        whiteSpace: "pre-wrap",
                                        lineHeight: "1.75",
                                    }}
                                >
                                    {notes || " "}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
