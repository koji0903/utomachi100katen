// src/app/api/reports/send-monthly/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { recipient, month, pdfBase64, summaryData } = body;

        // Logging payload stats for debugging
        const payloadSize = JSON.stringify(body).length;
        const pdfSize = pdfBase64?.length ?? 0;
        console.log(`[Email API] Incoming Monthly Report Request. Rcvd Payload: ${(payloadSize / 1024 / 1024).toFixed(2)}MB, PDF: ${(pdfSize / 1024 / 1024).toFixed(2)}MB`);

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            const missing = [];
            if (!process.env.GMAIL_USER) missing.push("GMAIL_USER");
            if (!process.env.GMAIL_APP_PASSWORD) missing.push("GMAIL_APP_PASSWORD");
            throw new Error(`メール送信設定（環境変数: ${missing.join(", ")}）が不足しています。Vercelのプロジェクト設定を確認してください。`);
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        // Test connection
        try {
            await transporter.verify();
        } catch (authError: any) {
            console.error("[Email API] SMTP Auth Error:", authError);
            throw new Error(`メール送信サーバーへの認証に失敗しました。アプリパスワードが正しいか確認してください。 (AuthError: ${authError.message})`);
        }

        const reportMonth = month.replace(/-/g, "/");
        const subject = `【売上レポート】${reportMonth}月分 月次売上報告書`;

        // Generate store-wise summary for the email body
        const storeBreakdown = summaryData.totals.map((s: any) => 
            `・${s.storeName.padEnd(20)}: ${s.storeTotalQuantity.toLocaleString().padStart(5)}個 / ¥${s.storeTotalAmount.toLocaleString().padStart(10)}`
        ).join('\n');

        // Generate text body for the email
        const textBody = `
ウトマチ 運営担当者 様

${reportMonth}月の月次売上レポートをお送りいたします。
売上概況および店舗別の集計結果を以下の通りお知らせいたします。
詳細は添付のPDFファイルをご確認ください。

【${reportMonth}月 売上概況】
・合計売上額: ¥${summaryData.grandTotalAmount.toLocaleString()}
・合計売上個数: ${summaryData.grandTotalQuantity.toLocaleString()} 個
・対象店舗数: ${summaryData.totals.length} 店舗

【店舗別売上サマリ】
${storeBreakdown}

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
