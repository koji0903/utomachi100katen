"use client";

import { useRef, useState, useCallback } from "react";
import { useStore, IssuedDocument } from "@/lib/store";
import { summarizeTaxByRate, TAX_RATE_LABELS } from "@/lib/taxUtils";
import { generatePdfFromElement } from "@/lib/pdfGenerator";
import { X, Download, Printer, Loader2, Sparkles, FileText, Receipt } from "lucide-react";

// ─── Brand token ─────────────────────────────────────────────────────────
const BRAND = "#b27f79";
const BRAND_LIGHT = "#f5eeee";
const BRAND_DARK = "#8b5c57";

// ─── Props ───────────────────────────────────────────────────────────────
export type DocumentType = "delivery_note" | "payment_summary" | "invoice";

interface DocumentPreviewModalProps {
    type: DocumentType;
    // For delivery_note & invoice: storeId + period
    storeId?: string;
    period?: string;   // YYYY-MM or YYYY-MM-DD
    // For payment_summary: supplierId + month
    supplierId?: string;
    month?: string;    // YYYY-MM
    docNumber?: string; // Optional override
    recipientName?: string; // Optional override
    customDetails?: IssuedDocument['details'];
    customAdjustments?: IssuedDocument['adjustments'];
    customTaxRate?: IssuedDocument['taxRate'];
    hidePrices?: boolean;
    onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
const fmtMoney = (n: number) => `¥${n.toLocaleString()}`;
const today = () => {
    const d = new Date();
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

// ─── Component ───────────────────────────────────────────────────────────
export function DocumentPreviewModal({
    type,
    storeId,
    period,
    supplierId,
    month,
    docNumber: propDocNumber,
    recipientName: propRecipientName,
    customDetails,
    customAdjustments,
    customTaxRate,
    hidePrices: propHidePrices,
    onClose,
}: DocumentPreviewModalProps) {
    const { companySettings, sales, products, retailStores, purchases, suppliers, isLoaded, spotRecipients } = useStore();
    const previewRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [memo, setMemo] = useState("");
    const [isGeneratingMemo, setIsGeneratingMemo] = useState(false);

    if (!isLoaded) return <div className="p-8 text-slate-500 animate-pulse">読み込み中...</div>;

    const rounding = companySettings?.roundingMode ?? "floor";

    // ─ Compute document data ────────────────────────────────────────────
    const isDeliveryNote = type === "delivery_note";
    const isInvoice = type === "invoice";
    const isPaymentSummary = type === "payment_summary";
    const hidePrices = propHidePrices ?? false;

    // --- Line Items (Delivery Note & Invoice): aggregate sales items for store+period ---
    type LineItem = { name: string; qty: number; unitPrice: number; subtotal: number; taxRate: "standard" | "reduced" };

    const lineItems: LineItem[] = (() => {
        if (customDetails && customDetails.length > 0) {
            return customDetails.map((d: any) => ({
                name: d.label,
                qty: d.quantity,
                unitPrice: d.unitPrice,
                subtotal: d.subtotal,
                taxRate: d.taxRate || (customTaxRate === 8 ? 'reduced' : 'standard')
            }));
        }

        if (!isDeliveryNote && !isInvoice) return [];
        if (!storeId && !isInvoice) return []; // Require storeId for registered documents

        const filtered = (sales || []).filter(s => {
            if (!s || !s.items) return false;
            const matchStore = storeId ? s.storeId === storeId : true;
            // Defensive startswith
            const sPeriod = s.period || "";
            const matchPeriod = period ? sPeriod.startsWith(period) : true;
            return matchStore && matchPeriod;
        });

        const map = new Map<string, LineItem>();
        for (const sale of filtered) {
            for (const item of sale.items) {
                const product = products.find(p => p.id === item.productId);
                if (!product) continue;
                const key = item.productId;
                if (map.has(key)) {
                    const existing = map.get(key)!;
                    existing.qty += item.quantity;
                    existing.subtotal += item.subtotal;
                } else {
                    map.set(key, {
                        name: product.name + (product.variantName ? ` (${product.variantName})` : ""),
                        qty: item.quantity,
                        unitPrice: item.priceAtSale,
                        subtotal: item.subtotal,
                        taxRate: product.taxRate ?? "standard",
                    });
                }
            }
        }
        return Array.from(map.values());
    })();

    // --- Purchase Lines (Payment Summary): aggregate purchases for supplier+month ---
    type PurchaseLine = { name: string; qty: number; unitCost: number; total: number; date: string; taxRate: "standard" | "reduced" };

    const purchaseLines: PurchaseLine[] = (() => {
        if (!isPaymentSummary) return [];
        return purchases
            .filter(p => {
                const matchSupplier = supplierId ? p.supplierId === supplierId : true;
                const dateStr = p.arrivalDate || p.orderDate;
                const matchMonth = month ? dateStr?.startsWith(month) : true;
                return matchSupplier && p.status === "completed" && matchMonth;
            })
            .map(p => {
                const product = products.find(pr => pr.id === p.productId);
                return {
                    name: product ? product.name + (product.variantName ? ` (${product.variantName})` : "") : "不明",
                    qty: p.quantity,
                    unitCost: p.unitCost,
                    total: p.totalCost,
                    date: p.arrivalDate || p.orderDate || "",
                    taxRate: product?.taxRate ?? "standard",
                };
            });
    })();

    // ─ Tax summary ──────────────────────────────────────────────────────
    const taxSummary = (isDeliveryNote || isInvoice)
        ? summarizeTaxByRate(lineItems.map(i => ({
            amount: i.subtotal,
            rateType: customTaxRate ? (customTaxRate === 8 ? 'reduced' : 'standard') : i.taxRate
        })), rounding)
        : summarizeTaxByRate(purchaseLines.map(i => ({ amount: i.total, rateType: i.taxRate })), rounding);

    // Apply adjustments if any
    if (customAdjustments && customAdjustments.length > 0) {
        const adjTotal = customAdjustments.reduce((sum: number, a: any) => sum + a.amount, 0);
        taxSummary.grandTotal += adjTotal;
    }

    const totalWithTax = taxSummary.grandTotal;
    const subtotal = taxSummary.standard.subtotal + taxSummary.reduced.subtotal;
    const tax = taxSummary.totalTax;

    // ─ Names ──────────────────────────────────────────────────────────
    const store = retailStores.find(s => s.id === storeId);
    const supplier = suppliers.find(s => s.id === supplierId);
    // Fixed: handle spot recipient name
    const recipient = propRecipientName || (
        (isDeliveryNote || isInvoice)
            ? (store?.useDifferentBilling ? (store.billingName || store.name) : (store?.name ?? "（客先名）"))
            : (supplier?.name ?? "（仕入先名）")
    );

    const recipientAddress = (isDeliveryNote || isInvoice) && store?.useDifferentBilling ? {
        zipCode: store.billingZipCode,
        address: store.billingAddress,
        tel: store.billingTel
    } : null;

    const docTitle = isDeliveryNote ? "納　品　書" : isInvoice ? "請　求　書" : "支 払 明 細 書";

    // Fixed: use passed docNumber or fallback to temp
    const docNumber = propDocNumber || `${isDeliveryNote ? "DN" : isInvoice ? "INV" : "PM"}-${Date.now().toString().slice(-8)}`;

    const periodLabel = (() => {
        if ((isDeliveryNote || isInvoice) && period) {
            if (period.length === 7) return `${period.slice(0, 4)}年${parseInt(period.slice(5))}月分`;
            return period;
        }
        if (isPaymentSummary && month) return `${month.slice(0, 4)}年${parseInt(month.slice(5))}月分`;
        return "";
    })();

    // ─ AI memo generation ────────────────────────────────────────────
    const generateMemo = async () => {
        setIsGeneratingMemo(true);
        try {
            const res = await fetch("/api/generate-story", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "季節のご挨拶",
                    brand: "ウトマチ百貨店",
                    features: `宇土・熊本の旬の便りを一文で。「今、〇〇が旬を迎えています」のような短い季節のコメント。50文字以内。`,
                }),
            });
            const data = await res.json();
            if (data.story) setMemo(data.story.split("\n")[0].slice(0, 80));
        } catch {
            setMemo("今、宇土の大地から旬の恵みが届いています。");
        } finally {
            setIsGeneratingMemo(false);
        }
    };

    // ─ PDF Download ─────────────────────────────────────────────────
    const handleDownload = useCallback(async () => {
        if (!previewRef.current) return;
        setIsGenerating(true);
        try {
            const cleanTitle = (docTitle || "document").replace(/\s/g, "");
            const cleanPeriod = (periodLabel || today()).replace(/\//g, "-");
            await generatePdfFromElement(previewRef.current, `${cleanTitle}_${cleanPeriod}.pdf`);
        } catch (err) {
            console.error("Download failed:", err);
        } finally {
            setIsGenerating(false);
        }
    }, [docTitle, periodLabel, previewRef]);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    // ─ Render ──────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[96vh]">

                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: BRAND_LIGHT }}>
                            {isPaymentSummary ? <FileText className="w-5 h-5" style={{ color: BRAND }} /> : <Receipt className="w-5 h-5" style={{ color: BRAND }} />}
                        </div>
                        <div>
                            <div className="font-bold text-slate-900">{isDeliveryNote ? "納品書" : isInvoice ? "請求書" : "支払明細書"} プレビュー</div>
                            <div className="text-xs text-slate-400">{periodLabel}{recipient && ` ／ ${recipient}`}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            印刷
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable preview area */}
                <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">

                    {/* ── AI Memo Controls (outside the printable area) ─── */}
                    <div className="mb-4 flex items-start gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">備考 / 季節のご挨拶（帳票下部に表示）</label>
                            <input
                                type="text"
                                value={memo}
                                onChange={e => setMemo(e.target.value)}
                                placeholder="例: 今、網田のネーブルが色づいています。"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400"
                            />
                        </div>
                        <button
                            onClick={generateMemo}
                            disabled={isGeneratingMemo}
                            className="mt-5 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-white transition-colors disabled:opacity-60 shrink-0"
                            style={{ backgroundColor: BRAND }}
                        >
                            {isGeneratingMemo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            AI生成
                        </button>
                    </div>

                    {/* ── PRINTABLE DOCUMENT ───────────────────────────── */}
                    <div ref={previewRef} className="bg-white shadow-lg mx-auto printable-document" style={{
                        width: "794px", // A4 at 96dpi
                        minHeight: "1123px",
                        padding: "48px 56px",
                        fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', 'MS PMincho', Georgia, serif",
                        color: "#1a1a1a",
                        position: "relative",
                    }}>
                        <style jsx global>{`
                            @media print {
                                body * {
                                    visibility: hidden;
                                }
                                .printable-document, .printable-document * {
                                    visibility: visible;
                                }
                                .printable-document {
                                    position: absolute;
                                    left: 0;
                                    top: 0;
                                    width: 100% !important;
                                    margin: 0 !important;
                                    padding: 48px 56px !important;
                                    box-shadow: none !important;
                                }
                                @page {
                                    size: A4;
                                    margin: 0;
                                }
                            }
                        `}</style>

                        {/* ── Metadata: Top Right ── */}
                        <div style={{
                            position: "absolute", top: "48px", right: "56px",
                            textAlign: "right", fontSize: "11px", color: "#555", lineHeight: "1.6"
                        }}>
                            <div>発行日: {today()}</div>
                            <div style={{ fontWeight: 600 }}>文書番号: {docNumber}</div>
                            {periodLabel && <div>対象期間: {periodLabel}</div>}
                        </div>

                        {/* ── Header: Row 1 (Document Title) ── */}
                        <div style={{
                            textAlign: "center", marginBottom: "32px", padding: "8px 0",
                            borderBottom: `2px solid ${BRAND}`, position: "relative",
                            marginTop: "24px" // Add margin to avoid metadata overlap
                        }}>
                            <h1 style={{
                                fontSize: "32px", fontWeight: "700", letterSpacing: "0.8em", margin: 0,
                                textIndent: "0.8em", color: "#1a1a1a"
                            }}>
                                {docTitle}
                            </h1>
                        </div>

                        {/* ── Header: Row 2 (Recipient) ── */}
                        <div style={{ marginBottom: "32px", display: "flex", justifyContent: "flex-start" }}>
                            {/* Left: Recipient */}
                            <div style={{ flex: 1 }}>
                                {recipientAddress?.address && (
                                    <div style={{ fontSize: "11px", color: "#666", marginBottom: "8px" }}>
                                        {recipientAddress.zipCode && `〒${recipientAddress.zipCode}`}<br />
                                        {recipientAddress.address}
                                        {recipientAddress.tel && <span style={{ marginLeft: "8px" }}>TEL: {recipientAddress.tel}</span>}
                                    </div>
                                )}
                                <div style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "4px", display: "inline-block", minWidth: "320px" }}>
                                    <span style={{ fontSize: "22px", fontWeight: "700" }}>{recipient}</span>
                                    <span style={{ fontSize: "15px", marginLeft: "8px", color: "#333" }}>御中</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Header: Row 3 (Sender Info - Right Aligned & Non-overlapping) ── */}
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
                            <div style={{ position: "relative", minWidth: "360px", textAlign: "right", paddingRight: "60px" }}>

                                {/* Logo area */}
                                <div style={{ height: "48px", marginBottom: "8px", display: "flex", justifyContent: "flex-end" }}>
                                    {companySettings?.logoUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={companySettings.logoUrl} alt="logo" style={{ maxHeight: "100%", maxWidth: "160px" }} />
                                    ) : (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src="/logo.png" alt="logo" style={{ maxHeight: "100%", opacity: 0.8 }} />
                                    )}
                                </div>

                                {/* Company Name and PIC */}
                                <div style={{ textAlign: "right", marginBottom: "8px" }}>
                                    <div style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "0.05em", color: "#1a1a1a", marginBottom: "2px" }}>
                                        {companySettings?.companyName || "ウトマチ百貨店"}
                                    </div>
                                    {companySettings?.picName && (
                                        <div style={{ fontSize: "11px", color: "#444" }}>
                                            担当者：{companySettings.picTitle}　{companySettings.picName}
                                        </div>
                                    )}
                                </div>

                                {/* Company Details */}
                                <div style={{ fontSize: "10px", color: "#555", lineHeight: "1.6", textAlign: "right" }}>
                                    〒{companySettings?.zipCode}　{companySettings?.address}<br />
                                    TEL: {companySettings?.tel}
                                    {companySettings?.fax && <span style={{ marginLeft: "10px" }}>FAX: {companySettings.fax}</span>}<br />
                                    {companySettings?.invoiceNumber && (
                                        <span style={{ fontWeight: 500 }}>登録番号: {companySettings.invoiceNumber}</span>
                                    )}
                                </div>

                                {/* Seal Overlay - Positioned to the right, avoiding overlap with text */}
                                <div style={{
                                    position: "absolute",
                                    right: "0px",
                                    top: "56px",
                                    width: "48px",
                                    height: "48px",
                                    zIndex: 10,
                                    pointerEvents: "none"
                                }}>
                                    {companySettings?.sealUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={companySettings.sealUrl} alt="seal"
                                            style={{ width: "100%", height: "100%", objectFit: "contain", opacity: 0.8 }} />
                                    ) : (
                                        <div style={{
                                            width: "44px", height: "44px", borderRadius: "50%",
                                            border: `1.5px solid ${BRAND}`, color: BRAND, fontSize: "9px",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            textAlign: "center", opacity: 0.4, lineHeight: "1.2"
                                        }}>
                                            印影
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Greeting ── */}
                        <div style={{ fontSize: "11px", color: "#444", marginBottom: "24px", lineHeight: "1.7" }}>
                            {isDeliveryNote
                                ? "下記の通り納品いたしますので、ご確認の上ご査収くださいますようお願い申し上げます。"
                                : isInvoice
                                    ? "下記の通りご請求申し上げます。内容をご確認の上、期日までにお支払いくださいますようお願い申し上げます。"
                                    : "下記の通り仕入れ明細書をお送りいたしますので、内容をご確認くださいますようお願い申し上げます。"
                            }
                        </div>

                        {/* ── Invoice Summary Section (Only for Invoice) ── */}
                        {isInvoice && (
                            <div style={{
                                marginBottom: "32px", padding: "16px 0", borderBottom: "1px solid #eee"
                            }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "32px" }}>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                                        <span style={{ fontSize: "14px", fontWeight: "600", color: "#333" }}>ご請求金額（税込）</span>
                                        <span style={{ fontSize: "28px", fontWeight: "700", color: "#1a1a1a", borderBottom: `3px double ${BRAND}` }}>
                                            ¥{totalWithTax.toLocaleString()}-
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", gap: "20px", fontSize: "12px", color: "#666" }}>
                                        <span>（税抜合計: ¥{subtotal.toLocaleString()}</span>
                                        <span>消費税等: ¥{tax.toLocaleString()}）</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Line items table ── */}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px", fontSize: "12px" }}>
                            <thead>
                                <tr style={{ backgroundColor: BRAND }}>
                                    <th style={{ ...thStyle, width: "40%", textAlign: "left" }}>
                                        {isDeliveryNote || isInvoice ? "商品名" : "商品名 / 入荷日"}
                                    </th>
                                    <th style={{ ...thStyle, width: "8%", textAlign: "center" }}>税率</th>
                                    <th style={{ ...thStyle, width: "12%", textAlign: "right" }}>数量</th>
                                    {!hidePrices && (
                                        <>
                                            <th style={{ ...thStyle, width: "18%", textAlign: "right" }}>
                                                {isDeliveryNote || isInvoice ? "単価" : "仕入単価"}
                                            </th>
                                            <th style={{ ...thStyle, width: "22%", textAlign: "right" }}>小計（税抜）</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {(isDeliveryNote || isInvoice)
                                    ? lineItems.length > 0
                                        ? lineItems.map((item, i) => (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : BRAND_LIGHT }}>
                                                <td style={tdStyle}>{item.name}</td>
                                                <td style={{ ...tdStyle, textAlign: "center", color: item.taxRate === "reduced" ? "#2d7a2d" : "#1e3a8a", fontWeight: 600 }}>
                                                    {item.taxRate === "reduced" ? "8%★" : "10%"}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: "right" }}>{item.qty}</td>
                                                {!hidePrices && (
                                                    <>
                                                        <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(item.unitPrice)}</td>
                                                        <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(item.subtotal)}</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))
                                        : <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#888" }}>対象期間の売上データがありません</td></tr>
                                    : purchaseLines.length > 0
                                        ? purchaseLines.map((item, i) => (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : BRAND_LIGHT }}>
                                                <td style={tdStyle}>
                                                    {item.name}
                                                    <span style={{ color: "#888", fontSize: "11px", marginLeft: "8px" }}>{item.date}</span>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: "center", color: item.taxRate === "reduced" ? "#2d7a2d" : "#1e3a8a", fontWeight: 600 }}>
                                                    {item.taxRate === "reduced" ? "8%★" : "10%"}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: "right" }}>{item.qty}</td>
                                                <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(item.unitCost)}</td>
                                                <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(item.total)}</td>
                                            </tr>
                                        ))
                                        : <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#888" }}>対象月の入荷完了データがありません</td></tr>
                                }
                            </tbody>
                        </table>

                        {/* ── Tax Summary (Hide for Delivery Note) ── */}
                        {!isDeliveryNote && !hidePrices && (
                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                                <table style={{ borderCollapse: "collapse", fontSize: "12px", minWidth: "320px" }}>
                                    <tbody>
                                        {taxSummary.reduced.subtotal > 0 && (<>
                                            <tr>
                                                <td style={summaryLabelStyle}>8%対象（軽減税率★）</td>
                                                <td style={{ ...summaryValueStyle }}>{fmtMoney(taxSummary.reduced.subtotal)}</td>
                                            </tr>
                                            <tr>
                                                <td style={summaryLabelStyle}>　消費税（8%）</td>
                                                <td style={summaryValueStyle}>{fmtMoney(taxSummary.reduced.taxAmount)}</td>
                                            </tr>
                                        </>)}
                                        {taxSummary.standard.subtotal > 0 && (<>
                                            <tr>
                                                <td style={summaryLabelStyle}>10%対象（標準税率）</td>
                                                <td style={summaryValueStyle}>{fmtMoney(taxSummary.standard.subtotal)}</td>
                                            </tr>
                                            <tr>
                                                <td style={summaryLabelStyle}>　消費税（10%）</td>
                                                <td style={summaryValueStyle}>{fmtMoney(taxSummary.standard.taxAmount)}</td>
                                            </tr>
                                        </>)}
                                        <tr>
                                            <td style={{ ...summaryLabelStyle, fontWeight: 700, fontSize: "14px", backgroundColor: BRAND_LIGHT, color: BRAND_DARK, borderTop: `2px solid ${BRAND}` }}>
                                                合計（税込）
                                            </td>
                                            <td style={{ ...summaryValueStyle, fontWeight: 700, fontSize: "14px", backgroundColor: BRAND_LIGHT, color: BRAND_DARK, borderTop: `2px solid ${BRAND}` }}>
                                                {fmtMoney(taxSummary.grandTotal)}
                                            </td>
                                        </tr>

                                        {/* Adjustments row in preview if exists */}
                                        {customAdjustments && customAdjustments.map((adj: any) => (
                                            <tr key={adj.id}>
                                                <td style={{ ...summaryLabelStyle, color: BRAND_DARK, fontSize: '11px' }}>調整：{adj.label}</td>
                                                <td style={{ ...summaryValueStyle, color: BRAND_DARK, fontSize: '11px' }}>{adj.amount > 0 ? "+" : ""}{fmtMoney(adj.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ── Bank Info ── */}
                        {(isInvoice || isPaymentSummary) && (
                            <div style={{ marginTop: "40px", borderTop: `1px solid #eee`, paddingTop: "24px" }}>
                                <div style={{ fontSize: "12px", fontWeight: "700", color: "#333", marginBottom: "12px" }}>【お振込先】</div>
                                <div style={{ display: "flex", gap: "40px" }}>
                                    {/* Bank 1 */}
                                    <div style={{ flex: 1, padding: "12px", backgroundColor: "#fcfcfc", border: "1px solid #eee", borderRadius: "4px" }}>
                                        <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px", fontWeight: "600" }}>第1口座</div>
                                        <div style={{ fontSize: "12px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
                                            {companySettings?.bankName}　{companySettings?.bankBranch}
                                        </div>
                                        <div style={{ fontSize: "13px", color: "#333", display: "flex", gap: "10px", marginBottom: "4px" }}>
                                            <span>{companySettings?.bankAccountType}</span>
                                            <span style={{ letterSpacing: "0.05em", fontWeight: "600" }}>{companySettings?.bankAccountNumber}</span>
                                        </div>
                                        <div style={{ fontSize: "11px", color: "#555" }}>
                                            口座名義：{companySettings?.bankAccountHolder}
                                        </div>
                                    </div>

                                    {/* Bank 2 (Optional) */}
                                    {companySettings?.bankName2 && (
                                        <div style={{ flex: 1, padding: "12px", backgroundColor: "#fcfcfc", border: "1px solid #eee", borderRadius: "4px" }}>
                                            <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px", fontWeight: "600" }}>第2口座</div>
                                            <div style={{ fontSize: "12px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
                                                {companySettings?.bankName2}　{companySettings?.bankBranch2}
                                            </div>
                                            <div style={{ fontSize: "13px", color: "#333", display: "flex", gap: "10px", marginBottom: "4px" }}>
                                                <span>{companySettings?.bankAccountType2}</span>
                                                <span style={{ letterSpacing: "0.05em", fontWeight: "600" }}>{companySettings?.bankAccountNumber2}</span>
                                            </div>
                                            <div style={{ fontSize: "11px", color: "#555" }}>
                                                口座名義：{companySettings?.bankAccountHolder2}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginTop: "12px", fontSize: "11px", color: "#444" }}>
                                    ※お振込み手数料は御社ご負担でお願いします。
                                </div>
                            </div>
                        )}

                        {/* ── Memo/Seasonal greeting ── */}
                        {memo && (
                            <div style={{ marginTop: "24px", padding: "10px 14px", borderLeft: `3px solid ${BRAND}`, fontSize: "11px", color: "#555", lineHeight: "1.8" }}>
                                <div style={{ fontWeight: 700, marginBottom: "2px", color: BRAND_DARK }}>備考</div>
                                {memo}
                            </div>
                        )}

                        {/* ── Tax note ── */}
                        {(taxSummary.reduced.subtotal > 0) && (
                            <div style={{ marginTop: "16px", fontSize: "10px", color: "#888" }}>
                                ★ 軽減税率（8%）対象品目
                            </div>
                        )}

                        {/* ── Footer ── */}
                        <div style={{
                            position: "absolute", bottom: "32px", left: "56px", right: "56px",
                            display: "flex", justifyContent: "space-between", alignItems: "flex-end",
                            borderTop: `1px solid ${BRAND}`, paddingTop: "12px"
                        }}>
                            <div style={{ fontSize: "11px", color: "#888", fontStyle: "italic", letterSpacing: "0.05em" }}>
                                ヒトとモノをつなぐ架け橋、ウトマチ百貨店
                            </div>
                            <div style={{ fontSize: "10px", color: "#aaa" }}>
                                {companySettings?.companyName}
                            </div>
                        </div>
                    </div>
                    {/* ── End Printable Document ── */}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
                    <p className="text-xs text-slate-400">プレビューを確認後、PDFをダウンロードしてください。</p>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                            閉じる
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-all disabled:opacity-60"
                            style={{ backgroundColor: BRAND }}
                        >
                            {isGenerating
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</>
                                : <><Download className="w-4 h-4" /> PDFをダウンロード</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    color: "#fff",
    fontWeight: 600,
    fontSize: "11px",
    letterSpacing: "0.03em",
};

const tdStyle: React.CSSProperties = {
    padding: "7px 10px",
    borderBottom: "1px solid #e5e5e5",
    fontSize: "12px",
};

const summaryLabelStyle: React.CSSProperties = {
    padding: "5px 12px 5px 8px",
    textAlign: "left",
    color: "#444",
    borderBottom: "1px solid #e5e5e5",
};

const summaryValueStyle: React.CSSProperties = {
    padding: "5px 8px",
    textAlign: "right",
    borderBottom: "1px solid #e5e5e5",
    minWidth: "100px",
};
