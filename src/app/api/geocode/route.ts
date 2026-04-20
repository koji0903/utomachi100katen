// src/app/api/geocode/route.ts
// 日本語住所 → 緯度経度 変換プロキシ
// 国土地理院 住所検索API (無料・APIキー不要) をメインに使用
// フォールバック: OpenWeatherMap Geocoding API

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseJson, logError } from "@/lib/apiAuth";

const bodySchema = z.object({
    address: z.string().min(1).max(400),
});

export const POST = withAuth(async (req, ctx) => {
    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;
    const address = parsed.address.trim();

    try {
        const encoded = encodeURIComponent(address);
        const gsiUrl = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encoded}`;
        const gsiRes = await fetch(gsiUrl, { headers: { Accept: "application/json" } });

        if (gsiRes.ok) {
            const gsiData = await gsiRes.json();
            if (Array.isArray(gsiData) && gsiData.length > 0) {
                const [lng, lat] = gsiData[0].geometry.coordinates;
                return NextResponse.json({ lat, lng });
            }
        }
    } catch (err) {
        logError("geocode/gsi", err, { uid: ctx.uid });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (apiKey) {
        try {
            const encoded = encodeURIComponent(address);
            const owmUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encoded}&limit=1&appid=${apiKey}`;
            const owmRes = await fetch(owmUrl);
            if (owmRes.ok) {
                const owmData = await owmRes.json();
                if (Array.isArray(owmData) && owmData.length > 0) {
                    return NextResponse.json({ lat: owmData[0].lat, lng: owmData[0].lon });
                }
            }
        } catch (err) {
            logError("geocode/owm", err, { uid: ctx.uid });
        }
    }

    return NextResponse.json({ error: "住所から座標を取得できませんでした" }, { status: 404 });
});
