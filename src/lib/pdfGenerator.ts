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

        // Wait a bit to ensure all images (like logo) are fully rendered
        await new Promise(resolve => setTimeout(resolve, 500));

        // 1. Capture the element with "Deep Cleaning"
        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
            logging: false,
            onclone: (clonedDoc: Document) => {
                // Aggressive Sanitization: Remove ALL existing stylesheets and link tags
                // This prevents html2canvas from attempting to parse Tailwind 4's modern color functions (lab/oklch)
                const styles = clonedDoc.getElementsByTagName("style");
                const links = clonedDoc.getElementsByTagName("link");
                
                for (let i = styles.length - 1; i >= 0; i--) {
                    styles[i].parentNode?.removeChild(styles[i]);
                }
                for (let i = links.length - 1; i >= 0; i--) {
                    if (links[i].rel === "stylesheet") {
                        links[i].parentNode?.removeChild(links[i]);
                    }
                }

                // Inject a minimal, safe stylesheet for basic layout if needed
                const safeStyle = clonedDoc.createElement("style");
                safeStyle.innerHTML = `
                    * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                    body { background: white !important; color: #1e293b !important; font-family: sans-serif !important; }
                `;
                clonedDoc.head.appendChild(safeStyle);
            }
        });

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
        console.error("PDF Generation Error (Sanitized Capture):", error);
        alert(`PDFの生成に失敗しました: ${error.message || "未知のエラー"}\n環境依存のスタイル解析エラーを回避するためのクリーニング処理を行いましたが、解決に至りませんでした。`);
        throw error;
    }
}
