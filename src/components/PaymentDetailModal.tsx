"use client";

import { X, PackageCheck } from "lucide-react";
import { Purchase, Product } from "@/lib/store";

interface PaymentDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplierName: string;
    month: string; // YYYY-MM
    shipments: Purchase[];
    products: Product[];
}

export function PaymentDetailModal({ isOpen, onClose, supplierName, month, shipments, products }: PaymentDetailModalProps) {
    if (!isOpen) return null;

    const total = shipments.reduce((sum, s) => sum + s.totalCost, 0);
    const [year, m] = month.split("-");
    const title = `${year}年${parseInt(m)}月 仕入れ明細`;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[85vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <PackageCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">{supplierName}</h2>
                            <p className="text-sm text-slate-500">{title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                            <tr>
                                <th className="px-5 py-3 font-semibold">入荷日</th>
                                <th className="px-5 py-3 font-semibold">商品名</th>
                                <th className="px-5 py-3 font-semibold text-right">単価</th>
                                <th className="px-5 py-3 font-semibold text-right">数量</th>
                                <th className="px-5 py-3 font-semibold text-right">小計</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shipments.map((s) => {
                                const product = products.find(p => p.id === s.productId);
                                const productName = product ? `${product.name}${product.variantName ? ` (${product.variantName})` : ''}` : "不明";
                                return (
                                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-3.5 text-slate-500">{s.arrivalDate || s.orderDate}</td>
                                        <td className="px-5 py-3.5 font-medium text-slate-900">{productName}</td>
                                        <td className="px-5 py-3.5 text-right text-slate-600">¥{s.unitCost.toLocaleString()}</td>
                                        <td className="px-5 py-3.5 text-right text-slate-600">{s.quantity}</td>
                                        <td className="px-5 py-3.5 text-right font-bold text-slate-900">¥{s.totalCost.toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                            {shipments.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-10 text-center text-slate-400">この月の仕入れ記録がありません</td>
                                </tr>
                            )}
                        </tbody>
                        {shipments.length > 0 && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={4} className="px-5 py-4 font-bold text-slate-700 text-right">合計</td>
                                    <td className="px-5 py-4 font-bold text-lg text-slate-900 text-right">¥{total.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                <div className="flex justify-end p-6 border-t border-slate-100 bg-slate-50/50">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
