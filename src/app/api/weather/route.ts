// src/app/api/weather/route.ts
// Server-side proxy for OpenWeatherMap — keeps API key out of client bundle

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!lat || !lon) {
        return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "OPENWEATHER_API_KEY not configured" }, { status: 503 });
    }

    try {
        // Use 2.5/forecast to get future/daily-ish data instead of just 2.5/weather (current)
        // This allows us to find the actual min/max for the rest of today.
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ja`;
        const res = await fetch(url, { next: { revalidate: 1800 } }); // cache 30 min
        if (!res.ok) throw new Error(`OpenWeatherMap error: ${res.status}`);
        const data = await res.json();

        // 1. Current current temp can be taken from the first forecast list item
        const first = data.list?.[0];
        const currentTime = new Date();
        const todayStr = currentTime.toISOString().split('T')[0];

        // 2. Extract all forecast items for "today" to find min/max
        const todayForecasts = data.list?.filter((item: any) => item.dt_txt.startsWith(todayStr)) || [];
        
        let tempMin = first?.main?.temp_min ?? 0;
        let tempMax = first?.main?.temp_max ?? 0;

        if (todayForecasts.length > 0) {
            tempMin = Math.min(...todayForecasts.map((f: any) => f.main.temp_min));
            tempMax = Math.max(...todayForecasts.map((f: any) => f.main.temp_max));
        }

        return NextResponse.json({
            weather: first?.weather?.[0]?.description ?? "",
            main: first?.weather?.[0]?.main ?? "",
            icon: first?.weather?.[0]?.icon ?? "",
            temp: Math.round(first?.main?.temp ?? 0),
            tempMin: Math.round(tempMin),
            tempMax: Math.round(tempMax),
            humidity: first?.main?.humidity ?? 0,
            windSpeed: Math.round((first?.wind?.speed ?? 0) * 10) / 10,
            cityName: data.city?.name ?? "",
        });
    } catch (e) {
        console.error("Weather fetch failed:", e);
        return NextResponse.json({ error: "Failed to fetch weather" }, { status: 502 });
    }
}
