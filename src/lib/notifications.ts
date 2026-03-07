"use client";

import { mutate } from "swr";

export type NotificationType = "success" | "error" | "info";

export interface NotificationData {
    message: string;
    type: NotificationType;
}

export function showNotification(message: string, type: NotificationType = "success") {
    mutate("notification", { message, type }, false);
}

export function hideNotification() {
    mutate("notification", null, false);
}
