"use client";

import { useMemo } from "react";
import { X, CloudSun, Cloud, CloudRain, CloudSnow, Thermometer, Wind, History } from "lucide-react";
import { useStore, RetailStore } from "@/lib/store";

interface WeatherHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    store: RetailStore | null;
}

function weatherIcon(main: string | undefined) {
    if (!main) return <CloudSun className="w-5 h-5 text-amber-400" />;
    if (main.includes("Rain") || main.includes("Drizzle")) return <CloudRain className="w-5 h-5 text-blue-400" />;
    if (main.includes("Snow")) return <CloudSnow className="w-5 h-5 text-sky-300" />;
    if (main.includes("Cloud")) return <Cloud className="w-5 h-5 text-slate-400" />;
    return <CloudSun className="w-5 h-5 text-amber-400" />;
}

export function WeatherHistoryModal({ isOpen, onClose, store }: WeatherHistoryModalProps) {
    const { dailyWeather, dailyReports } = useStore();

    const mergedHistory = useMemo(() => {
        if (!store) return [];

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
                    humidity: existing?.humidity, // 日報には湿度がないので既存のものを維持する
                    source: 'report'
                });
            });

        return Array.from(historyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [store, dailyWeather, dailyReports]);

    if (!isOpen || !store) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 m-4">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
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
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {mergedHistory.length > 0 ? (
                        <div className="space-y-2 relative">
                            {/* Vertical Line */}
                            <div className="absolute left-[85px] top-4 bottom-4 w-px bg-slate-100" />
                            
                            {mergedHistory.map((item, index) => (
                                <div key={item.date} className="flex items-center gap-4 p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl transition-colors group relative z-10">
                                    {/* Date */}
                                    <div className="w-16 shrink-0 text-right">
                                        <div className="text-sm font-bold text-slate-700">
                                            {item.date.slice(5).replace('-', '/')}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            {item.date.slice(0, 4)}
                                        </div>
                                    </div>

                                    {/* Icon & Details */}
                                    <div className="flex-1 flex items-center gap-4 pl-4 border-l-2 border-slate-100 group-hover:border-blue-200 transition-colors">
                                        <div className="shrink-0 p-2 bg-slate-50 rounded-full">
                                            {weatherIcon(item.weatherMain)}
                                        </div>
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-bold text-slate-800">{item.weather}</span>
                                                {item.temp !== undefined && (
                                                    <span className="flex items-center text-sm font-bold text-slate-600">
                                                        <Thermometer className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
                                                        {item.temp}°C
                                                    </span>
                                                )}
                                            </div>
                                            {(item.humidity !== undefined || item.source === 'report') && (
                                                <div className="flex items-center gap-3 mt-1">
                                                    {item.humidity !== undefined && (
                                                        <span className="text-xs text-slate-400 flex items-center">
                                                            湿度 {item.humidity}%
                                                        </span>
                                                    )}
                                                    {item.source === 'report' && (
                                                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-sm font-medium">
                                                            日報入力
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Cloud className="w-12 h-12 text-slate-200 mb-3" />
                            <p className="font-medium text-slate-600">天気履歴がありません</p>
                            <p className="text-xs text-slate-400 mt-1">日報の入力や自動取得によってデータが蓄積されます</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors">
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
