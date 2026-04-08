import { NextResponse } from "next/server";
import { getAmazonOrders } from "@/lib/amazon";

export async function GET() {
    try {
        const results: any = {};
        
        try {
            results.amazonOrders = await getAmazonOrders();
        } catch (e: any) {
            results.amazonOrdersError = e.message;
        }

        return NextResponse.json(results);
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
}
