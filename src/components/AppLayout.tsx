"use client";

import { useAuth } from "@/lib/authContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Menu } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Close drawer on route change
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!loading && !user && pathname !== "/login") {
            router.push("/login");
        } else if (!loading && user && pathname === "/login") {
            router.push("/");
        }
    }, [user, loading, router, pathname]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
                読み込み中...
            </div>
        );
    }

    // If not logged in & not on login page, render nothing while redirecting
    if (!user && pathname !== "/login") {
        return null;
    }

    // If on login page, just render the login page without the sidebar
    if (pathname === "/login") {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-800">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                {/* Mobile header bar */}
                <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 flex-shrink-0 z-30">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-label="メニューを開く"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <h1 className="text-base font-bold text-[#1e3a8a] tracking-wide">
                        ウトマチ百貨店
                    </h1>
                </header>

                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
