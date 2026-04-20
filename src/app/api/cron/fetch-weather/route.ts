import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { withCronSecret, logError } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron Job: 毎日全店舗の天気情報を取得して保存する
 * Schedule: 0 3 * * * (JST 12:00)
 */
export const GET = withCronSecret(async () => {
    if (!adminDb) {
        return NextResponse.json({ error: "Firebase Admin is not initialized" }, { status: 500 });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "OPENWEATHER_API_KEY not configured" }, { status: 500 });
    }

    try {
        // 2. Fetch all stores
        const storesSnap = await adminDb.collection("retailStores").where("isTrashed", "==", false).get();
        const stores = storesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

        const results = {
            total: stores.length,
            success: 0,
            failed: 0,
            skipped: 0,
            details: [] as any[]
        };

        const today = new Date();
        const japanTime = new Date(today.getTime() + (9 * 60 * 60 * 1000)); // JST
        const todayStr = japanTime.toISOString().split('T')[0];

        // 3. Process each store
        for (const store of stores) {
            const { lat, lng, name } = store as any;

            if (!lat || !lng) {
                results.skipped++;
                continue;
            }

            try {
                // Fetch from OpenWeatherMap (Forecast API provides min/max)
                const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=ja`;
                const weatherRes = await fetch(weatherUrl);
                
                if (!weatherRes.ok) throw new Error(`Weather API Error: ${weatherRes.status}`);
                
                const data = await weatherRes.json();
                const first = data.list?.[0];
                const todayForecasts = data.list?.filter((item: any) => item.dt_txt.startsWith(todayStr)) || [];

                let tempMin = first?.main?.temp_min ?? 0;
                let tempMax = first?.main?.temp_max ?? 0;

                if (todayForecasts.length > 0) {
                    tempMin = Math.min(...todayForecasts.map((f: any) => f.main.temp_min));
                    tempMax = Math.max(...todayForecasts.map((f: any) => f.main.temp_max));
                }

                const weatherData = {
                    storeId: store.id,
                    date: todayStr,
                    weather: first?.weather?.[0]?.description ?? "不明",
                    weatherMain: first?.weather?.[0]?.main ?? "Clear",
                    temp: Math.round(first?.main?.temp ?? 0),
                    tempMin: Math.round(tempMin),
                    tempMax: Math.round(tempMax),
                    humidity: first?.main?.humidity ?? 0,
                    windSpeed: Math.round((first?.wind?.speed ?? 0) * 10) / 10,
                    updatedAt: new Date().toISOString()
                };

                // Store in Firestore
                const docId = `${store.id}_${todayStr}`;
                await adminDb.collection("daily_weather").doc(docId).set(weatherData, { merge: true });

                results.success++;
                results.details.push({ store: name, status: "success" });

            } catch (err) {
                logError("cron/fetch-weather:store", err, { storeId: store.id });
                results.failed++;
                results.details.push({ store: name, status: "failed" });
            }
        }

        return NextResponse.json(results);

    } catch (err) {
        logError("cron/fetch-weather", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
});
