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

        // 5. Multi-page PDF Logic with Margins
        const pageWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const topMargin = 15; // 15mm top margin
        const bottomMargin = 15; // 15mm bottom margin
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
        let srcYOffset = 0; // The current vertical offset in the source image (in mm scale relative to pageWidth)

        // Function to add a white mask for margins
        const addMarginMasks = () => {
            pdf.setFillColor(255, 255, 255);
            // Top mask
            pdf.rect(0, 0, pageWidth, topMargin, "F");
            // Bottom mask
            pdf.rect(0, pageHeight - bottomMargin, pageWidth, bottomMargin, "F");
        };

        // Add pages
        let firstPage = true;
        while (heightLeft > 0) {
            if (!firstPage) {
                pdf.addPage();
            }
            
            // Draw the image segment
            // We draw the full image but offset it so the correct segment is in the printable area
            const currentImgY = topMargin - srcYOffset;
            pdf.addImage(imgData, "JPEG", 0, currentImgY, imgWidth, imgHeight);

            // Cover the margins with white rectangles to "cut" the content cleanly
            addMarginMasks();

            srcYOffset += printableHeight;
            heightLeft -= printableHeight;
            firstPage = false;
        }

        pdf.save(filename);

    } catch (error: any) {
        console.error("PDF Generation Error (Multi-page Iframe):", error);
        alert(`PDFの生成に失敗しました: ${error.message || "未知のエラー"}`);
        throw error;
    }
}
