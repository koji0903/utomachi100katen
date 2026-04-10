
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function extract() {
    console.log('--- Unlinked Square Products Report ---');
    const salesSnap = await db.collection('sales').get();
    const unlinkedMap = new Map(); // Name -> { firstSeen, count, lastAmount }

    for (const doc of salesSnap.docs) {
        const data = doc.data();
        const items = data.items || [];
        const hasUnlinked = items.some(i => i.productId === 'SQUARE_UNLINKED');

        if (hasUnlinked && data.transactionId) {
            const itemsSnap = await db.collection('transaction_items').where('transactionId', '==', data.transactionId).get();
            itemsSnap.forEach(iDoc => {
                const item = iDoc.data();
                // Since SQUARE_UNLINKED doesn't tell us WHICH item was unlinked in the sale, 
                // we assume all items in this transaction that don't match a master product are culprits.
                // For simplicity, we just list all items in transactions categorized as unlinked.
                const name = item.productName;
                if (!unlinkedMap.has(name)) {
                    unlinkedMap.set(name, { firstSeen: data.period, count: 0, totalAmount: 0 });
                }
                const stats = unlinkedMap.get(name);
                stats.count += 1;
                stats.totalAmount += item.amount;
            });
        }
    }

    const results = Array.from(unlinkedMap.entries()).map(([name, stats]) => ({
        name,
        ...stats
    })).sort((a, b) => b.count - a.count);

    console.log('NAME | COUNT | TOTAL AMOUNT | FIRST SEEN');
    results.forEach(r => {
        console.log(`${r.name} | ${r.count} | ¥${r.totalAmount.toLocaleString()} | ${r.firstSeen}`);
    });
}

extract().catch(console.error);
