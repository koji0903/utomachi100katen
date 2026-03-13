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
                        width: 190mm; /* A4 width minus some margin */
                    }
                    /* Scale specific elements for 80% feel */
                    h3 { font-size: 16px !important; }
                    h4 { font-size: 13px !important; }
                    table, div, p, span { font-size: 11px !important; }
                    .text-xl { font-size: 18px !important; }
                </style>
            </head>
            <body>
                <div id="report-container">${reportHtml}</div>
            </body>
            </html>
        `);
        iframeDoc.close();

        // Wait for iframe resources to settle
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 3. Capture the element inside the isolated iframe
        const captureArea = iframeDoc.getElementById("report-container");
        if (!captureArea) throw new Error("Could not find report container in iframe");

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

        // 5. Multi-page PDF Logic
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        let position = 0;
        const imgData = canvas.toDataURL("image/jpeg", 0.95);

        // Add first page
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Add subsequent pages if content overflows
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(filename);

    } catch (error: any) {
        console.error("PDF Generation Error (Multi-page Iframe):", error);
        alert(`PDFの生成に失敗しました: ${error.message || "未知のエラー"}`);
        throw error;
    }
}
