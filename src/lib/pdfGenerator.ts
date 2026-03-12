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

        // 1. Capture the element once
        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            allowTaint: false, // Setting to true prevents toDataURL on cross-origin images
            backgroundColor: "#ffffff",
            logging: false,
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
        console.error("PDF Generation Error:", error);
        alert(`PDFの生成に失敗しました: ${error.message || "未知のエラー"}\nブラウザのメモリ不足や、外部画像の読み込み制限が原因の可能性があります。`);
        throw error;
    }
}
