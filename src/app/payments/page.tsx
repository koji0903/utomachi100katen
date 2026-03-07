"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PaymentDetailModal } from "@/components/PaymentDetailModal";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import {
    CreditCard, ChevronLeft, ChevronRight, Download,
    CheckCircle, Clock, Building2, Wheat, Filter, Eye, FileText
} from "lucide-react";

type CategoryFilter = "all" | "Manufacturer" | "Producer";

export default function PaymentsPage() {
    const { isLoaded, suppliers, purchases, products, paymentRecords, upsertPaymentRecord } = useStore();

    // Default to current month
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
    const [detailModal, setDetailModal] = useState<{ supplierId: string; supplierName: string } | null>(null);
    const [pdfModal, setPdfModal] = useState<{ supplierId: string } | null>(null);

    if (!isLoaded) return <div className="p-8 text-slate-500">読み込み中...</div>;

    // Navigate month
    const changeMonth = (delta: number) => {
        const [y, m] = selectedMonth.split("-").map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    };
    const [year, month] = selectedMonth.split("-");
    const displayMonth = `${year}年${parseInt(month)}月`;

    // Filter completed shipments in selected month
    const monthShipments = purchases.filter(p => {
        if (p.status !== "completed") return false;
        const dateStr = p.arrivalDate || p.orderDate;
        return dateStr?.startsWith(selectedMonth);
    });

    // Group by supplier
    type SupplierRow = {
        supplierId: string;
        name: string;
        category?: "Manufacturer" | "Producer";
        total: number;
        shipmentCount: number;
        paymentTerms?: { closingDay?: number; paymentDay?: number };
        bankInfo?: { bankName?: string; branchName?: string; accountType?: string; accountNumber?: string; accountHolder?: string };
        status: "unpaid" | "paid";
        paidDate?: string;
    };

    const rowMap = new Map<string, SupplierRow>();
    for (const ship of monthShipments) {
        const sup = suppliers.find(s => s.id === ship.supplierId);
        if (!sup) continue;
        if (categoryFilter !== "all" && sup.category !== categoryFilter) continue;
        if (!rowMap.has(ship.supplierId)) {
            const record = paymentRecords.find(pr => pr.supplierId === ship.supplierId && pr.month === selectedMonth);
            rowMap.set(ship.supplierId, {
                supplierId: ship.supplierId,
                name: sup.name,
                category: sup.category,
                paymentTerms: sup.paymentTerms,
                bankInfo: sup.bankInfo,
                total: 0,
                shipmentCount: 0,
                status: record?.status || "unpaid",
                paidDate: record?.paidDate,
            });
        }
        const row = rowMap.get(ship.supplierId)!;
        row.total += ship.totalCost;
        row.shipmentCount += 1;
    }
    const rows = Array.from(rowMap.values()).sort((a, b) => b.total - a.total);

    // Totals by category
    const manufacturerTotal = rows.filter(r => r.category === "Manufacturer").reduce((s, r) => s + r.total, 0);
    const producerTotal = rows.filter(r => r.category === "Producer").reduce((s, r) => s + r.total, 0);
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    const unpaidTotal = rows.filter(r => r.status === "unpaid").reduce((s, r) => s + r.total, 0);

    const handleToggleStatus = async (row: SupplierRow) => {
        const newStatus = row.status === "unpaid" ? "paid" : "unpaid";
        const update: { status: "paid" | "unpaid"; paidDate?: string } = { status: newStatus };
        if (newStatus === "paid") {
            update.paidDate = new Date().toISOString().split("T")[0];
        } else {
            update.paidDate = undefined;
        }
        await upsertPaymentRecord(row.supplierId, selectedMonth, update);
    };

    // CSV export
    const handleExportCSV = () => {
        const header = ["仕入先名", "カテゴリー", "銀行名", "支店名", "口座種別", "口座番号", "口座名義", "支払金額", "ステータス", "支払日"];
        const csvRows = rows.map(r => [
            r.name,
            r.category === "Manufacturer" ? "委託製造業者" : r.category === "Producer" ? "一次生産者" : "未設定",
            r.bankInfo?.bankName || "",
            r.bankInfo?.branchName || "",
            r.bankInfo?.accountType || "",
            r.bankInfo?.accountNumber || "",
            r.bankInfo?.accountHolder || "",
            r.total.toString(),
            r.status === "paid" ? "支払済" : "未払い",
            r.paidDate || "",
        ]);
        const csv = [header, ...csvRows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
        const bom = "\uFEFF";
        const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `支払い一覧_${selectedMonth}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const categoryBadge = (category?: "Manufacturer" | "Producer") => {
        if (category === "Manufacturer") return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                <Building2 className="w-2.5 h-2.5" /> 委託製造
            </span>
        );
        if (category === "Producer") return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                <Wheat className="w-2.5 h-2.5" /> 一次生産者
            </span>
        );
        return <span className="text-xs text-slate-400 italic">未設定</span>;
    };

    const detailShipments = detailModal
        ? monthShipments.filter(s => s.supplierId === detailModal.supplierId)
        : [];

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">支払い管理</h1>
                        <p className="text-slate-500 mt-1 text-sm">月次・仕入先別の支払い集計と状況管理を行います。</p>
                    </div>
                </div>
                <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">CSVダウンロード</span>
                    <span className="sm:hidden">CSV</span>
                </button>
            </div>

            {/* Month Selector + Category Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                    <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-base font-bold text-slate-900 min-w-[120px] text-center">{displayMonth}</span>
                    <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    {(["all", "Manufacturer", "Producer"] as CategoryFilter[]).map(cat => (
                        <button key={cat} onClick={() => setCategoryFilter(cat)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${categoryFilter === cat ? "bg-violet-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                            {cat === "all" ? "すべて" : cat === "Manufacturer" ? "委託製造業者" : "一次生産者"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs text-slate-500 font-medium mb-1">今月の支払総額</div>
                    <div className="text-xl font-bold text-slate-900">¥{grandTotal.toLocaleString()}</div>
                </div>
                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 shadow-sm">
                    <div className="text-xs text-amber-600 font-medium mb-1">未払い残高</div>
                    <div className="text-xl font-bold text-amber-700">¥{unpaidTotal.toLocaleString()}</div>
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 shadow-sm">
                    <div className="text-xs text-blue-600 font-medium mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> 委託製造業者</div>
                    <div className="text-xl font-bold text-blue-700">¥{manufacturerTotal.toLocaleString()}</div>
                </div>
                <div className="bg-green-50 rounded-xl border border-green-100 p-4 shadow-sm">
                    <div className="text-xs text-green-600 font-medium mb-1 flex items-center gap-1"><Wheat className="w-3 h-3" /> 一次生産者</div>
                    <div className="text-xl font-bold text-green-700">¥{producerTotal.toLocaleString()}</div>
                </div>
            </div>

            {/* Main Table — Desktop */}
            <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide bg-slate-50/50">
                                <th className="px-5 py-4 font-semibold">仕入先</th>
                                <th className="px-5 py-4 font-semibold">支払条件</th>
                                <th className="px-5 py-4 font-semibold text-right">仕入件数</th>
                                <th className="px-5 py-4 font-semibold text-right">支払金額</th>
                                <th className="px-5 py-4 font-semibold text-center">ステータス</th>
                                <th className="px-5 py-4 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.supplierId} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-5 py-4">
                                        <div className="font-medium text-slate-900">{row.name}</div>
                                        <div className="mt-1">{categoryBadge(row.category)}</div>
                                    </td>
                                    <td className="px-5 py-4 text-xs text-slate-500">
                                        {row.paymentTerms?.closingDay ? (
                                            <div>{row.paymentTerms.closingDay === 31 ? "末日" : `${row.paymentTerms.closingDay}日`}締め / 翌月{row.paymentTerms.paymentDay}日払い</div>
                                        ) : (
                                            <span className="italic text-slate-300">未設定</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-right text-slate-600 font-medium">{row.shipmentCount}件</td>
                                    <td className="px-5 py-4 text-right font-bold text-slate-900">¥{row.total.toLocaleString()}</td>
                                    <td className="px-5 py-4 text-center">
                                        {row.status === "paid" ? (
                                            <div>
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                    <CheckCircle className="w-3 h-3" /> 支払済
                                                </span>
                                                {row.paidDate && <div className="text-[10px] text-slate-400 mt-1">{row.paidDate}</div>}
                                            </div>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                                <Clock className="w-3 h-3" /> 未払い
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setDetailModal({ supplierId: row.supplierId, supplierName: row.name })}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                                title="明細を見る"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                明細
                                            </button>
                                            <button
                                                onClick={() => handleToggleStatus(row)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${row.status === "unpaid"
                                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                    }`}
                                            >
                                                {row.status === "unpaid" ? (
                                                    <><CheckCircle className="w-3.5 h-3.5" /> 支払済にする</>
                                                ) : (
                                                    <><Clock className="w-3.5 h-3.5" /> 未払いに戻す</>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setPdfModal({ supplierId: row.supplierId })}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
                                                style={{ backgroundColor: "#b27f79" }}
                                                title="支払明細書PDF"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                PDF
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-16 text-center text-slate-400">
                                        <CreditCard className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                        <p className="font-medium">{displayMonth}の入荷完了記録がありません</p>
                                        <p className="text-xs mt-1">「仕入れ管理」で入荷を完了にすると、ここに表示されます。</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={3} className="px-5 py-4 font-bold text-slate-700 text-right">合計</td>
                                    <td className="px-5 py-4 text-right font-bold text-xl text-slate-900">¥{grandTotal.toLocaleString()}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden space-y-3">
                {rows.map((row) => (
                    <div key={row.supplierId} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="font-semibold text-slate-900">{row.name}</div>
                                <div className="mt-1">{categoryBadge(row.category)}</div>
                            </div>
                            {row.status === "paid" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    <CheckCircle className="w-3 h-3" /> 支払済
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                    <Clock className="w-3 h-3" /> 未払い
                                </span>
                            )}
                        </div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm text-slate-500">
                                {row.paymentTerms?.closingDay ? (
                                    <span>{row.paymentTerms.closingDay === 31 ? "末日" : `${row.paymentTerms.closingDay}日`}締め / 翌月{row.paymentTerms.paymentDay}日払い</span>
                                ) : (
                                    <span className="italic text-slate-300">支払条件未設定</span>
                                )}
                            </div>
                            <div className="text-xs text-slate-500">{row.shipmentCount}件</div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <div className="text-lg font-bold text-slate-900">¥{row.total.toLocaleString()}</div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setDetailModal({ supplierId: row.supplierId, supplierName: row.name })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    <Eye className="w-3.5 h-3.5" /> 明細
                                </button>
                                <button
                                    onClick={() => handleToggleStatus(row)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${row.status === "unpaid" ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}
                                >
                                    {row.status === "unpaid" ? <><CheckCircle className="w-3.5 h-3.5" /> 支払済にする</> : <><Clock className="w-3.5 h-3.5" /> 戻す</>}
                                </button>
                            </div>
                        </div>
                        {row.status === "paid" && row.paidDate && (
                            <div className="text-[10px] text-slate-400 mt-1 text-right">{row.paidDate}</div>
                        )}
                    </div>
                ))}
                {rows.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <CreditCard className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="font-medium text-sm">{displayMonth}の入荷完了記録がありません</p>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {detailModal && (
                <PaymentDetailModal
                    isOpen={!!detailModal}
                    onClose={() => setDetailModal(null)}
                    supplierName={detailModal.supplierName}
                    month={selectedMonth}
                    shipments={detailShipments}
                    products={products}
                />
            )}

            {/* PDF Preview Modal */}
            {pdfModal && (
                <DocumentPreviewModal
                    type="payment_summary"
                    supplierId={pdfModal.supplierId}
                    month={selectedMonth}
                    onClose={() => setPdfModal(null)}
                />
            )}
        </div>
    );
}
