import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAmazonProduct } from "@/lib/amazon";
import { withAuth, internalError, logError } from "@/lib/apiAuth";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, { uid }) => {
    try {
        if (!adminDb) {
            logError("Amazon Diagnostic", new Error("adminDb is not initialized"));
            return internalError();
        }
        const db = adminDb;
        const productsRef = db.collection("products");
        const querySnapshot = await productsRef.where("amazonSyncEnabled", "==", true).get();

        const report = {
            timestamp: new Date().toISOString(),
            totalEnabled: querySnapshot.size,
            items: [] as unknown[]
        };

        for (const productDoc of querySnapshot.docs) {
            const product = { id: productDoc.id, ...productDoc.data() } as {
                id: string;
                name?: string;
                amazonSku?: string;
                stock?: number;
                sellingPrice?: number;
            };
            const sku = product.amazonSku;

            const itemReport: Record<string, unknown> = {
                name: product.name,
                sku,
                status: "checked",
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
                        itemReport.discrepancy =
                            (amazonData.inventoryLevel !== product.stock) ||
                            (amazonData.price !== product.sellingPrice);
                    } else {
                        itemReport.status = "error";
                        itemReport.message = "Amazon APIから情報を取得できませんでした。";
                    }
                } catch (err) {
                    logError("Amazon Diagnostic:item", err, { productId: product.id });
                    itemReport.status = "error";
                    itemReport.message = "Amazon APIとの通信に失敗しました。";
                }
            }
            report.items.push(itemReport);
        }

        return NextResponse.json({ success: true, report });
    } catch (error) {
        logError("Amazon Diagnostic", error, { uid });
        return internalError();
    }
});
