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
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-900 font-sans">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
                {/* Mobile header bar */}
                <header className="lg:hidden flex items-center justify-between px-5 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex-shrink-0 z-30 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2.5 -ml-2 rounded-xl text-slate-600 hover:text-[#1e3a8a] hover:bg-slate-100 transition-all active:scale-95"
                            aria-label="メニューを開く"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-lg font-black text-[#1e3a8a] tracking-tight">
                            ウトマチ百貨店
                        </h1>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-[#f8fafc]">
                    <div className="max-w-[1600px] mx-auto min-h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
