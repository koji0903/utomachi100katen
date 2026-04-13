"use client";

import { useMemo } from "react";
import { 
    Bell, 
    Calendar, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    ShoppingBag, 
    Tent, 
    Flower2, 
    Users,
    ChevronRight,
    LucideIcon
} from "lucide-react";
import { getUpcomingEvents, type Holiday } from "@/lib/holidays";
import Link from "next/link";

interface AlertItem {
    id: string;
    title: string;
    date: string;
    daysRemaining: number;
    status: 'info' | 'success' | 'warning' | 'error';
    message: string;
    icon: LucideIcon;
    progress: number; // 0 to 100
}

export function SeasonalAlarm() {
    const alerts = useMemo(() => {
        const now = new Date();
        const twoMonthsLater = new Date();
        twoMonthsLater.setMonth(now.getMonth() + 2);

        const events = getUpcomingEvents(now, twoMonthsLater);
        
        // Grouping Golden Week
        const processedEvents: Holiday[] = [];
        let gwAdded = false;

        events.forEach(event => {
            if (event.date >= "2026-05-03" && event.date <= "2026-05-06") {
                if (!gwAdded) {
                    processedEvents.push({ date: "2026-05-03", name: "ゴールデンウィーク", type: "event" });
                    gwAdded = true;
                }
            } else {
                processedEvents.push(event);
            }
        });

        return processedEvents.map((event): AlertItem => {
            const eventDate = new Date(event.date);
            const diffTime = eventDate.getTime() - now.getTime();
            const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

            let status: AlertItem['status'] = 'info';
            let message = "";
            let icon: LucideIcon = Calendar;
            let progress = 0;

            if (daysRemaining >= 45) {
                status = 'info';
                message = "仕入れの検討を開始してください。季節需要の予測が重要です。";
                icon = ShoppingBag;
                progress = 25;
            } else if (daysRemaining >= 30) {
                status = 'success';
                message = "仕入れを確定し、具体的な販促計画（特設コーナーの設置など）を立てましょう。";
                icon = CheckCircle2;
                progress = 50;
            } else if (daysRemaining >= 14) {
                status = 'warning';
                message = "POPの作成、売り場レイアウトの準備、在庫の最終確認を行ってください。";
                icon = Clock;
                progress = 75;
            } else {
                status = 'error';
                message = "【最終確認】準備漏れはありませんか？売り場を整え、万全の体制で臨みましょう。";
                icon = AlertCircle;
                progress = 95;
            }

            // Override icons based on event name
            if (event.name.includes("母の日")) icon = Flower2;
            if (event.name.includes("父の日")) icon = Users;
            if (event.name.includes("ゴールデンウィーク")) icon = Tent;

            return {
                id: event.date + event.name,
                title: event.name,
                date: event.date,
                daysRemaining,
                status,
                message,
                icon,
                progress
            };
        }).filter(alert => alert.daysRemaining <= 60);
    }, []);

    if (alerts.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-slate-400">
                    <Bell className="w-3.5 h-3.5" />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Promotion Alerts / 販促準備アラート</h2>
                </div>
                <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    今後2ヶ月の行事: {alerts.length}件
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alerts.map((alert) => (
                    <div 
                        key={alert.id}
                        className="group relative bg-white rounded-[2rem] border border-slate-200/60 p-6 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 overflow-hidden flex flex-col justify-between"
                    >
                        {/* Status Accent Bar */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                            alert.status === 'error' ? 'bg-red-500' : 
                            alert.status === 'warning' ? 'bg-amber-500' :
                            alert.status === 'success' ? 'bg-emerald-500' :
                            'bg-blue-500'
                        }`} />

                        <div>
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-2xl ${
                                    alert.status === 'error' ? 'bg-red-50 text-red-600' : 
                                    alert.status === 'warning' ? 'bg-amber-50 text-amber-600' :
                                    alert.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                    'bg-blue-50 text-blue-600'
                                } group-hover:scale-110 transition-transform`}>
                                    <alert.icon className="w-5 h-5" />
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                        残り {alert.daysRemaining}日
                                    </div>
                                    <div className="text-xs font-bold text-slate-900 italic">
                                        {new Date(alert.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                                    </div>
                                </div>
                            </div>

                            <h3 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-[#1e3a8a] transition-colors mb-2">
                                {alert.title}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
                                {alert.message}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {/* Preparation Progress */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-end">
                                    <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400">Preparation Progress</span>
                                    <span className="text-[10px] font-bold text-slate-900">{alert.progress}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-1000 ease-out rounded-full ${
                                            alert.status === 'error' ? 'bg-red-500' : 
                                            alert.status === 'warning' ? 'bg-amber-500' :
                                            alert.status === 'success' ? 'bg-emerald-500' :
                                            'bg-blue-500'
                                        }`}
                                        style={{ width: `${alert.progress}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                        alert.status === 'error' ? 'bg-red-500' : 
                                        alert.status === 'warning' ? 'bg-amber-500' :
                                        alert.status === 'success' ? 'bg-emerald-500' :
                                        'bg-blue-500'
                                    }`} />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Live Status</span>
                                </div>
                                <Link 
                                    href={`/reports?date=${alert.date}`}
                                    className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1"
                                >
                                    詳細を確認 <ChevronRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
