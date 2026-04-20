// src/app/api/weather/route.ts
// Server-side proxy for OpenWeatherMap — keeps API key out of client bundle

import { NextResponse } from "next/server";
import { withAuth, logError } from "@/lib/apiAuth";

export const GET = withAuth(async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!lat || !lon) {
        return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
    }
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
        return NextResponse.json({ error: "Invalid lat/lon" }, { status: 400 });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "OPENWEATHER_API_KEY not configured" }, { status: 503 });
    }

    try {
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latNum}&lon=${lonNum}&appid=${apiKey}&units=metric&lang=ja`;
        const res = await fetch(url, { next: { revalidate: 1800 } });
        if (!res.ok) throw new Error(`OpenWeatherMap error: ${res.status}`);
        const data = await res.json();

        const first = data.list?.[0];
        const currentTime = new Date();
        const todayStr = currentTime.toISOString().split("T")[0];

        const todayForecasts = data.list?.filter((item: { dt_txt: string }) => item.dt_txt.startsWith(todayStr)) || [];

        let tempMin = first?.main?.temp_min ?? 0;
        let tempMax = first?.main?.temp_max ?? 0;
        if (todayForecasts.length > 0) {
            tempMin = Math.min(...todayForecasts.map((f: { main: { temp_min: number } }) => f.main.temp_min));
            tempMax = Math.max(...todayForecasts.map((f: { main: { temp_max: number } }) => f.main.temp_max));
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
    } catch (err) {
        logError("weather", err, { uid: ctx.uid });
        return NextResponse.json({ error: "Failed to fetch weather" }, { status: 502 });
    }
});
