"use client";

import { useAuth } from "@/lib/authContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

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
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
