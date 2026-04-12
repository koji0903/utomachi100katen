import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAmazonProduct } from "@/lib/amazon";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const productsRef = adminDb.collection("products");
        const querySnapshot = await productsRef.where("amazonSyncEnabled", "==", true).get();

        const report = {
            timestamp: new Date().toISOString(),
            totalEnabled: querySnapshot.size,
            items: [] as any[]
        };

        for (const productDoc of querySnapshot.docs) {
            const product = { id: productDoc.id, ...productDoc.data() } as any;
            const sku = product.amazonSku;
            
            const itemReport: any = {
                name: product.name,
                sku: sku,
                status: "checked"
            };

            if (!sku) {
                itemReport.status = "error";
                itemReport.message = "SKUが設定されていません。";
            } else {
                try {
                    const amazonData = await getAmazonProduct(sku);
                    if (amazonData) {
                        itemReport.amazon = amazonData;
                        itemReport.local = {
                            stock: product.stock || 0,
                            price: product.sellingPrice || 0
                        };
                        itemReport.discrepancy = (amazonData.inventoryLevel !== product.stock) || (amazonData.price !== product.sellingPrice);
                    } else {
                        itemReport.status = "error";
                        itemReport.message = "Amazon APIから情報を取得できませんでした。";
                    }
                } catch (err: any) {
                    itemReport.status = "error";
                    itemReport.message = `API通信エラー: ${err.message}`;
                }
            }
            report.items.push(itemReport);
        }

        return NextResponse.json({ success: true, report });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
