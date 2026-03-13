// src/lib/pdfGenerator.ts
// ─── html2canvas + jsPDF で DOM 要素を A4 PDF に変換 ────────────────────

export async function generatePdfFromElement(el: HTMLElement, filename = "document.pdf"): Promise<void> {
    try {
        // Dynamic import to avoid SSR issues
        const [jsPDFModule, html2canvasModule] = await Promise.all([
            import("jspdf"),
            import("html2canvas"),
        ]);

        const jsPDF = (jsPDFModule as any).jsPDF || (jsPDFModule as any).default;
        const html2canvas = (html2canvasModule as any).default || html2canvasModule;

        if (!jsPDF || !html2canvas) {
            throw new Error("Failed to load PDF generation libraries");
        }

        // Aggressive Iframe Isolation Strategy
        // This is the most robust way to protect html2canvas from global Tailwind 4 styles (lab/oklch)
        
        // 1. Create a hidden iframe
        const iframe = document.createElement("iframe");
        iframe.style.position = "absolute";
        iframe.style.width = el.offsetWidth + "px";
        iframe.style.height = el.offsetHeight + "px";
        iframe.style.top = "-9999px";
        iframe.style.left = "-9999px";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error("Could not create iframe isolation context");

        // 2. Clone the element's inner HTML and write it to the iframe
        // We also inject a safe, minimal HEX-only stylesheet
        const reportHtml = el.innerHTML;
        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        background: white; 
                        color: #1e293b; 
                        font-family: sans-serif;
                    }
                    /* Ensure layout matches as much as possible without Tailwind */
                    div, p, h1, h2, h3, h4, span { display: block; position: relative; }
                    .flex { display: flex; }
                    .items-center { align-items: center; }
                    .justify-between { justify-content: space-between; }
                    .grid { display: grid; }
                    .grid-cols-2 { grid-template-columns: 1fr 1fr; }
                    .gap-4 { gap: 16px; }
                    .mb-6 { margin-bottom: 24px; }
                    .mt-1 { margin-top: 4px; }
                    .p-4 { padding: 16px; }
                    .text-center { text-align: center; }
                    .text-xl { font-size: 20px; }
                    .font-bold { font-weight: bold; }
                    .rounded-2xl { border-radius: 16px; }
                    .border { border: 1px solid #e2e8f0; }
                    .overflow-hidden { overflow: hidden; }
                    .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .text-xs { font-size: 12px; }
                    .text-[10px] { font-size: 10px; }
                    .font-black { font-weight: 900; }
                    .shrink-0 { flex-shrink: 0; }
                    .divide-y > * + * { border-top: 1px solid #f1f5f9; }
                </style>
            </head>
            <body>
                <div style="padding: 24px;">${reportHtml}</div>
            </body>
            </html>
        `);
        iframeDoc.close();

        // Wait for iframe resources to settle
        await new Promise(resolve => setTimeout(resolve, 800));

        // 3. Capture the element inside the isolated iframe
        const captureArea = iframeDoc.body;
        const canvas = await html2canvas(captureArea, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
            logging: false,
        });

        // 4. Cleanup iframe
        document.body.removeChild(iframe);

        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            throw new Error("Canvas generation failed or element has no dimensions");
        }

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
        pdf.save(filename);

    } catch (error: any) {
        console.error("PDF Generation Error (Iframe Isolation):", error);
        alert(`PDFの生成に失敗しました: ${error.message || "未知のエラー"}\n環境依存のスタイル解析エラーを回避するための徹底的な隔離処理を行いましたが、解決に至りませんでした。`);
        throw error;
    }
}
