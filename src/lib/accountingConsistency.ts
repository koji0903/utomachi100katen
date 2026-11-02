export type PaymentLike = {
    id?: string;
    amount: number;
    isTrashed?: boolean;
};

export function getInvoicePaymentError(
    invoiceTotal: number,
    payments: PaymentLike[],
    amount: number,
    excludePaymentId?: string,
): string | null {
    if (!Number.isFinite(amount) || amount <= 0) {
        return '入金額は0円より大きい金額を入力してください。';
    }
    const alreadyPaid = payments
        .filter(payment => !payment.isTrashed && payment.id !== excludePaymentId)
        .reduce((sum, payment) => sum + payment.amount, 0);
    const remaining = Math.max(0, invoiceTotal - alreadyPaid);
    if (amount > remaining) {
        return `入金額が請求残高（¥${remaining.toLocaleString()}）を上回っています。`;
    }
    return null;
}
