// src/app/api/reports/expenses/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { period, recipient, pdfBase64 } = body;

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            throw new Error("Email configuration missing");
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const info = await transporter.sendMail({
            from: `"ウトマチプラットフォーム" <${process.env.GMAIL_USER}>`,
            to: recipient,
            subject: `支出・経費レポート (${period})`,
            html: `
                <div style="font-family: sans-serif; color: #334155;">
                    <h2>支出・経費レポートのお知らせ</h2>
                    <p>期間: ${period} の経費レポートを添付いたします。</p>
                    <p style="font-size: 12px; color: #64748b;">Utomachi Platformより自動送信</p>
                </div>
            `,
            attachments: [
                {
                    filename: `expense_report_${period}.pdf`,
                    content: pdfBase64.split("base64,")[1],
                    encoding: 'base64'
                }
            ]
        });

        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
        console.error("[Expense Report API] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
