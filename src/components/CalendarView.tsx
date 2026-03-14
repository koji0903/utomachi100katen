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
    CreditCard
} from "lucide-react";
import { useStore } from "@/lib/store";
import { getHolidayName } from "@/lib/holidays";

export const CalendarView: React.FC = () => {
    const { sales, dailyReports, purchases, suppliers } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const today = new Date();
    const isToday = (d: number) => {
        return d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    const formatDate = (y: number, m: number, d: number) => {
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    const getDayData = (d: number) => {
        const dateStr = formatDate(year, month, d);

        const daySales = sales.filter(s => s.period === dateStr);
        const totalSales = daySales.reduce((sum, s) => sum + s.totalAmount, 0);

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

    const days = [];
    // Padding for the first week
    for (let i = 0; i < startDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className="h-24 sm:h-32 border-b border-r border-slate-100 bg-slate-50/20" />);
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
        const data = getDayData(d);
        const dayDate = formatDate(year, month, d);

        days.push(
            <div
                key={d}
                className={`h-24 sm:h-36 border-b border-r border-slate-100/50 p-2 sm:p-3 transition-all hover:bg-slate-50/80 relative group/day ${isToday(d) ? "bg-blue-50/40" : "bg-white"
                    }`}
            >
                <div className="flex justify-between items-start mb-1">
                    <div className="flex flex-col items-start gap-1">
                        <span className={`text-[10px] sm:text-xs font-black tracking-tight ${isToday(d)
                            ? "text-white bg-[#1e3a8a] w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl shadow-lg shadow-blue-900/20 ring-2 ring-blue-100"
                            : data.holidayName || new Date(year, month, d).getDay() === 0
                                ? "text-red-500"
                                : new Date(year, month, d).getDay() === 6
                                    ? "text-blue-500"
                                    : "text-slate-400 group-hover/day:text-slate-900"
                            }`}>
                            {d}
                        </span>
                        {data.holidayName && (
                            <span className="text-[8px] sm:text-[9px] font-bold text-red-500 truncate max-w-full leading-none">
                                {data.holidayName}
                            </span>
                        )}
                    </div>
                    {isToday(d) && <span className="text-[7px] font-black text-[#1e3a8a] hidden sm:block uppercase tracking-[0.2em] opacity-40">Today</span>}
                </div>

                <div className="space-y-1 overflow-hidden">
                    {data.totalSales > 0 && (
                        <Link
                            href={`/sales?tab=log&date=${dayDate}`}
                            className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-black text-blue-600 truncate hover:bg-blue-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                        >
                            <BarChart3 className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                            <span>¥{data.totalSales.toLocaleString()}</span>
                        </Link>
                    )}

                    {data.reports.store && (
                        <Link
                            href={`/reports?date=${dayDate}&type=store`}
                            className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-emerald-600 truncate hover:bg-emerald-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                            title="店舗メンテ"
                        >
                            <Store className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                            <span className="hidden sm:inline">店舗</span>
                        </Link>
                    )}

                    {data.reports.activity && (
                        <Link
                            href={`/reports?date=${dayDate}&type=activity`}
                            className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-indigo-600 truncate hover:bg-indigo-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                            title="活動記録"
                        >
                            <Camera className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                            <span className="hidden sm:inline">活動</span>
                        </Link>
                    )}

                    {data.reports.office && (
                        <Link
                            href={`/reports?date=${dayDate}&type=office`}
                            className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-slate-600 truncate hover:bg-slate-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                            title="事務所"
                        >
                            <Laptop className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                            <span className="hidden sm:inline">事務所</span>
                        </Link>
                    )}

                    {data.purchaseEvents.ordered > 0 && (
                        <Link
                            href={`/purchases?date=${dayDate}`}
                            className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-amber-600 truncate hover:bg-amber-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                            title={`発注:\n${data.purchaseEvents.orderedSuppliers.join('\n')}`}
                        >
                            <ShoppingCart className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                            <span>
                                発注: {data.purchaseEvents.orderedSuppliers[0]}
                                {data.purchaseEvents.ordered > 1 && ` 他${data.purchaseEvents.ordered - 1}件`}
                            </span>
                        </Link>
                    )}

                    {data.purchaseEvents.received > 0 && (
                        <Link
                            href={`/purchases?date=${dayDate}`}
                            className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-emerald-600 truncate hover:bg-emerald-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                            title={`仕入:\n${data.purchaseEvents.receivedSuppliers.join('\n')}`}
                        >
                            <CheckCircle className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                            <span>
                                仕入: {data.purchaseEvents.receivedSuppliers[0]}
                                {data.purchaseEvents.received > 1 && ` 他${data.purchaseEvents.received - 1}件`}
                            </span>
                        </Link>
                    )}

                    {data.purchaseEvents.paid > 0 && (
                        <Link
                            href={`/purchases?date=${dayDate}`}
                            className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-indigo-600 truncate hover:bg-indigo-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                            title={`支払:\n${data.purchaseEvents.paidSuppliers.join('\n')}`}
                        >
                            <CreditCard className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                            <span>
                                支払: {data.purchaseEvents.paidSuppliers[0]}
                                {data.purchaseEvents.paid > 1 && ` 他${data.purchaseEvents.paid - 1}件`}
                            </span>
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    return (
        <section className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden group/cal animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-5 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-white flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/10 transition-transform group-hover/cal:scale-110 duration-500">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Management</div>
                        <h2 className="font-black text-slate-900 text-lg">業務カレンダー</h2>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-6 ml-auto sm:ml-0">
                    <button
                        onClick={goToToday}
                        className="text-[10px] font-black uppercase tracking-widest text-[#1e3a8a] px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all active:scale-95 shadow-sm"
                    >
                        Today
                    </button>

                    <div className="flex items-center gap-2 sm:gap-4 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                        <button
                            onClick={prevMonth}
                            className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-400 hover:text-slate-900 transition-all active:scale-90"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-xs sm:text-sm font-black text-slate-900 min-w-[90px] text-center uppercase tracking-tight">
                            {year}. <span className="text-blue-600">{month + 1}</span>
                        </span>
                        <button
                            onClick={nextMonth}
                            className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-400 hover:text-slate-900 transition-all active:scale-90"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 border-l border-t border-slate-100/50">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, i) => (
                    <div
                        key={day}
                        className={`py-3 text-center text-[9px] font-black uppercase tracking-[0.2em] border-b border-r border-slate-100/50 bg-slate-50/50 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"
                            }`}
                    >
                        {day}
                    </div>
                ))}
                {days}
                {/* Padding for the last week */}
                {Array.from({ length: (7 - (days.length % 7)) % 7 }).map((_, i) => (
                    <div key={`empty-end-${i}`} className="h-24 sm:h-32 border-b border-r border-slate-100/30 bg-slate-50/10" />
                ))}
            </div>

            <div className="p-5 bg-slate-50/30 border-t border-slate-100/50 flex flex-wrap gap-6 justify-center">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Sales
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Store
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Activity
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Office
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ordered
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Received
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Paid
                </div>
            </div>
        </section>
    );
};
