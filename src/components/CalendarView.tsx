"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    ChevronLeft,
    ChevronRight,
    BarChart3,
    FileText,
    ShoppingCart,
    Calendar,
    Store,
    Camera,
    Laptop,
    CheckCircle,
    CreditCard,
    Sparkles
} from "lucide-react";
import { useStore, type Sale } from "@/lib/store";
import { getHolidayName } from "@/lib/holidays";

export const CalendarView: React.FC = () => {
    const { sales, dailyReports, purchases, suppliers, retailStores } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    const handlePrev = () => {
        if (viewMode === 'month') {
            setCurrentDate(new Date(year, month - 1, 1));
        } else if (viewMode === 'week') {
            const d = new Date(currentDate);
            d.setDate(d.getDate() - 7);
            setCurrentDate(d);
        } else {
            const d = new Date(currentDate);
            d.setDate(d.getDate() - 1);
            setCurrentDate(d);
        }
    };

    const handleNext = () => {
        if (viewMode === 'month') {
            setCurrentDate(new Date(year, month + 1, 1));
        } else if (viewMode === 'week') {
            const d = new Date(currentDate);
            d.setDate(d.getDate() + 7);
            setCurrentDate(d);
        } else {
            const d = new Date(currentDate);
            d.setDate(d.getDate() + 1);
            setCurrentDate(d);
        }
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const isTodayDate = (date: Date) => {
        const t = new Date();
        return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
    };

    const formatDate = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const getDayData = (date: Date) => {
        const dateStr = formatDate(date);

        const daySales = sales.filter(s => s.period === dateStr);
        const totalSales = daySales.reduce((sum, s) => sum + s.totalAmount, 0);

        const salesByStore = daySales.map((s: Sale) => {
            const store = retailStores.find(rs => rs.id === s.storeId);
            return {
                name: store ? store.name : "不明な店舗",
                amount: s.totalAmount
            };
        });

        const reports = dailyReports.filter(r => r.date === dateStr);
        const hasStoreReport = reports.some(r => r.type === 'store');
        const hasActivityReport = reports.some(r => r.type === 'activity');
        const hasOfficeReport = reports.some(r => r.type === 'office');

        // Purchases filtering by various dates
        const dayOrdered = purchases.filter(p => !p.isTrashed && p.orderDate === dateStr);
        const dayReceived = purchases.filter(p => !p.isTrashed && (p.receivedDate === dateStr || (p.status === 'received' && p.arrivalDate === dateStr)));
        const dayPaid = purchases.filter(p => !p.isTrashed && p.paymentDate === dateStr);

        const getSupplierNames = (purchaseList: typeof purchases) => {
            return purchaseList.map(p => {
                const s = suppliers.find(s => s.id === p.supplierId);
                return s ? s.name : "不明";
            });
        };

        const holidayName = getHolidayName(dateStr);

        return {
            totalSales,
            salesByStore,
            reports: {
                store: hasStoreReport,
                activity: hasActivityReport,
                office: hasOfficeReport,
                any: reports.length > 0
            },
            purchaseEvents: {
                ordered: dayOrdered.length,
                orderedSuppliers: getSupplierNames(dayOrdered),
                received: dayReceived.length,
                receivedSuppliers: getSupplierNames(dayReceived),
                paid: dayPaid.length,
                paidSuppliers: getSupplierNames(dayPaid),
            },
            holidayName
        };
    };

    const getEventItem = (dayData: any, dayDate: string) => (
        <div className="space-y-1 overflow-hidden">
            {dayData.totalSales > 0 && (
                <Link
                    href={`/sales?tab=log&date=${dayDate}`}
                    className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-black text-blue-600 truncate hover:bg-blue-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                    title={`売上内訳:\n${dayData.salesByStore.map((s: any) => `${s.name}: ¥${s.amount.toLocaleString()}`).join('\n')}`}
                >
                    <BarChart3 className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                    <span>¥{dayData.totalSales.toLocaleString()}</span>
                </Link>
            )}

            {dayData.reports.store && (
                <Link
                    href={`/reports?date=${dayDate}&type=store`}
                    className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-emerald-600 truncate hover:bg-emerald-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                    title="店舗メンテ"
                >
                    <Store className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                    <span className="hidden sm:inline">店舗</span>
                </Link>
            )}

            {dayData.reports.activity && (
                <Link
                    href={`/reports?date=${dayDate}&type=activity`}
                    className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-indigo-600 truncate hover:bg-indigo-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                    title="活動記録"
                >
                    <Camera className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                    <span className="hidden sm:inline">活動</span>
                </Link>
            )}

            {dayData.purchaseEvents.ordered > 0 && (
                <Link
                    href={`/purchases?date=${dayDate}`}
                    className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-amber-600 truncate hover:bg-amber-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                    title={`発注:\n${dayData.purchaseEvents.orderedSuppliers.join('\n')}`}
                >
                    <ShoppingCart className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                    <span className="truncate">
                        発注: {dayData.purchaseEvents.orderedSuppliers[0]}
                        {dayData.purchaseEvents.ordered > 1 && ` 他${dayData.purchaseEvents.ordered - 1}件`}
                    </span>
                </Link>
            )}

            {dayData.purchaseEvents.received > 0 && (
                <Link
                    href={`/purchases?date=${dayDate}`}
                    className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-emerald-600 truncate hover:bg-emerald-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                    title={`仕入:\n${dayData.purchaseEvents.receivedSuppliers.join('\n')}`}
                >
                    <CheckCircle className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                    <span className="truncate">
                        仕入: {dayData.purchaseEvents.receivedSuppliers[0]}
                        {dayData.purchaseEvents.received > 1 && ` 他${dayData.purchaseEvents.received - 1}件`}
                    </span>
                </Link>
            )}

            {dayData.purchaseEvents.paid > 0 && (
                <Link
                    href={`/purchases?date=${dayDate}`}
                    className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-indigo-600 truncate hover:bg-indigo-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                    title={`支払:\n${dayData.purchaseEvents.paidSuppliers.join('\n')}`}
                >
                    <CreditCard className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                    <span className="truncate">
                        支払: {dayData.purchaseEvents.paidSuppliers[0]}
                        {dayData.purchaseEvents.paid > 1 && ` 他${dayData.purchaseEvents.paid - 1}件`}
                    </span>
                </Link>
            )}
        </div>
    );

    const renderMonthView = () => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();

        const cells = [];
        for (let i = 0; i < startDayOfWeek; i++) {
            cells.push(<div key={`empty-${i}`} className="h-24 sm:h-36 border-b border-r border-slate-100 bg-slate-50/20" />);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const data = getDayData(date);
            const dateStr = formatDate(date);
            const holiday = getHolidayName(dateStr);
            const isToday = isTodayDate(date);

            cells.push(
                <div
                    key={d}
                    className={`h-24 sm:h-36 border-b border-r border-slate-100/50 p-2 sm:p-3 transition-all hover:bg-slate-50/80 relative group/day ${isToday ? "bg-blue-50/40" : "bg-white"}`}
                >
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex flex-col items-start gap-1">
                            <span className={`text-[10px] sm:text-xs font-black tracking-tight ${isToday
                                ? "text-white bg-[#1e3a8a] w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl shadow-lg shadow-blue-900/20 ring-2 ring-blue-100"
                                : holiday || date.getDay() === 0
                                    ? "text-red-500"
                                    : date.getDay() === 6
                                        ? "text-blue-500"
                                        : "text-slate-400 group-hover/day:text-slate-900"
                            }`}>
                                {d}
                            </span>
                            {holiday && (
                                <span className="text-[8px] sm:text-[9px] font-bold text-red-500 truncate max-w-full leading-none">
                                    {holiday}
                                </span>
                            )}
                        </div>
                    </div>
                    {getEventItem(data, dateStr)}
                </div>
            );
        }
        return cells;
    };

    const renderWeekView = () => {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            const data = getDayData(date);
            const dateStr = formatDate(date);
            const isToday = isTodayDate(date);
            const holiday = getHolidayName(dateStr);

            days.push(
                <div key={i} className={`min-h-[400px] border-r border-slate-100/50 p-4 transition-all hover:bg-slate-50/80 ${isToday ? "bg-blue-50/20" : "bg-white"}`}>
                    <div className="flex flex-col items-center gap-2 mb-6 border-b border-slate-50 pb-4 text-center">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${i === 0 || holiday ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"}`}>
                            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][i]}
                        </span>
                        <span className={`text-2xl font-black block ${isToday ? "text-[#1e3a8a]" : "text-slate-900"}`}>
                            {date.getDate()}
                        </span>
                        {holiday && (
                            <span className="text-[10px] font-bold text-red-500 block">
                                {holiday}
                            </span>
                        )}
                    </div>
                    
                    <div className="space-y-4">
                        {data.totalSales > 0 && (
                            <div className="space-y-2">
                                <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                    <BarChart3 className="w-3 h-3" /> 売上
                                </div>
                                <div className="text-sm font-black text-slate-900">¥{data.totalSales.toLocaleString()}</div>
                                <div className="space-y-1">
                                    {data.salesByStore.map((s: any, idx: number) => (
                                        <div key={idx} className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                            {s.name}: ¥{s.amount.toLocaleString()}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(data.purchaseEvents.ordered > 0 || data.purchaseEvents.received > 0 || data.purchaseEvents.paid > 0) && (
                            <div className="space-y-3 pt-2 border-t border-slate-50">
                                <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                    <ShoppingCart className="w-3 h-3" /> 仕入関連
                                </div>
                                {data.purchaseEvents.ordered > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[8px] font-black text-amber-400 uppercase">発注済み</div>
                                        {data.purchaseEvents.orderedSuppliers.map((s: string, idx: number) => (
                                            <div key={idx} className="text-[9px] font-bold text-slate-600 pl-2 border-l-2 border-amber-200">{s}</div>
                                        ))}
                                    </div>
                                )}
                                {data.purchaseEvents.received > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[8px] font-black text-emerald-400 uppercase">仕入済み</div>
                                        {data.purchaseEvents.receivedSuppliers.map((s: string, idx: number) => (
                                            <div key={idx} className="text-[9px] font-bold text-slate-600 pl-2 border-l-2 border-emerald-200">{s}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {data.reports.any && (
                           <div className="space-y-2 pt-2 border-t border-slate-50">
                                <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                    <FileText className="w-3 h-3" /> 業務報告
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {data.reports.store && <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">店舗</span>}
                                    {data.reports.activity && <span className="text-[8px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">活動</span>}
                                    {data.reports.office && <span className="text-[8px] font-bold bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded">事務所</span>}
                                </div>
                           </div>
                        )}
                    </div>
                </div>
            );
        }
        return days;
    };

    const renderDayView = () => {
        const data = getDayData(currentDate);
        const dateStr = formatDate(currentDate);
        const isToday = isTodayDate(currentDate);
        const holiday = getHolidayName(dateStr);

        return (
            <div className="p-8 sm:p-12 bg-white min-h-[500px] animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col md:flex-row gap-10">
                    <div className="shrink-0 flex flex-col items-center">
                        <div className={`w-32 h-32 rounded-3xl flex flex-col items-center justify-center shadow-2xl relative overflow-hidden ${isToday ? "bg-[#1e3a8a] text-white" : "bg-slate-50 text-slate-900 border border-slate-200"}`}>
                            <span className="text-sm font-black uppercase tracking-[0.3em] opacity-60 mb-1">
                                {currentDate.toLocaleDateString('ja-JP', { month: 'short' })}
                            </span>
                            <span className="text-5xl font-black tabular-nums">
                                {currentDate.getDate()}
                            </span>
                            <span className="text-xs font-bold mt-2 opacity-60 uppercase tracking-widest">
                                {currentDate.toLocaleDateString('ja-JP', { weekday: 'short' })}
                            </span>
                        </div>
                        {holiday && (
                            <div className="mt-4 px-4 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-black shadow-sm flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                {holiday}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                            <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" /> 売上実績
                            </h3>
                            {data.totalSales > 0 ? (
                                <div className="space-y-4">
                                    <div className="text-4xl font-black text-slate-900 tabular-nums">
                                        ¥{data.totalSales.toLocaleString()}
                                    </div>
                                    <div className="space-y-2">
                                        {data.salesByStore.map((s: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-sm transition-transform hover:scale-[1.02]">
                                                <div className="flex items-center gap-2">
                                                    <Store className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-sm font-bold text-slate-700">{s.name}</span>
                                                </div>
                                                <span className="text-sm font-black text-blue-600">¥{s.amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-10 text-center text-slate-400 italic text-sm">売上データはありません</div>
                            )}
                        </div>

                        <div className="space-y-8">
                             <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                                <h3 className="text-xs font-black text-amber-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4" /> 仕入・発注
                                </h3>
                                {(data.purchaseEvents.ordered > 0 || data.purchaseEvents.received > 0 || data.purchaseEvents.paid > 0) ? (
                                    <div className="space-y-4">
                                        {data.purchaseEvents.ordered > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">発注済み</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {data.purchaseEvents.orderedSuppliers.map((s: string, idx: number) => (
                                                        <span key={idx} className="bg-white border border-amber-100 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-sm">{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {data.purchaseEvents.received > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">仕入済み</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {data.purchaseEvents.receivedSuppliers.map((s: string, idx: number) => (
                                                        <span key={idx} className="bg-white border border-emerald-100 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-sm">{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {data.purchaseEvents.paid > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">支払済み</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {data.purchaseEvents.paidSuppliers.map((s: string, idx: number) => (
                                                        <span key={idx} className="bg-white border border-indigo-100 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-sm">{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-slate-400 italic text-sm">記録はありません</div>
                                )}
                            </div>

                            <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                                <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> 業務・活動報告
                                </h3>
                                {data.reports.any ? (
                                    <div className="flex flex-wrap gap-3">
                                        {data.reports.store && (
                                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-emerald-100 text-emerald-700 text-xs font-bold shadow-sm">
                                                <Store className="w-3.5 h-3.5" /> 店舗巡回あり
                                            </div>
                                        )}
                                        {data.reports.activity && (
                                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-indigo-100 text-indigo-700 text-xs font-bold shadow-sm">
                                                <Camera className="w-3.5 h-3.5" /> 活動記録あり
                                            </div>
                                        )}
                                        {data.reports.office && (
                                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 text-slate-700 text-xs font-bold shadow-sm">
                                                <Laptop className="w-3.5 h-3.5" /> 事務所作業
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-slate-400 italic text-sm">報告データはありません</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <section className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl overflow-hidden group/cal animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-8 py-10 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl pointer-events-none" />
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-2xl shadow-slate-900/20 transition-transform group-hover/cal:scale-110 duration-500">
                        <Calendar className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Schedule & Insights</div>
                        <h2 className="font-black text-slate-900 text-2xl tracking-tight">業務カレンダー</h2>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
                    <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
                        {(['day', 'week', 'month'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                                    viewMode === mode 
                                        ? "bg-white text-[#1e3a8a] shadow-lg scale-[1.05]" 
                                        : "text-slate-400 hover:text-slate-600"
                                }`}
                            >
                                {mode === 'day' ? '1日' : mode === 'week' ? '週間' : '月間'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={goToToday}
                            className="text-[10px] font-black uppercase tracking-widest text-[#1e3a8a] px-6 py-3 bg-blue-50 border border-blue-100 rounded-2xl hover:bg-white hover:shadow-xl hover:-translate-y-0.5 transition-all shadow-sm active:scale-95"
                        >
                            Today
                        </button>

                        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
                            <button
                                onClick={handlePrev}
                                className="p-2.5 rounded-xl hover:bg-white hover:shadow-lg text-slate-400 hover:text-[#1e3a8a] transition-all active:scale-90"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <span className="text-sm sm:text-base font-black text-slate-900 min-w-[120px] text-center uppercase tracking-tight tabular-nums">
                                {viewMode === 'month' ? (
                                    <>{year}. <span className="text-blue-600">{month + 1}</span></>
                                ) : viewMode === 'week' ? (
                                    <>{year}. <span className="text-blue-600">{month + 1}</span> 第{Math.ceil(currentDate.getDate() / 7)}週</>
                                ) : (
                                    <>{year}. <span className="text-blue-600">{month + 1}</span>. {currentDate.getDate()}</>
                                )}
                            </span>
                            <button
                                onClick={handleNext}
                                className="p-2.5 rounded-xl hover:bg-white hover:shadow-lg text-slate-400 hover:text-[#1e3a8a] transition-all active:scale-90"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`overflow-x-auto ${viewMode === 'week' ? "pb-4" : ""}`}>
                {viewMode === 'month' && (
                    <div className="grid grid-cols-7 border-l border-t border-slate-100/50">
                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, i) => (
                            <div
                                key={day}
                                className={`py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] border-b border-r border-slate-100/50 bg-slate-50/30 ${i === 0 ? "text-red-400/80" : i === 6 ? "text-blue-400/80" : "text-slate-400/80"
                                    }`}
                            >
                                {day}
                            </div>
                        ))}
                        {renderMonthView()}
                        {/* Padding for the last week */}
                        {Array.from({ length: (7 - (renderMonthView().length % 7)) % 7 }).map((_, i) => (
                            <div key={`empty-end-${i}`} className="h-24 sm:h-36 border-b border-r border-slate-100/30 bg-slate-50/10" />
                        ))}
                    </div>
                )}

                {viewMode === 'week' && (
                    <div className="flex border-t border-slate-100 min-w-[800px]">
                        {renderWeekView()}
                    </div>
                )}

                {viewMode === 'day' && renderDayView()}
            </div>

            {viewMode !== 'day' && (
                <div className="p-6 bg-slate-50/30 border-t border-slate-100/50 flex flex-wrap gap-8 justify-center">
                    <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" /> Sales
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" /> Store
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm" /> Activity
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" /> Ordered
                    </div>
                </div>
            )}
        </section>
    );
};
