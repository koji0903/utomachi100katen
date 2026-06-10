// scratch/inspect-all-production-stores.ts
import fs from "fs";
import path from "path";

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

// エミュレータを強制的に無効化して本番へ接続する
process.env.NEXT_PUBLIC_USE_EMULATOR = "false";
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

async function inspectAllStores() {
    console.log("=== 本番環境の全店舗データの取得 (ゴミ箱含む) ===");

    const { getAdminDb } = await import("../src/lib/firebase-admin");
    const db = getAdminDb();
    if (!db) {
        console.error("本番DBへの接続に失敗しました。");
        return;
    }

    try {
        const snap = await db.collection("retailStores").get();
        console.log(`総登録件数: ${snap.size} 件`);

        snap.docs.forEach((doc) => {
            const data = doc.data();
            console.log(`- ID: ${doc.id}`);
            console.log(`  店舗名: "${data.name}"`);
            console.log(`  isTrashed: ${data.isTrashed}`);
            console.log(`   commissionRate: ${data.commissionRate}%`);
        });

    } catch (error: any) {
        console.error("Error:", error.message);
    }
}

inspectAllStores();
