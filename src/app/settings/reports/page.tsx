// src/app/settings/reports/page.tsx
"use client";

import { AutoReportSettings } from "@/components/AutoReportSettings";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

const BRAND = "#b27f79";

export default function ReportSettingsPage() {
    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors mb-6 group"
                >
                    <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                    設定に戻る
                </Link>

                <AutoReportSettings />
            </div>
        </div>
    );
}
