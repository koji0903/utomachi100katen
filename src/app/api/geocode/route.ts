// src/app/api/geocode/route.ts
// 日本語住所 → 緯度経度 変換プロキシ
// 国土地理院 住所検索API (無料・APIキー不要) をメインに使用
// フォールバック: OpenWeatherMap Geocoding API

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const address: string = (body.address ?? "").trim();

    if (!address) {
        return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    // ─── 1st: 国土地理院 住所検索API (日本語住所に最適・APIキー不要) ─────────
    try {
        const encoded = encodeURIComponent(address);
        const gsiUrl = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encoded}`;
        const gsiRes = await fetch(gsiUrl, { headers: { "Accept": "application/json" } });

        if (gsiRes.ok) {
            const gsiData = await gsiRes.json();
            // Response is GeoJSON FeatureCollection — pick first result
            if (Array.isArray(gsiData) && gsiData.length > 0) {
                const [lng, lat] = gsiData[0].geometry.coordinates;
                return NextResponse.json({ lat, lng });
            }
        }
    } catch (e) {
        console.warn("GSI geocoding failed, trying fallback:", e);
    }

    // ─── 2nd fallback: OpenWeatherMap Geocoding API ─────────────────────────
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (apiKey) {
        try {
            const encoded = encodeURIComponent(address);
            const owmUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encoded}&limit=1&appid=${apiKey}`;
            const owmRes = await fetch(owmUrl);
            if (owmRes.ok) {
                const owmData = await owmRes.json();
                if (owmData.length > 0) {
                    return NextResponse.json({ lat: owmData[0].lat, lng: owmData[0].lon });
                }
            }
        } catch (e) {
            console.error("OWM geocoding also failed:", e);
        }
    }

    return NextResponse.json({ error: "住所から座標を取得できませんでした" }, { status: 404 });
}
