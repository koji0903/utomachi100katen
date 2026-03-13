// src/app/api/reports/send-monthly/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { recipient, month, pdfBase64, summaryData } = body;

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            throw new Error("メール送信設定（環境変数）が不足しています。");
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const reportMonth = month.replace(/-/g, "/");
        const subject = `【売上レポート】${reportMonth}月分 月次売上報告書`;

        // Generate text body for the email
        const textBody = `
ウトマチ 運営担当者 様

${reportMonth}月の月次売上レポートをお送りいたします。
詳細は添付のPDFファイルをご確認ください。

【${reportMonth}月 売上概況】
・合計売上額: ¥${summaryData.grandTotalAmount.toLocaleString()}
・合計売上個数: ${summaryData.grandTotalQuantity.toLocaleString()} 個
・店舗数: ${summaryData.totals.length} 店舗

---
ウトマチプラットフォーム
Automated Reporting System
        `.trim();

        const info = await transporter.sendMail({
            from: `"ウトマチプラットフォーム" <${process.env.GMAIL_USER}>`,
            to: recipient,
            subject: subject,
            text: textBody,
            attachments: [
                {
                    filename: `monthly_report_${month}.pdf`,
                    content: pdfBase64,
                    encoding: 'base64'
                }
            ]
        });

        console.log(`[Email API] Monthly report sent to: ${recipient}, MessageID: ${info.messageId}`);

        return NextResponse.json({ success: true, message: "Email sent successfully" });
    } catch (error: any) {
        console.error("[Email API] Monthly Report Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
