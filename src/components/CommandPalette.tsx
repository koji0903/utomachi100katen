// src/components/CommandPalette.tsx
"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
    Search, LayoutDashboard, BarChart2, Receipt, BarChart3, FileText, 
    AlertCircle, Printer, Package, Truck, Archive, CreditCard, 
    ShoppingCart, BookOpen, Settings, Plus, Sparkles, CornerDownLeft, Store, Tag, Building2, Users, Mail
} from "lucide-react";

interface CommandItem {
    id: string;
    title: string;
    description: string;
    category: "機能・画面遷移" | "クイック操作" | "マニュアル・サポート";
    icon: any;
    action: () => void;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});

    // Reset state on open/close
    useEffect(() => {
        if (isOpen) {
            setSearchQuery("");
            setSelectedIndex(0);
            // Delay slightly to ensure layout is mounted before focusing
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Define all available command palette items
    const commands: CommandItem[] = useMemo(() => [
        // --- Navigation ---
        {
            id: "nav_dashboard",
            title: "ダッシュボード",
            description: "メインダッシュボード画面へ移動します",
            category: "機能・画面遷移",
            icon: LayoutDashboard,
            action: () => router.push("/")
        },
        {
            id: "nav_analytics",
            title: "分析・事業報告 (Analytics)",
            description: "売上・原価・一般経費・純利益・P&Lの財務ダッシュボードを開きます",
            category: "機能・画面遷移",
            icon: BarChart2,
            action: () => router.push("/analytics")
        },
        {
            id: "nav_expenses",
            title: "支出・経費管理",
            description: "経費入力、小口現金、固定費テンプレート登録画面を開きます",
            category: "機能・画面遷移",
            icon: Receipt,
            action: () => router.push("/expenses")
        },
        {
            id: "nav_sales",
            title: "売上入力・管理",
            description: "店舗別の売上入力画面を開きます",
            category: "機能・画面遷移",
            icon: BarChart3,
            action: () => router.push("/sales")
        },
        {
            id: "nav_reports",
            title: "業務日報",
            description: "日々の業務日報・店舗報告・AIアドバイス画面を開きます",
            category: "機能・画面遷移",
            icon: FileText,
            action: () => router.push("/reports")
        },
        {
            id: "nav_todo",
            title: "課題・ToDo管理",
            description: "運営課題、仕入タスク、やることリストを開きます",
            category: "機能・画面遷移",
            icon: AlertCircle,
            action: () => router.push("/todo")
        },
        {
            id: "nav_print",
            title: "印刷アーカイブ",
            description: "各種伝票や日報の印刷書類管理画面を開きます",
            category: "機能・画面遷移",
            icon: Printer,
            action: () => router.push("/print-archive")
        },
        {
            id: "nav_products",
            title: "商品管理",
            description: "商品一覧、仕入単価、ストーリー編集を開きます",
            category: "機能・画面遷移",
            icon: Package,
            action: () => router.push("/products")
        },
        {
            id: "nav_purchases",
            title: "仕入管理 (Inbound)",
            description: "発注・仕入れ・未入金消込ステータスの管理画面を開きます",
            category: "機能・画面遷移",
            icon: Truck,
            action: () => router.push("/purchases")
        },
        {
            id: "nav_inventory",
            title: "在庫管理",
            description: "現在庫・棚卸・商品保管履歴を開きます",
            category: "機能・画面遷移",
            icon: Archive,
            action: () => router.push("/inventory")
        },
        {
            id: "nav_payments",
            title: "支払い管理",
            description: "仕入先への支払ステータス管理画面を開きます",
            category: "機能・画面遷移",
            icon: CreditCard,
            action: () => router.push("/payments")
        },
        {
            id: "nav_orders",
            title: "注文管理",
            description: "卸取引注文、出荷ステータス管理画面を開きます",
            category: "機能・画面遷移",
            icon: ShoppingCart,
            action: () => router.push("/orders")
        },
        {
            id: "nav_transactions",
            title: "取引管理 (Ledger)",
            description: "請求書・納品書の入金履歴と消込 ledger を開きます",
            category: "機能・画面遷移",
            icon: BookOpen,
            action: () => router.push("/transactions")
        },
        {
            id: "nav_settings",
            title: "管理設定",
            description: "システム全体のマスターデータや一般設定を開きます",
            category: "機能・画面遷移",
            icon: Settings,
            action: () => router.push("/settings")
        },

        // --- Master Data ---
        {
            id: "nav_brands",
            title: "ブランド管理 (Master)",
            description: "自社ブランド設定を開きます",
            category: "機能・画面遷移",
            icon: Tag,
            action: () => router.push("/brands")
        },
        {
            id: "nav_stores",
            title: "販売店舗・事業者管理 (Master)",
            description: "委託店舗や取引先事業者の管理画面を開きます",
            category: "機能・画面遷移",
            icon: Store,
            action: () => router.push("/retail-stores")
        },
        {
            id: "nav_recipients",
            title: "スポット宛先管理 (Master)",
            description: "不定期な発送先の管理画面を開きます",
            category: "機能・画面遷移",
            icon: Building2,
            action: () => router.push("/spot-recipients")
        },
        {
            id: "nav_suppliers",
            title: "仕入先管理 (Master)",
            description: "原材料の仕入先や生産者の管理画面を開きます",
            category: "機能・画面遷移",
            icon: Users,
            action: () => router.push("/suppliers")
        },
        {
            id: "nav_mail_settings",
            title: "自動レポート設定 (Master)",
            description: "日報の自動送出先メール設定を開きます",
            category: "機能・画面遷移",
            icon: Mail,
            action: () => router.push("/settings/reports")
        },

        // --- Quick Actions (Parameter Driven) ---
        {
            id: "action_new_expense",
            title: "新規経費の登録 (個別入力・AI領収書スキャン)",
            description: "経費管理を開き、領収書AI読み取りダイアログを自動起動します",
            category: "クイック操作",
            icon: Plus,
            action: () => router.push("/expenses?action=new-expense")
        },
        {
            id: "action_fixed_cost",
            title: "毎月の固定費を一括登録する",
            description: "経費管理を開き、固定費テンプレート一括登録ダイアログを自動起動します",
            category: "クイック操作",
            icon: Plus,
            action: () => router.push("/expenses?action=fixed-cost")
        },
        {
            id: "action_replenish",
            title: "小口現金を補充する (手元金インフロー)",
            description: "経費管理を開き、小口現金の補充用登録フォームを自動起動します",
            category: "クイック操作",
            icon: Plus,
            action: () => router.push("/expenses?action=replenish")
        },
        {
            id: "action_transfer",
            title: "銀行口座へ資金を移管する (手元金アウトフロー)",
            description: "経費管理を開き、銀行への預け入れ登録フォームを自動起動します",
            category: "クイック操作",
            icon: Plus,
            action: () => router.push("/expenses?action=transfer")
        },
        {
            id: "action_new_todo",
            title: "新しいToDo・運営課題を登録する",
            description: "ToDo管理を開き、新しいやることタスクの追加ダイアログを自動起動します",
            category: "クイック操作",
            icon: Plus,
            action: () => router.push("/todo?action=new-todo")
        },
        {
            id: "action_new_manual",
            title: "業務マニュアルを新規作成する (Markdown)",
            description: "マニュアル画面を開き、新規手順書作成エディタを自動起動します",
            category: "クイック操作",
            icon: Plus,
            action: () => router.push("/guidelines?action=new-guideline")
        },

        // --- Manuals / Guidelines ---
        {
            id: "manual_expense",
            title: "マニュアル: 支出・経費管理マニュアル",
            description: "固定費の一括追加やAIレシート読み取りの手順解説を開きます",
            category: "マニュアル・サポート",
            icon: BookOpen,
            action: () => router.push("/guidelines?select=manual_001")
        },
        {
            id: "support_updates",
            title: "アップデート・新機能一覧",
            description: "本システムに追加された最新機能やバージョンの解説を確認します",
            category: "マニュアル・サポート",
            icon: Sparkles,
            action: () => router.push("/updates")
        },
        {
            id: "support_manuals",
            title: "業務フロー・マニュアル一覧",
            description: "登録されているすべての標準業務フロー・マニュアルを表示します",
            category: "マニュアル・サポート",
            icon: BookOpen,
            action: () => router.push("/guidelines")
        }
    ], [router]);

    // Filter command items based on search query
    const filteredCommands = useMemo(() => {
        if (!searchQuery.trim()) return commands;
        const q = searchQuery.toLowerCase();
        return commands.filter(cmd => 
            cmd.title.toLowerCase().includes(q) || 
            cmd.description.toLowerCase().includes(q) || 
            cmd.category.toLowerCase().includes(q)
        );
    }, [searchQuery, commands]);

    // Keep selected index bounded
    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery]);

    // Auto-scroll the list when moving with keyboard arrow keys
    useEffect(() => {
        if (isOpen && itemRefs.current[selectedIndex]) {
            itemRefs.current[selectedIndex]?.scrollIntoView({
                block: "nearest",
                behavior: "smooth"
            });
        }
    }, [selectedIndex, isOpen]);

    // Keyboard handlers
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev => 
                    filteredCommands.length === 0 ? 0 : (prev + 1) % filteredCommands.length
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => 
                    filteredCommands.length === 0 ? 0 : (prev - 1 + filteredCommands.length) % filteredCommands.length
                );
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].action();
                    onClose();
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-start justify-center pt-24 px-4 sm:px-6 transition-all animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-2xl bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[520px] scale-100 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                {/* Search Header */}
                <div className="flex items-center gap-4 px-6 py-4.5 border-b border-slate-100 shrink-0 relative group">
                    <Search className="w-5 h-5 text-slate-400 group-focus-within:text-[#1e3a8a] transition-colors" />
                    <input 
                        ref={inputRef}
                        type="text"
                        placeholder="機能、移動先、またはやりたいアクションを入力..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-slate-700 bg-transparent text-base font-bold focus:outline-none placeholder:text-slate-300 pr-12"
                    />
                    <kbd className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-black text-slate-400 shadow-sm">
                        ESC
                    </kbd>
                </div>

                {/* Body List */}
                <div 
                    ref={listRef}
                    className="flex-1 overflow-y-auto p-3.5 space-y-4 scrollbar-thin scrollbar-thumb-slate-200"
                >
                    {filteredCommands.length === 0 ? (
                        <div className="py-14 text-center space-y-3">
                            <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                                <Search className="w-5 h-5" />
                            </div>
                            <p className="text-sm font-black text-slate-400">一致する機能やアクションが見つかりません</p>
                        </div>
                    ) : (
                        // Grouping commands by category for visually beautiful layouts
                        ["機能・画面遷移", "クイック操作", "マニュアル・サポート"].map((cat) => {
                            const catItems = filteredCommands.filter(cmd => cmd.category === cat);
                            if (catItems.length === 0) return null;

                            return (
                                <div key={cat} className="space-y-1.5">
                                    <h3 className="text-[10px] font-black text-[#1e3a8a] bg-blue-50/50 border border-blue-100/30 px-3 py-1 rounded-lg uppercase tracking-[0.2em] w-fit ml-3 mb-2">{cat}</h3>
                                    <div className="space-y-1">
                                        {catItems.map((cmd) => {
                                            // Find index in the flat list to handle active highlighting properly
                                            const flatIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                                            const isActive = flatIndex === selectedIndex;
                                            
                                            return (
                                                <button
                                                    key={cmd.id}
                                                    ref={(el) => { itemRefs.current[flatIndex] = el; }}
                                                    onClick={() => {
                                                        cmd.action();
                                                        onClose();
                                                    }}
                                                    onMouseEnter={() => setSelectedIndex(flatIndex)}
                                                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all duration-150 ${
                                                        isActive 
                                                            ? "bg-[#1e3a8a] text-white shadow-xl shadow-blue-900/10 scale-[1.01]" 
                                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                    }`}
                                                >
                                                    <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                                                        isActive ? "bg-white/10 text-white" : "bg-slate-50 text-slate-400"
                                                    }`}>
                                                        <cmd.icon className="w-4.5 h-4.5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-sm font-black tracking-tight ${
                                                            isActive ? "text-white" : "text-slate-800"
                                                        }`}>
                                                            {cmd.title}
                                                        </div>
                                                        <div className={`text-xs font-medium truncate mt-0.5 ${
                                                            isActive ? "text-blue-100/80" : "text-slate-400"
                                                        }`}>
                                                            {cmd.description}
                                                        </div>
                                                    </div>
                                                    
                                                    {isActive && (
                                                        <div className="flex items-center gap-1 text-[9px] font-black text-blue-100/60 uppercase tracking-wider shrink-0 bg-white/15 px-2.5 py-1 rounded-lg">
                                                            <span>決定</span>
                                                            <CornerDownLeft className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
