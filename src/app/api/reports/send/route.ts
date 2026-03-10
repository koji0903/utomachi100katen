// src/app/api/reports/send/route.ts
import { NextResponse } from "next/server";
import { generateReportData, ReportData } from "@/lib/reportUtils";
import nodemailer from "nodemailer";

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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { test, recipient, data } = body;

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            const missing = [];
            if (!process.env.GMAIL_USER) missing.push("GMAIL_USER");
            if (!process.env.GMAIL_APP_PASSWORD) missing.push("GMAIL_APP_PASSWORD");
            throw new Error(`Environment variables missing: ${missing.join(", ")}. Please check your .env.local file and restart the dev server.`);
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const html = generateHtmlEmail(data);

        console.log(`[Email API] Attempting to send email to: ${recipient} from: ${process.env.GMAIL_USER}`);

        const info = await transporter.sendMail({
            from: `"ウトマチプラットフォーム" <${process.env.GMAIL_USER}>`,
            to: recipient,
            subject: `${test ? '[TEST] ' : ''}販売概況レポート - ${new Date().toLocaleDateString('ja-JP')}`,
            html: html,
        });

        console.log(`[Email API] SendMail result:`, info);

        return NextResponse.json({ success: true, message: "Email sent successfully", messageId: info.messageId });
    } catch (error: any) {
        console.error("[Email API] Detailed Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
