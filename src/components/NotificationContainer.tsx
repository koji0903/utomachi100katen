"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { NotificationData, hideNotification } from "@/lib/notifications";

export function NotificationContainer() {
    const { data: notification } = useSWR<NotificationData | null>("notification", null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (notification) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(hideNotification, 300); // Wait for fade out animation
            }, 3000);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [notification]);

    if (!notification) return null;

    const typeStyles = {
        success: "bg-emerald-50 border-emerald-200 text-emerald-800",
        error: "bg-red-50 border-red-200 text-red-800",
        info: "bg-blue-50 border-blue-200 text-blue-800",
    };

    const Icons = {
        success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
    };

    return (
        <div
            className={`fixed top-6 right-6 z-[9999] transition-all duration-300 transform ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
                }`}
        >
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[300px] ${typeStyles[notification.type]}`}>
                <div className="shrink-0">{Icons[notification.type]}</div>
                <div className="flex-1 text-sm font-medium">{notification.message}</div>
                <button
                    onClick={() => setIsVisible(false)}
                    className="shrink-0 p-1 hover:bg-black/5 rounded-full transition-colors"
                >
                    <X className="w-4 h-4 opacity-50" />
                </button>
            </div>
        </div>
    );
}
