// src/app/api/square/sync/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSquareOrders, updateSquareInventory, findSquareCatalogByJan } from "@/lib/square";
import { withAuth, parseJson, internalError, logError } from "@/lib/apiAuth";

/**
 * Square Proxy API: サーバー側でしか実行できない Square API 通信を代行する。
 * Firestore へのアクセスは行わない。
 */

const inventoryUpdateSchema = z.object({
    catalogObjectId: z.string().min(1).max(200),
    quantity: z.number().int().min(0),
});

const bodySchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("fetch-orders"),
        locationId: z.string().min(1).max(200).optional(),
    }),
    z.object({
        action: z.literal("update-inventory"),
        locationId: z.string().min(1).max(200).optional(),
        inventoryUpdates: z.array(inventoryUpdateSchema).min(1).max(500),
    }),
    z.object({
        action: z.literal("find-catalog"),
        janCode: z.string().min(1).max(64),
    }),
]);

export const POST = withAuth(async (req, { uid }) => {
    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;

    try {
        const squareLocationId =
            ("locationId" in parsed && parsed.locationId) ||
            process.env.SQUARE_LOCATION_ID;

        if (parsed.action === "fetch-orders") {
            if (!squareLocationId) {
                return NextResponse.json({ error: "Location ID missing" }, { status: 400 });
            }
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const beginTime = sevenDaysAgo.toISOString();
            const orders = await getSquareOrders(squareLocationId, beginTime);
            return NextResponse.json({ success: true, orders, locationId: squareLocationId });
        }

        if (parsed.action === "update-inventory") {
            if (!squareLocationId) {
                return NextResponse.json({ error: "Location ID missing" }, { status: 400 });
            }
            await updateSquareInventory(squareLocationId, parsed.inventoryUpdates);
            return NextResponse.json({ success: true });
        }

        if (parsed.action === "find-catalog") {
            const catalogObj = await findSquareCatalogByJan(parsed.janCode);
            return NextResponse.json({ success: true, catalogObj });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        logError("Square Sync", error, { uid, action: parsed.action });
        return internalError();
    }
});
