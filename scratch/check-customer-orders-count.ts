// scratch/check-customer-orders-count.ts
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
} catch (err: any) {}

process.env.NEXT_PUBLIC_USE_EMULATOR = "false";
delete process.env.FIRESTORE_EMULATOR_HOST;

async function check() {
    const { getAdminDb } = await import("../src/lib/firebase-admin");
    const db = getAdminDb();
    if (!db) return;

    const snap = await db.collection("transactions")
        .where("customerName", "==", "清瀧 誠司")
        .get();

    for (const doc of snap.docs) {
        console.log(`取引 ID: ${doc.id}`);
        console.log(`- customerName: ${doc.data().customerName}`);
        console.log(`- isRepeatCustomer: ${doc.data().isRepeatCustomer}`);
        console.log(`- shopifyOrdersCount: ${doc.data().shopifyOrdersCount}`);
    }
}
check();
