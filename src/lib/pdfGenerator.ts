// src/lib/pdfGenerator.ts
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import DOMPurify from "dompurify";

/**
 * Helper to generate jsPDF instance from an element
 */
async function generatePdfInstance(element: HTMLElement): Promise<jsPDF> {
    try {
        // 1. Create a hidden iframe for isolation
        const iframe = document.createElement("iframe");
        iframe.style.position = "absolute";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error("Could not access iframe document");

        const rawHtml = element.innerHTML;
        const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'em', 'u', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'ul', 'ol', 'li'],
            ALLOWED_ATTR: ['class', 'style', 'id'],
        });

        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <style>
                    * {
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact;
                        line-height: 2.0 !important;
                        overflow: visible !important;
                    }
                    html, body {
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                    }
                    body {
                        color: #1e293b;
                        font-family: -apple-system, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "BIZ UDPGothic", "Meiryo", "Helvetica Neue", Arial, sans-serif;
                    }
                    #report-container {
                        margin: 0;
                        padding: 10mm;
                        background: white;
                        width: 190mm;
                    }
                    h3 { font-size: 16px !important; }
                    h4 { font-size: 13px !important; }
                    table, div, p, span { font-size: 11px !important; }
                    .text-xl { font-size: 18px !important; }
                </style>
            </head>
            <body>
                <div id="report-container">${sanitizedHtml}</div>
            </body>
            </html>
        `);
        iframeDoc.close();

        await new Promise(resolve => setTimeout(resolve, 1000));

        const captureArea = iframeDoc.getElementById("report-container");
        if (!captureArea) throw new Error("Could not find report container in iframe");

        const canvas = await html2canvas(captureArea, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
            logging: false,
        });

        document.body.removeChild(iframe);

        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            throw new Error("Canvas generation failed");
        }

        const pageWidth = 210;
        const pageHeight = 297;
        const topMargin = 15;
        const bottomMargin = 15;
        const printableHeight = pageHeight - topMargin - bottomMargin;

        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        let srcYOffset = 0;

        const addMarginMasks = (doc: jsPDF) => {
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, pageWidth, topMargin, "F");
            doc.rect(0, pageHeight - bottomMargin, pageWidth, bottomMargin, "F");
        };

        let firstPage = true;
        while (heightLeft > 0) {
            if (!firstPage) {
                pdf.addPage();
            }
            const currentImgY = topMargin - srcYOffset;
            pdf.addImage(imgData, "JPEG", 0, currentImgY, imgWidth, imgHeight);
            addMarginMasks(pdf);
            srcYOffset += printableHeight;
            heightLeft -= printableHeight;
            firstPage = false;
        }

        return pdf;

    } catch (error) {
        console.error("PDF Instance Generation Error:", error);
        throw error;
    }
}

/**
 * Generates and downloads the PDF
 */
export async function downloadPdfFromElement(element: HTMLElement, filename: string) {
    try {
        const pdf = await generatePdfInstance(element);
        pdf.save(filename);
    } catch (error: any) {
        alert(`PDFのダウンロードに失敗しました: ${error.message || "未知のエラー"}`);
    }
}

/**
 * Generates PDF and returns as Base64 string for email attachment
 */
export async function getPdfBase64FromElement(element: HTMLElement): Promise<string> {
    try {
        const pdf = await generatePdfInstance(element);
        // jspdf.output('datauristring') returns "data:application/pdf;filename=generated.pdf;base64,..."
        const dataUri = pdf.output("datauristring");
        return dataUri.split(",")[1];
    } catch (error: any) {
        throw new Error(`PDFデータの変換に失敗しました: ${error.message}`);
    }
}

/**
 * Generates PDF and returns as Blob for Storage upload
 */
export async function getPdfBlobFromElement(element: HTMLElement): Promise<Blob> {
    try {
        const pdf = await generatePdfInstance(element);
        return pdf.output("blob");
    } catch (error: any) {
        throw new Error(`PDFのBlob変換に失敗しました: ${error.message}`);
    }
}

/**
 * legacy support - will be removed later
 */
export async function generatePdfFromElement(el: HTMLElement, filename = "document.pdf"): Promise<void> {
    return downloadPdfFromElement(el, filename);
}
