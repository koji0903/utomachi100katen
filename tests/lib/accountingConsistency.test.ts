import { describe, expect, it } from 'vitest';
import { getInvoicePaymentError } from '@/lib/accountingConsistency';

describe('accountingConsistency', () => {
    it('請求残高を超える入金を拒否する', () => {
        expect(getInvoicePaymentError(10000, [{ id: 'p1', amount: 7000 }], 4000))
            .toBe('入金額が請求残高（¥3,000）を上回っています。');
    });

    it('入金編集時は編集中の金額を二重計上しない', () => {
        expect(getInvoicePaymentError(10000, [
            { id: 'p1', amount: 7000 },
            { id: 'p2', amount: 3000 },
        ], 3000, 'p2')).toBeNull();
    });

    it('削除済み入金を残高計算から除外する', () => {
        expect(getInvoicePaymentError(10000, [{ id: 'p1', amount: 9000, isTrashed: true }], 10000)).toBeNull();
    });

    it('0円・負数・非数値を拒否する', () => {
        expect(getInvoicePaymentError(10000, [], 0)).not.toBeNull();
        expect(getInvoicePaymentError(10000, [], -1)).not.toBeNull();
        expect(getInvoicePaymentError(10000, [], Number.NaN)).not.toBeNull();
    });
});
