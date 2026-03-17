"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Package, LayoutDashboard, ShoppingCart, Users, Settings, Tag, LogOut, Store, Truck, BarChart3, CreditCard, BarChart2, X, FileText, CloudSun, Archive, BookOpen, AlertCircle, Trash2, Building2, Mail, Sparkles, Printer } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { CURRENT_VERSION } from "@/lib/version";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();

  const groups = [
    {
      label: "業務（デイリー）",
      items: [
        { name: "ダッシュボード", href: "/", icon: LayoutDashboard },
        { name: "売上入力", href: "/sales", icon: BarChart3 },
        { name: "業務日報", href: "/reports", icon: FileText },
        { name: "課題・ToDo管理", href: "/todo", icon: AlertCircle },
        { name: "印刷アーカイブ", href: "/print-archive", icon: Printer },
      ]
    },
    {
      label: "在庫・仕入れ",
      items: [
        { name: "商品管理", href: "/products", icon: Package },
        { name: "仕入管理", href: "/purchases", icon: Truck },
        { name: "在庫管理", href: "/inventory", icon: Archive },
        { name: "支払い管理", href: "/payments", icon: CreditCard },
        { name: "注文管理", href: "/orders", icon: ShoppingCart },
      ]
    },
    {
      label: "分析・報告",
      items: [
        { name: "分析・事業報告", href: "/analytics", icon: BarChart2 },
        { name: "取引管理", href: "/transactions", icon: BookOpen },
        { name: "帳票アーカイブ", href: "/documents", icon: Archive },
      ]
    },
    {
      label: "マスタ・設定",
      items: [
        { name: "ブランド管理", href: "/brands", icon: Tag },
        { name: "販売店舗・事業者管理", href: "/retail-stores", icon: Store },
        { name: "スポット宛先管理", href: "/spot-recipients", icon: Building2 },
        { name: "仕入先管理", href: "/suppliers", icon: Users },
        { name: "自動レポート設定", href: "/settings/reports", icon: Mail },
        { name: '管理設定', href: '/settings', icon: Settings },
      ]
    },
    {
      label: "サポート",
      items: [
        { name: "ご利用ガイド", href: "/guidelines", icon: BookOpen },
        { name: "アップデート・機能一覧", href: "/updates", icon: Sparkles },
      ]
    }
  ];

  const router = useRouter();

  const handleLogout = async () => {
    if (window.confirm("ログアウトしてもよろしいですか？")) {
      try {
        await signOut(auth);
        router.push("/login");
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }
  };

  const handleNavClick = () => {
    // Close drawer on mobile after navigation
    onClose?.();
  };

  const sidebarContent = (
    <div className="flex h-full w-72 flex-col border-r border-slate-200/60 bg-white shadow-[1px_0_0_0_rgba(0,0,0,0.02)]">
      <div className="flex h-20 items-center justify-between px-8 border-b border-slate-100 shrink-0">
        <h1 className="text-xl font-black text-[#1e3a8a] tracking-tighter flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1e3a8a] rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Store className="w-5 h-5" />
          </div>
          ウトマチ百貨店
        </h1>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-[#1e3a8a] hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200 active:scale-95"
            aria-label="メニューを閉じる"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 scrollbar-hide">
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">{group.label}</h2>
            <nav className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={handleNavClick}
                    className={`group flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${isActive
                      ? "bg-[#1e3a8a] text-white shadow-md shadow-blue-900/10 translate-x-1"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1"
                      }`}
                  >
                    <item.icon
                      className={`flex-shrink-0 mr-3.5 h-5 w-5 transition-colors ${isActive ? "text-white" : "text-slate-400 group-hover:text-[#1e3a8a]"
                        }`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-3 text-sm font-bold text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all border border-transparent hover:border-red-100 group"
        >
          <LogOut className="flex-shrink-0 mr-3.5 h-5 w-5 text-slate-400 group-hover:text-red-500" aria-hidden="true" />
          ログアウト
        </button>
      </div>
      <div className="pb-6 px-6 text-[10px] font-bold text-slate-300 tracking-widest text-center uppercase flex flex-col items-center gap-1">
        <Link href="/updates" className="hover:text-[#1e3a8a] transition-colors cursor-pointer">
          {CURRENT_VERSION}
        </Link>
        <span>© {new Date().getFullYear()} ウトマチ平台 / UTOMACHI Platform</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: permanent sidebar */}
      <div className="hidden lg:flex h-full flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile: slide-over drawer */}
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-[70] flex flex-col transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
