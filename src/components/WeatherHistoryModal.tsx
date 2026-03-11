"use client";

import { useMemo, useState } from "react";
import { X, CloudSun, Cloud, CloudRain, CloudSnow, Thermometer, History, ChevronLeft, ChevronRight } from "lucide-react";
import { useStore, RetailStore } from "@/lib/store";

interface WeatherHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    store: RetailStore | null;
}

function weatherIcon(main: string | undefined) {
    if (!main) return null;
    if (main.includes("Rain") || main.includes("Drizzle")) return <CloudRain className="w-6 h-6 text-blue-400" />;
    if (main.includes("Snow")) return <CloudSnow className="w-6 h-6 text-sky-300" />;
    if (main.includes("Cloud")) return <Cloud className="w-6 h-6 text-slate-400" />;
    return <CloudSun className="w-6 h-6 text-amber-400" />;
}

export function WeatherHistoryModal({ isOpen, onClose, store }: WeatherHistoryModalProps) {
    const { dailyWeather, dailyReports } = useStore();
    
    // State for current displayed month
    const [currentDate, setCurrentDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const mergedHistory = useMemo(() => {
        if (!store) return new Map();

        const historyMap = new Map<string, {
            date: string;
            weather: string;
            weatherMain: string;
            temp?: number;
            humidity?: number;
            source: 'report' | 'auto';
        }>();

        // 1. 自動取得データを追加
        dailyWeather
            .filter(w => w.storeId === store.id)
            .forEach(w => {
                historyMap.set(w.date, {
                    date: w.date,
                    weather: w.weather,
                    weatherMain: w.weatherMain,
                    temp: w.temp,
                    humidity: w.humidity,
                    source: 'auto'
                });
            });

        // 2. 日報データを上書き（優先）
        dailyReports
            .filter(r => r.storeId === store.id && r.weather)
            .forEach(r => {
                const existing = historyMap.get(r.date);
                historyMap.set(r.date, {
                    date: r.date,
                    weather: r.weather!,
                    weatherMain: r.weatherMain || existing?.weatherMain || "Clear",
                    temp: r.temperature,
                    humidity: existing?.humidity,
                    source: 'report'
                });
            });

        return historyMap;
    }, [store, dailyWeather, dailyReports]);

    // Calendar generation
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const days = [];
        // Pad beginning of month
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }
        // Days of month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            days.push({
                dayNumber: i,
                dateStr,
                data: mergedHistory.get(dateStr)
            });
        }
        return days;
    }, [currentDate, mergedHistory]);

    if (!isOpen || !store) return null;

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const monthName = `${currentDate.getFullYear()}年 ${currentDate.getMonth() + 1}月`;
    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 m-4">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">天気履歴</h2>
                            <p className="text-xs font-medium text-slate-500">{store.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
                    {/* Calendar Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h3 className="text-lg font-bold text-slate-800">{monthName}</h3>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
                            {WEEKDAYS.map((day, i) => (
                                <div key={day} className={`py-3 text-center text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 auto-rows-[100px] sm:auto-rows-[120px]">
                            {calendarDays.map((day, index) => {
                                const isWeekendRow = index % 7 === 0 || index % 7 === 6;
                                const cellBg = !day ? 'bg-slate-50/50' : 'bg-white hover:bg-slate-50/50';
                                
                                return (
                                    <div 
                                        key={index} 
                                        className={`border-r border-b border-slate-100 p-2 relative flex flex-col transition-colors ${cellBg} ${index % 7 === 6 ? 'border-r-0' : ''}`}
                                    >
                                        {day && (
                                            <>
                                                <div className={`text-xs font-bold mb-1 ${index % 7 === 0 ? 'text-red-500' : index % 7 === 6 ? 'text-blue-500' : 'text-slate-700'}`}>
                                                    {day.dayNumber}
                                                </div>
                                                
                                                {day.data ? (
                                                    <div className="flex-1 flex flex-col items-center justify-center gap-1">
                                                        {weatherIcon(day.data.weatherMain)}
                                                        {day.data.temp !== undefined && (
                                                            <div className="flex items-center text-sm font-bold text-slate-700 mt-1">
                                                                {day.data.temp}°
                                                            </div>
                                                        )}
                                                        {day.data.source === 'report' && (
                                                            <div className="absolute bottom-1 right-1 text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded leading-none">
                                                                手動
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex items-center justify-center text-slate-200">
                                                        -
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
