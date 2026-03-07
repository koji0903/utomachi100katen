// src/lib/taxUtils.ts
// ─── 税率・端数処理 共通ユーティリティ ─────────────────────────────────

export type TaxRateType = 'standard' | 'reduced';
export type RoundingMode = 'floor' | 'round' | 'ceil';

/** 税率マスタ */
export const TAX_RATES: Record<TaxRateType, number> = {
    standard: 0.10,  // 標準税率 10%
    reduced: 0.08,   // 軽減税率  8%
};

/** 税率の表示名 */
export const TAX_RATE_LABELS: Record<TaxRateType, string> = {
    standard: '標準税率（10%）',
    reduced: '軽減税率（8%）',
};

/**
 * 端数処理を適用する
 * @param amount  処理前の金額
 * @param mode    'floor' | 'round' | 'ceil'
 */
export function applyRounding(amount: number, mode: RoundingMode): number {
    switch (mode) {
        case 'ceil': return Math.ceil(amount);
        case 'round': return Math.round(amount);
        case 'floor':
        default: return Math.floor(amount);
    }
}

/**
 * 消費税額・税込合計を計算する
 * @param priceExTax  税抜き金額
 * @param rateType    'standard' | 'reduced'
 * @param rounding    端数処理モード
 */
export function calcTax(
    priceExTax: number,
    rateType: TaxRateType = 'standard',
    rounding: RoundingMode = 'floor'
): {
    taxAmount: number;
    total: number;
    taxRate: number;
} {
    const taxRate = TAX_RATES[rateType];
    const taxAmount = applyRounding(priceExTax * taxRate, rounding);
    const total = priceExTax + taxAmount;
    return { taxAmount, total, taxRate };
}

/**
 * 金額のリストを税率種別に分けて集計する（インボイス用）
 * @param items  { amount: number; rateType: TaxRateType }[]
 * @param rounding
 */
export function summarizeTaxByRate(
    items: { amount: number; rateType?: TaxRateType }[],
    rounding: RoundingMode = 'floor'
): {
    standard: { subtotal: number; taxAmount: number; total: number };
    reduced: { subtotal: number; taxAmount: number; total: number };
    grandTotal: number;
    totalTax: number;
} {
    let standardSubtotal = 0;
    let reducedSubtotal = 0;

    for (const item of items) {
        if (item.rateType === 'reduced') {
            reducedSubtotal += item.amount;
        } else {
            standardSubtotal += item.amount;
        }
    }

    const standardTax = applyRounding(standardSubtotal * TAX_RATES.standard, rounding);
    const reducedTax = applyRounding(reducedSubtotal * TAX_RATES.reduced, rounding);

    return {
        standard: {
            subtotal: standardSubtotal,
            taxAmount: standardTax,
            total: standardSubtotal + standardTax,
        },
        reduced: {
            subtotal: reducedSubtotal,
            taxAmount: reducedTax,
            total: reducedSubtotal + reducedTax,
        },
        grandTotal: standardSubtotal + standardTax + reducedSubtotal + reducedTax,
        totalTax: standardTax + reducedTax,
    };
}
