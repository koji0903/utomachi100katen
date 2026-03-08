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
                className={`h-24 sm:h-32 border-b border-r border-slate-100 p-1.5 sm:p-2 transition-all hover:bg-slate-50 relative group ${isToday(d) ? "bg-blue-50/30" : "bg-white"
                    }`}
            >
                <div className="flex justify-between items-start">
                    <span className={`text-[10px] sm:text-xs font-bold ${isToday(d) ? "text-white bg-blue-600 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full shadow-sm" : "text-slate-400"}`}>
                        {d}
                    </span>
                    {isToday(d) && <span className="text-[8px] font-bold text-blue-600 hidden sm:block uppercase tracking-tighter">Today</span>}
                </div>

                <div className="mt-1 space-y-0.5 sm:space-y-1 overflow-hidden">
                    {data.totalSales > 0 && (
                        <Link
                            href={`/sales?tab=log&date=${dayDate}`}
                            className="flex items-center gap-1 text-[9px] sm:text-[11px] font-bold text-blue-600 truncate hover:bg-blue-100 rounded px-1 -mx-1 transition-colors py-0.5"
                        >
                            <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                            <span>¥{data.totalSales.toLocaleString()}</span>
                        </Link>
                    )}

                    {data.hasReport && (
                        <Link
                            href={`/reports?date=${dayDate}`}
                            className="flex items-center gap-1 text-[9px] sm:text-[11px] font-medium text-emerald-600 truncate hover:bg-emerald-100 rounded px-1 -mx-1 transition-colors py-0.5"
                        >
                            <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                            <span>日報</span>
                        </Link>
                    )}

                    {data.purchaseCount > 0 && (
                        <Link
                            href={`/purchases?date=${dayDate}`}
                            className="flex items-center gap-1 text-[9px] sm:text-[11px] font-medium text-amber-600 truncate hover:bg-amber-100 rounded px-1 -mx-1 transition-colors py-0.5"
                        >
                            <ShoppingCart className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                            <span>仕入 {data.purchaseCount}</span>
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    return (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white">
                        <Calendar className="w-4 h-4" />
                    </div>
                    <h2 className="font-bold text-slate-800">業務カレンダー</h2>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    <button
                        onClick={goToToday}
                        className="text-[10px] sm:text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all active:scale-95"
                    >
                        今日
                    </button>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-xs sm:text-sm font-bold text-slate-700 min-w-[80px] text-center">
                            {year}年 {month + 1}月
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={prevMonth}
                                className="p-1 sm:p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors border border-transparent hover:border-slate-200 bg-white shadow-sm sm:shadow-none"
                            >
                                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <button
                                onClick={nextMonth}
                                className="p-1 sm:p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors border border-transparent hover:border-slate-200 bg-white shadow-sm sm:shadow-none"
                            >
                                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 border-l border-t border-slate-100">
                {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                    <div
                        key={day}
                        className={`p-2 text-center text-[10px] font-bold uppercase tracking-wider border-b border-r border-slate-100 bg-slate-50/80 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400"
                            }`}
                    >
                        {day}
                    </div>
                ))}
                {days}
                {/* Padding for the last week */}
                {Array.from({ length: (7 - (days.length % 7)) % 7 }).map((_, i) => (
                    <div key={`empty-end-${i}`} className="h-24 sm:h-32 border-b border-r border-slate-100 bg-slate-50/30" />
                ))}
            </div>

            <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-wrap gap-4 justify-center">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                    <div className="w-2 h-2 rounded-full bg-blue-500" /> 売上
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> 日報
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                    <div className="w-2 h-2 rounded-full bg-amber-500" /> 仕入
                </div>
            </div>
        </section>
    );
};
