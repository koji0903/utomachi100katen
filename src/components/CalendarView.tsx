"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    ChevronLeft,
    ChevronRight,
    BarChart3,
    FileText,
    ShoppingCart,
    Calendar
} from "lucide-react";
import { useStore } from "@/lib/store";

export const CalendarView: React.FC = () => {
    const { sales, dailyReports, purchases } = useStore();
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

        const hasReport = dailyReports.some(r => r.date === dateStr);

        // Purchases might have orderDate or arrivalDate. Assuming orderDate for record.
        const dayPurchases = purchases.filter(p => p.orderDate === dateStr);

        return {
            totalSales,
            hasReport,
            purchaseCount: dayPurchases.length
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
                    <span className={`text-[10px] sm:text-xs font-black tracking-tight ${isToday(d) ? "text-white bg-[#1e3a8a] w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl shadow-lg shadow-blue-900/20 ring-2 ring-blue-100" : "text-slate-400 group-hover/day:text-slate-900"}`}>
                        {d}
                    </span>
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

                    {data.hasReport && (
                        <Link
                            href={`/reports?date=${dayDate}`}
                            className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-emerald-600 truncate hover:bg-emerald-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                        >
                            <FileText className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                            <span>日報</span>
                        </Link>
                    )}

                    {data.purchaseCount > 0 && (
                        <Link
                            href={`/purchases?date=${dayDate}`}
                            className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold text-amber-600 truncate hover:bg-amber-100/50 rounded-lg px-2 -mx-1 transition-all py-1 group/link"
                        >
                            <ShoppingCart className="w-3 h-3 shrink-0 opacity-50 group-hover/link:opacity-100" />
                            <span>仕入 {data.purchaseCount}</span>
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
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20" /> Sales
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20" /> Report
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/20" /> Purchase
                </div>
            </div>
        </section>
    );
};
