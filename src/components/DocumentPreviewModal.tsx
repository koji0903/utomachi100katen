"use client";

import { useRef, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { summarizeTaxByRate, TAX_RATE_LABELS } from "@/lib/taxUtils";
import { generatePdfFromElement } from "@/lib/pdfGenerator";
import { X, Download, Loader2, Sparkles, FileText, Receipt } from "lucide-react";

// ─── Brand token ─────────────────────────────────────────────────────────
const BRAND = "#b27f79";
const BRAND_LIGHT = "#f5eeee";
const BRAND_DARK = "#8b5c57";

// ─── Props ───────────────────────────────────────────────────────────────
export type DocumentType = "delivery_note" | "payment_summary";

interface DocumentPreviewModalProps {
    type: DocumentType;
    // For delivery_note: storeId + period
    storeId?: string;
    period?: string;   // YYYY-MM or YYYY-MM-DD
    // For payment_summary: supplierId + month
    supplierId?: string;
    month?: string;    // YYYY-MM
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
    onClose,
}: DocumentPreviewModalProps) {
    const { companySettings, sales, products, retailStores, purchases, suppliers } = useStore();
    const previewRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [memo, setMemo] = useState("");
    const [isGeneratingMemo, setIsGeneratingMemo] = useState(false);

    const rounding = companySettings?.roundingMode ?? "floor";

    // ─ Compute document data ────────────────────────────────────────────
    const isDeliveryNote = type === "delivery_note";

    // --- Delivery Note: aggregate sales items for store+period ---
    type LineItem = { name: string; qty: number; unitPrice: number; subtotal: number; taxRate: "standard" | "reduced" };

    const lineItems: LineItem[] = (() => {
        if (!isDeliveryNote) return [];
        const filtered = sales.filter(s => {
            const matchStore = storeId ? s.storeId === storeId : true;
            const matchPeriod = period ? s.period.startsWith(period) : true;
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

    // --- Payment Summary: aggregate purchases for supplier+month ---
    type PurchaseLine = { name: string; qty: number; unitCost: number; total: number; date: string; taxRate: "standard" | "reduced" };

    const purchaseLines: PurchaseLine[] = (() => {
        if (isDeliveryNote) return [];
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
    const taxSummary = isDeliveryNote
        ? summarizeTaxByRate(lineItems.map(i => ({ amount: i.subtotal, rateType: i.taxRate })), rounding)
        : summarizeTaxByRate(purchaseLines.map(i => ({ amount: i.total, rateType: i.taxRate })), rounding);

    // ─ Names ──────────────────────────────────────────────────────────
    const store = retailStores.find(s => s.id === storeId);
    const supplier = suppliers.find(s => s.id === supplierId);

    const recipientName = isDeliveryNote ? (store?.name ?? "（店舗名）") : (supplier?.name ?? "（仕入先名）");
    const docTitle = isDeliveryNote ? "納　品　書" : "支 払 明 細 書";
    const docNumber = `${isDeliveryNote ? "DN" : "PM"}-${Date.now().toString().slice(-8)}`;
    const periodLabel = (() => {
        if (isDeliveryNote && period) {
            if (period.length === 7) return `${period.slice(0, 4)}年${parseInt(period.slice(5))}月分`;
            return period;
        }
        if (!isDeliveryNote && month) return `${month.slice(0, 4)}年${parseInt(month.slice(5))}月分`;
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
            await generatePdfFromElement(previewRef.current, `${docTitle.replace(/\s/g, "")}_${periodLabel}.pdf`);
        } finally {
            setIsGenerating(false);
        }
    }, [docTitle, periodLabel]);

    // ─ Render ──────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[96vh]">

                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: BRAND_LIGHT }}>
                            {isDeliveryNote ? <Receipt className="w-5 h-5" style={{ color: BRAND }} /> : <FileText className="w-5 h-5" style={{ color: BRAND }} />}
                        </div>
                        <div>
                            <div className="font-bold text-slate-900">{isDeliveryNote ? "納品書" : "支払明細書"} プレビュー</div>
                            <div className="text-xs text-slate-400">{periodLabel}{recipientName && ` ／ ${recipientName}`}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
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
                    <div ref={previewRef} className="bg-white shadow-lg mx-auto" style={{
                        width: "794px", // A4 at 96dpi
                        minHeight: "1123px",
                        padding: "48px 56px",
                        fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', 'MS PMincho', Georgia, serif",
                        color: "#1a1a1a",
                        position: "relative",
                    }}>

                        {/* ── Header ── */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
                            {/* Left: Logo area */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                {companySettings?.logoUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={companySettings.logoUrl} alt="logo" style={{ maxHeight: "70px", maxWidth: "200px", objectFit: "contain" }} />
                                ) : (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src="/logo.png" alt="UTOMACHI 100 KATEN" style={{ maxHeight: "70px", maxWidth: "180px", objectFit: "contain" }} />
                                )}
                                <div style={{ fontSize: "10px", color: "#666", marginTop: "6px", lineHeight: "1.7" }}>
                                    〒{companySettings?.zipCode}<br />
                                    {companySettings?.address}<br />
                                    TEL: {companySettings?.tel}
                                </div>
                                {companySettings?.invoiceNumber && (
                                    <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
                                        登録番号: {companySettings.invoiceNumber}
                                    </div>
                                )}
                            </div>

                            {/* Right: Title + Seal area */}
                            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                                <div style={{
                                    fontSize: "26px", fontWeight: "700", letterSpacing: "0.2em",
                                    color: "#1a1a1a", borderBottom: `3px solid ${BRAND}`, paddingBottom: "8px", marginBottom: "8px"
                                }}>
                                    {docTitle}
                                </div>
                                <div style={{ fontSize: "11px", color: "#555" }}>
                                    <div>発行日: {today()}</div>
                                    <div>文書番号: {docNumber}</div>
                                    {periodLabel && <div>対象期間: {periodLabel}</div>}
                                </div>
                                {/* Seal placeholder */}
                                <div style={{ position: "relative", width: "64px", height: "64px", marginTop: "4px" }}>
                                    {companySettings?.sealUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={companySettings.sealUrl} alt="seal"
                                            style={{ width: "64px", height: "64px", opacity: 0.85, objectFit: "contain" }} />
                                    ) : (
                                        <div style={{
                                            width: "64px", height: "64px", borderRadius: "50%",
                                            border: `2px solid ${BRAND}`, color: BRAND, fontSize: "9px",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            textAlign: "center", opacity: 0.6, lineHeight: "1.3"
                                        }}>
                                            印<br />影
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Recipient ── */}
                        <div style={{ marginBottom: "28px" }}>
                            <span style={{ fontSize: "18px", fontWeight: "700", borderBottom: `2px solid #1a1a1a`, paddingBottom: "2px" }}>
                                {recipientName}
                            </span>
                            <span style={{ fontSize: "15px", marginLeft: "4px", color: "#333" }}>御中</span>
                        </div>

                        {/* ── Greeting line ── */}
                        <div style={{ fontSize: "12px", color: "#444", marginBottom: "24px", lineHeight: "1.8" }}>
                            いつも格別のお引き立てを賜り、厚く御礼申し上げます。<br />
                            {isDeliveryNote
                                ? "下記の通り納品いたしますので、ご確認の上ご査収くださいますようお願い申し上げます。"
                                : "下記の通り、仕入れ代金のご請求（お支払い明細）をご確認くださいますようお願い申し上げます。"
                            }
                        </div>

                        {/* ── Line items table ── */}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px", fontSize: "12px" }}>
                            <thead>
                                <tr style={{ backgroundColor: BRAND }}>
                                    <th style={{ ...thStyle, width: "40%", textAlign: "left" }}>
                                        {isDeliveryNote ? "商品名" : "商品名 / 入荷日"}
                                    </th>
                                    <th style={{ ...thStyle, width: "8%", textAlign: "center" }}>税率</th>
                                    <th style={{ ...thStyle, width: "12%", textAlign: "right" }}>数量</th>
                                    <th style={{ ...thStyle, width: "18%", textAlign: "right" }}>
                                        {isDeliveryNote ? "単価" : "仕入単価"}
                                    </th>
                                    <th style={{ ...thStyle, width: "22%", textAlign: "right" }}>小計（税抜）</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isDeliveryNote
                                    ? lineItems.length > 0
                                        ? lineItems.map((item, i) => (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : BRAND_LIGHT }}>
                                                <td style={tdStyle}>{item.name}</td>
                                                <td style={{ ...tdStyle, textAlign: "center", color: item.taxRate === "reduced" ? "#2d7a2d" : "#1e3a8a", fontWeight: 600 }}>
                                                    {item.taxRate === "reduced" ? "8%★" : "10%"}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: "right" }}>{item.qty}</td>
                                                <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(item.unitPrice)}</td>
                                                <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(item.subtotal)}</td>
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

                        {/* ── Tax Summary ── */}
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
                                </tbody>
                            </table>
                        </div>

                        {/* ── Bank info (for payment summaries) ── */}
                        {!isDeliveryNote && (companySettings?.bankName || companySettings?.bankAccountNumber) && (
                            <div style={{
                                marginTop: "20px", padding: "12px 16px", border: `1px solid ${BRAND}`,
                                borderRadius: "6px", backgroundColor: BRAND_LIGHT, fontSize: "11px", lineHeight: "1.8"
                            }}>
                                <div style={{ fontWeight: 700, marginBottom: "4px", color: BRAND_DARK }}>振込先口座</div>
                                <div>
                                    {companySettings.bankName} {companySettings.bankBranch} {companySettings.bankAccountType}
                                    口座番号: {companySettings.bankAccountNumber}
                                </div>
                                <div>口座名義: {companySettings.bankAccountHolder}</div>
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
