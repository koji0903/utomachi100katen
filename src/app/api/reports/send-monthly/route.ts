import { NextResponse } from "next/server";
import { z } from "zod";
import nodemailer from "nodemailer";
import { withAuth, parseJson, internalError, logError } from "@/lib/apiAuth";
import { isRecipientAllowed } from "@/lib/emailWhitelist";

const MAX_PDF_BYTES = 15 * 1024 * 1024;

const storeTotalSchema = z.object({
    storeName: z.string(),
    storeTotalQuantity: z.number(),
    storeTotalAmount: z.number(),
}).passthrough();

const summaryDataSchema = z.object({
    grandTotalAmount: z.number(),
    grandTotalQuantity: z.number(),
    totals: z.array(storeTotalSchema),
}).passthrough();

const bodySchema = z.object({
    recipient: z.string().email().max(254),
    month: z.string().min(1).max(32),
    pdfBase64: z.string().min(1),
    summaryData: summaryDataSchema,
});

export const POST = withAuth(async (req, ctx) => {
    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { recipient, month, pdfBase64, summaryData } = parsed;

    if (pdfBase64.length > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "Attachment too large" }, { status: 413 });
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        logError("reports/send-monthly", new Error("mail env missing"));
        return internalError();
    }

    if (!(await isRecipientAllowed(recipient))) {
        return NextResponse.json({ error: "Recipient not allowed" }, { status: 403 });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        await transporter.verify();

        const reportMonth = month.replace(/-/g, "/");
        const subject = `【売上レポート】${reportMonth}月分 月次売上報告書`;

        const storeBreakdown = summaryData.totals
            .map((s) => `・${s.storeName.padEnd(20)}: ${s.storeTotalQuantity.toLocaleString().padStart(5)}個 / ¥${s.storeTotalAmount.toLocaleString().padStart(10)}`)
            .join("\n");

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
            subject,
            text: textBody,
            attachments: [
                {
                    filename: `monthly_report_${month}.pdf`,
                    content: pdfBase64,
                    encoding: "base64",
                },
            ],
        });

        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (err) {
        logError("reports/send-monthly", err, { uid: ctx.uid });
        return internalError();
    }
});
