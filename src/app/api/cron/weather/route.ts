// src/app/api/cron/weather/route.ts
// To be triggered daily at a scheduled time.
// Since Vercel Cron is often fixed, we can run it every hour and check if current hour matches system setting.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";

// Secret key for cron (CRON_SECRET env var)
const CRON_SECRET = process.env.CRON_SECRET || "development-secret";

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        // 1. Check current time (JST)
        const now = new Date();
        const jstOffset = 9 * 60; // JST is UTC+9
        const jstDate = new Date(now.getTime() + (jstOffset + now.getTimezoneOffset()) * 60000);
        const currentHour = jstDate.getHours();
        const currentMinute = jstDate.getMinutes();
        const dateStr = jstDate.toISOString().split('T')[0];

        // 2. Get Settings
        const settingsSnap = await getDoc(doc(db, "company_settings", "main"));
        const settings = settingsSnap.exists() ? settingsSnap.data() : { weatherFetchTime: "14:00" };
        const fetchTime = settings.weatherFetchTime || "14:00";
        const [fetchHour] = fetchTime.split(':').map(Number);

        // check if it's the right hour
        // Note: For hourly cron, we just check the hour.
        if (currentHour !== fetchHour) {
            return NextResponse.json({ message: `Skipping. Current hour ${currentHour} is not fetch hour ${fetchHour}.` });
        }

        // 3. Fetch all stores
        const storesSnap = await getDocs(collection(db, "retailStores"));
        const stores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) throw new Error("OPENWEATHER_API_KEY not configured");

        const results = [];

        for (const store of stores as any) {
            if (!store.lat || !store.lng) continue;

            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${store.lat}&lon=${store.lng}&appid=${apiKey}&units=metric&lang=ja`;
            const weatherRes = await fetch(url);
            if (!weatherRes.ok) {
                console.error(`Failed to fetch weather for store ${store.name}`);
                continue;
            }
            const data = await weatherRes.json();

            const weatherRecord = {
                id: `${store.id}_${dateStr}`,
                storeId: store.id,
                date: dateStr,
                weather: data.weather?.[0]?.description ?? "",
                weatherMain: data.weather?.[0]?.main ?? "",
                temp: Math.round(data.main?.temp ?? 0),
                humidity: data.main?.humidity ?? 0,
                windSpeed: Math.round((data.wind?.speed ?? 0) * 10) / 10,
                updatedAt: serverTimestamp(),
            };

            await setDoc(doc(db, "daily_weather", weatherRecord.id), weatherRecord);
            results.push({ store: store.name, status: "ok" });
        }

        return NextResponse.json({ date: dateStr, processed: results.length, details: results });
    } catch (e: any) {
        console.error("Cron weather fetch failed:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
