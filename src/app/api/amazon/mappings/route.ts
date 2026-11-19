import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, FieldValue } from "@/lib/firebase-admin";
import { listAmazonListings } from "@/lib/amazon";
import { withAuth, parseJson, internalError, logError } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const mappingComponentSchema = z.object({
    productId: z.string().max(128).optional(),
    quantity: z.union([z.number(), z.string()]).optional(),
}).passthrough();

const mappingItemSchema = z.object({
    sku: z.string().max(128).optional(),
    asin: z.string().max(64).optional(),
    amazonTitle: z.string().max(500).optional(),
    components: z.array(mappingComponentSchema).max(50).optional(),
    enabled: z.boolean().optional(),
}).passthrough();

const postMappingsSchema = z.object({
    mappings: z.array(mappingItemSchema).max(500),
});

export interface AmazonSkuMappingComponent {
    productId: string;
    quantity: number;
}

export interface AmazonSkuMappingRecord {
    id: string;
    sku: string;
    asin?: string;
    amazonTitle?: string;
    components: AmazonSkuMappingComponent[];
    enabled: boolean;
    updatedAt?: string | null;
}

const COLLECTION_NAME = "amazon_sku_mappings";

const serializeDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot): AmazonSkuMappingRecord => {
    const data = doc.data();
    const updatedAt =
        data.updatedAt && typeof data.updatedAt.toDate === "function"
            ? data.updatedAt.toDate().toISOString()
            : typeof data.updatedAt === "string"
                ? data.updatedAt
                : null;

    return {
        id: doc.id,
        sku: String(data.sku || ""),
        asin: data.asin ? String(data.asin) : undefined,
        amazonTitle: data.amazonTitle ? String(data.amazonTitle) : undefined,
        components: Array.isArray(data.components)
            ? data.components
                .filter((c: unknown): c is { productId: string; quantity?: unknown } =>
                    Boolean(c && typeof c === "object" && "productId" in c && typeof (c as { productId?: unknown }).productId === "string" && (c as { productId: string }).productId.trim() !== "")
                )
                .map((c) => ({
                    productId: c.productId,
                    quantity: Math.max(1, Number(c.quantity) || 1),
                }))
            : [],
        enabled: data.enabled !== false,
        updatedAt,
    };
};

export const GET = withAuth(async (req, { uid }) => {
    try {
        if (!adminDb) {
            logError("Amazon Mappings GET", new Error("adminDb is not initialized"));
            return internalError();
        }

        const url = new URL(req.url);
        const fetchListings = url.searchParams.get("fetchListings") === "1";

        const snapshot = await adminDb.collection(COLLECTION_NAME).get();
        const mappings = snapshot.docs.map(serializeDoc);

        let listings = undefined;
        let listingsError: string | undefined = undefined;

        if (fetchListings) {
            try {
                listings = await listAmazonListings();
            } catch (err: unknown) {
                logError("Amazon Mappings GET:listings", err, { uid });
                listingsError = "Amazon出品一覧の取得に失敗しました";
            }
        }

        return NextResponse.json({
            success: true,
            mappings,
            listings,
            listingsError,
        });
    } catch (error) {
        logError("Amazon Mappings GET", error, { uid });
        return internalError();
    }
});

export const POST = withAuth(async (req, { uid }) => {
    try {
        if (!adminDb) {
            logError("Amazon Mappings POST", new Error("adminDb is not initialized"));
            return internalError();
        }

        const parsed = await parseJson(req, postMappingsSchema);
        if (parsed instanceof NextResponse) return parsed;

        const normalizedMap = new Map<string, Omit<AmazonSkuMappingRecord, "id" | "updatedAt">>();

        for (const raw of parsed.mappings) {
            if (!raw || typeof raw.sku !== "string") continue;
            const sku = raw.sku.trim();
            if (!sku) continue;

            const components: AmazonSkuMappingComponent[] = Array.isArray(raw.components)
                ? raw.components
                    .filter((c): c is { productId: string; quantity?: number | string } =>
                        Boolean(c && typeof c.productId === "string" && c.productId.trim() !== "")
                    )
                    .map((c) => ({
                        productId: c.productId.trim(),
                        quantity: Math.max(1, Math.floor(Number(c.quantity) || 1)),
                    }))
                : [];

            // コンポーネントが1つ以上あるものだけ保存対象にする（未設定行は保存しない）
            if (components.length === 0) continue;

            normalizedMap.set(sku, {
                sku,
                asin: raw.asin ? String(raw.asin).trim() : "",
                amazonTitle: raw.amazonTitle ? String(raw.amazonTitle).trim() : "",
                components,
                enabled: raw.enabled !== false,
            });
        }

        const colRef = adminDb.collection(COLLECTION_NAME);
        const existingSnap = await colRef.get();

        const targetDocIds = new Set<string>();
        const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

        for (const [sku, record] of normalizedMap.entries()) {
            const docId = encodeURIComponent(sku);
            targetDocIds.add(docId);
            operations.push((b) =>
                b.set(colRef.doc(docId), {
                    sku: record.sku,
                    asin: record.asin || "",
                    amazonTitle: record.amazonTitle || "",
                    components: record.components,
                    enabled: record.enabled,
                    updatedAt: FieldValue.serverTimestamp(),
                })
            );
        }

        for (const doc of existingSnap.docs) {
            if (!targetDocIds.has(doc.id)) {
                operations.push((b) => b.delete(doc.ref));
            }
        }

        const CHUNK_SIZE = 400;
        for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
            const chunk = operations.slice(i, i + CHUNK_SIZE);
            const batch = adminDb.batch();
            for (const op of chunk) {
                op(batch);
            }
            await batch.commit();
        }

        const updatedSnap = await colRef.get();
        return NextResponse.json({
            success: true,
            mappings: updatedSnap.docs.map(serializeDoc),
        });
    } catch (error) {
        logError("Amazon Mappings POST", error, { uid });
        return internalError();
    }
});
