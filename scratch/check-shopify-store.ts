// scratch/check-shopify-store.ts
import fs from "fs";
import path from "path";

// .env.local を手動でパースして環境変数に設定する
try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, "utf-8");
        envConfig.split("\n").forEach((line) => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || "";
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
    }
} catch (err: any) {
    console.error("Failed to load env:", err.message);
}

async function checkStore() {
    const { getAdminDb } = await import("../src/lib/firebase-admin");
    const db = getAdminDb();
    if (!db) {
        console.error("No DB connection.");
        return;
    }

    console.log("=== Shopify店舗情報の照会 ===");
    try {
        const snap = await db.collection("retailStores")
            .where("name", "==", "Shopify")
            .where("isTrashed", "==", false)
            .get();

        if (!snap.empty) {
            const doc = snap.docs[0];
            const data = doc.data();
            console.log(`店舗名: ${data.name}`);
            console.log(`店舗ドキュメントID (storeId): ${doc.id}`);
            console.log(`手数料率 (commissionRate): ${data.commissionRate || 0}%`);
            console.log(`その他の情報: ${JSON.stringify(data, null, 2)}`);
        } else {
            console.log("「Shopify」という名前の店舗ドキュメントは存在しません。");
        }
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

checkStore();
