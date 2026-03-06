"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Package, LayoutDashboard, ShoppingCart, Users, Settings, Tag, LogOut, Store, Truck } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export function Sidebar() {
  const pathname = usePathname();

  const navigation = [
    { name: "ダッシュボード", href: "/dashboard", icon: LayoutDashboard },
    { name: "商品管理", href: "/", icon: Package },
    { name: "ブランド管理", href: "/brands", icon: Tag },
    { name: "販売店舗管理", href: "/retail-stores", icon: Store },
    { name: "仕入先管理", href: "/suppliers", icon: Users },
    { name: "仕入れ管理", href: "/purchases", icon: Truck },
    { name: "注文管理", href: "/orders", icon: ShoppingCart },
    { name: "設定", href: "/settings", icon: Settings },
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

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center px-6 border-b border-slate-200">
        <h1 className="text-xl font-bold text-[#1e3a8a] tracking-wider">
          ウトマチ百貨店
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${isActive
                  ? "bg-slate-100 text-[#1e3a8a] shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
              >
                <item.icon
                  className={`flex-shrink-0 mr-3 h-5 w-5 ${isActive ? "text-[#1e3a8a]" : "text-slate-400 group-hover:text-slate-500"
                    }`}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-slate-200 p-4">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-slate-600 rounded-md hover:bg-red-50 hover:text-red-700 transition-colors group"
        >
          <LogOut className="flex-shrink-0 mr-3 h-5 w-5 text-slate-400 group-hover:text-red-500" aria-hidden="true" />
          ログアウト
        </button>
      </div>
      <div className="p-4 text-xs text-slate-400 text-center">
        © {new Date().getFullYear()} Utomachi
      </div>
    </div>
  );
}
