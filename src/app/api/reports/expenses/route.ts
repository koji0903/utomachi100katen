import { NextResponse } from "next/server";
import { z } from "zod";
import nodemailer from "nodemailer";
import { withAuth, parseJson, internalError, logError } from "@/lib/apiAuth";
import { isRecipientAllowed } from "@/lib/emailWhitelist";

const MAX_PDF_BYTES = 15 * 1024 * 1024;

const bodySchema = z.object({
    period: z.string().min(1).max(64),
    recipient: z.string().email().max(254),
    pdfBase64: z.string().min(1),
});

export const POST = withAuth(async (req, ctx) => {
    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { period, recipient, pdfBase64 } = parsed;

    if (pdfBase64.length > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "Attachment too large" }, { status: 413 });
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        logError("reports/expenses", new Error("mail env missing"));
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

        const base64 = pdfBase64.includes("base64,") ? pdfBase64.split("base64,")[1] : pdfBase64;

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
                    content: base64,
                    encoding: "base64",
                },
            ],
        });

        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (err) {
        logError("reports/expenses", err, { uid: ctx.uid });
        return internalError();
    }
});
