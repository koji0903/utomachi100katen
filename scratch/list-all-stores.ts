// scratch/list-all-stores.ts
import fs from "fs";
import path from "path";

// env vars
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

async function listAllStores() {
    const { getAdminDb } = await import("../src/lib/firebase-admin");
    const db = getAdminDb();
    if (!db) {
        console.error("No DB connection.");
        return;
    }

    console.log("=== 登録されているすべての店舗一覧 ===");
    try {
        const snap = await db.collection("retailStores")
            .where("isTrashed", "==", false)
            .get();

        if (snap.empty) {
            console.log("有効な店舗データは1件も登録されていません。");
            return;
        }

        snap.docs.forEach((doc) => {
            const data = doc.data();
            console.log(`- 店舗名: "${data.name}" (ID: ${doc.id})`);
        });

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

listAllStores();
