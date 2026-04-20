import { NextResponse } from "next/server";
import { z } from "zod";
import nodemailer from "nodemailer";
import { ReportData } from "@/lib/reportUtils";
import { withAuth, parseJson, internalError, logError } from "@/lib/apiAuth";
import { isRecipientAllowed } from "@/lib/emailWhitelist";

function generateHtmlEmail(data: ReportData) {
    const { weeklySales, storeRanking, productRanking, forecast, restockingRecommendations, period } = data;

    return `
    <div style="font-family: sans-serif; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; background: #f1f5f9; color: #64748b; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Weekly Performance Report</div>
            <h1 style="color: #0f172a; margin: 10px 0;">今週の販売概況レポート</h1>
            <p style="font-size: 12px; color: #94a3b8;">期間: ${period.start} 〜 ${period.end}</p>
        </div>

        <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 30px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 10px;">
                <div style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">今週の総売上</div>
                <div style="font-size: 20px; font-weight: 900; color: #0f172a;">¥${weeklySales.currentAmount.toLocaleString()}</div>
                <div style="font-size: 12px; font-weight: bold; color: ${weeklySales.growthRate >= 0 ? '#10b981' : '#f43f5e'};">
                    ${weeklySales.growthRate >= 0 ? '▲' : '▼'} ${Math.abs(weeklySales.growthRate).toFixed(1)}% <span style="color: #94a3b8; font-weight: normal;">前週比</span>
                </div>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 10px;">
                <div style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">来週の予測</div>
                <div style="font-size: 20px; font-weight: 900; color: #0f172a;">¥${forecast.nextWeekPredictedAmount.toLocaleString()}</div>
                <div style="font-size: 12px; color: #64748b;">トレンド: ${forecast.trend === 'up' ? '上昇基調' : forecast.trend === 'down' ? '低下基調' : '横ばい'}</div>
            </div>
        </div>

        <div style="margin-bottom: 30px;">
            <h3 style="font-size: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 15px;">店舗売上ランキング</h3>
            <table style="width: 100%; font-size: 13px;">
                ${storeRanking.map((s, i) => `
                    <tr>
                        <td style="padding: 4px 0; color: #94a3b8; width: 30px;">${i + 1}</td>
                        <td style="padding: 4px 0; font-weight: bold;">${s.name}</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 900;">¥${s.amount.toLocaleString()}</td>
                    </tr>
                `).join('')}
            </table>
        </div>

        <div style="margin-bottom: 30px;">
            <h3 style="font-size: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 15px;">売れ筋商品ランキング</h3>
            <table style="width: 100%; font-size: 13px;">
                ${productRanking.map((p, i) => `
                    <tr>
                        <td style="padding: 4px 0; color: #94a3b8; width: 30px;">${i + 1}</td>
                        <td style="padding: 4px 0; font-weight: bold;">${p.name}</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 900;">${p.quantity} 個</td>
                    </tr>
                `).join('')}
            </table>
        </div>

        ${restockingRecommendations.length > 0 ? `
        <div style="margin-bottom: 30px;">
            <h3 style="font-size: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 15px; color: #f43f5e;">⚡️ 補充推奨（欠品アラート）</h3>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <tr style="background: #fff1f2; color: #e11d48; font-weight: bold;">
                    <th style="padding: 6px; text-align: left;">商品名</th>
                    <th style="padding: 6px; text-align: right;">現在庫</th>
                    <th style="padding: 6px; text-align: right;">予測</th>
                </tr>
                ${restockingRecommendations.map(r => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 8px 6px;">${r.productName}</td>
                        <td style="padding: 8px 6px; text-align: right; color: #64748b;">${r.currentStock}</td>
                        <td style="padding: 8px 6px; text-align: right; color: #f43f5e; font-weight: bold;">${r.estimatedDaysLeft < 0 ? '欠品中' : r.estimatedDaysLeft + '日'}</td>
                    </tr>
                `).join('')}
            </table>
        </div>
        ` : ''}

        <div style="text-align: center; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            <p style="font-size: 10px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px;">Generated by Utomachi Platform</p>
        </div>
    </div>
    `;
}

const reportDataSchema = z.object({
    period: z.object({
        start: z.string(),
        end: z.string(),
    }),
    weeklySales: z.object({
        currentAmount: z.number().min(0),
        previousAmount: z.number().min(0),
        growthRate: z.number(),
    }),
    storeRanking: z.array(z.object({
        name: z.string().max(200),
        amount: z.number().min(0),
    })).max(100),
    productRanking: z.array(z.object({
        name: z.string().max(200),
        quantity: z.number().int().min(0),
    })).max(100),
    forecast: z.object({
        nextWeekPredictedAmount: z.number().min(0),
        trend: z.enum(['up', 'down', 'stable']),
    }),
    restockingRecommendations: z.array(z.object({
        productId: z.string(),
        productName: z.string().max(200),
        currentStock: z.number().int().min(0),
        estimatedDaysLeft: z.number().int(),
        recommendedQty: z.number().int().min(0),
    })).max(100),
});

const bodySchema = z.object({
    test: z.boolean().optional(),
    recipient: z.string().email().max(254),
    data: reportDataSchema,
});

export const POST = withAuth(async (req, ctx) => {
    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { test, recipient, data } = parsed;

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        logError("reports/send", new Error("mail env missing"));
        return internalError();
    }

    if (!(await isRecipientAllowed(recipient))) {
        return NextResponse.json(
            { error: "Recipient not allowed" },
            { status: 403 },
        );
    }

    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const html = generateHtmlEmail(data as ReportData);
        const info = await transporter.sendMail({
            from: `"ウトマチプラットフォーム" <${process.env.GMAIL_USER}>`,
            to: recipient,
            subject: `${test ? "[TEST] " : ""}販売概況レポート - ${new Date().toLocaleDateString("ja-JP")}`,
            html,
        });

        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (err) {
        logError("reports/send", err, { uid: ctx.uid });
        return internalError();
    }
});
