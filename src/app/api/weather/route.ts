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
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ja`;
        const res = await fetch(url, { next: { revalidate: 1800 } }); // cache 30 min
        if (!res.ok) throw new Error(`OpenWeatherMap error: ${res.status}`);
        const data = await res.json();

        return NextResponse.json({
            weather: data.weather?.[0]?.description ?? "",
            main: data.weather?.[0]?.main ?? "",
            icon: data.weather?.[0]?.icon ?? "",
            temp: Math.round(data.main?.temp ?? 0),
            tempMin: Math.round(data.main?.temp_min ?? 0),
            tempMax: Math.round(data.main?.temp_max ?? 0),
            humidity: data.main?.humidity ?? 0,
            windSpeed: Math.round((data.wind?.speed ?? 0) * 10) / 10,
            cityName: data.name ?? "",
        });
    } catch (e) {
        console.error("Weather fetch failed:", e);
        return NextResponse.json({ error: "Failed to fetch weather" }, { status: 502 });
    }
}
