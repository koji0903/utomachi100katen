"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useStore, IssuedDocument } from "@/lib/store";
import { summarizeTaxByRate } from "@/lib/taxUtils";
import { downloadPdfFromElement as generatePdfFromElement, getPdfBlobFromElement } from "@/lib/pdfGenerator";
import { uploadImageWithCompression } from "@/lib/imageUpload";
import { AIPromptDisplay } from "./AIPromptDisplay";
import { generateStoryPrompt } from "@/lib/aiPromptUtils";
import { X, Download, Printer, Loader2, Sparkles, FileText, Save } from "lucide-react";
import { apiFetch, DemoModeError } from "@/lib/apiClient";

// ─── Brand token ─────────────────────────────────────────────────────────
const BRAND = "#b27f79";
const BRAND_LIGHT = "#f5eeee";
const BRAND_DARK = "#8b5c57";

interface ProxyInvoicePreviewModalProps {
    supplierId: string;
    period?: string;   // YYYY-MM-DD
    docNumber?: string;
    customDetails?: IssuedDocument['details'];
    customAdjustments?: IssuedDocument['adjustments'];
    customTaxRate?: IssuedDocument['taxRate'];
    customTaxType?: IssuedDocument['taxType'];
    autoDownload?: boolean;
    onClose: () => void;
}

const fmtMoney = (n: number) => `¥${n.toLocaleString()}`;
const today = () => {
    const d = new Date();
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

export function ProxyInvoicePreviewModal({
    supplierId,
    period,
    docNumber: propDocNumber,
    customDetails,
    customAdjustments,
    customTaxRate,
    customTaxType,
    autoDownload = false,
    onClose,
}: ProxyInvoicePreviewModalProps) {
    const { companySettings, suppliers, isLoaded, issuedDocuments, updateIssuedDocument, addPrintArchive } = useStore();
    
    const previewRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [memo, setMemo] = useState("ご請求申し上げます。");

    if (!isLoaded) return <div className="p-8 text-slate-500 animate-pulse">読み込み中...</div>;

    const rounding = companySettings?.roundingMode ?? "floor";

    // ─── Document Data ───────────────────────────────────────────────────
    const lineItems = customDetails?.map((d: any) => ({
        name: d.label,
        qty: d.quantity,
        unitPrice: d.unitPrice,
        subtotal: d.subtotal,
        taxRate: d.taxRate || (customTaxRate === 8 ? 'reduced' : 'standard'),
        remarks: d.remarks || ""
    })) || [];

    const taxType = customTaxType || 'inclusive';

    const taxSummary = summarizeTaxByRate(lineItems.map(i => ({
        amount: i.subtotal,
        rateType: customTaxRate ? (customTaxRate === 8 ? 'reduced' : 'standard') : i.taxRate as any
    })), rounding, taxType);

    if (customAdjustments && customAdjustments.length > 0) {
        const adjTotal = customAdjustments.reduce((sum: number, a: any) => sum + a.amount, 0);
        taxSummary.grandTotal += adjTotal;
    }

    const totalWithTax = taxSummary.grandTotal;
    const subtotal = taxSummary.standard.subtotal + taxSummary.reduced.subtotal;
    const tax = taxSummary.totalTax;

    // ─── Names (Reversed) ────────────────────────────────────────────────
    const supplier = suppliers.find(s => s.id === supplierId);
    
    // 宛名（左上）: うとまち百貨店（CompanySettings）
    const recipientName = companySettings?.companyName || "ウトマチ百貨店";
    
    // 発行元（右上）: Supplier（農家さん）
    const senderName = supplier?.name || "（仕入先名）";

    const docTitle = "請　求　書";
    const docNumber = propDocNumber || `P-INV-${Date.now().toString().slice(-8)}`;

    const periodLabel = period ? period.replace(/-/g, "/") : today();

    // ─── PDF Functions ───────────────────────────────────────────────────
    const handleDownload = useCallback(async () => {
        if (!previewRef.current) return;
        setIsGenerating(true);
        try {
            const cleanPeriod = (periodLabel || today()).replace(/\//g, "-");
            await generatePdfFromElement(previewRef.current, `請求書(代行)_${senderName}_${cleanPeriod}.pdf`);
        } catch (err) {
            console.error("Download failed:", err);
        } finally {
            setIsGenerating(false);
        }
    }, [senderName, periodLabel, previewRef]);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    const handleIssueAndSave = async () => {
        if (!previewRef.current) return;
        setIsGenerating(true);
        try {
            const pdfBlob = await getPdfBlobFromElement(previewRef.current);
            const pdfFile = new File([pdfBlob], `${docNumber}.pdf`, { type: "application/pdf" });
            
            const pdfUrl = await uploadImageWithCompression(pdfFile, "invoices");
            
            const targetDoc = issuedDocuments.find(d => d.docNumber === docNumber);
            if (targetDoc) {
                await updateIssuedDocument(targetDoc.id, { 
                    status: 'issued',
                    pdfUrl: pdfUrl 
                });
                
                // 帳票アーカイブにも登録する
                if (addPrintArchive) {
                    await addPrintArchive({
                        title: `請求書(代行) ${senderName} - ${periodLabel}`,
                        category: "請求書",
                        fileName: `${docNumber}.pdf`,
                        fileUrl: pdfUrl,
                        storagePath: `invoices/${docNumber}.pdf`,
                        tags: ["代行請求", senderName],
                        memo: "システムにより代行作成された請求書です。"
                    });
                }
                
                alert("代行請求書を発行し、帳票アーカイブに保存しました。");
            }
        } catch (err: any) {
            console.error("Issue and Save failed:", err);
            alert("発行処理に失敗しました: " + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (autoDownload && isLoaded && previewRef.current) {
            const timer = setTimeout(async () => {
                await handleDownload();
                onClose();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [autoDownload, isLoaded, handleDownload, onClose]);

    // ─── Styles ──────────────────────────────────────────────────────────
    const thStyle = { padding: "8px", borderBottom: `2px solid ${BRAND}`, color: "#fff", fontWeight: 600 };
    const tdStyle = { padding: "8px", borderBottom: "1px solid #ddd", color: "#333" };
    const summaryLabelStyle = { padding: "4px 12px", textAlign: "right" as const, color: "#666" };
    const summaryValueStyle = { padding: "4px 12px", textAlign: "right" as const, minWidth: "120px" };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[96vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: BRAND_LIGHT }}>
                            <FileText className="w-5 h-5" style={{ color: BRAND }} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-900">代行請求書 プレビュー</div>
                            <div className="text-xs text-slate-400">発行元: {senderName}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                            <Printer className="w-3.5 h-3.5" /> 印刷
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
                    <div className="mb-4 flex items-start gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">備考 / 宛先へのメッセージ（帳票下部に表示）</label>
                            <input
                                type="text"
                                value={memo}
                                onChange={e => setMemo(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400"
                            />
                        </div>
                    </div>

                    <div ref={previewRef} className="bg-white shadow-lg mx-auto printable-document" style={{
                        width: "210mm", minHeight: "297mm", padding: "15mm 20mm",
                        fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', 'MS PMincho', Georgia, serif",
                        letterSpacing: "0.05em", lineHeight: "1.6", color: "#1a1a1a", position: "relative", boxSizing: "border-box",
                    }}>
                        <style jsx global>{`
                            @media print {
                                @page { size: A4; margin: 0; }
                                html, body { margin: 0 !important; padding: 0 !important; width: 210mm !important; height: auto !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                                body * { visibility: hidden !important; }
                                .printable-document, .printable-document * { visibility: visible !important; }
                                .printable-document { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; min-height: 297mm !important; margin: 0 !important; padding: 15mm 20mm !important; box-shadow: none !important; background: white !important; box-sizing: border-box !important; page-break-after: always; }
                                .printable-document table tr { page-break-inside: avoid; break-inside: avoid; }
                            }
                        `}</style>

                        <div style={{ display: "flex", flexDirection: "column", marginBottom: "12px" }}>
                            <div style={{ textAlign: "right", fontSize: "11px", color: "#555", lineHeight: "1.6", marginBottom: "4px" }}>
                                <div>発行日: {periodLabel}</div>
                                <div style={{ fontWeight: 600 }}>請求書番号: {docNumber}</div>
                            </div>
                            <div style={{ textAlign: "center", padding: "6px 0", borderBottom: `2px solid ${BRAND}`, marginBottom: "20px" }}>
                                <h1 style={{ fontSize: "28px", fontWeight: "700", letterSpacing: "0.8em", margin: 0, textIndent: "0.8em", color: "#1a1a1a" }}>{docTitle}</h1>
                            </div>
                        </div>

                        {/* 宛名（左）: CompanySettings */}
                        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "11px", color: "#666", marginBottom: "8px" }}>
                                    {companySettings?.zipCode && `〒${companySettings.zipCode}`}<br />
                                    {companySettings?.address}
                                </div>
                                <div style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "4px", display: "inline-block", minWidth: "320px" }}>
                                    <span style={{ fontSize: "22px", fontWeight: "700" }}>{recipientName}</span>
                                    <span style={{ fontSize: "15px", marginLeft: "8px", color: "#333" }}>御中</span>
                                </div>
                            </div>
                        </div>

                        {/* 発行元（右）: Supplier */}
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "15px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>{senderName}</div>
                                <div style={{ fontSize: "11px", color: "#555", lineHeight: "1.5" }}>
                                    {supplier?.zipCode && `〒${supplier.zipCode}`}<br />
                                    {supplier?.address}<br />
                                    {supplier?.tel && `TEL: ${supplier.tel}`}<br />
                                    {supplier?.invoiceNumber && <span style={{ fontWeight: 600 }}>登録番号: {supplier.invoiceNumber}</span>}
                                </div>
                            </div>
                        </div>

                        <div style={{ fontSize: "11px", color: "#444", marginBottom: "12px", lineHeight: "1.7" }}>
                            下記の通りご請求申し上げます。
                        </div>

                        <div style={{ marginBottom: "16px", padding: "8px 0", borderBottom: "1px solid #eee" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "32px" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#333" }}>ご請求金額（税込）</span>
                                    <span style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a", borderBottom: `3px double ${BRAND}` }}>¥{totalWithTax.toLocaleString()}-</span>
                                </div>
                                <div style={{ display: "flex", gap: "20px", fontSize: "11px", color: "#666" }}>
                                    <span>（税抜合計: ¥{subtotal.toLocaleString()}</span>
                                    <span>消費税等: ¥{tax.toLocaleString()}）</span>
                                </div>
                            </div>
                        </div>

                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px", fontSize: "12px" }}>
                            <thead>
                                <tr style={{ backgroundColor: BRAND }}>
                                    <th style={{ ...thStyle, width: "30%", textAlign: "left" }}>品目</th>
                                    <th style={{ ...thStyle, width: "8%", textAlign: "center" }}>税率</th>
                                    <th style={{ ...thStyle, width: "10%", textAlign: "right" }}>数量</th>
                                    <th style={{ ...thStyle, width: "15%", textAlign: "right" }}>単価</th>
                                    <th style={{ ...thStyle, width: "17%", textAlign: "right" }}>金額</th>
                                    <th style={{ ...thStyle, width: "20%", textAlign: "left" }}>備考</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((item, i) => (
                                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : BRAND_LIGHT }}>
                                        <td style={{ ...tdStyle }}>{item.name}</td>
                                        <td style={{ ...tdStyle, textAlign: "center", color: item.taxRate === "reduced" ? "#2d7a2d" : "#1e3a8a", fontWeight: 600 }}>
                                            {item.taxRate === "reduced" ? "8%" : "10%"}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: "right" }}>{item.qty}</td>
                                        <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(item.unitPrice)}</td>
                                        <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(item.subtotal)}</td>
                                        <td style={{ ...tdStyle, textAlign: "left", fontSize: "10px", color: "#666" }}>{item.remarks}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="summary-table" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px", breakInside: "avoid", pageBreakInside: "avoid" }}>
                            <table style={{ borderCollapse: "collapse", fontSize: "12px", minWidth: "320px" }}>
                                <tbody>
                                    {taxSummary.reduced.subtotal > 0 && (<>
                                        <tr><td style={summaryLabelStyle}>8%対象</td><td style={{ ...summaryValueStyle }}>{fmtMoney(taxSummary.reduced.subtotal)}</td></tr>
                                        <tr><td style={summaryLabelStyle}>　消費税（8%）</td><td style={summaryValueStyle}>{fmtMoney(taxSummary.reduced.taxAmount)}</td></tr>
                                    </>)}
                                    {taxSummary.standard.subtotal > 0 && (<>
                                        <tr><td style={summaryLabelStyle}>10%対象</td><td style={summaryValueStyle}>{fmtMoney(taxSummary.standard.subtotal)}</td></tr>
                                        <tr><td style={summaryLabelStyle}>　消費税（10%）</td><td style={summaryValueStyle}>{fmtMoney(taxSummary.standard.taxAmount)}</td></tr>
                                    </>)}
                                    <tr>
                                        <td style={{ ...summaryLabelStyle, fontWeight: 700, fontSize: "14px", backgroundColor: BRAND_LIGHT, color: BRAND_DARK, borderTop: `2px solid ${BRAND}` }}>合計（税込）</td>
                                        <td style={{ ...summaryValueStyle, fontWeight: 700, fontSize: "14px", backgroundColor: BRAND_LIGHT, color: BRAND_DARK, borderTop: `2px solid ${BRAND}` }}>{fmtMoney(taxSummary.grandTotal)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {supplier?.bankInfo && (
                            <div className="bank-info" style={{ marginTop: "40px", borderTop: `1px solid #eee`, paddingTop: "24px", breakInside: "avoid", pageBreakInside: "avoid" }}>
                                <div style={{ fontSize: "12px", fontWeight: "700", color: "#333", marginBottom: "12px" }}>【お振込先】</div>
                                <div style={{ flex: 1, padding: "12px", backgroundColor: "#fcfcfc", border: "1px solid #eee", borderRadius: "4px", maxWidth: "320px" }}>
                                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
                                        {supplier.bankInfo.bankName}　{supplier.bankInfo.branchName}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "#333", display: "flex", gap: "10px", marginBottom: "4px" }}>
                                        <span>{supplier.bankInfo.accountType}</span>
                                        <span style={{ letterSpacing: "0.05em", fontWeight: "600" }}>{supplier.bankInfo.accountNumber}</span>
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#555" }}>口座名義：{supplier.bankInfo.accountHolder}</div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: "40px", fontSize: "10px", color: "#666", borderTop: "1px solid #eee", paddingTop: "12px" }}>
                            {memo && <div>備考：{memo}</div>}
                            <div style={{ marginTop: "8px" }}>本請求書は代行作成されたものです。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
