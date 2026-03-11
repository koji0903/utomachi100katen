"use client";

import { use } from "react";
import { TransactionDetailView } from "@/components/TransactionDetailView";

export default function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    
    return (
        <div className="min-h-screen bg-slate-50/30 p-4 sm:p-8">
            <TransactionDetailView id={id} />
        </div>
    );
}
