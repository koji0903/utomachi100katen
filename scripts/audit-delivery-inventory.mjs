import nextEnv from '@next/env';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
if (!serviceAccount.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required');
if (!getApps().length) initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const [documentsSnapshot, movementsSnapshot, productsSnapshot, storesSnapshot, paymentsSnapshot, purchasesSnapshot] = await Promise.all([
  db.collection('issued_documents').get(),
  db.collection('stock_movements').get(),
  db.collection('products').get(),
  db.collection('retailStores').get(),
  db.collection('invoice_payments').get(),
  db.collection('inbound_shipments').get(),
]);
const products = new Map(productsSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
const stores = new Map(storesSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
const movementsByReference = new Map();
for (const snapshot of movementsSnapshot.docs) {
  const movement = snapshot.data();
  if (!movement.referenceId) continue;
  const byProduct = movementsByReference.get(movement.referenceId) || new Map();
  const signed = movement.type === 'in' ? movement.quantity : -movement.quantity;
  byProduct.set(movement.productId, (byProduct.get(movement.productId) || 0) + signed);
  movementsByReference.set(movement.referenceId, byProduct);
}
const effectsFor = document => {
  if (document.isTrashed || document.type !== 'delivery_note' || document.status !== 'issued') return new Map();
  const store = document.storeId ? stores.get(document.storeId) : undefined;
  const linked = document.linkedConsignmentStoreId || store?.linkedConsignmentStoreId;
  if (document.skipInventoryAdjustment ?? Boolean(linked)) return new Map();
  const result = new Map();
  for (const item of document.details || []) {
    const product = products.get(item.productId);
    if (!product) continue;
    const effects = product.isComposite && product.components?.length
      ? product.components.map(component => [component.productId, -(component.quantity * item.quantity)])
      : [[product.id, -item.quantity]];
    for (const [productId, quantity] of effects) result.set(productId, (result.get(productId) || 0) + quantity);
  }
  return result;
};
const equalMaps = (left, right) => {
  const keys = new Set([...left.keys(), ...right.keys()]);
  return [...keys].every(key => (left.get(key) || 0) === (right.get(key) || 0));
};

const deliveryNotes = documentsSnapshot.docs
  .map(snapshot => ({ id: snapshot.id, ...snapshot.data() }))
  .filter(document => document.type === 'delivery_note');
const draftWithMovements = deliveryNotes.filter(document =>
  document.status === 'draft' && !document.isTrashed && (movementsByReference.get(document.id)?.size || 0) > 0,
);
const activeIssued = deliveryNotes.filter(document => document.status === 'issued' && !document.isTrashed);
const movementMismatches = activeIssued.filter(document =>
  !equalMaps(effectsFor(document), movementsByReference.get(document.id) || new Map()),
);
const mapToObject = map => Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
const activeDocuments = documentsSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })).filter(document => !document.isTrashed);
const allDocuments = new Map(documentsSnapshot.docs.map(snapshot => [snapshot.id, { id: snapshot.id, ...snapshot.data() }]));
const documentNumbers = new Map();
for (const document of activeDocuments) {
  const ids = documentNumbers.get(document.docNumber) || [];
  ids.push(document.id);
  documentNumbers.set(document.docNumber, ids);
}
const duplicateDocumentNumbers = [...documentNumbers.entries()]
  .filter(([, ids]) => ids.length > 1)
  .map(([docNumber, ids]) => ({ docNumber, ids }));
const invoices = new Map(activeDocuments.filter(document => document.type === 'invoice').map(document => [document.id, document]));
const activePayments = paymentsSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })).filter(payment => !payment.isTrashed);
const orphanPayments = activePayments.filter(payment => !invoices.has(payment.invoiceId));
const invalidPayments = activePayments.filter(payment => !Number.isFinite(payment.amount) || payment.amount <= 0);
const paidByInvoice = new Map();
for (const payment of activePayments) paidByInvoice.set(payment.invoiceId, (paidByInvoice.get(payment.invoiceId) || 0) + payment.amount);
const overpaidInvoices = [...invoices.values()]
  .filter(invoice => (paidByInvoice.get(invoice.id) || 0) > invoice.totalAmount)
  .map(invoice => ({ id: invoice.id, docNumber: invoice.docNumber, totalAmount: invoice.totalAmount, paidAmount: paidByInvoice.get(invoice.id) }));
const purchaseIssues = purchasesSnapshot.docs.flatMap(snapshot => {
  const purchase = snapshot.data();
  if (purchase.isTrashed) return [];
  const issues = [];
  for (const item of purchase.items || []) {
    if (item.receivedQuantity > item.quantity) issues.push('receivedQuantity exceeds quantity');
    if (['received', 'paid'].includes(purchase.status) && item.receivedQuantity !== item.quantity) issues.push('fully received status quantity mismatch');
  }
  return issues.length ? [{ id: snapshot.id, status: purchase.status, issues: [...new Set(issues)] }] : [];
});

if (process.argv.includes('--repair-orphan-payments')) {
  const repairable = orphanPayments.filter(payment => allDocuments.get(payment.invoiceId)?.isTrashed);
  if (repairable.length) {
    const batch = db.batch();
    for (const payment of repairable) {
      batch.update(db.collection('invoice_payments').doc(payment.id), {
        isTrashed: true,
        trashedWithInvoice: true,
      });
    }
    await batch.commit();
    console.error(`repaired orphan payments: ${repairable.length}`);
  }
}

console.log(JSON.stringify({
  deliveryNotes: deliveryNotes.length,
  activeIssued: activeIssued.length,
  activeDrafts: deliveryNotes.filter(document => document.status === 'draft' && !document.isTrashed).length,
  draftWithMovements: draftWithMovements.map(document => ({ id: document.id, docNumber: document.docNumber })),
  movementMismatches: movementMismatches.map(document => ({
    id: document.id,
    docNumber: document.docNumber,
    status: document.status,
    issuedDate: document.issuedDate,
    skipInventoryAdjustment: document.skipInventoryAdjustment,
    linkedConsignmentStoreId: document.linkedConsignmentStoreId,
    expected: mapToObject(effectsFor(document)),
    movements: mapToObject(movementsByReference.get(document.id) || new Map()),
  })),
  duplicateDocumentNumbers,
  orphanPayments: orphanPayments.map(payment => ({
    id: payment.id,
    invoiceId: payment.invoiceId,
    linkedInvoice: allDocuments.get(payment.invoiceId)
      ? { docNumber: allDocuments.get(payment.invoiceId).docNumber, isTrashed: Boolean(allDocuments.get(payment.invoiceId).isTrashed) }
      : null,
    linkedReceipts: [...allDocuments.values()]
      .filter(document => document.type === 'receipt' && document.sourceDocId === payment.id)
      .map(document => ({ id: document.id, docNumber: document.docNumber, isTrashed: Boolean(document.isTrashed) })),
  })),
  invalidPayments: invalidPayments.map(payment => ({ id: payment.id, amount: payment.amount })),
  overpaidInvoices,
  purchaseIssues,
  negativeStockProducts: [...products.values()].filter(product => product.stock < 0).map(product => ({ id: product.id, name: product.name, stock: product.stock })),
}, null, 2));
process.exit(0);
