// src/lib/useZipCode.ts
// 郵便番号 → 住所 自動補完 (zipcloud.ibsnet.co.jp — 無料・APIキー不要)

import { useState, useCallback, useRef } from "react";

type ZipStatus = "idle" | "loading" | "ok" | "notfound" | "error";

export function useZipCode() {
    const [zipStatus, setZipStatus] = useState<ZipStatus>("idle");
    const abortControllerRef = useRef<AbortController | null>(null);

    const lookupZip = useCallback(async (
        rawZip: string,
        onSuccess: (addr: { pref: string; city: string; town: string; full: string }) => void
    ) => {
        const digits = rawZip.replace(/-/g, "");
        if (digits.length !== 7 || !/^\d{7}$/.test(digits)) return;

        // Abort previous request if exists
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setZipStatus("loading");
        try {
            const res = await fetch(
                `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`,
                {
                    cache: "force-cache",
                    signal: controller.signal
                }
            );
            const data = await res.json();
            if (!data.results || data.results.length === 0) {
                setZipStatus("notfound");
                return;
            }
            const r = data.results[0];
            const full = `${r.address1}${r.address2}${r.address3}`;
            onSuccess({ pref: r.address1, city: r.address2, town: r.address3, full });
            setZipStatus("ok");
            setTimeout(() => setZipStatus("idle"), 3000);
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setZipStatus("error");
        }
    }, []);

    return { zipStatus, lookupZip };
}
