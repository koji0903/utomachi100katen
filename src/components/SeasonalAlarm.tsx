import { useMemo, useState } from "react";
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
    LucideIcon,
    Plus,
    X,
    Check,
    Pencil,
    Trash2
} from "lucide-react";
import { getUpcomingEvents, type Holiday } from "@/lib/holidays";
import { useStore, type PromotionTask, type PromotionEvent } from "@/lib/store";

interface AlertItem {
    id: string;
    title: string;
    date: string;
    daysRemaining: number;
    status: 'info' | 'success' | 'warning' | 'error';
    message: string;
    description?: string;
    icon: LucideIcon;
    targetProgress: number; // Based on date
    actualProgress: number; // Based on tasks
    type: 'system' | 'custom';
}

const STANDARD_TASKS = [
    { key: 'procurement', label: '仕入れ計画・商品選定', stage: 45 },
    { key: 'marketing', label: '販促・セール計画の確定', stage: 30 },
    { key: 'floor', label: '売り場設営・POP準備', stage: 14 },
    { key: 'final', label: '最終確認・スタッフ周知', stage: 7 }
];

// --- Modal Component ---
function EventEditModal({ 
    event, 
    onClose, 
    onSave, 
    onDelete 
}: { 
    event: Partial<PromotionEvent>, 
    onClose: () => void, 
    onSave: (data: any) => void,
    onDelete?: (id: string) => void
}) {
    const [name, setName] = useState(event.name || "");
    const [date, setDate] = useState(event.date || new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState(event.description || "");

    const isSystem = event.type === 'system';

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl relative z-10 p-8 space-y-6 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        {isSystem ? "行事情報の編集" : event.id ? "行事の編集" : "新規行事の追加"}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-300">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">行事名</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            disabled={isSystem}
                            placeholder="例: 夏の特大セール"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">開催日</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            disabled={isSystem}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">追加情報・メモ</label>
                        <textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            placeholder="準備のポイントや、今回の注力商品などをメモ..."
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    {!isSystem && event.id && onDelete && (
                        <button 
                            onClick={() => { if(window.confirm("この行事を削除しますか？")) onDelete(event.id!); }}
                            className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                    <button 
                        onClick={() => onSave({ ...event, name, date, description })}
                        disabled={!name || !date}
                        className="flex-1 bg-[#1e3a8a] text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                    >
                        保存する
                    </button>
                </div>
            </div>
        </div>
    );
}

export function SeasonalAlarm() {
    const { promotionTasks, togglePromotionTask, retailStores, promotionEvents, savePromotionEvent, deletePromotionEvent } = useStore();
    const [selectedEvent, setSelectedEvent] = useState<AlertItem | null>(null);
    const [editingEvent, setEditingEvent] = useState<Partial<PromotionEvent> | null>(null);
    
    // Use first non-trashed store as context, or default
    const currentStoreId = retailStores.find(s => !s.isTrashed)?.id || "default_store";

    const alerts = useMemo(() => {
        const now = new Date();
        const twoMonthsLater = new Date();
        twoMonthsLater.setMonth(now.getMonth() + 2);

        // 1. Get system events
        const systemEvents = getUpcomingEvents(now, twoMonthsLater);
        
        // 2. Grouping Golden Week
        const processedEvents: Holiday[] = [];
        let gwAdded = false;
        const currentYear = now.getFullYear();
        const gwStart = `${currentYear}-05-03`;
        const gwEnd = `${currentYear}-05-06`;

        systemEvents.forEach(event => {
            if (event.date >= gwStart && event.date <= gwEnd) {
                if (!gwAdded) {
                    processedEvents.push({ date: gwStart, name: "ゴールデンウィーク", type: "event" });
                    gwAdded = true;
                }
            } else {
                processedEvents.push(event);
            }
        });

        // 3. Mapping to AlertItems (Merging with custom overrides/events)
        const combinedAlerts: AlertItem[] = [];

        // Build a map of our custom events for easy lookup
        const customMap = new Map<string, PromotionEvent>();
        promotionEvents.forEach(e => {
            // For system overrides, key is date_name. For custom, it's just ID but we need to check matches.
            if (e.type === 'system') customMap.set(`${e.date}_${e.name}`, e);
        });

        // Add System Events (with potential overrides)
        processedEvents.forEach(event => {
            const override = customMap.get(`${event.date}_${event.name}`);
            
            const eventDate = new Date(event.date);
            const diffTime = eventDate.getTime() - now.getTime();
            const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

            if (daysRemaining > 60) return;

            let status: AlertItem['status'] = 'info';
            let message = "";
            let icon: LucideIcon = Calendar;
            let targetProgress = 0;

            if (daysRemaining >= 45) {
                status = 'info';
                message = "仕入れの検討を開始してください。季節需要の予測が重要です。";
                icon = ShoppingBag;
                targetProgress = 25;
            } else if (daysRemaining >= 30) {
                status = 'success';
                message = "仕入れを確定し、具体的な販促計画を立てましょう。";
                icon = CheckCircle2;
                targetProgress = 50;
            } else if (daysRemaining >= 14) {
                status = 'warning';
                message = "POPの作成、売り場レイアウトの準備を行いましょう。";
                icon = Clock;
                targetProgress = 75;
            } else {
                status = 'error';
                message = "準備漏れはありませんか？最終確認を行ってください。";
                icon = AlertCircle;
                targetProgress = 95;
            }

            // Actual Progress
            const eventTasks = promotionTasks.filter(t => t.eventDate === event.date && t.eventName === event.name);
            const completedCount = eventTasks.filter(t => t.isCompleted).length;
            const actualProgress = Math.round((completedCount / STANDARD_TASKS.length) * 100);

            if (actualProgress < targetProgress && status !== 'error') {
                status = 'warning';
                message = "【遅れ】計画に対して準備が遅れています。タスクを確認してください。";
            }

            if (event.name.includes("母の日")) icon = Flower2;
            if (event.name.includes("父の日")) icon = Users;
            if (event.name.includes("ゴールデンウィーク")) icon = Tent;

            combinedAlerts.push({
                id: event.date + event.name,
                title: event.name,
                date: event.date,
                daysRemaining,
                status,
                message,
                description: override?.description,
                icon,
                targetProgress,
                actualProgress,
                type: 'system'
            });
        });

        // Add Custom Events
        promotionEvents.filter(e => e.type === 'custom').forEach(e => {
            const eventDate = new Date(e.date);
            const diffTime = eventDate.getTime() - now.getTime();
            const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

            if (daysRemaining < 0 || daysRemaining > 60) return;

            // Simple logic for custom statuses (similar to system)
            let targetProgress = 0;
            if (daysRemaining >= 45) targetProgress = 25;
            else if (daysRemaining >= 30) targetProgress = 50;
            else if (daysRemaining >= 14) targetProgress = 75;
            else targetProgress = 95;

            const eventTasks = promotionTasks.filter(t => t.eventDate === e.date && t.eventName === e.name);
            const completedCount = eventTasks.filter(t => t.isCompleted).length;
            const actualProgress = Math.round((completedCount / STANDARD_TASKS.length) * 100);

            combinedAlerts.push({
                id: e.id,
                title: e.name,
                date: e.date,
                daysRemaining,
                status: actualProgress < targetProgress ? 'warning' : 'info',
                message: e.description ? "カスタム行事の準備を進めましょう。" : "独自行事の準備を計画しましょう。",
                description: e.description,
                icon: Calendar,
                targetProgress,
                actualProgress,
                type: 'custom'
            });
        });

        return combinedAlerts.sort((a, b) => a.date.localeCompare(b.date));
    }, [promotionTasks, promotionEvents, retailStores]);

    const handleSaveEdit = async (data: any) => {
        try {
            const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const id = data.id || (data.type === 'system' ? `${data.date}_${data.name}` : generateId());
            await savePromotionEvent({
                ...data,
                id,
                type: data.type || 'custom'
            });
            setEditingEvent(null);
        } catch (error) {
            console.error("行事の保存に失敗しました:", error);
            alert("データの保存に失敗しました。もう一度お試しください。");
        }
    };

    const handleDeleteEvent = async (id: string) => {
        try {
            await deletePromotionEvent(id);
            setEditingEvent(null);
        } catch (error) {
            console.error("行事の削除に失敗しました:", error);
            alert("データの削除に失敗しました。もう一度お試しください。");
        }
    };

    if (alerts.length === 0 && !promotionEvents.some(e => e.type === 'custom')) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-slate-400">
                    <Bell className="w-3.5 h-3.5" />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">販促準備アラート</h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        今後2ヶ月の行事: {alerts.length}件
                    </div>
                    <button 
                        onClick={() => setEditingEvent({ type: 'custom' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-all hover:scale-105 shadow-sm"
                    >
                        <Plus className="w-3 h-3 text-blue-600" /> 行事追加
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alerts.map((alert) => (
                    <div 
                        key={alert.id}
                        className="group relative bg-white rounded-[2rem] border border-slate-200/60 p-6 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-[300px]"
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
                                <div className="text-right flex flex-col items-end">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                        残り {alert.daysRemaining}日
                                    </div>
                                    <div className="text-xs font-bold text-slate-900 italic">
                                        {new Date(alert.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                                    </div>
                                    <button 
                                        onClick={() => setEditingEvent({
                                            id: alert.type === 'system' ? promotionEvents.find(e => e.id === `${alert.date}_${alert.title}`)?.id : alert.id,
                                            name: alert.title,
                                            date: alert.date,
                                            description: alert.description,
                                            type: alert.type
                                        })}
                                        className="mt-2 p-1.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        title="情報を編集"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-[#1e3a8a] transition-colors mb-2">
                                {alert.title}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-2">
                                {alert.message}
                            </p>
                            {alert.description && (
                                <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-100/50 mb-6 animate-in fade-in slide-in-from-top-1">
                                    <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                                        {alert.description}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            {/* Preparation Progress */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-end">
                                    <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400">現在の準備進捗</span>
                                    <span className="text-[10px] font-bold text-slate-900">{alert.actualProgress}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                                    <div 
                                        className="absolute top-0 bottom-0 w-0.5 bg-slate-300 z-10"
                                        style={{ left: `${alert.targetProgress}%` }}
                                        title={`目標: ${alert.targetProgress}%`}
                                    />
                                    <div 
                                        className={`h-full transition-all duration-1000 ease-out rounded-full ${
                                            alert.actualProgress < alert.targetProgress && alert.daysRemaining < 30 ? 'bg-red-500' :
                                            alert.status === 'error' ? 'bg-red-500' : 
                                            alert.status === 'warning' ? 'bg-amber-500' :
                                            alert.status === 'success' ? 'bg-emerald-500' :
                                            'bg-blue-500'
                                        }`}
                                        style={{ width: `${alert.actualProgress}%` }}
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
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">ステータス</span>
                                </div>
                                <button 
                                    onClick={() => setSelectedEvent(alert)}
                                    className="text-[10px] font-black text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-xl transition-all hover:scale-105"
                                >
                                    タスクを管理 <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Event Edit Modal */}
            {editingEvent && (
                <EventEditModal 
                    event={editingEvent} 
                    onClose={() => setEditingEvent(null)} 
                    onSave={handleSaveEdit}
                    onDelete={handleDeleteEvent}
                />
            )}

            {/* Task Management Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative z-10 animate-in fade-in zoom-in duration-200">
                        <div className="p-8 pb-0 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-2xl bg-blue-50 text-blue-600`}>
                                    <selectedEvent.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{selectedEvent.title}</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {new Date(selectedEvent.date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}の準備
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-300">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-3">
                                {STANDARD_TASKS.map((task) => {
                                    const firestoreTask = promotionTasks.find(t => 
                                        t.eventDate === selectedEvent.date && 
                                        t.eventName === selectedEvent.title && 
                                        t.taskKey === task.key
                                    );
                                    const isCompleted = firestoreTask?.isCompleted || false;
                                    const isOverdue = selectedEvent.daysRemaining < task.stage && !isCompleted;

                                    return (
                                        <button
                                            key={task.key}
                                            onClick={() => togglePromotionTask({
                                                id: `${currentStoreId}_${selectedEvent.date}_${task.key}`,
                                                storeId: currentStoreId,
                                                eventDate: selectedEvent.date,
                                                eventName: selectedEvent.title,
                                                taskKey: task.key,
                                                isCompleted
                                            })}
                                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group
                                                ${isCompleted 
                                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                                                    : isOverdue
                                                        ? 'bg-red-50 border-red-100 text-red-900'
                                                        : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-blue-200 hover:bg-white'
                                                }`}
                                        >
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all
                                                ${isCompleted 
                                                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                                                    : isOverdue
                                                        ? 'bg-white border-red-300 text-transparent group-hover:border-red-400'
                                                        : 'bg-white border-slate-200 text-transparent group-hover:border-blue-400'
                                                }`}>
                                                <Check className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold">{task.label}</div>
                                                <div className="text-[9px] font-black uppercase tracking-tighter opacity-60">
                                                    推奨期限: 行事の{task.stage}日前まで
                                                </div>
                                            </div>
                                            {isOverdue && (
                                                <span className="text-[9px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full">
                                                    遅延
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="pt-6 border-t border-slate-100">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">プロジェクト完了率</span>
                                    <span className="text-xl font-black text-slate-900">{selectedEvent.actualProgress}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-700 ease-out rounded-full ${
                                            selectedEvent.actualProgress === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                                        }`}
                                        style={{ width: `${selectedEvent.actualProgress}%` }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="w-full bg-[#1e3a8a] text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                管理画面を閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
